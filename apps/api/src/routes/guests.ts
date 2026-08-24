import { Router } from 'express';
import { z } from 'zod';
import { prisma } from '../lib/prisma.js';
import { asyncRoute, notFound, parseBody } from '../lib/http.js';
import { requireAuth, requireCapability, requireEventAccess } from '../middleware/auth.js';

export const guestsRouter = Router({ mergeParams: true });

guestsRouter.use(requireAuth, requireEventAccess, requireCapability('guest:read'));

/**
 * The guest table is the multi-phase RSVP matrix: one row per guest, one
 * column per phase. Returned flat so the client can render it directly.
 */
guestsRouter.get(
  '/',
  asyncRoute(async (req, res) => {
    const guests = await prisma.guest.findMany({
      where: { eventId: req.params.eventId },
      orderBy: { name: 'asc' },
      include: {
        group: { select: { id: true, name: true } },
        invites: { select: { phaseId: true, status: true, partySize: true } },
        seats: { select: { table: { select: { number: true, phaseId: true } } } },
      },
    });
    res.json(guests);
  }),
);

guestsRouter.get(
  '/groups',
  asyncRoute(async (req, res) => {
    const groups = await prisma.guestGroup.findMany({
      where: { eventId: req.params.eventId },
      orderBy: { name: 'asc' },
      include: { _count: { select: { guests: true } } },
    });
    res.json(groups);
  }),
);

guestsRouter.post(
  '/groups',
  requireCapability('guest:write'),
  asyncRoute(async (req, res) => {
    const body = parseBody(z.object({ name: z.string().min(1), colour: z.string().default('#ffffff') }), req.body);
    const group = await prisma.guestGroup.create({
      data: { ...body, eventId: req.params.eventId! },
    });
    res.status(201).json(group);
  }),
);

const guestBody = z.object({
  name: z.string().min(1).max(160),
  email: z.string().email().or(z.literal('')).default(''),
  phone: z.string().default(''),
  organisation: z.string().default(''),
  relationship: z.string().default(''),
  groupId: z.string().nullable().default(null),
  isVip: z.boolean().default(false),
  isChild: z.boolean().default(false),
  plusOnes: z.number().int().min(0).max(20).default(0),
  dietary: z.string().default(''),
  allergies: z.string().default(''),
  accessibility: z.string().default(''),
  notes: z.string().default(''),
  /** Phases this guest should be invited to. */
  phaseIds: z.array(z.string()).default([]),
});

guestsRouter.post(
  '/',
  requireCapability('guest:write'),
  asyncRoute(async (req, res) => {
    const { phaseIds, ...body } = parseBody(guestBody, req.body);
    const guest = await prisma.guest.create({
      data: {
        ...body,
        eventId: req.params.eventId!,
        invites: { create: phaseIds.map((phaseId) => ({ phaseId })) },
      },
      include: { invites: true },
    });
    res.status(201).json(guest);
  }),
);

/** Bulk add - the paste-a-spreadsheet path most organisers actually use. */
guestsRouter.post(
  '/bulk',
  requireCapability('guest:write'),
  asyncRoute(async (req, res) => {
    const body = parseBody(
      z.object({
        guests: z.array(guestBody.partial({ phaseIds: true })).min(1).max(2000),
        phaseIds: z.array(z.string()).default([]),
      }),
      req.body,
    );

    const created = await prisma.$transaction(
      body.guests.map((guest) => {
        const { phaseIds, ...rest } = guest;
        const targets = phaseIds && phaseIds.length > 0 ? phaseIds : body.phaseIds;
        return prisma.guest.create({
          data: {
            ...rest,
            eventId: req.params.eventId!,
            invites: { create: targets.map((phaseId) => ({ phaseId })) },
          },
        });
      }),
    );

    res.status(201).json({ created: created.length, guests: created });
  }),
);

guestsRouter.patch(
  '/:guestId',
  requireCapability('guest:write'),
  asyncRoute(async (req, res) => {
    const { phaseIds, ...body } = parseBody(guestBody.partial(), req.body);
    const existing = await prisma.guest.findFirst({
      where: { id: req.params.guestId, eventId: req.params.eventId },
    });
    if (!existing) throw notFound('Guest');

    const guest = await prisma.guest.update({
      where: { id: req.params.guestId },
      data: body,
      include: { invites: true },
    });
    res.json(guest);
  }),
);

guestsRouter.delete(
  '/:guestId',
  requireCapability('guest:write'),
  asyncRoute(async (req, res) => {
    const existing = await prisma.guest.findFirst({
      where: { id: req.params.guestId, eventId: req.params.eventId },
    });
    if (!existing) throw notFound('Guest');
    await prisma.guest.delete({ where: { id: req.params.guestId } });
    res.status(204).end();
  }),
);

/** Invite or un-invite a guest to a phase, or set their status directly. */
guestsRouter.put(
  '/:guestId/invites/:phaseId',
  requireCapability('rsvp:manage'),
  asyncRoute(async (req, res) => {
    const body = parseBody(
      z.object({
        status: z
          .enum(['invited', 'viewed', 'attending', 'declined', 'maybe', 'waitlisted', 'removed'])
          .default('invited'),
        partySize: z.number().int().min(1).max(30).optional(),
      }),
      req.body,
    );

    if (body.status === 'removed') {
      await prisma.phaseInvite.deleteMany({
        where: { guestId: req.params.guestId, phaseId: req.params.phaseId },
      });
      res.status(204).end();
      return;
    }

    const responded = ['attending', 'declined', 'maybe'].includes(body.status);
    const invite = await prisma.phaseInvite.upsert({
      where: {
        guestId_phaseId: { guestId: req.params.guestId!, phaseId: req.params.phaseId! },
      },
      create: {
        guestId: req.params.guestId!,
        phaseId: req.params.phaseId!,
        status: body.status,
        partySize: body.partySize ?? 1,
        respondedAt: responded ? new Date() : null,
      },
      update: {
        status: body.status,
        ...(body.partySize ? { partySize: body.partySize } : {}),
        respondedAt: responded ? new Date() : null,
      },
    });
    res.json(invite);
  }),
);

/** Personalised invitation + guest-portal links, ready to send. */
guestsRouter.get(
  '/:guestId/links',
  asyncRoute(async (req, res) => {
    const guest = await prisma.guest.findFirst({
      where: { id: req.params.guestId, eventId: req.params.eventId },
      include: { event: { select: { slug: true, name: true } } },
    });
    if (!guest) throw notFound('Guest');
    res.json({
      invitation: `/i/${guest.accessToken}`,
      portal: `/me/${guest.accessToken}`,
      eventSite: `/e/${guest.event.slug}`,
      token: guest.accessToken,
    });
  }),
);
