# Stopped runtime lanes intake (Codex)

Scope: read-only reconciliation of t903, t905, t907, t908 and t909 under `fxwork`; latest commit messages and named reports first, then plan Current State sections, git status and diff stats. No source edits, tests, git mutations or paid runs.

## Lane status

| Lane | Extension checkout | Core checkout | Finding |
|---|---|---|---|
| t903 | Clean; HEAD is an ancestor of local dev; branch is 16 commits ahead of origin task branch | Clean; branch tip is an old merge of dev, 1 commit outside current dev and 51 behind | Extension work is already integrated locally. Its report says Core untouched; the Core-only unique tip is the dev-merge boundary, not a new implementation. Do not resume this lane. |
| t905 | Clean; 4 task commits ahead of merge base, 20 dev commits behind | Clean; 3 task commits ahead, 19 dev behind | Unvalidated partial work. Report checkpoint: phase 1 domain listKey/place and phase 2 result-ledger core checked; page-side place, five read vocabulary gaps, wiring, and scripted towels proof remain. |
| t907 | Clean; 1 task commit ahead, 28 dev behind | Clean; 1 task commit ahead, 27 dev behind | Unvalidated managed-browser-host work. Report marks implementation mostly done, but headed Chromium is skipped, browser/Lab build order and real-browser proof remain. Report identifies a hard integration issue: managed-host extension program API calls are 401/404 because FluxNode principal has no IAM actor and headless listener lacks the first-project route. |
| t908 | Clean; exactly 1 commit ahead of dev, no dev-only commits | Clean; same as dev | Best next bounded implementation lane: one commit, 17 changed files for next-page humanness/pager aiming. No t908 report exists. No acceptance checks are recorded, so treat behavior as unvalidated. |
| t909 | Clean; same as dev | Clean; 1 unvalidated commit ahead of dev | Extension commit only updates working-doc index. Core has WIP FluxNode act-scope implementation. It is not integrated and lacks a named report in the extension working docs. |

Status counts are `git rev-list --left-right --count dev...HEAD`; “task commits ahead” is the right count, and clean means no status/diff output. Commit-message checks: t905/t907/t908 Core tips and t909 Core tip explicitly say stopped/unvalidated; t903 Core tip is a dev merge; t909 Extension tip updates the index.

## Recommended next unit: resume t908

Keep scope to next-page humanness/pager aiming; owned files are the 17 paths in t908''s existing diff: `apps/extension/e2e/content/tests/extraction/tests/everything-store-next-page.spec.ts`, `apps/extension/src/content/actions/next-page.ts` and its tests, `apps/extension/src/content/action-runtime/humanness/**`, `apps/extension/src/content/extraction/page-advance/**), `apps/extension/src/runtime/tests/next-page-continuation.test.ts`, and `apps/extension/src/shared/extraction-continuation.ts`. There is no corresponding Core diff.

Acceptance gap: no lane report and no check evidence. First add a concise lane report, then inspect the existing diff against the behavior expected by its tests. Run the narrow unit suites beside changed action-runtime, page-advance, next-page, and continuation files, plus the single realistic `everything-store-next-page.spec.ts` browser spec if the extension content harness is available. Sync dev into the lane before integration and rerun those checks.

Dependency: t905 also edits `apps/extension/src/content/extraction/page-advance/index.ts`, the only overlapping extension path. Resolve that overlap by serial review if t905 is resumed; do not integrate both independently without checking the merged behavior. t905 also depends on t885-owned extraction gaps, so its next smallest unit is the page-side `place`/read-vocabulary work after the owner releases those paths; its report names the exact source and domain paths. t907 should wait on the IAM/headless API decision before claiming a usable managed host.

## Related current state

The launch-plan Current State says t905''s phase 2 waits for t885 call-chain/handler files and tracks page reads and judge cuts; it also lists next-page humanness as a new follow-up. The seal-plan Current State frames t907 as managed browser host work under Core P5. These snapshots are dated 2026-11-10/09 and lag the stopped-lane reports.

Core `docs/working/runtime-ownership-reset-plan.md` at t843 is explicitly superseded on 2026-11-02 by `studio-controller-plan.md` on t845. It records a historical ownership refactor and says do not resume it; it is not relevant to the current runtime lanes.

## Validation

Discovery only: `git status --short; git diff --stat; git diff --cached --stat` -> all five extension checkouts and five Core checkouts clean. No tests or builds were run, as instructed.

