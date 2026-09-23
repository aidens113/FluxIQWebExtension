// One grouping rule for "did this attempt's node end on a success", read by the
// run's failure (`persisted-flow-run.ts`) and by the recovery wait
// (`terminal-run-wait.ts`).

import assert from "node:assert/strict";
import test from "node:test";
import { everyNodeEndedSucceeded, recoveredByNode } from "../node-recovery.js";

const attempt = (nodeId: string | null, status: string) => ({ nodeId, status });

test("every attempt of a node carries the node's own ending, whichever attempt it is", () => {
  // `run-mudwci8d-de88aa32`: s1 missed its target and attempt 2 found it; s7's
  // extract lost its message channel and attempt 2 read the list. Both
  // failures are still in the list, and both belong to a node that recovered.
  const attempts = [
    attempt("s1", "failed"), attempt("s1", "succeeded"),
    attempt("s2", "succeeded"),
    attempt("s7", "failed"), attempt("s7", "succeeded"),
  ];
  assert.deepEqual(recoveredByNode(attempts), [true, true, true, true, true]);
  assert.equal(everyNodeEndedSucceeded(attempts), true);
});

test("a node whose last attempt did not succeed is where the run stopped, and it takes its earlier attempts with it", () => {
  const attempts = [attempt("s1", "succeeded"), attempt("s2", "failed"), attempt("s2", "failed")];
  assert.deepEqual(recoveredByNode(attempts), [true, false, false]);
  assert.equal(everyNodeEndedSucceeded(attempts), false);
  // Core's word is `succeeded` and nothing else counts: a cancelled or unknown
  // ending is not a recovery.
  for (const status of ["cancelled", "unknown", "running"]) {
    assert.equal(everyNodeEndedSucceeded([attempt("s1", status)]), false, `${status} read as a successful ending`);
  }
});

test("an attempt that names no node is its own group, so unnamed attempts never fold into one invented node", () => {
  const attempts = [attempt(null, "failed"), attempt(null, "succeeded")];
  assert.deepEqual(recoveredByNode(attempts), [false, true], "the second attempt did not rescue the first: they are different nodes");
  assert.deepEqual(recoveredByNode([{ status: "succeeded" }, { status: "failed" }]), [true, false]);
  // A node id that is not a string is no id at all.
  assert.deepEqual(recoveredByNode([attempt("", "failed"), { nodeId: 7, status: "succeeded" }]), [false, true]);
});

test("a run with no attempt answers vacuously, so a caller that cares establishes it has attempts first", () => {
  assert.deepEqual(recoveredByNode([]), []);
  assert.equal(everyNodeEndedSucceeded([]), true);
});
