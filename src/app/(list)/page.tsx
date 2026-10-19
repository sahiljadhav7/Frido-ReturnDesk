import Link from 'next/link';
import { Suspense } from 'react';
import { STATUS_LABELS, STATUSES } from '@/domain/lifecycle';
import { listQuerySchema } from '@/domain/schemas';
import { withParams } from './url';
import { ErrorBanner } from '../_ui/error-banner';
import { Shell } from '../_ui/shell';
import { ReasonFilter } from './reason-filter';
import { Results, ResultsSkeleton } from './results';
import { SearchBox } from './search-box';
import { SortSelect } from './sort-select';

export const dynamic = 'force-dynamic';

export default async function ListPage({ searchParams }: PageProps<'/'>) {
  // A repeated param (`?q=a&q=b`) keeps its last value.
  const raw: Record<string, string> = {};
  for (const [k, v] of Object.entries(await searchParams)) if (v !== undefined) raw[k] = Array.isArray(v) ? v.at(-1)! : v;
  const parsed = listQuerySchema.safeParse(raw);
  const query = parsed.success ? parsed.data : listQuerySchema.parse({});
  const current = parsed.success ? new URLSearchParams(raw).toString() : '';
  const chosenStatus = query.status?.length === 1 ? query.status[0] : null;

  return (
    <div>
      <h1 className="text-[34px] leading-[1.05] font-semibold tracking-[-0.035em] md:text-[44px]">Return requests</h1>
      <p className="mt-2 text-muted">Search by reference, order, name or email, or narrow by status and reason.</p>

      {!parsed.success && <div className="mt-6"><ErrorBanner message="Some filters in this link aren't valid, so they were cleared." /></div>}

      <nav aria-label="Status" className="mt-6 -mx-4 overflow-x-auto px-4">
        <ul className="inline-flex gap-1 rounded-full border border-hair bg-tray p-1.5">
          {[null, ...STATUSES].map((s) => {
            const chosen = s === chosenStatus && (s !== null || !query.status?.length);
            return (
              <li key={s ?? 'all'}>
                {/* No prefetch: each tab is a dynamic page with its own query, and they change on every search. */}
                <Link
                  prefetch={false}
                  href={withParams(current, { status: s ?? undefined })}
                  aria-current={chosen ? 'page' : undefined}
                  className={`inline-flex h-10 items-center rounded-full px-4 text-sm whitespace-nowrap ${chosen ? 'bg-white font-medium shadow-card' : 'text-muted hover:text-ink'}`}
                >
                  {s ? STATUS_LABELS[s] : 'All'}
                </Link>
              </li>
            );
          })}
        </ul>
      </nav>

      <Shell className="mt-5">
        <div className="flex flex-col gap-3 md:flex-row">
          <SearchBox q={query.q ?? ''} current={current} />
          <ReasonFilter chosen={query.reason ?? []} current={current} />
          <SortSelect value={`${query.sort}:${query.order}`} current={current} />
        </div>
      </Shell>

      {/* Keyed on the query, so the skeleton shows on every change, not only the first load. */}
      <Suspense key={current} fallback={<ResultsSkeleton />}>
        <Results query={query} current={current} />
      </Suspense>
    </div>
  );
}
