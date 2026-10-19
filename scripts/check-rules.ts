export {};
// Hits the running API over HTTP, once per rule. Local only: later cases create and remove requests.
const base = process.env.BASE_URL ?? 'http://localhost:3000';
if (!['localhost', '127.0.0.1'].includes(new URL(base).hostname)) {
  console.error(`Refusing to run against ${base}: check-rules is local only.`);
  process.exit(1);
}

let failed = 0;

async function check(name: string, method: string, path: string, status: number, code: string) {
  const res = await fetch(base + path, { method });
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
  process.exit(failed ? 1 : 0);
}

main();
