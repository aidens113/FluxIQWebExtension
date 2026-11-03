import assert from "node:assert/strict";
import { test } from "node:test";
import { normalizeWebElementTarget, normalizeWebRecordingCandidateParameters } from "../index";

test("the web normalizer preserves action arguments and gives explicit element signals precedence", () => {
  const parameters = { text: "typed argument", selector: "#original", element: { text: "Control label", selector: "#nested", entityId: "item.7" } };
  const actual = normalizeWebRecordingCandidateParameters("web", parameters, { outputId: "web.dom.type_text", sourceEntryId: "entry.actual", source: "mapper" });
  assert.deepEqual(actual, { ...parameters, target: { kind: "element", fingerprint: { visibleText: "Control label", entityId: "item.7", selector: "#original" }, source: "mapper" } });
  assert.equal(parameters.text, "typed argument");
  assert.equal(parameters.element.selector, "#nested");
});

test("target metadata withholds sensitive names and promotes stable identity fields", () => {
  const actual = normalizeWebElementTarget({ metadata: { ariaLabel: " Action ", entityId: "entity.3", secretToken: "fake-value", extra: { password: "fake-password", kept: true } }, attributes: { role: "button", authorization: "fake-auth" } }, { source: "mapper" });
  assert.deepEqual(actual, { kind: "element", fingerprint: { accessibleName: "Action", entityId: "entity.3", attributes: { role: "button" }, metadata: { extra: { kept: true } } }, source: "mapper" });
});

test("missing identity keeps opaque parameters with the original shallow-copy behavior", () => {
  const nested = { kept: 1 }, parameters = { custom: nested };
  const actual = normalizeWebRecordingCandidateParameters("web", parameters, { outputId: "web.dom.click", sourceEntryId: "entry.actual", source: "mapper" });
  assert.deepEqual(actual, parameters);
  assert.notEqual(actual, parameters);
  assert.equal(actual.custom, nested);
  assert.equal(normalizeWebElementTarget({}), null);
});

test("a persisted target retains candidate, selection and drawing identity while adopting mapper provenance", () => {
  const actual = normalizeWebElementTarget({ kind: "element", fingerprint: { selector: " #saved ", drawing: "glyph:12" }, candidates: [{ candidateId: "candidate.1", id: " control ", visualFrameId: "frame.1" }], selectedCandidate: { candidateId: "candidate.1", confidence: 0.75, matchedSignals: ["selector"], failedSignals: [] }, source: "recording" }, { source: "mapper" });
  assert.deepEqual(actual, { kind: "element", fingerprint: { selector: "#saved", drawing: "glyph:12" }, candidates: [{ id: "control", candidateId: "candidate.1", visualFrameId: "frame.1" }], selectedCandidate: { candidateId: "candidate.1", confidence: 0.75, matchedSignals: ["selector"] }, source: "mapper" });
});
