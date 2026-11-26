import type { NetworkViolation } from "../../../network-guard.js";

/**
 * What the network guard blocked in the attempt's browser, as plain report lines. `[]` when it blocked nothing. The
 * guard keeps only an origin and path for each destination (never a query, header, cookie or page data), and a frame
 * or request that never loaded is otherwise silent: the page just shows a gap.
 */
export function guardViolationLines(violations: readonly NetworkViolation[]): string[] {
  if (violations.length === 0) return [];
  const words = (item: NetworkViolation): string => {
    const what = item.kind === "websocket" ? "a websocket connection" : item.kind === "service-worker" ? "a service worker the guard could not see" : `${item.resourceType === "document" ? "a frame or page load" : "a request"}${item.resourceType && item.resourceType !== "document" ? ` (${item.resourceType})` : ""}`;
    return `${what} to ${item.destination}`;
  };
  return [`The browser's network guard blocked ${violations.length} destination(s), so a page may have shown a gap where something did not load: ${violations.slice(0, 20).map(words).join("; ")}${violations.length > 20 ? `; and ${violations.length - 20} more` : ""}.`];
}
