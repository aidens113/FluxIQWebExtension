import assert from "node:assert/strict";
import test from "node:test";
import { declarationInRunTerms } from "../model-aliases.js";

const call = (fields: Record<string, string>) => ({ node: "fixture.read", parameters: { extractList: { handle: "extraction.1", fields } } });

test("a detected key every read gave one model key is named by that key; columns asked by name stay", () => {
  const declared = { where: [{ field: "member_badge", is: "present" }, { field: "rate", lessThan: 90 }], sort: [{ field: "rate", order: "asc" }], columns: ["title", "rate"] };
  const result = declarationInRunTerms(declared, [call({ title: "h3_span", rate: "span_amount", badge: "member_badge" }), call({ title: "h3_span", rate: "span_amount", badge: "member_badge@title" })]);
  assert.deepEqual(result.process.where, [{ field: "badge", is: "present" }, { field: "rate", lessThan: 90 }]);
  assert.deepEqual(result.process.columns, ["title", "rate"]);
  assert.deepEqual(result.rewritten, { member_badge: "badge" });
  assert.deepEqual(declared.where[0], { field: "member_badge", is: "present" });
});

test("a detected key the reads named two ways is left as written for Core's strict binding to refuse", () => {
  const result = declarationInRunTerms({ where: [{ field: "member_badge", is: "present" }] }, [call({ badge: "member_badge" }), call({ member: "member_badge" })]);
  assert.deepEqual(result.process.where, [{ field: "member_badge", is: "present" }]);
  assert.deepEqual(result.rewritten, {});
});
