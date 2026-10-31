# t799 w9-controlref

Outcome: Done.

## What changed and why
- `controlRef` is now stated everywhere as the parameters the pressing node runs with (web: `{ selector, element }`), not `{ target: controlRef }`. Supervisor's ladder-run.ts and trial.ts edits left as they were.
- Core tests updated: executor clear-interference.test.ts (CONTROL refs are `{ selector, element }`, assert `parameterValues` equals the ref), layer-handlers trial-close-chain.test.ts and trial-interruptions.test.ts (press definitions now take `selector`; handler press parameters asserted equal to the ref). Comments fixed in cleared-layer.ts, obstruction.ts, opaque-ref.ts, explored-interruptions.ts.
- No silent drop (explored.ts): all handlers are validated together first; if that fails each handler is added one by one to what earlier ones left, and only those the check refuses are left out. A plan valid without handlers is returned as given. New optional `dropped` out-array on the input receives `{ layer, code }` (layer = trial layer name, or press node id for an explored press; code = first error issue code). New files in layer-handlers: `dropped-handler.ts` (type), `dropped-handler-advice.ts` (one generic advice line naming layer and code, at most 5 named), both exported from the barrel. Wired in candidate/submission.ts (advice appended to existing advice). New test layer-handlers/tests/dropped-handlers.test.ts (4 tests: bad press dropped and named while the good one stays; all-refused returns the plan unchanged; advice wording; submission advice end to end).
- Docs: Core automation-studio.md (controlRef row, rung form), llm-flow-bootstrap.md (handler form, new dropped-handler bullet); regenerated docs/reference/framework-reference.md (public surface changed; the regeneration also picked up earlier t799 exports); downstream extension-client.md.
- Downstream: obstruction.ts comment; trial-close-handler.test.ts now validates the click with `parameters: CONTROL_REF` and asserts the lowered handler's press parameters deepEqual CONTROL_REF; control-ref.test.ts runs the click step with the `{ selector, element }` parameters (no `target` wrapper), two-layer case kept. resolve-plan-node.test.ts did not state the old form, untouched.

## Commands run and observed
- Core tsc: 0 errors (first run found 1 error in my new test, `node.parameters` possibly undefined; fixed, rerun clean).
- `pnpm test -- RT/executor RT/flow-bootstrap/layer-handlers RT/flow-bootstrap/candidate`: 160 files, 1256 tests passed; "all groups passed".
- Core `structure-audit`: passed (456 warnings, 1152 baselined).
- Core `contracts:build fluxiq:build`: built (84.6s), exit 0.
- Core `pnpm docs:check`: passed, "Deterministic framework reference is current." (after `pnpm docs:reference`).
- Downstream domain tsc and extension tsc: no output (0 errors).
- `test-domain.mjs output-nodes actions/tests`: 298 pass, 0 fail.
- `test-extension.mjs content/action-runtime`: 449 pass, 0 fail.
- Downstream structure-audit: passed (233 warnings, 616 baselined). model-text: ok.

## Not verified
- No headed/live run. Other suites (full vitest) not run, per the narrow-check rule.

## Open questions
- The per-handler fallback re-validates the plan once per handler when the combined check fails (N+2 validations); fine at current handler counts.
- docs/reference/framework-reference.md diff is larger than my own exports because it was already stale from earlier t799 work.
