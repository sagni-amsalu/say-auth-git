// src/hooks/useAuth.ts
'use client';

import { useEffect, useState } from 'react';
import { AuthState, LoginCredentials, RegisterData } from '../types';
import { AuthService } from '../services/auth-service';

export function useAuth(apiUrl?: string) {
  const [state, setState] = useState<AuthState>(AuthService.getInstance(apiUrl).getState());

  useEffect(() => {
    const unsubscribe = AuthService.getInstance(apiUrl).subscribe(setState);
    return unsubscribe;
  }, [apiUrl]);

  const login = async (credentials: LoginCredentials) => {
    return AuthService.getInstance(apiUrl).login(credentials);
  };

  const verifyMFA = async (code: string, trustDevice: boolean = false) => {
    return AuthService.getInstance(apiUrl).verifyMFA(code, trustDevice);
  };

  const register = async (data: RegisterData) => {
    return AuthService.getInstance(apiUrl).register(data);
  };

  const logout = async () => {
    return AuthService.getInstance(apiUrl).logout();
  };

  const refreshSession = async () => {
    return AuthService.getInstance(apiUrl).refreshSession();
  };

  const hasRole = (role: string | string[]) => {
    return AuthService.getInstance(apiUrl).hasRole(role);
  };

  return {
    ...state,
    login,
    verifyMFA,
    register,
    logout,
    refreshSession,
    hasRole,
  };
}