# t372 report: the framework reference stops going stale on every Core change

## Outcome

Done. The generated reference no longer records line numbers, so it changes only when the public surface changes (an export added, removed, renamed, re-kinded, moved to another file, or its summary rewritten). Regenerated once; `docs:check` passes.

## What changed and why

All edits are in the Core worktree `C:\Users\osrs_\FluxStuff\fxwork\t372\!FluxIQ`. Nothing is committed.

- `scripts/docs-reference.mjs`: the Source column is now the owning file only (`packages/fluxiq/src/.../file.ts`), not `file.ts:<line>`. The line number was the only thing that moved when unrelated lines moved. Rendering is split into one exported pure function, `frameworkReferenceMarkdown(reflections, repositoryRoot)`, so a test can call it without TypeDoc. The TypeDoc run, `--check` and the writes now sit in `main()` behind a guard that runs only when the script is invoked directly (the same pattern as `clean-library-output.mjs`). The header line now says line numbers are left out, and the stale message says the public surface changed.
- `scripts/tests/docs-reference.test.mjs` (new, node:test): moving exports to other lines leaves the output byte-identical and has no `.ts:<n>`; adding an export changes it (and the count); renaming one changes it; moving one to another file changes it.
- `docs/reference/framework-reference.md` and `packages/fluxiq/docs/reference/framework-reference.md`: regenerated, and identical to each other. Compared with HEAD after stripping `:<line>` from the old file, the only other difference is the header sentence (line 4). There are still 3366 declarations.

## Commands run and observed results

- `node --test scripts/tests/docs-reference.test.mjs` -> `# tests 4`, `# pass 4`, `# fail 0`.
- `pnpm docs:check` before regenerating -> failed with the stale error from `main` (shows the check still fails when the content differs).
- `pnpm docs:reference` -> `Wrote docs/reference/framework-reference.md and packages/fluxiq/docs/reference/framework-reference.md (3366 public declarations).`
- `pnpm docs:check` -> `structure-audit: passed (0 warning(s), 0 baselined).` then `Deterministic framework reference is current.`
- `diff` of the HEAD reference with line numbers stripped against the new one -> only line 4 (header) differs. `diff` of the two generated copies -> identical.
- `node scripts/structure-audit.mjs` -> `structure-audit: passed (289 warning(s), 710 baselined).` It also printed `1 baseline entries can be lowered`. I did not check which entry that is. My files do not touch the baseline, and I did not run `structure:baseline`, because the baseline is outside what I own.

## Not verified

- The new test is not wired into any package script. Core's `check` lists specific test globs and does not include `scripts/tests/*.test.mjs` (`clean-library-output.test.mjs` is not run by it either). Changing `package.json` was outside what I own.
- I did not add signatures. The brief's goal lists "signatures" among what a reader needs, but the reference had no signature column before. Adding full TypeDoc type text for 3366 declarations would make the file much larger, and it would churn on internal type edits. I left that decision to the supervisor.
- I did not run Core typecheck or tests. No TypeScript source changed.

## Open questions or contradictions found

- Should `scripts/tests/*.test.mjs` be added to Core's `check` script so the new test runs in CI? This needs a `package.json` edit (supervisor or follow-up).
- Are signatures wanted (see Not verified)? If so, a follow-up should decide how much type text to keep.
- The audit says one baseline entry can be lowered. It looks like it comes from earlier work, not this change.
