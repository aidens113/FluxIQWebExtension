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
// The pages are realistic ones, chosen for the failures they produce honestly:
// company-website's quote drawer for a refused target (its Back button is
// disabled on the first step) and a target the page is not showing (the send
// button waits on the last step), its consent wall for a target that is gone
// (answering the wall removes it), its home page for a wait that runs out and
// a link whose navigation never happens; photo-social's login form for a
// session that expired under the Flow.

import { WEB_AUTOMATION_FAILURE_CODES } from "@fluxiq-web-extension/domain/client";
import type { Page } from "@playwright/test";
import { expect, test } from "../index.js";
import type { ContentHarness } from "../index.js";

/** The quote drawer's Back button, disabled while the drawer is on its first step. */
const DRAWER_BACK = "[data-quote-drawer] section > div:last-child > button:nth-of-type(1)";
/** The drawer's send button, in the markup from the start and hidden until the last step. */
const DRAWER_SEND = '[data-testid="quote-submit"]';
/** The consent wall's "Reject non-essential", inside its shadow root; answering removes the whole wall. */
const WALL_REJECT = 'button[data-choice="essential"]';
const QUOTE_BUTTON = "header [data-open-quote]";
/** A quote's reference, which only the confirmation page after a sent quote shows. */
const QUOTE_REFERENCE = '[data-testid="quote-reference"]';
const BRANCHES_LINK = 'nav[aria-label="Main"] a[href$="/branches"]';

const LOGIN_PATH = "/scenarios/photo-social/accounts/login/";
/** The inbox, where a recorded step landed; a URL claim matches by containment, so it must not be a prefix of the login page's path. */
const INBOX_PATH = "/scenarios/photo-social/direct/inbox/";
/** The comment box every post on the signed-in feed carries: what a replayed step looks for next. */
const FEED_COMMENT_BOX = 'textarea[aria-label="Add a comment…"]';
const LOGIN_PASSWORD = 'form input[name="password"]';
/** Typed into the login form before each row, so a record that quoted the page's fields would be caught. */
const TYPED_SECRET = "SYNTHETIC-PASSWORD-7731";

async function apply(harness: ContentHarness, operation: string, payload: object = {}): Promise<void> {
  const response = await fetch(`${harness.lab.origin}/api/${harness.scenarioId}/${operation}`, {
    method: "POST",
    headers: { authorization: `Bearer ${harness.lab.runToken}`, "content-type": "application/json" },
    body: JSON.stringify(payload)
  });
  expect(response.ok, `${operation} answered ${response.status}`).toBe(true);
}

async function openAndWait(harness: ContentHarness, url: string): Promise<void> {
  await harness.page.goto(url);
  await expect.poll(async () => (await harness.messages()).some((message) => message.type === "fluxiq.contentReady")).toBe(true);
}

/** company-website with its consent wall, chat greeting and newsletter offer already answered. */
async function settledCompanyHome(harness: ContentHarness): Promise<void> {
  await apply(harness, "set-consent", { choice: "essential" });
  await apply(harness, "dismiss-chat-greeting");
  await apply(harness, "dismiss-newsletter");
  await openAndWait(harness, harness.url);
}

/** company-website with the consent wall still up and nothing over its answers. */
async function wallOnly(harness: ContentHarness): Promise<void> {
  await apply(harness, "dismiss-chat-greeting");
  await openAndWait(harness, harness.url);
}

/** The quote drawer, open on its first step over the settled home page. */
async function openDrawer(harness: ContentHarness): Promise<void> {
  await settledCompanyHome(harness);
  await harness.page.locator(QUOTE_BUTTON).click();
  await expect(harness.page.locator(DRAWER_BACK)).toBeVisible();
}

const drawerOpen = (page: Page): Promise<boolean> => page.locator("[data-quote-drawer]").evaluate((element) => !(element as HTMLElement).hidden);

/** photo-social's login form, the one the site shows a visitor whose session is gone, with a password typed into it. */
async function openLoginGate(harness: ContentHarness): Promise<string> {
  const url = new URL(LOGIN_PATH, harness.lab.origin).href;
  await openAndWait(harness, url);
  await harness.page.fill(LOGIN_PASSWORD, TYPED_SECRET);
  return url;
}

/** Cancels the anchor's default action, so the click lands and the navigation it promised never begins. */
async function swallowNavigation(page: Page, selector: string): Promise<void> {
  await page.locator(selector).evaluate((element) => {
    element.addEventListener("click", (event) => { event.preventDefault(); });
  });
}

test.describe("on company-website", () => {
  test("a disabled target is TARGET_NOT_ACTIONABLE, with the reason in the record", async ({ openHarness }) => {
    const harness = await openHarness("company-website");
    await openDrawer(harness);
    const reply = await harness.runAction({ commandId: "rejected", actionType: "web.dom.click", selector: DRAWER_BACK });
    expect(reply).toMatchObject({
      status: "failed",
      // The verb's own words are unchanged: the taxonomy is in `failure`, not in
      // what the operator reads.
      validation: { status: "failed", expected: "a target that can be clicked", actual: "the element is disabled" },
      failure: {
        category: "unexpected_state",
        code: WEB_AUTOMATION_FAILURE_CODES.TARGET_NOT_ACTIONABLE,
        retryable: false,
        stage: "execution",
        expected: "a target that can be clicked",
        // Disabled and covered are two reasons for one code. The reason rides
        // here so nothing is lost by not minting a code for each.
        actual: "disabled: the element is disabled"
      }
    });
  });

  test("a hidden target is TARGET_NOT_SHOWN, Core's target_not_found, so a Flow run finds the current step by state", async ({ openHarness, page }) => {
    const harness = await openHarness("company-website");
    await openDrawer(harness);
    // The send button is in the drawer from the start and shown only on its last step.
    await expect(page.locator(DRAWER_SEND)).toHaveCount(1);
    const reply = await harness.runAction({ commandId: "hidden", actionType: "web.dom.click", selector: DRAWER_SEND });
    expect(reply.failure).toMatchObject({
      // t193-1002m: a step whose target is not shown is a step that is not
      // available, and Core routes by state only for `target_not_found`.
      category: "target_not_found",
      code: WEB_AUTOMATION_FAILURE_CODES.TARGET_NOT_SHOWN,
      retryable: true,
      stage: "target_resolution",
      // The reason still heads the record; the defence's account follows it,
      // because a hidden target is an obstruction the runtime tries to clear
      // before it reports (`action-runtime/recovery/record.ts`).
      actual: expect.stringMatching(/^hidden: the element's display is none;/u)
    });
    expect(await drawerOpen(page), "the drawer the target sits in is not what hides it").toBe(true);
  });

  test("a target that is gone is TARGET_NOT_FOUND, and the resolution that looked for it rides with the failure", async ({ openHarness, page }) => {
    const harness = await openHarness("company-website");
    await wallOnly(harness);
    // The wall's own handler removes it once answered, so the second command
    // addresses an element that really is not there any more.
    expect(await harness.runAction({ commandId: "answer", actionType: "web.dom.click", selector: WALL_REJECT })).toMatchObject({ status: "succeeded" });
    await expect(page.getByTestId("cookie-consent")).toHaveCount(0);

    const reply = await harness.runAction({ commandId: "gone", actionType: "web.dom.click", selector: WALL_REJECT });
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
    const harness = await openHarness("company-website");
    await wallOnly(harness);
    await harness.setRecording(true, { captureSnapshots: false });
    expect(await harness.runAction({ commandId: "answer-quiet", actionType: "web.dom.click", selector: WALL_REJECT })).toMatchObject({ status: "succeeded" });
    await expect(page.getByTestId("cookie-consent")).toHaveCount(0);

    const reply = await harness.runAction({ commandId: "gone-quiet", actionType: "web.dom.click", selector: WALL_REJECT });
    expect(reply.status).toBe("failed");
    // The domain builds the sanitized failure-evidence packet from this
    // snapshot; captured later, at diagnosis time, it would describe a page
    // that has since moved on.
    expect(reply.snapshot?.url).toBe(harness.url);
    expect(reply.snapshot?.interactiveElements.length).toBeGreaterThan(0);
  });
});

test.describe("on photo-social's login form", () => {
  test("a target missing behind a sign-in gate is AUTH_REQUIRED, not a bare missing target", async ({ openHarness }) => {
    // The shape of a Flow whose session expired between recording and replay:
    // the step looks for the feed's comment box and the site shows its login
    // form instead.
    const harness = await openHarness("photo-social");
    await openLoginGate(harness);

    const reply = await harness.runAction({ commandId: "expired", actionType: "web.dom.click", selector: FEED_COMMENT_BOX });
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

    // Recognising the gate reads the page's structure, never its fields: the
    // password typed into the form appears nowhere in the record.
    expect(JSON.stringify(reply.failure)).not.toContain(TYPED_SECRET);
    expect(JSON.stringify(reply.validation)).not.toContain(TYPED_SECRET);
  });

  test("a URL claim that fails on a sign-in gate is AUTH_REQUIRED, and the record never quotes the page's address", async ({ openHarness }) => {
    // W19's shape: the recorded step landed on the inbox, so replay claims that
    // URL, and an expired session leaves the browser on the login form.
    const harness = await openHarness("photo-social");
    const loginUrl = await openLoginGate(harness);

    const reply = await harness.runAction({
      commandId: "expired-landing",
      actionType: "web.dom.assert",
      assert: { kind: "url", expected: INBOX_PATH, timeoutMs: 200 }
    });
    expect(reply).toMatchObject({
      status: "failed",
      failure: {
        category: "auth_required",
        code: WEB_AUTOMATION_FAILURE_CODES.AUTH_REQUIRED,
        retryable: false,
        stage: "confirmation",
        expected: `the page URL is ${INBOX_PATH}`
      }
    });
    expect(reply.failure?.actual).toContain("sign-in gate");

    // The claim is the Flow's; the address and every field are the page's. On
    // a real gate the address carries a return path or a token.
    expect(JSON.stringify(reply.failure)).not.toContain(loginUrl);
    expect(JSON.stringify(reply.failure)).not.toContain(TYPED_SECRET);
    expect(JSON.stringify(reply.validation)).not.toContain(TYPED_SECRET);
  });

  test("the control: a URL claim that names no URL is malformed on the gate page too, not AUTH_REQUIRED", async ({ openHarness }) => {
    // No page can satisfy it, so it says the Flow is wrong, not the session.
    const harness = await openHarness("photo-social");
    await openLoginGate(harness);
    const reply = await harness.runAction({ commandId: "unnamed-url", actionType: "web.dom.assert", assert: { kind: "url" } });
    expect(reply).toMatchObject({
      status: "failed",
      failure: { code: WEB_AUTOMATION_FAILURE_CODES.STATE_MISMATCH, expected: "the assertion to name the expected URL" }
    });
  });

  test("the control: a target that is present on the gate page fails as itself, not as AUTH_REQUIRED", async ({ openHarness }) => {
    // Both halves are required. A sign-in form on a page whose target resolved
    // is just a page with a sign-in form.
    const harness = await openHarness("photo-social");
    await openLoginGate(harness);
    const reply = await harness.runAction({
      commandId: "present-target",
      actionType: "web.dom.assert",
      selector: LOGIN_PASSWORD,
      assert: { kind: "absent", timeoutMs: 200 }
    });
    expect(reply.status).toBe("failed");
    expect(reply.failure?.code).not.toBe(WEB_AUTOMATION_FAILURE_CODES.AUTH_REQUIRED);
  });
});

test.describe("on company-website's home page, waiting", () => {
  test("a wait that runs out of time is TIMEOUT, and the status stays timed_out", async ({ openHarness }) => {
    const harness = await openHarness("company-website");
    await settledCompanyHome(harness);
    const reply = await harness.runAction({
      commandId: "wait-reference",
      actionType: "web.dom.wait_for_selector",
      selector: QUOTE_REFERENCE,
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
        expected: `an element matching ${QUOTE_REFERENCE}`
      }
    });
  });

  test("the control: the same wait for something the page does have neither fails nor invents a record", async ({ openHarness }) => {
    const harness = await openHarness("company-website");
    await settledCompanyHome(harness);
    const reply = await harness.runAction({
      commandId: "wait-quote-button",
      actionType: "web.dom.wait_for_selector",
      selector: QUOTE_BUTTON,
      timeoutMs: 2_000
    });
    expect(reply.status).toBe("succeeded");
    expect(reply.failure).toBeUndefined();
  });
});

test.describe("on company-website's home page, navigating", () => {
  test("a post-condition that never appears is OUTPUT_NOT_OBSERVED, with where the page actually is", async ({ openHarness, page }) => {
    const harness = await openHarness("company-website");
    await settledCompanyHome(harness);
    await swallowNavigation(page, BRANCHES_LINK);

    const reply = await harness.runAction({ commandId: "swallowed", actionType: "web.dom.click", selector: BRANCHES_LINK });
    expect(reply).toMatchObject({
      status: "failed",
      failure: {
        category: "output_not_observed",
        code: WEB_AUTOMATION_FAILURE_CODES.OUTPUT_NOT_OBSERVED,
        retryable: true,
        stage: "verification",
        actual: "the page prevented the navigation, and in 5000 ms neither its address nor its content changed"
      }
    });
    // The URL rides with the failure: the domain reads it off the result to
    // build the failure diagnostics that travel to Core beside the packet.
    expect(reply.url).toBe(harness.url);
    expect(reply.snapshot?.url).toBe(harness.url);
    await expect(page).toHaveURL(harness.url);
  });

  test("a link whose navigation is not prevented is a success, and carries no failure", async ({ openHarness }) => {
    const harness = await openHarness("company-website");
    await settledCompanyHome(harness);
    const reply = await harness.runAction({ commandId: "navigated", actionType: "web.dom.click", selector: BRANCHES_LINK });
    expect(reply.status).toBe("succeeded");
    expect(reply.failure).toBeUndefined();
  });
});
