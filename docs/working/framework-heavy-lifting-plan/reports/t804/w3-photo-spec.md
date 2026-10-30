# t804 W3: photo-social repair-from-step spec

## Outcome
Blocked by Core. The spec is written and builds a real `posts` part that fails at its second step, but two rules do not engage on the real project-build path. The spec fails at its first assertion that depends on them. I did not work around it.

## What changed
- New: `apps/extension/e2e/site-reset/tests/photo-repair-from-step.spec.ts`. No helper added. It is a two-subflow plan (`open`, `posts`) as in offline-first-photo. `posts` has `first` (grid read, record output) and `second` (navigate). v1 sends `second` to a path the site has no page at (HTTP 404), the repair navigates to the profile.
- First attempt used a never-drawn list handle for `second`. `core.submit_subflow` refuses it at submit as `web.handle.unknown`, so the failure had to be a run-time one (a 404).

## Commands run and observed
- Under the lock: Core libs rebuild (`pnpm --filter @fluxiq/contracts --filter fluxiq --filter @fluxiq/client-gateway-websocket build` in t804 Core: needed, the stale-build guard refused). Then `packages/test-contracts` build (its dist was missing). Both are build output only, no source edits.
- `pnpm test:e2e site-reset/tests/photo-repair-from-step.spec.ts` (headed), final run: 1 failed, 1.2m. Printed `{"repairFromStepCounts":{"wholeRuns":1,"fromStepRuns":0}}` (expected 2 and 1). The run printed 1 because the counter excludes `ok:false` answers.
- Observed calls and answers (sequence `submit-1, test-1, test-2, repair, submit-2, from-step, test-3`):
  - `test-1` (`core.test_subflow {revision:1,digest}`): `ok:false, verdict:"execution_failed"`, `feedback.stoppedBy` = step 6 "go back to the studio's profile", `web.navigation.unexpected`, HTTP 404. This works. It has **no `stoppedAtKey`** field anywhere in the answer.
  - `test-2` (the same call again at once): **not refused**. It ran a full second whole trial (new `trialRunId`, 10 site commands: navigate, read, navigate...), `retestsLeft` counting down. Expected `subflow.trial_from_step_first`.
  - `from-step` (`core.test_subflow {revision:2,digest,from:"second"}`): `{"ok":false,"code":"subflow.from_step_unavailable","instruction":"Core cannot run this part from a step here, so from is not taken. Test the whole part with the revision and digest alone."}`. No command reached the site.
  - `test-3` (whole, revision 2): `verdict:"yes"`, judged yes, brief completed, build `proposed`.
- `node scripts/check/model-text.mjs`: `model-text: ok (208 scenario tokens, 378 model-facing Core files, 11888 string literals)`.
- `node scripts/structure-audit.mjs`: `structure-audit: passed (232 warning(s), 616 baselined).`

## Likely Core causes (not investigated further, Core is off limits)
1. The live gateway project-build port a `core.test_subflow` goes through exposes no `fromStep` (the tool offers `from` only when the port has it, and answers `from_step_unavailable`). W1 said `port.fromStep` is on live ports and forwarded by `dispatch/trial-port.ts`; here it is not present.
2. The trial result has no `stoppedAtKey` for a multi-subflow `posts` (W1 sets it in `run.ts`), so W2's pending repair names no step. With no step named, any run that ends clears it, and that is probably why the second whole test was admitted.

## Not verified
- After my last spec edit (assertions changed to `verdict`, `stoppedBy.label`, `stoppedAtKey`) the Playwright run was not repeated: the lock queue is 1 to 2 hours and Core would still fail the same way. The edit is small but unexecuted.
- Whether the spec passes once Core engages the rule: untested past `test-3`. The from-step command assertions (`fromCommands` shorter than the whole run, no `extract_list`) are untested.
- No tsc of the spec beyond the extension build's own typecheck (it passed in the e2e build step).

## Open questions
- Is `fromStep` meant to exist on the gateway project-build port, or only on ports of another build path? If the scenario needs a different setup (e.g. a single-subflow plan), the brief should say.
