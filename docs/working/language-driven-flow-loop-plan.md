# Language-Driven Flow Loop

Status: Active
Status detail: Rung 1, `everything-store-plus-earbuds-under-50`, has been attempted fourteen times and not passed; ten reached the product. The zero read that dominated it is a regression this repository shipped seventeen hours earlier: the wait gives up two seconds into a page whose gates clear on four- and eight-second timers. Two more of the apparent zeros were mis-scored by an already-fixed judge. The best-explored run answers worst, for one reason: seven of its nine draft amendments applied nothing and it was never told why. Two Core fixes are in flight for that and for the extraction vocabulary the repair cannot see. The wrong-answer repair route is open and has applied a correction once.
Created: 2026-09-24
Last updated: 2026-09-26
Owner: Senior supervisor agent
Scope: Reaching the MVP goal — a person's instruction becomes a Flow, that Flow runs deterministically, repairs itself when it breaks, and judges its own answer — by running several complex, multi-node live scenarios in parallel lanes, debugging every run end to end, fixing every cause it exposes, and re-running that same scenario until it works. It deliberately does not cover corpus-wide campaigns, pass-count measurement, single-node extraction tasks, recorded Flows, or any surface that does not block this loop.
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

**A model's change to a Flow must be revertible**, instructed 2026-09-26 after
run 5 destroyed work it had itself proved. The instruction and the shape it
requires are in `A Model's Change To A Flow Must Be Revertible`; the design is
Core's t136, `F:\!FluxIQ\docs\workinglow-version-history-plan.md`. Its first
phase is built: Core `d035e1b` records which graph Flows a run executed and at
which revision, and writes the verdict into `flow_graph_judgements` against
exactly those versions. **Nothing rolls back yet** — the record exists and no
reader acts on it, which is Phase 2 and 3 of that plan, and Phase 3 additionally
needs the provenance column t139 deliberately did not build
(`reports/t139-version-recorded-with-verdict.md`).

**Where rung 1 actually is.** `everything-store-plus-earbuds-under-50` has been
attempted **fourteen times** since 2026-09-25 19:35 and has not passed. It is not
left until it passes twice in a row. Ten of those attempts reached the product
and built a Flow; four never did and are not results — `run-muhp2yip-3a0f198b`
(`lab.generation_unfinished`, a stale domain build), `run-muhs8hx3-6fd929e6` and
`run-muhtuizo-c458e49c`, which were read all day as the provider answering HTTP 400
and were **not**: t145 established that a genuine provider 400 already produces
`flow_bootstrap.provider_http_error` carrying its status, while both of these
recorded `providerCalls: null`, no `providerStatus`, and 167 s and 194 s against a
25 s per-call deadline. **No request was ever made.** The reachable producer
matching every field is a refused run-budget reservation, misprojected as a
provider transport fault because a refusal still hands back provider metadata
(t144 and t152), and `run-muhru6ny-a84eb4a2`, which wrote no lane record at
all.

| Time | Id | Calls | Flow | Records observed | Ended as |
| --- | --- | --- | --- | --- | --- |
| 19:35 | `run-muhd1vc7-0ec27a16` | 19 | 5 nodes | 0 of 13 | refuted |
| 20:23 | `run-muher0en-508ddb69` | 25 | 3 nodes | 15, **1 matched** | refuted |
| 00:27 | `run-muhnh0s5-98a27f42` | 32 | 7 nodes, a search | 8, **3 matched in order** | refuted |
| 01:28 | `run-muhpo10p-771abad6` | 37 | — | 0 | refuted |
| 01:57 | `run-muhqop38-997ee8e5` | 27 | — | **55** | refuted |
| 02:17 | `run-muhrf6c4-9714939f` | 18 | — | 0 | refuted |
| 02:33 | `run-muhrz0at-39a25508` | 23 | — | 0 | refuted |
| 03:09 | `run-muht9lpw-a39aa056` | 17 | **1 node, 0 navigation** | 0, never ran | replay died on `about:blank` |
| 03:30 | `run-muhu0tjc-bb62f6f4` | 17 | 3 nodes | 0 | refuted, **and the re-author applied a correction** |
| 03:43 | `run-muhubegx-9469de5e` | 33 | 10 nodes, a search | **43** | refuted, re-author failed `extend_failed` |

**The dominant failure was ours, and it is a wait rather than a model.** t143
read all fourteen attempts and closed the question by duration alone. Every
extraction read that returned zero records ended at **~2 s** — exactly
`PAGE_STILL_MS`/`EMPTY_PAGE_SETTLE_MS`, the early settle this repository shipped
in `a05134a` at 18:29 on 2026-09-25. Every read that returned rows either found
its list at once or waited much longer:

```
2089, 2576, 2109, 2082 ms                              -> zero records
255, 4631, 6935, 10068, 11082, 14256, 14258, 14264 ms  -> records
```

The fixture's own gates clear on a 4 s timer (`notifications`) and an 8 s timer
(`softCheckAuto`). A page waiting on a `setTimeout` is mutation-quiet and
`readyState: "complete"`, which is the one state `documentStillness` cannot tell
from a finished page — so the read declared the page incapable of producing a list
while the list was still two to six seconds away. **The zero read is a
seventeen-hour-old regression of ours, not a model or draft failure**, and t148 is
fixing it in `apps/extension/src/content/extraction/page-render.ts`.

Two corrections to the table above follow from the same reading, and both were
this repository's defects rather than the product's answers:

- `run-muhd1vc7-0ec27a16` **stored 16 rows** and `run-muhrf6c4-9714939f`
  **stored 8**. Both were scored against the wrong record set by the judge pairing
  that `96833cf` fixed at 19:59, after both runs. Their rows were stored and
  published; only the score was wrong.
- `run-muhrz0at-39a25508` read 14264 ms and got rows, then read 2082 ms and got
  none, and stored "0 records across 1 record set". Its two extraction nodes both
  carry a `recordOutput`; the leading hypothesis, not established, is that the
  empty second read replaced the first's rows in a shared dataset.

So of the ten, one never ran (`run-muht9lpw`, no navigation node), two were
mis-scored, one was probably overwritten by its own second read, two read nothing
because of the wait, and two read far too much. **Only `run-muhnh0s5`'s three rows
in the right position remain a real partial answer**, and the two over-wide reads
are the only evidence about filtering that survives.

**Two further defects t143 found that no fix was dispatched for yet.** The loop
dry-ran `run-muhu0tjc`'s draft and completed it anyway — `dryrun.1.12=extract
list` followed by `decision_complete` with no decision row between, and a dry
run's record count is published nowhere, so if that dry run read zero the loop
finalised a draft it had already watched fail. And a successful trace step is
anonymous: across all 159 bundles, 22 steps carry a `nodeId` and none of those 22
carries a success code, so the exploration's successful extractions cannot be
attributed or counted. Both are Core questions.

**A warning for anyone reading these bundles.** `authoredNodes` is ordered
lexicographically by node id, so `s10` sorts between `s1` and `s2`: read as given
it yields a chain the Flow never had. And `conditions.{applied,kept,rejected}` is
per-document rather than per-read, so `run-muhubegx`'s `applied: 0` beside
`recordCount: 43, pagesRead: 5` describes page five alone.

**The fixes run 8's debug produced** are tabled in `Worker Briefs`. All are
uncommitted and none has been exercised by a provider call; each was verified only
by its own checks.

**What is now known about run 8's one-condition Flow.** It was **not** an
expressiveness failure. Five of the instruction's six qualifying clauses were
already expressible before t142 changed anything, and source order and
once-per-row-across-pages were already guaranteed by the read — merely
undocumented, so nothing could know it. What remains, and is unassigned: the
authoring text does not show the model the filter vocabulary, and the repair
cannot amend a node's parameters. Both are the next wave, behind the workers in
`flow-bootstrap/` and the authoring text.

**One of t144's two handovers needed changing rather than applying.** It asked for
`service.ts`'s private `unclassifiedThrowCode` to be replaced by the exported
`flowBootstrapUnclassifiedThrowCode`, which would have lost information: the build's
catch tracks a *phase-specific* code in `failureCode`, and the exported function falls
back to the stage's generic default. A straight swap would have answered
`flow_bootstrap.provider_transport_unknown` where the caller already knew
`flow_bootstrap.instruction_resolution_failed`. The shared function now takes an
optional `fallback` for a caller that knows better, so there is one classification and
no loss. Verified: `npx tsc --noEmit` clean, 608 tests across 37 files, Core's audit
passing.

**Two loose ends recorded rather than fixed.** `parameter-screen.ts` passed its
400-line advisory under three consecutive tasks (t151 is splitting it), and
`expectedState.conditions[].expected` stayed withheld while an extraction's
comparand became carried — the same structure under a different key, which t151 is
settling.

**What is proven working, live, that this document once recorded as broken.**
Self-judgement on a multi-node Flow: five consecutive runs stored plausible
tables and every one was refuted rather than reported as an answer. The runtime
recovery ladder fires and recovers real faults. And the wrong-answer repair,
which five earlier runs recorded as never having run, now routes: run 7 applied a
correction and run 8 reached the re-author and failed inside it. The gate is
open; what is behind it is now measurable for the first time.

**The next action** is to land t140 and t141, rebuild Core, and run rung 1 again
— the first run in which the model can be told why its own edits are being
refused. After it: run 6's HTTP 400 if it recurs, t127's 11.04 s wait, and
whatever that run's debug names.

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

### Several Lanes At Once, One Run Step At A Time

**The user's instruction, 2026-09-26.** "I want you to use more subagents and
speed things up. Do multiple test loops at once. Test loop being test live on
REALISTIC 1 of 10 HARD SCENARIOS ONLY, debug thoroughly, fix errors and bugs, try
that scenario again till its working perfectly, continue to a new scenario."

The parallelism is **across scenarios, never inside one**. A lane owns one of the
ten sites, runs it live, debugs that run completely, fixes what the debug named,
and runs the same scenario again until it works perfectly. Only then does the lane
take a new scenario. What this must not become is a sweep: ten sites each failing
once with none of them understood.

**How the concurrency is actually obtained.** Most of a loop's wall clock is
debugging and fixing, not running, and both parallelize freely:

- **Debug is read-only** and cannot collide, so every finished run gets its own
  debug worker immediately.
- **Fixes are partitioned by file.** Two workers in one file is how one of them
  loses its work — which has already happened here once, when another agent's
  commit swept up five of a worker's files mid-task.
- **Live runs are isolated per lane by `FLUXIQ_LAB_INSTANCE`.** The Lab is built
  for this: its build phase is serialized across instances by one
  repository-wide lock and its run phase is not, so N instances build one after
  another and then run at the same time. Each instance owns its extension bundle,
  scenario bundle and host bundle under `.lab-instances/<instance>/`, which is
  what stops one lane's rebuild deleting modules another lane's browser is
  loading.
- **A lane cannot start while its build is stale.** The Lab refuses a run whose
  Core build is older than Core's source, and since 2026-09-26 it asks the same
  of this repository's own two builds. So no lane starts while a worker is still
  editing Core or the domain: the fixes land, the builds are rebuilt, and the
  lanes then fire together.

**The ten lanes, one hard multi-node task each.** Every one is
`navigate-and-extract` and judged against an expected dataset, so a lane's verdict
is an answer compared to a known right answer rather than a playback impression.
Variant tasks are not lanes: a lane takes the plain task until it works.

| Lane | Scenario | Task |
| --- | --- | --- |
| A | `everything-store` | `everything-store-plus-earbuds-under-50` |
| B | `job-board` | `job-board-remote-rust-roles` |
| C | `crossborder-marketplace` | `crossborder-marketplace-spain-hubs` |
| D | `bigbox-retail` | `bigbox-retail-pickup-towels` |
| E | `local-classifieds` | `local-classifieds-bike-search` |
| F | `auction-marketplace` | `auction-marketplace-watch-endings` |
| G | `company-website` | `company-website-gas-engineers` |
| H | `photo-social` | `photo-social-giveaway-entries` |
| I | `social-network-feed` | `social-network-feed-feed-digest` |
| J | `professional-network` | `professional-network-rotterdam-data-engineers` |

A lane runs as `FLUXIQ_LAB_INSTANCE=lane-<letter> pnpm lab:campaign <taskId>`,
which spawns the Lab with that lane's own build output and writes its run under
`test-runs/<runId>/` as every other run does.

**The standing caution.** `AGENTS.md` records, with measurements from
2026-09-23, that concurrent live runs can starve each other for browsers, ports
and CPU, and that the loser stalls, exhausts a wait, and is recorded as a product
failure that never happened. Instanced lanes address the file collisions, not the
machine's capacity. So the lane count is raised by measurement — watch each
lane's wall clock against the ~300 s a healthy run takes, and treat a lane that
stalls as evidence about the machine rather than about the product.


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

**0. The wrong-answer repair has never run, and the cause is still not known.
This outranks the four below.**

**Correction, 2026-09-25.** This entry first claimed the cause was found: that
the route gated on the grant purpose being `explore_and_adapt` while a Flow
built from an instruction runs under `build_and_adapt`. **That was wrong.** The
Lab already grants the *created Flow's own run* an `explore_and_adapt` grant —
`CREATED_FLOW_REPAIR_PURPOSE` in
`packages/test-runner/src/live-llm/live-llm-run.ts`, whose comment records that
this precise trap was found and fixed once before — so the purpose gate was
already being satisfied and Core `85e0d38` widened a gate that was not closed.
That change is harmless and defensible on its own terms, and it was not the
fix. `run-muhpo10p-771abad6`, the first run after it, still made zero repair
calls: its only two calls outside the build were `llm.loop_verification`.

**What is actually established.** Six live runs, every one recording
`runtimePatchAttempts: []`, `adaptationIds: []` and `changeProposalIds: []`,
with no provider call ever attributable to a repair. The two `diagnosis`
interventions in `harnessRecovery` are the ladder's placeholder, written with
the run's first save, and say nothing about whether a repair ran —
`terminal-run-wait.ts` documents that.

**Why it is still unknown, and this is the finding worth keeping.** Core
computes the answer and this facility drops it.
`automationStudioRefutedResultReauthorDecision` returns one of four closed
refusals — `not_a_wrong_answer`, `flow_unavailable`,
`grant_does_not_buy_exploration`, `adaptations_not_permitted` — and records it
on the run detail under `resultReauthor`, beside `resultRepair`'s
`{attempted, nodeId, code}`. Neither key reaches the bundle:
`grep -c resultReauthor bundle.complete.json` is 0. So the supervisor
attributed the silence to a known defect twice, once to the patch vocabulary
and once to the purpose gate, and both were reasoning from absence. t130
publishes both keys.

**The lesson, which is the same one twice.** An empty record is not evidence
about *why* it is empty. Before attributing a capability's silence to a known
defect, publish the decision that capability makes and read it. This is the
second time in two days that a diagnosis had to wait on instrumentation the
loop already knew it needed — the first was the refusal reason that
`sanitizeEvidenceLoopTrace` was dropping.

**The original entry follows, for the record.** It remains true that the route
is worth widening and that the capability is wired end to end.

**0a. The route's purpose gate was narrow, though that was not what blocked
it.** Found 2026-09-25 from `run-muhnh0s5-98a27f42`, after five live runs had
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

## A Model's Change To A Flow Must Be Revertible

**The user's instruction, 2026-09-26.** "it sounds like there is a potential for
bad regression due to a bad model decision. I think we need a version control
type system for flows & subflows at the core lvl. Where the changes a model
makes can be easily rolled back if they break a flow/subflow according to the
evaluator."

**What prompted it.** `run-muht9lpw-a39aa056`. The exploration succeeded
outright — 19 decision rows, eight successful `core.run_node` calls, two
structure detections, no refusals after the start-location one at iteration 0.
It navigated, cleared the page's interruptions and found the list. Then
`amend_draft` decisions cut the draft down to a single `web.dom.extract_list`
with `navigationNodes: 0`, and the Flow failed at replay with `Cannot access
contents of url "about:blank"`. **The model destroyed work it had itself
proved, and nothing could put it back.**

**Why this is structural rather than a nicety.** This document's whole premise
is that creation is imperfect and repair converges. Convergence needs a ratchet:
a way of keeping the best version reached so far rather than the most recent
one. A model that can improve a Flow can also ruin one, and without a history
the only Flow that exists after a bad decision is the damaged one — the two are
indistinguishable after the fact because there is nothing to compare against and
nothing to return to.

**The shape, as instructed.** Every model-made change — a build, a repair, a
re-authoring, an applied patch — is a new version rather than an edit in place,
and the previous one stays reachable. **Subflows version independently**, because
a repair usually touches one and rolling the whole Flow back would discard good
changes elsewhere: the unit versioned must match the unit edited. The judgement
is **the evaluator's**, never the model grading its own edit, and the rollback is
automatic — the person asked for the automation to work, and keeping a working
Flow working is part of that ask.

**Where it is being designed.** Core, as the user said: t136, in
`F:\!FluxIQ\docs\workinglow-version-history-plan.md`. It is a design
first — what a version is, what identifies it, what "worse" means and who
decides it, when a rollback must *not* fire, how it composes with the one-cycle
repair bound and with a run already in flight, and what the cheap correct
version is rather than versioning everything forever.

**The consequence for everything else in this document.** An edit path that
cannot say which version it produced cannot be rolled back, so an unversioned
edit path is a defect in this system rather than a shortcut. Anything that judges
a run must be able to name the version it judged.

---

## What A Run Spends Its Time On

Measured 2026-09-25 from the per-row timestamps Phase 0 added, and moved to
[archive/run-time-spent-2026-09-25.md](./language-driven-flow-loop-plan/archive/run-time-spent-2026-09-25.md)
on 2026-09-26 under the compaction threshold. Read it before optimising a run's
wall clock; the runs it measures are those of 2026-09-25.

---

## Phases

### Phases 0 and 1 — settled, and archived

Phase 0 built the instrumentation without which no run in this document could be
debugged; Phase 1 established that the complex corpus already existed. Both moved to
[archive/phases-0-and-1.md](./language-driven-flow-loop-plan/archive/phases-0-and-1.md)
on 2026-09-26. Read Phase 0 there before adding another instrument — it says what each
one exists to answer.

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

Two fix briefs were dispatched into Core on 2026-09-26, both out of run 8's
debug and partitioned so neither touches the other's files:

- **t140, `runtime/llm/`** — carry the refusal
  `applyAutomationStudioFlowDraftAmendments` already computes, tell the model why
  its amendment changed nothing before asking it again, and record the reasons on
  the decision row. It may not change the no-progress guard's arithmetic and may
  not guess which step a refusal meant.
- **t141, `runtime/recovery/repair-context/parameter-screen.ts`** — carry a
  filter condition's and a field declaration's own declared vocabulary at the
  depth a compound parameter actually puts them, while `text`, `value`, a
  locator-shaped string and a secret-shaped string stay withheld and stay named.

### The Tasks Run 8's Debug Produced

| | What it does | State |
| --- | --- | --- |
| t140 | A refused amendment tells the model why, with the positions that do exist and how close the loop is to stopping | built |
| t141 | A filter condition's and a field declaration's own declared keys reach the repair | built |
| t142 | The read tolerates a bad part instead of refusing the whole request; nearest-column resolution on the literal path | built |
| t143 | Read-only: the zero read is our own 2 s early settle | answered |
| t146 | The refusals reach the stored trace, a declined rerun says so, `evidence-loop.ts` 941 → 636 lines | built |
| t147 | What a filter compared *against* reaches the repair; a reduced URL is named as reduced | built |
| t144 | A build failure that parses — the state a code implies was written out three times and nothing tied them together; now one table, type-keyed so a code without a rule fails compilation | built |
| t145 | A provider refusal names itself, screened; and those two runs were never a provider 400 | built |
| t148 | A still page is not an empty one, and `required` stops defaulting to true | built, bundle rebuilt |
| t149 | A near-miss column resolves on the *detected* path; `accepts` derived from each column's spec, since a detection carries no sample values | built |
| t150 | `run-scenario.ts` 812 → 688 lines across 20 modules; the audit and the index gate are open again | built |
| t151 | The screen's vocabulary gets its own module; `expectedState`'s comparand carried, since withholding it was a false claim about the same request | built |
| t152 | A refusal that never reached a provider says so, and the screened refusal reaches a reader | in flight |
| t153 | The read's account of its wait becomes a countable field, and `itemsSeen` crosses a document boundary | built |
| t154 | The two screens on one request agree, so a credential cannot reach the model through the looser one | in flight |
| t155 | An assumed column says so in the run's record, instead of being dropped at `resolve-plan-node.ts` | in flight |
| t156 | A short column word resolves against a long detected key — the instruction asks for `url`, and `url` scores below the floor | in flight |
| t157 | A draft that must shrink is still a draft — `automationStudioFlowDraftEntry` returns `undefined` on committed `dev` | in flight |
| t158 | `listWait`, `itemsSeen` and `emptyRecords` reach a run bundle, across three readers that copy fixed key sets | in flight |
| — | **Supervisor, direct:** `service.ts` adopts the shared throw classifier and the never-null diagnostic; its private copy of the classification is gone and it is 4584 → 4566 lines | built |

---

## Work Ledger

### 2026-09-24 to 2026-09-25 — Archived: the loop opened, Phase 0 landed, and the repair was found unreachable
- Agent: supervisor, with workers on t124 to t127
- Full entries, with every run id, commit hash and validation figure, moved to
  [archive/ledger-to-2026-09-25.md](./language-driven-flow-loop-plan/archive/ledger-to-2026-09-25.md)
  on 2026-09-26 under the compaction threshold.
- What they settled: the loop's operating procedure and the MVP exit condition;
  Phase 0's instrumentation, without which no run could be debugged at all; the
  ten realistic scenarios as the only corpus; and the largest finding of the loop
  to that point — the wrong-answer repair had never once run, because its route
  was gated on a grant purpose no instruction-built Flow ever carries (Core
  `85e0d38`). Fourteen live runs, all debugged.
- Validation: fourteen live runs against DeepSeek across the two days, each
  debugged in full, with every run id, command and observed figure in the archived
  entries. The one pass in that period, `run-mug1g8ai-7e79384d`, was against the
  old rung 1 (`product-catalog`) and is not evidence about the product's target.
  Nothing in this summary line was re-validated on 2026-09-26; it is a pointer to
  validation already recorded, not a fresh claim.
- Outcome: Accepted. Superseded as a description of the present by the entry
  below.

### 2026-09-26 — Four more runs on rung 1, and the model cannot correct its own draft
- Agent: supervisor, with workers on t136, t139, t140 and t141
- Changed: Core `5836d47`, `66ec9cc`, `a8cc85e`, `bd2a9db`, `61d4fab`, `b2fab59`,
  `a28365a`, `d035e1b`; this repository `4e0e318`, `5671780`, `96833cf`,
  `84215fb`, `6992b45`, and this document's Current State, header and ledger
- Why: runs 5 to 8 of `everything-store-plus-earbuds-under-50`. Run 5 explored
  successfully and then amended its own draft down to a single extraction with no
  navigation, which is what prompted the user's Flow-versioning instruction
  (`A Model's Change To A Flow Must Be Revertible`). Run 8 explored better than
  any run before it and answered worse than any since run 2.
- Validation: four live runs against DeepSeek, each read from its own artifacts.
  - `run-muht9lpw-a39aa056` — 17 calls, a one-node Flow with 0 navigation nodes,
    replay died `Cannot access contents of url "about:blank"`.
  - `run-muhtuizo-c458e49c` — the provider answered HTTP 400 at
    `provider_request` on the first call; no Flow. Core `a28365a` was written so
    the next such answer is readable rather than discarded.
  - `run-muhu0tjc-bb62f6f4` — 19 calls, a three-node Flow, 0 records observed,
    refuted, and **the first re-author in the project's history to apply a
    correction** (`adaptation.bootstrap.2b40744c-fe6f-41f0-92ae-20a417ba62d5`).
  - `run-muhubegx-9469de5e` — 35 calls, 305 s, $0.049, a ten-node Flow that
    searches; **43 records observed against 13 expected**, 52 of 52 fields
    present, 0 matched in order and 7 in any order; refuted
    (`core.result.does_not_answer_request`); re-author routed and failed
    `flow_bootstrap.extend_failed`. Its decision trace: 8 successful
    `core.run_node` calls, 2 structure detections, 2 dry-run refusals, 2 invalid
    decisions, and **9 `amend_draft` decisions of which 7 applied nothing**.
  Core t139's own checks are in `reports/t139-version-recorded-with-verdict.md`:
  87 result-verification tests, 12 flow-version tests, 201 storage tests, and
  `flow_graph_judgements` asserted by the existing schema test.
- Outcome: Accepted. Rung 1 has not passed and is not left.
- Follow-up: t140 (a refused amendment tells the model why) and t141 (an
  extraction's vocabulary reaches the repair), both dispatched into Core; then
  rebuild and run rung 1 again. `evidence-loop.ts` at 908 lines and
  `flow-bootstrap/generation-failure.ts` at 817 are over the audit's budget with
  no baseline entry and were already red on `dev` before this work.


## Open Questions

- Which complex scenario goes first? `everything-store` is the known multi-step
  case that has never worked, which argues for it; a scenario that fails later
  in the chain would teach more per run. Settled by the scenario inventory.
- Does the corpus have enough qualifying tasks, or does Phase 1 author new ones?
  Settled by the scenario inventory.
- When a run's failure is in Core and in the extension at once, which side is
  fixed first? Owned by the supervisor, settled per run by which failure is
  earlier in the chain.
