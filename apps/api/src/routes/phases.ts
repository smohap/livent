import { Router } from 'express';
import { z } from 'zod';
import { prisma } from '../lib/prisma.js';
import { asyncRoute, notFound, parseBody } from '../lib/http.js';
import { requireAuth, requireCapability, requireEventAccess } from '../middleware/auth.js';

export const phasesRouter = Router({ mergeParams: true });

phasesRouter.use(requireAuth, requireEventAccess);

phasesRouter.get(
  '/',
  asyncRoute(async (req, res) => {
    const phases = await prisma.phase.findMany({
      where: { eventId: req.params.eventId },
      orderBy: { position: 'asc' },
      include: {
        _count: { select: { invites: true, tables: true, scheduleItems: true } },
        invites: { select: { status: true } },
      },
    });

    res.json(
      phases.map(({ invites, ...phase }) => {
        const responded = invites.filter((i) =>
          ['attending', 'declined', 'maybe'].includes(i.status),
        ).length;
        return {
          ...phase,
          invited: invites.length,
          attending: invites.filter((i) => i.status === 'attending').length,
          rsvpRate: invites.length === 0 ? 0 : Math.round((responded / invites.length) * 100),
        };
      }),
    );
  }),
);

const phaseBody = z.object({
  name: z.string().min(1).max(120),
  displayName: z.string().default(''),
  description: z.string().default(''),
  date: z.string().datetime().nullable().optional(),
  startTime: z.string().default(''),
  endTime: z.string().default(''),
  venue: z.string().default(''),
  address: z.string().default(''),
  mapUrl: z.string().default(''),
  dressCode: z.string().default(''),
  capacity: z.number().int().nonnegative().default(0),
  requiresRsvp: z.boolean().default(true),
  requiresSeating: z.boolean().default(false),
  requiresMenu: z.boolean().default(false),
  requiresTicket: z.boolean().default(false),
});

phasesRouter.post(
  '/',
  requireCapability('phase:write'),
  asyncRoute(async (req, res) => {
    const body = parseBody(phaseBody, req.body);
    const count = await prisma.phase.count({ where: { eventId: req.params.eventId } });
    const phase = await prisma.phase.create({
      data: {
        ...body,
        date: body.date ? new Date(body.date) : null,
        eventId: req.params.eventId!,
        position: count,
      },
    });
    res.status(201).json(phase);
  }),
);

phasesRouter.get(
  '/:phaseId',
  asyncRoute(async (req, res) => {
    const phase = await prisma.phase.findFirst({
      where: { id: req.params.phaseId, eventId: req.params.eventId },
      include: {
        scheduleItems: { orderBy: [{ startTime: 'asc' }, { position: 'asc' }] },
        menuCourses: { orderBy: { position: 'asc' }, include: { items: { orderBy: { position: 'asc' } } } },
        tables: { orderBy: { number: 'asc' }, include: { seats: { include: { guest: true } } } },
        ticketTypes: { orderBy: { position: 'asc' }, include: { _count: { select: { tickets: true } } } },
      },
    });
    if (!phase) throw notFound('Phase');
    res.json(phase);
  }),
);

phasesRouter.patch(
  '/:phaseId',
  requireCapability('phase:write'),
  asyncRoute(async (req, res) => {
    const body = parseBody(phaseBody.partial(), req.body);
    const existing = await prisma.phase.findFirst({
      where: { id: req.params.phaseId, eventId: req.params.eventId },
    });
    if (!existing) throw notFound('Phase');

    const phase = await prisma.phase.update({
      where: { id: req.params.phaseId },
      data: {
        ...body,
        ...(body.date !== undefined ? { date: body.date ? new Date(body.date) : null } : {}),
      },
    });
    res.json(phase);
  }),
);

phasesRouter.delete(
  '/:phaseId',
  requireCapability('phase:write'),
  asyncRoute(async (req, res) => {
    const existing = await prisma.phase.findFirst({
      where: { id: req.params.phaseId, eventId: req.params.eventId },
    });
    if (!existing) throw notFound('Phase');
    await prisma.phase.delete({ where: { id: req.params.phaseId } });
    res.status(204).end();
  }),
);

/** Drag-and-drop reordering of the phase rail. */
phasesRouter.post(
  '/reorder',
  requireCapability('phase:write'),
  asyncRoute(async (req, res) => {
    const { order } = parseBody(z.object({ order: z.array(z.string()) }), req.body);
    await prisma.$transaction(
      order.map((id, index) =>
        prisma.phase.updateMany({
          where: { id, eventId: req.params.eventId },
          data: { position: index },
        }),
      ),
    );
    res.json({ ok: true });
  }),
);

// --- Schedule -------------------------------------------------------------

const scheduleBody = z.object({
  title: z.string().min(1),
  detail: z.string().default(''),
  startTime: z.string().min(1),
  endTime: z.string().default(''),
  location: z.string().default(''),
  ownerTeam: z.string().default(''),
  status: z.enum(['upcoming', 'live', 'done']).default('upcoming'),
});

phasesRouter.post(
  '/:phaseId/schedule',
  requireCapability('phase:write'),
  asyncRoute(async (req, res) => {
    const body = parseBody(scheduleBody, req.body);
    const count = await prisma.scheduleItem.count({ where: { phaseId: req.params.phaseId } });
    const item = await prisma.scheduleItem.create({
      data: { ...body, phaseId: req.params.phaseId!, position: count },
    });
    res.status(201).json(item);
  }),
);

phasesRouter.patch(
  '/:phaseId/schedule/:itemId',
  requireCapability('phase:write'),
  asyncRoute(async (req, res) => {
    const body = parseBody(scheduleBody.partial(), req.body);
    const item = await prisma.scheduleItem.update({
      where: { id: req.params.itemId },
      data: body,
    });
    res.json(item);
  }),
);

phasesRouter.delete(
  '/:phaseId/schedule/:itemId',
  requireCapability('phase:write'),
  asyncRoute(async (req, res) => {
    await prisma.scheduleItem.delete({ where: { id: req.params.itemId } });
    res.status(204).end();
  }),
);
