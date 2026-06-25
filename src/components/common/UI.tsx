import type { ReactNode } from 'react';
import clsx from 'clsx';

export function Card({ children, className }: { children: ReactNode; className?: string }) {
  return (
    <div className={clsx('bg-white border border-ink-200 rounded-xl p-5', className)}>
      {children}
    </div>
  );
}

export function Button({
  children,
  onClick,
  variant = 'primary',
  type = 'button',
  disabled,
  className,
}: {
  children: ReactNode;
  onClick?: () => void;
  variant?: 'primary' | 'secondary' | 'danger' | 'ghost';
  type?: 'button' | 'submit';
  disabled?: boolean;
  className?: string;
}) {
  const variants: Record<string, string> = {
    primary: 'bg-catblue-500 hover:bg-catblue-600 text-white',
    secondary: 'bg-white hover:bg-ink-100 text-ink-700 border border-ink-300',
    danger: 'bg-red-50 hover:bg-red-100 text-red-700 border border-red-200',
    ghost: 'bg-transparent hover:bg-ink-100 text-ink-600',
  };
  return (
    <button
      type={type}
      onClick={onClick}
      disabled={disabled}
      className={clsx(
        'px-4 py-2 rounded-md text-sm font-medium transition-colors disabled:opacity-50 disabled:cursor-not-allowed',
        variants[variant],
        className
      )}
    >
      {children}
    </button>
  );
}

export function Badge({
  children,
  color = 'default',
}: {
  children: ReactNode;
  color?: 'default' | 'green' | 'red' | 'purple' | 'amber';
}) {
  const colors: Record<string, string> = {
    default: 'bg-ink-100 text-ink-600',
    green: 'bg-green-50 text-green-700',
    red: 'bg-red-50 text-red-700',
    purple: 'bg-purple-50 text-purple-700',
    amber: 'bg-amber-50 text-amber-700',
  };
  return (
    <span className={clsx('text-xs font-medium px-2 py-0.5 rounded-full', colors[color])}>
      {children}
    </span>
  );
}

export function LoadingState({ label = 'Loading…' }: { label?: string }) {
  return (
    <div className="flex items-center justify-center py-16 text-ink-400 text-sm">{label}</div>
  );
}

export function ErrorState({ message, onRetry }: { message: string; onRetry?: () => void }) {
  return (
    <div className="flex flex-col items-center justify-center py-16 gap-3">
      <p className="text-red-600 text-sm max-w-md text-center">{message}</p>
      {onRetry && <Button onClick={onRetry}>Retry</Button>}
    </div>
  );
}

export function EmptyState({ message }: { message: string }) {
  return <div className="text-center py-16 text-ink-500 text-sm">{message}</div>;
}

export function Modal({
  open,
  onClose,
  title,
  children,
}: {
  open: boolean;
  onClose: () => void;
  title: string;
  children: ReactNode;
}) {
  if (!open) return null;
  return (
    <div className="fixed inset-0 bg-black/60 flex items-center justify-center z-50 px-4" onClick={onClose}>
      <div
        className="bg-white border border-ink-200 rounded-xl p-6 w-full max-w-lg max-h-[85vh] overflow-y-auto"
        onClick={(e) => e.stopPropagation()}
      >
        <div className="flex items-center justify-between mb-4">
          <h2 className="text-ink-700 font-semibold text-lg">{title}</h2>
          <button onClick={onClose} className="text-ink-400 hover:text-ink-700">✕</button>
        </div>
        {children}
      </div>
    </div>
  );
}
