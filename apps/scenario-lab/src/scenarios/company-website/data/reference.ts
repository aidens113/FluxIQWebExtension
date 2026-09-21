/**
 * A reference code derived from what was asked for, never from a clock or a
 * counter, so the same request always receives the same reference and a
 * manifest can state it. `KQ-40721`: a prefix and five digits.
 */
export function referenceCode(prefix: string, parts: readonly string[]): string {
  return `${prefix}-${String(fnv1a(parts.join("␟")) % 90_000 + 10_000)}`;
}

/** FNV-1a over UTF-16 code units: small, stable, and the same in every runtime. */
export function fnv1a(text: string): number {
  let value = 0x811c9dc5;
  for (let index = 0; index < text.length; index += 1) {
    value ^= text.charCodeAt(index);
    value = Math.imul(value, 0x01000193) >>> 0;
  }
  return value;
}
