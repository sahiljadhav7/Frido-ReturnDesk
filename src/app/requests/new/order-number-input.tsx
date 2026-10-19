'use client';

import { formatDay } from '@/lib/format';
import { SuggestInput } from '../../_ui/suggest-input';

type Suggestion = { number: string; placedAt: string; customerName: string };

/** The order number field: suggests orders as the agent types and completes the number inline. */
export function OrderNumberInput({ value, onChange, onPick, className }: { value: string; onChange: (v: string) => void; onPick: (number: string) => void; className: string }) {
  return (
    <SuggestInput<Suggestion>
      id="order-number"
      label="Matching orders"
      value={value}
      onChange={onChange}
      url={(q) => `/api/orders?q=${encodeURIComponent(q)}`}
      keyOf={(s) => s.number}
      // Digits alone continue the digits (`100` → ORD-1001), so typing 1001 works as well as ORD-1001.
      completions={(s) => [s.number, s.number.replace(/^ORD-/, '')]}
      onPick={(s) => {
        onChange(s.number);
        onPick(s.number);
      }}
      renderOption={(s) => (
        <>
          <span className="shrink-0 font-medium whitespace-nowrap">{s.number}</span>
          <span className="min-w-0 truncate text-sm text-muted">{s.customerName} · {formatDay(s.placedAt)}</span>
        </>
      )}
      placeholder="ORD-1001, or just 1001"
      required
      inputClassName={className}
      textInset="px-4"
    />
  );
}
