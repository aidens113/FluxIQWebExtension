# g-flow-lane-expectations — three runner corrections from Stage 2 (test-runner)

## Outcome

**Done.** All three changes are made, and each has a test row and a mutation proof.
- **Gates:** test-runner `check` exit 0; a private build exit 0; the full suite
  521 of 521; the structure audit passed.
- **Not run:** no Lab run. What a Lab run must show is under "Not verified".

**Re-verified at `6c22e22` before editing: none of the three was already settled.**
- **Extraction:** `flow-lane/expectations.ts:51-58` judged `expected.extracted`
  against every Flow, and `run-flow-lane.ts:148` called it unconditionally.
- **Comparison status:** `persisted-flow-run.ts` `flowAction` read no
  `comparisonStatus`. `flowLaneSnapshot` (`run-flow-lane.ts:168-182`) rebuilds
  each action field by field.
- **Snapshot retry:** `run-scenario.ts:416` fetched the second read's snapshot
  once, with `.catch(() => undefined)`. So one failed fetch went straight to the
  fail-closed branch (`recording-discards.ts:125`).

## What changed and why

**Files named for the extraction expectation (the brief asked me to name them):**
- `flow-lane/expectations.ts` and `flow-lane/tests/expectations.test.ts`;
- `flow-lane/run-flow-lane.ts` and `flow-lane/tests/run-flow-lane.test.ts`.

`run-flow-lane.ts` is part of this change because the lane judges the
expectation there (the `assertFlowExtraction` call), and records what it saw
there (`recordEvidence` and `flowLaneSnapshot`).

### 1. The Flow lane judges extraction only against a Flow with an extract node

**`expectations.ts`**
- **Extract outputs:** a new `EXTRACT_OUTPUT_IDS` holds `web.dom.extract` and
  `web.dom.extract_list`, the two extract outputs in
  `domain/src/actions/types.ts:26,30`.
- **New type:** `FlowExtractionExpectation`, one of `"judged"`,
  `"not_applicable"` or `"not_expected"`.
- **New function:** `flowExtractionExpectation(expected, actionTypes)`.
  - It returns `not_expected` when `expected.extracted` is absent or empty. W19's
    armed `extracted: []` is one of these, and was already skipped before.
  - Otherwise it returns `judged` when any node output id is an extract output,
    and `not_applicable` when none is.
- **`assertFlowExtraction`** now takes the Flow's `actionTypes`. It returns early
  unless the expectation is `judged`, so no caller can judge a Flow that cannot
  extract.

**`run-flow-lane.ts`**
- **Before the evidence is recorded:** the lane computes `extraction` from
  `expected.extracted` and the `actionTypes` it already reads. The value goes
  into `FlowLaneEvidence` and `FlowLaneOutcome`.
- **In the bundle:** `snapshots/flow-lane.json` gains a top-level
  `extractionExpectation`, next to `extractionCount`.
- **The call:** `assertFlowExtraction(expected.extracted, run.extracted, actionTypes)`.

**The recording lane is unchanged.** It still judges unpaginated extraction at
`run-scenario.ts:294`, including during every Flow-lane run's recording phase.

### 2. Each attempt carries Core's transition comparison status

**`persisted-flow-run.ts`**
- **New field:** `PersistedFlowAction.comparisonStatus?: string`.
- **Where Core puts it:** on the attempt itself, not in `metadata`:
  - `service/summaries/conversions.ts:160`
    (`...(attempt.transitionComparison?.status ? { comparisonStatus: ... } : {})`);
  - `storage/project/runtime-stream-store.ts:563`, for a stored run.
- **How it is read:** a new `comparisonStatusOf` keeps the value only when it is a
  string of at most 64 characters matching `/^[a-z]+(?:_[a-z]+)*$/u`.
- **Why a shape check, not a closed list:**
  - Core's run-detail record types the field as `string`
    (`model/flow-adaptation.ts:287`).
  - Its union, `AutomationStudioTransitionComparisonStatus`
    (`runtime/executor/contracts.ts:9`), appears in no public `index.d.ts` under
    `dist/programs/automation-studio`.
  - So the shape is what keeps a value that is not one of Core's names out of the
    bundle.

**`run-flow-lane.ts` `flowLaneSnapshot`** publishes `comparisonStatus` on each
action that has one.
- **Why here:** without this line the new field reaches no bundle file, because
  the snapshot copies only the fields it names. Change 2 would then be inert,
  which was Stage 2's finding in the first place.
- **For the supervisor:** the brief lists only `persisted-flow-run.ts` for this
  change. The publishing line is in a file I own for change 1.

### 3. The second discard read fetches a failed snapshot once more

**`run-scenario.ts`, the second read only**
- **The loop:** a `do … while` fetches and reads the snapshot at most twice. It
  fetches again only when the first read's `window.excluded` is `null`.
- **What `excluded: null` means:** `RecordingDiscardWindow` sets it when the
  response carried no audit log to read (`recording-discards.ts:55-56`, `:122`).
  That is exactly the fail-closed branch.
- **What the condition covers:**
  - a rejected fetch;
  - an OK response whose body failed to parse, which `http-control.ts:123` turns
    into an `undefined` payload without throwing;
  - a response with no audit log.
- **Why that breadth:** Stage 2's evidence for W19 run 1 (`#22 … "excluded":null`)
  cannot tell these three apart.
- **Unchanged:** the read call itself, the scope, the union with `earlier`, and the
  verdict rule.

**Also added:** `snapshotFetches` (1 or 2) in the second read's `runtime.settle`
details, so a Lab run can show whether the second fetch happened.
- **For the supervisor:** this is one field on the event that publishes the read,
  slightly past "the snapshot fetch only".

`run-evaluation/tests/runner-wiring.test.ts` gains two pins in the
second-read test: the loop's exact shape, and the published `snapshotFetches`.
- **Existing pins still pass unchanged:**
  - the `readRecordingDiscards(` count of 2;
  - the `secondRead` substring;
  - the `published` prefix.

### Test rows

| Change | File | Row |
| --- | --- | --- |
| 1 | `flow-lane/tests/expectations.test.ts` | "a Flow with no extract node is not judged on the workflow's extraction, and the expectation is named as not applying". The existing extraction row now passes an extracting Flow |
| 1 | `flow-lane/tests/run-flow-lane.test.ts` | "a Flow with no extract node is not judged on the workflow's extraction, and its evidence says the expectation did not apply". It covers W18's shape (`not_applicable`, and the lane passes), a Flow with an extract node (`judged`, published before the throw), and an undeclared expectation |
| 2 | `flow-lane/tests/persisted-flow-run.test.ts` | "each attempt carries Core's transition comparison status when Core reports one, and only in the shape of Core's names". It covers `matched`/`blocked`, the field absent, and seven rejected values |
| 2 | `flow-lane/tests/run-flow-lane.test.ts` | "each action's transition comparison status reaches the flow-lane snapshot", in W19's shape: `auth_required` and `blocked` |
| 3 | `run-evaluation/tests/runner-wiring.test.ts` | Two new assertions in "Core's discard audit is read a second time, …" |

## Commands run and observed results

All from `packages/test-runner` unless noted, with
`EXTENSION_TEST_BUILD_LABEL=g-flow-lane-expectations`. Every exit status was
captured by redirecting to a file, never through a pipe.

1. **`pnpm check`:** `exit=0`.
2. **`pnpm exec tsc -p tsconfig.json --outDir dist-gfle`**, then
   **`node --test "dist-gfle/**/*.test.js"`:** `build_exit=0`, `test_exit=0`, and
   `# tests 521 # pass 521 # fail 0`. The new rows were observed as
   `ok 75`, `ok 99`, `ok 141`, `ok 142` and `ok 183`.
3. **`node scripts/structure-audit.mjs`** (repo root): `audit_exit=0`,
   `structure-audit: passed (40 warning(s), 17 baselined)`.
   - It raised one new advisory: `run-flow-lane.test.ts: 403 lines is past the
     400-line advisory threshold`.
   - I shortened my new doc comment there by six lines.
4. **Mutation proofs.** Each file was copied to the scratchpad and hashed first,
   then mutated, rebuilt into `dist-gfle`, and tested. Afterwards it was copied
   back and checked with `sha256sum` and `cmp`, which printed `byte-identical`.

   | Mutation | Observed |
   | --- | --- |
   | **M1:** deleted `if (flowExtractionExpectation(expected, actionTypes) !== "judged") return;` from `expectations.ts` | `test_exit=1`, `# pass 17 # fail 2`. `not ok 5 - a Flow with no extract node is not judged … named as not applying` and `not ok 18 - … its evidence says the expectation did not apply`, both with `error: 'The Flow produced 0 extraction result(s), expected 1'`, Stage 2's message. Restored: `405ea1c4…0abd`, `byte-identical` |
   | **M2:** deleted `...(comparisonStatus ? { comparisonStatus } : {}),` from `persisted-flow-run.ts` | `test_exit=1`, `# pass 23 # fail 2`. `not ok 7 - each attempt carries Core's transition comparison status …` (diff `+ undefined, + undefined / - 'matched', - 'blocked'`), and `not ok 25 - each action's transition comparison status reaches the flow-lane snapshot` (diff `- comparisonStatus: 'blocked',`). Restored: `15aa6640…0abd`, `byte-identical` |
   | **M3:** `snapshotFetches < 2` changed to `snapshotFetches < 1` in `run-scenario.ts` | `test_exit=1`, `# pass 5 # fail 1`. `not ok 5 - Core's discard audit is read a second time, …` with `error: 'a snapshot the second read could not fetch or read is fetched once more, and no more, before the read fails closed'`. Restored: `7d8a7b19…6acd9`, `byte-identical` |

5. **After every restore, once more:** the private build and full suite gave
   `build_exit=0`, `test_exit=0`, `# tests 521 # pass 521 # fail 0 # cancelled 0`.
   - The structure audit gave `audit_exit=0`,
     `structure-audit: passed (39 warning(s), 17 baselined)`.
   - Among touched files, only
     `run-scenario.ts: 688 lines is past the 400-line advisory threshold` remains;
     it was 681 lines, already past it, before this change.
6. **`rm -rf dist-gfle`:** removed. `git status --short` afterwards lists my eight
   files, plus `reports/l-stage2.md`, which was modified before I started and is
   not mine.

**Faulty RAM:** no uniform or impossible failure appeared. Every red result above
is a deliberate mutation with a real assertion diff. Each gate ran once.

## Not verified

**What a Lab run must show:**
- **W18 `auth-gate --flow`:**
  - `snapshots/flow-lane.json` holds `"extractionExpectation":"not_applicable"`;
  - no `error` event reads `The Flow produced 0 extraction result(s), expected 1`.
  - The run can still fail on the auth-gate leak attestation, which is separate
    work (`i-secret-in-workspace`).
- **The week1 bench's W09 Flow row:** the same `not_applicable`, and no extraction
  failure.
- **W19 `auth-gate --flow --variant expired`:** the `web.dom.click` action in
  `flow-lane.json` carries `"comparisonStatus":"blocked"`.
  - This rests on Core's source (`conversions.ts:160`) and on `w19-c1`'s report.
  - I did not observe it in a live run detail.
- **Every run that reaches the second discard read:** the
  `"Core's discard audit was read again before the topology closed"` event
  carries `snapshotFetches`.
  - Normally the value is `1`.
  - A run showing `2` with a non-null `excluded` would prove the retry recovered.
  - W19 run 1's transient was not reproduced, so the retry has never met the real
    fault.
- **The recording lane still judges W18's `read-account` extraction.** No row was
  added, because the code at `run-scenario.ts:294` is untouched.

**Not checked:**
- **Core's full comparison-status list.** I read `contracts.ts` only to line 20;
  every name up to there, `matched` through `target_not_found`, fits the shape.
  A later name containing a digit or another character would be dropped
  silently.
- **Other extract outputs.** Whether Core could ever propose an extract node
  under an output id other than `web.dom.extract` or `web.dom.extract_list`.
- **Timing of the second fetch.**
  - It runs immediately, with no pause.
  - Each fetch is bounded at the default 30 s (`http-control.ts:173`), so a
    retried read can add up to 30 s before the topology closes.
- **Not run:** `pnpm build`, `pnpm lab`, the content harness (no extension file
  changed), and any domain tests.

## Open questions or contradictions found

1. **Paginated extraction is now judged by neither lane.**
   - **Where:** product-catalog declares `pagination: followNext` on
     `extract-all-pages` (`manifest.ts:58`) and `extract-in-stock`
     (`manifest.ts:113`).
   - **Recording lane:** it skips paginated steps (`run-scenario.ts:294`,
     `!step.pagination`).
   - **Flow lane:** it now judges only a Flow with an extract node, and a
     recording yields none.
   - **Nothing that passed stops being checked:** such a row could only fail with
     `0 extraction result(s)` before.
   - **Still, a claim no longer holds:** "paginated extraction is proven here and
     nowhere else" is now conditional. I reworded the doc comment to say so.
   - **For the supervisor:** is paginated extraction a Week 1 claim? If it is,
     it needs a producer, an extract node in the Flow, and nothing in this brief
     provides one.
2. **Ownership, flagged for the supervisor:**
   - the comparison-status publishing line sits in `run-flow-lane.ts`
     `flowLaneSnapshot`, a file I own for change 1, not change 2;
   - `snapshotFetches` is one field on the event that publishes the second read,
     slightly past "the second discard read's snapshot fetch only".

   Without the first, change 2 reaches no bundle file. Without the second, a Lab
   run cannot say whether the retry happened.
3. **Comparison status is only in `flow-lane.json`.** It is not in
   `evaluation.json` or `run.json`. That matches the decision ("so the next run
   can quote it"), but nothing judges it.
4. **`finish-week1.md` no longer shows as modified.** At session start git listed
   it as modified. My last `git status` does not list it, so it was presumably
   committed while I worked. That is not my change, and I did not investigate.
