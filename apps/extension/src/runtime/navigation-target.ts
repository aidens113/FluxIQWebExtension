// Which tab a navigation drives when it names no tab and asks for no new one.
//
// Every other action runs on the page in front -- the command channel re-reads
// Chrome's active tab before each one -- and every observation Core makes is a
// snapshot of that same page. A navigation used to go instead to the tab this
// worker last drove, or, when it had driven none, to a tab it opened for the
// occasion. So the first navigation of a run went somewhere nobody was looking:
// it reported success from a new tab while the page in front, the one the next
// click ran on and the one Core's after-action snapshot read, never moved. A
// Flow created through the panel (E1 lane B, E9) replayed exactly that way --
// "navigated" to its results page, then failed to find a control on the start
// page it had never left -- and the model that wrote it had been misled the
// same way while it explored.
//
// So a navigation drives the page in front, like everything else, when that is
// a page a navigation may take over. Two kinds are not, and for them the older
// rule still holds (the tab last driven, else a new one):
//
// - a page the extension cannot automate at all (`unsupported-page.ts`): a
//   browser page, an extension page, a web store; and
// - FluxIQ's own panel. A run is usually started from it, so it is often the
//   page in front, and driving it away would take the run's own controls with
//   it.
//
// A tab whose URL cannot be read is not taken over either: nothing proves it is
// a page a navigation may replace.

import { readTabUrl } from "./automation-tab";
import { unsupportedAutomationPageReason } from "./unsupported-page";

/**
 * The page in front, when a navigation that names no tab should drive it; or
 * undefined, when the navigation should fall back to the tab last driven.
 * `ownOrigins` are the origins of FluxIQ's own pages.
 */
export async function navigationTargetTab(
  activeTabId: number | undefined,
  ownOrigins: readonly string[]
): Promise<number | undefined> {
  if (activeTabId === undefined) return undefined;
  const url = await readTabUrl(activeTabId);
  if (!url?.trim()) return undefined;
  if (unsupportedAutomationPageReason(url) !== undefined) return undefined;
  const origin = originOf(url);
  if (origin === undefined || ownOrigins.some((own) => originOf(own) === origin)) return undefined;
  return activeTabId;
}

/** The URL's origin, or undefined for one that does not parse or has no origin of its own (`about:`, `data:`). */
function originOf(url: string): string | undefined {
  if (!URL.canParse(url)) return undefined;
  const origin = new URL(url).origin;
  return origin === "null" ? undefined : origin.toLowerCase();
}
