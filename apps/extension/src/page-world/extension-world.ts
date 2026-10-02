// Which world a page-world bundle landed in. Shared by every page-world
// install, each of which is useless in an isolated world.

/**
 * Whether this bundle landed in an extension's isolated world instead of the
 * page's. A content script there can reach `chrome.runtime.id`; a script in the
 * page world cannot, because a page has no extension API. It matters because
 * `world: "MAIN"` is honoured only from Chrome 111 and Firefox 128: on an older
 * browser the entry is ignored and this script runs isolated, where the
 * override would be installed on a `window` no page script ever sees.
 */
export function inExtensionWorld(): boolean {
  const runtime = (globalThis as unknown as { chrome?: { runtime?: { id?: string } } }).chrome?.runtime;
  return typeof runtime?.id === "string";
}
