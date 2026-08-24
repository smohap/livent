import { useState } from 'react';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { MapPin, Trash2 } from 'lucide-react';
import { PageHeader } from '@/components/PageHeader';
import { Button, ErrorNote, Field, Loading, Meter, Panel, Select } from '@/components/ui';
import { api } from '@/lib/api';
import { useEventContext } from '@/hooks/useEventContext';
import { cx, shortDate } from '@/lib/format';
import type { Phase } from '@/lib/types';

export function Phases() {
  const event = useEventContext();
  const queryClient = useQueryClient();
  const [adding, setAdding] = useState(false);
  const [selectedId, setSelectedId] = useState<string | null>(null);

  const phases = useQuery({
    queryKey: ['phases', event.id],
    queryFn: () => api.get<Phase[]>(`/events/${event.id}/phases`),
  });

  const remove = useMutation({
    mutationFn: (phaseId: string) => api.delete(`/events/${event.id}/phases/${phaseId}`),
    onSuccess: () => {
      setSelectedId(null);
      queryClient.invalidateQueries({ queryKey: ['phases', event.id] });
      queryClient.invalidateQueries({ queryKey: ['event', event.id] });
    },
  });

  if (phases.isLoading) return <Loading label="Loading phases" />;

  const list = phases.data ?? [];
  const selected = list.find((p) => p.id === selectedId) ?? list[0] ?? null;

  return (
    <>
      <PageHeader
        title="Phases"
        sub={`One master event, ${list.length} connected celebrations`}
        actions={<Button onClick={() => setAdding(true)}>Add phase</Button>}
      />

      <div className="grid gap-3 sm:grid-cols-2 xl:grid-cols-5">
        {list.map((phase) => (
          <button key={phase.id} type="button" onClick={() => setSelectedId(phase.id)} className="text-left">
            <div
              className={cx(
                'liquid-glass h-full rounded-xl p-4 transition-transform hover:scale-[1.02]',
                selected?.id === phase.id && 'ring-1 ring-white/25',
              )}
            >
              <div className="text-sm">{phase.name}</div>
              <div className="mt-0.5 text-[0.68rem] text-white/40">{shortDate(phase.date)}</div>
              <div className="mt-1 truncate text-[0.68rem] text-white/40">{phase.venue || 'Venue TBC'}</div>
              <div className="mt-3.5">
                <Meter value={phase.rsvpRate ?? 0} max={100} />
              </div>
              <div className="mt-2 text-[0.68rem] text-white/50">
                {phase.rsvpRate ?? 0}% RSVP - {phase.invited ?? 0} invited
              </div>
            </div>
          </button>
        ))}
      </div>

      {selected ? (
        <PhaseDetail
          key={selected.id}
          phase={selected}
          eventId={event.id}
          onDelete={() => remove.mutate(selected.id)}
          deleting={remove.isPending}
        />
      ) : null}

      {adding ? <AddPhaseDialog eventId={event.id} onClose={() => setAdding(false)} /> : null}
    </>
  );
}

const TOGGLES = [
  ['requiresRsvp', 'RSVP required'],
  ['requiresSeating', 'Seating plan'],
  ['requiresMenu', 'Menu selection'],
  ['requiresTicket', 'Ticketed'],
] as const;

function PhaseDetail({
  phase,
  eventId,
  onDelete,
  deleting,
}: {
  phase: Phase;
  eventId: string;
  onDelete: () => void;
  deleting: boolean;
}) {
  const queryClient = useQueryClient();
  const [draft, setDraft] = useState({
    name: phase.name,
    venue: phase.venue,
    address: phase.address,
    dressCode: phase.dressCode,
    startTime: phase.startTime,
    endTime: phase.endTime,
    capacity: phase.capacity,
    description: phase.description,
    date: phase.date ? phase.date.slice(0, 10) : '',
    requiresRsvp: phase.requiresRsvp,
    requiresSeating: phase.requiresSeating,
    requiresMenu: phase.requiresMenu,
    requiresTicket: phase.requiresTicket,
  });

  const save = useMutation({
    mutationFn: () =>
      api.patch(`/events/${eventId}/phases/${phase.id}`, {
        ...draft,
        capacity: Number(draft.capacity) || 0,
        date: draft.date ? new Date(`${draft.date}T00:00:00`).toISOString() : null,
      }),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['phases', eventId] });
      queryClient.invalidateQueries({ queryKey: ['event', eventId] });
    },
  });

  return (
    <Panel className="mt-4">
      <div className="mb-5 flex items-start justify-between gap-4">
        <div>
          <h2 className="text-lg tracking-tight">{phase.name} - overview</h2>
          <p className="mt-0.5 flex items-center gap-1.5 text-xs text-white/45">
            <MapPin className="h-3 w-3" />
            {phase.venue || 'Venue to be confirmed'}
          </p>
        </div>
        <button
          type="button"
          onClick={onDelete}
          disabled={deleting}
          className="flex items-center gap-1.5 text-xs text-white/40 transition hover:text-white disabled:opacity-40"
        >
          <Trash2 className="h-3.5 w-3.5" />
          Delete phase
        </button>
      </div>

      <div className="grid gap-4 md:grid-cols-3">
        <Field label="Phase name" value={draft.name} onChange={(e) => setDraft({ ...draft, name: e.target.value })} />
        <Field label="Date" type="date" value={draft.date} onChange={(e) => setDraft({ ...draft, date: e.target.value })} />
        <Field
          label="Capacity"
          type="number"
          min={0}
          value={draft.capacity}
          onChange={(e) => setDraft({ ...draft, capacity: Number(e.target.value) })}
        />
        <Field label="Starts" value={draft.startTime} placeholder="18:00" onChange={(e) => setDraft({ ...draft, startTime: e.target.value })} />
        <Field label="Ends" value={draft.endTime} placeholder="23:30" onChange={(e) => setDraft({ ...draft, endTime: e.target.value })} />
        <Field label="Dress code" value={draft.dressCode} onChange={(e) => setDraft({ ...draft, dressCode: e.target.value })} />
        <Field className="md:col-span-2" label="Venue" value={draft.venue} onChange={(e) => setDraft({ ...draft, venue: e.target.value })} />
        <Field label="Address" value={draft.address} onChange={(e) => setDraft({ ...draft, address: e.target.value })} />
        <Field
          className="md:col-span-3"
          label="Description shown to guests"
          value={draft.description}
          onChange={(e) => setDraft({ ...draft, description: e.target.value })}
        />
      </div>

      <div className="mt-5 flex flex-wrap gap-2.5">
        {TOGGLES.map(([key, label]) => (
          <button
            key={key}
            type="button"
            onClick={() => setDraft({ ...draft, [key]: !draft[key] })}
            className={cx(
              'rounded-full px-4 py-2 text-xs transition',
              draft[key] ? 'bg-white/85 text-black' : 'liquid-glass text-white/60',
            )}
          >
            {label}
          </button>
        ))}
      </div>

      {save.error ? (
        <div className="mt-4">
          <ErrorNote message={save.error instanceof Error ? save.error.message : 'Could not save'} />
        </div>
      ) : null}

      <div className="mt-5 flex items-center gap-3">
        <Button onClick={() => save.mutate()} disabled={save.isPending}>
          {save.isPending ? 'Saving...' : 'Save phase'}
        </Button>
        {save.isSuccess ? <span className="text-xs text-white/45">Saved</span> : null}
      </div>
    </Panel>
  );
}

function AddPhaseDialog({ eventId, onClose }: { eventId: string; onClose: () => void }) {
  const queryClient = useQueryClient();
  const [name, setName] = useState('');
  const [date, setDate] = useState('');
  const [venue, setVenue] = useState('');
  const [kind, setKind] = useState('standard');

  const create = useMutation({
    mutationFn: () =>
      api.post(`/events/${eventId}/phases`, {
        name,
        venue,
        date: date ? new Date(`${date}T00:00:00`).toISOString() : null,
        requiresSeating: kind === 'seated',
        requiresMenu: kind === 'seated',
        requiresTicket: kind === 'ticketed',
      }),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['phases', eventId] });
      queryClient.invalidateQueries({ queryKey: ['event', eventId] });
      onClose();
    },
  });

  return (
    <div
      className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 px-6 backdrop-blur-sm"
      role="dialog"
      aria-modal="true"
      aria-label="Add a phase"
    >
      <div className="liquid-glass-strong w-full max-w-md rounded-[1.4rem] p-8">
        <h2 className="text-xl tracking-tight">
          Add a <em>phase</em>
        </h2>
        <form
          className="mt-5 space-y-4"
          onSubmit={(e) => {
            e.preventDefault();
            create.mutate();
          }}
        >
          <Field label="Phase name" value={name} onChange={(e) => setName(e.target.value)} required placeholder="Mehendi" />
          <Field label="Date" type="date" value={date} onChange={(e) => setDate(e.target.value)} />
          <Field label="Venue" value={venue} onChange={(e) => setVenue(e.target.value)} />
          <Select label="What kind of phase is this?" value={kind} onChange={(e) => setKind(e.target.value)}>
            <option value="standard">Standard - RSVP only</option>
            <option value="seated">Seated dinner - seating and menu</option>
            <option value="ticketed">Ticketed - tickets and check-in</option>
          </Select>

          {create.error ? (
            <ErrorNote message={create.error instanceof Error ? create.error.message : 'Could not add'} />
          ) : null}

          <div className="flex justify-end gap-2.5 pt-1">
            <Button type="button" variant="quiet" onClick={onClose}>
              Cancel
            </Button>
            <Button type="submit" disabled={create.isPending}>
              {create.isPending ? 'Adding...' : 'Add phase'}
            </Button>
          </div>
        </form>
      </div>
    </div>
  );
}
