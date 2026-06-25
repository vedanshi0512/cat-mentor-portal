import type { Subject } from './question';

export type TestType = 'Full Mock' | 'Sectional' | 'Topic Test' | 'Daily Practice Set';

export interface TestSection {
  id: string;
  name: string; // e.g. "VARC", "DILR", "QA" or custom for practice sets
  subject: Subject;
  questionIds: string[];
  durationSeconds: number; // 0 = no individual section lock, shares overall timer
  isLocked: boolean; // true = once time's up or moved on, can't return (real CAT behavior)
}

export interface QuestionSelectionFilter {
  subjects?: Subject[];
  topics?: string[];
  difficulty?: ('Easy' | 'Medium' | 'Hard')[];
  tags?: string[];
  count?: number;
}

export interface Test {
  id: string;
  name: string;
  type: TestType;
  instructions: string; // markdown
  sections: TestSection[];
  totalDurationSeconds: number;
  availableFrom: string; // ISO datetime
  availableUntil: string; // ISO datetime
  maxAttempts: number; // 0 = unlimited
  createdBy: string;
  createdAt: string;
  updatedAt: string;
  isPublished: boolean;

  // for "Reattempt wrong questions" / "Revision from bookmarks" generated tests
  generatedFrom?: {
    type: 'wrong-questions' | 'bookmark-folder';
    sourceAttemptId?: string;
    sourceStudentId?: string;
    bookmarkFolderId?: string;
  };
}

// data/tests.json shape
export interface TestsFile {
  version: number;
  tests: Test[];
}
