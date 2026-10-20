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

const call = (method: string, path: string, payload?: unknown) =>
  fetch(base + path, { method, headers: { 'Content-Type': 'application/json' }, body: payload === undefined ? undefined : JSON.stringify(payload) });

async function checkSent(name: string, method: string, path: string, status: number, payload: unknown) {
  const res = await call(method, path, payload);
  const pass = res.status === status;
  if (!pass) failed++;
  console.log(`${pass ? 'PASS' : 'FAIL'}  ${name}  (${res.status})`);
}
const checkCreated = (name: string, path: string, payload: unknown) => checkSent(name, 'POST', path, 201, payload);

/** Walks the seeded orders up from ORD-1001 until `pick` finds something. Numbers run without gaps, so the first 404 is the end. */
async function firstOrder<T>(pick: (order: any) => Promise<T | null>) {
  for (let n = 1001; ; n++) {
    const res = await fetch(`${base}/api/orders/ORD-${n}`);
    if (!res.ok) return null;
    const found = await pick((await res.json()).data);
    if (found) return found;
  }
}

const raiseBody = (order: any, line: any, quantity: number) =>
  ({ orderLineId: line.id, quantity, reason: 'damaged', contactName: order.customer.name, contactEmail: order.customer.email });

/** The new request's reference, or null if the line already has a Live request. */
async function raiseRef(body: unknown): Promise<string | null> {
  const res = await call('POST', '/api/return-requests', body);
  return res.status === 201 ? (await res.json()).data.reference : null;
}

/** Closes a request from wherever it stands, which frees its line for the next raise. */
async function close(reference: string) {
  const moves = `/api/return-requests/${reference}/status-changes`;
  const { status } = (await (await fetch(`${base}/api/return-requests/${reference}`)).json()).data;
  if (status === 'approved') return call('POST', moves, { to: 'completed' });
  if (status === 'open') await call('POST', moves, { to: 'in_review' });
  return call('POST', moves, { to: 'rejected', reason: 'Closed by check-rules.' });
}

/**
 * Stale cap: a correction down to 1 unit races an approval at the 2-unit cap, again and again. Whichever wins, the stored
 * Refund Amount must stay within unit price × stored quantity. Each round closes its request, which frees the line for the next.
 */
async function staleCapRace(rounds: number) {
  const free = await firstOrder(async (order) => {
    for (const line of order.lines.filter((l: any) => l.quantity >= 2)) {
      const raise = raiseBody(order, line, 2);
      const reference = await raiseRef(raise);
      if (reference) return { raise, line, reference };
    }
    return null;
  });
  if (!free) {
    failed++;
    return console.log('FAIL  stale cap race: no Order Line with 2+ units free to raise against');
  }
  const cap = free.line.unitPricePaise * 2;
  const tally: Record<string, number> = {};
  let broken = 0;
  let reference: string | null = free.reference;
  for (let i = 0; i < rounds && reference; i++) {
    const self: string = `/api/return-requests/${reference}`;
    await call('POST', `${self}/status-changes`, { to: 'in_review' });
    // Alternate which is sent first, so both orders of arrival get tried.
    const correction = () => call('PATCH', self, { quantity: 1 });
    const approval = () => call('POST', `${self}/status-changes`, { to: 'approved', resolution: 'refund', refundAmountPaise: cap });
    const [patch, approve] = i % 2 ? await Promise.all([correction(), approval()]) : await Promise.all([approval(), correction()]).then(([a, c]) => [c, a]);
    // Correction wins (approval misses its pin, or reads 1 unit and fails the cap), or approval wins and the correction finds it Decided.
    const outcome = `PATCH ${patch.status} / approve ${approve.status}`;
    if (!['PATCH 200 / approve 409', 'PATCH 200 / approve 422', 'PATCH 409 / approve 201'].includes(outcome)) broken++;
    tally[outcome] = (tally[outcome] ?? 0) + 1;
    const stored = (await (await fetch(base + self)).json()).data;
    if (stored.status === 'approved' && stored.refundAmountPaise > free.line.unitPricePaise * stored.quantity) broken++;
    await close(reference);
    reference = i + 1 < rounds ? await raiseRef(free.raise) : null;
    if (i + 1 < rounds && !reference) broken++;
  }
  if (broken) failed++;
  console.log(`${broken ? 'FAIL' : 'PASS'}  stale cap race, ${rounds} rounds: the stored Refund Amount never beats the cap  (${Object.entries(tally).map(([k, v]) => `${k}: ${v}`).join('; ')})`);
}

/**
 * Two corrections race, each checking the quantity cap half against the stored row: `{quantity: 2}` on line A (2+ units)
 * and a move to line B (1 unit) on the same Order. Each pins the half it didn't send, so together they can never leave
 * 2 units on the 1-unit line. Each round closes its request, which frees both lines for the next.
 */
async function correctionPinRace(rounds: number) {
  const found = await firstOrder(async (order) => {
    const a = order.lines.find((l: any) => l.quantity >= 2);
    const b = order.lines.find((l: any) => l.quantity === 1);
    if (!a || !b) return null;
    // B must be free too, or every move is only the one-Live-request 409.
    const probe = await raiseRef(raiseBody(order, b, 1));
    if (!probe) return null;
    await close(probe);
    const reference = await raiseRef(raiseBody(order, a, 1));
    return reference ? { order, a, b, reference } : null;
  });
  if (!found) {
    failed++;
    return console.log('FAIL  correction pin race: no Order with a free 2+ unit line and a free 1-unit line');
  }
  const tally: Record<string, number> = {};
  let broken = 0;
  let reference: string | null = found.reference;
  for (let i = 0; i < rounds && reference; i++) {
    const self: string = `/api/return-requests/${reference}`;
    const [quantity, move] = await Promise.all([call('PATCH', self, { quantity: 2 }), call('PATCH', self, { orderLineId: found.b.id })]);
    const outcome = `quantity ${quantity.status} / move ${move.status}`;
    tally[outcome] = (tally[outcome] ?? 0) + 1;
    const stored = (await (await fetch(base + self)).json()).data;
    if (stored.quantity > (stored.orderLineId === found.b.id ? found.b.quantity : found.a.quantity)) broken++;
    await close(reference);
    reference = i + 1 < rounds ? await raiseRef(raiseBody(found.order, found.a, 1)) : null;
    if (i + 1 < rounds && !reference) broken++;
  }
  if (broken) failed++;
  console.log(`${broken ? 'FAIL' : 'PASS'}  correction pin race, ${rounds} rounds: the stored quantity never beats its line  (${Object.entries(tally).map(([k, v]) => `${k}: ${v}`).join('; ')})`);
}

/**
 * Removal on a free line: refused from In Review, allowed from Rejected and Open; a Removed request answers 404 on every route,
 * and its line takes a new request. Returns that new request (Open) for the race.
 */
async function removalChecks() {
  const found = await firstOrder(async (order) => {
    for (const line of order.lines) {
      const reference = await raiseRef(raiseBody(order, line, 1));
      if (reference) return { order, line, reference };
    }
    return null;
  });
  if (!found) {
    failed++;
    console.log('FAIL  removal: no Order Line free to raise against');
    return null;
  }
  const raise = raiseBody(found.order, found.line, 1);
  let self = `/api/return-requests/${found.reference}`;
  await call('POST', `${self}/status-changes`, { to: 'in_review' });
  await check('removing an In Review request → 409', 'DELETE', self, 409, 'illegal_removal');
  await call('POST', `${self}/status-changes`, { to: 'rejected', reason: 'Raised by check-rules.' });
  await checkSent('removing a Rejected request → 204', 'DELETE', self, 204, undefined);

  const open = await raiseRef(raise);
  self = `/api/return-requests/${open}`;
  const loaded = (await (await fetch(base + self)).json()).data.lastActivityAt;
  await call('POST', `${self}/notes`, { body: 'Written after the remover loaded the page.' });
  await check('removal with a stale version → 409', 'DELETE', `${self}?expectedLastActivityAt=${encodeURIComponent(loaded)}`, 409, 'conflict');
  const res = await call('DELETE', self);
  const empty = res.status === 204 && (await res.text()) === '';
  if (!empty) failed++;
  console.log(`${empty ? 'PASS' : 'FAIL'}  removing an Open request → 204, no body  (${res.status})`);
  await check('fetching a Removed request → 404', 'GET', self, 404, 'return_request_not_found');
  await check('correcting a Removed request → 404', 'PATCH', self, 404, 'return_request_not_found', { reason: 'damaged' });
  await check('Note on a Removed request → 404', 'POST', `${self}/notes`, 404, 'return_request_not_found', { body: 'Hello' });
  await check('status change on a Removed request → 404', 'POST', `${self}/status-changes`, 404, 'return_request_not_found', { to: 'in_review' });
  await check('removing a Removed request again → 404', 'DELETE', self, 404, 'return_request_not_found');
  const listed = (await (await fetch(`${base}/api/return-requests?q=${open}`)).json()).data;
  const hidden = Array.isArray(listed) && listed.length === 0;
  if (!hidden) failed++;
  console.log(`${hidden ? 'PASS' : 'FAIL'}  a Removed request leaves the list`);
  const again = await call('POST', '/api/return-requests', raise);
  if (again.status !== 201) failed++;
  console.log(`${again.status === 201 ? 'PASS' : 'FAIL'}  raising again on the freed Order Line → 201  (${again.status})`);
  return again.status === 201 ? { raise, reference: (await again.json()).data.reference as string } : null;
}

/**
 * Edit versus remove: a correction and a removal on an Open request, both carrying the version the agent loaded.
 * Exactly one wins: removal first leaves the correction a 404, correction first leaves the removal a 409.
 */
async function editRemoveRace(start: { raise: unknown; reference: string } | null, rounds: number) {
  if (!start) {
    failed++;
    return console.log('FAIL  edit versus remove race: no Open request to race on');
  }
  const tally: Record<string, number> = {};
  let broken = 0;
  let reference: string | null = start.reference;
  for (let i = 0; i < rounds && reference; i++) {
    const self: string = `/api/return-requests/${reference}`;
    const v = (await (await fetch(base + self)).json()).data.lastActivityAt;
    const correction = () => call('PATCH', self, { reason: 'wrong_item', expectedLastActivityAt: v });
    const removal = () => call('DELETE', `${self}?expectedLastActivityAt=${encodeURIComponent(v)}`);
    const [patch, del] = i % 2 ? await Promise.all([correction(), removal()]) : await Promise.all([removal(), correction()]).then(([d, c]) => [c, d]);
    const outcome = `PATCH ${patch.status} / DELETE ${del.status}`;
    tally[outcome] = (tally[outcome] ?? 0) + 1;
    if (!['PATCH 404 / DELETE 204', 'PATCH 200 / DELETE 409'].includes(outcome)) broken++;
    // The correction won: remove it without a version, which frees the line for the next round.
    if (patch.status === 200 && (await call('DELETE', self)).status !== 204) broken++;
    reference = i + 1 < rounds ? await raiseRef(start.raise) : null;
    if (i + 1 < rounds && !reference) broken++;
  }
  if (broken) failed++;
  console.log(`${broken ? 'FAIL' : 'PASS'}  edit versus remove race, ${rounds} rounds: exactly one wins  (${Object.entries(tally).map(([k, v]) => `${k}: ${v}`).join('; ')})`);
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
  await check('removal with a bad version → 400', 'DELETE', '/api/return-requests/RD-999999?expectedLastActivityAt=yesterday', 400, 'invalid_request');
  await check('PUT on a real route → JSON 405', 'PUT', '/api/return-requests', 405, 'method_not_allowed');
  await check('unknown reference → 404', 'GET', '/api/return-requests/RD-999999', 404, 'return_request_not_found');

  // Lifecycle, on the request just raised. It ends Completed, which frees the line for the next run.
  if (created) {
    const moves = `/api/return-requests/${created.reference}/status-changes`;
    const cap = line.unitPricePaise * created.quantity;
    const self = `/api/return-requests/${created.reference}`;
    const other = (await (await fetch(`${base}/api/orders/ORD-1002`)).json()).data;
    await check('correction over the quantity ordered → 422', 'PATCH', self, 422, 'quantity_over_ordered', { quantity: line.quantity + 1 });
    await check('correction onto another Order\'s line → 422', 'PATCH', self, 422, 'order_line_on_other_order', { orderLineId: other.lines[0].id });
    // The seed keeps this order's first line In Review.
    await check('correction onto a line with a Live request → 409', 'PATCH', self, 409, 'duplicate_live_request', { orderLineId: order.lines[0].id });
    const loaded = (await (await fetch(base + self)).json()).data.lastActivityAt;
    await checkSent('correction with the version it loaded → 200', 'PATCH', self, 200, { reason: 'size_issue', expectedLastActivityAt: loaded });
    await check('correction with a stale version → 409', 'PATCH', self, 409, 'conflict', { reason: 'damaged', expectedLastActivityAt: loaded });
    await checkOk('the corrected Reason is stored', self, (d) => d?.reason === 'size_issue');
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
    await check('removing an Approved request → 409', 'DELETE', self, 409, 'illegal_removal');
    await checkCreated('Approved → Completed → 201', moves, { to: 'completed' });
    await check('removing a Completed request → 409', 'DELETE', self, 409, 'illegal_removal');
    await check('out of Completed → 409', 'POST', moves, 409, 'illegal_transition', { to: 'in_review' });
    await check('correcting a Decided request → 409', 'PATCH', self, 409, 'request_decided', { reason: 'damaged' });
    const notesPath = `/api/return-requests/${created.reference}/notes`;
    await checkCreated('Note on a Closed request → 201', notesPath, { body: 'Refund sent to the original card.' });
    await checkOk('the Note shows last in the timeline', `/api/return-requests/${created.reference}`, (d) => d?.timeline.at(-1)?.body === 'Refund sent to the original card.');
    await check('empty Note → 400', 'POST', notesPath, 400, 'invalid_request', { body: '   ' });
    await check('editing a Note → JSON 405', 'PATCH', notesPath, 405, 'method_not_allowed', { body: 'changed' });
    await check('deleting a Note → JSON 405', 'DELETE', notesPath, 405, 'method_not_allowed');
  } else console.log('SKIP  lifecycle checks (no new request on this run; rerun or reseed)');
  await check('status change on an unknown reference → 404', 'POST', '/api/return-requests/RD-999999/status-changes', 404, 'return_request_not_found', { to: 'in_review' });
  await check('Note on an unknown reference → 404', 'POST', '/api/return-requests/RD-999999/notes', 404, 'return_request_not_found', { body: 'Hello' });
  await check('status in a correction → 400', 'PATCH', '/api/return-requests/RD-999999', 400, 'invalid_request', { status: 'approved' });
  await check('empty correction → 400', 'PATCH', '/api/return-requests/RD-999999', 400, 'invalid_request', {});
  await check('correction of an unknown reference → 404', 'PATCH', '/api/return-requests/RD-999999', 404, 'return_request_not_found', { reason: 'damaged' });
  await staleCapRace(20);
  await correctionPinRace(10);
  await editRemoveRace(await removalChecks(), 20);
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
