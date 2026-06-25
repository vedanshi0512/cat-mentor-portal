import { useState } from 'react';
import { v4 as uuidv4 } from 'uuid';
import type { Question } from '@/types/question';
import { Button } from '@/components/common/UI';

/**
 * Bulk import accepts a JSON array of question objects (the simplest reliable format
 * for structured fields like MCQ options/correct answers). Each object's missing
 * id/createdAt/updatedAt are filled in automatically.
 */
export default function BulkImportModal({
  mentorId,
  onImport,
}: {
  mentorId: string;
  onImport: (questions: Question[]) => void;
}) {
  const [raw, setRaw] = useState('');
  const [error, setError] = useState<string | null>(null);
  const [preview, setPreview] = useState<Question[] | null>(null);

  function handleParse() {
    setError(null);
    try {
      const parsed = JSON.parse(raw);
      if (!Array.isArray(parsed)) throw new Error('Input must be a JSON array of questions.');

      const now = new Date().toISOString();
      const questions: Question[] = parsed.map((item: Partial<Question>) => {
        if (!item.questionText || !item.subject || !item.topic || !item.type) {
          throw new Error('Each question needs at least: type, subject, topic, questionText.');
        }
        return {
          id: item.id ?? uuidv4(),
          type: item.type,
          subject: item.subject,
          topic: item.topic,
          difficulty: item.difficulty ?? 'Medium',
          questionText: item.questionText,
          images: item.images,
          options: item.options,
          correctOptionId: item.correctOptionId,
          correctAnswerText: item.correctAnswerText,
          answerTolerance: item.answerTolerance,
          explanation: item.explanation ?? '',
          tags: item.tags ?? [],
          estimatedSolveTimeSeconds: item.estimatedSolveTimeSeconds ?? 120,
          createdBy: mentorId,
          createdAt: now,
          updatedAt: now,
        };
      });

      setPreview(questions);
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Invalid JSON.');
      setPreview(null);
    }
  }

  return (
    <div className="space-y-3">
      <p className="text-sm text-ink-400">
        Paste a JSON array of questions. Each item needs at minimum: <code>type</code>, <code>subject</code>,{' '}
        <code>topic</code>, <code>questionText</code>. MCQs also need <code>options</code> and{' '}
        <code>correctOptionId</code>; TITA needs <code>correctAnswerText</code>.
      </p>
      <textarea
        value={raw}
        onChange={(e) => setRaw(e.target.value)}
        rows={10}
        placeholder='[{"type": "MCQ", "subject": "QA", "topic": "Arithmetic", "questionText": "...", "options": [...], "correctOptionId": "A"}]'
        className="w-full bg-white border border-ink-600 rounded-md px-3 py-2 text-ink-700 text-xs font-mono focus:outline-none focus:ring-2 focus:ring-catblue-500"
      />
      {error && <p className="text-red-600 text-sm">{error}</p>}
      {preview && (
        <p className="text-green-400 text-sm">{preview.length} question(s) parsed and ready to import.</p>
      )}
      <div className="flex justify-end gap-2">
        <Button variant="secondary" onClick={handleParse}>Validate</Button>
        <Button disabled={!preview} onClick={() => preview && onImport(preview)}>
          Import {preview ? `(${preview.length})` : ''}
        </Button>
      </div>
    </div>
  );
}
