// src/utils/constants.ts
export const AUTH_CONFIG = {
  tokenRefreshThreshold: 5 * 60 * 1000, // 5 minutes
  maxLoginAttempts: 5,
  lockoutDuration: 15 * 60 * 1000, // 15 minutes
  sessionTimeout: 30 * 60 * 1000, // 30 minutes
  mfaCodeLength: 6,
  backupCodesCount: 10,
  trustDeviceDuration: 30 * 24 * 60 * 60 * 1000, // 30 days
};

export const STORAGE_KEYS = {
  tokens: 'auth_tokens_encrypted',
  user: 'auth_user_encrypted',
  encryptionKey: 'encryption_key',
  deviceId: 'device_id',
  trustedDevices: 'trusted_devices',
};

export const API_ENDPOINTS = {
  login: '/auth/login',
  logout: '/auth/logout',
  register: '/auth/register',
  refresh: '/auth/refresh',
  mfaSetup: '/auth/mfa/setup',
  mfaVerify: '/auth/mfa/verify',
  mfaDisable: '/auth/mfa/disable',
  changePassword: '/auth/change-password',
  audit: '/auth/audit',
};