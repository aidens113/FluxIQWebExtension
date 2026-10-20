// Whether FluxIQ Core's build is what its source says, asked of Core's own
// build cache.
//
// The Lab loads Core's COMPILED output, never its source, so a Core fix can sit
// in the working tree while every live run exercises the old build. On
// 2026-09-17 a token ceiling raised in Core's source cost three campaign slices
// -- thirty live tasks, zero provider calls -- against the previous build.
//
// This used to be answered here by modification time: the newest file under
// Core's `packages/*/src` against the newest under `packages/*/dist`. That saw
// no input outside `src` (manifests, tsconfigs, the lockfile, the command, Node,
// generator inputs), called a restored or foreign `dist` fresh whenever its
// files were newer, called equal bytes with a new mtime stale, and made Core
// touch its outputs on every reuse to keep the comparison quiet. Core's build
// cache already knows the answer exactly: `decideStep` says whether a step's
// stamp still matches a fingerprint of every input, its required outputs exist
// and its output digest is unchanged, and why not when it does not. So the
// question is put to the build cache of the exact Core checkout being checked
// (as the build lease resolves Core's locks), never to a copied rule.
//
// `watch.mjs` is a different question -- is Core changing UNDER a run -- and
// `unbuilt.mjs` answers "never built at all" first, with its own message.

import path from "node:path";
import { pathToFileURL } from "node:url";
import { CORE_PACKAGES } from "../../../worktree/index.mjs";

/**
 * @typedef {(step: string, options: { repoRoot: string, env: NodeJS.ProcessEnv }) => Promise<{ decision: "reuse" | "build", reason: string }>} CoreStepDecider
 */

/**
 * @param {string} coreRoot the Core checkout whose build is asked about
 * @param {{ env?: NodeJS.ProcessEnv, decide?: CoreStepDecider }} [options] `decide` is replaced by tests
 * @returns {Promise<{ stale: boolean, steps: Array<{ step: string, reason: string }>, message: string | null }>}
 */
export async function coreBuildCurrency(coreRoot, options = {}) {
  const decide = options.decide ?? (await coreStepDecider(coreRoot));
  // FLUXIQ_BUILD_FORCE=1 makes every decision a build; it says what the caller
  // wants done, not whether the build is current.
  const { FLUXIQ_BUILD_FORCE: _forced, ...env } = options.env ?? process.env;
  const steps = [];
  for (const item of CORE_PACKAGES) {
    const step = `${item.directory}:build`;
    const answer = await decide(step, { repoRoot: coreRoot, env });
    if (answer.decision !== "reuse") steps.push({ step, reason: answer.reason });
  }
  if (steps.length === 0) return { stale: false, steps, message: null };
  const named = steps.map((item) => `${item.step} (${item.reason})`).join("; ");
  return {
    stale: true,
    steps,
    message: `FluxIQ Core's build at ${coreRoot} is not what its source says: Core's build cache would rebuild ${named}. Downstream code runs and bundles against Core's COMPILED output, so this would exercise the old build and report the result as the product's.`
  };
}

/** Core's own `decideStep`, from the exact checkout, or a refusal naming what is missing. */
async function coreStepDecider(coreRoot) {
  const entry = path.join(coreRoot, "scripts", "build-cache", "index.mjs");
  let engine;
  try {
    engine = await import(pathToFileURL(entry).href);
  } catch (error) {
    throw new Error(`FluxIQ Core's build cache could not be loaded from ${entry}: ${error.message}`, { cause: error });
  }
  if (typeof engine.decideStep !== "function") throw new Error(`FluxIQ Core at ${coreRoot} exports no decideStep from scripts/build-cache/index.mjs; update it to Core's dev.`);
  return engine.decideStep;
}
