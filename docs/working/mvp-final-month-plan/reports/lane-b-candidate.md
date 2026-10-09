# Lane B: first candidate-mode probe (bigbox pickup cart, store remembered after creation)

## Current State

Status: done for this round (2026-10-09 ~04:17 UTC). One paid run, `run-mv0fu9pb-57454dc4`: **failed at its first
submission, no Flow**, $0.043458, 33 calls. Cause: Core's script format tells the model a typing step never needs a
`consequences:` line, the domain requires it on a search that submits, and the refusal names plan node indices the
model cannot map to its steps (optional steps add merge nodes), so it resubmitted unchanged until the repeat stop
(C1, C2; reproduced provider-free). No second paid run this round (brief). Next: fix C1-C3 in Core, brief C4, then a
new lane B probe on the new product pair. Run debug:
`docs/working/language-driven-flow-loop-plan/debugs/run-mv0fu9pb-57454dc4.md`.

Lead: lane B live lead (Claude, `lead-xhigh`). Tree `fxwork/t262` (downstream 1d04a11a = dev 128d907e minus one
documentation commit; Core 52d7ac3a = Core dev). Slot 3, instance `t262-slot-3`, workspace `t262-b`. Brief:
`### Brief: lanes B, C and D first candidate-mode probes` in the supervisor's `mvp-final-month-plan.md`.
Previous lane B evidence (legacy mode, runs 1-4): [live-b.md](./live-b.md).

## Expectations (predeclared before launch)

Task `bigbox-retail-pickup-cart-store-remembered-after-creation` (variant `store-remembered`, armed only after the
build; judged by playback goal). Instruction, verbatim:

> Switch my pickup store to Millbrook Crossing Supercenter, then add two packs of the ValueRidge Essentials
> Select-A-Size Paper Towels in the 12 Double Rolls size and one pack of the ValueRidge Everyday Dinner Napkins in the
> 250 Count size to my cart, both for pickup. Keep what is already in my cart as it is, and do not check out.

Base site at the build and at every trial's reset start: home store Carden Falls Supercenter, cart 1 item (the soap),
$3.97.

What a correct candidate-mode build does:

1. Starts from the real extension chat as a fresh run-owned project in `t262-b`.
2. Explores: store picker, Set as my store on Millbrook Crossing Supercenter; ValueRidge Essentials Select-A-Size
   Paper Towels (not Loftwell, not 6 Double Rolls), 12 Double Rolls, quantity 2, Pickup, Add to cart once; ValueRidge
   Everyday Dinner Napkins (not the shipped-only 3-Pack lookalike), 250 Count, quantity 1, Pickup, Add to cart once.
3. Submits one whole-Flow script. The store step must survive the armed variant: written as a desired-state choice
   or an optional step, so on a page that already reads "Your store" with no Set as my store button it is satisfied,
   not failed and not aimed at another store. Separate towel and napkin steps, each with its option, quantity and add.
4. Core's trial runs the exact submission from a freshly reset start (`startReset` true); every act succeeds; both
   judges say yes from that trial's evidence only; promoted through the proposal and apply path; the chat says ready.
5. The Lab arms `store-remembered`, plays the saved Flow on its own tab, and the private oracle holds all five facts.
6. Within $0.10 and the call allowance; no permission question (cart adds are instructed); no checkout.

Exact oracle on playback (`manifest/expected-values.ts`, re-read 2026-10-09):

- `store-switched` `mini-cart-store` = "Pickup store: Millbrook Crossing Supercenter"
- `soap-kept` `mini-cart-line-5530601-pickup` = "1 × ValueRidge Ultra Dish Soap, Lemon Scent, 24 fl oz · Pickup"
- `towels-added` `mini-cart-line-5510202-pickup` = "2 × ValueRidge Essentials Select-A-Size Paper Towels, 12 Double Rolls · Pickup"
- `napkins-added` `mini-cart-line-5530102-pickup` = "1 × ValueRidge Everyday Dinner Napkins, 250 Count · Pickup"
- `nothing-else` `mini-cart-summary` = "4 items · Subtotal $43.39"

Wrong plausible outcomes that do not pass: wrong size or brand; towels at quantity 1; delivery or shipping; store left
at Carden Falls; soap removed or changed; duplicate adds; checkout opened; playback failing at the store step because
Set as my store is absent; a draft or unfinished build counted as a Flow; a model-invented confirmation wait (lane A
round 7, Q1) deciding the trial.

On a pass: one zero-call replay (`node scripts/lab/run-lab.mjs replay bigbox-retail --workspace t262-b --project
<project> --flow <flow> --instruction-task bigbox-retail-pickup-cart-store-remembered-after-creation`): zero provider
calls, interventions and harness activations, Flow hash unchanged, five facts. No second paid run this round.

## Preflight (zero calls)

| UTC | Step | Result |
| --- | --- | --- |
| 03:07 | Slot 3 claim refreshed | `lab-slots/slot-3/owner` t262 lane B, instance `t262-slot-3` |
| 03:07-03:10 | Core libraries (`node scripts/build-cache/cli.mjs contracts:build fluxiq:build client-gateway-websocket:build` in `t262/!FluxIQ`) | contracts reuse, fluxiq built (139 s), client-gateway-websocket reuse |
| 03:10-03:13 | Downstream `npm_config_workspace_concurrency=1 pnpm build` | exit 0; built domain (38 s), extension (50 s), test-runner (55 s); the rest reused |
| 03:13 | Campaign dry run: `FLUXIQ_LAB_INSTANCE=t262-slot-3 FLUXIQ_TEST_ENV_FILES=none pnpm.cmd lab:campaign bigbox-retail-pickup-cart-store-remembered-after-creation --max-attempts 1 --authoring-mode candidate --dry-run -- --target persistent-isolated --workspace t262-b` | one spawned command: `pnpm lab run bigbox-retail --variant store-remembered --live-llm --llm-profile lab-create-flow --llm-provider deepseek --llm-model deepseek-flash --authoring-mode candidate --llm-task create-flow --instruction-task bigbox-retail-pickup-cart-store-remembered-after-creation --llm-max-input-tokens 992000 --llm-max-output-tokens 8000 --llm-max-total-tokens 1000000 --llm-max-calls 48 --target persistent-isolated --workspace t262-b` |
| 03:14 | Lab dry run of that command (`node scripts/lab/run-lab.mjs run ... --dry-run`) | exit 0: `status ready`, `providerCallCount 0`, `buildEntry chat`, `coreAuthoringMode candidate`, `candidateTrial {trialRunner: true, startReset: true, source: lab-plan}`, flash (`coreDefaultModel deepseek-flash`), 48 calls, $0.10, `permittedConsequences []`, credential from `.env.local` (name only), instruction sha256 `8da0b9f6...43d3`; prelude rebuilt scenario-lab, domain host and the instanced extension; `coreWeb` not cached |
| 03:15-03:22 | Free rehearsal (provider-free Flow-lane run, unguarded, not filed): `FLUXIQ_LAB_INSTANCE=t262-slot-3 FLUXIQ_TEST_ENV_FILES=none node scripts/lab/run-lab.mjs run bigbox-retail --flow`, run `run-mv0e7tn8-74af47cb` | Purpose: build the Core panel and prove running identities before paying (lane A's B4). All four `snapshots/running-{build,core,host,server-adapter}-identity.json` `verified: true`. The run itself failed its oracle (finding R1 below) |
| 03:23 | Second Lab dry run | `status ready`, 0 calls, candidate, `candidateTrial` as above, `coreWeb {key: 1367d361435b817938aec124, cached: true}`, prelude rebuilt nothing |

Guard inputs checked by hand: no `STOP-balance` or `OVERRIDE-*` in `lab-slots`; local `dev` (128d907e) is ahead of HEAD
by one documentation commit only (allowed); Core HEAD = Core `dev`; the previous lane B live run
(`run-muxkyfxz-446c3a4e`) has its debug under `language-driven-flow-loop-plan/debugs/`; the source fingerprint has
changed since that failed run; no live start on this instance in the last 30 minutes. `.env.local` sets
`FLUXIQ_LLM_RUN_COST_CEILING_USD=0.10`.

### Zero-call finding R1 (recording lane, not this probe's lane)

The rehearsal recorded the scenario's manifest workflow, turned it into a Flow and played it (`flowCreated: true`,
status succeeded, 28 commands). At the second search's Enter (action 20, `web.dom.keypress`) the site showed its
press-and-hold robot check; the Lab played the person and cleared it in 3.3 s, Core recorded the failure as
recovered (`web.intervention.required`, `effect: ambiguous`), and the Flow went on to the napkins page. The fixture's
final state then did not hold (`runtime.behavior`, `flow_lane.every_failure_recovered` /
`flow_lane.product_behavior`). Which fact failed was not traced (the recording lane waits for A-D; see the plan's
known follow-up on the recording lane). Evidence: `test-runs/instances/t262-slot-3/run-mv0e7tn8-74af47cb/`
(`snapshots/flow-lane.json`, `events.ndjson` 74-76, `screenshots/00076-*.jpg`).

## Run `run-mv0fu9pb-57454dc4` (launched 04:00:09 UTC, off-peak, ended 04:04:54)

Command: `FLUXIQ_LAB_INSTANCE=t262-slot-3 FLUXIQ_TEST_ENV_FILES=none npm_config_workspace_concurrency=1 node
<t262>/!FluxIQWebExtension/scripts/lab/live-campaign.mjs bigbox-retail-pickup-cart-store-remembered-after-creation
--max-attempts 1 --authoring-mode candidate -- --target persistent-isolated --workspace t262-b`, started once by a
supervised script that refused any launch after 05:45 UTC. Guard `admitted`. Followed step by step from its own
central folder (`lab-runs/2026-10-08/run-mv0fu9pb-57454dc4`, matched by instance and start time).

### In plain English

**Failed. No Flow was made, and nothing was ever tested. Cost $0.0435 for 33 calls.**

What went right:

- The chat passed the instruction through word for word.
- Exploration switched the store to Millbrook correctly, found the right paper towels and picked 12 Double Rolls.

What went wrong, in order of weight:

1. **Core gave the model a false rule, then a refusal it could not act on.** The script format says a typing step
   never needs to say what it would lastingly do. The domain, however, requires that for a search that presses
   Enter. So both search steps were refused. The refusal pointed at "node 10" and "node 17". Those numbers do not
   match the model's step numbers, because each optional step (the three "dismiss if it shows" steps and one
   "continue shopping") adds a hidden join node. The model guessed it meant the store and add-to-cart steps, which
   were already correct. It sent the same script four more times, and Core stopped the build as making no progress.
2. **The model never found the napkins.** Every search included "250 Count". On this site that finds only a
   look-alike 3-Pack that ships only and cannot be picked up. The real napkins product is called just "ValueRidge
   Everyday Dinner Napkins", with 250 Count as a size on its page. Its tile was on screen the whole time, showing its
   default size, "100 Count". The model concluded the single pack does not exist.
3. **The script would have failed its test anyway.** It pressed the old store's name and its "Your store" label
   instead of Millbrook's button. It reused the napkins link to open the towels and used three handles it was never
   shown. It had no Pickup or size choice for the napkins. Exploration had also added the towels at quantity 1, not 2.
   The trial and the judges would have caught this; the refusal stopped the build first.
4. **The chat explained the failure badly.** The refusal card said "some steps point at things that weren't seen on
   the page; 4 things to fix", which was wrong on both counts: the issue was a missing declaration, on 2 steps. The
   ending said only that the build "kept trying without getting any further".

### Measured

- Verdict `failed` (`lab.chat_build_failed`; issues `flow_bootstrap.evidence_repeat_without_progress`,
  `llm_evidence_loop.repeat_refused`); `candidateOutcome` `not_tested`, 0 trials, no promotion; `flowCreated: false`.
- 33 calls, $0.043458: chat 1 ($0.000182); build 32 ($0.043276 of $0.10, 32 of 48 calls). Of the build, $0.007448 went
  on the 5 submission calls, which achieved nothing after the first refusal.
- Judge versus oracle: no judge ran; oracle not measured. Exploration's own end state (Millbrook, soap plus towels x1,
  $20.44) already fails three of the five facts.
- Running identities verified before the first call; mode candidate; flash; `permittedConsequences []`; no permission
  ask, no person check.
- No zero-call replay (no Flow). No second paid run (brief).

### Causes, reproduction and the file to change

Full table in the run debug. Summary:

| # | Cause | File to change | Status |
| --- | --- | --- | --- |
| C1 | Format text says a typing step never needs `consequences:`; domain requires it for `dom-type` with `submit: true` | Core `runtime/flow-bootstrap/plan/flow-script-format.ts:141` (+ test `plan/tests/flow-script-format.test.ts`); rule in downstream `domain/src/runtime/llm-evidence/plan-resolution/step-permission.ts:110-112` | reproduced provider-free (`scratchpad/w1/refusal-index.mjs`), lead re-ran it |
| C2 | Refusal issues name plan node indices, shifted by merge nodes from optional steps (`authoring/assemble.ts:342-344`); no step name or line | Core `authoring/assemble.ts`, `llm/harness-options/bootstrap-completion.ts`, `plan/issue-feedback.ts` (+ tests named in the debug) | reproduced (node table) |
| C3 | Refusal card wording and count wrong; resubmission card labelled "run the step again" | Core `runtime/activity/wording/completion-refusal.ts:9`; candidate card labels (t373) | screenshots and source line |
| C4 | Handles never printed to the model (t551, t560, t570) resolved without `web.handle.unknown` | downstream `plan-resolution/handle-tokens.ts` / handle store | inferred from grep and check order; not reproduced |
| M1, M2 | Model: size in the search query; quantity 1; wrong or invented handles | none required; optional guidance for M1 | worker 2 audit, lead spot-checked the fixture |

### UI findings

U-B1 (= C3), U-B2 (the ending names no cause), U-B3 (Click and Type cards name no control: lane A's U1, still open),
U-B4 (model narration shown as fact when false), U-B5 (technical "reply couldn't be read" wording). Detail in the
run debug.

### Worker reports

- [w1-refusal-index.md](./lane-b-candidate/w1-refusal-index.md): Core root cause of the refusal, the provider-free
  reproduction, and fixes A and B with fail-first tests (`worker-high`). Verified by the lead: re-ran the
  reproduction; read `flow-script-format.ts:141`, `assemble.ts:336-344`, `step-permission.ts:109-112`,
  `completion-refusal.ts:9` and `repeat-guard/feedback.ts:20`.
- [w2-exploration-audit.md](./lane-b-candidate/w2-exploration-audit.md): step-by-step exploration, napkins search,
  script handle audit, cost by bucket (`worker`). Verified by the lead: `catalog/pantry.ts:13-24`; grep of t551,
  t560, t570, t340, t343 and t353 across every step file; screenshots of the end page (cart 2, $20.44).

### Not run, not verified

- No trial, judge, promotion, playback, oracle or replay: the build never got past submission.
- C4 is inferred from the code order and a grep, not reproduced.
- Why the identical 0060 resubmission ran instead of being refused as a repeat.
- Which fact failed in the free rehearsal R1 (recording lane).

### Guard and slot state left behind

- Ledger: `start` 04:00:55 and `finish` 04:04:56 for `t262-slot-3`, failed, $0.043458. Debug present under the run id.
  The `unchanged` rule refuses this instance and task until source changes; the C1-C3 fixes change it.
- Slot 3 still claimed by t262 lane B. No Lab or browser process from `fxwork/t262` is running; nothing was killed.
- Lane tree: no source edits; ignored outputs only (builds, `test-runs/`, the logs `fxwork/t262/*-1009.log`,
  `campaign-c1.log`).
