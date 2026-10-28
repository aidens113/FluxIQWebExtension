# t770-D2 detour oracle

## Outcome
Done. `copiedDetourActs` and `CopiedDetourAct` exist in `packages/test-runner/src/flow-lane/creation/detour/` and are re-exported from `creation/index.ts`.

## What changed and why
- `detour/copied-detour-act.ts` is the `CopiedDetourAct` type. `detour/copied-detour-acts.ts` is `copiedDetourActs`. `detour/index.ts` is the barrel.
- Private helpers, one per file: `act-node-definitions.ts` (operation to node definition), `node-labels.ts`, `node-values.ts`, `normalized-text.ts`.
- `detour/tests/copied-detour-acts.test.ts` has 6 tests: clean Flow gives []; click on "Orders" (case and space insensitive) gives one hit; same label under a type node gives none; a node whose id sits in a subflow gives a hit; value mismatch gives none and a match gives a hit; read/snapshot nodes and a node with no readable target give none.
- One line added to `creation/index.ts`: `export * from "./detour/index.js";`.

## Node-kind mapping
The mapping is click -> `web.output.dom-click`, type -> `web.output.dom-type`, select -> `web.output.dom-select`, check -> `web.output.dom-check`. I added check beyond the brief because a filter checkbox is a click-like detour.

Source: the `web.output.dom-*` ids the domain registers and uses (`grep` of `domain/src`), and the `definitionId` values in `flow-lane/creation/tests/authored-graph.test.ts`. Every other operation (navigate, scroll, extract, press and so on) maps to nothing, so it never matches. This also means read, extract and snapshot nodes never match.

Matching rules:
- Target: normalized (trim, collapse whitespace, lowercase) equality against `parameterValues.element` and `parameterValues.target.element` / `.fingerprint`. Fields checked are `visibleText`, `text`, `label`, `accessibleName`, `attributes["aria-label"]` and `attributes.title`. The field names come from `domain/src/element-fingerprint/build.ts`.
- Value, only when the act names one: equals `parameterValues.text`, `.value`, or `.option.label` / `.option.value`.
- An act with no target never matches, and a node with no readable target never matches.

## Commands run and observed results
- `node ../../scripts/build-cache/cli.mjs test-runner:build` from `packages/test-runner` built (stored 2342 files, 234s).
- `node --test dist/flow-lane/creation/detour/tests/copied-detour-acts.test.js` printed `tests 6 / pass 6 / fail 0`.
- `pnpm --filter @fluxiq-web-extension/test-runner check` ran tsc with no error output. The tail ended at `{"build-cache":"build","step":"test-runner:check",... "source":"command"}`, and the step was not stamped because inputs changed while it ran (another worker is editing).
- `node scripts/structure-audit.mjs` printed `1 violation(s) across 1 rule(s)`, the file-lines warnings aside:
  `FAIL [imports] packages/test-runner/src/flow-lane/creation/recorded-evidence/recording-set-change.ts: ... "../../../run-scenario/core-round-trip/recording-ids.js" at line 2`.
  That file is not mine, so it is another worker's in-progress file. My `detour/**` files produced no violation or warning.

## Not verified
- `graphId` is never set. `readCreatedFlowGraph` flattens parent and subflow nodes into `FlowNodeRecord[]` with no graph id, so the subflow test only shows that all nodes are scanned. The field is optional in the type.
- Not run against a real built Flow, only synthetic graphs. The exact location of `element` in `parameterValues` was inferred from the domain comments (`parameters.element`), not from a live Flow document.
- Full test-runner suite not run.

## Open questions
None blocking.
