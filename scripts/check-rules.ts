export {};
// Hits the running API over HTTP, once per rule. Local only: later cases create and remove requests.
const base = process.env.BASE_URL ?? 'http://localhost:3000';
if (!['localhost', '127.0.0.1'].includes(new URL(base).hostname)) {
  console.error(`Refusing to run against ${base}: check-rules is local only.`);
  process.exit(1);
}

let failed = 0;

async function check(name: string, method: string, path: string, status: number, code: string, payload?: unknown) {
  const res = await fetch(base + path, { method, headers: { 'Content-Type': 'application/json' }, body: payload === undefined ? undefined : JSON.stringify(payload) });
  const body = await res.json().catch(() => null);
  const ok = res.status === status && body?.error?.code === code;
  if (!ok) failed++;
  console.log(`${ok ? 'PASS' : 'FAIL'}  ${name}  (${res.status} ${body?.error?.code ?? 'no envelope'})`);
}

async function checkOk(name: string, path: string, ok: (data: any) => boolean) {
  const res = await fetch(base + path);
  const body = await res.json().catch(() => null);
  const pass = res.status === 200 && ok(body?.data);
  if (!pass) failed++;
  console.log(`${pass ? 'PASS' : 'FAIL'}  ${name}  (${res.status})`);
}

async function main() {
  await checkOk('order lookup trims and ignores case', '/api/orders/%20ord-1001', (d) => d?.number === 'ORD-1001' && d.lines.length > 0);
  await check('unknown API path → 404 envelope', 'GET', '/api/nope', 404, 'not_found');
  await check('unknown order → 404 envelope', 'GET', '/api/orders/NO-SUCH-ORDER', 404, 'order_not_found');
  await check('bare /api → 404 envelope', 'GET', '/api', 404, 'not_found');

  // Raising. Line ids come from the seeded order, not hardcoded.
  const order = (await (await fetch(`${base}/api/orders/ORD-1001`)).json()).data;
  // The seed leaves this line with only a Completed request, so the first raise after a reseed succeeds.
  const line = order.lines[1];
  const raise = { orderLineId: line.id, quantity: 1, reason: 'damaged', contactName: order.customer.name, contactEmail: order.customer.email };
  // A rerun finds the request from the last run still Live, so the first raise may already be the duplicate.
  const first = await fetch(`${base}/api/return-requests`, { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(raise) });
  const created = first.status === 201 ? (await first.json()).data : null;
  if (![201, 409].includes(first.status)) failed++;
  console.log(`${[201, 409].includes(first.status) ? 'PASS' : 'FAIL'}  raise → 201 (or 409 on a rerun)  (${first.status})`);
  if (created) await checkOk('detail has the initial Status Change into Open', `/api/return-requests/${created.reference}`, (d) => d?.timeline?.[0]?.from === null && d.timeline[0].to === 'open');
  else console.log('SKIP  detail timeline check (no new request on a rerun; reseed to run it)');
  await check('duplicate Live request → 409', 'POST', '/api/return-requests', 409, 'duplicate_live_request', raise);
  await check('quantity over ordered → 422', 'POST', '/api/return-requests', 422, 'quantity_over_ordered', { ...raise, quantity: line.quantity + 1 });
  await check('unknown Order Line → 422', 'POST', '/api/return-requests', 422, 'unknown_order_line', { ...raise, orderLineId: 2_000_000_000 });
  await check('huge number → 400', 'POST', '/api/return-requests', 400, 'invalid_request', { ...raise, quantity: 1e20 });
  await check('\\u0000 in text → 400', 'POST', '/api/return-requests', 400, 'invalid_request', { ...raise, contactName: 'A\u0000B' });
  await check('unknown field → 400', 'POST', '/api/return-requests', 400, 'invalid_request', { ...raise, status: 'approved' });
  await check('PUT on a real route → JSON 405', 'PUT', '/api/return-requests', 405, 'method_not_allowed');
  await check('unknown reference → 404', 'GET', '/api/return-requests/RD-999999', 404, 'return_request_not_found');

  // Listing.
  await check('pageSize over 100 → 400', 'GET', '/api/return-requests?pageSize=101', 400, 'invalid_request');
  await check('unknown sort → 400', 'GET', '/api/return-requests?sort=reference', 400, 'invalid_request');
  await check('unknown status filter → 400', 'GET', '/api/return-requests?status=open,lost', 400, 'invalid_request');
  await checkOk('search escapes % so it matches literally', '/api/return-requests?q=%25', (d) => Array.isArray(d) && d.length === 0);
  await checkOk('status filter returns only that status', '/api/return-requests?status=approved,rejected&pageSize=100', (d) => d.length > 0 && d.every((r: any) => ['approved', 'rejected'].includes(r.status)));
  process.exit(failed ? 1 : 0);
}

main();
