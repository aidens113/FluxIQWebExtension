# Run debug — run-mv0fu9pb-57454dc4 (lane B, first candidate-mode probe, t262-slot-3)

Written as `run-pending-t262-slot-3-b-c1.md` before launch (2026-10-09 ~03:25 UTC); renamed to the run id when the
Lab assigns it. Everything in "Expectations" was written before launch.

## Header

Lane B, first creation run in candidate mode. Task `bigbox-retail-pickup-cart-store-remembered-after-creation`
(variant `store-remembered`, armed only after the build; judged by playback goal). Tree `fxwork/t262`: downstream
1d04a11a (local `dev` 128d907e is one documentation commit ahead), Core 52d7ac3a (= Core `dev`), both clean. Instance
`t262-slot-3`, slot 3, workspace `t262-b`. Previous live run on this instance: `run-muxkyfxz-446c3a4e` (legacy mode,
failed, debug present). Core panel cached under key `1367d361435b817938aec124`; running identities proven by the free
rehearsal `run-mv0e7tn8-74af47cb`.

## Expectations (written before launch)

Instruction sha256 `8da0b9f6...43d3` (330 characters). Correct candidate, oracle and wrong outcomes: the lane report
`docs/working/mvp-final-month-plan/reports/lane-b-candidate.md`, section "Expectations".

Command: `FLUXIQ_LAB_INSTANCE=t262-slot-3 FLUXIQ_TEST_ENV_FILES=none pnpm.cmd lab:campaign
bigbox-retail-pickup-cart-store-remembered-after-creation --max-attempts 1 --authoring-mode candidate -- --target
persistent-isolated --workspace t262-b`, launched at or after 04:00 UTC once.

To check, in order:

- the chat send and the chat's reading of the instruction (verbatim or paraphrase);
- exploration: the store picker and Set as my store on Millbrook; the right towels (not Loftwell, not 6 Double
  Rolls), 12 Double Rolls, quantity 2, Pickup; the right napkins (not the shipped-only 3-Pack), 250 Count, Pickup;
- each submission: how the store step is written (desired-state choice, optional, or a plain press that the armed
  variant will not offer), separate towel and napkin steps, no invented confirmation wait at the end;
- each trial: `start: reset`, each step with its attempts, the robot check if it appears, the end view;
- judge verdicts against the five oracle facts;
- promotion, chat apply, "ready";
- the Lab's own reset, arm of `store-remembered`, playback on its own tab, and the oracle;
- cost and calls by part; the UI at every moment (chat, cards, overlay, Automations).

## Result (written by the lane B lead, 2026-10-09 ~04:17 UTC)

**Failed at the first submission; no Flow, no trial.** Guard admitted 04:00:09 UTC (fingerprint `sha256:7840d5c7...`);
run started 04:01:09, chat send to ending 132 s, run ended 04:04:54. Lab verdict `failed`, `lab.chat_build_failed`,
issues `flow_bootstrap.evidence_repeat_without_progress`, `llm_evidence_loop.repeat_refused`. `candidateOutcome`:
`verdict not_tested`, `trialCount 0`, no promotion. Never reached: trial, judges, promotion, chat apply, the Lab's
reset/arm/playback, the oracle, a replay.

- Calls and cost: 33 calls, $0.043458 (chat 1, $0.000182; build 32, $0.043276 of the $0.10 ceiling and 48 calls).
  Of the build: 25 exploration decisions that ran a tool $0.033512; 2 refused exploration decisions $0.002316; 2
  submissions $0.003225; 3 submissions refused as repeats $0.004223.
- Mode candidate, flash; identities verified before the first call (same snapshots as the rehearsal).

Sequence:

1. 0001 chat: `flow.createHere` with the instruction verbatim.
2. Exploration 0002-0056: consent closed (t319), picker covered once by the email layer (`target_covered`), email and
   chat layers closed, picker opened, Set as my store on Millbrook (t353, `modify_existing`): header shows Millbrook.
   Towels searched, the right product opened (t483), 12 Double Rolls checked (t704), Add to cart (t1104) at the
   default quantity 1, Pickup by default: cart 2 items, $20.44. Quantity 2 was never set.
3. Napkins 0028-0056: every query contained "250 Count" ("ValueRidge Everyday Dinner Napkins 250 Count", "... single
   pack"). The fixture's search (`search/query-match.ts`: every query word must start a word of the product's name,
   brand or department) therefore returned only the ship-only 3-Pack (482214100). The right product, named "ValueRidge
   Everyday Dinner Napkins" with 250 Count as variant 5530102 (`catalog/pantry.ts:13-15`), was on screen the whole
   time as its default "100 Count" tile and was never opened. 0047/0048: a malformed decision (`kind: "callId"`);
   0049/0050: a repeat of the 3-Pack click refused. The model concluded "the napkins 250 Count single pack is only sold
   as a 3-Pack" and submitted.
4. 0057/0058 submission 1 (17 steps): refused `flow_bootstrap.evidence_completion_parameters_unresolved`, issues
   `web.step.consequences_undeclared` and `web.step.expected.consequences_classes_or_none` at
   `plan.subflows.0.nodes.10.parameters` and `nodes.17.parameters`.
5. 0059/0060: identical script resubmitted, same refusal. 0061-0066: the model said it was declaring consequences "on
   the store-set and napkins add-to-cart presses" (both already declared `modify_existing`) and resubmitted the
   identical script three times; each was refused `llm_evidence_loop.repeat_refused`; at the third Core ended the build
   (`AUTOMATION_STUDIO_LLM_EVIDENCE_MAX_REFUSED_REPEATS_IN_A_ROW = 3`).
6. Chat ending: "'Create an automation here' stopped because the build failed: it kept trying without getting any
   further, so it was stopped. The Flow ... has no steps yet, but it keeps your instruction, so you can build it
   again." Overlay "Build failed".

Judge versus oracle: no judge ran, and the oracle was not measured (no Flow). Exploration's own end state (Millbrook,
soap plus towels x1, $20.44) would fail `towels-added`, `napkins-added` and `nothing-else`. The submitted script
would have failed its trial: steps 6-7 press Carden Falls' card name (t340) and its "Your store" label (t343) instead
of Millbrook's Set as my store (t353); step 9 opens the napkins 3-Pack (t1246) as the towels; steps 10-12 use handles
never printed to the model (t551, t560, t570); there is no Pickup or 250 Count choice; the napkins "add" is the "Visit
the ValueRidge Essentials Store" link (t1440). Detail: `reports/lane-b-candidate/w2-exploration-audit.md`.

### Causes, with reproduction and the file to change

| # | Cause | Reproduction | File to change | Verified by |
| --- | --- | --- | --- | --- |
| C1 | Core's script format tells the model "A step that types, chooses, waits or reads never needs it" (the `consequences:` line), but the domain requires the line on `web.dom.type` with `submit: true`; both searches were refused | 0057 `request.txt` line 1967; provider-free: `node scratchpad/w1/refusal-index.mjs` (feeds 0058's exact script through Core's built parse, assemble and resolution) gives 17 steps, 22 nodes, refused at nodes 10 and 17, feedback identical to the live `result.json` | Core `runtime/flow-bootstrap/plan/flow-script-format.ts:141` (state the submit rule; add a `submit: true` example with `consequences: none`); the rule is downstream `domain/src/runtime/llm-evidence/plan-resolution/step-permission.ts:110-112`; fail-first test `plan/tests/flow-script-format.test.ts` | lead re-ran the reproduction and read both lines |
| C2 | Refusal issues name plan node indices (`plan.subflows.0.nodes.10`), which do not match the script's step positions: each optional step adds a merge node (`authoring/assemble.ts:342-344`), so nodes 10 and 17 are steps 8 and 14 (lines 32 and 58). Nothing names the step; the model guessed wrong and resubmitted unchanged four times until the repeat stop | the same reproduction (node table) | Core `authoring/assemble.ts` (keep each node's script step and line), `llm/harness-options/bootstrap-completion.ts` (pass the map), `plan/issue-feedback.ts` (attach `step` and `line` to each `plan.subflows.N.nodes.M` issue); tests `plan/tests/issue-feedback.test.ts`, `llm/harness-options/tests/bootstrap-completion.test.ts` | lead (reproduction output) |
| C3 | The chat card for this refusal says "some steps point at things that weren't seen on the page; 4 things to fix": the wrong reason (chosen by the code's tail `parameters_unresolved`) and the wrong count (issue codes, not the 2 steps). The repeat-refused resubmission card reads "Change the Flow · run the step again" | panel moments 08 and 10 | Core `runtime/activity/wording/completion-refusal.ts:9` (word by issue code; count distinct steps); the repeat card's act label in the candidate cards (t373) | lead (screenshots, source line) |
| C4 | Handles the model never saw resolve silently: t551, t560 and t570 appear in no page view or find result (only in the model's own script quoted back from 0059), yet nodes 12-14 drew no `web.handle.unknown`. Handles are checked before consequences on each node (`resolve-plan-node.ts:410-413`), and only nodes 10 and 17 were refused. They sit in the numbering gap of a printed soap tile (t550 printed, t551-t554 not) | grep of every `request.txt`, `page.txt` and `result.json`; not reproduced in isolation (the reproduction stubbed handle resolution) | downstream handle store, `plan-resolution/handle-tokens.ts`: accept only handles some evidence printed to the model | lead (grep and code order); inferred, not reproduced |
| M1 | Model: searched with the size in the query, never opened the visible "100 Count" tile, and concluded the single 250 Count pack does not exist | 0028-0056 | none required; optional general guidance (search by the product's name; choose size and options on the product page) | worker 2, lead (fixture) |
| M2 | Model: exploration added the towels at quantity 1 and never chose quantity or Pickup in place; the script used invented or wrong handles | 0024-0026, 0058 | none (the trial and judges exist to catch this) | worker 2 |

Not traced: why the identical 0060 resubmission ran instead of being refused as a repeat (0062 onward were refused).

### UI review (10 moments, lead)

- Good: the instruction shown verbatim; "Starting...", then "Building your Flow" with a live sub-line; the covered
  target worded "a popup or banner on the page was covering it"; the ending is honest, keeps the instruction and
  offers a rebuild; overlay "Build failed".
- U-B1 = C3 (wrong reason and count on the refusal card; resubmission labelled "run the step again").
- U-B2: the ending names no cause ("kept trying without getting any further"); it should say the Flow was refused for
  two search steps that did not say what submitting does.
- U-B3: Click and Type cards name no control (lane A's U1, still open).
- U-B4: model narration is shown as fact even when false or unmatched: "the napkins 250 Count single pack is only
  sold as a 3-Pack"; at 0049 "I'll open the ... 250 Count single pack product page" while the call was the 3-Pack link
  (refused as a repeat).
- U-B5: "The AI model's reply couldn't be read or used. Asking it again" in the chat and overlay is accurate but
  technical.

### Guard and slot state left behind

- Ledger: `start` 04:00:55 and `finish` 04:04:56 for `t262-slot-3`, verdict failed, $0.043458. This debug exists under
  the run id (debug rule satisfied). The `unchanged` rule refuses this instance and task until source changes.
- Slot 3 still claimed by t262 lane B. No Lab or browser process from `fxwork/t262` is running (process list checked
  by command line at ~04:12; nothing killed).
