import { Router } from 'express';
import { z } from 'zod';
import { prisma } from '../lib/prisma.js';
import { asyncRoute, badRequest, notFound, parseBody } from '../lib/http.js';
import { requireAuth, requireCapability, requireEventAccess } from '../middleware/auth.js';
import { seesWholeEvent } from '../lib/rbac.js';

export const workRouter = Router({ mergeParams: true });

workRouter.use(requireAuth, requireEventAccess);

// --- Teams ----------------------------------------------------------------

workRouter.get(
  '/teams',
  asyncRoute(async (req, res) => {
    const teams = await prisma.team.findMany({
      where: { eventId: req.params.eventId },
      orderBy: { name: 'asc' },
      include: {
        _count: { select: { tasks: true, memberships: true } },
        tasks: { select: { status: true, cost: true } },
      },
    });
    res.json(
      teams.map(({ tasks, ...team }) => ({
        ...team,
        completed: tasks.filter((t) => t.status === 'completed').length,
        committed: tasks.reduce((sum, t) => sum + t.cost, 0),
      })),
    );
  }),
);

workRouter.post(
  '/teams',
  requireCapability('team:write'),
  asyncRoute(async (req, res) => {
    const body = parseBody(
      z.object({
        name: z.string().min(1).max(80),
        brief: z.string().default(''),
        colour: z.string().default('#ffffff'),
      }),
      req.body,
    );
    const team = await prisma.team.create({ data: { ...body, eventId: req.params.eventId! } });
    res.status(201).json(team);
  }),
);

workRouter.delete(
  '/teams/:teamId',
  requireCapability('team:write'),
  asyncRoute(async (req, res) => {
    const team = await prisma.team.findFirst({
      where: { id: req.params.teamId, eventId: req.params.eventId },
    });
    if (!team) throw notFound('Team');
    await prisma.team.delete({ where: { id: req.params.teamId } });
    res.status(204).end();
  }),
);

// --- Tasks ----------------------------------------------------------------

/**
 * Team leads and members see only their own team's board; owners, managers and
 * finance see the whole event. This is the row-level half of the RBAC model.
 */
workRouter.get(
  '/tasks',
  requireCapability('task:read'),
  asyncRoute(async (req, res) => {
    const { role, teamId } = req.membership!;
    const scoped = seesWholeEvent(role) ? {} : { teamId: teamId ?? '__none__' };

    const tasks = await prisma.task.findMany({
      where: { eventId: req.params.eventId, ...scoped },
      orderBy: [{ status: 'asc' }, { dueDate: 'asc' }, { position: 'asc' }],
      include: {
        team: { select: { id: true, name: true } },
        phase: { select: { id: true, name: true } },
        owner: { select: { id: true, name: true } },
        dependsOn: { select: { id: true, title: true, status: true } },
        _count: { select: { comments: true } },
      },
    });
    res.json(tasks);
  }),
);

const taskBody = z.object({
  title: z.string().min(1).max(200),
  detail: z.string().default(''),
  status: z
    .enum(['not_started', 'in_progress', 'blocked', 'awaiting_approval', 'completed'])
    .default('not_started'),
  priority: z.enum(['low', 'medium', 'high', 'critical']).default('medium'),
  teamId: z.string().nullable().default(null),
  phaseId: z.string().nullable().default(null),
  ownerId: z.string().nullable().default(null),
  dueDate: z.string().datetime().nullable().default(null),
  cost: z.number().nonnegative().default(0),
  dependsOnId: z.string().nullable().default(null),
});

workRouter.post(
  '/tasks',
  requireCapability('task:write'),
  asyncRoute(async (req, res) => {
    const body = parseBody(taskBody, req.body);
    const task = await prisma.task.create({
      data: {
        ...body,
        dueDate: body.dueDate ? new Date(body.dueDate) : null,
        eventId: req.params.eventId!,
      },
      include: { team: true, phase: true },
    });
    res.status(201).json(task);
  }),
);

workRouter.patch(
  '/tasks/:taskId',
  requireCapability('task:write'),
  asyncRoute(async (req, res) => {
    const body = parseBody(taskBody.partial(), req.body);
    const existing = await prisma.task.findFirst({
      where: { id: req.params.taskId, eventId: req.params.eventId },
    });
    if (!existing) throw notFound('Task');

    // A task cannot be completed while the task it depends on is still open.
    if (body.status === 'completed' && existing.dependsOnId) {
      const blocker = await prisma.task.findUnique({ where: { id: existing.dependsOnId } });
      if (blocker && blocker.status !== 'completed') {
        throw badRequest(`Blocked by "${blocker.title}", which is not complete yet`);
      }
    }

    if (body.dependsOnId && body.dependsOnId === req.params.taskId) {
      throw badRequest('A task cannot depend on itself');
    }

    const task = await prisma.task.update({
      where: { id: req.params.taskId },
      data: {
        ...body,
        ...(body.dueDate !== undefined
          ? { dueDate: body.dueDate ? new Date(body.dueDate) : null }
          : {}),
      },
      include: { team: true, phase: true, owner: true },
    });
    res.json(task);
  }),
);

workRouter.delete(
  '/tasks/:taskId',
  requireCapability('task:write'),
  asyncRoute(async (req, res) => {
    const existing = await prisma.task.findFirst({
      where: { id: req.params.taskId, eventId: req.params.eventId },
    });
    if (!existing) throw notFound('Task');
    await prisma.task.delete({ where: { id: req.params.taskId } });
    res.status(204).end();
  }),
);

workRouter.post(
  '/tasks/:taskId/comments',
  requireCapability('task:write'),
  asyncRoute(async (req, res) => {
    const { body } = parseBody(z.object({ body: z.string().min(1).max(4000) }), req.body);
    const comment = await prisma.taskComment.create({
      data: { taskId: req.params.taskId!, authorId: req.user!.id, body },
      include: { author: { select: { id: true, name: true } } },
    });
    res.status(201).json(comment);
  }),
);
