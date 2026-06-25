import type { Question } from '@/types/question';
import type { QuestionResponse } from '@/types/attempt';

export function isResponseCorrect(question: Question, response: QuestionResponse): boolean {
  if (question.type === 'MCQ') {
    return !!response.selectedOptionId && response.selectedOptionId === question.correctOptionId;
  }
  // TITA
  if (!response.enteredAnswer || !question.correctAnswerText) return false;
  const entered = response.enteredAnswer.trim();
  const correct = question.correctAnswerText.trim();

  const enteredNum = Number(entered);
  const correctNum = Number(correct);
  if (!Number.isNaN(enteredNum) && !Number.isNaN(correctNum)) {
    const tolerance = question.answerTolerance ?? 0;
    return Math.abs(enteredNum - correctNum) <= tolerance;
  }
  return entered.toLowerCase() === correct.toLowerCase();
}

export interface ScoreSummary {
  score: number;
  maxScore: number;
  accuracy: number;
  attemptRate: number;
  subjectBreakdown: Record<string, { score: number; accuracy: number; attempted: number; total: number }>;
}

const CORRECT_MARKS = 3;
const NEGATIVE_MARKS_MCQ = -1; // CAT-style negative marking only applies to MCQ, not TITA

export function scoreAttempt(
  questions: Question[],
  responses: QuestionResponse[]
): { responses: QuestionResponse[]; summary: ScoreSummary } {
  const questionById = new Map(questions.map((q) => [q.id, q]));
  const subjectBreakdown: ScoreSummary['subjectBreakdown'] = {};

  let totalScore = 0;
  let totalCorrect = 0;
  let totalAttempted = 0;

  const scoredResponses = responses.map((r) => {
    const q = questionById.get(r.questionId);
    if (!q) return r;

    const wasAttempted = r.state === 'answered' || r.state === 'answered-marked-for-review';
    const isCorrect = wasAttempted ? isResponseCorrect(q, r) : undefined;

    if (!subjectBreakdown[q.subject]) {
      subjectBreakdown[q.subject] = { score: 0, accuracy: 0, attempted: 0, total: 0 };
    }
    const bucket = subjectBreakdown[q.subject];
    bucket.total += 1;

    if (wasAttempted) {
      totalAttempted += 1;
      bucket.attempted += 1;
      if (isCorrect) {
        totalScore += CORRECT_MARKS;
        totalCorrect += 1;
        bucket.score += CORRECT_MARKS;
      } else if (q.type === 'MCQ') {
        totalScore += NEGATIVE_MARKS_MCQ;
        bucket.score += NEGATIVE_MARKS_MCQ;
      }
      // TITA wrong answers: 0, no negative marking
    }

    return { ...r, isCorrect };
  });

  for (const subject of Object.keys(subjectBreakdown)) {
    const b = subjectBreakdown[subject];
    b.accuracy = b.attempted > 0 ? scoredResponses.filter((r) => {
      const q = questionById.get(r.questionId);
      return q?.subject === subject && r.isCorrect;
    }).length / b.attempted : 0;
  }

  const summary: ScoreSummary = {
    score: totalScore,
    maxScore: questions.length * CORRECT_MARKS,
    accuracy: totalAttempted > 0 ? totalCorrect / totalAttempted : 0,
    attemptRate: questions.length > 0 ? totalAttempted / questions.length : 0,
    subjectBreakdown,
  };

  return { responses: scoredResponses, summary };
}
