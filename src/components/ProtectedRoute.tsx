import React from "react";
import { Navigate } from "react-router-dom";

interface ProtectedRouteProps {
  user: any;
  loading: boolean;
  children: React.ReactNode;
}

export function ProtectedRoute({ user, loading, children }: ProtectedRouteProps) {
  if (loading) {
    return (
      <div className="min-h-screen bg-black flex items-center justify-center">
        <div className="w-8 h-8 border-2 border-emerald-500 border-t-transparent rounded-full animate-spin" />
      </div>
    );
  }

  if (!user) {
    return <Navigate to="/login" replace />;
  }

  return <>{children}</>;
}
