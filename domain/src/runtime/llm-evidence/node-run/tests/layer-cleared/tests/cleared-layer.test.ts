// A press that cleared a layer covering the page says so on its answer (t787
// fix 1 of `run-mvskptb1-c9cef4fe`): `layerCleared`, the layer's opaque
// signature and the handle the press used, which Core makes a handler of. The
// page: a list of items, and a side panel with no name the site opens over part
// of it, whose one control collapses it.

import assert from "node:assert/strict";
import test from "node:test";
import type { JsonObject } from "fluxiq/core";
import { createWebAutomationLlmEvidenceRuntime, WEB_LLM_RUN_NODE_TOOL_ID, type WebLlmEvidenceGateway } from "../../../..";
import { shownHandle } from "../../../../page-view/tests/shown-page-lines";

const PROJECT = { projectId: "project.cleared", flowId: "flow.cleared" } as const;
const URL = "https://gallery.example/studio";
const LOOK = "web.output.dom-capture_snapshot";
const CLICK = "web.output.dom-click";
const PANEL = "body > aside";
const COLLAPSE = `${PANEL} > button`;

function gallery(): { gateway: WebLlmEvidenceGateway; clicks: string[] } {
  let panel = true;
  let status = "Nothing opened";
  const clicks: string[] = [];
  const gateway: WebLlmEvidenceGateway = {
    eligibleSessionIds: () => ["session.one"],
    executeAction: async (_sessionId, command) => {
      if (command.actionType === "web.dom.click") {
        const selector = String(command.parameters.selector);
        clicks.push(selector);
        if (selector === COLLAPSE) panel = false;
        if (selector === "body > main > a:nth-of-type(1)") status = "First item opened";
        return { status: "succeeded" };
      }
      if (command.actionType !== "web.dom.capture_snapshot") return { status: "succeeded" };
      return { status: "succeeded", payload: { snapshot: snapshot(panel, status) } };
    }
  };
  return { gateway, clicks };
}

function snapshot(panel: boolean, status: string): JsonObject {
  const items: JsonObject[] = [
    { tagName: "a", selector: "body > main > a:nth-of-type(1)", visibleText: "First item", attributes: { href: "/p/1" } },
    { tagName: "a", selector: "body > main > a:nth-of-type(2)", visibleText: "Second item", attributes: { href: "/p/2" } },
    { tagName: "p", selector: "body > main > p", visibleText: status }
  ];
  if (!panel) return { url: URL, title: "Studio", interactiveElements: items };
  // The panel has no name and no kind a classifier knows; its control is an icon with no words.
  const layer: JsonObject[] = [{ tagName: "aside", selector: PANEL, frontLayer: true }, { tagName: "button", selector: COLLAPSE, accessibleName: "Collapse", parent: 0 }];
  const blocker: JsonObject = { selector: PANEL, blocks: 1, blocked: ["body > main > a:nth-of-type(2)"] };
  return { url: URL, title: "Studio", interactiveElements: [...layer, ...items], evidence: { overlays: { tested: 3, blockedCount: 1, blockers: [blocker] } } };
}

let calls = 0;
async function call(runtime: ReturnType<typeof createWebAutomationLlmEvidenceRuntime>, node: string, parameters: JsonObject) {
  calls += 1;
  return await runtime.executeTool({ ...PROJECT, callId: `call.${calls}`, toolId: WEB_LLM_RUN_NODE_TOOL_ID, value: { node, parameters, consequences: [] } });
}

test("a press of the covering panel's own control that leaves it covering nothing reports layerCleared with the handle it used", async () => {
  const page = gallery();
  const runtime = createWebAutomationLlmEvidenceRuntime(page.gateway);
  const looked = await call(runtime, LOOK, {});
  const collapse = shownHandle(looked.evidence, "Collapse");
  const pressed = await call(runtime, CLICK, { target: { handle: collapse } });
  assert.equal(pressed.resultCode, "web.action.succeeded", JSON.stringify(pressed.evidence));
  assert.deepEqual(page.clicks, [COLLAPSE]);
  const cleared = (pressed.evidence as { layerCleared?: { signature: JsonObject; control: string } }).layerCleared;
  assert.equal(cleared?.control, collapse);
  assert.deepEqual(cleared?.signature, { layer: { tag: "aside" }, control: { tag: "button", name: "Collapse" } });
  // Shown to the model with the rest of the answer, so it names no locator.
  assert.equal(JSON.stringify(cleared).includes("aside >"), false);
});

test("a press that clears nothing reports no layerCleared", async () => {
  const page = gallery();
  const runtime = createWebAutomationLlmEvidenceRuntime(page.gateway);
  const looked = await call(runtime, LOOK, {});
  const pressed = await call(runtime, CLICK, { target: { handle: shownHandle(looked.evidence, "First item") } });
  assert.equal(pressed.resultCode, "web.action.succeeded", JSON.stringify(pressed.evidence));
  assert.equal((pressed.evidence as { layerCleared?: unknown }).layerCleared, undefined);
});
