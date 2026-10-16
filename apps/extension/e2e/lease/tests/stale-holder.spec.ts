// The browser's own check of a command's host lease (automation-project-agents
// plan, `Extension And Domain Wiring` 1), in a real Chromium with the real
// built extension, against a stand-in gateway on loopback and the everything
// store's home page from the Scenario Lab.
//
// The unit rows (`src/background/connection/host-lease/tests/`) stop a command
// that is let through before it reaches the page. This one lets it reach the
// page: a command under the current lease types into the store's search box on
// the automation tab while the extension's own page is in front; a late copy
// under an older epoch, and one naming another holder on the current epoch, are
// answered with the typed refusal and leave the box, the runtime status and the
// recording stream as they were; a higher epoch is then adopted and its command
// types. The oracle is the page itself and what the browser sent the gateway.

import { createHash, randomBytes } from "node:crypto";
import { createServer, type Server } from "node:http";
import type { AddressInfo, Socket } from "node:net";
import type { Page } from "@playwright/test";
import { startScenarioLab } from "../../../../scenario-lab/src/server.js";
import { expect, restartServiceWorker, test } from "../../fixtures/extension-context.js";
import type { ExtensionSession } from "../../fixtures/extension-context.js";

/** The scenario's own seed, which its class names and generated ids are drawn from. */
const SEED = 241;
const STORE_PATH = "/scenarios/everything-store/";
/** The header's search box; the honeypot beside it is named `field-keywords`. */
const SEARCH = 'input[name="k"]';
const CLIENT_ID = "extension-e2e-host-lease";
const RESOURCE_KEY = `web.automation:${CLIENT_ID}`;

type ClientMessage = { type: string; payload: Record<string, unknown> & { commandId?: string } };
type Lease = { resourceKey: string; epoch: number; holder: { role: string; briefId: string } };

type StandInGateway = {
  readonly url: string;
  readonly received: () => ClientMessage[];
  readonly command: (commandId: string, actionType: string, parameters: Record<string, unknown>, lease: Lease) => void;
  readonly close: () => Promise<void>;
};

const lease = (epoch: number, briefId: string): Lease => ({ resourceKey: RESOURCE_KEY, epoch, holder: { role: "builder", briefId } });

/** A gateway that answers the hello with a ready session and sends `server.execute_action` on request. */
async function startStandInGateway(): Promise<StandInGateway> {
  const sockets = new Set<Socket>();
  const received: ClientMessage[] = [];
  let ordinal = 0;
  const send = (socket: Socket, type: string, payload: unknown): void => {
    const bytes = Buffer.from(JSON.stringify({ id: `stand-in-${++ordinal}`, protocolVersion: "0.1", timestamp: Date.now(), type, payload }));
    const header = bytes.length < 126
      ? Buffer.from([0x81, bytes.length])
      : Buffer.from([0x81, 126, bytes.length >> 8, bytes.length & 255]);
    socket.write(Buffer.concat([header, bytes]));
  };
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
    // A large message arrives as a text frame and continuation frames; it is read once the last has.
    let fragments: Buffer[] | undefined;
    socket.on("data", (chunk: Buffer) => {
      buffered = Buffer.concat([buffered, chunk]);
      for (;;) {
        const frame = readClientFrame(buffered);
        if (!frame) break;
        buffered = buffered.subarray(frame.length);
        if (frame.opcode === 1) fragments = [frame.data];
        else if (frame.opcode === 0 && fragments) fragments.push(frame.data);
        else continue;
        if (!frame.final) continue;
        const message = JSON.parse(Buffer.concat(fragments).toString("utf8")) as ClientMessage;
        fragments = undefined;
        received.push(message);
        if (message.type === "client.hello") send(socket, "server.session_ready", { sessionId: "stand-in-session", token: "e2e-pairing-token" });
      }
    });
  });
  await new Promise<void>((resolve) => server.listen(0, "127.0.0.1", resolve));
  const port = (server.address() as AddressInfo).port;
  return {
    url: `ws://127.0.0.1:${port}/client`,
    received: () => [...received],
    command: (commandId, actionType, parameters, granted) => {
      if (sockets.size === 0) throw new Error("No extension socket is open on the stand-in gateway.");
      for (const socket of sockets) send(socket, "server.execute_action", { commandId, actionType, parameters, lease: granted });
    },
    close: async () => {
      for (const socket of sockets) socket.destroy();
      await new Promise<void>((resolve) => server.close(() => resolve()));
    }
  };
}

/** One masked client frame, or undefined until the whole frame has arrived. */
function readClientFrame(buffer: Buffer): { opcode: number; final: boolean; data: Buffer; length: number } | undefined {
  if (buffer.length < 2) return undefined;
  const final = (buffer[0]! & 0x80) !== 0;
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
  return { opcode, final, data, length: offset + length };
}

/** Every message the browser sent the gateway that names `commandId`. */
const about = (gateway: StandInGateway, commandId: string): ClientMessage[] =>
  gateway.received().filter((message) => message.payload?.commandId === commandId || JSON.stringify(message.payload).includes(`"${commandId}"`));

/** The browser's answer to `commandId`, once it has sent one. */
async function answerTo(gateway: StandInGateway, commandId: string): Promise<ClientMessage["payload"]> {
  await expect.poll(() => gateway.received().some((message) => message.type === "client.action_result" && message.payload.commandId === commandId), { timeout: 20_000 }).toBe(true);
  return gateway.received().find((message) => message.type === "client.action_result" && message.payload.commandId === commandId)!.payload;
}

type RuntimeView = { state?: string; commandId?: string; tabId?: number };

const runtimeStatus = async (session: ExtensionSession): Promise<RuntimeView> =>
  await session.extensionPage.evaluate(async () => ((await chrome.runtime.sendMessage({ type: "fluxiq.getStatus" })) as { status?: { runtime?: RuntimeView } }).status?.runtime ?? {});

const tabIdShowing = (session: ExtensionSession, url: string): Promise<number | undefined> =>
  session.extensionPage.evaluate(async (wanted) => (await chrome.tabs.query({})).find((tab) => tab.url === wanted)?.id, url);

const frontTabUrl = (session: ExtensionSession): Promise<string | undefined> =>
  session.extensionPage.evaluate(async () => (await chrome.tabs.query({ active: true, lastFocusedWindow: true }))[0]?.url);

const searchValue = (store: Page): Promise<string> => store.locator(SEARCH).inputValue();

test("a leased command runs on the automation tab; a stale epoch and another holder are refused and change nothing; a higher epoch is adopted", async ({ extensionSession }) => {
  test.setTimeout(90_000);
  const lab = await startScenarioLab({ runToken: randomBytes(24).toString("base64url"), seed: SEED });
  const gateway = await startStandInGateway();
  try {
    const panel = extensionSession.extensionPage;
    await panel.evaluate(async (gatewayUrl) => {
      await chrome.storage.local.set({
        "fluxiq.clientId": "extension-e2e-host-lease",
        "fluxiq.session": { clientId: "extension-e2e-host-lease", token: "e2e-pairing-token" },
        "fluxiq.settings": { gatewayUrl, coreApiUrl: "http://127.0.0.1:9/", autoReconnect: true, captureMutations: false, captureInputValues: false, captureSnapshots: false }
      });
    }, gateway.url);
    await restartServiceWorker(extensionSession);
    await expect.poll(() => gateway.received().some((message) => message.type === "client.hello"), { timeout: 15_000 }).toBe(true);

    // Epoch 5 is granted to brief-1, and its first command opens the store in the automation tab.
    const storeUrl = new URL(STORE_PATH, lab.origin).href;
    gateway.command("lease-open", "web.browser.navigate", { url: storeUrl }, lease(5, "brief-1"));
    const opened = await answerTo(gateway, "lease-open");
    expect(opened.status, String(opened.message)).toBe("succeeded");
    await expect.poll(() => tabIdShowing(extensionSession, storeUrl)).toBeDefined();
    const storeTab = (await tabIdShowing(extensionSession, storeUrl))!;
    const store = extensionSession.context.pages().find((page) => page.url() === storeUrl);
    if (!store) throw new Error(`No Playwright page shows ${storeUrl}`);
    await expect(store.locator(SEARCH)).toBeVisible();

    // The extension's own page is in front from here on: a leased command that
    // names no tab must still land on the automation tab the lease grants.
    await panel.bringToFront();
    await expect.poll(() => frontTabUrl(extensionSession)).toContain("chrome-extension://");

    gateway.command("lease-current", "web.dom.type", { selector: SEARCH, text: "kettle" }, lease(5, "brief-1"));
    const current = await answerTo(gateway, "lease-current");
    expect(current.status, String(current.message)).toBe("succeeded");
    expect(await searchValue(store)).toBe("kettle");
    expect(await runtimeStatus(extensionSession)).toMatchObject({ commandId: "lease-current", tabId: storeTab });

    // A late copy from the grant before (epoch 4), then one naming another holder on epoch 5.
    const refusals: Array<{ commandId: string; granted: Lease; code: string }> = [
      { commandId: "lease-stale", granted: lease(4, "brief-0"), code: "host_lease.stale" },
      { commandId: "lease-other-holder", granted: lease(5, "brief-2"), code: "host_lease.holder_mismatch" }
    ];
    for (const { commandId, granted, code } of refusals) {
      const statusBefore = await runtimeStatus(extensionSession);
      const recordingEventsBefore = gateway.received().filter((message) => message.type === "client.recording_event").length;
      gateway.command(commandId, "web.dom.type", { selector: SEARCH, text: "stale holder text" }, granted);
      const refusal = await answerTo(gateway, commandId);
      expect(refusal).toMatchObject({
        commandId,
        status: "failed",
        failure: { category: "blocked_by_capability_or_policy", code, retryable: false, stage: "dispatch", effect: "unacted" },
        payload: { commandId, status: "refused", code }
      });
      expect(String((refusal.failure as { actual?: unknown }).actual)).toContain("seen epoch 5 ");
      // Give a command that slipped through time to reach the page before judging that none did.
      await store.waitForTimeout(1_500);
      expect(await searchValue(store), `${commandId}: the page is unchanged`).toBe("kettle");
      expect(await runtimeStatus(extensionSession), `${commandId}: no runtime status opened`).toEqual(statusBefore);
      expect(about(gateway, commandId).map((message) => message.type), `${commandId}: the refusal is all the browser sent about it`).toEqual(["client.action_result"]);
      expect(gateway.received().filter((message) => message.type === "client.recording_event").length, `${commandId}: nothing recorded`).toBe(recordingEventsBefore);
    }

    // The resource is granted again, to brief-2 under epoch 6: adopted, and its command types.
    gateway.command("lease-regranted", "web.dom.type", { selector: SEARCH, text: "travel mug" }, lease(6, "brief-2"));
    const regranted = await answerTo(gateway, "lease-regranted");
    expect(regranted.status, String(regranted.message)).toBe("succeeded");
    expect(await searchValue(store)).toBe("travel mug");
    expect(await runtimeStatus(extensionSession)).toMatchObject({ commandId: "lease-regranted", tabId: storeTab });

    // And epoch 5, current a moment ago, is stale from then on.
    gateway.command("lease-superseded", "web.dom.type", { selector: SEARCH, text: "stale holder text" }, lease(5, "brief-1"));
    expect(await answerTo(gateway, "lease-superseded")).toMatchObject({ status: "failed", failure: { code: "host_lease.stale" } });
    await store.waitForTimeout(1_000);
    expect(await searchValue(store)).toBe("travel mug");
  } finally {
    await gateway.close();
    await lab.close();
  }
});
