import { cx } from '@/lib/format';
import type { Phase } from '@/lib/types';

/** The phase rail. Every phase-scoped screen picks its context from here. */
export function PhasePicker({
  phases,
  activeId,
  onChange,
}: {
  phases: Phase[];
  activeId: string | null;
  onChange: (phaseId: string) => void;
}) {
  if (phases.length === 0) return null;

  return (
    <div className="mb-4 flex flex-wrap gap-2" role="tablist" aria-label="Phases">
      {phases.map((phase) => (
        <button
          key={phase.id}
          type="button"
          role="tab"
          aria-selected={phase.id === activeId}
          onClick={() => onChange(phase.id)}
          className={cx(
            'rounded-full px-4 py-2 text-xs transition',
            phase.id === activeId ? 'bg-white/85 text-black' : 'liquid-glass text-white/65 hover:text-white',
          )}
        >
          {phase.name}
        </button>
      ))}
    </div>
  );
}
