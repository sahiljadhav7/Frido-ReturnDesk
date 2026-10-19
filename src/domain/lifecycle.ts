// Status values and their glossary names.
export const STATUSES = ['open', 'in_review', 'approved', 'rejected', 'completed'] as const;
export type Status = (typeof STATUSES)[number];

export const STATUS_LABELS: Record<Status, string> = {
  open: 'Open',
  in_review: 'In Review',
  approved: 'Approved',
  rejected: 'Rejected',
  completed: 'Completed',
};

/** Live = not Removed and not Closed (ADR 0002). The partial unique index repeats this list. */
export const LIVE_STATUSES = ['open', 'in_review', 'approved'] as const satisfies readonly Status[];

/** Not yet Decided: the only Statuses a correction may change. The server enforces it, the detail page reads it to show Edit. */
export const CORRECTABLE_STATUSES = ['open', 'in_review'] as const satisfies readonly Status[];

/** The one transition table: the server enforces it, the detail page reads it to choose which actions to show. */
export const TRANSITIONS: Record<Status, readonly Status[]> = {
  open: ['in_review'],
  in_review: ['approved', 'rejected'],
  approved: ['completed'],
  rejected: [],
  completed: [],
};
