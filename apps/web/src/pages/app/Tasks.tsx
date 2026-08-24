import { useState } from 'react';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { Link2, Plus } from 'lucide-react';
import { PageHeader } from '@/components/PageHeader';
import { Button, ErrorNote, Field, Loading, Select } from '@/components/ui';
import { api } from '@/lib/api';
import { useEventContext } from '@/hooks/useEventContext';
import { cx, dayMonth, label } from '@/lib/format';
import type { Phase, Task, Team } from '@/lib/types';

const COLUMNS = [
  { key: 'not_started', title: 'Not started' },
  { key: 'in_progress', title: 'In progress' },
  { key: 'blocked', title: 'Blocked' },
  { key: 'awaiting_approval', title: 'Awaiting approval' },
  { key: 'completed', title: 'Completed' },
] as const;

export function Tasks() {
  const event = useEventContext();
  const queryClient = useQueryClient();
  const [adding, setAdding] = useState(false);
  const [teamFilter, setTeamFilter] = useState('all');
  const [moveError, setMoveError] = useState<string | null>(null);

  const tasks = useQuery({
    queryKey: ['tasks', event.id],
    queryFn: () => api.get<Task[]>(`/events/${event.id}/tasks`),
  });
  const teams = useQuery({
    queryKey: ['teams', event.id],
    queryFn: () => api.get<Team[]>(`/events/${event.id}/teams`),
  });

  const move = useMutation({
    mutationFn: ({ id, status }: { id: string; status: string }) =>
      api.patch(`/events/${event.id}/tasks/${id}`, { status }),
    onSuccess: () => {
      setMoveError(null);
      queryClient.invalidateQueries({ queryKey: ['tasks', event.id] });
      queryClient.invalidateQueries({ queryKey: ['health', event.id] });
    },
    onError: (error) => setMoveError(error instanceof Error ? error.message : 'Could not move task'),
  });

  if (tasks.isLoading) return <Loading label="Loading the board" />;

  const list = (tasks.data ?? []).filter((t) => teamFilter === 'all' || t.team?.id === teamFilter);
  const overdue = list.filter(
    (t) => t.status !== 'completed' && t.dueDate && new Date(t.dueDate) < new Date(),
  ).length;

  return (
    <>
      <PageHeader
        title="Tasks & Teams"
        sub={`${list.length} tasks - ${teams.data?.length ?? 0} teams${overdue > 0 ? ` - ${overdue} overdue` : ''}`}
        actions={<Button onClick={() => setAdding(true)}>New task</Button>}
      />

      <div className="mb-4 flex flex-wrap gap-2">
        <button
          type="button"
          onClick={() => setTeamFilter('all')}
          className={cx(
            'rounded-full px-4 py-2 text-xs transition',
            teamFilter === 'all' ? 'bg-white/85 text-black' : 'liquid-glass text-white/65',
          )}
        >
          All teams
        </button>
        {teams.data?.map((team) => (
          <button
            key={team.id}
            type="button"
            onClick={() => setTeamFilter(team.id)}
            className={cx(
              'rounded-full px-4 py-2 text-xs transition',
              teamFilter === team.id ? 'bg-white/85 text-black' : 'liquid-glass text-white/65',
            )}
          >
            {team.name}
            <span className="ml-1.5 text-white/40">{team._count.tasks}</span>
          </button>
        ))}
      </div>

      {moveError ? (
        <div className="mb-4">
          <ErrorNote message={moveError} />
        </div>
      ) : null}

      <div className="grid gap-3 lg:grid-cols-5">
        {COLUMNS.map((column) => {
          const columnTasks = list.filter((task) => task.status === column.key);
          return (
            <div key={column.key} className="liquid-glass rounded-xl p-3">
              <div className="mb-3 flex items-baseline justify-between px-1">
                <h2 className="text-xs uppercase tracking-wider text-white/50">{column.title}</h2>
                <span className="text-xs text-white/30">{columnTasks.length}</span>
              </div>
              <div className="space-y-2">
                {columnTasks.map((task) => (
                  <TaskCard
                    key={task.id}
                    task={task}
                    onMove={(status) => move.mutate({ id: task.id, status })}
                  />
                ))}
                {columnTasks.length === 0 ? (
                  <p className="px-1 py-4 text-[0.7rem] text-white/25">Nothing here</p>
                ) : null}
              </div>
            </div>
          );
        })}
      </div>

      {adding ? (
        <NewTaskDialog eventId={event.id} teams={teams.data ?? []} onClose={() => setAdding(false)} />
      ) : null}
    </>
  );
}

function TaskCard({ task, onMove }: { task: Task; onMove: (status: string) => void }) {
  const late = task.status !== 'completed' && task.dueDate && new Date(task.dueDate) < new Date();

  return (
    <div className="liquid-glass rounded-xl p-3.5">
      <p className="text-xs leading-snug text-white/85">{task.title}</p>

      <div className="mt-2 flex flex-wrap items-center gap-2 text-[0.66rem] text-white/40">
        {task.team ? <span>{task.team.name}</span> : null}
        {task.dueDate ? (
          <span className={late ? 'text-white' : undefined}>
            {late ? 'Overdue ' : 'Due '}
            {dayMonth(task.dueDate)}
          </span>
        ) : null}
      </div>

      {task.dependsOn ? (
        <div className="mt-2 flex items-start gap-1.5 text-[0.64rem] text-white/40">
          <Link2 className="mt-0.5 h-2.5 w-2.5 shrink-0" />
          <span className="leading-snug">
            After {task.dependsOn.title}
            {task.dependsOn.status === 'completed' ? '' : ' (still open)'}
          </span>
        </div>
      ) : null}

      <select
        value={task.status}
        onChange={(e) => onMove(e.target.value)}
        aria-label={`Status for ${task.title}`}
        className="mt-2.5 w-full cursor-pointer rounded-lg bg-white/[0.06] px-2 py-1 text-[0.66rem] text-white/70 outline-none [&>option]:bg-[#141415]"
      >
        {COLUMNS.map((column) => (
          <option key={column.key} value={column.key}>
            {column.title}
          </option>
        ))}
      </select>
    </div>
  );
}

function NewTaskDialog({
  eventId,
  teams,
  onClose,
}: {
  eventId: string;
  teams: Team[];
  onClose: () => void;
}) {
  const queryClient = useQueryClient();
  const [title, setTitle] = useState('');
  const [teamId, setTeamId] = useState('');
  const [phaseId, setPhaseId] = useState('');
  const [dueDate, setDueDate] = useState('');
  const [priority, setPriority] = useState('medium');

  const phases = useQuery({
    queryKey: ['phases', eventId],
    queryFn: () => api.get<Phase[]>(`/events/${eventId}/phases`),
  });

  const create = useMutation({
    mutationFn: () =>
      api.post(`/events/${eventId}/tasks`, {
        title,
        priority,
        teamId: teamId || null,
        phaseId: phaseId || null,
        dueDate: dueDate ? new Date(`${dueDate}T00:00:00`).toISOString() : null,
      }),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['tasks', eventId] });
      queryClient.invalidateQueries({ queryKey: ['health', eventId] });
      onClose();
    },
  });

  return (
    <div
      className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 px-6 backdrop-blur-sm"
      role="dialog"
      aria-modal="true"
      aria-label="New task"
    >
      <div className="liquid-glass-strong w-full max-w-md rounded-[1.4rem] p-8">
        <h2 className="text-xl tracking-tight">
          New <em>task</em>
        </h2>
        <form
          className="mt-5 space-y-4"
          onSubmit={(e) => {
            e.preventDefault();
            create.mutate();
          }}
        >
          <Field label="What needs doing?" value={title} onChange={(e) => setTitle(e.target.value)} required />
          <Select label="Team" value={teamId} onChange={(e) => setTeamId(e.target.value)}>
            <option value="">Unassigned</option>
            {teams.map((team) => (
              <option key={team.id} value={team.id}>
                {team.name}
              </option>
            ))}
          </Select>
          <Select label="Phase" value={phaseId} onChange={(e) => setPhaseId(e.target.value)}>
            <option value="">Whole event</option>
            {phases.data?.map((phase) => (
              <option key={phase.id} value={phase.id}>
                {phase.name}
              </option>
            ))}
          </Select>
          <div className="grid gap-4 sm:grid-cols-2">
            <Field label="Due" type="date" value={dueDate} onChange={(e) => setDueDate(e.target.value)} />
            <Select label="Priority" value={priority} onChange={(e) => setPriority(e.target.value)}>
              {['low', 'medium', 'high', 'critical'].map((option) => (
                <option key={option} value={option}>
                  {label(option)}
                </option>
              ))}
            </Select>
          </div>

          {create.error ? (
            <ErrorNote message={create.error instanceof Error ? create.error.message : 'Could not create'} />
          ) : null}

          <div className="flex justify-end gap-2.5 pt-1">
            <Button type="button" variant="quiet" onClick={onClose}>
              Cancel
            </Button>
            <Button type="submit" disabled={create.isPending}>
              <Plus className="h-3.5 w-3.5" />
              {create.isPending ? 'Adding...' : 'Add task'}
            </Button>
          </div>
        </form>
      </div>
    </div>
  );
}
