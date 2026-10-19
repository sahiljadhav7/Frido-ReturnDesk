'use client';

import { useRouter } from 'next/navigation';
import { useEffect, useRef, useState } from 'react';
import { REASON_LABELS, REASONS, type Reason } from '@/domain/schemas';
import { Icon } from '../_ui/icons';
import { withParams } from './url';

export function ReasonFilter({ chosen, current }: { chosen: Reason[]; current: string }) {
  const router = useRouter();
  // Local copy, so a second tick before the first navigation lands builds on the first.
  const [picked, setPicked] = useState(chosen);
  const menu = useRef<HTMLDetailsElement>(null);
  const key = chosen.join(',');

  useEffect(() => setPicked(key ? (key.split(',') as Reason[]) : []), [key]);

  useEffect(() => {
    const close = (e: MouseEvent | KeyboardEvent) => {
      if (!menu.current?.open) return;
      if (e instanceof KeyboardEvent ? e.key === 'Escape' : !menu.current.contains(e.target as Node)) menu.current.open = false;
    };
    document.addEventListener('click', close);
    document.addEventListener('keydown', close);
    return () => {
      document.removeEventListener('click', close);
      document.removeEventListener('keydown', close);
    };
  }, []);

  function toggle(r: Reason) {
    const next = picked.includes(r) ? picked.filter((c) => c !== r) : [...picked, r];
    setPicked(next);
    router.push(withParams(current, { reason: next.join(',') || undefined }));
  }

  const summary = picked.length === 0 ? 'Any' : picked.length === 1 ? REASON_LABELS[picked[0]] : `${picked.length} chosen`;
  return (
    <details ref={menu} className="group relative">
      <summary className="flex h-[52px] cursor-pointer list-none items-center justify-between gap-3 rounded-input border border-hair bg-white px-4 md:min-w-52 [&::-webkit-details-marker]:hidden">
        <span>Reason <span className="ml-2 text-soft">{summary}</span></span>
        <Icon name="chevron" className="size-[18px] transition-transform group-open:rotate-180" />
      </summary>
      <fieldset className="absolute right-0 z-10 mt-2 w-full min-w-56 rounded-card border border-hair bg-white p-2 shadow-card">
        <legend className="sr-only">Reason</legend>
        {REASONS.map((r) => (
          <label key={r} className="flex min-h-11 cursor-pointer items-center gap-3 rounded-[12px] px-3 hover:bg-field">
            <input type="checkbox" checked={picked.includes(r)} onChange={() => toggle(r)} className="size-4 accent-ink" />
            {REASON_LABELS[r]}
          </label>
        ))}
      </fieldset>
    </details>
  );
}
