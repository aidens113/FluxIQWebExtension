#!/usr/bin/env node
// A gate of the root `pnpm check`: fail when a file this repository mirrors
// from FluxIQ Core (`core-mirror/mirrors.mjs` lists them) differs from Core's
// copy or exists on one side only. Core is the sibling checkout the domain
// links to, resolved exactly as the worktree tooling resolves it; a missing
// Core is a failure, not a pass. `--json` prints the comparison as JSON.

import path from "node:path";
import { fileURLToPath } from "node:url";
import { resolveCoreSibling } from "../worktree/index.mjs";
import { compareMirrors, CORE_MIRRORS, formatMirrorReport } from "./core-mirror/index.mjs";

const repositoryRoot = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..", "..");
const json = process.argv.includes("--json");
const core = await resolveCoreSibling(repositoryRoot);
if (!core.present) {
  console.error(`core-mirror: FluxIQ Core was not found at ${core.root}, the sibling checkout domain/package.json links to. The mirrors cannot be compared; check Core out there.`);
  process.exit(1);
}
const result = await compareMirrors({ extRoot: repositoryRoot, coreRoot: core.root, sets: CORE_MIRRORS });
if (json) console.log(JSON.stringify({ coreRoot: core.root, ...result }, null, 2));
else if (result.inSync) console.log(formatMirrorReport(result, core.root));
else console.error(formatMirrorReport(result, core.root));
process.exit(result.inSync ? 0 : 1);
