// src/components/ProtectedRoute.tsx
'use client';

import { useProtectedRoute } from "../hooks/useProtectedRoute";


interface ProtectedRouteProps {
  children: React.ReactNode;
  requiredRole?: string | string[];
  fallback?: React.ReactNode;
}

export function ProtectedRoute({ children, requiredRole, fallback }: ProtectedRouteProps) {
  const { isAuthenticated, isLoading } = useProtectedRoute('/login', requiredRole);

  if (isLoading) {
    return (
      <div className="flex items-center justify-center min-h-screen">
        <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-blue-600"></div>
      </div>
    );
  }

  if (!isAuthenticated) {
    return null;
  }

  return <>{children}</>;
}