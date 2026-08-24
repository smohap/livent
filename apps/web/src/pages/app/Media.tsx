import { useState } from 'react';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { Images, Plus } from 'lucide-react';
import { PageHeader } from '@/components/PageHeader';
import { Button, ErrorNote, Field, Loading, Panel, Select } from '@/components/ui';
import { api } from '@/lib/api';
import { useEventContext } from '@/hooks/useEventContext';
import type { Album, Phase } from '@/lib/types';

const DOWNLOAD_LABEL: Record<string, string> = {
  none: 'Downloads off',
  guests: 'Guests can download',
  all: 'Anyone can download',
};

export function Media() {
  const event = useEventContext();
  const queryClient = useQueryClient();
  const [adding, setAdding] = useState(false);
  const [name, setName] = useState('');
  const [phaseId, setPhaseId] = useState('');
  const [downloads, setDownloads] = useState('guests');

  const albums = useQuery({
    queryKey: ['albums', event.id],
    queryFn: () => api.get<Album[]>(`/events/${event.id}/albums`),
  });
  const phases = useQuery({
    queryKey: ['phases', event.id],
    queryFn: () => api.get<Phase[]>(`/events/${event.id}/phases`),
  });

  const create = useMutation({
    mutationFn: () =>
      api.post(`/events/${event.id}/albums`, { name, phaseId: phaseId || null, downloads }),
    onSuccess: () => {
      setName('');
      setAdding(false);
      queryClient.invalidateQueries({ queryKey: ['albums', event.id] });
    },
  });

  const total = (albums.data ?? []).reduce((sum, album) => sum + album._count.items, 0);

  return (
    <>
      <PageHeader
        title="Photos & Video"
        sub={`${(albums.data ?? []).length} albums - ${total.toLocaleString()} items`}
        actions={<Button onClick={() => setAdding(!adding)}>New album</Button>}
      />

      {adding ? (
        <Panel className="mb-4">
          <form
            className="grid gap-4 sm:grid-cols-[1fr_200px_200px_auto] sm:items-end"
            onSubmit={(e) => {
              e.preventDefault();
              if (name.trim()) create.mutate();
            }}
          >
            <Field label="Album name" value={name} onChange={(e) => setName(e.target.value)} required />
            <Select label="Phase" value={phaseId} onChange={(e) => setPhaseId(e.target.value)}>
              <option value="">Whole event</option>
              {phases.data?.map((phase) => (
                <option key={phase.id} value={phase.id}>
                  {phase.name}
                </option>
              ))}
            </Select>
            <Select label="Downloads" value={downloads} onChange={(e) => setDownloads(e.target.value)}>
              {Object.entries(DOWNLOAD_LABEL).map(([value, text]) => (
                <option key={value} value={value}>
                  {text}
                </option>
              ))}
            </Select>
            <Button type="submit" disabled={create.isPending}>
              <Plus className="h-3.5 w-3.5" />
              Create
            </Button>
          </form>
          {create.error ? (
            <div className="mt-3">
              <ErrorNote message={create.error instanceof Error ? create.error.message : 'Failed'} />
            </div>
          ) : null}
        </Panel>
      ) : null}

      {albums.isLoading ? <Loading label="Loading albums" /> : null}

      <div className="grid gap-3 sm:grid-cols-2 xl:grid-cols-3">
        {albums.data?.map((album) => (
          <Panel key={album.id} className="p-5">
            <div className="flex items-start justify-between gap-3">
              <div className="min-w-0">
                <h2 className="truncate text-sm">{album.name}</h2>
                <p className="mt-0.5 text-[0.66rem] text-white/40">
                  {album.phase?.name ?? 'Whole event'} - {album._count.items} item
                  {album._count.items === 1 ? '' : 's'}
                </p>
              </div>
              <Images className="h-4 w-4 shrink-0 text-white/30" />
            </div>

            <div className="mt-4 grid grid-cols-4 gap-1.5">
              {Array.from({ length: 4 }, (_, index) => {
                const item = album.items[index];
                return item ? (
                  <img
                    key={item.id}
                    src={item.url}
                    alt=""
                    className="aspect-square w-full rounded-lg object-cover grayscale"
                  />
                ) : (
                  <div key={index} className="aspect-square w-full rounded-lg bg-white/[0.05]" />
                );
              })}
            </div>

            <div className="mt-4 flex flex-wrap gap-1.5 text-[0.62rem]">
              <span className="rounded-full bg-white/[0.08] px-2.5 py-1 text-white/60">
                {DOWNLOAD_LABEL[album.downloads]}
              </span>
              {album.guestUploads ? (
                <span className="rounded-full bg-white/[0.08] px-2.5 py-1 text-white/60">
                  Guest uploads on
                </span>
              ) : null}
            </div>
          </Panel>
        ))}
      </div>
    </>
  );
}
