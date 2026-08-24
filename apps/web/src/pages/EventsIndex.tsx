import { useState } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { ArrowRight, LogOut, Plus } from 'lucide-react';
import { Ambient } from '@/components/Ambient';
import { Button, ErrorNote, Field, Loading, Panel, Select } from '@/components/ui';
import { api } from '@/lib/api';
import { useAuth } from '@/lib/auth';
import { shortDate } from '@/lib/format';
import type { EventSummary } from '@/lib/types';

interface Template {
  key: string;
  label: string;
  blurb: string;
  phases: Array<{ name: string }>;
}

export function EventsIndex() {
  const { user, logout } = useAuth();
  const [creating, setCreating] = useState(false);

  const events = useQuery({
    queryKey: ['events'],
    queryFn: () => api.get<EventSummary[]>('/events'),
  });

  return (
    <>
      <Ambient />
      <main className="relative z-10 mx-auto min-h-screen w-full max-w-5xl px-6 py-12">
        <header className="mb-10 flex items-center justify-between">
          <Link to="/" className="flex items-center gap-2.5">
            <img src="/logo.svg" alt="" width={32} height={32} />
            <span className="text-2xl font-semibold tracking-tighter">livent</span>
          </Link>
          <button
            type="button"
            onClick={logout}
            className="flex items-center gap-1.5 text-xs text-white/50 transition hover:text-white"
          >
            <LogOut className="h-3.5 w-3.5" />
            Sign out
          </button>
        </header>

        <h1 className="text-4xl tracking-tight">
          Hi {user?.name?.split(' ')[0]}, <em>your events</em>
        </h1>
        <p className="mt-2 text-sm text-white/55">
          Every event you own or have been given a role on.
        </p>

        {events.isLoading ? <Loading /> : null}
        {events.error ? <ErrorNote message="Could not load your events" /> : null}

        <div className="mt-8 grid gap-4 sm:grid-cols-2">
          {events.data?.map((event) => (
            <Link key={event.id} to={`/app/${event.id}`} className="group">
              <Panel className="h-full transition-transform group-hover:scale-[1.015]">
                <div className="flex items-start justify-between gap-3">
                  <h2 className="text-lg tracking-tight">{event.name}</h2>
                  <ArrowRight className="mt-1 h-4 w-4 shrink-0 text-white/35 transition group-hover:text-white" />
                </div>
                <p className="mt-1 text-xs text-white/45">
                  {shortDate(event.startDate)}
                  {event.location ? ` - ${event.location}` : ''}
                </p>
                <div className="mt-4 flex flex-wrap gap-1.5">
                  {event.phases.map((phase) => (
                    <span
                      key={phase.id}
                      className="liquid-glass rounded-full px-3 py-1 text-[0.68rem] text-white/70"
                    >
                      {phase.name}
                    </span>
                  ))}
                </div>
                <p className="mt-4 text-xs text-white/40">
                  {event._count?.guests ?? 0} guests - {event.phases.length} phases
                </p>
              </Panel>
            </Link>
          ))}

          <button type="button" onClick={() => setCreating(true)} className="text-left">
            <Panel className="flex h-full min-h-[180px] flex-col items-center justify-center gap-3 border-dashed transition-transform hover:scale-[1.015]">
              <span className="flex h-10 w-10 items-center justify-center rounded-full bg-white/10">
                <Plus className="h-4 w-4" />
              </span>
              <span className="text-sm text-white/70">Create an event</span>
            </Panel>
          </button>
        </div>
      </main>

      {creating ? <CreateEventDialog onClose={() => setCreating(false)} /> : null}
    </>
  );
}

function CreateEventDialog({ onClose }: { onClose: () => void }) {
  const navigate = useNavigate();
  const queryClient = useQueryClient();
  const [name, setName] = useState('');
  const [template, setTemplate] = useState('wedding');
  const [hostNames, setHostNames] = useState('');
  const [location, setLocation] = useState('');
  const [startDate, setStartDate] = useState('');
  const [totalBudget, setTotalBudget] = useState('');

  const templates = useQuery({
    queryKey: ['templates'],
    queryFn: () => api.get<Template[]>('/events/templates'),
  });

  const create = useMutation({
    mutationFn: () =>
      api.post<EventSummary>('/events', {
        name,
        template,
        type: template,
        hostNames,
        location,
        totalBudget: Number(totalBudget) || 0,
        startDate: startDate ? new Date(`${startDate}T00:00:00`).toISOString() : undefined,
      }),
    onSuccess: (event) => {
      queryClient.invalidateQueries({ queryKey: ['events'] });
      navigate(`/app/${event.id}`);
    },
  });

  const selected = templates.data?.find((t) => t.key === template);

  return (
    <div
      className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 px-6 py-10 backdrop-blur-sm"
      role="dialog"
      aria-modal="true"
      aria-label="Create an event"
    >
      <div className="liquid-glass-strong max-h-full w-full max-w-lg overflow-y-auto rounded-[1.4rem] p-8">
        <h2 className="text-2xl tracking-tight">
          Create an <em>event</em>
        </h2>
        <p className="mt-1.5 text-sm text-white/55">
          Pick a template and livent sets up the phases, teams and budget lines for you.
        </p>

        <form
          className="mt-6 space-y-4"
          onSubmit={(e) => {
            e.preventDefault();
            create.mutate();
          }}
        >
          <Field
            label="Event name"
            value={name}
            onChange={(e) => setName(e.target.value)}
            placeholder="Sarah & John's Wedding"
            required
          />

          <Select label="Template" value={template} onChange={(e) => setTemplate(e.target.value)}>
            {templates.data?.map((option) => (
              <option key={option.key} value={option.key}>
                {option.label}
              </option>
            ))}
          </Select>

          {selected ? (
            <div className="liquid-glass rounded-xl p-4">
              <p className="text-xs text-white/55">{selected.blurb}</p>
              <div className="mt-3 flex flex-wrap gap-1.5">
                {selected.phases.map((phase) => (
                  <span
                    key={phase.name}
                    className="rounded-full bg-white/[0.08] px-2.5 py-1 text-[0.68rem] text-white/70"
                  >
                    {phase.name}
                  </span>
                ))}
              </div>
            </div>
          ) : null}

          <Field
            label="Hosts"
            value={hostNames}
            onChange={(e) => setHostNames(e.target.value)}
            placeholder="Sarah Whitfield & John Anand"
          />

          <div className="grid gap-4 sm:grid-cols-2">
            <Field
              label="Starts"
              type="date"
              value={startDate}
              onChange={(e) => setStartDate(e.target.value)}
            />
            <Field
              label="Total budget"
              type="number"
              min={0}
              value={totalBudget}
              onChange={(e) => setTotalBudget(e.target.value)}
              placeholder="182000"
            />
          </div>

          <Field
            label="Location"
            value={location}
            onChange={(e) => setLocation(e.target.value)}
            placeholder="Auckland, New Zealand"
          />

          {create.error ? (
            <ErrorNote
              message={create.error instanceof Error ? create.error.message : 'Could not create'}
            />
          ) : null}

          <div className="flex justify-end gap-2.5 pt-2">
            <Button type="button" variant="quiet" onClick={onClose}>
              Cancel
            </Button>
            <Button type="submit" disabled={create.isPending}>
              {create.isPending ? 'Creating...' : 'Create event'}
            </Button>
          </div>
        </form>
      </div>
    </div>
  );
}
