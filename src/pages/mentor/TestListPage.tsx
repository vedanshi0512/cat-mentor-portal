import { useEffect, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { Plus, Pencil, Trash2 } from 'lucide-react';
import { useAuth } from '@/context/AuthContext';
import { fetchAllTests, deleteTest } from '@/api/testsRepo';
import type { Test } from '@/types/test';
import { Button, Card, Badge, LoadingState, ErrorState, EmptyState } from '@/components/common/UI';

export default function TestListPage() {
  const { credentials } = useAuth();
  const navigate = useNavigate();
  const [tests, setTests] = useState<Test[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  async function load() {
    if (!credentials) return;
    setLoading(true);
    setError(null);
    try {
      setTests(await fetchAllTests(credentials));
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Failed to load tests.');
    } finally {
      setLoading(false);
    }
  }

  useEffect(() => {
    load();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [credentials]);

  async function handleDelete(id: string) {
    if (!credentials) return;
    if (!confirm('Delete this test? Existing student attempts will remain but the test will disappear from listings.')) return;
    try {
      setTests(await deleteTest(credentials, id));
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Failed to delete test.');
    }
  }

  return (
    <div className="p-8 max-w-5xl mx-auto">
      <div className="flex items-center justify-between mb-6">
        <h1 className="text-2xl font-bold text-ink-700">Tests</h1>
        <Button onClick={() => navigate('/mentor/tests/new')}>
          <Plus size={16} className="inline mr-1.5 -mt-0.5" /> Create test
        </Button>
      </div>

      {loading && <LoadingState />}
      {error && <ErrorState message={error} onRetry={load} />}
      {!loading && !error && tests.length === 0 && <EmptyState message="No tests created yet." />}

      <div className="space-y-3">
        {tests.map((t) => (
          <Card key={t.id} className="flex items-center justify-between">
            <div>
              <div className="flex items-center gap-2 mb-1">
                <h3 className="text-ink-700 font-medium">{t.name}</h3>
                <Badge color="amber">{t.type}</Badge>
                {t.isPublished ? <Badge color="green">Published</Badge> : <Badge color="red">Draft</Badge>}
              </div>
              <p className="text-ink-400 text-sm">
                {t.sections.length} section(s) · {t.sections.reduce((s, sec) => s + sec.questionIds.length, 0)} questions ·{' '}
                {Math.round(t.totalDurationSeconds / 60)} min
              </p>
            </div>
            <div className="flex gap-1.5">
              <button onClick={() => navigate(`/mentor/tests/${t.id}/edit`)} className="p-2 text-ink-400 hover:text-ink-700 hover:bg-ink-100 rounded-md">
                <Pencil size={15} />
              </button>
              <button onClick={() => handleDelete(t.id)} className="p-2 text-ink-400 hover:text-red-600 hover:bg-ink-100 rounded-md">
                <Trash2 size={15} />
              </button>
            </div>
          </Card>
        ))}
      </div>
    </div>
  );
}
