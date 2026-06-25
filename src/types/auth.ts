export type Role = 'mentor' | 'student';

export interface Session {
  role: Role;
  studentId?: string; // present only if role === 'student'
  studentName?: string;
}

// What's actually persisted in localStorage.
// Token is app-wide and shared by mentor + all students (see README "Security Model").
export interface AppCredentials {
  githubToken: string;
  githubOwner: string; // repo owner, e.g. "rahul"
  githubRepo: string; // repo name, e.g. "cat-mentor-portal-data"
  githubBranch: string; // default "main"
}

export interface GitHubFileRef {
  path: string;
  sha: string; // required for updates/conflict detection
}

export interface GitHubFileResponse<T> {
  data: T;
  sha: string;
  path: string;
}

export class GitConflictError extends Error {
  constructor(public path: string) {
    super(`Conflict: ${path} was modified by someone else since you last loaded it.`);
    this.name = 'GitConflictError';
  }
}

export class GitAuthError extends Error {
  constructor(message = 'GitHub authentication failed. Check your token and repo settings.') {
    super(message);
    this.name = 'GitAuthError';
  }
}
