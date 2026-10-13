// The domain reads a value's number exactly as Core does (P7, t510).
//
// A `where` bound runs on the page through `webAutomationExtractConditionNumber`,
// and the same rows' `process.where` and `sort` run in Core through
// `readAutomationStudioRecordNumber`. If the two read "£72k" differently, a Flow's
// page and its answer disagree about one row. Core keeps the cases both must
// agree on in one table (`@fluxiq/contracts`, `record-sets/process/value-reading-cases.ts`);
// this runs that table's number cases against the domain's reader, so the two
// cannot drift. Its date and sort-kind cases are Core's own: the domain reads no
// dates for a condition.
//
// The table is read from the Core this checkout links (the sibling `!FluxIQ`):
// from its source when the source is there, because the table changes in the
// same commit as the reader it pins and a built copy can lag it, and otherwise
// from the package's built export.

import assert from "node:assert/strict";
import { existsSync } from "node:fs";
import test from "node:test";
import { fileURLToPath } from "node:url";
import { webAutomationExtractConditionNumber } from "../condition-match";

type ReadingCase = { kind: string; text?: string; expected: unknown };

/** Core's shared value-reading table (header). */
async function coreValueReadingCases(): Promise<readonly ReadingCase[]> {
  // `.../packages/fluxiq/dist/programs/automation-studio/index.js`, four levels under `packages/`.
  const packages = new URL("../../../../", import.meta.resolve("fluxiq/automation-studio"));
  const source = new URL("contracts/src/record-sets/process/value-reading-cases.ts", packages);
  const built = new URL("contracts/dist/automation-studio.js", packages);
  const loaded = (await import(existsSync(fileURLToPath(source)) ? source.href : built.href)) as { AUTOMATION_STUDIO_RECORD_VALUE_READING_CASES?: readonly ReadingCase[] };
  const cases = loaded.AUTOMATION_STUDIO_RECORD_VALUE_READING_CASES;
  assert.ok(Array.isArray(cases), "Core's value-reading table is exported");
  return cases;
}

test("every number case of Core's value-reading table reads the same through the domain's condition reader", async () => {
  const numbers = (await coreValueReadingCases()).filter((entry): entry is ReadingCase & { text: string } => entry.kind === "number" && typeof entry.text === "string");
  assert.ok(numbers.length > 0, "the table has number cases");
  for (const entry of numbers) assert.equal(webAutomationExtractConditionNumber(entry.text) ?? null, entry.expected, entry.text);
  // The case this was written for is in the table (t510).
  assert.ok(numbers.some((entry) => entry.text === "£72k – £80k per annum" && entry.expected === 72000), "the magnitude case is in the table");
});

/**
 * The supervisor's rule for a letter m (t510): a million only with a currency
 * sign attached or a decimal point. Core's table is to carry these rows as well;
 * they are pinned here too so the rule holds before and after it does, and the
 * table's own rows, when they land, run through the test above.
 */
const LETTER_M_CASES: ReadonlyArray<readonly [string, number]> = [["3m ago", 3], ["10 m", 10], ["$1.2m", 1_200_000], ["£3m", 3_000_000]];

test("a letter m is a million only with a currency sign attached or a decimal point", async () => {
  for (const [text, expected] of LETTER_M_CASES) assert.equal(webAutomationExtractConditionNumber(text), expected, text);
  // Wherever the shared table states one of these values, it states the same number.
  for (const entry of await coreValueReadingCases()) {
    const pinned = LETTER_M_CASES.find(([text]) => entry.kind === "number" && entry.text === text);
    if (pinned !== undefined) assert.equal(entry.expected, pinned[1], pinned[0]);
  }
});
