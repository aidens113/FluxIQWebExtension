import type { ShownAnswer, ShownAnswerTurn } from "../../flow-lane/index.js";
import type { AnswerTurnDom } from "./answer-turn-dom.js";

const ANSWER_KINDS: ReadonlySet<string> = new Set(["rows", "done_on_site", "plain_answer", "partial"]);

/** "Found 4 of 4", "Found 4 rows", "Here are the 4 I got": the one count the turn says out loud. */
function totalRowsOf(dom: AnswerTurnDom): number | undefined {
  const note = /of (\d+) rows?\b/u.exec(dom.note ?? "");
  if (note) return Number(note[1]);
  const counted = /\b(\d+) of \d+\b|\b(\d+) rows?\b|the (\d+)\b/u.exec(dom.headline);
  const digits = counted?.[1] ?? counted?.[2] ?? counted?.[3];
  if (digits) return Number(digits);
  return /\b1 row\b|the 1\b/u.test(dom.headline) ? 1 : undefined;
}

/** A line of what it did on the site, told by the words the turn prints for each state (`chat/answer/words/act-words.ts` in Core). */
function actOfLine(line: string): ShownAnswerTurn["acts"][number] {
  if (line.startsWith("This may have happened")) return { state: "may_have_landed" };
  if (line.startsWith("Not done:")) return { state: "not_done" };
  if (/, then it was undone\.$/u.test(line)) return { state: "undone" };
  return { state: "landed" };
}

/**
 * The turn as the person read it, from the panel and nothing else, so a right answer
 * that never reached them cannot pass. A turn that holds no answer yet is what a chat
 * showed instead: nothing to judge as an answer.
 *
 * `columnIds` names the rows' cells for the oracle, which keys them by id where the
 * panel prints a label. It decides what a cell is called, never what it says.
 */
export function shownAnswerOfDom(dom: AnswerTurnDom | null, columnIds: ReadonlyMap<string, string>): ShownAnswer | null {
  if (dom === null || !dom.visible) return null;
  const kind = ANSWER_KINDS.has(dom.kind) ? dom.kind as ShownAnswerTurn["kind"] : "partial";
  const hasRows = dom.columns.length > 0 && dom.rows.length > 0;
  const previewRows = hasRows ? dom.rows.map((cells) => Object.fromEntries(cells.map((cell, index) => [columnIds.get(dom.columns[index] ?? "") ?? dom.columns[index] ?? String(index), cell]))) : [];
  const total = hasRows ? totalRowsOf(dom) ?? dom.rows.length : 0;
  const turn: ShownAnswerTurn = {
    kind,
    ...(hasRows ? { rows: { totalRows: total, truncated: dom.note !== null, previewRows } } : {}),
    acts: dom.siteLines.map(actOfLine),
    ...(dom.text ? { answerText: { text: dom.text } } : {}),
  };
  return { form: "turn", turn };
}
