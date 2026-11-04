import assert from "node:assert/strict";
import test from "node:test";

import { AUTOMATION_PANEL_MESSAGES, type AutomationPanelRequest, type PanelRelayResponse } from "../../../shared/protocol";
import { handleAutomationRelay, type AutomationRelayDeps } from "../automation-relay";

// The project's library of saved parts: Core is sent exactly the named fields, never the panel's message.
type Call = { endpoint: string; payload: Record<string, unknown>; programId: string | undefined };

function harness(answers: Record<string, PanelRelayResponse> = {}, overrides: Partial<AutomationRelayDeps> = {}) {
  const calls: Call[] = [];
  const deps: AutomationRelayDeps = {
    isControlPage: () => true,
    call: async (endpoint, payload, programId) => {
      calls.push({ endpoint, payload, programId });
      return answers[endpoint] ?? { ok: true, payload: {} };
    },
    projectId: () => "project-1",
    lastStoppedRecordingId: () => undefined,
    removeRecordedStep: async () => ({ ok: true, payload: {} }),
    ...overrides
  };
  const send = async (message: Record<string, unknown>) => {
    const result = await handleAutomationRelay(message as { type?: unknown } & AutomationPanelRequest, {} as chrome.runtime.MessageSender, deps);
    assert.equal(result.handled, true);
    return (result as { response: PanelRelayResponse }).response;
  };
  return { calls, send };
}

test("a search of the parts library sends only its named fields, trimmed, and drops what is not one", async () => {
  const payload = { parts: [{ partId: "part.a" }], nextCursor: null, hasMore: false };
  const h = harness({ "list-project-parts": { ok: true, payload } });
  const reply = await h.send({
    type: AUTOMATION_PANEL_MESSAGES.listParts,
    query: "  shoes ", site: "shop.example", inputName: ["Search words", 3, ""], outputName: "Results found", lasting: ["move_money"], trust: "provisional",
    usedByFlowId: "flow-2", sourceFlowId: "flow-3", limit: 10, cursor: "c1",
    flowId: "flow-9", permittedConsequences: ["move_money"], partId: "part.zzz", pool: {}
  });
  assert.deepEqual(reply, { ok: true, payload });
  assert.deepEqual(h.calls, [{
    endpoint: "list-project-parts",
    payload: { projectId: "project-1", query: "shoes", site: "shop.example", usedByFlowId: "flow-2", sourceFlowId: "flow-3", inputName: ["Search words"], outputName: "Results found", lasting: ["move_money"], trust: "provisional", limit: 10, cursor: "c1" },
    programId: undefined
  }]);
  await h.send({ type: AUTOMATION_PANEL_MESSAGES.listParts, limit: 0, cursor: null, query: "   ", trust: [] });
  assert.deepEqual(h.calls[1]?.payload, { projectId: "project-1" });
});

test("reading a part names its id and version only, and a part without an id never reaches Core", async () => {
  const h = harness();
  await h.send({ type: AUTOMATION_PANEL_MESSAGES.getPart, partId: "part.a", version: 2, snapshot: true, flowId: "flow-1" });
  await h.send({ type: AUTOMATION_PANEL_MESSAGES.getPart, partId: "part.b", version: 1.5 });
  assert.deepEqual(h.calls.map((call) => [call.endpoint, call.payload]), [
    ["get-project-part", { projectId: "project-1", partId: "part.a", version: 2 }],
    ["get-project-part", { projectId: "project-1", partId: "part.b" }]
  ]);
  assert.deepEqual(await h.send({ type: AUTOMATION_PANEL_MESSAGES.getPart }), { ok: false, code: "invalid_request", error: "That request is missing its partId." });
  assert.equal(h.calls.length, 2);
});

test("keeping a part sends its five fields and nothing else, and needs its Flow and Subflow", async () => {
  const payload = { saved: false, code: "part.unclassified_step", message: "..." };
  const h = harness({ "save-project-part": { ok: true, payload } });
  const reply = await h.send({ type: AUTOMATION_PANEL_MESSAGES.savePart, flowId: "flow-1", subflowId: "sub-1", name: " Keep ", purpose: "Keeps it", explicit: true, role: "primary", partId: "part.x", authorizationPin: "1234" });
  assert.deepEqual(reply, { ok: true, payload });
  assert.deepEqual(h.calls.map((call) => [call.endpoint, call.payload]), [["save-project-part", { projectId: "project-1", flowId: "flow-1", subflowId: "sub-1", name: "Keep", purpose: "Keeps it" }]]);
  assert.deepEqual(await h.send({ type: AUTOMATION_PANEL_MESSAGES.savePart, subflowId: "sub-1" }), { ok: false, code: "invalid_request", error: "That request is missing its flowId." });
  assert.deepEqual(await h.send({ type: AUTOMATION_PANEL_MESSAGES.savePart, flowId: "flow-1" }), { ok: false, code: "invalid_request", error: "That request is missing its subflowId." });
  assert.equal(h.calls.length, 1);
});

test("a refusal from the library is passed on as Core answered it", async () => {
  const refusal = { refused: true, code: "parts.unavailable", message: "This project's library of saved parts is not available right now." };
  const h = harness({ "list-project-parts": { ok: true, payload: refusal } });
  assert.deepEqual(await h.send({ type: AUTOMATION_PANEL_MESSAGES.listParts }), { ok: true, payload: refusal });
});

test("the parts library answers only the panel, and needs a project", async () => {
  const closed = harness({}, { isControlPage: () => false });
  assert.equal((await closed.send({ type: AUTOMATION_PANEL_MESSAGES.listParts })).ok, false);
  const unpaired = harness({}, { projectId: () => undefined });
  assert.equal((await unpaired.send({ type: AUTOMATION_PANEL_MESSAGES.savePart, flowId: "f", subflowId: "s" })).ok, false);
  assert.equal(closed.calls.length + unpaired.calls.length, 0);
});
