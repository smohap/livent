import type { NextFunction, Request, Response } from 'express';
import jwt from 'jsonwebtoken';
import { env } from '../lib/env.js';
import { prisma } from '../lib/prisma.js';
import { asyncRoute, forbidden, HttpError, notFound } from '../lib/http.js';
import { can, type Capability } from '../lib/rbac.js';

export interface AuthUser {
  id: string;
  email: string;
  name: string;
}

declare global {
  // eslint-disable-next-line @typescript-eslint/no-namespace
  namespace Express {
    interface Request {
      user?: AuthUser;
      membership?: { role: string; teamId: string | null; eventId: string };
    }
  }
}

export function signToken(user: AuthUser): string {
  return jwt.sign({ sub: user.id, email: user.email, name: user.name }, env.jwtSecret, {
    expiresIn: '30d',
  });
}

/** Requires a valid bearer token; attaches `req.user`. */
export const requireAuth = asyncRoute(async (req: Request, _res: Response, next: NextFunction) => {
  const header = req.headers.authorization ?? '';
  const token = header.startsWith('Bearer ') ? header.slice(7) : null;
  if (!token) throw new HttpError(401, 'Authentication required');

  let payload: jwt.JwtPayload;
  try {
    payload = jwt.verify(token, env.jwtSecret) as jwt.JwtPayload;
  } catch {
    throw new HttpError(401, 'Session expired or invalid');
  }

  const user = await prisma.user.findUnique({ where: { id: String(payload.sub) } });
  if (!user) throw new HttpError(401, 'Account no longer exists');

  req.user = { id: user.id, email: user.email, name: user.name };
  next();
});

/**
 * Resolves the caller's membership of `:eventId` and attaches it to the request.
 * Must run after `requireAuth`.
 */
export const requireEventAccess = asyncRoute(
  async (req: Request, _res: Response, next: NextFunction) => {
    const eventId = req.params.eventId ?? req.body?.eventId;
    if (!eventId) throw new HttpError(400, 'eventId is required');
    if (!req.user) throw new HttpError(401, 'Authentication required');

    const event = await prisma.event.findUnique({ where: { id: eventId } });
    if (!event) throw notFound('Event');

    if (event.ownerId === req.user.id) {
      req.membership = { role: 'owner', teamId: null, eventId };
      next();
      return;
    }

    const membership = await prisma.membership.findUnique({
      where: { userId_eventId: { userId: req.user.id, eventId } },
    });
    if (!membership) throw forbidden('You are not a member of this event');

    req.membership = { role: membership.role, teamId: membership.teamId, eventId };
    next();
  },
);

/** Guards a route behind one capability. Must run after `requireEventAccess`. */
export function requireCapability(capability: Capability) {
  return (req: Request, _res: Response, next: NextFunction) => {
    if (!req.membership) {
      next(new HttpError(500, 'requireEventAccess must run before requireCapability'));
      return;
    }
    if (!can(req.membership.role, capability)) {
      next(forbidden(`Your role (${req.membership.role}) cannot perform "${capability}"`));
      return;
    }
    next();
  };
}
