import type { ButtonHTMLAttributes, InputHTMLAttributes, ReactNode, SelectHTMLAttributes } from 'react';
import { cx } from '@/lib/format';

export function Button({
  variant = 'solid',
  className,
  children,
  ...props
}: ButtonHTMLAttributes<HTMLButtonElement> & { variant?: 'solid' | 'ghost' | 'quiet' }) {
  return (
    <button
      {...props}
      className={cx(
        'inline-flex items-center justify-center gap-2 rounded-full px-5 py-2.5 text-sm text-white',
        'transition-transform hover:scale-105 active:scale-95 disabled:pointer-events-none disabled:opacity-40',
        variant === 'solid' && 'liquid-glass-strong',
        variant === 'ghost' && 'liquid-glass text-white/70',
        variant === 'quiet' && 'text-white/60 hover:text-white',
        className,
      )}
    >
      {children}
    </button>
  );
}

export function Panel({
  className,
  children,
  strong,
}: {
  className?: string;
  children: ReactNode;
  strong?: boolean;
}) {
  return (
    <div
      className={cx(
        strong ? 'liquid-glass-strong' : 'liquid-glass glass-panel',
        'rounded-[1.1rem] p-6',
        className,
      )}
    >
      {children}
    </div>
  );
}

export function StatCard({
  label,
  value,
  sub,
  suffix,
}: {
  label: string;
  value: ReactNode;
  sub?: ReactNode;
  suffix?: ReactNode;
}) {
  return (
    <Panel className="p-[22px]">
      <div className="eyebrow mb-2.5">{label}</div>
      <div className="flex items-baseline gap-1.5">
        <span className="text-[2rem] font-medium leading-none tracking-tight">{value}</span>
        {suffix ? <span className="text-sm text-white/40">{suffix}</span> : null}
      </div>
      {sub ? <div className="mt-2 text-xs text-white/50">{sub}</div> : null}
    </Panel>
  );
}

export function Meter({ value, max, label }: { value: number; max: number; label?: string }) {
  const pct = max === 0 ? 0 : Math.min(100, Math.round((value / max) * 100));
  return (
    <div>
      {label ? (
        <div className="mb-1.5 flex justify-between text-xs text-white/60">
          <span>{label}</span>
          <span className="text-white/40">{pct}%</span>
        </div>
      ) : null}
      <div className="h-1.5 overflow-hidden rounded-full bg-white/10">
        <div
          className="h-full rounded-full bg-white/70 transition-[width] duration-500"
          style={{ width: `${pct}%` }}
        />
      </div>
    </div>
  );
}

export function Field({
  label,
  hint,
  className,
  ...props
}: InputHTMLAttributes<HTMLInputElement> & { label: string; hint?: string }) {
  return (
    <label className={cx('block', className)}>
      <span className="mb-1.5 block text-xs text-white/55">{label}</span>
      <input {...props} className="glass-input" />
      {hint ? <span className="mt-1 block text-[0.7rem] text-white/35">{hint}</span> : null}
    </label>
  );
}

export function Select({
  label,
  children,
  className,
  ...props
}: SelectHTMLAttributes<HTMLSelectElement> & { label: string }) {
  return (
    <label className={cx('block', className)}>
      <span className="mb-1.5 block text-xs text-white/55">{label}</span>
      <select {...props} className="glass-input appearance-none [&>option]:bg-[#141415]">
        {children}
      </select>
    </label>
  );
}

export function Empty({ title, hint, action }: { title: string; hint?: string; action?: ReactNode }) {
  return (
    <div className="liquid-glass rounded-[1.1rem] px-6 py-12 text-center">
      <p className="text-sm text-white/70">{title}</p>
      {hint ? <p className="mx-auto mt-1.5 max-w-md text-xs text-white/40">{hint}</p> : null}
      {action ? <div className="mt-5 flex justify-center">{action}</div> : null}
    </div>
  );
}

export function Loading({ label = 'Loading' }: { label?: string }) {
  return (
    <div className="flex items-center gap-3 px-1 py-12 text-sm text-white/45">
      <span className="h-3 w-3 animate-spin rounded-full border border-white/25 border-t-white/80" />
      {label}
    </div>
  );
}

export function ErrorNote({ message }: { message: string }) {
  return (
    <div className="liquid-glass rounded-xl px-4 py-3 text-sm text-white/80" role="alert">
      {message}
    </div>
  );
}

const STATUS_TONE: Record<string, string> = {
  attending: 'bg-white/85 text-black',
  completed: 'bg-white/85 text-black',
  paid: 'bg-white/85 text-black',
  finance_approved: 'bg-white/85 text-black',
  maybe: 'bg-white/30 text-white',
  in_progress: 'bg-white/30 text-white',
  part_paid: 'bg-white/30 text-white',
  awaiting_approval: 'bg-white/30 text-white',
  declined: 'bg-white/10 text-white/55',
  blocked: 'bg-white/10 text-white/55',
  rejected: 'bg-white/10 text-white/55',
};

export function StatusTag({ status, children }: { status: string; children: ReactNode }) {
  return (
    <span
      className={cx(
        'inline-flex items-center rounded-full px-2.5 py-1 text-[0.68rem] font-medium',
        STATUS_TONE[status] ?? 'bg-white/[0.08] text-white/50',
      )}
    >
      {children}
    </span>
  );
}
