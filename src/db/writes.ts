import { and, eq, isNull, sql } from 'drizzle-orm';
import { AppError } from '@/domain/errors';
import { checkQuantity, checkStatusChange } from '@/domain/rules';
import type { RaiseInput, StatusChangeInput } from '@/domain/schemas';
import { db } from './client';
import { loadReturnRequest } from './reads';
import { notes, ONE_LIVE_PER_LINE, orderLines, returnRequests, statusChanges } from './schema';

/** Raises a Return Request and records its first Status Change (none → Open) in one transaction. */
export async function raise(input: RaiseInput) {
  const d = db();
  // Read outside the transaction: Order Lines are read-only (ADR 0001), so the quantity checked can't change under us.
  const [line] = await d.select({ quantity: orderLines.quantity }).from(orderLines).where(eq(orderLines.id, input.orderLineId));
  if (!line) throw new AppError(422, 'unknown_order_line', 'No order line with that id.');
  checkQuantity(input.quantity, line.quantity);
  try {
    return await d.transaction(async (tx) => {
      const [request] = await tx.insert(returnRequests).values(input).returning();
      await tx.insert(statusChanges).values({ returnRequestId: request.id, fromStatus: null, toStatus: 'open', createdAt: request.createdAt });
      return request;
    });
  } catch (e) {
    // Only rule 3's index means "the agent's fault"; any other constraint error is a bug and stays a 500.
    const cause = (e as { cause?: { code?: string; constraint?: string } }).cause;
    if (cause?.code === '23505' && cause.constraint === ONE_LIVE_PER_LINE)
      throw new AppError(409, 'duplicate_live_request', 'This order line already has a live return request.');
    throw e;
  }
}

/**
 * A guarded write matched zero rows: read the request once more to choose the answer.
 * 404 if it's gone or Removed (the loader throws), otherwise 409 because its state moved on.
 */
async function lostRace(reference: string): Promise<never> {
  await loadReturnRequest(reference);
  throw new AppError(409, 'conflict', 'This request changed since you loaded it. Reload and try again.');
}

/**
 * Moves a Return Request to a new Status, recording the Status Change and bumping last activity in one transaction.
 * A rejection's reason is saved as a Note in the same transaction.
 */
export async function changeStatus(reference: string, input: StatusChangeInput) {
  const d = db();
  const request = await loadReturnRequest(reference, d);
  const [line] = await d.select({ unitPricePaise: orderLines.unitPricePaise }).from(orderLines).where(eq(orderLines.id, request.orderLineId));
  checkStatusChange(request.status, input, { unitPricePaise: line.unitPricePaise, quantity: request.quantity });
  const approving = input.to === 'approved';
  const change = await d.transaction(async (tx) => {
    const [updated] = await tx
      .update(returnRequests)
      // Only approval sets the Resolution: writing null on Approved → Completed would break the CHECK.
      .set({ status: input.to, lastActivityAt: sql`now()`, ...(approving && { resolution: input.resolution, refundAmountPaise: input.refundAmountPaise ?? null }) })
      .where(
        and(
          eq(returnRequests.id, request.id),
          eq(returnRequests.status, request.status),
          isNull(returnRequests.removedAt),
          // Pin what the refund cap was checked against, so a correction landing in between can't break it.
          approving ? and(eq(returnRequests.quantity, request.quantity), eq(returnRequests.orderLineId, request.orderLineId)) : undefined,
        ),
      )
      .returning({ id: returnRequests.id });
    if (!updated) return null;
    // created_at defaults to now(), the same instant as last_activity_at inside this transaction.
    const [row] = await tx.insert(statusChanges).values({ returnRequestId: request.id, fromStatus: request.status, toStatus: input.to }).returning();
    // Same now() as the Status Change, and the timeline puts a Status Change first on a tie, so the reason sits right under "Moved to Rejected".
    if (input.reason) await tx.insert(notes).values({ returnRequestId: request.id, body: input.reason });
    return row;
  });
  if (!change) return lostRace(reference);
  return { id: change.id, from: change.fromStatus, to: change.toStatus, at: change.createdAt };
}

/** Adds a Note and bumps last activity in one transaction. Closed requests take Notes too; Removed ones are never found. */
export async function addNote(reference: string, body: string) {
  const d = db();
  const request = await loadReturnRequest(reference, d);
  const note = await d.transaction(async (tx) => {
    const [updated] = await tx
      .update(returnRequests)
      .set({ lastActivityAt: sql`now()` })
      .where(and(eq(returnRequests.id, request.id), isNull(returnRequests.removedAt)))
      .returning({ id: returnRequests.id });
    if (!updated) return null;
    const [row] = await tx.insert(notes).values({ returnRequestId: request.id, body }).returning();
    return row;
  });
  // Only a removal landing in between matches zero rows, so this answers 404.
  if (!note) return lostRace(reference);
  return { id: note.id, body: note.body, at: note.createdAt };
}
