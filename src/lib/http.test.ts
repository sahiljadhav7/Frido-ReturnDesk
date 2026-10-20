import { describe, expect, it, vi } from 'vitest';
import { z } from 'zod';
import { AppError } from '@/domain/errors';
import { handle, readJson, route } from './http';

const req = (method = 'GET', body?: string) => new Request('http://x/api', { method, body });

describe('handle', () => {
  it('turns an AppError into the envelope', async () => {
    const res = await handle(() => { throw new AppError(409, 'conflict', 'nope', { a: 1 }); })(req(), {});
    expect(res.status).toBe(409);
    expect(await res.json()).toEqual({ error: { code: 'conflict', message: 'nope', details: { a: 1 } } });
  });

  it('hides unexpected errors behind a generic 500', async () => {
    vi.spyOn(console, 'error').mockImplementation(() => {});
    const res = await handle(() => { throw new Error('secret stack'); })(req(), {});
    expect(res.status).toBe(500);
    expect(JSON.stringify(await res.json())).not.toContain('secret');
  });

  it('names the failing fields in a 400 message', async () => {
    const schema = z.strictObject({ contactEmail: z.email(), quantity: z.int().positive() });
    const res = await handle(() => { schema.parse({ contactEmail: 'a@b', quantity: 0, status: 'approved' }); return Response.json({}); })(req(), {});
    const { error } = await res.json();
    expect(res.status).toBe(400);
    expect(error.code).toBe('invalid_request');
    expect(error.message).toContain('contactEmail: ');
    expect(error.message).toContain('quantity: ');
    expect(error.details).toHaveLength(3);
  });

  it('answers 400 for a malformed JSON body', async () => {
    const res = await handle((r) => readJson(r).then(() => Response.json({})))(req('POST', '{oops'), {});
    expect(res.status).toBe(400);
    expect((await res.json()).error.code).toBe('malformed_json');
  });
});

describe('route', () => {
  it('answers a JSON 405 with Allow for unsupported methods', async () => {
    const { GET, POST } = route({ GET: () => Response.json({}) });
    expect((await GET(req(), {})).status).toBe(200);
    const res = await POST(req('POST'), {});
    expect(res.status).toBe(405);
    expect(res.headers.get('Allow')).toBe('GET');
    expect((await res.json()).error.code).toBe('method_not_allowed');
  });
});
