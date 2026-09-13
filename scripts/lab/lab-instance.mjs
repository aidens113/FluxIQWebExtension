// Where one Lab instance's build output lives.
//
// The Lab supports several concurrent instances -- one per agent or terminal --
// and every instance needs build output no other instance can delete while its
// browser is loading it. `FLUXIQ_LAB_INSTANCE` names the instance, on the same
// convention as EXTENSION_TEST_BUILD_LABEL (apps/extension/scripts/test-extension.mjs)
// and DOMAIN_TEST_BUILD_LABEL: a lowercase kebab-case label, at most 64
// characters. Without it every path is exactly what it has always been, so a
// single `pnpm lab` is unchanged.
//
// This module is the only place the label becomes a path. `run-lab.mjs` reads
// it once, builds into the directories named here, and exports the resulting
// absolute paths to the runner as FLUXIQ_LAB_EXTENSION_PATH,
// FLUXIQ_LAB_SCENARIO_ENTRYPOINT, and FLUXIQ_LAB_HOST_MODULE, so what runs
// cannot disagree with what was built.

import path from "node:path";
import { fileURLToPath } from "node:url";

export const repositoryRoot = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..", "..");

const INSTANCE_PATTERN = /^[a-z0-9][a-z0-9-]{0,63}$/u;

/**
 * Resolves one Lab instance's build locations from the environment.
 *
 * @param {NodeJS.ProcessEnv} [env]
 * @param {string} [root] repository root; overridden only by tests
 */
export function resolveLabInstancePaths(env = process.env, root = repositoryRoot) {
  const declared = env.FLUXIQ_LAB_INSTANCE?.trim() ?? "";
  if (declared !== "" && !INSTANCE_PATTERN.test(declared)) {
    throw new Error(`FLUXIQ_LAB_INSTANCE must be lowercase kebab-case, at most 64 characters; received ${JSON.stringify(declared)}`);
  }
  const instance = declared === "" ? null : declared;
  // An instance's output stays inside the package that produced it. Both the
  // compiled scenario lab and the host bundle import workspace packages by bare
  // specifier, and Node resolves those by walking up from the file: only a
  // directory under the owning package reaches that package's node_modules.
  const owned = (packageDir) => path.join(root, ...packageDir, ".lab-instances", instance);
  const extensionBuildRoot = instance === null ? path.join(root, "apps", "extension") : owned(["apps", "extension"]);
  const scenarioOutDir = instance === null ? path.join(root, "apps", "scenario-lab", "dist") : path.join(owned(["apps", "scenario-lab"]), "dist");
  return {
    instance,
    extensionBuildRoot,
    extensionPath: path.join(extensionBuildRoot, "dist", "e2e-chromium"),
    scenarioOutDir,
    scenarioEntrypoint: path.join(scenarioOutDir, "server.js"),
    // The shared host bundle is rebuilt by every workspace build; an instance
    // runs from its own copy so a sibling's build cannot rewrite the file its
    // Core process is about to import.
    hostModule: instance === null ? null : path.join(owned(["domain"]), "host", "web-panel-host.mjs"),
    sharedHostModule: path.join(root, "domain", "dist", "host", "web-panel-host.mjs"),
    buildLockPath: path.join(root, ".lab-locks", "build.lock")
  };
}
