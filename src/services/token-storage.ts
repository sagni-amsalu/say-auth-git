// src/services/token-storage.ts
import CryptoJS from 'crypto-js';
import { STORAGE_KEYS } from '../utils/constants';
import { AuthTokens, User } from '../types';

export class SecureTokenStorage {
  private static instance: SecureTokenStorage;
  private encryptionKey: string;
  private memoryCache: Map<string, any> = new Map();
  private readonly TOKEN_VERSION = '2.0'; // Current version
  private readonly SUPPORTED_VERSIONS = ['1.0', '2.0']; // Backward compatible versions

  private constructor() {
    this.encryptionKey = this.getOrCreateEncryptionKey();
  }

  static getInstance(): SecureTokenStorage {
    if (!SecureTokenStorage.instance) {
      SecureTokenStorage.instance = new SecureTokenStorage();
    }
    return SecureTokenStorage.instance;
  }

  private getOrCreateEncryptionKey(): string {
    if (typeof window === 'undefined') return '';
    
    let key = localStorage.getItem(STORAGE_KEYS.encryptionKey);
    if (!key) {
      key = this.generateEncryptionKey();
      localStorage.setItem(STORAGE_KEYS.encryptionKey, key);
    }
    return key;
  }

  private generateEncryptionKey(): string {
    return CryptoJS.lib.WordArray.random(32).toString();
  }

  private encrypt(data: any): string {
    return CryptoJS.AES.encrypt(JSON.stringify(data), this.encryptionKey).toString();
  }

  private decrypt(encrypted: string): any {
    try {
      const bytes = CryptoJS.AES.decrypt(encrypted, this.encryptionKey);
      return JSON.parse(bytes.toString(CryptoJS.enc.Utf8));
    } catch {
      return null;
    }
  }

  // NEW: Set tokens with versioning
  setTokens(tokens: AuthTokens): void {
    const dataWithVersion = {
      version: this.TOKEN_VERSION,
      data: tokens,
      timestamp: Date.now(),
    };
    const encrypted = this.encrypt(dataWithVersion);
    
    if (typeof window !== 'undefined') {
      localStorage.setItem(STORAGE_KEYS.tokens, encrypted);
    }
    this.memoryCache.set('tokens', tokens);
  }

  // NEW: Get tokens with backward compatibility
  getTokens(): AuthTokens | null {
    // Check memory cache first (fastest)
    if (this.memoryCache.has('tokens')) {
      return this.memoryCache.get('tokens');
    }
    
    if (typeof window !== 'undefined') {
      const encrypted = localStorage.getItem(STORAGE_KEYS.tokens);
      if (encrypted) {
        const decrypted = this.decrypt(encrypted);
        
        if (decrypted) {
          // Check if it's the new versioned format
          if (decrypted.version && this.SUPPORTED_VERSIONS.includes(decrypted.version)) {
            // Versioned format - extract data
            const tokens = decrypted.data;
            this.memoryCache.set('tokens', tokens);
            
            // Optional: Migrate old format to new version if needed
            if (decrypted.version !== this.TOKEN_VERSION) {
              this.migrateTokenFormat(tokens);
            }
            
            return tokens;
          } 
          // Legacy format (no version) - backward compatibility
          else if (decrypted.accessToken) {
            // Legacy format detected, migrate to new version
            const tokens = decrypted as AuthTokens;
            this.migrateTokenFormat(tokens);
            this.memoryCache.set('tokens', tokens);
            return tokens;
          }
        }
      }
    }
    return null;
  }

  // NEW: Migrate legacy tokens to versioned format
  private migrateTokenFormat(tokens: AuthTokens): void {
    try {
      const dataWithVersion = {
        version: this.TOKEN_VERSION,
        data: tokens,
        timestamp: Date.now(),
      };
      const encrypted = this.encrypt(dataWithVersion);
      localStorage.setItem(STORAGE_KEYS.tokens, encrypted);
      console.log('Token format migrated to version', this.TOKEN_VERSION);
    } catch (error) {
      console.error('Token migration failed:', error);
    }
  }

  // NEW: Check if token needs refresh based on timestamp
  shouldRefreshToken(): boolean {
    if (typeof window === 'undefined') return false;
    
    const encrypted = localStorage.getItem(STORAGE_KEYS.tokens);
    if (!encrypted) return false;
    
    const decrypted = this.decrypt(encrypted);
    if (!decrypted) return false;
    
    // Check if versioned format exists
    if (decrypted.timestamp) {
      const tokenAge = Date.now() - decrypted.timestamp;
      const REFRESH_THRESHOLD = 5 * 60 * 1000; // 5 minutes before expiry
      
      // Get token expiry from the actual token
      const tokens = decrypted.data || decrypted;
      if (tokens.accessToken) {
        try {
          const payload = JSON.parse(atob(tokens.accessToken.split('.')[1]));
          const expiresIn = payload.exp * 1000 - Date.now();
          return expiresIn < REFRESH_THRESHOLD;
        } catch {
          return false;
        }
      }
    }
    
    return false;
  }

  // NEW: Get token age (for debugging)
  getTokenAge(): number | null {
    if (typeof window === 'undefined') return null;
    
    const encrypted = localStorage.getItem(STORAGE_KEYS.tokens);
    if (!encrypted) return null;
    
    const decrypted = this.decrypt(encrypted);
    if (decrypted?.timestamp) {
      return Date.now() - decrypted.timestamp;
    }
    
    return null;
  }

  setUser(user: User): void {
    const dataWithVersion = {
      version: this.TOKEN_VERSION,
      data: user,
      timestamp: Date.now(),
    };
    const encrypted = this.encrypt(dataWithVersion);
    
    if (typeof window !== 'undefined') {
      localStorage.setItem(STORAGE_KEYS.user, encrypted);
    }
    this.memoryCache.set('user', user);
  }

  getUser(): User | null {
    if (this.memoryCache.has('user')) {
      return this.memoryCache.get('user');
    }
    
    if (typeof window !== 'undefined') {
      const encrypted = localStorage.getItem(STORAGE_KEYS.user);
      if (encrypted) {
        const decrypted = this.decrypt(encrypted);
        
        if (decrypted) {
          // Check if it's versioned format
          if (decrypted.version && this.SUPPORTED_VERSIONS.includes(decrypted.version)) {
            const user = decrypted.data;
            this.memoryCache.set('user', user);
            return user;
          }
          // Legacy format
          else if (decrypted.id) {
            this.memoryCache.set('user', decrypted);
            return decrypted;
          }
        }
      }
    }
    return null;
  }

  clear(): void {
    this.memoryCache.clear();
    if (typeof window !== 'undefined') {
      localStorage.removeItem(STORAGE_KEYS.tokens);
      localStorage.removeItem(STORAGE_KEYS.user);
      // Note: Don't remove encryption key to preserve it for future sessions
    }
  }

  // NEW: Clear everything including encryption key (use with caution)
  hardClear(): void {
    this.memoryCache.clear();
    if (typeof window !== 'undefined') {
      localStorage.removeItem(STORAGE_KEYS.tokens);
      localStorage.removeItem(STORAGE_KEYS.user);
      localStorage.removeItem(STORAGE_KEYS.encryptionKey);
      localStorage.removeItem(STORAGE_KEYS.deviceId);
      localStorage.removeItem(STORAGE_KEYS.trustedDevices);
    }
  }

  // NEW: Get storage info (for debugging)
  getStorageInfo(): { hasTokens: boolean; hasUser: boolean; tokenVersion: string | null } {
    let tokenVersion = null;
    
    if (typeof window !== 'undefined') {
      const encrypted = localStorage.getItem(STORAGE_KEYS.tokens);
      if (encrypted) {
        const decrypted = this.decrypt(encrypted);
        if (decrypted?.version) {
          tokenVersion = decrypted.version;
        }
      }
    }
    
    return {
      hasTokens: !!this.getTokens(),
      hasUser: !!this.getUser(),
      tokenVersion,
    };
  }
}