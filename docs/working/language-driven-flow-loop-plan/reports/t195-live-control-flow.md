# t195 live lane D: control flow and consequential acts

Lane lead t195 (`lead-xhigh` brief from the supervisor, 2026-09-30). Trees:
`C:\Users\osrs_\FluxStuff\fxwork\t195\!FluxIQWebExtension` and `...\fxwork\t195\!FluxIQ`, both on
`task/t195-live-control-flow`. Slot `lab-slots/slot-4`, instance `t195-slot-4`, headed, deepseek-flash,
production profile, 48k in / 8k out / 56k per call, $0.25 cap. Launcher: scratchpad `live-run-d.sh`
(t174's `live-run.sh` with slot-4, the t195 instance and tree, and a full log per run). From run 5 it passes
`--llm-max-calls 64`, as t174's L1 does, because Core ignores the configured call limit (t193's cause B).

## Fix log

Protocol (supervisor, 2026-09-30): loop continuously, fix in this branch, validate, re-run; hand back only at
"Integration round N".

| # | Fix | Files | Exposed by | Validation | Status |
| --- | --- | --- | --- | --- | --- |
| F0 | t174's committed fixes (network-guard start crash, draft-shown throw, gateway open timeout, source-mapped Core frames, build progress trace) applied as a working-tree patch. **Owned by t174; needs t174 merged into dev at the next round.** Hunks are byte-identical to `git diff dev...task/t174-live-lane`. | downstream 23 paths, Core 20 paths (t174's) | run 1 `run-munnetuw-1bba61e6` | Core build (contracts, fluxiq, client-gateway-websocket) exit 0; runs 2-5 paired cleanly | applied (t174's) |
| F1 | A replayed Flow gets past a cookie consent wall: the interference defence presses the control that **declines** optional cookies, on a layer whose own text is about cookies or consent, and never one that accepts. Classification follows, so a consent wall over a target is `blocked_by_dialog` and cleared. | extension `content/action-runtime/interference/{vocabulary.ts, way-out.ts, clear.ts (comment)}`, `blocking-dialog.ts` (comment), `interference/tests/vocabulary.test.ts` | run 4 `run-munoa86g-150fb0d9` (playback died at step 2 under "Your privacy choices") | vocabulary tests 9/9 (esbuild + `node --test`); live proof pending (a permitted bigbox run replays through the wall) | validated (unit), live pending |
| F2 | The model is told how to do one act to every listed item: run the listing step, act on one item, `amend_draft repeat` over it. The decision instruction no longer forbids a drafting build from running its steps or reads as "act on one row only"; the draft telling keeps the per-item sentence at all three lengths (full telling kept at 1,019 characters, under its 1,100 bound). | Core `runtime/llm/evidence-loop-decision.ts`, `runtime/flow-draft/{entry.ts, amendment.ts}`, tests `flow-draft/tests/{entry-budget.test.ts (new case), entry.test.ts (boundary 1_711 -> 1_678)}` | run 2 `run-munnop9n-5475d593` (never said repeat; one Confirm of four) | `vitest` flow-draft + llm/evidence-loop + evidence-loop-provider + evidence-loop-draft-shown: 19 files, 149/149 | validated (unit), live pending |
| F3 | A consequential task run without permission passes when the build stops to ask at the task's declared permission point: `assertFlowLaneBuiltFlow` no longer fails that run for having built no Flow. | test-runner `lane-rules/built-flow.ts`, `run-scenario.ts` (+1 line, `stoppedToAsk`), `lane-rules/tests/built-flow.test.ts` | run 5 `run-munovwp3-d898de74` (asked at Place order, then `environment.missing`) | test-runner build exit 0; `built-flow.test.js` 3/3 | validated (unit), live pending |
| F4 | A repeat over a list hands each pass's row to the steps it repeats: For Each `item` (now `multiple`) is wired to every span step whose node declares input `item`; an unnamed branch never falls into a `role: "data"` input. | Core `authoring/draft-routing.ts`, `authoring/assemble.ts`, `nodes/control-flow/for-each.ts`, tests `authoring/tests/{draft-routing.test.ts, assemble.test.ts (new)}`, `control-flow/tests/for-each.test.ts`; Core `docs/architecture/automation-studio.md` | runs 2, 3 | w4: 88/88, each new test fails with its source reverted; `tsc` 0; Core audit passed | validated (unit), live pending |
| F5 | A web element step inside such a loop acts on the current row's own control: element-target nodes declare input `item`; the row's values replace the element's record (`record.values`); the extension's record gate requires every value in the candidate's record. Lead additions: a built node's handle element carries `listPosition` and never `record` (`plan-resolution/element-identity.ts:51,69`), so either now triggers the scoping; and the row gate is applied before the 60-candidate cap (`identity/candidates.ts` `admits`, from `resolve-target.ts` `scoreFamily`), so a row past the sixtieth same-family control is weighed. | domain `output-nodes/{definitions.ts, native-runtime.ts, targets/targets.ts}`, `actions/types.ts`; extension `shared/protocol.ts`, `content/identity/{record.ts, candidates.ts}`, `action-runtime/resolve-target.ts` + tests; `docs/architecture/page-evidence.md` | runs 2, 3 | w5: domain 917/917, domain check 0, extension 1228/1228, audit passed. Lead: native-runtime 20/20 (new listPosition case); extension `tsc` clean for these files (only error is w8's in-progress `failure/codes.ts`); extension units 1229/1230 (the one failure is w8's in-progress fault word) | validated (unit), live pending |
| F6 | A load-more that fails and offers a Retry beside its control has the Retry pressed (at most twice, closed whole-label list, scope = the control's parent and grandparent), so the read gets every page. | extension `content/extraction/{load-retry.ts (new), pagination.ts}`, `extraction/tests/load-retry.test.ts` (new) | run 3 (10 of 28 requests read; Guildline's first Show more only answers with Retry) | load-retry + pagination tests 8/8 (esbuild + `node --test`); extension `tsc` pending until w5/w8 finish | validated (unit), live pending |
| F7 | A press the site refuses as "too fast" fails `web.action.rate_limited` (`action_failed`, retryable, `effect: "unacted"`, `retryAfterMs` = N s + 500 ms read from the notice in document order); Core repeats it on a mutating node after the hinted wait (Core caps one wait at 30 s); the notice's OK/Got it closes it on a rate-limit layer only; "Try again" is never pressed by the page defence. New Core contract fields: `AutomationStudioFailureRecord.effect`, `.retryAfterMs` (supervisor to confirm). | Core `packages/contracts/src/failure/{record.ts, parse-record.ts}` + test, `executor/defensive/assess.ts` + test; domain `runtime/failure/codes.ts` + test; extension `actions/{click.ts, types.ts}`, `action-runtime/{rate-limit-notice.ts (new), results.ts, execute-action.ts, index.ts}`, `interference/{layer-text.ts (new), vocabulary.ts, way-out.ts, index.ts}`, `recovery/{fault.ts, record.ts}` + tests; `docs/architecture/failure-taxonomy.md` | run 6 (detector fired live; the wait was unread until the document-order fix) | w8: revert checks fail without each change. Lead re-run: extension units 1254/1254, domain 921/921, Core contracts failure 9/9, Core suites below 580/580, fluxiq + contracts + apps/web `tsc` 0, both audits passed | validated (unit); the waited retry is live-unproven |
| F8 | A count written "Aisha Khan and 4 other mutual friends" reads as 5 in an extraction's numeric `where` (and sort): someone named, no digit before, then "and N other(s)" = N + 1. | domain `actions/extraction/condition-match.ts`, `tests/condition-match.test.ts` | confirm-requests Stage 1 (Jonas Weber's five is written this way; "at least five" would drop him) | condition-match tests 10/10 (esbuild + `node --test`) | validated (unit), live pending |
| F9 | A native node is handed only the inputs an edge brings, so a step after a loop that declares `item` no longer receives the loop's last row through the bare `values.item` key (w4's probe: the click after the loop got row 3). Traces and parameter bindings keep the merged view. | Core `runtime/executor/{node-inputs.ts (collectWiredNodeInputs), node-execution.ts}`, `authoring/tests/draft-routing.test.ts` (post-loop click) | w4's probe | authoring + control-flow + executor vitest 27 files 369/369; the new expectation fails with the call reverted (1 failed) and passes restored; Core build exit 0; extension+domain `tsc` 0 | validated (unit), live pending |

Owned elsewhere (recorded by another lane first, taken at the next round):
- Core ignores the Flow's configured call limit: **t193** (its cause B).
- The instructed-acts check accepts a Flow that lacks the act (t174 run 13 cause B): **t174**. This lane adds, for
  the same file `runtime/flow-bootstrap/instructed-acts/check.ts:74-87`, that one step satisfies a plural act
  ("confirm everyone with five or more") and that an `optional` step satisfies an act (run 2). Not fixed here, to
  avoid two lanes editing `check.ts`; t174 please take both, or tell the supervisor to hand it to t195.
- `resultReauthor` refused `not_a_wrong_answer` because `result-verification/verify.ts:121-122` settles on
  `required_values_missing` first (run 2): the judge lane, **t194**, to confirm ownership.
- The panel's "Done" mid-build and "Add an AI model key: To do" during a live build, and no on-page overlay in
  any screenshot of runs 2-5: **t191** (UI evidence: scratchpad `t195-shots/*-r2-*.png` .. `*-r5-*.png`).

## Open product question: which consequential acts ask (for the supervisor)

The records disagree, and the lane needs one rule to pass tasks 3-5 twice in a row.
- Core `runtime/action-permissions/destructive.ts` (2026-09-28, "the product owner's rule that the person's
  instruction is itself the permission"): only `move_money` and `delete` are ever asked, and only when the
  instruction did not ask for them (`gate.ts:258-260`); `send_or_publish` is never asked.
- This lane's brief (2026-09-30) and the user's 2026-09-29 rule in memory: ask before moving money, deleting,
  **sending or publishing**, and only then.
- Live effect today: bigbox's Place order asks or not depending on whether the model's reading of the instruction
  names `move_money` (run 4 read it as instructed and would not have asked; run 5 did not and asked). The Lab accepts
  either ending for bigbox. photo-social's moon-jar message, which the instruction never asks for, would be **sent
  without asking** under Core's rule, while the task declares the ask at Send.
- The lane's working reading, until told otherwise: the instruction grants what it asks for; moving money, deleting and
  sending or publishing that the instruction did **not** ask for are asked. That restores `send_or_publish` to
  `destructive.ts` as "asked when not instructed". Not changed yet: it re-gates sends in other lanes' tasks whenever
  the instruction derivation misses, which is why it was removed. To be decided before task 5.

## Integration round 1 (2026-09-30 ~06:50Z)

Lead validation of the whole tree, run after every worker had handed back:
- Extension `test-extension.mjs`: 1254/1254. Domain `test-domain.mjs`: 921/921.
- Core `vitest` (flow-draft, llm/evidence-loop, evidence-loop-provider, evidence-loop-draft-shown, flow-bootstrap/authoring,
  nodes/control-flow, runtime/executor, action-permissions): 51 files, 580/580. Contracts `src/failure`: 9/9.
- `tsc --noEmit`: Core fluxiq 0, contracts 0, apps/web 0; extension + domain 0 (before w8's last edits; w8's own
  `check-extension.mjs` after them: 0).
- Structure audit: Core passed (194 warnings, 354 baselined); downstream passed (125 warnings, 120 baselined).
- test-runner build 0 and `built-flow.test.js` 3/3 (F3).
Mixed file: `packages/test-runner/src/run-scenario.ts` holds t174's F0 hunks plus F3's three lines (`let stoppedToAsk`,
the flag set where the lane returns `permissionStop`, and the `stoppedToAsk` argument to `assertFlowLaneBuiltFlow`).

## Tasks and streaks

| Task | Passes in a row | Latest |
| --- | --- | --- |
| `social-network-feed-confirm-requests` | 0 | run 6: loop built and row-scoped; wrong listing, no filter, rate-limit wait unread |
| `professional-network-withdraw-stale-requests` | 0 | run 3: For Each with only the Withdraw in its body, pass 2 blocked by the dialog; the first page holds no stale row (w7) |
| `bigbox-retail-pickup-order` (unpermitted: asks at Place order, or orders when the instruction is read as authorising it) | 0 (run 5 asked correctly; the Lab failed it, F3) | run 5 |
| `job-board-apply-quillmark` | 0 | not run |
| `photo-social-moon-jar-price` | 0 | not run |

UI review: the Lab bundle has no screenshots on this tree (`capture-unavailable`; t174's F4 UI review is uncommitted
in t174). Screenshots are taken of the lane's own headed Chromium window every 30 s with `PrintWindow` (scratchpad
`t195-shot.ps1`, `t195-shots/`), selected by the process command line.

## Runs

| # | Run | Task | Stage reached | Causes | Fix | Validation |
| --- | --- | --- | --- | --- | --- | --- |
| 1 | `run-munnetuw-1bba61e6` | confirm-requests | none (facility), 0 calls | Side panel `Page crashed` at start: the network guard's canary `fetch()` into the not-yet-ready worker (t174 F3), not on dev | F0 | run 2 paired |
| 2 | `run-munnop9n-5475d593` | confirm-requests | 6, 41 calls | The model never said `repeat` (routing told only in `amendment.ts:107`; `evidence-loop-decision.ts:44` forbids repeating a mutation); one `optional` Confirm pinned to the first card (a non-qualifying request) was accepted by `instructed-acts/check.ts:74-87` and the dry run (`dry-run.ts:163-165`); the final extraction had no `where` (8 rows for 4); 15 extraction reruns counted as progress (`decision-handlers/amendment.ts:86,95`); repair lost `step_parameters` to the byte budget (`recovery/context.ts:243`). Debug: `debugs/run-munnop9n-5475d593.md` (t195-w1, 13 causes) | F2, F4, F5; check.ts owned by t174 | - |
| 3 | `run-munnyvbr-11c28a0f` | withdraw-stale-requests | 6, For Each ran | The model did say `repeat`, over a 10-row extraction (no `where`, first page only) through the Withdraw click only; the dialog's confirm (s9) sat after the loop, so pass 2 was `web.action.blocked_by_dialog`; every pass targets the same fixed Withdraw. Exploration withdrew the newest request (sent today). | F2, F4, F5 | - |
| 4 | `run-munoa86g-150fb0d9` | pickup-order | 6, 46 build calls | The build never reached checkout and completion was accepted with move_money and create_new undeclared (t174's instructed-acts cause); playback died at node 2 under the consent dialog, which the defence would not answer (`interference/vocabulary.ts`). | F1; acts: t174 | - |
| 5 | `run-munovwp3-d898de74` | pickup-order | build asked at the declared point, 48 calls | Correct ending (move_money at "Place order", control matched), failed by `lane-rules/built-flow.ts:15-17`. The exploration press of Place order took 120,210 ms before `permission_required` (an unanswered permission prompt; to trace). | F3 | - |
| 6 | `run-munq51ik-a7ebd077` | confirm-requests | 6, 64 build calls | **The model built the loop** (For Each over the listing, Confirm as its body; F2) and passes 1-3 each confirmed a different row (F4/F5 live). But the listing was the Friends home (4 of 8) with no `where`, so Tom Becker and likely Priya Nair were confirmed (wrong acts); pass 4 was correctly `web.action.rate_limited` / `unacted` (w8), yet read no wait, so Core's retries fell inside the window; leftover single Confirms and the final read sat after the loop; 9 of 10 completions refused by the dry run. Debug: `debugs/run-munq51ik-a7ebd077.md` | F7 wait parse (w8, in progress); causes 2-5 open | - |

## t174's fixes applied as a working-tree patch (owned by t174)

Dev, which this tree was built from, holds none of t174's commits. Both of its trees' code diffs were
applied here with `git diff dev...task/t174-live-lane` (downstream limited to `apps domain packages scripts`;
Core whole) and `git apply`, which touched no git history: downstream 23 paths, Core 20 paths
(`5903a1e7`, `259b0df2`, `631e3486` downstream; `befca2f`, `50eb684`, `e8d3bfc` Core). When the supervisor
merges t174, the hunks are identical on both sides. Core rebuilt (contracts, fluxiq,
client-gateway-websocket): exit 0.

## Round 1 file list

Nothing is in progress: every worker (w1, w4, w5, w7, w8) had handed back before the validation above.

**t195's own, downstream** (commit all):

- `apps/extension/src/content/action-runtime/blocking-dialog.ts`
- `apps/extension/src/content/action-runtime/execute-action.ts`
- `apps/extension/src/content/action-runtime/index.ts`
- `apps/extension/src/content/action-runtime/interference/clear.ts`
- `apps/extension/src/content/action-runtime/interference/index.ts`
- `apps/extension/src/content/action-runtime/interference/layer-text.ts`
- `apps/extension/src/content/action-runtime/interference/tests/vocabulary.test.ts`
- `apps/extension/src/content/action-runtime/interference/tests/way-out.test.ts`
- `apps/extension/src/content/action-runtime/interference/vocabulary.ts`
- `apps/extension/src/content/action-runtime/interference/way-out.ts`
- `apps/extension/src/content/action-runtime/rate-limit-notice.ts`
- `apps/extension/src/content/action-runtime/recovery/fault.ts`
- `apps/extension/src/content/action-runtime/recovery/record.ts`
- `apps/extension/src/content/action-runtime/recovery/tests/fault.test.ts`
- `apps/extension/src/content/action-runtime/resolve-target.ts`
- `apps/extension/src/content/action-runtime/results.ts`
- `apps/extension/src/content/action-runtime/tests/rate-limit-notice.test.ts`
- `apps/extension/src/content/actions/click.ts`
- `apps/extension/src/content/actions/tests/click.test.ts`
- `apps/extension/src/content/actions/types.ts`
- `apps/extension/src/content/extraction/load-retry.ts`
- `apps/extension/src/content/extraction/pagination.ts`
- `apps/extension/src/content/extraction/tests/load-retry.test.ts`
- `apps/extension/src/content/identity/candidates.ts`
- `apps/extension/src/content/identity/record.ts`
- `apps/extension/src/content/identity/tests/record.test.ts`
- `apps/extension/src/shared/protocol.ts`
- `docs/architecture/failure-taxonomy.md`
- `docs/architecture/page-evidence.md`
- `docs/working/language-driven-flow-loop-plan/debugs/run-munnetuw-1bba61e6.md`
- `docs/working/language-driven-flow-loop-plan/debugs/run-munnop9n-5475d593.md`
- `docs/working/language-driven-flow-loop-plan/debugs/run-munnyvbr-11c28a0f.md`
- `docs/working/language-driven-flow-loop-plan/debugs/run-munoa86g-150fb0d9.md`
- `docs/working/language-driven-flow-loop-plan/debugs/run-munovwp3-d898de74.md`
- `docs/working/language-driven-flow-loop-plan/debugs/run-munq51ik-a7ebd077.md`
- `docs/working/language-driven-flow-loop-plan/reports/t195-live-control-flow.md`
- `docs/working/language-driven-flow-loop-plan/reports/t195-w1-debug-run-munnop9n.md`
- `docs/working/language-driven-flow-loop-plan/reports/t195-w4-loop-item-core.md`
- `docs/working/language-driven-flow-loop-plan/reports/t195-w5-row-scoped-target.md`
- `docs/working/language-driven-flow-loop-plan/reports/t195-w7-debugs-r3-r5.md`
- `docs/working/language-driven-flow-loop-plan/reports/t195-w8-rate-limited-press.md`
- `domain/src/actions/extraction/condition-match.ts`
- `domain/src/actions/extraction/tests/condition-match.test.ts`
- `domain/src/actions/types.ts`
- `domain/src/client/tests/gateway-mapping-identity.test.ts`
- `domain/src/output-nodes/definitions.ts`
- `domain/src/output-nodes/native-runtime.ts`
- `domain/src/output-nodes/targets/targets.ts`
- `domain/src/output-nodes/targets/tests/targets.test.ts`
- `domain/src/output-nodes/tests/definitions.test.ts`
- `domain/src/output-nodes/tests/native-runtime.test.ts`
- `domain/src/runtime/failure/codes.ts`
- `domain/src/runtime/failure/tests/codes.test.ts`
- `packages/test-runner/src/lane-rules/built-flow.ts`
- `packages/test-runner/src/lane-rules/tests/built-flow.test.ts`

**t195's own, Core** (commit all):

- `docs/architecture/automation-studio.md`
- `packages/contracts/src/failure/parse-record.ts`
- `packages/contracts/src/failure/record.ts`
- `packages/contracts/src/failure/tests/parse-record.test.ts`
- `packages/fluxiq/src/programs/automation-studio/nodes/control-flow/for-each.ts`
- `packages/fluxiq/src/programs/automation-studio/nodes/control-flow/tests/for-each.test.ts`
- `packages/fluxiq/src/programs/automation-studio/runtime/executor/defensive/assess.ts`
- `packages/fluxiq/src/programs/automation-studio/runtime/executor/defensive/tests/assess.test.ts`
- `packages/fluxiq/src/programs/automation-studio/runtime/executor/node-execution.ts`
- `packages/fluxiq/src/programs/automation-studio/runtime/executor/node-inputs.ts`
- `packages/fluxiq/src/programs/automation-studio/runtime/flow-bootstrap/authoring/assemble.ts`
- `packages/fluxiq/src/programs/automation-studio/runtime/flow-bootstrap/authoring/draft-routing.ts`
- `packages/fluxiq/src/programs/automation-studio/runtime/flow-bootstrap/authoring/tests/assemble.test.ts`
- `packages/fluxiq/src/programs/automation-studio/runtime/flow-bootstrap/authoring/tests/draft-routing.test.ts`
- `packages/fluxiq/src/programs/automation-studio/runtime/flow-draft/amendment.ts`
- `packages/fluxiq/src/programs/automation-studio/runtime/flow-draft/entry.ts`
- `packages/fluxiq/src/programs/automation-studio/runtime/flow-draft/tests/entry-budget.test.ts`
- `packages/fluxiq/src/programs/automation-studio/runtime/flow-draft/tests/entry.test.ts`
- `packages/fluxiq/src/programs/automation-studio/runtime/llm/evidence-loop-decision.ts`

**F0 only (t174's hunks, byte-identical to `git diff dev...task/t174-live-lane`): take t174's version.** Downstream:

- `apps/extension/src/background/connection/gateway-session.ts`
- `apps/extension/src/background/connection/tests/gateway-session.test.ts`
- `domain/src/runtime/llm-evidence/node-run/replay.ts`
- `domain/src/runtime/llm-evidence/node-run/tests/replay-ambiguous-target.test.ts`
- `packages/test-runner/src/core-web-build/server-process.ts`
- `packages/test-runner/src/core-web-build/tests/server-process.test.ts`
- `packages/test-runner/src/flow-lane/creation/build-proposal.ts`
- `packages/test-runner/src/flow-lane/creation/tests/build-proposal.test.ts`
- `packages/test-runner/src/http-control/index.ts`
- `packages/test-runner/src/http-control/long-request.ts`
- `packages/test-runner/src/http-control/tests/long-request.test.ts`
- `packages/test-runner/src/network-guard.ts`
- `packages/test-runner/src/run-evaluation/tests/runner-wiring.test.ts`
- `packages/test-runner/src/run-lifecycle/pair-extension.ts`
- `packages/test-runner/src/run-lifecycle/pairing-status-wait.ts`
- `packages/test-runner/src/run-lifecycle/tests/pair-extension.test.ts`
- `packages/test-runner/src/run-lifecycle/tests/pairing-status-wait.test.ts`
- `packages/test-runner/src/run-scenario/extension-control-page.ts`
- `packages/test-runner/src/run-scenario/extension-start-trace/extension-start-trace.ts`
- `packages/test-runner/src/run-scenario/extension-start-trace/index.ts`
- `packages/test-runner/src/run-scenario/extension-start-trace/tests/extension-start-trace.test.ts`
- `packages/test-runner/src/run-scenario/extension-start-trace/write-extension-start-sidecar.ts`
- `packages/test-runner/src/run-scenario/index.ts`
- `packages/test-runner/src/run-scenario/tests/extension-control-page.test.ts`
- `packages/test-runner/src/tests/network-guard.test.ts`

Core:

- `packages/client-gateway-websocket/src/index.ts`
- `packages/client-gateway-websocket/src/open-error.ts`
- `packages/client-gateway-websocket/src/tests/transport.test.ts`
- `packages/client-gateway-websocket/src/transport.ts`
- `packages/client-gateway-websocket/src/types.ts`
- `packages/fluxiq/src/programs/automation-studio/runtime/flow-bootstrap/generation-failure/index.ts`
- `packages/fluxiq/src/programs/automation-studio/runtime/flow-bootstrap/generation-failure/phase-failure.ts`
- `packages/fluxiq/src/programs/automation-studio/runtime/flow-bootstrap/generation-failure/tests/thrown-issue-codes.test.ts`
- `packages/fluxiq/src/programs/automation-studio/runtime/flow-bootstrap/generation-failure/thrown-issue-codes.ts`
- `packages/fluxiq/src/programs/automation-studio/runtime/llm/evidence-loop.ts`
- `packages/fluxiq/src/programs/automation-studio/runtime/llm/evidence-loop/index.ts`
- `packages/fluxiq/src/programs/automation-studio/runtime/llm/evidence-loop/progress-trace.ts`
- `packages/fluxiq/src/programs/automation-studio/runtime/llm/evidence-loop/tests/draft-shown.test.ts`
- `packages/fluxiq/src/programs/automation-studio/runtime/llm/evidence-loop/tests/progress-trace.test.ts`
- `packages/fluxiq/src/programs/automation-studio/runtime/llm/harness-options/bootstrap-completion.ts`
- `packages/fluxiq/src/programs/automation-studio/runtime/llm/harness-options/tests/bootstrap-completion.test.ts`
- `packages/fluxiq/src/programs/automation-studio/runtime/llm/tests/evidence-loop-draft-shown.test.ts`
- `packages/fluxiq/src/programs/automation-studio/runtime/service.ts`
- `packages/fluxiq/src/programs/automation-studio/runtime/tests/service-bootstrap/tests/accounting.test.ts`
- `packages/fluxiq/src/programs/automation-studio/runtime/tests/service-bootstrap/tests/catalog.test.ts`

**Mixed:** `packages/test-runner/src/run-scenario.ts` = t174's F0 hunks + t195 F3 (three lines: `let stoppedToAsk = false;` after `let verdict`, `{ stoppedToAsk = true; ... }` where the created lane returns `permissionStop`, and `stoppedToAsk` passed to `assertFlowLaneBuiltFlow`).
