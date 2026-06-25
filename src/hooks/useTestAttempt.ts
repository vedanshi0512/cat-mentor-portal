import { useCallback, useEffect, useRef, useState } from 'react';
import { v4 as uuidv4 } from 'uuid';
import type { Test } from '@/types/test';
import type { Attempt, QuestionResponse, QuestionState, SectionTiming } from '@/types/attempt';

/**
 * Encapsulates the entire live state of a CAT-style test attempt:
 * - per-question response state (answer, visited/answered/marked flags, time spent)
 * - per-section countdown timers, with optional hard locking (CAT real-exam behavior:
 *   once a locked section's time runs out or the student moves to the next section,
 *   they cannot return to it)
 * - autosave: calls `onAutosave` periodically and on every navigation, so progress
 *   survives a refresh/crash (the page wrapping this hook is responsible for actually
 *   persisting via the GitHub API and for the "resume attempt" load path)
 * - auto-submit when the final section's time expires
 */

const AUTOSAVE_INTERVAL_MS = 20_000;

export interface UseTestAttemptOptions {
  test: Test;
  studentId: string;
  existingAttempt?: Attempt; // present when resuming
  onAutosave: (attempt: Attempt) => void;
  onAutoSubmit: (attempt: Attempt) => void;
}

export function useTestAttempt({ test, studentId, existingAttempt, onAutosave, onAutoSubmit }: UseTestAttemptOptions) {
  const allQuestionIds = test.sections.flatMap((s) => s.questionIds);

  const [attemptId] = useState(existingAttempt?.id ?? uuidv4());
  const [startedAt] = useState(existingAttempt?.startedAt ?? new Date().toISOString());

  const [responses, setResponses] = useState<Record<string, QuestionResponse>>(() => {
    const map: Record<string, QuestionResponse> = {};
    for (const id of allQuestionIds) {
      const existing = existingAttempt?.responses.find((r) => r.questionId === id);
      map[id] = existing ?? { questionId: id, state: 'not-visited', timeSpentSeconds: 0 };
    }
    return map;
  });

  const [sectionTimings, setSectionTimings] = useState<Record<string, SectionTiming>>(() => {
    const map: Record<string, SectionTiming> = {};
    for (const section of test.sections) {
      const existing = existingAttempt?.sectionTimings.find((t) => t.sectionId === section.id);
      map[section.id] = existing ?? { sectionId: section.id, timeRemainingSeconds: section.durationSeconds };
    }
    return map;
  });

  const [currentSectionIndex, setCurrentSectionIndex] = useState(() => {
    if (existingAttempt?.currentSectionId) {
      const idx = test.sections.findIndex((s) => s.id === existingAttempt.currentSectionId);
      if (idx >= 0) return idx;
    }
    return 0;
  });
  const [currentQuestionIndex, setCurrentQuestionIndex] = useState(0);
  const [lockedSectionIds, setLockedSectionIds] = useState<Set<string>>(new Set());
  const [submitted, setSubmitted] = useState(existingAttempt?.status === 'submitted' || existingAttempt?.status === 'auto-submitted');

  const currentSection = test.sections[currentSectionIndex];
  const currentQuestionId = currentSection?.questionIds[currentQuestionIndex];

  const lastTickRef = useRef<number>(Date.now());
  const visitStartRef = useRef<number>(Date.now());

  const buildAttemptSnapshot = useCallback(
    (status: Attempt['status']): Attempt => {
      const totalTimeSpentSeconds = Object.values(responses).reduce((s, r) => s + r.timeSpentSeconds, 0);
      return {
        id: attemptId,
        testId: test.id,
        studentId,
        status,
        startedAt,
        submittedAt: status === 'submitted' || status === 'auto-submitted' ? new Date().toISOString() : undefined,
        responses: Object.values(responses),
        sectionTimings: Object.values(sectionTimings),
        currentSectionId: currentSection?.id,
        totalTimeSpentSeconds,
      };
    },
    [attemptId, test.id, studentId, startedAt, responses, sectionTimings, currentSection]
  );

  // ---- Tick loop: countdown current section, accumulate time on current question ----
  useEffect(() => {
    if (submitted || !currentSection) return;
    lastTickRef.current = Date.now(); // avoid a stale-elapsed spike right after a section transition

    const interval = setInterval(() => {
      const now = Date.now();
      const elapsedSec = Math.round((now - lastTickRef.current) / 1000);
      lastTickRef.current = now;
      if (elapsedSec <= 0) return;

      setSectionTimings((prev) => {
        const timing = prev[currentSection.id];
        if (!timing) return prev;
        const remaining = Math.max(0, timing.timeRemainingSeconds - elapsedSec);
        return { ...prev, [currentSection.id]: { ...timing, timeRemainingSeconds: remaining } };
      });

      if (currentQuestionId) {
        setResponses((prev) => {
          const r = prev[currentQuestionId];
          if (!r) return prev;
          return { ...prev, [currentQuestionId]: { ...r, timeSpentSeconds: r.timeSpentSeconds + elapsedSec } };
        });
      }
    }, 1000);

    return () => clearInterval(interval);
  }, [submitted, currentSection, currentQuestionId]);

  // ---- Watch for section time running out ----
  useEffect(() => {
    if (submitted || !currentSection) return;
    const timing = sectionTimings[currentSection.id];
    if (timing && timing.timeRemainingSeconds <= 0) {
      handleSectionTimeUp();
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [sectionTimings, currentSection, submitted]);

  function handleSectionTimeUp() {
    if (!currentSection) return;
    setLockedSectionIds((prev) => new Set(prev).add(currentSection.id));

    const isLastSection = currentSectionIndex === test.sections.length - 1;
    if (isLastSection) {
      doSubmit('auto-submitted');
    } else {
      goToSection(currentSectionIndex + 1);
    }
  }

  // ---- Mark current question visited on entry ----
  useEffect(() => {
    if (!currentQuestionId) return;
    visitStartRef.current = Date.now();
    setResponses((prev) => {
      const r = prev[currentQuestionId];
      if (!r || r.state !== 'not-visited') return prev;
      return { ...prev, [currentQuestionId]: { ...r, state: 'visited', firstVisitedAt: new Date().toISOString() } };
    });
  }, [currentQuestionId]);

  // ---- Autosave on interval ----
  useEffect(() => {
    if (submitted) return;
    const interval = setInterval(() => {
      onAutosave(buildAttemptSnapshot('in-progress'));
    }, AUTOSAVE_INTERVAL_MS);
    return () => clearInterval(interval);
  }, [submitted, buildAttemptSnapshot, onAutosave]);

  function setSelectedOption(optionId: string) {
    if (!currentQuestionId) return;
    setResponses((prev) => {
      const r = prev[currentQuestionId];
      const nextState: QuestionState = r.state === 'marked-for-review' || r.state === 'answered-marked-for-review'
        ? 'answered-marked-for-review'
        : 'answered';
      return {
        ...prev,
        [currentQuestionId]: { ...r, selectedOptionId: optionId, state: nextState, lastModifiedAt: new Date().toISOString() },
      };
    });
  }

  function setEnteredAnswer(value: string) {
    if (!currentQuestionId) return;
    setResponses((prev) => {
      const r = prev[currentQuestionId];
      const hasValue = value.trim().length > 0;
      const nextState: QuestionState = !hasValue
        ? (r.state === 'answered-marked-for-review' ? 'marked-for-review' : 'visited')
        : (r.state === 'marked-for-review' || r.state === 'answered-marked-for-review')
          ? 'answered-marked-for-review'
          : 'answered';
      return {
        ...prev,
        [currentQuestionId]: { ...r, enteredAnswer: value, state: nextState, lastModifiedAt: new Date().toISOString() },
      };
    });
  }

  function clearResponse() {
    if (!currentQuestionId) return;
    setResponses((prev) => {
      const r = prev[currentQuestionId];
      return { ...prev, [currentQuestionId]: { ...r, selectedOptionId: undefined, enteredAnswer: undefined, state: 'visited' } };
    });
  }

  function toggleMarkForReview() {
    if (!currentQuestionId) return;
    setResponses((prev) => {
      const r = prev[currentQuestionId];
      const hasAnswer = !!r.selectedOptionId || !!r.enteredAnswer;
      const nextState: QuestionState = r.state === 'marked-for-review' || r.state === 'answered-marked-for-review'
        ? hasAnswer ? 'answered' : 'visited'
        : hasAnswer ? 'answered-marked-for-review' : 'marked-for-review';
      return { ...prev, [currentQuestionId]: { ...r, state: nextState } };
    });
  }

  function goToQuestion(index: number) {
    if (!currentSection) return;
    if (index < 0 || index >= currentSection.questionIds.length) return;
    setCurrentQuestionIndex(index);
  }

  function goToSection(sectionIndex: number) {
    if (sectionIndex < 0 || sectionIndex >= test.sections.length) return;
    const targetSection = test.sections[sectionIndex];
    // CAT-real-exam rule: a locked section that's been left (time up OR navigated away
    // from, if it's marked isLocked) cannot be re-entered.
    if (lockedSectionIds.has(targetSection.id) && sectionIndex !== currentSectionIndex) {
      return;
    }
    if (currentSection?.isLocked && sectionIndex !== currentSectionIndex) {
      setLockedSectionIds((prev) => new Set(prev).add(currentSection.id));
    }
    setCurrentSectionIndex(sectionIndex);
    setCurrentQuestionIndex(0);
  }

  function saveAndNext() {
    goToQuestion(currentQuestionIndex + 1);
  }

  function previous() {
    goToQuestion(currentQuestionIndex - 1);
  }

  function doSubmit(status: 'submitted' | 'auto-submitted' = 'submitted') {
    setSubmitted(true);
    const snapshot = buildAttemptSnapshot(status);
    if (status === 'auto-submitted') {
      // Auto-submit has no separate manual confirmation step calling back into the page,
      // so this is the one and only place that snapshot gets handed off for scoring+save.
      onAutoSubmit(snapshot);
    }
    // For a manual submit, intentionally do NOT write here. The caller (TestAttemptPage's
    // confirmSubmit -> handleFinalSubmit) scores this snapshot and performs the single
    // real save. Writing here too used to cause two competing GitHub commits per submit -
    // one with an unscored snapshot, one with the scored one - racing each other.
    return snapshot;
  }

  const questionStates: QuestionState[] = currentSection
    ? currentSection.questionIds.map((id) => responses[id]?.state ?? 'not-visited')
    : [];

  return {
    test,
    currentSection,
    currentSectionIndex,
    currentQuestionId,
    currentQuestionIndex,
    response: currentQuestionId ? responses[currentQuestionId] : undefined,
    responses,
    sectionTimings,
    lockedSectionIds,
    questionStates,
    submitted,
    setSelectedOption,
    setEnteredAnswer,
    clearResponse,
    toggleMarkForReview,
    goToQuestion,
    goToSection,
    saveAndNext,
    previous,
    submit: () => doSubmit('submitted'),
    buildAttemptSnapshot,
  };
}
