# i-final-bench-b-discards — provisional bounded investigation

Read-only investigation during Stage 4m Bench B2, 2026-09-13. I inspected only
selected structured fields from finalized bundles: run/scenario/workflow/lane/
repeat/verdict, discard type/id/recording/counts/timing, read sequence, and
window exclusion counts. I did not read or reproduce event messages, page data,
URLs, payloads, screenshots, logs, credentials, or browser state. No live file
or process was changed or disturbed.

## Provisional disposition

**These are explained lifecycle disclosures, not acceptance-blocking recording
loss.** At the latest bounded scan, the three observations in the B2 milestone
had become four unique `recording.event_discarded` audit entries. Every one:

- names exactly one recording produced by that same run;
- is `recording.event_discarded`, never `recording.action_discarded`;
- reports `discardedActions=0`, `discardedEvents=1`;
- arrived 8, 9, 12, or 15 ms after Core finalized that recording;
- appears in both the first and second audit publication with the identical
  `entryId` and unchanged fields;
- contributes `discardsAfterFirstRead=0` on the second read;
- belongs to a run whose current evaluation verdict is `passed`.

This is the exact shape the runtime intentionally records but does not fail:
discarded executable actions fail as `recording.persistence`; discarded
evidence alone does not, because a page unloading after Stop legitimately emits
some (`packages/test-runner/src/flow-lane/recording-discards.ts:97-108`;
`docs/architecture/testing-facility.md:1019-1039`). The final Stage 4m brief
requires the worker to inspect discard counts but says to stop on a leak or a
deterministic blocker; it does not require every evidence-only discard count to
be zero (`briefs/finish-week1.md:5383-5407`).

The entries are **comparison disclosures only**. The tracked closeout output
counts `eventDiscardEntries` and after-finalization entries, but does not make
them a tolerance-bearing metric or part of `comparisonPassed`
(`packages/test-runner/src/bench/persistence-discard-diagnostics.ts:29-47`;
`packages/test-runner/src/bench/closeout-comparison.ts:13-22`). Their current
A/B asymmetry therefore does not by itself fail repeatability. It must still be
reported and classified, not silently called zero.

## Bounded observations at this cut

| Run | Safe association | Read sequences | Timing after finalization | Counts | Window result |
| --- | --- | --- | ---: | --- | --- |
| `run-mu0ggjcn-be898ef1` | W01 `basic-form`, recording, repeat 0, passed | 16 and 18, same entry id | 8 ms | actions 0, events 1 | retained; second read added 0 |
| `run-mu0gjbxd-e7a53db3` | W02 `keyboard-forms`, primary recording, repeat 0, passed | 16 and 18, same entry id | 12 ms | actions 0, events 1 | retained; second read added 0 |
| `run-mu0gkm2p-920dd999` | W02 `keyboard-forms`, primary Flow, repeat 0, passed | 16 and 20, same entry id | 15 ms | actions 0, events 1 | retained; second read added 0 |
| `run-mu0gmvi8-0f69c291` | W03 `keyboard-forms` / `combobox`, recording, repeat 0, passed | 18 and 20, same entry id | 9 ms | actions 0, events 1 | retained; second read added 0 |

There are eight serialized appearances but four logical entries. Union by
`entryId` is correct and intentional: the second read carries the first read's
entries forward and adds only unseen audit ids
(`recording-discards.ts:89-96,110-126,145-147`). Treating eight appearances as
eight losses would double-count the same Core audit records.

### Scope/window evidence

All four were inside the lower bound opened immediately before this run started
recording and were associated by their own recording id, not merely by session.
The three recording-lane reads had no upper bound, as designed when no Flow is
dispatched. The Flow row's second read had an upper bound at Flow dispatch.

Each first read excluded two `recording.action_discarded` audit entries that had
no recording id and occurred outside the lower bound. The Flow row's bounded
second read additionally excluded seven action entries naming this recording
after the upper bound. Those are the Core action probe before recording and the
Flow's runtime confirmations after recording, respectively—the exact exclusions
the window was introduced to prevent from becoming false loss
(`recording-discards.ts:23-38`; `run-scenario.ts:274-275,331-332`). None of those
excluded entries is one of the four retained disclosures, and none contributes
a persistence failure.

## Exact kind and reason that can safely be claimed

The retained safe kind is exactly `recording.event_discarded`: Core classified
the message as non-executable evidence, associated it with the just-finalized
recording, could not append it to that immutable recording, and audited it
instead. The reason “arrived after finalization” is not inferred from wall-clock
ordering; it is Core's own `sinceFinalizedMs` metadata, present on all four.

The underlying page/event label **cannot be determined from the finalized
bundle and should not be guessed**. The runner deliberately strips Core audit
message, client/session/input id, domain id, and event label, retaining only the
bounded fields above (`recording-discards.ts:3-20,40-57,174-193`). Core can
produce this audit type for a queued snapshot, a non-executable recording event,
or a recording-marked state update (`F:\!FluxIQ\packages\fluxiq\src\programs\automation-studio\client-gateway\bridge.ts:397-410,581-623`).

The strongest source-supported mechanism is a queued evidence send completing
just after Stop. Core's own focused test names and proves a state snapshot whose
timer flush lands after finalization, producing this exact safe shape:
`recording.event_discarded`, the run's recording id, `executable=false`, event
count 1, action count 0 (`bridge.test.ts:410-424`). The 8–15 ms timing, occurrence
across unrelated forms, and zero action count fit that mechanism. Because the
safe bundle omits the underlying label, this specific “state snapshot” identity
is **high-confidence likely, not directly observed**.

Core deliberately emits only the first non-executable discard audit record per
closed recording while continuing its internal event count; executable actions
are always reported (`bridge.ts:491-531`). Therefore `discardedEvents=1` is the
running count at the first audited evidence discard, not proof that no later
evidence message was discarded. That instrumentation limit does not hide an
action: any later executable message creates its own action-discard audit, and
an evidence entry whose cumulative `discardedActions` rises above zero also
fails the runner (`recording-discards.ts:133-142`; tests at `:99-117`).

## Week 1 treatment

1. **Criteria 1 and 5:** non-blocking while every affected run has equal
   extension/Core executable-action counts, no `recording.persistence` failure,
   and no entry with type `recording.action_discarded` or
   `discardedActions>0`. Existing ranking R9 uses those action-loss conditions
   as the blocker; these four satisfy none of them
   (`reports/i-ranking-draft.md:31`).
2. **Criterion 2:** disclose the count because it is evidence that arrived too
   late to join the immutable recording, but do not call it loss of a required
   action or a secret leak. Acceptance still separately requires the action
   packets, state diffs, packet budget, truncation accounting, and zero leak
   findings. If those are complete, this post-Stop evidence does not invalidate
   them.
3. **Criterion 6:** record one explained lifecycle class in the final ranking,
   with frequency by bench and affected row. It is not a Week 1 blocker at the
   current shape. The A/B comparison report should retain B's unique count and
   timing range, and A's count as independently observed, rather than requiring
   equality for this non-metric diagnostic.
4. **Do not stop B2 for these entries.** Continue the complete campaign and
   update the final B2/report counts. Stop/reclassify immediately if any later
   entry is `recording.action_discarded`, has `discardedActions>0`, accompanies
   unequal extension/Core actions, causes `recording.persistence`, carries no
   readable audit/window where action loss cannot be ruled out, or correlates
   with missing required evidence.

## Smallest follow-up

No source fix or rerun is warranted from the current four entries. The smallest
closeout action is reporting/classification:

- B2 records the final unique-entry count (unioned by entry id), affected run
  ids/rows, action/event counts, timing range, and `discardsAfterFirstRead`;
- the supervisor verifies the final bundle set contains no action-bearing
  discard and executable action counts remain complete;
- tracked comparison reports B's `eventDiscardEntries` and
  `entriesAfterFinalization` as disclosure, not a gating metric;
- the final ranking labels this “expected post-finalization evidence race; no
  executable action loss” and records the A/B frequency.

If product owners later require the exact evidence subclass, the current safe
contract intentionally cannot provide it. A future bounded Core-owned enum
would be needed; forwarding the existing page-supplied event label would violate
the present sanitization rule (`briefs/finish-week1.md:2225-2231`). That is not
needed for Week 1 acceptance.

## Provisional nature

This cut contains four unique entries and B2 is still running. Final disposition
depends on the completed campaign retaining the same zero-action shape. The
worker's earlier three-entry milestone was accurate at its time; the fourth
accrued afterward. No conclusion here treats the partial run count as final.
