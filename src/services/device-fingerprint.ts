// src/services/device-fingerprint.ts
export class DeviceFingerprint {
  static async generate(): Promise<string> {
    const components = {
      userAgent: navigator.userAgent,
      language: navigator.language,
      platform: navigator.platform,
      screenResolution: `${screen.width}x${screen.height}`,
      timezone: Intl.DateTimeFormat().resolvedOptions().timeZone,
      hardwareConcurrency: navigator.hardwareConcurrency,
      deviceMemory: (navigator as any).deviceMemory,
      colorDepth: screen.colorDepth,
    };
    
    const fingerprint = await this.hashObject(components);
    return fingerprint;
  }

  private static async hashObject(obj: any): Promise<string> {
    const str = JSON.stringify(obj);
    const encoder = new TextEncoder();
    const data = encoder.encode(str);
    const hash = await crypto.subtle.digest('SHA-256', data);
    return Array.from(new Uint8Array(hash))
      .map(b => b.toString(16).padStart(2, '0'))
      .join('');
  }
}