import { ZodError } from 'zod';
import { AppError } from '@/domain/errors';

const METHODS = ['GET', 'POST', 'PUT', 'PATCH', 'DELETE'] as const;
type Method = (typeof METHODS)[number];
type Handler<C> = (req: Request, ctx: C) => Response | Promise<Response>;

export function errorResponse(status: number, code: string, message: string, details?: unknown, headers?: HeadersInit) {
  return Response.json({ error: { code, message, ...(details === undefined ? {} : { details }) } }, { status, headers });
}

/** Parses the request body, refusing malformed JSON with a 400. */
export async function readJson(req: Request): Promise<unknown> {
  try {
    return await req.json();
  } catch {
    throw new AppError(400, 'malformed_json', 'Request body is not valid JSON.');
  }
}

/** The failing fields in one line ("contactEmail: Invalid email address"), so the message alone tells the agent what to fix. */
const describeIssues = (e: ZodError) => e.issues.map((i) => (i.path.length ? `${i.path.join('.')}: ${i.message}` : i.message)).join('; ');

/** Wraps a handler so every error leaves as the JSON envelope. */
export function handle<C = unknown>(fn: Handler<C>): Handler<C> {
  return async (req, ctx) => {
    try {
      return await fn(req, ctx);
    } catch (e) {
      if (e instanceof AppError) return errorResponse(e.status, e.code, e.message, e.details);
      if (e instanceof ZodError) return errorResponse(400, 'invalid_request', `Invalid request. ${describeIssues(e)}`, e.issues);
      console.error(e);
      return errorResponse(500, 'internal_error', 'Something went wrong.');
    }
  };
}

/**
 * Builds a route's method exports: `export const { GET, POST, PUT, PATCH, DELETE } = route({ GET: ..., POST: ... })`.
 * Methods you leave out answer a JSON 405 with an Allow header instead of Next's empty one.
 */
export function route<C = unknown>(handlers: Partial<Record<Method, Handler<C>>>): Record<Method, Handler<C>> {
  const allow = Object.keys(handlers).join(', ');
  const refuse: Handler<C> = (req) =>
    errorResponse(405, 'method_not_allowed', `${req.method} is not supported here.`, undefined, { Allow: allow });
  return Object.fromEntries(METHODS.map((m) => [m, handle(handlers[m] ?? refuse)])) as Record<Method, Handler<C>>;
}
