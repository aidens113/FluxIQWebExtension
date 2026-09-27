# t384 — Core change-scope audit

## Verdict

**GO, with exact-path integration cleanup required.** The nine Core files
reported by t370/t372/t375/t377/t378 and the five downstream worker reports are
each present once at the expected path. No targeted file is generated output,
no conflict marker or whitespace error is present, and no wave-specific scope
creep was found. No provider, live path, broad validation, or source edit ran.

## Exact Core file set and status

| Unit | Core path | Status | Audit finding |
| --- | --- | --- | --- |
| t370 | `packages/fluxiq/src/programs/automation-studio/runtime/flow-bootstrap/evidence-loop-steps.ts` | ` M` | Present once. The 129 represented-draft bound and its uses are present. The large 224-addition/2-deletion diff also contains inherited projection work that predates this narrow correction. |
| t370 | `packages/fluxiq/src/programs/automation-studio/runtime/flow-bootstrap/tests/evidence-loop-steps.test.ts` | `??` | Present once. Boundary cases 129/130 and 64+65/64+66 are present. The file is wholly untracked, so Git cannot separate earlier test construction from t370's added boundary cases. |
| t370 | `packages/fluxiq/src/programs/automation-studio/runtime/flow-bootstrap/generation-failure/tests/diagnostics.test.ts` | `AM` | Present once. This is the report's unnamed, supervisor-authorized stale diagnostics fixture. The invalid case is now `steps: 2` plus `unlisted: maxIterations * 2` (128), hence 130. The staged snapshot is an earlier added-file baseline; the worktree contains inherited provenance/instrumentation changes as well as the t370 fixture correction. |
| t372/t377 | `packages/fluxiq/src/programs/automation-studio/runtime/flow-draft/entry.ts` | ` M` | Present once. The diff is confined to draft-entry packing/trimming and the reviewed oversized-input fallbacks. |
| t372/t377 | `packages/fluxiq/src/programs/automation-studio/runtime/flow-draft/tests/entry.test.ts` | ` M` | Present once. Added coverage is confined to packed representation, ordering, oversized-input handling, contiguous trimming, and least-entry fallback. |
| t372/t377 | `packages/fluxiq/src/programs/automation-studio/runtime/flow-draft/tests/entry-budget.test.ts` | `??` | Present once. The file is wholly untracked; its current assertions include the 20-input packed 4,000-byte case reported by t372. |
| t375 | `packages/fluxiq/src/programs/automation-studio/runtime/llm/evidence-loop/draft-shown.ts` | `??` | Present once. The file is wholly untracked and contains the closed `step_rows_v1` measurement/fail-closed logic described by t375. |
| t375 | `packages/fluxiq/src/programs/automation-studio/runtime/llm/evidence-loop/tests/draft-shown.test.ts` | `??` | Present once. The file is wholly untracked and contains legacy, packed, withholding, and malformed-shape coverage. |
| t378 | `packages/fluxiq/src/programs/automation-studio/runtime/tests/deepseek-bootstrap-exploration.test.ts` | ` M` | Present once. Its 391-addition/26-deletion working diff includes the inherited deterministic fixture; the t378 portion is the exact-field/row observer hardening and direct discriminator test. |

There are no unmerged index entries in this set. `git diff --check` reported no
whitespace errors for tracked changes; a direct text scan covering tracked and
untracked files found zero trailing-whitespace lines, zero conflict markers,
zero NULs, and a final newline in every file. Git emitted only its normal
LF-to-CRLF working-copy warning on several tracked files.

## Reports and generated-data check

These reports are each present exactly once under
`docs/working/mvp-today-plan/reports/` and are currently untracked:

- `t370-core-projection-bound-fix.md`
- `t372-draft-packing-fix-design.md`
- `t375-draft-measurement-support.md`
- `t377-packing-implementation-review.md`
- `t378-discriminator-re-review.md`

All five reports also have no trailing whitespace or conflict markers and end
with a newline. The audited set contains only authored TypeScript source/tests
and Markdown reports. It contains no `.fluxiq` state, build/test output,
sourcemaps, browser profiles, recordings, run artifacts, or other generated
data.

## Attribution and scope conclusion

The large Core tree was already dirty before these units. Git can show the
current HEAD/index/worktree split but cannot reconstruct every intermediate
worker state. Attribution above therefore uses the unit reports plus the
observable split:

- t370's 129-bound correction sits inside a larger inherited projection diff;
- its diagnostics file is an added staged baseline with further inherited
  worktree changes, one of which is the reported 128-unlisted correction;
- the flow-draft files contain the t372 implementation and t377 corrections on
  top of existing draft work;
- the measurement source/test are untracked whole files, so their internal
  pre-t375 baseline is unavailable to Git; and
- t378's observer correction is a small portion of a larger inherited service
  fixture diff.

Within those limitations, every reported wave change is located in its named
owner file and matches the report's purpose. The unrelated-looking provenance,
instrumentation, and deterministic-fixture hunks are inherited work in the
same files, not evidence that these units edited outside their briefs.

## Required cleanup before integration

1. Stage by the exact nine Core paths above. Do not rely on `git add -u`, which
   would omit four required untracked Core files, and do not stage the dirty
   Core tree wholesale.
2. Stage the five report paths explicitly downstream. They are all currently
   untracked.
3. Re-run exact-path `git status --short`, staged `git diff --stat`, and staged
   `git diff --check` before committing. Confirm that all nine Core files and
   five reports are included once and that no generated/runtime path entered
   the index.
4. Treat the complete current content of the `AM` diagnostics fixture as an
   integration decision: staging it will include both its staged baseline and
   all unstaged inherited provenance/instrumentation updates. Do not attempt to
   isolate t370's one fixture line without coordinating with the owners of
   those inherited changes.

## Commands observed

- Exact-path `git status --short`, working/staged diff stats, `git diff
  --check`, and `git ls-files -u` in `F:\!FluxIQ`.
- Exact-path content searches for the reported bounds, packed format,
  measurement rules, and discriminator assertions.
- Direct text-hygiene scans for all nine Core files and five reports.

No tests, builds, provider calls, live runs, commits, pushes, or Core edits were
performed.
