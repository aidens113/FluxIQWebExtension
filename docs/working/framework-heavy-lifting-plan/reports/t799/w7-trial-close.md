# w7 trial-close (Partial)

## Outcome
Partial. Two test files were written but never run. The lock-wrapped test command was still queued behind another agent's `heavy-check.lock` when I stopped. tsc, the structure audit and the cause trace were not done.

## What changed and why
- Appended a describe block to `RT/executor/node-execution/tests/cleared-layers.test.ts`. It checks that definition and controlRef are kept without a wayOut token. It also checks that controlRef is never kept without a definition, and that a definition with an unusable controlRef and no token is dropped.
- New `RT/flow-bootstrap/layer-handlers/tests/trial-close-chain.test.ts`. It runs the full chain: payload (kind overlay, id `layer:3f9a1c2e`, name, wayOut token, definition, nested controlRef), then `automationStudioClearedLayersOf`, then a trial attempt, then `AutomationStudioExploredInterruptions.trial()`. It then asserts the recorded list, calls `automationStudioCandidateExploredLayerHandlers` directly, and goes through `AutomationStudioFlowCandidateSubmissionController.submit`. The assertion is an `obstruction` handler by the layer's name pressing the definition with `{ target: controlRef }`.

## Cause
Not found by running. Reading the code, the only drop I could confirm was the one the supervisor already fixed: `pressedBy` in `cleared-layers.ts` (around lines 70-80) dropped the definition and controlRef when no wayOut token came.

The silent `return input.buildPlan` in `layer-handlers/explored.ts` (when `!validation.ok`) remains a plausible second cause. I did not add a trace or advice for it, so that fix is outstanding.

The existing test `layer-handlers/tests/trial-interruptions.test.ts` already covers the `obstruction` fact with a simple id, so the fact and `requires` are probably fine.

## Subflow path
Not checked. From grep, `automationStudioCandidateExploredLayerHandlers` is called only in `candidate/submission.ts:269`. `subflow-candidate` does not call it. Project builds route through `service/project-build/brief-ports.ts:346` with the shared `exploredInterruptions`. Whether the subflow submission applies the handler needs confirming.

## Commands run
`pnpm test -- <layer-handlers dir> <cleared-layers.test.ts>` wrapped in the lock loop. Result: no output, still waiting on the lock at 17:00. The command was moved to the background and never finished.

## Not verified
Everything. The new tests may fail or have type errors, and tsc and the structure audit were not run.

## Open questions
- Who holds `heavy-check.lock` (taken 16:53)?
- Is the silent validation fallback the real cause?
