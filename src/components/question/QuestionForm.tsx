import { useState } from 'react';
import { v4 as uuidv4 } from 'uuid';
import { Upload, X, Loader2 } from 'lucide-react';
import type { Question, QuestionType, Subject, Difficulty, MCQOption, QuestionImage } from '@/types/question';
import type { AppCredentials } from '@/types/auth';
import { Button } from '@/components/common/UI';
import { uploadQuestionImage } from '@/api/imageUploadRepo';
import { resolveImageUrl } from '@/utils/imageUrl';

const SUBJECTS: Subject[] = ['VARC', 'DILR', 'QA'];
const DIFFICULTIES: Difficulty[] = ['Easy', 'Medium', 'Hard'];

export default function QuestionForm({
  initial,
  topicsBySubject,
  mentorId,
  credentials,
  onSave,
  onCancel,
}: {
  initial?: Question;
  topicsBySubject: Record<Subject, string[]>;
  mentorId: string;
  credentials: AppCredentials;
  onSave: (q: Question) => void;
  onCancel: () => void;
}) {
  const [type, setType] = useState<QuestionType>(initial?.type ?? 'MCQ');
  const [subject, setSubject] = useState<Subject>(initial?.subject ?? 'QA');
  const [topic, setTopic] = useState(initial?.topic ?? topicsBySubject[subject]?.[0] ?? '');
  const [difficulty, setDifficulty] = useState<Difficulty>(initial?.difficulty ?? 'Medium');
  const [questionText, setQuestionText] = useState(initial?.questionText ?? '');
  const [images, setImages] = useState<QuestionImage[]>(initial?.images ?? []);
  const [uploadingImage, setUploadingImage] = useState(false);
  const [imageError, setImageError] = useState<string | null>(null);
  const [options, setOptions] = useState<MCQOption[]>(
    initial?.options ?? [
      { id: 'A', text: '' },
      { id: 'B', text: '' },
      { id: 'C', text: '' },
      { id: 'D', text: '' },
    ]
  );
  const [correctOptionId, setCorrectOptionId] = useState(initial?.correctOptionId ?? 'A');
  const [correctAnswerText, setCorrectAnswerText] = useState(initial?.correctAnswerText ?? '');
  const [explanation, setExplanation] = useState(initial?.explanation ?? '');
  const [tags, setTags] = useState((initial?.tags ?? []).join(', '));
  const [estimatedSolveTimeSeconds, setEstimatedSolveTimeSeconds] = useState(
    initial?.estimatedSolveTimeSeconds ?? 120
  );
  const [error, setError] = useState<string | null>(null);

  function handleOptionChange(id: string, text: string) {
    setOptions((prev) => prev.map((o) => (o.id === id ? { ...o, text } : o)));
  }

  async function handleImageUpload(e: React.ChangeEvent<HTMLInputElement>) {
    const file = e.target.files?.[0];
    e.target.value = ''; // allow re-selecting the same file again later
    if (!file) return;

    setImageError(null);
    setUploadingImage(true);
    try {
      const path = await uploadQuestionImage(credentials, file);
      setImages((prev) => [...prev, { url: path, alt: file.name }]);
    } catch (err) {
      setImageError(err instanceof Error ? err.message : 'Failed to upload image.');
    } finally {
      setUploadingImage(false);
    }
  }

  function removeImage(url: string) {
    setImages((prev) => prev.filter((img) => img.url !== url));
  }

  function handleSubmit(e: React.FormEvent) {
    e.preventDefault();

    if (!questionText.trim()) return setError('Question text is required.');
    if (type === 'MCQ' && options.some((o) => !o.text.trim())) {
      return setError('All MCQ options must have text.');
    }
    if (type === 'TITA' && !correctAnswerText.trim()) {
      return setError('Correct answer is required for TITA questions.');
    }
    if (!topic) return setError('Topic is required.');

    const now = new Date().toISOString();
    const question: Question = {
      id: initial?.id ?? uuidv4(),
      type,
      subject,
      topic,
      difficulty,
      questionText: questionText.trim(),
      images: images.length > 0 ? images : undefined,
      options: type === 'MCQ' ? options : undefined,
      correctOptionId: type === 'MCQ' ? correctOptionId : undefined,
      correctAnswerText: type === 'TITA' ? correctAnswerText.trim() : undefined,
      explanation: explanation.trim(),
      tags: tags.split(',').map((t) => t.trim()).filter(Boolean),
      estimatedSolveTimeSeconds,
      createdBy: initial?.createdBy ?? mentorId,
      createdAt: initial?.createdAt ?? now,
      updatedAt: now,
    };

    onSave(question);
  }

  const topicsForSubject = topicsBySubject[subject] ?? [];

  return (
    <form onSubmit={handleSubmit} className="space-y-4">
      <div className="grid grid-cols-3 gap-3">
        <SelectField label="Type" value={type} onChange={(v) => setType(v as QuestionType)} options={['MCQ', 'TITA']} />
        <SelectField
          label="Subject"
          value={subject}
          onChange={(v) => {
            setSubject(v as Subject);
            setTopic(topicsBySubject[v as Subject]?.[0] ?? '');
          }}
          options={SUBJECTS}
        />
        <SelectField label="Difficulty" value={difficulty} onChange={(v) => setDifficulty(v as Difficulty)} options={DIFFICULTIES} />
      </div>

      <label className="block">
        <span className="text-sm text-ink-500 mb-1 block">Topic</span>
        <input
          list="topic-options"
          value={topic}
          onChange={(e) => setTopic(e.target.value)}
          placeholder="Type or pick a topic"
          className="w-full bg-white border border-ink-600 rounded-md px-3 py-2 text-ink-700 text-sm focus:outline-none focus:ring-2 focus:ring-catblue-500"
        />
        <datalist id="topic-options">
          {topicsForSubject.map((t) => <option key={t} value={t} />)}
        </datalist>
      </label>

      <TextAreaField label="Question text" value={questionText} onChange={setQuestionText} rows={4} />

      <div>
        <span className="text-sm text-ink-500 mb-1.5 block">
          Images (e.g. a screenshot of a figure/table from a PDF source)
        </span>

        {images.length > 0 && (
          <div className="flex flex-wrap gap-2 mb-2">
            {images.map((img) => (
              <div key={img.url} className="relative group">
                <img
                  src={resolveImageUrl(img.url, credentials)}
                  alt={img.alt}
                  className="h-20 w-auto rounded-md border border-ink-300 object-cover"
                />
                <button
                  type="button"
                  onClick={() => removeImage(img.url)}
                  className="absolute -top-1.5 -right-1.5 bg-white border border-ink-300 rounded-full p-0.5 text-ink-500 hover:text-red-600 hover:border-red-300 shadow-sm"
                  title="Remove image"
                >
                  <X size={12} />
                </button>
              </div>
            ))}
          </div>
        )}

        <label className="inline-flex items-center gap-2 px-3 py-2 border border-ink-300 rounded-md text-sm text-ink-600 hover:bg-ink-100 cursor-pointer w-fit">
          {uploadingImage ? <Loader2 size={15} className="animate-spin" /> : <Upload size={15} />}
          {uploadingImage ? 'Uploading…' : 'Upload image'}
          <input type="file" accept="image/*" onChange={handleImageUpload} disabled={uploadingImage} className="hidden" />
        </label>
        {imageError && <p className="text-red-600 text-xs mt-1.5">{imageError}</p>}
        <p className="text-ink-400 text-xs mt-1.5">
          Up to 3MB. The image is committed to the data repo right away, separately from the rest of this form.
        </p>
      </div>

      {type === 'MCQ' && (
        <div className="space-y-2">
          <span className="text-sm text-ink-500">Options</span>
          {options.map((opt) => (
            <div key={opt.id} className="flex items-center gap-2">
              <input
                type="radio"
                name="correctOption"
                checked={correctOptionId === opt.id}
                onChange={() => setCorrectOptionId(opt.id)}
                title="Mark as correct answer"
              />
              <span className="text-ink-400 text-sm w-5">{opt.id}</span>
              <input
                value={opt.text}
                onChange={(e) => handleOptionChange(opt.id, e.target.value)}
                placeholder={`Option ${opt.id}`}
                className="flex-1 bg-white border border-ink-600 rounded-md px-3 py-1.5 text-ink-700 text-sm focus:outline-none focus:ring-2 focus:ring-catblue-500"
              />
            </div>
          ))}
          <p className="text-xs text-ink-500">Select the radio button next to the correct option.</p>
        </div>
      )}

      {type === 'TITA' && (
        <TextField label="Correct answer" value={correctAnswerText} onChange={setCorrectAnswerText} placeholder="e.g. 42 or exact text" />
      )}

      <TextAreaField label="Explanation" value={explanation} onChange={setExplanation} rows={3} />

      <div className="grid grid-cols-2 gap-3">
        <TextField label="Tags (comma separated)" value={tags} onChange={setTags} placeholder="percentages, easy-win" />
        <NumberField
          label="Estimated solve time (seconds)"
          value={estimatedSolveTimeSeconds}
          onChange={setEstimatedSolveTimeSeconds}
        />
      </div>

      {error && <p className="text-red-600 text-sm">{error}</p>}

      <div className="flex justify-end gap-2 pt-2">
        <Button variant="ghost" onClick={onCancel}>Cancel</Button>
        <Button type="submit">{initial ? 'Save changes' : 'Add question'}</Button>
      </div>
    </form>
  );
}

function TextField({ label, value, onChange, placeholder }: { label: string; value: string; onChange: (v: string) => void; placeholder?: string }) {
  return (
    <label className="block">
      <span className="text-sm text-ink-500 mb-1 block">{label}</span>
      <input
        value={value}
        onChange={(e) => onChange(e.target.value)}
        placeholder={placeholder}
        className="w-full bg-white border border-ink-600 rounded-md px-3 py-2 text-ink-700 text-sm focus:outline-none focus:ring-2 focus:ring-catblue-500"
      />
    </label>
  );
}

function NumberField({ label, value, onChange }: { label: string; value: number; onChange: (v: number) => void }) {
  return (
    <label className="block">
      <span className="text-sm text-ink-500 mb-1 block">{label}</span>
      <input
        type="number"
        value={value}
        onChange={(e) => onChange(Number(e.target.value))}
        className="w-full bg-white border border-ink-600 rounded-md px-3 py-2 text-ink-700 text-sm focus:outline-none focus:ring-2 focus:ring-catblue-500"
      />
    </label>
  );
}

function TextAreaField({ label, value, onChange, rows }: { label: string; value: string; onChange: (v: string) => void; rows: number }) {
  return (
    <label className="block">
      <span className="text-sm text-ink-500 mb-1 block">{label}</span>
      <textarea
        value={value}
        onChange={(e) => onChange(e.target.value)}
        rows={rows}
        className="w-full bg-white border border-ink-600 rounded-md px-3 py-2 text-ink-700 text-sm focus:outline-none focus:ring-2 focus:ring-catblue-500"
      />
    </label>
  );
}

function SelectField({ label, value, onChange, options }: { label: string; value: string; onChange: (v: string) => void; options: string[] }) {
  return (
    <label className="block">
      <span className="text-sm text-ink-500 mb-1 block">{label}</span>
      <select
        value={value}
        onChange={(e) => onChange(e.target.value)}
        className="w-full bg-white border border-ink-600 rounded-md px-3 py-2 text-ink-700 text-sm focus:outline-none focus:ring-2 focus:ring-catblue-500"
      >
        {options.map((o) => (
          <option key={o} value={o}>{o}</option>
        ))}
      </select>
    </label>
  );
}
