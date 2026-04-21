// src/utils/constants.ts

export const STORAGE_KEYS = {
  tokens: 'say_auth_tokens',
  user: 'say_auth_user',
  encryptionKey: 'say_auth_enc_key',
  deviceId: 'say_auth_device_id',
  trustedDevices: 'say_auth_trusted_devices',
  sessionId: 'say_auth_session_id',
} as const;

export const API_ENDPOINTS = {
  // Auth endpoints
  login: '/api/v1/auth/login',
  register: '/api/v1/auth/register',
  refresh: '/api/v1/auth/refresh',
  logout: '/api/v1/auth/logout',
  blacklist: '/api/v1/auth/blacklist',
  changePassword: '/api/v1/auth/change-password',
  requestPasswordReset: '/api/v1/auth/request-password-reset',
  resetPassword: '/api/v1/auth/reset-password',
  verifyEmail: '/api/v1/auth/verify-email',
  verifyPhone: '/api/v1/auth/verify-phone',
  sendOtp: '/api/v1/auth/send-otp',
  mfaSetup: '/api/v1/auth/mfa/setup',
  mfaVerify: '/api/v1/auth/mfa/verify',
  mfaDisable: '/api/v1/auth/mfa/disable',
} as const;

export const AUTH_CONFIG = {
  tokenRefreshThreshold: 5 * 60 * 1000, // 5 minutes before expiry
  sessionTimeout: 7 * 24 * 60 * 60 * 1000, // 7 days
  maxLoginAttempts: 5,
  loginWindowMs: 15 * 60 * 1000, // 15 minutes
  blockDurationMs: 30 * 60 * 1000, // 30 minutes
} as const;