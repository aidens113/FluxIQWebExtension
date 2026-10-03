# Language-Driven Flow Loop

Status: Active
Status detail: Handoff 2026-10-03: live runs held until general Flow authoring (t252) lands; round 1002-M gave lane A's first honest pass; lanes A, C, D and t244-t250, t253 on dev; lane B mid-merge; t252 and t254 in flight; downstream push waits on the user.
Created: 2026-09-24
Last updated: 2026-10-03
Owner: Senior supervisor agent
Scope: Reaching the MVP goal — a person's instruction becomes a Flow, that Flow runs deterministically, repairs itself when it breaks, and judges its own answer — by running several complex, multi-node live scenarios in parallel lanes, debugging every run end to end, fixing every cause it exposes, and re-running that same scenario until it works. It deliberately does not cover corpus-wide campaigns, pass-count measurement, single-node extraction tasks, recorded Flows, or any surface that does not block this loop.
Paired document: none
Related: [flow-authoring-and-defensive-runtime-plan.md](./flow-authoring-and-defensive-runtime-plan.md) (the design backlog this loop draws fixes from), [first-class-data-extraction-plan.md](./first-class-data-extraction-plan.md), [MVP agent instructions](../../MVP_AGENT_INSTRUCTIONS.md)

---

## Current State

**Session 2026-10-03 (resumed after the night handoff). Read this first.** Live runs are held by the user until
general Flow authoring (t252) lands. Round 1002-M gave the first honest pass: lane A crossborder
`run-murwd8le-79e735a8` ($0.0579, built from the chat, judged yes on the Flow as it stood, 4 of 4 facts).

**Dev heads.** Core `d89877d3` and downstream `622eccf8` or later, both pushed (the downstream push the night
handoff left to the user went through from the supervisor: `04a5e3ce..3b1655b8`).

**Landed this session, each verified by the supervisor on the merged tree (ledger below):**
- **Lane B (t193) round 1002-M** (Core `8b952335`, downstream `db9260c8`). Combination decisions:
  `reports/t193-lead-1002M.md`, "Merge of dev, 2026-10-03"; verification: `reports/t193-w-merge-verify.md`. On dev:
  Core check 0, domain check 0, audit passed; the extension check gave 10 false TS errors against a Core dist older
  than the merge, rc 0 after `pnpm --filter fluxiq build`. Closed mechanically (`c14e3560`): the domain and extension
  `check` scripts run `scripts/check/core-build.mjs` first, which refuses a stale Core build by name.
- **t255 run records** (Core `d89877d3`, downstream `622eccf8`): the Lab writes FluxIQ's whole ending;
  `live-llm.json` books the judge and the consequence read apart from the build (murzln6g: build 30 calls $0.086255,
  judge 2 $0.001936, read 1 $0.000380); Core's step log writes `NNNN-answer-<toolId>` folders for amendments and
  refused repeats (later step numbers shift by them). Left open: `flow-lane.json`'s `instructedConsequences` stays
  null; Core's `judgeAccounting` gives no judge call count.
- **t256** (Core `75e66057`): the web Adaptations view and inbox rows say applied, held back (plain reason), or
  waiting for a judged run; summaries carry `judgedApplication`. Rows indexed before it show it once re-saved.
- **t257** (downstream `702c7dbc`): the Lab's UI review counts every document change as a page load (old count kept
  as `pageLoadGaps`; murzln6g moment 6: 0 -> 1); samples carry a screened `pageUrl`; pictures carry `takenAt`.
- Core `880577fc`: the `$0.25` comments in `refuted-result-port.ts` and `repair-authority.ts` name the run ceiling.
- Session 8d (2026-10-02/03): t244, t246-t250, t253 and lanes A (t174), C (t194), D (t195); see the ledger.

**Round 1002-M (step logs under `C:/Users/osrs_/FluxStuff/lab-runs/2026-10-02/<run>/`).**
| Lane | Runs | Ending | Fixed since |
| --- | --- | --- | --- |
| A crossborder | `murwd8le` $0.058 | pass | 14 of 16 causes: tests no longer re-press lasting acts, judges see the end page, cards |
| B bigbox | `murwdp4f` $0.087, `murzln6g` $0.089 | no Flow: purse; judged no with $0.011 left | 10 causes (landed); purse at true cost (t254) |
| C earbuds | `murwcmx2` $0.098 | built, playback refuted (10 of 13), re-author `not_doable` untested | rerun from start pages, unmeasured round never not_doable, confirming judge call |
| D confirm-requests | `murwcaj0` $0.089, `murz83zy` $0.088 | no Flow: loop clicked one hard-coded row; purse | reorder hint, single-row twin, column `at` per item; row-general Flows (t252) |

**In flight (each agent's state is in its report).**
- **t252 general Flow authoring** (`fxwork/t252`, both repositories; design `docs/working/general-flow-authoring-plan.md`
  and report `.../general-flow-authoring-plan/reports/t252-lead.md` in that tree). P1-P3 committed (P3: the build's
  test runs a repeat once per row with the row as `item`, a lasting act is verified per row, never pressed; the judge
  sees one line per row; stored nodes keep declared consequences). Merge of lane B's tip (lanes A-D) committed (Core
  `5f0bb788`, downstream `04178c6b`): only a skipped lasting act excuses a per-row step; node-run layer files moved to
  `node-run/layer/`; Core check 0, node-tools + build-test 275/275, downstream checks 0, domain 725/725. Now: w7
  (parity test; scripted confirm-requests proof with variants) and P4 docs; then the supervisor merges dev and lands.
  Abandon `fxwork/t251` once t252 lands.
- **t254 purse holds at true cost** (`fxwork/t254`; `reports/t254-purse-holds-true-cost.md`). Merge of lane B
  committed (Core `b5533c0c`; unfinished-build 129/129 incl. murzln6g funding, tsc 0, audit passed). Stage 2, the
  supervisor's four decisions: no chat `max_tokens` 600; recovery's ledger at the billed price; judge overshoot in
  phases' accounting; a round stopped by the judging reserve spends it testing and judging the Flow so far. Stage 2
  done (316 files / 3,447 tests incl. murzln6g, check 0, no `max_tokens` sent anywhere). Stage 3 (supervisor): an
  unchanged Flow already judged no is not re-judged (ends at cost with those findings); recovery prices each call at
  the rate in force when it is made.
- **t259** (`fxwork/t259-flow-lane-instructed-consequences`): `flow-lane.json` carries the instruction's consequences
  from the same settle step as `live-llm.json` (`reports/t259-w1-flow-lane-instructed.md`).
- **t258** (`fxwork/t258`, Core-paired): `service/datasets/tests/service-wiring.test.ts` "store cannot be opened"
  fails on dev with a pool-closing AggregateError (a return of t207's family); root cause and fix
  (`reports/t258-w1-service-wiring-store.md`).

**Binding rules (user, all in force).**
- **General Flow authoring before any more live runs (2026-10-02 night):** "The model should be ABLE to explore &
  'record'/test different node configurations, but it should also be able/encouraged to build dynamic & smart flows
  from what its gathered without going through every iteration"; "implement that feature first before any mroe live
  runs". Recorded steps stay valid; the model may also lift a recorded step into a row/input/output binding or write
  one, and is encouraged to generalise repetitive work.
- **Billed dollars, no output cap (2026-10-03):** "It should be billed at how much it actually costs, and i never told
  you to add any cap on output. Remove that." Never add a reply cap to save purse.
- **Cost ceiling $0.10 per Flow, one variable (2026-10-01):** `FLUXIQ_LLM_RUN_COST_CEILING_USD` (default 0.10, max 10,
  invalid stops Core); the Lab passes `--llm-cost-ceiling-usd`, then its env, then `.env`/`.env.local`; the product's
  spending limit is separate.
- **Live builds start from the real extension chat (2026-10-01):** a direct API request is never a pass.
- **The compact page view (2026-09-30):** visible-text and interactive elements only, least format, `find_on_page`
  over text and every attribute, `describe` for one element; every visible control gets a line. No caps or ranking
  among qualifying elements; a request too big for the window fails loudly.
- **No action restrictions beyond permissions (2026-10-01):** only money, delete and send/publish ask the person;
  secret screening stays; covered marks, layers and unknown addresses are information, never refusals.
- **No repeated failing actions (2026-10-01):** one general guard refuses an identical retry on an unchanged page.
- **Every run step logged as files (2026-10-01)** under `test-runs/<run-id>/steps/NNNN-*/`.
- **A build has three phases (2026-09-30):** exploration authors the draft; test and judge once the model says ready;
  repair, finish, or "not doable" only if there is absolutely no way, with the reason.
- **A Flow run routes by page state, not build order, globally in Core (2026-10-01/02);** looping back to one step
  without progress enough times fails.
- **Partial test runs, one full judged run (2026-10-02):** a build or repair finishes only after a whole-Flow run from
  its start was judged successful on the Flow as it finally stands (t244 for builds, t249 for runtime patches).
- **Live runs:** four slots, one per lane; headed only; only the ten realistic scenarios; started by a live agent for a
  reason; stop at the first balance failure; a permission stop is never a pass; a failure is a product or Lab defect,
  never machine load; every debug reviews the UI from screenshots. A live round waits for every agreed change, and lane
  trees are synced to dev and rebuilt first (the Lab's behind-dev guard enforces it).
- **Validation cadence (2026-10-01):** merges take narrow checks; full suites at most twice a day, in the background.
- **Chat cards are never generic (2026-10-01):** each card says what it inspects or does, on what.
- **Process.** Lanes iterate on their own branches; the supervisor merges in rounds and alone commits, merges or
  pushes; leads and workers cannot run git history commands (hook), so the supervisor checkpoints and merges for them.
  Heavy commands go through `build-slots/heavy.sh`. No LLM call grants.

**Decisions made (supervisor; the user may override).**
- Robot checks are never pressed or solved (t197). Money, delete and send/publish ask every time (F10).
- D1, extended by lanes B and D: the build's test and its reruns check a lasting act instead of doing it again.
- `recovery-default-limits` is superseded: with no output cap the purse cannot be a strict bound before a call; holds
  reserve twice the observed maximum reply and an overshoot (part of one reply) is recorded (t254).
- A build-finishing judge yes is confirmed by a second call; a silent or refused confirming call leaves the yes
  standing (lane C, `yesStood`).
- The web domain declares the keys a step carries its row under (`rowContextKeys`); Core names no web key (lane D).
- A Flow's creation has one $0.10 purse; each run's recovery has its own ceiling (offered to merge; unchanged).

**Waiting on the user.**
- Removing 41 landed task worktrees (t184-t238 except the lanes, t224 and t251; each has no commit off dev in either
  repository) with `pnpm task abandon <id>`: the auto-mode classifier refused it as interfering with workloads.
  `abandon` refuses any branch with unlanded commits and never touches the remote.
- t252: stored Flow nodes now keep their declared consequences, but a plain stored run does not check them; turning
  that check on changes what every stored Flow does at run time.
- Removing the remaining pre-action refusals (the classifier refused the edit as a security weakening).
- Workers committing on their own task branches (needs the brain's `hooks/worker-git-guard.mjs`).
- `fxwork/t187-bench` and `fxwork/t192-bench`: delete only on a yes.

**Next, in order.**
1. ~~Lane B: land.~~ Done 2026-10-03.
2. t252: finish P3; merge lanes D and B into it; verify (the scripted confirm-requests proof must pass); land.
3. t254: merge dev; verify (murzln6g reproduction, no `max_tokens`, billed pricing); land.
4. Sweep 2 in the background (Core `pnpm test` now runs every package).
5. Re-sync the four lane trees to dev and rebuild; release round 1002-M's leads with fresh briefs; then the approved
   `deepseek-v4-pro` comparison (`--llm-model deepseek-v4-pro --llm-cost-ceiling-usd 0.30`, one run).

**Open follow-ups (not assigned).** Unify `control` and `does`; signatures for recorded Flows (t243 item 4); a dropped
column on a rerun needs the domain's denied keys (t195 R3); a recovery-stage part-run tool on `stopAfterNodeId`; the
reroute edge mismatch (trial `success` vs durable `failed`); `$0.25` left in `refuted-result-port.ts` and
`repair-authority.ts`; the web Adaptations view shows no `applied`/`notAppliedReason`; scripted judges that run out of
answers should fail the test, not stand in for a confirmation; a step's `replay.from` is the screened address, so a
reset can go to a "(withheld)" URL (lane C); a not-finished build keeps the creation purse open (lane D,
`built-loop.ts:30`); a stored Flow node drops `consequences` (t252); lane A's open causes 2, 6, 10, 11, 15 and UI D6,
D9; load-flaky Core tests (`subflow`, `service-recordings/proposals`, `cancel-runtime-session`, `runs`) and the Lab's
`unbuilt.test.mjs`; a click landing on a 429 page is `navigation_unexpected`.

Older history: rung 1 is in `archive/rung1-history-to-2026-09-26.md`; the ledger to 2026-10-01 is in `archive/` and
the Work Ledger below.

---

## The 2026-09-30 Audit And Its Fixes

Four read-only audits (worker-high), from about 54 debugs, the lane reports and the run bundles, after the user stopped all
Labs "to get this over the line". Reports:
[A1 exploration and decisions](./language-driven-flow-loop-plan/audit-2026-09-30/a1-exploration-decisions.md),
[A2 draft and execution](./language-driven-flow-loop-plan/audit-2026-09-30/a2-draft-and-execution.md),
[A3 judgement and repair](./language-driven-flow-loop-plan/audit-2026-09-30/a3-judgement-and-repair.md),
[A4 page and harness](./language-driven-flow-loop-plan/audit-2026-09-30/a4-page-and-harness.md). Each names file:line on
dev, run ids, and a fix partitioned by file. A1: 57 of 117 live builds ended with no Flow.

| Cause (audit) | Runs | Owner, status |
| --- | --- | --- |
| The model is never shown the instructed acts until a refusal; claims name ids it cannot see (A1-1) | last refusal in 35 of 57 | t196, in progress |
| A landed press or navigation counts as progress, so the no-progress guard never fires (A1-2) | 24 of 57 hit the 64-decision limit | t196, in progress |
| Every completion replays the draft from the start (A1-3) | 6 killed | t196, done `77b269a2` |
| A build that cannot finish just ends: no test, repair or "not doable" (A3-1) | 30 | t196 (the lifecycle), in progress |
| The loop keeps every executed step in the draft; the user wants an authored Flow (t196's gap) | - | t196, in progress |
| A click that reloads its own page is reported failed and dropped from the Flow (A2-1) | 13 | t202, extension `click-landing.ts` |
| A model-built click gets no robot-check allowance (5 s) where recorded clicks do (A4-2) | 8 (checks) | new task, Core `nodes/policy/action.ts` + domain `web-panel-host.ts` |
| A failed playback step can only be patched; the re-author is wired only to a refuted answer (A3-2) | 12 | after t200 merges (it owns `recovery/`) |
| A permission ask ends the build (A3-3) | 14 | lane D w14 on its branch; 5 tasks lack a permission point, after D |
| The completion check accepts Flows whose steps do not do the instructed act's object (A2-2) | 13 accepted Flows | quantity/size on lane A's branch; object binding open, after t196 |
| A press is swallowed after a page load but counts as success (A2-3) | 4 playbacks, 7 builds | lane D F20 on its branch; fail a twice-ignored press, open |
| Corner page-assistant cards and walls hiding a target (A4-1, A2-4) | 14 + 7 | lane D R1/R2 on its branch |
| The test runs on the build's own site state and resets by navigation only (A2-5) | 6 killed | open, after t196 |
| `pnpm check` bundles the extension against a stale Core build; `node:` imports can reach the browser (A4) | t197's defect | new task (check hardening), Core + downstream |
| Lab bookkeeping: product failures labelled facility, a 300 s idle after a failed repair, re-author spend unreported, no in-page account of a blocked call (A4) | 12 debugs | after lane D (it edits `run-scenario.ts`) |
| The whole page to the model, including child iframes; keep covering-dialog flags without reordering (t200, A4) | - | t200, in progress |

Merge order (from the audits' conflict sections): lanes A-D and t197/t201 first, then t200, then t196 (both edit
`R/flow-draft/**`; `entry.ts` will conflict), then the fix tasks that wait on them.

---

## What The 2026-09-26 Batch Established

Moved to [archive/batch-established-2026-09-26.md](./language-driven-flow-loop-plan/archive/batch-established-2026-09-26.md)
on 2026-09-30. **Read it before adding a field to anything the domain sends Core:** Core's readers of the evidence execution
result are closed key checks, so one unknown top-level member refuses the whole value (Core widens first, then one entry here).

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

The 2026-09-24 discovery briefs, the 2026-09-26 Core fix briefs and the table of tasks run 8's debug produced (t140 to
t162) moved to [archive/briefs-2026-09-24-to-26.md](./language-driven-flow-loop-plan/archive/briefs-2026-09-24-to-26.md)
on 2026-10-02. Later lane briefs live in each lane's own report.

### Briefs, 2026-10-02: finish and verify the lanes' uncommitted work

The lane finish round's common rules and briefs (t174, t193, t194, t195 leads) and the t239, t240 and t241 briefs
are archived in [archive/briefs-2026-10-02.md](./language-driven-flow-loop-plan/archive/briefs-2026-10-02.md); all merged into dev.
The briefs below are still in flight. Common rules for a non-live brief: no live run or provider call, narrow
checks only, heavy commands through `build-slots/heavy.sh`, no commits; `R/` is Core's
`packages/fluxiq/src/programs/automation-studio/runtime/`.

#### Brief: t242-skipped-steps-reach-run-detail (`worker`)
- Repository: both, tree `fxwork/t242` (Core-paired)
- Task: t174's F38 records a skipped sometimes-present step (`target_absent`), but the run detail drops `skipped`
  (Core `R/service/summaries/conversions.ts`), so the Lab cannot tell a skip from a press, and F35's playback
  `steps/` writes a skipped step's host attempt as a failed row. Carry `skipped` through the run detail and write it
  in the Lab as skipped, never failed.
- Required reads: `reports/t174-lead-1002.md` ("Not verified"), `R/executor/step-skip/**`.
- Owns: Core `R/service/summaries/conversions.ts` and its tests; downstream
  `packages/test-runner/src/lab-runs/{write-playback-steps,rewrite-steps-index}.ts` and their tests.
- Must not touch: `R/executor/**`, `R/service.ts`, `domain/**`.
- Done: failing-first tests on both sides; narrow checks with Core libraries rebuilt.
- Report to: `reports/t242-skipped-steps-reach-run-detail.md` in `fxwork/t242/!FluxIQWebExtension`

#### Brief: t243-state-routing-runtime (`lead-xhigh`, Core architecture)
- Repository: both, tree `fxwork/t243` (Core-paired); Core owns the mechanism, the web domain only observes.
- Task (user, 2026-10-02, binding): "that same thing should apply to THE ENTIRE RUNTIME! if a step isnt avaialble,
  it should use state to find current step. Of course if it keeps looping back to the same step and not progressing
  enough times, it should count as failed"; "that rule is supposed to be a GLOBAL runtime thing of core". For every
  node of a Flow run, not only sometimes-present ones: when a step cannot run (its target is unavailable or its
  expected state does not hold), Core observes the current state through the domain's observer and routes to the
  node whose recorded expected pre-state matches, before any recovery ladder or model call. A bounded guard ends the
  run as failed, with that stated reason, when routing keeps returning to the same node without progress. F38's skip of
  an absent sometimes-present step becomes one case of this rule.
- First: design in the report (what a node's expected pre-state is and where the build records it; Core's draft steps
  already carry `stateBefore`/`stateAfter` digests and `R/route-state/` has an observer and router state; how matching
  stays content-free in Core; the progress measure and its bound; how it orders against the recovery ladder; Flow
  versions without pre-states). Then implement with failing-first tests, Core docs, and a Scenario Lab fixture where a
  step is unavailable and the page is already past it.
- Owns: Core `R/executor/**`, `R/route-state/**`, `R/flow-bootstrap/authoring/**`, the draft-to-Flow writer, their tests
  and `docs/architecture/automation-studio*`; domain `src/runtime/llm-evidence/state-digest/**` and the domain's runtime
  state observer; Scenario Lab fixtures it adds.
- Must not touch: `R/llm/evidence-loop*.ts`, `R/result-verification/**`, `R/recovery/refuted-result/**`,
  `packages/test-runner/src/lab-runs/**`.
- Done: narrow checks in both repositories with Core libraries rebuilt; report says Ready to commit, per fix.
- Report to: `reports/t243-state-routing-runtime.md` in `fxwork/t243/!FluxIQWebExtension`

#### Brief: t244-partial-runs-full-judged-gate (`lead-xhigh`, Core build and repair loops)
- Repository: both, tree `fxwork/t244` (Core-paired).
- Task (user, 2026-10-02, binding): "When testing, the repair loop/general LLM should be able to run from a certain
  node to only test parts hte flow. One thing thouhg, it must test the entire flow & have that judged success at least
  one time". (1) The build loop and the repair loops (re-author, ladder) get a tool to run the Flow from a chosen node,
  optionally to a chosen end node, on the page as it stands. (2) A build cannot propose or finish, and a repair cannot
  be accepted, until a whole-Flow run from its start was judged successful on the Flow as it finally stands; an edit
  after that run needs another full run and judgement (supervisor's reading, stated to the user).
- First: design in the report, starting from Core's `R/flow-draft/{dry-run,dry-run-gate,replay,replay-draft,step-place}.ts`
  and `R/llm/node-tools/run-node.ts`; what a partial run costs and records; where each gate sits (build phases,
  re-author, ladder, adaptation apply); how the judge's verdict is tied to the Flow version it judged.
- Owns: Core `R/flow-draft/**`, `R/llm/node-tools/**`, `R/flow-bootstrap/unfinished-build/**`,
  `R/recovery/refuted-result/**`, the gate's tests, `docs/architecture/automation-studio*`; domain tool descriptions
  for the new tool.
- Must not touch: `R/executor/**`, `R/route-state/**`, `R/flow-bootstrap/authoring/**` (t243). A needed executor
  entry ("start at node X") is requested from the supervisor in the report, not edited.
- Report to: `reports/t244-partial-runs-full-judged-gate.md` in `fxwork/t244/!FluxIQWebExtension`

#### Brief: t245-sweep-1002-core-failures (`worker-high`)
- Repository: Core, tree `fxwork/t245` (Core-paired). Sweep 1 on Core dev `2bc0baac`: 4 failed of 5,984.
- Task: find each failure's cause and fix it forward: `service/runtime-adaptation/tests/repair-rerun.test.ts` (2, "a
  repaired re-run of an optional press whose target is gone"; likely t174's F38 skip), `tests/service-adaptation/
  tests/modes.test.ts` ("stable and continuous adaptive modes plus budget exhaustion"; check t240), and
  `src/programs/tests/global-docs.test.ts` ("generates a TypeDoc-backed framework reference"). Decide per test whether
  the behaviour or the expectation is wrong, with the binding rules as the reference; a load-only failure must be
  shown passing alone and failing under load, with the cause.
- Owns: those test files and any non-executor source a cause lives in. Must not touch `R/executor/**`,
  `R/route-state/**` (t243) or t244's paths; an executor cause is reported, not edited.
- Report to: `reports/t245-sweep-1002-core-failures.md` in `fxwork/t245/!FluxIQWebExtension`

#### Briefs: t246, t247, t248 (recorded after dispatch; the supervisor dispatched them from prompts, an error)
- **t246-service-test-setup-cost** (`worker-high`, Core): one service test case costs 5-9 s alone, so 20-23 service
  tests reach their 15 s timeout under load. Profile a representative case with measured numbers and remove the cost
  at its source, keeping isolation and what the tests check. Owns Core test helpers and fixtures under `R/tests/**`
  and `R/service/**/tests/**`; not t243's or t244's paths. Done: before/after timings alone and under load, all
  passing, Core check and audit.
- **t247-web-app-sweep-failures** (`worker`, Core web app): `ProjectTree.tsx` is 301 lines against 300 (decompose by
  responsibility, never trim lines or raise the limit); the settings round trip's run-ceiling default reads NaN where
  $0.25 is expected (find the wrong side); Core's root `pnpm test` runs every package (`--no-bail`). Done: both pass,
  the whole web suite and its typecheck pass, Core audit.
- **t248-lab-records-state-routing** (`worker`, downstream Lab): parse `state_routed` skip marks, carry them through
  the actions table and `steps/` as "routed to <node> (<direction>)", never failed, with a run-level count; add the
  bigbox `store-remembered` Lab row and its testing-facility line (t243 open item 1). Done: failing-first tests,
  test-runner check and tests, audit.

#### Briefs: live round 1002-L (lanes A-D, `lead-xhigh`)
Common. The supervisor first merges dev into every lane tree (both repositories) and rebuilds Core libraries and the
extension; the Lab's behind-dev guard must admit the tree. Each lead owns one slot and one scenario, runs it live from
the extension chat, headed, deepseek-flash, under the $0.10 creation purse (`--llm-cost-ceiling-usd 0.10`), one run per
invocation, at most three runs. After every run: the Full Debug Protocol above (step logs, the six stages, UI review
from screenshots), a debug file in `debugs/`, then fix each cause on the lane's tree with failing-first tests and
narrow checks, and rerun only on changed source. Stop at the first balance failure. No commits; the report lists each
run (id, cost, stage reached, causes, fixes) and the commit-ready files per fix.

| Lead | Tree | Slot | Scenario / task |
| --- | --- | --- | --- |
| t174-lead-1002L (A) | `fxwork/t174` | slot-1 | crossborder-marketplace-hub-to-cart |
| t193-lead-1002L (B) | `fxwork/t193` | slot-2 | bigbox-retail-pickup-cart |
| t194-lead-1002L (C) | `fxwork/t194` | slot-3 | everything-store-plus-earbuds-under-50 |
| t195-lead-1002L (D) | `fxwork/t195` | slot-4 | social-network-feed-confirm-requests |

Report to: `reports/<lead>.md` in the lane tree.

#### Briefs: live round 1003 (lanes A-D, `lead-xhigh`; pending: dispatch only after t252 and t254 land)
Common: as 1002-L above, with these changes. The supervisor merges dev into every lane tree (both repositories),
rebuilds Core libraries and the extension, and confirms the Lab's behind-dev guard admits each tree. What this round must
show, beyond each lane's own causes:
- the build may generalise: a repetitive instruction becomes a row-general Flow (a repeat bound to `$row`), tested once
  per row with lasting acts checked, never pressed (t252);
- the purse holds what calls cost: a build with money left tests and judges before it ends, and an ending at cost names
  what was left and why it was not enough (t254);
- the run's records are whole: FluxIQ's ending, the judge booked apart from the build in `live-llm.json`, Core's answer
  folders for amendments (t255), UI-review `pageLoads` and picture timing (t257). A record gap is itself a cause.

| Lead | Tree | Slot | Scenario | Carry in |
| --- | --- | --- | --- | --- |
| t174-lead-1003 (A) | `fxwork/t174` | slot-1 | crossborder-marketplace-hub-to-cart | open causes 2, 6, 10, 11, 15; UI D6, D9. After a flash run, one approved comparison run: `--llm-model deepseek-v4-pro --llm-cost-ceiling-usd 0.30` |
| t193-lead-1003 (B) | `fxwork/t193` | slot-2 | bigbox-retail-pickup-cart | C4, R2-C8, R2-C9, C13, C14, C16, C17 (`reports/t193-lead-1002M.md`, "For the supervisor") |
| t194-lead-1003 (C) | `fxwork/t194` | slot-3 | everything-store-plus-earbuds-under-50 | the re-author's ending is now judged; reach and debug it |
| t195-lead-1003 (D) | `fxwork/t195` | slot-4 | social-network-feed-confirm-requests | the hard-coded-row loop: the build must write the row-general Flow |

Report to: `reports/<lead>.md` in the lane tree.

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

### 2026-09-26 to 2026-09-27 — Archived: rung 1 runs 5-8, run 2 at Stage 6, runs 3-4 exhausted at Stage 2
- Agent: supervisor, with workers on t136 to t348
- Full entries moved to [archive/ledger-2026-09-26-to-27.md](./language-driven-flow-loop-plan/archive/ledger-2026-09-26-to-27.md)
  on 2026-09-30 under the compaction threshold.
- What they settled: the model could not correct its own draft (t140, t141); the repair path reached Stage 6 but failed
  before applying; runs 3 and 4 exhausted at Stage 2 with `evidence_unusable_decision`, which stopped live retries until a
  fix-first correction reached provider-free closure.
- Validation: recorded in each archived entry (run ids, commands and observed figures); nothing here is re-validated.
- Outcome: Accepted
- Follow-up: superseded by the entries below.

### 2026-09-28 to 2026-09-30 — Archived: t173 gated, lanes re-dispatched, the balance stop, integration round 3 begun
- Agent: supervisor, with lane leads t174, t193, t194, t195 and workers t173 to t214
- Full entries moved to [archive/ledger-2026-09-28-to-30.md](./language-driven-flow-loop-plan/archive/ledger-2026-09-28-to-30.md)
  on 2026-09-30 under the compaction threshold, with a duplicate handoff entry that had landed under Open Questions.
- What they settled: t173's crash-landed work was audited and gated; the lanes ran with leads after the restart; the
  overnight unattended relaunch loops spent $9.46 and ended at the DeepSeek balance stop; the user's four orders started
  integration round 3, with Labs stopped for the merge and audit.
- Validation: recorded in each archived entry (run ids, commands and observed figures); nothing here is re-validated.
- Outcome: Accepted
- Follow-up: superseded by the entries below.

### 2026-09-30 to 2026-10-01 round 5 — Archived: rounds 3-5 merged and pushed, t210 page view, Codex t216-t224, lanes re-dispatched
- Agent: supervisor, with lane leads t174, t193, t194, t195, t210, t215 and Codex t216-t224
- Full entries moved to [archive/ledger-2026-09-30-to-10-01.md](./language-driven-flow-loop-plan/archive/ledger-2026-09-30-to-10-01.md)
  on 2026-10-02 under the compaction threshold.
- What they settled: integration round 3 (the whole page, the three-phase build, the audit's fixes) and rounds 4-5
  (t215, t222, Codex t216-t224, lanes B-D, t225 compat fixes, t226 loop split, decision B1) merged and pushed; every
  Lab stopped for the page view (t223).
- Validation: recorded in each archived entry; nothing here is re-validated.
- Outcome: Accepted
- Follow-up: superseded by the entries below.

### 2026-10-01 — Archived: root cause of the wandering runs, rounds 9-12, the fix list, the first live rounds
- Agent: supervisor, with lanes A-D and leads t229, t233-t238
- Full entries moved to [archive/ledger-2026-10-01.md](./language-driven-flow-loop-plan/archive/ledger-2026-10-01.md)
  on 2026-10-03 under the compaction threshold.
- What they settled: the page view shows every control (t232), step logs (t228), the one $0.10 variable, the user's
  fix list (names-only catalog, domain system prompt, one purse per Flow), the behind-dev guard; every build produced
  a Flow and playback failed.
- Validation: recorded in each archived entry; nothing here is re-validated.
- Outcome: Accepted
- Follow-up: superseded by the entries below.

### 2026-10-02 evening to 2026-10-03 — t244-t250, t253 and round 1002-M lanes A, C, D landed; first honest pass; general authoring under way; handoff
- Agent: supervisor (session 8d), with peer session 33 on a merge handshake; leads t174, t193, t194, t195 (1002-M), t251/t252; workers t246-t250, t253, t254, t194-integrate, t246-check.
- Changed:
  - Landed in Core and downstream: t244, t246, t247, t248, t249 (with its fix-up: a completed trial is the judged run; a refuted result's ladder patch is re-run whole), t250 plus hotfix `bdc459dd` (module cycle), t253, and lanes A, C, D of round 1002-M, each merged with the lanes before it. The supervisor resolved t244's conflicts with t193 and t194 (rerun wording, no step numbers on part-run cards, the evidence loop's tool set split to `node-tools/loop-tools.ts`) and lane C's with lane A; leads resolved lanes D and B.
  - Downstream history rewritten (user-approved fake key): unpushed commits on dev, t194 and t244 now hold `sk-FAKE-test-value-not-a-real-key`. The push was refused by the permission classifier and waits on the user.
  - Round 1002-M launched on synced trees (Core `424a70b3`, downstream `45965d7d`): six runs, lane A passed; then held by the user for general Flow authoring (t251 design, t252 implementation).
  - User rules recorded: general authoring before any more live runs; the purse counts billed dollars and the model's output is never capped (t254 implements both, plus true-cost holds).
  - Web app fix `8f92b399` (lane C's `recall` kind had no icon).
- Validation: each run by the supervisor on the tree named.
  - t244 after merging t194 (fxwork/t244/!FluxIQ/packages/fluxiq): `pnpm check` rc 0; `npx vitest run` over the 11 touched dirs `Test Files 100 passed (100)` after the split; downstream domain/extension/test-runner `check` rc 0 against t244's Core; Core finish gate `pnpm check` passed.
  - t249: `Test Files 131 passed (131)`, tsc rc 0. t246: `Test Files 31 passed (31)`; downstream domain service tests `1/1`, `10/10`, smoke passed. t250 Core `Test Files 28 passed (28)`; downstream `# pass 438 # fail 0` after rebuilding test-contracts. t253: decision-context `Tests 43 passed (43)`.
  - Lane A (fxwork/t174): Core `Test Files 188 passed (188)`; domain `# pass 1372 # fail 0`; extension `# pass 2370 # fail 0`; test-runner `# pass 1841 # fail 0`; test-contracts `# pass 161 # fail 0`; checks rc 0; audits passed.
  - Lane C (fxwork/t194, with lane A): Core `Test Files 313 passed (313)`, `Tests 3473 passed (3473)`; domain `# pass 1378`; extension `# pass 2370`; checks rc 0.
  - Lane D (fxwork/t195, with lanes A and C): Core `Test Files 361 passed (361)`, `Tests 3881 passed (3881)`; domain `# pass 1384 # fail 0`; extension `# pass 2370 # fail 0`; checks rc 0; audits passed.
  - Core dev after the web fix: apps/web `npx tsc --noEmit` rc 0; conversation tests `Test Files 26 passed (26)`, `Tests 267 passed (267)` after rebuilding Core's libraries (the two earlier failures were a stale dist).
  - Not run: sweep 2 (full suites); t254's combined narrow rerun and `pnpm --filter fluxiq check`; lane B's remaining checks; t252's w7 proof.
- Outcome: Core dev `8f92b399` pushed; downstream dev committed locally, push waiting on the user. Lane B mid-merge, t252 and t254 checkpointed on their branches. Live runs held.

## Open Questions

- Which complex scenario goes first? `everything-store` is the known multi-step
  case that has never worked, which argues for it; a scenario that fails later
  in the chain would teach more per run. Settled by the scenario inventory.
- Does the corpus have enough qualifying tasks, or does Phase 1 author new ones?
  Settled by the scenario inventory.
- When a run's failure is in Core and in the extension at once, which side is
  fixed first? Owned by the supervisor, settled per run by which failure is
  earlier in the chain.
