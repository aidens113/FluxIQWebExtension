# Report: w2-t024-post-success-await-trace

## Outcome

The pool-lifetime change did **not** fix the live stall. The focused
`social-scheduler-schedule-post` run `run-mua97uhy-7f3ddebe` again completed
the created Flow's playback, durably recorded a terminal `succeeded` run with
9 actions, and then never recorded result verification. The facility finalized
`failed` after 711,075 ms with the original 30-second
`control.request` timeout at
`/api/programs/automation-studio/run-runtime-session`; the granted read-back
window then expired as before.

The old diagnosis -- that the final run-detail save remained awaited while
closing the project database -- is falsified. In this run, release no longer
closed the database (`storage/project/database.ts:57-61`), yet the symptom was
unchanged. Before cleanup, the retained database showed the terminal run,
closed event chunks, and the zero-row dataset. The separate runtime-session
repository also held the terminal session. There was no
`resultVerification` on either record.

The exact unresolved promise cannot be named from the existing closed events,
because there is no lifecycle marker between the final pre-verification detail
save and verification's first write. It is narrowed to the start of
`verifyAutomationStudioRuntimeSessionResult`, and most specifically to its
first dataset-list operation:

1. `runtime/service.ts:3233` performs the last pre-verification detail save;
   `:3234` enters verification.
2. `result-verification/run-outcome.ts:115` awaits `runVerification`.
3. Its first externally awaited operation is `readRecordSets` at `:130`, whose
   first operation is `listRunDatasets` at `:192`.
4. This run's one dataset had `record_count = 0`. If that list returned,
   `:194-201` would perform no page read, and
   `result-summary.ts:98` would still count the dataset as one record set.
   `result-verification/core-observation.ts:47-62` would then derive
   `core.result.no_records` synchronously, without a model call.
5. Verification's first durable outcome write is only afterward, at
   `run-outcome.ts:121`. It never appeared. The final repair accounting also
   recorded zero provider calls, which is expected for the zero-record Core
   observation and does not indicate a missing grant.

The evidence therefore excludes the later instruction lookup, provider
resolution, provider invocation, second session write, and second run-detail
write for this particular run. It does not distinguish these three adjacent
possibilities without a marker: the line-3233 save promise did not return; the
line-3234 verification call was entered but did not reach `readRecordSets`; or
`AutomationStudioRunDatasets.listRunDatasets` did not return. Of those, the
dataset-list await is the smallest instrumentable boundary and the only
external await before an outcome should exist.

## Closed evidence timeline

All times below are durable timestamps or process/facility timestamps; no page
content, recorded values, credentials, or tokens were read or reproduced.

- The Lab process started at 20:12:53 local; the run was dispatched at
  20:14:29.713 and build settlement occurred at 20:15:02.129.
- Project SQLite recorded runtime run
  `fb30b5fa-59e7-42d2-ba9c-eed3ab384541` queued at
  20:15:04.485, started at 20:15:04.649, and finished `succeeded` at
  20:16:02.860 with 9 actions, 0 effects, 0 errors, 0 adaptations, and last
  event sequence 15.
- One dataset summary was durable at 20:16:01.820 with 0 records, 0 refused,
  and not truncated.
- The runtime-session SQLite repository was updated at 20:16:08.975 and held
  `status = succeeded`, the same start/finish times, and no
  `resultVerification`.
- Four project event chunks covering sequences 1-15 were all `closed`; the
  final two were created by 20:16:09.053. The typed run summary likewise had no
  `metadata.resultVerification`.
- While the request remained unresolved, all Lab, scenario server, Core web,
  and runner processes were still alive. The pool's project database remained
  present with its WAL; this was not process death or cleanup masquerading as
  an await.
- Repair settlement did not occur until 20:25:34.538. The final live-LLM
  accounting recorded 3 build calls and 0 repair/verification calls. The
  finalized facility failure remained `http.timeout`, operation stage
  `control.request`, endpoint `run-runtime-session`, timeout 30,000 ms.

## Why the first fix failed

The previous report inferred an unresolved `store.close()` from two facts:
the run-detail write was durable, while execution had not reached a verification
record. That inference was too strong. Durability establishes that a write ran;
absence of the next record does not establish that the writer's `finally`
block is the unresolved promise.

The t024 change removed the close from every ordinary lease release and left
closing to `closeAll()`. The same post-success stall survived unchanged, so
close/reopen churn was not its cause. The change may still be a sensible pool
lifetime correction, but this live run provides no evidence that it fixes the
created-run timeout.

## Next one-change live experiment

Add one behavior-neutral, closed stage trace around the existing awaits in
`verifyAutomationStudioRuntimeSessionResult`/`readRecordSets`, then rerun only
`social-scheduler-schedule-post` once. The trace should emit codes and monotonic
timestamps only (no request, instruction, dataset, page, or model content):

- `pre_verification_save.returned` immediately after `service.ts:3233`;
- `verification.entered` at `run-outcome.ts:114`;
- `datasets.list.started` and `datasets.list.returned` around `:192`;
- `verification.outcome.derived` before `:121`;
- `verification.session_write.returned` after `:121`.

This is one instrumentation change and one focused live run. The last marker
present names the unresolved promise directly. Do not change timeouts, add a
fallback verdict, run the corpus, or run unit suites before that live result.

## Commands and checks performed

- Read the assigned Current State, the written t024 brief, and
  `w2-t011-missing-result-verification.md`.
- Inspected the uncommitted Core pool change and the service, run-detail writer,
  dataset service, database queue, and result-verification call paths.
- Inspected only process identity/lifetime; finalized facility fields; closed
  lifecycle timestamps; SQLite table schemas, statuses, counts, timestamps,
  and JSON key presence. No page data or secrets were printed.
- Per brief, did not edit source or tests, build, start or stop a process, start
  another run, commit, or push.

## Not verified

- No stage trace existed in this run, so the three adjacent boundaries named
  above remain observationally indistinguishable.
- The proposed marker-only rerun was not performed.
- No unit, package, or repository suite was run.

