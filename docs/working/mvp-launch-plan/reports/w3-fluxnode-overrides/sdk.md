# W3 SDK brief: FluxNode overrides in @fluxiq/sdk

## Outcome
Done. Owned paths only (`packages/sdk/**` in the t899 Core worktree). Not committed.

## What changed and why
- `define/types.ts`, `define/define-fluxnode.ts`: `defineFluxNode({ overrides })` puts it on the draft spec; the contract parser validates it (a locked section throws `SdkError invalid_definition`). New `define/overrides-input.ts`: `FluxNodeOverridesInput` = `FluxNodeOverrides` with `prompts` typed `{[Id in FluxNodePromptSectionId]?: ...} & Record<string, ...>` (autocompletes, still accepts any string so the engine can refuse it by name).
- API choice for run options: widened `RunOptions.overrides` to `FluxNodeOptions & FluxNodeOverridesInput` and split by key (`client/split-run-overrides.ts`, called from `with-run-options.ts`). Reason: the key sets are disjoint, existing `overrides: { retries: 5 }` keeps compiling and producing `request.options`, and one flat bag is the simpler API than a second field a caller must choose between. Option keys are read from `fluxNodeOptionsSchema.shape`, so a new option key follows the contract. Unknown keys go to `request.overrides`, so the engine refuses them by name. An empty part is omitted from the request.
- Resume: `client/resume-options.ts` `ResumeOptions = Omit<RunOptions, "overrides">`; `resume`/`resumePipeline` take it. `buildResumeRequest` throws `SdkError` with new codes `run_request.options_on_resume` (flat bag has option keys) or `run_request.overrides_on_resume` before any request, if a JS caller passes `overrides` anyway. Codes added to `SdkErrorCode`.
- Pipelines: the contract has no refusal for `overrides` with `pipeline` (only with `resumeHandle`), so the SDK keeps offering them on `runPipeline`/`streamPipeline` (same `withRunOptions`). Caveat: I did not check that the Core service applies request overrides to pipeline runs (service is another worker's); prompt section ids belong to a node, so pipeline use is mostly `judgeCriteria`, deadlines, models.
- `index.ts` re-exports `FLUXNODE_PROMPT_SECTIONS`, `FLUXNODE_CORE_TOOL_POLICIES` and types `FluxNodeOptions`, `FluxNodeOverrides`, `FluxNodePromptSectionId`, `FluxNodeTextOverride`; `FluxNodeOverridesInput` and `ResumeOptions` via the define/client barrels.
- Tests: `client/tests/run-overrides.test.ts` (new, 9) and one in `define/tests/define-fluxnode.test.ts`.

## Commands run and observed results
- `pnpm --filter @fluxiq/sdk test` (run in packages/sdk) -> `Test Files 19 passed (19)`, `Tests 98 passed | 2 skipped (100)`. Includes `overrides: { retries: 5 }` -> `request.options` `{retries: 5}` with no `overrides` field; split of a mixed bag; resume refusals by code.
- `pnpm check` (packages/sdk) -> exit 0 (after fixing a test typing error).
- `node scripts/structure-audit.mjs` (Core root) -> exit 1, 3 violations, none in my files: two in `packages/fluxiq/.../fluxnode/tests/run-overrides.test.ts` (`as never`) and `fluxnode/` "run-" prefix (another worker's). My own `as never` violations were fixed. SDK shows only an advisory warn: `packages/sdk/src/client/` has 20 source files (past the 15 advisory); a follow-up could group `build-*`/`resume`/`split` into subdirectories.

## Not verified
- No live engine: the new wire fields are tested at the request-builder level and against the contract in `defineFluxNode`, not through the fake engine or real Core.
- Whether Core applies `request.overrides` for pipeline runs.

## Open questions
- `client/` directory is over the advisory file budget; I did not restructure existing files (out of scope, existing barrel).

## Usage example for the docs
```ts
const node = defineFluxNode({
  name: "shop.price", runtime: "web", goal: "Read the price of {sku}.", start: "https://shop.example/", scope: { sites: ["shop.example"], acts: ["read"] },
  overrides: { judgeCriteria: ["The price includes the currency."], pace: { minStepGapMs: 400 } }   // declared
});
const run = await fluxiq.run(node, { sku: "A1" }, { overrides: {
  retries: 6,                                                                        // goes to request.options
  prompts: { "explorer.role.task": { mode: "append", text: "Prefer the product header." } }, // goes to request.overrides
  deadlines: { llmCallMs: 30_000 }
} });
if (run.status === "waiting_for_person") await fluxiq.resume(node, run.resumeHandle!); // resume takes no options or overrides
```
