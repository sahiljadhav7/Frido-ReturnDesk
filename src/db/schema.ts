import { sql } from 'drizzle-orm';
import { check, index, integer, pgEnum, pgTable, text, timestamp, uniqueIndex } from 'drizzle-orm/pg-core';
import { LIVE_STATUSES, STATUSES } from '@/domain/lifecycle';
import { REASONS, RESOLUTIONS } from '@/domain/schemas';

// The read-only catalogue (ADR 0001). Money is integer paise.
export const customers = pgTable('customers', {
  id: integer().primaryKey().generatedAlwaysAsIdentity(),
  name: text().notNull(),
  email: text().notNull(),
  phone: text(),
});

export const orders = pgTable('orders', {
  id: integer().primaryKey().generatedAlwaysAsIdentity(),
  number: text().notNull().unique(),
  customerId: integer().notNull().references(() => customers.id),
  placedAt: timestamp({ withTimezone: true }).notNull(),
});

export const orderLines = pgTable(
  'order_lines',
  {
    id: integer().primaryKey().generatedAlwaysAsIdentity(),
    orderId: integer().notNull().references(() => orders.id),
    productName: text().notNull(),
    sku: text().notNull(),
    quantity: integer().notNull(),
    unitPricePaise: integer().notNull(),
  },
  (t) => [
    check('order_lines_quantity_positive', sql`${t.quantity} > 0`),
    check('order_lines_price_positive', sql`${t.unitPricePaise} > 0`),
    // An item appears once per Order, so "one Live request per Order Line" is "one per item" (rule 3).
    uniqueIndex('order_lines_one_per_sku').on(t.orderId, t.sku),
  ],
);

export const reason = pgEnum('reason', REASONS);
export const status = pgEnum('status', STATUSES);
export const resolution = pgEnum('resolution', RESOLUTIONS);

/** Rule 3: at most one Live request per Order Line. Matched by name to answer 409 duplicate_live_request. */
export const ONE_LIVE_PER_LINE = 'return_requests_one_live_per_line';

const live = LIVE_STATUSES.map((s) => `'${s}'`).join(', ');

export const returnRequests = pgTable(
  'return_requests',
  {
    id: integer().primaryKey().generatedAlwaysAsIdentity(),
    // Never truncates past six digits, unlike a plain lpad(id, 6).
    reference: text()
      .notNull()
      .unique()
      .generatedAlwaysAs(sql`'RD-' || lpad(id::text, greatest(6, length(id::text)), '0')`),
    orderLineId: integer().notNull().references(() => orderLines.id),
    quantity: integer().notNull(),
    reason: reason().notNull(),
    contactName: text().notNull(),
    contactEmail: text().notNull(),
    contactPhone: text(),
    status: status().notNull().default('open'),
    resolution: resolution(),
    refundAmountPaise: integer(),
    createdAt: timestamp({ withTimezone: true }).notNull().defaultNow(),
    lastActivityAt: timestamp({ withTimezone: true }).notNull().defaultNow(),
    removedAt: timestamp({ withTimezone: true }),
  },
  (t) => [
    check('return_requests_resolution_when_approved', sql`(${t.resolution} IS NOT NULL) = (${t.status} IN ('approved', 'completed'))`),
    // IS NOT DISTINCT FROM, not =: resolution is nullable, and a CHECK that evaluates to NULL passes.
    check('return_requests_refund_when_refund', sql`(${t.refundAmountPaise} IS NOT NULL) = (${t.resolution} IS NOT DISTINCT FROM 'refund')`),
    check('return_requests_refund_positive', sql`${t.refundAmountPaise} > 0`),
    check('return_requests_quantity_positive', sql`${t.quantity} > 0`),
    // Rule 5 in the schema: only Open or Rejected requests can be Removed.
    check('return_requests_removed_only_open_or_rejected', sql`${t.removedAt} IS NULL OR ${t.status} IN ('open', 'rejected')`),
    uniqueIndex(ONE_LIVE_PER_LINE).on(t.orderLineId).where(sql.raw(`status IN (${live}) AND removed_at IS NULL`)),
    // The list's two sorts. One direction serves both: Postgres scans the index backwards for ascending.
    index('return_requests_by_activity').on(t.lastActivityAt.desc().nullsFirst(), t.id.desc().nullsFirst()).where(sql`removed_at IS NULL`),
    index('return_requests_by_created').on(t.createdAt.desc().nullsFirst(), t.id.desc().nullsFirst()).where(sql`removed_at IS NULL`),
  ],
);

export const statusChanges = pgTable(
  'status_changes',
  {
    id: integer().primaryKey().generatedAlwaysAsIdentity(),
    returnRequestId: integer().notNull().references(() => returnRequests.id),
    fromStatus: status(), // null for the initial Open at raise
    toStatus: status().notNull(),
    createdAt: timestamp({ withTimezone: true }).notNull().defaultNow(),
  },
  (t) => [index().on(t.returnRequestId)],
);

export const notes = pgTable(
  'notes',
  {
    id: integer().primaryKey().generatedAlwaysAsIdentity(),
    returnRequestId: integer().notNull().references(() => returnRequests.id),
    body: text().notNull(),
    createdAt: timestamp({ withTimezone: true }).notNull().defaultNow(),
  },
  (t) => [index().on(t.returnRequestId)],
);
