import { useEffect, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { useAuth } from '@/context/AuthContext';
import { fetchStudentsFile } from '@/api/studentsRepo';
import type { Student } from '@/types/student';

export default function LoginPage() {
  const { credentials, setSession } = useAuth();
  const navigate = useNavigate();

  const [students, setStudents] = useState<Student[]>([]);
  const [mentorName, setMentorName] = useState('Mentor');
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    if (!credentials) {
      navigate('/setup');
      return;
    }
    fetchStudentsFile(credentials)
      .then((file) => {
        setStudents(file.students.filter((s) => s.isActive));
        setMentorName(file.mentor.name);
      })
      .catch((e) => setError(e instanceof Error ? e.message : 'Failed to load students.'))
      .finally(() => setLoading(false));
  }, [credentials, navigate]);

  function chooseMentor() {
    setSession({ role: 'mentor' });
    navigate('/mentor');
  }

  function chooseStudent(student: Student) {
    setSession({ role: 'student', studentId: student.id, studentName: student.name });
    navigate('/student');
  }

  return (
    <div className="min-h-screen bg-ink-50 flex items-center justify-center px-4">
      <div className="w-full max-w-md">
        <h1 className="text-2xl font-bold text-ink-700 text-center mb-1">CAT Mentor Portal</h1>
        <p className="text-ink-500 text-center text-sm mb-8">Who's using the app right now?</p>

        {loading && <p className="text-ink-400 text-center">Loading…</p>}
        {error && <p className="text-red-600 text-center text-sm">{error}</p>}

        {!loading && !error && (
          <div className="space-y-3">
            <button
              onClick={chooseMentor}
              className="w-full bg-white hover:bg-ink-100 border border-ink-600 rounded-lg px-5 py-4 text-left transition-colors"
            >
              <div className="text-ink-700 font-semibold">{mentorName}</div>
              <div className="text-ink-400 text-sm">Mentor</div>
            </button>

            <div className="text-ink-500 text-xs uppercase tracking-wide pt-2 pb-1">Students</div>

            {students.length === 0 && (
              <p className="text-ink-500 text-sm">No students added yet. Ask your mentor to add you.</p>
            )}

            {students.map((s) => (
              <button
                key={s.id}
                onClick={() => chooseStudent(s)}
                className="w-full bg-white hover:bg-ink-100 border border-ink-600 rounded-lg px-5 py-4 text-left transition-colors"
              >
                <div className="text-ink-700 font-medium">{s.name}</div>
              </button>
            ))}
          </div>
        )}

        <button
          onClick={() => navigate('/setup')}
          className="w-full text-ink-400 hover:text-ink-700 text-xs mt-8 text-center"
        >
          Change GitHub connection settings
        </button>
      </div>
    </div>
  );
}
