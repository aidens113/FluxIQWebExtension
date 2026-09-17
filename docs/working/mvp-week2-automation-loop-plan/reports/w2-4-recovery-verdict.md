# W2-4 — Recovery verdict (Core side)

## Outcome

**Blocked by design, at step 1, as the brief instructs.** The suspected defect
**does not reproduce**. The brief says: "If it does NOT reproduce, stop and
report that — the rest of this brief rests on it." Steps 2, 3 and 4 were
therefore not built.

The defect was real, but it was already fixed in Core commit `a2de143`
("Record success only from evidence that something actually happened"). The
brief was written against a revision of `live-patch.ts` that no longer exists.

## Whether the defect reproduced

It did not. Evidence, in order.

### The named function is gone

`runtimePatchRestoredExpectedState` does not exist anywhere in
`F:\!FluxIQ`:

```
$ grep -rn "runtimePatchRestoredExpectedState" --include=*.ts .
(no matches)

$ git log --oneline -S "runtimePatchRestoredExpectedState" -- .../live-patch.ts
a830217 ...
a2de143 Record success only from evidence that something actually happened
5623495 Implemented first parts of the new FluxIQ adaptations & routing...
```

`a2de143` removed it. The line numbers in the brief no longer address the code
it describes: `live-patch.ts:324-330` is now inside `adaptationFromRuntimePatch`,
and `live-patch.ts:185-187` is inside
`evaluateAutomationStudioRuntimeTargetOverrideProposal`.

What replaced it is `runtimePatchVerification` (`live-patch.ts:297-310`), a thin
projection over `decideAutomationStudioChangeVerdict`
(`runtime/flow-change/verdict.ts`), which owns the rule.

### The behaviour does not reproduce either

Reading is not proof, so I built the scenario the brief specifies and executed
it. I added to `runtime/tests/live-patch.test.ts`:

> `does not report restored state when the patched run re-takes the route the failure took`

It is faithful to production rather than hand-built:

- The comparison is produced by `compareAutomationStudioTransition`, the same
  function the executor uses, so the expectation really is the one
  `expectedTransitionForNode` derives — and the test asserts that it carries
  `expectedRoute: "failed"` inherited from the failed attempt, with no
  `expectedOutputs`. Both assertions pass, so the brief's premise about
  `expected-transition.ts:11-19` is **correct**.
- The changed node is `builtin.policy.recovery` with `strategy: "abort"`, which
  returns `status: "success", route: "failed"`. This is the case the brief
  names: a **succeeded** patched trace containing an attempt **routed
  `failed`**. The test asserts the trial really did this
  (`{ nodeId: "recover", status: "succeeded", route: "failed" }`) — it passes,
  so the scenario was genuinely exercised, not skipped.
- The patch is a `temporary_wait_retry`, run through
  `executeAutomationStudioRuntimePatch`, the production entry point.

Observed result on unmodified Core:

```
$ npx vitest run .../tests/live-patch.test.ts -t "re-takes the route the failure took"
 ✓ src/.../live-patch.test.ts > Automation Studio live patch testing >
   does not report restored state when the patched run re-takes the route the failure took
 Test Files  1 passed (1)
      Tests  1 passed | 22 skipped (23)
```

`restoredExpectedState` is `false`, `retryOriginalAction` is `false`, the
verification is `{ status: "unverifiable", reason: "expectation_empty" }`, the
adaptation is `testing`, and it carries no `validationResults`. So the onward
claim in the brief — that the defect reaches Phase 2.6 by marking the adaptation
`validated` — **also does not hold today**.

### The test has teeth (mutation-tested)

A passing test proves nothing unless it can fail. I verified by reintroducing
the defect. Two independent guards defend this behaviour:

- **Guard A** — `flow-change/verdict.ts`, `expectedRouteCheck`: discards a
  declared route equal to `failureRoute`, returning `not_applicable` with code
  `expected_route_repeats_failure`.
- **Guard B** — `flow-change/trial.ts`, `failedDeclaredRoute`: discards the
  failed comparison's `expectedRoute` when it is `"failed"` and the compared
  attempt failed, on the grounds that it is the executor's default, not a
  declaration.

| Mutation | Result |
| --- | --- |
| Guard B removed only | test **passed** — A still catches it |
| Guard A removed only | test **passed** — B still catches it |
| Guards A **and** B removed | test **FAILED** — defect reproduced |

The failure under both mutations, which is the brief's defect exactly:

```
 × does not report restored state when the patched run re-takes the route the failure took
   → expected true to be false // Object.is equality

AssertionError: expected true to be false
- Expected:  false
+ Received:  true
 ❯ src/.../live-patch.test.ts:356:42
     356|     expect(result.restoredExpectedState).toBe(false);
```

Both mutations were reverted; `git status` confirms `flow-change/` is clean.

I also first wrote a weaker version of this test using the existing
`flowFixture` (no attempt routed `failed`). It passed even with both guards
removed, because the scenario was never reached. I discarded it and rebuilt it
around `builtin.policy.recovery`. Recording this because it is the difference
between a test that proves something and one that looks like it does.

## The verdict contract, as it already exists

The brief's step 2 asks for `decideAutomationStudioRecoveryVerdict` in a new
`recovery/recovery-verdict.ts`. Core already has an equivalent:
`decideAutomationStudioChangeVerdict` in `runtime/flow-change/verdict.ts`. It
satisfies most of what step 2 specifies, which is why I did not build a second
one — a parallel verdict would be the "approximated in a downstream shape"
failure mode, in Core itself.

Mapping the brief's requirements onto what exists:

| Step 2 requirement | Status in Core today |
| --- | --- |
| Per-check status `passed \| failed \| not_applicable \| unknown` | **Present**, exactly: `AutomationStudioChangeVerdictCheckStatus` (contracts.ts:41) |
| An `unknown` required check is not resumable | **Present**: `unknown` never enters `basis`; only `passed` evidence does |
| Action success alone never passes | **Present**: `changed_node_succeeded` and `continuation` are excluded from `AutomationStudioChangeVerdictEvidenceKind`; a verdict with no evidence basis is `unverifiable` |
| Expected transition not inherited from the failed attempt | **Present**, as guard B in `trial.ts` (see step 3 note below) |
| Host evaluation after recovery | **Present**: `expectedStateCheck`, fed by the observed `expectationEvaluator` proxy in `trial.ts` |
| Expected outputs | **Present**: `expectedOutputsCheck` |
| Required evidence conditions | **Present**: `expectedStateCheck` + `downstreamAssertionCheck` |
| Continuation (next node, route, subflow) | **Partly**: `continuationCheck` returns `resumeFrom: {nodeId, route}` or `{completed: true}`. **No subflow field.** |
| `resumable` as an output field | **Absent as a field.** Expressed as `outcome === "verified"` plus the presence of `resumeFrom` |
| Records completeness via an interface | **Present in shape, dead in practice** — see below |

### Two real gaps I did verify

**1. `records.minimum` is never populated.** `AutomationStudioChangeVerdictAttempt.records`
is typed `{ captured: number; minimum?: number }` (contracts.ts:104), and
`recordsCheck` reads it (`verdict.ts:165`, code `records_below_minimum`). But
the only producer, `capturedRecords` in `trial.ts`, returns `{ captured }` and
nothing else. Grep for `minimum` across `runtime/` confirms no writer. So the
records-completeness branch can today only reach `passed` (captured > 0) or
`unknown` (`records_none_captured`); `records_below_minimum` is unreachable
from a trial. This matches the brief's expectation that the real signal arrives
with extraction X4 — the seam exists and is currently inert.

**2. No `resumable` / no subflow in the resume point.** If Phase 2.4's actual
goal is for FluxIQ to state plainly whether deterministic execution can resume,
the honest gap is not the defect described in the brief — it is that the verdict
answers "was this change proved?" rather than "can the run resume, and where?".
`resumeFrom` is only emitted on a `verified` verdict, so a change that is
`unverifiable` but whose continuation is nonetheless well defined yields no
resume point at all.

## Step 3 note

The brief asks for a node-definition-only variant of `expectedTransitionForNode`
so the verdict does not inherit `"failed"`. That concern is already handled, but
in a different place: `trial.ts` discards the inherited `"failed"` at the point
of reading it (guard B), rather than `expected-transition.ts` never producing
it. `expectedTransitionForNode` still returns `expectedRoute: "failed"` for a
failed ordinary action node — my test asserts this and it passes — because that
value is load-bearing for the executor's own comparison of the failure. I did
**not** change `expected-transition.ts`; doing so would alter the failed-attempt
comparison for every consumer, not just the verdict.

## Commands run and observed results

All run from inside `packages/fluxiq`, never the repository root, as instructed.

```
$ npx vitest run .../tests/live-patch.test.ts -t "re-takes the route the failure took"
  ✓ 1 passed | 22 skipped (23)          [unmodified Core]

$ npx vitest run .../tests/live-patch.test.ts .../tests/live-patch-target-override.test.ts
  ✓ live-patch-target-override.test.ts (40 tests)
  ✓ live-patch.test.ts (23 tests)
  Test Files  2 passed (2)
       Tests  63 passed (63)

$ npx vitest run .../runtime/executor/tests/ .../runtime/flow-change/tests/
  ✓ 13 files: graph-run (22), node-execution (39), verdict (45), trial (22),
    attempt-trace (26), record-capture (28), trace-withholding (11),
    transition-comparison (9), start-node (13), confidence (20),
    contracts (12), recovery-ladder (5), record-summary (6)
  Test Files  13 passed (13)
       Tests  259 passed (259)

$ npx tsc --noEmit
  === tsc exit: 0 ===        [no output]
```

No flaky, uniform or non-reproducible failures occurred, so no hardware-related
rerun was needed.

## Files changed

One file, which the brief assigns me:

- `F:\!FluxIQ\packages\fluxiq\src\programs\automation-studio\runtime\tests\live-patch.test.ts`
  — added one test and two fixtures (`recoveryRouteFlowFixture`,
  `recoveryFailedAttempt`), +83 lines. `git status` shows this as the only
  modified file under `packages/fluxiq/`.

I did **not** create `recovery/recovery-verdict.ts`, its tests, or the
`recovery/` barrel entry, and I did **not** modify `live-patch.ts` or
`expected-transition.ts`, because step 1 stopped the brief. I did not edit
`service.ts`, and nothing I found requires a change there. Nothing committed.

**The added test is a genuine regression test, not scaffolding**: it pins the
exact behaviour Phase 2.4 exists to protect, and it is mutation-proven to fail
if either guard is removed. I recommend keeping it. It is trivially revertible
if the supervisor disagrees.

## Not verified

- **Real browser or live-provider behaviour.** Everything here is Core unit
  tests against in-memory fixtures. No DeepSeek run, no extension, no live
  recovery.
- **The full Core suite.** I ran the executor, flow-change and live-patch tests
  (322 tests) plus a full-package `tsc --noEmit`, not `pnpm test` across Core.
- **Whether Phase 2.4's real goal is met.** I proved the brief's specific defect
  is absent. I did not prove that FluxIQ can, in general, state honestly whether
  deterministic execution can resume. The two gaps above are the places I would
  look, and I did not close them.
- **A stable tree.** Another agent was editing this same Core checkout while I
  worked — see "Concurrency" below. My results were taken against a tree that
  moved underneath me.
- **Other callers of the verdict.** I checked the one production call site of
  `executeAutomationStudioRuntimePatch` (`recovery/annotation/patches.ts:145`)
  and confirmed it passes `input.failedAttempt.transitionComparison`, as the
  brief says. I did not audit every consumer of
  `decideAutomationStudioChangeVerdict` for the same class of vacuous-pass bug.
- **Phase 2.6 impact.** I verified the adaptation is not marked `validated` in
  this scenario. I did not trace what Phase 2.6 does with it downstream.

## Concurrency — read my results with this in mind

Another agent was editing `F:\!FluxIQ` on `dev` while I worked, in the same
checkout, with no worktree isolation.

- When I started, `packages/fluxiq/` was clean and HEAD was at the `a830217`
  lineage. When I finished, HEAD was `1be6c9e` ("Let the model write a Flow as
  plain lines") and three files I do not own were modified:
  `model/flow-adaptation.ts`, `model/validation/adaptation.ts`,
  `storage/project/adaptation-store.ts`. I did not touch them.
- This is precisely the hazard `AGENTS.md` warns about: a validation run that
  reads a tree someone else is editing can report false results in either
  direction.
- Mitigation: after noticing, I re-ran the live-patch suite against the moved
  tree — `23 passed (23)` — and re-confirmed `flow-change/` is clean and my file
  is the only one I changed (+83 lines). My central finding rests on a
  *negative* result plus a mutation that *did* fail on demand, so a concurrent
  edit would have to have been remarkably well aimed to fake it. I still flag it
  rather than let the numbers stand unqualified.
- My `tsc --noEmit` (exit 0) and the 259-test executor/flow-change run were
  taken **before** HEAD moved and were not repeated afterwards.

## Open questions / contradictions found

1. **The brief rests on a stale reading of Core.** Every line number it cites is
   wrong, and the function it names was deleted in `a2de143`. Whatever produced
   this brief was reading an older checkout or stale context. Worth finding out
   before the other Week 2 Phase 2.4 briefs are trusted — sibling briefs written
   at the same time may rest on the same stale read.
2. **Does Phase 2.4 still have work?** The defect is fixed, but the stated goal
   ("say honestly whether normal deterministic execution can resume") is not
   obviously met, for the two reasons under "Two real gaps". If the supervisor
   wants that, the work is *extending* `decideAutomationStudioChangeVerdict` —
   adding a resume decision separable from the evidence verdict, and a subflow
   in the resume point — not building a second verdict in `recovery/`. I did not
   do this because it is outside a brief whose step 1 told me to stop.
3. **Should the records seam be filled now or with X4?** `records.minimum` has a
   reader and no writer. That is inert rather than wrong, but it is the kind of
   thing that reads as working until someone depends on it.
