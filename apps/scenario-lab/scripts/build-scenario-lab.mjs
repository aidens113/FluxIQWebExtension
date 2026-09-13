// Compiles the scenario lab, optionally into a directory one Lab instance owns.
//
// The scenario lab server is spawned once per scenario run, so its `dist/` is
// read throughout a Lab run, not only at startup. A sibling instance's build
// rewriting those files mid-run would be read torn, so
// FLUXIQ_LAB_SCENARIO_OUT_DIR redirects the emit to that instance's own
// directory. Unset -- every path outside the Lab launcher -- the emit is
// `dist/`, exactly as `tsc -p tsconfig.json` produced it before.

import { spawnSync } from "node:child_process";
import { createRequire } from "node:module";
import path from "node:path";
import { fileURLToPath } from "node:url";

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");
const compiler = createRequire(import.meta.url).resolve("typescript/lib/tsc.js");
const outDir = process.env.FLUXIQ_LAB_SCENARIO_OUT_DIR?.trim();
const args = ["-p", path.join(root, "tsconfig.json"), ...(outDir ? ["--outDir", path.resolve(outDir)] : [])];

const result = spawnSync(process.execPath, [compiler, ...args], { cwd: root, stdio: "inherit" });
if (result.error) throw result.error;
process.exitCode = result.status ?? 1;
