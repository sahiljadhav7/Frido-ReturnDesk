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

type Extra = { resolution?: Resolution; refundRupees?: number; notes?: string[]; rejectReason?: string; removed?: boolean };

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
  ['ORD-1009', 0, 1, 'changed_mind', 'rejected', 12, { rejectReason: 'Topper was used for three weeks; outside the return window.' }],
  ['ORD-1007', 0, 1, 'damaged', 'completed', 14, { resolution: 'refund', refundRupees: 1799 }],
  ['ORD-1008', 0, 1, 'wrong_item', 'completed', 16, { resolution: 'replacement' }],
  ['ORD-1010', 0, 1, 'size_issue', 'rejected', 20, { rejectReason: 'Pillow was washed and the cover has shrunk; not resaleable.' }],
  ['ORD-1003', 1, 2, 'damaged', 'completed', 25, { resolution: 'store_credit' }],
  ['ORD-1001', 1, 1, 'not_as_described', 'completed', 18, { resolution: 'refund', refundRupees: 1000, notes: ['Partial refund agreed: customer keeps the cushion.'] }],
  ['ORD-1014', 0, 1, 'damaged', 'completed', 30, { resolution: 'replacement' }],
  ['ORD-1013', 0, 1, 'changed_mind', 'rejected', 10, { rejectReason: 'Asked after the 10-day change-of-mind window.' }],
  ['ORD-1005', 0, 1, 'wrong_item', 'completed', 4.5, { resolution: 'refund', refundRupees: 1499 }],
  ['ORD-1011', 1, 1, 'not_as_described', 'rejected', 9.5, { rejectReason: 'Photos show the foot rest matches the listing.' }],
  ['ORD-1004', 0, 2, 'damaged', 'completed', 13, { resolution: 'refund', refundRupees: 2798 }],
  ['ORD-1015', 1, 1, 'size_issue', 'completed', 5.5, { resolution: 'store_credit' }],
  ['ORD-1002', 0, 1, 'changed_mind', 'open', 6, { removed: true }],
  ['ORD-1009', 0, 1, 'wrong_item', 'rejected', 11, { removed: true, rejectReason: 'Item received matches the order.' }],
  ['ORD-1012', 0, 1, 'changed_mind', 'open', 2, { removed: true, notes: ['Raised on the wrong order by mistake.'] }],
  ['ORD-1006', 0, 1, 'damaged', 'rejected', 30, { removed: true, rejectReason: 'Damage is wear from use, not from delivery.' }],
];

// Generated on top of the hand-written rows above, so the desk shows 100 requests. A fixed seed makes every run
// identical. ORD-1016 to ORD-1075 get requests, one per Order Line so no two Live ones clash; ORD-1076 to ORD-1095
// get none, so there are always orders ready to raise against.
const TOTAL_REQUESTS = 100;
const FIRST_FREE_ORDER = 1076;
const LAST_ORDER = 1095;

function random(seed: number) {
  // mulberry32: a tiny seeded PRNG, so the seed is reproducible without a dependency.
  return () => {
    seed = (seed + 0x6d2b79f5) | 0;
    let t = Math.imul(seed ^ (seed >>> 15), 1 | seed);
    t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}
const rand = random(42);
const pick = <T,>(items: readonly T[]) => items[Math.floor(rand() * items.length)];
const between = (lo: number, hi: number) => lo + rand() * (hi - lo);

const PRODUCTS: [string, string, number][] = [
  ['Ortho Pillow', 'PIL-ORTHO', 1499], ['Memory Foam Seat Cushion', 'CSH-MEM', 1199], ['Plantar Fasciitis Insoles', 'INS-PLN', 799],
  ['Lumbar Support Belt', 'BLT-LMB', 1299], ['Knee Brace', 'BRC-KNE', 999], ['Travel Neck Pillow', 'PIL-NECK', 699],
  ['Gel Seat Cushion', 'CSH-GEL', 1399], ['Heel Cups', 'INS-HEEL', 549], ['Posture Corrector', 'BLT-PST', 1099],
  ['Foot Rest', 'FRT-REST', 1799], ['Lumbar Cushion', 'CSH-LMB', 1249], ['Wrist Support', 'BRC-WRS', 449],
  ['Memory Foam Mattress Topper', 'MAT-TOP', 4999], ['Ankle Brace', 'BRC-ANK', 649], ['Cervical Pillow', 'PIL-CERV', 1699],
  ['Arch Support Insoles', 'INS-ARCH', 899], ['Back Stretcher', 'BCK-STR', 1599], ['Coccyx Cushion', 'CSH-COC', 1349],
];
// First names differ from the hand-written customers, so searching "aarav" still finds only Aarav Mehta.
const FIRST = ['Riya', 'Karan', 'Neha', 'Aditya', 'Pooja', 'Siddharth', 'Tanvi', 'Nikhil', 'Kavya', 'Rahul', 'Shreya', 'Varun', 'Priya', 'Manish', 'Aditi', 'Harsh', 'Nisha', 'Yash', 'Simran', 'Dev', 'Ira', 'Omkar', 'Lavanya', 'Kunal', 'Divya', 'Pranav', 'Sanya', 'Gaurav', 'Rhea', 'Tushar'];
const LAST = ['Shah', 'Menon', 'Gupta', 'Reddy', 'Chopra', 'Bhat', 'Kapoor', 'Patel', 'Sharma', 'Ghosh', 'Malhotra', 'Naidu', 'Saxena', 'Kulkarni', 'Banerjee'];
const NOTES: Record<Reason, string[]> = {
  damaged: ['Customer sent photos of the damage.', 'Box was crushed in transit.', 'Stitching came apart on the first day.', 'Courier confirmed the parcel was dropped.'],
  wrong_item: ['Received a different size from the one ordered.', 'Wrong colour sent.', 'Got the cushion instead of the pillow.', 'Warehouse confirmed a picking mistake.'],
  size_issue: ['Too small for the customer.', 'Customer wants the next size up.', 'Fit chart was misread; customer asked for help.'],
  not_as_described: ['Firmness differs from the listing.', 'Material feels different from the photos.', 'Listing said washable cover; it is not removable.'],
  changed_mind: ['No longer needed.', 'Bought a similar one elsewhere.', 'Gift that the recipient already had.'],
};
const REJECT_REASONS = ['Outside the return window.', 'Item shows signs of use.', 'Photos show no defect.', 'Item received matches the order.', 'Hygiene product, opened: not returnable.'];

type GeneratedOrder = [string, number, [string, string, number, number][]];
const extraCustomers: typeof seed = [];
for (let n = 1016, c = 0; n <= LAST_ORDER; c++) {
  const name = `${FIRST[c % FIRST.length]} ${LAST[(c * 7) % LAST.length]}`;
  const email = `${name.toLowerCase().replace(' ', '.')}@example.com`;
  const phone = rand() < 0.75 ? `+91 9${Math.floor(between(100000000, 999999999))}`.replace(/^(\+91 \d{5})(\d{5})$/, '$1 $2') : null;
  const owned: GeneratedOrder[] = [];
  for (let k = 0, count = 1 + Math.floor(rand() * 3); k < count && n <= LAST_ORDER; k++, n++) {
    const lines = Array.from({ length: 1 + Math.floor(rand() * 3) }, () => {
      const [product, sku, rupees] = pick(PRODUCTS);
      return [product, sku, 1 + Math.floor(rand() * 3), rupees] as [string, string, number, number];
    });
    owned.push([`ORD-${n}`, Math.round(between(8, 75)), lines]);
  }
  extraCustomers.push([name, email, phone, owned]);
}
seed.push(...extraCustomers);

const STATUS_MIX: Status[] = ['open', 'open', 'open', 'in_review', 'in_review', 'in_review', 'approved', 'approved', 'rejected', 'rejected', 'completed', 'completed', 'completed', 'completed'];
const raisable = extraCustomers.flatMap(([, , , owned]) => owned).filter(([number]) => Number(number.slice(4)) < FIRST_FREE_ORDER);
const freeLines = raisable.flatMap(([number, days, lines]) => lines.map((line, index) => ({ number, days, index, line })));
for (const { number, days: orderDays, index, line } of freeLines.slice(0, TOTAL_REQUESTS - requests.length)) {
  const [, , ordered, rupees] = line;
  const quantity = 1 + Math.floor(rand() * ordered);
  const reason = pick(['damaged', 'damaged', 'wrong_item', 'size_issue', 'size_issue', 'not_as_described', 'changed_mind'] as const);
  const end = pick(STATUS_MIX);
  const days = Math.round(between(0.2, orderDays - 1) * 10) / 10; // raised after the order was placed
  const extra: Extra = {};
  if (end === 'approved' || end === 'completed') {
    extra.resolution = pick(['refund', 'refund', 'replacement', 'store_credit'] as const);
    // Mostly the full price of the units, sometimes a partial refund; never over the cap.
    if (extra.resolution === 'refund') extra.refundRupees = rand() < 0.75 ? rupees * quantity : Math.round(rupees * quantity * between(0.4, 0.9));
  }
  if (end === 'rejected') extra.rejectReason = pick(REJECT_REASONS);
  if (rand() < 0.45) extra.notes = [pick(NOTES[reason])];
  if ((end === 'open' || end === 'rejected') && rand() < 0.08) extra.removed = true;
  requests.push([number, index, quantity, reason, end, days, extra]);
}

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
      // Same instant as the move to Rejected, as the app writes it, so it sits right under "Moved to Rejected".
      if (extra.rejectReason) await tx.insert(notes).values({ returnRequestId: request.id, body: extra.rejectReason, createdAt: changeTimes.at(-1)! });
    }
  });
  const removed = requests.filter((r) => r[6]?.removed).length;
  const orderCount = seed.reduce((n, [, , , owned]) => n + owned.length, 0);
  console.log(`Seeded ${seed.length} customers, ${orderCount} orders (ORD-${FIRST_FREE_ORDER} to ORD-${LAST_ORDER} have no requests) and ${requests.length} return requests (${removed} Removed).`);
  process.exit(0);
}

main().catch((e) => { console.error(e); process.exit(1); });
