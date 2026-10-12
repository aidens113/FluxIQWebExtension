// Matrix row 9's fault: a committing act's outcome is lost on a live connection.
//
// The extension is pointed at this relay instead of Core's gateway. The relay
// passes the upgrade on (naming the gateway as `Host` and negotiating no
// compression, `upgrade-request.ts`), then reads every frame both ways and
// forwards each message as the exact bytes it arrived as. It watches the
// committing acts Core sends (`server.execute_action`, `committing-act.ts`)
// and picks one: the first whose target is exactly `onTargetSelector`, or the
// `afterCommittingActs`-th. It drops that command's first
// `client.action_result` and nothing else. The connection stays open, so the
// extension believes it answered and Core waits for an answer that never comes.
//
// Naming the act by its target is the exact form. Every press commits by the
// domain's definition, so a count also counts the optional dismissals a run
// may or may not press before the act meant (t404: a count of 2 dropped a
// "Not now" instead of the second confirm).
//
// Frames carry the pairing token and page data. Nothing here records a frame
// body: only message types, command ids, action types, result statuses and
// byte counts reach the log.

import net from "node:net";
import { isCommittingAct } from "./committing-act.js";
import type { PerturbationLog } from "./perturbation-log.js";
import { rewriteUpgradeRequest } from "./upgrade-request.js";
import { WebSocketUnitReader, type WebSocketUnit } from "./websocket-frames.js";

export type DropActionResultRelay = {
  /** The URL to give the extension as its gateway: the gateway's own path, on the relay's port. */
  url: string;
  close(): Promise<void>;
};

/** Which committing act loses its acknowledgement: the n-th, or the first whose `selector` parameter is exactly this. */
export type DropActionResultTarget = { afterCommittingActs: number; onTargetSelector?: undefined } | { onTargetSelector: string; afterCommittingActs?: undefined };

export type DropActionResultRelayInput = DropActionResultTarget & {
  /** Core's gateway, `ws://` on loopback. */
  gatewayUrl: string;
  log: PerturbationLog;
  /** Only for tests: which acts count as committing. Defaults to the domain's own definition. */
  isCommitting?: (actionType: string, parameters: unknown) => boolean;
};

type Envelope = { type?: unknown; payload?: { commandId?: unknown; actionType?: unknown; parameters?: unknown; status?: unknown } };

const HEAD_END = "\r\n\r\n";

/** Starts the relay on an ephemeral loopback port. */
export async function startDropActionResultRelay(input: DropActionResultRelayInput): Promise<DropActionResultRelay> {
  const gateway = new URL(input.gatewayUrl);
  if (gateway.protocol !== "ws:" || !["127.0.0.1", "localhost", "[::1]"].includes(gateway.hostname)) throw new Error("The action-result relay sits only in front of a loopback ws:// gateway");
  const gatewayHost = gateway.host;
  const gatewayPort = Number(gateway.port || "80");
  const isCommitting = input.isCommitting ?? isCommittingAct;
  const { log } = input;
  const state: { committing: number; target: string | undefined; dropped: boolean; unreadableNoted: boolean } = { committing: 0, target: undefined, dropped: false, unreadableNoted: false };
  const sockets = new Set<net.Socket>();
  let connections = 0;

  const inspectFromCore = (unit: WebSocketUnit, connection: number): void => {
    if (unit.kind !== "message") return;
    const message = readEnvelope(unit, connection);
    if (message?.type !== "server.execute_action") return;
    const commandId = String(message.payload?.commandId ?? "");
    const actionType = String(message.payload?.actionType ?? "");
    const parameters = message.payload?.parameters;
    const committing = isCommitting(actionType, parameters);
    const named = input.onTargetSelector !== undefined && targetSelector(parameters) === input.onTargetSelector;
    log.record("command.sent", { connection, commandId, actionType, committing, ...(named ? { namedTarget: true } : {}) });
    if (!committing) return;
    state.committing += 1;
    const chosen = input.onTargetSelector !== undefined ? named : state.committing === input.afterCommittingActs;
    if (chosen && state.target === undefined) {
      state.target = commandId;
      log.record("fault.armed", { connection, commandId, actionType, committingAct: state.committing });
    }
  };

  /** Whether the extension's unit goes on to Core. */
  const passesToCore = (unit: WebSocketUnit, connection: number): boolean => {
    if (unit.kind !== "message") return true;
    const message = readEnvelope(unit, connection);
    if (message?.type !== "client.action_result") return true;
    const commandId = String(message.payload?.commandId ?? "");
    const status = String(message.payload?.status ?? "");
    if (commandId === state.target && !state.dropped) {
      state.dropped = true;
      log.fire("fault.fired", { connection, commandId, status, droppedBytes: unit.frames.reduce((total, frame) => total + frame.bytes.length, 0) });
      return false;
    }
    log.record("result.forwarded", { connection, commandId, status, ...(commandId === state.target ? { afterDrop: true } : {}) });
    return true;
  };

  const readEnvelope = (unit: Extract<WebSocketUnit, { kind: "message" }>, connection: number): Envelope | undefined => {
    if (unit.compressed && !state.unreadableNoted) {
      state.unreadableNoted = true;
      log.record("frames.unreadable", { connection, reason: "compressed" });
    }
    if (unit.text === undefined) return undefined;
    try {
      return JSON.parse(unit.text) as Envelope;
    } catch (error) {
      if (error instanceof SyntaxError) return undefined;
      throw error;
    }
  };

  const server = net.createServer(client => {
    const connection = ++connections;
    const upstream = net.connect({ host: gateway.hostname, port: gatewayPort });
    sockets.add(client);
    sockets.add(upstream);
    log.record("relay.connection", { connection });
    const fromClient = new WebSocketUnitReader();
    const fromCore = new WebSocketUnitReader();
    let clientHead: Buffer | undefined = Buffer.alloc(0);
    let coreHead: Buffer | undefined = Buffer.alloc(0);
    let coreRaw = false;

    client.on("data", (chunk: Buffer) => {
      if (clientHead) {
        clientHead = Buffer.concat([clientHead, chunk]);
        const end = clientHead.indexOf(HEAD_END);
        if (end < 0) return;
        upstream.write(rewriteUpgradeRequest(clientHead.subarray(0, end).toString("latin1"), gatewayHost), "latin1");
        chunk = clientHead.subarray(end + HEAD_END.length);
        clientHead = undefined;
      }
      for (const unit of fromClient.push(chunk)) if (passesToCore(unit, connection)) for (const frame of unit.frames) upstream.write(frame.bytes);
    });
    upstream.on("data", (chunk: Buffer) => {
      if (coreRaw) {
        client.write(chunk);
        return;
      }
      if (coreHead) {
        coreHead = Buffer.concat([coreHead, chunk]);
        const end = coreHead.indexOf(HEAD_END);
        if (end < 0) return;
        const head = coreHead.subarray(0, end + HEAD_END.length);
        const statusLine = head.toString("latin1").split("\r\n", 1)[0] ?? "";
        client.write(head);
        chunk = coreHead.subarray(head.length);
        coreHead = undefined;
        if (!/^HTTP\/1\.1 101\b/u.test(statusLine)) {
          coreRaw = true;
          log.record("relay.upgrade-refused", { connection, status: statusLine.slice(9, 12) });
          client.write(chunk);
          return;
        }
      }
      for (const unit of fromCore.push(chunk)) {
        inspectFromCore(unit, connection);
        for (const frame of unit.frames) client.write(frame.bytes);
      }
    });
    const end = (side: "extension" | "core") => (hadError: boolean) => {
      log.record("relay.closed", { connection, side, hadError });
      sockets.delete(client);
      sockets.delete(upstream);
      client.destroy();
      upstream.destroy();
    };
    client.once("close", end("extension"));
    upstream.once("close", end("core"));
    client.on("error", error => log.record("relay.error", { connection, side: "extension", code: (error as NodeJS.ErrnoException).code ?? "unknown" }));
    upstream.on("error", error => log.record("relay.error", { connection, side: "core", code: (error as NodeJS.ErrnoException).code ?? "unknown" }));
  });

  await new Promise<void>((resolve, reject) => {
    server.once("error", reject);
    server.listen(0, "127.0.0.1", () => {
      server.off("error", reject);
      resolve();
    });
  });
  const address = server.address();
  if (address === null || typeof address === "string") throw new Error("The action-result relay did not get a TCP port");
  const url = `ws://127.0.0.1:${address.port}${gateway.pathname}${gateway.search}`;
  log.record("relay.listening", { relayOrigin: `ws://127.0.0.1:${address.port}`, gatewayOrigin: `ws://${gatewayHost}`, ...(input.onTargetSelector !== undefined ? { onTargetSelector: true } : { afterCommittingActs: input.afterCommittingActs }) });
  return {
    url,
    close: async () => {
      for (const socket of sockets) socket.destroy();
      sockets.clear();
      await new Promise<void>((resolve, reject) => server.close(error => (error ? reject(error) : resolve())));
    },
  };
}

/** The `selector` a command's parameters carry, as Core sent it; never logged, since a selector can name page text. */
function targetSelector(parameters: unknown): string | undefined {
  if (parameters === null || typeof parameters !== "object" || Array.isArray(parameters)) return undefined;
  const selector = (parameters as { selector?: unknown }).selector;
  return typeof selector === "string" ? selector : undefined;
}
