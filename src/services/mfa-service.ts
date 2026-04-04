// src/services/mfa-service.ts
import * as OTPAuth from 'otpauth';
import QRCode from 'qrcode';
import { base32 } from 'rfc4648';

export class MFAService {
  private static instance: MFAService;

  static getInstance(): MFAService {
    if (!MFAService.instance) {
      MFAService.instance = new MFAService();
    }
    return MFAService.instance;
  }

  async setupMFA(userId: string, email: string): Promise<{ secret: string; qrCode: string; backupCodes: string[] }> {
    const secret = new OTPAuth.Secret({ size: 20 });
    const secretBase32 = secret.base32;
    
    const totp = new OTPAuth.TOTP({
      issuer: 'YourApp',
      label: email,
      algorithm: 'SHA1',
      digits: 6,
      period: 30,
      secret: secret,
    });
    
    const otpUri = totp.toString();
    const qrCode = await QRCode.toDataURL(otpUri);
    const backupCodes = this.generateBackupCodes();
    
    sessionStorage.setItem(`mfa_setup_${userId}`, secretBase32);
    sessionStorage.setItem(`mfa_backup_${userId}`, JSON.stringify(backupCodes));
    
    return { secret: secretBase32, qrCode, backupCodes };
  }

  async verifyAndEnableMFA(userId: string, code: string): Promise<boolean> {
    const storedSecret = sessionStorage.getItem(`mfa_setup_${userId}`);
    if (!storedSecret) return false;
    
    try {
      // rfc4648 uses 'parse' not 'decode'
      const secretBuffer = base32.parse(storedSecret);
      const secret = new OTPAuth.Secret({ buffer: secretBuffer.buffer });
      
      const totp = new OTPAuth.TOTP({
        issuer: 'YourApp',
        label: userId,
        algorithm: 'SHA1',
        digits: 6,
        period: 30,
        secret: secret,
      });
      
      const isValid = totp.validate({ token: code, window: 1 }) !== null;
      
      if (isValid) {
        const backupCodes = JSON.parse(sessionStorage.getItem(`mfa_backup_${userId}`) || '[]');
        await this.saveMFAConfig(userId, storedSecret, backupCodes);
        sessionStorage.removeItem(`mfa_setup_${userId}`);
        sessionStorage.removeItem(`mfa_backup_${userId}`);
      }
      
      return isValid;
    } catch (error) {
      console.error('MFA verification failed:', error);
      return false;
    }
  }

  async verifyMFA(userId: string, code: string): Promise<boolean> {
    const mfaSecret = await this.getUserMFASecret(userId);
    if (!mfaSecret) return false;
    
    try {
      // rfc4648 uses 'parse' not 'decode'
      const secretBuffer = base32.parse(mfaSecret);
      const secret = new OTPAuth.Secret({ buffer: secretBuffer.buffer });
      
      const totp = new OTPAuth.TOTP({
        issuer: 'YourApp',
        label: userId,
        algorithm: 'SHA1',
        digits: 6,
        period: 30,
        secret: secret,
      });
      
      return totp.validate({ token: code, window: 1 }) !== null;
    } catch (error) {
      console.error('MFA verification failed:', error);
      return false;
    }
  }

  private generateBackupCodes(): string[] {
    const codes: string[] = [];
    for (let i = 0; i < 10; i++) {
      const code = Math.random().toString(36).substring(2, 10).toUpperCase();
      codes.push(code);
    }
    return codes;
  }

  private async saveMFAConfig(userId: string, secret: string, backupCodes: string[]): Promise<void> {
    try {
      await fetch(`${process.env.NEXT_PUBLIC_API_URL}/auth/mfa/enable`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ userId, secret, backupCodes }),
      });
    } catch (error) {
      console.error('Failed to save MFA config:', error);
      throw error;
    }
  }

  private async getUserMFASecret(userId: string): Promise<string | null> {
    try {
      const response = await fetch(`${process.env.NEXT_PUBLIC_API_URL}/auth/mfa/secret/${userId}`);
      if (!response.ok) return null;
      const data = await response.json();
      return data.secret || null;
    } catch (error) {
      console.error('Failed to get user MFA secret:', error);
      return null;
    }
  }
}