import { Router } from 'express';
import { z } from 'zod';
import { prisma } from '../lib/prisma.js';
import { asyncRoute, notFound, parseBody } from '../lib/http.js';
import { requireAuth, requireCapability, requireEventAccess } from '../middleware/auth.js';
import { capabilitiesFor } from '../lib/rbac.js';
import { buildEventHealth } from '../services/insights.js';
import { findTemplate, slugify, TEMPLATES } from '../services/templates.js';

export const eventsRouter = Router();

eventsRouter.get(
  '/templates',
  asyncRoute(async (_req, res) => {
    res.json(TEMPLATES);
  }),
);

eventsRouter.use(requireAuth);

/** Every event the caller owns or is a member of. */
eventsRouter.get(
  '/',
  asyncRoute(async (req, res) => {
    const events = await prisma.event.findMany({
      where: {
        OR: [{ ownerId: req.user!.id }, { memberships: { some: { userId: req.user!.id } } }],
      },
      orderBy: { startDate: 'asc' },
      include: {
        phases: { orderBy: { position: 'asc' }, select: { id: true, name: true, date: true } },
        _count: { select: { guests: true, tasks: true } },
      },
    });
    res.json(events);
  }),
);

const createBody = z.object({
  name: z.string().min(1).max(160),
  type: z.string().default('wedding'),
  template: z.string().default('wedding'),
  hostNames: z.string().default(''),
  description: z.string().default(''),
  location: z.string().default(''),
  currency: z.string().default('NZD'),
  timezone: z.string().default('Pacific/Auckland'),
  startDate: z.string().datetime().optional(),
  totalBudget: z.number().nonnegative().default(0),
});

/**
 * Creates a master event and materialises the chosen template's phases, teams
 * and budget categories in one transaction, so the organiser lands on a shaped
 * event rather than an empty shell.
 */
eventsRouter.post(
  '/',
  asyncRoute(async (req, res) => {
    const body = parseBody(createBody, req.body);
    const template = findTemplate(body.template);
    const start = body.startDate ? new Date(body.startDate) : new Date();

    let slug = slugify(body.name) || 'event';
    if (await prisma.event.findUnique({ where: { slug } })) {
      slug = `${slug}-${Math.random().toString(36).slice(2, 6)}`;
    }

    const event = await prisma.event.create({
      data: {
        slug,
        name: body.name,
        type: body.type,
        category: template.category,
        hostNames: body.hostNames,
        description: body.description,
        location: body.location,
        currency: body.currency,
        timezone: body.timezone,
        startDate: start,
        totalBudget: body.totalBudget,
        ownerId: req.user!.id,
        phases: {
          create: template.phases.map((phase, index) => ({
            name: phase.name,
            position: index,
            date: new Date(start.getTime() + (phase.dayOffset ?? 0) * 86_400_000),
            requiresSeating: phase.requiresSeating ?? false,
            requiresMenu: phase.requiresMenu ?? false,
            requiresTicket: phase.requiresTicket ?? false,
          })),
        },
        teams: { create: template.teams.map((name) => ({ name })) },
        budgetLines: {
          create: template.budgetCategories.map((category) => ({ category })),
        },
      },
      include: { phases: true, teams: true },
    });

    res.status(201).json(event);
  }),
);

eventsRouter.get(
  '/:eventId',
  requireEventAccess,
  asyncRoute(async (req, res) => {
    const event = await prisma.event.findUnique({
      where: { id: req.params.eventId },
      include: {
        phases: { orderBy: { position: 'asc' } },
        teams: { orderBy: { name: 'asc' } },
        groups: { orderBy: { name: 'asc' } },
        owner: { select: { id: true, name: true, email: true } },
      },
    });
    if (!event) throw notFound('Event');
    res.json({
      ...event,
      role: req.membership!.role,
      capabilities: capabilitiesFor(req.membership!.role),
    });
  }),
);

const updateBody = createBody.partial().extend({
  privacy: z.enum(['public', 'private', 'unlisted']).optional(),
  coverUrl: z.string().url().nullable().optional(),
  logoUrl: z.string().url().nullable().optional(),
  endDate: z.string().datetime().nullable().optional(),
});

eventsRouter.patch(
  '/:eventId',
  requireEventAccess,
  requireCapability('event:write'),
  asyncRoute(async (req, res) => {
    const body = parseBody(updateBody, req.body);
    const { template, startDate, endDate, ...rest } = body;
    const event = await prisma.event.update({
      where: { id: req.params.eventId },
      data: {
        ...rest,
        ...(startDate ? { startDate: new Date(startDate) } : {}),
        ...(endDate !== undefined ? { endDate: endDate ? new Date(endDate) : null } : {}),
      },
    });
    res.json(event);
  }),
);

eventsRouter.get(
  '/:eventId/health',
  requireEventAccess,
  asyncRoute(async (req, res) => {
    res.json(await buildEventHealth(req.params.eventId!));
  }),
);

eventsRouter.get(
  '/:eventId/members',
  requireEventAccess,
  asyncRoute(async (req, res) => {
    const members = await prisma.membership.findMany({
      where: { eventId: req.params.eventId },
      include: {
        user: { select: { id: true, name: true, email: true, avatarColor: true } },
        team: { select: { id: true, name: true } },
      },
    });
    res.json(members);
  }),
);

const memberBody = z.object({
  email: z.string().email(),
  role: z.string(),
  teamId: z.string().nullable().optional(),
});

eventsRouter.post(
  '/:eventId/members',
  requireEventAccess,
  requireCapability('member:manage'),
  asyncRoute(async (req, res) => {
    const body = parseBody(memberBody, req.body);
    const user = await prisma.user.findUnique({ where: { email: body.email.toLowerCase() } });
    if (!user) throw notFound('User with that email');

    const membership = await prisma.membership.upsert({
      where: { userId_eventId: { userId: user.id, eventId: req.params.eventId! } },
      create: {
        userId: user.id,
        eventId: req.params.eventId!,
        role: body.role,
        teamId: body.teamId ?? null,
      },
      update: { role: body.role, teamId: body.teamId ?? null },
      include: { user: { select: { id: true, name: true, email: true } } },
    });
    res.status(201).json(membership);
  }),
);
