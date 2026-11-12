/** A path as one comparable spelling: Windows accepts either separator, any case and a trailing separator for one directory. */
export function normalizePath(value: string): string {
  return value.trim().replace(/\//gu, "\\").replace(/\\+$/u, "").toLowerCase();
}
