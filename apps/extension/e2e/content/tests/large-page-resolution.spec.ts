// Target resolution on a page bigger than any realistic site draws, in a real
// browser.
//
// The realistic sites are big for fixtures and small for applications: no
// candidate pool on them comes near the 600 the enumeration bound once was, so
// no site has ever reached a capacity bound in the resolution path
// (`reports/r-fixture-audit.md` §1). A real application page passes 600
// `CANDIDATE_SELECTOR` matches without trying -- `[role]` and `[tabindex]` alone
// cover every item of a design-system nav and every cell of a grid -- and the
// bound behaved badly there in a way nothing here could show.
//
// The rows below make the page big rather than making a new site: the page is
// a realistic one (Kestrel Lane's home page, which holds still) and the size is
// injected into it, so what is under test is the resolver at scale and not
// another page to keep in step. Injected interactive elements are anchors,
// which are in `CANDIDATE_SELECTOR` and are never in a recorded `button`'s
// family, so they consume the scan exactly as a real page's nav and grid do and
// can never win a resolution themselves. The first row uses the everything
// store instead, armed into a redesign of its notifications prompt, because it
// needs a control whose words changed while its name stood.
//
// What they pin, in order: that a control past the old bound is now found at
// all; that a scan a cap does cut short says so instead of reporting the page
// as empty; and that an ordinary page's diagnostic is unchanged.

import type { Page } from "@playwright/test";
import { expect, test } from "../index.js";
import type { ContentHarness } from "../index.js";
import { TARGET_NOT_FOUND, describe, labMutate, openPath, recordedElement } from "./identity-fixtures.js";

/** `MAX_SCANNED` in `content/identity/candidates.ts`. */
const SCAN_BOUND = 5_000;
/** Past the bound this module's defect was found at, and well inside the current one. */
const PAST_OLD_BOUND = 3_000;
/** The everything store's notifications prompt, by the name its heading gives it. */
const NOTIFICATIONS_PROMPT = "Never miss a deal";
/** Its "Not now" button as the store ships it, which is the recording's control. */
const SHIPPED_NOT_NOW = '[role="dialog"] button[data-choice="later"]';

/**
 * Interactive elements the resolver must walk past before it reaches the
 * page's own controls, prepended so they come first in document order -- the
 * shape of a real page's nav rail and left-hand grid.
 *
 * They are laid out rather than hidden. The family filter would count them
 * either way, but a hidden filler would make the page one no browser would
 * ever paint.
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

/**
 * Kestrel Lane's home page with its consent, newsletter offer and chat greeting
 * answered through the site's own operations: a realistic page with no sign-in
 * form on it (a missing target beside a password reads as a sign-in gate,
 * `auth_required`) and nothing that keeps redrawing.
 */
async function openQuietPage(openHarness: (scenarioId: string) => Promise<ContentHarness>): Promise<ContentHarness> {
  const harness = await openHarness("company-website");
  for (const [operation, payload] of [["set-consent", { choice: "essential" }], ["dismiss-newsletter", {}], ["dismiss-chat-greeting", {}]] as const) {
    const response = await fetch(`${harness.lab.origin}/api/company-website/${operation}`, {
      method: "POST",
      headers: { authorization: `Bearer ${harness.lab.runToken}`, "content-type": "application/json" },
      body: JSON.stringify(payload)
    });
    expect(response.ok, `${operation} answered ${response.status}`).toBe(true);
  }
  await harness.page.goto(new URL("/scenarios/company-website/", harness.lab.origin).href, { waitUntil: "load" });
  await expect.poll(async () => (await harness.messages()).some((message) => message.type === "fluxiq.contentReady")).toBe(true);
  return harness;
}

/** A recorded control that no exact strategy can answer, so enumeration decides what the failure says. */
const UNFINDABLE_BUTTON = {
  commandId: "unfindable",
  actionType: "web.dom.click",
  selector: "#no-such-control",
  options: { element: { selector: "#no-such-control", id: "no-such-control", tagName: "button" } }
} as const;

// The control is the everything store's notifications prompt answer "Not now",
// recorded on the prompt as it ships and replayed with the store armed into
// `reworded-prompt`: the redesign that moved the prompt onto a new component
// (new classes and id, the buttons in the other order) and redrew the answer as
// "Not right now", leaving "Not now" in its aria-label. Every signal an exact
// strategy looks a target up by is gone -- selector, xpath, class set, words --
// and only the accessible name stands, so the answer can only come from
// enumeration and scoring, with three thousand interactive elements in front of
// the control. `identity-resolution.spec.ts` measures the same kind of drift on
// a page of ordinary size.
test("a control past the old scan bound is enumerated and recovered, not reported missing", async ({ openHarness, page }) => {
  const harness = await openHarness("everything-store");
  await expect(page.getByRole("dialog", { name: NOTIFICATIONS_PROMPT })).toBeVisible({ timeout: 15_000 });
  const recorded = await describe(harness, SHIPPED_NOT_NOW);
  expect(recorded).toMatchObject({ tagName: "button" });

  // Arming starts the account over; the cookie banner and the app banner are
  // answered so that the prompt is the one thing the page puts in front of a
  // visitor, as it is when the recording was made.
  await labMutate(harness, "set-mode", { mode: "reworded-prompt" });
  await labMutate(harness, "consent", { choice: "accept" });
  await labMutate(harness, "dismiss-nudge", { nudge: "app-banner" });
  await openPath(harness);
  await expect(page.getByRole("dialog", { name: NOTIFICATIONS_PROMPT })).toBeVisible({ timeout: 15_000 });
  await expect(page.getByRole("button", { name: "Not now", exact: true })).toHaveText("Not right now");
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
  // The store records which answer the prompt got: the decline, not "Allow notifications" beside it.
  await expect
    .poll(async () => (await harness.finalState()).state)
    .toMatchObject({ mode: "reworded-prompt", nudges: { notifications: "dismissed" }, activity: expect.arrayContaining(["declined notifications"]) });
});

test("a scan the bound does cut short says so, rather than reporting the page as holding no such control", async ({ openHarness, page }) => {
  const harness = await openQuietPage(openHarness);
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
  const harness = await openQuietPage(openHarness);

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
// a 5,000-element page at each setting, `executeAction` round trip for the miss
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
