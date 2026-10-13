import assert from "node:assert/strict";
import test from "node:test";
import { RunnerFailure } from "../../../failure.js";
import { recordFailedJudgement } from "../failed-judgement.js";

type Run = { flowId: string };

test("a judgement that fails after the run was published has the run recorded with the failure, and the failure is rethrown unchanged", async () => {
  const published: Run[] = [];
  const recorded: Array<[Run, unknown]> = [];
  const failure = new RunnerFailure("runtime.behavior", "Extract step extract-first-page yielded 15 record(s), expected 16");
  await assert.rejects(
    recordFailedJudgement<Run, string>(
      async (seen) => {
        await seen(async (run) => { published.push(run); })({ flowId: "flow-1" });
        throw failure;
      },
      async (run, lane) => { recorded.push([run, lane]); },
    ),
    (error: unknown) => error === failure,
  );
  assert.deepEqual(published, [{ flowId: "flow-1" }], "the lane's own publish still runs");
  assert.deepEqual(recorded, [[{ flowId: "flow-1" }, { category: "runtime.behavior", code: null }]]);
});

test("a lane that threw before publishing a run records nothing", async () => {
  let recorded = 0;
  await assert.rejects(recordFailedJudgement<Run, string>(async () => { throw new Error("build failed"); }, async () => { recorded += 1; }), /build failed/u);
  assert.equal(recorded, 0);
});

test("a record that cannot be written never replaces the judgement's failure", async () => {
  const failure = new RunnerFailure("runtime.behavior", "oracle");
  await assert.rejects(
    recordFailedJudgement<Run, string>(
      async (seen) => {
        await seen(async () => undefined)({ flowId: "flow-1" });
        throw failure;
      },
      async () => { throw new Error("disk full"); },
    ),
    (error: unknown) => error === failure,
  );
});

test("a lane that passes returns its result and records nothing", async () => {
  let recorded = 0;
  const result = await recordFailedJudgement<Run, string>(
    async (seen) => {
      await seen(async () => undefined)({ flowId: "flow-1" });
      return "passed";
    },
    async () => { recorded += 1; },
  );
  assert.equal(result, "passed");
  assert.equal(recorded, 0);
});
