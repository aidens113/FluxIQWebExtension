import assert from "node:assert/strict";
import test from "node:test";
import type { Page } from "@playwright/test";
import { revokeAndProbeCredential } from "../revoke-probe.js";

test("revocation tests the saved proof with no cookie and returns status-only evidence", async (t) => {
  const previousChrome = Object.getOwnPropertyDescriptor(globalThis, "chrome");
  const previousFetch = globalThis.fetch;
  const messages: unknown[] = [];
  Object.defineProperty(globalThis, "chrome", { configurable: true, value: {
    storage: { local: { get: async () => ({ state: { clientId: "fixture-client", token: "fixture-private-credential" } }) } },
    runtime: { sendMessage: async (message: unknown) => {
      messages.push(message);
      return { ok: true, forgetReachedCore: true };
    } }
  } });
  globalThis.fetch = async (url, init) => {
    assert.equal(url, "http://127.0.0.1:9999/api/programs/automation-studio/append-turn");
    assert.equal(new Headers(init?.headers).get("authorization"), "Bearer fixture-private-credential");
    assert.equal(init?.credentials, "omit");
    assert.equal(init?.body, JSON.stringify({ projectId: "fixture-project" }));
    return new Response("private-server-body", { status: 401 });
  };
  t.after(() => {
    globalThis.fetch = previousFetch;
    if (previousChrome) Object.defineProperty(globalThis, "chrome", previousChrome);
    else Reflect.deleteProperty(globalThis, "chrome");
  });
  const control = { evaluate: async (fn: (input: unknown) => unknown, input: unknown) => fn(input) } as unknown as Page;
  const evidence = await revokeAndProbeCredential(control, "http://127.0.0.1:9999", { projectId: "fixture-project" });
  assert.deepEqual(evidence, { forgotten: true, status: 401 });
  assert.deepEqual(messages, [{ type: "fluxiq.resetSession" }]);
  assert.doesNotMatch(JSON.stringify(evidence), /private/u);
});
