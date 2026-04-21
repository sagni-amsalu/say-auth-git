// src/utils/constants.ts
export const API_ENDPOINTS = {
  // Auth endpoints
  login: '/auth/login',
  logout: '/auth/logout',
  register: '/auth/register',
  refresh: '/auth/refresh',
  
  // MFA endpoints
  mfaSetup: '/auth/mfa/setup',
  mfaVerify: '/auth/mfa/verify',
  mfaDisable: '/auth/mfa/disable',
  
  // Password management
  changePassword: '/auth/change-password',
  requestPasswordReset: '/auth/request-password-reset',
  resetPassword: '/auth/reset-password',
  
  // Verification endpoints
  verifyEmail: '/auth/verify-email',
  verifyPhone: '/auth/verify-phone',
  sendOtp: '/auth/send-otp',
  
  // Audit
  audit: '/auth/audit',
} as const;

export const STORAGE_KEYS = {
  tokens: 'auth_tokens',
  user: 'auth_user',
  encryptionKey: 'auth_encryption_key',
  deviceId: 'device_id',
  trustedDevices: 'trusted_devices',
} as const;

export const AUTH_CONFIG = {
  tokenRefreshThreshold: 5 * 60 * 1000, // 5 minutes in ms
  sessionTimeout: 7 * 24 * 60 * 60 * 1000, // 7 days in ms
  maxLoginAttempts: 5,
  loginWindowMs: 15 * 60 * 1000, // 15 minutes
  blockDurationMs: 30 * 60 * 1000, // 30 minutes
} as const;