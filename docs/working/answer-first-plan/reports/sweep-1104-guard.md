# sweep-1104-guard

## Outcome
Done. audit-asked-changes and run-attempt-proof's site-only session now launch through launchGuardedPersistentContext.

## What changed and why
- New `packages/test-runner/src/attempt-lane/open-guarded-lab-tab.ts` (`openGuardedLabTab({origin, token})`): one headed Chromium (channel chromium, withoutProviderSecrets, en-US, UTC, 1280x720), own mkdtemp profile under OS temp removed on close, policy = Lab origins (`scenarioNetworkOrigins`) + `scenarioLabOriginProof`, no FluxIQ/gateway origins. Each tab keeps the old per-tab isolation.
- `audit-asked-changes.ts`: `playHonestPath` no longer takes a `Browser` (only caller updated); opens a guarded tab per task; guard violations become stoppedAt "network-guard". Browser launch/close removed from `auditAskedChanges`.
- `run-attempt-proof.ts` `siteOnlySession`: `openTab` opens a guarded tab, remaining tabs closed in `close()`. Real-chat session untouched (already guarded).
- The containment test and SANCTIONED list are untouched.

## Commands run
- `pnpm.cmd --filter ...test-runner check` and `build`: both refused: Core's build is stale ("would rebuild fluxiq:build ... packages/fluxiq"). I did not rebuild or touch Core. Instead `npx tsc -p tsconfig.json --noEmit` in packages/test-runner -> exit 0, then `npx tsc -p tsconfig.json` to emit dist.
- `node --test dist/guarded-browser/tests/launch-containment.test.js dist/attempt-lane/tests/attempt-series.test.js` -> 10 pass, 0 fail (re-run after final edits).
- `node scripts/structure-audit.mjs` -> passed (234 warnings, 553 baselined). First run had 5 failures in my new code (failure-as-empty, statement-packing), fixed.
- `node dist/attempt-lane/audit-asked-changes.js --scenario job-board` (headed, provider-free, no paid call): opened the site through the guard; tasks printed stoppedAt null, agreesWithTable true; no guard block seen in the output I read (first ~1500 chars: 8 tasks). I did not read the final summary line.

## Not verified
- The `pnpm check` gate itself (blocked by stale Core; needs Core libs rebuilt).
- run-attempt-proof was not run; its site-only openTab is compiled and type-checked only.
- Whole audit output after the first 8 tasks.

## Open questions
- Core libs need rebuilding in the t867 Core worktree for pnpm check/build to pass.
