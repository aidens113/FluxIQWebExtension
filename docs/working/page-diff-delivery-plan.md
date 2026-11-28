# Page Diff Delivery Plan

Status: Active
Status detail: Built and live-tested; replay fixes, UI unification and real-site readiness merged (fluxiq 0.55.1). The user's manual real-site tests still loop and mis-see the page. Next: the model-input deep dive and real-site Lab tests (user, 2026-11-28).
Created: 2026-11-25
Last updated: 2026-11-28
Owner: Senior supervisor agent
Scope: How the model sees pages: each page address's whole cleaned view once per run, then only what changed, delivered with every result; no look command; the model may ask for the whole page; page data per request stays within a limit.
Paired document: none yet (Core gets one if the sub-supervisor opens a Core working document)
Related: [data-first-simplification-plan.md](./data-first-simplification-plan.md) (the paid round of 2026-11-24 and the five bigbox recordings this plan answers), the t1035 structural audit (`data-first-simplification-plan/reports/t1035-agent-structure-audit.md` when it lands)

## Current State

- **Where it stands (2026-11-28 handoff).** The page-diff plan (D1-D16) is built. Bigbox and kestrel replay defects from the live round are fixed: both pass the provider-free harnesses 4 of 4 on fluxiq 0.55.1, calls 15-16, 1 (judge), 0, 0. The user then tested by hand on the real site eldorado.gg from the panel and found the build still loops and mis-sees the page. Their new rule (AGENTS.md, 2026-11-28): **all Lab tests run on real websites, properly reviewed, and the model's input gets a deep dive next.**
- **Versions.** Core `dev` `586a84b27` (fluxiq 0.55.1, @fluxiq/contracts 0.26.0, @fluxiq/client-gateway-websocket 0.4.0, @fluxiq/ui-components 0.16.0), downstream `dev` `cd5f32445`. Both pushed. `main` has not moved: no full sweep ran today.
- **Merged since the 2026-11-27 live round** (ledger): t1082-t1098, t1100.
  - Replay fixes: a skipped navigation still reaches its route; a third address is unknown; judge pages for standalone judges; proof beats no proof; result reads; replay-stop look.
  - Answer from every result read of one list (t1091).
  - Strict tools fit the provider: grammar-size and named-tool refusals demote; a 4xx keeps its reason and is never waited on as silence; answer-first is the default mode (t1093, t1100).
  - Real-site page readiness and the press check (t1094).
  - The UI unification: the panel owns projects, keys and chat management; clients show the work; project-name click and sync request fixed (t1095).
  - The manual run's eight loop fixes (t1096).
  - Extension test isolation (t1097).
  - The audit refuses one-file test groups (t1098).
- **Running at handoff (let them reach their endpoint; integrate next session if they finish after /clear):**
  - **t1099** (sub-supervisor) live status line with timer, plus moving the provider-free `ui:e2e` journeys onto a realistic scenario. Trees `fxwork/t1099`. Brief `briefs/t1099-live-status-ux.md`.
  - **t1101** (worker-heavy) the 21 answer-first endings tests failing on Core `dev` (real-sql group; bisect suspects t1096's parameter check). Trees `fxwork/t1101`. Brief `briefs/t1101-answer-first-endings-tests.md`.
- **The user's manual tests (panel, Haiku, eldorado OSRS mining accounts).** Logs in `test-runs/manual-panel/` (git-ignored):
  - run 1 looped on Next page and refused repeats, now fixed by t1096;
  - run 2 (replay) was refused on every decision, now fixed by t1100;
  - run 3 (on 0.55.1) still looped. It got unusable replies, repeated full-page captures, "looking at an older view of the page" (stale handles), and a round restart. The user: "it couldnt even seem to actually be able to access the page data at all".
- **The panel** was stopped at handoff. Start it with `pnpm dev`, and set `FLUXIQ_LLM_STEP_LOG_DIR=test-runs/manual-panel/<date>` so the step log is durable.
- **Superseded in part (user, 2026-11-28):** the page input, the look tools, list reading and result processing move to [full-page-model-input-plan.md](./full-page-model-input-plan.md). That plan is the next work; this document keeps its history and the integrations still running.
- **Next (in order):**
  1. Integrate t1099 and t1101 when they report: verify, merge, bump, restart the panel.
  2. **The model-input deep dive (user, 2026-11-28)**, now planned as the full-page plan. Use the three manual step logs, starting with run 3: what each decision request carries; page size and order (a 180k-character full page in 10 parts, hidden menus first); handle freshness between views; why replies are unusable on Haiku; repeat refusals that still cost calls; the interpretation that read "up to 10 pages" as `limit: 10` (`runtime/conversations/instructions/prompt.ts:45-46`). Plan it as a working doc, then fix.
  3. **Real-site Lab tests.** The Lab's launch entries refuse anything outside the ten realistic scenarios, and the provider-free `ui:e2e` journeys open synthetic scenarios. Change the guards to the new rule, define real-site tasks with oracles, and review every run (steps, model input, UI).
  4. Live reruns of bigbox and kestrel have not happened since the fixes. About $16.80 of the $50 paid round remains, plus the user's own manual-test spend.
- **Open:**
  - the judge answer's shape (strict refused as too large; t1093 reverted part);
  - `assert.ts` and `extract-list.ts` plain errors before a gesture (t1096 note);
  - `prompt.ts` wording that `limit` counts rows;
  - the content harness's older failures;
  - 39 Core and 30 downstream baselined one-file test groups;
  - the URL.canParse extension test;
  - landmark name into identity; `dead-end.ts` and fresh loads; carried evidence lost on a Core restart; link normalisation; the state-route return limit; wall-clock tests;
  - old fxwork worktrees (t1080-t1089 Core trees) to prune.

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

### 2026-11-28 - Handoff: t1091, t1093-t1098 and t1100 integrated (fluxiq 0.55.1); manual real-site tests; the user's new rules
- **Integrated:**
  - **t1091:** the answer comes from every result read of one list under its latest state; overlapping rows dedupe on shared fields.
  - **t1093:** strict tools fit the provider's grammar (demote largest first, remembered per tool-set digest); a 4xx keeps the provider's reason; answer-first is the default; `scripts/anthropic-contract-check.mjs`.
  - **t1094:** a step waits for the page to be usable, not for a real site to go silent; a press counts only requests it caused.
  - **t1095:** the UI unification. The panel owns projects, keys and chat management; clients show the work; the project-name click and the sync request are fixed. Core boundary: clients lose create-project, chat rename and delete, and key writes.
  - **t1096:** the manual run's eight loop fixes.
  - **t1097:** a leaked `performance` global from a t1094 test broke 72 extension tests in the full run.
  - **t1098:** the audit refuses one-file test groups.
  - **t1100:** an open nullable object kept strict tools refused; named-tool demotion; a refused request is never waited on as silence.
- **The lead's integration fixes:**
  - regrouped one-file test groups (t1088, t1093);
  - type errors in t1083's and t1085's tests found by Core's gate;
  - t1095's eager `service.conversations` at registration, and its stale assistant-tools catalog.
- **User decisions and rules this session:**
  - the panel owns configuration and projects, clients show what is happening (AGENTS.md, 2026-11-27);
  - Lab tests run on real websites, properly reviewed, with a deep dive into the model's input (AGENTS.md, 2026-11-28);
  - clear live statuses (t1099).
- **Manual tests by the user** (panel, Haiku, eldorado): three runs, logs in `test-runs/manual-panel/`. The third still loops; it is the deep-dive input.
- **Not done:**
  - no live Lab rerun since the fixes;
  - no full sweep, so `main` has not moved;
  - no UI screenshots (the `ui:e2e` journeys open synthetic scenarios; t1099 moves them);
  - 21 answer-first endings tests fail on Core `dev` (t1101 running).
- Validation: the lead's runs:
  - provider-free harnesses on the final code: kestrel `"status":"passed"` with calls `11, 1, 0, 0`; bigbox `15, 1, 0, 0`; bigbox panel `16, 1, 0, 0` (t1096 tree, merged with dev), each watcher `alerts: 0`;
  - extension `node apps/extension/scripts/test-extension.mjs` after t1097: `# pass 4213`, `# fail 1` (the older URL.canParse);
  - t1095 merged: Core groups `Tests 2231 passed`, `586 passed`, `pnpm check` clean;
  - t1100's rebuilt request accepted live (HTTP 200);
  - the endings real-sql group on dev: `Tests 21 failed | 64 passed (85)`, the same before and after t1100.

### 2026-11-27 - Free harnesses pass 4 of 4 on 0.54.36; t1086 and t1090 integrated; t1091 and t1092 running
- **Bigbox plain** (`run` in t1086, instance t1086): 4 of 4 right. Attempt 1 explored (15 calls); attempts 2-4 ran the saved Flow.
- **Bigbox panel** (instance t1086p, `run-mwzdbvkm-204422a9`): 4 of 4 right.
  - Calls: 16, 1 (the judge), 0, 0.
  - In attempt 2, "View cart" was passed over as `executor.state.not_arisen`. Its step's spans show `state-route`, then a successful `send.click` (the header cart link), then the cart read returned 2 rows. That is F1 end to end.
  - The judge requests of attempts 1 and 2 (`loop_verification-001`, `-002`) hold the page's "Pickup today" line. The evidence-reading scripted judge said yes on page text it was shown: F2 end to end.
- **Kestrel** (instance k1 in t1015-paid-bigbox): 4 of 4 right, 10 rows each time.
  - Calls: 11, 1 (the judge), 0, 0.
  - The replayed search that stopped live and in t1082's run now passes: K1 end to end.
- **t1090** (worker): recovery-matrix case 14b passed with 0 model calls; s2 retried until the check let the visitor on. Its record does not show whether the effect check ran on s1, so kestrel is the end-to-end proof of K1.
- **t1086** merged. Every live lane was merged with dev afterwards.
- **Running:**
  - t1091 (worker-heavy): every result read of one list answers;
  - t1092 (worker-heavy): the carried-row repair tests failing on dev.
- **Live reruns** of bigbox and kestrel wait for t1091 (a known fix in flight), within the remaining ~$16.80.
- Validation: the lead's runs:
  - `pnpm lab attempt bigbox-retail --task bigbox-retail-new-store-cheapest-towels --authoring-mode answer-first --scripted-model --attempts 4` -> `"status":"passed"`, watcher `alerts: 0`; with `FLUXIQ_ATTEMPT_SCRIPT_FORM=panel` -> `"status":"passed"`, calls `16, 1, 0, 0`, `alerts: 0`;
  - `pnpm lab attempt auction-marketplace --task auction-marketplace-kestrel-auctions ... --attempts 4` -> `"status":"passed"`, calls `11, 1, 0, 0`, `alerts: 0`;
  - `pnpm lab recovery-matrix --case 14b` -> `{"caseId":"14b","verdict":"passed"}`.

### 2026-11-27 - The replay fixes integrated: t1083, t1084, t1085, t1087 (strict part reverted), t1088, t1089 (fluxiq 0.54.36)
- **t1083** (worker-heavy): F1 and K1.
  - A step passed over as `not_arisen` still reaches the route its recorded effect went to. Core asks the host through the new optional `reachRouteEffect`, and the web host:
    1. goes on if the page is already there;
    2. otherwise presses a visible link to the same route, banner or navigation first;
    3. otherwise goes to the recorded destination.
  - An effect now signs `from`. A page on neither its start nor its destination is `unknown`.
  - Proven on both recordings:
    - bigbox s12 presses the header cart link before s13; with the old decision, 3 of 7 tests fail;
    - the kestrel check page reads `unknown`; with the old rule, it reads `not_seen`.
  - **Lead's decision:** a step reached this way stands as saved. No call is made, the path is deterministic, and the attempt records `reached`.
- **t1084** (worker-heavy): F2. Every judge that does not continue a decider gets page views, in the order decided above.
  - On run-mwz29d50's records, the rebuilt replay judge request holds the "4.5 out of 5 Stars" and pickup "Today" lines, within the page budget.
- **t1085** (worker-heavy): F3, the drop-copy check, and K3.
  - Proof beats no proof in `better-flow.ts`.
  - Keep and result are checked against the steps as they will stand after the same decision's drops.
  - A result read carried from an earlier attempt no longer outranks a fresh read of the same list.
  - A returning read gets back the pages it read.
- **t1087** (worker): K5 row handles kept; **K4's strict answer reverted** (lead, Core `689fc826e`).
  - One check against the API before any live run, over 0088's recorded tools, was refused twice. Neither refusal billed anything:
    - first: "Enum value 'yes' does not match declared type ['string','null']", fixed by writing nullable enums as `anyOf`;
    - then: "The compiled grammar is too large".
  - The counted limits held (0 optional, 12 unions), but grammar size is a further limit. Every decider request carries the answer tool, so strict would have refused every decision.
  - The answer tool is non-strict again. The reshape module stays, marked as not sent.
  - The judge-shape defect (0088) is open again.
- **t1088** (worker): a replay stop on an unseen effect reads the page once before handing over.
  - Where the effect holds, the replay continues from the next step. Otherwise the note names the page as it is now.
  - The lead regrouped `flow-run/tests` by shared prefix (`tests/steps-ran/tests/`), replacing a one-file group that only dodged the 25-file limit.
- **t1089** (worker-heavy): row handles reach the Flow-less judge's first ask, with the shared rule where labels are shared. A judge the provider ends up sending on its own request carries the pages. The Anthropic adapter takes them out only for a real continuation.
- **t1086** (worker): the bigbox harness gains a `panel` form with an evidence-reading scripted judge.
  - The plain form passes 4 of 4: explore 15 calls, then 1, 0 and 0.
  - The panel form waits for the shared Core sync.
- **Integration defects found by the lead:**
  - **Type errors.** The Core finish refused t1083 and t1085 on type errors in their new test files. The workers had run vitest only, and vitest does not type-check. Both were fixed; Core's check now runs in the tree before a finish.
  - **Early push.** Downstream dev was pushed with t1083's domain half before Core's finish had succeeded. Downstream did not build against Core dev until the Core rerun landed, about 15 minutes later. From now on, both repositories push only after both finishes are confirmed.
  - **Leftover processes.** Five were killed: three `tail` watchers on finished runs and two shells of a worker's wait loop. They were blocking the shared Core sync.
- **Open, new:**
  - `domain/src/runtime/tests/carried-row-service-repair.test.ts` has 4 failures, the same on dev before t1083;
  - the judge answer's shape needs a fit the grammar can hold;
  - t1091: the answer comes from every result read of one list (t1082's 9 rows);
  - t1090: recovery-matrix case 14b, built and waiting for the sync to run.
- Validation: the lead's runs on the merged branches:
  - t1087 groups over `llm providers result-verification`: `Tests 5098 passed`, `7 passed`;
  - the revert, over `llm providers`: `Tests 3129 passed`, `4 passed`;
  - t1084, over `result-verification answer-first`: `2850 passed`, `510 passed`; merged with t1087: `2108`, `3`;
  - t1088, over `flow-run attempt`: `234 passed`, `148 passed`;
  - t1083: state-routing and related `424 passed`, `115 passed`; domain `235 pass`, with the 4 failures pre-existing (dev `169 pass`, the same 4);
  - t1089 merged: `2155 passed`, `3 passed`;
  - t1085 merged: `1344 passed`, `509 passed`; `pnpm check` clean after the test type fix;
  - every Core finish passed `pnpm check`, the contracts tests and the audit;
  - Core `0979c2a15` (0.54.36) pushed.
- Follow-up: sync the lanes, then run the free harnesses (bigbox plain and panel 4 of 4, kestrel 4 of 4, recovery case 14b). Only then rerun bigbox and kestrel live.

### 2026-11-27 - Both replays diagnosed on 0.54.35; t1082 (kestrel harness) integrated; t1083-t1088 dispatched
- **Live on 0.54.35.** Both first attempts were right; both replays failed. The lead stopped both runs. Spend is about $33.20 of $50.
  - **Bigbox run-mwz29d50:** attempt 1 right (17 calls, $0.65).
    - Attempt 2's replay skipped "Add to cart" as already done, which is correct.
    - "View cart", written on the panel only an add opens, was then passed over as `executor.state.not_arisen`, and the cart read ran on the product page. Since t1073, a navigating press is skippable.
    - Attempt 3's standalone judge saw no page text, said `unknown`, and repaired.
    - `better-flow.ts` then kept the unproven Flow over the repair judged yes.
  - **Kestrel run-mwz2jc4w:** attempt 1 right (20 calls, $1.35; the badge fix held).
    - Attempt 2's search landed on the site's bot check, a third address. `seen.ts` read that as `not_seen`, and the replay stopped.
    - The judge reply at 0088 came back in the wrong shape (non-strict tool).
    - About $0.70 of attempt 2 was two Core defects: which read is the result, and rows not credited.
  - Debugs `debugs/run-mwz29d50-c3a32a9c.md` and `debugs/run-mwz2jc4w-0c207128.md`; reports `reports/run-mwz29d50-bigbox.md` and `reports/run-mwz2jc4w-kestrel.md`.
- **Decision (lead's, under the user's 2026-11-19 rule that the judge sees the whole trail).** A judge not continuing a decider gets page views, within the page budget, whole lines, in this order:
  1. the end view;
  2. the before view;
  3. the pages lasting acts were pressed on;
  4. the pages the steps landed on, newest first.
- **t1082** (worker): a provider-free kestrel harness from live attempt 1. On dev, attempt 2's replayed type step fails `core.step.effect_not_seen`, as live; its re-exploration then ended with 9 rows, which t1085 is checking against K3.
- **Dispatched**, each fix with an offline proof on its recording (briefs under `page-diff-delivery-plan/briefs/`):
  - t1083 (worker-heavy): F1, a passed-over navigation still reaches its route, plus K1, a third address is `unknown`;
  - t1084 (worker-heavy): F2, standalone judge page views;
  - t1085 (worker-heavy): F3, proof beats no proof; the drop-copy check; K3, the result read and credited rows;
  - t1086 (worker): the bigbox harness's panel form and an evidence-reading scripted judge;
  - t1087 (worker): K4, a strict judge answer, and K5, row handles;
  - t1088 (worker): K2, a replay stop looks at the page again before handing over.
- Validation: t1082 was checked by the lead:
  - `node --test` on its two test files: `# pass 14`, `# fail 0`;
  - `structure-audit: passed (265 warning(s), 550 baselined)`;
  - `effect_not_seen` is present in `steps/0026-flow-web.output.dom-type/meta.json`;
  - the finish's audit passed; merge `ab750226a`.
- Follow-up: integrate t1083-t1088. Then both harnesses must pass 4 of 4 before any paid run.

### 2026-11-27 - Kestrel nearly right, bigbox replay found two more defects; t1076-t1081 integrated (fluxiq 0.54.35)
- **Live:**
  - **Kestrel run-mwyt3s48:** the ten owed auctions, in order and correctly filtered. One title had a badge glued on ("New listingKestrel…"), so the oracle marked it wrong.
  - **Bigbox run-mwytbimp:** the lead stopped it in attempt 3.
    - Attempt 1 took 31 calls (sort failures, page flip-flops, cache rewrites).
    - Attempt 2's replay stopped `web.target.ambiguous` on the page link "2".
  - Debugs: `debugs/run-mwyt3s48-b943f344.md` and `debugs/run-mwytbimp-e0c33977.md`; reports `reports/run-mwyt3s48-kestrel.md` and `reports/run-mwytbimp-bigbox.md`.
  - Spend is about $28.40 of $50. The lead paused live runs to prove fixes offline first.
- **t1076** (worker), a provider-free harness for bigbox `new-store-cheapest-towels`, so its later attempts run without a provider. Its first run reproduced a later-attempt cart-link failure.
- **t1077** (worker-heavy): a label some cards carry is its own column, and text reads the way the page shows it.
  - The content harness shows the same 75 failures on plain `dev` before and after, so none are new. Those 75 are pre-existing and open.
- **t1078** (worker): an edit the draft already holds is answered as standing, and its repeats climb loop detection as `draft_amendments_refused`.
- **t1079** (worker-heavy): words count as state only while a link's whole address stays the same, and links are keyed by stable facts and region, never by their position.
  - The harness passes 4 of 4, with attempts 2-4 on the saved Flow (1, 0 and 0 calls).
- **t1080** (worker-heavy): earlier prompt records stay byte-unchanged, and the current pages sit in one trailing `core.page_window`.
  - Replay of run-mwytbimp: estimated cache writes fall 85%, and the input cost estimate falls about 29%.
  - The scripted model reads the window.
  - Caching the window when it is unchanged measured as noise, so it was not kept.
- **t1081** (worker): a select that names no option is refused at once with the shape it needs.
  - The dead-end-press rule was removed unwired, so its cause stays open: `dead-end.ts` misses a return through a fresh load.
- **Open:**
  - the 75 content-harness failures on `dev`;
  - carry the landmark name into saved identity (`elements.ts`, `from-packet.ts`);
  - `dead-end.ts` and fresh loads;
  - plan keys are positions, and carried evidence is lost on a Core restart (t1075 follow-up);
  - link normalisation before duplicates are compared;
  - the state-route return limit;
  - wall-clock tests.
- Validation: the lead's runs.
  - **t1077:** content `# pass 1977`; the content harness `75 failed | 544 passed`, and the same 75 on `dev`; scripted free-hubs passed.
  - **t1078:** groups `Tests 858 passed` and `49 passed` after its fix; earlier, `4416 + 511` with one test reconciled.
  - **t1079:** domain `# pass 1895`, extension `# pass 1970`, checks exit 0, audit passed; the worker's harness run passed 4 of 4.
  - **t1080:** groups over `llm adaptation answer-first` `Tests 4841 passed` and `511 passed`, check exit 0; scripted bigbox passed 4 of 4 and free-hubs passed.
  - **t1081:** domain `# pass 2445`, extension `# pass 1977`, select spec `12 passed`, checks exit 0.
  - Each finish passed its gates. Core `f0b7d9f76` (0.54.35) and downstream `accd6abf7` were pushed; the shared Core is synced and the lanes merged.

### 2026-11-27 - Reruns stopped on two new defects; t1074 and t1075 integrated (fluxiq 0.54.34, @fluxiq/contracts 0.25.0)
- **Live reruns after t1070-t1073:**
  - **Bigbox run-mwynbry2:** the lead stopped it after attempt 2. The replay found the cart link (t1071 worked), but pressed "+ Add" a second time.
  - **Kestrel run-mwyn25dg:** the lead stopped it after 40 decisions with no act. Refusals now had reasons (t1070 worked), but every declaration kept 0 rows.
  - Debugs: `debugs/run-mwynbry2-f3c88dc7.md` and `debugs/run-mwyn25dg-3ba0b41c.md`; report `reports/run-mwynbry2-double-add.md`.
  - Spend is about $24.60 of $50.
- **t1075** (worker-heavy), the double add:
  - `requiresChosen` (t1030, latent since 2026-11-24) counted as identity in `target-keys.ts`, so the saved step no longer matched attempt 1's carried act.
  - Run parameters now live in one exported list. Every identity reader uses it (`target-keys`, `learned-paces`, `explored-toggles`, `toggle/tie`, `step-still-done`), and a source scan fails the build if any reader strips its own subset.
  - By-hand acts are stamped with their step's plan key.
  - A later attempt's judge sees carried acts and the evidence they landed with.
  - **Follow-up:** plan keys are positions (move them to draft step ids); carried evidence is in memory only and lost on a Core restart.
- **t1074** (worker-heavy), the data step:
  - Every recorded `anyOf` (31/31) meant alternatives, but the evaluator required every group, so the groups now are alternatives, each row decided by the groups with evidence for it. 0053's declaration over the 46 recorded rows keeps exactly the ten owed auctions.
  - Asked columns are placed on the read's keys by name, by values, or by the declaration's order, and shown under the request's names as a view.
  - Held processing rebinds through a renamed read's aliases.
  - A re-read of a list at an address replaces that list's page across steps (bigbox's stale cart row).
  - Docs and the migration note are updated, so contracts bumps to 0.25.0.
  - **Left:** absolute-versus-relative link normalisation before duplicates are compared, which the lead takes as a separate cleaning change.
- Validation: the lead's runs.
  - **t1074:** contracts printed `Tests  427 passed`; groups over `answer-first flow-authoring node-tools conversations result-verification` printed `Tests  7662 passed | 2 skipped` and `674 passed`; check exit 0; audit passed; Core libraries exit 0; domain check exit 0; domain `llm-evidence` printed `# pass 1840 # fail 0`; model-text ok.
  - **t1075**, merged with t1074: groups over `answer-first runtime/answer-first engine/automation flow-authoring/bootstrap` printed `Tests  6144 passed | 2 skipped` and `517 passed`; check exit 0; audit passed.
  - Both Core finishes ran `pnpm check` and the contracts: passed.
  - Core `2112d5aa8` (0.54.34) and downstream `1cc954cf8` were pushed; the shared Core is synced and the four lanes merged.

### 2026-11-27 - t1070, t1071, t1072 and t1073 integrated (fluxiq 0.54.33, @fluxiq/contracts 0.24.0)
- **t1070** (worker-heavy): a refused processing declaration names each broken part, its field and operator, and the reason (JavaScript's own regex message, or the 200-character limit with how to split it). A leading `(?i)`/`(?m)`/`(?s)` is read as that flag, and the tool says the patterns are JavaScript.
  - The contracts parser returns `refusals`, so contracts bumps to 0.24.0 (breaking below 1.0, so minor).
  - Kestrel's cause is confirmed: `(?i)` (Invalid group), and 13 of 14 patterns over 200 characters.
- **t1071** (worker-heavy, downstream only):
  - **F1:** words the build saw change are a value (`readsWords`), and a unique root-relative destination path (`href`) confirms a link.
  - **F3:** each act witnesses its own source, so a later attempt's repair assembles. The refusing line was `absolute.ts:73-74`.
  - Docs: `element-identity.md`, `build-loop.md`.
- **t1072** (worker-heavy): the judge sees each kept row's sort and filter values (`keptRows`) and the processor's sort-order reading (`hiddenSortKeys`). A no that names no contradiction reads as unsure, which changes 2 of the 124 recorded nos.
- **t1073** (worker):
  - **F2:** a follow-on step lasts by what it declares, not its verb.
  - **F5:** a superseded paging loop leaves the draft.
  - **F6:** checklist borrowing.
  - **F7:** Lab wording.
  - Docs: the lead documented `executor.state.not_arisen` and the superseded-loop exception in `automation-studio.md` and `flow-authoring.md`.
- **Open, from t1070's debugs:**
  - an `anyOf` whose derived column is missing on some rows withholds the whole group;
  - held processing is not rebound through a rename map when the result moves to a renamed read (free-hubs);
  - a page-link click inside a read/Next repeat looped a replay 17 passes (kestrel).
- **Also open:**
  - the state-route return limit (`AUTOMATION_STUDIO_STATE_ROUTE_RETURN_LIMIT`, 3) ends a playback; review it against the no-arbitrary-limits rule;
  - wall-clock deadline tests miss under load.
- Validation: the lead's runs.
  - **t1070:** contracts `vitest run src/record-sets` printed `Tests  413 passed (413)`; groups over `flow-authoring node-tools answer-first` printed `Tests  5411 passed | 2 skipped` and `524 passed`; check exit 0; audit passed; Core libraries exit 0; domain check exit 0; domain `llm-evidence` printed `# pass 1833 # fail 0`.
  - **t1071:** domain tests printed `# pass 2347 # fail 0`; extension `content` printed `# pass 1968 # fail 0`; domain and extension checks exit 0; audit passed; model-text ok.
  - **t1072:** groups printed `Tests  2841 passed` and `509 passed`; check exit 0; audit passed.
  - **t1073:** groups over `flow-authoring answer-first engine/automation executor` printed `Tests  6356 passed | 2 skipped` and `527 passed`; check exit 0; audit passed; runner `result-line` printed `# pass 7`.
  - Each merged-with-dev overlap retest passed: t1072 `2209 + 19`; t1070 `2349 + 13`.
  - Each Core finish ran `pnpm check` and the contracts: passed.
  - Core is at `9c023c281` (0.54.33), downstream `2a64d5480`, both pushed; the shared Core is synced and the four lanes merged.

### 2026-11-27 - First live round after the judge fixes (fluxiq 0.54.32): three passes, bigbox right with non-deterministic later attempts, kestrel stopped; t1070-t1073 dispatched
- **The provider-free check first caught a Lab defect:** the scripted model answered a continuing check in text, and t1065's protocol re-asks that. The lead fixed it in `scripted-model/model-server.ts` (dev `29e34e992`). The scripted bigbox run then passed 4 of 4: attempt 1 made 15 calls with 1 judge call, and attempts 2 to 4 ran the saved Flow.
- **Live, on Sonnet, `--attempts 4`, $5 per build, watcher on:**

  | Task | Lane | Result | Attempt 1 | Later attempts |
  | --- | --- | --- | --- | --- |
  | bigbox `new-store-cheapest-towels` (run-mwyfc9uf) | t1015 | right 4 of 4; not deterministic | 15 calls, $0.51, 1 judge | 8, 5 and 6 calls (repair, explore, explore) |
  | company-website `apprentices` (run-mwyfoz8s) | t1059 | passed | 18 calls, $0.44 | 1 (the judge's check), 0, 0 |
  | job-board `remote-rust-roles` (run-mwyfoz8o) | t1060 | passed | 28 calls, $1.16 | 8 (repair after a wrong judge no), 1, 0 |
  | crossborder `free-hubs-under-ten` (run-mwyfx9fs) | t1061 | passed | 35 calls, $1.64 (column binding) | 1 (the judge's check), 0, 0 |
  | auction `kestrel-auctions` (run-mwyg0x66) | t1059 | stopped by the lead at $2.44 | about 14 blind `set_result_processing` calls, refused with no reason; loop handling did not help | not run |

  - Round spend is about $19.80 of $50.
  - The tasks that change the site are held until the later-attempt fix: batteries, dining tables, invitations, stranger requests and glaze.
- **Causes** (`reports/run-mwyfc9uf-later-attempts.md`, worker-heavy):
  - **Bigbox later attempts:**
    - **F1:** the header cart link was saved by its words, "🛒 1 $3.97", which read "🛒 2 $5.25" the next time.
    - **F3:** a repair could not assemble (`web.handle.ambiguous`), because the domain's target record carries over between attempts.
  - **Job-board:**
    - **F4:** the judge was not shown the sort key, and said no without naming a contradiction.
    - **F5:** the saved Flow pages twice.
  - **Kestrel:** a processing refusal says only `record_output.process_invalid_condition`. The likely culprit is a `(?i)` regex flag.
- **Dispatched:**
  - **t1070** (worker-heavy): processing refusals name the part and why. It also writes the kestrel and free-hubs debugs.
  - **t1071** (worker-heavy): controls are saved by what stays the same, and each attempt's acts are recorded (F1, F3).
  - **t1072** (worker-heavy): the judge sees sort and filter values, and a no with no contradiction is unknown (F4).
  - **t1073** (worker): a follow-on step's lasting nature comes from its consequences, not its verb; superseded paging is dropped from the draft; plus the checklist wording and the Lab wording (F2, F5, F6, F7).
- Validation: the oracle verdicts and Lab summaries quoted above, from each run's Lab log under the session scratchpad `live-round/`. The watcher fired on free-hubs, where the lead read it as progress and did not stop it, and on kestrel, which the lead stopped.

### 2026-11-26 - The judge fixes integrated: t1065, t1066, t1067, t1068 and t1069 (fluxiq 0.54.32)
- **t1065** (worker-heavy; `reports/t1065.md`): a continuing judge always answers in a form Core reads, and does so in its own conversation.
  - Every Anthropic decider request carries `core_check_answer` with the same bytes, so the cache holds. The judge answers by calling it, and a decider that calls it is refused.
  - A reply that is not read (prose, or a decision-tool call) is answered in the same conversation, never by a judge that sees less.
  - A continuation carries the decider's whole last turn, recalled rows included.
  - **Found on the way:** the purse held every continuation at the size of the judge's standalone request. `measureInput` now measures what is sent. A judge that never answers ends on the purse, or on the check's deadline when calls are near free.
  - **Offline on run-mwy3btww:** 0034, 0077 and 0104 read as yes, and 0130 carries the c50 rows.
  - The answer tool is not strict: 6 strict decision tools use 23 of the 24 optional parameters allowed.
- **t1066** (worker; `reports/t1066.md`): live attempts draw `flow.png` from the steps the run wrote, and every chart line goes to the Lab log.
- **t1067** (worker-heavy; `reports/t1067.md`): every read reaches the judge with its rows, including pages the framework draft dropped.
  - A standalone judge carries the end view, and the before view after a lasting act.
  - The domain: an add on a keyed grid card names its item ("This acted on item 1/2 (ValueRidge Essentials Paper Towels, 1 Roll, $1.28)").
- **t1068** (worker; `reports/t1068.md`): a `result` edit on a second copy refuses `second_copy`. Stale look and search words are gone.
  - Its whole-decision all-or-none rule broke `dropped-act`, where a guard's put-back reverted drops on other steps. The lead's integration run caught it.
- **t1069** (worker; `reports/t1069.md`): an amendment is atomic per step. A struck step's edits are skipped and the decision is re-applied, so no trace is left on openers, reversals or claims, and the guards' put-backs leave the rest applied.
- **The lead's own fixes:**
  - the explorer prompt snapshot, which t1068's wording changed;
  - the cause of t1065's real-sql out-of-memory: a test wire answering in old JSON text on near-free calls.
- **Open:**
  - `stalled-provider.test.ts` and other wall-clock deadline tests miss under load; move them to fake clocks;
  - a never-continuing judge's first ask carries no page views (`flow-less/judge.ts`, `verify.ts`);
  - a re-asked continuation carries page views twice on the rare `continues_the_decider_again` path;
  - Core still requires a Flow's `llmExecutionSettings.maxCalls`;
  - round restarts wipe the decider's evidence;
  - a failed sort's page stays in context;
  - `refusal-run.ts` passes no `recoverAt`.
- Validation: the lead's runs.
  - **t1065:** vitest groups over `runtime/{llm,models,result-verification} answer-first deepseek-bootstrap programs/automation-studio` printed parallel `Tests  6149 passed` and 1 load-timing miss (`stalled-provider`, which passes alone at `4 passed`), and real-sql `Tests  826 passed (826)`.
  - **t1068:** the groups over `flow-authoring answer-first/completion runtime/answer-first` printed `Tests  4725 passed | 2 skipped` and `19 passed`.
  - **t1067:** `Tests  2790 passed` and `509 passed`; domain `node-run` printed `# pass 619 # fail 0`; domain check exit 0.
  - **Integrated state on t1069**, covering all four Core fixes: groups over `runtime/{flow-authoring,result-verification,llm,models,answer-first} answer-first` printed `Tests  10631 passed | 2 skipped (10633)` and `Tests  531 passed (531)`.
  - `pnpm --filter fluxiq check` exit 0 on each; audits passed; t1066 runner tests printed `# tests 249 # pass 249`.
  - Each Core finish ran `pnpm check` and the contracts: passed.
  - Core is at 0.54.32 (`768ea46b4`), downstream `2db89deae`, both pushed; the shared Core is synced and the lanes merged.

### 2026-11-26 - Live bigbox stopped by the person; the audit found the judge cannot read its own answers; t1063 integrated (fluxiq 0.54.31); t1065-t1068 dispatched
- **Live run run-mwy3btww-31d32e0d** (Sonnet, attempt 1): the person stopped it after 73 calls (14 of them judge calls), $3.16 and 538 s, with "0 rows stored, 0 shown". Round spend is about $12.40 of $50.
  - Debug: `language-driven-flow-loop-plan/debugs/run-mwy3btww-31d32e0d.md`. Audit: `reports/run-mwy3btww-audit.md` (worker-heavy).
- **The decider was right by step 0020 (about $0.35):** it added the single roll at $1.28, rated 4.5, "Pickup today". Every step after that was the check failing to accept a right answer.
- **Findings, in order of impact:**
  1. **No continuing judge answered in a form Core reads (7 of 7, 6 of them yes).**
     - 4 wrote prose before the JSON and 3 called a tool. This is a regression from t1038: the decider went to native tools, and a continuing judge keeps them.
     - Task **t1065** (worker-heavy): a judge answer tool in every decider request so the cache holds; prose or another tool is answered in the same conversation; rows the decider recalled reach the continuation.
  2. **The fallback judge saw no page views and no rows from the reads that found the answer.**
     - The t1037 draft drops non-result reads, and t1048 feeds the judge only reads still in the draft. The add act names no item.
     - Task **t1067** (worker-heavy): every read goes to the judge, and an act names what it acted on.
  3. **One amendment at 0144 emptied the result** (2 rows to 0, `processing_schema_missing`). `keep` was refused but `result` was applied anyway. That is why there was no table.
     - Task **t1068** (worker): an amendment applies all of its edits or none, and the result edit is checked like keep. The same task removes stale look and search words.
  4. **The Lab's flow chart fails on every live run:** it reads the bundle's `steps/`, while live runs write theirs under `lab-runs/`.
     - Task **t1066** (worker). The lead drew this run's chart by hand (`attempt-1/flow.png`).
  5. **Also found, not yet assigned:**
     - round restarts wipe the decider's evidence, so c50 was recalled 4 times;
     - a failed sort's whole page rode in 75 requests (24.6k characters);
     - route-state entries repeat the full control list.
- **The heavy gate's "memory telemetry is stale"** held the launch for one poll. The sample is stamped mid-probe and compared after it (MeritPrompts `tools/heavy-slot/policy.mjs:28`). It is noted, not fixed.
- **t1063 integrated:** a candidate build takes no loopSignal and is steered and retested, never ended on a stall. The project supervisor's dead stall branch is removed, and the e2e specs pass no call counts.
- Validation: the lead's runs on t1063.
  - vitest over `flow-bootstrap-commands project-build candidate-failure` printed `Tests  322 passed (322)`;
  - `pnpm --filter fluxiq check` exit 0;
  - both audits passed;
  - Core libraries build exit 0;
  - extension check exit 0;
  - the Core finish (`pnpm check` and contracts) passed.
  - Core is at 0.54.31, both `dev`s pushed, the shared Core synced.
- **Next:** integrate t1065, t1066, t1067 and t1068, then prove offline on this recording:
  - replies 0034, 0077 and 0104 read as yes;
  - a fallback judge carries the c50 rows;
  - 0144 leaves the result at step 13 with 2 rows.

  Then rerun bigbox live on Sonnet with `--attempts 4`, and the three other lanes after it.

### 2026-11-26 - t1064 (the Lab carries no call count) integrated; live bigbox launched; t1063 running
- **The first live launch failed before Chrome opened ($0):**
  - the Lab's prelude build broke on `live-llm-plan.test.ts`, which imported the call backstop t1056 deleted;
  - the lead's t1056 checks had covered the domain but not the test-runner.
- **The Lab still carried call counts of its own:**
  - `LLM_LAB_MAX_CALLS_PER_RUN` (250);
  - a default budget of 26 calls;
  - `--llm-max-calls`;
  - record validations that refused a run over a call count.
  So a passing live run could have been marked invalid, and that had to be fixed before any paid run.
- **t1064** (worker; report `reports/t1064.md`) removed them all.
  - Old records may still carry `maxCallsPerRun`, and it is ignored.
  - `--llm-max-calls` is refused with words saying the purse bounds a run.
  - **The lead fixed two failures the worker had called pre-existing:**
    - the worker's edits had written 33 files with CRLF endings, which broke `runner-wiring`'s source-text check; the lead normalized them to LF;
    - `failure-sanitizer`'s "token count no build could spend" row relied on the old call bound, and Core now takes any safe whole token count (t1056). The row now uses a fraction.
  - **Open (Core):** a Flow's `llmExecutionSettings.maxCalls` (1-250) is still required by Core and read by nothing. The Lab saves an inert 250.
- **t1063** (worker-heavy; report `reports/t1063.md`; running):
  - a candidate build no longer takes a loopSignal, so a stall is steered and retested, never ended;
  - the project supervisor's dead stall branch is removed;
  - the e2e specs no longer pass call counts.
- Validation: the lead's runs.
  - runner `failure-sanitizer` and `runner-wiring` printed `# tests 4 # pass 4 # fail 0`;
  - test-contracts printed `# tests 184 # pass 184 # fail 0`;
  - Lab script tests printed `# tests 85 # pass 85 # fail 0`;
  - audit passed.
  - The worker's provider-free bigbox run (`rated-delivery-towels`; `new-store-cheapest-towels` has no script) passed 4 of 4: 15 calls to explore, then the same Flow with 1, 0 and 0 calls.
  - t1064 finished into `dev` (`de4368246`), pushed, and the four lanes merged.
- **Live:** bigbox `new-store-cheapest-towels` relaunched on t1015 as run-mwy3btww-31d32e0d (Sonnet, `--attempts 4`, $5, watcher on).

### 2026-11-26 - t1062 (iframe steps) integrated (fluxiq 0.54.29); t1056 (no count of calls or rounds ends a run) integrated (fluxiq 0.54.30); live round next
- **t1062** (worker-heavy; report `reports/t1062.md`): a Flow saved from steps inside an iframe assembles and replays.
  - Each frame step is found again by its frame's URL path, with the id only agreeing.
  - A press owns only a popup in its own frame's document.
  - "Not seen" reads a control under its heading.
  - Provider-free on merged code: bigbox, apprentices and saturday-certificate each passed 4 of 4.
- **t1056** (two workers: worker-heavy t1056-worker for rounds 1 to 5, worker-heavy t1056-purse for the purse group; reports `reports/t1056.md` and `reports/t1056-purse.md`). Only the result, the purse, the clock or Stop ends a run:
  - **Counts removed:**
    - the evidence loop's `maxIterations`, `maxToolCalls` and `unusableDecisions.maxConsecutive`;
    - the resolution's `maxCallsPerRun`, which the Studio run ledger now strips from any untyped spread;
    - the 250-call backstop;
    - the unreadable-replies ending;
    - the bootstrap's 6-round cap, whose record of round stops is now bounded in bytes.
  - **Builds get a loopSignal.** A stalled round ends at the top of the loop-detection ladder, and the build repairs in a new round.
  - **Loop detection now catches a repeated refused decision.** answerability's 870 identical `complete_not_offered` decisions now climb the refused-again ladder.
  - **Unpriced providers are priced.** A provider that gives no price is held at the larger of Core's default rate and the most a call has cost.
    - The earlier hold at the default rate alone was below real cost, and the overshoot spent the judging reserve. That was a real purse defect.
  - **A diagnosis-only recovery** stops after its diagnosis.
  - **Answer-first** keeps judge money back only when a judge will run.
  - **A held-unsure yes never ends a build as accepted** (`candidate.trial_rows_unaccounted`).
  - **Wording:** budget endings say what the money went on, and count the whole build's unreadable replies. A model-facing reason no longer carries a digest.
  - **The request prefix** stays stable within a round, because `core.loop_decision` is offered from the first call. A new round is a new conversation.
- **Decided:**
  - **No change:** `decisionsLeft` is the purse and the clock in calls.
  - **Follow-up, moved out:** a stalled candidate or project build fails instead of repairing. Neither path is answer-first. Brief: `briefs/candidate-stall-repair.md`.
- Validation: the lead's runs.
  - `pnpm --filter fluxiq check` exit 0.
  - Core audit exit 0.
  - vitest groups over `runtime/{llm,loop-limits,flow-authoring,project-agents,adaptation,answer-first,conversations,result-verification,agents} framework/automation-service programs/automation-studio`:
    - parallel printed `Tests  2 failed | 14803 passed`;
    - real-sql printed `Test Files  326 passed (326)`.
  - Both parallel failures were traced:
    - next.test's code count is now 11;
    - build-routing moved because the refused-again steer shows one more entry, never fewer. It was re-pinned with the decisions named, and re-run: `Tests  32 passed (32)`.
  - Downstream:
    - Core libraries build exit 0;
    - domain check exit 0;
    - domain `llm-evidence` printed `# tests 1830 # pass 1830 # fail 0`;
    - model-text `ok`.
  - Core finish ran `pnpm check` and the contract tests: passed.
  - Core bumped to 0.54.30. Both `dev`s were pushed (Core `ca4fb4502`, downstream `46c48ac90`). The shared Core was synced and the four live lanes merged.

### 2026-11-26 - t1058 (scripted contract fixes) and t1057 (no count ends a recovery) integrated (fluxiq 0.54.28); t1062 (iframe steps) found and fixed
- Scripted round 2 (lane t1015):
  - bigbox passed 4 of 4 (run-mwx9ale4);
  - apprentices (run-mwx9k3mi) and saturday (run-mwx9mpt9) failed, and the lead stopped the round with `taskkill /T` on its tree.
  - The diagnosis (worker-heavy, `reports/scripted-round-2-diagnosis.md`) found two scripted-model defects:
    - apprentices compared the held group name literally, and t1048 names a read's group per list;
    - saturday's t1052 read used the illegal field key `group heading`, and the script counted refused calls as done.
- Changed:
  - **t1058** (worker; report `reports/t1058.md`):
    - `scripted-model/scripts/evidence.ts` resolves any view reference;
    - saturday uses `group_heading`;
    - every scripted model counts only calls that were not refused, so a refusal stops it where it failed;
    - the domain refuses an illegal read field key with `web.handle.field_key_invalid`, naming the key and the allowed characters.
  - **t1057** (worker-heavy; report `reports/t1057.md`): the recovery ledger's `maxActions`, `maxProviderCalls`, `maxRepeatsPerAction` and `maxRefusedActions` are gone.
    - An exploration ends on its answer, the purse, its clock, a person, or the model's own `ask_person` loop decision. Its evidence loop takes loop detection's signal (`recovery/loop-signal.ts`).
    - Refusals are recorded by kind and end nothing; a stated lasting act on one target is still refused from its third landing.
    - Downstream, the exploration-refusal classifier and the runtime contract return `AutomationStudioExplorationRefusal`.
  - **t1062** (worker-heavy; report `reports/t1062.md`; in progress): saturday's attempt 2 could not assemble its saved Flow.
    - The domain writes `browserFrameId` and `browserFrameUrlPath` onto steps in a child frame, but no web node definition declared them, so Core's strict check refused them. Core is right and unchanged.
    - The web node definitions now declare both keys, hidden from the model, and the domain finds a frame again by its URL path, with the id only agreeing.
  - **Found by t1057 and moved to t1056:** the run budget's declared call count and its 250-call backstop still end runs; a provider failure that reports no usage charges nothing.
- Validation: the lead's runs.
  - t1058:
    - domain `llm-evidence actions` printed `# pass 1996 # fail 0`;
    - the runner suite printed `# tests 3026 # pass 3021 # fail 0`;
    - both checks exit 0; audit passed; model-text `ok`;
    - the worker's apprentices Lab run passed 4 of 4 (calls 1, 0, 0 after the explore).
  - t1057:
    - `pnpm --filter fluxiq check` exit 0;
    - vitest groups over `src/runtime/adaptation src/framework/automation-service`: parallel printed `Tests  4086 passed (4086)`, real-sql `Tests  1582 passed | 1 skipped`;
    - Core audit passed; domain `llm-evidence` printed `# pass 1823 # fail 0`; domain check exit 0.
  - Core finish of t1057 printed `# pass 529 # fail 0`.
  - Core bumped to 0.54.28; both `dev`s pushed (Core `f02bbc8ec`, downstream `cff473430`); four live lanes merged.

### Earlier entries
- The 2026-11-25 entries are in [archive/ledger-2026-11-25.md](page-diff-delivery-plan/archive/ledger-2026-11-25.md).
- Validation: not validated: a pointer to moved entries, nothing ran.
