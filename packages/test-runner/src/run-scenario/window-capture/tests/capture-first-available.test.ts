import assert from "node:assert/strict";
import test from "node:test";
import type { BrowserContext } from "@playwright/test";
import { captureFirstAvailable, type CaptureSource } from "../capture-first-available.js";
import { createRunScreenshotAdapter } from "../run-screenshot-adapter.js";

const JPEG = new Uint8Array([0xff, 0xd8, 0xff, 0xd9]);
const correlation = { runId: "run-a", scenarioId: "bigbox-retail", correlationId: "c-1" };

function source(name: string, calls: string[], outcome: "picture" | "fail" | "hang" | "empty", timeoutMs?: number): CaptureSource {
  return {
    name,
    ...(timeoutMs === undefined ? {} : { timeoutMs }),
    capture: async () => {
      calls.push(name);
      if (outcome === "picture") return JPEG;
      if (outcome === "empty") return new Uint8Array();
      if (outcome === "fail") throw new Error(`${name} refused`);
      return new Promise<Uint8Array>(() => undefined);
    },
  };
}

test("the native window is tried first and, when it answers, the fallback is never started", async () => {
  const calls: string[] = [];
  const attempt = await captureFirstAvailable([source("native", calls, "picture"), source("front-tab", calls, "picture")], 4_000);
  assert.deepEqual(calls, ["native"]);
  assert.equal(attempt.source, "native");
  assert.deepEqual(attempt.failures, []);
});

test("a native failure falls back to the front tab, and the reason is kept", async () => {
  const calls: string[] = [];
  const attempt = await captureFirstAvailable([source("native", calls, "fail"), source("front-tab", calls, "picture")], 4_000);
  assert.deepEqual(calls, ["native", "front-tab"]);
  assert.equal(attempt.source, "front-tab");
  assert.deepEqual(attempt.failures, [{ source: "native", reason: "native refused" }]);
});

test("a hanging source is cut at its own cap, and the whole attempt stays inside one deadline", async () => {
  const calls: string[] = [];
  const started = Date.now();
  const attempt = await captureFirstAvailable([source("native", calls, "hang", 60), source("front-tab", calls, "hang"), source("never", calls, "picture")], 150);
  const elapsed = Date.now() - started;
  assert.equal(attempt.bytes, undefined);
  assert.ok(elapsed < 600, `took ${elapsed} ms`);
  assert.deepEqual(calls, ["native", "front-tab"]);
  assert.match(attempt.failures[0]!.reason, /native took longer than 60 ms/u);
  assert.match(attempt.failures[1]!.reason, /front-tab took longer than/u);
  assert.deepEqual(attempt.failures[2], { source: "never", reason: "no time was left in the capture deadline" });
});

test("an empty image is not a picture, and the next source is tried", async () => {
  const calls: string[] = [];
  const attempt = await captureFirstAvailable([source("native", calls, "empty"), source("front-tab", calls, "picture")], 4_000);
  assert.equal(attempt.source, "front-tab");
  assert.deepEqual(attempt.failures, [{ source: "native", reason: "returned an empty image" }]);
});

test("the adapter answers a verified JPEG, skips scripted steps, answers nothing before the browser exists, and logs each reason once", async () => {
  const calls: string[] = [];
  const logged: string[] = [];
  let session: { context: BrowserContext; profileDir: string; scenarioOrigin: string } | undefined;
  const adapter = createRunScreenshotAdapter({ session: () => session, log: line => logged.push(line), sources: () => [source("native", calls, "fail"), source("front-tab", calls, "picture")] });
  assert.equal(await adapter.capture({ trigger: "runtime.dispatch", summary: "before launch", correlation }), undefined);
  session = { context: {} as BrowserContext, profileDir: "C:\\runs\\a\\browser-profile", scenarioOrigin: "http://127.0.0.1:1" };
  assert.equal(await adapter.capture({ trigger: "step.start", summary: "a step", correlation }), undefined);
  assert.deepEqual(calls, []);
  const first = await adapter.capture({ trigger: "runtime.settle", summary: "settled", correlation });
  const second = await adapter.capture({ trigger: "checkpoint", summary: "periodic", correlation });
  assert.deepEqual(first, { bytes: JPEG, mediaType: "image/jpeg", redactionVerified: true });
  assert.deepEqual(second, first);
  assert.deepEqual(logged, ["[lab screenshots] native: native refused"]);
});

test("once the browser context closes, the adapter attempts no picture at all", async () => {
  const calls: string[] = [];
  let close: () => void = () => undefined;
  const context = { once: (event: string, listener: () => void) => { if (event === "close") close = listener; } } as unknown as BrowserContext;
  const adapter = createRunScreenshotAdapter({ session: () => ({ context, profileDir: "C:\runs\a\browser-profile", scenarioOrigin: "http://127.0.0.1:1" }), sources: () => [source("native", calls, "picture")] });
  assert.ok(await adapter.capture({ trigger: "runtime.settle", summary: "open", correlation }));
  close();
  assert.equal(await adapter.capture({ trigger: "error", summary: "cleanup failed", correlation }), undefined);
  assert.deepEqual(calls, ["native"]);
});
