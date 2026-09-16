// Type-check both projects, and fail if EITHER fails rather than stopping at
// the first.
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

import { spawnSync } from "node:child_process";
import { createRequire } from "node:module";

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

process.exit(failed ? 1 : 0);
