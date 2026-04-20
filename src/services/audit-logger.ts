// src/services/audit-logger.ts
export enum AuditAction {
  LOGIN_SUCCESS = 'LOGIN_SUCCESS',
  LOGIN_FAILURE = 'LOGIN_FAILURE',
  LOGOUT = 'LOGOUT',
  REGISTER_SUCCESS = 'REGISTER_SUCCESS',
  PASSWORD_CHANGE = 'PASSWORD_CHANGE',
  TOKEN_REFRESH = 'TOKEN_REFRESH',
  SESSION_TERMINATED = 'SESSION_TERMINATED',
  MFA_ENABLED = 'MFA_ENABLED',
  MFA_DISABLED = 'MFA_DISABLED',
  MFA_VERIFIED = 'MFA_VERIFIED',
}

export interface AuditEntry {
  action: AuditAction;
  userId?: string;
  email?: string;
  ipAddress: string;
  userAgent: string;
  timestamp: Date;
  details?: Record<string, any>;
  success: boolean;
  errorMessage?: string;
}

export class AuditLogger {
  private static instance: AuditLogger;
  private logQueue: AuditEntry[] = [];
  private isFlushing = false;
    private enabled: boolean = true;  // ✅ Enable/disable flag

  static getInstance(): AuditLogger {
    if (!AuditLogger.instance) {
      AuditLogger.instance = new AuditLogger();
    }
    return AuditLogger.instance;
  }

    // ✅ Set enabled state
  setEnabled(enabled: boolean): void {
    this.enabled = enabled;
  }

  // ✅ Check if enabled
  isEnabled(): boolean {
    return this.enabled;
  }

  async log(entry: Omit<AuditEntry, 'timestamp' | 'ipAddress' | 'userAgent'>): Promise<void> {

      // ✅ Skip if disabled
    if (!this.enabled) {
      return;
    }

    const fullEntry: AuditEntry = {
      ...entry,
      timestamp: new Date(),
      ipAddress: await this.getClientIP(),
      userAgent: navigator.userAgent,
    };
    
    this.logQueue.push(fullEntry);
    this.scheduleFlush();
  }

  private scheduleFlush(): void {
    if (this.isFlushing) return;
    setTimeout(() => this.flush(), 5000);
  }

  private async flush(): Promise<void> {
    // if (this.logQueue.length === 0) return;
      if (this.logQueue.length === 0 || !this.enabled) return;  // ✅ Skip if disabled
    
    this.isFlushing = true;
    const entries = [...this.logQueue];
    this.logQueue = [];
    
    try {
      await fetch(`${process.env.NEXT_PUBLIC_API_URL}/auth/audit`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ entries }),
        keepalive: true,
      });
    } catch (error) {
      // this.logQueue.unshift(...entries);
       // Silently fail - don't re-queue to avoid infinite loops
      console.debug('Audit log failed:', error);
    } finally {
       this.isFlushing = false;
      if (this.logQueue.length > 0 && this.enabled) {
        this.scheduleFlush();
      }
    }
  }

  private async getClientIP(): Promise<string> {
    try {
      const response = await fetch('https://api.ipify.org?format=json');
      const data = await response.json();
      return data.ip;
    } catch {
      return 'unknown';
    }
  }
}