/**
 * The Scenario Lab scenario a URL addresses, or `null` when it addresses none:
 * a page under `/scenarios/<id>`, a mutation at `/api/<id>/<operation>`, or a
 * control request carrying `?scenario=<id>` (`/__control/final-state`). These
 * are the only paths the lab serves a scenario on (`src/server.ts`,
 * `src/control.ts`).
 */
export function scenarioIdInUrl(value: string): string | null {
  let url: URL;
  try { url = new URL(value); } catch { return null; }
  const page = /^\/(?:scenarios|api)\/([^/?#]+)/u.exec(url.pathname);
  if (page?.[1]) return decodeURIComponent(page[1]);
  if (url.pathname.startsWith("/__control/")) return url.searchParams.get("scenario");
  return null;
}
