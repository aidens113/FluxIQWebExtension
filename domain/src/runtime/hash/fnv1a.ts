/**
 * 32-bit FNV-1a over a string's UTF-16 code units, as an unsigned integer.
 *
 * Not a cryptographic hash and not trying to be: nothing that uses it is a
 * security boundary, and the only questions asked of the result are whether
 * two are equal (the state digest) and which of several is smallest (the route
 * signature's control sketch). Each caller formats the number its own way.
 */
export function fnv1a(text: string): number {
  let hash = 0x811c9dc5;
  for (let index = 0; index < text.length; index += 1) {
    hash ^= text.charCodeAt(index);
    hash = Math.imul(hash, 0x01000193) >>> 0;
  }
  return hash;
}
