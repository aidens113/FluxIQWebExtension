import path from "node:path";
import type { ChartOutput } from "../chart/index.js";
import { listFolder } from "./list-folder.js";
import { readOfferedCompletion } from "./offered-completion.js";
import { readJsonFile } from "./read-json-file.js";

type AnswerTurn = { visible?: boolean; headline?: string; columns?: string[]; rows?: string[][]; note?: string | null; text?: string | null };

/** The newest `answer-turn.json` of the run (the folder, or its `attempt-N` folders), which is what the person was shown. */
async function newestAnswerTurn(evidenceDirectory: string): Promise<AnswerTurn | undefined> {
  const folders = (await listFolder(evidenceDirectory)).filter((name) => /^attempt-\d+$/u.test(name)).sort((left, right) => Number(right.slice(8)) - Number(left.slice(8)));
  for (const folder of [...folders, "."]) {
    const turn = await readJsonFile<AnswerTurn>(path.join(evidenceDirectory, folder, "answer-turn.json"));
    if (turn !== undefined) return turn;
  }
  return undefined;
}

/**
 * The result the attempt returned. An answer the chat showed wins and is labelled "shown to the person"; otherwise the
 * newest completion the model offered (from the step files) is shown as "offered, not accepted" with the check's outcome;
 * "none" with the reason when neither exists.
 */
export async function readChartOutput(evidenceDirectory: string, stepsDirectory: string): Promise<ChartOutput> {
  const turn = await newestAnswerTurn(evidenceDirectory);
  if (turn !== undefined && turn.visible !== false) {
    const rows = turn.rows ?? [], columns = turn.columns ?? [];
    if (columns.length > 0 && rows.length > 0) {
      const total = /of (\d+) rows?\b/u.exec(turn.note ?? "")?.[1];
      return { kind: "rows", source: "shown to the person", headline: turn.headline ?? "", columns, rows, total: total === undefined ? rows.length : Number(total), check: [] };
    }
    if (turn.text) return { kind: "text", source: "shown to the person", text: turn.text };
  }
  const offered = await readOfferedCompletion(stepsDirectory);
  if (offered !== undefined) return offered;
  if (turn !== undefined && turn.headline) return { kind: "none", why: `the attempt returned no result (${turn.headline})` };
  return { kind: "none", why: "no answer was shown and no completion was offered in this run" };
}
