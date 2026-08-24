import { useParams } from 'react-router-dom';
import { useQuery } from '@tanstack/react-query';
import { CalendarDays, MapPin, Shirt } from 'lucide-react';
import { Ambient } from '@/components/Ambient';
import { ErrorNote, Loading, Panel } from '@/components/ui';
import { api } from '@/lib/api';
import { shortDate } from '@/lib/format';

interface PublicPhase {
  id: string;
  name: string;
  description: string;
  date: string | null;
  startTime: string;
  endTime: string;
  venue: string;
  address: string;
  mapUrl: string;
  dressCode: string;
  schedule: Array<{ id: string; title: string; startTime: string; location: string }>;
}

interface PublicEvent {
  name: string;
  hostNames: string;
  description: string;
  location: string;
  startDate: string | null;
  phases: PublicPhase[];
}

/** The auto-generated mini-site every event gets (PRD section 8, Platform). */
export function EventSite() {
  const { slug } = useParams<{ slug: string }>();
  const { data, isLoading, error } = useQuery({
    queryKey: ['public-event', slug],
    queryFn: () => api.get<PublicEvent>(`/public/events/${slug}`),
  });

  if (isLoading) {
    return (
      <>
        <Ambient />
        <div className="relative z-10 flex min-h-screen items-center justify-center">
          <Loading label="Opening the event" />
        </div>
      </>
    );
  }

  if (error || !data) {
    return (
      <>
        <Ambient />
        <main className="relative z-10 mx-auto max-w-lg px-6 py-24">
          <ErrorNote
            message={error instanceof Error ? error.message : 'This event could not be found'}
          />
        </main>
      </>
    );
  }

  return (
    <>
      <Ambient />
      <main className="relative z-10 mx-auto min-h-screen w-full max-w-3xl px-6 py-16">
        <header className="text-center">
          <img src="/logo.svg" alt="" width={44} height={44} className="mx-auto opacity-80" />
          <h1 className="mt-8 text-5xl leading-tight tracking-[-0.04em]">
            {data.hostNames || data.name}
          </h1>
          {data.hostNames ? (
            <p className="mt-3 font-serif text-lg italic text-white/60">{data.name}</p>
          ) : null}
          <p className="mt-6 text-sm text-white/55">
            {shortDate(data.startDate)}
            {data.location ? ` - ${data.location}` : ''}
          </p>
          {data.description ? (
            <p className="mx-auto mt-6 max-w-xl text-sm leading-relaxed text-white/60">
              {data.description}
            </p>
          ) : null}
        </header>

        <section className="mt-16">
          <h2 className="eyebrow mb-5 text-center">Our celebrations</h2>
          <div className="space-y-3">
            {data.phases.map((phase) => (
              <Panel key={phase.id}>
                <div className="flex flex-wrap items-baseline justify-between gap-3">
                  <h3 className="text-lg tracking-tight">{phase.name}</h3>
                  <span className="text-sm text-white/50">
                    {shortDate(phase.date)}
                    {phase.startTime ? ` - ${phase.startTime}` : ''}
                  </span>
                </div>

                {phase.description ? (
                  <p className="mt-2 text-sm leading-relaxed text-white/55">{phase.description}</p>
                ) : null}

                <div className="mt-4 flex flex-wrap gap-4 text-xs text-white/45">
                  {phase.venue ? (
                    <span className="flex items-center gap-1.5">
                      <MapPin className="h-3 w-3" />
                      {phase.venue}
                    </span>
                  ) : null}
                  {phase.dressCode ? (
                    <span className="flex items-center gap-1.5">
                      <Shirt className="h-3 w-3" />
                      {phase.dressCode}
                    </span>
                  ) : null}
                  {phase.endTime ? (
                    <span className="flex items-center gap-1.5">
                      <CalendarDays className="h-3 w-3" />
                      until {phase.endTime}
                    </span>
                  ) : null}
                </div>

                {phase.schedule.length > 0 ? (
                  <ol className="mt-5 space-y-1.5 border-t border-white/[0.07] pt-4">
                    {phase.schedule.map((item) => (
                      <li key={item.id} className="flex gap-4 text-xs">
                        <span className="w-12 shrink-0 font-mono tabular-nums text-white/40">
                          {item.startTime}
                        </span>
                        <span className="text-white/65">{item.title}</span>
                      </li>
                    ))}
                  </ol>
                ) : null}
              </Panel>
            ))}
          </div>
        </section>

        <footer className="mt-16 text-center">
          <p className="text-xs text-white/35">
            Have an invitation link? Open it to RSVP, choose your meal and find your table.
          </p>
          <p className="mt-6 text-[0.68rem] uppercase tracking-[0.2em] text-white/25">
            Powered by livent
          </p>
        </footer>
      </main>
    </>
  );
}
