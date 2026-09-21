const ALPHABET = "ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz0123456789";

/**
 * An eleven-character shortcode, the shape a post address carries, derived
 * from a fixed label so the same post has the same address on every run and
 * under every seed. Nothing about it says which post it is.
 */
export function shortcode(label: string): string {
  let value = 0x811c9dc5;
  let code = "D";
  for (let round = 0; code.length < 11; round += 1) {
    const text = `${label}:${round}`;
    for (let index = 0; index < text.length; index += 1) {
      value ^= text.charCodeAt(index);
      value = Math.imul(value, 0x01000193) >>> 0;
    }
    code += ALPHABET[value % ALPHABET.length];
  }
  return code;
}

/** A long numeric comment id from a fixed label, as a comment permalink carries it. */
export function commentId(label: string): string {
  let value = 0x811c9dc5;
  let digits = "18";
  for (let round = 0; digits.length < 17; round += 1) {
    const text = `${label}#${round}`;
    for (let index = 0; index < text.length; index += 1) {
      value ^= text.charCodeAt(index);
      value = Math.imul(value, 0x01000193) >>> 0;
    }
    digits += String(value % 10);
  }
  return digits;
}
