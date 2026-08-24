import { existsSync } from 'node:fs';
import { dirname, join, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';
import express from 'express';
import cors from 'cors';
import helmet from 'helmet';
import morgan from 'morgan';
import rateLimit from 'express-rate-limit';
import { env } from './lib/env.js';
import { errorHandler } from './lib/http.js';
import { authRouter } from './routes/auth.js';
import { eventsRouter } from './routes/events.js';
import { phasesRouter } from './routes/phases.js';
import { guestsRouter } from './routes/guests.js';
import { workRouter } from './routes/work.js';
import { financeRouter } from './routes/finance.js';
import { seatingRouter } from './routes/seating.js';
import { experienceRouter } from './routes/experience.js';
import { ticketsRouter } from './routes/tickets.js';
import { publicRouter } from './routes/public.js';

const HERE = dirname(fileURLToPath(import.meta.url));

/** Where `vite build` puts the SPA, relative to the compiled API at dist/. */
const WEB_DIST = resolve(HERE, '../../web/dist');

export function createApp() {
  const app = express();

  // Behind Hostinger's proxy, so client IPs arrive in X-Forwarded-For. The rate
  // limiter needs this to key on the real caller rather than the proxy.
  app.set('trust proxy', 1);

  app.use(
    helmet({
      contentSecurityPolicy: {
        directives: {
          defaultSrc: ["'self'"],
          // Tailwind ships as a file, but React style props are inline
          // attributes, which style-src governs.
          styleSrc: ["'self'", "'unsafe-inline'", 'https://fonts.googleapis.com'],
          fontSrc: ["'self'", 'https://fonts.gstatic.com', 'data:'],
          imgSrc: ["'self'", 'data:', 'blob:', 'https:'],
          mediaSrc: ["'self'", 'https:'],
          scriptSrc: ["'self'"],
          connectSrc: ["'self'"],
          objectSrc: ["'none'"],
          frameAncestors: ["'none'"],
        },
      },
      // The landing page pulls its background video from a CDN.
      crossOriginEmbedderPolicy: false,
      crossOriginResourcePolicy: { policy: 'cross-origin' },
    }),
  );

  // Only needed when the SPA is served from a different origin (local dev).
  // In the deployed single-origin setup this matches nothing.
  app.use(cors({ origin: env.webOrigin.split(',').map((o) => o.trim()), credentials: true }));

  app.use(express.json({ limit: '2mb' }));
  if (env.nodeEnv !== 'test') app.use(morgan(env.isProd ? 'combined' : 'dev'));

  app.get('/health', (_req, res) => {
    res.json({ ok: true, service: 'evyent-api', version: '0.1.0' });
  });

  // Credential endpoints are the ones worth brute-forcing, so they get their
  // own budget rather than sharing the global one.
  app.use(
    ['/api/auth/login', '/api/auth/signup'],
    rateLimit({
      windowMs: 15 * 60_000,
      limit: 20,
      standardHeaders: 'draft-7',
      legacyHeaders: false,
      message: { error: 'Too many attempts. Try again in a few minutes.' },
    }),
  );

  app.use(
    '/api',
    rateLimit({
      windowMs: 60_000,
      limit: 300,
      standardHeaders: 'draft-7',
      legacyHeaders: false,
      message: { error: 'Too many requests. Slow down a moment.' },
    }),
  );

  app.use('/api/auth', authRouter);
  app.use('/api/events', eventsRouter);

  // Everything below is scoped to one event.
  app.use('/api/events/:eventId/phases', phasesRouter);
  app.use('/api/events/:eventId/guests', guestsRouter);
  app.use('/api/events/:eventId', workRouter);
  app.use('/api/events/:eventId/finance', financeRouter);
  app.use('/api/events/:eventId/phases', seatingRouter);
  app.use('/api/events/:eventId', experienceRouter);
  app.use('/api/events/:eventId/tickets', ticketsRouter);

  // Guest-facing, token authenticated.
  app.use('/api/public', publicRouter);

  // An unmatched /api path is an API error, so answer in JSON rather than
  // falling through to the SPA and returning HTML to a fetch call.
  app.use('/api', (_req, res) => res.status(404).json({ error: 'Route not found' }));

  /*
   * In production this process also serves the built SPA. Doing so makes the
   * whole product one origin, which removes three deployment problems at once:
   * CORS disappears, the client can call a relative /api so no API URL has to
   * be baked in at build time, and deep links work without a rewrite rule in
   * the web server.
   */
  if (existsSync(WEB_DIST)) {
    app.use(
      express.static(WEB_DIST, {
        index: false,
        // Hashed asset filenames are safe to cache hard.
        setHeaders: (res, path) => {
          if (path.includes(`${join('assets', '')}`)) {
            res.setHeader('Cache-Control', 'public, max-age=31536000, immutable');
          }
        },
      }),
    );

    app.get('*', (_req, res) => {
      // index.html must never be cached, or clients pin to a stale bundle.
      res.setHeader('Cache-Control', 'no-cache');
      res.sendFile(join(WEB_DIST, 'index.html'));
    });
  } else {
    app.use((_req, res) => res.status(404).json({ error: 'Route not found' }));
  }

  app.use(errorHandler);

  return app;
}
