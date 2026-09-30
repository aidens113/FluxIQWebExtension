# Run debug — `run-munnyvbr-11c28a0f` (lane D, r3, withdraw-stale-requests)

Worker t195-w7, 2026-09-30. Read from the bundle at
`test-runs/instances/t195-slot-4/run-munnyvbr-11c28a0f` in the t195 worktree, the Lab's full
stdout `t195-lab-professional-network-withdraw-stale-requests-052721.log` and the four
headed-window screenshots `t195-shots/*-r3-*.png` (both in the supervisor's scratchpad, not in
the repository). No product code changed and no run was made.

**Which code ran.** The Lab's prelude recorded Core's newest source at 05:17:56.913Z and reused
every build. Six Core sources this debug touches were rewritten *after* the run (between about
05:54Z and 06:01Z, by other lanes): `flow-draft/amendment.ts`,
`flow-bootstrap/authoring/draft-routing.ts`, `flow-bootstrap/authoring/assemble.ts`,
`flow-draft/entry.ts`, `llm/evidence-loop-decision.ts` and `nodes/control-flow/for-each.ts`. For
those, the line numbers below are from the **compiled `packages/fluxiq/dist/…/*.js` written
05:17:51Z**, which is what the run executed, and are marked `dist`. Every other file cited was
last written before the run.

Privacy: codes, counts, ids, node ids, durations, timestamps and control accessible names only.
No page text, no URLs, no selectors, no provider bodies. Stage 1 is copied verbatim from the
supervisor's file written before the run. A row of the fixture is named by its 0-based list
index and its age in days from `data/invitations.ts`, never by its person.

---

## Header

- Run id: `run-munnyvbr-11c28a0f`.
- Scenario / variant / task: `professional-network` / none /
  `professional-network-withdraw-stale-requests` (task kind `form`, judged by playback goal
  `withdraw-month-old-requests`). Instruction: 251 characters, sha256 `b58c9926…d6e2948`
  (`flow-lane.json` `task`).
- Repositories (`run.json`): facility `defcbe2` (dirty), Core `f0dbbd6` (dirty). Chromium
  134.0.6998.35, 1280×720, instance `t195-slot-4`, `live panel: side-panel (verified open)` (Lab
  stdout); `snapshots/live-panel.json` = side-panel. Prelude 9,467 ms, nothing rebuilt.
- Command: NO EVIDENCE. Neither `run.json` nor the Lab stdout records the command line.
- Time span: Lab 05:27:40.325Z to 05:30:22.846Z (`summary.json`). Build loop 05:28:04.386Z to
  05:29:42.089Z (last dry-run step; `build.durationMs` 102,035). Playback run
  `dcbbfc57-…` 05:29:57.063Z to 05:30:10.234Z. Repair 05:30:11.878Z to 05:30:18.525Z
  (`decision-trace.json` `recoveryState`).
- Provider, model: DeepSeek `deepseek-flash`, profile `production`, key from
  `DEEPSEEK_API_KEY` in the process environment. Authorized: `maxCalls` 48, 48,000 / 8,000
  tokens per call, $0.25 per call, $2 total (`live-llm.json`).
- Calls, tokens, cost: **28 calls.**
  - Build: 26 = 25 loop decisions + 1 additional call (the instruction-authority derivation).
    334,326 input / 2,654 output tokens, $0.0425. `observedCalls` 25 rows, `unrecordedCalls` 1.
  - Repair: 2 (`runtime_diagnosis`, `runtime_patch`), 12,270 / 728 tokens, $0.0041, both
    charged as reported.
  - `budgetBreaches: 0` in both ledgers.
- Verdict as reported: failed, `runtime.behavior`. The Flow reported `unexpected_state` /
  `web.action.blocked_by_dialog` (`evaluation.json`, `events.ndjson` seq 4). Oracles:
  `records: not_declared`, `finalState: failed`.
- **Stage reached: 6.** A Flow was proposed, applied and played back; playback failed on the
  second pass of its loop; the repair ran a diagnosis and one patch, and the patch was refused.

## Stage 1 — the instruction and the expected chain (verbatim, written before the run)

## Stage 1 — professional-network-withdraw-stale-requests (written before the run)

- Instruction (live-tasks.ts): withdraw every connection request sent a month or more ago that is still waiting; leave newer requests, page-follow and newsletter invitations, and received invitations alone.
- Site facts (`data/invitations.ts`, `network/manager-client.ts`, `manifest.ts` WITHDRAW_SCRIPT): Sent invitations at `mynetwork/invitation-manager/sent/`, 36 rows newest first (28 person, 8 page/newsletter). 12 person requests are >= 30 days (33..240 days); Rosa Meijer at 28 days reads "4 weeks" and must be left. A `People (28)` filter pill reloads with only connection requests. The list pages: the first "Show more" never finishes, a "Retry" appears and only it loads the rows; a second "Show more" loads the rest. Withdraw opens a shared confirm dialog (`testid:withdraw-confirm`); a confirmed row fades out and nothing is pulled up.
- Expected chain:
  1. Navigate to Sent invitations; press the People filter (or skip non-person rows per row).
  2. Load every row: Show more -> (spinner, error) Retry -> Show more again, until no Show more.
  3. A loop over the rows: per row, route on age (>= 1 month: "1 month ago", "2 months ago", "33 days"? -- whatever the page's age label says; "4 weeks" is NOT a month) and kind (person only); withdraw + confirm the dialog; skip the rest.
  4. The Flow must be shorter than the work: one repeat span (Withdraw + confirm) over the rows, not 12 pairs of hand-placed clicks.
- Judged by playback goal: the store after exactly the 12 stale person withdrawals.
- A wrong answer that looks right: 12 withdrawals that include Rosa Meijer (4 weeks) or a page/newsletter row; only the first page's stale rows withdrawn (Show more not retried); a Flow of 24 fixed clicks that replays by position and breaks when a faded row shifts nothing / list order changes.

**Fixture fact added by this debug** (`apps/scenario-lab/src/scenarios/professional-network/data/invitations.ts:16-25`,
`network/rows.ts:15` `INVITATION_PAGE_SIZE = 10`): the first ten rows, which are all a
first-page read can see, are 0, 0, 1, 2 (page), 3, 5, 8, 10, 12 (page) and 13 days old. **Not
one of them is stale.** A Flow that reads only the first page cannot withdraw a single request
the instruction asks for.

## Stage 2 — exploration

Joined from the `[FluxIQ build-trace]` lines in `logs/core.log` and `flow-lane.json`
`build.evidenceLoop.steps[]`. Draft ids `dN` number the recorded tool steps in order from Core's
initial call `d1`, counting `already_answered` steps; the numbering is checked by
`rerun.10` → `d10`, `rerun.11`, `rerun.13`, and by dry run 2 replaying exactly `d2 d3 d4 d13 d15
d16`, which are the Flow's six action nodes.

| It | What it was asked | What it decided | Action and parameters | Result |
| --- | --- | --- | --- | --- |
| 0 | (Core's free first look) | – | `initial.core.run_node`, `dom-capture_snapshot` (d1) | `web.action.rejected.not_at_start_location` / `start_location_not_reached`, 75 ms |
| 1 | decide (1340 ms) | tool_call | `nav1`, `browser-navigate` (d2) | succeeded, 2208 ms, page changed |
| 2 | decide (1205 ms) | tool_call | `nav2`, `browser-navigate` (d3) | succeeded, 2468 ms |
| 3 | decide (1326 ms) | tool_call | `nav3`, `browser-navigate` (d4) | succeeded, 2462 ms (Sent invitations, "All" filter: screenshot t1) |
| 4 | decide (1673 ms) | tool_call | `detect1`, `web.detect_repeating_structure` (d5) | `web.structure.detected`, 486 B |
| 5 | decide (1889 ms) | tool_call | `extract1`, `dom-extract_list` (d6) | **`web.action.rejected.action_timed_out` / `fewer_records_than_required`, 11,362 ms** |
| 6 | decide (1733 ms) | tool_call | `detect2` (d7) | detected, 486 B |
| 7 | decide (1816 ms) | tool_call | detect again (d8) | `llm_evidence_loop.already_answered` (not run) |
| 8 | decide (1363 ms) | tool_call | `detect3` (d9) | detected, 1,785 B |
| 9 | decide (1811 ms) | tool_call | `extract2`, `dom-extract_list` (d10) | `web.inspect.succeeded`, 8,566 B, 1337 ms, page unchanged |
| 10 | decide (1865 ms) | amend_draft **rerun d10** | `rerun.10` → d11 | inspect succeeded, 8,566 B, page unchanged |
| 11 | decide (1299 ms) | tool_call | detect again (d12) | `already_answered` |
| 12 | decide (1457 ms) | amend_draft on "11" | – | `draft_unchanged`, refused `11:no_such_position` |
| 13 | decide (1530 ms) | amend_draft **rerun d11** | `rerun.11` → d13 | inspect succeeded, 8,566 B. **d13 is the extraction the Flow ships.** |
| 14 | decide (1909 ms) | amend_draft **rerun d13** | `rerun.13` → d14 | **`action_timed_out` / `fewer_records_than_required`, 11,369 ms**; d13 stays |
| **15** | decide (1645 ms) | **complete #1** | – | **refused `bootstrap.instructed_act_missing`** (no withdrawal in the draft). Dry run 1: reset, d2, d3, d4, d13 all `replayed` |
| 16 | decide (2023 ms) | tool_call | `withdraw1`, `dom-click` `Withdraw` (d15), declared `modify_existing` | **`web.action.succeeded`, 2799 ms, page changed** — opened the confirm dialog on **row 0 (0 days old)** |
| 17 | decide (1514 ms) | tool_call | `withdraw2`, `dom-click` `Withdraw` (d16), the dialog's confirm, declared `modify_existing` | succeeded, 1640 ms, page changed. **Row 0 was withdrawn** (screenshot t3) |
| 18 | decide (1534 ms) | amend_draft on d15, d16 | – | `draft_amended`, 2 applied, kept 6 → 4 |
| 19 | decide (1492 ms) | amend_draft on d15, d16 | – | `draft_amendment_undone`, 2 applied, kept 4 → 6 |
| 20 | decide (1497 ms) | amend_draft on d15, d16 | – | `draft_amendment_undone`, kept 6 → 4 |
| 21 | decide (1296 ms) | amend_draft on d15, d16 | – | `draft_amendment_undone`, kept 4 → 6 |
| **22** | decide (1528 ms) | amend_draft on d13, d15 | – | `draft_amended`, **1 applied, 1 refused**, kept 6. **By elimination this is the `repeat` on d15** (see Q-span) |
| 23 | decide (1121 ms) | amend_draft on d13 | – | `draft_unchanged`, 1 refused |
| 24 | decide (1745 ms) | amend_draft on d13 | – | `draft_unchanged`, 1 refused |
| **25** | decide (1760 ms) | **complete #2** | – | **completion check `ok=true`**. Dry run 2: reset, d2, d3, d4, d13, **d15, d16** all `replayed` (d15 1423 ms, d16 1457 ms). Proposed |

Totals: 25 decisions = 12 tool_call (2 of them `already_answered`) + 11 amend_draft (3 reruns,
2 `draft_amended`, 3 `draft_amendment_undone`, 3 `draft_unchanged`) + 2 complete. 16 tool calls
(the initial call, 12 decisions, 3 reruns). 2 dry runs. The loop ended at iteration 25 of 64.

- **Repeats, and what the loop believed was progress.**
  - Iterations 18–21 are **four decisions toggling the same two steps out and back in**
    (kept 6 → 4 → 6 → 4 → 6). Each is written `draftState: changed`. What each change word was
    is NO EVIDENCE: the trace records ids and counts only.
  - Iterations 10–14 reran the list extraction three times; two reruns answered the same
    8,566 bytes with `pageState: unchanged`, the third timed out.
  - Iterations 22–24 targeted d13 three times and d13's amendment was refused each time. The
    refusal reason is NO EVIDENCE (only iteration 12 carries `amendmentRefusals`).
- **Rejections and refusals received, and whether each said enough to route around.**
  - `fewer_records_than_required` at 5 and 14. Each cost 11.4 s. The argument that asked for
    more records than the page showed is NO EVIDENCE (inputs withheld). The model routed around
    it by rerunning with a smaller request, and **never tried to load more rows**: no call in
    the build names `Show more` or `Retry`.
  - `already_answered` at 7 and 11.
  - `no_such_position` at 12: the model named a step by the position `11`, not the id `d11`.
  - `instructed_act_missing` at 15. This is what made the model withdraw at all.
- **Where the context was evicted or truncated.**
  - The draft's own guidance was told shorter: `draft.instructionBytes` 1,052 → 618 at 16 →
    **154 at 18**, the minimal telling, from the iteration the span was being written.
  - The draft entry stayed under its 4,000-byte budget (3,963 B at its largest, iteration 15).
  - What the model was shown of the evidence window is NO EVIDENCE.

### Screenshots of the headed window (`t195-shots/*-r3-*.png`)

Four shots, 05:28:25 to 05:30:01. None was taken after 05:30:01, so neither playback's loop nor
the repair was captured. **In every shot the side panel is open** (`FluxIQ Web Automation
Client (E2E)`, Simple mode, "Connected to FluxIQ", set-up card "Add an AI model key — To do"),
**no on-page FluxIQ status overlay is visible**, and **no permission question is visible**. A
cookie banner stays across the bottom of the page in every shot; the build never touched it.

| Shot | Loop at that moment | Page | Panel "RIGHT NOW" |
| --- | --- | --- | --- |
| 05:28:25 t1 | `extract1` in flight (05:28:20–05:28:31) | Sent invitations, filter pill **All (36)** selected (not People), first rows visible | "FluxIQ is working", "Reading data from the page" |
| 05:28:58 t2 | `rerun.13` in flight | the same | "FluxIQ is working", "Reading data from the page" |
| 05:29:30 t3 | iteration 23 (amending) | Sent invitations; **the first row of t1 is gone** — the request sent today that `withdraw1`/`withdraw2` withdrew | **"Done"**, "Last step: Looked at the page", shown while the build was still running |
| 05:30:01 t4 | playback `s1`/`s2` (navigations) | the network home | "FluxIQ is working", "Looking at the page" |

## Stage 3 — the proposed Flow

- Completion checks (`logs/core.log`): #1 at 05:29:05.721Z refused
  `bootstrap.instructed_act_missing`; #2 at 05:29:33.121Z accepted.
- The instructed acts, recomputed with the run's own compiled
  `instructed-acts/instruction-acts.js` on the 251-character instruction: **one act,
  `a1 submit:withdraw`**. One kept mutating step satisfies it.
- Consequence cross-check: **`undeclared`**. Instructed `delete` (from the derived instruction
  authority); declared `modify_existing` on both Withdraw presses; `beyondInstruction:
  modify_existing`. It refused nothing, by design (see cause 6).
- **Node list as authored** (`flow-lane.json` `authoredNodes` and `actions`; `flowShape` 9
  nodes, 6 action nodes; the non-action nodes are inferred from playback's node ids and
  `draft-routing.js` dist `:140-190`):
  1. `main.s1` `web.browser.navigate` (url withheld), from d2.
  2. `main.s2` `web.browser.navigate` (url withheld), from d3.
  3. `main.s3` `web.browser.navigate` (url withheld), from d4.
  4. `main.s4` `web.dom.extract_list`, from d13: `item` withheld; fields `name` (text),
     `url` (link), **`urn` (attribute, required)**, `date` (text); **`paginate: {mode:
     loadMore, control: withheld, maxPages: 1}`**; `minItems: 0`; `recordOutput: null`;
     **no `where`**.
  5. `main.s5` `builtin.control.merge` — "each pass of the loop starts here".
  6. `main.s6` `builtin.control.for-each` — rows from s4, body → s7, done → s8.
  7. `main.s7` `web.dom.click` `button` `Withdraw`, **`listPosition {index: 1, total: 10}`**,
     from d15. **The last step of the span: its success goes back to s5.**
  8. `main.s8` `builtin.control.merge` — the loop's exit.
  9. `main.s9` `web.dom.click` `button` `Withdraw` (no list position; the dialog's confirm),
     from d16. **After the loop.**
- **Divergences from the stage 1 chain.**
  - Chain 1 (Sent invitations, People filter): navigation met; **the People filter was never
    pressed** (t1–t3 show All (36)) and no per-row kind check exists.
  - Chain 2 (load every row through the Show more → Retry stall): **absent**. `maxPages: 1`
    reads the first page only (`domain/src/actions/extraction/request.ts:146-152`: "reading at
    most `maxPages` pages, the first included"). **The stall was never met**: nothing pressed
    Show more, in the build or in playback (`pagesRead: 1`).
  - Chain 3 (loop over rows routed on age and kind; withdraw + confirm): **the loop exists but
    its span is wrong and it has no condition.** The span is s7 alone; the confirm s9 is after
    the loop. There is no `only_if` and no `where`, so every row would be withdrawn.
  - Chain 4 (one span over the rows, not fixed clicks): met in shape (one `repeat`), but s7
    carries a fixed `listPosition` of index 1 (1-based, `apps/extension/src/content/identity/context.ts:230`),
    i.e. row 0, from the step it was recorded as.
- **Classification of each divergence.**
  - Span (chain 3): **misread the grammar.** The amendment schema the model was shown says
    `through` is "the last step of the span that repeats. Leave it out to repeat this step
    alone" (`amendment.js` dist `:72`), and the code defaults it to the step itself
    (`amendment.js` dist `:187`, `const through = named(amendment.through) ?? step`). A span
    that should have been d15–d16 was written as d15 alone, and nothing checked that the step
    right after the span acts in a layer the span's step opened.
  - Age/kind routing (chain 3) and pagination (chain 2): **could not express it (as told)**.
    Nothing in the build names a row condition; `where` exists in the domain
    (`request.ts:324`) but was never written, and a first-page read cannot see a stale row.
  - People filter (chain 1): misread the page (never attempted).

### Q-span — which amendment set the span, with evidence

- The Flow's shape is exactly what `draft-routing.js` dist `:140-190` emits for `repeat` on d15
  with `over: d13` and `through: d15`: s4 gets a `success → loop` and a rows branch into For
  Each; s5 is the loop Merge; s6 For Each; s7 = d15 is the body, and because it is the **last**
  member of the body its success returns to the loop (`:181-189`); s8 is the exit Merge; s9 = d16
  follows the loop. Playback confirms it: s7 → s5 → s6 → s7 (`flow-lane.json` `actions`
  attempt indexes 6–9) with s9 never reached.
- Which decision wrote it: **iteration 22** by elimination. Iterations 18–21 changed d15/d16's
  kept count (a routing word does not), and 23–24 were refused; 22 is the only later decision
  that applied one change to d15 while leaving the kept count at 6. The words themselves
  (whether `through` was omitted or named d15) are NO EVIDENCE: `progress-trace.ts` prints no
  change word and the step rows withhold input.

## Stage 4 — replay

Playback, run `dcbbfc57-…` (`flow-lane.json` `actions`, times from `startedAt`):

| Node | Executed | Produced | Duration | Retries | Rung that absorbed |
| --- | --- | --- | --- | --- | --- |
| `main.s1` navigate | 05:29:57.063 | succeeded, `matched` | 2166 ms | 0 | – |
| `main.s2` navigate | 05:30:00.363 | succeeded | 1379 ms | 0 | – |
| `main.s3` navigate | 05:30:02.858 | succeeded | 1366 ms | 0 | – |
| `main.s4` extract_list | 05:30:05.359 | succeeded: **10 records, 1 page**, `itemsSeen` 10, `emptyRecords` 0, list present after 1 ms | 287 ms | 0 | – |
| `main.s5` merge | 05:30:06.773 | succeeded | 1 ms | 0 | – |
| `main.s6` for-each | 05:30:06.774 | succeeded (pass 1) | 1 ms | 0 | – |
| `main.s7` click `Withdraw` (index 1 of 10) | 05:30:06.776 | **succeeded — opened the confirm dialog.** `targetResolution: unresolved_no_candidates`; host resolution `selector`, 1 candidate, score 0.643, confidence 0.566 | 524 ms | 0 | – |
| `main.s5` merge | 05:30:08.411 | succeeded (back to the loop head) | 0 ms | 0 | – |
| `main.s6` for-each | 05:30:08.411 | succeeded (pass 2) | 1 ms | 0 | – |
| `main.s7` click `Withdraw` | 05:30:08.412 | **failed `web.action.blocked_by_dialog`** (`unexpected_state`, stage `execution`): the click point landed on the open confirm dialog, whose controls are `Cancel` and `Withdraw` | 1822 ms | 4 attempts | the blocking-dialog rung absorbed `blocking_dialog` four times, waiting 1350 ms, and correctly did not answer a dialog whose confirm is the consequential act |

- **Any node that reported success while doing nothing useful.** `main.s7` pass 1 "succeeded"
  but only opened the dialog; its confirm (s9) is outside the loop, so no withdrawal was
  completed in playback. `main.s4` "succeeded" with 10 rows none of which qualifies.
- **The dry run could not catch it.** Dry run 2 replayed d13, d15 and d16 each once, in draft
  order (`flow-draft/dry-run.ts:147`: "A replay runs every proposed step once"), so the
  press-then-confirm pair replayed clean. The loop's second pass, the first place the span
  error shows, is never run before playback.
- Provider calls during replay: **0** (`live-llm.json` `verification.calls: 0`).

## Stage 5 — the answer

- Records expected vs returned: no records declared for this task (`oracles.records:
  not_declared`); judged by the playback goal `withdraw-month-old-requests`.
- Final state: **`finalState: failed`**. The store the goal expects (12 stale person requests
  withdrawn, `manifest.ts` `STORE_AFTER_WITHDRAWAL`) was not reached. The exact store after the
  run is NO EVIDENCE: the bundle publishes no store diff.
- What did change on the site, from the evidence:
  - Exploration withdrew **row 0, sent 0 days ago** (d15 + d16 at 05:29:14–05:29:21; t3 shows
    it gone). The instruction says to leave it.
  - Dry run 2 replayed d15 + d16 at 05:29:39–05:29:42 against the list as it then stood, so it
    most likely withdrew **the next fresh request** too. Not captured by any screenshot: NO
    EVIDENCE beyond the two `core.replay.replayed` codes.
  - Playback opened one dialog and confirmed nothing.
- Count-only comparison: not applicable; the judge is the final store.

## Stage 6 — judgement and repair

- **Did the system judge its own result?** Not as a result: playback failed with a runtime
  failure, so `resultVerification` is null. The failure went to the recovery ladder.
- **Did a repair trigger automatically?** Yes, `harnessActivations: 3`:
  1. `diagnosis` with `recovery.ladder_diagnosis_unanswered` — the ladder's last rung recorded
     and not answered by a provider (`service/summaries/conversions.ts:293,311`). No call.
  2. **Diagnosis** (`runtime_diagnosis`, 5,658 / 429 tokens, validation ok):
     `failureClass unexpected_state`, `candidateKind action_target_override`,
     `stillAchievable yes`, `deterministicRecoveryPossible yes`, exploration not needed, patch
     needed, confidence 0.72.
  3. **Recovery plan:** `request_patch` only; allowed kinds `temporary_target_override`,
     `temporary_wait_retry` (`recovery/plan.ts:97`).
  4. **Patch** (`runtime_patch`, 6,612 / 299 tokens, validation ok): one
     `temporary_target_override`. **Refused before it ran**: `preflightOk: false`,
     `targetOverrideRefusal.status: ambiguous`, issue codes
     `runtime_patch.target_override_rejected` and
     `runtime_patch.target_override_rejected.target_indistinguishable`. The domain refused it
     at `domain/src/runtime/llm-evidence/target/equivalence.ts:80` (a usable rival that cannot
     be told apart from the named target) → `target/override.ts:115` (status `ambiguous`).
     `permissionOutcome: not_asked`. Which handle it named is NO EVIDENCE; the page then held
     many buttons named `Withdraw` (every row's and the dialog's).
- **Could any allowed patch have fixed it?** No. The fix is structural — move the dialog's
  confirm (s9) inside the span, or give the span `through: d16` — and neither a target override
  nor a wait-retry changes the graph.
- **What context did the repair receive** (`evaluation.json` `harnessRecovery.contextSections`):
  - Present: `failure`, `expected_transition`, `actual_transition`, `flow_graph`, and the
    failure evidence packet (5,406 bytes, truncated).
  - **Omitted for `byte_budget`: `step_parameters`, `state_diff`, `failed_target`,
    `recovery_candidates`, `subflow`, `route_context`, `recent_nodes`.** Absent:
    `recovered_failures`, `known_adaptations`, `recording_context`.
  - The build's conversation and draft history were not part of it.
- **Was the repair persisted, and did the re-run use it?** No: `adaptationIds: []`,
  `changeProposalIds: []`, no re-run.

## Causes

| # | Cause, precisely | Repo and file | Fix | Task id |
| --- | --- | --- | --- | --- |
| 1 | **The `repeat` span is d15 alone; the dialog confirm d16 (s9) is after the loop.** `through` defaults to the step itself and the schema tells the model that leaving it out repeats "this step alone"; the model left it out or named d15 (iteration 22). Pass 2 of the loop clicks the next row's Withdraw under the dialog pass 1 opened: `web.action.blocked_by_dialog`. | Core `runtime/flow-draft/amendment.ts` (dist `amendment.js:72` schema text, `:187` default); `runtime/flow-bootstrap/authoring/draft-routing.ts` (dist `draft-routing.js:150` body slice, `:181-189` loop close). Both sources were rewritten after this run by another lane. | When the step after a span's last step acted inside a layer the span's step opened (d15 changed the page to a dialog; d16 pressed in it), refuse the span or extend it through that step; say in the schema that a press and its confirmation repeat together. | open |
| 2 | **The dry run replays a repeated span once, linearly**, so a span that cannot run twice replays clean. Dry run 2 passed d13 → d15 → d16. | Core `runtime/flow-draft/dry-run.ts:147` | Replay a `repeat` for at least two rows (or its body twice) before proposing, and fail the dry run when pass 2 meets a blocking layer. | open |
| 3 | **The extraction reads the first page only and filters nothing.** `s4` has `paginate {loadMore, maxPages: 1}` and no `where`; the first ten rows are 0–13 days old (`invitations.ts:16-25`), so the Flow's rows hold **no stale request** and every row would be withdrawn. | Facility `domain/src/actions/extraction/request.ts:146-152` (maxPages semantics), `:324` (`where`); Flow `main.s4`; fixture `apps/scenario-lab/src/scenarios/professional-network/data/invitations.ts:16-25` | Prompt-side: a conditional instruction ("sent a month or more ago", person requests only) needs a row condition (`where` on the date field, or `only_if` inside the span) and a read of every page. Completion could refuse a mutating `repeat` over an unfiltered extraction when the instruction states a condition. | open |
| 4 | **The Show more → Retry stall was never met.** No step names Show more or Retry; the two timeouts (`fewer_records_than_required`, 11.4 s each at 5 and 14) were answered by asking for fewer records, not by loading more. | Build trace; facility `request.ts:146-152` | Same as 3; and surface `fewer_records_than_required` with the page's own load-more control named, so the model can route to it. | open |
| 5 | **Exploration withdrew a request the instruction says to leave** (row 0, 0 days old) and dry run 2 repeated the press pair against live state. Nothing checks a row's condition before an instructed destructive act is tried for real. | Build trace (d15, d16); Core `runtime/action-permissions/gate.ts:258-260` (instructed consequences are permitted without a per-target check) | Before a mutating exploration press on a list row, require the row's condition to have been read; or run exploratory presses of instructed acts on a row the evidence shows qualifies. | open |
| 6 | **A withdrawal was declared `modify_existing` while the instruction was read as `delete`; the cross-check said `undeclared` and refused nothing.** Here harmless (the act was instructed), but `modify_existing` is not a destructive class, so the gate would not ask for an *uninstructed* withdrawal either — which is exactly the consequential sibling task. | Core `runtime/action-permissions/cross-check.ts:97-103` (verdict); `runtime/flow-bootstrap/adaptation.ts:129-134` ("It refuses nothing"); `runtime/action-permissions/destructive.ts:87-88`; the declaration guidance is facility `domain/src/runtime/llm-evidence/harness-options/options.ts:84` | Treat "withdraw", "cancel", "remove" presses as `delete` in the declaration guidance, or have the cross-check treat an `undeclared` destructive class as the class of the pressed step. | open |
| 7 | **The repair could only re-point a click.** The plan for `action_target_override` allows target override and wait-retry; neither can move s9 into the span. The override the model wrote was refused `target_indistinguishable`. | Core `runtime/recovery/plan.ts:97`; facility `domain/src/runtime/llm-evidence/target/equivalence.ts:80`, `target/override.ts:115` | Route a `blocked_by_dialog` whose dialog was opened by the Flow's own previous node to re-authoring (build loop in extend mode), not to a target override. | open |
| 8 | **The repair was not shown the step parameters or recent nodes** (8,000-byte budget), so it could not see that s7 is the span's last step and s9 lies outside it. | Core `runtime/recovery/context.ts:243`, `:322-329` | As run-munnop9n cause 9: keep `recent_nodes` and the failing node's parameters ahead of lower sections. | open (same as munnop9n #9) |
| 9 | **The panel shows "Done — Last step: Looked at the page" mid-build** (t3), and "Add an AI model key — To do" throughout while Core spent an environment key. | Facility `apps/extension/src/panel/simple/now-copy.ts:52-54`; `apps/extension/src/panel/simple/start/setup-steps.ts:50-52` | As run-munnop9n cause 13. | open (UI) |

## Instrumentation gaps found

| Stage | What could not be answered | File that drops it |
| --- | --- | --- |
| 2 | The change word of each amendment (18–22), so which decision wrote `repeat` and whether `through` was omitted | Core `runtime/llm/evidence-loop/progress-trace.ts` prints no change word; step rows withhold input |
| 2 | The extraction arguments that timed out `fewer_records_than_required` (minItems, paginate) | `flow-lane.json` step rows withhold `input` |
| 2 | Refusal reasons for 22–24 | `amendmentRefusals` is present only on iteration 12's row |
| 3 | The claim that satisfied the instructed-acts check at 25 | the completion trace prints `ok` and issue codes only |
| 5 | The store after the run (which requests were withdrawn by exploration, dry run 2 and playback) | the bundle has no store diff for a playback-goal task |
| 6 | The handle the refused target override named | `runtimePatchAttempts` carries status and reason only |
| screens | Anything after 05:30:01 (playback's loop, the dialog, the repair) | screenshot cadence 30 s; last shot before s7 |
| header | The Lab command line | `run.json` |
