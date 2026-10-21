// The feedback a live trial's builder was shown -- what its judge saw beside
// its verdict -- from the Lab step file of the test that ran it
// (`steps/<NNNN>-tool-core.test_subflow/result.json`, `feedback`). It holds
// page content, so callers reduce it (`./trial-observation.ts`) and never
// write it out.

import { readFile } from "node:fs/promises";
import path from "node:path";
import { jsonRecord } from "../json-record.js";

export async function readLiveTrialFeedback(stepsDir: string, folder: string): Promise<Record<string, unknown>> {
  const result = jsonRecord(JSON.parse(await readFile(path.join(stepsDir, folder, "result.json"), "utf8")));
  const feedback = jsonRecord(result?.feedback);
  if (!feedback) throw new Error(`The test step ${folder} holds no trial feedback`);
  return feedback;
}
