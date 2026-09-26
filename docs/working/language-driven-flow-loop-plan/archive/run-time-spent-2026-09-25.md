# Archive — what a run spent its time on, measured 2026-09-25

Moved out of `../../language-driven-flow-loop-plan.md` on 2026-09-26 when the
document passed its compaction threshold. It is a measurement snapshot of the
runs of 2026-09-25 and is superseded as a description of the present by the
Current State and the ledger; it is kept because it is the only place the
per-row timings of those runs are written down.

## What A Run Spends Its Time On

Measured 2026-09-25 from the per-row timestamps E4 added, which is the first
time this could be asked at all. The user's question was why a run of one
instruction took sixteen minutes; the answer was that almost none of it was the
product thinking.

`run-muher0en-508ddb69`, 949.6 s:

| Phase | Time |
| --- | --- |
| Setup — browser, extension, isolated FluxIQ | 67.5 s |
| Exploration — the actual work | 192 s |
| The Flow's four actions | 12.6 s |
| **Repair phase, waiting, producing nothing** | **568 s** |
| Tail | 60 s |

**The 568 s was a wait for something that was never coming.** Core records a
refuted result as a failure on the last record-storing attempt, so a Flow whose
every node executed as authored reads `failed` on that attempt. The Lab's
`recoveryCouldBeRunning` took that for a node fault and spent the full
five-minute `RECOVERY_RECORD_WAIT_MS` — on a recovery Core had already declined
to plan, because Core plans from the diagnosis of an attempt that *would not
run* and a refuted result hands it none. Fixed by `everyNodeRan`
(`packages/test-runner/src/flow-lane/node-recovery.ts`): a node that ran and was
then judged wrong is a node that ran. **Measured effect on the next run:
949.6 s → 437.2 s, with the repair phase at 81.5 s.**

**What is left, and it is now the largest cost.** Six exploration calls at
**11.04 s each, identical to the centisecond**, plus two decisions at ~15.5 s —
118 s of a 216 s build. Uniformity to that precision is a deadline being
exhausted, not provider latency and not page work, and it reproduces across
runs (`run-muher0en-508ddb69` shows the same 11.04 s eight times). The calls
return `web.inspect.succeeded`, so whatever is being waited for is not required
for the answer. `NAVIGATION_END_TIMEOUT_MS` in
`apps/extension/src/runtime/click-landing.ts` was checked and ruled out —
`landing()` returns early when no navigation starts. Open as t127.

**The rule this establishes.** A run's duration is evidence like any other and
is read from the timestamps, not estimated. Before concluding that the product
is slow, account for where the seconds went: on the two runs measured so far,
60% and then 19% of the wall clock was a harness wait, and the exploration
itself never exceeded four minutes.

---
