# w2-l1-week2-contracts: typed Week 2 results for the Lab

Brief: L-1 in `reports/w2-back-half-design.md`, section 8. Worker report. Nothing was committed.

## Outcome

**Done, with one deliberate change from the brief's wording and one no-op.**

A run evaluation can now carry all five Week 2 results as typed, validated records:

- the change verdict on each runtime patch attempt;
- the four adaptation measurements: reuse, validation (tier), persistence and cost.

Each is `null` when the run did not measure it. Every existing bundle still parses.

- **The deliberate change: the verdict is per patch attempt, not a single `harnessRecovery.verdict`.**
  It lives at `harnessRecovery.runtimePatchAttempts[i].verdict`. There are two reasons:
  - Core records its verification on each attempt
    (`recovery/annotation/patches.ts:113`, `verification: tested.verification`).
  - The design's own rule 2.2 lets one run try a second change after a later drift. A single
    run-level verdict would have to drop one of the two.

  Lab proof 1 ("an executed target override with verdict `verified`") reads directly off the
  attempt.
- **The no-op: the "one-line parity fix" in `bench/evaluate-run.ts` was already in place.** It
  landed in `fcd7dc9` (line 111, `harnessRecovery: observed?.harnessRecovery ?? null`). The design's
  statement that the bench "still drops `harnessRecovery`" is stale. I left the file unchanged, and
  added a regression test that a mutation probe shows is load-bearing.
- **Bench report: the aggregates stay reserved (`null`).** Only the comment in `bench-report.ts`
  changed. Typing them needs edits in four files I do not own (see Open questions 3).

## What changed and why

Every path below is under `packages/`.

### `test-contracts/src/harness-recovery.ts`

- `RunHarnessPatchAttempt.verdict?: RunHarnessChangeVerdict | null`.
  - Optional, because the Lab producer (`flow-lane/harness-recovery.ts`, not mine) builds the
    record literally and does not write it yet. A required member would fail `pnpm check`, and
    would make its `conforming()` throw on every recovered live run.
  - Absent means the record was written before the member existed. `null` means Core stated no
    verdict. Both read as unmeasured.
- New `harnessChangeVerdictOutcomes`: `verified`, `contradicted`, `unverifiable`, `not_executed`.
- New `harnessChangeVerdictBases`: `expected_state`, `expected_route`, `expected_outputs`,
  `records`, `downstream_assertion`. `changed_node_succeeded` and `continuation` are deliberately
  not bases (design 2.2).
- New type `RunHarnessChangeVerdict = { outcome, basis }`. It holds closed words only; Core's
  `reason` sentence is never carried.

### `test-contracts/src/harness-recovery-validation.ts`

- Checks the verdict:
  - `basis` is non-empty exactly when the outcome is `verified`, and names each kind once.
  - An attempt with `proposalOnly: true`, `executed: false` or `preflightOk: false` can only be
    `not_executed`.
  - An attempt with `executed: true` cannot be `not_executed`.
- New exported predicates `isCoreIdentifier` and `isCoreKind`. The existing private shapes now go
  through them, so the four new validators share one definition instead of copying the regexes.

### New file: `test-contracts/src/adaptation-reuse.ts`

All four measurements are read from Core's records, never the Lab's bookkeeping.

- **`RunAdaptationReuse`**
  - `exercisedAdaptationIds`
  - `providerCalls: number | null`
  - `interventions`
  - `resume: RunAdaptationResume | null`, where `RunAdaptationResume` is
    `{ fromNodeId, fromRoute, status, attemptCount, adaptationIds }` (design 2.7).
- **`RunAdaptationValidation`**: `{ adaptations: RunAdaptationConfidence[] }`.
  - Each entry is `{ adaptationId, tier, trials, replays, lastFailure }`, the output of design
    2.5's `decideAutomationStudioChangeConfidence`.
  - The tiers are exported as `adaptationConfidenceTiers`.
- **`RunAdaptationPersistence`**: `{ adaptations: RunAdaptationRecord[] }`.
  - Each entry is `{ adaptationId, status, baseRevision, appliedRevision | null }`, the fields of
    Core's stored adaptation summary.
  - The statuses are exported as `adaptationRecordStatuses`, mirroring
    `AutomationStudioFlowAdaptationStatus`.
- **`RunAdaptationCost`**
  - `providerCalls`
  - `inputTokens`, `outputTokens`, `totalTokens` and `estimatedCostUsd`, taken from Core's
    `llmGate.costAccounting`
  - `reservedCalls`

  Every member is nullable, so a figure Core did not state is `null`, never `0`.

### New file: `test-contracts/src/adaptation-reuse-validation.ts`

Four validators (`validateRunAdaptationReuse`, `…Validation`, `…Persistence`, `…Cost`), plus these
rules:

- **Identifiers and words:** identifiers are identifier-shaped, the resume `status` is a kind word,
  and each adaptation id and list entry appears once.
- **Tiers:** `established` requires at least one replay (a trial is not a replay). `provisional`
  requires at least one trial or replay.
- **Cost totals:** the four accounting totals are stated together or not at all. `totalTokens` is
  at least as large as either part, and `reservedCalls` is at most `providerCalls`.
- **Zero calls:** when `providerCalls` is 0, every other cost figure must be 0 or `null`.
- **Empty record:** a cost record that states nothing is refused; an unmeasured cost is `null`.
- **Budget:** a cost over the Lab's budget is accepted, because it is a measurement.

### `test-contracts/src/evaluation.ts` and `evaluation-validation.ts`

- The four members are now typed as `RunAdaptation… | null`, and there are no reserved-null members
  left. The schema stays 0.3, as it did when `harnessRecovery` was defined.
- The validator enforces the following:
  - each member is required;
  - each is `null` unless `lane` is `flow` and `flowCreated` is true;
  - each non-null value passes its own validator, with issues reported under `$.<member>`;
  - `adaptationReuse.providerCalls` equals `adaptationCost.providerCalls` wherever both are
    numbers;
  - both are 0 or `null` unless `llm.mode` is `live`.

### `test-contracts/src/index.ts` (not in my owned list)

I added two barrel lines for the new module. Without them the new types and validators are not
reachable from the package. No other worker holds this package.

### `test-contracts/src/bench-report.ts`

The comment on the reserved Week 2 aggregates is corrected: the per-run measurements are now typed
on `RunEvaluation`, and a `null` here must never be read as zero. No type changed.

### Tests

- `test-contracts/tests/adaptation-reuse-contracts.test.mjs` (new, 9 tests) and
  `harness-recovery-verdict.test.mjs` (new, 7 tests).
  - Their fixtures are Lab proof 1: a repair run with a resume, then a zero-call replay that reaches
    `established`.
  - Each refusal is checked at its exact path, and no refusal message may quote a planted card
    number.
  - Both files use a namespace import, so a missing export fails its own test instead of the whole
    file.
- `evaluation-contracts.test.mjs`: one test renamed. "…and the reserved ones null" became "…and a
  bare number is never one of them"; its body is unchanged and still passes.
- `test-runner/src/bench/tests/evaluate-run.test.ts`: one new test.
  - The bench Flow lane copies the lane's recovery record, verdicts included, as a copy rather than
    the same object.
  - A run that never reached the lane records `null`.
  - The four adaptation members stay `null` until a lane reports them.

## Commands run and observed results

- **Tests before the fix:** I built the unchanged package (`npx tsc -p tsconfig.json`, exit 0), then
  ran `node --test tests/adaptation-reuse-contracts.test.mjs tests/harness-recovery-verdict.test.mjs`.
  - Result: `# tests 16 # pass 2 # fail 14`.
  - The two that passed test behaviour that already held and must keep holding: a legacy record
    without verdicts still reads, and a non-null measurement is refused on a run with no Flow.
- **`pnpm --filter @fluxiq-web-extension/test-contracts test`:** exit 0, `# tests 113 # pass 113 # fail 0`.
  That is 97 before, plus 16 new. I ran it again after the probes and got the same result.
- **`pnpm check`:** exit 0.
  - `structure:test`: 105 of 105 pass. `lab:test`: 30 of 30 pass.
  - `structure-audit: passed (61 warning(s), 17 baselined).`
  - Every package reported `check: Done`.
  - Among the warnings, the ones on my paths were all there before this change except one.
    `packages/test-contracts/src/` is now at 23 source files; it was already past the advisory
    threshold of 15. `evaluation.ts` has 11 exported values; I added none to it. None of the
    warnings is a failure.
- **`pnpm --filter @fluxiq-web-extension/test-runner test`:** exit 1, `# tests 1093 # pass 1092 # fail 1`.
  I ran it twice, before and after the probes, with the same result.
  - The one failure is `demo-llm-create-ui/tests/failure-sanitizer.test.ts`, "generation failures
    retain only Core-validated bounded diagnostics". It expected `generation.http-400` and got
    `generation.provider-output-validation`.
  - Alone, `node --test dist/demo-llm-create-ui/tests/failure-sanitizer.test.js` gives 3 of 4, the
    same failure. So it reproduces, and it is not a RAM fault.
  - **It is not caused by this change.** The module imports nothing from `test-contracts`. Its
    subject depends on Core's `parseAutomationStudioFlowBootstrapFailureDiagnostic`, through the
    linked `fluxiq` package. Its directory has another worker's uncommitted edits (`index.ts`,
    `apply-proposal-ui.ts`, and the new `applied-binding.ts`). The failing case is the
    `totalTokens: 50001` diagnostic, which would fit Core's hard token limits being removed. That
    last point is not verified.
- **Mutation probes.** Each source was copied aside, mutated, rebuilt and tested, then restored.
  `diff -q` against the saved copy showed each restored file identical.
  - Accepting a verified verdict with an empty basis: only "verified names its evidence, and nothing
    else may" fails.
  - Removing the lane and `flowCreated` check on the four measurements: only "only a run whose Flow
    was created and ran has adaptations to measure" fails.
  - Disabling the zero-calls rule: only "adaptationCost states Core's accounting whole…" fails.
    For these three: `# tests 16 # pass 13 # fail 3`.
  - Removing `harnessRecovery: observed?.harnessRecovery ?? null` from `evaluate-run.ts`: the new
    evaluate-run test fails, `# tests 14 # pass 13 # fail 1`. After restoring and rebuilding,
    `evaluate-run.test.js` plus `single-run-evaluation.test.js` give `# tests 26 # pass 26`, and
    `git diff --stat` on `evaluate-run.ts` is empty.
  - My first attempt at the first probe (`false &&`) broke type narrowing and did not compile. The
    sources were restored before the second attempt.

## Not verified

- **No live run and no bench run.** No producer fills the four measurements or the verdict yet, so
  no real Core record has been checked against these contracts.
- **The shapes follow design sections 2.5 and 2.7, not built Core code.**
  - The resume record, `adaptationsExercised`, and the tier returned by
    `decideAutomationStudioChangeConfidence` do not exist in Core yet (briefs C-1, C-9, C-10). The
    names `trials`, `replays` and `lastFailure`, and the resume member names, may need adjusting
    when those land.
  - Whether `trials` and `replays` count only succeeded evidence is my reading of design 2.5.
- **Whether Core writes `providerCallCount` on a run that never invoked the model.** If it does not,
  a deterministic replay's `providerCalls` would be `null`, and that record certifies nothing.
- **Documentation.** `docs/architecture/` was not updated, because `docs/**` was out of scope. The
  evaluation contract changed, which normally calls for an update there.

## Open questions or contradictions found

1. **The brief says `harnessRecovery.verdict`; I placed the verdict per attempt** (reasons under
   Outcome).
   - The producer change, in `flow-lane/harness-recovery.ts` (not mine): read Core's
     `runDetail.metadata.runtimePatchAttempts[i].verification` by position, the same way
     `targetOverrideRefusalCases` reads `targetOverrideRefusal`. Map it to closed words, and put
     `verdict: verdicts[index] ?? null` into the attempt literal.
   - Core today writes `{ status, basis? , reason? }`, where `basis` is a single word. After
     brief C-6 it may write a full verdict with a `basis` array.
   - Suggested helper:
     ```ts
     function patchVerdicts(runDetail: Readonly<Record<string, unknown>>): Array<RunHarnessChangeVerdict | null> {
       const metadata = runDetail.metadata;
       const attempts = metadata && typeof metadata === "object" && !Array.isArray(metadata) ? (metadata as Record<string, unknown>).runtimePatchAttempts : undefined;
       if (!Array.isArray(attempts)) return [];
       return attempts.map((attempt) => {
         const record = attempt && typeof attempt === "object" && !Array.isArray(attempt) ? attempt as Record<string, unknown> : undefined;
         const found = record?.verdict ?? record?.verification;
         if (!found || typeof found !== "object" || Array.isArray(found)) return null;
         const { outcome, status, basis } = found as Record<string, unknown>;
         const word = outcome ?? status;
         if (!(harnessChangeVerdictOutcomes as readonly unknown[]).includes(word)) return null;
         const bases = [...new Set((Array.isArray(basis) ? basis : basis === undefined ? [] : [basis])
           .filter((kind): kind is HarnessChangeVerdictBasis => (harnessChangeVerdictBases as readonly unknown[]).includes(kind)))];
         if (word === "verified" && bases.length === 0) return null; // a basis the Lab cannot name: unmeasured, not unverified
         return { outcome: word as HarnessChangeVerdictOutcome, basis: word === "verified" ? bases : [] };
       });
     }
     ```
   - Core only ever writes `metadata.executed: false`, for a proposal (`live-patch.ts:273,288`). An
     executed trial therefore reads `executed: null`, so "executed" in Lab proof 1 means
     `proposalOnly: false` together with a verdict outcome other than `not_executed`.
2. **Filling the four measurements belongs to brief L-3, in files I do not own.** The exact changes:
   - `flow-lane/lane-observation.ts`: `RunLaneObservation` gains the four optional members, filled
     for a created Flow.
   - `run-evaluation/observed-run-evaluation.ts:113-116`: replace the four literal `null`s with
     `observation.adaptationX ?? null`.
   - `bench/evaluate-run.ts`, `evaluateFlowRun`: add four parity lines,
     `adaptationCost: observed?.adaptationCost ?? null,` and so on. I could not add them, because
     `RunLaneObservation` does not have the members.
   - Mapping:
     - `providerCalls`: `detail.providerCallCount ?? null`, in both reuse and cost.
     - Cost totals: from `detail.llmAccounting`, or all four `null`.
     - `reservedCalls`: when `detail.providerCalls` is present and `providerCallsOmitted === 0`,
       the number of calls where `charged.tokens` or `charged.cost` is `reserved`; otherwise
       `null`.
     - `interventions`: `(detail.interventions ?? []).length`.
     - `exercisedAdaptationIds` and `resume`: new parser fields in `existing-fluxiq-control.ts`,
       after briefs C-9 and C-10.
     - Validation and persistence: a per-adaptation read from Core's adaptation store (`status`,
       `baseRevision`, `appliedRevision`, and the tier after brief C-5).
3. **Typed bench aggregates need four files I do not own:**
   - `bench-report-validation.ts`, whose `week2Keys` loop refuses non-null values;
   - `bench/aggregate-report.ts:253-257`, which writes the `null`s;
   - `bench/comparison-details.ts:47`, which types these members as `number | null` and would stop
     compiling;
   - `bench/render-markdown.ts`.

   Suggested shape: a per-lane `adaptationByLane?`, optional like `extractionByLane`, holding:
   - runs measured and runs with a verified, contradicted or unverifiable verdict;
   - deterministic replays (non-empty `exercisedAdaptationIds`, 0 provider calls, 0 interventions);
   - resumed runs;
   - adaptations by tier;
   - summed cost, `null` when any measured run's totals are `null`.
4. **`packages/test-contracts/src/` is at 23 of the audit's hard limit of 25 files.** The next Week 2
   contract should move the Week 2 files into a subdirectory (for example `week2/`) rather than add
   files beside them.
5. **Risk for brief C-10, from reading Core; not observed.** `adaptation-store.ts:75` writes
   `applied_revision = null` whenever an adaptation is saved under any status other than `applied`.
   A replay recorder that re-saves an applied adaptation with a new status would erase the applied
   revision that the persistence measurement reports. Today only the apply path calls
   `updateStatusFields`, so nothing does this yet.
6. **Core also falls back to the base revision as the applied revision**
   (`positive(metadata.appliedRevision, baseRevision)`, same line). The contract therefore does not
   require `appliedRevision > baseRevision`. I had first written that rule into a test and removed
   it after reading this.
