// Type-check both projects, then bundle every browser entry in memory, and fail
// if ANY of those fails rather than stopping at the first.
//
// This script exists because `tsc -p tsconfig.json && tsc -p tsconfig.test.json`
// never reaches the test project when the source project fails -- and that is
// exactly when a masked error is most likely, because a tree that is already
// red is a tree nobody is reading carefully. A real type error in a background
// test sat unreported behind two unrelated domain errors until a worker
// happened to look for it. Errors in tests are still errors; a check that
// quietly stops checking is worse than one that is slow.
//
// The compiler is resolved through `require.resolve` rather than spawned as a
// bare `tsc`. A bare name resolves through PATH, which only carries this
// workspace's TypeScript when a package manager put it there -- so running this
// file directly picked up a different, globally installed compiler and reported
// lib errors that do not exist under the pinned one. A check whose result
// depends on how it was invoked is not a check.
//
// The bundle step exists because a type check cannot see the browser. On
// 2026-09-16 a web-domain module value-imported `fluxiq/automation-studio`,
// whose barrel reaches `node:crypto`; the domain client barrel carried it into
// the content script, `pnpm check` passed, and only `test:e2e:build` noticed.
// The import type-checks -- what fails is loading it in a browser. So each
// entry is bundled here exactly as the extension build bundles it
// (`bundleExtensionEntry`), with `write: false` so nothing on disk changes, and
// the bundler's guard names the Node-only module and the import chain that
// reached it.

import { spawnSync } from "node:child_process";
import { createRequire } from "node:module";
import path from "node:path";
import { fileURLToPath } from "node:url";
import { EXTENSION_ENTRY_NAMES, bundleExtensionEntry } from "./build-extension.mjs";

const tsc = createRequire(import.meta.url).resolve("typescript/bin/tsc");

const projects = [
  { project: "tsconfig.json", args: ["--noEmit"] },
  { project: "tsconfig.test.json", args: [] }
];

let failed = false;
for (const { project, args } of projects) {
  const result = spawnSync(process.execPath, [tsc, "-p", project, ...args], { stdio: "inherit" });
  if (result.status !== 0) failed = true;
}

// Never written to: it only gives esbuild the output paths it would report.
const unwrittenOutput = path.join(path.dirname(fileURLToPath(import.meta.url)), "..", ".bundle-check");
for (const name of EXTENSION_ENTRY_NAMES) {
  try {
    await bundleExtensionEntry(name, unwrittenOutput, { logLevel: "error", write: false });
  } catch {
    // esbuild has already printed each error, with its location, at log level "error".
    console.error(`extension check: the browser bundle "${name}" does not build.`);
    failed = true;
  }
}

process.exit(failed ? 1 : 0);
