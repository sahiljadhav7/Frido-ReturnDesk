'use client';

import { useState } from 'react';
import type { getOrderByNumber } from '@/db/reads';
import { formatPaise } from '@/lib/format';

type Order = Awaited<ReturnType<typeof getOrderByNumber>>;
type State = { kind: 'idle' } | { kind: 'loading' } | { kind: 'found'; order: Order } | { kind: 'error'; message: string };

export function OrderLookup() {
  const [number, setNumber] = useState('');
  const [state, setState] = useState<State>({ kind: 'idle' });

  async function find(e: React.FormEvent) {
    e.preventDefault();
    setState({ kind: 'loading' });
    try {
      const res = await fetch(`/api/orders/${encodeURIComponent(number)}`);
      const body = await res.json().catch(() => null);
      setState(res.ok ? { kind: 'found', order: body.data } : { kind: 'error', message: body?.error?.message ?? 'Something went wrong. Try again.' });
    } catch {
      setState({ kind: 'error', message: "Couldn't reach the server. Try again." });
    }
  }

  return (
    <div className="space-y-4">
      <section className="rounded-card bg-white p-4 shadow-card">
        {state.kind === 'error' && (
          <p role="alert" className="mb-3 rounded-lg bg-danger-soft px-3 py-2 text-danger">{state.message}</p>
        )}
        <form onSubmit={find} className="flex flex-col gap-3 sm:flex-row sm:items-end">
          <div className="flex-1">
            <label htmlFor="order-number" className="mb-1 block font-medium">Order number</label>
            <input
              id="order-number"
              value={number}
              onChange={(e) => setNumber(e.target.value)}
              placeholder="ORD-1001"
              autoComplete="off"
              required
              className="min-h-11 w-full rounded-lg border border-line bg-white px-3 sm:min-h-10"
            />
          </div>
          <button
            type="submit"
            disabled={state.kind === 'loading'}
            className="min-h-11 rounded-lg bg-ink-blue px-4 font-medium text-white disabled:opacity-50 sm:min-h-10"
          >
            {state.kind === 'loading' ? 'Finding…' : 'Find order'}
          </button>
        </form>
        {state.kind === 'found' && (
          <p className="mt-3">
            Customer: <span className="font-medium">{state.order.customer.name}</span>
            <span className="text-muted"> · {state.order.customer.email}</span>
          </p>
        )}
      </section>

      {state.kind === 'found' && (
        <section className="rounded-card bg-white p-4 shadow-card">
          <h2 className="mb-3 font-semibold">Order lines on {state.order.number}</h2>
          <ul className="divide-y divide-line">
            {state.order.lines.map((l) => (
              <li key={l.id} className="py-3">
                <p className="font-medium">{l.productName}</p>
                <p className="text-muted">
                  {l.sku} · Bought {l.quantity} · {formatPaise(l.unitPricePaise)} each
                </p>
              </li>
            ))}
          </ul>
        </section>
      )}
    </div>
  );
}
