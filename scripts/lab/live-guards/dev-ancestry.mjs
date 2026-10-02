// Whether a checkout's HEAD contains its repository's local `dev`: the fact
// the `behind-dev` rule judges, read with git for the downstream checkout a
// live run starts from and for the FluxIQ Core it builds against.
//
// A lane worktree that missed a merge round tests code `dev` has already
// replaced, and a live run on it spends real money to measure nothing. Local
// `dev` is the integrated line (the user's rule, 2026-10-01: "live testing labs
// need to actually be synced to main when you start testing them").
//
// Never throws. Anything git cannot answer -- no checkout, no HEAD, no local
// `dev`, git not on the PATH -- comes back as `error`, and the rule refuses
// with it: a guard that cannot see the ancestry does not guess that it is fine.

import { runGit } from "../../worktree/index.mjs";

/**
 * @typedef {{
 *   root: string,
 *   head: string | null,
 *   dev: string | null,
 *   contains: boolean,
 *   lacking: number | null,
 *   docsOnly: boolean,
 *   error: string | null,
 * }} DevAncestry
 */

/**
 * @param {string} root a git working tree
 * @returns {Promise<DevAncestry>}
 */
export async function readDevAncestry(root) {
  try {
    const head = await runGit(root, ["rev-parse", "--verify", "HEAD"]);
    const dev = await runGit(root, ["rev-parse", "--verify", "--quiet", "refs/heads/dev^{commit}"]).catch((error) => {
      throw exitedWith(error, 1) ? new Error(`${root} has no local dev branch (refs/heads/dev)`) : error;
    });
    // `merge-base --is-ancestor` answers "no" with exit 1; anything else non-zero is an error.
    const contains = await runGit(root, ["merge-base", "--is-ancestor", dev, head]).then(() => true, (error) => {
      if (exitedWith(error, 1)) return false;
      throw error;
    });
    const lacking = contains ? 0 : Number(await runGit(root, ["rev-list", "--count", `${head}..${dev}`]));
    // What dev changed since this checkout last took it in. When every changed
    // file is documentation (`docs/` or Markdown) the run tests the same code
    // dev has, so the gap is no reason to refuse: the Lab's source fingerprint
    // leaves the same files out. A gap that changes no file at all still counts.
    const changed = contains ? [] : await changedSince(root, head, dev);
    const docsOnly = changed.length > 0 && changed.every(isDocumentation);
    return { root, head, dev, contains, lacking, docsOnly, error: null };
  } catch (error) {
    return { root, head: null, dev: null, contains: false, lacking: null, docsOnly: false, error: error instanceof Error ? error.message : String(error) };
  }
}

/** The files `dev` changed since its merge base with `head`. */
async function changedSince(root, head, dev) {
  const base = (await runGit(root, ["merge-base", head, dev])).trim();
  return (await runGit(root, ["diff", "--name-only", base, dev])).split(/\r?\n/u).map((line) => line.trim()).filter(Boolean);
}

function isDocumentation(file) {
  return file.startsWith("docs/") || file.endsWith(".md");
}

function exitedWith(error, code) {
  return error?.cause?.code === code;
}
