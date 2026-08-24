import { useEffect, useState } from 'react';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { Lock, Shuffle, Unlock } from 'lucide-react';
import { PageHeader } from '@/components/PageHeader';
import { PhasePicker } from '@/components/PhasePicker';
import { Button, Empty, ErrorNote, Field, Loading, Panel } from '@/components/ui';
import { api } from '@/lib/api';
import { useEventContext } from '@/hooks/useEventContext';
import { cx } from '@/lib/format';
import type { Phase, SeatingView } from '@/lib/types';

interface GenerateResult {
  stats: {
    tablesUsed: number;
    seatsUsed: number;
    seatsAvailable: number;
    clustersKeptTogether: number;
    clustersSplit: number;
  };
  unseated: Array<{ guestId: string; name: string; reason: string }>;
}

export function Seating() {
  const event = useEventContext();
  const queryClient = useQueryClient();
  const [phaseId, setPhaseId] = useState<string | null>(null);
  const [tableCount, setTableCount] = useState(20);
  const [seatsPerTable, setSeatsPerTable] = useState(10);
  const [result, setResult] = useState<GenerateResult | null>(null);

  const phases = useQuery({
    queryKey: ['phases', event.id],
    queryFn: () => api.get<Phase[]>(`/events/${event.id}/phases`),
  });

  const seatedPhases = (phases.data ?? []).filter((p) => p.requiresSeating);

  useEffect(() => {
    if (!phaseId && seatedPhases.length > 0) setPhaseId(seatedPhases[0]!.id);
  }, [phaseId, seatedPhases]);

  const seating = useQuery({
    queryKey: ['seating', phaseId],
    queryFn: () => api.get<SeatingView>(`/events/${event.id}/phases/${phaseId}/seating`),
    enabled: Boolean(phaseId),
  });

  const refresh = () => {
    queryClient.invalidateQueries({ queryKey: ['seating', phaseId] });
    queryClient.invalidateQueries({ queryKey: ['health', event.id] });
  };

  const buildTables = useMutation({
    mutationFn: () =>
      api.post(`/events/${event.id}/phases/${phaseId}/seating/tables`, { tableCount, seatsPerTable }),
    onSuccess: refresh,
  });

  const generate = useMutation({
    mutationFn: () => api.post<GenerateResult>(`/events/${event.id}/phases/${phaseId}/seating/generate`, {}),
    onSuccess: (data) => {
      setResult(data);
      refresh();
    },
  });

  const toggleLock = useMutation({
    mutationFn: ({ tableId, locked }: { tableId: string; locked: boolean }) =>
      api.patch(`/events/${event.id}/phases/${phaseId}/seating/tables/${tableId}`, { locked }),
    onSuccess: refresh,
  });

  if (phases.isLoading) return <Loading label="Loading phases" />;

  if (seatedPhases.length === 0) {
    return (
      <>
        <PageHeader title="Seating" />
        <Empty
          title="No phase needs a seating plan yet"
          hint="Turn on Seating plan for a phase and it will appear here."
        />
      </>
    );
  }

  const view = seating.data;
  const capacity = view?.capacity ?? 0;
  const confirmed = view?.confirmed ?? 0;

  return (
    <>
      <PageHeader
        title="Seating"
        sub={`${confirmed.toLocaleString()} confirmed guests - ${capacity.toLocaleString()} seats laid out`}
      />

      <PhasePicker
        phases={seatedPhases}
        activeId={phaseId}
        onChange={(id) => {
          setPhaseId(id);
          setResult(null);
        }}
      />

      <Panel className="mb-4 p-4">
        <div className="flex flex-wrap items-end gap-4">
          <Field
            label="Tables"
            type="number"
            min={1}
            max={400}
            value={tableCount}
            onChange={(e) => setTableCount(Number(e.target.value))}
            className="w-28"
          />
          <Field
            label="Seats per table"
            type="number"
            min={1}
            max={40}
            value={seatsPerTable}
            onChange={(e) => setSeatsPerTable(Number(e.target.value))}
            className="w-36"
          />
          <Button variant="ghost" onClick={() => buildTables.mutate()} disabled={buildTables.isPending}>
            {buildTables.isPending ? 'Laying out...' : 'Apply layout'}
          </Button>
          <Button onClick={() => generate.mutate()} disabled={generate.isPending || capacity === 0}>
            <Shuffle className="h-3.5 w-3.5" />
            {generate.isPending ? 'Allocating...' : 'Generate seating'}
          </Button>
        </div>

        {buildTables.error ? (
          <div className="mt-3">
            <ErrorNote message={buildTables.error instanceof Error ? buildTables.error.message : 'Failed'} />
          </div>
        ) : null}
        {generate.error ? (
          <div className="mt-3">
            <ErrorNote message={generate.error instanceof Error ? generate.error.message : 'Failed'} />
          </div>
        ) : null}

        {result ? <GenerateSummary result={result} /> : null}
      </Panel>

      {seating.isLoading ? <Loading label="Loading tables" /> : null}

      {view && view.tables.length === 0 ? (
        <Empty
          title="No tables laid out yet"
          hint="Set the table count and seats per table above, then apply the layout."
        />
      ) : null}

      {view && view.tables.length > 0 ? (
        <>
          <div className="grid gap-3 sm:grid-cols-2 xl:grid-cols-4">
            {view.tables.map((table) => (
              <div key={table.id} className="liquid-glass rounded-xl p-4">
                <div className="flex items-start justify-between">
                  <div>
                    <div className="text-sm">Table {table.number}</div>
                    <div className="text-[0.66rem] uppercase tracking-wider text-white/35">
                      {table.kind === 'standard' ? '' : `${table.kind} - `}
                      {table.seats.length}/{table.capacity}
                    </div>
                  </div>
                  <button
                    type="button"
                    aria-label={table.locked ? `Unlock table ${table.number}` : `Lock table ${table.number}`}
                    onClick={() => toggleLock.mutate({ tableId: table.id, locked: !table.locked })}
                    className="text-white/40 transition hover:text-white"
                  >
                    {table.locked ? <Lock className="h-3.5 w-3.5" /> : <Unlock className="h-3.5 w-3.5" />}
                  </button>
                </div>
                <ul className="mt-3 space-y-1">
                  {table.seats.map((seat) => (
                    <li
                      key={seat.id}
                      className={cx('truncate text-xs', seat.guest.isVip ? 'text-white' : 'text-white/60')}
                    >
                      {seat.guest.name}
                    </li>
                  ))}
                  {table.seats.length === 0 ? <li className="text-xs text-white/25">Empty</li> : null}
                </ul>
              </div>
            ))}
          </div>

          {view.unassigned.length > 0 ? (
            <Panel className="mt-4">
              <h2 className="mb-3 text-base">
                Not yet seated <span className="ml-1 text-sm text-white/40">{view.unassigned.length}</span>
              </h2>
              <div className="flex flex-wrap gap-2">
                {view.unassigned.slice(0, 60).map((guest) => (
                  <span key={guest.id} className="liquid-glass rounded-full px-3 py-1.5 text-xs text-white/65">
                    {guest.name}
                  </span>
                ))}
              </div>
            </Panel>
          ) : null}
        </>
      ) : null}
    </>
  );
}

function GenerateSummary({ result }: { result: GenerateResult }) {
  return (
    <div className="liquid-glass mt-4 rounded-xl px-4 py-3 text-xs text-white/65">
      Seated {result.stats.seatsUsed} guests across {result.stats.tablesUsed} tables.{' '}
      {result.stats.clustersKeptTogether > 0
        ? `${result.stats.clustersKeptTogether} groups kept together. `
        : ''}
      {result.stats.clustersSplit > 0 ? `${result.stats.clustersSplit} groups had to be split. ` : ''}
      {result.unseated.length > 0 ? (
        <span className="text-white">
          Could not seat {result.unseated.length}: {result.unseated[0]!.reason.toLowerCase()}.
        </span>
      ) : (
        'Everyone has a seat.'
      )}
    </div>
  );
}
