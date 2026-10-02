// A target behind a dialog, against live pages: which refusals are the page in
// a state the runtime clears for itself, and which are a challenge only a
// person may answer.
//
// The line (`src/content/action-runtime/blocking-dialog.ts`) is drawn on what
// the page declares, never on which site it is. A dialog standing over the page
// is `web.action.blocked_by_dialog` -- Core's `unexpected_state` -- unless it
// asks for what only a person can give: a robot check, a password or
// verification code, a payment confirmation. Those, and a page that is itself a
// robot check, are `web.intervention.required`, which Core never offers to a
// model.
//
// **What this file is for now.** The dismissible half of that line stopped
// being observable here on 2026-09-28, when the runtime gained the defence that
// closes such a dialog and runs the action again: those pages now *succeed*,
// and `dialog-dismissal.spec.ts` owns them. What stays here is everything that
// must still stop -- the person's challenges, a page that is itself one, and an
// overlay that is not a dialog at all -- because the value of the classification
// is now almost entirely in what it refuses to clear.
//
// Until 2026-09-21 every painted modal was `web.intervention.required`. Live on
// the auction marketplace, the app promotion that opens a few seconds after a
// page loads -- it has its own "Not now" -- stopped a replayed Flow at its first
// press, and Core, correctly for that category, refused to ask the model how to
// get past it. That promotion is now closed by the runtime without anybody
// being asked (`dialog-dismissal.spec.ts`).
//
// Rows, by fixture:
//   - everything-store: the robot check the store serves in place of every
//     page, which must stay the person's and be left untouched.
//   - modal-flows: the consent banner, which is not a dialog and stays an
//     ordinary refusal; and challenge dialogs added to a page -- a robot check,
//     a password or code prompt, and a card form or payment confirmation inside
//     an aria-modal dialog are the person's even when the dialog also offers a
//     way out, while the same dialog with none of them is not.
//
// Scope: this is the content script's own decision against a live DOM. What
// Core does with each category is Core's; the Lab's replay and repair runs are
// the end-to-end proof.
import { WEB_AUTOMATION_FAILURE_CODES } from "@fluxiq-web-extension/domain/client";
import type { Page } from "@playwright/test";
import { expect, test } from "../index.js";
import type { ContentHarness } from "../index.js";

const NEEDS_PERSON = {
  category: "user_intervention_required",
  code: WEB_AUTOMATION_FAILURE_CODES.USER_INTERVENTION_REQUIRED,
  retryable: false,
  stage: "execution"
};

/** Applies one Scenario Lab operation to the harness's scenario, then reloads so the page renders the new state. */
async function applyAndReload(harness: ContentHarness, operation: string, payload: object = {}): Promise<void> {
  const response = await fetch(`${harness.lab.origin}/api/${harness.scenarioId}/${operation}`, {
    method: "POST",
    headers: { authorization: `Bearer ${harness.lab.runToken}`, "content-type": "application/json" },
    body: JSON.stringify(payload)
  });
  expect(response.ok, `${operation} answered ${response.status}`).toBe(true);
  await harness.page.goto(harness.url);
  await expect
    .poll(async () => (await harness.messages()).some((message) => message.type === "fluxiq.contentReady"))
    .toBe(true);
}

/** Opens an aria-modal dialog over the page holding `inner`, as a page's own script would. */
async function openDialog(page: Page, inner: string): Promise<void> {
  await page.evaluate((html) => {
    const scrim = document.createElement("div");
    scrim.setAttribute("style", "position:fixed;inset:0;z-index:2147483000;display:grid;place-items:center;background:rgb(0 0 0 / .5)");
    scrim.innerHTML = `<div role="dialog" aria-modal="true" aria-label="Test dialog" style="background:#fff;padding:24px;width:360px">${html}</div>`;
    document.body.append(scrim);
  }, inner);
}

test.describe("everything-store", () => {
  test("the robot check served in place of the page stays the person's, and nothing touches it", async ({ openHarness, page }) => {
    const harness = await openHarness("everything-store");
    await applyAndReload(harness, "set-mode", { mode: "robot-check" });
    await expect(page.getByTestId("robot-check")).toBeVisible();

    // A replayed Flow's first press: the cookie banner's Accept, which the challenge replaced.
    const reply = await harness.runAction({ commandId: "accept-on-challenge", actionType: "web.dom.click", selector: '[data-consent="accept"]', timeoutMs: 1_000 });

    expect(reply).toMatchObject({ status: "failed", failure: NEEDS_PERSON });
    expect(reply.failure?.actual).toMatch(/; the document is a robot check, which only a person can answer$/u);
    // No guess was typed and no new image was asked for.
    await expect(page.getByTestId("robot-check-error")).toHaveCount(0);
  });
});

test.describe("modal-flows", () => {
  const ADD_SECTION = "[data-testid=\"add-section\"]";
  const PUBLISH = "[data-testid=\"publish-draft\"]";

  test("an overlay that is not a dialog stays a rejection, and a dialog the page is not painting does not count", async ({ openHarness }) => {
    const harness = await openHarness("modal-flows");

    // The consent banner is fixed over the action bar and owns the primary
    // action, but it declares no dialog, makes nothing inert, and offers no way
    // out but a choice about cookies. Meanwhile the invite dialog is in the
    // markup with `aria-modal="true"` and `hidden`.
    const reply = await harness.runAction({ commandId: "click-under-banner", actionType: "web.dom.click", selector: PUBLISH });

    expect(reply).toMatchObject({
      status: "failed",
      failure: { category: "unexpected_state", code: WEB_AUTOMATION_FAILURE_CODES.TARGET_NOT_ACTIONABLE, retryable: false, stage: "execution" }
    });
    expect(reply.failure?.actual).toMatch(/^covered: /u);
    expect(reply.message).toMatch(/^Action rejected: /u);
    expect((await harness.finalState()).state).toMatchObject({ publishCount: 0 });
  });

  const CHALLENGES: Array<[string, string, string]> = [
    ["a robot check", "<h2>Security check</h2><p>Type the characters you see in the image.</p><canvas role=\"img\" aria-label=\"Security image\" width=\"200\" height=\"60\"></canvas><input aria-label=\"Characters\"><button type=\"button\">Verify</button><button type=\"button\">Close</button>", "a robot check"],
    ["a vendor captcha frame", "<iframe title=\"reCAPTCHA\" src=\"about:blank\" width=\"304\" height=\"78\"></iframe><button type=\"button\">Not now</button>", "a robot check"],
    ["a password prompt", "<h2>Confirm it is you</h2><form><input type=\"password\" aria-label=\"Password\"><button type=\"submit\">Continue</button></form><button type=\"button\">Cancel</button>", "a request for a password or a verification code"],
    ["a second-factor prompt", "<h2>Enter the code we sent</h2><input autocomplete=\"one-time-code\" aria-label=\"Code\"><button type=\"button\">Cancel</button>", "a request for a password or a verification code"],
    ["a card form", "<h2>Add a card</h2><input autocomplete=\"cc-number\" aria-label=\"Card number\"><button type=\"button\">No thanks</button>", "a payment confirmation"],
    ["a payment confirmation", "<h2>Confirm your payment</h2><p>Authorize this payment of 42.00 with your bank.</p><button type=\"button\">Cancel</button>", "a payment confirmation"]
  ];

  for (const [name, inner, sentence] of CHALLENGES) {
    test(`a dialog holding ${name} is the person's, even when it offers a way out`, async ({ openHarness, page }) => {
      const harness = await openHarness("modal-flows");
      await openDialog(page, inner);

      const reply = await harness.runAction({ commandId: `behind-${name.replace(/\W+/gu, "-")}`, actionType: "web.dom.click", selector: ADD_SECTION });

      expect(reply).toMatchObject({ status: "failed", failure: NEEDS_PERSON });
      expect(reply.failure?.actual).toMatch(new RegExp(`^covered: .*; ${sentence} is open over the page, so a person has to answer it before the run can continue$`, "u"));
      expect((await harness.finalState()).state).toMatchObject({ sectionCount: 0 });
    });
  }
});
