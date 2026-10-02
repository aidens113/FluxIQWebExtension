// Rule `behind-dev`: a live run starts only from a downstream checkout whose
// HEAD contains local `dev`, against a FluxIQ Core whose HEAD contains Core's
// local `dev`. A lane tree that missed a merge round tests stale code and
// spends real money doing it (the user's rule, 2026-10-01).
//
// A checkout on `dev`, a task branch merged up with `dev`, and a detached
// shared Core at or past Core's `dev` all pass. A checkout git cannot answer
// for -- no local `dev`, no checkout at all -- is refused with git's reason.
// A checkout that lacks only documentation commits (every file dev changed
// since is under `docs/` or Markdown) passes: it runs the code dev has.

/** @param {import("./guard-state.mjs").GuardState} state */
export function checkBehindDev(state) {
  const sides = [["this repository", state.devAncestry.repository], ["the FluxIQ Core it builds against", state.devAncestry.core]];
  const failing = sides.filter(([, ancestry]) => ancestry.error !== null || (!ancestry.contains && !ancestry.docsOnly));
  if (failing.length === 0) return null;
  const why = failing.map(([label, ancestry]) => ancestry.error !== null
    ? `the dev ancestry of ${label}, ${ancestry.root}, could not be read: ${ancestry.error}`
    : `${label}, ${ancestry.root}, is at ${short(ancestry.head)}, which lacks ${ancestry.lacking} commit(s) of its local dev (${short(ancestry.dev)})`);
  const roots = failing.map(([, ancestry]) => ancestry.root).join(" and ");
  return {
    rule: "behind-dev", overridable: true,
    why: why.join("; "),
    remedy: `In ${roots}, run \`git merge dev\` (creating or fetching a local dev branch first if there is none); then rebuild Core's libraries (\`pnpm --filter fluxiq build\` in ${state.devAncestry.core.root}) and the extension (\`pnpm --filter @fluxiq-web-extension/extension build\`), and run again. Or ask the user to create ${state.files.override("behind-dev")}.`,
  };
}

function short(sha) {
  return sha?.slice(0, 7) ?? "an unknown commit";
}
