// The pace consulted before a navigation FluxIQ performs (`web.browser.navigate`,
// which is also how a dry run resets its page): the worker books the load on the
// destination's origin and waits out the booking itself, since it is the one
// about to load the page. A destination that is not an http or https address is
// not paced.

import type { OriginPace } from "./origin-pace";
import { PaceTally } from "./pace-tally";
import { originOf } from "./page-origin";

export async function paceNavigation(pace: OriginPace, url: string, pause: (ms: number) => Promise<void> = sleep): Promise<PaceTally> {
  const tally = new PaceTally();
  const origin = originOf(url);
  if (origin === undefined) return tally;
  const waitMs = pace.reserve(origin);
  tally.booked(waitMs, pace.spacingOf(origin));
  if (waitMs > 0) await pause(waitMs);
  return tally;
}

function sleep(ms: number): Promise<void> {
  return new Promise((resolve) => { setTimeout(resolve, ms); });
}
