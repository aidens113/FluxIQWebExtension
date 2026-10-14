# Automation Project Agents Plan

Status: Active
Status detail: W1, W2 and W3 delivered and pushed 2026-10-13 with Core A1-A4, A3b and A6; Core A5 in progress; A8 Lab comparison follows. User decision 2026-10-13: concurrent in Core, the web domain declares one at a time.
Created: 2026-10-13
Last updated: 2026-10-13
Owner: Senior supervisor agent
Scope: The browser side of FluxIQ's product-level agent system for building an automation project — a project supervisor agent that owns the task, structure, interfaces, case plan, budget and assembly, and spawns bounded subflow builders, validation and repair. This document owns host-action (tab) ownership, the chat presentation, Lab qualification and the extension wiring; the domain-neutral agent contracts are owned by the Core paired document.
Paired document: `C:\Users\osrs_\FluxStuff\!FluxIQ\docs\working\automation-project-agents-plan.md`
Related: [MVP final month plan](./mvp-final-month-plan.md), [state-aware recovery plan](./state-aware-recovery-plan.md), [structural agent plan (superseded; problem list B7, B8, F24)](./structural-agent-plan.md), [t532 entry-case report](./mvp-final-month-plan/reports/t532-applicable-entry-cases.md)

---

## Current State

**Planned, not built (2026-10-13).** The user asked for a system of agents
for building an automation project: a supervisor that spawns the subflow
builder we already have, the way this repository's supervisor spawns
workers. This document holds the evidence for it, the browser side, the chat,
the Lab qualification and the cross-repository order; the Core paired
document owns the roles and contracts.

**Decided (supervisor recommendations; the user may overrule any):**
- Five roles: project supervisor, subflow builder, repair agent; validator
  and promotion owner stay the existing Core services.
- New authoring mode `project` beside today's default `candidate`; the
  default flips only after the Lab comparison passes. One-part tasks are a
  one-subflow plan, so there is one path, not two.
- **Concurrent in Core, one at a time in the extension** (user, 2026-10-13:
  "make it possible in core, but have extension set it to only 1 at a
  time"). Core schedules builders up to a host capacity the domain declares;
  the web domain declares 1, so builders share the browser one at a time
  under a lease that names the tab. Two tabs of one profile are not
  isolation (shared cookies, cart, session); raising the web capacity needs
  separate browser contexts first.
- One Flow purse; the supervisor carves allowances and keeps a reserve for the
  judged whole run and one repair round.
- Creation still ends only on one judged whole-Flow run from the start;
  builder subflow trials are partial tests.

**Done (2026-10-13, supervisor-verified, pushed):** discovery and this plan with its Core pair; W1 web host-resource port at capacity 1 with lease enforcement and the leased tab (t536, with Core A3b); W2 chat attribution and W3 Lab index columns (t539, with Core A6). Core A1-A4 and the shared contracts are delivered (Core document's ledger). Nothing is wired into a build yet, so builds behave as before.

**Now (2026-10-14): A8 is running** (user: "Yes go to live tests"). Round one in mode `project` has been
launched four times; each launch was debugged and fixed before the next (the A8 Run Plan's Attempts table): one
shared lane tree (a setup error), the Lab chat unavailable on long paths (t568), then the supervisor explored instead of planning and could not write Core's
raw plan (t569). After t569 the supervisor plans and dispatches and builders act, but three of four builds ran out
of calls at $0.07-0.08 of $0.25 and the fourth's subflow trials were judged no. Fixed and merged before the fifth
launch, so every A8 round runs on one frozen pair: Core t570 (builders had no budget at all; per-brief call shares,
Core-sized briefs, permitted acts from parts, exact interface lines), t574 (the judge now sees a called part's read
with its wording and tested values; an audit found 3 of 5 everything-store verdicts wrong without them), t575 (an
acting brief may make any act the task asks for, so two models' class labels need not agree), A21 (t571), A10b
(t572), W8 here (t573), and the Lab's call backstop raised to Core's 250 (t576). After A8: A7 and A14 in Core; audit point 5 (re-ask a refuted no).
Launch 5 (`048a1d91`, 250 calls) found two more: briefs sized past the builder loop's 64 turns (t577, merged), and,
where bigbox's builders did run, subflow trials that could never pass (the bigbox debug,
`reports/a8-bigbox-run-mv8186yr-debug.md`): Core t578-t582 fixed it and are merged (Core ledger); launch 6 then produced the first `project` Flow
to pass its judged whole run (crossborder, $0.028) and four new defects: t583 and t584 are merged, t585-t589 in
merged; launch 7 then
lost three builds to the Lab's chat deadline (sized for one candidate loop) and showed the start-state class of failure
a fifth time, so t593 builds one shared phase start for every phase; t592 (a Core-owned 30-minute project build bound,
the Lab's deadline derived from it), t594 (builder scope and the subflow judge), t595 (repairs carry their failure;
no repair loop on nothing), t596 (domain handle identity across briefs) are in flight; launch 8 follows them.
Still open here: the merge of W1's session-picking rule with `eligibleWebSessionIds`, a stand-in-gateway e2e for a
stale holder, and live rendering of the new chat cards (A8 reviews them).

**Blocked:** nothing. Three decisions are the user's (Open Questions); each
has a recommendation the plan already follows.

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
pnpm.cmd lab run <scenario> --live-llm --llm-profile lab-create-flow --llm-provider deepseek --llm-model deepseek-flash --authoring-mode <candidate|project> --llm-task create-flow --instruction-task <task> --target persistent-isolated --workspace a8-<mode>-<site> --llm-max-cost-usd 0.25 --llm-max-calls 250 --llm-max-run-tokens 48000000
```

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

**Comparison on one frozen pair** (downstream `24dacba5`, Core `9b4c5a38`; docs-only commits after): round one is
launch 8 above; round two runs `candidate` on the same lanes before any further code merges.

| Task | `project` (launch 8) | `candidate` (round two) |
| --- | --- | --- |
| crossborder-marketplace-hub-to-cart | passed, $0.029 | passed, $0.015 |
| bigbox-retail-pickup-cart | passed, $0.037 | passed, $0.033 |
| social-network-feed-confirm-requests | failed, $0.103 | Flow created, oracle passed; run failed on missing replay call accounting, $0.048 |
| everything-store-plus-earbuds-under-50 | failed, $0.130 | failed, $0.069 (the same judge defect) |

**Reading of rounds one and two (supervisor, 2026-10-14):** on this pair `project` matches `candidate` where both
work (crossborder, bigbox) at a higher cost (about 1.1-1.9x), fails social where `candidate` built a correct Flow, and
both fail everything-store on one shared judge defect. `project` does not yet beat `candidate`, so the default stays
`candidate`. Next: the fixes found here (t598, t599, t601 and the replay accounting), then a fresh pair for both modes.

**Attempts** (each debugged in `language-driven-flow-loop-plan/debugs/<runId>.md` before the next launch):

| Launch | Pair (Core) | Runs | Outcome | Fix |
| --- | --- | --- | --- | --- |
| 1, `project` | after A18 | four runs (run-mv7rkmen, -rm0qo, -rmobk, -rnc14) | none started, $0: all four launched from one lane tree (supervisor setup error) | one lane tree per run |
| 2, `project` | after A18 | three runs (run-mv7rvqfz, -rx3mk, -ryk3v), own trees | none started, $0: the Lab chat was unavailable | t568 SQLite long-path open |
| 3, `project` | after t568 | run-mv7t07hx (crossborder $0.006), run-mv7t19hg (bigbox), run-mv7t2xxc (social $0.024), run-mv7t4ozn (everything-store $0.005) | the supervisor searched like a builder, then every raw plan was refused | t569 planning format, look budget |
| 4, `project` | `e56fec59` | run-mv7vk3ol (crossborder $0.072), run-mv7vl89u (bigbox $0.078), run-mv7vmvhd (social $0.078), run-mv7vor5f (everything-store $0.171) | plans and dispatches work; three ran out of calls, everything-store's subflow trials judged no 4x, unsure 1x (judge reliability, cross-mode) | t570 call shares and brief defaults; the call cap above |
| 5, `project` | `048a1d91`, 250 calls | run-mv816jbn (crossborder $0.003), run-mv8186yr (bigbox $0.094), run-mv819so1 (social $0.003), run-mv81b25e (everything-store $0.003) | first try refused before any call (the Lab took at most 64 calls; t576); then three builds' briefs were sized 77-117 turns and every builder refused its own configuration (loop takes 64); bigbox's builders ran, but no subflow trial could pass (stale trial tab, dependents started early, no honest builder ending) | t577 turns capped at the loop's 64; Core t578-t582 from the bigbox debug |
| 6, `project` | `2db229e9`, 250 calls | run-mv85un8j (crossborder $0.028), run-mv85vjqo (bigbox $0.031), run-mv85xmgq (social $0.040), run-mv85zf4i (everything-store $0.004) | crossborder built a Flow that passed its judged whole run (the first in mode `project`), then Core refused its settings (a 64-call cap); bigbox passed two of three subflows (prepared entry not "arrived"); social could not reset a confirmed request (whole test skips the start hook); everything-store's submit tool description overran its limit | t583, t584 merged; t585-t589 |
| 7, `project` | `6a81a391`, 250 calls | run-mv8c76i3 (crossborder $0.036), run-mv8c7unr (bigbox $0.112), run-mv8cam5t (social $0.056), run-mv8cbm4y (everything-store $0.074) | social's whole test passed and it was adding the rate-limit branch when the Lab's 795 s chat deadline ended it, as it ended bigbox and everything-store; bigbox's whole test ran on a stale page (no shared phase start) and eight repairs changed nothing; crossborder's first builder did the second part's act unrecorded | t592-t596 |
| 8, `project` | `9b4c5a38`, 250 calls | run-mv8i8r0u (crossborder $0.029), run-mv8i94yu (bigbox $0.037), run-mv8ic6mk (social $0.103), run-mv8id5vg (everything-store $0.130) | **crossborder and bigbox passed end to end** (Flow created, oracle passed); social's second subflow never built; everything-store's builder came back partial and its repair was stopped by the build bound | debugs in flight; t598 held to keep the pair frozen |

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

### Brief: t536-w1-web-lease
- Repository: this repository, worktree `fxwork/t536/!FluxIQWebExtension`, branch `task/t536-host-lease-wire`; it builds
  against the paired Core worktree `fxwork/t536/!FluxIQ`, where Core's half (t536-a3b-lease-core) runs at the same time.
- Task: unit W1, the web side of the host lease (user, 2026-10-13: concurrent agents possible in Core, the extension
  sets one at a time). Core's types are fixed on the branch: `ClientGatewayHostLease`, `lease?` on
  `ClientGatewayActionCommand` and `CLIENT_GATEWAY_HOST_LEASE_REFUSAL_CODES` in `packages/contracts/src/client-gateway.ts`;
  the port `AutomationStudioHostResourcePort` published from Core's runtime barrel. (1) New
  `domain/src/runtime/host-resources/`: the web port, `capacity: 1` (a test pins it), resource key
  `web.automation:<clientId>` (client id, not session id, so a worker restart keeps the key), epochs strictly rising
  even across a Core restart (seed from the clock), `acquire` answers `at_capacity` unless exactly one session
  qualifies by the build-path rule (`domain/src/runtime/llm-evidence/tools.ts:713-724`); expose it as `hostResources`
  from `createWebAutomationHostRuntime` (`domain/src/runtime/host-runtime.ts:136-233`). (2) New
  `domain/src/client/host-lease.ts`: validate a wire lease, build the refusal record (`client.action_result`,
  `status: "failed"`, failure `{category: "blocked_by_capability_or_policy", code: host_lease.stale |
  host_lease.holder_mismatch, retryable: false, stage: "dispatch", effect: "unacted"}`). (3) Extension: carry `lease`
  on `ServerCommandPayload` (`apps/extension/src/shared/protocol.ts:624-634`) through `gateway-session.ts:335-358`
  (the mapping drops unknown fields); in `server-command-channel.ts` check it after `answerRepeat` and before
  `reconciliation.begin` (and in the `evaluate_facts` branch): per resource key keep the highest `{epoch, holder}`
  seen in `chrome.storage.session` (new `background/connection/host-lease/`); lower epoch is stale, same epoch with
  another holder is a mismatch, higher is adopted; send the refusal directly (as `gateway-session.ts:351-355` does,
  no runtime status or recorded event) and mark it settled in reconciliation so a repeated id gets the refusal, never
  `not_seen`. (4) A leased command with no named tab runs on the automation tab (`latestOpenAutomationTab()`), not the
  tab in front; an explicit `browserTabId` still wins (`runtime/command-router.ts:38-55`, `action-runner.ts:35-62,191-214`).
- Required reads: this document's `Host Actions` and `Extension And Domain Wiring`; the files named above;
  `docs/architecture/web-capabilities.md` (command channel and reconciliation sections).
- Owns: the new directories and files above with their tests; the named lines of `host-runtime.ts`, `protocol.ts`,
  `gateway-session.ts`, `server-command-channel.ts`, `command-router.ts`, `action-runner.ts` (and `automation-tab.ts`
  only if needed); the client barrel export; `docs/architecture/web-capabilities.md` and `extension-client.md`
  sections on the lease; `docs/working/automation-project-agents-plan/reports/t536-w1-web-lease.md`.
- Must not touch: every Core file; `domain/src/runtime/llm-evidence/**`; `domain/src/io/gateway-output-dispatcher.ts`;
  `domain/src/runtime/adapter.ts`; `apps/extension/src/panel/**`; `apps/extension/src/background/activity/**`; `scripts/lab/**`.
- Definition of done: tests: capacity pinned at 1; epochs rise across a restarted port; zero or two sessions answer
  `at_capacity`; a stale or mismatched lease gets the exact record, the router is never called and nothing is
  recorded; a repeated id is answered with the refusal; a higher epoch is adopted; a lease-less command with no lease
  ever seen runs as today; the ledger survives a worker restart; a leased click and a leased navigation use the
  automation tab while another tab is in front. Checks: the tests beside each changed file, the domain and extension
  typechecks, `pnpm structure:check`. A Chromium content-harness check that a stale holder's command is refused if
  the harness can drive it; say so if not.
- Report to: `docs/working/automation-project-agents-plan/reports/t536-w1-web-lease.md`

### Brief: t539-w2-chat-attribution
- Repository: this repository, worktree `fxwork/t539/!FluxIQWebExtension`, branch `task/t539-agent-attribution-chat`;
  it builds against the paired Core worktree `fxwork/t539/!FluxIQ`, where Core's half (t539-a6-attribution-core)
  runs at the same time. W3 (Lab step-log columns) is folded in.
- Task: unit W2. The chat shows a build with several agents. Wire types are fixed on the Core branch:
  `agent?: ClientGatewayActivityAgent` on an activity and `project?: ClientGatewayActivityProjectCard` on a
  `note` row (plan, brief, return, receipt). (1) New `apps/extension/src/shared/activity/{agent,project-card}.ts`
  readers (that directory is at its file-count warning: put them in a subfolder if the audit asks).
  (2) `background/activity/unit-history.ts` and `shared/activity/history-limits.ts`: keep every event of the
  build in progress and pin project rows; a 1,500-event build keeps its plan card; ten other units never evict
  the current build. (3) `panel/chat/stream/step/messages.ts`: key per-unit decision state by
  `activityId#briefId` so a tool card attaches to its own agent's decision (one branch plus keying only; the
  file is past its size warning, so new logic goes in new `project-message.ts` and `project-words.ts`).
  Show: the plan card; "Building <subflow>: <purpose>" (or "Surveying", "Repairing", "Resetting the site") at
  a brief; that builder's steps under a subflow header; the return card; receipt cards; validator rows; the
  ending. Every step stays its own message with its reasoning and an icon card (standing rule). (4) View:
  `panel/chat/view/{step-message-view,thread-view}.ts`, `panel/chat/chat.css`, `panel/icons/lucide-nodes.ts`
  (icons must match the ones Core pins; parity test). Chrome side panel and Firefox popup share `mountPanel`.
  (5) W3: `packages/test-runner/src/lab-runs/rewrite-steps-index.ts` gains Role and Brief columns matching
  Core's `listing.ts` header word for word; `docs/architecture/testing-facility.md` step-log section.
- Required reads: this document's `Chat Presentation`; the files named above;
  `docs/architecture/extension-client.md:389-419,486-540,749-790`.
- Owns: the files named above, their tests, `shared/activity/index.ts`, `panel/chat/stream/step/index.ts`;
  `docs/architecture/extension-client.md` and `testing-facility.md` sections;
  `docs/working/automation-project-agents-plan/reports/t539-w2-chat-attribution.md`.
- Must not touch: every Core file; `background/connection/**` and `background/connection.ts` (W1, t536);
  `domain/**`; `background/activity/pacer.ts`; `packages/test-runner/src/live-llm/`; `scripts/lab/**`.
- Definition of done: tests: agent and card readers; unit history keeps the build and its plan card; messages
  for a multi-agent fixture (plan, dispatch header, builder steps under it, interleaved lanes keyed apart,
  return, receipt, validator rows, ending); view tests and the icon parity test; the Lab index columns. Checks:
  the tests beside each changed file, the extension and domain typechecks, `pnpm structure:check`,
  `node scripts/check-extension.mjs`. Say what live browser behaviour was not exercised.
- Report to: `docs/working/automation-project-agents-plan/reports/t539-w2-chat-attribution.md`

### Brief: domain-sweep-fixtures
- Repository: this repository, the paired worktree the dispatch prompt names.
- Task: fix forward the 17 domain tests the 2026-10-13 downstream sweep found failing on dev `7a93c624` (with Core
  `1f747263`; `pnpm -r test` stopped at the domain package: "# tests 2019, # pass 2002, # fail 17"). Files (source
  paths of the built tests): `domain/src/io/tests/gateway-output-dispatcher-durable-reconcile.test.ts` (4),
  `domain/src/io/tests/gateway-output-dispatcher.test.ts` (1), `domain/src/runtime/tests/adapter.test.ts` (1),
  `domain/src/tests/core-gateway-recording-order.test.ts` (1), `domain/src/tests/web-panel-host.test.ts` (10).
  Errors are Core's t519 refusals (`AutomationInstructionError`: a recording started without a description; a Flow
  with no active written instructions, then "Unknown Automation Studio Flow"). Fix the fixtures the way Core's t543
  did (Core `docs/working/automation-project-agents-plan/reports/t543-wiring-tests.md`): save the Flow's
  instructions through the product's own call and describe each recording; never relax a product gate. A failure
  that is not this cause: stop on it and report it with the evidence.
- Required reads: the five files and their helpers; the t543 report.
- Owns: the five files and test-only helpers under `domain/src/**/tests/` that only they use;
  `docs/working/automation-project-agents-plan/reports/<your label>.md`.
- Must not touch: any file outside a `tests/` directory; Core files.
- Definition of done: `cd domain && DOMAIN_TEST_BUILD_LABEL=<label> node scripts/test-domain.mjs io/tests/gateway-output-dispatcher runtime/tests/adapter tests/core-gateway-recording-order tests/web-panel-host`
  passes in full; `pnpm --filter @fluxiq-web-extension/domain check`; `pnpm structure:check`.

### Brief: test-runner-sweep-failures
- Repository: this repository, the paired worktree the dispatch prompt names.
- Task: find the cause of, and fix forward, the downstream sweep's 14 failures (2026-10-13, dev `7a93c624` with Core
  `1f747263`, from `fxwork/sweep-1010/!FluxIQWebExtension`: `pnpm -r --no-bail --filter '!@fluxiq-web-extension/domain' test`
  -> `packages/test-runner` "# fail 13", `apps/scenario-lab` "# fail 1"; the 2026-10-10 sweep had 1 test-runner
  failure, `compile-flow-script.test.ts`). Failing: `run-evaluation/tests/runner-wiring.test.ts` (5: "flowLane is
  in the runner", "snapshot is in the runner"), `run-evaluation/tests/single-run-evaluation.test.ts` (1),
  `run-scenario/browser-session/{core-identity,build-identity}/tests/identity.test.ts` (1 each), `tests/cli-llm.test.ts`
  (5: refusals before a credential is read, e.g. "the next refusal is the live run's missing credential"), and
  `apps/scenario-lab/src/scenarios/crossborder-marketplace/tests/browser-paths.test.ts` (1, a browser test the
  2026-10-10 sweep listed as slow). For each: reproduce in your worktree, find the commit that broke it, and say
  whether it is a stale test (source-scanning tests after a move, an expectation older than a product change), an
  environment dependence (credentials or variables a test must not read from the machine), or a product defect.
  Fix stale tests and environment leaks in the tests; never relax a product check; stop on a product defect and
  report it with the evidence.
- Required reads: the failing tests and the code they exercise; `docs/architecture/testing-facility.md` where a test
  names a contract.
- Owns: the failing test files and test-only helpers under `tests/` directories they use;
  `docs/working/automation-project-agents-plan/reports/<your label>.md`.
- Must not touch: any file outside a `tests/` directory; Core files.
- Definition of done: each listed test passes in your worktree (`pnpm --filter @fluxiq-web-extension/test-runner build`
  then `node --test` on the built files; scenario-lab by its own test script), `pnpm --filter @fluxiq-web-extension/test-runner check`,
  `pnpm structure:check`; the report names each failure's cause and the breaking commit.

### Brief: W4-lab-project-mode
- Repository: this repository, the paired worktree the dispatch prompt names (its Core worktree carries A5c, which
  adds authoring mode `project`).
- Task: unit W4, let the Lab run and read a build in mode `project`, so A8 can compare it with `candidate`.
  (1) `packages/test-runner/src/flow-lane/creation/readiness.ts:68-87` admits `project` on the same terms as
  `candidate` (a trial runner and the start reset), with its own refusal wording. (2) Read a project build's
  outcome and draft as `flow-lane/creation/candidate-outcome.ts` reads a candidate's (a project build proposes
  through the same promotion owner and stores the same draft). (3) `live-llm/step-log-spend.ts`: spend, calls and
  the largest single decision input in tokens, per role and brief, from the step log's new `role`/`briefId`
  fields; written into the run's report so a debug and A8 can read them. (4) `cli.ts:123`: `--model-reset-only`
  applies to `project` builds too. (5) `docs/architecture/testing-facility.md`: the mode, its readiness and the
  per-role spend.
- Required reads: the Core paired plan's Current State; this document's `Lab Qualification`; the files above;
  `live-llm/authoring-mode-env.ts`.
- Owns: the files named above and their tests; the report.
- Must not touch: Core files, `apps/extension/**`, `domain/**`, `scripts/lab/**` (unless the launch path itself
  refuses the mode; then report it before editing).
- Definition of done: tests for readiness (admitted, refused without trial runner or start reset), outcome reading
  of a project build fixture, per-role spend from a step-log fixture with two briefs, the CLI flag; test-runner
  check and the tests beside each file; `pnpm structure:check`. No live run.

### Brief: W5-live-adapt-launch
- Repository: this repository, the paired worktree the dispatch prompt names.
- Task: unit W5. t519 (`4ee4e65c`) retired bare `--flow`, but `packages/test-runner/src/live-llm/live-llm-plan.ts:240`
  still tells a live `diagnose`, `repair` or `adapt` run to pass it, so those runs have no reachable launch on
  `lab run` (found by t548; see `reports/t548-test-runner-sweep.md`). First establish what the adaptation gate
  actually runs today (`docs/working/adaptation-and-breadth-plan.md` Current State; the instruction-created gate
  command in `mvp-final-month-plan/reports/codex-continuation-live-readiness.md:99-110`): if the gate creates the
  Flow in the same run (`--llm-task create-flow` with an `-after-creation` task) and repairs it in-run, say so and
  whether a separate diagnose/repair/adapt launch is still needed. Then either give `diagnose`, `repair` and `adapt`
  an instruction-led launch (a saved Flow named by the run's workspace and its written instructions, never a
  recording-only Flow), or retire them cleanly with a refusal that names the supported path. Remove the dead
  "drop --flow" checks (`commands.ts:274`, `live-llm-plan.ts:237`), `flowLaneExclusion` and the never-assigned
  `discardWindowUntil`; stop `bench/run-bench.ts:505,591` passing `flow: true`; correct
  `docs/architecture/testing-facility.md:2521`.
- Required reads: the files named above; `docs/architecture/testing-facility.md` (live-run and lane sections).
- Owns: `packages/test-runner/src/live-llm/`, `packages/test-runner/src/commands.ts`, `packages/test-runner/src/bench/run-bench.ts`,
  the files holding `flowLaneExclusion` and `discardWindowUntil`, their tests; `docs/architecture/testing-facility.md`;
  `docs/working/automation-project-agents-plan/reports/<your label>.md`.
- Must not touch: Core files; `apps/extension/**`; `domain/**`; `packages/test-runner/src/flow-lane/**` (W4's,
  merged; report if a change there is needed).
- Definition of done: tests beside each changed file; test-runner check; `pnpm structure:check`. No live run.

### Brief: W6-lab-key-scope-and-dead-flow-lane
- Repository: this repository, the paired worktree the dispatch prompt names.
- Task: unit W6. (1) Key scope: t552's worker found that a `lab run` probe with `FLUXIQ_TEST_ENV_FILES=none` still
  read the real provider key from the worktree's `.env.local` and got past the credential check (it stopped only
  at a bad variant; nothing was spent). Find what `FLUXIQ_TEST_ENV_FILES` is meant to govern (grep its readers and
  docs) and where the key resolver reads `.env.local`; make it so a run or probe that says no env files reads no
  key from any env file, and so no unit test or CLI test can ever obtain a real key. If the variable was never
  meant to cover `.env.local`, add the explicit way to say so and document it. Tests that pin both. (2) Dead
  recorded-Flow code left by t519 and t552 (see `reports/t552-w5-live-adapt-launch.md`): `cli.ts` passing
  `flowLane` and building a live matrix that can only be refused; `run-scenario.ts` remaining `options.flow`
  branches; `LiveLlmRun`'s recorded-Flow code (`authorizer`, `settle`, `lane-settlement`) unreachable from the CLI;
  `flow-lane/recording-discards.ts` `until` nothing sets; `bench/expand-corpus.ts` planning Flow-lane results that
  are always refused (`week1`, `week2`). Remove it, never extract-and-drop; keep every refusal a person can still
  meet, with its message.
- Required reads: the t552 report; the files named; `docs/architecture/testing-facility.md` (env files, Lab CLI).
- Owns: `packages/test-runner/src/**` files named above, the key resolver and env-file reader wherever they live in
  `packages/test-runner/` or `scripts/`, their tests; `docs/architecture/testing-facility.md`;
  `docs/working/automation-project-agents-plan/reports/<your label>.md`.
- Must not touch: Core files; `apps/extension/**`; `domain/**`.
- Definition of done: tests beside each changed file and every test reading the changed sources; test-runner
  check; `pnpm structure:check`. No live run, and no CLI probe that could reach a provider.

### Brief: W7-bench-dead-flow-lane
- Repository: this repository, the paired worktree the dispatch prompt names.
- Task: remove the recorded-Flow code t553 left unreachable (`reports/t553-w6-key-scope.md`, decisions): the bench's
  Flow-lane evaluation in `packages/test-runner/src/bench/run-bench.ts` (`assertRunnableLane`, the `evaluateFlowRun`
  branch, `flowSources`, the `reconstructBenchEvaluation` Flow branch); the `week2` corpus that now runs nothing
  (retire it with a refusal that says why); `flowLaneExclusion` in `packages/test-contracts` (no consumer left);
  and the declared-repair module that `proposesRepairOnly` (always false for a launchable run) can no longer reach.
  A campaign saved before t553 is already refused on resume; keep that refusal and its message. Never
  extract-and-drop; keep every refusal a person can still meet.
- Owns: `packages/test-runner/src/bench/**`, the corpus definitions, `packages/test-contracts/**` for
  `flowLaneExclusion`, the declared-repair module and its callers, their tests; `docs/architecture/testing-facility.md`;
  report.
- Must not touch: Core files; `apps/extension/**`; `domain/**`.
- Definition of done: tests beside each change and every test reading the changed sources; test-runner and
  test-contracts checks; `pnpm structure:check` (lower the baseline if entries go). No live run, and no CLI probe that
  could reach a provider.

### Brief: W8-lab-orphaned-repair-code
- Repository: this repository, the paired worktree the dispatch prompt names.
- Task: remove what t559 left orphaned (`reports/t559-w7-bench.md`): `apps/scenario-lab` identity-drift `repair.ts`
  with no caller, the dead `declaredRepair` input of `gate.ts`, and the six stale comments the report lists. Never
  extract-and-drop; keep every refusal a person can still meet.
- Owns: those files and their tests; report. Must not touch: Core files; `apps/extension/**`; `domain/**`.
- Definition of done: tests beside each change and every test reading the changed sources; scenario-lab and
  test-runner checks; `pnpm structure:check` (lower the baseline if entries go). No live run or provider probe.

## Work Ledger

### 2026-10-13 — Plan written from three discovery reports
- Agent: supervisor
- Changed: this document (new); Core paired document (new); both `mvp-final-month-plan.md` Current States and indexes
- Why: user direction for a supervisor/builder agent system, queued in the October 13 wrap
- Validation: not validated by tests (planning only); discovery claims spot-checked in Core source (`service.ts:1495` child-build signature, `:2512` re-author call, `authoring-loop.ts:145` tool filter, purse `carriedUsd` and judging reserve)
- Outcome: Accepted
- Follow-up: dispatch Core A1

### 2026-10-13 — Concurrency decision recorded; Core A1-A3 started
- Agent: supervisor
- Changed: this document (Current State, Host Actions, W1, wiring item 5); Core paired document (owning entry of the same date)
- Why: user: "make it possible in core, but have extension set it to only 1 at a time"
- Validation: not validated by tests (planning)
- Outcome: Accepted
- Follow-up: W1 after Core A3

### 2026-10-13 — W1 web lease (t536) and W2/W3 chat attribution (t539)
- Agent: workers t536-w1-web-lease, t539-w2-chat-attribution; supervisor verified and integrated
- Changed: `domain/src/runtime/host-resources/`, `domain/src/client/host-lease.ts`, extension `background/connection/host-lease/`, leased tab; chat `shared/activity/project/`, `unit-history.ts`, `project-message.ts`, lanes by brief; `packages/test-runner/src/lab-runs/rewrite-steps-index.ts`
- Why: units W1, W2, W3; full entries in the Core document's ledger (2026-10-13, t536 and t539)
- Validation: see the Core entries; downstream observed domain tests 29 passed, extension 79 passed (W1), extension 536 passed and Lab index 2 passed (W2), all package checks and the structure audit passed
- Outcome: Accepted
- Follow-up: the Next list above

### 2026-10-13 — Downstream sweep fix-forward (t547, t548)
- Agent: workers t547-domain-sweep, t548-test-runner-sweep; supervisor verified and integrated
- Changed: four domain test files (fixtures for Core t519); six test-runner and scenario-lab test files
- Why: downstream sweep on `7a93c624`: domain 17 failed of 2019, test-runner 13, scenario-lab 1; extension 3004 of 3004 passed
- Validation: domain group -> 100 passed; test-runner group -> 83 passed; crossborder browser paths -> 17 passed; domain and test-runner checks and the structure audit passed; merged `775d685e`, `f7acb9cf` (full entry in the Core document's ledger)
- Outcome: Accepted
- Follow-up: W5

### 2026-10-13 — W5 retire live diagnose, repair and adapt (t552)
- Agent: worker t552-w5-live-adapt-launch; supervisor verified and integrated
- Changed: `packages/test-runner/src/{commands,run-scenario,bench/run-bench,live-llm/live-llm-plan,live-llm/live-llm-run}.ts` and tests; `docs/architecture/testing-facility.md`
- Why: t519 retired bare `--flow`, leaving these tasks unlaunchable; the adaptation gate repairs inside its create-flow `--replays` run and proves reuse with `lab replay`, so the tasks refuse and name those commands
- Validation: test-runner check passed; live-llm plan/run/ceiling, commands, cli-llm, runner-wiring, run-bench tests -> 154 passed; structure audit passed; merged `06daa2c9`
- Outcome: Accepted
- Follow-up: W6 (a probe read the real key from `.env.local` under `FLUXIQ_TEST_ENV_FILES=none`; dead recorded-Flow code outside W5's files)

### 2026-10-13 — W7 bench dead recorded-Flow code (t559)
- Agent: worker t559-w7-bench; supervisor verified and integrated
- Changed: `packages/test-runner/src/bench/**`, corpus (`week2` retired with a refusal), `packages/test-contracts` (`flowLaneExclusion` removed), declared-repair modules removed; `docs/architecture/testing-facility.md`
- Why: code t553 left unreachable
- Validation: test-runner -> 1182 passed; test-contracts -> 169 passed; checks passed; structure audit passed (three baseline entries removed); merged `148262f1`
- Outcome: Accepted
- Follow-up: W8

### 2026-10-14 — A8 round one, four launches in mode `project`
- Agent: supervisor (launch, supervision, debugs); Core fixes t568, t569 by workers, supervisor-verified
- Changed: launches 1-4 of round one (A8 Run Plan, Attempts); 15 debug notes under `language-driven-flow-loop-plan/debugs/`; call cap 64 -> 120 for both modes
- Why: each launch failed on a different defect, each fixed before the next; no run reached a judged whole run
- Validation: `C:/Users/osrs_/FluxStuff/lab-slots/spend-ledger.jsonl`, today's sum -> $0.4502 billed, every run under its $0.25 ceiling; launch 4's results read from `lab-runs/2026-10-14/<runId>/steps/` (crossborder, bigbox, social ended `flow_bootstrap.run_budget_calls_exhausted`; everything-store `flow_bootstrap.post_provider_validation_failed`)
- Outcome: Partial. Round one relaunches after t570 merges and the four lanes are synced
- Follow-up: judge reliability on filtered list reads (everything-store, both modes)

### 2026-10-14 — W8 orphaned Lab repair code (t573); everything-store judge audit
- Agent: workers t573-w8-lab-orphaned-repair-code and a8-everything-store-judge-audit (read-only); supervisor verified and integrated
- Changed: W8 removed identity-drift's callerless `repair.ts`, the adaptation gate's dead `declaredRepair` input and its `declared_repair_not_made` reason, six stale comments; the audit `reports/a8-everything-store-judge-audit.md`
- Why: W8 was left open by t559; the audit settles whether run-mv7vor5f-ea4d08b4's "no" verdicts were right
- Validation: in the t573 worktree: `node --test` gate and flow-lane-evidence-sizes tests -> pass 10, fail 0; identity-drift scenario tests -> pass 14, fail 0; test-runner and scenario-lab checks -> reuse (no errors); `pnpm structure:check` -> passed (194 warnings, 639 baselined); merged `ebde456e`. Audit: 3 of 5 subflow-trial verdicts wrong (two on exactly the oracle's 13 rows); cause in Core `result-verification/read-account/accounts.ts:108`
- Outcome: Accepted. Core t574 fixes the judge's evidence before round one relaunches
- Follow-up: the builder's accessory exclusion dropped three real items in revisions 1 and 3 (a builder-reasoning miss, not mirrored into guidance)

### 2026-10-14 — Lab call backstop at Core's 250 (t576); A8 launch five
- Agent: supervisor (t576, launch, debugs); bigbox debug by worker a8-bigbox-run-mv8186yr-debug (read-only)
- Changed: `packages/test-contracts/src/llm.ts` `LLM_LAB_MAX_CALLS_PER_RUN` 64 -> 250 (Core's own backstop), tests that meant "one past the cap" now say so by the constant, `testing-facility.md`; launch 5 debugs (4) and `reports/a8-bigbox-run-mv8186yr-debug.md`
- Why: the first launch-5 try declared 120 calls and the Lab refused it before any call ($0); a 64-call cap ended project builds at a third of their dollars
- Validation: test-contracts `pnpm run test` -> pass 169, fail 0; test-runner `node --test dist/tests/*.test.js dist/live-llm/tests/*.test.js` -> pass 508, fail 0; existing-fluxiq-control tests -> pass 32, fail 0; test-runner check -> 0 errors; audit passed; merged `06142697`. Launch 5 spend -> $0.104 over four runs (ledger)
- Outcome: Accepted; launch 5 failed on Core defects fixed by t577 and t578-t582

### 2026-10-14 — The Lab names Core's refusals (t589); downstream side of t583 and t585
- Agent: worker t589-lab-core-refusal-reason (two rounds); supervisor (t583 pin test); t585's domain arrival rule; supervisor verified and integrated
- Changed: a 4xx from Core on a Lab control request is the closed reason `core.refused` with endpoint, HTTP status and Core's sentence (kept only if it passes redaction and `isScreenedFacilityRefusal`), printed by the campaign row, attempt and run-outcome lines; the Lab's call cap is pinned to Core's backstop by a plan test; the domain counts an opening on a prepared entry as arriving (`domain/src/runtime/llm-evidence/node-run/{run,arrival}.ts`)
- Why: launch 6 reported a passing build's Core refusal as `unclassified`; three 64s had drifted from Core's 250; a prepared builder was never "arrived"
- Validation: t589: test-contracts `pnpm run test` -> pass 170, fail 0; test-runner facility-failure + run-evaluation -> pass 86, fail 0; lab scripts row, lab-run, live-guards -> pass 98, fail 0; test-runner check -> 0 errors; audit passed. t583 pin: live-llm-plan tests -> pass 26, fail 0. t585 domain: node-run -> pass 356; domain tsc exit 0. Merged `bad7ade1` (t589), `6400924e` (t583), `5e9ec9c2` (t585)
- Outcome: Accepted

### 2026-10-14 — The Lab waits Core's project build bound (t592); domain handle identity (t596)
- Agent: workers t592-project-build-deadline (downstream side), t596-domain-handle-identity; supervisor verified and integrated
- Changed: `packages/test-runner/src/flow-lane/creation/chat/build-deadline.ts`: a project-mode chat build waits Core's `AUTOMATION_STUDIO_PROJECT_BUILD_MAX_DURATION_MS` plus the chat's steps (1_995_000 ms), candidate and legacy unchanged (795_000 ms), pinned to Core's export; `domain/src/runtime/llm-evidence/plan-resolution/element-identity.ts`: where views of one control disagree, the newest view fills the gap one signal group at a time, the floor of two unchanged
- Why: A8 launch 7 lost three project builds to the 795 s deadline; a builder's submission was refused `web.handle.unidentifiable` after an earlier brief's press changed a control
- Validation: t592: test-runner check -> 0 errors; chat tests + live-llm-plan -> pass 51, fail 0; audit passed; merged `60d4629e`. t596: domain llm-evidence -> tests 1105, pass 1105; element-fingerprint -> pass 13; domain tsc exit 0; audit passed; merged `889effd2`
- Outcome: Accepted

### 2026-10-14 — First full sweep of the day, both repositories
- Agent: supervisor (background sweep in a throwaway task worktree, abandoned after; its id was reused by the next task)
- Changed: `domain/src/tests/domain.test.ts`: its recording carries a description (Core requires one since `18ee3f60`, 2026-10-13; the entry failed to load); `4142a836`
- Why: about thirty merges today across both repositories; the twice-a-day sweep rule
- Validation: Core `npx vitest run` (packages/fluxiq, dev `5ef45408`) -> Test Files 1253 passed, 3 skipped; Tests 11508 passed, 7 skipped. Downstream `pnpm -r --no-bail test` (dev `4142a836`) -> boundary-audit 6, real-site-policy 7, test-matrix 17, test-contracts 170, domain 2027, agent-orchestrator 16, test-evidence 19, scenario-lab 702, extension 3004, test-runner 2294 tests, fail 0 in each, none failed to load (the first run stopped at the domain entry above)
- Outcome: Accepted; both repositories' full suites pass

### 2026-10-14 — A8 rounds one and two on one pair; the guard knows the mode (t600); replays wait for the verdict (t602)
- Agent: supervisor (launch 8, round two, debugs); workers t600-guard-knows-authoring-mode, t602-replay-call-accounting, read-only debugs; supervisor verified and integrated
- Changed: the A8 Run Plan's comparison table (launch 8 `project`, round two `candidate`, one pair); t600 ledger entries record the authoring mode and `unchanged` compares only same-mode runs; t602 both replay paths wait for Core's verdict through `packages/test-runner/src/flow-lane/replay/provider-free-replay-run.ts` before reading the call accounting
- Why: round two's candidate social run was refused as an unchanged rerun of a project run; candidate social's correct Flow was failed because the Lab read the replay's accounting 0.4 s too early
- Validation: launch 8 `project`: crossborder and bigbox passed (oracle passed), social and everything-store failed; round two `candidate`: crossborder and bigbox passed, social's Flow passed the oracle (accounting race), everything-store failed (shared judge defect); spend ledger. t600: live-guards tests -> pass 47; `pnpm lab:test` -> pass 212, fail 0; audit passed; merged `a14204a0`. t602: test-runner replay, saved-flow-replay, repair, flow-lane tests -> pass 494, fail 0; check clean; audit passed; merged `d665f3db`
- Outcome: Accepted. `project` does not yet beat `candidate` on this pair; a fresh pair for both modes follows the fixes

## Open Questions

Owned by the user; listed in full, with recommendations, in the Core paired
document: schedule against the MVP (recommended: before the 2026-10-29
freeze behind mode `project`), whether the supervisor may add required
starting cases (recommended: add-only), and whether the person confirms the
plan before builders start (recommended: no blocking step).
