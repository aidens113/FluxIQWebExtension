// The pace against a limiter shaped like the everything store's: more than five
// results pages in eight seconds is refused with a 429, a refused request is not
// counted, and the third refusal in a session flags it for a robot check
// (`apps/scenario-lab/src/scenarios/everything-store/state/throttle.ts`). This is
// what live run `run-muntc23v-7fcc4110` met: the model re-ran a five-page read
// about ten times, back to back, and each dry run replayed it again.
//
// Time is simulated. A read is what the extension does: a dry-run reset
// navigates to the first results page (booked and waited out by the worker),
// then four `next` loads, each booked by the page before it follows the control
// (`content/extraction/pagination.ts`). A load that lands on a 429 is told to
// the pace, waited out for 8.5 s and reloaded through the pace, and a read
// stops at its second 429 rather than risk a third, exactly as the page does. A
// refusal on a navigation is not told to the pace, because nothing reads a
// navigation's status. The pages here come 300 ms apart and the reads 1 s
// apart, several times faster than the live run, so only the pace spaces them.
//
// Each case also runs without the pace, and that run must end flagged: it is
// what shows the case would fail without the fix.

import assert from "node:assert/strict";
import test from "node:test";
import { OriginPace } from "../origin-pace";
import { PAGE_LOAD_PACE_SETTINGS } from "../pace-settings";

const STORE = "http://127.0.0.1:4173";
const PAGE_MS = 300;
const BETWEEN_READS_MS = 1_000;
const REFUSED_PAGE_WAIT_MS = 8_500;

/** The store's limiter: five results pages in eight seconds, refusals not counted, flagged at the third. */
class StoreLimiter {
  private readonly served: number[] = [];
  refusals = 0;
  flagged = false;

  request(at: number): "served" | "refused" | "robot_check" {
    if (this.flagged) return "robot_check";
    if (this.served.filter((time) => time > at - 8_000 && time <= at).length >= 5) {
      this.refusals += 1;
      if (this.refusals >= 3) this.flagged = true;
      return "refused";
    }
    this.served.push(at);
    return "served";
  }
}

type Pace = Pick<OriginPace, "reserve" | "noteRefusal">;

const NO_PACE: Pace = { reserve: () => 0, noteRefusal: () => false };

type Session = {
  clock: { now: number };
  limiter: StoreLimiter;
  pace: Pace;
  /** Loads on the store FluxIQ does not make, one every this often from the start, or none. */
  foreign?: { everyMs: number; nextAt: number } | undefined;
};

function session(pace: "paced" | "unpaced" | Pace, foreignEveryMs?: number): Session {
  const clock = { now: 0 };
  const chosen = pace === "paced" ? new OriginPace(PAGE_LOAD_PACE_SETTINGS, () => clock.now) : pace === "unpaced" ? NO_PACE : pace;
  return { clock, limiter: new StoreLimiter(), pace: chosen, foreign: foreignEveryMs === undefined ? undefined : { everyMs: foreignEveryMs, nextAt: 0 } };
}

/** One load FluxIQ makes: booked on the pace, waited out, then asked of the store after any foreign load due before it. */
function pacedLoad({ clock, limiter, pace, foreign }: Session): ReturnType<StoreLimiter["request"]> {
  clock.now += pace.reserve(STORE);
  for (; foreign !== undefined && foreign.nextAt <= clock.now; foreign.nextAt += foreign.everyMs) limiter.request(foreign.nextAt);
  return limiter.request(clock.now);
}

/** A five-page read begun by a dry-run reset; answers how it ended. */
function read(store: Session): "read" | "stopped" | "robot_check" {
  const landed = pacedLoad(store);
  if (landed === "robot_check") return "robot_check";
  store.clock.now += PAGE_MS;
  for (let page = 2, rateLimits = 0; page <= 5; page += 1) {
    let answer = pacedLoad(store);
    while (answer === "refused") {
      store.pace.noteRefusal(STORE, 429);
      rateLimits += 1;
      if (rateLimits >= 2) return "stopped";
      store.clock.now += REFUSED_PAGE_WAIT_MS;
      answer = pacedLoad(store);
    }
    if (answer === "robot_check") return "robot_check";
    store.clock.now += PAGE_MS;
  }
  return "read";
}

/** Ten of the model's reads, each followed by a dry run that replays it. */
function tenReadsWithReplays(store: Session): string[] {
  const endings: string[] = [];
  for (let run = 0; run < 20; run += 1) {
    endings.push(read(store));
    store.clock.now += BETWEEN_READS_MS;
  }
  return endings;
}

test("ten back-to-back five-page reads and their dry-run replays are never refused on a paced origin", () => {
  const paced = session("paced");
  const endings = tenReadsWithReplays(paced);
  assert.equal(paced.limiter.refusals, 0);
  assert.equal(paced.limiter.flagged, false);
  assert.deepEqual(new Set(endings), new Set(["read"]));

  const unpaced = session("unpaced");
  tenReadsWithReplays(unpaced);
  assert.equal(unpaced.limiter.flagged, true, "without the pace the same reads flag the session");
});

test("after a refusal the origin slows, and across ten reads and their replays the session is never flagged", () => {
  // Beside FluxIQ's reads the store also serves a load FluxIQ does not make
  // every 4 s -- someone else on the site, a click that submits a search, the
  // page's own requests. Two of those in a window beside three paced loads is
  // the sixth request, so the base spacing alone draws a refusal; only an
  // origin that slows after it keeps the session from its third.
  const paced = session("paced", 4_000);
  const endings = tenReadsWithReplays(paced);
  assert.ok(paced.limiter.refusals <= 1, `${paced.limiter.refusals} refusals`);
  assert.equal(paced.limiter.flagged, false);
  assert.equal((paced.pace as OriginPace).spacingOf(STORE), 2 * PAGE_LOAD_PACE_SETTINGS.spacingMs, "the origin is paced slower for the rest of the session");
  assert.deepEqual(new Set(endings), new Set(["read"]));

  // The same pace with the cool-down taken out: spaced, but never slower.
  const clock = { now: 0 };
  const uncooled = new OriginPace(PAGE_LOAD_PACE_SETTINGS, () => clock.now);
  const spacedOnly = session({ reserve: (origin) => uncooled.reserve(origin), noteRefusal: () => false }, 4_000);
  spacedOnly.clock = clock;
  tenReadsWithReplays(spacedOnly);
  assert.equal(spacedOnly.limiter.flagged, true, "spacing alone, never slowed by a refusal, lets the session be flagged");

  const unpaced = session("unpaced", 4_000);
  tenReadsWithReplays(unpaced);
  assert.equal(unpaced.limiter.flagged, true, "without the pace the same session is flagged");
});
