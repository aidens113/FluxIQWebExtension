# Archive — where the three capabilities stood, 2026-09-24 to 2026-09-25

Moved out of `../../language-driven-flow-loop-plan.md` on 2026-09-26 under the
compaction threshold. It is the numbered audit of deterministic replay, automatic
repair and self-judgement as they stood after the first two days, and its item 0 —
the wrong-answer repair having never run, because its route was gated on a grant
purpose no instruction-built Flow carries — is the largest finding of the loop to
that point.

**It is superseded as a description of the present** by the Current State and by
`What This Batch Established`. It is kept because its causes are numbered and other
documents and reports cite them by number, notably cause 8, that the repair cannot
amend a node's parameters.

## Where The Three Capabilities Actually Stand

Audited 2026-09-24 against Core `dev` (a055c92) and this repository's `dev`
(0d27f35); full detail in
[reports/mvp-capability-status.md](../reports/mvp-capability-status.md).

**The good news, and it is real: none of the three is a stub.** Deterministic
replay, automatic repair and self-judgement all exist and are all wired into
`service.ts#runRuntimeSession`. Repair has two doors — a failed step, and a
refuted result via `recovery/refuted-result/repair.ts:82` — and a result is
judged wrong by `result-verification/verify.ts:95`, with
`result-check-schedule/decide.ts:39` deciding whether a run is checked at all.
The loop is not missing; it is defective in four specific ways.

**0. The wrong-answer repair has never run, and the cause is still not known.
This outranks the four below.**

**Correction, 2026-09-25.** This entry first claimed the cause was found: that
the route gated on the grant purpose being `explore_and_adapt` while a Flow
built from an instruction runs under `build_and_adapt`. **That was wrong.** The
Lab already grants the *created Flow's own run* an `explore_and_adapt` grant —
`CREATED_FLOW_REPAIR_PURPOSE` in
`packages/test-runner/src/live-llm/live-llm-run.ts`, whose comment records that
this precise trap was found and fixed once before — so the purpose gate was
already being satisfied and Core `85e0d38` widened a gate that was not closed.
That change is harmless and defensible on its own terms, and it was not the
fix. `run-muhpo10p-771abad6`, the first run after it, still made zero repair
calls: its only two calls outside the build were `llm.loop_verification`.

**What is actually established.** Six live runs, every one recording
`runtimePatchAttempts: []`, `adaptationIds: []` and `changeProposalIds: []`,
with no provider call ever attributable to a repair. The two `diagnosis`
interventions in `harnessRecovery` are the ladder's placeholder, written with
the run's first save, and say nothing about whether a repair ran —
`terminal-run-wait.ts` documents that.

**Why it is still unknown, and this is the finding worth keeping.** Core
computes the answer and this facility drops it.
`automationStudioRefutedResultReauthorDecision` returns one of four closed
refusals — `not_a_wrong_answer`, `flow_unavailable`,
`grant_does_not_buy_exploration`, `adaptations_not_permitted` — and records it
on the run detail under `resultReauthor`, beside `resultRepair`'s
`{attempted, nodeId, code}`. Neither key reaches the bundle:
`grep -c resultReauthor bundle.complete.json` is 0. So the supervisor
attributed the silence to a known defect twice, once to the patch vocabulary
and once to the purpose gate, and both were reasoning from absence. t130
publishes both keys.

**The lesson, which is the same one twice.** An empty record is not evidence
about *why* it is empty. Before attributing a capability's silence to a known
defect, publish the decision that capability makes and read it. This is the
second time in two days that a diagnosis had to wait on instrumentation the
loop already knew it needed — the first was the refusal reason that
`sanitizeEvidenceLoopTrace` was dropping.

**The original entry follows, for the record.** It remains true that the route
is worth widening and that the capability is wired end to end.

**0a. The route's purpose gate was narrow, though that was not what blocked
it.** Found 2026-09-25 from `run-muhnh0s5-98a27f42`, after five live runs had
each recorded `runtimePatchAttempts: []`, `adaptationIds: []` and
`changeProposalIds: []` and the supervisor had twice attributed that to defect 1.
It was not defect 1. A Flow built from an instruction runs under the create-flow
entry point, whose grant purpose is **`build_and_adapt`**, and
`recovery/refuted-result/reauthor.ts` gated the route on the purpose being the
single literal `explore_and_adapt`:

    if (input.grantPurpose !== EXPLORING_GRANT_PURPOSE) return { route: false, refusal: "grant_does_not_buy_exploration" };

So every live run of this document's loop reached that gate, was refused, and
stopped. **No wrong answer has ever been repaired, and none of the four defects
below has ever been reached on a wrong answer.** The port was registered in
`service.ts:2601`, the reauthor path was written, the re-run after repair
existed — all of it dead behind one string comparison.

Fixed in Core `85e0d38`: the gate asks whether the grant the run already holds
buys exploring, which `build_and_adapt` answers more plainly than
`explore_and_adapt` does, since it is the purpose the build loop itself runs
under. Written as a set so a purpose added to the contract is a decision rather
than a silent no. 418 recovery tests pass.

**The lesson is larger than the bug.** A capability can be wired end to end,
tested at every unit, and unreachable in production behind one gate, and the
only thing that showed it was reading the live run's own record and following
the gate backwards. An empty `runtimePatchAttempts` was read twice as "the
repair tried and could not express the fix" when it meant "the repair never
started". **Before attributing a capability's silence to a known defect, prove
the capability was entered.** The plan's own audit had declared this door open
on 2026-09-24 by reading the source, and the source was there; what nobody
checked was whether anything could get through it.

**1. The repair cannot express the fixes our failures need.** Verified
directly: the vocabulary is exactly five patch kinds
(`llm/harness/structured-response.ts:155`), every one of them `temporary_` —
an action sequence, a wait/retry, a target override, a recovery subflow call,
and a reroute. **None can amend an extraction's field mapping, change a filter
parameter, or insert a step.** Those are precisely the causes behind the
wrong-answer failures on record. The self-repair criterion cannot be met on a
wrong answer until the vocabulary can express a durable edit to a node.

**2. A wrong-answer repair never re-runs inside its own run.**
`retryRuntimeSessionAfterAutoAppliedPatch` is called *before* verification, and
no graph run follows it, so the "verify, repair, retry, verify" circle the
code's own comments describe only ever closes across two separate runs.

**3. A Flow that stores nothing is never judged, and reports success.** Verified
at `result-verification/verify.ts:189`: `nothingToJudge` returns
`performed: false` when no record set was stored — and separately when a record
set exists but holds no rows, which is still waiting on a hang fixed elsewhere.
A multi-node Flow that navigates, clicks and stores nothing therefore
self-reports success, unjudged. This falsifies exit criterion 4 for exactly the
class of Flow this document targets.

**4. The repair sees a fresh page, not the broken one.** The page captured at
the instant of failure by `domain/src/runtime/adapter.ts` is never read by
Core; the repair is handed a fresh snapshot instead. This contradicts the
standing requirement that a repair be given the page as it was when it broke.

**What breaks first on a multi-node Flow.** A probable defect in
`executor/recovery-budget.ts:3`: `recoveryAttemptsForSubflow` counts retried
attempts where `failedAttemptsForAction` does not, so **one flaky node
exhausting its three retries disarms the authored `failed` route of every later
node.** Then `recovery/refuted-result/attempt.ts:133 resultProducingAttempt`,
which always blames the last record-storing node — on a six-node Flow the
blamed node is routinely not the broken one. Neither is measured; both are read
off source and are the first two things a multi-node run should be watched for.

These four are not fixed pre-emptively. They are what the loop's first
iterations will run into, and each is fixed when a run's debug names it — with
one exception, the 90-second replay bound, which is a harness defect that would
manufacture a false product failure and so belongs in Phase 0.
