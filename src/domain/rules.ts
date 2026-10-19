import { AppError } from './errors';
import { STATUS_LABELS, TRANSITIONS, type Status } from './lifecycle';
import type { StatusChangeInput } from './schemas';

/** Quantity is between 1 and the quantity ordered on the Order Line. */
export function checkQuantity(quantity: number, ordered: number) {
  if (quantity > ordered)
    throw new AppError(422, 'quantity_over_ordered', `Quantity can't be more than the ${ordered} ordered on this line.`, { ordered });
}

const rupees = (paise: number) => new Intl.NumberFormat('en-IN', { style: 'currency', currency: 'INR' }).format(paise / 100);

/** A legal move (409 if not), then the approval rules: Resolution, and a Refund Amount only for Refund, within unit price × units (422). */
export function checkStatusChange(from: Status, { to, resolution, refundAmountPaise }: StatusChangeInput, cap: { unitPricePaise: number; quantity: number }) {
  if (!TRANSITIONS[from].includes(to))
    throw new AppError(409, 'illegal_transition', `A request can't move from ${STATUS_LABELS[from]} to ${STATUS_LABELS[to]}.`, { from, to });
  if (to !== 'approved') {
    if (resolution !== undefined || refundAmountPaise !== undefined)
      throw new AppError(422, 'resolution_not_allowed', 'Only approving takes a Resolution or Refund Amount.');
    return;
  }
  if (!resolution) throw new AppError(422, 'resolution_required', 'Choose a Resolution to approve.');
  if (resolution !== 'refund') {
    if (refundAmountPaise !== undefined) throw new AppError(422, 'refund_amount_not_allowed', 'Only a Refund takes a Refund Amount.');
    return;
  }
  if (refundAmountPaise === undefined) throw new AppError(422, 'refund_amount_required', 'Enter a Refund Amount.');
  const max = cap.unitPricePaise * cap.quantity;
  if (refundAmountPaise <= 0 || refundAmountPaise > max)
    throw new AppError(422, 'refund_amount_out_of_range', `Refund Amount must be more than ₹0 and no more than ${rupees(max)} for ${cap.quantity} ${cap.quantity === 1 ? 'unit' : 'units'}.`, { maxPaise: max });
}
