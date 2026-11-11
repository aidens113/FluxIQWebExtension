# E1 live checks, round 3 (t885)

Sub-supervisor report. Paired worktrees `fxwork/t885/!FluxIQWebExtension` and `fxwork/t885/!FluxIQ`, branch `task/t885-live-checks-r3`, Lab slot 1, instance `t885-live` (scripted proofs on `t885-proof`). The lead committed all verified work; nothing here is committed by this lane.

## Outcome

All three agreed live checks passed:
- **napkins on Sonnet.** A carried count act is not repeated, so count tasks may resume.
- **apprentices on Haiku.** The native judge schema is on dev and gives full replies.
- **kiln on Sonnet.** Saved steps and looks reach the judge.

Breadth turned up a chain of defects. The user also reported, while watching, that a robot check "restarts" the task. Each defect was traced to its root cause and fixed with tests beside the change. The robot-check pause was then proven live: the hubs task went 4 of 4 attempts right, with 9 checks each paused and resumed in place. Towels on Haiku failed twice: first stuck in a loop, then with a wrong answer the judge accepted. Both are traced and fixed, and so are two more robot-check gaps: a check seen only in a look, and a replay that dropped a filter after a cleared check. All are proven provider-free; the towels rerun waits on the lead's commit and merge.

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
| bigbox-retail-rated-delivery-towels (after fixes 8-11) | Haiku 5.5 | 4 | attempt 1 wrong (15 of 16 rows), accepted by the judge; attempts 2-4 not run | 49 (1/4/44) | $0.1800 | run-mwaknxf9-7549d126 |
| bigbox-retail-rated-delivery-towels (after fixes 12-17) | Haiku 5.5 | 4 | right, right; attempt 3 not judged (its right replay was judged no for want of left-out rows, then the model replaced the result and looped); 4 not run | 53 (1/3/49), 18 (1/3/14), 44 | $0.4197 | run-mwaudvnh-c208d32c |
| bigbox-retail-rated-delivery-towels (after fixes 18-22) | Haiku 5.5 | 4 | attempt 1 wrong only by an extra unasked `link` column (all 16 rows right; judge yes at once); 2-4 not run | 28 (1/1/26) | $0.0871 | run-mwb2kkv5-1baeee11 |

Calls are given as interpretation/judge/decisions where the Lab reported them. Every run has a debug note under `docs/working/language-driven-flow-loop-plan/debugs/<runId>.md`.

**Spend** (lab-slots/spend-ledger.jsonl, instance t885-live finishes): $6.2601 over 10 runs. One guard refusal (`behind-dev`) and one (`loop`) cost $0. Scripted proofs are not ledgered and cost nothing.

**Provider-free scripted proofs** (instance t885-proof): run-mwaergal-9493d57a (hubs, `--attempts 2`: the saved Flow ran whole past the absent cover); run-mwapfy0i-d64b26db (hubs timed-check variant: the hand-off came from a look, `dom-capture_snapshot` with `personCompletedCheck`); run-mwasz6va-59a17e08 (timed-check, after fix 17: attempt 2 `run_flow`, 0 decisions, read at `freeShipping=y&maxPrice=10`, right rows, after two checks cleared during the replay).

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
| 11 | A page fault decided before any press reached Core as an uncertain press. | Extension `content/actions/next-page.ts` + test | 9/9; fails 8/9 reverted (8a8465c52) |
| 12 | **Towels wrong yes.** The reads were right. Judges called correct organic rows "sponsored" because their end view showed ad copies of the same names, and the model then excluded the organic row by name. The judge now sees, per read, the rows kept and what each condition left out. | Core `answer-first/rows/{read-evidence,read-evidence-type,list-page,list-after-read,row-sink,index}.ts`, `flow-less/{read-left-out,read-pages-shown,judged-summary,question,types,index}.ts` + tests | 37 files / 287 tests (4684e7f96) |
| 13 | **A robot check seen in a look was never handed to the person** (the model tried to stop four times), and the model text said "say that one blocks you". A look now waits out a self-clearing check and hands a person-only one over in place; the text says FluxIQ pauses. | Extension `runtime/look-check/*` (new), `runtime/{index,action-runner}.ts`, `domain/src/actions/check-wait.ts`, `domain/.../llm-evidence/{capture.ts, system-instructions/instructions.ts}` + tests; Core endings test | domain 597/597, extension 49/49; scripted run-mwapfy0i-d64b26db (8dea8d226, 152a544bd) |
| 14 | No realistic scenario raised a check without an action, and `lab attempt` never armed a task's variant. | Scenario-lab crossborder `timed-check` variant (oracle unchanged), task row, script form; `attempt-lane/live/run-attempt-command.ts`; testing-facility.md rows | scenario 77/77, scripts 52/52 (75decdf48) |
| 15 | A select or check whose reply came from the old document never had its landing judged. | Extension `runtime/click-landing.ts`, `domain/src/actions/check-wait.ts` + tests | 118/118, 7/7 (83b4a3bf4) |
| 16 | The check allowance reached host-state, passive-reader and post-failure captures. | Domain `runtime/llm-evidence/tools.ts` + 5 test files | `runtime/llm-evidence actions` 1828/1828 |
| 18 | **Act gate matched a different press** (t893 item 3, run-mwaszqeh-cc316c6d): a control's kind (`implicitRole: "button"`) was read as one of its words, so a chat popup's Close matched an earlier Accept and was refused three times. Kind fields are no longer words. When both forms name their control, the words decide; when only one does, they are the same act (a thinner-form repeat is still refused). | Core `runtime/answer-first/act-record/{identity/target-keys.ts, record.ts, tests/kind-is-no-control-word.test.ts, tests/thin-press.test.ts}` | 94 files / 883 tests (cd0d3bb6a) |
| 19 | **A saved Flow run's reads did not tell the judge what their conditions left out** (towels attempt 3: a right replay judged no). The left-out account now rides on the record batch, and a left-out label equal to a kept one is marked `sameLabelKept`. | Core `engine/automation/{contracts.ts, records/capture.ts, records/read/*}`, `answer-first/rows/{read-evidence,row-sink}.ts`, `flow-less/{read-pages-shown,question}.ts` + tests (incl. `flow-run/tests/repaired-read-conditions.test.ts`) | 303 files / 2374 tests; scripted run-mwaxy7s0-871febc5 `--attempts 4`: replays 2-4 `run_flow`, 0 decisions (1313c30fb) |
| 20 | **Rows that met every condition were discarded** after a wrong judge no: an unconditioned look became the result. A read lacking any condition of the result now stays its own list (`result_list_kept`); a stricter read still replaces it; an explicit `writeMode: replace` may (lead-approved). | Core `answer-first/rows/{row-sink,result-change,read-evidence,read-evidence-type,result-dataset}.ts` + `tests/result-keeps-conditions.test.ts` | 77 files / 529 tests; fails 5/7 against HEAD (150aa58ef) |
| 21 | **A wait read as a failed save** ("I could not save steps"). `notes_only` gains `why` and `earlierKept`; the person is told it is waiting and earlier steps are kept. Also mirrored dev's `checkingOff` into the chat type, which had broken the ui-components check. | Core contracts 0.18.1 `saved-state.ts`; ui-components 0.12.1 `chat/ports/results.ts`, `chat/answer/words/saved-words.ts`; `answer-first/attempt-store/*`, `attempt/ending.ts` + tests | contracts 854/854, ui chat 672/672, ui check 0 (6d44d6f97) |
| 22 | `old-modes.test.ts` timed out under load reading ~800 files one after another; it now reads them concurrently (limit unchanged). | Core `answer-first/apply-proven/tests/old-modes.test.ts` | 14/14 (c4f81570a) |
| 23 | **Dining regression from fix 20**: a final read of ANOTHER list (saved items, other view and columns) was held apart for lacking the search's conditions. Proven by turning the rule off (run-mwb58h2e-978e871a passed). A read is now held apart only when it re-reads the result's own list (same record-output name, else same view, else every column). The dining script now answers a 4-attempt series. | Core `answer-first/rows/{row-sink,result-change}.ts` + tests; Lab `scripted-model/scripts/local-classifieds-save-dining-tables.ts` + test | 550 tests; dining 4/4 (f75373940, 4333e6aac) |
| 24 | **Answer held an unasked column** (towels run-mwb2kkv5: `link`). The row sink gets the instruction and shows the person's named columns; replays declare the same columns as the saved Flow (namedColumns wired through the loop, round and service); dedupe stays on the row's stored identity, so two listings that differ only by link both stay. | Core `answer-first/attempt/{run-attempt,round}.ts`, `service.ts` (namedColumns lines), `rows/row-sink.ts`, `runtime/llm/{loop-configuration,evidence-loop}.ts`, `node-tools/{dry-run-gate,run/flow,run/flow-part,replay/*}.ts` + tests | 1500 tests; dining and hubs 4/4 (pending commit) |
| 25 | **A forward run's re-read of the result's own list counted as another list, and a narrowed replay dropped a row field a later step binds** (`$row.url`, `core.replay.unresolved_binding`). A replay of a saved step now joins the list of the read that recorded it, and keeps the row fields its repeat reads (t869's lowering, shared with assembly). The rerun put-back carries `partOf` and `namedColumns`. | Core `answer-first/rows/{dataset-of-read,row-sink}.ts`, `node-tools/replay/row-fields.ts` (new), `node-tools/step-place.ts`, `evidence-loop.ts` + tests | 1500 tests; dining run-mwbbrxpo-02eea338 and hubs run-mwbd2ybz-0849709f 4/4, replays `run_flow` at 1 call (pending commit) |
| 17 | **A replay dropped a filter after a cleared check.** After Continue the replay took the success edge with no look, though the press was never made (the page was the check). A step is now judged on the page after Continue: an unmade act or a read runs again, a declared effect is checked, an unknown lasting act is held and never repeated, and a plain toggle goes on. The extension keeps the original `effect: "unacted"` on the check record. | Core `engine/automation/{person-cleared.ts (new), graph-run.ts, person-needed.ts}` + tests; extension `content/action-runtime/results.ts` + test | Core 215 files / 1706 tests; content/action-runtime 519/519; scripted run-mwasz6va-59a17e08 |

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
| pager-replay-account | worker | fix 10 | Partial (`next-page.ts` noEffect line outside its paths; I made it, fix 11) | tests, both checks after rebuild |
| look-person-check-trace | worker-heavy | trace for fix 13 (read only) | Done | read its file:line claims against the fix |
| dropped-organic-row | worker-heavy | fix 12 | Done | tests, check, audit |
| look-person-check-fix | worker-heavy | fix 13 | Partial (package checks blocked on a stale Core build) | both checks after my rebuild; tests |
| timer-check-variant | worker-heavy | fix 14 | Partial (`lab attempt` did not arm variants; I made that 2-line change) | scenario and script tests; scripted Lab proof |
| select-landing | worker | fix 15 | Done | tests, both checks |
| check-cleared-effect | worker-heavy | fix 17 (Core) | Partial (extension half outside its paths) | Core suites; scripted Lab proof |
| check-wait-domain-tests | worker | fix 16 | Done | full domain run 1828/1828 |
| check-record-effect | worker | fix 17 (extension) | Done | content/action-runtime 519/519, check |
| act-gate-wrong-match | worker-heavy | fix 18 | Done | 94 files / 883 tests, check, audit |
| replay-lost-conditions | worker-heavy | trace of towels attempt 3 (read only) | Done | its step evidence against the fix |
| flow-run-left-out | worker-heavy | fix 19 | Partial (the save wording was outside its files; done as fix 21) | 303 files / 2374 tests, check, audit; scripted proof |
| result-keeps-conditioned-rows | worker-heavy | fix 20 | Done | combined suites, check, audit |
| waiting-not-failed-save | worker | fix 21 | Partial (ui-components check failed on dev's `checkingOff` gap; I fixed it) | contracts, ui chat, both checks |
| named-columns-answer | worker-heavy | fix 24 (sink) | Partial (needed `run-attempt.ts`, then another lane's) | tests, check |
| replay-named-columns | worker | fix 24 (replay) | Partial (callers outside its paths) | node-tools tests |
| dining-rows-regression | worker-heavy | fix 23 | Partial (script lacked a 4th judge reply; I added it) | tests; dining 4/4 after my script change |
| named-columns-wiring | worker-heavy | fix 24 (wiring, dedupe) | Done (it asked the lead directly for round.ts and service.ts) | 1492 tests; dining proof then exposed fix 25 |
| forward-run-same-list | worker-heavy | fix 25 | Done | 1500 tests; both 4/4 proofs (read their reports myself) |

No escalation between tiers was needed. Worker reports are under `reports/live-checks-r3/`.

## Not verified

- Fixes 18-21 have not run live yet; the towels rerun at `--attempts 4` is the first.
- A set-aside list (fix 20) is not shown to the judge; that needs `completion/check.ts`, which comes to this lane after t895 lands.
- Wordless icons are told apart only by their other fields: a web icon's drawing token looks like an address, so the act record leaves it out of identity. It errs toward refusing; a fix changes persisted act ids and needs its own brief.
- The napkins saved Flow still has no way to the cart once "View cart" is passed over (it stops at the cart read and the model recovers).
- A hand-off from a look on a live site: proven only by the scripted timed-check variant and unit tests.
- Domain test rule pinning the extension's `rejectedRows` shape (Core reads it by name): proposed in dropped-organic-row.md, not added.
- Kiln's read under the open dialog after the pass-over is not proven live.
- The 2 calls per replay (interpretation and judge) remain until S6 and S9 land.

## What remains

1. Towels on Haiku at `--attempts 4` (running, after t897's panel outcome-reader fix).
2. Breadth at `--attempts 4`, alternating models: ten tasks, one per site, each proven provider-free to reach its oracle (`reports/live-checks-r3/breadth-prep.md`; professional-network re-run by me, 2 pass): everything-store-coupon-earbuds-rated-four, crossborder-marketplace-follow-official-store, bigbox-retail-checkout-quote-without-ordering, job-board-remote-easy-apply, local-classifieds-test-ride-question, auction-marketplace-save-mark-ii-sellers, photo-social-priya-tags, social-network-feed-hide-suggested-posts, company-website-saturday-certificate, professional-network-kade-lead-contact. Every Lab run goes through `heavy-slot.mjs run t885 --`.
3. The set-aside list for the judge needs `completion/**`, which is t897's; the change goes through the lead.
4. Still-open items 3-8 of the Answer First Current State. Item 2 is answered: native is on dev and proven on Haiku.
