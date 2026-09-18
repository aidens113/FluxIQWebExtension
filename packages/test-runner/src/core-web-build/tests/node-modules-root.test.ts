import assert from "node:assert/strict";
import path from "node:path";
import test from "node:test";
import { insideNodeModules } from "../node-modules-root.js";

test("a cache root with a node_modules segment anywhere in it is recognised", () => {
  assert.equal(insideNodeModules("F:/fxwork/!FluxIQ/node_modules/.core-web-build"), true);
  assert.equal(insideNodeModules(path.win32.join("F:", "t013ab", "node_modules", "cwb")), true, "Windows separators");
  assert.equal(insideNodeModules("F:/x/NODE_MODULES/cwb"), true, "Windows paths are case-insensitive");
});

test("a name that merely contains the word is not node_modules", () => {
  assert.equal(insideNodeModules("F:/t013ab/plain_modules/cwb"), false);
  assert.equal(insideNodeModules("F:/fxwork/!FluxIQ/.tmp/core-web-build"), false);
  assert.equal(insideNodeModules("F:/my-node_modules-notes/cwb"), false);
});
