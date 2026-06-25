import { useEffect, useMemo, useState } from 'react';
import { useParams } from 'react-router-dom';
import { useAuth } from '@/context/AuthContext';
import { fetchAllQuestions } from '@/api/questionsRepo';
import { fetchStudentAttempts, upsertAttempt } from '@/api/attemptsRepo';
import { fetchAllTests } from '@/api/testsRepo';
import { addBookmark, fetchNotes, upsertNote } from '@/api/studentDataRepo';
import type { Question } from '@/types/question';
import type { Attempt, MistakeTag, QuestionResponse } from '@/types/attempt';
import type { Test } from '@/types/test';
import type { Note } from '@/types/student';
import { Card, Badge, LoadingState, ErrorState, Button } from '@/components/common/UI';
import { v4 as uuidv4 } from 'uuid';
import { Bookmark } from 'lucide-react';

const MISTAKE_TAGS: MistakeTag[] = ['Conceptual Error', 'Silly Mistake', 'Guess', 'Time Pressure', 'Calculation Error'];

export default function PostTestAnalysisPage() {
  const { credentials, session } = useAuth();
  const { attemptId } = useParams();
  const studentId = session?.role === 'student' ? session.studentId! : '';

  const [attempt, setAttempt] = useState<Attempt | null>(null);
  const [test, setTest] = useState<Test | null>(null);
  const [questions, setQuestions] = useState<Question[]>([]);
  const [notes, setNotes] = useState<Note[]>([]);
  const [noteDrafts, setNoteDrafts] = useState<Record<string, string>>({});
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [expandedQuestionId, setExpandedQuestionId] = useState<string | null>(null);

  useEffect(() => {
    if (!credentials || !attemptId || !studentId) return;
    Promise.all([
      fetchStudentAttempts(credentials, studentId),
      fetchAllTests(credentials),
      fetchAllQuestions(credentials),
      fetchNotes(credentials, studentId),
    ])
      .then(([attempts, tests, qs, existingNotes]) => {
        const a = attempts.find((x) => x.id === attemptId);
        if (!a) { setError('Attempt not found.'); return; }
        setAttempt(a);
        setTest(tests.find((t) => t.id === a.testId) ?? null);
        setQuestions(qs);
        setNotes(existingNotes);
      })
      .catch((e) => setError(e instanceof Error ? e.message : 'Failed to load analysis.'))
      .finally(() => setLoading(false));
  }, [credentials, attemptId, studentId]);

  const questionById = useMemo(() => new Map(questions.map((q) => [q.id, q])), [questions]);

  async function setMistakeTag(response: QuestionResponse, tag: MistakeTag | undefined) {
    if (!credentials || !attempt) return;
    const updatedResponses = attempt.responses.map((r) => (r.questionId === response.questionId ? { ...r, mistakeTag: tag } : r));
    const updated = { ...attempt, responses: updatedResponses };
    setAttempt(updated);
    await upsertAttempt(credentials, studentId, updated);
  }

  async function bookmarkQuestion(questionId: string) {
    if (!credentials) return;
    await addBookmark(credentials, studentId, {
      id: uuidv4(),
      questionId,
      folderId: 'mistakes',
      createdAt: new Date().toISOString(),
    });
    alert('Bookmarked to "Mistakes" folder.');
  }

  async function saveNote(questionId: string) {
    if (!credentials) return;
    const content = noteDrafts[questionId];
    if (content === undefined) return;
    const existing = notes.find((n) => n.questionId === questionId);
    const now = new Date().toISOString();
    const note: Note = existing
      ? { ...existing, content, updatedAt: now }
      : { id: uuidv4(), questionId, content, createdAt: now, updatedAt: now };
    const updated = await upsertNote(credentials, studentId, note);
    setNotes(updated);
  }

  if (loading) return <LoadingState label="Loading analysis…" />;
  if (error) return <ErrorState message={error} />;
  if (!attempt || !test) return null;

  const timePerQuestion = attempt.responses.map((r) => ({ id: r.questionId, time: r.timeSpentSeconds }));
  const avgTime = timePerQuestion.length ? Math.round(timePerQuestion.reduce((s, t) => s + t.time, 0) / timePerQuestion.length) : 0;

  return (
    <div className="p-8 max-w-5xl mx-auto">
      <h1 className="text-2xl font-bold text-ink-700 mb-1">{test.name} — Analysis</h1>
      <p className="text-ink-400 text-sm mb-6">Submitted {attempt.submittedAt ? new Date(attempt.submittedAt).toLocaleString() : '—'}</p>

      {/* Overall */}
      <div className="grid grid-cols-4 gap-4 mb-6">
        <StatCard label="Score" value={`${attempt.score ?? 0} / ${attempt.maxScore ?? 0}`} />
        <StatCard label="Accuracy" value={`${Math.round((attempt.accuracy ?? 0) * 100)}%`} />
        <StatCard label="Attempt rate" value={`${Math.round((attempt.attemptRate ?? 0) * 100)}%`} />
        <StatCard label="Avg time / question" value={`${avgTime}s`} />
      </div>

      {/* Subject-wise */}
      <h2 className="text-ink-700 font-semibold mb-3">Subject-wise breakdown</h2>
      <div className="grid grid-cols-3 gap-4 mb-6">
        {Object.entries(attempt.subjectBreakdown ?? {}).map(([subject, b]) => (
          <Card key={subject}>
            <div className="text-amber-400 font-semibold mb-2">{subject}</div>
            <div className="text-ink-700 text-2xl font-bold">{b.score}</div>
            <div className="text-ink-400 text-xs mt-1">
              {b.attempted}/{b.total} attempted · {Math.round(b.accuracy * 100)}% accuracy
            </div>
          </Card>
        ))}
      </div>

      {/* Question-wise review */}
      <h2 className="text-ink-700 font-semibold mb-3">Question-wise review</h2>
      <div className="space-y-2">
        {attempt.responses.map((r, idx) => {
          const q = questionById.get(r.questionId);
          const wasAttempted = r.state === 'answered' || r.state === 'answered-marked-for-review';
          const isExpanded = expandedQuestionId === r.questionId;

          if (!q) {
            return (
              <Card key={r.questionId} className="border-amber-200">
                <div className="flex items-center gap-2">
                  <span className="text-ink-500 text-sm">Q{idx + 1}</span>
                  <Badge color="amber">Question unavailable</Badge>
                </div>
                <p className="text-ink-400 text-xs mt-2">
                  This question can no longer be found in the question bank (it may have been edited or
                  removed since this attempt). Your response was: {wasAttempted ? 'answered' : 'not answered'}.
                </p>
              </Card>
            );
          }

          return (
            <Card key={r.questionId}>
              <div className="flex items-start justify-between gap-4 cursor-pointer" onClick={() => setExpandedQuestionId(isExpanded ? null : r.questionId)}>
                <div className="flex-1">
                  <div className="flex items-center gap-2 mb-1.5">
                    <span className="text-ink-500 text-sm">Q{idx + 1}</span>
                    <Badge color="amber">{q.subject}</Badge>
                    <Badge>{q.topic}</Badge>
                    {!wasAttempted ? (
                      <Badge>Not attempted</Badge>
                    ) : r.isCorrect ? (
                      <Badge color="green">Correct</Badge>
                    ) : (
                      <Badge color="red">Incorrect</Badge>
                    )}
                    <span className="text-ink-500 text-xs">{r.timeSpentSeconds}s</span>
                  </div>
                  <p className="text-ink-700 text-sm line-clamp-2">{q.questionText}</p>
                </div>
                <button onClick={(e) => { e.stopPropagation(); bookmarkQuestion(q.id); }} className="p-2 text-ink-400 hover:text-amber-400">
                  <Bookmark size={15} />
                </button>
              </div>

              {isExpanded && (
                <div className="mt-4 pt-4 border-t border-ink-200 space-y-3">
                  <div>
                    <span className="text-ink-400 text-xs">Correct answer: </span>
                    <span className="text-green-400 text-sm font-medium">
                      {q.type === 'MCQ' ? q.options?.find((o) => o.id === q.correctOptionId)?.text : q.correctAnswerText}
                    </span>
                  </div>
                  {wasAttempted && !r.isCorrect && (
                    <div>
                      <span className="text-ink-400 text-xs">Your answer: </span>
                      <span className="text-red-600 text-sm">
                        {q.type === 'MCQ' ? q.options?.find((o) => o.id === r.selectedOptionId)?.text : r.enteredAnswer}
                      </span>
                    </div>
                  )}
                  <div>
                    <span className="text-ink-400 text-xs block mb-1">Explanation</span>
                    <p className="text-ink-500 text-sm whitespace-pre-wrap">{q.explanation}</p>
                  </div>

                  {wasAttempted && !r.isCorrect && (
                    <div>
                      <span className="text-ink-400 text-xs block mb-1.5">Mistake type</span>
                      <div className="flex gap-1.5 flex-wrap">
                        {MISTAKE_TAGS.map((tag) => (
                          <button
                            key={tag}
                            onClick={() => setMistakeTag(r, r.mistakeTag === tag ? undefined : tag)}
                            className={`text-xs px-2.5 py-1 rounded-full border ${
                              r.mistakeTag === tag
                                ? 'bg-catblue-500 text-white border-catblue-500'
                                : 'border-ink-600 text-ink-500 hover:border-ink-400'
                            }`}
                          >
                            {tag}
                          </button>
                        ))}
                      </div>
                    </div>
                  )}

                  <div>
                    <span className="text-ink-400 text-xs block mb-1">Your notes</span>
                    <textarea
                      value={noteDrafts[q.id] ?? notes.find((n) => n.questionId === q.id)?.content ?? ''}
                      onChange={(e) => setNoteDrafts((prev) => ({ ...prev, [q.id]: e.target.value }))}
                      onBlur={() => saveNote(q.id)}
                      placeholder="Write a personal note on this question…"
                      rows={2}
                      className="w-full bg-white border border-ink-600 rounded-md px-3 py-2 text-ink-700 text-sm"
                    />
                  </div>
                </div>
              )}
            </Card>
          );
        })}
      </div>
    </div>
  );
}

function StatCard({ label, value }: { label: string; value: string }) {
  return (
    <Card>
      <div className="text-ink-400 text-xs mb-1">{label}</div>
      <div className="text-ink-700 text-2xl font-bold">{value}</div>
    </Card>
  );
}
