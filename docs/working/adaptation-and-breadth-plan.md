# Adaptation Gate And Breadth Sample Plan

Status: Active
Status detail: t516/t517 merged locally; t518 crossborder passes, store matching and social terminal evidence remain in progress.
Created: 2026-10-13
Last updated: 2026-10-13
Owner: Senior supervisor agent (planned by a lane lead)
Scope: Execution plan for the MVP's next two milestones after lanes A-D qualified: the adaptation gate (create, drift, diagnose, repair, verify, persist, resume, reuse on three realistic sites, twice each, later run zero-call) and a first breadth sample of the 68 realistic tasks on sites not yet proven.
Paired document: C:/Users/osrs_/FluxStuff/!FluxIQ/docs/working/adaptation-and-breadth-plan.md
Related: Core work, if any, is briefed through Core's mvp-final-month-plan.md; [live-testing audit](./live-testing-handoff-audit-2026-10-11.md), [MVP final month](./mvp-final-month-plan.md), [state-aware recovery](./state-aware-recovery-plan.md), [testing facility](../architecture/testing-facility.md), [working index](./README.md)

## Current State

**Codex continuation active, 2026-10-13.** t516 and t517 are independently verified and merged locally on both dev branches. t518 fixes historical recording evidence and producer-clock linking before fresh recorded-Flow preflights. Publishing waits for the coherent handoff fixes. The unrelated `.clinerules/fluxiq.md` edit on main dev is preserved.

**Verified work.**

- **t517:** one certain-no-effect re-press; exhausted lasting actions fail default continuation. Explicit failed/optional routes remain. Supervisor observed 140 Core executor, 10 contract, 302 domain and 501 extension tests, package source/test typechecks, both audits and headed Chromium Post harness. Core/downstream merged locally; publishing waits for the coherent handoff fixes. Reports: `adaptation-and-breadth-plan/reports/codex-t517.md` and original t517 report.
- **t516:** guarded interruption learning stays on for model-free runs when adaptations are kept; successful judged completion gates apply. Fixed per-layer/identical-time repair, intervention, adaptation and proposal collisions. Real-domain handle issuance/resolution works without a prior model look. The alleged false robot check is an actual first-search soft check; results/wheel negative classifier cases pass.
  - Supervisor observed 108 combined Core tests, 16 domain and 32 extension tests, source/test typechecks and Core audit. Headed Chromium wheel test exposed a missing name for text-only dismissals; fixed via existing sensitivity-filtered visible text, with fail-first/final 11 dismissal tests and passing wheel/rate-limit harness cases. Full gateway/Core handler execution and durable reuse remain unverified.
  - `validation.ok` reports resolution/preflight, not execution of the new handler. Reports: `adaptation-and-breadth-plan/reports/codex-t516.md` and original t516 report. Both structure gates passed; downstream 88300455 and Core 93867c7e merged locally.

**Recorded replay cause and t518.** Automatic runtime recovery makes recorded manual retries and their inferred presence waits obsolete. Reset is present. t518 fixes producer/ingestion clock mixing, preserves explicit before-action phase, projects complete historical evidence through the live sanitizer and keeps bounded hashes-only signatures. Missing/ambiguous/truncated evidence stays unsigned. Explicit empty layer scans and descriptor identity parity are implemented.

- Supervisor observed 196 Core, 138 domain, 14 capture tests, package typechecks and both audits. A native long-path approval defect was independently reproduced at the actual 264-character subflow-summary filename and fixed in generic SQLite opens; fail-first regression then 13 storage/pool tests pass, types/audit/build pass.
- Crossborder run-mv70yrj2-bc7f032a passes its goal oracle with zero model calls/harness activations. Durable trace proves effect_holds routing past its obsolete manual retry.
- Store run-mv71ibus-9c9b922e failed four inferred-wait attempts before extraction. The genuinely pre-execution extraction carries phase (10 owning tests/type/bundle/audit pass), but the then-exact control equality rejected two delayed banner additions despite all99 required controls remaining. Complete packed control proofs now permit additions while requiring every saved control and exact path/layers; absent proof retains digest/count equality. Supervisor observed22 owning tests, domain source/test types, extension bundle compatibility and both audits. Fresh run-mv72qmg0-b3cfb3f9 proves candidate45 now matches, but routing refuses unbound_value from entry44; four attempts at obsolete wait28 still fail. Required-value provenance is under investigation; withheld command-result paths are not routing evidence.
- Social run-mv71jipp-fa66f988 posts successfully after first-press no-effect recovery and passes the page oracle, but Flow fails at obsolete readiness wait. No snapshot exists after final manual Post. Settled terminal producer and complete passive-fact projection are assigned by separate file-owned briefs; guarded End integration follows. Positive effect and required-read/result guards are mandatory. Static published state needs positive evidence; disappearing controls or the external oracle alone cannot complete the Flow.
- t518 remains on paired task branches, unmerged/unpublished. Store/social source fixes and fresh controls remain; no unchanged relaunch. t516/t517 are merged locally; neither dev is pushed while this recovery compatibility work remains. Full guarded-handler execution/durable reuse and the counted adaptation gate are still unverified.

Reports: replay-investigation, t518, t518-capture, t518-live-debug, t518-store-replay-debug, t518-live-capture-coverage and t518-social-replay-debug under adaptation-and-breadth-plan/reports/. Archived old crossborder captures lack completeness evidence and remain unsigned; fresh control proof uses new recordings.

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

1. Finish and independently verify t518, then fresh unarmed recorded-Flow controls and armed drift preflights. t516/t517 are merged locally.
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

## Worker Briefs

### Brief: codex-t516-handler-validation-path
- Worker: codex-t516; read-only investigation in paired t518, no source/live runs.
- Own report: reports/codex-t516-handler-validation-path.md. Read Current State and original t516/guarded-learning reports; exact Lab provider-free flow/replay and Core judged promotion entry points only as needed.
- Find the narrowest realistic provider-free full gateway/Core validation that reaches a cleared popup, judges success, applies learned handler and proves durable reuse. Explain whether existing recorded --flow controls actually enter that promotion path.
- Return exact commands/entry points, expected evidence keys/counts, prerequisites and honest capability gaps. No synthetic browser fixtures, task-shaped model guidance, paid calls, server management, shared docs or edits.

### Brief: codex-t518-terminal-core
- Unit/worktree: paired t518 Core only. Worker: replay_investigation, after store diagnosis.
- Read: paired Current State; downstream terminal-recovery-design report; Core AGENTS already read, follow it.
- Own: client-gateway bridge and recording boundary helper; automation-studio model recording types/state-index/intake/io-bridge; service recording-state-index and recordings recorded-routing/proposal-generation/proposal-candidates/candidate-definitions; focused terminal signer; runtime recording-flow-proposal; executor state-routing focused terminal guard/decision/contracts/required-results helper; adjacent tests/barrels. No downstream source edits.
- Preserve and strictly verify typed v1 closed_settled boundary with exact final admitted canonical executable event/source/generation/cursor, unique settled after snapshot and no later executable action. Producer stamps mapped event metadata. Missing proof declines; referenced durable-object errors propagate.
- Use opaque host project/sign/effect callbacks; positive effect mandatory. Append existing builtin.control.end only with verified terminal evidence, immutable suffix/provenance binding. Never create executable observations or model calls.
- Only inferred recorded readiness gates plus one linked final act may be bypassed. Refuse manual/branched/stale suffixes, missing effects, required reads/recordOutput/results/subflows and existing checkpoint/value/repeat/scope/progress guards. No unbound-value exemption.
- Adding End must preserve failed-final-action semantics: final required failed act cannot default-continue into End and succeed. Explicit authored failure/optional routes remain.
- Boundary shape: version1/kind closed_settled/sourceId/lastExecutableEventId/lastExecutableGeneration/admittedThroughSequence/captureTiming after-action. Agree producer metadata names with t517 directly.
- No shared docs/commit/live/full suites. Report own downstream codex-t518-terminal-core.md; freeze before root checks. Generic handcrafted examples only.
- Acceptance: durable boundary survives reopen; wrong/ambiguous/stale identities decline; generic first-send retry then obsolete readiness routes End without duplicate act; dead send fails; omitted required read and stale graph cannot succeed; old recordings preserve behavior.

### Brief: codex-t518-terminal-producer
- Unit/worktree: paired t518; downstream source only. Worker: codex-t517.
- Read: Current State; reports/codex-t518-terminal-recovery-design.md in t518.
- Own: extension content recorder/message-handler and focused recording-boundary module; background active-recording, recording-evidence, recorded-event-intake; shared boundary protocol; adjacent tests. Also own browser passive eligibility descriptor fields, composed-tree classifier and snapshot completeness.
- Build a real settled stop handshake while recording remains active, flush and await admitted canonical events after dedup, capture after settlement, verify no intervening action/document change, publish after-action terminalBoundary then finalize. Unknown scope declines; capture errors propagate. Do not relabel an ordinary pre-state.
- Agree typed boundary shape with supervisor/Core worker before wiring. Exact admitted event identity, source, action generation and admitted cursor are mandatory; timestamps alone do not prove it.
- Passive eligibility: rendered nonactionable heading/paragraph in main content, safe complete ancestry, no editable/live/status/alert/busy/dialog/overlay/banner/aside/footer/extension UI or sensitive content. Unknown false. Preserve explicit completeness. No scenario strings.
- No Core/domain edits, shared docs, commits, live runs or full suites. Stop source edits before supervisor validation. Report own file codex-t518-terminal-producer.md with changed paths, checks and limitations.
- Acceptance: owning tests prove ordering, dedup identity, flush-created final input, stop/action/document races, incomplete/busy scope, real errors; passive classification exclusions and completeness.

### Brief: codex-t518-passive-domain
- Unit/worktree: paired t518. Worker: codex-t516. Domain source only.
- Read: Current State; t518 terminal-recovery-design report, especially positive stable passive facts.
- Own: recording/web-state descriptor types/state payload; llm-evidence recognized descriptor preservation; focused route-state/passive-facts module; route-state project/historical reconstruction; effect sign/holds/format and owning tests. Coordinate shared descriptor shape with producer; do not edit extension/Core.
- Preserve browser explicit passiveFactEligible and passiveFactsComplete through durable/live sanitizer parity. Missing classification never implies eligibility.
- Project safe normalized nonactionable semantic facts into hashes only, reject withheld/secret material. Complete before and after required for passive additions. Preserve multiplicity where needed; never sample a proof.
- Add versioned passive-bearing effect; all required control and passive additions must hold, positive addition mandatory; empty/disappearance/draft never holds. Legacy control effects remain compatible. Oversized evidence declines under Core canonical bound.
- No shared docs, commits, live runs or full suites. Report own codex-t518-passive-domain.md. Freeze source before supervisor validation.
- Acceptance: live/durable parity, positive read-only facts with zero added controls, missing/unknown completeness, editable/secret/live/volatile exclusions, duplicates, loss of facts, oversized proof and legacy regressions.

Completed dispatch briefs are preserved in [the handoff brief archive](./adaptation-and-breadth-plan/archive/2026-10-13-codex-handoff-briefs.md). Current implementation briefs are added here.

### Brief: codex-t518-complete-control-match
- Repository: t518 downstream branch.
- Task: allow additional live controls while requiring every saved historical control; fix delayed-banner false negative without fuzzy historical matching.
- Required reads: Current State/live-capture report; route-state signature, comparator, format and owning tests; Core public signature size constant.
- Owns (may edit): domain/src/runtime/route-state/signature.ts, compare-signatures.ts, signature-format.ts comments only if needed, tests/signature.test.ts and tests/recorded-recovery.test.ts; own live-capture report. No other domain/Core/extension/shared-doc edits.
- Design: retain legacy sketch/digest fields. Add optional complete sorted fixed-width hash-set representation only when the whole signature fits Core's exported bound and count proves completeness; historical strict comparison may require set inclusion when both complete sets exist, with exact path/layers. Every expected hash must hold; empty expected set cannot match a nonempty live page. Missing full evidence retains strict digest/count equality. Nonhistorical fuzzy semantics unchanged.
- Safety: reject malformed/incomplete hash sets, no truncated sample inclusion, no signature budget expansion, no secrets/names/paths in signatures. Missing one required effect/control on an otherwise identical large page remains a failure; extra unrelated controls may match only with full expected evidence.
- Definition of done: fail-first added-live-controls regression, missing100th/malformed/oversized/missing-evidence/path/layer negatives, generic readiness route executes still-required read/filter; owning tests and domain source/test tsc pass. No browser/full suites/commits.
- Report to: existing codex-t518-live-capture-coverage.md with checks/limits; root owns architecture docs and browser rerun.

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
   - the scripted workflow runs for each gate site and its variant (`pnpm lab run crossborder-marketplace --variant
     basket-redesign --flow`, and the same for everything-store `--workflow first-page-earbuds --variant
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

Step C, observed only and not gating: the same replay with the base task (crossborder `crossborder-marketplace-hub-to-cart`,
everything-store `everything-store-first-page-plus-earbuds`, social `social-network-feed-group-post`). It records
whether the repaired Flow still works on the unchanged site.

Per site:

| Site | Slot (tree) | Task | Drift and what the run must learn | Oracle |
| --- | --- | --- | --- | --- |
| crossborder-marketplace | 3 (t262) | `crossborder-marketplace-hub-to-cart-basket-redesign-after-creation` | Add to cart loses its automation id and is renamed Add to basket; Buy now occupies the old place. Learn a target override, never press Buy now. | PG hub-to-cart task oracle |
| everything-store | 1 (t451) | `everything-store-first-page-plus-earbuds-deal-wheel` | A delayed spin-to-win popup makes the results page inert. Dismiss it and keep a guarded handler or branch (interruptions become branches). | DS `extract-first-page` (`workflows/first-page.ts:78`) |
| social-network-feed | 4 (t275) | `social-network-feed-group-post-regrouped-after-creation` | The recorded composer prompt is gone; Create post, poll and event replace it. Re-author the opening. The instruction permits `send_or_publish`; confirm in the dry-run request. | PG `post-in-group` (post pending approval) |

Run 1 for each site goes in one round on slots 3, 1 and 4. Run 2 goes in the next round, on the same pair if run 1 passed.
A failure is debugged fully, its cause is fixed, and the site's count restarts on the changed pair. Slot 2 carries
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

### 2026-10-13 - Complete store state matches; generated control edge corrected

- Agent: Codex senior supervisor; exact durable routing diagnosis by replay worker.
- Changed: fresh run-mv72qmg0-b3cfb3f9 proves complete historical99/live101 control matching. The refusal is unbound_value from skipped entry44.success through generated legacy ready data input, not a missing target/signature. Core generated sequential edges now enter control input in; real data/binding guards remain.
- Validation: supervisor observed37 owning proposal/skipped-value/output-read tests and Core source typecheck pass. Required data-edge negative remains refused. Source committed434c0d86/d35dab42; no browser rerun while terminal producers/contract are being edited.
- Outcome: terminal producer/passive-domain/Core guarded End work dispatched via file-owned briefs. No model calls or pushes; full handler durable execution and adaptation gate remain unverified.

### 2026-10-13 - Completed briefs archived; replay truth consolidated

- Agent: Codex supervisor.
- Changed: settled dispatch details moved to dated brief archive; Current State rewritten with observed live outcomes and current gaps.
- Validation: authored-document boundary checks during archive creation; working-document audit/index regeneration follows.
- Outcome: Accepted; implementation briefs now have room without removing evidence.

### 2026-10-13 - Later starting-state and terminal recovery gaps remain

- Agent: Codex supervisor; capture and executor investigation workers.
- Changed: genuine pre-extraction phase committed and independently checked; fresh headed provider-free controls on new isolated workspaces.
- Validation: store run-mv71ibus-9c9b922e still fails four inferred-wait attempts, extraction not_run. Extraction now has a pre-signature and routing tests six candidates, zero matches/no guard refusals. The still-required filter click is entry45 (Continue is29); routing must preserve filter work. Adjacent failed-command capture contains all99 controls from the filter pre-state plus two extra controls; exact path comparison is still being checked against artifact redaction, so no comparator change is accepted yet.
- Browser: social run-mv71jipp-fa66f988 page oracle passes but Flow fails at obsolete inferred wait36 after first Post33 reports no-effect then retries successfully. Last manual Post37 has before-signature only; no later executable boundary exists. No model calls/harness activations; both bundles archived externally. Terminal capture/flush provenance under investigation, no blind terminal success.
- Outcome: t518 remains unmerged/unpublished while bounded evidence/matching gaps are fixed; t516/t517 remain merged locally. No unchanged rerun or paid/provider/full-suite run.

### 2026-10-13 - t518 combined verification passed; fresh controls rejected before replay

- Agent: Codex supervisor; codex-t518 and capture workers; live-debug worker assigned.
- Changed: paired t518 source committed and current dev integrated; rebuilt Core contracts/fluxiq/client gateway. Historical capture provenance, strict control-set matching, explicit empty layer scans and live/historical identity parity are present.
- Validation: supervisor observed 196 Core tests in 23 owning files, 138 domain tests, 14 extension capture tests; Core/domain/extension source and relevant test typechecks exit 0; both structure audits exit 0. The strengthened lasting-failure regression passes against integrated t517. No full suites.
- Browser: headed Chromium provider-free persistent-isolated runs run-mv70bldo-0be720fd (crossborder, slot 3) and run-mv70cdt5-f129f5ab (store first-page-earbuds, slot 1) completed their scripted fixture checkpoints but failed facility.contract before Flow construction/replay. Both report zero model calls, finalized-bundle/scenario.execute/unclassified; no flow-lane snapshot. Worker traced both to HTTP 400 on review-recording-flow-proposal after successful finalization/generation. Bundles are archived outside git in lab-runs/2026-10-13/codex-handoff-validation. No unchanged rerun.
- Diagnosis update: both approval summaries contain the static error SQLITE_CANTOPEN: unable to open database file. This is persistence opening during approval, not a mapper/request-field refusal. The read-only worker is tracing the native database path; no storage workaround or unchanged rerun has been applied.
- Storage correction: supervisor's native probe at an existing 351-character path fails raw and passes namespaced. Added generic SQLite repository write/reopen/read-only regression; observed fail-first SQLITE_CANTOPEN, then 13 owning storage/pool tests pass after namespacing native opens. Ordinary durable paths and pool identity remain unchanged; no migration. Core typecheck/audit and fluxiq build pass. Worker located the approval owner: AutomationStudioFlowMutations.flowSubflowSummaryRepository opens project/runtime/sqlite/global.sqlite with generic SQLiteRepository, extending the existing project database path past the native limit.
- Fresh controls: changed/built source frozen; headed provider-free new isolated workspaces run-mv70yrj2-bc7f032a (crossborder, slot 3) passed goal oracle, zero calls/harness activations; run-mv70yr2e-cebae56b (store, slot 1) approved and reached playback, then four web.dom.wait_for_selector attempts timed out and extraction never ran. Both are archived externally. Durable trace proves crossborder effect_holds routing and store no_match (five candidates, zero matches, no safety refusals).
- Store diagnosis/fix: accepted complete later extraction capture lacked phase provenance; type/scroll captures are genuinely after-action and remain unsigned. The extraction-definition recording captures synchronously before dispatching the read; added explicit before-action only there. Worker observed fail-first emitted metadata, supervisor final 10 tests plus extension type/bundle checker and audit pass (one packed test statement corrected). Reports live-capture-coverage and store-replay-debug record measured coverage/limits.
- Latest validation: a new headed provider-free store control run-mv71ibus-9c9b922e is in progress on frozen changed source; social recorded-Post compatibility control also launched in slot 4. No unchanged failed-run replay or paid call.
- Outcome: Unit/type/audit verification accepted; live replay remains unverified. Source fix and fresh controls required before integration/publishing.

### 2026-10-13 - t516 independently verified; text-only dismissal fixed live

- Agent: Codex supervisor and codex-t516 worker.
- Changed: guarded model-free handler learning and judged-only promotion reviewed; fixed identity collisions and real-domain no-exploration handle resolution. Supervisor's headed wheel assertion exposed missing text-only controlName; source now falls back to the existing sensitivity-filtered visible-text reader. Updated named-clearance browser assertions and architecture documentation.
- Validation: after dev integration, Core `pnpm.cmd exec vitest run` on the seven t516 owning files plus t517 re-press file gave 108 passed; Core tsc exit 0 and contracts/fluxiq public builds passed. Domain selected cleared-layer/dispatcher/handle tests gave 16 passed, source/test tsc exit 0. Extension selected dismissal/challenge tests gave 32 passed; new text-only row failed first, then final dismissal file gave 11 passed; extension checker exit 0. Core audit passed; downstream finish audit next.
- Browser: headed Chromium `dialog-dismissal --grep spin-to-win` failed missing controlName, then passed after fix (19.5 s); `social-feed-safe-clearing --grep rate-limit notice` passed (22.6 s). Real content/page-world bundles, realistic store/social fixtures, stubbed background. These prove named close receipts, not full learned-handler execution/persistence.
- Outcome: Verified, ready for serial integration. No paid runs/full suites.

### 2026-10-13 - t517 independently verified after current dev integration

- Agent: Codex supervisor; codex-t517 worker.
- Changed: certain-no-effect failure and one re-press retained; dead lasting actions now fail default continuation while explicit failed/optional routes remain. Fixed unseen open-shadow-root answers and stopped-watch certainty; added useful model failure feedback and contract documentation. Reports are `reports/codex-t517.md` and the original t517 report.
- Validation: supervisor ran `pnpm.cmd exec vitest run` on Core executor step-loop/defensive/outside-graph dirs (140 passed) and contracts `src/failure` (10 passed); `node scripts/test-domain.mjs` on runtime/failure/action-feedback/retry/press-effect/client dirs (302 passed); `node scripts/test-extension.mjs content/actions/tests content/action-runtime` (501 passed). Core contracts/fluxiq, domain source/test and extension source/test tsc all exit 0. Core contracts and fluxiq public outputs rebuilt.
- Browser: headed Chromium content harness on social-network-feed composer, `wake-press-post`, one pass in 20.5 s. First press reports certainly unacted and sends zero post requests; second sends one and page shows the pending post. Harness uses real content/page-world bundles with stubbed background; no full gateway/Core browser playback or Firefox claim.
- Outcome: Verified; structure gates and serial integration next. No paid run or full suite.

### 2026-10-13 - Codex resumed the handoff

- Agent: Codex senior supervisor; codex-t517, codex-t516 and codex-replay-investigation workers.
- Assigned: t517 false-success/failure-feedback review; t516 handler/promotion and robot-check review; shared recorded-Flow replay investigation. Briefs are above; each worker writes its own report.
- Decision: keep model-free handler learning enabled when adaptations are kept; use owning tests, package typechecks and audits, with no full-suite runs. Alerted the user to Core runtime recovery changes and synchronized failure contracts.
- Validation: intake only; no worker claims accepted yet. Main downstream dev is aed9fcfc, Core dev is 234851b3; t516/t517 code is still uncommitted.
- Outcome: In progress.

### 2026-10-13 - Recorded recovery lifecycle and clock mismatch identified

- Agent: Codex supervisor and codex-replay-investigation worker.
- Findings: crossborder's first runtime claim retries successfully, making its recorded manual retry obsolete. Store's search waits through the real self-clearing check, making both its inferred wait and manual continue obsolete. Reset-before-replay is present. Social's recorded double-Post has the same risk after t517.
- Evidence: read-only report `adaptation-and-breadth-plan/reports/codex-replay-investigation.md`; crossborder has 16 durable state snapshots but its earlier actions link to a future snapshot because the state linker mixes producer and ingestion times. Store's isolated raw snapshots no longer exist.
- Decision: t518 connects safe historical state evidence to existing state routing and fixes clock selection. Preserve challenge behavior, oracles, and default failure when evidence is insufficient. No arbitrary failed-action skip.
- Validation: supervisor reviewed source seams and sanitized worker findings; projected terminal-effect coverage/live replay remain to be checked. Paired t518 provisioned with the worktree helper plus narrow package builds, avoiding the task-start wrapper's full-workspace build under the user's daily full-suite restriction.
- Outcome: In progress.

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
