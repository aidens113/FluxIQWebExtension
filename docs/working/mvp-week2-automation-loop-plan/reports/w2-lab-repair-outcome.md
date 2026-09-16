# w2-lab-repair-outcome — the Flow lane records what Core's recovery did

## Outcome

**Done.** A Flow-lane run now records what Core's recovery harness produced. The record covers each
intervention's kind, validation result and codes. It covers each runtime patch attempt's kind,
`proposalOnly`, `executed`, `preflightOk`, issue codes, `adaptationCreated` and
`changeProposalCreated`. It also covers the run's `adaptationIds` and `changeProposalIds`. The
record is written to `snapshots/flow-lane.json` as `harnessRecovery` and reaches
`evaluation.harnessRecovery` for a `lab run`. A run with no recovery reads as
`attempted: false`, not `null` and not a failure.

To hold the record, the evaluation contract had to change. It typed `harnessRecovery` as the literal
`null` and its validator refused any other value. I extended it minimally (details below). The
schema version stays 0.3.

One gap remains, outside my ownership: **the bench's Flow lane does not copy the new field yet**,
so a bench row records `harnessRecovery: null` (not measured). The exact one-line fix is under
Open questions.

## What changed and why

### Contract (`packages/test-contracts/src`)

- New `harness-recovery.ts` (types only): `RunHarnessRecovery`, `RunHarnessIntervention` and
  `RunHarnessPatchAttempt`. Every string in them is a kind, a code or an identifier. Unknown
  booleans and kinds are `null`. `attempted` is false exactly when all four lists are empty.
- New `harness-recovery-validation.ts`: `validateRunHarnessRecovery`. It checks each member's
  shape:
  - kind: `^[a-z]+(?:_[a-z]+)*$`, at most 64 characters;
  - code: `^[a-z][a-z0-9_.-]{1,127}$`, the same regex the runner's parser uses to extract codes;
  - identifier: `^[A-Za-z0-9][A-Za-z0-9._:-]*$`, at most 256 characters.

  None of these shapes allows a space, so no message or page text can pass. It refuses unknown
  keys and requires `attempted` to agree with the lists. Refusal messages never quote the value.
- `evaluation.ts`: `harnessRecovery: RunHarnessRecovery | null`, with a doc comment. `null` means
  not measured. **Schema version unchanged (0.3):** the field was already reserved in 0.3, and a
  0.3 evaluation holding `null` validates exactly as before.
- `evaluation-validation.ts`:
  - `harnessRecovery` is now validated on its own.
  - It is still required.
  - A non-null value must be on `lane: "flow"` with `flowCreated: true`.
  - The other four Week 2 fields must still be `null`.
- `index.ts` exports both new modules. The bench report's own aggregate `harnessRecovery` is
  untouched and still `null`.

### Runner (`packages/test-runner/src`)

- New `flow-lane/harness-recovery.ts`, which exports `readHarnessRecovery`, `HarnessRecoveryControl` and `HarnessRecoveryDetail`.
  - **Reuse of the existing parser:** `runIntervention` and `runtimePatchAttempt` in
    `existing-fluxiq-control.ts` are not exported. Their only public entry point is
    `ExistingFluxIQControlClient.getRunDetail`, so the reader calls that method.
    `PersistedFlowRunControl` now includes
    `getRunDetail(projectId, runId, bounds?)`, and the real client already satisfies it.
    `run-scenario.ts` passes that client, so it needed no change.
  - **No second read without recovery:** the reader first looks at the run detail the lane already
    read. If `interventions`, `adaptationIds`, `changeProposalIds` and
    `metadata.runtimePatchAttempts` are each absent, `null` or `[]`, it returns `attempted: false`
    and makes no second call. Anything else, including a malformed value, goes to the parser, so
    this check only tests for presence and never parses.

    The result: provider-free bench runs cost no extra request. A run that recorded recovery costs
    one more read of a detail that is already terminal.
  - Each item is rebuilt field by field. Request ids, prompt versions, providers, models, tokens and
    times stay behind.
  - An adaptation or change-proposal id that is not identifier-shaped fails with
    `Malformed FluxIQ API response: runDetail.adaptationIds[i] must be a Core identifier…`. The
    parser's own errors already name their paths.
  - The finished record is checked against the contract before it is returned. If the parser and
    the contract ever drift apart, the read fails with the `harnessRecovery.<path>` that failed.
- `flow-lane/persisted-flow-run.ts`:
  - `PersistedFlowRunOutcome.harnessRecovery` is required.
  - `readRunDetail` also returns the raw `runDetail` record, which stays in memory and is never
    serialized.
  - A new `terminalReadsOf` reads the datasets first and then the recovery, on both the normal path
    and the bounded-timeout path. Datasets come first so that a dataset failure fails exactly as it
    did before. The recovery read uses the same `bounds` the dataset read already used.
- `flow-lane/lane-observation.ts`:
  - `RunLaneObservation` gains an optional `harnessRecovery`. It is optional only because
    `bench/evaluate-run.ts` builds its observation member by member.
  - `flowLaneObservation` sets the run's record, or `null` when no Flow ran.
  - `recordingLaneObservation` sets `null`.
- `flow-lane/run-flow-lane.ts`: `flowLaneSnapshot` writes `harnessRecovery`, and its doc comment
  says so.
- `run-evaluation/observed-run-evaluation.ts`: `harnessRecovery` is a copy of the observation's
  value, or `null`.
- `flow-lane/index.ts` exports the new module.

### Tests

- New `flow-lane/tests/harness-recovery.test.ts` (5 tests). It drives `executeRecordedFlowRun`
  with `getRunDetail` served by the **real** `ExistingFluxIQControlClient`, parsing through a
  stubbed `fetch`.
  - **Full record:** the run has a diagnosis, a proposal-only target override that created a change
    proposal, an executed wait-retry that created an adaptation, and a reroute refused at
    preflight. Test 1 checks that the record matches field for field, and that the call order ends
    in `get-flow-run-detail` followed by `getRunDetail`.
  - **No free text:** prompt, response, selector, page-text and issue sentences, plus request id,
    model and prompt version, are absent from both the record and the snapshot.
  - **No recovery, four ways:** the lists are absent, empty, `null`, or metadata has no attempts.
    Each gives `attempted: false` with no second read, the observation still passes, and the
    snapshot says the same.
  - **Malformed fields, 8 cases:** each fails with a message starting
    `Malformed FluxIQ API response: <path> ` and none echo the injected text.
  - **Parser/contract drift:** a value the parser admits but the contract refuses fails before it
    reaches the bundle.
- `flow-lane/tests/run-flow-lane.test.ts`: the fake Core gained `getRunDetail` and a `recovery`
  option. A new lane-level test checks two things.
  - A recovered run: the record reaches the observation and the snapshot, and dropped fields do not.
  - A provider-free run: no recovery read happens, and the snapshot and observation say
    `attempted: false`.
- `flow-lane/tests/lane-observation.test.ts`: the fixture gained the new field. A new test covers
  a recovered run, a quiet run, a run with no Flow (`null`), the recording lane (`null`), and the
  contract refusing a recovery record on the recording lane.
- `flow-lane/tests/persisted-flow-run.test.ts`: the activation test's interventions now trigger a
  recovery read, so it supplies a `getRunDetail`.
- `run-evaluation/tests/single-run-evaluation.test.ts`: fixtures updated. The recovery record now
  reaches the `lab run` evaluation and survives serialization. A new test covers no recovery and
  the unmeasured cases.

  **The bench-parity test now pins one difference:** a lab run records the recovery record, while
  the bench row records `null`. Every other field is still compared.
- `test-contracts/tests/evaluation-contracts.test.mjs`: 3 new tests.
  - A record round-trips on a Flow run, and is refused on the recording lane and on a facility
    failure.
  - `attempted` must agree with the lists.
  - Thirteen kind, code, identifier, flag and unknown-key mutations are each refused at their path,
    and no refusal message quotes the planted value.

  The existing test "Week 2 fields are present and null" was renamed "…present, and the reserved
  ones null". It still passes unchanged: `0` and a missing key are both refused.

## Commands run and observed results

- `pnpm --filter @fluxiq-web-extension/test-contracts test` → `# tests 97 # pass 97 # fail 0`
  (94 before, plus 3 new).
- `pnpm --filter @fluxiq-web-extension/test-runner test`:
  - First run: exit 0, `# tests 1003 # pass 1003 # fail 0` (995 before, plus 8 new).
  - Second run, after I added one assertion to a new test: exit 1, 1002 of 1003. The failure was
    `bench/campaign/machine-slots/tests/acquire-machine-cell-slot.test.ts` "FIFO tickets prevent a
    later scheduler from overtaking an earlier waiter": an unhandled rejection
    `Machine cell slot owner is unreadable; refusing unsafe recovery`. That code is unrelated to
    this change.
  - That file alone: `node --test dist/bench/campaign/machine-slots/tests/acquire-machine-cell-slot.test.js`
    → 16 of 16 pass.
  - Full suite rerun: exit 0, `# tests 1003 # pass 1003 # fail 0`. The failure is a single
    observation that did not reproduce.
- `node scripts/structure-audit.mjs` → `structure-audit: passed (57 warning(s), 17 baselined).`
  - All warnings on files I touched or added are advisory.
  - `test-contracts/src` now has 19 source files against an advisory threshold of 15 and a hard
    limit of 25. It was already over 15 before this change.
  - The file-line warnings on `persisted-flow-run.ts` (507 lines), `persisted-flow-run.test.ts`
    and `run-flow-lane.test.ts` were already past 400 lines before this change.
  - Names were chosen to avoid a third `run-` file in `flow-lane/`, which would breach the
    prefix-group rule.
- `pnpm check`:
  - The first two attempts exited 1 inside pnpm's own bundle, before any repository code ran:
    `SyntaxError: Invalid or unexpected token` at `pnpm/dist/pnpm.cjs:9926`. The file on disk was
    intact (`node --check` on it exited 0), and `pnpm --version` then ran normally. That matches
    the known RAM fault.
  - Third attempt: exit 0.
    - `structure:test`: 96 of 96 pass.
    - `lab:test`: 15 of 15 pass.
    - Structure audit: passed.
    - Every workspace package reported `check: Done`.
- Negative probe: I made `readHarnessRecovery` always return "no recovery", rebuilt, and ran
  `harness-recovery.test.js` and `run-flow-lane.test.js` → 4 of 24 failed (the full-record,
  malformed, drift and lane tests).
  - The free-text test still passed under the probe, so I added an assertion that its record is
    the full one. It can no longer pass on an empty record.
  - I restored the file (verified with grep), rebuilt, and reran the five affected test files →
    67 of 67 pass.

## Not verified

- **No live run.** I did not run `pnpm lab`, any demo, or any `--live-llm` command, as the brief
  required. So the record has never been produced from a real DeepSeek run, and the real shape of
  `run-mu4nxysj-3234c535`'s recovery was not compared against the fixture. The fixture follows
  Core's `annotation/patches.ts` and `annotation/annotate.ts` as read-only source.
- **Live runs now read the run detail three times:** the lane's own read, then `getRunDetail`
  for the recovery, then `live.settle` in `run-scenario.ts`. The extra read was not measured. It
  happens only when recovery was recorded.
- **No bench run.** The bench's `evaluateFlowRun` records `null` for this field; see Open
  questions.
- **The bounded-timeout path was not tested with recovery present.** The recovery read there uses
  the same caller `bounds` as the existing dataset read, and that was not exercised in a test.
- **No check that the counts agree.** Nothing verifies that `harnessActivations` (the raw count of
  interventions) equals `harnessRecovery.interventions.length` (the parsed list from the second
  read). I left the check out on purpose, so that an evaluation cannot throw at the end of a live
  run if Core ever annotates the detail differently between the two reads.
- **Documentation not updated.** `docs/architecture/` was not changed, because `docs/**` was out
  of scope. The evaluation contract and the snapshot layout changed, which normally calls for an
  update there.

## Open questions or contradictions found

1. **Bench parity (outside my ownership): exact change to `packages/test-runner/src/bench/evaluate-run.ts`.**
   In `evaluateFlowRun`, after the `extraction: observed?.extraction ?? null,` line inside
   `observation: { … }`, add:
   ```ts
   harnessRecovery: observed?.harnessRecovery ?? null,
   ```
   Then, in `run-evaluation/tests/single-run-evaluation.test.ts`, the test "a Flow-lane single run
   records the packets its bundle measured…" can go back to one
   `assert.deepEqual(evaluation, benchRowOf(run, bundlePath))`. Its three pinning assertions will
   fail once the fix lands, which flags that test for updating. Once every producer states the
   field, `RunLaneObservation.harnessRecovery` could become required. That would also mean updating
   the literal observations in `bench/tests/evaluate-run.test.ts`, `bench/tests/run-bench.test.ts`
   and `evaluateFailedAttempt`.
2. **Optional change to `existing-fluxiq-control.ts` (not required, not made).** Exporting a pure
   `runDetailRecovery(detail: JsonRecord): Pick<ExistingRunDetail, "interventions" | "runtimePatchAttempts" | "adaptationIds" | "changeProposalIds">`
   would let the lane parse the detail it already holds instead of reading it again. It would be
   the four lines `getRunDetail` already contains, moved out and called from `getRunDetail`.
   `readHarnessRecovery` would then call it on its `runDetail` argument in place of
   `control.getRunDetail`, and `HarnessRecoveryControl` could be dropped from
   `PersistedFlowRunControl`.
3. **Parser mapping.** The existing parser reduces a patch's free-text preflight issue to a code by
   regex (`runtime_patch.target_node_invalid`, …). Anything it does not recognize becomes
   `runtime_patch.preflight_rejected`, so the record is only as specific as that mapping. Core
   does not put issue codes on patch attempts itself.
