import { AppError } from './errors';

/** Quantity is between 1 and the quantity ordered on the Order Line. */
export function checkQuantity(quantity: number, ordered: number) {
  if (quantity > ordered)
    throw new AppError(422, 'quantity_over_ordered', `Quantity can't be more than the ${ordered} ordered on this line.`, { ordered });
}
