// src/types/index.ts
export interface User {
  id: string;
  email: string;
  name: string;
  role?: string;
  avatar?: string;
  mfaEnabled: boolean;
  mfaSecret?: string;
  backupCodes?: string[];
  createdAt?: Date;
  updatedAt?: Date;
}

export interface AuthTokens {
  accessToken: string;
  refreshToken: string;
  expiresIn: number;
}

export interface LoginCredentials {
  email: string;
  password: string;
}

export interface RegisterData {
  email: string;
  password: string;
  name: string;
}

export interface AuthState {
  user: User | null;
  tokens: AuthTokens | null;
  isAuthenticated: boolean;
  isLoading: boolean;
  error: string | null;
}

export interface MFASetup {
  secret: string;
  qrCode: string;
  backupCodes: string[];
}

export interface MFAVerify {
  userId: string;
  code: string;
  trustDevice?: boolean;
}

export interface TokenBlacklistEntry {
  token: string;
  userId: string;
  expiresAt: Date;
  reason: 'logout' | 'revoke' | 'security';
}

export interface AuditEntry {
  action: string;
  userId?: string;
  email?: string;
  ipAddress: string;
  userAgent: string;
  timestamp: Date;
  details?: Record<string, any>;
  success: boolean;
  errorMessage?: string;
}