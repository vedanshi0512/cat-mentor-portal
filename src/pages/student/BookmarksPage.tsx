import { useEffect, useMemo, useState } from 'react';
import { v4 as uuidv4 } from 'uuid';
import { Plus, Trash2 } from 'lucide-react';
import { useAuth } from '@/context/AuthContext';
import { fetchAllQuestions } from '@/api/questionsRepo';
import { fetchBookmarks, addBookmarkFolder, removeBookmark } from '@/api/studentDataRepo';
import type { Question } from '@/types/question';
import type { BookmarksFile } from '@/types/student';
import { Card, Badge, Button, LoadingState, ErrorState, EmptyState, Modal } from '@/components/common/UI';

export default function BookmarksPage() {
  const { credentials, session } = useAuth();
  const studentId = session?.role === 'student' ? session.studentId! : '';

  const [questions, setQuestions] = useState<Question[]>([]);
  const [bookmarksFile, setBookmarksFile] = useState<BookmarksFile | null>(null);
  const [activeFolder, setActiveFolder] = useState<string>('revision');
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [showNewFolder, setShowNewFolder] = useState(false);
  const [newFolderName, setNewFolderName] = useState('');

  async function load() {
    if (!credentials || !studentId) return;
    setLoading(true);
    try {
      const [qs, bm] = await Promise.all([fetchAllQuestions(credentials), fetchBookmarks(credentials, studentId)]);
      setQuestions(qs);
      setBookmarksFile(bm);
      if (bm.folders.length > 0 && !bm.folders.find((f) => f.id === activeFolder)) {
        setActiveFolder(bm.folders[0].id);
      }
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Failed to load bookmarks.');
    } finally {
      setLoading(false);
    }
  }

  useEffect(() => {
    load();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [credentials, studentId]);

  const questionById = useMemo(() => new Map(questions.map((q) => [q.id, q])), [questions]);

  const itemsInFolder = bookmarksFile?.bookmarks.filter((b) => b.folderId === activeFolder) ?? [];

  async function handleCreateFolder() {
    if (!credentials || !newFolderName.trim()) return;
    const updated = await addBookmarkFolder(credentials, studentId, {
      id: uuidv4(),
      name: newFolderName.trim(),
      createdAt: new Date().toISOString(),
    });
    setBookmarksFile(updated);
    setNewFolderName('');
    setShowNewFolder(false);
  }

  async function handleRemove(bookmarkId: string) {
    if (!credentials) return;
    const updated = await removeBookmark(credentials, studentId, bookmarkId);
    setBookmarksFile(updated);
  }

  if (loading) return <LoadingState label="Loading bookmarks…" />;
  if (error) return <ErrorState message={error} onRetry={load} />;
  if (!bookmarksFile) return null;

  return (
    <div className="p-8 max-w-5xl mx-auto">
      <div className="flex items-center justify-between mb-6">
        <h1 className="text-2xl font-bold text-ink-700">Bookmarks</h1>
        <Button variant="secondary" onClick={() => setShowNewFolder(true)}>
          <Plus size={16} className="inline mr-1.5 -mt-0.5" /> New folder
        </Button>
      </div>

      <div className="flex gap-2 mb-6 flex-wrap">
        {bookmarksFile.folders.map((f) => {
          const count = bookmarksFile.bookmarks.filter((b) => b.folderId === f.id).length;
          return (
            <button
              key={f.id}
              onClick={() => setActiveFolder(f.id)}
              className={`px-3.5 py-1.5 rounded-full text-sm font-medium transition-colors ${
                activeFolder === f.id ? 'bg-catblue-500 text-white' : 'bg-white text-ink-500 border border-ink-200 hover:bg-ink-100'
              }`}
            >
              {f.name} <span className="opacity-70">({count})</span>
            </button>
          );
        })}
      </div>

      {itemsInFolder.length === 0 && <EmptyState message="No bookmarks in this folder yet." />}

      <div className="space-y-3">
        {itemsInFolder.map((bm) => {
          const q = questionById.get(bm.questionId);
          if (!q) return null;
          return (
            <Card key={bm.id} className="flex items-start justify-between gap-4">
              <div>
                <div className="flex items-center gap-2 mb-1.5">
                  <Badge color="amber">{q.subject}</Badge>
                  <Badge>{q.topic}</Badge>
                </div>
                <p className="text-ink-700 text-sm">{q.questionText}</p>
                {bm.note && <p className="text-ink-400 text-xs mt-1.5 italic">"{bm.note}"</p>}
              </div>
              <button onClick={() => handleRemove(bm.id)} className="p-2 text-ink-400 hover:text-red-600 shrink-0">
                <Trash2 size={15} />
              </button>
            </Card>
          );
        })}
      </div>

      <Modal open={showNewFolder} onClose={() => setShowNewFolder(false)} title="New bookmark folder">
        <div className="space-y-3">
          <input
            value={newFolderName}
            onChange={(e) => setNewFolderName(e.target.value)}
            placeholder="e.g. Formula Revision"
            className="w-full bg-white border border-ink-600 rounded-md px-3 py-2 text-ink-700 text-sm"
          />
          <div className="flex justify-end gap-2">
            <Button variant="ghost" onClick={() => setShowNewFolder(false)}>Cancel</Button>
            <Button onClick={handleCreateFolder}>Create</Button>
          </div>
        </div>
      </Modal>
    </div>
  );
}
