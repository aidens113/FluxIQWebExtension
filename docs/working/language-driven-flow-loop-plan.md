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

**2026-10-02 (supervisor session).** `output_not_observed` was the label of a refuted result filed against the last
step that worked; behind it in run 38 was **C1**: Core's `isJsonValue` refused every list read that returned a row as
`evidence_not_json` (since `01082bc9`). Landed and pushed today, each verified by the supervisor on the lane's tree and
again after merging dev in: t234 (one purse per Flow); t239 (judge reply cap, C7); t240 (repair rounds bounded by money
and measured progress, C7, C8); t241 (a repair round opens with a look where the test left the page); t242 (skips reach
the run detail and the Lab); t243 (**global Core state routing**: a step that cannot run continues where the page is,
before the ladder, failing on the fourth return to one node without progress; with the t242 x t243 skip-type fix);
t245 (sweep 1's Core failures); and two rounds of each lane: A (F33, F35, F37-F42, F44), B (chat cards, the draft's
`does`, rerun put-back, do-only repair, overlay never a dot), C (alone rows, replay read account, `at` handles, a
replayed read's rows to the judge, earlier-page repeats, run.json invocation, call accounting; merged as t194 with
lane B's rerun put-back, the put-back note naming the steps done again), D (C1, C3-C5, R2, R3). **Open:** unify
`control` and `does` (a draft line shows `control` only without `does`).

**Sweep 1** (Core `2bc0baac`, downstream `76a9eede`): Core 4 failed | 5,979 passed (fixed by t245); downstream
`pnpm check`, `pnpm test`, `pnpm build` rc 0. Core's web app never ran: `pnpm -r test` stopped at the first failing
package (t247 made it `--no-bail`).

**Live round 1002-L, held:** launched before t243 (the supervisor's mistake) and held after lane D's one run
(`run-murdouox-c5294247`, $0.0562, stage 4, no Flow), which proved C1, C2, C3 with t241 and C8 with t240 live. Leads
A-C spent $0. It resumes after t244 lands and the lane trees are re-synced.

**Two sessions share the dev queue:** this session landed t193 and t194 (Core `3d98efcb`); session
`fluxiqwebextension-8d` lands t244, t246, t247-t250 and re-syncs the lane trees, with a "merging tNNN" / "tNNN done"
handshake in both repositories; neither starts while the other holds dev.

**Landed by session 8d (2026-10-02 evening), each verified after merging dev in; Core dev `424a70b3`, local downstream
dev `5b79cda3`:**
- t247 (Core `pnpm test` is `--no-bail`; ProjectTree split; settings cost default $0.10). t248 (the Lab reads a
  `state_routed` skip; the existing/clone path writes skips as `skipped`; bigbox store-remembered row).
- t244 (`core.run_flow` part runs; a build or re-author finishes only on a judged yes about the Flow as it stands).
  Dev merged through t193 and t194; overlaps fixed: rerun put-back wording, no step numbers on part-run cards, the
  evidence loop's tool set moved to `node-tools/loop-tools.ts` (801 lines). Validation: 146 touched test files pass;
  downstream domain/extension/test-runner typecheck against it; Core finish gate passed.
- t250 (run detail carries `stateRouting`; the Lab's steps/ say what routing consulted; stale $0.25 gone, the repair
  default follows the ceiling), plus hotfix `bdc459dd`: t250's import closed a module cycle
  (`unattended-retry-verification` 8/8 failing on dev), now read from `model/run-cost-ceiling`.
- t246 (project database idle grace 1 s, opens 403 -> 19, four races fixed; downstream service tests close first).
- t249 (a runtime patch reaches the stored Flow only after the run that tried it ran whole from the start and was
  judged `answers`; a completed trial is that run; a refuted result's ladder patch is re-run whole and judged;
  thrown/parked runs settle `run_errored`/`run_parked`; executor `stopAfterNodeId`). Validation: 131 test files pass.
- Downstream push: lane C's commit `c56b8cfb` had a DeepSeek-shaped fake key; the user approved a fake. The unpushed
  commits on dev, t194 and t244 were rewritten to `sk-FAKE-test-value-not-a-real-key` (checked not the real key, not
  key-shaped; test 5/5). **The push was refused by the permission classifier; the user must push downstream dev.**
- Follow-ups: a recovery-stage part-run tool on `stopAfterNodeId`; the reroute edge mismatch (trial `success` vs
  durable `failed`); `$0.25` left in `refuted-result-port.ts` and `repair-authority.ts`; web Adaptations view shows
  no `applied`/`notAppliedReason`.

Task ids: the task tool numbers branches; labels like PV, CEIL and STEPS name older work without a branch of its own.

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
- **A Flow run routes by page state, not build order (2026-10-01):** "runtime is supposed to have auto recovery and
  state! ... it failed because there was a popup that didnt show up in test run. The runtime should have fallen back to
  state check & realize that it should go to the proper node where there is no popup." An absent sometimes-present step
  is skipped by observing state, never a failure; the Lab records each runtime step (no "step unknown").
  **Widened 2026-10-02 into a global Core runtime rule:** "that same thing should apply to THE ENTIRE RUNTIME! if a
  step isnt avaialble, it should use state to find current step. Of course if it keeps looping back to the same step
  and not progressing enough times, it should count as failed"; "that rule is supposed to be a GLOBAL runtime thing of
  core". Owned by t243.
- **Partial test runs, one full judged run (2026-10-02):** "the repair loop/general LLM should be able to run from a
  certain node to only test parts hte flow. One thing thouhg, it must test the entire flow & have that judged success
  at least one time". A build or repair finishes only after a whole-Flow run from its start was judged successful on
  the Flow as it finally stands. Owned by t244.
- **A live round waits for every agreed change (2026-10-02):** the round launched before t243 was put on hold
  ("did you implement allthe changes we talked about before starting labs?"); it resumes only after t243 and t244 are
  merged and the lane trees re-synced.
- **Chat cards are never generic (2026-10-01):** "it should actually show more detailed information of what its doing
  rather than just "looking at page"": each card says what it inspects or does, on what; the wait says "Deciding the
  next step" until the model's reason arrives.
- **Process.** Lanes iterate on their own branches; the supervisor merges in rounds and is the only one who commits,
  merges or pushes. Heavy commands go through `build-slots/heavy.sh`. No LLM call grants.

**Open defects (not assigned).**
- Load-flaky Core tests (pass alone): `subflow.test.ts`, `service-recordings/proposals.test.ts`, `cancel-runtime-session`, `runs`.
- Two Core tests time out only under parallel load and pass alone (12/12): `service/summaries/tests/run-detail-preservation.test.ts` and `tests/service-bootstrap/tests/adaptation.test.ts`; fix in the next full sweep.
- `scripts/lab/core/build/tests/unbuilt.test.mjs` "refuses an unbuilt Core" fails about 1 run in 10 under load.
- A click that lands on a 429 page is still `navigation_unexpected` (F14 covers navigation only).
- `run-bench.ts` rebuilds a resumed evaluation without the stop label.
- The accepted result's `warnings` (F38) is not persisted; needs Core `runtime/service.ts`.

**Decisions made (supervisor; the user may override).**
- Robot checks: FluxIQ never presses or solves one (t197). Money, delete and send/publish ask every time (F10).
- D1: the dry run never clears site data or repeats a lasting effect.
- A press is refused only for a real layer (dialog, kind or front layer), not for anything that merely overlaps.
- An instruction column no field reads is information for the model and the judge, never a refusal (F38).
- `recovery-default-limits`: the worst-case per-call hold stays (a true upper bound); the test was what was wrong (t229).
- A Flow's creation has one $0.10 purse; each run's recovery has its own ceiling. Offered to the user to merge into one
  total; not changed.
- The judge gets per-condition removed-row counts (F19) and up to 60 screened characters of a condition's read (F14).

**Waiting on the user.**
- **Removing the remaining pre-action refusals.** The permission classifier refused the edit as a security weakening,
  so it was not worked around. The user must make it or allow it.
- **Workers committing on their own task branches.** Needs the brain's `hooks/worker-git-guard.mjs` changed; refused
  as self-modification.
- `fxwork/t187-bench` and `fxwork/t192-bench`: delete only on a yes.

**Next, in order.**
1. Live round 1002-M: the four lanes re-synced to Core `424a70b3` / downstream `5b79cda3` and rebuilt; leads A-D
   released (brief below). Then the approved `deepseek-v4-pro` comparison (`--llm-model deepseek-v4-pro
   --llm-cost-ceiling-usd 0.30`, one run). Watch for a double act on a backward state route (t243 open item 2).
2. Open follow-ups: unify `control` and `does`; signatures for recorded Flows (t243 open item 4); a dropped column on
   a rerun needs the domain's denied keys in the loop (t195 R3); sweep 2, with `pnpm -r --no-bail test` in Core.

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

### 2026-10-01 late — Fix list on dev; four lanes live; every build produces a Flow; playback fails; handoff
- Agent: supervisor; lanes A-D; leads t234, t235, t237; workers t236, t238.
- Changed:
  - Merged into dev in both repositories and pushed: t235 (names-only catalog, `core.describe_nodes`), t237 (domain system instructions, web-1), t234 (one purse per Flow creation, 2,000-token decision replies, unpriced calls held at the largest seen), t194 F42, t195 F44-F46 and the 8 dev test fixes, t193 W2b (stable request prefix), t238 (the behind-dev guard admits docs-only gaps).
  - Conflicts resolved by the supervisor: `service.ts` (purse with describe-nodes imports and the judge's calls; system-instruction imports; describeCall), `binding.test.ts` (both new blocks), `tools.ts` (view keys with system instructions), `phases.ts`, the generated reference.
  - Live round on trees synced to dev (results in Current State). A docs-only commit on dev refused two lanes' launches (fixed by t238); leads cannot merge, so the supervisor syncs every tree in one pass before a round.
  - t234 reconciled the spend: no creation purse exceeded $0.10; "over $0.10" totals added the playback run's own recovery. Its accounting fixes (paid refusals, step-log `part`, chat call inside the purse) are on its branch.
  - User's new rules saved (memory and binding rules): a Flow run routes by page state, not build order; chat cards are never generic; live lab trees are synced to dev before testing.
- Validation:
  - Core dev after the last merges: `npx tsc --noEmit -p .` rc 0; vitest over llm, flow-bootstrap, flow-draft, recovery, route-state, service, tests, result-verification, loop-limits, conversations, activity, action-permissions and src/ui `Tests 3 failed | 4231 passed` (the 3 pass alone: `Test Files 2 passed`, `Tests 15 passed`); audit passed; reference current.
  - Downstream after rebuilding Core: domain `# tests 1279 # pass 1279 # fail 0`; extension `# tests 2309 # pass 2309 # fail 0`; test-runner `# tests 1785 # pass 1785 # fail 0`; domain and extension checks rc 0; `node --test scripts/lab/live-guards/tests/*.test.mjs` 32/32 after t238.
- Outcome: pushed. Agents stopped; lane trees hold uncommitted work listed in Current State. Pass streak 0.

## Open Questions

- Which complex scenario goes first? `everything-store` is the known multi-step
  case that has never worked, which argues for it; a scenario that fails later
  in the chain would teach more per run. Settled by the scenario inventory.
- Does the corpus have enough qualifying tasks, or does Phase 1 author new ones?
  Settled by the scenario inventory.
- When a run's failure is in Core and in the extension at once, which side is
  fixed first? Owned by the supervisor, settled per run by which failure is
  earlier in the chain.
