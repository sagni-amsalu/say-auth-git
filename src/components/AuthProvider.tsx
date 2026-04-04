// src/components/AuthProvider.tsx
'use client';

import React, { createContext, useContext, useEffect, useState } from 'react';
import { AuthService } from '../services/auth-service';
import { AuthState, LoginCredentials, RegisterData, User } from '../types';

interface AuthContextValue extends AuthState {
login: (credentials: LoginCredentials) => Promise<{ requiresMFA: boolean; user?: User }>;
  register: (data: RegisterData) => Promise<User>;
  logout: () => Promise<void>;
  refreshSession: () => Promise<void>;
  hasRole: (role: string | string[]) => boolean;
  getAxiosInstance: () => any;
  getUser: () => User | null;
  verifyMFA: (code: string, trustDevice?: boolean) => Promise<User>;
}

const AuthContext = createContext<AuthContextValue | null>(null);

interface AuthProviderProps {
  children: React.ReactNode;
  apiUrl?: string;
}

export function AuthProvider({ children, apiUrl }: AuthProviderProps) {
  const [state, setState] = useState<AuthState>({
    user: null,
    tokens: null,
    isAuthenticated: false,
    isLoading: true,
    error: null,
  });

  useEffect(() => {
    const authService = AuthService.getInstance(apiUrl);
    const unsubscribe = authService.subscribe(setState);
    return unsubscribe;
  }, [apiUrl]);

  const authService = AuthService.getInstance(apiUrl);

  const value: AuthContextValue = {
    ...state,
    login: (credentials) => authService.login(credentials),
    register: (data) => authService.register(data),
    logout: () => authService.logout(),
    refreshSession: () => authService.refreshSession(),
     verifyMFA: (code, trustDevice) => authService.verifyMFA(code, trustDevice),
    hasRole: (role) => authService.hasRole(role),
    getAxiosInstance: () => authService.getAxiosInstance(),
    getUser: () => authService.getUser(),
  };

  return <AuthContext.Provider value={value}>{children}</AuthContext.Provider>;
}

export const useAuthContext = () => {
  const context = useContext(AuthContext);
  if (!context) {
    throw new Error('useAuthContext must be used within AuthProvider');
  }
  return context;
};