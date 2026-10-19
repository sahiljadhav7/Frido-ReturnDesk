'use client';

import Link from 'next/link';
import { useRouter } from 'next/navigation';
import { useState } from 'react';
import type { getOrderByNumber } from '@/db/reads';
import { REASON_LABELS, REASONS, type Reason } from '@/domain/schemas';
import { formatDay, formatPaise } from '@/lib/format';
import { Avatar } from '../../_ui/avatar';
import { refusalMessage, unreachable } from '../../_ui/api';
import { BackLink } from '../../_ui/back-link';
import { ErrorBanner } from '../../_ui/error-banner';
import { Icon } from '../../_ui/icons';
import { ProductGlyph } from '../../_ui/product-glyph';
import { Shell } from '../../_ui/shell';
import { OrderNumberInput } from './order-number-input';

// placedAt arrives over JSON as a string, not the Date the read function returns.
type Order = Omit<Awaited<ReturnType<typeof getOrderByNumber>>, 'placedAt'> & { placedAt: string };
type Lookup = { kind: 'idle' } | { kind: 'loading' } | { kind: 'found'; order: Order } | { kind: 'error'; message: string };
type Step = { label: string; summary: string; state: 'done' | 'current' | 'todo' };

const inputClass = 'h-[52px] w-full rounded-input bg-field px-4 shadow-[inset_0_0_0_1px_var(--color-hair)] placeholder:text-soft';
const neutralButton = 'inline-flex h-12 items-center justify-center rounded-full border border-hair bg-white px-6 font-medium transition-transform duration-200 ease-press active:scale-[0.98]';

export function RaiseForm() {
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
                <div className="space-y-3">
                  {order.lines.map((l) => (
                    <label
                      key={l.id}
                      className={`flex cursor-pointer items-center gap-3 rounded-inset p-3 sm:gap-4 sm:p-4 ${
                        l.id === lineId ? 'bg-brand-soft shadow-[0_0_0_2px_var(--color-brand),0_10px_24px_-14px_rgba(201,160,0,0.6)]' : 'border border-hair'
                      }`}
                    >
                      <input type="radio" name="line" checked={l.id === lineId} onChange={() => pick(l.id)} required className="size-5 shrink-0 accent-ink" />
                      <ProductGlyph className="hidden sm:flex" />
                      <span className="min-w-0 flex-1">
                        <span className="block font-medium">{l.productName}</span>
                        <span className="block text-sm text-muted">{l.sku} · {l.quantity} bought</span>
                      </span>
                      <span className="shrink-0 text-right">
                        <span className="block font-medium">{formatPaise(l.unitPricePaise)}</span>
                        <span className="block text-sm text-soft">per unit</span>
                      </span>
                    </label>
                  ))}
                </div>
              </fieldset>
            </Shell>

            {line && (
              <Shell>
                <h2 className="mb-4 text-lg font-semibold">Details</h2>
                {error && <ErrorBanner message={error} />}
                <div className="grid gap-4 sm:grid-cols-2">
                  <div>
                    <label htmlFor="quantity" className="mb-2 block font-medium">Quantity</label>
                    <div className="flex h-[52px] items-center rounded-input bg-field p-1 shadow-[inset_0_0_0_1px_var(--color-hair)]">
                      <button type="button" aria-label="One fewer" onClick={() => setQuantity((q) => Math.max(1, q - 1))} disabled={quantity <= 1} className="flex size-11 items-center justify-center rounded-[13px] bg-white disabled:opacity-45">
                        <Icon name="minus" />
                      </button>
                      <input
                        id="quantity"
                        type="number"
                        inputMode="numeric"
                        min={1}
                        max={line.quantity}
                        value={quantity}
                        onChange={(e) => setQuantity(Number(e.target.value))}
                        required
                        className="h-full min-w-0 flex-1 bg-transparent text-center [appearance:textfield] [&::-webkit-inner-spin-button]:appearance-none"
                      />
                      <button type="button" aria-label="One more" onClick={() => setQuantity((q) => Math.min(line.quantity, q + 1))} disabled={quantity >= line.quantity} className="flex size-11 items-center justify-center rounded-[13px] bg-white disabled:opacity-45">
                        <Icon name="plus" />
                      </button>
                    </div>
                    <p className="mt-2 text-sm text-soft">Up to {line.quantity}</p>
                  </div>
                  <div>
                    <label htmlFor="reason" className="mb-2 block font-medium">Reason</label>
                    <div className="relative">
                      <select id="reason" value={reason} onChange={(e) => setReason(e.target.value as Reason)} required className={`${inputClass} appearance-none pr-10`}>
                        <option value="" disabled>Choose a reason</option>
                        {REASONS.map((r) => <option key={r} value={r}>{REASON_LABELS[r]}</option>)}
                      </select>
                      <Icon name="chevron" className="pointer-events-none absolute top-1/2 right-4 size-[18px] -translate-y-1/2" />
                    </div>
                  </div>
                </div>

                <div className="mt-6 mb-4 flex flex-wrap items-baseline justify-between gap-2">
                  <h3 className="font-semibold">Contact Details</h3>
                  <p className="text-sm text-soft">Filled in from the customer</p>
                </div>
                <div className="grid gap-4 sm:grid-cols-2">
                  <div className="sm:col-span-2">
                    <label htmlFor="contact-name" className="mb-2 block font-medium">Name</label>
                    <input id="contact-name" value={contact.name} onChange={(e) => setContact({ ...contact, name: e.target.value })} required maxLength={200} autoComplete="off" className={inputClass} />
                  </div>
                  <div>
                    <label htmlFor="contact-email" className="mb-2 block font-medium">Email</label>
                    <input id="contact-email" type="email" value={contact.email} onChange={(e) => setContact({ ...contact, email: e.target.value })} required maxLength={254} autoComplete="off" className={inputClass} />
                  </div>
                  <div>
                    <label htmlFor="contact-phone" className="mb-2 block font-medium">Phone <span className="font-normal text-soft">(optional)</span></label>
                    <input id="contact-phone" type="tel" value={contact.phone} onChange={(e) => setContact({ ...contact, phone: e.target.value })} maxLength={40} autoComplete="off" className={inputClass} />
                  </div>
                </div>
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
