// src/components/ProtectedRoute.tsx
'use client';

import { useProtectedRoute } from "../hooks/useProtectedRoute";

interface ProtectedRouteProps {
  children: React.ReactNode;
  requiredRole?: string | string[];
  fallback?: React.ReactNode;
  redirectTo?: string;
}

export function ProtectedRoute({ 
  children, 
  requiredRole, 
  fallback,
  redirectTo = '/login' 
}: ProtectedRouteProps) {
  const { isAuthenticated, isLoading } = useProtectedRoute(redirectTo, requiredRole);

  if (isLoading) {
    return (
      <div className="flex items-center justify-center min-h-screen">
        <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-blue-600"></div>
      </div>
    );
  }

  if (!isAuthenticated) {
    return fallback || null;
  }

  return <>{children}</>;
}