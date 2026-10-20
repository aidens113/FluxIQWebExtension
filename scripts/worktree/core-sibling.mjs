// Where a worktree's FluxIQ Core is, and whether it is the Core we meant.
//
// `domain/package.json` holds `"fluxiq": "link:../../!FluxIQ/packages/fluxiq"`,
// resolved from `<worktree>/domain`. Core is therefore not a setting but a
// position: it is whatever sits beside the worktree under that name.
// FLUXIQ_CORE_ROOT does not change it and neither does anything else, because
// that link is what the domain build and the web panel host actually import.
//
// Resolving the path is only half the question. A directory can be the top of
// a git checkout and still be the wrong Core: a clone somebody made, an older
// copy, another agent's checkout moved there. `lab:pair` checks only that Core
// is the top of *some* checkout, which would let a task install and build
// against a tree nobody meant without ever saying so. So when the sibling is
// there, its repository is compared with the Core repository the caller named,
// through the absolute `--git-common-dir` that every worktree of one
// repository shares.
//
// A sibling that is absent is reported, not refused: on a freshly added
// worktree there is nothing beside it yet, and creating it is `create.mjs`'s
// next step.
//
// The sibling must also be the TOP of its checkout, which is why its identity
// comes from `checkout-repository.mjs` rather than from git directly; that
// file says what goes wrong without it.

import { stat } from "node:fs/promises";
import { coreRootOf, importCoreScript } from "../core-scripts/index.mjs";
import { checkoutRepository } from "./checkout-repository.mjs";

const { samePath } = await importCoreScript("scripts/task/path-identity.mjs");

/**
 * @param {string} extRoot a worktree of this repository
 * @param {{ coreRepositoryRoot?: string }} [options] the Core the sibling must be a worktree of
 * @returns {Promise<{ root: string, present: boolean, verified: boolean }>}
 */
export async function resolveCoreSibling(extRoot, options = {}) {
  const root = coreRootOf(extRoot);
  if (!await isDirectory(root)) return { root, present: false, verified: false };
  const { coreRepositoryRoot } = options;
  if (coreRepositoryRoot === undefined) return { root, present: true, verified: false };
  let actual;
  try {
    actual = await checkoutRepository(root);
  } catch (error) {
    throw new Error(`The Core sibling ${root} cannot be used: ${error.message}. Move or remove it, then create the sibling again.`, { cause: error });
  }
  const expected = await checkoutRepository(coreRepositoryRoot);
  if (!samePath(actual, expected)) {
    throw new Error(`The Core sibling ${root} is a worktree of ${actual}, not of ${coreRepositoryRoot} (${expected}). A build there would link a Core nobody asked for.`);
  }
  return { root, present: true, verified: true };
}

async function isDirectory(target) {
  try {
    return (await stat(target)).isDirectory();
  } catch (error) {
    if (error?.code === "ENOENT") return false;
    throw error;
  }
}
