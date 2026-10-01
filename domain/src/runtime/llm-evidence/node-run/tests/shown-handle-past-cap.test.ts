// A handle the model was just shown stays pressable when the look a press takes
// before it acts no longer describes that control.
//
// Live run `run-muohbi3e-e5847e5a` (crossborder-marketplace search): a click
// came back with a packet whose last two elements were the results sidebar's
// "Voltbay" brand filter and its "OK" button, the packet filled to its forty
// elements. A notice ("Not now" / "Allow") then appeared higher up the page, so
// the look the next call took before acting described two more controls ahead
// of the filter and ended at "Qinport". That look was never returned to the
// model, but it was remembered as the page's packet, replacing the one the
// model had read -- and the press on "Voltbay" was refused
// `handle_not_in_packet` four times over, twice straight after a packet that
// showed it.
//
// The stub page below is that shape: forty controls down to the filter, more
// below them, and a notice that appears after the first look. Since t200 the
// packet is never cut at forty, so the model is shown the whole page and the
// look before the press describes the filter too; the handle must still press.

import assert from "node:assert/strict";
import test from "node:test";
import type { JsonObject } from "fluxiq/core";
import { createWebAutomationLlmEvidenceRuntime, WEB_LLM_RUN_NODE_TOOL_ID, type WebLlmEvidenceGateway } from "../..";

const PROJECT = { projectId: "project.crossborder", flowId: "flow.crossborder" };
const PAGE = "https://farbazaar.test/scenarios/crossborder-marketplace/search";
const CLICK = "web.output.dom-click";
const SNAPSHOT = "web.output.dom-capture_snapshot";
const VOLTBAY = "aside > div:nth-of-type(6) > label:nth-of-type(4) > div";

type Packet = JsonObject & { elements?: Array<{ target: string; text?: string; name?: string }> };
type Element = JsonObject & { selector: string };

/** Where the live packet ended: at its forty elements, the old bound. */
const LIVE_PACKET_LENGTH = 40;
/** The page's controls without the notice: forty down to the filter, and five results. */
const PAGE_LENGTH = LIVE_PACKET_LENGTH + 5;

/**
 * A results page whose forty described controls end at the brand filter, and a
 * notice above the sidebar on the looks `noticeOn` names (the first look is 1).
 */
function searchPage(noticeOn: (look: number) => boolean) {
  const clicked: string[] = [];
  let looks = 0;
  const upper: Element[] = Array.from({ length: LIVE_PACKET_LENGTH - 2 }, (_, index) => ({ tagName: "button", selector: `#control-${index + 1}`, visibleText: `Control ${index + 1}` }));
  const filter: Element[] = [
    { tagName: "div", selector: VOLTBAY, visibleText: "Voltbay" },
    { tagName: "button", selector: "aside .brand-ok", visibleText: "OK" }
  ];
  const results: Element[] = Array.from({ length: 5 }, (_, index) => ({ tagName: "a", selector: `main .result:nth-of-type(${index + 1}) > a`, visibleText: `Result ${index + 1}`, href: `${PAGE}/item/${index + 1}` }));
  const notice: Element[] = [
    { tagName: "button", selector: "#notify-prompt .not-now", visibleText: "Not now" },
    { tagName: "button", selector: "#notify-prompt .allow", visibleText: "Allow" }
  ];
  const snapshot = (): JsonObject => {
    looks += 1;
    const withNotice = noticeOn(looks);
    return {
      url: PAGE,
      title: "usb c hub 7 in 1 - Farbazaar",
      viewport: { width: 1280, height: 800, scrollX: 0, scrollY: 0 },
      interactiveElements: [...upper.slice(0, 20), ...(withNotice ? notice : []), ...upper.slice(20), ...filter, ...results]
    };
  };
  const gateway: WebLlmEvidenceGateway = {
    eligibleSessionIds: () => ["session.one"],
    executeAction: async (_sessionId, command) => {
      if (command.actionType === "web.dom.click") {
        clicked.push(String((command.parameters as { selector?: unknown }).selector));
        return { status: "succeeded", payload: { value: "ok" } };
      }
      return { status: "succeeded", payload: { snapshot: snapshot() } };
    }
  };
  return { gateway, clicked };
}

async function look(runtime: ReturnType<typeof createWebAutomationLlmEvidenceRuntime>): Promise<Packet> {
  const looked = await runtime.executeTool({ ...PROJECT, callId: "look", toolId: WEB_LLM_RUN_NODE_TOOL_ID, value: { node: SNAPSHOT, parameters: {}, consequences: [] } });
  return looked.evidence as Packet;
}

function press(runtime: ReturnType<typeof createWebAutomationLlmEvidenceRuntime>, callId: string, handle: string) {
  return runtime.executeTool({ ...PROJECT, callId, toolId: WEB_LLM_RUN_NODE_TOOL_ID, value: { node: CLICK, parameters: { target: { handle } }, consequences: [] } });
}

test("a handle from the packet just shown is pressed even when the look before the press no longer describes it", async () => {
  // Up from the look before the press on, as it was live.
  const page = searchPage((look) => look > 1);
  const runtime = createWebAutomationLlmEvidenceRuntime(page.gateway);
  const shown = await look(runtime);
  // The packet the model read is the whole page, results included (t200).
  assert.equal(shown.elements!.length, PAGE_LENGTH);
  const voltbay = shown.elements!.find((element) => element.text === "Voltbay");
  assert.ok(voltbay, "the packet shows the Voltbay filter");

  const pressed = await press(runtime, "press-voltbay", voltbay.target);

  assert.equal(pressed.resultCode, "web.action.succeeded", JSON.stringify(pressed.evidence));
  assert.equal(pressed.effectApplied, true);
  assert.deepEqual(page.clicked, [VOLTBAY]);
  assert.equal((pressed.draft?.ranWith?.parameters as { selector?: string }).selector, VOLTBAY);
  // The control is named in the words the model was shown, though the look before the press did not describe it.
  assert.equal((pressed.evidence as JsonObject & { control?: string }).control, "Voltbay");
});

test("a handle from the packet a press returned is pressed next, though the next press's own look does not reach it", async () => {
  // Live, nav5's click returned a packet ending at "Voltbay" and nav7's press on
  // it was refused: the notice was up for the look each press took before it
  // acted, and gone for the looks the model was shown.
  const page = searchPage((look) => look % 2 === 0);
  const runtime = createWebAutomationLlmEvidenceRuntime(page.gateway);
  const shown = await look(runtime);
  const first = await press(runtime, "press-first", shown.elements![0]!.target);
  assert.equal(first.resultCode, "web.action.succeeded");
  const voltbay = (first.evidence as Packet).elements!.find((element) => element.text === "Voltbay");
  assert.ok(voltbay, "the packet the first press returned shows the Voltbay filter");

  const pressed = await press(runtime, "press-voltbay", voltbay.target);

  assert.equal(pressed.resultCode, "web.action.succeeded", JSON.stringify(pressed.evidence));
  assert.deepEqual(page.clicked, ["#control-1", VOLTBAY]);
});
