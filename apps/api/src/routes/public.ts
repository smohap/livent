import { Router } from 'express';
import { z } from 'zod';
import { prisma } from '../lib/prisma.js';
import { asyncRoute, badRequest, forbidden, notFound, parseBody } from '../lib/http.js';

export const publicRouter = Router();

/**
 * Guest-facing surface. Authenticated by the opaque per-guest `accessToken`
 * rather than a login, so a guest can act straight from their invitation link
 * without creating an account (PRD section 45: mobile-first, no install).
 *
 * Every handler here scopes strictly to the token's own event and guest row.
 */

async function guestByToken(token: string) {
  const guest = await prisma.guest.findUnique({
    where: { accessToken: token },
    include: { event: true },
  });
  if (!guest) throw notFound('Invitation');
  return guest;
}

/** The public event mini-site (PRD: events.evyent.com/name). */
publicRouter.get(
  '/events/:slug',
  asyncRoute(async (req, res) => {
    const event = await prisma.event.findUnique({
      where: { slug: req.params.slug },
      include: {
        phases: {
          orderBy: { position: 'asc' },
          include: { scheduleItems: { orderBy: { startTime: 'asc' } } },
        },
      },
    });
    if (!event) throw notFound('Event');
    if (event.privacy === 'private') throw forbidden('This event is private');

    res.json({
      id: event.id,
      slug: event.slug,
      name: event.name,
      hostNames: event.hostNames,
      description: event.description,
      location: event.location,
      startDate: event.startDate,
      currency: event.currency,
      coverUrl: event.coverUrl,
      phases: event.phases.map((phase) => ({
        id: phase.id,
        name: phase.name,
        description: phase.description,
        date: phase.date,
        startTime: phase.startTime,
        endTime: phase.endTime,
        venue: phase.venue,
        address: phase.address,
        mapUrl: phase.mapUrl,
        dressCode: phase.dressCode,
        schedule: phase.scheduleItems,
      })),
    });
  }),
);

/**
 * Everything one guest needs, in one payload: which phases they are invited
 * to and their status on each, their table, their meal, their tickets.
 * This is the single unified view the PRD contrasts with five disconnected
 * invitations.
 */
publicRouter.get(
  '/me/:token',
  asyncRoute(async (req, res) => {
    const guest = await guestByToken(req.params.token!);

    const [invites, seats, selections, tickets, announcements, gifts] = await Promise.all([
      prisma.phaseInvite.findMany({
        where: { guestId: guest.id },
        include: {
          phase: {
            include: {
              scheduleItems: { orderBy: { startTime: 'asc' } },
              menuCourses: { orderBy: { position: 'asc' }, include: { items: { orderBy: { position: 'asc' } } } },
            },
          },
        },
      }),
      prisma.seatAssignment.findMany({
        where: { guestId: guest.id },
        include: {
          table: {
            include: {
              phase: { select: { id: true, name: true } },
              seats: { include: { guest: { select: { id: true, name: true } } } },
            },
          },
        },
      }),
      prisma.menuSelection.findMany({
        where: { guestId: guest.id },
        include: { item: { include: { course: { select: { id: true, name: true, phaseId: true } } } } },
      }),
      prisma.ticket.findMany({
        where: { guestId: guest.id },
        include: { ticketType: { include: { phase: { select: { id: true, name: true } } } } },
      }),
      prisma.announcement.findMany({
        where: { eventId: guest.eventId },
        orderBy: { createdAt: 'desc' },
        take: 20,
        include: { author: { select: { name: true } } },
      }),
      prisma.gift.findMany({ where: { guestId: guest.id }, orderBy: { createdAt: 'desc' } }),
    ]);

    // Mark unseen invitations as viewed so organisers can see delivery landed.
    const unseen = invites.filter((i) => i.status === 'invited');
    if (unseen.length > 0) {
      await prisma.phaseInvite.updateMany({
        where: { id: { in: unseen.map((i) => i.id) } },
        data: { status: 'viewed', viewedAt: new Date() },
      });
    }

    res.json({
      guest: {
        id: guest.id,
        name: guest.name,
        email: guest.email,
        plusOnes: guest.plusOnes,
        dietary: guest.dietary,
        allergies: guest.allergies,
      },
      event: {
        id: guest.event.id,
        slug: guest.event.slug,
        name: guest.event.name,
        hostNames: guest.event.hostNames,
        startDate: guest.event.startDate,
        location: guest.event.location,
        currency: guest.event.currency,
      },
      phases: invites
        .sort((a, b) => a.phase.position - b.phase.position)
        .map((invite) => ({
          inviteId: invite.id,
          status: unseen.some((u) => u.id === invite.id) ? 'viewed' : invite.status,
          partySize: invite.partySize,
          adults: invite.adults,
          children: invite.children,
          transportNeeded: invite.transportNeeded,
          accommodationNeeded: invite.accommodationNeeded,
          phase: {
            id: invite.phase.id,
            name: invite.phase.name,
            description: invite.phase.description,
            date: invite.phase.date,
            startTime: invite.phase.startTime,
            venue: invite.phase.venue,
            address: invite.phase.address,
            mapUrl: invite.phase.mapUrl,
            dressCode: invite.phase.dressCode,
            requiresMenu: invite.phase.requiresMenu,
            schedule: invite.phase.scheduleItems,
            menu: invite.phase.menuCourses,
          },
        })),
      seating: seats.map((seat) => ({
        phaseId: seat.table.phase.id,
        phaseName: seat.table.phase.name,
        tableNumber: seat.table.number,
        tableName: seat.table.name,
        tablemates: seat.table.seats
          .filter((s) => s.guestId !== guest.id)
          .map((s) => s.guest.name),
      })),
      selections: selections.map((s) => ({
        itemId: s.itemId,
        itemName: s.item.name,
        courseId: s.item.course.id,
        courseName: s.item.course.name,
        phaseId: s.item.course.phaseId,
      })),
      tickets: tickets.map((t) => ({
        code: t.code,
        status: t.status,
        seatLabel: t.seatLabel,
        type: t.ticketType.name,
        phase: t.ticketType.phase.name,
      })),
      announcements,
      gifts,
    });
  }),
);

/**
 * One submission covers every phase - yes to the wedding, no to the mehendi,
 * in a single flow (PRD 6.2).
 */
publicRouter.post(
  '/me/:token/rsvp',
  asyncRoute(async (req, res) => {
    const guest = await guestByToken(req.params.token!);
    const body = parseBody(
      z.object({
        responses: z
          .array(
            z.object({
              phaseId: z.string(),
              status: z.enum(['attending', 'declined', 'maybe']),
              adults: z.number().int().min(0).max(20).default(1),
              children: z.number().int().min(0).max(20).default(0),
              transportNeeded: z.boolean().default(false),
              accommodationNeeded: z.boolean().default(false),
              message: z.string().max(1000).default(''),
            }),
          )
          .min(1),
        dietary: z.string().max(200).optional(),
        allergies: z.string().max(500).optional(),
      }),
      req.body,
    );

    // Only phases this guest was actually invited to may be answered.
    const invited = await prisma.phaseInvite.findMany({
      where: { guestId: guest.id },
      select: { phaseId: true },
    });
    const allowed = new Set(invited.map((i) => i.phaseId));
    const stray = body.responses.find((r) => !allowed.has(r.phaseId));
    if (stray) throw forbidden('You were not invited to one of the phases in this response');

    const now = new Date();
    await prisma.$transaction([
      ...body.responses.map((response) =>
        prisma.phaseInvite.update({
          where: { guestId_phaseId: { guestId: guest.id, phaseId: response.phaseId } },
          data: {
            status: response.status,
            adults: response.adults,
            children: response.children,
            partySize: Math.max(1, response.adults + response.children),
            transportNeeded: response.transportNeeded,
            accommodationNeeded: response.accommodationNeeded,
            message: response.message,
            respondedAt: now,
          },
        }),
      ),
      prisma.guest.update({
        where: { id: guest.id },
        data: {
          ...(body.dietary !== undefined ? { dietary: body.dietary } : {}),
          ...(body.allergies !== undefined ? { allergies: body.allergies } : {}),
        },
      }),
    ]);

    res.json({ ok: true, responded: body.responses.length });
  }),
);

/** Guest picks their meal. Replaces any previous pick within the same course. */
publicRouter.post(
  '/me/:token/menu',
  asyncRoute(async (req, res) => {
    const guest = await guestByToken(req.params.token!);
    const { itemId } = parseBody(z.object({ itemId: z.string() }), req.body);

    const item = await prisma.menuItem.findUnique({
      where: { id: itemId },
      include: { course: { include: { phase: true } } },
    });
    if (!item || item.course.phase.eventId !== guest.eventId) throw notFound('Menu item');

    const attending = await prisma.phaseInvite.findUnique({
      where: { guestId_phaseId: { guestId: guest.id, phaseId: item.course.phaseId } },
    });
    if (!attending || attending.status !== 'attending') {
      throw badRequest('RSVP as attending before choosing a meal for this phase');
    }

    const siblings = await prisma.menuItem.findMany({
      where: { courseId: item.courseId },
      select: { id: true },
    });
    await prisma.$transaction([
      prisma.menuSelection.deleteMany({
        where: { guestId: guest.id, itemId: { in: siblings.map((s) => s.id) } },
      }),
      prisma.menuSelection.create({ data: { guestId: guest.id, itemId } }),
    ]);

    res.json({ ok: true, itemId, courseId: item.courseId });
  }),
);

publicRouter.post(
  '/me/:token/vote',
  asyncRoute(async (req, res) => {
    const guest = await guestByToken(req.params.token!);
    const { optionId } = parseBody(z.object({ optionId: z.string() }), req.body);

    const option = await prisma.pollOption.findUnique({
      where: { id: optionId },
      include: { poll: { include: { options: { select: { id: true } } } } },
    });
    if (!option || option.poll.eventId !== guest.eventId) throw notFound('Poll option');
    if (option.poll.closed) throw badRequest('This poll has closed');

    await prisma.$transaction([
      ...(option.poll.kind === 'multi'
        ? []
        : [
            prisma.pollVote.deleteMany({
              where: { guestId: guest.id, optionId: { in: option.poll.options.map((o) => o.id) } },
            }),
          ]),
      prisma.pollVote.create({ data: { guestId: guest.id, optionId } }),
    ]);

    res.json({ ok: true });
  }),
);

publicRouter.get(
  '/me/:token/polls',
  asyncRoute(async (req, res) => {
    const guest = await guestByToken(req.params.token!);
    const polls = await prisma.poll.findMany({
      where: { eventId: guest.eventId, audience: { in: ['guests', 'all'] } },
      orderBy: { createdAt: 'desc' },
      include: { options: { orderBy: { position: 'asc' }, include: { votes: true } } },
    });

    res.json(
      polls.map((poll) => {
        const total = poll.options.reduce((s, o) => s + o.votes.length, 0);
        return {
          id: poll.id,
          question: poll.question,
          kind: poll.kind,
          closed: poll.closed,
          myVote: poll.options.find((o) => o.votes.some((v) => v.guestId === guest.id))?.id ?? null,
          options: poll.options.map((o) => ({
            id: o.id,
            label: o.label,
            votes: o.votes.length,
            pct: total === 0 ? 0 : Math.round((o.votes.length / total) * 100),
          })),
        };
      }),
    );
  }),
);

/**
 * Monetary gift. Evyent records the gift and a tokenised provider reference
 * only; card details never reach this service. In production the client would
 * complete payment with Stripe/Adyen first and post the resulting token here.
 */
publicRouter.post(
  '/me/:token/gift',
  asyncRoute(async (req, res) => {
    const guest = await guestByToken(req.params.token!);
    const body = parseBody(
      z.object({
        amount: z.number().positive().max(1_000_000),
        message: z.string().max(1000).default(''),
        anonymous: z.boolean().default(false),
        showAmount: z.boolean().default(false),
        kind: z.enum(['cash', 'group', 'charity', 'registry']).default('cash'),
        providerRef: z.string().max(200).default(''),
      }),
      req.body,
    );

    const gift = await prisma.gift.create({
      data: {
        eventId: guest.eventId,
        guestId: guest.id,
        fromName: body.anonymous ? 'Anonymous' : guest.name,
        amount: body.amount,
        currency: guest.event.currency,
        message: body.message,
        anonymous: body.anonymous,
        showAmount: body.showAmount,
        kind: body.kind,
        providerRef: body.providerRef,
        status: body.providerRef ? 'received' : 'pending',
      },
    });

    res.status(201).json({
      id: gift.id,
      amount: gift.amount,
      currency: gift.currency,
      status: gift.status,
    });
  }),
);

/** Albums a guest may see, with their contents. */
publicRouter.get(
  '/me/:token/albums',
  asyncRoute(async (req, res) => {
    const guest = await guestByToken(req.params.token!);
    const albums = await prisma.album.findMany({
      where: { eventId: guest.eventId },
      orderBy: { createdAt: 'asc' },
      include: {
        items: { orderBy: { createdAt: 'desc' }, take: 60 },
        _count: { select: { items: true } },
      },
    });
    res.json(albums);
  }),
);

publicRouter.post(
  '/me/:token/albums/:albumId/items',
  asyncRoute(async (req, res) => {
    const guest = await guestByToken(req.params.token!);
    const body = parseBody(
      z.object({
        url: z.string().url(),
        kind: z.enum(['photo', 'video']).default('photo'),
        caption: z.string().max(300).default(''),
      }),
      req.body,
    );

    const album = await prisma.album.findFirst({
      where: { id: req.params.albumId, eventId: guest.eventId },
    });
    if (!album) throw notFound('Album');
    if (!album.guestUploads) throw forbidden('Guest uploads are turned off for this album');

    const item = await prisma.mediaItem.create({
      data: { ...body, albumId: album.id, guestId: guest.id },
    });
    res.status(201).json(item);
  }),
);
