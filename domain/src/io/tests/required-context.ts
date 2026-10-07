import assert from "node:assert/strict";
import { mkdtemp, rm } from "node:fs/promises";
import os from "node:os";
import path from "node:path";
import { FluxIQ } from "fluxiq";
import { CLIENT_GATEWAY_PROTOCOL_VERSION, ClientGatewayCommandContext, ClientGatewayRequiredCommandContext } from "fluxiq/client-gateway";
import { WEB_AUTOMATION_DOMAIN_ID } from "../../constants";
import { createWebAutomationDomainIo } from "../web-automation-io";
import { createWebAutomationRuntimeAdapter } from "../../runtime";

/** Synthetic real SQL/service/gateway fixture; no browser, provider, user data or receipt factory. */
export async function exerciseRequiredWebDispatch(mode: "io" | "runtime"): Promise<void> {
  const root = await mkdtemp(path.join(os.tmpdir(), "t331-required-web-"));
  const create = () => FluxIQ.create({ rootDir: root, domainId: WEB_AUTOMATION_DOMAIN_ID, loadEnv: false, modelProvidersEnabled: false });
  const bootstrap = create();
  for (const [key, value] of Object.entries(bootstrap.paths)) if (key !== "domainId" && typeof value === "string") {
    const relative = path.relative(root, path.resolve(value)); if (relative === ".." || relative.startsWith(`..${path.sep}`) || path.isAbsolute(relative)) throw new Error("nonowned setup path");
  }
  try { await bootstrap.setup(); } finally { await bootstrap.close(); }
  const fluxiq = create(), gateway = fluxiq.programs.clientGateway, contexts: ClientGatewayCommandContext[] = [], sends: unknown[] = [];
  try {
    fluxiq.io.register(createWebAutomationDomainIo(fluxiq));
    if (mode === "runtime") fluxiq.runtime.registerAdapter(createWebAutomationRuntimeAdapter({ fluxiq }));
    const bridge = fluxiq.programs.automationStudioClientGateway, execute = bridge.executeAction.bind(bridge);
    Object.defineProperty(bridge, "executeAction", { value: async (...args: unknown[]) => {
      assert.equal(args.length, 3); const options = args[2] as { context: ClientGatewayCommandContext; signal?: AbortSignal };
      ClientGatewayRequiredCommandContext.assertRequired(options.context); assert.ok(options.signal instanceof AbortSignal);
      assert.equal(Object.hasOwn(args[1] as object, "context"), false); contexts.push(options.context);
      return await Reflect.apply(execute, bridge, args);
    } });
    const client = gateway.connect({ socket: { send: raw => {
      const message = JSON.parse(raw); if (message.type !== "server.execute_action") return; sends.push(message);
      queueMicrotask(() => { void gateway.receive(client.sessionId, { id: `synthetic.ack.${sends.length}`, protocolVersion: CLIENT_GATEWAY_PROTOCOL_VERSION, timestamp: Date.now(), type: "client.action_result", payload: { commandId: message.payload.commandId, status: "succeeded", payload: { clicked: true } } }); });
    } } });
    await gateway.receive(client.sessionId, { id: "hello", protocolVersion: CLIENT_GATEWAY_PROTOCOL_VERSION, timestamp: Date.now(), type: "client.hello", payload: { clientId: "synthetic.web", clientType: "extension", capabilities: [{ id: "web.actions", kind: "action", ...(mode === "runtime" ? { actionTypes: ["web.dom.click"] } : {}), metadata: { domainId: WEB_AUTOMATION_DOMAIN_ID } }] } });
    const pairing = gateway.snapshot().pairings.find(item => item.requestedBySessionId === client.sessionId)!;
    await gateway.approvePairing(pairing.pairingCode, { approvedByUserId: "synthetic.user" });
    const program = fluxiq.programs.automationStudio, project = await program.createProject({ name: "Synthetic required web", domainId: WEB_AUTOMATION_DOMAIN_ID });
    const flow = { schemaVersion: "0.1" as const, flowId: "flow.synthetic.web", ownerKind: "routine" as const, ownerId: "routine.synthetic", name: "Synthetic", createdAt: 1, updatedAt: 1,
      nodes: ["first", "second"].map(id => ({ id, definitionId: "builtin.policy.action", parameterValues: { outputId: "web.dom.click", parameters: { selector: "#synthetic" }, timeoutMs: 1000 } })),
      edges: [{ id: "next", sourceNodeId: "first", sourcePortId: "success", targetNodeId: "second", targetPortId: "in" }] };
    const result = await program.runRuntimeSession({ projectId: project.id, flow, commandOutcomeMode: "required" }).catch(error => { throw new Error(`${error.message}; calls=${contexts.length}; sends=${sends.length}`); });
    assert.equal(result.status, "succeeded", result.trace?.message); assert.equal(result.metadata?.commandOutcomeMode, "required");
    assert.equal(sends.length, 2); assert.equal(contexts.length, 2);
    assert.equal(new Set(contexts.map(context => ClientGatewayCommandContext.owner(context).invocationId)).size, 2);
    assert.equal((await program.getRuntimeSession(project.id, result.runId))?.status, "succeeded");
  } finally {
    await fluxiq.close();
    const owned = path.resolve(root); if (path.dirname(owned) !== path.resolve(os.tmpdir()) || !path.basename(owned).startsWith("t331-required-web-")) throw new Error("nonowned cleanup");
    await rm(owned, { recursive: true, force: true, maxRetries: 10, retryDelay: 50 });
  }
}
