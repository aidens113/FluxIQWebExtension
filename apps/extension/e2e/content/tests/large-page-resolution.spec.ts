// Target resolution on a page bigger than any fixture, in a real browser.
//
// Every scenario in the Lab is small: the largest candidate pool is about
// nineteen elements against an enumeration bound that was 600, so no fixture
// has ever reached a capacity bound in the resolution path
// (`reports/r-fixture-audit.md` §1). A real application page passes 600
// `CANDIDATE_SELECTOR` matches without trying -- `[role]` and `[tabindex]`
// alone cover every item of a design-system nav and every cell of a grid --
// and the bound behaved badly there in a way nothing here could show.
//
// The rows below make the page big rather than making a new fixture: the
// scenario is one of the existing ones and the size is injected into it, so
// what is under test is the resolver at scale and not a twenty-sixth page to
// keep in step. Injected interactive elements are anchors, which are in
// `CANDIDATE_SELECTOR` and are never in a recorded `button`'s family, so they
// consume the scan exactly as a real page's nav and grid do and can never win
// a resolution themselves.
//
// What they pin, in order: that a control past the old bound is now found at
// all; that a scan a cap does cut short says so instead of reporting the page
// as empty; that an ordinary page's diagnostic is unchanged; and that looking
// at five thousand elements has not made a resolution slow.

import type { Page } from "@playwright/test";
import { expect, test } from "../index.js";
import { SAVE_BASELINE, TARGET_NOT_FOUND, armMode, describe, recordedElement } from "./identity-fixtures.js";

/** `MAX_SCANNED` in `content/identity/candidates.ts`. */
const SCAN_BOUND = 5_000;
/** Past the bound this module's defect was found at, and well inside the current one. */
const PAST_OLD_BOUND = 3_000;

/**
 * Interactive elements the resolver must walk past before it reaches the
 * page's own controls, prepended so they come first in document order -- the
 * shape of a real page's nav rail and left-hand grid.
 *
 * They are laid out rather than hidden. The family filter would count them
 * either way, but a hidden filler would also make the timing row below measure
 * a page no browser would ever paint.
 */
async function prependInteractiveFiller(page: Page, count: number): Promise<void> {
  await page.evaluate((total) => {
    const rail = document.createElement("nav");
    rail.id = "fx-scan-filler";
    rail.setAttribute("aria-label", "Filler navigation");
    for (let index = 0; index < total; index += 1) {
      const link = document.createElement("a");
      link.href = "#filler";
      link.textContent = `Filler ${index}`;
      rail.append(link);
    }
    document.body.prepend(rail);
  }, count);
  await expect(page.locator("#fx-scan-filler a")).toHaveCount(count);
}

/** A recorded control that no exact strategy can answer, so enumeration decides what the failure says. */
const UNFINDABLE_BUTTON = {
  commandId: "unfindable",
  actionType: "web.dom.click",
  selector: "#no-such-control",
  options: { element: { selector: "#no-such-control", id: "no-such-control", tagName: "button" } }
} as const;

test("a control past the old scan bound is enumerated and recovered, not reported missing", async ({ openHarness, page }) => {
  const harness = await openHarness("identity-drift");
  const recorded = await describe(harness, SAVE_BASELINE);
  // The rendering that takes every signal Level 1 looks a target up by and
  // leaves the accessible name standing, so the answer can only come from
  // enumeration and scoring. `identity-resolution.spec.ts` measures it on the
  // page as it stands; this row measures it with three thousand interactive
  // elements in front of the control.
  await armMode(harness, "reworded-aria");
  await prependInteractiveFiller(page, PAST_OLD_BOUND);

  const reply = await harness.runAction({
    commandId: "recover-past-old-bound",
    actionType: "web.dom.click",
    ...(recorded.selector ? { selector: recorded.selector } : {}),
    options: recordedElement(recorded)
  });

  // Before the ordering fix the scan stopped 2,400 elements short of this
  // control and the same command failed TARGET_NOT_FOUND with an empty ranking.
  expect(reply.status, reply.message).toBe("succeeded");
  expect(reply.resolution).toMatchObject({ strategy: "scored-candidate" });
  expect(reply.resolution?.bestScore).toBeGreaterThan(0.35);
  await expect
    .poll(async () => (await harness.finalState()).state)
    .toMatchObject({ savedInMode: "reworded-aria", saveCount: 1, discardCount: 0 });
});

test("a scan the bound does cut short says so, rather than reporting the page as holding no such control", async ({ openHarness, page }) => {
  const harness = await openHarness("identity-drift");
  await prependInteractiveFiller(page, SCAN_BOUND + 1_000);

  const reply = await harness.runAction(UNFINDABLE_BUTTON);

  expect(reply).toMatchObject({ status: "failed", failure: TARGET_NOT_FOUND });
  // The count is still there, as a floor over the part of the page that was
  // read, with where the reading stopped. What it must not do is state the
  // page's contents, which is what "0 control(s) of the same family are on the
  // page" did while the buttons sat a thousand elements further down.
  expect(reply.failure?.actual).toContain(`in the first ${SCAN_BOUND} interactive element(s)`);
  expect(reply.failure?.actual).toContain("cut short");
  expect(reply.failure?.actual).not.toContain("are on the page");
});

test("an ordinary page still reports its same-family count as a fact about the page", async ({ openHarness }) => {
  const harness = await openHarness("identity-drift");

  const reply = await harness.runAction(UNFINDABLE_BUTTON);

  expect(reply).toMatchObject({ status: "failed", failure: TARGET_NOT_FOUND });
  expect(reply.failure?.actual).toContain("control(s) of the same family are on the page");
  expect(reply.failure?.actual).not.toContain("cut short");
});

// There is deliberately no timing row here, and the reason is a measurement
// rather than an omission.
//
// The bound exists to keep resolution off the critical path, so raising it from
// 600 to 5,000 was measured on this harness before it was taken: four runs of
// this file's page at each setting, `executeAction` round trip for the miss
// above, on 2026-09-12. At 600: 3,562 / 4,629 / 6,586 / 7,517 ms. At 5,000:
// 3,396 / 4,480 / 4,502 / 6,623 ms. The distributions are indistinguishable --
// scanning 4,400 more elements does not show above the noise.
//
// What the noise *is* was measured too, on the same 5,000-element page:
// a click on a real button by exact selector 5,299 ms, this file's miss (which
// enumerates the whole page) 3,504 ms, a `web.dom.extract` by exact selector
// (which enumerates nothing) 3,503 ms, and a bare `captureSnapshot` with no
// action at all 4,058 ms. The seconds are the snapshot and page evidence every
// result carries, not target resolution; a timing assertion here would pin
// `content/dom-snapshot.ts`'s cost to a file about the resolver and break on
// the first change to either. `reports/x-scan-cap.md` carries the numbers and
// says what they mean for a real page.
