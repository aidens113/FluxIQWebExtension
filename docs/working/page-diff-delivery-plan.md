# Page Diff Delivery Plan

Status: Active
Status detail: Planned 2026-11-25 on the user's instruction and decisions (D1-D16). W1, W2 and W3 integrated, then t1041 to t1054 (fluxiq 0.54.27). Next: the scripted round on all eight tasks, the loop-counts and recovery-counts follow-ups, then live on Sonnet.
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
  1. W1, W2, W3 (t1037), t1041 to t1045 and t1047 are integrated (ledger). The plan's three workstreams are built.
     - **Under framework drafting, the scripted bigbox run passes 4 of 4** (run-mwwol1vu-1a8e7146, provider-free):
       - every attempt read 16 rows and gave the right answer;
       - model calls per attempt: 14, 1 (the judge), 0 and 0;
       - attempts 2 to 4 each ran `flow.b50fa2ca`, with continuation held;
       - the saved Flow has 7 nodes.
     - **Open risks W3 raised:**
       - There is no host signal for a "lasting" act. A press after the result's last read is left out of the Flow when it shows no page change, no act claim and no declared consequence. An asked act that lands unclaimed and invisibly would be left out too, unless the model keeps it. Watch for it in live runs.
       - On an attempt that runs the saved Flow, the judge's summary lists no carried acts. This predates W3; it is a judge-evidence item.
  2. Integrated since (fluxiq 0.54.26 and 0.54.27; ledger):
     - t1048: the judge and the decider see every read's rows;
     - t1049: no count of steps without progress ends anything;
     - t1050: fake clocks for three deadline tests;
     - t1051: the column reader;
     - t1052: the Lab's frame-origin proof, and stale scripted declarations;
     - t1053: a passed-over step never becomes an evidence gap;
     - t1054: the build-cache lock race.
  3. Next:
     - **The user, 2026-11-26: "I think its time to start running live tests right after you fix those current running ones".** So the running fixes come first:
       - t1058: the scripted contract fixes, and a named refusal for an illegal field key;
       - t1056: no count ends an evidence loop, the deprecated chain goes, and the build purse's `maxCallsPerRun` call allowance goes (a purse is dollars);
       - t1057: no count ends a recovery.
     - Then live, with `dev` merged into every lane: on Sonnet (`--llm-model claude-sonnet-5-5 --llm-max-cost-usd 5`), each run with the run watcher, `--attempts 4`, and every attempt's flow chart reviewed.
       - First, bigbox `new-store-cheapest-towels` on t1015, the rerun of run-mwvgjb8c, which t1048 fixed; its debug is written.
       - Then one task per site, up to four lanes at once:
         - company-website `apprentices`, crossborder `free-hubs-under-ten`, everything-store `batteries-and-descaler`;
         - local-classifieds `save-dining-tables`, professional-network `accept-messaged-invitations`;
         - social-network-feed `delete-stranger-requests`, job-board `remote-rust-roles`;
         - auction-marketplace `kestrel-auctions`, photo-social `glaze-collection`.
       - The scripted round is now a diagnostic, not a gate. Scripted round 2 stopped on two scripted-model defects (`reports/scripted-round-2-diagnosis.md`), which t1058 fixes. Watch the watcher's alerts under `test-runs/lab-watch/`.
  4. Also open:
     - a list read before a filter change stays in the decider's view beside the re-read (t1048; a product call);
     - the judge accepting a wrong item on pickup availability (above);
     - `pinned-calls-job-board` setup wait;
     - `tool-rejection.ts` at 799 lines;
     - a Flow playback guard for list location (a wire change);
     - Core `components/automation/tests/ownership.test.ts`, which timed out at 15 s in the first sweep under load and takes 1.4 s alone; act on it only if the second sweep repeats it;
     - the second full sweep of the day and `main` promotion (`main` has not moved).
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

### 2026-11-25 - t1049 (no step count ends anything), t1050 (fake clocks) and t1053 (passed-over steps) integrated (fluxiq 0.54.27)
- Changed:
  - **t1053** (worker; report `reports/t1053.md`): a Flow step passed over by routing, with no outputs and no failure, is Core's own record. The run trail never hands it to the web projector, reports it to the judge in Core's words, and raises no gap (`result-verification/run-trail/of/attempts.ts`, `judge-evidence/passed-over.ts`). Before, the replay's yes was held unsure forever when the cover dismissals were passed over.
  - **t1050** (worker; report `reports/t1050.md`): `second-attempt-proof`, `later-attempt` "a run's own deadline" and judge-reply "ends at the judgement's existing deadline" run on fake clocks. An optional `startTimer` in the attempt ports reaches the engine's existing timer option; unset, real timers. No deadline was raised.
  - **t1049** (worker-heavy; report `reports/t1049.md`): `maxStepsWithoutProgress` is gone from every loop and recovery. The count only steers: from the third such step the model is told what it keeps repeating. The recovery's three-step progress guard is deleted, and codes nothing produces are deleted.
    - W3 leftovers: a `repeat` naming a missing step is refused `no_such_step`, and the unused `settings` on an amendment is no longer parsed.
    - About 30 tests now state the new behaviour. The lead sent back `service-bootstrap/tests/unfinished-build.test.ts`, which pinned the old ending; it now asserts the purse ending with steering and no identical second round.
  - **Found by t1049's follow-up:** that test's purse is `maxCallsPerRun: 12`, a call count ("stopped at its limit of 12 model calls"). It goes in the loop-counts brief with the other counts that still end non-answer-first loops.
- Validation: the lead's runs.
  - t1050 in `fxwork/t1050`:
    - `pnpm --filter fluxiq check` exit 0;
    - vitest groups over `answer-first`, `judge-reply` and `engine/automation/composite`: parallel printed `Tests  856 passed (856)`, real-sql `Tests  506 passed (506)`;
    - audit passed.
  - t1053: the lead read the passing Lab run's attempt table (`run-mwx2ylvq-1e1eb947`, company-website-apprentices):
    - 4 of 4 right;
    - calls 13, 1, 0 and 0;
    - attempts 2 to 4 ran `run_flow` with continuation held.
  - The combined check (t1055) is in the t1048 entry below. After t1049's test fix, `service-bootstrap` on t1049 merged with `dev` printed parallel `Tests  3 passed (3)` and real-sql `Tests  120 passed (120)`.
  - Each `pnpm task finish` on Core printed `"validation":{"ran":true,"command":"pnpm check","passed":true}` with `# pass 529 # fail 0`.
  - Core bumped to 0.54.27; both `dev`s pushed (Core `266b99197`, downstream `6c697de2a`).

### 2026-11-25 - t1048 (the judge and the decider see every read's rows) integrated (fluxiq 0.54.27); t1054 (the read-lock test race) integrated (fluxiq 0.54.26)
- Changed, t1048 (worker-heavy; report `reports/t1048.md`): t1044's two main causes.
  - A draft read that is not the answer goes to the judge page by page with its rows (`result-feed/feed.ts`, `read-evidence.ts`, `result-evidence/{types,from-batches}.ts`). It used to go as a count only.
    - A step with no page read yet still goes by its count, and stored bundles from before still load.
    - The window fitting (`result-verification/flow-less/window-fitting.ts`) may summarise these rows after the looks and before the answer's pages, and says so in plain words.
  - The decider's current view (`decision-context/current-view.ts`) holds a read whose answer names its list per list key, pager place and address. Run mwvgjb8c's pages 1 and 2 share a list key and a handle, so a key by list alone would have kept the defect. The same page read again replaces only its own rows.
  - Open product question: a list read before a filter change stays in view beside the re-read, because the address differs.
- Changed, t1054 (worker; report `reports/t1054.md`): Core `scripts/build-cache/tests/step-read-lock.test.mjs` waits until the build's writer lock file exists, not a fixed `delay(400)`.
  - It had failed both of t1051's Core finishes under load with `'no stamp'`, and likely t1044's two unnamed failures this morning.
  - The lead tried `--skip-checks` for t1051, and the permission check refused it. The test was fixed instead.
- Validation: the lead's runs.
  - t1048 in `fxwork/t1048`:
    - `pnpm --filter fluxiq check` exit 0;
    - vitest groups over `src/runtime/llm src/runtime/result-verification src/framework/automation-service/service/answer-first`: parallel printed `Test Files  679 passed (679)`, `Tests  5844 passed (5844)`; real-sql printed `Tests  513 passed (513)`;
    - Core audit passed; model-text printed `ok`.
  - The lead checked that the read lock writes its own reader entry, so `stepLock` is the build's writer lock and the poll is a real signal.
  - t1054: the read-lock test was run 4 at once, twice, and each printed `# pass 1 # fail 0` (8 of 8). The worker had 20 of 20 at 4-way concurrency, 4 of 4 failures with the wait removed, and build-cache tests 87 of 87.
  - `pnpm task finish` for both: t1054's Core finish printed `# tests 529 # pass 529 # fail 0` after two load failures that led to its lock fix. t1048's result line is in its integration commit.
  - A combined check of t1048, t1049, t1050 and t1053 merged on Core `dev` `f83ff1e`, in the throwaway task t1055, ran before any of them reached `dev`:
    - Core check exit 0; libraries build exit 0;
    - vitest groups over `runtime/{llm,result-verification,adaptation,agents,loop-limits,flow-authoring,answer-first,project-agents}`, `framework/automation-service` and `engine/automation/composite`:
      - parallel printed `Tests  14366 passed | 2 skipped`;
      - real-sql printed `Tests  1 failed | 1620 passed | 1 skipped`. The failure is `service-bootstrap/tests/unfinished-build.test.ts`, which pinned the count ending t1049 removed; it was sent back to t1049;
    - audit passed; domain `# pass 1995 # fail 0`; domain check exit 0; model-text `ok`.

### 2026-11-25 - t1052 (the Lab's frame-origin proof; stale scripted declarations) integrated
- Changed (worker; report `reports/t1052.md`):
  - `lab-control/frame-origin-proof.ts` compares the store's stable `provenance.ownerEpoch`, not the whole cached health reply, whose store counters move with the site. A different epoch, a non-Lab server or an unreadable reply is still refused.
  - The attempt lane gives the panel the run's addresses (`panel-addresses.ts`), so it never probes `127.0.0.1:3000`.
  - The network guard's blocked frames and requests are written to `attempt-report.txt` in plain words.
  - The apprentices script refuses a stray decision where it strays.
  - Stale declarations: saturday-certificate filtered on `disabled`, which its read never captured, so Core refused all 44 completions (`processing_binding_missing`). The fixture marks taken slots `aria-disabled`, so the read collects every slot with that mark and the declaration filters taken ones out; the oracle is unchanged. crossborder's read now keeps the `shipping` and `ad` fields its declaration names. The other declarations match their reads; social-network-feed has none.
- Validation: the lead's run in `fxwork/t1052-lab-frame-origin-proof`.
  - The test-runner suite printed `# tests 3019 # pass 3014 # fail 0 # skipped 5`.
  - The runner check exit 0; the audit printed `structure-audit: passed (264 warning(s), 550 baselined)`.
  - The worker's scripted saturday run (run-mwx28pr6) proved the frame defect gone: the Wrenfield branch was on `/book`, with 0 guard violations. It was then refused on the stale declaration, since fixed.
  - The re-run after the fix was refused by the Lab's behind-dev guard (shared Core behind Core `dev`); it waits for the shared Core sync.

### 2026-11-25 - t1051 (the answer contract reads the asked columns) integrated (fluxiq 0.54.26); the scripted round stopped on two diagnosed defects
- Changed (worker, Sonnet; report `reports/t1051.md`):
  - Core `flow-authoring/bootstrap/answerability/instruction-columns.ts` drops a closing "only", "just" or "exactly" after a column name, so "with columns title only" asks for `title`, not `title only`. "only child" keeps its first word.
  - `result-verification/asked-words/table-lacks.ts` no longer takes a held column that shares one word as the named one: "due" for "due date" had let a table with the wrong column pass.
  - `held-column.ts` also meets the singular and the plural.
  - The lead rewrote `answer-first/completion/tests/result-columns.test.ts`, which pinned the old tolerance. A shared word is now refused with no judge; "title only" and a singular or plural name reach the judge.
- Validation: the lead's run in `fxwork/t1051`.
  - `pnpm --filter fluxiq check` exit 0.
  - Vitest groups over `src/runtime/flow-authoring/bootstrap src/runtime/result-verification src/runtime/answer-first src/framework/automation-service/service/answer-first`:
    - parallel printed `Tests  2 failed | 6905 passed | 2 skipped`; real-sql printed `Tests  519 passed (519)`.
    - The 2 failures were `result-columns.test.ts`, rewritten as above, after which the file printed `Tests  10 passed (10)`; and `judge-reply/tests/unreadable-reply.test.ts` "ends at the judgement's existing deadline", a load-timed deadline test that printed `Tests  9 passed (9)` alone and was added to t1050's fake clocks.
  - Core audit passed.
- Scripted round on `dev` with W3 (lane t1015, provider-free, `--attempts 4`):
  - bigbox passed 4 of 4 (run-mwwvelrb-46358790);
  - company-website-apprentices (run-mwwwf7pb) and saturday-certificate (run-mwwwr1ty) failed, and the lead stopped the round (AGENTS.md: fix a shared problem before running more).
  - Diagnosis (worker-heavy, `reports/scripted-round-diagnosis.md`):
    - saturday was a Lab defect: `frame-origin-proof.ts` compared a stale copy of the health reply, store counters included, so the booking widget's frame was blocked after the store changed. It is fixed as t1052.
    - apprentices was a Core defect: passed-over cover steps reached the web projector as `evidence_unrecognized`, so the replay's yes was held unsure and the attempt could not end. It is fixed as t1053.
  - TaskStop ended only the round's outer shell, so the loop went on to the next task. The lead ended its process tree with `taskkill /T`.

### 2026-11-25 - W3 (t1037) integrated: the framework drafts the Flow, the model edits it (fluxiq 0.54.25)
- Changed (sub-supervisor; workers: wiring ×3 and delete-grammar on Opus, text ×2, scripted-reorder and docs on Sonnet; report `reports/t1037-auto-draft.md`):
  - Core: every call that works joins the draft by itself, and the draft is recomposed in place after each call, rerun and edit. Dead ends and repeats are left out, and the asked table's read is the result.
  - The model has seven edits: keep, drop, result, repeat, unrepeat, bind, rerun.
  - `core.run_flow` is offered from the first decision and refused by name until something can run.
  - A read's stored handle is recorded, never the model's `tN`.
  - The 13-edit grammar, the transcript mode and the old tellings are deleted. The framework telling keeps the loop guidance: one act per item, and paging.
  - The 20 real-sql failures of the switch were fixed at their causes: carried steps redrafted, a no-change press starting a detour, answer-first reads cut to one, drafting counted as progress.
  - `carried-undeclared` was rewritten: a press nobody asked for is left out, so attempt 2 runs the saved Flow.
  - Docs: Core `flow-authoring.md` and `llm-flow-bootstrap.md`, and downstream `build-loop.md`.
  - Downstream: the local-classifieds and professional-network scripted models send no `reorder` or `add`, and the domain parity test is re-pinned to one changed Core sentence.
- The lead also fixed the runner's test script to build scenario-lab first (`e18462713` on `dev`). W3's tree lacked that build, so 20 runner tests had failed with "Scenario Lab build is missing" (it had happened to t1047's fresh tree too).
- Validation: the lead's runs in `fxwork/t1037`, after committing both sides (Core `62f645e97`, downstream `9c13a36f9`).
  - Core libraries build exit 0; `pnpm --filter fluxiq check` exit 0.
  - Vitest groups over `src/runtime/{llm,flow-authoring,adaptation,project-agents,automation-activity,result-verification,answer-first}`, `src/framework/automation-service`, `src/server/fluxnode-api` and `src/ui`:
    - parallel printed `Test Files  1667 passed | 1 skipped (1668)`, `Tests  15297 passed | 2 skipped`;
    - real-sql printed `Test Files  259 passed (259)`, `Tests  1630 passed | 1 skipped`.
  - Core audit printed `structure-audit: passed (576 warning(s), 902 baselined)`.
  - Downstream:
    - the test-runner suite printed `# tests 3016 # pass 2990 # fail 20`, every failure "Scenario Lab build is missing";
    - after building scenario-lab, the six failing files printed `# tests 44 # pass 44 # fail 0`;
    - `test-domain.mjs llm-evidence runtime/tests`, the domain check, the runner check, the downstream audit and model-text each exited 0.
  - The scripted bigbox run passed 4 of 4 (run-mwwol1vu-1a8e7146; the lead read its `attempt-report.txt`).

### 2026-11-25 - First full sweep of the day (t1046) read; its downstream failures fixed as t1047
- Sweep: `dev` at the start of the sweep (before t1044 and t1045), in `fxwork/t1046`, run through the heavy gate.
  - Core build passed. Core `pnpm check` passed. Downstream `pnpm build` passed.
  - Core fluxiq tests had 2 failures:
    - `route-state/build-routing` "run-munneauy": fixed on `dev` by t1045, which landed after the sweep started;
    - `components/automation/tests/ownership.test.ts`: `Test timed out in 15000ms` while W3's checks held the other heavy slot. Alone, `vitest run` on it printed `Tests 2 passed (2)` in 1440 ms. Recorded as contention, not changed; act on it only if the second sweep repeats it.
  - The rest passed: parallel group `Tests 2 failed | 20488 passed | 6 skipped`; real-sql group `Tests 3251 passed | 1 skipped`.
  - Downstream `pnpm check` had 2 script-test failures out of 834, and downstream `pnpm test` (all 12 packages ran, `--no-bail`) had 14 failures, all in test-runner. All 16 came from t1040: the dev-ancestry guard now stands in front of the Lab entry and the launchers, and those tests pinned the old order or text. t1040's narrow checks never ran them.
- t1047 (worker, Sonnet; brief `docs/working/data-first-simplification-plan/briefs/t1047-sweep-guard-test-fallout.md`; report `.../reports/t1047.md`):
  - fixed the tests, not the guard: `package-gates.test.mjs` allows exactly the dev-ancestry guard ahead of the core-build gate and still refuses any other prefix (new case);
  - `unbuilt.test.mjs` gives its fixture Core a commit and a local `dev`, so the unbuilt-Core refusal is still what stops the run;
  - 10 test-runner files expect the guarded launcher text.
  - The `inspect-*` launchers stay unguarded, as t1040 intended (they are read-only).
- Validation: the lead's re-runs in the t1047 worktree.
  - `node --test scripts/check/core-build/tests/package-gates.test.mjs` printed `# tests 2 # pass 2 # fail 0`.
  - `node --test scripts/lab/core/build/tests/unbuilt.test.mjs` printed `# tests 13 # pass 13 # fail 0`.
  - `heavy-slot.mjs run t1047-lead-runner -- pnpm --filter @fluxiq-web-extension/test-runner test` printed `# tests 3016 # pass 3011 # fail 0 # skipped 5`.

### 2026-11-25 - t1045 (build-routing) and t1044 (judge continuation) integrated (fluxiq 0.54.24); t1044's main cause queued; sweep running
- t1045: Core `route-state/tests/build-routing.test.ts` was stale after t1036 withdrew the look. Its scripted build ends at 15 decisions, not 18, and captures 11 times, not 12. The test now asserts the 15 decisions and the totals `[11, 0, 9]`. Not a product regression; t1036 updated only the sibling `state-digest-cost.test.ts`. The lead's W1 checks missed it because `route-state` was not in its folder list.
- t1044 (run-mwvgjb8c, where the judge accepted a wrong pickup item):
  - **The cause.** The judge never saw the cheaper qualifying row. It sat in page 1's read, which reached the judge as `working: [{step, kept: 15}]`, a count only (`answer-first/result-feed/feed.ts:269`), while page 2's rows came whole.
  - **The decider picked wrong for a related reason.** Every read shares one `holder:read` group (`runtime/llm/decision-context/current-view.ts:28`), so page 2's read dropped page 1's rows from its view.
  - **Merged now:** a judge continuation no longer claims a call is shown above when its view reference resolves outside the prefix (`models/providers/anthropic/continuation.ts`, with `judge-held-whole.test.ts`).
  - **Queued as t1047 after W3:** both main causes, which are in W3's files. W3 was told; its "rows from every read that ran" design may cover them.
- Validation: the lead's runs.
  - t1045's folder: `vitest run src/framework/automation-service/route-state` printed `Test Files 7 passed (7)`, `Tests 49 passed (49)`.
  - t1044: anthropic, llm/anthropic and judge-continues-decider printed `Tests 158 passed (158)`. After `dev` (t1045) was merged into its Core branch, anthropic, llm/anthropic and route-state printed `Tests 206 passed (206)`.
  - `pnpm task finish` both. Core `pnpm check` for t1044 first failed 2 of 529 script tests while the full sweep loaded the machine. A re-run printed `# tests 529 # pass 529 # fail 0`, and the finish then printed `"validation":{"ran":true,"command":"pnpm check","passed":true}`. The two tests' names were not captured; the next such failure keeps its log.
  - Core bumped to 0.54.24; both `dev`s pushed (Core `2af56a961`, downstream `67f779182`); `git merge dev` into t1015 and t1037 both sides, each `contains dev: yes`.
- A full sweep on `dev` (t1046, the first of the day) is running in its own worktree; it started before t1044 and t1045.

### 2026-11-25 - t1043 (self-changing page) integrated (fluxiq 0.54.23)
- Changed:
  - **Domain (`press-effect/self-change/`):** a press is credited only with its own changes. What the page changes by itself is told apart by two signals:
    - its own markup: carousels and slides by roledescription, marquee, timer, and live regions once seen changing;
    - lines the run saw change with nothing done.

    Those changes are kept out of `change/statement.ts`, `pageChanged` and the no-effect retry, and shown to the model marked "(changes by itself)".
  - **Core (`judge-evidence/earlier-before-note.ts`):** Core recognises its own before-placeholder and tells the judge in its own words. The checkpoint shared the defect and is fixed too.
- Validation: the lead's run on the t1043 trees.
  - Core: `pnpm --filter fluxiq check` exit 0. Groups over `runtime/answer-first runtime/result-verification framework/.../answer-first runtime/llm` printed `Tests 6320 passed (6320)` and `Tests 512 passed (512)`, `all groups passed`. Core audit passed.
  - Domain: `llm-evidence runtime/tests output-nodes` `# tests 2331 # pass 2331 # fail 0`; domain check exit 0.
  - Extension: `# tests 4168 # pass 4168`. Downstream audit passed; model-text ok.
  - The worker's forced-race tests fail without the fix and pass with it. Its three scripted bigbox runs passed 4 of 4 each (mwwdmmk2, mwwdv9jx, mwwe08jw); the carousel never turned mid-press in them, so they show no regression only.
  - `pnpm task finish t1043`: audit passed; Core `"validation":{"ran":true,"command":"pnpm check","passed":true}`.
  - Core bumped to 0.54.23; both `dev`s pushed (Core `f091ed4fe`, downstream `34f9655d3`); shared Core synced; `git merge dev` into t1015 and t1037 both sides, each `contains dev: yes`.
- Accepted: the worker's in-place edits to `node-run/run.ts` (3 lines, which is at 800 lines) and `tools.ts` (+3), both outside its listed paths. The lead added the pointer from `build-loop.md` "What A Press Changed".
- Known gaps: recovery-harness presses do not feed the self-change memory. A control outside a carousel that changes it without `aria-controls` reads as no effect.

### 2026-11-25 - t1042 (W1 leftovers) and t1041 (asked column names) integrated (fluxiq 0.54.22); t1043 opened
- t1042 changed:
  - Recovery carries the page channel and `core.full_page`. Its opening capture rides navigate with no url, and `web.recovery.inspect` is withdrawn.
  - `core.full_page` had answered "unavailable" for the web domain, because Core read a bare view where the domain publishes it under its member. Core now reads both.
  - No model text says to look (`tool-failure.ts`, `failure-brief.ts`, `no-effect.ts`).
  - `structure/held-now.ts` binds a handle the page still gives an element, for both detect and the recovery press.
- t1041 changed: a renamed column takes the asked name as its label. Site-word matching moves into the name rewrite, and saved steps re-resolve.
- Validation: the lead's runs.
  - **t1042:**
    - `pnpm --filter fluxiq check` exit 0.
    - Core groups over `runtime/adaptation runtime/llm answer-first` printed `Tests 4784 passed (4784)`, then `Tests 508 passed (508)`, `all groups passed`.
    - Core audit passed; domain `llm-evidence runtime/tests output-nodes` `# tests 2321 # pass 2321 # fail 0`; domain check exit 0; extension `# tests 4168 # pass 4168`; downstream audit passed; model-text ok.
    - The worker's scripted run-mww7zdb0 passed 4 of 4.
  - **t1041:**
    - Domain `llm-evidence output-nodes actions/extraction extraction runtime/tests` `# tests 2457 # pass 2457 # fail 0`; domain check exit 0; extension `# tests 4168 # pass 4168`; audit passed; model-text ok.
    - Its scripted run-mww8s1va passed 4 of 4, with `"columns":["name","price","rating"]` in the answer turns (the lead read attempts 1 and 2).
  - **Merges:** `pnpm task finish` both: audits passed, and Core `pnpm check` passed for t1042. Core bumped to 0.54.22; both `dev`s pushed (Core `75cb3957d`, downstream `14151363b`); shared Core synced; `git merge dev` into t1015 and t1037 both sides, each `contains dev: yes`.
- Found by t1041's Opus retry: a carousel flipping during a press makes the press look lasting. The act is then carried, and Core projects its own not-held before-placeholder through the domain projector, so a right answer stays unconfirmed. Dev's baseline passed only by timing.
  - The cause is in domain `press-effect/change/statement.ts:58` and Core `judge-evidence/summary.ts:107` and `witnesses.ts:127`.
  - t1043 is opened for it (worker-heavy, slot 4; proof: a forced-race test plus three clean scripted runs) and must land before any live run.

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
