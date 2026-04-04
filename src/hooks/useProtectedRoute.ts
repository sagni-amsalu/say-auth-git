// src/hooks/useProtectedRoute.ts
'use client';

import { useEffect } from 'react';
import { useRouter } from 'next/navigation';
import { useAuth } from './useAuth';

export function useProtectedRoute(redirectTo = '/login', requiredRole?: string | string[]) {
  const { isAuthenticated, isLoading, hasRole } = useAuth();
  const router = useRouter();

  useEffect(() => {
    if (!isLoading && !isAuthenticated) {
      router.push(redirectTo);
    }
    
    if (!isLoading && isAuthenticated && requiredRole && !hasRole(requiredRole)) {
      router.push('/unauthorized');
    }
  }, [isAuthenticated, isLoading, router, redirectTo, requiredRole, hasRole]);

  return { isAuthenticated, isLoading };
}