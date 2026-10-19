import { notFound } from 'next/navigation';
import { getOrderByNumber, getReturnRequest } from '@/db/reads';
import { AppError } from '@/domain/errors';
import { CORRECTABLE_STATUSES, type Status } from '@/domain/lifecycle';
import { REASON_LABELS, RESOLUTION_LABELS, type Resolution } from '@/domain/schemas';
import { formatDateTime, formatDay, formatPaise } from '@/lib/format';
import { BackLink } from '../../_ui/back-link';
import { Icon } from '../../_ui/icons';
import { ProductGlyph } from '../../_ui/product-glyph';
import { Shell } from '../../_ui/shell';
import { StatusBadge } from '../../_ui/status-badge';
import { Actions } from './actions';
import { DetailsCard } from './details-card';
import { NoteForm } from './note-form';

export const dynamic = 'force-dynamic';

async function load(reference: string) {
  try {
    return await getReturnRequest(reference);
  } catch (e) {
    if (e instanceof AppError && e.status === 404) notFound();
    throw e;
  }
}

// What a move into Approved or Completed meant. The Resolution is fixed once Approved, so the request's own values are the ones approved.
function Outcome({ to, resolution, refundAmountPaise }: { to: Status; resolution: Resolution | null; refundAmountPaise: number | null }) {
  if (!resolution || (to !== 'approved' && to !== 'completed')) return null;
  const refund = formatPaise(refundAmountPaise ?? 0);
  const text =
    to === 'approved'
      ? resolution === 'refund' ? `Refund of ${refund}` : RESOLUTION_LABELS[resolution]
      : { refund: `${refund} refunded`, replacement: 'Replacement sent', store_credit: 'Store Credit issued' }[resolution];
  return <span className="font-medium text-ink">· {text}</span>;
}

export default async function ReturnRequestPage({ params }: PageProps<'/requests/[reference]'>) {
  const r = await load((await params).reference);
  const line = r.orderLine;
  // Only a request that isn't Decided gets Edit, which needs the Order's other lines.
  const correctable = (CORRECTABLE_STATUSES as readonly Status[]).includes(r.status);
  const order = correctable ? await getOrderByNumber(line.order.number) : null;
  const fields: [string, string][] = [
    ['Contact name', r.contactName],
    ['Email', r.contactEmail],
    ['Phone', r.contactPhone ?? 'None given'],
    ['Order', `${line.order.number} · ${formatDay(line.order.placedAt)}`],
    ['Reason', REASON_LABELS[r.reason]],
    ...(r.resolution ? [['Resolution', RESOLUTION_LABELS[r.resolution]] as [string, string]] : []),
    ...(r.refundAmountPaise !== null ? [['Refund Amount', formatPaise(r.refundAmountPaise)] as [string, string]] : []),
  ];

  return (
    <div>
      <BackLink />
      <div className="mt-6 flex flex-wrap items-center gap-3">
        <h1 className="text-[34px] leading-[1.05] font-semibold tracking-[-0.035em] whitespace-nowrap md:text-[44px]">{r.reference}</h1>
        <StatusBadge status={r.status} />
      </div>
      <p className="mt-2 text-muted">
        Raised {formatDateTime(r.createdAt)} · {r.contactName} · {line.order.number}
      </p>

      {/* Actions come first in the DOM so a phone shows the next move straight after the header. */}
      <div className="mt-6 grid grid-cols-1 gap-5 md:grid-cols-[minmax(0,1fr)_380px] md:items-start md:gap-8">
        <div className="md:sticky md:top-8 md:order-2">
          {/* Keyed by Status so an open approve form or confirm resets after the move lands. */}
          <Actions key={r.status} reference={r.reference} status={r.status} maxRefundPaise={line.unitPricePaise * r.quantity} />
        </div>
        <div className="space-y-5 md:order-1">
          <DetailsCard
            reference={r.reference}
            edit={order ? {
              lines: order.lines,
              values: { orderLineId: r.orderLineId, quantity: r.quantity, reason: r.reason, contact: { name: r.contactName, email: r.contactEmail, phone: r.contactPhone ?? '' }, expectedLastActivityAt: r.lastActivityAt.toISOString() },
            } : undefined}
          >
            <div className="flex items-center gap-3 rounded-inset bg-field p-3 sm:gap-4 sm:p-4">
              <ProductGlyph />
              <div className="min-w-0 flex-1">
                <p className="font-medium">{line.productName}</p>
                <p className="text-sm text-muted">{line.sku} · {formatPaise(line.unitPricePaise)} per unit</p>
              </div>
              <div className="shrink-0 text-right">
                <p className="font-medium">{r.quantity} of {line.quantity}</p>
                <p className="text-sm text-soft">returning</p>
              </div>
            </div>
            <dl className="mt-5 grid grid-cols-2 gap-x-6 gap-y-4 sm:grid-cols-3">
              {fields.map(([label, value]) => (
                <div key={label} className="min-w-0">
                  <dt className="text-sm text-soft">{label}</dt>
                  <dd className="mt-1 break-words">{value}</dd>
                </div>
              ))}
            </dl>
          </DetailsCard>

          <Shell>
            <h2 className="mb-4 text-lg font-semibold">Timeline</h2>
            <ol className="relative space-y-4 before:absolute before:top-4 before:bottom-4 before:left-[13.5px] before:w-px before:bg-hair">
              {r.timeline.map((t) => (
                <li key={`${t.kind}-${t.id}`} className="relative flex gap-3">
                  <span className="flex size-7 shrink-0 items-center justify-center rounded-full border border-hair bg-white text-muted" aria-hidden>
                    <Icon name={t.kind === 'note' ? 'note' : 'arrow'} className="size-3.5" />
                  </span>
                  {t.kind === 'status_change' ? (
                    <p className="flex flex-wrap items-center gap-x-2 gap-y-1 pt-0.5 text-muted">
                      Moved to <StatusBadge status={t.to} small />
                      <Outcome to={t.to} resolution={r.resolution} refundAmountPaise={r.refundAmountPaise} />
                      · {formatDateTime(t.at, { year: false })}
                    </p>
                  ) : (
                    <div className="flex-1 rounded-inset bg-field px-4 py-3">
                      <p className="whitespace-pre-wrap break-words">{t.body}</p>
                      <p className="mt-1 text-sm text-soft">{formatDateTime(t.at, { year: false })}</p>
                    </div>
                  )}
                </li>
              ))}
            </ol>
            <NoteForm reference={r.reference} />
          </Shell>
        </div>
      </div>
    </div>
  );
}
