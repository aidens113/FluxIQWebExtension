/** An order number in the store's three-part form, fixed for a seed and the order's position. */
export function orderId(seed: number, index: number): string {
  let value = (Math.imul(seed ^ 0x2c1b3c6d, 0x297a2d39) + Math.imul(index + 7, 0x85ebca6b)) >>> 0;
  const part = () => {
    value = Math.imul(value ^ (value >>> 15), 0x2c1b3c6d) >>> 0;
    return String(value % 10_000_000).padStart(7, "0");
  };
  return ["114", part(), part()].join("-");
}
