'use client';

import { useEffect, useState } from 'react';

type Props<T> = {
  id: string;
  label: string; // the listbox's accessible name
  value: string;
  onChange: (value: string) => void;
  /** Where to ask for suggestions; the response is `{ data: T[] }`. */
  url: (q: string) => string;
  keyOf: (item: T) => string;
  /** Texts the typed value may continue, for the inline completion (only the first suggestion's are used). */
  completions: (item: T) => string[];
  onPick: (item: T) => void;
  renderOption: (item: T) => React.ReactNode;
  inputClassName: string;
  /** The input's horizontal text padding, so the grey completion lines up after the caret. */
  textInset: string;
  children?: React.ReactNode; // e.g. a leading icon
} & Pick<React.InputHTMLAttributes<HTMLInputElement>, 'type' | 'placeholder' | 'required' | 'maxLength'>;

/**
 * A text field with live suggestions and inline typeahead (an ARIA combobox).
 * Typing asks `url(q)` after a 200 ms pause, aborting the previous request. Arrows and Enter or a click pick a
 * suggestion; Escape closes the list. The rest of the first suggestion shows in grey: Tab or → accepts it, and
 * Enter picks that suggestion.
 */
export function SuggestInput<T>({ id, label, value, onChange, url, keyOf, completions, onPick, renderOption, inputClassName, textInset, children, ...input }: Props<T>) {
  const [found, setFound] = useState<{ q: string; items: T[] }>({ q: '', items: [] });
  const items = found.items;
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
        const res = await fetch(url(q), { signal: abort.signal });
        if (res.ok) setFound({ q, items: (await res.json()).data });
      } catch {} // Suggestions are a convenience: the field works without them.
    }, 200);
    return () => {
      clearTimeout(timer);
      abort.abort();
    };
    // url is a fresh arrow each render; the query is all that matters.
  }, [value]);

  const shown = open && items.length > 0;
  // Never complete from a list that answers an older query.
  const ghost = open && !deleting && active < 0 && found.q === value.trim() && value === value.trimStart() && items[0] ? completion(value, completions(items[0])) : '';

  function choose(item: T) {
    setOpen(false);
    onPick(item);
  }

  function onKeyDown(e: React.KeyboardEvent<HTMLInputElement>) {
    if (e.key === 'Escape') {
      if (!shown) return; // let a search field clear itself
      e.preventDefault();
      return setOpen(false);
    }
    const atEnd = e.currentTarget.selectionStart === value.length;
    if (ghost && ((e.key === 'Tab' && !e.shiftKey) || (e.key === 'ArrowRight' && atEnd))) {
      e.preventDefault();
      onChange(value + ghost);
      return;
    }
    if (!shown) return;
    if (e.key === 'ArrowDown' || e.key === 'ArrowUp') {
      e.preventDefault();
      const step = e.key === 'ArrowDown' ? 1 : -1;
      setActive((i) => (i + step + items.length) % items.length);
    } else if (e.key === 'Enter') {
      const item = active >= 0 ? items[active] : ghost ? items[0] : null;
      if (!item) return setOpen(false); // the surrounding form handles what was typed
      e.preventDefault();
      choose(item);
    }
  }

  return (
    <div className="relative">
      {children}
      {ghost && (
        // Mirrors the input's text (invisible) so the grey completion starts right after the caret.
        <div aria-hidden className={`pointer-events-none absolute inset-0 z-[1] flex items-center overflow-hidden whitespace-pre ${textInset}`}>
          <span className="invisible">{value}</span>
          <span className="text-soft">{ghost}</span>
        </div>
      )}
      <input
        {...input}
        id={id}
        role="combobox"
        aria-expanded={shown}
        aria-controls={`${id}-suggestions`}
        aria-autocomplete="both"
        aria-activedescendant={shown && active >= 0 ? `${id}-suggestion-${active}` : undefined}
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
        autoComplete="off"
        spellCheck={false}
        className={inputClassName}
      />
      {shown && (
        // A shell like every card (ui.md): a hairline tray, opaque here since it floats over the page, holding a white card.
        <div className="absolute inset-x-0 top-full z-10 mt-2 rounded-shell border border-hair bg-surface p-1.5 shadow-card">
          <ul id={`${id}-suggestions`} role="listbox" aria-label={label} className="space-y-0.5 rounded-card bg-white p-1.5">
          {items.map((item, i) => (
            <li
              key={keyOf(item)}
              id={`${id}-suggestion-${i}`}
              role="option"
              aria-selected={i === active}
              // mousedown, not click: it lands before the input's blur closes the list
              onMouseDown={(e) => {
                e.preventDefault();
                choose(item);
              }}
              onMouseEnter={() => setActive(i)}
              className={`flex min-h-11 cursor-pointer items-center justify-between gap-3 rounded-input px-3.5 py-2 transition-colors duration-150 ${i === active ? 'bg-field shadow-[inset_0_0_0_1px_var(--color-hair)]' : ''}`}
            >
              {renderOption(item)}
            </li>
          ))}
          </ul>
        </div>
      )}
    </div>
  );
}

/** The rest of the first candidate that continues `typed` (ignoring case), or ''. It never rewrites what was typed. */
export function completion(typed: string, candidates: string[]) {
  if (!typed) return '';
  const hit = candidates.find((c) => c.length > typed.length && c.toUpperCase().startsWith(typed.toUpperCase()));
  return hit ? hit.slice(typed.length) : '';
}
