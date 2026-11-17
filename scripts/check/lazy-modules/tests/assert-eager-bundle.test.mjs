import assert from "node:assert/strict";
import { mkdtemp, rm, writeFile } from "node:fs/promises";
import os from "node:os";
import path from "node:path";
import test from "node:test";

import { assertEagerBundle, assertEagerFiles } from "../index.mjs";

const wrapped = (module) => `var init_x = __esm({\n  "${module}"() {\n  }\n});\n`;

test("a bundle with no lazily started module passes", () => {
  assert.doesNotThrow(() => assertEagerBundle("setup bundle", [{ file: "out/a.mjs", text: "var a = 1;\n" }]));
});

test("a lazily started module fails the build, naming the bundle, the module, its file and the fix", () => {
  assert.throws(
    () => assertEagerBundle("setup bundle", [{ file: "out/a.mjs", text: wrapped("../core/src/iam/index.ts") }]),
    (error) => {
      assert.ok(error.message.startsWith("setup bundle: esbuild set 1 module(s) to start lazily"), error.message);
      assert.ok(error.message.includes("../core/src/iam/index.ts (in out/a.mjs)"), error.message);
      assert.ok(error.message.includes("splitting: true"), error.message);
      return true;
    }
  );
});

test("the message lists five modules and counts the rest", () => {
  const text = Array.from({ length: 7 }, (_, index) => wrapped(`m${index}.ts`)).join("");
  assert.throws(() => assertEagerBundle("host", [{ file: "host.mjs", text }]), (error) => {
    assert.ok(error.message.includes("esbuild set 7 module(s)"), error.message);
    assert.ok(error.message.includes("m4.ts"), error.message);
    assert.ok(!error.message.includes("m5.ts"), error.message);
    assert.ok(error.message.includes("...and 2 more"), error.message);
    return true;
  });
});

test("a written bundle is read from disk and judged the same way", async () => {
  const directory = await mkdtemp(path.join(os.tmpdir(), "lazy-modules-"));
  try {
    const eager = path.join(directory, "eager.mjs");
    const lazy = path.join(directory, "lazy.mjs");
    await writeFile(eager, "var a = 1;\n");
    await writeFile(lazy, wrapped("pkg/index.js"));
    await assertEagerFiles("eager bundle", [eager]);
    await assert.rejects(assertEagerFiles("lazy bundle", [eager, lazy]), /lazy bundle: esbuild set 1 module/);
  } finally {
    await rm(directory, { recursive: true, force: true });
  }
});
