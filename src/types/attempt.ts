export type QuestionState =
  | 'not-visited'
  | 'visited'
  | 'answered'
  | 'marked-for-review'
  | 'answered-marked-for-review';

export type MistakeTag =
  | 'Conceptual Error'
  | 'Silly Mistake'
  | 'Guess'
  | 'Time Pressure'
  | 'Calculation Error';

export interface QuestionResponse {
  questionId: string;
  state: QuestionState;
  selectedOptionId?: string; // MCQ
  enteredAnswer?: string; // TITA
  timeSpentSeconds: number;
  firstVisitedAt?: string;
  lastModifiedAt?: string;
  isCorrect?: boolean; // computed at submit time
  mistakeTag?: MistakeTag; // mentor or student assigned post-attempt
  studentMistakeNote?: string;
}

export interface SectionTiming {
  sectionId: string;
  startedAt?: string;
  endedAt?: string;
  timeRemainingSeconds: number;
}

export type AttemptStatus = 'in-progress' | 'submitted' | 'auto-submitted' | 'abandoned';

export interface Attempt {
  id: string;
  testId: string;
  studentId: string;
  status: AttemptStatus;
  startedAt: string;
  submittedAt?: string;
  responses: QuestionResponse[];
  sectionTimings: SectionTiming[];
  currentSectionId?: string;
  totalTimeSpentSeconds: number;

  // computed at submission
  score?: number;
  maxScore?: number;
  accuracy?: number; // correct / attempted
  attemptRate?: number; // attempted / total
  subjectBreakdown?: Record<string, { score: number; accuracy: number; attempted: number; total: number }>;

  mentorComment?: string;
}

// student-data/<student-id>/attempts.json shape
export interface AttemptsFile {
  version: number;
  attempts: Attempt[];
}
