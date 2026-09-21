import assert from "node:assert/strict";
import test from "node:test";
import type { Page } from "@playwright/test";
import type { BrowserEvidenceRecorder } from "../../browser-evidence.js";
import { installRuntimeActionEvidence } from "../browser-session.js";

test("runtime action evidence skips redundant Lab captures around Core state snapshots", async () => {
  let receive: ((boundary: unknown) => void) | undefined;
  const acknowledgements: unknown[] = [];
  const captured: unknown[] = [];
  const global = globalThis as typeof globalThis & Record<string, any>;
  const originalChrome = global.chrome;
  const originalBinding = global.__fluxiqCaptureActionBoundary;
  const port = {
    disconnect() {},
    onMessage: { addListener(listener: (boundary: unknown) => void) { receive = listener; } },
    postMessage(message: unknown) { acknowledgements.push(message); },
  };
  global.chrome = { runtime: { connect: () => port } };
  const page = {
    async exposeBinding(name: string, binding: (_source: unknown, boundary: unknown) => Promise<void>) {
      global[name] = (boundary: unknown) => binding({}, boundary);
    },
    async evaluate(operation: () => void) { operation(); },
  } as unknown as Page;
  const evidence = {
    async runtimeActionBoundary(boundary: unknown) { captured.push(boundary); },
  } as unknown as BrowserEvidenceRecorder;

  try {
    await installRuntimeActionEvidence(page, evidence);
    receive?.({ boundaryId: "snapshot:before:1", phase: "before", commandId: "snapshot", actionType: "web.dom.capture_snapshot" });
    await new Promise(resolve => setImmediate(resolve));
    assert.deepEqual(captured, []);
    assert.deepEqual(acknowledgements, [{ boundaryId: "snapshot:before:1", ok: true }]);

    receive?.({ boundaryId: "type:before:2", phase: "before", commandId: "type", actionType: "web.dom.type" });
    await new Promise(resolve => setImmediate(resolve));
    assert.deepEqual(captured, [{ phase: "before", commandId: "type", actionType: "web.dom.type" }]);
    assert.deepEqual(acknowledgements.at(-1), { boundaryId: "type:before:2", ok: true });
  } finally {
    if (originalChrome === undefined) delete global.chrome;
    else global.chrome = originalChrome;
    if (originalBinding === undefined) delete global.__fluxiqCaptureActionBoundary;
    else global.__fluxiqCaptureActionBoundary = originalBinding;
  }
});
