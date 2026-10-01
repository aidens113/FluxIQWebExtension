# Run debug — `run-muq3uozx-3153564b`

Lane D live run 36, confirm-requests, the first chat-driven build (t227). Debug by t195-w21 from the run's
artifacts and dev code on the t195 trees (downstream `fa05aa7f`, Core `83a6cc3a`, both clean per `run.json`).
No Lab, browser or model call was made for this debug. `R` below is Core
`packages/fluxiq/src/programs/automation-studio/runtime/`.

## Header

- Run id: `run-muq3uozx-3153564b` (instance `t195-slot-4`, seed 5101).
- Scenario / variant / task: `social-network-feed` / none / `social-network-feed-confirm-requests` (workflow
  `confirm-requests`, judged by `expected-dataset`, step `extract-confirmed`). `buildEntry: chat`: the Lab typed the
  instruction into the extension's chat (side panel) and Core's `flow.createHere` built the Flow.
- Command: lane D's launcher `live-run-d.sh` (session 3 form in `reports/t195-live-control-flow.md`: `run-lab.mjs run
  social-network-feed --live-llm --llm-profile production --llm-provider deepseek --llm-model deepseek-flash
  --llm-task create-flow --instruction-task social-network-feed-confirm-requests --llm-max-calls 64
  --llm-max-cost-usd 0.25 --evidence events`, token limits 992000/8000/1000000). The Lab log's first line records
  only the reason: "first chat-driven run (t227) with F23-F34: does the loop build from the chat, the dry run pass and
  the judged read hold".
- Date, provider, model: 2026-10-01, run 22:27:51Z-22:34:37Z (build 22:30:40.7Z-22:33:59Z); deepseek,
  `deepseek-flash`, production profile, headed Chromium 134.
- Provider calls, tokens, cost (from the decision dumps' `usage`): 61 calls (51 exploration + 10 repair); 1,738,095
  input tokens, of which 1,073,280 cache hits (61.8%); 8,145 output tokens; $0.2157. The Lab recorded 1 call and $0
  for the same run (instrumentation gap G1).
- Verdict as reported: failed, `lab.chat_build_failed` / `flow_lane.flow_not_built`: "1 of the 1 things you asked
  could not be done: confirm everyone ...: the step I tried for it changed nothing. The Flow as far as it got (11
  steps) ran from its start without failing. I tried 2 times live -- exploring, then one repair after testing what I
  had -- over 61 decisions".
- **Stage reached: 2 (exploration).** No completion was ever accepted (17 refused in exploration, 7 in the repair),
  so there was no proposal (3), no judged replay (4) and no answer (5). Core's unfinished-build lifecycle then tested
  the unfinished draft from its start and ran one repair round (6), which also never completed.

## Stage 1 — the instruction and the expected chain

Copied from `reports/t195-live-control-flow.md`, "Stage 1, confirm-requests (written before run 34)".

- The instruction, verbatim: "Go through my friend requests and confirm everyone I have at least five mutual friends
  with, and leave every other request as it is. Then give me a table of every request the list now shows as
  accepted, in the order the list shows them, with columns name and mutualFriends, where mutualFriends is written
  exactly as their request shows it." (The lane report's summary: confirm every friend request with at least five
  mutual friends, leave the rest, then table every request the list shows as accepted, in list order, `name` and
  `mutualFriends` as written.)
- Seed (`content/requests.ts`): Tom Becker 1, Amara Osei 23, Priya Nair 4, Jonas Weber "Aisha Khan and 4 other mutual
  friends" (5), Diego Alvarez (no line, 0), Lin Zhao 11, Freya Holm 5, Marta Kowalczyk 3. Expected dataset: Amara Osei
  / "23 mutual friends", Jonas Weber / "Aisha Khan and 4 other mutual friends", Lin Zhao / "11 mutual friends", Freya
  Holm / "5 mutual friends".
- The node chain a correct Flow must have:
  1. open Friends, then "See all" to `friends/requests/` (the Friends home shows only 4);
  2. a list read of the request cards with name and mutual line, `where` mutual >= 5 (F8 reads "X and 4 other" as 5);
  3. a For Each over the kept rows whose body presses that row's Confirm; the fourth confirm meets "You're going too
     fast" and is pressed again after the countdown (F7);
  4. a list read of the accepted cards (`name`, `mutualFriends`).
- What a wrong answer that looks right would look like here: Tom Becker or Priya Nair confirmed (an act before the
  filter), Jonas Weber dropped (his line has no leading number), or Freya Holm missing (the rate limit swallowed her
  confirm).

## Stage 2 — exploration

One row per model turn, in order, generated from the two decision dumps
(`test-runs/instances/t195-slot-4/decision-dumps/build-2026-10-01T22-30-40-711Z-38848.jsonl`, rows E1-E51, and
`build-2026-10-01T22-33-40-984Z-38848.jsonl`, rows R1-R10). "What it was asked" lists what was new in the window
against the decision before (the acts checklist as the draft entry showed it, refusals, the no-progress note, and the
budget when 3 or fewer decisions were left); the page view and the draft were in every window. Handles: t566 Tom
Becker's Confirm, t578 Amara Osei's, t590 Priya Nair's, t602 Jonas Weber's (page view of `rerun.11.2`). The
model's stated reason for each decision is not in the dumps (gap G2); where a screenshot shows it, it is quoted below
the table.

| # | What it was asked | What it decided | Action and parameters | Result |
| --- | --- | --- | --- | --- |
| E1 | checklist a1 no_step_added | tool_call | `nav.start` browser-navigate /scenarios/social-network-feed/ add | succeeded |
| E2 | checklist a1 no_step_added | tool_call | `dismiss.cookies` dom-click t477 (cookie banner) add | succeeded |
| E3 | checklist a1 no_step_added | tool_call | `nav.friends` browser-navigate /friends/ | rejected.address_not_shown address_not_shown |
| E4 | checklist a1 no_step_added | tool_call | `dismiss.notif` dom-click t481 (notifications dismiss) add | succeeded |
| E5 | checklist a1 no_step_added | tool_call | `nav.friends.link` dom-click t12 (Friends nav link) add | succeeded |
| E6 | checklist a1 no_step_added | tool_call | `close.chat` dom-click t682 (chat close) | succeeded |
| E7 | checklist a1 no_step_added | tool_call | `detect.requests` detect_repeating_structure around t557 | web.structure.detected |
| E8 | checklist a1 no_step_added | tool_call | `extract.requests` extract_list(name,mutual; no where) | inspect.succeeded; 4 row(s): Tom Becker, Amara Osei, Priya Nair, Jonas Weber |
| E9 | checklist a1 no_step_added | amend_draft | 2 add; 3 optional; 5 optional; 6 add; 9 add; 9 rerun extract_list(name,mutual; where matches /(?:[5-9]|[1-9][0-9]+) mutual/) | inspect.succeeded; 1 row(s): Amara Osei |
| E10 | amendments refused 2:already_in_flow,6:already_in_flow; checklist a1 no_step_added | amend_draft | 9 rerun extract_list(name,mutual; no where); 10 drop | inspect.succeeded; 1 row(s): Amara Osei |
| E11 | amendments refused 10:already_out; checklist a1 no_step_added | amend_draft | 9 rerun extract_list(name,mutual; where matches /(?:[5-9]|[1-9][0-9]+) mutual/); 9 repeat over 9 through 10; 10 add act a1 | inspect.succeeded; 1 row(s): Amara Osei |
| E12 | amendments refused 9:over_not_before; checklist a1 step_changed_nothing @11 | amend_draft | 11 rerun extract_list(name,mutual; where matches /(?:[5-9]|[1-9][0-9]+) mutual/) | inspect.succeeded; 1 row(s): Amara Osei |
| E13 | checklist a1 step_changed_nothing @11 | amend_draft | 11 keep act a1; 11 repeat over 11 through 11 | answered in the next row's first column |
| E14 | amendments refused 11:already_in_flow,11:over_not_before | amend_draft | 11 rerun extract_list(name,mutual; where matches /(?:[5-9]|[1-9][0-9]+) mutual/) | inspect.succeeded; 1 row(s): Amara Osei |
| E15 | checklist a1 step_changed_nothing @11 | tool_call | `confirm.amara` dom-click t578 (Amara) [modify_existing] add act a1 | succeeded |
| E16 | checklist a1 step_changed_nothing @11 | tool_call | `confirm.priya` dom-click t590 (Priya) [modify_existing] add act a1 | succeeded |
| E17 | checklist a1 step_changed_nothing @11 | tool_call | `confirm.jonas` dom-click t602 (Jonas) [modify_existing] add act a1 | succeeded |
| E18 | checklist a1 step_changed_nothing @11 | amend_draft | 11 repeat over 11 through 17 | answered in the next row's first column |
| E19 | amendments refused 11:over_not_before(repeated) | amend_draft | 11 rerun extract_list(name,mutual; where matches /(?:[5-9]|[1-9][0-9]+) mutual/); 15 repeat over 11 through 15 | inspect.succeeded; 1 row(s): Amara Osei |
| E20 | checklist a1 done 16 | complete | complete, acts none | refused bootstrap.instructed_act_missing a1 step_changed_nothing step 11 |
| E21 | refusal a1 step_changed_nothing step 11 | amend_draft | 16 keep act a1 | answered in the next row's first column |
| E22 | checklist a1 step_changed_nothing @11 | amend_draft | 16 repeat over 11 through 18 | answered in the next row's first column |
| E23 | checklist a1 done 16 | complete | complete, acts none | refused bootstrap.instructed_act_missing a1 step_changed_nothing step 11 |
| E24 | refusal a1 step_changed_nothing step 11 | amend_draft | 11 rerun extract_list(name,mutual; where matches /(?:[5-9]|[1-9][0-9]+) mutual/) | inspect.succeeded; 1 row(s): Amara Osei |
| E25 | checklist a1 done 17 | complete | complete, acts none | refused bootstrap.instructed_act_missing a1 step_changed_nothing step 11 |
| E26 | refusal a1 step_changed_nothing step 11 | amend_draft | 17 keep act a1 | answered in the next row's first column |
| E27 | checklist a1 step_changed_nothing @11 | amend_draft | 11 rerun extract_list(name,mutual; where matches /(?:[5-9]|[1-9][0-9]+) mutual/) | inspect.succeeded; 1 row(s): Amara Osei |
| E28 | checklist a1 step_changed_nothing @11 | complete | complete, acts ["a1>18"] | refused bootstrap.instructed_act_missing a1 step_changed_nothing step 11 |
| E29 | refusal a1 step_changed_nothing step 11 | amend_draft | 18 add act a1; 19 add act a1; 20 add act a1 | answered in the next row's first column |
| E30 | amendments refused 18:already_in_flow,19:already_in_flow,20:already_in_flow | amend_draft | 11 rerun extract_list(name,mutual; where matches /(?:[5-9]|[1-9][0-9]+) mutual/ & not contains "Request accepted") | inspect.succeeded; 1 row(s): Amara Osei |
| E31 | checklist a1 step_changed_nothing @11 | amend_draft | 11 rerun extract_list(name,mutual; where matches /(?:[5-9]|[1-9][0-9]+) mutual/) | rejected.invalid_input unexpected_input_keys |
| E32 | checklist a1 step_changed_nothing @11 | tool_call | `rerun.11.8` extract_list(name,mutual; where contains "Request accepted") | inspect.succeeded; 4 row(s): Tom Becker, Amara Osei, Priya Nair, Jonas Weber (where kept none, returned unfiltered) |
| E33 | checklist a1 step_changed_nothing @11 | complete | complete, acts ["a1>19","a1>20","a1>21"] | refused bootstrap.instructed_act_missing a1 step_changed_nothing step 11 |
| E34 | refusal a1 step_changed_nothing step 11 | tool_call | `rerun.11.9` extract_list(name,mutual; where matches /(?:[5-9]|[1-9][0-9]+) mutual/ & not contains "Request accepted") | inspect.succeeded; 1 row(s): Amara Osei |
| E35 | looked_again_unchanged; checklist a1 step_changed_nothing @11 | complete | complete, acts ["a1>19"] | refused bootstrap.instructed_act_missing a1 step_changed_nothing step 11 |
| E36 | refusal a1 step_changed_nothing step 11; no_progress 3/8 | tool_call | `confirm.tom` dom-click t566 (Tom) [modify_existing] add act a1 | succeeded |
| E37 | checklist a1 step_changed_nothing @11 | tool_call | `final.extract` extract_list(name,mutual; where contains "Request accepted") | inspect.succeeded; 4 row(s): Tom Becker, Amara Osei, Priya Nair, Jonas Weber (where kept none, returned unfiltered) |
| E38 | checklist a1 step_changed_nothing @11 | tool_call | `rerun.11.10` extract_list(name,mutual; where matches /(?:[5-9]|[1-9][0-9]+) mutual/) add act a1 | inspect.succeeded; 1 row(s): Amara Osei |
| E39 | checklist a1 step_changed_nothing @11 | tool_call | `confirm.tom.2` dom-click t566 (Tom) [modify_existing] add act a1 | rejected.target_unobserved handle_not_in_packet |
| E40 | checklist a1 step_changed_nothing @11 | complete | complete, acts ["a1>25"] | refused bootstrap.instructed_act_missing a1 step_changed_nothing step 11 |
| E41 | refusal a1 step_changed_nothing step 11 | complete | complete, acts ["a1>25"] | refused bootstrap.instructed_act_missing a1 step_changed_nothing step 11 |
| E42 | refusal a1 step_changed_nothing step 11; budget decisionsLeft 3 | complete | complete, acts ["a1>25"] | refused bootstrap.instructed_act_missing a1 step_changed_nothing step 11 |
| E43 | refusal a1 step_changed_nothing step 11; no_progress 3/8 | tool_call | `final.accepted` extract_list(name,mutual; where contains "Request accepted") | inspect.succeeded; 4 row(s): Tom Becker, Amara Osei, Priya Nair, Jonas Weber (where kept none, returned unfiltered) |
| E44 | checklist a1 step_changed_nothing @11; budget decisionsLeft 3 | complete | complete, acts ["a1>25"] | refused bootstrap.instructed_act_missing a1 step_changed_nothing step 11 |
| E45 | refusal a1 step_changed_nothing step 11; budget decisionsLeft 3 | complete | complete, acts ["a1>27"] | refused bootstrap.instructed_act_missing a1 step_changed_nothing step 11 |
| E46 | refusal a1 step_changed_nothing step 11; budget decisionsLeft 3 | complete | complete, acts ["a1>25"] | refused bootstrap.instructed_act_missing a1 step_changed_nothing step 11 |
| E47 | refusal a1 step_changed_nothing step 11; no_progress 3/8; budget decisionsLeft 3 | complete | complete, acts ["a1>25"] | refused bootstrap.instructed_act_missing a1 step_changed_nothing step 11 |
| E48 | refusal a1 step_changed_nothing step 11; no_progress 4/8; budget decisionsLeft 3 | complete | complete, acts ["a1>25"] | refused bootstrap.instructed_act_missing a1 step_changed_nothing step 11 |
| E49 | refusal a1 step_changed_nothing step 11; no_progress 5/8; budget decisionsLeft 2 | complete | complete, acts ["a1>25"] | refused bootstrap.instructed_act_missing a1 step_changed_nothing step 11 |
| E50 | refusal a1 step_changed_nothing step 11; no_progress 6/8; budget decisionsLeft 2 | complete | complete, acts ["a1>25"] | refused bootstrap.instructed_act_missing a1 step_changed_nothing step 11 |
| E51 | refusal a1 step_changed_nothing step 11; no_progress 7/8; budget decisionsLeft 2 | complete | complete, acts ["a1>25"] | refused bootstrap.instructed_act_missing a1 step_changed_nothing step 11 |
| R1 | repair entry: stopped unusable_decisions, test replayed_clean, actsDone 0; checklist a1 step_changed_nothing @6 | tool_call | `look.friends.1` find_on_page "mutual" | inspect.succeeded |
| R2 | checklist a1 step_changed_nothing @6; budget decisionsLeft 2 | amend_draft | 7 add to 7 act a1 | answered in the next row's first column |
| R3 | amendments refused 7:already_in_flow; budget decisionsLeft 2 | complete | complete, acts ["a1>7"] | refused bootstrap.instructed_act_missing a1 step_changed_nothing step 6 |
| R4 | refusal a1 step_changed_nothing step 6; budget decisionsLeft 2 | complete | complete, acts ["a1>7"] | refused bootstrap.instructed_act_missing a1 step_changed_nothing step 6 |
| R5 | refusal a1 step_changed_nothing step 6; budget decisionsLeft 2 | complete | complete, acts ["a1>7"] | refused bootstrap.instructed_act_missing a1 step_changed_nothing step 6 |
| R6 | refusal a1 step_changed_nothing step 6; no_progress 3/8; budget decisionsLeft 2 | complete | complete, acts ["a1>6"] | refused bootstrap.instructed_act_missing a1 step_changed_nothing step 6 |
| R7 | refusal a1 step_changed_nothing step 6; no_progress 4/8; budget decisionsLeft 2 | complete | complete, acts ["a1>6"] | refused bootstrap.instructed_act_missing a1 step_changed_nothing step 6 |
| R8 | refusal a1 step_changed_nothing step 6; no_progress 5/8; budget decisionsLeft 2 | complete | complete, acts ["a1>7"] | refused bootstrap.instructed_act_missing a1 step_changed_nothing step 6 |
| R9 | refusal a1 step_changed_nothing step 6; no_progress 6/8; budget decisionsLeft 2 | amend_draft | 7 keep act a1 | answered in the next row's first column |
| R10 | no_progress 7/8; amendments refused 7:already_in_flow(repeated); budget decisionsLeft 1 | complete | complete, acts ["a1>7"] | refused bootstrap.instructed_act_missing a1 step_changed_nothing step 6 |

The instruction text above is checked against the run: 339 characters, sha256 `6c11d20a...`, as `flow-lane.json` records.

Reasons the chat showed (the dumps do not hold them): E15 "I will confirm Amara Osei's friend request, the only
request with at least five mutual friends, then extract the accepted list" (`00007-1a7b55e809e9.jpg`); E17 "Confirm
Jonas Weber, the last request with at least five mutual friends, then finish the Flow with the accepted-requests
table"; E18 "The three qualifying requests are confirmed; I now add the repeat over the filtered request list"
(`00008-7bed1713a730.jpg`). The reason for E16 (Priya Nair, 4 mutual friends) scrolled out of every screenshot.

- **Repeats, and what the loop believed was progress.**
  - The listing was read 12 times: E8, then reruns at E9, E10, E11, E12, E14, E19, E24, E27, E30 and E31 (refused
    `invalid_input`). Two more listing calls with `add` ran at E34 and E38. Every rerun from E9 returned the same one
    row, Amara Osei.
  - The loop counted each rerun as progress. A rerun takes the replaced step's place as a new step object
    (`R/llm/evidence-loop/rerun-replacement.ts:41-61`). `R/llm/evidence-progress/authored-progress.ts:38-42` counts
    any step object it has not seen in the Flow as "a step in the Flow for the first time". So `addedToFlow` was
    true and `noProgress.cleared()` ran (`R/llm/evidence-loop.ts:701,728-730`).
  - `cleared()` also empties the set of refusals already seen (`R/llm/evidence-progress/no-progress.ts:141-146`). The
    next refused completion therefore restarted the count at 1 (`R/llm/evidence-loop.ts:310-312`).
  - Result: the guard first said anything at E36, after 6 refused completions. It ended exploration at E51, the 17th.
  - 17 completions were refused with the same reason on the same step: E20, 23, 25, 28, 33, 35, 40, 41, 42, 44-51.
- **Rejections and refusals received, and whether each said enough to route around.**
  - Every completion was refused `bootstrap.instructed_act_missing` with `a1 reason: step_changed_nothing, step: "11"`.
    The refusal did not say why step 11 was the step judged. Step 11 was named for a1 because of the model's own E11
    amendment `10 add act a1`, which landed on a dropped listing rerun. The draft entry never shows which act a step
    names (`R/flow-draft/entry.ts:81-111`), so the model could not see that step 11 held the claim.
  - The model's own claims were discarded without a word. It claimed a1 for steps 18, 19-21, 25 and 27 in the
    completion result. `R/flow-bootstrap/instructed-acts/check.ts:155-157` drops every result claim for an act that
    any draft step already names.
  - The refusal's `stepsThatChangedSomething` lists draft ids (`d15`, `d16`, `d17`, `d25`;
    `R/flow-bootstrap/instructed-acts/check.ts:227`). The draft entry shows positions only, so those ids map to
    nothing the model can read.
  - The refusal's instruction says "if a step in your Flow already does it, say so with amend_draft add on that step"
    (`R/flow-bootstrap/instructed-acts/check.ts:98`). The model did exactly that at E29 (`18/19/20 add act a1`), R2 and
    R9. Each was refused `already_in_flow`: "there is nothing to confirm: do not keep it again"
    (`R/flow-draft/amendment.ts:217,220-224`). Those steps already named a1, so the amendment changed nothing.
  - The acts checklist contradicted the refusal three times. It showed `a1 done 16` at E20 and E23 and `done 17` at
    E25, and each of those completions was refused.
  - Neither message offered a way out. Dropping step 11 would have worked, because step 9 was an identical listing,
    but neither said so.
  - Amendment refusals: `over_not_before` at E12, E14 and E19. The model put `repeat` on the listing itself; the
    refusal's wording was enough, and the model moved the repeat to the press at E19.
  - `already_in_flow` and `already_out` (E10, E11): harmless.
  - E31 `rerun` refused `unexpected_input_keys`: the model put `extractList` beside `parameters` instead of under it.
    The chat card said only "Didn't work: the step wasn't accepted".
  - E39 `target_unobserved` (`handle_not_in_packet`): Tom's Confirm was gone after E36 accepted him.
- **Where the context was evicted or truncated, if anywhere:** nowhere. Every page view says `truncated: false`, and
  the draft entry is never cut (`R/flow-draft/entry.ts:21-26`). The input grew from 16.8k to 37.1k tokens per call.
  The budget entry did cut the work short:
  - At E42 and from E44 it told the model that 3 or fewer decisions were left, so tools were withdrawn (wrap-up) while $0.0906
    of $0.25 remained. At the observed mean of $0.0038 per call, that was about 24 calls.
  - The repair ran 9 of its 10 decisions (R2-R10) in wrap-up, with $0.0514 left at R2 (cause 10).

## Stage 3 — the proposed Flow

No Flow was proposed. The draft as it stood at the last exploration decision (E51), in the Flow (`inResult: true`):

| Step | Node | Parameters | Routing | Act named |
| --- | --- | --- | --- | --- |
| 2 | `browser-navigate` | `~/` (social-network-feed start) | - | - |
| 3 | `dom-click` t477 | cookie banner | optional | - |
| 5 | `dom-click` t481 | notifications dialog | optional | - |
| 6 | `dom-click` t12 | Friends nav link | - | - |
| 9 | `dom-extract_list` | `extraction.1`, `name`, `mutual`, where `mutual matches /(?:[5-9]\|[1-9][0-9]+) mutual/` | - | - |
| 11 | `dom-extract_list` | same, plus `not contains "Request accepted"` on the mutual column | - | **a1** (from E11) |
| 19 | `dom-click` t578 | Amara Osei's Confirm, `modify_existing` | none: the repeat put on it at E22 was cleared by `17 keep act a1` at E26 | a1 |
| 20 | `dom-click` t590 | Priya Nair's Confirm, `modify_existing` | - | a1 |
| 21 | `dom-click` t602 | Jonas Weber's Confirm, `modify_existing` | - | a1 |
| 25 | `dom-click` t566 | Tom Becker's Confirm, `modify_existing` | - | a1 |
| 27 | `dom-extract_list` | `name`, `mutual`, where `mutual matches /(?:[5-9]\|[1-9][0-9]+) mutual/` | - | a1 (E38 `add` + `act` on a read) |

The repair's draft (`core.flow_draft` at R1) is the same 11 steps renumbered 1-11, plus the initial look as step 12.
The doubled listing is steps 5 and 6, with a1 named on step 6; the four Confirms are 7-10 and the final read is 11.

- Divergences from the stage 1 chain:
  - (1) The list read is on the Friends home (`~/friends/`, 4 cards); "See all" (t554, same href as Friend requests
    t542) was never pressed, so Diego Alvarez, Lin Zhao, Freya Holm and Marta Kowalczyk were never seen.
  - (2) The `where` is a regex, `matches /(?:[5-9]|[1-9][0-9]+) mutual/`, not `atLeast: 5`, so Jonas Weber ("Aisha Khan
    and 4 other mutual friends") is dropped. F8's N+1 reading applies only to the numeric bounds.
  - (3) There is no For Each: four single Confirm presses pinned to handles, two of them on non-qualifying requests
    (Priya Nair 4, Tom Becker 1), and no `repeat` in the final draft.
  - (4) The final read is the regex-filtered list (Amara only), not "every request the list now shows as accepted";
    the accepted reads the model tried (E32, E37, E43) put `contains "Request accepted"` on the mutual-friends column,
    so `where` kept none and the rows came back unfiltered.
  - (5) Two identical listing steps (9 and 11) are both in the Flow.
- For each divergence:
  - (1) misread the page. The page view showed "See all" beside the heading, but detection said `pagination: "none"`
    and `itemCount: 4`, and nothing told it the list was partial.
  - (2) misread the grammar. `atLeast` was offered (`domain/src/runtime/llm-evidence/tools.ts:337`). The extraction
    result listed Jonas Weber in `rejectedRows.rowsAlone` with the note that such a row means the condition is wrong
    (`domain/src/runtime/llm-evidence/node-run/rejected-rows.ts:49`), and the model did not change it.
  - (3) could express it, and did at E19-E22 (`16 repeat over 11 through 18`, checklist `done 16`). It lost the loop
    to its own `keep` (E21, E26), which clears routing (`R/flow-draft/amendment.ts:216`). The extra presses are
    model choices that the authored-draft telling does not forbid (cause 9).
  - (4) misread the page: the status words are in another detected column (likely, not verified).
  - (5) misread the grammar: rerun and add semantics.

## Stage 4 — replay

There was no judged replay; the Lab's playback runs only on a created Flow. Core's unfinished-build lifecycle tested
the draft from its start between exploration's end (22:33:08.9Z) and the repair's loop start (22:33:40.98Z), 32 s with
zero provider calls. Per-step answers are known only from the words the repair's draft carries:

| Node | Executed | Produced | Duration | Retries | Rung that absorbed |
| --- | --- | --- | --- | --- | --- |
| 1 navigate to start | replayed | page | NO EVIDENCE | NO EVIDENCE | - |
| 2 cookie click (optional) | remembered | nothing (site remembers consent) | NO EVIDENCE | - | w20b `remembered` |
| 3 notifications click (optional) | remembered | nothing | NO EVIDENCE | - | w20b `remembered` |
| 4 Friends link | replayed | `~/friends/` | NO EVIDENCE | - | - |
| 5 listing (regex where) | replayed | NO EVIDENCE (row count not kept) | NO EVIDENCE | - | - |
| 6 listing (regex, not accepted; a1) | replayed | NO EVIDENCE; all four rows were then accepted, so presumably 0 rows (minItems 0) | NO EVIDENCE | - | - |
| 7-10 Confirm t578, t590, t602, t566 | verified (not pressed) | "could run now": target on the page, visible, enabled (`domain/src/runtime/llm-evidence/node-run/verify.ts:26`) | NO EVIDENCE | - | verify-only (D1) |
| 11 listing (regex) | replayed | NO EVIDENCE | NO EVIDENCE | - | - |

- Any node that reported success while doing nothing:
  - Steps 7-10 are suspect. `verified` means the resolved target was present, visible and enabled. But the repair's
    first look (R1 `find_on_page "mutual"`, right after the test) shows all four requests on the Friends home as
    "Request accepted", with no Confirm left. The right answer was `present`.
  - Which element each of the four resolved to is not recorded anywhere (gap G3). If resolution re-anchored to
    another control, playback would press that control.
  - Separately, the judgement `replayed_clean` with `actsDone: 0` was reported to the person as "ran from its start
    without failing", which reads as success.
- Provider calls during replay (expected: zero): zero (no decision between 22:33:08.9Z and 22:33:40.98Z in either
  dump or in `core.log`).

## Stage 5 — the answer

- Records expected vs returned: 4 expected (Amara Osei, Jonas Weber, Lin Zhao, Freya Holm); none returned. No Flow
  was created, so the Lab never played one back (`evaluation.json`: `flowCreated: false`, `extraction: null`).
- Fields compared, matched, mismatched: none compared.
- Every mismatch, observed value beside expected: not applicable. The page state the build left is worse than no
  answer: on the Friends home, Tom Becker (1 mutual friend) and Priya Nair (4) were confirmed beside Amara Osei and
  Jonas Weber (`00019-cc894575b271.jpg`, R1 `find_on_page`). Lin Zhao and Freya Holm, who should have been confirmed,
  were never seen.
- If the comparison was count-only, say so: no comparison ran.

## Stage 6 — judgement and repair

- Did the system judge its own result, and what did it conclude:
  - Yes. After exploration stopped (`stopped: "unusable_decisions"`: the no-progress guard reached 8 on the 17th
    refused completion), Core tested the unfinished draft and judged it `test: "replayed_clean"`, `stepsInFlow: 11`,
    `actsDone: 0`, `actsTodo: ["a1"]`, `lastRefusedFor: ["bootstrap.instructed_act_missing"]` (repair entry
    `core.resumed`).
  - It concluded that the act was not done. It did not know that four lasting Confirms had already been pressed on
    the person's page, two of them on the wrong people.
- If the answer was wrong, did a repair trigger automatically: yes, one repair round (revision 1), 10 decisions.
- What context did the repair receive:
  - present: the draft with every prior step and its parameters, routing and `replayed` word; the acts checklist
    (`a1 todo step_changed_nothing @6`); the judgement; the page (R1 looked first); the decision history; the budget.
  - absent: the conversation; the 17 exploration refusals (only `lastRefusedFor` was carried); which act each step
    names; the page as it was when exploration stopped (the test moved it).
  - the failure record was carried only as issue codes.
- Was the repair persisted, and did the re-run use it:
  - No repair was produced. All 7 repair completions were refused for a1 on step 6, which was the same listing,
    carrying the same claim from E11.
  - From R2 the budget entry put the repair in wrap-up (`decisionsLeft 2` with `costLeftUsd 0.0514`), so no tool was
    offered: the repair could only amend or complete, although its own instruction said "Work live on what is
    failing".
  - The repair ended at R10 (`decisionsLeft 1`, no-progress 7/8 before the last refusal), and the build ended
    `lab.chat_build_failed`.

## Answers to the brief

**1. The step at position 11 (exploration) and 6 (repair).**
- **What the step is.**
  - Both are the same draft step: the request listing `web.output.dom-extract_list`, `extractList.handle:
    "extraction.1"`, fields `name` and `mutual`, `minItems: 0`, `timeoutMs: 10000`.
  - Its `where` was `mutual matches /(?:[5-9]|[1-9][0-9]+) mutual/` until E30. From E30 it also had `not contains
    "Request accepted"`.
  - It is `kept`, with no routing. It was the `over` step of the repeat on Amara's Confirm while that repeat existed
    (E19-E21, E22-E26).
  - Each run produced one row, Amara Osei / "23 mutual friends", with Tom Becker, Priya Nair and Jonas Weber in
    `rejectedRows.rowsAlone`. In the repair it is step 6 because the looks, the failed navigation and the withdrawn
    reruns are no longer listed.
- **How it came to name a1.** At E11 the model sent `9 rerun (with where)`, `9 repeat over 9 through 10` and `10 add
  act a1`.
  - `10 add act a1` was applied first, as a "now" amendment (`R/llm/evidence-loop/held-amendments.ts:51-53`). Step 10
    was then `rerun.9`, a listing the E10 rerun had just withdrawn. The amendment made it `kept` with `acts: ["a1"]`
    (`R/flow-draft/amendment.ts:209,217,229`). Nothing refuses an act on a read: only looks are refused
    (`R/flow-draft/amendment.ts:194-197`).
  - The rerun of step 9 was then placed before its old step (`R/llm/evidence-loop/rerun-replacement.ts:59-61`), which
    pushed the act-carrying listing to position 11.
  - From then on, every rerun of step 11 handed its acts on (`R/llm/evidence-loop/rerun-replacement.ts:47-50`). The
    checklist first showed `a1 step_changed_nothing @11` at E12.
  - E38 added a second read naming a1 (a fresh `extract_list` call with `add` and `act`;
    `R/llm/evidence-loop.ts:208-210`).
- **Why the check calls it `step_changed_nothing`, and why on step 11.**
  - `whyNot` returns `step_changed_nothing` for any step whose `effect !== "mutate"`
    (`R/flow-bootstrap/instructed-acts/check.ts:289-291`). That is true of a list read.
  - The check takes the draft's own claims before the model's (`R/flow-bootstrap/instructed-acts/check.ts:155-157`).
    Those claims come in draft order (`:271-273`), and `assign` gives each act the first claim that names it
    (`:327-335`). Step 11 is the earliest kept step naming a1, so it was the one judged every time.
  - The kept Confirm steps that also named a1 (16-21, 25) were never considered. Nor were the model's result claims
    (`a1>18`, `a1>19/20/21`, `a1>25`, `a1>27`; R `a1>7`, `a1>6`): line 157 drops a result claim for any act a draft
    step already names.
  - `stepsThatChangedSomething` is computed from kept, mutating, proposable steps (`:200,227`). It lists ids
    (`d2,d3,d5,d6,d15,d16,d17`, plus `d25` after E36) that the model never sees.
- **Was the check right?**
  - Right about step 11 itself: a list read confirms nobody.
  - Wrong as a verdict on the draft at E20, E23 and E25. There, Amara's Confirm (step 16, then 17) named a1 and
    carried `repeat over 11 through 18/19`. The acts checklist, which tries every naming step
    (`R/flow-bootstrap/instructed-acts/checklist.ts:104-111`), showed it `done`.
  - The checklist's header promises "the checklist never shows done what a completion then refuses"
    (`checklist.ts:14-17`), and the two disagreed.
  - Reproduced provider-free (scratch `w21/repro.mts`, run with `node --experimental-transform-types`): listing
    (`effect: observe`, kept, `acts: [a1]`) plus press (`mutate`, kept, `acts: [a1]`, repeat over the listing), with
    this run's instruction:
    - the checklist returns `done: 2`;
    - the check refuses `a1 step_changed_nothing step "1"`, even with the result claim `a1>2`;
    - with the act removed from the listing, the check returns `ok: true`.
  - After E26's `keep` cleared the repeat, a correct check would have refused the Confirm `act_needs_repeat`, which is
    an actionable reason. Instead it repeated the misleading one 14 more times in exploration and 7 times in the repair.

**2. Who was confirmed, from which list, with what `where`.**
- Four lasting Confirm presses ran, all on the Friends home (`~/friends/`, 4 cards):
  - E15 t578 Amara Osei (23): right;
  - E16 t590 Priya Nair (4): wrong;
  - E17 t602 Jonas Weber (5, written "Aisha Khan and 4 other"): right;
  - E36 t566 Tom Becker (1): wrong.
- The page confirms the accepted states: page view at E19 (Amara, Priya and Jonas "Request accepted"), `00012` and
  `00019` (Tom "Request accepted"), and R1 `find_on_page` (all four accepted).
- The list was always read from the Friends home with `itemCount: 4`. "See all" (t554) was never pressed, so the
  8-card `friends/requests/` list was never read.
- No `where` on mutual friends >= 5 in the grammar's sense ever appeared. Every filter was the regex `matches
  /(?:[5-9]|[1-9][0-9]+) mutual/`, which drops Jonas Weber.
- The model pressed Jonas's Confirm anyway: it read his line correctly as five ("the last request with at least five
  mutual friends") while its own filter excluded him.
- Priya's press at E16 contradicts the model's own E15 reason ("Amara Osei ..., the only request with at least five
  mutual friends").
- Tom's press at E36 came immediately after the first no-progress note, which said "Your next step is the one that
  does a1: run it and add it with act a1" (`R/llm/evidence-progress/stall-redirect.ts:146-147`).

**3. What the refusal told the model, and why it resent the same claim.**
- The refusal told it that a1's quoted act had no step, with reason `step_changed_nothing` on step `"11"`. It also
  gave a list of "steps that changed something" by ids it never sees, and an instruction to "amend_draft add on that
  step and act set to the act's id ... Each act needs a step of its own, and it must be one that changed something".
- That was not enough to change course:
  - it never said that step 11 was judged because step 11 is *named* for a1, nor that the model's result claims were
    ignored;
  - the draft entry hides step names for acts, so "drop step 11" was undiscoverable;
  - the advised `add ... act a1` on the Confirm steps was refused `already_in_flow`;
  - the checklist said `done` three times.
- The model read the refusal as "name a step that changed something" and named one each time: 18, then 19/20/21, then
  25, then 27, then 7 and 6 in the repair. It did not resend the identical claim until E44-E51, when wrap-up had
  withdrawn tools.
- Why the guard was late: every rerun of step 11 counted as a step new to the Flow and cleared the guard (Stage 2,
  "Repeats"), so it reached 3 only at E36.
- Why the lifecycle was late, and what it made worse:
  - When the guard fired (E36), its note pushed a new lasting act, which confirmed Tom Becker.
  - The budget's worst-case projection then put the last 10 exploration decisions and the whole repair in wrap-up.
  - The repair inherited the poisoned draft, with a1 named on the listing as step 6, and had no tool and no telling
    that could clear it.

**4. Tokens per call, cache, cost by phase.** Per call `inputk/output` (decision dumps' `usage`):

- Exploration, 51 calls:
  - E1-E26: 16.8k/102, 21.0k/83, 21.3k/92, 22.3k/84, 22.3k/85, 21.5k/81, 21.8k/71, 22.6k/186, 23.2k/280, 24.3k/177,
    25.1k/270, 25.9k/243, 26.7k/85, 26.9k/253, 27.7k/102, 28.2k/102, 28.6k/101, 28.9k/68, 28.9k/255, 29.9k/84,
    30.4k/71, 30.4k/69, 30.4k/93, 30.5k/251, 31.3k/88, 31.3k/67;
  - E27-E51: 31.3k/244, 32.2k/90, 32.2k/95, 32.2k/295, 33.1k/241, 32.8k/233, 33.6k/123, 33.7k/311, 34.2k/107,
    34.6k/107, 34.6k/236, 35.6k/267, 36.4k/103, 36.7k/104, 36.7k/97, 34.0k/112, 37.1k/229, 34.8k/107, 34.9k/111,
    34.9k/102, 35.2k/92, 35.2k/93, 35.2k/119, 35.2k/101, 35.2k/112.
- Repair, 10 calls: 21.0k/67, 19.0k/67, 19.2k/94, 19.7k/95, 19.7k/106, 20.0k/97, 20.0k/94, 20.0k/94, 20.0k/76,
  19.4k/81.

| Phase | Calls | Input tokens | Cache hits | Hit rate | Output | Cost |
| --- | --- | --- | --- | --- | --- | --- |
| Exploration | 51 | 1,540,005 (min 16,796, max 37,052, mean 30,196) | 944,768 | 61.3% | 7,274 | $0.1930 |
| Repair | 10 | 198,090 (min 18,955, max 20,975) | 128,512 | 64.9% | 871 | $0.0227 |
| Total | 61 | 1,738,095 | 1,073,280 | 61.8% | 8,145 | $0.2157 |

- E20-E51, every call after the first refused completion, cost $0.1286 (32 calls). With the repair, $0.1513 of
  $0.2157 (70%) was spent after the draft held all four presses and the act naming that blocked it.
- The first window (16.8k tokens with only two entries) is the fixed system prompt and tool schemas; growth is page
  views and draft.

**5. UI review (screenshots in `run-muq3uozx-3153564b/screenshots/`, contact sheet `review/contact-sheet.html`).**
- **Each step its own message with the model's reason: yes.** Every decision posts a titled line with the model's
  reason: "Opening a page -- Navigating to the Circleway start location so the friend-request list can be observed",
  "Updating the draft Flow -- Rerun the friend-request extraction with a where ...", "Checking the Flow is finished --
  ..." (`00004`, `00007`, `00010`, `00012`). Each tool call has an action card with an icon (globe for open page,
  pointer for click, table for read list, flask for the check).
- **Defects, each with its screenshot:**
  - U1 `00004`, `00005`, `00007`, `00008`: every click card reads "Click · the page" and every read "Read list · the
    page". The control pressed ("Confirm" on Priya Nair's request) is never named, although the result carries
    `control: "Confirm"`. The fallback is `apps/extension/src/panel/chat/stream/step/card-words.ts:37`, and Core's
    card gives no target. A person cannot see from the chat that Priya and Tom were confirmed.
  - U2 `00012`, `00016`: each refused completion is a card titled **"Test run"** with "Didn't pass: sent back because
    it doesn't yet do everything that was asked. One thing needs fixing." No Flow was run; it is the completion
    check, mapped to `test` by `packages/fluxiq/src/ui/activity-action/action-of.ts:95` and named "Test run" by
    `names.ts:14`. It never says which thing; the wording is
    `R/activity/wording/completion-refusal.ts:10,27`. It repeats identically, once per refused completion (24).
  - U3 `00003`: the first answer is `Doing "Create an automation here".`, the capability's internal title in quotes.
    The final message repeats it (`00019`).
  - U4 `00019`, `00022`: the failure is posted twice, back to back, with the same text.
    - It says "the step I tried for it changed nothing" (`R/flow-bootstrap/unfinished-build/not-done.ts:19`), which is
      false to the person: four Confirms changed their account.
    - It says "ran from its start without failing" (`not-done.ts:79`), which reads as success.
    - It ends "Before that I created the Flow "Go through my friend requests..." and saved what it should do"
      (`R/conversations/commands/progress.ts:31`), which reads as if a Flow exists.
    - It never says that Tom Becker and Priya Nair were confirmed.
    - "FluxIQ attached something you can see in FluxIQ. Open FluxIQ" does not say what.
  - U5 `00010`: "Read list · Didn't work: the step wasn't accepted" for E31's `unexpected_input_keys`, with no reason.
  - U6 `00005`-`00022`: boxes outline every card's mutual-friends line (the extraction field highlight) from the
    first read to the end of the run, including after the build ended (`00022`). The highlight is never cleared.
  - U7 `00005`-`00019`: the on-page overlay is a small dark chip at the bottom right of the page area, mostly under
    the side panel's edge. Its words are not legible in any capture: NO EVIDENCE of what it said. (`00004` shows a dark
    dot at the bottom left instead.)
  - U8: no raw codes were shown in the chat in this run. The step titles are generic ("Clicking on the page",
    "Updating the draft Flow"), but the model's reason follows each.

**6. Causes:** the table below.

## Causes

Ranked by what blocked the first pass. Every Core path is under `R`; test files follow the repository rule
(`<dir>/tests/<file>.test.ts`).

| # | Cause, precisely | Repo and file | Fix | Task id |
| --- | --- | --- | --- | --- |
| 1 | **The completion check judges only the first draft step naming an act and ignores every other.** The check reads the draft's claims in draft order and gives a1 the first, the listing at step 11 (6 in the repair), faulted `step_changed_nothing`. It never tries the kept Confirm with `repeat` (step 16/17) that the checklist judged `done`. It also drops the model's result claims for a1 because a draft step names a1. 24 refusals, all on the listing. | Core `R/flow-bootstrap/instructed-acts/check.ts:155-157, 271-273, 327-335`; disagrees with `checklist.ts:104-115` | **check.ts:** for each act, try every kept step naming it (draft claims, then result claims, both in draft order) and accept the first fault-free one not already used, exactly as `checklist.ts:104-111` does. Report a fault only when none passes, naming the best candidate: the first mutating one, else the first. Move the loop into one exported function both files call, so they cannot diverge. **Test** (`instructed-acts/tests/check.test.ts`, provider-free): this run's instruction; draft [listing `effect: observe`, kept, `acts: [a1]`; Confirm `mutate`, kept, `acts: [a1]`, repeat over the listing] gives `ok: true` (fails today: `step_changed_nothing step "1"`, reproduced). Add a property case to `checklist.test.ts`: for every fixture draft, checklist `done` iff check `ok`. | t195 (Core) |
| 2 | **An act can be named on a step that cannot do one.** `add`/`keep` with `act` is accepted on any action step, a read included; only looks are refused. E11 `10 add act a1` named a1 on a withdrawn listing rerun and put it back in the Flow. A tool call with `add` and `act` names it on whatever ran: E38 named it on a fresh `extract_list`. Reruns then carry the name onward. | Core `R/flow-draft/amendment.ts:194-197, 209-229`; `R/llm/evidence-loop.ts:208-210`; `R/llm/evidence-loop/rerun-replacement.ts:47-50` | **amendment.ts:** refuse an `act` on a step whose `effect !== "mutate"` with a new reason `act_on_a_read`: "step N only reads the page; a read does no act. Name the press or setting that does it". Apply nothing of that amendment, so the model sees it. **evidence-loop.ts:208-210:** record `acts` only when `appended.effect === "mutate"`; for a read, keep the step and push the same `act_on_a_read` note. **rerun-replacement.ts:47-50:** carry `acts` only onto a mutating rerun. **Tests:** `flow-draft/tests/amendment.test.ts`: `{step: <read>, change: "add", act: "a1"}` is refused `act_on_a_read` and the step has no `acts` (today: applied, `acts: ["a1"]`, reproduced in `w21/repro2.mts`). `llm/evidence-loop/tests/rerun-replacement.test.ts`: a read with `acts` rerun leaves the rerun with none. | t195 (Core) |
| 3 | **`keep` deletes a `repeat`.** `clearsRouting` holds for any routing kind. E21 `16 keep act a1` and E26 `17 keep act a1` erased the repeat on Amara's Confirm; the checklist went from `done` back to todo; the final draft has no loop. The model was naming an act, not asking for "unconditional". | Core `R/flow-draft/amendment.ts:216, 228` | **amendment.ts:216:** `clearsRouting` only for `optional`, `only_if` and `on_failed`, never `repeat` (a repeat is not a condition). Clear nothing when the amendment carries `act`. **Test** (`flow-draft/tests/amendment.test.ts`): step with `routing: {kind: "repeat", ...}`, `{change: "keep", act: "a1"}` keeps the routing (today: `routing` undefined, reproduced). | t195 (Core) |
| 4 | **The model cannot see which step names which act, and the refusal names steps by ids it never sees.** `stepLine` shows no `acts` and no `id`; the refusal's `step` is a position while `stepsThatChangedSomething` is `d15, d16, ...`. The model never learned that step 11 held a1, so "drop step 11" (step 9 was an identical listing) was undiscoverable. | Core `R/flow-draft/entry.ts:81-111`; `R/flow-bootstrap/instructed-acts/check.ts:227` | **entry.ts:** `stepLine` adds `act: [...]` when `step.acts` is set. **check.ts:227:** list positions (`step.position`), the numbers the draft shows. **Tests:** `flow-draft/tests/entry.test.ts`: a step with `acts: ["a1"]` shows `act: ["a1"]`. `instructed-acts/tests/check.test.ts`: `stepsThatChangedSomething` are positions. | t195 (Core) |
| 5 | **The refusal tells the model to name an act that is already named, and the amendment refuses it as "nothing to confirm".** check.ts:98 says "amend_draft add on that step and act set". E29 (`18/19/20 add act a1`), R2 (`7 add act a1`) and R9 (`7 keep act a1`) all were refused `already_in_flow`, "do not keep it again", because those steps already named a1. | Core `R/flow-draft/amendment.ts:217, 220-224`; `R/flow-bootstrap/instructed-acts/check.ts:96-100` | **amendment.ts:** when `act` is already on the step, refuse with `act_already_named`: "step N already says it does a1; a completion refused for a1 names the step it judged in missingActs.step: correct or drop that step". **check.ts INSTRUCTION:** when `missing.step` names a step that does not change anything, say "step S is named for this act and only reads the page: drop it, or rerun it without act, and name the press". **Test** (`amendment.test.ts`): `{change: "add", act: "a1"}` on a step with `acts: ["a1"]` gives `act_already_named`. | t195 (Core) |
| 6 | **A rerun counts as progress, so the no-progress guard never builds up.** A rerun's replacement is a new step object; `authored.advanced()` calls it "in the Flow for the first time"; `addedToFlow` short-circuits the repeat test and `noProgress.cleared()` also forgets the refusals seen. 10 listing reruns returned the same row (Amara) and each reset the guard; the first note came at E36, after 6 refusals, and the stop at E51, after 17. | Core `R/llm/evidence-progress/authored-progress.ts:36-42`; `R/llm/evidence-loop.ts:701, 728-730`; `R/llm/evidence-progress/no-progress.ts:141-146` | **rerun-replacement.ts:** stamp the rerun with the replaced step's lineage. A new optional field `replaces?: string` on the step (`R/flow-draft/step.ts`), set to `replaced.id`, or the replaced step's own `replaces` when it has one. **authored-progress.ts:** a step whose `replaces` lineage was ever in the Flow is not new. **evidence-loop.ts:728:** a rerun whose answer repeats its tool's last answer (`repeated`) is no progress even when `addedToFlow`. **Tests:** `llm/evidence-progress/tests/authored-progress.test.ts`: [listing kept] then a rerun replacing it gives `advanced()` false. A loop test with a stub host: four reruns of one read returning the same rows, each followed by the same refused completion, reach the guard within `max`. | t195 (Core) |
| 7 | **The stall note orders a new lasting act when the act already has presses.** "Your next step is the one that does a1: run it and add it with act a1" is said whenever a1 is not done, whatever the checklist's `todo` says. At E36 the first note appeared and the model pressed Tom Becker's Confirm (1 mutual friend): a wrong lasting act on the person's account. | Core `R/llm/evidence-progress/stall-redirect.ts:143-148` | **stall-redirect.ts:** take each missing act's checklist `todo` and `step`. Say "run it" only for `no_step_added`. Otherwise say the checklist's reason and step ("a1: step 11 is named for it and only reads the page; fix that step"). Always add "never press it on an item your listing left out". The facts input gains the checklist items (`R/llm/evidence-loop.ts:284` passes the acts missing today). **Test** (`llm/evidence-progress/tests/stall-redirect.test.ts`): `actsMissing` a1 with todo `step_changed_nothing` step 11 gives an instruction without "run it and add it" and with "step 11". | t195 (Core) |
| 8 | **Nothing stops a second, third and fourth single press for a plural act, or a press on a row the kept listing rejected.** E16 (Priya Nair, 4), E17 and E36 (Tom Becker, 1) were each run live with `add` and `act a1` after a kept Confirm already named a1. The authored-draft telling omits the rule that the transcript telling has ("never act on the others yourself"). | Core `R/flow-draft/entry.ts:46` (vs `:39`); the tool-call path of `R/llm/evidence-loop.ts` before execution (the `decision.act` read at `:697`) | **entry.ts:46:** add "do the act to one item the listing kept, never to the others yourself and never to an item it left out: the repeat does the rest". **evidence-loop.ts:** before running a tool call whose `act` names a `plural` act that already has a kept mutating step naming it, refuse it unrun with `act_already_has_its_press`: "a1 is done to every item by repeating step N over the listing; repeat it instead of pressing again". **Test:** a loop test with a stub host: after a kept click with `act: "a1"` (plural), a second click with `act: "a1"` makes no host call and is refused. A provider-free fixture from the social-network-feed markup is not needed. | t195 (Core) |
| 9 | **The list was read from the Friends home (4 of 8); its "See all" was never offered as the list's continuation.** Detection around t557 answered `itemCount: 4`, `pagination: "none"`, although the section heading "Friend requests" carries "See all" (t554, same href as t542 `~/friends/requests/`). | extension `apps/extension/src/content/extraction/pagination.ts` (or `detect-structure`), proposed; not traced line-by-line in this debug | **pagination.ts:** a link whose words are "See all", "View all" or "Show all" in the detected list's own section (the heading before its first item) is reported as `continues: "elsewhere"` with its handle. The detect result then says "this list shows part of a longer one: tN opens all of it". **Test** (`content/extraction/tests/pagination.test.ts`, jsdom): the Friends home fixture from `social-network-feed` reports the see-all handle. | t195 (extension) |
| 10 | **The budget counts decisions by the purse's worst case, so wrap-up withdrew tools with most of the money left.** `perDecision = max(averageCost, nextDecisionCostUsd)`, where `nextDecisionCostUsd` is the worst case of the last priced decision. Inferred from `decisionsLeft` against `costLeftUsd`, it is about $0.023-0.030 per call against an observed $0.0023-0.0047. Wrap-up began at E42 with $0.0906 left, and the repair ran R2-R10 in wrap-up with $0.0514 left: "Work live" with no tools. | Core `R/llm/loop-budget.ts:121-123`; wrap-up `R/llm/evidence-loop.ts:497-498`, threshold `R/llm/loop-budget.ts:48` | **loop-budget.ts:122-123:** count like the tokens bound does at `:115-117`: `costLeft < worstCase ? 0 : 1 + floor((costLeft - worstCase) / averageCost)`. The purse still refuses any single call it cannot cover at worst case. **Test** (`llm/tests/loop-budget.test.ts`): `maxCostUsd 0.05`, 10 reported decisions averaging $0.0023, `nextDecisionCostUsd 0.025` gives `decisionsLeft >= 10` (today 2). | t195 (Core) |
| 11 | **The model filtered with a regex where a numeric bound was offered, which drops "Aisha Khan and 4 other mutual friends", and the rejected-row note did not turn it.** Jonas Weber was listed in `rowsAlone` on every read. The note says only that the condition must change. | downstream `domain/src/runtime/llm-evidence/node-run/rejected-rows.ts:49` (note); count reading `domain/src/actions/extraction/condition-match.ts:27-46` | **rejected-rows.ts:** when a text condition (`matches`, `contains`) alone rejects a row whose column reads as a count under `condition-match.ts`'s reading, add: "this column reads as numbers (Jonas Weber: 5); compare it with atLeast, not a pattern". **Test** (`node-run/tests/rejected-rows.test.ts`): a `matches /[5-9] mutual/` rejecting "Aisha Khan and 4 other mutual friends" yields the note naming 5. | t195 (domain) |
| 12 (suspect) | **The draft test answered `verified` for four Confirm presses whose controls were gone.** R1, right after the test, finds all four requests "Request accepted". `verified` means the resolved target was present, visible and enabled, so the right answer was `present`, and the elements resolved to are unrecorded. | downstream `domain/src/runtime/llm-evidence/node-run/verify.ts:26-33, 92` | First record the resolved target per checked step (gap G3). **Test** (`node-run/tests/verify.test.ts`, provider-free with the resolution stubbed or a jsdom fixture of an accepted card): verifying a Confirm press recorded on a card that now shows "Request accepted" answers `present`, never `verified`. | t195 (domain), after G3 |
| 13 | **The person is not told what the build did to their account, and is told things that read as success.** See U4: "changed nothing", "ran ... without failing", "created the Flow ... and saved what it should do", and no mention of four confirmations, two wrong. | Core `R/flow-bootstrap/unfinished-build/not-done.ts:19,79`; `R/conversations/commands/progress.ts:31` | **not-done.ts:19:** for `step_changed_nothing` say "the step I named for it only read the page". **not-done.ts:79:** "ran from its start, but did none of what you asked". The ending (`R/flow-bootstrap/generation-failure/build-ending.ts`) lists lasting steps that ran during the build: kept or taken steps with consequences and `effectApplied: true`, by control name and row ("I pressed Confirm 4 times on your page: those changes are still in place"). **Test:** `unfinished-build/tests/not-done.test.ts` wording; a build-ending test with two applied `modify_existing` presses names both. | t195 (Core) |
| 14 | **UI wording:** the completion check is shown as "Test run" with no detail (U2); click cards name "the page" (U1); `Doing "Create an automation here"` (U3); duplicated failure message (U4); unexplained `invalid_input` (U5); stale field highlight (U6). | Core `packages/fluxiq/src/ui/activity-action/action-of.ts:95`, `names.ts:14`; `R/activity/wording/completion-refusal.ts:10,27`; extension `apps/extension/src/panel/chat/stream/step/card-words.ts:37` | **action-of.ts:95:** map `detail.kind === "check"` to its own kind, "Completion check", not `test`. **completion-refusal.ts:** name the missing act's quote and reason in words. **card-words.ts:** take the target from the result's `control` when Core gives no name. The duplicate message and the highlight need tracing: not done here. **Tests** in each file's `tests/`. | t191/t227 (UI) |

## Instrumentation gaps found

| Stage | What could not be answered | File that drops it |
| --- | --- | --- |
| Header (G1) | Provider calls and cost of a chat-driven build. The Lab recorded `calls: 1`, `totalEstimatedCostUsd: 0`, `providerInvocation: "unknown"`, `accounting: null`, and the live-guard spend ledger recorded $0 for a $0.2157 run (Lab log line 85), so the waste guards undercount chat builds. | `packages/test-runner/src/flow-lane/creation/chat/build-from-chat.ts:165-170` (a chat build that ended without a proposal is recorded with no accounting; the comment at :168 says so) |
| 2 (G2) | The model's stated reason per decision: the chat shows it, the decision dump does not. E16's reason for pressing Priya Nair is lost. | Core `R/llm/evidence-progress/decision-dump.ts:54-56` writes the parsed decision, which carries no reason |
| 4 (G3) | Per-step result of the unfinished-draft test: which element each `verified` Confirm resolved to, rows read, durations. Only the `replayed` word survives on the repair's draft. | Core `R/flow-bootstrap/unfinished-build/phases.ts` (the test round writes nothing to the decision dump or the build trace) |
| 2 | Which bound set `decisionsLeft` (`limitedBy` is never shown or dumped) | Core `R/llm/loop-budget.ts:93, 134-135` (dropped from the entry at `:145`), `decision-dump.ts` |
| 6 | The person-facing ending does not list lasting acts done while exploring (cause 13) | Core `R/flow-bootstrap/generation-failure/build-ending.ts` |
| UI | The on-page overlay's words (U7): the chip is under the side panel in every capture | Lab capture framing, not a product file |
