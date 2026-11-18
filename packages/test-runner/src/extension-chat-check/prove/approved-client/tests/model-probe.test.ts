import assert from "node:assert/strict";
import test from "node:test";
import type { ObservedCoreCall } from "../../../core-recording-proxy.js";
import type { ChatCheckContext } from "../../../types.js";
import { probeApprovedClientModel } from "../model-probe.js";

function contextFor(options: { model: boolean; pairedReply: boolean; bearer?: boolean; status?: number }) {
  const calls: ObservedCoreCall[] = [];
  const modelCalls: { answered: boolean }[] = [];
  const receipts: string[] = [];
  const requested: Record<string, unknown>[] = [];
  const context = {
    projectId: "project.fixture", coreCalls: () => calls,
    session: { control: { evaluate: async (_fn: unknown, message: Record<string, unknown>) => {
      requested.push(message);
      if (message.type === "fluxiq.panel.conversationSend") {
        calls.push({ at: 1, method: "POST", path: "/api/programs/automation-studio/append-turn", endpoint: "append-turn", bearer: options.bearer ?? true, request: { text: message.text, conversationId: "conversation.fixture" }, status: options.status ?? 200, response: {} });
        if (options.model) {
          modelCalls.push({ answered: true });
          receipts.push("configured-later");
        }
        return { ok: true };
      }
      return { ok: true, payload: { conversation: { turns: options.pairedReply ? [{ author: "automation", text: "Approved client access confirmed: configured-later" }] : [] } } };
    } } }
  } as unknown as ChatCheckContext;
  return { context, requested, model: { calls: () => modelCalls, receipts: () => receipts } };
}

test("the proof measures a paired request, a real stub receipt and a paired read of the exact reply", async () => {
  const h = contextFor({ model: true, pairedReply: true });
  assert.deepEqual(await probeApprovedClientModel(h.context, "configured-later", h.model), { name: "configured-later", bearer: true, status: 200, modelCalls: 1, stubReceivedProbe: true, pairedReadReturnedReply: true });
  assert.deepEqual(h.requested.map((message) => message.type), ["fluxiq.panel.conversationSend", "fluxiq.panel.conversationRead"]);
  assert.ok(h.requested.every((message) => message.projectId === "project.fixture"));
});

test("successful metadata or a canned reply cannot stand in for a model request", async () => {
  const h = contextFor({ model: false, pairedReply: true });
  const measured = await probeApprovedClientModel(h.context, "configured-later", h.model);
  assert.equal(measured.stubReceivedProbe, false);
  assert.equal(measured.modelCalls, 0);
});

test("a stub call alone cannot prove the approved client could read its result", async () => {
  const h = contextFor({ model: true, pairedReply: false, bearer: false, status: 403 });
  const measured = await probeApprovedClientModel(h.context, "configured-later", h.model);
  assert.equal(measured.bearer, false);
  assert.equal(measured.status, 403);
  assert.equal(measured.pairedReadReturnedReply, false);
});
