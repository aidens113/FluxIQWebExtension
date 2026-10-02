# Language-Driven Flow Loop

Status: Active
Status detail: Handoff 2026-10-01: every Lab stopped by the user until t223 (the approved compact page view plus page search) lands; integration round 4 (t210 r3, t215, t222, Codex t216-t224, lane A F14) on dev; lane B-D fixes committed on their branches for round 5; pass streak 0.
Created: 2026-09-24
Last updated: 2026-10-01
Owner: Senior supervisor agent
Scope: Reaching the MVP goal — a person's instruction becomes a Flow, that Flow runs deterministically, repairs itself when it breaks, and judges its own answer — by running several complex, multi-node live scenarios in parallel lanes, debugging every run end to end, fixing every cause it exposes, and re-running that same scenario until it works. It deliberately does not cover corpus-wide campaigns, pass-count measurement, single-node extraction tasks, recorded Flows, or any surface that does not block this loop.
Paired document: none
Related: [flow-authoring-and-defensive-runtime-plan.md](./flow-authoring-and-defensive-runtime-plan.md) (the design backlog this loop draws fixes from), [first-class-data-extraction-plan.md](./first-class-data-extraction-plan.md), [MVP agent instructions](../../MVP_AGENT_INSTRUCTIONS.md)

---

## Current State

**Update, 2026-10-01 night. Read this first.** Pass streak 0. Round 9 is pushed (page view shows every control, step logs, the $0.10 variable, lanes B and C); lanes A-C are live again.
The compact view, the chat launcher and the first repeat guard are on dev (rounds 6-8, ledger below). The live runs
still wandered, and the cause is now known: **the page view hid controls**. In the earbuds run the store's search box
reached the model as `t489 field "Autumn Mega Sale: up to 70% off" =""` (its placeholder, no search marker), icon-only
buttons had no line at all, and the model searched `find_on_page "Voltbay"` 29 times with 0 matches
(`fxwork/t174/.../decision-dumps/build-2026-10-02T00-00-07-573Z-26504.jsonl`). **No live run until the page-view fix
(PV) lands and a real recorded page is checked to show every control.** PV landed as t232 in round 9.

Task ids: the task tool numbers branches (`task/t228-step-logs`, `task/t229-core-regressions`); the labels PV, CEIL and
STEPS below are the plan's names for work that has no branch of its own or predates that numbering.

**Binding rules (user, all in force).**
- **Live builds start from the real extension chat (2026-10-01):** a run started by a direct API request is never a
  pass. The chat launcher is on dev (t227).
- **The compact page view (2026-09-30 night):** "ITS NOT SUPPOSED TO FEED IN THE ENTIRE PAGE JUST RAW"; "only giving
  model elements that have visible text/buttons/etc with the least possible data in terms of format. Then allow the
  model to search the page". The approved format is `fxwork/t223/.../reports/t223-format-example.md`: a header,
  `[region]` lines, one `<handle> <kind> "<words>" <state>` line per visible-text or interactive element,
  `find_on_page` over text and every attribute, `describe` for one element. **Every visible control must get a line**
  (PV's guard spec enforces it across the ten scenarios).
- **No caps or ranking among qualifying elements (2026-09-30).** A request too big for the window fails loudly.
- **No action restrictions beyond permissions (2026-10-01):** "there should be no restrictions on what the model can
  do (other than the already defined security ones for things like delete...)". Only money, delete and send/publish
  ask the person; secret screening stays; covered marks, layers and unknown addresses are information, never refusals.
- **No repeated failing actions (2026-10-01):** one general guard refuses an identical retry of a failed or no-effect
  call on an unchanged page (RG on dev; lane B extends it to observations that change nothing).
- **Cost ceiling $0.10 per Flow, one variable (2026-10-01):** "bring the ceiling down to $0.1 per flow max";
  "should be an easily configurable variable ... even for test purposes in the lab"; the product's user-facing
  spending limit is separate. Core reads `FLUXIQ_LLM_RUN_COST_CEILING_USD` (default 0.10, max 10, invalid stops
  Core); the Lab passes `--llm-cost-ceiling-usd`, then its env, then `.env`/`.env.local`. The tasks should finish in
  far fewer than 60 actions.
- **Every run step logged as files (2026-10-01):** exact provider request (no auth header), raw response, parsed
  decision, each tool call and result, the page text, under `test-runs/<run-id>/steps/NNNN-*/` (STEPS).
- **A build has three phases (2026-09-30):** live exploration authors the draft (no replay); test and judge once the
  model says ready; repair, finish, or "not doable" only if there is absolutely no way, with the reason.
- **Live runs:** four slots, one per lane; headed browsers only; only the ten realistic scenarios; started only by a
  live agent for a reason; stop at the first balance failure; a permission stop is never a pass; a failure is a
  product or Lab defect, never machine load; every debug reviews the UI from screenshots.
- **Validation cadence (2026-10-01):** merges take narrow checks only; full suites at most twice a day, in the
  background ("you should not be running a 15-30 min suite every single time you merge dev"). `pnpm task finish`
  runs the audit by default and the full check only with `--full-check`.
- **Live Lab trees are synced to dev before testing (2026-10-01):** "live testing labs need to actually be synced to main when
  you start testing them". After each merge round, merge dev into every lane tree (both repositories) and rebuild Core
  libraries and the extension; the Lab's behind-dev guard (t236) refuses a run whose checkout or Core lacks dev.
- **Process.** Lanes iterate on their own branches; the supervisor merges in rounds and is the only one who commits,
  merges or pushes. Heavy commands go through `build-slots/heavy.sh`. No LLM call grants.

**In flight. NO LIVE RUNS until every open row below is on dev (user, 2026-10-01: "you need to fix all these problems before running any more live tests").** Then merge dev into every lane tree, rebuild, and run (the Lab's behind-dev guard, t236, refuses a stale tree). Leads and workers cannot `git merge` (a hook refuses it): the supervisor merges dev into every tree.
| Problem (evidence: `lab-runs/2026-10-01/run-*/steps/`) | Fix | State |
| --- | --- | --- |
| Node catalog is 41,122 of 62,216 chars of every decide request | Names plus one-line description; full definitions on request; trim output schema and tool descriptions | t235 lead, open |
| No domain system prompt: the model is never told it operates a website for a person, what the view means, or the rules | Core seam for domain system instructions on every request; the web instructions | t237 lead, open |
| Superseded list reads kept whole (164,577 chars); absolute URLs 49,353 | Newest read whole, earlier as short outcomes; relative links | lane C, open (F40 rejected rows once: on dev) |
| Two cost counts; 8,000-token reply holds (real max 593 over 6,119 decisions); a purse per phase | One purse per Flow creation; decision reply allowance 2,000 | t234 lead, open (F41 cost endings: on dev) |
| Completion refusals for answerability and start location; judge request size; judge calls missing from the call count | Information, not refusal; measure and cut; agree the counts | lane D, open |
| `find_on_page` as site search; opening capture refused | F31 opens the start location with no model call; F32 empty finds name the site's search fields | on dev (t174) |
| Press under a popup; chat "hidden"; "Looking at the page" on every step; welcome screen | covered press names the close controls; chat says covered by a popup; describeCall headings; first screenshot after the send | on dev (t193) |

**Decided.** One purse per Flow: assigned to t234 (above).

**Open defects (not assigned).**
- `scripts/lab/core/build/tests/unbuilt.test.mjs` "refuses an unbuilt Core" fails about 1 run in 10 under load.
- A click that lands on a 429 page is still `navigation_unexpected` (F14 covers navigation only).
- `run-bench.ts` rebuilds a resumed evaluation without the stop label.
- The accepted result's `warnings` (F38) is not persisted; needs Core `runtime/service.ts`.

**Decisions made (supervisor; the user may override).**
- Robot checks: FluxIQ never presses or solves one (t197). Money, delete and send/publish ask every time (F10).
- D1: the dry run never clears site data or repeats a lasting effect.
- A press is refused only for a real layer (dialog, kind or front layer), not for anything that merely overlaps.
- An instruction column no field reads is information for the model and the judge, never a refusal (F38).
- `recovery-default-limits`: keep the 8-decision floor and reserve each call at a realistic cost, the ceiling being
  the hard stop.
- The judge gets per-condition removed-row counts (F19) and up to 60 screened characters of a condition's read (F14).

**Waiting on the user.**
- **Removing the remaining pre-action refusals.** The permission classifier refused the edit as a security weakening,
  so it was not worked around. The user must make it or allow it.
- **Workers committing on their own task branches.** Needs the brain's `hooks/worker-git-guard.mjs` changed; refused
  as self-modification.
- `fxwork/t187-bench` and `fxwork/t192-bench`: delete only on a yes.

**Next, in order.**
1. PV lands: commit it on dev with its own task id, verify a real recorded page (earbuds, bigbox) shows the search
   field and icon buttons.
2. Merge round: CEIL Lab, Core regressions, lane B, lane C, t227 follow-ups, STEPS; rebuild Core libraries; narrow
   checks; push both dev branches; merge dev into the lane trees.
3. Live runs through the chat launcher with step logs and the $0.10 ceiling, all four lanes; then the approved
   stronger-model comparison run on the same scenario.
4. The per-Flow purse lead. Full suites twice a day, in the background.

Older history: rung 1 is in `archive/rung1-history-to-2026-09-26.md`. The ledger to 2026-09-30 is in
`archive/ledger-2026-09-28-to-30.md` and the Work Ledger below.

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

### 2026-09-30 — Integration round 3 merged and pushed: the whole page, the three-phase build, the audit's fixes
- Agent: supervisor, with t191, t196, t200, t202-t214 and lanes A-D; each owner's claim re-run by the supervisor before
  its commit; conflicts resolved by the supervisor or by a worker it briefed (t196, t200).
- Changed: pushed Core `25c8b32f..37ff0989`, downstream `888386b0..4625fd99`. Regressions found and fixed on the way: lane
  B's store-failure pool read (t207), native nodes losing Flow inputs (t209, from lane D's de5d5bfa), the chat-build tests
  under t200's window rule (t214), t200's loss of the Lab artifact screen (t212), dev's stale Core dist hiding a bad import
  (now refused by the test scripts and `pnpm check`), the web taxonomy missing `onboarding`, and `evidence-loop/` over 25 files.
- Validation: on Core `e458f1ea` + docs `37ff0989`, downstream `a099165e`: `CORE_BUILD=0`, `CORE_CHECK=0`, `pnpm docs:check` ->
  "Deterministic framework reference is current." after regeneration; Core vitest runtime+storage+ui `4526 passed, 9 failed`,
  all nine 15 s timeouts in heavy service tests, no assertion failure; alone, `execution-digest` 4/4, `modes` 4/4, `flow-map`
  2/2, and four still time out at 15 s (run-detail-preservation, adaptive-loop auto-apply, instruction-readiness,
  subflow-pagination); web `1457 passed (1457)`; `DS_BUILD=0`, `DS_CHECK=0`; extension `# pass 1673 # fail 0`; domain
  `# pass 1057 # fail 0`; scenario-lab `# pass 620 # fail 0`; test-runner `# pass 1726 # fail 0`.
- Outcome: Pushed as a validated checkpoint with the heavy-service-test timeouts stated, not hidden; t215 owns their speed.
  t210 (the last caps: harness token defaults, the ranked 64-node catalog, the 512-address navigation memory) merges
  before live runs resume. Pass streak 0.

### 2026-09-30 — Handoff: round 3 pushed, t210 and t215 stopped mid-task, Codex tasks written
- Agent: supervisor. The user asked to wrap up in this window; t210 and t215 were told to stop and record their state.
- Changed: this document's Current State; `codex-tasks-2026-09-30.md` (five Codex tasks, pushed `ee704db7`);
  `reports/supervisor-2026-09-30-live-briefs.md` (pushed `4625fd99`). t210's branch holds rounds 1-2 committed and a
  resolved, uncommitted Core dev merge plus an unfinished round 3; t215 measured the slow service tests and changed no code.
- Validation: `node scripts/structure-audit.mjs` -> `structure-audit: passed` after `pnpm structure:baseline` (documents
  only; no code changed since the round-3 validation recorded above).
- Outcome: Handed off. Pass streak 0.

### 2026-09-30 night — Archived: t210 rounds 1-3b merged, every Lab stopped for the page view, the build-lock race
- Agent: supervisor, with t210, t215 and t222 workers and the four lane leads
- Full entries moved to [archive/ledger-2026-09-30-night.md](./language-driven-flow-loop-plan/archive/ledger-2026-09-30-night.md)
  on 2026-10-01 under the compaction threshold.
- What they settled: t210's last caps merged; the user rejected the raw 500 KB page and stopped every Lab; the compact
  format was approved; a Windows build-lock EPERM race was fixed in both repositories.
- Validation: recorded in each archived entry; nothing here is re-validated.
- Outcome: Accepted
- Follow-up: superseded by the entries below.

### 2026-10-01 — Integration round 4: t215, t222, Codex t216-t224, lane A F14; lane B-D fixes held for round 5; handoff
- Agent: supervisor, with the t222 and t215 workers, the lane leads t174/t193/t194/t195, the t223 lead, and Codex's
  branches. The user asked to stop for the day; the leads were told to stop and record their state.
- Changed:
  - **Merged into Core dev:** t221, t216, t217, t220, t224 (Codex), then t215.
    - Conflicts resolved by the supervisor: `llm-flow-bootstrap.md` took t217's every-ending text and kept t220's
      diagnostic paragraph; `evidence-loop-decision.ts` takes the union of the exact-key lists (`diagnostic` from t220,
      `clearedWait` from t216).
    - Two framework-reference regenerations.
  - **Merged into downstream dev:** t222, t221, t216, t217, t219, t220, t224, then t174 (lane A F14).
    - Conflicts resolved: `testing-facility.md` kept dev's current text plus t220's refusal-diagnostic paragraph;
      `navigate-action.test.ts` kept t216's cleared-wait test and t174's status tests.
  - **Import cycle fixed (Core `1e27fbd8`).** t220 made `llm/evidence-loop-decision.ts` import the evidence-loop barrel.
    That barrel loads `completion-attempt.ts`, which imports the decision module, so
    `automationStudioLlmEvidenceCompletionAttempt` was undefined. `completion-attempt.test.ts` failed on t220's own
    branch as well. The diagnostic screen moved to `llm/evidence-diagnostic/` with its own barrel.
  - **Lane fixes committed on their task branches, not merged:**
    - t193 W1, W2, C5-C7 (Core `a88e8dd9`, downstream `0521f377`);
    - t194 F17-F20 (`a96074dc`, `7b3db972`);
    - t195 P1-P2 (`b72fa8a1`, `78d166f2`).
  - Current State rewritten for the stop.
- Validation: every check below was run by the supervisor and its output observed.
  - **t222:** in its tree, `pnpm --filter @fluxiq-web-extension/scenario-lab test` -> `# tests 620 # pass 620 # fail
    0`; audit passed.
  - **t215:** in its tree, `npx tsc --noEmit -p .` EXIT=0; vitest over storage, database-manager, service-flows,
    summaries and service-adaptation (`--testTimeout=60000`) `Tests 433 passed (433)`.
    - After merging dev in: the full automation-studio and database-manager run gave `39 failed | 4662 passed`, all
      timeouts. The 22 files re-run with `--testTimeout=120000` gave `Tests 103 passed (103)`.
  - **Lane A F14:** in t174's tree, extension `# pass 1687 # fail 0`. On merged dev, extension `# pass 1709 # fail 0`.
  - **Lane C:** in t194's tree, Core tsc EXIT=0; vitest over llm, result-verification and summaries `Tests 1003
    passed (1003)`; domain 1063/0, extension 1678/0, test-runner 1729/0.
  - **Round 4 on main dev (core libs rebuilt):**
    - Core tsc EXIT=0; web check EXIT=0; web test EXIT=0; downstream build EXIT=0.
    - Core vitest over automation-studio and database-manager: `10 failed | 4725 passed`. On re-run with
      `--testTimeout=120000`, everything passed except `completion-attempt.test.ts` ("is not a function"). That was the
      import cycle.
    - After the fix, vitest over runtime/llm, flow-bootstrap and flow-bootstrap-commands: `Tests 1650 passed (1650)`.
      Core audit passed (2 baseline entries lowered); docs:check current.
    - Downstream test: extension 1709/0, domain 1066/0, scenario-lab 620/0, test-contracts 156/0, other packages 0
      failed.
    - test-runner first failed with TS2305 (`screenWebBuildRefusalDiagnostic`) on a stale domain dist that
      `domain-dist.mjs` never rebuilds. After `pnpm --filter @fluxiq-web-extension/domain build`: `# pass 1731 # fail 0`.
    - Downstream check's script tests: `not ok 72` (Lab `unbuilt.test.mjs`). It is intermittent: 1 of 3 alone on dev,
      then 0 of 6 on pre-round-4 code and 0 of 6 on round 4.
  - **Final full downstream `pnpm check`:** after the Core libraries were rebuilt and the index regenerated, `pnpm check` EXIT=0, `# pass 548 # fail 0`, "structure-audit: passed (136 warning(s), 118 baselined)", and all 10 package checks Done.
- Outcome: Pushed: Core dev to `1e27fbd8` and downstream dev with this entry. Open defects and the B1 decision are in Current State. Labs stay stopped for t223. Pass streak 0.

### 2026-10-01 — Integration round 5: lanes B-D, t225 compat fixes, t226 loop split; B1 decided; lanes re-dispatched
- Agent: supervisor; workers t225 and t226; t223 lead (phases A and B); lane leads A-D re-dispatched for fixes that need no Lab.
- Changed:
  - Merged into dev: t194 (lane C F17-F20), t193 (lane B W1, W2, C5-C7) and t195 (lane D P1-P2) in both repositories.
    - Conflicts resolved by the supervisor: the result reader keeps lane C's named checks plus t220's diagnostic; evidence-loop keeps lane B's held amendments plus lane C's codes; rejected-rows keeps both imports.
    - Fix `84766496`: the merge first dropped the `present` import.
  - Merged: t225 (`URL.canParse` replaced, with a guard test; test-runner rebuilds a stale domain dist) and Core t226 (`evidence-loop.ts` 802 to 731 lines).
  - t223: phase A (the diagnostic speaks `tN`) committed and round 5 merged into it. Phase B (wiring, search, describe, measurement) is running.
  - B1 is decided on the supervisor's recommendation: a request carries the current page in full, and each superseded page is replaced by the step outcome. Assigned to lane B.
- Validation:
  - Core: tsc EXIT=0; web check EXIT=0. vitest over automation-studio and database-manager gave `10 failed | 4781 passed`, all timeouts: the 8 files re-run with `--testTimeout=120000` gave `Tests 80 passed (80)`. t226 re-run: tsc 0; llm, flow-bootstrap and recovery 2154/2154; audit passed; docs:check current.
  - Downstream on the final Core (`f3778a8e`): domain build EXIT=0; `pnpm check` EXIT=0 with `# pass 548 # fail 0`, the structure audit passed and 10 package checks Done; `pnpm test` EXIT=0 (extension 1720, domain 1077, scenario-lab 620, test-contracts 156, the rest 0 failed); `pnpm build` EXIT=0.
- Outcome: pushed. Labs are still stopped for t223. Pass streak 0.

### 2026-10-01 evening — Root cause of the wandering runs found (the page view hid controls); the $0.10 ceiling is one variable
- Agent: supervisor; PV worker-high; CEIL workers (Core resolver, Core tests, Lab); lane C lead; Core-regressions worker-high.
- Changed:
  - Root cause, from the earbuds decision dump: the search box reached the model as a plain `field` named by its placeholder, icon-only buttons had no line, and the model ran `find_on_page "Voltbay"` 29 times with 0 matches. PV is fixing capture and the view in the main checkout; no live run until it lands.
  - CEIL Core, committed `fc26cfd6`: `FLUXIQ_LLM_RUN_COST_CEILING_USD` (default 0.10, max 10, invalid stops Core), `AUTOMATION_STUDIO_LLM_RUN_COST_CEILING_USD` and a new Flow's default take it; tests derive amounts from it. 18 of 21 tests the lower ceiling broke were updated to derive from it.
  - CEIL Lab (uncommitted): `packages/test-runner/src/live-llm/cost-ceiling-env.ts` passes the flag, env or `.env`/`.env.local` value to every Core the Lab starts.
  - Lane C F38 (Core `bf626777`) and F39 (downstream `5568dc7e`) committed on `task/t194-live-judge-answer`.
  - The three remaining Core failures went to `task/t229-core-regressions` (`fxwork/t229`): two fail the same at $0.25 (merge regressions, one a permission regression), and recovery reserves worst-case cost per call.
- Validation:
  - CEIL Core: `npx tsc --noEmit` exit 0; `run-cost-ceiling-env.test.ts` passes; with `FLUXIQ_LLM_RUN_COST_CEILING_USD=0.07` the old 0.1 assertions failed showing 0.07; automation-studio vitest `3 failed | 4946 passed | 1 skipped`; `node scripts/structure-audit.mjs` passed.
  - Lab: `cost-ceiling-env.test.ts` precedence tests pass (flag, env, `.env.local` over `.env`, unset, missing amount).
  - Lane C, re-run by the supervisor in `fxwork/t194/!FluxIQ/packages/fluxiq`: `npx vitest run` over result-verification, llm/harness-options and flow-bootstrap/authoring gave `Test Files 36 passed (36)`, `Tests 370 passed (370)`; structure audit rc 0 in both repositories.
- Outcome: Core dev is one commit ahead of origin, held for the merge round. Pass streak 0.

### 2026-10-01 night — Integration round 9 pushed: page view shows every control (t232), step logs (t228), ceiling Lab side, lanes B and C, t227; live runs resumed
- Agent: supervisor; lane leads A-D; workers PV, PV-docs, CEIL Lab, Core regressions (t229), model knob (t233).
- Changed:
  - Merged into dev in both repositories: t232 (PV, committed on its own branch so its id is reserved), t228 (step logs), t193 (lane B: observation-only repeat guard, opener kept, `type` with `submit`, `web.target.not_actionable` so repair may answer a hidden/covered/disabled target), t194 (lane C F32-F39), t227 (chat display fixes), and the CEIL Lab commit `3d3020a6`.
  - Conflicts resolved by the supervisor: `environment.ts` passes both the ceiling and `FLUXIQ_LLM_STEP_LOG_DIR`; `testing-facility.md` keeps both new sections. t227's `assertChatBuildable` compared the plan to the Core constant loaded in the Lab's own process, so a raised `--llm-cost-ceiling-usd` would have refused every chat build: the plan now records `buildCostCeilingUsd` (the ceiling its Core was started with) and the check uses it, with a new test for the raised case.
  - Post-merge test fixes: Core `action-of.test.ts` (an event field the type does not declare); extension `type-unsent-form.test.ts` (`status?: string | undefined`).
  - Lane D F41-F43 committed on `task/t195-live-control-flow` (Core `4f78cadc`, downstream `016dea39`); merging dev into it left 7 Core conflicts, which its lead is resolving.
  - Lanes A, B and C fast-forwarded to dev and sent on live runs (crossborder slot-1, bigbox slot-2, earbuds slot-3), headed, from the chat, at $0.10, up to 3 runs each.
  - t233 opened: `FLUXIQ_LLM_DEFAULT_MODEL`, so the approved `deepseek-v4-pro` comparison can start from the chat (today the chat check refuses any non-default model).
- Validation:
  - PV (supervisor): `pnpm --filter @fluxiq-web-extension/domain check` rc 0; extension check rc 0; `pnpm test:content -- page-view-controls --headed` `12 passed (1.5m)`.
  - Core after the merges: `npx tsc --noEmit -p .` rc 0 after the test fix; vitest over runtime/llm, flow-draft, flow-bootstrap, result-verification, activity, tests/service-bootstrap and src/ui `Test Files 232 passed (232)`, `Tests 2446 passed (2446)`; structure audit passed; reference regenerated.
  - Downstream after the merges (Core libraries rebuilt): test-runner `# tests 1781 # pass 1781 # fail 0`; domain check rc 0; domain tests `# tests 1241 # pass 1241 # fail 0`; extension check rc 0 after the test fix; extension tests `# tests 2297 # pass 2297 # fail 0`; structure audit passed.
- Outcome: pushed Core dev `b369ca14` and downstream dev `ff175763`. Known on dev: the 3 Core failures t229 is fixing. Pass streak 0.

### 2026-10-01 night — First live runs after round 9: every build stops at the $0.10 ceiling with a partial Flow
- Agent: supervisor; lanes A-C running.
- Changed: nothing in code; findings recorded for the lanes and the per-Flow purse task.
  - The page view is confirmed on a real loaded extension: bigbox `t11 field[search] "Search" placeholder "…"` and `t12 button "Search"`; earbuds `t17 field[search] "Search Brightaisle"` and `t18 button "Go"`; crossborder `t489 field[search] placeholder "Autumn Mega Sale…"`.
  - Runs: bigbox `run-muqbzqtu-4e6299f9` (22 decisions, $0.0772, 3 of 6 asks stepped); earbuds `run-muqbzu32-8691a65e` (15 decisions, $0.0738, ended mid-amendment); crossborder `run-muqc07fh-eeffbc86` (25 decisions, $0.0774, 4 of 5 asks, "Space Grey" missing). All `lab.chat_build_failed` at the spending limit.
  - Every chat build: step 0002, Core's read-only opening capture `initial.core.run_node`, is refused `not_at_start_location` while the screenshot shows the tab at that exact address (assigned to lane A).
  - Crossborder: seven `find_on_page` calls for "Voltbay" on the home page (0 matches; the observation guard refused two), the model using a page search as a site search (lane A).
  - Each build stopped about $0.023 short: the purse holds each call's worst case (every input token uncached at peak rates plus an 8,000-token reply). Measured over 63 decisions: reply tokens median 90, max 515; prompt average 25,393, max 72,677 (earbuds amendments), cache-hit share 0.55. Inputs to the per-Flow purse task: size the decision reply allowance to use (about 2,000), and stop prompt growth during amendments.
- Validation: read from `C:/Users/osrs_/FluxStuff/lab-runs/2026-10-01/<run>/steps/` (index.md, page.txt, decision.json, response.json usage) and each run's `summary.json` `firstFailure`.
- Outcome: lanes A-C debugging, up to two more runs each. Pass streak 0.

### 2026-10-01 late — Rounds 10-12: lanes A-D, t229, t233, t236 merged; the user's fix list before any live run
- Agent: supervisor; lanes A-D; t229, t233, t236 workers; leads t234, t235, t237.
- Changed:
  - Merged into dev in both repositories: t195 (lane D F41-F43: the completion check informs and the judge decides), t229 (a person's standing no stops recovery's repair), t233 (`FLUXIQ_LLM_DEFAULT_MODEL`), t236 (the Lab refuses a live run whose checkout or Core lacks dev), t194 F40-F41, t174 F31-F32, t193 L1, OP2, CV, PW, CW, WB.
  - Conflicts resolved by the supervisor: `phases.ts` (lane D's `phase2` with lane C's `costSpending`), `service.ts` (lane D's judge wiring with lane B's `describeCall`), domain `tools.ts` imports (union), the generated framework reference (regenerated).
  - The user ordered no live runs until the fix list lands, and that lab trees are synced to dev before testing (memory and binding rule). The user found the catalog bloat and the missing domain system prompt; t235 and t237 own them.
  - Leads cannot run `git merge` (hook), so the supervisor merges dev into every tree: t234 merged; t194, t195 (Core) and t235 are mid-edit and merge at their report.
- Validation:
  - Core dev after rounds 11-12: `npx tsc --noEmit -p .` rc 0; vitest over llm, flow-bootstrap, flow-draft, activity, route-state, tests/service-bootstrap, result-verification, recovery and src/ui `Test Files 283 passed (283)`, `Tests 3089 passed (3089)`; structure audit passed; `docs-reference.mjs --check` current.
  - Downstream after rebuilding Core libraries: domain check rc 0; extension check rc 0; domain `# tests 1261 # pass 1261 # fail 0`; extension `# tests 2309 # pass 2309 # fail 0`; test-runner `# tests 1785 # pass 1785 # fail 0`; structure audit passed.
- Outcome: pushed (see the push line in the commit log). Pass streak 0; live runs on hold by the user's order.

## Open Questions

- Which complex scenario goes first? `everything-store` is the known multi-step
  case that has never worked, which argues for it; a scenario that fails later
  in the chain would teach more per run. Settled by the scenario inventory.
- Does the corpus have enough qualifying tasks, or does Phase 1 author new ones?
  Settled by the scenario inventory.
- When a run's failure is in Core and in the extension at once, which side is
  fixed first? Owned by the supervisor, settled per run by which failure is
  earlier in the chain.
