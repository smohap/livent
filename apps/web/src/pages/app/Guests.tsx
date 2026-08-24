import { useMemo, useState } from 'react';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { Copy, Search, Star } from 'lucide-react';
import { PageHeader } from '@/components/PageHeader';
import { Button, ErrorNote, Field, Loading, Panel, Select } from '@/components/ui';
import { api } from '@/lib/api';
import { useEventContext } from '@/hooks/useEventContext';
import { cx, label } from '@/lib/format';
import type { Guest, Phase } from '@/lib/types';

/** The RSVP states an organiser cycles through by clicking a cell. */
const CYCLE = ['invited', 'attending', 'maybe', 'declined', 'removed'] as const;

const DOT: Record<string, string> = {
  attending: 'bg-white',
  maybe: 'bg-white/45',
  declined: 'bg-white/15',
  invited: 'bg-white/25',
  viewed: 'bg-white/30',
  waitlisted: 'bg-white/20',
};

export function Guests() {
  const event = useEventContext();
  const queryClient = useQueryClient();
  const [query, setQuery] = useState('');
  const [groupFilter, setGroupFilter] = useState('all');
  const [statusFilter, setStatusFilter] = useState('all');
  const [adding, setAdding] = useState(false);

  const guests = useQuery({
    queryKey: ['guests', event.id],
    queryFn: () => api.get<Guest[]>(`/events/${event.id}/guests`),
  });
  const phases = useQuery({
    queryKey: ['phases', event.id],
    queryFn: () => api.get<Phase[]>(`/events/${event.id}/phases`),
  });

  const setStatus = useMutation({
    mutationFn: ({ guestId, phaseId, status }: { guestId: string; phaseId: string; status: string }) =>
      api.put(`/events/${event.id}/guests/${guestId}/invites/${phaseId}`, { status }),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['guests', event.id] });
      queryClient.invalidateQueries({ queryKey: ['health', event.id] });
    },
  });

  const filtered = useMemo(() => {
    const list = guests.data ?? [];
    const needle = query.trim().toLowerCase();
    return list.filter((guest) => {
      if (needle && !guest.name.toLowerCase().includes(needle) && !guest.email.toLowerCase().includes(needle))
        return false;
      if (groupFilter !== 'all' && guest.group?.id !== groupFilter) return false;
      if (statusFilter !== 'all' && !guest.invites.some((i) => i.status === statusFilter)) return false;
      return true;
    });
  }, [guests.data, query, groupFilter, statusFilter]);

  if (guests.isLoading || phases.isLoading) return <Loading label="Loading guest list" />;

  const phaseList = phases.data ?? [];

  return (
    <>
      <PageHeader
        title="Guests & RSVP"
        sub={`${(guests.data ?? []).length.toLocaleString()} guests across ${phaseList.length} phases`}
        actions={
          <>
            <Button variant="ghost" onClick={() => exportCsv(filtered, phaseList)}>
              Export CSV
            </Button>
            <Button onClick={() => setAdding(true)}>Add guest</Button>
          </>
        }
      />

      <Panel className="mb-4 p-4">
        <div className="grid gap-3 md:grid-cols-[1fr_200px_200px]">
          <label className="relative block">
            <Search className="pointer-events-none absolute left-3.5 top-1/2 h-3.5 w-3.5 -translate-y-1/2 text-white/35" />
            <input
              value={query}
              onChange={(e) => setQuery(e.target.value)}
              placeholder="Search by name or email"
              aria-label="Search guests"
              className="glass-input pl-9"
            />
          </label>
          <Select label="" aria-label="Filter by group" value={groupFilter} onChange={(e) => setGroupFilter(e.target.value)}>
            <option value="all">All groups</option>
            {event.groups.map((group) => (
              <option key={group.id} value={group.id}>
                {group.name}
              </option>
            ))}
          </Select>
          <Select label="" aria-label="Filter by status" value={statusFilter} onChange={(e) => setStatusFilter(e.target.value)}>
            <option value="all">Any status</option>
            {['attending', 'maybe', 'declined', 'invited', 'viewed'].map((status) => (
              <option key={status} value={status}>
                {label(status)}
              </option>
            ))}
          </Select>
        </div>
      </Panel>

      <Panel className="overflow-x-auto p-0">
        <table className="w-full min-w-[820px] text-sm">
          <thead>
            <tr>
              <th className="sticky left-0 z-10 bg-[#111112] px-5 py-3 text-left text-[0.68rem] uppercase tracking-wider text-white/45">
                Guest
              </th>
              <th className="px-4 py-3 text-left text-[0.68rem] uppercase tracking-wider text-white/45">Group</th>
              {phaseList.map((phase) => (
                <th key={phase.id} className="px-3 py-3 text-left text-[0.68rem] uppercase tracking-wider text-white/45">
                  {phase.name}
                </th>
              ))}
              <th className="px-4 py-3 text-left text-[0.68rem] uppercase tracking-wider text-white/45">Link</th>
            </tr>
          </thead>
          <tbody>
            {filtered.slice(0, 300).map((guest) => (
              <GuestRow
                key={guest.id}
                guest={guest}
                phases={phaseList}
                onCycle={(phaseId, status) => setStatus.mutate({ guestId: guest.id, phaseId, status })}
              />
            ))}
          </tbody>
        </table>
        {filtered.length > 300 ? (
          <p className="px-5 py-3 text-xs text-white/40">
            Showing the first 300 of {filtered.length.toLocaleString()} matches. Narrow the filters to see more.
          </p>
        ) : null}
      </Panel>

      {adding ? <AddGuestDialog eventId={event.id} phases={phaseList} onClose={() => setAdding(false)} /> : null}
    </>
  );
}

function GuestRow({
  guest,
  phases,
  onCycle,
}: {
  guest: Guest;
  phases: Phase[];
  onCycle: (phaseId: string, status: string) => void;
}) {
  return (
    <tr className="border-t border-white/[0.05]">
      <td className="sticky left-0 z-10 bg-[#111112] px-5 py-3">
        <div className="flex items-center gap-2">
          {guest.isVip ? <Star className="h-3 w-3 shrink-0 text-white/70" aria-label="VIP" /> : null}
          <span className="text-white/85">{guest.name}</span>
        </div>
        {guest.dietary ? <div className="mt-0.5 text-[0.66rem] text-white/35">{guest.dietary}</div> : null}
      </td>
      <td className="px-4 py-3 text-xs text-white/50">{guest.group?.name ?? '-'}</td>
      {phases.map((phase) => {
        const status = guest.invites.find((i) => i.phaseId === phase.id)?.status;
        return (
          <td key={phase.id} className="px-3 py-3">
            <button
              type="button"
              title={status ? `${label(status)} - click to change` : 'Not invited - click to invite'}
              onClick={() => {
                const current = status ? CYCLE.indexOf(status as (typeof CYCLE)[number]) : -1;
                onCycle(phase.id, CYCLE[(current + 1) % CYCLE.length]!);
              }}
              className="flex items-center gap-1.5 text-xs text-white/60 transition hover:text-white"
            >
              <span className={cx('h-2 w-2 rounded-full', status ? DOT[status] : 'bg-white/[0.08]')} />
              {status ? label(status) : 'Not invited'}
            </button>
          </td>
        );
      })}
      <td className="px-4 py-3">
        <CopyLink token={guest.accessToken} />
      </td>
    </tr>
  );
}

function CopyLink({ token }: { token: string }) {
  const [copied, setCopied] = useState(false);
  const url = `${window.location.origin}/i/${token}`;

  return (
    <button
      type="button"
      onClick={() => {
        void navigator.clipboard.writeText(url);
        setCopied(true);
        window.setTimeout(() => setCopied(false), 1600);
      }}
      className="flex items-center gap-1.5 text-[0.7rem] text-white/45 transition hover:text-white"
      title="Copy this guest's personalised invitation link"
    >
      <Copy className="h-3 w-3" />
      {copied ? 'Copied' : 'Invite link'}
    </button>
  );
}

/** Exports the RSVP matrix exactly as it appears on screen. */
function exportCsv(guests: Guest[], phases: Phase[]) {
  const header = ['Name', 'Email', 'Group', 'VIP', 'Dietary', ...phases.map((p) => p.name)];
  const escape = (value: string) => `"${value.replace(/"/g, '""')}"`;

  const rows = guests.map((guest) => [
    guest.name,
    guest.email,
    guest.group?.name ?? '',
    guest.isVip ? 'Yes' : '',
    guest.dietary,
    ...phases.map((phase) => {
      const status = guest.invites.find((i) => i.phaseId === phase.id)?.status;
      return status ? label(status) : 'Not invited';
    }),
  ]);

  const csv = [header, ...rows].map((row) => row.map((cell) => escape(String(cell))).join(',')).join('\n');
  const url = URL.createObjectURL(new Blob([csv], { type: 'text/csv;charset=utf-8' }));
  const link = document.createElement('a');
  link.href = url;
  link.download = 'evyent-guests.csv';
  link.click();
  URL.revokeObjectURL(url);
}

function AddGuestDialog({
  eventId,
  phases,
  onClose,
}: {
  eventId: string;
  phases: Phase[];
  onClose: () => void;
}) {
  const queryClient = useQueryClient();
  const [name, setName] = useState('');
  const [email, setEmail] = useState('');
  const [dietary, setDietary] = useState('');
  const [isVip, setIsVip] = useState(false);
  const [phaseIds, setPhaseIds] = useState<string[]>(phases.map((p) => p.id));

  const create = useMutation({
    mutationFn: () => api.post(`/events/${eventId}/guests`, { name, email, dietary, isVip, phaseIds }),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['guests', eventId] });
      queryClient.invalidateQueries({ queryKey: ['health', eventId] });
      onClose();
    },
  });

  const toggle = (id: string) =>
    setPhaseIds((current) =>
      current.includes(id) ? current.filter((value) => value !== id) : [...current, id],
    );

  return (
    <div
      className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 px-6 backdrop-blur-sm"
      role="dialog"
      aria-modal="true"
      aria-label="Add a guest"
    >
      <div className="liquid-glass-strong w-full max-w-md rounded-[1.4rem] p-8">
        <h2 className="text-xl tracking-tight">
          Add a <em>guest</em>
        </h2>
        <form
          className="mt-5 space-y-4"
          onSubmit={(e) => {
            e.preventDefault();
            create.mutate();
          }}
        >
          <Field label="Name" value={name} onChange={(e) => setName(e.target.value)} required />
          <Field label="Email" type="email" value={email} onChange={(e) => setEmail(e.target.value)} />
          <Field
            label="Dietary tags"
            value={dietary}
            onChange={(e) => setDietary(e.target.value)}
            placeholder="vegetarian, gluten-free"
            hint="Comma separated. Feeds the caterer count."
          />

          <div>
            <span className="mb-2 block text-xs text-white/55">Invite to</span>
            <div className="flex flex-wrap gap-2">
              {phases.map((phase) => (
                <button
                  key={phase.id}
                  type="button"
                  onClick={() => toggle(phase.id)}
                  className={cx(
                    'rounded-full px-3.5 py-1.5 text-xs transition',
                    phaseIds.includes(phase.id) ? 'bg-white/85 text-black' : 'liquid-glass text-white/60',
                  )}
                >
                  {phase.name}
                </button>
              ))}
            </div>
          </div>

          <button
            type="button"
            onClick={() => setIsVip(!isVip)}
            className={cx(
              'rounded-full px-3.5 py-1.5 text-xs transition',
              isVip ? 'bg-white/85 text-black' : 'liquid-glass text-white/60',
            )}
          >
            VIP guest
          </button>

          {create.error ? (
            <ErrorNote message={create.error instanceof Error ? create.error.message : 'Could not add guest'} />
          ) : null}

          <div className="flex justify-end gap-2.5 pt-1">
            <Button type="button" variant="quiet" onClick={onClose}>
              Cancel
            </Button>
            <Button type="submit" disabled={create.isPending}>
              {create.isPending ? 'Adding...' : 'Add guest'}
            </Button>
          </div>
        </form>
      </div>
    </div>
  );
}
