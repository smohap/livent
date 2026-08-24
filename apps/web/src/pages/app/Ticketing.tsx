import { useState } from 'react';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { QrCode, ScanLine } from 'lucide-react';
import { PageHeader } from '@/components/PageHeader';
import { Button, Empty, ErrorNote, Field, Loading, Meter, Panel, StatCard } from '@/components/ui';
import { api } from '@/lib/api';
import { useEventContext } from '@/hooks/useEventContext';
import { money } from '@/lib/format';

interface TicketTypeRow {
  id: string;
  name: string;
  price: number;
  capacity: number;
  perks: string;
  sold: number;
  checkedIn: number;
  remaining: number | null;
  phase: { id: string; name: string };
}

export function Ticketing() {
  const event = useEventContext();

  const types = useQuery({
    queryKey: ['tickets', event.id],
    queryFn: () => api.get<TicketTypeRow[]>(`/events/${event.id}/tickets`),
  });

  if (types.isLoading) return <Loading label="Loading ticketing" />;

  const rows = types.data ?? [];
  const sold = rows.reduce((sum, row) => sum + row.sold, 0);
  const checkedIn = rows.reduce((sum, row) => sum + row.checkedIn, 0);

  return (
    <>
      <PageHeader
        title="Ticketing & Check-in"
        sub={rows.length > 0 ? `${rows[0]!.phase.name} and other ticketed phases` : undefined}
      />

      {rows.length === 0 ? (
        <Empty
          title="No ticket types yet"
          hint="Mark a phase as Ticketed, then add ticket types to sell or issue."
        />
      ) : (
        <>
          <div className="grid gap-4 sm:grid-cols-3">
            <StatCard label="Issued" value={sold.toLocaleString()} />
            <StatCard label="Checked in" value={checkedIn.toLocaleString()} />
            <StatCard
              label="Not arrived"
              value={(sold - checkedIn).toLocaleString()}
              sub={sold > 0 ? `${Math.round((checkedIn / sold) * 100)}% through the door` : undefined}
            />
          </div>

          <div className="mt-4 grid gap-4 lg:grid-cols-[1fr_340px]">
            <div className="grid gap-3 sm:grid-cols-2">
              {rows.map((row) => (
                <Panel key={row.id}>
                  <div className="flex items-start justify-between gap-3">
                    <div>
                      <h2 className="text-base">{row.name}</h2>
                      <p className="mt-0.5 text-[0.66rem] text-white/40">{row.phase.name}</p>
                    </div>
                    <span className="text-sm text-white/70">
                      {row.price === 0 ? 'Complimentary' : money(row.price, event.currency)}
                    </span>
                  </div>

                  {row.perks ? <p className="mt-3 text-xs text-white/50">{row.perks}</p> : null}

                  <div className="mt-4">
                    <Meter
                      value={row.sold}
                      max={row.capacity || row.sold || 1}
                      label={`${row.sold} issued${row.capacity ? ` of ${row.capacity}` : ''}`}
                    />
                  </div>
                  <p className="mt-2 text-[0.66rem] text-white/40">
                    {row.checkedIn} checked in
                    {row.remaining !== null ? ` - ${row.remaining} left` : ''}
                  </p>
                </Panel>
              ))}
            </div>

            <CheckInPanel eventId={event.id} />
          </div>
        </>
      )}
    </>
  );
}

function CheckInPanel({ eventId }: { eventId: string }) {
  const queryClient = useQueryClient();
  const [code, setCode] = useState('');
  const [result, setResult] = useState<string | null>(null);

  const scan = useMutation({
    mutationFn: () =>
      api.post<{ alreadyCheckedIn: boolean; ticket: { guest: { name: string } | null } }>(
        `/events/${eventId}/tickets/checkin`,
        { code },
      ),
    onSuccess: (data) => {
      const name = data.ticket.guest?.name ?? 'Guest';
      setResult(data.alreadyCheckedIn ? `${name} was already checked in` : `Welcome, ${name}`);
      setCode('');
      queryClient.invalidateQueries({ queryKey: ['tickets', eventId] });
      queryClient.invalidateQueries({ queryKey: ['health', eventId] });
    },
  });

  return (
    <Panel className="h-fit">
      <div className="flex items-center gap-2">
        <ScanLine className="h-4 w-4 text-white/60" />
        <h2 className="text-base">Door check-in</h2>
      </div>
      <p className="mt-0.5 text-xs text-white/40">
        Scan a QR code or key in the ticket code by hand.
      </p>

      <form
        className="mt-4 space-y-3"
        onSubmit={(e) => {
          e.preventDefault();
          if (code.trim()) scan.mutate();
        }}
      >
        <Field
          label="Ticket code"
          value={code}
          onChange={(e) => setCode(e.target.value)}
          placeholder="Scan or type"
          autoComplete="off"
        />
        {scan.error ? (
          <ErrorNote message={scan.error instanceof Error ? scan.error.message : 'Check-in failed'} />
        ) : null}
        {result ? (
          <div className="liquid-glass flex items-center gap-2.5 rounded-xl px-4 py-3 text-sm text-white/85">
            <QrCode className="h-4 w-4 shrink-0 text-white/50" />
            {result}
          </div>
        ) : null}
        <Button type="submit" disabled={scan.isPending || !code.trim()}>
          {scan.isPending ? 'Checking...' : 'Check in'}
        </Button>
      </form>
    </Panel>
  );
}
