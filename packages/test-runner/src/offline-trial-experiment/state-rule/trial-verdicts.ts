// What each live trial's judge said, from a Lab run's step files: every model test call's
// `result.json` names its trial's run id and verdict, and a subflow test names the whole
// candidate's trial inside its feedback. A trace's episode id is its trial's run id.

import { readdir, readFile } from "node:fs/promises";
import path from "node:path";
import { jsonRecord } from "../json-record.js";

const TEST_STEP = /^\d{4}-tool-core\.test_/u;

export async function readTrialVerdicts(stepsDir: string): Promise<ReadonlyMap<string, string>> {
  const verdicts = new Map<string, string>();
  let folders: readonly string[];
  try {
    folders = (await readdir(stepsDir)).filter((name) => TEST_STEP.test(name)).sort();
  } catch (error) {
    if ((error as NodeJS.ErrnoException).code === "ENOENT") return verdicts;
    throw error;
  }
  for (const folder of folders) {
    let text: string;
    try {
      text = await readFile(path.join(stepsDir, folder, "result.json"), "utf8");
    } catch (error) {
      if ((error as NodeJS.ErrnoException).code === "ENOENT") continue;
      throw error;
    }
    const result = jsonRecord(JSON.parse(text));
    const feedback = jsonRecord(result?.feedback);
    const whole = jsonRecord(feedback?.wholeTest);
    note(verdicts, feedback?.trialRunId ?? result?.trialRunId, result?.verdict);
    note(verdicts, whole?.trialRunId, whole?.verdict);
  }
  return verdicts;
}

function note(verdicts: Map<string, string>, trial: unknown, verdict: unknown): void {
  if (typeof trial === "string" && typeof verdict === "string") verdicts.set(trial, verdict);
}
