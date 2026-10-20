import { eq, inArray, sql } from 'drizzle-orm';
import { afterAll, beforeAll, describe, expect, it } from 'vitest';
import { db } from '@/db/client';
import { customers, orderLines, orders, returnRequests } from '@/db/schema';
import * as collection from './return-requests/route';
import * as one from './return-requests/[reference]/route';
import * as notes from './return-requests/[reference]/notes/route';
import * as moves from './return-requests/[reference]/status-changes/route';

// The five business rules through the real route handlers and a real Postgres. Local only: they write rows.
// Skipped unless DATABASE_URL points at localhost, so `npm test` never touches a hosted database.
const host = process.env.DATABASE_URL ? new URL(process.env.DATABASE_URL).hostname : '';
const local = ['localhost', '127.0.0.1'].includes(host);

const UNIT = 1000;
const LINES = 40;
let lines: number[] = [];
let next = 0;

type Handler = (req: Request, ctx: never) => Response | Promise<Response>;
async function call(handler: Handler, method: string, path: string, body?: unknown, reference?: string) {
  const req = new Request(`http://test${path}`, { method, body: body === undefined ? undefined : JSON.stringify(body) });
  const res = await handler(req, { params: Promise.resolve({ reference }) } as never);
  return { status: res.status, body: res.status === 204 ? null : await res.json() };
}

const raise = (orderLineId: number, quantity = 1) =>
  call(collection.POST, 'POST', '/api/return-requests', { orderLineId, quantity, reason: 'damaged', contactName: 'Test Agent', contactEmail: 'test@example.com' });
const move = (ref: string, payload: object) => call(moves.POST, 'POST', `/x/${ref}/status-changes`, payload, ref);
const fresh = async () => (await raise(lines[next++])).body.data.reference as string;
const code = (r: { body: any }) => r.body?.error?.code;

describe.skipIf(!local)('business rules', () => {
  beforeAll(async () => {
    const d = db();
    const [c] = await d.insert(customers).values({ name: 'Rules Test', email: 'rules@example.com' }).returning();
    const [o] = await d.insert(orders).values({ number: `ORD-9${Date.now()}`, customerId: c.id, placedAt: new Date() }).returning();
    const rows = await d.insert(orderLines).values(Array.from({ length: LINES }, (_, i) => ({ orderId: o.id, productName: `Item ${i}`, sku: `T-${i}`, quantity: 3, unitPricePaise: UNIT }))).returning();
    lines = rows.map((r) => r.id);
  });

  afterAll(async () => {
    if (!lines.length) return; // setup failed: let its error show instead of crashing here
    const d = db();
    const ids = (await d.select({ id: returnRequests.id }).from(returnRequests).where(inArray(returnRequests.orderLineId, lines))).map((r) => r.id);
    if (ids.length) await d.execute(sql`DELETE FROM notes WHERE return_request_id IN (${sql.join(ids.map((i) => sql`${i}`), sql`, `)})`);
    if (ids.length) await d.execute(sql`DELETE FROM status_changes WHERE return_request_id IN (${sql.join(ids.map((i) => sql`${i}`), sql`, `)})`);
    await d.delete(returnRequests).where(inArray(returnRequests.orderLineId, lines));
    const [line] = await d.select({ orderId: orderLines.orderId }).from(orderLines).where(eq(orderLines.id, lines[0]));
    const [order] = await d.select({ customerId: orders.customerId }).from(orders).where(eq(orders.id, line.orderId));
    await d.delete(orderLines).where(eq(orderLines.orderId, line.orderId));
    await d.delete(orders).where(eq(orders.id, line.orderId));
    await d.delete(customers).where(eq(customers.id, order.customerId));
  });

  describe('1. status flow', () => {
    it('walks Open → In Review → Approved → Completed', async () => {
      const ref = await fresh();
      expect((await move(ref, { to: 'in_review' })).status).toBe(201);
      expect((await move(ref, { to: 'approved', resolution: 'replacement' })).status).toBe(201);
      expect((await move(ref, { to: 'completed' })).status).toBe(201);
    });

    it.each([
      ['Open → Completed', { to: 'completed' }],
      ['Open → Approved', { to: 'approved', resolution: 'replacement' }],
      ['Open → Rejected', { to: 'rejected' }],
    ])('refuses %s with 409', async (_name, payload) => {
      const res = await move(await fresh(), payload);
      expect(res.status).toBe(409);
      expect(code(res)).toBe('illegal_transition');
    });

    it.each([
      ['Rejected', [{ to: 'in_review' }, { to: 'rejected' }]],
      ['Completed', [{ to: 'in_review' }, { to: 'approved', resolution: 'replacement' }, { to: 'completed' }]],
    ])('treats %s as final', async (_name, path) => {
      const ref = await fresh();
      for (const step of path) expect((await move(ref, step)).status).toBe(201);
      for (const to of ['open', 'in_review', 'approved', 'rejected', 'completed']) expect((await move(ref, { to, resolution: 'replacement' })).status).toBe(409);
    });

    it('rejects with or without a reason, and a reason becomes a Note', async () => {
      const bare = await fresh();
      await move(bare, { to: 'in_review' });
      expect((await move(bare, { to: 'rejected' })).status).toBe(201);
      const why = await fresh();
      await move(why, { to: 'in_review' });
      await move(why, { to: 'rejected', reason: 'Item was used.' });
      const timeline = (await call(one.GET, 'GET', `/x/${why}`, undefined, why)).body.data.timeline;
      expect(timeline.some((t: any) => t.body === 'Item was used.')).toBe(true);
    });
  });

  describe('2. approval needs a resolution', () => {
    async function inReview() {
      const ref = await fresh();
      await move(ref, { to: 'in_review' });
      return ref;
    }

    it.each([
      ['no Resolution', { to: 'approved' }, 'resolution_required'],
      ['Refund without an amount', { to: 'approved', resolution: 'refund' }, 'refund_amount_required'],
      ['Refund of zero', { to: 'approved', resolution: 'refund', refundAmountPaise: 0 }, 'refund_amount_out_of_range'],
      ['Refund over unit price × units', { to: 'approved', resolution: 'refund', refundAmountPaise: UNIT + 1 }, 'refund_amount_out_of_range'],
      ['an amount with Replacement', { to: 'approved', resolution: 'replacement', refundAmountPaise: 100 }, 'refund_amount_not_allowed'],
      ['a Resolution when rejecting', { to: 'rejected', resolution: 'refund' }, 'resolution_not_allowed'],
    ])('refuses %s with 422', async (_name, payload, expected) => {
      const res = await move(await inReview(), payload);
      expect(res.status).toBe(422);
      expect(code(res)).toBe(expected);
    });

    it('approves a Refund up to unit price × units', async () => {
      const ref = await inReview();
      expect((await move(ref, { to: 'approved', resolution: 'refund', refundAmountPaise: UNIT })).status).toBe(201);
      const stored = (await call(one.GET, 'GET', `/x/${ref}`, undefined, ref)).body.data;
      expect(stored.refundAmountPaise).toBe(UNIT);
    });
  });

  describe('3. one live request per item', () => {
    it('refuses a second Live request, then allows one once the first is closed', async () => {
      const line = lines[next++];
      const first = (await raise(line)).body.data.reference;
      const dup = await raise(line);
      expect(dup.status).toBe(409);
      expect(code(dup)).toBe('duplicate_live_request');
      await move(first, { to: 'in_review' });
      await move(first, { to: 'rejected' });
      expect((await raise(line)).status).toBe(201);
    });

    it('refuses a quantity over what was ordered with 422', async () => {
      const res = await raise(lines[next++], 4);
      expect(res.status).toBe(422);
      expect(code(res)).toBe('quantity_over_ordered');
    });
  });

  describe('4. locked once decided', () => {
    it('refuses a correction after approval but still takes Notes', async () => {
      const ref = await fresh();
      await move(ref, { to: 'in_review' });
      expect((await call(one.PATCH, 'PATCH', `/x/${ref}`, { quantity: 2 }, ref)).status).toBe(200);
      await move(ref, { to: 'approved', resolution: 'store_credit' });
      const locked = await call(one.PATCH, 'PATCH', `/x/${ref}`, { quantity: 1 }, ref);
      expect(locked.status).toBe(409);
      expect(code(locked)).toBe('request_decided');
      expect((await call(notes.POST, 'POST', `/x/${ref}/notes`, { body: 'Still allowed.' }, ref)).status).toBe(201);
    });

    it('will not change status through a correction', async () => {
      const res = await call(one.PATCH, 'PATCH', `/x/RD-999999`, { status: 'approved' }, 'RD-999999');
      expect(res.status).toBe(400);
      expect(code(res)).toBe('invalid_request');
    });
  });

  describe('5. removal', () => {
    it('removes an Open request without deleting the record', async () => {
      const ref = await fresh();
      expect((await call(one.DELETE, 'DELETE', `/x/${ref}`, undefined, ref)).status).toBe(204);
      for (const r of [call(one.GET, 'GET', `/x/${ref}`, undefined, ref), call(notes.POST, 'POST', `/x/${ref}/notes`, { body: 'x' }, ref), call(one.DELETE, 'DELETE', `/x/${ref}`, undefined, ref)]) {
        const res = await r;
        expect(res.status).toBe(404);
        expect(code(res)).toBe('return_request_not_found');
      }
      const rows = await db().select({ removedAt: returnRequests.removedAt }).from(returnRequests).where(eq(returnRequests.reference, ref));
      expect(rows).toHaveLength(1);
      expect(rows[0].removedAt).not.toBeNull();
    });

    it('removes a Rejected request but refuses In Review, Approved and Completed with 409', async () => {
      const rejected = await fresh();
      await move(rejected, { to: 'in_review' });
      await move(rejected, { to: 'rejected' });
      expect((await call(one.DELETE, 'DELETE', `/x/${rejected}`, undefined, rejected)).status).toBe(204);

      const ref = await fresh();
      await move(ref, { to: 'in_review' });
      for (const next of [undefined, { to: 'approved', resolution: 'replacement' }, { to: 'completed' }]) {
        if (next) await move(ref, next);
        const res = await call(one.DELETE, 'DELETE', `/x/${ref}`, undefined, ref);
        expect(res.status).toBe(409);
        expect(code(res)).toBe('illegal_removal');
      }
    });

    it('frees the Order Line for a new request', async () => {
      const line = lines[next++];
      const ref = (await raise(line)).body.data.reference;
      await call(one.DELETE, 'DELETE', `/x/${ref}`, undefined, ref);
      expect((await raise(line)).status).toBe(201);
    });
  });

  it('answers an unknown reference with a JSON 404', async () => {
    const res = await call(one.GET, 'GET', '/x/RD-999999', undefined, 'RD-999999');
    expect(res.status).toBe(404);
    expect(code(res)).toBe('return_request_not_found');
  });
});
