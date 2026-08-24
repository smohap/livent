import { useState } from 'react';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { Copy, ExternalLink } from 'lucide-react';
import { PageHeader } from '@/components/PageHeader';
import { Button, ErrorNote, Field, Loading, Panel, Select } from '@/components/ui';
import { api } from '@/lib/api';
import { useEventContext } from '@/hooks/useEventContext';
import { label } from '@/lib/format';

interface Member {
  id: string;
  role: string;
  user: { id: string; name: string; email: string };
  team: { id: string; name: string } | null;
}

const ROLES = ['owner', 'manager', 'team_lead', 'team_member', 'finance', 'vendor', 'sponsor', 'checkin'];

export function Settings() {
  const event = useEventContext();

  return (
    <>
      <PageHeader title="Settings" sub={`You are ${label(event.role)} on this event`} />
      <div className="grid gap-4 lg:grid-cols-2">
        <EventDetailsPanel />
        <div className="space-y-4">
          <SitePanel slug={event.slug} />
          <MembersPanel eventId={event.id} />
        </div>
      </div>
    </>
  );
}

function EventDetailsPanel() {
  const event = useEventContext();
  const queryClient = useQueryClient();
  const [draft, setDraft] = useState({
    name: event.name,
    hostNames: event.hostNames,
    description: event.description,
    location: event.location,
    currency: event.currency,
    totalBudget: event.totalBudget,
    privacy: event.privacy,
  });

  const save = useMutation({
    mutationFn: () =>
      api.patch(`/events/${event.id}`, { ...draft, totalBudget: Number(draft.totalBudget) || 0 }),
    onSuccess: () => queryClient.invalidateQueries({ queryKey: ['event', event.id] }),
  });

  return (
    <Panel>
      <h2 className="text-base">Event details</h2>
      <div className="mt-4 grid gap-4">
        <Field label="Event name" value={draft.name} onChange={(e) => setDraft({ ...draft, name: e.target.value })} />
        <Field label="Hosts" value={draft.hostNames} onChange={(e) => setDraft({ ...draft, hostNames: e.target.value })} />
        <Field
          label="Description shown on the event site"
          value={draft.description}
          onChange={(e) => setDraft({ ...draft, description: e.target.value })}
        />
        <Field label="Location" value={draft.location} onChange={(e) => setDraft({ ...draft, location: e.target.value })} />
        <div className="grid gap-4 sm:grid-cols-2">
          <Field label="Currency" value={draft.currency} onChange={(e) => setDraft({ ...draft, currency: e.target.value })} />
          <Field
            label="Total budget"
            type="number"
            min={0}
            value={draft.totalBudget}
            onChange={(e) => setDraft({ ...draft, totalBudget: Number(e.target.value) })}
          />
        </div>
        <Select label="Privacy" value={draft.privacy} onChange={(e) => setDraft({ ...draft, privacy: e.target.value })}>
          <option value="unlisted">Unlisted - anyone with the link</option>
          <option value="public">Public - discoverable</option>
          <option value="private">Private - invited guests only</option>
        </Select>
      </div>

      {save.error ? (
        <div className="mt-4">
          <ErrorNote message={save.error instanceof Error ? save.error.message : 'Could not save'} />
        </div>
      ) : null}

      <div className="mt-5 flex items-center gap-3">
        <Button onClick={() => save.mutate()} disabled={save.isPending}>
          {save.isPending ? 'Saving...' : 'Save changes'}
        </Button>
        {save.isSuccess ? <span className="text-xs text-white/45">Saved</span> : null}
      </div>
    </Panel>
  );
}

function SitePanel({ slug }: { slug: string }) {
  const siteUrl = `${window.location.origin}/e/${slug}`;

  return (
    <Panel>
      <h2 className="text-base">Event website</h2>
      <p className="mt-0.5 text-xs text-white/40">
        Every event gets a shareable mini-site. No account needed to view it.
      </p>
      <div className="liquid-glass mt-4 flex items-center gap-3 rounded-xl px-4 py-3">
        <code className="min-w-0 flex-1 truncate text-xs text-white/70">{siteUrl}</code>
        <button
          type="button"
          onClick={() => void navigator.clipboard.writeText(siteUrl)}
          className="text-white/45 transition hover:text-white"
          aria-label="Copy event site link"
        >
          <Copy className="h-3.5 w-3.5" />
        </button>
        <a
          href={siteUrl}
          target="_blank"
          rel="noreferrer"
          className="text-white/45 transition hover:text-white"
          aria-label="Open event site"
        >
          <ExternalLink className="h-3.5 w-3.5" />
        </a>
      </div>
    </Panel>
  );
}

function MembersPanel({ eventId }: { eventId: string }) {
  const queryClient = useQueryClient();
  const [email, setEmail] = useState('');
  const [role, setRole] = useState('team_member');

  const members = useQuery({
    queryKey: ['members', eventId],
    queryFn: () => api.get<Member[]>(`/events/${eventId}/members`),
  });

  const invite = useMutation({
    mutationFn: () => api.post(`/events/${eventId}/members`, { email, role }),
    onSuccess: () => {
      setEmail('');
      queryClient.invalidateQueries({ queryKey: ['members', eventId] });
    },
  });

  return (
    <Panel>
      <h2 className="text-base">People with access</h2>
      <p className="mt-0.5 text-xs text-white/40">Roles scope what each person can see and do.</p>

      {members.isLoading ? <Loading /> : null}

      <ul className="mt-4 space-y-2">
        {members.data?.map((member) => (
          <li key={member.id} className="liquid-glass flex items-center justify-between gap-3 rounded-xl px-4 py-3">
            <div className="min-w-0">
              <p className="truncate text-sm text-white/85">{member.user.name}</p>
              <p className="truncate text-[0.66rem] text-white/35">{member.user.email}</p>
            </div>
            <span className="shrink-0 rounded-full bg-white/[0.08] px-2.5 py-1 text-[0.64rem] text-white/60">
              {label(member.role)}
              {member.team ? ` - ${member.team.name}` : ''}
            </span>
          </li>
        ))}
        {members.data?.length === 0 ? <li className="py-3 text-xs text-white/35">Only you so far.</li> : null}
      </ul>

      <form
        className="mt-5 grid gap-3 sm:grid-cols-[1fr_160px_auto] sm:items-end"
        onSubmit={(e) => {
          e.preventDefault();
          if (email.trim()) invite.mutate();
        }}
      >
        <Field
          label="Add by email"
          type="email"
          value={email}
          onChange={(e) => setEmail(e.target.value)}
          placeholder="manager@livent.app"
        />
        <Select label="Role" value={role} onChange={(e) => setRole(e.target.value)}>
          {ROLES.map((option) => (
            <option key={option} value={option}>
              {label(option)}
            </option>
          ))}
        </Select>
        <Button type="submit" variant="ghost" disabled={invite.isPending}>
          Add
        </Button>
      </form>

      {invite.error ? (
        <div className="mt-3">
          <ErrorNote message={invite.error instanceof Error ? invite.error.message : 'Could not add'} />
        </div>
      ) : null}
    </Panel>
  );
}
