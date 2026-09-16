// The four evidence items a page at rest cannot show, each with a test of its
// own: a dialog has to be opened, a native confirm has to be answered, a page
// has to be caught mid-load, and change and recency need two captures with an
// interaction between them.
//
// The rows asserted on a page at rest are in `page-evidence.spec.ts`.

import { expect, test } from "../../../index.js";
import { capture, evidenceOf } from "./captured-snapshot.js";

test("modal-flows: an open modal is reported with its role, name and modality", async ({ openHarness, page }) => {
  const harness = await openHarness("modal-flows");
  await page.locator("[data-testid=\"open-invite\"]").click();
  await expect(page.locator("[data-testid=\"invite-dialog\"]")).toBeVisible();

  const evidence = await evidenceOf(harness);
  expect(evidence.dialogs?.modal).toBe(true);
  expect(evidence.dialogs?.open).toEqual([
    expect.objectContaining({
      // The dialog carries an id, which is the most stable selector there is.
      selector: "#invite-dialog",
      role: "dialog",
      modal: true,
      native: false,
      label: "Invite a collaborator"
    })
  ]);
  // A modal makes the page behind it unreachable, and the occlusion test says so.
  expect(evidence.overlays?.blockedCount).toBeGreaterThan(0);
});

test("modal-flows: the native dialog the page-world override answered is carried as evidence", async ({ openHarness, page }) => {
  const harness = await openHarness("modal-flows");
  const before = await evidenceOf(harness);
  expect(before.dialogs?.lastNative).toBeUndefined();

  await harness.runAction({ commandId: "arm-accept", actionType: "web.dom.dialog", dialog: { response: "accept" } });
  await page.locator("[data-testid=\"delete-draft\"]").click();
  await expect(page.locator("[data-testid=\"draft-status\"]")).toHaveText("Draft deleted");

  const evidence = await evidenceOf(harness);
  expect(evidence.dialogs?.lastNative).toMatchObject({
    kind: "confirm",
    message: "Delete this draft? This cannot be undone.",
    response: "accept"
  });
  expect(evidence.dialogs?.lastNative?.at).toBeGreaterThan(0);
  // The arming was taken by the override on the dispatching call stack, so
  // nothing is left pending; a standing `armPending` would mean it is absent.
  expect(evidence.dialogs?.armPending).toBeUndefined();
  // A native dialog is not a page dialog: nothing was open in the DOM.
  expect(evidence.dialogs?.open).toEqual([]);
  expect(evidence.dialogs?.modal).toBe(false);
});

test("intermediate-state: a page caught mid-work reports itself busy with the indicator that says so", async ({ openHarness, page }) => {
  const harness = await openHarness("intermediate-state");
  await page.locator("[data-testid=\"employee-name\"]").fill("Ada Lovelace");
  await page.locator("[data-testid=\"claim-amount\"]").fill("42.50");
  await page.locator("[data-testid=\"submit-claim\"]").click();
  // The processing step stands for 800 ms before the result replaces it.
  await expect(page.locator("[data-testid=\"processing\"]")).toBeVisible();

  const evidence = await evidenceOf(harness);
  expect(evidence.loading.busy).toBe(true);
  expect(evidence.loading.indicators).toEqual(expect.arrayContaining([
    expect.objectContaining({ kind: "progressbar", label: "Processing your claim" })
  ]));
  // The step is a named region while it is on screen, so a reader can point at it.
  expect(evidence.regions).toEqual(expect.arrayContaining([
    expect.objectContaining({ role: "region", label: "Processing your claim" })
  ]));
});

test("infinite-feed: a region the page marks aria-busy is reported while it loads", async ({ openHarness, page }) => {
  const harness = await openHarness("infinite-feed");
  await page.evaluate(() => window.scrollTo(0, document.documentElement.scrollHeight));
  // The feed sets aria-busy and unhides its status before the 300 ms fetch
  // delay, so waiting on the page's own flag lands inside the loading window.
  await page.waitForFunction(() => document.querySelector("[data-testid=\"feed\"]")?.getAttribute("aria-busy") === "true");

  const evidence = await evidenceOf(harness);
  expect(evidence.loading.busy).toBe(true);
  expect(evidence.loading.busyRegions).toContain("[data-testid=\"feed\"]");
  expect(evidence.loading.indicators).toEqual(expect.arrayContaining([
    expect.objectContaining({ kind: "status", selector: "[data-testid=\"feed-loading\"]" })
  ]));
});

test("modal-flows: change and recency are fields of a running snapshot, not of a recording", async ({ openHarness, page }) => {
  const harness = await openHarness("modal-flows");
  // No recording is started anywhere in this test: before Phase 1.4 both
  // signals existed only while the recorder was listening, so a running action
  // could not see either.
  const first = await capture(harness);
  expect(first.evidence?.elements.changed).toBe(0);
  expect(first.interactiveElements.every((element) => element.changed === undefined)).toBe(true);

  await page.locator("[data-testid=\"add-section\"]").click();
  await expect(page.locator("[data-testid=\"section-count\"]")).toHaveText("1 section");

  const second = await capture(harness);
  expect(second.evidence?.elements.changed).toBeGreaterThan(0);
  expect(second.evidence?.elements.recentlyInteracted).toBeGreaterThan(0);

  const byTestId = (testId: string) => second.interactiveElements.find((element) => element.testId === testId);
  expect(byTestId("section-count")?.changed).toBe(true);
  expect(byTestId("add-section")?.recentlyInteracted).toBe(true);
  // The button's own text did not change, so recency and change are independent.
  expect(byTestId("add-section")?.changed).toBeUndefined();

  // And the run the click created is now a repeating structure the page had none of.
  await page.locator("[data-testid=\"add-section\"]").click();
  await page.locator("[data-testid=\"add-section\"]").click();
  await expect(page.locator("[data-testid=\"section-count\"]")).toHaveText("3 sections");
  const third = await evidenceOf(harness);
  expect(third.repeating?.[0]).toMatchObject({
    containerSelector: "[data-testid=\"section-list\"]",
    itemCount: 3,
    representative: { testId: "section-item", text: "Section 1" }
  });
});
