import { useEffect, useMemo, useState } from 'react';
import { useQuery } from '@tanstack/react-query';
import { Clock } from 'lucide-react';
import { PageHeader } from '@/components/PageHeader';
import { PhasePicker } from '@/components/PhasePicker';
import { Empty, Loading, Panel } from '@/components/ui';
import { api } from '@/lib/api';
import { useEventContext } from '@/hooks/useEventContext';
import { cx, shortDate } from '@/lib/format';
import type { Phase, ScheduleItem } from '@/lib/types';

interface PhaseDetail extends Phase {
  scheduleItems: ScheduleItem[];
}

/** Parses "18:30" into minutes since midnight. Returns null for junk. */
function toMinutes(value: string): number | null {
  const match = /^(\d{1,2}):(\d{2})$/.exec(value.trim());
  if (!match) return null;
  return Number(match[1]) * 60 + Number(match[2]);
}

export function RunOfShow() {
  const event = useEventContext();
  const [phaseId, setPhaseId] = useState<string | null>(null);
  const [now, setNow] = useState(() => new Date());

  // The control room is a live view: tick once a minute.
  useEffect(() => {
    const timer = window.setInterval(() => setNow(new Date()), 60_000);
    return () => window.clearInterval(timer);
  }, []);

  const phases = useQuery({
    queryKey: ['phases', event.id],
    queryFn: () => api.get<Phase[]>(`/events/${event.id}/phases`),
  });

  useEffect(() => {
    if (!phaseId && phases.data && phases.data.length > 0) setPhaseId(phases.data[0]!.id);
  }, [phaseId, phases.data]);

  const detail = useQuery({
    queryKey: ['phase-detail', phaseId],
    queryFn: () => api.get<PhaseDetail>(`/events/${event.id}/phases/${phaseId}`),
    enabled: Boolean(phaseId),
  });

  const nowMinutes = now.getHours() * 60 + now.getMinutes();

  const items = useMemo(() => {
    const list = detail.data?.scheduleItems ?? [];
    return [...list].sort((a, b) => (toMinutes(a.startTime) ?? 0) - (toMinutes(b.startTime) ?? 0));
  }, [detail.data]);

  /** The item happening now is the last one whose start time has passed. */
  const currentIndex = useMemo(() => {
    let index = -1;
    items.forEach((item, i) => {
      const start = toMinutes(item.startTime);
      if (start !== null && start <= nowMinutes) index = i;
    });
    return index;
  }, [items, nowMinutes]);

  if (phases.isLoading) return <Loading label="Loading run of show" />;

  const phase = detail.data;

  return (
    <>
      <PageHeader
        title="Run of Show"
        sub={
          phase
            ? `${phase.name} - ${shortDate(phase.date)} - ${phase.venue || 'venue TBC'}`
            : 'Live event-day control'
        }
        actions={
          <span className="liquid-glass flex items-center gap-2 rounded-full px-4 py-2 text-xs text-white/70">
            <Clock className="h-3.5 w-3.5" />
            {now.toLocaleTimeString('en-NZ', { hour: '2-digit', minute: '2-digit' })}
          </span>
        }
      />

      <PhasePicker phases={phases.data ?? []} activeId={phaseId} onChange={setPhaseId} />

      {detail.isLoading ? <Loading /> : null}

      {phase && items.length === 0 ? (
        <Empty
          title="No run sheet for this phase yet"
          hint="Add schedule items to the phase and they appear here on the day."
        />
      ) : null}

      {items.length > 0 ? (
        <Panel>
          <ol className="space-y-1">
            {items.map((item, index) => {
              const isNow = index === currentIndex;
              const isDone = index < currentIndex;
              return (
                <li
                  key={item.id}
                  className={cx(
                    'flex items-center gap-4 rounded-xl px-4 py-3.5 transition',
                    isNow && 'liquid-glass',
                  )}
                >
                  <span
                    className={cx(
                      'w-16 shrink-0 font-mono text-sm tabular-nums',
                      isDone ? 'text-white/25' : isNow ? 'text-white' : 'text-white/60',
                    )}
                  >
                    {item.startTime}
                  </span>

                  <span
                    aria-hidden
                    className={cx(
                      'h-2 w-2 shrink-0 rounded-full',
                      isNow ? 'bg-white' : isDone ? 'bg-white/20' : 'bg-white/[0.12]',
                    )}
                  />

                  <div className="min-w-0 flex-1">
                    <p
                      className={cx(
                        'truncate text-sm',
                        isDone ? 'text-white/35' : isNow ? 'text-white' : 'text-white/75',
                      )}
                    >
                      {item.title}
                    </p>
                    {item.ownerTeam || item.location ? (
                      <p className="truncate text-[0.66rem] text-white/35">
                        {[item.ownerTeam, item.location].filter(Boolean).join(' - ')}
                      </p>
                    ) : null}
                  </div>

                  {isNow ? (
                    <span className="shrink-0 rounded-full bg-white/85 px-2.5 py-1 text-[0.62rem] font-medium text-black">
                      Now
                    </span>
                  ) : isDone ? (
                    <span className="shrink-0 text-[0.66rem] text-white/25">Done</span>
                  ) : null}
                </li>
              );
            })}
          </ol>
        </Panel>
      ) : null}
    </>
  );
}
