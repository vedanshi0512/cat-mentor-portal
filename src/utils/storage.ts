const CREDS_KEY = 'cmp_credentials';
const SESSION_KEY = 'cmp_session';

export function readJSON<T>(key: string): T | null {
  try {
    const raw = localStorage.getItem(key);
    if (!raw) return null;
    return JSON.parse(raw) as T;
  } catch {
    return null;
  }
}

export function writeJSON<T>(key: string, value: T): void {
  localStorage.setItem(key, JSON.stringify(value));
}

export function clearKey(key: string): void {
  localStorage.removeItem(key);
}

export const STORAGE_KEYS = {
  credentials: CREDS_KEY,
  session: SESSION_KEY,
} as const;
