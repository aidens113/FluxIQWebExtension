# W3 t899: pipeline-mapped secrets and the secret-input invariant test

## Outcome
Done. Narrow checks pass: fluxnode directory vitest 11 files / 43 tests; structure audit has no FAIL lines. Typecheck not run (the supervisor runs it).

## What changed and why
All paths under `packages/fluxiq/src/framework/automation-service/service/fluxnode/` (Core worktree fxwork/t899/!FluxIQ).

Pipeline-mapped secrets (a record field mapped into a registered FluxNode's `format: "secret"` input):
- `pipeline/pipeline-secrets.ts` (new): `PipelineSecrets` holds the secret values a pipeline run has met. `meet()`, `within()` (runs a call inside `runWithAutomationStudioRunSecrets` with them) and `withheld()`.
- `pipeline/fluxnode-flow-caller.ts`: before a mapped call starts, the target spec's secret inputs are read (`fluxNodeSecretInputs`) from the call's inputs and met. The child run starts inside the secret frame. The outputs returned to the pipeline are withheld.
- `fluxnode-run.ts`: new `FluxNodeRun.withhold(more)`. A pipeline run's events and result (told or ended after the value is met) withhold it like a declared secret. `secrets` is no longer readonly.
- `pipeline/run-fluxnode-pipeline.ts`: wires the collector, the withheld dataset writer and the state wrapper. `finally` rewrites the run's stored datasets so datasets written before the value was met are withheld too.
- `pipeline/withheld-dataset-writer.ts` (new), `pipeline/datasets.ts` (adds `withhold(runId, secrets)`; held rows now keep their runId).
- `pipeline/secret-safe-state.ts` (new): wraps `PipelineState`, reading the pipeline definition against the registered FluxNodes.
  - **Cache: refused.** A call to a FluxNode with a mapped secret input is never cached. `reuseResultsForMs` is a silent no-op for that step: nothing is stored under a key, nothing is read back. I chose refusal over hashing because an unsalted hash of a low-entropy secret is brute-forceable, and a salted one would not match across restarts.
  - **Incremental key: refused only on overlap.** If the step's `skipProcessedBy` path overlaps a record field the secret input's expression reads, the step is never skipped and no key is stored. Otherwise the key holds none of the secret and is kept as is.
- `secrets/withheld-data.ts`, `secrets/withheld-records.ts` (new; `fluxNodeWithheldRecords` exported from the barrel). `withheld-for-program.ts` now uses `withheldData`.
- Verified: the mapped call's own run already withholds a declared secret (its events, result and child state contain no value in the test).

Invariant test: `tests/secret-invariant.test.ts`, two cases (secret bound via `$input`, and typed out by the model), each exploring then replaying with another secret.
- (a) Spies on `service.generateFlowBootstrapAdaptation` and asserts each attempt's caller options have `inputs` equal to `{ note }` only, with neither secret anywhere in them.
- (b) Reads every file under the service data dir (attempt store, steps, Flow, drafts) and the step-log dir as text and asserts neither secret appears. A positive control asserts an attempt file exists and that the plain input `note` is found by the same scan.
- Fails when a secret returns to caller.inputs: I temporarily changed `run-fluxnode.ts` to pass `inputs` instead of `fluxNodeInputsWithoutSecrets(inputs, secrets.names)`. Both cases failed (`expected { title: 'clockm', note: 'birds' } to deeply equal { note: 'birds' }`). I then restored the file from a backup copy (`git diff --stat` on it was empty after).
- `pipeline/tests/pipeline-secrets.test.ts` (new, 5 tests): end-to-end pipeline run (outputs show `password: "[withheld]"`, events/result/state/child runs/data dir hold no value, and the call itself did run with the value), the state wrapper (cache refused, key overlap, no-op when no secret), and dataset rewrite.
- Also hardened `filesHolding` in `tests/secret-inputs.test.ts` (existing, mine to own) to tolerate ENOENT. A file removed between listing and read made it flake under the full directory run (seen once in secret-inputs and once in my new test, both before I added the same tolerance).

## Commands run and observed
- `pnpm --filter fluxiq exec vitest run src/framework/automation-service/service/fluxnode` -> 11 files passed, 43 tests passed (final run).
- `node scripts/structure-audit.mjs` -> no FAIL lines (only pre-existing file-lines warns). An earlier run flagged statement-packing in my tests; fixed.
- Temporary revert experiment as above -> 2 failed, then restored.

## Not verified
- Typecheck (supervisor runs it).
- Withholding is from the moment the first mapped call's secret is met. Pipeline events told earlier (e.g. a `transform_needed` carrying the raw records before the first mapped call) and sink outputs (file, webhook, sdk callback) deliver the record as the pipeline's owner defined it, unwithheld; I did not change sinks, which are the owner's chosen destinations, and `service/pipelines/**` (the map-step engine) is outside my paths.
- A host-supplied persistent `pipelineState` is wrapped the same way; only the in-memory default is exercised.

## Open questions or contradictions
- `map-step.ts` (outside my paths) builds the cache key and incremental key with the plain value; I could only guard through the `PipelineState` seam. A cleaner fix would live there.
- Lineage is kept whole by `fluxNodeWithheldForProgram` (pointers only); a secret as an object key in outputs could in theory reach a pointer. Not handled.
