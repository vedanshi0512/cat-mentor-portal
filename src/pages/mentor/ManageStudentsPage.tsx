import { useEffect, useState } from 'react';
import { Plus } from 'lucide-react';
import { useAuth } from '@/context/AuthContext';
import { fetchStudentsFile, addStudent, updateStudent, setMentorName } from '@/api/studentsRepo';
import type { Student } from '@/types/student';
import { Card, Button, Badge, LoadingState, ErrorState, Modal } from '@/components/common/UI';

function slugify(name: string): string {
  return name.trim().toLowerCase().replace(/[^a-z0-9]+/g, '-').replace(/^-+|-+$/g, '');
}

export default function ManageStudentsPage() {
  const { credentials } = useAuth();
  const [students, setStudents] = useState<Student[]>([]);
  const [mentorName, setMentorNameState] = useState('');
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [showAdd, setShowAdd] = useState(false);
  const [newName, setNewName] = useState('');
  const [newEmail, setNewEmail] = useState('');

  async function load() {
    if (!credentials) return;
    setLoading(true);
    try {
      const file = await fetchStudentsFile(credentials);
      setStudents(file.students);
      setMentorNameState(file.mentor.name);
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Failed to load students.');
    } finally {
      setLoading(false);
    }
  }

  useEffect(() => {
    load();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [credentials]);

  async function handleAddStudent() {
    if (!credentials || !newName.trim()) return;
    const id = slugify(newName);
    if (students.find((s) => s.id === id)) {
      setError('A student with a similar name already exists. Try a more specific name.');
      return;
    }
    const student: Student = { id, name: newName.trim(), email: newEmail.trim() || undefined, joinedAt: new Date().toISOString(), isActive: true };
    try {
      const updated = await addStudent(credentials, student);
      setStudents(updated);
      setShowAdd(false);
      setNewName('');
      setNewEmail('');
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Failed to add student.');
    }
  }

  async function toggleActive(student: Student) {
    if (!credentials) return;
    const updatedStudent = { ...student, isActive: !student.isActive };
    const updated = await updateStudent(credentials, updatedStudent);
    setStudents(updated);
  }

  async function handleMentorNameBlur() {
    if (!credentials || !mentorName.trim()) return;
    await setMentorName(credentials, mentorName.trim());
  }

  if (loading) return <LoadingState label="Loading students…" />;
  if (error) return <ErrorState message={error} onRetry={load} />;

  return (
    <div className="p-8 max-w-3xl mx-auto">
      <h1 className="text-2xl font-bold text-ink-700 mb-6">Manage Students & Roles</h1>

      <Card className="mb-6">
        <label className="block">
          <span className="text-sm text-ink-500 mb-1 block">Mentor display name</span>
          <input
            value={mentorName}
            onChange={(e) => setMentorNameState(e.target.value)}
            onBlur={handleMentorNameBlur}
            className="w-full max-w-sm bg-white border border-ink-600 rounded-md px-3 py-2 text-ink-700 text-sm"
          />
        </label>
      </Card>

      <div className="flex items-center justify-between mb-3">
        <h2 className="text-ink-700 font-semibold">Students</h2>
        <Button onClick={() => setShowAdd(true)}>
          <Plus size={16} className="inline mr-1.5 -mt-0.5" /> Add student
        </Button>
      </div>

      <div className="space-y-2">
        {students.map((s) => (
          <Card key={s.id} className="flex items-center justify-between">
            <div>
              <div className="flex items-center gap-2">
                <span className="text-ink-700 font-medium">{s.name}</span>
                {s.isActive ? <Badge color="green">Active</Badge> : <Badge color="red">Inactive</Badge>}
              </div>
              <div className="text-ink-500 text-xs mt-0.5">{s.email ?? 'No email on file'} · joined {new Date(s.joinedAt).toLocaleDateString()}</div>
            </div>
            <Button variant="secondary" onClick={() => toggleActive(s)}>
              {s.isActive ? 'Deactivate' : 'Reactivate'}
            </Button>
          </Card>
        ))}
      </div>

      <Modal open={showAdd} onClose={() => setShowAdd(false)} title="Add student">
        <div className="space-y-3">
          <label className="block">
            <span className="text-sm text-ink-500 mb-1 block">Name</span>
            <input value={newName} onChange={(e) => setNewName(e.target.value)} className="w-full bg-white border border-ink-600 rounded-md px-3 py-2 text-ink-700 text-sm" />
          </label>
          <label className="block">
            <span className="text-sm text-ink-500 mb-1 block">Email (optional)</span>
            <input value={newEmail} onChange={(e) => setNewEmail(e.target.value)} className="w-full bg-white border border-ink-600 rounded-md px-3 py-2 text-ink-700 text-sm" />
          </label>
          <div className="flex justify-end gap-2">
            <Button variant="ghost" onClick={() => setShowAdd(false)}>Cancel</Button>
            <Button onClick={handleAddStudent}>Add</Button>
          </div>
        </div>
      </Modal>
    </div>
  );
}
