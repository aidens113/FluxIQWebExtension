// A forward run's step that asks to be found on its own page, and a list read a Flow would refuse (t869).
//
// Paid run `run-mw37vz9n-a77a02c2` read its list by hand with `dedupe` and an intermediate record output, which a Flow's
// dispatch refuses: the replay's answer then held no rows, so its loop had none to walk, and it stood on another page when
// it asked for the loop. Each of those is held here against a stub gateway.

import assert from "node:assert/strict";
import test from "node:test";
import type { JsonObject } from "fluxiq/core";
import { createWebAutomationLlmEvidenceRuntime, WEB_LLM_RUN_NODE_TOOL_ID, type WebLlmEvidenceGateway } from "../../..";

const PROJECT = { projectId: "project.one", flowId: "flow.one" };
const CLICK = "web.output.dom-click";
const NAVIGATE = "web.output.browser-navigate";
const EXTRACT_LIST = "web.output.dom-extract_list";
const LIST = "https://example.test/list";
const ELSEWHERE = "https://example.test/saved";
const PERMITTED = async () => ({ permitted: true as const });

function stub(at: string, permittedToMove = true) {
  const commands: Array<{ actionType: string; parameters: JsonObject }> = [];
  let url = at;
  const gateway: WebLlmEvidenceGateway = {
    eligibleSessionIds: () => ["session.one"],
    executeAction: async (_sessionId, command) => {
      commands.push({ actionType: command.actionType, parameters: command.parameters });
      if (command.actionType === "web.dom.capture_snapshot") {
        return { status: "succeeded", payload: { snapshot: { url, title: "Fixture", viewport: { width: 100, height: 100, scrollX: 0, scrollY: 0 }, interactiveElements: [{ tagName: "button", selector: "#go", visibleText: "Go" }] } } };
      }
      if (command.actionType === "web.browser.navigate" && permittedToMove) url = String(command.parameters.url);
      return { status: "succeeded", payload: command.actionType === "web.dom.extract_list" ? { extracted: [{ title: "A" }, { title: "B" }], extraction: { recordCount: 2 } } : { value: "ok" } };
    }
  };
  return { gateway, commands, urlNow: () => url };
}

const ask = (stubbed: ReturnType<typeof stub>, value: JsonObject, permission: () => Promise<{ permitted: boolean }> = PERMITTED) =>
  createWebAutomationLlmEvidenceRuntime(stubbed.gateway).executeTool({ ...PROJECT, callId: "fw.3.pass.2", toolId: WEB_LLM_RUN_NODE_TOOL_ID, permission: permission as typeof PERMITTED, value });
const press = (over: JsonObject = {}): JsonObject => ({ replay: "step", node: CLICK, parameters: { selector: "#go" }, consequences: [], from: { location: LIST }, ...over });
const acted = (stubbed: ReturnType<typeof stub>) => stubbed.commands.map((command) => command.actionType).filter((type) => type !== "web.dom.capture_snapshot");

test("a step that asks, on another page, moves to the address it recorded and then runs there", async () => {
  const stubbed = stub(ELSEWHERE);
  const answer = await ask(stubbed, press({ reach: true }));
  assert.deepEqual(acted(stubbed), ["web.browser.navigate", "web.dom.click"]);
  assert.equal(stubbed.commands.find((command) => command.actionType === "web.browser.navigate")?.parameters.url, LIST);
  assert.equal(stubbed.urlNow(), LIST);
  assert.equal(answer.resultCode, "core.replay.replayed");
});

test("a step that asks, already on that page, moves nothing: a reload would lose what the address does not say", async () => {
  const stubbed = stub(LIST);
  await ask(stubbed, press({ reach: true }));
  assert.deepEqual(acted(stubbed), ["web.dom.click"]);
});

test("a step that does not ask runs where the page stands, as it always did", async () => {
  const stubbed = stub(ELSEWHERE);
  await ask(stubbed, press());
  assert.deepEqual(acted(stubbed), ["web.dom.click"]);
});

test("a step that moves the page itself goes where it goes, with no move before it", async () => {
  const stubbed = stub(ELSEWHERE);
  await ask(stubbed, { replay: "step", node: NAVIGATE, parameters: { url: "https://example.test/item/2" }, consequences: [], from: { location: LIST }, reach: true });
  assert.deepEqual(stubbed.commands.filter((command) => command.actionType === "web.browser.navigate").map((command) => command.parameters.url), ["https://example.test/item/2"]);
});

test("the move is put to the gate, and refused it does not happen: the step answers for itself", async () => {
  const stubbed = stub(ELSEWHERE);
  const asked: JsonObject[] = [];
  await ask(stubbed, press({ reach: true, consequences: ["modify_existing"] }), async (request?: unknown) => {
    asked.push(request as JsonObject);
    return { permitted: asked.length > 1 };
  });
  assert.equal(stubbed.urlNow(), ELSEWHERE);
});

const READ = { item: ".row", fields: { title: ".title" } };
const OUTPUT = { datasetId: "candidates", writeMode: "replace", purpose: "intermediate", schema: { schemaVersion: "0.1", fields: [{ id: "title", label: "Title", valueType: "string" }] } };

test("a replayed list read a Flow would refuse says so, and reads nothing, instead of answering no rows", async () => {
  const stubbed = stub(LIST);
  const answer = await ask(stubbed, { replay: "step", node: EXTRACT_LIST, parameters: { extractList: { ...READ, dedupe: true }, recordOutput: OUTPUT }, consequences: [], from: { location: LIST } });
  assert.equal(answer.resultCode, "core.replay.failed");
  assert.match(String((answer.evidence as JsonObject).said), /record_output\.intermediate_process_unsupported/u);
  assert.deepEqual(acted(stubbed), []);
});

test("the same read with no dedupe answers its rows, which is what a loop walks", async () => {
  const stubbed = stub(LIST);
  const answer = await ask(stubbed, { replay: "step", node: EXTRACT_LIST, parameters: { extractList: READ, recordOutput: OUTPUT }, consequences: [], from: { location: LIST } });
  assert.equal(answer.resultCode, "core.replay.replayed");
  assert.deepEqual(answer.outputs?.records, [{ title: "A" }, { title: "B" }]);
});
