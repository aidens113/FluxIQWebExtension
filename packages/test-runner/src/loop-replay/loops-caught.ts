// Loops caught in a live run, by pattern, read from its step log for the Lab's
// report: Core writes a `NNNN-loop` folder for each steer and signal, and an
// `answer-<tool>` folder for each refusal, whose reason names the pattern
// (`repeat-guard/loop-detection/` in Core). Closed codes only.

import { readdir, readFile } from "node:fs/promises";
import path from "node:path";
import { automationStudioLlmLoopsCaught, type AutomationStudioLlmLoopsCaught } from "fluxiq/automation";

const LOOP_STEP = /^\d{4,}-loop$/u;
const ANSWER_STEP = /^\d{4,}-answer-/u;
/** How a `loop` folder's rung reads as the row the trace has for it. */
const RUNG_CODES: Readonly<Record<string, string>> = { steer: "llm_evidence_loop.loop_steered", change_approach: "llm_evidence_loop.loop_change_approach", ask_person: "llm_evidence_loop.loop_ask_person" };

async function metaOf(folder: string): Promise<Record<string, unknown> | undefined> {
  try {
    return JSON.parse(await readFile(path.join(folder, "meta.json"), "utf8")) as Record<string, unknown>;
  } catch (error) {
    if ((error as NodeJS.ErrnoException).code === "ENOENT" || error instanceof SyntaxError) return undefined;
    throw error;
  }
}

/** What a run's `steps/` says the loop detector did; all noughts for a run with none. */
export async function loopsCaughtInSteps(stepsDirectory: string): Promise<AutomationStudioLlmLoopsCaught> {
  const names = await readdir(stepsDirectory).catch((error: NodeJS.ErrnoException) => {
    if (error.code === "ENOENT") return [] as string[];
    throw error;
  });
  const rows: Array<{ resultCode?: string; resultReason?: string }> = [];
  for (const name of names) {
    if (!LOOP_STEP.test(name) && !ANSWER_STEP.test(name)) continue;
    const meta = await metaOf(path.join(stepsDirectory, name));
    if (!meta) continue;
    if (LOOP_STEP.test(name)) {
      const code = RUNG_CODES[String(meta.rung)];
      if (code) rows.push({ resultCode: code, ...(typeof meta.pattern === "string" ? { resultReason: meta.pattern } : {}) });
    } else if (typeof meta.resultCode === "string") {
      rows.push({ resultCode: meta.resultCode, ...(typeof meta.resultReason === "string" ? { resultReason: meta.resultReason } : {}) });
    }
  }
  return automationStudioLlmLoopsCaught(rows);
}
