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

Read-only tracing showed `recordOutput.process` already crosses saved Flow, record batch and canonical `process_json`; `run-dataset-store.ts` parses it with the existing processing parser. The lead approved one strict optional `process.declaration` provenance field: `{ version: 1, source: instructionDigest, revision, bindings }`. The framework stamps digest/revision/bindings; a model does not author them. Version 1 opts into automatic semantics; absence remains legacy. This avoids a second schema, output contract or DB column. The owned parser/type plus direct parser/serialization tests will be extended only after combined sync, alongside the runtime declaration integration.

The lead approved serialized transfer of `packages/fluxiq/src/framework/persistence/automation/project/run-dataset-answer/answer.ts`, `run-dataset-store.ts` and their owning tests AFTER P1 freeze/sync. They must dispatch to the same automatic evaluator; missing evidence must atomically invalidate any existing ready answer marker and cannot silently read collected rows as an answer. A fully materialized known-empty result follows explicit minRows/data-task contracts; a marker is not universal task success.

The store already reads `runtime_runs.started_at_ms` for relative comparisons. The lead approved exposing that exact exploration start from `answer-first/rows/exploration-session.ts` via `rows/open-exploration-session.ts`'s session type and owning test, then supplying it to run-attempt/feed. This preserves real finish timestamps and avoids independent ambient clocks. All these dependent paths remain untouched until the combined P1/P4/permission sync.

P1 coordination: a retained answer marker describes complete materialization, including truthful empty rows, independently of task success/belowMinRows. P1 reports that its receipt hashes canonical process metadata, so declaration provenance naturally changes that receipt. For empty captures the in-memory ledger already records a page by callId with kept:[]; it does not require datasetId to distinguish a source. P1 proposed persisting a zero-row batch only for a valid explicit host schema, preserving durable schema/capture identity for restart/readBack; this worker supports that seam. Legacy absent-schema empty reads remain unchanged. These P1 claims await the lead's verification/sync; no P1 source was edited here.

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

1. **Declare in the existing interpretation call.** Extend its existing answer with a `process` declaration using the present condition/sort dialect; field strings initially name instruction-level concepts. Keep the instruction/source digest and a revision beside it, outside `AutomationStudioRecordProcessing`, so the existing strict processing parser remains unchanged in purpose. There is no new interpretation or processing model call. A known task or saved Flow reuses its kept declaration.
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

Outcome: Partial — independent binder/operators and requested explicit-presence follow-up complete, validated and frozen. Remaining P2 runtime integration awaits combined sync.
Changed: Core packages/contracts/src/record-sets/process/{process-rows.ts,index.ts,automatic-identity.ts,binding/{bind.ts,index.ts,result.ts,tests/bind.test.ts},readiness/{comparison.ts,condition.ts,filters.ts,index.ts,missing-evidence.ts,result.ts,value.ts},tests/automatic-processing.test.ts}; this report.
Validation: Prior independent freeze -> 4 files / 70 tests plus contracts check/audit/diff passed. Follow-up owning automatic tests -> 32/32 passed; contracts check/audit/diff -> exit 0. Exact commands/failure history recorded above.
Not verified: P1 transport completion, persistent declaration/feed integration, final clock/publication/completion/store readiness seams; live browser/provider behavior was not run.
Report: `docs/working/data-first-simplification-plan/reports/t984-data-stage.md`.
Notes: t976 stays frozen. No held P1/P4-dependent source changed. No git mutations or full/paid runs.
