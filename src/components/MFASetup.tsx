// src/components/MFASetup.tsx
'use client';

import { useState } from 'react';
import { MFAService } from '../services/mfa-service';
import { Shield, Copy, Check, Download } from 'lucide-react';

interface MFASetupProps {
  userId: string;
  email: string;
  onComplete: () => void;
  onCancel: () => void;
}

export function MFASetup({ userId, email, onComplete, onCancel }: MFASetupProps) {
  const [step, setStep] = useState<'setup' | 'verify'>('setup');
  const [qrCode, setQrCode] = useState('');
  const [backupCodes, setBackupCodes] = useState<string[]>([]);
  const [verificationCode, setVerificationCode] = useState('');
  const [error, setError] = useState('');
  const [copied, setCopied] = useState(false);
  const [isLoading, setIsLoading] = useState(false);

  const handleSetup = async () => {
    setIsLoading(true);
    try {
      const result = await MFAService.getInstance().setupMFA(userId, email);
      setQrCode(result.qrCode);
      setBackupCodes(result.backupCodes);
      setStep('verify');
    } catch (err) {
      setError('Failed to setup MFA');
    } finally {
      setIsLoading(false);
    }
  };

  const handleVerify = async () => {
    if (!verificationCode) {
      setError('Please enter verification code');
      return;
    }
    
    setIsLoading(true);
    try {
      const isValid = await MFAService.getInstance().verifyAndEnableMFA(userId, verificationCode);
      if (isValid) {
        onComplete();
      } else {
        setError('Invalid verification code');
      }
    } catch (err) {
      setError('Verification failed');
    } finally {
      setIsLoading(false);
    }
  };

  const copyBackupCodes = () => {
    navigator.clipboard.writeText(backupCodes.join('\n'));
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
  };

  if (step === 'setup') {
    return (
      <div className="max-w-md mx-auto p-6 bg-white dark:bg-gray-900 rounded-lg border shadow-xl">
        <div className="text-center mb-6">
          <div className="inline-flex p-3 rounded-full bg-blue-100 dark:bg-blue-900/30 mb-4">
            <Shield className="h-6 w-6 text-blue-600" />
          </div>
          <h2 className="text-xl font-semibold">Set Up Two-Factor Authentication</h2>
          <p className="text-sm text-gray-500 mt-2">Enhance your account security with 2FA</p>
        </div>
        
        <div className="space-y-4">
          <div className="p-4 bg-blue-50 dark:bg-blue-950 rounded-lg">
            <p className="text-sm text-blue-700 dark:text-blue-300">
              Two-factor authentication adds an extra layer of security to your account.
              You'll need to enter a verification code from your authenticator app when signing in.
            </p>
          </div>
          
          <button
            onClick={handleSetup}
            disabled={isLoading}
            className="w-full py-2 bg-blue-600 text-white rounded-lg font-medium hover:bg-blue-700 transition-colors disabled:opacity-50"
          >
            {isLoading ? 'Setting up...' : 'Get Started'}
          </button>
          
          <button
            onClick={onCancel}
            className="w-full py-2 border rounded-lg hover:bg-gray-50 dark:hover:bg-gray-800 transition-colors"
          >
            Cancel
          </button>
        </div>
      </div>
    );
  }

  return (
    <div className="max-w-md mx-auto p-6 bg-white dark:bg-gray-900 rounded-lg border shadow-xl">
      <div className="text-center mb-6">
        <h2 className="text-xl font-semibold">Scan QR Code</h2>
        <p className="text-sm text-gray-500 mt-2">Scan this QR code with your authenticator app</p>
      </div>
      
      {qrCode && (
        <div className="flex justify-center mb-6">
          <img src={qrCode} alt="QR Code" className="w-48 h-48" />
        </div>
      )}
      
      <div className="space-y-4">
        <div>
          <label className="block text-sm font-medium mb-2">Backup Codes</label>
          <div className="bg-gray-50 dark:bg-gray-800 rounded-lg p-3">
            <div className="grid grid-cols-2 gap-1 font-mono text-xs">
              {backupCodes.map((code, idx) => (
                <div key={idx}>{code}</div>
              ))}
            </div>
            <div className="flex gap-2 mt-3">
              <button
                onClick={copyBackupCodes}
                className="flex-1 py-1.5 text-sm border rounded hover:bg-gray-100 dark:hover:bg-gray-700 transition-colors flex items-center justify-center gap-1"
              >
                {copied ? <Check className="h-3 w-3" /> : <Copy className="h-3 w-3" />}
                {copied ? 'Copied!' : 'Copy Codes'}
              </button>
              <button
                onClick={() => {
                  const blob = new Blob([backupCodes.join('\n')], { type: 'text/plain' });
                  const url = URL.createObjectURL(blob);
                  const a = document.createElement('a');
                  a.href = url;
                  a.download = 'backup-codes.txt';
                  a.click();
                  URL.revokeObjectURL(url);
                }}
                className="flex-1 py-1.5 text-sm border rounded hover:bg-gray-100 dark:hover:bg-gray-700 transition-colors flex items-center justify-center gap-1"
              >
                <Download className="h-3 w-3" />
                Download
              </button>
            </div>
          </div>
          <p className="text-xs text-gray-500 mt-2">
            Save these backup codes in a secure place. You can use them to access your account if you lose your device.
          </p>
        </div>
        
        <div>
          <label className="block text-sm font-medium mb-2">Verification Code</label>
          <input
            type="text"
            value={verificationCode}
            onChange={(e) => setVerificationCode(e.target.value)}
            placeholder="Enter 6-digit code"
            className="w-full px-3 py-2 border rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent"
            maxLength={6}
          />
        </div>
        
        {error && (
          <div className="p-3 bg-red-50 dark:bg-red-950/50 border border-red-200 rounded-lg text-sm text-red-600">
            {error}
          </div>
        )}
        
        <button
          onClick={handleVerify}
          disabled={isLoading}
          className="w-full py-2 bg-blue-600 text-white rounded-lg font-medium hover:bg-blue-700 transition-colors disabled:opacity-50"
        >
          {isLoading ? 'Verifying...' : 'Verify and Enable'}
        </button>
      </div>
    </div>
  );
}