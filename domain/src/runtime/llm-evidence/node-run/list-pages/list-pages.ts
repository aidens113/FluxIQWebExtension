// The lists a build's own Next page steps moved, so a read of one stands on the
// page its pager took it to, whatever that page's address (t1022).
//
// A saved read is refused where its list does not stand
// (`../../plan-resolution/extraction/list-stands.ts`): on a page outside the
// family of the one it was detected on. A site that pages by its path
// (`/jobs/page/2`) moves the list to such a page, and its pager said so: a Next
// page step naming the list answered `moved` (`output-nodes/next-page/list-move.ts`).
// So each list a Next page moved is remembered here by its item selector, the
// same the read's binding holds, and its reads stand wherever they run after.
//
// A page turn can also be shown to have landed by the page rather than by its
// answer (t1096): one whose answer was lost and which the page check found
// landed (`../retries/page-effect.ts`), or a press on a list's detected Next
// whose page then moved as a page turn moves it (`./turned-lists.ts`). Either
// moved its lists the same way, and is remembered the same way (`turned`).
//
// Kept per build and session, beside the build's handle stores, as the replayed
// reads are (`../retries/replayed-reads.ts`), and never shown to anyone.

import type { JsonObject, JsonValue } from "fluxiq/core";
import { webAutomationNextPageListMove } from "../../../../output-nodes/next-page";
import { webNodeBuildOf, webNodeBuildSlot } from "../build-state";
import type { WebNodeRun } from "../context";

export type WebNodeListPages = {
  /** Remember the list a Next page run with `ran` (resolved) moved, where its answer `payload` says it moved one. */
  pagerAnswered(ran: JsonObject, payload: JsonValue | undefined): void;
  /** Remember the lists, by item selector, that a page turn the page showed had landed moved (header, t1096). */
  turned(items: readonly string[]): void;
  /** Whether a Next page of this build moved the list named by `item`. */
  wasMoved(item: string): boolean;
};

/** Lists remembered per build. */
const LISTS_PER_BUILD = 16;
/** Builds remembered per evidence runtime. */
const BUILDS = 16;

const memory = new WeakMap<object, Map<string, string[]>>();

/** The lists the build `run` belongs to moved with its own pager (header). */
export function webNodeListPages(run: Pick<WebNodeRun, "stores" | "request" | "sessionId">): WebNodeListPages {
  let builds = memory.get(run.stores.extractions);
  if (builds === undefined) {
    builds = new Map();
    memory.set(run.stores.extractions, builds);
  }
  const held = builds;
  const slot = `${webNodeBuildSlot(webNodeBuildOf(run.request).build)}\u0000${run.sessionId}`;
  const moved = (item: string): void => {
    const lists = [item, ...(held.get(slot) ?? []).filter((known) => known !== item)].slice(0, LISTS_PER_BUILD);
    held.delete(slot);
    held.set(slot, lists);
    while (held.size > BUILDS) held.delete(held.keys().next().value!);
  };
  return {
    pagerAnswered(ran, payload) {
      const request = ran.nextPage;
      const item = typeof request === "object" && request !== null && !Array.isArray(request) && typeof request.item === "string" ? request.item.trim() : undefined;
      if (item === undefined || webAutomationNextPageListMove(ran, payload)?.verdict !== "moved") return;
      moved(item);
    },
    turned(items) {
      for (const item of items) if (item.trim() !== "") moved(item.trim());
    },
    wasMoved(item) {
      return held.get(slot)?.includes(item.trim()) === true;
    }
  };
}
