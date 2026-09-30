#!/usr/bin/env node
// `pnpm check`'s first gate on FluxIQ Core: refuse to type-check and bundle
// the extension against a Core build that is missing or older than Core's
// source, naming the stale file and the command that rebuilds it. Core is
// resolved exactly as the Lab resolves it: FLUXIQ_CORE_ROOT, else the
// `!FluxIQ` checkout beside this repository.

import path from "node:path";
import { fileURLToPath } from "node:url";
import { coreRepositoryRoot } from "../lab/core/index.mjs";
import { coreBuildFreshness } from "./core-build/index.mjs";

const repositoryRoot = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..", "..");
const coreRoot = coreRepositoryRoot(process.env, repositoryRoot);
const verdict = await coreBuildFreshness(coreRoot);
if (!verdict.fresh) {
  console.error(verdict.message);
  process.exit(1);
}
console.log(`core-build: FluxIQ Core's build at ${coreRoot} is current with its source.`);
