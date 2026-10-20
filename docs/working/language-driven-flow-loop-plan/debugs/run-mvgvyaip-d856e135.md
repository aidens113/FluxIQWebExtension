# run-mvgvyaip-d856e135: office checkout review, rerun round 4

Status: debugged terminal failure. This was a read-only analysis. No source
edit, build, browser run, paid run or commit was made for it.

## Run

- Task `everything-store-office-checkout-review`, rerun round 4, slot 1, lane
  tree `C:/Users/osrs_/FluxStuff/fxwork/t563`. Downstream was at 0cada957 and
  Core at 3b13e394, which is dev with t741's fixes. The build was started from
  the real extension chat, with a $0.25 ceiling. The run was traced (t736).
- Per-step files: `C:/Users/osrs_/FluxStuff/lab-runs/2026-10-20/run-mvgvyaip-d856e135/steps`.
  There are 128 step folders and 60 provider calls, costing $0.04643. That
  equals the live guard's figure, $0.046427.
- Trace: the run's project store
  (`test-runs/instances/rr4-slot-1/persistent-isolated/claude-office-checkout-t563-20261020-r5/fluxiq-root/.fluxiq/artifacts/automation-studio/projects/c27bb819-.../project.sqlite`,
  tables `client_gateway_traces` and `client_gateway_trace_events`). It holds
  one exploration trace (16:22:18-16:28:42) and three trial traces. Core's own
  reset looks are visible there by their call ids (`site-reset.look.N.arrival`).
  Nothing else records them.
- The Lab started at 16:16:29. The build ran from 16:22:18 to 16:28:42, and
  the Lab finished at 16:28:51.
- Verdict: `failed`, `runtime.behavior`, with no Flow created.
- Spend per brief:

  | Brief | Kind | Spent | Calls | Ending |
  | --- | --- | --- | --- | --- |
  | supervisor | - | $0.0038 (+ $0.0020 judge calls, counted in brief-1) | 6 decisions | `partial` |
  | brief-1 | build `checkout_kettle` (p1+p2) | $0.0252 | 30 | partial, stopped by the repeat guard on `unchanged_submission` |
  | brief-2 | repair `checkout_kettle` from rev 2's trial | $0.0150 | 19 | partial, stopped by the repeat guard on `address_not_shown` |
  | brief-3 | reset | $0.0022 | 4 | blocked, stopped by the repeat guard on `address_not_shown` |

  The step index labels brief-3's role "builder", but it is the reset brief
  (`kind: reset`, 0118). The 0121 call the supervisor saw is the reset
  model's call.

## How far it got

- **0003-0006: plan.** One subflow, `checkout_kettle`, carries both parts
  (p1 is the checkout and p2 is the one-row table), with no outputs. So the
  plan named no ports, and round 3's `item` port case did not come up.
- **Brief-1 (0007-0071).**
  - 0007-0015: it searched and opened the product page.
  - Buy Now was refused `candidate.create_baseline_required` (0017).
  - 0018-0031: cart, product page, cart, product page, and then two repeat
    refusals. This is C6 again.
  - 0033: it pressed Buy Now with `resetDestination: destination-4`, the
    product page's sponsored list. This is C5 again.
  - **Revision 1 (0037): `execution_failed` at step 10, "read the order
    total", `web.target.not_found` after 4 attempts.** The model said the
    total's handle had changed once the gift card applied, and moved the read
    to the new total's handle.
  - **Revision 2 (0043): ran to its end, stored 1 row, and both judges said
    no.** The only fault was the delivery address: the home address, because
    no step chose the office one (0046-0047). This is the first office trial
    to store a row at run time, so t738's write-records step works live.
  - 0048-0051: it explored the address chooser and checked the office
    address.
  - **Revision 3 (0055): `execution_failed` at step 11 of 15, "read the
    delivery address", `web.target.not_found` after 4 attempts.**
    - Steps 1-10 all succeeded, including "open the address chooser",
      "choose the office address", "deliver to the office address" (act-12),
      delivery, gift card, Plus off, and the item read.
    - The address read's target carried the **home** address text as its
      identity (the trial trace's extract command: `visibleText`, `tagName p`,
      `role paragraph` and a selector, and nothing else). Step 6 had just
      replaced that text with the office address.
  - 0058-0071: the model resubmitted the same script with `target: t961`
    four times. A capture at 0061 showed t961 now carrying the office text.
    Core answered `candidate.unchanged_submission` three times. Then the
    repeat guard ended the brief, with `stoppedRepeating`.
- **Brief-2, the repair (0074-0114). No trial ever ran.** It started from
  revision 2's trial (`repairFrom`, the closest to passing). It re-explored
  the address chooser and wrote revisions 3 and 4 with the office steps.
  - 0090 (revision 3) and 0105 (revision 4) were refused
    `candidate.trial_reset_required`. Each listed one act: **act-12,
    `trial step 6 "deliver to the office address"`, settle "Read
    destination-3 at <the search-results address> completely again."**
    destination-3 is brief-1's search-results list.
  - 0093: the model navigated to that exact address, without `undoes`. It
    was refused `address_not_shown`.
  - 0108: the model navigated there again with `undoes: act-12`. It was
    refused `address_not_shown`.
  - 0110-0114: the same call three more times, each refused
    `repeat_refused`, and the brief ended.
- **0115-0118: ending.** The supervisor's ending was held with
  `project.completion_reset_first` for act-12 (0116), so it dispatched
  brief-3 as a reset.
- **Brief-3, the reset (0119-0127).**
  - The opening navigated to the start location (0119). Its `phaseStart`
    listed act-12 as still on the site.
  - 0120: the model navigated to the product page, to restore the address
    there. It was refused `address_not_shown` (0121).
  - 0122-0127: it sent the identical call three times. Each was refused
    `repeat_refused`, and the reset came back blocked.
- **0128:** the supervisor ended `partial`.

**Distance.** Brief-1 ran 10 of revision 3's 15 steps. Its checkout part was
complete and correct, office address included. It stopped at the first read
of a value the Flow itself had changed. That is further than round 3, which
never ran a judged run. Revision 2 stored the first row office has ever
stored. The repair and the reset never acted on the site at all.

## First divergent step: 0055-0071, a read target bound to the value it reads

| Step | Model wrote | Product answered |
| --- | --- | --- |
| 0034 (rev 1) | "read the order total" on the total line before the gift card applied | 0037: `web.target.not_found` x4 once the gift card changed the total |
| 0040 (rev 2) | the read moved to the new total's handle | 0043: ran, but judged no (home address) |
| 0052 (rev 3) | "deliver to the office address", then "read the delivery address" on t961, seen while it still showed the home address | 0055: `web.target.not_found` x4 at that read |
| 0058, 0062-0070 | the same script with t961, after a capture (0061) that shows t961 with the office text | `candidate.unchanged_submission` x3, then `repeat_refused` x3 |

- **The identity rule.** Downstream
  `domain/src/runtime/llm-evidence/plan-resolution/element-identity.ts`
  leaves a text field's, textarea's or select's contents out of an identity
  ("its contents ... not its identity"). It keeps the visible text of
  anything else, and that includes a paragraph that a read step reads.
  - The extension's veto (`apps/extension/src/content/identity/veto.ts`)
    then refuses the element whose text changed. A `<p>` with no id or test
    id has little else to corroborate it.
  - So a Flow cannot read a value that one of its own earlier steps
    changes: a total after a discount, a chosen address, a date after a
    delivery choice. This is generic.
- **The rebind failed.** After the 0061 capture, the same handle should have
  resolved to the newer view. Instead Core judged the plan the same behaviour
  (`automationStudioCandidateSameBehaviour` compares the resolved
  parameters, `element` included). So the domain resolved t961 to the same
  identity as revision 3. Why was not traced: either `target-packets.ts`
  kept the older view, or `view-history.ts` merged the two. Either way, the
  model had no move that changes the read's identity.
- Brief-2's revision 4 (0102) reads the address at t961 again. It was
  captured before "deliver to the office address" was pressed, so it would
  very likely have failed the same way had a trial run.

## Terminal cause: 0090-0127, the act's witness sits at an address the brief may not go to

**What t741's A1 did here.** act-12 is a trial act with no witness of its
own, so it adopted every issued list as its witness: destination-1 to
destination-4. These are the home page's lists, brief-1's search-results
list, the sponsored list and the cart. It can settle only when each adopted
list is read fresh and holds. Core's own pre-trial look (`lookFirst` ->
`brief-ports.ts` `looking` -> `start-check.ts` `lookAt`) goes to each stale
list's location with the arrival node, through the same domain `core.run_node`
the model uses.

**Core's own look was refused unrun.** In the exploration trace:

| Trace seq | Time | Call | Sent |
| --- | --- | --- | --- |
| 981-999 | 16:27:38 | `site-reset.look.1.arrival` (home) | capture, **navigate**, capture |
| 1012 | 16:27:42 | `site-reset.look.2.arrival` | capture only, **no navigate** |
| 1021 | 16:27:45 | `reset-read-1` (model, 0093) | capture only, **no navigate**: `address_not_shown` |
| 1118-1136 | 16:28:08 | `site-reset.look.3.arrival` (product page) | capture, **navigate**, capture |
| 1147 | 16:28:12 | `site-reset.look.4.arrival` | capture only, **no navigate** |
| 1159 | 16:28:15 | `reset-search-read-1` (model, 0108) | capture only, **no navigate**: `address_not_shown` |
| 1173 | 16:28:29 | `site-reset.look.1.arrival` (reset brief's `remainingActs`) | capture only, **no navigate** |
| 1199 | 16:28:33 | `nav-kettle` (model, 0121) | capture only, **no navigate**: `address_not_shown` |

`node-run/run.ts` takes the page and then refuses an unshown address
(line 362, `run.addresses.refuses`) before any command goes out. Core's looks
show exactly that signature, so they were refused the same way. Then
`lookAt` answers `unread`, destination-3 stays stale, act-12 stays open with
the `look` words, and Core prints the address its own look could not reach.

**Why the address was "not shown".** `shown-addresses.ts` remembers what
*this brief* was shown, and Core's opening of a fresh round forgets it
(`opening: "fresh"`).

- **brief-2:** a repair opens fresh. It is credited only with the repaired
  proposal's navigations (`repairs`, t648): the start and product pages. It
  never stood on the search-results page and typed nothing, so neither rule
  admits the search address (`sameQuery` needs a typed value or an exact
  shown query).
- **brief-3:** the reset opened fresh with nothing carried. It was refused
  even the product page. The model saw that address twice in its own
  evidence:
  - `core.route_state` `state.page.location`, "where a run starts";
  - the opening's `validation.actual`: "the tab moved from <product page>".

  Neither is a packet or a read, so neither counts.

**Why the model repeated it, and what it was told.**

- The `address_not_shown` detail says to navigate to "an address from the
  evidence -- a link's href, a page's location, a read's address, or the
  start location".
- In brief-2, the address was in Core's own settle words. In brief-3, it was
  a page's location in the evidence. To the model, the refused call met the
  stated rule.
- The repeat refusal then said only "do something different". Deepseek-flash
  kept its plan three times in each brief.
- The one move that would have worked was typing the search again from the
  home page. A typed value makes the query count. Nothing named it.
- So the repeats are a model mistake, but each one was made against
  contradictory feedback.

**A1 made this act harder to settle, not easier, across briefs.**

- Before A1, a witnessless act settled on any one list named under `undoes`.
  The product page's or the cart's list was reachable in every brief.
- A1 requires every issued list to hold, including a search-results list
  that only a typed search reaches.
- t741 reports that the multi-brief entry-preparation variant was covered by
  Core unit tests only, and those tests use a `lookAt` that always lands.

A1 did work inside brief-1. act-6, act-7 and act-10, the trial Buy Now
presses, were settled `unchanged` by Core's looks at the product page and
listed in `startedWith.cannotUndo` (0055, 0090), with no model turn.

## Round-3 causes: status

| Round-3 cause (t741 fix) | Status in this run |
| --- | --- |
| Plan port named `item` (plan-time `project.plan_port_name`) | **Not exercised.** The plan had one subflow and no ports. Unproved live. |
| A1: Core settles witnessless trial acts | **Fired.** It settled act-6/7/10 in brief-1. **Terminal for act-12** in brief-2 and brief-3: an adopted list's address was refused to Core's own look (above). |
| A2: a settling look says what it settled | **Not exercised.** No settling look ever ran. |
| A3: refusals list build-wide open acts | **Working.** brief-2's refusals (0090, 0105) list act-12, which brief-1's trial made. `completion_reset_first` names it too (0116). |
| A4: note for `resetDestination` without `undoes` | Not exercised. |
| Ending cut mid-word | **Gone** from what the failure screenshot shows (`22-failure-panel.png`). Its last lines are whole. The supervisor's own 0128 reason does not appear there; the panel shows Core's draft narration instead (not traced). |
| C4/C5/C6 (carried) | **C5 and C6 still present:** destination-4 (the sponsored list) was accepted as Buy Now's witness at 0033 and 0097, and brief-1 lost 0018-0031 and brief-2 lost 0078-0086 before pressing with a ref. C4 is replaced by A1, with the problem above. |

## Is there one shared weakness across the four office rounds?

Yes. Rounds 2, 3 and 4 each ended inside the site-reset machinery, and
inside the gap between what is per brief and what is per build. None of them
ended because the model misread the site:

- **Round 2:** acts on no list settled by any list (C4), baselines on
  unrelated lists (C5).
- **Round 3:** a settling look went to the owner brief's ledger, so the
  refusal said no acts were open when other briefs' acts were.
- **Round 4:** Core's own reset look and the model's settle navigation went
  through the fresh brief's shown-address memory, which knew nothing of the
  pages earlier briefs had stood on.

Every fix so far patched one subsystem's view of the build. The underlying
weakness is that the facts that belong to the build are held, or gated, per
brief: which pages it stood on, which lists it issued and where, which acts
it left. Core's own reset moves also run through gates written for the
model.

**One structural change** would address the class: a build-scoped site
memory that both repositories read.

1. Core's own reset moves (`lookAt`, `compareAt`) are not model calls and do
   not pass the model's address rule.
2. Every brief's shown addresses are seeded with the build's own places: the
   start, every issued list's location, every act's page, and the build's
   proposal navigations.

Separately, the "deliver to the office address" act class needs a witness of
its own, its page region, as round 3's fix 4(b) proposed. Adopting unrelated
lists as its witness is what put a search-results page in its path.

This run's first divergence (the read target bound to its value) is a
separate, generic defect outside that class. Brief-1 would very likely have
reached a judged yes without it.

## Cause

**Class: product defect.** There are two, plus model repeats against
contradictory feedback.

1. **First divergence (downstream): a read step's target identity includes
   the value it reads.**
   - Where: `domain/src/runtime/llm-evidence/plan-resolution/element-identity.ts`,
     the identity builder that keeps `visibleText` for non-field elements,
     with `apps/extension/src/content/identity/veto.ts`.
   - Effect: a Flow cannot read any value its own steps change.
   - It is compounded by a resubmitted handle that kept its older identity
     (`unchanged_submission` at 0059/0063/0065; `plan-resolution/target-packets.ts`
     or `view-history.ts`, not traced).
2. **Terminal (cross-repository): A1's adopted witnesses send Core's own
   look, and then the model, to an address that the brief's address rule
   refuses.**
   - Where: Core `flow-bootstrap/site-reset/ledger.ts` (`witnessless`
     adoption of `issuedDestinations()`, `lookFirst`) and
     `site-reset/start-check.ts` `lookAt`, against downstream
     `node-run/shown-addresses.ts` `refuses`, `run.ts:362`, and the fresh
     `opening` that forgets.
   - `address_not_shown`'s `instead` words also invite the very address
     Core printed.

The task, oracle and fixture are not the cause. Brief-1's revision 3 did
every checkout fact the task asks for, and revision 2's judge faulted only
the missing office choice.

Environment is not the cause either. The Lab log shows a normal start and a
recorded verdict. There was no provider or balance error, and Core's refused
looks are deterministic domain refusals (no navigate was sent), not stalls.

## Proposed fix (least general first)

1. **A read's target is not identified by the text it reads** (downstream).
   - In `plan-resolution/element-identity.ts`, a target resolved for a
     read node (`web.output.dom-extract`, text or value mode) leaves
     `visibleText` out of `parameters.element`, as a field's contents
     already are. It keeps tag, role, selector, label, `context.record` and
     landmark.
   - Test seams:
     - a plan-resolution test: an extract step on a handle whose text
       differs between two views resolves with no `visibleText`;
     - an extension identity test: an extract target whose paragraph text
       changed is found by its selector and not vetoed.
   - Also trace why a resubmitted handle kept its older identity after a
     newer capture. A rebind to the newest view should change the plan.
2. **Core's own reset moves skip the model's address rule** (cross-repo,
   alert before the Core edit).
   - `start-check.ts` `lookAt`/`compareAt` mark their arrival call in Core's
     frame, as `opening` is marked (t728), never by call-id shape.
   - `node-run/run.ts` does not ask `addresses.refuses` for a marked call,
     in the same way a replay is "this domain's move, not a step of the Flow".
   - Test seams:
     - domain `node-run/tests/shown-addresses.test.ts` or a run test: a
       marked look to an address the brief was never shown runs, and the
       same call written by the model is refused;
     - Core `site-reset/tests/start-check*.test.ts`: the mark is sent.
3. **Seed each brief with the build's places** (cross-repo). Core's opening
   call of every brief (build, repair, reset) carries the build's issued
   lists' locations, act pages and proposal navigations under a key read
   only on the opening, like `repairs` (t648). The domain counts them as
   shown. This covers the model's 0093/0108 and the reset's 0121 calls.
   Test seam: beside `node-run/tests/start-location.test.ts` and the
   `webNodeRepairedFlow` tests.
4. **A1, Core `site-reset/ledger.ts`.** A witnessless act whose adopted list
   Core's own look could not read (`unread`) must not stay open on that list
   forever. Either adopt only lists whose place this brief reached, or prefer
   lists on the act's own page. Weigh this against the user's rule that a
   build undoes its own lasting acts. Test seam: a two-brief
   `project-build-reset-settle` test with a `lookAt` that answers `unread`
   for one adopted list.
5. **Feedback (downstream `shown-addresses.ts` `INSTEAD`).** Say that
   addresses shown to an earlier brief do not carry over, and that a search
   result is reached by searching again. These are generic words. Today they
   name "a page's location", which the model met.
6. **Carried:** C5 (offer a baseline only on a list whose page shows the
   act's effect) and C6 (after the baseline read, say "press again with this
   ref").

None of these touches the task, the oracle or site-specific guidance.

## Not verified

- The refusal reason for Core's own `site-reset.look.2/.4` and brief-3's
  `look.1`. No log records it. It is inferred from the trace signature
  (capture, no navigate), which matches the model's three `address_not_shown`
  calls, and from destination-3's location being the address those calls
  named. That `look.2/.4` targeted destination-3 is inferred the same way.
- Why the resubmitted t961 resolved to revision 3's identity after the 0061
  capture.
- That the extension's veto, and not the selector, is what refused the
  changed address paragraph. Only `web.target.not_found` is recorded.
- Whether act-12 changed anything lasting. The panel says no read showed a
  change from it, while the supervisor's 0128 reason says the office address
  was left saved.
- Whether the supervisor's 0128 ending reason reaches the chat whole. Only
  the final screenshot was checked.

## Rerun guidance

Do not rerun unchanged. Brief-1 will stop at the address read again. A
repair or reset in a multi-brief build cannot settle a trial act whose
adopted list sits on a typed search page. Rerun once fixes 1 and 2 land with
their tests, ideally with fix 3, and after both lane trees are synced.
Expect brief-1's revision 3 to run to the row step and be judged.
