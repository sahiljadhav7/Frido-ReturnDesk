import { asc, eq } from 'drizzle-orm';
import { AppError } from '@/domain/errors';
import { db } from './client';
import { customers, orderLines, orders } from './schema';

export async function getOrderByNumber(number: string) {
  const d = db();
  const [order] = await d
    .select({ id: orders.id, number: orders.number, customer: { name: customers.name, email: customers.email, phone: customers.phone } })
    .from(orders)
    .innerJoin(customers, eq(orders.customerId, customers.id))
    .where(eq(orders.number, number.trim().toUpperCase()));
  if (!order) throw new AppError(404, 'order_not_found', 'No order with that number.');
  const lines = await d
    .select({ id: orderLines.id, productName: orderLines.productName, sku: orderLines.sku, quantity: orderLines.quantity, unitPricePaise: orderLines.unitPricePaise })
    .from(orderLines)
    .where(eq(orderLines.orderId, order.id))
    .orderBy(asc(orderLines.id));
  return { number: order.number, customer: order.customer, lines };
}
