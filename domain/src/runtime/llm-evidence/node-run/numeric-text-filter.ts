// One closed sentence for a text condition that dropped rows whose column reads
// as numbers, shown beside the rejected rows (`./rejected-rows.ts`).
//
// Live run 36 (`run-muq3uozx-3153564b`, cause 10): told to confirm every
// friend request with at least five mutual friends, the model wrote
// `mutual matches /(?:[5-9]|[1-9][0-9]+) mutual/` rather than `atLeast: 5`. The
// regex dropped Jonas Weber, whose line reads "Aisha Khan and 4 other mutual
// friends": five, by the reading every numeric condition uses
// (`actions/extraction/condition-match.ts`, `webAutomationExtractConditionNumber`),
// but no digit run a pattern over the text can see. The rejected row was shown;
// what the model lacked was that a bound reads the number the page means and a
// pattern does not.
//
// So a `matches` or `contains` condition on a record column, comparing nothing
// numerically, whose every rejected row shown reads as a number in that column,
// gets one sentence naming those rows with their numbers. A column where any
// shown value does not read as a number gets none: a name with a digit in it
// is not a count.
//
// The sentence is built from the rows after the screen (`./read-result.ts`), so
// it quotes nothing the rows beside it do not already quote, and it is bounded:
// at most `NAMED_ROWS` rows, each label cut to `LABEL_CHARACTERS`.

import type { JsonObject, JsonValue } from "fluxiq/core";
import {
  WEB_AUTOMATION_EXTRACT_CONDITION_BOUNDS,
  webAutomationExtractConditionNumber,
  type WebAutomationExtractItemCondition
} from "../../../actions/extraction";
import { isWithheldText } from "../withheld";

/** The most rejected rows one sentence names. */
const NAMED_ROWS = 5;
/** The most characters of a row's label, and of the column's key, one sentence quotes. */
const LABEL_CHARACTERS = 40;

/**
 * The sentence for condition `where` (its position in the request), or
 * `undefined` when it is not a text condition on a column, or when any shown
 * rejected row's value in that column does not read as a number.
 */
export function webNodeNumericTextFilterSentence(where: number, condition: WebAutomationExtractItemCondition, rows: readonly JsonValue[]): string | undefined {
  const column = condition.field;
  if (column === undefined || (condition.matches === undefined && condition.contains === undefined)) return undefined;
  if (condition.equals !== undefined || WEB_AUTOMATION_EXTRACT_CONDITION_BOUNDS.some((key) => condition[key] !== undefined)) return undefined;
  const named: string[] = [];
  let read = 0;
  for (const shown of rows) {
    const row = objectValue(shown);
    const value = row?.[column];
    if (row === undefined || value === null || value === undefined) continue;
    if (typeof value !== "string" || isWithheldText(value)) return undefined;
    const number = webAutomationExtractConditionNumber(value);
    if (number === undefined) return undefined;
    read += 1;
    if (named.length < NAMED_ROWS) {
      const label = rowLabel(row, column);
      named.push(label === undefined ? String(number) : `${label}: ${number}`);
    }
  }
  if (read === 0) return undefined;
  const more = read > named.length ? `, and ${read - named.length} more` : "";
  return `where ${where} tests the text of ${cut(column)}, which reads as numbers (${named.join(", ")}${more}); for at least or at most use atLeast or atMost.`;
}

/** The row's first other non-empty value, as the row names itself, or `undefined` when it has none fit to quote. */
function rowLabel(row: JsonObject, column: string): string | undefined {
  for (const [key, value] of Object.entries(row)) {
    if (key === column || typeof value !== "string" || isWithheldText(value)) continue;
    const text = value.replace(/\s+/gu, " ").trim();
    if (text.length > 0) return cut(text);
  }
  return undefined;
}

function cut(text: string): string {
  return text.length > LABEL_CHARACTERS ? `${text.slice(0, LABEL_CHARACTERS - 3)}...` : text;
}

function objectValue(value: JsonValue | undefined): JsonObject | undefined {
  return typeof value === "object" && value !== null && !Array.isArray(value) ? value : undefined;
}
