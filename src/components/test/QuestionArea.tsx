import type { Question } from '@/types/question';
import type { AppCredentials } from '@/types/auth';
import { resolveImageUrl } from '@/utils/imageUrl';

export default function QuestionArea({
  question,
  selectedOptionId,
  enteredAnswer,
  credentials,
  onSelectOption,
  onAnswerChange,
}: {
  question: Question;
  selectedOptionId?: string;
  enteredAnswer?: string;
  credentials: AppCredentials;
  onSelectOption: (optionId: string) => void;
  onAnswerChange: (value: string) => void;
}) {
  return (
    <div className="flex-1 min-h-0 overflow-y-auto px-8 py-6">
      <div className="max-w-2xl">
        <p className="text-ink-700 text-base leading-relaxed whitespace-pre-wrap">{question.questionText}</p>

        {question.images && question.images.length > 0 && (
          <div className="mt-4 space-y-3">
            {question.images.map((img, i) => (
              <img key={i} src={resolveImageUrl(img.url, credentials)} alt={img.alt} className="max-w-full rounded-md border border-ink-200" />
            ))}
          </div>
        )}

        <div className="mt-8">
          {question.type === 'MCQ' ? (
            <div className="space-y-3">
              {question.options?.map((opt) => (
                <label
                  key={opt.id}
                  className="flex items-start gap-3 p-3 rounded-md border border-ink-200 hover:border-ink-500 cursor-pointer transition-colors"
                >
                  <input
                    type="radio"
                    name={`q-${question.id}`}
                    checked={selectedOptionId === opt.id}
                    onChange={() => onSelectOption(opt.id)}
                    className="mt-1"
                  />
                  <span className="text-ink-700 text-sm">
                    <span className="text-ink-400 font-medium mr-2">{opt.id}.</span>
                    {opt.text}
                  </span>
                </label>
              ))}
            </div>
          ) : (
            <div>
              <label className="block text-ink-500 text-sm mb-2">Enter your answer</label>
              <input
                value={enteredAnswer ?? ''}
                onChange={(e) => onAnswerChange(e.target.value)}
                placeholder="Type your answer"
                className="w-full max-w-xs bg-white border border-ink-600 rounded-md px-3 py-2 text-ink-700 focus:outline-none focus:ring-2 focus:ring-catblue-500"
              />
              <p className="text-ink-500 text-xs mt-2">This is a TITA (Type In The Answer) question — no options to choose from.</p>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
