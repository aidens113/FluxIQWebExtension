// Blocking-overlay evidence around widgets that live in an open shadow root.
//
// Since the snapshot began describing controls inside open shadow roots
// (`shadow-dom/`, run `run-mulwm2dc-0bd95f22`), those controls are candidates
// for the overlay hit test in `evidence/overlays.ts`. That test asked
// `document.elementFromPoint`, which answers with a widget's host rather than
// the button painted inside it, and `Node.contains`, which does not cross into
// a shadow root. So every control inside a fixed widget was reported as blocked
// by the widget that holds it: a chat launcher sitting in an empty corner
// produced a `blockedBy` on a page where nothing was covered, and the consent
// wall's own Accept, Reject and Manage were counted among the controls it
// covers. `blockedBy` reaches the model, so the defect was the model being told
// a page was obstructed by the very buttons it needed to press.

import type { Page } from "@playwright/test";
import { expect, test } from "../../../index.js";

/** A fixed corner widget with an open shadow root, holding one button and covering nothing of the page. */
async function addCornerWidget(page: Page): Promise<void> {
  await page.evaluate(() => {
    const host = document.createElement("corner-chat");
    host.setAttribute("style", "position:fixed;right:0;bottom:0;width:120px;height:44px;z-index:2147483000;display:block");
    const root = host.attachShadow({ mode: "open" });
    root.innerHTML = '<button style="width:100%;height:100%">Open chat</button>';
    document.body.append(host);
  });
}

test("a fixed widget's own button is not reported as blocked by the widget", async ({ openHarness, page }) => {
  const harness = await openHarness("product-catalog");
  await addCornerWidget(page);
  const snapshot = await harness.capture();

  // The button is described, with the chain that addresses it...
  const button = snapshot.interactiveElements.find((element) => element.accessibleName === "Open chat");
  expect(button, "the widget's button is in the snapshot").toMatchObject({ context: { shadowHosts: ["body > corner-chat"] } });
  // ...and the widget is not reported as covering it.
  const blockers = snapshot.evidence?.overlays?.blockers ?? [];
  expect(blockers.map((blocker) => blocker.selector)).not.toContain("body > corner-chat");
  for (const blocker of blockers) expect(blocker.blocked ?? []).not.toContain(button!.selector);
});

test("job-board: the consent wall is the blocker, and none of its own buttons is counted among what it blocks", async ({ openHarness }) => {
  const harness = await openHarness("job-board");
  const snapshot = await harness.capture();
  const wallControls = snapshot.interactiveElements.filter((element) => element.context?.shadowHosts?.[0] === "body > rf-consent");
  expect(wallControls.map((element) => element.accessibleName)).toEqual(expect.arrayContaining(["Accept all", "Reject non-essential", "Manage choices"]));

  const blocker = snapshot.evidence?.overlays?.blockers[0];
  expect(blocker, "the wall covers the page").toMatchObject({ selector: "body > rf-consent" });
  for (const control of wallControls) expect(blocker?.blocked ?? []).not.toContain(control.selector);
});
