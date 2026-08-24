import { useState } from 'react';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { AlertTriangle, Send } from 'lucide-react';
import { PageHeader } from '@/components/PageHeader';
import { Button, ErrorNote, Field, Loading, Meter, Panel } from '@/components/ui';
import { api } from '@/lib/api';
import { useEventContext } from '@/hooks/useEventContext';
import { cx, initials, relativeDays } from '@/lib/format';
import type { Announcement, Poll } from '@/lib/types';

const CHANNELS = ['in_app', 'email', 'sms', 'push'] as const;
const CHANNEL_LABEL: Record<string, string> = {
  in_app: 'In-app',
  email: 'Email',
  sms: 'SMS',
  push: 'Push',
};

export function Comms() {
  const event = useEventContext();

  return (
    <>
      <PageHeader title="Polls & Communication" sub="Broadcast to guests, teams, vendors and sponsors" />
      <div className="grid gap-4 lg:grid-cols-2">
        <BroadcastPanel eventId={event.id} />
        <PollsPanel eventId={event.id} />
      </div>
    </>
  );
}

function BroadcastPanel({ eventId }: { eventId: string }) {
  const queryClient = useQueryClient();
  const [body, setBody] = useState('');
  const [channels, setChannels] = useState<string[]>(['in_app']);
  const [urgent, setUrgent] = useState(false);

  const announcements = useQuery({
    queryKey: ['announcements', eventId],
    queryFn: () => api.get<Announcement[]>(`/events/${eventId}/announcements`),
  });

  const broadcast = useMutation({
    mutationFn: () => api.post(`/events/${eventId}/announcements`, { body, channels, urgent }),
    onSuccess: () => {
      setBody('');
      setUrgent(false);
      queryClient.invalidateQueries({ queryKey: ['announcements', eventId] });
    },
  });

  const toggleChannel = (channel: string) =>
    setChannels((current) =>
      current.includes(channel) ? current.filter((c) => c !== channel) : [...current, channel],
    );

  return (
    <Panel>
      <h2 className="text-base">Broadcast</h2>
      <p className="mt-0.5 text-xs text-white/40">Reaches every guest on the channels you pick.</p>

      <form
        className="mt-4 space-y-3"
        onSubmit={(e) => {
          e.preventDefault();
          if (body.trim()) broadcast.mutate();
        }}
      >
        <textarea
          value={body}
          onChange={(e) => setBody(e.target.value)}
          rows={3}
          aria-label="Announcement"
          placeholder="Reception venue entrance has changed - please use Entrance B."
          className="glass-input resize-none"
        />

        <div className="flex flex-wrap gap-2">
          {CHANNELS.map((channel) => (
            <button
              key={channel}
              type="button"
              onClick={() => toggleChannel(channel)}
              className={cx(
                'rounded-full px-3.5 py-1.5 text-xs transition',
                channels.includes(channel) ? 'bg-white/85 text-black' : 'liquid-glass text-white/60',
              )}
            >
              {CHANNEL_LABEL[channel]}
            </button>
          ))}
        </div>

        <button
          type="button"
          onClick={() => setUrgent(!urgent)}
          className={cx(
            'flex items-center gap-1.5 rounded-full px-3.5 py-1.5 text-xs transition',
            urgent ? 'bg-white/85 text-black' : 'liquid-glass text-white/60',
          )}
        >
          <AlertTriangle className="h-3 w-3" />
          Emergency broadcast
        </button>

        {broadcast.error ? (
          <ErrorNote message={broadcast.error instanceof Error ? broadcast.error.message : 'Failed'} />
        ) : null}

        <Button type="submit" disabled={broadcast.isPending || !body.trim()}>
          <Send className="h-3.5 w-3.5" />
          {broadcast.isPending ? 'Sending...' : 'Send'}
        </Button>
      </form>

      <div className="mt-7 space-y-2.5">
        {announcements.data?.slice(0, 6).map((item) => (
          <div key={item.id} className="liquid-glass flex gap-3 rounded-xl p-3.5">
            <span className="flex h-7 w-7 shrink-0 items-center justify-center rounded-full bg-white/10 text-[0.6rem]">
              {initials(item.author.name)}
            </span>
            <div className="min-w-0">
              <p className="text-xs leading-relaxed text-white/80">{item.body}</p>
              <p className="mt-1 text-[0.64rem] text-white/35">
                {relativeDays(item.createdAt)} - {item.channels.split(',').length} channel
                {item.channels.split(',').length === 1 ? '' : 's'}
                {item.urgent ? ' - urgent' : ''}
              </p>
            </div>
          </div>
        ))}
      </div>
    </Panel>
  );
}

function PollsPanel({ eventId }: { eventId: string }) {
  const queryClient = useQueryClient();
  const [question, setQuestion] = useState('');
  const [options, setOptions] = useState('');

  const polls = useQuery({
    queryKey: ['polls', eventId],
    queryFn: () => api.get<Poll[]>(`/events/${eventId}/polls`),
  });

  const createPoll = useMutation({
    mutationFn: () =>
      api.post(`/events/${eventId}/polls`, {
        question,
        options: options
          .split('\n')
          .map((line) => line.trim())
          .filter(Boolean),
      }),
    onSuccess: () => {
      setQuestion('');
      setOptions('');
      queryClient.invalidateQueries({ queryKey: ['polls', eventId] });
    },
  });

  const closePoll = useMutation({
    mutationFn: (pollId: string) => api.patch(`/events/${eventId}/polls/${pollId}`, { closed: true }),
    onSuccess: () => queryClient.invalidateQueries({ queryKey: ['polls', eventId] }),
  });

  return (
    <Panel>
      <h2 className="text-base">Polls</h2>
      <p className="mt-0.5 text-xs text-white/40">Ask guests, see results live.</p>

      <form
        className="mt-4 space-y-3"
        onSubmit={(e) => {
          e.preventDefault();
          if (question.trim()) createPoll.mutate();
        }}
      >
        <Field
          label="Question"
          value={question}
          onChange={(e) => setQuestion(e.target.value)}
          placeholder="Which first-dance song?"
        />
        <label className="block">
          <span className="mb-1.5 block text-xs text-white/55">Options, one per line</span>
          <textarea
            value={options}
            onChange={(e) => setOptions(e.target.value)}
            rows={3}
            className="glass-input resize-none"
          />
        </label>
        {createPoll.error ? (
          <ErrorNote message={createPoll.error instanceof Error ? createPoll.error.message : 'Failed'} />
        ) : null}
        <Button type="submit" variant="ghost" disabled={createPoll.isPending}>
          {createPoll.isPending ? 'Creating...' : 'Create poll'}
        </Button>
      </form>

      {polls.isLoading ? <Loading /> : null}

      <div className="mt-7 space-y-4">
        {polls.data?.map((poll) => (
          <div key={poll.id} className="liquid-glass rounded-xl p-4">
            <div className="flex items-start justify-between gap-3">
              <h3 className="text-sm text-white/85">{poll.question}</h3>
              {poll.closed ? (
                <span className="shrink-0 text-[0.64rem] text-white/35">Closed</span>
              ) : (
                <button
                  type="button"
                  onClick={() => closePoll.mutate(poll.id)}
                  className="shrink-0 text-[0.64rem] text-white/45 transition hover:text-white"
                >
                  Close
                </button>
              )}
            </div>
            <p className="mt-0.5 text-[0.64rem] text-white/35">
              {poll.totalVotes} vote{poll.totalVotes === 1 ? '' : 's'}
              {poll.phase ? ` - ${poll.phase.name}` : ''}
            </p>
            <div className="mt-3.5 space-y-3">
              {poll.options.map((option) => (
                <Meter key={option.id} value={option.pct} max={100} label={option.label} />
              ))}
            </div>
          </div>
        ))}
      </div>
    </Panel>
  );
}
