# w2-bootstrap-structured-params: Core refuses malformed structured parameters and tells the model their shape

Worker report, 2026-09-16. All edits are in FluxIQ Core (`F:\!FluxIQ`).
Path prefixes: `AS/` is `packages/fluxiq/src/programs/automation-studio/`, and
`FB/` is `AS/runtime/flow-bootstrap/plan/`. The brief's `FB/validation.ts` and
related files live in that `plan/` subfolder.

## Outcome

Done, including the coordinator's two mid-task corrections, which are stated
here as required.

- **Correction 1: an importer can supply the hook.**
  `AutomationStudioImporterImplementationBundle` now has
  `parameterContracts?: Record<nodeDefinitionId, AutomationStudioNodeParameterContract>`.
  `AutomationStudioNativeNodeRuntime.register` checks those contracts and binds
  them onto the node registry, which is where every validation of a generated
  plan reads them. A stub importer bundle test proves a bundle-supplied
  contract refuses a plan. The web side's wiring is exactly
  `parameterContracts: webAutomationOutputNodeParameterContracts,` (its map is
  keyed by node definition id, which is what Core expects).
- **Correction 2: a missing `recordsPath` is filled in, not refused.** When a
  model-written `recordOutput` omits `recordsPath`, plan validation fills it in
  from the node definition's `metadata.recordsPath` before parsing. The web
  extract node declares `result.extracted`. Validation still refuses a record
  output that is otherwise malformed, one whose definition declares no records
  path (`record_output.missing_records_path`, which includes
  `builtin.policy.action`), and one whose written `recordsPath` is invalid.

Brief items:

1. **Plan validation refuses what the runtime refuses.** A plan is now refused
   for any of these, each shown failing before the change:
   - a `record-output` parameter that `parseAutomationStudioRecordOutput`
     rejects;
   - a `builtin.policy.action` whose `outputId` no available node declares;
   - a value that a domain's parameter contract reports.
2. **The model is told the shape of structured parameters.**
   - The catalog entry for an `object`, `json` or `array` parameter carries a
     bounded `description` and a small `example`.
   - A node's description is no longer cut at 80 characters. The new bound is
     240.
   - Declared tags now count for ranking, and a specific tag pulls its node
     into the catalog.
3. **Record capture from an importer node works as it is.** A service-level
   test passed on unchanged Core. `record-capture.ts` was not changed.
   `native-node-runtime.ts` was changed only for correction 1.

### The hook's final signature

```ts
// AS/nodes/definitions.ts (exported through AS/nodes/index.ts)
export type AutomationStudioNodeParameterContract = (input: {
  definitionId: string;
  parameterId: string;
  value: JsonValue;
}) => readonly string[];

// AS/nodes/importer-sdk.ts: what an importer registers
export type AutomationStudioImporterImplementationBundle = {
  // ...existing keys...
  /** Keyed by the id of a node the manifest declares. */
  parameterContracts?: Record<string, AutomationStudioNodeParameterContract>;
};

// AS/nodes/canonical-registry.ts: where registration binds it and validation reads it
AutomationStudioNodeRegistry.bindParameterContract(nodeId: string, contract: AutomationStudioNodeParameterContract): this;
AutomationStudioNodeRegistry.getParameterContract(nodeId: string): AutomationStudioNodeParameterContract | undefined;
```

These rules are documented on the type and enforced:

- **Registration.**
  - `register(manifest, bundle)` throws before registering anything when a
    `parameterContracts` key is not a node id in the manifest
    (`Parameter contract <id> is not declared by manifest <packageId>.`) or a
    value is not a function (`Parameter contract <id> must be a function.`).
  - It then binds each contract on `runtime.sdk.nodes`.
  - `bindParameterContract` also refuses an unregistered node, a built-in
    node, and a second contract for the same node.
  - The contract is never placed on the definition. The importer SDK registry
    runs `structuredClone(manifest)` (`AS/nodes/importer-sdk.ts`), which would
    throw on a function, and the registry documents definitions as plain data.
- **When it is called.** During plan validation, for each present parameter of
  that node whose value is a literal of the declared type. It is not called
  when the whole value is a state binding. A value that contains a nested
  `{ $state: ... }` binding is passed as it is, and a contract that refuses it
  there fails closed.
- **What it receives.** `value` is a copy, so changing it changes nothing.
- **What it must return.** It must be synchronous. Valid codes are
  lower-case, dot-separated (`/^[a-z][a-z0-9_-]*(\.[a-z0-9_-]+)+$/`), at most
  120 characters, and never start with `bootstrap.`.
- **How bad answers are reported.**
  - A code outside those rules becomes `bootstrap.parameter_contract_violation`.
  - At most 8 codes are kept for one value.
  - A throw, or an answer that is not an array (a Promise included), becomes
    `bootstrap.parameter_contract_failed`.
- **What the issue looks like.** Each kept code becomes
  `{ severity: "error", code, message: "Node parameter value does not satisfy its domain contract.", path: "plan.subflows.N.nodes.M.parameters.<id>" }`.
- **Where it applies.** Every plan validation: generation
  (`service.ts:1989`), create (`service.ts:2062`), apply (`service.ts:4129`)
  and the LLM harness output check. All of them pass
  `nativeNodeRuntime.sdk.nodes`. `service.ts` is unchanged at 6434 lines, and
  `llm/**` is untouched.

## What changed and why

- **`AS/nodes/definitions.ts`**: the contract type and its documentation.
- **`AS/nodes/canonical-registry.ts`**: `bindParameterContract` and
  `getParameterContract`, backed by a private map. The class comment now says
  the contract is the only host code the registry holds, and that it is kept
  beside the definitions.
- **`AS/nodes/importer-sdk.ts`**: the bundle's `parameterContracts` key.
- **`AS/runtime/native-node-runtime.ts`** (correction 1, now 125 lines):
  `register` checks the keys and values before `sdk.register(manifest)`, so a
  bad bundle registers nothing, and binds each contract afterwards.
- **`FB/validation.ts`** (399 lines):
  - `validateParameters` now receives the whole definition and a small scope:
    the registry, the resolution, and the registered output ids, computed once
    per plan.
  - **Record outputs.** A parameter with `ui.control: "record-output"` is
    parsed with `parseAutomationStudioRecordOutput`, using default options, so
    encryption is refused as the runtime refuses it.
    - If the value is an object with no `recordsPath` key and the definition's
      `metadata.recordsPath` is a string, that path is filled in first
      (correction 2).
    - Each parser code becomes its own issue at the parameter.
    - `null` is accepted, because the runtime reads it as "save nothing" and
      it is the declared default. It used to be refused as
      `bootstrap.invalid_parameter_value`.
  - **Policy action outputs.** `builtin.policy.action`'s `outputId` must be a
    literal string that some node available under the resolution declares, as
    `fixedOutputId` or in `allowedOutputIds`.
    - Otherwise the issue is `bootstrap.unknown_output_reference`.
    - A state-bound `outputId` is `bootstrap.invalid_state_binding`.
    - The check is keyed on that one Core node and parameter. It is not keyed
      on `ui.referenceType: "action"`, because
      `builtin.policy.recovery.fallbackActionDefinitionId` shares that
      reference type but names a definition and defaults to `""`.
  - **Contracts.** The bound contract is called as described above.
  - **Existing checks.** They behave as before. After a type failure, or when
    an invalid nested binding is found, the new checks are skipped.
- **`FB/contracts.ts`**: the catalog parameter entry gained optional
  `description` and `example`.
- **`FB/catalog.ts`**:
  - `CATALOG_TEXT_LIMITS` is documented and module-private, so the plan
    barrel's public surface is unchanged:
    - label: 100 characters, as before;
    - node description: 240 characters (was 80);
    - structured-parameter description: 600 characters;
    - structured-parameter example: 600 bytes, sent whole as a copy or not at
      all.
  - A cut description ends in `...`.
  - Descriptions and examples are sent for `object`, `json` and `array`
    parameters only.
  - Preferred definitions (see ranking) are appended after the required ones
    and are never recorded as missing.
- **`FB/ranking.ts`**:
  - Tag words (tokenized) form their own field worth **12** points per
    matched word, the same as a label word. Before, they sat in `detail` at 2.
  - A new `preferred` list: each instruction word, in order, that is a tag word
    of at most **3** available definitions, none of which is already chosen,
    prefers the best-scoring carrier. At most **4** definitions are preferred.
  - Preferred definitions are not "required". A missing required term fails
    generation before the provider is called (`service.ts:1883`,
    `llm/harness/run.ts:86`), and a tag must never do that.
  - A tag on every web node (`web-automation`, `output`) scores but prefers
    nothing.
- **New tests**:
  - `FB/tests/validation.test.ts` (18 rows). Record-output rows:
    - parser codes at the parameter;
    - the policy action;
    - encryption refused;
    - valid and `null` accepted;
    - **the missing `recordsPath` filled in from the definition**;
    - **still refused when otherwise malformed** (exactly
      `["record_output.invalid_write_mode"]`);
    - **refused when the definition declares no path**, for the importer node
      and for the policy action (`["record_output.missing_records_path"]`);
    - **a written invalid path refused**.

    Output-reference rows: unregistered, out of scope and state-bound
    `outputId` refused; fixed and allowed ids accepted.

    Contract rows:
    - a contract's code reported with the exact issue;
    - not asked about a wrong-typed or whole-binding value;
    - cannot mutate the plan;
    - a throw or a Promise fails closed;
    - bad and excess codes are bounded.
  - `FB/tests/catalog.test.ts` (9 rows):
    - description kept past 80 and bounded at 240;
    - structured parameter description and example carried, and not carried
      for a number parameter;
    - the 600 bounds and an oversized example omitted;
    - a tag pulls its node into a 3-entry catalog;
    - a 4-carrier tag outranks a description match;
    - a 5-carrier tag prefers nothing;
    - a preferred node that does not fit leaves `missingRequiredTerms` empty.
  - `AS/runtime/tests/importer-record-capture.test.ts` (1 row, service level).
    - Setup: an importer node with a `records` output and a `recordOutput` in
      its dispatch, run through `AutomationStudioService` with an IO output and
      a bound native runtime.
    - Result: the run succeeds, and the stored dataset page holds the
      validated rows with the excluded field dropped. `listRunDatasets` shows
      `recordCount: 2` and `nodeIds: ["extract"]`, and neither the page nor
      the run trace contains the excluded value.
- **Extended tests**:
  - `AS/runtime/tests/native-node-runtime.test.ts`: 5 rows.
    - **Stub importer bundle:** its contract reaches
      `validateAutomationStudioFlowBootstrapPlan` through `runtime.sdk.nodes`
      and `getRegistryResolution`, and refuses `{ nonsense: true }` with the
      exact issue while accepting `{ item: ".row" }`.
    - Without the key, no contract is bound.
    - An undeclared key or a non-function throws and registers nothing.
    - The importer node's result passes the result boundary with
      `recordOutput` kept.
    - A graph run hands the validated batch to `onRecordBatch` and keeps a
      `$dataset` marker in the trace.
  - `AS/nodes/tests/canonical-registry.test.ts`: 3 rows for binding, the
    definition still being cloneable, and the refusals.

## Commands run and observed results

All commands were run in `F:\!FluxIQ`.

- **Before the source change.** `npx vitest run --root packages/fluxiq` on the
  new plan tests plus the two runtime test files printed `Failed Tests 25`.
  - Every refusal and catalog row failed, for example
    `expected [] to include 'record_output.invalid_write_mode'`,
    `expected true to be false` for the unregistered `outputId`,
    `expected 80 to be 240`, and
    `expected [ 'domain.demo.product_0', …(2) ] to include 'domain.demo.harvest'`.
  - The record-capture rows also failed at first. That was my fixture: capture
    reads `recordsPath` inside the output's payload.
  - After I fixed the fixture, the service-level dataset row **passed on
    unchanged Core**. This is the confirmation for item 3.
- **Fail-first checks for the two corrections.** Each was run by temporarily
  disabling the new line, then restoring the file; `cmp` against the backup
  printed `restored`.
  - With the `recordsPath` default disabled, the row "takes a missing
    recordsPath from the path its definition declares" failed:
    `expected [ Array(1) ] to deeply equal []`.
  - With the bundle binding disabled in `native-node-runtime.ts`, the row
    "reach validation of a generated plan through the registry" failed:
    `expected undefined to be [Function contract]`.
- **Plan tests.** `npx vitest run --root packages/fluxiq src/programs/automation-studio/runtime/flow-bootstrap/plan`
  printed `Test Files 2 passed (2)`, `Tests 27 passed (27)`.
- **Flow-bootstrap.** `npx vitest run --root packages/fluxiq src/programs/automation-studio/runtime/flow-bootstrap`
  printed `Test Files 4 passed (4)`, `Tests 92 passed (92)`. That is 64
  before, 27 of mine, and 1 more in files I did not edit.
- **Runtime and nodes, final.**
  `npx vitest run --root packages/fluxiq src/programs/automation-studio/runtime src/programs/automation-studio/nodes`
  printed `Test Files 124 passed (124)`, `Tests 1196 passed (1196)`.
- **Runtime, earlier run** (before the corrections, `runtime` only):
  `Tests 4 failed | 1054 passed (1058)`.
  - Three were `Test timed out in 15000ms` under load: `service-bootstrap`
    `adaptation.test.ts`, `service-recordings` `proposals.test.ts` and
    `service-flows` `scale-pages.test.ts`.
  - One was an assertion in `flow-bootstrap/tests/generation-failure.test.ts`
    ("accepts only bounded categorical evidence steps"). Its subject,
    `generation-failure.ts`, imports only `llm/` and `loop-limits/`, both
    changed by other workers.
  - Rerunning the four files alone gave `1 failed | 60 passed (61)`: the three
    timeouts passed and the `generation-failure` assertion failed again. In
    the final full run above, all four pass.
- **Structure audit.** `node scripts/structure-audit.mjs` printed
  `passed (146 warning(s), 254 baselined)`.
  - It was also run against a scratchpad copy of the git index with my three
    untracked test files added (`GIT_INDEX_FILE=<copy> git add ...`), because
    the audit reads `git ls-files`. It printed the same pass, with no finding
    or warning on any of my paths.
  - The real index was untouched: `git status` shows the files as `??`.
- **`pnpm check`, three runs.**
  - **Run 1: exit 2.** `apps/web` hit
    `llm/evidence-loop.ts(203,37) TS2339`, a half-finished edit by another
    worker.
  - **Run 2: exit 0.** All four packages printed `check: Done`, and the audit
    passed with 146 warnings. The two warnings above 144 are other workers'
    files: `llm/evidence-loop.ts` at 401 lines and exported values in
    `flow-bootstrap/generation-failure.ts`.
  - **Run 3, after the corrections: exit 2.** The only errors are in another
    worker's new file:
    `runtime/llm/tests/unusable-decision.test.ts(114,22): error TS2352` and
    `(114,45): error TS2493`.
  - I confirmed separately that no other errors exist:
    - `npx tsc --noEmit` in `packages/fluxiq` reported exactly 2 errors, both
      in that file;
    - `npx tsc --noEmit` in `apps/web` exited 0.

## Not verified

- **Web wiring.** The web domain's contract was not run inside Core's
  validation. The domain compiles against Core's `dist`, which does not yet
  contain these changes, and I did not rebuild it. The wiring line
  `parameterContracts: webAutomationOutputNodeParameterContracts,` has not
  been compiled against the new bundle type.
- **Live model behaviour.** No live provider call was made. Whether the longer
  texts and tag preference change the model's choices is untested.
- **Catalog byte budget.** The larger web `extract_list` entry (up to 240 plus
  600 characters, plus an example) was not measured against an evidence-guided
  catalog.
- **Whole-suite run.** I ran `runtime/`, `nodes/` and `flow-bootstrap/`, not
  all of `src/programs/automation-studio`.
- **`pnpm check` exit 0 after the corrections.** Not observed, because another
  worker's test file fails `tsc`. Both packages' `tsc` show no errors in any
  file of mine.
- **Test counts.** The brief's "991 before" figure does not match any scope I
  ran (`runtime` alone was 1058 tests in my first run), so I report the
  observed counts instead.

## Open questions or contradictions found

- **Filling in `recordsPath` for other nodes.** The default reads the **node
  definition's** `metadata.recordsPath`. The recording-proposal path
  (`AS/runtime/service/recordings/proposal-candidates.ts:193-202`) reads the
  **IO output definition's** `metadata.recordsPath` instead. For the web
  extract node the two agree (`result.extracted`). `builtin.policy.action` has
  no definition metadata, so a model-written record output on it must still
  carry `recordsPath`, which matches its runtime parse.
- **The policy action's `parameters` payload.** It is still not checked
  against the named output's node contract.
- **Tag preference thresholds.** 3 carriers and 4 preferences are judgement
  values. The web tags (`scrape, collect, extract, list, table, rows, records,
  dataset, every page, next page, load more, infinite scroll, pagination`)
  split into words.
  - A word shared by more than 3 web nodes will score but prefer nothing.
  - `extract` is already a Core verb group, so it pins the best-scoring node
    rather than preferring one.
- **Other workers' files.** `flow-bootstrap/generation-failure.ts`,
  `loop-limits/flow-bootstrap-evidence-loop.ts`, `llm/evidence-loop.ts`,
  `llm/unusable-decision.ts` and `llm/tests/unusable-decision.test.ts` changed
  while I worked. I did not touch them. The last one currently breaks
  `pnpm check`.
