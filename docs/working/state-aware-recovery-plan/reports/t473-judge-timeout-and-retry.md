# t473 judge timeout and retry: worker report

Worktree: `C:/Users/osrs_/FluxStuff/fxwork/t473/!FluxIQ`, branch `task/t473-judge-timeout-and-retry`. Nothing committed. The downstream worktree is unchanged except for this report.

## Outcome

Done. All three items are built and tested:

1. The build's judges get the build's per-call timeout.
2. A judge call that timed out, or hit a temporary provider fault, is asked again.
3. A trial whose judge could not answer is judged again on the same evidence instead of being re-run.

## Cause, as verified in source

- **The judges got the 20 s default.**
  - `service/flow-bootstrap-commands/build-judge.ts:119-122` built the judge without a timeout.
  - `service.ts:1562` built the candidate path's judge without one too. The debug run used that path.
  - `result-verification/build-test/judge.ts:187` called `verify` without `timeoutMs`.
  - `llm/harness/run.ts:43` falls back to `AUTOMATION_STUDIO_LLM_DEFAULT_TIMEOUT_MS = 20_000` (`llm/provider-contract.ts:111`).
  - Build decisions get `unresolvedProvider.timeoutMs`. That is 45,000 from `session-key-provider.ts` (`timeoutMs: defaults.timeoutMs`). See `service.ts` lines 1570, 1634 and 1668, and `service/instruction-authority.ts:123`.
  - Those two judges were the only build-path model calls without it. Confirmed.
- **A timed-out call was never asked again.**
  - `verify.ts` made the second call only when `automationStudioResultVerificationAskAgain` holds. That requires `basis === "model"` (`agreement.ts:33`).
  - `provider-retry/decision.ts:46` (`NEVER_ASKED_AGAIN`) never re-sends `llm.provider_timeout`, leaving it to "the loop above". For the judge, nothing above re-asked. Confirmed.
- **Why the default retry policy cannot simply be widened.** With a 45 s timeout, a harness-level re-send could never fit. `limits.ts` caps one call at `maxCallMs: 60_000`, and 45 + 1 + 45 s is more than 60 s. So the re-ask lives in `verify`, the loop above, as the policy's own comment intends.

## What changed and why

**Core source**, all under `packages/fluxiq/src/programs/automation-studio/runtime/`:

- `result-verification/verify.ts`
  - New `AUTOMATION_STUDIO_RESULT_VERIFICATION_ASKS_PER_CHECK = 2`.
  - New `askCheck` asks a check again when its call gave no reply because of a fault the adapter called temporary. That covers a timeout, or a 429/5xx that outlasted the harness's own retries. "Temporary" means the harness diagnostic's `metadata.retryable === true`.
  - It does not re-ask when the signal is aborted, at most 2 asks per check.
  - A purse refusal, an unreadable reply and an untyped throw carry no `retryable` flag, so they are not re-asked.
  - Every ask's intervention is recorded with a unique id. Re-asks carry `metadata.verificationAsk`.
  - This applies to every verification, including the runtime result check, under the "every call retries" rule.
- `result-verification/deadline.ts`
  - New `automationStudioResultVerificationDeadlineMs(timeoutMs)` = max(120 s, 4 × timeoutMs + 30 s). That is 210 s at 45 s.
  - It imports the asks constant from `verify.ts`. No import cycle.
- `result-verification/build-test/judge.ts`
  - New `timeoutMs` dep, forwarded to `verify`.
  - The deadline defaults to the size above.
  - An outcome with `basis: "model_unavailable"` (no call came back usable) is now `not_judged`, not `unknown`. Its `why` is the verdict's own cause sentence first, because the chat shows only the first 160 characters. Then: "The judge was asked N times with the same evidence and could not answer, so the test was not judged; this is not a finding about the Flow."
  - Header updated.
- `service/flow-bootstrap-commands/build-judge.ts`: new `timeoutMs` input, passed to the judge.
- `service.ts`, required, same lines, no line added: both judges get `timeoutMs: unresolvedProvider.timeoutMs`. That is the source every build decision already reads.
- `service/candidate-trial/run.ts`
  - The judging tail is factored into `judged()`.
  - A trial whose judge verdict is `not_judged` returns its evidence as `unjudged`: summary, shown, start and paces.
  - New `rejudgeAutomationStudioCandidateTrial` asks the judge again on that evidence. It runs nothing and returns no `acts`. It keeps the original `trialRunId`, records `judgedAgain: true`, and adds a `feedback.judgedAgain` sentence.
  - A trial whose result could not be read (`candidate.trial_result_unreadable`) is not kept: its evidence is not intact.
- `service/candidate-trial/port.ts`
  - Keeps the unjudged evidence per revision and digest.
  - The next request for that revision is judged again instead of run. A judged verdict drops the kept evidence, so a later test runs the trial again.
- `service/candidate-trial/contracts.ts`: new type `AutomationStudioCandidateTrialUnjudged`, and an optional `judgedAgain?: true` on the record.

**Core tests**, beside their subjects:

- New `result-verification/tests/verify.test.ts`, 7 tests:
  - a timeout re-asked on the same evidence;
  - a 503 that outlasted the harness's 3 attempts, re-asked (fake timers);
  - the second check re-asked;
  - at most 2 asks, with two timeouts giving `model_unavailable`, never a refutation;
  - an untyped throw and a cancellation not re-asked;
  - each ask charged to the Flow's purse (3 settles, `spentCalls() === 3`);
  - the deadline sizes.
- New `result-verification/build-test/tests/judge-timeout.test.ts`, 3 tests with fake timers:
  - Each call carries 45,000 when given. Without it, the 20,000 default applies.
  - **The 19,985 ms case:** a 30 s answer is judged under 45 s. Under the default, it is cut at 20,000 ms on the faked clock, the debug's 19,985 ms. It is then asked again on the identical summary, and the verdict is `no` with `calls: 3`, not unsure.
  - A judge that never answers is asked twice, each cut at 45 s, giving `not_judged` with the cause.
- New `service/candidate-trial/tests/rejudge.test.ts`, 3 tests:
  - A `not_judged` trial, tested again, is judged again on the identical summary, with one press in all and no acts. It becomes `yes` with `judgedAgain`.
  - Repeated not_judged never re-runs, and a verdict drops the evidence.
  - An unreadable result is re-run.
- New `service/flow-bootstrap-commands/tests/build-judge-timeout.test.ts`, 2 tests: the legacy build judge passes the build timeout through.
- Edited `service/flow-bootstrap-commands/tests/build-judge.test.ts` ("says a judge reply it could not read in words"):
  - It expected `unknown` for an unreadable judge reply. It now expects `not_judged`, per item 2 of the brief.
  - Its chat assertions (the words "the judge's reply could not be read", and no code) are unchanged and pass.

**Other files**, beyond the brief:

- `docs/architecture/automation-studio.md`: one paragraph under "The whole verification is bounded", as Core's AGENTS.md asks for documentation maintenance.
- `docs/reference/framework-reference.md`: regenerated with `node scripts/docs-reference.mjs`, because `docs-reference.mjs --check` failed.
  - **It was already stale before this task.** The diff also carries many other tasks' symbols, for example t462/t464/t470 types.
  - The regenerator reported writing `packages/fluxiq/docs/reference/framework-reference.md` too. `git diff --stat` lists only the root copy.

## Commands run and observed results

Narrow checks only, per the user's rule. No full suites and no Lab or paid run.

- `npx tsc --noEmit -p .` in `packages/fluxiq` printed `tsc exit=0`, with no diagnostics.
- `npx vitest run src/.../runtime/result-verification src/.../runtime/service/candidate-trial src/.../runtime/service/flow-bootstrap-commands` (the changed directories):
  - Final run: `Test Files 88 passed (88)`, `Tests 708 passed (708)`.
  - The first run had 1 failure, the `build-judge.test.ts` expectation described above. It was fixed.
- Dependents of verify's behaviour: `npx vitest run` on `llm/deepseek/tests/billing.test.ts`, `llm/harness/tests/in-run-repair-slot.test.ts`, `llm/tests/deepseek-evidence-preflight.test.ts`, `tests/refuted-result`, `tests/service-adaptation`, `tests/service-bootstrap`, `flow-bootstrap/unfinished-build`, `flow-bootstrap/candidate` and `recovery/refuted-result`.
  - Result: `Test Files 106 passed (106)`, `Tests 716 passed (716)`.
- `node scripts/structure-audit.mjs`
  - First run: 4 FAILs in my new tests. One was `as-never` in `build-judge-timeout.test.ts`; three were statement-packing. All were fixed.
  - Final run: exit 0, 0 FAIL lines.
  - It reports "2 baseline entries can be lowered". `--json` shows both are pre-existing, not from this change: `file-lines service.ts 4360 -> 4357`, and `statement-packing storage/project/runtime-stream-store.ts 19 -> 17`.
- `node scripts/structure-audit.mjs --rule docs-links` printed `structure-audit: passed (0 warning(s), 0 baselined).`
- `node scripts/docs-reference.mjs --check` first printed `docs/reference/framework-reference.md is stale` (pre-existing, see above). After regeneration I did not re-run `--check`.

## Not verified

- No live or Lab run. Whether the judge now answers within 45 s in a slow provider window is shown only with a scripted provider and faked time.
- I did not run `docs-reference.mjs --check` after regenerating.
- The runtime result check (`run-outcome.ts`) also re-asks now. Its own deadline stays at 120 s by default with 45 s calls.
  - In an all-timeouts worst case, its deadline can end the verification before the fourth ask. The outcome is still `unverified` (`verification_did_not_finish`), the same class as before.
  - I did not size that deadline from the timeout. It resolves its provider inside the deadline, so that would be a separate change.
- The candidate trial gate (`flow-bootstrap/candidate/trial-gate.ts`, not changed) still runs its site-reset admission (`reset.beforeTrial`) and counts the judge-again request as one of the revision's three trials.
  - A build with lasting acts since the trial could therefore be asked to undo them before a pure re-judge. Not exercised by a test.
  - `reset.trialRan([], runId)` on a re-judge only starts a new ledger phase.
- The legacy evidence-guided path (`build-judge.ts` with phases) gets items 1 and 2, but not item 3's re-judge on re-test. Its phases repair after a `not_judged`; I did not trace whether they re-run an identical Flow only to get a judgement.

## Open questions or contradictions found

- `service.ts` is listed nowhere in the brief, but both judges are built there. I changed only the two constructor calls, on existing lines.
- `run.ts` and `port.ts` are not named in the brief and are not t474's listed files. t474 owns `feedback.ts` and candidate submission. I did not touch `feedback.ts`; the `judgedAgain` sentence is added in `run.ts` after `Feedback.judged`. If t474 edits `run.ts`, the two may need merging.
- Deadline trade-off: a judge with 45 s calls may now take up to 210 s in an all-timeouts worst case. Before, it was 20 s plus a full trial re-run. That is bounded, but it is a large share of a 540 s build in a provider outage. The supervisor may prefer one re-ask per verification (3 calls, 165 s) over one per check.
