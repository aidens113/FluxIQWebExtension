# Framework Heavy-Lifting Plan

Status: Active
Status detail: Web-specific half of the Core-owned plan (written 2026-10-28); executing since 2026-10-29: Core P0, the per-pass act ledger and P4 with W4 (t797) and P5a (t795) merged, W0 (the Lab verdict from structured data, t798) merged; W6 (t799) and W7 (t800) in flight with Core P6 and P7.
Created: 2026-10-28
Last updated: 2026-10-29
Owner: framework-heavy-lifting sub-supervisor (for the lead supervisor)
Scope: Where FluxIQ Core and the web domain can compute or enforce what the build model now has to get right: membership/bounds, judging, undo/reset bookkeeping, handler conditions, toggle state, stable targets, dedupe, paging, and per-call workload.
Paired document: ../!FluxIQ/docs/working/framework-heavy-lifting-plan.md
Related: [language-driven-flow-loop-plan](language-driven-flow-loop-plan.md), debug notes in `language-driven-flow-loop-plan/debugs/`

## Current State

**Core owns this plan.** The findings, the responsibility map, every client contract (CC1-CC14, K1-K7), the phases
P0-P10 and what not to do are in the owning document:
`C:/Users/osrs_/FluxStuff/!FluxIQ/docs/working/framework-heavy-lifting-plan.md` (FluxIQ Core).
This document holds only the web-specific half:

- which domain and extension files fill each Core contract;
- moving web concepts out of Core;
- the Lab reporting fix that every live check depends on.

It links to Core's contracts and does not restate them.

- **True now:** Core's P0 (t793) and per-pass act ledger (t796) are merged, and so is t794 (Core's check builds its
  libraries first). P4 with W4 (t797) is merged, P5a (t795) is merged, and W0 (t798, the Lab verdict from structured data) is merged here. P6 with W6 (t799) and P7 with W7 (t800) are in flight as Core-paired tasks.
  The evidence reports in `framework-heavy-lifting-plan/reports/` (fhl-debug-notes, fhl-step-workload,
  fhl-core-surface, fhl-domain-surface) fed the Core synthesis.
- **The web side already computes most of what Core needs.** It has toggle signatures, `layerCleared`, the acted-on
  item, location moves, stale-target re-find by identity, value shapes and pagination detection. What is missing is
  emitting them in Core's typed, optional shapes. Two items are wholly new: per-item marks (CC2) and control intent (CC11).
- **Next:** W0 (Lab verdict from structured data) before the first live round. Then each W-phase pairs with its Core
  phase in one Core-paired `pnpm task`, after Core's default has shipped, so Core never waits on the web side.
- **Blocked:** nothing.
- **Unverified premises** (Open Questions below):
  - whether `values` and `differs` are filled for a non-list region;
  - tab and resource identity for witnesses;
  - whether the place token of a looped act embeds the item's page address.

| W-phase | Pairs with Core | Fills |
| --- | --- | --- |
| W0 | none (Lab) | Lab verdict and budget label from structured data |
| W3 | P3 | CC4 places and `placeChanged`, CC5, CC6 |
| W4 | P4 | CC4 `inverse`; one place token per act |
| W5 | P5 | Source element reference and normalisation for stored cells (feeds K4) |
| W6 | P6 | CC7, CC8 rate limit, CC9 |
| W7 | P7 | CC1, CC2, CC3; the date-bound twin |
| W8 | P8 | CC8 `transient`, CC10, CC12; re-find by identity without a source step |
| W10 | P10 | CC11, CC13, CC14; receive the concepts moved out of Core |

P0, P1, P2 and P9 need nothing from the web side. P2 relies on `resource` and `location`, which already ride on every
start-state read.

## Contract fills

Paths: `D/` = `domain/src/`, `E/` = `apps/extension/src/`, `LE/` = `D/runtime/llm-evidence/`. For each contract's shape
and safe default, see Core's "Client contracts" section. Everything below is optional on the wire: a web build that
emits none of it behaves as today.

### W3. Effect places, region values, landing (CC4 places, CC5, CC6)

- **CC4 places and `placeChanged`.** The source is the press-effect reading the domain already makes from the looks
  before and after: `LE/node-run/press-effect/page-changes.ts`, `toggle.ts`, `toggle-signature.ts`, `acted-on.ts`,
  `chosen-state.ts`, plus `LE/control-spot/place.ts`, `states.ts`, `collection.ts`. Emit one `effect` per press, with
  `class` from CC12 and `places[]` as the place tokens whose state token changed.
  - New: a count or total delta. A badge or total in a named region today shows up only as page-change lines; put it
    in `values`.
- **CC5 values of any region.** Fill `values` and `differs` on every start-state read (`LE/start-state/state.ts:7-25`,
  `read-state.ts`, `differences.ts`, `LE/control-spot/values.ts`) for named non-list regions (a total, a badge, a field).
  - Hash only stable text. Reuse the volatile-text rules of `D/runtime/target-reacquire/volatile-text.ts` so times,
    relative dates and rotating promotions do not count as change.
- **CC6 landing.** `D/runtime/state-diff/state-diff.ts:1-22` (`locationChanged` versus `documentChanged`),
  `LE/node-run/start-location.ts` (`webMovesThePage`), and the ARRIVED header (`LE/page-view/header.ts`) give
  `landing {from, to, marksDiffer}`. `marksDiffer` compares the arriving view's state tokens, not its URL.
- Tests: `LE/node-run/press-effect/tests/effect-record.test.ts`, `LE/start-state/tests/region-values-stable.test.ts`,
  `D/runtime/state-diff/tests/landing.test.ts`.

### W4. Inverse acts and one place per act (CC4 `inverse`)

- Inverse descriptors come from effects already recorded, and are never authored:
  - **a toggle:** the reversed `toggle` signature on the same place token (`D/actions/toggle-signature/signature.ts`);
  - **a created item:** its identity, plus the remove control its own row shows, when one is visible;
  - **a navigation:** the location it left;
  - **an action whose CC12 class is `commit`:** `{kind: irreversible}`.
- **The place token of a looped act.** `LE/control-spot/place.ts` builds tokens that include the page address, so the
  same control on two item pages gets two tokens (mvrj-a44a's livelock). Give each control a token that does not change
  with the item's page address, or have Core compare by one place per act (Core P4). Settle which in W4's first task.
- Tests: `D/actions/toggle-signature/tests/inverse.test.ts`, `LE/control-spot/tests/place-per-act.test.ts`.

### W5. Stored cells traceable to the page (feeds Core K4)

- For each stored cell, the read reports which end-view element it was read from and a normalised form (whitespace
  folded, currency symbol and thousands separators kept as separate tokens). Core then checks "verbatim text of one
  element" without a tolerant match.
- Sources: `D/actions/extraction/summary.ts`, `LE/result-observation/`, `E/content/extraction/value-shape.ts`,
  `value-statement.ts`.
- Tests: `D/actions/extraction/tests/cell-source.test.ts`, `E/content/extraction/tests/value-normalised.test.ts`.

### W6. Obstructions, rate limits, stateful controls (CC7, CC8 rate limit, CC9)

- **CC7.** Report an `obstruction` on a covered or failed attempt, and as a standing fact in the view, not only after
  a close. Sources:
  - `E/content/action-runtime/actionability.ts:1-30` (covered, plus its closers);
  - `LE/front-layer.ts`, `layers.ts`, `layer-marks.ts`;
  - `LE/node-run/press-effect/cleared-layer.ts`, `answered-layer.ts`, `LE/way-out-handles/`;
  - the wire in `D/client/gateway-mapping.ts:324-362`, `D/io/gateway-output-dispatcher.ts:90` and `D/actions/types.ts:603`.
  - Map the web layer kinds to Core's generic ones: consent to `overlay`, promotion to `notice`, unnamed dialog to `other`.
  - The fact evaluator (`D/runtime/facts/evaluate.ts`, `condition.ts`) answers `obstruction visible|absent` and keeps
    `dialog` as an alias.
- **CC8 rate limit.** `web.action.rate_limited` (`D/actions/extraction/summary.ts:143-183`, `E/content/actions/click.ts:20-27`)
  becomes a `rate_limit` obstruction, with `retryAfterMs` only when the page states it.
- **CC9.** Print `stateful` and one computed `state` per control at look time:
  - from `LE/page-view/element/state-tokens.ts` and `LE/control-spot/stateful.ts`;
  - for controls whose state lives in their words or class, from `D/actions/toggle-signature/derive.ts` and
    `class-delta.ts`, learned from an earlier press of the same kind of control.
  - Keep `idempotentWith` (`D/actions/schemas.ts:255`).
- Tests: `E/content/action-runtime/tests/actionability-obstruction.test.ts`, `D/runtime/facts/tests/obstruction-fact.test.ts`,
  `LE/page-view/element/tests/state-tokens-stateful.test.ts`.
- Browser check: these are content-script changes, so run a manual browser test on a realistic scenario (photo-social)
  alongside Core P6's live check.

### W7. Typed fields, marks, row identity, the date twin (CC1, CC2, CC3, K1)

- **CC1.** `E/content/extraction/value-shape.ts` today changes only the label. Emit a `type` (`currency`, `number`,
  `count`, `date`, `text`, `url`) and the parsed value beside each sample (`LE/structure/field-sample.ts:20-52`,
  `LE/structure/packet.ts:127-215`). `kind` in `D/actions/extraction/request.ts:20` stays a read mode.
- **CC2.** Marks per row (a badge, a flag, a state icon that is not a text cell) come from `E/content/extraction/badge-name.ts`,
  `record-control.ts`, `item-record/` and `infer-fields.ts`, as `fieldMarks` on the packet. `D/actions/extraction/condition-grammar.ts`,
  `request.ts:96-150` and `E/content/extraction/item-filter.ts` accept `is present` on a mark.
- **CC3.** `rowIdentity` comes from link identity (`D/actions/extraction/request.ts:75`, `E/content/extraction/link-identity/`)
  and the key columns re-find already uses (`D/runtime/target-reacquire/row-key-columns.ts`).
- **K1 twin.** The date bounds in `E/content/extraction/item-filter.ts`, `D/actions/extraction/condition-grammar.ts` and
  the plan-resolution conditions must keep the same semantics as Core's `condition-holds.ts`. Add the date cases to the
  shared parity cases.
- Tests: `LE/structure/tests/packet-type-marks.test.ts`, `D/actions/extraction/tests/condition-date.test.ts`,
  `E/content/extraction/tests/item-filter-date.test.ts`, `E/content/extraction/tests/marks.test.ts`.

### W8. Transient faults, actionability, effect class, identity re-find (CC8, CC10, CC12)

- **CC8 `transient`.** `D/runtime/failure/codes.ts` and `D/runtime/adapter.ts:264` set it. The English "retry later"
  phrases leave Core (P8) and live here as the domain's classifier.
- **CC10.** `E/content/action-runtime/actionability.ts` reports `actionable {ok, reason, coveredBy}` on the dispatch
  result. The `LOADING busy` header (`LE/page-view/header.ts`) maps to `busy`.
- **CC12.** The effect class per action kind comes from `D/runtime/lasting-act-statement.ts`,
  `D/client/interrupted-action/commits.ts` and `LE/node-run/run.ts` (`webPlanStepMustDeclare`). A purchase-like
  submit is `commit`, so Core never lowers it.
- **Re-find by identity without a source step.** `D/runtime/target-reacquire/reacquire-target.ts` and `element-match.ts`
  answer from the stored fingerprint against the current view.
- Tests: `D/runtime/failure/tests/transient.test.ts`, `D/runtime/target-reacquire/tests/identity-only.test.ts`,
  `D/runtime/tests/lasting-act-class.test.ts`.

### W10. Receive the concepts Core gives up (CC11, CC13, CC14)

See the next section.

## Moving web concepts out of Core

Each item leaves Core in Core's P10 and arrives here in the same Core-paired unit. Core keeps only a generic fallback.
The web binding supplies today's behaviour, so web prompts and refusals do not change.

| Core item (Core path) | Arrives at | Contract |
| --- | --- | --- |
| 56 lines of `web.dom.*` and `web.browser.*` node ids, plus medium words and examples, in `flow-bootstrap/plan/flow-script-format.ts`; `web.` literals in `issue-feedback.ts`, `candidate-trial/feedback.ts`, `repeat-guard/outcomes.ts`, `harness/locator-text.ts`, `submission-refusal.ts` | `LE/system-instructions/instructions.ts` and the node descriptions in `LE/harness-options/options.ts` | CC13 |
| English accepting words, lead words and the close-glyph regex (`script-statements/way-out-steps.ts:71-75`) | new `LE/control-intent/` classifier (icon, label, layer position; per-language lists) | CC11 |
| Commerce act vocabulary (`instructed-acts/kind-words.ts:4-11`, `instruction-acts.ts:78`, `act-object.ts:50`) and run-time act words (`executor/step-skip/act-not-done.ts:26`) | the binding's `actVocabulary` from `LE/harness-options/options.ts` | CC14 |
| `dialog` fact and target (`script-statements/fact-condition.ts:95`, `service/runtime-session/interruption-handler.ts:40`, `plan/contracts.ts:125`, `harness-options/plan-fact-targets.ts:17`) | `D/runtime/facts/evaluate.ts`, `condition.ts` answer `obstruction` (alias kept) | CC7 |
| Closed layer kinds `consent\|promotion\|dialog` (`executor/node-execution/cleared-layer.ts:13`) | the kind mapping in `LE/node-run/press-effect/cleared-layer.ts` | CC7 |
| DOM fingerprint keys and weights (selector 14, xpath 11 and others; `model/action-element-target.ts`, `fingerprinting/element-fingerprint.ts`) | `D/element-fingerprint/build.ts`, `signals.ts` name the signals and weights | open signals map (P10) |
| Transient phrases (`llm/repeat-guard/retry-later.ts:7`, `executor/defensive/thrown-error.ts:43,214`) | `D/runtime/failure/codes.ts` | CC8 |

Rules for the move:

- New web examples use a different kind of site from the ten realistic scenarios, as Core's do today.
- Core's script-format examples are rewritten, not copied.
- Validation: build the web binding's system prompt before and after the move and compare. The only difference allowed
  is ordering. Run a domain test that each moved list is supplied whole.

## Web phases: validation and live checks

- **W0. Lab verdict from structured data.**
  - `packages/test-runner/src/flow-lane/creation/candidate-outcome.ts` (`chatDraftVerdict`, which reads Core's prose;
    t753 `TOLD_DRAFT`) reads Core's structured ending instead.
  - `packages/test-contracts/src/evaluation.ts` gains `not_judged` for a run that called no judge.
  - A token-reservation under-estimate (mvskptb1: 14,643 reserved against 15,093 reported) must not relabel a playback
    failure as `performance.budget`. W0's first step is to locate that classification in the test-runner.
  - Tests in the `tests/` folder beside each file.
  - Live: none on its own; it rides in the first round.
  - Unit: `pnpm task start fhl-lab-verdict`.
- **Narrow validation for W3-W10:**
  - the domain and extension typechecks;
  - `cd domain && DOMAIN_TEST_BUILD_LABEL=fhl-w<N> node scripts/test-domain.mjs <path fragments of the changed dirs>`;
  - `cd apps/extension && EXTENSION_TEST_BUILD_LABEL=fhl-w<N> node scripts/test-extension.mjs <fragments>`;
  - the structure audit, against the paired Core worktree.
  - No full suites; those stay in the twice-a-day sweep.
- **Browser checks.**
  - Content-script, actionability, layer and extraction changes (W6, W7, W8) get a manual browser check on the
    Chrome/Edge build, recording the page and extension state.
  - Any Playwright content-harness spec uses only the ten realistic scenarios.
- **Live checks:** the scenario named in each paired Core phase, in a visible browser, started from the extension chat,
  with the UI reviewed.

## Web what not to do

Core's "What not to do" applies in full. Web-specific additions:

- Never put a scenario's control words (its "Join", "Like" or "Return" labels) into the intent classifier, a mark name
  or any model-facing text. Marks and intent are computed from structure.
- Never let a region token include volatile text.
- Never lower an action's class below what the page shows it does.
- Never emit a field that is guessed rather than read. An unknown field is absent, not false.

## Worker Briefs

### Brief: fhl-debug-notes
- Repository: this repository
- Task: read the cause and fix sections of the eight debug notes named in the dispatch; classify every failure into classes where the model had to do something the framework could compute or enforce.
- Owns: docs/working/framework-heavy-lifting-plan/reports/fhl-debug-notes.md
- Report to: docs/working/framework-heavy-lifting-plan/reports/fhl-debug-notes.md

### Brief: fhl-step-workload
- Repository: this repository (run artifacts in fxwork/t563)
- Task: measure run-mvsknffp-153bc89a's decide/judge/tool steps: what each decide asked for, request sizes, bookkeeping vs real choices, time and cost.
- Owns: docs/working/framework-heavy-lifting-plan/reports/fhl-step-workload.md, scratch files in the session scratchpad
- Report to: docs/working/framework-heavy-lifting-plan/reports/fhl-step-workload.md

### Brief: fhl-core-surface
- Repository: FluxIQ Core (read only)
- Task: map the build tools and descriptions, the script/plan grammar, trial feedback, and the judge/result-verification pipeline with file:line.
- Owns: docs/working/framework-heavy-lifting-plan/reports/fhl-core-surface.md
- Report to: docs/working/framework-heavy-lifting-plan/reports/fhl-core-surface.md

### Brief: fhl-domain-surface
- Repository: this repository (read only)
- Task: map the page view, read-list structure detection, element fingerprints, and press effects with file:line.
- Owns: docs/working/framework-heavy-lifting-plan/reports/fhl-domain-surface.md
- Report to: docs/working/framework-heavy-lifting-plan/reports/fhl-domain-surface.md

## Work Ledger

### 2026-10-29 - P0 merged: scenario-free model text, enforced by a check (t793)
- Agent: supervisor; worker (brief t793), review follow-up t793-R (worker); the script format's example rewritten in t790; report `framework-heavy-lifting-plan/reports/t793-p0.md`
- Changed: Core model-facing text in `llm/diagnosis-instructions.ts`, `llm/node-tools/run-node.ts`, `flow-bootstrap/plan/evidence-schema.ts`, `service/candidate-trial/processed-out.ts`, `result-verification/repair-directive.ts` now uses reading lists, archives, branch libraries and report filing in place of cart, coupon, store, checkout and excluded-part examples; t790 replaced `flow-script-format.ts`'s "Garden Club" membership example with a print shop. Downstream `scripts/check/model-text.mjs` (in `pnpm check`) builds 209 tokens from the ten realistic scenarios' fixture literals and fails on any in the string and template literals of Core's model-facing files (TypeScript compiler parse; comments excluded); a reviewed allow list of 8 generic words; a retired-examples list.
- Decision (supervisor review): allow-list entries must match a current Core literal; "Space Grey" (a task's answer variant, found only in comments) is not allowed.
- Validation: supervisor-run `node --test scripts/check/model-text/tests/*.test.mjs` -> "# pass 8 / # fail 0"; on the tree merged with dev (t790 in) `node scripts/check/model-text.mjs` -> "model-text: ok (209 scenario tokens, 376 model-facing Core files, 11720 string literals)"; Core under the heavy-check lock `pnpm test` llm, flow-bootstrap/plan, result-verification, service/candidate-trial -> "Test Files 443 passed (443)", real-sql 2 passed; prompt contracts "Tests 70 passed (70)"; after a library rebuild `pnpm check` -> exit 0 (without it, a stale apps/web dist failed it, as on t792: a tooling gap, follow-up); docs current; structure audit passed.
- Outcome: Accepted. The check catches names, not a scenario's shape in common words; review stays needed for shape.

### 2026-10-29 - Core's check never reads a stale library build (t794)
- Agent: supervisor; worker (brief t794), report `framework-heavy-lifting-plan/reports/t794-check-build.md`
- Finding: twice on 2026-10-29 a merge that changed `packages/fluxiq` source failed Core's `pnpm check` in apps/web (`TS2739 ... IdentityAccessService is missing ...`) until the libraries were rebuilt by hand: apps/web reads the compiled dist for the `fluxiq/*` subpaths tsconfig `paths` does not map to source.
- Changed (Core): the root `check` script runs `contracts:build`, `fluxiq:build` and `client-gateway-websocket:build` through the build cache before the parallel typechecks; `scripts/build-cache/tests/registry.test.mjs` fails if they are dropped or reordered; `docs/architecture/code-structure.md` says so. Option (b), source paths for every export, was rejected: a second list to keep in sync.
- Validation: supervisor-run `node --test scripts/build-cache/tests/registry.test.mjs` -> "# pass 10 / # fail 0"; `pnpm check` -> exit 0 in 39 s with nothing changed; `pnpm structure:check` passed. Worker's probe: a new export used from apps/web without a manual build -> fluxiq:build rebuilt (92 s) and web:check passed; cold check 4 m 14 s, warm 34 s.
- Outcome: Accepted.

### 2026-10-29 - Core owns a per-pass act ledger (t796)
- Agent: supervisor (brief t796-ledger); workers w1-rule, w4-layers, w5-ending, w6-headed-proof (worker), w2-ledger, w3-repeat-order (worker-heavy); report `framework-heavy-lifting-plan/reports/t796-ledger.md`
- Finding: debug `run-mvtdn37t-e1e4d0a7` (photo-social newest likes, no Flow): the requested like sat behind `only after:` a dismissal and was skipped on every pass, and every `extractList.sort` the build wrote was refused under a sentence about a key it had not written.
- Changed (Core, detail in Core's ledger): a requested act behind `optional:`, `only after:` or an optional step's `on success:` is refused at submit, by its words or by the lasting class the part asks for; each trial records per pass whether every lasting or guarded step ran, and a part whose acting steps never ran is proven `not_run`; a cleared layer's handler is scoped to the subflow; a For Each over a page-order listing takes the listing's own sort as its `order`; the ending names steps that never ran and the page of each act left. Downstream: headed spec `apps/extension/e2e/site-reset/tests/photo-act-ledger.spec.ts`; the domain's listing-order test now pins the new contract (a sort on the listing is admitted; a sort only in the process is refused and its instead, applied literally, is admitted), and `output-nodes/extract-list/rows-order.ts` says so.
- Validation: supervisor-run under the lock, downstream merged with dev: Core `pnpm test` over executor, flow-bootstrap, service, activity, project-agents, result-verification and nodes/control-flow -> "Test Files 852 passed | 1 skipped (853)", "Tests 7622 passed | 2 skipped (7624)", real-sql "Test Files 52 passed (52)", "all groups passed"; prompt contracts -> "Tests 45 passed (45)"; Core `pnpm check` -> exit 0 (after regenerating the working-doc index this entry's status edit had made stale); docs current; both structure audits passed; domain, extension and test-runner tsc clean; model-text "ok (208 scenario tokens, 377 model-facing Core files, 11791 string literals)"; domain tests "# pass 2440 / # fail 1", the failure being the listing-order test that pinned the old refusal, updated -> "# pass 5 / # fail 0"; headed `e2e/site-reset/tests` -> "32 passed (35.0m)".
- Outcome: Accepted. Not verified live. The span-level `repeat order:` is not built. Until t795 lands, `held.ts` still holds a judge's yes over a `not_run` part.

### 2026-10-29 - W0: the Lab's draft verdict from structured data (t798)
- Agent: lead; worker (brief t798-w0); report `framework-heavy-lifting-plan/reports/t798-w0.md`
- Changed: `packages/test-runner/src/flow-lane/creation/candidate-outcome.ts` decides a chat draft's verdict from the trial session's record, then Core's `get-flow-bootstrap-failure` diagnostic for the same candidate, then a failed trial run, and only last from Core's closing words, recording `verdictSource`; a draft no judge ran reads "was not judged", never "judged unknown" (debug mvrj-a44a); `chat/build-from-chat.ts` passes the domain. `not_judged` was not added to `RunEvaluation.reportedVerdict`: nothing could produce it (`lane-observation.ts` already writes `unverified` for an unjudged run). The budget mislabel (mvskptb1) was already fixed by t787; `live-llm/tests/budget.test.ts` pins it with the run's numbers.
- Decision (lead review): Core answers `{failure: null}` when no build failed (`api/handlers/llm-generation.ts`), so the new read does not throw on a clean draft; only a diagnostic naming this candidate is used.
- Validation: lead-run under the lock on the tree merged with dev: test-runner `pnpm check` -> exit 0, `pnpm build` -> exit 0, `node --test "dist/flow-lane/**/*.test.js" "dist/live-llm/**/*.test.js" "dist/run-scenario/**/*.test.js"` -> "# tests 958 / # pass 953 / # fail 0 / # skipped 5"; `node scripts/structure-audit.mjs` -> passed; `node scripts/check/model-text.mjs` -> "model-text: ok (209 scenario tokens, 377 model-facing Core files, 11791 string literals)".
- Outcome: Accepted. Not verified live; it rides in the next live round.

### 2026-10-29 - P4 with W4: one undo and reset answer (t797)
- Agent: supervisor (brief t797-p4) with six workers; report `framework-heavy-lifting-plan/reports/t797-p4.md`
- Changed (Core, detail in Core's ledger): one shared answer for back-at-place, undo reach and settlement; stale in-place reads not judged; unsettleable acts end with a closed reason; undo paired with its act by a reported inverse effect (CC4) or control counts. Downstream (W4): `domain/src/runtime/llm-evidence/control-spot/tests/place-per-act.test.ts` pins one place token per looped act (it passed on unchanged code: a regression guard); `docs/architecture/page-evidence.md` and three site-reset spec comments follow the single answer.
- Validation: lead-run under the lock on the trees merged with dev: domain `tsc` clean and `DOMAIN_TEST_BUILD_LABEL=t797 node scripts/test-domain.mjs` -> "# pass 2444 / # fail 0"; extension and test-runner tsc clean; `node scripts/structure-audit.mjs` passed; `node scripts/check/model-text.mjs` -> "model-text: ok (208 scenario tokens, 377 model-facing Core files, 11794 string literals)"; headed `pnpm test:e2e e2e/site-reset/tests --workers=1` -> "32 passed (40.6m)"; Core checks in Core's ledger.
- Outcome: Accepted. Follow-up (W4 remainder): the web domain fills CC4's `effect` (what a press did) so live undo pairing uses it instead of control counts.

### 2026-10-29 - P5a: Core settles rows and proofs before any judge (t795)
- Agent: supervisor (brief t795-p5) with eight workers; report `framework-heavy-lifting-plan/reports/t795-p5.md`
- Changed (Core, detail in Core's ledger): computed facts before any judge, a failing fact a Core no with no judge call, t796's `not_run` a Core no. Downstream: reports only.
- Validation: lead-run under the lock on the trees merged with dev: zero-call replays of four recorded live builds through the merged Core (`scratchpad/t795-w6/replay.mts`): everything-store `run-mvswh11y-9d462629` and `run-mvtdoyf3-47ffaac1` -> every false-pass revision and playback 0137 a Core no (`core.result.computed_fact_failed`, 0 judge calls), the correct revision no longer refused; social `run-mvskodlp-9966d618` and `run-mvswewhy-e4e469d4` -> step 0042 `answers`, as before; domain tests "# pass 2442 / # fail 0"; domain, extension and test-runner tsc clean; `node scripts/structure-audit.mjs` passed; `node scripts/check/model-text.mjs` -> "model-text: ok (208 scenario tokens, 379 model-facing Core files, 11858 string literals)"; headed `pnpm test:e2e e2e/site-reset/tests --workers=1` -> "32 passed (35.3m)".
- Outcome: Accepted. Follow-up here: after a Core no the extension shows the toast "the fix didn't finish", which must say what Core found instead.

## Open Questions

1. **Are `values` and `differs` filled for a non-list region, such as a cart drawn with div elements?** Owner: W3. This
   was taken from the mvswhobv run note and not checked in `LE/start-state/`. It is the premise of Core P3's region witness.
2. **Tab and resource identity.** `resetResource` is a session plus tab identity, so an item opened in a new tab makes
   earlier references unusable. Should witnesses key on the resource across tabs, or should Core carry the resource
   between tabs? Owner: W3, with Core Lane B.
3. **Place token per act.** Does `LE/control-spot/place.ts` embed the page address for a looped act? If so, fix it here
   or let Core compare by one place per act (Core P4). Owner: W4. The mvrj-a44a chain was inferred with no ledger trace.
4. **Stateful controls whose state lives in words or a class.** Can they be known before the first press, or only
   after one press of the same kind of control? Owner: W6. If only after, CC9 is filled late, and Core keeps
   `ensureState` from trial presses.
5. **Which languages does the intent classifier (CC11) cover first?** Owner: W10. Absent intent never refuses in Core,
   so coverage can grow over time.
6. **Can the list packet carry per-item values for every field?** Core P7's discriminating-field note needs them.
   Owner: W7.
7. **Does `extractList` honour a `done when` end marker as the read's bound?** (mvskodlp F4; not verified.) Owner: W7.
