# t986 offline proof progress

2026-11-22. Read brief, copied intake and relevant current plan sections. Setup is still preparing Core libraries: no Core edits/builds/tests started. No git mutations, paid calls, raw artifact output or real data.

## Proposed public composition and admission

Sent lead proposal: reuse actual Lab attempt topology and liveAttemptDriver, real extension chat/gateway, with a distinct recorded raw HTTP transport behind existing child fetch isolation. Preserve bytes/status/malformed bodies; do not pass recorded replies through scripted anthropicStreamBody. Public service composition can use FluxIQ.create (`fluxiq`) + registerFluxIQHost (`@fluxiq-web-extension/domain/node`) and public automation service, but existing candidate-only offline host does not prove full-attempt domain replay. Exact exported recorded-domain binding is still under investigation; no private Core imports or duplicated framework loop.

Admission must require synthetic provenance, exact fixed task/oracle identity, paired source fingerprints, copied starting store, complete ordered stream identity and request/raw-response/status chain. Missing responses/status/domain evidence remain gaps. Match substantive full request digest; normalize only explicit transient identifier pointers. No lookahead, no paid/network fallback; first divergence latches. Metadata only leaves ignored artifacts. Bounded admission/cursor, strict scoreboard and stage-evidence preflight modules are authorized while full runtime seam approval is pending.

CLI scope requested: packages/test-runner/src/cli.ts, actual command parser and attempt orchestration once exact insertion traced. No edits there before approval. No additional task fixtures yet.

Setup completed per lead. Added bounded downstream-only modules for admission, exact canonical request hashing, per-stream first-divergence cursor, raw loopback response transport, artifact/log readers, fixed ten-task scoreboard and protocol receipt classifier, plus adjacent tests. Current source is frozen for the initial gated test-runner package check (t986-intake-types); no test/build result claimed yet.

Actual Core log format verified: request.json is sent body, response.json is reply(raw,status), meta.json carries httpStatus/costUsd. Content type is not recorded. Log reader records inferred media only for recognizable SSE framing or parseable JSON; arbitrary malformed media remains a gap. Some early malformed envelopes/non-2xx paths never invoke reply, so a missing response is real evidence loss, not repaired. Raw server never calls the scripted stream codec.

Lead approved exact command parser/dispatcher and attempt orchestration edits, plus downstream product-runtime.ts composition of existing public primitives. Core remains read-only. Source tracing found public ClientGatewayTraceMatcher + scoped environment/virtual clock + gateway trace store; attach replay client under scope and invoke actual public entry within environment.within(), with replay trace provenance. Existing offline-trial wrapper deliberately refuses exploration; it will not be private-imported or mislabeled as full attempt replay. Starting store, actor/caller request and source trace admission remain required before execution. No browser launch yet.

Initial package check failed only in existing browser-host consumers because that downstream package's dist/exports were not prepared (TS2307 for browser-host and /reaper, cascading unknown/implicit-any errors). No new-module diagnostic was emitted. Domain dist prepared successfully. Plan: build missing browser-host narrowly before the next test-runner gate.

Lead approved Core scope after the exact public-export audit corrected my early assumption: scoped environment/virtual clock were internal, though matcher/provenance are public. Added public strict recorded-trace-session wrapper/contracts and private shared lifecycle; offline-trial/matcher-session retains exploration rejection and privately retains its reevaluator. Existing reader-contracts now aliases one shared default map. Lifecycle marks derived sources, enters isolated scope automatically, settles even on callback throw, and always detaches. Core public-surface and independent wrapper/refusal/isolation/divergence/throw tests added. Core source frozen for gated focused wrapper+existing trial provenance+public export tests. Additional approved Core paths: recorded-trace-session/lifecycle.ts and offline-trial/reader-contracts.ts.

Downstream CLI now parses distinct --recorded-model FILE and scrubs provider environment before configuration loading. Model transport uses recorded raw bytes and preserves current runtime entry/chat; its artifact explicitly says recorded_model_fixture_runtime/domainEvidenceReplayed=false/fullAttemptAccepted=false until recorded-domain composition is supplied. Concurrent CLI streams without explicit mapping are refused, never guessed. Core recorded-domain composition and actual preflight callback remain in progress; classifiers alone are not S6 completion.

Core focused gate: `pnpm --filter fluxiq exec vitest run --maxWorkers=1 --minWorkers=1 --fileParallelism=false src/framework/automation-service/service/recorded-trace-session/tests/session.test.ts src/framework/automation-service/service/offline-trial/tests/provenance.test.ts src/framework/automation-service/public/tests/provider-binding-export.test.ts` -> 3 files/10 tests passed. `pnpm --filter fluxiq check` -> exit 0, 86,089 ms. Both ran through separate heavy-slot stages. Library build remains in flight; Core source frozen until it ends, then approved assertSupported/signal enhancement needs its own tests/check.

Lead clarified S6: a confirm is not permission. Read-only task declarations may prove permission not-applicable; consequential task permission must use the actual start gate/person protocol without carrying out an act in preflight. Added declaration/digest-bound applicability and generic actual saved Flow containing only Start/Confirm/snapshot-read/End. Optional read-only proof hook reuses run-chat-check's actual paired context. Preflight sends original task instruction through existing buildCreatedFlowFromChat and records whether Core actually starts it. Required permission is currently explicit not-exercised gap, never a passed stage. Site challenge modules are detected from actual compiled declarations and remain not_run/not_declared, separate from generic confirmation.

Distinct runnable command plumbing is now present (not yet executed/validated): `lab recorded-replay --input FILE --out FILE` (copied-store real public build prefix, optional admitted conversation interpretation); `lab attempt SITE --task ID --authoring-mode answer-first --recorded-model FILE` (actual chat with raw model recording against a fixture; explicitly recorded_model_fixture_runtime, no recorded-domain/full-attempt claim); `lab offline-preflight SITE --task ID --evidence DIRECTORY`; `node scripts/lab/offline-scoreboard.mjs --evidence test-runs/LABEL`. Scoreboard consumes actual emitted series plus per-attempt counts/digests, source.json, oracle.json and stage artifact existence; missing/old accounting is unknown, never zero. New attempt runs fingerprint current authored source including uncommitted/untracked source and unchanged task+expected oracle. No criteria changed.

Before any browser run, provider egress proof is required. Added focused test that a missing/broken local recorded server cannot fall back to the provider URL, rejects nonloopback transport origins and unknown remote shapes, and forces redirect:error for model routing. Raw transport preserves Request bodies and latches closed on identity/server errors. This gate has not run yet. External billed spend is zero by construction; logical replay/script calls and historical/modelled usage remain separate.

Lead supplied F23 evidence refinement: all three successors loaded predecessor digest, saved digest changed after attempts two/four, so blanket 'repairs never persisted' is unsupported. Exact main.s5 semantic repair is unproven, modelCalls null means unknown. Canonical 0248 has only metadata; rich summary is sibling attempts bundle, not minimal run folder. No diversion or raw payload output was made.

Storage-root correction and F25 admission inventory: read-only original t959 allocation/environment/session source pins isolated stores at runsDirectory/.attempt-work/<run>/fluxiq-root/.fluxiq, profiles beside them, with explicit FLUXIQ_ROOT/DATA_DIR/DATABASES_DIR. Thus missing entry.bundlePath alone was insufficient. Named F25 root exists; lens-hood/F23 allocated roots do not. Session cleanup ordinarily removes these disposable allocations, with no implicit AppData/temp fallback in this path.

Created one ignored F25 closed-store copy under test-runs/t986-source-f25/fluxiq-root/.fluxiq after metadata showed no active node/browser process naming that run. Before/after-original and copy hashes matched (security excluded as existing freshStoreCopy policy does): 71 files, SHA256 6222a6e78abc7785fe84ead72867fad7f86944f050f4dadfa5c6e8770ab23886. Original was not opened for migration or modified. Only copied project schema/count/episode metadata was read, no secret values or capture contents.

Copied F25 store has one live exploration trace, started 2026-11-20T13:05:42.633Z, closed_at null, claimed completeness open;57 trace artifacts,373 events (55 execute_action,110 action_result taps,142 state updates),0 recording/state_snapshot rows,1 Flow and0 subflows/publications. This is an interrupted retained state, not a proven original-start snapshot or complete replay source. Strict matcher must keep its incomplete_capture refusal. Exact source capture/binding availability may still be established from retained trace artifacts through the public store; P1 is coordinated on that separate proof. Their narrowed replies cannot supply missing upstream row values or exact broadened oracle acceptance.

Raw log admission now inventories every request.json, including requests without completed provider metadata. F25's30th request is preserved as unmatched/missing metadata evidence; completed provider counts cannot silently truncate it away. No synthetic response or closure is generated.

Core assert/signal snapshot rerun -> 3 files/10 tests passed (96.20 s). Added required post-settle support check and a real queued-command regression after that snapshot ended; its focused owner gate is queued/running. Callback signal closes on session exit and existing build cancellation is wired before model-cursor consumption. No browser/provider run yet.

Final post-settle behavior gate ->3 files/11 tests passed (74.64 s), including queued-domain-command divergence after callback return, no recorded model suffix consumption after domain gap, cancellation/isolation, derived provenance, throw cleanup, old trial phase guard and public export. Structure audit then finished with2 statement-packing violations only (three session callback lines and one test afterEach). Expanded those statements; no behavior change or baseline relaxation. No final audit/typecheck/build is yet claimed for the assert/signal snapshot.

SAFE SOURCE PAUSE for lead sync: no active or queued t986 heavy jobs. Both source trees frozen while lead syncs accepted t976 permission and P4 fixed-model integration. No further type/build/test queued. Lead approved exact preflight-only social task script/index/test after sync: unchanged task, actual start-gate declared consequence, deny through panel then existing Stop/cancel, prove no lasting act, label permission protocol only. It must not become full social task/oracle proof.

Core paths added/approved beyond initial downstream brief: framework/automation-service/service/recorded-trace-session/{index,session,contracts,lifecycle}.ts and tests/session.test.ts; service/offline-trial/{matcher-session,reader-contracts}.ts; public/index.ts and public/tests/provider-binding-export.test.ts. Docs: Core docs/architecture/automation-studio/recorded-trace-session.md, downstream docs/architecture/recorded-offline-proof.md. Lead owns versioning/integration/git.

After accepted t976/P4 sync, combined Core typecheck found one test-only union narrowing error in the happy-path failure message (the new diverged outcome has no reasonCode). Changed that unexpected-path message to status. Current combined Core package typecheck -> exit0 (18,257 ms); structure audit -> exit0 after prior formatting fixes; focused wrapper/trial/public export gate ->3 files/11 tests passed (91.78 s). Current Core library build is in flight; Core source frozen.

Implemented approved preflight-only social script/index/test. It echoes the unchanged task instruction, declares actual delete consequence and has no decision replies. Actual probe uses existing paired session/model-key setup, verifies pendingPersonAsks reports taskStart plus the declared missing class, presses Don't allow, requests cancel-flow-bootstrap, and compares actual site lasting-state baseline with zero task-decision calls. It is permission_protocol_only, never full social task proof. Generic read probe still contains no lasting action. Source awaits downstream types/build/test/egress gates before browser use.

Found/corrected structural starting-state ownership issue: recorded archive and target pre-entry state must be separate isolated roots. SourceRootDir is now a model-disabled archive host; rootDir is the separately fingerprinted target snapshot host. Public matcher reads archive store but attaches to target gateway. A true pre-entry snapshot is no longer expected to contain its own future completed trace.

Existing receipt survey found row-input immutable snapshots are not whole runtime snapshots; existing freshStoreCopy is reused for the latter. New capture-start.ts owns closing only an isolated provider-free fixture host, copies it via that helper, verifies original-before/original-after/copy digests (security excluded by owner policy), and prepares request/task/oracle/snapshot receipt bytes before entry. Its one-shot hook attaches them through the existing public current trace artifact sink at the first actual transport call, refusing absent/wrong trace/project/Flow, another trace or changed entry. Position verifier requires the actual artifact bytes/hash/source manifest membership and matching task/oracle/request/snapshot; trace live/completeness admission still belongs to the strict public wrapper. A caller-authored flag alone cannot bypass those checks. Historical F25 lacks a proven pre-entry snapshot/receipt and complete trace, so retains those explicit build gaps. Capture/position tests added; not run yet. No new private Core seam or copied framework loop.

- Runner typecheck passed after the catalog guard fix (39,009 ms; domain build reused). Approved launcher integration now scrubs recorded/preflight credentials before runner setup, refuses unsupported preflight sites and live flags before build, and includes managed-host preparation on cold checkouts. Source frozen for focused validation.

Launcher guard stage: named provider-free environment and scenario-refusal Node tests ->14/14 passed (1.31 s), including spawned actual launcher refusal before setup. Runner build is in progress. Core recorded-deliveries review confirms the sessionless capture receipt is not replayed as an inbound client artifact.

Runner build ->pass (51,602 ms, 2,958 emitted files). Named 11-file Node owner stage remains queued through the shared gate; no source edits while queued. Lead approved minimal fresh-capture caller integration after it finishes: coordinator owned restart boundary callback, capture-command/host-module, paired preparation callback/host module option and CLI/tests. Fresh capture is known-Flow bootstrap via the actual public endpoint; stopped complete prefix proves capture plumbing only, not campaign reproduction or task completion. Browser launch remains held until code/tests pass and lead announces exact command.

Fresh-capture caller implementation now uses the approved owned topology stop/restart callback and actual control.generateFlowBootstrapAdaptation entry. Capture preparation runs before browser pairing, so the subsequent browser session is real/reconnected to the reopened captured workspace. Native capture host transport owns no network function, records literal malformed bytes in ignored evidence, attaches receipt inside actual exploration and requests cancellation. Public completeness evaluation verifies all artifact bytes before declaring a stopped trace complete; position verifier binds the actual entry/snapshot. A missing source root after owned cleanup is allowed only as the original comparison path; replay target/archive still require separate real paths inside owned test-runs. No browser yet. Dependency builds remain queued; runner source will freeze for its next checks after edits complete.

Coordinator restart now delegates to an owner helper with explicit teardown/cancellation checks; failed stop never runs capture or restart, preparation failure restores the child, and combined preparation/restart failures retain both causes. Added owner tests for these paths and capture command/root/scenario guards. Source is frozen for pending dependency preparation followed by runner types/build/focused tests/audit; no browser launch.

Dependency closure inventory found only two missing runtime exports; both test-contracts (86 files) and test-evidence (22 files) restored through their existing build-cache steps in dependency order. All other linked runtime exports were already present. First Node stage remains recorded as import/load failure (1 passed,10 load failures), not10 behavioral failures. Fresh capture source organized under recorded-attempt-replay/capture to meet cohesive ownership; public command is still held for code/tests and lead announcement.

Fresh capture type snapshot found one exactOptionalPropertyTypes error in coordinator callback forwarding (24,134 ms); omitted absent optional callback rather than assigning undefined. Added approved rejection-with-undefined restart regression and synchronous native-capture latch before attachment/I/O. First receipt files use exclusive creation; concurrent/later native requests are saved separately as explicit unmatched gaps and cannot overwrite admitted first evidence or fall back to a provider. Missing native wire evidence preserves the retained store and emits a gap instead of fabricating a reply. Current source freeze begins after these hardening edits; screened F25 public inventory stage is independently queued.

Screened public-store F25 inventory ->pass: fresh secondary isolated copy opened with model providers disabled; all57 artifacts readable and SHA256 matches,16 text/html and41 image/svg+xml,0JSON. No raw artifact bytes/values printed or copied into authored material. Metadata inventory is ignored test-runs/t986-tools/f25-public-inventory.json; secondary store test-runs/t986-source-f25-public-inventory/fluxiq-root. HTML artifact suffixes3,18,27,62,75,90,128,134,143,159,172,188,200,216,229,233. Raw HTML source exists for possible narrower extraction-transform proof, but alignment to read0012/original binding and newly retained-field parity remain unverified. P1/lead notified. Source manifest remains live exploration/open; no completion relabel. Hardened runner typecheck now running; source frozen.

Hardened runner package typecheck ->pass (32,331 ms), Core current and domain reused. Affected runner build queued as its own stage. Public literal extraction seam confirmed by P1: webAutomationExtractListDispatch plus its generated recordOutput.schema, validated by webAutomationExtractListRequestValue and mapped by executeActionMessage. Original-binding parity still requires original resolved extractList/extractionBinding/ranWith; aligned HTML re-detection alone is a new read, not original-binding parity. Lead has proposed screened event binding-presence/digest/correlation inventory; no payload output or browser.

Current hardened runner build ->pass (61,251 ms;2,978 files,8,571,028 bytes). Core/domain current/reused. Approved metadata-only binding/correlation investigation is the next separate stage, using only the secondary isolated F25 copy and public trace store. Following it: named Node owner tests with complete runtime closure, guard tests and downstream structure audit; no browser before those complete and lead announcement.

Current named Node owner stage ->73/75 passed (87.77 s). Egress fail-closed, raw HTTP malformed/status, scoreboard/source/continuation refusal, CLI, restart/cancellation/undefined, concurrent/extra native request and first-file preservation all passed. Two failures: Buffer.slice aliased raw bytes (corrected to Uint8Array.from at constructor/return; added source-mutation regression), and capture fixture omitted public workspace setup (added host.fluxiq.setup before closed-copy capture). No browser yet. Direct event/action-result/artifact and detect-proposal correlation runs next as a separate public-host gate; source will freeze after narrow fixes for rerun.

Direct F25 correlation stage ->exit0 (373 events; metadata-only output). Exact original identity is established: outbound event89 includes canonical callId read.results.2, command536a2e58-2af9-4c46-a2f8-dfdb8585565f; inbound action_result96 has that same commandId and references HTML artifact90 digest d8ab29fc26e24489d3cc44a6febbe92e71cf1610a4cc1023a5429ea20855af57. This is direct protocol correlation, not time adjacency. Original extractList is821 bytes, SHA25687eea7f4760167b3cc221e28a2c4c93689287739e4f1d9f5c9636758730b638c. Original canonical read0012 meta says read.results.2 at13:06:13.449�20.751Z. Detection0006 meta says detect.results.1 at13:06:01.570�04.906Z; source detectStructure request77 is command8b3995e0-fdfb-486d-807b-67707313180a. Current proposal.fields[].spec scan found none; legacy response shape vs missing full proposal remains unverified, not declared absent. Ignored metadata: test-runs/t986-tools/f25-direct-correlation.json. No selector/label/cell values printed.

QUIET COMPATIBILITY HOLD: no t986 running or queued heavy jobs; lead requested no new heavy jobs until switch-complete notice. Browser remains held. Current unvalidated changes after73/75 owner run: true cursor Uint8Array copies + input-mutation regression, public setup in capture fixture, ownership-only split of start/stopped-start and supplemental auction constant. Scope/read-parity proposal sent to lead: use existing public operation/delivery/reevaluation request plus domain recorded snapshot reconstruction and existing sandboxed actual content reader; no new Core/private seam. Full trace stays open/inadmissible; any original6-field parity is separate from new28-field detection/read proof and full-task acceptance.

Approved written follow-up briefs/t986-read-parity.md read (main commit06d05d80d). Added bounded read-parity/{index,source,command,compare}.ts plus owner tests and existing CLI/launcher registrations. Source composition uses the original89/96 command/result segment via public Core helpers, original metadata trace references via webOfflineReadRecordedSnapshot, and literal original action mapping. Command uses the existing sandboxed production content reader; requires public native-result parity plus raw ordered canonical rows equality before any current-derived schema validation. Null omission/type coercion cannot make equality pass. Current dispatcher schema is expressly current-derived, not historical metadata recovery. Ignored source-selection input prepared at test-runs/t986-read-parity/input.json; contains hashes/IDs/paths only, no cells/selectors. No browser launched. Root approved Core sync: checkpoint d3954767d then accepted P1/dev merged; old11-test acceptance is pre-sync only. One Core library refresh stage is queued, source Core frozen/read-only. Root owns disjoint attempt-lane/live/cost-progress/**; worker excludes it. Will coordinate a whole-Down source freeze before combined gates.

Worker source ready for shared Down freeze. run-attempt-command.ts explicitly handed to root for S5 forwarding; worker will not edit it further. Root owns attempt-lane/live/cost-progress/** and its integration. No Down validator queued until root declares observer snapshot frozen. Core refresh only stage remains queued. Read-parity standalone command uses original literal action once, public native gateway comparison and strict raw ordered arrays; its shared schema check is explicitly current-dispatch-derived and never replaces compared cells. Whole trace remains open/not admitted and fullAttemptAccepted:false. Planned original-six browser command remains held for successful gates and root announcement.

Shared Down source FROZEN after root S5 implementation: root-owned cost-progress/{reader,format,reporter,index}.ts, tests/progress.test.ts and live-only run-attempt-command.ts forwarding/flush. Worker will include its emitted owning test in named validation and same runner types/audit, without claiming authorship. No additional source edits while these combined validators run. Core wrapper post-sync acceptance remains pending; pre-sync11 tests/types/audit/build are historical snapshot only.

S3 read-only intake complete in reports/s3-recorded-regression-intake.md; no extra heavy job or gate implementation. Existing Core runtime graph omits dynamic imports/assets/foreign repository edges and is not an affected-check API; separate generic Core impact seam proposed with pre/post reach and explicit gaps. Parent approved social process:null adjustment applied with owner expectation updated. Company direct declaration is ready from written task semantics: taskProcessing:{process:{where:[{field:role,contains:apprentice}],columns:[name,role,branch]}}; case-insensitive contains and omitted sort preserve source order. Waiting on public P2 AutomationStudioFlowTaskProcessing seam/type handoff before adding this request field, no casts/private copies. Historical read/recorded replies untouched; all other source remains frozen.

Lead read-parity acceptance review applied in approved subtree: schema validity now gates contractRowsMatch/parityPassed separately from raw rowsMatch; positive coercion/null normalization regression added. Replaced recursive callId search with exact producer metadata.callId/source/domainId/projectId/flowId shape. Original t959 toolMetadata source inspected and confirms same contract. Canonical entry receipt SHA d5f69ffbe88d4f74bc818ccd5841cef148caae2867b193ac05e7ecf941b4f4d6 binds original runId/scenario/task; source validates current fixture task with existing ledgerTask and snapshot loopback scenario startPath. Primary artifact id must be inside the public segment boundary. ProviderCalls/providerUsd zero by construction are distinct from observed browser externalCalls; unobserved/leaked networking leaves externalUsd unknown. Added receipt contradiction/self-declaration/network-unknown regressions. Raw historical bytes unchanged. Only Core library refresh remains queued; no Down validator/browser yet.

Root review findings1-4 and scoped corrections recorded above; owned architecture paragraph now explicitly requires schema validity alongside separate exact raw equality, canonical Lab receipt provenance and observed/unknown network accounting. Worker source REFROZEN after this documentation update. Current read-parity additions, cursor/fixture fixes, social process:null change and root S5 integration have NOT YET run combined types/build/owners/audit. Core refresh remains queued; original pre-sync11-test acceptance is not asserted for synced Core. Company direct taskProcessing waits P2 public runtime handoff. No historical replies changed, browser or paid calls launched.

Core refresh gate failure: t986-synced-core-libraries / exec36240 exited1 before slot acquisition or build launch: EPERM opening shared .heavy-slots/v2/admission.lock. None of contracts/sdk/fluxiq/gateway/ui/cloud build commands ran. This is an admission-lock infrastructure failure, not a library/test verdict. Lead notified with exact failure; no blind requeue/override and no t986 running/queued heavy job. Current0.52 library freshness and all combined downstream validation remain not run. Source/docs remain frozen; browser held.

Gate follow-up: root confirmed no holder and removed failed worker ticket, preserving five other tickets; tracing Windows admission.lock read contention. Worker holds all requeue/new heavy submissions; no lock removal or threshold override. Read-parity now also requires an explicit scenario-matching task id/call id rather than allowing task-loader fallback to a different task. All read-parity fixes remain unvalidated until gate/library refresh succeeds; Core and other sources remain frozen.

## Current frozen source and check contract (hold active, not final acceptance)

Exact downstream unit paths below include the root-handed-off run-attempt-command.ts; root cost-progress files and s5-live-cost report are excluded from worker authorship.
```text
Checkpointed source paths are recorded in lead checkpoints 14a645262 and b649e9536; the exact later delta is listed below.
```

Exact Core wrapper checkpoint paths (d3954767d), unchanged by worker after the pre-sync11-test/types/audit/build snapshot; accepted P1/dev is now merged but not revalidated here:
```text
docs/architecture/automation-studio/recorded-trace-session.md
packages/fluxiq/src/framework/automation-service/public/index.ts
packages/fluxiq/src/framework/automation-service/public/tests/provider-binding-export.test.ts
packages/fluxiq/src/framework/automation-service/service/offline-trial/matcher-session.ts
packages/fluxiq/src/framework/automation-service/service/offline-trial/reader-contracts.ts
packages/fluxiq/src/framework/automation-service/service/recorded-trace-session/contracts.ts
packages/fluxiq/src/framework/automation-service/service/recorded-trace-session/index.ts
packages/fluxiq/src/framework/automation-service/service/recorded-trace-session/lifecycle.ts
packages/fluxiq/src/framework/automation-service/service/recorded-trace-session/session.ts
packages/fluxiq/src/framework/automation-service/service/recorded-trace-session/tests/session.test.ts
```

Required validation after root lifts the hold (each heavy stage releases/requeues; source remains frozen):

- Core library refresh: `node scripts/build-cache/cli.mjs contracts:build sdk:build fluxiq:build client-gateway-websocket:build ui-components:build cloud:build` � last submission failed on gate admission.lock before any build ran.
- Core types: `pnpm --filter fluxiq check` � not run after P1/dev sync.
- Core audit: `node scripts/structure-audit.mjs` � not run after sync.
- Core owners: `pnpm --filter fluxiq exec vitest run --maxWorkers=1 --minWorkers=1 --fileParallelism=false src/framework/automation-service/service/recorded-trace-session/tests/session.test.ts src/framework/automation-service/service/offline-trial/tests/provenance.test.ts src/framework/automation-service/public/tests/provider-binding-export.test.ts` � not run after sync (pre-sync3files/11tests passed).
- Downstream types: `pnpm --filter @fluxiq-web-extension/test-runner check` � not run for current frozen read-parity/S5/P2-fixture snapshot.
- Downstream build: `pnpm --filter @fluxiq-web-extension/test-runner build` � not run for current snapshot.
- Downstream audit: `node scripts/structure-audit.mjs` � current snapshot not run; no baseline increase permitted.
- Named Node owners, including root's observer, exact command below � current snapshot not run. Previous15-file stage73/75 passed; the two failures were byte aliasing and missing fixture setup, both fixed but not rerun.

```powershell
node --test --test-concurrency=1 packages/test-runner/dist/recorded-attempt-replay/tests/cursor.test.js packages/test-runner/dist/recorded-attempt-replay/tests/egress.test.js packages/test-runner/dist/recorded-attempt-replay/tests/read-step-logs.test.js packages/test-runner/dist/recorded-attempt-replay/capture/tests/start.test.js packages/test-runner/dist/recorded-attempt-replay/capture/tests/command.test.js packages/test-runner/dist/recorded-attempt-replay/capture/tests/transport.test.js packages/test-runner/dist/recorded-attempt-replay/read-parity/tests/source.test.js packages/test-runner/dist/recorded-attempt-replay/read-parity/tests/command.test.js packages/test-runner/dist/recorded-attempt-replay/read-parity/tests/compare.test.js packages/test-runner/dist/coordinator/tests/restart-core.test.js packages/test-runner/dist/extension-chat-check/tests/realistic-scenario-guard.test.js packages/test-runner/dist/attempt-lane/scoreboard/tests/evaluate.test.js packages/test-runner/dist/attempt-lane/scoreboard/tests/export.test.js packages/test-runner/dist/attempt-lane/preflight/tests/evidence.test.js packages/test-runner/dist/attempt-lane/preflight/tests/probe-graph.test.js packages/test-runner/dist/attempt-lane/scripted-model/tests/model-server.test.js packages/test-runner/dist/attempt-lane/scripted-model/scripts/tests/social-network-feed-delete-stranger-requests.test.js packages/test-runner/dist/attempt-lane/live/cost-progress/tests/progress.test.js packages/test-runner/dist/tests/commands.test.js scripts/lab/tests/provider-free-run.test.mjs scripts/lab/scenario-guard/tests/lab-scenario-refusal.test.mjs
```

Public P2 dependency: the new public `AutomationStudioFlowTaskProcessing` must reach `AutomationStudioGenerateFlowBootstrapAdaptationInput` / API `GenerateFlowBootstrapAdaptationRequest`. Company fresh capture waits until that property is actually available; no private import, shadow input or cast is permitted. Its declaration, read from unchanged task semantics, is `taskProcessing: {process: {where: [{field: "role", contains: "apprentice"}], columns: ["name", "role", "branch"]}}`; omitted sort preserves page/capture order. Social action-only preflight now replies `process:null`. Historical recorded replies and original read bytes stay unchanged.

Concise review findings: valid current schema is mandatory for contract acceptance; raw ordered equality independently rejects omitted nulls, coercion, added fields/order changes. Exact metadata.callId/source/domain/project replaces recursive coincidence. Original hashed Lab receipt + current fixture task + loopback path replaces flag-only provenance. Provider calls/cost zero by construction is separated from observed browser-network leakage/unknown. Exact89/96/artifact90 identity is proven; whole trace remains open/inadmissible and fullAttemptAccepted:false. Original28-field detector binding is still unverified, so no newly-retained-field or full-task proof is claimed.

Held browser command after successful owners/audit and root announcement only:
`node scripts/lab/run-lab.mjs recorded-read everything-store --input test-runs/t986-read-parity/input.json --out test-runs/t986-read-parity/report-original-six.json`

No current browser, paid call or heavy job is running/queued for this worker. Lead owns checkpointing/integration; worker performed no git mutations.


## Fresh scripted processing compatibility; downstream refrozen

The gate hold was lifted after the shared fix; the sole Core library refresh was resubmitted as `t986-core-library-refresh-final` (session98502), waiting behind existing tickets. No browser or provider call has run.

Actual inventory: eight task script modules and nine registered task IDs (normal/timed crossborder share one module). Seven data/mixed modules now provide explicit root `process` on every fresh panel interpretation; social action-only retains `process:null`. Unknown tasks never receive an empty/null fallback. Original historical replies, tasks/oracles and decision paths are unchanged. The double-add cart remains an intentional negative fixture.

Criteria: apprentices filter role/apprentice and project name/role/branch in page order; Saturday slots retain Saturday/enabled criteria and date/time ordering; towels retain paper-towel/nonaccessory/Delivery/no-ad/rating>=4.5 criteria and descending rating, preserving prior store tie order; both hub variants retain inclusive price<=10/unconditional free shipping/no-ad criteria and price ordering; cart projects the complete final cart; invitations retain message-present rows in Received order; saved items sort the complete saved dataset by price without a final three-row limit. Data criteria needing ad, fulfillment, shipping, group-heading or disabled concepts depend on retained upstream fields and unambiguous P2 binding; this fixture update alone does not establish those bindings or task acceptance. Core automatic deduplication remains unchanged; no guessed identity or empty-result allowance was introduced.

New owner `processing-declarations.test.ts` checks exact task criteria, every fresh reply across supported forms, unchanged instruction, refusal of unknown/action-only fallback, and independent reply objects. Existing local-classifieds assertion now includes its declared processing. Add every existing script owner plus this owner to the named Node checks after runner build. Checks for this delta are not yet run. Company direct capture remains blocked on actual public P2 taskProcessing type availability; no casts/private copies were added.

Exact uncheckpointed downstream delta (read-only git inventory, including new owned files):
```text
docs/architecture/recorded-offline-proof.md
docs/working/data-first-simplification-plan/reports/t986-offline-proof.md
packages/test-runner/src/attempt-lane/scripted-model/scripts/bigbox-retail-rated-delivery-towels.ts
packages/test-runner/src/attempt-lane/scripted-model/scripts/company-website-apprentices.ts
packages/test-runner/src/attempt-lane/scripted-model/scripts/company-website-saturday-certificate.ts
packages/test-runner/src/attempt-lane/scripted-model/scripts/crossborder-marketplace-free-hubs-under-ten.ts
packages/test-runner/src/attempt-lane/scripted-model/scripts/everything-store-batteries-and-descaler.ts
packages/test-runner/src/attempt-lane/scripted-model/scripts/index.ts
packages/test-runner/src/attempt-lane/scripted-model/scripts/local-classifieds-save-dining-tables.ts
packages/test-runner/src/attempt-lane/scripted-model/scripts/processing-declarations.ts
packages/test-runner/src/attempt-lane/scripted-model/scripts/professional-network-accept-messaged-invitations.ts
packages/test-runner/src/attempt-lane/scripted-model/scripts/social-network-feed-delete-stranger-requests.ts
packages/test-runner/src/attempt-lane/scripted-model/scripts/tests/local-classifieds-save-dining-tables.test.ts
packages/test-runner/src/attempt-lane/scripted-model/scripts/tests/processing-declarations.test.ts
packages/test-runner/src/attempt-lane/scripted-model/scripts/tests/social-network-feed-delete-stranger-requests.test.ts
packages/test-runner/src/recorded-attempt-replay/read-parity/command.ts
packages/test-runner/src/recorded-attempt-replay/read-parity/compare.ts
packages/test-runner/src/recorded-attempt-replay/read-parity/source.ts
packages/test-runner/src/recorded-attempt-replay/read-parity/tests/command.test.ts
packages/test-runner/src/recorded-attempt-replay/read-parity/tests/compare.test.ts
packages/test-runner/src/recorded-attempt-replay/read-parity/tests/source.test.ts
```

Exact supplemental scripted owner command (after current runner build):
```powershell
node --test --test-concurrency=1 packages/test-runner/dist/attempt-lane/scripted-model/scripts/tests/bigbox-retail-rated-delivery-towels.test.js packages/test-runner/dist/attempt-lane/scripted-model/scripts/tests/company-website-apprentices.test.js packages/test-runner/dist/attempt-lane/scripted-model/scripts/tests/company-website-saturday-certificate.test.js packages/test-runner/dist/attempt-lane/scripted-model/scripts/tests/crossborder-marketplace-free-hubs-under-ten.test.js packages/test-runner/dist/attempt-lane/scripted-model/scripts/tests/everything-store-batteries-and-descaler.test.js packages/test-runner/dist/attempt-lane/scripted-model/scripts/tests/local-classifieds-save-dining-tables.test.js packages/test-runner/dist/attempt-lane/scripted-model/scripts/tests/processing-declarations.test.js packages/test-runner/dist/attempt-lane/scripted-model/scripts/tests/professional-network-accept-messaged-invitations.test.js packages/test-runner/dist/attempt-lane/scripted-model/scripts/tests/social-network-feed-delete-stranger-requests.test.js
```

Queue update: Core library refresh session98502 remains waiting for physical headroom; no build output or behavioral result yet. Down source is refrozen.

Core refresh admitted normally (2.50GiB reservation): contracts:build passed18,280ms and sdk:build passed6,143ms; remaining stages running. This is library preparation, not wrapper/downstream acceptance.

Core dependency refresh completed exit0: contracts18,280ms; SDK6,143ms; fluxiq130,340ms; client-gateway-websocket6,501ms; UI15,730ms; cloud restored516ms. Post-sync Core types submitted as next separate gated stage. New fixture test explicitly narrows panel_command before iteration; downstream source refrozen.

Post-sync Core types: `pnpm --filter fluxiq check` -> exit0, build-cache fluxiq:check69,543ms. Core audit submitted as next separate gated stage; owners/downstream checks remain pending.

Post-sync Core audit: `node scripts/structure-audit.mjs` -> exit0, passed (564 warnings,904 baselined); no baseline edits. Three named Core wrapper/provenance/public-export owner files submitted next as one single-worker Vitest stage.

Post-sync Core owners -> exit0,3 files/11 tests passed83.70s (offline-trial provenance4,strict recorded wrapper5,public exports2). Together with current Core types/audit/library build this validates the synced wrapper snapshot; lead acceptance remains independent. Next separate gated stage is current downstream test-runner types.

Lead review found scenario-prefix ownership accepted sibling paths. Old Down types session57716 was still pre-admission; canceled normally with Ctrl-C (exit1), no command started/no validation result. Approved new read-parity/fixture-url.ts and tests/fixture-url.test.ts plus barrel/source delegation now require exact or slash-descendant path, loopback HTTP, no credentials; tests include /store-other, encoded-slash sibling, trailing slash and root cases. Existing source fixture tests cannot reach the artifact URL without manufacturing a full store, so direct owning validator regressions cover this branch used by source. Source refrozen and sole corrected Down types requeued as t986-down-types-boundary-fixed/session4152, currently waiting memory. Add packages/test-runner/dist/recorded-attempt-replay/read-parity/tests/fixture-url.test.js to named Node owners. No browser before corrected checks.

Lead checkpointed the pre-boundary-fix frozen downstream snapshot as4acb250fe+e3b5b9d3e (WIP/EOF cleanup, not acceptance). The later fixture-url helper/tests/source/barrel delta awaits validation. S3 follow-up direction was accepted by lead, explicitly proposal/not implemented; no mandatory gate code or paid smoke was added. Corrected types4152 continues waiting physical headroom with no downstream result yet.

Existing types ticket briefly reported stale/future memory telemetry; lead independently sampled fresh status successfully (<1s), no holders/only worker ticket and about2.08GiB physical available. No repeatable gate defect established; no source/gate mutation or override. Ticket retained, no downstream command admitted yet.

Lead checkpointef07032e5 contains the frozen fixture-url correction and completed discovery reports/brief (8files, staged diffcheck exit0); this is WIP, not acceptance/push. Source remains frozen for corrected types4152. Bounded input-name read-only intake is complete in reports/input-name-boundary-intake.md and was sent to permission worker/root; no extra source/heavy/provider/browser action.

## Exact remaining validation and capture dependencies

Current source checkpoint: lead ef07032e5 includes frozen URL boundary correction/discovery; new report-only updates do not change the queued type snapshot. Main paired progress-doc checkpoints Down34fbe55af/Corecf60faf9f are lead-reported, not a worker validation/push claim.

Checks valid on the CURRENT t986 source (no P2 sync required):
1. Already observed: current Core libraries build/reuse exit0; fluxiq types exit0 (69,543ms); Core audit exit0 (564 advisory/904 baseline, unchanged); three wrapper/provenance/public-export files11/11 pass83.70s. These are post-P1/dev sync and remain distinct from the earlier pre-sync snapshot.
2. Existing sole worker ticket: t986-down-types-boundary-fixed/session4152 runs pnpm --filter @fluxiq-web-extension/test-runner check. Still pre-admission; canceled prior session57716 never ran a validator. Keep this ticket; no extra submission/priority override.
3. After it settles, separate normal gated stage: node scripts/structure-audit.mjs in Down; no baseline growth allowed. Fix only confirmed owned violations, refreeze and rerun the necessary affected check.
4. Separate normal gated stage: pnpm --filter @fluxiq-web-extension/test-runner build. Public Core libraries are current; owning build handles domain dist. Earlier runtime import closure repair restored test-contracts/test-evidence; current module imports remain unproved until named owners load.
5. Separate normal gated stage: the exact 30-file named Node command below. Includes root-owned S5 observer, cursor-copy/setup regressions, strict schema/raw-row/provenance/URL owners, capture restart/concurrency, package export and all nine script owner files. No full directory/package suite.

```powershell
node --test --test-concurrency=1 packages/test-runner/dist/recorded-attempt-replay/tests/cursor.test.js packages/test-runner/dist/recorded-attempt-replay/tests/egress.test.js packages/test-runner/dist/recorded-attempt-replay/tests/read-step-logs.test.js packages/test-runner/dist/recorded-attempt-replay/capture/tests/start.test.js packages/test-runner/dist/recorded-attempt-replay/capture/tests/command.test.js packages/test-runner/dist/recorded-attempt-replay/capture/tests/transport.test.js packages/test-runner/dist/recorded-attempt-replay/read-parity/tests/source.test.js packages/test-runner/dist/recorded-attempt-replay/read-parity/tests/command.test.js packages/test-runner/dist/recorded-attempt-replay/read-parity/tests/compare.test.js packages/test-runner/dist/recorded-attempt-replay/read-parity/tests/fixture-url.test.js packages/test-runner/dist/coordinator/tests/restart-core.test.js packages/test-runner/dist/extension-chat-check/tests/realistic-scenario-guard.test.js packages/test-runner/dist/attempt-lane/scoreboard/tests/evaluate.test.js packages/test-runner/dist/attempt-lane/scoreboard/tests/export.test.js packages/test-runner/dist/attempt-lane/preflight/tests/evidence.test.js packages/test-runner/dist/attempt-lane/preflight/tests/probe-graph.test.js packages/test-runner/dist/attempt-lane/scripted-model/tests/model-server.test.js packages/test-runner/dist/attempt-lane/live/cost-progress/tests/progress.test.js packages/test-runner/dist/tests/commands.test.js packages/test-runner/dist/attempt-lane/scripted-model/scripts/tests/bigbox-retail-rated-delivery-towels.test.js packages/test-runner/dist/attempt-lane/scripted-model/scripts/tests/company-website-apprentices.test.js packages/test-runner/dist/attempt-lane/scripted-model/scripts/tests/company-website-saturday-certificate.test.js packages/test-runner/dist/attempt-lane/scripted-model/scripts/tests/crossborder-marketplace-free-hubs-under-ten.test.js packages/test-runner/dist/attempt-lane/scripted-model/scripts/tests/everything-store-batteries-and-descaler.test.js packages/test-runner/dist/attempt-lane/scripted-model/scripts/tests/local-classifieds-save-dining-tables.test.js packages/test-runner/dist/attempt-lane/scripted-model/scripts/tests/processing-declarations.test.js packages/test-runner/dist/attempt-lane/scripted-model/scripts/tests/professional-network-accept-messaged-invitations.test.js packages/test-runner/dist/attempt-lane/scripted-model/scripts/tests/social-network-feed-delete-stranger-requests.test.js scripts/lab/tests/provider-free-run.test.mjs scripts/lab/scenario-guard/tests/lab-scenario-refusal.test.mjs
```

P2 PUBLIC API dependency (required for fresh COMPANY capture, not for the current Core wrapper/read-parity checks):
- Lead must finish/accept the t984 runtime/public contract and sync it into the t986 paired Core; peer source or private imports are not sufficient. Verify actual public AutomationStudioFlowTaskProcessing on AutomationStudioGenerateFlowBootstrapAdaptationInput / API GenerateFlowBootstrapAdaptationRequest.
- Only then reopen owned capture/command.ts and pass taskProcessing:{process:{where:[{field:"role",contains:"apprentice"}],columns:["name","role","branch"]}} at the actual Company bootstrap call. Preserve unchanged instruction and page order. No cast, shadow input type, provider instance/secret persistence or historical-reply patch.
- If the local CreatedFlowBuildRequest owner needs a public-type forwarding change, identify its exact path to lead before editing; do not silently widen ownership. Add/update the owning capture assertion and confirm native public serialization receives the property.
- Refreeze after approved integration. Refresh only stale affected Core libraries through existing cache; rerun Core/types/owners as required by the accepted sync and Down types/build/capture+CLI owners affected by this new request field. Current pre-P2 passes cannot claim combined acceptance.
- Fresh scripted root process declarations already exist, with task-specific criteria and social process:null. Their fixture-unit checks can run now; actual browser interpretation readiness depends on the synced P2 interpreter/binding contract. Missing ad/fulfillment/shipping/heading/disabled field bindings stay explicit gaps.

Browser/capture prerequisites and exact proposed commands (NOT launched/announced as accepted):
- Required before any launch: relevant corrected types/audit/build/owners pass, cold runtime dependency closure loads, provider-egress refusal tests pass, and lead announces the exact provider-free command. Use only owned isolated fixture host/profile/test-runs evidence; never user panel/original store. Retain managedHosts cold preparation and env/key scrubbing.
- Original six-field read diagnostic: node scripts/lab/run-lab.mjs recorded-read everything-store --input test-runs/t986-read-parity/input.json --out test-runs/t986-read-parity/report-original-six.json . Requires current scenario/extension dist, original canonical receipt/result hashes and exact89/96/artifact90/binding correlation in the isolated archive. Actual reader/raw/native-result equality plus valid current derived schema must pass; observed external-network leakage remains measured/unknown separately from provider0.
- Fresh Company capture AFTER public P2 wiring/checks: node scripts/lab/run-lab.mjs recorded-capture company-website --task company-website-apprentices --evidence test-runs/t986-fresh-capture-company-v1 . Directory must be new; existing path refusal is deliberate. Expected scope is actual known-Flow bootstrap/closed-store pre-entry receipt/native recording/settled archive, not conversation or task acceptance. Missing wire/extras/unknown trace completion remains a gap.
- Permission protocol diagnostic AFTER combined compatibility: node scripts/lab/run-lab.mjs offline-preflight social-network-feed --task social-network-feed-delete-stranger-requests --evidence test-runs/t986-preflight-social-v1 . Preserve actual unchanged task, real start consequence, panel deny then Stop, no lasting act; claim permission protocol only. Generic person-confirm/read is not permission. Actual site challenges and complete chat/task result remain separate measured stages, not automatic passes.

Historical limits remain unchanged: F25 source trace is open, genuine starting position is unproved and request30 has no matched completed reply; full historical build/task replay is inadmissible. Exact original six-field reader proof cannot establish newly retained28-field parity. The original full detector binding/spec is not yet admitted; any later re-detection on aligned HTML must be clearly labeled new detection, never reconstructed original binding or detector samples used as row values. Other missing allocated roots remain evidence gaps. FullAttemptAccepted:false/wholeTraceAdmitted:false stay mandatory for this segment/prefix lane.

Next action remains waiting for existing type ticket admission/result. No browser/provider call, new heavy job, source or gate mutation from this checklist.

Corrected downstream types session 4152 admitted normally with 4.02 GiB reservation. Core-build confirms paired Core dist current; runner check began its domain dist preparation. No type result yet, source remains frozen.

Corrected Down types reached TypeScript and failed (launcher exit 1, tsc exit 2; check 19,380 ms). Domain build passed 27,064 ms beforehand. Four diagnostics, all root-owned cost-progress/reader.ts:69 (TS7053 and TS2339 call.stage), :71/:72 (TS2339 call.usd): pending/unreadable union branch is not narrowed to settled. No worker-source diagnostics reported. Sent exact handoff to root; worker does not edit observer. Slot released; waiting root fix/refreeze before rerun. This is a type failure, not a runtime/behavior result.

## Worker return at owned-file blocker

Outcome: Partial. Bounded source, native transport, capture/reader admission, strict scoreboard/preflight scaffolding and fresh processing fixtures are checkpointed by lead. Current Core wrapper snapshot passed libraries/types/audit and 11 focused tests. Current Down check reached compiler after a successful domain build, then failed on the four root-owned live-cost receipt-narrowing diagnostics recorded above; no runtime behavior result was produced.

The worker handed the observer correction to root and preserved file ownership. Root is now completed/idle according to collaboration status, so there is no active owner refreeze notice to resume from. This return makes the blocker concrete instead of leaving an unattended worker waiting. No worker test/build/browser/provider job remains running or queued; last type session 4152 is finished. Source remains frozen.

Required resume: root fixes/refreezes packages/test-runner/src/attempt-lane/live/cost-progress/reader.ts, then rerun test-runner types and the exact separate audit/build/30-owner sequence above. Public P2 sync plus actual Company taskProcessing wiring remains a separate required capture dependency. No historical trace or whole-task acceptance is claimed; original open/start/unmatched-request/28-field gaps remain unchanged.

Changed since lead's latest report checkpoint: report-only validation/admission/failure/return entries here. Worker made no git mutations; lead owns commit/push after correction and checks. Latest source checkpoints are WIP, not acceptance.
Validation: current Core libraries/types/audit and three files/11 tests passed; current Down domain build passed, test-runner types failed with four root-owned diagnostics; subsequent Down audit/build/owners and all browser commands not run.
Not verified: corrected observer compilation, combined Down behavior, fresh browser capture/preflight, actual original reader equality, full historical task replay or 28-field proof.
Report: docs/working/data-first-simplification-plan/reports/t986-offline-proof.md
Notes: Read-only S3 and input-name intakes are complete, proposal/peer claims distinguished from acceptance. No paid run, raw artifact output or original-store mutation.

## Resumed execution

Lead resumed this worker under briefs/resume-offline.md, fixed the owned Receipt type into distinct pending/unreadable discriminant members without behavior change, and refroze source. Read current main state and latest report. One new normal gated runner typecheck submitted as t986-down-types-reader-fixed-resume; prior Core checks are not repeated unchanged. P2 public Company capture dependency and no-browser boundary remain.

Resume file-level reader preparation: prepared input and isolated F25 source copy exist; exact canonical result and original entry SHA256 both match the declared receipts. Original-six report, fresh Company capture directory and fresh social preflight directory do not exist, so proposed commands retain their no-overwrite/new-directory precondition. Check exited 0, metadata booleans only; no raw content output, host, browser or extra heavy ticket. This is presence/hash readiness, not source admission or actual-reader parity.

## Post-reboot public processing integration

Lead released source edits after paired Core checkpoint 6dcd8bfa0 (combined P2/P6) merged. CreatedFlowBuildRequest now forwards taskProcessing by Pick from the public GenerateFlowBootstrapAdaptationRequest; no copied/private contract or cast. The actual fresh capture command uses recordedCaptureRequest, which forwards existing per-task authored processing declarations. Company criteria remain role contains apprentice and name/role/branch projection, in captured order. The unchanged whole-request POST also carries those criteria, and the same request participates in the stopped-start receipt digest. New tests check serialized request criteria, independent declarations, unsupported declaration refusal and receipt refusal when processing changes. Existing historical replies and provider transport are unchanged.

Validation: git diff --check -> exit0 (line-ending warnings only). Heavy checks not run; lead's gate repair release remains pending. No browser/provider launch or acceptance claim. Source is ready to refreeze for exact runner type/audit/build/30-owner sequence after current public Core libraries are available.

Combined post-reboot Core refresh was submitted normally as t986-core-library-refresh-post-reboot (session63626). Gate status: no holders, worker FIFO head, 2.50GiB estimated reservation, about3.13GiB physical and35GiB commit available; no validator admitted. Lead requested normal withdrawal while repairing pagefile-aware gate policy. Ctrl+C -> exit1, no build stages ran. No validation result from this submission. Worker is holding with no queued/running job; source remains frozen.

Post-reboot combined Core library refresh admitted by normal repaired pagefile-aware gate (2.50GiB) under t986-core-library-refresh-pagefile, session56605. Exact command: node scripts/build-cache/cli.mjs contracts:build sdk:build fluxiq:build client-gateway-websocket:build ui-components:build cloud:build. Result exit1: contracts29,124ms and SDK7,859ms passed; fluxiq build failed79,883ms with four TypeScript diagnostics. replay/draft.ts:448 and replay/span.ts:437 pass ParsedToolExecution recordSchema possibly undefined into an exact optional member excluding undefined (TS2379); flow-less/judge.ts:136 similarly passes deniedEvidenceKeys possibly undefined (TS2379); judge-evidence/summary.ts:121 passes unknown-valued object as JsonObject/evidence bundle (TS2345). Remaining library stages did not run. Durable output: ignored test-runs/t986-post-reboot-validation/core-library-refresh.log. These are combined Core compilation errors, not Down runtime/browser results. Lead routed fixes to existing shared owners; worker does not edit P2/P6.

All browser commands remain unlaunched. Lead authorized exact isolated original-six recorded-read, fresh Company capture and social permission preflight only after source checks pass and Core sync. Current acceptance remains held on combined Core build. Source is frozen; no worker job running/queued after failed refresh.

Independent current-source observer validation (no stale package/Core dist): initial standalone tsc invocation failed TS2688 because workspace root has no node type definitions. Corrected explicit --typeRoots packages/test-runner/node_modules/@types; compiling the current progress.test.ts dependency closure with installed TypeScript, NodeNext/ES2022/strict/exactOptionalPropertyTypes/skipLibCheck, to ignored test-runs/t986-post-reboot-validation/cost-observer -> exit0. Separate normal gated node --test --test-concurrency=1 test-runs/t986-post-reboot-validation/cost-observer/tests/progress.test.js -> exit0,6/6 passed331ms, including contradictory identifierless metadata+request -> unknown -> settled. Logs: cost-observer-types.log (failed root resolution), cost-observer-types-fixed-root.log (pass), cost-observer-owner.log (pass), all under same ignored validation root. This validates root's current observer fixes independently; combined runner types/build/30-owner checks still pending failed Core public-library refresh.

Lead synced minimal Core compilation fixes e46d13807+afd285807 and released retry. Normal gated combined Core public library refresh t986-core-library-refresh-types-fixed/session94120 -> exit0: contracts/SDK reused matching stamps; fluxiq149,741ms, client-gateway-websocket6,680ms and UI18,065ms built; cloud reused499ms. Durable output core-library-refresh-types-fixed.log under ignored validation root. This proves public-library compilation for the synced snapshot; browser/runtime behavior remains separate. Sole next Down runner typecheck t986-down-types-post-reboot/session40003 submitted normally, initially waiting an earlier ticket; down-types.log retains output. No browser/provider call.

Current Down test-runner check -> exit0: domain dist build38,904ms and runner types36,961ms. Public Pick+actual taskProcessing helper compiles. Next normal gated structure audit t986-down-audit-post-reboot/session61279 -> exit1, sole rule violation statement-packing in root-owned cost-progress/reader.ts lines32,40. No worker-owner violation and no baseline changes. Durable down-types.log/down-audit.log. Handed exact style failure to root for ownership-safe correction/refreeze; build/30 owners/browser not run yet. This is audit failure after successful compiler coverage, not a runtime result.

Lead checkpoint bb9f896ae split observer statements without behavior change and refroze. Down structure audit retry -> exit0 (advisories only; no baseline edit), durable down-audit-observer-format.log. Current runner build -> exit0, test-runner:build51,915ms, domain reused current stamp; down-build.log. Exact30-owner launcher initially searched resume brief instead of report, refused missing list before submitting any job; corrected to recorded exact command in report, asserted30 file arguments, then normal gated stage t986-down-30-owners-post-reboot/session94014 queued. Build output includes current capture request, receipt and observer source. No browser/provider run.

Already-admitted exact30-owner stage finished normally -> exit0,206/206 tests passed192,918ms. New public processing request/receipt assertions, six current cost observer tests, cursor byte copy, strict provenance/schema/URL guards, actual runtime import closure, provider-egress refusal and every named fixture owner passed. Durable down-30-owners.log. Root requested paired latest dev sync before browser/final combined acceptance; worker source remains frozen with no further validator/browser launched. These passes describe the pre-next-parent-sync snapshot, not a future combined tree.

Lead synced both latest dev parents, including accepted P1 downstream retained extraction (80-file overall parent delta) and Core docs-only delta. No source mutation by worker during sync. Current combined types -> exit0 (domain rebuild34,496ms, runner check25,901ms); current runner build -> exit0,57,327ms, domain current stamp reused. Logs down-types-p1-combined.log/down-build-p1-combined.log. Exact30 owner rerun t986-down-30-owners-p1-combined/session85009 submitted normally and waiting earlier ticket; no extra heavy job. This parent change invalidated earlier downstream behavior acceptance, so current owner rerun and extension build precede all browser launches.

Final P1-combined30 owners -> exit0,206/206 passed200,165.7555ms; current extension build -> exit0,54,363ms, Chrome/Firefox/e2e bundles verified. Lead held parent HEADs b08dafd7f/d906b1e80 for browser currentness.

First authorized browser command was normal gated exact original-six recorded-read, isolated target and task Core branch, with no behind/stale overrides. Prelude currentness passed, rebuilt test-contracts/scenario-lab/browser-host/test-evidence as needed, reused domain/extension/runner, then command exit1. Report-original-six.json is preserved: sourceVerified:true, correct89/96 segment/hash admission, phase browser_read, gaps snapshot_unavailable, parityPassed:false. modelCalls/providerCalls/providerUsd0 by construction; externalCalls/externalUsd null (unobserved). No native/raw/schema parity or28-field/task claim. Company capture/social preflight not launched.

Bounded normal gated reproduction of the same isolated snapshot emitted only safe diagnostic categories: unavailable/content_not_ready, topFrame:true, framePathPresent:false, primaryIsHtml:true, observations:null. HTML loaded, but contentReady never announced. Static trace proves root cause: production sendReady waits for ownDocument.verdict(); that asks fluxiq.ownPageAddresses; sandbox stub unconditionally returned undefined, so verdict remains unconfirmed. This is a stale background-protocol stub, not memory or a browser-launch failure. Root authorized scoped protocol correction; production guard remains intact. Stub now answers only exact object query with production-shaped {ok:true,addresses:[]} (sandbox has no running Core panel/gateway), preserving generic absent-background responses and outgoing copies. Test covers structured response, mutation independence and malformed/unknown no-answer. Targeted types/test and rebuilt runner precede rerun to new report-original-six-rerun1.json; first failed report untouched.

Independent same stale seam: apps/extension/e2e/content/runtime-stub.ts lines29-31 likewise replies undefined to every message. Exact minimal follow-up is same protocol query response with truthful fixture-owned addresses and unit coverage under apps/extension/e2e/content/tests/runtime-stub.test.ts (no existing runtime-stub unit owner found). Root owns routing; worker did not silently edit a separate E2E owner. No e2e browser acceptance claim.

Snapshot-stub targeted regression: first compile failed only TS2345 from assert.deepEqual narrowing empty addresses to never[] before the mutation-negative; replaced with ok/length assertions, no production change. Corrected strict NodeNext source closure compilation -> exit0; exact two owners ->6/6 passed212.799ms. Durable snapshot-stub-types.log, snapshot-stub-types-fixed.log and snapshot-stub-owners.log. Current full runner rebuild t986-down-build-snapshot-protocol/session17911 admitted normally. Root now owns the independent E2E runtime-stub.ts protocol fix; worker validation does not consume that owner. Architecture documents truthful background protocol; no generic success or document-guard bypass.

Protocol-fix runner rebuild -> exit0,45,477ms. Root independently verified6 local tests and fixed the separate E2E stub, whose existing Everything Store browser case passed1/1; root checkpoint86d8042d5 is source-equivalent for worker owners. New-output original-six rerun -> exit1 at compare, report-original-six-rerun1.json preserved. Source admitted and production content read completed: nativeResultMatches:true, valid current schema/0 invalid,20 rows with6 fields each, scriptsRan0,requestsLeaked0,requestsRefused0,navigationsHeld0,scrollsPastEnd1. Provider/model calls0; observed external calls/USD0 for this completed snapshot. Canonical rawRowsMatch:false; gap canonical_recorded_rows_changed. Startup is fixed; canonical proof is still failed. No Company/social browser launch by worker.

Exact structural diagnosis, no raw recorded values emitted: historical native gateway vs canonical step rows already differ (20/20 rows, only field ordinal3, a link string); every other cell/key/type/row position agrees. Both first-row prototypes are plain; JSON roundtrip still differs, excluding prototype artifact. Each differing native value contains the snapshot origin (22chars), canonical omits it, and removing that exact origin accounts for the full difference in all20 cells. This was a diagnosis only, never a normalization or acceptance change.

Owning lineage found: domain/src/runtime/llm-evidence/node-run/rejected-rows.ts:151 creates webNodeReadLinks(payload.url), then shown-rows/account.ts:18 writes model-visible read.extracted using shown-rows/links.ts:37. That production writer deliberately emits same-origin links as root-relative paths and states origin once. Canonical step result.json is a model-visible tool result; historical native gateway payload is raw. Provider-free source-only call through actual current webNodeReadWithRejectedRows(recordedNativePayload).read.extracted is deep-strict equal to original canonical20 rows and states exact snapshot origin. Native raw vs canonical remains unequal. Durable diagnostics: canonical-structural-diagnosis, canonical-cell-diagnosis, canonical-origin-diagnosis and canonical-projection-lineage JSON/log files under ignored validation root. No oracle, comparator, historical artifact, or source was changed to obtain this finding. Existing reports remain failed; proposed correct proof has explicit raw-native equality and actual-owner projected-canonical equality, never one substituted for the other.

Root is taking the independently authorized fresh Company capture in its new evidence directory while worker finishes lineage diagnosis; worker source remains frozen. No job running/queued for worker, no paid run. Parent currentness stays root-owned.

## 2026-11-23 resume

Brief: `briefs/finish-offline-proof.md`. Trees: downstream 93b22640d, Core 69a35f617 (lead-synced). Steps 1 and 2 done; step 3 (browser) not started, waiting for the lead's synced-trees message. Source edits are downstream only; Core is unchanged. Logs are under ignored `test-runs/t986-resume-1123/`.

### Outcome
Partial: steps 1 and 2 are done and ready for browser runs. The checkpoint compiles and its owners pass. The cause of the Company capture failure is proven and fixed in the code. No browser, Lab, provider or paid run happened.

### Step 1: the read-parity checkpoint (4e364886d)
- Audit defect: `offline-reads/model-result.ts` reached into `llm-evidence/node-run/rejected-rows`. Fixed by exporting `webNodeReadWithRejectedRows` (and its type) from the `node-run` barrel and importing the directory. No cycle: nothing under `llm-evidence` imports `offline-reads`.
- Compile defect: `read-parity/command.ts(45,176) TS2322 unknown -> JsonObject`, because `source.ts` returned `command.parameters` (typed unknown). It now returns the `parameters` object that `source.ts` already proved holds `extractList` and that came from a `json`-encoded trace event.
- `model-result.test.ts` was rewritten from top-level asserts to `node:test` cases with the same assertions: projected origin and relative link, raw frozen payload unchanged, and no payload projects to nothing.
- The comparison logic in `boundaries.ts` and `command.ts` is unchanged. Raw native rows are compared with recorded native rows, and production-projected rows with canonical rows, plus origin/URL context. Neither substitutes for the other. The recorded-read paragraph in `docs/architecture/recorded-offline-proof.md` now describes this split.

### Step 2: Company capture `native_request_not_captured`, cause and fix
Evidence was read from copies only; nothing in `test-runs/t986-fresh-capture-company-v1` was opened for writing. The scripts are under `test-runs/t986-resume-1123/company-diag/` and print names and counts only.
- The IAM audit in `source-archive` shows `studio:GenerateFlowBootstrapAdaptation` allowed exactly once after the restart (`audit-actions.log`). The HTTP build call therefore reached Core's handler.
- `project.sqlite` in both `starting` and `source-archive` has no `client_gateway_traces` table (`tables.log`). No build trace episode was ever opened or closed, so the service build never started. This held even though tracing is on in every Lab Core (`FLUXIQ_CLIENT_GATEWAY_TRACE=1`).
- Code shows a deterministic mismatch. The receipt's `entryDigest` covered the posted `CreatedFlowBuildRequest` (`{projectId, flowId, evidenceGuided, startLocation, taskProcessing}`). The host wrapper compared that digest with the *service* request. Core's route (`flow-bootstrap-requests/generate.ts:131-160`) always builds that request with `caller` (required by `generation/request.ts:66`), `permittedConsequences: []` and `permissionAskTimeoutMs`, so the digests can never match. The wrapper threw `recorded_capture_actual_entry_changed` before `generate`. The route turned that into its generic failure sentence, and `proof`'s empty `catch` swallowed it, which left only `native_request_not_captured`.
- The same defect would have broken replay: `replay-input.json` carried the posted request without `caller`, and the service refuses a request without one.

The fix binds the actual service entry and never predicts it:
- `stopped-start.ts` records only the closed store's facts (store digest, copy time).
- The new `receipt.ts` builds the unchanged receipt shape from those facts plus an entry.
- The runner writes `{facts, declared, wireFile}`.
- In Core, `entry-binding.ts` and `service-entry.ts` require every declared field to reach the service deep-equal, else `recorded_capture_actual_entry_changed`. They then bind the routed request whole, with one change: `caller.actorSessionId`, a live session credential (`identity-access validateSession`), is replaced by a fixed marker, and `actorUserId` is kept. The host writes the entry and receipt for the runner (`capture-entry.json` in the evidence), attaches the receipt at the first native request, and runs `generate(boundEntry.request)`.
- Replay's `request` is the same bound entry, so capture and replay enter the service identically. `capturedAt` is still the store-copy time, so `before_entry` holds.
- A host refusal is written as a code, reported as `hostRefusal`, and listed as a gap.
- The runner checks receipt consistency (`storeDigest`, and `entryDigest` = digest(entry)).
- `start.ts` keeps its API by binding its caller-supplied entry at once.
- Nothing was normalized. The route's `permittedConsequences` and ask wait are kept exactly as Core wrote them, and no timeout or wait changed.
- Report honesty: `capture-report.json` hard-coded `externalCalls: 0, externalUsd: 0` without observing browser network. It now reports `providerCalls: 0, providerUsd: 0` (no network by construction) and `externalCalls: null, externalUsd: null`.

### Commands run and observed results
All heavy commands ran through `heavy-slot.mjs run <label> --`.
- `DOMAIN_TEST_BUILD_LABEL=t986-offline-reads node scripts/test-domain.mjs runtime/offline-reads/tests/model-result runtime/llm-evidence/node-run/tests/rejected-rows` (domain) -> 15/15 pass.
- `pnpm --filter @fluxiq-web-extension/test-runner check`:
  - first run -> exit 2, TS2322 at `read-parity/command.ts(45,176)` (domain rebuilt 48,088 ms);
  - after the `source.ts` fix -> exit 0;
  - after the capture fix -> exit 2, TS2322 on the host wrapper's generic return;
  - after making the entry binding generic over the routed input -> exit 0, and exit 0 again after the test edits.
- `pnpm --filter @fluxiq-web-extension/test-runner build` -> exit 0 (103,124 ms; rebuilt twice more after later edits, both exit 0).
- `pnpm --filter @fluxiq-web-extension/domain check` -> exit 0 (33,961 ms, src and test configurations).
- `node scripts/structure-audit.mjs`:
  - first run -> exit 1 with 3 violations in my new tests (`as never` x3, a fixed `os.tmpdir()/elsewhere` path);
  - after replacing them with typed JSON-parsed stubs and a `mkdtemp` directory -> exit 0, "passed (258 warning(s), 551 baselined)". The checkpoint's barrel violation is gone and the baseline is unchanged.
- `node --test --test-concurrency=1` on the 5 capture owners (service-entry, entry-binding, start, command, transport) and the 5 read-parity owners (boundaries, source, command, compare, fixture-url) -> 26/26 pass (62,587 ms). Logs: `owners-final.log`, `read-parity-owners.log` (13/13 earlier).
- Diagnostic scripts (`node --no-warnings test-runs/t986-resume-1123/company-diag/{trace-episodes,tables,audit,audit-actions}.mjs test-runs/t986-fresh-capture-company-v1`) -> outputs as summarised above.

### Not verified
- No browser run. The fix is proven by unit owners and evidence reasoning, not by a new capture. The new capture may still stop at a later boundary that was never reached before, for example the attachment's exploration-episode check or trace completeness.
- The 30-file owner sweep and the extension build were not rerun. The Everything Store rerun, the Company capture and the social preflight have not run.

### Open questions
- Binding the routed entry, with only the session credential replaced, is a design choice (recorded in `docs/architecture/recorded-offline-proof.md`). The alternative, predicting Core's route mapping in the Lab, would copy Core internals, and its ask-wait constant is not public.
- Ready for step 3 once the lead confirms both t986 trees are synced. The browser commands will write new outputs: `report-original-six-rerun2.json`, `t986-fresh-capture-company-v2`, `t986-preflight-social-v1`.

### Step 3: browser runs (after the lead's go; trees Core 085114005 and downstream 3181a6bbe, both 0 behind dev)
All runs went through the heavy gate, provider-free, in visible browsers, each to a new output. The Lab prelude ran core-staleness and repository-staleness every time and refused nothing.

1. **Everything Store recorded read**: `node scripts/lab/run-lab.mjs recorded-read everything-store --input test-runs/t986-read-parity/input.json --out test-runs/t986-read-parity/report-original-six-rerun2.json` -> exit 0, `parityPassed: true`, `gaps: []`.
   - `nativeResultMatches`, `rawNativeRowsMatch`, `modelProjectedRowsMatch` and `projectionContextMatches` are all true.
   - 20/20 rows, 6 fields each; current derived schema valid with 0 invalid rows.
   - Sandbox: `scriptsRan 0`, `requestsLeaked 0`, `requestsRefused 0`, `navigationsHeld 0`.
   - Model and provider calls 0 by construction. External calls and cost were observed as 0 (`requestsLeaked 0`).
   - Source admission: command and result sequences 89/96, `wholeTraceAdmitted: false`, `fullAttemptAccepted: false`.
   - Change before the run: the snapshot sandbox was hard-coded headless, so `read-parity/command.ts` now opens it headed (`headless: false`) under the visible-browser rule. Scripts and network stay disabled. The prelude rebuilt the extension, browser-host and test-runner.
2. **Fresh Company capture**: `node scripts/lab/run-lab.mjs recorded-capture company-website --task company-website-apprentices --evidence test-runs/t986-fresh-capture-company-v2` -> exit 0, `complete: true`, `gaps: []`, `hostRefusal: null`, `extraNativeRequests: 0`, one source trace id.
   - Evidence: `capture-entry.json`, `capture-wire.json`, `artifact.json`, `replay-input.json`, `starting/` and `source-archive/`.
   - The bound entry and `replay-input.json` both carry `actorSessionId: "recorded-capture-no-session"`, the route's `permittedConsequences: []`, `permissionAskTimeoutMs: 120000` and the declared processing (role contains apprentice).
   - The entry fix therefore held, and the later checks passed: exploration-episode attachment, live complete trace, artifact admission and before-entry position.
   - Provider calls 0 and USD 0 (no network by construction); external calls and cost null (not observed).
   - This is a fresh stopped bootstrap prefix only, not a conversation build or task acceptance. The replay of this capture (`lab recorded-replay`) was not run.
3. **Social preflight, first run**: `node scripts/lab/run-lab.mjs offline-preflight social-network-feed --task social-network-feed-delete-stranger-requests --evidence test-runs/t986-preflight-social-v1` -> `protocolPassed: false`, gaps `unproved_chat_start`, `unproved_person_answer`, `unproved_read`, `runtimeFailure: "additional protocol proof"`.
   - Pairing passed. The permission stage passed: real start gate, `delete` denied in the panel, cancellation requested while active, no lasting act, 0 decision calls.
   - Cause, from `result-chrome.json`: the generic read probe timed out waiting for its confirmation, because the chat's run of the probe Flow ended "Write active instructions in this automation's Instructions before running or building it."
   - Core's run authority (`instruction-led/authority.ts`, asserted on every run) requires an active, written, flow-scoped task instruction on the parent Flow. `save-probe.ts` built the probe graph without one, so Core refused to run the probe.
   - Fix: `save-probe.ts` saves one generic task instruction ("Confirm with the person, then read this isolated fixture page.") through the public `save-flow-generation-instruction` route, without the PIN that route rejects as an unsupported field, and refuses with `preflight_probe_instruction_inactive` unless Core reports it active.
   - The probe's control parameter is narrowed to `Pick<..., "automationStudioCall">`. A new owner, `tests/save-probe.test.ts`, checks that the instruction is saved before the graph, carries exactly projectId/flowId/instruction, and that an inactive one is refused.
   - Checks: runner check exit 0; runner build exit 0; owners save-probe, probe-graph, evidence and read-parity command -> 7/7, then save-probe, probe-graph and evidence -> 5/5 after one audit fix; structure audit first exit 1 (statement-packing in the new test), then exit 0 "passed (258 warning(s), 551 baselined)".
   - Architecture doc updated (probe instruction; visible sandbox).
4. **Social preflight, second run**: `node scripts/lab/run-lab.mjs offline-preflight social-network-feed --task social-network-feed-delete-stranger-requests --evidence test-runs/t986-preflight-social-v2` -> exit 0, `protocolPassed: true`, `gaps: []`, `runtimeFailure: null`.
   - Every stage passed: pairing, person_answer, read, chat_start and permission_answer.
   - Generic probe: chat started `run.execute`, the person granted the confirmation, and the probe run succeeded with a `read-page` action.
   - Task start: the unchanged deletion instruction created a Flow and the chat `became: build`; nothing was applied.
   - Permission: unchanged from the first run (denied in the panel, no lasting act, 0 decision calls). It used 1 logical call to the loopback scripted model server, not a provider.
   - Site challenge `not_declared`.
   - `preflight.json` writes `externalCalls: 0, externalUsd: 0` as constants. This command does not observe browser network, so read them as unobserved (null). I did not change that schema, because the scoreboard reads it.

Step 3 changes: `packages/test-runner/src/recorded-attempt-replay/read-parity/command.ts` (headed sandbox), `packages/test-runner/src/attempt-lane/preflight/save-probe.ts`, the new `packages/test-runner/src/attempt-lane/preflight/tests/save-probe.test.ts`, and `docs/architecture/recorded-offline-proof.md`. Logs are in `test-runs/t986-resume-1123/` (`read-rerun2.log`, `company-capture-v2.log`, `social-preflight-v1.log`, `probe-*.log`, `social-preflight-v2.log`).

Not verified after step 3: replaying the fresh Company capture; whole-task, four-attempt or scoreboard acceptance; the 30-file owner sweep after the latest edits; Firefox.

### Round 3 (after a9e601d68): owner sweep, Company replay, nine-site preflight

**1. The lane's 30-file owner command** (exact list in "Exact remaining validation" above), run through the gate on the a9e601d68 build -> exit 0, 206/206 pass (153,710 ms). Log: `test-runs/t986-resume-1123/owners-30.log`. Nothing failed, so nothing was changed.

**2. Replay of the fresh Company capture.**
- **Workspace.** The replay opens a host on its starting store and runs a build in it, so pointing it at `t986-fresh-capture-company-v2` would have changed that evidence. `starting/`, `source-archive/` and `artifact.json` were copied into the new `test-runs/t986-replay-company-v1/`; `diff -rq` showed the copies identical. Only the paths in `replay-input.json` changed: `artifact`, `rootDir`, `sourceRootDir` and `allowedWorkRoot`.
- **Same entry.** The copied `request` deep-equals `capture-entry.json`'s bound `entry.request`.
- **Command:** `node scripts/lab/run-lab.mjs recorded-replay --input test-runs/t986-replay-company-v1/replay-input.json --out test-runs/t986-replay-company-v1/replay-report.json` -> exit 1, `proof: recorded_build_prefix`, `fullAttemptAccepted: false`.
- **Result fields:**
  - `position.point: before_entry`, with the source trace id and receipt sha.
  - `session.status: refused`, `reasonCode: incomplete_capture`, detail "the trace's events do not say which session they belong to: some of its events name their session and others do not".
  - `model.logicalCalls: 0`, `model.divergence: null`, `model.externalUsd: 0`, `historicalUsd: 0`.
- **Entry proof.** `verifyRecordedStartingPosition` ran before the session. It requires the in-trace receipt's `entryDigest` to equal the digest of `{request, chat: null}` that replay enters with, and it passed. So replay was admitted with exactly the bound entry. The service build itself never started: Core's recorded-trace session refused first, with 0 model calls.
- **Cause.** Diagnostic: `company-diag/session-refs.mjs`, run on the replay copy, prints counts only; log `session-refs.log`.
  - Every gateway event is session-referenced: artifact 2, disposition 8, inbound 8, lifecycle `session.claimed` 1, outbound 3.
  - Exactly one session-bound event has no session reference: the producer receipt artifact on the control stream (`recorded.start`).
  - Core's `client-gateway/trace-replay/session-references/evaluation.ts` treats every `artifact` event as session-bound (`bound-kinds.ts`) and refuses a trace where some session-bound events have a reference and others do not.
  - The trace contract (`client-gateway/trace/types.ts`: `session` "Absent when the event belongs to no one session") and Core's own `open-episode.ts recordControl`, which records control-stream artifacts with no session, both say a control-stream artifact belongs to no session.
  - So any trace carrying a control-stream artifact is refused by replay. This is a Core replay-admission defect, not a downstream one. Giving the receipt a session would invent ownership it does not have.
- **What is missing.** A Core fix outside this lane's paths, as the coordinator directed. In `session-references/evaluation.ts` and `attached.ts`, events on the Automation Studio control stream, which by contract belong to no session, should be neither counted as session-bound nor given `session-1`. This needs a Core owner, a Core test (a trace with a sessionless control artifact among referenced gateway events must evaluate as `recorded`), and the user alert for crossing the repository boundary. The replay can then be rerun on a fresh copy (`t986-replay-company-v2`). Nothing was worked around, and no downstream mechanism was added.

**3. Provider-free preflight on the other nine realistic sites**, one per site with that site's fixed scoreboard task (`attempt-lane/scoreboard/fixed-tasks.ts`). Each ran through the gate as `node scripts/lab/run-lab.mjs offline-preflight <site> --task <task> --evidence test-runs/t986-preflight-<site>-v1`, in a visible Chrome. All nine exited 0 with `protocolPassed: true`, `gaps: []` and `runtimeFailure: null`; none needed a v2.

| Site | Task | Stages passed | Permission | Site challenge |
| --- | --- | --- | --- | --- |
| everything-store | everything-store-plus-earbuds-under-50 | pairing, person_answer, read, chat_start | not_applicable | not_run |
| crossborder-marketplace | crossborder-marketplace-free-hubs-under-ten | same four | not_applicable | not_run |
| bigbox-retail | bigbox-retail-new-store-cheapest-towels | same four | not_applicable | not_run |
| job-board | job-board-halvard-careers-roles | same four | not_applicable | not_declared |
| local-classifieds | local-classifieds-bikes-within-alex-price | same four | not_applicable | not_declared |
| auction-marketplace | auction-marketplace-lens-hood-seller-shop | same four | not_applicable | not_declared |
| photo-social | photo-social-august-over-1300 | same four | not_applicable | not_declared |
| company-website | company-website-apprentices | same four | not_applicable | not_run |
| professional-network | professional-network-netherlands-data-engineers | same four | not_applicable | not_declared |

What each stage shows:
- Generic probe: the chat started `run.execute`, the person granted the confirmation, and the probe run succeeded with a `read-page` action.
- Task start: the unchanged instruction created a Flow and the chat `became: build`, with `applied: false`.
- Permission is not applicable: these nine tasks declare no permission point or permits, which the evidence records with the task digest. The social site (`t986-preflight-social-v2`) remains the only consequential, permission-exercised preflight.
- Site challenge:
  - `not_run` (everything-store, crossborder, bigbox, company-website): the site declares person-check modules, and this preflight does not exercise them. That is a stated gap, not a pass; a generic confirmation is not the site's own challenge.
  - `not_declared` on the other five.
- Calls and cost: no provider calls; the chat-check Core has no model key. External calls and cost are not observed by this command. `preflight.json` writes them as constant 0, so read them as null.

Logs are `test-runs/t986-resume-1123/preflight-<site>-v1.log`.

Round 3 changed no source and made no git mutations. New outputs:
- `test-runs/t986-replay-company-v1/` (copied inputs plus `replay-report.json`);
- `test-runs/t986-preflight-<site>-v1/` for the nine sites;
- the diagnostic `test-runs/t986-resume-1123/company-diag/session-refs.mjs` and its log.

The campaign's recorded-run acceptance was not started; it waits for the P2 data stage.

Not verified in round 3:
- A replay past the Core session gate. It is blocked on the Core fix described in item 2.
- Site-declared person challenges on the four `not_run` sites.
- Whole-task or scoreboard acceptance.
- Browser network observation in preflights.

### Round 4: Core session-reference fix, replay to the end of the recorded prefix

**Core fix** (authorized; in `!FluxIQ/packages/fluxiq/src/client-gateway/trace-replay/session-references/`).
- Users of `CLIENT_GATEWAY_TRACE_SESSION_BOUND_KINDS`: `evaluation.ts` and `attached.ts` (owned), plus `walk/walk.ts:113` and `trace-matcher/trace-admission.ts:87` (not owned, left unchanged). The recording tap does not use the set, so what gets recorded is unchanged.
- New `session-bound.ts` exports `clientGatewayTraceEventSessionBound(event)`. An event is session-bound only when its kind is in the set and its stream is one the gateway tap writes (`CLIENT_GATEWAY_TRACE_TAP_STREAMS`: `gateway` and `artifact`, which date from capture P2, before session references in P3). An event a host records on its own stream, such as Automation Studio's `control` stream and its artifacts, belongs to no session, as the trace contract says of an event without `session`.
- `evaluation.ts` and `attached.ts` now use that predicate, the barrel exports it, and the `bound-kinds.ts` note explains why kind alone does not decide.
- Tests (`tests/evaluation.test.ts`):
  - a sessionless control-stream artifact among referenced gateway events evaluates as `recorded`;
  - a sessionless upload on the tap's `artifact` stream is still refused ("some of its events name their session and others do not");
  - attaching gives `session-1` to an unreferenced upload and not to a control artifact.
  - Every existing refusal test is unchanged and passes.
- Not owned, so reported rather than changed: `walk.ts:113` would still log a gap for a sessionless control artifact, and would feed any `artifact` event as a client upload. `trace-admission.ts` `servedSession` counts control artifacts among the sessions. Neither was hit in this replay, because Core's recorded trace session answers operations through the matcher (3/3 matched, no gaps). Both should switch to `clientGatewayTraceEventSessionBound` in a Core follow-up.

**Core checks:**
- One worker, gated: `node node_modules/vitest/vitest.mjs run src/client-gateway/trace-replay/session-references --maxWorkers=1 --minWorkers=1 --fileParallelism=false` -> 1 file, 11/11 pass.
- Same flags on `src/client-gateway/trace-replay` and `src/client-gateway/trace-matcher` -> 12 files, 62/62 pass.
- `pnpm --filter fluxiq check` -> exit 2, 10 TS errors, none in `client-gateway`. Files: `answer-first/attempt-store/tests/judge-checkpoint.test.ts` (3), `judge-issue.test.ts` (2), `runtime/llm/node-tools/replay/tests/observation.test.ts` (1), `runtime/result-verification/flow-less/tests/semantic-window.test.ts` (4).
- `node scripts/structure-audit.mjs` (Core) -> exit 1, 18 violations, none in `client-gateway`: imports in answer-first and result-verification, failure-as-empty, `file-lines` on `service.ts`, and statement-packing in those same tests.
- Both failures sit only in files from the synced Core dev that I did not touch (the answer-first and result-verification lanes). I did not fix them; they need their owners.
- `node scripts/build-cache/cli.mjs contracts:build sdk:build fluxiq:build client-gateway-websocket:build ui-components:build` -> exit 0 (fluxiq rebuilt in 172,489 ms, ui-components rebuilt, the rest reused).

**Replay v2** (`test-runs/t986-replay-company-v2`, a fresh copy of capture v2; its request deep-equals the bound entry):
- Command: `node scripts/lab/run-lab.mjs recorded-replay --input test-runs/t986-replay-company-v2/replay-input.json --out test-runs/t986-replay-company-v2/replay-report.json`.
- The session check now passes: `session.status: ran`, `sessionView: recorded`, `normalizations: []`, matcher 3/3 operations matched, no gaps.
- The first model request then diverged (`request_changed`, ordinal 1), with 0 replies served and 0 provider calls.

**Next cause, traced:**
- `recorded-replay` now keeps the first diverged request in an ignored file next to its report (`diverged-request.json`), written once and never sent. Changes: `product-runtime.ts` (`divergedRequestFile`) and `command.ts`.
- Replay v3 (`test-runs/t986-replay-company-v3`, fresh copy) diverged the same way with a different digest, so the content changes on every run.
- `company-diag/request-diff.mjs` and `request-key.mjs` print paths, types, lengths and masked shapes only. Exactly one difference: `messages[0].content[2].text`, the `core.run_node` result, key `value.read.commandId`, the same length but a different UUID.
- Why: the trace matcher translates recorded command ids to the replay's newly issued ids (`trace-matcher/matcher.ts` `feed.translate`), which the protocol needs. The domain's model-visible read showed the dispatch's `commandId`, so the model saw a run-specific random id. Core already treats `commandId` as a per-run key that is not a finding (`runtime/llm/decision-handlers/rerun-result.ts` `PER_RUN_KEYS`).

**Fix** (downstream domain, owned):
- `domain/src/runtime/llm-evidence/node-run/page-record.ts` adds `commandId` to the keys kept out of what the model is shown, next to `humanness`.
- The step files and the replay's recorded payload keep it.
- Tests: `tests/press-raw-read.test.ts` checks a press read carries no `commandId`, and a new test checks the same answer under two command ids shows identically.
- This is a small product change: live model evidence loses one meaningless field. No guard or comparison was weakened.

**Downstream checks:**
- Domain tests (`DOMAIN_TEST_BUILD_LABEL=t986-node-run node scripts/test-domain.mjs runtime/llm-evidence/node-run/tests runtime/offline-reads/tests`) -> 320/320 pass, including the new test.
- Domain check -> exit 0. Test-runner check -> exit 0.
- Downstream audit -> exit 0, "passed (258 warning(s), 551 baselined)".

**Fresh capture v3** (`node scripts/lab/run-lab.mjs recorded-capture company-website --task company-website-apprentices --evidence test-runs/t986-fresh-capture-company-v3`) -> exit 0, `complete: true`, `gaps: []`, `hostRefusal: null`, provider calls 0, external calls and cost null. Its recorded first request mentions `commandId` 0 times; v2's mentioned it once.

**Replay v4** (`test-runs/t986-replay-company-v4`, a fresh copy of capture v3; its request deep-equals the v3 bound entry):
- Command: `node scripts/lab/run-lab.mjs recorded-replay --input test-runs/t986-replay-company-v4/replay-input.json --out test-runs/t986-replay-company-v4/replay-report.json` -> exit 0.
- Entry and session: `position: before_entry`, so replay entered with exactly the bound entry. `session: ran`, `sessionView: recorded`, `normalizations: []`, matcher 3/3 operations, no gaps, no refused deliveries.
- Model stream:
  - Recorded request 1 matched byte-for-byte by digest, and its recorded reply was served (`logicalCalls: 1`, from the artifact; 0 provider calls, 0 USD, `historicalUsd: 0`).
  - The build then made request 2: `exhausted_stream` at ordinal 2.
  - That is the designed end of a fresh stopped bootstrap prefix. The capture records one native exchange, answers it with malformed bytes and stops, so the recording holds nothing after it.
- `buildStatus: prefix_diverged`, `fullAttemptAccepted: false`. The whole recorded prefix replayed deterministically with no provider call; nothing beyond the recording is claimed.

The coordinator's stop-before-replay message arrived after replay v4 had already finished, so it is reported here rather than withheld. After the lead merges the new dev (Core 0.53.0), rerun capture and replay on fresh outputs (`t986-fresh-capture-company-v4`, `t986-replay-company-v5`).

Not verified in round 4:
- A replay past one recorded exchange; that needs a longer capture, which is not this producer's scope.
- The two unowned Core users of the session-bound set.
- The full Core suites.
- The pre-existing Core check and audit failures.
- Live model behaviour after removing `commandId`.
