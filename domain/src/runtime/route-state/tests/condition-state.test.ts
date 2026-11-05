// A condition reads the bare control names: a heading's words never satisfy it (t869).
import assert from "node:assert/strict";
import test from "node:test";
import { webAutomationRouteConditionState } from "..";
import { webRouteControlsLine } from "../controls-line";

const line = (headingOf: string | undefined) => webRouteControlsLine([
  { name: "Search" },
  { name: "Dining table", heading: headingOf },
  { name: "Small table", heading: headingOf }
]);
const read = (controls: string): string => String((webAutomationRouteConditionState({ page: { controls } }).page as { controls: string }).controls);

test("a heading's words are not in what a condition reads", () => {
  const marked = line("Sold out");
  assert.ok(marked.includes("[Sold out]"));
  const read_ = read(marked);
  assert.equal(read_.includes("Sold out"), false);
});

test("a control holding the words is still found", () => {
  const read_ = read(webRouteControlsLine([{ name: "Sold out: Dining table", heading: "Results" }]));
  assert.equal(read_.includes("Sold out"), true);
});

test("the line a condition reads is the line before headings, so equals and matches read it whole", () => {
  const read_ = read(line("Results outside your search"));
  assert.equal(read_, "Search | Dining table | Small table");
  assert.equal(read_ === "Search | Dining table | Small table", true);
  assert.equal(/^Search \| Dining/u.test(read_), true);
  assert.equal(read_.startsWith("["), false);
});

test("other keys and a state with no controls are returned as they are", () => {
  const state = { page: { path: "/a", dialog: "[x] Cookie" } };
  assert.deepEqual(webAutomationRouteConditionState(state), state);
  assert.deepEqual(webAutomationRouteConditionState({}), {});
});
