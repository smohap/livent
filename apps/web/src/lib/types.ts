export interface User {
  id: string;
  email: string;
  name: string;
}

export interface Phase {
  id: string;
  eventId: string;
  name: string;
  displayName: string;
  description: string;
  position: number;
  date: string | null;
  startTime: string;
  endTime: string;
  venue: string;
  address: string;
  mapUrl: string;
  dressCode: string;
  capacity: number;
  requiresRsvp: boolean;
  requiresSeating: boolean;
  requiresMenu: boolean;
  requiresTicket: boolean;
  invited?: number;
  attending?: number;
  rsvpRate?: number;
}

export interface EventSummary {
  id: string;
  slug: string;
  name: string;
  hostNames: string;
  type: string;
  startDate: string | null;
  location: string;
  currency: string;
  phases: Array<{ id: string; name: string; date: string | null }>;
  _count?: { guests: number; tasks: number };
}

export interface EventDetail extends EventSummary {
  description: string;
  timezone: string;
  privacy: string;
  totalBudget: number;
  role: string;
  capabilities: string[];
  teams: Array<{ id: string; name: string; colour: string }>;
  groups: Array<{ id: string; name: string }>;
}

export interface Alert {
  severity: 'info' | 'warn' | 'critical';
  title: string;
  context: string;
}

export interface EventHealth {
  guests: { invited: number; attending: number; declined: number; pending: number; rsvpRate: number };
  finance: { budget: number; committed: number; paid: number; outstanding: number };
  tasks: { total: number; completed: number; overdue: number; blocked: number };
  tickets: { issued: number; checkedIn: number };
  gifts: { count: number; total: number };
  menuSplit: Array<{ label: string; count: number; pct: number }>;
  phases: Array<{
    id: string;
    name: string;
    date: string | null;
    venue: string;
    invited: number;
    attending: number;
    rsvpRate: number;
  }>;
  alerts: Alert[];
}

export interface Guest {
  id: string;
  name: string;
  email: string;
  phone: string;
  organisation: string;
  isVip: boolean;
  isChild: boolean;
  plusOnes: number;
  dietary: string;
  allergies: string;
  notes: string;
  accessToken: string;
  group: { id: string; name: string } | null;
  invites: Array<{ phaseId: string; status: string; partySize: number }>;
  seats: Array<{ table: { number: number; phaseId: string } }>;
}

export interface Task {
  id: string;
  title: string;
  detail: string;
  status: string;
  priority: string;
  dueDate: string | null;
  cost: number;
  team: { id: string; name: string } | null;
  phase: { id: string; name: string } | null;
  owner: { id: string; name: string } | null;
  dependsOn: { id: string; title: string; status: string } | null;
}

export interface Team {
  id: string;
  name: string;
  brief: string;
  completed: number;
  committed: number;
  _count: { tasks: number; memberships: number };
}

export interface BudgetView {
  currency: string;
  totalBudget: number;
  totals: { budgeted: number; committed: number; paid: number; outstanding: number };
  lines: Array<{
    id: string;
    category: string;
    budgeted: number;
    committed: number;
    paid: number;
    outstanding: number;
    invoiceCount: number;
    phase: { id: string; name: string } | null;
  }>;
}

export interface Invoice {
  id: string;
  number: string;
  description: string;
  amount: number;
  tax: number;
  dueDate: string | null;
  approval: string;
  payment: string;
  paidAmount: number;
  vendor: { id: string; name: string } | null;
  team: { id: string; name: string } | null;
  budgetLine: { id: string; category: string } | null;
}

export interface SeatingTable {
  id: string;
  number: number;
  name: string;
  capacity: number;
  kind: string;
  locked: boolean;
  seats: Array<{
    id: string;
    guestId: string;
    guest: { id: string; name: string; isVip: boolean; isChild: boolean; dietary: string };
  }>;
}

export interface SeatingView {
  tables: SeatingTable[];
  rules: Array<{ id: string; kind: string; guestIds: string[] }>;
  confirmed: number;
  capacity: number;
  unassigned: Array<{ id: string; name: string; isVip: boolean; isChild: boolean }>;
}

export interface MenuView {
  courses: Array<{
    id: string;
    name: string;
    choose: number;
    items: Array<{
      id: string;
      name: string;
      description: string;
      dietary: string;
      allergens: string;
      _count: { selections: number };
    }>;
  }>;
  catererCount: {
    attending: number;
    selected: number;
    dietary: Array<{ label: string; count: number }>;
  };
}

export interface Poll {
  id: string;
  question: string;
  kind: string;
  closed: boolean;
  totalVotes: number;
  phase: { id: string; name: string } | null;
  options: Array<{ id: string; label: string; votes: number; pct: number }>;
}

export interface Announcement {
  id: string;
  body: string;
  audience: string;
  channels: string;
  urgent: boolean;
  createdAt: string;
  author: { id: string; name: string };
}

export interface Album {
  id: string;
  name: string;
  guestUploads: boolean;
  downloads: string;
  phase: { id: string; name: string } | null;
  _count: { items: number };
  items: Array<{ id: string; url: string }>;
}

export interface ScheduleItem {
  id: string;
  title: string;
  detail: string;
  startTime: string;
  endTime: string;
  location: string;
  ownerTeam: string;
  status: string;
}
