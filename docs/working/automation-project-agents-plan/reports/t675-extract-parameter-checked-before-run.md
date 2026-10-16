# t675: extract parameter checked before run (worker report)

## Outcome

Done. If a plan gives `web.dom.extract` a wrong `extract` value, Flow Bootstrap's plan validation now refuses it with a typed code, and the refusal includes the parameter's grammar and example (`accepted`). Core is unchanged.

## Where the check point is, and why there is no general schema path

- Core does not check action parameters against the domain's declared `parameterSchema`. The schema goes to Core only as `DomainOutputDefinition.schema` (`domain/src/io/manifest-definitions.ts`). Core's `io/index.ts` only compares it by JSON equality when it registers the output. Nothing validates node parameters against it.
- Before a run, Core's check is `runtime/flow-bootstrap/plan/validation.ts` `validateParameters`. That function:
  - checks each node parameter against the node definition's `valueType`, `options` and `constraints` (`parameterValueMatches`);
  - then asks a domain parameter contract, bound with `AutomationStudioNodeRegistry.bindParameterContract`, about each literal value.
- The domain already uses that contract hook for `web.dom.extract_list` (`output-nodes/parameter-contracts.ts`). The bundle passes these contracts to Core (`native-runtime.ts` `parameterContracts`).
- `plan/issue-feedback.ts` attaches `accepted`, the parameter's description and example, to any issue at `…parameters.<id>`. The model therefore sees what is allowed without any new Core text.
- A generic "validate every action against its JSON schema" check in Core would need a new schema field on `AutomationNodeParameter` and a JSON-schema evaluator. It would also be a Core contract change. The attribute rule (attribute required with mode `attribute`, refused with any other mode) cannot be written in the schema dialect used here, which has no if/then. So I took the existing domain-side contract path, which is already general across nodes. No Core files were edited.
- None of the Must-not-touch Core paths are involved.

## What changed and why

- `domain/src/output-nodes/extract/read-issues.ts` (new): `webAutomationExtractReadIssues(value)` returns these codes:
  - `web.extract.not_object`
  - `web.extract.unknown_key`: a key other than `mode` or `attribute`. The key list is a total record over `WebAutomationExtractRead`.
  - `web.extract.missing_mode`
  - `web.extract.unknown_mode`: also covers a mode that is not a string and a state-bound mode.
  - `web.extract.missing_attribute`: mode `attribute` with an absent, empty, blank or non-string attribute.
  - `web.extract.attribute_without_attribute_mode`
  - `web.extract.unreadable`: a fallback for when the dispatch reader `webAutomationExtractReadValue` refuses a value and no other code explains why. The reader stays the judge.
  - A state-bound `attribute` with mode `attribute` is accepted, because Core resolves it before dispatch.
  - The check is stricter than the reader in two ways: it refuses unknown keys and blank attribute names.
- `domain/src/output-nodes/extract/parameter-contract.ts` (new): `webAutomationExtractParameterContract` checks only `parameterId === "extract"`.
- `domain/src/output-nodes/extract/index.ts`: the barrel exports both new files.
- `domain/src/output-nodes/parameter-contracts.ts`: binds the new contract to the `web.dom.extract` node id beside the list extraction's. Because `native-runtime.ts` spreads this map, the bundle Core loads now carries it.
- `domain/src/output-nodes/tests/parameter-contracts.test.ts`: updated to say that exactly the two extraction nodes have contracts, including in the bundle.
- `domain/src/output-nodes/extract/tests/parameter-contract.test.ts` (new):
  - Each wrong shape gets its codes. There are 14 rows: unknown mode, non-string mode, no mode, attribute mode without/empty/blank/non-string attribute, attribute with text/html, undeclared key, bound mode, bare string, list, null.
  - Each right shape passes: text, value, html, attribute+href, attribute+bound attribute.
  - `options` and `selector` are not checked.
  - The code form is valid.
  - Through Core's real `validateAutomationStudioFlowBootstrapPlan` and `automationStudioFlowBootstrapIssueFeedback`, with the domain's nodes and contracts bound:
    - Every wrong shape is refused at `plan.subflows.0.nodes.0.parameters.extract`.
    - Non-objects get Core's own `bootstrap.invalid_parameter_value`.
    - The feedback carries `accepted.parameter = "extract"`, `accepted.description = WEB_AUTOMATION_EXTRACT_READ_GRAMMAR` (names every mode and the attribute rule) and `accepted.example = {"mode":"text"}`.
    - Right shapes, and a node with no `extract` (the legacy `options.mode` form), get no issue at `extract`.
- `docs/architecture/web-capabilities.md`: the "Extract attributes" row now describes the refusal codes and where they are checked.

## Commands run and observed results

- `cd domain && DOMAIN_TEST_BUILD_LABEL=t675 node scripts/test-domain.mjs output-nodes/extract/tests output-nodes/tests/parameter-contracts`: `# tests 10`, `# pass 10`, `# fail 0`. All six new tests and the four in `parameter-contracts.test.ts` passed, ok 1 to ok 10.
- `cd domain && npx tsc -p tsconfig.json --noEmit`: no output, exit 0.
- `cd domain && npx tsc -p tsconfig.test.json --noEmit`: no output.
- `pnpm structure:check` (downstream): `FAIL [working-docs] docs/working/README.md is out of date with the documents' header blocks. Run "pnpm structure:baseline" to regenerate it.` and `structure-audit: 1 violation(s) across 1 rule(s).`
  - Pre-existing and not caused by this change: I touched nothing under `docs/working/` except this report.
  - `docs/working/README.md` is a shared document, so I did not regenerate it.
  - No structure violation was reported for the new or changed source files; only advisory file-lines warnings on unrelated files.
- Core: no edits, so Core's typecheck and structure audit were not run. `git -C …/!FluxIQ status --short` printed nothing.

## Not verified

- No live or Lab run. I did not check whether a model given the refusal actually corrects its `extract`.
- The claim that an unread `extract` used to fall back to reading the element's text (or a field's value) comes from reading the code: the reader returns undefined and `content/action-runtime/extract.ts` takes `options.mode`. No browser run confirmed it.
- Neither whole package suite was run (by rule).
- Not checked: whether a Flow script's flat `extract.mode: text` form (which Core folds into `extract`) or `resolvePlanNodeParameters` reaches validation in a different shape. I tested the plan's parameter object directly.

## Open questions or contradictions found

- The `docs/working/README.md` index on this task branch is stale. The supervisor needs to run `pnpm structure:baseline`, or integrate dev, before `pnpm task finish`'s structure gate will pass.
- A bound `mode` is refused, and a bound `attribute` is accepted. That was my choice. Change it if the supervisor wants bound modes allowed.
