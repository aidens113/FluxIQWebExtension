// Phase 1.5 steps 3 and 4 against real pages: every way a browser action can
// fail leaves with a code from the domain's closed set, and carries the page it
// failed on.
//
// The other content specs assert the failure their own verb produces. This one
// asserts the taxonomy across verbs -- one code per kind of failure, the same
// code whatever the reason, and the category, retryable flag and stage bound to
// it -- so a producer that invents a string, or reaches for a category Core
// forbids at that stage, fails here rather than at the gateway. The codes are
// imported rather than typed out, because a spec that repeated the strings
// could not notice `results.ts` drifting from the set it is supposed to draw
// from.
//
// The fixtures are chosen for the categories they can produce honestly:
// `failure-surfaces` for a refused and a vanished target, `auth-gate` for a
// session that expired under the Flow, `intermediate-state` for a wait that
// runs out, `navigation` for a post-condition that never appears.

import { WEB_AUTOMATION_FAILURE_CODES } from "@fluxiq-web-extension/domain/client";
import type { Page } from "@playwright/test";
import { expect, test } from "../index.js";

const DISABLED_TARGET = '[data-testid="disabled-target"]';
const DETACH_TARGET = '[data-testid="detach-target"]';
const ACCOUNT_HOLDER = '[data-testid="account-holder"]';
const SIGN_IN_FORM = '[data-testid="sign-in-form"]';
const CLAIM_RESULT = '[data-testid="claim-result"]';
const CLAIM_FORM = '[data-testid="claim-form"]';
const FULL_NAVIGATION = '[data-testid="full-navigation"]';

/** Cancels the anchor's default action, so the click lands and the navigation it promised never begins. */
async function swallowNavigation(page: Page, selector: string): Promise<void> {
  await page.locator(selector).evaluate((element) => {
    element.addEventListener("click", (event) => { event.preventDefault(); });
  });
}

test.describe("on failure-surfaces", () => {
  test("a refused target is ACTION_REJECTED, one code whatever the reason, with the reason in the record", async ({ openHarness }) => {
    const harness = await openHarness("failure-surfaces");
    const reply = await harness.runAction({ commandId: "rejected", actionType: "web.dom.click", selector: DISABLED_TARGET });
    expect(reply).toMatchObject({
      status: "failed",
      // The verb's own words are unchanged: the taxonomy is in `failure`, not in
      // what the operator reads.
      validation: { status: "failed", expected: "a target that can be clicked", actual: "the element is disabled" },
      failure: {
        category: "blocked_by_capability_or_policy",
        code: WEB_AUTOMATION_FAILURE_CODES.ACTION_REJECTED,
        retryable: false,
        stage: "execution",
        expected: "a target that can be clicked",
        // Disabled, hidden and covered are three reasons for one code. The
        // reason rides here so nothing is lost by not minting a code for each.
        actual: "disabled: the element is disabled"
      }
    });
  });

  test("a hidden target is the same code as a disabled one, distinguished only by the reason", async ({ openHarness, page }) => {
    const harness = await openHarness("failure-surfaces");
    await page.locator(DETACH_TARGET).evaluate((element) => { (element as HTMLElement).style.display = "none"; });
    const reply = await harness.runAction({ commandId: "hidden", actionType: "web.dom.click", selector: DETACH_TARGET });
    expect(reply.failure).toMatchObject({
      category: "blocked_by_capability_or_policy",
      code: WEB_AUTOMATION_FAILURE_CODES.ACTION_REJECTED,
      actual: "hidden: the element's display is none"
    });
  });

  test("a target that is gone is TARGET_NOT_FOUND, and the resolution that looked for it rides with the failure", async ({ openHarness, page }) => {
    const harness = await openHarness("failure-surfaces");
    // The fixture's own handler removes the button, so the second command
    // addresses an element that really is not there any more.
    expect(await harness.runAction({ commandId: "detach", actionType: "web.dom.click", selector: DETACH_TARGET })).toMatchObject({ status: "succeeded" });
    await expect(page.locator(DETACH_TARGET)).toHaveCount(0);

    const reply = await harness.runAction({ commandId: "gone", actionType: "web.dom.click", selector: DETACH_TARGET });
    expect(reply).toMatchObject({
      status: "failed",
      failure: {
        category: "target_not_found",
        code: WEB_AUTOMATION_FAILURE_CODES.TARGET_NOT_FOUND,
        retryable: true,
        stage: "target_resolution"
      },
      // Before this seam the resolver's record and its diagnostics died inside
      // the thrown error and only the sentence survived.
      resolution: { strategy: "selector" }
    });
    expect(reply.failure?.actual).toContain("nothing matched");
  });

  test("a thrown failure carries the page it failed on even when snapshot capture is off", async ({ openHarness, page }) => {
    // Most verbs hand their own snapshot to the result builder, so the
    // interesting path is the one that hands none: an action that threw. Before
    // Phase 1.5 step 4 that path read the capture setting, so with snapshots
    // off a Flow's most diagnosable failure arrived with nothing to diagnose.
    const harness = await openHarness("failure-surfaces");
    await harness.setRecording(true, { captureSnapshots: false });
    expect(await harness.runAction({ commandId: "detach-quiet", actionType: "web.dom.click", selector: DETACH_TARGET })).toMatchObject({ status: "succeeded" });
    await expect(page.locator(DETACH_TARGET)).toHaveCount(0);

    const reply = await harness.runAction({ commandId: "gone-quiet", actionType: "web.dom.click", selector: DETACH_TARGET });
    expect(reply.status).toBe("failed");
    // The domain builds the sanitized failure-evidence packet from this
    // snapshot; captured later, at diagnosis time, it would describe a page
    // that has since moved on.
    expect(reply.snapshot?.url).toBe(harness.url);
    expect(reply.snapshot?.interactiveElements.length).toBeGreaterThan(0);
  });
});

test.describe("on auth-gate", () => {
  test("a target missing behind a sign-in gate is AUTH_REQUIRED, not a bare missing target", async ({ openHarness, page }) => {
    // The start page is the sign-in form; the account page's content is
    // reachable only with a session, so this is the shape of a Flow whose
    // session expired between recording and replay.
    const harness = await openHarness("auth-gate");
    await expect(page.locator(SIGN_IN_FORM)).toBeVisible();

    const reply = await harness.runAction({ commandId: "expired", actionType: "web.dom.click", selector: ACCOUNT_HOLDER });
    expect(reply).toMatchObject({
      status: "failed",
      failure: {
        category: "auth_required",
        code: WEB_AUTOMATION_FAILURE_CODES.AUTH_REQUIRED,
        // The one failure a retry can never clear: Core asks a person to sign
        // in rather than running the same command again.
        retryable: false,
        stage: "confirmation"
      }
    });
    expect(reply.failure?.actual).toContain("sign-in gate");

    // Recognising the gate reads the page's structure, never a credential.
    const demoPassword = await page.locator('[data-testid="demo-password"]').innerText();
    expect(demoPassword.length).toBeGreaterThan(0);
    expect(JSON.stringify(reply.failure)).not.toContain(demoPassword);
    expect(JSON.stringify(reply.validation)).not.toContain(demoPassword);
  });

  test("the control: a target that is present on the gate page fails as itself, not as AUTH_REQUIRED", async ({ openHarness }) => {
    // Both halves are required. A sign-in form on a page whose target resolved
    // is just a page with a sign-in form.
    const harness = await openHarness("auth-gate");
    const reply = await harness.runAction({
      commandId: "present-target",
      actionType: "web.dom.assert",
      selector: SIGN_IN_FORM,
      assert: { kind: "absent", timeoutMs: 200 }
    });
    expect(reply.status).toBe("failed");
    expect(reply.failure?.code).not.toBe(WEB_AUTOMATION_FAILURE_CODES.AUTH_REQUIRED);
  });
});

test.describe("on intermediate-state", () => {
  test("a wait that runs out of time is TIMEOUT, and the status stays timed_out", async ({ openHarness }) => {
    const harness = await openHarness("intermediate-state");
    const reply = await harness.runAction({
      commandId: "wait-result",
      actionType: "web.dom.wait_for_selector",
      selector: CLAIM_RESULT,
      timeoutMs: 300
    });
    expect(reply).toMatchObject({
      // Never flattened to `failed`: Core's `failureForCommandStatus` reads the
      // command status, and a timeout is not an action that ran and failed.
      status: "timed_out",
      failure: {
        category: "timeout",
        code: WEB_AUTOMATION_FAILURE_CODES.TIMEOUT,
        retryable: true,
        stage: "execution",
        expected: `an element matching ${CLAIM_RESULT}`
      }
    });
  });

  test("the control: the same wait for something the page does have neither fails nor invents a record", async ({ openHarness }) => {
    const harness = await openHarness("intermediate-state");
    const reply = await harness.runAction({
      commandId: "wait-form",
      actionType: "web.dom.wait_for_selector",
      selector: CLAIM_FORM,
      timeoutMs: 2_000
    });
    expect(reply.status).toBe("succeeded");
    expect(reply.failure).toBeUndefined();
  });
});

test.describe("on navigation", () => {
  test("a post-condition that never appears is OUTPUT_NOT_OBSERVED, with where the page actually is", async ({ openHarness, page }) => {
    const harness = await openHarness("navigation");
    await swallowNavigation(page, FULL_NAVIGATION);

    const reply = await harness.runAction({ commandId: "swallowed", actionType: "web.dom.click", selector: FULL_NAVIGATION });
    expect(reply).toMatchObject({
      status: "failed",
      failure: {
        category: "output_not_observed",
        code: WEB_AUTOMATION_FAILURE_CODES.OUTPUT_NOT_OBSERVED,
        retryable: true,
        stage: "verification",
        actual: "the click was prevented and the location did not change"
      }
    });
    // The URL rides with the failure: the domain reads it off the result to
    // build the failure diagnostics that travel to Core beside the packet.
    expect(reply.url).toBe(harness.url);
    expect(reply.snapshot?.url).toBe(harness.url);
    await expect(page).toHaveURL(harness.url);
  });

  test("a link whose navigation is not prevented is a success, and carries no failure", async ({ openHarness }) => {
    const harness = await openHarness("navigation");
    const reply = await harness.runAction({ commandId: "navigated", actionType: "web.dom.click", selector: FULL_NAVIGATION });
    expect(reply.status).toBe("succeeded");
    expect(reply.failure).toBeUndefined();
  });
});
