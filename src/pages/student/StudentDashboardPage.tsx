import { useEffect, useMemo, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { LineChart, Line, XAxis, YAxis, Tooltip, ResponsiveContainer, CartesianGrid } from 'recharts';
import { useAuth } from '@/context/AuthContext';
import { fetchAllTests } from '@/api/testsRepo';
import { fetchStudentAttempts } from '@/api/attemptsRepo';
import type { Test } from '@/types/test';
import type { Attempt } from '@/types/attempt';
import { Card, Badge, LoadingState, ErrorState, EmptyState, Button } from '@/components/common/UI';

export default function StudentDashboardPage() {
  const { credentials, session } = useAuth();
  const navigate = useNavigate();
  const studentId = session?.role === 'student' ? session.studentId! : '';

  const [tests, setTests] = useState<Test[]>([]);
  const [attempts, setAttempts] = useState<Attempt[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    if (!credentials || !studentId) return;
    Promise.all([fetchAllTests(credentials), fetchStudentAttempts(credentials, studentId)])
      .then(([t, a]) => { setTests(t); setAttempts(a); })
      .catch((e) => setError(e instanceof Error ? e.message : 'Failed to load dashboard.'))
      .finally(() => setLoading(false));
  }, [credentials, studentId]);

  const now = Date.now();
  const assignedTests = tests.filter(
    (t) => t.isPublished && new Date(t.availableFrom).getTime() <= now && new Date(t.availableUntil).getTime() >= now
  );

  const submittedAttempts = attempts.filter((a) => a.status === 'submitted' || a.status === 'auto-submitted');

  const trendData = useMemo(() => {
    return submittedAttempts
      .filter((a) => a.submittedAt)
      .sort((a, b) => new Date(a.submittedAt!).getTime() - new Date(b.submittedAt!).getTime())
      .map((a, i) => ({
        name: `Attempt ${i + 1}`,
        score: a.score ?? 0,
        accuracy: Math.round((a.accuracy ?? 0) * 100),
      }));
  }, [submittedAttempts]);

  const avgAccuracy = submittedAttempts.length
    ? Math.round((submittedAttempts.reduce((s, a) => s + (a.accuracy ?? 0), 0) / submittedAttempts.length) * 100)
    : 0;

  function attemptCountFor(testId: string) {
    return attempts.filter((a) => a.testId === testId && (a.status === 'submitted' || a.status === 'auto-submitted')).length;
  }

  function inProgressFor(testId: string) {
    return attempts.find((a) => a.testId === testId && a.status === 'in-progress');
  }

  if (loading) return <LoadingState label="Loading dashboard…" />;
  if (error) return <ErrorState message={error} />;

  return (
    <div className="p-8 max-w-5xl mx-auto">
      <h1 className="text-2xl font-bold text-ink-700 mb-6">Dashboard</h1>

      <div className="grid grid-cols-3 gap-4 mb-8">
        <Card><div className="text-ink-400 text-xs mb-1">Tests attempted</div><div className="text-ink-700 text-2xl font-bold">{submittedAttempts.length}</div></Card>
        <Card><div className="text-ink-400 text-xs mb-1">Average accuracy</div><div className="text-ink-700 text-2xl font-bold">{avgAccuracy}%</div></Card>
        <Card><div className="text-ink-400 text-xs mb-1">Assigned tests</div><div className="text-ink-700 text-2xl font-bold">{assignedTests.length}</div></Card>
      </div>

      {trendData.length > 1 && (
        <Card className="mb-8">
          <h2 className="text-ink-700 font-semibold mb-3 text-sm">Score trend</h2>
          <ResponsiveContainer width="100%" height={220}>
            <LineChart data={trendData}>
              <CartesianGrid stroke="#dde3ea" strokeDasharray="3 3" />
              <XAxis dataKey="name" stroke="#8995a6" fontSize={11} />
              <YAxis stroke="#8995a6" fontSize={11} />
              <Tooltip contentStyle={{ background: '#ffffff', border: '1px solid #dde3ea' }} />
              <Line type="monotone" dataKey="score" stroke="#1f6fd6" strokeWidth={2} dot={{ r: 3 }} />
            </LineChart>
          </ResponsiveContainer>
        </Card>
      )}

      <h2 className="text-ink-700 font-semibold mb-3">Assigned tests</h2>
      {assignedTests.length === 0 && <EmptyState message="No tests currently assigned." />}
      <div className="space-y-3 mb-8">
        {assignedTests.map((t) => {
          const count = attemptCountFor(t.id);
          const inProgress = inProgressFor(t.id);
          const limitReached = t.maxAttempts > 0 && count >= t.maxAttempts;
          return (
            <Card key={t.id} className="flex items-center justify-between">
              <div>
                <div className="flex items-center gap-2 mb-1">
                  <h3 className="text-ink-700 font-medium">{t.name}</h3>
                  <Badge color="amber">{t.type}</Badge>
                </div>
                <p className="text-ink-400 text-sm">{Math.round(t.totalDurationSeconds / 60)} min · {count} attempt(s) so far</p>
              </div>
              {inProgress ? (
                <Button onClick={() => navigate(`/student/tests/${t.id}/attempt`)}>Resume</Button>
              ) : limitReached ? (
                <Badge color="red">Attempt limit reached</Badge>
              ) : (
                <Button onClick={() => navigate(`/student/tests/${t.id}/attempt`)}>Start</Button>
              )}
            </Card>
          );
        })}
      </div>

      <h2 className="text-ink-700 font-semibold mb-3">Recent attempts</h2>
      {submittedAttempts.length === 0 && <EmptyState message="No attempts yet." />}
      <div className="space-y-2">
        {submittedAttempts.slice(-5).reverse().map((a) => {
          const t = tests.find((x) => x.id === a.testId);
          return (
            <Card key={a.id} className="flex items-center justify-between">
              <div>
                <div className="text-ink-700 text-sm font-medium">{t?.name ?? 'Unknown test'}</div>
                <div className="text-ink-400 text-xs">{a.submittedAt ? new Date(a.submittedAt).toLocaleString() : ''}</div>
              </div>
              <div className="flex items-center gap-3">
                <span className="text-ink-700 font-semibold">{a.score ?? 0} / {a.maxScore ?? 0}</span>
                <Button variant="secondary" onClick={() => navigate(`/student/attempts/${a.id}`)}>Review</Button>
              </div>
            </Card>
          );
        })}
      </div>
    </div>
  );
}
