# Lane tree reconciliation (t174, t193, t194, t195) against dev and t262

Worker brief: `lane-tree-reconcile` in `docs/working/mvp-final-month-plan.md`. Date 2026-10-05. Read-only on
every worktree. No git writes, builds, tests, Lab runs or provider calls. All scratch output stayed in this session's
scratchpad (`.../scratchpad/ltr/`). `R/` means Core `packages/fluxiq/src/programs/automation-studio/runtime/`.

## Outcome

Done. All four lane trees were inventoried on both sides. Each changed file was compared three ways (lane HEAD as base,
`task/t262-mvp-live-continuation` tip, lane worktree) and against every other lane. The fixes are grouped from the lane
lead reports, and each group has a recommendation.

Main finding: **Codex's t262 has already ported or reworked a large part of lane A and lane C.** For example, 11 of
t174's domain files are byte-identical at the t262 tip, and t262 rewrote t194's paging, retry and kept-keys fixes. Codex
also wrote its own read-only A/B and C/D reconciliations (`fxwork/t262/!FluxIQWebExtension/docs/working/mvp-live-continuation-2026-10-03/reports/resume-ab.md`,
`resume-cd.md`). The lanes should therefore be integrated **onto t262 once it has landed on dev**, not onto their old
base `45bd6232` / `6beae684`.

## What changed and why

Only this report was written.

## Baseline facts (observed)

| Tree | Branch | HEAD | Status lines (incl. untracked) | Real modified / untracked (excl. reports, docs/working) |
| --- | --- | --- | --- | --- |
| t174 downstream | task/t174-live-lane | 45bd6232 (on dev) | 113 | 78 modified (+2 deleted), 35 untracked (21 are reports) |
| t174 Core | same | 6beae684 (on dev) | 104 | 85 modified, 19 untracked |
| t193 downstream | task/t193-live-self-repair | 45bd6232 | 60 | 37 modified, 23 untracked (13 reports/debug) |
| t193 Core | same | 6beae684 | 87 | 72 modified (+2 deleted), 15 untracked |
| t194 downstream | task/t194-live-judge-answer | 45bd6232 | 51 | 31 modified, 20 untracked (19 reports/debug) |
| t194 Core | same | 6beae684 | 69 | 60 modified, 9 untracked |
| t195 downstream | task/t195-live-control-flow | 45bd6232 | 23 | 9 modified, 14 untracked (13 reports/debug) |
| t195 Core | same | 6beae684 | 77 | 69 modified, 8 untracked |

- t262 is built on current dev. Its downstream merge-base is `88c58d82`, 1 docs commit behind dev. Its Core merge-base is
  Core dev `f6ef9f48` itself. So "t262 tip" below also includes everything on dev.
- Since the lane base, dev changed 17 downstream and 27 Core files. Three of them are lane files: Core
  `R/flow-bootstrap/instructed-acts/{choice-order.ts,tests/choice-order.test.ts}` and `docs/architecture/automation-studio/llm-flow-bootstrap.md`
  (dev `b52bf47d`), plus downstream `docs/architecture/testing-facility.md`. t262 carries all of these.
- Line endings: many lane edits left CRLF in LF-tracked files (git warns on each). t174's
  `packages/test-runner/src/existing-fluxiq-control.ts` reads as 795/789 lines changed but is a real 7/1 change; the rest is
  line endings. Normalise to LF before committing.
- Newer live endings that the lane reports do not record: A run 3 `run-musuq910-0e2ae903` (instance t174-slot-1) and B run 2
  `run-mustzxhi-2e2cda87` (t193-slot-2) both have `run.json` status `failed`. t262 debugged them
  (`fxwork/t262/.../language-driven-flow-loop-plan/debugs/run-musuq910-0e2ae903.md`, `run-mustzxhi-2e2cda87.md`). So **A's and
  B's full fix sets already ran live once and failed**. C's wave-1/2 fixes ran as `run-mustvzvg-99695308` (no Flow); w85/w86
  came after that run. D's batch 1 ran as `run-musr9pv3-f4bf6256` (no Flow); batch 2 (w45-w49, plus an unreported w50)
  came after that run. Nothing after those runs has run live.

Overlap legend for the tables:
- **lane-only**: t262/dev never touched the file, so the lane change applies as is.
- **in t262 (identical)**: the lane file equals the t262 tip.
- **contained**: a three-way merge onto t262 changes nothing.
- **extra**: the merge is clean and adds lane hunks.
- **conflict(n)**: n conflict hunks against t262.

## Lane A: t174 (hub to cart)

| Fix | Defect | Files (main) | Tests | Overlap with dev / t262 | Recommendation |
| --- | --- | --- | --- | --- | --- |
| A1 Flow cost limit bound | Playback refused 400 "LLM estimated-cost limit is invalid." for any ceiling above $0.25 (run musq0b1m) | Core `api/handlers/llm-execution-settings.ts` + test | yes, failing first | lane-only. t262 tip still has literal `> 0.25` at line 33 | **integrate** (small and independent) |
| A2 cancelling toggle pair, stale handles, stale marks (w103/w115) | Flow kept an un-choose/re-choose pair; rerun used a stale handle | domain `press-effect/{toggle,chosen-state,choice,index}.ts`, `node-run/{run,written-step}.ts`, `capture.ts`, `stable-handles.ts` + tests; Core `R/flow-draft/{reversal,step,entry,amendment,dry-run,index}.ts`, `R/llm/{evidence-loop-decision,evidence-loop}.ts`, `evidence-loop/{tool-execution,call-record}.ts`, `node-tools/{step-place,rerun-check}.ts` | yes | domain: all 11 **in t262 (identical)** (`326ad350`). Core: flow-draft entry/step/amendment/dry-run and evidence-loop-decision **contained**; step-place, tool-execution, call-record, index **identical**; `reversal.ts`+test conflict(3), `rerun-check.ts` conflict(2), `evidence-loop.ts` conflict(1). t262 `9f756676` refined reversal so it does not pair across an intervening kept executable step | **superseded by t262** (drop the lane copy) |
| A3a judges see change lines; exploration state predates test (w106) | Judges could not see a step undo another; they read exploration's "3 Cart" as the test's result | Core `R/result-verification/build-test/{change-lines (new),summary,index}.ts` + tests, `R/llm/diagnosis-instructions.ts`, pins, `diagnosis-channel.test.ts` | yes | change-lines lane-only; summary.ts extra over t262; diagnosis/pins conflict with t193 and t194 | **integrate**, serially with B's F2 (same summary/diagnosis/pins) |
| A3b claim doubt, optional-only, choice-order no reorder (w114) | Pro reorder broke test; act claimed on wrong step; act's only step left optional | Core `R/flow-bootstrap/instructed-acts/{claim-doubt,kind-words,optional-only,check,checklist,choice-order,index}.ts` + tests, `run-musq0b1m-draft.ts` fixture, `R/flow-draft/act-claim.ts`, `R/llm/harness-options/bootstrap-completion.ts` | yes | claim-doubt/kind-words/check/checklist conflict(1-3): t262 `9f756676`/`97e279de` rewrote claim-doubt as advisory. choice-order conflicts with dev `b52bf47d`. optional-only lane-only; bootstrap-completion extra | claim-doubt/kind-words **superseded by t262**. optional-only and choice-order **need rework** onto dev's choice-order |
| A4 per-act instruction read (w107) | Instructed read dropped the coupon and raced a press | Core `R/action-permissions/instructed.ts`+test, `R/service/instruction-authority.ts`+new test, `R/flow-bootstrap/action-permissions.ts`, `R/flow-draft/verify-only.ts`, `R/llm/node-tools/dry-run-gate.ts`, `permission-outcome.ts`, `confirm-requests-build.test.ts` | yes | instructed.ts and instruction-authority lane-only vs t262. `action-permissions.ts` conflict(1) with t262 (`97e279de` source-grounded split acts) and conflict(2) with t193. instruction-authority conflict(4) with t195 | **needs rework**: one unit with B's F1 and t262's split-act grounding, as Codex's `resume-ab.md` also recommends |
| A5 Core wording, amendment `told`, build trace, finishing verdict (w108/w116/w118) | Raw ids and mechanics in chat; ending and verdict not recorded | Core `R/activity/{build,draft-edit,observer}.ts`, `R/activity/wording/{action,draft-edit-refused,reason-text,tool-call}.ts`, `R/llm/{draft-amendment-feedback,step-log/answer-step,decision-handlers/amendment,evidence-progress/*}.ts`, `R/flow-bootstrap/unfinished-build/{finishing-verdict (new),contracts,phases}.ts`, `R/service.ts`, `src/ui/activity-action/*` | yes | decision-handlers/amendment conflict(1) and service.ts conflict(1) with t262; build-judge, feedback and phases extra. t193 **deletes** `activity/draft-edit.ts` and `wording/draft-edit-refused.ts`; answer-step conflict(2) with t194 | **integrate after B's F6 move** (re-apply into moved files) |
| A6 chat wording D9 (w105) | First reply, URL, "Say run it" | Core `R/conversations/{conversations,site-name (new)}.ts`, `commands/{command,create-here,explore,improve,run-flow}.ts`, `instructions/respond.ts` + tests | yes | explore.ts and extension-chat test extra over t262 (`80116d0e`); create-here shared with t193 and t195 | **integrate** |
| A7 replay tab cleanup, remembered waits (w104) | Tabs accumulate; remembered steps waited 5-7 s | domain `client/close-opened-tabs-parameter.ts (new)`, `client/index.ts`, `node-run/replay.ts`+test; extension `runtime/{fluxiq-opened-tabs (new),action-runner,browser-tab,click-landing,command-options}.ts` + tests; `docs/architecture/web-capabilities.md` | yes | lane-only | **integrate**. Needs browser proof (lead: "no browser proof") |
| A8 consent closer (w119) | "Accept all cookies" added | domain `node-run/covered-target.ts` + test | yes | lane-only | **integrate** |
| A9 extension UI (w109/w117) | Stale "— done", overlay hold, composer kept text, chat stopped following | extension `background/activity/{headline,pacer}.ts`, `content/activity-overlay/{index,overlay}.ts`, **deletes** `status-dwell.ts`+test, `panel/chat/conversation/{composer,controller}.ts`, `panel/chat/view/scroll-follower.ts`, `shared/activity/{wording,activity-display}.ts` + tests | yes | composer/controller extra over t262 (`408ec3da`). pacer/composer/overlay conflict with t193 and t194; headline conflict with t195 | **integrate** under one extension-UI owner (see conflicts) |
| A10 Lab records (w112/w113/w118) | Ending words, verdict, call rows, tab counts and step order missing; contract 400 filed as environment | `packages/test-contracts/src/evaluation.ts`, test-runner `existing-fluxiq-control.ts`, `run-scenario.ts`, `flow-lane/**`, `live-llm/{live-llm-run,call-rows (new)}.ts`, `lab-runs/write-playback-steps.ts`, `run-scenario/ui-review/**`, `scripts/lab/live-campaign/row/reported-spend.mjs` + tests | yes | run-scenario.ts and lane.test.ts conflict(1) with t262; build-proposal and live-llm-run extra; write-playback-steps and recorder conflict with t194 | **integrate** after A5 (needs Core `buildJudged`) |
| A docs/evidence | — | `docs/architecture/{build-loop,extension-client,testing-facility,web-capabilities}.md`, Core `docs/architecture/automation-studio/{llm-flow-bootstrap,flow-authoring}.md`, 2 debugs, 23 reports | — | build-loop conflict(1) with t262; llm-flow-bootstrap conflict with dev/t262 | evidence: commit as is. Architecture docs: rewrite per landed unit |

## Lane B: t193 (pickup cart)

| Fix | Defect | Files (main) | Tests | Overlap with dev / t262 | Recommendation |
| --- | --- | --- | --- | --- | --- |
| F1 lasting acts by kind | Split acts matched no quote, so tests re-pressed Add to cart (1 to 13 items) | Core `R/flow-bootstrap/action-permissions.ts`+test, `R/flow-draft/verify-only.ts` | yes | action-permissions conflict(1) and its test conflict(1) with t262 `97e279de`, which fixes the same defect by grounding split acts in the source clause. Conflicts with t174 A4 | **superseded by t262** for the defect. Keep the kind fallback only as part of the A4 rework |
| F2 replayed change reaches judge | Quantity "+" change never reached the judge | Core `R/result-verification/build-test/{observation,summary}.ts`+test, `R/llm/diagnosis-instructions.ts`, pins | yes | summary.ts extra over t262; conflicts with t174 A3a on summary, diagnosis and pins | **integrate**, merged with A3a by hand |
| F3 softened judge counts as progress | A refuted no followed by a split yes ended as "no progress" | Core `R/flow-bootstrap/unfinished-build/{contracts,judgement,progress}.ts`+tests, `R/result-verification/build-test/judge.ts`+test | yes | judge.ts and judge.test extra over t262 (`e8c89bbd`); contracts conflict with t174 | **integrate** |
| F4/F10 ending words, unsure sentence, budget/unreadable endings | Ending repeated itself, never named the judge's doubt | Core `unfinished-build/{not-finished,not-done,phases,budget-exhausted,replies-unreadable}.ts`, `R/conversations/commands/create-here.ts`, `R/result-verification/unsettled/*` (new) | yes | phases extra over t262. not-finished conflict(5) and create-here conflict(1) with t195 (w48, C4) | **needs rework**: one wording owner with t195 w48/C4 and t174 finishing verdict |
| F5/F10 amendment answers, moved act told | bind of a press target; refusals without `next`; moved act left a stray press | Core `R/flow-draft/{amendment,act-claim}.ts`, `R/llm/draft-amendment-feedback.ts`, `R/llm/decision-handlers/{amendment,types}.ts`, `R/llm/evidence-loop.ts`, `node-tools/dry-run-gate.ts` + tests | yes | amendment.ts conflict(2), feedback conflict(1), decision-handlers conflict(2), evidence-loop conflict(2) with t262. These files are also in t262's **uncommitted** WIP. amendment.ts conflict(11) with t195 | **needs rework** in the serial Core authoring chain |
| F6 refusal cards | Refused decisions shown as fact; test cards cut; split card inside failed build | Core `src/ui/activity-action/{types,action-of,record,names,index,refusal (new),refusal-words (new)}.ts`, `R/activity/decision-answer/**` (new; **moves** `draft-edit.ts`, deletes `wording/draft-edit-refused.ts`), `R/activity/{observer,in-build (new)}.ts`, `R/result-verification/{agreement,check-activity}.ts`; extension `panel/chat/stream/step/{action-card,card-words}.ts` | yes | lane-only vs t262. Delete-versus-edit with t174, t194 and t195, which all edit the deleted files. check-activity conflict(2) with t194 | **integrate first** in the activity chain, then re-apply the other lanes' edits to the moved files |
| F7 composer and overlay | Composer kept text; overlay over media; overlay drew prose; overlay lag | extension `panel/chat/conversation/composer.ts`, `content/activity-overlay/{overlay,index,status-pill,model-prose (new)}.ts`, `placement/*` + tests | yes | composer extra over t262. composer/overlay conflict with t174 and t194, which made the same "clear on send" fix | **integrate**, merged with A9 and C w83 (choose one clear-on-send) |
| F8 own layers not interruptions | "Set as my store" marked interruption | domain `node-run/own-layers/* (new)`, `press-effect/answered-layer.ts`, `node-run/{run,context,index}.ts`, `tools.ts` + tests | yes | run.ts conflict(1) with t262 (whose run.ts equals t174's); tools.ts extra | **integrate** after t262 (merge onto toggle hunk) |
| F9 "Starting…" from send; display kind | Overlay absent at the first build moment | extension `background/activity/{activity-relay,pacer,index,send-start,send-answer}.ts`, `shared/activity/{activity-display,model-thought}.ts`, `background/panel/*`, `background/connection.ts` + tests | yes | lane-only vs t262. pacer conflict(2) with t174 and t194 | **integrate** under the extension-UI owner |
| F11 draft signature includes acts and `ranWith` | Moving an act or binding answered "undone" | Core `R/llm/evidence-loop/amendment-memory.ts`, `tests/stalled-amendments-replay.test.ts` | yes | lane-only | **integrate** (early, small). Keep consistent with t195 w46 `draft-key.ts`, which hashes the flow signature |
| F12 docs | — | Core architecture docs, both `framework-reference.md`; downstream `extension-client.md`, `build-loop.md` | — | framework-reference conflict(11) with dev/t262 | **drop the lane copies**: regenerate references and rewrite docs per landed unit |

## Lane C: t194 (earbuds)

| Fix | Defect | Files (main) | Tests | Overlap with dev / t262 | Recommendation |
| --- | --- | --- | --- | --- | --- |
| w72 carried steps run as stored; carried joins | Re-author could never test the whole Flow; carried click/type had no handle | Core `R/llm/node-tools/{draft-from-flow,dry-run-gate,run-flow-part}.ts`, `R/flow-draft/full-run-required.ts`, `unfinished-build/not-run.ts`, `R/llm/evidence-loop/resume.ts`, `R/recovery/refuted-result/{brief,reauthor}.ts` + tests (incl. new `carried-as-stored.test.ts`) | yes | draft-from-flow conflict(4) with t262 `0ecdec16`, which deliberately chose a different design: a private `flow-draft/scheduled-candidate`. Per its comment, that correspondence "never becomes `ranWith`, `replay` or evidence that an action already happened", which is exactly what w72 writes | **superseded by t262**. Drop w72's ranWith/replay seeding. Carried-Merge handling: re-check against t262 C4 work |
| w73 judge paging words | Correct 13 rows refuted ("page limit reached") | Core `R/result-verification/read-account/{judge-paging,sentence,index}.ts`, `verify.ts` + tests | yes | judge-paging conflict(1), sentence conflict(2), verify conflict(1): t262 `5c893a98` rewrote the same fix | **superseded by t262** |
| w74 re-author retry only on provider failure; `try: 2` | Re-author built twice on one brief | Core `R/service/runtime-adaptation/reauthor-build.ts`+test, `repair-purse-chain.test.ts`, `evidence-progress/progress-trace.ts`; test-runner `live-llm/reauthor-record.ts` | yes | reauthor-build conflict(3): t262 `e8c89bbd` limits retries to "named transient provider request failure" and has no `try` field or try trace | retry rule **superseded by t262**. `try`/trace record and the Lab `reauthor-record.ts` **need rework** onto t262 |
| w75 one missing key; picture timing words | `missing_input_keys` listed every key | domain `tool-rejection.ts`+test; test-runner `ui-review/recorder.ts` | yes (recorder none) | tool-rejection extra over t262; recorder conflict(1) with t174 | **integrate** |
| w76 repair status and run ending | Panel kept "Step 5 of 5" through repair; bare "Run failed" | extension `background/activity/pacer.ts`+test; Core `R/activity/wording/run-ending.ts (new)`, `R/activity/run.ts`, `R/service.ts` (`readRecord`) | yes | service.ts extra over t262; pacer conflicts with t174/t193 | **integrate** |
| w78 brief advice; rerun needs input | Model followed false advice; empty rerun | Core `R/recovery/refuted-result/brief.ts`, `R/llm/unusable-decision.ts`+test, `evidence-loop-decision.ts` | yes | unusable-decision extra over t262 (`115f67e9`); evidence-loop-decision conflict(1) | **integrate** with rework |
| w79 repeat guard lifts handle failures after a new look | Handle refusals blocked forever | Core `R/llm/repeat-guard/{outcomes,feedback}.ts` + tests | yes | lane-only vs t262. feedback conflict(2) and outcomes test conflict(1) with t195 w46 | **integrate**, serial with t195 w46 |
| w80/w81 refused completion, check card words | Refused call worded as ran; check card | Core `R/llm/evidence-loop/{completion-attempt,decision-refusal}.ts`, `R/activity/wording/{completion-refusal,draft-edit-refused,reason-text}.ts`, `R/result-verification/{check-activity,check-words (new)}.ts`; extension `card-words.ts` | yes | lane-only vs t262. check-activity conflict with t193; draft-edit-refused deleted by t193 | **integrate** after B F6 |
| w82/w84 Lab record gaps; answer folder for no-tool decisions | Re-author tries and playback counts missing; no answer folder | test-runner `live-llm/reauthor-record.ts`, `lab-runs/write-playback-steps.ts`; Core `R/llm/step-log/{answer-step,index}.ts`, `evidence-loop/trace.ts` | yes | write-playback test conflict(1) and answer-step conflict(2) with t174 | **integrate**, serial with A5/A10 |
| w83 composer, overlay flicker | Composer kept message; overlay flicker | extension `panel/chat/conversation/{composer,controller,core-thread}.ts`, `view/{thread-view,message-view}.ts`, `unit-situation.ts`, `chat.css` + tests | yes | controller conflict(1) with t262; controller conflict(5) with t174; composer conflicts with t174/t193 | **integrate** under the extension-UI owner |
| w85 refused rerun names kept keys | Stray `extractList.maxPages` kept by merge patch | Core `R/llm/evidence-loop/{rerun-input,rerun-request}.ts`, `decision-handlers/amendment.ts` + tests | yes | rerun-input conflict(1), rerun-request conflict(3): t262 `115f67e9` added `R/llm/rerun-arguments/*` with the same code `llm_evidence_loop.rerun_kept_keys` | **superseded by t262** |
| w86 bound beside `paginate` is lifted | `maxPages` beside `paginate` refused | domain `plan-resolution/extraction/slot.ts`, `resolve-plan-node.ts` + tests | yes | slot.ts lane-only; resolve-plan-node conflict(1) with t262 | **integrate** (small rework) |
| open (not fixed in lane) | C1 `paginate:true` reads one page silently; C4 `changes_nothing` words for a step that never ran; C6; U-A to U-F | — | — | t262 report `pagination-bound-feedback.md` exists; this report did not check its source state | carry to plan |

## Lane D: t195 (confirm requests)

| Fix | Defect | Files (main) | Tests | Overlap with dev / t262 | Recommendation |
| --- | --- | --- | --- | --- | --- |
| D1 row-scoped check (w40) | Per-row check checked the template card | extension `content/actions/assert.ts`+test, `action-runtime/tests/resolve-target.test.ts` | yes | lane-only | **integrate** (independent, needed for D) |
| D2 "Build failed" ending (w44) | Creation failure shown as "Couldn't fix your Flow" | extension `background/activity/headline.ts`, new `headline.test.ts`, `pacer.test.ts` | yes | headline conflict(1) with t174 | **integrate** under the extension-UI owner |
| C1 rerun keeps numbers (w41) | Rerun renumbered steps, stale listing became step 7 | Core `R/llm/evidence-loop/{rerun-replacement,rerun-request}.ts`, `R/flow-draft/{entry,step,amendment}.ts`, `R/llm/draft-amendment-feedback.ts` + tests | yes | rerun-request conflict(2), entry conflict(2), amendment conflict(5), feedback conflict(3) with t262 (incl. t262 uncommitted WIP). Conflicts with t193 and t194 | **needs rework** in the serial Core authoring chain |
| C2 judge a short-stopped clean round (w42) | Clean changed Flow never judged; ended with $0.05 left | Core `unfinished-build/{phases,reserve-judging,judgement}.ts`, new `judge-stopped-round.test.ts` | yes | phases conflict(1) and reserve-judging conflict(2) with t262 `e8c89bbd` (calls-bound reserve) | **needs rework** onto t262 |
| C3 pass and row in step log (w43) | Test pass folder did not name its row | Core `R/llm/node-tools/replay-span.ts`, `R/llm/step-log/{scope,tool-step}.ts` + tests | yes | replay-span extra over t262 | **integrate** |
| C4 plain failed-build sentence (w44) | Ending line read as two fragments | Core `R/conversations/commands/create-here.ts` + tests | yes | conflict(1) with t193 | **needs rework**: same wording owner as B F4 |
| w45 `always` change; repeats revalidated on move | Stray repeat on the listing; repeat broken by reorder | Core `R/flow-draft/{amendment,routing,entry}.ts`, `R/llm/draft-amendment-feedback.ts`, `R/flow-bootstrap/evidence-loop-steps.ts`, `R/activity/wording/draft-edit-refused.ts` | yes | t262 `42434f42` added a competing `unrepeat` change for the same class of defect (B run mustzxhi). Both edit the same change list | **needs rework**: keep t262's `unrepeat`, port only the repeat revalidation (`routing.ts`) and shown-number semantics |
| w46 repeat guard on unchanged draft (report: Partial) | ~20 identical passing part runs | Core `R/llm/repeat-guard/{draft-key (new),outcomes,feedback,index}.ts`, `node-tools/run-flow-part.ts`, `R/llm/evidence-loop.ts` (at 800 lines) | yes | lane-only vs t262 except evidence-loop.ts extra. Conflicts with t194 w79 | **integrate** with rework (serial with w79; line budget) |
| w47 completion words; start-location note | `repeat_not_after_its_source` dropped to codes | Core `R/flow-bootstrap/authoring/{draft-routing,instruction-record-columns}.ts`, `R/llm/harness-options/{bootstrap-completion,draft-acts}.ts`, `R/llm/deepseek/request-body.ts` + tests | yes | bootstrap-completion and draft-acts extra over t262 (`80116d0e` declared arrival) | routing words: **integrate**. Start-location part: **needs rework** against t262 declared arrival and the route rule |
| w48 ending words (report: Partial) | Ending used internals | Core `unfinished-build/{not-done,not-finished}.ts` + tests | yes | conflicts with t193 F4 | **needs rework**: same wording owner |
| w49 + unreported w50 route kept when named | User rule: a named route must be followed | Core `R/action-permissions/{instructed,instruction-route (new),instruction-quote (new)}.ts`, `R/service/instruction-authority.ts`, `request-body.ts`, `entry.ts`, `rerun-request.ts`, `context-packet.ts`, `task-request.ts`, `loop-configuration.ts`, new `route-named-build.test.ts` | yes | 14 Core files carry "w50" source with no report (Codex `resume-cd.md` saw the same). t262 has its own D design (`d-grounded-waypoint-contract.md`, `d-shared-reader-preflight.md`) saying old URL scan / fail-open / blanket withholding must not be ported. Conflicts with t174 on instruction-authority | **needs rework** under t262's D waypoint design. Do not land w49/w50 as is |
| D docs/evidence | — | `docs/architecture/{build-loop,extension-client,testing-facility}.md`, Core `llm-flow-bootstrap.md`, 2 debugs, 11 reports | — | build-loop conflict(1) with t262 | evidence: commit. Docs: rewrite per unit |

## Cross-lane conflict list (serial integration points)

Pairwise three-way merges of lane worktrees (same base). Clean overlaps are omitted unless the file is a hub.

**Core: one owner at a time, in this order of risk**
- `R/flow-draft/amendment.ts`: t174, t193, t195 and t262 (committed and WIP). t193+t195 conflict(11), t174+t195 conflict(3). Highest risk.
- `R/llm/draft-amendment-feedback.ts` + test, `R/flow-draft/entry.ts` + tests: t174, t193, t195, and t262 committed and **uncommitted**. Pairwise conflicts 1-4.
- `R/llm/decision-handlers/amendment.ts`: all four lanes plus t262. t193+t194 conflict(4), t174+t193 conflict(3).
- `R/llm/evidence-loop.ts` (800-line budget): all four lanes plus t262. t174+t193 conflict(2).
- `R/activity/draft-edit.ts`, `R/activity/wording/draft-edit-refused.ts`: **deleted/moved by t193**, edited by t174, t194 and t195.
- `R/activity/tests/observer.test.ts` (t174+t193 conflict(6)), `wording/tests/reasons.test.ts`, `wording/reason-text.ts`.
- `R/flow-bootstrap/action-permissions.ts`: t174, t193, t262.
- `R/service/instruction-authority.ts` + test: t174+t195 conflict(4).
- `R/flow-bootstrap/unfinished-build/{phases,not-finished,not-done,contracts,reserve-judging}.ts`: t174, t193, t195, t262. not-finished t193+t195 conflict(5).
- `R/conversations/commands/create-here.ts` + execute test: t174, t193, t195.
- `R/llm/evidence-loop/rerun-request.ts` + test: t194, t195, t262.
- `R/llm/repeat-guard/{feedback,outcomes}.ts` + test: t194+t195.
- `R/result-verification/build-test/summary.ts` + test, `R/llm/diagnosis-instructions.ts`, `R/llm/deepseek/tests/system-prompt-pins.json`: t174, t193, t194.
- `R/result-verification/check-activity.ts` + test: t193+t194.
- `R/llm/step-log/answer-step.ts`: t174+t194.
- `R/flow-draft/act-claim.ts`, `verify-only.ts`, `R/llm/node-tools/dry-run-gate.ts`: t174+t193 conflict(1) each.
- `src/ui/activity-action/failure-reason.ts`: t174+t194.
- `R/flow-bootstrap/evidence-loop-steps.ts`: t193+t195.
- `R/service.ts`: t174, t194, t195 and t262. Pairwise clean, but conflict(1) against t262 for t174 and t195.

**Downstream**
- `apps/extension/src/background/activity/pacer.ts` + test: t174, t193, t194 (conflict(2) in each pair) and t195 (test).
- `apps/extension/src/panel/chat/conversation/composer.ts` + `composer-owner.test.ts`: t174, t193, t194 and t262. Three lanes implemented the same "clear on send".
- `apps/extension/src/panel/chat/conversation/controller.ts`: t174+t194 conflict(5), plus t262.
- `apps/extension/src/content/activity-overlay/{index,overlay}.ts` + test: t174+t193. t174 also deletes `status-dwell.ts`.
- `apps/extension/src/background/activity/headline.ts`: t174+t195.
- `domain/src/runtime/llm-evidence/node-run/run.ts`: t174 (= t262), t193 and t194. t193 conflict(1).
- `packages/test-runner/src/lab-runs/write-playback-steps.ts` + test, `run-scenario/ui-review/recorder.ts`: t174+t194.
- `docs/architecture/{build-loop,extension-client,testing-facility}.md`: t174, t193, t195, t262 and dev.

## Recommended integration order

1. **Land t262 on dev first** (separate brief `t262-audit`). It already holds A2, C w73/w74/w85, B's split-lasting-act fix and
   the repeat-removal design. Every lane unit below is then rebased onto dev, never onto `45bd6232`/`6beae684`. t262's
   uncommitted WIP in `entry.ts`, `draft-amendment-feedback.ts` and `bindable/*` must be committed or dropped first,
   because three lanes touch those files.
2. **Independent lane-only units**, one task branch each, in parallel by file:
   - A1 cost limit (Core);
   - A7 tabs and remembered waits (domain + extension; browser proof required);
   - A8 consent closer;
   - D1 row-scoped assert;
   - C w86 maxPages lift and C w75 missing key (domain);
   - D C3 pass row in step log;
   - B F11 draft signature.
3. **Instruction authority unit**: A4 per-act read, B F1 kind fallback and t262's split-act grounding, in one owner
   (`action-permissions.ts`, `instruction-authority.ts`, `instructed.ts`, `verify-only.ts`). This must land before any D
   route work touches `instructed.ts`.
4. **Activity/refusal wording chain**, strictly serial:
   1. B F6, which moves `draft-edit.ts` to `decision-answer/`;
   2. A5 (`told`, build trace, finishing verdict) re-applied into the moved files;
   3. C w80/w81/w84 and C w76 run ending.
5. **Judge/ending chain**, serial:
   1. A3a with B F2, merged by hand (summary/diagnosis/pins; keep B's screening, A's cap and the predates-test sentence);
   2. B F3 softened progress;
   3. D C2 reworked onto t262's reserve judging;
   4. one ending-wording owner for B F4/F10, D w48, D C4 and A's finishing verdict.
6. **Core authoring chain**, one owner, after step 1:
   1. B F5/F10 amendment answers;
   2. D C1 stable rerun numbers;
   3. D w45 revalidation on top of t262 `unrepeat` (drop `always`);
   4. D w47 routing words;
   5. C w79 with D w46 repeat guard (watch the `evidence-loop.ts` 800-line budget);
   6. C w78.
7. **Extension UI unit**, one owner: A9, B F7/F9, C w83/w76 pacer, D D2. Pick one clear-on-send implementation. Keep
   t174's removal of `status-dwell.ts` only if B's overlay-lag fix agrees.
8. **Lab records**: A10 and C w82 after their Core dependencies (A5 `buildJudged`, C `try`, which needs rework since t262
   dropped it).
9. **Rework or drop for planning**: D w49/w50 route (redo under t262's D waypoint design), A3b optional-only/choice-order
   (redo on dev's choice-order), C w72 (drop; t262 design).
10. **Docs last**: regenerate both `framework-reference.md` and rewrite architecture docs per landed unit. Commit lane debugs and
   reports as evidence with no source change.

Every unit needs its owning tests re-run on the integrated tree. The lead validations in the lane reports were run on the
old base and do not carry over.

## Commands run and observed results

- `GIT_OPTIONAL_LOCKS=0 git -C <tree> status --porcelain -uall`, `diff --numstat HEAD`, `diff --ignore-cr-at-eol --numstat HEAD`
  for all 10 trees: counts in the baseline table. No file differed only by line endings under `--ignore-cr-at-eol`, but
  `existing-fluxiq-control.ts` dropped from 795/789 to 7/1 changed lines.
- `git rev-parse`, `merge-base --is-ancestor HEAD dev`: every lane HEAD is on dev; both t262 heads are not.
- `git merge-base dev task/t262-mvp-live-continuation`: downstream `88c58d82` (1 commit behind dev), Core `f6ef9f48` (= dev).
- `git log --oneline dev..task/t262-mvp-live-continuation` (16 downstream, 14 Core commits) and `git show --stat` on the
  Core source commits `9f756676 97e279de 42434f42 80116d0e 5c893a98 115f67e9 e8c89bbd 0ecdec16` and downstream `326ad350`.
- Scratch script `merge3.sh`: for each lane file, `git show HEAD:` (base), `git show task/t262...:` (tip) and the worktree
  file, CR stripped, then `git merge-file` on scratch copies. Result counts by lane:
  - t174 ext: 11 identical, 7 extra, 3 conflict, 58 untouched by t262, 7 new.
  - t174 Core: 6 identical, 8 contained, 15 extra, 15 conflict, 46 untouched, 14 new.
  - t193 ext: 4 extra, 2 conflict. t193 Core: 15 extra, 10 conflict, 2 deleted.
  - t194 ext: 6 extra, 2 conflict. t194 Core: 7 extra, 14 conflict.
  - t195 ext: 2 extra, 1 conflict. t195 Core: 14 extra, 9 conflict.
- Scratch script `pairwise.sh`: `git merge-file` of every file shared by two lanes. Results are in the conflict list above.
- Targeted `diff` of lane versus t262 for `reversal.ts`, `claim-doubt.ts`, `kind-words.ts`, `judge-paging.ts`,
  `reauthor-build.ts` and `rerun-input.ts`, and `git diff dev task/t262...` for `draft-from-flow.ts`, `action-permissions.ts`,
  `summary.ts`, `judge.ts` and `reserve-judging.ts`. Findings are cited in the tables.
- `grep 0.25` on t262's `llm-execution-settings.ts`: the literal is still at line 33.
- Lab run directories `lab-runs/2026-10-03/run-*`: `run.json` instance labels and status only, for musuq910 (t174-slot-1,
  failed) and mustzxhi (t193-slot-2, failed).
- Heads of the lane lead reports, t194 w85/w86/w87, t195 w45-w49, and t262 `resume-ab.md`, `resume-cd.md`,
  `debug-a-run3.md`, `debug-b-run2.md`.

## Not verified

- No test, typecheck, build or structure audit was run on any merged combination. "Clean" means textually clean only. A
  clean merge can still be semantically wrong (for example, two clear-on-send implementations).
- Conflicts were measured against the t262 **committed** tip. t262's uncommitted WIP (Core `entry.ts`,
  `draft-amendment-feedback.ts`, `amendment.test.ts`, `entry.test.ts`, feedback test, `bindable/*`; downstream
  `carried-row-service-repair.test.ts`) was not merged in. It overlaps lane files in Core.
- I did not read every worker report. Groupings for t174/t193/t195 come from the lead reports. For C/D batch-2 work I used
  the report heads and Codex's `resume-cd.md`. The unreported t195 "w50" source was located by grep only and not reviewed.
- Whether A2's refinement in t262 (no pairing across a kept step) or C1 `paginate:true` is addressed in t262 source
  (`pagination-bound-feedback.md`) was not traced line by line.
- The t174 fixture `R/flow-bootstrap/instructed-acts/tests/run-musq0b1m-draft.ts` (42 lines, one URL, no token, cookie or
  authorization words) holds a recorded draft. Screen it for page data before committing. Not quoted here.

## Open questions or contradictions found

- The lane reports are stale. A run 3 and B run 2 ended `failed` (debugged only in t262). The t174 lead still says "in
  progress" and the t193 lead stops before run 2. So the A and B lane fix sets are not "prepared and pending live": they ran
  and failed.
- t195 w49 says route enforcement is "blocked", but `w50`-labelled enforcement source sits uncommitted in 14 Core files with
  no report. Someone wrote it after w49. Its owner and validation are unknown.
- There are competing designs, and the supervisor must pick one for each pair:
  - t262 `unrepeat` versus t195 `always`;
  - t262 scheduled-candidate versus t194 w72 ranWith seeding;
  - t262 source-grounded split acts versus t193 kind-based lasting acts.
  I recommend the t262 designs because they are newer and live-informed, while the lane designs are unproven.
- Codex's `resume-ab.md` recommended importing A4 (per-act read) as the first unit, but t262 never imported it.
  `instructed.ts` and `instruction-authority.ts` are unchanged at the t262 tip.
