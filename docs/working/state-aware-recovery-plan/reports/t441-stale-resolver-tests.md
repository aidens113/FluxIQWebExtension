# t441 stale resolver tests: worker report

## Outcome

Done. Both tests pass. Neither test now measures less than it did before.

## What changed and why

### 1. `apps/extension/e2e/content/tests/selectors/tests/volatile-selector-replay.spec.ts`

The comparison row used the made-up anchor `consent-modal`. No element on the replay page carries it, so since t419, `identity/score.ts` sets it aside as "absent" in the same way it sets aside the regenerated token. Both replays then scored 0.926.

I found two more facts while working on this:
- The store generates every id it draws (`apps/scenario-lab/src/scenarios/everything-store/style/element-ids.ts`), so the replay page has no authored-looking **id** to use.
- The old row's `oldAddress.replace(recordedScrim, "consent-modal")` never changed the selector. The address holds the CSS-escaped form `#\:r13b8o\:`, so the unescaped `:r13b8o:` was not found and the selector came through unchanged. Only the `id` field differed.

The fix:
- A new helper, `anchorOnAnotherElement`, reads the replay page. It looks for a non-button element in `body` that carries one of the attributes `quoted-anchors.ts` treats as anchors (`id`, `data-testid`, `data-test`, `data-cy`, `name`). The value must be words and hyphens only, so no shape rule reads it as generated. The address built through it (anchor plus the old address's structural steps) must match nothing, so the replay is decided by scoring and not by a direct hit.
- The comparison descriptor changes only the selector's anchor. score.ts keeps that token, because some element carries it, and charges it against the button.
- The row's comment now explains this, including why `consent-modal` stopped working after t419. Header property 3 now says the comparison token is one another element really carries.
- The measurement annotation now names the anchor that was chosen.
- The assertion `generatedScore > authoredScore` is unchanged.

### 2. `apps/extension/scripts/test-extension.mjs` (the runner; the test file is unchanged)

The cause was in the runner, not the test:
- node:test starts the first test a file registers while that file is still being imported.
- The runner imports the bundles one after another with `await import(...)`, so `assertion-evaluation`'s tests ran while later bundles were being evaluated.
- Evaluating a bundle holds the event loop. I measured this with a 10 ms interval probe loaded with `--import`: in the batch, timers ran up to 3528 ms late (2924 ms on a second run). The failing test lasted 3370 ms against its 2000 ms window, so its 50 ms poll and its 120 ms timer could not fire until the window had already passed.

The fix is a root-level `before(() => loading)` hook. The promise resolves in a `finally` once every src bundle and script test has been imported, so no test starts until loading ends. A hook is not counted as a test, and the `finally` means a failed import cannot hang the run. The test still measures its wait against the real clock and polling loop, unchanged.

## Commands run and observed results

All commands were run from `C:/Users/osrs_/FluxStuff/fxwork/t441-stale-resolver-tests/apps/extension` unless noted.

1. Batch before the fix: `EXTENSION_TEST_BUILD_LABEL=t441 node scripts/test-extension.mjs src/content/action-runtime/tests/ src/content/identity/tests/ src/content/evidence/tests/ src/content/tests/`
   - Output: `# tests 342 / # pass 341 / # fail 1`, `not ok 2 - the wait is real ...`, `duration_ms: 3370.1479`, assertion `false !== true` at test line 51.
   - Running the same with the stall probe printed `worst timer lateness while running: 3528 ms`.
2. The same batch after the runner fix, with the probe:
   - Output: `exit 0`, `# tests 342 / # pass 342 / # fail 0`, `ok 2 - the wait is real ...` with `duration_ms: 184.9907`.
   - The probe printed 5643 ms of lateness. That stall now happens while files load, before any test runs.
3. `EXTENSION_TEST_BUILD_LABEL=t441 node scripts/test-extension.mjs scripts/` gave `# tests 19 / # pass 19 / # fail 0`. This covers the path with script entries only.
4. `EXTENSION_TEST_BUILD_LABEL=t441 node scripts/test-extension.mjs src/content/action-runtime/tests/assertion-evaluation` gave `# tests 7 / # pass 7 / # fail 0`.
5. `pnpm test:content -- volatile-selector-replay --headed --workers=1`
   - First attempt, which collected ids only: row 4 failed at `expect(contradictingId...).not.toBe("")`, because the store has no authored ids. This led to the anchor-attribute helper.
   - With the helper, the list reporter printed `4 passed (40.9s)`.
   - The final version (`body *`) with `--reporter=json` gave `expected: 4, unexpected: 0, flaky: 0, skipped: 0`. The annotation read: "pre-built address, generated token: succeeded (strategy fingerprint, best 0.926, candidates 1); same recording through [name="i"]: succeeded (strategy fingerprint, best 0.739)".
   - An earlier run that scanned the whole document chose `[name="viewport"]`, a meta tag, also scoring 0.739. I narrowed the scan to `body` so the anchor is page content.
6. `npx tsc -p tsconfig.test.json --noEmit` (includes `e2e/**/*.ts`): no output, exit 0.
7. Structure audit, from the worktree root: `node scripts/structure-audit.mjs` gave `structure-audit: passed (184 warning(s), 651 baselined).`

## Not verified

- I did not run the full extension unit suite (unfiltered `test-extension.mjs`), `pnpm check`, or the other e2e specs, following the twice-a-day full-suite rule. Other entries that do sync work at load time also benefit from the runner gate, but I did not run them.
- I did not re-run the spec without my change to watch it fail. The supervisor's 0.926 = 0.926 observation on dev is the baseline.

## Open questions or contradictions found

- The brief says the batch is 327/328 on dev; this worktree's batch has 342 tests. It is presumably a newer dev, or the count was taken differently.
- The anchor is chosen at run time. On the current store it resolves to `[name="i"]`, and a change to the store's markup could pick a different one. The helper fails loudly if none exists.
