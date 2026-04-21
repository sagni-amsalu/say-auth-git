// src/services/auth-service.ts
import axios, { AxiosInstance } from 'axios';
import { SecureTokenStorage } from './token-storage';
import { TokenManager } from './token-manager';
import { TokenBlacklist } from './token-blacklist';
import { MFAService } from './mfa-service';
import { RateLimiter } from './rate-limiter';
import { AuditLogger, AuditAction } from './audit-logger';
import { SessionManager } from './session-manager';
import { AuthState, LoginCredentials, MFASetup, RegisterData, User } from '../types';
import { API_ENDPOINTS } from '../utils/constants';

// ============= Response Types =============
// interface ApiResponse<T = any> {
//   data?: T;
//   message?: string;
//   statusCode?: number;
// }

interface LoginResponseData {
  user: User;
  tokens: {
    accessToken: string;
    refreshToken: string;
    expiresIn: number;
  };
  sessionId?: string;
  requiresMFA?: boolean;
}

interface RegisterResponseData {
  user: User;
  tokens: {
    accessToken: string;
    refreshToken: string;
    expiresIn: number;
  };
}

interface RefreshResponseData {
  accessToken: string;
  refreshToken: string;
  expiresIn: number;
}

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
  private auditEnabled: boolean = true;

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

  // ============ Audit Control ============
  
  /**
   * Enable or disable audit logging
   * @param enabled - true to enable, false to disable
   */
  setAuditEnabled(enabled: boolean): void {
    this.auditEnabled = enabled;
    AuditLogger.getInstance().setEnabled(enabled);
  }

  /**
   * Check if audit logging is enabled
   */
  isAuditEnabled(): boolean {
    return this.auditEnabled;
  }

  // ============ Robust Data Extraction ============
  
  /**
   * Extract data from response - handles both wrapped { data: {...} } and unwrapped {...} formats
   */
  private extractData<T>(response: any): T {
    // Handle null/undefined
    if (!response) {
      throw new Error('Empty response received');
    }
    
    // Handle { data: {...} } wrapper (your backend format)
    if (response.data && typeof response.data === 'object') {
      return response.data as T;
    }
    
    // Handle direct response (already unwrapped)
    return response as T;
  }

  // ============ Retry Logic & Health Check ============
  
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

  // ============ State Management ============

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

  // ============ Authentication Methods ============

  /**
   * Login with email and password
   */
  async login(credentials: LoginCredentials): Promise<{ requiresMFA: boolean; user?: User }> {
    this.updateState({ isLoading: true, error: null });
    
    // Rate limiting check
    const rateLimit = RateLimiter.getInstance().checkRateLimit(credentials.email);
    if (!rateLimit.allowed) {
      if (this.auditEnabled) {
        await AuditLogger.getInstance().log({
          action: AuditAction.LOGIN_FAILURE,
          email: credentials.email,
          details: { reason: 'Rate limit exceeded' },
          success: false,
        });
      }
      this.updateState({ isLoading: false, error: `Too many attempts. Try again later.` });
      throw new Error(`Too many attempts. Try again later.`);
    }

    try {
      const response = await this.makeRequest('POST', API_ENDPOINTS.login, credentials);

      console.log(`response-1-${JSON.stringify(response)}`)
      
      // ✅ Robust data extraction - handles both wrapped and unwrapped responses
      const data = this.extractData<LoginResponseData>(response);

       console.log(`data-1-${JSON.stringify(data)}`)
      
      // Check if MFA is required
      if (data.requiresMFA) {
        sessionStorage.setItem('temp_auth_email', credentials.email);
        if (data.user?.id) {
          sessionStorage.setItem('temp_auth_user_id', data.user.id);
        }
        this.updateState({ isLoading: false });
        return { requiresMFA: true };
      }
      
      // Validate required fields
      if (!data.user) {
        throw new Error('No user data in response');
      }
      
      if (!data.tokens?.accessToken || !data.tokens?.refreshToken) {
        throw new Error('No tokens in response');
      }
      
      const user = data.user;
      const tokens = {
        accessToken: data.tokens.accessToken,
        refreshToken: data.tokens.refreshToken,
        expiresIn: data.tokens.expiresIn || 900,
      };
      
      // Register session
      const deviceId = await SessionManager.getInstance().registerSession(user.id);
      
      // Store tokens and user
      SecureTokenStorage.getInstance().setTokens(tokens);
      SecureTokenStorage.getInstance().setUser(user);
      
      // Log success
      if (this.auditEnabled) {
        await AuditLogger.getInstance().log({
          action: AuditAction.LOGIN_SUCCESS,
          userId: user.id,
          email: user.email,
          details: { deviceId },
          success: true,
        });
      }
      
      // Reset rate limiter
      RateLimiter.getInstance().reset(credentials.email);
      
      // Update state
      this.updateState({
        user,
        tokens,
        isAuthenticated: true,
        isLoading: false,
        error: null,
      });
      
      return { requiresMFA: false, user };
    } catch (error: any) {
      // Log failure
      if (this.auditEnabled) {
        await AuditLogger.getInstance().log({
          action: AuditAction.LOGIN_FAILURE,
          email: credentials.email,
          success: false,
          errorMessage: error.message,
        });
      }
      
      // Extract error message
      const errorMessage = error.response?.data?.message 
        || error.response?.data?.error 
        || error.message 
        || 'Login failed';
      
      this.updateState({
        isLoading: false,
        error: errorMessage,
      });
      throw new Error(errorMessage);
    }
  }

  /**
   * Verify MFA code
   */
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
    
    const response = await this.makeRequest('POST', API_ENDPOINTS.mfaVerify, {
      email,
      userId,
      trustDevice,
    });
    
    const data = this.extractData<LoginResponseData>(response);
    
    if (!data.user || !data.tokens) {
      throw new Error('Invalid response from server');
    }
    
    const tokens = {
      accessToken: data.tokens.accessToken,
      refreshToken: data.tokens.refreshToken,
      expiresIn: data.tokens.expiresIn || 900,
    };
    
    SecureTokenStorage.getInstance().setTokens(tokens);
    SecureTokenStorage.getInstance().setUser(data.user);
    
    sessionStorage.removeItem('temp_auth_email');
    sessionStorage.removeItem('temp_auth_user_id');
    
    this.updateState({
      user: data.user,
      tokens,
      isAuthenticated: true,
      isLoading: false,
      error: null,
    });
    
    return data.user;
  }

  /**
   * Register a new user
   */
  async register(data: RegisterData): Promise<User> {
    this.updateState({ isLoading: true, error: null });
    
    try {
      const response = await this.makeRequest('POST', API_ENDPOINTS.register, data);
      
      // ✅ Robust data extraction
      const extractedData = this.extractData<RegisterResponseData>(response);
      
      if (!extractedData.user) {
        throw new Error('No user data in response');
      }
      
      if (!extractedData.tokens?.accessToken) {
        throw new Error('No tokens in response');
      }
      
      const user = extractedData.user;
      const tokens = {
        accessToken: extractedData.tokens.accessToken,
        refreshToken: extractedData.tokens.refreshToken,
        expiresIn: extractedData.tokens.expiresIn || 900,
      };
      
      SecureTokenStorage.getInstance().setTokens(tokens);
      SecureTokenStorage.getInstance().setUser(user);
      
      if (this.auditEnabled) {
        await AuditLogger.getInstance().log({
          action: AuditAction.REGISTER_SUCCESS,
          userId: user.id,
          email: user.email,
          success: true,
        });
      }
      
      this.updateState({
        user,
        tokens,
        isAuthenticated: true,
        isLoading: false,
        error: null,
      });
      
      return user;
    } catch (error: any) {
      const errorMessage = error.response?.data?.message 
        || error.response?.data?.error 
        || error.message 
        || 'Registration failed';
      
      this.updateState({
        isLoading: false,
        error: errorMessage,
      });
      throw new Error(errorMessage);
    }
  }

  /**
   * Logout current user
   */
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
      console.warn('Logout API call failed, but clearing local state');
    }
    
    if (this.auditEnabled && user) {
      await AuditLogger.getInstance().log({
        action: AuditAction.LOGOUT,
        userId: user.id,
        email: user.email,
        details: { reason },
        success: true,
      });
    }
    
    SecureTokenStorage.getInstance().clear();
    
    this.updateState({
      user: null,
      tokens: null,
      isAuthenticated: false,
      isLoading: false,
      error: null,
    });
    
    if (typeof window !== 'undefined') {
      window.location.href = '/login';
    }
  }

  /**
   * Refresh the access token using refresh token
   */
  async refreshSession(): Promise<void> {
    try {
      const tokens = SecureTokenStorage.getInstance().getTokens();
      if (!tokens?.refreshToken) throw new Error('No refresh token');
      
      const response = await this.makeRequest('POST', API_ENDPOINTS.refresh, {
        refreshToken: tokens.refreshToken,
      });
      
      const data = this.extractData<RefreshResponseData>(response);
      
      if (!data.accessToken) {
        throw new Error('No access token in refresh response');
      }
      
      const newTokens = {
        accessToken: data.accessToken,
        refreshToken: data.refreshToken || tokens.refreshToken,
        expiresIn: data.expiresIn || 900,
      };
      
      SecureTokenStorage.getInstance().setTokens(newTokens);
      
      this.updateState({
        tokens: newTokens,
        isAuthenticated: true,
      });
    } catch (error) {
      console.error('Session refresh failed:', error);
      this.logout('security');
    }
  }

  /**
   * Logout from all devices
   */
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

  /**
   * Change user password
   */
  async changePassword(currentPassword: string, newPassword: string): Promise<void> {
    const user = SecureTokenStorage.getInstance().getUser();
    
    try {
      await this.makeRequest('POST', API_ENDPOINTS.changePassword, {
        currentPassword,
        newPassword,
      });
      
      if (this.auditEnabled) {
        await AuditLogger.getInstance().log({
          action: AuditAction.PASSWORD_CHANGE,
          userId: user?.id,
          email: user?.email,
          success: true,
        });
      }
    } catch (error: any) {
      if (this.auditEnabled) {
        await AuditLogger.getInstance().log({
          action: AuditAction.PASSWORD_CHANGE,
          userId: user?.id,
          email: user?.email,
          success: false,
          errorMessage: error.message,
        });
      }
      throw error;
    }
  }

  // ============ Utility Methods ============

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

  async setupMFA(): Promise<MFASetup> {
    const response = await this.makeRequest('POST', API_ENDPOINTS.mfaSetup);
    return this.extractData<MFASetup>(response);
  }

  async disableMFA(code: string): Promise<void> {
    await this.makeRequest('POST', API_ENDPOINTS.mfaDisable, { code });
    
    if (this.auditEnabled) {
      const user = this.state.user;
      await AuditLogger.getInstance().log({
        action: AuditAction.MFA_DISABLED,
        userId: user?.id,
        email: user?.email,
        success: true,
      });
    }
  }

  async updateUser(userData: Partial<User>): Promise<User> {
    const response = await this.makeRequest('PUT', '/users/profile', userData);
    const updatedUser = this.extractData<User>(response);
    
    // Update stored user
    SecureTokenStorage.getInstance().setUser(updatedUser);
    
    this.updateState({ user: updatedUser });
    
    return updatedUser;
  }
}