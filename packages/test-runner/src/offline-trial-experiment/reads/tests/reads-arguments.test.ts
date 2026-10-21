import assert from "node:assert/strict";
import test from "node:test";
import { parseReadsArguments } from "../reads-arguments.js";

const base = ["--store", "s", "--project", "p", "--work", "test-runs/p5w8/job"];

test("reads takes a store, a project and a new work directory, asks strict pairs and every read by default", () => {
  const parsed = parseReadsArguments(base);
  assert.ok(!("error" in parsed));
  assert.deepEqual(parsed, { store: "s", project: "p", work: "test-runs/p5w8/job", pairs: "strict", named: [], onePerFields: null, fidelity: true, channel: "chrome", out: null });
});

test("named pairs, a pair kind, one pair per path set, no fidelity, Edge and an output file", () => {
  const parsed = parseReadsArguments([...base, "--pairs", "same-snapshot", "--pair-list", "5c07f127@164/5c07f127@265,f53b350b@78/a4d59680@78", "--one-per-fields", "25", "--fidelity", "none", "--channel", "msedge", "--out", "o.json"]);
  assert.ok(!("error" in parsed));
  assert.deepEqual([parsed.pairs, parsed.onePerFields, parsed.fidelity, parsed.channel, parsed.out], ["same_snapshot", 25, false, "msedge", "o.json"]);
  assert.deepEqual(parsed.named, [
    { a: { trace: "5c07f127", sequence: 164 }, b: { trace: "5c07f127", sequence: 265 } },
    { a: { trace: "f53b350b", sequence: 78 }, b: { trace: "a4d59680", sequence: 78 } },
  ]);
});

test("refuses a missing store, project or work, a work directory outside test-runs, and malformed values", () => {
  assert.match((parseReadsArguments(["--store", "s", "--project", "p"]) as { error: string }).error, /--work is required/);
  assert.match((parseReadsArguments(["--project", "p", "--work", "test-runs/x"]) as { error: string }).error, /--store is required/);
  assert.match((parseReadsArguments(["--store", "s", "--project", "p", "--work", "elsewhere/x"]) as { error: string }).error, /test-runs/);
  assert.match((parseReadsArguments([...base, "--pairs", "all"]) as { error: string }).error, /strict, same-snapshot or none/);
  assert.match((parseReadsArguments([...base, "--pair-list", "a@1"]) as { error: string }).error, /trace@sequence\/trace@sequence/);
  assert.match((parseReadsArguments([...base, "--one-per-fields", "x"]) as { error: string }).error, /whole number/);
  assert.match((parseReadsArguments([...base, "--fidelity", "some"]) as { error: string }).error, /all or none/);
  assert.match((parseReadsArguments([...base, "--channel", "firefox"]) as { error: string }).error, /chrome or msedge/);
  assert.match((parseReadsArguments([...base, "--steps", "d"]) as { error: string }).error, /--steps is not an argument/);
  assert.match((parseReadsArguments([...base, "--out"]) as { error: string }).error, /--out needs a value/);
});
