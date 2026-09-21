// A control recorded inside an open shadow root, carried from the press a
// person made to the command a replay dispatches, and resolved on a fresh copy
// of the page -- or refused, when the page no longer says which control it was.
//
// Why this is its own spec. A selector for an element inside a shadow root is
// written within that root (`selector/unique-selector.ts`), so on its own it
// names nothing in the page. Before the recorder wrote the host chain beside it
// (`selector/shadow/host-chain.ts`), two live runs showed both ways that fails:
//
// - company-website: the chat greeting's Close, recorded as
//   `div:nth-of-type(2) > div`, matched seven unrelated elements of the light
//   document at replay, all scoring -0.28, and the replay stopped on
//   `web.target.ambiguous` (E1 lane E).
// - job-board: the cookie consent's "Accept all", inside `rf-consent`'s shadow
//   root, matched nothing; the point fallback landed on the `rf-consent` host
//   and the veto refused it, so the replay stopped on `web.target.not_found`
//   (E1 lane D).
//
// Each row records a real press, sends it through the three producers a live
// replay depends on exactly as they ship -- the background worker's wire
// projection, the domain's Flow node payload, and the domain's command mapping
// -- and replays the command in a new copy of the fixture, whose own oracle
// says whether the right control was pressed.

import { webAutomationActionFromGatewayCommand, webAutomationOutputPayload, WEB_AUTOMATION_FAILURE_CODES } from "@fluxiq-web-extension/domain/client";
import type { Page } from "@playwright/test";
import { gatewayRecordingEventFromPayload } from "../../../../../src/background/connection/index.js";
import { expect, test } from "../../../index.js";
import type { ContentHarness } from "../../../index.js";

type ActionCommand = Parameters<ContentHarness["runAction"]>[0];
type RecordedEvent = Awaited<ReturnType<ContentHarness["recordedEvents"]>>[number];

const QUIET = { captureMutations: false, captureInputValues: true, captureSnapshots: false };

/** Records a real press on `control` and returns the event a live recording keeps: the press, not the click after it. */
async function recordPress(harness: ContentHarness, control: ReturnType<Page["locator"]>): Promise<RecordedEvent> {
  const press = async () => (await harness.recordedEvents("dom.click")).find((event) => event.metadata?.sourceEvent === "pointerdown");
  await harness.setRecording(true, QUIET);
  await control.click();
  await expect.poll(press, "the press was recorded").toBeDefined();
  await harness.setRecording(false);
  return (await press())!;
}

/** The recorded press as a replay dispatches it: the wire projection, the Flow node, and the command, each called as it ships. */
function replayCommand(recorded: RecordedEvent, commandId: string): ActionCommand {
  const payload = gatewayRecordingEventFromPayload(recorded).payload;
  if (!payload) throw new Error("the recording event carries no payload");
  const parameters = webAutomationOutputPayload("web.dom.click", payload);
  const command = webAutomationActionFromGatewayCommand({ commandId, actionType: "web.dom.click", parameters });
  if ("status" in command) throw new Error(`the domain rejected the replayed click: ${command.message}`);
  return command;
}

/** A command as it would reach the page had the recorder written no host chain: the selector and element alone, context stripped. */
function withoutHostChain(command: ActionCommand): ActionCommand {
  const element = { ...(command.element ?? {}) };
  delete (element as { context?: unknown }).context;
  return { commandId: `${command.commandId}:no-chain`, actionType: command.actionType, ...(command.selector ? { selector: command.selector } : {}), element };
}

test.describe("a control recorded inside an open shadow root", () => {
  test("job-board: the consent's Accept all resolves inside rf-consent on a fresh page, and nothing else is pressed", async ({ openHarness, page }) => {
    const recording = await openHarness("job-board");
    const recorded = await recordPress(recording, page.getByRole("button", { name: "Accept all" }));
    expect(recorded.element?.context?.shadowHosts, "the recorder wrote the host chain").toEqual(["body > rf-consent"]);
    const command = replayCommand(recorded, "shadow:consent");
    expect(command.element?.context?.shadowHosts, "and it survived the wire, the node and the command").toEqual(["body > rf-consent"]);

    const replay = await openHarness("job-board");
    const reply = await replay.runAction(command);
    expect(reply, reply.message).toMatchObject({ status: "succeeded", element: { tagName: "button", accessibleName: "Accept all" } });
    await expect.poll(async () => (await replay.finalState()).state).toMatchObject({ consent: "accepted" });
  });

  test("job-board: without the chain the same command finds nothing, which is the failure lane D measured", async ({ openHarness, page }) => {
    const recording = await openHarness("job-board");
    const command = replayCommand(await recordPress(recording, page.getByRole("button", { name: "Accept all" })), "shadow:consent-unscoped");
    const replay = await openHarness("job-board");
    const reply = await replay.runAction(withoutHostChain(command));
    expect(reply.status).toBe("failed");
    expect(reply.failure?.code).toBe(WEB_AUTOMATION_FAILURE_CODES.TARGET_NOT_FOUND);
    expect((await replay.finalState()).state).toMatchObject({ consent: "pending" });
  });

  test("job-board: two identical consent widgets are ambiguous, and neither is pressed", async ({ openHarness, page }) => {
    const recording = await openHarness("job-board");
    const command = replayCommand(await recordPress(recording, page.getByRole("button", { name: "Accept all" })), "shadow:consent-twice");
    const replay = await openHarness("job-board");
    // A second copy of the widget, built by its own element definition, so its
    // shadow root holds a byte-identical Accept all.
    await page.evaluate(() => document.body.append(document.createElement("rf-consent")));
    const reply = await replay.runAction(command);
    expect(reply.status).toBe("failed");
    expect(reply.failure?.code).toBe(WEB_AUTOMATION_FAILURE_CODES.TARGET_AMBIGUOUS);
    expect((await replay.finalState()).state).toMatchObject({ consent: "pending" });
  });

  test("job-board: a widget that is gone is a target not found, never a lookup in the page around it", async ({ openHarness, page }) => {
    const recording = await openHarness("job-board");
    const command = replayCommand(await recordPress(recording, page.getByRole("button", { name: "Accept all" })), "shadow:consent-gone");
    const replay = await openHarness("job-board");
    await page.evaluate(() => {
      document.querySelector("rf-consent")?.remove();
      // A light-document button the recorded selector's text would match.
      const decoy = document.createElement("button");
      decoy.textContent = "Accept all";
      document.body.append(decoy);
    });
    const reply = await replay.runAction(command);
    expect(reply.status).toBe("failed");
    expect(reply.failure?.code).toBe(WEB_AUTOMATION_FAILURE_CODES.TARGET_NOT_FOUND);
  });

  test("company-website: the chat greeting's Close dismisses the greeting on a fresh page, and does not open the chat", async ({ openHarness, page }) => {
    const recording = await openHarness("company-website");
    const close = page.locator('[title="Close"]');
    await expect(close, "the greeting opens on its timer").toBeVisible({ timeout: 10_000 });
    const recorded = await recordPress(recording, close);
    expect(recorded.element?.context?.shadowHosts, "the recorder wrote the host chain").toHaveLength(1);
    const command = replayCommand(recorded, "shadow:chat-close");

    const replay = await openHarness("company-website");
    await expect(page.locator('[title="Close"]')).toBeVisible({ timeout: 10_000 });
    const reply = await replay.runAction(command);
    expect(reply, reply.message).toMatchObject({ status: "succeeded", element: { accessibleName: "Close" } });
    await expect.poll(async () => (await replay.finalState()).state).toMatchObject({ chat: { greetingDismissed: true, opened: 0 } });
  });
});

// local-classifieds' radius picker is `<kf-location>`, a web component with an
// open shadow root. The Lab chooses an option as a person does with a keyboard:
// focus the select, press an arrow. Before, the key was recorded against the
// `kf-location` host, because a composed event reaches the document retargeted,
// and the selection was not recorded at all, because `change` does not leave a
// shadow root.
test.describe("a keyboard selection inside an open shadow root", () => {
  test("local-classifieds: the key and the change are both recorded on the radius select, with its host chain", async ({ openHarness, page }) => {
    const harness = await openHarness("local-classifieds");
    await page.getByRole("button", { name: "Allow all cookies" }).click();
    await page.getByRole("button", { name: /Within 20 mi/ }).click();
    const radius = page.getByRole("combobox", { name: "Radius" });
    await harness.setRecording(true, QUIET);
    await radius.focus();
    await radius.press("ArrowUp");
    const chosen = await radius.inputValue();
    expect(chosen, "the key moved the selection").not.toBe("20");
    await expect.poll(async () => (await harness.recordedEvents("dom.change")).length, "the change inside the root was heard").toBe(1);
    await harness.setRecording(false);

    const [change] = await harness.recordedEvents("dom.change");
    expect(change?.element).toMatchObject({ tagName: "select", context: { shadowHosts: [expect.stringContaining("kf-location")] } });
    expect(change?.inputValue).toBe(chosen);
    const keys = (await harness.recordedEvents("dom.keydown")).filter((event) => event.key === "ArrowUp");
    expect(keys.map((event) => event.element?.tagName), "the key is the select's, not the host's").toEqual(["select"]);
  });
});
