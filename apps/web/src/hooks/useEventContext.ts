import { useOutletContext } from 'react-router-dom';
import type { EventDetail } from '@/lib/types';

/** The event resolved by <EventShell>, available to every nested app page. */
export function useEventContext(): EventDetail {
  return useOutletContext<EventDetail>();
}
