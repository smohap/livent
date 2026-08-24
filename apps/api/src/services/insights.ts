import { prisma } from '../lib/prisma.js';

/** Approval states that count as money committed. Shared with the finance module. */
const APPROVED = ['team_approved', 'manager_approved', 'finance_approved'];

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

const pct = (part: number, whole: number) => (whole === 0 ? 0 : Math.round((part / whole) * 100));

/**
 * Rolls the whole event up into one health view and derives the proactive
 * "needs attention" alerts described in the PRD. This is the rules-based
 * foundation the Phase 3 AI operations assistant is meant to sit on top of.
 */
export async function buildEventHealth(eventId: string): Promise<EventHealth> {
  const [event, phases, guests, invites, tasks, budgetLines, invoices, gifts, tickets] =
    await Promise.all([
      prisma.event.findUniqueOrThrow({ where: { id: eventId } }),
      prisma.phase.findMany({ where: { eventId }, orderBy: { position: 'asc' } }),
      prisma.guest.findMany({ where: { eventId }, include: { selections: true } }),
      prisma.phaseInvite.findMany({ where: { phase: { eventId } } }),
      prisma.task.findMany({ where: { eventId } }),
      prisma.budgetLine.findMany({ where: { eventId } }),
      prisma.invoice.findMany({ where: { eventId } }),
      prisma.gift.findMany({ where: { eventId, status: 'received' } }),
      prisma.ticket.findMany({ where: { ticketType: { phase: { eventId } } } }),
    ]);

  const attending = invites.filter((i) => i.status === 'attending');
  const declined = invites.filter((i) => i.status === 'declined');
  const responded = invites.filter((i) =>
    ['attending', 'declined', 'maybe'].includes(i.status),
  );
  const pending = invites.length - responded.length;

  const paid = invoices.reduce((sum, inv) => sum + inv.paidAmount, 0);
  // Committed is always derived from approved invoices so this figure can never
  // drift from the one the finance module shows.
  const committed = invoices
    .filter((inv) => APPROVED.includes(inv.approval))
    .reduce((sum, inv) => sum + inv.amount + inv.tax, 0);
  const budget =
    event.totalBudget || budgetLines.reduce((sum, line) => sum + line.budgeted, 0);

  const now = new Date();
  const overdue = tasks.filter(
    (t) => t.status !== 'completed' && t.dueDate !== null && t.dueDate < now,
  );

  // --- Menu split across every phase that requires a menu -----------------
  const items = await prisma.menuItem.findMany({
    where: { course: { phase: { eventId } } },
  });
  const itemById = new Map(items.map((i) => [i.id, i]));
  const dietTally = new Map<string, number>();
  let selectionCount = 0;
  for (const guest of guests) {
    for (const selection of guest.selections) {
      const item = itemById.get(selection.itemId);
      if (!item) continue;
      selectionCount++;
      const tags = item.dietary
        .split(',')
        .map((t) => t.trim())
        .filter(Boolean);
      const label = tags[0] ?? 'Non-vegetarian';
      dietTally.set(label, (dietTally.get(label) ?? 0) + 1);
    }
  }
  const menuSplit = [...dietTally.entries()]
    .map(([label, count]) => ({ label, count, pct: pct(count, selectionCount) }))
    .sort((a, b) => b.count - a.count);

  // --- Per-phase rollup ----------------------------------------------------
  const phaseRows = phases.map((phase) => {
    const own = invites.filter((i) => i.phaseId === phase.id);
    const ownResponded = own.filter((i) =>
      ['attending', 'declined', 'maybe'].includes(i.status),
    );
    return {
      id: phase.id,
      name: phase.name,
      date: phase.date ? phase.date.toISOString() : null,
      venue: phase.venue,
      invited: own.length,
      attending: own.filter((i) => i.status === 'attending').length,
      rsvpRate: pct(ownResponded.length, own.length),
    };
  });

  return {
    guests: {
      invited: guests.length,
      attending: new Set(attending.map((i) => i.guestId)).size,
      declined: new Set(declined.map((i) => i.guestId)).size,
      pending,
      rsvpRate: pct(responded.length, invites.length),
    },
    finance: { budget, committed, paid, outstanding: Math.max(0, committed - paid) },
    tasks: {
      total: tasks.length,
      completed: tasks.filter((t) => t.status === 'completed').length,
      overdue: overdue.length,
      blocked: tasks.filter((t) => t.status === 'blocked').length,
    },
    tickets: {
      issued: tickets.length,
      checkedIn: tickets.filter((t) => t.status === 'checked_in').length,
    },
    gifts: { count: gifts.length, total: gifts.reduce((sum, g) => sum + g.amount, 0) },
    menuSplit,
    phases: phaseRows,
    alerts: await buildAlerts(eventId),
  };
}

/**
 * Proactive event-operations checks (PRD section 34 of the brief).
 * Each rule answers one question an organiser would otherwise have to
 * remember to ask themselves.
 */
export async function buildAlerts(eventId: string): Promise<Alert[]> {
  const alerts: Alert[] = [];
  const now = new Date();

  const phases = await prisma.phase.findMany({
    where: { eventId },
    orderBy: { position: 'asc' },
    include: {
      invites: true,
      tables: { include: { seats: true } },
      menuCourses: { include: { items: true } },
    },
  });

  for (const phase of phases) {
    // 1. Outstanding RSVPs close to the phase date.
    const noResponse = phase.invites.filter((i) => ['invited', 'viewed'].includes(i.status));
    if (noResponse.length > 0 && phase.date) {
      const daysAway = Math.ceil((phase.date.getTime() - now.getTime()) / 86_400_000);
      if (daysAway >= 0 && daysAway <= 21) {
        alerts.push({
          severity: daysAway <= 7 ? 'critical' : 'warn',
          title: `${noResponse.length} guests have not RSVP'd to ${phase.name}`,
          context: `${phase.name} is ${daysAway} day${daysAway === 1 ? '' : 's'} away`,
        });
      }
    }

    // 2. Tables seated over capacity.
    for (const table of phase.tables) {
      if (table.seats.length > table.capacity) {
        alerts.push({
          severity: 'warn',
          title: `Table ${table.number} has ${table.seats.length} guests against a capacity of ${table.capacity}`,
          context: phase.name,
        });
      }
    }

    // 3. Confirmed guests who still owe a meal choice.
    if (phase.requiresMenu && phase.menuCourses.length > 0) {
      const attendingIds = phase.invites
        .filter((i) => i.status === 'attending')
        .map((i) => i.guestId);
      if (attendingIds.length > 0) {
        const chosen = await prisma.menuSelection.findMany({
          where: { guestId: { in: attendingIds }, item: { course: { phaseId: phase.id } } },
          select: { guestId: true },
        });
        const missing = attendingIds.length - new Set(chosen.map((c) => c.guestId)).size;
        if (missing > 0) {
          alerts.push({
            severity: 'warn',
            title: `${missing} confirmed guests have not selected a meal for ${phase.name}`,
            context: 'Caterer numbers cannot be finalised until they do',
          });
        }
      }
    }

    // 4. Seating capacity shortfall.
    if (phase.requiresSeating) {
      const confirmed = phase.invites.filter((i) => i.status === 'attending').length;
      const capacity = phase.tables.reduce((sum, t) => sum + t.capacity, 0);
      if (capacity > 0 && confirmed > capacity) {
        alerts.push({
          severity: 'critical',
          title: `${phase.name} has ${confirmed} confirmed guests but only ${capacity} seats`,
          context: `Add ${Math.ceil((confirmed - capacity) / 10)} more tables`,
        });
      }
    }
  }

  // 5. Overdue tasks.
  const overdue = await prisma.task.findMany({
    where: { eventId, status: { not: 'completed' }, dueDate: { lt: now } },
    include: { team: true },
    orderBy: { dueDate: 'asc' },
    take: 3,
  });
  for (const task of overdue) {
    alerts.push({
      severity: 'warn',
      title: `"${task.title}" is overdue`,
      context: task.team?.name ?? 'Unassigned',
    });
  }

  // 6. Invoices due or awaiting approval.
  const dueSoon = await prisma.invoice.findMany({
    where: {
      eventId,
      payment: { not: 'paid' },
      dueDate: { lt: new Date(now.getTime() + 3 * 86_400_000) },
    },
    include: { vendor: true },
    take: 3,
  });
  for (const invoice of dueSoon) {
    const late = invoice.dueDate !== null && invoice.dueDate < now;
    alerts.push({
      severity: late ? 'critical' : 'warn',
      title: `Invoice ${invoice.number} is ${late ? 'overdue' : 'due within 3 days'}`,
      context: invoice.vendor?.name ?? 'Finance',
    });
  }

  // 7. Budget lines running hot, measured against approved invoices.
  const lines = await prisma.budgetLine.findMany({
    where: { eventId },
    include: { invoices: true },
  });
  for (const line of lines) {
    const committed = line.invoices
      .filter((inv) => APPROVED.includes(inv.approval))
      .reduce((sum, inv) => sum + inv.amount + inv.tax, 0);
    if (line.budgeted > 0 && committed > line.budgeted) {
      const over = Math.round(((committed - line.budgeted) / line.budgeted) * 100);
      alerts.push({
        severity: over > 15 ? 'critical' : 'warn',
        title: `${line.category} is ${over}% over budget`,
        context: `Committed ${Math.round(committed).toLocaleString()} against ${Math.round(line.budgeted).toLocaleString()}`,
      });
    }
  }

  const order = { critical: 0, warn: 1, info: 2 } as const;
  return alerts.sort((a, b) => order[a.severity] - order[b.severity]).slice(0, 12);
}
