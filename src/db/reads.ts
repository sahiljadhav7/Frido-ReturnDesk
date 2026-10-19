import { and, asc, eq, isNull } from 'drizzle-orm';
import { AppError } from '@/domain/errors';
import { db } from './client';
import { customers, notes, orderLines, orders, returnRequests, statusChanges } from './schema';

export async function getOrderByNumber(number: string) {
  const d = db();
  const [order] = await d
    .select({ id: orders.id, number: orders.number, placedAt: orders.placedAt, customer: { name: customers.name, email: customers.email, phone: customers.phone } })
    .from(orders)
    .innerJoin(customers, eq(orders.customerId, customers.id))
    .where(eq(orders.number, number.trim().toUpperCase()));
  if (!order) throw new AppError(404, 'order_not_found', 'No order with that number.');
  const lines = await d
    .select({ id: orderLines.id, productName: orderLines.productName, sku: orderLines.sku, quantity: orderLines.quantity, unitPricePaise: orderLines.unitPricePaise })
    .from(orderLines)
    .where(eq(orderLines.orderId, order.id))
    .orderBy(asc(orderLines.id));
  return { number: order.number, placedAt: order.placedAt, customer: order.customer, lines };
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
