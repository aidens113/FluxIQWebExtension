// A step's readiness waits for the page to be drawn, not for a real site's network to go quiet (t1094).
//
// local-classifieds' pages make the background traffic real sites make
// (`apps/scenario-lab/src/scenarios/local-classifieds/client/background-script.ts`): an analytics beacon every
// 0.6-0.9 s, each scheduled by a fresh closure after the last one answered, and a long poll for messages. The Lab's
// server cannot hold a request open, so this spec holds the long poll itself, as a real server does. Neither changes
// the document.
//
// The readiness question here is the function the worker injects into the tab after a load (`waitForTabReady`,
// `runtime/navigation-events/page-work.ts`) and the content script calls after an address moved in place
// (`content/action-runtime/page-work/`): `shared/scheduled-work-settled.ts`, run with the window's own timers, as it
// runs in its own world in the browser (`e2e/content/harness.ts`). Before t1094 it waited on every request and every
// timer a fresh closure set, so on this page it ran to the worker's 20 s deadline every time; the report
// (`docs/working/page-diff-delivery-plan/reports/t1094.md`) has that run.
//
// The two pages its waits were built for must still be waited for: the listing whose panel a timer then a request
// draws (t891), and the sort that rewrites the address, clears the results, waits and requests the new ones (t893).

import type { Page, Route } from "@playwright/test";
import { CLASSIFIEDS_ROOT, listingByKey, OFFER_LISTING_KEY } from "../../../../../../scenario-lab/src/scenarios/local-classifieds/index.js";
import { listingPath } from "../../../../../../scenario-lab/src/scenarios/local-classifieds/view/index.js";
import { PAGE_WORK_BUSY_EVENT, PAGE_WORK_DRAINED_EVENT, PAGE_WORK_HORIZON_MS, PAGE_WORK_WATCHED_EVENT } from "../../../../../src/shared/scheduled-work-event.js";
import { pageSettledInPage } from "../../../../../src/shared/scheduled-work-settled.js";
import { expect, test } from "../../../index.js";
import type { ContentHarness } from "../../../index.js";

/** The worker's readiness deadline (`runtime/automation-tab.ts`): what the old wait ran to on this page. */
const DEADLINE_MS = 20_000;
/** Settling "at once" on a page that only makes background traffic: well inside the horizon-and-a-bit the rule allows. */
const AT_ONCE_MS = 2_500;
const ROOT = CLASSIFIEDS_ROOT;

type Answer = { settled: boolean; ms: number; busyRegions: number; results: number; skeletons: number; address: string };

test.describe.configure({ timeout: 120_000 });

/**
 * Asks the page the worker's readiness question, with the window's own timers (`harness.ts` keeps them), after
 * running `before` in the same task, and reads what the page shows the moment it answers.
 */
async function askReadiness(page: Page, before = ""): Promise<Answer> {
  const expression = `(() => {
    const kept = window.__fluxiqContentHarnessSchedulers;
    return (function (setTimeout, clearTimeout) {
      const ask = (${pageSettledInPage.toString()});
      ${before}
      const started = performance.now();
      const bound = new Promise((resolve) => setTimeout(() => resolve(false), ${DEADLINE_MS + 1_000}));
      const asked = ask(${JSON.stringify(PAGE_WORK_WATCHED_EVENT)}, ${JSON.stringify(PAGE_WORK_BUSY_EVENT)}, ${JSON.stringify(PAGE_WORK_DRAINED_EVENT)}, { withinMs: ${DEADLINE_MS} });
      return Promise.race([asked, bound]).then((settled) => {
        const grid = document.querySelector('section[aria-label="Collection of Marketplace items"]');
        return {
          settled,
          ms: Math.round(performance.now() - started),
          busyRegions: document.querySelectorAll('[aria-busy="true"]').length,
          results: grid ? grid.querySelectorAll('a[href*="/item/"]').length : -1,
          skeletons: document.querySelectorAll('[class*="skeleton"]').length,
          address: location.pathname + location.search
        };
      });
    })(kept.setTimeout, kept.clearTimeout);
  })()`;
  return await page.evaluate(expression) as Answer;
}

/** Holds every long-poll request open, as a server with nothing to say does; released when the test ends. */
async function holdLongPoll(page: Page): Promise<{ held(): number; release(): Promise<void> }> {
  const routes: Route[] = [];
  await page.route("**/scenarios/local-classifieds/updates.json*", (route) => { routes.push(route); });
  return {
    held: () => routes.length,
    release: async () => {
      await page.unrouteAll({ behavior: "ignoreErrors" });
      await Promise.all(routes.map((route) => route.fulfill({ status: 200, contentType: "application/json", body: "{\"messages\":[],\"since\":0}" }).catch(() => undefined)));
    }
  };
}

/** How many beacons reached the Lab, as its own request counter says. */
async function beacons(harness: ContentHarness): Promise<number> {
  const response = await fetch(`${harness.lab.origin}/__control/requests?path=${encodeURIComponent(`${ROOT}collect`)}`, {
    headers: { authorization: `Bearer ${harness.lab.runToken}` }
  });
  const body = await response.json() as { count?: number };
  return body.count ?? 0;
}

test("a page that only makes background traffic is ready at once, after a load and when idle", async ({ openHarness, page }, testInfo) => {
  const poll = await holdLongPoll(page);
  const harness = await openHarness("local-classifieds");
  try {
    const afterLoad = await askReadiness(page);
    await expect.poll(() => beacons(harness), { message: "the beacon keeps beating" }).toBeGreaterThanOrEqual(3);
    expect(poll.held(), "the long poll is out and held").toBeGreaterThanOrEqual(1);
    const idle = await askReadiness(page);
    await page.reload();
    const afterReload = await askReadiness(page);
    testInfo.annotations.push({ type: "readiness", description: JSON.stringify({ afterLoad, idle, afterReload }) });
    console.log(`t1094 background traffic: after load ${afterLoad.ms} ms, idle ${idle.ms} ms, after reload ${afterReload.ms} ms`);
    for (const answer of [afterLoad, idle, afterReload]) {
      expect(answer.settled, "settled on the page's word, not the deadline").toBe(true);
      expect(answer.ms).toBeLessThan(AT_ONCE_MS);
    }
    expect(poll.held(), "the reloaded page's long poll is held too").toBeGreaterThanOrEqual(2);
  } finally {
    await poll.release();
  }
});

test("t891 still waited for: a listing's panel, drawn by a timer then a request, is there when the page is ready", async ({ openHarness, page }) => {
  const poll = await holdLongPoll(page);
  const harness = await openHarness("local-classifieds");
  try {
    await page.goto(new URL(listingPath(listingByKey(OFFER_LISTING_KEY)!), harness.lab.origin).href);
    const answer = await askReadiness(page);
    console.log(`t1094 listing panel: ready after ${answer.ms} ms, busy regions ${answer.busyRegions}`);
    expect(answer.settled).toBe(true);
    expect(answer.busyRegions, "the panel's skeleton is gone").toBe(0);
  } finally {
    await poll.release();
  }
});

test("t893 still waited for: a sort that rewrites the address shows its new results when the page is ready", async ({ openHarness, page }) => {
  const poll = await holdLongPoll(page);
  const harness = await openHarness("local-classifieds");
  try {
    await page.goto(new URL(`${ROOT}search/?query=dining+table`, harness.lab.origin).href);
    await expect(page.locator('section[aria-label="Collection of Marketplace items"] a[href*="/item/"]').first()).toBeAttached();
    // As in a Flow, the step before the sort found the page ready; the long poll that page began has let go by then.
    expect((await askReadiness(page)).settled).toBe(true);
    // The sort is chosen in the same task the question is asked in, so nothing the page does in between is missed.
    const sort = `
      const box = document.querySelector('[role="combobox"]');
      box.click();
      const option = Array.from(document.querySelectorAll('[role="option"]')).find((node) => node.textContent.trim() === 'Price: lowest first');
      option.click();
      const cleared = document.querySelector('section[aria-label="Collection of Marketplace items"]').querySelectorAll('a[href*="/item/"]').length;
      if (cleared !== 0) throw new Error('the sort did not clear the results first: ' + cleared);
    `;
    const answer = await askReadiness(page, sort);
    console.log(`t1094 sort: ready after ${answer.ms} ms at ${answer.address}, ${answer.results} results, ${answer.skeletons} skeletons`);
    expect(answer.settled).toBe(true);
    expect(answer.address).toContain("sortBy=price_ascend");
    expect(answer.results, "the sorted results are drawn").toBeGreaterThan(0);
    expect(answer.ms, "the page's own delay and request, not a horizon for the background traffic").toBeLessThan(PAGE_WORK_HORIZON_MS + 500);
  } finally {
    await poll.release();
  }
});
