// src/output-nodes/extract-list/tests/catalog-text.test.ts
import assert from "node:assert/strict";
import test from "node:test";

// src/actions/extraction/request.ts
var WEB_AUTOMATION_EXTRACT_FIELD_KINDS = ["text", "attribute", "link", "value", "column"];
var WEB_AUTOMATION_EXTRACT_MAX_PAGES = 50;
var WEB_AUTOMATION_EXTRACT_MAX_ITEMS = 1e3;

// src/actions/extraction/read-request.ts
var REFUSED = Symbol("refused");

// src/output-nodes/extract-list/catalog-text.ts
var WEB_AUTOMATION_EXTRACT_LIST_DESCRIPTION = [
  "Scrape every item of a repeating list or table into a dataset, across pages.",
  "Detect the list with web.detect_repeating_structure; name it in extractList by its handle.",
  "It saves its rows itself: no recordOutput or save node needed."
].join(" ");
var WEB_AUTOMATION_EXTRACT_LIST_GRAMMAR = [
  `Detected: {handle: "extraction.N", fields?: {key: "detectedKey" | "detectedKey@href"}, paginate?: false (this page only)};`,
  "fields: only those columns, renamed; a link column reads the absolute URL, @href the raw href.",
  `Else {item: css, fields: {key: "css" | "css@attr" | "column:Header" | {kind: ${WEB_AUTOMATION_EXTRACT_FIELD_KINDS.join("|")}, selector?, attribute?, header?, required?: false}},`,
  `paginate?: {mode: "next", next: css, maxPages} ("loadMore": control, "numbered": pages) | {mode: "scroll", maxScrolls}, max ${WEB_AUTOMATION_EXTRACT_MAX_PAGES}}.`,
  `Keys A-Za-z0-9_-. Both take minItems (default 1; 0 allows none), maxItems (max ${WEB_AUTOMATION_EXTRACT_MAX_ITEMS}).`
].join(" ");

// src/output-nodes/extract-list/tests/catalog-text.test.ts
test("the node says to detect the list, name it by its handle, and that it saves its own rows", () => {
  assert.match(WEB_AUTOMATION_EXTRACT_LIST_DESCRIPTION, /web\.detect_repeating_structure/u);
  assert.match(WEB_AUTOMATION_EXTRACT_LIST_DESCRIPTION, /extractList by its handle/u);
  assert.match(WEB_AUTOMATION_EXTRACT_LIST_DESCRIPTION, /saves its rows itself: no recordOutput or save node needed/u);
  assert.equal(WEB_AUTOMATION_EXTRACT_LIST_DESCRIPTION.length <= 240, true, `${WEB_AUTOMATION_EXTRACT_LIST_DESCRIPTION.length} characters`);
});
test("the grammar leads with the handle form, and says how to keep, rename and read columns and pages", () => {
  const grammar = WEB_AUTOMATION_EXTRACT_LIST_GRAMMAR;
  assert.equal(grammar.length <= 600, true, `${grammar.length} characters`);
  for (const term of ['handle: "extraction.N"', 'fields?: {key: "detectedKey" | "detectedKey@href"}', "paginate?: false (this page only)", "renamed", "absolute URL", "raw href"]) {
    assert.equal(grammar.includes(term), true, `the grammar does not say ${term}`);
  }
  assert.equal(grammar.indexOf("handle") < grammar.indexOf("item: css"), true, "the handle form comes before the literal request");
  assert.match(grammar, /Both take minItems \(default 1; 0 allows none\), maxItems/u);
});
