import { useEffect, useState, useCallback } from 'react';
import { useNavigate, useParams } from 'react-router-dom';
import { useAuth } from '@/context/AuthContext';
import { fetchAllTests } from '@/api/testsRepo';
import { fetchAllQuestions } from '@/api/questionsRepo';
import { fetchStudentAttempts, upsertAttempt } from '@/api/attemptsRepo';
import { scoreAttempt } from '@/utils/scoring';
import { useTestAttempt } from '@/hooks/useTestAttempt';
import type { Test } from '@/types/test';
import type { Question } from '@/types/question';
import type { Attempt } from '@/types/attempt';
import type { AppCredentials } from '@/types/auth';
import QuestionPalette, { PaletteLegend } from '@/components/test/QuestionPalette';
import QuestionArea from '@/components/test/QuestionArea';
import TimerDisplay from '@/components/test/TimerDisplay';
import { Button, LoadingState, ErrorState } from '@/components/common/UI';

export default function TestAttemptPage() {
  const { credentials, session } = useAuth();
  const navigate = useNavigate();
  const { testId } = useParams();

  const [test, setTest] = useState<Test | null>(null);
  const [questions, setQuestions] = useState<Question[]>([]);
  const [existingAttempt, setExistingAttempt] = useState<Attempt | undefined>(undefined);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [saveError, setSaveError] = useState<string | null>(null);
  const [started, setStarted] = useState(false);

  const studentId = session?.role === 'student' ? session.studentId! : '';

  useEffect(() => {
    if (!credentials || !testId || !studentId) return;
    setLoading(true);
    Promise.all([fetchAllTests(credentials), fetchAllQuestions(credentials), fetchStudentAttempts(credentials, studentId)])
      .then(([tests, qs, attempts]) => {
        const t = tests.find((x) => x.id === testId);
        if (!t) {
          setError('Test not found.');
          return;
        }
        setTest(t);
        setQuestions(qs.filter((q) => t.sections.some((s) => s.questionIds.includes(q.id))));

        const inProgress = attempts.find((a) => a.testId === testId && a.status === 'in-progress');
        if (inProgress) {
          setExistingAttempt(inProgress);
          setStarted(true); // auto-resume
        }
      })
      .catch((e) => setError(e instanceof Error ? e.message : 'Failed to load test.'))
      .finally(() => setLoading(false));
  }, [credentials, testId, studentId]);

  const persistAttempt = useCallback(
    async (attempt: Attempt) => {
      if (!credentials || !studentId) return;
      try {
        await upsertAttempt(credentials, studentId, attempt);
        setSaveError(null);
      } catch (e) {
        setSaveError(e instanceof Error ? e.message : 'Failed to save progress. Will retry on next change.');
      }
    },
    [credentials, studentId]
  );

  // Used ONLY for the final submit, not for periodic autosave. Unlike persistAttempt
  // above, this does NOT swallow errors - if the final scored save fails (network issue,
  // a GitHub API conflict that exhausted retries, etc.), the caller needs to know, rather
  // than navigating to a review page for an attempt that was never actually written.
  const persistFinalAttempt = useCallback(
    async (attempt: Attempt) => {
      if (!credentials || !studentId) throw new Error('Not connected - please reconnect via Setup.');
      await upsertAttempt(credentials, studentId, attempt);
    },
    [credentials, studentId]
  );

  if (loading) return <LoadingState label="Loading test…" />;
  if (error) return <ErrorState message={error} />;
  if (!test || !credentials) return null;

  if (!started) {
    return <TestInstructionsScreen test={test} onStart={() => setStarted(true)} onBack={() => navigate('/student/tests')} />;
  }

  return (
    <LiveTestRunner
      test={test}
      questions={questions}
      studentId={studentId}
      credentials={credentials}
      existingAttempt={existingAttempt}
      onAutosave={persistAttempt}
      onFinalSave={persistFinalAttempt}
      saveError={saveError}
    />
  );
}

function TestInstructionsScreen({ test, onStart, onBack }: { test: Test; onStart: () => void; onBack: () => void }) {
  return (
    <div className="min-h-screen bg-ink-50 flex items-center justify-center px-4">
      <div className="max-w-lg bg-white border border-ink-200 rounded-xl p-8">
        <h1 className="text-xl font-bold text-ink-700 mb-1">{test.name}</h1>
        <p className="text-ink-400 text-sm mb-5">
          {test.sections.length} section(s) · {Math.round(test.totalDurationSeconds / 60)} minutes total
        </p>
        <div className="text-ink-600 text-sm whitespace-pre-wrap mb-6">{test.instructions}</div>
        <div className="flex justify-end gap-2">
          <Button variant="ghost" onClick={onBack}>Back</Button>
          <Button onClick={onStart}>Start test</Button>
        </div>
      </div>
    </div>
  );
}

function LiveTestRunner({
  test,
  questions,
  studentId,
  credentials,
  existingAttempt,
  onAutosave,
  onFinalSave,
  saveError,
}: {
  test: Test;
  questions: Question[];
  studentId: string;
  credentials: AppCredentials;
  existingAttempt?: Attempt;
  onAutosave: (a: Attempt) => Promise<void>;
  onFinalSave: (a: Attempt) => Promise<void>;
  saveError: string | null;
}) {
  const navigate = useNavigate();
  const questionById = new Map(questions.map((q) => [q.id, q]));
  const [submitting, setSubmitting] = useState(false);
  const [submitError, setSubmitError] = useState<string | null>(null);
  const [pendingFinalAttempt, setPendingFinalAttempt] = useState<Attempt | null>(null);

  const attempt = useTestAttempt({
    test,
    studentId,
    existingAttempt,
    onAutosave: (snapshot) => { onAutosave(snapshot); },
    onAutoSubmit: (snapshot) => { handleFinalSubmit(snapshot); },
  });

  async function handleFinalSubmit(snapshot: Attempt) {
    setSubmitting(true);
    setSubmitError(null);
    const { responses: scoredResponses, summary } = scoreAttempt(questions, snapshot.responses);
    const finalAttempt: Attempt = {
      ...snapshot,
      responses: scoredResponses,
      score: summary.score,
      maxScore: summary.maxScore,
      accuracy: summary.accuracy,
      attemptRate: summary.attemptRate,
      subjectBreakdown: summary.subjectBreakdown,
    };

    try {
      await onFinalSave(finalAttempt);
      // Only navigate once we know for certain the save actually succeeded -
      // this is the fix for "attempt not found": previously this navigated
      // unconditionally even if the save had silently failed.
      navigate(`/student/attempts/${finalAttempt.id}`);
    } catch (e) {
      setSubmitting(false);
      setPendingFinalAttempt(finalAttempt);
      setSubmitError(
        e instanceof Error
          ? `Your test could not be saved: ${e.message}`
          : 'Your test could not be saved due to a connection issue.'
      );
    }
  }

  async function retryFinalSave() {
    if (!pendingFinalAttempt) return;
    setSubmitting(true);
    setSubmitError(null);
    try {
      await onFinalSave(pendingFinalAttempt);
      navigate(`/student/attempts/${pendingFinalAttempt.id}`);
    } catch (e) {
      setSubmitting(false);
      setSubmitError(
        e instanceof Error
          ? `Still couldn't save: ${e.message}`
          : 'Still couldn\'t save due to a connection issue.'
      );
    }
  }

  function confirmSubmit() {
    if (!confirm('Submit the test now? You cannot make further changes after submitting.')) return;
    const snapshot = attempt.submit();
    handleFinalSubmit(snapshot);
  }

  const currentQuestion = attempt.currentQuestionId ? questionById.get(attempt.currentQuestionId) : undefined;
  const sectionTiming = attempt.currentSection ? attempt.sectionTimings[attempt.currentSection.id] : undefined;

  const answeredCount = Object.values(attempt.responses).filter(
    (r) => r.state === 'answered' || r.state === 'answered-marked-for-review'
  ).length;
  const markedCount = Object.values(attempt.responses).filter(
    (r) => r.state === 'marked-for-review' || r.state === 'answered-marked-for-review'
  ).length;
  const notVisitedCount = Object.values(attempt.responses).filter((r) => r.state === 'not-visited').length;

  if (submitting) return <LoadingState label="Submitting and scoring your test…" />;

  if (submitError) {
    return (
      <div className="min-h-screen bg-ink-50 flex items-center justify-center px-4">
        <div className="max-w-md bg-white border border-ink-200 rounded-xl p-8 text-center">
          <h1 className="text-ink-700 font-bold text-lg mb-2">Couldn't save your test</h1>
          <p className="text-ink-500 text-sm mb-6">
            {submitError} Your answers are still here in this tab - nothing is lost. Check your internet
            connection and try again.
          </p>
          <Button onClick={retryFinalSave}>Try saving again</Button>
        </div>
      </div>
    );
  }

  return (
    <div className="h-screen bg-ink-50 flex flex-col">
      {/* Header */}
      <div className="flex items-center justify-between px-6 py-3 border-b border-ink-200 bg-white">
        <div>
          <h1 className="text-ink-700 font-semibold text-sm">{test.name}</h1>
          <div className="flex gap-1.5 mt-1">
            {test.sections.map((s, idx) => (
              <button
                key={s.id}
                onClick={() => attempt.goToSection(idx)}
                disabled={attempt.lockedSectionIds.has(s.id) && idx !== attempt.currentSectionIndex}
                className={`text-xs px-2.5 py-1 rounded-md font-medium ${
                  idx === attempt.currentSectionIndex
                    ? 'bg-catblue-500 text-white'
                    : attempt.lockedSectionIds.has(s.id)
                      ? 'bg-ink-100 text-ink-400 cursor-not-allowed'
                      : 'bg-ink-100 text-ink-600 hover:bg-ink-200'
                }`}
              >
                {s.name}
              </button>
            ))}
          </div>
        </div>
        <div className="flex items-center gap-6">
          {saveError && <span className="text-red-600 text-xs max-w-[200px]">{saveError}</span>}
          <TimerDisplay seconds={sectionTiming?.timeRemainingSeconds ?? 0} label="Section time left" />
          <Button variant="danger" onClick={confirmSubmit}>Submit test</Button>
        </div>
      </div>

      {/* Body */}
      <div className="flex-1 flex min-h-0">
        {currentQuestion ? (
          <QuestionArea
            question={currentQuestion}
            selectedOptionId={attempt.response?.selectedOptionId}
            enteredAnswer={attempt.response?.enteredAnswer}
            credentials={credentials}
            onSelectOption={attempt.setSelectedOption}
            onAnswerChange={attempt.setEnteredAnswer}
          />
        ) : (
          <div className="flex-1 flex items-center justify-center text-ink-500">No questions in this section.</div>
        )}

        {/* Sidebar: palette */}
        <div className="w-72 border-l border-ink-200 bg-white p-5 overflow-y-auto">
          <div className="grid grid-cols-3 gap-2 text-center mb-4 text-xs">
            <SummaryStat label="Answered" value={answeredCount} color="text-green-400" />
            <SummaryStat label="Marked" value={markedCount} color="text-purple-400" />
            <SummaryStat label="Not visited" value={notVisitedCount} color="text-ink-400" />
          </div>

          <QuestionPalette
            questionNumbers={attempt.currentSection?.questionIds.map((_, i) => i + 1) ?? []}
            states={attempt.questionStates}
            currentIndex={attempt.currentQuestionIndex}
            onSelect={attempt.goToQuestion}
          />

          <div className="mt-6 pt-4 border-t border-ink-200">
            <PaletteLegend />
          </div>
        </div>
      </div>

      {/* Footer controls */}
      <div className="flex items-center justify-between px-6 py-3 border-t border-ink-200 bg-white">
        <Button variant="secondary" onClick={attempt.previous} disabled={attempt.currentQuestionIndex === 0}>
          Previous
        </Button>
        <div className="flex gap-2">
          <Button variant="ghost" onClick={attempt.clearResponse}>Clear response</Button>
          <Button variant="secondary" onClick={() => { attempt.toggleMarkForReview(); attempt.saveAndNext(); }}>
            Mark for review & next
          </Button>
          <Button onClick={attempt.saveAndNext}>Save & next</Button>
        </div>
      </div>
    </div>
  );
}

function SummaryStat({ label, value, color }: { label: string; value: number; color: string }) {
  return (
    <div className="bg-white rounded-md py-2">
      <div className={`font-bold text-base ${color}`}>{value}</div>
      <div className="text-ink-500 text-[10px]">{label}</div>
    </div>
  );
}
