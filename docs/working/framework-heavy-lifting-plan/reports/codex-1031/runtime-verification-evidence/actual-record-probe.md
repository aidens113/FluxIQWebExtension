# Actual-record acceptance preparation

Outcome: Partial — actual input extraction is prepared and smoke-verified. The producer/screening/summary/verdict acceptance phase awaits the worker freeze and fresh Core/contracts build.

Ignored reader: `test-runs/2026-10-31-t841-validation/read-saved-processing-input.mjs`.

```powershell
node --no-warnings test-runs/2026-10-31-t841-validation/read-saved-processing-input.mjs C:/Users/osrs_/FluxStuff/lab-runs/2026-10-31/run-mvx83b7v-5eda5d6c
```

Observed exit0, closed result `extraction_ready`:

-76 original collected records in stored ordinal order, with original batch/node provenance; batches8/16/24/28.
-8 persisted answer records, four schema fields: `name`, `role`, `branch`, `gasSafeId`.
- Original processing: two conditions,59 filtered records,9 duplicates,8 kept.
- Input digest: `e1e93c7f7c23f7678bc94d87af43d99a83d7cd56dc61aa18f87fcf59bc8f63a2`.
- Persisted answer digest: `7930562aaf9b98c1dd1ed6880c56a1bc779fc828e21259b4013abaf89aadf1a2`.

The reader binds the finalized run's creation context, Flow and runtime-run identities to its existing isolated workspace under the pinned Lab instance. It opens that workspace's `project.sqlite` strictly read-only with a Windows namespaced path. `run_datasets` supplies the schema and typed processing declaration actually used by the persisted Flow's native run; `run_dataset_rows` supplies all collected value objects; `run_dataset_batches` restores original provenance; `runtime_runs.started_at_ms` preserves the original processing clock. The collected-row query mirrors the production store's read and order, including its missing-batch fallback. The existing final answer comes from `run_dataset_answer_rows`.

No record, cell, selector, instruction, credential or source code is printed or written. Raw inputs remain in memory when the reader is imported by the acceptance probe. The declaration and schema are not reconstructed from a final sample or an oracle.

Actual typed operator facts: condition1 tests `branch` with `equals`; condition2 tests `gasSafeId` with `matches`. The actual comparison literals remain private. Some collected rows lack the tested property, so genuine observed absence must reach the text/regex settlement semantics. A presence-only substitution would not reproduce this declaration.

The persisted Flow's measured `source_mode` is `visual`; an earlier inference from an empty graph-node query was incorrect and was retracted before implementation. The actual runtime request's `resultSummary.flowShape` holds nine nodes, including the read node's structural record-output declaration. The reader recovers that actual node identity/definition and recursively unwraps parameter-screen array objects only when their sole keys are `count`/`items` and every item is present. Its recovered schema **and** processing declaration canonical-match the native durable headers exactly. No defaults are guessed. The earlier authoring-test declaration differs and is not used. The reader returns this explicitly reconstructed, captured read-node input for strict authored matching; it constructs no executable substitute Flow. The implementation retains the missing-authored negative guard.

Next phase, after freeze/build: use the exported reader to call production `processAutomationStudioRecordRows` with its untouched schema/declaration, rows/provenance and clock. Require the answer digest/order to match the original8 records. Feed the producer's account and the strictly matched captured authored declaration through the production screening/summarization path, preserving the declared evidence policy; retain all other original saved summary fields and all four saved replies. Then measure observation/settlement coverage and the production verdict's closed accepted/held codes. No evaluation, witness, settlement or quote field will be injected into saved evidence. Existing legacy accounts remain a negative control.

Validation: exact extraction command above -> exit0 and the counts/hashes above, plus `capturedAuthoredSchemaAndProcessMatch: true`. `git check-ignore -- test-runs/2026-10-31-t841-validation/read-saved-processing-input.mjs` -> helper path printed, exit0.

Changed: ignored reader and this report only for this preparation phase. No source/tests, Core startup, browser/provider, migrations or SQLite writes.

Not verified: fresh producer output, screened witness coverage, new summary settlement, post-fix four-response acceptance, or a live/replay result.
