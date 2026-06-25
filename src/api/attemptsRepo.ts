import { getJsonFile } from './githubClient';
import { updateJsonFileWithRetry } from './optimisticUpdate';
import type { AppCredentials } from '@/types/auth';
import type { Attempt, AttemptsFile } from '@/types/attempt';

const EMPTY_ATTEMPTS: AttemptsFile = { version: 1, attempts: [] };

function attemptsPath(studentId: string): string {
  return `student-data/${studentId}/attempts.json`;
}

export async function fetchStudentAttempts(creds: AppCredentials, studentId: string): Promise<Attempt[]> {
  const result = await getJsonFile<AttemptsFile>(creds, attemptsPath(studentId));
  return result?.data.attempts ?? [];
}

/**
 * Used by mentor analytics to pull every student's attempts at once.
 * Sequential by design (not Promise.all) to stay well under GitHub's
 * secondary rate limits when run against a small group of students.
 */
export async function fetchAllStudentsAttempts(
  creds: AppCredentials,
  studentIds: string[]
): Promise<Record<string, Attempt[]>> {
  const out: Record<string, Attempt[]> = {};
  for (const id of studentIds) {
    out[id] = await fetchStudentAttempts(creds, id);
  }
  return out;
}

/**
 * Upsert a student's own attempt data (progress, responses, score, etc).
 *
 * IMPORTANT: this intentionally does NOT touch `mentorComment`. The mentor and the
 * student can both be writing to the same attempt record around the same time (e.g.
 * mentor leaving a comment on a previous attempt while the student is mid-test on a
 * new one, or - rarer but possible - both touching the same attempt object). Since
 * `updateJsonFileWithRetry` re-fetches the current file on every conflict retry, we
 * merge against whatever `current` actually is at write time rather than blindly
 * overwriting the whole record with the caller's possibly-stale local copy. This way
 * a concurrent mentor comment survives a student's autosave, and vice versa.
 */
export async function upsertAttempt(
  creds: AppCredentials,
  studentId: string,
  attempt: Attempt
): Promise<Attempt[]> {
  const result = await updateJsonFileWithRetry(
    creds,
    attemptsPath(studentId),
    EMPTY_ATTEMPTS,
    (current) => {
      const next = structuredClone(current);
      const idx = next.attempts.findIndex((a) => a.id === attempt.id);
      if (idx >= 0) {
        // Preserve whatever mentorComment is currently on disk - this call is for
        // student-owned fields only, never for the mentor's side of the record.
        const existingComment = next.attempts[idx].mentorComment;
        next.attempts[idx] = { ...attempt, mentorComment: existingComment };
      } else {
        next.attempts.push(attempt);
      }
      return next;
    },
    `${attempt.status === 'in-progress' ? 'Save progress on' : 'Submit'} attempt ${attempt.id}`
  );
  return result.attempts;
}

export async function setMentorCommentOnAttempt(
  creds: AppCredentials,
  studentId: string,
  attemptId: string,
  comment: string
): Promise<Attempt[]> {
  const result = await updateJsonFileWithRetry(
    creds,
    attemptsPath(studentId),
    EMPTY_ATTEMPTS,
    (current) => {
      const next = structuredClone(current);
      const idx = next.attempts.findIndex((a) => a.id === attemptId);
      if (idx >= 0) next.attempts[idx].mentorComment = comment;
      return next;
    },
    `Mentor comment on attempt ${attemptId}`
  );
  return result.attempts;
}
