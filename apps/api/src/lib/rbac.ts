/**
 * Role-based access control for one event (PRD section 7).
 *
 * Capabilities are deliberately coarse: a role either can act on a domain or it
 * cannot. Row-level narrowing (e.g. "team lead sees only their own team") is
 * applied by the route handlers using `membership.teamId`.
 */
export const ROLES = [
  'owner',
  'manager',
  'team_lead',
  'team_member',
  'finance',
  'vendor',
  'sponsor',
  'checkin',
] as const;

export type Role = (typeof ROLES)[number];

export const CAPABILITIES = [
  'event:read',
  'event:write',
  'phase:write',
  'guest:read',
  'guest:write',
  'rsvp:manage',
  'seating:write',
  'menu:write',
  'task:read',
  'task:write',
  'team:write',
  'finance:read',
  'finance:write',
  'finance:approve',
  'invoice:submit',
  'comms:send',
  'poll:write',
  'media:write',
  'media:moderate',
  'ticket:write',
  'checkin:scan',
  'member:manage',
] as const;

export type Capability = (typeof CAPABILITIES)[number];

const ALL: Capability[] = [...CAPABILITIES];

const MATRIX: Record<Role, Capability[]> = {
  owner: ALL,
  // Full operational control, but billing/access changes and the final
  // finance sign-off stay with the owner and finance roles respectively.
  manager: ALL.filter((c) => c !== 'member:manage' && c !== 'finance:approve'),
  team_lead: [
    'event:read',
    'guest:read',
    'task:read',
    'task:write',
    'invoice:submit',
    'finance:read',
    'comms:send',
    'media:write',
  ],
  team_member: ['event:read', 'task:read', 'task:write', 'media:write'],
  finance: ['event:read', 'finance:read', 'finance:write', 'finance:approve', 'task:read'],
  vendor: ['event:read', 'task:read', 'task:write', 'invoice:submit'],
  sponsor: ['event:read'],
  checkin: ['event:read', 'guest:read', 'checkin:scan'],
};

export function can(role: string, capability: Capability): boolean {
  const caps = MATRIX[role as Role];
  return caps ? caps.includes(capability) : false;
}

export function capabilitiesFor(role: string): Capability[] {
  return MATRIX[role as Role] ?? [];
}

/** Roles allowed to see every team's data rather than only their own. */
export function seesWholeEvent(role: string): boolean {
  return role === 'owner' || role === 'manager' || role === 'finance';
}
