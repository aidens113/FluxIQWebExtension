# t252-w7a-parity report

## Outcome

Done. Parity holds: on the same draft, the walker and the executor make the same calls in the same order. One
difference is Core-only and is named in the test: assembly writes parameter defaults onto plan nodes. No source file
was edited.

## What changed and why

One new file, in the Core tree `C:/Users/osrs_/FluxStuff/fxwork/t252/!FluxIQ`, left uncommitted:
`packages/fluxiq/src/programs/automation-studio/runtime/llm/node-tools/tests/replay-parity.test.ts`. The directory
now holds 24 files.

- **Draft.** Five `core.run_node` steps over the web fixture library (`webDomainNodeDefinitionsFixture`). The click
  is given an `item` input, as the domain's press declares it. The steps are:
  1. `dom-type` on `#search` with "blue towels".
  2. `dom-extract_list` (`records` is an array port).
  3. `dom-click` on `.request-confirm`.
  4. `dom-type` on `.request-note`.
  5. `dom-click` on `#done`.

  The draft is made general through the real `applyAutomationStudioFlowDraftAmendments`:
  - `repeat` step 3 through 4 over 2.
  - `bind` step 4 `text` to `{"$row":"name"}`.
  - `bind` step 1 `text` to `{"$input":"query","test":"blue towels"}`.

  The test asserts that all three amendments apply, and that the stored forms are `$state item.name` and
  `$state query` with fallback "blue towels".
- **Stored-Flow side.** It follows the build's completion path (`llm/harness-options/bootstrap-completion.ts`
  `fromDraft`):
  1. `assembleAutomationStudioFlowDraftPlan` with the proposed steps and `write: automationStudioFlowBootstrapDraftNodeStep`.
  2. `validateAutomationStudioFlowBootstrapPlan`.
  3. `normalizeAutomationStudioFlowBuildPlan` (the adaptation's materialisation) produces the primary Subflow's
     `graphFlow`.
  4. `canonicalFlowDocument` (from the `service/flows` barrel).
  5. `runAutomationStudioGraph`, with `AutomationStudioNativeNodeRuntime` fakes that record the node, the resolved
     parameters and `inputs.item`. The list answers 3 rows. No run inputs are given.
- **Walker side.** `replayAutomationStudioFlowDraft` runs with `nodeOf = automationStudioLlmNodeDescriptions({registry,
  resolution}).definition`, which is what `service.ts` passes. The fake `executeTool` answers the list with the same
  3 rows on `outputs.records` and records the node, `parameters`, `item` and `replay` of every step or pass call.
- **Case 1.** Both sequences equal one explicit expected list: the input step with "blue towels", then the list once,
  then for each row `click(item=row)` followed by `type(text=row.name, no item)`, then `#done` once. Every walker call
  is `replay: "step"`, the verdict is ok, and the trace succeeded.
- **Case 2.** The press declares `["modify_existing"]`. The whole compared sequence still matches. The walker sends
  the press as `replay: "verify"` once per row, with the same `{selector: ".request-confirm"}` and that row; the
  executor runs it once per row; every other walker call is a `step`.
- **Core-only keys dropped before comparing**, named in the header comment as `DEFAULTS_ASSEMBLY_WRITES`:
  `timeoutMs` and `recordOutput`. Assembly writes every omitted parameter that has a default onto the plan node
  (`flow-bootstrap/authoring/normalise.ts:144-150`, `materialiseDefaults`). So the executor's nodes carry
  `timeoutMs: 10000` on every node and `recordOutput: null` on the list, which the walker never sends. The keys are
  dropped on both sides, and only while they equal the definition's default, so any other value is still compared.
  The first run, before the drop, showed these keys as the only difference.

## Commands run and observed results

All commands ran from `packages/fluxiq` unless stated.
- `npx vitest run src/programs/automation-studio/runtime/llm/node-tools/tests/replay-parity.test.ts` printed
  `Test Files 1 passed (1)` and `Tests 2 passed (2)`.
- The same file with expansion disabled (`withNodes` default flipped to `false`, so no `nodeOf` reaches the walker),
  run twice, the second time on the final file, then restored:
  - Printed `Tests 2 failed (2)`, `→ expected [ { …(3) }, { …(3) }, { …(3) }, …(1) ] to deeply equal [ { …(3) }, { …(3) }, { …(3) }, …(6) ]`.
  - The walker made 4 calls: the input, the list, the press once with no row, and `#done`. The row-bound note was
    never sent, because it is unresolved without a row. The executor made 9 calls.
- `npx vitest run src/programs/automation-studio/runtime/llm/node-tools` printed `Test Files 24 passed (24)` and
  `Tests 203 passed (203)`.
- `bash C:/Users/osrs_/FluxStuff/build-slots/heavy.sh "t252 w7a tsc" npx tsc --noEmit -p .` printed
  `[heavy] t252 w7a tsc holds b1`, no diagnostics, exit 0.
  - An earlier run had failed with TS2379 (`AutomationStudioFlowArtifact` is not an `AutomationStudioFlowDocument`).
    The fix was to wrap the graph in `canonicalFlowDocument`.
- `node scripts/structure-audit.mjs` (Core root) printed `structure-audit: passed (239 warning(s), 349 baselined).`
  - An earlier run had failed `[imports]` because of a direct `service/flows/canonical-document.ts` import, which is
    now replaced by the `service/flows/index.ts` barrel.

## Not verified

- I did not run any live or domain-side code. The domain's real replay (`outputs.records`, item scoping) is faked
  here.
- The executor runs only the primary Subflow's graph; the Router is not run, because a draft has one Subflow.
- Only the list-span path is covered. The while span (`repeat` over a check) has no parity case.
- `$step` bindings (P5) are not covered.

## Open questions or contradictions found

- **Default parameters.** The walker replays a step without the defaults that assembly writes into the stored Flow,
  so the domain sees `timeoutMs` absent in the test but present (10000) in the stored run. This only affects
  behaviour if the domain's own default differs from the Core definition's default. I treated it as Core-only and
  did not count it as a defect.
- **Untracked files I did not create.** `git status` also shows modified `docs/architecture/README.md` and
  `llm-flow-bootstrap.md`, plus untracked `docs/architecture/automation-studio/flow-authoring.md` and
  `runtime/tests/service-authoring/`. They are probably from another worker (w7b or P4); I did not touch them.
