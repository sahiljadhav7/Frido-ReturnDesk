import { STATUS_LABELS, type Status } from '@/domain/lifecycle';

const tones: Record<Status, string> = {
  open: 'bg-open text-open-ink',
  in_review: 'bg-in-review text-in-review-ink',
  approved: 'bg-approved text-approved-ink',
  rejected: 'bg-rejected text-rejected-ink',
  completed: 'bg-completed text-completed-ink',
};

// A dot plus the name, so colour is never the only signal (ui.md "Status badge").
export function StatusBadge({ status, small = false }: { status: Status; small?: boolean }) {
  return (
    <span className={`inline-flex shrink-0 items-center gap-1.5 rounded-full px-3 font-medium ${small ? 'h-6 text-xs' : 'h-7 text-sm'} ${tones[status]}`}>
      <span className="size-1.5 rounded-full bg-current" aria-hidden />
      {STATUS_LABELS[status]}
    </span>
  );
}
