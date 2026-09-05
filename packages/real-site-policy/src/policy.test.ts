import assert from "node:assert/strict";
import { spawnSync } from "node:child_process";
import { mkdtempSync, rmSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import path from "node:path";
import test from "node:test";
import { fileURLToPath } from "node:url";
import { mandatoryDeniedActions, evaluateRealSitePolicy } from "./policy.js";

const NOW = new Date("2030-01-15T00:00:00.000Z");
const origin = `https://${"synthetic"}.${"test"}`;
const validPolicy = () => ({
  schemaVersion: "0.1", policyId: "approved-synthetic-probe", mode: "anonymous-read-only",
  network: { allowlist: [{ origin, pathPrefixes: ["/public/"] }], methods: ["GET", "HEAD"], blockUnlisted: true },
  account: { synthetic: false, secretRefs: [] },
  actions: { readOnly: true, allowed: ["navigate", "read", "scroll", "screenshot", "checkpoint"], denied: [...mandatoryDeniedActions] },
  rateLimits: { requestsPerMinute: 30, actionsPerMinute: 10, concurrentRequests: 1, maxRunMinutes: 5 },
  artifacts: { private: true, redactBeforeWrite: true, retentionDays: 7 },
  operationalReview: { robotsReviewed: true, termsReviewed: true, authorizationReference: "approval-record-123", reviewer: "reviewer-id", approvedAt: "2030-01-14T00:00:00.000Z", expiresAt: "2030-01-20T00:00:00.000Z" },
});

test("authorizes a fully reviewed bounded read-only policy", () => assert.equal(evaluateRealSitePolicy(validPolicy(), NOW).allowed, true));

test("refuses wildcard origins and paths", () => {
  const policy = validPolicy(); policy.network.allowlist = [{ origin: "https://*.invalid", pathPrefixes: ["/*"] }];
  const decision = evaluateRealSitePolicy(policy, NOW);
  assert.equal(decision.allowed, false); assert.ok(decision.issues.some(issue => issue.code === "origin")); assert.ok(decision.issues.some(issue => issue.code === "paths"));
});

test("refuses unsafe actions and incomplete deny lists", () => {
  const policy = { ...validPolicy(), actions: { readOnly: true, allowed: ["purchase"], denied: ["delete"] } };
  const decision = evaluateRealSitePolicy(policy, NOW);
  assert.equal(decision.allowed, false); assert.ok(decision.issues.some(issue => issue.code === "unsafe-action")); assert.ok(decision.issues.some(issue => issue.code === "denylist"));
});

test("refuses literal-looking secrets and requires synthetic account markers", () => {
  const policy = { ...validPolicy(), mode: "synthetic-account", account: { synthetic: true, secretRefs: ["literal-password"] } };
  const decision = evaluateRealSitePolicy(policy, NOW);
  assert.equal(decision.allowed, false); assert.ok(decision.issues.some(issue => issue.code === "secret-reference"));
});

test("refuses expired approval and missing operational acknowledgements", () => {
  const policy = validPolicy(); policy.operationalReview.expiresAt = "2030-01-14T00:00:00.000Z"; policy.operationalReview.termsReviewed = false as true;
  const decision = evaluateRealSitePolicy(policy, NOW);
  assert.equal(decision.allowed, false); assert.ok(decision.issues.some(issue => issue.code === "expired")); assert.ok(decision.issues.some(issue => issue.code === "terms-review"));
});

test("refuses public/unredacted artifacts and excessive rates", () => {
  const policy = validPolicy(); policy.artifacts.private = false as true; policy.rateLimits.requestsPerMinute = 1000;
  const decision = evaluateRealSitePolicy(policy, NOW);
  assert.equal(decision.allowed, false); assert.ok(decision.issues.some(issue => issue.code === "privacy")); assert.ok(decision.issues.some(issue => issue.code === "rate-limit"));
});

test("CLI exits with refusal status when any gate fails", () => {
  const directory = mkdtempSync(path.join(tmpdir(), "fluxiq-real-site-policy-"));
  try {
    const policy = validPolicy();
    policy.operationalReview.approvedAt = new Date(Date.now() - 86_400_000).toISOString();
    policy.operationalReview.expiresAt = new Date(Date.now() + 86_400_000).toISOString();
    policy.artifacts.redactBeforeWrite = false as true;
    const policyPath = path.join(directory, "policy.json");
    writeFileSync(policyPath, JSON.stringify(policy), "utf8");
    const cliPath = path.join(path.dirname(fileURLToPath(import.meta.url)), "cli.js");
    const result = spawnSync(process.execPath, [cliPath, policyPath], { encoding: "utf8" });
    assert.equal(result.status, 2);
    const decision = JSON.parse(result.stdout) as { allowed: boolean; recommendation: string };
    assert.deepEqual(decision, { ...decision, allowed: false, recommendation: "defer" });
  } finally {
    rmSync(directory, { recursive: true, force: true });
  }
});
