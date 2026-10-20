'use client';

import { useRouter } from 'next/navigation';
import { useEffect, useRef, useState, useTransition } from 'react';
import type { Reason } from '@/domain/schemas';
import { send } from '../../_ui/api';
import { ErrorBanner } from '../../_ui/error-banner';
import { Icon } from '../../_ui/icons';
import { ContactFields, LineChoice, QuantityAndReason, type Contact } from '../../_ui/request-fields';
import { Shell } from '../../_ui/shell';

type Line = { id: number; productName: string; sku: string; quantity: number; unitPricePaise: number };
// expectedLastActivityAt is the version the form was opened from; the server refuses the save (409) if it has moved.
type Values = { orderLineId: number; quantity: number; reason: Reason; contact: Contact; expectedLastActivityAt: string };

/** The editable details, without the version: a Note or a Status Change moves the version but not these. */
const details = ({ expectedLastActivityAt: _, ...rest }: Values) => JSON.stringify(rest);

const neutral = 'inline-flex h-12 items-center justify-center gap-2 rounded-full border border-hair bg-white px-6 font-medium transition-transform duration-200 ease-press active:scale-[0.98] disabled:opacity-45';

/**
 * The details card. With `edit` (only while not Decided) it shows Edit, which swaps the card for a correction form:
 * the raise fields, with Order Lines limited to this Order. The server re-checks every rule.
 */
export function DetailsCard({ reference, edit, children }: { reference: string; edit?: { lines: Line[]; values: Values }; children: React.ReactNode }) {
  const router = useRouter();
  const [refreshing, startTransition] = useTransition();
  const [sending, setSending] = useState(false);
  const [error, setError] = useState<string | null>(null);
  // Filled from the current values each time Edit opens, so a reopened form never shows what was there before a save.
  const [form, setForm] = useState<Values | null>(null);
  // The details as they were when Edit opened, to tell a stale save from one that only follows a Note.
  const [opened, setOpened] = useState('');
  const pending = sending || refreshing;
  const line = form && edit?.lines.find((l) => l.id === form.orderLineId);
  const editing = Boolean(form && edit);
  // Nothing changed: saving would only bump last activity and lift the request up "recently active".
  const unchanged = form && edit ? details(form) === details(edit.values) : true;

  // Opening and closing removes the focused button, so move focus into the form and back to Edit.
  const formRef = useRef<HTMLFormElement>(null);
  const editRef = useRef<HTMLButtonElement>(null);
  const wasEditing = useRef(false);
  useEffect(() => {
    if (editing) formRef.current?.querySelector<HTMLInputElement>('input:checked')?.focus();
    else if (wasEditing.current) editRef.current?.focus();
    wasEditing.current = editing;
  }, [editing]);

  async function save(e: React.FormEvent) {
    e.preventDefault();
    if (!form) return;
    setSending(true);
    setError(null);
    const { contact, ...rest } = form;
    // Send the current version if nobody changed these details since Edit opened, so an agent's own Note doesn't make their save a 409.
    const expectedLastActivityAt = edit && details(edit.values) === opened ? edit.values.expectedLastActivityAt : form.expectedLastActivityAt;
    const message = await send('PATCH', `/api/return-requests/${reference}`, { ...rest, expectedLastActivityAt, contactName: contact.name, contactEmail: contact.email, contactPhone: contact.phone });
    setSending(false);
    if (message) return setError(message);
    // Closing inside the transition keeps the form up until the corrected details have rendered.
    startTransition(() => {
      router.refresh();
      setForm(null);
    });
  }

  return (
    <Shell>
      <div className="mb-4 flex items-center justify-between gap-3">
        <h2 className="text-lg font-semibold">{editing ? 'Correct details' : 'Details'}</h2>
        {edit && !form && (
          <button ref={editRef} type="button" onClick={() => { setError(null); setForm(edit.values); setOpened(details(edit.values)); }} className={`${neutral} h-10 px-4`}>
            <Icon name="pencil" />
            Edit
          </button>
        )}
      </div>
      {form && edit ? (
        <form ref={formRef} onSubmit={save}>
          {error && <ErrorBanner message={error} />}
          <fieldset>
            <legend className="mb-3 font-semibold">Order Line</legend>
            {/* Moving to a line with fewer units clamps the quantity, so the stepper never starts over its cap. */}
            <LineChoice lines={edit.lines} value={form.orderLineId} onChange={(id) => setForm({ ...form, orderLineId: id, quantity: Math.min(form.quantity, edit.lines.find((l) => l.id === id)!.quantity) })} />
          </fieldset>
          <div className="mt-6">
            <QuantityAndReason quantity={form.quantity} max={line?.quantity ?? 1} onQuantity={(quantity) => setForm({ ...form, quantity })} reason={form.reason} onReason={(reason) => setForm({ ...form, reason })} />
          </div>
          <h3 className="mt-6 mb-4 font-semibold">Contact Details</h3>
          <ContactFields contact={form.contact} onChange={(contact) => setForm({ ...form, contact })} />
          <div className="mt-6 flex flex-col-reverse gap-3 sm:flex-row sm:justify-end">
            <button type="button" disabled={pending} onClick={() => setForm(null)} className={neutral}>Cancel</button>
            <button
              type="submit"
              disabled={pending || unchanged}
              className="inline-flex h-12 items-center justify-between gap-3 rounded-full bg-brand pr-1.5 pl-5 font-medium text-ink shadow-glow transition-transform duration-200 ease-press active:scale-[0.98] disabled:opacity-45"
            >
              {pending ? 'Saving…' : 'Save'}
              <span className="flex size-9 items-center justify-center rounded-full bg-[#e6bc00]/40">
                <Icon name="check" />
              </span>
            </button>
          </div>
        </form>
      ) : (
        children
      )}
    </Shell>
  );
}
