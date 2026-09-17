import assert from "node:assert/strict";
import test from "node:test";
import { pathInside, samePath } from "../path-identity.mjs";

test("a trailing separator does not make a different directory", () => {
  assert.equal(samePath("F:/fxlab/lab-ext/", "F:/fxlab/lab-ext"), true);
  assert.equal(samePath("F:/fxlab/lab-ext", "F:/fxlab/lab-ext-2"), false);
});

test("on Windows, case and slash direction do not make a different directory", { skip: process.platform !== "win32" }, () => {
  assert.equal(samePath("f:\\FXLAB\\Lab-Ext", "F:/fxlab/lab-ext"), true);
  assert.equal(pathInside("F:\\FXLAB\\!fluxiq\\packages\\fluxiq", "F:/fxlab/!FluxIQ"), true);
});

test("inside means the directory itself or below it, never a sibling sharing a prefix", () => {
  assert.equal(pathInside("F:/fxlab/!FluxIQ/packages/fluxiq", "F:/fxlab/!FluxIQ"), true);
  assert.equal(pathInside("F:/fxlab/!FluxIQ", "F:/fxlab/!FluxIQ"), true);
  assert.equal(pathInside("F:/fxlab/!FluxIQ-old/packages/fluxiq", "F:/fxlab/!FluxIQ"), false);
  assert.equal(pathInside("F:/!FluxIQ/packages/fluxiq", "F:/fxlab/!FluxIQ"), false);
});
