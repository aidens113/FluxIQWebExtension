# t984 automatic data stage — progress and retained-row seam

Worker: p0_permission. Discovery began while t976 validation waited; t976 is now complete and frozen in its own tree. No git mutations, paid calls, browser runs or full suites.

Lead approved the proposal in principle: minimal declaration/source/binding metadata, no second DSL or workflow engine, and preserve legacy saved processing without manufacturing criteria. Interpretation/forwarding, task-memory/attempt and processed-rows additions are approved only after the t976/P1/P4 handoff and sync. Send the exact completion path before any completion edit. The retained-row seam is committed and handed to P1; bounded independent binder/operator implementation is now authorized and underway in t984.

## Stable retained-row seam ready for handoff

Lead narrowed the first implementation to **exactly two Core files**: `packages/contracts/src/record-sets/process/process-rows.ts` and its existing `tests/process-rows.test.ts`. No other P2 source edits have occurred.

- Added `AutomationStudioRecordProcessRowsResult.retainedRows`. It is copied from the evaluator's exact existing `limited` selection of original source records, with all allowed schema fields, no excluded/unmodeled fields and no derived virtual columns. This is the stable additive API for P1 carry-on and read-back; callers must not evaluate again with `process.columns` removed.
- The existing projected `rows` are copied from that same retained selection. Filtering, representative selection, default/explicit dedupe, sort and limit are not evaluated a second time or changed.
- Added owning cases for full/projected parity, promoted/organic occurrence filtering with explicit identity, selection order/limit/accounting, legacy displayed-column dedupe semantics, original display values, excluded/derived/unmodeled fields and input immutability.
- Focused owning-file tests are queued through the heavy gate, one Vitest worker. A contracts package typecheck follows. Both files will then be frozen for the lead to commit and merge into P1; remaining P2 implementation waits for that shared seam handoff.
- Focused acceptance passed: from Core `packages/contracts`, `node ../../node_modules/vitest/vitest.mjs run --maxWorkers=1 --minWorkers=1 src/record-sets/process/tests/process-rows.test.ts` -> **1 file / 23 tests passed**, exit 0. `git diff --check` -> exit 0. The Core diff contains exactly the two approved files (70 insertions / 2 deletions). Contracts package typecheck is queued.
- **Handoff complete; both source files frozen.** From `C:/Users/osrs_/FluxStuff/fxwork/t984/!FluxIQ`, `pnpm --filter @fluxiq/contracts check` -> **exit 0**, `contracts:check` stored its passing stamp in 11,767 ms. Lead was notified immediately. No full suite was run. The lead owns the commit/merge of this two-file stable seam into P1; remaining P2 source edits wait for that handoff.
- P1 integration found that its persistence owner attaches an enumerable own `SOURCE_ROW` Symbol. The first schema-only copy lost it. Fixed the same two files to retain enumerable own symbols from the exact selected original, by reference, without copying excluded/unmodeled string keys, non-enumerable symbols or inherited symbols. Declared projected rows still omit symbols; no-columns rows keep the original shallow-copy behavior; JSON omits all symbols.
- Symbol regression runs the full derive/filter/dedupe/order/limit selection and checks the exact original source reference, public projection, input immutability and JSON serialization. Owning tests now **25/25 passed**; contracts package check **exit 0**, passing stamp stored in **6,558 ms**; `git diff --check` **exit 0**.
- Lead independently passed **25/25**, committed the stable seam as **`2c4099965`**, and fast-forward merged it into the paused t982 Core tree. This is P1's source provenance for `retainedRows`. Lead then authorized bounded independent P2 operator/binder work in t984; P1/P4-dependent interpretation, task-memory, attempt and processed-rows seams remain held until their combined handoff/sync.

Reproducible seam acceptance:

```powershell
# Working directory: C:/Users/osrs_/FluxStuff/fxwork/t984/!FluxIQ/packages/contracts
node ../../node_modules/vitest/vitest.mjs run --maxWorkers=1 --minWorkers=1 src/record-sets/process/tests/process-rows.test.ts
```

Latest observed: **25 tests passed**, exit 0, including the source-symbol integration regression. It ran through heavy label `t984-retained-symbol-tests` (the earlier pre-integration pass was 23/23).

```powershell
# Working directory: C:/Users/osrs_/FluxStuff/fxwork/t984/!FluxIQ
pnpm --filter @fluxiq/contracts check
git diff --check
```

Latest observed: **both exit 0**. Typecheck ran through heavy label `t984-retained-symbol-types`; no overrides. The stable seam was then committed and handed to P1 by the lead.

## Independent binder implementation

After the committed retained-row handoff, added the owned `packages/contracts/src/record-sets/process/binding/` feature and its public process barrel export. It resolves exact field ids first, then a unique label under existing case/whitespace normalization; it rewrites all field references in the existing processing dialect and calls the existing strict parser. Derived ids remain exact virtual references and cannot become stored source fields. Missing, ambiguous and excluded references produce explicit issues and no runnable processing; unknown grammar is still rejected by the original parser. No P1 schema metadata, interpretation, task-memory, attempt or other dependent seam is read through an untyped cast or edited.

Binder acceptance, before automatic-mode additions:

```powershell
# Working directory: C:/Users/osrs_/FluxStuff/fxwork/t984/!FluxIQ/packages/contracts
node ../../node_modules/vitest/vitest.mjs run --maxWorkers=1 --minWorkers=1 src/record-sets/process/binding/tests/bind.test.ts
# Working directory: C:/Users/osrs_/FluxStuff/fxwork/t984/!FluxIQ
pnpm --filter @fluxiq/contracts check
node scripts/structure-audit.mjs
```

Observed **8/8 tests passed**, contracts check **exit 0** (6,485 ms stamp), structure audit **exit 0** (563 warnings, 909 baselined). All ran through the shared heavy gate, with no memory override.

## Independent automatic operators in progress

The lead approved an explicit `mode: "automatic"` overload on the existing `processAutomationStudioRecordRows` owner. Existing callers keep the original result type and semantics. New automatic callers receive `state: "ready"` with the existing rows/retainedRows/account, `state: "missing-evidence"` with no answer rows, or `state: "empty"` with the account and an uncollected/no-matches reason. Explicit `minRows: 0` permits ready empty processing; processing readiness is distinct from task success. Lab scraping acceptance remains strictly nonempty.

- The same evaluator still derives, filters, deduplicates, sorts, limits and projects once. Required evidence is checked beside the existing pure predicates/readers; there is no replacement processing language or second selection pass.
- Missing/unreadable required comparisons cannot pass through `not`. A known false conjunct safely settles a condition or excludes that occurrence; a proven true OR/equality alternative suppresses irrelevant missing readings. This also preserves conjunction/negation inside one multi-comparison condition or field-to-field comparison. Explicit presence/absence criteria retain their meaning. Feedback names field, operator, declaration entry, optional derived source, and capture `{nodeId, batchKey, row}` (row is zero-based within the batch).
- Required sort evidence is checked across all distinct qualifying records before limit, including hidden sort fields. Explicit output columns must carry their actual values; JSON output values and actual boolean false are retained. These checks return no successful rows when required evidence is unavailable.
- Automatic default identity is a complete validated primary key. An explicit dedupe key is honored. Incomplete keys fall back to all allowed fields of the ORIGINAL record, with no derived/display values or guessed URL normalization. With no validated key the whole allowed original is used. Filtering precedes dedupe; a promoted occurrence cannot erase the organic occurrence of the same identity. Existing callers retain the established display-column/default and missing-negative behavior.
- P1 lifecycle finding recorded: production readBack follows `ending.ts` session end, and reader processing is session-end guarded. After P1 sync, automatic readiness must be enforced before `retained: "answer"`; active-run markers currently refuse correctly. No silent collected fallback is acceptable. No completion/driver path has been edited.

The combined focused command ran through heavy label `t984-automatic-operators-tests` (no override):

```powershell
# Working directory: C:/Users/osrs_/FluxStuff/fxwork/t984/!FluxIQ/packages/contracts
node ../../node_modules/vitest/vitest.mjs run --maxWorkers=1 --minWorkers=1 src/record-sets/process/tests/automatic-processing.test.ts src/record-sets/process/tests/process-rows.test.ts src/record-sets/process/tests/result-operators.test.ts src/record-sets/process/binding/tests/bind.test.ts
```

Observed initially **4 files / 69 tests passed**, exit 0, in **3.79 seconds**: original evaluator 25, automatic mode 24, existing result operators 12, binder 8. Contracts typecheck then **passed, exit 0**, with an **8,377 ms** stamp. The next structure audit **failed, exit 1**, after completing its scan: three import-boundary violations (process-rows -> readiness files; two readiness helpers -> condition/holds.ts). Corrected imports through the directory barrels; the public process barrel still exports only the readiness result/evidence types, keeping internal helpers private. Added the lead's explicit minRows:0 distinction and its regression.

**Independent validation passed on that frozen tree:** focused **4 files / 70 tests passed**, exit 0, in **2.83 seconds** (original evaluator 25, automatic mode 25, existing result operators 12, binder 8); contracts check **exit 0**, **6,005 ms** stamp; structure audit **exit 0**, **564 warnings / 909 baselined**; `git diff --check` **exit 0**. Heavy labels were `t984-automatic-operators-tests2`, `t984-automatic-operators-types2`, `t984-automatic-operators-audit2`, serially with no override. That freeze was superseded only by the explicitly authorized presence follow-up below. Dependent runtime seams remain held.

Reproducible final commands:

```powershell
# Working directory: C:/Users/osrs_/FluxStuff/fxwork/t984/!FluxIQ/packages/contracts
node ../../node_modules/vitest/vitest.mjs run --maxWorkers=1 --minWorkers=1 src/record-sets/process/tests/automatic-processing.test.ts src/record-sets/process/tests/process-rows.test.ts src/record-sets/process/tests/result-operators.test.ts src/record-sets/process/binding/tests/bind.test.ts
# Working directory: C:/Users/osrs_/FluxStuff/fxwork/t984/!FluxIQ
pnpm --filter @fluxiq/contracts check
node scripts/structure-audit.mjs
git diff --check
```

The exact additional completion boundary was traced read-only and approved by the lead for AFTER combined sync: `packages/fluxiq/src/framework/automation-service/service/answer-first/completion/check.ts` and an owning focused test. The proposed optional readiness callback from run-attempt/result-feed precedes caller-confirm, judge-off, accepted replay and judge success. It applies only to declared data tasks, with explicit N/A for action-only tasks, and uses the existing repairable refusal so the task continues. Feed rows must never publish collected/stale rows while unavailable. Final store processing/readBack must agree on full original rows, declaration and reference clock. No completion source has changed.

### Explicit-presence follow-up

After the independent freeze, the lead found one missing tri-state input: the parser accepts explicit `is: "present"` beside comparisons, while the new condition reader included only the comparisons. A missing cell therefore returned unknown even though explicit presence already proved the conjunction false. The lead authorized a two-file follow-up in `readiness/condition.ts` and `tests/automatic-processing.test.ts`.

Explicit presence now joins the existing conjunction and its whole-condition negation. Implicit comparison presence is not manufactured: a missing comparison without an explicit presence criterion remains unknown. A required-date guard preserves the established date safety rule, so missing/unreadable/ambiguous dates cannot become negative matches through presence or another false conjunct. Legacy predicates are untouched.

From Core `packages/contracts`, the exact focused command below **passed 1 file / 32 tests**, exit 0, in **1.39 seconds**, through `t984-explicit-presence-tests`. This contains the prior 25 automatic tests plus seven explicit/implicit presence and date-safety cases. Then contracts check **passed exit 0**, **5,561 ms** stamp; structure audit **passed exit 0**, **564 warnings / 909 baselined**; `git diff --check` **passed exit 0**. Heavy labels `t984-explicit-presence-types` and `t984-explicit-presence-audit` ran serially, with no override. Source/tests are frozen again; no dependent integration source has changed.

```powershell
node ../../node_modules/vitest/vitest.mjs run --maxWorkers=1 --minWorkers=1 src/record-sets/process/tests/automatic-processing.test.ts
# Working directory: C:/Users/osrs_/FluxStuff/fxwork/t984/!FluxIQ
pnpm --filter @fluxiq/contracts check
node scripts/structure-audit.mjs
git diff --check
```

## Persisted mode/clock handoff proposal approved, held for combined sync

Read-only tracing showed `recordOutput.process` already crosses saved Flow, record batch and canonical `process_json`; `run-dataset-store.ts` parses it with the existing processing parser. The lead approved one strict optional `process.declaration` provenance field: `{ version: 1, source: instructionDigest, revision, bindings }`. The framework stamps digest/revision/bindings; a model does not author them. Version 1 identifies the new automatic semantics; absence remains legacy. This avoids a second schema, output contract or DB column. The lead later authorized the independent owned contract/parser/stamp step below before P1's final handoff. Runtime dispatch remains held.

The lead approved serialized transfer of `packages/fluxiq/src/framework/persistence/automation/project/run-dataset-answer/answer.ts`, `run-dataset-store.ts` and their owning tests AFTER P1 freeze/sync. They must dispatch to the same automatic evaluator; missing evidence must atomically invalidate any existing ready answer marker and cannot silently read collected rows as an answer. A fully materialized known-empty result follows explicit minRows/data-task contracts; a marker is not universal task success.

The store already reads `runtime_runs.started_at_ms` for relative comparisons. The lead approved exposing that exact exploration start from `answer-first/rows/exploration-session.ts` via `rows/open-exploration-session.ts`'s session type and owning test, then supplying it to run-attempt/feed. This preserves real finish timestamps and avoids independent ambient clocks. All these dependent paths remain untouched until the combined P1/P4/permission sync.

P1 coordination: a retained answer marker describes complete materialization, including truthful empty rows, independently of task success/belowMinRows. P1 reports that its receipt hashes canonical process metadata, so declaration provenance naturally changes that receipt. For empty captures the in-memory ledger already records a page by callId with kept:[]; it does not require datasetId to distinguish a source. P1 proposed persisting a zero-row batch only for a valid explicit host schema, preserving durable schema/capture identity for restart/readBack; this worker supports that seam. Legacy absent-schema empty reads remain unchanged. These P1 claims await the lead's verification/sync; no P1 source was edited here.

### Independent provenance contract ready for handoff

The lead checkpointed independent P2 source as `331a639ea` and report as `7e414d917`, synced both t984 trees to current dev including permission/P4, and reported its own independent **77/77 tests in 4 files** after that sync. P1 was still finishing downstream. The lead then authorized ONLY strict provenance contracts/parser/serialization tests and a framework-neutral binding stamp helper in existing owned process paths. All runtime/interpretation/memory/feed/store/completion/clock edits remain held.

Public contract:

```ts
type AutomationStudioRecordProcessingDeclaration = {
  version: 1;
  source: string; // exactly 64 lowercase hexadecimal SHA-256 characters
  revision: number; // positive safe integer
  bindings: Readonly<Record<string, string>>; // original written ref -> allowed stored id
};
// Additive: AutomationStudioRecordProcessing.declaration?: AutomationStudioRecordProcessingDeclaration
stampAutomationStudioRecordProcessing(raw, schema, { source, revision });
// Returns the existing AutomationStudioRecordProcessingBinding success/failure union.
```

- The existing strict processing parser accepts exactly the four nested provenance keys, copies the metadata/map, and sorts binding keys deterministically. It rejects null/undefined stamps, missing/extra fields, unknown versions, noncanonical digests, invalid revisions, blank reference keys, and unknown/excluded/derived binding targets with `record_output.process_invalid_declaration`. Absent declaration keeps legacy parsing/JSON unchanged. There is no second schema or storage envelope.
- `bindAutomationStudioRecordProcessing` is the untrusted instruction/amendment boundary. It now refuses ANY own `declaration` key, including null/undefined, with `record_output.process_declaration_framework_owned`. The public stamping helper binds through that boundary, validates the caller-supplied framework digest/revision, and supplies ONLY actual computed stored-field bindings. It cannot use a model-supplied stamp or binding map. The helper is browser/framework-neutral and computes no digest itself; the framework owns source hashing and revision changes.
- Persisted parser shape validation does not authenticate an author. Future model/runtime entry points must use the binding/stamping boundary when creating/amending declarations; saved bound declarations use the strict parser. Current evaluator calls do not infer automatic mode from metadata alone. No runtime opt-in or model boundary was changed in this contract-only step.
- Derived ids remain in existing derive/where/compare expressions. They are deliberately absent from provenance bindings; their stored source and other stored operands ARE bound. A full derive/condition/field-comparison stamp and JSON roundtrip is pinned, preventing valid virtual references from being rejected as provenance targets. Original values and exclusions are unchanged.
- Owning tests pin canonical metadata roundtrip, fresh copies, legacy JSON compatibility, model stamp refusal, source/version/revision validation, exclusions and invalid binding targets, special own data keys without prototype changes, a no-reference empty binding map, and no implicit evaluator mode switch.

Final provenance-step commands, run serially through heavy labels `t984-provenance-tests`, `t984-provenance-types`, `t984-provenance-audit` with no override:

```powershell
# Working directory: C:/Users/osrs_/FluxStuff/fxwork/t984/!FluxIQ/packages/contracts
node ../../node_modules/vitest/vitest.mjs run --maxWorkers=1 --minWorkers=1 src/record-sets/process/tests/processing-declaration.test.ts src/record-sets/process/binding/tests/bind.test.ts src/record-sets/process/tests/result-operators.test.ts
# Working directory: C:/Users/osrs_/FluxStuff/fxwork/t984/!FluxIQ
pnpm --filter @fluxiq/contracts check
node scripts/structure-audit.mjs
git diff --check
```

Observed **3 files / 59 tests passed**, exit 0, in **2.42 seconds** (39 provenance, 8 binder, 12 existing operators); contracts check **exit 0**, **5,652 ms** stamp; structure audit **exit 0**, **565 warnings / 909 baselined**; diff check **exit 0** (ordinary Git LF-to-CRLF notices on two existing binding files). No failing executable check in this step. Source/tests are frozen for lead verification/handoff.

This step changed ONLY `packages/contracts/src/record-sets/process/{types.ts,parse-processing.ts,index.ts,declaration/{type.ts,parse.ts,index.ts},binding/{bind.ts,index.ts,stamp.ts},tests/processing-declaration.test.ts}` and this report. No git mutations, P1 files or dependent source changes.

## Discovery findings

- Read the t984 brief, main plan Current State/Design/P2, Core boundary/validation guidance, and P1's t982 handoff. P1's contracts/schema seam is validated; transport/retention work is still in progress. Dependent implementation must wait for lead integration/sync.
- There is already one reusable evaluator: `packages/contracts/src/record-sets/process/process-rows.ts`, `processAutomationStudioRecordRows`. It derives, filters, dedupes, sorts, limits and projects; it returns removal accounting. Preserve this order so an organic occurrence survives even when a promoted occurrence shares its identity. Never merge conflicting occurrences into a synthetic qualifying row.
- `process-rows.ts` currently chooses default identity from `process.columns ?? storedFields`, ignoring validated `schema.primaryKey`. This makes identity depend on presentation. `row-identity.ts` rejects only an entirely empty composite key; partially missing keys can collapse unrelated rows. Both are directly owned P2 fixes.
- `answer-first/result-feed/feed.ts` infers schema again in `collected()` and `processed()`, discarding P1 metadata. A declared processing that fails strict parsing silently falls back to unfiltered `wholeOnce(rows)`. This must become explicit missing/invalid evidence, not an apparently valid unfiltered result.
- `answer-first/result-processing/processing.ts` already writes a held declaration into each contributing read step's `recordOutput.process` before save. Reuse this persistence/assembly seam; do not introduce a parallel data pipeline.
- `runtime/llm/node-tools/result/answer.ts` already strictly parses field references and reports issue codes. Before rows exist it holds an unvalidated object; later schema/binding failure must remain visible rather than being dropped by the result feed.
- `rows/processed-rows.ts` supplies `Date.now()` and result-tool answering also defaults to it. Relative conditions need one run reference clock supplied through both paths; ambient repeated clocks cannot prove live/replay parity.
- Current condition values support strings/numbers, while P1 permits actual JSON booleans and `semanticType: flag`. Numeric/date readers already exist; flag comparison must preserve real booleans and treat unreadable values as unavailable, not false. Missing values can currently pass negated non-date comparisons, which is unsuitable for required-evidence conditions.

## Proposed declaration and binding seam

1. **Declare in the existing interpretation call.** Extend its existing answer with a `process` declaration using the present condition/sort dialect; field strings initially name instruction-level concepts. The framework stamps source digest, revision and bindings in the strictly parsed optional `process.declaration` provenance field. A model never supplies that metadata. There is no new interpretation or processing model call. A known task or saved Flow reuses its kept declaration.
2. **Bind once actual retained schema exists.** In an owned result-processing binder, resolve each referenced field by exact id, then a unique normalized schema label. Validate handling/exclusion, comparison types and actual field availability; ambiguous or absent matches are actionable issues. Do not fuzzy-match page words, infer a key from a shared link, guess missing flags, or silently drop a condition. Use semanticType/mark to select the existing pure typed comparator, not as fabricated per-row truth.
3. **Store one canonical bound plan.** Persist the semantic declaration independently of row availability in task/attempt state; write its bound `AutomationStudioRecordProcessing` into the same saved `recordOutput.process` seam already used by `automationStudioAnswerFirstStepsWithResultProcessing`. Keep the source digest, binding map and revision as provenance. An explicit evidenced amendment replaces that declaration; normal processing never asks the model to restate filters.
4. **Apply automatically at the shared result owner.** Let exploration calls, forward passes, carried rows and saved-Flow batches all enter the same result-feed owner. Preserve their actual `RecordSchema`, reconcile compatible schemas explicitly, and refuse conflicting types/identity metadata instead of inferring over them. Every answer/read-back/completion/publication then uses the same pure evaluator over full retained rows, with presentation projection last.
5. **Return missing evidence as a repairable state.** Add a narrow owned processing result union: ready with rows/account, or missing-evidence with condition/source reference, field, issue and affected row count. Incomplete required evidence must not be read as an empty successful dataset or as unfiltered success. Feed this through existing result feedback and make completion require a ready processed answer; the ongoing attempt can gather the named evidence. Explicit `is: absent` remains a real condition, distinguished from an unreadable/missing-required comparison.
6. **Default identity and cleaning.** Use a complete validated schema primary key; if any identity component is unavailable, use whole allowed source-row identity, never a partial key. Without a validated primary key, use whole allowed source rows. Keep original display values untouched and derive only comparisons. Preserve existing canonical URL/identity semantics; do not introduce tracking/link heuristics without verifying the owning identity seam.
7. **Replace blind processing calls with explicit amendments.** Automatic processing is unconditional; `core.set_result_processing` becomes an explicit declarative amendment/field-binding repair, carrying instruction/condition provenance and the changed evidence or person correction. Keep semantic repair possible, and retain old/new plan/account evidence. Do not impose a call cap or an arbitrary freeze. An unchanged plan is a read-back of the same account, not another model-driven transformation pass.

## Additional paths requiring lead approval before implementation

- Interpretation and request forwarding after t976 integrates: `runtime/conversations/instructions/{prompt,decision,interpret,request}.ts`, `runtime/conversations/commands/{command,build}.ts`, conversation request/context forwarding, bootstrap command/request contracts/parsers, and the public bootstrap input type. These carry a declaration, never authority.
- Durable pre-row declaration and clock injection: `answer-first/task-memory` types/storage plus `attempt/{contracts,state,run-attempt}.ts` and the minimal opening/carry-on seed seams. P4 is touching task model memory, so serialize/sync these files after its handoff. Do not edit service.ts concurrently with P4.
- `answer-first/rows/processed-rows.ts` for explicit `now` and schema-preserving return values; P1 owns the adjacent schema/row contracts until its handoff. Carry-on needs the actual retained schema, not a re-inferred schema from projected rows.
- Completion's ready/missing-evidence integration may require a minimal result contract/completion seam outside the currently owned directories. No judge internals or result-verification implementation is proposed; approval is needed before touching a completion boundary.

## Verification plan

The remaining automatic-stage acceptance must cover schema metadata reconciliation, saved declarations and actual live/replay/shared-feed integration with one supplied reference clock. Owned operator tests now cover hidden conditions/sort, promoted/organic duplicates, incomplete identities, boolean flags, currency/count/date readers, missing evidence, exclusions, unchanged inputs, pure live/replay parity, and legacy preservation. Runtime integration remains dependent on the shared handoff/sync.

Outcome: Partial — independent operators, presence follow-up and strict provenance/stamp step complete, validated and frozen. Remaining P2 runtime integration awaits P1 handoff/sync.
Changed: Latest step is the ten owned process contract/parser/declaration/binding/test files listed above and this report; prior independent changes are checkpointed by the lead.
Validation: Latest provenance step -> 3 files / 59 tests passed; contracts check/audit/diff -> exit 0. Prior operator/presence checks and lead's independent 77/77 post-sync result are recorded above with exact commands/history.
Not verified: P1 transport completion, persistent declaration/feed integration, final clock/publication/completion/store readiness seams; live browser/provider behavior was not run.
Report: `docs/working/data-first-simplification-plan/reports/t984-data-stage.md`.
Notes: t976 stays frozen. No held P1/P4-dependent source changed. No git mutations or full/paid runs.

Lead verification, 2026-11-22: gated pnpm --filter @fluxiq/contracts exec vitest run src/record-sets/process/tests/processing-declaration.test.ts src/record-sets/process/tests/automatic-processing.test.ts src/record-sets/process/binding/tests/bind.test.ts --maxWorkers=1 --minWorkers=1 --fileParallelism=false -> 3 files, 79/79 passed, 2.10 seconds. Core provenance checkpoint 8c86122d0. Runtime integration still held for P1.

## Runtime handoff and processing clock decision

The lead has now synchronized permission, P4 and accepted P1 Core into both t984 trees, including contracts 0.23.0 / fluxiq 0.52.0. P2 runtime implementation is released in the approved paths. S8 lifecycle work has reached its tested endpoint and is handed back to the lead. No heavy validation job is queued or running for this worker; new submissions are held during the lead's quiet shared-gate switch.

Clock decision from the lead: each runtime run keeps its actual queued, started and finished timestamps. Freeze one immutable **processing reference time** at the first real `session.startedAt` of the logical attempt, persist it with processing provenance, and carry that same reference across resumed segments. Feed, explicit processing tools and final dataset-store evaluation must consume this exact reference. Do not change a resumed runtime run's actual `startedAt` to the prior segment's time.

The implementation will first inspect existing attempt metadata for a truthful original reference. If none exists, add narrowly named optional `processingReferenceTimeMs` in the approved attempt/task-memory persistence scope and validate it as a finite timestamp. Missing/invalid reference on old carried automatic data is repairable missing evidence: a newly sampled current clock cannot faithfully reinterpret previously captured relative dates. Legacy saved processing keeps its existing mode; provenance absence does not opt a saved Flow into automatic processing. Exact additional schema/persistence paths will be reported to the lead before editing beyond the approved store/task-memory scope.

New interpretation declarations distinguish explicit action-only `null`, a supplied processing object (including valid empty `process: {}`), and a missing declaration. Omission on a new interpretation is never a legacy bypass or action-only N/A. Undefined legacy behavior is reserved for provably old persisted task metadata. The framework stamps actual source/revision/bindings, preserves contributing evidence pages and copied full schemas, and refuses missing/mismatched automatic provenance repairably without stale answer rows.

### Runtime implementation underway; first snapshot frozen for focused validation

- Interpretation response: root `process: null` explicitly declares action-only N/A; root `process: {}` is a valid data task with no extra criteria. A supplied object uses the existing processing dialect and written field names. A new omitted/malformed declaration becomes an explicit missing envelope. Internal/direct API transport is `taskProcessing: null | { process?: JsonValue }`; only its `process` key is allowed. The model never supplies a provenance stamp. The lead and P4 worker received this exact handoff; historical recorded model replies remain unchanged.
- Persisted task metadata now holds the framework digest/revision and original unbound declaration. A kept task reuses it. A genuinely new direct API task with omitted metadata stays missing too; no instruction-word heuristic turns it into action-only or legacy. Undefined behavior is retained only for provably saved old task memory without a new declaration.
- The owned feed now reconciles actual contributing retained schemas through P1's merger, refuses missing/conflicting schemas and ambiguous source labels, binds the declaration, fixes sort types when real semantic/value metadata supplies them, and calls the shared evaluator in explicit automatic mode. It returns selected full originals with display columns separate. Unavailable conditions/sort/output/source/reference evidence produce zero answer rows and no answer dataset id; filtering is never silently dropped. Explicit `minRows: 0` remains valid with a known source/schema.
- Automatic processing amendments require an explicit reason naming changed source evidence or a person's correction. An unchanged canonical plan reads back the same account without a revision bump. Model-supplied declaration metadata is refused at both automatic and legacy tool boundaries. The canonical bound plan replaces prior task criteria on saved contributing outputs; legacy saved processing retains its existing merge semantics.
- Completion's approved `completion/check.ts` callback precedes caller confirmation, judge-off acceptance, replay acceptance and judge success. Missing data readiness returns the existing repairable refusal. Explicit action-only N/A proceeds normally; there is no new terminal ending.
- The lead approved minimal `rows/{row-sink,sink-type}.ts` lifecycle additions: `withhold()` retires only tracked current/logical-attempt publications, including carried ones; captures and unrelated history remain. It removes local publication accounts only after successful retirement and reports partial failure for retry. Missing readiness invokes it before publishing/completing, so an earlier ready answer cannot remain the latest valid result merely because a later answer was withheld.
- The lead approved internal `attempt-store/{record,store}.ts` and `carry-on/carried-opening.ts` persistence. They retain the same validated `processingReferenceTimeMs` and exact typed `resultEvidence` bundle. Each save replaces this attempt's latest checkpoint; it does not append checkpoint copies. This is necessary because pending data creates no answer publication from which original contributing page identity could otherwise be recovered. Restoring requires current kept-step identity, matching fields/conditions, copied full schema and original-row membership; no preview or guessed association can supply it. Serialized-size measurement and reopen regressions remain to be added/run.
- The lead approved `rows/copied-rows.ts` plus owning tests to carry a validated zero-row source as a zero-row batch, retaining source identity/schema for legitimate empty contracts. Existing nonempty copying and legacy preview fallback are otherwise unchanged.
- Store integration dispatches canonical v1 declarations to the same automatic evaluator. Missing required evidence/reference deletes old answer rows and invalidates the ready marker in the same transaction while preserving collected originals. Known empty selection materialization remains independent of task/minimum success. Plain saved-Flow runs use their actual start; exploration/carry-on reads the strict persisted processing reference in existing `runtime_runs.summary_json` metadata, never a newly sampled clock for old relative dates. No DB migration/public timing field change.
- The established publication boundary remains: the feed evaluates canonical selection; row sink materializes those selected full originals using its existing `dedupe: false`/display-column declaration. Canonical criteria, counts and actual contributing pages stay in evidence. This avoids a second task-selection pass over an already limited answer. Saved-Flow raw datasets use canonical processing directly.

The shared gate compatibility switch has completed. The first focused snapshot is frozen and queued through label `t984-runtime-unit-initial` (no estimate/priority override), with no result claimed yet:

```powershell
# Working directory: C:/Users/osrs_/FluxStuff/fxwork/t984/!FluxIQ/packages/fluxiq
node C:/Users/osrs_/FluxStuff/fxwork/.heavy-slots/heavy-slot.mjs run t984-runtime-unit-initial -- node ../../node_modules/vitest/vitest.mjs run --maxWorkers=1 --minWorkers=1 --fileParallelism=false src/runtime/conversations/instructions/tests/processing.test.ts src/framework/automation-service/service/answer-first/result-feed/tests/automatic.test.ts src/framework/automation-service/service/answer-first/rows/tests/session.test.ts src/framework/automation-service/service/answer-first/rows/tests/copied-rows.test.ts src/framework/automation-service/service/answer-first/rows/tests/superseded-publication.test.ts src/framework/automation-service/service/answer-first/completion/tests/processing-readiness.test.ts
```

Not yet verified in this runtime step: executable focused tests, package types/build/audit, real SQL invalidation/reference reopen, production service/carry-on integration and fixture-size accounting. Existing historical scripted service fixtures omit the newly required declaration; they need truthful per-task metadata corrections if exercised, never a blanket N/A default. No historical recorded reply has been changed.

The initial six-file validation did **not admit or start tests**. While it waited, the lead's read-only review identified incomplete bundle validation and unsafe clearing of missing-source provenance. The shared gate also reported an admission-lock EPERM in another ticket. At the lead's explicit coordination request, normal session cancellation (Ctrl+C on exec session 25831) ended this owned pre-admission process with exit 1. No lock/ticket file was manually changed and no active test was interrupted. This is **cancelled before tests**, not an executable test failure or pass. Runtime/six-test freeze is lifted for the acknowledged fixes; new heavy submissions remain held until the lead clears gate diagnosis.

### Corrected runtime snapshot in progress (no runtime tests claimed)

The initial waiting-only ticket was cancelled before tests. The lead has now cleared the repaired shared gate (Merit 3008788; 96 checks plus native smoke), with P1 and t986 tickets ahead. This worker currently has no queued/running heavy job and will submit only the corrected snapshot.

Acknowledged review fixes are implemented for exact unresolved source tracking and a full typed evidence reader. A missing original page can be settled only by an explicit unique step/source/read-version/place association with actual replacement evidence; unrelated new reads cannot clear the requirement. Valid partial restoration survives checkpoint/reopen, and bound/saved processing is withheld while originals remain missing. The reader validates page/coverage/working/contract/processing/missing-evidence members rather than casting after a partial helper. New disjoint regressions cover both findings, but are not executed yet.

The real FluxNode entry creates no chat interpretation. It now has a supported missing-first semantic declaration via the existing processing tool: process:null plus why is allowed only when no data declaration exists and no positive records/output requirement exists. It cannot erase existing criteria, including malformed criteria. Positive output dependency comes from an optional observer in the existing deterministic shaper, reused by required-rows and kept as an internal true-only caller restriction across carry-on; no second type classifier or model trust flag.

Input-dependent criteria are required for acceptance on the SAME FluxNode task key. The original semantic declaration retains only explicit existing {$input:name,test:value} forms at allowed comparison/text/duration/limit value positions; it never lifts equal constants. The framework resolves from current nonsecret caller inputs before binding/stamping, and saves canonical parameter templates at the corresponding value positions. Missing or invalid current values refuse readiness; old test examples cannot execute as live evidence. Static record-output/domain validation may resolve a copy of fallback examples, leaving the stored template untouched. Source/revision and actual stored-field binding provenance remain framework-owned for each effective resolution.

The model decision boundary now refuses any own process.declaration at documented recordOutput locations, including null/undefined, and raw state/row/step processing bindings before translation. Captured row fields named declaration remain ordinary data. Whole-script/nested-plan acceptance has equivalent scoped checks using existing plan/script readers; production saved Flow assembly does not enter this model acceptor. Further dispatch tracing found the engine parameter-refresh and forward replay resolver seams also need the same current-input requirement before they can consume saved automatic templates. Exact additional paths and a serialized flow-stage hunk were requested from the lead; none of those held paths is edited yet.

Runtime source and tests remain in progress. Newly authored unit, real-SQL, carry-on, retained-schema, source-readiness, malformed-provenance, FluxNode-output dependency and input-binding tests have not yet run. No passing typecheck/build/audit is claimed for this runtime step. No generic historical fixture was defaulted to N/A, no historical recorded reply was patched, and no paid/full/browser run or git mutation occurred.

### Current runtime validation snapshot

The next ticket `t984-runtime-unit-corrected` was also still pre-admission when the lead's review confirmed two dispatch gaps. At the lead's request, normal Ctrl+C ended only exec session 37015, exit 1; latest output explicitly said waiting for an earlier ticket. An exact-label node-process count then returned 0. No validator started, no lock/ticket file was manually changed, and no other job was cancelled.

Corrected before requeue: the shared neutral `components/automation/processing-inputs.ts` requires full retained schema for every canonical automatic template, including unbound ones; it refuses object or nested-object caller operands before a generic parameter resolver could read literal caller data as new binding instructions. Primitive/list operands still face the existing strict process parser against the schema. Field names/grammar/row/step/arbitrary merged state cannot become caller bindings. The framework uses the same helper after translating explicit untrusted $input forms. Static validation resolves only a copy of process test examples and leaves other parameters and the persisted template unchanged.

The saved-flow preflight now runs inside the existing never-throw best-effort boundary. Saved draft steps are a flat array: repeat/on_failed routing refers to sibling ids, and scheduledCandidate holds a source node id, not a nested body. The regression checks a later routed data read before an earlier lasting step starts, and contains malformed saved input repairably. Engine parameter refresh and every forward replay PassCall validate against actual optional callerInputs before generic resolution; missing caller provenance is not replaced by prior node state or fallback. The forward object already travels through the tool/part-run owners, so only its additive type, round forwarding, draft call and span sites changed. P6 confirmed those shared files frozen/free; the lead will integrate the separate observation metadata hunks serially.

The source/test snapshot is now frozen for the explicit-file command below. It is queued as exec session 41435, waiting behind prior tickets, with no result yet:

```powershell
# Working directory: C:/Users/osrs_/FluxStuff/fxwork/t984/!FluxIQ/packages/fluxiq
node C:/Users/osrs_/FluxStuff/fxwork/.heavy-slots/heavy-slot.mjs run t984-runtime-unit-ready -- node ../../node_modules/vitest/vitest.mjs run --maxWorkers=1 --minWorkers=1 --fileParallelism=false src/runtime/conversations/instructions/tests/processing.test.ts src/framework/automation-service/service/answer-first/result-feed/tests/automatic.test.ts src/framework/automation-service/service/answer-first/rows/tests/session.test.ts src/framework/automation-service/service/answer-first/rows/tests/copied-rows.test.ts src/framework/automation-service/service/answer-first/rows/tests/superseded-publication.test.ts src/framework/automation-service/service/answer-first/completion/tests/processing-readiness.test.ts src/framework/automation-service/service/answer-first/completion/tests/empty-readiness.test.ts src/framework/automation-service/service/answer-first/result-feed/tests/read-evidence.test.ts src/framework/automation-service/service/answer-first/result-feed/tests/source-readiness.test.ts src/framework/automation-service/service/answer-first/result-feed/tests/empty-carry.test.ts src/framework/automation-service/service/answer-first/result-processing/tests/retained-schema.test.ts src/framework/automation-service/service/answer-first/result-processing/tests/inputs.test.ts src/runtime/llm/tests/processing-declaration-input.test.ts src/runtime/flow-authoring/bootstrap/authoring/tests/processing-input.test.ts src/runtime/flow-authoring/bootstrap/plan/tests/processing-input.test.ts src/components/automation/tests/processing-inputs.test.ts src/engine/automation/parameter-refresh/tests/inputs.test.ts src/runtime/llm/node-tools/replay/tests/processing-input.test.ts src/framework/automation-service/service/fluxnode/outputs/tests/required-rows.test.ts src/framework/automation-service/service/fluxnode/tests/processing-options.test.ts src/framework/automation-service/service/answer-first/attempt/tests/processing-input.test.ts
```

The framework rebinds the semantic declaration against each actual retained schema/current input resolution and supplies actual field bindings; a prior filled-value stamp is not used as a hash proof. Changing an input value changes effective comparison values while preserving the same semantic source/revision and fixed constants. Saved source authority remains the owner of executable authenticity. No runtime acceptance is claimed until the queued checks and remaining SQL/service/FluxNode/type/build/audit gates have actually passed.

### P3 generic guidance proposal (report only; source unchanged)

The current emitted explorer role is `runtime/answer-first/guidance/guidance.ts`, joined by `overridden-guidance.ts` and `system-instructions.ts` under `fluxiq.answer-first`. Preserve existing override ids; bump the guidance version when text changes. Proposed exact replacement/additive text follows; it contains no site/scenario facts or oracle values.

**`explorer.role.rows` replacement:**

> Never invent or type an answer row. Read the actual source records with their full safe schema, including fields needed for conditions, marks, identity and order even when those fields are not answer columns. Keep upstream values and explicit exclusions. Collect the relevant source broadly when the needed evidence is already available; the task's declared data processing automatically selects, deduplicates, orders and limits those original records as they arrive and on saved runs. `columns` controls display and does not remove retained evidence. Do not make another processing call or re-read unchanged data merely to make declared processing run. Missing or unreadable required evidence is unfinished work: capture or repair the named source fields, schema or binding, then continue.

**`explorer.role.work_list` action clarification:**

> For repeated acts, first read a list whose own `where` keeps only the items the person asked you to act on. Do the act on one eligible item and check what happened, write that general step with its repeat, then use `core.run_flow` to finish the eligible items from the current state. Automatic result filtering selects the answer data; it does not narrow an action loop or authorize an act. Never apply an act broadly and expect result processing to undo the extra changes.

**New-data/missing-first paragraph, attached to the existing rows/declared-processing section rather than a new DSL:**

> A new task needs its semantic data declaration even when it entered directly rather than through chat. If Core says that declaration is missing, capture the actual retained source schema and use `core.set_result_processing` with the requested conditions, order and display columns plus `why`; `{}` is a valid declaration when no extra data criteria are requested. Only a task that asks for acts or words without a data answer may first declare `process: null` with `why`. An explicit records/output requirement or an existing data declaration cannot be erased this way. Never supply `declaration`, `source`, `revision` or `bindings`; Core binds the written references to actual stored fields and stamps the provenance.

**Current-input operand paragraph:**

> When a processing value comes from a real caller input, write the existing explicit form `{"$input":"name","test":value}` at that comparison, text, duration or limit operand. Use only a current nonsecret caller input name. Keep fixed instruction constants literal even when one happens to equal today's input. Do not bind field names, columns, operators, identity or other grammar, and never write raw `$state`, `$row` or `$step` into task processing. Core resolves the current input on each run; a test value is a validation example, not a substitute for a missing or invalid current input.

**`explorer.role.completion` replacement:**

> Complete only after this initial live pass has obtained the person's actual final result: every requested page and matching record, and every required act really done. A page sample, a written loop or a saved Flow is not the result. State the loop once and run it forward from where the target stands until the requested work is done; nothing runs afterward to finish it for you. For data, Core must have ready processing over the contributing originals; a missing declaration, source, schema, field or current input remains repairable unfinished work. An empty materialization is not universal task success: the actual task/output contract decides whether an explicitly permitted empty answer is sufficient. If completion is refused, obtain the named missing evidence or repair the binding and continue.

**Core shared evidence policy replacement for the current optional/manual processing sentences:**

> When a requested condition or sort key is available on the listed records, retain it as a source field, including a mark or badge, and let declared automatic processing select the answer from those originals. Prefer a source's filter only when it reduces the necessary collection substantially or supplies evidence unavailable on its records. A source filter's option name alone is not proof of each record's condition. Use `core.set_result_processing` for a missing first declaration or an explicit evidenced semantic/binding correction, with `why` naming changed evidence or the person's correction; unchanged criteria need no repeated call. Rows a later step acts on are still narrowed by that read's own `where`.

The shared policy lives in `runtime/llm/evidence-loop-decision.ts` and is emitted directly by `runtime/llm/provider-task/system-prompt.ts` for non-staged evidence decisions, and by `runtime/llm/stages/instructions.ts` as `core.loop-stage.gather.tool-policy` for staged requests. Updating one owned policy value covers both; do not clone it into another prompt. The active answer-first composer removes its build-only goal sentence by an exact string replacement; retain/test that distinction or replace it deliberately so a wording edit cannot silently reintroduce a Flow-only goal.

**Downstream web-only Lists replacement:**

> Lists. State paging as one loop: read the list, then Next page on that same list, then repeat the read through Next page while it succeeds, respecting any page range the person requested. Retain each source occurrence with its page and fields. In an active task attempt, run that kept loop forward from the current page until all requested pages have been read or the site shows that the requested range has ended. Reading one page and trying Next can demonstrate the loop, but cannot stand in for the task's final data.

This replaces the contradictory “do not read every page while exploring” sentence in downstream `domain/src/runtime/llm-evidence/system-instructions/instructions.ts`, with its version and owning length/content assertions updated. Preserve its web-only browser/Next-page vocabulary and Core's domain-neutral policy boundary.

**Roles/pins to check in P3:** explorer paragraphs and guidance tests; shared unstaged and staged evidence-decision policy; `node-tools/result/tool.ts` description/schema (already updated for missing-first/automatic amendments, needs explicit-current-input wording once the dispatch seam passes); provider-task `answer-first-system-prompt.test.ts`; `default-wording.test.ts` with the explorer system-prompt snapshot. The legacy provider alias `deepseek/system-prompt.ts` re-exports the public composer, so its `system-prompt-pins.json` cases `evidence_tool_decision` and `evidence_tool_decision_staged` must be regenerated from actual emitted text. Flow-bootstrap pins (`flow_bootstrap`, `_reusable`, `_recordings`) change only if their shared authoring paragraphs are deliberately edited. Judge/verification snapshots and pins (`judge-system-prompt.txt`, `verification-system-prompt.txt`, `loop_verification`, `_build_test`) must be reviewed with P6's actual full-safe-row/schema/display view; they should change only when their own emitted guidance changes. The current tool-payload snapshot uses three synthetic tools and does not pin the real processing tool; add/verify its real emitted payload separately rather than pretending that snapshot covers it.

**Legacy distinction:** absence of persisted automatic provenance remains the old saved-flow processing mode; new omission is missing metadata and never a legacy bypass. Legacy declarations retain the existing evaluator/tool semantics. Generic guidance must not manufacture new conditions, a new automatic stamp or a blanket action-only default for old tasks. The current `core.result` text reports actionable missing readiness but does not emit an explicit automatic/legacy mode tag; if P3 needs models to branch on mode, expose a framework-owned mode in that existing result slot rather than instructing the model to guess it from tool availability.

### Proposed explicit model-visible processing mode (held; no source edit)

Exact trace: `attempt/opening.ts` resolves new/kept/provably-legacy task metadata; `result-feed/stage.ts` holds `declaration === undefined` as legacy and a present declaration as the new automatic mode. Within automatic mode, `task:null` is explicit action-only N/A and `task:{}` is missing the first data declaration. `feed.readiness()` already returns distinct `legacy`, `not-applicable`, `missing-evidence`, and `ready` states internally. `feed.slot()` emits only a string header/changes and, on failure, “Data processing needs evidence: ...”. `attempt/decide.ts` puts that string into the model's fixed evidence entry `{callId:"core.result",toolId:"core.result",value:{result:slot}}` every decision. It emits neither a mode nor the readiness state as a discriminant.

No existing equivalent is sufficient before a tool call: an automatic processing amendment can return `set.declaration` after successful binding, and result evidence can carry `processing.declared.declaration`; both can legitimately be absent before binding, for N/A or while evidence is missing. Absence cannot distinguish legacy from unfinished automatic mode. The same processing tool is offered in both modes.

Smallest proposed change: in that existing `attempt/decide.ts` fixed entry, retain `value.result` exactly and add sibling `processingMode: "automatic" | "legacy"`, computed solely by `run.result.processingDeclaration() === undefined ? "legacy" : "automatic"`. This reuses the existing feed API and adds no exported type, second state, parser, tool or heuristic. Present metadata remains automatic for missing-first and action-only N/A alike; semantic readiness still comes from the current result text and completion gate. A separate readiness field is unnecessary for this distinction. The framework-owned model evidence is already arbitrary JSON and its consumers keep reading `value.result`, so the addition does not alter row selection, saved metadata or public API.

Owning compatibility regression proposal: `attempt/tests/processing-context.test.ts` invokes the actual decider with a provider-free request capture and real feed for four cases: provably legacy, automatic missing-first, automatic action-only N/A, automatic bound-ready data. Assert the emitted core.result keeps its existing `result` string and carries the exact mode; changing tool availability cannot change it. Assert no task/caller row field called processingMode can override the framework sibling. Add one existing real-service request assertion in the automatic service test if its current acceptance already exercises this boundary; no extra model/provider invocation. Keep this source change held until the queued snapshot has an observed result, then validate only this owner plus affected types/checks.

The lead approved that exact emitted-context seam and requested it before first runtime validation. Ticket `t984-runtime-unit-ready` was confirmed pre-admission by status (empty holders; t986 still ahead), then normally cancelled on exec session 41435, exit 1. Exact-label process count returned 0; no validators started. `attempt/decide.ts` now adds only the proposed sibling processingMode, and the new owning test captures the actual request for all four modes with tool availability toggled and contradictory row data. It stops at the captured harness boundary and invokes no model provider. These are the only two executable-file additions after lead's frozen WIP checkpoint Core `05d61fea4`; that checkpoint is not runtime acceptance.

Current frozen runtime unit ticket: `t984-runtime-unit-mode`, exec session 81088, waiting behind the earlier FIFO ticket. Exact command:

```powershell
# Working directory: C:/Users/osrs_/FluxStuff/fxwork/t984/!FluxIQ/packages/fluxiq
node C:/Users/osrs_/FluxStuff/fxwork/.heavy-slots/heavy-slot.mjs run t984-runtime-unit-mode -- node ../../node_modules/vitest/vitest.mjs run --maxWorkers=1 --minWorkers=1 --fileParallelism=false src/runtime/conversations/instructions/tests/processing.test.ts src/framework/automation-service/service/answer-first/result-feed/tests/automatic.test.ts src/framework/automation-service/service/answer-first/rows/tests/session.test.ts src/framework/automation-service/service/answer-first/rows/tests/copied-rows.test.ts src/framework/automation-service/service/answer-first/rows/tests/superseded-publication.test.ts src/framework/automation-service/service/answer-first/completion/tests/processing-readiness.test.ts src/framework/automation-service/service/answer-first/completion/tests/empty-readiness.test.ts src/framework/automation-service/service/answer-first/result-feed/tests/read-evidence.test.ts src/framework/automation-service/service/answer-first/result-feed/tests/source-readiness.test.ts src/framework/automation-service/service/answer-first/result-feed/tests/empty-carry.test.ts src/framework/automation-service/service/answer-first/result-processing/tests/retained-schema.test.ts src/framework/automation-service/service/answer-first/result-processing/tests/inputs.test.ts src/runtime/llm/tests/processing-declaration-input.test.ts src/runtime/flow-authoring/bootstrap/authoring/tests/processing-input.test.ts src/runtime/flow-authoring/bootstrap/plan/tests/processing-input.test.ts src/components/automation/tests/processing-inputs.test.ts src/engine/automation/parameter-refresh/tests/inputs.test.ts src/runtime/llm/node-tools/replay/tests/processing-input.test.ts src/framework/automation-service/service/fluxnode/outputs/tests/required-rows.test.ts src/framework/automation-service/service/fluxnode/tests/processing-options.test.ts src/framework/automation-service/service/answer-first/attempt/tests/processing-input.test.ts src/framework/automation-service/service/answer-first/attempt/tests/processing-context.test.ts
```

No runtime executable result is claimed yet. The previous pre-admission cancellations are scheduling/checkpoint history, not test failures or passes.

The lead checkpointed the additive emitted mode seam as Core `c1f42f283` after diff-check exit 0; it remains unaccepted until runtime validation. P3's exact mode sentence can now be: “Core's `core.result` entry names `processingMode`. `automatic` uses the held semantic declaration and readiness requirements, including a missing first declaration or explicit action-only N/A; `legacy` keeps the saved task's existing processing behavior. Do not infer this mode from a tool's availability or from a missing bound stamp.” The lead owns P6 synchronization and prompt implementation.

Final-publication trace, read-only: `attempt/ending.ts` with missing readiness calls `sink.withhold()`, ends the runtime session, then calls `sink.readBack()` with NO dataset id only for its store-processing side effect. `row-sink.ts` returns the empty own summary in that call rather than selecting any collected capture. The ending then returns `feed.rows()`, which remains unavailable with no answer dataset id. Raw `read.*` datasets persist/materialize as original evidence by design; they do not become the task's selected answer. Only tracked current/logical-attempt `step.*` publications are retired, including carried ones. The real SQL/service assertion must retain proof that a missing task has no published step.* result while its raw captures remain. No extra source change was needed for this trace.

### Exact helper-call compatibility inventory (read-only; tests pending)

Command in Core: `rg -l 'laterAttempts\(|fluxNodeLane\(|runBuild\(' packages/fluxiq/src/framework/automation-service/service/answer-first -g '*.test.ts'` and the same search in `service/fluxnode` -> 19 + 18 files. Paths below are relative to `packages/fluxiq/src/framework/automation-service/service/`. This search is scoped helper usage, not an exhaustive Core-suite audit. The counts include the new automatic-service and processing acceptance files; the remaining 35 are existing compatibility owners.

Answer First (19 files):

- `answer-first/attempt/tests/caller-replay.test.ts`
- `answer-first/attempt/tests/assemblable-flow-wins.test.ts`
- `answer-first/attempt/tests/carried-before.test.ts`
- `answer-first/attempt/tests/caller-seams.test.ts`
- `answer-first/flow-run/tests/replay-over-done-act.test.ts`
- `answer-first/flow-run/tests/repaired-read-conditions.test.ts`
- `answer-first/attempt/tests/task-humanness.test.ts`
- `answer-first/attempt/tests/run-overrides-press.test.ts`
- `answer-first/flow-run/tests/row-url-repeat.test.ts`
- `answer-first/attempt/tests/flow-stage-person-stop.test.ts`
- `answer-first/tests/acts-with-no-row.test.ts`
- `answer-first/tests/carry-on.test.ts`
- `answer-first/tests/interrupted.test.ts`
- `answer-first/tests/later-attempt.test.ts`
- `answer-first/tests/same-words.test.ts`
- `answer-first/tests/saved-read-restart.test.ts`
- `answer-first/tests/skipped-rows.test.ts`
- `answer-first/tests/endings/tests/saved-on-every-ending.test.ts`
- `answer-first/result-feed/tests/automatic-service.test.ts`

FluxNode (18 files):

- `fluxnode/tests/fluxnode-registry.test.ts`
- `fluxnode/tests/act-scope.test.ts`
- `fluxnode/tests/fluxnode-runs.test.ts`
- `fluxnode/tests/corrupt-scoped-memory.test.ts`
- `fluxnode/tests/idempotency.test.ts`
- `fluxnode/tests/managed-hosts.test.ts`
- `fluxnode/tests/model-routing.test.ts`
- `fluxnode/tests/pin-act-scope.test.ts`
- `fluxnode/tests/pinning.test.ts`
- `fluxnode/tests/owner-flows-reregister.test.ts`
- `fluxnode/tests/processing.test.ts`
- `fluxnode/tests/repair-routing.test.ts`
- `fluxnode/tests/secret-inputs.test.ts`
- `fluxnode/tests/secret-invariant.test.ts`
- `fluxnode/pipeline/tests/pipeline-runs.test.ts`
- `fluxnode/pipeline/tests/pipeline-secrets.test.ts`
- `fluxnode/pipeline/tests/source-continuation.test.ts`
- `fluxnode/pipeline/tests/source-secrets.test.ts`

Intentional classifications before any fixture edit: data tasks declare the actual requested conditions/order/columns, with an empty process only when no extra criterion is requested; action-only tasks explicitly declare null; mixed acts+rows remain data. A current input operand stays an explicit input binding, with unrelated constants literal. Provably old saved task metadata remains legacy and gains no manufactured criteria; intentionally omitted/malformed declaration tests remain missing, and Stop/budget/person-only behavior keeps its own ending. Shared helpers `answer-first/tests/{later-attempts,fake-library}.ts` and `fluxnode/tests/library-lane.ts` must receive at most explicit opt-in forwarding, never a generic N/A/empty default. Historical recorded model replies stay unchanged as first-divergence evidence.

After the first 22-file unit result, run impacted existing owners in a separate explicit-file, single-worker narrow batch, then correct only failures that actually demonstrate the new-entry fixture contract. Preserve the behavior each test is meant to verify and record changed expectations/call counts honestly; do not weaken criteria to preserve a mock's old success path. No whole Core suite or paid execution is authorized by this inventory.


### Corrected source-provenance and identifier snapshot (frozen; validation pending)

The last mode ticket was still pre-admission and was normally cancelled as requested (session 81088, exit 1); exact-label node-process count later returned 0. No runtime validator had started. The active replacement is `t984-runtime-unit-provenance`, exec session 14978, queued behind the earlier FIFO ticket. No source/test edits will occur while this snapshot is checked. Diff-check exited 0 with only normal LF/CRLF notices. These cancellations are scheduling history, not test failures or passes.

Source completeness now retains an optional nonnegative safe-integer `invalidCount` on actual read/page evidence. A positive or absent original count withholds automatic success rows and bound/stored processing, preserving the safe originals repairably. Stored verification reads return existing `node_id` and `invalid_count`; only a unique exact original batch with known producer identity can recover a missing per-source count. The exact copied-row producer constant is shared, so copied storage chunk collisions cannot manufacture original validation. Contradictory page/original counts or actual dataset associations are refused.

Copying keeps dataset invalid-count accounting exactly once across storage chunks; it never assigns that aggregate to an invented browser source. Restore reconciles the whole observed dataset aggregate against represented original sources. Positive/unreadable unrepresented aggregate provenance leaves a dataset-scoped missingEvidence reference, which survives individual rereads and publication/from-batches serialization. Existing SQL dataset.invalid_count gates automatic materialization atomically without a DB column; exact same-batch repair and startsOver replacement are tested separately from historical copied aggregate uncertainty.

The existing ResultEvidencePage now also has optional actual `datasetId`, emitted only from the feed's observed source-to-dataset map. It survives strict reading/from-batches and changing carry-on storage keys. Restore prefers that observed association and rejects conflicting exact original-batch metadata. Exact rereads replace the old page's datasetId with the NEW observed capture mapping; they never inherit a stale mapping while changing source. New tests cover two successive real CopyRows/checkpoint/reopen cycles for a named shared dataset, plus partial reread/checkpoint/reopen with a surviving whole-dataset hold. P6 acknowledged additive whole-page preservation.

Unidentified/missing originals can also be superseded by a genuinely complete fresh collection. The actual forward walker now supplies its executeTool callIds and the existing ledger sequence watermark only on successful, unaborted completion; the feed requires all contributing reads from that invocation, fresh sequence, full compatible schema, known zero invalid originals, actual first numeric site page/offset and observed paginator end for every contributing group. Page-set allocates the current ledger.seq then increments it, so freshness is >= the next-allocation watermark; the most recent pre-start page is watermark-1. Reused callIds alone cannot satisfy a later invocation. Receipt says fresh_collection, never restored. A finished partial walk, stale pages, unrelated collection, failed/aborted start, or opaque/unplaced first-page identity cannot clear the hold. No limit shortcut was introduced because the required ordered-prefix proof is unavailable.

Identifier parity reuses neutral contracts `FLOW_INPUT_IDENTIFIER` (the existing goal ASCII identifier rule) in goal parsing, the existing draft alias and neutral current-input validation. Case, underscore-leading and long names remain exact; runtime item reservation, own-input membership, supported operand positions and no processing equality lifting remain. Arbitrary public schema keys are still valid schemas and do not become raw processing paths. Secret-input policy is unchanged. Focused tests include own constructor/prototype/__proto__ roundtrips without inherited access or caller prototype mutation. Real FluxNode date-window acceptance now covers latest_date and LatestDate, each same key with changed values, unchanged literal lower bound and three saved zero-call restart/replays. Those real-SQL tests remain unexecuted until their separate batch.

The lead checkpointed this correction as Core 8c50dc21c (43 paths, 741 insertions/66 deletions; staged diff-check exit 0) while the report was written. This is frozen WIP, not accepted/pushed; initial runtime 05d61fea4 and mode c1f42f283 remain part of the tested snapshot. Exact checkpoint inventory:

- `packages/contracts/src/fluxnode/flow/index.ts`
- `packages/contracts/src/fluxnode/flow/input-identifier.ts`
- `packages/contracts/src/fluxnode/flow/tests/input-identifier.test.ts`
- `packages/contracts/src/fluxnode/spec/goal.ts`
- `packages/contracts/src/fluxnode/spec/tests/goal.test.ts`
- `packages/fluxiq/src/components/automation/processing-inputs.ts`
- `packages/fluxiq/src/components/automation/tests/processing-inputs.test.ts`
- `packages/fluxiq/src/framework/automation-service/service/answer-first/attempt/round.ts`
- `packages/fluxiq/src/framework/automation-service/service/answer-first/attempt/run-attempt.ts`
- `packages/fluxiq/src/framework/automation-service/service/answer-first/flow-run/tests/input-bound-steps.test.ts`
- `packages/fluxiq/src/framework/automation-service/service/answer-first/result-feed/feed.ts`
- `packages/fluxiq/src/framework/automation-service/service/answer-first/result-feed/read-evidence.ts`
- `packages/fluxiq/src/framework/automation-service/service/answer-first/result-feed/read-of.ts`
- `packages/fluxiq/src/framework/automation-service/service/answer-first/result-feed/restore.ts`
- `packages/fluxiq/src/framework/automation-service/service/answer-first/result-feed/source-state.ts`
- `packages/fluxiq/src/framework/automation-service/service/answer-first/result-feed/tests/collection-forward.test.ts`
- `packages/fluxiq/src/framework/automation-service/service/answer-first/result-feed/tests/collection-replacement.test.ts`
- `packages/fluxiq/src/framework/automation-service/service/answer-first/result-feed/tests/invalid-source.test.ts`
- `packages/fluxiq/src/framework/automation-service/service/answer-first/result-feed/tests/read-evidence.test.ts`
- `packages/fluxiq/src/framework/automation-service/service/answer-first/result-feed/tests/source-validation-support.ts`
- `packages/fluxiq/src/framework/automation-service/service/answer-first/result-feed/tests/validation-restore.test.ts`
- `packages/fluxiq/src/framework/automation-service/service/answer-first/result-processing/tests/inputs.test.ts`
- `packages/fluxiq/src/framework/automation-service/service/answer-first/result/page-set.ts`
- `packages/fluxiq/src/framework/automation-service/service/answer-first/result/types.ts`
- `packages/fluxiq/src/framework/automation-service/service/answer-first/rows/copied-node.ts`
- `packages/fluxiq/src/framework/automation-service/service/answer-first/rows/copied-rows.ts`
- `packages/fluxiq/src/framework/automation-service/service/answer-first/rows/index.ts`
- `packages/fluxiq/src/framework/automation-service/service/answer-first/rows/tests/copied-rows.test.ts`
- `packages/fluxiq/src/framework/automation-service/service/datasets/run-datasets.ts`
- `packages/fluxiq/src/framework/automation-service/service/fluxnode/tests/processing.test.ts`
- `packages/fluxiq/src/framework/persistence/automation/project/run-dataset-store.ts`
- `packages/fluxiq/src/framework/persistence/automation/project/tests/run-dataset-automatic.test.ts`
- `packages/fluxiq/src/framework/persistence/automation/project/tests/run-dataset-store.test.ts`
- `packages/fluxiq/src/runtime/flow-authoring/bootstrap/authoring/script-binding.ts`
- `packages/fluxiq/src/runtime/flow-authoring/bootstrap/authoring/tests/script-binding.test.ts`
- `packages/fluxiq/src/runtime/flow-authoring/draft/binding-forms.ts`
- `packages/fluxiq/src/runtime/flow-authoring/draft/tests/binding-forms.test.ts`
- `packages/fluxiq/src/runtime/llm/node-tools/replay/forward.ts`
- `packages/fluxiq/src/runtime/llm/node-tools/run/flow-part.ts`
- `packages/fluxiq/src/runtime/llm/node-tools/run/tests/collection-receipt.test.ts`
- `packages/fluxiq/src/runtime/result-verification/result-evidence/from-batches.ts`
- `packages/fluxiq/src/runtime/result-verification/result-evidence/tests/from-batches.test.ts`
- `packages/fluxiq/src/runtime/result-verification/result-evidence/types.ts`

Initial corrected 32-file unit command (queued, no validator output yet):

```powershell
# Working directory: C:/Users/osrs_/FluxStuff/fxwork/t984/!FluxIQ/packages/fluxiq
node C:/Users/osrs_/FluxStuff/fxwork/.heavy-slots/heavy-slot.mjs run t984-runtime-unit-provenance -- node ../../node_modules/vitest/vitest.mjs run --maxWorkers=1 --minWorkers=1 --fileParallelism=false src/runtime/conversations/instructions/tests/processing.test.ts src/framework/automation-service/service/answer-first/result-feed/tests/automatic.test.ts src/framework/automation-service/service/answer-first/rows/tests/session.test.ts src/framework/automation-service/service/answer-first/rows/tests/copied-rows.test.ts src/framework/automation-service/service/answer-first/rows/tests/superseded-publication.test.ts src/framework/automation-service/service/answer-first/completion/tests/processing-readiness.test.ts src/framework/automation-service/service/answer-first/completion/tests/empty-readiness.test.ts src/framework/automation-service/service/answer-first/result-feed/tests/read-evidence.test.ts src/framework/automation-service/service/answer-first/result-feed/tests/source-readiness.test.ts src/framework/automation-service/service/answer-first/result-feed/tests/empty-carry.test.ts src/framework/automation-service/service/answer-first/result-processing/tests/retained-schema.test.ts src/framework/automation-service/service/answer-first/result-processing/tests/inputs.test.ts src/runtime/llm/tests/processing-declaration-input.test.ts src/runtime/flow-authoring/bootstrap/authoring/tests/processing-input.test.ts src/runtime/flow-authoring/bootstrap/plan/tests/processing-input.test.ts src/components/automation/tests/processing-inputs.test.ts src/engine/automation/parameter-refresh/tests/inputs.test.ts src/runtime/llm/node-tools/replay/tests/processing-input.test.ts src/framework/automation-service/service/fluxnode/outputs/tests/required-rows.test.ts src/framework/automation-service/service/fluxnode/tests/processing-options.test.ts src/framework/automation-service/service/answer-first/attempt/tests/processing-input.test.ts src/framework/automation-service/service/answer-first/attempt/tests/processing-context.test.ts src/framework/automation-service/service/answer-first/result-feed/tests/invalid-source.test.ts src/framework/automation-service/service/answer-first/result-feed/tests/validation-restore.test.ts src/framework/automation-service/service/answer-first/result-feed/tests/collection-replacement.test.ts src/framework/automation-service/service/answer-first/result-feed/tests/collection-forward.test.ts src/runtime/result-verification/result-evidence/tests/from-batches.test.ts src/runtime/llm/node-tools/run/tests/collection-receipt.test.ts src/runtime/flow-authoring/draft/tests/binding-forms.test.ts src/runtime/flow-authoring/bootstrap/authoring/tests/script-binding.test.ts src/runtime/flow-authoring/bootstrap/authoring/tests/draft-bindings.test.ts src/framework/automation-service/service/answer-first/flow-run/tests/input-bound-steps.test.ts
```

Not yet run: this runtime unit batch; contracts identifier/goal/schema/secret-policy owner tests and contracts typecheck; runtime/real-SQL service, persisted provenance, source-invalid SQL repair and FluxNode replay tests; impacted existing 35 compatibility owners; fluxiq typecheck/build and structure/catalog checks. Earlier independent contract passes do not constitute acceptance of this runtime snapshot. No paid/provider/browser/full-suite run or git mutation occurred.


Next explicit owner commands are prepared only, not submitted or observed yet. They will follow the frozen unit result, keeping one Vitest worker and allowing FIFO admission between commands:

```powershell
# Core packages/contracts
node C:/Users/osrs_/FluxStuff/fxwork/.heavy-slots/heavy-slot.mjs run t984-input-identifier-contracts -- node ../../node_modules/vitest/vitest.mjs run --maxWorkers=1 --minWorkers=1 --fileParallelism=false src/fluxnode/flow/tests/input-identifier.test.ts src/fluxnode/spec/tests/goal.test.ts src/fluxnode/flow/tests/interface.test.ts src/fluxnode/type-schema/tests/parse.test.ts src/fluxnode/spec/tests/secret-inputs.test.ts
# Core packages/fluxiq
node C:/Users/osrs_/FluxStuff/fxwork/.heavy-slots/heavy-slot.mjs run t984-runtime-persistence -- node ../../node_modules/vitest/vitest.mjs run --maxWorkers=1 --minWorkers=1 --fileParallelism=false src/runtime/conversations/instructions/tests/processing-interpret.test.ts src/framework/automation-service/service/answer-first/attempt-store/tests/processing-provenance.test.ts src/framework/persistence/automation/project/tests/run-dataset-automatic.test.ts src/framework/persistence/automation/project/tests/run-dataset-store.test.ts src/framework/persistence/automation/project/run-dataset-answer/tests/reference-time.test.ts src/framework/automation-service/service/answer-first/result-feed/tests/automatic-service.test.ts src/framework/automation-service/service/fluxnode/tests/processing.test.ts
```

Package checks use the documented package scripts (`pnpm --filter @fluxiq/contracts check`, `pnpm --filter fluxiq check` and the affected library build commands) under the same heavy gate. The structure audit is `node scripts/structure-audit.mjs` from Core root; no full Core check/test/build sweep is planned. Exact executed commands and observed counts will replace these pending descriptions after execution.


### Paired source association correction (frozen; no validator started)

The lead checkpointed this two-file correction as Core 0706d1d97 after its own diff-check exit 0. It is not pushed/accepted; the queued command reads that exact frozen source over the earlier P2 checkpoints.

Read-only proof trace: existing `flow-run/batch-steps.ts` maps actual batch.nodeId through the run graph's bootstrapSymbolicKey and the assembly locator to a saved draft step; `flow-run.ts` invokes it after that real run. Carry-on restore has prior verification entries and saved steps, but not the exact prior-run graph/assembly-locator mapping. Recovering an opaque missing old dataset through that authoritative mapper would require validated original-run provenance, a separate extension; current id equality or pagination cannot recreate it. New automatic captures retain their observed page association directly.

Lead review confirmed that supersede compared listKey and where sets independently: original pairs (A,X),(B,Y) could be crossed into (A,Y),(B,X). The still-pre-admission 32-file ticket was normally cancelled on exec session 14978, exit 1; its last output said waiting for an earlier ticket and the exact-label node-process count returned 0. No tests started and no gate state was manually changed.

Only `result-feed/source-state.ts` and new `result-feed/tests/source-association.test.ts` changed after checkpoint 8c50dc21c. Supersession now requires every prior known tuple together in one fresh source. Partial knowledge constrains only its known components. Neither listKey nor where known cannot match vacuously; that source remains unavailable for whole-collection supersession, while an explicit reread of its exact kept step/read version/place with valid originals can still repair it.

Missing dataset references capture only actual observed page/source-to-dataset associations before supersession. If original pages are absent, actual referenced current pages are retained in the existing bundle with unresolved references; no missing page/row/schema is reconstructed. Checkpoint/reopen therefore retains the known paired association. A new capture may have a different opaque datasetId if the known collection tuple is proved. A truly unassociated missing dataset reference remains unknown even when some other collection is complete.

Explicit limitation: the existing successful forward receipt proves the fresh occurrences, first site page and pagination end of CURRENT contributing groups. It does not identify an opaque omitted old dataset without an original page/source/kept-step association. There is no current task-wide proof that such an unrelated missing reference was replaced, so this correction does not broaden that edge or silently clear it. Recovery needs restored original provenance or a separately evidenced authoritative mapping; no new terminal/retry cap is introduced.

Diff-check exited 0 (normal LF/CRLF notice). Source/tests are frozen for replacement explicit 33-file ticket `t984-runtime-unit-association`, exec session 49022, queued behind the earlier FIFO ticket; no executable result yet:

```powershell
# Working directory: C:/Users/osrs_/FluxStuff/fxwork/t984/!FluxIQ/packages/fluxiq
node C:/Users/osrs_/FluxStuff/fxwork/.heavy-slots/heavy-slot.mjs run t984-runtime-unit-association -- node ../../node_modules/vitest/vitest.mjs run --maxWorkers=1 --minWorkers=1 --fileParallelism=false src/runtime/conversations/instructions/tests/processing.test.ts src/framework/automation-service/service/answer-first/result-feed/tests/automatic.test.ts src/framework/automation-service/service/answer-first/rows/tests/session.test.ts src/framework/automation-service/service/answer-first/rows/tests/copied-rows.test.ts src/framework/automation-service/service/answer-first/rows/tests/superseded-publication.test.ts src/framework/automation-service/service/answer-first/completion/tests/processing-readiness.test.ts src/framework/automation-service/service/answer-first/completion/tests/empty-readiness.test.ts src/framework/automation-service/service/answer-first/result-feed/tests/read-evidence.test.ts src/framework/automation-service/service/answer-first/result-feed/tests/source-readiness.test.ts src/framework/automation-service/service/answer-first/result-feed/tests/empty-carry.test.ts src/framework/automation-service/service/answer-first/result-processing/tests/retained-schema.test.ts src/framework/automation-service/service/answer-first/result-processing/tests/inputs.test.ts src/runtime/llm/tests/processing-declaration-input.test.ts src/runtime/flow-authoring/bootstrap/authoring/tests/processing-input.test.ts src/runtime/flow-authoring/bootstrap/plan/tests/processing-input.test.ts src/components/automation/tests/processing-inputs.test.ts src/engine/automation/parameter-refresh/tests/inputs.test.ts src/runtime/llm/node-tools/replay/tests/processing-input.test.ts src/framework/automation-service/service/fluxnode/outputs/tests/required-rows.test.ts src/framework/automation-service/service/fluxnode/tests/processing-options.test.ts src/framework/automation-service/service/answer-first/attempt/tests/processing-input.test.ts src/framework/automation-service/service/answer-first/attempt/tests/processing-context.test.ts src/framework/automation-service/service/answer-first/result-feed/tests/invalid-source.test.ts src/framework/automation-service/service/answer-first/result-feed/tests/validation-restore.test.ts src/framework/automation-service/service/answer-first/result-feed/tests/collection-replacement.test.ts src/framework/automation-service/service/answer-first/result-feed/tests/collection-forward.test.ts src/runtime/result-verification/result-evidence/tests/from-batches.test.ts src/runtime/llm/node-tools/run/tests/collection-receipt.test.ts src/runtime/flow-authoring/draft/tests/binding-forms.test.ts src/runtime/flow-authoring/bootstrap/authoring/tests/script-binding.test.ts src/runtime/flow-authoring/bootstrap/authoring/tests/draft-bindings.test.ts src/framework/automation-service/service/answer-first/flow-run/tests/input-bound-steps.test.ts src/framework/automation-service/service/answer-first/result-feed/tests/source-association.test.ts
```



