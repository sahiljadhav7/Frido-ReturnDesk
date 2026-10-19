// Resets and reseeds the catalogue and the Return Requests. Run from a terminal: `npm run seed` (DATABASE_URL from .env.local, or the environment).
import { sql } from 'drizzle-orm';
import { db } from '../src/db/client';
import type { Status } from '../src/domain/lifecycle';
import type { Reason, Resolution } from '../src/domain/schemas';
import { customers, notes, orderLines, orders, returnRequests, statusChanges } from '../src/db/schema';

const DAY = 86_400_000;
const ago = (days: number) => new Date(Date.now() - days * DAY);

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
    ['ORD-1007', 20, [['Foot Rest', 'FRT-REST', 1, 1799], ['Lumbar Cushion', 'CSH-LMB', 2, 1249]]],
  ]],
  ['Kabir Singh', 'kabir.singh@example.com', null, [
    ['ORD-1008', 18, [['Wrist Support', 'BRC-WRS', 4, 449]]],
    ['ORD-1009', 15, [['Memory Foam Mattress Topper', 'MAT-TOP', 1, 4999]]],
  ]],
  ['Meera Iyer', 'meera.iyer@example.com', '+91 98450 44004', [
    ['ORD-1010', 26, [['Ortho Pillow', 'PIL-ORTHO', 1, 1499], ['Travel Neck Pillow', 'PIL-NECK', 2, 699], ['Knee Brace', 'BRC-KNE', 1, 999]]],
  ]],
  ['Arjun Rao', 'arjun.rao@example.com', '+91 90040 55005', [
    ['ORD-1011', 12, [['Ortho Pillow', 'PIL-ORTHO', 2, 1499], ['Foot Rest', 'FRT-REST', 1, 1799]]],
    ['ORD-1012', 3, [['Gel Seat Cushion', 'CSH-GEL', 1, 1399]]],
  ]],
  ['Sneha Pillai', 'sneha.pillai@example.com', null, [
    ['ORD-1013', 16, [['Knee Brace', 'BRC-KNE', 1, 999], ['Wrist Support', 'BRC-WRS', 2, 449]]],
  ]],
  ['Vikram Joshi', 'vikram.joshi@example.com', '+91 98330 66006', [
    ['ORD-1014', 35, [['Memory Foam Mattress Topper', 'MAT-TOP', 1, 4999], ['Travel Neck Pillow', 'PIL-NECK', 1, 699]]],
  ]],
  ['Ananya Das', 'ananya.das@example.com', '+91 97420 77007', [
    ['ORD-1015', 7, [['Plantar Fasciitis Insoles', 'INS-PLN', 2, 799], ['Heel Cups', 'INS-HEEL', 1, 549], ['Posture Corrector', 'BLT-PST', 1, 1099]]],
  ]],
];

type Extra = { resolution?: Resolution; refundRupees?: number; notes?: string[]; removed?: boolean };

// [order number, line index on that order, quantity, Reason, final Status, days ago raised, extras]
// Live requests (open, in_review, approved, not removed) each take their own Order Line; the unique index rejects a clash.
const requests: [string, number, number, Reason, Status, number, Extra?][] = [
  ['ORD-1001', 0, 1, 'damaged', 'in_review', 2, { notes: ['Customer sent two photos. Seam split along the long edge; foam is fine.', 'Pickup booked for Monday. Customer prefers a refund over a replacement.'] }],
  ['ORD-1004', 0, 1, 'size_issue', 'open', 0.4],
  ['ORD-1010', 2, 1, 'wrong_item', 'approved', 1, { resolution: 'replacement' }],
  ['ORD-1003', 0, 1, 'not_as_described', 'in_review', 1.5, { notes: ['Says the belt is narrower than the listing photo.'] }],
  ['ORD-1002', 0, 1, 'size_issue', 'open', 4],
  ['ORD-1007', 1, 2, 'damaged', 'approved', 3, { resolution: 'refund', refundRupees: 2498, notes: ['Both cushions arrived with torn covers.'] }],
  ['ORD-1011', 0, 1, 'changed_mind', 'open', 0.2],
  ['ORD-1012', 0, 1, 'damaged', 'open', 1],
  ['ORD-1013', 1, 2, 'size_issue', 'in_review', 5],
  ['ORD-1014', 1, 1, 'wrong_item', 'approved', 6, { resolution: 'store_credit', notes: ['Customer happy to take credit for a different pillow.'] }],
  ['ORD-1015', 0, 1, 'size_issue', 'open', 2.5],
  ['ORD-1005', 1, 2, 'not_as_described', 'in_review', 3.5],
  ['ORD-1008', 0, 3, 'damaged', 'approved', 8, { resolution: 'refund', refundRupees: 1347 }],
  ['ORD-1006', 0, 1, 'changed_mind', 'open', 9],
  ['ORD-1003', 2, 1, 'damaged', 'in_review', 7, { notes: ['Zip broken on arrival.'] }],
  ['ORD-1015', 2, 1, 'wrong_item', 'open', 0.8],
  ['ORD-1009', 0, 1, 'changed_mind', 'rejected', 12, { notes: ['Topper was used for three weeks; outside the return window.'] }],
  ['ORD-1007', 0, 1, 'damaged', 'completed', 14, { resolution: 'refund', refundRupees: 1799 }],
  ['ORD-1008', 0, 1, 'wrong_item', 'completed', 16, { resolution: 'replacement' }],
  ['ORD-1010', 0, 1, 'size_issue', 'rejected', 20],
  ['ORD-1003', 1, 2, 'damaged', 'completed', 25, { resolution: 'store_credit' }],
  ['ORD-1001', 1, 1, 'not_as_described', 'completed', 18, { resolution: 'refund', refundRupees: 1000, notes: ['Partial refund agreed: customer keeps the cushion.'] }],
  ['ORD-1014', 0, 1, 'damaged', 'completed', 30, { resolution: 'replacement' }],
  ['ORD-1013', 0, 1, 'changed_mind', 'rejected', 10],
  ['ORD-1005', 0, 1, 'wrong_item', 'completed', 4.5, { resolution: 'refund', refundRupees: 1499 }],
  ['ORD-1011', 1, 1, 'not_as_described', 'rejected', 9.5, { notes: ['Photos show the foot rest matches the listing.'] }],
  ['ORD-1004', 0, 2, 'damaged', 'completed', 13, { resolution: 'refund', refundRupees: 2798 }],
  ['ORD-1015', 1, 1, 'size_issue', 'completed', 5.5, { resolution: 'store_credit' }],
  ['ORD-1002', 0, 1, 'changed_mind', 'open', 6, { removed: true }],
  ['ORD-1009', 0, 1, 'wrong_item', 'rejected', 11, { removed: true }],
  ['ORD-1012', 0, 1, 'changed_mind', 'open', 2, { removed: true, notes: ['Raised on the wrong order by mistake.'] }],
  ['ORD-1006', 0, 1, 'damaged', 'rejected', 30, { removed: true }],
];

// The legal path to each final Status (README "Lifecycle").
const paths: Record<Status, Status[]> = {
  open: ['open'],
  in_review: ['open', 'in_review'],
  approved: ['open', 'in_review', 'approved'],
  rejected: ['open', 'in_review', 'rejected'],
  completed: ['open', 'in_review', 'approved', 'completed'],
};

async function main() {
  // One transaction, so a failure midway leaves the old data in place instead of an empty desk.
  await db().transaction(async (tx) => {
    await tx.execute(sql`TRUNCATE customers, orders, order_lines, return_requests, status_changes, notes RESTART IDENTITY CASCADE`);
    const lineIds = new Map<string, { id: number; name: string; email: string; phone: string | null }>();
    for (const [name, email, phone, customerOrders] of seed) {
      const [customer] = await tx.insert(customers).values({ name, email, phone }).returning();
      for (const [number, days, lines] of customerOrders) {
        const [order] = await tx.insert(orders).values({ number, customerId: customer.id, placedAt: ago(days) }).returning();
        const inserted = await tx
          .insert(orderLines)
          .values(lines.map(([productName, sku, quantity, rupees]) => ({ orderId: order.id, productName, sku, quantity, unitPricePaise: rupees * 100 })))
          .returning();
        inserted.forEach((l, i) => lineIds.set(`${number}:${i}`, { id: l.id, name, email, phone }));
      }
    }
    // Oldest first, so References rise with time like they would in real use.
    for (const [number, index, quantity, reason, end, days, extra = {}] of [...requests].sort((a, b) => b[5] - a[5])) {
      const line = lineIds.get(`${number}:${index}`)!;
      const createdAt = ago(days);
      // Later events spread over up to four days, never into the future.
      const span = Math.min(days * 0.8, 4) * DAY;
      const at = (f: number) => new Date(createdAt.getTime() + span * f);
      const path = paths[end];
      const changeTimes = path.map((_, i) => at(i / path.length));
      const noteTimes = (extra.notes ?? []).map((_, i, all) => at((i + 0.5) / all.length));
      const lastActivityAt = new Date(Math.max(...[...changeTimes, ...noteTimes].map((t) => t.getTime())));
      const [request] = await tx
        .insert(returnRequests)
        .values({
          orderLineId: line.id, quantity, reason, contactName: line.name, contactEmail: line.email, contactPhone: line.phone, status: end,
          resolution: extra.resolution ?? null, refundAmountPaise: extra.refundRupees ? extra.refundRupees * 100 : null,
          createdAt, lastActivityAt, removedAt: extra.removed ? at(1) : null,
        })
        .returning();
      await tx.insert(statusChanges).values(path.map((to, i) => ({ returnRequestId: request.id, fromStatus: i ? path[i - 1] : null, toStatus: to, createdAt: changeTimes[i] })));
      if (extra.notes) await tx.insert(notes).values(extra.notes.map((body, i) => ({ returnRequestId: request.id, body, createdAt: noteTimes[i] })));
    }
  });
  console.log(`Seeded ${requests.length} return requests.`);
  process.exit(0);
}

main().catch((e) => { console.error(e); process.exit(1); });
