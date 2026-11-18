import path from "node:path";
import { coreBuildFreshness } from "../check/core-build/index.mjs";
import { checkCoreCurrent } from "../task/index.mjs";
import { coreKind } from "./core-kind.mjs";
import { CORE_LIBRARY_STEPS, summarizeBuildCache } from "./core-libraries.mjs";
import { runCaptured } from "./run-captured.mjs";

/** The extension's build-cache step for the bundled host module the panel loads (`domain/package.json` "fluxiqHostModule"). */
export const PANEL_HOST_STEP = "domain:host-build";

const INSTALL_ARGS = ["install", "--frozen-lockfile", "--prefer-offline"];

/**
 * Everything the launcher needs before the host's setup, in order, each
 * idempotent and fast when already done, each reported in one line:
 *
 * 1. the extension's dependencies, from its lockfile (a package added since
 *    the last install gets its `node_modules`);
 * 2. FluxIQ Core: in a main checkout or a Core-paired task, its dependencies
 *    and its libraries, through Core's build cache. The task tool's shared
 *    Core (`core-kind.mjs`) is never installed into or rebuilt from here,
 *    because other worktrees build against it at the same time: it is only
 *    checked, with the task tool's own checks, and a stale one stops the
 *    launcher with one line naming `pnpm task sync-core`;
 * 3. the panel host bundle, through this repository's build cache.
 *
 * A failing step prints its output and rejects, naming the step; nothing after
 * it runs.
 */
export async function prepareWorkspace({
  repoRoot,
  coreRoot,
  env = process.env,
  log = console.log,
  run = runCaptured,
  inspectCore = coreKind,
  sharedCoreChecks = taskToolCoreChecks
}) {
  const step = async (name, options, summarize) => {
    const { code, lines } = await run({ env, ...options });
    if (code !== 0) {
      for (const line of lines) console.error(line);
      throw new Error(`${name} failed (exit code ${code}). Its output is above.`);
    }
    log(summarize(lines));
  };
  const install = (name, cwd) => step(name, { command: "pnpm", args: INSTALL_ARGS, cwd, shell: process.platform === "win32" }, (lines) => installSummary(name, lines));

  await install("Dependencies (extension)", repoRoot);
  if (await inspectCore(coreRoot) === "shared") {
    const stale = await sharedCoreChecks({ repoRoot, coreRoot, env });
    if (stale) {
      throw new Error(`FluxIQ Core at ${coreRoot} is shared with other task worktrees and ${stale}, so it is not installed into or rebuilt from here: run pnpm task sync-core in ${repoRoot}, then start again.`);
    }
    log("FluxIQ Core: current (shared with other task worktrees, so only checked, never installed into or rebuilt).");
  } else {
    await install("Dependencies (FluxIQ Core)", coreRoot);
    await step("Core libraries", { command: process.execPath, args: [path.join(coreRoot, "scripts", "build-cache", "cli.mjs"), ...CORE_LIBRARY_STEPS], cwd: coreRoot }, (lines) => summarizeBuildCache("Core libraries", lines));
  }
  await step("Panel host", { command: process.execPath, args: [path.join(repoRoot, "scripts", "build-cache", "cli.mjs"), PANEL_HOST_STEP], cwd: repoRoot }, (lines) => summarizeBuildCache("Panel host", lines));
}

/** pnpm says "Already up to date" when the lockfile and node_modules already agree. */
export function installSummary(name, lines) {
  return lines.some((line) => line.includes("Already up to date")) ? `${name}: current.` : `${name}: installed from the lockfile.`;
}

/**
 * The task tool's checks on a shared Core, run in process so the launcher can
 * stop with one line: `pnpm task finish`'s currency (its source contains Core's
 * `dev`, `scripts/task/core-currency.mjs`) and `scripts/check/core-build.mjs`'s
 * freshness (built, and not older than its source). Resolves with what is out
 * of date, or null when both hold.
 */
export async function taskToolCoreChecks({ repoRoot, coreRoot, env, checks = {} }) {
  const { currency = checkCoreCurrent, freshness = coreBuildFreshness } = checks;
  // The shared Core is itself a worktree of Core's repository, so it names that
  // repository and its `dev` for the currency check.
  const current = await currency({ workRoot: repoRoot, coreRepositoryRoot: coreRoot });
  if (current?.refusal) return `is ${current.behind} commit(s) behind Core's ${current.integrationBranch}`;
  const build = await freshness(coreRoot, {}, { gate: "pnpm dev", env });
  if (!build.fresh) return "its build is missing or older than its source";
  return null;
}
