# t984 automatic data stage — progress and retained-row seam

Worker: p0_permission. Discovery began while t976 validation waited; t976 is now complete and frozen in its own tree. No git mutations, paid calls, browser runs or full suites.

Current work: the automatic runtime/publication recovery, source-replacement producer, strict optional parser, successful-restore forwarding and read-only source proof are implemented/checkpointed. Receipt68/68, proof/replay16/16 and corrected package check passed. The independent compatibility baseline finished77pass/108fail; root fixed the demonstrated unscoped processing-cache write regression (9/9). P2 corrected its16 AF fixture owners with explicit task intent plus a no-default typed helper; their17-owner run is active. Judge owns15 disjoint FluxNode fixture owners/library-lane in t984; root owns opening/act-scope. Lead owns all git and paired integration.

Current observed checks: contracts 5 files / 50 tests plus package typecheck passed; affected semantic/static owners 3 files / 34 tests passed; real SQL/reference/FluxNode owners and source-provenance tests have observed passes recorded below. Publication restart recovery and explicit unavailable tracking both passed on real reopened Core. The canonical writer regression and chat/FluxNode first+three saved continuations passed 3 files / 8 tests, preserving full retained fields and zero-call proven repeats. Earlier failing baselines and their exact causes remain recorded; their failed totals are not represented as passes.

Current gate: `t984-af-compatibility-intent` is admitted on frozen owned sources (checkpoint153d0df0b plus root opening fix);17 owners are the16 AF failed files plus automatic-service real entry acceptance. Earlier independent baseline77/185 passed with108 failures is fully recorded below; its two corruption owners now pass12/12. P2 holds package-wide checks/audits/builds until both fixture lanes freeze. Still required: corrected AF results/fix loop, judge's FluxNode compatibility, final shared checks/build and lead verification. No paid/provider/browser or full-suite run. The sections below retain checkpoint history; the latest observations are at the end.

## Historical stable retained-row seam (accepted)

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

Required remaining acceptance work found during read-only freeze: a retirement failure at the ending can lose the tracked publication across restart. `attempt/keep.ts` returns on failed withhold before saving a new row, so the prior shown publication remains retryable. `attempt/ending.ts` catches that failure, then saves the missing-readiness result without rows; a later `carriedOn` copies prior datasets but currently re-registers only `carried.result.rows?.datasetId`. The failed publication can therefore be copied without being tracked for retirement. Existing partial-retirement tests prove same-process retry only. This is a material incomplete acceptance case, not accepted/deferred behavior.

The lead requires an observed first owner baseline before extending private state. Planned correction after that baseline: persist ONLY exact still-tracked publication IDs in strict private attempt metadata; preserve them at budget/Stop ending, validate on reopen, map them only through actual successful copy receipts, re-register those copied publications and retry retirement. Do not prefix-scan or delete raw datasets, including user-named raw datasets. Owning persistence/carry/sink/copy paths already fall within P2, but exact additive metadata/API shape and serialization with P6 will be confirmed before editing. Add a real restart regression for failed retirement -> ending -> copy/carry -> successful retirement, retaining unrelated raw evidence and withholding any fake ready publication. No new terminal outcome or cap is proposed. The current queued source/test snapshot remains unchanged.

Held API proposal: optional private publicationDatasetIds from the sink's exact tracked map, saved at keep/ending and forwarded through carried-opening; carry restores only IDs proved by successful copy receipts (the owning copy currently preserves actual dataset IDs). An optional copy observer can report successful from/to associations without changing the existing CopyRows result shape. Critically, malformed OPTIONAL publication metadata must preserve the real task/result, processing reference and source evidence on reopen. Decode that optional field as an explicit publication-tracking gap, analogous to optional judge metadata; do not discard the whole attempt, pretend retirement succeeded, default unknown to an empty ID list, or guess IDs. Add malformed-metadata preservation and restart/copy-retirement regressions after the baseline. No new source/state was implemented. Source and this report now stay frozen until actual test output or an admission change; latest unit session remains 49022.

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


### Observed runtime baseline and focused corrections

`t984-runtime-unit-association` admitted naturally after the earlier ticket cleared. Exact command above completed **33 files: 31 passed / 2 failed; 216 tests: 214 passed / 2 failed**, exit 1, **161.73 s** (148.33 s collection, 728 ms test bodies). All selected owners ran. Actual forward-walk/feed replacement, invalid-source readiness, aggregate reconciliation, two-copy named-dataset restore, crossed tuple/unknown association, strict provenance, current-input guards, zero-row and publication unit owners passed. This was an observed runtime baseline, not a claimed full acceptance.

Two failures were traced. The semantic input resolver sent an authored own declaration stamp into the neutral runtime resolver first, producing a schema-required diagnostic before the existing framework-owned refusal. It now refuses the authored stamp explicitly before resolution; internal restored canonical templates retain the neutral runtime path. The static plan fixture used an invalid router shape, so structural parsing returned before its bound parameter contract ever ran; the fixture now uses the typed real router/fallback shape and actual read fields. The same static example owner also assigned __proto__ onto a plain object and lost that example; safe own-property definition now preserves it, covered alongside constructor/prototype and lexical parity.

Only four files changed for this correction: `result-processing/inputs.ts`, its owning test, `bootstrap/plan/record-output-contract.ts`, and its owning processing-input test. Diff-check exited 0. The exact affected-owner rerun below **passed 3 files / 34 tests**, exit 0, **51.52 s**. No broader unit rerun is claimed yet.

```powershell
# Core packages/fluxiq
node C:/Users/osrs_/FluxStuff/fxwork/.heavy-slots/heavy-slot.mjs run t984-runtime-unit-fixes -- node ../../node_modules/vitest/vitest.mjs run --maxWorkers=1 --minWorkers=1 --fileParallelism=false src/framework/automation-service/service/answer-first/result-feed/tests/automatic.test.ts src/framework/automation-service/service/answer-first/result-processing/tests/inputs.test.ts src/runtime/flow-authoring/bootstrap/plan/tests/processing-input.test.ts
```

The exact contracts boundary command below then **passed 5 files / 50 tests**, exit 0, **3.41 s**: identifier 17, goal 12, interface 4, existing type-schema 12, unchanged secret-input policy 5. This proves the lexical helper did not impose its grammar on arbitrary schema keys or broaden secrets.

```powershell
# Core packages/contracts
node C:/Users/osrs_/FluxStuff/fxwork/.heavy-slots/heavy-slot.mjs run t984-input-identifier-contracts -- node ../../node_modules/vitest/vitest.mjs run --maxWorkers=1 --minWorkers=1 --fileParallelism=false src/fluxnode/flow/tests/input-identifier.test.ts src/fluxnode/spec/tests/goal.test.ts src/fluxnode/flow/tests/interface.test.ts src/fluxnode/type-schema/tests/parse.test.ts src/fluxnode/spec/tests/secret-inputs.test.ts
```

Still required: private publication tracking/restart recovery described above, persistence/service/FluxNode acceptance, impacted existing compatibility owners, package typechecks/builds and structure/catalog checks. No paid/provider/browser/full-suite run or worker git mutation occurred.


### Persistence baseline and required publication recovery in progress

Contracts typecheck passed through the exact command below, exit 0; contracts:check stamp **10,117 ms**:

```powershell
node C:/Users/osrs_/FluxStuff/fxwork/.heavy-slots/heavy-slot.mjs run t984-input-identifier-types -- pnpm --filter @fluxiq/contracts check
```

The prepared seven-file persistence command above then completed **7 files / 53 tests: 50 passed, 3 failed**, exit 1, **99.57 s**. Existing SQL store 34/34, real FluxNode 4/4 (both latest_date and LatestDate each first + three zero-call restarts), interpretation 2/2 and reference-time 2/2 passed. The pending-binding real service carry-on case passed without rereading the site and preserved actual segment timestamps. The fixture-size owner measured **120 records, 3 pages; raw rows 14,105 bytes; evidence 15,152 bytes; record 17,186 bytes; one latest checkpoint copy after three saves**.

Failures were fixture-boundary errors, not accepted passes: the SQL replay fixture bypassed the upstream validator and inserted an explicitly excluded secret key (the store correctly refused it); the corrupt-file fixture addressed attempts at the envelope root instead of ProgramJsonStore data.attempts; and the service assertion expected hidden due in a display-only public preview. The SQL fixture now uses actual validateAutomationStudioRecords and checks exclusion/input immutability. The corruption fixture keeps the envelope valid and corrupts its actual clock field. The service keeps the intentional public title-only preview and now checks retained:'answer' full due cells/schema plus separate title displayColumns on EVERY initial/replay result. Public preview ownership is runtime/answer-first/result/preview.ts and contracts/task-attempts/task-result.ts; it is not the full retained evidence API.

The exact affected persistence rerun below completed **3 files / 11 tests: 10 passed, 1 failed**, exit 1, **67.94 s**. SQL 5/5 and private provenance 3/3 passed. The service progressed through its first ready retained-full-row assertion and replay, then a test diagnostic called includes on JSON.stringify(undefined) for a request that legitimately has no evidence-loop slot. That optional diagnostic guard was corrected; the final first+three service loop is not yet claimed passed.

```powershell
# Core packages/fluxiq
node C:/Users/osrs_/FluxStuff/fxwork/.heavy-slots/heavy-slot.mjs run t984-runtime-persistence-fixes -- node ../../node_modules/vitest/vitest.mjs run --maxWorkers=1 --minWorkers=1 --fileParallelism=false src/framework/persistence/automation/project/tests/run-dataset-automatic.test.ts src/framework/automation-service/service/answer-first/attempt-store/tests/processing-provenance.test.ts src/framework/automation-service/service/answer-first/result-feed/tests/automatic-service.test.ts
```

After the required observed baseline, publication recovery was implemented only in existing owned paths plus focused tests. Sink publicationState returns its exact tracked IDs with version 1 and complete; successful removals leave the map only after retirement succeeds. Private attempt publications stores that snapshot at keep and ending, including budget/Stop with failed retirement, and forwards through carried-opening. Malformed optional publication metadata decodes to explicit {version:1,knownDatasetIds:[],complete:false}, preserving the task/result, processing declaration/reference and full source bundle; an empty known subset with complete:false never claims no outstanding publications. No new public schema, migration, graph provenance or namespace scan was added.

CopyRows has an optional success observer, called only AFTER recordBatch succeeds, reporting actual fromRunId/fromDatasetId -> datasetId. Carry registers only exact stored publication IDs (or the existing truthful shown-result identity) that those actual receipts copied. User-named raw datasets, including names starting step., are never inferred to be publications. An incomplete tracking snapshot stays explicit in the sink and existing feed readiness, withholds answer publication/completion, preserves originals, and cannot be erased by an arbitrary new read or processing amendment. No terminal outcome or retry cap was introduced.

Authored, not yet observed: partial retirement/snapshot retry; success-only copy receipts with partial write failure; optional malformed metadata preserving all actual fields; unknown tracking surviving read/amendment; real stopped ending -> closed/reopened Core -> actual copy receipt -> successful retirement/repair with no site reread; and real reopened unknown tracking refusing completion while retaining source/clock. Existing same-process retirement and public preview contracts remain.

Current source/tests are frozen for **seven explicit publication/affected owners**, ticket t984-publication-recovery, exec session 15120. Initial gate output said telemetry stale/future; no validator had started at submission. Exact command:

```powershell
# Core packages/fluxiq
node C:/Users/osrs_/FluxStuff/fxwork/.heavy-slots/heavy-slot.mjs run t984-publication-recovery -- node ../../node_modules/vitest/vitest.mjs run --maxWorkers=1 --minWorkers=1 --fileParallelism=false src/framework/automation-service/service/answer-first/rows/tests/superseded-publication.test.ts src/framework/automation-service/service/answer-first/rows/tests/copied-rows.test.ts src/framework/automation-service/service/answer-first/attempt-store/tests/publications.test.ts src/framework/automation-service/service/answer-first/attempt-store/tests/store.test.ts src/framework/automation-service/service/answer-first/attempt/tests/keep.test.ts src/framework/automation-service/service/answer-first/result-feed/tests/publication-restart.test.ts src/framework/automation-service/service/answer-first/result-feed/tests/automatic-service.test.ts
```

All publication-recovery source/test edits and the three persistence fixture corrections await lead verification/commit. No worker git mutation, paid/provider/browser/full-suite run occurred. Remaining acceptance still includes impacted existing compatibility owners, fluxiq typecheck/build, and structure/catalog checks.

### Observed publication, saved-writer and mechanical gate follow-up

The seven-file publication command above completed **38 tests: 35 passed, 3 failed; 4/7 files passed**, exit 1, **89.34 s**. Exact receipt mapping 8/8, zero/nonempty copy 8/8, strict optional-publication metadata 11/11, existing private store 5/5 and the actual unavailable-tracking restart case passed. The three failures reached real runtime behavior: the restart fixture attempted an invalid field amendment, so production correctly refused it and retained readiness; the historical keep fixture omitted the new data declaration; and saved service replay used one judge call instead of the required zero. No failure was relabeled as a pass.

The restart fixture now uses a valid but mistaken date bound producing an empty/unready selection, followed by an explicit correction removing that unrequested condition. The keep fixture forwards its truthful all-loans process:{} at its one public generate call. The exact affected rerun below completed **6 tests: 5 passed, 1 failed; 2/3 files passed**, exit 1, **74.19 s**. Both real publication restart cases and keep passed; the zero-call service failure remained and was traced to the actual canonical writer.

```powershell
# Core packages/fluxiq
node C:/Users/osrs_/FluxStuff/fxwork/.heavy-slots/heavy-slot.mjs run t984-publication-recovery-fixes -- node ../../node_modules/vitest/vitest.mjs run --maxWorkers=1 --minWorkers=1 --fileParallelism=false src/framework/automation-service/service/answer-first/attempt/tests/keep.test.ts src/framework/automation-service/service/answer-first/result-feed/tests/publication-restart.test.ts src/framework/automation-service/service/answer-first/result-feed/tests/automatic-service.test.ts
```

Root cause: automatic processing/schema was only overlaid in step.input, but the real draft writer prefers ranWith.parameters and then step.settings. It therefore repeatedly wrote the older projected schema/processing. Saved and latest Flow digests differed, preventing proven replay and causing the judge call. The owned automatic result-processing overlay now also writes canonical recordOutput into step.settings; raw ranWith/trail and legacy behavior are preserved. A regression invokes the actual draft writer and checks its final parameter entry. No judge or replay-stands policy was changed.

The exact canonical-writer rerun **passed 3 files / 8 tests**, exit 0, **82.52 s**. It includes actual initial + three saved continuations with strict zero judge/model calls and full safe retained cells/schema, as well as real same-key FluxNode latest_date and LatestDate input changes.

```powershell
# Core packages/fluxiq
node C:/Users/osrs_/FluxStuff/fxwork/.heavy-slots/heavy-slot.mjs run t984-canonical-writer -- node ../../node_modules/vitest/vitest.mjs run --maxWorkers=1 --minWorkers=1 --fileParallelism=false src/framework/automation-service/service/answer-first/result-processing/tests/retained-schema.test.ts src/framework/automation-service/service/answer-first/result-feed/tests/automatic-service.test.ts src/framework/automation-service/service/fluxnode/tests/processing.test.ts
```

Package typecheck then failed after actually compiling the current tree: **11 diagnostics**, underlying TypeScript exit 2 / gate exit 1, **67,687 ms**. Ten were owning fixture types (required iteration, executable graph shape, optional schema/count fields and optional test writer entries); those were corrected. One dependency remains: t984 FlowLessJudgeInput still requires deniedEvidenceKeys while run-attempt intentionally preserves optional unknown. P6 has the approved optional-unknown/unsure-before-provider interface, but it has not been synced here; no ??[] or unsafe cast was introduced.

```powershell
# Core root
node C:/Users/osrs_/FluxStuff/fxwork/.heavy-slots/heavy-slot.mjs run t984-runtime-types -- pnpm --filter fluxiq check
```

The first structure audit failed **31 violations across 5 rules**, exit 1. These were new directory file counts, statement packing, four boundary imports, the clock reader's catch returning undefined, and the evidence decision parser at 807 lines. No baseline was raised. Related owning tests were grouped under attempt/tests/processing, authoring/tests/bindings, plan/tests/record-output, llm/tests/processing and project/tests/run-dataset. The shared identifier now has its own narrow input-identifier barrel, keeping the goal reader independent of the broad Flow/type-schema barrel cycle. Components use the neutral contracts/records export. Authored amendment processing validation moved into its existing result-processing owner, leaving P3 prose untouched. Clock parsing now returns an explicit success/unavailable union and the SQL owner preserves atomic invalidation without throwing or substituting current time. Those mechanical corrections require the next actual audit/test output; they are not yet claimed accepted.

```powershell
# Core root
node C:/Users/osrs_/FluxStuff/fxwork/.heavy-slots/heavy-slot.mjs run t984-runtime-structure -- node scripts/structure-audit.mjs
node C:/Users/osrs_/FluxStuff/fxwork/.heavy-slots/heavy-slot.mjs run t984-runtime-structure-fixes -- node scripts/structure-audit.mjs
```

The corrected audit is pending in exec session 21451, initially waiting for physical headroom. Source/tests are frozen during that check. No other worker heavy job is queued/running. Remaining acceptance: corrected mechanical owners, the explicit historical compatibility inventory, P6 interface sync, package check/build and catalog checks. All post-0706d1d97 source/report changes remain uncommitted for the lead; the worker performed no git mutations.

### Resumed execution: recovered audit output and checkpoint freeze

On resume, polling the original worker exec session 21451 recovered its completed output: corrected audit **exit 1, 6 violations across 2 rules**. It admitted naturally after the earlier memory wait. No standalone full-output log had been created by that invocation; this is the durable recovered failure excerpt, not a claim that the warnings/traces were archived in full. Exact command remains t984-runtime-structure-fixes above.

```text
FAIL [as-never] packages/fluxiq/src/framework/persistence/automation/project/tests/run-dataset/store.test.ts: 2 casts, lines 338, 339.
FAIL [test-placement] packages/fluxiq/src/framework/automation-service/service/answer-first/attempt/tests/processing/: 2 test files.
FAIL [test-placement] packages/fluxiq/src/framework/persistence/automation/project/tests/run-dataset/: 2 test files.
FAIL [test-placement] packages/fluxiq/src/runtime/flow-authoring/bootstrap/authoring/tests/bindings/: 3 test files.
FAIL [test-placement] packages/fluxiq/src/runtime/flow-authoring/bootstrap/plan/tests/record-output/: 2 test files.
FAIL [test-placement] packages/fluxiq/src/runtime/llm/tests/processing/: 1 test file.
structure-audit: 6 violation(s) across 2 rule(s).
```

The prior 31-violation snapshot therefore progressed to six, not a pass. The test-placement rule requires each immediate test parent to be named tests; the attempted nested grouping did not satisfy that rule. Moving the existing SQL owner also exposed two historical invalid-input fixtures using as never. These are required layout/typed-fixture corrections, not grounds to increase a baseline. Source is unchanged while the lead checkpoints the exclusive prior P2 dirty inventory and syncs P6's optional-unknown judge interface. Down dirty state comprises this worker report plus the lead-authored resume-processing brief. No worker heavy job remains queued/running.

The lead checkpointed prior P2 dirty scope as bc49b850f and merged P6 as 6faae9260, preserving publication tracking and independent judge metadata in shared persistence/keep/carry owners. P6's optional deniedEvidenceKeys/unsure-before-provider interface is now present; no unknown-to-empty fallback was introduced. After release, the six owning corrections were made: grouped tests now have an immediate tests parent (the same layout as existing project/tests/cleanup/tests); SQL invalid enum tests use checked intentional TypeScript errors instead of as never. The new combined publication regression exercises rejected same-revision and stale older judge metadata saves, exact publication IDs, task/result/clock/source preservation, reopen, publication retirement and carry.

Source/tests are frozen for this exact **22-file** corrected/combined owner command, exec session 94105. Initial output is FIFO waiting behind the earlier ticket; no executable result yet. Full captured stdout/stderr is in ignored Core node_modules/.cache/t984-acceptance/resume-owners.log. No paid/browser/full-suite run is included.

```powershell
# Core packages/fluxiq
node C:/Users/osrs_/FluxStuff/fxwork/.heavy-slots/heavy-slot.mjs run t984-resume-owners -- node ../../node_modules/vitest/vitest.mjs run --maxWorkers=1 --minWorkers=1 --fileParallelism=false src/components/automation/tests/processing-inputs.test.ts src/engine/automation/parameter-refresh/tests/inputs.test.ts src/framework/automation-service/service/answer-first/attempt-store/tests/publications.test.ts src/framework/automation-service/service/answer-first/attempt-store/tests/judge-issue.test.ts src/framework/automation-service/service/answer-first/attempt-store/tests/judge-checkpoint.test.ts src/framework/automation-service/service/answer-first/attempt-store/tests/store.test.ts src/framework/automation-service/service/answer-first/attempt/tests/keep.test.ts src/framework/automation-service/service/answer-first/attempt/tests/processing/tests/context.test.ts src/framework/automation-service/service/answer-first/attempt/tests/processing/tests/input.test.ts src/framework/automation-service/service/answer-first/result-feed/tests/publication-restart.test.ts src/framework/automation-service/service/answer-first/result-feed/tests/automatic-service.test.ts src/framework/automation-service/service/answer-first/result-processing/tests/retained-schema.test.ts src/framework/automation-service/service/fluxnode/tests/processing.test.ts src/framework/persistence/automation/project/tests/run-dataset/tests/automatic.test.ts src/framework/persistence/automation/project/tests/run-dataset/tests/store.test.ts src/framework/persistence/automation/project/run-dataset-answer/tests/reference-time.test.ts src/runtime/flow-authoring/bootstrap/authoring/tests/bindings/tests/processing-input.test.ts src/runtime/flow-authoring/bootstrap/authoring/tests/bindings/tests/script-binding.test.ts src/runtime/flow-authoring/bootstrap/authoring/tests/bindings/tests/draft-bindings.test.ts src/runtime/flow-authoring/bootstrap/plan/tests/record-output/tests/processing-input.test.ts src/runtime/flow-authoring/bootstrap/plan/tests/record-output/tests/contract.test.ts src/runtime/llm/tests/processing/tests/declaration-input.test.ts
```

### Post-reboot source-replacement producer snapshot (not yet executed)

Root checkpointed the prior test-layout/typed-fixture/publication corrections as **6dcd8bfa0**, then released producer edits while repairing the reboot-stale heavy queue. The approved exact optional contract is `resultEvidence.sourceReplacements?: {version:1,receipts:{kind:'page'|'collection',from:SourceRef[],to:SourceRef[]}[]} | null`, with `SourceRef={source,step,version,datasetId?}`. The runtime result-evidence barrel now exports both strict reference and receipt readers from `result-evidence/replacement/`.

Producer changes are frozen in t984, awaiting executable acceptance. The feed retains actual source identities, emits page receipts only for a unique same-step/read/place replacement with a real retained schema and known zero original rejection count, and emits collection receipts only after the existing actual-forward, fresh-occurrence, full-schema, first-page and pagination-end checks. Ready-to-ready replacements are included. Reused indistinguishable tuples, ambiguous associations, unknown counts, missing schemas and unrelated pages confer no new authority. Exact receipt chains reject duplicate/conflicting origins and cycles. No URL, position or storage-chunk identity is guessed.

Malformed optional receipts become `null` without discarding valid pages, processing/account facts, clock or task. Receipts copy through existing private record/carry data; the successful `run-attempt.ts` restoration call now forwards the optional metadata even when source restoration succeeds. The new persistence owner covers save/reopen/carry/full-page restore and corrupt optional receipt preservation. No historical recordings or model replies changed.

P6 requested two read-only origin seams. `feed.sourceRefs(source)` returns exact current contributing-page tuples under strict source equality. The optional constructor observer `sourceRecorded(refs, call?)` runs after actual page recording; live and forward paths pass the actual `called` object (retained through `passed`), while batches/restored omit it. Consumers must retain zero/multiple matches as unknown, and may not attach a later reused call ID to an older unstamped event. P6 owns journal/consumer composition after root sync; P2 made only the approved successful-restore forwarding edit in the shared caller.

The exact prior 22-file command above was resubmitted with label **t984-post-reboot-owners**, single Vitest worker and full output capture in ignored `node_modules/.cache/t984-acceptance/post-reboot-owners.log`. It reached FIFO waiting only. At root's instruction it was withdrawn normally with Ctrl+C before admission; **no executable test result exists**. Gate status then showed no holder and no t984 queue entry. Root is correcting the scheduler's newly available commit-capacity accounting while keeping FIFO, physical floor and two slots. No worker changed the scheduler, thresholds or queue files.

`git diff --check` from Core -> **exit 0**, ordinary LF/CRLF notices only. Frozen modified owners are `attempt-store/tests/processing-provenance.test.ts`, `attempt/run-attempt.ts`, `result-feed/{feed,read-evidence,source-state}.ts`, `result-feed/tests/read-evidence.test.ts`, and `runtime/result-verification/result-evidence/{index,types}.ts`. New owners are `result-feed/replacements.ts`, `result-feed/tests/replacements.test.ts`, and `result-evidence/replacement/{source,types,ref,read,index}.ts` plus `replacement/tests/read.test.ts`. Root was given the complete checkpoint scope. Required next checks remain the 22 combined owners, new receipt/persistence owners, corrected audit, 35 existing compatibility owners and affected package checks/builds. No paid/browser/full-suite run or worker git mutation occurred.

Root applied the accessor's current-page-only correction as **61a978799** and synced the first producer snapshot into P6. Read-only review then found that a held replacement could target a previously observed tuple and that duplicate new tuples were checked only after minting. Root released just `result-feed/replacements.ts` and its owner test to correct both guards. They now reject previously observed target tuples and duplicate current targets before minting. Two regressions also pin that a tuple whose contents were indistinguishably reused cannot mint a later replacement within the producer's tracked history. Source is frozen again. P6 was told to retain ambiguity across its durable distinct journal occurrences too; a later occurrence may not inherit an earlier receipt just because its tuple is reused. The shared caller now belongs to P6 for its composition; P2 will not edit it further.

### Receipt acceptance passed; shared replay schema typing correction

Root checkpointed the producer guards as **c55aa99bc** and released normal gated validation after the scheduler correction passed its own full 100/100 tests. The following exact five-owner receipt command **passed 68/68 tests in 5 files, exit 0, 90.60 s**. It proves ready-to-ready and held-source page receipts, actual complete collection coverage, reused target refusal, strict tuple/receipt parsing, malformed optional metadata preservation and real private save/reopen/carry/successful-page restoration. Full stdout/stderr: ignored Core `node_modules/.cache/t984-acceptance/source-replacements.log`.

```powershell
# Core packages/fluxiq
node C:/Users/osrs_/FluxStuff/fxwork/.heavy-slots/heavy-slot.mjs run t984-source-replacements -- node ../../node_modules/vitest/vitest.mjs run --maxWorkers=1 --minWorkers=1 --fileParallelism=false src/runtime/result-verification/result-evidence/replacement/tests/read.test.ts src/framework/automation-service/service/answer-first/result-feed/tests/replacements.test.ts src/framework/automation-service/service/answer-first/result-feed/tests/read-evidence.test.ts src/framework/automation-service/service/answer-first/attempt-store/tests/processing-provenance.test.ts src/framework/automation-service/service/answer-first/result-feed/tests/collection-replacement.test.ts
```

Root then reported t986's real library build failing TS2379 in replay draft/span calls. Cause: `ParsedToolExecution.recordSchema` used an optional indexed-access type, which includes explicit `undefined`, while the actual parser conditionally omits that property and the shared replay observer correctly accepts only absent/schema/null. With root approval, P2 changed only the internal alias in `runtime/llm/evidence-loop-decision.ts` to `recordSchema?: Exclude<AutomationStudioLlmEvidenceToolExecutionResult['recordSchema'], undefined>`. No runtime behavior, observer contract, null meaning, cast or suppression changed. `git diff --check` -> **exit 0**. Root received the exact one-file checkpoint scope immediately so the dependent offline build can sync it.

The existing real draft/span owner ran through **t984-replay-schema-owner**, log `replay-schema-owner.log`. It contains four tests in both t984 and t987; the P6 eight-case post-reboot pass was the separate projector owner, not this walker owner. P2 initially conflated those two owners in its message to root and corrected that attribution. Package check and the remaining combined/mechanical/compatibility/build acceptance follow serially through the gate.

That existing t984 observation owner completed **4/4 failed, exit 1, 54.62 s**. In both normal draft and repeated span cases the actual walker produced no observation for the target step, so annotated metadata assertions received `undefined` and legacy assertions could not read `resultCode`. This reached the real replay but failed before the target's metadata projection assertion. Root required a cause trace rather than assuming fixture staleness. Exact command:

```powershell
# Core packages/fluxiq
node C:/Users/osrs_/FluxStuff/fxwork/.heavy-slots/heavy-slot.mjs run t984-replay-schema-owner -- node ../../node_modules/vitest/vitest.mjs run --maxWorkers=1 --minWorkers=1 --fileParallelism=false src/runtime/llm/node-tools/replay/tests/observation.test.ts
```

Trace demonstrated the exact early return: `replay/draft.ts` requires a readable reset with `effectApplied === true` before any target step runs. Both fixtures omitted that reset fact, so the real walker correctly returned no observations. `git diff --no-index` between t984/t987 observation owners -> **exit 0**, source identical. A second setup error was visible in the real repeat contract: the list fixture declared a lasting mutation, so it was only verified and could not produce the real rows a repeated pass consumes. With root approval and P6 coordination, P2 corrected only that owner fixture: actual reset success is explicit, the read list is `observe` with no lasting consequences, and assertions prove one target invocation normally and one per actual list row in the repeat. Existing applied/failure/null/absence/privacy assertions are unchanged. The corrected four-case owner is frozen/queued as **t984-replay-schema-owner-fixed**, log `replay-schema-owner-fixed.log`; no result claimed yet. Root synced P6's compilation-boundary correction as **05e939e8b** before subsequent package check.

The corrected reset/list-declaration snapshot completed **1 passed / 3 failed of 4, exit 1, 76.16 s**. The normal annotated path now reached the target and proved its metadata/privacy assertions. The repeat still fell back to one call, and the legacy wrapper still produced no observation. Follow-up trace proved the remaining fixture-contract error: every structured live execution wrapper requires a boolean `effectApplied` in both its public type and `readToolExecution`; list and legacy wrapper replies omitted it and were therefore unreadable. This is not an older supported successful wrapper contract and did not justify widening the runtime parser.

Root approved truthful `effectApplied:false` for the valid live list/legacy replies, preserving false and absent optional failure/schema assertions. A new direct observation-constructor case separately preserves the genuine supported historical omission assertion (no invented effect/failure/schema fields). This is a corrected fixture-contract assumption, not a product runtime fix. Reset and actual target-count assertions remain, so the repeated case must run both actual list rows.

P6 requested and root approved `feed.sourceProof(): Pick<Bundle,'pages'|'sourceReplacements'>`. It returns only actual current producer pages and existing receipt metadata from `replacements.evidence(baseEvidence(false))`, without historical fallback, `rows()` or automatic processing. Its regression observes zero source-cell reads while ready and proves current fresh pages remain distinct from held historical fallback. Only `result-feed/feed.ts` and its replacement owner test changed for this seam; root received exact frozen file ownership for checkpoint/sync.

The following two-owner check is now queued as **t984-source-proof-replay**, full log `source-proof-replay.log`; no result yet. Source remains frozen.

```powershell
# Core packages/fluxiq
node C:/Users/osrs_/FluxStuff/fxwork/.heavy-slots/heavy-slot.mjs run t984-source-proof-replay -- node ../../node_modules/vitest/vitest.mjs run --maxWorkers=1 --minWorkers=1 --fileParallelism=false src/runtime/llm/node-tools/replay/tests/observation.test.ts src/framework/automation-service/service/answer-first/result-feed/tests/replacements.test.ts
```

The two-owner source-proof/replay check **passed 16/16 tests in 2 files, exit 0, 72.78 s**: replacements/sourceProof 11 and replay observations 5. The actual walker proves successful reset, one normal target call and both actual repeated rows. Supplied true/false facts, failure/null schema, omitted optional fields and privacy assertions all pass. The supported direct historical constructor omits absent facts. Emitted `sourceProof` contains only current producer pages and exact existing receipts, reads zero source cells and does not substitute the held original page. Root received the exact three-file checkpoint-ready scope (feed + replacement owner, replay observation owner).

Next frozen command, queued through **t984-post-reboot-types**, full output `post-reboot-types.log`:

```powershell
# Core root
node C:/Users/osrs_/FluxStuff/fxwork/.heavy-slots/heavy-slot.mjs run t984-post-reboot-types -- pnpm --filter fluxiq check
```

Package check completed **exit 2** after **99,803 ms** of actual compilation, with **11 diagnostics**. The shared replay TS2379 errors are gone after the alias correction; no new replacement producer/parser/sourceProof implementation error was reported. Two diagnostics belong to P2 fixtures: the unknown-count case omitted the modern sink's required `invalidCount`, and the replay step helper omitted required `iteration`. Nine remaining diagnostics belong to P6 fixtures (`judge-checkpoint`, `judge-issue`, `semantic-window`) and were reported to that owner/root for its typed fixes. Full output remains in `post-reboot-types.log`; this failed check is not stamped/passed.

The two P2 fixture corrections are now frozen for root checkpoint/sync. The genuine unknown historical count now enters through the supported `feed.restored` page API, where `read.invalidCount` is optional; the known rejected-count case remains on the strict modern sink API with its required numeric count. Both retain the no-authority and missing-readiness assertions. The replay helper supplies truthful `iteration: position`. No cast, directive, suppression or weakening of a production required field was introduced. `git diff --check` -> **exit 0**, ordinary LF/CRLF notice only. Root received the exact two-file checkpoint scope before any further validator was launched.

### Combined publication/processing acceptance: two P6 fixture failures remain

The original explicit 22-owner command was resubmitted as **t984-post-reboot-combined**, with the two changed fixture owners appended:

```text
src/runtime/llm/node-tools/replay/tests/observation.test.ts
src/framework/automation-service/service/answer-first/result-feed/tests/replacements.test.ts
```

All other arguments/workdir stayed exactly as the 22-file command recorded above: one Vitest worker, file parallelism false, unchanged shared gate. Full stdout/stderr: ignored Core `node_modules/.cache/t984-acceptance/post-reboot-combined.log`.

Observed **189 passed / 2 failed of 191 tests; 22/24 files passed; exit 1; 203.08 s**. The real SQL store, automatic persistence/reference clock, combined publication preservation, restart retirement, canonical writer, automatic service, both corrected producer/replay owners and real FluxNode processing all passed. FluxNode specifically proved the first exploration plus three zero-call replays for action-only classification and both dynamic input spellings (`latest_date`, `LatestDate`), preserving full expected original rows. This does not replace real-browser/provider-backed campaign acceptance.

The only failures occurred before store behavior under test: `judge-checkpoint.test.ts:79` mutates `held.attempts[0].judgeEvidence` and `judge-issue.test.ts:111` mutates `raw.attempts[0].judgeEvidenceIssue`, but the actual ProgramJsonStore envelope is `{version:1,data:{attempts:...}}`. Both therefore throw while reading `[0]` of undefined. P6 independently confirmed the owning storage envelope and is correcting only those fixture accesses to `.data.attempts[0]`, preserving assertions and production storage behavior. Root/P6 received exact failures and the idle pause point. No validator is running or queued; new submissions are held for root to sync P6 fixture typing **16486b770** and envelope corrections together, then run corrected types/failing owners and 35 compatibility owners. This failed combined batch is not reported as a pass.

### Corrected package check passed; independent compatibility owners running next

Root synced P6 fixture typing as **4e5299d48**, then the two guarded actual-envelope corruption fixtures and optional typed test-helper `taskProcessing` forwarding as **780fb7019**. The helper supplies no default; callers must explicitly declare actual data criteria or action-only N/A, and intentionally missing declarations remain missing. The briefly queued `t984-post-reboot-types-corrected` ticket was withdrawn normally before admission at root's request so the small handoff could sync. No compilation ran in that withdrawn job.

The following corrected typecheck then **passed, exit 0, 30,666 ms of actual compilation**; its passing stamp was stored. All prior 11 fixture diagnostics and the shared replay TS2379 are resolved. Full log: ignored Core `node_modules/.cache/t984-acceptance/post-reboot-types-synced.log`.

```powershell
# Core root
node C:/Users/osrs_/FluxStuff/fxwork/.heavy-slots/heavy-slot.mjs run t984-post-reboot-types-synced -- pnpm --filter fluxiq check
```

P6's separate composition batch demonstrated existing `carry-on.test.ts` fixture migration failures; those are outside the 191-case batch above. Root assigned `carry-on.test.ts`, `attempt/tests/carried-before.test.ts` and the minimal optional helper forwarding to P6. P2 will not edit those owners concurrently. Its own next check is an explicit **33-file independent subset** of the 35 existing compatibility inventory above, excluding just `tests/carry-on.test.ts` and `attempt/tests/carried-before.test.ts`, plus the two corrected P6 corruption owners (35 files total). This is not a claim that all original 35 compatibility owners have run. Exact queue label **t984-compatibility-independent**; one Vitest worker and file parallelism false; full log `compatibility-independent.log`; no executable result yet.

```powershell
# Core packages/fluxiq
$t984CompatibilityOwners = @(
'src/framework/automation-service/service/answer-first/attempt/tests/caller-replay.test.ts'
'src/framework/automation-service/service/answer-first/attempt/tests/assemblable-flow-wins.test.ts'
'src/framework/automation-service/service/answer-first/attempt/tests/caller-seams.test.ts'
'src/framework/automation-service/service/answer-first/flow-run/tests/replay-over-done-act.test.ts'
'src/framework/automation-service/service/answer-first/flow-run/tests/repaired-read-conditions.test.ts'
'src/framework/automation-service/service/answer-first/attempt/tests/task-humanness.test.ts'
'src/framework/automation-service/service/answer-first/attempt/tests/run-overrides-press.test.ts'
'src/framework/automation-service/service/answer-first/flow-run/tests/row-url-repeat.test.ts'
'src/framework/automation-service/service/answer-first/attempt/tests/flow-stage-person-stop.test.ts'
'src/framework/automation-service/service/answer-first/tests/acts-with-no-row.test.ts'
'src/framework/automation-service/service/answer-first/tests/interrupted.test.ts'
'src/framework/automation-service/service/answer-first/tests/later-attempt.test.ts'
'src/framework/automation-service/service/answer-first/tests/same-words.test.ts'
'src/framework/automation-service/service/answer-first/tests/saved-read-restart.test.ts'
'src/framework/automation-service/service/answer-first/tests/skipped-rows.test.ts'
'src/framework/automation-service/service/answer-first/tests/endings/tests/saved-on-every-ending.test.ts'
'src/framework/automation-service/service/fluxnode/tests/fluxnode-registry.test.ts'
'src/framework/automation-service/service/fluxnode/tests/act-scope.test.ts'
'src/framework/automation-service/service/fluxnode/tests/fluxnode-runs.test.ts'
'src/framework/automation-service/service/fluxnode/tests/corrupt-scoped-memory.test.ts'
'src/framework/automation-service/service/fluxnode/tests/idempotency.test.ts'
'src/framework/automation-service/service/fluxnode/tests/managed-hosts.test.ts'
'src/framework/automation-service/service/fluxnode/tests/model-routing.test.ts'
'src/framework/automation-service/service/fluxnode/tests/pin-act-scope.test.ts'
'src/framework/automation-service/service/fluxnode/tests/pinning.test.ts'
'src/framework/automation-service/service/fluxnode/tests/owner-flows-reregister.test.ts'
'src/framework/automation-service/service/fluxnode/tests/repair-routing.test.ts'
'src/framework/automation-service/service/fluxnode/tests/secret-inputs.test.ts'
'src/framework/automation-service/service/fluxnode/tests/secret-invariant.test.ts'
'src/framework/automation-service/service/fluxnode/pipeline/tests/pipeline-runs.test.ts'
'src/framework/automation-service/service/fluxnode/pipeline/tests/pipeline-secrets.test.ts'
'src/framework/automation-service/service/fluxnode/pipeline/tests/source-continuation.test.ts'
'src/framework/automation-service/service/fluxnode/pipeline/tests/source-secrets.test.ts'
'src/framework/automation-service/service/answer-first/attempt-store/tests/judge-checkpoint.test.ts'
'src/framework/automation-service/service/answer-first/attempt-store/tests/judge-issue.test.ts'
)
node C:/Users/osrs_/FluxStuff/fxwork/.heavy-slots/heavy-slot.mjs run t984-compatibility-independent -- node ../../node_modules/vitest/vitest.mjs run --maxWorkers=1 --minWorkers=1 --fileParallelism=false @t984CompatibilityOwners
```

### Compatibility baseline completed; actual regression and disjoint correction lanes

The explicit independent batch completed **77 passed / 108 failed of 185 tests, 31/35 files failed, one unhandled rejection, exit 1, 751.73 s**. The corrected corruption owners both passed 6/6; scoped-memory rejection and owner-flow registration also passed. This is a completed failure baseline, not compatibility acceptance.

The long quiet section was traced rather than blamed on the machine. Read-only inspection of the single owned Vitest worker showed it advancing through `interrupted.test.ts`; it then reported an ordinary **180,000 ms** timeout in the saved-Flow-mid-press fixture. The initial task had not reached its required ready result, so `Run again` was correctly refused as a stopped partial task; the fixture waited for a press that could never start and left the rejection unhandled. No timeout, retry, budget or production loop cap was changed, and the run was allowed to reach its natural endpoint. The ignored diagnostic inspector helper was not committed; the inspected worker exited normally.

Read-only source tracing also found a real P2 regression: `attempt/opening.ts` persisted new processing metadata with an unconditional `await memory.update`, despite the existing unscoped best-effort cache policy. The failed-memory fixture makes both `get` and `update` fail; the new write threw before the actual attempt could run and surfaced as `setup_needed`. Root took exact ownership of `opening.ts` plus its adjacent act-scope regression, retained strict scoped persistence, and reported **9/9 passing** with the in-memory declaration retained. Root checkpoint **81182b7a0** owns this runtime fix. P2 retains the existing full service failed-memory result/warning case and now supplies its truthful list declaration and asserts the kept declaration.

Root synced the verified P6 carry-on/carried-before fixture correction as **83e021c56**. P6 then received the written [FluxNode compatibility brief](../briefs/compatibility-fluxnode.md) for the paired **t984** tree; t987 stays frozen for root's independent P6 acceptance. No package-wide validation may run while either fixture lane edits. Generic helpers retain explicit opt-in metadata, never an inferred or blanket declaration.

Exact failed-owner partition (all paths relative to `packages/fluxiq/src/framework/automation-service/service/`):

| P2 Answer First owner | Failed/total |
| --- | --- |
| answer-first/tests/later-attempt.test.ts | 20/24 |
| answer-first/tests/interrupted.test.ts | 2/11 |
| answer-first/tests/same-words.test.ts | 6/10 |
| answer-first/attempt/tests/caller-seams.test.ts | 10/12 |
| answer-first/attempt/tests/caller-replay.test.ts | 7/8 |
| answer-first/flow-run/tests/row-url-repeat.test.ts | 1/1 |
| answer-first/tests/endings/tests/saved-on-every-ending.test.ts | 3/8 |
| answer-first/tests/skipped-rows.test.ts | 6/6 |
| answer-first/flow-run/tests/replay-over-done-act.test.ts | 1/1 |
| answer-first/attempt/tests/task-humanness.test.ts | 4/6 |
| answer-first/tests/saved-read-restart.test.ts | 3/3 |
| answer-first/attempt/tests/run-overrides-press.test.ts | 2/4 |
| answer-first/flow-run/tests/repaired-read-conditions.test.ts | 1/1 |
| answer-first/attempt/tests/assemblable-flow-wins.test.ts | 2/2 |
| answer-first/attempt/tests/flow-stage-person-stop.test.ts | 1/2 |
| answer-first/tests/acts-with-no-row.test.ts | 1/2 |

AF subtotal: **70 failed / 31 passed of 101**. Judge owns these disjoint FluxNode failures plus `fluxnode/tests/library-lane.ts` support:

| Judge FluxNode owner | Failed/total |
| --- | --- |
| fluxnode/tests/managed-hosts.test.ts | 4/15 |
| fluxnode/tests/act-scope.test.ts | 6/6 |
| fluxnode/tests/pinning.test.ts | 2/2 |
| fluxnode/pipeline/tests/pipeline-runs.test.ts | 1/5 |
| fluxnode/tests/fluxnode-runs.test.ts | 4/5 |
| fluxnode/tests/idempotency.test.ts | 4/7 |
| fluxnode/pipeline/tests/pipeline-secrets.test.ts | 1/5 |
| fluxnode/tests/secret-inputs.test.ts | 2/2 |
| fluxnode/tests/fluxnode-registry.test.ts | 2/5 |
| fluxnode/tests/pin-act-scope.test.ts | 3/4 |
| fluxnode/tests/secret-invariant.test.ts | 2/2 |
| fluxnode/tests/model-routing.test.ts | 3/4 |
| fluxnode/pipeline/tests/source-secrets.test.ts | 1/2 |
| fluxnode/tests/repair-routing.test.ts | 2/2 |
| fluxnode/pipeline/tests/source-continuation.test.ts | 1/1 |

FluxNode inventory subtotal (including its two passed owners): **38 failed / 34 passed of 72**. The corrected corruption owners contribute the remaining **12/12 passed**.

P2 unpacked the exact three producer statement-format findings (`result-feed/feed.ts`, `replacements.ts`, `tests/replacements.test.ts`) with no behavior/type change and gave root a separate checkpoint handoff. Root owns the actual opening fix. P2's other changed support is the approved optional typed own-presence `taskProcessing` passthrough in `answer-first/tests/fake-library.ts`; it supplies no default and preserves genuine omission paths.

The first AF fixture correction snapshot is now frozen. Explicit list-all or mixed acts+list entries declare no extra criteria; action-only renewal entries declare N/A; the row-address fixture declares the requested title/due projection while retaining its hidden URL evidence. The unrelated override-frame fixture now says “by due date, latest first” instead of ambiguous “newest first” and declares the actual descending date sort. Existing result, privacy, replay, saved-state, cost and permission assertions remain; the interrupted replay now also asserts its initial task achieved before waiting for its saved press. No historical recorded reply changed, and no shared helper gained a default. The requested next narrow batch is these16 owners plus the real automatic-service omission-repair/full-originals owner, pending root's shared-tree validation coordination.

Root approved that shared-tree narrow read and checkpointed the16 fixture files plus optional helper as **153d0df0b**. The batch **t984-af-compatibility-intent** is admitted with one Vitest worker, file parallelism false, full log `node_modules/.cache/t984-acceptance/af-compatibility-intent.log`. It uses the16 P2 AF paths in the exact table above plus `src/framework/automation-service/service/answer-first/result-feed/tests/automatic-service.test.ts`; command from Core packages/fluxiq:

```powershell
node C:/Users/osrs_/FluxStuff/fxwork/.heavy-slots/heavy-slot.mjs run t984-af-compatibility-intent -- node ../../node_modules/vitest/vitest.mjs run --maxWorkers=1 --minWorkers=1 --fileParallelism=false @t984AnswerFirstOwners
```

`$t984AnswerFirstOwners` is the explicit16-path AF table above, each prefixed `src/framework/automation-service/service/`, plus the automatic-service path just named. No glob/discovery broadened the run. Root's opening source is frozen; judge may edit only the disjoint FluxNode fixtures/library-lane, which this AF batch does not import. No t984 package-wide validator may run until both lanes freeze. No executable result is claimed yet.

## 2026-11-23 resume

Worker: Claude Code worker-heavy, brief `briefs/finish-data-stage.md`. Trees: Core t984 head e9ee95577 (merge of dev), downstream t984 head e18bd7e8d. All heavy commands ran one at a time through `heavy-slot.mjs`, one Vitest worker, file parallelism off, named files only. No provider, paid, browser or full-suite run; no git mutation. Logs are in ignored Core `node_modules/.cache/t984-acceptance/`.

### Outcome

P2 compatibility accepted on its owner checks: the full independent compatibility set (the 35 files above plus the two endings files the lead added) passes 195/195, the 24-file combined owner command passes 192/192, contracts and fluxiq typechecks pass. The Core structure audit still fails 16 violations, every one in a P6 (judge, t987) file the lead said t987 already fixed in cb1aa1d0d; none is in a P2 file. The source-receipt contract was not touched.

### The nine Answer First failures: causes and fixes

Diagnosed with a temporary diagnostic test file (deleted) that printed what each refused completion was told.

1. caller-seams (person-ask), replay-over-done-act, acts-with-no-row: **invalid fixture**. The previous session wrote `taskProcessing: { process: null }`, which the transport kept as a *data* declaration with null criteria that no schema can bind, so every completion was refused and the script ran out (`stopped_by_person`). The chat's interpreter (`runtime/conversations/instructions/processing.ts`) and `core.set_result_processing` both read `process: null` as action-only. Fixtures now pass the canonical `taskProcessing: null` (also the passing `later-attempt` "another task" case). **Product fix too:** `readAutomationStudioFlowTaskProcessing` now reads `{ process: null }` as `null`, so no caller can create a declaration that can never become ready (new owner `runtime/flow-authoring/draft/result-processing/tests/task.test.ts`).
2. later-attempt "a memory that fails": **P4 product regression, not P2.** With the store failing, `task-model/resolve.ts` threw on `memory.get`, the resolver failed and the attempt answered `setup_needed` ("No model is available"). Same code on dev, so dev fails this test too. Fix: unscoped task memory is best effort in model resolution, as the opening already reads it: an unreadable or unwritable store resolves the request's routed model and writes nothing; scoped execution stays strict. The store's deliberate refusals of an invalid stored model or processing declaration now throw a typed `AutomationStudioAnswerFirstTaskMemoryIntegrityError` (`task-memory/integrity-error.ts`), which still stops the task, so the existing "refuses an invalid persisted model" test holds. New resolve owner case covers both.
3. later-attempt "a forward run short of the last step" and skipped-rows "a model that keeps away": **invalid fixtures under the data contract.** Both tasks ask to list loans; the completing round read nothing into the result (`readLoans("again", {})` not added; presses only), so the data stage correctly refused an answer with no rows. The rounds now add their read to the result (`readLoans("again")`, `readLoans("list")`). The path stays `run_flow_then_explore` (the saved card step was never reached, `attempt/path.ts`), and the skipped-row and act-count assertions are unchanged.
4. saved-on-every-ending (budget at the judge, provider failing at the end): **P2 product regression.** `withResultProcessing` wrote an automatic declaration into a `recordOutput` parameter even on a read step that had none, so a node with no record-output parameter (the plain fake library's) made the saved steps unassemblable (`notes_only`, `not_assembled`). Every data task reading through such a node lost its saved Flow. Fix in `result-processing/processing.ts`: an automatic declaration is written only into a record output the step already has; the task keeps the declaration in its memory and the feed applies it. Legacy model-set processing is unchanged. Regression added to `result-processing/tests/retained-schema.test.ts`.
5. interrupted "a saved Flow's run cut off mid-press": **P2 product gap.** A saved Flow's run told the result its read pages only once the run ended, and its row was written only when its first step went out, so a Core that died mid-press lost the read's page provenance; carrying on (which must not reread) then had no source evidence and the data stage refused. Fix: `flow-run/live-pages.ts` tells each record batch to the result as it is captured, through the graph the run selected (`runAutomationStudioDetachedCandidate` gained an optional `selected` callback, told a copy of the same graph it returns, before its first node runs); `stepped` is now awaited before a call goes out, and `attempt/flow-stage.ts` writes the row before any later step once a page arrived since the last write. Page mapping is identical to the end-of-run mapping; a run that never selects a graph pages nothing, as before. New detached-execution owner case.

### The FluxNode fixtures from 4c4868428

First run of the 17 files: 28/72 failed. Causes and fixes:

- `library-lane.ts` declared data criteria *before* any read; `core.set_result_processing` correctly refuses an amendment with no captured schema. Data criteria are now declared after the script's reads, just before its first completion; action-only N/A still goes first. `managed-hosts` moved its own `declareTitle` after the read for the same reason.
- secret-inputs, secret-invariant, pipeline-secrets bound `$input: title` where `title` is a **secret** input; processing criteria cannot bind a secret ("Required processing input title is missing"). These declare only the columns; the read node is still bound to the secret.
- pin-act-scope and source-continuation declared `contains` with an empty title, an invalid condition (`record_output.process_invalid_condition`); the all-loans source declares only the columns.
- fluxnode-registry: `explore` mode runs under its own task key (`caller-key.ts`), so the fresh run must declare again; it now does.
- fluxnode-runs type and check tests: the previous rewrite changed their scenarios and reason text. Restored the original scripts, reason and assertions, declaring only the columns so the wrong rows reach the type and the program's check that these tests are about.
- model-routing and repair-routing "no models": P4 makes the role router name the starting model on every request (`claude-haiku-5-5` unless a default is named), so the priced lane's `lane-default` placeholder was unreachable. `LANE_DEFAULT_MODEL` now follows the router's rule.
- pinning: **product bug.** `pin/pins.ts` seeded the pinned task's memory with the pinned Flow but not the learned task's data declaration, so the pinned replay read as a legacy task and its stamped criteria failed (`process_invalid_condition`, one model call). The pinned task now inherits the learned task's declaration when it has none.
- act-scope "two-rounds" and idempotency "owns its resume": P2 adds one model call (the FluxNode's own N/A declaration). Traced in `runtime/llm/loop-budget.ts`: with uniform call prices, a declaration then a press always leaves the press as the wrap-up decision, which withholds every tool, so the original partial-act boundary was unreachable. The lane now takes an opt-in `declarationUsd` (a one-line declaration is a cheaper call); these two tests price it at $0.0001 with a $0.0011 purse, so declaration and press land and the completion is unpaid. Every original assertion stands, including `resumed.asked` 0 and the act counts.

### Additional owners from the lead (t987)

`endings/tests/judge.test.ts` (6/6 failed) and `saved-shapes.test.ts` (3/4 failed), all from missing declarations. Each scripted attempt now declares truthfully (`{ process: {} }` for list tasks, `null` for the card task). One oracle changed and **needs lead review**: judge "a completion that says it cannot be done" asserted the give-up reached the judge (`judged_no`, `timesChecked: 2`). Under P2 the data stage refuses a data task's completion with nothing read before any judge is asked, so it now asserts the data-stage refusal code, that no judge verdict was on it, one judge call and `timesChecked: 1`. Keep-going and 3-row result assertions are unchanged.

### Structure audit corrections

`service.ts` was 4305 lines against 4304: t984 held two import lines from `runtime/llm/index.ts` that t987 had merged into one. Applied the same one-line merge; the file is now identical to t987's apart from line endings, so the later merge is clean.

### Commands run and observed results

```text
# Core packages/fluxiq unless noted; each: node C:/Users/osrs_/FluxStuff/fxwork/.heavy-slots/heavy-slot.mjs run <label> -- node ../../node_modules/vitest/vitest.mjs run --maxWorkers=1 --minWorkers=1 --fileParallelism=false <files>
t984-af-nine        the 7 failing AF files + task/resolve/retained-schema owners -> 10 files, 76/77, interrupted failing
t984-live-pages     detached-execution, interrupted, flow-run, saved-flow-road, row-shape, trail, row-url-repeat, repaired-read-conditions, same-words, saved-read-restart, automatic-service, publication-restart -> 12 files, 120/120, exit 0
t984-fluxnode-owners    17 FluxNode files (15 + processing, processing-options) -> 28 failed / 44 passed of 72 (baseline after merge)
t984-fluxnode-owners-2  same 17 -> 16 failed / 56 passed
t984-fluxnode-owners-3  same 17 + endings judge, saved-shapes -> all 17 FluxNode files pass; judge 6/6 and saved-shapes 3/4 failed
t984-endings-judge  judge, saved-shapes -> 9/10, then the oracle update above
t984-compatibility-independent  the 35-file inventory + endings judge + saved-shapes -> 37 files, 195/195 passed, 647.67 s, log compatibility-resume.log
t984-resume-combined  the 22-file owner command + observation + replacements owners -> 24 files, 192/192 passed, 186.25 s, log resume-combined.log
# Core root
t984-resume-contracts  pnpm --filter @fluxiq/contracts check -> exit 0
t984-resume-types      pnpm --filter fluxiq check -> exit 0 (75,543 ms compile)
t984-resume-structure  node scripts/structure-audit.mjs -> exit 1, 16 violations across 3 rules, all P6 (below)
git diff --check -> exit 0
```

Diagnostic-only runs (temporary instrumentation, removed before the final runs): t984-diag-1, t984-diag-2, t984-fluxnode-diag through -diag-7.

Remaining audit violations, all owned by the P6 judge lane (t987), and per the lead already fixed in t987 cb1aa1d0d:
- failure-as-empty: `runtime/result-verification/judge-evidence/stored-finding.ts:10`, `runtime/result-verification/run-trail/checkpoint/read.ts:28`.
- imports (barrel bypass): `answer-first/attempt-store/store.ts:34` (`../trail/source-owner.ts`), `attempt-store/tests/judge-checkpoint.test.ts:11`, `carry-on/carried-opening.ts:14` and `trail/held.ts:15` (both `../attempt-store/judge-evidence-issue.ts`, added by P6 607deb863; t987 imports the barrel), `runtime/result-verification/contracts/run-trail.ts:2`, `run-trail/checkpoint/make.ts` (4), `run-trail/checkpoint/read.ts:2`, `run-trail/checkpoint/types.ts:2`, `run-trail/tests/fitting.test.ts:4`, `run-trail/trail.ts:16`.
- statement-packing: `attempt-store/tests/judge-checkpoint.test.ts:25`, `attempt-store/tests/judge-issue.test.ts:18`, `runtime/result-verification/flow-less/tests/semantic-discriminator.test.ts:10`, `runtime/result-verification/judge-evidence/tests/summary.test.ts:101,123`.

### Not verified

- Downstream: no downstream source changed (only this report), so the domain check and downstream audit were not run.
- No browser, provider-backed or four-attempt live acceptance. The live-pages row writes run before each saved-Flow step that follows a new page; publications are fingerprint-deduplicated, but the cost in a long repeat was not measured.
- The combined t984 + t987 tree has not been tested together; the lead merges t987 next.

### Open questions for the lead

- `task-model/resolve.ts` (P4) and `fluxnode/pin/pins.ts` are fixed here because their regressions blocked P2's compatibility owners. The same `later-attempt` memory-failure test fails on dev today.
- The judge-test oracle update above.
- A saved Flow whose steps carry a stamped declaration, replayed under a task with no kept declaration (an exported Flow imported elsewhere, say), still reads as legacy and refuses its own criteria. The pin path is fixed; whether a Flow should carry its declaration on its own is a P2/P6 design question.
