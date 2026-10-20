// Frame addressing: a command meant for a child frame is performed in that
// frame, and refused by every other one.
//
// This is the receiving half of Phase 1.3 step 4. The sending half --
// `chrome.tabs.sendMessage`'s `frameId` option, and the frame-existence check
// in front of it -- is covered in `src/runtime/tests/action-runner.test.ts`,
// because a page cannot observe its own delivery. What a page *can* prove is
// the part that matters here: the top frame refuses a command addressed to a
// child, so an action meant for a checkout's payment frame can never be
// answered by the page around it. That refusal is not theoretical --
// `packages/test-runner` sends `executeAction` to a whole tab, where every
// frame receives it and Chrome keeps whichever reply comes first.
//
// The harness gives each frame its own `chrome.runtime` stub, so a spec
// delivers a message to one frame by evaluating in that frame. It does that
// through the stub's page global, whose name harness.ts owns; there is no
// export for it, so it is written out here.
//
// Both kinds of child frame are exercised, on the realistic checkouts that
// embed them, because a same-origin frame shares a process with its parent
// and a cross-origin one does not, and an out-of-process frame is where a
// routing assumption that holds locally tends to stop holding:
//
// - everything-store's checkout embeds its "Payment methods" chooser as a
//   same-origin frame, shown by the "Change" link under "Paying with";
// - bigbox-retail's guest checkout embeds the payment provider's "Secure card
//   entry" form from the Lab's second origin.
//
// Not covered here: shadow DOM. A shadow root is not a frame and has no id to
// address; its targets are the shadow-roots specs'.

import type { Frame, Page } from "@playwright/test";
import { expect, test, type ContentHarness, type HarnessDelivery } from "../index.js";
import type { BrowserActionCommand } from "../../../src/shared/protocol.js";

/** The page global e2e/content/runtime-stub.ts installs in every frame. */
const HARNESS_GLOBAL = "__fluxiqContentHarness";

const PAYMENT_FRAME = 'iframe[title="Payment methods"]';
const CARD_FRAME = 'iframe[title="Secure card entry"]';
/** The method everything-store's checkout starts on, and the one the click chooses. */
const DEFAULT_PAYMENT = "visa-4417";
const OTHER_PAYMENT = "checking-7781";

/** A child frame id. Which child is settled by the delivery; the frame only reads "not the top one". */
const A_CHILD_FRAME = 1;
const TOP_FRAME = 0;

/** Hands a message to one frame's content script, as the background worker addresses it at that frame. */
async function deliverTo(frame: Frame, message: Record<string, unknown>): Promise<HarnessDelivery> {
  return await frame.evaluate(([name, value]) => {
    const stub = (window as unknown as Record<string, { deliver(message: unknown): Promise<HarnessDelivery> } | undefined>)[name];
    if (!stub) throw new Error("The content-harness runtime stub is not installed in this frame.");
    return stub.deliver(value);
  }, [HARNESS_GLOBAL, message] as const);
}

/** The child frame behind `selector`, once its content script has loaded and announced itself. */
async function readyChildFrame(page: Page, selector: string): Promise<Frame> {
  const element = await page.locator(selector).elementHandle();
  const frame = await element?.contentFrame();
  if (!frame) throw new Error(`${selector} has no frame.`);
  await frame.waitForFunction((name) => {
    const stub = (window as unknown as Record<string, { sent?: Array<{ type?: string }> } | undefined>)[name];
    return Boolean(stub?.sent?.some((message) => message.type === "fluxiq.contentReady"));
  }, HARNESS_GLOBAL);
  return frame;
}

/** A harmless action every frame can perform, so a row measures addressing and nothing else. */
function snapshotCommand(commandId: string): BrowserActionCommand {
  return { commandId, actionType: "web.dom.capture_snapshot" };
}

/** Posts one of the scenario's own page mutations, as the page's `mutate` does. */
async function mutate(harness: ContentHarness, operation: string, payload: Record<string, unknown> = {}): Promise<void> {
  const response = await fetch(`${harness.lab.origin}/api/${harness.scenarioId}/${operation}`, {
    method: "POST",
    headers: { authorization: `Bearer ${harness.lab.runToken}`, "content-type": "application/json" },
    body: JSON.stringify(payload)
  });
  expect(response.status, `${harness.scenarioId} ${operation}`).toBe(200);
}

/** Opens `path` on the harness's Lab and waits for the top frame's content script to announce itself. */
async function openPath(harness: ContentHarness, path: string): Promise<void> {
  await harness.page.goto(new URL(path, harness.lab.origin).href);
  await expect.poll(async () => (await harness.messages()).some((message) => message.type === "fluxiq.contentReady")).toBe(true);
}

/** everything-store's checkout for the cart as it stands, with the payment chooser shown, as a shopper who pressed Change sees it. */
async function openStoreCheckout(openHarness: (id: string) => Promise<ContentHarness>): Promise<{ harness: ContentHarness; child: Frame }> {
  const harness = await openHarness("everything-store");
  await mutate(harness, "consent", { choice: "accept" });
  await mutate(harness, "dismiss-nudge", { nudge: "notifications" });
  await mutate(harness, "dismiss-nudge", { nudge: "app-banner" });
  await mutate(harness, "start-checkout", { pipeline: "cart" });
  await openPath(harness, "/scenarios/everything-store/checkout");
  await harness.page.locator('[data-action="change-payment"]').click();
  await expect(harness.page.locator(PAYMENT_FRAME)).toBeVisible();
  return { harness, child: await readyChildFrame(harness.page, PAYMENT_FRAME) };
}

test.describe("on everything-store's checkout, a same-origin payment frame", () => {
  test("a command is answered by the frame it addresses, and by no other", async ({ openHarness, page }) => {
    const { child } = await openStoreCheckout(openHarness);
    const top = page.mainFrame();

    // Each row is one address delivered to one frame, and whether that frame
    // took it. `frameId` is the address the runner now sends; `topFrameOnly` is
    // the older half of the same contract, which the test runner still sends;
    // a message with neither means "whoever you are" and is always taken.
    const rows: Array<{ address: Record<string, unknown>; delivered: "top" | "child"; answered: boolean }> = [
      { address: { frameId: A_CHILD_FRAME }, delivered: "top", answered: false },
      { address: { frameId: A_CHILD_FRAME }, delivered: "child", answered: true },
      { address: { frameId: TOP_FRAME }, delivered: "top", answered: true },
      { address: { frameId: TOP_FRAME }, delivered: "child", answered: false },
      { address: { topFrameOnly: true }, delivered: "top", answered: true },
      { address: { topFrameOnly: true }, delivered: "child", answered: false },
      { address: {}, delivered: "top", answered: true },
      { address: {}, delivered: "child", answered: true }
    ];

    for (const [index, row] of rows.entries()) {
      const delivery = await deliverTo(row.delivered === "top" ? top : child, {
        type: "executeAction",
        action: snapshotCommand(`address-${index}`),
        ...row.address
      });
      expect(delivery.responded, `${JSON.stringify(row.address)} delivered to the ${row.delivered} frame`).toBe(row.answered);
    }
  });

  test("a click addressed to the same-origin payment frame is performed in that frame", async ({ openHarness, page }) => {
    const { harness, child } = await openStoreCheckout(openHarness);
    const command: BrowserActionCommand = {
      commandId: "choose-checking",
      actionType: "web.dom.click",
      selector: `input[name="payment"][value="${OTHER_PAYMENT}"]`,
      frameId: A_CHILD_FRAME
    };

    // The top frame refuses it first, so what follows cannot be the page around
    // the iframe answering on the child's behalf.
    expect(await deliverTo(page.mainFrame(), { type: "executeAction", action: command, frameId: A_CHILD_FRAME })).toEqual({ responded: false });

    const delivery = await deliverTo(child, { type: "executeAction", action: command, frameId: A_CHILD_FRAME });
    expect(delivery.responded).toBe(true);
    expect(delivery.response).toMatchObject({ commandId: "choose-checking", status: "succeeded" });

    // The page is the oracle: the method inside the frame really was chosen,
    // and nothing was reported yet, because "Use this payment method" was not pressed.
    const frame = page.frameLocator(PAYMENT_FRAME);
    await expect(frame.locator(`input[name="payment"][value="${OTHER_PAYMENT}"]`)).toBeChecked();
    await expect(frame.locator(`input[name="payment"][value="${DEFAULT_PAYMENT}"]`)).not.toBeChecked();
    expect((await harness.finalState()).state).toMatchObject({ checkout: { paymentId: DEFAULT_PAYMENT } });
  });
});

test.describe("on bigbox-retail's guest checkout, a cross-origin card frame", () => {
  test("a click addressed to the cross-origin card frame is performed in that frame", async ({ openHarness, page }) => {
    const harness = await openHarness("bigbox-retail");
    await mutate(harness, "consent", { choice: "accept" });
    await mutate(harness, "dismiss-promo");
    await mutate(harness, "start-guest-checkout");
    await openPath(harness, "/scenarios/bigbox-retail/checkout");
    const child = await readyChildFrame(page, CARD_FRAME);
    expect(new URL(child.url()).origin, "the card form is served from the Lab's other origin").not.toBe(harness.lab.origin);

    const command: BrowserActionCommand = {
      commandId: "use-card",
      actionType: "web.dom.click",
      selector: 'button[type="submit"]',
      frameId: A_CHILD_FRAME
    };
    expect(await deliverTo(page.mainFrame(), { type: "executeAction", action: command, frameId: A_CHILD_FRAME })).toEqual({ responded: false });

    const delivery = await deliverTo(child, { type: "executeAction", action: command, frameId: A_CHILD_FRAME });
    expect(delivery.responded).toBe(true);
    expect(delivery.response).toMatchObject({ commandId: "use-card", status: "succeeded" });

    // The press reached the provider's form: with no card entered it says so, inside the frame, and hands the store no token.
    await expect(page.frameLocator(CARD_FRAME).getByRole("status")).toHaveText("Check your card details.");
    expect((await harness.finalState()).state).toMatchObject({ orders: [] });
  });
});
