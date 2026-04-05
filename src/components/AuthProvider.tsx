// src/components/AuthProvider.tsx
'use client';

import React, { createContext, useContext, useEffect, useState, useCallback, useMemo } from 'react';
import { AuthService } from '../services/auth-service';
import { AUTH_CONFIG } from '../utils/constants';
import { 
  User,  
  LoginCredentials, 
  RegisterData, 
  AuthState,
  MFASetup,
} from '../types';

// ============= Extended Types for Provider =============
interface AuthContextValue extends AuthState {
  login: (credentials: LoginCredentials) => Promise<{ requiresMFA: boolean; user?: User }>;
  register: (data: RegisterData) => Promise<User>;
  logout: () => Promise<void>;
  logoutAllDevices: () => Promise<void>;
  refreshSession: () => Promise<void>;
  changePassword: (currentPassword: string, newPassword: string) => Promise<void>;
  hasRole: (role: string | string[]) => boolean;
  getAxiosInstance: () => any;
  getUser: () => User | null;
  verifyMFA: (code: string, trustDevice?: boolean) => Promise<User>;
  setupMFA: () => Promise<MFASetup>;
  disableMFA: (code: string) => Promise<void>;
  updateUser: (userData: Partial<User>) => Promise<void>;
  clearError: () => void;
  isTokenExpired: () => boolean;
  getAccessToken: () => string | null;
  healthCheck: () => Promise<boolean>;
  refreshTokens: () => Promise<void>;
  getRemainingSessionTime: () => number;
  extendSession: () => Promise<void>;
}

interface AuthProviderProps {
  children: React.ReactNode;
  apiUrl?: string;
  onError?: (error: string) => void;
  onSessionExpired?: () => void;
  onLogin?: (user: User) => void;
  onLogout?: () => void;
  autoRefresh?: boolean;
  refreshThreshold?: number;
}

// ============= Context Creation =============
const AuthContext = createContext<AuthContextValue | null>(null);

// ============= Provider Component =============
export function AuthProvider({ 
  children, 
  apiUrl, 
  onError,
  onSessionExpired,
  onLogin,
  onLogout,
  autoRefresh = true,
  refreshThreshold = AUTH_CONFIG.tokenRefreshThreshold
}: AuthProviderProps) {
  const [state, setState] = useState<AuthState>({
    user: null,
    tokens: null,
    isAuthenticated: false,
    isLoading: true,
    error: null,
  });

  const [refreshTimeout, setRefreshTimeout] = useState<NodeJS.Timeout | null>(null);
  const [sessionTimeout, setSessionTimeout] = useState<NodeJS.Timeout | null>(null);

  // Get auth service instance
  const authService = useMemo(() => AuthService.getInstance(apiUrl), [apiUrl]);

  // Subscribe to auth state changes
  useEffect(() => {
    const unsubscribe = authService.subscribe((newState: AuthState) => {
      setState(newState);
      
      // Handle session expiry
      if (!newState.isAuthenticated && newState.error === 'Session expired') {
        onSessionExpired?.();
      }
      
      // Handle errors
      if (newState.error && onError) {
        onError(newState.error);
      }
      
      // Trigger callbacks
      if (newState.isAuthenticated && newState.user) {
        onLogin?.(newState.user);
      } else if (!newState.isAuthenticated && !newState.isLoading) {
        onLogout?.();
      }
    });
    
    return () => {
      unsubscribe();
      if (refreshTimeout) clearTimeout(refreshTimeout);
      if (sessionTimeout) clearTimeout(sessionTimeout);
    };
  }, [authService, onError, onSessionExpired, onLogin, onLogout]);

  // Auto-refresh token
  useEffect(() => {
    if (!autoRefresh || !state.tokens?.accessToken || !state.isAuthenticated) {
      return;
    }

    const setupAutoRefresh = () => {
      const tokenExpiry = getTokenExpiry(state.tokens!.accessToken);
      if (!tokenExpiry) return;

      const timeUntilExpiry = tokenExpiry.getTime() - Date.now();
      const refreshTime = Math.max(timeUntilExpiry - refreshThreshold, 0);

      if (refreshTime <= 0) {
        refreshSession();
        return;
      }

      const timeout = setTimeout(() => {
        refreshSession();
      }, refreshTime);

      setRefreshTimeout(timeout);
    };

    setupAutoRefresh();

    return () => {
      if (refreshTimeout) clearTimeout(refreshTimeout);
    };
  }, [state.tokens?.accessToken, state.isAuthenticated, autoRefresh, refreshThreshold]);

  // Session timeout management
  useEffect(() => {
    if (!state.isAuthenticated || !state.tokens?.accessToken) {
      return;
    }

    const setupSessionTimeout = () => {
      const tokenExpiry = getTokenExpiry(state.tokens!.accessToken);
      if (!tokenExpiry) return;

      const timeUntilExpiry = tokenExpiry.getTime() - Date.now();
      
      if (timeUntilExpiry <= 0) {
        handleSessionExpired();
        return;
      }

      const timeout = setTimeout(() => {
        handleSessionExpired();
      }, timeUntilExpiry);

      setSessionTimeout(timeout);
    };

    setupSessionTimeout();

    return () => {
      if (sessionTimeout) clearTimeout(sessionTimeout);
    };
  }, [state.tokens?.accessToken, state.isAuthenticated]);

  // ============= Helper Functions =============
  const getTokenExpiry = useCallback((token: string): Date | null => {
    try {
      const payload = JSON.parse(atob(token.split('.')[1]));
      return payload.exp ? new Date(payload.exp * 1000) : null;
    } catch {
      return null;
    }
  }, []);

  const handleSessionExpired = useCallback(async () => {
    console.warn('Session expired');
    await authService.logout('security');
    onSessionExpired?.();
  }, [authService, onSessionExpired]);

  // ============= Auth Methods =============
  const login = useCallback(async (credentials: LoginCredentials) => {
    try {
      const result = await authService.login(credentials);
      return result;
    } catch (error: any) {
      const errorMessage = error.response?.data?.message || error.message || 'Login failed';
      throw new Error(errorMessage);
    }
  }, [authService]);

  const register = useCallback(async (data: RegisterData) => {
    try {
      const user = await authService.register(data);
      return user;
    } catch (error: any) {
      const errorMessage = error.response?.data?.message || error.message || 'Registration failed';
      throw new Error(errorMessage);
    }
  }, [authService]);

  const logout = useCallback(async () => {
    try {
      await authService.logout('logout');
    } catch (error) {
      console.error('Logout error:', error);
    }
  }, [authService]);

  const logoutAllDevices = useCallback(async () => {
    try {
      await authService.logoutAllDevices();
    } catch (error) {
      console.error('Logout all devices error:', error);
      throw error;
    }
  }, [authService]);

  const refreshSession = useCallback(async () => {
    try {
      await authService.refreshSession();
    } catch (error) {
      console.error('Session refresh failed:', error);
    }
  }, [authService]);

  const changePassword = useCallback(async (currentPassword: string, newPassword: string) => {
    try {
      await authService.changePassword(currentPassword, newPassword);
    } catch (error: any) {
      const errorMessage = error.response?.data?.message || error.message || 'Password change failed';
      throw new Error(errorMessage);
    }
  }, [authService]);

  const verifyMFA = useCallback(async (code: string, trustDevice?: boolean) => {
    try {
      const user = await authService.verifyMFA(code, trustDevice || false);
      return user;
    } catch (error: any) {
      const errorMessage = error.response?.data?.message || error.message || 'MFA verification failed';
      throw new Error(errorMessage);
    }
  }, [authService]);

  const setupMFA = useCallback(async (): Promise<MFASetup> => {
    try {
      const response = await authService.getAxiosInstance().post('/auth/mfa/setup');
      return response.data;
    } catch (error: any) {
      const errorMessage = error.response?.data?.message || error.message || 'MFA setup failed';
      throw new Error(errorMessage);
    }
  }, [authService]);

  const disableMFA = useCallback(async (code: string): Promise<void> => {
    try {
      await authService.getAxiosInstance().post('/auth/mfa/disable', { code });
      // Update user state
      if (state.user) {
        setState(prev => ({ 
          ...prev, 
          user: { ...prev.user!, mfaEnabled: false }
        }));
      }
    } catch (error: any) {
      const errorMessage = error.response?.data?.message || error.message || 'MFA disable failed';
      throw new Error(errorMessage);
    }
  }, [authService, state.user]);

  const hasRole = useCallback((role: string | string[]): boolean => {
    return authService.hasRole(role);
  }, [authService]);

  const getAxiosInstance = useCallback(() => {
    return authService.getAxiosInstance();
  }, [authService]);

  const getUser = useCallback(() => {
    return authService.getUser();
  }, [authService]);

  const updateUser = useCallback(async (userData: Partial<User>): Promise<void> => {
    try {
      const updatedUser = await authService.getAxiosInstance().put('/users/profile', userData);
      setState(prev => ({ ...prev, user: updatedUser.data }));
    } catch (error: any) {
      const errorMessage = error.response?.data?.message || error.message || 'User update failed';
      throw new Error(errorMessage);
    }
  }, [authService]);

  const clearError = useCallback(() => {
    setState(prev => ({ ...prev, error: null }));
  }, []);

  const isTokenExpired = useCallback(() => {
    if (!state.tokens?.accessToken) return true;
    const expiry = getTokenExpiry(state.tokens.accessToken);
    if (!expiry) return true;
    return expiry.getTime() <= Date.now();
  }, [state.tokens?.accessToken, getTokenExpiry]);

  const getAccessToken = useCallback(() => {
    return state.tokens?.accessToken || null;
  }, [state.tokens?.accessToken]);

  const healthCheck = useCallback(async () => {
    return await authService.healthCheckWithRetry();
  }, [authService]);

  const refreshTokens = useCallback(async () => {
    await authService.refreshSession();
  }, [authService]);

  const getRemainingSessionTime = useCallback(() => {
    if (!state.tokens?.accessToken) return 0;
    const expiry = getTokenExpiry(state.tokens.accessToken);
    if (!expiry) return 0;
    return Math.max(expiry.getTime() - Date.now(), 0);
  }, [state.tokens?.accessToken, getTokenExpiry]);

  const extendSession = useCallback(async () => {
    await refreshSession();
  }, [refreshSession]);

  // ============= Context Value =============
  const value: AuthContextValue = useMemo(() => ({
    ...state,
    login,
    register,
    logout,
    logoutAllDevices,
    refreshSession,
    changePassword,
    verifyMFA,
    setupMFA,
    disableMFA,
    hasRole,
    getAxiosInstance,
    getUser,
    updateUser,
    clearError,
    isTokenExpired,
    getAccessToken,
    healthCheck,
    refreshTokens,
    getRemainingSessionTime,
    extendSession,
  }), [
    state,
    login,
    register,
    logout,
    logoutAllDevices,
    refreshSession,
    changePassword,
    verifyMFA,
    setupMFA,
    disableMFA,
    hasRole,
    getAxiosInstance,
    getUser,
    updateUser,
    clearError,
    isTokenExpired,
    getAccessToken,
    healthCheck,
    refreshTokens,
    getRemainingSessionTime,
    extendSession,
  ]);

  return (
    <AuthContext.Provider value={value}>
      {children}
    </AuthContext.Provider>
  );
}

// ============= Hook =============
export function useAuthContext() {
  const context = useContext(AuthContext);
  if (!context) {
    throw new Error('useAuthContext must be used within AuthProvider');
  }
  return context;
}

// ============= HOC for Class Components =============
export function withAuth<P extends object>(
  Component: React.ComponentType<P>
): React.FC<P & { auth?: AuthContextValue }> {
  return function WithAuthComponent(props: P) {
    const auth = useAuthContext();
    return React.createElement(Component, { ...props, auth });
  };
}

// ============= Protected Route Component =============
interface ProtectedRouteProps {
  children: React.ReactNode;
  allowedRoles?: string | string[];
  fallback?: React.ReactNode;
  redirectTo?: string;
  requireMFA?: boolean;
}

export function ProtectedRoute({ 
  children, 
  allowedRoles, 
  fallback,
  redirectTo = '/login',
  requireMFA = false
}: ProtectedRouteProps) {
  const { isAuthenticated, isLoading, hasRole, user} = useAuthContext();
  
  if (isLoading) {
    return (
      <div className="flex items-center justify-center min-h-screen">
        <div className="text-center">
          <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-gray-900 mx-auto"></div>
          <p className="mt-4 text-gray-600">Loading...</p>
        </div>
      </div>
    );
  }
  
  if (!isAuthenticated) {
    if (typeof window !== 'undefined') {
      sessionStorage.setItem('redirectAfterLogin', window.location.pathname);
      window.location.href = redirectTo;
    }
    return fallback || null;
  }
  
  if (requireMFA && !user?.mfaEnabled) {
    if (typeof window !== 'undefined') {
      window.location.href = '/mfa/setup';
    }
    return null;
  }
  
  if (allowedRoles && !hasRole(allowedRoles)) {
    return (
      <div className="flex items-center justify-center min-h-screen">
        <div className="text-center">
          <h1 className="text-2xl font-bold text-red-600">Access Denied</h1>
          <p className="mt-2 text-gray-600">You don't have permission to access this page.</p>
        </div>
      </div>
    );
  }
  
  return <>{children}</>;
}

// ============= Role-Based Render Component =============
interface RoleBasedProps {
  children: React.ReactNode;
  roles: string | string[];
  fallback?: React.ReactNode;
}

export function RoleBased({ children, roles, fallback = null }: RoleBasedProps) {
  const { hasRole, isAuthenticated } = useAuthContext();
  
  if (isAuthenticated && hasRole(roles)) {
    return <>{children}</>;
  }
  
  return <>{fallback}</>;
}

// ============= MFA Required Component =============
interface MFARequiredProps {
  children: React.ReactNode;
  redirectTo?: string;
}

export function MFARequired({ children, redirectTo = '/mfa/setup' }: MFARequiredProps) {
  const { user, isAuthenticated, isLoading } = useAuthContext();
  
  if (isLoading) {
    return <div>Loading...</div>;
  }
  
  if (!isAuthenticated) {
    return null;
  }
  
  if (!user?.mfaEnabled) {
    if (typeof window !== 'undefined') {
      window.location.href = redirectTo;
    }
    return null;
  }
  
  return <>{children}</>;
}

// ============= Authentication Status Component =============
export function AuthStatus() {
  const { user, isAuthenticated, isLoading, getRemainingSessionTime } = useAuthContext();
  
  if (isLoading) return <div>Checking authentication...</div>;
  
  if (!isAuthenticated) return <div>Not authenticated</div>;
  
  const remainingTime = getRemainingSessionTime();
  const remainingMinutes = Math.floor(remainingTime / 60000);
  
  return (
    <div className="text-sm">
      Logged in as: <strong>{user?.name}</strong> ({user?.email})
      {user?.role && <span className="ml-2 text-blue-600">Role: {user.role}</span>}
      {user?.mfaEnabled && <span className="ml-2 text-green-600">✓ MFA</span>}
      {remainingMinutes > 0 && (
        <span className="ml-2 text-gray-500">
          Session: {remainingMinutes}min
        </span>
      )}
    </div>
  );
}

// ============= Session Timer Component =============
export function SessionTimer() {
  const { getRemainingSessionTime, extendSession, logout } = useAuthContext();
  const [timeLeft, setTimeLeft] = useState(getRemainingSessionTime());
  
  useEffect(() => {
    const interval = setInterval(() => {
      const remaining = getRemainingSessionTime();
      setTimeLeft(remaining);
      
      // Show warning when 5 minutes left
      if (remaining <= 5 * 60 * 1000 && remaining > 0) {
        const shouldExtend = window.confirm(
          `Your session will expire in ${Math.floor(remaining / 60000)} minutes. Would you like to extend it?`
        );
        if (shouldExtend) {
          extendSession();
        }
      }
      
      // Auto logout when expired
      if (remaining <= 0) {
        logout();
      }
    }, 1000);
    
    return () => clearInterval(interval);
  }, [getRemainingSessionTime, extendSession, logout]);
  
  if (timeLeft <= 0) return null;
  
  const minutes = Math.floor(timeLeft / 60000);
  const seconds = Math.floor((timeLeft % 60000) / 1000);
  
  return (
    <div className="fixed bottom-4 left-4 bg-gray-900 text-white px-3 py-1 rounded text-xs font-mono">
      Session: {minutes}:{seconds.toString().padStart(2, '0')}
    </div>
  );
}

// ============= Debug Component =============
export function AuthDebug() {
  const auth = useAuthContext();
  
  if (process.env.NODE_ENV !== 'development') {
    return null;
  }
  
  return (
    <div className="fixed bottom-4 right-4 bg-black text-white p-4 rounded-lg text-xs font-mono z-50 max-w-md overflow-auto shadow-xl">
      <details>
        <summary className="cursor-pointer font-bold hover:text-gray-300">🔐 Auth Debug Info</summary>
        <div className="mt-2 space-y-1">
          <div>✅ Authenticated: {auth.isAuthenticated ? 'Yes' : 'No'}</div>
          <div>⏳ Loading: {auth.isLoading ? 'Yes' : 'No'}</div>
          <div>👤 User: {auth.user?.email || 'None'}</div>
          <div>📛 Name: {auth.user?.name || 'None'}</div>
          <div>🎭 Role: {auth.user?.role || 'None'}</div>
          <div>🔐 MFA: {auth.user?.mfaEnabled ? 'Enabled' : 'Disabled'}</div>
          <div>⏰ Token Expired: {auth.isTokenExpired() ? 'Yes' : 'No'}</div>
          <div>🎫 Has Token: {auth.getAccessToken() ? 'Yes' : 'No'}</div>
          <div>⏱️ Session Time: {Math.floor(auth.getRemainingSessionTime() / 1000)}s</div>
          {auth.error && <div className="text-red-500">❌ Error: {auth.error}</div>}
        </div>
      </details>
    </div>
  );
}

// ============= Session Monitor Component =============
export function SessionMonitor() {
  const { isAuthenticated, refreshSession } = useAuthContext();
  
  useEffect(() => {
    if (!isAuthenticated) return;
    
    // Check session health every 5 minutes
    const interval = setInterval(async () => {
      try {
        await refreshSession();
      } catch (error) {
        console.error('Session health check failed:', error);
      }
    }, 5 * 60 * 1000);
    
    return () => clearInterval(interval);
  }, [isAuthenticated, refreshSession]);
  
  return null;
}

// ============= Session Expiry Warning Component =============
interface SessionExpiryWarningProps {
  warningMinutes?: number[];
  onExtend?: () => void;
}

export function SessionExpiryWarning({ 
  warningMinutes = [5, 2, 1], 
  onExtend 
}: SessionExpiryWarningProps) {
  const { getRemainingSessionTime, extendSession } = useAuthContext();
  const [showWarning, setShowWarning] = useState(false);
  const [timeLeft, setTimeLeft] = useState(0);
  
  useEffect(() => {
    const interval = setInterval(() => {
      const remaining = getRemainingSessionTime();
      setTimeLeft(remaining);
      
      const shouldShow = warningMinutes.some(
        minutes => Math.abs(remaining - minutes * 60 * 1000) < 1000
      );
      
      setShowWarning(shouldShow && remaining > 0);
    }, 1000);
    
    return () => clearInterval(interval);
  }, [getRemainingSessionTime, warningMinutes]);
  
  const handleExtend = async () => {
    await extendSession();
    setShowWarning(false);
    onExtend?.();
  };
  
  if (!showWarning) return null;
  
  const minutes = Math.floor(timeLeft / 60000);
  const seconds = Math.floor((timeLeft % 60000) / 1000);
  
  return (
    <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50">
      <div className="bg-white rounded-lg p-6 max-w-md mx-4">
        <h3 className="text-lg font-semibold mb-2">Session Expiring Soon</h3>
        <p className="text-gray-600 mb-4">
          Your session will expire in {minutes}:{seconds.toString().padStart(2, '0')} minutes.
          Would you like to extend it?
        </p>
        <div className="flex gap-3">
          <button
            onClick={handleExtend}
            className="bg-blue-500 text-white px-4 py-2 rounded hover:bg-blue-600"
          >
            Extend Session
          </button>
          <button
            onClick={() => setShowWarning(false)}
            className="bg-gray-300 text-gray-700 px-4 py-2 rounded hover:bg-gray-400"
          >
            Dismiss
          </button>
        </div>
      </div>
    </div>
  );
}