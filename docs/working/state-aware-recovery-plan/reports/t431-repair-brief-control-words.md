# t431 — repair brief names the failed control by its own words

## Outcome

Done. Core tree `C:/Users/osrs_/FluxStuff/fxwork/t431/!FluxIQ`, branch `task/t431-repair-brief-control-words`, nothing committed.

## What changed and why

All paths under `packages/fluxiq/src/programs/automation-studio/runtime/`.

- `llm/model-facing/control-words.ts` (new): `automationStudioModelFacingControlWords(parameters)` is now the only place that works out a control's words. It reads the node's `element` (the identity resolved from the handle), then `target.fingerprint`, then `target`. In each it checks, in this order, `accessibleName`, `visibleText`, `label`, `name` and `placeholder`, and collapses whitespace. A field fails if its words trip the model-facing screen, and the next field is tried. If no field passes, the control has no words.
- `llm/model-facing/sayable-text.ts` (new): `automationStudioModelFacingSayableText`, the t426 screen moved out of `failure-text.ts` without changes. It rejects text with a locator shape, a word that names how a control was found, or a match score. It imports `../harness/locator-text.ts` directly rather than through the harness barrel, which avoids an import cycle.
- `llm/model-facing/failure-text.ts`: uses the shared screen. The `FINDING_WORDS` and `MATCH_SCORE` regexes moved, unchanged.
- `llm/model-facing/index.ts`: the barrel now exports both new files.
- `service/candidate-trial/feedback.ts`: its private `controlWords` copy is removed. It now calls the shared helper.
- `flow-bootstrap/script-statements/way-out-steps.ts`: its private copy is also removed. It keeps its 80-character cap in a local `boundedControlWords` wrapper around the shared helper.
- `recovery/context.ts`: the `failure` section now carries `control`, the failed node's words read from `flow.nodes[...].parameterValues`.
- `recovery/refuted-result/step-failure-brief.ts`: the brief adds the line `- The control it acts on, by its own words: "<words>".` only when the control has words. The header comment is also corrected: target resolution is now reported as a status and a count, with no scores.
- Tests:
  - New `llm/model-facing/tests/control-words.test.ts`, 4 cases.
  - New case in `service/runtime-adaptation/tests/step-failure-port.test.ts`: when the control's only "words" are locator-shaped (`#composer`), the brief names no control and contains no `data-testid`, `#composer`, `fingerprint` or `-0.12`.
  - The existing expectations were not changed.

## Commands run and observed results

- Core vitest over five directories: `runtime/service/runtime-adaptation`, `runtime/recovery`, `runtime/service/candidate-trial`, `runtime/llm/model-facing` and `runtime/flow-bootstrap/script-statements`. Result: `Test Files 78 passed (78)`, `Tests 938 passed (938)`.
- `pnpm run check` in `packages/fluxiq`: tsc finished with no errors.
- `node scripts/structure-audit.mjs` in Core: `structure-audit: passed (322 warning(s), 1160 baselined)`.
  - The first run reported a new import cycle: `way-out-steps` → model-facing barrel → harness barrel → `node-tools` → `flow-bootstrap`. It was fixed by importing `locator-text.ts` directly.

## Not verified

- No live run.
- No full suites.
- Other consumers of the trial feedback were not checked. Feedback `control` can now also come from `label`, `name` or `placeholder`, and from an authored `target`. Before, it came only from `element.accessibleName` or `element.visibleText`.

## Open questions or contradictions found

- The brief named one existing copy, but there were two: candidate-trial `feedback.ts` and `flow-bootstrap/script-statements/way-out-steps.ts`. Both now use the shared helper.
- The brief still lists `Parameters withheld from this brief: ["target","selector"]`. That is the denied key names from a step-parameters screen that was already there, not a locator value. I left it alone.
- The locator screen does not catch a tag-qualified class such as `div.composer`, and that gap is documented in `locator-text.ts`. A control whose accessible name is written that way would pass the screen as its words.
