// src/services/auth-service.ts
import axios, { AxiosInstance } from 'axios';
import { SecureTokenStorage } from './token-storage';
import { TokenManager } from './token-manager';
import { TokenBlacklist } from './token-blacklist';
import { MFAService } from './mfa-service';
import { RateLimiter } from './rate-limiter';
import { AuditLogger, AuditAction } from './audit-logger';
import { SessionManager } from './session-manager';
import { DeviceFingerprint } from './device-fingerprint';
import { AuthState, LoginCredentials, RegisterData, User } from '../types';
import { API_ENDPOINTS } from '../utils/constants';

export class AuthService {
  private static instance: AuthService;
  private axiosInstance: AxiosInstance;
  private state: AuthState = {
    user: null,
    tokens: null,
    isAuthenticated: false,
    isLoading: true,
    error: null,
  };
  private listeners: ((state: AuthState) => void)[] = [];
  private baseURL: string;

  private constructor(apiUrl?: string) {
    this.baseURL = apiUrl || process.env.NEXT_PUBLIC_API_URL || 'http://localhost:3001/api';
    this.axiosInstance = axios.create({ 
      baseURL: this.baseURL, 
      withCredentials: true,
      timeout: 30000,
    });
    this.loadInitialState();
  }

  static getInstance(apiUrl?: string): AuthService {
    if (!AuthService.instance) {
      AuthService.instance = new AuthService(apiUrl);
    }
    return AuthService.instance;
  }

  // ============ NEW: Retry Logic & Health Check ============
  
  private async makeRequest<T>(
    method: string,
    url: string,
    data?: any,
    retries = 3
  ): Promise<T> {
    let lastError: Error | null = null;
    
    for (let i = 0; i < retries; i++) {
      try {
        const response = await this.axiosInstance.request({ 
          method, 
          url, 
          data,
          // Exponential backoff
          timeout: 30000 * (i + 1),
        });
        return response.data;
      } catch (error: any) {
        lastError = error;
        
        // Don't retry on 4xx errors (client errors)
        if (error.response?.status >= 400 && error.response?.status < 500) {
          throw error;
        }
        
        // Last retry - throw error
        if (i === retries - 1) {
          throw error;
        }
        
        // Wait with exponential backoff before retry
        const delay = 1000 * Math.pow(2, i);
        console.warn(`Request failed, retrying in ${delay}ms... (Attempt ${i + 2}/${retries})`);
        await new Promise(resolve => setTimeout(resolve, delay));
      }
    }
    
    throw lastError || new Error('Request failed after multiple retries');
  }

  async healthCheck(): Promise<boolean> {
    try {
      const response = await this.axiosInstance.get('/health', { timeout: 5000 });
      return response.status === 200;
    } catch (error) {
      console.error('Health check failed:', error);
      return false;
    }
  }

  async healthCheckWithRetry(retries = 2): Promise<boolean> {
    for (let i = 0; i < retries; i++) {
      const isHealthy = await this.healthCheck();
      if (isHealthy) return true;
      if (i < retries - 1) {
        await new Promise(resolve => setTimeout(resolve, 1000 * (i + 1)));
      }
    }
    return false;
  }

  // ============ END NEW METHODS ============

  private async loadInitialState(): Promise<void> {
    const tokens = SecureTokenStorage.getInstance().getTokens();
    const user = SecureTokenStorage.getInstance().getUser();
    
    this.state = {
      user,
      tokens,
      isAuthenticated: !!tokens && !TokenManager.getInstance().isTokenExpired(),
      isLoading: false,
      error: null,
    };
    
    this.notifyListeners();
  }

  private notifyListeners(): void {
    this.listeners.forEach(listener => listener({ ...this.state }));
  }

  subscribe(listener: (state: AuthState) => void): () => void {
    this.listeners.push(listener);
    listener({ ...this.state });
    return () => {
      this.listeners = this.listeners.filter(l => l !== listener);
    };
  }

  private updateState(updates: Partial<AuthState>): void {
    this.state = { ...this.state, ...updates };
    this.notifyListeners();
  }

  async login(credentials: LoginCredentials): Promise<{ requiresMFA: boolean; user?: User }> {
    this.updateState({ isLoading: true, error: null });
    
    const rateLimit = RateLimiter.getInstance().checkRateLimit(credentials.email);
    if (!rateLimit.allowed) {
      await AuditLogger.getInstance().log({
        action: AuditAction.LOGIN_FAILURE,
        email: credentials.email,
        details: { reason: 'Rate limit exceeded' },
        success: false,
      });
      this.updateState({ isLoading: false, error: `Too many attempts. Try again later.` });
      throw new Error(`Too many attempts. Try again later.`);
    }

    try {
      // Use the retry logic for login request
      const response:any = await this.makeRequest('POST', API_ENDPOINTS.login, credentials);
      const { user, requiresMFA, accessToken, refreshToken, expiresIn } = response;
      
      if (requiresMFA) {
        sessionStorage.setItem('temp_auth_email', credentials.email);
        sessionStorage.setItem('temp_auth_user_id', user.id);
        this.updateState({ isLoading: false });
        return { requiresMFA: true };
      }
      
      const deviceId = await SessionManager.getInstance().registerSession(user.id);
      const tokens = { accessToken, refreshToken, expiresIn };
      SecureTokenStorage.getInstance().setTokens(tokens);
      SecureTokenStorage.getInstance().setUser(user);
      
      await AuditLogger.getInstance().log({
        action: AuditAction.LOGIN_SUCCESS,
        userId: user.id,
        email: user.email,
        details: { deviceId },
        success: true,
      });
      
      RateLimiter.getInstance().reset(credentials.email);
      
      this.updateState({
        user,
        tokens,
        isAuthenticated: true,
        isLoading: false,
        error: null,
      });
      
      return { requiresMFA: false, user };
    } catch (error: any) {
      await AuditLogger.getInstance().log({
        action: AuditAction.LOGIN_FAILURE,
        email: credentials.email,
        success: false,
        errorMessage: error.message,
      });
      
      this.updateState({
        isLoading: false,
        error: error.response?.data?.message || error.message || 'Login failed',
      });
      throw error;
    }
  }

  async verifyMFA(code: string, trustDevice: boolean = false): Promise<User> {
    const email = sessionStorage.getItem('temp_auth_email');
    const userId = sessionStorage.getItem('temp_auth_user_id');
    
    if (!email || !userId) {
      throw new Error('No pending MFA verification');
    }
    
    const isValid = await MFAService.getInstance().verifyMFA(userId, code);
    if (!isValid) {
      throw new Error('Invalid MFA code');
    }
    
    // Use retry logic for MFA verification
    const response:any = await this.makeRequest('POST', API_ENDPOINTS.mfaVerify, {
      email,
      userId,
      trustDevice,
    });
    
    const { user, accessToken, refreshToken, expiresIn } = response;
    const tokens = { accessToken, refreshToken, expiresIn };
    SecureTokenStorage.getInstance().setTokens(tokens);
    SecureTokenStorage.getInstance().setUser(user);
    
    sessionStorage.removeItem('temp_auth_email');
    sessionStorage.removeItem('temp_auth_user_id');
    
    this.updateState({
      user,
      tokens,
      isAuthenticated: true,
      isLoading: false,
      error: null,
    });
    
    return user;
  }

  async register(data: RegisterData): Promise<User> {
    this.updateState({ isLoading: true, error: null });
    
    try {
      // Use retry logic for registration
      const response:any = await this.makeRequest('POST', API_ENDPOINTS.register, data);
      const { user, accessToken, refreshToken, expiresIn } = response;
      
      const tokens = { accessToken, refreshToken, expiresIn };
      SecureTokenStorage.getInstance().setTokens(tokens);
      SecureTokenStorage.getInstance().setUser(user);
      
      await AuditLogger.getInstance().log({
        action: AuditAction.REGISTER_SUCCESS,
        userId: user.id,
        email: user.email,
        success: true,
      });
      
      this.updateState({
        user,
        tokens,
        isAuthenticated: true,
        isLoading: false,
        error: null,
      });
      
      return user;
    } catch (error: any) {
      this.updateState({
        isLoading: false,
        error: error.response?.data?.message || error.message || 'Registration failed',
      });
      throw error;
    }
  }

  async logout(reason: 'logout' | 'revoke' | 'security' = 'logout'): Promise<void> {
    const user = SecureTokenStorage.getInstance().getUser();
    const tokens = SecureTokenStorage.getInstance().getTokens();
    
    if (tokens?.accessToken) {
      await TokenBlacklist.getInstance().addToBlacklist(
        tokens.accessToken,
        user?.id || '',
        reason
      );
    }
    
    try {
      await this.axiosInstance.post(API_ENDPOINTS.logout);
    } catch (error) {
      // Ignore logout errors - still clear local state
      console.warn('Logout API call failed, but clearing local state');
    }
    
    SecureTokenStorage.getInstance().clear();
    
    this.updateState({
      user: null,
      tokens: null,
      isAuthenticated: false,
      isLoading: false,
      error: null,
    });
    
    // Only redirect if in browser environment
    if (typeof window !== 'undefined') {
      window.location.href = '/login';
    }
  }

  async refreshSession(): Promise<void> {
    try {
      const tokens = SecureTokenStorage.getInstance().getTokens();
      if (!tokens?.refreshToken) throw new Error('No refresh token');
      
      // Use retry logic for refresh
      const response:any = await this.makeRequest('POST', API_ENDPOINTS.refresh, {
        refreshToken: tokens.refreshToken,
      });
      
      const { accessToken, refreshToken, expiresIn } = response;
      SecureTokenStorage.getInstance().setTokens({ accessToken, refreshToken, expiresIn });
      
      this.updateState({
        tokens: { accessToken, refreshToken, expiresIn },
        isAuthenticated: true,
      });
    } catch (error) {
      console.error('Session refresh failed:', error);
      this.logout('security');
    }
  }

  async logoutAllDevices(): Promise<void> {
    const user = SecureTokenStorage.getInstance().getUser();
    if (!user) return;
    
    try {
      await TokenBlacklist.getInstance().revokeAllUserTokens(user.id);
      await this.axiosInstance.post('/auth/logout-all');
    } catch (error) {
      console.warn('Logout all devices API call failed');
    }
    
    this.logout('revoke');
  }

  async changePassword(currentPassword: string, newPassword: string): Promise<void> {
    const user = SecureTokenStorage.getInstance().getUser();
    
    try {
      await this.makeRequest('POST', API_ENDPOINTS.changePassword, {
        currentPassword,
        newPassword,
      });
      
      await AuditLogger.getInstance().log({
        action: AuditAction.PASSWORD_CHANGE,
        userId: user?.id,
        email: user?.email,
        success: true,
      });
    } catch (error: any) {
      await AuditLogger.getInstance().log({
        action: AuditAction.PASSWORD_CHANGE,
        userId: user?.id,
        email: user?.email,
        success: false,
        errorMessage: error.message,
      });
      throw error;
    }
  }

  hasRole(role: string | string[]): boolean {
    if (!this.state.user) return false;
    const roles = Array.isArray(role) ? role : [role];
    return roles.includes(this.state.user.role || '');
  }

  getAxiosInstance(): AxiosInstance {
    return this.axiosInstance;
  }

  getUser(): User | null {
    return this.state.user;
  }

  getState(): AuthState {
    return { ...this.state };
  }
}