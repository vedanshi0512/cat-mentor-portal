import { createContext, useContext, useState, useCallback, type ReactNode } from 'react';
import type { AppCredentials, Session } from '@/types/auth';
import { readJSON, writeJSON, clearKey, STORAGE_KEYS } from '@/utils/storage';

interface AuthContextValue {
  credentials: AppCredentials | null;
  session: Session | null;
  setCredentials: (creds: AppCredentials) => void;
  clearCredentials: () => void;
  setSession: (session: Session) => void;
  logout: () => void; // clears session only, keeps the shared token configured
}

const AuthContext = createContext<AuthContextValue | undefined>(undefined);

export function AuthProvider({ children }: { children: ReactNode }) {
  const [credentials, setCredentialsState] = useState<AppCredentials | null>(() =>
    readJSON<AppCredentials>(STORAGE_KEYS.credentials)
  );
  const [session, setSessionState] = useState<Session | null>(() =>
    readJSON<Session>(STORAGE_KEYS.session)
  );

  const setCredentials = useCallback((creds: AppCredentials) => {
    writeJSON(STORAGE_KEYS.credentials, creds);
    setCredentialsState(creds);
  }, []);

  const clearCredentials = useCallback(() => {
    clearKey(STORAGE_KEYS.credentials);
    clearKey(STORAGE_KEYS.session);
    setCredentialsState(null);
    setSessionState(null);
  }, []);

  const setSession = useCallback((session: Session) => {
    writeJSON(STORAGE_KEYS.session, session);
    setSessionState(session);
  }, []);

  const logout = useCallback(() => {
    clearKey(STORAGE_KEYS.session);
    setSessionState(null);
  }, []);

  return (
    <AuthContext.Provider
      value={{ credentials, session, setCredentials, clearCredentials, setSession, logout }}
    >
      {children}
    </AuthContext.Provider>
  );
}

export function useAuth(): AuthContextValue {
  const ctx = useContext(AuthContext);
  if (!ctx) throw new Error('useAuth must be used within AuthProvider');
  return ctx;
}
