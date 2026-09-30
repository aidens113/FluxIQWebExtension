# t174-w2 — `run-munaiz76-7026748c`: why the dry-run replays say `core.replay.unreproducible`

## Outcome

Done. The cause is named at the level of file, line and value. A focused failing test was added for a defect in the criterion that the debug exposed. The full six-stage debug is at `docs/working/language-driven-flow-loop-plan/debugs/run-munaiz76-7026748c.md`.

## What changed and why

- **Added** `docs/working/language-driven-flow-loop-plan/debugs/run-munaiz76-7026748c.md`: the six-stage debug.
- **Added** `domain/src/runtime/llm-evidence/node-run/tests/replay-ambiguous-target.test.ts`: two tests. The first fails today. It asserts that a replayed step whose target is now ambiguous (`web.target.ambiguous`) answers `core.replay.failed`, not `unreproducible`. The second is a passing control: an absent target stays `unreproducible`.
- No product code was changed.

### Findings

1. **Where the code is produced and the exact criterion.** Core only reads the code (`!FluxIQ .../runtime/llm/node-tools/replay.ts:53`). The web domain produces it, and a step replays `unreproducible` only through this chain:
   - The extension answers the replayed click with failure code `web.target.not_found`.
   - `domain/src/runtime/llm-evidence/action-failure/refusal.ts:47` maps that code to the refusal word `target_not_found`.
   - `domain/src/runtime/llm-evidence/node-run/replay.ts:205`, `const unreproducible = failure === "target_not_found"`, then answers `core.replay.unreproducible` (`:213`) with the page it broke on.
2. **What the ~6 s is.** It is the extension's recovery defence, not a domain or Core timeout.
   - `web.target.not_found` is the fault `target_absent` (`apps/extension/src/content/action-runtime/recovery/fault.ts:91`).
   - Its ladder is `RECOVERY_TARGET_BACKOFF_MS = [250, 500, 1_000, 2_000]` (`recovery/budget.ts:44`), inside `RECOVERY_BUDGET_MS = 5_000` (`budget.ts:63`): five attempts and 3.75 s of pauses. `recovery/attempt.ts:81-88` then returns the last attempt's own failure.
   - On top of that come target resolution for each attempt, the gateway round trip, and `answerWithPage`'s page capture. A successful replayed click costs about 1.0–1.3 s in this run, so the extra ~5 s is the defence.
3. **Steps 3 and 6 are `dismiss1` and `continue1`.** Positions are derived, and the derivation is exact:
   - Every call, including the rejected free first look and requests the loop answers itself, appends a step at `draftSteps.length + 1` (Core `llm/evidence-loop.ts:256`, `:391`, `:429`, `:500`, `:769`).
   - Only `reorder` renumbers (`flow-draft/amendment.ts:250`).
   - That numbering reproduces every dry-run step list in the trace: 2,3,4,5,6,14,18,20 in attempt 1; then +25,26; then 25,27,28,29; then +30.

   The fixture explains the absences. The store remembers the answers server-side:
   - consent and notifications: `state/types.ts:80-81`, `guard-ops.ts:27-29`;
   - the soft check: `types.ts:68`, `guard-ops.ts:46`.

   The pages then stop serving those controls: the consent banner via `pages/shell.ts:25`, the soft check via `route.ts:49`. The replay's reset is a page navigate only (`node-run/replay.ts:66,125`), so both controls are absent on replay. The dismissed prompt is either the notifications "Not now" or the cookie banner; the bundle does not say which.
4. **This was not why the build never finished.** Core asks about `unreproducible` only once:
   - `llm/node-tools/dry-run-gate.ts:95` adds the outcome to `asked`;
   - `flow-draft/dry-run.ts:176-183`: an outcome in `asked` no longer blocks.

   So steps 3 and 6 blocked attempt 1 only. Decision 47's `complete` ran no dry run. The gate skips a replay only when `signature === cleanSignature` (`dry-run-gate.ts:72`), which is set only on an `ok` verdict (`:98-100`), and the draft did not change between 46 and 47. That proves attempt 4 replayed clean. Completions 2 to 5 were refused by `checkAutomationStudioFlowBootstrapCompletion` (Core `runtime/service.ts:1574`), with issue codes the run did not log.
5. **Criterion defect, separate from this run.** `refusal.ts:48` also maps `web.target.ambiguous` to `target_not_found`, so an ambiguous target is `unreproducible` and Core lets it through after one question. The new test reproduces it. This run's two steps were genuine absences: the absent-target ladder is what costs 6 s, and an ambiguous target is not retried (`failure/codes.ts:174`, `retryable: false`).

### Minimal fixes

- **For this run's non-acceptance (the real blocker).** There is nothing to change in the unreproducible path. Read the completion check's issue codes on the next live run. The `completion check ok=… issues=…` line is already in Core `llm/evidence-loop/progress-trace.ts`, which is untracked and was written at 23:35Z, after this run.
- **For the criterion defect.** In `domain/src/runtime/llm-evidence/node-run/replay.ts:205`, decide `unreproducible` from the client's failure code, not the merged refusal word:

  ```ts
  const unreproducible = result.failure?.code === WEB_AUTOMATION_FAILURE_CODES.TARGET_NOT_FOUND;
  ```

  The owning file is `node-run/replay.ts`. `refusal.ts` stays as it is, because the live-run path legitimately treats both codes the same way.
- **Optional cost fix.** Core `llm/node-tools/replay-draft.ts` re-replays steps already in `asked` on every attempt. That cost 48.9 s of wall clock in this run (4 attempts × about 12.2 s).

## Commands run and observed results

- Build-trace read: `cut -c1-800 .../run-munaiz76-7026748c/logs/core.log`. 255 lines. Every `dryrun.N.3` and `dryrun.N.6` line reads `resultCode=core.replay.unreproducible` in 6064–6166 ms, and every other step `core.replay.replayed`. Decision 47 `kind=complete` is followed directly by `decide start iteration=48`, with no `dryrun.5.*` line.
- The two replay test files were bundled with the domain test script's own esbuild options, into `domain/.test-build-scratch/t174-w2` (removed afterwards), and run with `node --test --test-concurrency=1`:
  - `replay-ambiguous-target.test.mjs` printed `not ok 1 - a replayed step whose target is now ambiguous is failed, not unreproducible`, with `expected: 'core.replay.failed'` and `actual: 'core.replay.unreproducible'`, then `ok 2 - a replayed step whose target is absent stays unreproducible`, and `# tests 2 # pass 1 # fail 1`.
  - `replay.test.mjs` (existing) printed `# tests 8 # pass 8 # fail 0`.
- `npx tsc -p tsconfig.json --noEmit` in `domain` exited 0. `npx tsc -p tsconfig.test.json --noEmit` exited 0.
- `node scripts/structure-audit.mjs` printed `structure-audit: passed (114 warning(s), 120 baselined).`, exit 0.

## Not verified

- **Which prompt `dismiss1` pressed, and all step parameters.** The bundle has no draft, and the Core store was deleted.
- **The completion check's issue codes for iterations 29–47.** They were not logged.
- **The exact split of the ~6.1 s.** The recovery account is not in `core.log`.
- **Whether `saveforlater1`'s later `replayed` answers acted on a different cart line.** This is a hypothesis.
- **Stage 5 finalState.** It is by reasoning only; no Flow ran.
- **The full domain suite.** `pnpm --filter @fluxiq-web-extension/domain test` was not run, to avoid rebuilding the shared `.test-build/`. Only the two replay files were run.
- **No live run was made.**

## Open questions or contradictions found

- **The brief's framing does not match the trace.** It implies that `unreproducible` steps 3 and 6 kept completions from being accepted. By Core's own rule they blocked attempt 1 only. The trace proves attempt 4 was clean (decision 47 skipped the replay), so the four later refusals came from the completion check, whose codes are unrecorded.
- **The dry run re-applies lasting cart actions** (`addkettle1` ×3, `saveforlater1` ×2) against server state that a page reset does not restore. `replay.ts:9-17` acknowledges this limit. It does not corrupt the Lab's judged state, because the Lab resets fixture state before the Flow run. It does mean replay verdicts on lasting acts are taken against an already-changed cart.
- **Stage 5 reasoning suggests an accepted Flow would still fail `extract-cart`.** The draft has no quantity select and no Save-for-later "Try again", and the Lab's reset re-arms `saveGlitch`.
