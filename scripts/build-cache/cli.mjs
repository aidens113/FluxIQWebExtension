#!/usr/bin/env node
// node scripts/build-cache/cli.mjs <step> [-- <command...>]
//
// Runs one registered step through the cache and prints one line:
//   {"build-cache":"reuse"|"build","step":"<step>","reason":"...","ms":<n>,"source":"stamp"|"store"|"command"}
// then exits with the step's exit code (0 on a reuse).
//
// The command after `--` is what a package.json script shows its reader; it
// must equal the registry's command for the step, and a mismatch fails before
// anything runs, so the script and the registry cannot drift apart silently.
// Without `--` the registry's command is run.

import { runStep } from "./run-step.mjs";
import { STEPS } from "./steps.mjs";

const USAGE = "Usage: node scripts/build-cache/cli.mjs <step> [-- <command...>]";

const argv = process.argv.slice(2);
const separator = argv.indexOf("--");
const positional = separator === -1 ? argv : argv.slice(0, separator);
if (positional.length !== 1) {
  process.stderr.write(`${USAGE}\nRegistered steps: ${Object.keys(STEPS).join(", ")}\n`);
  process.exit(2);
}
const [stepName] = positional;
if (!Object.hasOwn(STEPS, stepName)) {
  process.stderr.write(`build-cache: unknown step "${stepName}". Registered steps: ${Object.keys(STEPS).join(", ")}\n`);
  process.exit(2);
}
if (separator !== -1) {
  const given = argv.slice(separator + 1).join(" ");
  if (given !== STEPS[stepName].command) {
    process.stderr.write(`build-cache: the command passed for "${stepName}" is not the registered one.\n  passed:     ${given}\n  registered: ${STEPS[stepName].command}\nChange scripts/build-cache/steps.mjs and the package.json script together.\n`);
    process.exit(2);
  }
}

const outcome = await runStep(stepName);
process.stdout.write(`${JSON.stringify({ "build-cache": outcome.result, step: outcome.step, reason: outcome.reason, ms: outcome.ms, source: outcome.source })}\n`);
process.exit(outcome.exitCode);
