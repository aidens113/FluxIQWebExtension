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

import { expect, test } from "../../../index.js";
import type { ContentHarness } from "../../../index.js";

/** Sends one of the site's own state operations, as its page script does. */
async function mutate(harness: ContentHarness, operation: string, payload: Record<string, unknown> = {}): Promise<void> {
  const response = await fetch(`${harness.lab.origin}/api/${harness.scenarioId}/${operation}`, {
    method: "POST",
    headers: { authorization: `Bearer ${harness.lab.runToken}`, "content-type": "application/json" },
    body: JSON.stringify(payload)
  });
  if (!response.ok) throw new Error(`${harness.scenarioId} answered ${response.status} to ${operation}.`);
}

test("everything-store: the support chat's own button is not reported as blocked by the widget that holds it", async ({ openHarness, page }) => {
  // The store's support chat is a fixed bubble in the bottom-right corner,
  // inside an open shadow root on a host `div[data-chat-host]`. With cookies
  // and the nudges answered, as a returning shopper has them, it covers nothing.
  const harness = await openHarness("everything-store");
  await mutate(harness, "consent", { choice: "accept" });
  await mutate(harness, "dismiss-nudge", { nudge: "notifications" });
  await mutate(harness, "dismiss-nudge", { nudge: "app-banner" });
  await page.reload();
  await expect(page.getByRole("button", { name: "Chat with Brightaisle Assistant" })).toBeVisible();
  const snapshot = await harness.capture();

  // The button is described, with the chain that addresses it...
  const button = snapshot.interactiveElements.find((element) => element.accessibleName === "Chat with Brightaisle Assistant");
  expect(button?.context?.shadowHosts, "the widget's button is in the snapshot, addressed through its host").toHaveLength(1);
  const host = button!.context!.shadowHosts![0]!;
  await expect(page.locator(host)).toHaveAttribute("data-chat-host", "");
  // ...and the widget is not reported as covering it.
  const blockers = snapshot.evidence?.overlays?.blockers ?? [];
  expect(blockers.map((blocker) => blocker.selector)).not.toContain(host);
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
