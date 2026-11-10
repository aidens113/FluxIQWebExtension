// The delay a `<meta http-equiv="refresh">` declares (`./declared-refresh.ts`):
// its leading number of seconds, `0` when it names only an address.

/** The delay a refresh `content` attribute declares, in milliseconds; undefined when it declares none. */
export function declaredRefreshDelayMs(content: string | null | undefined): number | undefined {
  const match = typeof content === "string" ? /^\s*(\d+(?:\.\d+)?)?\s*(?:[;,]|$)/u.exec(content) : null;
  if (!match) return undefined;
  return match[1] === undefined ? 0 : Math.round(Number(match[1]) * 1_000);
}
