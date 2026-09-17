import assert from "node:assert/strict";
import path from "node:path";
import test from "node:test";
import { resolvePairRoots } from "../roots.mjs";

const REPOSITORY = path.resolve("F:/!FluxIQWebExtension");
const manifest = (fluxiq) => async () => JSON.stringify({ dependencies: { fluxiq } });

test("by default the pair is fxlab/lab-ext beside this checkout, with Core where its domain links", async () => {
  const read = [];
  const roots = await resolvePairRoots({ repositoryRoot: REPOSITORY, extRoot: null, readText: async (file) => { read.push(file); return manifest("link:../../!FluxIQ/packages/fluxiq")(); } });
  assert.deepEqual(roots, { extRoot: path.resolve("F:/fxlab/lab-ext"), coreRoot: path.resolve("F:/fxlab/!FluxIQ") });
  assert.deepEqual(read, [path.join(path.resolve("F:/fxlab/lab-ext"), "domain", "package.json")]);
});

test("an explicit extension root is used, and Core follows its link", async () => {
  const roots = await resolvePairRoots({ repositoryRoot: REPOSITORY, extRoot: "D:/labs/one/ext", readText: manifest("link:../../core-copy/packages/fluxiq") });
  assert.deepEqual(roots, { extRoot: path.resolve("D:/labs/one/ext"), coreRoot: path.resolve("D:/labs/one/core-copy") });
});

test("the checkout this script runs from cannot be the pair, in any spelling", async () => {
  const spelling = process.platform === "win32" ? "f:\\!fluxiqwebextension\\" : REPOSITORY;
  await assert.rejects(resolvePairRoots({ repositoryRoot: REPOSITORY, extRoot: spelling, readText: manifest("link:../../x/packages/fluxiq") }), /separate checkout/u);
});

test("a pair whose Core side would be the working Core checkout is refused", async () => {
  await assert.rejects(
    resolvePairRoots({ repositoryRoot: REPOSITORY, extRoot: "F:/lab-ext", readText: manifest("link:../../!FluxIQ/packages/fluxiq") }),
    /working Core checkout/u,
  );
});

test("a directory that is not a checkout, or a domain that does not link Core, is refused", async () => {
  await assert.rejects(resolvePairRoots({ repositoryRoot: REPOSITORY, extRoot: "F:/nowhere", readText: async () => { throw Object.assign(new Error("missing"), { code: "ENOENT" }); } }), /not a checkout of this repository/u);
  await assert.rejects(resolvePairRoots({ repositoryRoot: REPOSITORY, extRoot: "F:/fxlab/lab-ext", readText: manifest("^0.6.0") }), /does not depend on fluxiq through link:/u);
  await assert.rejects(resolvePairRoots({ repositoryRoot: REPOSITORY, extRoot: "F:/fxlab/lab-ext", readText: async () => "{}" }), /found null/u);
  await assert.rejects(resolvePairRoots({ repositoryRoot: REPOSITORY, extRoot: "F:/fxlab/lab-ext", readText: manifest("link:../../!FluxIQ/fluxiq") }), /not <core>\/packages\/fluxiq/u);
});
