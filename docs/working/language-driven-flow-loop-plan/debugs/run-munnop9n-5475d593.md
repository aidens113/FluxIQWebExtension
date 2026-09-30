# Run debug — `run-munnop9n-5475d593` (lane D, control flow)

Worker t195-w1, 2026-09-30. Read from the bundle at
`test-runs/instances/t195-slot-4/run-munnop9n-5475d593` in the t195 worktree, the Lab's full
stdout and the six headed-window screenshots `t195-shots/*-r2-*.png` (both in the supervisor's
scratchpad, not in the repository). No product code changed. The Core and facility files cited
below were last written before the run's build (Core sources 05:17:25Z, facility sources
05:07:30Z, run build 05:17:56Z), so the line numbers are the ones the run executed.

Privacy: this file carries codes, counts, ids, node ids, durations, timestamps and the
accessible names of controls. It has no page text beyond what `extraction-mismatches.json`
publishes, no URLs, no selectors and no provider bodies. Stage 1 is the supervisor's text,
copied verbatim as the brief requires. When a card is named, it is named by its 0-based list
index and by stage 1's own fixture facts.

---

## Header

- Run id: `run-munnop9n-5475d593`.
- Scenario / variant / task: `social-network-feed` / none / `social-network-feed-confirm-requests`
  (`navigate-and-extract`, workflow `confirm-requests`, judged by expected dataset
  `extract-confirmed`, step index 20). Instruction: 339 characters, sha256 `6c11d20a…c37f8d3`
  (`flow-lane.json` `task`).
- Repositories (`run.json`): facility `defcbe2` (dirty), Core `f0dbbd6` (dirty). Chromium
  134.0.6998.35, 1280×720, instance `t195-slot-4`, `live panel: side-panel (verified open)` (Lab
  stdout), `snapshots/live-panel.json` = side-panel.
- Command: NO EVIDENCE. Neither `run.json` nor the Lab stdout records the command line.
- Time span: Lab 05:19:45.905Z to 05:26:09.082Z (`summary.json`). The prelude rebuilt
  domain:host-build, domain:build, extension:build and test-runner:build (84.8 s). The build
  loop ran 05:22:53.580Z to 05:25:27.697Z (`build.durationMs` 158,944). Playback ran
  05:25:34.552Z to 05:25:49.111Z. The repair loop ran 05:25:53.605Z to about 05:26:06.855Z
  (`events.ndjson` seq 3).
- Provider, model: DeepSeek `deepseek-flash`, profile `production`, key from
  `DEEPSEEK_API_KEY` in the process environment (`live-llm.json`). Authorized limits:
  `maxCalls` 48, 48,000 input / 8,000 output tokens per call, $0.25 per call, $2 total.
- Calls, tokens, cost: **41 calls.**
  - Build: 34 calls = 33 loop decisions + 1 additional call. 456,407 input tokens, 3,854 output
    tokens, $0.0540. `observedCalls` has 32 per-call rows and `unrecordedCalls: 2`. The two
    without a row fit iteration 2 (the unusable reply, which has no `usage` on its step row)
    and the additional call.
  - Repair: 7 calls. 91,545 input tokens, 9,101 output tokens, $0.0928. Of that, **48,000 /
    8,000 / $0.0833 is a `reserved` ceiling charge** for the failed `runtime_patch` call,
    not reported usage (`decision-trace.json` `providerCalls[6].charged.tokens = "reserved"`).
  - `budgetBreaches: 0` in both ledgers.
- Verdict as reported: failed, `runtime.behavior`. The Flow reported `output_not_observed` /
  `core.result.required_values_missing` (`evaluation.json`, `events.ndjson` seq 4). Oracles:
  `records: failed`, `finalState: held` (`flow-lane.json` `oracles`). `finalState` holds only
  because the page ended on the requests path (see cause 12).
- **Stage reached: 6.** A Flow was proposed, applied, replayed and answered. The system judged
  the answer, ran a diagnosis, an exploration and a patch attempt, and the patch attempt
  failed.

## Stage 1 — the instruction and the expected chain (written 05:12Z, before reading run output)

- Instruction: `social-network-feed-confirm-requests` (`apps/scenario-lab/src/scenarios/social-network-feed/live-tasks.ts` CONFIRM_REQUESTS): confirm every friend request with at least five mutual friends, leave the rest, then a table name / mutualFriends of every request the list now shows as accepted, in list order, mutualFriends verbatim.
- Site facts (`content/requests.ts`, `client/requests-script.ts`): 8 requests; the Friends home shows only 4 behind a "See all", and the badge is stale at 4. Qualifying: amara-osei ("23 mutual friends"), jonas-weber ("Aisha Khan and 4 other mutual friends" = 5), lin-zhao ("11"), freya-holm ("5"). Not: tom.becker.9 (1), priya-nair (4, one short), diego-alvarez (no line), marta-kowalczyk (3). Confirm is rate limited to 3 per 15 s: the 4th press opens a "You're going too fast" alertdialog with a countdown; OK confirms nothing; "Try again" appears at 0 and confirms the refused request.
- Expected chain:
  1. Navigate to `friends/requests/` (all 8 cards), not the 4-card Friends home.
  2. A loop over request cards (or four explicit presses): read the mutual line, route on count >= 5 (the "X and 4 other" form counts as 5), press Confirm only on a qualifying card; skip the others without Delete.
  3. The fourth Confirm meets the rate limit: the Flow must wait out the countdown and press "Try again" (or OK, wait, press Confirm again) -- a mid-loop retry, not a failure and not a skipped card.
  4. Extract the accepted cards (status "Request accepted"): name and the verbatim mutual line, list order: Amara Osei, Jonas Weber, Lin Zhao, Freya Holm.
- A wrong answer that looks right: 3 rows (the 4th confirm refused silently and the run moved on); Priya Nair confirmed (4 read as >=5 or "Aisha Khan and 4 other" miscounted either way); only the 4 home cards considered; mutualFriends normalised to a number; a Delete pressed on a non-qualifying card.

## Stage 2 — exploration

The table joins the `[FluxIQ build-trace]` lines in `logs/core.log` with `flow-lane.json`
`build.evidenceLoop.steps[]` by iteration. Draft step ids `dN` number the executed tool calls in
order, counting Core's initial call as `d1`. The numbering is checked three ways: `rerun.N`
reruns `dN`, `draftChange.rerunStepId` names the step being replaced, and every dry run replays
`d2, d6, d7, d9, d19` (plus `d21` in dry runs 3 and 4).

| It | What it was asked | What it decided | Action and parameters | Result |
| --- | --- | --- | --- | --- |
| 0 | (Core's free first look) | – | `initial.core.run_node`, `dom-capture_snapshot` (d1) | `web.action.rejected.not_at_start_location` / `start_location_not_reached`, 1021 ms |
| 1 | decide (1301 ms) | tool_call | `nav1`, `browser-navigate` (d2) | `web.action.succeeded`, 3526 ms, kept |
| 2 | decide (1629 ms) | **unusable** | – | `AutomationStudioLlmUnusableDecisionError`, step code `llm_output.invalid_evidence_decision` (Q7) |
| 3 | decide | tool_call | `dismiss-cookies-1`, `dom-click` (d3) | `target_unobserved` / `target_not_a_handle`, 138 ms |
| 4 | decide | tool_call | `dismiss-cookies-2`, `dom-click` (d4) | `target_unobserved` / `answered_the_same_again`, 155 ms |
| 5 | decide | tool_call | `snap-dialog-1`, `dom-capture_snapshot` (d5) | `web.inspect.succeeded` |
| 6 | decide | tool_call | `dismiss-cookies-3`, `dom-click` `Decline optional cookies` (d6) | succeeded, page changed, kept |
| 7 | decide | tool_call | `nav-friends-1`, `browser-navigate` (d7) | succeeded, kept |
| 8 | decide | tool_call | `detect-requests-1`, `web.detect_repeating_structure` (d8) | `web.structure.detected` |
| 9 | decide | tool_call | `nav-requests-1`, `browser-navigate` (d9) | succeeded, kept |
| 10 | decide | tool_call | `detect-requests-2`, detect (d10) | detected |
| 11 | decide (1950 ms) | tool_call | `extract-requests-1`, `dom-extract_list` (d11) | `web.inspect.succeeded`, 7,601 B, kept (kept = 5) |
| 12 | decide | amend_draft **rerun d11** | `rerun.11` → d12 | inspect succeeded, 8,563 B, page unchanged |
| 13 | decide | amend_draft on d11 | – | `draft_unchanged` (1 refused: d11 was already replaced) |
| 14 | decide | amend_draft **rerun d12** | `rerun.12` → d13 | 8,563 B, page unchanged |
| 15 | decide | amend_draft **rerun d13** | `rerun.13` → d14 | 8,563 B, page unchanged |
| 16 | decide | amend_draft on d14 | – | `draft_amended`, kept 5 → 4 (withdrew the current extraction) |
| 17 | decide | amend_draft on d11–d14 | – | `draft_unchanged` (4 refused) |
| 18 | decide | amend_draft on d14 | – | `draft_amendment_undone`, kept 4 → 5 (put it back) |
| 19 | decide | amend_draft on d11–d13 | – | `draft_unchanged` (3 refused) |
| 20 | decide | amend_draft **rerun d14** | `rerun.14` → d15 | 8,563 B, page unchanged |
| 21 | decide | amend_draft on d15 | – | `draft_unchanged` (1 refused) |
| 22 | decide | amend_draft **rerun d15** | `rerun.15` → d16 | 8,563 B, page unchanged |
| 23 | decide | amend_draft **rerun d16** | `rerun.16` → d17 | 8,563 B, page unchanged |
| 24 | decide | amend_draft **rerun d17** | `rerun.17` → d18 | 8,563 B, page unchanged |
| 25 | decide | amend_draft **rerun d18** | `rerun.18` → d19 | 8,563 B, page unchanged. **d19 is the extraction the Flow ships.** |
| 26 | decide | amend_draft on d19 | – | `draft_unchanged` (1 refused) |
| **27** | decide | **complete #1** | – | **refused `bootstrap.instructed_act_missing`**. The draft had no Confirm. Dry run 1: reset, d2, **d6 `unreproducible` (6466 ms)**, d7, d9, d19 replayed |
| 28 | decide | tool_call | `confirm-request-1`, `dom-click` (d20) | **`target_unobserved` / `target_not_a_handle`, 58 ms, 217 B, `effectApplied: false`** (Q3) |
| **29** | decide | **complete #2** | – | **refused `bootstrap.instructed_act_missing`**. Dry run 2 is the same as dry run 1 (d6 unreproducible) |
| 30 | decide | tool_call | `confirm-request-2`, `dom-click` `Confirm`, `listPosition {index 1, total 8}` (d21) | **`web.action.succeeded`, 2692 ms, page changed**, declared `modify_existing` |
| **31** | decide | **complete #3** | – | **completion check `ok=true`**. Dry run 3: d6 unreproducible, **d21 `core.replay.failed` (2123 ms)** → `llm_evidence_loop.dry_run_refused` |
| 32 | decide | amend_draft on **d6 and d21** | – | `draft_amended`, 2 applied, kept = 6. The Flow's Merge nodes `s3` (after s2 = d6) and `s8` (after s7 = d21) show this was **`optional`** on both (Q1) |
| **33** | decide | **complete #4** | – | completion check `ok=true`. Dry run 4: d6 unreproducible and **d21 `failed` again**, both now conditional, so non-blocking. Proposed. |

Totals: 33 decisions = 12 tool_call + 16 amend_draft (8 `draft_rerun`, 2 `draft_amended`,
1 `draft_amendment_undone`, 5 `draft_unchanged`) + 4 complete + 1 unusable. There were 21 tool
calls: the initial call, 12 decisions and 8 reruns. 4 dry runs. The loop ended at iteration 33
of the 64 allowed.

- **Repeats, and what the loop believed was progress (Q2).** Iterations 12–26 are 15
  consecutive `amend_draft` decisions on one step, the list extraction.
  - **8 were `rerun`.** Each ran the extraction again with a new argument and replaced the
    step: d11 → d12 → … → d19.
  - **5 were `draft_unchanged`.** Each targeted an id a rerun had already replaced (d11, d11–d14,
    d11–d13, d15, d19). Those ids appear in `targetedStepIds` with `appliedCount: 0`.
  - **1 withdrew the current extraction** (16) and **1 put it back** (18,
    `draft_amendment_undone`).
  - What each rerun's argument changed: **NO EVIDENCE.** The trace records only the target ids
    and counts, and the step rows withhold the input. What is known: every one of the 8 reruns
    answered **8,563 bytes with `pageState: unchanged`**, and the shipped extraction (d19 = s6)
    has **no `where`, no `item` other than one withheld handle, `minItems: 0` and
    `recordOutput: null`** (`flow-lane.json` `authoredNodes[4]`). So whatever the eight
    arguments tried, none left a row filter or moved the read after a Confirm.
  - **Why the loop counted it as progress.**
    - A rerun is never a no-progress step at the amendment stage. `amendment.ts:95` only counts
      `!rerun.request`.
    - The rerun's call is exempt from the repeat check. `evidence-loop.ts:559` tests
      `!rerunning`.
    - The row is written `draftState: changed` because `amendment.ts:86` sets
      `draftChanged: Boolean(amended.applied || rerun.request)`. The loop does not consult
      `pageState: unchanged`.
    - The only thing that could still flag a rerun is `no-progress.ts:146`: the answer string
      being byte-identical to the previous `core.run_node` answer.
    - Counting under the default stop of 8
      (`loop-limits/evidence-loop.ts` `AUTOMATION_STUDIO_LLM_EVIDENCE_LOOP_DEFAULT_MAX_STEPS_WITHOUT_PROGRESS`):
      identical rerun answers plus the 5 unchanged and 1 undone amendments would have reached
      8 at iteration 21 and ended the build. It did not end. So either the eight equal-length
      answers differed in content, or this build ran with a higher limit. The bundle cannot
      tell which: the answer bodies and the configured limit are not recorded.
- **Rejections and refusals received, and whether each said enough to route around.**
  - `target_not_a_handle` at 3 and 28. Both are the domain's "you named no handle"
    (`domain/src/runtime/llm-evidence/node-run/run.ts:258-262`, telling the model
    `target: {"handle": "target.N"}`). The model routed around both: a snapshot and then a
    handle click at 5–6, and a handle click at 30.
  - `answered_the_same_again` at 4.
  - `instructed_act_missing` at 27 and 29. This refusal made the model act at all.
  - `dry_run_refused` at 31. It was answered by marking the failing Confirm `optional`, which
    `flow-draft/dry-run.ts:212` invites.
- **Where the context was evicted or truncated.**
  - The draft entry reached its 4,000-byte budget at 21 (3,998 B).
  - Its own guidance was told shorter. `draft.instructionBytes` went 1,052 → 618 at 16 (the
    brief telling, `flow-draft/entry.ts:56`) and → 154 at 23 (the minimal telling,
    `entry.ts:57`). From 23 onward the draft entry names no amendment word at all.
  - From 24 onward the oldest steps' arguments were withheld: `withoutInput` 3, 6, 8, 9 and 10
    by 33.
  - What the model was shown of the evidence window (`draftShown`) is NO EVIDENCE: it is not in
    the bundle.

### Screenshots of the headed window (`t195-shots/*-r2-*.png`)

Six shots, one every 30 s, from 05:22:53 to 05:25:36. The first five were taken during the build
and the last one at the start of playback. None was taken after 05:25:36, so the repair was not
captured. **In every shot the side panel is open** (`FluxIQ Web Automation Client (E2E)`,
Simple mode, "Connected to FluxIQ") and **no on-page FluxIQ status overlay is visible**. The
panel covers the right-hand column of the page's card grid.

| Shot | Loop at that moment | Page | Panel "RIGHT NOW" |
| --- | --- | --- | --- |
| 05:22:53 start | loop start / initial look | blank tab | "FluxIQ is working", "Looking at the page" |
| 05:23:30 t1 | decide 12 in flight | requests page, dimmed under a **notifications-permission dialog** (buttons `Not now`, `Turn on`) | **"Done"**, "Last step: Looked at the page", shown **while the build was still running** |
| 05:24:03 t2 | `rerun.17` | the same, with the dialog still up | "FluxIQ is working", "Looking at the page" |
| 05:24:34 t3 | dry run 2, step d6 | home page under the same notifications dialog; **no cookie dialog**, which is why d6 is `unreproducible` | "Clicking "Decline optional cookies"" |
| 05:25:05 t4 | dry run 3, d21 (started 05:25:05.508) | requests page, no dialog. **The card at list index 0 shows the accepted state** (a `Message` button where the others show `Confirm` / `Delete`). A chat popup is partly visible behind the panel's edge. | "Clicking "Confirm"" |
| 05:25:36 t5 | playback s1 | home page under a **cookie-consent dialog** (`Decline optional cookies`, `Allow all cookies`), so the site started from a fresh state | "Opening a page" |

In every shot the panel's set-up card shows **"Add an AI model key — To do"**, while Core was
spending a DeepSeek key from its process environment. The build never dismissed the
notifications dialog. No call names `Not now`.

## Stage 3 — the proposed Flow

- Completion checks (`logs/core.log`): #1 at 05:24:11.407Z and #2 at 05:24:30.161Z were refused
  `bootstrap.instructed_act_missing`. #3 at 05:24:51.301Z and #4 at 05:25:11.408Z were
  accepted. #3 was then refused by its dry run, not by the check.
- Consequence cross-check: `agreed` (declared `modify_existing` = instructed `modify_existing`).
  Only `confirm-request-2` / `main.s6|s7` carry the consequence.
- **Node list as authored** (`flow-lane.json` `authoredNodes`, `flowShape`: 8 nodes, 6 action
  nodes):
  1. `main.s1` `web.browser.navigate` (url withheld, `newTab: false`), from d2.
  2. `main.s2` `web.dom.click` on `div` role `button` `Decline optional cookies`
     (`timeoutMs` 10000, selector withheld), from d6, **`optional`**.
  3. `main.s3` `builtin.control.merge`, the join `draft-routing.ts:103-107` derives for an
     optional step.
  4. `main.s4` `web.browser.navigate` (url withheld), from d7.
  5. `main.s5` `web.browser.navigate` (url withheld), from d9.
  6. `main.s6` `web.dom.extract_list`: `item` withheld (one handle), fields `name` and
     `mutualFriends` (both `kind: text`, `required: true`), `minItems: 0`, `recordOutput: null`,
     **no `where`**. From d19.
  7. `main.s7` `web.dom.click` on `div` role `button` `Confirm`, **`listPosition {index: 1,
     total: 8}`**, from d21, **`optional`**.
  8. `main.s8` `builtin.control.merge`, the join for s7.
- **No `repeat`, no `only_if`, no `on_failed`.** Route: `fallbackUsed: true`, no rule, no state
  observed.
- **Divergences from the stage 1 chain.**
  - Chain 1 (reach all 8 cards): **met**. s4 then s5, and the playback read found 8 items.
  - Chain 2 (loop over the cards, route on the count, Confirm only qualifying cards):
    **absent**. There is one Confirm on one fixed card and no loop or condition. **The
    `listPosition` index is 1-based** (`apps/extension/src/content/identity/context.ts:230`,
    `index + 1`), so s7 targets **the first card, list index 0**. Per stage 1 that is the
    non-qualifying request with 1 mutual friend. Screenshot t4 shows exactly that card
    accepted.
  - Chain 3 (rate-limit wait and retry): **absent**. A single press never meets the limit.
  - Chain 4 (extract the accepted cards after confirming): **wrong order and no filter**. The
    extraction s6 runs **before** the Confirm s7, so it cannot see any confirmation. It has no
    `where`, so it reads every card.
  - Extra: the only mutating act, s7, is `optional`, so a Confirm that fails is not a Flow
    failure.
- **Classification of each divergence.**
  - Chain 2 **could not express it (as told)**. See Q1: the loop and condition grammar exists
    in Core but is described only inside the `amend_draft` schema's enum text. The standing
    instruction tells the model not to repeat a successful mutation.
  - Chain 4 **misread the grammar.** The draft's order is the Flow's order
    (`flow-draft/entry.ts:43`) and `reorder` was available, but the model built the read first
    (11–26) and appended the press after it (30).
  - s7 `optional` **followed Core's own advice for a failed replay** (`flow-draft/dry-run.ts:212`).

### Q1 — did the model ever state a routing relation, and was routing shown to it?

- **It stated one kind, once:** `optional`, on d6 (the cookie dismissal) and d21 (the Confirm),
  in the single amendment at iteration 32. The evidence is `flow-lane.json` `authoredNodes` plus
  `actions` (`builtin.control.merge` nodes `s3` and `s8` directly after s2 and s7), read with
  `draft-routing.ts:103-107`, which emits exactly one Merge after an `optional` step. The same
  pair appears in `declaredConsequences`: plan #4 has lost `main.s3` as a declared step. It
  **never stated `repeat`, `only_if` or `on_failed`**. It tried a Confirm at 28 and 30, extracted
  at 11, and reran the extraction 8 times (12–25). Nothing it did evaluated the mutual count
  per card.
- **Was routing shown to it?** The prompts themselves are NO EVIDENCE: the bundle records no
  decision instruction or schema. By the code this run executed:
  - **The standing decision instruction** (`runtime/llm/evidence-loop-decision.ts:44`,
    `AUTOMATION_STUDIO_LLM_EVIDENCE_DECISION_INSTRUCTION`) says nothing about loops or
    conditions. It says: "Never mutate merely to perform an eventual workflow step that
    belongs in the generated result, and never repeat a successful mutation merely to try
    another eventual-workflow value."
  - **The draft entry's guidance** (`runtime/flow-draft/entry.ts:43`, `:56` brief, `:57`
    minimal) names only `drop`, `exploratory`, `reorder` and `rerun`, and then only
    "amend_draft". It says "A step you want and have not run yet is run, not written".
  - **The only place the four routing words are described is the `change` enum description
    of `AUTOMATION_STUDIO_FLOW_DRAFT_AMENDMENT_SCHEMA`, at
    `runtime/flow-draft/amendment.ts:107`**, which also defines `check`, `through` and `over`
    at `:112-114`. **That line decides what the model is told about routing.** It reaches the
    model only as the `amend_draft` variant of the decision schema
    (`runtime/llm/evidence-loop-decision.ts:175`), offered when `canAmend` is true
    (`runtime/llm/evidence-loop.ts:490-491`: drafting, not the final decision, amendment
    allowance left, a proposable step).
  - `runtime/flow-draft/dry-run.ts:212` adds `optional` and `only_if` (not `repeat`), and only
    inside a refused dry run's feedback.
  - `runtime/llm/harness-options/binding.ts:90-94` records the design intent that control
    flow is "authored as a routing word on steps it has already run" and is not offered as a
    runnable node.
  - Nothing tells the model that "every X that satisfies Y" is `repeat` over an extraction's
    rows with a per-row check. `only_if` routes on a step's success, and no per-row predicate
    step was run, so there was nothing for an `only_if` to name.

## Stage 4 — replay

Playback, run `40e24b86-…` (`flow-lane.json` `actions`, times from `startedAt`):

| Node | Executed | Produced | Duration | Retries | Rung that absorbed |
| --- | --- | --- | --- | --- | --- |
| `main.s1` navigate | 05:25:34.552 | succeeded, `comparisonStatus: matched` | 2294 ms | 0 | – |
| `main.s2` click `Decline optional cookies` | 05:25:37.990 | succeeded. `targetResolution: unresolved_no_candidates`, host resolution `selector`, 1 candidate, score 0.703, confidence 0.619 | 558 ms | 0 | – (the optional join was not needed) |
| `main.s3` merge | 05:25:39.667 | succeeded | 0 ms | 0 | – |
| `main.s4` navigate | 05:25:39.668 | succeeded | 1367 ms | 0 | – |
| `main.s5` navigate | 05:25:42.095 | succeeded | 1300 ms | 0 | – |
| `main.s6` extract_list | 05:25:44.459 | succeeded: **8 records**, 1 page, `itemsSeen: 8`, `emptyRecords: 0`, list appeared after 918 ms | 1939 ms | 0 | – |
| `main.s7` click `Confirm` (index 1 of 8, 1-based) | 05:25:47.460 | succeeded. Same resolution pattern as s2: host `selector`, 1 candidate, 0.703 / 0.619 | 615 ms | 0 | – |
| `main.s8` merge | 05:25:49.110 | succeeded | 0 ms | 0 | – |
| `main.s6` (verification, attempt 8) | 05:25:46.398 → 05:25:49.111 | **failed `core.result.required_values_missing`** (stage `verification`): "1 of 8 rows checked, of 8 stored, has no value for a required field (mutualFriends)" | 2713 ms | – | none; went to the failure entry point |

- **Any node that reported success while doing nothing useful.**
  - `main.s7` "succeeded", but which card it pressed in playback is NO EVIDENCE: the only read
    ran before it, and no screenshot was taken after 05:25:36. By its 1-based index its
    target is list index 0, which does not qualify.
  - `main.s6` "succeeded" with every card, before any confirmation.
  - Neither optional join was exercised.
- The four build dry runs, for reference.
  - `d6` was `core.replay.unreproducible` every time (6.4 s). After the reset the site
    remembered its cookie consent, and the notifications dialog took the banner's place (t3).
  - `d21` was `core.replay.failed` in dry runs 3 and 4 (2123 ms and 2118 ms). The failure's own
    code is NO EVIDENCE: the trace prints only `core.replay.failed`. One consistent reading:
    the dry-run reset does not undo a confirmation, so the first card no longer offered
    `Confirm` (t4 shows it accepted during dry run 3). The other reading is that the replay's
    own press accepted it. The shot's timing, "Clicking Confirm" with the dry run starting at
    05:25:05.508, cannot separate the two.
- Provider calls during replay: **0** (`live-llm.json` `verification.calls: 0`). The 7 repair
  calls came after the run failed.

## Stage 5 — the answer

- Records expected vs returned: **4 expected, 8 returned** (`evaluation.json` `extraction[0]`,
  `extraction-mismatches.json`).
- Fields compared, matched, mismatched:
  - `expectedFields` 8 and `presentFields` 8, with 0 unexpected fields, 0 non-string values
    and 0 invalid rows.
  - `comparedRecords` 4, `matchedRecords` 0 in order, **`matchedInAnyOrder` 4**.
  - All four expected rows are present **with the right values**. Their entries in the file
    list no field mismatches (`fields: []`), so the name and the verbatim mutual line matched.
- Every mismatch, observed beside expected (`extraction-mismatches.json` `records`):
  - Expected positions 0, 1, 2 and 3 were observed at positions 1, 3, 5 and 6 (`moved`).
  - Four further observed rows are `observed-not-expected`: observed positions 0, 2, 4 and 7,
    the four non-qualifying cards per stage 1.
  - The file publishes no observed values.
- Why 8 rather than the 4 accepted.
  - s6 has no `where` (`domain/src/actions/extraction/request.ts:324` supports one; absent, "every
    item of the run is a record", `:310-314`).
  - s6 runs **before** s7, so no card could yet be accepted.
  - The read is therefore every request in list order, not the accepted ones. It is not an
    item-target error: `itemsSeen` 8 equals the number of cards.
  - Core's own check then refuted it. The card with no mutual line (stage 1) stored an empty
    `mutualFriends` against `required: true` (`result-verification/core-observation.ts:62`).
- The comparison was field-level, not count-only.

## Stage 6 — judgement and repair

- **Did the system judge its own result?** Yes, deterministically:
  `result-verification/verify.ts:121-122` returns Core's own observation
  (`core-observation.ts:62`, `core.result.required_values_missing`) and **never asks the model
  whether the result answers the request**. The model verdict `core.result.does_not_answer_request`
  (`verdict.ts:116`) was never reached. `resultVerification: refuted`, basis
  `core_observation`.
- **Did a repair trigger automatically?** Yes: `harnessActivations: 2`. `resultRepair` was
  attempted on `main.s6` for `core.result.required_values_missing`.
  1. **Diagnosis** (`runtime_diagnosis`, 6,271 / 466 tokens, validation ok): `failureClass
     output_not_observed`, `candidateKind recovery_path_or_reroute`, `stillAchievable yes`,
     `deterministicRecoveryPossible yes`, exploration and patch needed, confidence 0.72.
  2. **Recovery plan:** explore, then request a patch. The allowed kinds were
     `temporary_reroute`, `temporary_recovery_subflow_call` and `temporary_action_sequence`.
     None of them can reorder s6 after s7 or give s6 a `where`.
  3. **Exploration:** 4 actions, all observed and none refused. The calls were
     `web.recovery.inspect`, `web.recovery.detect_repeating_structure`,
     `web.recovery.press` `gather.close.chat` (a chat popup) and `web.recovery.inspect`. There
     were 5 provider calls, 19,315 bytes of evidence and 9,565 ms, and the loop's iteration 4
     was an `amend_draft`.
  4. **Patch:** the `runtime_patch` call failed **`llm.provider_output_invalid`**, so there were
     0 patch attempts and 0 adaptations.
     - The reply parsed as JSON but failed a structure check for `runtime_patch`
       (`runtime/llm/deepseek/response-envelope.ts:59-72`: not an object; a `no_repair` with an
       unknown reason; a kind other than `runtime_patch`; or a malformed `patches`).
     - It was not truncated: that would be `llm.provider_output_truncated`, `:26-31`.
     - Which of the four checks failed is NO EVIDENCE.
     - The call happened between 05:26:03.169Z and 05:26:06.855Z, so it was not a timeout.
     - The throw at `:43` discards the usage already parsed at `:34-41`, so the call was
       charged its reserved ceiling (48,000 / 8,000 / $0.0833).
- **`resultReauthor` refused `not_a_wrong_answer`.**
  `runtime/recovery/refuted-result/reauthor.ts:84-85` routes to re-authoring only when the
  verification code is `core.result.does_not_answer_request`. This run's code was
  `core.result.required_values_missing`, because the deterministic finding had won at
  `verify.ts:121-122`. The oracle's "wrong answer" (8 rows, a wrong card confirmed) is the
  Lab's expected dataset, which Core never sees. So Core never classified the run as a wrong
  answer, and the one route that could add the missing steps (the build loop in extend mode)
  was closed.
- **What context the repair received** (`evaluation.json`
  `harnessRecovery.contextSections`).
  - Present: `failure` and `flow_graph`, the failure evidence packet (5,096 bytes, truncated)
    and 4 carried exploration packets.
  - **Omitted for `byte_budget`: `step_parameters`, `subflow`, `route_context` and
    `recent_nodes`.** The recovery context has an 8,000-byte budget
    (`runtime/recovery/context.ts:243`) and drops sections lowest priority first
    (`:322-329`). So **the repair was not shown s6's parameters** (the missing `where`), the
    recent nodes, or the route.
  - Absent (nothing to send): `expected_transition`, `actual_transition`, `state_diff`,
    `failed_target`, `recovery_candidates`, `recovered_failures`, `known_adaptations` and
    `recording_context`.
  - The build's conversation and draft history were not part of it.
  - The page as it was when it broke: only as the truncated failure packet.
- **Was the repair persisted, and did the re-run use it?** No. `adaptationIds: []`,
  `changeProposalIds: []` and no re-run. `adaptationPersistence` and `adaptationReuse` are null.

### Q7 — iteration 2 `AutomationStudioLlmUnusableDecisionError`

- The step row's code is `llm_output.invalid_evidence_decision`. Core raises it in exactly two
  places (`runtime/llm/harness/provider-result.ts:146`, "Evidence decision must be an object",
  and `:171`, "Evidence decision kind is unsupported"). So the reply was a real one (1,629 ms),
  but its `decision` was either not an object or a kind other than `tool_call`, `complete` or
  `amend_draft`.
- Which of the two is NO EVIDENCE: the payload is not recorded. The error was built at
  `runtime/llm/unusable-decision.ts:112-116`.
- It cost one decision and no stall: the next decision at 3 was a tool call.
- The build-trace printed `code=- issues=-` for it. `progress-trace.ts:66-67` reads
  `error.diagnostic.issueCodes`, but this error carries `issueCodes` at the top level
  (`unusable-decision.ts:85`). That is an instrumentation gap, not the model's fault.

## Causes

| # | Cause, precisely | Repo and file | Fix | Task id |
| --- | --- | --- | --- | --- |
| 1 | **Routing is described to the model in one place only**: the `change` enum text of the amendment schema. The standing decision instruction, the draft entry's three tellings and the build's refusals do not mention a loop or a condition. Nothing maps "every request with ≥ 5" to `repeat` over the extraction's rows plus a per-row check. The model never wrote `repeat` or `only_if`. | Core `runtime/flow-draft/amendment.ts:107` (the only routing text); `runtime/llm/evidence-loop-decision.ts:44` (instruction, silent); `runtime/flow-draft/entry.ts:43,56,57` (draft guidance, silent) | Say in the decision instruction and the full draft telling that a conditional or per-item instruction is expressed as `repeat` over the step that produced the rows, with the act inside it guarded by a check. Show a one-line example. | open |
| 2 | **The standing instruction forbids the act the Flow needs.** "Never mutate merely to perform an eventual workflow step … never repeat a successful mutation" (`evidence-loop-decision.ts:44`) contradicts the draft's "A step you want and have not run yet is run, not written" (`entry.ts:43`). The model extracted for 26 iterations, pressed Confirm only when `instructed_act_missing` forced it (28, 30), and pressed it once. | Core `runtime/llm/evidence-loop-decision.ts:44`; `runtime/flow-draft/entry.ts:43` | Reconcile the two for drafting builds: an act the Flow must perform is run (once per distinct target, or once inside a `repeat`), not avoided. | open |
| 3 | **The instructed-acts check counts acts, not quantity or condition, and ignores routing.** The instruction yields one `submit` act, `confirm`. Any one kept mutating step satisfies it, and an `optional` step counts as doing it. So a single Confirm on one fixed card passed "confirm everyone with ≥ 5". | Core `runtime/flow-bootstrap/instructed-acts/instruction-acts.ts:82` (one act per verb per sentence, no quantifier); `.../instructed-acts/check.ts:74-87` (one kept mutating step per act) | Read a universal or conditional object ("everyone", "every", "all … with/that") as requiring a `repeat` (or several claimed steps). Refuse a claim whose step is `optional` or `on_failed`-only. | open |
| 4 | **The dry run waved through a failing mutating act once it was marked `optional`.** d21 failed replay in dry runs 3 and 4. The feedback told the model to say `optional`, and conditional steps are exempt from blocking, so the Flow was proposed with its only Confirm unable to replay. | Core `runtime/flow-draft/dry-run.ts:212` (advice), `:163-165` (exemption); `runtime/flow-draft/routing.ts:109-124` (optional = conditional) | Do not exempt a step that carries an instructed act (or any `effect: mutate` consequence) from the dry run because it is `optional`. Limit `optional` advice to dismissals and non-consequential steps. | open |
| 5 | **The Confirm targets a fixed list position (1-based index 1 = the first card)**, not a card chosen by its mutual count. Per stage 1 the first card does not qualify, and screenshot t4 shows it accepted. The step can press only one fixed card, whatever the list holds. | Facility `apps/extension/src/content/identity/context.ts:230` (`index + 1`); the Flow's `main.s7` `listPosition {1, 8}` | Follows from 1 and 3: the press belongs inside a `repeat` over s6's rows with a per-row check. No change to the 1-based convention is proposed. | open (via 1/3) |
| 6 | **The extraction is ordered before the Confirm and unfiltered.** s6 (d19) runs before s7 (d21) and has no `where`, so it returns all 8 requests before any confirmation. One of them has no mutual line, which yields `required_values_missing`. `reorder` was never used. | Flow `main.s6`/`main.s7`; facility `domain/src/actions/extraction/request.ts:310-324` (`where`, absent = every item); Core `result-verification/core-observation.ts:62` | Prompt-side, as 1: "then give me … now shows as accepted" is a read after the acts. The dry run or completion check could flag a record-producing step that precedes the instruction's acts when the instruction orders the read after them. | open |
| 7 | **Fifteen amendment decisions on one extraction were counted as progress.** A `rerun` is never a no-progress step and is exempt from the repeat check. Its row says `draftState: changed` even though every rerun answered 8,563 bytes with `pageState: unchanged`. | Core `runtime/llm/decision-handlers/amendment.ts:86,95`; `runtime/llm/evidence-loop.ts:559`; `runtime/llm/evidence-loop/no-progress.ts:146` | Count a rerun whose page state is unchanged and whose answer has the same size or record count as the step it replaces as a step without progress. Count an amendment refused in full (the 5 `draft_unchanged` here) once per id, not per decision. | open |
| 8 | **A wrong answer never reaches the wrong-answer route.** Core's deterministic `required_values_missing` short-circuits the "does it answer the request" judgement. Re-authoring routes only on `does_not_answer_request`, so it refused `not_a_wrong_answer`. The ladder's patch kinds cannot reorder or filter an extraction. | Core `runtime/result-verification/verify.ts:121-122`; `runtime/recovery/refuted-result/reauthor.ts:84-85` | Route `required_values_missing` (rows that should not be there, or fields pointed at the wrong thing) to the re-author route as well, or run the model verdict after a deterministic refutation that concerns the record set. | open |
| 9 | **The repair was not shown the step it had to fix.** `step_parameters`, `subflow`, `route_context` and `recent_nodes` were dropped for the 8,000-byte budget, so the patch author could not see that s6 has no `where` or that it precedes s7. | Core `runtime/recovery/context.ts:243` (budget), `:322-329` (drop order) | Keep the failing node's own parameters (`step_parameters` for the refuted node) ahead of lower-value sections, or raise the budget for result refutations. | open |
| 10 | **The `runtime_patch` reply was unusable and its cost was booked at the ceiling.** `llm.provider_output_invalid` was raised by one of the four `runtime_patch` structure checks. Usage parsed before the check was discarded, so the call was charged 48,000 / 8,000 tokens and $0.0833 (90% of the repair's cost). | Core `runtime/llm/deepseek/response-envelope.ts:59-72` (checks), `:34-43` (usage discarded on throw) | Return the parsed usage with the structure error so accounting records what was spent. Record which check refused, as a code. | open |
| 11 | **Iteration 2's reply was not a usable decision** (`llm_output.invalid_evidence_decision`: not an object or an unsupported kind). It cost one call. | Core `runtime/llm/harness/provider-result.ts:146,171` | Which shape it was is not recorded (see gaps). If it was a bare `kind` the normaliser does not lift, extend `evidence-loop-decision.ts` normalisation. | open (unconfirmed) |
| 12 | **The Lab's final-state oracle for `confirm-requests` checks only the page path**, so it reported `held` although a non-qualifying request was confirmed and three qualifying ones were not. | Facility `apps/scenario-lab/src/scenarios/social-network-feed/manifest.ts:196`; `packages/test-runner/src/flow-lane/creation/oracles.ts:32` | Declare the accepted set in the final state: the four qualifying cards accepted and the other four still pending. | open |
| 13 | **The panel misreports during a live build.** It shows "Done — Last step: Looked at the page" between steps while the loop is still running (t1), and "Add an AI model key — To do" throughout, although Core was spending a key from its environment. | Facility `apps/extension/src/panel/simple/now-copy.ts:52-54` (per-step `succeeded` shown as Done); `apps/extension/src/panel/simple/start/setup-steps.ts:50-52` (`modelKey === "missing"`) | Show "working" while a build or run is open, not per node. Treat an environment-provided Core key as present. | open (UI, lower priority) |

## Instrumentation gaps found

| Stage | What could not be answered | File that drops it |
| --- | --- | --- |
| 2 | Each `rerun`'s new argument, and whether the 8 reruns' 8,563-byte answers were identical | `flow-lane.json` step rows withhold `input`. Core `runtime/llm/evidence-loop/progress-trace.ts` prints no amendment change word or answer digest. |
| 2 | Which amendment words were used (the `optional` at 32 is inferred from the Merge nodes) | Core `progress-trace.ts` (no `change` per amendment; the change word is code-shaped and safe to print) |
| 2 | The target a refused press named (`confirm-request-1`, and 3/4) | Refused calls are absent from `declaredConsequences`, and the trace carries only code and reason |
| 2 | What the model was shown (decision instruction, schema variants offered, `draftShown`) | not exported to the bundle |
| 2 | Iteration 2's issue codes in the trace (`code=- issues=-`) | Core `runtime/llm/evidence-loop/progress-trace.ts:66-67` reads `diagnostic.issueCodes`; the error carries `issueCodes` (`unusable-decision.ts:85`) |
| 3 | Which act `instructed_act_missing` named at 27/29 and the refusal reason (`no_step_named`, `step_changed_nothing` …) | Core `progress-trace.ts` completion line prints issue codes only (`missingActs[].id/reason` are code-shaped) |
| 4 | Why `d21` failed its replay in dry runs 3 and 4 | trace prints `core.replay.failed` only; the replay outcome's own code is not logged |
| 4 | Which card `main.s7` pressed in playback | no after-run page read; screenshots stop at 05:25:36 |
| 6 | Which `runtime_patch` structure check refused the reply | Core `runtime/llm/deepseek/response-envelope.ts:59-72` throws one shared code |
| 6 | Byte counts of the context sections dropped for `byte_budget` | `evaluation.json` / `flow-lane.json` omit `byteCount` that `recovery/context.ts:327` records |
| header | The Lab command line | `run.json` |
