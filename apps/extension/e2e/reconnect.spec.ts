import { createHash } from "node:crypto";
import { createServer, type Server } from "node:http";
import type { AddressInfo, Socket } from "node:net";
import { expect, restartServiceWorker, test } from "./fixtures/extension-context";

// Reconnection without a person pressing Connect (PANEL-007, "nothing
// reconnects after a browser restart"), against a stand-in gateway on loopback
// that only accepts sockets and records the hello each one opens with.
//
// A restarted service worker is what an extension reload, an update, a browser
// restart and a worker Chrome stopped for idleness all have in common: the
// worker starts again with a pairing token in storage and no connection. And a
// socket the gateway drops is what a FluxIQ restart or a network blip looks like
// from the extension.

type FakeGateway = {
  readonly url: string;
  readonly hellos: () => Array<{ token: unknown; clientId: unknown }>;
  readonly dropAll: () => void;
  readonly close: () => Promise<void>;
};

async function startFakeGateway(port = 0): Promise<FakeGateway> {
  const sockets = new Set<Socket>();
  const hellos: Array<{ token: unknown; clientId: unknown }> = [];
  const server: Server = createServer((_request, response) => response.writeHead(404).end());
  server.on("upgrade", (request, socket: Socket) => {
    const key = request.headers["sec-websocket-key"];
    if (typeof key !== "string") return socket.destroy();
    const accept = createHash("sha1").update(`${key}258EAFA5-E914-47DA-95CA-C5AB0DC85B11`).digest("base64");
    socket.write(`HTTP/1.1 101 Switching Protocols\r\nUpgrade: websocket\r\nConnection: Upgrade\r\nSec-WebSocket-Accept: ${accept}\r\n\r\n`);
    sockets.add(socket);
    socket.on("close", () => sockets.delete(socket));
    socket.on("error", () => sockets.delete(socket));
    let buffered = Buffer.alloc(0);
    socket.on("data", (chunk: Buffer) => {
      buffered = Buffer.concat([buffered, chunk]);
      for (;;) {
        const frame = readClientFrame(buffered);
        if (!frame) break;
        buffered = buffered.subarray(frame.length);
        if (frame.opcode !== 1) continue;
        const message = JSON.parse(frame.text) as { type?: string; payload?: { token?: unknown; clientId?: unknown } };
        if (message.type === "client.hello") hellos.push({ token: message.payload?.token, clientId: message.payload?.clientId });
      }
    });
  });
  await new Promise<void>((resolve) => server.listen(port, "127.0.0.1", resolve));
  const bound = (server.address() as AddressInfo).port;
  return {
    url: `ws://127.0.0.1:${bound}/client`,
    hellos: () => [...hellos],
    dropAll: () => { for (const socket of sockets) socket.destroy(); },
    close: async () => {
      for (const socket of sockets) socket.destroy();
      await new Promise<void>((resolve) => server.close(() => resolve()));
    }
  };
}

// One masked client frame, or undefined until the whole frame has arrived.
function readClientFrame(buffer: Buffer): { opcode: number; text: string; length: number } | undefined {
  if (buffer.length < 2) return undefined;
  const opcode = buffer[0]! & 0x0f;
  let length = buffer[1]! & 0x7f;
  let offset = 2;
  if (length === 126) {
    if (buffer.length < 4) return undefined;
    length = buffer.readUInt16BE(2);
    offset = 4;
  } else if (length === 127) {
    if (buffer.length < 10) return undefined;
    length = Number(buffer.readBigUInt64BE(2));
    offset = 10;
  }
  const masked = (buffer[1]! & 0x80) !== 0;
  const mask = masked ? buffer.subarray(offset, offset + 4) : undefined;
  if (masked) offset += 4;
  if (buffer.length < offset + length) return undefined;
  const data = Buffer.from(buffer.subarray(offset, offset + length));
  if (mask) for (let index = 0; index < data.length; index += 1) data[index] = data[index]! ^ mask[index % 4]!;
  return { opcode, text: data.toString("utf8"), length: offset + length };
}

test("a restarted worker reconnects a paired browser by itself, and reconnects again when the socket drops", async ({ extensionSession }) => {
  const gateway = await startFakeGateway();
  try {
    // The side panel asks for status when it opens, and that too reconnects a
    // paired browser. The same page under another address is not a control page
    // (`background/control-page.ts` compares the whole URL), so its status
    // requests -- the restart helper's readiness check among them -- reconnect
    // nothing, and only the worker's own start-up can.
    await extensionSession.extensionPage.goto(`chrome-extension://${extensionSession.metadata.id}/sidepanel/index.html?reconnect-probe`);
    await extensionSession.extensionPage.evaluate(async (gatewayUrl) => {
      await chrome.storage.local.set({
        "fluxiq.clientId": "extension-e2e-reconnect",
        "fluxiq.session": { clientId: "extension-e2e-reconnect", token: "e2e-pairing-token" },
        "fluxiq.settings": {
          gatewayUrl,
          coreApiUrl: "http://127.0.0.1:9/",
          autoReconnect: true,
          captureMutations: true,
          captureInputValues: true,
          captureSnapshots: true
        }
      });
    }, gateway.url);
    expect(gateway.hellos()).toEqual([]);

    await restartServiceWorker(extensionSession);
    await expect.poll(() => gateway.hellos().length, { timeout: 15_000 }).toBeGreaterThanOrEqual(1);
    expect(gateway.hellos()[0]).toEqual({ token: "e2e-pairing-token", clientId: "extension-e2e-reconnect" });

    const before = gateway.hellos().length;
    gateway.dropAll();
    await expect.poll(() => gateway.hellos().length, { timeout: 15_000 }).toBeGreaterThan(before);
  } finally {
    await gateway.close();
  }
});

test("saved settings of the wrong shape are repaired rather than breaking every message", async ({ extensionSession }) => {
  await extensionSession.extensionPage.evaluate(() => chrome.storage.local.set({ "fluxiq.settings": { coreApiUrl: 42, autoReconnect: "yes" }, "fluxiq.queuedEvents": "not a list" }));
  await restartServiceWorker(extensionSession);
  const status = await extensionSession.extensionPage.evaluate(() => chrome.runtime.sendMessage({ type: "fluxiq.getStatus" })) as { ok: boolean; status?: { settings?: { coreApiUrl?: unknown; autoReconnect?: unknown }; queueSize?: unknown } };
  expect(status.ok).toBe(true);
  expect(typeof status.status?.settings?.coreApiUrl).toBe("string");
  expect(status.status?.settings?.autoReconnect).toBe(true);
  expect(status.status?.queueSize).toBe(0);
  const stored = await extensionSession.extensionPage.evaluate(() => chrome.storage.local.get(["fluxiq.settings", "fluxiq.queuedEvents", "fluxiq.problemLog"]));
  expect(typeof (stored["fluxiq.settings"] as { coreApiUrl?: unknown }).coreApiUrl).toBe("string");
  expect(stored["fluxiq.queuedEvents"]).toEqual([]);
  expect(JSON.stringify(stored["fluxiq.problemLog"])).toContain("repaired");
});

test("while a paired browser cannot reach FluxIQ, the reconnect alarm is set and fires, and the browser reconnects once FluxIQ answers", async ({ extensionSession }) => {
  test.setTimeout(120_000);
  // A gateway that is not listening yet: take a free port, then close it.
  const probe = await startFakeGateway();
  const gatewayUrl = probe.url;
  await probe.close();
  const page = extensionSession.extensionPage;
  await page.goto(`chrome-extension://${extensionSession.metadata.id}/sidepanel/index.html?alarm-probe`);
  await page.evaluate(async (url) => {
    await chrome.storage.local.set({
      "fluxiq.clientId": "extension-e2e-alarm",
      "fluxiq.session": { clientId: "extension-e2e-alarm", token: "e2e-pairing-token" },
      "fluxiq.settings": { gatewayUrl: url, coreApiUrl: "http://127.0.0.1:9/", autoReconnect: true, captureMutations: true, captureInputValues: true, captureSnapshots: true }
    });
  }, gatewayUrl);
  await restartServiceWorker(extensionSession);

  // Armed: the worker's start-up connect failed, so the watchdog set its alarm.
  await expect.poll(() => page.evaluate(async () => (await chrome.alarms.get("fluxiq.reconnect"))?.periodInMinutes ?? null), { timeout: 15_000 }).toBe(0.5);

  // Fires: an extension page hears the same alarm event the worker does.
  const fired = await page.evaluate(() => new Promise<string>((resolve, reject) => {
    const timer = setTimeout(() => reject(new Error("the reconnect alarm did not fire within 60 s")), 60_000);
    chrome.alarms.onAlarm.addListener((alarm) => {
      if (alarm.name !== "fluxiq.reconnect") return;
      clearTimeout(timer);
      resolve(alarm.name);
    });
  }));
  expect(fired).toBe("fluxiq.reconnect");

  // Back: once FluxIQ answers on that address the browser reconnects. (Clearing the alarm
  // needs a real session_ready, which this stand-in never sends; the unit test covers it.)
  const port = Number(new URL(gatewayUrl).port);
  const gateway = await startFakeGateway(port);
  try {
    await expect.poll(() => gateway.hellos().length, { timeout: 45_000 }).toBeGreaterThanOrEqual(1);
  } finally {
    await gateway.close();
  }
});
