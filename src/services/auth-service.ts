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

// interface RegisterResponseData {
//   user: User;
//   tokens: {
//     accessToken: string;
//     refreshToken: string;
//     expiresIn: number;
//   };
// }

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

  // ============ Deep Data Extraction (Handles Multiple Wrappers) ============
  
  /**
   * Recursively unwrap nested data objects
   * Handles responses like: { data: { data: { data: { ... } } } }
   */
  private deepUnwrap<T>(obj: any): T {
    if (!obj || typeof obj !== 'object') {
      return obj;
    }
    
    // If object has a 'data' property, recursively unwrap it
    if (obj.data && typeof obj.data === 'object') {
      return this.deepUnwrap(obj.data);
    }
    
    // No more data wrappers, return the object
    return obj as T;
  }

  /**
   * Extract user and tokens from deeply nested response
   */
  private extractLoginData(response: any): LoginResponseData {
    // First, deep unwrap all the data wrappers
    const unwrapped = this.deepUnwrap<any>(response);
    
    // Now look for user and tokens in the unwrapped object
    let user = unwrapped.user;
    let tokens = unwrapped.tokens;
    let sessionId = unwrapped.sessionId;
    let requiresMFA = unwrapped.requiresMFA;
    
    // If not found at top level, search deeper
    if (!user && unwrapped.data) {
      user = unwrapped.data.user;
      tokens = unwrapped.data.tokens;
      sessionId = unwrapped.data.sessionId;
      requiresMFA = unwrapped.data.requiresMFA;
    }
    
    // If still not found, try one more level
    if (!user && unwrapped.data?.data) {
      user = unwrapped.data.data.user;
      tokens = unwrapped.data.data.tokens;
      sessionId = unwrapped.data.data.sessionId;
      requiresMFA = unwrapped.data.data.requiresMFA;
    }
    
    return { user, tokens, sessionId, requiresMFA };
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
      
      // ✅ Use deep extraction for nested response
      const data = this.extractLoginData(response);
      
      console.log('✅ Extracted login data:', { 
        hasUser: !!data.user, 
        hasTokens: !!data.tokens,
        requiresMFA: data.requiresMFA 
      });
      
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
        console.error('❌ No user data found in response');
        throw new Error('No user data in response');
      }
      
      if (!data.tokens?.accessToken || !data.tokens?.refreshToken) {
        console.error('❌ No tokens found in response');
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
    
    const data = this.extractLoginData(response);
    
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
    
    if (this.auditEnabled) {
      await AuditLogger.getInstance().log({
        action: AuditAction.MFA_VERIFIED,
        userId: data.user.id,
        email: data.user.email,
        success: true,
      });
    }
    
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
      
      // ✅ Use deep unwrapping
      const unwrapped = this.deepUnwrap<any>(response);
      const user = unwrapped.user || unwrapped.data?.user;
      const tokens = unwrapped.tokens || unwrapped.data?.tokens;
      
      if (!user) {
        throw new Error('No user data in response');
      }
      
      if (!tokens?.accessToken) {
        throw new Error('No tokens in response');
      }
      
      const tokenData = {
        accessToken: tokens.accessToken,
        refreshToken: tokens.refreshToken,
        expiresIn: tokens.expiresIn || 900,
      };
      
      SecureTokenStorage.getInstance().setTokens(tokenData);
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
        tokens: tokenData,
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
      
      const data = this.deepUnwrap<RefreshResponseData>(response);
      
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
    return this.deepUnwrap<MFASetup>(response);
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
    const updatedUser = this.deepUnwrap<User>(response);
    
    // Update stored user
    SecureTokenStorage.getInstance().setUser(updatedUser);
    
    this.updateState({ user: updatedUser });
    
    return updatedUser;
  }

  async requestPasswordReset(email: string): Promise<{ success: boolean; message: string }> {
    const response = await this.makeRequest('POST', API_ENDPOINTS.requestPasswordReset, { email });
    return this.deepUnwrap(response);
  }

  async resetPassword(token: string, newPassword: string): Promise<{ success: boolean; message: string }> {
    const response = await this.makeRequest('POST', API_ENDPOINTS.resetPassword, {
      token,
      newPassword,
    });
    return this.deepUnwrap(response);
  }

  async verifyEmail(email: string, code: string): Promise<{ success: boolean; message: string }> {
    const response = await this.makeRequest('POST', API_ENDPOINTS.verifyEmail, { email, code });
    return this.deepUnwrap(response);
  }

  async verifyPhone(phone: string, code: string): Promise<{ success: boolean; message: string }> {
    const response = await this.makeRequest('POST', API_ENDPOINTS.verifyPhone, { phone, code });
    return this.deepUnwrap(response);
  }

  async sendOtp(type: 'EMAIL' | 'PHONE', target: string): Promise<{ success: boolean; message: string }> {
    const response = await this.makeRequest('POST', API_ENDPOINTS.sendOtp, { type, target });
    return this.deepUnwrap(response);
  }
}