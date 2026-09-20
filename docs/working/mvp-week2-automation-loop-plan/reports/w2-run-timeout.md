# Granted-run timeout (t022)

Worker report. Worktree `F:\fxwork\t022\` (Core and downstream), branch
`task/t022-runid`, uncommitted. Shortened at the coordinator's request because
of quota.

## Outcome

**Problem 1 is fixed and proven live. Problem 2 is diagnosed but not fixed**
(see below).

## Problem 1: the 30 s timeout on a granted run

**Cause.** Two facts combined:

- A granted run is started and executed in one request, and its run id arrived
  only in the reply.
- Core refuses a granted run that is given a pre-started session
  (`runId` → "An explicit LLM run must create a fresh runtime session").

So once the request timed out, the runner had no id to read the run back by.
Core, meanwhile, had written the session under an id of its own choosing before
the Flow's first step.

**There was also a second, latent defect.** Core publishes the run's terminal
status first and judges the result after it (`service.ts`
`writeRuntimeSession(next)`, then `verifyAutomationStudioRuntimeSessionResult`).
Any reader polling in between sees a `succeeded` that the verdict may still
turn into `failed`. That would have reported a wrong result as `passed`, which
is exactly what t012 exists to stop.

**Core change (domain-neutral).** A run may name the session it is about to
create with `newRunId`, a separate field from `runId`. The session is still
freshly created, so a grant is still never attached to someone else's session.
The new module `runtime/service/runtime-session/requested-run-id.ts` refuses,
before anything is written:

- `newRunId` together with `runId`;
- a run outside a project;
- an id that is not a lowercase UUID;
- an id the project already holds.

Each refusal also revokes the grant. The handler's payload type takes the
field. `service.ts` changed by net zero lines, because it sits exactly at its
6405-line ratchet: I folded a three-line loop into one line, and the two lines
that saved carry the new check.

**Downstream change (`flow-lane/persisted-flow-run.ts` only).** A granted run
now works like this:

- It generates its id and reports it through `onRunIdentified` before
  anything else.
- It runs as a fresh session named by that id.
- If the request times out, it is read back by that id, and counts as finished
  only once it is terminal *and*, if it succeeded, Core has recorded its
  verdict.
- **The wait bound is Core's own deadline for a granted run:**
  `AUTOMATION_STUDIO_LLM_EXECUTION_GRANT_MAX_RUN_MS` (600 s, imported from
  `fluxiq/automation-studio`). It is Core's lease on a claimed grant, and the
  only whole-run deadline Core defines. The poll stops the moment the run
  settles.
- A caller's abort keeps the existing 90 s window.
- A deterministic run's behaviour is unchanged.

The granted call goes through `control.automationStudioCall`. That is because
`existing-fluxiq-control.ts` (t016's) builds its payload from a fixed list of
fields. Once that file is free, `newRunId` belongs in its `runPersistedFlow`
and `runGrantedFlow` should be deleted.

**Live proof** (`FLUXIQ_TEST_RUNS_DIR=F:\r22`, isolated target, instance `t022`):

- **Before**, run `run-mu7g35l9-d35a033a`: the Flow was built at 21:05:28,
  then "FluxIQ HTTP operation timed out" at 21:06:45. The run failed.
- **After**, run `run-mu7gb1mm-4d1f2cc5`: **passed**, judgement passed, oracle
  passed, **14 of 14 `matchedRecords`** (56 of 56 fields), and Core's verdict
  recorded as `resultVerification: confirmed`. Core ran the run under the
  runner's own id; otherwise the "ran a different run" check would have thrown.
- **Caveat:** this Flow's run finished within 32 s of the build, so the
  timeout-and-read-back path may not have run live. I could not force a short
  bound without editing t016's `lane.ts`. That path is proven by a unit test
  driving the real `executeRecordedFlowRun`:
  - the request times out;
  - the run is read back by the id it named;
  - a `succeeded` read with no verdict yet is skipped;
  - the run returns the verdict-overturned `failed`.

**What t016's 300 s workaround in `lane.ts` should become:** remove it. With
this fix a granted run's request can time out harmlessly at the default 30 s
and be read back. A 300 s request only holds a connection open, and it caps the
run below Core's own 600 s lease.

## Problem 2: the verdict that contradicts itself

**Not caused by temperature.** Core's DeepSeek provider already sends
`temperature: 0` (`runtime/llm/deepseek-provider.ts:448`), the only temperature
setting in Core's LLM code, so there was nothing to pin. The disagreement is
the provider being nondeterministic at temperature 0 on a borderline
judgement. I did not fix it: the remedy is a policy change, not a setting, and
the coordinator asked for it only if it was small.

**Recommended policy.** A single verdict may confirm a result. A single
"does not answer" should not fail a run by itself: ask once more with the same
evidence.

- If the two calls agree, that is the verdict.
- If they disagree, record `unverified`, never `confirmed` or `passed`, and
  keep the run's step status.

That keeps both constraints:

- **A wrong result is never reported as passed.** A second "does not answer"
  fails the run, and a disagreement is never a confirmation.
- **A correct result is never failed on one inconsistent judgement.**

**Accounting.** I did not fix the verification call's absence from
`live-llm.json`. Core appends the call's intervention to the run detail
(`run-outcome.ts` `recordOnRunDetail`), so it can be counted from there. But
the accounting lives in `live-llm/live-llm-run.ts`, which t016 owns.

## Commands run and observed results

- `pnpm lab:campaign social-scheduler-week-ahead --max-attempts 1`
  - before the fix: failed, "FluxIQ HTTP operation timed out";
  - after: **passed, 14/14**.
- `node --test dist/flow-lane/tests/persisted-flow-run.test.js`: 24 of 24.
- Core `npx vitest run` on the runtime-session tests: 21 of 21. On the 25 test
  files that drive runtime sessions: 148 of 148.
- `tsc --noEmit` in Core: exit 0. The test-runner build: clean.
- Core `node scripts/structure-audit.mjs`: passed. Downstream: passed.
- Full `pnpm check` and the full test suites were **not run**, to save quota.

## Not verified

- The timeout-and-read-back path live; only a unit test covers it (see the
  caveat above).
- Problem 2's fix, and the missing accounting of the verification call.
- Full `pnpm check` on either side.
- Two concurrent requests naming the same `newRunId` could both pass the
  existence check before either writes the session. The window is tiny with
  UUIDs chosen by the caller.
