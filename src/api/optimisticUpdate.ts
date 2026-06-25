import { getJsonFile, putJsonFile } from './githubClient';
import { GitConflictError, type AppCredentials } from '@/types/auth';

/**
 * Optimistic read-modify-write with automatic retry on conflict.
 *
 * Flow:
 *  1. GET current file + sha
 *  2. Apply `updateFn` to produce the new content
 *  3. PUT with the sha we read - if someone else committed in between, GitHub
 *     rejects it and we throw GitConflictError
 *  4. On conflict, re-fetch the now-current file and retry the whole updateFn
 *     against the fresh data, up to `maxRetries` times.
 *
 * This is the strategy used for every mutation in the app (mentor saving a test,
 * student submitting an attempt, adding a bookmark, etc). It correctly handles
 * "two students submit at the same time" and "mentor edits while student submits"
 * as long as updateFn is a pure function of (current data) -> (next data) and
 * doesn't assume anything about prior state outside what it's given.
 */
export async function updateJsonFileWithRetry<T>(
  creds: AppCredentials,
  path: string,
  defaultValue: T,
  updateFn: (current: T) => T,
  commitMessage: string,
  maxRetries = 3
): Promise<T> {
  let attempt = 0;
  let lastError: unknown;

  while (attempt <= maxRetries) {
    try {
      const existing = await getJsonFile<T>(creds, path);
      const current = existing?.data ?? defaultValue;
      const next = updateFn(current);

      await putJsonFile(creds, path, next, existing?.sha, commitMessage);
      return next;
    } catch (err) {
      lastError = err;
      if (err instanceof GitConflictError && attempt < maxRetries) {
        attempt++;
        // brief jittered backoff so simultaneous retries don't collide again immediately
        await sleep(150 + Math.random() * 300);
        continue;
      }
      throw err;
    }
  }

  throw lastError;
}

function sleep(ms: number) {
  return new Promise((resolve) => setTimeout(resolve, ms));
}
