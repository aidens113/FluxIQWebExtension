import { createHash } from "node:crypto";
import { createServer } from "node:http";
import type { Socket } from "node:net";
import { mkdtemp, rm } from "node:fs/promises";
import os from "node:os";
import path from "node:path";
import { AutomationStudioService, AutomationStudioNativeNodeRuntime, automationStudioActivityHub, AUTOMATION_STUDIO_IMPORTER_SDK_VERSION, type AutomationStudioNodeDefinition } from "fluxiq/automation-studio";
import { expect, restartServiceWorker, test } from "../../fixtures/extension-context";

test("the real sidepanel Stop cancels a running Core executor before its next node", async ({ extensionSession }) => {
  test.setTimeout(60_000);
  const dataDir = await mkdtemp(path.join(os.tmpdir(), "fluxiq-stop-run-proof-"));
  let release!: () => void, started!: () => void;
  let unsubscribe: () => void = () => undefined;
  const pending = new Promise<void>(resolve => { started = resolve; });
  const executed: string[] = [];
  const definitions: AutomationStudioNodeDefinition[] = ["delayed", "after"].map(id => ({
    schemaVersion: "0.1", id: `isolated.${id}`, version: "1.0.0", label: id, description: "Isolated cancellation proof", category: "custom",
    source: { kind: "importer", domainId: "isolated", packageId: "isolated.cancellation", implementationKey: id },
    availability: { kind: "domain", domainId: "isolated" }, capabilities: { executable: true, codeBacked: true },
    inputs: [{ id: "in", label: "In", valueType: "object" }], outputs: [{ id: "success", label: "Success", valueType: "boolean" }], parameters: []
  }));
  const runtime = new AutomationStudioNativeNodeRuntime().register({
    schemaVersion: "0.1", sdkVersion: AUTOMATION_STUDIO_IMPORTER_SDK_VERSION, packageId: "isolated.cancellation", packageVersion: "1.0.0", domainId: "isolated", nodes: definitions
  }, { packageId: "isolated.cancellation", packageVersion: "1.0.0", implementations: {
    delayed: async () => { executed.push("delayed"); started(); await new Promise<void>(resolve => { release = resolve; }); return { status: "success", route: "success", outputs: { success: true } }; },
    after: () => { executed.push("after"); return { status: "success", route: "success", outputs: { success: true } }; }
  } });
  const service = new AutomationStudioService({ dataDir, seedFixture: false }).bindNativeNodeRuntime(runtime);
  const sockets = new Set<Socket>();
  let server: ReturnType<typeof createServer> | undefined;
  let running: ReturnType<AutomationStudioService["runRuntimeSession"]> | undefined;
  try {
    const project = await service.createProject({ name: "Isolated run cancellation", domainId: "isolated" });
    const flow = await service.createFlow({ projectId: project.id, flowId: "flow.run-stop", name: "Run Stop proof" });
    const subflow = await service.createFlowSubflow({ projectId: project.id, flowId: flow.flowId, name: "Primary", role: "primary" });
    const graph = await service.getFlow(project.id, subflow.graphFlowId!);
    await service.saveFlow({ projectId: project.id, flow: { ...graph,
      nodes: [{ id: "start", definitionId: "builtin.control.start", parameterValues: {} },
        { id: "delayed", definitionId: "isolated.delayed", parameterValues: {} },
        { id: "after", definitionId: "isolated.after", parameterValues: {} },
        { id: "end", definitionId: "builtin.control.end", parameterValues: { status: "success" } }],
      edges: [{ id: "start.delay", sourceNodeId: "start", sourcePortId: "success", targetNodeId: "delayed", targetPortId: "in" },
        { id: "delay.after", sourceNodeId: "delayed", sourcePortId: "success", targetNodeId: "after", targetPortId: "in" },
        { id: "after.end", sourceNodeId: "after", sourcePortId: "success", targetNodeId: "end", targetPortId: "in" }]
    } });
    await service.setFlowMapFallback({ projectId: project.id, flowId: flow.flowId, kind: "subflow", targetSubflowId: subflow.subflowId });
    const before = await service.getFlow(project.id, flow.flowId);
    const beforeGraph = await service.getFlow(project.id, graph.flowId);
    let terminalLabel: string | undefined, terminalDetail: unknown;
    unsubscribe = automationStudioActivityHub.subscribe(event => { if (event.final && event.subject.projectId === project.id) { terminalLabel = event.label; terminalDetail = event.detail; } });
    const queued = await service.startRuntimeSession({ projectId: project.id, flowId: flow.flowId });
    running = service.runRuntimeSession({ projectId: project.id, flowId: flow.flowId, runId: queued.runId });
    await Promise.race([pending, running.then(result => { throw new Error(`Run finished before delayed node: ${result.status}`); })]);
    expect((await service.getRuntimeSession(project.id, queued.runId))?.status).toBe("running");
    let stopped = false;
    const event = (final = false) => ({ activityId: `run:${queued.runId}`, sequence: final ? 2 : 1,
      subject: { kind: "run", id: queued.runId, projectId: project.id, flowId: flow.flowId }, phase: final ? "failed" : "running",
      label: final ? terminalLabel : "Running the Flow", at: new Date().toISOString(), ...(final ? { final: true, detail: terminalDetail } : {}) });
    const send = (socket: Socket, type: string, payload: unknown) => {
      const bytes = Buffer.from(JSON.stringify({ id: `isolated-${Date.now()}`, protocolVersion: "0.1", timestamp: Date.now(), type, payload }));
      const header = bytes.length < 126 ? Buffer.from([0x81, bytes.length]) : Buffer.from([0x81, 126, bytes.length >> 8, bytes.length & 255]);
      socket.write(Buffer.concat([header, bytes]));
    };
    server = createServer(async (req, res) => {
      const chunks: Buffer[] = []; for await (const chunk of req) chunks.push(Buffer.from(chunk));
      const body = chunks.length ? JSON.parse(Buffer.concat(chunks).toString()) : {};
      let payload: unknown = { conversations: [] };
      if (req.url?.includes("cancel-runtime-session")) {
        expect(body).toMatchObject({ projectId: project.id, runId: queued.runId });
        const session = await service.cancelRuntimeSession(body.projectId, body.runId, body.reason);
        stopped = session?.status === "cancelled"; payload = { runtimeSession: session };
        release(); await running;
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
    const port = (server.address() as { port: number }).port, page = extensionSession.extensionPage;
    await page.evaluate(async ({ port, projectId }) => chrome.storage.local.set({
      "fluxiq.clientId": "isolated-run-stop-proof", "fluxiq.session": { clientId: "isolated-run-stop-proof", token: "isolated-public-test-token", projectId },
      "fluxiq.settings": { gatewayUrl: `ws://127.0.0.1:${port}/client`, coreApiUrl: `http://127.0.0.1:${port}/`, autoReconnect: true, captureMutations: false, captureInputValues: false, captureSnapshots: false }
    }), { port, projectId: project.id });
    await restartServiceWorker(extensionSession); await page.reload();
    const stop = page.getByRole("button", { name: "Stop run", exact: true });
    await expect(stop).toBeVisible({ timeout: 15_000 }); await stop.click();
    await expect.poll(() => stopped).toBe(true);
    expect((await running).status).toBe("cancelled"); expect(executed).toContain("delayed"); expect(executed).not.toContain("after");
    expect(terminalLabel).toBe("Run cancelled");
    expect(await service.getFlow(project.id, flow.flowId)).toEqual(before);
    expect(await service.getFlow(project.id, graph.flowId)).toEqual(beforeGraph);
    await expect(stop).toBeHidden();
    await expect(page.getByText("Run cancelled", { exact: true }).first()).toBeVisible();
  } finally {
    unsubscribe(); release?.(); await running;
    for (const socket of sockets) socket.destroy();
    if (server) await new Promise<void>(resolve => server!.close(() => resolve()));
    await service.close(); await rm(dataDir, { recursive: true, force: true });
  }
});
