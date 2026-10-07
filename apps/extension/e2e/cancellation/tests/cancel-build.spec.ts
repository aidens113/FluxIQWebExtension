import { createHash } from "node:crypto";
import { createServer } from "node:http";
import type { Socket } from "node:net";
import { mkdtemp, rm } from "node:fs/promises";
import os from "node:os";
import path from "node:path";
import { AutomationStudioService, automationStudioActivityHub } from "fluxiq/automation-studio";
import { expect, restartServiceWorker, test } from "../../fixtures/extension-context";

test("the real sidepanel Stop cancels an actual Core build and refuses its late provider result", async ({ extensionSession }) => {
  test.setTimeout(60_000);
  const dataDir = await mkdtemp(path.join(os.tmpdir(), "fluxiq-stop-proof-"));
  let release!: () => void, started!: () => void, calls = 0, proposals = 0;
  const pending = new Promise<void>(resolve => { started = resolve; });
  const service = new AutomationStudioService({ dataDir, llmProviderResolver: () => ({
    provider: { metadata: { provider: "isolated-stand-in", model: "no-paid-calls" }, runTask: async () => {
      calls++; started(); await new Promise<void>(resolve => { release = resolve; });
      return { response: { kind: "flow_bootstrap", summary: "Late result", plan: { schemaVersion: "0.1", router: { name: "Primary", rules: [], fallback: { kind: "subflow", targetSubflowKey: "primary" } }, subflows: [{ key: "primary", name: "Primary", role: "primary", nodes: [{ key: "start", definitionId: "builtin.control.start", definitionVersion: "1.0.0" }, { key: "end", definitionId: "builtin.control.end", definitionVersion: "1.0.0" }], edges: [{ key: "end", source: { nodeKey: "start", portId: "next" }, target: { nodeKey: "end", portId: "in" } }] }] } }, usage: { inputTokens: 120, outputTokens: 80, totalTokens: 200, estimatedCostUsd: 0 } };
    } }, maxCallsPerRun: 1, maxEstimatedCostUsd: 0.1
  }) });
  const sockets = new Set<Socket>();
  let server: ReturnType<typeof createServer> | undefined;
  let building: Promise<unknown> | undefined;
  let unsubscribe: () => void = () => undefined;
  try {
    const project = await service.createProject({ name: "Isolated cancellation proof" });
    const flow = await service.createFlow({ projectId: project.id, flowId: "flow.cancel-proof", name: "Stop proof" });
    let terminalLabel: string | undefined, terminalDetail: unknown;
    unsubscribe = automationStudioActivityHub.subscribe(event => { if (event.final && event.subject.projectId === project.id) { terminalLabel = event.label; terminalDetail = event.detail; } });
    await service.saveFlowGenerationInstruction({ projectId: project.id, flowId: flow.flowId, instruction: "Create a deterministic Start to End Flow." });
    const before = await service.getFlow(project.id, flow.flowId);
    const create = service.createFlowBootstrapAdaptation.bind(service);
    service.createFlowBootstrapAdaptation = async input => { proposals++; return create(input); };
    building = service.generateFlowBootstrapAdaptation({ projectId: project.id, flowId: flow.flowId, caller: { actorUserId: "isolated", actorSessionId: "isolated" } }).then(() => "unexpected success", error => error.name);
    await pending;
    let stopped = false;
    const event = (final = false) => ({ activityId: "build:isolated", sequence: final ? 2 : 1,
      subject: { kind: "build", id: "isolated", projectId: project.id, flowId: flow.flowId }, phase: final ? "failed" : "building",
      label: final ? terminalLabel : "Building the Flow", at: new Date().toISOString(), ...(final ? { final: true, detail: terminalDetail } : {}) });
    const send = (socket: Socket, type: string, payload: unknown) => {
      const bytes = Buffer.from(JSON.stringify({ id: `isolated-${Date.now()}`, protocolVersion: "0.1", timestamp: Date.now(), type, payload }));
      const header = bytes.length < 126 ? Buffer.from([0x81, bytes.length]) : Buffer.from([0x81, 126, bytes.length >> 8, bytes.length & 255]);
      socket.write(Buffer.concat([header, bytes]));
    };
    server = createServer(async (req, res) => {
      const chunks: Buffer[] = []; for await (const chunk of req) chunks.push(Buffer.from(chunk));
      const body = chunks.length ? JSON.parse(Buffer.concat(chunks).toString()) : {};
      let payload: unknown = { conversations: [] };
      if (req.url?.includes("cancel-flow-bootstrap")) {
        expect(body).toMatchObject({ projectId: project.id, flowId: flow.flowId });
        stopped = service.buildCancellation.cancel(body.projectId, body.flowId);
        payload = { cancellationRequested: stopped };
        release(); await building;
        for (const socket of sockets) send(socket, "server.activity", event(true));
      }
      res.writeHead(200, { "content-type": "application/json" }); res.end(JSON.stringify({ ok: true, payload }));
    });
    server.on("upgrade", (req, socket: Socket) => {
      const accept = createHash("sha1").update(`${req.headers["sec-websocket-key"]}258EAFA5-E914-47DA-95CA-C5AB0DC85B11`).digest("base64");
      socket.write(`HTTP/1.1 101 Switching Protocols\r\nUpgrade: websocket\r\nConnection: Upgrade\r\nSec-WebSocket-Accept: ${accept}\r\n\r\n`);
      sockets.add(socket); socket.on("error", () => sockets.delete(socket)); socket.on("close", () => sockets.delete(socket));
      let ready = false;
      socket.on("data", () => { if (ready) return; ready = true;
        send(socket, "server.session_ready", { sessionId: "isolated", token: "isolated-public-test-token", projectId: project.id });
        setTimeout(() => { if (!socket.destroyed) send(socket, "server.activity", event()); }, 100);
      });
    });
    await new Promise<void>(resolve => server!.listen(0, "127.0.0.1", resolve));
    const port = (server.address() as { port: number }).port;
    const page = extensionSession.extensionPage;
    await page.evaluate(async ({ port, projectId }) => chrome.storage.local.set({
      "fluxiq.clientId": "isolated-stop-proof", "fluxiq.session": { clientId: "isolated-stop-proof", token: "isolated-public-test-token", projectId },
      "fluxiq.settings": { gatewayUrl: `ws://127.0.0.1:${port}/client`, coreApiUrl: `http://127.0.0.1:${port}/`, autoReconnect: true, captureMutations: false, captureInputValues: false, captureSnapshots: false }
    }), { port, projectId: project.id });
    await restartServiceWorker(extensionSession); await page.reload();
    const stop = page.getByRole("button", { name: "Stop build", exact: true });
    await expect(stop).toBeVisible({ timeout: 15_000 }); await stop.click();
    await expect.poll(() => stopped).toBe(true);
    expect(await building).toBe("AbortError"); expect(calls).toBe(1); expect(proposals).toBe(0);
    expect(terminalLabel).toBe("Build stopped");
    expect(await service.getFlow(project.id, flow.flowId)).toEqual(before);
    await expect(stop).toBeHidden();
    await expect(page.getByText("Build stopped", { exact: true }).first()).toBeVisible();
  } finally {
    unsubscribe();
    release?.(); await building;
    for (const socket of sockets) socket.destroy();
    if (server) await new Promise<void>(resolve => server!.close(() => resolve()));
    await service.close(); await rm(dataDir, { recursive: true, force: true });
  }
});
