import { and, asc, count, desc, eq, ilike, inArray, isNull, or } from 'drizzle-orm';
import { AppError } from '@/domain/errors';
import { normalizeOrderNumber, orderDigits, type ListQuery } from '@/domain/schemas';
import { db } from './client';
import { customers, notes, orderLines, orders, returnRequests, statusChanges } from './schema';

export async function getOrderByNumber(number: string) {
  const d = db();
  const [order] = await d
    .select({ id: orders.id, number: orders.number, placedAt: orders.placedAt, customer: { name: customers.name, email: customers.email, phone: customers.phone } })
    .from(orders)
    .innerJoin(customers, eq(orders.customerId, customers.id))
    .where(eq(orders.number, normalizeOrderNumber(number)));
  if (!order) throw new AppError(404, 'order_not_found', 'No order with that number.');
  const lines = await d
    .select({ id: orderLines.id, productName: orderLines.productName, sku: orderLines.sku, quantity: orderLines.quantity, unitPricePaise: orderLines.unitPricePaise })
    .from(orderLines)
    .where(eq(orderLines.orderId, order.id))
    .orderBy(asc(orderLines.id));
  return { number: order.number, placedAt: order.placedAt, customer: order.customer, lines };
}

/**
 * Up to 8 orders for the raise page's suggestions. Digits match the number by prefix (`1` → ORD-1…);
 * anything else matches part of the number, the customer's name or email.
 */
export async function searchOrders(q: string) {
  const digits = orderDigits(q);
  const like = `%${escapeLike(q)}%`;
  return db()
    .select({ number: orders.number, placedAt: orders.placedAt, customerName: customers.name })
    .from(orders)
    .innerJoin(customers, eq(orders.customerId, customers.id))
    .where(digits ? ilike(orders.number, `ORD-${digits}%`) : or(ilike(orders.number, like), ilike(customers.name, like), ilike(customers.email, like)))
    .orderBy(asc(orders.number))
    .limit(8);
}

type Db = ReturnType<typeof db>;
type Tx = Parameters<Parameters<Db['transaction']>[0]>[0];

/** The one way every route loads a Return Request: Removed rows are never found. */
export async function loadReturnRequest(reference: string, d: Db | Tx = db()) {
  const [request] = await d
    .select()
    .from(returnRequests)
    .where(and(eq(returnRequests.reference, reference), isNull(returnRequests.removedAt)));
  if (!request) throw new AppError(404, 'return_request_not_found', 'No return request with that reference.');
  return request;
}

/** A Return Request with its Order Line, Order and timeline (Status Changes and Notes, oldest first). */
export async function getReturnRequest(reference: string) {
  const d = db();
  const { id, removedAt: _removed, ...request } = await loadReturnRequest(reference, d);
  const [[line], changes, notesFound] = await Promise.all([
    d
      .select({ productName: orderLines.productName, sku: orderLines.sku, quantity: orderLines.quantity, unitPricePaise: orderLines.unitPricePaise, order: { number: orders.number, placedAt: orders.placedAt } })
      .from(orderLines)
      .innerJoin(orders, eq(orderLines.orderId, orders.id))
      .where(eq(orderLines.id, request.orderLineId)),
    d.select().from(statusChanges).where(eq(statusChanges.returnRequestId, id)).orderBy(asc(statusChanges.createdAt), asc(statusChanges.id)),
    d.select().from(notes).where(eq(notes.returnRequestId, id)).orderBy(asc(notes.createdAt), asc(notes.id)),
  ]);
  const timeline = [
    ...changes.map((c) => ({ kind: 'status_change' as const, id: c.id, from: c.fromStatus, to: c.toStatus, at: c.createdAt })),
    ...notesFound.map((n) => ({ kind: 'note' as const, id: n.id, body: n.body, at: n.createdAt })),
  ].sort((a, b) => a.at.getTime() - b.at.getTime() || (a.kind === b.kind ? a.id - b.id : a.kind === 'status_change' ? -1 : 1));
  return { ...request, orderLine: line, timeline };
}

/** Makes `\ % _` match literally inside ILIKE (Postgres' default escape is the backslash). */
export const escapeLike = (s: string) => s.replace(/[\\%_]/g, (c) => `\\${c}`);

/** The list behind `GET /api/return-requests` and the home page. Everything happens in SQL. */
export async function listReturnRequests({ q, status, reason, sort, order, page, pageSize }: ListQuery) {
  const d = db();
  const like = q ? `%${escapeLike(q)}%` : null;
  const where = and(
    isNull(returnRequests.removedAt),
    like ? or(ilike(returnRequests.reference, like), ilike(orders.number, like), ilike(returnRequests.contactName, like), ilike(returnRequests.contactEmail, like)) : undefined,
    status?.length ? inArray(returnRequests.status, status) : undefined,
    reason?.length ? inArray(returnRequests.reason, reason) : undefined,
  );
  const dir = order === 'asc' ? asc : desc;
  const [rows, [{ total }]] = await Promise.all([
    d
      .select({
        reference: returnRequests.reference,
        status: returnRequests.status,
        reason: returnRequests.reason,
        contactName: returnRequests.contactName,
        contactEmail: returnRequests.contactEmail,
        orderNumber: orders.number,
        productName: orderLines.productName,
        createdAt: returnRequests.createdAt,
        lastActivityAt: returnRequests.lastActivityAt,
      })
      .from(returnRequests)
      .innerJoin(orderLines, eq(returnRequests.orderLineId, orderLines.id))
      .innerJoin(orders, eq(orderLines.orderId, orders.id))
      .where(where)
      // id breaks ties so rows never shuffle between pages.
      .orderBy(dir(returnRequests[sort]), dir(returnRequests.id))
      .limit(pageSize)
      .offset((page - 1) * pageSize),
    // Same joins as the rows: q matches the order number.
    d.select({ total: count() }).from(returnRequests).innerJoin(orderLines, eq(returnRequests.orderLineId, orderLines.id)).innerJoin(orders, eq(orderLines.orderId, orders.id)).where(where),
  ]);
  return { data: rows, total, page, pageSize };
}
