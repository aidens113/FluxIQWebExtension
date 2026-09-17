// What `pnpm lab:pair` does with its arguments: print the usage; refuse; print
// the plan (`--dry-run`); or move the pair, Core first. Then it prints one JSON
// line with the pair's state and the campaign environment, followed by the
// shell lines for a campaign. A refusal is one JSON line on stderr with exit 1,
// and every refusal is decided before anything has changed.

import { readFile, realpath } from "node:fs/promises";
import path from "node:path";
import { withoutProviderSecrets } from "../../provider-secret-environment.mjs";
import { repositoryRoot } from "../lab-instance.mjs";
import { PAIR_USAGE, parsePairArgs } from "./arguments.mjs";
import { campaignEnvironment } from "./campaign-environment.mjs";
import { buildCore, clearMarker, coreDistPaths, pathInside, processesUsingRoots, readSideState, runGit, runPnpm, samePath, writeMarker } from "../../worktree/index.mjs";
import { renderPairInstructions } from "./instructions.mjs";
import { planSideMove } from "./move-plan.mjs";
import { providerKeySource } from "./provider-key.mjs";
import { resolvePairRoots } from "./roots.mjs";

/**
 * The Core packages a Lab run reads from `dist`, in Core's own build order
 * (its root `build` script). Core's web panel is not here: the Lab builds it
 * itself, into a cache keyed by these packages' output.
 */
const INSTALL = ["install", "--frozen-lockfile", "--config.confirm-modules-purge=false"];

/** Runs `pnpm lab:pair` for `argv` and sets the process exit code. */
export function runPairCommandLine(argv) {
  return pairCommand(argv).then((code) => { process.exitCode = code; }, (error) => {
    process.stderr.write(`${JSON.stringify({ status: "refused", category: "lab-pair", message: error instanceof Error ? error.message : String(error) })}\n${PAIR_USAGE}\n`);
    process.exitCode = 1;
  });
}

async function pairCommand(argv) {
  const options = parsePairArgs(argv);
  if (options.help) { process.stdout.write(`${PAIR_USAGE}\n`); return 0; }
  const { extRoot, coreRoot } = await resolvePairRoots({ repositoryRoot, extRoot: options.extRoot, readText: (file) => readFile(file, "utf8") });
  await requireWorktreeOfThisRepository(extRoot);
  const [core, ext] = await Promise.all([
    readSideState(coreRoot, options.core, { side: "core", buildable: true, distPaths: coreDistPaths(coreRoot) }),
    readSideState(extRoot, options.ext, { side: "ext" }),
  ]);
  const plans = [planSideMove({ ...core, forceBuild: options.buildCore }), planSideMove({ ...ext, forceBuild: false })];
  const refusals = plans.flatMap((plan) => (plan.refusal === null ? [] : [plan.refusal]));
  if (refusals.length > 0) throw new Error(refusals.join(" "));
  if (!options.allowRunning && plans.some((plan) => plan.checkout || plan.install || plan.build)) {
    const busy = await processesUsingRoots([extRoot, coreRoot]);
    if (busy.length > 0) {
      const named = busy.slice(0, 5).map((entry) => `${entry.name} (pid ${entry.pid})`).join(", ");
      throw new Error(`${busy.length} running process(es) are working inside the pair, e.g. ${named}. Moving it now would change files they have loaded; wait for them to finish, or pass --allow-running.`);
    }
  }
  if (!options.dryRun) {
    for (const plan of plans) await applyPlan(plan);
    await requireCoreLink(extRoot, coreRoot);
  }
  const environment = campaignEnvironment({ coreRoot, instance: options.instance });
  const providerKey = await providerKeySource({ env: process.env, extRoot });
  const pair = plans.map(({ refusal, targetLock, ...plan }) => plan);
  process.stdout.write(`${JSON.stringify({ status: options.dryRun ? "planned" : "ready", pair, environment, providerKey })}\n`);
  process.stdout.write(`${renderPairInstructions({ extRoot, environment, providerKey })}\n`);
  return 0;
}

async function applyPlan(plan) {
  const env = { ...withoutProviderSecrets(process.env), npm_config_workspace_concurrency: "1" };
  if (plan.checkout) {
    note({ state: "checkout", side: plan.side, root: plan.root, from: plan.from, to: plan.to });
    await runGit(plan.root, ["checkout", "--detach", plan.to]);
  }
  if (plan.install) {
    await clearMarker(plan.root, "install");
    await install(plan, env);
    await writeMarker(plan.root, "install", plan.targetLock);
  }
  if (plan.build) {
    await clearMarker(plan.root, "build");
    await buildCore(plan.root, { env, note: (line) => note({ state: "build", side: plan.side, commit: plan.to, ...line }) });
    await writeMarker(plan.root, "build", plan.to);
  }
}

async function install(plan, env) {
  note({ state: "install", side: plan.side, root: plan.root, lockfile: plan.targetLock, offline: true });
  try {
    await runPnpm(plan.root, [...INSTALL, "--offline"], { env });
  } catch (error) {
    note({ state: "install", side: plan.side, root: plan.root, offline: false, why: `the offline install failed, so the store may lack a package: ${error instanceof Error ? error.message : String(error)}` });
    await runPnpm(plan.root, INSTALL, { env });
  }
}

async function requireWorktreeOfThisRepository(extRoot) {
  const [own, theirs] = await Promise.all([
    runGit(repositoryRoot, ["rev-parse", "--path-format=absolute", "--git-common-dir"]),
    runGit(extRoot, ["rev-parse", "--path-format=absolute", "--git-common-dir"]),
  ]);
  if (!samePath(own, theirs)) throw new Error(`${extRoot} is not a worktree of ${repositoryRoot} (its repository is ${theirs}); create it with git worktree add --detach`);
}

async function requireCoreLink(extRoot, coreRoot) {
  const link = path.join(extRoot, "domain", "node_modules", "fluxiq");
  const target = await realpath(link);
  if (!pathInside(coreRoot, target)) throw new Error(`${link} resolves to ${target}, not into the pair's Core ${coreRoot}`);
  note({ state: "linked", link, target });
}

function note(line) {
  process.stderr.write(`${JSON.stringify({ lab: "pair", ...line })}\n`);
}
