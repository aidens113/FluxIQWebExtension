# E1 live checks, round 3 (t885)

Sub-supervisor report. Paired worktrees `fxwork/t885/!FluxIQWebExtension` and `fxwork/t885/!FluxIQ`, branch `task/t885-live-checks-r3`, Lab slot 1, instance `t885-live` (scripted proofs on `t885-proof`). The lead committed all verified work; nothing here is committed by this lane.

## Outcome

All three agreed live checks passed:
- **napkins on Sonnet.** A carried count act is not repeated, so count tasks may resume.
- **apprentices on Haiku.** The native judge schema is on dev and gives full replies.
- **kiln on Sonnet.** Saved steps and looks reach the judge.

Breadth turned up a chain of defects. The user also reported, while watching, that a robot check "restarts" the task. Each defect was traced to its root cause and fixed with tests beside the change. The robot-check pause was then proven live: the hubs task went 4 of 4 attempts right, with 9 checks each paused and resumed in place. One breadth task (towels on Haiku) failed. Its causes are fixed and verified provider-free; it waits on a dev merge before it is rerun live.

## Native judge schema (still-open item 2)

Dev sends judges their real schema natively: integration round 2 carried lane A's 05ff53e2a (`isOpenOptionalObject` in Core `runtime/models/providers/anthropic/schema.ts`). Judge requests carry `output_config.format.type: json_schema`. Haiku's replies had every field in three judges across two runs (run-mw9xfwvd-ccc692b2 0035, run-mwa05th9-c29bd97a 0028/0030). Sonnet fills only the required keys (summary "Yes."), which is the required set working as designed.

## Run table (live, Anthropic)

| Task | Model | Attempts | Verdict per attempt | Calls | Cost | Run id |
| --- | --- | --- | --- | --- | --- | --- |
| bigbox-retail-napkins-for-delivery | Sonnet 5.5 | 2 | right, right (attempt 2 pressed nothing) | 11, 6 | $0.4357 | run-mw9x529c-557f5402 |
| company-website-apprentices | Haiku 5.5 | 2 | right, not started (chat chose Run; Run failed) | 11+, 1 | $0.0294 | run-mw9xfwvd-ccc692b2 |
| company-website-apprentices (rerun after fix 1) | Haiku 5.5 | 2 | right, right (run_flow) | 11, 1 | $0.0204 | run-mwa05th9-c29bd97a |
| photo-social-kiln-notes | Sonnet 5.5 | 2 | right, right (steps saved and rerun) | 22, 9 | $0.6854 | run-mwa0iiha-f3c93e83 |
| social-network-feed-recent-group-posts | Haiku 5.5 | 2 | right, right (run_flow) | 17, 2 | $0.0727 | run-mwa0t77i-8277ba59 |
| crossborder-marketplace-free-hubs-under-ten | Sonnet 5.5 | 2 | right, right but attempt 2 cost 3.6x | 13, 39 | $2.4311 | run-mwa19obz-abd5d558 |
| crossborder-marketplace-free-hubs-under-ten (after fixes 2-8) | Sonnet 5.5 | 4 | right x4; replays 3-4 run_flow, 0 decisions; 9 robot checks paused in place | 33 (1/5/27), 4 (1/1/2), 2 (1/1/0), 2 (1/1/0) | $1.7820 | run-mwaf6gnt-638d90a0 |
| bigbox-retail-rated-delivery-towels | Haiku 5.5 | 4 | attempt 1 stuck_in_a_loop, not judged | 61 | $0.2038 | run-mwafor01-bb471f52 |

Calls are given as interpretation/judge/decisions where the Lab reported them. Every run has a debug note under `docs/working/language-driven-flow-loop-plan/debugs/<runId>.md`.

**Spend** (lab-slots/spend-ledger.jsonl, instance t885-live finishes): $5.6604 over 8 runs. One guard refusal (`behind-dev`) and one (`loop`) cost $0. Scripted proofs are not ledgered and cost nothing.

## Fixes (all verified by me, committed by the lead)

| # | Cause | Files | Narrow validation (mine) |
| --- | --- | --- | --- |
| 1 | Haiku's chat sent the same words to `run.execute`. Run on an answer-first task's Flow then failed outright ("no Router-selected Subflow execution path"): attempt 1 holds its steps with the task, so the Flow had no Router. | Core `runtime/conversations/commands/{run-flow.ts, answer-first/task-of-flow.ts, build.ts, answer-first/index.ts}`, `runtime/conversations/instructions/prompt.ts`, `programs/automation-studio/api/handlers/task/known-flow.ts`, `api-contracts/automation/task-attempt.ts`, `answer-first/route/{index.ts, task-of-flow.ts}` + tests; doc line in `llm-flow-bootstrap.md` | 25 files / 242 tests; fluxiq check 0; audit pass. Live rerun passed (commit 1657dadda) |
| 2 | A plain press answered by a robot check was recorded as a lasting act that may have landed, so Next page was skipped on every later pass. | Core `answer-first/run-acts/settling.ts` + test | run-acts + rows 11 files / 167 tests (9421825cb) |
| 3 | A full re-read after a short read was appended as a next page, putting rows out of order. | Core `answer-first/rows/list-after-read.ts` + tests | same (93a6f2b56) |
| 4 | **Robot-check restart (user report).** Cleared checks counted against a bound of 3 per round and per run, so the 4th check ended the round and the model went back to page 1. Also: a stale view after Continue, the next round told a cleared step "failed", repeated completions on identical evidence re-judged, and a refused completion's answer shown to the person. | Core `runtime/automation-parking/person-needed-tool-calls.ts`, `engine/automation/person-needed.ts`, `answer-first/completion/check.ts`, `answer-first/flow-run/steps-ran.ts`, `runtime/flow-authoring/bootstrap/person-needed.ts`, `runtime/adaptation/recovery/runtime-exploration.ts` + tests; Lab script `scripted-model/scripts/crossborder-marketplace-free-hubs-under-ten.ts` | 106 files / 816 tests; check 0; scripted pair run-mwa9oytn-d866da84. Live: 9 checks paused in place (82780c6dd, dc2579d61) |
| 5 | A step written on the page a skipped carried lasting act would have produced (napkins "View cart", kiln after "Done") failed instead of being passed over by page state. | Core `engine/automation/state-routing/{not-arisen.ts, decision.ts, routed-attempt.ts, index.ts}`, `engine/automation/index.ts`, `answer-first/run-acts/run-gate.ts`, `answer-first/flow-run/steps-ran.ts` + tests | 128 files / 951 tests (1c47ea562) |
| 6 | The judge saw only the page the run ended on. | Core `result-verification/flow-less/{types,question,judged-summary,index,read-pages-shown}.ts`, `answer-first/{completion/check.ts, attempt/run-attempt.ts, rows/*}`, `engine/automation/{contracts.ts, records/capture.ts, records/read-location.ts}` + tests | 58 files / 518 tests (74949e67f) |
| 7 | A self-appearing timer cover was credited to the typing before it, so its "Not now" was saved as a required step. A layer is now credited only on evidence: aria-controls/owns/activedescendant, anchoring, or aria-expanded; otherwise the act's kind decides. | Extension `domain/src/runtime/llm-evidence/node-run/run.ts` (526-532) + `node-run/own-layers/{memory,index,act,opened-by,tied,beneath,held-by}.ts` + tests | domain check 0; node-run 571/571; scripted pair run-mwaergal-9493d57a ran the saved Flow whole (a01070f2b) |
| 8 | An exploring read whose conditions were not applied was stored as rows and displaced good pages. An honest empty page was not shown to the judge. | Core `answer-first/rows/{found-rows,row-sink,list-after-read,list-page,sink-type}.ts`, `flow-less/question.ts` + tests | batch 4 below |
| 9 | The result switched to another list (a by-hand re-read with different conditions) and the model was never told; also inside `core.run_flow`. | Core `answer-first/rows/{result-change.ts, row-sink.ts, rows-call.ts, index.ts}`, `attempt/call-chain.ts`, `runtime/llm/node-tools/run/{result-list.ts, flow-part.ts, index.ts}` + tests | batch 4 below |
| 10 | No pager on a list that fits one page answered page_fault (read as an uncertain press). An honest empty page was flagged as a replay change. The read account called rejected rows "kept". | Extension `apps/extension/src/content/extraction/page-advance/{move-page,move-outcome}.ts`, `domain/.../node-run/{replay.ts, shown-rows/account.ts}` + tests | batch 4 below |

Batch 4 (fixes 8-10), my checks after a Core library rebuild: fluxiq check 0; Core audit passed; vitest node-tools/run + answer-first + flow-less 121 files / 929 passed; domain check 0; extension check 0; extension audit passed; domain node-run 573/573; extension no-pager 2/2.

## Workers

| Worker | Tier | Brief | Outcome | Verified |
| --- | --- | --- | --- | --- |
| run-execute-answer-first | worker-heavy | fix 1 | Done | tests, check, audit; live rerun |
| hubs-attempt-2 | worker-heavy | fixes 2-3, cause of fix 6 | Partial (cause 3 left for a decision) | tests, check |
| person-check-pause | worker-heavy | fix 4 | Done | tests, check; scripted and live |
| state-routed-steps | worker-heavy | fix 5 | Partial (cover cause in a then-locked file) | tests, check |
| judge-read-pages | worker | fix 6 | Partial (no page address for saved-Flow reads) | tests |
| judge-read-pages-flow-run | worker | fix 6 addresses | Done | tests, check, audit |
| self-appearing-cover | worker-heavy | fix 7 | Partial (stale Core dist blocked its check) | domain check and tests after my rebuild |
| paged-reads-and-next-page | worker-heavy | trace and fix 8; propose 10 | Partial (10 was in t890's paths then) | tests, check |
| result-list-switch | worker-heavy | fix 9 | Done | tests, check, audit |
| result-list-switch-run-flow | worker | fix 9 run_flow gap | Done | tests, check |
| pager-replay-account | worker | fix 10 | Partial (`next-page.ts` noEffect line outside its paths) | tests, both checks after rebuild |

No escalation between tiers was needed. Worker reports are under `reports/live-checks-r3/`.

## Not verified

- Fixes 8-10 have not run live yet. The towels rerun waits on the lead's commit and a dev merge (both trees were behind dev at the time of writing).
- `apps/extension/src/content/actions/next-page.ts:74` still ignores `noEffect` on a page fault. The observed failure is fixed by `ended`; this line is the second half, awaiting the lead.
- The napkins saved Flow still has no way to the cart once "View cart" is passed over (it stops at the cart read and the model recovers).
- Kiln's read under the open dialog after the pass-over is not proven live.
- The 2 calls per replay (interpretation and judge) remain until S6 and S9 land.

## What remains

1. Rerun towels on Haiku at `--attempts 4` after the merge.
2. Breadth at `--attempts 4`: crossborder's other tasks, social-network-feed's other tasks, bigbox's other tasks (count tasks may resume), alternating models.
3. Still-open items 3-8 of the Answer First Current State. Item 2 is answered: native is on dev and proven on Haiku.
4. old-modes.test.ts: no time limit of its own (Core's 15 s default). It reads 774 source files (5.3 MB) one after another, which ran slow at 0.6 GB free. Noted, not changed.
