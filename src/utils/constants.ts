// src/utils/constants.ts

export const STORAGE_KEYS = {
  tokens: 'say_auth_tokens',
  user: 'say_auth_user',
  encryptionKey: 'say_auth_enc_key',
  deviceId: 'say_auth_device_id',
  trustedDevices: 'say_auth_trusted_devices',
  sessionId: 'say_auth_session_id',
} as const;

// ✅ FIX: Remove /api/v1 prefix since baseURL already includes it
export const API_ENDPOINTS = {
  // Auth endpoints - baseURL already has /api/v1
  login: '/auth/login',
  register: '/auth/register',
  refresh: '/auth/refresh',
  logout: '/auth/logout',
  blacklist: '/auth/blacklist',
  changePassword: '/auth/change-password',
  requestPasswordReset: '/auth/request-password-reset',
  resetPassword: '/auth/reset-password',
  verifyEmail: '/auth/verify-email',
  verifyPhone: '/auth/verify-phone',
  sendOtp: '/auth/send-otp',
  mfaSetup: '/auth/mfa/setup',
  mfaVerify: '/auth/mfa/verify',
  mfaDisable: '/auth/mfa/disable',
} as const;

export const AUTH_CONFIG = {
  tokenRefreshThreshold: 5 * 60 * 1000, // 5 minutes before expiry
  sessionTimeout: 7 * 24 * 60 * 60 * 1000, // 7 days
  maxLoginAttempts: 5,
  loginWindowMs: 15 * 60 * 1000, // 15 minutes
  blockDurationMs: 30 * 60 * 1000, // 30 minutes
} as const;