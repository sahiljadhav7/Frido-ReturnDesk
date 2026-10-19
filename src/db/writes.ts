import { eq } from 'drizzle-orm';
import { AppError } from '@/domain/errors';
import { checkQuantity } from '@/domain/rules';
import type { RaiseInput } from '@/domain/schemas';
import { db } from './client';
import { ONE_LIVE_PER_LINE, orderLines, returnRequests, statusChanges } from './schema';

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
