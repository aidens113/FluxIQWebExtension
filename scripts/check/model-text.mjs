#!/usr/bin/env node
// A gate of the root `pnpm check`: fail when the text Core gives a model names a
// realistic scenario's site, brand, product, person or group. Core is the
// sibling checkout the domain links to, resolved as core-mirror.mjs resolves
// it. `--vocabulary` prints the token list instead of checking.

import path from "node:path";
import { fileURLToPath } from "node:url";
import { resolveCoreSibling } from "../worktree/index.mjs";
import { formatModelTextReport, runModelTextCheck } from "./model-text/index.mjs";

const repositoryRoot = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..", "..");
const core = await resolveCoreSibling(repositoryRoot);
if (!core.present) {
  console.error(`model-text: FluxIQ Core was not found at ${core.root}, the sibling checkout domain/package.json links to. Its model-facing text cannot be scanned; check Core out there.`);
  process.exit(1);
}
const result = await runModelTextCheck({ extRoot: repositoryRoot, coreRoot: core.root });
if (process.argv.includes("--vocabulary")) {
  console.log(JSON.stringify({ sources: result.vocabulary.sources, tokens: result.vocabulary.tokens }, null, 2));
  process.exit(0);
}
if (result.hits.length === 0) console.log(formatModelTextReport(result));
else console.error(formatModelTextReport(result));
process.exit(result.hits.length === 0 ? 0 : 1);
