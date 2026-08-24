import { Router } from 'express';
import { z } from 'zod';
import { prisma } from '../lib/prisma.js';
import { asyncRoute, badRequest, notFound, parseBody } from '../lib/http.js';
import { requireAuth, requireCapability, requireEventAccess } from '../middleware/auth.js';
import { generateSeating, type SeatingGuest } from '../services/seating.js';

export const seatingRouter = Router({ mergeParams: true });

seatingRouter.use(requireAuth, requireEventAccess);

async function loadPhase(eventId: string, phaseId: string) {
  const phase = await prisma.phase.findFirst({ where: { id: phaseId, eventId } });
  if (!phase) throw notFound('Phase');
  return phase;
}

seatingRouter.get(
  '/:phaseId/seating',
  asyncRoute(async (req, res) => {
    await loadPhase(req.params.eventId!, req.params.phaseId!);

    const [tables, rules, confirmed] = await Promise.all([
      prisma.seatingTable.findMany({
        where: { phaseId: req.params.phaseId },
        orderBy: { number: 'asc' },
        include: {
          seats: {
            include: {
              guest: {
                select: { id: true, name: true, isVip: true, isChild: true, dietary: true, groupId: true },
              },
            },
          },
        },
      }),
      prisma.seatingRule.findMany({ where: { phaseId: req.params.phaseId } }),
      prisma.phaseInvite.findMany({
        where: { phaseId: req.params.phaseId, status: 'attending' },
        include: { guest: { select: { id: true, name: true, groupId: true, isVip: true, isChild: true } } },
      }),
    ]);

    const seatedIds = new Set(tables.flatMap((t) => t.seats.map((s) => s.guestId)));

    res.json({
      tables,
      rules: rules.map((r) => ({ ...r, guestIds: r.guestIds.split(',').filter(Boolean) })),
      confirmed: confirmed.length,
      unassigned: confirmed
        .filter((invite) => !seatedIds.has(invite.guestId))
        .map((invite) => invite.guest),
      capacity: tables.reduce((sum, t) => sum + t.capacity, 0),
    });
  }),
);

/** Creates or resizes the table grid in one call. */
seatingRouter.post(
  '/:phaseId/seating/tables',
  requireCapability('seating:write'),
  asyncRoute(async (req, res) => {
    const { tableCount, seatsPerTable, vipTables, childrenTables } = parseBody(
      z.object({
        tableCount: z.number().int().min(1).max(400),
        seatsPerTable: z.number().int().min(1).max(40),
        vipTables: z.number().int().min(0).max(20).default(0),
        childrenTables: z.number().int().min(0).max(20).default(0),
      }),
      req.body,
    );
    await loadPhase(req.params.eventId!, req.params.phaseId!);

    if (vipTables + childrenTables > tableCount) {
      throw badRequest('VIP and children tables cannot exceed the total table count');
    }

    const existing = await prisma.seatingTable.findMany({
      where: { phaseId: req.params.phaseId },
      orderBy: { number: 'asc' },
    });

    // Shrinking removes the highest-numbered tables (and their assignments).
    const doomed = existing.filter((t) => t.number > tableCount).map((t) => t.id);
    if (doomed.length > 0) {
      await prisma.seatingTable.deleteMany({ where: { id: { in: doomed } } });
    }

    for (let number = 1; number <= tableCount; number++) {
      const kind = number <= vipTables ? 'vip' : number > tableCount - childrenTables ? 'children' : 'standard';
      await prisma.seatingTable.upsert({
        where: { phaseId_number: { phaseId: req.params.phaseId!, number } },
        create: { phaseId: req.params.phaseId!, number, capacity: seatsPerTable, kind },
        update: { capacity: seatsPerTable, kind },
      });
    }

    const tables = await prisma.seatingTable.findMany({
      where: { phaseId: req.params.phaseId },
      orderBy: { number: 'asc' },
    });
    res.status(201).json(tables);
  }),
);

/**
 * One-click allocation. Unlocked tables are cleared and refilled; locked
 * tables keep their guests. Returns the arrangement plus anyone we could not
 * seat and why, rather than failing silently.
 */
seatingRouter.post(
  '/:phaseId/seating/generate',
  requireCapability('seating:write'),
  asyncRoute(async (req, res) => {
    const { seed } = parseBody(z.object({ seed: z.number().int().optional() }), req.body ?? {});
    await loadPhase(req.params.eventId!, req.params.phaseId!);

    const [tables, rules, invites] = await Promise.all([
      prisma.seatingTable.findMany({
        where: { phaseId: req.params.phaseId },
        orderBy: { number: 'asc' },
        include: { seats: true },
      }),
      prisma.seatingRule.findMany({ where: { phaseId: req.params.phaseId } }),
      prisma.phaseInvite.findMany({
        where: { phaseId: req.params.phaseId, status: 'attending' },
        include: { guest: true },
      }),
    ]);

    if (tables.length === 0) throw badRequest('Create the table layout before generating seating');

    const guests: SeatingGuest[] = invites.map(({ guest, partySize }) => ({
      id: guest.id,
      name: guest.name,
      groupId: guest.groupId,
      isVip: guest.isVip,
      isChild: guest.isChild,
      seats: Math.max(1, partySize),
    }));

    const result = generateSeating(
      guests,
      tables.map((t) => ({
        id: t.id,
        number: t.number,
        capacity: t.capacity,
        kind: t.kind,
        locked: t.locked,
        occupants: t.seats.map((s) => s.guestId),
      })),
      rules.map((r) => ({ kind: r.kind, guestIds: r.guestIds.split(',').filter(Boolean) })),
      seed ?? Date.now(),
    );

    const unlockedIds = tables.filter((t) => !t.locked).map((t) => t.id);
    await prisma.$transaction([
      prisma.seatAssignment.deleteMany({ where: { tableId: { in: unlockedIds } } }),
      ...result.assignments.map((a) =>
        prisma.seatAssignment.create({
          data: { tableId: a.tableId, guestId: a.guestId, seatNo: a.seatNo },
        }),
      ),
    ]);

    res.json({ seed: seed ?? null, ...result });
  }),
);

/** Manual override: move one guest to a specific table. */
seatingRouter.post(
  '/:phaseId/seating/move',
  requireCapability('seating:write'),
  asyncRoute(async (req, res) => {
    const { guestId, tableId } = parseBody(
      z.object({ guestId: z.string(), tableId: z.string().nullable() }),
      req.body,
    );

    const tableIds = (
      await prisma.seatingTable.findMany({
        where: { phaseId: req.params.phaseId },
        select: { id: true },
      })
    ).map((t) => t.id);

    await prisma.seatAssignment.deleteMany({
      where: { guestId, tableId: { in: tableIds } },
    });

    if (tableId === null) {
      res.json({ guestId, tableId: null });
      return;
    }

    const table = await prisma.seatingTable.findFirst({
      where: { id: tableId, phaseId: req.params.phaseId },
      include: { seats: true },
    });
    if (!table) throw notFound('Table');
    if (table.seats.length >= table.capacity) {
      throw badRequest(`Table ${table.number} is already at its capacity of ${table.capacity}`);
    }

    const assignment = await prisma.seatAssignment.create({
      data: { tableId, guestId, seatNo: table.seats.length + 1 },
    });
    res.json(assignment);
  }),
);

seatingRouter.patch(
  '/:phaseId/seating/tables/:tableId',
  requireCapability('seating:write'),
  asyncRoute(async (req, res) => {
    const body = parseBody(
      z.object({
        locked: z.boolean().optional(),
        name: z.string().max(60).optional(),
        capacity: z.number().int().min(1).max(40).optional(),
        kind: z.enum(['standard', 'vip', 'children', 'head']).optional(),
      }),
      req.body,
    );
    const table = await prisma.seatingTable.update({
      where: { id: req.params.tableId },
      data: body,
    });
    res.json(table);
  }),
);

// --- Rules ----------------------------------------------------------------

seatingRouter.post(
  '/:phaseId/seating/rules',
  requireCapability('seating:write'),
  asyncRoute(async (req, res) => {
    const body = parseBody(
      z.object({
        kind: z.enum(['together', 'apart', 'vip', 'children']),
        guestIds: z.array(z.string()).min(1),
      }),
      req.body,
    );
    if (body.kind === 'apart' && body.guestIds.length < 2) {
      throw badRequest('A "must not sit together" rule needs at least two guests');
    }
    const rule = await prisma.seatingRule.create({
      data: {
        phaseId: req.params.phaseId!,
        kind: body.kind,
        guestIds: body.guestIds.join(','),
      },
    });
    res.status(201).json({ ...rule, guestIds: body.guestIds });
  }),
);

seatingRouter.delete(
  '/:phaseId/seating/rules/:ruleId',
  requireCapability('seating:write'),
  asyncRoute(async (req, res) => {
    await prisma.seatingRule.delete({ where: { id: req.params.ruleId } });
    res.status(204).end();
  }),
);
