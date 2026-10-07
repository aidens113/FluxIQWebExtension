// The staged panel build must resolve Core's packages through their package
// exports, which point at the stamped `dist`, never through Core's own
// `paths` aliases into `packages/*/src`. Turbopack honours tsconfig `paths`,
// and a panel compiled from source carries the unstamped runtime identity
// placeholder, so every Lab run's identity check answered 400 (t342, B1).
import assert from "node:assert/strict";
import { mkdir, mkdtemp, readFile, rm, writeFile } from "node:fs/promises";
import os from "node:os";
import path from "node:path";
import test from "node:test";
import { RunnerFailure } from "../../failure.js";
import { stagedTsconfigBase } from "../staged-tsconfig.js";
import { prepareWebWorkspace } from "../workspace.js";

// The shape of Core's real `tsconfig.base.json` on 2026-10-07.
const coreTsconfig = JSON.stringify({
  compilerOptions: {
    target: "ES2022",
    strict: true,
    baseUrl: ".",
    paths: {
      "@fluxiq/contracts": ["packages/contracts/src/index.ts"],
      "@fluxiq/contracts/*": ["packages/contracts/src/*.ts"],
      fluxiq: ["packages/fluxiq/src/index.ts"],
      "fluxiq/automation-studio": ["packages/fluxiq/src/programs/automation-studio/index.ts"],
      "fluxiq/*": ["./packages/fluxiq/src/*/index.ts"],
      "@app/*": ["apps/web/src/*"],
    },
  },
}, null, 2);

test("every alias into a Core package's source is removed, and nothing else changes", () => {
  const staged = JSON.parse(stagedTsconfigBase(coreTsconfig)) as { compilerOptions: Record<string, unknown> };
  assert.deepEqual(staged.compilerOptions.paths, { "@app/*": ["apps/web/src/*"] });
  assert.equal(staged.compilerOptions.target, "ES2022");
  assert.equal(staged.compilerOptions.strict, true);
  assert.equal(staged.compilerOptions.baseUrl, ".");
});

test("a paths map left empty is dropped rather than written as {}", () => {
  const only = JSON.stringify({ compilerOptions: { strict: true, paths: { fluxiq: ["packages/fluxiq/src/index.ts"] } } });
  assert.deepEqual(JSON.parse(stagedTsconfigBase(only)), { compilerOptions: { strict: true } });
});

test("a tsconfig with no paths is staged unchanged in meaning", () => {
  assert.deepEqual(JSON.parse(stagedTsconfigBase('{ "compilerOptions": { "strict": true } }')), { compilerOptions: { strict: true } });
});

test("a tsconfig that is not plain JSON fails closed instead of being copied with its aliases", () => {
  assert.throws(() => stagedTsconfigBase('{ // a comment\n "compilerOptions": {} }'), (error: unknown) => {
    assert.ok(error instanceof RunnerFailure);
    assert.equal(error.category, "environment.missing");
    assert.match(error.message, /tsconfig\.base\.json/u);
    return true;
  });
});

test("real workspace staging writes the staged tsconfig, not Core's verbatim copy", async () => {
  const root = await mkdtemp(path.join(os.tmpdir(), "core-web-build-tsconfig-"));
  try {
    const files: Record<string, string> = {
      "tsconfig.base.json": coreTsconfig,
      "apps/web/package.json": "{}\n",
      "apps/web/node_modules/next/package.json": "{}\n",
      "node_modules/@types/node/index.d.ts": "types\n",
      "packages/fluxiq/package.json": "{}\n",
    };
    for (const [relative, content] of Object.entries(files)) {
      const file = path.join(root, ...relative.split("/"));
      await mkdir(path.dirname(file), { recursive: true });
      await writeFile(file, content, "utf8");
    }
    await prepareWebWorkspace(root, path.join(root, "isolated", "apps", "web"));
    const staged = JSON.parse(await readFile(path.join(root, "isolated", "tsconfig.base.json"), "utf8")) as { compilerOptions: { paths?: Record<string, string[]> } };
    assert.deepEqual(staged.compilerOptions.paths, { "@app/*": ["apps/web/src/*"] });
    assert.equal(await readFile(path.join(root, "tsconfig.base.json"), "utf8"), coreTsconfig, "Core's own tsconfig is left as it was");
  } finally {
    await rm(root, { recursive: true, force: true });
  }
});
