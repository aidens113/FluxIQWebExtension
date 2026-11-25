# Page Diff Delivery Plan

Status: Active
Status detail: Planned 2026-11-25 on the user's instruction and decisions (D1-D16). W1 t1036 and W2 t1038 integrated (fluxiq 0.54.21); the scripted bigbox run passes 4 of 4. W3 t1037 phase 2, t1041 (asked column names) and t1042 (W1 leftovers) running in parallel.
Created: 2026-11-25
Last updated: 2026-11-25
Owner: Senior supervisor agent
Scope: How the model sees pages: each page address's whole cleaned view once per run, then only what changed, delivered with every result; no look command; the model may ask for the whole page; page data per request stays within a limit.
Paired document: none yet (Core gets one if the sub-supervisor opens a Core working document)
Related: [data-first-simplification-plan.md](./data-first-simplification-plan.md) (the paid round of 2026-11-24 and the five bigbox recordings this plan answers), the t1035 structural audit (`data-first-simplification-plan/reports/t1035-agent-structure-audit.md` when it lands)

## Current State

- **The user's instruction (2026-11-25), recorded in AGENTS.md "The page reaches the model as run-scoped diffs; there is no look command":**
  - send each page address's first version whole, then only the differences on that address for the rest of the run;
  - run-specific, never stored between runs;
  - the model can ask for the full page;
  - "no more look command, its ridiculous";
  - a data limit on pages so not everything is sent on every request.
- **Why: the t1035 audit of the five 2026-11-24 bigbox runs** (`data-first-simplification-plan/reports/t1035-agent-structure-audit.md`). The lead had first told the user the model saw the page only when it looked; the audit corrected that:
  - **The whole cleaned page already rides with every decision.** `core.current_view` was in all 463 decisions, and all 36 acts came back with the page after them. "Look" is no tool: it is `core.run_node` with `web.output.dom-capture_snapshot`, run mostly by Core itself, and the words about it confuse the model.
  - **Requests grow from 25k to 310k input tokens.** Mostly earlier rounds' calls are carried in full (40-52% of input in the long runs); the page is 2-3% of a late request. 91% of decision spend was in calls over 100k tokens.
  - **48% of decisions are looks and searches; 6% are acts that landed; 34% were refused.** 55 of 109 page searches looked for words already on the page in front of the model. There were 102 detections for 44 reads.
  - **Handles go stale.** 38 of 136 page-handle uses named a handle no longer on the page, and all failed.
  - **Replies fail to parse.** 25 were unreadable (5.4%), because the reply is a JSON string inside JSON.
  - **Withdrawing looks changes the offered tools.** That happened 18 times, breaking the cache each time.
  - **Judging.** 22 judge calls cost $1.29 and accepted nothing; 7 judged a state unchanged since the last no.
- **State (2026-11-25, second session): all three workstreams dispatched.**
  - **t1034 integrated** (fluxiq 0.54.19; both `dev`s pushed; ledger in the data-first plan). The shared Core sync followed.
  - **W1, t1036** `page-diff-delivery`: **reported Partial, committed WIP on its branch** (Core `e9bf3fa31`, downstream `9ebf94571`, pushed). Report: `reports/t1036-page-diff-delivery.md` in its tree.
    - **Built:** D1-D8, D10, D11, D14, D15. The page key is the URL without its query. With it, 13-14 of 32 later requests in the scripted run carried changes, up from 4-8.
    - **The before-state cause was two things.** W1's own removal of `pageView` from the observed-state keys, now restored. And on `dev` since 11-04/11-22, `before_state_missing` was demanded after any act; the judge now asks for a before state only after a lasting act.
    - **Its last scripted run:** zero `before_state_missing`; it was held only on `read_invalid`, which is W2's fix.
    - **The lead accepts:**
      - the draft stays after the history, not in the stable prefix, since it changed in 296 of 462 recorded consecutive requests;
      - the Core directory is named `view-channel/`, because a guard test refuses "page" there.
    - **Follow-ups the lead takes after W1 merges** (all in W1's files):
      - `maxStepsWithoutProgress` still ends a loop, which AGENTS.md forbids;
      - `core.run_flow` appears in the offered tools only once the draft has a step, so the tool list changes mid-run (D11);
      - the recovery path keeps the `web.recovery.inspect` look, because it has no page channel.
    - **For W3 phase 2:** two look phrasings remain in `flow-script-format.ts:235` and `did-not-work.ts:28`.
    - **Combining (2026-11-25):** the lead merged W2's branch into W1's lane. Core merged clean; three conflicts arose in the scripted model. Worker t1036-g (Opus) is resolving them, fixing the W2 tests W1 breaks, running the combined checks and one scripted bigbox run (expected: attempt 1 confirmed, attempts 2-4 run the saved Flow).
    - Built. Its P4 replay is in its report, `reports/t1036-page-diff-delivery.md`. Long runs carry 35-45% less input per request (peak 309.5k to 132.8k tokens) and 16-21% fewer uncached tokens.
    - Its scripted bigbox Lab runs showed a blocker: the judge says yes, yet the completion is held unconfirmed (`answer_first.judged_unsure`, with `web_judge.read_invalid` and `judge_evidence.before_state_missing`), so the run repeats its work and never finishes.
    - The lead routed `before_state_missing` to W1. Core `judge-evidence/summary.ts` wants a before state after any act, while `answer-first/witnesses` reads one only before a lasting act. Fix: require it only when a lasting act ran. W1 now owns `answer-first/witnesses/**` and `result-verification/judge-evidence/**`.
  - **W2, t1038: integrated 2026-11-25 (fluxiq 0.54.20; see the ledger).** Its report as it stood: Its report is `reports/t1038-native-decisions-one-read.md` in its tree.
    - **D12:** decisions go as native tool calls. Anthropic uses tool choice "auto" with one call (forcing is refused with Sonnet/Opus thinking); DeepSeek uses "required". The withdrawn-action allowance is gone from `decision-check.ts`.
    - **D13:** a read detects its own list.
    - **Replay over the 467 recorded decisions:** refusals fall from 25 to 4, and 23 can't be tool calls (18 named a tool that wasn't offered).
    - **Scripted run-mwvu78hj:** 33 decisions on one fixed tool list, 12 reads, no detections, judges yes. It still ends unjudged on `before_state_missing`, which is W1's fix above.
    - **Fixed two older defects:** the read payload kept `rejectedObservations` without their samples (the cause of `read_invalid`; `node-run/rejected-rows.ts`), and the scripted server misrouted a continued judge.
    - **At its integration:** apply its replacement for W1's `judge-continues-decider.test.ts` (`test-runs/t1038/a1-judge-continues-decider.patch-target.ts`).
    - **For W3 phase 2:** `EXTRACTION_FROM` in `flow-authoring/bootstrap/plan/issue-feedback.ts` still says "Detect the structure first", and an auto-drafted read must copy the stored handle and binding.
  - **t1039 integrated** (data-first ledger): every Lab attempt writes `flow.png` of its Flow or draft, with input, real examples and output.
  - **W3, t1037** `auto-draft`: **phase 1 done, lead-verified and committed on its branch, with both `dev` heads merged in; not merged into `dev`** (inert until wired, so not yet a complete unit). `draft/compose/` drafts from the calls that worked, with reasons for each step left out. `draft/amendment/edits/` holds six edits (keep, drop, result, repeat, unrepeat, bind), only under `draftEdits: "framework"`, which nothing sets yet. Replay: every landed act is in the framework draft on all five runs, and two runs gain the result read the model lacked. Phase 2 hook points are in its report `reports/t1037-auto-draft.md` (in its tree), "Where phase 2 hooks in": mostly W1's `evidence-loop.ts`, plus `loop-configuration.ts`, `evidence-loop-decision.ts` and W1's `result-columns.ts`; after the switch, delete the 13-edit grammar. Its open questions: no host signal for "lasting" (it errs toward keeping), and looks still listed in the draft entry. Phase 2 starts when W1 merges: the lead merges `dev` in and resumes the same sub-supervisor.
  - Briefs: `page-diff-delivery-plan/briefs/` (`common.md` binds all three). Ids follow `pnpm task start`'s order, so W3 is t1037 and W2 is t1038.
  - Nothing paid is running. Round spend of 11-24/25 is about $9.20 of $50: five Haiku bigbox runs and one Sonnet run.
  - **The Sonnet run** (run-mwvgjb8c, $0.80, 90 s, 22 calls) set the store, read the cart as the result, and the product check accepted it. But the oracle marked the answer wrong: it added "Loftwell 1 Roll $1.97, 4.6 stars", which is not the cheapest towel that qualifies for pickup today at that store (`missingActs`, `unaskedChanges: cart:5520104:pickup`). Our judge, on Sonnet, accepted it, so judging pickup availability is an open defect.
  - Other open trees: **t1015** `paid-bigbox` (the live lane, slot 1); **t1035** (the audit tree; its files are on dev; to abandon).
- **Next (in order):**
  1. W1 and W2 are integrated (ledger). Running in parallel:
     - W3 phase 2 (t1037; sub-supervisor; Lab slot 2);
     - t1041, the asked column names (worker; slot 4);
     - t1042, W1's leftovers (worker-heavy; slot 3).
     Verify each, integrate it, and merge `dev` into every lane after each merge (AGENTS.md).
  2. Then remove `maxStepsWithoutProgress` from every loop (AGENTS.md: no count ends a round). It crosses W3's files, so it comes after W3.
  3. A P4 offline proof across the integrated tree. Then live on Sonnet (`--llm-model claude-sonnet-5-5`): bigbox first, then the nine others, each with the run watcher, `--attempts 4`, and the per-attempt flow charts reviewed.
  4. Also open: the judge accepting a wrong item on pickup availability (above); the answer-contract column reader misreading "columns title only"; fake clocks for the deadline tests `second-attempt-proof` and `later-attempt`; `pinned-calls-job-board` setup wait; `tool-rejection.ts` at 799 lines; a Flow playback guard for list location (a wire change); a second full sweep and `main` promotion (`main` has not moved).
- **The user decided both open questions (2026-11-25):** "yes lets completely drop the search command" (D15), and "Drafting the flow automatically will help in many situations, as long as the model is able and encouraged to edit it for more efficient flows" (D16, W3). Both are recorded in AGENTS.md.

## Decisions

- **D1. One page channel, owned by Core, domain-neutral.** Core keeps, per run (never persisted across runs), the last page state it delivered to the model for each page key. The domain names the key (its normalized address; the domain decides what is "the same page"; on the web the address is the URL "not including the ? params" (user, 2026-11-25), so a filter, sort or page change on the same path arrives as a diff, and a route fragment `#/` stays (lead's reading)) and supplies a page view as keyed lines: each line is a stable element key plus its text. Core diffs keyed lines (added, removed, changed) and never parses page words.
- **D2. Stable element keys across captures within a run.** A diff is only meaningful if an element keeps its key from capture to capture. The domain and content script give an element the same handle for the whole run when it is the same element (by its fingerprint and place, never by its words alone). This also ends stale-handle refusals (`target_unobserved`) for elements that never left the page.
- **D3. Delivery rides on every result.**
  - A round opening carries the page: the whole view the first time the run meets that key, otherwise the diff since the last delivery.
  - So does every tool result that ran on a page (acts, reads, searches). The model never has to ask "what does the page look like now".
- **D4. No look command.** The look capture leaves the model's catalog and its words, and look withdrawal goes with it. `describe_element` and `detect_repeating_structure` stay. `find_on_page` goes (D15).
- **D5. The model can ask for the whole page.** `core.full_page`, or a domain tool if the domain must build it, returns the current whole view for the current key and resets that key's base. Over the limit, it comes in parts ("part 1 of 3; ask for part 2"), never cut silently.
- **D6. A data limit on page content per request.**
  - Each delivery is held to a per-request page budget (configurable; the sub-supervisor proposes the default from the recordings' view sizes).
  - A first view or diff over it is sent in page order up to the budget, says what was left out and how to get it, and the model asks for the next part.
  - A diff larger than a re-sent base is sent as a new base instead.
  - The limit bounds payload size only. It never ends a round or a run (AGENTS.md "No arbitrary limit ends or resets a run").
- **D7. The window keeps one current page state per key.** Base plus the diffs since; when the diffs outgrow the base, the base is re-sent and the old copies are dropped. Older page copies never pile up in the evidence window. Earlier rounds carry the current page state, not a stale copy.
- **D8. Cache-friendly order.** The page channel's content goes after the stable prefix (system prompt, tool schemas, the draft), so the prefix stays byte-identical and the cache holds. With no look withdrawal, the tool schema no longer changes mid-run.
- **D9. Out of scope:** the judge's trail (it reads the run's record, not the model's window); Flow playback (no model); anything persisted across runs.

- **D10. Earlier rounds carry state, not transcripts** (audit change 1). A fresh round gets a compact state: what the run established (rows read, acts landed, the draft, open checks, the current page state), with earlier calls as short references, never every call's result whole. Later results replace earlier ones as references. Measured on the recordings, this is most of the spend.
- **D11. The offered tool list never changes mid-run** (audit change 4). Withdrawn looks are gone with D4; anything still withdrawn is refused by name, never removed from the schema.
- **D12. Decisions are native tool calls** (audit change 3), not a JSON string inside JSON, so the provider constrains the shape. t1025's shared decision reading stays the one reader.
- **D13. A list read is one call that detects the list itself** (audit change 2; the user's 2026-11-20 rule "keep all columns data during extraction"). The model names the list by a handle in the view (or its words); the read detects it and keeps every field. A separate detection stays available but is no longer required.
- **D14. No judge when nothing changed since the last no** (audit change 7). The same evidence gets the same no, with the same reasons, at no cost.
- **D15. No page search** (user, 2026-11-25). `find_on_page` leaves the catalog. The full-page request (D5) is the one way to see more than the view: hidden elements and their attributes, in parts under the data limit.
- **D16. The framework drafts the Flow; the model edits it** (user, 2026-11-25).
  - The draft is written from the acts and reads that worked, in order, with dead ends, failed and no-effect calls and repeats left out, and the asked table's read as the result.
  - The model is able and told to edit it for a leaner Flow: loops over repeated steps, parameters for typed values, the result read, dropping waste.
  - The draft-editing grammar shrinks to those edits.
  - Rules kept: lasting acts are never done twice, and permissions are untouched.

## Phases

Three workstreams, partitioned by file, each with its own sub-supervisor and task branch:

| Workstream | Decisions | Branch | Owns |
| --- | --- | --- | --- |
| W1 What the model sees | D1-D8, D10, D11, D14, D15 | t1036 `page-diff-delivery` | Core decision context, evidence window, rounds and earlier rounds, page channel, look removal, judge skip; domain page view, page key, stable element keys (content script) |
| W2 How the model acts | D12, D13 | t1038 `native-decisions-one-read` | Core provider adapters' decision transport and decision reading; domain read and detect nodes, extraction request, content list reader |
| W3 The framework drafts the Flow | D16 | t1037 `auto-draft` (design now, build after W1 merges) | Core `runtime/flow-authoring/draft/**`, the amendment handler and its feedback, the draft's guidance; the evidence loop only through W1's merged shape |

The exact owned and forbidden paths, and the interfaces fixed between workstreams, are in each brief under `page-diff-delivery-plan/briefs/` ([common.md](./page-diff-delivery-plan/briefs/common.md) binds all three). The one file two workstreams needed, Core `runtime/llm/anthropic/decision-check.ts`, is W2's: W1 ends look withdrawal at its source and W2 drops the adapter's withdrawn-action allowance.

Each workstream proves itself offline:
- unit tests;
- the five recordings replayed through the new code, with tokens per request and decisions old against new;
- a provider-free browser run on a realistic scenario.

The lead then integrates W1 then W2, re-runs the narrow checks, and runs P5 live: one watched bigbox run on Sonnet, then the other nine scoreboard tasks on four lanes.

## Validation

- Narrow checks per the repository rules (typechecks of touched packages, the tests beside each change, both audits). Full suites run in the day's sweep.
- P4's token report is the acceptance for D6 and D8: page tokens per request and new (uncached) tokens per request on the recordings, before and after.
- Live acceptance as in AGENTS.md (deterministic attempts after the exploring one).

## Work Ledger

### 2026-11-25 - W1 (t1036) integrated with W2 combined (fluxiq 0.54.21); the scripted bigbox run passes 4 of 4; t1041, t1042 and W3 phase 2 dispatched
- Changed:
  - **W1's D1-D8, D10, D11, D14, D15:**
    - page deltas keyed by the URL without its query, within a 20,000-character page budget;
    - `core.full_page` and stable `tN` handles;
    - no look withdrawal, no `web.find_on_page`, no capture node;
    - earlier rounds carried as compact state;
    - no judge call on an unchanged state;
    - the judge wants a before state only after a lasting act.
  - **Combining with W2 in W1's lane** (worker t1036-g):
    - three conflicts in the scripted model resolved;
    - handles in tests now come from `pageChannel.fullPage`;
    - the carried-repair tests answer DeepSeek's required decision tool call;
    - the dead `withdrawn-actions.ts` is deleted.
  - **Round 2 of the same worker:**
    - the refusal words no longer tell the model to look;
    - `detect` binds a handle that is still on the page.
- Validation: the lead's run on the t1036 trees, with W2 and `dev` merged in.
  - Core: `pnpm --filter fluxiq check` exit 0. `vitest-groups --groups=parallel,real-sql` over `runtime/llm runtime/models runtime/result-verification runtime/answer-first framework/automation-service/service/answer-first runtime/project-agents runtime/adaptation` printed `Test Files 890 passed (890)`, `Tests 7884 passed (7884)`, then `Test Files 77 passed (77)`, `Tests 525 passed (525)`, `all groups passed`. Core audit `passed (577 warning(s), 903 baselined)`; Core libraries built.
  - Domain: `llm-evidence output-nodes actions/extraction extraction runtime/tests element-fingerprint target-reacquire state-diff` printed `# tests 2558 # pass 2558 # fail 0`; domain check exit 0.
  - Extension: `# tests 4168 # pass 4168 # fail 0`.
  - Test-runner build exit 0; scripted-model and flow-chart tests `# tests 138 # pass 138`; downstream audit passed; model-text ok.
  - `pnpm task finish t1036`: downstream audit passed; Core `pnpm check` passed with its contract tests.
  - Core bumped to 0.54.21; both `dev`s pushed (Core `9b44c1dc6`, downstream `3ccaca97d`); shared Core synced and built.
- Evidence (the worker's run, which the lead read): the scripted bigbox run `run-mww1qgyl-bf8909a0` printed `status: passed`.
  - Attempt 1 explored and was confirmed: 16 rows, 15 calls, 32 s.
  - Attempts 2-4 ran `flow.f9e2d740` with each continuation held: 1, 0 and 0 calls, about 14 s each.
  - No file in the run carries `read_invalid`, `before_state_missing` or `judged_unsure`.
  - `attempt-1/flow.png` shows the expected Flow: navigate, type, category, Delivery, sort, then a loop of read and next page. The consent and offer detours are left out.
- Found:
  - **The answer's column headers are the site's words (`link_text | price | number_2`), not the asked names.** Diagnosed in `reports/t1036/h-column-names-diagnosis.md`: `retained-schema.ts` labels a renamed column with the site word, a behaviour from t982/t997 → t1041.
- Then:
  - `git merge dev` into t1015 (fast-forward) and t1037 on both sides, each `contains dev: yes`.
  - Opened t1041 (asked column names, worker) and t1042 (W1 leftovers: recovery gets the page channel and loses its look; no look wording in `tool-failure.ts`; reads and presses bind a handle still on the page; worker-heavy).
  - Resumed W3 for phase 2, which also owns the fixed tool list (`core.run_flow` from the first decision), the look phrasings in its files, `EXTRACTION_FROM`, and drafted reads keeping their stored handle.
  - The `maxStepsWithoutProgress` removal follows W3, since it crosses W3's files.

### 2026-11-25 - W2 (t1038) integrated (fluxiq 0.54.20); lanes merged with dev
- **Changed:**
  - D12: decisions go as native tool calls (Anthropic auto with one call, DeepSeek required); `outputSchema` is gone from the user message; the withdrawn-action allowance is gone from `decision-check.ts`.
  - D13: a read detects its own list and keeps every column.
  - Older fixes: the read payload kept `rejectedObservations` without their samples (the cause of `web_judge.read_invalid`); the scripted server misrouted a continued judge.
  - At integration the lead applied W2's replacement for `judge-continues-decider.test.ts`, and updated `read-columns/tests/split-rows-read.test.ts`, which still expected the old refusal words ("this read's handle names" is now "this read names").
- Validation: the lead's run on the t1038 trees with `dev` merged in.
  - Core `vitest-groups --groups=parallel,real-sql` over `runtime/llm runtime/models runtime/result-verification framework/automation-service runtime/flow-authoring/bootstrap runtime/project-agents` printed `all groups passed: parallel, real-sql` (real-sql `Test Files 256 passed`, `Tests 1611 passed | 1 skipped`).
  - `pnpm --filter fluxiq check` exit 0; Core audit `passed (574 warning(s), 903 baselined)`; Core libraries built.
  - Domain `llm-evidence output-nodes actions/extraction extraction`: first `# tests 2265 # pass 2264 # fail 1` (the split-rows wording), then after the fix `# pass 2265 # fail 0`.
  - Domain check exit 0, after the first attempt refused on a partly rebuilt Core; test-runner build exit 0; scripted-model and flow-chart tests `# tests 131 # pass 131`.
  - Downstream audit passed; model-text ok.
  - `pnpm task finish t1038`: downstream audit passed; Core `pnpm check` passed with its contract tests (`system-prompt`, `extraction-vocabulary`, `issue-feedback`).
  - Core version bumped to 0.54.20; both `dev`s pushed (Core `3078cc4a3`, downstream `6f32a792b`); shared Core synced to `3078cc4a3` and built.
- **Then:** `git merge dev` into t1015 (fast-forward) and into t1037 on both sides; each printed `contains dev: yes`. The t1036 lane holds W2 through the branch merge and takes `dev` once its combining worker stops before its Lab run.
- **Not verified live:** strict-tool limits, how often Sonnet makes no tool call under auto, real token counts.

### 2026-11-25 - Every lane merged with dev; W2 committed on its branch; t1040 opened
- Why: the user (angry): "merge all test runs before doing more tests ... MERGE TO DEV AND MERGE TEST LANES AFTER ANY SERIOUS UPDATES". t1039 had reached `dev` while W1 kept running scripted Lab runs on a tree without it.
- Done:
  - `git merge dev` (at `3b610be39`) into t1015, t1036, t1037 and t1038. For t1036 the lead stashed only the one overlapping file (`docs/architecture/testing-facility.md`), merged, then popped it; no conflict.
  - Core `dev` had not moved, so the Core trees needed nothing.
  - `pnpm install --frozen-lockfile` in each lane, for `@resvg/resvg-wasm`.
  - W1 told to start no new run until dev was in.
  - The rule added to AGENTS.md, "Branches And Worktrees".
  - t1040 opened: the Lab's behind-dev guard is extended from live runs to every run.
  - W2 committed WIP on its branch (Core `81536c5cb`, downstream `21a36692e`, both pushed).
- Validation:
  - `git merge-base --is-ancestor dev HEAD` printed `contains dev: yes` for all four downstream lanes.
  - The same check on each lane's Core and the shared Core: `yes`.
  - The installs printed `Done in 1.2s` to `Done in 1.4s`, with one resvg package present in each lane.

### 2026-11-25 - t1037 (W3) phase 1 verified on its branch
- Changed: Core `runtime/flow-authoring/draft/{compose,amendment/edits}/**` (new), draft `step`/`entry`/amendment files, `decision-handlers/amendment.ts` (gated on `draftEdits: "framework"`), `draft-amendment-feedback`, `held-amendments.ts`, `ui/activity-action/refusal-words.ts`; reports `reports/t1037-auto-draft.md` and `reports/t1037/{compose,edits,replay}.md`. Committed as Core `adbafa688` and merged with Core dev (`8a3e79572`); downstream reports merged with dev (`c14eccd4b`).
- Validation: the lead's run on the merged tree. Core groups over `flow-authoring`, `runtime/llm`, `ui/activity-action` and `answer-first`: parallel `Tests  8230 passed | 2 skipped (8232)`, real-sql `Tests  526 passed (526)`, "all groups passed". `pnpm --filter fluxiq check` exit 0. Core audit `passed (573 warning(s), 903 baselined)`. Downstream audit `passed (261 warning(s), 551 baselined)`. `model-text: ok`.
- Follow-up: phase 2 after W1 merges.

### 2026-11-25 - Dispatch: briefs, t1034 first, three sub-supervisors
- Changed:
  - Briefs `page-diff-delivery-plan/briefs/{common,t1036-page-diff-delivery,t1037-auto-draft,t1038-native-decisions-one-read}.md`. A read-only search mapped each workstream's files. One file was shared, `anthropic/decision-check.ts`, and was given to W2, with the look-withdrawal interface fixed in both briefs.
  - t1034 verified and integrated first, because it touched the decision reading, the adapter and look withdrawal that W1 and W2 rebuild (ledger in the data-first plan).
  - W3 (t1037) opened and was dispatched before t1034 merged, since it shares no file with it. W1 (t1036) and W2 (t1038) started from the post-t1034 heads.
- Validation: `node scripts/structure-audit.mjs` on dev after the briefs: `structure-audit: passed (261 warning(s), 551 baselined)`.
- Follow-up: the sub-supervisors' reports; integration order W1, W2, W3.

### 2026-11-25 - Handoff: decided and planned, not dispatched
- Changed:
  - The user's decisions were recorded in AGENTS.md and here: Sonnet for Lab runs, page diffs and no look, page search dropped, the framework drafting the Flow.
  - The t1035 audit is on dev.
  - The Sonnet bigbox run ran once (run-mwvgjb8c, $0.80, oracle: wrong item).
  - Orphaned background processes of this session were stopped: 15 `tail -F` left by stopped Monitors, 2 paid-round watcher scripts, 4 old verification shells.
- Validation: not validated: plan and records only. The lead's verification of t1034 was stopped unfinished (TaskStop) at wrap-up; the worker's own run: `vitest-groups` gave 794/794 and 86/86, domain `llm-evidence` gave 1778 pass 0 fail, checks exit 0, audits passed.
- Follow-up: Current State "Next".

### 2026-11-25 - Planned on the user's instruction; build dispatched
- Changed: this document; AGENTS.md rule "The page reaches the model as run-scoped diffs; there is no look command". Lab runs start on Sonnet (AGENTS.md, same day).
- Evidence used: the five 11-24 bigbox recordings in `fxwork/recorded-evidence/t1015-bigbox/`. Page views are 4-11 KB. Input tokens per request run from 25k to 276k, with a median of about 24k uncached.
- Validation: not validated: plan only.
- Follow-up: the sub-supervisor's report (P1-P4).
