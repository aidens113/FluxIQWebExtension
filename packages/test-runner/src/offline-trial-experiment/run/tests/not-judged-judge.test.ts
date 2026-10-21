import assert from "node:assert/strict";
import test from "node:test";
import { notJudgedJudge } from "../not-judged-judge.js";

test("answers every trial not judged at no spend and counts the asks", async () => {
  const port = notJudgedJudge();
  assert.equal(port.asked(), 0);
  const verdict = await port.judge({ summary: {} } as Parameters<typeof port.judge>[0]);
  assert.equal(verdict.verdict, "not_judged");
  assert.deepEqual(verdict.spent, { calls: 0, inputTokens: 0, outputTokens: 0, totalTokens: 0, estimatedCostUsd: 0 });
  await port.judge({ summary: {} } as Parameters<typeof port.judge>[0]);
  assert.equal(port.asked(), 2);
});
