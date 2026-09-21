/** The order number the `index`-th order placed since a reset receives: the same every run, and a second order a different one. */
export function orderNumber(index: number): string {
  return `2000958-${40713 + index}`;
}
