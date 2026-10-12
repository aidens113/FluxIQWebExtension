# Lane D W1: rate-limit adaptation trace, `run-mv0fuual-f9e6f089` (read-only)

Paths: R = Core `.../automation-studio/runtime`, N = Core `.../automation-studio/nodes`, E = extension
`apps/extension/src`, D = `domain/src`. All line numbers are from the t275 worktrees as read on 2026-10-09.

## Outcome

Done. All four questions are answered from code and from the run's own records: the eight command attempts, the
two trial event streams in the project object store, and the decide requests. One claim was checked by running
code rather than by reading it: `builtin.timing.wait` halts a run instead of pausing it.

**Main finding.** Today the build cannot express what the user expects, at three separate levels:

- **The format refuses it.** An in-span dismissal, an in-span branch and an in-span `when:` block are all refused
  at assembly.
- **The one pause node does not pause.** `builtin.timing.wait` is offered in the catalog as "Pause execution for a
  fixed duration", but it ends the run as `waiting`. The node after it never runs and nothing can resume it.
- **The trial feedback hides the event.** The model sees `attempts: 2` and nothing else, so it is never told that a
  rate limit happened.

## What changed and why

Nothing in the source. The only file written is this report. I also wrote one scratch probe outside the repo
(scratchpad `w1probe/wait-probe.mts`) to run the executor once.

## 1. Script format: what a `repeat over` span can hold

The parser accepts every one of these shapes. They are refused at **assembly**
(`R/flow-bootstrap/authoring/assemble.ts:99-105`): first `optionalScriptSteps`, then
`routeAutomationStudioFlowScriptRepeats`, each answered as a submission refusal.

| Shape | Allowed in a span? | Where refused | Enforced by |
| --- | --- | --- | --- |
| (a) `optional: yes` step (dismiss if present) | No | `assemble.ts:319` `flow_script.optional_misplaced` ("is part of a repeat, which runs it on every pass"); guidance `plan/flow-script-format.ts:218` | Assembly (validation) |
| (b) `on <port>: go to` inside the span | No | `authoring/draft-routing.ts:317` `flow_script.repeat_body_branches`; branch from outside into span `:322-323` `flow_script.branch_into_repeat`; guidance `flow-script-format.ts:265` | Assembly (validation) |
| (c) `when:` block reached mid-loop | No | A block is chosen only by the router before any step runs (`flow-script-format.ts:147`); a span step that runs a block is refused `draft-routing.ts:318` (`repeat_body_branches`, "runs a block"); a repeat inside a repeat `:316` | Assembly (validation); router semantics |
| (d) fixed pause between iterations | Syntactically yes, functionally no (see below) | n/a | n/a |
| (e) pace that grows after a rate limit | No syntax exists | `REPEAT_PARTS` is only `over, through, while, most` (`authoring/parse.ts:50-51`); `repeat most` beside `repeat over` refused `draft-routing.ts:304` | Parser has no key; an unknown key becomes `unknown_parameter` |

Notes on (a): even with `assemble.ts:319` lifted, the optional step is already rewritten into a `failed -> Merge`
branch before repeat routing runs (`assemble.ts:342-344`, then `:105`). `draft-routing.ts:317` would therefore
refuse it as a branch inside the span. Allowing it needs both places changed, plus `emitRepeatOver`
(`draft-routing.ts:442-500`) to accept a forward branch to a Merge inside the span.

**(d) Every catalog node that waits for a time or a state, as offered in this run.** The decide request is
`RUN/steps/0035-decide/request.json` (nodeCatalog `timing`, `web`, `control-flow`).

| Node | Parameters | What it actually does | In a span? |
| --- | --- | --- | --- |
| `builtin.timing.wait` (`N/timing/wait.ts:4-35`) | `duration` (default 1000), `unit` (ms/s/min), `jitterMs` | Returns `status: "waiting"` with a `durationMs` output (`wait.ts:33`). Nothing in the runtime reads `durationMs`. `graph-run.ts:548-557` returns the whole run as `waiting` with no `parked` record, and `executor/resume.ts:54` refuses to resume a trace without one ("not_parked"). **The probe confirms it:** a Flow `wait -> builtin.math.add` returned `{"status":"waiting","ms":8,"nodes":[["wait","waiting"]],"parked":null}`. It never slept and never reached the next node. | Allowed (a plain step), but it would stop the trial at the first pass. How the trial gate treats a `waiting` trace was not checked. |
| `builtin.timing.retry` (`N/timing/retry.ts:18-47`) | `attempts` 3, `delayMs` 500, `backoff` fixed/linear/exponential, `jitterMs` | A policy for the node its `success` edge feeds, read by `R/executor/retry-policy.ts:49`. It adds waits between **failed** attempts of that node only. It does not pace successful passes. | Allowed in order, but it is not a pace. |
| `builtin.timing.timeout` / `builtin.timing.debounce` | `timeoutMs` / `windowMs` | `emptyResult` pass-throughs (`timeout.ts:21`, `debounce.ts:28`). No wait. | Not useful. |
| `web.output.dom-wait_for_selector` (`D/output-nodes/definitions.ts:297`, schema `D/actions/schemas.ts:112-120`) | target, `timeoutMs`, `wait.condition` in present/visible/enabled/absent/url/stable, `wait.stableForMs` | Waits for a state. `condition: stable` with `stableForMs: N` is close to "pause N ms on a quiet page" (`E/content/action-runtime/wait-conditions.ts:125-128`), timed from the last DOM change, within `timeoutMs`. `condition: absent` on the notice would be "wait until the notice is gone", but the notice never leaves on its own. | Allowed (plain step). It works as an unofficial pause but is not taught. |
| `web.output.dom-wait_for_text` (`definitions.ts:298-301`, `schemas.ts:281-285`) | `text` (required), `timeoutMs` 10000, `wait` | Waits for text to appear, or for the page to settle. Both trials put it after each Confirm (`$row.name`), as in the loop example (`flow-script-format.ts:299-301`). | Allowed. It took about 0.1-0.2 s per pass. |
| `builtin.control.loop` / `repeat` / `branch` / `switch` | n/a | Conditionals need `on <port>:` lines, which are refused in a span. | No |

**Verdict for question 1.** A candidate script cannot put a dismiss step, a branch or a block inside a span, and it
has no pace syntax. The one node built to pause is in the catalog, may sit in a span, and halts the run, which is a
latent defect. The only working pause is the untaught `wait_for_selector` with `condition: stable`.

## 2. Runtime behaviour in this run

**The node-level retry.** Core's fault assessment `R/executor/defensive/assess.ts:53-112` reads the producer's
record `{category: action_failed, code: web.action.rate_limited, retryable: true, effect: "unacted",
retryAfterMs: 5500}`. Because the effect is `unacted`, gate 3 at `:102` does not refuse it. The record's
`retryAfterMs` becomes `hintedWaitMs` (`:65-67` -> `retry-hint.ts:14,42`). The ladder chose `retry_node`
("1 of 4 attempts"). `graph-run.ts:631-640` then waits `max(backoff, hint)`, held to 30 s per wait, 60 s per node
arrival and 300 s per run (`retry-wait.ts:8-29,48-59`). The trace records `retry: {attemptNumber: 2, maxAttempts: 4,
backoffMs: 5500, rung: "retry_node"}` (6500 for trial 2's Jonas). **The wait itself was exactly the hint.**

**Why the re-press came about 8.3 s after the refusal settled.** Core finishes the failed attempt, then takes its
after-action page snapshot and diff (`R/executor/node-execution/attempt.ts:199` -> `host-state.ts:22-55`), and
only then starts the wait. Observed timestamps (Core trace and command attempts):

| Refusal | Extension: dispatch -> settle (notice seen at 9 ms) | Core: failed finish -> after-snapshot | Snapshot -> next attempt start (the wait) | Next start -> dispatch | Settle -> re-press dispatch |
| --- | --- | --- | --- | --- | --- |
| T1 Jonas `361381fe` | 3782 ms | 2662 ms | 5505 ms | 99 ms | 8274 ms |
| T1 Freya `0228c953` | 2877 ms | 4624 ms | 5502 ms | 91 ms | 10223 ms |
| T2 Jonas `e1226c26` | 4114 ms | 2925 ms | 6517 ms | 67 ms | 9513 ms |
| T2 Freya `acc3e9aa` | 2529 ms | 3900 ms | 5505 ms | 122 ms | 9530 ms |

So the extra time is Core's after-action snapshot of the refused attempt, 2.7-4.6 s. An accepted press's snapshot
takes about 1.1 s, for example `72b1b006` finish 914870 -> snapshot 915999. The wait does not count time that has
already passed. The page's hint is measured from the notice ("try again in 5 seconds" + 500 ms margin,
`E/content/action-runtime/rate-limit-notice.ts:118-125,288-295`), yet Core starts its clock after the extension's
hold and the snapshot. Relative to the press, the re-press came 12.0-13.6 s later where 5.5-6.5 s was asked. That
is why the notice stayed up for 12-14 s.

**Why the extension's refused press took 2.5-4.1 s, against about 1.0-1.4 s for an accepted press.** I did not
attribute this. Possible causes are the `Promise.all` of three watches in `E/content/actions/click.ts:250-260` (the
robot-check settle with `ROBOT_CHECK_WAIT_MS` and the 800 ms ignored-press window, `:119-132,386-390`) and the
response snapshot (`click.ts:156`).

**The extension's blocking-dialog absorption on the re-press.** The refused notice was left open on purpose:
nothing in the watch presses anything (`rate-limit-notice.ts:35-37`), and the in-page recovery leaves
`rate_limited` to Core (`E/content/action-runtime/recovery/fault.ts:113-121`, `ABSORBED_ELSEWHERE`). On the
re-press, the target was covered by the notice. The recovery loop maps `blocked_by_dialog` to `blocking_dialog`
(`fault.ts:165,210`), calls `intervene` = `clearInterference()` (`recovery/attempt.ts:80,139`;
`interference/clear.ts:75`), which presses the layer's allow-listed way out ("OK"), and presses again. The result's
`validation.actual` says "recovered on attempt 2 after absorbing blocking_dialog, closing 1 dialog ..., waiting
150 ms" (wording `recovery/account.ts:92`). So the wait, the OK and the return to the loop all happened inside one
node, invisible to the Flow.

**Does anything slow later presses or iterations? No.**

- `E/background/page-pace` (`origin-pace.ts:1-30`) books **document loads** only: navigations
  (`E/runtime/action-runner.ts:92`), paginated reads and next-page across documents (`:365-387`), and a click that
  lands on a 429/503 document (`E/runtime/rate-limited-landing.ts`, `click-landing.ts:266`). An in-page notice
  refusal is never told to any pace.
- Core has no pacing concept. A grep of R for pace/pacing finds only unrelated text.
- Nothing carries over between passes. The pass cadence was about 3.3-3.4 s per row (for example `s9` starts at
  890796, 894241, 897558 and 901014 in trial 1). The page allows 3 Confirms per 15 s window
  (`rate-limit-notice.ts:4-6`), so the 4th and 7th presses were refused in both trials.

**Core's route-by-state for unavailable steps.** `graph-run.ts:559-583` -> `R/executor/state-routing/decision.ts:17-67`
applies only when `automationStudioCouldNotRun` holds: `failed` **and** `failure.category === "target_not_found"`
(`state-routing/could-not-run.ts:5-19`). It explicitly excludes "an action that ran and failed" and a covered
target. The refused press is `action_failed` at stage `execution`, so state routing does not apply. Even if it did,
it routes only to a node of the same Flow whose recorded pre-state matches the page (`decision.ts:53-65`), and the
Flow has no dismiss node. **It could not have routed to a dismiss node.**

**Verdict for question 2.** The runtime honoured the hint exactly, but started counting only after a 2.7-4.6 s
after-action snapshot. The extension closed the notice on the re-press as a blocking dialog. Nothing paces later
presses, and state routing does not apply to a refused press.

## 3. Trial feedback

- **Confirmed.** `R/service/candidate-trial/feedback.ts:89-97` (`executedSteps`) folds an attempt of the same node
  that follows a failed attempt into one step. The folded entry **replaces** the failed attempt with the successful
  one (`:93`), so `failure` is undefined at `:68-76` and the step carries only `attempts: 2` (`:71`). Observed in
  `RUN/steps/0036-tool-core.test_candidate/result.json`, where `"attempts": 2` appears twice with no code, wait or
  row. `summary.ts:17-35` is the judge's summary and adds nothing about it.
- **Where the facts are.** The failed attempt is still in `trace.attempts`, immediately before the re-press. It
  holds `failure = {category, code: "web.action.rate_limited", retryable, stage, expected, actual, effect: "unacted",
  retryAfterMs: 5500}` (Core attempt record, observed), `metadata.recoverySelected` (`retry_node`) and
  `metadata.adaptiveFailure`. The re-press attempt holds `metadata.retry.backoffMs` (the wait actually taken). The
  row is the preceding `builtin.control.for-each` attempt in the same trace; I did not read its exact output field.
  The "closed 1 dialog" fact is in the extension result's `validation.actual` (`72b1b006`), which is producer prose
  kept free of page content.
- **Guidance.** Nothing in the format, the act example, the loop format (`flow-script-format.ts:131-302`) or the
  candidate tool description (`R/flow-bootstrap/candidate/authoring-loop.ts:39`) mentions rate limits, pacing or
  waiting between passes. Neither does the run's decide request (no "too fast" or "rate limit" text). The only
  mention in candidate code is a comment in `candidate/trial-gate.ts:19-28` about re-test permission.

**Verdict for question 3.** Confirmed: the feedback carries only `attempts: 2`. The refusal code, the wait and the
row are all in the trace one attempt earlier and are dropped by `executedSteps`. No guidance covers rate limits.

## 4. Recommendations, smallest first

| # | Change | File / function | Effect | Cost |
| --- | --- | --- | --- | --- |
| a | **Name what a step absorbed.** In `executedSteps`, keep the failed attempts that were folded away; in `steps()` add per step `absorbed: [{failureCode, retryAfterMs, waitedMs, pass}]` plus a sentence that the run waited and closed the page's notice | `R/service/candidate-trial/feedback.ts` `executedSteps` (:89), `steps` (:62) | The model learns "row 4 (Jonas) and row 7 (Freya): refused for going too fast, waited 5.5 s, the run closed the notice and pressed again" | Small; Core only; unit tests beside it. It changes no Flow, and alone it gives the model nothing to write (see c1). |
| a2 | **Count elapsed time against the hint.** Wait `max(0, hint - (now - attempt.finishedAt))`, or take the snapshot after the wait | `R/executor/graph-run.ts:631-640`; or `node-execution/attempt.ts:199` ordering | 2.7-4.6 s less per refusal; the notice is up for about 6 s instead of 12-14 s | Small; the hint is page-relative, so this is conservative |
| b | **Guidance.** One sentence in the loop format: when trial feedback says a press in a span was refused for going too fast, the run already waits and closes the notice, so do not add dismiss or retry steps; add a pause after the act in the span of at least the wait named | `R/flow-bootstrap/plan/flow-script-format.ts` `AUTOMATION_STUDIO_FLOW_SCRIPT_LOOP_FORMAT` (candidate-only, outside the legacy byte ratchet) | Points the model at the right revision | Text only. Useless until c1 makes a pause work. |
| c1 | **Make `builtin.timing.wait` pause.** In the graph run, a wait node sleeps `durationMs` (signal-aware, as `automationStudioRetryDelay` `graph-run.ts:266-275`, held to a run bound) and continues on `success` instead of returning the run `waiting`. `builtin.routine.approval` keeps parking. | `R/executor/graph-run.ts:548-557`; `expected-transition.ts:22,40` | A model-written `step: pause / node: builtin.timing.wait / duration: 5 / unit: seconds` inside the span works with **no new syntax**, because plain steps are already allowed in spans. It also fixes a catalog node that currently halts any Flow using it. | Moderate; executor change plus tests; the comparison status of wait changes from tolerated `waiting` to `succeeded` |
| c2 | **`repeat pace: <ms>` on a repeat** (parse key, contract field, a for-each/repeat parameter such as `minIntervalMs`, honoured by the executor between passes) | `R/flow-bootstrap/authoring/parse.ts` `REPEAT_PARTS` (:51) and `repeat()` (:182); `contracts.ts` `AutomationStudioFlowScriptRepeat`; `draft-routing.ts` `scriptSpan`/`emitRepeatOver`; for-each node in `N/control-flow/`; `graph-run.ts` | A declared, visible loop pace | Larger than c1; the same effect as c1 with clearer intent |
| c3 | **Allow an in-span conditional dismissal** (`optional: yes` inside a span) | `assemble.ts:319` refusal; `draft-routing.ts:317` refusal; `emitRepeatOver` to wire an inner `failed -> Merge` | Makes "if the notice shows, press OK" visible in the Flow | Moderate. It mostly duplicates the extension's blocking-dialog absorption. The notice appears *after* the press, so a dismiss step before the press only helps the next pass, and the refused row would still need the node retry. |
| d | **Runtime adaptive pacing.** After a `web.action.rate_limited` attempt on node N inside a for-each, set N's spacing to at least `retryAfterMs` (or the refusal's observed interval) in the run's defence state, and wait before N's next dispatch until last dispatch plus spacing. On promotion, write the learned spacing into the Flow, for example as a `paceMs` parameter on N or the for-each, so playback starts paced. | `R/executor/graph-run.ts` (arrival/dispatch, `runState.defence`); `R/service/candidate-trial/promotion.ts`; the Flow schema or node parameters | Later passes stop meeting the limit within the trial; playback starts paced without a model call. Here a 5.5 s spacing would avoid the 7th-press refusal (3 per 15 s). | Largest; it touches executor state, promotion and the Flow contract; it needs live validation on social-network-feed |

**What meets the user's expectation.** The user expects the build to revise the Flow: handle the notice state and
slow the loop. **a + b + c1** delivers exactly that through the model. The trial names the refusal, the guidance
names the fix, and a pause step in the span now works. The notice handling stays the runtime's: wait, OK and
re-press already happen inside the node. c3 is needed only if the dismissal must appear as a Flow step. **d**
delivers the same outcome deterministically with no extra model call or trial, and persists the pace into
playback; it is the robust default. a2 is an independent quick win. I recommend a + a2 + c1 + b now, then d.

## Commands run and observed results

- Attempt timings: `node -e` over the eight `command-attempts/attempt.<id>/attempt.json` files. Observed
  dispatch/settle pairs as in the table above, and `failure.retryAfterMs` of 5500/5500/6500/5500.
- Core traces: `node -e` over the project objects `sha256/13/e2/13e2e6...json` (trial `e4c57a76`) and
  `c7/76/c77626...json` (trial `c114f870`). Observed `retry.backoffMs` 5500/5500/6500/5500 and
  `stateRefs.afterAction.capturedAt` gaps of 2662/4624/2925/3900 ms.
- Catalog and guidance: `grep -o` on `RUN/steps/0035-decide/request.json`. The timing, web and control-flow node
  lists were as quoted; there was no rate-limit or pace guidance.
- Probe: `npx --no-install tsx <scratchpad>/w1probe/wait-probe.mts` from the Core `packages/fluxiq` folder.
  Printed `{"status":"waiting","ms":8,"nodes":[["wait","waiting"]],"parked":null,"finishedAt":null}`.
- No vitest suites were run.

## Not verified

- What used the extension's 2.5-4.1 s on a refused press (watch settles versus the response snapshot).
- Why the after-action snapshot of a refused attempt costs 2.7-4.6 s against about 1.1 s otherwise.
- The exact output field on the for-each attempt that names the current row.
- How the candidate trial gate classifies a trace that ends `waiting` (relevant only until c1).
- That a 5.5 s spacing fully avoids refusals on social-network-feed. This is inferred from the 3-per-15 s window
  comment, not run.

## Open questions or contradictions found

- `builtin.timing.wait` is offered to the model as "Pause execution for a fixed duration" but halts the run with no
  resumable park. Its description and its behaviour contradict each other.
- `rate-limit-notice.ts:4-6` documents a 12-second wait on social-network-feed, but this run's notices named
  5-6 s. The fixture's countdown evidently varies, which is consistent with a sliding window.
