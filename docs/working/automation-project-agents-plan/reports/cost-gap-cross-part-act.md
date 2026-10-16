# Cost gap: an earlier builder does a later part's act (frozen pair 8)

Worker report for brief `cost-gap-cross-part-act`. Core read at
`C:/Users/osrs_/FluxStuff/!FluxIQ` on `dev` (head `9f8c7116`), read only.
Core paths below are relative to
`packages/fluxiq/src/programs/automation-studio/runtime/`. Run paths are
relative to `C:/Users/osrs_/FluxStuff/lab-runs/2026-10-16/`.

## Outcome

Done. All three runs traced. The brief's premise needs one correction. In every
case the act that left the later part "already done" was carried out again by
the **predecessor's passing proposal** when Core prepared the entry. It was
not left over from exploration: the phase-start reset worked every time. The
trigger was a subflow trial that was judged yes while it held another part's
step. The waste came after that: the supervisor merged the two parts, and
Core's carry rule dropped the done proposal, so the whole thing was built
again. Social round 2 is a separate case. Its later part only reads, so a
predecessor can never do it, but the builder said it was done and Core
accepted that.

The runs:

| Run | Scenario, round | Cross-part brief | Wasted spend (briefs) |
| --- | --- | --- | --- |
| `run-mvan7giv-4246aafb` | crossborder r1 | brief-4 blocked (steps/0088-0093); merge, brief-5 rebuild (0101-0167) | about $0.054 (brief-4 $0.0051, brief-5 $0.0484) of $0.142 |
| `run-mvaox0pl-9d52acc6` | crossborder r2 | brief-2 blocked (0048-0063); merge, brief-3 rebuild (0067-0095) | about $0.034 (brief-2 $0.0077, brief-3 $0.026) of $0.081 |
| `run-mvapd33q-06afdebe` | social r2 | brief-2 blocked (0047-0054); merge, brief-3 rebuild (0058-0110) | about $0.046 (brief-2 $0.0066, brief-3 $0.0396) of $0.109 |

All three are `project` mode: each has `tool-project.write_plan` and
`tool-project.dispatch` steps. Their summaries say `verdict: passed`, so the
cost here is spend and time, not failed builds.

## What changed and why

Only this report. No source, docs or run records were touched.

## Findings

### Timeline per run

**Crossborder r1 (`run-mvan7giv-4246aafb`).** The plan (steps/0006) has
`p1` (put three hubs in the cart, `lastingActs: [create_new]`) in
`add_hub_to_cart`, and `p2` (collect the store coupon, `[create_new]`) in
`collect_coupon`, which runs after it.

- Brief-1 (p1). It collected the coupon while exploring (0024, summary "now I
  collect the store coupon before adding three to the cart", declared
  `consequences: []`), and wrote it into rev 1 as step s9. Both judges said
  **no** because s9 was out of scope (0032, 0033). The builder removed it
  (0034); rev 2 passed.
- Brief-2 (p2) opening look (0043). `phaseStart.putBack: [act-11]`, and the
  page shows `t962 "Get coupons"`, so the coupon was **not** collected: the
  reset worked. Brief-2 then pressed it itself (0046, 0047) and said "already
  collected" (0048) about its own press. It ended blocked for
  `subflow.input_unread` (0042 return), not because a predecessor had done its
  part. On brief-2 the brief's premise does not hold.
- Amendment (0055) dropped the `itemPage` output, and with it the brief-1
  proposal. That is a separate cause.
- Brief-3 (p1) collected the coupon again (0079, declared `create_new`) and put
  it in rev 1 as `collect the store coupon ... consequences: none` (0081).
  **Both judges said yes** (0085, 0086). 0085 says the coupon step "belongs to
  the out-of-scope part p2, but it is a non-lasting act on the item page".
- Brief-4 (p2) opening (0088). `putBack: [act-25]`, then predecessors ran
  brief-3's rev 1, which collects the coupon, so the page shows
  `t962 "Collected"`. `predecessorsLeftOnSite` lists only the add-to-cart
  (act-29). The builder ended blocked (0093): "The store coupon is already
  collected ...".
- Supervisor (0098, 0099). It amended to carry p2 inside `add_hub_to_cart`.
  `proposalsDropped: add_hub_to_cart, why: ["its role changed", "its inputs or
  outputs changed", "its parts changed"]`, `proposalsCarried: null`. Brief-5
  rebuilt it from scratch in 34 calls, then the whole trial passed (0171).

**Crossborder r2 (`run-mvaox0pl-9d52acc6`).** Same plan shape (0004: p1 and
p2 both `[create_new]`, output `itemUrl`).

- Brief-1 collected the coupon in exploration (0036, declared `create_new`).
  Its rev 1 holds `collect the store coupon ... consequences: none` (0038).
  The judges said yes (0042, 0044) and never mention the coupon step.
- Brief-2 opening (0048). `putBack: [act-12]`, predecessors ran, coupon
  "Collected", `predecessorsLeftOnSite: [act-16 add to cart]` only. It ended
  blocked (0063).
- Supervisor (0064, 0065). It merged p2 into `add_to_cart` and dropped
  `itemUrl`. The subflow becomes router-run (`callable: false`). The proposal
  was dropped for role, interface and parts; brief-3 rebuilt it (15 calls).

**Social r2 (`run-mvapd33q-06afdebe`).** Plan (0009): `p1` (confirm requests
with at least five mutual friends, `[modify_existing]`) in `confirm_requests`,
and `p2` (a table of the accepted requests, `lastingActs: []`) in
`read_accepted`, which runs after it.

- Brief-1's rev 1 reads the pending requests and confirms each one (0040). Its
  trial passed with `rows: 4`.
- Brief-2 opening (0047). `putBack: [act-3..act-6]`, predecessors ran, and
  `predecessorsLeftOnSite` lists the four confirms. The entry note tells it:
  "If one of them is what a part of yours asks for ... end the brief blocked
  naming that act". The builder read the list twice itself (0050-0053), then
  ended blocked (0054): "the read of them is already available ... nothing of
  my brief is left to do". That is wrong. A read part can only be done by its
  own steps.
- Supervisor (0055, 0056). It merged both parts into a new key,
  `confirm_and_read`. `proposalsDropped: confirm_requests, why: ["it is no
  longer in the plan"]`. Brief-3 rebuilt both parts (30 calls).

### (1) What tells or stops a builder from doing another part's act while exploring

There is nothing that stops it, and the builder is told only what to write,
not what to do.

- **Brief words.** `flow-bootstrap/subflow-candidate/builder-loop.ts:172`
  (`briefWords`) is the only scope sentence, and it sits in the description of
  `core.submit_subflow`'s `flow` field (seen in steps/0010-decide/request.txt
  line 314): "Any other part of the task is another builder's subflow: write
  none of its steps here."
  - It covers writing, not acting while exploring.
  - The other parts' words are never listed. The builder still sees the whole
    instruction (request.txt line 656), coupon sentence included.
  - `project-agents/dispatch/scope.ts:25-38` puts only the brief's own parts in
    `AutomationStudioSubflowScope`. The other parts' words reach only the
    *trial judge* (`service/project-build/task-checklist.ts:53-68`,
    `outOfScope`).
- **Permitted acts are classes, not parts.**
  - `project-agents/contracts/asked-acts.ts:15-19` (t575): when any part of the
    brief acts, the brief is permitted *every* lasting class the task spec asks
    for anywhere. That reaches the brief through
    `project-agents/supervisor/brief-input.ts:75` and
    `service/project-build/brief-ports.ts:220-222`.
  - So the only after-the-fact notice, `outsideBrief` (`brief-ports.ts:418-424`,
    `landedOutside` at `:432-436`), fires only for a class no part asks for.
  - Here both parts asked `create_new`, and the coupon press declared either
    `create_new` (r1 0079, r2 0036) or `[]` (r1 0024). It could never fire, and
    no step result in any 2026-10-16 run carries `outsideBrief`.
- **Classification.**
  - A press that declares `[]` but changes its page is recorded as a
    *possible* act (`flow-bootstrap/site-reset/ledger.ts:98-113`, `:293`). It
    is never asked for, never refused, and never reported as outside.
  - In a proposal, a step written `consequences: none` passes
    `subflow.lasting_act_missing` as long as some other step declares an act
    (`flow-bootstrap/subflow-candidate/scoped-submission.ts:286-295`, "some act
    is declared" only).
- **Refusal.** None, by design: `brief-ports.ts:130-138` (t580, the user's
  rules of 2026-09-30 and 2026-10-01). Creating and modifying are asked of
  nobody, and no press is refused beforehand.
- **The judge is the only check, and it is a model's call.**
  `result-verification/build-test/task-checklist.ts:61-65` (t594) tells the
  subflow-trial judge that a step doing an `outOfScope` part means answering
  no. That worked once (r1 0032, 0033) and failed twice (r1 0085 and 0086, r2
  0042 and 0044). In 0085 the step's own `consequences: none` label let the
  judge call the coupon press "non-lasting".

### (2) Whether the act was in the ledger, and why the phase start did not put the site back

- **In the ledger.**
  - Exploration presses: r1 0024 declared `[]`, so it went in as a `possible`
    act (ledger.ts:293, the project ledger's `possible` option). r1 0079 and r2
    0036 declared `create_new`, so they went in as real acts. The build record
    writes every act through `service/project-build/acts-record.ts:83-93`.
  - The coupon press the *preparation run* made came from a proposal step
    declared `none` that changed its page. By code it is a `possible` trial act
    (`service/candidate-trial/landed-acts.ts:94`), recorded through
    `phase-start.ts:165-168`.
  - That act is filtered out of what the builder is shown:
    `brief-ports.ts:271` keeps `!act.possible`, and `predecessorsLeftOnSite`
    lists only the add-to-cart (r1 0088 act-29, r2 0048 act-16). I could not
    confirm its act id from the step files (see Not verified).
- **The phase start did put the site back.**
  - `service/project-build/phase-start.ts:156-160` runs the start hook, then
    `putBack`. The ledger counts every act undone, possible ones included
    (`ledger.ts:77-97`; only non-possible acts are named, `:355`).
  - Evidence: r1 brief-2's opening (0043) shows `"Get coupons"` after
    `putBack: [act-11]`.
  - Then step (d), `phase-start.ts:162-168` with `entry-preparation.ts:60`, ran
    the predecessor's latest passing proposal. That proposal holds the coupon
    step, so the act was made again, as that subflow's own Flow does it. This
    follows the user's reset rule: the reset undid the build's acts, and the
    re-act belongs to an accepted proposal.
  - So a reset cannot fix this. The fault is upstream: a proposal judged yes
    while doing another part.
- **Gap noted but not exercised here.** Every run had a start hook. With no
  hook, `phase-start.ts:159` returns `putBack: []`, and possible acts are never
  asked for (ledger.ts:98-113). A later part's act that an earlier builder made
  while exploring and declared `[]` would then still be on the site when the
  next builder looks.

### (3) What the later brief is told, and what the supervisor did

- **What the later brief is told.**
  - `builder-loop.ts:189-194` (`alreadyDone`, t594) says that if the page
    already shows one of its parts as done, a subflow before it did that part,
    and it should end blocked naming which.
  - `brief-ports.ts:372-380` and `:391` (`entryNote`, `PREPARED`, t638) add
    "what they did is already done, so do not do it again" and "If one of them
    is what a part of yours asks for ... end the brief blocked naming that
    act".
  - `scoped-submission.ts:289-291` repeats the invitation.
  - `builder-loop.ts:262-263` admits `ended: "blocked"` before anything was
    submitted, for any dependent builder.
  - Nothing checks the claim. Social brief-2's part asks no lasting act and was
    still let out.
- **What the supervisor did.**
  - The return says "Read its reason: send a changed brief ..., change the plan
    with project.amend_plan, or end honestly"
    (`project-agents/supervisor/guidance.ts:96`, `:179`).
  - Each time the supervisor merged the later part into the predecessor's
    subflow. That is a good plan, but the merge changed the subflow's role
    (callable to router-run), dropped an output nobody now read, and in social
    renamed the key.
  - The carry rule (`project-agents/supervisor/state.ts:552-581`, additive only
    under `ADDITIVE_REASONS` at `:584` and `outputsAdded` at `:592`, t658)
    carries a proposal only when parts or outputs are *added*, with the same
    key, role and inputs. So the done proposal was dropped (`plan-tool.ts:103`,
    `proposalsCarried: null` in all three runs).
  - In both crossborder runs the dropped proposal **already did both parts**
    (r1 0081, r2 0038). One trial of it would have passed.

### (4) Recommended structural fix

Of the three options in the brief, refusing the press is rejected; the other
two are taken, in the form below.

**Rejected: refusing another part's lasting act during exploration.**

- It breaks the user's rules: the model may do anything a person could, gated
  only by permissions, and no press is refused beforehand.
- Core also cannot tell which part a press belongs to. Classes are shared
  across parts by design (`asked-acts.ts`), and in these runs the press
  declared the very class the builder's own part asks for, or none.

**Kept as it is: undoing at the next phase start.** It already happens and
worked in all three runs. It cannot help, because the re-act comes from an
accepted proposal.

**The fix: Core owns "a predecessor did my part" and keeps the work.** It has
four pieces, each general to any site.

**Fix A: the ending names what did it, and Core checks the claim**
(`flow-bootstrap/subflow-candidate/builder-loop.ts`).

- Add an optional `doneBefore: { part: string; act?: string }` to the ending
  shape: `ENDING_KEYS` `:123`, `completionSchema` `:341-349`, and the wording
  at `:128` and `:189-194`.
- In `endingCheck` (`:259-269`), admit a blocked ending made before any
  submission (`:263`) only when:
  - the scope has predecessors;
  - the named part is one of `scope.parts` and has a non-empty `lastingActs`;
  - and, where `act` is given, it is an act the preparation run landed.
- Otherwise refuse it with a new code, `subflow.done_before_refused`. The words
  depend on why:
  - A part that asks no lasting act: "its result comes only from this
    subflow's own steps; build it from this page."
  - An act that is not the preparation run's: "this build's act from
    exploration, which every trial's reset undoes; build the step that does
    it."
- This is a fact about the scope, not page text. Social brief-2 would have been
  refused and would have built its read from the done state (option 3 of the
  brief). The builder needs the preparation run's act ids, which Fix B
  supplies.

**Fix B: show possible acts too** (`service/project-build/brief-ports.ts`).

- `:271` drops `!act.possible`, and `entryNote` (`:372-380`) lists possible
  acts under `predecessorsLeftOnSite` marked `possibly: true`. The coupon press
  is exactly such an act.
- Gate the "end the brief blocked" sentences on there being any scope part
  with `lastingActs`: in `entryNote` and `PREPARED` (`:378-379`, `:391`), and in
  `builder-loop.ts:189-194`. A brief whose parts only read should be told only
  "explore and build from here".
- The dependent builder's port needs the scope's parts' `lastingActs`, which
  `AutomationStudioSubflowScope` already carries (`dispatch/scope.ts:30`).

**Fix C: a merge into the predecessor carries its proposal**
(`project-agents/supervisor/state.ts`).

- Widen `changes()` (`:552-581`) and `carry()` (`:506-543`) with an *absorb*
  rule. A done proposal of subflow A is carried forward (t658 `forward`,
  `carriedFrom`) when all of these hold:
  - some subflow S of the new plan holds every part A was built for, same or
    reworded, plus parts that came only from subflows whose latest brief came
    back blocked as done before (Fix A's `doneBefore`, kept on the return in
    `dispatch/ending.ts`);
  - its key is A's, or A's key is gone from the plan (a rename);
  - its role is A's or changes callable to router-run;
  - its inputs are A's, or A had none;
  - every output A lost is one no subflow of the new plan takes.
- The carried proposal stays not done. Its next build brief starts from it
  (`project-agents/dispatch/run-brief.ts:374-388`, `carriedOf`), converts its
  `part` header if the role changed, submits, and tests. One trial judged on
  every part replaces a 15-34-call rebuild.
- `plan-tool.ts:103-115` lists it under `proposalsCarried` with an `absorbed`
  reason.
- Keep everything else dropped exactly as now. A subflow running after a
  dropped one is still dropped (`:516-527`).

**Fix D: tell builders the other parts while exploring** (wording only, no
refusal).

- `dispatch/scope.ts:25-38` adds `outOfScope: [{ partId, text }]` to the scope.
  This needs a field on `AutomationStudioSubflowScope` in
  `flow-bootstrap/subflow-candidate/contracts.ts`.
- `briefWords` (`builder-loop.ts:172`) names them and says: doing one of them
  while exploring is allowed, but it is another builder's part, it changes
  where that builder starts until a reset, and no step of this subflow does
  it.
- This lowers how often the problem happens. A to C make the outcome cheap and
  correct when it still happens.

**Optional E: judge robustness.** In the subflow-trial summary, mark a step
whose trial act was recorded `possible` (`landed-acts.ts:94`) as possibly
lasting. That stops a judge excusing an out-of-scope press as "non-lasting"
because of its own `consequences: none` label (r1 0085). It is lower priority:
with A to C, a lax yes no longer costs a rebuild.

**Optional F: the no-hook gap.** With no start hook, before a dependent
builder's first look, run the build's reset brief
(`project-agents/dispatch/reset-loop.ts`) when the project ledger holds a
non-possible act in place that the preparation run did not make
(`phase-start.ts:159-160`, `onSite`). Not exercised by these runs.

**Tests to add** (each in the `tests/` folder beside its subject):

- `flow-bootstrap/subflow-candidate/tests/builder-ending.test.ts`. Extend it so
  that a dependent builder's blocked ending before any submission is:
  - refused `subflow.done_before_refused` when the named part has
    `lastingActs: []`;
  - refused when `doneBefore.act` is not one of the preparation run's acts;
  - admitted when the part acts and the act is the preparation run's;
  - refused for a builder with no predecessors, as now.
- `flow-bootstrap/subflow-candidate/tests/builder-loop.test.ts`. The brief
  words name the out-of-scope parts, and the "end blocked" sentence appears
  only when a scope part acts.
- `service/project-build/tests/project-build-brief-ports.test.ts`.
  - The entry note lists a possible act the preparation run landed, marked
    `possibly`.
  - A scope that only reads gets no "end the brief blocked" sentence.
- New `project-agents/supervisor/tests/amend/absorbed-part-carried.test.ts`.
  - Merging a done-before part into its predecessor carries the predecessor's
    proposal: role callable to router-run, an unread output dropped, a
    renamed key. It lands under `proposalsCarried` with
    `carriedFrom.addedParts`.
  - The same merge without a done-before return still drops it.
  - A changed input still drops it.
  - A subflow after a dropped one is still dropped.
- `service/project-build/tests/project-build-task-checklist.test.ts`, for E if
  taken: a possible-act step is marked in the summary.

**What must not change:**

- **No press is refused before it runs.** Only the permission gate (delete,
  move money, send or publish) asks the person, and the model may do anything a
  person could (`brief-ports.ts:130-138`, `asked-acts.ts`). Fixes A and D
  refuse a *completion claim* or add words; they never refuse an action.
- **Every trial and the judged whole run start after the build's reset.** It
  undoes exactly this build's acts and never what was there before
  (`phase-start.ts`, `site-reset/project-reset.ts`, ledger t475 and t479
  identity rules). Carrying a proposal never skips its trial.
- **Every node keeps its first attempt plus 3 retries and its actionability
  wait.** Nothing here touches the executor or the node runtime.
- **A carried proposal is never counted done** until its own trial answers yes
  on every part (t658).
- **No guidance text names these scenarios' sites, items or acts.** Every
  example uses another kind of site.

## Commands run and observed results

- Ran a step-summary script (scratchpad `xpart_sum.py`) over each run's
  `steps/`. It printed role, brief, decision summary, tool input and
  `phaseStart` for every step quoted above.
- Python one-liners read `call.json`, `result.json` and `decision.json` for:
  - r1: 0006, 0008, 0025, 0032, 0033, 0042, 0043, 0055, 0057, 0081, 0085,
    0086, 0088, 0099;
  - r2: 0004, 0037, 0038, 0042, 0044, 0047, 0048, 0063, 0064, 0065;
  - social: 0009, 0012, 0040, 0047, 0054, 0055, 0056, 0118.
- I checked the coupon control's text on brief openings: 0043 shows "Get
  coupons"; 0047 (after brief-2's own press) and 0088 show "Collected".
- `grep -l outsideBrief */steps/*/result.json` over all 2026-10-16 runs found
  no match.
- I read Core's `phase-start.ts`, `acts-record.ts`, `permissions.ts`, most of
  `brief-ports.ts`, the `ledger.ts` header, `dispatch/scope.ts`,
  `asked-acts.ts`, `builder-loop.ts`, `scoped-submission.ts` (checks),
  `result-verification/build-test/task-checklist.ts`,
  `service/project-build/task-checklist.ts`, `supervisor/state.ts` (carry and
  changes), `plan-tool.ts` and `run-brief.ts` (carriedOf).
- Nothing was built or tested. This was a read-only investigation.

## Not verified

- **The preparation run's coupon act.** I did not read its act id or its
  `possible` flag from the run files. That it is a possible act comes from the
  code path (`landed-acts.ts:94`) and from its absence in
  `predecessorsLeftOnSite`. The build record or `core.log` would confirm it.
- **What `lastingActsInPlace` counts.** I did not trace which act each count
  in the dispatch returns refers to.
- **Fix C's conversion step.** I did not check that `carriedOf` and a builder
  can turn a callable proposal's `part ...:` script into a router-run script
  without new support in `run-brief.ts` or `renamed-outputs.ts`. A worker
  should confirm, or add a conversion that drops the `part`, `input` and
  `output` lines.
- **Spend figures.** They are the dispatch returns' `spentUsd`. The
  supervisor's own decisions are not included in the wasted amounts.
- **The no-hook gap.** It is inferred from code only; no run here lacked a
  hook.

## Open questions or contradictions found

- **The brief's premise.** In crossborder r1, brief-2 (steps/0042) did not find
  the coupon already collected. It opened with "Get coupons" (0043) and
  collected it itself (0047). It ended blocked for `subflow.input_unread`. The
  cross-part case in r1 is brief-4 (0088-0093), after brief-3's proposal kept
  the coupon step.
- **Social r2 is a different case.** No act crossed parts. A read part's
  builder claimed its part was done, and the entry wording invited the claim.
- **The judge rule contradicts itself across runs.** The t594 out-of-scope
  rule rejected a coupon step once and passed it twice with the same parts. In
  one pass it relied on the step's self-declared `consequences: none`.
