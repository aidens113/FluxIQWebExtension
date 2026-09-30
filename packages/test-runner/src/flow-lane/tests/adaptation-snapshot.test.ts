// The lane's half of the Week 2 adaptation metrics: the measurement taken while
// Core still holds the run, written to the bundle, or nothing written at all.

import assert from "node:assert/strict";
import test from "node:test";
import { writeFlowLaneAdaptationSnapshot } from "../adaptation-snapshot.js";

function bundle() {
  const written: Array<[string, unknown]> = [];
  return { written, writeStructured: async (bundlePath: string, value: unknown) => { written.push([bundlePath, value]); } };
}

test("a measured run's adaptations are written where the evaluation reads them", async () => {
  const target = bundle();
  const measured = { adaptationReuse: { providerCalls: 0 }, adaptationValidation: null, adaptationPersistence: null, adaptationCost: null };
  assert.equal(await writeFlowLaneAdaptationSnapshot({ bundle: target, path: "snapshots/adaptation.json", measure: async () => measured }), true);
  assert.deepEqual(target.written, [["snapshots/adaptation.json", measured]]);
});

test("a read that fails writes nothing, so the run reads as unmeasured rather than as a partial measurement", async () => {
  const target = bundle();
  assert.equal(await writeFlowLaneAdaptationSnapshot({ bundle: target, path: "snapshots/adaptation.json", measure: async () => { throw new Error("Core's run detail did not describe the requested run"); } }), false);
  assert.deepEqual(target.written, []);
});

test("a bundle that refuses the write is the facility failing, and says so", async () => {
  await assert.rejects(writeFlowLaneAdaptationSnapshot({ bundle: { writeStructured: async () => { throw new Error("disk full"); } }, path: "snapshots/adaptation.json", measure: async () => ({}) }), /disk full/u);
});
