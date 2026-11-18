import assert from "node:assert/strict";
import test from "node:test";

import { findLazyModules } from "../index.mjs";

const lazyBundle = [
  "var __esm = (fn, res) => function __init() {",
  "  return fn && (res = (0, fn[__getOwnPropNames(fn)[0]])(fn = 0)), res;",
  "};",
  "// ../core/packages/contracts/src/iam/predefined-policies.ts",
  "var IAM_PREDEFINED_POLICIES;",
  "var init_predefined_policies = __esm({",
  "  \"../core/packages/contracts/src/iam/predefined-policies.ts\"() {",
  "    IAM_PREDEFINED_POLICIES = Object.freeze([]);",
  "  }",
  "});",
  "var init_iam = __esm({",
  "  \"../core/packages/contracts/src/iam/index.ts\"() {",
  "    init_predefined_policies();",
  "  }",
  "});"
].join("\n");

test("each lazily started module is named by its path, in bundle order", () => {
  assert.deepEqual(findLazyModules(lazyBundle), [
    "../core/packages/contracts/src/iam/predefined-policies.ts",
    "../core/packages/contracts/src/iam/index.ts"
  ]);
});

test("a bundle whose modules all start in import order has none", () => {
  const eager = "// src/flat.js\nvar FOUND = LIST.find((x) => x === \"a\");\nexport { FOUND };\n";
  assert.deepEqual(findLazyModules(eager), []);
});

test("esbuild's helper definition alone is not a wrapped module", () => {
  assert.deepEqual(findLazyModules("var __esm = (fn, res) => function __init() {\n  return res;\n};\n"), []);
});
