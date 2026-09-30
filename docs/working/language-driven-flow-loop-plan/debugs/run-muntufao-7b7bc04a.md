# Run debug — `run-muntufao-7b7bc04a` (live run 21)

Worker t174-w19, 2026-09-30. Read from the bundle at
`test-runs/instances/t174-slot-1/run-muntufao-7b7bc04a`, its UI review
(`test-runs/instances/t174-slot-1/run-muntufao-7b7bc04a.ui-review.local.json` and the PNG folder
`test-runs/instances/t174-slot-1/run-muntufao-7b7bc04a.ui-review.local/`), the bundle's whole-window JPGs
(`screenshots/`), Core's failure body in `provider-failures.local.json` (codes and counts only), and the
launcher's full Lab stdout (`live-run-21.full.log`, in the supervisor's scratchpad, not in the repository).
Stage 1's chain is taken by kind from the earlier debug of this task
(`docs/working/language-driven-flow-loop-plan/debugs/run-munaiz76-7026748c.md`). No product code was read or
changed. Privacy: only codes, counts, ids, node ids, durations, timestamps and FluxIQ's own UI strings. Pages,
lines and controls are named by kind; no instruction text, page text, store or product names, search terms or
provider bodies. Model-authored call ids are not quoted, because they carry instruction words (cause 10); where
they tell what a step was meant to do, that is said by kind.

---

## Header

- Run id: `run-muntufao-7b7bc04a`
- Scenario / variant / task: `everything-store` / none / `everything-store-kettle-to-cart` (kind
  `navigate-and-extract`, workflow `add-to-cart`, judged by `expected-dataset` at step `extract-cart`, step
  index 22). The instruction is 345 characters, sha256 `82c49c5b…943817` (`snapshots/flow-lane.json` `task`).
- Repositories (`run.json`): facility `76e5e76` (dirty), Core `e75dcf2` (clean), both the t174 tree on the
  round-1 merged build (the same commits as run 20). Chromium 134.0.6998.35, 1280×720, seed 241. Ports:
  scenario 62204, web 62205, gateway 62206. Every prelude build step was `reused` from its stamp; prelude
  20.0 s (full log).
- Lab span 08:12:10.618Z to 08:19:10.494Z (`run.json`), `durationMs: 419876` (`evaluation.json`);
  `build.durationMs: 337062` (`snapshots/flow-lane.json`).
- Provider, model: DeepSeek `deepseek-flash`, profile `production`. Authorized (`snapshots/live-llm.json`):
  `maxCalls: 64`, 48k in / 8k out / 56k per call, 3,584,000 per run, $0.25 per call, $2 total, timeout 25 s.
- Calls, cost: **64 calls, all loop decisions** (`loopProviderCalls: 64`, `unrecordedCalls: 0`),
  1,122,843 in / 8,157 out tokens, **$0.13161**, `budgetBreaches: 0`. Mean 17,544 input tokens per call; the
  largest call had 18,538 (decision 29). No repair or result-check call (no Flow).
- Verdict: failed, `runtime.behavior`; `flow_bootstrap.evidence_iteration_limit`, stage
  `provider_output_validation`, HTTP 400, `issueCodes: [bootstrap.instructed_act_missing]`
  (`events.ndjson` seq 25). Core's `exhausted`: bound `iterations`, 64 of 64, `draftSteps: 52`,
  `proposableSteps: 14`, `completionAttempts: 5` (`provider-failures.local.json`).
- **Stage reached: 2.** No Flow was proposed (`flowCreated: false`). `snapshots/decision-trace.json` lists the
  Flow `flow.b036f404-96c2-43c1-a235-e090ccd88fef` with `runs: []` and `adaptations: []`.
- Against run 20 (bigbox, Stage 4): 64 decisions (was 31), $0.132 (0.063), 5 completions all refused (4, 3
  refused), 5 dry runs (2). Against run 4 of this task (`run-munaiz76-7026748c`): the refusals are now
  `instructed_act_missing`, not dry-run `unreproducible`, and the check was right every time (see Stage 2).

## Timeline

Condensed into phases. Iterations and draft ids are from `logs/core.log` build-trace lines joined with
`snapshots/flow-lane.json` `build.evidenceLoop.steps[]` (71 records). Draft ids `dN` number the loop's tool
records in order, Core's initial call as `d1`, **including** the two `already_answered` records (d13, d15).
The numbering checks against Core's own refusals (amendment 42 names steps 34, 36 as `dom-click` and 37 as
`browser-navigate`; amendment 44 names 38 as `dom-click`) and against every dry run's `dryrun.N.M` ids.

| Time (UTC) | Phase | Iterations, nodes and result codes | Source |
| --- | --- | --- | --- |
| 08:12:10.618 | Lab start | – | `run.json` |
| 08:12:40.604 | Dispatch (`runtime.dispatch`) | – | `events.ndjson` seq 1 |
| 08:13:00.124–01.158 | Loop start; Core's initial snapshot | d1 `web.output.dom-capture_snapshot` → `web.action.rejected.not_at_start_location` / `start_location_not_reached`. The tab was `about:blank` (UI moment 3) | `logs/core.log` |
| 08:13:01.2–17.3 | A. Start and first search | 1 d2 `browser-navigate` succeeded; 2 d3 `dom-click` succeeded (a prompt dismissed); 3 d4 `dom-type` succeeded (search field); 4 d5 `dom-click` succeeded (search button) → **the store's no-results page** (moment 4); 5 d6 `dom-click` succeeded, `pageState: changed` | `core.log`; `04-mid-build-scenario.png` |
| 08:13:17.3–39.3 | B. Looking, no progress (9 decisions) | 6 d7 detect, 7 d8 `dom-extract_list` `web.inspect.succeeded`, 8 d9 detect, 9 d10 `browser-navigate` (cart), 10–11 d11, d12 detect (1,730 bytes each), **12 d13 `llm_evidence_loop.already_answered`**, 13 d14 `dom-extract_list` (cart), **14 d15 `already_answered`** | `flow-lane.json` steps 6–14 |
| 08:13:40.8–42.0 | Amendments | 15 targeted d8, d6: applied 2; **16 targeted d6, d8 again: `draft_unchanged`, refused `already_out` ×2** | Core body `amendmentRefusals` |
| 08:13:43.9–14:16.2 | C. Same search, reading the same page (12 decisions) | 17 d16 `browser-navigate` (the same no-results search); 18, 20, 21, 22, 27 detect (1,646 / 1,667 bytes; **20–22 three in a row**); 19, 23, 24 `dom-extract_list` **7,133 bytes each**; 25 d24 `browser-navigate` **`pageState: unchanged`**; 26, 28 `dom-extract_list` **7,162 bytes each** | `flow-lane.json` steps 17–28 |
| 08:14:17.875–44.219 | **Completion #1 (29)** | check `ok=false issues=bootstrap.instructed_act_missing`; **dry run 1 ran anyway**: reset + 13 replays, `dryrun.1.3` (d3) `core.replay.unreproducible` 6,123 ms, the rest replayed; 26.3 s | `core.log` |
| 08:14:45.9 | Amendment | 30 targeted d3, d4, d5, d10, d14, d16, d18, d22, d23, d24, d25, d27 (every step dry run 1 replayed but d2): **applied 12, kept 1** | `flow-lane.json` step 30 |
| 08:14:47.3–15:24.8 | D. Presses with no effect | 31 d28 `browser-navigate` (cart); 32 d29 `browser-navigate`; **33–36 d30–d33 `dom-click` succeeded, `pageState: unchanged` ×4** (the model's ids call them add-to-cart presses; moment 9 shows the no-results page); 37 amendment withdrew d30–d33 (applied 4); 38 d34 click unchanged; 39 d35 `browser-navigate` (no-results page again, moment 10); 40 d36 click unchanged; 41 d37 `browser-navigate` (cart) | `flow-lane.json` steps 31–41; `09-`, `10-mid-build-scenario.png` |
| 08:15:26.2–51.3 | E. The save press and refused amendments | **42 refused `already_in_flow` ×3** (d34, d36, d37); **43 d38 `dom-click` succeeded, `pageState: changed`: the cart line's save-for-later, left pending with a spinner** (`screenshots/00012-*.jpg`, 08:15:30.5) and not completed (moment 11, 08:15:43.8, cart still 2); **44, 45 identical, refused `already_in_flow` ×3 each** (d34, d36, d38); 46 d39 navigate (cart); 47 d40 `dom-extract_list` **12,163 ms**; 48 d41 detect | Core body; JPG 00012; `11-mid-build-scenario.png` |
| 08:15:53.1–16:01.5 | F. Rerun churn | 49 rerun d40 → d42 `web.inspect.succeeded`; **50 rerun d42 → `web.action.rejected.invalid_input` / `node_not_runnable_here`; 51, 52 rerun d42 → `invalid_input` / `answered_the_same_again`** (each 0–1 ms) | `flow-lane.json` steps 49–56 |
| 08:16:02.969–19.590 | **Completion #2 (53)** | refused `instructed_act_missing`; **dry run 2**: reset + 10 replays, all replayed, 16.6 s. **`dryrun.2.38` (d38, 08:16:14.0) completed the save: the instructed line left the cart** (cart 2 → 1, saved list 2 → 3; moments 12 → 13) | `core.log`; `12-`, `13-mid-build-scenario.png` |
| 08:16:21.5–28.9 | Reruns | 54 rerun d42 → d46 ok; 55 rerun d46 → d47 ok | `flow-lane.json` |
| 08:16:30.161–56.045 | **Completion #3 (56)** | refused; **dry run 3**: reset + 10 replays, all replayed, 25.9 s (`dryrun.3.47` 12,009 ms). **`dryrun.3.38` (08:16:41.5) pressed save-for-later again and moved the other seeded line, one the instruction keeps** (cart 1 → 0, saved 3 → 4; moment 14 at 08:16:43.9, `screenshots/00017-*.jpg` at 08:16:48.9) | `core.log`; `14-mid-build-scenario.png`; JPG 00017 |
| 08:16:57.6–17:13.4 | G. Same search again | 57 d48, 58 d49 `browser-navigate` (the no-results search, cart 0, moment 15); 59 d50 detect; **60, 61 d51, d52 `dom-click` unchanged** (the model's ids repeat its add-to-cart names with a `.2` suffix) | `15-mid-build-scenario.png` |
| 08:17:14.672–51.471 | **Completion #4 (62)** | refused; **dry run 4**: reset + 14 replays; **`dryrun.4.38` `core.replay.unreproducible` 6,212 ms** (nothing left to save); `dryrun.4.47` 12,014 ms; 36.8 s | `core.log` |
| 08:17:52.8 | Amendment | 63 targeted d38: applied 1, kept 14 | `flow-lane.json` step 69 |
| 08:17:54.257–18:30.943 | **Completion #5 (64)** | refused; **dry run 5**: reset + 14 replays; `dryrun.5.38` unreproducible 6,159 ms (so amendment 63 did not withdraw d38; what it changed is not recorded); `dryrun.5.47` 11,994 ms; 36.7 s | `core.log` |
| 08:18:31.009 | Core failure | `flow_bootstrap.evidence_iteration_limit` | `provider-failures.local.json` |
| 08:18:31.421 | Build settle (`calls: 64`, `interventions: 0`, $0.13161) | – | `events.ndjson` seq 24 |
| 08:18:31.862 | Error event | – | `events.ndjson` seq 25 |
| 08:18:35.690 | Final capture (duplicate of the previous image) | – | `events.ndjson` seq 26 |

Loop 330.8 s (08:13:00.124 to 08:18:30.943): **decisions 94.7 s** (64 calls, mean 1.48 s), **exploration tools
93.3 s** (50 tool records), **dry runs 142.2 s (43 %)**.

## Stage 1 — the instruction and the expected chain

- Instruction text withheld (345 characters, hash above). By kind, from
  `docs/working/language-driven-flow-loop-plan/debugs/run-munaiz76-7026748c.md` Stage 1: **three acts**:
  add two units of one product in a named colour, capacity and seller to the cart (`create_new`); move one named
  line already in the cart to Save for later (`modify_existing`); then read the cart's active lines, without the
  saved ones, as a table of item, quantity and unit price. The expected answer is two active lines: the new
  product at quantity 2, and the other seeded line, which **stays in the cart**.
- A correct Flow: store home; answer the notifications prompt and the cookie banner; search with a **short**
  query; pass the soft check; open the product family's organic result; minimise the support chat; choose the
  variant and seller; quantity 2; add to cart; go to cart; press Save for later on the named line, and because
  **the first save of a session fails**, wait for "Try again" (4 s) and press it; read the active lines.
- Core's reading of the instructed consequences is **not in the bundle**: `instructedConsequences`,
  `declaredConsequences` and `consequenceCrossCheck` are all `null` when the build fails (gap).

## Stage 2 — exploration (the build)

**Where the build went.** It never reached a product page. Every page shown in the 20 scenario PNGs and 25
window JPGs is the home page, the store's no-results search page, or the cart. The search the model typed at
d4 returned no results, and it loaded the same no-results search again at d16, d35, d48 and d49 (the same query
in `04-`, `09-`, `10-`, `15-` and `20-` PNGs and JPGs 00010, 00011, 00025; the final page adds one filter). It
never shortened the query and never used the home page's own links to the product family, which are visible at
moments 1 and 7. So no step could add the product, and **every one of the five `instructed_act_missing`
refusals was correct**: the final proposable draft (dry run 5's 14 replays: d2, d28, d29, d34–d39, d47, d48,
d49, d51, d52) has navigations, five presses with no effect, the save press and a cart read, and no add.

### Where the 64 decisions went

| Kind | Count | Outcome |
| --- | --- | --- |
| `tool_call` | 45 | 43 ran a tool; 2 answered `llm_evidence_loop.already_answered` without running (12, 14) |
| – of which `core.run_node` | 32 | 11 `browser-navigate`, 12 `dom-click`, 1 `dom-type` (all 24 `web.action.succeeded`); 8 `dom-extract_list` (`web.inspect.succeeded`) |
| – of which `web.detect_repeating_structure` | 13 | 11 `web.structure.detected`, 2 `already_answered` |
| `amend_draft` | 14 | 4 applied (15: 2, 30: 12, 37: 4, 63: 1); **4 `draft_unchanged`** (16 `already_out` ×2; 42, 44, 45 `already_in_flow` ×3 each); **6 reruns** (49, 54, 55 ran a read; **50, 51, 52 refused `invalid_input`**: `node_not_runnable_here`, `answered_the_same_again` ×2) |
| `complete` | 5 | **5 refused** `bootstrap.instructed_act_missing` (29, 53, 56, 62, 64); each followed by a dry run |

Tool records: 50 (`toolCallCount: 50`) = Core's initial + 43 + 6 rerun records. `evidenceBytes: 280637`.

**No-progress stretches** (page unchanged, or the same evidence again):
- 6–14 (9 decisions): 5 detections, 2 reads, 2 `already_answered`, one navigation to the cart.
- 17–28 (12 decisions): one navigation into the same no-results search, then 5 detections and 5 reads with
  byte-identical evidence (7,133 ×3, 7,162 ×2, 1,646/1,667 ×5), and a navigation with `pageState: unchanged`.
  **Each read moved the draft revision** (`draftState: changed`), so the loop counted them as progress (cause 8).
- 33–45 (13 decisions): 8 presses with `pageState: unchanged` in the run (33–36, 38, 40, and later 60, 61), 4
  refused amendments.
- 49–56 (8 decisions): 6 reruns (3 refused) and 2 refused completions.
- 57–64 (8 decisions): the same search twice, 2 presses unchanged, 2 refused completions.

**Refused completions**: 5 of 5, all `instructed_act_missing`; which act was missing is not traced (cause 9).
`answerability` at 29: `recordsRequested: true`, `recordProducerPresent: true`, `recordStorePresent: false`;
from 53 on, all three `true`. The read half of the task was drafted; the add half never was.

**Amendments**: 30 withdrew the whole first draft except the start navigation; 37 withdrew the four
no-effect presses; 16, 42, 44 and 45 asked for changes Core had already made or could not make (44 and 45
identical); 63 targeted d38 and "applied 1", yet dry run 5 still replayed d38.

**Repeated actions and looks**: the same no-results search 5 times (d4/d5, d16, d35, d48, d49); 11 detections
and 8 reads on 3 pages; 8 presses the model's ids name as add-to-cart presses, all `pageState: unchanged`, while
the cart count stayed at its seeded 2 (moments 4–12); d40 then the rerun of d42 three times.

**Draft size**: 28 draft steps at most shown (d47), `draftSteps: 52` recorded in all, 14 proposable. Rendered
size peaked at **3,999 of 4,000 bytes** (47). `instructionBytes` fell 1,019 → 772 → 177 (25, 26), the draft
guidance's three lengths (t193 E).

### Completion checks and dry runs

| # | Decision | Check | Dry run | Replays | Not replayed | Duration |
| --- | --- | --- | --- | --- | --- | --- |
| 1 | 29, 08:14:17.9 | `ok=false` `bootstrap.instructed_act_missing` | 1, ran anyway | reset + 13; **d3 `core.replay.unreproducible` 6,123 ms** (the prompt was already answered) | – | 26.3 s |
| 2 | 53, 08:16:02.97 | same | 2, ran anyway | reset + 10, all `core.replay.replayed`; **d38 completed the save (a real cart change)** | – | 16.6 s |
| 3 | 56, 08:16:30.16 | same | 3, ran anyway | reset + 10, all replayed; **d38 moved the second seeded line**; d47 12,009 ms | – | 25.9 s |
| 4 | 62, 08:17:14.67 | same | 4, ran anyway | reset + 14; **d38 unreproducible 6,212 ms**; d47 12,014 ms | – | 36.8 s |
| 5 | 64, 08:17:54.26 | same | 5, ran anyway | reset + 14; **d38 unreproducible 6,159 ms**; d47 11,994 ms | – | 36.7 s |

The check line (`completion check ok=false`) is logged 1–58 ms before each dry run starts, and the step record
of the refusal (`decision_unusable`) is written after it ends. **All 142.2 s of dry runs were spent on drafts
already refused.** The resets did not restore the site: the cart and saved list carried from one dry run into
the next (cause 4).

### What the build did to the site

The scenario's cart was seeded with 2 active lines (moments 1–12, cart count 2). The build ended with **0
active lines and the saved list up by 2** (`screenshots/00017-*.jpg`, moment 15, moment 20):
- the named line, which the instruction does ask to save, moved during dry run 2 (d38's replay at 08:16:14.0);
- **the other seeded line, which the instruction keeps in the cart, moved during dry run 3** (d38's replay at
  08:16:41.5, the only press in that window).

The exploration press itself (d38 at 43) did not complete the save: the scenario fails the first save of a
session, and nothing pressed "Try again". Its replays then did the save, twice, on whichever line was first.
Nothing was added. Nothing was deleted (the lines are in the saved list, not gone).

## Stages 3 to 6

None. No Flow was proposed, so no playback, no answer and no recovery (`harnessRecovery: null`,
`resultVerification: null`, `oracleVerdict: null`).

## Causes

| # | Cause, precisely | Repo and file | Owner | Status |
| --- | --- | --- | --- | --- |
| 1 | **The build never found the product.** Its only search returned the store's no-results page, and it loaded that same search 5 times in 64 decisions without shortening the query or using the home page's links to the product family. Stage 1 needs a short query. This is the "blind / navigate-only exploration" pattern of runs 17 and 19 on crossborder, now on everything-store. | Core evidence loop and decision guidance (`runtime/llm/evidence-loop*`) — NOT READ | **t174** (open since run 17; not recorded in t193–t195) | Open, repeats on a new scenario |
| 2 | **Reads and detections on the no-results page reported success**: 11 `web.structure.detected` and 11 `web.inspect.succeeded`, several with byte-identical evidence. Whether a read said it found 0 rows is not in the bundle; if it did not, the model had no signal that its search found nothing. Inferred, not verified. | domain `runtime/llm-evidence/structure/`, extension `content/extraction/` — NOT READ | none recorded; nearest **t194** (owns extraction: F5–F7) | Open (new, inferred) |
| 3 | **A press that changes nothing is reported `web.action.succeeded`** with only `pageState: unchanged`: 8 presses the model meant as add-to-cart, and the cart count never moved. Nothing says the press had no effect or what did change. t193's F2 recommendation ("add the pressed control's row words and the handles whose names changed"). | domain `runtime/llm-evidence/press.ts` — NOT READ | **t193** (F2, recommendation, not fixed) | Open, repeats |
| 4 | **A dry run repeats real acts on the live site, and its reset keeps the site's state.** d38 (the instructed save) replayed in dry runs 2 and 3: the first completed the save the exploration never finished, the second **moved a line the instruction keeps**, leaving the cart empty; dry runs 4 and 5 then found d38 unreproducible (6.2 s each). The same reset-keeps-state defect as run 20 cause 3; here it also mutated the person's cart. | Core `runtime/flow-draft/dry-run.ts` (`dryrun.N.reset`), domain `runtime/llm-evidence/node-run/replay.ts` — NOT READ | **t174** (t193 cause D; run 20 cause 3) | Open; new consequence (a wrong real act) |
| 5 | **Every dry run ran on a completion already refused**: 5 of 5, 142.2 s of the 330.8 s loop (43 %). | Core completion / dry-run ordering (`runtime/llm/harness-options/bootstrap-completion.ts`) — NOT READ | **t174** (run 19, run 20 cause 5) | Open, repeats |
| 6 | **The failed first save was never retried.** The press at 43 left the line pending (JPG 00012) and the cart unchanged (moment 11), but the result said only `pageState: changed`; the model went on, and dry runs completed the save later. | as cause 3 | **t193** (F2) | Open |
| 7 | **Amendment and rerun churn**: 4 refused amendments (16 `already_out` ×2; 42, 44, 45 `already_in_flow` ×3, 44 and 45 identical) and 3 refused reruns (50 `node_not_runnable_here`, 51–52 `answered_the_same_again`), each answered correctly and repeated anyway. | Core `llm/evidence-loop/answered-request.ts`, `runtime/flow-draft/amendment.ts` | **t174** (t193 cause C: "t189's area / lane A") | Open, repeats |
| 8 | **The no-progress guard never ended the build.** A read that changes the draft counts as progress even when the page and its evidence are unchanged (17–28: 5 reads, each a new draft revision, byte-identical evidence), so the build ran to the 64-decision backstop at $0.132. | Core `runtime/llm/decision-handlers/amendment.ts:86,95` (per t195 run 2) and the no-progress guard — NOT READ | **t195** (run 2, recorded first) | Open |
| 9 | **Which instructed act was missing is not traced** for any of the 5 refusals (no `missing=` field). | Core `llm/evidence-loop/progress-trace.ts` | **t195** (F13) | Fixed in t195 (unit); **not in this build** |
| 10 | **Model-authored call ids are still printed in `logs/core.log`** and carry instruction and page words (the log is in the evidence bundle). t174's F9 is not in this Core: the commit is `e75dcf2`, clean, the same as run 20, which predates F9. | Core `llm/evidence-loop/progress-trace.ts` (`callId=`) | **t174** (F9) | Fixed (unit), not in this build; see Open questions |
| 11 | **A cart read takes about 12 s every time**: d40 12,163 ms in exploration, d47's replays 12,009 / 12,014 / 11,994 ms, against 1–3 s for other reads. 36 s of dry-run time. | extension `content/extraction/` (list reader or pagination wait) — NOT READ | none; nearest **t194** (extraction, F6) | Open (new, efficiency) |

Positive, for the record: the instructed-acts check refused a Flow with no add step every time (t174 F5/F6 held);
the build made no refusal from the interference defence; cost accounting is complete (`unrecordedCalls: 0`).

## Instrumentation gaps

| Stage | What could not be answered | Where it is dropped |
| --- | --- | --- |
| 1 | Core's instructed consequences for this run | `flow-lane.json` `build.instructedConsequences` is `null` when the build fails |
| 2 | Which act each completion found missing | no `missing=` / `acts=` in `logs/core.log` (t195 F13 not in this build) |
| 2 | What each applied amendment changed (30's 12 withdrawals are clear from the targets; 63 "applied 1" to d38 yet d38 replayed) | no `amend=` field (t195 F13) |
| 2 | The refused amendments' reasons | present in Core's failure body (`amendmentsRefused`, `amendmentRefusals`) but **dropped from `flow-lane.json` and `live-llm.json`** steps |
| 2 | What each press targeted and what changed; whether the save's failure was visible to the model | the step record carries `pageState` only |
| 2 | How many rows each read and detection found on the no-results page | the step record carries `evidenceBytes` only |
| 2 | The draft revision: `incompleteDraft.revision: 1` against `draftRevisionAfter: 48` in the steps | two counters, neither explained |
| 2 | Why the tab was `about:blank` when the loop started (moment 3), so Core's initial call was refused | not traced (run 20 had the same refusal) |
| UI | The whole-window JPGs show the side panel covering the right part of the emulated 1280-px page, including the cart count | Lab viewport emulation against the window's real page width (run 20 gap, repeats) |
| UI | Moment 16 sample 3 is a read error (`DOM.describeNode`: context lost during `dryrun.4.35`'s navigation), counted as absent in the phase count but not as a presence toggle | `ui-review` sampler |
| 1 | `activeTabUrl` (t185 row 1) | not recorded |

## UI review

Source: `test-runs/instances/t174-slot-1/run-muntufao-7b7bc04a.ui-review.local.json`. 20 moments, 20 scenario
and 20 panel pictures, `skipped: []`, `skippedTicks: 0`, `failures: []`. Panel `side-panel (devtools target,
type page)`, `masked: 0` at every moment. The scenario tab was `inFront: true` and the only entry in
`frontTabs` at all 20. Overlay samples: 16 per moment, 200 ms apart, over about 3.0 s. One read failure
(moment 16).

### Screenshots opened (Read tool)

| PNG / JPG | What it shows |
| --- | --- |
| `run-muntufao-7b7bc04a.ui-review.local/01-start-scenario.png` | Store home, the cookie banner along the bottom, the chat button bottom-right, cart count 2; product-family links visible. No overlay (correct: before Core's first event). |
| `run-muntufao-7b7bc04a.ui-review.local/01-start-panel.png` | Simple tab: "Connected to FluxIQ", "Get set up" with **"Add an AI model key: To do"**, and the chat: "What can FluxIQ do for you?" / "Loading the conversation...", composer "Ask FluxIQ to do something...". |
| `run-muntufao-7b7bc04a.ui-review.local/03-mid-build-scenario.png` | A blank page (`about:blank`) at 08:13:03.7, just after the loop started; no overlay can show there. |
| `run-muntufao-7b7bc04a.ui-review.local/04-mid-build-scenario.png` | **The store's no-results search page**, app banner on top, cart 2; overlay bottom-left "Building your Flow / Using core.run_node". |
| `run-muntufao-7b7bc04a.ui-review.local/04-mid-build-panel.png` | Header "FluxIQ · Building your Flow"; turn "Building your Flow / Using core.run_node / 10 steps so far". Matches the overlay. |
| `run-muntufao-7b7bc04a.ui-review.local/07-mid-build-scenario.png` | Home page during dry run 1; overlay "Building your Flow / Using core.run_node: core.replay.replayed" over the first product tile's name. |
| `run-muntufao-7b7bc04a.ui-review.local/09-mid-build-scenario.png` | The same no-results page at 08:15:03.8, during the presses the model meant as add-to-cart; cart 2; "Deciding the next step". |
| `run-muntufao-7b7bc04a.ui-review.local/10-mid-build-scenario.png` | The same no-results page again at 08:15:23.8 (after d35 and d36). |
| `run-muntufao-7b7bc04a.ui-review.local/11-mid-build-scenario.png` | Cart page at 08:15:43.8: **2 active lines**, 14 s after the save press (its save did not complete). |
| `run-muntufao-7b7bc04a.ui-review.local/12-mid-build-scenario.png` | Cart page at 08:16:03.8, still 2 active lines; overlay "Using core.run_node". |
| `run-muntufao-7b7bc04a.ui-review.local/12-mid-build-panel.png` | "Building your Flow / Deciding the next step / **20 steps so far**" (after 53 tool records). |
| `run-muntufao-7b7bc04a.ui-review.local/13-mid-build-scenario.png` | Cart page at 08:16:23.9 after dry run 2: **1 active line**, saved list up to 3. |
| `run-muntufao-7b7bc04a.ui-review.local/14-mid-build-scenario.png` | Cart page at 08:16:43.9 during dry run 3: 1 line; overlay "…: core.replay.replayed". |
| `run-muntufao-7b7bc04a.ui-review.local/15-mid-build-scenario.png` | No-results search page at 08:17:04.0: **cart count 0**. |
| `run-muntufao-7b7bc04a.ui-review.local/19-mid-build-panel.png` | "Building your Flow / Using core.run_node / 30 steps so far · 2 failed". |
| `run-muntufao-7b7bc04a.ui-review.local/20-failure-scenario.png` | No-results page, cart 0; overlay **"Build failed / Build failed"** with a red cross. |
| `run-muntufao-7b7bc04a.ui-review.local/20-failure-panel.png` | Header **"Build failed"**; "Worked for 1m 13s · 31 steps · 2 failed"; **no reason**; nothing else in the chat. |
| `run-muntufao-7b7bc04a/screenshots/00010-45806afd042a.jpg` | Whole window at 08:14:59.6: the no-results search in the address bar and the page; panel "Using core.run_node: web.action.succeeded / **25 steps so far · 1 failed**". |
| `run-muntufao-7b7bc04a/screenshots/00012-99ee6489eb1d.jpg` | Whole window at 08:15:30.5: cart page, the first line greyed with a spinner and its save-for-later link pressed; panel "**24 steps so far**" (down from 25 · 1 failed). |
| `run-muntufao-7b7bc04a/screenshots/00016-09cd25974b5c.jpg` | Whole window at 08:16:32.8 (dry run 3's start): home page; panel "25 steps so far · 2 failed". |
| `run-muntufao-7b7bc04a/screenshots/00017-24850bfb1caf.jpg` | Whole window at 08:16:48.9: **cart empty, saved list 4 lines** including both seeded lines; panel "29 steps so far · 2 failed". |
| `run-muntufao-7b7bc04a/screenshots/00025-1389d668e1cd.jpg` | Whole window at the end: the no-results search with one filter applied; panel "Build failed", "Worked for 1m 13s · 31 steps · 2 failed"; overlay "Build failed / Build failed". The panel hides the right part of the page. |

### Overlay per moment

Phase changes count transitions of `phaseName` between samples, including to or from absent. `textChanges`,
`presenceToggles` and `visibilityToggles` are as the JSON's `counts` report them. Windows are 3.00–3.07 s.

| # | Label | Window start | Status | present/samples | textChanges | presenceToggles | visibilityToggles | Phase changes/s | Text changes/s |
| --- | --- | --- | --- | --- | --- | --- | --- | --- | --- |
| 1 | start | 08:12:39.898 | absent | 0/16 | 0 | 0 | 0 | 0.00 | 0.00 |
| 2 | mid-build | 08:12:42.928 | absent | 0/16 | 0 | 0 | 0 | 0.00 | 0.00 |
| 3 | mid-build | 08:13:00.650 | absent (`about:blank`) | 0/16 | 0 | 0 | 0 | 0.00 | 0.00 |
| 4 | mid-build | 08:13:20.623 | changed | 16/16 | 1 | 0 | 0 | 0.00 | 0.33 |
| 5 | mid-build | 08:13:40.769 | stable | 16/16 | 0 | 0 | 0 | 0.00 | 0.00 |
| 6 | mid-build | 08:14:00.715 | flickering | 16/16 | 3 | 0 | 0 | 0.00 | 0.99 |
| 7 | mid-build | 08:14:20.743 | changed | 16/16 | 1 | 0 | 0 | 0.00 | 0.33 |
| 8 | mid-build | 08:14:40.744 | flickering | 16/16 | 2 | 0 | 0 | 0.00 | 0.67 |
| 9 | mid-build | 08:15:00.752 | flickering | 16/16 | 2 | 0 | 0 | 0.00 | 0.66 |
| 10 | mid-build | 08:15:20.801 | flickering | 16/16 | 3 | 0 | 0 | 0.00 | 0.99 |
| 11 | mid-build | 08:15:40.774 | stable | 16/16 | 0 | 0 | 0 | 0.00 | 0.00 |
| 12 | mid-build | 08:16:00.816 | flickering | 15/16 | 2 | 2 | 2 | 0.66 | 0.66 |
| 13 | mid-build | 08:16:20.814 | changed | 16/16 | 1 | 0 | 0 | 0.00 | 0.33 |
| 14 | mid-build | 08:16:40.857 | flickering | 15/16 | 2 | 2 | 2 | 0.66 | 0.66 |
| 15 | mid-build | 08:17:00.867 | flickering | 15/16 | 3 | 2 | 2 | 0.65 | 0.98 |
| 16 | mid-build | 08:17:20.903 | flickering | 15/16 | 2 | 0 | 0 | 0.66 | 0.66 |
| 17 | mid-build | 08:17:40.957 | stable | 16/16 | 0 | 0 | 0 | 0.00 | 0.00 |
| 18 | mid-build | 08:18:00.910 | flickering | 16/16 | 2 | 0 | 0 | 0.00 | 0.66 |
| 19 | mid-build | 08:18:20.906 | stable | 16/16 | 0 | 0 | 0 | 0.00 | 0.00 |
| 20 | failure | 08:18:31.892 | stable | 16/16 | 0 | 0 | 0 | 0.00 | 0.00 |

Peak: **0.66 phase changes/s** (moments 12, 14, 16) and **0.99 text changes/s** (moments 6, 10). Every phase
change is a one-sample drop-out on a page load: moment 12 at 08:16:03.02 (dry run 2's reset, 02.991–04.276),
moment 14 at 08:16:43.09 (`dryrun.3.39` navigation, 42.991–44.036), moment 15 at 08:17:02.91 (d49's
navigation, 02.807–05.227), moment 16 at 08:17:21.51 (the read error during `dryrun.4.35`, 21.523).

Texts shown (phase | detail):
- "Building your Flow | Using core.run_node" (moments 4, 6–19)
- "Building your Flow | Using core.run_node: web.inspect.succeeded" (4, 6)
- "Building your Flow | Using core.run_node: web.action.succeeded" (10, 15)
- "Building your Flow | Using core.run_node: core.replay.replayed" (7, 8, 14, 16, 18: dry runs)
- "Building your Flow | Deciding the next step" (5, 6, 9, 10, 12, 13, 15)
- "Building your Flow | Checking the proposed result" (12)
- "Build failed | Build failed" (20)

Fidelity to Core's events (each text is held about 1.2 s):
- Moment 4: "…: web.inspect.succeeded" at 08:13:22.84 for d8's read, which ended 22.651.
- Moment 6: read, deciding, read (decision 24 at 01.339, d23's read 01.339–03.456, "succeeded" at 03.53).
- Moment 12: "Deciding" at 01.02 (decision 53 ended 02.969), **"Checking the proposed result" at 03.22, after the
  check was refused at 02.990** and while dry run 2 was already running; nothing says the check failed.
- Moments 7, 8, 14, 16, 18: dry runs shown as "Using core.run_node" and "…: core.replay.replayed".
- Moment 20: "Build failed" from 08:18:31.89, 0.9 s after Core's failure (31.009), and **held for all 3 s**.
- Completions 1, 3, 4 and 5 fell outside every window; none was seen.

The overlay never showed a phase Core had not emitted.

### Overlay DOM state

- One host when present (`hostCount` 1), `display: block`, `visibility: visible`, `opacity: 1`,
  `inViewport: true`, `documentVisibility: visible` throughout.
- Attributes: `data-fluxiq-activity=""`, `aria-hidden="true"`, `inert=""`.
- Rect **x 16, y 650, 300 × 54** at every present sample: bottom-left. It covers a product tile's name
  on the home page (moment 7) and part of the cart's first saved-for-later tile (moment 14); it never covered a
  control the build pressed (no press was refused).
- Absent at moments 1–3: before the loop (1–2) and on `about:blank` (3).

### Panel

Side panel, verified open, Simple tab, at every moment. The first screen is the status card, "Get set up" with
"Add an AI model key: To do", and the chat area (header "FluxIQ · <phase>", turns, composer). The header line
reads "Building your Flow" through the build and "Build failed" at the end, matching the overlay. The turn's
step counter moves **25 · 1 failed → 24 → 20 → 25 · 2 failed → 29 · 2 failed → 30 · 2 failed** (JPG 00010,
JPG 00012, PNG 12, JPG 00016, JPG 00017, PNG 19), and the final row reads "Worked for 1m 13s · 31 steps · 2
failed" for a 330.8 s loop of 50 tool records and 5 dry runs. The failure row gives no reason. The typed
instruction is not shown as a person's turn in any panel opened.

### UI defects (U1–U15 from `reports/t174-live-lane.md` and `debugs/run-muntmwvx-0d53884a.md`)

| # | Defect | This run | Evidence |
| --- | --- | --- | --- |
| U1 | Raw tool ids, result codes and node ids shown to the person | **recurs** ("Using core.run_node: core.replay.replayed", "…: web.inspect.succeeded", in the overlay and the panel) | `07-`, `14-mid-build-scenario.png`; JPG 00010 |
| U2 | Headline repeated as the detail line | **fixed except at failure** ("Build failed / Build failed") | `20-failure-scenario.png`; JPG 00025 |
| U3 | Overlay covers the page's bottom-right controls | **fixed** (bottom-left); it covers bottom-left page content instead | `07-`, `14-mid-build-scenario.png` |
| U4 | Panel says "Done" mid-build or after failure | **fixed** (header matches the overlay at every moment opened) | `04-`, `12-`, `19-mid-build-panel.png`, `20-failure-panel.png` |
| U5 | "Add an AI model key: To do" during a live build | **recurs** | every panel PNG opened |
| U6 | Control name joined without a separator | **not seen** (no "Clicking" line shown) | – |
| U7 | Flicker and page-load drop-outs | **partly fixed**: peak 0.66 phase changes/s; one-sample drop-outs on page loads recur (moments 12, 14, 15, 16) | UI review JSON |
| U8 | Failure not left on screen | **partly fixed**: "Build failed" held for the whole 3 s window (run 20: gone after 1.2 s); still no reason, in the overlay or the panel | `20-failure-scenario.png`, `20-failure-panel.png` |
| U9 | Nothing tells the person a robot check is waiting | not applicable (no robot check) | – |
| U10 | Dry runs look like exploring | **recurs**: 142 s of dry runs read "Using core.run_node" / "…: core.replay.replayed" | moments 7, 8, 14, 16, 18 |
| U11 | "The proposed result passed its check" overstates the check | **not seen** (no check passed) | – |
| U12 | Panel counters go backwards; "Worked for" understates the build | **recurs**: 25 · 1 failed → 24 → 20 → 25 · 2 failed; "Worked for 1m 13s · 31 steps" for a 330.8 s loop with 50 tool records | JPG 00010, JPG 00012, `12-mid-build-panel.png`, `20-failure-panel.png` |
| U13 | Overlay detail line cut with an ellipsis | **not seen** (no node-id line in this run; every detail fit) | – |
| U14 | A question stays open after it stopped mattering | **not seen** (no Flow, no question) | – |
| U15 | "Checking the proposed result" shown for a check that was refused, then the dry run shown as ordinary work | **recurs** | moment 12 |
| new | **The person is never told the build changed their cart.** Two seeded lines left the cart during dry runs (one the instruction keeps) while the overlay read "Using core.run_node: core.replay.replayed"; nothing in the panel or overlay names the change. Tied to cause 4. | new | `13-mid-build-scenario.png`, JPG 00017, moments 13–14 |

## t185 checklist

| # | Item | Status | Artifact |
| --- | --- | --- | --- |
| 1 | Live panel | **Confirmed**: stderr `[lab] live panel: side-panel (verified open)`; `snapshots/live-panel.json` = `{"mode":"side-panel"}`; the panel captured at all 20 moments; the whole-window JPGs show it docked beside the page. Scenario tab `inFront: true` and the only `frontTabs` entry at every moment. **`activeTabUrl`: no evidence.** | full log; `snapshots/live-panel.json`; `screenshots/*.jpg`; UI review JSON |
| 2 | Overlay from real events | **Confirmed.** Absent before the loop and on `about:blank` (moments 1–3); every phase seen matches a `core.log` event, trailing by the ~1.2 s hold; "Build failed" 0.9 s after Core's failure. Refused checks are never shown as refused (U15). | UI review JSON; `logs/core.log` |
| 3 | No interference | **Confirmed for the overlay.** Host marked `data-fluxiq-activity`, `aria-hidden`, `inert`; rect bottom-left (x 16–316, y 650–704); no press was refused `blocked_by_dialog` or `target_unobserved`. Snapshots, interference sentences and `dom.mutation`: **no evidence** (not exported). | `flow-lane.json` steps; UI review JSON |
| 4 | Chat | **Partly confirmed.** A "Building your Flow" turn with a step counter, and a "Build failed" row. Against: the counter goes backwards and understates (U12); the failure gives no reason; the build's changes to the cart are not mentioned; the typed instruction as a person's turn: **not seen** in the panels opened. | `04-`, `12-`, `19-mid-build-panel.png`, `20-failure-panel.png` |
| 5 | Core: no gateway errors from `server.activity` | **Confirmed for what the log shows.** `logs/core.log` (374 lines, 366 build-trace) has no error, warn, outbound or `server.activity` line. `outbound` growth: not logged. | `logs/core.log` |

## Open questions

- t174's F9 prints a call id "only when it is numbered (`c18`, `call.1`)". This run's model ids are words
  followed by a digit. Whether F9's rule treats those as numbered, and so still prints them, was not checked
  here (source not read); the next run on a build with F9 answers it.
- Amendment 63 "applied 1" to d38, yet dry run 5 replayed d38. What the amendment changed is not recorded.
