import { Navigate } from 'react-router-dom';
import type { ReactNode } from 'react';
import { useAuth } from '@/context/AuthContext';
import type { Role } from '@/types/auth';

export function RequireSetup({ children }: { children: ReactNode }) {
  const { credentials } = useAuth();
  if (!credentials) return <Navigate to="/setup" replace />;
  return <>{children}</>;
}

export function RequireRole({ role, children }: { role: Role; children: ReactNode }) {
  const { credentials, session } = useAuth();
  if (!credentials) return <Navigate to="/setup" replace />;
  if (!session) return <Navigate to="/login" replace />;
  if (session.role !== role) {
    return <Navigate to={session.role === 'mentor' ? '/mentor' : '/student'} replace />;
  }
  return <>{children}</>;
}
