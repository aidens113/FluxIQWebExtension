# t097 — the Lab tells the truth about why a run failed, and stops waiting for nothing

Worker report. Branch `task/t097-lab-truthful-reporting`, worktree
`F:/fxwork/t097-lab-truthful-reporting`. Nothing outside
`packages/test-runner/src/flow-lane/**` was edited. No Lab run, campaign or
provider run was started. Nothing was committed or pushed.

## Outcome

Done for all four, with one honest qualification on (3) stated in full below:
the harness still loads the scenario's start page before playback, because the
call that does it lives in `packages/test-runner/src/run-scenario.ts`, which
this brief did not give me. What I built instead is the classification the
brief's own validation asked for — the lane now **fails a Flow that could only
have run because the harness navigated for it** — and it fails
`run-mudwci8d-de88aa32`.

**This makes runs fail that currently appear to get further, and that is the
point.** Of the two runs in `ten-sites-r5`, one now fails on a defect it was
never charged with: its Flow cannot reach its own page. Nothing about the
product got worse. The number that will get worse is the one that was wrong.

---

## 1. The reported failure is now the one that decided the run

`packages/test-runner/src/flow-lane/persisted-flow-run.ts` took the first
attempt in the run that carried a failure record, whatever happened to that
node afterwards. It now takes **the first failure on a node whose last attempt
did not succeed**, and a failure a later attempt of the same node recovered
from moves to a new `recoveredFailures` field rather than disappearing.

- `PersistedFlowRunOutcome.failure` — the failure that decided the run; `null`
  when every node ended on a successful attempt.
- `PersistedFlowRunOutcome.recoveredFailures?` — every absorbed failure, in
  attempt order, absent when there were none. Published in both Flow-lane
  snapshots (`creation/snapshot.ts`, `run-flow-lane.ts`), so a recovered miss is
  still on the record, labelled as recovered.

The grouping rule is new and shared: `flow-lane/node-recovery.ts`,
`recoveredByNode()` / `everyNodeEndedSucceeded()`. It is the grouping
`recovery-attribution.ts` already used — by Core's node id, with an unnamed
attempt as its own group — extracted so that the run reader and the recovery
wait cannot drift apart. `recovery-attribution.ts` was left as it stands.

## 2. `ambiguous_or_unknown` now says what is known

`flow-lane/lane-observation.ts`, `reportedFailure`. A failed run with no
deciding failure record no longer writes a bare word with no code. It writes
the fact that is true of it, under a `flow_lane.` code — the same prefix
`flow_lane.granted_run_unsettled` already uses to mark a facility finding
rather than one of Core's:

| Condition read from the run | Reported |
| --- | --- |
| stopped with action nodes unvisited, nothing failed | `unexpected_state` / `flow_lane.stopped_without_failed_attempt` |
| Core judged the result and refuted it | `unexpected_state` / `flow_lane.result_refuted` |
| met faults, recovered from all of them, failed anyway | `ambiguous_or_unknown` / `flow_lane.every_failure_recovered` |
| none of those | `ambiguous_or_unknown` / `flow_lane.no_failed_attempt` |

The category stays inside Core's one closed list
(`AUTOMATION_STUDIO_ADAPTIVE_FAILURE_CLASSES`, which this repository may not add
to), so the precision had to go in the code. `unexpected_state` — "the run
reached a route, status, or state other than the expected one" — is the member
that carries a wrong outcome; `output_not_observed` was rejected because these
Flows' outputs *were* observed, they were simply wrong.

The recovered case deliberately reports `ambiguous_or_unknown`, not the
recovered failure's own category: naming it there would re-create exactly the
lie fix (1) removes. The fault is still readable in `recoveredFailures`.

Two sibling sites write the same bare word and were **not** changed, because
they are outside this brief's subject: `lane-observation.ts` line 84
(`recordingLaneProbeObservation`, the recording lane) and
`packages/test-runner/src/bench/evaluate-run.ts:224`. Both deserve the same
treatment.

## 3. A Flow that cannot reach its own page fails on that first

New: `flow-lane/creation/own-page.ts`. A task of kind `navigate` or
`navigate-and-extract` must produce a Flow with at least one navigation node;
`form` and `extract` must not be held to it, because a person asking for the
page in front of them to be read starts on that page. The lane states the fact
before the run (`ownPage` on the evidence and in `snapshots/flow-lane.json`) and
judges it **first**, ahead of `assertFlowDidNotStopEarly`, `assertFlowFailure`
and the dataset judgement — because a Flow that could not have started without
the harness produced its records from a page it never chose, so what those
records match or miss is not evidence about the Flow. The failure carries
`flow_lane.flow_does_not_reach_its_page`.

**What I did not do, and why.** `creation/lane.ts:139-141` still calls
`prepareFlowPage("playback")`, which still loads the scenario's start page. The
lane cannot stop it: `prepareFlowPage` is supplied by `flowRunHooks` in
`packages/test-runner/src/run-scenario.ts:257`, that file is not in my owned
paths, and every way of changing the contract from inside the lane — a third
`moment`, a new required hook — breaks that caller's compile under
`strictFunctionTypes`. Nor can the lane reach the browser; it holds only a Core
control client, an origin and a token.

For the supervisor, the caller-side change is: in that hook, when
`moment === "playback"` and the task's kind is `navigate` or
`navigate-and-extract`, keep `openScenarioStart` and the `pageFacts.afterArm`
check (the arming must still be proved against a loaded page) and then send the
tab to `about:blank` before returning. I did not write it and cannot vouch for
it: the extension's active tab is bound to the scenario origin at pairing
(`activateScenarioTab`), and whether a Flow's own `web.browser.navigate` works
from a blank tab under the deterministic network guard is untested. That is a
task, not a one-line patch.

Until it is done, the harness's page is still supplied — but a Flow that needed
it supplied now fails, and says so.

## 4. The dead five-minute wait is a five-second grace

`flow-lane/terminal-run-wait.ts`. `RECOVERY_RECORD_WAIT_MS` (300 s) is kept for
a run that left a failed attempt. A run whose every node ended on a successful
attempt takes the new `RECOVERY_RECORD_GRACE_MS` (5 s) instead.

The test is "could a recovery still be running", answered from the run's own
attempts. Core plans a recovery from the deterministic diagnosis of a *failed
attempt*; with none it takes `unclassifiedPlan`
(`F:\!FluxIQ\...\runtime\recovery\plan.ts`), whose entire plan is one `stop`
step under the refusal *"No failed attempt reached the diagnosis, so there is
nothing to plan."* No exploration, no patch, no provider call — nothing in
flight for a wait to catch.

It is deliberately read from attempts and not from interventions: the ladder's
diagnosis placeholder is written with the run's first save, which is the reason
the wait could not tell the two cases apart before (the file's own comment said
so). And it is a 5-second grace rather than zero, because the rule is about what
Core *can plan from*, not about what Core has already written — if a record is a
poll away, it is still read. What it never does is spend five minutes finding
out.

A run that leaves no failed attempt still reports `unsettled: "recovery"`. That
word is still true — Core never said — and leaving it alone keeps every
downstream reader's meaning intact.

---

## Commands run and observed results

All in `F:/fxwork/t097-lab-truthful-reporting`.

**`pnpm --filter @fluxiq-web-extension/test-runner test`** — exit 0:

```
1..1283
# tests 1319
# suites 0
# pass 1319
# fail 0
# cancelled 0
# skipped 0
# todo 0
# duration_ms 27256.9411
```

The tests added or rewritten, by their names in that output:

```
ok 309 - a navigate-and-extract Flow that holds no navigation node fails on that, ahead of what its records said
ok 318 - a task whose instruction begins by going somewhere needs a Flow that can go there
ok 319 - a form or extract task works on the page it was given, so it is not held to reaching one
ok 410 - a failed run that left no failed attempt has no recovery to wait for, so it settles instead of spending five minutes
ok 426 - a failed Flow carries the category of the failure that decided it, and one with no failure says what is known instead
ok 427 - a Flow that ran clean and answered wrongly says so, and one that recovered every fault is not blamed for the fault
ok 439 - every attempt of a node carries the node's own ending, whichever attempt it is
ok 440 - a node whose last attempt did not succeed is where the run stopped, and it takes its earlier attempts with it
ok 441 - an attempt that names no node is its own group, so unnamed attempts never fold into one invented node
ok 442 - a run with no attempt answers vacuously, so a caller that cares establishes it has attempts first
ok 449 - the run's failure is the one that decided it, and a fault the ladder recovered from is reported as recovered
```

`ok 409 - a run left with a failed attempt waits the full recovery record wait`
is the pre-existing 300-second test, renamed for what it now pins; it still
asserts the clock reached 300,000–301,000 ms, so the long wait is unchanged
where a recovery could be in flight.

**`pnpm check`** — exit 1, on a failure that is not mine:

```
  FAIL  [working-docs] docs/working/README.md is out of date with the documents'
        header blocks. Run "pnpm structure:baseline" to regenerate it.

structure-audit: 1 violation(s) across 1 rule(s).
```

I confirmed it is pre-existing: `node scripts/structure-audit.mjs` in the
supervisor's own checkout `F:/!FluxIQWebExtension` on `dev` prints the identical
line, and I edited no file under `docs/working/`. The rule reads only top-level
`docs/working/*.md` (`scripts/structure-audit/rules/working-docs.mjs:74-81`), so
this report, in `reports/`, does not affect it. It is a regeneration the
supervisor owns.

Because the audit is first in `pnpm check` and stops it, I ran the remaining
stages individually — all exit 0:

- `pnpm structure:test` — `# pass 182 / # fail 0`
- `pnpm lab:test` — `# pass 88 / # fail 0 / # skipped 1`
- `pnpm task:test` — `# pass 116 / # fail 0`
- `pnpm -r check` (10 packages, `tsc --noEmit`) — `Done`, no diagnostics

**The two `ten-sites-r5` runs, replayed through the changed code.** Each run's
`snapshots/flow-lane.json` was rebuilt into a Core run detail and served to the
real `executeRecordedFlowRun`, `flowLaneObservation` and `createdFlowOwnPage`.
No run, no browser, no provider. Output:

```
=== run-mudwci8d-de88aa32 (navigate-and-extract, everything-store-first-page-plus-earbuds) ===
  recorded automationFailure  : {"category":"target_not_found","code":"web.target.not_found"}
  now reported                : {"category":"unexpected_state","code":"flow_lane.result_refuted"}  (verdict failed)
  deciding failure            : null
  recovered failures          : ["web.target.not_found","web.action.failed"]
  own page                    : {"required":true,"navigationNodes":0,"reached":false}
  recovery could be running   : false  (so the wait is the 5s grace)
=== run-mudw1ktb-0557816b (navigate-and-extract, everything-store-plus-earbuds-under-50) ===
  recorded automationFailure  : {"category":"ambiguous_or_unknown"}
  now reported                : {"category":"unexpected_state","code":"flow_lane.result_refuted"}  (verdict failed)
  deciding failure            : null
  recovered failures          : []
  own page                    : {"required":true,"navigationNodes":1,"reached":true}
  recovery could be running   : false  (so the wait is the 5s grace)
```

Read against the post-mortem, that is:

- **`run-mudwci8d`** was headlined `web.target.not_found`, a miss its own retry
  absorbed. It is now headlined by the fact that its Flow **holds no node that
  reaches its own page** (`flow_lane.flow_does_not_reach_its_page`, asserted
  first in the lane), and the two faults it did meet are recorded as recovered.
  Had it reached its own page, it would have been reported as
  `flow_lane.result_refuted` — Core judged the answer and said no — instead of
  as a target miss.
- **`run-mudw1ktb`** was headlined `ambiguous_or_unknown` with no code. It is
  now `unexpected_state` / `flow_lane.result_refuted`, and because its Flow does
  carry a navigate node it is correctly **not** failed on (3); it goes on to
  fail on its dataset, which is the true story.
- **Both** left no failed attempt, so both take the 5-second grace. On the
  post-mortem's measurements that turns roughly 311 s of dead wait per run into
  about 5 s: run 1 from 417 s to about 111 s, run 2 from 479 s to about 173 s,
  and the campaign's 959 s of run time to about 347 s.

The replay script is `t097-replay-r5.mjs` in this session's scratchpad. It is
not committed: `test-runs/` is untracked evidence and a test that depended on it
would not be reproducible.

---

## Files changed

New:

- `packages/test-runner/src/flow-lane/node-recovery.ts`
- `packages/test-runner/src/flow-lane/tests/node-recovery.test.ts`
- `packages/test-runner/src/flow-lane/creation/own-page.ts`
- `packages/test-runner/src/flow-lane/creation/tests/own-page.test.ts`

Changed:

- `packages/test-runner/src/flow-lane/persisted-flow-run.ts`
- `packages/test-runner/src/flow-lane/lane-observation.ts`
- `packages/test-runner/src/flow-lane/terminal-run-wait.ts`
- `packages/test-runner/src/flow-lane/creation/lane.ts`
- `packages/test-runner/src/flow-lane/creation/snapshot.ts`
- `packages/test-runner/src/flow-lane/run-flow-lane.ts` (snapshot gains `recoveredFailures`)
- `packages/test-runner/src/flow-lane/expectations.ts` (one doc paragraph)
- `packages/test-runner/src/flow-lane/index.ts`, `creation/index.ts` (barrels)
- `packages/test-runner/src/flow-lane/tests/persisted-flow-run.test.ts`
- `packages/test-runner/src/flow-lane/tests/lane-observation.test.ts`
- `packages/test-runner/src/flow-lane/tests/granted-run-settlement.test.ts`
- `packages/test-runner/src/flow-lane/creation/tests/lane.test.ts`

## Not verified

- **Nothing was run live.** No Lab run, campaign, browser or provider call. The
  r5 evidence above is a replay of recorded artifacts through the changed pure
  code, not a new measurement.
- **The harness still navigates.** (3) is a classification, not the removal of
  `prepareFlowPage("playback")`. A Flow that *does* carry a navigate node is
  still handed its start page by the harness, so this measurement still cannot
  say whether such a Flow would reach that page from a blank tab.
- **Whether Core ever starts a recovery for a run with no failed attempt.** I
  read `plan.ts` and `stages.ts` in Core and they say it cannot plan one; I did
  not run Core to confirm it never writes a record anyway. The 5-second grace is
  the hedge, and the worst case if I am wrong is the state the run already
  reaches today after five minutes: reported as it stands, `unsettled:
  "recovery"`.
- **One unreproduced test failure.** The first full
  `pnpm --filter @fluxiq-web-extension/test-runner test` after the build reported
  `# pass 1318 / # fail 1`; the failing name was lost to shell truncation, and
  five subsequent full runs of the same build were 1319/1319 clean. I could not
  identify it and it may be the machine's known faulty RAM. Worth one more look
  if it recurs.
- **`pnpm build` was not run** at the repository root. `pnpm test` for this
  package builds the package it tests, and `pnpm -r check` typechecked all ten.

## Open questions and contradictions found

1. **`prepareFlowPage("playback")` needs its own task**, with the browser
   concerns named above. It is the half of the brief's item (3) I could not
   reach.
2. **Two more producers of a bare `ambiguous_or_unknown`** remain:
   `lane-observation.ts:84` (recording lane) and `bench/evaluate-run.ts:224`.
   Core has a third (`adaptive-orchestrator.ts:152`). A reader of an artifact
   still cannot always tell which of them wrote it.
3. **`unexpected_state` is the closest member Core's closed list has** for "the
   Flow ran and answered wrongly". If that case is going to be the dominant one
   on these sites — and the post-mortem says it is — Core's list may want a
   member that names it, which is a Core change with a migration note.
4. **`assertFlowFailure`'s "unexpected failure" message** is what became
   `summary.json.firstFailure` for run 1. With (1) fixed it no longer fires for a
   recovered fault, so the campaign's `firstFailure` will now come from the
   own-page or dataset assertion instead. The campaign summary builder was not
   examined and is not in my paths.
