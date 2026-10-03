// A call that declared no consequences is written back without one, and a call
// already stored with `consequences: null` runs as though it said nothing.
//
// Live run 11 (`run-muq4oaof-464f5bce`): the domain wrote a read back with
// `consequences: null`, Core kept that as the step's input, each rerun's merge
// patch carried it forward, and sixteen reruns of the read were refused
// `invalid_input` / `consequences_unreadable` for a declaration nobody made.

import assert from "node:assert/strict";
import test from "node:test";
import type { JsonObject } from "fluxiq/core";
import { createWebAutomationLlmEvidenceRuntime, WEB_LLM_RUN_NODE_TOOL_ID, type WebLlmEvidenceGateway } from "../..";
import { shownPageLines } from "../../page-view/tests/shown-page-lines";
// Here rather than in `../../tests/`, which is at the structure audit's
// 25-file limit: what `null` is read as is half of this file's subject.
import { webActionPermission } from "../../permission";

const PROJECT = { projectId: "project.one", flowId: "flow.one" };
const CLICK = "web.output.dom-click";
const SNAPSHOT = "web.output.dom-capture_snapshot";
/** A node that only reads. */
const WAIT_FOR_TEXT = "web.output.dom-wait_for_text";
const PERMITTED = async () => ({ permitted: true as const });

test("a read that declared nothing is written back with no consequences key at all", async () => {
  const stubbed = stub();
  const runtime = createWebAutomationLlmEvidenceRuntime(stubbed.gateway);
  const looked = await runtime.executeTool({ ...PROJECT, callId: "call.one", toolId: WEB_LLM_RUN_NODE_TOOL_ID, value: { node: SNAPSHOT, parameters: {} } });
  assert.equal(Object.hasOwn(looked.draft?.input ?? {}, "consequences"), false);
  assert.equal(Object.hasOwn(looked.draft?.ranWith ?? {}, "consequences"), false);

  const read = await runtime.executeTool({ ...PROJECT, callId: "call.two", toolId: WEB_LLM_RUN_NODE_TOOL_ID, value: { node: WAIT_FOR_TEXT, parameters: { text: "Go" } } });
  assert.equal(read.resultCode, "web.inspect.succeeded");
  // What Core keeps as the step's input, and what the Flow keeps: neither
  // carries a declaration the call did not make.
  assert.deepEqual(read.draft?.input, { node: WAIT_FOR_TEXT, parameters: { text: "Go" } });
  assert.deepEqual(read.draft?.ranWith, { node: WAIT_FOR_TEXT, parameters: { text: "Go" } });
});

test("a rerun of a read stored with consequences: null runs, and stops carrying the null", async () => {
  const stubbed = stub();
  const runtime = createWebAutomationLlmEvidenceRuntime(stubbed.gateway);
  await runtime.executeTool({ ...PROJECT, callId: "call.one", toolId: WEB_LLM_RUN_NODE_TOOL_ID, value: { node: SNAPSHOT, parameters: {}, consequences: [] } });

  // The merged input of run 11's `rerun.9.2`: the stored `null` and the model's patch.
  const rerun = await runtime.executeTool({
    ...PROJECT, callId: "rerun.9.2", toolId: WEB_LLM_RUN_NODE_TOOL_ID, permission: PERMITTED,
    value: { node: WAIT_FOR_TEXT, parameters: { text: "Go" }, consequences: null }
  });
  assert.equal(rerun.resultCode, "web.inspect.succeeded", JSON.stringify(rerun.evidence));
  assert.equal(rerun.effectApplied, true);
  assert.equal(stubbed.commands.some((command) => command.actionType === "web.dom.wait_for_text"), true);
  assert.equal(Object.hasOwn(rerun.draft?.input ?? {}, "consequences"), false);
  assert.equal(Object.hasOwn(rerun.draft?.ranWith ?? {}, "consequences"), false);
});

test("a press with consequences: null is refused as a declaration missing, and is not pressed", async () => {
  const stubbed = stub();
  const runtime = createWebAutomationLlmEvidenceRuntime(stubbed.gateway);
  const looked = await runtime.executeTool({ ...PROJECT, callId: "call.one", toolId: WEB_LLM_RUN_NODE_TOOL_ID, value: { node: SNAPSHOT, parameters: {}, consequences: [] } });
  const handle = shownPageLines(looked.evidence)[0]!.target;

  const refused = await runtime.executeTool({
    ...PROJECT, callId: "call.two", toolId: WEB_LLM_RUN_NODE_TOOL_ID, permission: PERMITTED,
    value: { node: CLICK, parameters: { target: { handle } }, consequences: null }
  });
  const evidence = refused.evidence as JsonObject & { code: string; detail: { reason: string } };
  assert.equal(evidence.code, "invalid_input");
  // The same answer as a press that left the key out: what to write, not that it was unreadable.
  assert.equal(evidence.detail.reason, "missing_input_keys");
  assert.equal(stubbed.commands.some((command) => command.actionType === "web.dom.click"), false);
  // And the refused call is not written back carrying the null either.
  assert.equal(Object.hasOwn(refused.draft?.input ?? {}, "consequences"), false);
});

test("the permission check reads null from a read as none declared, and from an act as unreadable", async () => {
  const control = { name: "Go", kind: "button" };
  let asked = 0;
  const check = async () => {
    asked += 1;
    return { permitted: true as const };
  };
  assert.deepEqual(await webActionPermission({ check, declared: null, control, verb: "read", effect: "observe" }), { kind: "no_consequence" });
  assert.deepEqual(await webActionPermission({ check: undefined, declared: null, control, verb: "read", effect: "observe" }), { kind: "no_consequence" });
  // The same as a read that left the key out.
  assert.deepEqual(await webActionPermission({ check, declared: undefined, control, verb: "read", effect: "observe" }), { kind: "no_consequence" });
  // An act is never taken on a `null`, asked or not: the press tool requires
  // the key and would otherwise press without Core having been asked.
  assert.deepEqual(await webActionPermission({ check, declared: null, control, verb: "press", effect: "mutate" }), { kind: "invalid" });
  assert.deepEqual(await webActionPermission({ check: undefined, declared: null, control, verb: "press", effect: "mutate" }), { kind: "invalid" });
  // And a read's declaration that is something other than a list is still unreadable.
  assert.deepEqual(await webActionPermission({ check: undefined, declared: "none", control, verb: "read", effect: "observe" }), { kind: "invalid" });
  assert.equal(asked, 0);
});

// A declaration written inside `parameters` rather than beside them is read
// where it was written (`../nested-consequences.ts`). Live run
// `run-murzln6g-11debe1d` had three presses refused `missing_input_keys` for
// exactly this, each costing a paid decision to resend.

test("a press declaring [] inside its parameters runs, recorded with [] beside the parameters", async () => {
  const stubbed = stub();
  const runtime = createWebAutomationLlmEvidenceRuntime(stubbed.gateway);
  const handle = await firstHandle(runtime);
  const pressed = await runtime.executeTool({
    ...PROJECT, callId: "call.two", toolId: WEB_LLM_RUN_NODE_TOOL_ID, permission: PERMITTED,
    value: { node: CLICK, parameters: { target: { handle }, consequences: [] } }
  });
  assert.equal(pressed.resultCode, "web.action.succeeded", JSON.stringify(pressed.evidence));
  const click = stubbed.commands.find((command) => command.actionType === "web.dom.click");
  assert.ok(click);
  assert.equal(Object.hasOwn(click.parameters, "consequences"), false);
  assert.deepEqual(pressed.draft?.input, { node: CLICK, parameters: { target: { handle } }, consequences: [] });
  const ranWith = pressed.draft?.ranWith as JsonObject & { parameters: JsonObject };
  assert.deepEqual(ranWith.consequences, []);
  assert.equal(Object.hasOwn(ranWith.parameters, "consequences"), false);
});

test("a nested [\"modify_existing\"] reaches the permission check as the call's declaration", async () => {
  const stubbed = stub();
  const runtime = createWebAutomationLlmEvidenceRuntime(stubbed.gateway);
  const handle = await firstHandle(runtime);
  const asked: unknown[] = [];
  const pressed = await runtime.executeTool({
    ...PROJECT, callId: "call.two", toolId: WEB_LLM_RUN_NODE_TOOL_ID,
    permission: async (request) => {
      asked.push(request.consequences);
      return { permitted: true as const };
    },
    value: { node: CLICK, parameters: { target: { handle }, consequences: ["modify_existing"] } }
  });
  assert.deepEqual(asked, [["modify_existing"]]);
  assert.deepEqual(pressed.draft?.input, { node: CLICK, parameters: { target: { handle } }, consequences: ["modify_existing"] });
});

test("a press declaring nothing anywhere is still refused missing_input_keys", async () => {
  const stubbed = stub();
  const runtime = createWebAutomationLlmEvidenceRuntime(stubbed.gateway);
  const handle = await firstHandle(runtime);
  const refused = await runtime.executeTool({
    ...PROJECT, callId: "call.two", toolId: WEB_LLM_RUN_NODE_TOOL_ID, permission: PERMITTED,
    value: { node: CLICK, parameters: { target: { handle } } }
  });
  const evidence = refused.evidence as JsonObject & { code: string; detail: { reason: string } };
  assert.equal(evidence.code, "invalid_input");
  assert.equal(evidence.detail.reason, "missing_input_keys");
  assert.equal(stubbed.commands.some((command) => command.actionType === "web.dom.click"), false);
});

test("a declaration beside the parameters wins over one inside them", async () => {
  const stubbed = stub();
  const runtime = createWebAutomationLlmEvidenceRuntime(stubbed.gateway);
  const handle = await firstHandle(runtime);
  const asked: unknown[] = [];
  const pressed = await runtime.executeTool({
    ...PROJECT, callId: "call.two", toolId: WEB_LLM_RUN_NODE_TOOL_ID,
    permission: async (request) => {
      asked.push(request.consequences);
      return { permitted: true as const };
    },
    value: { node: CLICK, parameters: { target: { handle }, consequences: ["modify_existing"] }, consequences: [] }
  });
  assert.deepEqual(asked, [[]]);
  assert.deepEqual((pressed.draft?.input as JsonObject).consequences, []);
});

async function firstHandle(runtime: ReturnType<typeof createWebAutomationLlmEvidenceRuntime>): Promise<string> {
  const looked = await runtime.executeTool({ ...PROJECT, callId: "call.one", toolId: WEB_LLM_RUN_NODE_TOOL_ID, value: { node: SNAPSHOT, parameters: {}, consequences: [] } });
  return shownPageLines(looked.evidence)[0]!.target;
}

function stub() {
  const commands: Array<{ actionType: string; parameters: JsonObject }> = [];
  const gateway: WebLlmEvidenceGateway = {
    eligibleSessionIds: () => ["session.one"],
    executeAction: async (_sessionId, command) => {
      commands.push({ actionType: command.actionType, parameters: command.parameters });
      if (command.actionType === "web.dom.capture_snapshot") return { status: "succeeded", payload: { snapshot: page() } };
      return { status: "succeeded", payload: { value: "ok" } };
    }
  };
  return { gateway, commands };
}

function page(): JsonObject {
  return {
    url: "https://example.test/start",
    title: "Fixture",
    viewport: { width: 100, height: 100, scrollX: 0, scrollY: 0 },
    interactiveElements: [{ tagName: "button", selector: "#go", visibleText: "Go" }]
  };
}
