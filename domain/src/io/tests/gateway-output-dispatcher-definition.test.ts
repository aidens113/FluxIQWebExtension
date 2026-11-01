import assert from "node:assert/strict";
import test from "node:test";
import { mkdtemp, rm } from "node:fs/promises";
import os from "node:os";
import path from "node:path";
import { FluxIQ } from "fluxiq";
import { CLIENT_GATEWAY_PROTOCOL_VERSION, ClientGatewayCommandContext, ClientGatewayRequiredCommandContext } from "fluxiq/client-gateway";
import type { JsonObject } from "fluxiq/core";
import { WEB_AUTOMATION_DOMAIN_ID } from "../../constants";
import { WEB_AUTOMATION_DEFINITION_FIELDS_CAPABILITY_ID } from "../../client";
import { WEB_AUTOMATION_FAILURE_CODES } from "../../runtime/failure";
import { createWebAutomationRuntimeAdapter } from "../../runtime";
import { dispatchWebAutomationOutput } from "../gateway-output-dispatcher";
import { createWebAutomationDomainIo } from "../web-automation-io";

const FIELD = { kind: "text", definition: { term: "Edition", part: "value" } };
const PARAMETERS = { extractList: { item: "article", fields: { edition: FIELD } } } satisfies JsonObject;
const ACTIONS = { id: "web.actions", actionTypes: ["web.dom.extract_list", "web.dom.click"], metadata: { domainId: WEB_AUTOMATION_DOMAIN_ID } };
const ready = (sessionId: string, version?: unknown) => ({
  sessionId, clientId: `client.${sessionId}`, status: "ready", clientType: "extension", capabilities: [ACTIONS,
    ...(version === undefined ? [] : [{ id: WEB_AUTOMATION_DEFINITION_FIELDS_CAPABILITY_ID, metadata: { domainId: WEB_AUTOMATION_DOMAIN_ID, version } }])]
});

function host(sessions: unknown[]) {
  const sent: Array<{ sessionId: string; actionType: string; parameters: JsonObject }> = [];
  const fluxiq = { programs: {
    clientGateway: { snapshot: () => ({ sessions }) },
    automationStudioClientGateway: { executeAction: async (sessionId: string, command: { actionType: string; parameters: JsonObject }) => {
      sent.push({ sessionId, ...command });
      return { commandId: "synthetic.read", status: "succeeded", payload: { extracted: [{ edition: "Fourth" }] } };
    } }
  } } as unknown as FluxIQ;
  return { sent, dispatch: (payload: JsonObject, sessionId?: string, outputId = "web.dom.extract_list") => dispatchWebAutomationOutput(fluxiq, {
    domainId: WEB_AUTOMATION_DOMAIN_ID, outputId, payload, ...(sessionId === undefined ? {} : { metadata: { sessionId } })
  }) };
}

test("canonical dispatch refuses the actual unsupported selected client without an alternate-client fallback", async () => {
  for (const version of [undefined, "1", 0]) {
    const run = host([ready("selected", version), ready("other", 1)]);
    const result = await run.dispatch(PARAMETERS, "selected");
    assert.equal(result.ok, false);
    assert.equal(result.status, "failed");
    assert.equal(result.failure?.code, WEB_AUTOMATION_FAILURE_CODES.NOT_IMPLEMENTED);
    assert.equal(result.failure?.transient, undefined);
    assert.equal(result.metadata?.sessionId, "selected");
    assert.equal(run.sent.length, 0);
  }
});

test("canonical dispatch gates projected and predicate-only anchors and sends supported reads normally", async () => {
  const predicate = { extractList: { item: "article", fields: { name: "h3" }, where: [{ read: FIELD, is: "present" }] } } satisfies JsonObject;
  for (const parameters of [PARAMETERS, predicate]) {
    const old = host([ready("selected")]);
    assert.equal((await old.dispatch(parameters)).ok, false);
    assert.equal(old.sent.length, 0);
    const current = host([ready("selected", 1)]);
    assert.equal((await current.dispatch(parameters)).ok, true);
    assert.deepEqual(current.sent, [{ sessionId: "selected", actionType: "web.dom.extract_list", parameters }]);
  }
});

test("ordinary reads, excluded columns and other actions do not require the new feature", async () => {
  for (const payload of [{ extractList: { item: "article", fields: { name: "h3" } } }, { extractList: { item: "article", fields: { name: "h3", edition: { ...FIELD, handling: "exclude" } } } }]) {
    const run = host([ready("selected")]);
    assert.equal((await run.dispatch(payload)).ok, true);
    assert.equal(run.sent.length, 1);
  }
  const run = host([ready("selected")]);
  assert.equal((await run.dispatch({ selector: "#next" }, undefined, "web.dom.click")).ok, true);
  assert.equal(run.sent.length, 1);
});

// Focused real SQLite/service acceptance: only a service-issued context and
// persisted run can prove that refusal settles the required ledger. Browser,
// provider and user data stay absent, as in the existing required-context test.
test("a refused required read stops its service-issued context and settles the run without a browser command", { timeout: 60_000 }, async (t) => {
  const root = await mkdtemp(path.join(os.tmpdir(), "t838-definition-required-"));
  const create = () => FluxIQ.create({ rootDir: root, domainId: WEB_AUTOMATION_DOMAIN_ID, loadEnv: false, modelProvidersEnabled: false });
  const bootstrap = create();
  for (const [key, location] of Object.entries(bootstrap.paths)) if (key !== "domainId" && typeof location === "string") {
    const relative = path.relative(root, path.resolve(location));
    if (relative === ".." || relative.startsWith(`..${path.sep}`) || path.isAbsolute(relative)) throw new Error("nonowned setup path");
  }
  try { await bootstrap.setup(); } finally { await bootstrap.close(); }
  const fluxiq = create();
  const commands: string[] = [];
  const stopped: string[] = [];
  const stop = ClientGatewayRequiredCommandContext.stop.bind(ClientGatewayRequiredCommandContext);
  t.mock.method(ClientGatewayRequiredCommandContext, "stop", async (context: ClientGatewayCommandContext, reason: string) => {
    ClientGatewayRequiredCommandContext.assertRequired(context);
    stopped.push(reason);
    await stop(context, reason);
  });
  try {
    fluxiq.io.register(createWebAutomationDomainIo(fluxiq));
    fluxiq.runtime.registerAdapter(createWebAutomationRuntimeAdapter({ fluxiq }));
    const gateway = fluxiq.programs.clientGateway;
    const client = gateway.connect({ socket: { send: (raw) => {
      const message = JSON.parse(raw);
      if (message.type === "server.execute_action") commands.push(String(message.payload.actionType));
    } } });
    await gateway.receive(client.sessionId, { id: "hello", protocolVersion: CLIENT_GATEWAY_PROTOCOL_VERSION, timestamp: Date.now(), type: "client.hello", payload: {
      clientId: "synthetic.archive", clientType: "extension", capabilities: [{ ...ACTIONS, kind: "action" }]
    } });
    const pairing = gateway.snapshot().pairings.find((entry) => entry.requestedBySessionId === client.sessionId)!;
    await gateway.approvePairing(pairing.pairingCode, { approvedByUserId: "synthetic.user" });
    const program = fluxiq.programs.automationStudio;
    const project = await program.createProject({ name: "Synthetic archive", domainId: WEB_AUTOMATION_DOMAIN_ID });
    await program.createFlow({ projectId: project.id, flowId: "flow.archive", name: "Read archive" });
    await program.saveFlowGenerationInstruction({ projectId: project.id, flowId: "flow.archive", instruction: "Read the edition metadata from the archive catalogue." });
    const result = await program.runRuntimeSession({ projectId: project.id, commandOutcomeMode: "required", flow: {
      schemaVersion: "0.1", flowId: "flow.archive", ownerKind: "routine", ownerId: "routine.archive", name: "Read archive", createdAt: 1, updatedAt: 1,
      nodes: [{ id: "read", definitionId: "builtin.policy.action", parameterValues: { outputId: "web.dom.extract_list", parameters: PARAMETERS, timeoutMs: 1000 } }], edges: []
    } });
    assert.equal(result.status, "failed");
    assert.equal(result.metadata?.commandOutcomeMode, "required");
    assert.equal(commands.length, 0, `sent=${commands.join(",")}; stopped=${stopped.join(",")}`);
    assert.deepEqual(stopped, [WEB_AUTOMATION_FAILURE_CODES.NOT_IMPLEMENTED]);
    assert.equal((await program.getRuntimeSession(project.id, result.runId))?.status, "failed");
  } finally {
    await fluxiq.close();
    const owned = path.resolve(root);
    if (path.dirname(owned) !== path.resolve(os.tmpdir()) || !path.basename(owned).startsWith("t838-definition-required-")) throw new Error("nonowned cleanup");
    await rm(owned, { recursive: true, force: true, maxRetries: 10, retryDelay: 50 });
  }
});
