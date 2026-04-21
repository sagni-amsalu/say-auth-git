'use client';
// src/index.ts

// Types
export * from './types';

// Services
export { AuthService } from './services/auth-service';
export { SecureTokenStorage as TokenStorage } from './services/token-storage';
export { TokenManager } from './services/token-manager';
export { TokenBlacklist } from './services/token-blacklist';
export { MFAService } from './services/mfa-service';
export { RateLimiter } from './services/rate-limiter';
export { AuditLogger, AuditAction } from './services/audit-logger';
export { SessionManager } from './services/session-manager';
export { DeviceFingerprint } from './services/device-fingerprint';

// Hooks
export { useAuth } from './hooks/useAuth';
export { useProtectedRoute } from './hooks/useProtectedRoute';
export { useAuthContext } from './components/AuthProvider';

// Components
export { AuthProvider } from './components/AuthProvider';
export { ProtectedRoute } from './components/ProtectedRoute';
export { LoginForm } from './components/LoginForm';
export { MFASetup } from './components/MFASetup';
export { MFAVerification } from './components/MFAVerification';
export { SessionWarning } from './components/SessionWarning';
export { AuthStatus } from './components/AuthProvider';
export { SessionTimer } from './components/AuthProvider';
export { SessionMonitor } from './components/AuthProvider';        
export { AuthDebug } from './components/AuthProvider';            
export { SessionExpiryWarning } from './components/AuthProvider'; 
export { RoleBased } from './components/AuthProvider';            
export { MFARequired } from './components/AuthProvider';          
export { withAuth } from './components/AuthProvider';             

// Interceptors
export { setupAuthInterceptors } from './interceptors/axios-interceptors';

// ✅ ADD THESE TWO EXPORTS - Critical for direct axios access
import { AuthService } from './services/auth-service';

/**
 * Pre-configured authenticated axios instance
 * Use this for making authenticated API calls directly
 */
export const authAxios = AuthService.getInstance().getAxiosInstance();

/**
 * Function to get a fresh authenticated axios instance
 * Use this if you need to ensure the latest instance
 */
export const getAuthAxios = () => AuthService.getInstance().getAxiosInstance();

// Utils
export { cn, getErrorMessage, isValidEmail, formatDate, generateRandomString } from './utils/helpers';
export { AUTH_CONFIG, STORAGE_KEYS, API_ENDPOINTS } from './utils/constants';
export { validateEnvironment } from './utils/env-validation';
export { errorTracker, initErrorTracker } from './utils/error-tracking';
export { securityHeaders, applySecurityHeaders } from './utils/security-headers';