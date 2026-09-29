// The run, detail and export replies, read defensively.

import assert from "node:assert/strict";
import test from "node:test";
import { readRunReplies } from "../replies";

const summary = { runId: "r1", flowId: "f1", status: "succeeded", startedAt: "2026-09-01T00:00:00.000Z", finishedAt: "2026-09-01T00:00:14.200Z", updatedAt: "2026-09-01T00:00:14.200Z", interventionCount: 1, adaptationCount: 1 };

test("runAutomation: summary, created adaptations and durable change", () => {
  const reply = readRunReplies.run({ ok: true, payload: { runSummary: summary, interventionCount: 1, createdAdaptationIds: ["a1", 5], durableBehaviorChanged: true } });
  assert.equal(reply?.run.runId, "r1");
  assert.equal((reply?.run.finishedAt ?? 0) - (reply?.run.startedAt ?? 0), 14_200, "ISO times are read");
  assert.deepEqual(reply?.createdAdaptationIds, ["a1"]);
  assert.equal(reply?.durableBehaviorChanged, true);
  assert.equal(readRunReplies.run({ ok: true, payload: { runSummary: summary, durableBehaviorChanged: "yes" } })?.durableBehaviorChanged, undefined);
  assert.equal(readRunReplies.run({ ok: true, payload: {} }), undefined);
  assert.equal(readRunReplies.run(undefined), undefined);
});

test("runDetail: datasets, adaptation ids and statuses", () => {
  const detail = readRunReplies.detail({ ok: true, payload: {
    runDetail: { summary, adaptationIds: ["a1"], datasets: [{ datasetId: "d1", label: "Orders", recordCount: 12 }, { label: "no id" }, { datasetId: "d2" }] },
    adaptations: [{ adaptationId: "a1", status: "applied" }, { adaptationId: "a2" }, null]
  } });
  assert.deepEqual(detail?.datasets, [{ datasetId: "d1", label: "Orders", recordCount: 12 }, { datasetId: "d2", label: undefined, recordCount: undefined }]);
  assert.deepEqual(detail?.adaptationIds, ["a1"]);
  assert.deepEqual([...(detail?.adaptationStatuses ?? [])], [["a1", "applied"]]);
  assert.equal(detail?.run?.runId, "r1");
  assert.deepEqual(readRunReplies.detail({ ok: true, payload: { runDetail: {} } })?.datasets, [], "no datasets is an empty list");
  assert.equal(readRunReplies.detail({ ok: true, payload: {} }), undefined);
});

test("exportDataset: inline, too large, and junk", () => {
  assert.deepEqual(
    readRunReplies.export({ ok: true, payload: { export: { tooLarge: false, fileName: "orders.csv", contentType: "text/csv", body: "a,b\n", rowCount: 1 } } }),
    { tooLarge: false, fileName: "orders.csv", contentType: "text/csv", body: "a,b\n" }
  );
  assert.deepEqual(readRunReplies.export({ ok: true, payload: { export: { tooLarge: true, rowCount: 90000, downloadPath: "/x" } } }), { tooLarge: true });
  assert.equal(readRunReplies.export({ ok: true, payload: { export: { fileName: "x", contentType: "text/csv", body: "" } } }), undefined, "tooLarge must be said");
  assert.equal(readRunReplies.export({ ok: true, payload: { export: { tooLarge: false, fileName: "x", contentType: "text/csv" } } }), undefined);
  assert.equal(readRunReplies.export({ ok: true }), undefined);
});
