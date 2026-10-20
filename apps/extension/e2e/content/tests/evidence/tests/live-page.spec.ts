// The four evidence items a page at rest cannot show, each with a test of its
// own: a dialog has to be opened, a native confirm has to be answered, a page
// has to be caught mid-load, and change and recency need two captures with an
// interaction between them.
//
// The rows asserted on a page at rest are in `page-evidence.spec.ts`.
//
// Every test runs on a realistic page. The native confirm is company-website's
// "Unsubscribe", armed with `confirm-unsubscribe`, which asks the browser's
// confirmation before an address leaves the list. Where a site's own
// interruptions would cover the control a test presses, they are answered
// first through the site's `/api` operations, as a returning visitor would
// already have answered them.

import { UNSUBSCRIBE_CONFIRM_TEXT } from "../../../../../../scenario-lab/src/scenarios/company-website/index.js";
import { expect, test } from "../../../index.js";
import type { ContentHarness } from "../../../index.js";
import { capture, evidenceOf } from "./captured-snapshot.js";

/** Sends one of the site's own state operations, as its page script does. */
async function mutate(harness: ContentHarness, operation: string, payload: Record<string, unknown> = {}): Promise<void> {
  const response = await fetch(`${harness.lab.origin}/api/${harness.scenarioId}/${operation}`, {
    method: "POST",
    headers: { authorization: `Bearer ${harness.lab.runToken}`, "content-type": "application/json" },
    body: JSON.stringify(payload)
  });
  if (!response.ok) throw new Error(`${harness.scenarioId} answered ${response.status} to ${operation}.`);
}

/** Opens a page of the scenario other than its start page, with the content script already installed. */
async function open(harness: ContentHarness, path: string): Promise<void> {
  await harness.page.goto(new URL(`/scenarios/${harness.scenarioId}/${path}`, harness.lab.origin).href);
}

test("auction-marketplace: an opened bid drawer is reported with its role, name and modality", async ({ openHarness, page }) => {
  const harness = await openHarness("auction-marketplace");
  await mutate(harness, "consent", { choice: "accepted" });
  await open(harness, "itm/226152268190");
  await page.getByRole("button", { name: "Place bid" }).click();
  await expect(page.getByRole("dialog", { name: "Place your bid" })).toBeVisible();

  const evidence = await evidenceOf(harness);
  expect(evidence.dialogs?.modal).toBe(true);
  expect(evidence.dialogs?.open).toEqual([
    expect.objectContaining({ role: "dialog", modal: true, native: false, label: "Place your bid" })
  ]);
  // The selector the evidence gives is the drawer itself.
  const selector = evidence.dialogs?.open[0]?.selector ?? "";
  await expect(page.locator(selector)).toHaveAttribute("role", "dialog");
  await expect(page.locator(selector)).toHaveAccessibleName("Place your bid");
  // A modal makes the page behind it unreachable, and the occlusion test says so.
  expect(evidence.overlays?.blockedCount).toBeGreaterThan(0);
});

test("company-website: the native confirm the page-world override answered is carried as evidence", async ({ openHarness, page }) => {
  const harness = await openHarness("company-website");
  // Arming starts a new visitor, so it goes first; then the visitor answers consent and the chat greeting and signs up.
  await mutate(harness, "set-mode", { mode: "confirm-unsubscribe" });
  await mutate(harness, "set-consent", { choice: "essential" });
  await mutate(harness, "dismiss-chat-greeting");
  await mutate(harness, "subscribe-newsletter", { email: "ada.synthetic@example.test" });
  await open(harness, "newsletter");
  await expect(page.locator("[data-unsubscribe]")).toHaveCount(1);
  const before = await evidenceOf(harness);
  expect(before.dialogs?.lastNative).toBeUndefined();

  await harness.runAction({ commandId: "arm-accept", actionType: "web.dom.dialog", dialog: { response: "accept" } });
  await page.locator("[data-unsubscribe]").click();
  // The page takes the row off in place, without a reload, so the override's record survives to be captured.
  await expect(page.getByRole("status")).toContainText("Unsubscribed.");
  await expect(page.locator("[data-unsubscribe]")).toHaveCount(0);

  const evidence = await evidenceOf(harness);
  expect(evidence.dialogs?.lastNative).toMatchObject({
    kind: "confirm",
    message: UNSUBSCRIBE_CONFIRM_TEXT,
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

test("everything-store: a cart caught mid-work reports itself busy with the progress bar that says so", async ({ openHarness, page }) => {
  const harness = await openHarness("everything-store");
  await mutate(harness, "consent", { choice: "accept" });
  await mutate(harness, "dismiss-nudge", { nudge: "notifications" });
  await mutate(harness, "dismiss-nudge", { nudge: "app-banner" });
  await open(harness, "cart");
  // The store's first "Save for later" of a session fails and keeps its
  // spinner for four seconds before offering "Try again".
  await page.locator("[data-action=\"save-for-later\"]").first().click();
  await expect(page.getByRole("progressbar", { name: "Updating" })).toBeVisible();

  const evidence = await evidenceOf(harness);
  expect(evidence.loading.busy).toBe(true);
  expect(evidence.loading.indicators).toEqual(expect.arrayContaining([
    expect.objectContaining({ kind: "progressbar", label: "Updating" })
  ]));
});

test("social-network-feed: a feed the page marks aria-busy is reported while it loads", async ({ openHarness, page }) => {
  const harness = await openHarness("social-network-feed");
  // The home page opens on skeletons with the feed marked busy; the first
  // batch replaces them at 700 ms, so waiting on the page's own flag lands
  // inside the loading window.
  await page.waitForFunction(() => document.querySelector("[role=feed]")?.getAttribute("aria-busy") === "true");

  const evidence = await evidenceOf(harness);
  expect(evidence.loading.busy).toBe(true);
  expect(evidence.loading.busyRegions).toHaveLength(1);
  await expect(page.locator(evidence.loading.busyRegions[0]!)).toHaveAttribute("role", "feed");
});

test("bigbox-retail: change and recency are fields of a running snapshot, not of a recording", async ({ openHarness, page }) => {
  const harness = await openHarness("bigbox-retail");
  await mutate(harness, "consent", { choice: "accept" });
  await mutate(harness, "dismiss-promo");
  await open(harness, "ip/valueridge-essentials-select-a-size-paper-towels/418830127");
  const plus = page.locator("span").filter({ hasText: /^\+$/u });
  const reviews = page.locator("section", { has: page.getByRole("heading", { name: "Customer reviews" }) }).locator("article");
  // The buy box goes live at 700 ms and the first three reviews arrive at 900 ms.
  await expect(plus).toBeVisible();
  await expect(reviews).toHaveCount(3);

  // No recording is started anywhere in this test: before Phase 1.4 both
  // signals existed only while the recorder was listening, so a running action
  // could not see either.
  const first = await capture(harness);
  expect(first.evidence?.elements.changed).toBe(0);
  expect(first.interactiveElements.every((element) => element.changed === undefined)).toBe(true);

  await plus.click();
  await expect(plus.locator("xpath=preceding-sibling::span[1]")).toHaveText("2");

  const second = await capture(harness);
  expect(second.evidence?.elements.changed).toBeGreaterThan(0);
  expect(second.evidence?.elements.recentlyInteracted).toBeGreaterThan(0);

  // The stepper reads minus, quantity, plus, in document order.
  const plusIndex = second.interactiveElements.findIndex((element) => element.tagName === "span" && element.text === "+");
  const pressed = second.interactiveElements[plusIndex];
  const quantity = second.interactiveElements[plusIndex - 1];
  expect(quantity).toMatchObject({ tagName: "span", text: "2", changed: true });
  expect(pressed?.recentlyInteracted).toBe(true);
  // The plus sign's own text did not change, so recency and change are independent.
  expect(pressed?.changed).toBeUndefined();

  // And the run the next press extends is reported at its new length.
  await page.getByRole("button", { name: "See more reviews" }).click();
  await expect(reviews).toHaveCount(6);
  const third = await evidenceOf(harness);
  const run = third.repeating?.find((candidate) => candidate.signature.startsWith("article"));
  expect(run).toMatchObject({ itemCount: 6 });
  // Its representative is the first review, named by its own heading.
  expect(await page.locator(run!.representative.selector!).evaluate((element) => element === element.parentElement?.firstElementChild)).toBe(true);
  expect(run?.representative.text).toContain(await reviews.first().locator("strong").innerText());
});
