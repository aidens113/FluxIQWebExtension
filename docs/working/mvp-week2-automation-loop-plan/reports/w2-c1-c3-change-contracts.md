# w2-c1-c3-change-contracts

Worker report, 2026-09-16. Briefs C-1 (change verdict and tier) and C-3
(adaptation record), done in that order. `AS/` = Core
`F:\!FluxIQ\packages\fluxiq\src\programs\automation-studio\`. Nothing was
committed or pushed, and no live calls were made.

## Outcome

Done. The shared contracts for one flow-improvement loop now exist in Core.
They are the same whether a change comes from an instruction, a run failure,
or an edge case in an existing Flow.

- **C-1:** design sections 2.1-2.5 are now pure functions in
  `AS/runtime/flow-change/`: the per-node verdict, the confidence tier, the
  validation result a verdict earns, and the node-metadata key names with their
  rules. That directory has 77 tests. A mutation pass made 24 deliberate
  breakages, one per rule; at least one test failed for each.
- **C-3:** the saved records carry the new fields. A validation result now has
  `kind` and `basis`. A repair record carries `metadata.origin`, which the
  validator checks. The bootstrap record gains `mode`, `origin` and
  `validationResults`. Bootstrap normalization now stamps
  `metadata.adaptationIds` on every node it creates. Records written before
  today still load and validate. A mutation pass made 25 breakages; at least
  one test failed for each.
- **One follow-up is needed in a file I do not own** (details under Open
  questions, item 1). Older bootstrap records that were approved but not yet
  applied will fail to apply until the loading code calls the new
  `upgradeAutomationStudioBootstrapAdaptation`. That is a one-line wrap at four
  call sites in `AS/runtime/service/bootstrap-adaptations.ts`.
- Core `pnpm check` does not exit 0 today. Every failure is in another
  worker's in-progress file; none is in my files (see Commands run).

## Names fixed

Everything below is exported from `AS/runtime/index.ts` (through
`AS/runtime/flow-change/index.ts` and `AS/runtime/flow-bootstrap/index.ts`) or
from the model barrel, and so from `fluxiq/automation-studio`.

### Model layer (`AS/model/flow-adaptation.ts`, types only)

The saved shapes live in the model, not in `runtime/flow-change/`, so the
model never imports runtime. This is a deliberate change from the design,
which placed the origin type in `contracts.ts`.

- `AutomationStudioFlowChangeEntryPoint` = `"instruction" | "run_failure" | "edge_case"`
- `AutomationStudioFlowChangeOrigin`: exactly the union in design 2.1
- `AutomationStudioFlowChangeValidationKind` = `"trial" | "replay"`
- `AutomationStudioFlowAdaptationValidationResult` =
  `{ runId; status: "succeeded" | "failed"; checkedAt; detail?; kind?; basis?: string[] }`.
  `AutomationStudioFlowAdaptation.validationResults` is now an array of this type.

`AS/model/validation/adaptation.ts`:

- `parseAutomationStudioFlowChangeOrigin(value: unknown): AutomationStudioFlowChangeOrigin | undefined`.
  This strict reader is the only way to read a saved origin.

### Runtime layer (`AS/runtime/flow-change/`)

Types in `contracts.ts`:
`AutomationStudioChangeVerdictCheckKind`, `AutomationStudioChangeVerdictEvidenceKind`,
`AutomationStudioChangeVerdictCheckStatus`, `AutomationStudioChangeVerdictCheck`,
`AutomationStudioChangeVerdictOutcome`, `AutomationStudioChangeResumePoint`,
`AutomationStudioChangeVerdict`, `AutomationStudioChangeVerdictAttempt`,
`AutomationStudioChangeVerdictInput`, `AutomationStudioChangeTrialInput`,
`AutomationStudioChangeTrialResult`, `AutomationStudioChangeConfidence`,
`AutomationStudioChangeConfidenceInput`, `AutomationStudioChangeConfidenceDecision`.

Values in `contracts.ts` (the node-metadata keys and their rules):

- `AUTOMATION_STUDIO_NODE_ADAPTATION_IDS_METADATA_KEY` = `"adaptationIds"`
- `AUTOMATION_STUDIO_NODE_ADAPTATION_IDS_LIMIT` = `8`
- `AUTOMATION_STUDIO_NODE_VERIFIES_STATE_METADATA_KEY` = `"verifiesState"`
- `isAutomationStudioAdaptationId(value: unknown): value is string`. A valid
  id is 1-256 characters, has no surrounding whitespace, and contains no C0
  control character or DEL. This is the same rule as C-4's private copy in
  `attempt-trace.ts`.
- `automationStudioNodeAdaptationIds(metadata?: JsonObject): string[] | undefined`.
  It follows the same rules as C-4's private reader: a malformed list is
  ignored whole, and duplicates are collapsed.
- `withAutomationStudioNodeAdaptationId(metadata: JsonObject | undefined, adaptationId: string): JsonObject`.
  The list only grows; an id already listed keeps its place. Malformed entries
  are dropped. Past 8 entries, the oldest are dropped. It throws on a
  malformed id.
- `automationStudioDefinitionVerifiesState(metadata?: JsonObject): boolean`
  returns true only when the value is exactly `true`.

`verdict.ts`:

- `AUTOMATION_STUDIO_CHANGE_VERDICT_SCHEMA_VERSION` = `"automation-studio.change-verdict.v1"`
- `AUTOMATION_STUDIO_CHANGE_VERDICT_EVIDENCE_KINDS`: the evidence kinds, in the
  order a verdict's `basis` lists them: `expected_state`, `expected_route`,
  `expected_outputs`, `records`, `downstream_assertion`.
- `decideAutomationStudioChangeVerdict(input: AutomationStudioChangeVerdictInput): AutomationStudioChangeVerdict`
- `automationStudioChangeValidationResult({ verdict, runId, checkedAt, kind }): AutomationStudioFlowAdaptationValidationResult | undefined`

`confidence.ts`:

- `AUTOMATION_STUDIO_CHANGE_CONFIDENCE_DEFAULT_REPLAYS` = `2`
- `automationStudioValidationResultKind(result): "trial" | "replay" | undefined`.
  A result with no kind reads as `trial`; any other value returns undefined
  and counts for nothing.
- `decideAutomationStudioChangeConfidence({ validationResults, riskLevel, replaysRequired? }): { tier, trials, replays, replaysRequired, lastFailure? }`

### Flow Bootstrap (`AS/runtime/flow-bootstrap/adaptation.ts`)

- `AutomationStudioBootstrapAdaptationMode` = `"create" | "extend"`
- `AutomationStudioBootstrapAdaptationOrigin` = the `instruction` and `edge_case` members of the origin union
- `AutomationStudioBootstrapAdaptation` gains three optional fields: `mode`, `origin` and `validationResults`
- `upgradeAutomationStudioBootstrapAdaptation(record): record`. It is
  idempotent and returns a copy.

## What changed and why

Core files, all under `AS/`:

- `model/flow-adaptation.ts`: adds the four model types above and widens
  `validationResults`. The change is additive only.
- `model/validation/adaptation.ts`: `validateAutomationStudioFlowAdaptation`
  now rejects the following, with these codes:
  - a status that is neither `succeeded` nor `failed` (`adaptation.validation_invalid_status`);
  - a kind that is neither `trial` nor `replay`, while an absent kind is still
    accepted (`adaptation.validation_invalid_kind`);
  - a basis that is not a list of at most 16 distinct codes matching
    `^[A-Za-z0-9][A-Za-z0-9_.:-]{0,63}$` (`adaptation.validation_invalid_basis`);
  - a basis on a failed result (`adaptation.validation_basis_without_success`);
  - a `metadata.origin` that does not parse (`adaptation.origin_invalid`);
  - an origin run that differs from `sourceRunId` (`adaptation.origin_run_mismatch`).

  It also adds `parseAutomationStudioFlowChangeOrigin`. The parser accepts
  only the listed keys, so page text cannot ride along in an origin. Ids are
  at most 256 characters and signatures at most 512, with no control
  characters. It accepts at most 64 instruction ids, all distinct. It rules:
  - an `instruction` origin needs at least one instruction id;
  - an `edge_case` origin needs at least one instruction id or a `runId`;
  - an `edge_case` origin may carry a `failureSignature` only together with its `runId`.
- `model/validation/index.ts`: one name added to the existing export list
  for `adaptation.ts`. This barrel was not listed in the brief, but the parser
  cannot be reached without it.
- `model/tests/flow-adaptation.test.ts`: 11 new tests. They cover results
  written before kinds existed, each new validation rule, and every accepted
  and refused origin shape, including a JSON round trip through `JsonObject`
  metadata.
- `runtime/flow-change/{contracts,verdict,confidence,index}.ts` (new) and
  `runtime/flow-change/tests/{verdict,confidence,contracts}.test.ts` (new).
  `contracts.test.ts` is an extra test file beyond the design's list; it
  covers the node-metadata key helpers.
- `runtime/index.ts`: one line, `export * from "./flow-change/index.ts";`.
- `runtime/flow-bootstrap/adaptation.ts`:
  - adds the new types and the three optional record fields;
  - normalization now stamps `adaptationIds: [adaptationId]` on every node it
    creates. `bootstrapAdaptationId` is kept, and edges, Subflows, graphs and
    the Router are not stamped;
  - adds `upgradeAutomationStudioBootstrapAdaptation`. It sets `mode` to
    `create` when missing, derives `origin` from `sourceInstructionIds` when
    missing, and stamps only the nodes this adaptation owns. It skips stamping
    for an id Core could not have minted, rather than throwing.
- `runtime/flow-bootstrap/tests/adaptation.test.ts` (new): 12 tests.

### Decisions I took where the design left a choice

1. **Where the saved types live.** The origin and validation-result types are
   in the model layer, to keep the model from importing runtime (see Names fixed).
2. **How the verdict reads a trial.** The verdict works on
   `AutomationStudioChangeVerdictAttempt`, a simple per-attempt summary, not on
   the executor trace directly. The trace cannot tell whether the host
   actually evaluated `expectedState`, so the trial (C-6) must supply that fact.
   How to fill each field:
   - `expectedRoute`: only a declared route, meaning `parameterValues.expectedRoute`
     or a built-in declared route (expectation `passed`, timeout). Never pass
     `transitionComparison.expected.expectedRoute` as is: the executor sets it
     to `failed` for every failed attempt.
   - `expectedState`: `passed` only when a host evaluator is bound and it
     accepted a non-empty expected state. `failed` when the host rejected it.
     `unknown` otherwise, when the node declares one.
   - `records.captured`: the rows this attempt stored, from its record batches.
   - `records.minimum`: whatever the domain declares. Core itself declares no minimum.
   - `verifiesState`: `automationStudioDefinitionVerifiesState(definition.metadata)`.
   - `endNodeId`: `trace.currentNodeId`. `runStatus`: `trace.status`.
     `failureRoute`: the failed attempt's route.
3. **Records rule.** A below-minimum capture contradicts the change. If every
   attempt captured zero rows, the records check is `unknown`, even when the
   node allows zero. A count that is not a whole number of zero or more is
   `unknown`.
4. **Downstream assertion.** Only a verification node that ran after the first
   changed attempt counts. So a repaired assert node cannot vouch for itself,
   while a later assert in a created Flow still counts. A failed verification
   node contradicts the change, as in the Discard example. A failure of any
   other node after the change does not.
5. **Continuation.** It passes when another attempt followed the last changed
   one, or when the run succeeded. It fails only when the run failed on the
   last changed node itself, meaning its route had no edge. In every other
   case it is `unknown`; a step-budget stop, for example, ends on the next
   node. `resumeFrom` is returned only on a `verified` verdict, and an absent
   route reads as `success`, as the executor treats it.
6. **Cancelled or unfinished changed node.** This gives `unknown`, so the
   verdict is `unverifiable`, not `contradicted`.
7. **An unknown check does not block.** An `unknown` check is never evidence,
   but it does not prevent `verified` when another evidence check passed. A
   host that cannot evaluate web `expectedState` would otherwise block every
   web repair.
8. **Confidence.**
   - **Demotion.** Any failure after the last success, trial or replay, makes
     the tier `unverified`. The design named only a failed replay. I included
     failed trials as the more cautious reading: if the latest evidence says
     the change does not work, the model should be allowed back in.
   - **Risk.** The design lists `riskLevel` as an input but gives no rule for
     it. I chose: `high` and `destructive` changes need one more replay than
     requested (3 by default). An explicit `replaysRequired` is floored at 1
     and truncated to a whole number; a value that is not finite falls back
     to 2.
   - **What the counts mean.** `trials` counts succeeded trials, ever.
     `replays` counts succeeded replays since the last failure. Results are
     read in `checkedAt` order; results with the same time keep their stored
     order.
9. **Validation result.** `automationStudioChangeValidationResult` records a
   success only for `verified` with a non-empty basis, and a failure only for
   `contradicted`. It records nothing for `unverifiable` or `not_executed`,
   which matches today's live-patch rule.

## Commands run and observed results

All commands were run from `F:\!FluxIQ` or `F:\!FluxIQ\packages\fluxiq`.

- **`pnpm exec vitest run src/programs/automation-studio/runtime/flow-change`**
  - First run: `Tests 77 passed (77)`.
- **C-1 mutation pass.** Runner: `node c1c3-mutate.mjs c1c3-mutations-c1.json`
  (scratchpad). It applies one source edit at a time, runs the directory's
  tests, and restores the file, checking the restore every time.
  - Result: all 24 mutations caught, each run exiting 1.
  - Verdict mutations (V1-V14): accept a success with no evidence (12 tests
    failed); let a later node's failure contradict the change (1); treat
    unknown as passed (3); count the failure's own route as evidence (1);
    ignore records (6); ignore a record minimum (1); count an assertion that
    ran before the change (2); let a failed downstream assertion not
    contradict (1); let an unwired route not fail the continuation (1); offer
    a resume point on an unverifiable verdict (4); record a verified verdict
    with no basis (1); record a failure for an unverifiable verdict (1); count
    an unfinished changed node as succeeded (2); resume from the first changed
    node instead of the last (2).
  - Confidence mutations (C1-C6): skip the failure-after-success demotion (4);
    let a structural check count as a trial (2); count replays from before the
    last failure (3); drop the risk rule (2); make an absent kind count for
    nothing (1); read results in stored order (1).
  - Key-helper mutations (K1-K4): stamp past the limit (1); partly trust a
    malformed list (1); let a truthy `verifiesState` count (1); stamp a
    malformed id (1).
- **Flow-change, flow-bootstrap and model adaptation tests together**
  (`pnpm exec vitest run` on the three paths): `Test Files 9 passed (9)`,
  `Tests 198 passed (198)`.
- **C-3 mutation pass** (`c1c3-mutations-c3.json`).
  - Baseline: `Tests 28 passed (28)`.
  - Result: all 25 mutations caught, each run exiting 1.
  - Bootstrap mutations (M1-M9): normalization stamps nothing (4 tests
    failed); upgrade stamps nothing (2); upgrade stamps nodes it does not own
    (1); upgrade leaves mode absent (3); upgrade derives no origin (1);
    upgrade changes its argument (1); upgrade overwrites an existing mode (1);
    upgrade stamps an id Core could not have minted (1); upgrade derives an
    origin with no instruction (1).
  - Validation mutations (N1-N16): accept any kind (1); reject a result with
    no kind (4); accept any status (1); allow a basis on a failure (1); accept
    duplicate basis codes (1); accept prose as a basis (1); let extra keys
    ride along on an origin (1); allow an instruction origin with no
    instruction (2); allow an edge case with neither instruction nor run (1);
    allow a signature without its run (1); never validate `metadata.origin`
    (2); allow an origin to name another run (1); accept control characters
    (1); accept duplicate instruction ids (1); share the id array instead of
    copying it (1); allow a run failure without its failed node (1).
- **`pnpm check` (repository root): exit 1.**
  - Structure tests passed.
  - The structure audit reported exactly one failure, in another worker's
    file: `FAIL [file-lines] .../runtime/tests/live-patch.test.ts: 878 lines
    exceeds the 800-line limit`. `git diff --stat` shows that file with 255
    uncommitted added lines.
  - For my files, the only audit finding is an advisory:
    `model/flow-adaptation.ts: 450 lines is past the 400-line advisory
    threshold`. The file was already at 414 lines, past that threshold, before
    this change. There are no import, export-count, naming or directory
    findings for my files.
  - The audit failure stopped the chain before `pnpm -r check`, so I ran the
    type checks separately (next three items).
- **`pnpm -r check`, first run: exit 2.**
  - My errors: 3 × TS2379 in `flow-change/tests/verdict.test.ts`, from test
    attempts written with `route: undefined` under
    `exactOptionalPropertyTypes`. Fixed by making the test helper drop
    overrides set to undefined.
  - Other worker's errors: 2 × TS2353 in `recovery/annotation/tests/patches.test.ts`.
- **`pnpm --filter fluxiq check` after the fix: exit 2.**
  - The only errors: 2 × TS2339 in `runtime/live-patch.ts` (lines 205 and
    207, `Property 'target' does not exist`). That file belongs to another
    worker and was being edited: the errors changed between my two runs.
  - No errors in my files.
- **`pnpm --filter @fluxiq/web check`: exit 2.** The only errors are the same
  two in `runtime/live-patch.ts`.
- **Suites that read these records: 4 of 730 tests failed.**
  - Command: `pnpm exec vitest run` over `runtime/flow-change`,
    `runtime/flow-bootstrap`, `model/tests`, `runtime/tests/service-bootstrap`,
    `storage/project/tests/adaptation-store.test.ts`, `runtime/recovery/tests`,
    `runtime/service/summaries/tests`, `runtime/tests/service-adaptation` and
    `runtime/executor/tests`.
  - Result: `Test Files 3 failed | 57 passed (60)`,
    `Tests 4 failed | 726 passed (730)`.
  - All six of my test files passed, as did `adaptation-store.test.ts` (8 tests).
  - Three failures are not mine: two in `service/summaries/tests/run-detail-preservation.test.ts`
    and one in `service-adaptation/tests/runtime-patches.test.ts`. All three
    show a target-override refusal with reason `domain_check_unavailable`.
    That reason appears only in `runtime/live-patch.ts` and other workers'
    tests, not in anything I changed.
  - The fourth was a timeout: `service-bootstrap/tests/adaptation.test.ts >
    bridges a generated proposal ID ...`, `Test timed out in 15000ms`, with 60
    test files running at once. Rerun alone, the whole file passes (`Tests 9
    passed (9)`) and that test takes 4989ms. So apply accepts topologies
    produced by the new normalization.
- **`pnpm exec biome check <my files>`:** the repository's configuration
  excludes these paths ("No files were processed"), so the linter did not
  apply.

## Not verified

- **Wiring into running code.** Nothing calls the new functions yet: the
  verdict, the tier, `upgradeAutomationStudioBootstrapAdaptation`, and the
  origin writing are all unused. They were exercised by unit tests only.
- **Older records on real storage.** I did not load a pre-change bootstrap
  record from disk and apply it; only the in-memory older shape was tested.
  Until the upgrade call is wired in (Open questions, item 1), I expect such a
  record to fail apply with "Flow Bootstrap topology is not the Core-owned
  normalization of its validated plan". I inferred this from reading
  `service.ts:4129-4138`; I did not observe it.
- **The whole Core test suite (`pnpm test`).** Not run. I ran only the nine
  directories listed above.
- **A clean `pnpm check`.** Not observed, because other workers' files fail
  it (see above).
- **The generated framework reference.** `docs/reference/framework-reference.md`
  (and its `packages/fluxiq/docs` copy) now has stale line numbers for
  `flow-adaptation.ts`, `validation/adaptation.ts` and
  `flow-bootstrap/adaptation.ts`, and does not list the new exports. `docs/**`
  was off limits, and neither `pnpm check` nor `pnpm test` checks this, but
  `pnpm docs:check` would fail. Run `pnpm docs:reference`.

## Open questions or contradictions found

1. **Required follow-up for older bootstrap records.** Apply
   (`service.ts:4129-4138`) compares a fresh normalization with the stored
   topology using `stableJson`. Normalization now stamps `adaptationIds`, so a
   record proposed before today and not yet applied no longer matches.
   - **The fix:** wrap each cast in `AS/runtime/service/bootstrap-adaptations.ts`
     with `upgradeAutomationStudioBootstrapAdaptation(...)`. The casts are at
     lines 30, 54, 74 and 84 (`stored as unknown as AutomationStudioBootstrapAdaptation`).
     Also cache the upgraded copy at line 31.
   - **Who can do it:** that file is under `service/**`, which was off limits to me.
   - **Also check:** once it is wired, tests that compare whole bootstrap
     adaptation payloads may start seeing `mode` and `origin`.
2. **New bootstrap records do not set `mode` or `origin` yet.**
   `service.ts:2078` (off limits) builds the record. Until it sets
   `mode: "create"` and `origin: { entryPoint: "instruction", instructionIds: sourceInstructionIds }`,
   only the upgrade supplies those two fields. C-12 or whoever next edits that
   block should add them.
3. **C-4 can drop its duplicates.** `AS/runtime/executor/attempt-trace.ts`
   (C-4's file) still has its own private copies of the key name, the limit,
   the id check and the list reader. It can now import
   `AUTOMATION_STUDIO_NODE_ADAPTATION_IDS_METADATA_KEY`,
   `AUTOMATION_STUDIO_NODE_ADAPTATION_IDS_LIMIT`,
   `isAutomationStudioAdaptationId` and `automationStudioNodeAdaptationIds`
   from `../flow-change/index.ts`. The values and rules are identical.
   Importing them adds a value edge from executor to flow-change; flow-change
   imports only types, so no cycle forms.
4. **No brief sets `verifiesState` on the built-in expectation node.** The
   design says Core sets `metadata.verifiesState: true` on
   `builtin.policy.expectation`, but no brief in section 8 owns that change
   (`AS/nodes/policy/**`). Until it is done, only domain verbs (W-4) count as
   downstream assertions.
5. **The extend-mode replay rule is not in the tier.** Design section 4.7
   requires one replay on the original path before an `extend` change is
   `established`. The confidence input has no field for that; C-12 must add
   one, for example a flag that a replay did not pass through the added nodes.
6. **Existing proposals do not read the tier yet.** Live patch still writes
   `metadata.verification` and a `validationResults` entry with no `kind`.
   Those read as `trial`, which is correct. Moving live patch to
   `automationStudioChangeValidationResult` and writing `metadata.origin` is
   C-6's work.
