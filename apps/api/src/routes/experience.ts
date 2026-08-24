import { Router } from 'express';
import { z } from 'zod';
import { prisma } from '../lib/prisma.js';
import { asyncRoute, notFound, parseBody } from '../lib/http.js';
import { requireAuth, requireCapability, requireEventAccess } from '../middleware/auth.js';

export const experienceRouter = Router({ mergeParams: true });

experienceRouter.use(requireAuth, requireEventAccess);

// --- Menu -----------------------------------------------------------------

/**
 * Menu for one phase plus the live caterer count. The count is what makes this
 * module operationally valuable: dish-by-dish and dietary-tag totals, derived
 * from guest selections rather than re-keyed by hand.
 */
experienceRouter.get(
  '/phases/:phaseId/menu',
  asyncRoute(async (req, res) => {
    const courses = await prisma.menuCourse.findMany({
      where: { phaseId: req.params.phaseId },
      orderBy: { position: 'asc' },
      include: {
        items: {
          orderBy: { position: 'asc' },
          include: { _count: { select: { selections: true } } },
        },
      },
    });

    const dietary = new Map<string, number>();
    for (const course of courses) {
      for (const item of course.items) {
        const tags = item.dietary.split(',').map((t) => t.trim()).filter(Boolean);
        const labels = tags.length > 0 ? tags : ['Non-vegetarian'];
        for (const tag of labels) {
          dietary.set(tag, (dietary.get(tag) ?? 0) + item._count.selections);
        }
      }
    }

    const attending = await prisma.phaseInvite.count({
      where: { phaseId: req.params.phaseId, status: 'attending' },
    });
    const chosen = await prisma.menuSelection.findMany({
      where: { item: { course: { phaseId: req.params.phaseId } } },
      select: { guestId: true },
    });

    res.json({
      courses,
      catererCount: {
        attending,
        selected: new Set(chosen.map((c) => c.guestId)).size,
        dietary: [...dietary.entries()]
          .map(([label, count]) => ({ label, count }))
          .sort((a, b) => b.count - a.count),
      },
    });
  }),
);

experienceRouter.post(
  '/phases/:phaseId/menu/courses',
  requireCapability('menu:write'),
  asyncRoute(async (req, res) => {
    const body = parseBody(
      z.object({ name: z.string().min(1).max(60), choose: z.number().int().min(0).max(5).default(1) }),
      req.body,
    );
    const count = await prisma.menuCourse.count({ where: { phaseId: req.params.phaseId } });
    const course = await prisma.menuCourse.create({
      data: { ...body, phaseId: req.params.phaseId!, position: count },
      include: { items: true },
    });
    res.status(201).json(course);
  }),
);

experienceRouter.post(
  '/menu/courses/:courseId/items',
  requireCapability('menu:write'),
  asyncRoute(async (req, res) => {
    const body = parseBody(
      z.object({
        name: z.string().min(1).max(120),
        description: z.string().default(''),
        dietary: z.string().default(''),
        allergens: z.string().default(''),
      }),
      req.body,
    );
    const count = await prisma.menuItem.count({ where: { courseId: req.params.courseId } });
    const item = await prisma.menuItem.create({
      data: { ...body, courseId: req.params.courseId!, position: count },
    });
    res.status(201).json(item);
  }),
);

experienceRouter.delete(
  '/menu/items/:itemId',
  requireCapability('menu:write'),
  asyncRoute(async (req, res) => {
    await prisma.menuItem.delete({ where: { id: req.params.itemId } });
    res.status(204).end();
  }),
);

// --- Polls ----------------------------------------------------------------

experienceRouter.get(
  '/polls',
  asyncRoute(async (req, res) => {
    const polls = await prisma.poll.findMany({
      where: { eventId: req.params.eventId },
      orderBy: { createdAt: 'desc' },
      include: {
        phase: { select: { id: true, name: true } },
        options: { orderBy: { position: 'asc' }, include: { _count: { select: { votes: true } } } },
      },
    });

    res.json(
      polls.map((poll) => {
        const total = poll.options.reduce((s, o) => s + o._count.votes, 0);
        return {
          ...poll,
          totalVotes: total,
          options: poll.options.map((o) => ({
            id: o.id,
            label: o.label,
            votes: o._count.votes,
            pct: total === 0 ? 0 : Math.round((o._count.votes / total) * 100),
          })),
        };
      }),
    );
  }),
);

experienceRouter.post(
  '/polls',
  requireCapability('poll:write'),
  asyncRoute(async (req, res) => {
    const body = parseBody(
      z.object({
        question: z.string().min(1).max(300),
        kind: z.enum(['single', 'multi', 'yesno', 'rating']).default('single'),
        audience: z.enum(['guests', 'teams', 'all']).default('guests'),
        phaseId: z.string().nullable().default(null),
        anonymous: z.boolean().default(true),
        options: z.array(z.string().min(1)).min(2).max(10),
      }),
      req.body,
    );
    const { options, ...rest } = body;
    const poll = await prisma.poll.create({
      data: {
        ...rest,
        eventId: req.params.eventId!,
        options: { create: options.map((label, position) => ({ label, position })) },
      },
      include: { options: true },
    });
    res.status(201).json(poll);
  }),
);

experienceRouter.patch(
  '/polls/:pollId',
  requireCapability('poll:write'),
  asyncRoute(async (req, res) => {
    const body = parseBody(z.object({ closed: z.boolean() }), req.body);
    const poll = await prisma.poll.update({ where: { id: req.params.pollId }, data: body });
    res.json(poll);
  }),
);

// --- Announcements --------------------------------------------------------

experienceRouter.get(
  '/announcements',
  asyncRoute(async (req, res) => {
    const items = await prisma.announcement.findMany({
      where: { eventId: req.params.eventId },
      orderBy: { createdAt: 'desc' },
      take: 100,
      include: { author: { select: { id: true, name: true, avatarColor: true } } },
    });
    res.json(items);
  }),
);

/**
 * Broadcast. `channels` records the delivery fan-out the notification worker
 * would pick up; an urgent broadcast is the emergency mode from PRD 6.7.
 */
experienceRouter.post(
  '/announcements',
  requireCapability('comms:send'),
  asyncRoute(async (req, res) => {
    const body = parseBody(
      z.object({
        body: z.string().min(1).max(2000),
        audience: z.string().default('all_guests'),
        channels: z.array(z.enum(['in_app', 'email', 'sms', 'push'])).default(['in_app']),
        urgent: z.boolean().default(false),
      }),
      req.body,
    );

    const announcement = await prisma.announcement.create({
      data: {
        eventId: req.params.eventId!,
        authorId: req.user!.id,
        body: body.body,
        audience: body.audience,
        channels: body.channels.join(','),
        urgent: body.urgent,
      },
      include: { author: { select: { id: true, name: true } } },
    });

    await prisma.notification.create({
      data: {
        eventId: req.params.eventId!,
        kind: 'announcement',
        title: body.urgent ? 'Emergency broadcast sent' : 'Announcement sent',
        body: body.body.slice(0, 180),
        severity: body.urgent ? 'critical' : 'info',
      },
    });

    res.status(201).json(announcement);
  }),
);

// --- Media ----------------------------------------------------------------

experienceRouter.get(
  '/albums',
  asyncRoute(async (req, res) => {
    const albums = await prisma.album.findMany({
      where: { eventId: req.params.eventId },
      orderBy: { createdAt: 'asc' },
      include: {
        phase: { select: { id: true, name: true } },
        _count: { select: { items: true } },
        items: { take: 4, orderBy: { createdAt: 'desc' }, select: { id: true, url: true } },
      },
    });
    res.json(albums);
  }),
);

experienceRouter.post(
  '/albums',
  requireCapability('media:write'),
  asyncRoute(async (req, res) => {
    const body = parseBody(
      z.object({
        name: z.string().min(1).max(120),
        phaseId: z.string().nullable().default(null),
        guestUploads: z.boolean().default(true),
        downloads: z.enum(['none', 'guests', 'all']).default('guests'),
      }),
      req.body,
    );
    const album = await prisma.album.create({
      data: { ...body, eventId: req.params.eventId! },
      include: { _count: { select: { items: true } } },
    });
    res.status(201).json(album);
  }),
);

experienceRouter.get(
  '/albums/:albumId/items',
  asyncRoute(async (req, res) => {
    const album = await prisma.album.findFirst({
      where: { id: req.params.albumId, eventId: req.params.eventId },
    });
    if (!album) throw notFound('Album');
    const items = await prisma.mediaItem.findMany({
      where: { albumId: req.params.albumId },
      orderBy: { createdAt: 'desc' },
      include: { guest: { select: { id: true, name: true } } },
    });
    res.json(items);
  }),
);

experienceRouter.post(
  '/albums/:albumId/items',
  requireCapability('media:write'),
  asyncRoute(async (req, res) => {
    const body = parseBody(
      z.object({
        url: z.string().url(),
        kind: z.enum(['photo', 'video']).default('photo'),
        caption: z.string().default(''),
      }),
      req.body,
    );
    const item = await prisma.mediaItem.create({
      data: { ...body, albumId: req.params.albumId! },
    });
    res.status(201).json(item);
  }),
);

experienceRouter.delete(
  '/media/:itemId',
  requireCapability('media:moderate'),
  asyncRoute(async (req, res) => {
    await prisma.mediaItem.delete({ where: { id: req.params.itemId } });
    res.status(204).end();
  }),
);

// --- Notifications --------------------------------------------------------

experienceRouter.get(
  '/notifications',
  asyncRoute(async (req, res) => {
    const items = await prisma.notification.findMany({
      where: { eventId: req.params.eventId },
      orderBy: { createdAt: 'desc' },
      take: 50,
    });
    res.json(items);
  }),
);
