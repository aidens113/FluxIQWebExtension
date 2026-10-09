# Run debug: run-mv0fuual-f9e6f089 (lane D, first candidate-mode probe, t275-slot-4)

Written before launch (2026-10-09 ~03:20 UTC); renamed to the run id when the Lab assigns it.

## Header

Lane D, t275: first creation run of `social-network-feed-confirm-requests` in candidate mode. Tree downstream
`1d04a11a` on `task/t275-live-lane-d` (dev `128d907e` differs by one working document only), Core `52d7ac3a` (= Core
dev), both clean, rebuilt 03:05-03:14 UTC. Instance `t275-slot-4`, slot 4, workspace `t275-d`. No `STOP-balance`, no
override files. Previous run on this instance: round 4 `run-muxky54f-fadb9d03` (legacy, failed, debug present).

## Expectations (written before launch)

The instruction, fixture facts, oracle, the correct candidate and predicted risks R1-R6 are in the lane report
`docs/working/mvp-final-month-plan/reports/lane-d-candidate.md`, "Expectations" (written 03:10 UTC before the dry
run). Dry run 03:15-03:17 UTC: ready, 0 calls, chat entry, flash, candidate, `candidateTrial {trialRunner: true,
startReset: true}`, 48 calls, $0.10, `permittedConsequences []`.

Command: `FLUXIQ_TEST_ENV_FILES=none FLUXIQ_LAB_INSTANCE=t275-slot-4 pnpm.cmd lab:campaign
social-network-feed-confirm-requests --authoring-mode candidate --max-attempts 1 -- --target persistent-isolated
--workspace t275-d --llm-cost-ceiling-usd 0.10`, launched at or after 04:00 UTC, once.

To check, in order: exploration (what the model looked at, whether it pressed any Confirm live, the Friends home's
four versus See all's eight); every `submit_candidate` (script text, refusals) and `test_candidate` (start reset,
each step with attempts, the four Confirm passes, the rate-limit moment on Freya, the after-read's rows); both judge
verdicts against the oracle; promotion and chat apply; the Lab's reset, playback and oracle; cost and calls; the UI.
EOF
date -u +%T
## Result (written by the lane D lead, 2026-10-09 ~04:28 UTC)

**Failed, no Flow.** Guard admitted 04:01:23 (`launch-mv0fuksg-ae018a6d`, fingerprint `77ed38ed...`); chat build
04:06:54-04:11:21; 36 provider calls, $0.047233 (build $0.047059 of $0.10). Running identities: build, Core, host and
server adapter all `verified: true` (`snapshots/running-*-identity.json`). No promotion, apply, playback, oracle or
replay. Full evidence, tables and worker reports: `docs/working/mvp-final-month-plan/reports/lane-d-candidate.md`
(and `lane-d-candidate-w1-rate-limit.md`, `-w2-authoring.md`, `-w3-ui.md`).

| Steps | What happened | Verdict |
| --- | --- | --- |
| 0001-0032 | Explore: navigate, "Not now", Friends, Friend requests, Close chat (t857), detects (extraction.1, .3), reads of all 8 rows; two identical re-reads refused `changed_nothing`; 0029 malformed reply (charged $0.000999). No Confirm pressed. | ok; the popup was never seen while exploring |
| 0033-0036 | Rev 1: listing of all 8 with no condition, Confirm repeated over every row, per-row `wait_for_text $row.name`, after-read with a regex `recordOutput.process` (drops Jonas). Trial 1 (start reset): all 8 confirmed; 4th and 7th press `rate_limited`, waited 5.5 s, notice closed, re-pressed (attempts 2). | judges 0037/0038 no: right |
| 0039-0060 | describe_nodes (filter-list, for-each); revs 2-5 (3 refused as `parameters_unresolved` extraction.2; 3 identical resubmits refused `already_answered`). Trial 2 on rev 5: the same 8 confirms and the same two refusals. | judges 0061/0062 no: right |
| 0063-0068 | Revs 6-8 add `builtin.data.filter-list` before the repeat: `operator matches` not offered; `required_input_unconnected inputs.items`; `unknown_parameter items`. Three `evidence_completion_plan_invalid` in a row end the build (`refusal-run.ts:45-50`). | build ended |

Causes (file to change): **A** rate limit absorbed but never taught, and nothing in the format or runtime can pace a
loop (`service/candidate-trial/feedback.ts:89-97`; `executor/graph-run.ts:548-557` and `nodes/timing/wait.ts`, the
wait node halts the run; `graph-run.ts:631-640` waits the full hint after a 2.7-4.6 s snapshot; `assemble.ts:319` and
`draft-routing.ts:316-318` refuse in-span dismissals and branches; `ui/activity-action/failure-reason.ts:43` calls it
"the page was busy"). **B** the guidance sends row narrowing to run-end `recordOutput.process`
(`flow-bootstrap/plan/flow-script-format.ts:267`, example :284-301 without a `where`) and the read grammar says "omit
it ... narrow later" (domain `output-nodes/extract-list/catalog-text.ts:234`, `runtime/llm-evidence/tools.ts:392`),
though `extractList.where [{"field":"mutual","atLeast":5}]` exists, assembles (W2 probe) and kept the right four live
in round 4. **C** three different corrected defects counted as one refusal kind (`candidate/submission-refusal.ts:61-64`).
**D** the model copied text line t860 as the "close the chat" target; nothing refuses a press on a non-control
(domain `plan-resolution/resolve-plan-node.ts:689-700`).
