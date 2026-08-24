import { Router } from 'express';
import { z } from 'zod';
import { prisma } from '../lib/prisma.js';
import { asyncRoute, badRequest, notFound, parseBody } from '../lib/http.js';
import { requireAuth, requireCapability, requireEventAccess } from '../middleware/auth.js';

export const ticketsRouter = Router({ mergeParams: true });

ticketsRouter.use(requireAuth, requireEventAccess);

ticketsRouter.get(
  '/',
  asyncRoute(async (req, res) => {
    const types = await prisma.ticketType.findMany({
      where: { phase: { eventId: req.params.eventId } },
      orderBy: [{ phaseId: 'asc' }, { position: 'asc' }],
      include: {
        phase: { select: { id: true, name: true, capacity: true } },
        tickets: { select: { status: true } },
      },
    });

    res.json(
      types.map(({ tickets, ...type }) => ({
        ...type,
        sold: tickets.length,
        checkedIn: tickets.filter((t) => t.status === 'checked_in').length,
        remaining: type.capacity === 0 ? null : Math.max(0, type.capacity - tickets.length),
      })),
    );
  }),
);

ticketsRouter.post(
  '/types',
  requireCapability('ticket:write'),
  asyncRoute(async (req, res) => {
    const body = parseBody(
      z.object({
        phaseId: z.string(),
        name: z.string().min(1).max(80),
        price: z.number().nonnegative().default(0),
        capacity: z.number().int().nonnegative().default(0),
        perks: z.string().default(''),
      }),
      req.body,
    );
    const phase = await prisma.phase.findFirst({
      where: { id: body.phaseId, eventId: req.params.eventId },
    });
    if (!phase) throw notFound('Phase');

    const count = await prisma.ticketType.count({ where: { phaseId: body.phaseId } });
    const type = await prisma.ticketType.create({ data: { ...body, position: count } });
    res.status(201).json(type);
  }),
);

/** Issues a ticket to a guest, respecting the type's capacity. */
ticketsRouter.post(
  '/issue',
  requireCapability('ticket:write'),
  asyncRoute(async (req, res) => {
    const { ticketTypeId, guestId, seatLabel } = parseBody(
      z.object({
        ticketTypeId: z.string(),
        guestId: z.string().nullable().default(null),
        seatLabel: z.string().default(''),
      }),
      req.body,
    );

    const type = await prisma.ticketType.findFirst({
      where: { id: ticketTypeId, phase: { eventId: req.params.eventId } },
      include: { _count: { select: { tickets: true } } },
    });
    if (!type) throw notFound('Ticket type');
    if (type.capacity > 0 && type._count.tickets >= type.capacity) {
      throw badRequest(`"${type.name}" is sold out`);
    }

    const ticket = await prisma.ticket.create({
      data: { ticketTypeId, guestId, seatLabel },
      include: { guest: { select: { id: true, name: true } }, ticketType: true },
    });
    res.status(201).json(ticket);
  }),
);

/** Scan endpoint used by door staff. Idempotent per ticket. */
ticketsRouter.post(
  '/checkin',
  requireCapability('checkin:scan'),
  asyncRoute(async (req, res) => {
    const { code } = parseBody(z.object({ code: z.string().min(1) }), req.body);

    const ticket = await prisma.ticket.findFirst({
      where: { code, ticketType: { phase: { eventId: req.params.eventId } } },
      include: {
        guest: { select: { id: true, name: true, isVip: true } },
        ticketType: { select: { name: true, phase: { select: { name: true } } } },
      },
    });
    if (!ticket) throw notFound('Ticket');
    if (ticket.status === 'cancelled') throw badRequest('This ticket was cancelled');

    if (ticket.status === 'checked_in') {
      res.json({ alreadyCheckedIn: true, ticket });
      return;
    }

    const updated = await prisma.ticket.update({
      where: { id: ticket.id },
      data: { status: 'checked_in', checkedInAt: new Date() },
      include: {
        guest: { select: { id: true, name: true, isVip: true } },
        ticketType: { select: { name: true, phase: { select: { name: true } } } },
      },
    });
    res.json({ alreadyCheckedIn: false, ticket: updated });
  }),
);
