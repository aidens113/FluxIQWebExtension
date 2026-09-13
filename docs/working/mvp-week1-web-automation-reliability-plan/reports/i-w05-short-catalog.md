# i-w05-short-catalog: how W05 `short-catalog` should be judged on the Flow lane (read-only)

Worker report, 2026-09-13. Brief: `briefs/finish-week1.md`, "i-w05-short-catalog", Thirty-third
dispatch. Read-only: no Lab command, build or test suite ran, and nothing was edited except this
file. Every line number below is at the working tree as read today.

## Outcome

**Done, from code only.** Nothing here has been observed in the Lab.

- **What happens today.** The Flow built from W05's recording is two Next clicks, with a wait
  before the second. On `short-catalog` its first click finds no Next and fails as
  `target_not_found`. The final state still holds, because the page never changed. The runner
  then fails the run, because the variant expects success.
- **Recommendation: (d), not (a).** Keep the variant as a positive row, and rule it out of
  Week 1 as a named product gap, the way W13 `banner-absent` and W24 `unannounced` already are.
  The row stays in the corpus and keeps failing where everyone can see it.
  - **Why not (a).** Declaring the failure would score a well-classified hit for a Flow that
    cannot do what the variant describes. It would also remove the only week1 result that
    exposes the gap.
- **The brief's premise for (b) is wrong.** Core already has a loop node and a branch node, and
  its graph walker can revisit a node. What is missing is on the web side:
  - a web output that answers "is Next present?" as a true or false value;
  - a recording mapper that emits a loop instead of fixed clicks.
  - Even with both, the Flow would still extract nothing.
- **The real fix already half exists.** The domain's `web.dom.extract_list` output, with
  `paginate`, runs end to end and stops cleanly when Next is absent. Nothing can produce that
  node from a recording.

## What changed and why

Only this report was written. The findings follow.

### 1. From code: what a Flow built from W05's recording does on `short-catalog`

**The recording is made unarmed**
- W05's workflow has one paginated extract step
  (`apps/scenario-lab/src/scenarios/product-catalog/manifest.ts:16,53-65`).
- The runner reads each page, clicks Next as trusted input, and stops when Next is absent
  (`packages/test-runner/src/scenario-steps/extract-records.ts:64-71`).
- On the 23-product catalog that is two Next clicks. The recording-lane assertions use the
  unarmed workflow (`packages/test-runner/src/run-scenario.ts:291-303`).
- A recording holds no extraction: the runner's `extract` is its own check, not a user action
  (`packages/test-contracts/src/recordable-actions.ts:22-26,55`).

**The Flow Core proposes**
- **Click 1:** Next on page 1.
- **A wait:** `web.dom.wait_for_selector` (present) before click 2.
  - The domain proposes a wait before a CSS-selector click whose target a recorded DOM addition
    produced, in the same document (`domain/src/recording/proposals/late-target-wait.ts:52-91`).
  - The results region is replaced after click 1 (`product-catalog/client-script.ts:37`).
  - So a wait is expected before click 2. None is expected before click 1: nothing is added to
    the page before it, unless something outside the fixture adds nodes (see Not verified).
- **Click 2:** Next on page 2.
- **No extract node.** `flowExtractionExpectation` therefore returns `not_applicable`, so the
  variant's 5 records are never judged on this lane
  (`packages/test-runner/src/flow-lane/expectations.ts:54-75`,
  `flow-lane/run-flow-lane.ts:142`).

**The armed page**
- The variant is armed and the start page reopened before the Flow runs
  (`run-scenario.ts:339,345`).
- The armed page facts are checked at that point (`run-scenario.ts:350`). The variant's
  `resultCount("5 products")` should hold.
- The catalog has 5 products, so there is 1 page (`product-catalog/listing.ts:15-17,37`).
- Next is absent, not disabled, on the last page (`product-catalog/markup.ts:73-80`).

**Which node fails, and with what category (predicted)**
- **The failing node:** the first `web.dom.click`, the one recorded on page 1's Next.
- **How it fails:**
  - The content script resolves the target once, synchronously
    (`apps/extension/src/content/actions/click.ts:30`).
  - `resolve-target.ts` has no polling, timeout or wait (a search for
    `timeoutMs|poll|waitFor|deadline|setTimeout` finds nothing).
  - A miss throws `TargetResolutionError` with `web.target.not_found`
    (`content/action-runtime/resolve-target.ts:493-505`).
  - The domain maps that code to category `target_not_found`, retryable, at stage
    `target_resolution` (`domain/src/runtime/failure/codes.ts:29,125`).
  - Core supplies no runtime candidates, so resolution is left to the adapter
    (Core `runtime/io-policy.ts:237-238`).
- **Timing:** the answer comes back at once, well inside Core's 5,000 ms dispatch deadline. That
  is unlike W25 `too-slow` (`reports/i-w25-timeout-code.md:16`).
- **After the failure:** there is no failure edge, so Core's executor stops the run. A
  deterministic recovery path is the only way to continue
  (Core `runtime/executor/graph-run.ts:204-224`). A provider-free retry of a retryable failure
  was not traced; the category would not change either way.

**How the runner then judges the run**
- **The oracle holds.** It checks the variant's final state: `Page 1 of 1`, and Next absent
  (`manifest.ts:73`; `run-scenario.ts:362-365`). Both are true on the untouched armed page, so
  `oracleVerdict` is `passed` (`run-flow-lane.ts:148-151`).
- **The expected failure is `null`.** The resolved variant has no `failure`, because it is
  merged over the workflow's expectations and neither declares one
  (`packages/test-contracts/src/scenario-workflow.ts:91`; `run-flow-lane.ts:153`).
- **The run fails.** `assertFlowFailure(undefined, failure)` throws `runtime.behavior`, "The
  Flow reported an unexpected target_not_found failure"
  (`expectations.ts:38-41`, called at `run-flow-lane.ts:156`).
- **How the bench scores it.** It is a positive run (`bench/aggregate-report.ts:47`), so:

| Metric | Result |
| --- | --- |
| `initialExecutionSuccess` (first run) | miss |
| `deterministicReplaySuccess` (runs 2 and 3) | miss |
| `fuzzyRecovery` | miss |
| `falseFailure` | **hit**, because the oracle passed and FluxIQ reported failure |
| `failureClassificationAccuracy` | not counted: it is not a negative run |

Rows: `aggregate-report.ts:96-111,116-125`.

**Two points worth stating plainly**
- **The final state proves nothing here.** The variant's final state is met by doing nothing,
  so on this lane it cannot tell "read 5 and stopped" from "never ran".
- **The unarmed W05 Flow does not extract either.** It can pass on two clicks and page 3 of 3.
  That result is published as `extractionExpectation: not_applicable` in
  `snapshots/flow-lane.json` (`run-flow-lane.ts:155`), so it is disclosed. But
  `short-catalog` is the only W05 result where the gap changes the verdict.

### 2. The options

**Criterion 1** is "week1 W01-W19 through the bench, 3 of 3". **Criterion 4** is that a negative
variant reports its expected category, at least 90% of the time.

**(a) The variant declares the expected failure on the Flow lane**
- **The change:**
  - add `failure: { category: "target_not_found", code: "web.target.not_found" }` and
    `actions: [{ action: "web.dom.click", outcome: "failed" }]` at `manifest.ts:70-74`;
  - drop `extracted` (`manifest.ts:72`), which no lane that runs this variant judges;
  - rewrite the description (`manifest.ts:68`).
  - The expected-action guard accepts `web.dom.click` for a paginated extract
    (`recordable-actions.ts:63-68`). The precedent is `identity-drift/manifest.ts:44` and
    `failure-surfaces/manifest.ts:97`.
- **Criterion 1:** the run would pass 3 of 3 and leave the positive population.
- **Criterion 4:** it joins the negative population, and is predicted to add 3 hits.
  - This rests on no wait preceding click 1. If one does, the failing node is a wait, the
    category is `timeout`, and it is 3 misses.
- **Honest? No.**
  - The variant exists to ask whether a pagination workflow copes with a catalog that ends early.
    Under (a) it would ask instead whether a missing recorded target is classified. W27
    `detached`, W29 and identity-drift already cover that.
  - One could argue that failing is right for a Flow that literally clicks Next twice: decision
    D4 forbids silently skipping a step. But FluxIQ built that Flow from a workflow whose intent
    is "extract every page". Scoring the failure as a correct classification turns the product
    gap into a criterion-4 hit. That is exactly "a row passes by hiding a product gap".

**(b) The Flow follows pagination as a loop**
- **What Core already has:**
  - `builtin.control.loop`, with `body` and `done` routes chosen from a boolean `condition`
    input (Core `nodes/control-flow/loop.ts:4-22`, `control-flow/shared.ts:4-6`);
  - `builtin.control.branch`;
  - a graph walker that follows edges one step at a time, capped at 250 steps, so a back edge
    re-runs a node (Core `runtime/executor/graph-run.ts:163-164,231-257,268`).
- **What is missing, none of it a Core node:**
  1. **A web output that yields a boolean** such as "the Next control is present", to feed the
     loop's `condition`. None of the domain's outputs does (`domain/src/actions/types.ts:17-34`).
     `wait_for_selector` fails rather than answering false. I did not check `web.dom.assert`'s
     routes.
  2. **A recording-proposal mapper** that collapses repeated clicks on one pagination control
     into loop, then presence check, then click, instead of N fixed clicks. No domain proposal
     does this. No Core source outside `loop.ts` references `builtin.control.loop`, so no
     proposal or template ever emits one.
  3. **Loop bounds.** The loop's `maxIterations` parameter is emitted as an output
     (`loop.ts:21`), and I found no runtime code that enforces it. Only the 250-step cap bounds
     a loop. Not verified by test.
- **Even then, the Flow extracts nothing,** so the variant's defining claim, 5 records, stays
  unjudged.
- **Criterion 1:** it could pass once items 1 and 2 exist. That is new domain work, not Week 1.
- **Criterion 4:** unaffected.
- **Honest:** yes, but incomplete, and too large for Week 1.

**(c) The variant runs on the recording lane only**
- **The change is a new mechanism.** Only the Flow lane arms variants
  (`bench/expand-corpus.ts:4-5,19`; the arm happens only in `prepareFlowPage`,
  `run-scenario.ts:339`). It needs:
  - a per-variant lane field in the contract (`test-contracts/src/scenario.ts`: type, validator
    and JSON Schema);
  - `lanesForResult` changed (`expand-corpus.ts:19`);
  - arming before recording in `run-scenario.ts`.
- **Criterion 1:** the runner verdict would pass (5 records, page 1 of 1), but FluxIQ executes
  nothing on that lane.
  - W05 has no CSS `type` step, so the Core probe is skipped
    (`reports/g-runner-harness-fixes.md:43-58`).
  - `reportedVerdict` is therefore `null`, which counts as a miss in every execution rate
    (`aggregate-report.ts:66,80,96-107`).
- **Criterion 4:** unaffected.
- **Honest? No.** The Flow-lane result, the only one that shows the gap, disappears from the
  bench, and the replacement measures Playwright and the fixture, not FluxIQ.

**(d) Better: keep it positive and rule it out of Week 1 as a named product gap**
- **The change:** no manifest or corpus code. The variant stays as written
  (`manifest.ts:66-75`), and the W05 row is unchanged (`week1.ts:34`).
- **In the plan:** the supervisor adds W05 `short-catalog` to Current State's "Ruled out of
  Week 1" list (`mvp-week1-web-automation-reliability-plan.md:82-88`), with this reason: "a
  Flow built from a recording cannot extract, or follow pagination; a recording carries no
  extraction, and no mapper builds `web.dom.extract_list` from repeated clicks on a pagination
  control; the row stays in the corpus".
- **The precedent:** the same list already holds W13 `banner-absent` (P7) and W24 `unannounced`,
  and W13 sits inside W01-W19.
- **Before ruling it out,** observe the prediction once in the Lab. The `l-stage2c` run 5 bench
  includes this result. Quote the failing node's output id and the category from
  `snapshots/flow-lane.json`, so the ruling rests on an observation rather than on this report.
- **Week 2 entry point:** a real fix is small on the execution side.
  - `web.dom.extract_list` with `paginate: { next, maxPages }` is validated by the domain
    (`domain/src/client/gateway-action-parameters.ts:176-203`, `domain/src/actions/types.ts:151-152`).
  - The content script follows Next and ends cleanly when it is absent
    (`apps/extension/src/content/action-runtime/list-extraction.ts:108-112`).
  - One such node would pass unarmed (23 records) and `short-catalog` (5), and would let
    `assertFlowExtraction` judge both (`expectations.ts:88-96`).
  - What is missing is a way for a recording to carry an extraction: a recorder capture, or a
    mapper from the paginated clicks, which would need the item selector and fields.
- **Criterion 1:** excluded by the ruling, the same way W13 `banner-absent` is. If criterion 1
  counts unarmed results only, this variant never affected it (see Open question 1).
- **Criterion 4:** unaffected. The result stays out of the negative population, so it inflates
  nothing.
- **Honest:** yes. The run keeps failing where everyone can see it, as a `falseFailure` hit and
  a `fuzzyRecovery` miss, and the reason is recorded.

### 3. Recommendation

**(d).**
- **Code:** none. `manifest.ts:66-75` and `week1.ts:34` stay as they are.
- **Plan (supervisor):** one entry under "Ruled out of Week 1", at
  `mvp-week1-web-automation-reliability-plan.md:82-88`, worded as in (d), plus a Week 2 entry
  point for `web.dom.extract_list` from a recording.
- **First:** quote the Lab's observed failing node and category for this result.
- **Honest:** yes. (a) and (c) each make the Week 1 numbers look better by moving the one result
  that shows the gap out of the population where it counts against FluxIQ.

## Commands run and observed results

- **No shell command ran.** Everything came from the Read, Grep and Glob tools.
- **In this repository, read in full or in part:**
  - the brief's section and binding rules, plus `wave-3.md:30-64`;
  - the plan's Current State;
  - `product-catalog/manifest.ts`, `listing.ts`, `client-script.ts`, `scenario.ts`, and `markup.ts:73-81`;
  - `extract-records.ts`, `week1.ts`, `bench-corpus.ts`, `expand-corpus.ts`, and `aggregate-report.ts:40-149`;
  - `flow-lane/expectations.ts`, `run-flow-lane.ts:60-179`, and `run-scenario.ts:270-381`;
  - `late-target-wait.ts`, `list-extraction.ts:1-130`, `resolve-target.ts:470-510`, and `gateway-action-parameters.ts:165-209`;
  - `reports/g-runner-harness-fixes.md`, and `reports/i-w25-timeout-code.md:225-319`.
- **In FluxIQ Core, read only:**
  - `nodes/control-flow/loop.ts` and `shared.ts`;
  - `runtime/executor/graph-run.ts:160-270`.
- **Searches and what they returned:**
  - `failure:` across the scenario manifests, for precedent;
  - `resolveScenarioWorkflow`, for how a variant's expectations merge;
  - `recordable-actions.ts`;
  - the domain's output ids;
  - Core for `control.loop` and `control.branch` outside tests: only their own definitions;
  - Core runtime for `maxIterations`: only LLM evidence-loop hits;
  - Core `no_candidates`: `io-policy.ts:237-238`;
  - `resolve-target.ts` for `timeoutMs|poll|waitFor|deadline|setTimeout`: no match;
  - `reports/l-stage2c.md` for `W05|short-catalog`: no match, so no Lab observation exists yet.

## Not verified

- **Nothing was observed.** The failing node and category are predictions from code. A Lab run
  must show, for W05 `short-catalog` on the Flow lane:
  - `flowCreated=true`;
  - the first attempt is `web.dom.click` with status `failed`;
  - the run's failure category is `target_not_found`, with code `web.target.not_found`;
  - `oracleVerdict` is `passed`, and `extractionExpectation` is `not_applicable`;
  - the runner fails with "unexpected target_not_found failure".
- **Whether a wait precedes click 1.** It would, if anything recorded a DOM addition before the
  first Next click: extension UI, or any node the page adds after load. The failing node would
  then be `web.dom.wait_for_selector`, the category `timeout`, and, until Core's dispatch-deadline
  fix lands, Core's own timeout code. Only the approved Flow in the Lab bundle settles this.
- **The resolver's fallback strategies.** I did not trace whether text, label or role could put
  a candidate such as the "1" page button forward. Corroboration should refuse it, per Current
  State, but that was not traced for this page.
- **Whether Core retries** a retryable `web.target.not_found` provider-free before stopping.
- **That `web.dom.extract_list` with `paginate` works live** against product-catalog. Its
  harness or unit coverage was not read.
- **That the loop's `maxIterations` is unenforced.** This rests on a search finding no runtime
  reader, not on a test.
- **The unarmed W05 Flow's wait-then-click sequence** is inferred from the mapper's rule, not
  from an approved Flow.

## Open questions or contradictions found

1. **Criterion 1's population.** The brief quotes "week1 W01-W19 through the bench, 3 of 3",
   which does not say whether variants in rows W01-W19 count. I was not given the plan's
   Objective. If they count, W13 `banner-absent` already sets the precedent that a ruled-out
   variant is excluded. If they do not, `short-catalog` never affected criterion 1, and the
   choice matters only for honesty and for criterion 4.
2. **The brief's premise for (b) is wrong.** Core has `builtin.control.loop` and
   `builtin.control.branch`, and its executor walks back edges. The missing pieces are a web
   output that yields a boolean presence value, and a proposal mapper. Separately, the loop's
   own `maxIterations` appears not to be enforced (Core `loop.ts:21`), which is worth a Core
   note if loops are ever proposed.
3. **The H1 report already predicted this outcome** and called it "a product gap like P7, not a
   harness defect" (`reports/g-runner-harness-fixes.md:228-229`). That agrees with (d), but it
   was never recorded as a ruling in the plan.
4. **Possibly the same gap, hidden, in W11 `end-early` (not traced).** It is a positive variant
   whose 25 records are also `not_applicable` on the Flow lane. A replayed scroll has no target
   to lose, so that Flow can pass without extracting anything. Worth one line in the same ruling.
