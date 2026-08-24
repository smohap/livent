export function money(amount: number, currency = 'NZD'): string {
  return new Intl.NumberFormat('en-NZ', {
    style: 'currency',
    currency,
    maximumFractionDigits: 0,
  }).format(amount);
}

/** Compact form for dashboard tiles: 182000 -> $182K */
export function moneyShort(amount: number, currency = 'NZD'): string {
  return new Intl.NumberFormat('en-NZ', {
    style: 'currency',
    currency,
    notation: 'compact',
    maximumFractionDigits: 0,
  }).format(amount);
}

export function shortDate(value: string | Date | null | undefined): string {
  if (!value) return 'Date TBC';
  const date = typeof value === 'string' ? new Date(value) : value;
  return date.toLocaleDateString('en-NZ', { day: 'numeric', month: 'short', year: 'numeric' });
}

export function dayMonth(value: string | Date | null | undefined): string {
  if (!value) return 'TBC';
  const date = typeof value === 'string' ? new Date(value) : value;
  return date.toLocaleDateString('en-NZ', { day: 'numeric', month: 'short' });
}

export function relativeDays(value: string | Date | null | undefined): string {
  if (!value) return '';
  const date = typeof value === 'string' ? new Date(value) : value;
  const days = Math.round((date.getTime() - Date.now()) / 86_400_000);
  if (days === 0) return 'today';
  if (days === 1) return 'tomorrow';
  if (days === -1) return 'yesterday';
  return days > 0 ? `in ${days} days` : `${Math.abs(days)} days ago`;
}

export const STATUS_LABEL: Record<string, string> = {
  invited: 'Invited',
  viewed: 'Viewed',
  attending: 'Attending',
  declined: 'Declined',
  maybe: 'Maybe',
  waitlisted: 'Waitlisted',
  not_started: 'Not started',
  in_progress: 'In progress',
  blocked: 'Blocked',
  awaiting_approval: 'Awaiting approval',
  completed: 'Completed',
  draft: 'Draft',
  submitted: 'Submitted',
  team_approved: 'Team approved',
  manager_approved: 'Manager approved',
  finance_approved: 'Finance approved',
  rejected: 'Rejected',
  unpaid: 'Unpaid',
  part_paid: 'Part paid',
  paid: 'Paid',
};

export const label = (key: string) => STATUS_LABEL[key] ?? key;

export function initials(name: string): string {
  return name
    .split(/\s+/)
    .slice(0, 2)
    .map((part) => part[0]?.toUpperCase() ?? '')
    .join('');
}

export function cx(...values: Array<string | false | null | undefined>): string {
  return values.filter(Boolean).join(' ');
}
