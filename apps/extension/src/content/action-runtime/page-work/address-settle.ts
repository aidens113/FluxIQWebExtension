// An action on a page whose address moved in place waits for the page's redraw
// first (task speed S10, t893).
//
// The worker's readiness proof (`runtime/automation-tab.ts` `readyFromSnapshot`)
// used to be dropped by any navigation event of the tab, an address the page
// rewrote in place (`history.pushState`) included, and the next action then
// waited in the worker for the page to settle: an injected question to the
// page, and 80-200 ms before replayed presses on local-classifieds after its
// radius and sort rewrote the address (`run-mwaqjkxp-ae3d862c`, s9-s11). The
// proof now follows its document across such a move, so the wait the move
// still needs is made here, where it costs nothing when the page is idle: the
// page that rewrote its address is often still drawing what the new address
// says -- local-classifieds clears its results, rewrites the address and
// fetches the new ones -- and a look taken in between saw a list that was not
// there (t891's sorted list).
//
// This script remembers the address it last found the page settled at: every
// action notes the address it starts on. An action that finds the address
// moved since waits until the page world says the page's work is done
// (`./page-quiet.ts`). Where no page world can say, the address must stand
// still for the second the worker's old clock gave it. A new document starts a
// new script with nothing remembered: the worker's own wait covers a document
// that replaced the last one. The wait is bounded by the worker's readiness
// deadline, which it replaces; a wait that ran out proves nothing, and the
// next action asks again.

import { askPageQuiet } from "./page-quiet";

/** What an action's start found: no move, a move the page finished, a move whose address then stood still, or the deadline. */
export type AddressSettle = "unmoved" | "settled" | "still" | "deadline";

/** The worker's readiness deadline (`runtime/automation-tab.ts` `waitForTabReady`), which this wait takes the place of for a move in place. */
export const ADDRESS_SETTLE_DEADLINE_MS = 20_000;
/** How long an address must stand still where nothing can speak for the page: the worker's old clock. */
const ADDRESS_STILL_MS = 1_000;

let settledAt: string | undefined;

/** Waits, at an action's start, for the page to settle when its address moved in place since the last action; see the header. */
export async function settleAddressMove(deadlineMs: number = ADDRESS_SETTLE_DEADLINE_MS): Promise<AddressSettle> {
  const href = currentAddress();
  if (href === undefined) return "unmoved";
  if (settledAt === undefined || settledAt === href) {
    settledAt = href;
    return "unmoved";
  }
  const endsAt = Date.now() + deadlineMs;
  const quiet = askPageQuiet(endsAt);
  const outcome: AddressSettle = await quiet.settled ? "settled" : await addressStill(endsAt);
  if (outcome !== "deadline") settledAt = currentAddress();
  return outcome;
}

/** For a unit test: forget the address, as a new document's script starts. */
export function forgetSettledAddressForTest(): void {
  settledAt = undefined;
}

/** Waits for the address to stand still `ADDRESS_STILL_MS`, or for `endsAt`. */
async function addressStill(endsAt: number): Promise<AddressSettle> {
  let seen = currentAddress();
  for (;;) {
    const wait = Math.min(ADDRESS_STILL_MS, endsAt - Date.now());
    if (wait <= 0) return "deadline";
    await new Promise<void>((resolve) => { setTimeout(resolve, wait); });
    const now = currentAddress();
    if (now === seen && wait === ADDRESS_STILL_MS) return "still";
    seen = now;
  }
}

function currentAddress(): string | undefined {
  return typeof location === "undefined" || typeof location.href !== "string" ? undefined : location.href;
}
