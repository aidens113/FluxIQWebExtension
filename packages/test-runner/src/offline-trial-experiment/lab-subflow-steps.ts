// The subflow submissions and tests a Lab run's step files hold
// (`lab-runs/<date>/<run>/steps/<NNNN>-tool-core.{submit,test}_subflow/`).
//
// Core keeps only a build's latest candidate (`candidate-draft`); every earlier
// revision's script survives in the step that submitted it, as Core accepted
// it (`result.json` `script`, "script is its whole text"). So this is where an
// earlier revision is read from. Only accepted submissions are kept: a refused
// one made no revision. A test is kept whether it ran or was refused, so a
// refused test is still on the record.
//
// Nothing here prints or returns page content except the accepted script,
// which the caller hands to Core's compiler and never writes out.

import { readdir, readFile } from "node:fs/promises";
import path from "node:path";
import { jsonRecord as record } from "./json-record.js";
import type { LabSubflowSteps, LabSubflowSubmission, LabSubflowTest } from "./types.js";

const SUBMIT = /^(\d{4})-tool-core\.submit_subflow$/;
const TEST = /^(\d{4})-tool-core\.test_subflow$/;

export async function readLabSubflowSteps(stepsDir: string): Promise<LabSubflowSteps> {
  const folders = (await readdir(stepsDir, { withFileTypes: true })).filter((entry) => entry.isDirectory()).map((entry) => entry.name).sort();
  const submissions: LabSubflowSubmission[] = [];
  const tests: LabSubflowTest[] = [];
  for (const folder of folders) {
    const submit = SUBMIT.exec(folder);
    const test = TEST.exec(folder);
    if (!submit && !test) continue;
    const result = await readJson(path.join(stepsDir, folder, "result.json"));
    const meta = await readJson(path.join(stepsDir, folder, "meta.json"));
    const briefId = typeof meta?.briefId === "string" && meta.briefId ? meta.briefId : null;
    if (submit) {
      const accepted = result?.ok === true && typeof result.revision === "number" && typeof result.digest === "string" && typeof result.script === "string" && typeof result.subflowKey === "string";
      if (accepted) submissions.push(Object.freeze({ step: Number(submit[1]), folder, briefId, subflowKey: result.subflowKey as string, revision: result.revision as number, digest: result.digest as string, script: result.script as string }));
      continue;
    }
    tests.push(Object.freeze(testOf(Number(test![1]), folder, briefId, result ?? {})));
  }
  return Object.freeze({ submissions: Object.freeze(submissions), tests: Object.freeze(tests) });
}

function testOf(step: number, folder: string, briefId: string | null, result: Record<string, unknown>): LabSubflowTest {
  const feedback = record(result.feedback);
  const whole = record(feedback?.wholeTest);
  const stored = record(feedback?.stored);
  const code = typeof feedback?.code === "string" ? feedback.code : typeof result.code === "string" ? result.code : null;
  return {
    step, folder, briefId,
    revision: typeof result.revision === "number" ? result.revision : null,
    digest: typeof result.digest === "string" ? result.digest : null,
    verdict: typeof result.verdict === "string" ? result.verdict : null,
    code,
    trialRunId: typeof result.trialRunId === "string" ? result.trialRunId : typeof feedback?.trialRunId === "string" ? feedback.trialRunId : null,
    whole: whole && typeof whole.revision === "number" && typeof whole.digest === "string" ? Object.freeze({ revision: whole.revision, digest: whole.digest }) : null,
    storedRows: typeof stored?.rows === "number" ? stored.rows : null,
  };
}

async function readJson(file: string): Promise<Record<string, unknown> | undefined> {
  let text: string;
  try {
    text = await readFile(file, "utf8");
  } catch (error) {
    if ((error as NodeJS.ErrnoException).code === "ENOENT") return undefined;
    throw error;
  }
  return record(JSON.parse(text));
}

