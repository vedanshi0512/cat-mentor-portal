import type { AppCredentials } from '@/types/auth';

/**
 * Resolves a QuestionImage.url into something the browser can actually fetch.
 *
 * - Full URLs (http/https) are returned as-is — mentor pasted an external image link.
 * - Repo-relative paths (e.g. "data/images/q123-fig1.png") are turned into a
 *   raw.githubusercontent.com URL pointing at the configured repo/branch, since
 *   GitHub Pages does NOT serve arbitrary files from the data repo (and may not
 *   even be the same repo as the data lives in).
 *
 * Note: if the data repo is private, raw.githubusercontent.com URLs for it will
 * 404 for anyone without browser-level GitHub auth, since this is an unauthenticated
 * <img> tag fetch. For private data repos, prefer external image hosting (e.g. an
 * image CDN, or a public "assets" repo) for question images.
 */
export function resolveImageUrl(rawUrl: string, creds: AppCredentials): string {
  if (/^https?:\/\//i.test(rawUrl)) return rawUrl;

  const cleanPath = rawUrl.replace(/^\/+/, '');
  return `https://raw.githubusercontent.com/${creds.githubOwner}/${creds.githubRepo}/${creds.githubBranch}/${cleanPath}`;
}
