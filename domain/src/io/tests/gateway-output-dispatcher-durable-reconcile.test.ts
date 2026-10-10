// A durable (required-mode) web command whose answer never came is asked about
// by command id before its outcome is called unknown (state-aware recovery
// plan C8, B3; t427), exactly as an ordinary command is: the browser's kept
// result is the command's answer, so the act is never pressed a second time
// and the run carries on; `not_seen` is a failure that did nothing, so the
// step is made again under a new attempt; anything uncertain stops the run
// with the ledger `unknown`, and nothing is pressed again.
//
// A synthetic real SQL/service/gateway fixture, as `./required-context.ts`:
// no browser, provider or user data.

import assert from "node:assert/strict";
import { mkdtemp, rm } from "node:fs/promises";
import os from "node:os";
import path from "node:path";
import test from "node:test";
import { FluxIQ } from "fluxiq";
import { CLIENT_GATEWAY_PROTOCOL_VERSION, type ClientGatewayClientMessage, type ClientGatewayReconcileAnswer } from "fluxiq/client-gateway";
import { WEB_AUTOMATION_DOMAIN_ID } from "../../constants";
import { createWebAutomationDomainIo } from "../web-automation-io";
import { createWebAutomationRuntimeAdapter } from "../../runtime";

type ReconcileReply = Omit<ClientGatewayReconcileAnswer, "commandId">;

test("a lost durable press the browser kept is taken from its kept result and never pressed again", async () => {
  const run = await lostFirstAnswerRun((commandId) => ({ state: "landed", result: { commandId, status: "succeeded", payload: { clicked: true } } }));
  assert.equal(run.status, "succeeded", run.message);
  assert.deepEqual(run.pressed, ["first", "second"]);
  assert.equal(run.asked, 1);
});

test("a lost durable press the browser never received is made again under a new attempt", async () => {
  const run = await lostFirstAnswerRun(() => ({ state: "not_seen" }));
  assert.equal(run.status, "succeeded", run.message);
  assert.deepEqual(run.pressed, ["first", "first", "second"]);
  assert.equal(run.asked, 1);
});

test("a lost durable press nobody can vouch for stops the run as Outcome uncertain, is never pressed again, and keeps its page check", async () => {
  const run = await lostFirstAnswerRun(() => ({ state: "unknown" }));
  assert.equal(run.status, "failed", run.message);
  assert.equal(run.failureCode, "run.outcome_uncertain");
  assert.match(run.message ?? "", /^Outcome uncertain: .*Nothing on the page shows whether the step took effect/u);
  assert.deepEqual(run.pressed, ["first"]);
  assert.equal(run.asked, 1);
  // The node declares no expected state, so the page check could not tell.
  assert.deepEqual(run.first, { failureCode: "executor.required_outcome_unknown", effectCheck: "unknown" });
});

test("an ordinary (not required) run on the same runtime path is reconciled too, before the runtime gives up", async () => {
  const run = await lostFirstAnswerRun((commandId) => ({ state: "landed", result: { commandId, status: "succeeded", payload: { clicked: true } } }), false);
  assert.equal(run.status, "succeeded", run.message);
  assert.deepEqual(run.pressed, ["first", "second"]);
  assert.equal(run.asked, 1);
});

/**
 * A required run (an ordinary one with `required` false) of `first -> second`,
 * each a press. The browser loses its answer to the first command it is sent
 * and answers every later one; asked what became of a command, it answers
 * `reply`.
 */
async function lostFirstAnswerRun(reply: (commandId: string) => ReconcileReply, required = true): Promise<{ status: string; message: string | undefined; failureCode?: string | undefined; first?: { failureCode: string | undefined; effectCheck: string | undefined }; pressed: string[]; asked: number }> {
  const root = await mkdtemp(path.join(os.tmpdir(), "t427-durable-reconcile-"));
  const create = () => FluxIQ.create({ rootDir: root, domainId: WEB_AUTOMATION_DOMAIN_ID, loadEnv: false, modelProvidersEnabled: false });
  const bootstrap = create();
  try {
    await bootstrap.setup();
  } finally {
    await bootstrap.close();
  }
  const fluxiq = create();
  const gateway = fluxiq.programs.clientGateway;
  const pressed: string[] = [];
  let asked = 0;
  try {
    fluxiq.io.register(createWebAutomationDomainIo(fluxiq));
    // The runtime path, which a web Flow run takes: it sends the node's own timeout as the command's and bounds the wait itself.
    fluxiq.runtime.registerAdapter(createWebAutomationRuntimeAdapter({ fluxiq }));
    const answer = (sessionId: string, message: Pick<ClientGatewayClientMessage, "type" | "payload">) => {
      const sent = { ...message, id: `synthetic.${message.type}.${Math.random()}`, protocolVersion: CLIENT_GATEWAY_PROTOCOL_VERSION, timestamp: Date.now() } as ClientGatewayClientMessage;
      setTimeout(() => void gateway.receive(sessionId, sent), 1);
    };
    const client = gateway.connect({ socket: { send: (raw) => {
      const message = JSON.parse(raw);
      if (message.type === "server.reconcile_command") {
        asked += 1;
        answer(client.sessionId, { type: "client.reconcile_result", payload: { commandId: message.payload.commandId, ...reply(message.payload.commandId) } });
        return;
      }
      if (message.type !== "server.execute_action") return;
      pressed.push(String(message.payload.parameters?.selector ?? "").replace("#", ""));
      if (pressed.length === 1) return;
      answer(client.sessionId, { type: "client.action_result", payload: { commandId: message.payload.commandId, status: "succeeded", payload: { clicked: true } } });
    } } });
    await gateway.receive(client.sessionId, { id: "hello", protocolVersion: CLIENT_GATEWAY_PROTOCOL_VERSION, timestamp: Date.now(), type: "client.hello", payload: { clientId: "synthetic.web", clientType: "extension", capabilities: [{ id: "web.actions", kind: "action", actionTypes: ["web.dom.click"], metadata: { domainId: WEB_AUTOMATION_DOMAIN_ID, answersReconcile: true } }] } });
    const pairing = gateway.snapshot().pairings.find((item) => item.requestedBySessionId === client.sessionId)!;
    await gateway.approvePairing(pairing.pairingCode, { approvedByUserId: "synthetic.user" });
    const program = fluxiq.programs.automationStudio;
    const project = await program.createProject({ name: "Synthetic durable reconcile", domainId: WEB_AUTOMATION_DOMAIN_ID });
    const flow = {
      schemaVersion: "0.1" as const, flowId: "flow.synthetic.web", ownerKind: "routine" as const, ownerId: "routine.synthetic", name: "Synthetic", createdAt: 1, updatedAt: 1,
      nodes: ["first", "second"].map((id) => ({ id, definitionId: "builtin.policy.action", parameterValues: { outputId: "web.dom.click", parameters: { selector: `#${id}` }, timeoutMs: 200 } })),
      edges: [{ id: "next", sourceNodeId: "first", sourcePortId: "success", targetNodeId: "second", targetPortId: "in" }]
    };
    // The executor's retry pause does not hold the process open by itself; this does, for the run's length.
    const keepAlive = setInterval(() => undefined, 1_000);
    const ended = await program.runRuntimeSession({ projectId: project.id, flow, ...(required ? { commandOutcomeMode: "required" as const } : {}) }).then(
      (session) => {
        const first = session.trace?.attempts.find((attempt) => attempt.nodeId === "first");
        return { status: session.status, message: session.trace?.message, failureCode: session.trace?.failure?.code, ...(first ? { first: { failureCode: first.failure?.code, effectCheck: first.effectCheck?.result } } : {}) };
      },
      (error: unknown) => ({ status: "threw", message: error instanceof Error ? error.message : String(error) })
    ).finally(() => clearInterval(keepAlive));
    return { ...ended, pressed, asked };
  } finally {
    await fluxiq.close();
    const owned = path.resolve(root);
    if (path.dirname(owned) !== path.resolve(os.tmpdir()) || !path.basename(owned).startsWith("t427-durable-reconcile-")) throw new Error("nonowned cleanup");
    await rm(owned, { recursive: true, force: true, maxRetries: 10, retryDelay: 50 });
  }
}
