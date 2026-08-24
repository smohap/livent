import { Router } from 'express';
import { z } from 'zod';
import { prisma } from '../lib/prisma.js';
import { asyncRoute, badRequest, forbidden, notFound, parseBody } from '../lib/http.js';
import { requireAuth, requireCapability, requireEventAccess } from '../middleware/auth.js';
import { can } from '../lib/rbac.js';

export const financeRouter = Router({ mergeParams: true });

financeRouter.use(requireAuth, requireEventAccess);

// --- Budget ---------------------------------------------------------------

/**
 * Budget vs committed vs paid vs outstanding, per category. `committed` is
 * derived from approved invoices so the two views can never drift apart.
 */
financeRouter.get(
  '/budget',
  requireCapability('finance:read'),
  asyncRoute(async (req, res) => {
    const [lines, event] = await Promise.all([
      prisma.budgetLine.findMany({
        where: { eventId: req.params.eventId },
        orderBy: { category: 'asc' },
        include: { invoices: true, phase: { select: { id: true, name: true } } },
      }),
      prisma.event.findUniqueOrThrow({
        where: { id: req.params.eventId },
        select: { totalBudget: true, currency: true },
      }),
    ]);

    const rows = lines.map(({ invoices, ...line }) => {
      const approved = invoices.filter((i) =>
        ['team_approved', 'manager_approved', 'finance_approved'].includes(i.approval),
      );
      const committed = approved.reduce((sum, i) => sum + i.amount + i.tax, 0);
      const paid = invoices.reduce((sum, i) => sum + i.paidAmount, 0);
      return {
        ...line,
        committed,
        paid,
        outstanding: Math.max(0, committed - paid),
        invoiceCount: invoices.length,
      };
    });

    res.json({
      currency: event.currency,
      totalBudget: event.totalBudget || rows.reduce((s, r) => s + r.budgeted, 0),
      totals: {
        budgeted: rows.reduce((s, r) => s + r.budgeted, 0),
        committed: rows.reduce((s, r) => s + r.committed, 0),
        paid: rows.reduce((s, r) => s + r.paid, 0),
        outstanding: rows.reduce((s, r) => s + r.outstanding, 0),
      },
      lines: rows,
    });
  }),
);

const budgetBody = z.object({
  category: z.string().min(1).max(80),
  budgeted: z.number().nonnegative().default(0),
  phaseId: z.string().nullable().default(null),
  notes: z.string().default(''),
});

financeRouter.post(
  '/budget',
  requireCapability('finance:write'),
  asyncRoute(async (req, res) => {
    const body = parseBody(budgetBody, req.body);
    const line = await prisma.budgetLine.create({
      data: { ...body, eventId: req.params.eventId! },
    });
    res.status(201).json(line);
  }),
);

financeRouter.patch(
  '/budget/:lineId',
  requireCapability('finance:write'),
  asyncRoute(async (req, res) => {
    const body = parseBody(budgetBody.partial(), req.body);
    const line = await prisma.budgetLine.update({ where: { id: req.params.lineId }, data: body });
    res.json(line);
  }),
);

// --- Invoices -------------------------------------------------------------

/** The approval ladder from PRD 6.10, in order. */
const APPROVAL_CHAIN = [
  'draft',
  'submitted',
  'team_approved',
  'manager_approved',
  'finance_approved',
] as const;

financeRouter.get(
  '/invoices',
  requireCapability('finance:read'),
  asyncRoute(async (req, res) => {
    const invoices = await prisma.invoice.findMany({
      where: { eventId: req.params.eventId },
      orderBy: { dueDate: 'asc' },
      include: {
        vendor: { select: { id: true, name: true } },
        team: { select: { id: true, name: true } },
        phase: { select: { id: true, name: true } },
        budgetLine: { select: { id: true, category: true } },
      },
    });
    res.json(invoices);
  }),
);

const invoiceBody = z.object({
  number: z.string().min(1).max(60),
  description: z.string().default(''),
  amount: z.number().nonnegative(),
  tax: z.number().nonnegative().default(0),
  vendorId: z.string().nullable().default(null),
  teamId: z.string().nullable().default(null),
  phaseId: z.string().nullable().default(null),
  budgetLineId: z.string().nullable().default(null),
  dueDate: z.string().datetime().nullable().default(null),
  attachmentUrl: z.string().url().nullable().default(null),
});

financeRouter.post(
  '/invoices',
  requireCapability('invoice:submit'),
  asyncRoute(async (req, res) => {
    const body = parseBody(invoiceBody, req.body);
    const invoice = await prisma.invoice.create({
      data: {
        ...body,
        dueDate: body.dueDate ? new Date(body.dueDate) : null,
        eventId: req.params.eventId!,
        approval: 'submitted',
      },
      include: { vendor: true, budgetLine: true },
    });
    res.status(201).json(invoice);
  }),
);

/** Recomputes a budget line's committed total from its approved invoices. */
async function syncCommitted(budgetLineId: string): Promise<void> {
  const approved = await prisma.invoice.findMany({
    where: {
      budgetLineId,
      approval: { in: ['team_approved', 'manager_approved', 'finance_approved'] },
    },
  });
  await prisma.budgetLine.update({
    where: { id: budgetLineId },
    data: { committed: approved.reduce((sum, i) => sum + i.amount + i.tax, 0) },
  });
}

/**
 * Advances an invoice one rung up the approval ladder, rejects it, or records
 * a payment. Final sign-off is reserved for finance (and the event owner).
 */
financeRouter.post(
  '/invoices/:invoiceId/advance',
  requireCapability('finance:read'),
  asyncRoute(async (req, res) => {
    const { action, paidAmount } = parseBody(
      z.object({
        action: z.enum(['approve', 'reject', 'pay']),
        paidAmount: z.number().nonnegative().optional(),
      }),
      req.body,
    );

    const invoice = await prisma.invoice.findFirst({
      where: { id: req.params.invoiceId, eventId: req.params.eventId },
    });
    if (!invoice) throw notFound('Invoice');

    if (action === 'reject') {
      const rejected = await prisma.invoice.update({
        where: { id: invoice.id },
        data: { approval: 'rejected' },
      });
      if (invoice.budgetLineId) await syncCommitted(invoice.budgetLineId);
      res.json(rejected);
      return;
    }

    if (action === 'pay') {
      if (invoice.approval !== 'finance_approved') {
        throw badRequest('Invoice must clear finance approval before it can be paid');
      }
      if (!can(req.membership!.role, 'finance:write')) throw forbidden('Finance role required');

      const total = invoice.amount + invoice.tax;
      const paid = Math.min(total, invoice.paidAmount + (paidAmount ?? total - invoice.paidAmount));
      const updated = await prisma.invoice.update({
        where: { id: invoice.id },
        data: { paidAmount: paid, payment: paid >= total ? 'paid' : 'part_paid' },
      });
      res.json(updated);
      return;
    }

    const index = APPROVAL_CHAIN.indexOf(invoice.approval as (typeof APPROVAL_CHAIN)[number]);
    if (index === -1) throw badRequest('This invoice was rejected and must be resubmitted');
    if (index === APPROVAL_CHAIN.length - 1) throw badRequest('Invoice is already fully approved');

    const next = APPROVAL_CHAIN[index + 1]!;
    if (next === 'finance_approved' && !can(req.membership!.role, 'finance:approve')) {
      throw forbidden('Only the finance role or the event owner can give final approval');
    }
    if (next === 'manager_approved' && !can(req.membership!.role, 'finance:write')) {
      throw forbidden('Only an event manager can approve at this step');
    }

    const updated = await prisma.invoice.update({
      where: { id: invoice.id },
      data: { approval: next },
    });
    if (invoice.budgetLineId) await syncCommitted(invoice.budgetLineId);

    res.json(updated);
  }),
);

// --- Vendors --------------------------------------------------------------

financeRouter.get(
  '/vendors',
  asyncRoute(async (req, res) => {
    const vendors = await prisma.vendor.findMany({
      where: { eventId: req.params.eventId },
      orderBy: { name: 'asc' },
      include: { invoices: { select: { amount: true, tax: true, paidAmount: true } } },
    });
    res.json(
      vendors.map(({ invoices, ...vendor }) => ({
        ...vendor,
        billed: invoices.reduce((s, i) => s + i.amount + i.tax, 0),
        paid: invoices.reduce((s, i) => s + i.paidAmount, 0),
      })),
    );
  }),
);

financeRouter.post(
  '/vendors',
  requireCapability('finance:write'),
  asyncRoute(async (req, res) => {
    const body = parseBody(
      z.object({
        name: z.string().min(1).max(120),
        type: z.string().default('other'),
        contact: z.string().default(''),
        email: z.string().email().or(z.literal('')).default(''),
        phone: z.string().default(''),
        notes: z.string().default(''),
      }),
      req.body,
    );
    const vendor = await prisma.vendor.create({ data: { ...body, eventId: req.params.eventId! } });
    res.status(201).json(vendor);
  }),
);

// --- Gifts ----------------------------------------------------------------

/**
 * Organiser view of monetary gifts. Anonymous gifts keep the giver's name out
 * of the payload entirely rather than relying on the client to hide it.
 */
financeRouter.get(
  '/gifts',
  requireCapability('finance:read'),
  asyncRoute(async (req, res) => {
    const gifts = await prisma.gift.findMany({
      where: { eventId: req.params.eventId },
      orderBy: { createdAt: 'desc' },
      include: { guest: { select: { id: true, name: true } } },
    });
    res.json({
      total: gifts.reduce((s, g) => s + g.amount, 0),
      count: gifts.length,
      gifts,
    });
  }),
);
