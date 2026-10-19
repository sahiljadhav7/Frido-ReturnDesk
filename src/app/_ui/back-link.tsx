'use client';

import Link from 'next/link';
import { useEffect, useState } from 'react';
import { Icon } from './icons';

// The list's last query (status, search, sort, page), so "Return requests" returns to the same view.
// Per tab, and only a convenience: without storage it falls back to the plain list.
const KEY = 'returndesk:list-query';

/** Rendered by the list page: remembers its current (already validated) query. */
export function RememberListQuery({ query }: { query: string }) {
  useEffect(() => {
    try {
      sessionStorage.setItem(KEY, query);
    } catch {}
  }, [query]);
  return null;
}

export function BackLink() {
  const [href, setHref] = useState('/');
  useEffect(() => {
    try {
      const query = sessionStorage.getItem(KEY);
      if (query) setHref(`/?${query}`);
    } catch {}
  }, []);
  return (
    <Link href={href} className="inline-flex h-11 items-center gap-2 rounded-full border border-hair bg-white pr-5 pl-4 text-sm">
      <Icon name="back" />
      Return requests
    </Link>
  );
}
