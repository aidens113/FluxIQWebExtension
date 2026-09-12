// Frame addressing: a command meant for a child frame is performed in that
// frame, and refused by every other one.
//
// This is the receiving half of Phase 1.3 step 4. The sending half --
// `chrome.tabs.sendMessage`'s `frameId` option, and the frame-existence check
// in front of it -- is covered in `src/runtime/tests/action-runner.test.ts`,
// because a page cannot observe its own delivery. What a page *can* prove is
// the part that matters here: the top frame refuses a command addressed to a
// child, so an action meant for the checkout iframe can never be answered by
// the page around it. That refusal is not theoretical -- `packages/test-runner`
// sends `executeAction` to a whole tab, where every frame receives it and
// Chrome keeps whichever reply comes first.
//
// The harness gives each frame its own `chrome.runtime` stub, so a spec
// delivers a message to one frame by evaluating in that frame. It does that
// through the stub's page global, whose name harness.ts owns; there is no
// export for it, so it is written out here (see the report's open questions).
//
// Both child frames are exercised, because the same-origin one shares a process
// with its parent and the cross-origin one does not, and an out-of-process
// frame is where a routing assumption that holds locally tends to stop holding.
//
// Not covered, and deliberately: shadow DOM. The recorder sees inside a shadow
// root -- `content/event-elements.ts` reads the event's composed path -- but
// resolution runs `document.querySelector`, which does not pierce one, so a
// shadow-root target is recorded and not replayable. It is a post-MVP item, not
// a frame-addressing one: a shadow root is not a frame and has no id to address.

import type { Frame, Page } from "@playwright/test";
import { expect, test, type HarnessDelivery } from "../index.js";
import type { BrowserActionCommand } from "../../../src/shared/protocol.js";

/** The page global e2e/content/runtime-stub.ts installs in every frame. */
const HARNESS_GLOBAL = "__fluxiqContentHarness";

const SAME_ORIGIN_FRAME = 'iframe[data-testid="same-frame"]';
const CROSS_ORIGIN_FRAME = 'iframe[data-testid="cross-frame"]';
const FRAME_RESULT = '[data-testid="frame-result"]';

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

test.describe("on iframe-checkout", () => {
  test("a command is answered by the frame it addresses, and by no other", async ({ openHarness, page }) => {
    await openHarness("iframe-checkout");
    const child = await readyChildFrame(page, SAME_ORIGIN_FRAME);
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

  test("a click addressed to the same-origin child frame is performed in that frame", async ({ openHarness, page }) => {
    const harness = await openHarness("iframe-checkout");
    const child = await readyChildFrame(page, SAME_ORIGIN_FRAME);
    const command: BrowserActionCommand = {
      commandId: "confirm-same",
      actionType: "web.dom.click",
      selector: '[data-testid="same-frame-action"]',
      frameId: A_CHILD_FRAME
    };

    // The top frame refuses it first, so what follows cannot be the page around
    // the iframe answering on the child's behalf.
    expect(await deliverTo(page.mainFrame(), { type: "executeAction", action: command, frameId: A_CHILD_FRAME })).toEqual({ responded: false });

    const delivery = await deliverTo(child, { type: "executeAction", action: command, frameId: A_CHILD_FRAME });
    expect(delivery.responded).toBe(true);
    expect(delivery.response).toMatchObject({ commandId: "confirm-same", status: "succeeded" });

    // The page is the oracle: the button inside the frame really was pressed.
    await expect(page.frameLocator(SAME_ORIGIN_FRAME).locator(FRAME_RESULT)).toHaveText("Confirmed");
    await expect(page.frameLocator(CROSS_ORIGIN_FRAME).locator(FRAME_RESULT)).toHaveText("Pending");
    await expect.poll(async () => (await harness.finalState()).state).toMatchObject({ sameOriginClicks: 1, crossOriginClicks: 0 });
  });

  test("a click addressed to the cross-origin child frame is performed in that frame", async ({ openHarness, page }) => {
    const harness = await openHarness("iframe-checkout");
    const child = await readyChildFrame(page, CROSS_ORIGIN_FRAME);
    const command: BrowserActionCommand = {
      commandId: "confirm-cross",
      actionType: "web.dom.click",
      selector: '[data-testid="cross-frame-action"]',
      frameId: A_CHILD_FRAME
    };

    const delivery = await deliverTo(child, { type: "executeAction", action: command, frameId: A_CHILD_FRAME });
    expect(delivery.responded).toBe(true);
    expect(delivery.response).toMatchObject({ commandId: "confirm-cross", status: "succeeded" });

    await expect(page.frameLocator(CROSS_ORIGIN_FRAME).locator(FRAME_RESULT)).toHaveText("Confirmed");
    await expect(page.frameLocator(SAME_ORIGIN_FRAME).locator(FRAME_RESULT)).toHaveText("Pending");
    await expect.poll(async () => (await harness.finalState()).state).toMatchObject({ sameOriginClicks: 0, crossOriginClicks: 1 });
  });
});
