import { sql } from 'drizzle-orm';
import { check, integer, pgTable, text, timestamp } from 'drizzle-orm/pg-core';

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
  (t) => [check('order_lines_quantity_positive', sql`${t.quantity} > 0`), check('order_lines_price_positive', sql`${t.unitPricePaise} > 0`)],
);
