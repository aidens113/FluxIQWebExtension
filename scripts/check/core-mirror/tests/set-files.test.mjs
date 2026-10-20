import assert from "node:assert/strict";
import test from "node:test";

import { mirrorSetFiles } from "../index.mjs";

test("a directory include covers everything under it, a file include only that file, and excludes win", () => {
  const set = { include: ["a.mjs", "a/"], exclude: ["a/config.mjs", "a/skip/"] };
  const files = ["a/z.mjs", "a.mjs", "a/config.mjs", "a/skip/x.mjs", "ab.mjs", "b/a/x.mjs", "a/b/c.mjs"];
  assert.deepEqual(mirrorSetFiles(set, files), ["a.mjs", "a/b/c.mjs", "a/z.mjs"]);
});
