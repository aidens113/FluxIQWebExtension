// Coverage of evaluate.ts: a batch is answered in order from one pass; a
// document other than the one asked about answers everything unknown; a
// claim whose reading throws is unknown on its own; an unreadable claim keeps
// its slot.

import assert from "node:assert/strict";
import test from "node:test";
import type { FactPage } from "../fact-page";
import { evaluateFactBatch } from "../evaluate";

const AT = 1_760_000_000_000;

function page(overrides: Partial<FactPage> = {}): FactPage {
  return {
    document: () => ({ url: "https://shop.test/s?k=earbuds", readyState: "complete", timeOrigin: 100 }),
    resolve: () => ({ outcome: "found", element: { element: "x" } }),
    count: () => 2,
    visible: () => true,
    enabled: () => true,
    text: () => ({ read: "Spin to win" }),
    values: () => ({ read: ["earbuds"] }),
    checked: () => true,
    selected: () => true,
    describe: () => ({ tagName: "input" }),
    dialogs: () => [{ name: "Spin to win" }],
    ...overrides
  };
}

test("a batch is answered in order, and the document it was judged in is said", () => {
  const result = evaluateFactBatch({
    queries: [
      { kind: "dialog", expected: true },
      { kind: "value", target: { selector: "#q" }, comparison: "equals", expected: "kettle" },
      undefined
    ],
    documentTimeOrigin: 100
  }, page(), () => AT);
  assert.deepEqual(result.answers.map((answer) => answer.result), ["true", "false", "unknown"]);
  assert.equal(result.answers[2]?.evidence?.reason, "unsupported");
  assert.deepEqual(result.document, { url: "https://shop.test/s?k=earbuds", readyState: "complete", timeOrigin: 100 });
});

test("a stale document answers every claim unknown, whatever the page shows", () => {
  const result = evaluateFactBatch({ queries: [{ kind: "dialog", expected: true }, { kind: "url", comparison: "contains", expected: "/s" }], documentTimeOrigin: 99 }, page(), () => AT);
  assert.deepEqual(result.answers.map((answer) => [answer.result, answer.evidence?.reason]), [["unknown", "stale_document"], ["unknown", "stale_document"]]);
});

test("a capture that throws is unknown for that claim alone", () => {
  const result = evaluateFactBatch({
    queries: [
      { kind: "count", target: { selector: "li[" }, comparison: ">", expected: 0 },
      { kind: "exists", target: { selector: "#q" }, expected: true }
    ]
  }, page({ count: () => { throw new SyntaxError("not a valid selector"); } }), () => AT);
  assert.deepEqual(result.answers.map((answer) => [answer.result, answer.evidence?.reason]), [["unknown", "capture_failed"], ["true", undefined]]);
});

test("no wait: the batch is answered synchronously", () => {
  const value = evaluateFactBatch({ queries: [{ kind: "dialog", expected: false }] }, page(), () => AT);
  assert.ok(!(value instanceof Promise));
  assert.equal(value.answers[0]?.result, "false");
});
