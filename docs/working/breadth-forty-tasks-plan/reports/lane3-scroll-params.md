# Report: lane3-scroll-params

## Outcome

Done. Core now checks every step against the parameter schema its node publishes, and refuses at submit when a step does not fit. The extension now refuses a scroll request it cannot read, where it used to jump the page to 0,0.

## Causes (both found)

**1. Why `scroll: {"until":"stopsGrowing"}` passed submit.** Core's plan validation is the check every submission goes through. It goes through the completion check: `runtime/llm/harness-options/bootstrap-completion.ts:448` calls `validatePlan`, which calls `validateAutomationStudioFlowBootstrapPlan`. Inside it, `validateParameters` (`packages/fluxiq/src/programs/automation-studio/runtime/flow-bootstrap/plan/validation.ts:212`) checked a value only against the parameter's own `valueType`/`options`/`constraints`, through `parameterValueMatches` (`validation.ts:239`, defined at `:459`). `scroll` is `valueType: "object"`, so any object passed. The domain does publish the real schema: `domain/src/output-nodes/definitions.ts:291` sets `metadata.parameterSchema: definition.parameterSchema`, and `domain/src/actions/schemas.ts:100-110` has `required: ["mode"]`. But no validator read that schema. Only `parameter-words/word-forms.ts` read it, and only for wording. The domain's bound parameter contracts cover only extract and extract_list (`domain/src/output-nodes/parameter-contracts.ts:13-16`). So nothing checked a missing `mode` or an unknown `until`.

**2. What the extension did with it.** The domain's reader `scrollRequestValue` (`domain/src/client/gateway-action-parameters.ts:135`) returned `undefined` because there was no mode. `scroll` is not a required field of `web.dom.scroll`, so `gateway-mapping.ts:175` did not refuse the command. The command reached the page with `action.scroll` absent and the raw request still in `options.scroll`. `scroll.ts:70` (HEAD) then ran the legacy absolute move, `requestedPosition` (`scroll.ts:81`), to `options.x`/`options.y`. Core writes every default into the step (`authoring/normalise.ts:133` `materialiseDefaults`), and the scroll node declares `x`/`y` with `defaultValue: 0` (`domain/src/output-nodes/definitions.ts:336-337`). So every pass called `scrollTo(0,0)`. The page sat at its top and the loop re-read the same posts.

## What changed and why

Core (`C:/Users/osrs_/FluxStuff/fxwork/t566/!FluxIQ`):
- New `packages/fluxiq/src/programs/automation-studio/runtime/flow-bootstrap/parameter-schema/fit.ts` and `index.ts`. `automationStudioParameterSchemaMisfits({definition, parameterId, value})` reads `metadata.parameterSchema.properties[parameterId]` and reports where the value does not fit. It reads standard JSON Schema keywords: `type` (one or a list), `enum`, `const`, `required`, `properties`, `additionalProperties`, `items`. It stops at 5 misfits per parameter and 16 levels deep, and lets a nested `$state` binding pass. It knows no action. Each misfit is a sentence in Core's words that quotes only identifiers: the parameter, the field, and the fields or enum words the schema allows. It never quotes the value. An undeclared key is quoted only when it is an identifier. I put this in its own directory because `plan/` and `plan/tests/` were at the 25-file limit.
- `plan/validation.ts`: after the `valueType` check, each misfit becomes `bootstrap.parameter_schema_mismatch` at `...parameters.<id>`, with `detail: {field, valid}`. The locator already names the step from that path.
- `plan/issue-feedback.ts`: the new code is added to `AUTHORED_CODES`, so its sentence reaches the builder along with `field`/`valid`, and to `NODE_NAMED_CODES`, so the node id is attached.
- `activity/wording/issue-words.ts`: the code shares the plain-words row of `invalid_parameter_value` ("a step was given a setting it can't use").

Downstream (`C:/Users/osrs_/FluxStuff/fxwork/t566/!FluxIQWebExtension`):
- `domain/src/actions/schemas.ts` (scroll entry only): `scrollRequestSchema` gets `additionalProperties: false`. This is the scroll request's whole key set, so an unknown key such as `until` is refused at submit.
- `domain/src/client/gateway-action-parameters.ts`: `scrollRequestValue` also refuses a request carrying a key outside `mode`/`x`/`y`/`maxScrolls`, which matches the closed schema at dispatch.
- `apps/extension/src/content/actions/scroll.ts`: if `options.scroll` was sent but `action.scroll` is absent (no mode, unknown mode, unknown key, `untilStable` without `maxScrolls`), the verb now fails with `INVALID_PARAMETER` through a `WebAutomationFailureCarrier` error and moves nothing. The failure names the accepted forms and the sent keys, never values. A command that sends no request keeps the legacy absolute move.
- Tests: `apps/extension/src/content/actions/tests/scroll.test.ts` (new) and `domain/src/client/tests/gateway-command-parameters.test.ts` (3 asserts added). In Core: `parameter-schema/tests/fit.test.ts` (new) and `plan/tests/validation.test.ts` (one describe block added, covering validation and feedback).

## Commands run and observed results

- Core, from `packages/fluxiq`: `pnpm.cmd exec vitest run src/.../flow-bootstrap/parameter-schema/tests/fit.test.ts src/.../flow-bootstrap/plan/tests/validation.test.ts src/.../activity/wording` -> 14 files, 175 tests passed.
- Core: `pnpm.cmd exec vitest run src/.../flow-bootstrap/parameter-schema/tests src/.../flow-bootstrap/plan/tests` -> 21 files, 244 passed.
- Core, before the move to `parameter-schema/` (same logic): plan, authoring and wording tests -> 55 files, 616 passed. Tests using the wait fixture plus `llm/harness-options/tests` -> 26 files, 218 passed.
- Core typecheck, `pnpm.cmd exec tsc --noEmit`: no errors in my files. 16 errors remain, all in other workers' new files (`candidate/tests/trial-stop.test.ts` 4, `subflow-candidate/tests/subflow-trial-stop.test.ts` 12). An earlier `pnpm run check`, before those files appeared, passed clean.
- Core `node scripts/structure-audit.mjs`: one FAIL, `runtime/executor/tests/: 26 source files`. That directory is another worker's (`repeat-no-progress.test.ts`), not mine. My first placement failed the `plan/` limits, so I moved it.
- Downstream, `EXTENSION_TEST_BUILD_LABEL=lane3-scroll node scripts/test-extension.mjs content/actions/tests/scroll` -> 7 pass, 0 fail. Against HEAD `scroll.ts` the same test gave 5 fail and 2 pass, so it catches the bug (then restored).
- `DOMAIN_TEST_BUILD_LABEL=lane3-scroll node scripts/test-domain.mjs client/tests/gateway-command-parameters` -> "Web automation gateway command parameter tests passed". Against HEAD's reader it gave `AssertionError: an unknown key refuses the request` (then restored).
- `node scripts/test-domain.mjs client/tests/gateway-command-parameters client/tests/gateway-mapping.test actions/tests output-nodes/tests` -> 135 tests, 135 pass.
- Domain `tsc -p tsconfig.json --noEmit` and `tsc -p tsconfig.test.json`: both exit 0.
- Extension `node scripts/check-extension.mjs`: one error, `src/content/extraction/page-advance/tests/scroll-loaded-list.test.ts(314,6) TS2352`. That file is another worker's untracked file under `extraction/**`. My files show no errors.
- Downstream `node scripts/structure-audit.mjs`: exit 0, no FAIL. It first flagged an `as never` in my test, which I replaced with a typed `JsonObject`.

## Not verified

- No live run or browser run. The submit-path refusal is tested at plan validation and its feedback, not through a full `core.submit_subflow` call.
- Core dist was not rebuilt, as the brief says. So downstream tests ran against the old Core build: they test the domain and extension changes only, not the new Core refusal together with the real web schemas.
- Whole package suites were not run.

## Open questions or contradictions

- **Unknown keys are refused only where a schema closes them.** This follows standard JSON Schema: without `additionalProperties: false`, extra keys are allowed. It had to be this way because the domain's resolved element fingerprints carry keys their schema does not list (`text`, `value`, `implicitRole`, `inputType`, `checked`, `context` in `output-nodes/targets/targets.ts:261`). Treating every object as closed would refuse every resolved target. I closed only the scroll request, since that is the only schema entry I own. The other closed request schemas (`wait`, `option`, `modifiers`, `assert`, `upload`, `dialog`, `tab`, `download`, extraction, nextPage) should get `additionalProperties: false` from whoever owns them. Missing required fields, wrong enum values and wrong types are already refused for every action.
- The "`untilStable` requires `maxScrolls`" rule is conditional, which this schema subset cannot express. Such a step still passes submit. The extension now refuses it at run time with `INVALID_PARAMETER`, and it no longer jumps to 0,0. Adding `if`/`then` to the checker would move this to submit.
- The node's `x`/`y` `defaultValue: 0` (`domain/src/output-nodes/definitions.ts:336-337`, not mine to edit) makes Core write `x: 0, y: 0` on every scroll step. So a step that names no position and no request still jumps to the top through the legacy move. The owner of `definitions.ts` should consider dropping those defaults.
