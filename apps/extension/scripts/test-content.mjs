import { spawnSync } from "node:child_process";
import { createRequire } from "node:module";

// The T2 content-script harness (`e2e/playwright.content.config.ts`), run with
// whatever Playwright arguments follow `--`.
//
// **Node's own TypeScript stripping is turned off for the run.** Node 22.18
// and later strip types from a `.ts` file by default, and on this machine's
// Node 22.23 that happens before Playwright's transform sees the file. The
// stripper cannot remove a constructor's parameter properties, and the domain's
// `RecoverableToolRejection` (`domain/src/runtime/llm-evidence/tool-rejection.ts`)
// has three. So every spec that imports the domain runtime itself --
// `item-conditions.spec.ts` and `list-completeness.spec.ts` -- failed to load,
// with `TypeScript parameter property is not supported in strip-only mode` and
// `No tests found`. Without the stripper, Playwright's own transform compiles
// the file, as it does every other `.ts` the specs reach. Set in
// `NODE_OPTIONS`, the flag also reaches Playwright's worker processes. Node
// versions without the stripper have no `process.features.typescript` and would
// reject the flag, so it is added only where the stripper exists.

const require = createRequire(import.meta.url);
// The package script ends in `--` and pnpm adds its own, and each would
// otherwise reach Playwright, which reads every argument after one as a filter.
const args = process.argv.slice(2);
while (args[0] === "--") args.shift();

const env = { ...process.env };
if (process.features.typescript) {
  env.NODE_OPTIONS = [env.NODE_OPTIONS, "--no-experimental-strip-types"].filter(Boolean).join(" ");
}

const run = spawnSync(process.execPath, [require.resolve("@playwright/test/cli"), "test", "-c", "e2e/playwright.content.config.ts", ...args], {
  stdio: "inherit",
  env
});
process.exit(run.status ?? 1);
