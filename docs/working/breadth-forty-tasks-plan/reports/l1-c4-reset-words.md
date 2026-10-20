# l1-c4-reset-words: worker report

## Outcome

Done. Core's own looks are now wired into both reset paths in the brief ports. A reset brief settles what it can before the model's first decision. The reset task, the `project.reset_acts_in_place` refusal and a reset's `done` words now say what `cannotUndo` actually does, and each open act carries its `settle` sentence.

## What changed and why

Core worktree `C:/Users/osrs_/FluxStuff/fxwork/t724/!FluxIQ`, `RT/` = `packages/fluxiq/src/programs/automation-studio/runtime/`.

- `RT/service/project-build/brief-ports.ts` (516 lines)
  - New helper `looking(reader, calls, signal)`. It calls `reader.lookAt(location, signal)`. If the answer is a read, it passes it to `calls.observed(read)`, which routes it to the project ledger, the brief's own ledger and every owner ledger (`./reset-calls.ts`).
  - The builder's `phaseStart.reset(...)` checks gain `lookAt: looking(reader, calls, signal)`.
  - `remainingActs` now takes `{ check, calls }`. It gives every owner ledger's `beforeTrial` a `lookAt` that visits each location once per call. It returns acts from `openActs()`, as each owner's `forBrief(owner).inPlace()` names them, so `settle`, `call` and `stillThere` come through. Before, it returned only `{act, did}`.
  - Reset port: it runs `remaining()` once before returning (settle first). The `remainingActs` it hands to the dispatcher is that same closure.
  - `resetTask` lists `openActs()` with these changes:
    - An act with no call whose ref matches `#step-N` reads ` (made by step N of a trial run)` instead of `, page not read`.
    - An open act gets `. What settles it: <settle>` added.
    - The third `RESET_TASK` sentence now mentions the trial step and the settle sentence.
    - The old last sentence is replaced by two true ones: `cannotUndo` reports to the judge an act the site cannot undo, but it never settles a reversible act whose watched state still differs. Such an act stays listed with what settles it. If the site truly cannot reverse it, the reset completes with an honest unresolved summary naming it, and the build ends without a further trial.
  - Added a header paragraph (L1).
- `RT/project-agents/dispatch/reset-loop.ts`
  - The refusal's `actsToUndo` now includes `settle`.
  - New instruction text (`RESET_INCOMPLETE_WORDS`). It no longer says "kept as done".
  - Header rewritten.
  - **Behaviour change beyond pure wording, made so the new words are true:** `checkCompletion` now accepts (`ok: true`) a completion that names every act still listed under `cannotUndo`, but only if an earlier refusal had already listed each of those acts with its settle sentence. The reset then returns `blocked` through `ending.reset`, reading "The reset completed. N act(s) still to undo: ...". Without this, the honest unresolved completion the task asks for would be refused until the repeat guard stopped the loop.
- `RT/project-agents/dispatch/reset-done.ts`: reads why an act stayed from `forBrief(owner).standing(act)`:
  - `unchanged` -> "nothing it could change showed a change"
  - `kept` -> "the site offers no way to undo it"
  - `irreversible` -> "FluxIQ cannot undo it"

  The `kept()` claim probe is removed. Header updated.
- Tests:
  - `RT/project-agents/dispatch/tests/brief-loops.test.ts`: the t591 pin was updated to the new words and now also asserts `settle` in `actsToUndo`, the true `cannotUndo` sentence, and that "kept as done" is gone. New case: a second `cannotUndo` naming, made after a refusal, ends the reset `blocked` with the act still to undo.
  - `RT/project-agents/dispatch/tests/reset-done.test.ts`: new case for an act settled `unchanged` (real project ledger, Core's own look).
  - New `RT/service/project-build/tests/project-build-reset-settle.test.ts` (3 cases) drives `automationStudioProjectBuildBriefPorts` directly. It mocks the phase start down to its real project reset, and the harness options down to one run-node tool over a stub reading-list site. It covers:
    - reset port settle-first: one look at `loc:list`, the read reaching the builder's, the other brief's and the reset's own ledger, act-1 `restored`, zero model requests;
    - task wording: act-1 absent; act-2 `, page not read`; act-3 `(made by step 2 of a trial run). What settles it: <ledger's settle>`; the new `cannotUndo` sentences;
    - a builder's trial reset looking itself and its read reaching every ledger.

  Fixtures are generic opaque tokens.
- Mutation check: with the builder `lookAt` and the settle-first call removed, all three new port tests failed. The file was then restored (backup at `C:/Users/osrs_/AppData/Local/Temp/claude/c--Users-osrs--FluxStuff--FluxIQWebExtension/22166e26-c1c5-4e4e-bb9e-c535c9663b2b/scratchpad/c4-brief-ports.bak`).

## Commands run and observed results

- Baseline before edits: `npx vitest run .../service/project-build .../project-agents` -> 84 files, 535 tests passed.
- After edits, same command -> `Test Files 85 passed (85)`, `Tests 540 passed (540)`.
- `npx tsc -p packages/fluxiq/tsconfig.json --noEmit` -> no output, exit 0.
- `node scripts/structure-audit.mjs`:
  - first run: one FAIL [imports], my new test importing `site-reset/project-reset.ts` directly inside a mock factory. Fixed by importing the barrel.
  - rerun: `structure-audit: passed (409 warning(s), 1152 baselined)`, exit 0.
- Line counts: brief-ports 516, reset-loop 102, reset-done 48, brief-loops.test 229, reset-done.test 66, reset-settle.test 202. All are under 800.
- Grep for the old sentences across `packages/fluxiq/src`: the only test pin was `brief-loops.test.ts`. `llm/deepseek/tests/system-prompt.test.ts` and `flow-bootstrap/plan/tests` do not reach these words. "the site offers no way to undo it" also appears in `supervisor/left-on-target.ts`, `activity/wording/left-told.ts` and their tests. Those are their own words and were left untouched.

## Not verified

- No live or Lab run. Whether the new task and refusal words change model behaviour on real sites is unmeasured.
- The settle-first `beforeTrial` run can raise `askedFor` on an act before the model has seen it: a policy refusal counts as "asked". That makes a legacy act eligible for `cannotUndo` keeping on the model's first completion. The task lists the act from the first decision, so I judged this acceptable, but no test covers it.
- The builder path was exercised only through `reset.beforeTrial`, not a whole subflow trial gate run.

## Open questions or contradictions found

- The reset-loop acceptance of an all-`cannotUndo` completion is my reading of "the reset completes with an honest unresolved summary naming it". The supervisor should confirm it wants this rather than refusing until the repeat guard stops the loop.
- "the build ends without a further trial" is true because the ledger refuses trials while a strict act is unsettled (`unprovedReset`). It is not an explicit supervisor rule. Supervisor-side handling of a `blocked` reset was outside my files.
- No ledger API was missing.
