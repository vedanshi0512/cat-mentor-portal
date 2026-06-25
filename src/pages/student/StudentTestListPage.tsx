import { useEffect, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { useAuth } from '@/context/AuthContext';
import { fetchAllTests } from '@/api/testsRepo';
import { fetchStudentAttempts } from '@/api/attemptsRepo';
import type { Test } from '@/types/test';
import type { Attempt } from '@/types/attempt';
import { Card, Badge, Button, LoadingState, ErrorState, EmptyState } from '@/components/common/UI';

export default function StudentTestListPage() {
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
      .then(([t, a]) => { setTests(t.filter((x) => x.isPublished)); setAttempts(a); })
      .catch((e) => setError(e instanceof Error ? e.message : 'Failed to load tests.'))
      .finally(() => setLoading(false));
  }, [credentials, studentId]);

  if (loading) return <LoadingState label="Loading tests…" />;
  if (error) return <ErrorState message={error} />;
  if (tests.length === 0) return <div className="p-8"><EmptyState message="No tests available yet." /></div>;

  const now = Date.now();

  return (
    <div className="p-8 max-w-5xl mx-auto">
      <h1 className="text-2xl font-bold text-ink-700 mb-6">All Tests</h1>
      <div className="space-y-3">
        {tests.map((t) => {
          const isAvailable = new Date(t.availableFrom).getTime() <= now && new Date(t.availableUntil).getTime() >= now;
          const count = attempts.filter((a) => a.testId === t.id && a.status !== 'in-progress').length;
          const inProgress = attempts.find((a) => a.testId === t.id && a.status === 'in-progress');
          const limitReached = t.maxAttempts > 0 && count >= t.maxAttempts;

          return (
            <Card key={t.id} className="flex items-center justify-between">
              <div>
                <div className="flex items-center gap-2 mb-1">
                  <h3 className="text-ink-700 font-medium">{t.name}</h3>
                  <Badge color="amber">{t.type}</Badge>
                  {!isAvailable && <Badge color="red">Not available</Badge>}
                </div>
                <p className="text-ink-400 text-sm">{Math.round(t.totalDurationSeconds / 60)} min · {count} attempt(s)</p>
              </div>
              {inProgress ? (
                <Button onClick={() => navigate(`/student/tests/${t.id}/attempt`)}>Resume</Button>
              ) : !isAvailable || limitReached ? (
                <Badge color="red">{limitReached ? 'Attempt limit reached' : 'Unavailable'}</Badge>
              ) : (
                <Button onClick={() => navigate(`/student/tests/${t.id}/attempt`)}>Start</Button>
              )}
            </Card>
          );
        })}
      </div>
    </div>
  );
}
