import assert from "node:assert/strict";
import test from "node:test";
import { sanitizeWebLlmSnapshotWithBindings } from "../../sanitize";
import { webLlmTargetsUnchanged } from "../stability";

function binding(url: string, elements: Array<Record<string, unknown>>) {
  return sanitizeWebLlmSnapshotWithBindings({ url, title: "Fixture", interactiveElements: elements });
}

const search = { tagName: "input", selector: "#search", accessibleName: "Search", inputType: "search" };
const submit = { tagName: "button", selector: "#submit", accessibleName: "Submit" };

test("targets stay unchanged when existing handles retain their selectors", () => {
  const before = binding("https://example.test/form", [search]);
  const after = binding("https://example.test/form", [search, submit]);

  assert.equal(webLlmTargetsUnchanged(before, after), true);
});

test("a removed or rebound handle makes the target set unsafe", () => {
  const before = binding("https://example.test/form", [search, submit]);
  const removed = binding("https://example.test/form", [search]);
  const rebound = binding("https://example.test/form", [
    { ...search, selector: "#replacement" },
    submit
  ]);

  assert.equal(webLlmTargetsUnchanged(before, removed), false);
  assert.equal(webLlmTargetsUnchanged(before, rebound), false);
});

test("the same handles on another page are not unchanged targets", () => {
  const before = binding("https://example.test/form", [search]);
  const after = binding("https://example.test/other", [search]);

  assert.equal(webLlmTargetsUnchanged(before, after), false);
});
