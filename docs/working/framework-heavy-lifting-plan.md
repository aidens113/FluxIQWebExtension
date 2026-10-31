# Framework Heavy-Lifting Plan

Status: Active
Status detail: t832 complete/pushed with shared builds and compiled smoke current. Next CC11 trusted control-intent implementation; full/paid/main held.
Created: 2026-10-28
Last updated: 2026-10-31
Owner: framework-heavy-lifting sub-supervisor (for the lead supervisor)
Scope: Where FluxIQ Core and the web domain can compute or enforce what the build model now has to get right: membership/bounds, judging, undo/reset bookkeeping, handler conditions, toggle state, stable targets, dedupe, paging, and per-call workload.
Paired document: ../!FluxIQ/docs/working/framework-heavy-lifting-plan.md
Related: [language-driven-flow-loop-plan](language-driven-flow-loop-plan.md), debug notes in `language-driven-flow-loop-plan/debugs/`

## Current State

**Accepted merged t832, 2026-10-31:** Source merges Core6b08b5b9/Down951daa2b, Core0.24. Explicit client control guidance moves original3operation paragraphs out of Core at unchanged positions; actual web runtime retains all4full UTF8 hashes/completion digest,11real saved graphs/3negative proofs. Core owns fixed grammar/safety, strict own metadata/snapshot and actual candidate/subflow/completion transport. Three authored revision validators share exact-end pattern; valid text/limits unchanged. Lead152Core tests/8files79.82s, types matching stamp1.106s (compiler120.547s), audit pass; private SDK177.646s/Domain18.116s and compiled actual-runtime smoke pass0gateway/provider calls/private renderer/helper not public. Lead82web cases pass0.730s and post-parent0.719s, types matching stamp1.422s (compiler32.306s), audit pass. Both baselines unchanged1143/583, exact incoming parent handoffs retained with source diffs verified empty. Down task finished/removed; Core mandatory70merge-contract tests pass9.29s; backups Core66f51f63/Downb546c4a9 retained, private Core clean detached for age-prune. Evidence main Down test-runs/2026-10-31-t832-validation/. Paired dev pushed; shared SDK100.967s/Domain20.395s/host3.447s/allthree extension bundles27.031s current. Actual compiled runtime smoke preserves4original web pins/completion digest and frozen explicit companion, exposes no internal renderer/revision helper and dispatches0gateway/provider calls. Broader P10 remains; read-only CC11design traces trusted resolver sidecar because current consent exception trusts model handler wording (authoring-check gap, not proof of a dispatched lasting act). Full/paid/main held.

**Accepted merged t830, 2026-10-31:** P9 source merges Coredf16f217/Down1d41420f, Core0.23. Root179Core owning tests/8files68.21s, legacy370/27 and compatibility202/13 pass; types93.033s and private SDK129.098s pass. Down191affected runtime tests114.385s,79parent example tests with unchanged byte pins/saved graph proofs, Domain types20.372s, final extension types/structure audit and three bundles31.931s pass. Installed isolated Chromium company-website transport PASS34.8s: completed1member batch,2TYPE/13fresh successful actual command-replies (10snapshots,1declared-start arrival strictly before first TYPE,2TYPE), no later navigation/submission/new subscription/URL change/gateway error/judge/provider call. Build cancelled deliberately after measured transport property; no finished judged Flow/performance claim. Core owns exact original capture time separately from semantic identity; real Native/Gate/web paired units preserve A across reused handles, protect B, refuse changed document, preserve accounting/no added steps. Core mandatory merge70tests8.69s pass after deliberately updating only changed evidence-decision prompt pin (45owning prompt tests9.15s); no production relaxation. Down task removed through finish; private Core clean detached for age-prune, backup2f766513 and later pin357577ed retained remotely, Down backup569ead87 retained. Evidence main Down ignored test-runs/2026-10-31-t830-validation/. Paired dev pushed and verified against origin; shared SDK95.545s/Domain23.790s/host3.521s/allthree extension bundles25.430s current. Compiled actual runtime smoke preserves all4original web hashes/completion digest, exposes only2public adapter accessors/private authority0, dispatches0gateway/provider calls. Main/full/paid held.

**Shipped P10 and baseline:** t831 worked-example ownership shipped on paired dev69dcecba/c084b96a; all79web example tests pass again after this task parent sync, including exact section hashes and saved graph acceptance. Inline guidance/facts/intent/vocabulary/fingerprints remain subsequent P10 work; read-only next-unit design recorded. t829 repeat/history acceptance and earlier dated context remain archived below.

**Standing constraints:** Both Oct31 full-suite slots used; narrow checks only, main promotion waits a permitted passing sweep. No paid GO; future live model tests use CLAUDE_API_KEY/Claude/$5 whole build, no fallback. No user panel management, real user data or profiles. Preserve main .clinerules/fluxiq.md hash b052f0e6b0e6c6de0ba973810c7632eda04aadfdd5314eaaa73710edd1101a8d. Product model guidance remains generic.

[Accepted dated context and ledger](framework-heavy-lifting-plan/archive/2026-10-31-runtime-context.md). [Exact incoming P10 parent handoff](framework-heavy-lifting-plan/archive/2026-10-31-p10-parent-integration.md). Core owns generic algorithms and paired reports; Down owns browser/domain producers. Current task acceptance above takes precedence over historical ledger entries.

[Exact parent handoff retained during sync](framework-heavy-lifting-plan/archive/2026-10-31-t832-parent-handoff.md).

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

### 2026-10-31 t830 paired proof and handoff restoration

- Changes: missing original reference owned by Core; exact replay time retained separately from semantic list identity; web producer final receipts, immutable views and route deltas remain on the task branch. Paired unit gateway now updates only the addressed field; every original oracle retained.
- Validation: Core provenance/prior-nodes owning command ->179tests/8files pass68.21s; Core check ->pass93.033s; SDK ->pass129.098s. Down example owning selector ->79pass; post-parent check ->pass30.614s; worker paired selector ->2pass, root full affected191selection in progress. Exact logs and commands in paired Core lead-acceptance.md.
- Documentation correction: root found CRLF-sensitive section slicing had truncated this local handoff. Restored every original contract/phase/brief/ledger/question line from dev parent, with normalized full-body equality proof before this additive ledger entry. Exact incoming parent remains fenced and pinned; no code changed in this correction.
- Outcome: Partial; final owning checks and installed browser acceptance pending. Full and paid runs held.

Accepted dated ledger moved verbatim to [the runtime context archive](framework-heavy-lifting-plan/archive/2026-10-31-runtime-context.md).

### 2026-10-31 - t831 client-examples setup and accepted-memory compaction
- Agent: Codex lead; first Core contract worker briefed by file.
- Changed: isolated paired t831 setup; accepted context/ledger preserved identically with four checksums, current P10 scope separated from original audit.
- Validation: `pnpm.cmd task start client-flow-examples --worktree --core --skip-workspace-build` ->exit0, compiled SDK0.21 restored from shared cache8.094s, workspace build skipped; `python -` archived substring/SHA256 probe ->all4blocks match.
- Outcome: Partial; first optional contract/validation unit starts, no prompt change or code acceptance yet.
- Follow-up: Core contract -> Down authored exact tails -> Core consumer extraction/parity; serialize shared public/service/tools files against t830. No full/paid calls.

### 2026-10-31 - t831 optional contract acceptance
- Agent: Codex lead; standard contract worker, root receiver-compatibility review.
- Changed: optional copied/frozen flowScriptExamples, strict renderer/validation and receiver-preserving checked binding, owning public export; existing prompts unchanged.
- Validation: `pnpm.cmd --filter fluxiq exec vitest run src/programs/automation-studio/runtime/flow-bootstrap/script-examples/tests src/programs/automation-studio/runtime/llm/domain-instructions/tests --maxWorkers=2 --minWorkers=1` ->58/4files pass43.55s; `pnpm.cmd --filter fluxiq check` ->exit0,18.453s; `node scripts/structure-audit.mjs` ->passed. Initial fixture optional-type/as-never errors corrected without production weakening.
- Outcome: Partial; unit1 accepted, SDK0.22 rebuild running; Down exact authored tails and Core consumer extraction/parity not yet implemented. No model/public prompt change claimed.
- Follow-up: freeze Down producer from original current strings before removing examples from Core. Merge t830/dev and choose next version before final integration. No full/paid calls.

### 2026-10-31 ? P10 exact web examples accepted

- Changes: web owns four original worked-example tails; actual Core candidate/subflow/completion consumers use explicit validated binding metadata. All eleven examples resolve through real domain stores before strict saved validation.
- Validation: `pnpm.cmd --filter @fluxiq-web-extension/domain test runtime/llm-evidence/script-examples` ->79tests pass912.3482ms; `pnpm.cmd --filter @fluxiq-web-extension/domain check` ->exit0,12.959s; `node scripts/structure-audit.mjs` ->exit0. Core owning gates and exact commands recorded above and in lead-acceptance.md.
- Outcome: Done for this bounded unit; paired integration pending. Subflow byte parity is compositional Core actual-schema/Down original-byte proof, not browser or live model acceptance.
- Follow-up: integrate/push paired dev, refresh shared SDK/domain, continue t830 P9. Broader P10 inline medium/facts/intent/fingerprint migrations remain. No full/paid calls or panel management.

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
