// Focused real SQLite/service acceptance: required playback retry history and
// durable context handling need the real service. Only a trusted paired test
// transport is stubbed; no browser, provider or user data is available.
import assert from "node:assert/strict";
import test, { type TestContext } from "node:test";
import { mkdtemp, rm } from "node:fs/promises";
import os from "node:os";
import path from "node:path";
import { FluxIQ } from "fluxiq";
import { CLIENT_GATEWAY_PROTOCOL_VERSION, type ClientGatewayActionResult } from "fluxiq/client-gateway";
import { AutomationStudioNativeNodeRuntime, parseAutomationStudioFailureRecord, type AutomationStudioFailureRecord } from "fluxiq/automation";
import type { JsonObject } from "fluxiq/core";
import { WEB_AUTOMATION_DOMAIN_ID, WEB_AUTOMATION_FAILURE_CODES, webAutomationFailureRecord, type WebAutomationFailureCode } from "../../../../client";
import { createWebAutomationDomainIo, createWebAutomationOutputNodeManifest, createWebAutomationOutputNodeImplementationBundle, WEB_AUTOMATION_RUNTIME_PERMISSIONS, WEB_AUTOMATION_RUNTIME_CAPABILITIES } from "../../../../index";
import { createWebAutomationRuntimeAdapter } from "../../..";

const PARAMETERS: JsonObject = { nextPage: { item: "article", pagination: { mode: "loadMore", control: "#continue" } } };

function failure(code: WebAutomationFailureCode, effect?: "unacted" | "ambiguous", retryable?: boolean): AutomationStudioFailureRecord & JsonObject {
  const canonical = webAutomationFailureRecord(code);
  assert.ok(canonical.stage !== undefined);
  const record: AutomationStudioFailureRecord & JsonObject = { category: canonical.category, code, stage: canonical.stage, retryable: retryable ?? canonical.retryable };
  if (effect !== undefined) record.effect = effect;
  else if (canonical.effect !== undefined) record.effect = canonical.effect;
  if (canonical.certainNoEffect !== undefined) record.certainNoEffect = canonical.certainNoEffect;
  assert.deepEqual(parseAutomationStudioFailureRecord(record), record);
  return record;
}

async function realHost(t: TestContext) {
  const root = await mkdtemp(path.join(os.tmpdir(), "t839-paging-playback-"));
  const create = () => FluxIQ.create({ rootDir: root, domainId: WEB_AUTOMATION_DOMAIN_ID, loadEnv: false, modelProvidersEnabled: false });
  const bootstrap = create();
  for (const [key, location] of Object.entries(bootstrap.paths)) {
    if (key === "domainId" || typeof location !== "string") continue;
    const relative = path.relative(root, path.resolve(location));
    assert.ok(relative !== ".." && !relative.startsWith(`..${path.sep}`) && !path.isAbsolute(relative), "all test storage stays inside the isolated root");
  }
  try {
    await bootstrap.setup();
  } finally {
    await bootstrap.close();
  }
  const fluxiq = create();
  // Core's retry backoff is intentionally unreferenced. The live service
  // process is long-lived; this isolated fixture holds it until teardown.
  const keepalive = setInterval(() => undefined, 1000);
  t.after(async () => {
    clearInterval(keepalive);
    await fluxiq.close();
    const owned = path.resolve(root);
    assert.ok(path.dirname(owned) === path.resolve(os.tmpdir()) && path.basename(owned).startsWith("t839-paging-playback-"));
    await rm(owned, { recursive: true, force: true, maxRetries: 10, retryDelay: 50 });
  });
  const io = createWebAutomationDomainIo(fluxiq);
  fluxiq.io.register(io);
  const output = io.outputs?.find((entry) => entry.definition.id === "web.dom.next_page");
  assert.ok(output !== undefined && "dispatch" in output && typeof output.dispatch === "function");
  const dispatchOutput = output.dispatch;
  fluxiq.runtime.registerAdapter(createWebAutomationRuntimeAdapter({ fluxiq }));
  const gateway = fluxiq.programs.clientGateway;
  let replies: readonly (AutomationStudioFailureRecord & JsonObject)[] = [];
  let sent = 0;
  let advanced = 0;
  const client = gateway.connect({ socket: { send: (raw) => {
    const message = JSON.parse(raw);
    if (message.type !== "server.execute_action") return;
    const action = message.payload.actionType;
    let result: ClientGatewayActionResult;
    if (action === "web.dom.next_page") {
      sent += 1;
      const refused = replies[sent - 1];
      if (refused !== undefined) result = { commandId: message.payload.commandId, status: "failed", failure: refused };
      else {
        advanced += 1;
        result = { commandId: message.payload.commandId, status: "succeeded", payload: { moved: true } };
      }
    } else {
      assert.equal(action, "web.dom.capture_snapshot", "the isolated fixture supports no other browser operation");
      result = { commandId: message.payload.commandId, status: "succeeded", payload: { snapshot: {
        url: "https://archive.test/catalogue", title: "Archive catalogue", interactiveElements: [
          { tagName: "article", selector: "article", visibleText: `Archive page ${advanced + 1}` },
          { tagName: "button", selector: "#continue", visibleText: "More archive entries" }
        ]
      } } };
    }
    queueMicrotask(() => {
      void gateway.receive(client.sessionId, { id: `answer.${sent}.${Date.now()}`, type: "client.action_result", protocolVersion: CLIENT_GATEWAY_PROTOCOL_VERSION, timestamp: Date.now(), payload: result });
    });
  } } });
  await gateway.receive(client.sessionId, { id: "hello", protocolVersion: CLIENT_GATEWAY_PROTOCOL_VERSION, timestamp: Date.now(), type: "client.hello", payload: {
    clientId: "synthetic.archive", clientType: "extension", capabilities: [{ id: "web.actions", kind: "action", actionTypes: ["web.dom.next_page", "web.dom.capture_snapshot"], metadata: { domainId: WEB_AUTOMATION_DOMAIN_ID } }]
  } });
  const pairing = gateway.snapshot().pairings.find((entry) => entry.requestedBySessionId === client.sessionId);
  assert.ok(pairing);
  await gateway.approvePairing(pairing.pairingCode, { approvedByUserId: "synthetic.user" });
  const program = fluxiq.programs.automationStudio;
  const native = new AutomationStudioNativeNodeRuntime({ permissions: WEB_AUTOMATION_RUNTIME_PERMISSIONS, runtimeCapabilities: WEB_AUTOMATION_RUNTIME_CAPABILITIES });
  native.register(createWebAutomationOutputNodeManifest(), createWebAutomationOutputNodeImplementationBundle());
  program.bindNativeNodeRuntime(native);
  assert.deepEqual(native.resolveActionEffect({ id: "next", definitionId: "builtin.policy.action", parameterValues: { outputId: "web.dom.next_page", parameters: PARAMETERS } }), { effectClass: "commit", permissionConsequences: [] });
  const project = await program.createProject({ name: "Archive paging", domainId: WEB_AUTOMATION_DOMAIN_ID });
  let serial = 0;
  const reset = (answers: typeof replies) => {
    replies = answers;
    sent = 0;
    advanced = 0;
  };
  return {
    sent: () => sent,
    advanced: () => advanced,
    io: async (answer: AutomationStudioFailureRecord & JsonObject) => {
      reset([answer]);
      return await dispatchOutput({ domainId: WEB_AUTOMATION_DOMAIN_ID, outputId: "web.dom.next_page", payload: PARAMETERS });
    },
    playback: async (answers: typeof replies, forged = false) => {
      reset(answers);
      serial += 1;
      const flowId = `flow.archive.${serial}`;
      await program.createFlow({ projectId: project.id, flowId, name: "Continue archive" });
      await program.saveFlowGenerationInstruction({ projectId: project.id, flowId, instruction: "Continue to the next archive page." });
      return await program.runRuntimeSession({ projectId: project.id, commandOutcomeMode: "required", flow: {
        schemaVersion: "0.1", flowId, ownerKind: "routine", ownerId: "routine.archive", name: "Continue archive", createdAt: 1, updatedAt: 1,
        // Required execution uses Core's policy-output boundary. The bound
        // Domain library above supplies this output's trusted commit floor.
        nodes: [{ id: "next", definitionId: "builtin.policy.action", parameterValues: { outputId: "web.dom.next_page", parameters: PARAMETERS, timeoutMs: 1000 }, metadata: forged ? { effect: "observe", actionEffect: { effectClass: "observe" }, loopVerdict: "read", idempotent: true } : {} }], edges: []
      } });
    }
  };
}

test("canonical IO preserves the authenticated producer receipt exactly", async (t) => {
  const host = await realHost(t);
  const reported = failure(WEB_AUTOMATION_FAILURE_CODES.OUTPUT_NOT_OBSERVED, "unacted");
  const result = await host.io(reported);
  assert.deepEqual(result.failure, reported);
  assert.equal(host.sent(), 1);
  assert.equal(host.advanced(), 0);
});

test("existing execution-stage NO_EFFECT retries through actual required playback and advances exactly one page", async (t) => {
  const host = await realHost(t);
  const noEffect = failure(WEB_AUTOMATION_FAILURE_CODES.NO_EFFECT);
  const completed = await host.playback([noEffect]);
  assert.equal(completed.status, "succeeded", completed.trace?.message);
  assert.equal(host.sent(), 2);
  assert.equal(host.advanced(), 1);
  const exhausted = await host.playback([noEffect, noEffect, noEffect, noEffect, noEffect]);
  assert.equal(exhausted.status, "failed");
  assert.equal(host.sent(), 4);
  assert.equal(host.advanced(), 0);
});

test("actual playback preserves unknown, arbitrary, permanent and original no-retry protections despite model annotations", async (t) => {
  const host = await realHost(t);
  for (const original of [
    failure(WEB_AUTOMATION_FAILURE_CODES.OUTPUT_NOT_OBSERVED),
    failure(WEB_AUTOMATION_FAILURE_CODES.OUTPUT_NOT_OBSERVED, "ambiguous"),
    failure(WEB_AUTOMATION_FAILURE_CODES.ACTION_FAILED, "unacted", false),
    failure(WEB_AUTOMATION_FAILURE_CODES.NOT_IMPLEMENTED)
  ]) {
    const result = await host.playback([original, original], true);
    assert.equal(result.status, "failed");
    assert.equal(host.sent(), 1);
    assert.equal(host.advanced(), 0);
  }
});
