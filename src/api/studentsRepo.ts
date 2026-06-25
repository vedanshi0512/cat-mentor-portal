import { getJsonFile } from './githubClient';
import { updateJsonFileWithRetry } from './optimisticUpdate';
import type { AppCredentials } from '@/types/auth';
import type { Student, StudentsFile } from '@/types/student';

const STUDENTS_PATH = 'data/students.json';

function defaultStudentsFile(): StudentsFile {
  return { version: 1, students: [], mentor: { id: 'mentor', name: 'Mentor' } };
}

export async function fetchStudentsFile(creds: AppCredentials): Promise<StudentsFile> {
  const result = await getJsonFile<StudentsFile>(creds, STUDENTS_PATH);
  return result?.data ?? defaultStudentsFile();
}

export async function addStudent(creds: AppCredentials, student: Student): Promise<Student[]> {
  const result = await updateJsonFileWithRetry(
    creds,
    STUDENTS_PATH,
    defaultStudentsFile(),
    (current) => {
      const next = structuredClone(current);
      if (!next.students.find((s) => s.id === student.id)) {
        next.students.push(student);
      }
      return next;
    },
    `Add student ${student.name}`
  );
  return result.students;
}

export async function updateStudent(creds: AppCredentials, student: Student): Promise<Student[]> {
  const result = await updateJsonFileWithRetry(
    creds,
    STUDENTS_PATH,
    defaultStudentsFile(),
    (current) => {
      const next = structuredClone(current);
      const idx = next.students.findIndex((s) => s.id === student.id);
      if (idx >= 0) next.students[idx] = student;
      return next;
    },
    `Update student ${student.name}`
  );
  return result.students;
}

export async function setMentorName(creds: AppCredentials, name: string): Promise<void> {
  await updateJsonFileWithRetry(
    creds,
    STUDENTS_PATH,
    defaultStudentsFile(),
    (current) => ({ ...current, mentor: { ...current.mentor, name } }),
    `Update mentor name`
  );
}
