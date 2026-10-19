import Link from 'next/link';
import { listReturnRequests } from '@/db/reads';
import { type ListQuery, REASON_LABELS } from '@/domain/schemas';
import { formatDateTime } from '@/lib/format';
import { withParams } from './url';
import { Avatar } from '../_ui/avatar';
import { Icon } from '../_ui/icons';
import { Shell } from '../_ui/shell';
import { StatusBadge } from '../_ui/status-badge';

const pager = 'inline-flex h-11 flex-1 items-center justify-center rounded-full border border-hair bg-white px-5 text-sm font-medium md:flex-none';

export async function Results({ query, current }: { query: ListQuery; current: string }) {
  const { data: rows, total, page, pageSize } = await listReturnRequests(query);
  const filtered = Boolean(query.q || query.status?.length || query.reason?.length);

  if (!rows.length)
    return (
      <Shell className="mt-5">
        <div className="py-8 text-center">
          {total > 0 ? (
            <>
              <p className="font-medium">No return requests on this page.</p>
              <Link href={withParams(current, { page: undefined })} className="mt-2 inline-block text-link">Go to the first page</Link>
            </>
          ) : filtered ? (
            <>
              <p className="font-medium">No return requests match these filters.</p>
              <Link href="/" className="mt-2 inline-block text-link">Clear filters</Link>
            </>
          ) : (
            <>
              <p className="font-medium">No return requests yet.</p>
              <Link href="/requests/new" className="mt-2 inline-block text-link">Raise request</Link>
            </>
          )}
        </div>
      </Shell>
    );

  const first = (page - 1) * pageSize + 1;
  const last = first + rows.length - 1;
  const paging = (
    <div className="flex flex-col gap-3 md:flex-row md:items-center md:justify-between">
      <p className="text-center text-sm text-muted md:text-left">Showing {first}–{last} of {total}</p>
      <div className="flex gap-3">
        {page > 1 ? <Link href={withParams(current, { page: String(page - 1) })} className={pager}>Previous</Link> : <span role="link" aria-disabled="true" className={`${pager} opacity-45`}>Previous</span>}
        {last < total ? <Link href={withParams(current, { page: String(page + 1) })} className={pager}>Next</Link> : <span role="link" aria-disabled="true" className={`${pager} opacity-45`}>Next</span>}
      </div>
    </div>
  );

  return (
    <>
      {/* Desktop: one table; the reference link stretches over its whole row. */}
      <Shell className="mt-5 hidden md:block">
        <table className="-mx-6 -mt-6 w-[calc(100%+3rem)] text-left">
          <thead className="text-sm text-soft">
            <tr className="border-b border-hair">
              {['Reference', 'Customer', 'Order and product', 'Reason', 'Status', 'Last activity'].map((h) => (
                <th key={h} scope="col" className="px-4 py-4 font-normal first:pl-6">{h}</th>
              ))}
              <th className="pr-6"><span className="sr-only">Open</span></th>
            </tr>
          </thead>
          <tbody>
            {rows.map((r) => (
              <tr key={r.reference} className="relative border-b border-hair hover:bg-row-hover">
                <td className="py-4 pr-4 pl-6 font-semibold whitespace-nowrap">
                  <Link href={`/requests/${r.reference}`} className="after:absolute after:inset-0">{r.reference}</Link>
                </td>
                <td className="px-4 py-4">
                  <div className="flex items-center gap-3">
                    <Avatar name={r.contactName} email={r.contactEmail} />
                    <div className="min-w-0">
                      <p>{r.contactName}</p>
                      <p className="text-sm break-all text-muted">{r.contactEmail}</p>
                    </div>
                  </div>
                </td>
                <td className="px-4 py-4">
                  <p>{r.productName}</p>
                  <p className="text-sm text-muted">{r.orderNumber}</p>
                </td>
                <td className="px-4 py-4">{REASON_LABELS[r.reason]}</td>
                <td className="px-4 py-4"><StatusBadge status={r.status} /></td>
                <td className="px-4 py-4 whitespace-nowrap text-muted">{formatDateTime(r.lastActivityAt, { year: false })}</td>
                <td className="py-4 pr-6">
                  <span className="flex size-9 items-center justify-center rounded-full border border-hair" aria-hidden><Icon name="right" /></span>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
        <div className="pt-5">{paging}</div>
      </Shell>

      {/* Below md: one card per request. */}
      <ul className="mt-5 space-y-4 md:hidden">
        {rows.map((r) => (
          <li key={r.reference}>
            <Link href={`/requests/${r.reference}`} className="block">
              <Shell>
                <div className="flex items-center justify-between gap-3">
                  <span className="font-semibold">{r.reference}</span>
                  <StatusBadge status={r.status} />
                </div>
                <div className="mt-4 flex items-center gap-3">
                  <Avatar name={r.contactName} email={r.contactEmail} />
                  <div className="min-w-0">
                    <p>{r.contactName}</p>
                    <p className="truncate text-sm text-muted">{r.orderNumber} · {r.productName}</p>
                  </div>
                </div>
                <div className="mt-4 flex justify-between gap-3 border-t border-hair pt-4 text-sm text-muted">
                  <span>{REASON_LABELS[r.reason]}</span>
                  <span>{formatDateTime(r.lastActivityAt, { year: false })}</span>
                </div>
              </Shell>
            </Link>
          </li>
        ))}
      </ul>
      <div className="mt-5 md:hidden">{paging}</div>
    </>
  );
}

export function ResultsSkeleton() {
  return (
    <Shell className="mt-5">
      <div role="status" aria-busy="true" className="space-y-3">
        <span className="sr-only">Loading return requests…</span>
        {Array.from({ length: 6 }, (_, i) => <div key={i} className="h-14 rounded-inset bg-field" />)}
      </div>
    </Shell>
  );
}
