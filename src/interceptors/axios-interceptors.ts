// src/interceptors/axios-interceptors.ts
import axios, { AxiosInstance, InternalAxiosRequestConfig, AxiosError } from 'axios';
import { TokenManager } from '../services/token-manager';
import { TokenBlacklist } from '../services/token-blacklist';
import { SecureTokenStorage } from '../services/token-storage';
import { API_ENDPOINTS } from '../utils/constants';

export function setupAuthInterceptors(axiosInstance: AxiosInstance, baseURL: string): void {
  // Request interceptor
  axiosInstance.interceptors.request.use(
    async (config) => {
      const token = TokenManager.getInstance().getAccessToken();
      
      if (token) {
        const isBlacklisted = await TokenBlacklist.getInstance().isBlacklisted(token);
        if (isBlacklisted) {
          SecureTokenStorage.getInstance().clear();
          window.location.href = '/login';
          return Promise.reject(new Error('Token revoked'));
        }
        
        if (!TokenManager.getInstance().isTokenExpired()) {
          config.headers.Authorization = `Bearer ${token}`;
        }
      }
      return config;
    },
    (error) => Promise.reject(error)
  );

  // Response interceptor
  let isRefreshing = false;
  let failedQueue: Array<{
    resolve: (value: any) => void;
    reject: (reason?: any) => void;
    config: InternalAxiosRequestConfig;
  }> = [];

  const processQueue = (error: any | null, token: string | null = null) => {
    failedQueue.forEach(prom => {
      if (error) {
        prom.reject(error);
      } else {
        if (prom.config.headers) {
          prom.config.headers.Authorization = `Bearer ${token}`;
        }
        axiosInstance(prom.config).then(prom.resolve).catch(prom.reject);
      }
    });
    failedQueue = [];
  };

  axiosInstance.interceptors.response.use(
    (response) => response,
    async (error: AxiosError) => {
      const originalRequest = error.config as InternalAxiosRequestConfig & { _retry?: boolean };
      
      if (error.response?.status === 401 && !originalRequest._retry) {
        if (isRefreshing) {
          return new Promise((resolve, reject) => {
            failedQueue.push({ resolve, reject, config: originalRequest });
          });
        }

        originalRequest._retry = true;
        isRefreshing = true;

        try {
          const refreshToken = SecureTokenStorage.getInstance().getTokens()?.refreshToken;
          if (!refreshToken) throw new Error('No refresh token');
          
          const response = await axios.post(`${baseURL}${API_ENDPOINTS.refresh}`, { refreshToken });
          const { accessToken, refreshToken: newRefreshToken } = response.data;
          
          SecureTokenStorage.getInstance().setTokens({
            accessToken,
            refreshToken: newRefreshToken,
            expiresIn: 900,
          });

          processQueue(null, accessToken);
          
          if (originalRequest.headers) {
            originalRequest.headers.Authorization = `Bearer ${accessToken}`;
          }
          return axiosInstance(originalRequest);
        } catch (refreshError) {
          processQueue(refreshError);
          SecureTokenStorage.getInstance().clear();
          window.location.href = '/login';
          return Promise.reject(refreshError);
        } finally {
          isRefreshing = false;
        }
      }
      
      return Promise.reject(error);
    }
  );
}