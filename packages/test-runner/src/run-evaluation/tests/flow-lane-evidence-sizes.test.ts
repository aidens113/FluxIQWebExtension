import assert from "node:assert/strict";
import { mkdirSync, mkdtempSync, rmSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import path from "node:path";
import test, { type TestContext } from "node:test";
import { flowLaneEvidenceSizes, type FlowLaneEvidence } from "../flow-lane-evidence-sizes.js";

// The one reader both Flow-lane producers share: the bench's `evaluateFlowRun`
// and a single `lab run`'s `singleRunEvaluation`. These rows replace the ones
// that evaluated a bundle through both copies and required them to agree.

/** A bundle directory with an empty `snapshots/` inside it. */
function bundleDirectory(t: TestContext): string {
  const directory = mkdtempSync(path.join(tmpdir(), "fluxiq-flow-lane-evidence-"));
  t.after(() => rmSync(directory, { recursive: true, force: true }));
  mkdirSync(path.join(directory, "snapshots"));
  return directory;
}
/** A bundle directory holding only `snapshots/flow-lane.json`: `snapshot` as `flowLaneSnapshot` writes it, or raw text. */
function bundleWith(t: TestContext, snapshot: unknown): string {
  const directory = bundleDirectory(t);
  writeFileSync(path.join(directory, "snapshots", "flow-lane.json"), typeof snapshot === "string" ? snapshot : `${JSON.stringify(snapshot, null, 2)}\n`);
  return directory;
}
const NO_EVIDENCE: FlowLaneEvidence = { sanitizedPacketBytes: [], rawSnapshotBytes: [], packetComposition: [], truncationCount: 0, packets: [] };

test("every measured packet's bytes, in action order and then capture order, and a count of the trimmed ones", (t) => {
  const snapshot = {
    flowId: "flow.basic", runtimeRunId: "core-run.1", status: "succeeded", harnessActivations: 0, failure: null, extractionCount: 0,
    actions: [
      { actionType: "web.dom.type", status: "succeeded", evidencePackets: [{ point: "beforeAction", bytes: 2_048, truncated: false }, { point: "afterAction", bytes: 1_024, truncated: true }] },
      // An action Core captured nothing around contributes nothing.
      { actionType: "web.browser.wait", status: "succeeded" },
      // A zero-byte packet is still a measured packet.
      { actionType: "web.dom.click", status: "succeeded", evidencePackets: [{ point: "beforeAction", bytes: 0, truncated: false }, { point: "afterAction", bytes: 4_096, truncated: true }] },
    ],
  };
  assert.deepEqual(flowLaneEvidenceSizes(bundleWith(t, snapshot)), {
    sanitizedPacketBytes: [2_048, 1_024, 0, 4_096], rawSnapshotBytes: [], packetComposition: [null, null, null, null], truncationCount: 2,
    packets: [
      { actionPosition: 1, point: "beforeAction", bytes: 2_048, truncated: false, composition: null }, { actionPosition: 1, point: "afterAction", bytes: 1_024, truncated: true, composition: null },
      { actionPosition: 3, point: "beforeAction", bytes: 0, truncated: false, composition: null }, { actionPosition: 3, point: "afterAction", bytes: 4_096, truncated: true, composition: null },
    ],
  });
});

// The question `run-muexhp0k-73172f73` could not be asked of a finished run:
// how many of the page's narrowing controls -- band 1 -- did the packet the
// model read actually describe, and how many did it leave behind.
test("a packet's composition travels beside its size, one entry per packet in the same order", (t) => {
  const composition = { included: { "1": 3, "6": 37 }, dropped: { "1": 9, "6": 412, unranked: 2 } };
  const snapshot = {
    actions: [
      { actionType: "web.dom.click", status: "succeeded", evidencePackets: [
        // The packet that counted, and the packet beside it that did not.
        { point: "beforeAction", bytes: 4_071, truncated: true, composition },
        { point: "afterAction", bytes: 3_900, truncated: false },
      ] },
    ],
  };
  const evidence = flowLaneEvidenceSizes(bundleWith(t, snapshot));
  assert.deepEqual(evidence.sanitizedPacketBytes, [4_071, 3_900]);
  assert.deepEqual(evidence.packetComposition, [composition, null]);
  assert.deepEqual(evidence.packets.map((packet) => packet.composition), [composition, null]);
});

test("a composition is carried only in the shape the contract states, so a malformed one cannot put page text in an evaluation", (t) => {
  const snapshot = {
    actions: [
      { evidencePackets: [{ point: "beforeAction", bytes: 10, truncated: false, composition: {
        // A key that is not a band, a count that is not one, and a band that is
        // both: only the last survives.
        included: { "Brightaisle Plus": 4, "1": "many", "2": 6, "3": -1, "4": 1.5 },
        dropped: { unranked: 1 },
      } }] },
      // Compositions that are not one at all: each reads as "not recorded".
      { evidencePackets: [{ point: "beforeAction", bytes: 11, truncated: false, composition: "included: 4" }] },
      { evidencePackets: [{ point: "beforeAction", bytes: 12, truncated: false, composition: { included: { "1": 1 } } }] },
      { evidencePackets: [{ point: "beforeAction", bytes: 13, truncated: false, composition: null }] },
    ],
  };
  const evidence = flowLaneEvidenceSizes(bundleWith(t, snapshot));
  assert.deepEqual(evidence.packetComposition, [{ included: { "2": 6 }, dropped: { unranked: 1 } }, null, null, null]);
  assert.equal(JSON.stringify(evidence).includes("Brightaisle"), false);
});

test("a snapshot that is absent, unreadable, unparseable, or has no list of actions yields no sizes and never throws", (t) => {
  const unreadable = bundleDirectory(t);
  mkdirSync(path.join(unreadable, "snapshots", "flow-lane.json"));
  const cases: Array<[string, string]> = [
    ["no bundle", path.join(tmpdir(), `fluxiq-flow-lane-no-bundle-${process.pid}-${Date.now()}`)],
    ["a bundle with no snapshot", bundleDirectory(t)],
    ["a snapshot path that is a directory", unreadable],
    ["an empty file", bundleWith(t, "")],
    ["broken JSON", bundleWith(t, "{ \"actions\": [ not json")],
    ["JSON null", bundleWith(t, "null")],
    ["a top-level array", bundleWith(t, [{ actions: [{ evidencePackets: [{ bytes: 10, truncated: true }] }] }])],
    ["actions not an array", bundleWith(t, { actions: { evidencePackets: [{ bytes: 10, truncated: true }] } })],
  ];
  for (const [name, bundlePath] of cases) assert.deepEqual(flowLaneEvidenceSizes(bundlePath), NO_EVIDENCE, name);
});

test("only an entry in the shape the lane writes is measured: a size the evaluation contract would reject is left out", (t) => {
  const snapshot = {
    actions: [
      {
        evidencePackets: [
          { bytes: -1, truncated: false }, { bytes: 1.5, truncated: true }, { bytes: 9_007_199_254_740_992, truncated: true }, { bytes: "10", truncated: true },
          { bytes: 10, truncated: "yes" }, { bytes: 10, truncated: 1 }, { bytes: 10 }, { truncated: true }, "packet", null, [10, true],
          { point: "afterAction", bytes: 512, truncated: true },
        ],
      },
      { evidencePackets: { point: "beforeAction", bytes: 10, truncated: true } },
      { evidencePackets: "none" },
      "not an action", null, [{ evidencePackets: [{ bytes: 10, truncated: true }] }],
      { evidencePackets: [{ point: "beforeAction", bytes: 0, truncated: false }] },
    ],
  };
  assert.deepEqual(flowLaneEvidenceSizes(bundleWith(t, snapshot)), {
    sanitizedPacketBytes: [512, 0], rawSnapshotBytes: [], packetComposition: [null, null], truncationCount: 1,
    // A position counts every entry of `actions`, so the last packet's action is the file's seventh entry.
    packets: [{ actionPosition: 1, point: "afterAction", bytes: 512, truncated: true, composition: null }, { actionPosition: 7, point: "beforeAction", bytes: 0, truncated: false, composition: null }],
  });
});

test("a packet's point is one the lane writes or null: a measured entry naming anything else is still sized, and its text is not carried", (t) => {
  const snapshot = {
    actions: [{ evidencePackets: [{ point: "Signed in as private.person", bytes: 64, truncated: false }, { bytes: 32, truncated: true }, { point: "afterAction", bytes: 16, truncated: false }] }],
  };
  const evidence = flowLaneEvidenceSizes(bundleWith(t, snapshot));
  assert.deepEqual(evidence.packets, [
    { actionPosition: 1, point: null, bytes: 64, truncated: false, composition: null },
    { actionPosition: 1, point: null, bytes: 32, truncated: true, composition: null },
    { actionPosition: 1, point: "afterAction", bytes: 16, truncated: false, composition: null },
  ]);
  assert.deepEqual(evidence.sanitizedPacketBytes, [64, 32, 16]);
  assert.equal(JSON.stringify(evidence).includes("private.person"), false);
});
