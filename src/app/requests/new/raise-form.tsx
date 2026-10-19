'use client';

import Link from 'next/link';
import { useRouter } from 'next/navigation';
import { useState } from 'react';
import type { getOrderByNumber } from '@/db/reads';
import type { Reason } from '@/domain/schemas';
import { formatDay } from '@/lib/format';
import { Avatar } from '../../_ui/avatar';
import { refusalMessage, unreachable } from '../../_ui/api';
import { BackLink } from '../../_ui/back-link';
import { ErrorBanner } from '../../_ui/error-banner';
import { Icon } from '../../_ui/icons';
import { ContactFields, inputClass, LineChoice, QuantityAndReason } from '../../_ui/request-fields';
import { Shell } from '../../_ui/shell';
import { OrderNumberInput } from './order-number-input';

// placedAt arrives over JSON as a string, not the Date the read function returns.
type Order = Omit<Awaited<ReturnType<typeof getOrderByNumber>>, 'placedAt'> & { placedAt: string };
type Lookup = { kind: 'idle' } | { kind: 'loading' } | { kind: 'found'; order: Order } | { kind: 'error'; message: string };
type Step = { label: string; summary: string; state: 'done' | 'current' | 'todo' };

const neutralButton = 'inline-flex h-12 items-center justify-center rounded-full border border-hair bg-white px-6 font-medium transition-transform duration-200 ease-press active:scale-[0.98]';

export function RaiseForm({ orderRange }: { orderRange: { low: string; high: string } | null }) {
  const router = useRouter();
  const [number, setNumber] = useState('');
  const [lookup, setLookup] = useState<Lookup>({ kind: 'idle' });
  const [lineId, setLineId] = useState<number | null>(null);
  const [quantity, setQuantity] = useState(1);
  const [reason, setReason] = useState<Reason | ''>('');
  const [contact, setContact] = useState({ name: '', email: '', phone: '' });
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const order = lookup.kind === 'found' ? lookup.order : null;
  const line = order?.lines.find((l) => l.id === lineId) ?? null;

  function find(e: React.FormEvent) {
    e.preventDefault();
    lookUp(number);
  }

  async function lookUp(typed: string) {
    setLookup({ kind: 'loading' });
    setLineId(null);
    try {
      const res = await fetch(`/api/orders/${encodeURIComponent(typed)}`);
      if (!res.ok) return setLookup({ kind: 'error', message: await refusalMessage(res) });
      const found: Order = (await res.json()).data;
      setLookup({ kind: 'found', order: found });
      setContact({ name: found.customer.name, email: found.customer.email, phone: found.customer.phone ?? '' });
    } catch {
      setLookup({ kind: 'error', message: unreachable });
    }
  }

  function pick(id: number) {
    setLineId(id);
    setQuantity(1);
  }

  async function submit(e: React.FormEvent) {
    e.preventDefault();
    if (!line) return;
    setSubmitting(true);
    setError(null);
    try {
      const res = await fetch('/api/return-requests', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ orderLineId: line.id, quantity, reason, contactName: contact.name, contactEmail: contact.email, contactPhone: contact.phone }),
      });
      if (!res.ok) {
        setError(await refusalMessage(res));
        return setSubmitting(false);
      }
      // Stay pending through the navigation so the button can't raise twice.
      router.push(`/requests/${(await res.json()).data.reference}`);
    } catch {
      setError(unreachable);
      setSubmitting(false);
    }
  }

  const steps: Step[] = [
    { label: 'Order', summary: order ? `${order.number} · ${order.customer.name}` : 'Find it by number', state: order ? 'done' : 'current' },
    { label: 'Order Line', summary: line ? line.productName : 'The item coming back', state: line ? 'done' : order ? 'current' : 'todo' },
    { label: 'Details', summary: 'Quantity, reason, contact', state: line ? 'current' : 'todo' },
  ];

  return (
    <div className="grid gap-6 md:grid-cols-12 md:gap-8">
      <aside className="md:sticky md:top-8 md:col-span-4 md:self-start">
        <BackLink />
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
          {lookup.kind === 'error' && <ErrorBanner message={lookup.message} />}
          <form onSubmit={find} className="flex flex-col gap-3 sm:flex-row sm:items-end">
            <div className="flex-1">
              <label htmlFor="order-number" className="mb-2 block font-medium">Order number</label>
              <OrderNumberInput value={number} onChange={setNumber} onPick={lookUp} className={inputClass} />
            </div>
            <button
              type="submit"
              disabled={lookup.kind === 'loading'}
              className="inline-flex h-12 items-center justify-between gap-3 rounded-full bg-ink-blue pr-1.5 pl-5 font-medium text-white transition-transform duration-200 ease-press active:scale-[0.98] disabled:opacity-45"
            >
              {lookup.kind === 'loading' ? 'Finding…' : 'Find order'}
              <span className="flex size-9 items-center justify-center rounded-full bg-white/10">
                <Icon name="search" />
              </span>
            </button>
          </form>
          {orderRange && !order && (
            <p className="mt-2 text-sm text-soft">
              Orders run from {orderRange.low} to {orderRange.high}.
            </p>
          )}
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
          <form onSubmit={submit} className="space-y-5">
            <Shell>
              <fieldset>
                <legend className="mb-4 text-lg font-semibold">Order Line</legend>
                <LineChoice lines={order.lines} value={lineId} onChange={pick} />
              </fieldset>
            </Shell>

            {line && (
              <Shell>
                <h2 className="mb-4 text-lg font-semibold">Details</h2>
                {error && <ErrorBanner message={error} />}
                <QuantityAndReason quantity={quantity} max={line.quantity} onQuantity={setQuantity} reason={reason} onReason={setReason} />

                <div className="mt-6 mb-4 flex flex-wrap items-baseline justify-between gap-2">
                  <h3 className="font-semibold">Contact Details</h3>
                  <p className="text-sm text-soft">Filled in from the customer</p>
                </div>
                <ContactFields contact={contact} onChange={setContact} />
              </Shell>
            )}

            {line && (
              <div className="flex flex-col-reverse gap-3 sm:flex-row sm:justify-end">
                <Link href="/" className={neutralButton}>Cancel</Link>
                <button
                  type="submit"
                  disabled={submitting}
                  className="inline-flex h-12 items-center justify-between gap-3 rounded-full bg-brand pr-1.5 pl-5 font-medium text-ink shadow-glow transition-transform duration-200 ease-press active:scale-[0.98] disabled:opacity-45"
                >
                  {submitting ? 'Raising…' : 'Raise request'}
                  <span className="flex size-9 items-center justify-center rounded-full bg-[#e6bc00]/40">
                    <Icon name="arrow" />
                  </span>
                </button>
              </div>
            )}
          </form>
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
