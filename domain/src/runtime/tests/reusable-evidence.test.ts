import assert from "node:assert/strict";
import test from "node:test";
import { produceWebReusableEvidence, WEB_REUSABLE_EVIDENCE_MAX_PROJECTION_BYTES } from "..";
import type { WebLlmPageEvidence } from "..";

const evidence = (overrides: Partial<WebLlmPageEvidence> = {}): WebLlmPageEvidence => ({
  schemaVersion: "web-llm-evidence.v1",
  trust: "untrusted-page-evidence",
  location: "https://example.test/form?token=private#secret",
  elements: [
    { target: "target.1", tag: "textarea", selector: '[data-testid="instruction-name-adapted"]', name: "Name", hasValue: true },
    { target: "target.2", tag: "select", selector: "#plan", name: "Plan", selectedValue: "enterprise", options: [{ value: "starter", label: "Starter" }, { value: "enterprise", label: "Private enterprise choice" }] },
    { target: "target.3", tag: "input", selector: "#password", inputType: "password", name: "Account password" },
    { target: "target.4", tag: "a", selector: "#next", name: "Next", href: "https://example.test/next?ticket=private" },
    { target: "target.5", tag: "a", selector: "#away", name: "Away", href: "https://outside.test/path?cross=private" },
  ],
  truncated: false,
  ...overrides,
});

test("produces deterministic versioned compatibility and a non-executable bounded projection", () => {
  const input = {
    evidence: evidence(),
    actions: [{ definitionId: "web.output.dom-type", status: "failed" as const, route: "failed" as const }],
    clientCapabilities: ["web.snapshots.v1", "web.actions.v1"],
  };
  const first = produceWebReusableEvidence(input);
  const reordered = produceWebReusableEvidence({
    ...input,
    evidence: evidence({ elements: [...input.evidence.elements].reverse(), title: "Irrelevant title noise" }),
    clientCapabilities: [...input.clientCapabilities].reverse(),
  });
  assert.deepEqual(first, reordered);
  assert.match(first.fingerprint.digest, /^[a-f0-9]{64}$/u);
  assert.equal(first.promptProjection.byteCount, Buffer.byteLength(JSON.stringify(first.promptProjection), "utf8"));
  assert.ok(first.promptProjection.byteCount <= WEB_REUSABLE_EVIDENCE_MAX_PROJECTION_BYTES);
  const serialized = JSON.stringify(first);
  assert.doesNotMatch(serialized, /private|enterprise|password|token|ticket|target\.1|instruction-name-adapted|#plan|#next/iu);
  assert.deepEqual(first.fingerprint.location, { origin: "https://example.test", path: "/form" });
  assert.ok(first.promptProjection.facts.some(fact => fact.kind === "element" && fact.tag === "textarea" && fact.name === "Name"));
  assert.equal(first.promptProjection.facts.filter(fact => fact.kind === "element" && fact.sameOriginLink).length, 1);
});

test("changes compatibility for relevant page, control, and capability revisions", () => {
  const baseline = produceWebReusableEvidence({ evidence: evidence(), clientCapabilities: ["web.actions.v1"] });
  const changedPath = produceWebReusableEvidence({ evidence: evidence({ location: "https://example.test/other" }), clientCapabilities: ["web.actions.v1"] });
  const changedControl = produceWebReusableEvidence({ evidence: evidence({ elements: [{ target: "noise", tag: "textarea", selector: "#renamed", name: "Name" }] }), clientCapabilities: ["web.actions.v1"] });
  const changedCapability = produceWebReusableEvidence({ evidence: evidence(), clientCapabilities: ["web.actions.v2"] });
  for (const candidate of [changedPath, changedControl, changedCapability]) assert.notEqual(candidate.fingerprint.digest, baseline.fingerprint.digest);
});

test("keeps opposite run outcomes compatible while preserving them in prompt content", () => {
  const common = { evidence: evidence(), clientCapabilities: ["web.actions.v1"] };
  const succeeded = produceWebReusableEvidence({ ...common, actions: [{ definitionId: "web.output.dom-type", status: "succeeded", route: "success" }] });
  const failed = produceWebReusableEvidence({ ...common, actions: [{ definitionId: "web.output.dom-type", status: "failed", route: "failed" }] });
  assert.deepEqual(succeeded.fingerprint, failed.fingerprint);
  assert.notEqual(succeeded.promptProjection.digest, failed.promptProjection.digest);
  assert.notDeepEqual(succeeded.promptProjection.facts, failed.promptProjection.facts);
  assert.ok(succeeded.promptProjection.facts.some(fact => fact.kind === "action" && fact.status === "succeeded"));
  assert.ok(failed.promptProjection.facts.some(fact => fact.kind === "action" && fact.status === "failed"));
});

test("enforces exact item and byte bounds by deterministic trimming", () => {
  const many = Array.from({ length: 40 }, (_, index) => ({ target: `target.${index + 1}`, tag: "button", selector: `[data-id="${index}"]`, name: `Action ${index} ${"x".repeat(100)}` }));
  const first = produceWebReusableEvidence({ evidence: evidence({ elements: many }) }, { maxProjectionItems: 7, maxProjectionBytes: 900 });
  const second = produceWebReusableEvidence({ evidence: evidence({ elements: [...many].reverse() }) }, { maxProjectionItems: 7, maxProjectionBytes: 900 });
  assert.deepEqual(first, second);
  assert.equal(first.promptProjection.truncated, true);
  assert.ok(first.promptProjection.facts.length <= 7);
  assert.ok(first.promptProjection.byteCount <= 900);
  assert.equal(first.promptProjection.byteCount, Buffer.byteLength(JSON.stringify(first.promptProjection), "utf8"));
  assert.throws(() => produceWebReusableEvidence({ evidence: evidence() }, { maxProjectionBytes: 10 }), /envelope exceeds/u);
  assert.throws(() => produceWebReusableEvidence({ evidence: evidence() }, { maxProjectionBytes: WEB_REUSABLE_EVIDENCE_MAX_PROJECTION_BYTES + 1 }), /between 1 and/u);
  assert.throws(() => produceWebReusableEvidence({ evidence: evidence({ elements: [...many, many[0]!] }) }), /element count exceeds 40/u);
  assert.throws(() => produceWebReusableEvidence({ evidence: evidence(), actions: Array.from({ length: 21 }, () => ({ definitionId: "web.output.dom-click", status: "failed" as const })) }), /action count exceeds 20/u);
  assert.throws(() => produceWebReusableEvidence({ evidence: evidence(), clientCapabilities: Array.from({ length: 21 }, (_, index) => `web.capability.${index}`) }), /capability count exceeds 20/u);
});

test("rejects credentialed and non-http locations", () => {
  assert.throws(() => produceWebReusableEvidence({ evidence: evidence({ location: "https://user:secret@example.test/form" }) }), /without credentials/u);
  assert.throws(() => produceWebReusableEvidence({ evidence: evidence({ location: "file:///private/form" }) }), /HTTP\(S\)/u);
  assert.throws(() => produceWebReusableEvidence({ evidence: evidence({ schemaVersion: "web-llm-evidence.v0" as never }) }), /current sanitized evidence schema/u);
});
