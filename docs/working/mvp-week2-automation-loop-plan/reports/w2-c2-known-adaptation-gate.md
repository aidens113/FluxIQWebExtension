# w2-c2-known-adaptation-gate: a repaired node that fails again reaches the model (D-2)

Worker report for brief C-2 (`w2-back-half-design.md`, section 5 D-2 and
section 8 row C-2). Repository: FluxIQ Core. `AS/` =
`packages/fluxiq/src/programs/automation-studio/`. Nothing committed.

## Outcome

**Done.** The model is asked again when a node fails after its repair was
applied. The failing test was written first and was seen to fail before the fix:
`expected { invoke: false, …(6) } to match object { invoke: true, …(2) }`. It
passes now.

Only a `validated` adaptation now counts as a known answer, and the trace names
it by id. A record that carries a `failureSignature` is matched by that
signature alone. A record without one is matched by node identity only.

Core `pnpm check` exit 0. All tests in my files pass (61/61), and 257/257 pass
across `recovery/tests`, the summaries conversion test, the orchestrator test
and `live-patch.test.ts`. Five mutations of the new rules each fail at least
one owned test.

One test owned by another worker still depends on the old D-2 behaviour. It is
`service/summaries/tests/run-detail-preservation.test.ts:129` (uncommitted, and
being edited during my run). See "Open questions".

## What changed and why

### `AS/runtime/adaptive-orchestrator.ts`

- **Matching** (`adaptationMatchBasis`, replaces `adaptationMatchesFailure`):
  - When `metadata.failureSignature` is a non-empty string, the record matches
    only if it equals this failure's signature. It never falls back to the node.
    The signature includes the failure class, so the same node failing for a
    different reason is a different failure. The live patch stamps this same
    classifier signature (`live-patch.ts:588-596`), so the two agree.
  - A record with no signature matches by node identity: `failedAction.nodeId`
    and `definitionId`, and the same Subflow when both the record and the
    failure name one. That last check is new.
  - **Removed:** the free-text heuristic (same Subflow, and the trigger text
    contains the class words). It matched any node in a Subflow, for example a
    trigger "Previous action failed" for any `action_failed` node there.
- **Known status:** `KNOWN_ADAPTATION_STATUSES = {"validated"}`.
  `knownAdaptationAvailable` is now `matches.some(m => m.known)`. Before, it was
  `status === "applied" || status === "validated"`, which is D-2.
- **Match entries** gain `matchedBy: "failure_signature" | "node_identity"` and
  `known: boolean`. The list still includes matches of every status, so an
  applied repair that did not hold is still visible. `compactAutomationStudioAdaptiveFailure`
  is unchanged: its `knownAdaptationIds` still lists every match, which
  `service/summaries/tests/conversions.test.ts:39-45` requires.
- **Signature** is computed once, before matching, instead of once per
  adaptation.
- **Eligibility wording:**
  - The known case now reads "A validated adaptation matches this failure and is
    not yet applied." It used to read "known validated/applied".
  - New eligible reason, used when an applied match exists: "An applied
    adaptation matches this failure and it happened again with that change in
    place, so the failure is unresolved."
  - `llmEligibilityForFailure` now takes an input object.

### `AS/runtime/recovery/deterministic-diagnosis.ts`

- `knownAdaptationIds` now holds only the known (validated) matches. The plan's
  step "Matched: …" (`plan.ts:178`) therefore names the change to apply, never
  an applied one.
- New optional `recurredAdaptationIds?: string[]`: the applied matches, present
  only when there is at least one. It is optional so that the literal fixtures
  in `plan.test.ts` and `structured-diagnosis.test.ts` (not mine) still compile.
- The header comment now states the applied rule.

### `AS/runtime/recovery/stages.ts`

- **Diagnosis event:** `detail` now carries `knownAdaptationIds` and
  `recurredAdaptationIds`, each only when non-empty. When the model is asked
  because a repair did not hold, the event reason reads "The model was asked
  because an applied adaptation matches this failure and it happened again…".
- **Resolution event, `known_adaptation_available`:** `detail.knownAdaptationIds`
  is added, and the reason now reads "Validated adaptation <ids> already matches
  this failure and is not yet applied, so the model was not asked. Applying it
  is what should happen next."
- **Content:** only ids are added. Ids are Core-generated
  (`adaptation.<runId>.<patchKind>.<time>`, `live-patch.ts:347,427`), so the
  trace stays free of page content.

### `AS/runtime/recovery/llm-invocation.ts`

Not changed; nothing in it needed to change. Its test did change (next
section).

### Tests

- **`AS/runtime/recovery/tests/llm-invocation.test.ts`**
  - The fixture takes a status.
  - The test titled "refuses the model when a validated adaptation…" was
    passing an **`applied`** fixture, so it asserted D-2 itself. It now uses
    `validated` and asserts `knownAdaptationIds`.
  - **New failing-first test:** "asks the model again when a node with an
    applied repair fails again". It expects `invoke: true`,
    `knownAdaptationAvailable: false`, `requiredPriorAction: "none"`,
    `resolution: "model_required"`, `knownAdaptationIds: []` and
    `recurredAdaptationIds: ["adaptation.known"]`.
  - Ownership: I edited this file because the brief grants `llm-invocation.ts`
    "and their tests" if required, and the existing test encoded the defect.
- **`AS/runtime/recovery/tests/deterministic-diagnosis.test.ts`**
  - Known case: `validated`.
  - Applied and failing again: `model_required`, with the recurred id and a
    reason that mentions "applied".
  - Applied and validated together: only the validated one is known.
  - A signed record matches the same class and not a `timeout` on the same node.
  - `it.each` over the 7 statuses other than `validated`: none is known.
  - The agreement matrix with the classifier now also loops over every status.
- **`AS/runtime/tests/adaptive-orchestrator.test.ts`**
  - The existing match now expects `matchedBy` and `known`.
  - An applied match is listed with `known: false` and stays eligible. The
    compact form still lists it.
  - A signed record matches by signature only.
  - A record without a signature does not match another node, another
    definition, another Subflow, or the old trigger-text-only case. It still
    matches when the failure names no Subflow.
- **`AS/runtime/recovery/tests/stages.test.ts`**
  - The trace names the validated id in the diagnosis and resolution details,
    and the reason contains the id and "not asked".
  - The trace names the recurred id in the diagnosis detail, and adds no
    `knownAdaptationIds`.

## Commands run and observed results

All commands were run in `F:\!FluxIQ\packages\fluxiq` unless another directory
is named. `R` = `src/programs/automation-studio/runtime`.

1. **Failing first**, before any source change:
   `npx vitest run $R/tests/adaptive-orchestrator.test.ts $R/recovery/tests/{deterministic-diagnosis,llm-invocation,stages}.test.ts`
   gave `Tests 17 failed | 44 passed (61)`. The gate test failed with
   `expected { invoke: false, …(6) } to match object { invoke: true, …(2) }`.
2. **Same four files after the fix:** `Test Files 4 passed (4)`,
   `Tests 61 passed (61)`.
3. **`pnpm check`** in `F:\!FluxIQ`:
   - First run: exit 139. `structure-audit: passed (147 warning(s), 254 baselined)`;
     `packages/fluxiq check: Done`. `apps/web check` failed with
     `Exit status 3221225477`, the access violation this machine's faulty RAM
     causes. No audit warning named any of my files.
   - Rerun alone: **exit 0**. `structure-audit: passed`; contracts,
     client-gateway-websocket, fluxiq and web all `Done`.
4. **Full runtime suite:** `npx vitest run $R` gave exit 1,
   `Test Files 9 failed | 113 passed (122)`,
   `Tests 11 failed | 1207 passed (1218)`.
   - Nine failures were `Test timed out in 15000ms`.
   - One was `scale-pages` `expected 641.67 to be less than 500` (a timing
     budget).
   - One was `deepseek-bootstrap-exploration` "asks again after a decision that
     runs past its deadline": `flow_bootstrap.provider_transport_unknown` on a
     3 s timeout.
   - 16 node processes were running at the time: other workers' tests.
5. **Rerun of the 9 failing files:** `Tests 7 failed | 43 passed (50)`.
   - The deadline test, `canonical-persistence` and `subflow` passed.
   - Five were still timeouts, and `scale-pages` failed again at `604.58 < 500`.
   - `run-detail-preservation` failed at line 129:
     `expected [ 'runtime_diagnosis', …(5) ] to have a length of 2 but got 6`.
6. **Timeout check:** `npx vitest run --testTimeout=60000 --hookTimeout=60000`
   on `durable-patches`, `service-bootstrap/adaptation`,
   `instruction-readiness`, `scale-pages` and `service-recordings/proposals`
   gave `Test Files 5 passed (5)`, `Tests 26 passed (26)`. The same files with
   the old rule restored in memory also gave `26 passed (26)`. **Conclusion:
   those failures were load, not this change.**
7. **Neighbours:** `npx vitest run --testTimeout=60000 $R/recovery/tests $R/service/summaries/tests/conversions.test.ts $R/tests/adaptive-orchestrator.test.ts $R/tests/live-patch.test.ts`
   gave `Test Files 15 passed (15)`, `Tests 257 passed (257)`.
8. **Mutations**, applied in memory only by a scratch vitest config
   (`scratchpad/c2-vitest-mutations.config.mjs`); no file on disk was changed.
   Each was run against the four owned test files:

   | Mutation | Result |
   | --- | --- |
   | `applied` counts as known again | 4 failed |
   | Signed record falls back to node identity | 2 failed |
   | Subflow check removed | 1 failed |
   | Trace drops the ids | 2 failed |
   | Diagnosis lists every match as known | 10 failed |

9. **Preservation test, old rule against fix**, using
   `scratchpad/c2-vitest-mutant.config.mjs` (old rule restored in memory):
   - Old rule, first run: line 129 passed, and a later assertion failed.
   - Old rule, second run: `Tests 3 passed (3)`.
   - Fix, run straight after: failed at line 44, inside the **first** repaired
     run (line 103), before any adaptation exists. This change cannot affect
     that step.
   - At the time, `service/summaries/store.ts` had been modified at 18:02:28,
     the preservation test at 18:01:31 and `live-patch.ts` at 18:03:24. The
     clock read 18:03:33.
   - A scratch service probe (`scratchpad/c2-probe/replay-after-apply.test.ts`)
     found that the first run made `["runtime_diagnosis","runtime_patch"]` but
     recorded **no** adaptation, with `adaptationIds []` and the listing empty.
     This was identical under both rules, so the in-progress code blocked a
     clean service-level comparison.

## Not verified

- **No clean service-level proof that a replay reaches the model.** The
  preservation and probe paths were broken by other workers' in-progress
  `live-patch` / `service/summaries` edits during my run. The only service-level
  observation is run 5: 6 calls instead of 2 under the fix. The old rule gave 0
  replay calls there on two runs.
- **The "known" adaptation is still not applied by anything.** This brief
  changed the gate and the trace only. A `validated` match still stops the model
  and returns `apply_known_adaptation` with nothing acting on it. D-2's second
  half ("nothing applies the known adaptation") remains open for whichever
  brief owns the resume and apply path.
- **Persistence was read, not run.** `metadata.failureSignature` survives a
  typed-store round trip (`adaptation-store.ts:62,378,439` carry `metadata`
  through `status_detail_json`).
- **No live DeepSeek run**, per the brief. The Lab proof "second drift after a
  repair" (design section 6 item 5) is not run.
- **`pnpm test`** at the repository root was not run, and neither was the web
  app's test suite.

## Open questions or contradictions found

1. **`run-detail-preservation.test.ts:129`** (another worker, uncommitted)
   asserts that two replays after apply make zero provider calls.
   - In that fixture (`tests/service-fixtures.ts:67-87`) the `divide` node has
     no inputs wired, so every replay fails at `divide`. The applied
     `temporary_target_override` cannot change that for a math node.
   - The zero-call result held only because the applied repair silenced the
     model, which is D-2. Under this fix the replays reach the model (6 calls
     observed).
   - **Recommendation for that test's owner:** do not assert zero calls on
     replays that fail. Either make the replays succeed, or run them through a
     service with no `llmProviderResolver`, since that test is about keeping
     the annotation.
   - I did not touch it (it is under `service/**`).
2. **`service.ts:2824-2845` needs no change for correctness.** The classifier
   now decides by status.
   - Optional improvement: the load takes the 25 most recent summaries of any
     status, so newer `rejected` or `proposed` records can crowd out an older
     `validated` one. If that matters, the exact change at `service.ts:2832` is
     to load the records that matter to the gate first:
     `const gateFirst = [...recentAdaptations.filter((s) => s.status === "validated" || s.status === "applied"), ...recentAdaptations.filter((s) => s.status !== "validated" && s.status !== "applied")];`
     and then `gateFirst.slice(0, AUTOMATION_STUDIO_KNOWN_ADAPTATION_LOAD_LIMIT)`.
     Summaries carry `status` (`service/indexes/types.ts:51`).
   - Do not filter the other statuses out: `recovery/context.ts:257` sends this
     same list to the model as `known_adaptations`, and rejected attempts are
     useful to it.
3. **Design open question 3 says the gate should read tiers and
   `metadata.review.approvedBy`, never the status word.**
   - This brief specifies status (`applied` is not known; `validated` is), and
     the tiers from C-1 and C-3 do not exist yet, so status is what this change
     reads.
   - The rule is in one place (`KNOWN_ADAPTATION_STATUSES` and the `known` flag
     on each match). Moving it to tiers later means changing that one
     predicate.
   - `validated` still means two things: a reviewer approved it, or a rerun
     verified it (`live-patch.ts:379`). This change treats both as known.
4. **`compactAutomationStudioAdaptiveFailure.knownAdaptationIds`** (in the run
   summary) still lists every match, including applied ones, because a test
   under `service/**` pins that. Its name now disagrees with the diagnosis's
   `knownAdaptationIds`, which holds validated ids only. Renaming it to
   `matchedAdaptationIds` would need that test and its readers changed
   together.
5. **Removed heuristic.** The free-text trigger match is gone, as the brief
   says ("node identity only"). A legacy record with neither a signature nor a
   `failedAction` now never matches. I found no production writer of such
   records: live patches set both.
