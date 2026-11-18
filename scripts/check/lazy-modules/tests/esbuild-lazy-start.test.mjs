// The shape that crashed the domain setup bundle on 2026-11-17, built with the
// repository's own esbuild: a module that runs at once imports a value through
// two side-effect-free `export *` files, and a dynamic import() elsewhere
// reaches the same value, so a one-file bundle starts it lazily.
import assert from "node:assert/strict";
import { mkdir, mkdtemp, readdir, readFile, rm, writeFile } from "node:fs/promises";
import { createRequire } from "node:module";
import os from "node:os";
import path from "node:path";
import test from "node:test";
import { fileURLToPath, pathToFileURL } from "node:url";

import { assertEagerBundle } from "../index.mjs";

const repositoryRoot = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..", "..", "..", "..");
const esbuildEntry = createRequire(path.join(repositoryRoot, "domain", "package.json")).resolve("esbuild");

const fixture = {
  "node_modules/pkg/package.json": JSON.stringify({ name: "pkg", type: "module", sideEffects: false, exports: { "./iam": "./iam.js", "./platform": "./platform.js" } }),
  "node_modules/pkg/iam.js": "export * from \"./iam/index.js\";\n",
  "node_modules/pkg/iam/index.js": "export * from \"./list.js\";\n",
  "node_modules/pkg/iam/list.js": "export const LIST = Object.freeze([\"a\", \"b\"]);\n",
  "node_modules/pkg/platform.js": "import { LIST } from \"./iam/index.js\";\nexport const size = () => LIST.length;\n",
  "src/flat.js": "import { LIST } from \"pkg/iam\";\nexport const FOUND = LIST.find((item) => item === \"a\");\n",
  "src/lazy.js": "import { size } from \"pkg/platform\";\nexport const lazy = () => size();\n",
  "src/entry.js": "export { FOUND } from \"./flat.js\";\nexport const later = () => import(\"./lazy.js\");\n"
};

async function withFixture(run) {
  const directory = await mkdtemp(path.join(os.tmpdir(), "lazy-start-"));
  try {
    for (const [file, text] of Object.entries(fixture)) {
      await mkdir(path.dirname(path.join(directory, file)), { recursive: true });
      await writeFile(path.join(directory, file), text);
    }
    const { build } = await import(pathToFileURL(esbuildEntry).href);
    await run({ directory, build });
  } finally {
    await rm(directory, { recursive: true, force: true });
  }
}

const common = (directory) => ({ entryPoints: [path.join(directory, "src", "entry.js")], bundle: true, platform: "node", format: "esm", logLevel: "silent" });

test("a one-file bundle of that shape starts modules lazily, and the check refuses it", async () => {
  await withFixture(async ({ directory, build }) => {
    const outfile = path.join(directory, "single", "entry.mjs");
    await build({ ...common(directory), outfile });
    const text = await readFile(outfile, "utf8");
    assert.throws(() => assertEagerBundle("one-file bundle", [{ file: outfile, text }]), /one-file bundle: esbuild set \d+ module\(s\) to start lazily/);
  });
});

test("the same code split into chunks starts nothing lazily and runs", async () => {
  await withFixture(async ({ directory, build }) => {
    const outdir = path.join(directory, "split");
    await build({ ...common(directory), outdir, splitting: true, outExtension: { ".js": ".mjs" } });
    const bundles = [];
    for (const name of await readdir(outdir)) bundles.push({ file: name, text: await readFile(path.join(outdir, name), "utf8") });
    assert.doesNotThrow(() => assertEagerBundle("split bundle", bundles));
    const entry = await import(pathToFileURL(path.join(outdir, "entry.mjs")).href);
    assert.equal(entry.FOUND, "a");
    assert.equal(await (await entry.later()).lazy(), 2);
  });
});
