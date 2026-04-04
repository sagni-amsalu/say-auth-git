// src/components/SessionWarning.tsx
'use client';

import { useEffect, useState } from 'react';
import { useAuth } from '../hooks/useAuth';

export function SessionWarning({ warningMinutes = 2 }: { warningMinutes?: number }) {
  const { refreshSession } = useAuth();
  const [showWarning, setShowWarning] = useState(false);
  const [timeLeft, setTimeLeft] = useState(0);

  useEffect(() => {
    const checkSession = () => {
      const tokens = localStorage.getItem('auth_tokens_encrypted');
      if (!tokens) return;
      
      try {
        const payload = JSON.parse(atob(tokens.split('.')[1]));
        const expiresIn = payload.exp * 1000 - Date.now();
        const minutesLeft = Math.floor(expiresIn / 1000 / 60);
        
        if (minutesLeft <= warningMinutes && minutesLeft > 0) {
          setShowWarning(true);
          setTimeLeft(minutesLeft);
        } else if (minutesLeft <= 0) {
          setShowWarning(false);
        } else {
          setShowWarning(false);
        }
      } catch {
        // Invalid token
      }
    };

    checkSession();
    const interval = setInterval(checkSession, 60000);
    return () => clearInterval(interval);
  }, [warningMinutes]);

  const handleRefresh = async () => {
    await refreshSession();
    setShowWarning(false);
  };

  if (!showWarning) return null;

  return (
    <div className="fixed bottom-4 right-4 z-50 animate-in slide-in-from-right-5">
      <div className="bg-yellow-50 dark:bg-yellow-950 border border-yellow-200 dark:border-yellow-800 rounded-lg shadow-lg p-4 max-w-sm">
        <div className="flex items-start gap-3">
          <div className="flex-1">
            <h3 className="font-semibold text-yellow-800 dark:text-yellow-200">Session Expiring Soon</h3>
            <p className="text-sm text-yellow-700 dark:text-yellow-300 mt-1">
              Your session will expire in {timeLeft} minute{timeLeft !== 1 ? 's' : ''}.
              Click "Stay Logged In" to extend your session.
            </p>
            <div className="flex gap-2 mt-3">
              <button
                onClick={handleRefresh}
                className="px-3 py-1 text-sm bg-yellow-600 text-white rounded hover:bg-yellow-700 transition-colors"
              >
                Stay Logged In
              </button>
              <button
                onClick={() => setShowWarning(false)}
                className="px-3 py-1 text-sm border border-yellow-300 rounded hover:bg-yellow-100 dark:hover:bg-yellow-900 transition-colors"
              >
                Dismiss
              </button>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}