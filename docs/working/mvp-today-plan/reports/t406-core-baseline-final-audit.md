# t406 — Core baseline final audit

## Verdict

**GO.** The final `pnpm structure:baseline` reconciliation made only the legitimate post-T403
change: the existing `file-lines` allowance for
`packages/fluxiq/src/programs/automation-studio/runtime/service.ts` fell from 4,568 to its current
4,558 physical lines. It did not baseline the former 26-file `runtime/llm/tests` violation, add a
finding, or raise an allowance.

A second full Core `pnpm check` is **not required** solely because of this baseline-only reduction.
The final full check already observed the source and test tree; the baseline edit cannot affect any
TypeScript package check, and a post-reconciliation read-only `pnpm structure:check` passed against
the current baseline. This conclusion holds only while source, test, configuration, and generated
files remain unchanged.

## Baseline evidence

T403 captured the pre-reconciliation working-tree baseline diff exactly: `failure-as-empty` fell
18→16, `file-lines` fell 4,584→4,568, and the obsolete `generation-failure.ts` and
`execution-grants.ts` findings were removed. The current HEAD-relative diff contains those same
three earlier reductions/removals, with only `file-lines` lower again at 4,558. Thus the delta made
after T403 is exactly 4,568→4,558.

The current JSON has no `directory-files` entry for `runtime/llm/tests`; its only hard directory
allowances remain `apps/web/src/features/automation-studio/hierarchy` (30) and
`packages/fluxiq/src/programs/automation-studio/model` (28). The current full baseline diff contains
only lowered values and removed keys. No value is new or increased.

Observed from `F:\!FluxIQ`:

- `runtime/service.ts` has exactly 4,558 physical lines, matching the lowered entry.
- `runtime/llm/tests` has 25 direct files; `runtime/llm/evidence-loop/tests` has four.
- `pnpm structure:check`: **PASS**, exit 0, 189 advisory warnings and 358 baselined findings.
  It reported no unbaselined violation and no lowerable baseline entry.

## Moved test and timeout review

The T393 move remains ownership-correct and complete: the old
`runtime/llm/tests/evidence-loop-progress.test.ts` path is absent, the new untracked
`runtime/llm/evidence-loop/tests/progress.test.ts` exists, and its coordinator import is correctly
adjusted to `../../index.ts`. The directory count is now at, not above, the 25-file hard limit.

The final timeout changes match T395/T400: only the three named fixture-heavy cases receive local
`60_000` third-argument budgets. The global 15-second configuration is not changed. The
HEAD-relative `llm-grants.test.ts` diff also contains earlier t166 functional edits, as T395 already
disclosed; those are not part of the timeout correction. `scale-pages.test.ts` updates its opening
comment from two to three locally budgeted cases, consistent with the added case budget.

T395's final root `pnpm test` evidence remains applicable (5,437 passed, one intentional skip), and
T403's build/docs/freshness reasoning remains applicable. No production source, test, generated
reference, or build configuration changed as a result of baseline regeneration.

## Scope

I ran only read-only Git/file inspection and `pnpm structure:check`. I did not run a broad check,
test, build, docs generation, provider, live, stage, commit, or push command. The only file I wrote
is this worker report.
