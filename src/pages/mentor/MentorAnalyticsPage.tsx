import { useEffect, useMemo, useState } from 'react';
import { useAuth } from '@/context/AuthContext';
import { fetchStudentsFile } from '@/api/studentsRepo';
import { fetchAllStudentsAttempts, setMentorCommentOnAttempt } from '@/api/attemptsRepo';
import { fetchAllQuestions } from '@/api/questionsRepo';
import { fetchBookmarks, fetchNotes } from '@/api/studentDataRepo';
import type { Student } from '@/types/student';
import type { Attempt } from '@/types/attempt';
import type { Question } from '@/types/question';
import { Card, Badge, LoadingState, ErrorState, EmptyState } from '@/components/common/UI';

interface TopicStat {
  topic: string;
  subject: string;
  attempted: number;
  correct: number;
}

export default function MentorAnalyticsPage() {
  const { credentials } = useAuth();
  const [students, setStudents] = useState<Student[]>([]);
  const [attemptsByStudent, setAttemptsByStudent] = useState<Record<string, Attempt[]>>({});
  const [questions, setQuestions] = useState<Question[]>([]);
  const [bookmarkCounts, setBookmarkCounts] = useState<Record<string, number>>({});
  const [noteCounts, setNoteCounts] = useState<Record<string, number>>({});
  const [selectedStudentId, setSelectedStudentId] = useState<string | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [commentDraft, setCommentDraft] = useState<Record<string, string>>({});

  useEffect(() => {
    if (!credentials) return;
    setLoading(true);
    fetchStudentsFile(credentials)
      .then(async (file) => {
        const activeStudents = file.students.filter((s) => s.isActive);
        setStudents(activeStudents);
        if (activeStudents.length > 0) setSelectedStudentId(activeStudents[0].id);

        const ids = activeStudents.map((s) => s.id);
        const [attemptsMap, qs] = await Promise.all([
          fetchAllStudentsAttempts(credentials, ids),
          fetchAllQuestions(credentials),
        ]);
        setAttemptsByStudent(attemptsMap);
        setQuestions(qs);

        const bCounts: Record<string, number> = {};
        const nCounts: Record<string, number> = {};
        for (const id of ids) {
          const [bm, notes] = await Promise.all([fetchBookmarks(credentials, id), fetchNotes(credentials, id)]);
          bCounts[id] = bm.bookmarks.length;
          nCounts[id] = notes.length;
        }
        setBookmarkCounts(bCounts);
        setNoteCounts(nCounts);
      })
      .catch((e) => setError(e instanceof Error ? e.message : 'Failed to load analytics.'))
      .finally(() => setLoading(false));
  }, [credentials]);

  const questionById = useMemo(() => new Map(questions.map((q) => [q.id, q])), [questions]);

  const selectedAttempts = selectedStudentId ? attemptsByStudent[selectedStudentId] ?? [] : [];
  const submitted = selectedAttempts.filter((a) => a.status === 'submitted' || a.status === 'auto-submitted');

  const topicStats = useMemo(() => {
    const map = new Map<string, TopicStat>();
    for (const attempt of submitted) {
      for (const r of attempt.responses) {
        const q = questionById.get(r.questionId);
        if (!q) continue;
        const wasAttempted = r.state === 'answered' || r.state === 'answered-marked-for-review';
        if (!wasAttempted) continue;
        const key = q.topic;
        if (!map.has(key)) map.set(key, { topic: q.topic, subject: q.subject, attempted: 0, correct: 0 });
        const stat = map.get(key)!;
        stat.attempted += 1;
        if (r.isCorrect) stat.correct += 1;
      }
    }
    return Array.from(map.values());
  }, [submitted, questionById]);

  const weakTopics = topicStats.filter((t) => t.attempted >= 2).sort((a, b) => a.correct / a.attempted - b.correct / b.attempted).slice(0, 5);
  const strongTopics = topicStats.filter((t) => t.attempted >= 2).sort((a, b) => b.correct / b.attempted - a.correct / a.attempted).slice(0, 5);

  const mistakeTagCounts = useMemo(() => {
    const counts: Record<string, number> = {};
    for (const attempt of submitted) {
      for (const r of attempt.responses) {
        if (r.mistakeTag) counts[r.mistakeTag] = (counts[r.mistakeTag] ?? 0) + 1;
      }
    }
    return counts;
  }, [submitted]);

  const avgAccuracy = submitted.length ? Math.round((submitted.reduce((s, a) => s + (a.accuracy ?? 0), 0) / submitted.length) * 100) : 0;

  async function saveComment(attemptId: string) {
    if (!credentials || !selectedStudentId) return;
    const comment = commentDraft[attemptId];
    if (comment === undefined) return;
    await setMentorCommentOnAttempt(credentials, selectedStudentId, attemptId, comment);
  }

  if (loading) return <LoadingState label="Loading analytics…" />;
  if (error) return <ErrorState message={error} />;
  if (students.length === 0) return <EmptyState message="No students added yet." />;

  return (
    <div className="p-8 max-w-6xl mx-auto">
      <h1 className="text-2xl font-bold text-ink-700 mb-6">Student Analytics</h1>

      <div className="flex gap-2 mb-6 flex-wrap">
        {students.map((s) => (
          <button
            key={s.id}
            onClick={() => setSelectedStudentId(s.id)}
            className={`px-3.5 py-1.5 rounded-full text-sm font-medium ${
              selectedStudentId === s.id ? 'bg-catblue-500 text-white' : 'bg-white text-ink-500 border border-ink-200 hover:bg-ink-100'
            }`}
          >
            {s.name}
          </button>
        ))}
      </div>

      <div className="grid grid-cols-4 gap-4 mb-6">
        <Card><div className="text-ink-400 text-xs mb-1">Tests attempted</div><div className="text-ink-700 text-2xl font-bold">{submitted.length}</div></Card>
        <Card><div className="text-ink-400 text-xs mb-1">Avg accuracy</div><div className="text-ink-700 text-2xl font-bold">{avgAccuracy}%</div></Card>
        <Card><div className="text-ink-400 text-xs mb-1">Bookmarks</div><div className="text-ink-700 text-2xl font-bold">{selectedStudentId ? bookmarkCounts[selectedStudentId] ?? 0 : 0}</div></Card>
        <Card><div className="text-ink-400 text-xs mb-1">Notes</div><div className="text-ink-700 text-2xl font-bold">{selectedStudentId ? noteCounts[selectedStudentId] ?? 0 : 0}</div></Card>
      </div>

      <div className="grid grid-cols-2 gap-4 mb-6">
        <Card>
          <h3 className="text-ink-700 font-semibold text-sm mb-3">Weak topics</h3>
          {weakTopics.length === 0 && <p className="text-ink-500 text-sm">Not enough data yet.</p>}
          {weakTopics.map((t) => (
            <div key={t.topic} className="flex items-center justify-between py-1.5 text-sm">
              <span className="text-ink-500">{t.topic}</span>
              <Badge color="red">{Math.round((t.correct / t.attempted) * 100)}%</Badge>
            </div>
          ))}
        </Card>
        <Card>
          <h3 className="text-ink-700 font-semibold text-sm mb-3">Strong topics</h3>
          {strongTopics.length === 0 && <p className="text-ink-500 text-sm">Not enough data yet.</p>}
          {strongTopics.map((t) => (
            <div key={t.topic} className="flex items-center justify-between py-1.5 text-sm">
              <span className="text-ink-500">{t.topic}</span>
              <Badge color="green">{Math.round((t.correct / t.attempted) * 100)}%</Badge>
            </div>
          ))}
        </Card>
      </div>

      {Object.keys(mistakeTagCounts).length > 0 && (
        <Card className="mb-6">
          <h3 className="text-ink-700 font-semibold text-sm mb-3">Mistake patterns</h3>
          <div className="flex gap-2 flex-wrap">
            {Object.entries(mistakeTagCounts).map(([tag, count]) => (
              <Badge key={tag} color="red">{tag} × {count}</Badge>
            ))}
          </div>
        </Card>
      )}

      <h2 className="text-ink-700 font-semibold mb-3">Attempts & comments</h2>
      <div className="space-y-3">
        {submitted.length === 0 && <EmptyState message="No submitted attempts yet." />}
        {submitted.slice().reverse().map((a) => (
          <Card key={a.id}>
            <div className="flex items-center justify-between mb-2">
              <span className="text-ink-700 text-sm font-medium">{a.submittedAt ? new Date(a.submittedAt).toLocaleString() : ''}</span>
              <span className="text-ink-500 text-sm">{a.score ?? 0} / {a.maxScore ?? 0} · {Math.round((a.accuracy ?? 0) * 100)}% accuracy</span>
            </div>
            <textarea
              value={commentDraft[a.id] ?? a.mentorComment ?? ''}
              onChange={(e) => setCommentDraft((prev) => ({ ...prev, [a.id]: e.target.value }))}
              onBlur={() => saveComment(a.id)}
              placeholder="Leave a comment for this attempt…"
              rows={2}
              className="w-full bg-white border border-ink-600 rounded-md px-3 py-2 text-ink-700 text-sm mt-1"
            />
          </Card>
        ))}
      </div>
    </div>
  );
}
