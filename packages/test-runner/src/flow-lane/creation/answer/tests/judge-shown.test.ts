import assert from "node:assert/strict";
import test from "node:test";
import type { ExpectedExtraction } from "@fluxiq-web-extension/test-contracts";
import { judgeShownAnswer } from "../judge-shown.js";
import type { ShownAnswer } from "../ports.js";

const RECORDS = [{ item: "Kettle", quantity: "2", price: "$39.99" }, { item: "Batteries", quantity: "1", price: "$12.97" }];
const EXPECTED: ExpectedExtraction = { step: "extract-cart", count: 2, records: RECORDS };
const ORIGIN = "http://127.0.0.1:4100";
const turn = (previewRows: Record<string, unknown>[], totalRows = previewRows.length): ShownAnswer => ({ form: "turn", turn: { kind: "rows", rows: { totalRows, truncated: false, previewRows }, acts: [] } });
const judge = (shown: ShownAnswer | null, overrides: Partial<Parameters<typeof judgeShownAnswer>[0]> = {}) => judgeShownAnswer({ shown, expected: EXPECTED, askedActs: 0, secretValues: [], scenarioOrigin: ORIGIN, ...overrides });

test("the right rows in the turn were shown", () => {
  assert.deepEqual(judge(turn(RECORDS)), { shown: "held", shownRows: 2, secretShown: false });
});

test("a chat that showed nothing fails a task with an answer to show", () => {
  assert.deepEqual(judge(null), { shown: "failed", shownRows: 0, secretShown: false });
  assert.equal(judge(null, { expected: undefined, askedActs: 1 }).shown, "failed");
});

test("a chat that showed nothing has nothing to fail on a task with nothing to show", () => {
  assert.equal(judge(null, { expected: undefined, askedActs: 0 }).shown, "unjudged");
});

test("the wrong rows in the turn are not the answer, whatever was stored", () => {
  assert.equal(judge(turn([RECORDS[0]!, { ...RECORDS[1]!, quantity: "9" }])).shown, "failed");
  assert.equal(judge(turn([RECORDS[1]!, RECORDS[0]!])).shown, "failed", "in the order the answer asks for");
});

test("a preview of the right rows with the right total is the answer told honestly; a wrong total is not", () => {
  assert.equal(judge(turn([RECORDS[0]!], 2)).shown, "held");
  assert.equal(judge(turn([RECORDS[0]!], 1)).shown, "failed");
  assert.equal(judge(turn([RECORDS[0]!], 5)).shown, "failed");
});

test("a turn with no rows on a task that asks for rows fails", () => {
  assert.equal(judge({ form: "turn", turn: { kind: "plain_answer", acts: [], answerText: { text: "Kettle, 2" } } }).shown, "failed");
});

test("today's chat, read as words: every value must be there, and an address is not looked for", () => {
  const words = "Your cart has Kettle x 2 at $39.99, and Batteries, 1 at $12.97.";
  assert.equal(judge({ form: "text", text: words }).shown, "held");
  assert.equal(judge({ form: "text", text: "Your cart has Kettle." }).shown, "failed");
  const withLink: ExpectedExtraction = { step: "s", records: [{ name: "Kettle", url: "/dp/B0" }] };
  assert.equal(judge({ form: "text", text: "Kettle" }, { expected: withLink }).shown, "held");
});

test("a task with acts and no rows: a turn must say an act landed, and a sentence cannot be judged", () => {
  const acts = (state: "landed" | "not_done"): ShownAnswer => ({ form: "turn", turn: { kind: "done_on_site", acts: [{ state }] } });
  assert.equal(judge(acts("landed"), { expected: undefined, askedActs: 1 }).shown, "held");
  assert.equal(judge(acts("not_done"), { expected: undefined, askedActs: 1 }).shown, "failed");
  assert.equal(judge({ form: "text", text: "Done." }, { expected: undefined, askedActs: 1 }).shown, "unjudged");
});

test("the screen: a declared secret in what was shown fails however right the rest is", () => {
  const judged = judge(turn(RECORDS), { secretValues: ["kettle"] });
  assert.equal(judged.shown, "failed");
  assert.equal(judged.secretShown, true);
});
