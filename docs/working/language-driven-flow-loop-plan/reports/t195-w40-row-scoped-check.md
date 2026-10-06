# t195-w40: row-scoped check resolves through the record gate

## Outcome

Done, with one deviation: `pnpm --filter @fluxiq-web-extension/extension check` refused to run because the shared Core worktree's dist is stale. The check's own body (`node scripts/check-extension.mjs`: both tsc projects plus the in-memory bundles) was run directly and exited 0.

## What changed and why

- `apps/extension/src/content/actions/assert.ts`
  - `assertionTarget` hands over the bare selector only when the action is **not** row-scoped: `if (action.selector && !scopedToRow(action))`. A row-scoped assert falls through to the existing branch: `deps.resolveTarget(action)` gives `{ element }` plus `resolution`, and a throw gives `{}`, which the evaluator reports as "nothing matched", a wait in vain.
  - New `scopedToRow(action)` returns true when `action.element` or `action.options?.element` has `context.record.values` as a non-empty array. These are the same two places `recordedShadowHosts` reads.
  - The doc comment on `assertionTarget` now explains the exception and cites `run-musp474o-e0ed7432`. Every pass checked the template card's Confirm, so the pass for Amara Osei's row said "visible and enabled" after that row's Confirm was already gone.
  - Every other assert is unchanged: an unscoped selector, a key-only record, or an empty `values` list still goes to `{ selector, shadowHosts }`.
- `apps/extension/src/content/actions/tests/assert.test.ts` gains three tests:
  - **Row-scoped check:** for both `element` and `options.element`, `resolveTarget` is called exactly once with the command, and the evaluator gets `{ element }`.
  - **resolveTarget throws:** the evaluator gets `{}`.
  - **Unscoped checks:** these use no element, a record with only a key, or `values: []`. They never call `resolveTarget` and still hand over the selector.
- `apps/extension/src/content/action-runtime/tests/resolve-target.test.ts` (additions only):
  - **Coverage check:** neither this file nor `wrong-row-resolution.test.ts` covered `values` end to end through `resolveTarget`. `identity/tests/record.test.ts` only covers `agreesWithRecordedRecord` one candidate at a time.
  - **New stub page:** three invite cards (`li.invite`). Jonah Weiss and Amara Osei each have a Confirm button. Lena Park's card says "Accepted" and has no Confirm. The recorded selector names Jonah's Confirm.
  - **Test 1:** values of Amara's card resolve Amara's Confirm, not Jonah's. A control in the same test sends the same command with `values: []`; it resolves Jonah's Confirm by strategy `selector`, which shows the values decided the result and the stub did not.
  - **Test 2:** values of Lena's card throw `web.target.not_found`, and the message says "in another record".
  - Both tests passed when first run. The resolver already behaves this way; these tests add coverage and fix no defect.

## Commands run and observed results

All test commands ran from `apps/extension` via `node <scratchpad>/t195-run-ext-tests.mjs t195-w40 ...`.

1. **Failing first:** `... src/content/actions/tests/assert.test.ts`, run after adding the tests and before changing `assert.ts`, gave `# tests 12 # pass 10 # fail 2`:
   - `not ok 10 - a row-scoped check resolves its target through the record gate, never the bare recorded selector`, error "the check must resolve the row's control as the Flow's click does / 0 !== 1".
   - `not ok 11 - a row-scoped check whose row holds no such control is asked of nothing, which waits in vain`, error "0 !== 1".
   - The unscoped test (12) passed.
2. **After the change:** the same command gave `# tests 12 # pass 12 # fail 0`.
3. **resolve-target.test.ts additions:** the first run gave `# tests 12 # pass 12 # fail 0`.
4. **Both files after the control assertion:** `... src/content/actions/tests/assert.test.ts src/content/action-runtime/tests/resolve-target.test.ts` exited 0 with `# tests 24 # pass 24 # fail 0`.
5. **Extension check:** `bash C:/Users/osrs_/FluxStuff/build-slots/heavy.sh "t195 w40 ext check" pnpm --filter @fluxiq-web-extension/extension check` exited 1 before typechecking. The cause is `scripts/check/core-build.mjs`: "FluxIQ Core's build at ...fxwork\t195\!FluxIQ is 30 minute(s) behind its source. Stale: ...runtime\llm\step-log\scope.ts". I did not rebuild Core because Core is outside my brief.
6. **Check body run directly:** `bash C:/Users/osrs_/FluxStuff/build-slots/heavy.sh "t195 w40 ext typecheck" node scripts/check-extension.mjs`, run from `apps/extension`, exited 0 with no diagnostics. This ran tsc on `tsconfig.json` and `tsconfig.test.json`, then the in-memory browser bundles.
7. **Structure audit:** `node scripts/structure-audit.mjs`, run from the tree root, printed `structure-audit: passed (165 warning(s), 118 baselined).` and exited 0.

## Not verified

- **Typecheck against the stale Core:** it ran against Core's dist as it was built, which is 30 minutes behind Core source. My change uses no Core type, so this is unlikely to matter. The supervisor should still rerun `pnpm --filter @fluxiq-web-extension/extension check` after Core is rebuilt.
- **Live browser:** no live run of a repeated row-scoped check was made. The resolver path was exercised only on a Node stub DOM.
- **Full suites:** not run, per the brief.

## Open questions or contradictions found

- The brief cites `identity/record.ts` under `action-runtime/`. It actually lives at `apps/extension/src/content/identity/record.ts`.
- A row-scoped `exists` or `visible` check whose row lacks the control now waits out its window and reports TIMEOUT, because the evaluator never judged it. `absent` holds immediately. This matches the brief ("a wait in vain"). A Flow that checks "Confirm is gone for this row" should use `absent`.
