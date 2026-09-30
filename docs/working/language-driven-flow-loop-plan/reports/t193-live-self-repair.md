# t193 live lane B: self-repair

## Fix log

| Fix | Files | Exposed by | Validation | Status |
| --- | --- | --- | --- | --- |
| A: a wrong-control refusal names the node that fits (`detail.useNode`, e.g. `web.output.dom-click`), with the same handle as `target` | domain `runtime/llm-evidence/plan-resolution/resolve-plan-node.ts`, `runtime/llm-evidence/tool-rejection.ts`, `plan-resolution/tests/resolve-plan-node.test.ts`, `llm-evidence/tests/tool-rejection-detail.test.ts` (worker t193-wA) | `run-munnq7vz-98c3481c` | wA: focused 29/29, and 24 pass / 5 fail with the source reverted; domain suite 908/908; tsc src+test 0; structure audit passed. Lead re-run: see the domain suite line below. Live: pending run 3 | validated locally; live pending |
| B: the Flow's configured call count (`llmExecutionSettings.maxCalls`) and per-call cost bound the build, the recovery and the result check again. The token limits and the timeout are deliberately not read: the web app stores 8k/2k/10k tokens and 20 s by default, which would starve panel builds. | Core `runtime/llm/flow-execution-limits/{resolution-within-flow-settings.ts, index.ts, tests/resolution-within-flow-settings.test.ts}` (new), `runtime/llm/index.ts`, `runtime/service.ts` (import, `:1515` comment, `:1518`, `:2586`, no added lines), `runtime/recovery/annotation/annotate.ts`, tests `loop-limits/tests/flow-bootstrap-evidence-loop.test.ts`, `tests/service-bootstrap/tests/flow-call-limit.test.ts` (new), `recovery/annotation/tests/{annotate.test.ts, annotate-harness.ts}` (worker t193-wB; the lead narrowed it to spend limits only) | `run-munnq7vz-98c3481c` | Lead: the 4 files 52/52 after narrowing. wB: 6 failed with a pass-through leaf; tsc 0; audit 0; fluxiq build 0 | validated locally; live pending |
| G2: live Lab runs take screenshots of the run's own Chromium window (page, side panel, overlay) through PrintWindow, without taking focus and bounded to 4 s, with a front-tab Playwright fallback, every 15 s while working and at dispatch, settle, error and final | downstream `packages/test-runner/src/run-scenario/window-capture/**` (new, 11 source and 4 test files), `run-scenario.ts` (adapter, periodic start and stop), `run-scenario/index.ts` (worker t193-wC). The launcher now passes `--evidence events`, because 9 of the 10 scenarios declare no evidence policy. | runs 1 and 2 (`screenshotCount: 0`) | wC: test-runner build clean; 21/21; audit passed; a scratch capture of a live Lab window took 0.39 s. Lead re-run: 21/21 | validated locally; live pending |
| F: identical "Set as my store" buttons are listed one per store, each with its card's words. A run of 5 or fewer identical controls is no longer folded into one example. `within` is no longer blocked by list position. A lone folded example carries its row's words. | extension `content/repeat-exemplars.ts`, `content/tests/repeat-exemplars.test.ts` (new); domain `runtime/llm-evidence/look-alikes.ts`, `elements.ts` (doc only), `tests/look-alikes.test.ts`, `tests/packet-carries-no-selector.test.ts` (the row's words may now appear once, as `within`; the record key still never appears) (worker t193-wE) | `run-munpjclw-52592f43` | wE: extension suite 1219/1219; domain 909/909; tsc 0 ×3; audit passed; both new tests fail with the fix reverted. Lead: suites re-run for round 1 (see Validation) | validated locally; live pending |
| G1: t174's committed fixes applied here (not t193's work) | see Causes G1 | runs 1 and 2 | Core rebuilt rc 0; run 2 carried the build trace | carried until t174 merges |

**Round 1 validation, re-run by the lead on the t193 tree with every fix in place (2026-09-30 ~06:50 UTC):**
- Domain `pnpm --filter @fluxiq-web-extension/domain test` (label t193-lead): 909/909.
- Extension `pnpm --filter @fluxiq-web-extension/extension test`: 1219/1219, 0 `not ok`.
- `node scripts/structure-audit.mjs`: passed (124 warnings, 120 baselined).
- Test-runner `window-capture` tests: 21/21.
- Core `npx vitest run` over `runtime/recovery`, `runtime/tests/service-bootstrap`, `runtime/loop-limits` and `runtime/llm/flow-execution-limits`: 569/575. The 6 failures are all t174's `rejections.test.ts` (below).
- Core fluxiq tsc, audit and build: rc 0 (before the lead narrowed B's leaf; the narrowed leaf's 4 test files then passed 52/52).

A lead error to note: one attempt ran the extension suite and the audit in the main checkout
(`C:\Users\osrs_\FluxStuff\!FluxIQWebExtension`, a `cd` that bound to only one of three background
subshells). It wrote only ignored test-build output there. That failure was a main-checkout Core export
mismatch, `CLIENT_GATEWAY_ACTIVITY_CAPABILITY_ID`, and is not a t193 result. Both were re-run on the t193 tree
with the results above.

**Overlap for the supervisor to settle (G2 and t174's F4).** Both are validated and uncommitted, and both
hook `run-scenario.ts`. t193's G2 was recorded first. It writes whole-window JPEGs (page, side panel and overlay
as the person sees them, PrintWindow, no focus change) into the bundle through the evidence adapter. t174's F4
(`run-scenario/ui-review/**`) writes separate page and panel PNGs beside the bundle, plus overlay presence and
flicker samples. They complement each other: F4's overlay samples measure flicker, which G2 cannot. If only one
stands, keep F4 for the overlay samples and drop G2's periodic hook, or keep both, since the hooks touch
different lines.

Taken from other lanes at the next round, not fixed here: t195's F1 (consent-wall defence, extension
`interference/`), which bigbox playback needs; t174's F5 (a start-location-only step cannot answer an
instructed act).

Needed from other lanes: **t174**'s `thrown-issue-codes` (in G1) makes 6 tests in Core
`runtime/tests/service-bootstrap/tests/rejections.test.ts` fail. Each intentional `invalid_input`
refusal now carries `issueCodes: ["thrown.Error", "thrown.at:runtime.service.flow-bootstrap-commands.generation-request.ts:50"]`,
and the tests expect 5 keys. t174 owns both the code and the fix: either expect the codes, or keep
the codes off typed refusals.

Lane lead t193, 2026-09-29. Trees: `C:\Users\osrs_\FluxStuff\fxwork\t193\!FluxIQWebExtension`
and Core `C:\Users\osrs_\FluxStuff\fxwork\t193\!FluxIQ`, both on `task/t193-live-self-repair`
(downstream `defcbe2d`, Core `f0dbbd6` at start). Lab slot `lab-slots/slot-2`, instance
`t193-slot-2`, headed, deepseek-flash, production profile, $0.25 cap, 48 calls, `--replays 2`.

What this lane judges: a Flow built on the unarmed site meets the variant, fails, and FluxIQ
diagnoses, explores, repairs, validates, persists the repair, then replays deterministically with
zero provider calls. A task passes only on the finished repaired run; it is left after two passes
in a row.

Launcher: `scratchpad/live-run-b.sh` (t174's `live-run.sh` with slot-2, `FLUXIQ_LAB_INSTANCE=t193-slot-2`
and this tree). Core built first (`contracts`, `fluxiq`, `client-gateway-websocket`): rc 0.

## Task order and streaks

| Task | Variant | Passes in a row |
| --- | --- | --- |
| `bigbox-retail-pickup-cart-redesigned-after-creation` | `redesigned-buy-box` | 0 |
| `company-website-quote-request-redesigned-after-creation` | `redesigned-quote-submit` | 0 |
| `job-board-save-halvard-week-redesigned-after-creation` | `overflow-save` | 0 |
| `social-network-feed-group-post-regrouped-after-creation` | `regrouped` | 0 |

## Round 1 hand-back (2026-09-30)

Nothing is in progress: every t193 edit below is validated locally, and none is live-proven yet.

**t193's own files, commit these.**
- Downstream domain:
  - `domain/src/runtime/llm-evidence/plan-resolution/resolve-plan-node.ts`
  - `domain/src/runtime/llm-evidence/plan-resolution/tests/resolve-plan-node.test.ts`
  - `domain/src/runtime/llm-evidence/tool-rejection.ts`
  - `domain/src/runtime/llm-evidence/tests/tool-rejection-detail.test.ts`
  - `domain/src/runtime/llm-evidence/look-alikes.ts`
  - `domain/src/runtime/llm-evidence/elements.ts`
  - `domain/src/runtime/llm-evidence/tests/look-alikes.test.ts`
  - `domain/src/runtime/llm-evidence/tests/packet-carries-no-selector.test.ts`
- Downstream extension:
  - `apps/extension/src/content/repeat-exemplars.ts`
  - `apps/extension/src/content/tests/repeat-exemplars.test.ts`
- Downstream test-runner:
  - `packages/test-runner/src/run-scenario/window-capture/**`
- Downstream docs:
  - `docs/working/language-driven-flow-loop-plan/reports/t193-{live-self-repair,wA-wrong-control,wB-flow-call-limit,wC-lab-screenshots,wE-look-alike-store-buttons}.md`
  - `docs/working/language-driven-flow-loop-plan/debugs/run-{munneauy-de8663ed,munnq7vz-98c3481c}.md`
- Core (`packages/fluxiq/src/programs/automation-studio/runtime/`):
  - `llm/flow-execution-limits/**` (new)
  - `llm/index.ts`
  - `recovery/annotation/annotate.ts`
  - `recovery/annotation/tests/{annotate.test.ts, annotate-harness.ts}`
  - `loop-limits/tests/flow-bootstrap-evidence-loop.test.ts`
  - `tests/service-bootstrap/tests/flow-call-limit.test.ts` (new)

**Shared files: t174's hunks plus t193's.** Take t174's version of each, then apply t193's hunks.
The hunks are saved as patches in the lane scratchpad:
- Downstream `packages/test-runner/src/run-scenario.ts` and `run-scenario/index.ts`: `scratchpad/t193/t193-own-hunks-downstream.patch` (G2: the adapter, the periodic capture, start and stop, and one barrel line).
- Core `runtime/service.ts`: `scratchpad/t193/t193-own-hunks-core.patch` (B: the import, `:1515` comment, `:1518`, `:2586`).

**G1 only: t174's commits, take t174's version.** Every other modified file in both trees.
- Downstream:
  - `apps/extension/src/background/connection/{gateway-session.ts, tests/gateway-session.test.ts}`
  - `domain/src/runtime/llm-evidence/node-run/{replay.ts, tests/replay-ambiguous-target.test.ts}`
  - `packages/test-runner/src/{core-web-build/server-process.ts, core-web-build/tests/server-process.test.ts, flow-lane/creation/build-proposal.ts, flow-lane/creation/tests/build-proposal.test.ts, http-control/index.ts, http-control/long-request.ts, http-control/tests/long-request.test.ts, network-guard.ts, run-evaluation/tests/runner-wiring.test.ts, run-lifecycle/pair-extension.ts, run-lifecycle/pairing-status-wait.ts, run-lifecycle/tests/pair-extension.test.ts, run-lifecycle/tests/pairing-status-wait.test.ts, run-scenario/extension-control-page.ts, run-scenario/tests/extension-control-page.test.ts, run-scenario/extension-start-trace/**, tests/network-guard.test.ts}`
- Core:
  - `packages/client-gateway-websocket/src/{index.ts, open-error.ts, transport.ts, types.ts, tests/transport.test.ts}`
  - `flow-bootstrap/generation-failure/{index.ts, phase-failure.ts, thrown-issue-codes.ts, tests/thrown-issue-codes.test.ts}`
  - `llm/evidence-loop.ts`
  - `llm/evidence-loop/{index.ts, progress-trace.ts, tests/draft-shown.test.ts, tests/progress-trace.test.ts}`
  - `llm/harness-options/{bootstrap-completion.ts, tests/bootstrap-completion.test.ts}`
  - `llm/tests/evidence-loop-draft-shown.test.ts`
  - `tests/service-bootstrap/tests/{accounting.test.ts, catalog.test.ts}`

## Stage 1, written before each task's first run

### bigbox-retail-pickup-cart-redesigned-after-creation

Instruction: "Switch my pickup store to Millbrook Crossing Supercenter, then add two packs of the
ValueRidge Essentials Select-A-Size Paper Towels in the 12 Double Rolls size and one pack of the
ValueRidge Everyday Dinner Napkins in the 250 Count size to my cart, both for pickup. Keep what is
already in my cart as it is, and do not check out."

A correct Flow, built on the unarmed site:
1. Open the store chooser and pick Millbrook Crossing Supercenter first (the page reloads; the
   12-roll pack cannot be picked up at Carden Falls, so adding first adds it for delivery).
2. Reach the Select-A-Size Paper Towels product page (search or listing).
3. Choose the "12 Double Rolls" swatch, Pickup, quantity 2 (+ once).
4. Close the support card if open; press the pinned Add to cart (`data-testid="atc"`); the first
   press after a load only wakes the page.
5. Reach the Everyday Dinner Napkins page; choose "250 Count", Pickup, quantity 1; Add to cart.
6. No checkout. Final mini cart: store Millbrook Crossing, soap kept, 2 x towels 12 Double Rolls
   pickup, 1 x napkins 250 Count pickup, "4 items · Subtotal $43.39".

After the variant is armed (`redesigned-buy-box`): every class renamed, Add to cart has no
automation id and sits in the buy box under the quantity, and Buy now (skips the cart) is in the
pinned bar. The built Flow's Add to cart presses must fail (target not found), the repair must
re-point both presses at the buy-box Add to cart, never Buy now, and persist; two provider-free
replays must reach the same final cart.

A wrong answer that looks right: pressing Buy now (cart lacks the items), adding before the store
switch (towels for delivery), a quantity of 1 towel pack, or a repair that "passes" with no
replay.

### company-website-quote-request-redesigned-after-creation

Instruction: ask Kestrel Lane for a free quote to replace a boiler with a combi boiler; details Ada
Synthetic, ada.synthetic@example.test, 07700 900123, postcode KL6 2RN; current boiler a 2009
floor-standing model in the kitchen; reply by email; no marketing; the request must reach them.

A correct Flow: dismiss the consent banner; open the quote drawer; fill name, email, phone,
postcode; pick the boiler-replacement service from the div-built list; describe the current boiler;
switch the contact preference from Phone to Email; untick the pre-ticked marketing box; close the
chat greeting card if it covers the footer; press Send request (`data-testid="quote-submit"`); land
on `/quote/received`. After the variant (`redesigned-quote-submit`): Send request is gone, "Save and
finish later" (files a draft, sends nothing) stands where it was, and the real submit is "Get my
free quote" in the step header. The repair must re-point the submit at "Get my free quote", never
"Save and finish later". Wrong-but-plausible: a saved draft, the marketing box left ticked, contact
by phone.

### job-board-save-halvard-week-redesigned-after-creation

Instruction: save every Halvard Systems job posted in the last 7 days to saved jobs, unsave
nothing, then open saved jobs so the list shows.

A correct Flow: search or filter for Halvard Systems and last 7 days; for each matching card, save
it (heart) only if not already saved; open Saved jobs. After the variant (`overflow-save`): the
heart now follows the company, and Save moved into the job pane's unlabelled More actions menu. The
repair must open each job's pane and use More actions > Save; pressing hearts follows Halvard and
saves nothing. Wrong-but-plausible: company followed, jobs unsaved, a saved job toggled off.

### social-network-feed-group-post-regrouped-after-creation

Instruction: post the given text word for word in the Riverside Allotment Society group, then make
sure it is waiting for admin approval.

A correct Flow: open the group; press "Write something..." (the prompt, by test id); type the exact
text; post; confirm the pending-approval box. After the variant (`regrouped`): the prompt is gone and
Create post / Create poll / Create event stand in its place. The repair must re-point at Create
post; Create poll turns the text into a poll question (pending box says Poll).

## Runs

| # | Run | Task | Stage reached | Causes | Fix | Validation |
| --- | --- | --- | --- | --- | --- | --- |
| 1 | `run-munneauy-de8663ed` | bigbox pickup-cart redesigned | 2 (18 decisions, 9 tool calls, no completion) | Ended `flow_bootstrap.evidence_repeat_without_progress`: decisions 8-17 were ten repeats answered `llm_evidence_loop.already_answered`, then an amendment of d5 and d3 refused `did_not_work`. Stage 2 parameters: NO EVIDENCE (no build trace in this tree, G1). UI review: NO EVIDENCE (no screenshots, G2). $0.0253, 18 calls. | G1: t174's committed code applied to this tree | Core rebuilt rc 0; run 2 carries the trace |
| 2 | `run-munnq7vz-98c3481c` | same | 2 (64 decisions, 41 tool calls, 5 refused completions) | Act 1 (store switch) never landed. The store chooser opened four times; every pick was `dom-select` on a "Set as my store" `<button>` and was refused `handle_wrong_kind_of_control` (iterations 17, 27, 38, 51, 55); the model never tried a click (cause A). The build then ran 64 decisions against `--llm-max-calls 48`, so the Lab failed the run `performance.budget` (cause B). Five completions refused `bootstrap.instructed_act_missing`; each dry run found draft step 4 `core.replay.unreproducible` in about 6.4 s (cause D). $0.138, 64 calls. | A, B and G2 dispatched; D owned by t174 | pending |
| 3 | `run-munpjclw-52592f43` | same (fixes A, B, G2; `--llm-max-calls 64`, `--evidence events`) | 2 (64 decisions, no Flow) | The first 18 bundle screenshots ever (G2 works). The model now pressed "Set as my store" with a click (A's `useNode` was never needed) but chose the wrong store twice. At 06:16:10 the chip read Carden Falls Neighborhood Market; at 06:16:44 it read Carden Falls Supercenter. The build went on as though the store had switched (cause F). Decisions 6-13 were repeats with no tool run (cause C). The last completion was refused because its dry run was `core.replay.failed` + `core.replay.unreproducible` (cause D) → `flow_bootstrap.evidence_unusable_decision`. | F fixed (wE); C and D not fixed here | F: suites green; live pending |

## Causes found, with owners

| # | Cause | Owning file and line | Owner | Status |
| --- | --- | --- | --- | --- |
| G1 | This tree lacked t174's committed fixes: the build progress trace, the `did_not_work` draft-shown throw fix, the network-guard start crash fix, the gateway open timeout and more. They are on `task/t174-live-lane`, not dev. | Core `f0dbbd6..4d126f6` (20 files); downstream `6f29c62c..task/t174-live-lane` minus docs (23 files) | t174 | Applied here as working-tree patches, byte-identical to t174's commits. They are not t193's changes. |
| G2 | The Lab takes no screenshots, so the binding UI review has no evidence in any run. | `packages/test-runner/src/run-scenario.ts:178` `const screenshotAdapter = undefined` (removed 2026-09-25 because it captured a background `about:blank`) | t193 (first recorded here) | worker dispatched |
| A | A `dom-select` aimed at a button is refused `handle_wrong_kind_of_control`, and the rejection tells the model only to change the handle. It never names the node that presses a button, so deepseek-flash kept choosing `dom-select` on the store chooser's "Set as my store" buttons. | domain `runtime/llm-evidence/plan-resolution/resolve-plan-node.ts:264` (`actsOnTheWrongControl`) and `:400` (the refusal), `tool-rejection.ts:181` and `:469` | t193 (first recorded here) | worker dispatched |
| B | The Flow's configured call limit is ignored. The Lab stores `llmExecutionSettings.maxCalls: 48`, but since t186 the resolver returns fixed defaults and never reads the Flow's settings. The loop then runs to its 64-decision backstop (`loop-limits/flow-bootstrap-evidence-loop.ts:118`). | Core `runtime/llm/session-key-provider.ts:59-66`, called from `runtime/service.ts:1518` and `recovery/annotation/annotate.ts:149` | t193 (first recorded here) | worker dispatched |
| D | The dry run found draft step 4 `core.replay.unreproducible` about 6.4 s every time | domain `node-run/replay.ts` | t174 (their run 4, worker t174-w2) | not fixed here |
| F | The store chooser's three identical "Set as my store" buttons were folded into one example: the first store's. The other two ranked past the packet's 40 elements, and the example carried no card words. The model therefore saw one button for three stores and set the first one twice. (The shadow root and the scroll window were not the cause.) | extension `content/repeat-exemplars.ts` (folding); domain `runtime/llm-evidence/look-alikes.ts` (`within` blocked by list position; a lone example had no `within`) | t193 (first recorded here) | fixed (wE), live pending |
| F2 | The press result carries only `control: "Set as my store"` and `pageChanged: true`, so nothing told the model the chip now named another store. wE recommends adding the pressed control's row words and the handles whose names changed. | domain press result (`runtime/llm-evidence/press.ts`) | t193 | recommendation, not fixed |
| C | The model repeats an answered request many times in a row: ten in run 1, seven in run 3 (decisions 6-13), each answered `already_answered` with the repeat count and `pageUnchanged`. The loop's words are right, and deepseek-flash repeats anyway. | Core `llm/evidence-loop/answered-request.ts` and the no-progress guard | t189's area (decision history) / lane A | recorded, not fixed here |
| E | Refuted: wD read `draft.instructionBytes` falling from 1,052 to 154 as the person's instruction being truncated. It is the draft's own guidance, which has three lengths by design (`llm/evidence-loop/draft-shown.ts:64-73`). | - | - | not a cause |

## UI evidence for t191

From `run-munpjclw-52592f43` bundle screenshots (`test-runs/instances/t193-slot-2/run-munpjclw-52592f43/screenshots/`,
whole-window captures of the page and the side panel):
- `00001-*.jpg` (dispatch) and `00003-*.jpg` (mid-build): during a live build with a working key, the panel
  shows "Get set up ... To do: Add an AI model key" and an "Add a key in FluxIQ" button. This is wrong
  status (t195 recorded the same).
- The panel is a stack of cards ("Connected", "Get set up", "Right now: FluxIQ is working / Looking at the
  page / Stop", "What should FluxIQ do?"), not a chat message stream with a composer at the bottom.
- `00003`, `00005`, `00006`, `00008`: "FluxIQ is working" in the panel, and **no on-page status overlay** is
  visible on the site in any capture.
- The status line itself read well: "Clicking 'Loftwell Ultra Strong Paper Towels, 6 Double Rolls'".
