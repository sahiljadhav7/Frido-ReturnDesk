'use client';

import { useRouter } from 'next/navigation';
import { useEffect, useRef, useState } from 'react';
import type { Status } from '@/domain/lifecycle';
import { Icon } from '../_ui/icons';
import { StatusBadge } from '../_ui/status-badge';
import { SuggestInput } from '../_ui/suggest-input';
import { pendingSearches, withParams } from './url';

type Suggestion = { reference: string; status: Status; contactName: string; orderNumber: string; contactEmail: string };

/** `q` and `current` are the server's validated query, so an invalid link never leaks back in. */
export function SearchBox({ q, current }: { q: string; current: string }) {
  const router = useRouter();
  const [value, setValue] = useState(q);
  const pending = useRef(pendingSearches()).current;
  const leaving = useRef(false); // a suggestion was picked: don't pull the page back to the list

  // Follow outside changes (back button, Clear filters), but not a late landing of our own
  // earlier search, which would otherwise wipe the newer keystrokes.
  useEffect(() => {
    if (pending.follow(q)) setValue(q);
  }, [q, pending]);

  useEffect(() => {
    const next = value.trim();
    if (next === q) return;
    // replace, not push: one history entry per search, not per keystroke.
    const timer = setTimeout(() => {
      if (leaving.current) return;
      pending.send(next);
      router.replace(withParams(current, { q: next || undefined }));
    }, 300);
    return () => clearTimeout(timer);
  }, [value, q, current, router, pending]);

  return (
    <div className="relative flex-1">
      <label htmlFor="search" className="sr-only">Search</label>
      <SuggestInput<Suggestion>
        id="search"
        label="Matching return requests"
        type="search"
        value={value}
        onChange={(v) => {
          leaving.current = false;
          setValue(v);
        }}
        url={(q) => `/api/return-requests?${new URLSearchParams({ q, pageSize: '8' })}`}
        keyOf={(r) => r.reference}
        // `25` continues to RD-000025's number, and digits alone continue an order number, as when raising.
        completions={(r) => [r.reference, String(Number(r.reference.slice(3))), r.orderNumber, r.orderNumber.replace(/^ORD-/, ''), r.contactName, r.contactEmail]}
        onPick={(r) => {
          leaving.current = true;
          router.push(`/requests/${r.reference}`);
        }}
        renderOption={(r) => (
          <>
            <span className="min-w-0">
              <span className="block font-medium whitespace-nowrap">{r.reference}</span>
              <span className="block truncate text-sm text-muted">{r.contactName} · {r.orderNumber}</span>
            </span>
            <StatusBadge status={r.status} small />
          </>
        )}
        placeholder="Search reference, order, name or email"
        maxLength={200}
        inputClassName="h-[52px] w-full rounded-input bg-field pr-4 pl-11 shadow-[inset_0_0_0_1px_var(--color-hair)] placeholder:text-soft"
        textInset="pr-4 pl-11"
      >
        <Icon name="search" className="pointer-events-none absolute top-1/2 left-4 z-[1] size-[18px] -translate-y-1/2 text-soft" />
      </SuggestInput>
    </div>
  );
}
