// Collecting a Core checkout's build inputs: every file a build depends on
// moves the key, and the files a staged workspace leaves out do not.
import assert from "node:assert/strict";
import { mkdir, mkdtemp, rm, writeFile } from "node:fs/promises";
import os from "node:os";
import path from "node:path";
import test from "node:test";
import { RunnerFailure } from "../../failure.js";
import { collectCoreWebBuildInputs } from "../inputs.js";
import { coreWebBuildKey } from "../key.js";

const checkout: Readonly<Record<string, string>> = {
  "tsconfig.base.json": "{}\n",
  "apps/web/package.json": "{}\n",
  "apps/web/src/app/page.tsx": "export default function Page() { return null; }\n",
  "apps/web/next.config.ts": "export default {};\n",
  "apps/web/.next/BUILD_ID": "an-earlier-build\n",
  "apps/web/test-results/result.txt": "an earlier result\n",
  "apps/web/node_modules/next/package.json": JSON.stringify({ version: "15.5.23" }),
  "apps/web/node_modules/react/index.js": "react\n",
  "packages/client-gateway-websocket/dist/index.js": "gateway\n",
  "packages/contracts/dist/index.js": "contracts\n",
  "packages/fluxiq/dist/index.js": "fluxiq\n",
};
const head = "a".repeat(40);

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

function keyOf(overrides: Record<string, string> = {}, coreHead = head): Promise<string> {
  return withCheckout(overrides, async root => coreWebBuildKey((await collectCoreWebBuildInputs(root, async () => coreHead)).inputs));
}

test("every file a build depends on, and Core's HEAD, changes the key", async () => {
  const baseline = await keyOf();
  assert.equal(await keyOf(), baseline, "the same checkout has the same key");
  const changes: Array<[string, Record<string, string>, string?]> = [
    ["Core HEAD", {}, "b".repeat(40)],
    ["client-gateway-websocket dist", { "packages/client-gateway-websocket/dist/index.js": "gateway changed\n" }],
    ["contracts dist", { "packages/contracts/dist/index.js": "contracts changed\n" }],
    ["fluxiq dist", { "packages/fluxiq/dist/index.js": "fluxiq changed\n" }],
    ["a file added to a dist", { "packages/fluxiq/dist/programs/extra.js": "extra\n" }],
    ["web source", { "apps/web/src/app/page.tsx": "export default function Page() { return 1; }\n" }],
    ["tsconfig.base.json", { "tsconfig.base.json": "{ \"compilerOptions\": { \"strict\": true } }\n" }],
    ["Next version", { "apps/web/node_modules/next/package.json": JSON.stringify({ version: "15.5.24" }) }],
  ];
  for (const [name, overrides, coreHead] of changes) assert.notEqual(await keyOf(overrides, coreHead), baseline, name);
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

test("a Core checkout missing a built package fails as environment.missing", async () => {
  await withCheckout({}, async root => {
    await rm(path.join(root, "packages", "contracts", "dist"), { recursive: true, force: true });
    await assert.rejects(collectCoreWebBuildInputs(root, async () => head), (error: unknown) => {
      assert.ok(error instanceof RunnerFailure);
      assert.equal(error.category, "environment.missing");
      assert.match(error.message, /packages[\\/]contracts[\\/]dist/u);
      return true;
    });
  });
});
