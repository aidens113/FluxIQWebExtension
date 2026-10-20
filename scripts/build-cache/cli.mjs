#!/usr/bin/env node
// node scripts/build-cache/cli.mjs <step> [-- "<command>"]
// node scripts/build-cache/cli.mjs [--parallel] <step> <step>...
//
// This repository's steps through Core's build cache. Prints one line per
// step:
//   {"build-cache":"reuse"|"build","step":"<step>","reason":"...","ms":<n>,"source":"stamp"|"store"|"command"}
// then exits with the first failing step's exit code (0 when all reused or
// passed, 2 for a usage error). The command after `--` is what a package.json
// script shows its reader; it must equal the registry's command for the step,
// and a mismatch fails before anything runs. Core's
// `scripts/build-cache/entry/run-cli.mjs` holds the details.

import { runCli } from "./bound-engine.mjs";

process.exit(await runCli(process.argv.slice(2)));
