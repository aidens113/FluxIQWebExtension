import assert from "node:assert/strict";
import test from "node:test";
import { effectiveEvidencePolicy } from "../effective-evidence-policy.js";

const manifestDefaults = { screenshots: "events", trace: "failure", video: "failure", sampleFps: 0, reviewRequired: false } as const;

test("without --evidence the manifest drives screenshots, and uncaptured trace and video are published as off", () => {
  const policy = effectiveEvidencePolicy(manifestDefaults);
  assert.equal(policy.source, "manifest");
  assert.equal(policy.failureScreenshot, true);
  assert.deepEqual(policy.capture, { screenshots: "events", trace: "off", video: "off", sampleFps: 0, maxScreenshots: 100, maxBytes: 25 * 1024 * 1024, reviewRequired: false });
  assert.deepEqual(policy.unsupported, ["trace", "video"]);
});

test("a manifest asking for no screenshots keeps no failure screenshot either", () => {
  const policy = effectiveEvidencePolicy({ screenshots: "none", trace: "off", video: "off", reviewRequired: true });
  assert.equal(policy.capture.screenshots, "none");
  assert.equal(policy.failureScreenshot, false);
  assert.equal(policy.capture.reviewRequired, true);
  assert.deepEqual(policy.unsupported, []);
});

test("no manifest policy captures nothing", () => {
  const policy = effectiveEvidencePolicy(undefined);
  assert.equal(policy.capture.screenshots, "none");
  assert.equal(policy.failureScreenshot, false);
});

test("--evidence overrides the manifest's screenshots and failure screenshot but keeps its review flag", () => {
  const cases = [["none", "none", false], ["failure", "none", true], ["checkpoints", "checkpoints", true], ["events", "events", true]] as const;
  for (const [mode, screenshots, failureScreenshot] of cases) {
    const policy = effectiveEvidencePolicy({ ...manifestDefaults, reviewRequired: true }, mode);
    assert.equal(policy.source, "--evidence", mode);
    assert.equal(policy.capture.screenshots, screenshots, mode);
    assert.equal(policy.failureScreenshot, failureScreenshot, mode);
    assert.equal(policy.capture.reviewRequired, true, mode);
    assert.deepEqual(policy.unsupported, [], mode);
  }
});
