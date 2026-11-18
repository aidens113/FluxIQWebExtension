# No-key reply fix (t915)

## Outcome
Done.

## Cause
`interpret.ts` ran Core's word-matching fallback (`fallback.ts`) for every model failure. With no key the model call threw `secret_unavailable`, the fallback found no match and produced "I could not tell what you wanted done... such as run the kettle flow", and `respond.ts` `withProblem` then appended "(I read your message without the model, because no model key is set up yet...)". So the key instruction came second, behind an unrelated example.

## What changed
- `instructions/interpret.ts`: the two key-setup problems (no key; saved key needing one panel sign-in) are now named constants. When a call fails for either, interpretation returns a plain reply of just that sentence and does not run the fallback. Their separate wording is kept.
- `instructions/decision.ts`: optional `keySetup?: true` on the interpretation.
- `instructions/respond.ts`: `withProblem` adds no "read without the model" note when `keySetup` is set.
- `instructions/tests/interpret.test.ts`: two tests. A no-key message yields exactly `{kind:"reply", text:"No model key is set up yet, so add one in Settings, under AI keys."}`; a recovery-required key yields the sign-in wording.

## Commands run
- `pnpm --filter fluxiq exec vitest run src/runtime/conversations --minWorkers=1 --maxWorkers=4` -> 52 files, 383 tests passed (run before one typing fix to the test file).
- Re-ran `interpret.test.ts` alone after the fix -> 23 passed.
- `pnpm --filter fluxiq check` -> first run failed with TS2741 (test model lacked `name`); fixed; second run printed no errors (exit 0, not stamped because other workers were editing packages/fluxiq).
- `node scripts/structure-audit.mjs` in CORE -> "passed (550 warning(s), 914 baselined)"; no failures. It says 2 baseline entries can be lowered (not mine to run).

## Not verified
Not tried in the live panel. A confident word match with no key (for example "run the kettle flow") now also gets the setup reply rather than running, as the brief asks. A null model (nothing connected) still uses the old fallback path.

## Open questions
Whether keyless chat should still run confidently matched commands is a product call; reverting is a one-line condition in `interpret.ts`.
