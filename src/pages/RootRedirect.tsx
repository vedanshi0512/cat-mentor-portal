import { Navigate } from 'react-router-dom';
import { useAuth } from '@/context/AuthContext';

/**
 * Entry point router: sends the user to wherever they should logically land
 * based on what's already configured in this browser.
 */
export default function RootRedirect() {
  const { credentials, session } = useAuth();

  if (!credentials) return <Navigate to="/setup" replace />;
  if (!session) return <Navigate to="/login" replace />;
  return <Navigate to={session.role === 'mentor' ? '/mentor' : '/student'} replace />;
}
