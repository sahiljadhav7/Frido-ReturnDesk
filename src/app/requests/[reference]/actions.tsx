'use client';

import { useRouter } from 'next/navigation';
import { useState, useTransition } from 'react';
import { REMOVABLE_STATUSES, TRANSITIONS, type Status } from '@/domain/lifecycle';
import { RESOLUTION_LABELS, RESOLUTIONS, type Resolution } from '@/domain/schemas';
import { formatPaise } from '@/lib/format';
import { send } from '../../_ui/api';
import { listHref } from '../../_ui/back-link';
import { ErrorBanner } from '../../_ui/error-banner';
import { Icon } from '../../_ui/icons';

// Heading and hint for each Status that still has moves; Closed ones have none.
const PROMPTS: Partial<Record<Status, [string, string]>> = {
  open: ['Start the review', 'Move it to In Review when you start looking into it.'],
  in_review: ['Approve this request', 'Choose what the customer gets, or reject it.'],
  approved: ['Complete this request', 'Mark it completed once the customer has what they were promised.'],
};
// How each target Status shows as a button. Final moves ask once before they're sent.
const MOVES: Partial<Record<Status, { label: string; primary: boolean; final: boolean }>> = {
  in_review: { label: 'Start review', primary: true, final: false },
  approved: { label: 'Approve', primary: true, final: false },
  rejected: { label: 'Reject', primary: false, final: true },
  completed: { label: 'Mark completed', primary: true, final: true },
};
const RESOLUTION_ICONS = { refund: 'cash', replacement: 'swap', store_credit: 'card' } as const;

const base = 'inline-flex h-12 items-center rounded-full font-medium transition-transform duration-200 ease-press active:scale-[0.98] disabled:opacity-45';
const primary = `${base} justify-between gap-3 bg-brand pr-1.5 pl-5 text-ink shadow-glow`;
const neutral = `${base} justify-center border border-white/10 bg-white/8 px-6 text-white`;
const destructive = `${base} justify-center border border-white/10 px-6 text-danger-on-dark`;

/** The dark actions panel: only the moves the transition table allows from this Status, then Remove. The server re-checks every one. */
export function Actions({ reference, status, maxRefundPaise, lastActivityAt }: { reference: string; status: Status; maxRefundPaise: number; lastActivityAt: string }) {
  const router = useRouter();
  const [refreshing, startTransition] = useTransition();
  const [sending, setSending] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [open, setOpen] = useState<Status | null>(null); // the approve form or a final move's confirm
  const [resolution, setResolution] = useState<Resolution | null>(null);
  const [amount, setAmount] = useState('');
  const [reason, setReason] = useState('');
  const [removing, setRemoving] = useState(false); // Remove's confirm
  const pending = sending || refreshing;
  const prompt = PROMPTS[status];
  const removable = (REMOVABLE_STATUSES as readonly Status[]).includes(status);

  async function move(to: Status, extra?: object) {
    setSending(true);
    setError(null);
    const message = await send('POST', `/api/return-requests/${reference}/status-changes`, { to, ...extra });
    setSending(false);
    if (message) return setError(message);
    // The page remounts this panel (keyed by Status) once the new render lands.
    startTransition(() => router.refresh());
  }

  async function remove() {
    setSending(true);
    setError(null);
    // Sends the version this page loaded, so a correction or move landing first is a 409, not removed unseen.
    const message = await send('DELETE', `/api/return-requests/${reference}?expectedLastActivityAt=${encodeURIComponent(lastActivityAt)}`);
    if (message) {
      setSending(false);
      return setError(message);
    }
    router.push(listHref());
  }

  function approve(e: React.FormEvent) {
    e.preventDefault();
    const rupees = Number(amount.replace(/,/g, '')); // agents type 1,499
    // Blank or unreadable is left out, so the server answers "Enter a Refund Amount" rather than "must be more than ₹0".
    const refundAmountPaise = resolution === 'refund' && amount.trim() && Number.isFinite(rupees) ? Math.round(rupees * 100) : undefined;
    move('approved', { resolution: resolution ?? undefined, refundAmountPaise });
  }

  return (
    <section className="rounded-shell bg-ink-blue p-1.5">
      <div className="rounded-card bg-linear-to-b from-[#18222c] to-[#121a22] p-5 text-white shadow-card sm:p-6">
        <h2 className="text-lg font-semibold">{open === 'rejected' ? 'Reject this request' : (prompt?.[0] ?? 'This request is closed.')}</h2>
        <p className="mt-1 text-white/65">{prompt?.[1] ?? 'It will not change status again.'}</p>
        {error && <div className="mt-5"><ErrorBanner message={error} /></div>}
        {prompt && (
          <div className="mt-5">
            {open === 'approved' ? (
              <form onSubmit={approve}>
                <fieldset>
                  <legend className="sr-only">Resolution</legend>
                  <div className="grid grid-cols-3 gap-1 rounded-[20px] border border-white/10 bg-white/5 p-1">
                    {RESOLUTIONS.map((r) => (
                      <label
                        key={r}
                        className={`flex min-h-16 cursor-pointer flex-col items-center justify-center gap-1 rounded-2xl px-1 py-2 text-center text-sm has-focus-visible:outline-2 has-focus-visible:outline-brand ${
                          resolution === r ? 'bg-white text-ink' : 'text-white/75'
                        }`}
                      >
                        <input type="radio" name="resolution" value={r} checked={resolution === r} onChange={() => setResolution(r)} className="sr-only" />
                        <Icon name={RESOLUTION_ICONS[r]} />
                        {RESOLUTION_LABELS[r]}
                      </label>
                    ))}
                  </div>
                </fieldset>
                {resolution === 'refund' && (
                  <div className="mt-5">
                    <label htmlFor="refund-amount" className="mb-2 block font-medium">Refund Amount</label>
                    {/* The input is the whole box, ₹ sits in its padding, so the one global focus ring wraps the full field. */}
                    <div className="relative">
                      <span className="pointer-events-none absolute top-1/2 left-4 -translate-y-1/2 text-xl text-white/65" aria-hidden>₹</span>
                      <input
                        id="refund-amount"
                        inputMode="decimal"
                        value={amount}
                        onChange={(e) => setAmount(e.target.value)}
                        autoComplete="off"
                        className="h-16 w-full rounded-input bg-white/5 pr-4 pl-10 text-2xl font-semibold shadow-[inset_0_0_0_1px_rgb(255_255_255/0.15)]"
                      />
                    </div>
                    <p className="mt-2 text-sm text-white/65">Up to {formatPaise(maxRefundPaise)}</p>
                  </div>
                )}
                <div className="mt-5 flex flex-col gap-3 sm:flex-row">
                  <button type="submit" disabled={pending} className={`${primary} flex-1`}>
                    {pending ? 'Approving…' : 'Confirm approval'}
                    <span className="flex size-9 items-center justify-center rounded-full bg-[#e6bc00]/40">
                      <Icon name="check" />
                    </span>
                  </button>
                  <button type="button" disabled={pending} onClick={() => setOpen(null)} className={neutral}>Cancel</button>
                </div>
              </form>
            ) : open ? (
              <div>
                {open === 'rejected' && (
                  <div className="mb-4">
                    <label htmlFor="reject-reason" className="mb-2 block font-medium">Reason for rejecting <span className="font-normal text-white/60">(optional)</span></label>
                    <textarea
                      id="reject-reason"
                      value={reason}
                      onChange={(e) => setReason(e.target.value)}
                      rows={3}
                      maxLength={500}
                      placeholder="Shown in the timeline"
                      className="w-full resize-y rounded-input bg-white/5 px-4 py-3 shadow-[inset_0_0_0_1px_rgb(255_255_255/0.15)] placeholder:text-white/50"
                    />
                  </div>
                )}
                <p className="mb-3">This can&apos;t be undone.</p>
                <div className="flex gap-3">
                  <button type="button" disabled={pending} onClick={() => move(open, open === 'rejected' ? { reason } : undefined)} className={`${MOVES[open]?.primary ? primary : neutral} flex-1`}>
                    {pending ? 'Saving…' : 'Confirm'}
                    {MOVES[open]?.primary && (
                      <span className="flex size-9 items-center justify-center rounded-full bg-[#e6bc00]/40">
                        <Icon name="check" />
                      </span>
                    )}
                  </button>
                  <button type="button" disabled={pending} onClick={() => setOpen(null)} className={neutral}>Cancel</button>
                </div>
              </div>
            ) : (
              <div className="flex flex-col gap-3">
                {TRANSITIONS[status].map((to) => {
                  const m = MOVES[to]!;
                  const direct = !m.final && to !== 'approved';
                  return (
                    <button key={to} type="button" disabled={pending} onClick={() => (direct ? move(to) : setOpen(to))} className={m.primary ? primary : neutral}>
                      {pending && direct ? 'Saving…' : m.label}
                      {m.primary && (
                        <span className="flex size-9 items-center justify-center rounded-full bg-[#e6bc00]/40">
                          <Icon name={to === 'approved' ? 'check' : 'arrow'} />
                        </span>
                      )}
                    </button>
                  );
                })}
              </div>
            )}
          </div>
        )}
        {removable && (
          <div className="mt-5 border-t border-white/10 pt-5">
            {removing ? (
              <div>
                <p className="mb-3">This can&apos;t be undone. It leaves the list, and its Order Line is free for a new request.</p>
                <div className="flex gap-3">
                  <button type="button" disabled={pending} onClick={remove} className={`${destructive} flex-1`}>{pending ? 'Removing…' : 'Confirm'}</button>
                  <button type="button" disabled={pending} onClick={() => setRemoving(false)} className={neutral}>Cancel</button>
                </div>
              </div>
            ) : (
              <button type="button" disabled={pending} onClick={() => setRemoving(true)} className={`${destructive} w-full`}>Remove request</button>
            )}
          </div>
        )}
      </div>
    </section>
  );
}
