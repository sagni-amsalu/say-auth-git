// src/index.ts
// Types
export * from './types';

// Services
export { AuthService } from './services/auth-service';
export { SecureTokenStorage as TokenStorage } from './services/token-storage'; // Alias export
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

// Components
export { AuthProvider } from './components/AuthProvider';
export { ProtectedRoute } from './components/ProtectedRoute';
export { MFASetup } from './components/MFASetup';
export { MFAVerification } from './components/MFAVerification';
export { SessionWarning } from './components/SessionWarning';

// Interceptors
export { setupAuthInterceptors } from './interceptors/axios-interceptors';

// Utils
export { cn, getErrorMessage, isValidEmail } from './utils/helpers';
export { AUTH_CONFIG, STORAGE_KEYS, API_ENDPOINTS } from './utils/constants';