import assert from "node:assert/strict";
import test from "node:test";
import { loadCoreAuthoring } from "../core-authoring.js";
import { scriptExtractNodes } from "../script-extract-nodes.js";
import { webAuthoringSurroundings } from "../web-authoring-surroundings.js";

// The resolved Core and domain builds still provide the authoring pieces the
// rebuild loads beside their public entries, and the library a script is read
// against knows the web domain's read.

test("loads Core's scope, scoped controller and assembly, and the domain's condition reader", async () => {
  const authoring = await loadCoreAuthoring();
  for (const piece of [authoring.dispatchScope, authoring.scopedController, authoring.assembleLatest, authoring.extractionConditions]) assert.equal(typeof piece, "function");
  const read = authoring.extractionConditions([{ field: "group", equals: ["x"] }], { detected: {}, kept: { group: { kind: "text", selector: "a", required: false } } }, ["where"]);
  assert.equal(read.ok, true);
});

test("counts a script's reads as Core's acceptor reads it", () => {
  const script = [
    "flow: count the reads",
    "step: open the page",
    "  node: web.browser.navigate",
    "  url: http://127.0.0.1:1/list",
    "step rows: read the rows",
    "  node: web.dom-extract_list",
    "  extractList: extraction.1",
    "  extractList.fields: {\"name\": \"col_a\"}",
  ].join("\n");
  const surroundings = webAuthoringSurroundings();
  assert.equal(scriptExtractNodes(script, surroundings), 1);
  assert.equal(scriptExtractNodes("not a script", surroundings), null);
});
