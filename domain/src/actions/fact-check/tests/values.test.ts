// Coverage of the fact check's wire readers: a result is rebuilt field by
// field and bounded, a request query is rebuilt per kind, and an unreadable
// entry keeps its slot so answers stay aligned with claims.

import assert from "node:assert/strict";
import test from "node:test";
import { WEB_AUTOMATION_FACT_EXCERPT_MAX } from "../answer";
import { webAutomationFactCheckResultValue } from "../answer-value";
import { webAutomationFactCheckRequestValue, webAutomationFactQueryValue } from "../request-value";

test("a result keeps only the declared, bounded evidence", () => {
  const result = webAutomationFactCheckResultValue({
    answers: [{
      result: "true",
      capturedAt: 5,
      evidence: {
        element: { tagName: "input", accessibleName: "Search", value: "hunter2", attributes: { type: "password" } },
        excerpt: "x".repeat(500),
        reason: "made-up",
        dialogKind: "newsletter",
        count: 2,
        snapshot: { html: "<p>page</p>" }
      },
      extra: "nope"
    }],
    document: { url: "https://shop.test/", readyState: "complete", timeOrigin: 9, cookies: "a=b" }
  }, 1);
  assert.deepEqual(Object.keys(result?.answers[0] ?? {}).sort(), ["capturedAt", "evidence", "result"]);
  const evidence = result?.answers[0]?.evidence;
  assert.deepEqual(evidence?.element, { tagName: "input", accessibleName: "Search" });
  assert.equal(evidence?.excerpt?.length, WEB_AUTOMATION_FACT_EXCERPT_MAX);
  assert.equal(evidence?.reason, undefined);
  assert.equal(evidence?.dialogKind, undefined);
  assert.equal(evidence?.count, 2);
  assert.deepEqual(result?.document, { url: "https://shop.test/", readyState: "complete", timeOrigin: 9 });
});

test("an unreadable answer is unknown in its slot, and a result with no answer list is none", () => {
  const result = webAutomationFactCheckResultValue({ answers: [{ result: "maybe" }, null, { result: "false", capturedAt: 3 }] }, 7);
  assert.deepEqual(result?.answers, [
    { result: "unknown", evidence: { reason: "capture_failed" }, capturedAt: 7 },
    { result: "unknown", evidence: { reason: "capture_failed" }, capturedAt: 7 },
    { result: "false", capturedAt: 3 }
  ]);
  assert.equal(webAutomationFactCheckResultValue({ answer: [] }), undefined);
  assert.equal(webAutomationFactCheckResultValue("answers"), undefined);
});

test("each query kind is rebuilt, and one that names nothing askable stays an empty slot", () => {
  const reading = webAutomationFactCheckRequestValue({
    documentTimeOrigin: 12,
    queries: [
      { kind: "exists", target: { selector: "#a" }, expected: false, frameId: 2 },
      { kind: "text", comparison: "contains", expected: "Hi" },
      { kind: "value", target: { selector: "#q" }, comparison: "equals", expected: "earbuds" },
      { kind: "count", target: { selector: "li" }, comparison: ">=", expected: 3 },
      { kind: "dialog", expected: true, dialogKind: "consent", nameContains: "cookies" },
      { kind: "visible", target: {}, expected: true },
      { kind: "count", target: { element: { tagName: "li" } }, comparison: "=", expected: 1 },
      { kind: "dialog", expected: true, dialogKind: "newsletter" },
      { kind: "url", comparison: "near", expected: "/x" }
    ]
  });
  assert.equal(reading?.documentTimeOrigin, 12);
  assert.deepEqual(reading?.queries.slice(0, 5), [
    { kind: "exists", target: { selector: "#a" }, expected: false, frameId: 2 },
    { kind: "text", comparison: "contains", expected: "Hi" },
    { kind: "value", target: { selector: "#q" }, comparison: "equals", expected: "earbuds" },
    { kind: "count", target: { selector: "li" }, comparison: ">=", expected: 3 },
    { kind: "dialog", expected: true, dialogKind: "consent", nameContains: "cookies" }
  ]);
  assert.deepEqual(reading?.queries.slice(5), [undefined, undefined, undefined, undefined]);
  assert.equal(webAutomationFactCheckRequestValue({ queries: "all" }), undefined);
  assert.equal(webAutomationFactQueryValue({ kind: "checked", target: { selector: "#a" }, expected: "yes" }), undefined);
});
