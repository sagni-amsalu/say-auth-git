// src/services/rate-limiter.ts
export class RateLimiter {
  private static instance: RateLimiter;
  private attempts: Map<string, { count: number; firstAttempt: number; blockedUntil: number }> = new Map();
  private readonly MAX_ATTEMPTS = 5;
  private readonly WINDOW_MS = 15 * 60 * 1000;
  private readonly BLOCK_DURATION_MS = 30 * 60 * 1000;

  static getInstance(): RateLimiter {
    if (!RateLimiter.instance) {
      RateLimiter.instance = new RateLimiter();
    }
    return RateLimiter.instance;
  }

  checkRateLimit(identifier: string): { allowed: boolean; waitTime?: number } {
    const now = Date.now();
    const record = this.attempts.get(identifier);

    if (record && record.blockedUntil > now) {
      return { 
        allowed: false, 
        waitTime: Math.ceil((record.blockedUntil - now) / 1000) 
      };
    }

    if (record && (now - record.firstAttempt) > this.WINDOW_MS) {
      this.attempts.delete(identifier);
      return { allowed: true };
    }

    if (!record) {
      this.attempts.set(identifier, { count: 1, firstAttempt: now, blockedUntil: 0 });
      return { allowed: true };
    }

    record.count++;
    
    if (record.count >= this.MAX_ATTEMPTS) {
      record.blockedUntil = now + this.BLOCK_DURATION_MS;
      this.attempts.set(identifier, record);
      return { 
        allowed: false, 
        waitTime: Math.ceil(this.BLOCK_DURATION_MS / 1000) 
      };
    }

    this.attempts.set(identifier, record);
    return { allowed: true };
  }

  reset(identifier: string): void {
    this.attempts.delete(identifier);
  }
}