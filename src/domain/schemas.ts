import { z } from 'zod';

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

// Postgres rejects \u0000 in text, so refuse it here rather than let the insert 500.
const text = (max: number) =>
  z.string().trim().min(1).max(max).refine((s) => !s.includes('\u0000'), 'Must not contain a null character.');

export const raiseSchema = z.strictObject({
  orderLineId: z.int32().positive(),
  quantity: z.int32().positive(),
  reason: z.enum(REASONS),
  contactName: text(200),
  contactEmail: text(254).pipe(z.email()),
  // Customers without a phone prefill an empty field; store that as null.
  contactPhone: z.union([text(40), z.literal('').transform(() => null), z.null()]).optional().transform((p) => p ?? null),
});
export type RaiseInput = z.infer<typeof raiseSchema>;
