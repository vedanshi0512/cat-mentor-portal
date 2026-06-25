import { useEffect, useState } from 'react';
import { useNavigate, useParams } from 'react-router-dom';
import { v4 as uuidv4 } from 'uuid';
import { Plus } from 'lucide-react';
import { useAuth } from '@/context/AuthContext';
import { fetchAllQuestions, upsertQuestion, fetchTopics } from '@/api/questionsRepo';
import { fetchAllTests, upsertTest } from '@/api/testsRepo';
import type { Question, Subject } from '@/types/question';
import type { Test, TestSection, TestType } from '@/types/test';
import { Button, Card, LoadingState, ErrorState, Badge, Modal } from '@/components/common/UI';
import QuestionForm from '@/components/question/QuestionForm';

const TEST_TYPES: TestType[] = ['Full Mock', 'Sectional', 'Topic Test', 'Daily Practice Set'];
const SUBJECTS: Subject[] = ['VARC', 'DILR', 'QA'];

function defaultSectionsForType(type: TestType): { name: string; subject: Subject }[] {
  if (type === 'Full Mock') {
    return [{ name: 'VARC', subject: 'VARC' }, { name: 'DILR', subject: 'DILR' }, { name: 'QA', subject: 'QA' }];
  }
  return [{ name: 'Section 1', subject: 'QA' }];
}

export default function TestBuilderPage() {
  const { credentials } = useAuth();
  const navigate = useNavigate();
  const { testId } = useParams();

  const [allQuestions, setAllQuestions] = useState<Question[]>([]);
  const [existingTests, setExistingTests] = useState<Test[]>([]);
  const [topicsBySubject, setTopicsBySubject] = useState<Record<Subject, string[]>>({ VARC: [], DILR: [], QA: [] });
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [saving, setSaving] = useState(false);

  const [name, setName] = useState('');
  const [type, setType] = useState<TestType>('Full Mock');
  const [instructions, setInstructions] = useState(
    'Read each question carefully. Use Save & Next to record your answer and move on. You can mark questions for review and revisit them before submitting.'
  );
  const [sections, setSections] = useState<TestSection[]>([]);
  const [availableFrom, setAvailableFrom] = useState('');
  const [availableUntil, setAvailableUntil] = useState('');
  const [maxAttempts, setMaxAttempts] = useState(1);
  const [isPublished, setIsPublished] = useState(false);

  // Which section is currently getting a brand-new question authored for it
  const [authoringForSectionId, setAuthoringForSectionId] = useState<string | null>(null);
  const [editingQuestion, setEditingQuestion] = useState<Question | null>(null);
  const [savingQuestion, setSavingQuestion] = useState(false);
  const [questionSaveError, setQuestionSaveError] = useState<string | null>(null);

  // Which section's "pick from existing question bank" picker is expanded
  const [pickerOpenForSectionId, setPickerOpenForSectionId] = useState<string | null>(null);

  async function loadAll() {
    if (!credentials) return;
    setLoading(true);
    try {
      const [qs, tests, topicsFile] = await Promise.all([
        fetchAllQuestions(credentials),
        fetchAllTests(credentials),
        fetchTopics(credentials),
      ]);
      setAllQuestions(qs);
      setExistingTests(tests);
      const map: Record<Subject, string[]> = { VARC: [], DILR: [], QA: [] };
      for (const t of topicsFile.topicsBySubject) map[t.subject] = t.topics;
      setTopicsBySubject(map);

      if (testId) {
        const existing = tests.find((t) => t.id === testId);
        if (existing) {
          setName(existing.name);
          setType(existing.type);
          setInstructions(existing.instructions);
          setSections(existing.sections);
          setAvailableFrom(existing.availableFrom?.slice(0, 16) ?? '');
          setAvailableUntil(existing.availableUntil?.slice(0, 16) ?? '');
          setMaxAttempts(existing.maxAttempts);
          setIsPublished(existing.isPublished);
          return;
        }
      }
      initSections(type);
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Failed to load.');
    } finally {
      setLoading(false);
    }
  }

  useEffect(() => {
    loadAll();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [credentials, testId]);

  function initSections(t: TestType) {
    setSections(
      defaultSectionsForType(t).map((s) => ({
        id: uuidv4(),
        name: s.name,
        subject: s.subject,
        questionIds: [],
        durationSeconds: t === 'Full Mock' ? 40 * 60 : 30 * 60,
        isLocked: t === 'Full Mock',
      }))
    );
  }

  function handleTypeChange(t: TestType) {
    setType(t);
    if (!testId) initSections(t);
  }

  function updateSection(id: string, patch: Partial<TestSection>) {
    setSections((prev) => prev.map((s) => (s.id === id ? { ...s, ...patch } : s)));
  }

  function addSection() {
    setSections((prev) => [
      ...prev,
      { id: uuidv4(), name: `Section ${prev.length + 1}`, subject: 'QA', questionIds: [], durationSeconds: 30 * 60, isLocked: false },
    ]);
  }

  function removeSection(id: string) {
    setSections((prev) => prev.filter((s) => s.id !== id));
  }

  function toggleQuestionInSection(sectionId: string, questionId: string) {
    setSections((prev) =>
      prev.map((s) => {
        if (s.id !== sectionId) return s;
        const has = s.questionIds.includes(questionId);
        return { ...s, questionIds: has ? s.questionIds.filter((id) => id !== questionId) : [...s.questionIds, questionId] };
      })
    );
  }

  function removeQuestionFromSection(sectionId: string, questionId: string) {
    setSections((prev) =>
      prev.map((s) => (s.id === sectionId ? { ...s, questionIds: s.questionIds.filter((id) => id !== questionId) } : s))
    );
  }

  // Saves a freshly-authored question to the bank AND immediately attaches it to
  // whichever section the mentor was authoring it for - this is the core of the new
  // "create questions while building the test" flow, replacing the old
  // question-bank-first-then-build-a-test-from-it order.
  async function handleSaveAuthoredQuestion(question: Question) {
    if (!credentials || !authoringForSectionId) return;
    setSavingQuestion(true);
    setQuestionSaveError(null);
    try {
      const updated = await upsertQuestion(credentials, question);
      setAllQuestions(updated);

      const known = topicsBySubject[question.subject] ?? [];
      if (!known.includes(question.topic)) {
        setTopicsBySubject((prev) => ({ ...prev, [question.subject]: [...prev[question.subject], question.topic] }));
      }

      setSections((prev) =>
        prev.map((s) =>
          s.id === authoringForSectionId ? { ...s, questionIds: [...s.questionIds, question.id] } : s
        )
      );
      setAuthoringForSectionId(null);
    } catch (e) {
      setQuestionSaveError(e instanceof Error ? e.message : 'Failed to save question.');
    } finally {
      setSavingQuestion(false);
    }
  }

  async function handleSaveEditedQuestion(question: Question) {
    if (!credentials) return;
    setSavingQuestion(true);
    setQuestionSaveError(null);
    try {
      const updated = await upsertQuestion(credentials, question);
      setAllQuestions(updated);
      setEditingQuestion(null);
    } catch (e) {
      setQuestionSaveError(e instanceof Error ? e.message : 'Failed to save question.');
    } finally {
      setSavingQuestion(false);
    }
  }

  const totalDuration = sections.reduce((sum, s) => sum + s.durationSeconds, 0);

  async function handleSave() {
    if (!credentials) return;
    if (!name.trim()) return setError('Test name is required.');
    if (sections.every((s) => s.questionIds.length === 0)) return setError('Add at least one question to a section.');

    setSaving(true);
    setError(null);
    const now = new Date().toISOString();
    const test: Test = {
      id: testId ?? uuidv4(),
      name: name.trim(),
      type,
      instructions,
      sections,
      totalDurationSeconds: totalDuration,
      availableFrom: availableFrom ? new Date(availableFrom).toISOString() : now,
      availableUntil: availableUntil ? new Date(availableUntil).toISOString() : new Date(Date.now() + 365 * 86400000).toISOString(),
      maxAttempts,
      createdBy: 'mentor',
      createdAt: existingTests.find((t) => t.id === testId)?.createdAt ?? now,
      updatedAt: now,
      isPublished,
    };

    try {
      await upsertTest(credentials, test);
      navigate('/mentor/tests');
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Failed to save test.');
    } finally {
      setSaving(false);
    }
  }

  if (loading) return <LoadingState label="Loading test builder…" />;

  return (
    <div className="p-8 max-w-5xl mx-auto">
      <h1 className="text-2xl font-bold text-ink-700 mb-6">{testId ? 'Edit test' : 'Create test'}</h1>

      {error && <ErrorState message={error} />}

      <Card className="mb-5 space-y-4">
        <div className="grid grid-cols-2 gap-4">
          <label className="block">
            <span className="text-sm text-ink-500 mb-1 block">Test name</span>
            <input value={name} onChange={(e) => setName(e.target.value)} className="w-full bg-white border border-ink-600 rounded-md px-3 py-2 text-ink-700 text-sm" />
          </label>
          <label className="block">
            <span className="text-sm text-ink-500 mb-1 block">Test type</span>
            <select value={type} onChange={(e) => handleTypeChange(e.target.value as TestType)} className="w-full bg-white border border-ink-600 rounded-md px-3 py-2 text-ink-700 text-sm">
              {TEST_TYPES.map((t) => <option key={t}>{t}</option>)}
            </select>
          </label>
        </div>

        <label className="block">
          <span className="text-sm text-ink-500 mb-1 block">Instructions</span>
          <textarea value={instructions} onChange={(e) => setInstructions(e.target.value)} rows={3} className="w-full bg-white border border-ink-600 rounded-md px-3 py-2 text-ink-700 text-sm" />
        </label>

        <div className="grid grid-cols-3 gap-4">
          <label className="block">
            <span className="text-sm text-ink-500 mb-1 block">Available from</span>
            <input type="datetime-local" value={availableFrom} onChange={(e) => setAvailableFrom(e.target.value)} className="w-full bg-white border border-ink-600 rounded-md px-3 py-2 text-ink-700 text-sm" />
          </label>
          <label className="block">
            <span className="text-sm text-ink-500 mb-1 block">Expires</span>
            <input type="datetime-local" value={availableUntil} onChange={(e) => setAvailableUntil(e.target.value)} className="w-full bg-white border border-ink-600 rounded-md px-3 py-2 text-ink-700 text-sm" />
          </label>
          <label className="block">
            <span className="text-sm text-ink-500 mb-1 block">Max attempts (0 = unlimited)</span>
            <input type="number" min={0} value={maxAttempts} onChange={(e) => setMaxAttempts(Number(e.target.value))} className="w-full bg-white border border-ink-600 rounded-md px-3 py-2 text-ink-700 text-sm" />
          </label>
        </div>

        <label className="flex items-center gap-2 text-sm text-ink-500">
          <input type="checkbox" checked={isPublished} onChange={(e) => setIsPublished(e.target.checked)} />
          Published (visible to students)
        </label>
      </Card>

      <div className="flex items-center justify-between mb-3">
        <h2 className="text-ink-700 font-semibold">Sections — total duration {Math.round(totalDuration / 60)} min</h2>
        <Button variant="secondary" onClick={addSection}>+ Add section</Button>
      </div>

      <div className="space-y-4">
        {sections.map((section) => {
          const sectionQuestions = section.questionIds
            .map((id) => allQuestions.find((q) => q.id === id))
            .filter((q): q is Question => !!q);
          const pickerQuestions = allQuestions.filter(
            (q) => q.subject === section.subject && !section.questionIds.includes(q.id)
          );

          return (
            <Card key={section.id}>
              <div className="grid grid-cols-4 gap-3 mb-3">
                <input
                  value={section.name}
                  onChange={(e) => updateSection(section.id, { name: e.target.value })}
                  className="bg-white border border-ink-600 rounded-md px-3 py-1.5 text-ink-700 text-sm"
                />
                <select
                  value={section.subject}
                  onChange={(e) => updateSection(section.id, { subject: e.target.value as Subject })}
                  className="bg-white border border-ink-600 rounded-md px-3 py-1.5 text-ink-700 text-sm"
                >
                  {SUBJECTS.map((s) => <option key={s}>{s}</option>)}
                </select>
                <label className="flex items-center gap-2 text-sm text-ink-500">
                  <span>Duration (min)</span>
                  <input
                    type="number"
                    value={Math.round(section.durationSeconds / 60)}
                    onChange={(e) => updateSection(section.id, { durationSeconds: Number(e.target.value) * 60 })}
                    className="w-16 bg-white border border-ink-600 rounded-md px-2 py-1 text-ink-700 text-sm"
                  />
                </label>
                <label className="flex items-center gap-2 text-sm text-ink-500">
                  <input type="checkbox" checked={section.isLocked} onChange={(e) => updateSection(section.id, { isLocked: e.target.checked })} />
                  Lock section (CAT-style)
                </label>
              </div>

              <div className="flex items-center justify-between mb-3">
                <span className="text-sm text-ink-400">{section.questionIds.length} question(s) in this section</span>
                <div className="flex gap-2">
                  <Button onClick={() => setAuthoringForSectionId(section.id)}>
                    <Plus size={15} className="inline mr-1 -mt-0.5" /> Add new question
                  </Button>
                  <Button
                    variant="secondary"
                    onClick={() => setPickerOpenForSectionId(pickerOpenForSectionId === section.id ? null : section.id)}
                  >
                    Pick from existing
                  </Button>
                  {sections.length > 1 && (
                    <Button variant="danger" onClick={() => removeSection(section.id)}>Remove section</Button>
                  )}
                </div>
              </div>

              {/* Questions already in this section */}
              {sectionQuestions.length > 0 && (
                <div className="space-y-2 mb-3">
                  {sectionQuestions.map((q, i) => (
                    <div key={q.id} className="flex items-start justify-between gap-3 border border-ink-200 rounded-md px-3 py-2">
                      <div className="flex-1 min-w-0">
                        <div className="flex items-center gap-1.5 mb-1">
                          <span className="text-ink-400 text-xs">Q{i + 1}</span>
                          <Badge>{q.topic}</Badge>
                          <Badge color={q.difficulty === 'Hard' ? 'red' : q.difficulty === 'Easy' ? 'green' : 'default'}>{q.difficulty}</Badge>
                          {q.images && q.images.length > 0 && <Badge color="amber">Has image</Badge>}
                        </div>
                        <p className="text-ink-700 text-sm truncate">{q.questionText}</p>
                      </div>
                      <div className="flex items-center gap-2 shrink-0">
                        <button
                          onClick={() => setEditingQuestion(q)}
                          className="text-ink-500 hover:text-catblue-600 text-xs px-2 py-1"
                        >
                          Edit
                        </button>
                        <button
                          onClick={() => removeQuestionFromSection(section.id, q.id)}
                          className="text-ink-400 hover:text-red-600 text-xs px-2 py-1"
                          title="Removes it from this section only - the question itself isn't deleted"
                        >
                          Remove from section
                        </button>
                      </div>
                    </div>
                  ))}
                </div>
              )}
              {sectionQuestions.length === 0 && (
                <p className="text-ink-400 text-sm mb-3">No questions yet — add a new one or pick from the existing bank.</p>
              )}

              {/* Optional: pick from already-authored questions of the same subject */}
              {pickerOpenForSectionId === section.id && (
                <div className="max-h-56 overflow-y-auto border border-ink-200 rounded-md divide-y divide-ink-200">
                  {pickerQuestions.map((q) => (
                    <label key={q.id} className="flex items-start gap-2 px-3 py-2 hover:bg-ink-100 cursor-pointer">
                      <input
                        type="checkbox"
                        checked={section.questionIds.includes(q.id)}
                        onChange={() => toggleQuestionInSection(section.id, q.id)}
                        className="mt-0.5"
                      />
                      <div className="flex-1 min-w-0">
                        <p className="text-ink-700 text-sm truncate">{q.questionText}</p>
                        <div className="flex gap-1.5 mt-1">
                          <Badge>{q.topic}</Badge>
                          <Badge color={q.difficulty === 'Hard' ? 'red' : q.difficulty === 'Easy' ? 'green' : 'default'}>{q.difficulty}</Badge>
                        </div>
                      </div>
                    </label>
                  ))}
                  {pickerQuestions.length === 0 && (
                    <p className="text-ink-500 text-sm px-3 py-4">
                      No other {section.subject} questions exist yet. Use "Add new question" instead.
                    </p>
                  )}
                </div>
              )}
            </Card>
          );
        })}
      </div>

      <div className="flex justify-end gap-2 mt-6">
        <Button variant="ghost" onClick={() => navigate('/mentor/tests')}>Cancel</Button>
        <Button onClick={handleSave} disabled={saving}>{saving ? 'Saving…' : 'Save test'}</Button>
      </div>

      <Modal
        open={!!authoringForSectionId}
        onClose={() => setAuthoringForSectionId(null)}
        title="Add a new question to this section"
      >
        {credentials && authoringForSectionId && (
          <QuestionForm
            topicsBySubject={topicsBySubject}
            mentorId="mentor"
            credentials={credentials}
            onSave={handleSaveAuthoredQuestion}
            onCancel={() => setAuthoringForSectionId(null)}
          />
        )}
        {savingQuestion && <p className="text-ink-400 text-xs mt-2">Saving…</p>}
        {questionSaveError && <p className="text-red-600 text-xs mt-2">{questionSaveError}</p>}
      </Modal>

      <Modal
        open={!!editingQuestion}
        onClose={() => setEditingQuestion(null)}
        title="Edit question"
      >
        {credentials && editingQuestion && (
          <QuestionForm
            initial={editingQuestion}
            topicsBySubject={topicsBySubject}
            mentorId="mentor"
            credentials={credentials}
            onSave={handleSaveEditedQuestion}
            onCancel={() => setEditingQuestion(null)}
          />
        )}
        {savingQuestion && <p className="text-ink-400 text-xs mt-2">Saving…</p>}
        {questionSaveError && <p className="text-red-600 text-xs mt-2">{questionSaveError}</p>}
      </Modal>
    </div>
  );
}

