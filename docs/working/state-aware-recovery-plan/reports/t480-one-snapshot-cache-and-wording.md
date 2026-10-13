# t480 worker report: one page snapshot per web step, the post-trial view keeps the cache, wording

Status: Complete
Created: 2026-10-12
Owner: t480 worker

## Outcome

Done. All four defects were checked against the evidence and source. Defects 1-3 are fixed in Core and the
domain, with tests. Defect 4 was not a defect: run `913768d7` was round 11's own model-free replay
(`replay-mv5ypd5y-74061ea8`), and it passed. Nothing is committed.

## What changed and why

### Defect 1: two page snapshots per web step (confirmed)

- Cause: for every web node, Core's executor asked the host for a `before_action` capture and an
  `after_action` capture. Each one cost a full gateway snapshot plus sanitising in the domain. Node N's
  after-capture and node N+1's before-capture read the same page a few milliseconds apart, with nothing in
  between.
- Fix (Core `runtime/executor/host-state.ts`):
  - The run remembers the page its last attempt ended on, and when it arrived: `runState.pageEnded`, a new
    optional field in `executor/run-state.ts`.
  - The next attempt's `before_action` capture is offered that page as `previousStateRef`, an existing field
    of the capture context that was unused until now. The offer is made only when both hold:
    - no other attempt started since. Any attempt's start spends the offer, so a node between the two
      always leads to a fresh read: a Wait, a Call Flow whose child acts, or an interference handler.
    - it arrived within 250 ms. That is well under one capture's own round trip, which measured about
      450 ms. A pace, a readiness wait, an expected state that waited, or a retry backoff therefore all
      lead to a fresh read.
  - `node-execution/attempt.ts` passes `runState` through, a mechanical change. The contract comment on
    `previousStateRef` in `runtime/host-runtime.ts` now says what it means on a capture.
- Fix (domain `runtime/host-runtime.ts`):
  - For a web node at `before_action`, if the offered ref is this host's own (`web.state.` id, with a
    view), it is returned unchanged and no gateway dispatch is made.
  - Non-web nodes are still declined. An offer is ignored at `after_action`, and when it is foreign or has
    no view.
- No evidence is dropped:
  - Every attempt still carries `beforeAction`, `afterAction` and `stateDiff`.
  - The reused `beforeAction` is the same object: the same view, `from` reset token, `documentTimeOrigin`
    and `capturedAt`. Its `stateRef` names the capture that read it.
  - No consumer parses the point out of a `stateRef`. I checked `run-start-pages.ts`,
    `transition-comparison.ts`, `result-summary.ts` and the domain diff.
  - A host that ignores the offer behaves exactly as before.

### Defect 2: the post-trial view broke the provider cache (confirmed and reproduced)

- Cause:
  - The t477 look runs through `executeTool`, so the describing wrapper marks the look node described and
    adds `describedNodes: [id]` to the look's evidence.
  - `trial-view.ts` nested that evidence under `pageAfterTrial`, but `placeDescribedNodes` in
    `deepseek/request-body.ts` only reads top-level keys.
  - The definition therefore fell back into the head's `flowBootstrap.describedNodes`, in front of the
    whole window.
- Fix (Core `flow-bootstrap/candidate/trial-view.ts`): `describedNodes` is lifted off the look's page onto
  the trial answer's top level, merged with any ids already there. It is lifted even when the look was
  refused. The trial answer is the window entry the page arrives in, so the definition is appended and no
  earlier byte changes.
- `request-body.ts` is unchanged.
- I rejected running the look with `AUTOMATION_STUDIO_NODE_REPLAY_KEY`. That key carries replay semantics
  (`reset`/`step`/`verify`) in `replay-draft.ts`, so it is not a neutral "Core's own look" marker.

### Defect 3: wording (all three confirmed)

- **Split note** (`service/candidate-trial/feedback.ts`):
  - `SPLIT_NOTE` is now used only when the feedback carries `unconfirmedReading`.
  - Otherwise `UNREAD_SPLIT_NOTE` applies. It names only `answeredReading`, says "the other call named no
    defect, so it gives no evidence to weigh", and makes a retest the default where the evidence supports
    the yes.
  - It does not claim the other call said "could not tell", because the verdict does not say whether it
    was `unknown` or a `no` with an empty reading. Both are true to "named no defect".
- **Check card** (`ui/activity-action/check-why.ts`):
  - `BARE_STORED` is replaced by `OPENS_STORED`, which matches a clause that opens with a stored count,
    whether or not more follows.
  - When "What it found" opens that way, the reason is read from the next sentence. With no next sentence,
    the card falls back to Core's own words, as before.
  - Number words ("two", …) are now plain openings, so the reason starts in lower case after "but".
- **Unsure narration**:
  - `activity/candidate/trial-words.ts` marks `unsure`/`not_judged` with `unconfirmed: true`.
  - `activity/candidate/result.ts` passes the mark through, and `activity/observer.ts` hands it on as
    `"unconfirmed"`.
  - `activity/decision-answer/narration.ts` then says "The AI model expected this version to do what was
    asked, and the test couldn't confirm whether it does." in place of `TEST_FAILED`.
  - The card's own line was already true ("…couldn't be confirmed") and is unchanged.

### Defect 4: run 913768d7 (traced; no code change)

- Evidence: `913768d7-970b-4208-8095-9b1459c66b99` is the runtime run of
  `test-runs/instances/t451-slot-1/replays/replay-mv5ypd5y-74061ea8.json`.
  - Its timings are queued 00:48:22Z, started 00:48:27Z and finished 00:49:22Z. The record was written at
    17:49:27 PDT.
  - The replay passed: `succeeded`, 26 actions, 13/13 records, 52/52 fields, zero model calls, with
    `modelProvidersEnabled: false`.
- Source: the Lab's separate `replay` invocation (`packages/test-runner/src/saved-flow-replay/replay-saved-flow.ts`
  via `cli.ts`). It is not chained to `lab run`.
- Who ran it: the supervisor's audit (`live-testing-handoff-audit-2026-10-11.md:285`) records it as round
  11's planned C replay, alongside B's `replay-mv5yofwd`. Round 10 had the same pattern
  (`replay-mv5ua5x5`, two minutes after its run).
- Why the debug saw "running with 0 actions": it copied `project.sqlite` while the replay was still
  running, and listed `replays/` before the record was written. Nothing should be stopped. The debug's
  line "No model-free replay of this run exists" is wrong.

## Files changed

Owned:

- Core `runtime/executor/host-state.ts`
- Core `runtime/flow-bootstrap/candidate/trial-view.ts`
- Core `runtime/service/candidate-trial/feedback.ts` (split note only)
- Core `ui/activity-action/check-why.ts`
- Core `runtime/activity/candidate/trial-words.ts`
- domain `runtime/host-runtime.ts`

Tests:

- Core `executor/tests/host-state/tests/one-capture-between-steps.test.ts` (new). It sits in a feature
  group because `executor/tests/` was at the 25-file limit.
- Core `flow-bootstrap/candidate/tests/trial-view.test.ts`
- Core `service/candidate-trial/tests/feedback.test.ts`
- Core `ui/activity-action/tests/action-of.test.ts`
- Core `activity/tests/narration.test.ts`
- domain `runtime/tests/host-runtime.test.ts`

Outside the owned list, all small:

- Core `runtime/executor/run-state.ts`: the `pageEnded` field.
- Core `runtime/executor/node-execution/attempt.ts`: passes `runState` to capture and enrich.
- Core `runtime/host-runtime.ts`: doc comment on `previousStateRef`.
- Core `runtime/activity/candidate/result.ts`, `runtime/activity/observer.ts` and
  `runtime/activity/decision-answer/narration.ts`: the unconfirmed path, which `TEST_FAILED` lives behind.

Not touched: `deepseek/request-body.ts`, `site-reset/`, `trial-gate`/start-check, result-verification, and
the script format.

## Commands run and observed results

- `npx vitest run <executor, flow-bootstrap/candidate, service/candidate-trial, activity, ui/activity-action, llm/deepseek (incl. system-prompt pins), llm/tests/provider-cache-prefix, runtime/tests/executor, live-patch-target-override, llm/harness-options, flow-change/tests/trial, service-flows/tests/runs, opaque-target-execution, service-adaptation/tests/llm-run-caller>`
  (Core `packages/fluxiq`) printed `Test Files 211 passed (211)` and `Tests 2074 passed (2074)`.
  - The system-prompt pins test passed without a re-pin; no pinned prompt text changed.
  - After the test move and the retyping, the two affected files reran green: `Tests 9 passed (9)`.
- Regression proof for defect 2: with `trial-view.ts` restored to HEAD, the new cache test failed. The
  received request held `"describedNodes":[{"id":"builtin.logic.or"…` inside the head's `flowBootstrap`,
  ahead of `evidenceLoop`. With the fix it passes, and the definition appears once.
- Snapshot timing, Core simulated clock (13 web steps, the Lab trial's shape, 0.45 s per read and 1 s per act):
  - before: 26 reads, so 13 x 1000 + 26 x 450 = 24,700 ms;
  - after: 14 reads, so 13 x 1000 + 14 x 450 = 19,300 ms.
  - The test asserts both totals and the N+1 read count exactly.
- Snapshot timing, domain, real time (one web step's two captures against the real host runtime, a
  400-control page and 40 ms gateway latency): the test printed
  `# one web step's captures: before t480 2 reads in 118.0 ms; after 1 read in 62.3 ms`. An earlier run
  printed 118.7 ms against 61.2 ms.
- `pnpm check` (Core `packages/fluxiq`, tsc) exited 0.
- `pnpm check` (domain) exited 0. The first run exited 2 on a test-only `exactOptionalPropertyTypes` error,
  which I fixed.
- `DOMAIN_TEST_BUILD_LABEL=t480 pnpm test runtime/tests/host-runtime` printed `# tests 20 # pass 20 # fail 0`.
  - The domain tests needed a Core rebuild first:
    `pnpm --filter @fluxiq/contracts --filter fluxiq --filter @fluxiq/client-gateway-websocket build`
    printed `fluxiq build: Done`.
- The domain tests that bind the host runtime (policy registration, call-route-states, carried(-row)
  service repair, state-routing-run, host-runtime) printed `# tests 50 # pass 50 # fail 0`.
- `pnpm structure:check`, Core: first run, 4 violations. After moving the test into a feature group,
  replacing the `as never` stubs with typed ones and unpacking two lines, it printed
  `structure-audit: passed (336 warning(s), 1159 baselined)` and
  `2 baseline entries can be lowered`.
- `pnpm structure:check`, downstream, printed `structure-audit: passed (187 warning(s), 646 baselined)`.
- No paid run. No Lab run.

## Not verified

- No headed or live browser run, so the Lab-scale saving is not measured live. Expected: about 12 fewer
  gateway snapshots per 13-node trial. That saves 12 x the before-capture cost (about 0.45 s each, so
  about 5-6 s per trial) if the 1.45 s gap after each node is the after-capture itself, as the debug
  infers.
  - The debug did not profile where each capture's time goes. If part of the 1.45 s after-gap is the
    extension's own post-action work (`server-command-channel.ts` runs `captureActionBoundary("before")`
    for every `execute_action`, the snapshot command included), that is extension-side and outside this
    brief.
- The Core full suite was not run, only the directories above (repository rule).
- The "2 baseline entries can be lowered" message: I did not establish whether it predates my change, and
  I did not run `pnpm structure:baseline`, because `.structure-baseline.json` is not mine.
- Architecture docs were not updated. The state-ref reuse is a runtime behaviour change the supervisor may
  want recorded in Core `docs/architecture/`.

## Open questions or contradictions found

- The debug's "No model-free replay of this run exists" is wrong (see Defect 4).
- The debug's timing model is internally odd: a before-capture inside a node costs 0.45 s, but the
  after-gap costs 1.45 s for every node, reads included. The extra second per node is not explained by
  anything in Core or the domain between `finishedAt` and `afterAction.capturedAt`. It is worth a measured
  live run, with snapshot dispatch timing, before claiming the full 25 s.
- The 250 ms freshness window is my choice, sized against the measured 450 ms capture round trip. A pace
  or a readiness wait longer than that correctly falls back to a fresh read.
