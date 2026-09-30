// Collecting a Core checkout's build inputs: every file a build depends on
// moves the key, and the files a staged workspace leaves out do not -- nor
// does a Core commit that touches only files outside those inputs.
import assert from "node:assert/strict";
import { mkdir, mkdtemp, rm, writeFile } from "node:fs/promises";
import os from "node:os";
import path from "node:path";
import test from "node:test";
import { RunnerFailure } from "../../failure.js";
import { collectCoreWebBuildInputs } from "../inputs.js";
import { coreWebBuildKey } from "../key.js";

const manifest = JSON.stringify({ exports: { ".": "./dist/index.js" } });
const checkout: Readonly<Record<string, string>> = {
  "tsconfig.base.json": "{}\n",
  "pnpm-lock.yaml": "lockfileVersion: '9.0'\n",
  "package.json": JSON.stringify({ name: "fluxiq-root" }),
  "docs/architecture/overview.md": "# Overview\n",
  "apps/web/package.json": "{}\n",
  "apps/web/src/app/page.tsx": "export default function Page() { return null; }\n",
  "apps/web/next.config.ts": "export default {};\n",
  "apps/web/.next/BUILD_ID": "an-earlier-build\n",
  "apps/web/test-results/result.txt": "an earlier result\n",
  "apps/web/node_modules/next/package.json": JSON.stringify({ version: "15.5.23" }),
  "apps/web/node_modules/react/index.js": "react\n",
  "packages/client-gateway-websocket/package.json": manifest,
  "packages/client-gateway-websocket/dist/index.js": "gateway\n",
  "packages/contracts/package.json": manifest,
  "packages/contracts/dist/index.js": "contracts\n",
  "packages/fluxiq/package.json": manifest,
  "packages/fluxiq/dist/index.js": "fluxiq\n",
  "packages/fluxiq/src/index.ts": "export const fluxiq = 1;\n",
  "packages/fluxiq/src/tests/index.test.ts": "test('fluxiq', () => {});\n",
};

async function withCheckout<T>(overrides: Record<string, string>, run: (root: string) => Promise<T>): Promise<T> {
  const root = await mkdtemp(path.join(os.tmpdir(), "core-web-build-inputs-"));
  try {
    for (const [relative, content] of Object.entries({ ...checkout, ...overrides })) {
      const file = path.join(root, ...relative.split("/"));
      await mkdir(path.dirname(file), { recursive: true });
      await writeFile(file, content, "utf8");
    }
    return await run(root);
  } finally {
    await rm(root, { recursive: true, force: true });
  }
}

function keyOf(overrides: Record<string, string> = {}): Promise<string> {
  return withCheckout(overrides, async root => coreWebBuildKey((await collectCoreWebBuildInputs(root)).inputs));
}

test("every file a build depends on changes the key", async () => {
  const baseline = await keyOf();
  assert.equal(await keyOf(), baseline, "the same checkout has the same key");
  const changes: Array<[string, Record<string, string>]> = [
    ["Core's lockfile", { "pnpm-lock.yaml": "lockfileVersion: '9.0'\nimporters: {}\n" }],
    ["a built package's manifest", { "packages/fluxiq/package.json": JSON.stringify({ exports: { ".": "./dist/other.js" } }) }],
    ["client-gateway-websocket dist", { "packages/client-gateway-websocket/dist/index.js": "gateway changed\n" }],
    ["contracts dist", { "packages/contracts/dist/index.js": "contracts changed\n" }],
    ["fluxiq dist", { "packages/fluxiq/dist/index.js": "fluxiq changed\n" }],
    ["a file added to a dist", { "packages/fluxiq/dist/programs/extra.js": "extra\n" }],
    ["web source", { "apps/web/src/app/page.tsx": "export default function Page() { return 1; }\n" }],
    ["tsconfig.base.json", { "tsconfig.base.json": "{ \"compilerOptions\": { \"strict\": true } }\n" }],
    ["Next version", { "apps/web/node_modules/next/package.json": JSON.stringify({ version: "15.5.24" }) }],
  ];
  for (const [name, overrides] of changes) assert.notEqual(await keyOf(overrides), baseline, name);
});

test("files the staged workspace leaves out do not change the key", async () => {
  const baseline = await keyOf();
  const ignored: Array<[string, Record<string, string>]> = [
    ["earlier build output", { "apps/web/.next/BUILD_ID": "another-build\n" }],
    ["earlier test results", { "apps/web/test-results/result.txt": "another result\n" }],
    ["Core's own next.config.ts", { "apps/web/next.config.ts": "export default { reactStrictMode: true };\n" }],
    ["an installed dependency other than Next", { "apps/web/node_modules/react/index.js": "react changed\n" }],
  ];
  for (const [name, overrides] of ignored) assert.equal(await keyOf(overrides), baseline, name);
});

test("two Core commits that differ only outside the build's inputs share one key", async () => {
  // What a docs-only or tests-only Core commit changes. The key reads no git
  // state, so Core's HEAD moving with such a commit does not reach it: the
  // checkout here is not even a git repository.
  const baseline = await keyOf();
  const outsideInputs = {
    "docs/architecture/overview.md": "# Overview\n\nRewritten.\n",
    "docs/working/new-plan.md": "# A new plan\n",
    "packages/fluxiq/src/tests/index.test.ts": "test('fluxiq changed', () => {});\n",
    "packages/fluxiq/src/index.ts": "export const fluxiq = 2;\n",
    "package.json": JSON.stringify({ name: "fluxiq-root", scripts: { check: "tsc" } }),
  };
  assert.equal(await keyOf(outsideInputs), baseline);
  // The same commit with a lockfile change is a different build.
  assert.notEqual(await keyOf({ ...outsideInputs, "pnpm-lock.yaml": "lockfileVersion: '9.0'\n# react 19.3\n" }), baseline);
});

test("a Core checkout missing its lockfile or a package manifest fails as environment.missing", async () => {
  for (const missing of ["pnpm-lock.yaml", "packages/contracts/package.json"]) {
    await withCheckout({}, async root => {
      await rm(path.join(root, ...missing.split("/")), { force: true });
      await assert.rejects(collectCoreWebBuildInputs(root), (error: unknown) => {
        assert.ok(error instanceof RunnerFailure);
        assert.equal(error.category, "environment.missing", missing);
        return true;
      });
    });
  }
});

test("a Core checkout missing a built package fails as environment.missing", async () => {
  await withCheckout({}, async root => {
    await rm(path.join(root, "packages", "contracts", "dist"), { recursive: true, force: true });
    await assert.rejects(collectCoreWebBuildInputs(root), (error: unknown) => {
      assert.ok(error instanceof RunnerFailure);
      assert.equal(error.category, "environment.missing");
      assert.match(error.message, /packages[\\/]contracts[\\/]dist/u);
      return true;
    });
  });
});
