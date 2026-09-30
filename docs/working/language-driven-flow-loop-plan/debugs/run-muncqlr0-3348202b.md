# Run debug — `run-muncqlr0-3348202b`

Worker t174-w3, 2026-09-29. Read from the bundle at
`test-runs/instances/t174-slot-1/run-muncqlr0-3348202b` in the t174 worktree, and from Core
source in the t174 Core worktree (commit `259a11b`, dirty; `dev` = `e85a02a`). No product code
changed.

---

## Header

- Run id: `run-muncqlr0-3348202b`
- Scenario / variant / task: `bigbox-retail` / none / `bigbox-retail-pickup-cart` (`form`,
  judged by playback goal `build-pickup-cart`)
- Command: NO EVIDENCE: the bundle does not record the Lab command line (`run.json` has
  ports, commits and extension path only).
- Date, provider, model: 2026-09-30 00:13:18Z to 00:23:09Z, DeepSeek, `deepseek-flash`, profile
  `production`, grant 48 calls, $0.25 per call, $2 total.
- Provider calls, tokens, cost: **the bundle claims 0 calls.** `core.log` shows 37 `decide`
  round trips, each 2.9 to 12.9 s long, which are provider calls. The accounting is `null`
  because the build ended in a throw that was filed as `flow_bootstrap.pre_provider_validation_failed`
  (`flow-lane.json` `build.providerCalls: 0`, `providerInvocation: "not_attempted"`). Tokens
  and cost: NO EVIDENCE (dropped with the accounting).
- Verdict as reported: failed, `runtime.behavior`, "Live LLM run reached no provider". That
  message is false. The build ran 244 s (`durationMs: 244249`) and made 37 decisions.
- **Stage reached: 2 (exploration).** Two completions were refused. No Flow was created, and
  nothing was replayed, answered or judged.

## Stage 1 — the instruction and the expected chain

Written from `apps/scenario-lab/src/scenarios/bigbox-retail/live-tasks.ts` and
`manifest/{manifest,primary-workflow,opening-steps,expected-values}.ts` before the run was read.

- The instruction, verbatim: "Switch my pickup store to Millbrook Crossing Supercenter, then add
  two packs of the ValueRidge Essentials Select-A-Size Paper Towels in the 12 Double Rolls size
  and one pack of the ValueRidge Everyday Dinner Napkins in the 250 Count size to my cart, both
  for pickup. Keep what is already in my cart as it is, and do not check out."
- The node chain a correct Flow must have (the recorded `PRIMARY_SCRIPT`):
  1. navigate to `/scenarios/bigbox-retail/` (the Flow must reach its start)
  2. click "Accept all" on consent. This step is conditional: the dialog appears only on the first visit.
  3. wait for the $10 email offer and click "No thanks". Also conditional.
  4. click the store chip (`vr-fulfillment-picker` open shadow root)
  5. click "Set as my store" in the card whose `<strong>` is "Millbrook Crossing Supercenter".
     Four identical buttons, and the page reloads (`set-store`, then `location.reload()`).
  6. wait for the chip to read "Millbrook Crossing Supercenter"
  7. type "select-a-size paper towels" in the header search, then press Enter
  8. open listing `418830127`, the organic result rather than the sponsored one
  9. choose "12 Double Rolls", then press "+" once so the quantity is 2
  10. close the Val support card, which lies over the pinned Add to cart
  11. press Add to cart twice (the first press only wakes the page) and wait for "Added to cart"
  12. click "Continue shopping"
  13. search "dinner napkins", open listing `418831402`, choose "250 Count"
  14. press Add to cart twice and wait for "Added to cart"

  That is 19 action steps, plus a checkpoint and 8 waits. With the navigation, 20 action nodes
  (the lane summary's "20").
- Order matters: the 12-roll pack cannot be picked up at either Carden Falls store, so
  adding it before switching adds it for delivery.
- Goal facts (`PICKUP_CART_FACTS`): the mini cart shows store Millbrook; the soap is kept
  (`1 × … Dish Soap · Pickup`); `2 × … Paper Towels, 12 Double Rolls · Pickup`;
  `1 × … Dinner Napkins, 250 Count · Pickup`; `4 items · Subtotal $43.39`.
- What a wrong answer that looks right would look like: towels added **before** the store
  switch (the right lines but `· Delivery`); a quantity of 1 instead of 2; the 6-roll size;
  the sponsored listing's product; Buy now pressed; the soap removed.

## Stage 2 — exploration

From the `[FluxIQ build-trace]` lines in `logs/core.log`. Draft positions are inferred
from the dry-run call ids (`dryrun.<attempt>.<position>`, `llm/node-tools/replay-draft.ts:85`),
and they fit only if **every** tool_call decision takes a position, including those answered
from memory. With that numbering, `dryrun.1.4`, `dryrun.1.11`, `dryrun.2.21` and `dryrun.2.22`
land exactly on `dismiss-privacy-2`, `open-store-picker-2`, `nav-start` and `open-store-picker-3`.

| It | Pos | Decision | Call id / tool | Result |
| --- | --- | --- | --- | --- |
| 0 | 1 | (initial, Core's) | `initial.core.run_node` | `web.inspect.succeeded`. The tab was **already on the page**, and nothing navigated. |
| 1 | 2 | tool_call | `dismiss-privacy` | `web.action.rejected.target_unobserved` |
| 2 | 3 | tool_call | `snap2` | `web.inspect.succeeded` |
| 3 | 4 | tool_call | `dismiss-privacy-2` | `web.action.succeeded` |
| 4 | 5 | tool_call | `open-store-picker` | `web.action.rejected.target_unobserved` |
| 5 | 6 | tool_call | `snap3` | `web.inspect.succeeded` |
| 6–9 | 7–10 | tool_call ×4 | none run | answered from memory (`evidence-loop.ts:710-717`); which of `already_answered` / `already_observed` / `not_offered` is NO EVIDENCE |
| 10 | 11 | tool_call | `open-store-picker-2` | `web.action.succeeded` |
| 11 | – | amend_draft | – | content NO EVIDENCE |
| 12 | 12 | tool_call | `pick-millbrook` | `web.action.succeeded` (the page reloads) |
| 13 | 13 | tool_call | `snap-store-list` | `web.inspect.succeeded` |
| 14–20 | 14–20 | tool_call ×7 | none run | answered from memory, 7 in a row |
| 21 | – | amend_draft | – | – |
| 22 | – | **complete #1** | – | refused `bootstrap.completion_profile_limit_exceeded`, `bootstrap.cannot_reach_start_location`. Dry run 1: reset `core.replay.replayed`; pos 4 and 11 `core.replay.unreproducible` |
| 23 | – | amend_draft | – | (drops 4 and 11, as dry run 2 shows) |
| 24 | 21 | tool_call | `nav-start` | `web.action.succeeded` |
| 25 | 22 | tool_call | `open-store-picker-3` | `web.action.succeeded` |
| 26 | – | **complete #2** | – | refused `bootstrap.instructed_act_missing`. Dry run 2: reset, pos 21 and 22 all `core.replay.replayed` |
| 27–30 | – | amend_draft ×4 | – | 4 amendments in a row |
| 31 | 23 | tool_call | `open-store-picker-4` | `web.action.succeeded` |
| 32 | – | amend_draft | – | – |
| 33 | 24 | tool_call | `pick-millbrook-2` | `web.action.succeeded` |
| 34 | 25 | tool_call | `open-store-picker-5` | `web.action.succeeded` |
| 35 | – | amend_draft | – | – |
| 36 | 26 | tool_call | `open-store-picker-6` | `web.action.succeeded` |
| 37 | 27 | tool_call | `pick-millbrook-3` | `web.action.succeeded` 00:23:05.830. Then no `decide start iteration=38` line; the process exits `code=1` and the build is filed `pre_provider_validation_failed` |

Totals: 37 decisions = 26 tool_call (15 executed, 11 answered from memory) + 9 amend_draft + 2
complete, which matches the brief.

- **Repeats.** The store chip was opened 6 times (1 rejected, 5 succeeded) and Millbrook
  picked 3 times. **Across 37 decisions the build never reached the second act.** Nothing
  searched, no product page opened, and Add to cart was never pressed. 11 decisions (30%) asked
  for something the loop answered from memory, in runs of 4 and 7. After completion #2 the build
  did 6 more amendments and 5 more store-picker clicks.
- **What the loop believed was progress.** Each `pick-millbrook` reloads the page, so the page
  digest changes and the no-progress guard clears. After the reload the flyout is closed and
  the chip reads the new store. The model's likely reading is "the switch did not take", so it
  reopened the chip and picked again. With Millbrook current, the Millbrook card has no button
  ("Your store"), so a later "Set as my store" press must have hit **another** store's card.
  That is a hypothesis: the store actually set after `pick-millbrook-2`/`-3` is NO EVIDENCE.
- **Rejections.** Twice `web.action.rejected.target_unobserved` (`dismiss-privacy` and
  `open-store-picker`, each on the first try). Each was routed around by looking again
  (`snap2`, `snap3`), then retried successfully, so the code said enough.
- **Why `pick-millbrook` (pos 12) was never in the Flow.** Neither dry run replayed position
  12, so at completion #1 it was not a proposed step. Either its `effectApplied` was false,
  because the click reloaded the page and the post-condition could not see the change, or the
  amendment at iteration 21 withdrew it. NO EVIDENCE: `progress-trace.ts` logs neither
  `effectApplied` nor the amendment's content.
- **Context eviction or truncation:** NO EVIDENCE. `draftShown` and the window sizes live in
  the loop trace, which a failed build does not store and the Lab deletes with the Core store
  (`llm/evidence-loop/progress-trace.ts` header).

## Stage 3 — the proposed Flow

No Flow was created. What the draft proposed at each completion, from the dry runs:

- Completion #1: 2 steps, pos 4 `dismiss-privacy-2` (consent click) and pos 11
  `open-store-picker-2` (chip click). No navigation, no store selection, nothing added.
- Completion #2: 2 steps, pos 21 `nav-start` (navigate) and pos 22 `open-store-picker-3`
  (chip click). No store selection, nothing added.
- Divergences from stage 1: every node from stage-1 step 5 onward is missing. Step 5 (pick
  Millbrook) ran 3 times and was never kept. Steps 7 to 14 never ran.
- Classification: **misread the page** (the store switch after the reload was not recognised
  as done). The build never reached anything it could not express.
- Node parameters as authored: NO EVIDENCE. The draft steps' `input`/`ranWith` are not in the
  bundle (`progress-trace.ts` is content-free by design, and the failed build's draft record is
  not exported).

### Refusal 1a — `bootstrap.completion_profile_limit_exceeded`

- Raised at Core `runtime/llm/harness-options/bootstrap-completion.ts:239-247`, from
  `automationStudioEvidenceFlowBootstrapLimitsExceeded` in
  `runtime/flow-bootstrap/plan/profile-limits.ts:47-73`.
- The draft existed and every proposed step was a `core.run_node` step, so the plan was
  **drafted** (`bootstrap-completion.ts:214-216`) and held to the Flow's own limits
  (`plan/limits.ts:5-15`): `maxNodesPerSubflow: 64`, `maxPlanBytes: 65_536`. Only
  `maxSummaryLength` (240), `maxNameLength` (120), `maxRules`, `maxRouteTags` and
  `maxParametersPerNode` (16) stay on the one-reply profile (`plan/limits.ts:22-32`).
- **Which limit it was.** The plan had 2 nodes in 1 subflow, so `maxNodesPerSubflow`,
  `maxSubflows`, `maxEdgesPerSubflow`, `maxRules` and `maxRouteTags` cannot trip. Names are
  clamped to 120 before measurement (`authoring/assemble.ts:62,137,152,162`
  `bounded(…, NAME_LIMIT)`). A click node declares 6 parameters (`domain/src/output-nodes/definitions.ts:238-243`
  plus `expectedState`), far below 16. A 2-node plan is nowhere near 64 KiB. That leaves
  **`maxSummaryLength` at path `summary`** (`profile-limits.ts:54`). `fromDraft`
  (`bootstrap-completion.ts:348`) takes `result.summary.trim()` **untruncated**, while the
  reply path's `boundedSummary` (`authoring/accept.ts:84-87`) slices the same summary to 240.
  So a summary over 240 characters is silently accepted when the model writes the plan and
  refuses the Flow when Core writes it. This is by elimination, not observed: `limitsExceeded`
  is not in the bundle.
- **The lane summary's premise does not hold for this run.** "20 action nodes against
  `maxNodesPerSubflow: 16`" would apply only if Core fell back to the reply's own plan. That
  happens only when a proposed draft step is not a `core.run_node` step
  (`llm/node-tools/draft-step.ts:104`). Here the draft had 2 nodes, and a drafted plan is
  allowed 64. The task does need more than 16 (20 action nodes), but the 64 limit covers it.
- **t175/dev did not change it.** `git log 259a11b..dev -- runtime/flow-bootstrap/plan/`
  shows nothing. `limits.ts` and `profile-limits.ts` last changed in `e82089f`, before the run,
  and dev's `limits.ts` still reads 64 / 16. t175 (`98133e7`) changed amendment memory only.

### Refusal 1b — `bootstrap.cannot_reach_start_location` (with 1a)

- Raised at `runtime/flow-bootstrap/reachability/check.ts:78-88`. The Lab passed a start
  location, the plan acted on it (two clicks), and no step went there.
- Why nothing restored it: `reachability/start-step.ts:68-70` puts back only a withdrawn
  arrival step that **ran**. This build never navigated. Core's initial call was an inspect
  that succeeded on the already-loaded page (`initial.core.run_node`, `web.inspect.succeeded`),
  so there was nothing to restore. The check's own premise ("a build handed its target begins
  already there" has no start location) is contradicted: this build had a start location **and**
  began already there.
- Correctable, and it was corrected: `nav-start` at iteration 24 cleared it at completion #2.
  It cost 2 decisions and a completion.

### Refusal 2 — `bootstrap.instructed_act_missing`

- Raised at `runtime/flow-bootstrap/instructed-acts/check.ts:31,62-104`, called from
  `bootstrap-completion.ts:292-298`.
- Acts Core reads from this instruction (run `automationStudioInstructedActs` on the task
  text): **2**, `a1` set/"switch" and `a2` add_to/"add". Both carry the same 200-character
  quote. "and one pack of … Napkins" is not a third act, so the checker requires one add step
  where the task needs two.
- The draft at completion #2 kept `nav-start` (navigate) and `open-store-picker-3` (chip
  click). **No step in the draft, or anywhere in the build, adds anything to a cart**, so `a2`
  genuinely had no step. `a1` had no step that switched the store either: `pick-millbrook` was
  never kept. Which act the checker named, and with what reason: NO EVIDENCE (`missingActs` is
  not traced).
- Completion #1 is worse. The same check ran (the draft was writable) and **passed**, with only
  a consent click and a chip click kept. `assign` falls back to matching leftover claims in
  order (`check.ts:137`), and the check verifies only that the named step is kept, mutating and
  unclaimed. So any two claims naming those two clicks satisfied "switch" and "add". The check
  cannot tell a chip click from a store switch, and here that let a Flow that does neither act
  through to the limit and reachability checks.

## Stage 4 — replay

Not reached; no Flow. The two dry runs are the only replays:

| Node | Executed | Produced | Duration | Retries | Rung that absorbed |
| --- | --- | --- | --- | --- | --- |
| dry run 1 reset | yes | `core.replay.replayed` | 1031 ms | – | – |
| pos 4 `dismiss-privacy-2` | yes | `core.replay.unreproducible` | 6482 ms | NO EVIDENCE | – |
| pos 11 `open-store-picker-2` | yes | `core.replay.unreproducible` | 5425 ms | NO EVIDENCE | – |
| dry run 2 reset | yes | `core.replay.replayed` | 1024 ms | – | – |
| pos 21 `nav-start` | yes | `core.replay.replayed` | 1039 ms | – | – |
| pos 22 `open-store-picker-3` | yes | `core.replay.replayed` | 1509 ms | – | – |

- Pos 4 is expected to be unreproducible: consent was already given, so after the reset there
  is no dialog. Pos 11's reason is NO EVIDENCE. Hypothesis: its target carried the chip's text,
  which changed from Carden Falls to Millbrook after `pick-millbrook`.
- Provider calls during replay: none; the dry runs are `core.run_node` only.

## Stage 5 — the answer

Not reached. No Flow run, so no mini-cart facts were read. NO EVIDENCE of what the cart held at
the end: `snapshots/` has no page state, and `flow-lane.json` has `actions: []`.

## Stage 6 — judgement and repair

Not reached. No Flow, verification, repair or persistence.

## Causes

| # | Cause, precisely | Repo and file | Fix | Task id |
| --- | --- | --- | --- | --- |
| 1 | Exploration never got past act 1. `pick-millbrook` reloads the page, the step is never kept (not proposed at either dry run), and the model reopens the chip and repicks 3× / opens 6×, spending 37 decisions without a search. After Millbrook is current its card has no button, so a repeat "Set as my store" press hits another store. | Core `runtime/llm/evidence-loop.ts` (draft record of a click whose page reloaded) and the domain's click post-condition (`effectApplied` across a navigation) | Make a click that caused a document reload report `effectApplied: true` with the new URL/state, so the step is proposable. Show the model the store chip's new text after the reload (a post-action observation), so "did it take" is answered without reopening the picker. | new |
| 2 | Refusal 1a: a Core-assembled (draft) plan measures the model's `summary` against the one-reply `maxSummaryLength: 240` without the truncation the reply path applies (by elimination; the exact limit is not in the bundle). | Core `runtime/llm/harness-options/bootstrap-completion.ts:348` (`fromDraft`) | Bound the summary in `fromDraft` exactly as `authoring/accept.ts:84-87` does, or skip `maxSummaryLength` when `source === "draft"` in `plan/profile-limits.ts:54`. | new |
| 3 | Refusal 1b: a build told a start location but begun already on it has no arrival step, so `start-step.ts` has nothing to restore and completion is refused. | Core `runtime/flow-bootstrap/reachability/start-step.ts:68-70` (or the Lab, which opened the page before the build) | When the build began on the start location, write the navigate-to-`startLocation` step as the draft's first step (it is known without running). Alternatively the Lab starts a build on `about:blank`. | new |
| 4 | Refusal 2 is correct: the draft has no add-to-cart step. But completion #1 passed the same check with a consent click and a chip click, because leftover claims are assigned in order and only "kept + mutating" is verified. | Core `runtime/flow-bootstrap/instructed-acts/check.ts:130-138` | Drop the in-order fallback (`take(act, () => true)`), so a claim must name its act by id, verb or kind word. Whether a click only opened UI cannot be decided in Core, so naming the act is the enforceable minimum. The run's own verification remains the backstop. | new |
| 5 | The act extractor reads one `add` act for "add two packs of X … and one pack of Y", so a Flow adding only X passes. Both acts' quotes are the same 200-character clip. | Core `runtime/flow-bootstrap/instructed-acts/instruction-acts.ts` | Split coordinated objects of one verb ("add A … and B") into one act per object, and quote each act's own clause. | new |
| 6 | 11 of 37 decisions (30%) were requests answered from memory, 4 and 7 in a row, without the no-progress guard ending or redirecting them usefully. | Core `runtime/llm/evidence-loop.ts:704-717` | Count a repeated answered-from-memory request towards the no-progress redirect sooner, and make the answer say what changed since (nothing), so the model stops re-asking. | new |
| 7 | The build's end was filed `flow_bootstrap.pre_provider_validation_failed` with 0 calls after 37 decisions. The throw is unknown. | Core `api/handlers/llm-generation.ts` + `generation-failure/*` | Being fixed separately (per brief). Candidates listed in the report. | t174 (separate) |

## Instrumentation gaps found

| Stage | What could not be answered | File that drops it |
| --- | --- | --- |
| 2 | Which of `already_answered` / `already_observed` / `not_offered` each of the 11 silent tool_calls got, and for which tool | Core `runtime/llm/evidence-loop/progress-trace.ts` (wraps `executeTool` only; `answerRequest` in `evidence-loop.ts:411` is not traced) |
| 2 | `effectApplied` of each executed action (why `pick-millbrook` was never proposed) | `progress-trace.ts:43` logs `resultCode` only |
| 2 | What each of the 9 `amend_draft` decisions changed | `progress-trace.ts` logs only `kind` |
| 3 | Which limit `completion_profile_limit_exceeded` named; which act `instructed_act_missing` named, and its reason | `progress-trace.ts:52-54` prints issue codes only. The `limitsExceeded[].limit` and `missingActs[].id/reason` are code-shaped and safe to print. |
| 3 | The draft steps' target parameters (why pos 11 was unreproducible) | a failed build stores no draft; the Lab deletes the Core store with the run |
| 1 | Provider calls, tokens and cost of a build that made 37 decisions | the throw path returns `accounting: null` (`flow-lane.json` `build.accounting`) |
| 2 | The identity of the throw after `pick-millbrook-3` | `progress-trace.ts` wraps `decide` and `executeTool` but not the loop body between them |
| header | The Lab command line | `run.json` |
