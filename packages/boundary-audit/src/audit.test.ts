import assert from "node:assert/strict";
import test from "node:test";
import { auditPromotionBoundary, findForbiddenVocabulary } from "./audit.js";

const candidate = (content: string) => ({ name: "candidate", path: "packages/candidate", sources: [{ path: "src/index.ts", content }] });
const consumer = (id: string, repository: string) => ({ id, repository, evidencePaths: [`packages/${id}/package.json`] });

test("browser vocabulary and one consumer require deferral", () => {
  const report = auditPromotionBoundary({
    candidate: candidate("export type BrowserRun = { extensionUrl: string }"),
    consumers: [consumer("runner", "downstream")],
    auditedRepositories: ["downstream", "core"],
  });
  assert.equal(report.recommendation, "defer");
  assert.equal(report.gates.domainNeutralVocabulary.passed, false);
  assert.equal(report.gates.independentConsumers.found, 1);
});

test("neutral vocabulary still defers without a second consumer", () => {
  const report = auditPromotionBoundary({ candidate: candidate("export type Run = { id: string }"), consumers: [consumer("one", "a")], auditedRepositories: ["a", "b"] });
  assert.equal(report.recommendation, "defer");
  assert.equal(report.gates.domainNeutralVocabulary.passed, true);
});

test("only a neutral candidate with two independent consumers is eligible", () => {
  const report = auditPromotionBoundary({ candidate: candidate("export type Run = { id: string }"), consumers: [consumer("one", "a"), consumer("two", "b")], auditedRepositories: ["a", "b"] });
  assert.equal(report.recommendation, "promote-eligible");
  assert.equal(report.gates.independentConsumers.passed, true);
});

test("duplicate evidence does not masquerade as a second consumer", () => {
  const report = auditPromotionBoundary({ candidate: candidate("export const value = 1"), consumers: [consumer("one", "a"), consumer("one", "a")], auditedRepositories: ["a"] });
  assert.equal(report.gates.independentConsumers.found, 1);
  assert.equal(report.recommendation, "defer");
});

test("two infrastructure packages in one domain repository count as one consumer", () => {
  const report = auditPromotionBoundary({ candidate: candidate("export const value = 1"), consumers: [consumer("runner", "web-domain"), consumer("orchestrator", "web-domain")], auditedRepositories: ["web-domain", "core"] });
  assert.equal(report.gates.independentConsumers.found, 1);
  assert.equal(report.recommendation, "defer");
});

test("vocabulary matching is case-insensitive and line-addressable", () => {
  const findings = findForbiddenVocabulary([{ path: "x.ts", content: "type DOMState = {};\nconst PlaywrightDriver = 1;" }]);
  assert.deepEqual(findings.map(({ term, line }) => [term, line]), [["dom", 1], ["playwright", 2]]);
});
