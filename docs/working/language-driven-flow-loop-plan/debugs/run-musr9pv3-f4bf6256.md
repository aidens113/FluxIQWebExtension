# Run debug — `run-musr9pv3-f4bf6256`

t195 lane D, slot-4, live round 1003 run 2: social-network-feed `confirm-requests`, after batch 1 of
`reports/t195-lead-1003.md` (D1 row-scoped check, D2 headline, C1 rerun numbering, C2 stopped round judged, C3 pass
rows, C4 chat line). Debugged from `C:/Users/osrs_/FluxStuff/lab-runs/2026-10-03/run-musr9pv3-f4bf6256/` (`steps/`
0001-0221, `snapshots/flow-lane.json`, `snapshots/live-llm.json`) and the bundle's `run-musr9pv3-f4bf6256.ui-review.local/`
(26 moments). The supervisor's root-cause note of this run agrees with the causes below. `R` = Core
`packages/fluxiq/src/programs/automation-studio/runtime/`.

**What decided this run, in one line:** the build had the right loop by decision 0036 (listing kept >= 5, Confirm
pressed on Amara, repeated over the listing), then tried to make that same listing double as the final "accepted"
read by reordering it after the act; amendments renumbered mid-decision, a repeat landed on the listing over the
Confirm, no amendment could take it off, the completion refusal showed codes without words, and the model spent ~110
decisions-worth of turns on identical passing `core.run_flow` calls and unchanged `complete`s until round 0's 64-call
bound.

## Header

- Run id: `run-musr9pv3-f4bf6256`; no runtime run (no Flow proposed).
- Scenario / task: `social-network-feed` / `social-network-feed-confirm-requests` (expected-dataset, 4 records).
- Command: launcher `t195-live-run-d.sh 2` (as run 1). Headed. Live guard admitted (source changed).
- Date, provider, model: 2026-10-03 18:58:56-19:08:48Z, 474.9 s to the chat ending; DeepSeek `deepseek-flash`.
- Provider calls, cost (step logs): **75 calls, $0.086980**: chat $0.000140; read $0.000155; round 0 explore 64
  decisions $0.077260; round 1 repair 9 decisions $0.009425; judge none. `live-llm.json`: build 73 calls $0.086685,
  read 1, chat 1, judge null; total $0.086979594, ceiling $0.10 not over. No balance failure.
- Verdict: `failed`, **`performance.budget`**: "the run made 73 provider call(s) against an authorized 64"
  (`--llm-max-calls 64`), a Lab post-run check. Core's own ending: `lab.chat_build_failed`,
  `flow_bootstrap.build_not_finished` + `llm_evidence_loop.draft_amendments_refused`.
- **Stage reached: 3 inside the build** (a draft with the right loop and a stray repeat; never accepted, never
  judged); no Flow, no playback.

## Stage 1 — the instruction and the expected chain

Unchanged from `run-musp474o-e0ed7432` (written before either run was read): 4 records, Amara, Jonas, Lin, Freya; one
Confirm repeated over a listing kept >= 5; a separate read after the loop for "Request accepted" rows.

## Stage 2 — exploration and repairs

| # | Decided | Action | Core said | Cost |
| --- | --- | --- | --- | --- |
| 0002-0020 | start, consent, Friends, detects x5, requests (target covered, "Not now", requests again), detects | as run 1 | ok; one `target_covered` | ~$0.012 |
| 0022, 0024 | read `{name, mutualFriends}` (8 rows); close chat | ok | | $0.002405 |
| 0026, 0028 | add 2, 3, 7, 8, 12; drop 13; rerun 12 with `where matches "(?:[5-9]\|[1-9][0-9]+) mutual friends"` (+ bind with a whole extractList, repeat 12 over 12) | applied; listing 3 rows (Jonas out, M2 again) | | $0.002396 |
| 0033 | press Amara's Confirm `t765`, `modify_existing`, add, act a1 | ok: "Request accepted" | | $0.001450 |
| 0035 | **repeat 15 over 12** | applied: **the row-general loop** | | $0.001431 |
| 0037 | "add a read of the accepted requests after the confirm": repeat 15 over 12 + **reorder 12 (the loop's listing) to 15** | partly applied: the listing moved after the act | | $0.000960 |
| 0039-0043 | re-read; keep 15; complete | `already_in_flow`; completion refused | | $0.004167 |
| 0044-0065 | eleven amend_drafts mixing reorder and repeat in one decision ("the repeat must sit on the Confirm press over the filtered listing, and the listing must come before it") | `already_so`, `draft_amendment_undone`, `not_a_kept_step`, `no_such_step`; by 0058 the listing carried a stray repeat (C5/C6) | | ~$0.013 |
| 0066-0178 | `core.run_flow {"from":15,"to":16}` ~20 times ("I'll reorder ... then finish"), `complete` x9 | every part run passed identically (listing 3 rows, Amara `present`, Lin, Freya `verified`); every completion refused `flow_draft.repeat_not_after_its_source` at steps 15, 16, code and path only | | ~$0.045 |
| 0179-0182 | `complete` x4 | refused again; round 0 hit its 64-decision bound | | ~$0.004 |
| 0183-0192 | round 0 test (stopped short) | clean (Amara `present`, Lin, Freya `verified`) but the completion check refuses the Flow, so not judged (C2 correct) | — | — |
| 0193-0211 | round 1 repair: look, re-read; repeat/reorder amendments | `already_so`, `over_not_before`, `draft_amendment_undone` | | $0.009425 |
| 0212-0221 | round 1 test | clean; refused by the completion check; not judged; ending `not_finished` (repeated unchanged) | — | — |

- Repeats the loop believed were progress: `core.run_flow` on an unchanged draft and page (each "passed"), and
  `complete` of the same refused plan. The repeat guard never refused them (C7).
- Refusals that did not say enough: `flow_draft.repeat_not_after_its_source` reached the model as code and path only;
  `draft-routing.ts`'s own words were dropped on the way (`flow-bootstrap/plan/issue-feedback.ts` `AUTHORED_CODES`), and
  those words prescribed the wrong fix for a stray repeat ("move step 16 ahead of step 15"). No amendment could take a
  repeat off (`keep` does not, by design since run 36).
- The read-before-act note told it "the draft needs a read after step 15"; it moved the loop's own listing (R18).

## Stage 3 — the proposed Flow

None proposed. The draft at 0072: 1 navigate `~/`; 2 Decline cookies; 3 Friends; 7 Not now; 8 Friend requests; 13
receipt (`replacedBy: 15`, w41's line, read correctly by the model); 14 dropped listing; **15 listing `where matches
(?:[5-9]|[1-9][0-9]+) mutual friends`, `runs: repeats through step 15, over step 16` (stray)**; **16 Confirm (template
Amara's card, act a1), `runs: repeats through step 16, over step 15`** (correct). No read after the loop.
- The row-general Flow was authored again (16 over 15). Divergences: the stray repeat on 15 (could not express its
  removal; misread the renumbering); Jonas dropped (regex, M2); no post-loop read (it tried to reuse the listing);
  travel steps from `~/` instead of starting at `~/friends/requests/` (the user saw a long, roundabout Flow).

## Stage 4 — replay (the build's tests and part runs)

- **D1 verified live:** every Confirm pass on Amara's row (accepted at 0033) answers `core.replay.present` ("the
  step's target is gone from the page it acted on, which is how its effect already in place looks; it was not run",
  `found: missing`), e.g. 0068, 0190, 0219; Lin's and Freya's passes `verified`. Nothing was pressed: at the end only
  Amara shows "Request accepted" (26-failure-scenario).
- **C3 verified live:** pass folders carry `pass`/`of`/`row` (e.g. `0190-test-core.run_node/meta.json`).
- Provider calls during replay: zero.

## Stage 5 — the answer

NO EVIDENCE: no Flow proposed. Records expected 4, returned 0.

## Stage 6 — judgement and repair

- Judged: nothing. Both stopped rounds' tests ran clean but the completion check refuses their Flow (the stray
  repeat), so C2 correctly did not judge them (a yes could build nothing).
- Repair: round 1 started from the same draft and made no change Core accepted; ended `not_finished`.
- C1 verified live: the receipt line `step 13, replacedBy 15` was never amended or rerun by the model.

### UI review (26 moments; `pageLoads`/timing present)

- Overlay visible and readable at every build moment (16/16 samples), no flicker; D2 verified: the end reads "Build
  failed / Build stopped: the Flow is not finished yet" (26-failure-scenario).
- C4 verified: the chat's last line "The Flow "Go through my friend requests ..." keeps your instruction, so you can
  build it again." (26-failure-panel).
- U8 still open in this build: "too many of its decisions in a row could not be used, because the model kept asking for
  changes to the Flow that changed nothing", "the last repair made no measurable progress on the round before it: it
  handed back the same Flow; no more of the 1 thing you asked had a step (1, as before)", "over 73 decisions"
  (26-failure-panel). Fixed after the run by t195-w48.
- U1 (1002-M) still open: the per-row cards are identical "Click · Confirm"; they now differ only by result
  ("Already done" vs "Checked, not pressed"), not by whose row.

## Causes

| # | Cause, precisely | Repo and file | Fix | Owner |
| --- | --- | --- | --- | --- |
| C5 | **Step numbers move inside one amend_draft decision.** Core renumbers after each amendment, so a decision mixing reorder and repeat (0056-0064) put the repeat on the listing. | Core `R/flow-draft/amendment.ts` | Every number in a decision names the step as the shown draft numbered it; renumber once after. | t195-w45 |
| C6 | **Moves never revalidate repeats, and nothing removes one.** A reorder left the listing's repeat over the later Confirm; `keep` cannot clear a repeat. | Core `R/flow-draft/amendment.ts`, `R/llm/draft-amendment-feedback.ts`, `R/flow-draft/entry.ts` | Reorder/move revalidates and clears a repeat that can no longer run (`repeat_taken_off`, said at once); new change `always` takes any run condition off a step. | t195-w45 |
| C7 | **Identical no-change calls are never refused.** ~20 passing `core.run_flow {from:15,to:16}` on an unchanged draft and page, and unchanged refused `complete`s. `run-flow-part` counted the replayed read as applied and reported no page state, so the guard never saw "changed nothing". | Core `R/llm/repeat-guard/*`, `R/llm/node-tools/run-flow-part.ts`, `R/llm/evidence-loop.ts` | A repeat of the same call on the same draft and page is refused `same_draft` and counts toward the stall; a completion refused again over the same draft counts too. | t195-w46 |
| C8 | **The completion refusal drops its words.** `repeat_not_after_its_source` reached the model as code + path (`flow-bootstrap/plan/issue-feedback.ts` `AUTHORED_CODES` omits routing codes), and the words prescribed the wrong fix for a stray repeat. | Core `R/llm/harness-options/bootstrap-completion.ts`, `R/flow-bootstrap/authoring/draft-routing.ts` | Words carried; they say which step repeats over which, why, and the fix (`always`, or a reorder of the listing before the act). | t195-w47 |
| R18 | **The read-before-act note invites moving the loop's listing.** "the draft needs a read after step 15" -> the model reordered the listing after the act (0037). | Core `R/flow-bootstrap/authoring/instruction-record-columns.ts` | Run a new read after the act; the listing the act repeats over stays before it. | t195-w47 |
| C9 | **The Flow travels from `~/` instead of starting where the work begins** (user saw a roundabout Flow). | Core `R/llm/deepseek/request-body.ts` (`FLOW_START_LOCATION_NOTE`), `R/flow-draft/entry.ts` | Say the first step may go straight to the stable address where the work begins (rerun step 1, drop travel-only steps, keep optional dismissals) -- **unless the instruction says how to get there** (user rule, binding): then keep that route. | t195-w45/w47 (words); t195-w49 (route rule) |
| C10 | **The run's authorized calls do not bound a chat build.** A chat-created Flow declares no call count, so `remaining()` (`R/flow-bootstrap/unfinished-build/phases.ts`) gives each round the full `maxIterations` (64); the build made 73 and the Lab's post-run check failed the run `performance.budget` over Core's own ending. | Core `phases.ts` / Lab plan (contract) | Not changed in this lane: reported to the supervisor (either the build's call bound spans its rounds, or the Lab counts per round like Core). | supervisor |
| M2 | Regex `where` read "Aisha Khan and 4 other mutual friends" as 4 again. | — (model) | None: in run 1 the judge named it from the left-out row's tested value; here no test was judged. | — |
| U8 | Ending names internals (see UI review). | Core `unfinished-build/not-done.ts`, `not-finished.ts` | Plain sentences. | t195-w48 |

## Instrumentation gaps found

| Stage | What could not be answered | File that drops it |
| --- | --- | --- |
| 2 | Why the completion was refused, in words, from the model's own view: the request held code + path only. Answered from `draft-routing.ts` by reading the source. | Core `flow-bootstrap/plan/issue-feedback.ts` (C8) |
| — | The Lab's verdict (`performance.budget`) replaced Core's ending in `evaluation.json`; Core's ending survives only as issue codes in `flow-lane.json` `build.failure` and the chat text in the screenshot. | Lab evaluation (finding with C10) |
