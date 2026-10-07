#!/usr/bin/env node
// The first gate of every downstream `build`, `check` and `test` script that
// compiles, bundles or runs against FluxIQ Core (`core-build/tests/
// package-gates.test.mjs` holds them to it), and of the root `pnpm check`:
// refuse a Core build that is missing or older than Core's source, naming the
// stale file and the command that rebuilds it. Core is resolved exactly as the
// Lab resolves it: FLUXIQ_CORE_ROOT, else the `!FluxIQ` checkout beside this
// repository.

import { readFileSync } from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";
import { coreRepositoryRoot } from "../lab/core/index.mjs";
import { coreBuildFreshness, gateName } from "./core-build/index.mjs";

const repositoryRoot = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..", "..");
const rootPackageName = JSON.parse(readFileSync(path.join(repositoryRoot, "package.json"), "utf8")).name;
const coreRoot = coreRepositoryRoot(process.env, repositoryRoot);
const verdict = await coreBuildFreshness(coreRoot, {}, { gate: gateName(process.env, rootPackageName) });
if (!verdict.fresh) {
  console.error(verdict.message);
  process.exit(1);
}
console.log(`core-build: FluxIQ Core's build at ${coreRoot} is current with its source.`);
