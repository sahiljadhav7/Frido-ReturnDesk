// Resets and reseeds the catalogue. Run from a terminal: `npm run seed` (DATABASE_URL from .env.local, or the environment).
import { sql } from 'drizzle-orm';
import { db } from '../src/db/client';
import { customers, orderLines, orders } from '../src/db/schema';

const ago = (days: number) => new Date(Date.now() - days * 86_400_000);

// [name, email, phone, [[order number, days ago, [[product, sku, quantity, unit price in rupees]]]]]
const seed: [string, string, string | null, [string, number, [string, string, number, number][]][]][] = [
  ['Aarav Mehta', 'aarav.mehta@example.com', '+91 98200 11001', [
    ['ORD-1001', 21, [['Ortho Pillow', 'PIL-ORTHO', 2, 1499], ['Memory Foam Seat Cushion', 'CSH-MEM', 1, 1199]]],
    ['ORD-1002', 9, [['Plantar Fasciitis Insoles', 'INS-PLN', 1, 799]]],
  ]],
  ['Diya Nair', 'diya.nair@example.com', null, [
    ['ORD-1003', 30, [['Lumbar Support Belt', 'BLT-LMB', 1, 1299], ['Knee Brace', 'BRC-KNE', 2, 999], ['Travel Neck Pillow', 'PIL-NECK', 1, 699]]],
  ]],
  ['Rohan Kulkarni', 'rohan.k@example.com', '+91 99870 22002', [
    ['ORD-1004', 14, [['Gel Seat Cushion', 'CSH-GEL', 3, 1399]]],
    ['ORD-1005', 5, [['Ortho Pillow', 'PIL-ORTHO', 1, 1499], ['Heel Cups', 'INS-HEEL', 2, 549]]],
  ]],
  ['Isha Verma', 'isha.verma@example.com', '+91 97650 33003', [
    ['ORD-1006', 40, [['Posture Corrector', 'BLT-PST', 1, 1099]]],
    ['ORD-1007', 2, [['Foot Rest', 'FRT-REST', 1, 1799], ['Lumbar Cushion', 'CSH-LMB', 2, 1249]]],
  ]],
  ['Kabir Singh', 'kabir.singh@example.com', null, [
    ['ORD-1008', 18, [['Wrist Support', 'BRC-WRS', 4, 449]]],
    ['ORD-1009', 11, [['Memory Foam Mattress Topper', 'MAT-TOP', 1, 4999]]],
  ]],
  ['Meera Iyer', 'meera.iyer@example.com', '+91 98450 44004', [
    ['ORD-1010', 26, [['Ortho Pillow', 'PIL-ORTHO', 1, 1499], ['Travel Neck Pillow', 'PIL-NECK', 2, 699], ['Knee Brace', 'BRC-KNE', 1, 999]]],
  ]],
];

async function main() {
  // One transaction, so a failure midway leaves the old catalogue in place instead of an empty one.
  await db().transaction(async (tx) => {
    await tx.execute(sql`TRUNCATE customers, orders, order_lines RESTART IDENTITY CASCADE`);
    for (const [name, email, phone, customerOrders] of seed) {
      const [customer] = await tx.insert(customers).values({ name, email, phone }).returning();
      for (const [number, days, lines] of customerOrders) {
        const [order] = await tx.insert(orders).values({ number, customerId: customer.id, placedAt: ago(days) }).returning();
        await tx.insert(orderLines).values(
          lines.map(([productName, sku, quantity, rupees]) => ({ orderId: order.id, productName, sku, quantity, unitPricePaise: rupees * 100 })),
        );
      }
    }
  });
  console.log('Seeded.');
  process.exit(0);
}

main().catch((e) => { console.error(e); process.exit(1); });
