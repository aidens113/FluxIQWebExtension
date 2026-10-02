# Run debug — `run-muqilf9s-c3211328`

t195 lane, slot-4, live run 38: social-network-feed `confirm-requests`, built from the extension chat. It is the first
proposed Flow since run 6. Debugged from `test-runs/instances/t195-slot-4/run-muqilf9s-c3211328/` (`steps/`, `snapshots/`,
`events.ndjson`, `screenshots/`, `logs/core.log`) and the decision dumps `decision-dumps/build-2026-10-02T05-2*-14920.jsonl`.
Code is cited as it stands in the t195 trees (Core `eed0cc34`, downstream `5261aa8e`, both level with dev).
`R` = Core `packages/fluxiq/src/programs/automation-studio/runtime/`.

**What decided this run, in one line:** every list read that succeeded was refused by Core as
`llm_evidence_loop.tool_result_invalid.evidence_not_json` (cause C1). The model was told 12 times that its read "failed
and returned no evidence". No listing step was ever kept, so the per-item `repeat` could not be attached, and the Flow
shipped one Confirm. The "last step failure" is not a navigation failure (Q1).

## Header

- Run id: `run-muqilf9s-c3211328`; Core runtime run `87ca68e4-c06e-4bdc-86f8-85b780b728e4`; Flow `flow.206e2d48-…`.
- Scenario / variant / task: `social-network-feed` / none / `social-network-feed-confirm-requests` (judgeBy
  `expected-dataset`, `extract-confirmed`, 4 expected records = `QUALIFYING` in `apps/scenario-lab/src/scenarios/social-network-feed/manifest.ts:61`).
- Command: NO EVIDENCE. `run.json` records no command line. Lab slot `t195-slot-4`, headed Chromium 134, entry `chat`.
- Date, provider, model: 2026-10-02 05:20:33–05:28:05Z (Lab clock); DeepSeek `deepseek-flash`.
- Provider calls, tokens, cost: **49 calls, $0.116431 from the step logs.** The build took 37 calls and $0.091435. The
  run's own recovery took 12 calls and $0.024996. The table in Stage 6 splits this per call.
- Verdict as reported: `failed`, `runtime.behavior`; failure `output_not_observed` / `core.result.does_not_answer_request`,
  stage `verification`; `resultVerification: refuted`; oracles `records: failed`, `finalState: failed`.
- **Stage reached: 6.** Judgement and repair ran. The answer (stage 5) was empty.

## Stage 1 — the instruction and the expected chain

- The instruction, verbatim (0001): "Go through my friend requests and confirm everyone I have at least five mutual
  friends with, and leave every other request as it is. Then give me a table of every request the list now shows as
  accepted, in the order the list shows them, with columns name and mutualFriends, where mutualFriends is written exactly
  as their request shows it."
- The node chain a correct Flow must have:
  1. Open the start (feed). Dismiss the consent banner, optional.
  2. Reach `~/friends/requests/`, the full list of 8. The Friends home shows only 4 under a "See all".
  3. Close the site's chat popup, optional.
  4. `dom-extract_list` over the 8 cards with `name` and the mutual-friends text column, plus a `where` keeping a count
     of at least 5. "Aisha Khan and 4 other mutual friends" counts as 5.
  5. Press that row's own Confirm on one kept row, with `repeat` over the listing.
  6. Re-read the list for the rows showing "Request accepted", in list order, with `name` and `mutualFriends` verbatim,
     then write the records.
- What a wrong answer that looks right would look like here: a `where` like `(?:[5-9]|[1-9][0-9]+) mutual`, which drops
  Jonas Weber ("Aisha Khan and 4 other mutual friends"); a table taken from the pre-confirm read; a Flow that confirms
  the right people and returns nothing.

## Stage 2 — exploration

One row per model turn. The cost is the call's step-log `costUsd`. "Core said" is what the model was shown in the next
request, which is not always what the step folder's `result.json` holds (C1).

| # | What it was asked | What it decided | Action and parameters | Result (Core said) | Cost |
| --- | --- | --- | --- | --- | --- |
| 0001 | chat interpreter | `flow.createHere` | instruction as above | build started | $0.000271 |
| 0002 | — (free opening, no call) | — | navigate `~/` | consent DIALOG over the feed | — |
| 0003 | decide 1 | dismiss consent | click `t476` "Decline optional cookies", add | ok, kept | $0.003281 |
| 0005 | 2 | open Friends | navigate `~/friends/` | ok (taken) | $0.002310 |
| 0007 | 3 | detect | `t544` | extraction.1, **4 items** (Friends home) | $0.001908 |
| 0009 | 4 | dismiss notifications | click `t?` | `target_unobserved` malformed_handle | $0.001667 |
| 0011 | 5 | dismiss notifications | click `t670` "Not now" | ok (taken) | $0.003183 |
| 0013 | 6 | open full list | navigate `~/friends/requests/` | ok, kept | $0.001814 |
| 0015 | 7 | close chat popup | click `t851` "Close chat" | ok, kept | $0.001991 |
| 0017 | 8 | detect | `t743` | extraction.2, 8 items, 7 fields labelled by class path only | $0.002004 |
| 0019 | 9 | read list | extract extraction.2 `{name, mutual: div_x1507i5…}` | domain: 8 rows, `mutual: "Confirm"`; **Core: `evidence_not_json`** | $0.001871 |
| 0021 | 10 | same | same | **`evidence_not_json`** | $0.001746 |
| 0023 | 11 | same | same | **`evidence_not_json`** | $0.001800 |
| 0025 | 12 | same | same | **`evidence_not_json`** | $0.001950 |
| 0027 | 13 | "confirm Amara … then repeat that press" | click `t769` (Amara, 23), add, act a1 | ok, lasting | $0.001932 |
| 0029 | consequence reading (separate task) | complete | `modify_existing` ×2 | — | $0.000341 |
| 0030 | 14 | read list | extract (same) | `output_not_observed` required_fields_missing (Amara's card lost its Confirm) | $0.002815 |
| 0032 | 15 | amend | rerun 15 with `where mutual matches (?:[5-9]\|[1-9][0-9]+) mutual`; add 15; 14 repeat over 15 | rerun `conditions_kept_nothing`; 14 refused `not_a_kept_step` | $0.004794 |
| 0034 | 16 | read list | extract `minItems 0` | required_fields_missing | $0.002538 |
| 0036 | 17 | "the key was wrong" | detect `t743` | extraction.4 | $0.002483 |
| 0038 | 18 | read list | extract extraction.4 | domain: `mutual` Confirm/null; **Core: `evidence_not_json`** | $0.002488 |
| 0040 | 19 | read 4 candidate columns | `mutual…mutual4` | domain: **`mutual4: "1 mutual friend"`** (the right column); **Core: `evidence_not_json`** | $0.002399 |
| 0042 | 20 | same | same | **`evidence_not_json`** | $0.002498 |
| 0044 | 21 | amend | 14 keep a1; 14 repeat over 14 | refused `act_already_named`, `over_not_before` | $0.002415 |
| 0045 | 22 | amend | 14 repeat over 15; rerun 15 with `where` on the `div_x1507i5…` key | rerun → **`evidence_not_json`**; 14 refused `not_a_kept_step` (repeated) | $0.003443 |
| 0047 | 23 | amend | same + add 15 | same | $0.002828 |
| 0049 | 24 | amend | **14 rerun with `t757` (Tom Becker, 1 mutual)**; 15 rerun/add | reset to location, **Tom confirmed** (lasting); 15 refused `did_not_work`, `run_by_the_loop` | $0.003012 |
| 0052 | 25 | amend | rerun 24 (listing); add; 14 repeat over 24 | rerun → **`evidence_not_json`**; refused `not_a_kept_step` | $0.003788 |
| 0054 | 26 | read list | extract | **`evidence_not_json`** | $0.002937 |
| 0056 | 27 | read list | extract | **`evidence_not_json`** | $0.002848 |
| 0058 | 28 | amend | 14 rerun `t757` | reset; `t757` gone (Tom accepted) → `target_unobserved` | $0.002902 |
| 0061 | 29 | amend | **14 rerun with `t781` (Priya Nair, 4 mutual)**; 16 rerun/add | **Priya confirmed** (lasting); 16 refused `did_not_work`, `run_by_the_loop` | $0.003822 |
| 0064 | 30 | amend | 14 keep a1; repeat over 14 | refused again (repeated) | $0.003568 |
| 0065 | 31 | amend | 14 repeat over 9 (a look) | refused `not_a_kept_step` (repeated) | $0.005668 |
| 0066 | 32 | `complete` (`decisionsLeft 1`, `costLeftUsd 0.0149`, only complete offered) | acts a1 → step 14 | completion check ok | $0.002347 |
| 0067–0072 | test | — | 6 steps; dismissals `core.replay.remembered`, Confirm `verified` (not run) | — | — |
| 0073, 0074 | judge ×2 | **no** | "confirms one request (Priya Nair, 4 mutual friends) … no read … no repeat … no table" | judged wrong | $0.000904, $0.000568 |
| 0075 | — (free opening of round 1, **added**) | — | navigate `~/` | becomes Flow step 6 (C3) | — |
| 0076 | repair round 1, decision 1 (`decisionsLeft 1`, `costLeftUsd 0.0111`, only complete offered) | `complete`: "does not read the list, filter …, repeat, or output the accepted table" | — | — | $0.002299 |
| 0077–0083 | test of round 1 | — | 7 steps, incl. `dryrun.1.6` navigate `~/` | **not judged** (purse, Q4) | — |

- Repeats, and what the loop believed was progress: 12 identical or near-identical list reads. 9 of them were the same
  call. The loop counted each `evidence_not_json` as a failure (`stepsWithoutProgress` 1→6), not as a repeat, because
  Core believed nothing had been returned. The model believed each one had failed, so re-asking was rational. Two
  dismissals (`taken`) were later counted into the Flow by the opener rule.
- Rejections and refusals received:
  - `evidence_not_json` (×12) gave the model nothing to route around. It says "This call failed and returned no
    evidence", which was false.
  - `required_fields_missing` and `conditions_kept_nothing` named the missing field `mutual` but not what the column
    held.
  - The amendment refusals `over_not_before`, `not_a_kept_step` and `did_not_work` were all true, and all were
    consequences of the listing never being kept.
- Where the context was evicted or truncated: nowhere. F42's superseding worked (`supersededBy` on older reads). The
  reads it would have shortened never reached the model at all.
- Lasting effects on the site during the build: Amara (correct), Tom (1 mutual, wrong) and Priya (4, wrong) were
  confirmed. The resets restore the location only. Screenshot 00015 shows "5 friend requests" with all three accepted.

## Stage 3 — the proposed Flow

- Node list as authored (`snapshots/flow-lane.json` `authoredNodes`; the URLs come from the draft, because the snapshot
  withholds them):
  1. `s1` `web.output.browser-navigate` `{url: ~/}`
  2. `s2` `web.output.dom-click` `{element: div[role=button] "Decline optional cookies"}`
  3. `s3` `web.output.browser-navigate` `{url: ~/friends/requests/}`
  4. `s4` `web.output.dom-click` `{element: div[role=button] "Close chat" "✕"}`
  5. `s5` `web.output.dom-click` `{element: div[role=button] "Confirm", context.listPosition {index 3, total 8}}`
     (Priya Nair, `record.text` "Priya Nair4 mutual friends5d" at test time)
  6. `s6` `web.output.browser-navigate` `{url: ~/}`, the repair round's opening (0075)
- Divergences from the stage 1 chain, one line each:
  - No listing node (chain step 4).
  - `s5` is a single press on the wrong person, with no `repeat`.
  - No re-read and no record store.
  - `s6` is extra and ends the run off the requests page, which fails the `finalState` oracle (path `~/friends/requests/`).
  - `s2` and `s4` are not marked optional.
- Classification:
  - The missing listing: could not express it. Every successful read was refused (C1), and the column labels were
    unreadable (C2).
  - `s5` on Priya: misread. The model re-pointed "the first row" to the next remaining Confirm (0049, 0061) after the
    earlier presses changed the site (C6).
  - `s6`: not the model's. It is the loop's own free opening (C3).

## Stage 4 — replay

The run's own playback, from `snapshots/flow-lane.json` `actions`:

| Node | Executed | Produced | Duration | Retries | Rung that absorbed |
| --- | --- | --- | --- | --- | --- |
| s1 navigate `~/` | yes | succeeded, `matched` | 2308 ms | 0 | — |
| s2 Decline cookies | yes | succeeded, `matched`; targetResolution `unresolved_no_candidates`, host `selector` 0.703 | 788 ms | 0 | host resolution |
| s3 navigate `~/friends/requests/` | yes | succeeded, `matched` | 1473 ms | 0 | — |
| s4 Close chat | yes | succeeded, `matched`; host `scored-candidate` 36 candidates, best 0.737 (runner-up 0.126) | 1365 ms | 0 | host resolution |
| s5 Confirm (index 3/8) | yes | succeeded, `matched`; host `selector` 0.703 | 612 ms | 0 | host resolution |
| s6 navigate `~/` | yes | **succeeded, `matched`**, after-packet 7834 B | 1374 ms | 0 | — |
| s6 (attempt 6) | **no** | the synthetic `result-verification.<runId>` attempt: `failed`, stage `verification` | 1228 ms (`now − s6.finishedAt`) | — | — |

- Any node that reported success while doing nothing: none proven. NO EVIDENCE of what s2 and s4 actually pressed: Core
  could not resolve either target and the host scored a candidate. If the popups were absent, a 0.70 or 0.74 host
  match pressed something else (lane A).
- Provider calls during replay: zero during the steps. Two verification judges (0084, 0085) ran after them.

## Stage 5 — the answer

- Records expected vs returned: 4 expected, 0 returned (`extraction.steps[0]`: `not_run`, observed 0). No record set
  exists.
- Fields compared, matched, mismatched: none. There was nothing to compare.
- Every mismatch, observed value beside expected: the whole table is missing.
- Count-only: no. The judge compared the request with the steps and saw no record producer
  (`answerability.recordProducerPresent: false` in the round-1 dump).

## Stage 6 — judgement and repair

- Did the system judge its own result: yes, three times.
  - Build round 0's test: "no" (0073, 0074), correctly.
  - Build round 1's test: **not judged** (Q4).
  - The run: refuted twice (0084, 0085, `does_not_answer` ×2).
- Did a repair trigger automatically: yes, in two stages.
  - The refuted-result re-author ran: explore round 0086–0091, then repair round 0092–0097, and ended
    `flow_bootstrap.not_doable` at `provider_output_validation`.
  - Then the patch ladder ran: diagnosis 0098, then `runtime_patch` 0099, which answered `no_repair` with
    `control_gone`.
- What context the repair received:
  - The re-author had the instruction, the Flow as a draft (s1–s6 with their parameters, including step 3's
    `~/friends/requests/`), the page as it stood (the feed, covered by "Chat with Elena Sokolova") and a decision
    history.
  - It did not have the prior build's shown addresses (forgotten at its opening), the judge's advice as an entry in
    its first request, or the failing node (`resume` arrives only in its second round).
  - The patch (0099) had `failure`, `flow_graph`, `step_parameters`, `subflow`, `route_context` and `recent_nodes`.
    Absent: `expected_transition`, `actual_transition`, `state_diff`, `failed_target`, `recovery_candidates`,
    `recovered_failures`, `known_adaptations` and `recording_context`. Its failure named **s6**, with
    `repairCandidates: action_not_repairable`, `failedTargetUnknown: true` and empty `repairParameters`.
- Was the repair persisted: no. No adaptation and no change proposal, so nothing was re-run.

### Q1 — the last step's failure

**None of the three readings holds. The navigation did not fail.** Runtime attempt 5 of `s6` succeeded with
`comparisonStatus: matched` (`flow-lane.json` `actions[5]`). The "failed navigate" is the attempt Core builds for a
refuted result, filed under the last node that succeeded:

- `output_not_observed` comes from the verification's verdict: `R/result-verification/core-observation.ts:101-123`.
  Line 114 maps `does_not_answer` to `output_not_observed`, with stage `verification`. No domain output node, native
  runtime, extension navigate action or Core executor decided it.
- `R/recovery/refuted-result/attempt.ts:80-128` builds a `failed` attempt with that record. `resultProducingAttempt`
  (`attempt.ts:155-158`) names "the last attempt that stored records, or failing that the last attempt that
  succeeded". Nothing stored records, so it names `s6`. Its `durationMs` is `now − s6.finishedAt` (attempt.ts:89, 118),
  which is the 1228 ms shown.
- The Lab maps every `actionAttempts` entry into its actions table with no regard for the `result-verification.`
  prefix (`packages/test-runner/src/flow-lane/persisted-flow-run.ts:592-596`, `flowAction` 625-641). So `run.json`,
  `evaluation.json` and the brief all read it as "the last navigate failed".
- The step's node parameters are `{url: http://127.0.0.1:63158/scenarios/social-network-feed/, newTab: false}` with no
  `expectedState`. Its expected output is the `web.browser.navigate` success port, which was observed.
- **It should not be in the Flow at all.** `s6` is round 1's free opening navigation, run by Core with `add: true`
  (`R/llm/evidence-loop.ts:534`). That happens for every round, including a continuation whose draft was already seeded
  (`evidence-loop.ts:189`). The model never decided it: 0075's `callId` is `initial.core.run_node`. The round's own
  instruction says "The page is where the test left it: look first", which the opening contradicts. The step then
  failed the `finalState` oracle, left the re-author on the feed, and became the node every repair spoke about.

### Q2 — why 0099 answered `no_repair`, and why the navigations were refused `address_not_shown`

- **0099.** The patch rung was handed `nodeId s6`, a navigation with nothing to repair:
  `repairCandidates.status: action_not_repairable`, `failedTargetUnknown: true`, `repairParameters: {}`. It was also
  handed a judgement whose fix is structural ("replace the single Confirm by a read/filter/confirm-each/store loop").
  Its allowed kinds are `temporary_reroute`, `temporary_recovery_subflow_call` and `temporary_action_sequence` (at most
  8 steps at the target node), none of which can add a list read with a repeat ahead of `s5`. Its answer says exactly
  that ("no repairable parameter for this node … The needed change is structural"). `control_gone` is the closest
  reason its enum offers, and it is wrong: the control is not gone. The diagnosis (0098) had said `patchNeeded: true`,
  `deterministicRecoveryPossible: yes`. The rung ran after the structural path, the re-author, had already failed, so
  it was $0.0059 spent on a question with no answer.
- **`address_not_shown`.** The re-author opened on the feed, because `s6` put it there (C3). At once it navigated to
  `~/friends/requests/` (0087). The domain refused it: `domain/src/runtime/llm-evidence/node-run/run.ts:359`, using the
  memory in `node-run/shown-addresses.ts`. That memory counts only addresses this build was shown, and a build's
  opening call forgets the last build of the same flow (`shown-addresses.ts:39-40`, `opening` at 99-101). The feed
  shows `~/friends/` (`t12`), not `~/friends/requests/`. The address the model used is the Flow's own step 3, which is
  in the draft it was handed, but a draft step's address does not count as shown.

  The model sent the same call three more times. The repeat guard refused each one (`core.repeat_check`,
  `refusedInARow` 2 of 3, "Repeats refused in a row end this round"), so each round ended after 4 decisions. The second
  round started on the same page with the same memory and did the same thing, for another $0.0079. The model never
  pressed `t12` "Friends", which the refusal's own `instead` offered. Model error, but the refusal itself is one of the
  pre-action refusals the user ruled out ("unknown addresses are information, never refusals", 2026-10-01). Removing it
  is waiting on the user.

### Q3 — why round 1 shipped one Confirm on Priya, despite the per-item telling

What the model was shown about lists, verbatim:

- System message (every decision): "Lists. Do each act once, on one item. To do it to every item of a list, do it to
  one item and state repeat."
- `core.flow_draft.instruction` (0066 request): "To do one act to every item of a list, three steps in this order: add
  the step listing them, with a where keeping only those to act on; do the act to one row it kept -- press that row's
  own control -- and add that press with its act; then send amend_draft {"step": <that press>, "change": "repeat",
  "over": <the listing>} … A did_not_work step can only be rerun."
- The acts checklist: `a1 confirm … plural: true, todo: act_needs_repeat, step 14`.

The model followed the telling. 0027 says "confirm … Amara Osei (23 mutual friends) as the first row the listing keeps,
then repeat that press over the filtered list". It then sent a `repeat` amendment nine times (0032, 0044, 0045, 0047,
0049, 0052, 0061, 0064, 0065). Every one was refused, because **no listing step was ever kept**:

1. **The successful reads never reached the model (C1).** The domain returned 8 rows each time (step folders 0020,
   0022, 0024, 0026, 0039, 0041, 0043, 0046, 0048, 0053, 0055, 0057). Core recorded each as
   `llm_evidence_loop.tool_result_invalid.evidence_not_json`, and the model was shown: "This call failed and returned
   no evidence, so nothing it would have shown is known." The decision dump confirms it: the `tool` event carries the
   domain's evidence with `firstRows`, and the `entry` the model got is the refusal.

   The cause: F42 (`01082bc9`) builds `firstRows` as `rows.slice(0, 3)`
   (`domain/src/runtime/llm-evidence/node-run/shown-rows/account.ts:53`), so the same row objects also sit in
   `extracted` (line 60). Core's evidence check `isJsonValue` (`R/llm/evidence-loop-decision.ts:506-513`) adds every
   object to `seen` and never removes it, so a shared row is read as a cycle and the whole result is refused at
   `evidence-loop-decision.ts:122`. The harness's own copy deletes on the way out (`R/llm/harness/json-bounds.ts:43`).

   Reproduced with that function's body: `{read:{firstRows: rows.slice(0,1), extracted: rows}}` gives `false`, and
   with the rows cloned it gives `true`. Every read that ended `did_not_work` can only be rerun, and every rerun was
   refused the same way.
2. **The reads that did reach it (`ok:false`) named a wrong column (C2).** The model mapped `mutual` to
   `div_x0531l50_x1r2vv8_x4q0id2_div_x1507i5_x1mgzeci_xu37y6r`, the Confirm button's text. The structure packet showed
   7 fields labelled only by obfuscated class paths, with no example (0018). The right column was
   `…div_x1a4yqcp_xa73opb_xtlve1b`, and its rows were in 0041's refused result. So the `where` kept nothing (0033).
3. **Priya.** With the listing unreachable, the model kept "step 14" as the act and re-pointed it twice with
   `rerun`: to `t757` (0049, Tom, 1 mutual), then to `t781` (0061, Priya, 4 mutual). Each was the first Confirm still
   on the page after the previous press had accepted someone, and each press was real.

   The page view showed `t755 "1 mutual friend"` beside `t757` and `t779 "4 mutual friends"` beside `t781`, so this is
   a model misread. It is also a lasting effect on the wrong person during the build: both the instruction ("leave
   every other request as it is") and the act's own quote ("at least five") were broken.

The decision ceiling then ended round 0. 0066 had `decisionsLeft 1`, so only complete was offered.

### Q4 — was the repair round judged

**No.** After the round-1 test (0077–0083), no judge call exists (no step folder; `core.log` goes from
`dryrun.1.6` at 05:27:13 to the run at 05:27:38), and the build ended `outcome: proposed`.

- The purse: 0076's request held `core.budget` `{decisionsLeft: 1, costLeftUsd: 0.0111}`. 0076 cost $0.002299, which
  left about $0.0088.
- The judge's call is held at its worst case. Its request sets `max_tokens: 8000` (0073 `request.json`), the default
  reply allowance `AUTOMATION_STUDIO_LLM_DEFAULT_REPLY_TOKENS = 8_000` (`R/llm/harness/token-limits.ts:43`). Only a
  build decision gets the 2,000 cap (`:67`). So the call was projected at $0.011, and the purse refused it:
  `R/result-verification/build-test/judge.ts:117-118` → `not_judged` with `refusedSaid` (147-151).
- Round 0's two judge calls cost $0.000904 and $0.000568 (410 and 412 output tokens). The hold was about 7–12× the
  real cost.
- The chat (screenshot 00016), from `R/service/flow-bootstrap-commands/build-judge.ts:98`: "**Flow not verified** —
  Its test was not judged to answer what you asked: The build's spending limit of $0.10 had $0.009 left, too little for
  the judge's call, which could have cost up to $0.011, so its test was not judged. Its first run is judged again."
  That is true. The lead's belief is verified.
- Round 1 itself was hollow. One decision, with only complete offered, so it could change nothing, yet it still
  appended `s6` and spent about 20 s testing.

### Q5 — cost per call

Step logs, `meta.json` `costUsd`:

| Phase | Calls | Cost | Input tokens | Steps |
| --- | --- | --- | --- | --- |
| Build: chat interpreter | 1 | $0.000271 | 1,446 | 0001 |
| Build: exploration round 0 | 32 | $0.087053 | 596,732 | 0003–0066 (decisions) |
| Build: consequence reading | 1 | $0.000341 | 2,026 | 0029 |
| Build: judge of round 0's test | 2 | $0.001472 | 6,260 | 0073, 0074 |
| Build: repair round 1 | 1 | $0.002299 | 11,519 | 0076 |
| **Build total** | **37** | **$0.091435** | | |
| Run: result verification | 2 | $0.001473 | 6,980 | 0084, 0085 |
| Run: re-author explore round | 4 | $0.009706 | 52,873 | 0087, 0089, 0090, 0091 |
| Run: re-author repair round | 4 | $0.007916 | 54,186 | 0093, 0095, 0096, 0097 |
| Run: diagnosis | 1 | $0.002964 | 8,855 | 0098 |
| Run: runtime patch | 1 | $0.002936 | 9,488 | 0099 |
| **Run's own recovery** | **12** | **$0.024996** | | |
| **All** | **49** | **$0.116431** | | |

Reconciliation:

- Core's build figure is $0.091164 for 37 calls (`events.ndjson` seq 17). That equals the step-log build total minus
  the chat call ($0.000271).
- The event's `runTotal` is 41 calls and $0.116160, with `uncountedPhases: ["reauthor"]`. Its cost includes the
  re-author's $0.017622, but its call count omits those 8 calls.
- The re-author's own purse (`decision-trace.json`) is `{limitUsd 0.1, spentUsd 0.023523, averagedCalls 10}`. That is
  the re-author plus 0098 and 0099.
- The 12 refused reads and the decisions spent re-asking them (0019–0026, 0038–0042, 0052–0056) cost about $0.031,
  roughly a third of the build.
- The Flow's creation through its first run spent $0.1164 against a "$0.10 per Flow" ceiling, because the run's
  recovery draws on a second $0.10 purse.

### UI review (screenshots)

- 00003: the chat sends the instruction while the consent dialog covers the page. Fine.
- 00005, 00008, 00011, 00012: every build card is titled with its kind and "the page" ("Click · the page", "Read list ·
  the page", "Action · the page"), never the control or the list. The run's cards do name it ("Click · Confirm",
  00019).
- 00011: two "Read list · the page — Done" cards are reads Core refused as `evidence_not_json`. **The chat says Done
  where the model was told the call failed.**
- 00008: "Read list — Didn't work: the step wasn't accepted" for `output_not_observed`. It does not say that the field
  `mutual` was missing.
- 00015, 00016:
  - Test cards show "Decline optional cookies — Didn't work: it didn't work the same way again" and the same for
    "Close chat" and "Confirm", in red, for `core.replay.remembered`. Core's own words call that fine ("the step stays
    in the Flow").
  - A bare "Test run · Passed" card opens the round's test.
  - Then "Judging the Flow" → "Test run · Didn't pass" (round 0), and the honest "Flow not verified" note quoted in Q4.
- 00014: the repair is announced as "Repairing the Flow … Repairing it live" with "Open page — Working on it". That is
  the appended `s6` opening, shown as repair work.
- 00021, 00023: "Deciding the step can't be repaired — The failed step is the final browser-navigate back to the feed
  …" exposes internals (`repairCandidates status action_not_repairable, failedTargetUnknown true, empty
  repairParameters`) and blames a step that did not fail. It ends "Run failed" with no plain statement of what was
  wrong. The site's own chat popup partly covers the feed behind the panel.
- Site state (00011 → 00015): Tom (1 mutual) and Priya (4 mutual) show "Request accepted" after the build. The build
  acted on people the instruction said to leave alone.

## Causes

| # | Cause, precisely | Repo and file | Fix | Owner |
| --- | --- | --- | --- | --- |
| C1 | **Every successful list read is refused as `evidence_not_json`.** F42 puts the same row objects in `read.firstRows` and `read.extracted`; Core's evidence check treats a shared object as a cycle. 12 of 12 successful reads in this run; the model was told they failed with no evidence, no listing was ever kept, every `repeat` was refused. By construction this hits every read that returns at least one row, in every build since `01082bc9`. | Core `R/llm/evidence-loop-decision.ts:506-513` (check), `:122` (refusal); downstream `domain/src/runtime/llm-evidence/node-run/shown-rows/account.ts:53` | Core: make `isJsonValue` an ancestor check (`seen.delete(value)` after the children, as `R/llm/harness/json-bounds.ts:35-46` does), or import that one. Test: a tool execution whose `evidence` holds one row object twice parses. Same latent defect in `R/flow-bootstrap/plan/json-guards.ts:14-21`. Domain, belt and braces: `firstRows` = copies (`structuredClone(rows.slice(0, N))`), with a test that runs the read outcome through Core's tool-execution parser. | lane C (F42) |
| C2 | **Structure fields carry no meaning on an atomic-CSS site.** All 7 fields of `extraction.2` and `extraction.4` were labelled `div.x0531l50… > div.x1507i5…`, with no example. The model chose the Confirm-button column as `mutual` and kept it after its own read (0041) showed `mutual4: "1 mutual friend"`. | downstream `domain/src/runtime/llm-evidence/structure/packet.ts:246-254` (`shownField`) and the page's detection label source (`apps/extension/src/content/extraction/`) | Give each shown field the page-view handle of its element in the first item (for example `at: "t755"`). The page view already prints that handle's words, so no value or selector is added (D3 holds), and the model can read which column says "1 mutual friend". | lane C |
| C3 | **A continuation round adds its opening navigation to the Flow.** `opening` is sent with `add: true` on every round, after the draft was seeded with the earlier rounds' steps. Round 1 appended `s6` navigate `~/`. That moved the run off the requests page (`finalState` failed), made `s6` the node the refutation named, and put the re-author on a page without the requests link. It contradicts the round's own "The page is where the test left it: look first." | Core `R/llm/evidence-loop.ts:528-536` (with `:189`, `:595-600`) | When `input.draft?.resume` is present, run no opening (look where the test left the page), or at least send it with `add: false`. Test: a resumed draft of n steps is still n steps after the round's first look. | Core loop (supervisor to assign) |
| C4 | **A refuted result is filed as a failure of the last succeeded node.** The diagnosis, the chat, the Lab's actions table and the runtime patch all spoke about "the final browser-navigate" that succeeded. | Core `R/recovery/refuted-result/attempt.ts:155-158` (and 80-128); downstream `packages/test-runner/src/flow-lane/persisted-flow-run.ts:592-596` | Core: when the judgement's finding is a missing producer (no record set, `recordProducerPresent: false`), name no node and send the refutation only to the re-author, never to the node-patch rung. Lab: report an attempt whose id starts `result-verification.` as `kind: "result_verification"`, not as an action of the node's type. | Core recovery; Lab (test-runner) |
| C5 | **The patch rung runs after the re-author failed, on a fix it cannot express**, and answers with a wrong reason (`control_gone`). | Core `R/recovery/refuted-result/repair.ts` (ladder order after `reauthor.ts`) | Skip diagnosis and `runtime_patch` when the refutation's fix is structural and the re-author already ran; or add a `structural_change_needed` no-repair reason so the record says what happened. | Core recovery |
| C6 | **The model re-pointed the act step to the next remaining Confirm** (0049 `t757` Tom, 0061 `t781` Priya), with lasting effects on two wrong people during the build. The page view showed each one's mutual count on the line above. | model; the opportunity comes from C1 and C2 | None in code beyond C1 and C2. Without them the listing would have been kept and the press repeated over its kept rows. Note it as a build that acted against the instruction. | model |
| C7 | **The judge's reply allowance is 8,000 tokens**, so its purse hold is $0.011 for a call that costs $0.0005–$0.0009. Round 1's test went unjudged with $0.009 left. | Core `R/llm/harness/token-limits.ts:43`; the build-test judge passes no limits (`R/result-verification/build-test/judge.ts:101-113`) | Add a judge reply cap derived like the decision cap (largest observed judge reply here 412 tokens, so 2,000 is ample) and pass it as `tokenLimits` from the build-test judge. Also do not open a repair round the purse cannot fund for one decision plus a judge (`R/flow-bootstrap/unfinished-build/phases.ts:253`, `:274-275`). | Core purse (t234 owner) |
| C8 | **The re-author refused the Flow's own step-3 address.** The opening forgets the last build's shown addresses, and a draft step's address does not count. Each round then spent 3 decisions on refused repeats, and the second round repeated the first exactly. | downstream `domain/src/runtime/llm-evidence/node-run/shown-addresses.ts:39-40`, `:99-101`; `node-run/run.ts:359` | Count addresses held by the draft's kept steps as shown, since they passed this rule when they first ran. The wider removal of `address_not_shown` is waiting on the user's permission decision. A re-author round that ended on `repeat_refused` with the page and draft unchanged must not start a second identical round (`R/recovery/refuted-result/reauthor.ts`). | domain (lane B, repeat guard); Core recovery |
| C9 | **The build's popup dismissals are fixed steps in build order** (`s2`, `s4`). In playback Core resolved neither target (`unresolved_no_candidates`), and the host pressed scored candidates at 0.703 and 0.737. A Flow run should route by page state. | runtime | Named for **lane A** (absent popups at runtime); not specified here. | lane A |
| C10 | **The build ran out of decisions at 32** (`decisionsLeft 1` at 0066), with about a third of its money spent re-asking reads C1 refused. | consequence of C1 | Fixed by C1. | — |

## Instrumentation gaps found

| Stage | What could not be answered | File that drops it |
| --- | --- | --- |
| 2 | The step folder records the domain's tool value and `resultCode: web.inspect.succeeded`. What the loop recorded instead (`evidence_not_json`) is visible only in the next request. | Core `R/llm/step-log/tool-step.ts:26-78` (logs before the loop's parse); add the parse verdict (`automationStudioLlmEvidenceToolResultInvalidCode`) to `meta.json` |
| 4 | The actions table counts the synthetic verification attempt as a failed `web.browser.navigate`. | downstream `packages/test-runner/src/flow-lane/persisted-flow-run.ts:592-596` |
| 4 | Whether `s2` and `s4` pressed the banner and chat close, or something else, in playback. | NO EVIDENCE: no per-step screenshot of the run's own playback |
| 6 | Round 1's `not_judged` verdict appears only in the chat, not in `flow-lane.json` or `live-llm.json`. | Lab flow-lane build snapshot |
| cost | `runTotal.calls` omits the re-author's 8 calls while its cost includes them; the build's Core figure omits the chat interpreter's cost but counts the call. | Core run-total accounting (the `runtime.settle` event) |
| 2 | 0029 (the consequence reading) is logged as `taskKind: evidence_tool_decision`, `phase: explore`, `iteration: 1`, which cannot be told from a decision. | Core step-log meta for the consequence task |
| 1 | The run's command line. | `run.json` writer |
