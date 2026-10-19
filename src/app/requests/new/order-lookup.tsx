'use client';

import Link from 'next/link';
import { useState } from 'react';
import type { getOrderByNumber } from '@/db/reads';
import { formatDay, formatPaise } from '@/lib/format';
import { Avatar } from '../../_ui/avatar';
import { Icon } from '../../_ui/icons';
import { Shell } from '../../_ui/shell';

// placedAt arrives over JSON as a string, not the Date the read function returns.
type Order = Omit<Awaited<ReturnType<typeof getOrderByNumber>>, 'placedAt'> & { placedAt: string };
type State = { kind: 'idle' } | { kind: 'loading' } | { kind: 'found'; order: Order } | { kind: 'error'; message: string };
type Step = { label: string; summary: string; state: 'done' | 'current' | 'todo' };

export function OrderLookup() {
  const [number, setNumber] = useState('');
  const [state, setState] = useState<State>({ kind: 'idle' });
  const order = state.kind === 'found' ? state.order : null;

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

  const steps: Step[] = [
    { label: 'Order', summary: order ? `${order.number} · ${order.customer.name}` : 'Find it by number', state: order ? 'done' : 'current' },
    { label: 'Order Line', summary: 'The item coming back', state: order ? 'current' : 'todo' },
    { label: 'Details', summary: 'Quantity, reason, contact', state: 'todo' },
  ];

  return (
    <div className="grid gap-6 md:grid-cols-12 md:gap-8">
      <aside className="md:sticky md:top-8 md:col-span-4 md:self-start">
        <Link href="/" className="inline-flex h-11 items-center gap-2 rounded-full border border-hair bg-white pr-5 pl-4 text-sm">
          <Icon name="back" />
          Return requests
        </Link>
        <h1 className="mt-6 text-[34px] leading-[1.05] font-semibold tracking-[-0.035em] md:text-[44px]">Raise a return request</h1>
        <p className="mt-3 text-muted">Find the order, pick the item coming back, and confirm who we should contact.</p>
        <Steps steps={steps} />
      </aside>

      <div className="space-y-5 md:col-span-8">
        <Shell>
          <div className="mb-4 flex items-center justify-between">
            <h2 className="text-lg font-semibold">Order</h2>
            {order && (
              <span className="flex items-center gap-1.5 text-sm text-soft">
                <Icon name="check" className="size-4 text-[#075b08]" />
                Found
              </span>
            )}
          </div>
          {state.kind === 'error' && (
            <p role="alert" className="mb-4 flex items-center gap-2 rounded-[14px] bg-danger-soft px-4 py-3 text-danger">
              <Icon name="alert" />
              {state.message}
            </p>
          )}
          <form onSubmit={find} className="flex flex-col gap-3 sm:flex-row sm:items-end">
            <div className="flex-1">
              <label htmlFor="order-number" className="mb-2 block font-medium">Order number</label>
              <input
                id="order-number"
                value={number}
                onChange={(e) => setNumber(e.target.value)}
                placeholder="ORD-1001"
                autoComplete="off"
                required
                className="h-[52px] w-full rounded-input bg-field px-4 shadow-[inset_0_0_0_1px_var(--color-hair)] placeholder:text-soft"
              />
            </div>
            <button
              type="submit"
              disabled={state.kind === 'loading'}
              className="inline-flex h-12 items-center justify-between gap-3 rounded-full bg-ink-blue pr-1.5 pl-5 font-medium text-white transition-transform duration-200 ease-press active:scale-[0.98] disabled:opacity-45"
            >
              {state.kind === 'loading' ? 'Finding…' : 'Find order'}
              <span className="flex size-9 items-center justify-center rounded-full bg-white/10">
                <Icon name="search" />
              </span>
            </button>
          </form>
          {order && (
            <div className="mt-4 flex items-center gap-3 rounded-inset bg-field p-4">
              <Avatar name={order.customer.name} email={order.customer.email} />
              <div className="min-w-0">
                <p className="font-medium">{order.customer.name}</p>
                <p className="text-sm text-muted">
                  Ordered {formatDay(order.placedAt)} · {order.lines.length} {order.lines.length === 1 ? 'line' : 'lines'}
                </p>
              </div>
            </div>
          )}
        </Shell>

        {order && (
          <Shell>
            <h2 className="mb-4 text-lg font-semibold">Order Line</h2>
            <ul className="space-y-3">
              {order.lines.map((l) => (
                <li key={l.id} className="flex items-center justify-between gap-4 rounded-inset border border-hair p-4">
                  <div className="min-w-0">
                    <p className="font-medium">{l.productName}</p>
                    <p className="text-sm text-muted">{l.sku} · {l.quantity} bought</p>
                  </div>
                  <div className="shrink-0 text-right">
                    <p className="font-medium">{formatPaise(l.unitPricePaise)}</p>
                    <p className="text-sm text-soft">per unit</p>
                  </div>
                </li>
              ))}
            </ul>
          </Shell>
        )}
      </div>
    </div>
  );
}

function Steps({ steps }: { steps: Step[] }) {
  return (
    <ol className="mt-6 flex gap-4 md:mt-10 md:flex-col md:gap-0">
      {steps.map((s, i) => (
        <li key={s.label} aria-current={s.state === 'current' ? 'step' : undefined} className="flex items-center gap-2 md:items-start md:gap-4 md:pb-8 md:last:pb-0">
          <span
            className={`flex size-8 shrink-0 items-center justify-center rounded-full text-sm font-semibold md:size-10 ${
              s.state === 'done'
                ? 'bg-ink-blue text-brand'
                : s.state === 'current'
                  ? 'bg-brand text-ink shadow-[0_0_0_6px_rgb(255_209_0/0.25)]'
                  : 'border border-hair bg-white text-soft'
            }`}
          >
            {s.state === 'done' ? <Icon name="check" className="size-4" /> : i + 1}
          </span>
          <div>
            <p className="text-sm font-medium md:text-base">{s.label}</p>
            <p className="hidden text-sm text-muted md:block">{s.summary}</p>
          </div>
        </li>
      ))}
    </ol>
  );
}
