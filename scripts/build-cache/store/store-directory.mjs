// Where the shared build store lives, or `null` when it is switched off.
//
//   FLUXIQ_BUILD_CACHE_DIR=<dir>   use that directory
//   FLUXIQ_BUILD_CACHE_DIR=off     no store: every step is stamped locally only
//   unset                          %LOCALAPPDATA%/fluxiq-build-cache on Windows,
//                                  $XDG_CACHE_HOME or ~/.cache elsewhere
//
// One store per user and machine, outside every checkout, so a worktree made
// today reuses what another worktree built yesterday.

import os from "node:os";
import path from "node:path";

const NAME = "fluxiq-build-cache";

/** @param {NodeJS.ProcessEnv} env @returns {string | null} */
export function storeDirectory(env) {
  const configured = env.FLUXIQ_BUILD_CACHE_DIR?.trim();
  if (configured !== undefined && configured !== "") {
    return configured.toLowerCase() === "off" ? null : path.resolve(configured);
  }
  if (env.LOCALAPPDATA) return path.join(env.LOCALAPPDATA, NAME);
  if (env.XDG_CACHE_HOME) return path.join(env.XDG_CACHE_HOME, NAME);
  return path.join(os.homedir(), ".cache", NAME);
}
