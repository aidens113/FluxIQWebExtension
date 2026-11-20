import assert from "node:assert/strict";
import test from "node:test";
import type { JsonObject } from "fluxiq/core";
import type { WebAutomationExtractionProposal } from "../../../../../extraction";
import { sanitizeWebLlmSnapshotWithBindings } from "../../../sanitize";
import { webLlmCaptureWalk } from "../walk";

const CONTAINER = "div.week";
const SCOPED_GROUP = `${CONTAINER} > div.day`;

function headings(nested: boolean, group: string): unknown {
  const elements: JsonObject[] = [
    { tagName: "div", selector: "div.outer", attributes: { class: "day" } },
    { tagName: "h2", selector: "div.outer > h2", visibleText: "Outside", parent: 0 },
    { tagName: "div", selector: CONTAINER, attributes: { class: "week" }, parent: 0 }
  ];
  let parent = 2;
  if (nested) {
    elements.push(
      { tagName: "div", selector: SCOPED_GROUP, attributes: { class: "day" }, parent: 2 },
      { tagName: "h2", selector: `${SCOPED_GROUP} > h2`, visibleText: "Direct day", parent: 3 },
      { tagName: "div", selector: `${SCOPED_GROUP} > div.day`, attributes: { class: "day" }, parent: 3 },
      { tagName: "h2", selector: `${SCOPED_GROUP} > div.day > h2`, visibleText: "Nested day", parent: 5 }
    );
    parent = 5;
  }
  elements.push({ tagName: "button", selector: "button.time", attributes: { class: "time" }, visibleText: "09:00", parent });
  const binding = sanitizeWebLlmSnapshotWithBindings({ url: "https://capture.test/calendar", interactiveElements: elements });
  const proposal: WebAutomationExtractionProposal = { container: CONTAINER, item: `${CONTAINER} button.time`, itemCount: 1, confidence: 1, fields: [] };
  const walk = webLlmCaptureWalk(proposal, binding);
  assert.equal(walk.items.length, 1);
  return walk.elementsOf(walk.items[0]!, { kind: "text", group, selector: ":scope > h2" })?.map((node) => node.element.text);
}

test("a container-scoped group never adopts a matching ancestor outside that container", () => {
  assert.deepEqual(headings(false, SCOPED_GROUP), []);
});

test("a direct-child group selector skips a nested matching ancestor", () => {
  assert.deepEqual(headings(true, SCOPED_GROUP), ["Direct day"]);
});

test("an unscoped group retains the browser's nearest matching ancestor behavior", () => {
  assert.deepEqual(headings(false, "div.day"), ["Outside"]);
  assert.deepEqual(headings(true, "div.day"), ["Nested day"]);
});
