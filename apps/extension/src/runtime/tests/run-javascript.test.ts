import assert from "node:assert/strict";
import test from "node:test";
import {
  WEB_AUTOMATION_FAILURE_CODES,
  WEB_AUTOMATION_JAVASCRIPT_INPUT_MAX_BYTES,
  WEB_AUTOMATION_JAVASCRIPT_OUTPUT_MAX_BYTES,
  WEB_AUTOMATION_JAVASCRIPT_SOURCE_MAX_BYTES
} from "@fluxiq-web-extension/domain/client";
import type { BrowserActionCommand } from "../../shared/protocol";
import { runBrowserJavaScriptAction } from "../run-javascript";

const action = (overrides: Partial<BrowserActionCommand> = {}): BrowserActionCommand => ({
  commandId: "javascript.test",
  actionType: "web.dom.run_javascript",
  source: "return { ok: inputs.ok };",
  inputs: { ok: true },
  timeoutMs: 100,
  ...overrides
});

async function withUserScripts<T>(api: object, run: () => Promise<T>): Promise<T> {
  (globalThis as { chrome?: unknown }).chrome = { userScripts: api };
  try {
    return await run();
  } finally {
    delete (globalThis as { chrome?: unknown }).chrome;
  }
}

type Injection = { js: Array<{ code: string }>; target: { frameIds: number[] } };

async function evaluateInjection(injection: Injection): Promise<Array<{ frameId: number; result: unknown }>> {
  const result = await (0, eval)(injection.js[0]!.code) as unknown;
  return [{ frameId: injection.target.frameIds[0]!, result }];
}

test("probes user-script availability without a filter and returns the bounded JSON value", async () => {
  let probeArguments = -1;
  const result = await withUserScripts({
    getScripts: (...args: unknown[]) => { probeArguments = args.length; return Promise.resolve([]); },
    execute: () => Promise.resolve([{ frameId: 3, result: { tag: "fluxiq-user-script-v1", kind: "value", json: "{\"ok\":true}" } }])
  }, () => runBrowserJavaScriptAction(action(), 7, 3));

  assert.equal(probeArguments, 0);
  assert.equal(result.status, "succeeded");
  assert.deepEqual(result.extracted, { ok: true });
});

test("serializes and enforces the exact output limit inside USER_SCRIPT before transport", async () => {
  const api = { getScripts: () => Promise.resolve([]), execute: evaluateInjection };
  const exact = await withUserScripts(api, () => runBrowserJavaScriptAction(action({
    source: `return "x".repeat(${WEB_AUTOMATION_JAVASCRIPT_OUTPUT_MAX_BYTES - 2});`
  }), 7, 3));
  const over = await withUserScripts(api, () => runBrowserJavaScriptAction(action({
    source: `return "x".repeat(${WEB_AUTOMATION_JAVASCRIPT_OUTPUT_MAX_BYTES - 1});`
  }), 7, 3));

  assert.equal(exact.status, "succeeded");
  assert.equal(typeof exact.extracted === "string" ? exact.extracted.length : -1, WEB_AUTOMATION_JAVASCRIPT_OUTPUT_MAX_BYTES - 2);
  assert.equal(over.status, "failed");
  assert.match(over.message ?? "", /larger than/u);
});

test("a very large page result crosses the browser boundary only as a small tagged refusal", async () => {
  let transported: unknown;
  const result = await withUserScripts({
    getScripts: () => Promise.resolve([]),
    execute: async (injection: Injection) => {
      const [answer] = await evaluateInjection(injection);
      transported = answer?.result;
      return answer ? [answer] : [];
    }
  }, () => runBrowserJavaScriptAction(action({
    source: `return "x".repeat(${WEB_AUTOMATION_JAVASCRIPT_OUTPUT_MAX_BYTES * 16});`
  }), 7, 3));

  assert.equal(result.status, "failed");
  assert.deepEqual(transported, { tag: "fluxiq-user-script-v1", kind: "too_large" });
  assert.ok(JSON.stringify(transported).length < 100);
});

test("captures serialization, encoding, promise, and timer primordials before reviewed source can replace them", async () => {
  const originalStringify = JSON.stringify;
  const originalEncode = TextEncoder.prototype.encode;
  const originalRace = Promise.race;
  const originalSetTimeout = globalThis.setTimeout;
  let transported: unknown;
  try {
    const result = await withUserScripts({
      getScripts: () => Promise.resolve([]),
      execute: async (injection: Injection) => {
        const [answer] = await evaluateInjection(injection);
        transported = answer?.result;
        return answer ? [answer] : [];
      }
    }, () => runBrowserJavaScriptAction(action({
      source: `JSON.stringify=()=>"{}";TextEncoder.prototype.encode=()=>new Uint8Array();Promise.race=async()=>({tag:"fluxiq-user-script-v1",kind:"value",json:"null"});globalThis.setTimeout=()=>0;return "x".repeat(${WEB_AUTOMATION_JAVASCRIPT_OUTPUT_MAX_BYTES * 2});`
    }), 7, 3));

    assert.equal(result.status, "failed");
    assert.deepEqual(transported, { tag: "fluxiq-user-script-v1", kind: "too_large" });
  } finally {
    JSON.stringify = originalStringify;
    TextEncoder.prototype.encode = originalEncode;
    Promise.race = originalRace;
    globalThis.setTimeout = originalSetTimeout;
  }
});

test("treats a returned tag-shaped object as data rather than an outer envelope", async () => {
  const result = await withUserScripts({ getScripts: () => Promise.resolve([]), execute: evaluateInjection }, () =>
    runBrowserJavaScriptAction(action({
      source: `return {tag:"fluxiq-user-script-v1",kind:"failed",json:"spoof"};`
    }), 7, 3));

  assert.equal(result.status, "succeeded");
  assert.deepEqual(result.extracted, { tag: "fluxiq-user-script-v1", kind: "failed", json: "spoof" });
});

test("non-JSON and thrown results fail closed without returning raw errors", async () => {
  const api = { getScripts: () => Promise.resolve([]), execute: evaluateInjection };
  const nonJson = await withUserScripts(api, () => runBrowserJavaScriptAction(action({ source: "return undefined;" }), 7, 3));
  const thrown = await withUserScripts(api, () => runBrowserJavaScriptAction(action({ source: "throw new Error('private failure detail');" }), 7, 3));

  assert.equal(nonJson.status, "failed");
  assert.match(nonJson.message ?? "", /JSON value/u);
  assert.equal(thrown.status, "failed");
  assert.doesNotMatch(thrown.message ?? "", /private failure detail/u);
});

test("both the injected and outer deadlines return the typed timeout", async () => {
  const injected = await withUserScripts({
    getScripts: () => Promise.resolve([]),
    execute: evaluateInjection
  }, () => runBrowserJavaScriptAction(action({ source: "return await new Promise(() => undefined);", timeoutMs: 5 }), 7, 3));
  const outer = await withUserScripts({
    getScripts: () => Promise.resolve([]),
    execute: () => new Promise(() => undefined)
  }, () => runBrowserJavaScriptAction(action({ timeoutMs: 1 }), 7, 3));

  for (const result of [injected, outer]) {
    assert.equal(result.status, "timed_out");
    assert.equal(result.failure?.code, WEB_AUTOMATION_FAILURE_CODES.TIMEOUT);
  }
});

test("a timeout stops waiting but does not cancel later asynchronous page work", async () => {
  const marker = "__fluxiqLateUserScriptEffect";
  delete (globalThis as Record<string, unknown>)[marker];
  try {
    const result = await withUserScripts({ getScripts: () => Promise.resolve([]), execute: evaluateInjection }, () =>
      runBrowserJavaScriptAction(action({
        source: `await new Promise(resolve=>setTimeout(resolve,20));globalThis.${marker}="completed";return null;`,
        timeoutMs: 1
      }), 7, 3));
    assert.equal(result.status, "timed_out");
    await new Promise((resolve) => setTimeout(resolve, 40));
    assert.equal((globalThis as Record<string, unknown>)[marker], "completed");
  } finally {
    delete (globalThis as Record<string, unknown>)[marker];
  }
});

test("the privileged executor refuses oversized source and inputs before browser execution", async () => {
  let executeCalls = 0;
  const api = {
    getScripts: () => Promise.resolve([]),
    execute: () => { executeCalls += 1; return Promise.resolve([]); }
  };
  const source = await withUserScripts(api, () => runBrowserJavaScriptAction(action({ source: "x".repeat(WEB_AUTOMATION_JAVASCRIPT_SOURCE_MAX_BYTES + 1) }), 7, 3));
  const inputs = await withUserScripts(api, () => runBrowserJavaScriptAction(action({ inputs: { value: "x".repeat(WEB_AUTOMATION_JAVASCRIPT_INPUT_MAX_BYTES) } }), 7, 3));

  assert.equal(source.status, "failed");
  assert.equal(inputs.status, "failed");
  assert.equal(executeCalls, 0);
});

test("the privileged executor refuses non-object inputs before browser execution", async () => {
  let executeCalls = 0;
  const api = {
    getScripts: () => Promise.resolve([]),
    execute: () => { executeCalls += 1; return Promise.resolve([]); }
  };
  for (const inputs of [null, [], "value"]) {
    const result = await withUserScripts(api, () => runBrowserJavaScriptAction(action({ inputs: inputs as never }), 7, 3));
    assert.equal(result.status, "failed");
  }
  assert.equal(executeCalls, 0);
});

test("missing or ungranted user-script support fails closed", async () => {
  const absent = await withUserScripts({}, () => runBrowserJavaScriptAction(action(), 7, 3));
  const ungranted = await withUserScripts({
    getScripts: () => Promise.reject(new Error("permission withheld")),
    execute: () => Promise.resolve([])
  }, () => runBrowserJavaScriptAction(action(), 7, 3));

  assert.equal(absent.status, "failed");
  assert.equal(ungranted.status, "failed");
  assert.match(ungranted.message ?? "", /Enable Allow User Scripts/u);
});
