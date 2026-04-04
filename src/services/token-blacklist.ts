// src/services/token-blacklist.ts

import { TokenBlacklistEntry } from "../types";

export class TokenBlacklist {
  private static instance: TokenBlacklist;
  private blacklist: Map<string, TokenBlacklistEntry> = new Map();
  private cleanupInterval: NodeJS.Timeout | null = null;

  private constructor() {
    this.startCleanup();
  }

  static getInstance(): TokenBlacklist {
    if (!TokenBlacklist.instance) {
      TokenBlacklist.instance = new TokenBlacklist();
    }
    return TokenBlacklist.instance;
  }

  async addToBlacklist(token: string, userId: string, reason: TokenBlacklistEntry['reason']): Promise<void> {
    try {
      const payload = JSON.parse(atob(token.split('.')[1]));
      const expiresAt = new Date(payload.exp * 1000);
      
      const entry: TokenBlacklistEntry = {
        token,
        userId,
        expiresAt,
        reason,
      };
      
      this.blacklist.set(this.hashToken(token), entry);
      await this.syncToBackend(entry);
    } catch (error) {
      console.error('Failed to blacklist token:', error);
    }
  }

  async isBlacklisted(token: string): Promise<boolean> {
    const hashedToken = this.hashToken(token);
    const entry = this.blacklist.get(hashedToken);
    
    if (!entry) return false;
    
    if (entry.expiresAt < new Date()) {
      this.blacklist.delete(hashedToken);
      return false;
    }
    
    return true;
  }

  async revokeAllUserTokens(userId: string): Promise<void> {
    for (const [key, entry] of this.blacklist.entries()) {
      if (entry.userId === userId) {
        this.blacklist.delete(key);
      }
    }
    await this.revokeAllOnBackend(userId);
  }

  private hashToken(token: string): string {
    let hash = 0;
    for (let i = 0; i < token.length; i++) {
      const char = token.charCodeAt(i);
      hash = ((hash << 5) - hash) + char;
      hash = hash & hash;
    }
    return hash.toString();
  }

  private async syncToBackend(entry: TokenBlacklistEntry): Promise<void> {
    try {
      await fetch(`${process.env.NEXT_PUBLIC_API_URL}/auth/blacklist`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(entry),
      });
    } catch (error) {
      console.error('Failed to sync blacklist to backend');
    }
  }

  private async revokeAllOnBackend(userId: string): Promise<void> {
    try {
      await fetch(`${process.env.NEXT_PUBLIC_API_URL}/auth/revoke-all/${userId}`, {
        method: 'POST',
      });
    } catch (error) {
      console.error('Failed to revoke tokens on backend');
    }
  }

  private startCleanup(): void {
    this.cleanupInterval = setInterval(() => {
      const now = new Date();
      for (const [key, entry] of this.blacklist.entries()) {
        if (entry.expiresAt < now) {
          this.blacklist.delete(key);
        }
      }
    }, 60 * 60 * 1000);
  }

  stopCleanup(): void {
    if (this.cleanupInterval) {
      clearInterval(this.cleanupInterval);
      this.cleanupInterval = null;
    }
  }
}