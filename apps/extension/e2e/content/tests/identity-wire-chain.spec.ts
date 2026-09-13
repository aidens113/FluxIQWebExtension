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
// What that cost, measured live (`reports/L-replay.md`) and reproduced number
// for number in real Chromium (`reports/i-resolver-safety.md`, rows R5-R6):
// until `ab736a1` the projection was a hand-written list of seventeen keys with
// no `testId`, `accessibleName`, `label`, `implicitRole` or `context`. The
// domain re-derives a test id from `attributes` and a name only from an
// `aria-label`, and the baseline Save has none, so `reworded-aria` reached the
// resolver with no accessible name and no role. It scored 0.197, confidence
// 0.173, and was refused. With both signals across the wire it scores 0.389,
// confidence 0.366 -- the same numbers `identity-resolution.spec.ts` pins for
// the full descriptor, which is the point: the wire now loses nothing the
// resolver scores.
//
// Scope. Core stores the event between the projection and the node, and
// prepares the element target on dispatch; neither hop runs here. The Lab run
// `identity-drift --flow --variant reworded-aria` is what covers them.

import { webAutomationActionFromGatewayCommand, webAutomationOutputPayload } from "@fluxiq-web-extension/domain/client";
import { gatewayRecordingEventFromPayload } from "../../../src/background/connection/index.js";
import { expect, test } from "../index.js";
import type { ContentHarness } from "../index.js";
import { DISPLAY_NAME, SAVE_BASELINE, armMode } from "./identity-fixtures.js";

type ActionCommand = Parameters<ContentHarness["runAction"]>[0];
type RecordedEvent = Awaited<ReturnType<ContentHarness["recordedEvents"]>>[number];
type NodePayload = Parameters<typeof webAutomationOutputPayload>[1];

const QUIET = { captureMutations: false, captureInputValues: true, captureSnapshots: false };

/**
 * Records a real click on the baseline Save and returns the event a live
 * recording keeps. The recorder sends a `dom.click` for the press and another
 * for the click; `PointerClickFilter` keeps the first to arrive, the press.
 * Recording stays on until that event is in: `click()` can return before the
 * page has handled the mouse events, and stopping first records nothing.
 */
async function recordSaveClick(harness: ContentHarness): Promise<RecordedEvent> {
  const press = async () => (await harness.recordedEvents("dom.click")).find((event) => event.metadata?.sourceEvent === "pointerdown");
  await harness.setRecording(true, QUIET);
  await harness.page.locator(SAVE_BASELINE).click();
  await expect.poll(press, "the press on Save was recorded").toBeDefined();
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
    // to land on Save could not stand in for a signal the wire lost.
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

test.describe("identity wire chain: a recorded click survives the wire and resolves reworded-aria", () => {
  for (const shape of SHAPES) {
    test(`${shape.name}: the redesigned Save resolves, and Discard is not touched`, async ({ openHarness, page }) => {
      const harness = await openHarness("identity-drift");
      const displayName = await page.locator(DISPLAY_NAME).inputValue();
      const recorded = await recordSaveClick(harness);
      // The recorder captured both signals the old wire dropped. Were this to
      // fail, the loss is upstream of everything the rest of the row measures.
      expect(recorded.element).toMatchObject({ selector: "#save-settings", testId: "save-changes", accessibleName: "Save changes", implicitRole: "button" });

      const parameters = webAutomationOutputPayload("web.dom.click", acrossTheWire(recorded));
      // Arming resets the fixture's counters, so the recorded click above is
      // not counted as the replay's.
      await armMode(harness, "reworded-aria");

      const reply = await harness.runAction(shape.command(parameters));

      // One assertion, so a failure prints the status and the scores together:
      // a projection that drops the name and role fails here at 0.197.
      expect(reply, reply.message).toMatchObject({
        status: "succeeded",
        resolution: { strategy: "scored-candidate", candidateCount: 2, bestScore: expect.closeTo(0.389, 3), confidence: expect.closeTo(0.366, 3) },
        element: { tagName: "button", accessibleName: "Save changes", visibleText: "Save" }
      });
      await expect
        .poll(async () => (await harness.finalState()).state)
        .toMatchObject({ savedInMode: "reworded-aria", savedDisplayName: displayName, saveCount: 1, discardCount: 0 });
    });
  }
});
