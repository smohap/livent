import { useEffect, useState } from 'react';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { Plus } from 'lucide-react';
import { PageHeader } from '@/components/PageHeader';
import { PhasePicker } from '@/components/PhasePicker';
import { Button, Empty, Field, Loading, Meter, Panel } from '@/components/ui';
import { api } from '@/lib/api';
import { useEventContext } from '@/hooks/useEventContext';
import type { MenuView, Phase } from '@/lib/types';

export function MenuPage() {
  const event = useEventContext();
  const queryClient = useQueryClient();
  const [phaseId, setPhaseId] = useState<string | null>(null);
  const [newCourse, setNewCourse] = useState('');

  const phases = useQuery({
    queryKey: ['phases', event.id],
    queryFn: () => api.get<Phase[]>(`/events/${event.id}/phases`),
  });

  const menuPhases = (phases.data ?? []).filter((p) => p.requiresMenu);

  useEffect(() => {
    if (!phaseId && menuPhases.length > 0) setPhaseId(menuPhases[0]!.id);
  }, [phaseId, menuPhases]);

  const menu = useQuery({
    queryKey: ['menu', phaseId],
    queryFn: () => api.get<MenuView>(`/events/${event.id}/phases/${phaseId}/menu`),
    enabled: Boolean(phaseId),
  });

  const addCourse = useMutation({
    mutationFn: () => api.post(`/events/${event.id}/phases/${phaseId}/menu/courses`, { name: newCourse }),
    onSuccess: () => {
      setNewCourse('');
      queryClient.invalidateQueries({ queryKey: ['menu', phaseId] });
    },
  });

  if (phases.isLoading) return <Loading label="Loading phases" />;

  if (menuPhases.length === 0) {
    return (
      <>
        <PageHeader title="Menu" />
        <Empty
          title="No phase needs a menu yet"
          hint="Turn on Menu selection for a phase and its menu builder appears here."
        />
      </>
    );
  }

  const view = menu.data;
  const counts = view?.catererCount;

  return (
    <>
      <PageHeader
        title="Menu"
        sub={
          counts
            ? `${counts.selected} of ${counts.attending} confirmed guests have chosen`
            : 'Per-phase menu and live caterer counts'
        }
      />

      <PhasePicker phases={menuPhases} activeId={phaseId} onChange={setPhaseId} />

      {menu.isLoading ? <Loading label="Loading menu" /> : null}

      {view ? (
        <div className="grid gap-4 lg:grid-cols-[1fr_320px]">
          <div className="space-y-4">
            {view.courses.map((course) => (
              <Panel key={course.id}>
                <div className="mb-4 flex items-baseline justify-between">
                  <h2 className="text-base">{course.name}</h2>
                  <span className="text-[0.68rem] uppercase tracking-wider text-white/35">
                    {course.choose > 0 ? `Guest picks ${course.choose}` : 'Information only'}
                  </span>
                </div>

                <div className="grid gap-2.5 sm:grid-cols-2">
                  {course.items.map((item) => (
                    <div key={item.id} className="liquid-glass rounded-xl p-4">
                      <div className="flex items-start justify-between gap-3">
                        <span className="text-sm text-white/90">{item.name}</span>
                        <span className="shrink-0 text-xs text-white/45">
                          {item._count.selections}
                        </span>
                      </div>
                      {item.dietary || item.allergens ? (
                        <div className="mt-1.5 flex flex-wrap gap-1.5">
                          {item.dietary
                            .split(',')
                            .filter(Boolean)
                            .map((tag) => (
                              <span
                                key={tag}
                                className="rounded-full bg-white/[0.08] px-2 py-0.5 text-[0.62rem] text-white/60"
                              >
                                {tag.trim()}
                              </span>
                            ))}
                          {item.allergens
                            .split(',')
                            .filter(Boolean)
                            .map((tag) => (
                              <span
                                key={tag}
                                className="rounded-full bg-white/[0.04] px-2 py-0.5 text-[0.62rem] text-white/40"
                              >
                                contains {tag.trim()}
                              </span>
                            ))}
                        </div>
                      ) : null}
                    </div>
                  ))}
                  <AddItem eventId={event.id} courseId={course.id} phaseId={phaseId!} />
                </div>
              </Panel>
            ))}

            <Panel className="p-4">
              <form
                className="flex items-end gap-3"
                onSubmit={(e) => {
                  e.preventDefault();
                  if (newCourse.trim()) addCourse.mutate();
                }}
              >
                <Field
                  label="Add a course"
                  value={newCourse}
                  onChange={(e) => setNewCourse(e.target.value)}
                  placeholder="Starter"
                  className="flex-1"
                />
                <Button type="submit" variant="ghost" disabled={addCourse.isPending}>
                  <Plus className="h-3.5 w-3.5" />
                  Add
                </Button>
              </form>
            </Panel>
          </div>

          <Panel className="h-fit">
            <h2 className="text-base">Caterer live count</h2>
            <p className="mt-0.5 text-xs text-white/40">
              Derived from guest selections, not re-keyed by hand.
            </p>

            {counts ? (
              <>
                <div className="mt-5">
                  <Meter
                    value={counts.selected}
                    max={counts.attending || 1}
                    label={`${counts.selected} of ${counts.attending} chosen`}
                  />
                </div>

                <div className="mt-6 space-y-3">
                  {counts.dietary.length === 0 ? (
                    <p className="text-sm text-white/45">No selections yet.</p>
                  ) : (
                    counts.dietary.map((row) => (
                      <div key={row.label} className="flex items-baseline justify-between text-sm">
                        <span className="text-white/65">{row.label}</span>
                        <span className="text-white/90">{row.count}</span>
                      </div>
                    ))
                  )}
                </div>
              </>
            ) : null}
          </Panel>
        </div>
      ) : null}
    </>
  );
}

function AddItem({ eventId, courseId, phaseId }: { eventId: string; courseId: string; phaseId: string }) {
  const queryClient = useQueryClient();
  const [open, setOpen] = useState(false);
  const [name, setName] = useState('');
  const [dietary, setDietary] = useState('');

  const create = useMutation({
    mutationFn: () => api.post(`/events/${eventId}/menu/courses/${courseId}/items`, { name, dietary }),
    onSuccess: () => {
      setName('');
      setDietary('');
      setOpen(false);
      queryClient.invalidateQueries({ queryKey: ['menu', phaseId] });
    },
  });

  if (!open) {
    return (
      <button
        type="button"
        onClick={() => setOpen(true)}
        className="liquid-glass flex items-center justify-center gap-2 rounded-xl p-4 text-xs text-white/45 transition hover:text-white"
      >
        <Plus className="h-3.5 w-3.5" />
        Add dish
      </button>
    );
  }

  return (
    <form
      className="liquid-glass space-y-2.5 rounded-xl p-4"
      onSubmit={(e) => {
        e.preventDefault();
        if (name.trim()) create.mutate();
      }}
    >
      <Field label="Dish" value={name} onChange={(e) => setName(e.target.value)} autoFocus required />
      <Field
        label="Dietary tags"
        value={dietary}
        onChange={(e) => setDietary(e.target.value)}
        placeholder="vegetarian"
      />
      <div className="flex gap-2">
        <Button type="submit" className="px-4 py-1.5 text-xs" disabled={create.isPending}>
          Save
        </Button>
        <Button type="button" variant="quiet" className="px-3 py-1.5 text-xs" onClick={() => setOpen(false)}>
          Cancel
        </Button>
      </div>
    </form>
  );
}
