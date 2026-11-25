# t1036 (W1): what the model sees - sub-supervisor report

Status: see Outcome at the end. The proposals were recorded before any build (brief "Order") and are kept as written; "Departures from the proposals" says where the build differs.

## Proposals (recorded before building on them)

### P-a. Page key

The domain names the key; Core never reads it, only compares it for equality.

- Web domain: the page's screened location, normalized: lower-cased scheme and host, port only when not the
  scheme's default, path with a trailing slash dropped (except the root `/`), query parameters sorted by name
  (each name's values keep their order; an empty query is dropped), and the fragment dropped unless it is a route
  (`#/...` or `#!...`), which stays.
- A dialog, a popup or a covering layer over a page is the same key: its lines arrive as a diff.
- A filter or search that changes the query is a new key: its first delivery is whole (D6's "a diff larger than a
  re-sent base is sent as a new base" bounds the cost when two keys are near-identical).
- Nothing about the key is stored past the run.

### P-b. Keyed-line view (the Core/domain interface, fixed for the workers)

A tool result that ran on a page carries, under the member the domain declares (`pageChannel.member`, web:
`pageView`):

```ts
type AutomationStudioLlmPageLine = { key: string; text: string; extra?: true };
type AutomationStudioLlmPageView = { key: string; lines: AutomationStudioLlmPageLine[] };
```

- `lines` are in page order; their texts joined by "\n" are exactly the page string the model reads today
  (header lines, a blank line, element and marker lines).
- An element line's key is its handle (`t49`); its text starts with that handle, as today.
- A header line's key is its label (`PAGE`, `URL`, `VIEW`, `COVERING`, `DIALOG`, `ARRIVED`, ...); the blank
  separator is `-`.
- A marker line (a landmark `[main]`, a repeat `- 2/8`, a fold `--- below the fold ---`) is keyed to the element
  line it stands before: `^t62` for the first marker before `t62`, `^t62.2` for the second.
- Keys are unique within one view. Core diffs by key (added, removed, changed text) and keeps page order; it never
  parses a text.
- `extra: true` marks a line only a full capture shows (hidden elements and attributes, D5/D15): shown in that
  delivery, never part of the base a later diff compares with.
- A diff is shown git-style: each hunk opens with one unchanged context line (its text), then `- ` removed,
  `+ ` added and `~ ` changed lines (new text). Words are Core's and generic.

### P-c. Per-request page budget default

- Measured: the 118 page views in the five recordings are 4,101-13,271 characters of view text (median 10,598,
  90th percentile 12,294).
- Default: **20,000 characters of page text per delivery** (about 1.5x the largest recorded view, roughly 7-10k
  tokens), so every recorded view arrives whole in one part, and a page past it arrives in parts. Characters, not
  tokens, so the cut is deterministic and provider-neutral.
- Configurable: the domain may declare `pageChannel.budgetChars`; Core's constant is the default.
- Over the budget: page order up to the budget at a line boundary, then a Core note saying how many lines were left
  out and to call `core.full_page` with `part: N`. A diff longer than its key's base is sent as a new base. The limit
  bounds payload only: nothing ends or resets a round or run on it.

### P-d. How the channel lives in the window (design decisions taken)

- Deliveries ride inside each result entry (D3), so they sit in the append-only history and are cached with it;
  the newest delivery is in the newest result, after the stable prefix (D8). The whole-page `core.current_view`
  tail goes for pages (it stays for a domain without `pageChannel`, and for held read rows).
- The channel is a deterministic projection over the window's own records: what a key's base is depends only on
  earlier records. A key whose base is not in the window (a fresh round's window, or a base dropped by D7) gets a
  whole view. So a fresh round shows the current page whole once, then diffs.
- D7: when a key's diffs since its base outgrow the base, the next delivery for it is a new base and the earlier
  copies of that key become short references (one cache break, then append-only again).
- Order (D8): stable prefix (system text, tools, draft) first, then the append-only history with its page
  deliveries, then the per-request notes Core rewrites every call.
- `core.full_page`: a Core tool. Without `part` it runs the domain's declared full capture (web: the existing
  `includeHidden` capture), resets the key's base to that capture's non-extra lines and returns part 1; with
  `part: N` it returns part N of the latest over-budget delivery of the current key, without recapturing.
- Handles (D2): the same element keeps its `tN` for the whole run when it is the same element by its fingerprint
  and place (within one document, by the content script's own element identity; across documents, by the
  fingerprint match `stable-handles.ts` already does, only where unambiguous). Ambiguous means a new handle.

## Outcome

**Partial.**

- **Built:** D1-D8, D10, D11, D14 and D15. They pass every narrow check, except failures in W2-owned tests that the removed look and search break (listed under "Open questions").
- **P4:** the replay is done, approximately.
- **Fixed after the lead's finding:** the lead's judged_unsure blocker (`judge_evidence.before_state_missing`) is fixed and shown on a re-run, with 0 occurrences.
- **Lab run:** the provider-free bigbox run shows:
  - the first view arrives whole, and changes come after it for the same address; with the user's query-free key, 13-14 of 32 later requests carry `changes`, up from 4-8;
  - there is no look or search tool;
  - the tool list is identical across all requests.
- **Not confirmed:** the run's attempt is still held for `web_judge.read_invalid`, which W2's fix covers once merged. So attempts 2-4 and their continuation proofs are not yet shown.

## Departures from the proposals (accepted by me, with evidence)

- **The page key drops the query (user decision, 2026-11-25, through the lead; it replaces P-a's query rule).**
  - The key is the URL "not including the ? params": the normalized scheme, host, non-default port and path. The fragment rule is unchanged (a route fragment `#/` or `#!` stays, any other is dropped); that part is my reading, since the user said nothing about fragments.
  - Built in `domain/src/runtime/llm-evidence/page-view/location-key.ts`. Its tests now say the query is never part of the key, and that a filter, sort or next page of one path is the same key while another path is another. `docs/architecture/page-evidence.md` is updated.
  - **Lab `changes` counts, before and after:** with the query in the key, the scripted bigbox run carried `changes` in 4 of 32 later requests (`run-mwvsbihx`), 7 of 32 (`run-mwvtl0qe`) and 8 of 32 (`run-mwvw1r9k`). With the new key (no other change): **14 of 32** (round 5, `run-mwvwk117-6ffa4ca0`), and **13 of 32** after dev was merged in (round 6, `run-mwvxrxq8-84effe55`). The other later requests still carry a whole page: a new path, a page that changed too much, or a key shown whole again under D7. Page text per request is at most 19,700 characters, within the 20,000 budget.
  - **P4, newest delivery per request (whole / changes / unchanged):** the five recordings give the same counts with either key, except a few hundred tokens:

    | run | with query | without query |
    | --- | --- | --- |
    | mwus | 4/3/0 | 4/3/0 |
    | mwuuo | 10/3/1 | 10/3/1 |
    | mwuxd | 4/7/0 | 4/7/0 |
    | mwv5 | 3/5/0 | 3/5/0 |
    | mwveg | 10/10/8 | 10/10/8 |

    - Mean page tokens per request move from 6,291 to 6,267, 5,410 to 5,370, and 5,997 to 5,911.
    - Why the recordings cannot show the gain: their handles were renumbered on every new page (no D2). So a query change shows as almost every line changed, which the channel sends as a new base under either key. The Lab run, which has D2's stable handles, is the measure that counts.

- **The directory is `runtime/llm/view-channel/`, not `page-channel/`.** Core's guard test `harness-options/tests/builtin.test.ts` refuses the word "page" in harness-options code, and the registry imports the channel. The worker renamed the directory rather than weaken the guard. Type names, `core.full_page` and the model's words are unchanged.
- **The draft stays after the history, not in the stable prefix (D8).**
  - Evidence: `core.flow_draft` changed in 296 of 462 consecutive recorded requests (`test-runs/t1036-a/draft-churn.mjs`). In the prefix, every change would send the whole history uncached.
  - Order now: head (system, tools, task, draft guidance), then results with their page deliveries in place, then passing notes, `core.current_view` (non-page views and held read rows only), `core.current_flow`, `core.evidence_history`, `core.flow_draft`, `core.budget`.
  - Nothing before the history is declared moving, so the adapter's cache marker stays on the history.
  - If W3's framework-written draft turns out stable, moving it first is a one-line change; re-measure with the same script.
  - **This departs from the lead's stable interface ("draft in the prefix"); the lead should confirm it.**
- **The budget covers the whole request, not each delivery.**
  - Round 1 kept one copy per page key the window had met, so page text per request rose (one run averaged 40,327 characters). I rejected that against the user's "data limit on pages so not everything is sent on every request".
  - Now the page text across all keys in one request stays within the 20,000-character budget.
  - The least recently delivered other pages become `{ key, droppedAt }` references, oldest first, and come back whole when the work returns to them. The current page is never dropped.

## Team

| Worker | Tier | Brief | Outcome | What I verified |
| --- | --- | --- | --- | --- |
| a-page-channel | worker-heavy (Opus), 2 rounds | Round 1: Core page channel (D1, D3, D5, D6, D7, D8). Round 2: the per-request limit, switching the channel on at 5 call sites, removing look withdrawal from evidence-loop.ts, a recall store that outlives a round, E's wiring | Done | Core structure audit; model-text; Core library build (tsc of all non-test source) exit 0; Core typecheck and tests (below); its projection driven by my own P4 script |
| b-keyed-view-handles | worker-heavy (Opus) | Domain `pageView` (P-a key, P-b keyed lines, schema `web-llm-page.v4`), D2 stable handles, full capture with `extra` lines | Partial, then finished by F and my wiring | Domain tsc clean after my tools.ts wiring; domain tests (below) |
| c-no-look-no-search | worker (Sonnet) | D4, D11, D15 in its owned Core and domain files | Partial; its edits in other workers' files were done by A (round 2) and F | Core typecheck covers its seams after A removed them |
| d-earlier-rounds-state | worker (Sonnet) | D10: a compact earlier-rounds state | Partial; its recall dependency was built by A (round 2) | Entry sizes from its rebuilt entries: run-mwuuo3zk step 300 went from 195,114 to 7,011 characters, run-mwuxd2v9 step 217 from 397,870 to 14,970 |
| e-judge-unchanged | worker (Sonnet) | D14: no judge call on an unchanged state | Partial; its wiring in run-attempt.ts was done by A (round 2) | The cause it found: the old digest hashed the raw end view (page text with handles, read afresh at each completion), which the judge never sees. The new digest hashes what the judge is shown |
| f-downstream-integration | worker (Sonnet), 2 rounds | Round 1: remove find_on_page from tools.ts and page-find, fix the tests the keyed view broke. Round 2: the scripted bigbox Lab run | Round 1 Partial (W2-owned tests left); round 2 see "Lab run" | Domain tsc and test runs (below) |

No escalation between tiers. Six workers, within the brief's budget; the second rounds continued the same agents.

## Integration changes I made

- `domain/src/runtime/llm-evidence/runtime-contract/runtime.ts`: B had declared `pageChannel` and `fullPage` side by side. Core's binding nests `fullPage` inside `pageChannel`, so the domain's contract now has Core's shape and the runtime is handed to Core as it is.
- `domain/src/runtime/llm-evidence/tools.ts`: the `pageChannel: { member: "pageView", fullPage: webLlmFullPage({ capture, restamp, keep }) }` block beside `observedStateKeys`, from B's lines, plus the import of `./full-page`.
- Rebuilt Core's libraries twice: before the first domain check, and after Core edits ended.
- `domain/src/runtime/tests/current-page.ts`: the scripted provider of the carried-repair tests read the page from `core.current_view`. It now rebuilds the page from the channel's deliveries (newest whole for the newest key, then its changes), the same reading as the Lab's scripted model.

- The user's page key (2026-11-25): `page-view/location-key.ts` drops the query. Its tests in `page-view/tests/location-key.test.ts`, `keyed-view.test.ts` and `published-page.test.ts` now expect the query-free key, and `docs/architecture/page-evidence.md` says so.

### The lead's judged_unsure finding (Lab run `run-mwvsbihx-e60f9f0f`)

The judge said yes with no defects and Core still held the result `answer_first.judged_unsure`, citing two evidence gaps.

1. **`judge_evidence.before_state_missing`: the cause and the fix are W1's.**
   - **Part one, caused by W1.** My brief told B to take `page` out of the domain's observed-state keys, so the page channel would carry it. But Core reads those keys well beyond the model's window: the page the judge is told a run started on (`result-summary.ts`, `startedOn`), the end-view reader, and the view a build test's step observation leaves out. With no page key declared, those readers found no page.
     - Fix: `domain/src/runtime/llm-evidence/observed-state/observed-state-keys.ts` declares `pageView` again. Core's window already takes the channel's member out of its view group (`context-window.ts`), so the model still gets deliveries, not a whole-page tail.
     - B's test `observed-state/tests/observed-state-keys.test.ts` encoded my wrong premise. It now asserts `pageView` is declared and `page` is not.
     - New test `judge-evidence/tests/page-view-declared.test.ts`: the runtime's page channel member is among its observed-state keys.
   - **Part two, on `dev` since 11-04 and 11-22, and exposed by this read-only task.** Re-declaring `pageView` did not clear the gap (re-run `run-mwvtl0qe-73df7041`, still in 50 step files).
     - Core's `runtime/result-verification/judge-evidence/summary.ts` asked for a before state after any act that applied an effect.
     - An exploration reads a before side only ahead of a declared lasting act (`answer-first/witnesses/witnesses.ts`).
     - A task whose acts are only a dismissal, filters and a sort therefore never had one, and every completion stayed unconfirmed.
     - Fix, as the lead decided: the before state is required only when a lasting act ran, meaning an act with a declared class, or a step with declared consequences that applied or may have. That follows the user's rule of 2026-10-27, judging the change from the before-state recorded just before the lasting acts. The end state is still required after any act.
     - Tests in `judge-evidence/tests/summary.test.ts`: a yes after only acts with no lasting class, with no before reading, is confirmed (`answers`); a yes after a lasting act with no before reading is still held (`unsure`).
     - The existing case "requires real witnesses for a data-role mixed action with consequences %j" now expects the before gap only for declared consequences (`["update"]`), and the after gap in every case.
     - I first tried the other side (reading the before witness ahead of any node run, in `answer-first/attempt/call-chain.ts` and `flow-stage.ts`). I reverted that completely when the lead chose the judge-side rule.
2. **`web_judge.read_invalid`: not W1's, and left to W2.**
   - Cause: `withoutSamples` in `domain/src/runtime/llm-evidence/node-run/rejected-rows.ts` drops the rejected samples from the recorded read but keeps `rejectedObservations`, which are indexed by those samples, so the summary reader drops the whole summary.
   - I had fixed it here, then reverted the fix and its test on the lead's word: W2 fixed the same line, with a regression test, in its own tree.
   - Until W2 merges, a scripted bigbox run in this tree still shows `read_invalid`.

## Decisions taken at integration

- **B's plan-resolution change is accepted: it fits D2.** A bare handle whose remembered pages differ only in selector positions now resolves to its newest view instead of `ambiguous`.
- **E's handling of the answer text is accepted: new words are a new claim.** E counts the model's answer text as deciding input, so a resubmission with new answer words is judged again.
  - Recorded call run-mwv5m906 step 94 would still be judged.
  - Steps 163 and 182 of run-mwuxd2v9, and step 81 of run-mwv5m906, would be skipped.
- **C kept `web.recovery.inspect`, and I left it for now.** It is a model-requested capture on the runtime-recovery path, which has no page channel. It is listed below for the lead.

## P4 replay (five recordings, old against new)

Command: `node --experimental-strip-types test-runs/t1036/p4-table.mjs` (Ext tree).

How it measures:
- **Page text.** Each recorded result's page string is cut into keyed lines by the P-b rules and run through Core's real projection (`automationStudioLlmPageChannelProjection`), with the budget.
  - Keys are the recorded locations without their query and fragment (the user's key of 2026-11-25). With the query kept, every column moves by under 1% (see "Departures from the proposals").
  - D2 is not applied, because the recordings' handles are not stable across pages, so changes after a URL change are overstated.
- **Earlier rounds.** D's measured ratio for the rebuilt entry (3.7%) is applied to each request's `core.earlier_rounds`.
- **Tokens.** Each request's own tokens per character (its input tokens over its characters) converts the removed and added characters.
- **Uncached tokens** are cache miss plus cache write. The new figure subtracts:
  - the change in uncached page text (the old tail, rewritten on every request, against the new appended deliveries);
  - the earlier-rounds entry, where it first appears in a round.

What it does not replay:
- **Decisions.** No model was called. The decisions column counts the recorded decisions that named a tool the new catalog no longer offers (now refused by name).
- **Judge calls** are the recorded counts. E's rule would have skipped 3 of the 4 audited unchanged-state calls.
- **Not modelled:** read rows and detection fields inside a round (W2's D13), and the tool schema shrinking.

| run | decisions | page tokens/request, mean old -> new | input tokens/request, mean old -> new | max old -> new | uncached tokens/request, mean old -> new | requests over 100k, old -> new | decisions on a tool now gone (search + look) | judge calls |
| --- | --- | --- | --- | --- | --- | --- | --- | --- |
| mwus396e | 40 | 4811 -> 6267 | 78018 -> 79473 | 97442 -> 99754 | 25190 -> 21130 | 0 -> 0 | 7 + 0 | 0 |
| mwuuo3zk | 143 | 4974 -> 5370 | 105658 -> 68576 | 154984 -> 86575 | 28690 -> 22680 | 86 -> 0 | 31 + 0 | 0 |
| mwuxd2v9 | 82 | 2933 -> 4382 | 177328 -> 96889 | 309528 -> 132773 | 33383 -> 27136 | 65 -> 44 | 14 + 1 | 7 |
| mwv5m906 | 74 | 4400 -> 3141 | 72054 -> 65532 | 100813 -> 87590 | 25229 -> 20811 | 2 -> 0 | 33 + 0 | 4 |
| mwveg5ls | 128 | 6605 -> 5911 | 160452 -> 93602 | 279227 -> 120531 | 39404 -> 32397 | 94 -> 54 | 24 + 0 | 11 |

What it shows:
- **Input per request falls 35-45% in the three long runs:** mean 105.7k to 68.6k, 177.3k to 96.9k, and 160.5k to 93.6k tokens. The peak falls from 309.5k to 132.8k. Requests over Haiku's 100k price step fall from 247 to 98. The two short runs barely move, because they had no earlier rounds.
- **Uncached tokens per request fall 16-21%.** The page tail rewritten on every decision is gone. What stays uncached is mostly the new result, plus the notes and draft after the history.
- **Page tokens per request rise in two runs and fall in two** (for example 4.8k to 6.3k in mwus396e).
  - The window now keeps every page met within the 20,000-character budget, not only the latest page, and that text is cached.
  - Every request's page text stays within the budget: the largest is 19,200 characters (A's table in `reports/t1036/a-page-channel.md`, Round 2).
- **110 recorded decisions named tools that are now gone:** 109 searches and 1 deliberate look.

## Lab run (provider-free bigbox-retail, lab slot 2, headed, with the run watcher)

Command: `FLUXIQ_LAB_INSTANCE=t1036-lab heavy-slot run t1036-lab -- pnpm lab attempt bigbox-retail --task bigbox-retail-rated-delivery-towels --authoring-mode answer-first --scripted-model --attempts 4`.

It ran three times. Each run changed the scripted model's script for the cause the run before it showed, so no run was a repeat of the last. The watcher raised 0 alerts.

- **Run 1 (`run-mwvrnwa9-a359d0f4`)** stopped at request 3. The page now prints facet counts (`checkbox "Paper Towels (28)"`), and the script's pattern did not allow one.
- **Run 2 (`run-mwvrysoc-81bbebeb`)** reached the end, but every completion was refused `processing_binding_missing`: the script's read did not keep `ad` and `fulfillment`.
- **Run 3 (`run-mwvs5bch-26cd6b81`)** had its repeat amendment refused (`span_holds_routing`) because the first-visit detours (consent, offer) were in the draft. The script now drops them first.
- **Last run (`run-mwvsbihx-e60f9f0f`)** got furthest:
  - Attempt 1 built the Flow (consent dropped, read and next-page repeated, `core.run_flow` read the pages) and reached `complete`.
  - Core's completion check answered `answer_first.judged_unsure`, because the judge evidence holds `web_judge.read_invalid` and `judge_evidence.before_state_missing`. Completions repeated until the script's 32 replies were spent: `{"status":"not_judged","why":"AttemptScriptRefused"}`.
  - Attempts 2-4 and their continuation proofs were never reached.

Cause of the last stop, outside W1:
- The read's extraction summary carries `rejectedObservations` without `rejectedSamples`, and `webAutomationExtractionSummaryValue` (`domain/src/actions/extraction/summary.ts:368-369`, W2's path) then returns no summary, so `judge-evidence/project.ts:63` marks the read invalid. Neither file was changed for that line in this tree. B's only change in `project.ts` is the page-text test at line 105.
- `judge_evidence.before_state_missing` comes from Core's `result-verification/judge-evidence/summary.ts:54` and was not investigated.
- Whether the same scripted run passes on `dev` was not established.

What the last run's 33 requests show (`test-runs/t1036f/analyse-run.mjs` over `model/evidence_tool_decision-NNN.request.json`):

| Check | Observed |
| --- | --- |
| First request | one delivery, `whole` (6,952 characters) |
| Later requests carrying `changes` | 4 of 32 (requests 2, 8, 21 and 32). The others carry the newest page `whole`, because each facet press changes the query and so the page key (P-a), plus `droppedAt` references to older pages |
| Page text per request | 6,952 to 13,566 characters, never above the 20,000 budget |
| `web.find_on_page` offered | in 0 of 33 requests |
| Capture node in the `run_node` enum | in 0 of 33 requests (enum of 19 in every request) |
| Offered tool list | identical in all 33 requests (one digest, `984119dba31c`): core.describe_nodes, core.full_page, core.loop_decision, core.recall_result, core.run_flow, core.run_node, core.set_result_processing, web.describe_element, web.detect_repeating_structure |

**Later runs, after the lead's judged_unsure finding (see "Integration changes I made"):**

- **`run-mwvtl0qe-73df7041`.** F fixed the scripted model's judge reply: its first judge ask is a continuation, which `wire-request.ts` had read as a chat turn. `pageView` was declared again. Result:
  - `web_judge.read_invalid` was in 0 files (my since-reverted `rejected-rows.ts` fix was still in);
  - `before_state_missing` was still in 50 files.
- **`run-mwvw1r9k-9b10a381`, the last run.** It ran after the judge-side before-state fix, a Core rebuild, and the revert of `rejected-rows.ts`:
  - `before_state_missing` is in 0 step files;
  - the judge's evidence names one gap: `[{"source":"read-first","codes":["web_judge.read_invalid"]}]`;
  - Core's refusal: "The check said yes, but Core held it unconfirmed ... read-first (web_judge.read_invalid)". That is W2's fix, which is not in this tree;
  - attempt 1 was not confirmed, so attempts 2-4 were not reached;
  - requests: the first is `whole`; 8 of 32 later requests carry `changes`; `web.find_on_page` is in 0 of 33; the capture node is in no `run_node` enum; one tool-list digest (`984119dba31c`) covers all 33;
  - 0 watcher alerts.

**Runs with the query-free key (user decision, 2026-11-25):**

- **Round 5 (`run-mwvwk117-6ffa4ca0`):**
  - `changes` in 14 of 32 later requests;
  - 33 whole deliveries and 134 references;
  - page text per request 6,952-19,700 characters;
  - `before_state_missing` in 0 files;
  - the only judge gap is `read-first: web_judge.read_invalid`.
- **Round 6, on the tree with dev 3b610be39 merged in (`run-mwvxrxq8-84effe55`, no `behind-dev` refusal):**
  - `changes` in 13 of 32 later requests;
  - page text per request 6,952-17,999 characters;
  - `before_state_missing` in 0 files, and `read_invalid` in 50 (W2's fix is not in dev yet);
  - no `web.find_on_page`, and no capture node in any `run_node` enum;
  - one tool-list digest across all 33 requests.
- **Round 6 attempt outcome:** attempt 1 was held only for `read_invalid`, so attempts 2-4 were not reached.
- **Flow charts (t1039):** `test-runs/instances/t1036-lab/attempts/run-mwvxrxq8-84effe55/flow.png` and `flow.svg`. They sit beside `attempt.json`, not under `attempt-N/`, because the attempt never ended.
  - The chart is "Flow chart (draft)": the instruction, the parameters (Search "paper towels", Sort by "rating_high"), then the steps from NAVIGATE through the clicks on "Paper Towels (28)" and "Delivery (21)" and the sort choice.
  - I did not open the image myself; this description is F's.

Test-runner unit tests (F): `node --test "dist/attempt-lane/scripted-model/**/*.test.js"` -> `# tests 116 / # pass 116 / # fail 0`. F also fixed the structure audit's swallowed-failure finding in `wire-request.ts`. This includes four tests that rebuild the page from deliveries made by Core's own projection.

**What this means (first runs, query still in the key):** a filter press was a new address and arrived whole. The user then dropped the query from the key (2026-11-25), and the later rounds above carry `changes` in 13-14 of 32 requests.

## Commands run and observed results

**After the judged_unsure fixes (final tree), run by me:**

- **Core typecheck:** `pnpm --filter fluxiq check` -> exit 2. The only errors are the two in W2's `anthropic/tests/asked-table-replies.test.ts`.
- **Core tests:** `vitest-groups --groups=parallel,real-sql src/runtime/result-verification src/framework/automation-service/service/answer-first src/runtime/answer-first`. Result:
  - parallel: `Test Files 399 passed (399)`, `Tests 3250 passed (3250)`;
  - real-sql: `Test Files 74 passed (74)`, `Tests 507 passed (507)`;
  - `all groups passed: parallel, real-sql`.
- **Domain tests:** `DOMAIN_TEST_BUILD_LABEL=t1036s node scripts/test-domain.mjs llm-evidence runtime/tests` -> `# tests 1963 / # pass 1958 / # fail 5`.
- **On the merged tree (dev 3b610be39, the query-free key included):**
  - domain tests, `test-domain.mjs llm-evidence runtime/tests element-fingerprint target-reacquire state-diff` -> `# tests 2070 / # pass 2065 / # fail 5`; the same five W2-owned tests fail;
  - `pnpm --filter @fluxiq-web-extension/domain check` -> exit 0 (`Core's build ... is current with its source`). All five failures are W2-owned tests (listed under "Open questions").
- **Domain test typecheck:** `npx tsc -p domain/tsconfig.test.json --noEmit` -> clean.
- **Structure audits:**
  - Core -> `structure-audit: passed (576 warning(s), 903 baselined)`;
  - downstream -> `passed (262 warning(s), 550 baselined)`, after F named the expected `SyntaxError` in `wire-request.ts`.
- **Model text:** `model-text: ok`.

**Earlier, after the last worker edit of round 2:**

- **Core library build:** `pnpm --filter @fluxiq/contracts --filter @fluxiq/sdk --filter fluxiq --filter @fluxiq/client-gateway-websocket --filter @fluxiq/ui-components build` (heavy gate, Core root) -> exit 0.
- **Core typecheck:** `pnpm --filter fluxiq check` -> exit 1. The only errors are in W2's `src/runtime/llm/anthropic/tests/asked-table-replies.test.ts`:
  - `(9,10): error TS2724 ... no exported member named 'automationStudioLlmEvidenceLookWithdrawal'`;
  - `(85,25): error TS7006`.
  - Cause: the test imports the look-withdrawal module this workstream deleted (D4/D11). There are no other errors.
- **Core tests:** in `packages/fluxiq`, `NODE_OPTIONS=--max-old-space-size=3072 node ../../scripts/vitest-groups.mjs --groups=parallel,real-sql` over view-channel, evidence-recall, decision-handlers, decision-context, evidence-progress, node-tools, prior-nodes, repeat-guard, harness-options, evidence-loop, llm/tests, project-agents/supervisor, answer-first, result-verification/flow-less. Result:
  - parallel: `Test Files 362 passed (362)`, `Tests 3244 passed (3244)`;
  - real-sql: `Test Files 75 passed (75)`, `Tests 508 passed (508)`;
  - `[vitest-groups] all groups passed: parallel, real-sql`.
  - A's round-2 run covered more folders (project-build, adaptation/recovery, runtime/answer-first): `Tests 3 failed | 4386 passed (4389)`, all 3 then fixed, rerun `Tests 43 passed (43)`.
- **Core structure audit:** `node scripts/structure-audit.mjs` (Core root) -> `structure-audit: passed (576 warning(s), 903 baselined).`
- **Domain check:** `pnpm --filter @fluxiq-web-extension/domain check` -> exit 0, `core-build: FluxIQ Core's build ... is current with its source.`
- **Domain tests:** in `domain/`, `DOMAIN_TEST_BUILD_LABEL=t1036s node scripts/test-domain.mjs llm-evidence runtime/tests element-fingerprint target-reacquire state-diff` -> `# tests 2069 / # pass 2059 / # fail 10`.
  - Five carried-repair tests in `runtime/tests` failed because their scripted provider read the page from `core.current_view`. I moved their helper (`runtime/tests/current-page.ts`) to rebuild the page from the channel's deliveries, as a model reads them.
  - Rerun of `runtime/tests/carried`: `# tests 7 / # pass 7 / # fail 0`.
  - The other five failures are in W2's paths (listed below).
- **Downstream structure audit:** `node scripts/structure-audit.mjs` -> `structure-audit: passed (262 warning(s), 550 baselined).`
- **Model text:** `node scripts/check/model-text.mjs` -> `model-text: ok (203 scenario tokens, 560 model-facing Core files, 14298 string literals)`.
- **Extension (F, round 1):** `node scripts/test-extension.mjs` -> `# tests 4168 / # pass 4168 / # fail 0`; `node scripts/check-extension.mjs` -> exit 0. Not rerun by me after F's round 2.
- **P4:** `node --experimental-strip-types test-runs/t1036/p4-table.mjs` -> the table above.

## Not verified

- No live run, and no provider call (not allowed). The P4 table is an approximation: decisions are not replayed, and keys and tokens are estimated as described.
- D2 in a real browser beyond the Lab run below: handle stability across a query change is proven by unit tests only.
- E's optional `draft` input to the judge-skip digest is not passed (A, round 2). The draft still counts through what the judge is shown.
- `core.full_page` was not exercised in a browser unless the Lab run below shows it.
- The extension's e2e specs F edited were not run in a browser.

## Open questions for the lead

1. **W2 must update, in its tree, these tests that break when merged with W1:**
   - Core `src/runtime/llm/anthropic/tests/asked-table-replies.test.ts`: 3 tests and the typecheck. They import the deleted look withdrawal; build the narrowed schema by hand or drop them, along with the withdrawn-action allowance in `anthropic/decision-check.ts`.
   - `withdrawn-actions.ts` is kept only because `decision-check.ts` still imports it. Delete it once W2 drops that import.
   - Domain tests that minted handles through the removed `web.find_on_page`:
     - `structure/tests/target-binding.test.ts` "a handle only a search printed binds a detection, as it binds a press or a read";
     - `rejection-next/tests/list-handle-elsewhere.test.ts` "a read through an element's own handle with a table's columns is told it names one element, and where a list is detected and read";
     - the same file, "the same read from another page is refused as a handle of a page no longer loaded";
     - the same file, "a detection at a handle another page printed is told the handle names nothing here, and to detect on that page".
     - Move them to a capture, or to `runtime.pageChannel.fullPage` as `plan-resolution/extraction/tests/element-record.test.ts` does.
   - `structure/tests/detect.test.ts` "a handle from a page the browser has left is refused with the page now and the handle the same place has there" expects a fresh handle where D2 now keeps the same element's handle: its premise changed, it is not a regression.
   - W2's `structure/detect.ts:76` comment still names find_on_page.
2. **W3's files keep look words:** `flow-authoring/bootstrap/plan/flow-script-format.ts:235` (comment) and `draft-amendment-feedback/did-not-work.ts:28` ("look at the page again", which the model reads). Also check whether flow-authoring's node catalog text still lists the capture node: C filtered it out of the `run_node` enum in `node-tools/run/node.ts`, but the catalog is W3's.
3. **Confirm the draft placement** (after the history, against your interface; evidence above).
4. **Confirm `web.recovery.inspect` stays** on the runtime-recovery path, which has no page channel.
5. **The no-progress count still ends a loop** (`maxStepsWithoutProgress`; A saw the state-digest replay end at decision 15). E also noted that the `refusedAgain` ladder ends a round on a repeat count. AGENTS.md says no count may end a round. Both are outside W1's brief.
6. **Recall across rounds works by call id plus an optional `round`.** D's earlier-rounds entry prints no round, so a repeated id resolves to the current round's call, else the latest earlier one.
8. **The scripted bigbox run confirms nothing until W2's `rejected-rows.ts` fix is merged with W1.** Its last run is held only for `web_judge.read_invalid`. After both merge, re-run it once to see attempt 1 confirmed and attempts 2-4 with their continuation proofs. The lead's item 3 (naming the one-call `{handle: "tN"}` form in the detect and read descriptions in `tools.ts`) is not done here; W2's integration does it. Per the lead's item 4, `answer-first/completion/tests/judge-continues-decider.test.ts` was left alone.
9. **The page key and filters: decided by the user on 2026-11-25** (the query is dropped from the key). Built; see "Departures from the proposals".
10. **The draft keeps first-visit detours** (consent, offer presses), so other scripted tasks with a transient press will need the same drop edit F made for bigbox. Only the bigbox script was changed.
7. **Two things still change the offered tools, once each:** `core.run_flow` appears when the draft gains its first step, and recovery's observation tool is held back within an epoch. A left both, since they are not look withdrawal. Worth a decision under D11.
