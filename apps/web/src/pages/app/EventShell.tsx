import { NavLink, Outlet, useParams, Link } from 'react-router-dom';
import { useQuery } from '@tanstack/react-query';
import {
  CalendarRange,
  CreditCard,
  Gauge,
  Images,
  LayoutGrid,
  ListChecks,
  LogOut,
  MessageSquare,
  Radio,
  Settings2,
  Ticket,
  UsersRound,
  UtensilsCrossed,
} from 'lucide-react';
import { Ambient } from '@/components/Ambient';
import { Loading } from '@/components/ui';
import { api } from '@/lib/api';
import { useAuth } from '@/lib/auth';
import { cx, shortDate } from '@/lib/format';
import type { EventDetail } from '@/lib/types';

const NAV = [
  { to: '', label: 'Command Centre', Icon: Gauge, end: true },
  { to: 'phases', label: 'Phases', Icon: LayoutGrid },
  { to: 'guests', label: 'Guests & RSVP', Icon: UsersRound },
  { to: 'seating', label: 'Seating', Icon: CalendarRange },
  { to: 'menu', label: 'Menu', Icon: UtensilsCrossed },
  { to: 'tasks', label: 'Tasks & Teams', Icon: ListChecks },
  { to: 'budget', label: 'Budget & Invoices', Icon: CreditCard },
  { to: 'comms', label: 'Polls & Comms', Icon: MessageSquare },
  { to: 'media', label: 'Photos & Video', Icon: Images },
  { to: 'ticketing', label: 'Ticketing', Icon: Ticket },
  { to: 'run-of-show', label: 'Run of Show', Icon: Radio },
  { to: 'settings', label: 'Settings', Icon: Settings2 },
];

export function useEvent() {
  const { eventId } = useParams<{ eventId: string }>();
  return useQuery({
    queryKey: ['event', eventId],
    queryFn: () => api.get<EventDetail>(`/events/${eventId}`),
    enabled: Boolean(eventId),
  });
}

export function EventShell() {
  const { eventId } = useParams<{ eventId: string }>();
  const { logout, user } = useAuth();
  const { data: event, isLoading, error } = useEvent();

  return (
    <>
      <Ambient />
      <div className="relative z-10 flex min-h-screen">
        <aside className="liquid-glass-strong sticky top-0 hidden h-screen w-[250px] shrink-0 flex-col gap-4 rounded-none p-4 lg:flex">
          <Link to="/app" className="flex items-center gap-2.5 px-2.5 pb-4 pt-2">
            <img src="/logo.svg" alt="" width={30} height={30} />
            <span className="text-xl font-semibold tracking-tighter">Evyent</span>
          </Link>

          <div className="liquid-glass rounded-2xl px-3.5 py-3">
            <div className="text-[0.62rem] uppercase tracking-[0.12em] text-white/45">
              Master event
            </div>
            <div className="mt-1 truncate text-sm font-medium">{event?.name ?? 'Loading'}</div>
            {event?.startDate ? (
              <div className="mt-0.5 text-[0.68rem] text-white/45">{shortDate(event.startDate)}</div>
            ) : null}
          </div>

          <nav className="liquid-glass flex flex-1 flex-col gap-0.5 overflow-y-auto rounded-2xl p-1.5">
            {NAV.map(({ to, label, Icon, end }) => (
              <NavLink
                key={label}
                to={to === '' ? `/app/${eventId}` : `/app/${eventId}/${to}`}
                end={end}
                className={({ isActive }) =>
                  cx(
                    'flex items-center gap-2.5 rounded-xl px-3.5 py-2.5 text-[0.83rem] transition',
                    isActive
                      ? 'bg-white/[0.09] text-white'
                      : 'text-white/60 hover:bg-white/[0.05] hover:text-white',
                  )
                }
              >
                <Icon className="h-4 w-4 shrink-0 opacity-70" />
                {label}
              </NavLink>
            ))}
          </nav>

          <div className="liquid-glass rounded-2xl px-3.5 py-3">
            <div className="truncate text-xs text-white/70">{user?.name}</div>
            <div className="mt-0.5 truncate text-[0.68rem] text-white/40">
              {event ? `Role: ${event.role}` : ''}
            </div>
            <button
              type="button"
              onClick={logout}
              className="mt-2.5 flex items-center gap-1.5 text-[0.7rem] text-white/50 transition hover:text-white"
            >
              <LogOut className="h-3 w-3" />
              Sign out
            </button>
          </div>
        </aside>

        <main className="min-w-0 flex-1 px-5 pb-16 pt-6 lg:px-8">
          {isLoading ? <Loading label="Loading event" /> : null}
          {error ? (
            <div className="liquid-glass rounded-2xl p-6 text-sm text-white/70">
              {error instanceof Error ? error.message : 'Could not load this event'}
            </div>
          ) : null}
          {event ? <Outlet context={event} /> : null}
        </main>
      </div>
    </>
  );
}
