import express from 'express';
import cors from 'cors';
import morgan from 'morgan';
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

export function createApp() {
  const app = express();

  app.use(cors({ origin: env.webOrigin.split(',').map((o) => o.trim()), credentials: true }));
  app.use(express.json({ limit: '2mb' }));
  if (env.nodeEnv !== 'test') app.use(morgan('dev'));

  app.get('/health', (_req, res) => {
    res.json({ ok: true, service: 'livent-api', version: '0.1.0' });
  });

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

  app.use((_req, res) => res.status(404).json({ error: 'Route not found' }));
  app.use(errorHandler);

  return app;
}
