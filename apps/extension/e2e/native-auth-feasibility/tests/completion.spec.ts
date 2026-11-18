import { readFile, stat } from "node:fs/promises";
import path from "node:path";
import { expect, test } from "@playwright/test";
import { assertNativeProbeCompletion } from "../completion.js";
import { nativeProbeEvidence, saveNativeProbeEvidence } from "../evidence/index.js";
import { createProbeAllocation, removeProbeAllocation } from "../allocation/index.js";

test("completion distinguishes callback mismatch from an attempted network handoff", () => {
  const valid = { outcome: "success", callbackMatched: true, nativeCallbackRequests: 0, driverNativeClosed: true };
  expect(() => assertNativeProbeCompletion(valid)).not.toThrow();
  expect(() => assertNativeProbeCompletion({ ...valid, callbackMatched: false })).toThrow("native_auth_probe.callback_mismatch.completion");
  expect(() => assertNativeProbeCompletion({ ...valid, nativeCallbackRequests: 1 })).toThrow("native_auth_probe.callback_network_attempt.completion");
  expect(() => assertNativeProbeCompletion({ ...valid, outcome: "pending" })).toThrow("native_auth_probe.completion_unconfirmed.completion");
});

test("closed failure evidence persists independently of reporter attachment storage", async () => {
  const allocation = await createProbeAllocation();
  const directory = path.join(allocation.root, "evidence");
  let attached = false;
  try {
    const evidence = [nativeProbeEvidence("completion", { outcome: "success", callbackMatched: false, nativeCallbackRequests: 1, callbackUrl: "synthetic-private-value" }), nativeProbeEvidence("cleanup", { cleanupVerified: true })];
    await saveNativeProbeEvidence({ outputDir: directory, outputPath: name => path.join(directory, name), async attach(_name, options) { attached = (await stat(options.path)).isFile(); } }, evidence);
    expect(attached).toBe(true);
    const stored = await readFile(path.join(directory, "native-auth-observations.json"), "utf8");
    expect(JSON.parse(stored)).toEqual(evidence);
    expect(stored).not.toContain("synthetic-private-value");
    expect(stored).not.toContain("callbackUrl");
  } finally {
    await removeProbeAllocation(allocation);
  }
});
