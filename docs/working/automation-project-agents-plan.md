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
lost three builds to the Lab's chat deadline and showed the start-state class of failure a fifth time, so t593 built
one shared phase start for every phase (with t592, t594-t596; all merged). The comparison so far (A8 Run Plan tables):
pair 1 `project` 2 of 4, `candidate` 2 of 4; pair 2 `project` 2 of 4 (two near misses), `candidate` 4 of 4 and
cheaper; wave 3 `project` social passed, everything-store failed on false no's (Core t607), towels failed in both
modes on page-view legends (t605). `candidate` stays the default. t597-t608 are merged and pushed (2026-10-14).
Next: sync the lanes, re-run `project` everything-store, towels in both modes, and `project` social for a
consecutive pass; the default flips only after two consecutive passes per site on one frozen pair.
Wave 4 (2026-10-14) ended at the chat's first model call in all four runs during a DeepSeek API incident ($0).
Merged since: t609-t640. The first frozen pair (after t637) passed six of seven runs; `project` crossborder failed on
pre-existing defects fixed in t638-t640. Frozen pair 2 (after t640, A8 Run Plan) is done: `project` 9 of 10 by the
Lab (10 of 10 by product and oracle), `candidate` 8 of 9; the default is not flipped on it (one Lab misread). Merged
and pushed after it (2026-10-15): Core t641 (partly refuted advice labelled, vindicated conditions held once), t642
(handles never re-bind without a load; hidden-only ties are not found), t643 (a bypassed optional step is not the
run's failure, by Core's `optionalStepWayOn` mark), Core t644 (the four load-sensitive test files). Frozen pair 3
stopped after wave 17: `project` bigbox cart failed on a general `project`-mode defect (A8 Run Plan); t645-t649 fix
it and are merged and pushed. Frozen pair 4 stopped after wave 22 (`project` 2 of 2; `candidate` towels failed on two
general t641-path defects); Core t650 (an invited resend is admitted once) and t651 (a row's own name is never the
request's words) fix them and are merged. Frozen pair 5 stopped after wave 27 (towels failed in both modes on
general judging gaps); Core t652 (a split's no labelled, conditions kept from any trial), t653 (a looping judge reply
keeps its verdict) and t654 (a claim about a row the read never saw is refuted) are merged. In flight: t655 (paired:
reads list rows several conditions left out, and the snapshot carries page groups). Next: frozen pair 6.
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

**Earlier comparisons** (launch 8, pairs 1 and 2, waves 3-11, frozen pair 1, and the Attempts table of launches 1-8)
are archived in [archive/2026-10-15-a8-runs-to-frozen-pair-1.md](automation-project-agents-plan/archive/2026-10-15-a8-runs-to-frozen-pair-1.md).
In short: `project` went from no build starting (launches 1-4) to passing every task, each failure debugged and fixed
structurally (Core t570-t639, downstream t605-t640).

**Frozen pair 2** (downstream `805f7cbd`, Core `797452c1`, after t638-t640; docs-only commits after), waves 12-16, the
five A8 tasks in both modes, twice, no product change between:

| Task | `project` 1 | `project` 2 | `candidate` 1 | `candidate` 2 |
| --- | --- | --- | --- | --- |
| crossborder-marketplace-hub-to-cart | passed $0.081 | passed $0.022 | passed $0.014 | passed $0.015 |
| bigbox-retail-pickup-cart | passed $0.030 | failed per the Lab $0.040: the product succeeded and the oracle passed; a bypassed optional step was read as the run's failure (t641-t643) | passed $0.037 | passed $0.034 |
| everything-store-plus-earbuds-under-50 | passed $0.043 | passed $0.051 | passed $0.053 | passed $0.052 |
| social-network-feed-confirm-requests | passed $0.065 | passed $0.054 | passed $0.035 | passed $0.016 |
| bigbox-retail-pickup-towels | passed $0.080 | passed $0.060 | failed $0.066 (Core t641) | refused by the unchanged guard (round 1 failed on this source) |

**Reading of frozen pair 2 (supervisor, 2026-10-15):** `project` passed 9 of 10 by the Lab's verdict and 10 of 10 by
the product and the oracle; `candidate` passed 8 of 9 and cannot pass towels twice on this pair. `project` is at least
as reliable on every task and more reliable on towels, at a higher mean cost ($0.053 against $0.036 a build; $0.85 for the 19 runs). The strict rule
(two consecutive Lab passes per site, both modes, one frozen pair) is not met for `project` bigbox cart because of the
Lab misread, so the default is not flipped on this pair: t641-t643 fix the three defects it found, and frozen pair 3
repeats the comparison to decide the flip.

**Frozen pair 3** (downstream `8b770037`, Core `8b322a95`, after t641-t644; docs-only commits after), waves 17-21, the
five A8 tasks in both modes, twice, no product change between:

| Task | `project` 1 | `project` 2 | `candidate` 1 | `candidate` 2 |
| --- | --- | --- | --- | --- |
| crossborder-marketplace-hub-to-cart | passed $0.020 | (w19) | passed $0.014 | (w19) |
| bigbox-retail-pickup-cart | failed $0.120: the supervisor ended the build, no Flow (debug `a8-bigbox-cart-run-mv9zn5ob-debug.md`) | (w20) | passed $0.029 | (w20) |
| everything-store-plus-earbuds-under-50 | (w18) | (w20) | (w18) | (w20) |
| social-network-feed-confirm-requests | (w18) | (w21) | (w18) | (w21) |
| bigbox-retail-pickup-towels | (w19) | (w21) | (w19) | (w21) |

**Frozen pair 3 stopped after wave 17 (supervisor, 2026-10-15).** `project` bigbox cart failed on a cause general to
`project` mode (a plan's invented hand-off value, then an amendment that dropped the person's first request; the
debug `reports/a8-bigbox-cart-run-mv9zn5ob-debug.md`), so further `project` runs would fail predictably on a known
defect, and this pair can no longer meet the two-consecutive-passes rule. t645-t649 fix the chain and the chat cards
it showed; frozen pair 4 starts once they are merged.

**Frozen pair 4** (downstream `9c1e164d`, Core `0df06e34`, after t645-t649; docs-only commits after), waves 22-26,
bigbox cart and towels first, the five A8 tasks in both modes, twice, no product change between:

| Task | `project` 1 | `project` 2 | `candidate` 1 | `candidate` 2 |
| --- | --- | --- | --- | --- |
| bigbox-retail-pickup-cart | passed $0.036 (3 subflows) | (w24) | passed $0.031 | (w24) |
| bigbox-retail-pickup-towels | passed $0.030 | (w25) | failed $0.036: a kept-condition refusal's invited resend was refused by the repeat guard (debug `a8-towels-run-mva446jf-debug.md`) | (w25) |
| crossborder-marketplace-hub-to-cart | (w23) | (w25) | (w23) | (w25) |
| everything-store-plus-earbuds-under-50 | (w23) | (w26) | (w23) | (w26) |
| social-network-feed-confirm-requests | (w24) | (w26) | (w24) | (w26) |

**Frozen pair 4 stopped after wave 22 (supervisor, 2026-10-15).** `project` passed both runs (bigbox cart with three
subflows, the task it failed in wave 17; towels). `candidate` towels failed on two general Core defects from t641's
path (debug `reports/a8-towels-run-mva446jf-debug.md`): the invited resend of a kept-condition refusal is refused by
the repeat guard, and a condition testing a row's own name was vindicated. Either can end a build in either mode, so
later waves would fail predictably. t650 and t651 fix them; frozen pair 5 starts once they are merged.

**Frozen pair 5** (downstream `ee0723db`, Core `8c39a3f7`, after t650-t651; docs-only commits after), waves 27-31,
bigbox cart and towels first, the five A8 tasks in both modes, twice, no product change between:

| Task | `project` 1 | `project` 2 | `candidate` 1 | `candidate` 2 |
| --- | --- | --- | --- | --- |
| bigbox-retail-pickup-cart | passed $0.052 (2 subflows) | (w29) | passed $0.038 | (w29) |
| bigbox-retail-pickup-towels | failed $0.067: whole-Flow trial unsure, judges disputed a 9-row read (debug `a8-towels-run-mva6mlo8-debug.md`) | (w30) | failed $0.083: out of time after 8 trials, same dispute | (w30) |
| crossborder-marketplace-hub-to-cart | (w28) | (w30) | (w28) | (w30) |
| everything-store-plus-earbuds-under-50 | (w28) | (w31) | (w28) | (w31) |
| social-network-feed-confirm-requests | (w29) | (w31) | (w29) | (w31) |

**Frozen pair 5 stopped after wave 27 (supervisor, 2026-10-15).** Bigbox cart passed in both modes; towels failed in
both, on general judging gaps, not a t650/t651 regression (debug `reports/a8-towels-run-mva6mlo8-debug.md`): every
9-row read matched the oracle, the judges disputed it with nothing real, and Core could not answer (an unlabelled
split, kept conditions only from a double no, nothing recorded of what a site filter left out, unseen-row claims not
refuted, looping judge replies lost at the output ceiling). Pair 4's project towels pass was a lucky judge draw. Core
t652-t654 fix them; frozen pair 6 starts once they are merged.

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

Entries for 2026-10-13 (plan, concurrency decision, W1-W3, the sweep fix-forward, W5, W7) are archived in
[archive/2026-10-15-ledger-2026-10-13.md](automation-project-agents-plan/archive/2026-10-15-ledger-2026-10-13.md).

Entries for 2026-10-14 (A8 rounds one to wave 4, t573-t613 downstream sides, the two sweeps) are archived in
[archive/2026-10-15-ledger-2026-10-14.md](automation-project-agents-plan/archive/2026-10-15-ledger-2026-10-14.md).

Entries for 2026-10-15 waves 4-7 (t605-t630 downstream sides, the second sweep, the canaries) are archived in
[archive/2026-10-15-ledger-waves-4-7.md](automation-project-agents-plan/archive/2026-10-15-ledger-waves-4-7.md).

### 2026-10-15 — A8 wave 8
- Agent: supervisor (wave 8, four runs); read-only debugs `a8-towels-run-mv9gbsea-debug.md`, `a8-towels-run-mv9gbsm5-debug.md`
- Changed: the A8 Run Plan's wave 8 table and reading; debug notes for all four runs
- Why: wave 8 on the pair after t629 and t630
- Validation: `project` everything-store passed ($0.048, its second in a row), `project` social passed ($0.068, its third in a row; a slow-down repair added the branch); `project` towels failed ($0.082: the exact rows four times, judges wrong) and `candidate` towels failed ($0.020: a site filter admitting delivery, judged yes); spend ledger
- Outcome: Accepted. Towels in both modes is a judge problem (Core t631, t632, t633); wave 9 after t633

### 2026-10-15 — A8 wave 9
- Agent: supervisor (wave 9, four runs); read-only debug `a8-social-run-mv9ml775-debug.md`
- Changed: the A8 Run Plan's wave 9 table, the tally of waves 5-9; debug notes for all four runs
- Why: wave 9 on the pair after t631-t635
- Validation: `project` everything-store passed ($0.037, third in a row), `project` towels passed ($0.096), `candidate` towels passed ($0.030, Core reported `unverified`, the oracle passed), `project` social failed ($0.088, fixed by Core t636 and t637); spend ledger
- Outcome: Accepted. From wave 10 the pair is frozen for the default-flip comparison: the five A8 tasks in both modes, twice, with no fixes in between; wave 10 starts with crossborder hub-to-cart and bigbox pickup-cart in both modes as a regression check

### 2026-10-15 — A8 waves 10 and 11 on a frozen pair; a navigate needs an address (t640)
- Agent: supervisor (waves 10 and 11, the first frozen-pair rounds); read-only debug `a8-crossborder-run-mv9q50ui-debug.md`; worker t640-navigate-needs-address
- Changed: the A8 Run Plan's frozen-pair table; t640 `domain/src/output-nodes/native-runtime.ts` and `apps/extension/src/runtime/action-runner.ts` refuse a navigate whose url has no value before dispatch, with the invalid-parameter code and a new closed reason `parameter_has_no_value` naming `url` (`domain/src/runtime/llm-evidence/tool-rejection.ts`, `action-failure/refusal.ts`)
- Why: on the frozen pair `project` crossborder failed (pre-existing defects: Core t638, t639, and a url-less navigate reported as a policy refusal); the other six runs passed
- Validation: frozen pair (downstream `112ad66e`, Core `cf928307`): crossborder `project` failed $0.070, `candidate` passed $0.016; bigbox cart passed in both ($0.042, $0.035); everything-store passed in both ($0.036, $0.067); social `project` passed $0.048. t640 after merging dev: `test-domain.mjs output-nodes runtime/llm-evidence` -> tests 1367, pass 1367, fail 0; domain tsc (both) exit 0; `check-extension.mjs` exit 0; `test-extension.mjs src/runtime/tests` -> pass 266, fail 0; audit passed; merged `a07d00f6`; pushed
- Outcome: Accepted. The comparison restarts on the pair after t638-t640

### 2026-10-15 — A8 frozen pair 2; handles stay put within a document (t642); a bypassed optional step is not the run's failure (t643)
- Agent: supervisor (waves 12-16, frozen pair 2); read-only debugs `a8-bigbox-cart-run-mv9v3u68-debug.md`, `a8-towels-run-mv9ul5dy-debug.md`; workers t642-stable-handles-and-hidden-ties, t643-lab-bypassed-optional-not-failure; supervisor replaced t643's label match with a structured mark in Core, verified and integrated
- Changed: the A8 Run Plan's frozen pair 2 table and reading (earlier tables archived); t642 `domain/src/runtime/llm-evidence/stable-handles.ts` refuses tier 4 rebinding for a number last seen in the same document (`navigation.timeOrigin`) and puts shadow depth in a place, `apps/extension/src/content/action-runtime/resolve-target.ts` answers not found when several matches are all hidden (per strategy and in the scored fallback; the gate moved to `resolution-gate/`); t643 `packages/test-runner/src/flow-lane/optional-bypass/` reads Core's `optionalStepWayOn` mark on the selected candidate plus the next attempt's node, bypassed failures become `bypassedOptionalFailures` notes, the repair-lane gate names `oracle_failed`, `flow_reported_failure` or `judgement_failed`; Core's ladder sets the mark (`executor/recovery-ladder.ts`, `contracts.ts`)
- Why: frozen pair 2 `project` bigbox cart: a handle moved to a later panel's close button without a page load, three hidden look-alikes tied at playback, and the Lab read the optional step Core went past as the run's failure though the product and the oracle passed
- Validation: frozen pair 2 (downstream `805f7cbd`, Core `797452c1`): `project` 9 of 10 by the Lab, 10 of 10 by product and oracle; `candidate` 8 of 9 (towels failed, then refused as unchanged). t642 after merging dev: domain tsc (both) exit 0; `test-domain.mjs runtime/llm-evidence` -> tests 1130, pass 1130, fail 0; `check-extension.mjs` exit 0; `test-extension.mjs content/action-runtime content/identity` -> 483 pass, 0 fail; audit passed; merged `c5830221`. t643 after merging dev and rebuilding Core: Core tsc exit 0; vitest executor -> 101 files, 875 passed (the new ladder test fails without the mark); test-runner check and build exit 0; flow-lane, optional-bypass, repair, creation, adaptation dist tests -> tests 493, pass 493, fail 0; audit passed (both repos)
- Outcome: Accepted. Not live-tested yet; frozen pair 3 exercises both
- Follow-up: a child frame that reloads while the top page does not now gets new handle numbers (safe, less helpful)

### 2026-10-15 — A8 frozen pair 3 wave 17; stopped on a general `project` defect; a repair may revisit its own addresses (t648)
- Agent: supervisor (wave 17, the stop); read-only debug `reports/a8-bigbox-cart-run-mv9zn5ob-debug.md`; workers t645-t649 (one per fix, partitioned by file); t648 two rounds (round 1 blocked: Core never passed the repaired proposal); supervisor reserved the opening call-id prefix in Core, verified and integrated
- Changed: the A8 Run Plan's frozen pair 3 table and stop note; t648 `domain/src/runtime/llm-evidence/node-run/arrival.ts` reads `repairs` on Core's opening call (the repaired proposal's calls) and `run.ts` counts their navigation addresses as held; Core's opening id is recognised scoped (`initial.<toolId>.<scope>`) as well as unscoped, so a scoped builder's `held`, `arrived` and `repairs` are no longer refused as unexpected keys; Core `project-agents/dispatch/run-brief.ts` sends `repairs`, and `llm/evidence-loop/call-id.ts` files a model-written `initial.` id under `model.`
- Why: frozen pair 3 `project` bigbox cart failed on a general chain (an invented hand-off value, code-only returns, an amendment dropping the person's first request, a false "cannot be done"); its repair builder was refused its own proposal's address six times
- Validation: wave 17: crossborder passed in both modes ($0.020 `project`, $0.014 `candidate`), bigbox cart `candidate` passed $0.029, `project` failed $0.120. t648 after merging dev: domain tsc (both) exit 0; `test-domain.mjs runtime/llm-evidence` -> tests 1134, pass 1134, fail 0 (the 4 new tests fail on HEAD's arrival.ts and run.ts); audit passed; Core tsc exit 0; vitest llm and project-agents/dispatch -> 216 files, 2083 passed; Core `pnpm check` -> passed; merged downstream `b61d6b37`, Core `5c504b16`; both pushed
- Outcome: Accepted. Frozen pair 4 waits for t645, t646, t647, t649

### 2026-10-15 — One read value is expressible (t646); t645 and t647 merged in Core
- Agent: worker t646-read-one-value (two rounds); supervisor verified and integrated; Core t645 and t647 (Core ledger)
- Changed: `domain/src/output-nodes/definitions.ts` and `output-nodes/extract/` (new): `web.dom.extract` declares a data output `value`, filled from its read by Core's `resultPath` copy; `domain/src/actions/schemas.ts` and the extract catalog text describe the `extract` parameter with every mode; `node-run/replay.ts` carries a replayed read's value on the port; `docs/architecture/web-capabilities.md`, `build-loop.md`
- Why: wave 17 `project` bigbox cart: one read value could not be handed on, so the builder copied a list extraction
- Validation: after merging dev: `test-domain.mjs output-nodes actions runtime/llm-evidence/node-run runtime/tests/adapter` -> tests 787, pass 787, fail 0; domain tsc (both) exit 0; `check-extension.mjs` exit 0; audit passed; Core half `pnpm check` -> passed; merged downstream `340aa8cf`, Core `7a3838ce`; both pushed
- Outcome: Accepted. Frozen pair 4 waits for t649

### 2026-10-15 — Project chat cards are honest (t649); every wave-17 fix merged
- Agent: worker t649-project-chat-cards-honest (three rounds); supervisor verified and integrated
- Changed: `apps/extension/src/shared/activity/declined-submission.ts` (a safety net now that Core declines refused subflow submissions itself), `panel/chat/stream/step/{return-reason,brief-wait,project-message,project-words,action-card,messages}.ts`: plain words on return cards, a waiting brief names the part it starts after (Core's `after`) and reads "Not started" if it never ran; `background/activity/supervisor-ending.ts` and `pacer.ts`: the failure toast carries the supervisor's reason from the build's last row; `docs/architecture/extension-client.md`
- Why: wave 17 `project` bigbox cart's chat (debug section 8)
- Validation: after merging dev: `test-extension.mjs background/activity/tests shared/activity panel/chat` -> tests 536, pass 536, fail 0; `check-extension.mjs` exit 0; test-runner check exit 0; audit passed; Core half `pnpm check` -> passed; merged downstream and Core `eca33297`; both pushed. No browser run yet: frozen pair 4's UI review covers the cards
- Outcome: Accepted. t645-t649 all merged; frozen pair 4 next

### 2026-10-15 — A8 frozen pair 4 wave 22; stopped on two t641-path defects; Core t650, t651
- Agent: supervisor (wave 22, the stop); read-only debug `reports/a8-towels-run-mva446jf-debug.md`; Core workers t650, t651 (Core ledger)
- Changed: the A8 Run Plan's frozen pair 4 table and stop note; Core t650 (the repeat guard admits a refusal's invited resend once), t651 (a condition testing a row's own name is never the request's words, nor a reason to refute "Missing rows")
- Why: wave 22 `candidate` towels: t641's invited resend was refused by the repeat guard, and the condition t641 held tested the product name
- Validation: wave 22: `project` bigbox cart passed $0.036 (three subflows), towels passed $0.030; `candidate` bigbox cart passed $0.031, towels failed $0.036. Core t650 and t651 each `pnpm check` -> passed; merged and pushed
- Outcome: Accepted. Frozen pair 5 next

## Open Questions

Owned by the user; listed in full, with recommendations, in the Core paired
document: schedule against the MVP (recommended: before the 2026-10-29
freeze behind mode `project`), whether the supervisor may add required
starting cases (recommended: add-only), and whether the person confirms the
plan before builders start (recommended: no blocking step).
