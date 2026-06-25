import clsx from 'clsx';
import type { QuestionState } from '@/types/attempt';

const STATE_STYLES: Record<QuestionState, string> = {
  'not-visited': 'bg-white text-ink-700 border-ink-300',
  visited: 'bg-palette-visited text-white border-palette-visited',
  answered: 'bg-palette-answered text-white border-palette-answered',
  'marked-for-review': 'bg-palette-marked text-white border-palette-marked',
  'answered-marked-for-review': 'bg-palette-markedanswered text-white border-palette-markedanswered relative',
};

export default function QuestionPalette({
  questionNumbers,
  states,
  currentIndex,
  onSelect,
}: {
  questionNumbers: number[]; // 1-indexed display numbers, same length/order as states
  states: QuestionState[];
  currentIndex: number;
  onSelect: (index: number) => void;
}) {
  return (
    <div className="grid grid-cols-5 gap-2">
      {questionNumbers.map((num, idx) => (
        <button
          key={num}
          onClick={() => onSelect(idx)}
          className={clsx(
            'w-9 h-9 rounded-md border text-sm font-semibold flex items-center justify-center transition-transform',
            STATE_STYLES[states[idx]],
            idx === currentIndex && 'ring-2 ring-catblue-500 ring-offset-2 ring-offset-white scale-105'
          )}
        >
          {num}
          {states[idx] === 'answered-marked-for-review' && (
            <span className="absolute -top-1 -right-1 w-2.5 h-2.5 bg-green-400 rounded-full border border-white" />
          )}
        </button>
      ))}
    </div>
  );
}

export function PaletteLegend() {
  const items: { label: string; style: string }[] = [
    { label: 'Not visited', style: 'bg-white border border-ink-300' },
    { label: 'Visited, not answered', style: 'bg-palette-visited' },
    { label: 'Answered', style: 'bg-palette-answered' },
    { label: 'Marked for review', style: 'bg-palette-marked' },
    { label: 'Answered & marked', style: 'bg-palette-markedanswered' },
  ];
  return (
    <div className="space-y-1.5 text-xs text-ink-500">
      {items.map((item) => (
        <div key={item.label} className="flex items-center gap-2">
          <span className={clsx('w-3.5 h-3.5 rounded-sm', item.style)} />
          {item.label}
        </div>
      ))}
    </div>
  );
}
