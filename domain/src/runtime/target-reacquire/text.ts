// How two values are compared when a stale target is matched again (t786, D4):
// exactly, with only spacing and case set aside. Never fuzzy: "Hide post" and
// "Hide posts" are two controls, and "Ana Ruiz" and "Ana Ruíz" two authors.

/** `value` as compared: runs of whitespace one space, trimmed, lower case. */
export function webReacquireText(value: string): string {
  return value.replace(/\s+/gu, " ").trim().toLowerCase();
}
