import { z } from 'zod';
import { STATUSES } from './lifecycle';

export const REASONS = ['damaged', 'wrong_item', 'size_issue', 'not_as_described', 'changed_mind'] as const;
export type Reason = (typeof REASONS)[number];

export const REASON_LABELS: Record<Reason, string> = {
  damaged: 'Damaged',
  wrong_item: 'Wrong Item',
  size_issue: 'Size Issue',
  not_as_described: 'Not As Described',
  changed_mind: 'Changed Mind',
};

export const RESOLUTIONS = ['refund', 'replacement', 'store_credit'] as const;
export type Resolution = (typeof RESOLUTIONS)[number];

// Postgres rejects \u0000 in text, so refuse it here rather than let the insert 500.
const blankableText = (max: number) =>
  z.string().trim().max(max).refine((s) => !s.includes('\u0000'), 'Must not contain a null character.');
const text = (max: number) => blankableText(max).min(1);

export const raiseSchema = z.strictObject({
  orderLineId: z.int32().positive(),
  quantity: z.int32().positive(),
  reason: z.enum(REASONS),
  contactName: text(200),
  contactEmail: text(254).pipe(z.email()),
  // Customers without a phone prefill an empty field; a blank one is stored as null.
  contactPhone: blankableText(40).transform((p) => p || null).nullish().transform((p) => p ?? null),
});
export type RaiseInput = z.infer<typeof raiseSchema>;

// Comma-separated multi-select, e.g. `status=open,in_review`.
const csv = <T extends readonly [string, ...string[]]>(values: T) =>
  z.string().transform((s) => s.split(',').filter(Boolean)).pipe(z.array(z.enum(values))).optional();
const positive = (max?: number) => z.coerce.number().pipe(max ? z.int32().positive().max(max) : z.int32().positive());

export const SORTS = ['createdAt', 'lastActivityAt'] as const;

/** `GET /api/return-requests` and the list page read the same query. */
export const listQuerySchema = z.strictObject({
  q: blankableText(200).optional(),
  status: csv(STATUSES),
  reason: csv(REASONS),
  sort: z.enum(SORTS).default('lastActivityAt'),
  order: z.enum(['asc', 'desc']).default('desc'),
  page: positive().default(1),
  pageSize: positive(100).default(20),
});
export type ListQuery = z.infer<typeof listQuerySchema>;
