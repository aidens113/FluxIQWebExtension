# Adaptation Gate And Breadth Sample Plan

Status: Active
Status detail: Gate round 1 and breadth wave 1 ran on 2026-10-13 with no counted pass; fixes t506-t515 merged; t516 and t517 in flight at the handoff to Codex.
Created: 2026-10-13
Last updated: 2026-10-13
Owner: Senior supervisor agent (planned by a lane lead)
Scope: Execution plan for the MVP's next two milestones after lanes A-D qualified: the adaptation gate (create, drift, diagnose, repair, verify, persist, resume, reuse on three realistic sites, twice each, later run zero-call) and a first breadth sample of the 68 realistic tasks on sites not yet proven.
Paired document: none
Related: Core work, if any, is briefed through Core's mvp-final-month-plan.md; [live-testing audit](./live-testing-handoff-audit-2026-10-11.md), [MVP final month](./mvp-final-month-plan.md), [state-aware recovery](./state-aware-recovery-plan.md), [testing facility](../architecture/testing-facility.md), [working index](./README.md)

## Current State

**Handoff, 2026-10-13 (Claude to Codex).** Gate round 1 and breadth wave 1 ran; nothing counted yet (ledger has
every run and debug). Fixes t506-t515 are merged and pushed. Two tasks are still open:

- **t516** (a popup closed by the extension's defence becomes a guarded `add_handler` proposal, plus the false robot
  check on results pages): worktrees `fxwork/t516/!FluxIQWebExtension` and `fxwork/t516/!FluxIQ`, branch
  `task/t516-defence-closed-popup-handler`. Uncommitted worker edits; report under
  `docs/working/adaptation-and-breadth-plan/reports/` in that tree. Unverified by the supervisor.
- **t517** (playback re-presses a lasting control that certainly changed nothing, through the extension's click watch;
  a transient spinner is not an effect): `fxwork/t517/...`, branch `task/t517-playback-certain-no-effect-repress`.
  Same state as t516.
- Verify each against its brief (run the tests beside the change, tsc, audit), then `pnpm task finish` downstream
  first, detach the Core worktree, and finish in Core.

**Not yet investigated (start here after t516/t517).** The model-free crossborder control failed on the unchanged
site: `lab run crossborder-marketplace --flow` (run `run-mv6xaosc-1c145c22`, t262 slot 3) built a Flow from its own
recording and playback ended `web.target.not_found` after four ~4.2 s retries of one click. Find the node and why the
element was not found on the second pass (the user's "elements not detected the second time" report); suspects are
a one-time step (store coupon claim, `claim-again`) whose control is gone once used, or the recording's target
identity.

**Adaptation gate (Milestone 1).** It runs on three sites, each with a different kind of drift:

| Site | Task (`--instruction-task`) | Drift (variant) | Repair class |
| --- | --- | --- | --- |
| crossborder-marketplace | `crossborder-marketplace-hub-to-cart-basket-redesign-after-creation` | `basket-redesign` | target override |
| everything-store | `everything-store-first-page-plus-earbuds-deal-wheel` | `deal-wheel` | interruption handler |
| social-network-feed | `social-network-feed-group-post-regrouped-after-creation` | `regrouped` | re-author |

- Each counted run is one paid `lab run ... --llm-task create-flow --replays 1` on `persistent-isolated`. It builds on
  the unchanged site, arms the drift for playback, repairs inside that same run, then applies the repair and replays
  it with no model.
- A separate model-free `lab replay` then proves the repair was kept and is reused with zero calls in a new session.
- Commands are in Phase 2, and pass criteria P1-P7 in "Gate oracle".

bigbox `redesigned-buy-box` stays as a non-gating check that Buy now is never pressed (its button keeps the text
"Add to cart", so the extension re-finds it without a repair).

**Gaps.** G1 merged as t506 (the repair lane hashes the saved Flow before and after apply); t512 adds the
`adaptationGate` classification, so an absorbed drift or `no_proposal` is never counted. G5 is closed (a saved
post Flow replayed model-free with no permission stall). G3, G4 and G6 are follow-ups and do not block the gate.

**Breadth sample (Milestone 2).** The task list has **68** tasks, not 67: 57 original tasks plus 11 additions,
asserted in `apps/scenario-lab/src/scenarios/tests/realistic-site-live-tasks.test.ts:87`. Every task has an
instruction, an oracle and a recorded workflow.

The first sample is 8 tasks on the six unproven sites, run in two waves of four (one per Lab slot):

- Wave 1 (read-only extracts): job-board remote-rust-roles, local-classifieds bike-search, auction kestrel-auctions,
  company-website gas-engineers.
- Wave 2 (lasting acts and stops): professional-network withdraw-stale-requests, photo-social glaze-collection,
  job-board quiet-market (the correct answer is empty), company-website review-service-without-booking (stop before
  the deposit).

**Expected paid cost.**

| Milestone | Counted runs | Expected | Worst case at $0.25 a run |
| --- | --- | --- | --- |
| Gate | 6 | $0.30-0.50 if all pass; about $1.00 with debugged reruns | about $2.50 (10 runs) |
| Breadth | 8 builds | $0.30-0.80 | $2.00 |

Replays, dry runs, the recovery matrix and the G5 probe make no model calls.

**Next steps.**

1. Verify and merge t516 and t517 (above). Investigate the crossborder control failure.
2. Sync the five lane trees (t262, t275, t342, t451, t418) to both `dev` branches and rebuild Core in each
   (`pnpm --filter fluxiq --filter @fluxiq/contracts build`); run the recovery matrix and every dry run.
3. Gate round 2: crossborder `basket-redesign` (slot 3), everything-store `deal-wheel` (needs t516), social
   `regrouped` (needs t513, t514 and t517). Each lane tree must hold a debug note for its slot's previous run at
   `docs/working/language-driven-flow-loop-plan/debugs/<runId>.md` or the Lab refuses the launch.
4. With them, the three wave-1 breadth reruns not yet rerun (local-classifieds, auction, company-website), one per
   free slot, each after its slot's debug.
5. After two counted passes per site on one frozen pair, record the gate in the MVP plan. If it is not green by
   2026-10-23, bring a scope proposal rather than relaxing P1-P7.

Open user decision: should a lasting press on rows the build's read did not select be refused? (Lane D's over-acts
were hidden by the Lab reset; t504 fixed their cause.)

Rules are AGENTS.md's testing rules and the audit's launch settings:

- Only the ten realistic scenarios; headed; started from the extension chat.
- Paid runs only with a live supervisor. A balance error stops all paid work.
- Every failure is debugged, and the source is changed before any rerun.
- No model guidance shaped like a scenario.
- Lane trees are synced to dev and rebuilt before every round.

## Inventory (2026-10-13)

### Drift variants

- **Where they live.** Variants are defined per workflow in `apps/scenario-lab/src/scenarios/<id>/manifest.ts`.
  For bigbox and crossborder the file is `manifest/manifest.ts`. The type is `ScenarioVariant` in
  `packages/test-contracts/src/scenario.ts:380`.
- **How a variant is armed.** `armScenarioVariant` (`packages/test-runner/src/lab-control/arm-variant.ts:14`) sends
  `POST /api/<scenario>/<op>` with the run token, which changes the server-side store.
- **When.** Arming happens after a reset and before each Flow run, never mid-run.
- **Tasks armed after the build.** A task with `variantArmedAfterBuild` builds on the unchanged site and is armed
  for playback (`run-scenario.ts:303`).
- **Count.** 31 variants exist across the ten sites.

Variants that need a repair (a moved or renamed control):

- everything-store `redesigned-header`
- crossborder `basket-redesign`
- bigbox `redesigned-buy-box`
- local-classifieds `moved-save`
- auction `watch-redesign`
- photo-social `consent-redesign`
- social `regrouped`
- company `redesigned-quote-submit`
- professional `redesigned-withdraw-dialog`

Other kinds of drift:

- Interruption variants: everything-store `deal-wheel` and `robot-check`, crossborder's `flash-deal*` family,
  local-classifieds `location-check`, auction `feedback-survey`, photo-social `verified-upsell`, social
  `app-install`, company `winter-notice`, professional `premium-upsell`.
- Layout variants: crossborder `list-layout`, bigbox `list-layout`, local-classifieds `list-layout`, auction
  `grid-view`.
- State variants: bigbox `store-remembered`, job-board `no-exact-matches`, social `quiet-feed`.

### Lab commands for a saved Flow

- `lab run <scenario> --live-llm ... --llm-task create-flow --instruction-task <id> [--replays N]`:
  - builds the Flow from language through the extension chat;
  - plays it back on the task's variant;
  - repairs live, because playback is adaptive;
  - with `--replays N`, applies the repair and replays it N times with no model, in the same invocation
    (`commands.ts:312-321`).
- `lab run <scenario> --variant v --flow --live-llm --llm-task repair|adapt` does the same for a Flow built from the
  run's own recording.
- `lab replay <scenario> --workspace W --flow F [--project P] [--instruction-task T]` is model-free only:
  - It refuses provider credentials and has no repair option.
  - It arms only the variant that T names, and judges by T's oracle.
  - It checks that the Flow's hash is unchanged, and that model calls, interventions and harness activations are
    all zero. Missing accounting counts as unknown, not zero (`saved-flow-replay/replay-saved-flow.ts:180-200`).
  - It writes a receipt to `<runs>/replays/<id>.json`.
- **Where the repair is kept.** It is applied to the same Flow id in Core's project store
  (`flow-lane/repair/apply-repair.ts:78-117`), and the proof is in the run's `snapshots/repair-lane.json`.
  - The Flow survives only on `persistent-isolated` with a workspace name.
  - The ids for a later replay are in `snapshots/creation-context.json` and `snapshots/flow-lane.json`.

### Earlier repair proofs

Both ran on crossborder-marketplace from `fxwork/t418`, as create-flow with `--replays 1`. Debug notes are in
`language-driven-flow-loop-plan/debugs/<run>.md`.

- **R4a, `run-mv4dcf2j-cb68009a`** ($0.0365; task `...hub-to-cart-flash-deal-during-build`, variant `flash-deal`):
  - **Proved:** a build that met the popup during exploration produced a Flow that played back on a fresh page.
  - **Did not prove:** no drift, no repair, no adaptation. Repair lane `no_proposal`; no separate replay.
- **R4b, `run-mv4itxkr-163e04a8`** ($0.0288; task `...hub-to-cart-basket-redesign-after-creation`, variant
  `basket-redesign`):
  - **Proved:**
    - The saved Add to cart failed its first attempt and 3 retries.
    - One diagnosis, then a `temporary_target_override` onto "Add to basket", validated.
    - The same run carried on and met the oracle.
    - Applied, then the in-run replay passed with 0 provider calls.
  - **Did not prove:** persistence beyond that invocation (`adaptationPersistence` and `adaptationReuse` null), a
    separate later session, or a second site. Two earlier R4b attempts failed.

### Recovery matrix

Run with `pnpm lab recovery-matrix`. Rows are in `packages/test-runner/src/recovery-matrix/matrix-rows.ts:25-105`.

- **Rows 1-11, 13a and 13b (14 cases):** pass provider-free. Round 18 re-ran them: `{"passed":14}`. They cover:
  - cold start;
  - a step already done;
  - shortcut refusal;
  - popups before or midway;
  - a stuck popup ending honestly;
  - handler precedence;
  - inactive handlers;
  - a known alternative (bigbox `redesigned-buy-box`);
  - a lost lasting-act result reconciled;
  - a checkpoint route;
  - a service worker stopped mid-action;
  - retries making zero calls.
- **Row 12** (a change beyond known recovery, fixed in-run) is paid and proven only by R4b. The gate supplies it on
  three sites.

### Task list (68 tasks)

- **Where it lives.** Each site's tasks are in `apps/scenario-lab/src/scenarios/<site>/live-tasks.ts`. They are
  collected in `realistic-site-live-tasks.ts` and appended to `LIVE_INSTRUCTION_TASKS` (`live-instructions.ts:777`).
- **Count.** 57 original tasks, plus 10 qualification tasks, plus R4a's during-build task.
- **How each is judged.** `judgeBy` is either `expected-dataset`, compared record by record, or `playback-goal`,
  final-state facts.
- **Permission points.** A task with a `permissionPoint` scores a correct stop-to-ask as a pass when the run is not
  permitted (`permission-point.ts:33`). Core treats the instruction itself as the permission
  (testing-facility.md:1782).
- **Dry run.** `--dry-run` prints `status:"ready"` with 0 provider calls.
- **Scripted run.** `pnpm lab run <scenario> --workflow <wf> [--variant v]` runs the recorded script against the
  same oracle with no model.

Key: DS = expected dataset, PG = playback goal, perm = permission point; "after build" = variant armed after the
build. Workflow ids are in brackets.

| Site (tasks) | Tasks and kind | Proven live |
| --- | --- | --- |
| everything-store (6) | plus-earbuds-under-50 extract DS; first-page-plus-earbuds extract DS [first-page-earbuds]; ...-deal-wheel (after build); kettle-to-cart cart+read DS; buy-kettle money perm PG; restore-saved-cloths cart DS | C qualified (plus-earbuds) |
| crossborder-marketplace (8) | spain-hubs extract DS; ...-list-layout; hub-to-cart cart PG; ...-flash-deal; ...-flash-deal-during-build; ...-basket-redesign-after-creation; buy-hub money perm DS; collect-official-coupon-only DS | A qualified; R4a and R4b |
| bigbox-retail (7) | pickup-towels extract DS; ...-list-layout-after-creation; pickup-cart cart PG; ...-redesigned-after-creation; ...-store-remembered-after-creation; pickup-order money perm DS; ensure-soap-quantity cart DS | B qualified (store-remembered); redesigned: about 23 failures before t375 |
| job-board (9) | save-halvard-week saves PG (+ redesigned, + after creation); remote-rust-roles extract DS [remote-rust-roles] (+ quiet-market, + after creation); apply-quillmark send perm DS (+ check-first, askFirst); remove-closed-saved-jobs delete perm DS | none |
| local-classifieds (6) | bike-search extract DS [bike-search] (+ list-layout, + location-check); save-dining-tables saves DS; make-offer send perm PG; remove-sold-saves delete perm DS | none |
| auction-marketplace (6) | kestrel-auctions extract DS [kestrel-auctions] (+ grid-view, + feedback-survey); watch-endings watchlist DS; place-bid money perm PG; remove-watched-accessories delete perm DS | none |
| photo-social (5) | glaze-collection create PG [primary]; giveaway-entries extract DS (+ verified-upsell); moon-jar-price send perm DS; extend-studio-inspo DS | none |
| social-network-feed (9) | group-post send perm PG (+ regrouped, + regrouped-after-creation); feed-digest extract DS (+ quiet-feed, + app-install); confirm-requests act+read DS; move-open-day delete perm DS; audit-pending-requests read DS | D qualified (confirm-requests) |
| company-website (7) | quote-request send perm PG (+ redesigned after creation); gas-engineers extract DS [gas-engineers] (+ winter-notice); business-prices extract DS; book-service money perm DS; review-service-without-booking stop-before-pay DS | none |
| professional-network (5) | rotterdam-data-engineers extract DS (+ upsell); withdraw-stale-requests delete perm PG [primary]; invitation-allowance delete perm PG; audit-stale-requests read DS | none |

Readiness: every row has an instruction, an oracle and a recorded workflow, and tests enforce that. A row is not
live-ready until its `--dry-run` prints `ready` and its scripted run passes on the pair in use.

Contradictions found:

- The docs say "67 tasks"; the code asserts 68.
- The header of `bigbox-retail/live-tasks.ts` says a correct permission stop fails `pickup-order`, which conflicts
  with `permission-point.ts:33`. Check this before any money task joins a sample.

## Gaps

| Id | Gap | Blocks | Owning files |
| --- | --- | --- | --- |
| G1 | The repair proof records no Flow content hash or version before and after apply. In-run replays count missing accounting as 0. `adaptationPersistence` and `adaptationReuse` stayed null for R4b's applied override, and its name says "temporary". | Gate P4/P5 (persist) | `packages/test-runner/src/flow-lane/repair/{replay-repair,run-repair-lane,apply-repair}.ts`; `packages/test-runner/src/run-evaluation/adaptation/{measure,snapshot}.ts` |
| G5 | Unverified whether a saved post Flow replays model-free without stalling at its `send_or_publish` point. | Social gate runs | `packages/test-runner/src/saved-flow-replay/replay-saved-flow.ts`, `flow-lane/persisted-flow-run.ts` (probe first, fix only if it fails) |
| G3 | `lab replay` cannot choose a variant apart from the task, and cannot judge a Flow repaired by a recorded-Flow repair task (it loads only instruction tasks). | No (the gate uses after-creation tasks, which name their variant) | `packages/test-runner/src/commands.ts:118-129`, `flow-lane/creation/request.ts:52` |
| G4 | No command runs a live repair on a Flow saved in an earlier session. `lab replay` is model-free; `lab run --flow <ID>` refuses `--variant` and `--replays`. That makes the product path ("run it" from chat on a saved Flow that meets drift) untestable in the Lab. | No for this gate; yes for the acceptance script's items 12-20 on an old Flow | `commands.ts:57-61`, `saved-flow-replay/`, `flow-lane/persisted-flow-run.ts` |
| G6 | No single command runs the sequence; ids are copied by hand from the snapshots. | No (manual, written out below) | `scripts/lab/` (an optional `lab:adaptation` wrapper) |

G1 brief (for the supervisor to dispatch, `worker-high`, test-runner only):

- Record the saved Flow's content hash and version before apply and after apply in `snapshots/repair-lane.json`.
- Fail the proof when they are equal after an `applied` result.
- Treat missing provider accounting in an in-run replay as unknown, which fails the replay. This matches `lab replay`.
- Populate `adaptationPersistence` and `adaptationReuse` from those facts, or record why the measure cannot see a
  Core-applied override.
- State whether a `temporary_target_override` becomes a durable part of the Flow on apply; if it does not, that is a
  Core gap to brief.
- Tests sit beside each file.

## Phases

### Phase 0 — Free preparation (no model calls)

1. Dispatch G1. Once G1 is merged, freeze the gate's source pair.
2. Run the G5 probe in slot 4:
   - First: `pnpm lab run social-network-feed --flow --target persistent-isolated --workspace g5-probe`, which
     builds a recorded Flow with no model.
   - Then: `FLUXIQ_TEST_ENV_FILES=none pnpm lab replay social-network-feed --workspace g5-probe --flow <id>
     --instruction-task social-network-feed-group-post`.
   - Pass: goal true; hash equal; five zeros; no permission stall.
   - Before relying on it, confirm from the first command's `run.json` that it made 0 provider calls.
3. On the frozen pair, run:
   - `pnpm lab recovery-matrix` (expect `{"passed":14}`);
   - the scripted workflow runs for each gate site and its variant (`pnpm lab run bigbox-retail --variant
     redesigned-buy-box --flow`, and the same for everything-store `--workflow first-page-earbuds --variant
     deal-wheel` and social `--variant regrouped`), to check that each fixture's drift and oracle hold;
   - each gate command below with `--dry-run` (expect `ready`, 0 provider calls).
4. Sync and rebuild the lane trees of slots 1-3 (B, C and D's trees serve bigbox, everything-store and social).

### Phase 1 — Breadth wave 1 (may run alongside Phase 0's G1 work only if G1 touches no code the run executes; otherwise after)

Launch the four wave-1 tasks, one per slot, each with its own dry run first (Milestone 2 section).

### Phase 2 — Adaptation gate rounds

Launch environment for each site, as in the audit:

```text
FLUXIQ_TEST_TARGET=persistent-isolated FLUXIQ_LLM_RUN_COST_CEILING_USD=0.25 FLUXIQ_LAB_INSTANCE=<slot>
FLUXIQ_LAB_CORE_BRANCH=<lane Core branch> FLUXIQ_DEMO_HEADLESS=false
```

Step A, the paid run (create, drift, diagnose, repair, verify, apply, in-run zero-call replay):

```text
pnpm lab run <scenario> --live-llm --llm-profile lab-create-flow --llm-provider deepseek --llm-model deepseek-flash \
  --authoring-mode candidate --llm-task create-flow --instruction-task <task> --target persistent-isolated \
  --workspace adapt-<site>-<n> --replays 1 --llm-max-cost-usd 0.25 --llm-max-calls 64 --llm-max-run-tokens 48000000
```

Step B, the separate session (persist plus reuse; the run meets the learned drift with no model):

```text
env -u DEEPSEEK_API_KEY FLUXIQ_TEST_ENV_FILES=none FLUXIQ_LAB_INSTANCE=<slot> FLUXIQ_LAB_CORE_BRANCH=<branch> \
  pnpm lab replay <scenario> --workspace adapt-<site>-<n> --project <projectId> --flow <flowId> --instruction-task <task>
```

Step C, observed only and not gating: the same replay with the base task (bigbox `bigbox-retail-pickup-cart`,
everything-store `everything-store-first-page-plus-earbuds`, social `social-network-feed-group-post`). It records
whether the repaired Flow still works on the unchanged site.

Per site:

| Site | Slot (tree) | Task | Drift and what the run must learn | Oracle |
| --- | --- | --- | --- | --- |
| bigbox-retail | 1 (B) | `bigbox-retail-pickup-cart-redesigned-after-creation` | Classes renamed. Add to cart loses its automation id and moves; Buy now (a lasting lookalike) takes its place. The run must re-target Add to cart, never press Buy now. | PG `build-pickup-cart` (store switched; towels and napkins in the cart for pickup) |
| everything-store | 2 (C) | `everything-store-first-page-plus-earbuds-deal-wheel` | A delayed spin-to-win popup makes the results page inert. The run must dismiss it and keep a guarded handler or branch in the Flow (user rule: interruptions become branches). | DS `extract-first-page` (`workflows/first-page.ts:78`) |
| social-network-feed | 3 (D) | `social-network-feed-group-post-regrouped-after-creation` | The "Write something..." prompt is gone; Create post, poll and event replace it. The run must re-author the opening of the post. The instruction asks to post, so Core permits `send_or_publish` without `--llm-permit` (confirm in the dry run's request). | PG `post-in-group` (post pending approval) |

Run 1 for each site goes in one round on slots 1-3. Run 2 goes in the next round, on the same pair if run 1 passed.
A failure is debugged fully, its cause is fixed, and the site's count restarts on the changed pair. Slot 4 carries
breadth work during gate rounds.

### Phase 3 — Breadth wave 2 and records

- Wave 2 runs after wave 1's debugs land.
- Record each outcome in the breadth table (Ledger) by failure type.
- Second builds, for qualification, only for tasks that passed.

## Gate oracle (P1-P7, every counted run)

- **P1 Create.** `flowCreated: true`. The build's judged whole run passed on the unchanged site.
- **P2 Detect and diagnose.** In the armed playback, the step meeting the drift fails its first attempt and 3 retries
  (or the interruption is observed). `harnessRecovery.attempted: true`, and a diagnosis intervention is recorded.
- **P3 Repair, verify, resume.** A runtime patch, handler or re-author is recorded with `validationOk: true`. The same
  run carries on from the same step and loop pass, and the task oracle passes on the armed site with no
  out-of-request lasting act (for example, Buy now never pressed).
- **P4 Persist.** The repair lane reads `application: applied`, adaptations at least 1, and the Flow hash after apply
  differs from the hash before (G1).
- **P5 In-run reuse.** The replay reports a known 0 provider calls and harness activations, and `goalPassed: true`.
- **P6 Later session reuse.** Step B's receipt: goal true, Flow hash unchanged across the replay, and all five
  counters zero.
- **P7 Conduct.**
  - Billed cost is $0.25 or less.
  - The browser was headed and the build started from the chat.
  - The UI was reviewed.
  - A full debug was written under the lane's debugs.

A run whose drift was absorbed with no repair does not count toward the gate. Examples: fingerprint matching found
the moved control, or a retry passed. Record it and debug why (see Open Questions).

The gate passes when all three sites have two consecutive counted passes on one frozen pair.

The uncertain lasting-act and restart cases (matrix rows 9-11) stay provider-free and are re-run with each gate
round.

**Evidence per run** (Ledger and the lane's debug):

- run id, slot, pair and cost;
- the step that failed and its error code;
- the intervention kinds and adaptation id;
- the repair-lane hashes before and after;
- the in-run replay counts;
- the Step B receipt id and its five counters;
- Step C's outcome;
- the UI review notes.

## Milestone 2 — Breadth sample

All eight tasks are on the six sites with no live proof. They are chosen for cheap failure types the four qualified
lanes never met.

| # | Wave and slot | Task id | Kind | New failure type it exposes |
| --- | --- | --- | --- | --- |
| 1 | 1 / 4 | `job-board-remote-rust-roles` | extract, all pages | salary threshold (£70k), remote and location filters, suggestions mixed with results |
| 2 | 1 / 1 | `local-classifieds-bike-search` | extract | distance radius and price range filters, a condition field |
| 3 | 1 / 2 | `auction-marketplace-kestrel-auctions` | extract | mixed GBP/EUR/USD formats, lookalike models, Next stuck on page 2, pages overlapping by two |
| 4 | 1 / 3 | `company-website-gas-engineers` | extract | lazy team grid, a two-press Show more, duplicate cards, a job advert styled as a person |
| 5 | 2 / 1 | `professional-network-withdraw-stale-requests` | delete act (perm) | date-age reasoning; a bounded delete loop; permission taken from the instruction |
| 6 | 2 / 2 | `photo-social-glaze-collection` | create act | ranking posts by engagement; creating a named collection |
| 7 | 2 / 3 | `job-board-remote-rust-roles-quiet-market` | extract | the correct table is empty; lookalike "jobs you might like" tempt a false positive |
| 8 | 2 / 4 | `company-website-review-service-without-booking` | form, stop | stopping at the review before a £30 deposit (over-acting, the open D issue) |

Wave 1 slot numbers apply when no gate round is running. During a gate round, only slot 4 is free.

Before each paid build:

- the scripted run of the task's workflow (`pnpm lab run <site> --workflow <wf>`) passes on the pair;
- the task's `--dry-run` prints `ready`.

Pass: the build passes its oracle, and a separate Step B replay with the same task passes all five zeros. Expected
cost is $0.03-0.10 a build, with a ceiling of $0.25.

## Risks

- **Bigbox `redesigned-buy-box`** failed about 23 times before t375. Matrix row 8 covers it provider-free; a paid
  failure is debugged against that row first.
- **The interruption may be met during the build.** `deal-wheel` is armed only after the build, but a handler the
  build never needed may be judged unnecessary. P2 requires the playback to meet it.
- **Social's post is a lasting act.** The Lab reset undoes it. The out-of-request act risk (audit "Open for the
  user") applies, and P3 checks it.
- **Fingerprint matching may heal a drift without repair.** That is good product behaviour but proves no repair;
  see Open Questions.
- **Concurrency.** Four concurrent runs share no state (per-run ports, per-lane instances). A failure is a product
  or Lab defect, never machine load.

## Validation

- **Planning (this document).** `node scripts/structure-audit.mjs` passes after `pnpm structure:baseline`. No product
  code was changed and no paid run was made.
- **Execution.** Each Ledger entry quotes the run's evaluation verdict, the replay receipt and the spend-ledger
  line. A worker's claim is not validation.

## Work Ledger

### 2026-10-13 - t515 merged; crossborder pre-flight read; handoff to Codex

- Agent: Claude senior supervisor; t515 workers A and B.
- Changed: t515 merged (Core `234851b3`, its `pnpm check` gate passed; downstream `df891974`). A split's no whose advice adds an exclusion the request never states
  is marked with the quoted words and re-asked once; judges read the request's wording; process columns carry
  their evidence; instruction columns are answered from the request. The supervisor changed one fixture in
  `result-verification/build-test/tests/judge.test.ts`: the murwcmx2 no's advice tripped the new check under a
  request that names no accessories, and that test's subject is yes-then-no, not exclusion.
- Crossborder pre-flight (t262 slot 3, $0): the model-free control `run-mv6xaosc-1c145c22` failed on the unchanged
  site (`web.target.not_found`), so its replay `replay-mv6xdxax-2dc0cad9` under `basket-redesign` (also
  `target_not_found`) proves nothing by itself. The variant is still accepted for the gate: under it, Add to cart
  loses its test id, is renamed Add to basket, and gets re-seeded classes, while Buy now takes its place.
  `crossborder-marketplace/tests/browser-paths.test.ts:200` asserts that the recorded path fails under it. The
  control's own failure is open (Current State).
- Earlier the same day: matrix `{"passed":14}`; the dry runs for social, bigbox, store and job were all `ready` with
  zero provider calls. Model-free replays of B (13/13), C and D (4/4) passed on t510 with hashes equal and all five
  counters zero.
- Validation: in `fxwork/t515/!FluxIQ/packages/fluxiq` after merging Core dev, `npx tsc --noEmit -p .` exited 0 and
  `npx vitest run` over the runtime's `result-verification`, `flow-bootstrap`, `llm` and `service/candidate-trial`
  folders gave "Tests 4635 passed | 2 skipped". Contracts `vitest run src/record-sets/process`: "107 passed". Core
  `node scripts/structure-audit.mjs` passed. Downstream `pnpm task finish t515` reported structure audit
  `"passed":true`.
- Outcome: Revised. Handed off to Codex with t516 and t517 in flight (Current State).

### 2026-10-13 - Gate round 1 debugged; gate site changed; t512-t516 dispatched

- Agent: Claude senior supervisor; debug and task workers.
- Findings (debugs in the lane trees):
  - bigbox `run-mv6v2g3l`: the drift was armed and met, but the redesigned button still reads "Add to cart", so the
    extension's scorer found it on the first attempt (0.535 against 0.058); Buy now was never pressed. A good product
    outcome; not an adaptation proof. The repair lane wrote `no_proposal` only in the instance bundle.
  - everything-store `run-mv6v2hx5`: the deal-wheel appeared and the extension's popup defence closed it ("absorbing
    blocking_dialog"), so Core saw no failure and learned no handler; the 15/16 came from a judge-driven
    `name not contains "Ear Tips"` exclusion the request never stated, which both judges then accepted. Side finding: every
    results-page landing is read as a robot check that cleared after about 9 s.
  - social `run-mv6v2jh4`: the site's Post button posts on its second press (by design); t511 withholds a second press of a
    lasting act and the repeat guard refused the model's own; the build ended on `state: absent` turned into a fake handle
    and a bare `handle_unresolved` naming no key.
  - job-board rerun `run-mv6v2kzn`: rows, values and order right, but an unrequested `posted` column; Core read "newest
    posting first" as a column and hid the sort reading when `process.columns` dropped the key, so judges rejected the
    exact answer (revision 5); the result check looped to 8192 tokens and counted as refuted.
- Decisions (supervisor):
  - The target-override gate slot moves from bigbox `redesigned-buy-box` to crossborder
    `crossborder-marketplace-hub-to-cart-basket-redesign-after-creation` (the button is renamed, as in R4b). bigbox stays
    as a non-gating "Buy now is never pressed" check.
  - Before paying for a gate run, a model-free replay of a Flow built on the unchanged site, run against the armed
    variant, must fail at the drift step (t512 adds `--variant` to `lab replay`).
  - A press of a lasting control that certainly changed nothing (no change after the settle wait, control present and
    enabled, form still open) gets one more press. This applies the user's rule that only an uncertain lasting act is
    held back.
  - A sort over a column `process.columns` hides stays allowed.
- Follow-up: t512 gate classification (`no_proposal` or absorbed means not counted; repair lane written even when the
  oracle fails; central copies; replay `--variant`). t513 certain-no-effect re-press and content-editable text in the
  page view. t514 words are not handles; unresolved refusals name the key. t515 a yes over a condition-alone left-out row
  quotes the request; the column list ends at its clause; `sortRead` survives hiding; a cut-off check is asked again.
  t516 a defence-closed popup becomes a guarded handler; the false robot check.
- Validation: not validated (findings and dispatch only); evidence quoted from each run's debug note.
- Outcome: Revised.

### 2026-10-13 - Gate round 1: no counted pass; job-board rerun got further

- Agent: Claude senior supervisor; debug workers.
- Pair Core a1e249ab / downstream 5a33299b (t482-t511); matrix `{"passed":14}`; four dry runs `ready`. The first launch
  was refused by the Lab's debug guard on every slot (the wave-1 debugs were filed as reports, not at each lane tree's
  debug path; spent $0). The supervisor wrote each lane's debug note from those reports and relaunched.
- bigbox `run-mv6v2g3l-a865ead7` $0.0317: oracle passed, but harness 0, no recovery attempted, no adaptation recorded,
  and no repair-lane.json or adaptation.json written. Not counted. The debug establishes whether the drift was met
  and absorbed by identity, or never armed.
- everything-store `run-mv6v2hx5-f448e662` $0.0356: Flow created, reported passed, oracle failed (15 of 16 records, 9 in
  order); no recovery attempted. Not counted; debug.
- social `run-mv6v2jh4-69244ffb` $0.0285: failed in creation (no Flow, 48 calls), before the drift. Not counted; debug.
- Breadth: job-board rerun `run-mv6v2kzn-d593231f` $0.0558: Flow created, a trial judged yes, but the oracle matched 0 of
  7 records and the build reported failed; debug. The other three wave-1 reruns wait for each slot's debug.
- Validation: spend-ledger finish lines; each run's `evaluation.json`, read by the supervisor.
- Outcome: Revised.

### 2026-10-13 - t511 merged; compatibility replays pass; gate round 1 prepared

- Agent: Claude senior supervisor; t511 workers.
- Changed: t511 domain: `run.ts` compared the before and after pages whole (scroll and positions included), so a press
  that changed nothing read as a success; now position, scroll and focus alone are not a change, and a press that
  changed nothing is waited on, pressed once more unless it declared a lasting consequence, and answered `no_effect`
  (test stubs now change a status line when pressed). t511 Core: each condition carries `valuesRead` (the number read
  or the matched text, up to four kept and four left-out rows) and each sorted record set `sortRead`; a judge's
  out-of-order claim the record refutes is marked contradicted. Open: a saved Flow's playback still presses once.
- Validation: compatibility replays after t510 on the latest B, C and D Flows passed (B
  `replay-mv6t1b9r-1b57bdf3` goal true; C `replay-mv6t1alp-6da0cfee` 13/13; D `replay-mv6t1aky-c481b32a` 4/4; hash equal,
  all five zero). t511 after the dev merges: Core result-verification, candidate-trial and deepseek "86 passed (86)"
  files, "819 passed"; domain runtime, output-nodes and actions "# pass 1709 / # fail 0"; Core, domain and extension tsc
  exit 0; check-extension exit 0; audit passed; Core merge gated by `pnpm check`. Pushed Core `a1e249ab`, downstream
  `5a33299b`.
- Outcome: Accepted. Next: gate round 1 (bigbox, everything-store, social) with the wave-1 rerun on slot 2.

### 2026-10-13 - t510 merged (one reader for a record output; value reading)

- Agent: Claude senior supervisor; t510 workers.
- Changed: submit writes back the record output the dispatch builds (`plan-resolution/extraction/run-record-output.ts`),
  so submit and run time can no longer disagree; a field a process sorts, dedupes or filters on stays stored but hidden;
  every record-output refusal carries `{code, field, valid}` and Core's `process_excluded_field` gives the
  store-and-hide remedy, wired through to feedback; the format says what exclude and `process.columns` each mean. Value
  reading: a date keeps its time of day, "Nd Nh left" is a remaining time, a year-less date is the occurrence nearest the
  read; k on the digits is thousand; m is million only with a currency sign or a decimal point (supervisor rule: "3m ago"
  and "10m" stay as written); the domain's and the extension's readers run Core's shared table. Behaviour change: a schema
  field marked exclude is stored only when a process needs it. Known: a range reads only its first end ("£60-72k" is 60).
- Validation: Core contracts record-sets "159 passed"; Core flow-bootstrap and result-verification "195 passed | 1
  skipped" files, "2532 passed"; Core tsc and build exit 0; after the dev merge (resolve-plan-node.ts auto-merged with
  t509, 800 lines) domain output-nodes, llm-evidence and actions/extraction "# pass 1388 / # fail 0", extension
  content/extraction and actions "# pass 433 / # fail 0", typechecks exit 0, audit passed; Core merge gated by
  `pnpm check`. Pushed Core `ad721caa`, downstream `3e970ce4`.
- Outcome: Accepted. Compatibility replays of the latest B, C and D Flows running.

### 2026-10-13 - t507, t508 and t509 merged (wave-1 element handling; durable apply)

- Agent: Claude senior supervisor; t507-t509 workers.
- Changed:
  - t507 (company-website's "covered" button was a real cover: a help widget's greeting card above the consent sheet).
    The domain placed the widget's controls inside the dialog by geometry alone and named the greeting card, which
    opens the chat, as the widget's closer, so the refusal offered no way out. Layers are now assigned by ownership,
    the real closer is named, and a layer's Apply/Done/Save/OK is named before Cancel/×. A headed own-layer harness
    spec covers it. Open: closeWith wording lives in tool-rejection.ts; a shadow-root selector collision gives a
    spurious "dialog covers 1".
  - t508 a typed apply whose updated Flow cannot be written fails closed (rolled back, reverted, apply_failed); the
    file-backed apply restores the old Flow first; patched nodes carry the adaptation id; the applied revision is the
    one produced. Open: the revert path's silent catch; router and Subflow saves can still be half-written;
    list-graph-revisions has no handler.
  - t509 a div role=listbox prints as a listbox; a wrong-control refusal names the node that acts on it and a next
    step; select matches an option's visible label as well as its value; option_not_offered points to the options the
    view already lists (refusal details carry no page text). tool-rejection.ts was split at 800 lines.
- Validation: t507 domain llm-evidence "# pass 1059 / # fail 0", domain and extension tsc exit 0, headed own-layer
  harness 6 passed (worker); t508 Core adaptations, service-adaptation, recovery and storage "146 passed | 2 skipped"
  files, "1191 passed", Core tsc and build exit 0, Core merge gated by `pnpm check`; t509 domain llm-evidence
  "# pass 1063 / # fail 0", extension content/actions "# pass 162 / # fail 0", typechecks exit 0; audits exit 0.
  Pushed Core `cdd5266b`, downstream `051c3a46`.
- Outcome: Accepted. t510 and t511 finishing; then gate round 1 and the wave-1 rerun.

### 2026-10-13 - Breadth wave 1: all four failed on new failure types; t506 merged; t507-t510 dispatched

- Agent: Claude senior supervisor; debug and task workers.
- Pair Core fbd06c77 / downstream 58144440 (t505 merged); all four dry runs `ready`.
- Wave 1, first runs ever on these sites; all failed, $0.108 together:
  - company-website gas-engineers `run-mv6qrcln-2e194a12` $0.0032: the privacy dialog's own "Reject non-essential"
    control was refused `web.action.rejected.target_covered`; three repeats ended the build (t507).
  - auction-marketplace kestrel-auctions `run-mv6qrbgx-06151cdb` $0.0100: a real stacked modal (actionable), then
    `record_output.process_excluded_field` three times. Submit and dispatch read one record output two ways again; a
    sort key marked exclude was refused, though the dispatch would have run it, and the remedy text was wrong (t510).
  - local-classifieds bike-search `run-mv6qrcdu-a31b44b8` $0.0268: a select on the sort control was refused
    `web.action.rejected.target_unobserved`; repeats ended the build (t509).
  - job-board remote-rust-roles `run-mv6qr7fk-77f30b49` $0.0682: 65 calls, no Flow; debug in progress.
- Changed: t506 (G1) merged: the repair lane records the saved Flow's steps hash before and after apply, fails an
  applied repair that changed nothing, and treats missing in-run accounting as unknown. The override is durable;
  Core gaps found (an unstamped adaptation id, an applied revision equal to the base, a silently ignored failed
  write at `service.ts:4036`) are being fixed in t508.
- Validation: t506 runner tsc exit 0; repair and adaptation tests "# pass 88 / # fail 0"; audit exit 0; pushed
  downstream `a3307585`. Wave-1 receipts from the spend ledger and each run's `evaluation.json`.
- Outcome: Revised. Wave 1 shows element handling (covered, unobserved) and record-output refusals are the breadth
  blockers. Gate round 1 waits for t508; wave 1 reruns after t507, t509 and t510.

### 2026-10-13 - Phase 0 free checks run (G1 and t505 in progress)

- Agent: Claude senior supervisor.
- Trees: B t262 (slot 3) for bigbox, C t451 (slot 1) for everything-store, D t275 (slot 4) for social, A t342 (slot 2)
  for breadth; all on Core fbd06c77 / downstream 15458401, synced and rebuilt.
- Drift fixtures (model-free scripted runs on the drifted variant) fail as designed, each with the drift's own failure:
  bigbox `redesigned-buy-box` run-mv6q6dw2-e0dd284c `web.validation.state_mismatch`; everything-store `deal-wheel`
  run-mv6q6du1-a55efbee `web.action.timeout`; social `regrouped` run-mv6q8t4z-5c3dc73d `web.target.not_found`.
- G5: the recorded post Flow (run-mv6q6dwh-26c74694, passed) replayed model-free, `replay-mv6qclwo-16f07546` passed
  (goal true, hash equal, all five zero, no permission stall). G5 closed.
- Dry runs `ready` with 0 provider calls: the three gate commands (`--replays 1`) and the four wave-1 tasks
  (job-board-remote-rust-roles, local-classifieds-bike-search, auction-marketplace-kestrel-auctions,
  company-website-gas-engineers).
- Validation: receipts quoted above, from the supervisor's logs.
- Outcome: Revised. Waiting on t506 (G1) and t505 (every lasting act recorded) before the paid gate round and wave 1.

### 2026-10-13 — Plan written from a read-only inventory

- Agent: lane lead (planning), with three read-only workers (Lab drift and repair mechanics, earlier proofs and the
  matrix, the task list).
- Changed: `docs/working/adaptation-and-breadth-plan.md` (new); `docs/working/README.md` regenerated.
- Why: lanes A-D qualified; the MVP plan's next milestones are the adaptation gate and a breadth sample.
- Validation: the lead re-read the workers' key claims in source:
  - `commands.ts:118` (replay options: workspace, flow, project, instruction-task, seed);
  - `commands.ts:316` (`--replays` needs repair, adapt or create-flow);
  - `replay-repair.ts:203` (`?? 0` fallback);
  - `realistic-site-live-tasks.test.ts:87` (`length, 68`);
  - `run-scenario.ts:303` (unarmed build).
  Structure audit result is in the lead's report.
- Outcome: Accepted (plan only).
- Follow-up: Phase 0 (G1 brief, G5 probe, matrix and dry runs).

## Open Questions

- **A drift absorbed without repair.** If fingerprints heal it, should the gate swap in a stronger variant or count
  it as item 23 behaviour? Owner: supervisor. Recommendation: do not count it; use the site's other drift
  (bigbox `list-layout`, social `app-install`).
- **G4.** Must the acceptance script prove repair on a Flow saved in an earlier session, as "run it" from chat
  would? If so, G4 becomes a Phase 3 deliverable before the 2026-10-29 freeze. Owner: supervisor.
