# Forward-mode rerun in place, and `unrun` reruns (run-mwc60eal-4c9fdf6f)

Worker report for E1. Core paths are relative to `C:/Users/osrs_/FluxStuff/fxwork/t885/!FluxIQ/packages/fluxiq/src`.
This implements the two fixes in `rerun-reset-and-repeat-identity.md`.

## Outcome

Partial. Both fixes are in place and every acceptance check passes. One item is not wired.

- **Not wired:** the forward-mode repeat check in `request.ts` is implemented and tested, but no caller turns it on yet.
- **Why:** turning it on needs a one-line edit in `runtime/llm/decision-handlers/amendment.ts:75`. That file is not in my owned paths, the brief said to ask first, and I had no way to tell which running agent is E1. So I did not edit it.
- **Edit needed** (append the last argument):
  ```ts
  automationStudioLlmEvidenceRerunRequest(decision.amendments, draftSteps, context.toolIds, (toolId, input, at) => context.repeats.blocks(toolId, input, at), context.input.deniedEvidenceKeys, { rerunsInPlace: context.input.rerunsInPlace === true })
  ```
- **Until then:** in forward mode, a rerun's `changes_nothing` check still looks at the step's start page (`stateBefore`), as it does today. Everything else in Fix 1 is wired end to end.

## What changed and why

### Fix 1: in forward mode, a rerun runs in place

- **`runtime/llm/loop-configuration.ts`.** New loop input `rerunsInPlace?: true`. It says the caller puts no page back (D1). Its documentation says that a rerun runs from the page as it stands, that the call still passes the act gate, and that without the flag a rerun is put back first.
- **`framework/.../answer-first/attempt/round.ts`.** Sets `rerunsInPlace: true` next to `dryRun: false`.
- **`runtime/llm/node-tools/step-place.ts`.**
  - New input `rerunsInPlace`. When it is set, `automationStudioNodeRerunFromItsPlace` returns from `inPlace()` before the lasting-act branch. It never calls `putBack`, `redo` or `lastingActPlace`, so nothing is sent, not even for a lasting act.
  - Order of checks: no start page gives `start_page_unknown` (unchanged); the current page equal to the step's `stateBefore` gives `already_there` (unchanged); anything else gives `{ kind: "in_place", why: "forward_run", from }`.
  - `AutomationStudioNodeRerunPlace` has the new member.
  - `placeNote` writes `{ place: "in_place", reason: "forward_run", stepStartedOn, detail }`, using the report's generic wording.
  - A header paragraph cites the run.
  - Without the flag, behaviour is unchanged. The existing tests and the new "flag off" test show this.
- **`runtime/flow-authoring/draft/step.ts`.** `rerunPlace` gains `{ kind: "forward_run" }`. `automationStudioNodeRerunPlaceOfStep` already maps `in_place` to `{ kind: why }`, so the step records `forward_run` with no other change.
- **`runtime/result-verification/build-test/landing.ts`.** `orderOf` reads `forward_run` the same way as `already_there`. With proposed steps before it, the press is not counted ("it ran on the page as it stood, without the steps before it done again first"). The header is updated.
- **`runtime/llm/evidence-loop/rerun/request.ts`.** A new optional last parameter `options.rerunsInPlace`. When it is set, `ranAlready` gets no `at`, so the check runs against the current page. This is not wired yet; see Outcome.
- **`runtime/llm/evidence-loop.ts`.** Passes `rerunsInPlace: input.rerunsInPlace === true` to the placement call.
- **`framework/.../answer-first/attempt/call-chain.ts`.** The `no_reset` refusal stays as a backstop.
  - The header now says that reruns no longer send a reset, and that a reset reaching the chain is a Core defect.
  - New `NO_RESET_SAID`: "This call would have put the page back to an earlier place, and an attempt goes on from the page as it stands, so nothing was sent and the page did not move. Carry on from here; to work on another page, go to it with an ordinary call." It no longer mentions the task.

### Fix 2: `unrun`

- **`runtime/llm/repeat-guard/outcomes.ts`.**
  - New field `unrun?: boolean` on `AutomationStudioLlmEvidenceCallOutcome`.
  - `recorded` returns early for `unrun` exactly as it does for `checked`: it still moves the last page seen and still ends a run of looks, but stores no outcome under the call's key.
  - A header paragraph cites the run and says the decision-level `same_amendment` record stays.
- **`runtime/llm/evidence-loop.ts`.**
  - The rerun's place is kept in `rerunAt`, declared with the other rerun locals. It used to be a `const place` inside the try block.
  - `recorded(...)` gets `unrun: true` when `rerunAt?.kind === "unreachable"`.
  - `amendment.ts` is untouched, so `amended` / `same_amendment` still applies.
  - The file is still exactly 800 lines.
  - My first version packed two statements on one line, and the structure audit failed it (`statement-packing` went from 19 to 20). That is why `place` was hoisted into `rerunAt`.

### Tests

- **`runtime/llm/node-tools/tests/step-place.test.ts`.** New describe block, 4 tests:
  - a step that started elsewhere gives `forward_run`, nothing is sent, the note says so, and the step records `forward_run`;
  - a lasting act (declared `create_new`) sends nothing either;
  - `already_there` and `start_page_unknown` are unchanged;
  - with the flag off, a reset is still sent.
- **`runtime/llm/evidence-loop/tests/rerun-place.test.ts`.**
  - In a loop with `rerunsInPlace`, the calls are exactly `read.1`, `rerun.1`, with no reset. The answer carries `forward_run` and `stepStartedOn: {location: "p1"}`, and the draft step has `rerunPlace.kind: "forward_run"`.
  - After an unreachable rerun, the model's identical read runs. The navigate shape of run-mwc60eal step 9 also runs, without `repeat_refused`. The calls are `go.1`, `go.2`, `rerun.1.place`, `go.3`.
- **`runtime/llm/evidence-loop/tests/rerun-request.test.ts`.** With `{ rerunsInPlace: true }`, `ranAlready` is called with no `at`, and the rerun is requested.
- **`runtime/llm/repeat-guard/tests/unrun-rerun.test.ts`.** New file, 3 tests:
  - `unrun` does not block the identical call;
  - it still updates `state()`;
  - the same record without `unrun` still blocks, as `failed`.
- **`runtime/result-verification/build-test/tests/landing.test.ts`.** A `forward_run` press with steps before it is not counted.
- **`framework/.../attempt/tests/call-chain.test.ts`.** The backstop still refuses a reset, and the new wording is asserted, including that it does not contain "task".
- **`framework/.../answer-first/tests/endings/tests/rerun-reset.test.ts`.** Rewritten:
  - no reset reaches the target;
  - the rerun's read reaches the target exactly once;
  - the model is told `forward_run` and `stepStartedOn`, and is not told `rerun_place_unreachable` or `answer_first.no_reset`;
  - the result is reached with 3 rows and `card: 1`.

  On the first run this test failed. I had asserted that the rerun's `replay` was undefined, but it was `"verify"`. The read's act is done, so `rerun-check.ts` sends the rerun as the dry run's check. That is existing behaviour, which the decision keeps ("a done act is still rerun as a check"), so the test now asserts `"verify"`.

## Commands run and observed results

All commands went through `node C:/Users/osrs_/FluxStuff/fxwork/.tools/heavy-slot.mjs run t885 -- ...`, run from the Core worktree.

1. `pnpm --filter fluxiq check` (first pass) printed `{"build-cache":"build","step":"fluxiq:check",...}` and no TS errors. The exit code was masked by `| tail` in that invocation.
2. `pnpm --filter fluxiq test -- src/runtime/llm src/runtime/flow-authoring/draft src/runtime/result-verification/build-test src/framework/automation-service/service/answer-first` (first pass):
   - parallel group: `Test Files 391 passed (391)`, `Tests 3802 passed`;
   - real-sql group: `1 failed | 60 passed (61)`. The one failure was `rerun-reset.test.ts`, "expected 'verify' to be undefined", fixed as described above.
3. `pnpm structure:check` (first pass) failed: `FAIL [statement-packing] .../runtime/llm/evidence-loop.ts: 20 lines hold more than one statement ... Baseline for this entry is 19`. Fixed by hoisting `rerunAt`.
4. Recheck, a single script `w-fwd-recheck.sh` in my scratchpad that ran all three after the fixes:
   - `pnpm --filter fluxiq check` gave `== tsc exit 0`;
   - `pnpm structure:check` gave `== structure exit 0`, with no FAIL or violation lines;
   - the same vitest command gave: parallel `391 passed (391)`, `3802 passed`; real-sql `61 passed (61)`, `424 passed (424)` (including `rerun-reset.test.ts`); `[vitest-groups] all groups passed: parallel, real-sql`; `== vitest exit 0`.

## Not verified

- **The forward-mode repeat check in a live loop.** It is not wired (see Outcome). It is tested only at the `automationStudioLlmEvidenceRerunRequest` level.
- **That the new unrun loop tests fail without the fix.** I reasoned it rather than ran it. Without `unrun`, the unreachable rerun is recorded `failed` under the merged input on the same page, which is the report's reproduction.
- **Live web-domain behaviour.** No Lab or browser run, and Core's dist was not built. In particular, `rerun-check.ts` sends a done act's check with `from: step.replay.from`. Whether the web domain's `verify` moves the page to that `from`, which would be a put-back in all but name, was not checked.
- **Wider suites.** Nothing outside the four named directories was run.

## Open questions or contradictions found

1. **The `amendment.ts:75` threading.** It needs E1's go-ahead, or E1 can apply the edit above.
2. **A done act's rerun check carries `from`** (`rerun-check.ts`, `checkCall`). If the web domain's verify navigates to `from`, a forward-mode rerun of a done act would still move the page. That is outside this brief's files and is worth a look.
3. **Landing semantics.** A `forward_run` press with no proposed steps before it counts as landing (`after: []`), the same as `already_there`. That follows the report's "read like `already_there`". Making it never count would be stricter.

```text
Outcome: Partial
Changed: framework/automation-service/service/answer-first/attempt/{call-chain.ts,round.ts,tests/call-chain.test.ts}; framework/automation-service/service/answer-first/tests/endings/tests/rerun-reset.test.ts; runtime/flow-authoring/draft/step.ts; runtime/llm/{evidence-loop.ts,loop-configuration.ts}; runtime/llm/evidence-loop/rerun/request.ts; runtime/llm/evidence-loop/tests/{rerun-place,rerun-request}.test.ts; runtime/llm/node-tools/{step-place.ts,tests/step-place.test.ts}; runtime/llm/repeat-guard/{outcomes.ts,tests/unrun-rerun.test.ts (new)}; runtime/result-verification/build-test/{landing.ts,tests/landing.test.ts}
Validation: `pnpm --filter fluxiq check` -> exit 0; vitest on the 4 dirs -> parallel 391/391 files (3802 tests), real-sql 61/61 files (424 tests), all passed; `pnpm structure:check` -> exit 0
Not verified: request.ts forward check in a live loop (amendment.ts not wired); live web behaviour; whether verify with `from` moves the page
Report: C:/Users/osrs_/FluxStuff/fxwork/t885/!FluxIQWebExtension/docs/working/mvp-seal-plan/reports/live-checks-r3/forward-rerun-and-unrun.md
Notes: The forward-mode repeat check needs one argument added at amendment.ts:75 (not owned; edit is in the report). Everything else is wired and green.
```
