// Whether a path may be deleted outright.
//
// `removeWorktree` deletes its root with a recursive delete, because
// `git worktree remove --force` cannot do the job here: it fails on
// `node_modules` with "Directory not empty", and it is not atomic -- it
// deletes part of the tree and loses the `.git` file before it aborts, leaving
// a worktree that is neither present nor removable. A recursive delete with
// nothing standing in front of it is the one operation in this module that can
// destroy work that was never committed, so the path it is handed is checked
// against the places work lives before anything runs.
//
// Three refusals, each of which has a plausible way of happening. The root must
// lie strictly below a base directory set aside for disposable worktrees, so a
// path built from an empty or missing name cannot escape it and cannot take the
// base itself. It must not be, contain, or lie inside the checkout this process
// is running from. And it must not be, contain, or lie inside any checkout the
// caller names as one somebody is working in -- the sibling Core especially,
// which is a directory away from a task's own Core and is nobody's to delete.

import path from "node:path";
import { pathInside, samePath } from "./path-identity.mjs";

/**
 * @param {{ base: string, root: string, repositoryRoot: string, workingRoots?: string[] }} input
 * @returns {string} the resolved root, once it is safe to delete
 */
export function assertDisposable({ base, root, repositoryRoot, workingRoots = [] }) {
  const resolvedBase = path.resolve(base);
  const resolved = path.resolve(root);
  if (samePath(resolved, resolvedBase)) throw new Error(`Refusing to treat ${resolved} as a disposable worktree: it is the disposable base itself, which holds every other worktree.`);
  if (!pathInside(resolvedBase, resolved)) throw new Error(`Refusing to treat ${resolved} as a disposable worktree: it is not below the disposable base ${resolvedBase}.`);
  const protectedRoots = [
    { label: "the checkout this process runs from", root: repositoryRoot },
    ...workingRoots.map((working) => ({ label: "a working checkout", root: working })),
  ];
  for (const { label, root: other } of protectedRoots) {
    if (other === undefined || other === null || other === "") continue;
    const target = path.resolve(other);
    if (samePath(resolved, target)) throw new Error(`Refusing to treat ${resolved} as a disposable worktree: it is ${label}.`);
    if (pathInside(target, resolved)) throw new Error(`Refusing to treat ${resolved} as a disposable worktree: it lies inside ${label}, ${target}.`);
    if (pathInside(resolved, target)) throw new Error(`Refusing to treat ${resolved} as a disposable worktree: ${label}, ${target}, lies inside it.`);
  }
  return resolved;
}
