# t320 — Working-index refresh readiness

Status: **Ready after run-3 documentation settles; do not regenerate while the live/debug work is in flight**

The current worktree already shows `docs/working/README.md`,
`docs/working/mvp-today-plan.md`, and `docs/working/language-driven-flow-loop-plan.md` as modified.
The pending run-3 debug and all t170–t320 reports are nested under working-document subdirectories.
The index generator deliberately ignores nested Markdown and indexes only top-level
`docs/working/*.md` files other than `README.md`.

No generator/check command was run by t320, so this report does not claim that the current modified
index already matches the current top-level plans.

## Exact safe sequence

Run this sequence only after the run-3 command has ended, its pending debug has been safely renamed
or otherwise resolved, both active plans have received their final Current State/ledger edits, the
required MVP-plan compaction is complete, and no agent is editing a top-level working document.

1. Capture `git status --short --untracked-files=all` and require that the only intended authored
   documentation changes are understood. Do not stage, discard, or overwrite another agent's work.
2. Run the working-document rule's update in isolation:

   ```powershell
   pnpm structure:baseline --rule working-docs
   ```

   This is safer than unscoped `pnpm structure:baseline`: the audit already knows other rules may
   have lowerable baseline entries, and final documentation maintenance must not silently rewrite
   unrelated baseline state.
3. Require exit 0. The updater refuses and writes nothing if a working-document violation is new or
   grew beyond its ratchet. On refusal, fix the owning top-level document; do not use `--adopt`,
   increase a baseline, or hand-edit the generated index around the failure.
4. Inspect the resulting name/scope diff before any further command:

   ```powershell
   git status --short -- .structure-baseline.json docs/working/README.md
   git diff -- .structure-baseline.json docs/working/README.md
   git diff --check -- .structure-baseline.json docs/working/README.md
   ```

   The README diff must be purely the deterministic table/footer regenerated from top-level
   headers, line counts, and status groups. The baseline diff, if any, must only lower/remove
   `working-docs` ratchet entries made obsolete by compaction; it must not add or raise debt.
5. Run the read-only verification:

   ```powershell
   pnpm structure:check
   ```

   Require exit 0 and no stale-index, header-shape, Current State, ledger, or compaction failure.
6. Recheck status. If a top-level working document changed between steps 2 and 5, discard no files;
   wait for the editor to finish and repeat the scoped regeneration/check on the newly settled
   tree.

The repository-wide `pnpm check` remains the supervisor's later integration gate. It is not needed
to generate the index, and it should not overlap a live run; it includes structure tests, Lab/task
tests, the structure audit, and recursive workspace checks.

## Files the regeneration may change

The scoped update may write exactly:

- `docs/working/README.md` — the `working-docs` rule's only direct generated output. It is rewritten
  with LF only when generated content differs.
- `.structure-baseline.json` — only if existing `working-docs` ratchet entries can be lowered or
  removed. It may remain byte-identical.

It must not change either active plan, any archive/report/debug, source or test file, lockfile,
build/dist output, Lab state, or run artifact. The pending/renamed run-3 debug, nested archives, and
report-only churn must never acquire index rows. The index should reflect only final top-level plan
line counts and header metadata.

## Scope and privacy stops

- Do not run regeneration while run 3 or its debug integration is in flight. Although nested run
  evidence is not indexed, concurrent top-level plan edits would immediately stale the output and
  make the validation describe the wrong documentation tree.
- Never open `test-runs/`, provider sidecars, the pending/completed debug's evidence, browser state,
  `.fluxiq`, credentials, or captured output to refresh this index. None is an input to the rule.
- Do not copy run ids, results, secrets, recorded page data, or artifact paths into the index. Its
  content comes only from the eight-field header, whole-file line count, status grouping, and the
  fixed generated prose.
- Do not hand-edit `docs/working/README.md`; edit the owning top-level document header/body, then
  regenerate.
- Do not use the unscoped baseline updater for this maintenance unit. Do not accept an unexpected
  file in the post-update status as generated output.
- A dirty README is not proof of freshness. Only the settled-tree scoped regeneration followed by
  `pnpm structure:check` establishes it.

t320 opened no test-run or live artifact and ran no test, build, structure update/check, provider,
browser, or Lab command. It changed no shared documentation or generated state. This report is its
only write.
