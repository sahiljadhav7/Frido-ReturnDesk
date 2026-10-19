'use client';

import { useRouter } from 'next/navigation';
import { useState, useTransition } from 'react';
import { send } from '../../_ui/api';
import { ErrorBanner } from '../../_ui/error-banner';
import { Icon } from '../../_ui/icons';

/** The add-note box under the timeline. There even when the request is Closed. */
export function NoteForm({ reference }: { reference: string }) {
  const router = useRouter();
  const [refreshing, startTransition] = useTransition();
  const [sending, setSending] = useState(false);
  const [body, setBody] = useState('');
  const [error, setError] = useState<string | null>(null);
  const pending = sending || refreshing;

  async function submit(e: React.FormEvent) {
    e.preventDefault();
    setSending(true);
    setError(null);
    const message = await send('POST', `/api/return-requests/${reference}/notes`, { body });
    setSending(false);
    if (message) return setError(message);
    setBody('');
    startTransition(() => router.refresh());
  }

  return (
    <form onSubmit={submit} className="mt-6 rounded-shell border border-hair bg-tray p-1.5">
      {error && <div className="px-1.5 pt-1.5"><ErrorBanner message={error} /></div>}
      <div className="flex items-end gap-2">
        <label htmlFor="note-body" className="sr-only">Add a note</label>
        {/* One line that grows with the text (field-sizing), up to a cap; browsers without it scroll inside one line. */}
        <textarea
          id="note-body"
          value={body}
          onChange={(e) => setBody(e.target.value)}
          // Enter adds the note, Shift+Enter starts a new line; skip while an IME is composing.
          onKeyDown={(e) => {
            if (e.key !== 'Enter' || e.shiftKey || e.nativeEvent.isComposing) return;
            e.preventDefault();
            if (!pending && body.trim()) e.currentTarget.form?.requestSubmit();
          }}
          rows={1}
          maxLength={2000}
          placeholder="Add a note"
          className="block max-h-40 min-h-12 min-w-0 flex-1 resize-none rounded-[22px] bg-white px-4 py-3 shadow-[inset_0_0_0_1px_var(--color-hair)] [field-sizing:content] placeholder:text-soft"
        />
        <button
          type="submit"
          aria-label="Add note"
          // Blank would only earn the server's generic 400; the server still refuses it if sent.
          disabled={pending || !body.trim()}
          className="inline-flex h-12 shrink-0 items-center gap-3 rounded-full bg-ink-blue p-1.5 font-medium text-white transition-transform duration-200 ease-press active:scale-[0.98] disabled:opacity-45 sm:pl-5"
        >
          {/* The label hides on phone so the box keeps the width; the button keeps its accessible name. */}
          <span className="hidden sm:inline" aria-hidden>{pending ? 'Adding…' : 'Add note'}</span>
          <span className="flex size-9 items-center justify-center rounded-full bg-white/10">
            <Icon name="arrow" />
          </span>
        </button>
      </div>
      <p className="hidden px-2 pt-1.5 text-sm text-soft sm:block">Enter to add · Shift+Enter for a new line</p>
    </form>
  );
}
