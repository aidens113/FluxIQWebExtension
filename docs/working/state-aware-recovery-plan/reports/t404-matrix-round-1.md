# t404: matrix round 1 (worker report)

Trees: downstream `fxwork/t404/!FluxIQWebExtension` and Core `fxwork/t404/!FluxIQ`, both on
`task/t404-matrix-round-1`. Nothing is committed.

- Downstream: fast-forwarded by main to dev `4132eea2`, which includes t396.
- Core: started at `e396d489` and was fast-forwarded by main as fixes landed: `02d0cc82` (requirement gate),
  `6a750cab` (t405 port keys, the declared-none retry, entry `requires`), and `ae826078` (an entry frame owes only
  the nodes it can reach).
- Core libraries, domain, the host bundle, extension, scenario-lab and test-runner were rebuilt through the build
  cache after every Core move, before the next launch.
- Every launch was `FLUXIQ_TEST_ENV_FILES=none pnpm lab recovery-matrix --case <id>`: headed, provider-free, one
  case per launch, no `FLUXIQ_LAB_ALLOW_*` override.

## Outcome

**Partial.**

- 10 of 14 cases pass with zero model calls: 1, 2, 4a, 4b, 5, 6, 7, 8, 13a, 13b.
- Row 3 is not-proven: the behaviour is right, but Core's run detail drops the record that would prove it.
- Rows 9, 10 and 11 fail. Each failure was safe and honest: no act was repeated and no model was called. Each was
  traced to a named Core gap that main has assigned (t406-t410).

Every failure was debugged from its run files before any rerun, and every rerun followed a fix of its stated
cause.

### Final verdict per row (latest launch on the Core named)

The first eight columns describe the run; Required behaviour is what the run's own records showed.

| Row | Verdict | Run (bundle under `test-runs/recovery-matrix/`) | Core | Required behaviour, as the run's records show it | Lifecycle / entry / routing | Failure class | Site acts | Calls |
| --- | --- | --- | --- | --- | --- | --- | --- | --- |
| 1 | passed | `rmx-2026-10-10T07-46-35-484Z-dfdf82` | ae826078 | Began at s1, the primary's first step. | No entry record (no entries declared); 0 state routes | 1 retry (busy coupon) | 3 pieces, 1 add, coupon held | 0 |
| 2 | passed | `rmx-2026-10-10T07-23-57-704Z-fbb974` | ae826078 | First attempt s7 with `entry: entry`. Store steps s1-s6 never ran (`skippedStep` s4 absent). `query` came from its default. | Entry record `entry`; 0 routes | none | towels ×2 + soap, store 1187 | 0 |
| 3 | not-proven (`entries`) | `rmx-2026-10-10T06-59-14-650Z-30bb9a` | 02d0cc82 | After the Next arrow dropped the filters, the called part re-ticked all 5 filters and read. So it began at its default, not the `read` shortcut (command-attempts in `persistent-isolated/rmx-3-b39af251`). | No part attempt and no part `entry` record in the run detail (cause C5) | 7 retries, all on navigating checks (cause C6) | cart unchanged | 0 |
| 4a | passed | `rmx-2026-10-10T07-02-42-637Z-28c468` | 02d0cc82 | The `on before everywhere` handler closed the arrival deal before s1, and the run carried on. | `before:resume`, completion true | 1 retry | 3 pieces, 1 add, coupon | 0 |
| 4b | passed | `rmx-2026-10-10T07-03-57-366Z-3bf5ac` | 02d0cc82 | Same handler, on the product page before s7. | `before:resume`, completion true | 1 retry | same | 0 |
| 5 | passed | `rmx-2026-10-10T07-49-23-480Z-9d9556` | ae826078 | The handler ran 4× (≤12), each `unhandled` with completion false. No loop. Honest end `unexpected_state/web.action.blocked_by_dialog`. | 4 × `before:unhandled` | 1 planned fail (optional chat), 1 true failure | cart 0, no coupon | 0 |
| 6 | passed | `rmx-2026-10-10T07-19-52-136Z-a76191` | 6a750cab | Only the node-scoped `main.h1-s1` ("for welcome") ran. The automation-wide handler did not run for that occurrence. | `before:resume`, first handler `…main.h1-s1` | 1 retry | 3 pieces, 1 add, coupon | 0 |
| 7 | passed | `rmx-2026-10-10T07-26-50-396Z-ed11a4` | ae826078 | The active block's handler (`h2`) answered consent. The inactive `store` block's handler never ran. Handler ids are now read, so the check cannot pass vacuously. | `before:resume` | none | soap only | 0 |
| 8 | passed | `rmx-2026-10-10T07-16-57-329Z-4f402f` | 6a750cab | Primary part failed; the `fail` handler ran the quick-add part and resolved with its `cart`. Both parts output `cart` (t405). | `fail:resolve` | 1 planned fail | soap ×2 | 0 |
| 9 | failed: safe, not reconciled | `rmx-2026-10-10T07-27-59-684Z-46a254` | ae826078 | The ack of Jonas's confirm was dropped (committing act 7, named by target). Core stopped "Outcome uncertain" after the 30 s timeout. Not repeated, not reconciled (C7). | none | 1 true failure (uncertain) | Amara, Jonas confirmed once each | 0 |
| 10 | failed: safe, route refused by design in progress | `rmx-2026-10-10T07-37-00-283Z-990f6a` | ae826078 | The retry handler on Freya ran (wait, OK, completion true), but its `go to requests` became `unhandled` (C9). The plain retry then confirmed. | `retry:unhandled`, 0 routes | 1 retry | 4 confirmed once each, rateLimited 1 | 0 |
| 11 | failed: safe, honest uncertain stop | `rmx-2026-10-10T07-39-53-059Z-bb15d9` | ae826078 | The worker was stopped as add-to-cart reached the site. The add landed once. Core timed out at 30 s and stopped "Outcome uncertain". No `interrupted` report reached Core. | none | 1 true failure (uncertain) | 3 pieces, 1 add | 0 |
| 13a | passed | `rmx-2026-10-10T07-42-28-759Z-cebade` | ae826078 | Freya's refused confirm was absorbed by the node's retry. | none | 1 retry | 4 confirmed, rateLimited 1 | 0 |
| 13b | passed | `rmx-2026-10-10T07-44-03-081Z-0e9ff2` | ae826078 | The check failed on all 4 attempts. The failed path went to the authored End, marked failed (`llm.gate.deliberate_stop`). | none | 1 planned fail, 3 retries | 3 confirmed | 0 |

Chat recovery rows: not in the bundles. The matrix runs Flows through `executeRecordedFlowRun`, not the chat, so no
chat transcript exists to read.

### Earlier launches this round (each debugged before the next)

| Case | Run | Core | Result and decisive cause |
| --- | --- | --- | --- |
| 1 | `06-36-52-124Z-b0a3a2` | e396d489 | passed |
| 2 | `06-41-37-760Z-8bb5a8` | e396d489 | not-proven: requirement gate refused `web.facts@1` (C1) |
| 8 | `06-43-16-879Z-b418d0` | e396d489 | passed, with the alternative part's output renamed `tileCart` to dodge C2 |
| 9 | `06-45-59-651Z-322a4c` | e396d489 | failed: fault counted presses and dropped "Not now" (fixture); Core then refused to retry a `consequences: none` press (C3) |
| 2 | `06-53-03-013Z-c94335` | 02d0cc82 | failed: entry `requires: ["query"]`, input unbound (C4) |
| 5 | `07-05-26-548Z-41bb3f` | 02d0cc82 | failed only on the stale declared code `web.target.not_actionable` |
| 2 | `07-10-53-818Z-934899` | 6a750cab | failed: entry taken, cart right, but "completed without an outgoing edge before the Flow visited every node" (C8) |
| 6 | `07-14-54-464Z-f7bfaa` | 6a750cab | failed: runner's record reader read every handler id as null |
| 10 | `07-31-02-867Z-f604df` | ae826078 | not-proven: the site refused Lin's confirm, and the handler was scoped to Freya only (fixture) |

Bundle paths are `test-runs/recovery-matrix/rmx-2026-10-10T<time>/`. Kept workspaces of runs that did not pass are
under `test-runs/persistent-isolated/rmx-<case>-<hex>/`, named in each bundle's `retainedWorkspace`.

## Distinct causes (product files named; no product code changed)

| # | Rows | Cause | File | Evidence | State |
| --- | --- | --- | --- | --- | --- |
| C1 | 2-7, 10 | The gate required the literal id `web.facts@1`; the extension declares `web.facts` with `metadata.version: 1`. | Core `runtime/service/runtime-session/requirement-gate.ts` | bundle `06-41-37…/case-2.json` observed refusal | fixed on Core dev `02d0cc82` |
| C2 | 8 | A part's ports are given the bare output name as their id, and `flow_ports.port_id` was the table key, so two parts outputting `cart` failed to save (`UNIQUE constraint failed: flow_ports.port_id`). | Core `flow-bootstrap/authoring/assemble.ts` partInterface plus `storage/project/schema` | `compile/tests/compile-flow-script.test.ts` | t405, merged; row 8 re-run with shared `cart`, passed |
| C3 | 9 | A timed-out press declared `consequences: none` was refused as a lasting act (`producerSaysActed` overrode the step's own `none`). | Core `runtime/executor/defensive/assess.ts` gate 3 | `persistent-isolated/rmx-9-6c4c0314` event #9 failureReason | fixed `61f6adbf` |
| C4 | 2 | Entry `requires` listed an input read with a default (`$input.query = …`). | Core `flow-bootstrap/script-statements/entry-points.ts` | `rmx-2-ae36ee9e` graph_nodes s7 `fluxiq.entry.requires: ["query"]`; no fact command sent | fixed `6a750cab` |
| C5 | 3 (and 8's evidence) | The run detail and stored events project only `session.trace.attempts`. A called part's attempts, their `entry` and `lifecycle` records, and the call attempt's `subflowTarget` live in `childTrace` and are never projected. | Core `runtime/service/summaries/conversions.ts` runtimeActionAttemptsFromSession | `rmx-3-b39af251` events: s12 call-subflow has no childTrace; command-attempts show the part's 5 re-ticks and read | t406 |
| C6 | 3 | Every facet `web.dom.check` that reloads the page fails its first attempt with "message channel closed" (`web.action.failed`); the retry reads "Check state already set". That is 5 false failures and 7 retries per run. | extension `apps/extension/src/runtime/click-landing.ts`: only presses are judged by their landing | `rmx-3-b39af251` command-attempts | t407 |
| C7 | 9 (11) | A lost ack is never reconciled. The effect check reads only the node's `expectedState`, which no script step can declare. Core never asks the extension by commandId, though `web.actions.reconcile@1` answers a repeated id with its kept result. | Core `runtime/executor/transition-comparison.ts` automationStudioHostEffectCheck, plus command dispatch | `rmx-9-ad6cb8ad` event #16 "The effect check could not show whether it did" | t409 |
| C8 | 2 | A frame begun at an entry was judged by the whole-graph "visited every node" rule and ended failed after doing everything right. | Core `runtime/executor/graph-run.ts` ~l.491 | `rmx-2-fc243728` summary terminalFailureReason | fixed `ae826078` |
| C9 | 10 | A route back past completed lasting acts is marked `repeatsCompletedReconcile` and allowed only on `not_landed`, so `go to requests` can never be taken. The stored lifecycle also drops the `unhandled` reason. | Core `runtime/executor/step-loop/lifecycle-route-guard.ts`, `executor/lifecycle/dispositions.ts` routeDecision | `rmx-10-cfe32bb1` event #15 `retry:unhandled`, completionCheck true | t410 (completed-act ledger; skip, never re-press) |
| C10 | 9, 11 | The uncertain stop is message text only: the run failure stays `timeout/web.action.timeout`, with no closed `outcome_uncertain` code. | Core `executor/step-loop/lifecycle-dispatch.ts:170` and the defensive stop path | bundles 9 and 11, `run.failure` | t408 (`run.outcome_uncertain`) |
| C11 | 5 | `on before everywhere` also fires before `builtin.control.merge` plumbing nodes, at ~5-6 s per inert body. | Core `executor/step-loop/lifecycle.ts` | `rmx-5-aa052a70` handler_execution before s9, a merge | t408 |

Fixture causes, fixed here:

- Row 9's fault counted presses: retargeted to name the act by its selector.
- Row 10's handler covered one confirm only: now all four.
- Row 5's declared code was t390's unverified guess: now `web.action.blocked_by_dialog`.
- The runner read handler ids as null, which would also have let row 7 pass vacuously.
- Row 3's read used a paging form the domain retired (`web.extract_list.paginate_retired`).

## Measures (this round, the 14 final launches)

| Measure | Value |
| --- | --- |
| Deterministic recovery rate | 15 of 18 incidents closed without a model = **0.83**. The 3 open ones are row 5's intended honest end and the uncertain stops of rows 9 and 11. |
| True failures vs retries vs planned fails | 3 true failures, 17 retries, 3 planned fails |
| Model calls | **0** in every launch, including every earlier launch. 9 accounted by `costAccounting.calls: 0`, 5 by a declined gate (`llm.gate.training_mode` or `deliberate_stop`). |
| Model calls per true failure | 0 (no provider wiring) |
| Runs carried on after an in-run fix | 0 (no model) |
| Escalations a handler could have avoided | 0 |
| Wrong routes | **0**. No state route was taken in any run. Row 2 took the eligible entry; row 3's part took its default on the dropped-filter page. |
| Duplicated acts | **0**. Rows 9, 10 and 11 included: every confirm and add landed exactly once. |
| False successes | **0**. One false failure was seen and fixed: row 2 on 6a750cab, C8. |
| Learning cost | $0 |
| Handler-check overhead | Row 6 (handlers in scope) vs row 11 (same 15 steps, no handlers), the gap from one attempt's end to the next attempt's start: +3 to +81 ms per boundary, **mean +38 ms over 15 boundaries**. Row 5 vs row 11 over s2-s6: mean ≈ 0 ms (−31 to +18). At boundaries where a handler matched, the fact evidence was captured 2-66 ms after the previous attempt on boundaries whose baseline gap is ~0-100 ms. A matched handler whose body fails costs 4.8-6.0 s per boundary (row 5). Row 10's retry handler took 27.8 s, 16 s of it its authored wait. The bundle's `handlerCheckOverheadMs` stays `null`: the trace has no per-boundary check timing, so these are derived from attempt and handler `startedAt`/`finishedAt` in the stored events. |

## What changed and why

Owned paths, as extended by main during the task. Files in `packages/test-runner/src/` unless stated.

- **`recovery-matrix/flows/pickup-cart-store-entry.ts` (row 2).**
  - The `start at: search` fact is now `text at "[data-testid='mini-cart-store']" contains "Millbrook Crossing Supercenter"`.
  - The header chip that shows the store is inside `vr-fulfillment-picker`'s shadow root, which a locator cannot
    reach. The mini cart's store line is in the light DOM, and `innerText` of a hidden element is its text.
- **`recovery-matrix/flows/towels-filter-entry.ts` (row 3), rewritten for a real wrong-filter state.**
  - The primary block searches, ticks the five filters, then presses the Next arrow, which drops them
    (`pages/results-pagination.ts`).
  - It then calls the part `filtered-read`. The part's entry `start at: read` holds only when
    `exists at "input[type='checkbox'][value='fulfillment_speed:Today']:checked"`, and its default path re-ticks the
    filters and reads.
  - The primary declares no entry, so the run's first entry record is the part's.
  - The read is one page: `paginate` with `maxPages > 1` is refused by the domain.
- **`recovery-matrix/flows/hub/promotion-handler.ts`, `hub/two-handlers.ts` (rows 4-6).**
  - The facts are `visible at ".css-1ohale1 > [title='Close']"`.
  - `css-1ohale1` is the flash modal's own class for seed 7342; the welcome modal shares only the generic `modal`
    class. This was checked with `marketClasses(7342)`.
- **`recovery-matrix/flows/quick-add-alternative.ts` (row 8).**
  - The alternative part's search step had `element.*` lines indented as the step's siblings; they are now indented
    under the step.
  - The output was renamed `tileCart` while C2 stood, then restored to `cart` after t405.
- **`recovery-matrix/flows/soap-search-two-blocks.ts` (row 7).** The same indentation fix.
- **`recovery-matrix/flows/confirm/with-checkpoint.ts` (row 10).** All four confirms are labelled, and the retry
  handler is `for amara, jonas, lin, freya`.
- **`recovery-matrix/flows/tests/fault-targets.test.ts` (new).** A case's `onTargetSelector` must be exactly one
  `selector:` line of its Flow, on a step with a lasting consequence.
- **`recovery-matrix/matrix-rows.ts`.**
  - The five `authoringGap` lines and `ELEMENT_FACT_GAP` are removed.
  - Row 9's perturbation is `{ kind: "drop-action-result", onTargetSelector: JONAS_CONFIRM }`.
  - Row 5's `declaredFailure` code is `web.action.blocked_by_dialog`.
- **`recovery-matrix/compile/tests/compile-flow-script.test.ts`.** Unchanged: it derives the gap from the rows, so
  rows 2-6 are now expected to compile, and they do.
- **`perturbations/run-perturbation.ts`.**
  - New shape `{ kind: "drop-action-result"; onTargetSelector: string }`, parsed strictly (non-empty, ≤1000
    characters, never alongside a count).
  - The count form is kept: `perturbations/check/cli.ts` uses it.
- **`perturbations/drop-action-result-relay.ts`.**
  - Strikes the first committing command whose `parameters.selector` is exactly the target; a retry of it passes.
  - Logs `namedTarget: true`, never the selector.
- **`perturbations/start-run-perturbation.ts`.** One-line wiring for the new shape; it does not typecheck without it.
- **`perturbations/tests/*`.** A relay test for the named target (two dismissals and a confirm before it, then its
  retry) and the parser cases.
- **`recovery-matrix/records/attempt-records.ts`.**
  - A handler id is read as Core writes it, `<graphFlowId>/<nodeId>`: `handlerId` is the node part after the last
    `/`, and `handlerRef` keeps the whole reference.
  - Test added.
- **`recovery-matrix/checks/matrix-checks.ts` `inactiveHandler`.** Fails when a handler ran whose id cannot be read.
  Test added.
- **`apps/scenario-lab/src/scenarios/crossborder-marketplace/manifest/manifest.ts` and `tests/scenario.test.ts`.**
  `flash-deal-stuck`'s declared failure is now `web.action.blocked_by_dialog`, which is that field only.

## Commands run and observed results

- **Builds.**
  - Core: `node scripts/build-cache/cli.mjs contracts:build fluxiq:build client-gateway-websocket:build`, at each
    Core move. The fluxiq build ran each time.
  - Downstream: `node scripts/build-cache/cli.mjs <step>` for domain:build, domain:host-build, extension:build,
    scenario-lab:build and test-runner:build. Each rebuilt on Core's change.
- **Flow fixture and runner tests.**
  - `node --test` on `dist/recovery-matrix/{compile,records,checks,run}/tests`, `dist/recovery-matrix/tests`,
    `flows/tests`, `flows/confirm/tests` and `dist/perturbations/tests`: `# tests 67 # pass 67 # fail 0`.
  - The compile test alone after the row 8 restore: `# tests 11 # pass 11 # fail 0`. It had been 9/11 before the
    paginate fix and before t405.
- **Scenario test.** `node --test dist/scenarios/crossborder-marketplace/tests/scenario.test.js` in scenario-lab:
  `# tests 12 # pass 12 # fail 0`.
- **Typecheck.** `npx tsc --noEmit -p tsconfig.json` in test-runner: no output.
- **Structure audit.** `node scripts/structure-audit.mjs 2>&1 | grep -E "FAIL|structure-audit:"`:
  `structure-audit: passed (184 warning(s), 651 baselined).`
- **Matrix launches.** 23 launches, listed in the two tables above. One more case-6 launch (07:1x) was refused by
  the Lab's stale-Core guard before anything ran: the Core had been fast-forwarded and not yet rebuilt. It is not
  counted as an attempt.

## Not verified

- Rows 3, 9, 10 and 11 against t406/t407, t409, t410 and t408. Re-run each after its task merges.
- Row 3's check also needs `needs` to include `call-subflow`. It now calls a part, and that `needs` line was left as
  it was (only the gap lines were mine).
- Row 11: whether the worker really stopped. The perturbation's watch ended `gone: false, started: false`, because
  Chrome lists a restarted worker under the stopped target's id, so the watch cannot tell. Core received neither a
  result nor an `interrupted` report (attempt `timed_out`, no `late_action_result`), so restart reconciliation (B3) was
  not exercised in this run.
- Rows 4a, 4b and 3 ran on Core `02d0cc82`, not on the final `ae826078`. None of the later Core changes touches
  their paths, but they were not re-run.
- The chat's recovery rows. Not in any bundle (see Outcome).
- Full suites: not run, as required. No paid runs. Row 12 skipped.

## Open questions or contradictions found

1. `docs/architecture/testing-facility.md` is stale, and is not my file:
   - the crossborder row (~l.1066) still names `web.target.not_actionable` for `flash-deal-stuck`;
   - the matrix section's "Authoring gap" paragraph describes a gap that t402 plus these Flows closed;
   - `drop-action-result` is documented with the count only.
2. Row 8's proof of "an attempt ran in a called part's frame" is met by the handler body's frame (framePath length
   2), not by a part frame, because of C5. After t406 the check should require a part frame.
3. Row 9's check wants `failure.code` ending `outcome_uncertain`. Once t408 lands `run.outcome_uncertain`, confirm the
   check reads that code and not a sentence.
4. The confirm site's rate limit landed on different confirms run to run (Lin in `07-31-02`, Freya otherwise). This
   is consistent with t403's open "one press too many" finding, which remains unexplained.
