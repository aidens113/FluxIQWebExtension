# Report: c-remaining

Worker: `c-remaining`. Read-only inventory. No source file was changed; nothing
heavier than `git` and search was run. This repository was read at
`HEAD 99eca80`, Core at `HEAD 5d495eb` with a clean tree.

## Outcome

**Done.** The table has 77 rows. Several items appear under more than one
source (Band A items A1 and A2, `L-review` 1, Band C item C6, `w2-flow-lane`
row 3), and those duplicates point at the row that holds the evidence. Here is
how the rows break down:
- **In flight: 11.** They cover the six parallel fixes and were not
  investigated.
- **Settled at HEAD: 35.** Most were settled by work committed after the report
  that raised them.
- **Pointer rows: 2.** The two doc-truth items (CS7a, CS7b) only point at the
  L-review and Band rows.
- **Open: 29.** Of these:
  - 2 point at another Open row (C6 at CS2c, PB8a at B6);
  - 2 are Lab-only proofs (CS1a, CS2b);
  - 4 are decisions (CS1b, CS2c, B4, C4);
  - 5 I would rule out of Week 1 with the reason recorded (B7, C5, C7, C8,
    PB10b);
  - 16 are code or doc changes.

The 16 code or doc changes:
- **Plain defects: 5.**
  - LR7: the top frame's evidence is dropped in the fallback merge path.
  - CS1d: an ambiguous page is resolved by position (`L-replay` Defect 1).
  - CS1f: the Lab drops the resolution record (`L-replay` Defect 4).
  - B6: the expired auth-gate cannot report `auth_required`.
  - A3: the domain test runner aborts on the first throw.
- **Product gaps: 3.**
  - B1: the proposal's candidate count is compared to nothing.
  - B3: an unusable parameter has no rejection channel.
  - B5: the recorder captures no checked state and no landmark name.
- **Small items: 6.**
  - LR8 and LR9;
  - A4;
  - C1: `validation-outcome.ts`'s stale comment, its one live sentence;
  - C2: the plan's allowlist sentences;
  - C3: `expected.actions` missing from the docs.
- **One Core defect (CS1b′):** the uncoded "Finalized recordings are immutable"
  error that drops the connection.
- **The three architecture pages (CS7c)** that Phase 1.6b step 4 names.

**Read this first: other workers were editing the tree while I read it.**
`git status` at the start showed only the untracked brief. Near the end it
showed 12 modified files. My evidence from seven of them came from the working
tree, so I re-read each at HEAD with `git show HEAD:<path>`:
- `connection.ts` and `server-command-channel.ts`
- `gateway-mapping.ts`
- `input-model.ts`
- `page-evidence/types.ts`
- `adapter.ts`
- the plan

Every line number below for those files is the HEAD line. The other cited files
were not in the modified list at that check. The in-flight edits collide with
several Open items; the second list flags them.

The Current State anchors are also stale:
- It says Core is at `368b3c9` with uncommitted changes. Core is at `5d495eb`
  and clean.
- Open-work item 2 says D14 "overstates" the veto margin. D14 no longer does
  (row CS2a).
- Item 5 says recording-latch work "waits on" the `connection.ts` split. I found
  no remaining latch code (row CS5b).

## The inventory

States:
- **Settled:** true at HEAD by file:line.
- **Open:** needs a change or a proof.
- **In flight:** one of the six parallel fixes.

Row ID prefixes:
- **CS:** Current State "Open work".
- **LR:** `L-review`.
- **A, B, C:** `p-openq-triage` Part 3 bands.
- **PB:** a Partial or Blocked report.

Reports are cited by section.

| Item | Source | State | Evidence | Files | Smallest change |
| --- | --- | --- | --- | --- | --- |
| CS1a — recorded action missing in 12 of 24 Flow-lane runs; 24-run repro not repeated | CS item 1; `L-dropped-action` Outcome; `L-race-fix` Outcome, Not verified | Open (Lab proof only) | Fix is in code: `packages/test-runner/src/flow-lane/run-flow-lane.ts:5,70` awaits `awaitFinalizedRecording` before proposing; `flow-lane/finalized-recording.ts` and its test exist. No report after `L-race-fix` quotes a 24-run count | none | None in code. Live-validation step 4b: 24 `basic-form` Flow-lane runs, 0 proposals short of the recording |
| CS1b — Core logs a late recording event but does not tell the client | CS item 1; `L-core-discard` "The contract change I did not make" | Open (contract decision; see CS6b for scope) | Core `client-gateway/bridge.ts:329-333,437` writes `recording.event_discarded` / `recording.action_discarded` to the audit log only. Extension HEAD `background/connection/server-command-channel.ts:79-85` calls `markFailed()` on any `server.error` except `recording.project_required`; HEAD `background/connection.ts:467-477` spares only classified refusals | Core `client-gateway/bridge.ts` and `tests/bridge.test.ts`; `apps/extension/src/background/connection/server-command-channel.ts`; `apps/extension/src/background/connection.ts` (or its split successor) | As `L-core-discard` proposes: a coded `server.error` `recording.event_discarded` from `noteDiscardedClientMessage`, shipped in the same work unit as a recording-scoped classification in both extension handlers. Never one without the other |
| CS1b′ — an event between finalize and `activeRecordings.delete` throws uncoded and kills the connection | `L-core-discard` "The contract change I did not make", consequence 2 | Open (Core) | Core `runtime/service.ts:1017` still `throw new Error("Finalized recordings are immutable.")`; `bridge.ts:597-605` `flushRecordingEntries` awaits `appendRecordingEvents` inside `try {…} finally {…}` with no `catch`. Propagation to the WebSocket host not re-traced | Core `client-gateway/bridge.ts`, `client-gateway/tests/bridge.test.ts` | In `flushRecordingEntries`, catch the immutability error and route the batch through `noteDiscardedClientMessage` instead of propagating. Core edit: user alert first |
| CS1c — a failing Flow-lane run became an unexplained runner error | CS item 1; `L-replay` Defect 2; `x-evidence-crash` Outcome | Settled | `packages/test-evidence/src/redaction.ts:58-74`: the guard tracks the current path and unwinds, so a repeated reference no longer throws; a true cycle becomes `CIRCULAR_REFERENCE_MARKER` (`:53`) | — | — |
| CS1d — an ambiguous page resolves by position and reports success | CS item 1; `L-replay` Defect 1; corroborated by `r-fixture-audit` §2 (coordinates + overlay) | Open | `apps/extension/src/content/action-runtime/resolve-target.ts:197-215`: a strategy whose gated pool has one element is only vetoed (`vetoExactMatch`). A byte-identical twin carries the recorded text, so it corroborates and is accepted. Ambiguity is counted only when `pool.length > 1` (`:218-221`). No test under `apps/extension` names `no-context`; the only coverage is the page spec `apps/scenario-lab/e2e/negative-variants.spec.ts:166-231` | `apps/extension/src/content/action-runtime/resolve-target.ts`, `…/action-runtime/tests/resolve-target.test.ts`, `apps/extension/e2e/content/tests/identity-resolution.spec.ts` | For positional strategies (`coordinates`, `visual-target`), enumerate `collectTargetCandidates(candidateFamily(target))` before accepting `only`, and throw `scoredAmbiguous` when `scoreTargetCandidates` returns `ambiguous`. Add a `no-context` row. Measure the cost first |
| CS1e — workspace did not compile for most of `L-replay`'s session | `L-replay` Defect 3 | Settled | Coordination defect, not product. Root `pnpm check` exit 0 at `498b6f0` (plan HEAD `:37-40`) | — | — |
| CS1f — the Lab throws away the resolution it receives | `L-replay` Defect 4 | Open | `packages/test-runner/src/flow-lane/persisted-flow-run.ts:16-23`: `PersistedFlowAction` has no `resolution`; `run-scenario.ts:317` writes `snapshots/flow-lane.json` from it | `packages/test-runner/src/flow-lane/persisted-flow-run.ts`, `…/flow-lane/tests/persisted-flow-run.test.ts`, `packages/test-runner/src/run-scenario.ts` | Read `resolution` off Core's persisted action record into `PersistedFlowAction` so `flow-lane.json` carries it. `run.json` is optional and would also need the run-manifest contract |
| CS2a — the veto margin belongs to the fixture's recording, and D14 overstates it | CS item 2; `L-review` 1; `p-openq-triage` B2, Part 4 Group 1; `L-veto-recordings` Outcome | Settled (Current State's wording is stale) | `apps/extension/src/content/identity/tests/veto.test.ts:205-248` scores the nameless impostor against recordings without id and test id and asserts `refusedBecause === "uncorroborated"`; `:252-259` drift still resolves; `:264` names the one unprotectable class. Plan HEAD `:236-261` D14 describes both rules and the 16-class re-run; "barely protected" and "0.641" are absent at HEAD | — | Delete "and D14 overstates it" from Current State item 2 (supervisor) |
| CS2b — calibration does not transfer live (`reworded-aria` at 0.173) | CS item 2; `L-replay` Claim 3; `v-matcher-calibration`, `v-core-scoring` Outcome | Open (Lab re-measure) | Core `fingerprinting/element-fingerprint.ts:282,287` has `MISSING_STABLE_IDENTIFIER_SIMILARITY = -0.1` (`v-core-scoring`). `L-replay` and `x-identity-wire` were both committed in `ab736a1`, after `v-core-scoring` in `1b6f5df`. `x-identity-wire` changed which signals reach the page, so 0.173 predates the current wire either way. Whether `L-replay` ran against the scoring change is not recorded | none until measured; a scoring change would be Core (D13) | Re-run the `identity-drift --variant reworded-aria` Flow-lane replay and quote `confidence` and `bestScore` |
| CS2c — the element-target floor receives no candidates | CS item 2; `L-replay` Claim 4; `p-openq-triage` C6; `v-matcher-calibration` "The two floors" | Open (decision) | Core `runtime/io-policy.ts:234-235` returns `unresolved_no_candidates`, `candidateCount: 0`; HEAD `domain/src/client/gateway-mapping.ts:181` "nothing populates `candidates` yet". The floor that acts is `TARGET_SCORE_FLOOR` in `apps/extension/src/content/identity/score.ts` | decision; docs `docs/architecture/web-capabilities.md` or `extension-client.md`; if wired, `domain/src/client/gateway-mapping.ts` and Core `io-policy.ts` | Record that the browser-side floor is Week 1's floor and Core's stays inert for web; rule wiring candidates into Week 2 |
| CS3 — W18 auth-gate secret binding, last leg | CS item 3; `p-secret-binding`, `p-declared-secrets` | In flight (`f-w18-secret-leg`) | — | — | — |
| CS3′ — Core's trace withholding | CS item 3 and "Uncommitted in Core" | In flight | — | — | — |
| CS4a — runtime adapter's failure-record guard disarmed | CS item 4; `v-redaction-producer` item 5 | In flight (`f-adapter-guard`) | — | — | — |
| CS4b — second evidence producer keeps the conditional-spread hole | CS item 4; `v-producer-safety` | In flight (`f-evidence-producers`) | — | — | — |
| CS4c — merge-safety gate: an import outside its owner's files | CS item 4; `v-merge-safety` "The one line I do not own" | Settled | `apps/extension/src/background/connection/dom-snapshot.ts:33` imports `../../shared/present` (remedy B); `apps/extension/src/shared/present.ts` exists; structure audit passing inside root `pnpm check` exit 0 at handoff | — | — |
| CS5a — `connection.ts` split (Band A item A1) | CS item 5; `p-connection-split` | In flight (`f-connection-split`) | HEAD `connection.ts` is 764 lines | — | — |
| CS5b — recording latch (Band A item A2) | CS item 5; `p-openq-triage` A2; `p-recording-latch` Outcome, Not verified | Settled in code; Open live | HEAD `connection.ts:472` classifies via `classifyRecordingStartRefusal` (`background/connection/recording-start/refusal.ts:68`); `:183` re-resolves the project on each retry (`recording_start_retry`); `clearPendingRecordingStart` is absent from `apps/extension/src/background/`. `p-connection-split` never mentions the latch | none | No code. Lab/browser: force the 10 s freshness race (`w1-recording-start-flake`) and observe a classified retry, not an idle latch. Drop "recording-latch work waits on it" from Current State |
| CS5c — `packages/test-runner/src/tests/` ratchet | CS item 5; `p-test-split` | In flight (`f-test-runner-ratchet`) | — | — | — |
| CS6a — does Week 1 require Firefox? | CS item 6; `p-firefox`; `p-openq-triage` C8 | Settled: no | 30-day plan Week 1 is `:19-361`: objective `:21-25` and exit criteria `:350-359` name no browser. The only Firefox line is `:1312`, "Firefox build where practical", under Phase 4.9 in Week 4 (`:1007`, `:1306`) | plan (supervisor) | Record "Firefox ruled out of Week 1 (30-day plan `:1312`, Phase 4.9)"; `p-firefox`'s gateway and side-panel gaps move to Week 4 |
| CS6b — must a late recording event reach the client as an error frame in Week 1? | CS item 6; `L-core-discard` | Settled: not required by the text | Week 1 exit criteria `:350-359` require failures to be "meaningfully classified" and say nothing about recorder notification; "silently", "lost", "dropped" and "discard" do not occur in `:19-361` (only `:580`, Week 2). Caveat: CS1b′ is a real misclassification (a race presented as a connection failure) and arguably falls under "Failures are meaningfully classified" | plan (supervisor) | Record CS1b as Week 2 and decide CS1b′ separately |
| CS7a — doc truth: `L-review` 2-9 | CS item 7 | see LR2-LR9 | — | — | — |
| CS7b — doc truth: `p-openq-triage` Parts 3-4 | CS item 7 | see A, B, C rows | Part 4 groups map onto Part 3 items: Group 1 is B2, Group 2 is B5, Group 3 is A4, Group 5 is C1 and C2 | — | — |
| CS7c — the three architecture pages Phase 1.6b step 4 names match the finished state | CS item 7; plan HEAD `:664-666` | Open (after the live campaign) | `docs/architecture/testing-facility.md`: no mention of `admin-console`, `storefront-checkout` or `member-directory` against 25 entries in `apps/scenario-lab/src/scenarios/`; only 3 lines mention "bench". `docs/architecture/extension-client.md` headings (`:20,59,108,198,217,334`) have no failure section. `docs/architecture/web-capabilities.md` has `:111` Capability Matrix and `:288` Results And Failures, but "final" cannot be judged before the bench runs | `docs/architecture/testing-facility.md`, `web-capabilities.md`, `extension-client.md` | After the campaign: the bench verb, Flow lane and full fixture table in `testing-facility.md`; the failure and evidence sections in `extension-client.md`; a matrix refresh |
| LR1 — the Level 1 veto's margin belongs to the fixture's recording | `L-review` §1 | Settled | see CS2a | — | — |
| LR2 — `secretSafeDispatchPayload` claims a threat model it does not meet | `L-review` §2 | Settled | HEAD `domain/src/runtime/adapter.ts:262-275`: "A *false* declaration is another matter, and this guard does not survive one" … "not a boundary against a client that lies"; "not this extension at all" is absent at HEAD. `adapter.ts` has an in-flight edit; re-check after it lands | — | — |
| LR3 — `resolution` dropped, and the header says otherwise | `L-review` §3; `p-openq-triage` Part 1 §3 | Settled | HEAD `domain/src/client/gateway-mapping.ts:246` `resolution: result.resolution`; the "result the Flow receives" sentence and "resolution is still dropped" are gone from `resolve-target.ts` and `gateway-mapping.test.ts` | — | — |
| LR4 — the carrier's compiler guard exists only in its own test | `L-review` §4 | Settled | `apps/extension/src/content/action-runtime/resolve-target.ts:162-163` `TargetResolutionError … implements WebAutomationFailureCarrier`, `readonly failure: WebAutomationFailureRecord`; `apps/extension/src/content/actions/execute.ts:91-92` the same | — | — |
| LR5 — two stale sentences whose replacements were already written | `L-review` §5; `p-openq-triage` C1 bullets 2-3 | Settled | `WebAutomationRuntimeError` survives only in history comments (`domain/src/runtime/failure/carrier.ts:5`, `failure/tests/carrier.test.ts:5`); no hit in `results.ts` or `domain/src/runtime/tests/adapter.test.ts` for the stale phrasing | — | — |
| LR6 — `RunLaneObservation.automationFailureExpected` is filled and read by nobody | `L-review` §6 | Settled (the premise changed) | The copy now has a reader: `packages/test-runner/src/run-evaluation/single-run-evaluation.ts:53` uses it as `identity.expectedFailure`. The bench scores the plan's value (`bench/evaluate-run.ts:92,118,172`), and `run-evaluation/observed-run-evaluation.ts:25-28` documents the split | — | — |
| LR7 — one merge path drops the top frame's additive evidence | `L-review` §7 | Open | `apps/extension/src/background/connection/dom-snapshot.ts:156` falls back to `topFallback`; then no entry is top (`:173`), `topEvidence` stays undefined, and `:187-189` passes the fallback's evidence only as `base`. `mergePageEvidence` (`:334-361`) sums collections from `contributions` only | `apps/extension/src/background/connection/dom-snapshot.ts`, `…/connection/tests/dom-snapshot.test.ts` | `const topContribution = topEvidence ?? pageEvidenceOf(topSnapshot);` then pass `topContribution ? [topContribution, ...frameEvidence] : frameEvidence`, plus a test where the frame list omits frame 0 |
| LR8 — the page-evidence contract is not joined at its own top-level key | `L-review` §8 | Open | HEAD `domain/src/recording/web-state/types.ts:59-70` `WebAutomationDomSnapshotInput` has no `evidence`; restatements remain at `domain/src/recording/web-state/evidence/input.ts:55` (`SnapshotCarryingEvidence`) and `apps/extension/src/background/connection/dom-snapshot.ts:63` (`DomSnapshotPayloadWithEvidence`), beside `apps/extension/src/shared/protocol.ts:328` | `domain/src/recording/web-state/types.ts`, `…/web-state/evidence/input.ts`, `apps/extension/src/background/connection/dom-snapshot.ts`, the joinery and ratchet test fixtures that cast | Add `evidence?: WebAutomationPageEvidence \| undefined` to `WebAutomationDomSnapshotInput`, then delete the two local types and the casts |
| LR9 — two unit tests assert an inheritance no lane reads | `L-review` §9 | Open | `packages/test-contracts/src/scenario-workflow.ts:8-18` still documents the dead merge and names the tests; `apps/scenario-lab/src/scenarios/intermediate-state/tests/scenario.test.ts:32` and `…/multi-tab/tests/scenario.test.ts:78` still assert that the variant inherits `pageFacts` | those two tests; `packages/test-contracts/src/scenario-workflow.ts` (comment) | Re-point both assertions at `scenarioPageFactSchedule(...)` and trim the doc's parenthetical |
| A1 — `connection.ts` at the hard limit | `p-openq-triage` A1 | In flight | see CS5a | — | — |
| A2 — latches idle when Core refuses a recording start | `p-openq-triage` A2 | Settled in code | see CS5b | — | — |
| A3 — domain test runner aborts on the first throw | `p-openq-triage` A3 | Open | `domain/scripts/test-domain.mjs:54-57`: bare `for … await import(…)` with no `try`/`catch` | `domain/scripts/test-domain.mjs` | Wrap each `import` in `try`/`catch`, print the entry and the error, set `process.exitCode = 1`, and continue |
| A4 — the content harness cannot be invoked correctly by default | `p-openq-triage` A4, Part 4 Group 3 | Open | `apps/extension/e2e/playwright.content.config.ts:12` `fullyParallel: true`, no `workers`; `apps/extension/package.json:10` `test:content` still leaves the `--` forwarding trap (this dispatch's own rules work around it) | `apps/extension/e2e/playwright.content.config.ts` | Pin `workers` in the config (4, or 2 under load) so the bare command is correct |
| A5 — `domain/.test-build/` tracked and stale | `p-openq-triage` A5 | Settled at HEAD | 263 tracked files, last regenerated in `ab736a1`. The only later `domain/src` change, `498b6f0`, has 0 non-comment changed lines (11 comment lines in `domain/src/output-nodes/targets.ts`). The hazard recurs: in-flight domain edits will stale it again | none now | Supervisor runs one unlabelled domain test on a still tree at integration |
| B1 — a recorded action can be silently dropped from the proposed Flow | `p-openq-triage` B1 | Open (product half; the lane half landed) | `packages/test-runner/src/flow-lane/recording-flow-proposal.ts:40-43` throws only when there are zero candidates; `candidateCount` (`:49`) is compared to nothing. The lane asserts actions (`run-flow-lane.ts:4`) and waits for finalization (`:70`) | `packages/test-runner/src/flow-lane/run-flow-lane.ts`, `…/flow-lane/tests/run-flow-lane.test.ts` | Fail `recording.contract` when `proposal.candidateCount` is below the manifest's declared executable actions. The product-side signal is Core's, so rule that into Week 2 once step 4b shows 0 of 24 |
| B2 — veto limits misdescribed; `L-veto-recordings` missing | `p-openq-triage` B2 | Settled | see CS2a; `reports/L-veto-recordings.md` now exists | — | — |
| B3 — an unusable parameter has no rejection channel | `p-openq-triage` B3 | Open | HEAD `domain/src/client/gateway-action-parameters.ts:12-17` "Nothing here coerces …" unchanged; the only rejection is `WebAutomationActionRejection` (HEAD `gateway-mapping.ts:40,123`) | `domain/src/client/gateway-action-parameters.ts`, `domain/src/client/gateway-mapping.ts`, `domain/src/runtime/failure/codes.ts`, `domain/src/client/tests/gateway-command-parameters.test.ts`, `…/tests/gateway-mapping.test.ts` | Have the parameter reader report refused fields, and `webAutomationActionFromGatewayCommand` return a rejection with a new closed-set code (for example `web.action.invalid_parameter`) when a required command field was refused |
| B4 — `capture_snapshot` cannot match the state pipeline's frame coverage | `p-openq-triage` B4 | Open (deliberate contract; decide) | `apps/extension/src/runtime/action-runner.ts:218` `topFrameOnly: frameId === undefined`, documented at `:171-195`; `apps/extension/src/content/message-handler.ts:43` | `apps/extension/src/runtime/action-runner.ts` | Re-scope the entry to `web.dom.capture_snapshot`. If fixed, send that verb's frameless dispatch through the background's tab-merged capture; otherwise record it as Week 2 |
| B5 — recorder captures neither checkbox `checked` nor a landmark's name | `p-openq-triage` B5, Part 4 Group 2 | Open | No `checked` in `apps/extension/src/content/describe-element.ts` or `shared/protocol.ts`; `protocol.ts:232-233` `landmark` is a role, filled by `content/identity/context.ts:58,83-96` `nearestLandmark`; no `landmarkName` anywhere in `apps/extension/src` or `domain/src`. The `498b6f0` comment in `domain/src/output-nodes/targets.ts` notes Core scores no landmark signal | `apps/extension/src/shared/protocol.ts`, `…/content/describe-element.ts`, `…/content/identity/context.ts`, `…/background/connection/gateway-payloads.ts`, `domain/src/output-nodes/targets.ts`, their `tests/` | Add `checked?: boolean` for checkbox and radio controls, and a landmark `name` from `aria-label`/`aria-labelledby` in the context. W26 still needs Core to score it |
| B6 — expired auth-gate cannot report `auth_required` | `p-openq-triage` B6; `w2-flow-lane` Outcome row 3 | Open | HEAD `domain/src/io/input-model.ts:111` maps `navigationRequested` only for `transition === "typed"`, so `location.assign` yields no Flow step; `apps/scenario-lab/src/scenarios/auth-gate/manifest.ts:79` expects `failure: { category: "auth_required" }` | `domain/src/io/input-model.ts`, `domain/src/io/tests/input-model.test.ts` | Map the recorder's client-side navigation transition (check its vocabulary first) outside `RECORDING_START_REASON`. Brief it against `v-flow-reload`'s new sequencing |
| B7 — client type and capabilities are self-asserted | `p-openq-triage` B7 | Open (Week 2 Core decision) | Core `client-gateway/service/lifecycle.ts:85,88` assigns both from `hello` | Core `lifecycle.ts` | Rule out of Week 1: the downstream docs are already honest (HEAD `adapter.ts:262-275`) |
| B8 — declared-secret mechanism adopted by no scenario | `p-openq-triage` B8 | Settled | `apps/scenario-lab/src/scenarios/auth-gate/manifest.ts:101`, `…/storefront-checkout/manifest.ts:157` declare `secrets` (W18 end to end: CS3) | — | — |
| C1 — three false sentences on load-bearing code | `p-openq-triage` C1, Part 4 Group 5 | Open (bullet 1); bullets 2-3 Settled (LR5) | `apps/extension/src/content/action-runtime/validation-outcome.ts:23-30` still says the failure record is Core's `AutomationStudioFailureRecord` with a bare-string `code`; `apps/extension/src/shared/protocol.ts:402` makes `BrowserActionResult` the domain's `WebAutomationActionResult` | `apps/extension/src/content/action-runtime/validation-outcome.ts`; check the comment at `…/tests/validation-outcome.test.ts:48` | Rewrite the paragraph: the record's `code` is the domain's closed set, so deleting the builders is defence in depth, not the only guard |
| C2 — the plan conflates two failure vocabularies | `p-openq-triage` C2 | Open (doc; supervisor-owned file) | Plan HEAD `:626-627` "the test-runner's allowlist derives from it" and `:635-636` "allowlist generated from domain codes"; code derives from `WEB_LLM_EVIDENCE_RESULT_CODES` (`packages/test-runner/src/demo-llm-create-ui/generation-failure.ts:13,118-119`) | `docs/working/mvp-week1-web-automation-reliability-plan.md` | Two sentences naming `WEB_LLM_EVIDENCE_RESULT_CODES` |
| C3 — `expected.actions` undocumented | `p-openq-triage` C3 | Open | No `expected.actions` in `docs/architecture/testing-facility.md`; the reasoning lives only at `packages/test-contracts/src/scenario.ts:72-82` | `docs/architecture/testing-facility.md` ("Scenario lab and contract", `:641`) | One paragraph: outcomes `succeeded` and `failed`; a refusal is `failed` with `expected.failure` |
| C4 — `actions.spec.ts` shared and owned by nobody | `p-openq-triage` C4 | Open (decision only) | `apps/extension/e2e/content/tests/actions.spec.ts`, 211 lines, one of 22 specs | plan (supervisor) | Declare it supervisor-only in the dispatch rules |
| C5 — the shared action-type reader's cost is unmeasured | `p-openq-triage` C5 | Open (needs a real Core; rule to Week 2) | `packages/test-runner/src/flow-lane/flow-action-types.ts:30` throws `recording.contract`; reached by `existing-flow-run.ts` | none | Measure on an existing target, or record it as Week 2 |
| C6 — nothing populates `candidates` on the wire | `p-openq-triage` C6 | Open (decision) | see CS2c | — | — |
| C7 — selector-keyed patch lane vs fingerprint-first | `p-openq-triage` C7 | Open (Week 2 contract) | `domain/src/runtime/llm-evidence/tools.ts:91,161` still take `{ selector }` | `domain/src/runtime/llm-evidence/tools.ts` | Rule out of Week 1 |
| C8 — the Firefox floor | `p-openq-triage` C8 | Open (the user's call; not Week 1 per CS6a) | `apps/extension/manifest.firefox.json:43` `"strict_min_version": "109.0"` | `apps/extension/manifest.firefox.json` | Rule out of Week 1 |
| C9 — three standing environmental entries | `p-openq-triage` C9 | Settled (no code state) | Operational guidance only; carried in Current State's operating rules | — | — |
| C10 — briefs partitioned by file rather than by change | `p-openq-triage` C10 | Settled | Promoted to dispatch rules: `briefs/wave-3.md:57-64`; Current State `:25,129` | — | — |
| PB1 — `w1-core-failure-adoption`: seven type errors in `bench/` | report Outcome | Settled | test-runner `check` inside root `pnpm check` exit 0, and test-runner 439/439 at `498b6f0` (plan HEAD `:37-40`) | — | — |
| PB2 — `w1-decompose-content`: blocked on a `gateway-mapping.ts` compile error | report Outcome | Settled | root `pnpm check` exit 0 at handoff | — | — |
| PB3 — `w1-eval-contracts`: `RunEvaluation` fixture missing fields | report Outcome | Settled | `packages/test-contracts/tests/runtime-contracts.test.mjs:130` builds a `RunEvaluation` with `lane`, `harnessActivations`, `evidence`, `llm` and the adaptation nulls. The handoff counts do not list test-contracts, though root `test` is `pnpm -r test` (`package.json:56`) | — | — |
| PB4 — `w1-fixture-infinite-feed`: data-table `\25B2` escapes, missing `dist` | report Outcome | Settled | `apps/scenario-lab/src/scenarios/data-table/table-page.ts:15-16` now `\\25B2` / `\\25BC`; scenario-lab 197/197 at handoff | — | — |
| PB5 — `w1-fixture-intermediate-state`: same data-table error | report Outcome | Settled | as PB4 | — | — |
| PB6 — `w1-lab-consolidation`: `registry.test.ts:5` reaches past a barrel | report Outcome | Settled | `apps/scenario-lab/src/tests/registry.test.ts:5` imports `../scenarios/basic-form/index.js` | — | — |
| PB7 — `w1-runner-asserts`: `--workflow` not passed; evidence policy; 19 failing tests | report Outcome, Open questions 1-4 | Settled | `packages/test-runner/src/cli.ts:57` passes `workflowId`; `packages/test-runner/src/commands.ts:177` `optionalEvidence` returns `{}` when `--evidence` is absent; `FLUXIQ_TEST_ENV_FILES=none` recorded (plan HEAD `:152`); test-runner 439/439 | — | — |
| PB8a — `w2-flow-lane`: `auth-gate --variant expired` reports no structured failure | report Outcome table row 3 | Open | see B6 | — | — |
| PB8b — `w2-flow-lane`: paginated extraction has no fixture | report Outcome | Settled | `apps/scenario-lab/src/scenarios/product-catalog/manifest.ts:16,55` `followNext` and the `paginated-extraction` workflow | — | — |
| PB8c — `w2-flow-lane`: declared secret has no Core seam | report Outcome | In flight (`f-w18-secret-leg`) | — | — | — |
| PB9 — `w2i-run-manifest-join`: two unwired call sites | report "What the supervisor must still wire" | Settled | `packages/test-runner/src/run-scenario.ts:210,236` pass `existingExecution.actionTypes` and `cloneState.execution.actionTypes` | — | — |
| PB10a — `w3-domain-contracts`: `metadata.elementTarget` declared on the wrong registry | report "The declaration the brief aimed at the wrong file" | Settled | `domain/src/io/manifest-definitions.ts:30` `requiresElementTarget(...) ? { metadata: { elementTarget: true } }` | — | — |
| PB10b — `w3-domain-contracts`: a recorded action cannot carry `expectedState` | report "The other gap" | Open (Core; scope decision) | Core `runtime/service.ts` mentions `expectedState` only at `:5666` (adaptation evidence); nothing lifts it from a recording-mapper candidate | Core recording-mapper candidate contract and `runtime/service.ts` `appendRecordingProposalToFlow`; domain `mapWebRecordingObservation` | Additive `expectedState` on the candidate plus one lift line in Core. Rule to Week 2 unless the bench shows post-condition-less recorded steps passing wrongly |
| PB11 — `w3-evidence-consumption`: Task 2 stopped | report Outcome | Settled | Done by `w3-evidence-finish` Task 2; `apps/extension/src/background/connection/dom-snapshot.ts:164-167` documents the recording event's merged-snapshot order, pinned by `…/connection/tests/recording-evidence.test.ts` | — | — |
| PB12 — `w3-evidence-finish`: Task 1, `autocomplete` on form-control evidence | report Outcome | Settled | HEAD `domain/src/page-evidence/types.ts:205-214` `autocomplete?: string \| undefined`; `w3-autocomplete-signal` Outcome | — | — |
| PB13 — `w3-protocol-narrowing`: Task 1, failure `code` not narrowed | report Outcome | Settled | `apps/extension/src/shared/protocol.ts:402` `BrowserActionResult = WebAutomationActionResult<…>`, whose record's `code` is the domain's closed set (`w3-failure-code-invariant` Outcome). One stale comment remains: C1 | — | — |
| PB14 — `w3-resolver`: Level 2 scoring blocked | report Outcome, "The Level 2 blocker" | Settled | `apps/extension/src/content/identity/score.ts` exists; `resolve-target.ts:256,267-268` report `bestScore`, `confidence`, `runnerUpScore` | — | — |
| PB15 — `w3-runner-alignment`: allowlist not derivable from the domain | report Outcome | Settled | `packages/test-runner/src/demo-llm-create-ui/generation-failure.ts:13,119` import `WEB_LLM_EVIDENCE_RESULT_CODES` from `@fluxiq-web-extension/domain/node` | — | — |
| PB16 — `w3-target-signal-order`: one domain assertion red | report "The one line I do not own" | Settled | domain 343/343 at handoff | — | — |
| PB17 — `p-connection-split` (Blocked) | report Outcome | In flight | — | — | — |
| PB18 — `p-secret-binding` (Partial), with `p-declared-secrets` ("Done, for the half") | report Outcome | In flight (`f-w18-secret-leg`) | — | — | — |
| PB19 — `p-test-split` (Partial) | report Outcome | In flight (`f-test-runner-ratchet`) | — | — | — |

## Open items grouped by file

**Collision** marks a file two Open items would both touch. **In-flight edit**
marks a file that showed uncommitted changes in `git status` near the end of
this inventory; I did not attribute those edits to a specific brief.

Extension:
- `apps/extension/src/background/connection/dom-snapshot.ts`: LR7, LR8.
  **Collision.** It sits beside the in-flight `connection/` split files but was
  not itself modified.
- `apps/extension/src/background/connection/tests/dom-snapshot.test.ts`: LR7.
- `apps/extension/src/background/connection/server-command-channel.ts`: CS1b.
  **In-flight edit** (9 lines).
- `apps/extension/src/background/connection.ts`: CS1b. **In-flight edit** (the
  split, 722 lines changed). Brief CS1b after the split lands.
- `apps/extension/src/background/connection/gateway-payloads.ts`: B5.
- `apps/extension/src/content/action-runtime/resolve-target.ts` and
  `tests/resolve-target.test.ts`: CS1d.
- `apps/extension/e2e/content/tests/identity-resolution.spec.ts`: CS1d.
- `apps/extension/src/content/action-runtime/validation-outcome.ts`: C1.
- `apps/extension/src/shared/protocol.ts`: B5. LR8 may also touch it if
  `DomSnapshotPayload` must derive from the domain type, which would make it a
  collision.
- `apps/extension/src/content/describe-element.ts`,
  `apps/extension/src/content/identity/context.ts`: B5.
- `apps/extension/src/runtime/action-runner.ts`: B4.
- `apps/extension/e2e/playwright.content.config.ts`: A4.
- `apps/extension/manifest.firefox.json`: C8 (rule out).

Domain:
- `domain/src/client/gateway-mapping.ts`: B3, and CS2c if candidates are ever
  wired. **Collision** (conditional). **In-flight edit** (2 lines).
- `domain/src/client/gateway-action-parameters.ts`,
  `domain/src/runtime/failure/codes.ts`, and
  `domain/src/client/tests/gateway-command-parameters.test.ts` and
  `gateway-mapping.test.ts`: B3.
- `domain/src/io/input-model.ts` and `tests/input-model.test.ts`: B6.
  **In-flight edit** (2 lines). Brief B6 after it lands.
- `domain/src/recording/web-state/types.ts` and `evidence/input.ts`: LR8.
- `domain/src/output-nodes/targets.ts`: B5.
- `domain/src/runtime/llm-evidence/tools.ts`: C7 (rule out).
- `domain/scripts/test-domain.mjs`: A3.

Test runner, test contracts, Scenario Lab:
- `packages/test-runner/src/flow-lane/persisted-flow-run.ts`,
  `flow-lane/tests/persisted-flow-run.test.ts`, and
  `packages/test-runner/src/run-scenario.ts`: CS1f.
- `packages/test-runner/src/flow-lane/run-flow-lane.ts` and
  `tests/run-flow-lane.test.ts`: B1. It is a different file from CS1f, but both
  live in `flow-lane/`; that is not a collision.
- `packages/test-contracts/src/scenario-workflow.ts`,
  `apps/scenario-lab/src/scenarios/intermediate-state/tests/scenario.test.ts`,
  `apps/scenario-lab/src/scenarios/multi-tab/tests/scenario.test.ts`: LR9.

Architecture docs:
- `docs/architecture/testing-facility.md`: CS7c, C3. **Collision.**
- `docs/architecture/extension-client.md`: CS7c, and CS2c if the decision is
  documented. **Collision** (conditional).
- `docs/architecture/web-capabilities.md`: CS7c, and CS2c if the decision is
  documented. **Collision** (conditional).

Plan document, supervisor-owned:
- `docs/working/mvp-week1-web-automation-reliability-plan.md`: C2, C4, CS2a
  wording, CS5b wording, CS6a and CS6b records, the rule-outs (B7, C5, C7, C8,
  PB10b, CS1b), and the Core anchor (`368b3c9` → `5d495eb`). **Collision**, and
  it is a shared document; no worker may edit it. **In-flight edit** (176 lines).

Core (`F:\!FluxIQ`):
- `packages/fluxiq/src/programs/automation-studio/client-gateway/bridge.ts` and
  `tests/bridge.test.ts`: CS1b, CS1b′. **Collision.**
- `packages/fluxiq/src/programs/automation-studio/runtime/service.ts`: PB10b.
- `packages/fluxiq/src/client-gateway/service/lifecycle.ts`: B7 (rule out).
- `packages/fluxiq/src/programs/automation-studio/runtime/io-policy.ts`: CS2c,
  only if wired.

Lab-only, no file: CS1a (step 4b), CS2b (re-measure `reworded-aria`), CS5b
(forced freshness race), C5.

Other in-flight edits seen that touch no Open item:
- `apps/extension/src/background/connection/active-recording.ts` and
  `connection/index.ts`
- `domain/src/page-evidence/types.ts`
- `domain/src/runtime/adapter.ts` and `runtime/tests/adapter-redaction.test.ts`
- `packages/test-runner/src/flow-lane/declared-secrets.ts`
- `docs/working/README.md`

These edits may re-open rows I marked Settled from those files: LR2 and PB12.
Re-check those two rows after integration.

## What changed and why

One file was written: this report. No source, test, configuration or shared
document was touched, as the brief required.

## Commands run and observed results

- `git log --oneline -3`, run in this repository at the start:
  - Result: `99eca80`, `498b6f0`, `ab736a1`.
  - `git status --short` showed only `?? …/briefs/finish-week1.md`.
- `git status --short`, run near the end:
  - HEAD was still `99eca80`, but 12 files were modified (listed above).
  - Three new untracked files: two archive files and
    `reports/f-test-runner-ratchet.md`.
  - `git diff --stat`: 12 files, +507 −794.
- `git show HEAD:<path>` for `domain/src/runtime/adapter.ts`,
  `domain/src/client/gateway-mapping.ts`, `domain/src/io/input-model.ts`,
  `domain/src/page-evidence/types.ts`,
  `apps/extension/src/background/connection/server-command-channel.ts`,
  `apps/extension/src/background/connection.ts` and the plan:
  - Every HEAD line quoted above was confirmed.
  - HEAD `connection.ts` is 764 lines.
  - The plan's HEAD anchors: `## Current State` `:14`, "Open work" `:88`, D14
    `:236`, allowlist `:627` and `:636`, Phase 1.6b `:651`.
  - "barely protected" and "0.641" returned no output.
- `git ls-files domain/.test-build | wc -l`: 263.
- `git log -1 -- domain/.test-build`: `ab736a1 2026-09-12 19:07:56`.
- `git log -1 -- domain/src`: `498b6f0 2026-09-12 19:15:19`.
- `git show 498b6f0 -- domain/src`, non-comment changed lines counted: 0.
- `git log --diff-filter=A` for the report files:
  - `v-core-scoring` and `v-matcher-calibration` were added in `1b6f5df`
    (16:51).
  - `L-replay`, `x-identity-wire` and `L-veto-recordings` were added in
    `ab736a1` (19:07).
- `git rev-parse --short HEAD` and `git status --short` in `F:\!FluxIQ`:
  `5d495eb`, no changes.
- A per-report loop printed the first Outcome line of all 152 reports. Partial
  or Blocked:
  - `p-connection-split`, `p-secret-binding`, `p-test-split`
  - `w1-core-failure-adoption`, `w1-decompose-content`, `w1-eval-contracts`,
    `w1-fixture-infinite-feed`, `w1-fixture-intermediate-state`,
    `w1-lab-consolidation`, `w1-runner-asserts`
  - `w2-flow-lane`, `w2i-run-manifest-join`
  - `w3-domain-contracts`, `w3-evidence-consumption`, `w3-evidence-finish`,
    `w3-protocol-narrowing`, `w3-resolver`, `w3-runner-alignment`,
    `w3-target-signal-order`
- Search: every file:line in the table came from a Grep, `grep` or `sed` read.
  - Two batched Grep calls came back empty on the first try: the `candidateCount`
    search in the test runner and the cycle-guard search in `test-evidence`.
    Both were rerun alone and returned the hits cited above.
  - Other empty results were checked by a second, differently scoped search
    before being used as evidence of absence. These are `no-context` under
    `apps/extension`, `landmarkName`, `checked`, and `expected.actions` in
    `testing-facility.md`.

## Not verified

**No build, type check, unit test, content harness or Lab command was run.** The
brief allows only git and search.
- **Test evidence for Settled rows.** Every row resting on "exit 0" or a test
  count relies on Current State's handoff observation at `498b6f0`. That is a
  single observation on a machine with faulty RAM, and it was not re-run.
- **Other rows** were settled by reading source at HEAD, not by watching a test
  fail and pass.

What a Lab run must show to close the Lab-only rows:
- **CS1a:** 24 `basic-form` Flow-lane runs with no proposal short of its
  finalized recording, and no `recording.contract` "No mapper-visible entries"
  failure.
- **CS2b:** `identity-drift --variant reworded-aria --flow` resolving with its
  quoted `confidence`, plus the near-miss variant still refusing.
- **CS5b:** a forced 10-second freshness race producing a classified retry, not
  an idle latch.
- **CS1d, once fixed:** `ambiguous-targets` `no-context` reporting
  `web.target.ambiguous` and `form-context` resolving.
- **B6, once fixed:** `auth-gate --variant expired --flow` reporting category
  `auth_required`.

Also not verified:
- **CS1b′ propagation.** I did not trace the path from `flushRecordingEntries`
  to the WebSocket host (`apps/web/src/server/client-gateway-websocket.ts`).
- **CS2b timing.** I did not establish whether `L-replay` ran against the Core
  scoring change.
- **B6 recorder vocabulary.** I did not read which `transition` values the
  recorder writes for a `location.assign`.
- **Smallest-change sizes and costs.** The smallest changes are proposals, not
  measured patches. CS1d's extra enumeration cost and B3's new code in particular
  need measuring by whoever implements them.
- **Report scope.** I did not open `r-fixture-audit`, `v-facility` or
  `x-scan-cap` for status: they have no Done, Partial or Blocked outcome word,
  so the brief's item 4 did not select them. `x-scan-cap` Defect 2 is "Answered,
  not wired" and may deserve a row.
- **In-flight briefs.** I did not read their Owns lists, so collisions with
  them are inferred from `git status`, not from the briefs.

## Open questions or contradictions found

1. **Current State is stale in three places.** Core is `5d495eb` and clean, not
   `368b3c9` with uncommitted files; D14 no longer overstates the veto (CS2a);
   no latch code waits on the split (CS5b).
2. **The tree moved under this inventory.** Twelve files changed during the
   read. LR2 and PB12 rest on files now being edited, so re-check them after
   integration.
3. **Reading outside the brief's named files.** Open-work item 6 says to settle
   from the 30-day plan's text, and item 7 names Phase 1.6b step 4. I therefore
   read the 30-day plan's Week 1 objective and exit criteria (`:19-48`,
   `:340-362`), grepped it for Firefox, read the plan's Phase 1.6b (`:651-672`),
   D14 (`:236-261`) and `:620-637`. The brief did not name these files; the
   items themselves did.
4. **The handoff counts omit `test-contracts`.** They list extension, domain,
   test-runner and scenario-lab, so PB3's pass at HEAD is unquoted.
5. **Five Open rows are really scope decisions for the supervisor, not work:**
   - B7 and C7, both Week 2 contracts;
   - C8, Week 4 per CS6a;
   - C5, which needs an existing target;
   - PB10b, a Core expectation field.

   CS1b is a sixth, unless the supervisor judges CS1b′'s connection kill a
   Week 1 classification defect.
