'use client';

import { useEffect, useState } from 'react';
import { formatDay } from '@/lib/format';

type Suggestion = { number: string; placedAt: string; customerName: string };

/**
 * The order number field with live suggestions (an ARIA combobox). Typing asks `GET /api/orders?q=`
 * after a short pause; arrows and Enter or a click pick one, Escape closes the list.
 */
export function OrderNumberInput({ value, onChange, onPick, className }: { value: string; onChange: (v: string) => void; onPick: (number: string) => void; className: string }) {
  const [found, setFound] = useState<{ q: string; items: Suggestion[] }>({ q: '', items: [] });
  const suggestions = found.items;
  const [open, setOpen] = useState(false);
  const [active, setActive] = useState(-1);
  const [deleting, setDeleting] = useState(false); // no completion right after Backspace, or it would undo the delete

  useEffect(() => {
    const q = value.trim();
    if (!q) return setFound({ q: '', items: [] });
    // Wait for a pause in typing, and drop the answer to an older query if a newer one is on its way.
    const abort = new AbortController();
    const timer = setTimeout(async () => {
      try {
        const res = await fetch(`/api/orders?q=${encodeURIComponent(q)}`, { signal: abort.signal });
        if (res.ok) setFound({ q, items: (await res.json()).data });
      } catch {} // Suggestions are a convenience: Find order still works without them.
    }, 200);
    return () => {
      clearTimeout(timer);
      abort.abort();
    };
  }, [value]);

  const shown = open && suggestions.length > 0;
  // Inline typeahead: the rest of the first suggestion, shown as grey text after what was typed.
  const ghost = open && !deleting && active < 0 && found.q === value.trim() && value === value.trimStart() ? completion(value, suggestions[0]?.number) : '';

  function accept() {
    onChange(value + ghost);
    setActive(-1);
  }

  function choose(s: Suggestion) {
    onChange(s.number);
    setOpen(false);
    onPick(s.number);
  }

  function onKeyDown(e: React.KeyboardEvent) {
    if (e.key === 'Escape') return setOpen(false);
    const atEnd = (e.target as HTMLInputElement).selectionStart === value.length;
    if (ghost && ((e.key === 'Tab' && !e.shiftKey) || (e.key === 'ArrowRight' && atEnd))) {
      e.preventDefault();
      return accept();
    }
    if (ghost && e.key === 'Enter') {
      e.preventDefault(); // look up the completed number, like an address bar
      return choose(suggestions[0]);
    }
    if (!shown) return;
    if (e.key === 'Enter' && active < 0) return setOpen(false); // Find order runs on what was typed
    if (e.key === 'ArrowDown' || e.key === 'ArrowUp') {
      e.preventDefault();
      const step = e.key === 'ArrowDown' ? 1 : -1;
      setActive((i) => (i + step + suggestions.length) % suggestions.length);
    } else if (e.key === 'Enter' && active >= 0) {
      e.preventDefault(); // pick the highlighted order rather than submit what was typed
      choose(suggestions[active]);
    }
  }

  return (
    <div className="relative">
      {ghost && (
        // Mirrors the input's text (invisible) so the grey completion lines up right after the caret.
        <div aria-hidden className="pointer-events-none absolute inset-x-0 top-0 z-[1] flex h-[52px] items-center overflow-hidden px-4 whitespace-pre">
          <span className="invisible">{value}</span>
          <span className="text-soft">{ghost}</span>
        </div>
      )}
      <input
        id="order-number"
        role="combobox"
        aria-expanded={shown}
        aria-controls="order-suggestions"
        aria-autocomplete="both"
        aria-activedescendant={shown && active >= 0 ? `order-suggestion-${active}` : undefined}
        value={value}
        onChange={(e) => {
          setDeleting((e.nativeEvent as InputEvent).inputType?.startsWith('delete') ?? false);
          onChange(e.target.value);
          setOpen(true);
          setActive(-1);
        }}
        onKeyDown={onKeyDown}
        onFocus={() => setOpen(true)}
        onBlur={() => setOpen(false)}
        placeholder="ORD-1001, or just 1001"
        autoComplete="off"
        required
        className={className}
      />
      {shown && (
        <ul id="order-suggestions" role="listbox" className="absolute inset-x-0 top-full z-10 mt-2 overflow-hidden rounded-input border border-hair bg-white py-1.5 shadow-card">
          {suggestions.map((s, i) => (
            <li
              key={s.number}
              id={`order-suggestion-${i}`}
              role="option"
              aria-selected={i === active}
              // mousedown, not click: it lands before the input's blur closes the list
              onMouseDown={(e) => {
                e.preventDefault();
                choose(s);
              }}
              onMouseEnter={() => setActive(i)}
              className={`flex min-h-11 cursor-pointer items-center justify-between gap-3 px-4 py-2 ${i === active ? 'bg-field' : ''}`}
            >
              <span className="shrink-0 font-medium whitespace-nowrap">{s.number}</span>
              <span className="min-w-0 truncate text-sm text-muted">{s.customerName} · {formatDay(s.placedAt)}</span>
            </li>
          ))}
        </ul>
      )}
    </div>
  );
}

/**
 * The part of `number` still to type after `typed`, or '' when it doesn't continue it.
 * Digits alone continue the digits (`100` → `1` for ORD-1001), so the completion never rewrites what was typed.
 */
export function completion(typed: string, number: string | undefined) {
  if (!typed || !number) return '';
  if (number.toUpperCase().startsWith(typed.toUpperCase())) return number.slice(typed.length);
  const digits = number.replace(/^ORD-/, '');
  return /^\d+$/.test(typed) && digits.startsWith(typed) ? digits.slice(typed.length) : '';
}
