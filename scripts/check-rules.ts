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

async function checkCreated(name: string, path: string, payload: unknown) {
  const res = await fetch(base + path, { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(payload) });
  const pass = res.status === 201;
  if (!pass) failed++;
  console.log(`${pass ? 'PASS' : 'FAIL'}  ${name}  (${res.status})`);
}

async function main() {
  await checkOk('order lookup trims and ignores case', '/api/orders/%20ord-1001', (d) => d?.number === 'ORD-1001' && d.lines.length > 0);
  await checkOk('order lookup reads a bare 1001 as ORD-1001', '/api/orders/1001', (d) => d?.number === 'ORD-1001');
  await checkOk('order suggestions: digits match by prefix', '/api/orders?q=101', (d) => d.length > 0 && d.length <= 8 && d.every((o: any) => o.number.startsWith('ORD-101')));
  await checkOk('order suggestions: a name finds its orders', '/api/orders?q=aarav', (d) => d.length > 0 && d.every((o: any) => o.customerName === 'Aarav Mehta'));
  await checkOk('order suggestions: % matches literally', '/api/orders?q=%25', (d) => Array.isArray(d) && d.length === 0);
  await check('order suggestions without q → 400', 'GET', '/api/orders', 400, 'invalid_request');
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

  // Lifecycle, on the request just raised. It ends Completed, which frees the line for the next run.
  if (created) {
    const moves = `/api/return-requests/${created.reference}/status-changes`;
    const cap = line.unitPricePaise * created.quantity;
    await check('Open → Rejected → 409', 'POST', moves, 409, 'illegal_transition', { to: 'rejected' });
    await check('Open → Approved → 409', 'POST', moves, 409, 'illegal_transition', { to: 'approved', resolution: 'replacement' });
    await checkCreated('Open → In Review → 201', moves, { to: 'in_review' });
    await check('reject without a reason → 422', 'POST', moves, 422, 'rejection_reason_required', { to: 'rejected' });
    await check('approve without Resolution → 422', 'POST', moves, 422, 'resolution_required', { to: 'approved' });
    await check('Refund without an amount → 422', 'POST', moves, 422, 'refund_amount_required', { to: 'approved', resolution: 'refund' });
    await check('Refund Amount of 0 → 422', 'POST', moves, 422, 'refund_amount_out_of_range', { to: 'approved', resolution: 'refund', refundAmountPaise: 0 });
    await check('Refund Amount over unit price × units → 422', 'POST', moves, 422, 'refund_amount_out_of_range', { to: 'approved', resolution: 'refund', refundAmountPaise: cap + 1 });
    await check('Refund Amount past the int range → 422, not 400', 'POST', moves, 422, 'refund_amount_out_of_range', { to: 'approved', resolution: 'refund', refundAmountPaise: 2 ** 31 });
    await check('Refund Amount with Replacement → 422', 'POST', moves, 422, 'refund_amount_not_allowed', { to: 'approved', resolution: 'replacement', refundAmountPaise: 100 });
    await check('Resolution on Rejected → 422', 'POST', moves, 422, 'resolution_not_allowed', { to: 'rejected', resolution: 'refund' });
    // The loser either misses the guarded UPDATE (conflict) or reads Approved first (illegal_transition): both are 409.
    const statuses = (
      await Promise.all([1, 2].map(() => fetch(base + moves, { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ to: 'approved', resolution: 'refund', refundAmountPaise: cap }) })))
    ).map((r) => r.status).sort();
    const race = statuses[0] === 201 && statuses[1] === 409;
    if (!race) failed++;
    console.log(`${race ? 'PASS' : 'FAIL'}  two simultaneous approvals → one 201, one 409  (${statuses.join(', ')})`);
    await checkOk('approval shows in the timeline with its Refund Amount', `/api/return-requests/${created.reference}`, (d) => d?.status === 'approved' && d.refundAmountPaise === cap && d.timeline.filter((t: any) => t.to === 'approved').length === 1);
    await checkCreated('Approved → Completed → 201', moves, { to: 'completed' });
    await check('out of Completed → 409', 'POST', moves, 409, 'illegal_transition', { to: 'in_review' });
    const notesPath = `/api/return-requests/${created.reference}/notes`;
    await checkCreated('Note on a Closed request → 201', notesPath, { body: 'Refund sent to the original card.' });
    await checkOk('the Note shows last in the timeline', `/api/return-requests/${created.reference}`, (d) => d?.timeline.at(-1)?.body === 'Refund sent to the original card.');
    await check('empty Note → 400', 'POST', notesPath, 400, 'invalid_request', { body: '   ' });
    await check('editing a Note → JSON 405', 'PATCH', notesPath, 405, 'method_not_allowed', { body: 'changed' });
    await check('deleting a Note → JSON 405', 'DELETE', notesPath, 405, 'method_not_allowed');
  } else console.log('SKIP  lifecycle checks (no new request on this run; rerun or reseed)');
  await check('status change on an unknown reference → 404', 'POST', '/api/return-requests/RD-999999/status-changes', 404, 'return_request_not_found', { to: 'in_review' });
  await check('Note on an unknown reference → 404', 'POST', '/api/return-requests/RD-999999/notes', 404, 'return_request_not_found', { body: 'Hello' });
  await check('unknown Status → 400', 'POST', '/api/return-requests/RD-999999/status-changes', 400, 'invalid_request', { to: 'lost' });

  // Listing.
  await check('pageSize over 100 → 400', 'GET', '/api/return-requests?pageSize=101', 400, 'invalid_request');
  await check('unknown sort → 400', 'GET', '/api/return-requests?sort=reference', 400, 'invalid_request');
  await check('unknown status filter → 400', 'GET', '/api/return-requests?status=open,lost', 400, 'invalid_request');
  await checkOk('search escapes % so it matches literally', '/api/return-requests?q=%25', (d) => Array.isArray(d) && d.length === 0);
  await checkOk('status filter returns only that status', '/api/return-requests?status=approved,rejected&pageSize=100', (d) => d.length > 0 && d.every((r: any) => ['approved', 'rejected'].includes(r.status)));
  process.exit(failed ? 1 : 0);
}

main();
