// src/services/session-manager.ts
import { DeviceFingerprint } from './device-fingerprint';

export class SessionManager {
  private static instance: SessionManager;
  private activeSessions: Map<string, { deviceId: string; lastActive: Date }> = new Map();

  static getInstance(): SessionManager {
    if (!SessionManager.instance) {
      SessionManager.instance = new SessionManager();
    }
    return SessionManager.instance;
  }

  async registerSession(userId: string): Promise<string> {
    const deviceId = await DeviceFingerprint.generate();
    this.activeSessions.set(userId, { deviceId, lastActive: new Date() });
    return deviceId;
  }

  async validateSession(userId: string, deviceId: string): Promise<boolean> {
    const session = this.activeSessions.get(userId);
    if (!session) return false;
    
    session.lastActive = new Date();
    this.activeSessions.set(userId, session);
    
    return session.deviceId === deviceId;
  }

  async terminateSession(userId: string): Promise<void> {
    this.activeSessions.delete(userId);
  }

  async terminateAllOtherSessions(userId: string, currentDeviceId: string): Promise<void> {
    const session = this.activeSessions.get(userId);
    if (session && session.deviceId !== currentDeviceId) {
      this.activeSessions.delete(userId);
    }
  }

  getActiveSessionsCount(userId: string): number {
    let count = 0;
    for (const [key] of this.activeSessions.entries()) {
      if (key === userId) count++;
    }
    return count;
  }
}