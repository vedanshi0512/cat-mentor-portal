import { GitAuthError, GitConflictError, type AppCredentials } from '@/types/auth';

/**
 * Low-level GitHub REST API client.
 *
 * Every file in the repo (data/questions.json, student-data/<id>/attempts.json, etc.)
 * is read and written through the Contents API:
 *   GET    /repos/{owner}/{repo}/contents/{path}
 *   PUT    /repos/{owner}/{repo}/contents/{path}
 *
 * GitHub requires base64-encoded content and, for updates, the current file's `sha`.
 * Sending a stale sha returns 409/422 - that's our optimistic-concurrency conflict signal.
 */

const API_BASE = 'https://api.github.com';

function authHeaders(token: string): HeadersInit {
  return {
    Authorization: `Bearer ${token}`,
    Accept: 'application/vnd.github+json',
    'X-GitHub-Api-Version': '2022-11-28',
  };
}

// UTF-8 safe base64 encode/decode (atob/btoa alone mangle non-ASCII content)
function encodeBase64(str: string): string {
  const bytes = new TextEncoder().encode(str);
  let binary = '';
  bytes.forEach((b) => (binary += String.fromCharCode(b)));
  return btoa(binary);
}

function decodeBase64(b64: string): string {
  const cleaned = b64.replace(/\n/g, '');
  const binary = atob(cleaned);
  const bytes = new Uint8Array(binary.length);
  for (let i = 0; i < binary.length; i++) bytes[i] = binary.charCodeAt(i);
  return new TextDecoder().decode(bytes);
}

/**
 * Convert raw bytes (e.g. from an uploaded image file) directly to base64,
 * without going through TextEncoder/UTF-8 - that path is for JSON text content
 * only and would corrupt arbitrary binary data.
 */
function bytesToBase64(bytes: Uint8Array): string {
  let binary = '';
  const chunkSize = 0x8000; // avoid call-stack blowups on String.fromCharCode for large files
  for (let i = 0; i < bytes.length; i += chunkSize) {
    binary += String.fromCharCode(...bytes.subarray(i, i + chunkSize));
  }
  return btoa(binary);
}

/**
 * Upload a binary file (e.g. a question image) to the repo. Unlike putJsonFile,
 * this takes raw bytes directly rather than JS data to be JSON-stringified.
 * Returns the final repo-relative path so it can be stored on the Question record.
 */
export async function uploadBinaryFile(
  creds: AppCredentials,
  path: string,
  bytes: Uint8Array,
  commitMessage: string
): Promise<{ sha: string; path: string }> {
  // Images are typically added once and not re-edited in place, so we don't bother
  // fetching an existing sha first - if a file already exists at this exact path,
  // the caller should pick a different (e.g. uuid-based) filename rather than overwrite.
  const url = `${API_BASE}/repos/${creds.githubOwner}/${creds.githubRepo}/contents/${path}`;
  const res = await fetch(url, {
    method: 'PUT',
    headers: { ...authHeaders(creds.githubToken), 'Content-Type': 'application/json' },
    body: JSON.stringify({
      message: commitMessage,
      content: bytesToBase64(bytes),
      branch: creds.githubBranch,
    }),
  });

  if (res.status === 401 || res.status === 403) {
    throw new GitAuthError();
  }
  if (!res.ok) {
    throw new Error(`GitHub API error (${res.status}) uploading ${path}: ${await safeText(res)}`);
  }

  const json = (await res.json()) as { content: { sha: string; path: string } };
  return { sha: json.content.sha, path: json.content.path };
}


interface RawContentResponse {
  content: string;
  sha: string;
  path: string;
  encoding: string;
}

export interface GetFileResult<T> {
  data: T;
  sha: string;
  path: string;
}

/**
 * Fetch and parse a JSON file from the repo. Returns null if the file doesn't exist yet
 * (callers should then fall back to a default/empty shape and create it on first write).
 */
export async function getJsonFile<T>(
  creds: AppCredentials,
  path: string
): Promise<GetFileResult<T> | null> {
  const url = `${API_BASE}/repos/${creds.githubOwner}/${creds.githubRepo}/contents/${path}?ref=${creds.githubBranch}`;
  const res = await fetch(url, { headers: authHeaders(creds.githubToken) });

  if (res.status === 404) return null;
  if (res.status === 401 || res.status === 403) {
    throw new GitAuthError(
      res.status === 403
        ? 'GitHub token lacks permission for this repo (need "repo" scope and write access).'
        : undefined
    );
  }
  if (!res.ok) {
    throw new Error(`GitHub API error (${res.status}) fetching ${path}: ${await safeText(res)}`);
  }

  const json = (await res.json()) as RawContentResponse;
  const text = decodeBase64(json.content);
  const data = JSON.parse(text) as T;
  return { data, sha: json.sha, path: json.path };
}

/**
 * Write (create or update) a JSON file.
 *
 * - If `expectedSha` is provided, GitHub will reject the write if the file has since
 *   changed (someone else committed in between) - this is what `GitConflictError` signals.
 * - If `expectedSha` is undefined, this creates a new file (will fail with 422 if it
 *   already exists - call getJsonFile first to check).
 */
export async function putJsonFile<T>(
  creds: AppCredentials,
  path: string,
  data: T,
  expectedSha: string | undefined,
  commitMessage: string
): Promise<{ sha: string }> {
  const url = `${API_BASE}/repos/${creds.githubOwner}/${creds.githubRepo}/contents/${path}`;
  const body: Record<string, unknown> = {
    message: commitMessage,
    content: encodeBase64(JSON.stringify(data, null, 2)),
    branch: creds.githubBranch,
  };
  if (expectedSha) body.sha = expectedSha;

  const res = await fetch(url, {
    method: 'PUT',
    headers: { ...authHeaders(creds.githubToken), 'Content-Type': 'application/json' },
    body: JSON.stringify(body),
  });

  if (res.status === 401 || res.status === 403) {
    throw new GitAuthError();
  }
  if (res.status === 409 || res.status === 422) {
    // 409: direct sha conflict. 422 can also mean "sha required/didn't match" on some repos.
    throw new GitConflictError(path);
  }
  if (!res.ok) {
    throw new Error(`GitHub API error (${res.status}) writing ${path}: ${await safeText(res)}`);
  }

  const json = (await res.json()) as { content: { sha: string } };
  return { sha: json.content.sha };
}

/** Verify token + repo access work at all. Used by the setup screen. */
export async function verifyAccess(creds: AppCredentials): Promise<{ ok: true } | { ok: false; reason: string }> {
  try {
    const url = `${API_BASE}/repos/${creds.githubOwner}/${creds.githubRepo}`;
    const res = await fetch(url, { headers: authHeaders(creds.githubToken) });
    if (res.status === 404) return { ok: false, reason: 'Repository not found. Check owner/repo name.' };
    if (res.status === 401) return { ok: false, reason: 'Invalid token.' };
    if (res.status === 403) return { ok: false, reason: 'Token lacks access to this repository.' };
    if (!res.ok) return { ok: false, reason: `Unexpected error (${res.status}).` };

    const repo = await res.json();
    if (!repo.permissions?.push) {
      return { ok: false, reason: 'Token does not have write access to this repository.' };
    }
    return { ok: true };
  } catch (e) {
    return { ok: false, reason: e instanceof Error ? e.message : 'Network error reaching GitHub.' };
  }
}

async function safeText(res: Response): Promise<string> {
  try {
    return await res.text();
  } catch {
    return '<no body>';
  }
}
