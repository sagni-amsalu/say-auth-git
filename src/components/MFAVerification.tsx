// src/components/MFAVerification.tsx
'use client';

import { useState } from 'react';
import { Shield, AlertCircle } from 'lucide-react';

interface MFAVerificationProps {
  onSubmit: (code: string, trustDevice: boolean) => Promise<void>;
  onBack?: () => void;
}

export function MFAVerification({ onSubmit, onBack }: MFAVerificationProps) {
  const [code, setCode] = useState('');
  const [trustDevice, setTrustDevice] = useState(false);
  const [error, setError] = useState('');
  const [isLoading, setIsLoading] = useState(false);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (code.length !== 6) {
      setError('Please enter a valid 6-digit code');
      return;
    }
    
    setIsLoading(true);
    try {
      await onSubmit(code, trustDevice);
    } catch (err: any) {
      setError(err.message || 'Invalid verification code');
    } finally {
      setIsLoading(false);
    }
  };

  return (
    <div className="max-w-md mx-auto p-6 bg-white dark:bg-gray-900 rounded-lg border shadow-xl">
      <div className="text-center mb-6">
        <div className="inline-flex p-3 rounded-full bg-blue-100 dark:bg-blue-900/30 mb-4">
          <Shield className="h-6 w-6 text-blue-600" />
        </div>
        <h2 className="text-xl font-semibold">Two-Factor Authentication</h2>
        <p className="text-sm text-gray-500 mt-2">Enter the verification code from your authenticator app</p>
      </div>
      
      <form onSubmit={handleSubmit} className="space-y-4">
        <div>
          <label className="block text-sm font-medium mb-2">Verification Code</label>
          <input
            type="text"
            value={code}
            onChange={(e) => setCode(e.target.value.replace(/\D/g, '').slice(0, 6))}
            placeholder="000000"
            className="w-full text-center text-2xl tracking-widest font-mono px-3 py-3 border rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent"
            maxLength={6}
            autoFocus
          />
        </div>
        
        <label className="flex items-center gap-2 cursor-pointer">
          <input
            type="checkbox"
            checked={trustDevice}
            onChange={(e) => setTrustDevice(e.target.checked)}
            className="rounded border-gray-300 text-blue-600 focus:ring-blue-500"
          />
          <span className="text-sm text-gray-600 dark:text-gray-400">Trust this device for 30 days</span>
        </label>
        
        {error && (
          <div className="p-3 bg-red-50 dark:bg-red-950/50 border border-red-200 rounded-lg flex items-start gap-2">
            <AlertCircle className="h-4 w-4 text-red-600 mt-0.5" />
            <p className="text-sm text-red-600">{error}</p>
          </div>
        )}
        
        <button
          type="submit"
          disabled={isLoading}
          className="w-full py-2 bg-blue-600 text-white rounded-lg font-medium hover:bg-blue-700 transition-colors disabled:opacity-50"
        >
          {isLoading ? 'Verifying...' : 'Verify & Continue'}
        </button>
        
        {onBack && (
          <button
            type="button"
            onClick={onBack}
            className="w-full py-2 border rounded-lg hover:bg-gray-50 dark:hover:bg-gray-800 transition-colors"
          >
            Back to Login
          </button>
        )}
      </form>
    </div>
  );
}