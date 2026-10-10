import assert from "node:assert/strict";
import { createHash } from "node:crypto";
import net from "node:net";
import test from "node:test";
import { startDropActionResultRelay } from "../drop-action-result-relay.js";
import { PerturbationLog } from "../perturbation-log.js";
import { WebSocketUnitReader } from "../websocket-frames.js";

/**
 * A stand-in for Core's gateway: accepts one upgrade, keeps the request head,
 * sends whatever the test asks as unmasked text frames, and collects the text
 * of every message the client's side delivers.
 */
async function fakeGateway() {
  const received: string[] = [];
  let head = "";
  let socket: net.Socket | undefined;
  let connected!: () => void;
  const ready = new Promise<void>(resolve => { connected = resolve; });
  const server = net.createServer(client => {
    socket = client;
    const reader = new WebSocketUnitReader();
    let pending: Buffer | undefined = Buffer.alloc(0);
    client.on("data", (chunk: Buffer) => {
      if (pending) {
        pending = Buffer.concat([pending, chunk]);
        const end = pending.indexOf("\r\n\r\n");
        if (end < 0) return;
        head = pending.subarray(0, end).toString("latin1");
        const key = /sec-websocket-key:\s*(\S+)/iu.exec(head)?.[1] ?? "";
        const accept = createHash("sha1").update(`${key}258EAFA5-E914-47DA-95CA-C5AB0DC85B11`).digest("base64");
        client.write(`HTTP/1.1 101 Switching Protocols\r\nUpgrade: websocket\r\nConnection: Upgrade\r\nSec-WebSocket-Accept: ${accept}\r\n\r\n`);
        chunk = pending.subarray(end + 4);
        pending = undefined;
        connected();
      }
      for (const unit of reader.push(chunk)) if (unit.kind === "message" && unit.text !== undefined) received.push(unit.text);
    });
  });
  await new Promise<void>(resolve => server.listen(0, "127.0.0.1", resolve));
  const port = (server.address() as net.AddressInfo).port;
  return {
    url: `ws://127.0.0.1:${port}/client`,
    port,
    ready,
    received,
    head: () => head,
    send(message: unknown) {
      const payload = Buffer.from(JSON.stringify(message));
      socket!.write(Buffer.concat([Buffer.from([0x81, payload.length < 126 ? payload.length : 126]), payload.length < 126 ? Buffer.alloc(0) : Buffer.from([payload.length >> 8, payload.length & 0xff]), payload]));
    },
    close: () => { socket?.destroy(); return new Promise<void>(resolve => server.close(() => resolve())); },
  };
}

async function eventually(predicate: () => boolean, label: string): Promise<void> {
  const deadline = Date.now() + 5_000;
  while (!predicate()) {
    if (Date.now() > deadline) throw new Error(`Timed out waiting for ${label}`);
    await new Promise(resolve => setTimeout(resolve, 10));
  }
}

const command = (commandId: string, actionType: string) => ({ type: "server.execute_action", payload: { commandId, actionType, parameters: { selector: "#x" } } });
const result = (commandId: string) => ({ type: "client.action_result", payload: { commandId, status: "succeeded", payload: { secret: "pairing-token-value" } } });

test("the n-th committing act's first result is dropped, and every other frame passes with the connection kept open", async () => {
  const gateway = await fakeGateway();
  const log = new PerturbationLog({ kind: "drop-action-result", afterCommittingActs: 2 });
  const relay = await startDropActionResultRelay({ gatewayUrl: gateway.url, afterCommittingActs: 2, log });
  const client = new WebSocket(relay.url);
  const fromCore: string[] = [];
  client.addEventListener("message", event => {
    const text = String(event.data);
    fromCore.push(text);
    const message = JSON.parse(text) as { payload: { commandId: string } };
    client.send(JSON.stringify(result(message.payload.commandId)));
    if (message.payload.commandId === "c2") client.send(JSON.stringify(result("c2"))); // A second answer to the dropped command passes.
  });
  try {
    await new Promise<void>((resolve, reject) => { client.addEventListener("open", () => resolve()); client.addEventListener("error", () => reject(new Error("client did not open"))); });
    await gateway.ready;
    assert.match(gateway.head(), new RegExp(`\\r\\nHost: 127\\.0\\.0\\.1:${gateway.port}(\\r\\n|$)`, "u"));
    assert.doesNotMatch(gateway.head(), /sec-websocket-extensions/iu);
    for (const [id, type] of [["c0", "web.dom.extract"], ["c1", "web.dom.click"], ["c2", "web.dom.click"], ["c3", "web.dom.click"]] as const) {
      gateway.send(command(id, type));
      await eventually(() => fromCore.length >= Number(id.slice(1)) + 1, `command ${id}`);
    }
    await eventually(() => gateway.received.length >= 4, "the forwarded results");
    assert.deepEqual(gateway.received.map(text => (JSON.parse(text) as { payload: { commandId: string } }).payload.commandId), ["c0", "c1", "c2", "c3"]);
    assert.equal(client.readyState, WebSocket.OPEN);
    const report = log.report();
    assert.equal(report.fired, true);
    assert.equal(report.firedEvent, "fault.fired");
    const armed = report.events.find(event => event.event === "fault.armed");
    const fired = report.events.find(event => event.event === "fault.fired");
    assert.equal(armed?.detail?.commandId, "c2");
    assert.equal(armed?.detail?.committingAct, 2);
    assert.equal(fired?.detail?.commandId, "c2");
    assert.ok(report.events.some(event => event.event === "result.forwarded" && event.detail?.commandId === "c2" && event.detail.afterDrop === true));
    assert.ok(!JSON.stringify(report).includes("pairing-token-value"), "no frame body reaches the record");
  } finally {
    client.close();
    await relay.close();
    await gateway.close();
  }
});

test("only a loopback ws:// gateway can be relayed", async () => {
  const log = new PerturbationLog({ kind: "drop-action-result", afterCommittingActs: 1 });
  await assert.rejects(startDropActionResultRelay({ gatewayUrl: "wss://127.0.0.1:4877/client", afterCommittingActs: 1, log }));
  await assert.rejects(startDropActionResultRelay({ gatewayUrl: "ws://gateway.example:4877/client", afterCommittingActs: 1, log }));
});
