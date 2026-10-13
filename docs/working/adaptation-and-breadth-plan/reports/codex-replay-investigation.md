# Codex replay investigation

Status: Done (read-only investigation; fixes and live verification not performed)
Date: 2026-10-13
Owner: codex-replay-investigation worker

## Finding

The two runs share a recording/playback lifecycle mismatch: the recording demonstrates manual recovery as unconditional actions, while playback now performs that recovery inside the preceding action. The next recorded recovery control has already disappeared or changed state. They do not establish a target-identity regression or a missing fixture reset.

The recording lane uses raw Playwright clicks (`packages/test-runner/src/scenario-steps/step-runner.ts:111`), not the extension's retry/check-aware runtime click. Core approval emits one `builtin.policy.action` per candidate connected by success edges (`packages/fluxiq/src/programs/automation-studio/runtime/service/recordings/proposal-candidates.ts:103`). State links are metadata; this function does not compile the manual recovery into conditional branches.

## Evidence inspected

Read the two runs' sanitized `snapshots/flow-lane.json` and closed metadata from `run.json`, plus runner, domain mapper, fixture and extension recovery sources. No tests, browser sessions, provider calls, source edits, commits or pushes were made. This report intentionally carries no recorded page content, URLs, target selectors, browser state or secrets.

### Crossborder unchanged control

Run: `run-mv6xaosc-1c145c22`, t262 slot 3. Flow has 20 candidates, starts at candidate index 0 and ends failed.

- First coupon action: `recorded.candidate.entry.52.9884cc02-06ec-46cb-83c6-6b21485f6091`.
- Attempt 14: `web.action.rate_limited`, effect `unacted`, duration 1046 ms.
- Attempt 15 of that same node: succeeds, duration 1525 ms.
- A recorded scroll then succeeds.
- Second recorded coupon action: `recorded.candidate.entry.57.03ff7663-ca0c-4885-a283-dba0fa5ac13c`.
- Attempts 17-20 fail `web.target.not_found`, lasting approximately 4.2 seconds each.

The action order matches the fixture's `claim-coupon` then `claim-again`, defined in `apps/scenario-lab/src/scenarios/crossborder-marketplace/manifest/steps.ts:56`. Its first claim is intentionally refused, and its second claim collects the coupon. `client/item-script.ts:160` changes the claim control's state after collection and refuses additional claims. The extension's `content/action-runtime/rate-limit-notice.ts` explicitly recognizes this busy refusal; Core's `executor/defensive/assess.ts` retries an unacted retryable refusal. Playback therefore completes the collection inside the first node before reaching the recorded second click.

This is not evidence that the shadow-root selector stopped matching an unchanged eligible control: the control's eligible state changed because playback had already completed the requested claim.

### Everything-store control

Run: `run-mv6y2t42-222ea4f9`, t516; workflow `first-page-earbuds`, variant `deal-wheel`.

- Search action: `recorded.candidate.entry.12.58a3291e-c28e-4a8e-8ac3-5fdd2b0cb8ab`, attempt 5, succeeded after 9241 ms; its snapshot also retains an `output_confirmation.not_received` record.
- Following inferred wait: `recorded.candidate.entry.28.bc2a38d0-7a94-473c-8af6-f9459eb71f57`.
- Attempts 6-9 fail `web.action.timeout` (6936, 5883, 5845, 6081 ms).
- Playback stops before reaching the deal wheel or the later extraction.

The fixture's `SHARED_STEPS.search` explicitly records a browser-check wait and a continue click (`apps/scenario-lab/src/scenarios/everything-store/workflows/shared-steps.ts:33`). Recording completes the search click in 246 ms, then performs the continue click in 1849 ms. Playback's search action instead waits out the self-clearing check. The site clears itself at 8000 ms (`client/timings.ts`; `client/soft-check-script.ts:18`), and `apps/extension/src/runtime/landed-check-wait.ts:104` waits for that clearance before returning success.

The failed Flow wait is an inferred action, not a literal fixture `waitForState` recording. `domain/src/recording/proposals/late-target-wait.ts:59` converts a DOM-addition observation into a required wait for the next click's selector. After the preceding runtime action has waited out the check, both this inferred wait and the recorded optional continue click are stale. Removing only the inferred wait would leave the stale click.

## Reset/order assessment

`packages/test-runner/src/flow-lane/run-flow-lane.ts:134` awaits finalized recording, generates and approves its proposal, resets the producer, prepares the page, and then executes the Flow. `run-scenario.ts:298` prepares every run by arming any variant, opening the scenario entry point and presenting the Flow tab. The reset is before arm/load, and no unarmed path intentionally starts at the recording's ending page. Both controls start at candidate index 0 and successfully reach their respective recovery segments.

Consequently, a reset omission is not supported by these failures. This is a source/evidence conclusion, not a fresh observation of browser reset state.

## Smallest responsible fixes and regressions

1. **Store fixture control:** demonstrate waiting through the self-clearing check, then waiting for durable results, instead of explicitly clicking its optional continue control. Own `everything-store/workflows/shared-steps.ts`, affected fixture expected recording-event counts, and adjacent fixture tests. Keep the site's check, timers, oracles and deal-wheel behavior unchanged. This is a valid patient-user demonstration and removes both the stale click and its inferred prerequisite. Verify the unarmed control reaches results before using the armed replay to prove interruption handling.
2. **Coupon recording:** do not delete the second press alone; the recording would fail to collect. Do not preclaim or suppress the initial failed action merely to pass the benchmark. The representative recording needs an explicit guarded recovery segment: initial claim, evaluate the claim's verified terminal state, perform the recorded retry only when still required. Existing unconditional approval cannot express that from these candidates. The narrow product seam is domain recording proposal interpretation plus Core `runtime/service/recordings/proposal-candidates.ts` and its adjacent tests; a contract addition needs synchronized mapper/candidate types. An alternative is an explicit retry-aware recording-driver operation that records the logical action rather than raw recovery presses, but no such mode exists in `ScenarioStepRunner` today.
3. **Generic mapper regression:** in `domain/src/recording/proposals/tests/late-target-wait.test.ts`, use generic fixtures to expose that a transient recovery control cannot always become a required next-state wait when the preceding action absorbs its interruption. Fixing the store demonstration alone does not prove arbitrary human-recorded recovery sequences are safe.
4. **Guarded recovery safety:** test an unacted busy response followed by a successful retry, then a recorded manual retry. The second node may be bypassed only through positively verified already-complete state. A failed first claim, missing completion evidence, a different control, and uncertain lasting effects must remain failures or guarded recovery, never generic success. A dead lasting control must still fail, preserving t517's required result.

No pause/resume/suppression or runtime-click mode was found in the scenario step contract/runner or recording control searches. `checkpoint` is a runner no-op and cannot encode a conditional recorded branch. Thus the two current recordings are invalid as unconditional controls under the newer defenses; neither site's challenge nor its oracle should be weakened to accommodate them.

## Return contract

Changed only this owned report. Findings are evidence-backed; proposed fixes are not implemented. No commands that validate code or launch a browser/provider were run. Supervisor should review the identified source seams and choose a bounded recording-guard design before delegating the coupon implementation.

## Follow-up: existing state-routing bridge (preferred product fix)

The existing executor already has the positive-evidence recovery required here. `domain/src/runtime/tests/state-routing-run.test.ts` runs the real Core executor with the real web signer, comparator and effect checker. Its cases prove `effect_holds` takes the failing step's own success edge, and matching a later node's recorded pre-state routes forward. No new generic missing-control skip is needed.

Public host callbacks are `observeRouteState`, `signRouteState`, `compareRouteSignatures`, `signRouteEffect`, `routeEffectHolds`, and `routeEffectSeen` (`Core runtime/host-runtime.ts:95`; domain `runtime/host-runtime.ts:185`). The web domain owns their meaning. `webAutomationRouteEffectHolds` requires positively observed added control hashes and matching changed path, and never accepts an effect with no additions (`domain/runtime/route-state/effect/holds.ts`). Existing executor routing also checks skipped values, repeated lasting acts, checkpoints and progress.

### Snapshot availability and limitations

- The recording index includes all persisted `client.state_snapshot` entries with `stateRef`, timestamp and timeline sequence (`Core runtime/service/recording-state-index/build.ts`; `state-entry-readings.ts`). Core's `getRecordingEntryState({includeState:true})` / `getStateSnapshot` reads the durable `StateSnapshot` through `objectDocuments.readIndexedStateSnapshot` (`runtime/service.ts:617`). Use this existing storage seam, not browser observation during proposal compilation.
- The current candidate has one `stateLink`. It is NOT a verified before/after pair: `runtime/state-linker.ts` selects the closest snapshot by time, which may follow the action. Do not label it a before-state by assumption or use the next action's resulting snapshot as this action's effect.
- Recording snapshots are in `namespaces.web.values`: page URL/title, `elements.*` JSON blobs, page-evidence fields and truncation flags (`domain/recording/web-state/snapshot.ts`). They are not already `{page: ...}` route states. Live route projection uses sanitized `WebLlmPageEvidence` (`runtime/route-state/project.ts`), so the domain must own a historical projection that applies the same readable-name/actionability/secret rules.
- These isolated run bundles do not carry the full recording state-index and snapshot objects. Actual completeness of usable before/after snapshots for the failed nodes is not established by this read-only inspection. A regression fixture must establish the bridge, then the representative control proves real capture sufficiency.

### Executable bounded brief

1. Add a focused optional historical-state projection callback to Core's host runtime boundary, taking a persisted `StateSnapshot` and returning a route state or no usable state. Bind it in domain `runtime/host-runtime.ts`; implement it in a focused `runtime/route-state/recorded-state.ts` with adjacent tests and barrel export. Validate namespace, timestamps, completeness and element truncation; use the existing sanitizer/readable-control semantics. Return unavailable for malformed, ambiguous or incomplete captures, and persist only the resulting hashes.
2. Add Core `runtime/service/recordings/recorded-routing.ts` (and barrel/tests). Load indexed snapshots through an injected existing object-document reader. Select chronological states strictly before the candidate and after it but before the next executable action; select settled evidence nearest the next action boundary rather than a transient spinner immediately after the click. Treat first/last boundaries, different document/source, equal timestamps and missing evidence conservatively. An inferred wait may receive a before signature when its mutation observation has a proved state, but must not fabricate an act effect from that evidence.
3. Wire that helper at `runtime/service.ts:2087` into `recordings/proposal-generation.ts`. Use the bound host projection and existing `signRouteState` / `signRouteEffect`; do not put web vocabulary in Core. Preserve route signatures on the proposal candidate type (`runtime/recording-flow-proposal.ts`) and copy them into approved node `metadata.routeSignatures` in `recordings/proposal-candidates.ts`. Existing stateLink/provenance remains intact.
4. **Store-specific routing gate caveat:** `executor/state-routing/could-not-run.ts:16` routes only `target_not_found`, while the current inferred wait fails `timeout`. Route signatures alone therefore do not fix store. Extend domain's inferred wait candidate with a real target-presence `readyState`, carry it through the candidate contract/approval, and use the existing before-dispatch readiness gate. If absence is established, Core synthesizes `executor.ready_state.not_shown` and asks existing state routing; if routing finds no positively proved later state, the ordinary wait still runs. Do not classify arbitrary action timeouts as absent targets. The owning downstream file is `recording/proposals/late-target-wait.ts` and its tests; Core owns candidate retention and approval.
5. Extend `domain/runtime/tests/state-routing-run.test.ts` with generic busy-claim and self-clearing-interruption sequences using signatures produced by the new historical projection. Prove automatic recovery followed by the recorded retry routes through positive completed-state evidence; prove transient wait/continue segment routes to durable results; prove missing completion, unrelated page, truncated snapshots, dead lasting action, and uncertain lasting effects do not become success. Core tests should also prove proposal approval retains signatures/readiness and restart does not require the original recording objects to execute.
6. Run only these adjacent tests, touched package typechecks and audits. Then perform the two representative model-free controls on unchanged sites. This preserves site behavior, oracles and original recordings; fixture edits become unnecessary if real recording captures support the bridge.

Core owned files: host boundary; a new focused recorded-routing helper + barrel/tests; proposal generation; candidate type/retention/approval + tests; narrow service wiring; architecture contract documentation. Downstream owned files: historical route projection + barrel/tests; host binding; inferred wait candidate + tests; state-routing integration tests; recording/runtime architecture documentation. No executor skip-rule change is required by the design.

The earlier fixture recommendation is an optional way to represent a patient user for the store; it is not the preferred fix after identifying this existing routing seam. Coupon preclaim/suppression remains rejected. The existing state-routing design supplies the guard, provided capture selection and historical projection actually produce trustworthy signatures.

### Actual recording availability check (metadata/counts only)

The crossborder run is **persistent-isolated**, workspace `xb-preflight`; the store run is **isolated**. The crossborder recording index and durable objects remain, whereas the store's isolated work directory is empty and no recording index remains in its test-runs tree. Store's actual temporal snapshot sufficiency is therefore unverified and cannot be asserted from the saved lane snapshot.

Crossborder index: **16 states, 14 actions, 64 entries**. Its two coupon clicks are entry 52 and entry 57; the following durable cart action is entry 61. Snapshot objects exist for entry 54, entry 58 and entry 62; each has one namespace and `elements.truncated: false`. Captured/producer element counts are respectively **111/202, 112/202, 116/208**; the difference is the domain's selection, not reported truncation. No page values were emitted during this check.

An additional concrete defect affects state selection: entry 52 and entry 57 both currently link to the later entry-62 snapshot. Index `timestamp` on an action is ingestion time, about six seconds later than its producer `startedAt`/`completedAt`. Snapshot timestamps retain producer capture time. The source action times instead exactly pair entry 52 with snapshot entry 54, entry 57 with snapshot entry 58, and entry 61 with snapshot entry 62. `state-linker.ts` currently prioritizes `timestamp` over `startedAt`, so nearest-state selection mixes these clocks and links earlier actions to future states.

The implementation brief must therefore add a narrow state-linker clock regression and select action boundaries by producer `startedAt`/`completedAt` before ingestion time. Timeline append sequence alone is also insufficient: action snapshots are appended after their matching action entries. Use the matching producer-time capture as the at-action/pre-state and a later producer-time capture before the next action as potential after-state, retaining explicit captures/provenance and rejecting ambiguous temporal evidence. Do not assume a matching timestamp proves action completion; these snapshots capture the state at a press, and an after-state must be independently bounded by later observed state. Crossborder has the relevant chronological objects, but their projected terminal-effect sufficiency still needs the new domain projection test and representative replay.

The social-network fixture has the same explicit recovery pattern (`apps/scenario-lab/src/scenarios/social-network-feed/manifest.ts:32`): first Post, wait for spinner to stop, second Post. After t517 makes the first runtime node re-press successfully, the second recorded node may be stale as well. This is a source-backed risk, not a run observed in this investigation. Add it to the generic recorded-recovery regression cases; do not remove or weaken the site's first-press behavior.
