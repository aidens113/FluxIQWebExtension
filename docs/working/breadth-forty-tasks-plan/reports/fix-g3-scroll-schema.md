# Fix G3: scroll `untilStable` requires `maxScrolls` at submit

## Outcome

Done. A scroll step `{"mode":"untilStable"}` with no `maxScrolls` is now refused at submit, and the run-time refusal names the key that is missing or invalid instead of "it names mode".

## What changed and why

- **The schema cannot express the requirement.** Core's schema reader (`!FluxIQ/.../flow-bootstrap/parameter-schema/fit.ts`) reads only `type`, `enum`, `const`, `required`, `properties`, `additionalProperties` and `items`. It ignores conditional keywords such as `if`/`then` and `oneOf`, so `scrollRequestSchema` cannot enforce "untilStable needs maxScrolls" by itself.
- **Where the check went instead:** the existing domain validation step for action parameters, the **node parameter contract**. Core's plan validation (`plan/validation.ts`, `contractIssueCodes`) calls it for each literal parameter value. Before this change only `web.dom.extract` and `web.dom.extract_list` had one (`domain/src/output-nodes/parameter-contracts.ts`). The scroll node now has one too.
- `domain/src/actions/scroll-request-issues.ts` (new): `webAutomationScrollRequestIssues(value)` returns `{key, problem: missing|invalid|unknown}` for each key that makes the dispatch reader (`scrollRequestValue`) refuse a request. It is exported through `domain/client`.
- `domain/src/output-nodes/scroll/{index.ts,parameter-contract.ts}` (new): `webAutomationScrollParameterContract`. For the `scroll` parameter it returns `web.scroll.until_stable_missing_max_scrolls` or `web.scroll.until_stable_invalid_max_scrolls` (0, a negative number, a fraction or a string), and only when the mode is `untilStable`. Everything else is left to the schema. Core skips the schema check once a contract returns a code, so a broader contract would replace the schema's sentences naming each field with bare codes. A state-bound `maxScrolls` passes.
- `domain/src/output-nodes/parameter-contracts.ts`: binds the scroll contract. `output-nodes/index.ts` and `client/index.ts` export the new modules. The `actions/schemas.ts` comment now says where the requirement is enforced.
- `apps/extension/src/content/actions/scroll.ts`: `UnreadableScrollRequest` builds its `actual` from `webAutomationScrollRequestIssues`. Example outputs:
  - "maxScrolls is missing; untilStable needs it"
  - "maxScrolls must be a positive whole number"
  - "mode is missing"
  - "mode is not by, toElement or untilStable"
  - "<key> is not a key a scroll request has"
  
  It quotes only identifier keys and never quotes a value. The header comment is updated.
- Other scroll modes are unchanged. `by`, `toElement` and a valid `untilStable` pass both the contract and validation. An unknown key or mode is still refused by the schema with `bootstrap.parameter_schema_mismatch`.

Tests (written first; checked to fail against the old code: the extension refusal test failed, and 3 domain contract tests failed with the old `parameter-contracts.ts`):

- `domain/src/actions/tests/scroll-request-issues.test.ts` (new): the issues for each bad request, no issues for good requests in every mode, and agreement with the dispatch reader.
- `domain/src/output-nodes/scroll/tests/parameter-contract.test.ts` (new):
  - Contract unit cases.
  - Through Core's `validateAutomationStudioFlowBootstrapPlan` with the registry and contracts bound:
    - `{mode:"untilStable"}` is refused with `web.scroll.until_stable_missing_max_scrolls`.
    - A valid `untilStable` and the `by`/`toElement` modes give no issues.
    - An unknown key or mode is still refused as `bootstrap.parameter_schema_mismatch`.
- `domain/src/output-nodes/tests/parameter-contracts.test.ts`: the expected contract set now includes the scroll node.
- `apps/extension/src/content/actions/tests/scroll.test.ts`: the refusal names the missing or invalid key (`maxScrolls`, `mode`, `until`) and no longer says "it names".

## Commands run and observed results

- `cd domain && DOMAIN_TEST_BUILD_LABEL=g3-scroll node scripts/test-domain.mjs actions/tests/scroll-request-issues output-nodes/scroll/tests output-nodes/tests/parameter-contracts output-nodes/extract/tests/parameter-contract client/tests/gateway-command-parameters actions/tests/schemas client/tests/targeted-scroll-request` gave "Web automation gateway command parameter tests passed." and `# pass 30 # fail 0`.
- `cd apps/extension && EXTENSION_TEST_BUILD_LABEL=g3-scroll node scripts/test-extension.mjs content/actions/tests/scroll` gave `# pass 7 # fail 0`.
- The same runs against the HEAD versions of `scroll.ts` and `parameter-contracts.ts` (temporarily restored, then put back) gave extension `pass 6 fail 1` and domain `pass 5 fail 3`.
- `npx tsc -p tsconfig.json --noEmit` and `npx tsc -p tsconfig.test.json --noEmit` both exited 0 in `domain` and in `apps/extension`.
- `node scripts/structure-audit.mjs` gave "structure-audit: passed (213 warning(s), 638 baselined)." None of the warnings are for the files changed here.

## Not verified

- No Lab, browser or live run.
- No full suites. Core was not rebuilt or edited.
- Exactly what the model sees for the new code in a live build is not verified. The test only checks that the feedback contains `max_scrolls`.
- A scroll written as Core's Run Output node (`builtin.policy.action` with a payload) is probably not held to the node contract. That was not checked.

## Open questions or contradictions found

- A contract can return codes only. The model therefore sees Core's fixed sentence ("Node parameter value does not satisfy its domain contract.") with the code `web.scroll.until_stable_missing_max_scrolls`. Core's code pattern allows only lower-case letters, so the key appears as `max_scrolls`, not `maxScrolls`. The accepted shape for the `scroll` parameter appears beside it.
- To have Core's own sentence name `maxScrolls` exactly, Core would need either to read a conditional schema keyword in `fit.ts` (for example `if`/`then` or `dependentRequired`) or to let a contract return a `{code, field}` detail. Either is a Core change and outside this brief.
