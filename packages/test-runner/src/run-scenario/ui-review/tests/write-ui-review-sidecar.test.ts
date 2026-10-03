import assert from "node:assert/strict";
import { mkdtemp, readFile, rm } from "node:fs/promises";
import os from "node:os";
import path from "node:path";
import test from "node:test";
import { countOverlayChanges, uiReviewPaths, writeUiReviewSidecar, type UiReviewMoment } from "../index.js";

const moment = (text: string): UiReviewMoment => ({
  index: 1, label: "start", phase: "start", at: "2026-09-29T00:00:00.000Z", atMs: 5,
  scenario: { source: "scenario-tab", file: "run-x.ui-review.local/01-start-scenario.png", location: "http://127.0.0.1:1/start" },
  panel: { source: "side-panel", file: "run-x.ui-review.local/01-start-panel.png", masked: 1 },
  overlay: { startedAt: "2026-09-29T00:00:00.000Z", intervalMs: 200, durationMs: 0, samples: [{ atMs: 0, present: true, hostCount: 1, visible: true, text }], counts: countOverlayChanges([{ atMs: 0, present: true, hostCount: 1, visible: true, text }]) },
});

test("the review is written beside the bundle, never in it, with a summary of every moment's overlay", async () => {
  const root = await mkdtemp(path.join(os.tmpdir(), "t174-w9-review-"));
  try {
    const paths = uiReviewPaths(root, "run-x");
    assert.equal(paths.json, path.join(root, "run-x.ui-review.local.json"));
    assert.equal(paths.directory, path.join(root, "run-x.ui-review.local"));
    const written = await writeUiReviewSidecar({ runsDirectory: root, runId: "run-x", secrets: [], startedAt: "2026-09-29T00:00:00.000Z", attached: true, moments: [moment("Building")], skipped: [], skippedTicks: 0, failures: [] });
    assert.equal(written, paths.json);
    const body = JSON.parse(await readFile(written, "utf8"));
    assert.equal(body.published, false);
    assert.equal(body.directory, "run-x.ui-review.local");
    assert.equal(body.summary.moments, 1);
    assert.deepEqual(body.summary.panelSources, ["side-panel"]);
    assert.equal(body.summary.overlay[0].status, "stable");
    assert.equal(body.summary.overlay[0].pageLoads, 0);
    assert.equal(body.summary.overlay[0].pageLoadGaps, 0, "the excused gaps are summarised beside every page load");
  } finally { await rm(root, { recursive: true, force: true }); }
});

test("a review holding a run secret is withheld whole", async () => {
  const root = await mkdtemp(path.join(os.tmpdir(), "t174-w9-review-"));
  try {
    const written = await writeUiReviewSidecar({ runsDirectory: root, runId: "run-x", secrets: ["hunter2-secret"], startedAt: "2026-09-29T00:00:00.000Z", attached: true, moments: [moment("typed hunter2-secret")], skipped: [], skippedTicks: 0, failures: [] });
    const body = await readFile(written, "utf8");
    assert.ok(!body.includes("hunter2-secret"));
    assert.equal(JSON.parse(body).withheld, "redaction_failed");
  } finally { await rm(root, { recursive: true, force: true }); }
});
