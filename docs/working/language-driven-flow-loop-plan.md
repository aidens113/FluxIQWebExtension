# Language-Driven Flow Loop

Status: Active
Status detail: Labs stopped by the user for merge and audit (2026-09-30 ~19:20); integration round 3 nearly done, with five fix tasks open before a full validation, a push and supervised live runs; no working Flow yet (pass streak 0).
Created: 2026-09-24
Last updated: 2026-09-30
Owner: Senior supervisor agent
Scope: Reaching the MVP goal — a person's instruction becomes a Flow, that Flow runs deterministically, repairs itself when it breaks, and judges its own answer — by running several complex, multi-node live scenarios in parallel lanes, debugging every run end to end, fixing every cause it exposes, and re-running that same scenario until it works. It deliberately does not cover corpus-wide campaigns, pass-count measurement, single-node extraction tasks, recorded Flows, or any surface that does not block this loop.
Paired document: none
Related: [flow-authoring-and-defensive-runtime-plan.md](./flow-authoring-and-defensive-runtime-plan.md) (the design backlog this loop draws fixes from), [first-class-data-extraction-plan.md](./first-class-data-extraction-plan.md), [MVP agent instructions](../../MVP_AGENT_INSTRUCTIONS.md)

---

## Current State

**Labs stopped by the user (~19:20 PDT); integration round 3 nearly done. Read this first.** No Lab may run until the open
tasks below merge, dev validates in full, and both dev branches are pushed; then supervised live runs resume on the new
build with fresh lead briefs built from the audit's fix table. Afternoon live spend before the stop: $0.357 over five runs,
all failed (ledger), plus lane C's run killed at the stop. The four audits and their fix table are in "The 2026-09-30 Audit
And Its Fixes" below.

History, in the Work Ledger: the overnight $9.46 of unattended relaunch loops and the balance stop (2026-09-30 "Stopped"); this
afternoon's resume, where t193's `loop2.sh` was found still running and killed (kill the process tree and re-scan; renaming a
running script does not stop it).

**Binding rules (user, all in force).**
- **The model sees the whole page (user, 2026-09-30, after watching a run spend 53 s trying steps and fail with no repair):**
  "Remove ANY AND ALL LIMITS ON THE NUMBER OF ELEMENTS PASSED TO MODEL. DO NOT HIDE INFORMATION OR USE ANY RANKING
  ALGORITHM." No element caps, top-N, ranking, byte budgets that drop elements, or withheld summaries anywhere from the DOM
  capture to the model; a page too big for the context window fails loudly with its size. Secret screening and the $0.25
  per-build spend ceiling stay. Owned by t200 (`lead-xhigh`, `fxwork/t200`, Core-paired).
- **A build has three phases (user, 2026-09-30, after watching builds restart the Flow from the beginning and replay it
  over and over):** (1) live exploration plus drafting of the Flow in real time, with no replay from the first step and
  no return to the start location mid-build. The draft is authored, not recorded: "IT SHOULD NOT JUST BLINDLY ADD EACH
  STEP THAT IT TOOK ONE BY ONE IN ORDER. IT SHOULD ONLY ADD STEPS IN A WAY THAT MAKE AN INTELLIGENT FLOW!" No dead ends,
  failed attempts, exploratory looks or redundant actions; loops for repeated work, branches for sometimes-present
  interruptions, targets that survive a re-run; any automatic keeping of executed steps is a gap (t196). The user on the
  boundary: "IT REPLAYS IT FROM THE START DURING THE JUDGEMENT PHASE. JUST NOT DURING EXPLORATION/INITIAL BUILD." and "or
  during repair phase directly": replay from the start is allowed in judgement and in repair, never in exploration; (2) once the model says the Flow is ready, test the Flow and judge its
  result; (3) repair it, or declare it finished, or, "ONLY IF THERE IS ABSOLUTELY NO WAY TO ACHIEVE IT", declare it not
  doable and say why. Removing the mid-build replays (dry-run gate, draft rerun, verify-only) is owned by t196;
  lane A's Core `flow-draft/dry-run.ts` and `verify-only.ts` are replaced by t196's change at integration.
- Four live Lab slots, `lab-slots/slot-1..4`, one per live lane, no queueing between them; `ui-1` is for provider-free UI runs.
  Headed browsers only, and only the ten realistic scenarios.
- A live run is started only by a live agent, for a reason (a fix to test). No keepers, relaunch loops or cron. No hard spend
  budget (the user's choice), but everything stops at the first balance failure, and spend is reported from the ledger.
- A pass means a working Flow that did the task. A permission stop with `flowCreated=false` is not a pass.
- A live-run failure is a product or Lab defect, never "machine load"; trace the step and its regression.
- Every debug reviews the UI from screenshots (the Full Debug Protocol below).
- Lanes iterate on their own branches; the supervisor merges in integration rounds. Leads coordinate through each other's fix
  logs, and the first lane to record a cause owns it.
- Only the supervisor commits, merges or pushes. Heavy commands go through
  `bash C:/Users/osrs_/FluxStuff/build-slots/heavy.sh "<lane> <what>" <cmd>` (4 build slots). No LLM call grants.
- Extension UI (user): no Simple/Advanced modes and no split screen. Chat is the primary tab and gets the whole panel. A second
  tab lists automations. Settings live behind a gear. A full-screen getting-started view appears when not connected or
  something is critical. A link opens the Core panel, which owns everything else and so must look good too.
  The chat (user, 2026-09-30): every step is its own message with the model's reasoning, never a few steps behind a
  dropdown; and each action shows as a proper card with an icon for its kind, what it acted on, and its outcome, using the
  card and icon styles the importing repository or Core already defines.

**On dev (round 3, local; last pushed Core `25c8b32f`, downstream `888386b0`).** Merged after each owner's validation was
re-run by the supervisor: lanes A-D (t174, t193, t194, t195) with their final fixes; t191 (the chat-first UI, every step a
message with the model's reason, action cards with icons, one resolved event per ask); t196 (the authored draft, the
instructed-act checklist, progress means the Flow advanced, replays only in judgement and repair, no forced start); t200 (the
whole page, every frame and shadow root, no caps or ranking, covering layers flagged); t208 (a build never just ends: test,
judge, repair rounds; `not_doable` with a reason; `evidence_budget_exhausted` with what was tried); t197, t198, t201-t207,
t209, t212, t213. Last full validation (Core `fd2f7e6b`, downstream `ab9a352b`): Core build and check 0; web 1448/1448;
downstream build and check 0; extension 1662/1662; domain 1038/1038; scenario-lab 620/620; test-runner 1713/1716 (the 3 fixed
by t212, merged after); Core vitest 4395/4406 with the failures assigned below.

**Honest results.** No task has produced a working Flow end to end, and the real pass streak is 0. The audits found why
(A1: 57 of 117 builds ended with no Flow); the merged fixes address the top causes, none proven live yet.

**The Lab's guards and the honest verdict are on dev.** A live run is refused before any model call when
`lab-slots/STOP-balance` exists, when the previous run failed on unchanged source, when the previous run has no debug file, or
when an instance starts a 4th run in 30 minutes; overrides are user-created `lab-slots/OVERRIDE-<rule>` files only.
`lab-slots/spend-ledger.jsonl` records cost for reporting and is proven on real runs. A permission stop is
`stopped_for_permission`, never a pass, in the runner, the campaign rows, the totals and the bench (`f2f80024`, t199 `39e11fd8`).
Left open: `run-bench.ts` rebuilds a resumed evaluation without the stop label.

**Open tasks (each in its own worktree `fxwork/<t>/`; reports under `language-driven-flow-loop-plan/reports/`).**

| Task | What | Status |
| --- | --- | --- |
| t191 | the resolved-ask events `waited_out` (a check that clears itself) and `cancelled` for an abandoned parked wait | in progress |
| t206 | a run whose start throws leaves the operation lease held (`failed-start.test.ts` hangs); speed up scale-pages and the million-event stream test | in progress |
| t210 | remove the remaining caps: Core's `maxTokensPerRun: 12000` default (with migration), F14's read-account caps, lane C's rejected-row samples (3 rows, 80 chars), and any lane cap merged after t200 | in progress |
| t211 | an unreadable model reply is retried with a note, never a bare `evidence_invalid_decision`; root-cause the malformed replies (F16 cases) | in progress |
| t214 | the extension chat's build path produces no adaptation (`extension-chat.test.ts`, a regression from the lifecycle merges); three `deepseek-bootstrap-exploration` ending tests against t208's endings | in progress |

The t191 screenshot defects 1-9 are fixed in code (round 2), not yet re-shot in a browser.

**Decisions made (supervisor; the user may override).**
- Robot checks: FluxIQ never presses or solves one (t197).
- F10: money, delete and send/publish ask every time, even when instructed (`mvp-today-plan.md:150`).
- D1 (the dry run): never clear site data or log the person out; never repeat a lasting effect; verify a mutating step (target
  actionable, or its effect already present) rather than re-execute it (t196).
- withdraw-stale-requests declares `permissionPoint: delete @ Withdraw`, never `--llm-permit`.
- Declined: keeping SQLite pools open while idle, which would change the product for the sake of test speed.
- The Click node's description keeps no site-specific "click again" advice (reverted).
- Lane C F14 (the judge sees the value a condition read): Core's run record keeps up to 60 characters of page text per
  condition, because the judge needs it; it is screened wherever it leaves Core (run bundles, logs), per w15's projection
  change. A recorded click from Core's recording fallback gets the same check allowance, closed in the domain mapper (t203).
- t191 D9 (accepted): the activity stream carries the model's own reason for each step, in its words about the page,
  bounded and screened for token-shaped text (`activity/wording/reason-text.ts`), because the user wants every step shown
  with its thought process; the client-gateway wire shape is unchanged.

**Waiting on the user.**
- Decided 2026-09-30: the user accepted t198's security change. Offered, not built: requiring confirmation in the Core panel
  before a chat "yes" applies a change (a stolen pairing token could otherwise apply one while the person is signed in).
- `fxwork/t187-bench` and `fxwork/t192-bench`: build-timing copies from t187 and t192, not used by anything; delete only on a yes.
- The robot-check decision stands unless the user overrides it.
- Standing rule (user): stop orphaned Labs and dead agents' loops yourself and report it; never ask (t191's interactive Lab
  was stopped at ~19:03).

**Next, in order.**
1. Verify and merge t214, t206, t210, t211 and t191 as each hands back (the supervisor re-runs each claim first).
2. One full validation of dev in both repositories (Core build, check, runtime+storage+ui vitest, web vitest; downstream build,
   check, extension, domain, scenario-lab, test-runner), then push both dev branches together.
3. Live runs resume, supervised: four `lead-xhigh` leads on slots 1-4, briefed from the audit fix table and the binding rules,
   on the ten realistic scenarios; every run debugged with the screenshot UI review; stop at the first balance failure.

Older history: rung 1 in `archive/rung1-history-to-2026-09-26.md`; tonight's rounds in the Work Ledger (2026-09-29 entries).

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
- t187 merged and pushed (`4afa80fc`), answering the user's question of why builds became slow. The code grew about four times in three weeks (Core `packages/fluxiq/src` 386 to 1,479 files) while every build started clean, and September added redundant builds: four Lab builds per run, test-contracts built twice, a full build in `task start`, a serial `pnpm check` in `task finish`, and `coreHead` in the Core web build key. Now every package build and check is reused when its content fingerprint and output digest match. Lead, before to after with nothing changed: `pnpm build` 82.6 s to 4.5 s, `pnpm check` 181 s to 34 s, the finish check 314 s to 36 s, the Lab prelude 81 s to 7 s. Supervisor on the merged tree: first build 52 s; repeat 5 s with 11 of 11 reused; after a `domain/src` edit exactly domain, extension and test-runner rebuilt (35 s); after the revert 11 of 11 reused (7 s); `pnpm check` exit 0; `pnpm task finish t187` 40 s in total. Core's own build (162 s) is untouched; t187's proposal for it needs a paired Core branch.
- Integration round 1 (four live lanes, iterating on their own branches): t196, t191 (round 1), t174 (A), t193 (B) and t195 (D) merged into dev in both repositories; t194 (C) joins when ready. Conflicts were `run-scenario.ts` hooks (t174's UI review, t193's window capture, and the lanes' hand-applied copies of t174's older lines): both hooks were kept and the imports unioned, with `tsc --noEmit` 0 and the audit passing after each. On the merged dev: Core `pnpm check` 0 (82 s), downstream `pnpm check` 0 (106 s), and the vitest of flow-bootstrap, service-bootstrap and llm at 841 passed, 6 failed. The 6 are all in `rejections.test.ts`, where t174's thrown-issue-codes tag typed refusals; the push of dev is held until t174 fixes it. No task has passed twice yet: A run 18 built a 9-node bigbox Flow blocked by the consent wall (t195 F1 is now in); D run 6 built the first real loop (For Each, per-row Confirm, rate limit waited out).
- The Flow builder, traced from the code (`reports/flow-builder-walkthrough.md`), is 25 steps. It found five disagreements: the extension chat cannot start a build (capabilities `[]`; the executor lives only in the web panel), assigned to new lane t198; send/publish is not gated (only money and delete, since 2026-09-28), so t195 is fixing it per `mvp-today-plan.md:150`; a build's real cost bound is $1-$2 and the $0.25 per-call cap is never enforced, so t193 is making $0.25 the enforced build total; a route-state full capture still runs before most decisions, so t196 is removing it; and the panel sends no start location, which stays by design.
- Round 1 finished and pushed (Core `838667e9`, downstream `6e6a5a28`): t174's rejections fix (`e75dcf29`: `thrown.*` codes only on unrecognised throws) and t194 (C) merged too. Final verification on the merged dev: Core `pnpm check` 0 (245 s), Core build 0, downstream `pnpm check` 0 (335 s), domain `# pass 948 # fail 0`, extension `# pass 1348 # fail 0`, and Core vitest (flow-bootstrap, service-bootstrap, llm) 1,529 of 1,536. The 7 failures are all `Test timed out in 15000ms` (plus one EBUSY on a SQLite `-shm`) in `runtime/tests/service-bootstrap`, with no assertion failures. Alone at one worker, that directory gave a different 3 timeouts and took 673 s, so the tests run too close to their limit. That is assigned to the t192 lead as test speed, not a raised timeout. Rung-1 first: run 4 reached refute, re-author, applied and re-run.
- t192 merged and pushed: Core's build and check reuse unchanged steps. On the merged dev, a repeat `pnpm build` reused all 4 steps in about 4.1 s of step time (contracts 464 ms, fluxiq 1,538 ms, gateway 509 ms, web 1,618 ms); Core `pnpm check` 0 (136 s); downstream `pnpm check` 0 (174 s).
- Robot checks (`reports/robot-check-behaviour.md`): the "refresh" the user saw was FluxIQ's own same-address navigations (`chrome.tabs.reload`) onto a robot-check page that reported success. Decision (supervisor, user may override): FluxIQ never presses or solves a check; a self-clearing check is waited out; any other check pauses, asks the person, and resumes, with the Lab playing the person. New lane t197.
- Held for t186: t174's run-4 reservation of three calls for the grant (`loop-limits/flow-bootstrap-evidence-loop.ts`, `llm/resolver-contract.ts`) fails 4 tests in `deepseek-bootstrap-exploration.test.ts`. The lead's git restore of those files to `259a11b` was refused by its permission check. The supervisor did not do it on its behalf; the files are resolved when t186 removes grants.
- Outcome: In progress. Pass streak 0.

### 2026-09-30 — Stopped: the DeepSeek balance ran out, unsupervised relaunch loops were killed, and this handoff
- Agent: supervisor. Changed: dev pushed at Core `f4feb028`, downstream `379763fb`. Integration round 2 merged t174 (A), t193 (B), t195 (D), t192 (the Core build cache), t196 (route state from each call), t197 (robot-check hand-off) and t198 (the extension chat builds). The Click node's site-specific "click again" sentence was reverted (it broke the domain catalog-budget test, and it had no effect live). The lead agents all ended on a Claude session limit at about 04:00; launcher loops then relaunched live runs with nobody debugging. The supervisor killed every live `run-lab`, launcher and loop process at 10:22 and renamed the scratchpad's `live-run*.sh`, `t193/loop*.sh` to `*.disabled`.
- Validation: the round-2 dev check (`pnpm build`, `pnpm check` and vitest of llm, flow-bootstrap, recovery, action-permissions and flow-draft in Core; `pnpm build`, `pnpm check` and the domain and extension tests downstream) printed `CORE_BUILD=0`, `CORE_CHECK=0`, `CORE_VITEST=0 Tests 2075 passed (2075)`, `DS_BUILD=0`, `DS_CHECK=0`, `EXT=0 # pass 1452 # fail 0`, and a domain load failure (`src/tests/domain.test.ts`: `missingRequiredTerms` `['end']`) that was traced to the Click description; after the revert, `pnpm --filter @fluxiq-web-extension/domain test` -> `# pass 976 # fail 0`. Spend, from each run's `snapshots/live-llm.json` `observed.totalEstimatedCostUsd`: `{"realRunsWithSpend":112,"totalUsd":9.46,"byLane":{"t174":3.86,"t193":2.65,"t194":0.25,"t195":2.7},"lastSpendingRunUtc":"2026-09-30T12:18:40.705Z"}`; split before and after 11:00Z: `{"before0400local":{"runs":65,"usd":5.21},"after0400local":{"runs":47,"usd":4.25}}`. Lane D's 12 "passed" runs have `evaluation.json` `flowCreated=false` (permission stops), so the real pass streak is 0. Not run: any check of the lane trees' uncommitted work (listed in Current State), and the two in-flight workers (Lab spend guards; the honest pass verdict), which were still editing when this was written.
- Outcome: Stopped for handoff. No live run may start until the guards are merged, a budget is set and DeepSeek is topped up. Pass streak 0.

### 2026-09-30 — Resumed: a live relaunch loop found still running, every lane committed and rebased, ten agents dispatched
- Agent: supervisor. The user topped up DeepSeek and said go.
- Found: t193's `scratchpad/t193/loop2.sh` still running as bash PID 23332, from 03:06. The morning's rename to `*.disabled` had
  not stopped it. Killed with the user's explicit permission, after the permission check refused the supervisor's own attempt.
  Also found: t191's provider-free interactive Lab still running (PIDs 26548, 7468, 1764), left for the user; and stale slot owner
  files, whose removal the permission check refused.
- Changed: a WIP commit of each lane tree's uncommitted work on its own task branch, then dev merged in; hashes and conflicts are
  in the Current State table. New task t199 (`pnpm task start honest-pass-followups --worktree`, 2 min 46 s).
- Validation: `taskkill //PID 23332 //T //F` -> `SUCCESS: The process with PID 23332 (child process of PID 9144) has been
  terminated.`; a re-scan of process command lines for `loop\d?\.sh|live-run|lab:campaign|live-campaign|run-lab` found only
  t191's interactive Lab. The guards' admission code (`scripts/lab/live-guards/admit-live-run.mjs`, `rules/debug.mjs`,
  `rules/unchanged.mjs`) finds a previous run only in `lab-slots/spend-ledger.jsonl`, which does not exist yet, so each lane's
  first run is admitted and the debug and unchanged rules bind from then on. No lane work validated yet.
- Merges committed after each lead staged its resolution: t194 downstream `0d5b62c4`, t191 downstream `2faa7dc5` (with one
  extra staged test, `panel/chat/conversation/tests/ask-copy.test.ts`), t174 Core `4e42d7ef`. The t174 merge also carries eight
  of the lead's own staged edits beyond the merge (`flow-draft/dry-run.ts`, `flow-draft/verify-only.ts` and its test,
  `decision-handlers/completion.ts`, and others), the lead's resolution of the `dry-run-gate.ts` conflict; reconcile them with
  t196's dry-run design at integration.
- Outcome: In progress. Pass streak 0.

### 2026-09-30 — Integration round 3 begun, the user's four orders, and Labs stopped for merge and audit
- Agent: supervisor.
- User orders, each recorded in Binding rules and in memory: the whole page to the model (t200); the three-phase build with an
  authored draft and replays only in judgement and repair (t196); every chat step its own message with the model's reasoning
  (t191); stop orphaned Labs without asking. At ~19:20: stop all Labs, merge everything, then audit and fix.
- Changed: dev merged t191 round 2 (ds `1c48605b`, Core `9d343d3b`) and t198 (`9d3461a3`, the user accepted its security
  change); dev merged into lanes A and B (both repositories) and D's Core; D's downstream merge was refused (its uncommitted
  `lane.ts`, `permission-point.test.ts` and report overlap dev) and aborted. Committed on branches after re-running each
  claim: t174 `ab3b1381` (domain 983/983) and Core `c013b547` (9/9); t191 `106b86f1` (extension 1480/1480); t192 Core
  `9515d875` (22/23, the one failure pre-existing); t194 `0f412b99` (debugs); t197 `5888524e` (domain 985/985); t198
  `f5cc4b41`. New tasks: t200 (whole page), t201 (dev's red tests).
- Validation: merged dev (`bash heavy.sh ...`): `CORE_BUILD=0`, `CORE_CHECK=0`; Core vitest activity/executor/conversations
  `1 failed | 406 passed`, the failure `conversations/commands/tests/execute.test.ts` pre-existing (fails identically at
  `f4feb028`, 9/10); Core web conversation vitest `3 failed | 214 passed`: `registry.test.ts` pinned the old two asking
  classes (Core's `destructive.ts` gates three since the user's rule), updated to three -> `Tests 11 passed (11)`, and two
  `core-contract.test.ts` 5 s timeouts, re-run alone; `DS_BUILD=0`; `DS_CHECK=1` only on this document's Current State budget
  and index (fixed here); extension `# pass 1484 # fail 0`; domain `# pass 976 # fail 0`. Also pre-existing on dev:
  test-runner `runner-wiring.test.ts` and `demo-workspace.test.ts` (34/36 at dev and on t198), Core
  `service-bootstrap/tests/permission.test.ts` (lane D). t201 owns the first three.
- Outcome: In progress. Pass streak 0.

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

## Open Questions

- Which complex scenario goes first? `everything-store` is the known multi-step
  case that has never worked, which argues for it; a scenario that fails later
  in the chain would teach more per run. Settled by the scenario inventory.
- Does the corpus have enough qualifying tasks, or does Phase 1 author new ones?
  Settled by the scenario inventory.
- When a run's failure is in Core and in the extension at once, which side is
  fixed first? Owned by the supervisor, settled per run by which failure is
  earlier in the chain.
