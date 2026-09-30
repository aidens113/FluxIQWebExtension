import assert from "node:assert/strict";
import { mkdirSync, mkdtempSync, rmSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import path from "node:path";
import test from "node:test";
import { flowLaneAdaptationMeasurements, RUN_ADAPTATION_SNAPSHOT, UNMEASURED_ADAPTATION } from "../snapshot.js";

function bundle(content?: string): string {
  const root = mkdtempSync(path.join(tmpdir(), "adaptation-snapshot-"));
  if (content !== undefined) {
    mkdirSync(path.join(root, "snapshots"), { recursive: true });
    writeFileSync(path.join(root, RUN_ADAPTATION_SNAPSHOT), content);
  }
  return root;
}

const reuse = { exercisedAdaptationIds: ["adaptation.a"], providerCalls: 0, interventions: 0, resume: null };

test("an absent snapshot is a run whose lane measured nothing, not a run with no adaptations", (t) => {
  const root = bundle(); t.after(() => rmSync(root, { recursive: true, force: true }));
  assert.deepEqual(flowLaneAdaptationMeasurements(root), UNMEASURED_ADAPTATION);
});

test("each member is kept only when it fits its contract; the rest read as unmeasured", (t) => {
  const root = bundle(JSON.stringify({ adaptationReuse: reuse, adaptationValidation: { adaptations: [{ adaptationId: "adaptation.a", tier: "established", trials: 0, replays: 0, lastFailure: null }] }, adaptationPersistence: { adaptations: [] }, adaptationCost: null }));
  t.after(() => rmSync(root, { recursive: true, force: true }));
  assert.deepEqual(flowLaneAdaptationMeasurements(root), { adaptationReuse: reuse, adaptationValidation: null, adaptationPersistence: { adaptations: [] }, adaptationCost: null });
});

test("a snapshot that is not JSON measures nothing rather than ending the evaluation", (t) => {
  const root = bundle("{not json"); t.after(() => rmSync(root, { recursive: true, force: true }));
  assert.deepEqual(flowLaneAdaptationMeasurements(root), UNMEASURED_ADAPTATION);
});
