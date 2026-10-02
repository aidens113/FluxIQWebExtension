# t234 W5: service.ts split of the creation-purse wiring

## Outcome

Done. `service.ts` went from 4518 to 4490 lines (baseline was 4491, now lowered to 4490). The structure audit passes with no FAIL lines. The typecheck is clean, and the 28 named test files (168 tests) pass with the redundant decision-refusal throw removed.

All edits are in the Core worktree `C:/Users/osrs_/FluxStuff/fxwork/t234/!FluxIQ`. Paths below are relative to `packages/fluxiq/src/programs/automation-studio/runtime/` unless stated otherwise. Nothing was committed.

## What changed and why

- **New file `service/flow-bootstrap-commands/creation-purse.ts`** exports `automationStudioFlowBootstrapCreationPurse` and the type `AutomationStudioFlowBootstrapCreationPurse`.
  - Opening the purse: it reads the creation-spend record from the store. A repair build gets carriedUsd 0 and no record. It then constructs `AutomationStudioLlmBuildPurse`.
  - `run(body)`: runs the body under `automationStudioLlmBuildPurseScope`. A `finally` deletes the record when the creation ended; otherwise it saves `spentUsd` and `builds + 1`.
  - `reading(run)`: wraps the authority's run and records `readingRefused` using the moved `purseRefusalOf`.
  - `askPort(port)`: the permission ask port that throws `AutomationStudioLlmBuildPurseRefused` once the reading was refused.
  - `signal(permissions.signal)`: the planRefused AbortController.
  - `endIfReadingRefused()`: the pre-decision throw.
  - `ended(over = true)`: the old `creationEnded` assignment.
  - Also exposes `purse` and a `readingRefused` getter.
  - Every original comment moved with its code.
- **New file `service/flow-bootstrap-commands/built-loop.ts`** exports `automationStudioFlowBootstrapBuiltLoop`. This is the extra cohesive extraction: moving the t234 lines alone left `service.ts` at 4501. It holds the post-phases ending sequence, in the original order:
  1. The unfinished throw. It marks the creation ended when the build ended `not_doable`.
  2. The ended-loop spread.
  3. The personStopped throw.
  4. The permission-request throw when no plan was accepted, with its 4-line comment.
  5. `keeper.exhausted`.
  
  It returns `{ built, loop }`, narrowed. In service.ts the phases result was renamed `phases`. Later uses of `built.trace` and `built.accounting` read the narrowed `built`.
- **`llm/harness/token-limits.ts`**: added `automationStudioLlmDecisionTokenLimits(named)` beside `AUTOMATION_STUDIO_LLM_DECISION_REPLY_TOKENS`, with the same logic and comment. It is exported through `llm/harness/index.ts`. It is in the existing file rather than a new one because `llm/harness/` already holds 25 source files, the fail limit. A 26th file would fail `directory-files`. token-limits.ts now has 10 exported values, which is a warning only (fail limit 15).
- **`service/index.ts`**: now re-exports `./creation-spend.ts`. service.ts imports `AutomationStudioFlowBootstrapCreationSpendStore` from the `./service/index.ts` import block, which fixes the barrel FAIL.
- **`service.ts`**:
  - Imports: dropped the build-purse import, the direct creation-spend import, `AUTOMATION_STUDIO_LLM_DECISION_REPLY_TOKENS`, and the now-unused `flowBootstrapBuildEndingFailure` and `flowBootstrapEvidenceLoopFailure`.
  - The t234 lines are now one-line calls: `creation.run`, `creation.reading(runHarness)`, `creation.askPort(...)`, `automationStudioLlmDecisionTokenLimits(...)`, `creation.signal(...)`, `purse: creation.purse` (x2), `creation.endIfReadingRefused()`, `creation.readingRefused`, `creation.ended()`, and `automationStudioFlowBootstrapBuiltLoop(...)`.
  - `repair: Boolean(repairBrief)` keeps the original truthiness.
- **Removed** `const refused = purseRefusalOf(decision); if (refused) throw ...` after the decision call. The loop's `purse.run` (via `automationStudioLlmBuildPurseRun`) throws `AutomationStudioLlmBuildPurseRefused` whenever `purse.refusal` is set after the call, whether the call returned or threw. Without the line, a refused decision falls through to `throw automationStudioLlmUnusableDecisionError(decision) ?? flowBootstrapHarnessFailure(decision)`, which `purseRun` converts into the same refusal. The `readingRefused` path is kept.
- **`.structure-baseline.json`** (worktree root): updated by `pnpm structure:baseline`; see below.

The decide callback's request composition was not touched apart from removing that one line. t235's lines were not touched.

## Commands run and observed results

- Before any change, `node scripts/structure-audit.mjs` printed:
  - `FAIL [file-lines] ...runtime/service.ts: 4518 lines exceeds the 800-line limit ... Baseline for this entry is 4491`
  - `FAIL [imports] ...service.ts: 1 import(s) reach into another directory's files instead of its barrel, e.g. "./service/creation-spend.ts" at line 219`
- From `packages/fluxiq`, `npx tsc --noEmit -p .; echo $?`: no output, `tsc exit=0`. Run after the main edits and again after the final edit.
- `node scripts/structure-audit.mjs` (worktree root):
  - Before the baseline update: `structure-audit: 2 baseline entries can be lowered.` and `structure-audit: passed (217 warning(s), 349 baselined).`, with 0 FAIL lines.
  - New warnings only: `flow-bootstrap-commands/: 16 source files is past the 15-file advisory threshold` and `token-limits.ts: 10 exported values is past the 8-value advisory threshold`.
- `node scripts/structure-audit.mjs --json` listed the lowerable entries:
  - `exported-values apps/web/src/features/programs/live-views/shared.tsx::values recorded 24 now 23`. This is unrelated to this task and was already lowerable before it.
  - `file-lines packages/fluxiq/src/programs/automation-studio/runtime/service.ts recorded 4491 now 4490`.
- `pnpm structure:baseline` printed `baseline written: 349 entries across 10 rules (2 lowered, 4 removed).`
  - Lowered: service.ts 4491 -> 4490 and shared.tsx::values 24 -> 23.
  - Also removed four stale `swallowed-failure` entries: `apps/web/src/lib/login-attempts.ts`, `apps/web/src/features/automation-studio/state/StateRawPanel.tsx`, `apps/web/src/features/programs/components/data/CodeViewer.tsx` and `apps/web/src/features/programs/live-views/secret-keys.tsx`. All four files exist, are unmodified, and the rule no longer finds anything in them. The default audit output does not report these; the script removes them on update.
- After the baseline update, the audit printed `structure-audit: passed (217 warning(s), 349 baselined).` with 0 FAIL lines.
- From `packages/fluxiq`, `npx vitest run src/programs/automation-studio/runtime/tests/service-bootstrap src/programs/automation-studio/runtime/flow-bootstrap/creation-spend src/programs/automation-studio/runtime/service/flow-bootstrap-commands`: exit 0, `Test Files 28 passed (28)`, `Tests 168 passed (168)`, run with the decision-refusal throw removed.
  - These include `cost-ceiling.test.ts` ("stops a build that never finishes at the ceiling, names cost as its bound…").
  - They also include `creation-spend.test.ts` (a)–(f). (a) is a second build that ends at once on cost. (d) is decision replies of at most 2,000 tokens. (f) ends on cost when the purse refuses the instruction reading.
- After the final `Boolean(repairBrief)` edit: tsc exit 0, and `creation-spend.test.ts` plus `cost-ceiling.test.ts` gave `2 passed / 7 passed`.

## Not verified

- No Lab or live run, as the brief requires. No full package suite was run.
- No new unit tests for `creation-purse.ts` or `built-loop.ts`. They are covered only through the service-bootstrap tests above.

## Open questions or contradictions found

- **The removed throw changes one figure.** Before, a refused decision threw before `estimatedInputTokens += decision.request.estimatedInputTokens`. Now that line runs for the refused, never-sent request before the harness-failure throw that `purseRun` converts. So the cost ending's accounting `estimatedInputTokens` now includes the unsent decision's estimate. The ending kind, the refusal and the spend are unchanged, and no test asserts this figure. If it matters, keep the throw, or move the `+=` after the `!decision.ok` check (that is a line in t235's area).
- `.structure-baseline.json` now records service.ts at 4490. If t235 adds lines to service.ts, it must remove at least as many.
- The worktree also shows uncommitted changes under `docs/architecture/` that are not from this worker.
