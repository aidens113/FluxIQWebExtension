# Language-Driven Flow Loop

Status: Active
Status detail: Rung 1, `everything-store-plus-earbuds-under-50`, has run four times and not passed. Run 4 builds a seven-node Flow that searches and gets 3 of 13 rows right in 437 s. The wrong-answer repair was found never to have run at all and is now reachable for the first time.
Created: 2026-09-24
Last updated: 2026-09-25
Owner: Senior supervisor agent
Scope: Reaching the MVP goal — a person's instruction becomes a Flow, that Flow runs deterministically, repairs itself when it breaks, and judges its own answer — by running one complex, multi-node live scenario at a time, debugging that single run end to end, fixing every cause it exposes, and running again. It deliberately does not cover corpus-wide campaigns, pass-count measurement, single-node extraction tasks, recorded Flows, or any surface that does not block this loop.
Paired document: `none yet — Core-side changes land under FluxIQ Core's own working documents as this loop names them.`
Related: [flow-authoring-and-defensive-runtime-plan.md](./flow-authoring-and-defensive-runtime-plan.md) (the design backlog this loop draws fixes from), [first-class-data-extraction-plan.md](./first-class-data-extraction-plan.md), [MVP agent instructions](../../MVP_AGENT_INSTRUCTIONS.md)

---

## Current State

**The instruction that opened this document, 2026-09-24, and it is binding.**
Live tests only. A full debug of every live run. Complex scenarios only. Full
node runs, not single-node extraction. One run, one debug, fix those errors,
continue — repeated until language-driven Flows run successfully, repair
themselves, and measure their own progress.

**Only the ten realistic scenarios**, restated by the user 2026-09-25:
`everything-store`, `crossborder-marketplace`, `bigbox-retail`, `job-board`,
`local-classifieds`, `auction-marketplace`, `photo-social`,
`social-network-feed`, `company-website`, `professional-network`. The Lab
fixtures are not rungs and the one pass recorded against the old rung 1
(`product-catalog`) is not evidence about the product's target.

**The largest finding of the loop so far: the wrong-answer repair had never
run.** Five live runs each recorded an empty `runtimePatchAttempts`, and that
was twice attributed to the repair's patch vocabulary being unable to express
the fix. It was not. The route was gated on the grant purpose being the literal
`explore_and_adapt`, and a Flow built from an instruction runs under
`build_and_adapt`, so every run of this loop was refused at the gate and
stopped. Detail and the general lesson are in
`Where The Three Capabilities Actually Stand`, item 0. Fixed in Core `85e0d38`.

**Where rung 1 actually is.** `everything-store-plus-earbuds-under-50` has run
four times and has not passed. It is not left until it passes twice in a row.
The chain has moved a long way in those four runs:

| | Run 1 | Run 2 | Run 3 | Run 4 |
| --- | --- | --- | --- | --- |
| Flow built | no | yes | yes | yes |
| Nodes | — | 5 | 3 | **7, with a search** |
| Observed records | — | 0 | 15 | 8 |
| Matched in order | — | 0 | 0 | **3** |
| Wall clock | 695 s | 839 s | 950 s | **437 s** |

Run 4 (`run-muhnh0s5-98a27f42`) builds `navigate, click ×4, type, click ×3,
extract_list` — it dismisses the fixture's interruptions and **types a search**,
which no earlier run managed. Three of thirteen expected rows come back in the
right position. The remaining answer defect is the qualifying clauses: the
instruction's filters and its "every page" clause reach the model and not
always the node.

**What is proven working, live, that the document previously recorded as
broken.** Self-judgement on a multi-node Flow: three consecutive runs stored
plausible, well-formed tables and all three were refuted rather than reported
as answers (`core.result.does_not_answer_request`). The runtime recovery ladder
also fires and recovers real faults — run 4 recovered three
`web.target.not_found` failures, one of them on a page reading "Checking your
browser…".

**The next action** is the run now in flight, which is **the first in the
project's history in which a wrong answer can reach the repair**. After it:
t127's 11.04 s wait, and whatever that run's debug names.

**Blockers:** none. Two environment notes: `git worktree add` fails on this
machine with `cannot spawn git: Exec format error` from any shell, so a
Core-paired task takes a plain branch in each repository; and a Core build that
exits `3221225477` is this machine's RAM fault, not the code — it builds on
retry.
---

## The Loop

This is the operating procedure. It is not a phase to be completed; it is how
every unit of work in this document is done, and it repeats until the exit
criteria in `The MVP Exit Criteria` all hold.

1. **Pick one complex scenario.** One, not a lane. It must meet the gate in
   `What Counts As A Complex Scenario`. Prefer the scenario that last failed
   earliest in the chain — the furthest-back failure is the one blocking
   everything behind it.
2. **Run it once, live, against the real provider.** State the scenario, the
   command and the expected cost before launching. One live run may be in
   flight at a time.
3. **Debug that run completely**, by the protocol in `The Full Debug Protocol`.
   Every stage of the chain gets an answer. A stage that cannot be answered from
   the artifacts is itself a finding and goes to Phase 0.
4. **Name every cause the debug found**, at the level of the value, the node,
   the selector, the parameter or the missing step. Not "extraction was wrong" —
   "the `address` column read the listing's `href` because the field mapping
   selected the anchor rather than its text".
5. **Fix all of them.** Causes in disjoint files go to parallel workers; the
   supervisor keeps integration and verification. A cause that belongs to the
   framework is fixed in FluxIQ Core, never approximated here.
6. **Run the same scenario again** and confirm each named cause is gone. Then
   either continue on the same scenario, because it now fails later in the
   chain, or move to the next when it passes.

**Rules that hold for every iteration.**

- **No run is left undiagnosed.** A run that is recorded as failed and rolled
  into a count has been wasted. There is no score in this document.
- **No batching.** Not two runs to compare, not a lane to see the spread. One
  run, one debug.
- **Report the cause and the distance every time.** Why it failed, named
  precisely, and how far along the chain it actually got. "It didn't get the
  right answer" is a restatement of the verdict, not a finding.
- **The fix is in the product, not the test.** Adjusting a scenario, an oracle
  or an expectation to make a run pass is not a fix. If the oracle is genuinely
  wrong, that is its own cause and is recorded as one.

---

## What Counts As A Complex Scenario

A task qualifies only if the **minimum correct Flow has several real nodes that
do different things**. The test is what the correct answer requires, not what
the model happens to emit.

**Required, all three:**

- **It navigates or acts before it can read.** The data is not on the page the
  run starts on. Reaching it requires at least one of: a search, a filter, a
  click into a detail page, a form submission, a login, a tab or menu change, or
  pagination that is genuinely traversed.
- **It has at least three nodes of at least two kinds.** A Flow of three
  extractions is not complex; a Flow of navigate, act, extract is.
- **It has a wrong answer that looks right.** The scenario must be able to
  distinguish a Flow that did the work from one that read whatever was in front
  of it — an unfiltered list that has the right shape and the wrong rows, a
  first page that looks like the whole set.

**Preferred, and at least one should be present as the loop matures:**

- A branch — something that is sometimes there and must be handled when it is.
- A repeat — a loop over rows, pages or items.
- A consequential act the person's instruction authorises, so the permission and
  escalation path is exercised rather than assumed.

**Explicitly excluded, and not run as measurement:** any task whose correct
answer is one `web.dom.extract_list` on the starting page, however hard that
page is to parse. Those are solved, they are not the MVP goal, and running them
produces a number that flatters the product.

---

## The Full Debug Protocol

A full debug walks the whole chain from the person's instruction to the final
answer and gives every stage an answer. It is done once per run, written down
once per run, and it is the only thing that licenses a fix.

Each stage below asks: **what was supposed to happen, what actually happened,
and where is the evidence.** A stage whose evidence does not exist is a Phase 0
finding — record it as a gap and fix the instrumentation, because an
unanswerable stage means the next run cannot be debugged either.

**Stage 1 — the instruction.** What was the person's instruction, exactly? What
would a correct Flow have to do to satisfy it? Write that chain down *before*
looking at what the run did, so the expected chain is not reverse-engineered
from the actual one.

**Stage 2 — exploration.** Every model turn in order: what was it asked, what
did it decide, which action did it call, with which parameters, and what did the
action return. Where did it repeat itself, and why did it think repeating was
progress? Which refusals or rejections did it receive, and did the rejection
tell it enough to route around the problem?

**Stage 3 — the proposed Flow.** The node list as authored, with each node's
real parameters — not a summary. Does the chain match the one written down in
stage 1? For every divergence: which node is wrong, and was it wrong because the
model misunderstood the page, misunderstood the grammar, or could not express
what it meant?

**Stage 4 — replay.** Node by node: did it execute, what did it produce, how
long did it take, did it retry, and if it retried, which rung of the recovery
ladder absorbed it. A node that did nothing and reported success is a finding.

**Stage 5 — the answer.** Field by field against the expected dataset: how many
records, which fields matched, and for every mismatch the observed value beside
the expected one. A pass on record count alone, with no field compared, is not a
pass and is recorded as a gap.

**Stage 6 — judgement and repair.** Did the system judge its own result? If the
answer was wrong, did a repair trigger automatically? Was that repair given what
it needs — the steps that ran with their parameters and results, the
conversation, the page as it was when it broke, the Flow with the failing node
in place, and the failure's own record? Did the repair persist, and did the
re-run use it?

**The write-up.** Every run gets its own debug file, copied from
[run-debug-template.md](./language-driven-flow-loop-plan/run-debug-template.md)
to `language-driven-flow-loop-plan/debugs/<run-id>.md`, with every field filled.
A field that cannot be filled is written as `NO EVIDENCE:` and becomes a Phase 0
finding. The ledger then carries one short entry per run — the run id, the stage
it reached, the causes found, and the fix each received — and points at the debug
file for the detail.

---

## The MVP Exit Criteria

The loop ends when all four hold **on complex scenarios**, each demonstrated by
a live run whose full debug is written down.

1. **Created from language.** A person's instruction, with no recording and no
   hand-authoring, produces a Flow whose node chain is the one the instruction
   requires — navigation, action and extraction in the right order, with real
   parameters.
2. **Runs deterministically.** That persisted Flow replays and produces the
   correct answer with zero provider calls, and does so repeatedly rather than
   once.
3. **Repairs itself.** When a replay breaks, the repair is attempted
   automatically with full context, the repaired Flow is persisted, and the
   re-run succeeds — without a person being asked anything except where a
   consequential act genuinely requires their permission.
4. **Measures its own progress.** A run that technically succeeded is judged
   against what the person actually asked for, and a wrong answer triggers a
   repair rather than being reported as a success.

Each criterion is claimed only from an observed live run, never from
compilation, a unit test, or a worker's report.

---

## Where The Three Capabilities Actually Stand

Audited 2026-09-24 against Core `dev` (a055c92) and this repository's `dev`
(0d27f35); full detail in
[reports/mvp-capability-status.md](./language-driven-flow-loop-plan/reports/mvp-capability-status.md).

**The good news, and it is real: none of the three is a stub.** Deterministic
replay, automatic repair and self-judgement all exist and are all wired into
`service.ts#runRuntimeSession`. Repair has two doors — a failed step, and a
refuted result via `recovery/refuted-result/repair.ts:82` — and a result is
judged wrong by `result-verification/verify.ts:95`, with
`result-check-schedule/decide.ts:39` deciding whether a run is checked at all.
The loop is not missing; it is defective in four specific ways.

**0. The whole wrong-answer repair was unreachable, and that outranks the four
below.** Found 2026-09-25 from `run-muhnh0s5-98a27f42`, after five live runs had
each recorded `runtimePatchAttempts: []`, `adaptationIds: []` and
`changeProposalIds: []` and the supervisor had twice attributed that to defect 1.
It was not defect 1. A Flow built from an instruction runs under the create-flow
entry point, whose grant purpose is **`build_and_adapt`**, and
`recovery/refuted-result/reauthor.ts` gated the route on the purpose being the
single literal `explore_and_adapt`:

    if (input.grantPurpose !== EXPLORING_GRANT_PURPOSE) return { route: false, refusal: "grant_does_not_buy_exploration" };

So every live run of this document's loop reached that gate, was refused, and
stopped. **No wrong answer has ever been repaired, and none of the four defects
below has ever been reached on a wrong answer.** The port was registered in
`service.ts:2601`, the reauthor path was written, the re-run after repair
existed — all of it dead behind one string comparison.

Fixed in Core `85e0d38`: the gate asks whether the grant the run already holds
buys exploring, which `build_and_adapt` answers more plainly than
`explore_and_adapt` does, since it is the purpose the build loop itself runs
under. Written as a set so a purpose added to the contract is a decision rather
than a silent no. 418 recovery tests pass.

**The lesson is larger than the bug.** A capability can be wired end to end,
tested at every unit, and unreachable in production behind one gate, and the
only thing that showed it was reading the live run's own record and following
the gate backwards. An empty `runtimePatchAttempts` was read twice as "the
repair tried and could not express the fix" when it meant "the repair never
started". **Before attributing a capability's silence to a known defect, prove
the capability was entered.** The plan's own audit had declared this door open
on 2026-09-24 by reading the source, and the source was there; what nobody
checked was whether anything could get through it.

**1. The repair cannot express the fixes our failures need.** Verified
directly: the vocabulary is exactly five patch kinds
(`llm/harness/structured-response.ts:155`), every one of them `temporary_` —
an action sequence, a wait/retry, a target override, a recovery subflow call,
and a reroute. **None can amend an extraction's field mapping, change a filter
parameter, or insert a step.** Those are precisely the causes behind the
wrong-answer failures on record. The self-repair criterion cannot be met on a
wrong answer until the vocabulary can express a durable edit to a node.

**2. A wrong-answer repair never re-runs inside its own run.**
`retryRuntimeSessionAfterAutoAppliedPatch` is called *before* verification, and
no graph run follows it, so the "verify, repair, retry, verify" circle the
code's own comments describe only ever closes across two separate runs.

**3. A Flow that stores nothing is never judged, and reports success.** Verified
at `result-verification/verify.ts:189`: `nothingToJudge` returns
`performed: false` when no record set was stored — and separately when a record
set exists but holds no rows, which is still waiting on a hang fixed elsewhere.
A multi-node Flow that navigates, clicks and stores nothing therefore
self-reports success, unjudged. This falsifies exit criterion 4 for exactly the
class of Flow this document targets.

**4. The repair sees a fresh page, not the broken one.** The page captured at
the instant of failure by `domain/src/runtime/adapter.ts` is never read by
Core; the repair is handed a fresh snapshot instead. This contradicts the
standing requirement that a repair be given the page as it was when it broke.

**What breaks first on a multi-node Flow.** A probable defect in
`executor/recovery-budget.ts:3`: `recoveryAttemptsForSubflow` counts retried
attempts where `failedAttemptsForAction` does not, so **one flaky node
exhausting its three retries disarms the authored `failed` route of every later
node.** Then `recovery/refuted-result/attempt.ts:133 resultProducingAttempt`,
which always blames the last record-storing node — on a six-node Flow the
blamed node is routinely not the broken one. Neither is measured; both are read
off source and are the first two things a multi-node run should be watched for.

These four are not fixed pre-emptively. They are what the loop's first
iterations will run into, and each is fixed when a run's debug names it — with
one exception, the 90-second replay bound, which is a harness defect that would
manufacture a false product failure and so belongs in Phase 0.

## What A Run Spends Its Time On

Measured 2026-09-25 from the per-row timestamps E4 added, which is the first
time this could be asked at all. The user's question was why a run of one
instruction took sixteen minutes; the answer was that almost none of it was the
product thinking.

`run-muher0en-508ddb69`, 949.6 s:

| Phase | Time |
| --- | --- |
| Setup — browser, extension, isolated FluxIQ | 67.5 s |
| Exploration — the actual work | 192 s |
| The Flow's four actions | 12.6 s |
| **Repair phase, waiting, producing nothing** | **568 s** |
| Tail | 60 s |

**The 568 s was a wait for something that was never coming.** Core records a
refuted result as a failure on the last record-storing attempt, so a Flow whose
every node executed as authored reads `failed` on that attempt. The Lab's
`recoveryCouldBeRunning` took that for a node fault and spent the full
five-minute `RECOVERY_RECORD_WAIT_MS` — on a recovery Core had already declined
to plan, because Core plans from the diagnosis of an attempt that *would not
run* and a refuted result hands it none. Fixed by `everyNodeRan`
(`packages/test-runner/src/flow-lane/node-recovery.ts`): a node that ran and was
then judged wrong is a node that ran. **Measured effect on the next run:
949.6 s → 437.2 s, with the repair phase at 81.5 s.**

**What is left, and it is now the largest cost.** Six exploration calls at
**11.04 s each, identical to the centisecond**, plus two decisions at ~15.5 s —
118 s of a 216 s build. Uniformity to that precision is a deadline being
exhausted, not provider latency and not page work, and it reproduces across
runs (`run-muher0en-508ddb69` shows the same 11.04 s eight times). The calls
return `web.inspect.succeeded`, so whatever is being waited for is not required
for the answer. `NAVIGATION_END_TIMEOUT_MS` in
`apps/extension/src/runtime/click-landing.ts` was checked and ruled out —
`landing()` returns early when no navigation starts. Open as t127.

**The rule this establishes.** A run's duration is evidence like any other and
is read from the timestamps, not estimated. Before concluding that the product
is slow, account for where the seconds went: on the two runs measured so far,
60% and then 19% of the wall clock was a harness wait, and the exploration
itself never exceeded four minutes.

---

## Phases

### Phase 0 — the instrumentation gate

**The loop cannot start until one run can be fully debugged.** The audit's
answer was no, and the supervisor verified its two headline claims directly:
the failed run `run-muf8dstp-0135804a` has no `flow-lane.json` at all where the
passing run has one, and all 32 of its decision rows carry exactly two fields,
`toolId` and `resultCode`, with `web.action.rejected.target_unobserved`
repeated **twenty indistinguishable times** inside a single undivided 99,375 ms
gap. Nothing records which handle was refused, why, what the parameters were, or
when. Of the six debug stages, only stage 1 and a shallow stage 2 can be
answered today.

**The structural problem is that the bundle is thinnest exactly where diagnosis
is needed**: the artifact that would explain a failed build is only written when
the build succeeded. Full detail and the remaining nine gaps are in
[reports/run-evidence-audit.md](./language-driven-flow-loop-plan/reports/run-evidence-audit.md).

This phase costs no provider calls and comes before the first live run.

| Id | Work | Repo |
| --- | --- | --- |
| E1 | **Write `flow-lane.json` for a failed build.** `flow-lane/creation/lane.ts:160-163` throws before the writer at `run-scenario.ts:389`, losing `authoredNodes`, `route`, `ownPage`, `extraction` and the evidence packets — the whole of stage 3 — on exactly the runs that need them. | L |
| E2 | **Half-landed, reopened as t125 on 2026-09-25.** The domain's 33 reasons exist and are correct; none of them reaches the bundle, because Core's `evidence-loop-decision.ts` gates a tool execution on an `exactKeys` list that names no reason field. `run-mug776kx-0214b287` therefore published fourteen identical `invalid_input` rows. **Carry the refusal's own reason through.** `domain/src/runtime/llm-evidence/tool-rejection.ts:128-176` already computes six closed reasons; the bundle flattens them to one word. Today `nothing_observed_yet`, `handle_not_in_packet` and `page_moved_since_packet` — three defects with three different fixes — are one indistinguishable code. Highest value per line changed. | D, L |
| E3 | **Stop discarding the per-row fields Core already keeps.** `evidence-trace.ts:42-61` retains `iteration`, `callId`, `evidenceBytes` and `usage` per row; they are dropped twice, at Core's `evidence-loop-steps.ts:40-46` and at `build-proposal.ts:314-319` (duplicated at `:329`). Extend `hasExactFields` at `generation-failure.ts:725` in lockstep or the widened record is rejected. | C, L |
| E4 | **Half-landed, reopened as t125 on 2026-09-25**: `at` is declared on the published step and parsed by it, and nothing in `evidence-loop.ts` ever emits one — 0 of 41 rows in the last run carry a timestamp. **A timestamp per decision row**, so 32 steps stop collapsing into one 99,375 ms gap and a stall can be located in time. | C, L |
| E5 | **A per-call ledger for builds.** `build-usage.ts:35-37` hard-codes `observedCalls: []` and `perCallRecords: "not recorded"`. Core's `run-call-record.ts` already does this for runs; a build is simply not a run. | C, L |
| E6 | **Stop hiding 21 of 22 tool calls.** `vocabulary()` at `build-proposal.ts:371-373` filters the whole `core.` prefix, which removes `core.run_node` — nearly every call the model made. | L |
| E7 | **Wire a screenshot adapter.** `run-scenario.ts:123` builds the capture controller without one, so every non-error capture is `capture-unavailable`; the policy allowed 100 and both specimens have zero. Stage 6 cannot show the page as it was when it broke. | L |
| E8 | **Publish `error.details` for `runtime.behavior`.** `run-scenario.ts:515` publishes them only for `recording.contract`, so the details of the failure class this loop actually hits are dropped. | L |
| E9 | **A local-only diagnostic sidecar** — see the decision below — holding the prompts, the replies and the page state at each step, written beside the run and never published or committed. | L |
| E11 | **Done.** The Lab's terminal-detail wait is now derived from the Flow's action-node count: `min(600_000, 90_000 + (n-1) × 91_250)` ms — unchanged at 90 s for one node, 546 s for six, capped at 600 s from seven up. Every term comes from Core's own published constants: 90 s is the existing load-proven fixed cost, 91,250 ms is Core's per-node worst case (a 30 s readiness cap awaited once per attempt × 3 attempts, plus the 250 ms and 1 s backoffs), and the cap is Core's maximum granted run. **The bite was worse than the entry assumed**: the wait's expiry rethrows the request's own HTTP timeout *as the run's result*, so a six-node Flow still executing at second 91 was recorded as a product failure, and deterministic replays reach that path on essentially every multi-node run because the client request bound is 30 s. Granted runs and caller aborts are deliberately unchanged. Proven against a virtual clock, never yet against a real multi-node Flow. | L |
| E12 | **Record resolved parameter values.** The values a node's parameters actually resolved to at execution time are recorded nowhere, so stage 3 cannot tell a node that was authored wrong from one that was authored right and resolved wrong. | C, D, L |
| E13 | **The upstream row rebuilder, found while E3 was landing.** `existing-fluxiq-control/adaptation-evidence-loop.ts:121-130` rebuilds every decision row as exactly `toolId` / `effectApplied` / `resultCode`, stripping the widened members before they reach the consumer E3 fixes. E3 is half-landed without it. Its doc comment states a deliberate policy — "nothing the tool returned and nothing the model wrote is admitted" — which stands; the Phase 0 decision draws the compatible line at identifiers, closed codes, counts, byte sizes and timestamps. | L |
| E14 | **Done 2026-09-25.** `loadTestEnvironment` now records which repository env file each name was read from, weakly keyed to the environment it describes so a provenance record can never be mistaken for a configuration value, and a name the operator set on the command line is never blamed on a file. Both refusals append the source and the escape: `isolated target cannot use existing-install configuration: FLUXIQ_TEST_BASE_URL, FLUXIQ_TEST_GATEWAY_URL. They were read from .env.local in the repository root, not from this command; run with FLUXIQ_TEST_ENV_FILES=none to ignore them for this run without editing the file.` Two regression tests; `dist/tests/target-config.test.js` reports 17 of 17 passing. **A refusal that names its own way out.** Three attempts were spent before the first live run reached the product, because this machine's `.env.local` configures an existing FluxIQ install and neither refusal said where the offending value came from or that `FLUXIQ_TEST_ENV_FILES=none` exists for exactly this case. The escape is documented only in a comment above the function implementing it. | L |
| E10 | **Already done before the phase opened, and the entry was wrong.** It was carried over verbatim from the retired plan's D0a without re-checking it against the current tree. Commit 84e44ce had already made a retried node attributable: `run-flow-lane.ts:452-480` emits `nodeId`, `attemptIndex`, `retry` and `hostTargetResolution`. Verified directly. Only the regression tests were missing, and they have been added. **The lesson is the entry, not the code**: an item inherited from an older document is a claim about a tree that has since moved, and every such item must be re-verified before it becomes work. This was the only inherited entry in Phase 0 — E1 to E9 and E12 came from audits run today against the current tree. | L |

**Decision: two tiers of evidence, taken by the supervisor 2026-09-24.** The
audit surfaced a real contradiction. `observed-usage.ts:1-4` states the bundle
carries "no prompt, no response, and no page data… so this can be published in
an evaluation" — publishability has been bought by making the bundle
undiagnosable, and stages 2 and 6 of the debug protocol ask for precisely the
three things it excludes. The resolution is not to relax the published bundle.
E1 to E8 are all closed codes, identifiers, numbers and timestamps, which buy
most of the diagnosis with no new redaction surface, and the published bundle
keeps its guarantee unchanged. E9 then adds a separate local-only sidecar for
the prompts, replies and page snapshots, written into the run directory, which
is already ignored and never committed. Nothing in the published artifact
changes; nothing secret leaves the machine.

### Phase 1 — the complex corpus already exists

**Nothing needs authoring to start.** The inventory classified all 134 live
tasks across 27 of 41 fixtures: 76 `navigate-and-extract`, 33 `form`, 19
`extract`, 6 `navigate`. Roughly 115 are multi-node. Full detail, including all
84 instruction texts verbatim, is in
[reports/scenario-inventory.md](./language-driven-flow-loop-plan/reports/scenario-inventory.md).

**The finding that reframes the last two days: the extract lane contains no
multi-node work at all.** All 19 of its tasks are exactly the catalog's 19
`kind: "extract"` rows, each judged by a dataset whose workflow's entire
declared chain is `extract → checkpoint`, and the campaign confirmed it — all 14
created Flows were `1 nodes: web.dom.extract_list ×1`. That campaign measured
one node authored nineteen times. **It could not have shown whether the model
can build a chain of two nodes, because it never asked for one.**

**Apply the gate by the required chain, not the declared kind.**
`web.dom.extract_list` carries `paginate` (next / loadMore / numbered / scroll)
and `where` (including numeric bounds) internally, so "scrape every product
across all pages" and "only those under 50" are still **one node**.
`product-catalog-all-pages` is declared `navigate-and-extract` and is
single-node. A task qualifies on the chain it actually requires.

**The corpus's own gaps**, to author later and not needed to start: no live task
uses `web.dom.upload` or `web.browser.download` at all, though `file-transfer`
supports both; `storefront-checkout` is a complete 24-step wizard with postcode
lookup, a payment iframe and a `declined-card` branch with zero live tasks; two
per-row drill-down loops are declared and untasked; and the only login's
`expired` variant is untasked.

### Phase 2 — the loop, climbing a ladder of complexity

No instruction-built multi-node Flow has ever been shown to work, so the loop
starts at the smallest thing that qualifies and climbs. **A rung is not left
until its scenario passes twice in a row**, because the measured flip rate means
one pass is not evidence.

| Rung | Task | Why it is the right next step |
| --- | --- | --- |
| 1 | `everything-store-plus-earbuds-under-50` (~11 nodes) | Search, then filter, then extract. Seven separate obligations in one instruction, and the case that has never produced a correct answer. Already in progress. |
| 2 | `company-website-gas-engineers` (~8 nodes) | The shortest chain among the ten, on a different site, so rung 1's result can be told apart from something site-specific. Three interruptions before the work starts. |
| 3 | `social-network-feed-confirm-requests` (~11 nodes, **routing and a retry**) | The first task that needs authored routing and a mid-loop recovery, rather than a straight line. |
| 4 | `professional-network-withdraw-stale-requests` (~10 nodes, **a loop**) | A recorded chain of 31 clicks expressed as a loop with per-row skipping — the first task where the Flow must be shorter than the work. |
| 5 | `bigbox-retail-pickup-order` (~20 nodes), then `job-board-apply-quillmark` (~28) | Guest checkout with a deliberate stall to retry and a real order placed — the first instruction authorising a consequential act, so the permission and escalation path is exercised rather than assumed. Then the longest chain in the corpus: a second tab, an ATS iframe, a typeahead, a bot check and a derived reference. |

**Only the ten realistic sites.** Restated by the user on 2026-09-25: the loop
runs on `everything-store`, `crossborder-marketplace`, `bigbox-retail`,
`job-board`, `local-classifieds`, `auction-marketplace`, `photo-social`,
`social-network-feed`, `company-website` and `professional-network`, and
nowhere else. Every task on those ten is multi-node and every one of them opens
behind at least one page-wide interruption, so the complexity gate is met by
construction. **The Lab fixtures are not a rung and never were** — the earlier
ladder opened on `product-catalog-search-lamp` and `member-directory-hollis-admins`,
which are Lab fixtures, and the one pass recorded against rung 1 is therefore
not evidence about the product's real target. Those two rows are removed rather
than reordered.

**The command** is `pnpm lab:campaign <task-id>` for a single task. One live run
in flight at a time.

---

## Worker Briefs

Three discovery briefs were dispatched on 2026-09-24. Their reports are in
[reports/](./language-driven-flow-loop-plan/reports/):

- **scenario inventory** — every live task classified single-node or multi-node,
  the exact action chain a correct Flow needs for each complex one, which
  fixtures support complex work that no task exercises, and the verbatim
  single-task run commands.
- **run evidence audit** — whether the six stages above can be answered from the
  artifacts a run already writes, demonstrated against a real failed multi-step
  run, with each gap traced to the line of code that drops it.
- **MVP capability status** — deterministic replay, automatic repair and
  self-judgement: what exists, what is wired, what is unreachable, what is
  absent, and what breaks first on a Flow of six nodes with a branch.

---

## Work Ledger

### 2026-09-24 — Document opened, discovery dispatched
- Agent: supervisor
- Changed: `docs/working/language-driven-flow-loop-plan.md`, `docs/working/README.md`
- Why: the user replaced corpus-wide measurement with a one-run, one-debug loop
  on complex multi-node scenarios only, and set the MVP exit condition.
- Validation: not validated — no code changed and no run was made.
- Outcome: Accepted
- Follow-up: fill Phases 0 and 1 from the three discovery reports, then run the
  first complex scenario.

### 2026-09-24 — Phase 0 landed, and the ladder was climbed out of order
- Agent: supervisor, with workers on t124 and the Core side
- Changed: Phase 0 instrumentation (`7369504`, Core `16ea5b9`); extraction
  filtering (`2d2324d`, `08d4ff8`); Core's build-time answerability check
  (`636d425`); Core's empty-result judgement and refusal reasons (`bb45f4b`)
- Why: the first live runs exposed causes in each of these, and Phase 0's
  instrumentation was the precondition for diagnosing any of them.
- Validation: eleven live runs against DeepSeek. `run-mug1g8ai-7e79384d`
  passed rung 1 (`product-catalog` / `search`, 17 calls, 286 s). The other ten
  failed. Phase 0's effect is directly observable: `run-mug776kx-0214b287`
  wrote a `flow-lane.json` for a *failed* build, with 41 decision rows carrying
  `iteration`, `evidenceBytes` and per-call `usage`, where the pre-Phase-0
  specimen wrote no such file at all.
- Outcome: Accepted, with two corrections recorded below.
- Follow-up: rung 1 passed once, not twice, so it is not held; rung 2 was
  skipped entirely and the loop went to rung 3. Return to the ladder's order
  once t125 lands.

### 2026-09-25 — The last run named no cause, so t125 reopens Phase 0
- Agent: supervisor
- Changed: `docs/working/language-driven-flow-loop-plan.md` (Current State and
  this ledger, both of which had not been updated since the document opened),
  `reports/build-answers-instruction.md` committed (`0d65c16`)
- Why: `run-mug776kx-0214b287` spent 38 provider calls and built nothing, and
  its failure is fourteen identical `web.action.rejected.invalid_input` rows.
  The reason behind each is computed in the domain and discarded at the Core
  boundary, and no row carries a timestamp, so the run cannot be debugged —
  which is exactly the condition Phase 0 exists to remove.
- Validation: read directly from the run's own artifacts, not inferred —
  `flow-lane.json` gives 41 rows whose only distinguishing members are
  `toolId`, `iteration`, `effectApplied`, `resultCode`, `evidenceBytes` and
  `usage`; `at` is present on 0 of 41. Core's `evidence-loop-decision.ts`
  `exactKeys` list was read and confirmed to name no reason field.
- Outcome: Accepted
- Follow-up: t125 (branch `task/t125-evidence-names-its-reason` in both
  repositories), then rerun `everything-store-plus-earbuds-under-50`.

---

### 2026-09-25 — Three runs on rung 1, and the repair was never reachable
- Agent: supervisor, with workers on t125, t126 and t127
- Changed: Core `7848f93` (the offered library is what the domain runs),
  `638ab1c` (the fourth rebuilder carries the refusal's reason), `75563f0`
  (closest-match name resolution), `85e0d38` (the wrong-answer repair route);
  this repository `9002620`, `37ebcf1`, `fd1fc14` (a run judged wrong is not a
  run still recovering)
- Why: the user restated that only the ten realistic scenarios count, asked why
  a run took sixteen minutes, and asked whether the repair was triggering at
  all. The third question found the largest defect in the document.
- Validation: three live runs of `everything-store-plus-earbuds-under-50`,
  each debugged in full.
  - `run-mug776kx-0214b287` — 38 calls, no Flow, fourteen identical
    `invalid_input` refusals.
  - `run-muhd1vc7-0ec27a16` — 21 calls, a Flow built and replayed, 16 records
    across 2 sets, 0 observed by the oracle, refuted correctly.
  - `run-muher0en-508ddb69` — 27 calls, one extraction, **15 observed, 52 of 52
    fields present, 1 matched**; the qualifying clauses never reached the node.
  - `run-muhnh0s5-98a27f42` — 34 calls, **437 s against 949 s**, a seven-node
    Flow that searches — `navigate, click ×4, type, click ×3, extract_list` —
    and **8 observed, 3 matched in order, 5 in any order** against 13 expected.
  Core: 3020 of 3021 automation-studio tests, 418 recovery tests, 279
  flow-bootstrap. This repository: 811 domain tests, 6 terminal-wait tests.
- Outcome: Accepted. Rung 1 has not passed and is not left.
- Follow-up: t127's 11.04 s wait; whether the repair now produces a patch, which
  the run in flight is the first ever able to show; and the 60 s tail.

---

## Open Questions

- Which complex scenario goes first? `everything-store` is the known multi-step
  case that has never worked, which argues for it; a scenario that fails later
  in the chain would teach more per run. Settled by the scenario inventory.
- Does the corpus have enough qualifying tasks, or does Phase 1 author new ones?
  Settled by the scenario inventory.
- When a run's failure is in Core and in the extension at once, which side is
  fixed first? Owned by the supervisor, settled per run by which failure is
  earlier in the chain.
