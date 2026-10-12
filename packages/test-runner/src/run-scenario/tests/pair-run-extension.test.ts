import assert from "node:assert/strict";
import test from "node:test";
import type { Page } from "@playwright/test";
import type { RunningTopology } from "../../coordinator.js";
import { ExtensionStartTrace } from "../extension-start-trace/index.js";
import { pairRunExtension } from "../pair-run-extension.js";

test("the extension is pointed at the run's gateway and Core, the pairing is approved through Core, and the connected status comes back", async () => {
  const messages: Array<Record<string, unknown>> = [];
  const approved: string[] = [];
  let paired = false;
  const page = {
    evaluate: async (_run: unknown, message: Record<string, unknown>) => {
      messages.push(message);
      if (message.type === "fluxiq.connect") return { ok: true, status: { connectionState: "pairing", pairingReferenceCode: "123456" } };
      return { ok: true, status: paired ? { connectionState: "connected", sessionId: "session-1" } : { connectionState: "pairing", pairingReferenceCode: "123456" } };
    },
  } as unknown as Page;
  const topology = {
    gatewayUrl: "ws://127.0.0.1:5000/client",
    fluxiqOrigin: "http://127.0.0.1:5001",
    control: {
      approvePairing: async (code: string) => {
        approved.push(code);
        paired = true;
        return {};
      },
    },
  } as unknown as RunningTopology;
  const trace = new ExtensionStartTrace({ secrets: [] });
  const status = await pairRunExtension(page, topology, trace);
  assert.equal(status.connectionState, "connected");
  assert.equal(status.sessionId, "session-1");
  assert.deepEqual(approved, ["123456"]);
  const connect = messages.find(message => message.type === "fluxiq.connect");
  assert.deepEqual(connect?.settings, { gatewayUrl: "ws://127.0.0.1:5000/client", coreApiUrl: "http://127.0.0.1:5001", autoReconnect: true, captureMutations: true, captureInputValues: true, captureSnapshots: true });
});
