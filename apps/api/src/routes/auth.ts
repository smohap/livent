import { Router } from 'express';
import bcrypt from 'bcryptjs';
import { z } from 'zod';
import { prisma } from '../lib/prisma.js';
import { asyncRoute, HttpError, parseBody } from '../lib/http.js';
import { requireAuth, signToken } from '../middleware/auth.js';

export const authRouter = Router();

const credentials = z.object({
  email: z.string().email().transform((v) => v.toLowerCase().trim()),
  password: z.string().min(8, 'Password must be at least 8 characters'),
});

const signupBody = credentials.extend({ name: z.string().min(1).max(120) });

authRouter.post(
  '/signup',
  asyncRoute(async (req, res) => {
    const { email, password, name } = parseBody(signupBody, req.body);

    const existing = await prisma.user.findUnique({ where: { email } });
    if (existing) throw new HttpError(409, 'An account with that email already exists');

    const user = await prisma.user.create({
      data: { email, name, passwordHash: await bcrypt.hash(password, 12) },
    });

    res.status(201).json({
      token: signToken({ id: user.id, email: user.email, name: user.name }),
      user: { id: user.id, email: user.email, name: user.name },
    });
  }),
);

authRouter.post(
  '/login',
  asyncRoute(async (req, res) => {
    const { email, password } = parseBody(credentials, req.body);

    const user = await prisma.user.findUnique({ where: { email } });
    // Same message either way so the endpoint cannot be used to enumerate accounts.
    const ok = user ? await bcrypt.compare(password, user.passwordHash) : false;
    if (!user || !ok) throw new HttpError(401, 'Email or password is incorrect');

    res.json({
      token: signToken({ id: user.id, email: user.email, name: user.name }),
      user: { id: user.id, email: user.email, name: user.name },
    });
  }),
);

authRouter.get(
  '/me',
  requireAuth,
  asyncRoute(async (req, res) => {
    const memberships = await prisma.membership.findMany({
      where: { userId: req.user!.id },
      include: { event: { select: { id: true, name: true, slug: true } } },
    });
    res.json({ user: req.user, memberships });
  }),
);
