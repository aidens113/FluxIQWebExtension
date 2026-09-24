# Report: empty-result-judgement

## Outcome

Done. An empty result is now judged against the person's instruction like any
other result, in both forms — a record set holding no rows, and a run that stored
no record set at all. The judgement can conclude *satisfied* as readily as
*refuted*, and a refutation reaches the wrong-answer route on exactly the path a
non-empty refutation takes. The exemption is gone, not weakened.

The hang the exemption was built around **was never root-caused**, so it could
not be "fixed first" as the brief asked. I did not remove the guard and leave a
path that can hang: the whole verification now runs inside one deadline, and a
verification that does not settle is recorded as one that did not finish rather
than stalling the run. Details and evidence below.

Core only. Branch `dev` in `F:\!FluxIQ`. Nothing committed. I touched nothing
under `runtime/flow-bootstrap/**` or `runtime/action-permissions/**`.

## Is the 2026-09-20 hang still reachable? Yes, in the sense that matters

**It was never diagnosed, so there is nothing to have been fixed.** The whole of
Core's t024 change is commit `5616d73` "Settle empty run results before provider
resolution" — two predicates, two files, no provider, grant, session or database
code. The two downstream worker reports say plainly that the cause was not
found:

- `w2-t024-post-success-await-trace.md`: "The exact unresolved promise cannot be
  named from the existing closed events… It does not distinguish these three
  adjacent possibilities without a marker." It also falsified the previous
  diagnosis (an awaited `store.close()`).
- `w2-t024-project-database-lifetime.md`: "The database-pool lifetime hypothesis
  was falsified… The post-playback request instead stalled while resolving a
  verification provider for an action-only run whose extractor had created one
  empty dataset shell." Its fix is described as "the smallest change that avoids
  an unnecessary provider resolution" — a workaround, by its own words.

**The comment in `verify.ts` overstated what was known.** It said the call
"revalidated an already-spent grant and never returned". No grant appears
anywhere in the t024 evidence; that run recorded three build calls and *zero*
verification or repair calls, and the reports never mention a grant. The claim
was a later gloss, and acting on it as fact would have sent me after the wrong
thing.

**What I can state positively is that the path is structurally capable of
hanging, because no await on it is bounded.** Traced by reading, not by
speculation:

1. `service.ts:2590` wires `resultPorts.resolveProvider` to
   `resolveAutomationStudioResultCheckProvider`
   (`runtime/service/runtime-adaptation/result-check.ts:159`), which awaits
   `resolveGrantedProvider` → `this.llmProviderResolver(...)`.
2. `_shared/runtime.ts:105-108` binds that resolver to
   `AutomationStudioLlmExecutionGrantService.resolve`.
3. `resolve` (`runtime/llm/execution/grants.ts:395`) awaits
   `validateClaimedGrant`, which awaits
   `Promise.all([identityAccess.validateSession, secretKeys.getKeySummary,
   resolveExecutionDigest])` (`grants.ts:729-745`). **No timeout, no signal, no
   deadline anywhere in `resolve`.** A grant's `timeoutMs` bounds a provider
   *call*, not its resolution — and `validateClaimedGrant` is awaited *inside*
   `runTask` too, so even a call can outlive its own timeout signal there.
4. `resolveExecutionDigest` is `automationStudio.getLlmExecutionBinding`
   (`service.ts:1431`), which opens `AutomationStudioProjectFlowResourceRepository`
   on the project database pool, runs its migrations, reads the Flow and releases
   the lease.
5. The project database (`storage/project/database.ts:182-192`) serializes every
   operation onto one `operationTail` chain, and `close()` awaits that chain
   (`:175-180`). An operation that does not settle stops every later one and
   `close()` with it.

So: I cannot show the hang is gone, and I can show that nothing on the path
gained a bound since. That is why the guard is a deadline rather than a targeted
fix — a deadline holds whichever of those promises stops settling.

## What changed and why

### The judgement

- `result-verification/verify.ts` — `nothingToJudge` **deleted**. It was the
  exemption: zero stored and zero refused rows returned `performed: false` with
  `no_records` or `nothing_to_judge`, and the run was never checked. Now the
  request reaches the model for every finished successful run.
- `result-verification/core-observation.ts` — the zero-stored/zero-refused branch
  returned a deterministic `does_not_answer` with `core.result.no_records`,
  reasoning that "zero rows cannot answer a request for rows, and there is no
  reading of a request under which it could". That is false for this corpus, so
  it now returns `undefined` and the question goes to the model. `no_records` is
  removed from `AUTOMATION_STUDIO_RESULT_OBSERVATION_CODES`. **Unchanged:**
  `every_record_refused` (the Flow found rows and its own declared schema threw
  every one away — wrong under any request) and `required_values_missing`. Both
  are still settled free, without a call *or a provider resolution*.
- `result-verification/run-outcome.ts` — the `totalRecordCount === 0`
  short-circuit that skipped instructions, provider and run detail is replaced by
  a check of `automationStudioResultCoreObservation(summary)`: the same pure
  function `verify.ts` uses, so the free deterministic path is preserved exactly
  and nothing else is exempt. An empty result now gets the request and the run
  detail, which is what lets a model tell "searched and found nothing" from
  "never looked".
- `runtime/llm/diagnosis-instructions.ts` — the `loop_verification` instruction
  gains the empty-result rules, because judging is useless if the model cannot
  answer `yes`. It is now told that an empty result is not wrong by itself, that
  `yes` is right where the request's terms make nothing the right answer *and*
  the steps show it looked, that `no` is right where the steps show it never
  looked or could not have stored what it found, and that a run with no record
  set is judged on what it did.

### The wrong-answer route

Nothing needed adding. `verifyAutomationStudioRuntimeSessionResult` already
routes any `performed: true` refutation through
`repairAutomationStudioRefutedRunResult`, and it now receives one for an empty
result. A test drives it end to end and asserts the repair port is handed the
empty summary itself (`resultSummary.totalRecordCount === 0`), so the repair sees
that nothing was stored rather than only that the answer was wrong.

One pre-existing constraint, not introduced here and worth knowing:
`attempt.ts:133` needs a **succeeded action attempt** on the run detail to name
the node the result came out of, and returns `undefined` without one. An
extraction that stored zero rows still has a succeeded extract attempt, so the
ordinary empty-table case repairs. A run with no succeeded attempt at all is
refuted and recorded but not repaired. That is true of every refuted result
today, empty or not.

### The bound

New `result-verification/deadline.ts`:
`automationStudioResultVerificationWithinDeadline` with
`AUTOMATION_STUDIO_RESULT_VERIFICATION_DEADLINE_MS = 120_000`.

- It wraps **the whole of `runVerification`** at its one call site: reading the
  record sets, reading the instructions, resolving the provider, reading the run
  detail, and both calls. Not just the resolution, so the guarantee has no gap.
- It never rejects. A throw comes back in the same shape as a deadline, because a
  caller that must record something about every finished run cannot have one of
  three outcomes arrive as an exception — an escaped rejection is how a finished
  run ends up with no verification record at all.
- It honours the run's own `AbortSignal` (already passed in from
  `service.ts`), so `cancelRuntimeSession` now ends a verification instead of
  leaving it running. I checked that the controller is aborted *only* by
  `cancelRuntimeSession` (`service.ts:2824`) and that the normal path merely
  deletes the map entry (`:2816`), so no ordinary run aborts its own check.
- Its timer is `unref()`ed, so a verification deadline never holds a process
  open.
- **Nothing inside the bound writes anything** — every write this module makes
  happens after the judgement returns — so an abandoned verification cannot write
  over the record its own run is about to get. The abandoned promise is left to
  settle on its own and its value is discarded.
- On timeout, abort or throw: `performed: false`,
  `core.result.verification_did_not_finish`, status `unverified`, and the run
  keeps the status its steps earned. The error's *kind* is named and its message
  is never recorded, so redaction is not weakened.

### Which skip codes remain reachable

You asked exactly this. The answer for the two you named is **none**, so both are
removed from `AUTOMATION_STUDIO_RESULT_VERIFICATION_SKIP_CODES`:

- `noResult` / `core.result.nothing_to_judge` — **removed.** A run that stored no
  record set is now judged on what it did.
- `noRecords` / `core.result.no_records` — **removed.** An empty record set is now
  judged against the request.

What is left is the two ways a question cannot be put at all:

- `noModel` / `core.result.no_model_available` — no provider resolved: none
  configured for the Flow, or the run was not authorized to ask one.
- `notFinished` / `core.result.verification_did_not_finish` — **new.** The bound
  fired, the run was cancelled under it, or the attempt threw before a verdict.

Both are `performed: false` and read `unverified`. Neither is ever a pass.

The `no_result` **status** stays in `AutomationStudioResultVerificationStatus`,
and in the run store's check constraint
(`storage/project/schema/result-checks.ts:41`) and readers
(`runtime-stream-store.ts:716`, `result-check.ts:208`), because rows written
before today carry it. Nothing produces it any more, and
`automationStudioResultVerificationStatus` no longer returns it. A test pins
that: every remaining skip code maps to `unverified`.

### Also updated

- `result-verification/verification-status.ts` — vocabulary comment and the
  `no_result` mapping.
- `result-verification/index.ts` — barrel exports `deadline.ts`.
- `apps/web/.../runtime/RunDetailPanels.tsx` — a label for the new code; the two
  historical codes keep labels marked as historical.
- `docs/architecture/automation-studio.md` — new subsection "Judging a finished
  run's result, including an empty one", placed before "The standing
  authorization" (the instrument that pays for this check). It records the
  behaviour change, the bound and its default, the unbounded awaits that make the
  bound necessary, and which codes and statuses are historical. Another worker
  holds an edit at line ~1030 of that file; mine is at ~361, so the regions do
  not overlap.

## Commands run and observed results

All from `F:\!FluxIQ`. Package-scoped only; no repository-root `pnpm build`.

- `pnpm --filter fluxiq check` (`tsc --noEmit`) — **passed**, no output beyond the
  banner. Two earlier runs failed first and I fixed what they named:
  `TS2339 Property 'noResult' does not exist` in `verification-status.test.ts`,
  then three errors in `run-outcome.test.ts` from asserting on packet fields that
  do not exist in that shape (`context.instructions` is an
  `AutomationStudioInstructionResolution`, not an array, and the packet has no
  `runDetail` — it carries `recentActions`).
- `pnpm --filter fluxiq test -- --run src/programs/automation-studio/runtime/result-verification`
  — **7 files, 81 tests, all passed** (final run 2.60 s). An intermediate run had
  2 failures, both in my own new or edited tests, both fixed:
  - "hands a refuted empty result to the wrong-answer route" — `expected [] to
    deeply equal [ 'run-1' ]`. Cause: the shared `runDetail()` fixture has no
    `actionAttempts`, so `attempt.ts`'s `resultProducingAttempt` found no node
    and the repair was correctly declined. Fixed by giving the test a succeeded
    extract attempt with `recordCount: 0`, which is what a live empty extraction
    has.
  - "records a judged result as confirmed or refuted, and a run with nothing to
    judge as having no result" — `expected 'refuted' to be 'no_result'`. That is
    the intended change; the test was rewritten to assert the narrowed
    vocabulary.
- `pnpm --filter fluxiq test -- --run src/programs/automation-studio` — **329
  files, 2979 passed, 1 skipped** (159.3 s). Run twice: once after the first
  version of the change, once after widening the bound. Both clean.
- `pnpm --filter @fluxiq/web check` (`tsc --noEmit`) — **passed**, banner only.
- `pnpm structure:check` — **passed (184 warnings, 359 baselined)**, run before
  and after the doc change. It also prints "2 baseline entries can be lowered". I
  did **not** run `pnpm structure:baseline`: there are no baselined entries for
  `result-verification` at all (checked by reading `.structure-baseline.json`), so
  those two are not mine, and regenerating a shared baseline would record two
  other workers' in-flight trees.
- No segfault and no `3221225477`; nothing was retried for environmental
  reasons.

The three tests the brief asked for, by name, all present and passing in
`result-verification/tests/run-outcome.test.ts`:

- empty result judged and **refuted** — "fails a run that stored an empty record
  set when the model says the empty table does not answer the request" (2 calls,
  run `failed`, status `refuted`);
- empty result judged and **accepted** — "leaves an empty result succeeded and
  confirmed where the instruction says an empty table is the right answer" (1
  call, `confirmed`, and it asserts the instruction text and the Flow's shape
  reached the call);
- **no hang** on the warned path — "ends a verification whose provider resolution
  never returns, instead of hanging the run", driven by a `resolveProvider` that
  returns a promise which never settles. Plus a throwing resolver and a cancelled
  run, and six unit tests in `tests/deadline.test.ts`.

## Not verified

- **No live run.** Nothing here has been exercised against a real DeepSeek
  provider or a real browser. In particular, whether the model actually answers
  `yes` for a correctly-empty result and `no` for a wrongly-empty one is
  unproven — the wording in `diagnosis-instructions.ts` is my best statement of
  the distinction, and only a live run on
  `everything-store-plus-earbuds-under-50` (and a scenario whose instruction
  says an empty table is acceptable) will show whether it lands.
- **Whether the hang still occurs.** I did not reproduce it and did not try; that
  needs the live Lab, and per `AGENTS.md` only one live run may be in flight at a
  time. The bound means a recurrence is now observable as
  `core.result.verification_did_not_finish` on the run record rather than as a
  stalled request — that code appearing in a live run is the signal that the
  underlying defect is real and still there.
- **Cost.** Every successful run whose result was previously exempt now spends 1–2
  provider calls. This only bites where checking was already authorized, because
  `resolveProvider` still answers nothing without a grant or a redeemed standing
  authorization — but it is a real increase for action-only Flows, which never
  spent anything here before. Not measured.
- **120 s is a judgement, not a measurement.** It comfortably fits two calls at
  the harness's per-call ceiling plus the reads, but I did not measure a real
  verification's wall time to choose it. `verificationDeadlineMs` overrides it per
  caller.
- **Downstream.** I did not build or test `F:\!FluxIQWebExtension`. Its
  `packages/test-runner` keeps `no_result` in `PersistedResultVerification`, so it
  still compiles; the behavioural consequence is that a run which stored no
  records stops arriving as `no_result` → `passed`
  (`flow-lane/lane-observation.ts:170,190-191`) and starts arriving as
  `confirmed`, `refuted` or `unverified`. That is the intended effect and needs no
  downstream code change, but a lane's numbers will move.

## Open questions or contradictions found

1. **The comment that justified the exemption did not match the evidence.**
   `verify.ts` blamed "an already-spent grant" revalidated and never returned.
   The t024 reports record zero verification and repair provider calls and never
   mention a grant. If anyone has since acted on that grant story elsewhere, it
   should be re-checked.
2. **Two files in the same directory held opposite positions on the same
   question.** `core-observation.ts` said zero rows is a refutation under every
   possible request; `verify.ts` said an empty table is sometimes the right
   answer and must not be judged. Both shipped. The only reason the contradiction
   was invisible is that `nothingToJudge` ran first and made
   `core-observation.ts`'s `no_records` branch dead code. It had test coverage
   asserting behaviour the product could never reach.
3. **`validateClaimedGrant` is awaited inside `provider.runTask`** (`grants.ts:437`),
   after the harness's timeout signal has been attached. The signal ends the
   *call* bookkeeping but does not cancel that await, so a grant revalidation that
   stops settling outlives the per-call timeout. My deadline covers it from
   above, but if the supervisor wants the cause rather than the symptom, that
   await — and `resolveExecutionDigest`'s trip through the serialized project
   database queue — is where I would instrument first.
4. **`resolve()` has no timeout of its own.** Bounding the grant service directly
   would protect every caller, not only result verification (Flow bootstrap and
   runtime recovery resolve grants too). I did not do it: it is outside this
   brief and `grants.ts` is security-critical. Worth a task.
