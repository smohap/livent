import { useQuery } from '@tanstack/react-query';
import { Link } from 'react-router-dom';
import { AlertTriangle, Info, TriangleAlert } from 'lucide-react';
import { PageHeader } from '@/components/PageHeader';
import { Button, Loading, Meter, Panel, StatCard } from '@/components/ui';
import { api } from '@/lib/api';
import { useEventContext } from '@/hooks/useEventContext';
import { dayMonth, moneyShort, money } from '@/lib/format';
import type { EventHealth } from '@/lib/types';

const SEVERITY_ICON = {
  critical: AlertTriangle,
  warn: TriangleAlert,
  info: Info,
} as const;

export function Dashboard() {
  const event = useEventContext();
  const { data, isLoading } = useQuery({
    queryKey: ['health', event.id],
    queryFn: () => api.get<EventHealth>(`/events/${event.id}/health`),
  });

  if (isLoading || !data) return <Loading label="Reading event health" />;

  const { guests, finance, tasks, tickets, gifts, menuSplit, phases, alerts } = data;

  return (
    <>
      <PageHeader
        title="Event Command Centre"
        sub={`Health across all ${phases.length} phases`}
        actions={
          <>
            <Button variant="ghost" onClick={() => window.print()}>
              Export report
            </Button>
            <Link to={`/app/${event.id}/phases`}>
              <Button>New phase</Button>
            </Link>
          </>
        }
      />

      <div className="grid gap-4 sm:grid-cols-2 xl:grid-cols-4">
        <StatCard
          label="Guests"
          value={guests.invited.toLocaleString()}
          sub={`${guests.attending.toLocaleString()} attending - ${guests.pending} awaiting reply`}
        />
        <StatCard label="RSVP rate" value={`${guests.rsvpRate}%`} sub="Across every phase" />
        <StatCard
          label="Budget"
          value={moneyShort(finance.budget, event.currency)}
          sub={`${moneyShort(finance.committed, event.currency)} committed - ${moneyShort(finance.paid, event.currency)} paid`}
        />
        <StatCard
          label="Tasks"
          value={tasks.completed}
          suffix={`/ ${tasks.total}`}
          sub={tasks.overdue > 0 ? `${tasks.overdue} overdue` : 'Nothing overdue'}
        />
      </div>

      <div className="mt-4 grid gap-4 lg:grid-cols-3">
        <Panel className="lg:col-span-2">
          <h2 className="mb-4 text-base">Needs attention</h2>
          {alerts.length === 0 ? (
            <p className="py-6 text-sm text-white/45">
              Nothing needs your attention right now. Rare and lovely.
            </p>
          ) : (
            <ul className="space-y-2.5">
              {alerts.map((alert, index) => {
                const Icon = SEVERITY_ICON[alert.severity];
                return (
                  <li
                    key={`${alert.title}-${index}`}
                    className="liquid-glass flex items-start gap-3 rounded-xl px-4 py-3"
                  >
                    <Icon
                      className={
                        alert.severity === 'critical'
                          ? 'mt-0.5 h-4 w-4 shrink-0 text-white'
                          : 'mt-0.5 h-4 w-4 shrink-0 text-white/50'
                      }
                    />
                    <div className="min-w-0">
                      <p className="text-sm text-white/85">{alert.title}</p>
                      <p className="mt-0.5 text-xs text-white/40">{alert.context}</p>
                    </div>
                  </li>
                );
              })}
            </ul>
          )}
        </Panel>

        <Panel>
          <h2 className="mb-1 text-base">Menu split</h2>
          <p className="mb-4 text-xs text-white/40">Across confirmed meal selections</p>
          {menuSplit.length === 0 ? (
            <p className="text-sm text-white/45">No meal selections yet.</p>
          ) : (
            <div className="space-y-3.5">
              {menuSplit.slice(0, 5).map((row) => (
                <Meter
                  key={row.label}
                  value={row.pct}
                  max={100}
                  label={`${row.label} - ${row.count}`}
                />
              ))}
            </div>
          )}

          <div className="mt-6 space-y-2.5 border-t border-white/[0.07] pt-5 text-xs">
            <div className="flex justify-between text-white/60">
              <span>Tickets issued</span>
              <span className="text-white/85">{tickets.issued.toLocaleString()}</span>
            </div>
            <div className="flex justify-between text-white/60">
              <span>Checked in</span>
              <span className="text-white/85">{tickets.checkedIn.toLocaleString()}</span>
            </div>
            <div className="flex justify-between text-white/60">
              <span>Gifts received</span>
              <span className="text-white/85">
                {money(gifts.total, event.currency)} - {gifts.count}
              </span>
            </div>
          </div>
        </Panel>
      </div>

      <Panel className="mt-4">
        <h2 className="mb-4 text-base">Phases</h2>
        <div className="grid gap-3 sm:grid-cols-2 xl:grid-cols-5">
          {phases.map((phase) => (
            <Link key={phase.id} to={`/app/${event.id}/phases`} className="group">
              <div className="liquid-glass h-full rounded-xl p-4 transition-transform group-hover:scale-[1.02]">
                <div className="text-sm">{phase.name}</div>
                <div className="mt-0.5 text-[0.68rem] text-white/40">
                  {dayMonth(phase.date)}
                  {phase.venue ? ` - ${phase.venue.split(',')[0]}` : ''}
                </div>
                <div className="mt-3.5">
                  <Meter value={phase.rsvpRate} max={100} />
                </div>
                <div className="mt-2 text-[0.68rem] text-white/50">
                  {phase.rsvpRate}% RSVP - {phase.attending} attending
                </div>
              </div>
            </Link>
          ))}
        </div>
      </Panel>
    </>
  );
}
