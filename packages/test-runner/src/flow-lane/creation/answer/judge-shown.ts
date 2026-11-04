import type { AnswerShownOutcome, ExpectedExtraction } from "@fluxiq-web-extension/test-contracts";
import { measureExtraction, type ExtractionRecord } from "../../../run-expectations/index.js";
import type { ShownAnswer } from "./ports.js";

/** What was shown against what was expected: counts, and never a value. */
export type ShownAnswerJudgement = Readonly<{ shown: AnswerShownOutcome; shownRows: number | null; secretShown: boolean }>;

const normal = (text: string): string => text.replace(/\s+/gu, " ").trim().toLowerCase();

/** A value a chat would show in words: an address is shown as a link's text, which no reading of the words can tell. */
const wordsOf = (record: Readonly<Record<string, string | null>>): string[] => Object.values(record).flatMap((value) => (value === null || value === "" || /^(?:\/|https?:)/u.test(value) ? [] : [normal(value)]));

function everyTextIn(text: string): string {
  return normal(text);
}

function shownText(shown: ShownAnswer): string {
  if (shown.form === "text") return everyTextIn(shown.text);
  const cells = (shown.turn.rows?.previewRows ?? []).flatMap((row) => Object.values(row).map((cell) => (typeof cell === "string" ? cell : JSON.stringify(cell) ?? "")));
  return everyTextIn([...cells, shown.turn.answerText?.text ?? ""].join(" "));
}

/**
 * The expected records against rows the turn shows. A preview may stop before the
 * whole answer, so the rows it holds must be the answer's first rows and its total
 * the answer's size: a turn showing 5 of 8 right rows is the right answer told
 * honestly, and one showing 8 with a wrong row among them is not.
 */
function rowsMatch(entry: ExpectedExtraction, preview: readonly Readonly<Record<string, unknown>>[], totalRows: number, scenarioOrigin: string): boolean {
  const expected = entry.records ?? [];
  if (totalRows !== expected.length || preview.length === 0 || preview.length > expected.length) return false;
  const records = preview.map((row) => Object.fromEntries(Object.entries(row).map(([key, cell]) => [key, typeof cell === "string" || cell === null ? cell : String(cell)]))) as ExtractionRecord[];
  const { pages: _pages, truncated: _truncated, count: _count, ...compared } = entry;
  const measured = measureExtraction({ ...compared, records: expected.slice(0, preview.length) }, records, { nonStringValues: 0 }, { scenarioOrigin });
  return measured.matchedRecords === preview.length;
}

/**
 * Whether the answer the person saw is the right one: the same expectation the
 * stored rows answer to, and a right answer that never reached them fails.
 *
 * - A task with records must show them. A `turn` is compared row by row. Panel
 *   `text` holds no rows, so every value must be in the words.
 * - A task with no records and asked acts must say what it did: a turn's landed acts.
 *   What a sentence in the panel says of an act cannot be judged, so it is `unjudged`
 *   rather than a pass.
 * - A task with neither has nothing to compare.
 *
 * `secretValues` are the screen: a declared secret in what was shown fails however
 * right the rest is.
 */
export function judgeShownAnswer(input: {
  shown: ShownAnswer | null;
  expected: ExpectedExtraction | undefined;
  askedActs: number;
  secretValues: readonly string[];
  scenarioOrigin: string;
}): ShownAnswerJudgement {
  const { shown, expected, askedActs } = input;
  const records = expected?.records;
  const wantsRecords = records !== undefined && records.length > 0;
  if (shown === null) return { shown: wantsRecords || askedActs > 0 ? "failed" : "unjudged", shownRows: wantsRecords ? 0 : null, secretShown: false };
  const text = shownText(shown);
  const secretShown = input.secretValues.some((value) => value.length > 0 && text.includes(normal(value)));
  const fail = (shownRows: number | null): ShownAnswerJudgement => ({ shown: "failed", shownRows, secretShown });
  if (secretShown) return fail(shown.form === "turn" ? shown.turn.rows?.previewRows.length ?? null : null);
  if (wantsRecords) {
    if (shown.form === "text") {
      const held = records.filter((record) => wordsOf(record).every((value) => text.includes(value))).length;
      return held === records.length ? { shown: "held", shownRows: held, secretShown } : fail(held);
    }
    const rows = shown.turn.rows;
    if (!rows) return fail(0);
    return rowsMatch(expected!, rows.previewRows, rows.totalRows, input.scenarioOrigin) ? { shown: "held", shownRows: rows.previewRows.length, secretShown } : fail(rows.previewRows.length);
  }
  if (askedActs > 0) {
    if (shown.form === "text") return { shown: "unjudged", shownRows: null, secretShown };
    const told = shown.turn.acts.filter((act) => act.state === "landed" || act.state === "may_have_landed").length;
    return told > 0 ? { shown: "held", shownRows: null, secretShown } : fail(null);
  }
  return { shown: "unjudged", shownRows: null, secretShown };
}
