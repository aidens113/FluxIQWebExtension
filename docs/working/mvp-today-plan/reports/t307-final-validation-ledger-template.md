# t307 — Final validation ledger template

Status: **Complete report-only template**

Append exactly one of the blocks below after t297's run-2 repair ledger entry and before the
ledger's closing `---`. Do not append both. Replace every angle-bracket placeholder from observed
command output; if a value was not emitted, say `not reported` rather than infer it.

## Evidence already safe to state

- t290: risk-only recovery permission matrix passed 5/5 files, 81/81 tests in 4.31 seconds;
  scoped diff-check passed; production was unchanged.
- t293: deterministic post-entry timeout matrix passed 4/4 files, 51/51 tests in 59.89 seconds;
  scoped diff-check passed; production was unchanged.
- t304: Runtime Debug permission reconciliation passed 1/1 file, 11/11 tests in 13.01 seconds;
  nearest Core permission matrix passed 2/2 files, 30/30 tests; scoped diff-check passed;
  production was unchanged.

These focused results do not substitute for the final Core root suite. The root, final Core check,
and provider-free dry-run remain conditional until their commands finish and their output is read.

## Accepted block — use only when all three pending gates pass

```md
### 2026-09-26 — Final-tree tests and provider-free readiness gate closed
- Agent: supervisor with t290, t293, t304, and final validation workers
- Changed: test-only permission/deadline/web expectation reconciliations and final readiness evidence; no production behavior or live-run result
- Why: Prove the settled repair tree under the full Core suite and zero-provider pre-live gate without widening authority or converting readiness into live evidence.
- Validation: t290 81/81, t293 51/51, and t304 11/11 plus nearest Core 30/30 passed; Core `pnpm test` -> exit 0, <ROOT_TOTAL>/<ROOT_TOTAL> passed, <SKIPS> skipped in <ROOT_DURATION>, including all three reconciled files; Core `pnpm check` -> exit 0, <CHECK_SUMMARY>; `<EXACT_PROVIDER_FREE_DRY_RUN_COMMAND>` -> exit 0 with `status:"ready"`, `providerCallCount:0`, `lane:"created-flow"`, `target:"isolated"`, and reviewed scenario/workflow/task/oracle/replay facts matched.
- Outcome: Accepted
- Follow-up: recapture final tree identity, repeat the one-Lab process/lock gate immediately before execution, create the no-hindsight pending debug, and repeat the unchanged default-profile live scenario; run 2 remains the latest accepted measurement and the pass streak remains 0.
```

Use the root runner's own total convention. If it reports files and tests separately, record both
instead of forcing them into `<ROOT_TOTAL>/<ROOT_TOTAL>`. `<CHECK_SUMMARY>` should name the actual
subchecks/totals printed, not merely `passed`.

## Partial block — use if any gate is pending or fails

```md
### 2026-09-26 — Test-only reconciliations passed; final readiness remains open
- Agent: supervisor with t290, t293, t304, and final validation workers
- Changed: test-only permission/deadline/web expectation reconciliations and bounded validation evidence; no production behavior or live-run result
- Why: Preserve the focused green evidence while keeping readiness closed until every final-tree gate is observed.
- Validation: t290 81/81, t293 51/51, and t304 11/11 plus nearest Core 30/30 passed; Core `pnpm test` -> <ROOT_RESULT>; Core `pnpm check` -> <CHECK_RESULT>; `<EXACT_PROVIDER_FREE_DRY_RUN_COMMAND>` -> <DRY_RUN_RESULT>.
- Outcome: Partial
- Follow-up: <EXACT_REMAINING_OR_FAILED_GATE_AND_NEXT_ACTION>; do not create the pending live debug or make a provider call; run 2 remains the latest accepted measurement and the pass streak remains 0.
```

Populate pending results literally, for example `not run; pending settled-tree identity`, rather
than leaving a blank. Populate failures as follows:

- root: exact command, nonzero exit status, failing file, full test title, and exact typed failure;
- check: exact command, nonzero exit status, first failing subcheck/rule, and its emitted summary;
- dry-run: exact command, exit status, observed status/facts, and the exact expected/actual mismatch.

Do not say the focused matrices were invalidated unless the root failure directly contradicts one
of them. A root/check failure outside those files leaves the focused evidence true while keeping
the overall outcome Partial.

## Truthfulness boundary

Even the Accepted block proves only local final-tree correctness and pre-live readiness. It must
not claim a repaired Flow ran live, repair persistence, provider-free replay in a live run,
recursive fourth judgement, a first pass, or a reserved Lab. Run 2 remains the latest accepted
measurement and the consecutive-pass streak remains 0 until a later provider-backed run proves
otherwise.

t307 changed no shared plan/archive/index, source, test, generated output, run artifact, or live
state. This report is its only write.
