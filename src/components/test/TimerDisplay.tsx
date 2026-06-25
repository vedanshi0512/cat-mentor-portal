import clsx from 'clsx';

export default function TimerDisplay({ seconds, label }: { seconds: number; label: string }) {
  const isCritical = seconds <= 60;
  const isWarning = seconds <= 300 && !isCritical;

  const m = Math.floor(Math.max(0, seconds) / 60);
  const s = Math.max(0, seconds) % 60;

  return (
    <div className="text-right">
      <div className="text-ink-400 text-xs">{label}</div>
      <div
        className={clsx(
          'font-mono text-xl font-bold tabular-nums',
          isCritical ? 'text-red-600 animate-pulse' : isWarning ? 'text-amber-600' : 'text-ink-700'
        )}
      >
        {String(m).padStart(2, '0')}:{String(s).padStart(2, '0')}
      </div>
    </div>
  );
}
