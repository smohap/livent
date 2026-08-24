import { useMemo, useState } from 'react';
import { useParams } from 'react-router-dom';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { Check, Gift, MapPin, Ticket, Users } from 'lucide-react';
import { Ambient } from '@/components/Ambient';
import { Button, ErrorNote, Loading, Panel } from '@/components/ui';
import { api } from '@/lib/api';
import { cx, money, relativeDays, shortDate } from '@/lib/format';

export interface PortalPhase {
  inviteId: string;
  status: string;
  phase: {
    id: string;
    name: string;
    description: string;
    date: string | null;
    startTime: string;
    venue: string;
    address: string;
    dressCode: string;
    requiresMenu: boolean;
    schedule: Array<{ id: string; title: string; startTime: string }>;
    menu: Array<{
      id: string;
      name: string;
      items: Array<{ id: string; name: string; dietary: string; allergens: string }>;
    }>;
  };
}

export interface Portal {
  guest: { id: string; name: string; dietary: string; allergies: string };
  event: { name: string; hostNames: string; slug: string; startDate: string | null; currency: string };
  phases: PortalPhase[];
  seating: Array<{ phaseId: string; phaseName: string; tableNumber: number; tablemates: string[] }>;
  selections: Array<{ itemId: string; courseId: string; phaseId: string; itemName: string }>;
  tickets: Array<{ code: string; type: string; phase: string; status: string }>;
  announcements: Array<{ id: string; body: string; createdAt: string; urgent: boolean }>;
  gifts: Array<{ id: string; amount: number; currency: string; status: string }>;
}

const RESPONSES = [
  { value: 'attending', label: 'Yes' },
  { value: 'maybe', label: 'Maybe' },
  { value: 'declined', label: 'No' },
] as const;

/**
 * The guest's whole event in one page: every phase they were invited to, their
 * table, their meal, their tickets. No account, no install - just their link.
 */
export function GuestPortal({ invitation = false }: { invitation?: boolean }) {
  const { token } = useParams<{ token: string }>();
  const queryClient = useQueryClient();
  const [draft, setDraft] = useState<Record<string, string>>({});

  const portal = useQuery({
    queryKey: ['portal', token],
    queryFn: () => api.get<Portal>(`/public/me/${token}`),
  });

  const rsvp = useMutation({
    mutationFn: (responses: Array<{ phaseId: string; status: string }>) =>
      api.post(`/public/me/${token}/rsvp`, { responses }),
    onSuccess: () => {
      setDraft({});
      queryClient.invalidateQueries({ queryKey: ['portal', token] });
    },
  });

  const chooseMeal = useMutation({
    mutationFn: (itemId: string) => api.post(`/public/me/${token}/menu`, { itemId }),
    onSuccess: () => queryClient.invalidateQueries({ queryKey: ['portal', token] }),
  });

  const data = portal.data;
  const pending = useMemo(() => Object.keys(draft).length > 0, [draft]);

  if (portal.isLoading) {
    return (
      <>
        <Ambient />
        <div className="relative z-10 flex min-h-screen items-center justify-center">
          <Loading label="Opening your invitation" />
        </div>
      </>
    );
  }

  if (portal.error || !data) {
    return (
      <>
        <Ambient />
        <main className="relative z-10 mx-auto max-w-lg px-6 py-24">
          <ErrorNote message="This invitation link is not valid. Please check with your host." />
        </main>
      </>
    );
  }

  const firstName = data.guest.name.split(' ')[0];
  const nextPhase = data.phases.find((p) => p.status === 'attending' && p.phase.date);

  return (
    <>
      <Ambient />
      <main className="relative z-10 mx-auto min-h-screen w-full max-w-2xl px-5 py-12">
        <header>
          <p className="text-sm text-white/50">{invitation ? 'You are invited' : `Hi ${firstName}`}</p>
          <h1 className="mt-2 text-4xl leading-tight tracking-[-0.04em]">
            {data.event.hostNames || data.event.name}
          </h1>
          <p className="mt-2 font-serif text-base italic text-white/60">{data.event.name}</p>
          <p className="mt-4 text-sm text-white/45">{shortDate(data.event.startDate)}</p>
        </header>

        {nextPhase ? (
          <Panel className="mt-8" strong>
            <p className="eyebrow">Next up for you</p>
            <h2 className="mt-2 text-2xl tracking-tight">{nextPhase.phase.name}</h2>
            <p className="mt-1 text-sm text-white/55">
              {shortDate(nextPhase.phase.date)}
              {nextPhase.phase.startTime ? ` at ${nextPhase.phase.startTime}` : ''}
            </p>
            {nextPhase.phase.venue ? (
              <p className="mt-3 flex items-center gap-1.5 text-xs text-white/45">
                <MapPin className="h-3 w-3" />
                {nextPhase.phase.venue}
              </p>
            ) : null}
          </Panel>
        ) : null}

        <section className="mt-8">
          <h2 className="eyebrow mb-4">Your celebrations</h2>
          <div className="space-y-3">
            {data.phases.map((entry) => (
              <PhaseCard
                key={entry.inviteId}
                entry={entry}
                portal={data}
                chosen={draft[entry.phase.id] ?? entry.status}
                onRespond={(status) => setDraft({ ...draft, [entry.phase.id]: status })}
                onChooseMeal={(itemId) => chooseMeal.mutate(itemId)}
              />
            ))}
          </div>

          {rsvp.error ? (
            <div className="mt-4">
              <ErrorNote message={rsvp.error instanceof Error ? rsvp.error.message : 'Could not save'} />
            </div>
          ) : null}

          <div className="mt-5 flex flex-wrap items-center gap-3">
            <Button
              disabled={!pending || rsvp.isPending}
              onClick={() =>
                rsvp.mutate(Object.entries(draft).map(([phaseId, status]) => ({ phaseId, status })))
              }
            >
              <Check className="h-3.5 w-3.5" />
              {rsvp.isPending ? 'Sending...' : 'Send my RSVP'}
            </Button>
            {rsvp.isSuccess && !pending ? (
              <span className="text-xs text-white/45">Thank you, your host has been told.</span>
            ) : null}
          </div>
        </section>

        <GuestExtras portal={data} token={token!} />

        <footer className="mt-14 text-center text-[0.68rem] uppercase tracking-[0.2em] text-white/25">
          Powered by livent
        </footer>
      </main>
    </>
  );
}

function PhaseCard({
  entry,
  portal,
  chosen,
  onRespond,
  onChooseMeal,
}: {
  entry: PortalPhase;
  portal: Portal;
  chosen: string;
  onRespond: (status: string) => void;
  onChooseMeal: (itemId: string) => void;
}) {
  const seat = portal.seating.find((s) => s.phaseId === entry.phase.id);
  const attending = entry.status === 'attending';

  return (
    <Panel>
      <div className="flex flex-wrap items-baseline justify-between gap-2">
        <h3 className="text-lg tracking-tight">{entry.phase.name}</h3>
        <span className="text-xs text-white/45">
          {shortDate(entry.phase.date)}
          {entry.phase.startTime ? ` - ${entry.phase.startTime}` : ''}
        </span>
      </div>

      {entry.phase.venue ? <p className="mt-1.5 text-xs text-white/45">{entry.phase.venue}</p> : null}
      {entry.phase.dressCode ? (
        <p className="mt-0.5 text-xs text-white/35">Dress code: {entry.phase.dressCode}</p>
      ) : null}

      <div className="mt-4 flex gap-2">
        {RESPONSES.map((option) => (
          <button
            key={option.value}
            type="button"
            onClick={() => onRespond(option.value)}
            className={cx(
              'flex-1 rounded-full px-4 py-2.5 text-sm transition',
              chosen === option.value ? 'bg-white/85 text-black' : 'liquid-glass text-white/65',
            )}
          >
            {option.label}
          </button>
        ))}
      </div>

      {seat ? (
        <div className="liquid-glass mt-4 rounded-xl px-4 py-3">
          <p className="flex items-center gap-1.5 text-sm text-white/85">
            <Users className="h-3.5 w-3.5 text-white/50" />
            Your table: {seat.tableNumber}
          </p>
          {seat.tablemates.length > 0 ? (
            <p className="mt-1 text-[0.68rem] leading-relaxed text-white/40">
              With {seat.tablemates.slice(0, 6).join(', ')}
              {seat.tablemates.length > 6 ? ` and ${seat.tablemates.length - 6} more` : ''}
            </p>
          ) : null}
        </div>
      ) : null}

      {attending && entry.phase.requiresMenu && entry.phase.menu.length > 0 ? (
        <div className="mt-5 border-t border-white/[0.07] pt-4">
          <p className="eyebrow mb-3">Choose your meal</p>
          <div className="space-y-4">
            {entry.phase.menu.map((course) => (
              <div key={course.id}>
                <p className="mb-2 text-xs text-white/55">{course.name}</p>
                <div className="grid gap-2 sm:grid-cols-2">
                  {course.items.map((item) => {
                    const picked = portal.selections.some((s) => s.itemId === item.id);
                    return (
                      <button
                        key={item.id}
                        type="button"
                        onClick={() => onChooseMeal(item.id)}
                        className={cx(
                          'rounded-xl px-4 py-3 text-left text-sm transition',
                          picked ? 'bg-white/85 text-black' : 'liquid-glass text-white/70',
                        )}
                      >
                        <span className="block">{item.name}</span>
                        {item.dietary || item.allergens ? (
                          <span
                            className={cx(
                              'mt-0.5 block text-[0.64rem]',
                              picked ? 'text-black/55' : 'text-white/35',
                            )}
                          >
                            {[item.dietary, item.allergens ? `contains ${item.allergens}` : '']
                              .filter(Boolean)
                              .join(' - ')}
                          </span>
                        ) : null}
                      </button>
                    );
                  })}
                </div>
              </div>
            ))}
          </div>
        </div>
      ) : null}

      {entry.phase.schedule.length > 0 && attending ? (
        <ol className="mt-5 space-y-1.5 border-t border-white/[0.07] pt-4">
          {entry.phase.schedule.map((item) => (
            <li key={item.id} className="flex gap-4 text-xs">
              <span className="w-12 shrink-0 font-mono tabular-nums text-white/40">{item.startTime}</span>
              <span className="text-white/60">{item.title}</span>
            </li>
          ))}
        </ol>
      ) : null}
    </Panel>
  );
}

function GuestExtras({ portal, token }: { portal: Portal; token: string }) {
  return (
    <>
      {portal.tickets.length > 0 ? (
        <section className="mt-10">
          <h2 className="eyebrow mb-4">Your tickets</h2>
          <div className="grid gap-2.5 sm:grid-cols-2">
            {portal.tickets.map((ticket) => (
              <Panel key={ticket.code} className="p-4">
                <div className="flex items-start justify-between gap-3">
                  <div className="min-w-0">
                    <p className="text-sm">{ticket.type}</p>
                    <p className="mt-0.5 text-[0.66rem] text-white/40">{ticket.phase}</p>
                  </div>
                  <Ticket className="h-4 w-4 shrink-0 text-white/30" />
                </div>
                <code className="mt-3 block truncate rounded-lg bg-white/[0.06] px-3 py-2 text-[0.66rem] text-white/55">
                  {ticket.code}
                </code>
                {ticket.status === 'checked_in' ? (
                  <p className="mt-2 text-[0.66rem] text-white/40">Checked in</p>
                ) : null}
              </Panel>
            ))}
          </div>
        </section>
      ) : null}

      {portal.announcements.length > 0 ? (
        <section className="mt-10">
          <h2 className="eyebrow mb-4">From your hosts</h2>
          <div className="space-y-2.5">
            {portal.announcements.slice(0, 5).map((item) => (
              <Panel key={item.id} className="p-4">
                <p className="text-sm leading-relaxed text-white/75">{item.body}</p>
                <p className="mt-1.5 text-[0.64rem] text-white/35">
                  {relativeDays(item.createdAt)}
                  {item.urgent ? ' - important' : ''}
                </p>
              </Panel>
            ))}
          </div>
        </section>
      ) : null}

      <GiftPanel portal={portal} token={token} />
    </>
  );
}

function GiftPanel({ portal, token }: { portal: Portal; token: string }) {
  const queryClient = useQueryClient();
  const [amount, setAmount] = useState(100);
  const [message, setMessage] = useState('');
  const [anonymous, setAnonymous] = useState(false);

  const send = useMutation({
    mutationFn: () =>
      api.post(`/public/me/${token}/gift`, { amount, message, anonymous, showAmount: false }),
    onSuccess: () => queryClient.invalidateQueries({ queryKey: ['portal', token] }),
  });

  return (
    <section className="mt-10">
      <h2 className="eyebrow mb-4">Send a gift</h2>
      <Panel>
        <p className="text-sm leading-relaxed text-white/60">
          A monetary gift to {portal.event.hostNames || 'your hosts'}. Payment is handled by a
          licensed provider; livent never sees your card details.
        </p>

        <div className="mt-5 flex flex-wrap gap-2">
          {[50, 100, 200, 500].map((option) => (
            <button
              key={option}
              type="button"
              onClick={() => setAmount(option)}
              className={cx(
                'rounded-full px-4 py-2 text-sm transition',
                amount === option ? 'bg-white/85 text-black' : 'liquid-glass text-white/65',
              )}
            >
              {money(option, portal.event.currency)}
            </button>
          ))}
        </div>

        <textarea
          value={message}
          onChange={(e) => setMessage(e.target.value)}
          rows={2}
          aria-label="Message to the hosts"
          placeholder="Congratulations! Wishing you both a lifetime of happiness."
          className="glass-input mt-4 resize-none"
        />

        <button
          type="button"
          onClick={() => setAnonymous(!anonymous)}
          className={cx(
            'mt-3 rounded-full px-3.5 py-1.5 text-xs transition',
            anonymous ? 'bg-white/85 text-black' : 'liquid-glass text-white/60',
          )}
        >
          Give anonymously
        </button>

        {send.error ? (
          <div className="mt-4">
            <ErrorNote message={send.error instanceof Error ? send.error.message : 'Could not send'} />
          </div>
        ) : null}

        <div className="mt-5 flex flex-wrap items-center gap-3">
          <Button onClick={() => send.mutate()} disabled={send.isPending}>
            <Gift className="h-3.5 w-3.5" />
            {send.isPending ? 'Sending...' : `Send ${money(amount, portal.event.currency)}`}
          </Button>
          {send.isSuccess ? (
            <span className="text-xs text-white/45">
              Recorded. You will be taken to payment to complete it.
            </span>
          ) : null}
        </div>

        {portal.gifts && portal.gifts.length > 0 ? (
          <p className="mt-4 text-xs text-white/35">
            You have already sent {portal.gifts.length} gift
            {portal.gifts.length === 1 ? '' : 's'} to this event.
          </p>
        ) : null}
      </Panel>
    </section>
  );
}
