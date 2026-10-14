// The host lease Core stamps on a command (automation-project-agents plan)
// reaches the server command channel. The action mapping keeps only the fields
// it knows, so the session carries the lease beside the mapped action and the
// fact check; a command without one arrives exactly as before.

import assert from "node:assert/strict";
import test from "node:test";
import type { FluxIQSession, FluxIQSettings, ServerCommandPayload } from "../../../../shared/protocol";
import { GatewaySession, type GatewaySessionDeps } from "../../gateway-session";

/** A socket that opens on the next turn and lets the test deliver server messages to it. */
class OpeningSocket {
  static latest: OpeningSocket | undefined;
  readyState = 0;
  private readonly listeners = new Map<string, Set<(event: unknown) => void>>();
  constructor(readonly url: string) {
    OpeningSocket.latest = this;
    setTimeout(() => {
      this.readyState = 1;
      for (const listener of this.listeners.get("open") ?? []) listener({});
    }, 0);
  }
  send(): void {}
  close(): void { this.readyState = 3; }
  addEventListener(type: string, listener: (event: unknown) => void): void {
    const set = this.listeners.get(type) ?? new Set();
    set.add(listener);
    this.listeners.set(type, set);
  }
  removeEventListener(type: string, listener: (event: unknown) => void): void {
    this.listeners.get(type)?.delete(listener);
  }
  deliver(message: unknown): void {
    for (const listener of this.listeners.get("message") ?? []) listener({ data: JSON.stringify(message) });
  }
}

async function commandsFor(payloads: unknown[]): Promise<ServerCommandPayload[]> {
  const commands: ServerCommandPayload[] = [];
  const deps: GatewaySessionDeps = {
    settings: () => ({ gatewayUrl: "ws://gateway.test", autoReconnect: false }) as FluxIQSettings,
    session: () => ({ clientId: "client-1" }) as FluxIQSession,
    persistSession: async () => undefined,
    emitStatus: () => undefined,
    reportError: () => undefined,
    clearError: () => undefined,
    beforeConnect: async () => undefined,
    queue: { queueEvent: async () => 0, readQueuedEvents: async () => [], clearQueuedEvents: async () => undefined },
    handlers: {
      onServerMessage: () => undefined,
      onPairingRequired: () => undefined,
      onSessionReady: () => undefined,
      onCommand: (command) => void commands.push(command),
      onHeartbeat: () => undefined
    }
  };
  const holder = globalThis as { WebSocket?: unknown; chrome?: unknown };
  const previous = { WebSocket: holder.WebSocket, chrome: holder.chrome };
  holder.WebSocket = OpeningSocket;
  holder.chrome = { runtime: { getManifest: () => ({ version: "0.0.0-test" }) } };
  const session = new GatewaySession(deps);
  try {
    await session.connect();
    payloads.forEach((payload, index) => OpeningSocket.latest!.deliver({ id: `m-${index}`, type: "server.execute_action", protocolVersion: "1", timestamp: 1, payload }));
    await new Promise((resolve) => setTimeout(resolve, 0));
    return commands;
  } finally {
    session.closeClient();
    holder.WebSocket = previous.WebSocket;
    holder.chrome = previous.chrome;
  }
}

const lease = { resourceKey: "web.automation:client-1", epoch: 7, holder: { role: "builder", briefId: "brief-1" } };

test("a leased action arrives with its lease beside the mapped action; an unleased one arrives as before", async () => {
  const [leased, plain] = await commandsFor([
    { commandId: "cmd-1", actionType: "web.dom.click", parameters: { selector: "#add" }, lease },
    { commandId: "cmd-2", actionType: "web.dom.click", parameters: { selector: "#add" } }
  ]);
  assert.equal(leased?.command, "execute_action");
  assert.deepEqual(leased?.command === "execute_action" ? leased.lease : undefined, lease);
  assert.equal(leased?.command === "execute_action" ? leased.action.commandId : undefined, "cmd-1");
  assert.equal(plain?.command, "execute_action");
  assert.equal(Object.hasOwn(plain ?? {}, "lease"), false);
});

test("a leased fact check arrives with its lease", async () => {
  const [check] = await commandsFor([
    { commandId: "cmd-facts", actionType: "web.page.facts", parameters: { queries: [{ kind: "url", comparison: "contains", expected: "/cart" }] }, lease }
  ]);
  assert.equal(check?.command, "evaluate_facts", JSON.stringify(check));
  assert.deepEqual(check?.command === "evaluate_facts" ? check.lease : undefined, lease);
});
