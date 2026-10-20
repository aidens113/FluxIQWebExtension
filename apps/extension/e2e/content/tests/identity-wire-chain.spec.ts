// The recorded element's whole journey, from the click a person made to the
// command a replay dispatches, run in one row against the page it replays on.
//
// The identity specs beside this file hand the resolver a descriptor read off
// the page, which is the richest one there is. A live replay never sees that
// descriptor. It sees what three producers left of it: the wire projection the
// background worker sends a recording event through (`gatewayRecordingEventFromPayload`,
// `background/connection/gateway-payloads.ts`), the Flow node the domain builds
// from that event (`webAutomationOutputPayload`, which normalizes the element
// through `elementFingerprint`), and the command the domain maps that node's
// parameters onto (`webAutomationActionFromGatewayCommand`). Each of the three
// is called here as it ships, never restated. A copied key list would have
// passed while the real one was wrong, which is exactly what happened.
//
// What that cost, measured live (`reports/L-replay.md`) and reproduced in real
// Chromium (`reports/i-resolver-safety.md`, rows R5-R6): until `ab736a1` the
// projection was a hand-written list of seventeen keys with no `testId`,
// `accessibleName`, `label`, `implicitRole` or `context`, so a replay reached
// the resolver with less than the recorder had captured and scored lower than
// the same control described off the page.
//
// The row now runs on company-website (AGENTS.md: realistic scenarios only):
// a person presses the quote drawer's Send request, which carries every one of
// those signals -- a test id, an accessible name, a role and a dialog -- and the
// replay runs on the site's next deploy, another lab seed, where every
// generated id and hashed class has been redrawn. The bar it must clear is set
// by the page rather than by a constant: whatever the full on-page descriptor
// scores on the redeployed page, the recording that crossed the wire must score
// exactly the same. A signal lost on the way shows up as a lower score, a
// different strategy, or a refusal.
//
// Scope. Core stores the event between the projection and the node, and
// prepares the element target on dispatch; neither hop runs here. A Lab run of
// company-website's quote workflow is what covers them.

import { webAutomationActionFromGatewayCommand, webAutomationOutputPayload } from "@fluxiq-web-extension/domain/client";
import { gatewayRecordingEventFromPayload } from "../../../src/background/connection/index.js";
import { expect, test } from "../index.js";
import type { ContentHarness } from "../index.js";
import { describe, quoteDrawer, recordedElement, trackClicks } from "./identity-fixtures.js";

type ActionCommand = Parameters<ContentHarness["runAction"]>[0];
type RecordedEvent = Awaited<ReturnType<ContentHarness["recordedEvents"]>>[number];
type NodePayload = Parameters<typeof webAutomationOutputPayload>[1];

const QUIET = { captureMutations: false, captureInputValues: true, captureSnapshots: false };
/** The deploy after the recorded one: company-website's lab seed renames every class and generated id and changes nothing else. */
const REDEPLOYED_SEED = 4520;
const recordedIds = quoteDrawer.ids();
const redeployedIds = quoteDrawer.ids(REDEPLOYED_SEED);

/**
 * Records a real click on Send request and returns the event a live recording
 * keeps. The recorder sends a `dom.click` for the press and another for the
 * click; `PointerClickFilter` keeps the first to arrive, the press. Recording
 * stays on until that event is in: `click()` can return before the page has
 * handled the mouse events, and stopping first records nothing.
 */
async function recordSendClick(harness: ContentHarness): Promise<RecordedEvent> {
  const press = async () => (await harness.recordedEvents("dom.click")).find((event) => event.metadata?.sourceEvent === "pointerdown");
  await harness.setRecording(true, QUIET);
  await harness.page.locator(quoteDrawer.byId(recordedIds.send)).click();
  await expect.poll(press, "the press on Send request was recorded").toBeDefined();
  await harness.setRecording(false);
  return (await press())!;
}

/** The recording event's payload as it crosses the wire: HEAD's projection, called, not copied. */
function acrossTheWire(recorded: RecordedEvent): NodePayload {
  const payload = gatewayRecordingEventFromPayload(recorded).payload;
  if (!payload) throw new Error("the recording event carries no payload");
  return payload;
}

/** The replayed click, in each shape worth telling apart. */
const SHAPES: Array<{ name: string; command(parameters: NodePayload): ActionCommand }> = [
  {
    // The node's element and selector alone, so a visual target that happened
    // to land on Send request could not stand in for a signal the wire lost.
    name: "the node's element and selector",
    command: (parameters) => ({
      commandId: "wire-chain:element",
      actionType: "web.dom.click",
      ...(typeof parameters.selector === "string" ? { selector: parameters.selector } : {}),
      options: { element: parameters.element } as unknown as ActionCommand["options"]
    })
  },
  {
    // Everything the node carries, mapped as a live dispatch maps it: the
    // selector, the element, and the visual target recorded beside them.
    name: "the whole command a replay dispatches",
    command: (parameters) => {
      const command = webAutomationActionFromGatewayCommand({ commandId: "wire-chain:dispatched", actionType: "web.dom.click", parameters });
      if ("status" in command) throw new Error(`the domain rejected the replayed click: ${command.message}`);
      return command;
    }
  }
];

test.describe("identity wire chain: a recorded click survives the wire and the next deploy", () => {
  for (const shape of SHAPES) {
    test(`${shape.name}: Send request is pressed on the redeployed page, scored as the full descriptor scores it`, async ({ openHarness, page }) => {
      test.setTimeout(90_000);
      const recording = await openHarness("company-website");
      await quoteDrawer.open(recording);
      await quoteDrawer.toStep(page, 3);
      const recorded = await recordSendClick(recording);
      // The recorder captured every signal the old wire dropped. Were this to
      // fail, the loss is upstream of everything the rest of the row measures.
      expect(recorded.element).toMatchObject({
        selector: '[data-testid="quote-submit"]',
        testId: "quote-submit",
        accessibleName: "Send request",
        implicitRole: "button",
        context: { dialog: "Get a free quote" }
      });
      const onPage = await describe(recording, quoteDrawer.byId(recordedIds.send));
      const parameters = webAutomationOutputPayload("web.dom.click", acrossTheWire(recorded));

      const replay = await openHarness("company-website", { seed: REDEPLOYED_SEED });
      await quoteDrawer.open(replay);
      await quoteDrawer.toStep(page, 3, REDEPLOYED_SEED);
      // The redeploy redrew the button's id and class; its test id, words and place survive.
      expect(redeployedIds.send).not.toBe(recordedIds.send);
      await expect(page.locator(quoteDrawer.byId(recordedIds.send))).toHaveCount(0);
      await expect(page.locator(`button.${onPage.classNames![0]}`)).toHaveCount(0);

      // The bar: what the descriptor read off the recorded page scores here.
      const reference = await replay.runAction({
        commandId: "wire-chain:reference",
        actionType: "web.dom.click",
        ...(onPage.selector ? { selector: onPage.selector } : {}),
        options: recordedElement(onPage)
      });
      expect(reference.status, reference.message).toBe("succeeded");

      // A fresh step 3 for the replay under test, so its press has an effect of its own to show.
      await quoteDrawer.open(replay);
      await quoteDrawer.toStep(page, 3, REDEPLOYED_SEED);
      const clicks = await trackClicks(page);
      const reply = await replay.runAction(shape.command(parameters));

      // One assertion, so a failure prints the status and the scores together:
      // a projection that drops a scored signal fails here.
      expect(reply, JSON.stringify(reply.failure ?? reply.message)).toMatchObject({
        status: "succeeded",
        element: { tagName: "button", testId: "quote-submit", id: redeployedIds.send, accessibleName: "Send request" }
      });
      expect(reply.resolution).toEqual(reference.resolution);
      expect(await clicks()).toEqual(["main|Send request"]);
      // Pressed, and refused by the form's own check: the privacy box is unticked, so nothing was sent.
      await expect(page.locator(quoteDrawer.byId(redeployedIds.errors.privacy!))).toHaveText("Tick the box so we can contact you about this request");
      expect((await replay.finalState()).state).toMatchObject({ quotes: [], drafts: 0 });
    });
  }
});
