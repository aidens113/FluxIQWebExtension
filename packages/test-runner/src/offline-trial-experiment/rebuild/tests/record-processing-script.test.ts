import assert from "node:assert/strict";
import test from "node:test";
import { withRecordProcessing } from "../record-processing-script.js";

const script = [
  "flow: list rows",
  "step: open the page",
  "  node: web.browser.navigate",
  "  url: http://example.test/",
  "step rows: read the rows",
  "  node: web.dom-extract_list",
  "  extractList: extraction.1",
  "  recordOutput.columns: [\"a\", \"b\"]",
  "  extractList.minItems: 0",
  "done when: exists t1",
].join("\n");

test("adds the labelled step's processing after its last record-output line, changing nothing else", () => {
  const corrected = withRecordProcessing(script, "rows", { limit: 3 });
  const lines = corrected.split("\n");
  assert.equal(lines.length, script.split("\n").length + 1);
  assert.equal(lines[8], "  recordOutput.process: {\"limit\":3}");
  assert.equal(lines.filter((_, index) => index !== 8).join("\n"), script);
});

test("replaces an existing processing line, and null removes it", () => {
  const once = withRecordProcessing(script, "rows", { limit: 3 });
  const twice = withRecordProcessing(once, "rows", { dedupe: false });
  assert.equal(twice.split("\n")[8], "  recordOutput.process: {\"dedupe\":false}");
  assert.equal(twice.split("\n").length, once.split("\n").length);
  assert.equal(withRecordProcessing(once, "rows", null), script);
});

test("a step with no record-output line gets the processing at the end of its lines", () => {
  const plain = script.replace("  recordOutput.columns: [\"a\", \"b\"]\n", "");
  const lines = withRecordProcessing(plain, "rows", { limit: 1 }).split("\n");
  assert.equal(lines[8], "  recordOutput.process: {\"limit\":1}");
  assert.equal(lines[9], "done when: exists t1");
});

test("an unknown label is refused rather than guessed", () => {
  assert.throws(() => withRecordProcessing(script, "posts", { limit: 1 }), /no step labelled posts/);
});
