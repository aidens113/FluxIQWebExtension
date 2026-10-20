// The keys that make a scroll request unreadable (`../scroll-request-issues.ts`),
// and their agreement with the dispatch reader: a request with no issue is one
// the dispatch reads, and every request it refuses has an issue.

import assert from "node:assert/strict";
import test from "node:test";
import type { JsonValue } from "fluxiq/core";
import { webAutomationActionFromGatewayCommand } from "../../client";
import { webAutomationScrollRequestIssues } from "../scroll-request-issues";

const WRONG: Array<[string, JsonValue, ReturnType<typeof webAutomationScrollRequestIssues>]> = [
  ["untilStable without maxScrolls", { mode: "untilStable" }, [{ key: "maxScrolls", problem: "missing" }]],
  ["untilStable with a zero maxScrolls", { mode: "untilStable", maxScrolls: 0 }, [{ key: "maxScrolls", problem: "invalid" }]],
  ["untilStable with a fractional maxScrolls", { mode: "untilStable", maxScrolls: 2.5 }, [{ key: "maxScrolls", problem: "invalid" }]],
  ["untilStable with a string maxScrolls", { mode: "untilStable", maxScrolls: "12" }, [{ key: "maxScrolls", problem: "invalid" }]],
  ["no mode", { until: "stopsGrowing" }, [{ key: "mode", problem: "missing" }, { key: "until", problem: "unknown" }]],
  ["an unknown mode", { mode: "down" }, [{ key: "mode", problem: "invalid" }]],
  ["a key the request does not have", { mode: "by", y: 640, until: "stopsGrowing" }, [{ key: "until", problem: "unknown" }]],
  ["not an object", "untilStable", [{ key: "scroll", problem: "invalid" }]]
];

const RIGHT: JsonValue[] = [
  { mode: "untilStable", maxScrolls: 12 },
  { mode: "untilStable", maxScrolls: 1, y: 800 },
  { mode: "by", y: 640 },
  { mode: "by", x: 10, y: -20 },
  { mode: "by" },
  { mode: "toElement" },
  // Unchanged for the other modes: `maxScrolls` beside `by` is a key the request has, and the dispatch reads the delta.
  { mode: "by", y: 640, maxScrolls: 3 }
];

function dispatched(scroll: JsonValue): unknown {
  const mapped = webAutomationActionFromGatewayCommand({ commandId: "cmd", actionType: "web.dom.scroll", parameters: { scroll } });
  return "status" in mapped ? undefined : (mapped as { scroll?: unknown }).scroll;
}

test("each unreadable request names the key that makes it so", () => {
  for (const [name, value, issues] of WRONG) assert.deepEqual(webAutomationScrollRequestIssues(value), issues, name);
});

test("a readable request has no issue, in every mode", () => {
  for (const value of RIGHT) assert.deepEqual(webAutomationScrollRequestIssues(value), [], JSON.stringify(value));
});

test("the issues agree with the dispatch reader", () => {
  for (const [name, value] of WRONG) assert.equal(dispatched(value), undefined, `${name}: the dispatch refuses it`);
  for (const value of RIGHT) assert.notEqual(dispatched(value), undefined, `${JSON.stringify(value)}: the dispatch reads it`);
});
