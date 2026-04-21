// src/interceptors/axios-interceptors.ts
import axios, { AxiosInstance, InternalAxiosRequestConfig, AxiosError } from 'axios';
import { TokenManager } from '../services/token-manager';
import { TokenBlacklist } from '../services/token-blacklist';
import { SecureTokenStorage } from '../services/token-storage';
import { API_ENDPOINTS } from '../utils/constants';

export function setupAuthInterceptors(axiosInstance: AxiosInstance, baseURL: string): void {
  // Request interceptor - adds Authorization header
  axiosInstance.interceptors.request.use(
    async (config) => {
      const token = TokenManager.getInstance().getAccessToken();
      
      if (token) {
        // Check if token is blacklisted
        const isBlacklisted = await TokenBlacklist.getInstance().isBlacklisted(token);
        if (isBlacklisted) {
          console.warn('Token is blacklisted, clearing storage');
          SecureTokenStorage.getInstance().clear();
          if (typeof window !== 'undefined') {
            window.location.href = '/sign-in';
          }
          return Promise.reject(new Error('Token revoked'));
        }
        
        // Only add header if token is not expired
        if (!TokenManager.getInstance().isTokenExpired()) {
          config.headers.Authorization = `Bearer ${token}`;
        }
      }
      
      // Log request for debugging (only in development)
      if (process.env.NODE_ENV === 'development') {
        console.log(`📤 ${config.method?.toUpperCase()} ${config.url}`, {
          hasAuth: !!config.headers.Authorization,
        });
      }
      
      return config;
    },
    (error) => Promise.reject(error)
  );

  // Response interceptor - handles 401 and token refresh
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
    (response) => {
      // Log response for debugging
      if (process.env.NODE_ENV === 'development') {
        console.log(`📥 ${response.status} ${response.config.url}`);
      }
      return response;
    },
    async (error: AxiosError) => {
      const originalRequest = error.config as InternalAxiosRequestConfig & { _retry?: boolean };
      
      // Skip refresh for auth endpoints themselves
      const isAuthEndpoint = originalRequest.url?.includes('/auth/refresh') || 
                             originalRequest.url?.includes('/auth/login') ||
                             originalRequest.url?.includes('/auth/logout');
      
      if (error.response?.status === 401 && !originalRequest._retry && !isAuthEndpoint) {
        if (isRefreshing) {
          // Queue the request while refresh is in progress
          return new Promise((resolve, reject) => {
            failedQueue.push({ resolve, reject, config: originalRequest });
          });
        }

        originalRequest._retry = true;
        isRefreshing = true;

        console.log('🔄 Attempting to refresh token...');

        try {
          const refreshToken = SecureTokenStorage.getInstance().getTokens()?.refreshToken;
          if (!refreshToken) {
            throw new Error('No refresh token available');
          }
          
          const response = await axios.post(`${baseURL}${API_ENDPOINTS.refresh}`, { 
            refreshToken 
          });
          
          // Handle wrapped response from backend
          const data = response.data?.data || response.data;
          const accessToken = data?.accessToken || data?.tokens?.accessToken;
          const newRefreshToken = data?.refreshToken || data?.tokens?.refreshToken;
          
          if (!accessToken) {
            throw new Error('No access token in refresh response');
          }
          
          // Store new tokens
          SecureTokenStorage.getInstance().setTokens({
            accessToken,
            refreshToken: newRefreshToken || refreshToken,
            expiresIn: data?.expiresIn || 900,
          });

          console.log('✅ Token refreshed successfully');
          
          // Process queued requests
          processQueue(null, accessToken);
          
          // Retry the original request
          if (originalRequest.headers) {
            originalRequest.headers.Authorization = `Bearer ${accessToken}`;
          }
          return axiosInstance(originalRequest);
        } catch (refreshError: any) {
          console.error('❌ Token refresh failed:', refreshError.message);
          
          // Process queued requests with error
          processQueue(refreshError);
          
          // Try to blacklist the token
          const tokens = SecureTokenStorage.getInstance().getTokens();
          if (tokens?.accessToken) {
            try {
              await axios.post(`${baseURL}${API_ENDPOINTS.blacklist}`, {
                token: tokens.accessToken
              });
            } catch (e) {
              // Ignore blacklist errors
            }
          }
          
          // Clear storage and redirect to login
          SecureTokenStorage.getInstance().clear();
          
          if (typeof window !== 'undefined') {
            // Store current location for redirect after login
            sessionStorage.setItem('redirectAfterLogin', window.location.pathname);
            window.location.href = '/sign-in';
          }
          
          return Promise.reject(refreshError);
        } finally {
          isRefreshing = false;
        }
      }
      
      // Log error for debugging
      if (process.env.NODE_ENV === 'development') {
        console.error(`❌ ${error.response?.status} ${originalRequest.url}`, {
          message: error.message,
          data: error.response?.data,
        });
      }
      
      return Promise.reject(error);
    }
  );
}