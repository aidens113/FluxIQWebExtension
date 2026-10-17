# Automation Project Agents Plan

Status: Active
Status detail: Built and qualified: A8 passed on frozen pair 8 (`project` 10 of 10), and `project` is the product default since 2026-10-16 (Core t667). Next: the one-part cost gap.
Created: 2026-10-13
Last updated: 2026-10-16
Owner: Senior supervisor agent
Scope: The browser side of FluxIQ's product-level agent system for building an automation project — a project supervisor agent that owns the task, structure, interfaces, case plan, budget and assembly, and spawns bounded subflow builders, validation and repair. This document owns host-action (tab) ownership, the chat presentation, Lab qualification and the extension wiring; the domain-neutral agent contracts are owned by the Core paired document.
Paired document: `C:\Users\osrs_\FluxStuff\!FluxIQ\docs\working\automation-project-agents-plan.md`
Related: [MVP final month plan](./mvp-final-month-plan.md), [state-aware recovery plan](./state-aware-recovery-plan.md), [structural agent plan (superseded; problem list B7, B8, F24)](./structural-agent-plan.md), [t532 entry-case report](./mvp-final-month-plan/reports/t532-applicable-entry-cases.md)

---

## Current State

**Built, qualified and the product default (2026-10-16).** The system of agents the user asked for (a project
supervisor that plans a Flow's subflows and spawns bounded subflow builders, the way this repository's supervisor
spawns workers) is built in Core with its browser side here, passed the Lab comparison A8, and `project` is now the
product's default authoring mode (Core t667). The Core paired document owns the roles and contracts; this one owns the
browser side, the chat, the Lab qualification and the cross-repository order.

**Decided (supervisor recommendations; the user may overrule any):**
- Five roles: project supervisor, subflow builder, repair agent; validator and promotion owner stay the existing Core
  services.
- Authoring mode `project` beside `candidate`; the default flipped to `project` on 2026-10-16 after A8 passed (an
  extend still builds `candidate`; `candidate` and `legacy` stay selectable with `FLUXIQ_AUTHORING_MODE`). One-part
  tasks are a one-subflow plan, so there is one path.
- **Concurrent in Core, one at a time in the extension** (user, 2026-10-13: "make it possible in core, but have
  extension set it to only 1 at a time"). The web domain declares host capacity 1, so builders share the browser one at
  a time under a lease that names the tab; raising it needs separate browser contexts first.
- One Flow purse; the supervisor carves allowances and keeps a reserve for the judged whole run and one repair round.
- Creation ends only on one judged whole-Flow run from the start; builder subflow trials are partial tests.

**A8 result (A8 Run Plan, frozen pair 8: downstream `2d32847e`, Core `f7a0c4d1`).** `project` passed 10 of 10: two
consecutive passes on each of the five realistic tasks (bigbox cart, bigbox towels, crossborder, everything-store,
social). `candidate` passed 9 of 9 run and failed towels round 1 (round 2 skipped as a known failure); it has failed
towels in every pair since pair 2. Cost at the higher price rate: `project` $0.108 a build, `candidate` $0.067 (about
1.6 times). Eight frozen pairs ran in all; every failed run has a debug note under
`../language-driven-flow-loop-plan/debugs/` and every general cause was fixed structurally (Core t570-t668, downstream
t568-t657; both ledgers). Frozen pair 8's table is in the A8 Run Plan; earlier pairs are archived.

**What the A8 loop changed, in short:** a plan keeps the person's request and a done part survives an additive amend
(Core t645, t658); builders hand on only values a step makes and one read value is expressible (t645, t646); the judge
is weighed only by what Core measured (t629-t636, t641, t651, t652, t654, t659, t660, t663, t665, t666), a yes is
checked against kept rows (t663), a looping or long judge reply keeps its verdict and is read whole (t653, t665);
playback holds only refuted nos and never rests on a re-asked yes (t660, t662, t664); clearing spares layers the run
opened and a hidden control routes back to its opener (t656, t661); the chat cards are honest (t649); the Lab records
routing and cleared layers and reads a bypassed optional step correctly (t643, t657).

**Done since 2026-10-13 (all pushed):** W1-W8 here with Core A1-A6; A8 complete; the default flip.

**Not done / next:**
- The cost gap, investigated 2026-10-16 (see `## Cost Gap Plan`): most of it is finished work thrown away, not a
  one-part overhead. Merged: P1-P5 (Core t671, t672, t673, t676, t679) and Core t684 (a reset that cannot undo an
  act made inside a part says so and is fixed). Cost round 1 (off-peak) passed four of five and exposed a P5 budget
  defect (Core t685) and a false judged yes on towels (Core t686-t690). Cost round 2 (full rate, after them) passed
  four of five at $0.031 a build on average (pair 8: `project` $0.108, `candidate` $0.067); social failed on a false
  judged yes: a final read with no condition stored all 8 rows where the answer holds 4, a Core note vouched for the
  extra rows, and the confirming judge call is an identical repeat (`run-mvbr0w7e-6a01c05b.md`). In flight: Core t691
  (extra rows must be justified; the second judge call becomes the converse question), Core t692 (a keep-everything
  read after an act is a doubt), t693 paired (a repair is told what its condition kept). Next: those, then round 3.
- Open follow-ups recorded in the ledgers: none from this plan beyond t684. Done: the reset-reason flag (Core t683; the
  fallback stays in memory by design), `submission.ts` split (Core t681),
  the `extract` check (t675), the `verdict.ts` split (Core t674), the exact first-ask yes flag (Core t677).
- W1's follow-ups are closed (t669 one session-picking rule, t670 stale lease holder e2e; merged 2026-10-16).
- Price note: DeepSeek's per-token price measured about $0.11 per weighted million tokens around 23:46 and 04:54 UTC
  and about $0.22 around 02:17 and 06:49 UTC; compare costs only within one rate.

**Blocked:** nothing. Three decisions are the user's (Open Questions); each has a recommendation the plan already
follows (the schedule one is now settled: the comparison passed before the freeze).
---

## User Direction

User, 2026-10-13 (handed off from Codex): "we'll need to come up with a plan
for that. Like we'll prob need a system of different agents for managing
different parts of a automation project. For instance, the current one we have
for actually building subflows, but that gets spawned by a senior supervisor,
much like we have in this repo."

The October 13 wrap in `mvp-final-month-plan.md` queued the same design:
a product-level supervisor that owns task interpretation, the overarching
Flow/Router structure, interfaces, the supported-case plan, budget and
assembly; bounded subflow builders that return scoped graph proposals and
evidence; independent validation that supplies actual case and run receipts;
and repair that returns held revisions through the same judged promotion
owner. Workers never write accepted topology or waive task, permission or
coverage gates. The existing deterministic Call Subflow frames are not this
model-agent architecture.

The analogy is deliberate: the repository's own `AGENTS.md` roles (one
supervisor that plans, briefs, integrates and verifies; workers that execute
one bounded brief, own only their files, and report a claim that the
supervisor verifies) are the shape the product should have for building one
automation.

## Why Now: The Evidence

The 2026-10-06 consultant review said "no new multi-agent build pipeline is
required" and "subflow replacement can follow only when measured candidate
sizes justify it" (`mvp-final-month-plan/reports/consultant-doc-context.md:98-101,
204-205`). The user's 2026-10-13 direction overrides that, and the
measurements the consultant asked for now exist (discovery report, 2026-10-13,
from `lab-runs/` step `meta.json` usage and the saved debugs):

- **Context grows without bound in one agent.** `run-mv6qr7fk-77f30b49`
  (job-board): build-decision input grew from 14,691 tokens at step 0003 to
  34,882 at 0045, 59,237 at 0083 and 81,737 at 0110; judges, which start
  fresh, stayed near 15,400. `run-mv4v1v25-c7d57567` (store, $0.2124) spent
  1.82M input tokens over 42 calls and stopped on
  `flow_bootstrap.evidence_iteration_limit` although trials 3-6 already had
  all 13 rows right. `run-munmmj5n-52d8a67d` (crossborder) spent 1.74M.
- **Task parts get lost or invented.** `run-munmmj5n-52d8a67d` accepted seven
  navigations with no add-to-cart and no coupon step. `run-muq3uozx-3153564b`
  (confirm requests) lost its loop and pinned presses to handles, two on rows
  that did not qualify. `run-mv62icw3-9118516f` invented a "$25 to $50"
  filter for "under $50"; `run-mv6v2kzn-d593231f` added an unrequested
  column (0 of 7 oracle rows); `run-mv6v2hx5-f448e662`'s judges accepted an
  exclusion the instruction never asked for.
- **One budget for everything starves verification.**
  `run-mv4jqkko-bc9a05c6` (bigbox) accepted three revisions, tested none, and
  hit `run_budget_cost_exhausted`. `run-mv6qr7fk-77f30b49` ended at the call
  limit with each repair round costing about four calls.
- **Exploration churn becomes structure.** `run-mutepu6b-656f8882` spent
  steps 0034-0071 on about 19 refused or partial draft amendments;
  `run-mv6v2jh4-69244ffb` ended on four refused `submit_candidate` repeats.

None of these is a model being unable to do one subflow. They are one context
being asked to hold the whole task, the whole site history and its own
bookkeeping at once — problem-list items B7, B8 and F24. A supervisor with an
explicit task breakdown, bounded builders that start fresh, and a protected
verification reserve address those causes directly. Lab success rate on
10-12/10-13 was 24 passed, 25 failed (`lab-runs/index.md`).

What this plan does **not** claim: that agents fix wrong judgements
(`run-mv79nrcx-112c5ed7`, `run-mv6qr7fk-77f30b49`'s false "not newest-first")
or invented exclusions by themselves. The task spec gives the judge a
checklist of what was and was not asked, but the instructions stay the only
authority.

---

## Roles And Contracts (owned by Core)

The roles, invariants and contracts are owned by the Core paired document
and not restated here. In one paragraph: a **project supervisor** (model
agent) owns the task spec, structure plan, subflow interfaces, case plan,
allowances, dispatch, assembly and triage, and makes no lasting act; a
**subflow builder** (the existing candidate authoring loop scoped to one
subflow) explores from a prepared entry, submits a scoped proposal, tests it
from that entry and returns a claim; a **repair agent** does the same for the
smallest failing unit; the **validator** (trial port, detached execution,
judge) writes receipts; the **promotion owner** (existing) is the only writer
of accepted topology and needs one judged whole-Flow run from the start.
One purse per Flow; Core runs builders concurrently up to the host capacity
the domain declares, and the web domain declares 1.

## Host Actions: Concurrent In Core, One At A Time In The Extension

Two builders on two tabs of the same browser profile are not isolated: they
share cookies, the session, the cart and every other server-side state, so
one builder's lasting act changes the other's page and invalidates its
evidence. Real isolation needs separate browser contexts, which lose the
user's signed-in session and so do not work in general.

The code today assumes one actor (discovery report, 2026-10-13):

- The extension does not serialize commands: `connection.ts:127,137`
  dispatches each `server.execute_action` fire-and-forget. In-flight
  reconciliation (`background/connection/in-flight/command-reconciliation.ts`)
  is keyed by command id for lost answers and worker restarts; it is not a lock.
- Commands go to the tab in front unless `browserTabId` is set
  (`background/.../action-runner.ts:197-213`); no build code sets it
  (`domain/src/client/gateway-action-parameters.ts:74,112` only reads it), and
  navigation brings its tab to the front (`automation-tab.ts:214-221`).
- One `ActivePage.currentTabId`, one `RuntimeStatusTracker` status, one
  module-global `automationTabs` history, one overlay target
  (`background/activity/overlay-target.ts`), per-origin page pacing for the
  whole worker (`background/page-pace/origin-pace.ts`), and a reset that closes
  every tab FluxIQ opened (`action-runner.ts:216-230`).
- The domain requires exactly one connected extension client for evidence and
  dispatch (`domain/src/runtime/llm-evidence/capture.ts:309-313`,
  `domain/src/io/gateway-output-dispatcher.ts:128-140`). Handles are scoped to
  project and Flow and "numbered for the whole Flow"
  (`domain/src/runtime/llm-evidence/tools.ts:114-116,303-336`), valid only from
  a retained packet that printed them (24 kept).
- Core's state-aware contract C3 already says "one execution owner per browser
  resource" (Core `state-aware-recovery-plan.md:139-140`).

Decision (user, 2026-10-13): **make concurrent agents possible in Core, and
have the extension set it to one at a time.** Core's host-resource scheduler
(Core paired document, `Host resources and concurrency`) asks the domain for
its capacity and grants at most that many leases; the web domain's
host-resource port declares **capacity 1** and hands out the one automation
tab. The lease holder is the only role allowed to issue browser actions; the
validator takes the lease for its runs. With capacity 1 builders run in
dependency order, which costs little, because subflow N's entry state is
usually subflow N-1's exit state anyway. The gain in the extension is
bounded context and judged structure, not speed.

Raising the web capacity above 1 is a one-line change in the port, but it is
only correct once each lease gets its own browser context and the extension
stops assuming one actor: per-lease tab ids on every command, per-lease
handle scopes, an overlay and runtime status per lease, per-lease page
pacing, and a reset scoped to the lease's own tabs (the list above). Until
then the port's capacity stays 1, and a test pins it.

The lasting-act ledger is project-scoped. Resetting before a trial restores
the *case's entry state*: return to the build's starting state through the
site's own controls, then prepare the entry by running the predecessor
candidates the case plan names (the t529 candidate helper execution). A
builder never undoes acts that existed before the build began.

## Chat Presentation (this repository owns)

The chat-first rule holds for every role: each step is its own message with
its reasoning and a card naming what it acted on (`mvp-final-month-plan.md`
standing rules). What changes is that steps now have an author.

- **Attribution on the wire.** Every `server.activity` event a build emits
  carries `agent: { role, briefId?, subflowName? }` (role is `supervisor`,
  `builder`, `repair` or `validator`). This is a wire-protocol change and
  moves together across Core's `ClientGatewayActivity` type, background
  routing, the domain gateway mapping, tests and
  `docs/architecture/extension-client.md`.
- **What the person sees, in order:** the supervisor's plan as one card
  (task parts, each subflow with a one-line purpose, the starting cases, the
  budget split); "Building <subflow>: <purpose>" when a brief is dispatched;
  that builder's steps as ordinary per-step messages under its subflow
  header; its return as a card (outcome, spend, what it tested); each
  validator receipt as a card; assembly; the judged whole run; the ending.
- **Paced display.** Because the web capacity is 1, builders run one at a time, so the single headline
  and the 1.6 s detail pacing (`extension-client.md:486-594`) still fit: the
  headline changes at brief boundaries. The overlay stays on the one leased
  tab.
- **History size.** `ActivityRelay`'s `UnitHistory` keeps the last 10 units of
  at most 500 events (`background/activity/unit-history.ts`). A build with a
  supervisor, several builders, the validator and a repair can pass 10 units
  on its own, so the build must be one unit with sub-units, or history must
  keep every unit of the current build. Decided in unit W2.
- The person can correct the plan card in the chat; a correction is a new
  instruction turn, never an edit the supervisor makes to the instructions.

## Extension And Domain Wiring (this repository owns)

1. **Lease enforcement at the boundary.** Every build command carries the
   lease holder id that Core issued. Core refuses a command from a role that
   does not hold the lease before it is sent; the extension checks it again in
   `ServerCommandChannel.handleCommand` and refuses a mismatched holder with a
   typed refusal, so a stale builder's late command cannot act after the lease
   moved. Serialization is Core's; the extension check catches mistakes.
2. **Leased tab.** The lease names the browser tab; build commands set
   `browserTabId` from it instead of relying on the tab in front. This is
   needed for a correct lease even without parallelism, and it removes the
   Lab's "bring the Flow's tab to the front" workaround
   (`testing-facility.md:1386-1398`) for builds.
3. **Entry preparation.** The domain host adapter owns site-control
   preparation and observation for a declared case (entry-case design unit 4,
   `mvp-final-month-plan/reports/codex-entry-case-acceptance-design.md`). A
   builder's entry is prepared by that owner, never by the builder driving
   there with exploration acts.
4. **Handles.** Handles stay Flow-scoped. A builder starts with a fresh look
   at its prepared entry; a brief never passes the supervisor's handles,
   because those packets may no longer be retained.
5. **Capacity 1.** The web host-resource port declares one lease at a time
   (user, 2026-10-13); Core itself is built for more (see Host Actions).

## Lab Qualification (this repository owns)

Measured against the current single agent on one frozen source pair, using
only the ten realistic scenarios, started from the extension chat, headed,
at most $0.25 per Flow, every run fully debugged before any rerun.

- **Tasks.** The multi-part tasks that fail today: crossborder (three hubs,
  seller, variant, ship-from, coupon), bigbox (switch store, add two sized
  items, keep the cart), social-network-feed (confirm requests with 5+ mutual
  friends, then a table), everything-store (every page, filtered,
  deduplicated). Plus one single-part task per already-qualified lane, to
  prove the one-subflow plan costs no more than today.
- **Per run, recorded:** exact oracle result, billed cost, calls, the largest
  single decision input in tokens, whether the reserve paid for the judged
  run, and per role: calls, cost, steps.
- **Pass:** the existing P1-P7 conduct and the two-consecutive-passes rule per
  site, plus a separate zero-model replay of the saved Flow. The lane counts
  structure only from receipts; a subflow count is never an oracle
  (`mvp-final-month-plan.md`, no subflow-count oracle).
- **Logs.** `steps/NNNN-*/meta.json` and `steps/index.md` gain `role` and
  `briefId` so a debug can read one builder's steps on their own.

## A8 Run Plan (drafted 2026-10-13; running since 2026-10-14 on the user's go-ahead)

On one frozen source pair after A5c and W4 merge, every run started from the extension chat, headed, under
`--llm-max-cost-usd 0.25`, one attempt per launch, each run fully debugged before any rerun, lane trees synced to
dev and rebuilt, at most four lanes at once (one `lab-slots/slot-N` each). Common shape (as the instruction-created
gate uses, `mvp-final-month-plan/reports/codex-continuation-live-readiness.md`):

```powershell
pnpm.cmd lab run <scenario> --live-llm --llm-profile lab-create-flow --llm-provider deepseek --llm-model deepseek-flash --authoring-mode <candidate|project> --llm-task create-flow --instruction-task <task> --target persistent-isolated --workspace a8e-<mode>-<task> --replays 1 --llm-max-cost-usd 0.25 --llm-max-calls 250 --llm-max-run-tokens 48000000
```

with the process environment the pairs ran with (recorded in each run's `run.json` `invocation.fluxiqEnvironment`):
`FLUXIQ_TEST_TARGET=persistent-isolated` (the lanes' `.env.local` says `isolated`, which `--target` otherwise conflicts
with and the run is refused before any call), `FLUXIQ_DEMO_HEADLESS=false` (visible browsers),
`FLUXIQ_LAB_INSTANCE=a8-slot-N`, `FLUXIQ_LAB_CORE_BRANCH=<the lane's Core branch>`,
`FLUXIQ_LLM_RUN_COST_CEILING_USD=0.25`. The cost round's first launch omitted the first three and all four runs were
refused at $0 (2026-10-16).

| Site | Task | Modes |
| --- | --- | --- |
| crossborder-marketplace | `crossborder-marketplace-hub-to-cart` | candidate, project |
| bigbox-retail | `bigbox-retail-pickup-cart` | candidate, project |
| social-network-feed | `social-network-feed-confirm-requests` | candidate, project |
| everything-store | `everything-store-plus-earbuds-under-50` | candidate, project |
| bigbox-retail | `bigbox-retail-pickup-towels` (single part) | project |

Nine paid runs, at most $2.25 in billed dollars. Recorded per run: the exact oracle result, billed cost, calls,
the largest single decision input (W4 `runSpend.stepLog.largestInputTokens`), per-role spend, whether the reserve
paid the judged run, and a UI review of the chat's plan, brief, return and receipt cards. A pass for `project` is
P1-P7 conduct plus the oracle, and the flip of the default needs two consecutive passes per site on one frozen pair.

**Call cap (supervisor, 2026-10-14):** 250 for both modes from launch 5, up from 64: the Lab's backstop, raised
to Core's own by t576 (a first try at 120 was refused by the old 64-call Lab contract before any call, $0). The
dollar ceiling is the user's limit; the call cap only stops a runaway loop, and at 64 it ended three `project`
builds at about a third of their dollars, because a supervisor and its builders make many small calls. Both modes
get the same cap, so the comparison stays fair.

**Earlier comparisons** (launch 8, pairs 1 and 2, waves 3-11, frozen pair 1, and the Attempts table of launches 1-8)
are archived in [archive/2026-10-15-a8-runs-to-frozen-pair-1.md](automation-project-agents-plan/archive/2026-10-15-a8-runs-to-frozen-pair-1.md).
In short: `project` went from no build starting (launches 1-4) to passing every task, each failure debugged and fixed
structurally (Core t570-t639, downstream t605-t640).

**Frozen pairs 2-7** (waves 12-41) and their readings are archived in
[archive/2026-10-16-a8-frozen-pairs-2-7.md](automation-project-agents-plan/archive/2026-10-16-a8-frozen-pairs-2-7.md); each pair stopped on a general cause that was fixed structurally (Core t641-t664, downstream t642-t657).

**Frozen pair 8** (downstream `2d32847e`, Core `f7a0c4d1`, after t663-t664; docs-only commits after), waves 42-46,
bigbox cart and towels first, the five A8 tasks in both modes, twice, no product change between:

| Task | `project` 1 | `project` 2 | `candidate` 1 | `candidate` 2 |
| --- | --- | --- | --- | --- |
| bigbox-retail-pickup-cart | passed $0.114 | passed $0.137 | passed $0.072 | passed $0.065 |
| bigbox-retail-pickup-towels | passed $0.125 | passed $0.106 | failed $0.125: out of time after 8 trials (debug `a8-towels-run-mvam0lys-debug.md`) | skipped: would fail on the known cause |
| crossborder-marketplace-hub-to-cart | passed $0.142 (five briefs, 68 builder decisions) | passed $0.081 | passed $0.028 | passed $0.029 |
| everything-store-plus-earbuds-under-50 | passed $0.081 | passed $0.105 | passed $0.082 | passed $0.127 |
| social-network-feed-confirm-requests | passed $0.084 | passed $0.109 | passed $0.042 | passed $0.036 |

**Frozen pair 8 continues after wave 42 (supervisor, 2026-10-16).** `project` passed both runs; `candidate` towels
failed on general judging gaps (debug `reports/a8-towels-run-mvam0lys-debug.md`: a step-blame sentence that also names
a condition stands; judge text weighed clipped at 500 characters), not on t663. These sink `candidate` towels, not the
`project` runs the flip is decided on, and crossborder, everything-store and social have passed in both modes on every
pair, so the pair runs on; only wave 45's `candidate` towels round 2, which would fail on this known cause, is skipped.
The fixes are built in task worktrees during the pair and merged only after wave 46 (a merge would put the lanes
behind dev and stop the launches).

**Reading of frozen pair 8 (supervisor, 2026-10-16): the flip rule is met.** `project` passed all 10 runs, two
consecutive passes on each of the five tasks on one frozen pair (downstream `2d32847e`, Core `f7a0c4d1`; docs-only
commits after). `candidate` passed 9 of the 9 it ran and failed towels round 1, its round 2 skipped as a known failure;
`candidate` has now failed towels in every pair since pair 2, while `project` passed it in pairs 7 and 8 (three in a
row). Cost, all at the higher price rate: `project` $1.084 for 10 runs ($0.108 a build), `candidate` $0.606 for 9
($0.067 a build), about 1.6 times; the gap is `project`'s supervisor and per-part briefs (crossborder round 1 ran five
briefs and 68 builder decisions for a one-part task). Decision: the product default becomes `project`
(`AUTOMATION_STUDIO_AUTHORING_MODE_DEFAULT`), `candidate` stays selectable, and "extend" stays `candidate` (Core t667).
The held fixes t665 and t666 merge first. The one-part brief overhead is the next cost item.

## Cost Gap Plan (2026-10-16)

**Findings** (reports `cost-gap-run-evidence.md`, `cost-gap-core-code.md`; supervisor checked the crossborder round 1
record, `lab-runs/2026-10-16/run-mvan7giv-4246aafb`, steps 0049-0055). On the nine paired frozen-pair-8 runs `project`
cost $0.977 against `candidate`'s $0.606 (+$0.371). Builder decisions cost the same in both modes; the work kept was
$0.069 cheaper in `project`. The gap is:
- **Thrown-away briefs, +$0.248 (161 calls, 6 of 9 runs).** (a) A plan hands on a value no step reads (`itemPage`):
  the builder's submission is refused `subflow.input_unread` three times, whose text says to end blocked; the
  supervisor's amend removes the value and Core drops the producer's done proposal ("its inputs or outputs changed",
  step 0055). (b) An earlier builder carries out a later part's lasting act while exploring; the later brief finds it
  done and ends blocked; the supervisor merges the parts and Core drops the done work again. Every rebuilt brief
  explores again from the start page.
- **Subflow-trial judging, net +$0.089**; for a one-part plan the subflow trial and the whole trial are the same run
  judged twice, with a reset brief between, and the only builder gets half the purse (`brief-sizing.ts:72-78`).
- **The supervisor, +$0.085 (83 calls).** Its guidance teaches splitting: step 1 "split it into stretches that do not
  overlap" and the only example turns one sentence into two subflows (`guidance.ts:116`, `:129-134`).
- Crossborder is two asks (cart, coupon on the same item page), not one part; everything-store and towels already ran
  as one brief at `candidate`'s cost or less.

**Units (Core, partitioned by file; each a Core-paired task worktree):**
- **P1 Keep finished work across a plan change.** An amend that only narrows a done subflow's interface, or changes
  ordering, keeps its proposal; a merge whose new subflow holds a done subflow's parts carries that proposal as the
  merged brief's start. Supervisor plan state and the amend comparison.
- **P2 An unread input is not a blocker.** The subflow scope check accepts a declared input no line reads, and says
  so on the submission and the builder's return, instead of refusing with "end the brief blocked".
- **P3 Plan same-page asks together.** Guidance: a find or open that only serves an act is that act's part; asks done
  in one pass on one page are one subflow; split only where a value is read and handed on. A one-part example from a
  kind of site no realistic scenario uses. Fix the start-page sentence (`guidance.ts:115`) to match what the
  supervisor is actually given.
- **P4 A predecessor did my part** (investigated, `cost-gap-cross-part-act.md`). The phase-start reset worked every
  time; the later part's act was re-done by the predecessor's own passing proposal while Core prepared the entry
  (its subflow trial judged yes despite holding another part's step), and a read part's builder claimed "already
  done". No act is refused up front (the user's rule). Fix, after P2 (shared files): (A) Core checks a "done before"
  ending, refusing it for a part that asks no lasting act or an act the preparation run did not land; (B) the entry
  note lists possible acts too, and "end blocked" words go only to acting parts; (D) builders are told the other
  parts' words; (E) a step whose trial act was possible is marked possibly lasting for the subflow judge. Fix C (a
  merge carries the predecessor's proposal) is folded into P1.
- **P5 One-part plans test once** (after P1 and P3; the design in `cost-gap-core-code.md` (5)): the builder's test is
  the judged whole run, the brief is sized near the whole purse, no scoped judge, no reset brief between runs. Its
  tests are paid by the brief's allowance with the judging reserve as backstop (Core t685, after cost round 1).

**Validation:** per unit, Core `tsc` and the tests in the changed directories, structure audit; then one live round of
the five A8 tasks in `project` only, comparing calls and dollars by role within one price rate. Live runs only after
every round-1 and P5 change is merged and the lane trees are synced.

**Cost round (planned 2026-10-16).** After P5 merges: a worker merges both `dev` branches into the four A8 lanes'
trees (`fxwork/t563`, `t565`, `t566`, `t567`, each downstream and Core) and rebuilds the Core libraries and the
extension; the Lab's own guard refuses a stale tree. Then, from each lane's downstream tree, the A8 Run Plan's command
with `--authoring-mode project` and workspaces `cost-project-<site>`: crossborder (slot 1), bigbox cart (slot 2),
social (slot 3), everything-store (slot 4) at once, then bigbox towels on slot 2. Visible browsers, started from the
extension chat, `--llm-max-cost-usd 0.25`, one attempt each, supervised throughout; stop at the first balance error.
Measured per run against frozen pair 8's `project` run of the same task: verdict, calls and prompt/output tokens by
role (supervisor, each brief, subflow judge, whole judge, reset), briefs dispatched and why, briefs thrown away, and
billed dollars noted with the price rate, and a review of the extension chat (plan, brief, return and receipt cards) from
each run's screenshots. A pass of the round: every task passes, no brief is thrown away for the
causes P1-P4 fixed, and one-part tasks run one brief with no reset brief. Each failure gets a debug note before any
rerun.

**Cost round 1 (2026-10-16, 23:13-23:50 UTC, off-peak price; downstream `a835db3b`, Core `8ac92ef1`).** The first
launch omitted the pairs' process environment and all four were refused at $0 (the A8 Run Plan's command now records
it). Calls are rate-independent; dollars are at about half pair 8's rate.

| Task | Verdict | $ (off-peak) | Calls | Briefs | Pair 8 `project` calls | Pair 8 `candidate` calls | Note |
| --- | --- | --- | --- | --- | --- | --- | --- |
| crossborder-marketplace-hub-to-cart | passed | 0.022 | 29 | 1 | 93 / 56 | 18 / 18 | one subflow, both parts; one test, the judged run |
| bigbox-retail-pickup-cart | passed | 0.034 | 38 | 1 | 75 / 81 | 38 / 35 | one test, the judged run |
| social-network-feed-confirm-requests | passed | 0.041 | 53 | 2 | 62 / 78 | 30 / 28 | repair brief for the site's slow-down (user rule), one extra assemble |
| everything-store-plus-earbuds-under-50 | passed | 0.049 | 41 | 2 | 31 / 35 | 26 / 35 | third test refused unaffordable: the judging reserve paid every single-path test (Core t679 defect; t685) |
| bigbox-retail-pickup-towels | failed | 0.110 | 79 | 1 | 65 / 59 | 49 (failed) | a false judged yes: a correct no re-asked as a filter complaint (t666 path) and replaced; Core J1-J3 |

Debug notes: `../language-driven-flow-loop-plan/debugs/run-mvbl7oaa-de54f314.md`, `run-mvbl865c-97c1f8f7.md`,
`run-mvbl9hrv-db5a120b.md`, `run-mvblai1v-a31e7593.md`, `run-mvblov2i-abb7d82e.md`.

**Cost round 2 (2026-10-17, 02:03-02:17 UTC, full price rate, the same rate as pair 8; downstream `40b5ee32`, Core
`807e4ebe`, after Core t685-t690).** Dollars now compare directly with pair 8.

| Task | Verdict | $ | Calls | Briefs / tests | Pair 8 `project` $ | Pair 8 `candidate` $ |
| --- | --- | --- | --- | --- | --- | --- |
| crossborder-marketplace-hub-to-cart | passed | 0.027 | 28 | 1 / 1 | 0.142, 0.081 | 0.028, 0.029 |
| bigbox-retail-pickup-cart | passed | 0.034 | 40 | 1 / 1 | 0.114, 0.137 | 0.072, 0.065 |
| bigbox-retail-pickup-towels | passed | 0.033 | 33 | 1 / 2 | 0.125, 0.106 | failed 0.125 |
| everything-store-plus-earbuds-under-50 | passed | 0.029 | 21 | 1 / 2 | 0.081, 0.105 | 0.082, 0.127 |
| social-network-feed-confirm-requests | failed | 0.031 | 33 | 1 / 1 | 0.084, 0.109 | 0.042, 0.036 |

Four passes average $0.031 a build against pair 8 `project`'s $0.108 and `candidate`'s $0.067. Social failed after a
judged yes (`run-mvbr0w7e-6a01c05b.md`): the final read had no condition and stored all 8 requests where the answer
holds the 4 accepted; both judge calls saw 8 and said yes, because Core's t624 also-in-result note vouched for the 4
extra rows and the confirming call is a byte-identical temperature-0 repeat. The builder wrote the same unfiltered read
in round 1 and pair 8, whose judges caught it; t679's single judged run removed the second judging that sometimes did.
Not caused by t686-t690 (no no was produced). Fixes: Core t691, t692, t693 (paired). Debug notes: `run-mvbr0acz-5ccd4d74.md`, `run-mvbr0aok-c6d28b9b.md`,
`run-mvbr0tnr-49431979.md`, `run-mvbrhw4t-e440847e.md`.

## Units (this repository)

Partitioned by file; Core units A1-A7 are in the Core paired document.

- **W1 Web host-resource port, lease enforcement and leased tab.** New
  `domain/src/runtime/host-resources/` implementing Core's port with
  capacity 1 (a test pins it) and handing out the automation tab;
  `apps/extension/src/background/connection/`
  (`server-command-channel.ts`: refuse a command whose lease holder or epoch
  is not current, typed refusal), `background/.../action-runner.ts` (use the
  lease's `browserTabId`), `domain/src/client/gateway-action-parameters.ts`
  (carry the lease). Paired with Core A3; wire change kept in step with
  `docs/architecture/web-capabilities.md`. Tests beside each file; a Chromium
  content-harness check that a stale holder's command is refused. Live
  browser check of the leased tab staying correct when the person switches
  tabs.
- **W2 Chat attribution.** `apps/extension/src/panel/chat/stream/` (plan,
  brief, return and receipt cards; per-subflow headers) and
  `background/activity/unit-history.ts` (keep every unit of the current
  build). Paired with Core A6; `docs/architecture/extension-client.md`
  updated. Chrome side panel and Firefox popup aligned.
- **W3 Lab step logs by role.** `scripts/lab/` step-log writer and
  `steps/index.md` gain `role` and `briefId`; `docs/architecture/testing-facility.md`.
- **W4 Lab support for mode `project`** (after Core A5c). `--authoring-mode project`
  already parses through Core's resolver, but `packages/test-runner/src/flow-lane/creation/readiness.ts:68-87`
  admits only `legacy` and `candidate`, so a project build would be refused as an unrecognised mode. Admit
  `project` on the same terms as `candidate` (a trial runner and the start reset), read a project build's
  outcome and draft the way `candidate-outcome.ts` reads a candidate's, and record spend, calls and the
  largest decision input per role and brief (`live-llm/step-log-spend.ts`) for A8. Tests beside each file.
- **W5 Live diagnose, repair and adapt reachable again** (found by the 2026-10-13 sweep, t548; after W4,
  which shares `cli.ts`). t519 (`4ee4e65c`) retired bare `--flow`, but `packages/test-runner/src/live-llm/live-llm-plan.ts:240`
  still tells a live `diagnose`, `repair` or `adapt` run to pass it, so those runs have no reachable launch on `lab run`;
  the adaptation gate depends on them. Give them an instruction-led launch, remove the dead "drop --flow" checks
  (`commands.ts:274`, `live-llm-plan.ts:237`), `flowLaneExclusion` and the never-assigned `discardWindowUntil`, stop
  `bench/run-bench.ts:505,591` passing `flow: true`, and correct `docs/architecture/testing-facility.md:2521`.
- **A8 Lab comparison.** The qualification in `Lab Qualification` above,
  on a frozen source pair after A5, W1 and W2. Paid: one attempt per launch,
  a live supervisor, a full debug before any rerun.

## Order Across Both Repositories

1. Core A1 (contracts, build record). Downstream: nothing needed yet.
2. Core A2, A3, A4 and downstream W1, W2 in parallel (disjoint files; A3/W1
   and A6/W2 are paired wire changes merged together).
3. Core A5, the only `service.ts` change of this plan, serial with any other
   `service.ts` work (Codex entry-case and held-topology units included).
4. W3, then A8 on a frozen pair.
5. Core A7 after held-topology units 1-4.

Mode `project` stays off by default throughout; nothing here changes what a
build does today until A5 lands and the mode is chosen.

## Worker Briefs

Briefs since t640 are dispatched from the supervisor's scratchpad and recorded in the ledger; the delivered briefs
t536 to W8 are archived in [archive/2026-10-15-delivered-briefs.md](automation-project-agents-plan/archive/2026-10-15-delivered-briefs.md).

## Work Ledger

Entries for 2026-10-13 (plan, concurrency decision, W1-W3, the sweep fix-forward, W5, W7) are archived in
[archive/2026-10-15-ledger-2026-10-13.md](automation-project-agents-plan/archive/2026-10-15-ledger-2026-10-13.md).

Entries for 2026-10-14 (A8 rounds one to wave 4, t573-t613 downstream sides, the two sweeps) are archived in
[archive/2026-10-15-ledger-2026-10-14.md](automation-project-agents-plan/archive/2026-10-15-ledger-2026-10-14.md).

Entries for 2026-10-15 waves 4-7 (t605-t630 downstream sides, the second sweep, the canaries) are archived in
[archive/2026-10-15-ledger-waves-4-7.md](automation-project-agents-plan/archive/2026-10-15-ledger-waves-4-7.md).

Entries for 2026-10-15 waves 8 to frozen pair 5 (t640-t655 downstream sides) are archived in
[archive/2026-10-16-ledger-2026-10-15-waves-8-27.md](automation-project-agents-plan/archive/2026-10-16-ledger-2026-10-15-waves-8-27.md).

### 2026-10-16 — A8 frozen pair 6 wave 32; stopped; clearing spares run-opened layers (t656); playback records routing (t657); Core t658-t661
- Agent: supervisor (wave 32, the stop, the peak-price finding); read-only debugs `reports/a8-bigbox-cart-run-mvac0ddx-debug.md`, `a8-towels-run-mvac0nmw-debug.md`, `a8-towels-run-mvac1av6-debug.md`; workers t656, t657 (three rounds: refused guards kept, unknown keys ignored); Core t658-t661 (Core ledger); supervisor verified and integrated
- Changed: t656 `apps/extension/src/content/action-runtime/interference/{run-opened,page-wall,clearable-layers}.ts`, `presence.ts`, `recovery/attempt.ts`, `content/actions/execute.ts`: layers a successful press opened are spared by clearing until they leave, a missing target clears only a page-blocking wall, a present-but-hidden target says `shown: false` (`domain/src/actions/types.ts`, `runtime/failure/codes.ts`); a headed content spec on bigbox-retail reproduces the closed store picker and passes. t657 `packages/test-runner/src/lab-runs/write-playback-steps.ts` and `playback-step/`: playback steps record cleared layers and the state-routing record (refused guards, `noMatchCause`); `flow-lane/state-routing-attempt.ts` keeps records with unknown keys, copying only known fields
- Why: wave 32 (2026-10-16 02:17 UTC, peak price): `project` bigbox cart passed $0.094; `candidate` cart failed $0.191 (playback closed the Flow's own store picker); `project` towels failed $0.190 (a judged-yes part dropped by an amend, then Core misreadings); `candidate` towels failed $0.242 with a correct Flow refuted after playback on a no-op filter claim. The same tokens cost twice wave 27's (23:46 UTC); failing builds also made two to three times the calls
- Validation: t656 after merging dev: extension `src/content/action-runtime src/content/actions` -> 530 pass; `check-extension.mjs` exit 0; domain `runtime/failure client` -> 91 pass; domain tsc exit 0; audit passed; content specs headed (worker) 19 + 1 passed; merged `061f2845`. t657 after merging dev: test-runner check and build exit 0; flow-lane, lab-runs, playback-step, playback-skips dist tests -> 285 pass; audit passed; merged `06e5f4b9`. Pushed
- Outcome: Accepted. Next: t662 (a saved Flow records its judged trial), then frozen pair 7

### 2026-10-16 — A8 frozen pair 7 wave 37; stopped on a false yes over kept rows; Core t662-t664
- Agent: supervisor (wave 37, the stop); read-only debug `reports/a8-towels-run-mvahlxuu-debug.md`; Core t662-t664 (Core ledger)
- Changed: the A8 Run Plan's frozen pair 7 table and stop note; the wave's debug notes and UI review
- Why: wave 37 (04:46 UTC; priced at the lower rate, about $0.11 per weighted million tokens, not peak as first noted): `project` bigbox cart passed $0.043 (two subflows), towels passed $0.033; `candidate` bigbox cart passed $0.033 (the t656 store-picker fix held), towels failed $0.123 on a false build yes over a kept row that is not the item asked for
- Validation: wave 37's verdicts as above; Core t663 and t664 each `pnpm check` -> passed; merged and pushed
- Outcome: Accepted. Frozen pair 8 next

### 2026-10-16 — A8 frozen pair 8: the flip rule is met; Core t665, t666 merged after it
- Agent: supervisor (waves 42-46 on one frozen pair, the decision to run on past wave 42's `candidate` towels failure, the flip); read-only debug `reports/a8-towels-run-mvam0lys-debug.md`; Core t665, t666 (Core ledger), built during the pair and merged after it
- Changed: the A8 Run Plan's frozen pair 8 table, run-on note and reading; every run's debug note; Core t667 (in flight) makes `project` the product default
- Why: `project` passed 10 of 10 on one frozen pair (two consecutive passes on each task); `candidate` passed 9 of 9 run with towels round 1 failed (round 2 skipped as a known failure); `candidate` has failed towels in every pair since pair 2
- Validation: frozen pair 8 (downstream `2d32847e`, Core `f7a0c4d1`): `project` cart $0.114, $0.137; towels $0.125, $0.106; crossborder $0.142, $0.081; everything-store $0.081, $0.105; social $0.084, $0.109 (total $1.084); `candidate` cart $0.072, $0.065; towels failed $0.125; crossborder $0.028, $0.029; everything-store $0.082, $0.127; social $0.042, $0.036 (total $0.606); all at the higher price rate
- Outcome: Accepted. The default flips to `project` (Core t667); next cost item: a one-part task run as several briefs (crossborder round 1: five briefs)

### 2026-10-16 — Handoff: A8 complete, `project` the default
- Agent: supervisor (handoff)
- Changed: Current State rewritten for the finished A8 and the default flip; header status
- Why: end of the A8 work unit
- Validation: `pnpm structure:check` -> "structure-audit: passed (201 warning(s), 639 baselined)."; Core `node scripts/structure-audit.mjs` -> "structure-audit: passed (389 warning(s), 1156 baselined)."; every merge this session ran its narrow checks and Core's `pnpm check` (ledgers)
- Outcome: Accepted. Next: the one-part cost gap

### 2026-10-16 — Cost gap investigated: finished work thrown away, not a one-part overhead
- Agent: workers cost-gap-run-evidence (the 19 frozen-pair-8 run records), cost-gap-core-code (Core read-only);
  supervisor checked `run-mvan7giv-4246aafb` steps 0049-0055 (three `subflow.input_unread` refusals, then an amend
  dropping the done `add_hub_to_cart` for "its inputs or outputs changed")
- Changed: `## Cost Gap Plan` (findings, units P1-P5); reports `cost-gap-run-evidence.md`, `cost-gap-core-code.md`
- Why: the next item after A8; the one-part premise was wrong (crossborder is two asks)
- Validation: the evidence worker's per-step costs summed to each run's billed cost in all 19 runs; nine-pair gap
  $0.371 (`project` $0.977, `candidate` $0.606), $0.248 of it thrown-away briefs
- Outcome: Accepted. Core P1 (t671), P2 (t672), P3 (t673) and the P4 investigation dispatched

### 2026-10-16 — W1 follow-ups closed: one session-picking rule (t669), stale lease holder e2e (t670)
- Agent: workers t669-one-session-picking-rule, t670-stale-lease-holder-e2e; supervisor reviewed, re-ran, merged
- Changed: t669 `domain/src/runtime/web-sessions/` (new, `isEligibleWebSession`), `host-resources/leasable-session.ts`
  and `llm-evidence/tools.ts` use it. t670 `apps/extension/e2e/lease/tests/stale-holder.spec.ts` (new): a stand-in
  gateway on the everything-store Lab page; the current lease runs on the automation tab with another tab in front,
  an old epoch (`host_lease.stale`) and another holder (`host_lease.holder_mismatch`) change nothing, a higher epoch
  is adopted
- Why: open since W1 (the rule was restated in two places; no real-browser check of the refusal)
- Validation: t669 `node scripts/test-domain.mjs runtime/web-sessions/tests runtime/host-resources/tests
  runtime/llm-evidence/tests` -> pass 224, fail 0 (supervisor); domain tsc both configs exit 0 (worker). t670
  `npx playwright test -c e2e/playwright.config.ts e2e/lease/tests/stale-holder.spec.ts` -> "1 passed (19.7s)"
  (supervisor, headed extension session); with the refusal disabled -> "1 failed" (worker). Both merged by
  `pnpm task finish` -> structure audit passed
- Outcome: Accepted

### 2026-10-16 — Cost gap round 1 merged: P2 (Core t672), P3 (Core t673); verdict split (Core t674); extract check (t675)
- Agent: workers t672 (two rounds: blocked on ownership, then the seam it proposed), t673, t674, t675; supervisor
  reviewed each diff, re-ran the checks, fixed two never-running word checks found by t673, integrated in order
- Changed: Core t672 `dispatch/call-order.ts` (new: assembly's call-order and input-binding rule, now used by
  assembly and `dispatch/scope.ts` `handedOn`); `callable-target.ts` accepts an unread handed-on input, noted
  `unneeded` on the proposal, the builder's answer and the brief's return; an unread person's value is still refused,
  told to read it. Core t673 `supervisor/guidance.ts`: a find that only serves an act is that act's part; asks done in
  one pass on one page are one subflow; the page is the hand-off; examples from a library account and a community
  garden; the look sentence says the supervisor holds the start's route state. Supervisor: `guidance.test.ts`'s
  per-word scenario loop and `flow-draft/amendment/tests/apply.test.ts`'s pagination check never ran (`\b` in a
  template literal is a backspace); the first is removed with a note, the second fixed and narrowed to "next page"
  after it caught "as the page offers it". Core t674 `result-verification/verdict.ts` -> `verdict/` (18 files, the
  15-file advisory accepted as `agreement/`). t675 `domain/src/output-nodes/extract/` parameter contract: a wrong
  `extract` is refused at plan validation with `web.extract.*` codes
- Why: the cost gap plan (P2, P3); t674 before the re-ask flag edits there; t675 open since Core t646
- Validation: (supervisor) t672 after merging Core dev: tsc exit 0; vitest subflow-candidate, project-agents,
  project-build -> 83 files, 527 passed. t673: vitest guidance + amendment apply -> 2 files, 57 passed; fluxiq
  check passed; audit passed. t674: tsc exit 0; vitest result-verification, candidate-trial, subflow-trial -> 141
  files, 1174 passed. t675: `node scripts/test-domain.mjs output-nodes` -> pass 248, fail 0; domain tsc ok. Core
  `pnpm task finish` -> `pnpm check` passed for t672, t673, t674, t675; Core dev pushed `f05a486c`
- Outcome: Accepted. In flight: P1 round 2 (t671: carry on narrowing, merges, act/fact changes; carried script
  rewritten to fit), P4 fix (t676), exact first-ask yes flag (t677). P5 after t671 and t676

### 2026-10-16 — P1 merged (Core t671); exact first-ask yes flag (Core t677); pushes run the audit (t678)
- Agent: workers t671 (two rounds), t677; supervisor (t678, and the t677 project-build expectation)
- Changed: Core t671 `project-agents/amendment/` (new): a done proposal is carried (not done) when an amend only
  narrows its interface, changes its own parts' facts or lasting acts (reverses t595's drop), or merges other parts
  into it, renamed or turned router-run; `carried-script.ts` rewrites the carried script to fit; `dispatch/run-brief.ts`
  `carriedOf`, `supervisor/dispatch-tool.ts` `carriedOnto`, `contracts/subflow-brief.ts`, `guidance.ts` `AMEND_PLAN`.
  Core t677 `result-verification/first-ask/` (new): `verify.ts` records `firstAskConfirmed`; judge, candidate trial
  record, created audit event and the saved Flow's judged trial carry it; the playback hold reads it, old records
  keep the call count. t678 `.githooks/pre-push` runs the structure audit and refuses a failing push; the root
  `prepare` script sets `core.hooksPath`; `docs/architecture/repository-layout.md`
- Why: P1 of the cost gap (crossborder steps 0055 and 0099 each dropped done work); t677 open since t664; t678
  after two docs pushes from dev with a stale `docs/working/README.md` (`8af4695e`, `c3c4dd17`), each fixed within
  minutes
- Validation: t671 after merging Core dev: tsc exit 0; vitest project-agents, project-build, subflow-candidate -> 87
  files, 546 passed (supervisor). t677 after merging dev (t671 in): tsc exit 0; vitest result-verification,
  candidate-trial, flow-version, project-agents, project-build, subflow-trial, subflow-candidate -> 1 failed of 1761
  (`project-build-judged-trial.test.ts` expected the old trial shape; updated to carry `firstAskConfirmed: true`), then
  project-build -> 16 files, 71 passed (supervisor). Core `pnpm task finish` -> `pnpm check` passed for both; Core dev
  pushed `cb3d4ca9`. t678: `sh .githooks/pre-push` -> exit 0 on a clean tree, exit 1 naming the stale README when one
  is planted; the next `git push` ran it (54 s with the network)
- Outcome: Accepted

### 2026-10-16 — P4 fix merged (Core t676); RegExp escapes audited (t680, both repositories); submission.ts split (Core t681)
- Agent: workers t676 (two rounds: the return's `doneBefore` needed the contract file; the honest-ending question),
  t680, t681; supervisor reviewed, re-ran, integrated
- Changed: Core t676 `flow-bootstrap/subflow-candidate/{builder-loop,done-before,brief-words}.ts`,
  `contracts/builder-return.ts`, `dispatch/{scope,ending}.ts`, `service/project-build/{brief-ports,entry-note,
  subflow-trials,task-checklist}.ts`, `service/subflow-trial/`, `result-verification/{build-test,contracts}/
  task-checklist.ts`: a dependent builder's blocked ending before any submission names `doneBefore`, admitted only for
  its own acting part and an act the preparation run landed (else `subflow.done_before_refused`, or
  `subflow.ending_too_soon` with no claim: submit and test first); possible acts listed in the entry note; "end
  blocked" words only for acting parts; `outOfScope` parts named in the brief; a possible act reaches the judge as
  possibly lasting. Permission and person-needed stops end as before; an unreachable entry ends after one trial. t680
  `scripts/structure-audit/rules/regexp-template-escapes.mjs` (Core, mirrored here): a RegExp literal whose string
  swallows an escape fails the audit; four swallowed `\d` in `apps/extension/e2e/content/tests/extraction/tests/
  extract-list-catalog.spec.ts` fixed (identical values). Core t681 `flow-bootstrap/candidate/submission.ts` 412 -> 292
  lines, flat sibling files
- Why: P4 of the cost gap (`cost-gap-cross-part-act.md`); t680 after two checks silently never ran; t681 advisory
- Validation: t676 after merging Core dev (t671, t677 in): tsc exit 0; vitest subflow-candidate, project-agents,
  project-build, subflow-trial, result-verification, candidate-trial -> 233 files, 1758 passed (supervisor). t680:
  rule tests 10 pass in both trees; `node scripts/structure-audit.mjs` exit 0 in both (supervisor); a planted
  `\b` fails it (worker). t681 after merging dev: tsc exit 0; vitest candidate, flow-bootstrap-commands, project-agents
  -> 79 files, 557 passed (supervisor). `pnpm task finish` passed for each (Core `pnpm check`); both dev branches
  pushed (Core `e9729b3d`, downstream `6b30cc82`)
- Outcome: Accepted. Only P5 (Core t679) remains before the lane sync and the live round

### 2026-10-16 — P5 merged (Core t679); reset reason recorded (Core t683)
- Agent: workers t679 (two rounds: round 1 left 7 old one-part tests failing and the proposals store unfed, both in
  files it did not own), t683; supervisor resolved the one merge conflict (`supervisor/dispatch-tool.ts`: P5's
  `complete` and t683's `completeAgain` on the same answer, both kept; they follow different brief kinds), committed
  the baseline entry t681 removed (`9313ee5c`), integrated
- Changed: Core t679 `project-agents/single-subflow/` (new): on a plan of one router-run subflow, the builder's
  `core.test_subflow` assembles the exact proposal with `project.assemble`'s code and runs the judged whole trial
  under the supervisor's purse frame, a `candidate_trial` receipt the supervisor completes on in three decisions;
  the brief is sized near the whole purse, keeps no judge calls back, and is told its test is the judged run; the
  proposals store learns single-path trials; a whole test of an already-yes single-path revision runs nothing; old
  one-part tests moved (one-part behaviour to the new path, multi-subflow mechanics to two-subflow plans). Core t683
  `supervisor/{state,completion,dispatch-tool,supervisor-loop}.ts`: the state records why a reset was asked for
  (`resetToEnd`) and the answer after it says end or `completeAgain`, never test; the t637 fallback stays in memory
  because a supervisor is never restarted mid-build (fresh buildId per build), said in the header
- Why: P5 of the cost gap; t683 open since t637/t638
- Validation: (supervisor) t679 after merging Core dev (t683 in): tsc exit 0; vitest project-agents, project-build,
  subflow-candidate, subflow-trial, flow-bootstrap/candidate, candidate-trial -> 150 files, 971 passed. t683: tsc exit
  0; vitest project-agents, project-build -> 70 files, 465 passed. Core `pnpm task finish` -> `pnpm check` passed for
  both; Core dev pushed `c30a1a32`
- Outcome: Accepted. Found by t679: a reset cannot undo an act made inside a part subflow's trial (no item in its
  state diff) yet says every act is undone; with t683's three small reset gaps it is Core t684, in flight. The live
  round waits for it (no launch with a known fix in flight)

### 2026-10-16 — Cost round 1; Core t684-t688 from what it found
- Agent: supervisor (lane sync, launches, four debug notes); worker debug of towels (`run-mvblov2i-abb7d82e.md`);
  workers t684, t685, t686, t687, t688; supervisor verified and integrated each
- Changed: Core t684 (a reset undoes acts made inside a part: `landed-acts.ts` counted a Call Subflow's page-after as
  seen; a reset that comes back done names every act still in place; t683's three reset gaps). Core t685 (single-path
  tests paid by the brief's allowance, the judging reserve as backstop; `llm/build-purse/judge-backstop.ts`). Core t686
  (`agreement/no-reasons.ts`: a re-asked answer replaces a no only when every reason is settled; recheck words state
  what was measured). Core t687 (a condition in the request's own exclusion words is kept; wholly refuted advice is not
  passed on). Core t688 (the result repair starts where it stands; "no next page" ends its loop; duplicate steps
  refused). Docs: the A8 Run Plan's launch environment; the plan compacted (frozen pairs 2-7, the 2026-10-15 ledger)
- Why: cost round 1 (`## Cost Gap Plan`): everything-store's third test refused unaffordable (t685); towels' false
  judged yes (t686, t687) and a result repair that applied nothing (t688); t684 found by t679
- Validation: (supervisor) t684 after merging dev: tsc exit 0; vitest project-agents, project-build, subflow-trial,
  candidate-trial, subflow-candidate -> 125 files, 804 passed. t685: llm, project-agents, project-build, flow-bootstrap,
  candidate-trial, subflow-trial -> 497 files, 4963 passed, 2 skipped. t686 after merging dev: result-verification,
  candidate-trial, subflow-trial, flow-bootstrap, project-agents -> 392 files, 3865 passed. t687 after merging dev
  (t686 in): same dirs -> 396 files, 3882 passed. t688 after merging dev: flow-draft, llm, flow-bootstrap,
  runtime-adaptation, executor -> 542 files, 5702 passed. tsc exit 0 for each; Core `pnpm task finish` -> `pnpm check`
  passed for each; Core dev pushed `d4730345`
- Outcome: Accepted. t687 found a t679 regression: the single path never carries the judged run's kept conditions to
  the builder's gate (Core t689, in flight); t688 and t686 left four `llm/` round-stall sites dropping saved steps'
  schedules, a wrong page-loop hint, the read-guidance line and `verify.ts`'s record wiring (Core t690, in flight).
  The rerun of everything-store and towels waits for both

### 2026-10-16 — Core t689 (single path keeps kept conditions), t690 (repair rounds keep schedules); cost round 2 launched
- Agent: workers t689 (two rounds: supervisor decided a single-path repair brief inherits conditions kept on earlier
  briefs' whole runs of the same subflow), t690; supervisor verified, integrated, synced the lanes, launched round 2
- Changed: Core t689 `project-agents/single-subflow/{single-subflow-trial,assembled-from}.ts`,
  `subflow-candidate/subflow-trial-gate.ts`: the judged run's kept conditions ride on the single-path trial result, so
  the builder's controller refuses a dropped one once. Core t690 `flow-draft/scheduled-candidate/step-copy.ts` (new,
  used by the four round-stall sites and two earlier copies), `llm/draft-amendment-feedback.ts` (no "repeat the next
  page over the read" inside a page loop), `llm/evidence-loop-decision.ts` (+ its prompt pin: a filter's option words
  do not show each kept row meets the request; a venue-listing example), `result-verification/verify.ts` (Core's
  record reaches the narrowing re-ask)
- Why: t687 found the t679 regression; t686 and t688 left these in files they did not own
- Validation: (supervisor) t689 after merging dev: tsc exit 0; vitest project-agents, project-build, subflow-candidate,
  subflow-trial, result-verification -> 229 files, 1664 passed. t690 after merging dev (t689 in): tsc exit 0; vitest
  llm, flow-draft, result-verification, flow-bootstrap, project-agents, candidate-trial -> 636 files, 6259 passed, 2
  skipped. Core `pnpm task finish` -> `pnpm check` passed for both; Core dev pushed `807e4ebe`. Lanes synced: each
  downstream tree at `40b5ee32` and Core at `807e4ebe`, both containing dev; Core builds current
- Outcome: Accepted. Cost round 2 launched at the full price rate (after 00:30 UTC), comparable with pair 8 in dollars

## Open Questions

Owned by the user; listed in full, with recommendations, in the Core paired
document: schedule against the MVP (recommended: before the 2026-10-29
freeze behind mode `project`), whether the supervisor may add required
starting cases (recommended: add-only), and whether the person confirms the
plan before builders start (recommended: no blocking step).
