# Report: w2-demo-iterating-calls

## Outcome

**Done, with one deliberate exception that needs a follow-up brief.**

- **What changed.** The panel-driven demos no longer type a call count for an adapting run, and none of them requires exactly two calls any more. Where a demo checks a source run's call count, it now requires:
  - at least one call per intervention the run recorded (a diagnosis plus a patch means at least 2);
  - no more than the grant's default of 26.
- **Unchanged.** A diagnosis still saves and requires exactly one call.
- **The exception: `pnpm demo:llm:adapt`.**
  - Its lane now accepts any call count within the grant.
  - It then refuses, with an explicit message, a run that spent more calls than it recorded as interventions.
  - The reason: its certificate, `demo-llm-adaptation.ts` (not mine), can only record two invocations and hardcodes `providerCallCount: 2`. Certifying a longer run would understate what it cost.
- **Checks.**
  - `pnpm check`: exit 0.
  - test-runner: 976 of 976 pass (964 before; 12 new).
  - Structure audit: passed, 57 warnings, which is unchanged.
- **Not run.** No demo, browser, panel or provider was run.

## What changed and why

**`packages/test-runner/src/demo-llm-adaptation-control.ts`**

- New export: `adaptationCallCountWithinGrant(run)`. This is the single definition of "a call count this adapting run's grant could have produced":
  - the count is a safe integer;
  - it is at least `max(1, interventions.length)`;
  - it is at most `FIRST_LIVE_ADAPTATION_PROFILE.budget.maxCallsPerRun`, which is 26.
- **Why that upper bound.** The run detail does not expose the grant's authorized count. The panel sends no call count for an adapting run, so Core authorizes its default. The Lab's drift test holds that default equal to `DEFAULT_LLM_LAB_BUDGET.maxCallsPerRun`, and this profile uses the same value.
- `requireSourceRun` uses the new function instead of `providerCallCount !== 2`. The intervention shape `[diagnosis, runtime_patch]` is unchanged.

**`packages/test-runner/src/demo-llm-exploration-adaptation-revert.ts`**

- The source-run check uses the same function.

**`packages/test-runner/src/demo-llm-exploration-adaptation.ts`**

- The checkpoint types are now plain numbers, no longer the literal `2`:
  - `providerCallCount` in the proposal checkpoint;
  - `sourceProviderCallCount` in the apply and validation checkpoints.
- The values reported are what the run actually spent.
- Both the proposal and the validation source checks use the shared function. The proposal's call-count check now runs after the intervention-shape check. It still fails with `provider_accounting_invalid`.

**`packages/test-runner/src/demo-workspace/diagnosis-ui.ts`**

- `configureFirstLiveDiagnosisViaUi` takes `run: "diagnosis" | "adaptation"` (default `"diagnosis"`) in place of the old `maxCalls` string.
  - **Diagnosis:** saves 2000/512/3000 tokens and Max calls = 1, exactly as before.
  - **Adaptation:** saves the adaptation profile's per-request tokens and **does not touch Max calls**. The panel does not use that field for adapting runs, so typing a value would control nothing.
- Timeout, cost and retries are unchanged for both.

**`packages/test-runner/src/demo-workspace/adaptation-lane.ts`**

- Passes `"adaptation"`, not `"2"`.
- The combined check is split into three:
  1. the intervention shape;
  2. the call count against the shared function;
  3. `providerCallCount === interventions.length`. This is the exception described under Outcome. The error message says that the adaptation certificate can only record the calls it saw as interventions.

**`packages/test-runner/src/demo-workspace/exploration-adaptation.ts`**

- Passes `"adaptation"`, not `"2"`.
- The pre-browser guard in the validation lane uses the shared function instead of `providerCallCount !== 2`.

**`packages/test-runner/src/existing-fluxiq-control.ts`** (edited byte-safely in Node; the file size and its single NUL byte were checked before and after)

- `runPersistedFlow`'s `llmExecution` parameter is now typed as the Lab's own `PersistedFlowLlmExecution` (a type-only import from `./flow-lane/index.js`). The client can no longer be narrower than the purposes the lane passes it, so it now accepts `explore_and_adapt`. `flow-lane` does not import the client, so this creates no cycle.
- The evidence-guided creation audit parser used to refuse `providerCallCount > 16`. It now refuses above `LLM_LAB_MAX_CALLS_PER_RUN` (64, Core's backstop).
  - Why: creation (`build_and_adapt`) iterates, so 16 would have rejected valid Core records.
  - This bound can only be looser than before, and Core can never exceed 64.

**`docs/architecture/testing-facility.md`** (Live LLM Safety Envelope)

- Replaced the two-call paragraph. It now covers:
  - a diagnosis is exactly one call, while adaptations iterate until Core's cost, token, deadline or no-progress guard stops them;
  - `--llm-max-calls` is a backstop (default 26, refused outside 1–64);
  - `--llm-max-run-tokens` and Core's default token formula, plus the note that Core's handlers do not yet forward the field;
  - the $2 run cost cap;
  - when the high-token confirmation is sent;
  - that the panel demos type no call count, and the `demo:llm:adapt` exception.
- Fixed the stale sentence "The general Lab CLI continues to reject `--live-llm`".
- Reworded the panel high-token sentence. The warning is now judged on the run's token budget, not on the 50,000 per-request ceiling.

**Tests**

- `tests/existing-fluxiq-control.test.ts`, 2 new tests:
  - all three purposes are forwarded as `runIntent` (typed through `PersistedFlowLlmExecution["purpose"]`);
  - evidence-loop call counts: 17 and 64 are accepted; 0 and 65 are refused.
- `tests/demo-llm-adaptation-control.test.ts`, 3 new tests:
  - 3, 9 and 26 calls continue to applied;
  - 27 calls and a missing count are refused before approve or apply;
  - direct tests of the shared function, including that the ceiling equals `DEFAULT_LLM_LAB_BUDGET.maxCallsPerRun`.
  - The existing "1 call is refused" case is kept, with a comment explaining why.
- `tests/demo-llm-exploration-adaptation-revert.test.ts`, 2 new tests:
  - revert and reject both succeed with 3 and 26 calls;
  - revert above the grant fails before any mutation.
  - One test renamed.
- `tests/demo-llm-exploration-adaptation.test.ts`, 2 new tests:
  - a 3- or 26-call source flows through proposal, apply and validation with the real count;
  - an undefined count, 0, 1 or 27 is refused with `provider_accounting_invalid`, and validation refuses 27.
  - Two tests renamed.
- **New** `demo-workspace/tests/diagnosis-ui.test.ts`, 3 source-level tests:
  - the adaptation settings table has no Max calls, while the diagnosis table has `["Max calls", "1"]`, and that is the only occurrence;
  - both adapting lanes call the driver with `"adaptation"`, contain no `providerCallCount !== <digit>`, and use the shared function;
  - the diagnosis lane still calls the driver with its default.
  - These are source tests because the driver needs a real Playwright page. Existing demo tests already use this pattern.

## Commands run and observed results

**`pnpm --filter @fluxiq-web-extension/test-runner check`**

| Run | Result |
| --- | --- |
| After the source edits | exit 0 |
| After the tests were added | exit 2, three `TS2379` errors in my new control test (`exactOptionalPropertyTypes`) |
| After fixing them | exit 0 |

**`pnpm --filter @fluxiq-web-extension/test-runner test`**

| Run | Result |
| --- | --- |
| First | exit 0; `# tests 976 # pass 976 # fail 0 # cancelled 0` |
| Final, after `pnpm check` | exit 0; same counts |

All 12 new test names appear as `ok` in the log.

**Negative probe**

- Temporarily replaced the shared function's bounds with `calls === 2`, rebuilt, and ran the four affected test files: `# pass 30 # fail 4`.
- The four failures:
  - "accepts a source run that iterated past two calls within its grant";
  - "an adapting run's call count is bounded by …";
  - "reverts and rejects when the source run iterated past two calls …";
  - "reports what an iterating proposal run actually spent …".
- The source was then restored from a scratch backup; `git diff --stat` showed 19+/1-, my edit only.
- The final test run rebuilt `dist`. `grep -c "calls === 2"` on the built file printed `0`.

**`pnpm check`**

- exit 0.
- Structure-audit tests: `# tests 96 # pass 96 # fail 0`.
- Lab tests: `# tests 15 # pass 15 # fail 0`.
- `structure-audit: passed (57 warning(s), 17 baselined).`
- All workspace checks: `Done`.

**`node scripts/structure-audit.mjs`**

- exit 0; `passed (57 warning(s), 17 baselined)`. That is the same count the previous worker recorded.
- Three warnings name files I touched, and all three predate this work:
  - `existing-fluxiq-control.ts` has 29 methods;
  - `existing-fluxiq-control.ts` has 549 lines (it was 545, already past the 400-line advisory);
  - `diagnosis-ui.ts` has 12 exported values, unchanged. I added no export there.

## Not verified

- **None of the demos was run.** These lanes drive a real browser, the FluxIQ panel and DeepSeek, and the brief forbade that. Specifically, nothing here shows that:
  - Flow Settings saves successfully when the adaptation path leaves Max calls untouched;
  - the panel really ignores the saved Max calls for adapting runs (taken from the brief);
  - Core really authorizes its default of 26 for a panel-issued adapting grant (taken from the brief and the previous report).
- **The intervention shape under Core's new model is assumed, not observed.** I kept "exactly `[diagnosis, runtime_patch]`" and assumed that evidence-gathering calls leave no intervention record. The control client's intervention-kind enumeration has no evidence kind, which supports this. If Core records extra interventions for an iterating run, these demos will fail loudly on the shape check. They will not accept anything wrong.
- **The lower bound is an assumption.** It treats each recorded intervention as one provider call, as the old two-call model did.
- **Run-wide totals are not checked by these demos.** They check tokens and cost per intervention, not across the run. Calls that gather evidence have no intervention record, so their tokens and cost are not checked by the demos at all; only Core's own guards bound them. Previously, 2 × the per-call limits was an implicit bound on the run total.
  - Tightening this would mean checking `llmAccounting` (for example `budgetBreaches`), whose meaning I could not confirm without reading Core.

## Open questions or contradictions found

1. **`demo:llm:adapt` still cannot certify an iterating run.** `packages/test-runner/src/demo-llm-adaptation.ts` (not mine) causes this:
   - `invocations` is a fixed two-tuple, required at line 312;
   - the result type and value are `providerCallCount: 2` (lines 162 and 260).

   Until that certificate accepts the run's real call count, and ideally a record of the calls between diagnosis and patch, the lane refuses such runs by name. The follow-up brief should own `demo-llm-adaptation.ts`, its test, and `demo-workspace/adaptation-lane.ts`. Removing the lane's `providerCallCount !== interventions.length` guard is its last step.
2. **Creation settings still pin call counts.** These are outside my files, and the purpose is `build_and_adapt`, which iterates.
   - `demo-llm-create-ui/limits.ts`:
     - `FIRST_LIVE_CREATION_LIMITS.maxCalls: 1` and `EVIDENCE_GUIDED_CREATION_FLOW_SETTINGS.maxCalls: 4`, typed into the panel's "Max calls" through `creationSettingsFields`;
     - `EVIDENCE_GUIDED_CREATION_LIMITS.maxCalls: 4`, which also drives `EVIDENCE_GUIDED_CREATION_COMMAND_TIMEOUT_MS` and the aggregate-token checks in `explore-proposal-ui.ts:51,120`.
   - `demo-llm-exploration-request.ts:98` sends `maxCalls: 4`.
   - Their tests pin these values: `demo-llm-create-ui/tests/exploration.test.ts`, `readiness-gate.test.ts`, `tests/demo-llm-exploration-request.test.ts`, `tests/demo-llm-creation.test.ts:51`.
   - Whether the panel still honours a saved Max calls for creation, or whether Core ignores it for `build_and_adapt`, needs a decision before these are changed. The creation command's timeout is computed from `maxCalls`.
3. **The creation audit parser still has a 16 cap on tools.** `existing-fluxiq-control.ts` still refuses `toolCallCount > 16` and `toolIds.length > 16` in the creation audit. I left these alone because they limit tool use, not provider calls, and I could not confirm Core's tool cap without reading Core. But an evidence-guided creation that iterates past 16 decisions and uses a tool each time would still be refused. `llm.ts` says the exploration's own default ceiling is 24 decisions, which suggests 16 may be too tight.
4. **Core's HTTP handlers drop `maxTotalTokensPerRun`.** This carries over from the previous report. The doc now says that a lower typed budget is enforced by the Lab's post-run check until Core forwards the field. Remove that sentence when Core is fixed.
