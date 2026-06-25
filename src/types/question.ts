// ============================================================
// Question Bank Types
// ============================================================

export type Subject = 'VARC' | 'DILR' | 'QA';

export type QuestionType = 'MCQ' | 'TITA';

export type Difficulty = 'Easy' | 'Medium' | 'Hard';

export interface QuestionImage {
  url: string; // path within repo, e.g. data/images/q123-fig1.png, OR external URL
  alt: string;
}

export interface MCQOption {
  id: string; // 'A' | 'B' | 'C' | 'D' typically
  text: string;
}

export interface Question {
  id: string; // uuid
  type: QuestionType;
  subject: Subject;
  topic: string; // free-form but constrained by configured topic list
  difficulty: Difficulty;
  questionText: string; // supports markdown
  images?: QuestionImage[];

  // MCQ-specific
  options?: MCQOption[]; // required if type === 'MCQ'
  correctOptionId?: string; // required if type === 'MCQ'

  // TITA-specific
  correctAnswerText?: string; // required if type === 'TITA'; numeric or short text
  answerTolerance?: number; // optional numeric tolerance for TITA, e.g. 0.01

  explanation: string; // markdown supported
  tags: string[];
  estimatedSolveTimeSeconds: number;

  createdBy: string; // mentor id
  createdAt: string; // ISO date
  updatedAt: string; // ISO date
}

export interface TopicConfig {
  subject: Subject;
  topics: string[];
}

// data/questions.json shape
export interface QuestionsFile {
  version: number;
  questions: Question[];
}

// data/topics.json shape
export interface TopicsFile {
  version: number;
  topicsBySubject: TopicConfig[];
}
