# Language-Driven Flow Loop

Status: Active
Status detail: Pass streak 0. Six lanes run under leads after the 2026-09-29 restart; the live lane (t174) holds the one live slot and is blocked on an unrecognised throw after a tool call.
Created: 2026-09-24
Last updated: 2026-09-29
Owner: Senior supervisor agent
Scope: Reaching the MVP goal — a person's instruction becomes a Flow, that Flow runs deterministically, repairs itself when it breaks, and judges its own answer — by running several complex, multi-node live scenarios in parallel lanes, debugging every run end to end, fixing every cause it exposes, and re-running that same scenario until it works. It deliberately does not cover corpus-wide campaigns, pass-count measurement, single-node extraction tasks, recorded Flows, or any surface that does not block this loop.
Paired document: none
Related: [flow-authoring-and-defensive-runtime-plan.md](./flow-authoring-and-defensive-runtime-plan.md) (the design backlog this loop draws fixes from), [first-class-data-extraction-plan.md](./first-class-data-extraction-plan.md), [MVP agent instructions](../../MVP_AGENT_INSTRUCTIONS.md)

---

## Current State

**Lanes after the restart (2026-09-29 evening).** The user asked for as many agents as useful,
with leads over them, inside the live-slot limit, and asked why builds take so long and how to cut
them. Core t182 is merged (`af385f7`) and pushed with downstream `6cdc9abb`. Each lane has one lead
and its own `fxwork/<id>` tree:

| Lane | Lead | Owns |
| --- | --- | --- |
| t174 live lane | `lead-xhigh` | slot-1; throw fixed (`befca2f`); extension-start failure root-caused as a product defect, then live runs |
| t186 remove call grants | merged | Core `91262bd`, downstream `bfb7f8eb`; t174 drops its grant work at its next merge |
| t187 build and Lab startup speed | `lead` | why builds are slow, and cutting them (Lab prelude, `task start`/`finish`, `pnpm check`/`build`) |
| t188 node limits | merged | Core `c961f4a`, downstream `37379fe3` |
| t189 decision context | merged | Core `f0dbbd6`, downstream `ca07baae`; repeats now shown to the model; live effect unproven |
| t185 live activity + chat | merged | Core `a28815c`, downstream `6818da22`; first browser proof is t174's next run |
| t190 instructed acts | merged | Core `deaf2e7`, downstream `c6e23e46`; bigbox proof is a live run |

**Machine rules for every lane (binding).**
- **Lab slots** (`C:/Users/osrs_/FluxStuff/lab-slots/`): `slot-1` is the only live run, held by t174. `slot-2` is one
  provider-free run on the ten scenarios, and only while free RAM is above 4 GB. Claim with `mkdir`, release with `rmdir`.
- **Build slots** (`b1`, `b2`): run every heavy command (`pnpm check`, `pnpm build`, `pnpm test`, a package's whole
  suite, Core `packages/fluxiq` tsc, `next build`, `pnpm task start`) through
  `bash C:/Users/osrs_/FluxStuff/build-slots/heavy.sh "<lane> <what>" <command...>`. It waits for a slot, uses `b2`
  only while `lab-slots/slot-1` is absent, and releases only its own. Never `mkdir` or `rm` a build slot by hand
  (a hand-written `rm` deleted another lane's claim on 2026-09-29). One test file, or one test directory at
  `--maxWorkers=2 --minWorkers=1` / `--test-concurrency=2`, needs no slot.
- **A live-run failure is a product or Lab defect, never machine load** (user, 2026-09-29): trace the failing step and
  its regression. The CPU priority governor was stopped as a non-fix. Benchmarks still pause while slot-1 is held.
- Only the supervisor commits, merges, branches or makes worktrees. A lead reports `Ready to commit` with files and
  validation, and the supervisor commits and continues it.

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

**A model's change to a Flow must be revertible**, instructed 2026-09-26 after run 5
destroyed work it had itself proved. The instruction and the shape are in
`A Model's Change To A Flow Must Be Revertible`; the design is Core's t136. Its first phase is
built — Core `d035e1b` records which graph Flows a run executed at which revision and writes
the verdict against exactly those versions — and **nothing rolls back yet**.

**Where rung 1 actually is.** `everything-store-plus-earbuds-under-50` has been attempted
**eighteen times** since 2026-09-25 19:35 and has not passed; it is not left until it passes twice in
a row. Eleven attempts built a Flow. Seven stopped before a Flow: `run-muhp2yip-3a0f198b` on a stale
domain build; `run-muhs8hx3-6fd929e6` and `run-muhtuizo-c458e49c` on untyped provider-request
failures whose exact throws remained unknown; `run-muhru6ny-a84eb4a2` without a lane record; and
run 1, `run-muj2kzx1-8f9f8271`, run 3, `run-mujd550n-e8fbe7aa`, and run 4,
`run-muje0grk-4d8d2d3f`, after exploration without a proposal. Run 4 is the latest accepted result. The consecutive-pass streak
remains 0.

The table below is the earlier ten-run scored/Flow-producing subset, not the complete 18-attempt ledger.

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

**In the fourteen attempts then available, the dominant failure was ours: a wait, not a model.** T143 closed that batch's question by duration alone. Every
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
seventeen-hour-old regression of ours, not a model or draft failure**; t148 was assigned to fix it.

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

**The three binding product rules the user set on 2026-09-26 — a defensive runtime for every
node, grants only for genuinely risky actions, and a judge that issues fix instructions — and
the ordered path to a passing live run are in [mvp-today-plan.md](./mvp-today-plan.md).** Read
that first; this document remains the operating loop and the run history.

**Latest accepted rung-1 measurement.** `run-muje0grk-4d8d2d3f` is an integrity-valid,
redaction-verified failed product measurement. It reached Stage 2, used all 26 build decisions and
22 tool calls, then stopped before proposal with `flow_bootstrap.evidence_unusable_decision` at
`provider_output_validation` and issue `bootstrap.cannot_answer_instruction`. No Flow, runtime,
oracle comparison, judgement, repair, persistence, or replay exists. The pass streak remains 0.

Build and observed accounting are the same 26-call representation: 370,882 input plus 3,642 output
tokens, 374,524 total, estimated USD 0.049289784; all calls are itemized. The 33 screened steps carry
57,868 step-level bytes while the summary reports 70,126 total evidence bytes; these projections are
not added. Run 4 triggers the predeclared stop after run 3's same terminal family.

These findings, and what each one obliges the next agent to do, are in
`What This Batch Established`. Read it before adding a field to anything the domain sends
Core, and before updating a test that a resolution change made fail.

**What is proven working, live, that this document once recorded as broken.** Run 2 remains the live
proof that a multi-node created Flow can reach playback, exact extraction comparison, model-backed
self-judgement, and wrong-answer routing. Run 3 additionally proves that terminal build exhaustion
now retains its actionable issue instead of flattening to iteration-limit. The post-run-2 repair/
grant-continuation chain is locally validated but remains live-unproven; no current run proves repair
persistence, provider-free replay, recursive post-replay judgement, or terminal grant revocation.

**Since t173 (merged 2026-09-29, not live-proven).** The t174 lane's live runs 1-10
(`reports/t174-live-lane.md` in `fxwork/t174`) reached the provider, so the old key blocker is gone.
The blocking cause now is an unrecognised throw right after a tool call (runs 6, 7 and 10). The
consecutive-pass streak remains 0.

---

## What This Batch Established

**Two bracket minters are still unscreened, and are fine only while they stay that way.**
t160 fixed the notation where Core mints a path that then passes the locator screen, and
found two more minters — `llm/deepseek/request-shape.ts` and `model/recording-domain.ts` —
which produce bracketed paths that nothing screens today. They are harmless now and
become the same defect the moment either output is screened. Dotting them is cheap;
nobody has been asked to.

**A new member on the evidence execution result refuses the whole call. Read this before
adding a field to anything the domain sends Core.** t155 was asked to carry a recorded
name assumption out to a run's artifact and stopped one line short of the wire, which was
the right call. Both of Core's readers are closed key checks that refuse the whole value
rather than ignoring an unknown member:

- `llm/harness-options/plan-parameter-resolution.ts` — `exactKeys(answer, ["status","parameters"])`.
  One unknown key and every resolved node of every plan fails validation.
- `llm/evidence-loop-decision.ts` — `exactKeys` over the execution result's eight members.
  One unknown key and **the whole execution result is refused
  `llm_evidence_loop.tool_result_invalid`, and the call is recorded as a failure that
  never happened.** Core's own comment says so.

So emitting the field today would have made every node run of the next live exploration
report as a failure — after passing `pnpm check` and all 837 domain tests. Nothing in this
repository encoded that constraint before t155 restated Core's allow-list on the producing
side as `WEB_LLM_EVIDENCE_RESULT_KEYS_CORE_READS`, with a private `readable()` withholding
any member Core has not learned. **Core widens first, then one entry here.** The ordered
hops are in t155's report section 5.1, and they cross files two other workers hold, so
that task waits for t161 and t162 rather than racing them.

Note the shape of the near-miss: a field *inside* `evidence` is safe, because the check is
over top-level members. t153's three read fields ride inside it and are unaffected. The
difference is invisible unless someone has read the check.

**Run 8's seven silent amendments are t140's defect and not the draft's — established,
not assumed.** t157 was dispatched on the hypothesis that the model had been shown no
draft, and refuted it from the run's own rows: the five consecutive `draft_unchanged`
decisions at iterations 27–31 all report an identical `inputTokens: 15463`, so the request
was byte-stable and the draft was present, and iterations 13, 17 and 26 recorded
`draft_amended` and `draft_rerun`, so the model was reading it. What run 8 lacked was an
answer to a no-op amendment, which is exactly what t140 built.

The defect t157 found is real and was worse than the failing test suggested: any
`maxEvidenceContextBytes` below 4,824 switched the draft off entirely, and
`evidence-loop.ts` then filtered the `undefined` away — no draft, no refusal, no trace
row, no log. The live profile uses 24,000, so this loop was clear of it by luck. t162
makes that class of misconfiguration loud.

**Two downstream assertions in this repository will fail the moment Core is rebuilt,
and that is correct.** t156 predicted them by replaying its algorithm over the real key
sets rather than by running them, because Core's `dist` was stale:
`domain/src/runtime/llm-evidence/plan-resolution/extraction/tests/column-match.test.ts`
— "a column with no plausible candidate is still an honest failure" — now sees `title`
(0.497) and `prce` (0.597) resolve, and its comment is wrong; and that directory's
`slot.test.ts` `unknownField` third entry, keyed `"title"`, now resolves. Both must be
updated to assert the new behaviour, with `banana` and a selector still refused, during
the integration pass and not before, since neither can be validated until Core is built.

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

**Every debug also reviews the UI (user, 2026-09-29, binding).** Screenshot the
page and the extension at the start, mid-build, while the Flow runs, at the end,
and at any failure. Look at the screenshots and judge them: the extension chat
must look and behave like ChatGPT's chat area (a clean message stream, clear
user and assistant turns, a composer at the bottom); the on-page status overlay
must be visible on the site whenever FluxIQ is working, side panel open or not;
status text must be stable, never flickering, and polished. A UI defect is
recorded with its screenshot and fixed in the same loop as a functional one. A
run that works behind a bad UI has not passed.

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

## Where The Three Capabilities Stood, To 2026-09-25

The numbered audit of deterministic replay, automatic repair and self-judgement after
the first two days moved to
[archive/three-capabilities-2026-09-25.md](./language-driven-flow-loop-plan/archive/three-capabilities-2026-09-25.md)
on 2026-09-26. Reports cite its causes by number — cause 8, that the repair cannot amend
a node's parameters, is still open and is the remaining half of run 8's wrong answer
alongside t161's authoring text.

---

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
| t152 | Every harness return states `providerInvocation`, a refused reservation stops presenting provider metadata, and the refusal gets a typed home | built |
| t153 | The read's account of its wait becomes a countable field, and `itemsSeen` crosses a document boundary | built |
| t154 | The two screens on one request agree; a credential in an authored condition no longer reaches the model through the looser path | built |
| t155 | The drop at `resolve-plan-node.ts` is closed; the wire is **deliberately not** widened, for the reason below | partial, by design |
| t156 | A short column word resolves against a long detected key: `url` 0.042 → 0.497, `name`/`price`/`rating` identical, `banana` still refused, floor unchanged | built |
| t157 | A draft that must shrink is still a draft; a 1,109-byte guidance floor was discarding twelve real steps and reporting nothing to show | built |
| t158 | `listWait`, `itemsSeen` and `emptyRecords` reach a run bundle; an unfamiliar stop word resolves to `unknown` and keeps the read. **Spans both repositories and neither half works alone** | built |
| t162 | A budget too small to show the draft is loud, the trace says whether the model saw all of it, and the guidance's growth is measured | in flight |
| t161 | The model is shown the filter vocabulary it already had, and the node's guarantees it could not know about | in flight |
| t160 | A withheld path uses dotted indices, so it stops reading as a class selector — the notation was the defect, not the screen | built |
| t159 | The refusal reaches a run's stored accounting, and three workers' overlapping assumptions are reconciled | in flight |
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
- Outcome: Accepted
- Follow-up: superseded as a description of the present by the entry below.

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
- Outcome: Accepted
- Follow-up: t140 (a refused amendment tells the model why) and t141 (an
  extraction's vocabulary reaches the repair), both dispatched into Core; then
  rebuild and run rung 1 again; rung 1 has not passed and is not left.
  `evidence-loop.ts` at 908 lines and
  `flow-bootstrap/generation-failure.ts` at 817 are over the audit's budget with
  no baseline entry and were already red on `dev` before this work.

### 2026-09-26 — Run 2 reached Stage 6 but failed before repair application
- Agent: supervisor, with workers on t225 to t231
- Changed: bounded run-2 debug/evidence reports and both plans' Current State
- Why: Measure creation, execution, judgement, repair routing, persistence, and replay in one default-profile hard-scenario run.
- Validation: `node packages/test-runner/dist/cli.js inspect run-muj39xl6-f6a5d4e5` -> exit 0; independent marker/index and selected-artifact byte, SHA-256, and redaction checks -> all matched, with run redaction verified. Stage 6 reached with a failed product verdict and zero pass streak.
- Outcome: Accepted
- Follow-up: diagnose the reauthor failure and rerun the same default-profile scenario; t217 terminal final-exhaustion remains unmeasured live.

### 2026-09-27 — Final local repair-path validation and launch readiness passed
- Agent: supervisor with t258–t316
- Changed: Core repair/grant-continuation production path, focused test reconciliation, downstream readiness evidence, and no-hindsight launch records
- Why: Carry a refuted answer through durable apply, authoritative binding read, selected-Subflow replay, recursive judgement, and enclosing revocation without widening authority.
- Validation: focused suites t290 81/81, t293 51/51, and t304 web 11/11 plus Core 30/30; Core root test 3,994 passed with one skip and Core check passed; downstream builds/freshness passed; exact dry-run returned ready with zero provider calls; Stage 1 matched its frozen 39-line source.
- Outcome: Accepted as local/readiness evidence; not live proof.
- Follow-up: measure the unchanged default-profile hard scenario; pass streak remains 0.

### 2026-09-27 — Run 3 failed truthfully before Flow proposal
- Agent: supervisor with t325–t329
- Changed: `language-driven-flow-loop-plan/debugs/run-mujd550n-e8fbe7aa.md`, evidence/disposition reports, and both plans' Current State
- Why: Measure the four MVP criteria after the complete post-run-2 repair-path correction.
- Validation: `inspect run-mujd550n-e8fbe7aa` passed identity, default-path, digest, and redaction gates; bounded artifacts show Stage 2, 26 build calls, 21 tool calls, and terminal `flow_bootstrap.evidence_unusable_decision` / `bootstrap.cannot_answer_instruction`, with no Flow or later-stage evidence.
- Outcome: Accepted failed product measurement; consecutive-pass streak 0.
- Follow-up: permit one unchanged controlled retry; if the same Stage-2 exhaustion repeats, stop retries and require deterministic reproduction or an evidence-backed fix.

### 2026-09-27 — Run 4 repeated Stage-2 exhaustion and stopped live retries
- Agent: supervisor with t331–t348
- Changed: `language-driven-flow-loop-plan/debugs/run-muje0grk-4d8d2d3f.md`, evidence/disposition reports, and both plans' Current State
- Why: Measure the single authorized unchanged retry under a predeclared stop rule.
- Validation: independent t347 audit accepted the finalized redacted bundle at Stage 2 with 26 build decisions, 22 tool calls, and terminal `flow_bootstrap.evidence_unusable_decision` / `bootstrap.cannot_answer_instruction`; no proposal or later stage exists.
- Outcome: Accepted failed product measurement; consecutive-pass streak 0; the no-run-5 stop fired.
- Follow-up: deterministic reproduction, privacy-safe stable progress evidence, measured source correction, and full validation before a fresh live authorization.

### 2026-09-27 — Run-4 fix-first correction reached provider-free closure
- Agent: supervisor with [t385](./mvp-today-plan/reports/t385-downstream-post-core-validation.md), [t395](./mvp-today-plan/reports/t395-core-timeout-stability-review.md), [t397](./mvp-today-plan/reports/t397-generated-reference-re-review.md), [t405](./mvp-today-plan/reports/t405-updated-docs-privacy-scan.md), [t406](./mvp-today-plan/reports/t406-core-baseline-final-audit.md), [t409](./mvp-today-plan/reports/t409-post-supervisor-build-freshness.md), and [t410](./mvp-today-plan/reports/t410-final-closure-synthesis.md)
- Changed: The unchanged-budget `step_rows_v1` correction retains every bounded fixture input through decision 26; Core/downstream provider-free gates and corrected-order output freshness are green.
- Why: Remove run 4's measured information loss before testing whether the same default profile can converge; fixture completion is not provider convergence.
- Validation: Supervisor observed Core `pnpm check` and downstream `pnpm -r check`, `pnpm test`, and `pnpm build` exit 0; linked workers observed Core root test 5,437 passed / 1 skip, root build/docs/structure green, and corrected-order freshness 6/6 with markers 12/12.
- Exception: Downstream root `pnpm check` exited 1 only at `pnpm task:test`: 89/120 passed and 31 `git worktree add` cases failed with `cannot spawn git: Exec format error`; all non-worktree gates passed.
- Outcome: Partial
- Follow-up: Run 4 remains latest and the streak remains 0; complete final candidate review/integration and all frozen no-hindsight gates before any fresh command-specific authorization.


### 2026-09-28 to 2026-09-29 — t173: the crash-landed work audited, finished and gated
- Agent: supervisor with t173-B, C, EF, G, I, J, K7, K8, and the audits [gate-baseline-0928](./language-driven-flow-loop-plan/reports/gate-baseline-0928.md) and [inflight-audit-0928](./language-driven-flow-loop-plan/reports/inflight-audit-0928.md)
- Changed: task/t173-audit-close in both repositories. Downstream: domain compiles again (packet.ts dedupe/sort); dedupe and sort applied end to end ([t173-ef](./language-driven-flow-loop-plan/reports/t173-ef-dedupe-sort.md)); in-place effect sees open shadow roots ([report](./language-driven-flow-loop-plan/reports/in-place-effect-shadow.md)); Lab selectors synced to the renamed panel and a creation build's default token budget no longer caps its decisions, while a typed `--llm-max-run-tokens` still binds ([report](./manual-panel-test-findings/reports/lab-selector-sync.md)). Core: incomplete-draft record for an exhausted build and wrap-up refusing unoffered tools ([t173-c](./language-driven-flow-loop-plan/reports/t173-c-incomplete-draft.md)); stale tests and the structure audit ([t173-b](./language-driven-flow-loop-plan/reports/t173-b-core-tests.md)); every chat capability through Core's real handlers ([t173-i](./manual-panel-test-findings/reports/t173-i-capability-contracts.md)).
- Why: the 2026-09-28 crash committed seven workers' partial work ungated; both dev heads failed their gates, and ranks 2-6 of the round-2 causes were open or partial.
- Validation: supervisor observed downstream `pnpm check` EXIT=0; domain test 881/881; extension test 1017/1017; test-runner live-llm 97/97; Core focused deepseek-bootstrap-exploration + exploration-reduction 36/36. Core full gates and scenario-lab pending.
- Outcome: Done on 2026-09-29: K7 and K8 landed, Core and downstream full gates green, merged and pushed (Core `259a11b`, downstream `c6c9f395`).

### 2026-09-29 — Parallel lanes toward day 30; live run 1 blocked inside Core
- Agent: supervisor, dispatching lane leads t174 (live runs, debug and fixes; the only lane allowed live runs), t175 (build-loop convergence through provider-free replays of recorded failures), t176 (refutation, repair, persistence, zero-provider replay and post-replay judgement, provider-free end to end), t177 (Lab observability gaps), and a read-only program gap map for further lanes. Each lane is a Core-paired worktree under `C:/Users/osrs_/FluxStuff/fxwork/t17N`.
- Changed: both repositories re-cloned to `C:/Users/osrs_/FluxStuff`, because the F: drive came from another machine and its files were locked to that machine's accounts. Every local branch, and Core's `supervisor-inflight` stash as `archive/stash-supervisor-inflight`, were pushed first.
- Validation: both clones `pnpm check` exit 0; downstream `pnpm build` exit 0; Lab dry run `status: ready` with zero provider calls. Live run `run-mun5e1ie-5aeefbbd` (everything-store-kettle-to-cart) failed on its first provider call with `flow_bootstrap.provider_transport_unknown`; an authenticated `GET /models` with the same key returned 200 listing `deepseek-flash`, so the throw is inside Core (assigned to t174).
- Outcome: In progress. Pass streak 0.

### 2026-09-30 — Checkpoint before a machine restart (pagefile fix); where every lane stands
- Agent: supervisor. All lanes were told to save state to their reports and stop; the machine restarts to apply a fixed 16-24 GB pagefile (the "memory" crashes were the Windows commit limit, 15.7 GB with a 3.9 GB system-managed pagefile, not physical RAM at 65%).
- Merged and pushed to dev: t173, t175 (amendment-stall fixes), t177 (observability), t178 (improve an existing Flow), t179 (Week 2 metrics; its ui:e2e journeys run on non-ten fixtures and must not run until moved onto the ten), t180 (pause/resume), t181 (Simple Mode), t183 (packaging, CI, /get-started), t184 (55 live tasks on the ten audited, 54 ready), t182 downstream half. Downstream dev `5aedc85e`, Core dev `e85a02a`.
- Pending integration: t176 (repair→persist→zero-provider replay chain; 3 downstream conflicts) and t182's Core half (service.ts 1 line over its 4558 ratchet) are with worker integrate-0930; state in `reports/integrate-0930.md`.
- In progress, resume from each report: t174 live lane (`fxwork/t174`, uncommitted file-level merges of dev plus fixes: grant-refusal naming, Lab long request to 675 s, side-panel crash re-open, throw stage, summary truncation, ambiguous-target replay; runs 1-10 in `reports/t174-live-lane.md`); t185 live activity overlay + extension chat (`fxwork/t185`, `docs/working/live-activity-chat-plan.md`); t186 remove LLM call grants (`fxwork/t186`, B1/C/W/D/E done, B2 test fixes and t176 follow-ups remain); t187 Lab startup speed (`fxwork/t187`); t188 remove every 16-node cap, default 100 per Subflow configurable in UI (report `reports/t188-node-limits.md`, worktree not yet created); t189 decision context — why the model repeats itself (report `reports/t189-decision-context.md`, worktree not yet created).
- Binding rules now in force (memory and AGENTS.md): one live run at a time in `lab-slots/slot-1`, headed; Lab/browser runs only on the ten realistic scenarios; no heavy builds/tests from other lanes while slot-1 exists; no LLM call grants; all agents Opus 5.5 with per-task effort (`lead`, `lead-xhigh`, `worker-low`, `worker`, `worker-high`).
- Validation: not validated; a state checkpoint written before a restart, and nothing ran.
- Outcome: Paused for restart. Pass streak 0.

### 2026-09-29 — After the restart: t182 Core merged, lanes re-dispatched with leads
- Agent: supervisor. Pagefile fix confirmed: commit limit 28,604 MB, 21,278 MB free, slots empty.
- Changed: Core dev `af385f7` (Merge task t182) pushed with downstream `6cdc9abb`; worktrees t188 and t189 created (Core-paired); t174, t185 and t186 work in progress committed on their task branches and dev merged in (conflicts left to each lane's lead); leads dispatched for t187, t188 and t189.
- Validation: in the t182 Core tree, `node scripts/structure-audit.mjs` -> `structure-audit: passed (197 warning(s), 355 baselined).`; `npx tsc -p tsconfig.json --noEmit` (packages/fluxiq) -> exit 0; vitest `service/indexes/tests/without-recording.test.ts` -> 2 passed; vitest `runtime/tests/service-recordings` -> 7 files, 42 passed; Core `pnpm task finish t182` -> `"validation":{"ran":true,"command":"pnpm check","passed":true}`, merged. First `pnpm task finish t176` (downstream) -> `structure-audit: 3 violation(s)`, all this document's (Current State 153 lines, a ledger entry without validation, stale index); fixed here.
- Build time measured today: `pnpm task start --worktree --core` 151 s and 156 s; Core `pnpm check` 110 s (fluxiq tsc 39 s, structure audit 43 s against 8 s downstream). Given to t187.
- t176 (a refuted answer is repaired, persisted and replayed with no provider call) merged in both repositories and pushed: downstream `pnpm task finish t176` -> `"validation":{"ran":true,"command":"pnpm check","passed":true}`, 118 s, `02d95259`; Core `pnpm task finish t176` -> the same, 79 s, `528f52d`. Not live-proven.
- dev (with t176) merged into t185 (both clean) and t174 downstream (`b1a82a21`: seven hand-applied dev files taken from dev, one import kept from both; test-runner `tsc --noEmit` exit 0).
- t188 (a Flow's size is one setting, 100 nodes per Subflow by default, changed in Flow Settings) merged and pushed in both repositories. Supervisor check in the t188 Core tree: vitest flow-size end-to-end + `flow-bootstrap/plan` + `model/flow-size` -> `12 passed (12)`, `121 passed (121)`. Downstream `pnpm task finish t188` -> `"validation":{"ran":true,"command":"pnpm check","passed":true}`, `37379fe3`; Core `pnpm task finish t188` -> the same, `c961f4a`. Lead's run: affected Core suites 1191 tests passed, web settings 59 passed. Not exercised in a browser or live.
- The live slot sat idle for over an hour after the restart (the live lane was briefed to finish full validation first, and t187's bench held a build slot); the user noticed. Corrected: the first live run since the restart claimed slot-1 at 19:30:58 (`crossborder-marketplace-hub-to-cart`), Chromium up at 19:35:43, 4 min 45 s of Lab prelude builds. Benchmarks pause while slot-1 is held.
- Live runs 11 (`run-munhpy2m-036e9572`) and 12 (`run-muni3pdr-80225d3f`) died before pairing, with 0 provider calls: the first `fluxiq.connect` went unanswered for 15 s, then `ERR_ABORTED` loading the side panel after 11 s, at 100% CPU from other lanes' tests. The extension start has failed in 6 of 9 launches. A CPU priority governor now runs during live runs. t174's throw fix (`befca2f`: `draft-shown.ts` rejected t175's `did_not_work` rows; supervisor re-run 2 files / 24 tests passed) and source-mapped Lab frames (`259b0df2`) are committed, and dev with t188 is merged into both t174 trees; the fix is not yet live-proven.
- Merged and pushed in both repositories, each through `pnpm task finish` whose `pnpm check` printed `"passed":true` on both sides: t185 (live activity overlay, extension chat, Lab live panel; supervisor re-run Core api + client-gateway 126/126 on a verbose re-run), t186 (no model call needs a grant; supervisor: session-key-provider + repair-replay-chain 5/5, runtime-patches 3/3, grant symbols left only in absence assertions), t190 (instructed acts name their act, one act per object, arrival step, navigating actions report applied; supervisor: instructed-acts + reachability 77/77, domain 900/900).
- The user found `$0.001` as a cost ceiling. It was only the `runtime-patches.test.ts` fixture, which the grant's $0.25 used to override; the fixture now uses the product's $0.25 (the lane had used $0.15). Every product default is $0.25.
- The user rejected machine load as the cause of the extension-start failures. The priority governor was stopped, and the lane is root-causing the start as a product defect: probe `t174-w7`, ten headed starts, which is the Chromium window the user sees opening and closing.
- t189 merged and pushed (every decision gets a durable history of what it tried and what Core answered; repeats are grouped and named; `evidence-loop.ts` split 800 to 668 lines). Supervisor: decision-context + decision-handlers + draft-shown 8 files, 61 passed; on the merged tree Core `pnpm check` exit 0 and vitest `runtime/llm` 68 files, 651 passed; both `pnpm task finish t189` -> `"passed":true`.
- The extension-start cause found by probe `t174-w7` (a Lab defect): the network guard's canary, run inside the extension's service worker as it starts, stops the first `fluxiq.connect` from being answered. The unchanged Lab gave 1 of 10 clean starts, the guard off 3 of 3, and the canary gated until the extension is ready 5 of 5. The fix and the merge of dev into t174 are next.
- Held for t186: t174's run-4 reservation of three calls for the grant (`loop-limits/flow-bootstrap-evidence-loop.ts`, `llm/resolver-contract.ts`) fails 4 tests in `deepseek-bootstrap-exploration.test.ts`. The lead's git restore of those files to `259a11b` was refused by its permission check. The supervisor did not do it on its behalf; the files are resolved when t186 removes grants.
- Outcome: In progress. Pass streak 0.

## Open Questions

- Which complex scenario goes first? `everything-store` is the known multi-step
  case that has never worked, which argues for it; a scenario that fails later
  in the chain would teach more per run. Settled by the scenario inventory.
- Does the corpus have enough qualifying tasks, or does Phase 1 author new ones?
  Settled by the scenario inventory.
- When a run's failure is in Core and in the extension at once, which side is
  fixed first? Owned by the supervisor, settled per run by which failure is
  earlier in the chain.
