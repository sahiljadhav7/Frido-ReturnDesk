import { REASON_LABELS, REASONS, type Reason } from '@/domain/schemas';
import { formatPaise } from '@/lib/format';
import { Icon } from './icons';
import { ProductGlyph } from './product-glyph';

// The fields raising and correcting share (ui.md "Raise page" and "Edit").
export const inputClass = 'h-[52px] w-full rounded-input bg-field px-4 shadow-[inset_0_0_0_1px_var(--color-hair)] placeholder:text-soft';

type Line = { id: number; productName: string; sku: string; quantity: number; unitPricePaise: number };
export type Contact = { name: string; email: string; phone: string };

/** The Order Line radio cards. The chosen one gets the brand fill and outline. */
export function LineChoice({ lines, value, onChange }: { lines: Line[]; value: number | null; onChange: (id: number) => void }) {
  return (
    <div className="space-y-3">
      {lines.map((l) => (
        <label
          key={l.id}
          className={`flex cursor-pointer items-center gap-3 rounded-inset p-3 sm:gap-4 sm:p-4 ${
            l.id === value ? 'bg-brand-soft shadow-[0_0_0_2px_var(--color-brand),0_10px_24px_-14px_rgba(201,160,0,0.6)]' : 'border border-hair'
          }`}
        >
          <input type="radio" name="line" checked={l.id === value} onChange={() => onChange(l.id)} required className="size-5 shrink-0 accent-ink" />
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
  );
}

/** Quantity as a − / value / + stepper with "Up to N", and the Reason select, side by side from sm up. */
export function QuantityAndReason({ quantity, max, onQuantity, reason, onReason }: {
  quantity: number; max: number; onQuantity: (q: number) => void; reason: Reason | ''; onReason: (r: Reason) => void;
}) {
  return (
    <div className="grid gap-4 sm:grid-cols-2">
      <div>
        <label htmlFor="quantity" className="mb-2 block font-medium">Quantity</label>
        <div className="flex h-[52px] items-center rounded-input bg-field p-1 shadow-[inset_0_0_0_1px_var(--color-hair)]">
          <button type="button" aria-label="One fewer" onClick={() => onQuantity(Math.max(1, quantity - 1))} disabled={quantity <= 1} className="flex size-11 items-center justify-center rounded-[13px] bg-white disabled:opacity-45">
            <Icon name="minus" />
          </button>
          <input
            id="quantity"
            type="number"
            inputMode="numeric"
            min={1}
            max={max}
            value={quantity}
            onChange={(e) => onQuantity(Number(e.target.value))}
            required
            className="h-full min-w-0 flex-1 bg-transparent text-center [appearance:textfield] [&::-webkit-inner-spin-button]:appearance-none"
          />
          <button type="button" aria-label="One more" onClick={() => onQuantity(Math.min(max, quantity + 1))} disabled={quantity >= max} className="flex size-11 items-center justify-center rounded-[13px] bg-white disabled:opacity-45">
            <Icon name="plus" />
          </button>
        </div>
        <p className="mt-2 text-sm text-soft">Up to {max}</p>
      </div>
      <div>
        <label htmlFor="reason" className="mb-2 block font-medium">Reason</label>
        <div className="relative">
          <select id="reason" value={reason} onChange={(e) => onReason(e.target.value as Reason)} required className={`select-shell ${inputClass} appearance-none pr-10`}>
            <option value="" disabled>Choose a reason</option>
            {REASONS.map((r) => <option key={r} value={r}>{REASON_LABELS[r]}</option>)}
          </select>
          <Icon name="chevron" className="pointer-events-none absolute top-1/2 right-4 size-[18px] -translate-y-1/2" />
        </div>
      </div>
    </div>
  );
}

/** Contact Details: name, email, and an optional phone. */
export function ContactFields({ contact, onChange }: { contact: Contact; onChange: (c: Contact) => void }) {
  return (
    <div className="grid gap-4 sm:grid-cols-2">
      <div className="sm:col-span-2">
        <label htmlFor="contact-name" className="mb-2 block font-medium">Name</label>
        <input id="contact-name" value={contact.name} onChange={(e) => onChange({ ...contact, name: e.target.value })} required maxLength={200} autoComplete="off" className={inputClass} />
      </div>
      <div>
        <label htmlFor="contact-email" className="mb-2 block font-medium">Email</label>
        <input id="contact-email" type="email" value={contact.email} onChange={(e) => onChange({ ...contact, email: e.target.value })} required maxLength={254} autoComplete="off" className={inputClass} />
      </div>
      <div>
        <label htmlFor="contact-phone" className="mb-2 block font-medium">Phone <span className="font-normal text-soft">(optional)</span></label>
        <input id="contact-phone" type="tel" value={contact.phone} onChange={(e) => onChange({ ...contact, phone: e.target.value })} maxLength={40} autoComplete="off" className={inputClass} />
      </div>
    </div>
  );
}
