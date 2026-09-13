import assert from "node:assert/strict";
import { mkdirSync, mkdtempSync, rmSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import path from "node:path";
import test, { type TestContext } from "node:test";
import type { RunEvidenceSizes } from "@fluxiq-web-extension/test-contracts";
import { flowLaneEvidenceSizes } from "../flow-lane-evidence-sizes.js";

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
const NO_EVIDENCE: RunEvidenceSizes = { sanitizedPacketBytes: [], rawSnapshotBytes: [], truncationCount: 0 };

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
  assert.deepEqual(flowLaneEvidenceSizes(bundleWith(t, snapshot)), { sanitizedPacketBytes: [2_048, 1_024, 0, 4_096], rawSnapshotBytes: [], truncationCount: 2 });
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
  assert.deepEqual(flowLaneEvidenceSizes(bundleWith(t, snapshot)), { sanitizedPacketBytes: [512, 0], rawSnapshotBytes: [], truncationCount: 1 });
});
