'use client';

import { useRouter } from 'next/navigation';
import { useEffect, useRef, useState } from 'react';
import { Icon } from '../_ui/icons';
import { withParams } from './url';

/** `q` and `current` are the server's validated query, so an invalid link never leaks back in. */
export function SearchBox({ q, current }: { q: string; current: string }) {
  const router = useRouter();
  const [value, setValue] = useState(q);
  const input = useRef<HTMLInputElement>(null);

  // Follow outside changes (back button, Clear filters), but never overwrite text being typed:
  // a slow response for an earlier search would otherwise wipe the newer keystrokes.
  useEffect(() => {
    if (document.activeElement !== input.current) setValue(q);
  }, [q]);

  useEffect(() => {
    const next = value.trim();
    if (next === q) return;
    // replace, not push: one history entry per search, not per keystroke.
    const timer = setTimeout(() => router.replace(withParams(current, { q: next || undefined })), 300);
    return () => clearTimeout(timer);
  }, [value, q, current, router]);

  return (
    <div className="relative flex-1">
      <label htmlFor="search" className="sr-only">Search</label>
      <Icon name="search" className="pointer-events-none absolute top-1/2 left-4 size-[18px] -translate-y-1/2 text-soft" />
      <input
        ref={input}
        id="search"
        type="search"
        value={value}
        onChange={(e) => setValue(e.target.value)}
        placeholder="Search reference, order, name or email"
        autoComplete="off"
        maxLength={200}
        className="h-[52px] w-full rounded-input bg-field pr-4 pl-11 shadow-[inset_0_0_0_1px_var(--color-hair)] placeholder:text-soft"
      />
    </div>
  );
}
