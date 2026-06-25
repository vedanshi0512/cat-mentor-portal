import { getJsonFile } from './githubClient';
import { updateJsonFileWithRetry } from './optimisticUpdate';
import type { AppCredentials } from '@/types/auth';
import type { Question, QuestionsFile, TopicsFile, Subject } from '@/types/question';

const QUESTIONS_PATH = 'data/questions.json';
const TOPICS_PATH = 'data/topics.json';

const EMPTY_QUESTIONS: QuestionsFile = { version: 1, questions: [] };
const DEFAULT_TOPICS: TopicsFile = {
  version: 1,
  topicsBySubject: [
    { subject: 'VARC', topics: ['Reading Comprehension', 'Para Summary', 'Para Jumbles', 'Odd Sentence Out', 'Critical Reasoning'] },
    { subject: 'DILR', topics: ['Data Interpretation - Tables', 'Data Interpretation - Charts', 'Logical Reasoning - Arrangement', 'Logical Reasoning - Puzzles', 'Games & Tournaments'] },
    { subject: 'QA', topics: ['Arithmetic', 'Algebra', 'Geometry', 'Number System', 'Modern Math', 'Venn Diagrams'] },
  ],
};

export async function fetchAllQuestions(creds: AppCredentials): Promise<Question[]> {
  const result = await getJsonFile<QuestionsFile>(creds, QUESTIONS_PATH);
  return result?.data.questions ?? [];
}

export async function fetchTopics(creds: AppCredentials): Promise<TopicsFile> {
  const result = await getJsonFile<TopicsFile>(creds, TOPICS_PATH);
  return result?.data ?? DEFAULT_TOPICS;
}

export async function saveTopics(creds: AppCredentials, topics: TopicsFile): Promise<void> {
  await updateJsonFileWithRetry(
    creds,
    TOPICS_PATH,
    DEFAULT_TOPICS,
    () => topics,
    'Update topic configuration'
  );
}

export async function addTopic(creds: AppCredentials, subject: Subject, topic: string): Promise<TopicsFile> {
  return updateJsonFileWithRetry(
    creds,
    TOPICS_PATH,
    DEFAULT_TOPICS,
    (current) => {
      const next = structuredClone(current);
      const entry = next.topicsBySubject.find((t) => t.subject === subject);
      if (entry && !entry.topics.includes(topic)) entry.topics.push(topic);
      return next;
    },
    `Add topic "${topic}" to ${subject}`
  );
}

export async function upsertQuestion(creds: AppCredentials, question: Question): Promise<Question[]> {
  const result = await updateJsonFileWithRetry(
    creds,
    QUESTIONS_PATH,
    EMPTY_QUESTIONS,
    (current) => {
      const idx = current.questions.findIndex((q) => q.id === question.id);
      const next = structuredClone(current);
      if (idx >= 0) {
        next.questions[idx] = question;
      } else {
        next.questions.push(question);
      }
      return next;
    },
    `Save question ${question.id}`
  );
  return result.questions;
}

export async function bulkImportQuestions(creds: AppCredentials, questions: Question[]): Promise<Question[]> {
  const result = await updateJsonFileWithRetry(
    creds,
    QUESTIONS_PATH,
    EMPTY_QUESTIONS,
    (current) => {
      const next = structuredClone(current);
      const byId = new Map(next.questions.map((q) => [q.id, q]));
      for (const q of questions) byId.set(q.id, q);
      next.questions = Array.from(byId.values());
      return next;
    },
    `Bulk import ${questions.length} questions`
  );
  return result.questions;
}

export async function deleteQuestion(creds: AppCredentials, questionId: string): Promise<Question[]> {
  const result = await updateJsonFileWithRetry(
    creds,
    QUESTIONS_PATH,
    EMPTY_QUESTIONS,
    (current) => ({
      ...current,
      questions: current.questions.filter((q) => q.id !== questionId),
    }),
    `Delete question ${questionId}`
  );
  return result.questions;
}
