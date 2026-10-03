# t244-w4a: service-bootstrap tests (a), brought under the full-judged-run rule

## Outcome

Partial. All 42 tests in the seven files I own pass at runtime (before this: 15 failed, 27 passed). No source file, `fixtures.ts`
or other test file was touched. `tsc --noEmit` still fails on these files, and the cause is the shared helper
`R/tests/replaying-binding.ts`, which I am not allowed to edit (see Open questions). Once the helper's signature is fixed, I
expect these files to typecheck without further change, but I have not verified that.

R = `packages/fluxiq/src/programs/automation-studio/runtime`; files are under `R/tests/service-bootstrap/tests/`.

## What changed and why (per test)

Two causes recur across these tests:

- **(A) Stand-in did not say how to run its steps again.** Every completion was refused with `llm_evidence_loop.full_run_required`
  until the budget ran out (`flow_bootstrap.evidence_budget_exhausted`).
- **(B) The provider had no reply for the judge, or no step was added.** Either the judge request got a decision reply, or the
  build had no proposed step at all ("no step of this Flow has run in this build").

| File / test | Cause | Change | Result |
| --- | --- | --- | --- |
| creation-spend: (b) clears the record when a build proposes a Flow | A, plus no judge reply (B) | Wrapped `acting` in `automationStudioReplayingBinding`; provider answers judge requests `judgeReply("yes")` without counting them as decisions | pass |
| incomplete-draft: keeps the proposable steps ... next build continues and clears it | A + B, same pattern as above | Same: wrapped binding, judge answers yes. The resumed steps keep `ranWith`/`replay` through the store, so the continuation's test runs. | pass |
| judged-build: "proposes the Flow, said to be unverified, when the build has no cost left to ask the judge" | Its premise was the old rule. `not_judged` no longer finishes a build. | **Rewritten** as "ends at its budget with the Flow kept, never proposed unjudged, when the build has no cost left to ask the judge". It asserts: the judge was never asked; `flow_bootstrap.evidence_budget_exhausted`; the ending is `{kind: budget_exhausted, bound: cost, tried: {rounds 1, stepsInFlow 1, tested: replayed_clean}}`; the message says "not judged" and "The Flow so far was kept"; `incompleteDraft {revision 1, steps 1}`; no topology; no "Flow not verified" note. File header comment updated to match. | pass |
| generation: runs a bounded evidence loop and persists only content-free trace | B: completed straight away with no step. In a 3-call build, the first decision is already in the wrap-up (`llm/loop-budget.ts`, last 3 decisions offer no tools), so no step could be added. | Wrapped binding. The model adds one kept read (`inspect` with `{keep:true}` and `add:true`; the stand-in answers an execution result with `draft.proposes: true`) and then completes. `maxCallsPerRun` is 3 -> 4. Expected counts updated to 2 decisions + judge, a 3-row trace, providerCallCount 2, toolCallCount 2, and accounting of 2 decisions + judge. The content-free trace assertion is kept. | pass |
| generation: keep gathering past eight decisions (looks 10, calls 11, finishes) | B: no kept step. The last look fell inside the wrap-up. | The first look (iteration 1) is the kept read; the others are unchanged. Counts are unchanged (11 decisions + judge). The non-finishing case uses the same binding and still passes. | pass |
| generation: packs opted-in reusable context only after a fresh creation inspection | B, as in the first generation case | Wrapped binding; kept read then completion; `maxCallsPerRun` 3 -> 4; judge answers yes. Selection runs before each decision (`service.ts` ~1590), so the assertions are now: selected once per decision, the first selection equals exactly the fresh creation inspection's evidence, and the stored `freshContributionCount` is 2 (the last selection's). | pass |
| permission-ask: opens the ask under the request's own id, carries on, held until a grant | A + B: the refused refund was the only step, so there was no Flow to test | `build()` now adds a free "Open order" step after the refused refund (`add:true`); the stand-in asks nobody for it. Wrapped binding; judge answers yes. The provider now also answers the tool-less instruction read, as `checkoutBuild` already did; without that, the read consumed a scripted decision. `acted` is still `[]`. | pass |
| permission-ask: goes ahead with the action when granted while the build waits | A + B | Same `build()`: the granted refund is added and run. Assertions unchanged. | pass |
| permission-ask: asks about another control after a decline, presses it once granted | A + B | `checkoutBuild`: both presses now have `add:true`; wrapped binding; judge answers yes. Assertions unchanged. | pass |
| permission: carries on when an exploration step needs it, proposes what it could build | B: the Flow it "could build" was a written plan with no step that ran | Decisions are now refund (refused), press OPEN (add), complete. Asserts `pressed == [OPEN]` (the refund is still never taken), 3 decisions + judge, and the same `permissionRequest` and review/topology checks. | pass |
| permission: builds a Flow with no lasting consequence without asking | A | Wrapped `refundingBinding` in `build()` | pass |
| permission: keeps what the instruction asked for ... once the person permits the money | A | Same wrap. Also given a 30 s timeout: it takes about 6.4 s alone (build, test, judge, approve, apply) and hit 15 s once in the 7-file parallel run. | pass |
| permission: never reads the instruction for a build with no lasting consequence | A | Same wrap | pass |
| permission: takes the action while exploring and builds the Flow that takes it | A | Same wrap | pass |
| person-needed: waits for the person, and on Continue goes on ... with the step kept | A, plus the act decision had no `add:true`, so the draft had no proposable step | Wrapped binding (replay calls never reach `calls`); the act decision now has `add:true`. Assertions unchanged, including `calls == [look, act, look]` and 2 decisions + judge. | pass |

No test disables the rule, fakes a signature, or works around the gate. Every finishing build runs its dry run through the
helper and is judged `yes` by the real phases, which compare signatures.

## Commands run and observed results

All runs were in `C:/Users/osrs_/FluxStuff/fxwork/t244/!FluxIQ/packages/fluxiq`.

- Before: `npx vitest run <7 owned files> --reporter=json` printed:
  - creation-spend 7/1
  - generation 5/3
  - incomplete-draft 1/1
  - judged-build 4/1
  - permission-ask 1/3
  - permission 6/5
  - person-needed 3/1
  - Total: 15 failed, 27 passed. The failures were `flow_bootstrap.evidence_budget_exhausted` or `flow_bootstrap.permission_required`.
- After, the same command with the 7 files together printed:
  - creation-spend 8/0
  - generation 8/0
  - incomplete-draft 2/0
  - judged-build 5/0
  - permission-ask 4/0
  - permission 11/0
  - person-needed 4/0
  - Total: **42 passed, 0 failed.**
  - An earlier parallel run of the same files showed one 15 s timeout in permission ("permits the money"). Rerun alone with
    `--no-file-parallelism`, it printed 11 passed (6421 ms for that case). It now has a 30 s timeout, and the final parallel run
    passed.
- `npx tsc --noEmit -p tsconfig.json` exited 2. Every error in my files is at an `automationStudioReplayingBinding(...)` call site:
  - creation-spend:149
  - generation:217, 277, 325
  - incomplete-draft:75
  - permission-ask:198, 308
  - permission:252
  - person-needed:200

  The same error appears in files I do not own (state-digest-and-trace, unfinished-build, unreadable-replies, extend,
  plan-parameters, provider-unavailable, refuted-result/repair-replay-chain, deepseek-bootstrap/harness).

## Not verified

- That my files typecheck once the helper is fixed.
- The whole package suite was not run (per the brief).
- No live or browser behaviour was checked.

## Open questions or contradictions found

1. **Helper type defect (`R/tests/replaying-binding.ts`, read-only for me).** The generic
   `automationStudioReplayingBinding<B extends { executeTool: Executor }>(binding: B)` causes two errors:
   - A binding already typed `AutomationStudioLlmEvidenceRuntimeBinding` fails the constraint (TS2345). Its `executeTool`
     requires `projectId`, `flowId` and `permission`, which the helper's `Executor` input
     (`{callId, toolId, value} & Record<string, unknown>`) does not provide. Parameter contravariance then rejects it.
   - An inline literal is inferred from `B`, not contextually typed, so `effect: "mutate"` widens to `string`, and the result is
     not assignable to `llmEvidenceRuntime` (TS2322).

   Suggested fix, in the helper only:

   ```ts
   export function automationStudioReplayingBinding(binding: AutomationStudioLlmEvidenceRuntimeBinding): AutomationStudioLlmEvidenceRuntimeBinding & { replays: AutomationStudioReplayingBindingCalls }
   ```

   with `executeTool: async (input) => ...` typed from the binding. My call sites pass either inline literals, a typed binding,
   or executors whose parameter is narrower (`{ value: JsonObject }`), all of which that signature accepts.
2. **Observation, not a defect.** A tool call without `add: true` yields no proposable step even when it applied (person-needed,
   permission-ask). Tests that relied on the old "no proposed step, proposed untested" path needed `add:true` added. This matches
   the refusal's own instruction ("add true").
3. **Observation.** The tool-less instruction read (`context.evidenceLoop.tools.length === 0`) also reaches scripted providers on
   a money refusal. A provider that does not answer it loses one scripted decision; see permission-ask `build()`.
