# Framework Heavy-Lifting Plan

Status: Active
Status detail: t828 narrow checks pass; installed browser exposes timely failed result not becoming a required receipt. Debugging safely; no full/paid calls.
Created: 2026-10-28
Last updated: 2026-10-31
Owner: framework-heavy-lifting sub-supervisor (for the lead supervisor)
Scope: Where FluxIQ Core and the web domain can compute or enforce what the build model now has to get right: membership/bounds, judging, undo/reset bookkeeping, handler conditions, toggle state, stable targets, dedupe, paging, and per-call workload.
Paired document: ../!FluxIQ/docs/working/framework-heavy-lifting-plan.md
Related: [language-driven-flow-loop-plan](language-driven-flow-loop-plan.md), debug notes in `language-driven-flow-loop-plan/debugs/`

## Current State

**Active t828, 2026-10-31:** Core0.20 independently accepted122tests/14files, typecheck, full audit and compiled SDK smoke; imports ratchet removed1 old violation, baseline1143. All three private SDK libraries current. Down domain source/tests types and build pass after optional-field/copy fixes; first selection142/143 passed, all corrected/additional91 pass and final18 fixture/contract tests pass; native16 rerun passes. Extension84owning tests/typecheck/build and Lab typecheck/build/four trace-reader tests pass. Source/producer/identity APIs frozen. Installed browser attempts1-2 stopped on test locators, corrected using persistent fixture identity; attempts3-5 reached Core but stopped safely with required_outcome_unknown. Attempt5 actual browser target-not-found failure arrived in4837ms, retryable true, gateway errors0; Attempt6 proves353656-byte click result suppressed as invalid_result by Core256KiB canonical hash guard; fix must support legitimate opaque gateway results without dropping payload integrity or weakening unknown-effect protection. No browser acceptance or integration claimed. Private SDK0.20/main0.19. Full suites exhausted today; no paid calls/panel management. Reports in private Core p8-identity; ignored browser attempts1-6 preserved in main.

**Continuing, 2026-10-31:** t823 implements a fixed referenceNow across executor/native/runtime dispatch, trials, resumed/child runs, browser filtering/sorting, replay and final judging. Fresh execution captures its start; reused evidence retains it; live timers still advance. Core0.16.0 adds optional fields and preserves old exports after extracting graph options. Lead500 Core tests/89 domain/12 extension/27 tooling tests pass; Chromium134.0.6998.35 headless UTC job-board proof passes exact2 supplied-reference rows versus1 wall-clock row after midnight. Core/domain/extension types pass; Core full audit passes and downstream remaining targeted rule passes, final merge gate pending. Extension first check lacked fresh compiled domain/node; building only domain fixed it. Setup now offers downstream --skip-workspace-build with Core safety gates retained; both AGENTS files document it. Initial setup unexpectedly attempted a full workspace build and was refused after Core inputs changed; no further full command ran. Merged Core41adfa49/downstreamda2f4301 after final structure gates and70 Core merge-contract tests; next P8 runtime robustness discovery. Remote task backups retained. Main needs a later permitted full sweep. No paid go/API calls or panel management.

**Current fix-forward, 2026-10-31:** t822 ended exit1 despite2488 registered domain passes: src/tests/domain.test.ts failed during module load. The same hidden failure existed in t821, so the earlier claim that its robot-watch assertion was the only failure was incomplete. Core had mistaken incidental 'Choose ensureState' help for selection capability. The fix uses declared node id/label/tags/output identities only; the web domain explicitly declares check/select, type/submit and tab/open. Original integration assertions now run as named tests, with denied-operation expectations strengthened. Lead275 Core plan and42 domain tests pass; both package type checks exit0. Final catalog consolidation30/30 passes. Paired dev integration completed: Core26973484/downstream2ec3dc42; final pushes follow this memory update. Both full structure audits pass; Core merge gate70/70 passed with the default full check explicitly skipped. Both Oct31 full-suite slots are used: narrow checks only; main needs a later permitted full sweep. Coreb72e4214's20683/7-skipped proof is historical and cannot qualify this classifier change. Claude/$5 is configured, but no paid go or calls occurred.

**Codex continuation, 2026-10-30.** Resumed from the handoff below. The lead independently verified t799 on its
paired task trees after merging current `dev`; both sides are now merged. C1 and P1b are verified and merged (P1b: Coreb4a8f453/downstream01da7fa3).
t814 is merged downstream6c88f928/Core4a522cd8 after required default-project ownership acceptance. Written briefs and reports are under `reports/codex-1030/`. Each lane owns its
existing task trees; no paid run or panel management is authorised by this continuation. The user approved t810's
fully-refuted rejection passing without a model yes on 2026-10-30, explicitly requiring a judge re-prompt with the
evidence first; incomplete refutations must remain nonpassing.
Preserve the unrelated `.clinerules/fluxiq.md` modification in the main checkout.
**Live provider switch, user 2026-10-30:** use Claude for every subsequent live model-backed test, reading
`CLAUDE_API_KEY` from `.env.local`, with no silent DeepSeek fallback. Paired t816 now supplies runtime, keys/settings UI and
Lab support on both pushed dev branches; see `claude-live-provider-plan.md`. Keep identical acceptance criteria and
record exact model, verdict, calls, billed cost and runtime for comparison. No credential value belongs in this record.
The user set Claude live tests to $5 per build; main ignored `.env.local` and both agent instruction files record it.
**Full sweep2 finished failed, promotion held:** frozen Core803f3c81/downstream16dd9ad3 passed both builds and Core check; Core tests had six ordinary/27SQL failures; downstream check had five failures, units five domain/three demo failures. Core web3454 and extension3459 tests passed. Core t819/t820 are merged/pushed3f5fe961/c7f33647; all failed files now pass targeted checks (259 unique Core, seven domain saved-repair, five Lab arguments,16 registry/CLI and nine demo tests), final Core/test-runner/product types and product build pass. Product cache wrappers registered; Claude/$5 setup/CLI fixtures aligned. Main dependencies refreshed; original storage15s timeout unexplained. Disposable t818 was removed via task abandon after0/0 unmerged; main logs remain in ignored test-runs/2026-10-30-sweep-2. Corrected-source sweep next, with an early-launch date guard for local2026-10-31; no paid calls or main promotion before full acceptance.

**Core owns this plan.** The findings, the responsibility map, every client contract (CC1-CC14, K1-K7), the phases
P0-P10 and what not to do are in the owning document:
`C:/Users/osrs_/FluxStuff/!FluxIQ/docs/working/framework-heavy-lifting-plan.md` (FluxIQ Core).
This document holds only the web-specific half:

- which domain and extension files fill each Core contract;
- moving web concepts out of Core;
- the Lab reporting fix that every live check depends on.

It links to Core's contracts and does not restate them.

### Session handoff, 2026-10-30 (lead; the user asked to stop and write everything down)

This section is also the session's handoff for the hosted lanes, whose detail is in `hosted-production-plan.md`.

**Merged and pushed to both `dev` branches** (each verified by the lead under the heavy-check lock; ledgers below and
in Core's and the hosted plans):
- Framework:
  - P0 (t793), the check's library build (t794), the per-pass act ledger (t796), P4 one undo answer (t797);
  - P5a computed facts before any judge (t795), the chat ending after a Core no (t805);
  - P7 dates, marks, record defaults (t800), the P7 follow-ups (t807);
  - P1a folded bookkeeping (t806);
  - **repair from the failing step (t804)**, the user's rule "Build the whole Flow first; test it whole only when it
    should work", now in both AGENTS.md and enforced by Core.
- Lab: W0 verdict from structured data (t798).
- Hosted:
  - B3 IAM on every route (t803), lane A gateway and panel hardening (t802);
  - C0 closeable instances (t808), the A and B3 follow-ups (t809);
  - the website stand-in W0-W2 (t801, t809): **the live sign-up round trip passes**;
  - the web app's direct contracts-import guard (t812).
- Fixes on `dev`: the panel production build import (Core 4d7c2264) and the contract-test identity fake (Core c5cb635b).
- **`main` promoted** after the 2026-10-30 first sweep (all suites green): Core `bcbcfa97`, downstream `ee5768d5`
  (`trace-offline-trials-plan.md` ledger). t812 and later reach `main` with the next sweep.

**Stopped at the handoff.** Every lane stopped on the user's request and wrote its report. The lead then saved each
lane's work as a "WIP at the 2026-10-30 handoff" commit on its task branch. Nothing is merged into `dev`, no lead
acceptance check passed, and no paid run or model call happened.

| Task | Work | Latest continuation state | To resume |
| --- | --- | --- | --- |
| t799 (P6 + W6) | `clear_interference` rung, generic layer kinds, trial-close handlers, toggle `ensureState`, learned pace; web obstruction, rate limit, stateful state | Merged on both dev branches after lead acceptance: 235 Core, 40 domain and 29 extension tests, types/reference, native Chromium proof and final audits; Core merge gate passed 70 contract tests | First-loop direction fixed/proven by t817; browser rung/pacing coverage remain separate follow-ups; no paid qualification claimed |
| t810 (P5b) | Grounded no refutation, evidence-specific judge re-prompt, checked-cell citations, provenance and replay marks | All handoff defects fixed; integrated with Claude and shared output schema; lead119 Core +8 domain checks pass, final Core types/audit pass; worker RV1467/callers805/domain541/extension501 pass. Strict saved replay remains unsure for missing new replies, never fabricated acceptance | Merged downstream ad01bd0b and Core31713e1d; 70 merge-contract tests passed; no paid qualification claimed |
| t811 (P1b) | Submit-then-test, label repair, Core completion, revision-aware keys and live CLI context | Lead42 Core+26 CLI tests pass; post-sync types pass; native2/2 verifies24rows/2whole/1partial and12-to9 builder decisions with unchanged gates; model/purse/mode reaches actual child configuration | Merged Coreb4a8f453/downstream01da7fa3 with Core0.13.0;70 merge-contract tests pass; ignored JSON evidence retained in main test-runs/2026-10-30-t811-final |
| t813 (hosted C1) | Workspace manager/layout, profile IAM, background-task close/drain | Merged both repositories after lead9 background and123 web/key-custody tests, types,3libs, docs/audits; Core merge contract gate70 passed | C2/C3 caller migration and routing remain separate; no real tenant socket/browser qualification claimed |
| t814 (hosted E + D5) | Product/brand/assets, host loading and owned default project | Lead panel32/web27/ownership36/product18 and types/builds pass; real service-IAM default ownership, retry/partial/concurrent/conflict cases covered | Merged downstream6c88f928/Core4a522cd8 with Core0.12.0;70 merge-contract tests pass; later lifecycle wiring remains separate |
| t817 (first-row toggle) | Paired before/after evidence, explicit grounded ensureState, persistence and runtime guards | Lead Core204/domain37/extension9, types/libs/audits/docs pass. Native first-row oracle+saved replay15-to15callbacks/3skips/0transitions and obstruction4recoveries/handler/finalyes pass; lead JSON gates accepted and3files preserved | Merged Coreae354e9d/downstreamdf58a48e, Core0.14.0;70 merge contracts and downstream structure pass; final sweep pending |
| t819/t820 | Provider-ID binding, model/key propagation and bootstrap fixture alignment | Core259 unique focused checks across both fixes/failure files, saved-repair7, types/audits/libs and each70 merge contracts pass; original storage timeout not reproduced | Merged/pushed Core3f5fe961/c7f33647, Core0.14.1; final corrected-source sweep pending |

**User decision, 2026-10-30 (t810):** a judge's no that Core wholly refutes from its own record, and that still stands
after one re-ask with the evidence, may pass with no model yes. The user explicitly chose "Allow a fully refuted
rejection to pass". Integration still requires the outstanding audit, typecheck and acceptance fixes.
The user then clarified that the judge must be re-prompted before that outcome; Core must not bypass that recheck.

If a lane ended with the session, its tree still holds the work. Read its report, then check, commit, merge `dev` in
and verify as above. Re-dispatch only the missing part.

**The demo run (user-requested, 2026-10-29).** `run-mvud43a2-445c7f17` (social-network-feed recent group posts, $0.11):
- The build followed the user's lifecycle: built live, one whole test.
- The saved Flow was correct (`oracleVerdict: passed`), but the final judges said no with self-contradicting
  `asked_missing` rows, so the run reported `unverified`. That is P5b's target (debug in
  `language-driven-flow-loop-plan/debugs/`).
- The run found the panel-build defect that the t812 guard now catches at merge.

**Next, in order:**
1. t823 shared clock is merged after narrow acceptance; continue P8 runtime robustness discovery. Both 2026-10-31 full-suite slots are used; main remains held until a later permitted full sweep passes. No further full suite today.
2. t817 fixed the first-already-satisfied-row defect: paired before/after evidence and explicit grounded end-state choice now pass native oracle/saved-replay proof; no first/majority click inference.
3. After the user's go, run the live round with Claude/$5: photo-social newest likes, the everything-store gate, the social gate. Then the
   recording-plus-instructions passes. Debug every failure.
4. Follow-ups:
   - a verbatim-cell fact;
   - the extension picker seen in a browser.
5. Hosted:
   - after C1, C2 (call-site migration) and C3 (routing, per-workspace singletons);
   - D2-D4 extension sign-in, consent and minimisation remain to implement; their scheduled merge date is not evidence of completion;
   - F packaging, D6 infrastructure, D7 docs and legal, D8 with the stand-in's W3;
   - the owner's email verification under `service`;
   - `docs/architecture/platform.md` (close options, held keys, per-root pools).

**Standing rules from the user this session:**
- Build first; repair from the failing step (AGENTS.md).
- No paid run without the user's "go" while they are present ("wait till I say go").
- Do not rebuild during demo preparation.
- Stop means stop starting work; running lanes keep their state.

**Waiting on the user:**
- by about 11-03: the VM, DNS and the store developer account;
- analytics (U10) and the FluxIQWebsite edit permission (U11);
- Core's N1-N7 and a Firefox install;
- deleting the merged task branches on GitHub (t781, t793, t795-t812);
- the stale lock-waiter shell pid 260134 left by a t801 worker, which the lead did not kill on the worker's behalf.

**Machine notes:**
- Heavy checks share `C:/Users/osrs_/FluxStuff/lab-slots/heavy-check.lock`; nobody removes a lock they did not
  create.
- Sweep and verify scripts are in the session scratchpad (the `sweep-1030a.sh` pattern: detached worktrees on pinned
  heads, then a fast-forward `main` push).
- Finished tasks' detached Core worktrees under `fxwork/` are left for `pnpm task prune`.

**Earlier context:**
- The evidence reports in `framework-heavy-lifting-plan/reports/` (fhl-debug-notes, fhl-step-workload,
  fhl-core-surface, fhl-domain-surface) fed the Core synthesis.
- The web side already computes most of what Core needs; per-item marks (CC2) shipped in t800, and control intent
  (CC11) is still wholly new.
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

- **CC8 `transient` accepted t826.** Host-only `D/runtime/host-failure/`, adapter and tool producers annotate parsed rate limits/transport faults after wire parsing; browser-shared constructors never emit it. Core reads CONTROL-only failure facts, preserving uncertainty and actual flags; no English retry exemption remains.
- **CC10 pending.** Content already computes closed hidden/disabled/covered facts; Core OutputDispatchResult has no actionability field. Next unit defines a portable typed projection and mixed-version reading before host emission, without treating it as unacted proof or reading English headers in Core.
- **CC12.** The effect class per action kind comes from `D/runtime/lasting-act-statement.ts`,
  `D/client/interrupted-action/commits.ts` and `LE/node-run/run.ts` (`webPlanStepMustDeclare`). A purchase-like
  submit is `commit`, so Core never lowers it.
- **Re-find by identity without a source step.** `D/runtime/target-reacquire/reacquire-target.ts` and `element-match.ts`
  answer from the stored fingerprint against the current view.
- Tests: `D/runtime/host-failure/tests/failure.test.ts` and `LE/node-run/retries/tests/transient.test.ts`, `D/runtime/target-reacquire/tests/identity-only.test.ts`,
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
| Authoring transient phrases removed t826; generic defensive transport/status fallback remains in Core | host-only `D/runtime/host-failure/` after existing wire parsing | CC8 |

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

Settled entries through t825 are preserved verbatim in [the accepted runtime ledger archive](framework-heavy-lifting-plan/archive/2026-10-31-accepted-runtime-ledger.md).

### 2026-10-31 - compact accepted runtime ledger
- Agent: Codex lead.
- Changed: archived all24 settled ledger entries and the misplaced accepted t825 entry without changing their content; restored section order.
- Why: the ledger exceeded20 entries and the protocol requires compaction on touch.
- Validation: `python -` ->25 source blocks preserved exactly in archive; payload hash printed and source section order restored.
- Outcome: Accepted; no runtime source changes.
- Follow-up: maintain the active t826 acceptance entry below.

### 2026-10-31 - t826 typed transient end-to-end acceptance
- Agent: Codex lead; contract/consumer SolMax, host SolMedium with SolHigh validation fixes.
- Changed: host-only temporary annotation, strict original/control/history preservation and projected tool failure across exploration/replay/capture/reset/throws; Core0.18/contracts0.4 readers/guards/privacy.
- Why: regex exemptions hid temporary facts and uncertainty; reconstruction could weaken originals or leak diagnostic comparisons into new controls.
- Validation: `pnpm.cmd --filter @fluxiq-web-extension/domain check` ->exit0,24.8s; `pnpm.cmd --filter @fluxiq-web-extension/domain build` ->exit0,23.0s. Initial235 named domain tests231pass4legacy-expectation failures; focused final82pass covers all4/new cautious fixtures/retry typing. Lead273unique named Core/contract tests pass, both audits passed before final test-only typing repairs; exact commands/failures in p8-transient/lead-acceptance.md.
- Outcome: Accepted; paired dev integrated Core03e518b3/downstream59489463, both structure gates and Core70merge contracts pass. Chromium saved-once1pass, local filtered SDK/domain/extension builds current; no full/API/model calls or panel management.
- Follow-up: paired dev pushes then CC10/P8 remainder; main waits permitted sweep and paid Claude comparison waits go. Remote task backups retained; user clinerules unchanged.

### 2026-10-31 - t827 typed actionability discovery
- Agent: Codex lead; discovery worker SolMax for mixed-version action safety.
- Changed: paired setup; frozen portable exact actionability API/pure export, source0.5/0.19; readers first; t826 accepted evidence archived verbatim. Wire stays nested payload.
- Why: portable actionability must survive strict readers without losing executed results or becoming act permission.
- Validation: `pnpm.cmd task start runtime-actionability-signal --worktree --core --skip-workspace-build` ->exit0, both task trees created, mandatory3CoreSDK builds pass (Core87.2s); exact owning commands in downstream p8-actionability/lead-acceptance.md ->338 Core/contract tests accepted, 31 domain/final68 extension reruns pass, native Chromium three tests pass, both final audits pass1144/615 unchanged.
- Outcome: Implementation accepted; 338 Core/contract tests, affected domain/extension reruns, types/builds and three native fixture proofs pass. Both final audits and paired dev integration pass; main filtered SDK/domain/extension bundles current.
- Follow-up: push both dev branches, then remaining P8 identity/repeat/history work. Main held for next permitted full sweep; no paid go/full suite.

### 2026-10-31 - t828 source-less target discovery
- Agent: Codex lead; two read-only Luna High workers, Core and host.
- Changed: private paired setup and discovery briefs/reports in sibling Core.
- Why: literal targets with no source step need identity-based refresh.
- Validation: `pnpm.cmd task start runtime-target-identity --worktree --core --skip-workspace-build` ->exit0, both trees and mandatory3Core SDK builds complete (Core73.93s); no new runtime tests.
- Outcome: Partial; affected web/Lab checks and Core122 pass; browser attempt1 fixture locator failed after pairing, corrected attempt2 running; no live provider calls.
- Follow-up: reconcile findings and freeze the generic/host interface, then implement; no full suite/paid calls.

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
