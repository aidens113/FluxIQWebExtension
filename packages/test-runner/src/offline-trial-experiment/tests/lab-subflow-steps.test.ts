import assert from "node:assert/strict";
import { mkdir, mkdtemp, rm, writeFile } from "node:fs/promises";
import os from "node:os";
import path from "node:path";
import test from "node:test";
import { readLabSubflowSteps } from "../lab-subflow-steps.js";

async function stepsDir(folders: Record<string, { result?: unknown; meta?: unknown }>): Promise<string> {
  const root = await mkdtemp(path.join(os.tmpdir(), "p4d-steps-"));
  for (const [name, files] of Object.entries(folders)) {
    await mkdir(path.join(root, name));
    if (files.result !== undefined) await writeFile(path.join(root, name, "result.json"), JSON.stringify(files.result));
    if (files.meta !== undefined) await writeFile(path.join(root, name, "meta.json"), JSON.stringify(files.meta));
  }
  return root;
}

test("keeps accepted submissions and every test, in step order, and nothing else", async () => {
  const root = await stepsDir({
    "0012-tool-core.submit_subflow": { result: { ok: false, revision: 2, issueCodes: ["x"] }, meta: { briefId: "brief-1" } },
    "0010-tool-core.submit_subflow": { result: { ok: true, status: "draft", subflowKey: "collect", revision: 1, digest: "d1", script: "flow: a" }, meta: { briefId: "brief-1" } },
    "0013-answer-core.submit_subflow": { result: { verdict: "refused" } },
    "0011-decide": { result: {} },
    "0014-tool-core.test_subflow": {
      result: { ok: false, verdict: "no", revision: 1, digest: "d1", trialRunId: "trial.a", feedback: { code: "candidate.trial_judged_no", stored: { rows: 15 }, wholeTest: { revision: 5, digest: "w5" } } },
      meta: { briefId: "brief-1" },
    },
    "0016-tool-core.test_subflow": { result: { ok: false, code: "candidate.unchanged_after_no" }, meta: { briefId: "brief-2" } },
  });
  try {
    const steps = await readLabSubflowSteps(root);
    assert.deepEqual(steps.submissions.map((submission) => [submission.step, submission.briefId, submission.revision, submission.digest, submission.subflowKey]), [[10, "brief-1", 1, "d1", "collect"]]);
    assert.equal(steps.submissions[0]!.script, "flow: a");
    assert.deepEqual(steps.tests.map((entry) => [entry.step, entry.briefId, entry.revision, entry.verdict, entry.code, entry.trialRunId, entry.whole, entry.storedRows]), [
      [14, "brief-1", 1, "no", "candidate.trial_judged_no", "trial.a", { revision: 5, digest: "w5" }, 15],
      [16, "brief-2", null, null, "candidate.unchanged_after_no", null, null, null],
    ]);
  } finally {
    await rm(root, { recursive: true, force: true });
  }
});

test("a step folder without its files is read as nothing it does not hold", async () => {
  const root = await stepsDir({ "0020-tool-core.test_subflow": {}, "0021-tool-core.submit_subflow": {} });
  try {
    const steps = await readLabSubflowSteps(root);
    assert.equal(steps.submissions.length, 0);
    assert.deepEqual(steps.tests.map((entry) => [entry.step, entry.briefId, entry.verdict]), [[20, null, null]]);
  } finally {
    await rm(root, { recursive: true, force: true });
  }
});
