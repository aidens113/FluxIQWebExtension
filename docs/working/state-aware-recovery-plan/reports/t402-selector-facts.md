# t402 locator facts and requirement refusal code — worker report (revised)

## Outcome

Done, including the coordinator's revision: the fact target is now an `at` locator that the host interprets, there is no string-key trick, and no baseline entry was added. The work is in Core `C:/Users/osrs_/FluxStuff/fxwork/t402/!FluxIQ` on `task/t402-selector-facts`. Nothing is committed.

## What changed and why

All paths below are under `packages/fluxiq/src/programs/automation-studio/`.

1. Locator facts
   - `runtime/flow-bootstrap/script-statements/fact-locator.ts` (new)
     - Reads `at "<locator>"` into `{ locator: "<text>" }`.
     - Core never says what a locator is. The header comment says the connected host interprets it (the web domain reads it as a CSS selector) and that nothing resolves it.
     - Core refuses only what it can see: an empty locator, or one longer than 1000 characters. Syntax checks are left to the host, since Core cannot read a locator.
     - Deliberately left out of the barrel.
   - `runtime/flow-bootstrap/script-statements/fact-condition.ts`
     - A private `targetOf` reads a target as either a handle or `at` plus a quoted locator. `exists`, `absent`, `visible`, `enabled`, `text`, `value` and `count` all use it. `at` is case-insensitive.
     - The header comment documents the form as being for hand-authored and test Flows.
     - Refusals keep `flow_script.fact_invalid` at `flow.line.<N>`.
     - The `css` keyword is dropped. As a string it would pass the audit, but it would make Core name a web concept, so only `at` remains.
   - `runtime/flow-bootstrap/plan/contracts.ts` (outside the owned list; the change would not typecheck without it)
     - The fact `target` type is now `{ handle } | { locator } | dialog`, with an updated doc comment.
   - `plan/flow-script-format.ts` is not touched, so the model is not taught the form.
2. Requirement refusal code. Unchanged from the first pass.
   - `api/handlers/run-refusal/{response,index}.ts`. A subdirectory was needed because of the 25-file directory limit.
   - `api/handlers/runtime-execution.ts` wraps `runRuntimeSession`.
   - A requirement refusal answers `{ ok: false, error, payload: { diagnostic: { code: "run.requirement_missing", missing: [id], side, plainName } } }`. Any other error is re-thrown to the registry, as before.
   - The gate stops at the first missing requirement, so `missing` holds one id.

Tests:
- `script-statements/tests/fact-condition.test.ts`:
  - each of the 7 kinds read with `at`;
  - a handle fact unchanged;
  - 9 refusals: empty, blank, no quotes, missing quotes, too long, trailing words, missing comparison, non-number count, unclosed quote;
  - a refusal placed at its own line.
- `authoring/tests/state-statements.test.ts`:
  - A full script through accept and the plan validator, with `at` in a `start at:` when and in `done when:` (`text`, `count`), alongside a handle fact.
  - New: the accepted plan run through `resolveAutomationStudioFlowBootstrapPlanParameters`, Core's bootstrap handle resolution, with a stub domain that resolves every handle. The test asserts:
    - the resolver was asked about at least one node;
    - no resolver call carried a locator;
    - the entry and success-check facts keep their `{ locator }` and `{ handle }` targets unchanged;
    - `assertAutomationStudioFlowBootstrapPlanHandlesResolved` passes.
  - Empty and unquoted `at` refused at line 9.
- `api/handlers/tests/runtime-execution.test.ts`: the coded refusal, and the unchanged answer for any other error.

## Commands run and observed results

- `npx vitest run src/programs/automation-studio/runtime/flow-bootstrap src/programs/automation-studio/api/handlers` (in `packages/fluxiq`): 140 files passed and 1 skipped; 1895 tests passed and 2 skipped.
- After I removed an `as never` stub, a re-run of `state-statements.test.ts` passed 21 of 21.
- `npx tsc --noEmit --incremental --tsBuildInfoFile node_modules/.cache/fluxiq-build/check.tsbuildinfo`: exit 0.
- `node scripts/structure-audit.mjs 2>&1 | grep -E "FAIL|structure-audit:"`: `structure-audit: passed (303 warning(s), 1163 baselined).`
  - An intermediate run failed once on `as-never` in my new test; I replaced it with a typed stub.
  - No warning names a changed file.
  - `selector` and `css` now appear in my source files only inside comments.

## Not verified

- Core has no separate resolver for fact targets in this tree: a grep for `fluxiq.fact.target` finds nothing. Plan resolution covers only node parameters, and that is what the new test exercises.
- The domain reading `locator` (main is changing `domain/src/runtime/facts/query.ts`).
- The HTTP-level response, a live or Lab run, and the full Core suite.

## Open questions or contradictions found

- `plan/contracts.ts` was edited outside the owned paths, because the type had to widen.
- Bootstrap fact-target resolution in Core (the downstream t400 report's "Core resolves each fact target at bootstrap as `fluxiq.fact.target`") does not exist in this Core tree. When it lands, it must skip `{ locator }` targets.
