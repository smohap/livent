import type { NextFunction, Request, Response } from 'express';
import { ZodError, type TypeOf, type ZodTypeAny } from 'zod';

/** Domain error with an HTTP status attached. Thrown freely inside handlers. */
export class HttpError extends Error {
  constructor(
    public status: number,
    message: string,
    public details?: unknown,
  ) {
    super(message);
    this.name = 'HttpError';
  }
}

export const notFound = (what = 'Resource') => new HttpError(404, `${what} not found`);
export const forbidden = (msg = 'You do not have access to this resource') => new HttpError(403, msg);
export const badRequest = (msg: string, details?: unknown) => new HttpError(400, msg, details);

type Handler = (req: Request, res: Response, next: NextFunction) => Promise<unknown> | unknown;

/** Wraps an async handler so rejected promises reach the error middleware. */
export function asyncRoute(handler: Handler) {
  return (req: Request, res: Response, next: NextFunction) => {
    Promise.resolve(handler(req, res, next)).catch(next);
  };
}

/**
 * Parses `body` against `schema`, returning the schema's *output* type so that
 * `.default(...)` fields arrive as required rather than optional.
 */
export function parseBody<S extends ZodTypeAny>(schema: S, body: unknown): TypeOf<S> {
  const result = schema.safeParse(body);
  if (!result.success) {
    throw badRequest('Validation failed', result.error.flatten());
  }
  return result.data as TypeOf<S>;
}

export function errorHandler(err: unknown, _req: Request, res: Response, _next: NextFunction) {
  if (err instanceof HttpError) {
    res.status(err.status).json({ error: err.message, details: err.details });
    return;
  }
  if (err instanceof ZodError) {
    res.status(400).json({ error: 'Validation failed', details: err.flatten() });
    return;
  }
  const message = err instanceof Error ? err.message : 'Unexpected error';
  if (process.env.NODE_ENV !== 'test') {
    console.error('[livent:api]', err);
  }
  res.status(500).json({ error: message });
}
