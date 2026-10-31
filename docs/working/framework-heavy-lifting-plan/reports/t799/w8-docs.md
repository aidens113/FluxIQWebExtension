# t799 w8-docs

## Outcome
Done. Docs only; no code, tests or other working docs touched.

## What changed and why
Core `docs/architecture/`:
- `automation-studio.md`: cleared-layers table (generic kinds, `id`, `controlRef`, `wayOutDefinitionId` kept beside a token or a `controlRef`); new paragraphs "Obstruction" and "The `clear_interference` rung presses the obstruction" (no failed card on its retry); handler step 2 now says `obstruction` fact (when the layer had an `id`) else `dialog`, keyed by `id ?? name`; Pace bullet gains the unhinted rate limit (x1.5, 1 s floor, 60 s cap) and Core writing `paceMs` via `learned-paces.ts`.
- `automation-studio/client-gateway.md`: `interference` recovery wording (generic kinds; the rung's failed "Tried to close" row, no failed card on retry).
- `automation-studio/llm-flow-bootstrap.md`: trial-close handlers (`learnedFrom: "trial_close"`); look-time `control` / `ensureState` and `ensureState` in place of the `idempotentWith` refusal; learned pace written at the next submission.

Downstream `docs/architecture/`:
- `extension-client.md` (Learned Interruption Handlers): generic wire kinds, layer `id`, `controlRef` form, `obstruction` and its ways out and intents, rate-limit obstruction.
- `web-capabilities.md`: `obstruction` fact (alias of `dialog`); new "look at a stateful control answers `control`" bullet after the trial-press toggle bullet.
- `page-evidence.md` (near line 751): note that the Core wire uses the generic words.
- `testing-facility.md`: not changed (its `clearedLayers` line names no kind words).

## Commands run and observed results
- Core `pnpm docs:check` (under heavy-check.lock): `structure-audit: passed (0 warning(s), 0 baselined).`, `Deterministic framework reference is current.`, EXIT 0.
- Downstream `node scripts/structure-audit.mjs` (under the lock): `structure-audit: passed (233 warning(s), 616 baselined).`, EXIT 0.
- Waits on the lock were under two hours. My first combined run's output file was lost, so I re-ran both with output redirected.

## Not verified
- Prose checked against the worker reports only, not the code.
- `web-capabilities.md` still has the older "One gap is known" paragraph about `promotion`/`assistant` classifiers, which is unchanged and still true.

## Open questions or contradictions found
- w5 noted `obstruction` is not yet in `WEB_AUTOMATION_FACT_KINDS` (`domain/src/runtime/capabilities.ts`); the docs say the fact is answered, not that it is declared.
