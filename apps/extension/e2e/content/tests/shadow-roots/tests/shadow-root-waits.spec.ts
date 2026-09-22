// A wait for a control inside an open shadow root, on the fixture that ships
// its consent platform as a custom element (job-board's `rf-consent`).
//
// A wait names a selector, and a selector written inside a shadow tree names
// nothing in the light document, so a wait that looks only in `document` can
// never be satisfied by a widget's control. The resolver has had the answer
// since the recorder began writing the host chain beside the element
// (`selector/shadow/scope.ts`): the chain says which roots may hold the
// target. These rows hold the wait to the same scope the click beside it uses,
// and the first row is the whole defect in one page -- the wait times out, and
// the click on the very same control succeeds a moment later.

import { expect, test } from "../../../index.js";

/** The consent platform's own element, and the button inside its shadow root. */
const CONSENT_HOST = "body > rf-consent";
const ACCEPT = 'button[data-choice="accepted"]';

/** The recorded target of a control inside the consent widget: its selector plus the host chain above it. */
const consentTarget = { selector: ACCEPT, tagName: "button", accessibleName: "Accept all", context: { shadowHosts: [CONSENT_HOST] } };

test.describe("a wait for a control inside an open shadow root", () => {
  test("job-board: the wait is satisfied inside rf-consent, where the click on the same control lands", async ({ openHarness, page }) => {
    const harness = await openHarness("job-board");
    // The premise: this selector matches nothing in the light document, and one
    // element inside the consent widget's root.
    const where = await page.evaluate((selector) => ({
      light: document.querySelectorAll(selector).length,
      shadow: document.querySelector("rf-consent")?.shadowRoot?.querySelectorAll(selector).length ?? -1
    }), ACCEPT);
    expect(where, "the control is inside the widget, not in the page").toEqual({ light: 0, shadow: 1 });

    const waited = await harness.runAction({
      commandId: "wait:consent",
      actionType: "web.dom.wait_for_selector",
      selector: ACCEPT,
      element: consentTarget,
      timeoutMs: 1_500
    });
    expect(waited, waited.message).toMatchObject({
      status: "succeeded",
      validation: { status: "passed", actual: "the element was found" },
      element: { tagName: "button", accessibleName: "Accept all" }
    });

    // And the click that would follow such a wait in a Flow still resolves the
    // same control, which is what made the timeout above a false negative.
    const clicked = await harness.runAction({
      commandId: "click:consent",
      actionType: "web.dom.click",
      selector: ACCEPT,
      element: consentTarget
    });
    expect(clicked, clicked.message).toMatchObject({ status: "succeeded", element: { accessibleName: "Accept all" } });
    await expect.poll(async () => (await harness.finalState()).state).toMatchObject({ consent: "accepted" });
  });

  test("job-board: visible and enabled are answered inside the root too", async ({ openHarness }) => {
    const harness = await openHarness("job-board");
    for (const condition of ["visible", "enabled"] as const) {
      const reply = await harness.runAction({
        commandId: `wait:${condition}`,
        actionType: "web.dom.wait_for_selector",
        selector: ACCEPT,
        element: consentTarget,
        wait: { condition },
        timeoutMs: 1_500
      });
      expect(reply, `${condition}: ${reply.message}`).toMatchObject({
        status: "succeeded",
        validation: { status: "passed", actual: `the element was ${condition}` },
        element: { tagName: "button" }
      });
    }
  });

  test("job-board: absent is answered inside the root: the widget removing itself satisfies it", async ({ openHarness, page }) => {
    const harness = await openHarness("job-board");
    const pending = harness.runAction({
      commandId: "wait:gone",
      actionType: "web.dom.wait_for_selector",
      selector: ACCEPT,
      element: consentTarget,
      wait: { condition: "absent" },
      timeoutMs: 5_000
    });
    await page.getByRole("button", { name: "Accept all" }).click();
    expect(await pending).toMatchObject({
      status: "succeeded",
      validation: { status: "passed", actual: "no element matched the selector" }
    });
  });

  test("job-board: a wait with no recorded host chain still looks only in the document", async ({ openHarness }) => {
    // The scope is the recording's, not a search of every root on the page: a
    // target recorded in the light document is not answered by a widget's copy
    // of the same selector, exactly as the resolver decides it.
    const harness = await openHarness("job-board");
    const reply = await harness.runAction({
      commandId: "wait:unscoped",
      actionType: "web.dom.wait_for_selector",
      selector: ACCEPT,
      timeoutMs: 300
    });
    expect(reply).toMatchObject({
      status: "timed_out",
      validation: { status: "failed", actual: "no element matched before the timeout" },
      failure: { category: "timeout", code: "web.action.timeout" }
    });
  });
});
