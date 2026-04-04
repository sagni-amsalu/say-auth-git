import { AuthTokens } from "../types";
import { SecureTokenStorage } from "./token-storage";

// src/services/token-manager.ts
export class TokenManager {
  private static instance: TokenManager;
  private refreshPromise: Promise<string> | null = null;

  static getInstance(): TokenManager {
    if (!TokenManager.instance) {
      TokenManager.instance = new TokenManager();
    }
    return TokenManager.instance;
  }

  getAccessToken(): string | null {
    const tokens = SecureTokenStorage.getInstance().getTokens();
    return tokens?.accessToken || null;
  }

  isTokenExpired(): boolean {
    const tokens = SecureTokenStorage.getInstance().getTokens();
    if (!tokens) return true;
    
    try {
      const payload = JSON.parse(atob(tokens.accessToken.split('.')[1]));
      return payload.exp * 1000 < Date.now();
    } catch {
      return true;
    }
  }

  async refreshToken(refreshFn: () => Promise<AuthTokens>): Promise<string> {
    if (this.refreshPromise) {
      return this.refreshPromise;
    }

    this.refreshPromise = this.performRefresh(refreshFn);
    return this.refreshPromise;
  }

  private async performRefresh(refreshFn: () => Promise<AuthTokens>): Promise<string> {
    try {
      const tokens = await refreshFn();
      SecureTokenStorage.getInstance().setTokens(tokens);
      return tokens.accessToken;
    } finally {
      this.refreshPromise = null;
    }
  }
}