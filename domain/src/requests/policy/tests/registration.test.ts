import assert from "node:assert/strict";
import test from "node:test";
import type { FluxIQ } from "fluxiq";
import { registerWebAutomationDomain } from "../../../host";
import { registerWebAutomationRuntime, registerWebAutomationRuntimeAdapter, createWebAutomationRuntimeAdapter } from "../../../runtime";
import { webAutomationRequestPolicies as policies } from "..";

test("immutable registration accepts canonical equal policy and refuses conflict", () => {
  const owner = {};
  const first = policies.register(owner, { enabled: true, allowedOrigins: ["https://z.invalid", "https://a.invalid"] });
  assert.equal(policies.register(owner), first);
  assert.equal(policies.register(owner, { enabled: true, allowedOrigins: ["https://a.invalid", "https://z.invalid"] }), first);
  assert.throws(() => policies.register(owner, { enabled: false }), /Conflicting/);
  assert.equal(policies.read(owner), first);
  assert.equal(policies.read({}), undefined);
});
test("all host registration entrypoints refuse conflict before framework mutation", () => {
  const owner = {} as FluxIQ;
  const first = policies.register(owner);
  const enabled = { enabled: true, allowedOrigins: ["https://a.invalid"] };
  assert.throws(() => registerWebAutomationDomain(owner, enabled), /Conflicting/);
  assert.throws(() => registerWebAutomationRuntime(owner, enabled), /Conflicting/);
  assert.throws(() => registerWebAutomationRuntimeAdapter(owner, enabled), /Conflicting/);
  assert.throws(() => createWebAutomationRuntimeAdapter({ fluxiq: owner, requestPolicy: enabled }), /Conflicting/);
  assert.equal(policies.read(owner), first);
});
test("enabled policy never adds a request or script executable capability", () => {
  const owner = {} as FluxIQ;
  const adapter = createWebAutomationRuntimeAdapter({ fluxiq: owner, requestPolicy: { enabled: true, allowedOrigins: ["https://a.invalid"] } });
  const capabilities = adapter.capabilities!();
  assert.ok(Array.isArray(capabilities));
  assert.ok(!JSON.stringify(capabilities).includes("web.request"));
  assert.ok(!JSON.stringify(capabilities).includes("web.script"));
  assert.equal(adapter.canExecute!({ commandId: "c", kind: "execute_action", outputId: "web.request" }), false);
  assert.equal(adapter.canExecute!({ commandId: "c", kind: "execute_action", outputId: "web.dom.click" }), true);
});


test("valid host registration keeps ordinary runtime binding and inherits immutable policy", () => {
  const adapters: unknown[] = [];
  const calls: string[] = [];
  const owner = {
    domains: { maybeGet: () => ({}) }, ioSnapshot: () => ({ inputs: [{}] }),
    runtime: { adaptersList: () => adapters, registerAdapter: (adapter: unknown) => { adapters.push(adapter); calls.push("adapter"); } },
    programs: { automationStudio: {
      listRecordingDomains: () => [{ domainId: "web-automation" }],
      bindRuntimeService: () => calls.push("runtime"), bindHostRuntime: () => calls.push("host"), bindLlmEvidenceRuntime: () => calls.push("evidence")
    } }
  } as unknown as FluxIQ;
  const input = { enabled: true, allowedOrigins: ["https://a.invalid"] };
  assert.equal(registerWebAutomationDomain(owner, input), owner);
  const original = policies.read(owner);
  input.allowedOrigins.push("https://later.invalid");
  assert.equal(registerWebAutomationDomain(owner), owner);
  assert.equal(policies.read(owner), original);
  assert.deepEqual(original?.allowedOrigins, ["https://a.invalid"]);
  assert.equal(adapters.length, 1);
  assert.deepEqual(calls, ["adapter", "runtime", "host", "evidence", "runtime", "host", "evidence"]);
  const before = calls.length;
  assert.throws(() => registerWebAutomationDomain(owner, { enabled: false }), /Conflicting/);
  assert.equal(calls.length, before);
});
