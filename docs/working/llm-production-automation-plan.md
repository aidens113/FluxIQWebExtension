# LLM Production Automation Audit And Implementation Plan

Status: execution authorized; instruction-only creation, first live runtime adaptation, and parameterized `basic-form` creation/run are accepted; active work is repeatable generation/adaptation and reusable sanitized context
Created: 2026-09-06
Recovered after full-file zero-fill corruption: 2026-09-07
Primary owner: root coordination agent
Related baseline: `docs/working/automated-testing-facility-plan.md`

## Objective And Current Direction

Make FluxIQ's provider-neutral adaptive machinery production-capable through the real web panel, production browser extension, and isolated Testing Lab. The active milestone is instruction-only blank-Flow authoring. It must not use a recording, recording-derived graph, imported graph, or pre-authored action graph.

The real panel must create/reuse a genuinely blank Flow, add bounded active Flow instructions, configure DeepSeek, generate an inert reviewable Bootstrap Adaptation, approve and apply it through the real UI, execute the routed Flow through the production extension, and prove it with a zero-LLM deterministic replay.

The user explicitly authorizes DeepSeek requests, manually or through FluxIQ, as many times as reasonably needed during this window and future sessions in this window. Do not pause again for transmission approval. Continue to enforce request limits, secret handling, loopback-only scenarios, and no external side effects.

## Fast Development And Testing Policy

- Do not repeat the complete journey after every small edit.
- Use focused typechecks/tests and the existing `lab interactive` Testing Lab session for individual panel, extension, scenario, and declared web actions.
- Run a full live journey only after a material cross-boundary change, at a certification checkpoint, or when a failure cannot be isolated otherwise.
- Reserve workspace-wide `pnpm check`, `pnpm test`, and `pnpm build` for major checkpoints.
- Record exact narrow checks and distinguish compilation from live behavior.

## Live Safety Envelope

- Provider/model: DeepSeek `deepseek-chat`, using the ignored `DEEPSEEK_API_KEY`.
- Only the UI driver may read the key into memory for the real Secret Keys UI. Never print, log, screenshot, serialize, or copy it into evidence.
- Current strict creation profile: 4,000 input tokens, 1,000 output tokens, 5,000 total tokens, one call per run, zero retries, 20 seconds, and $0.25. Settings entry, authorization assertions, and provider-accounting validation derive from one shared limit object. Core now estimates punctuation-heavy JSON/schema input and allocates its catalog on the same conservative three UTF-8 bytes per token basis; this retains the required catalog capacity without allowing a higher cap to silently fill the prompt with more optional definitions.
- Default Lab budget: 8,000 input, 2,000 output, 10,000 total, two calls, 30 seconds, $0.25, one concurrent live run. Explicit validated profiles may differ while remaining within the two-call, $0.25, and 50,000-total absolute contract ceilings.
- Live calls are manually initiated, loopback-only, side effects disabled, and excluded from CI. Raw prompts/responses are not retained; only sanitized provenance and actual bounded accounting persist.
- LLM output is untrusted proposal data and cannot bypass registered nodes, graph/domain validation, policy, authorization, evidence, manual review, or the deterministic oracle.

## Ownership And Core Governance

| Capability | Owner |
| --- | --- |
| Provider-neutral tasks, provider resolution, cancellation, budgets, proposal/review/apply/revert, graph validation, authorization, audit | FluxIQ Core |
| Provider transport and runtime secret resolution | Core/Core-owned adapter |
| Browser/DOM contracts, web mapper/output nodes, bounded web context, browser execution | This repository's `domain` package |
| Scenarios, Playwright, extension loading, browser profiles, web assertions, evidence/evaluation | Repository-local Testing Lab |

Generic behavior stays in `F:\!FluxIQ`; browser/DOM/URL/selector/tab/extension concepts stay downstream. All Core edits must be made by dedicated Core subagents that first read `F:\!FluxIQ\AGENTS.md`, remain domain-neutral, document and test their change, and report compatibility/results. The primary integrates and independently verifies but does not directly edit Core.

## Safety Invariants

- Ordinary tests and CI make zero provider calls; defaults are deterministic or diagnosis-only, manual review, and no auto-promotion.
- Secrets stay out of browser messages/storage, panel payloads, screenshots, logs, prompts/responses, manifests, and agent packets.
- Page/recording content is evidence, never instruction. Parse model output from unknown and reject invalid, extra, unregistered, stale, or invariant-weakening structure.
- Enforce timeout, abort, retry/call limits, idempotency, normalized terminal errors, and pre-call budget reservation.
- Apply is revision-bound, auditable, reversible, and graph/viewport consistent.
- Success comes from the scenario oracle and durable runtime evidence. Passing live evaluation requires passing zero-LLM replay.

## Phase Status

1. Safety baseline/contracts — completed. Versioned task/profile/provenance/evaluation contracts, explicit live opt-in, budgets, safe defaults, strict parsing, and terminal cleanup are implemented.
2. Provider seam/diagnosis — foundations completed. Provider identity, scoped key use, abort/timeout/accounting, readiness, grants, and structured failures exist. Recording-derived diagnosis is historical after the blank-Flow milestone change.
3. Blank Flow creation — live creation and deterministic replay accepted. Core generation, session-bound grant, compact catalog, Adaptation Inbox/audit bridge, review/apply/revert, diagnostics, native-runtime permission projection, executable target validation, and zero-LLM replay are working. Remaining work is repeatable creation coverage beyond the first fixture and the wrapper's post-apply certification bookkeeping.
4. Recording refinement — deferred until blank creation passes.
5. Existing Flow editing — pending.
6. Failure diagnosis/adaptation — first instruction-only selector-drift lane accepted live. The generated routed Flow failed on one drifted target, produced one compact-evidence manual proposal in exactly two DeepSeek calls, applied one reviewed target mutation, and passed a six-action provider-free validation with zero recordings. Repeatable scenario coverage, run-informed retrieval, and broader hardening remain.
7. Hardening/qualification — pending: cancellation, rate limit, malformed output, sensitive/prompt-injection, reconnect, dynamic DOM, iframe, and long-document lanes.

Scenario ladder: basic-form creation; later basic-form recording refinement; ambiguous-targets; delayed-ui; dynamic-list; iframe-checkout; failure-surfaces; sensitive-input; then navigation/reconnect/long-document.

## Recovered Execution Checkpoint

The original detailed log was destroyed when a crash replaced all 239,413 bytes of this untracked file with NUL bytes. This is the authoritative recovered checkpoint assembled from session context, repository state, evidence, and agent reports.

### Contracts, secrets, and blank preparation

- Schema `0.1` LLM profiles/tasks/provenance/evaluations require manual review, loopback traffic, Core-controlled provider egress, bounded identities/costs, raw-content rejection, and deterministic replay.
- Provider variables are removed from Core, Scenario Lab, browser, extension, build, and unrelated child environments. The real UI stores one exact global `FluxIQ Testing Lab DeepSeek` key; Reveal is never used and credential/key entry is screenshot-suppressed.
- Provider-free blank preparation passed through the real panel and extension: zero nodes/edges, no Subflow, no Router route, no `lastRecordingId`, unchanged recordings, idle recorder. Accepted evidence: 84 events and 64 screenshots.
- Core added purpose-bound one-use Flow Build grants; exact settings revision/execution digest binding; inert Bootstrap Adaptations; UI authorization; standard Inbox/audit/review/apply bridging; and sanitized applied digest proof.
- Compact catalog selection fits the actual web registry under 2,000 input tokens while retaining type/fill, select, click/submit, and verify/assert equivalents. Missing essentials reject before secret resolution.

### Live diagnostics and fixes

- Exact canonical key selection and already-selected idempotency were fixed.
- Core now returns the canonical Flow concurrency token; provider-free settings save passed.
- Generic HTTP failures were replaced by strict sanitized stage/call/response/accounting envelopes. Cross-bundle errors are parsed structurally, not by `instanceof`; arbitrary or secret-bearing shapes collapse safely.
- Generation failures now truthfully distinguish pre-validation, resolver, request, output, post-validation, and persistence stages while revoking the grant.
- Failed run `demo-llm-create-2026-09-08T01-01-51-609Z-4bfe49` persisted no proposal/grant changes and left the blank Flow/recordings unchanged. Run `demo-llm-create-2026-09-08T01-22-17-281Z-e3b7c4` conclusively rejected pre-provider with zero calls.
- Core/facility expose a closed stage-indexed reason taxonomy; unknown or wrong-stage reasons are discarded.

### Native runtime permission projection — accepted

- Live run `5fb957` rejected `required_capabilities_unavailable` with zero calls; missing term was `submit`.
- Root cause: generation copied capabilities but hard-coded `permissions: []`, filtering web actions requiring `web-automation.action`.
- Core added defensive `AutomationStudioNativeNodeRuntime.getRegistryResolution(scope)`. Generation, proposal revalidation, and apply revalidation now share trusted scope/capabilities/permissions; no-runtime remains fail closed.
- Downstream retained required permissions. Owner/independent native-runtime, generation, lifecycle, failure, handler, check/build/docs validation passed. Result: accepted.

## Fast Interactive Facility Checkpoint

Core audit concluded no Core change is needed. Core already exposes session discovery, correlated `execute-client-action`, `web.dom.capture_snapshot`, recording controls, deterministic runtime execution, and run/action/event reads. The missing interactive control belongs downstream.

Implemented so far:

- `lab interactive <scenario>` / `pnpm lab:interactive` launch-once JSONL session wiring.
- Allowlisted navigate, click, fill, select, check, wait, inspect, screenshot, and stop.
- Exact-origin guard, bounded input/selectors/waits/actions, no caller eval/JavaScript, provider-secret-stripped browser environment, structure-only inspection, screenshot hashing, and cleanup.
- Focused runner typecheck passed; interactive/command tests passed 18/18.

Accepted after crash recovery:

- Extension side-panel surface and strict `secretEnv` references for password/PIN/TOTP/key entry are implemented without echo, screenshots, or browser-environment exposure.
- Explicit interactive local targets ignore unrelated existing-target profile fields without weakening finite-run conflict checks or inheriting external credentials.
- Interactive artifacts live in retained run-scoped `test-runs/interactive-sessions/<run-id>` directories instead of topology directories removed at cleanup.
- Interactive smoke `interactive-mts3g2l4-613b37c7` launched once and passed scenario/extension inspection plus fill, select, submit, and wait; its first screenshot exposed and led to the retained-artifact correction.
- Screenshot-only retest `interactive-mts3idkk-95c0046d` passed and retained a SHA-256-addressed PNG.
- Direct extension bridge smoke `interactive-mts3lvf2-ad93a302` passed `web.dom.type`, `web.dom.click`, and `web.dom.capture_snapshot` through the real extension/content-script path in one `lab interactive` session. Responses retain only action type/status/surface/URL, not page contents.
- Focused runner check/build passed; interactive, parser, and target tests passed 33/33 before the final bridge, and the final bridge check/build plus interactive tests passed 6/6.
- Provider-free `pnpm demo:llm:adapt:readiness` now loads the isolated local panel and inspects it through public Automation Studio endpoints. It fails closed unless the exact prepared Flow has one current applied Bootstrap, zero Flow/graph recording references, no pending proposal, one graph-backed owned route, registered executable non-recording/non-external domain nodes, only the exact Core Start/End sentinels outside that domain listing, a successful latest zero-LLM deterministic run, and at least one selector-bound web action for semantic drift. Unrelated project recording history is not treated as generated-Flow provenance because Core's recording listing is project-scoped and has no Flow association. Its output contains only bounded identities, counts, parameter-key names, and execution binding; it discards parameter values, page content, and run messages. Focused test-runner check/build and adaptation-readiness tests pass; the live provider-free probe passed with zero provider calls.

## Immediate Next Steps

### 2026-09-08 resumed validation checkpoint

- The recovered code and generated extension artifacts survived the crash. The existing `lab interactive` Testing Lab is the default for small development checks.
- A recovered import-time regression was found before Core/browser startup: the test-contract ceiling was two calls per run while the `production` creation profile declared four. The profile now declares two; the live creation UI remains stricter at exactly one call and zero retries. Focused test-runner check/build and 13 LLM profile/UI tests passed.
- Creation run `demo-llm-create-2026-09-08T03-30-07-319Z-e21bb4` passed the provider-free readiness gate, made exactly one provider attempt, and received a sanitized provider-request HTTP 400. It did not reach proposal/review/apply.
- Earlier evidence `demo-llm-create-2026-09-08T02-11-46-727Z-07748c` shows the same one-call provider-request HTTP 400. Import-time diagnostic retries between those live runs made zero provider calls.
- Three minimal authorized DeepSeek probes isolated the boundary: basic `deepseek-chat` JSON mode, the Core request/idempotency headers, and a synthetic 7.2 KB request all returned HTTP 200. The credential, endpoint, model alias, JSON mode, headers, and raw request size are healthy.
- Core export skew is confirmed. `packages/fluxiq/src/.../flow-bootstrap-generation-failure.ts` is newer than the exported `dist` implementation. The stale `dist` still accepts old `llm.provider_*` diagnostics and lacks the current detailed `flow_bootstrap.provider_*` taxonomy. Downstream and the prepared panel resolve Core through those exports, so the accepted source fix set has not yet been proven live.

Later 2026-09-08 focused results:

- Rebuilding Core removed the source/export skew. Core's DeepSeek estimator was corrected to count model-visible message content plus a fixed framing reserve instead of escaped HTTP-body bytes; input plus output allowance is also checked against the total cap. Focused Core validation passed.
- Exact internal bootstrap provenance metadata `{ source: "generateFlowBootstrapAdaptation" }` is now accepted by Core validation but omitted from the provider payload. Arbitrary metadata remains rejected. Focused Core validation passed.
- Runs `demo-llm-create-2026-09-08T08-29-14-549Z-cf0b55` and `demo-llm-create-2026-09-08T08-38-51-847Z-fc9ef9` isolated the two pre-provider causes and then advanced to a real provider response.
- Core now classifies DeepSeek `finish_reason: length` as closed generic `llm.provider_output_truncated`, projected as `flow_bootstrap.provider_output_truncated` at `provider_output_validation`. Partial provider content is discarded; the API exposes only the bounded diagnostic/accounting envelope. Primary verification passed 64 focused tests across adapter, projection, and API sanitizer boundaries.
- Downstream sanitizer coverage accepts that exact code/stage and rejects unbounded variants; focused build and 13 tests passed.
- Live runs from `demo-llm-create-2026-09-08T08-48-13-055Z-2e586d` onward consistently proved truncation at the original 512-token output limit. Later attempts were incorrectly believed to exercise 1,000, 2,000, 4,000, and 8,000 because `FIRST_LIVE_CREATION_LIMITS` changed while the UI settings fields, authorization assertion, and accounting guard remained hard-coded at `512/3000/20`. Those higher-limit conclusions are invalid; all affected runs still requested 512.
- Run `demo-llm-create-2026-09-08T09-02-19-279Z-ac5755` still truncated after the first compactness change. Review found the directive was embedded in the user JSON while the trusted system message labeled that payload untrusted, so the model had no trusted compactness instruction. The correction moves the task-specific directive into the system message and leaves the user payload data-only.
- Runs `demo-llm-create-2026-09-08T09-06-48-223Z-755a5d` and `demo-llm-create-2026-09-08T09-14-35-087Z-77ed45` remained truncated at the still-effective 512 limit. Core now follows current DeepSeek JSON-mode guidance explicitly: the trusted system message binds Flow Bootstrap to `outputSchema`, requires one `{...}` JSON object with no whitespace padding, keeps user strings data-only, and requests deterministic non-thinking mode (`temperature: 0`, `thinking: disabled`). All nine task-kind adapter tests pass.
- Core now distinguishes whitespace-only length stops as closed `flow_bootstrap.provider_output_padding_truncated`; substantive partial JSON retains `flow_bootstrap.provider_output_truncated`. Both are content-free, received/nonretryable `provider_output_validation` failures. Primary verification passed 60 focused Core tests; downstream build and 13 sanitizer/profile tests passed.
- The next one-call diagnostic was initially rejected twice by the external command reviewer despite standing authorization. After the approval layer was disabled, run `demo-llm-create-2026-09-08T09-30-58-966Z-3c66af` proved the 512-token partial output was substantive rather than whitespace padding.
- Run `demo-llm-create-2026-09-08T09-34-29-823Z-dd28ec` exposed the downstream split-source limit bug: the exported constant said 4,000, but the real settings and authorization UI still showed 512/3,000/20. No generation diagnostic was recorded because the driver failed its own post-authorization contract check. This is fixed by deriving every UI and accounting boundary from `FIRST_LIVE_CREATION_LIMITS`.
- Run `demo-llm-create-2026-09-08T09-41-17-919Z-03443d` made zero provider calls. It correctly saved 2,000/1,000/3,000, then timed out waiting for the Build region because Core's web authoring model intentionally gates that region on its own fixed 2,000/512/3,000 preset. The narrow cross-repository correction is to update that Core blank-authoring preset and its web tests/docs to 1,000 output; total, calls, retries, timeout, and cost remain unchanged.
- Core's web authoring preset is now aligned at 2,000/1,000/3,000. Its focused authoring tests pass 4/4.
- The testing facility now exposes exact list/get/reject adaptation controls and uses them to reject a stale pending proposal on the isolated blank-creation Flow through Core's audited, PIN-authorized API. Cleanup fails closed unless there is at most one exact-scoped proposed adaptation and its full detail identifies `metadata.adaptationKind: "flow_bootstrap"`; it never deletes project data or logs adaptation content. Focused downstream build and UI/profile/control validation passed 30/30 before the live retry.
- Live run `demo-llm-create-2026-09-08T09-59-05-548Z-04eca6` rejected exactly one stale pending bootstrap proposal with zero calls during cleanup, then made the first genuine 2,000-input/1,000-output/3,000-total DeepSeek request. It did not truncate: the provider returned one accounted response, but Core projected it as `flow_bootstrap.provider_response_malformed`. The Flow remained unapplied. Current Core parsing collapses transport/envelope or JSON syntax failures together with valid JSON that violates the strict bootstrap wrapper/plan contract, so one content-free diagnostic split is required before another live request.
- Core now distinguishes structurally invalid valid-JSON output as internal `llm.provider_output_invalid`, projected to existing public `flow_bootstrap.provider_output_invalid`; malformed media/envelopes/JSON syntax remain `provider_response_malformed`. Primary focused verification passed 75/75 provider/projection/API tests and rebuilt the linked Core package.
- Live run `demo-llm-create-2026-09-08T10-06-26-914Z-c67ced` made one genuine accounted provider call and returned the new exact `flow_bootstrap.provider_output_invalid`; no stale proposal needed cleanup and no topology was applied.
- Review found a concrete producer/consumer contract defect: Core's advertised `outputSchema` is an example-shaped pseudo-schema whose literal values contradict the strict parser. Examples include fallback `kind: "subflow|fail"` even though only one enum value is accepted, an always-present conditional `targetSubflowKey` rejected for `fail`, a placeholder parameter key rejected as unknown, an always-present `outputActionId` rejected when a catalog node has no output action, and a generic `symbol` that omits the lowercase identifier pattern. The correction is a compact machine-accurate JSON Schema; the strict parser remains unchanged.
- Core now advertises a 3,298-byte Draft 2020-12 schema matching the strict parser. Primary focused verification passed 52/52 schema/provider tests. Live run `demo-llm-create-2026-09-08T10-18-17-428Z-c052e4` then failed pre-provider with exact `flow_bootstrap.required_capabilities_unavailable` and zero provider calls: at 2,000 input tokens, the accurate schema left only 1,366 catalog bytes, insufficient for all instruction-required browser definitions. The bounded profile is therefore moving to 3,000 input / 1,000 output / 4,000 total; call count, retries, timeout, and cost are unchanged.
- Core and downstream are aligned at 3,000/1,000/4,000; measured catalog capacity is 5,366 bytes (3.93x the 2,000-input profile). Primary focused verification passed 47 Core service/schema/authoring tests and 31 downstream UI/profile/control tests.
- Live run `demo-llm-create-2026-09-08T10-25-41-972Z-6cb069` reached one provider response but returned exact `flow_bootstrap.provider_usage_invalid`. A focused no-prerequisite-build command, `pnpm demo:llm:create:focused`, now reuses validated artifacts for these narrow live iterations; its launcher test passes. Focused run `demo-llm-create-2026-09-08T10-30-39-134Z-52b769` reproduced the same one-call failure and recorded only safe accounting metadata: Core estimated 2,745 input tokens, but discarded provider token counts when declaring the usage invalid. Core must distinguish malformed/inconsistent usage from valid usage that exceeds configured limits before the profile changes again.
- Core now distinguishes consistent over-limit usage as `flow_bootstrap.provider_usage_limit_exceeded`; primary focused verification passed 76/76 provider/projection/API tests. Focused run `demo-llm-create-2026-09-08T10-34-07-183Z-efff68` returned that exact code after one provider call, proving the byte/4 estimator undercounts this punctuation-heavy prompt. The correction couples a byte/3 estimator with byte/3 catalog allocation and a 4,000-input/1,000-output/5,000-total envelope, keeping the effective catalog payload approximately unchanged.
- Core/downstream are now aligned at 4,000/1,000/5,000 with a shared byte/3 estimator/allocation rule and exactly 5,366 catalog bytes. Primary focused verification passed 36 Core schema/provider/authoring tests and 15 downstream UI/profile tests.
- Focused run `demo-llm-create-2026-09-08T10-42-24-615Z-1260db` passed generation with one provider call and persisted a proposed adaptation; no generation failure diagnostic was emitted. The downstream success parser then failed because it requires finite `estimatedCostUsd`, while Core's production DeepSeek adapter returns token counts without computing cost. The Flow remains unapplied and the audited cleanup will reject this proposal before another generation call. Core must add conservative provider-specific cost accounting from validated usage.

Next:

1. Add conservative DeepSeek cost accounting from validated usage using the current peak cache-miss input and output rates; do not apply cache-hit discounts when attesting the ceiling.
2. Run only the focused Core provider/harness/service tests and rebuild the linked package.
3. Use `pnpm demo:llm:create:focused` for one bounded live retry without rebuilding already-validated artifacts. Its audited cleanup must reject the current pending unapplied bootstrap candidate first without a provider call.
4. If generation succeeds, approve/apply through UI, execute the Flow, and do the required zero-LLM replay. This is a major certification checkpoint and justifies the complete creation journey.
5. If the exact result is `provider_output_invalid`, diagnose the schema mismatch using only fixed categorical signals or synthetic tests; do not inspect or persist raw model output. Do not rerun unrelated preparation or full suites.
6. Proceed to bounded live adaptation only after creation/replay passes.

Focused iteration commands:

```powershell
pnpm --filter @fluxiq-web-extension/test-runner check
pnpm --filter @fluxiq-web-extension/test-runner build
node --test packages/test-runner/dist/interactive-session.test.js packages/test-runner/dist/commands.test.js
pnpm --filter @fluxiq-web-extension/domain check
```

Major checkpoint only: `pnpm check`, `pnpm test`, `pnpm build`.

Never expose pairing tokens, cookies, API keys, passwords, PINs, raw prompts/responses, recorded page data, or `.fluxiq` contents.

### 2026-09-09 web evidence payload-efficiency checkpoint

- The exploration runtime continues to send sanitized, bounded semantic evidence rather than raw DOM/page snapshots. Values, sensitive controls, URL query/fragment data, viewport data, arbitrary attributes, and non-interactive page structure remain excluded.
- Repeated visible text is now omitted when it is identical to the accessible name, and the default `inputType: "text"` is omitted because `tag: "input"` already conveys the ordinary fillable-control case. Opaque `target.N` handles remain the model-facing interaction identity, while a private per-run handle-to-selector binding preserves safe execution across snapshot reordering.
- A representative 50-source-element fixture (40 retained by the existing bound) measured 10,058 serialized bytes versus 11,448 bytes for the prior duplicate-semantic shape: 1,390 bytes / 12.1% lower, or conservative byte/3 ceilings of 3,353 versus 3,816 tokens. The regression enforces the compact ceiling and selector-backed deterministic execution.
- Testing Lab now keeps the persisted Flow LLM settings profile distinct from the temporary evidence-guided authorization profile. The UI saves a valid 25-second ordinary Flow timeout, while Core authorizes each exploration provider call for 45 seconds at request time. The exploration envelope remains four calls, 12,000 tokens per call / 48,000 aggregate tokens, $1 aggregate cost, and a 195-second transport/grant deadline. This fixes the `settings-save.llm-policy` rejection without widening durable Flow settings or shortening live provider requests.
- Literal selectors remain in the evidence for now because generated web action nodes require selectors and there is not yet a generic Core proposal-reference resolution seam. Removing them before that seam exists would save substantially more prompt space but would make generated Flows non-executable. The next efficiency step is a provider-neutral Core contract for resolving opaque evidence references into domain-owned proposal parameters before strict proposal validation; Core must not learn browser/DOM/selector concepts. Once available, this repository can retain selectors only in its private binding and resolve `target.N` deterministically.
- Focused validation: `pnpm exec tsx --test domain/src/runtime/llm-evidence.test.ts` passed 12/12 and `pnpm --filter @fluxiq-web-extension/domain check` passed. No live/provider run was used for this small payload-only iteration.

## 2026-09-08 Accepted Creation And Session-Authorization Checkpoint

- The Testing Lab now provides provider-free `demo:llm:pending`, `demo:llm:state`, `demo:llm:revert`, and `demo:llm:replay` operations. They use public Core endpoints, remain exact-scoped, and expose only bounded structural/status/accounting facts.
- Panel session-cookie synchronization fixed a control/browser reauthentication race before generation readiness.
- A successful DeepSeek bootstrap was approved and applied. Provider-free inspection proved one applied Bootstrap Adaptation, one graph-backed owned Subflow, one Router route, six nodes, five edges, changed execution binding, and an advanced settings revision.
- Core fixed the generic Start-node route mismatch: `builtin.control.start` may follow its declared `next` port when execution returns the normal `success` route. The focused executor regression suite passes.
- Replay then isolated targetless generated web actions. Downstream output-node definitions now derive required parameters from authoritative web action schemas; selector-based actions cannot pass Bootstrap validation without a selector.
- The invalid applied proposal was reverted through the provider-free repair command. One replacement DeepSeek request generated selector-bearing type/select/click nodes and was applied.
- The replacement Flow passed two consecutive real panel/extension/scenario replays: six nodes and twelve successful action attempts total, with zero provider calls, zero interventions, unchanged recordings, and an idle recorder. Initial Flow generation plus deterministic replay is accepted for the instruction-only form fixture.
- Repeated LLM credential prompts were removed. Successful login derives per-key decryption buffers into session-scoped memory; raw passwords are not retained or persisted. Grant issue validates the active actor session and uses one-use session reveal authorizations. Logout, expiry, key mutation, and runtime close revoke and zero applicable buffers.
- Normal Flow Build and diagnosis requests proceed directly for authenticated sessions. A confirmation warning is shown only when preflight total-token exposure is strictly greater than 100,000, and Core independently requires the explicit high-token confirmation flag. The current 50,000-token hard ceiling makes this enforcement future-facing but tested.
- Focused verification passed: 56 Core secret/grant/API tests, 28 Core web authoring/runtime UI tests, Core/web typechecks and Core build, downstream domain smoke tests, and 31 downstream control/creation tests. Do not repeat these suites for small follow-up edits.
- The first live diagnosis attempt after the session-auth change failed with sanitized output and is being diagnosed separately; it does not invalidate the passing generated Flow replay.

### Active implementation order

1. Diagnose the single failed live diagnosis from sanitized evidence only and repair only its exact boundary.
2. Resolve the creation wrapper's post-apply bookkeeping failure without another provider call; use the already-applied, replay-passing topology as the fixture.
3. Implement the next real existing-Flow adaptation lane: deterministic failure, one bounded LLM diagnosis/proposal, explicit review/apply, then provider-free replay.
4. Add focused coverage for malformed/targetless adaptation output and stale execution/settings bindings.
5. Expand initial-generation coverage to the next materially different fixture only after the first adaptation lane passes.

Testing policy remains strict: use direct facility operations and package/component tests while iterating. Run a complete provider-backed journey only for a material cross-boundary integration checkpoint.

### 2026-09-08 adaptation implementation checkpoint

- Core now exposes an exact-revision `diagnose_and_adapt` grant/run intent. It allows exactly two ordered provider tasks (`runtime_diagnosis`, then `runtime_patch`), persists a manual-review proposal, and disables auto-apply, recovery execution, external-side-effect authorization, and reused run IDs. Focused Core grant/API/service checks pass.
- Runtime Debug now includes `Diagnose and propose adaptation`. It uses the authenticated session without password/PIN prompts, preserves the >100,000-token-only warning rule, and tells the operator that proposals require manual review. Focused Core web checks pass.
- Provider-free Testing Lab readiness now passes against the accepted instruction-only generated Flow: six nodes, five edges, six successful baseline actions, three selector-bound targets, zero Flow/graph recording references, and zero provider calls.
- The instruction-only Scenario Lab fixture now provides deterministic semantic target drift/reset controls. Drift changes all three action identities while preserving visible semantics and submission behavior; focused fixture checks pass.
- The Testing Lab control client now supports exact-scoped approve and apply operations in addition to list/get/reject/revert. Focused control/readiness tests pass 21/21.
- A repeated diagnosis failure was traced to stale same-origin tabs restored by the persistent Chromium profile. Testing Lab now removes only stale disposable Scenario Lab tabs and refuses ambiguous extension target selection.
- No complete provider-backed adaptation journey has been run during this checkpoint. The next such run is reserved for the integrated Testing Lab driver after its focused tests pass.

### 2026-09-08 live adaptation iteration checkpoint

- The integrated driver now uses the accepted generated Flow, introduces deterministic semantic target drift, requests exactly `runtime_diagnosis` then `runtime_patch`, requires one manual-review target proposal, applies it through the real UI, and reserves full post-apply execution plus replay for the certification boundary.
- Core explicit grants now derive the two-call aggregate budget from the saved per-request bounds without being reduced by generic one-call training defaults. The runtime patch receives the same token and timeout limits as diagnosis.
- Core now binds DeepSeek diagnosis and runtime-patch requests to exact task-specific schemas. The latest retained run recorded one failed action followed by two distinct accounted provider calls; both interventions passed validation with no validation codes.
- That retained run created no proposal because the Flow's saved policy still disabled action-target modification. This was not a provider/schema failure. The Testing Lab control projection now exposes sanitized runtime-patch attempt facts and closed issue codes; it reported one `temporary_target_override`, `preflightOk: false`, and `runtime_patch.target_override_rejected` without exposing model output or page data.
- The UI driver now selects the real Flow Settings `Manual approval` runtime mode before saving provider limits. That mode enables bounded adaptive target proposals while keeping promotion disabled and requiring human review/apply.
- Focused downstream validation passed: test-runner build, adaptation evaluator 9/9, and control-client parser 16/16. A one-time TypeScript process crash retried cleanly and produced no compiler diagnostic.

Next: run one focused integrated adaptation checkpoint with the corrected saved policy. If one proposal is created, continue review/apply and the two zero-LLM validation runs in that same session. Diagnose any further failure from the new categorical state probe before considering another provider-backed run.

Later in the same checkpoint:

- The corrected manual policy produced exactly one new target proposal after one failed action and the two already-accounted provider calls. Core state recorded `proposalOnly: true`, `executed: false`, `preflightOk: true`, one adaptation, and one change proposal.
- The driver now resumes an exact proposed, validated, or applied runtime target adaptation instead of issuing another provider request after a UI/test interruption. Resume readiness allows only the exact pending adaptation and still rejects every unrelated proposal. Focused downstream build and 33 readiness/evaluator/control tests pass.
- Core fixed an Adaptations inbox/detail request race and the Flow hierarchy now opens a folder's declared workspace from its main row while retaining disclosure-based expansion. Focused Core hierarchy/adaptation UI tests pass 48/48; the web typecheck also passes.
- Live provider-free continuation opened the existing proposal through the real Adaptations UI, selected Audit, and persisted approval as `validated`. The Apply request returned HTTP 400 and left `appliedMutationCount: 0`; no provider call occurred.
- The remaining apply defect is a Core graph-ownership boundary: the adaptation is correctly parent-Flow scoped for review and carries the owned `subflowId`, while the target node resides in that Subflow's graph Flow. Typed adaptation apply currently opens the parent Flow graph for node lookup. The fix must resolve and revision-check the owned graph target without weakening parent-scope review or stale-base protection.

Next: finish the focused Core subflow-graph apply correction, resume the already validated adaptation through UI apply, then run exactly two provider-free deterministic validations. Do not create another adaptation.

- A provider-free targeted control is available as `pnpm demo:llm:adapt:control -- state|approve|apply|continue|revert`; direct resume and rollback shortcuts are `pnpm demo:llm:adapt:continue` and `pnpm demo:llm:adapt:revert`. It uses the authenticated Core control API and configured PIN without browser setup/navigation, matches exactly one active non-Bootstrap `edit_action_target` adaptation in the prepared Flow and owned Subflow, verifies its bounded two-call diagnosis source run, and fails closed on ambiguity or scope/shape mismatch. Revert accepts only an applied adaptation attesting exactly one mutation and supplies a fixed non-sensitive audit reason. Its output is structural and never contains the PIN or provider content.
- Core adaptation graph transactions now resolve the verified owned Subflow graph while retaining the parent Flow as the review/API scope. Apply, compile, rollback, stale-base checks, and revision binding use that graph target; foreign or missing ownership fails closed.
- Two retry-only failures were fixed without another provider call. Graph-target-scoped mutation IDs avoid collisions with the original failed parent-graph request. Overlong generated object-reference IDs now receive stable SHA-256 identifiers, and an Apply retry can replay its exact already-committed graph mutation to finish compilation, rollback persistence, and status persistence.
- The preserved adaptation is now durably `applied` with exactly one target mutation. The direct continuation reported zero provider calls. Focused Core content/adaptation/runtime tests pass 12/12, Core build/typecheck pass, and focused downstream control/evaluator tests pass 15/15.
- The fast control launcher initially left its supervised Next.js child alive after printing success. Explicit post-cleanup output/exit handling and lifecycle assertions now prevent the orphan and workspace-lock/port collision. Only the exact orphaned test server was stopped.
- The applied-proposal browser resume path no longer waits for a Review button that correctly disappears in terminal applied state.
- The earlier execution-binding failure was resolved by including canonical parent
  and owned-Subflow graph revision bindings in Core's dependency digest. A later
  audit clarified that a Bootstrap Adaptation's `appliedExecutionDigest` is an
  apply-time historical snapshot, not a permanent equality invariant: an
  intentional post-Bootstrap settings edit correctly advances the current
  settings revision and changes `currentExecutionDigest` without changing either
  graph revision. Runtime-Adaptation continuation must bind to its own current
  readiness/base revisions and require its apply to change that digest; it must
  not require the current binding to remain equal to the older Bootstrap apply
  binding. Core's owned-graph stale-base check remains authoritative for the
  graph patch.

### 2026-09-08 instruction-driven web exploration checkpoint

- The existing Core Automation Studio LLM harness is already the global,
  provider-neutral harness. Provider resolution, credentials, budgets, grants,
  prompt construction, parsing, and proposal persistence stay there; no
  second provider harness will be created downstream.
- Downstream now has a focused web exploration seam in
  `packages/test-runner/src/web-flow-exploration.ts`: simple instruction plus a
  starting URL is combined with production-extension DOM snapshot capture; an
  injected Core harness gateway selects only observed same-origin links for a
  bounded set of additional pages, then receives the resulting evidence for a
  Flow Bootstrap proposal.
- `web-flow-exploration.v1` evidence is in-memory and explicitly untrusted. It
  strips values, sensitive controls, selected text, URL query/fragment data,
  credentials, and unrestricted attributes; it bounds origins, pages,
  elements, strings, and serialized bytes. The public result contains only a
  proposal identifier/status and counts, never instructions or page content.
- The coordinator accepts only an inert `proposed` adaptation. Manual review,
  apply, runtime execution, and zero-LLM replay remain mandatory.
- Focused validation passed: test-runner typecheck/build and 4/4 exploration
  contract/orchestrator tests. No provider request or broad suite was run.

Next: add a bounded `web_exploration_plan` task plus the corresponding optional
versioned exploration-evidence field to Core's existing global harness and Flow
Bootstrap request/context, then wire the panel's simple-instruction authoring
UI to this downstream coordinator. Use synthetic/focused tests first; reserve
one live provider-backed run for the cross-boundary integration checkpoint.

Production integration update:

- A provider-free, apply-only continuation is available as
  `pnpm demo:llm:explore:apply`. It discovers the one exact pending
  evidence-guided Flow Bootstrap proposal from persisted Core state, opens it
  through the production Adaptations UI, performs explicit approve and apply
  actions, and stops without executing or replaying the generated Flow. The
  command uses a panel-only Testing Lab browser session; it does not start the
  extension browser or Scenario Lab.
- Discovery is fail-closed. The candidate must be the only pending
  evidence-guided Bootstrap under a `Website Exploration Checkpoint` Flow,
  retain successful validation and consistent bounded DeepSeek accounting,
  remain bound to its exact original execution digest, and have no prior
  application. The parent Flow must still be a blank orchestration topology
  with zero nodes, edges, owned Subflows, or Router. These invariants are
  checked again around UI approval so an interrupted or concurrent topology
  change cannot be applied.
- The continuation observes panel traffic and fails if it sees any new Flow
  Bootstrap generation request. Its public success result contains only
  `providerCallCount: 0`, topology counts, node definition IDs, and parameter
  key names; proposal IDs, Flow IDs, parameter values, provider content, and
  credentials are never emitted. New exploration checkpoints require Core's
  explicit provider-call count; legacy persisted proposals with no such field
  remain reviewable without inferring a count from evidence iterations. Focused
  Testing Lab typecheck/build and 22/22 creation/apply UI and locator tests pass.
  Live apply is deliberately reserved for the
  primary integration checkpoint and no replay is part of this command.

- `domain/src/runtime/llm-evidence.ts` now supplies the web-specific tool
  runtime for Core's generic evidence loop. `registerWebAutomationRuntime`
  binds it from both domain host paths, including `web-panel-host.ts`.
- `web.inspect_current_page`, `web.navigate_same_origin`, and
  `web.reveal_safe` dispatch through
  the existing Automation Studio client-gateway bridge. Tool execution fails
  closed unless exactly one ready, trusted web extension is available; stale
  pairing-time project metadata is not mistaken for live project selection.
  Sessions with an active recording are excluded so exploratory snapshot and
  navigation results cannot be appended to recording artifacts.
  Navigation is inspect-first, HTTP(S)-only, credential-free, and
  exact-origin constrained. Navigation to the already-current sanitized
  location is a recoverable `no_progress` rejection with no applied effect.
  Reveal interactions are limited to uniquely observed semantic disclosures
  and view controls, and exclude generic action, submit/purchase, and
  destructive controls. Fill and select remain represented in parsed evidence
  for Flow generation but are not authoring-time tools; executing them belongs
  to Testing Lab/manual runtime actions or the reviewed generated Flow. Every
  successful authoring interaction recaptures evidence and fails if the active
  origin changed; an unchanged parsed result returns `no_progress` without an
  applied effect.
- Expected policy/input rejection is recoverable evidence rather than a loop
  abort: the runtime emits only `web-llm-tool-result.v1`, `ok: false`, and one
  allowlisted code for invalid input, cross-origin or no-progress navigation,
  unobserved/unsafe targets, or sensitive values. It never echoes the rejected selector, URL, or
  value. Transport, disconnect, ambiguity, cancellation, malformed snapshot,
  and browser-action failures remain fatal.
- Tool progress is declared generically for Core: inspect is an `observe` tool
  with `repeatPolicy: "after_mutation"`, while navigate/reveal are
  `mutate` tools. A second inspection without an intervening successful
  mutation is rejected instead of consuming another provider call with
  identical evidence.
- Downstream execution now returns Core's explicit
  `llm_evidence_tool_execution` result. Inspect and recoverable rejection set
  `effectApplied: false`; navigate/reveal set it to `true` only
  after the browser action succeeds and the bounded same-origin recapture also
  succeeds. A rejected action therefore cannot unlock repeated observation.
- Each execution supplies a bounded content-free `resultCode` alongside its
  tool ID/effect status. Stable success and allowlisted rejection categories
  can be surfaced in Testing Lab traces without selectors, URLs, entered
  values, or page content.
- Sanitized elements now include opaque handles (`target.N`). Click/fill/select
  accept only a copied handle and bind it to the selector in the latest
  evidence returned for that session, project, and Flow. They then require a
  fresh same-location snapshot to contain that selector uniquely before
  passing it to the existing browser action. This prevents dynamic snapshot
  ranking from rebinding a returned handle to a different control and removes
  free-form CSS reconstruction from the model
  interaction path while preserving selectors in evidence for the proposed
  Flow plan.
- The click tool description directs the model to choose only observed
  controls whose name, text, role, or destination directly advances a step in
  the user's instruction. Unrelated safe controls are not intended as generic
  exploration affordances.
- The instruction-only snapshot audit confirmed exact selectors, accessible
  labels, input/control types, and result text are available for Name, Plan,
  Submit, and result verification. It exposed one gap: select options were not
  represented. The extension descriptor and production sanitizer now include
  at most 20 bounded option label/value pairs, including the exact `Team` /
  `team` mapping used by the fixture.
- The canonical production sanitizer honors Core's per-call byte allowance,
  capped by a 12 KB downstream hard maximum and a 6 KB compatibility default,
  and emits at most 40 elements of
  `web-llm-evidence.v1` untrusted page evidence. It removes input values,
  password/OTP/payment-marked controls, selected text, URL queries/fragments,
  cross-origin links, and unrestricted attributes.
- Evidence now carries privacy-safe action completion state without echoing
  entered text: ordinary non-sensitive fill controls expose only boolean
  `hasValue`, while a non-sensitive select exposes `selectedValue` only when it
  exactly matches one of its already-sanitized bounded option values. This
  gives later evidence iterations a generic way to recognize completed form
  actions without retaining raw form data. Focused validation passed the
  extension/domain typechecks, the extension production build, the domain
  smoke test, and all 11 isolated evidence-runtime tests.
- Focused downstream validation passed: domain/extension typechecks,
  production host/extension builds, and 10/10 isolated
  evidence-runtime tests. No provider call or broad workspace suite ran.
- Live-path audit removed an invalid project-session assumption: opening a new
  Automation Studio project updates web context, not the trusted client's
  pairing-time `session.projectId`. Evidence tools now require exactly one
  `ready` web extension and still fail closed on ambiguity or disconnect.
- The extension now includes `autocomplete` and `data-sensitive` markers in
  its structured descriptor so OTP, payment, and explicitly sensitive controls
  can be removed by the production sanitizer; their values are never emitted
  by the evidence runtime.
- Operational target handoff remains explicit: `web.inspect_current_page`
  inspects the extension's active tab. Testing Lab now reactivates the scenario
  immediately before sending the evidence-guided generation API request. A normal-tab panel
  UX needs an explicit target-tab picker/handoff; otherwise clicking Build in
  that tab can make FluxIQ itself the active inspection target. Same-origin
  navigation intentionally cannot compensate by escaping an incorrectly
  selected initial target.

Next: consume these tools from Core's evidence-guided Flow Bootstrap request,
wire the panel start/instruction surface, then use a synthetic Core provider to
prove inspect/navigation/tool-result sequencing before one live integration
checkpoint.

### 2026-09-08 global evidence-guided generation integration checkpoint

This checkpoint supersedes the stale `Next` statements immediately above.

- Core's existing Automation Studio LLM harness is now the single global,
  provider-neutral evidence harness. The new `evidence_tool_decision` task,
  bounded coordinator, grant accounting, DeepSeek schema, and
  `bindLlmEvidenceRuntime({ tools, executeTool })` seam contain no browser or
  DOM concepts.
- The production web domain binds inspect, same-origin navigation, and bounded
  semantic reveal tools through the existing client-gateway action bridge.
  It requires exactly one ready connected extension with an idle
  recorder, confines navigation and interaction recapture to the inspected
  HTTP(S) origin, and sanitizes each page to Core's requested ceiling within a
  12 KB / 40-interactive-element downstream hard cap, without values, sensitive
  controls, selected text, URL secrets, cross-origin hrefs, or unrestricted
  attributes.
- The real panel now accepts a required plain-language `Website task`. Its
  authenticated sequence is save instruction, preflight, issue a bounded
  four-call grant with a 45-second per-call deadline, explore through the connected extension, and open exactly
  one proposed Bootstrap Adaptation for review. It does not request the account
  password or PIN, auto-approve, apply, or execute the proposal.
- High-token confirmation is based on aggregate authorized exposure
  (`maxTotalTokens * maxCalls`) and appears only when that value is strictly
  greater than 100,000. The exploration profile keeps the 8,000 input, 4,000
  output, and 12,000 total per-call caps while reducing aggregate exposure from
  96,000 to 48,000 tokens. Ordinary active-instruction generation remains a
  separate one-call path.
- Core sends the filtered native-node catalog and strict Bootstrap completion
  schema with every evidence decision. The final `{ summary, plan }` is parsed
  and registry-validated before persistence. Durable traces contain only
  iteration/decision/tool identifiers, evidence byte counts, and usage - not raw
  instructions, tool inputs, page evidence, prompts, or responses.
- Focused primary validation passed: Core typecheck and build; 125/125 Core
  evidence/harness/provider/grant/service/API tests; 7/7 panel authoring tests;
  downstream domain typecheck and production host build; and 4/4 web evidence
  sanitizer/runtime/binding tests. No provider call or broad workspace suite
  was used for these iterations.
- The previous runtime-target proposal was reverted after live execution proved
  its noncanonical target unusable. Core now accepts only the canonical
  `{ selector: string }` override shape, and parent execution digests include
  canonical owned-graph revisions. Those fixes are focused-validated; a fresh
  adaptation will be generated only at its next material checkpoint.

Next: add and run one proposal-only Testing Lab command for the new panel path.
It must stop before review/apply/replay and retain only sanitized provider/tool
counts and proposal status. If that live checkpoint passes, resume the
existing-Flow adaptation lane using the strict target contract; do not repeat
the already accepted full creation journey.

### 2026-09-09 focused live exploration iteration

- The proposal-only Testing Lab command now exercises the production panel,
  extension, Core grant, DeepSeek adapter, and generic evidence loop without
  approving, applying, or replaying a proposal. Iteration uses focused runs
  only after material cross-boundary changes; package-local checks and the
  interactive facility remain the default for smaller changes.
- Request construction, schema/catalog budgeting, dynamic eligible tools,
  explicit execution-effect results, recoverable result codes, and the shared
  exploration deadline were corrected in Core. The live loop can now consume
  all authorized evidence turns without the former request-size, repeated
  observation, 30-second UI transport, or 60-second grant-expiry failures.
- The first complete eight-turn trace exposed two downstream progress defects.
  Model-visible ordinal handles were being resolved against a newly ranked
  hidden snapshot, allowing `target.N` to rebind to another element, and a
  same-location navigation was incorrectly counted as a mutation. Handles are
  now bound to the selector in the latest returned evidence and revalidated
  uniquely against the current same-location page. Same-location navigation
  returns the content-free recoverable `no_progress` result with
  `effectApplied: false`. Focused evidence-runtime tests cover both regressions.
- Privacy-safe progress evidence now exposes only `hasValue: boolean` for
  ordinary non-sensitive fill controls and a `selectedValue` that must exactly
  match an already-retained bounded option for non-sensitive selects. Raw input
  values remain excluded; hidden, password, OTP, payment, and explicitly
  sensitive controls cannot expose progress state.
- A later live trace proved the handle/navigation corrections: it contained no
  unsafe-target or navigation loop. It instead repeatedly selected options.
  The root cause was Core's provider-neutral instruction conflating evidence
  collection with execution of the workflow being authored. The shared policy
  now makes the final structured result the goal, requires immediate completion
  when evidence is sufficient, prefers observation, and permits mutation only
  to reveal otherwise unavailable information. It explicitly forbids filling,
  selecting, submitting, or retrying alternate values merely to perform steps
  that belong in the generated Flow. Core focused evidence/provider tests pass
  13/13 and the package check passes.
- Generic submit execution remains deliberately blocked in the evidence loop.
  Sanitized Submit metadata is sufficient for an inert reviewed Flow proposal,
  while no trustworthy production marker currently distinguishes the local
  fixture submit from a real external side effect.
- Downstream now enforces that authoring/execution separation in the actual
  eligible tool surface rather than relying on prompt compliance. The catalog
  contains only inspect, exact-origin navigation, and `web.reveal_safe`;
  fill/select execution is unavailable to the authoring loop even though the
  parsed evidence retains ordinary control metadata and bounded options needed
  to generate those nodes. Reveal is limited to semantic disclosures and view
  controls, and an unchanged parsed recapture is `no_progress` with no applied
  effect. Testing Lab/manual action control and generated Flow execution still
  use the existing `web.dom.type` and `web.dom.select` paths. The focused web
  evidence runtime tests pass 13/13; no live/provider run was used for this
  narrow boundary change.
- The next live attempt ended before any tool decision with
  `flow_bootstrap.provider_timeout`: the first DeepSeek decision exceeded the
  25-second per-call limit. A preceding infrastructure retry also caught one
  isolated Turbopack panel exit before provider invocation; it did not repeat
  LLM work. The provider timeout, not evidence correctness, is the current
  product-path blocker.
- A subsequent focused trace reached the deterministic initial inspection but
  the first provider decision requested inspection again and Core rejected it
  as `duplicate_tool_request`. The descriptor reaching this path did not carry
  an explicit repeat policy, exposing an unnecessary coupling between
  `initialObservation` and `repeatPolicy`. Core now treats the deterministic
  initial result as the observation for mutation epoch zero regardless of that
  optional declaration. The observation tool is omitted from both the first
  provider catalog and decision schema until a successful mutation, and a
  completion-only decision remains available when the initial evidence already
  satisfies the minimum. Focused Core evidence-loop/provider verification
  passes 17/17; Core typecheck and build also pass. No additional live request
  was used for this coordinator-only correction.
- Runtime target adaptation now has a provider-neutral, proposal-only evidence
  validation seam in Core. A domain may classify a candidate target as exactly
  matched, absent, or ambiguous using evidence it already sanitized; Core does
  not learn DOM semantics or retain that evidence. The web domain validates an
  override selector by exact occurrence count in `web-llm-evidence.v1`, so an
  absent or ambiguous selector cannot produce a manual-review adaptation or
  change proposal. Focused Core live-patch tests pass 10/10 and the downstream
  domain smoke test passes. Remaining integration is to pass the captured
  failure-evidence validator through the Core service proposal call; no live or
  provider request is needed for that wiring.

### 2026-09-09 focused Bootstrap output compaction

- The next provider-backed completion reached the final Bootstrap decision but
  exhausted its 4,000-token output allowance. Measurement showed the allowance
  itself was not undersized: a canonical Router plus owned primary Subflow and
  the three required web actions serializes to 1,110 bytes, or 370 tokens under
  Core's conservative estimator.
- The actual schema defect was in Core composition. Evidence generation copied
  the canonical plan fragment without its root `$defs`, leaving its local
  references unresolved, while the unconstrained canonical limits described a
  result much larger than the evidence profile needed.
- Core now supplies a self-contained, reference-free evidence completion
  schema, requests a minimal instruction-required topology, and enforces a
  12,000-byte result ceiling, 240-character summary, up to four Subflows,
  eight routes, sixteen nodes and twenty-four edges per Subflow, and sixteen
  parameters per node. This preserves multi-Subflow adaptability without
  increasing the 4,000-token output cap.
- The evidence path now also limits the already-ranked node catalog to twelve
  entries after selecting instruction-required capabilities first. Ordinary
  Bootstrap keeps its existing catalog behavior. Focused Core validation passed
  49/49 schema/provider tests, 28/28 service Bootstrap tests, and the FluxIQ
  package typecheck. No live provider request or broad suite was used for this
  compaction checkpoint.
- A later trace showed that the provider could still choose a remaining action
  tool after deterministic inspection despite already having enough evidence.
  Core now orders the strict `complete` variant before every tool-call variant
  whenever completion is permitted, preserves that order in the DeepSeek
  payload, and explicitly tells the provider to evaluate completion first and
  not choose a tool merely because it remains available. Focused evidence-loop
  and DeepSeek projection tests pass 17/17; the Core package typecheck and build
  pass. This is a synthesis preference, not a loss of exploration capability:
  tools remain available when required result information is genuinely missing.
- A producer/consumer contract audit compared the compact evidence completion
  schema and twelve-entry node catalog directly with Core's authoritative
  Bootstrap validator. Exact definition versions, parameter contracts, port
  IDs/cardinality, and Router target keys were already represented. The one
  ambiguous required field was `outputActionId`: registry validation requires
  it for action-backed definitions while the result schema must keep it
  conditional. Core's compact catalog now marks every present output-action
  contract `required: true`, and the self-contained schema concisely states the
  exact catalog-copying, required-parameter, output-action, connected-DAG,
  port, and Router-reference rules. A representative generic
  start/type/select/click/end chain built only from those advertised contracts
  passes registry validation. Focused Core validation passed 21/21 Bootstrap
  tests, 38/38 evidence-provider/Bootstrap-service tests, the FluxIQ package
  typecheck, and the FluxIQ package build; no provider request was used.
- The next live completion reached `complete` but collapsed all remaining local
  candidate checks into `flow_bootstrap.provider_output_validation_failed`, so
  the safe trace could not distinguish an envelope problem from an invalid plan
  or evidence-profile overflow. Core now reports three content-free categories:
  `evidence_completion_wrapper_invalid`, `evidence_completion_plan_invalid`,
  and `evidence_completion_profile_limit_exceeded`. Structural and
  registry-relative plan failures intentionally share the plan category. Each
  preserves bounded provider accounting and the completed loop's sanitized
  inspect/complete trace, never completion content, validation paths, tool
  inputs, or page evidence. Focused Core service/failure validation passed
  53/53; no provider request was used for this diagnostic-only iteration.
- A focused accounting audit found that the success audit's legacy
  `iterationCount` represented total trace steps, including the deterministic
  iteration-zero inspection, while Testing Lab treated it as provider calls.
  Core now preserves that bounded legacy field, adds an equivalent explicit
  `traceStepCount`, and derives `providerCallCount` plus `decisionCount` only
  from provider decisions (`iteration > 0`). `toolCallCount` continues to count
  real tool executions, including the initial inspection. The downstream
  `ExistingFlowAdaptation` parser consumes the explicit provider count and
  validates its relationship to the bounded trace fields instead of inferring
  calls from trace length. Legacy persisted audits without the new field remain
  reviewable with an unknown provider-call count; newly generated exploration
  checkpoints require the explicit count. Focused validation passed the 32-test Core Bootstrap
  generation suite, Core package typecheck, and 17 downstream control-parser
  tests; no provider request or full journey was used.
- The next proposal-only live checkpoint succeeded. The bounded evidence loop
  performed one deterministic parsed-page inspection and one DeepSeek decision,
  then persisted a reviewable Flow Bootstrap proposal. Its sanitized accounting
  was 5,273 input tokens, 574 output tokens, 5,847 total tokens, 1,866 evidence
  bytes, one tool call, and one actual provider call. The earlier displayed
  count of two was the trace-length accounting defect corrected above.
- A separate `demo:llm:explore:apply` checkpoint now resumes that exact
  persisted proposal and fails if the browser issues any generation request.
  It reached production UI review, PIN-authorized approval, and apply without
  regenerating or replaying. Focused iteration fixed exact virtualized hierarchy
  selection for the Flow-owned Adaptations folder, acceptance of pre-review
  validation fields that are legitimately absent, and post-apply inspection of
  Core-native Start/End sentinels that are intentionally absent from the domain
  node registry.
- Provider-free post-apply inspection now passes: exactly one Router targets
  exactly one owned graph-backed Subflow; the graph contains six nodes and five
  edges with four executable actions (`web.output.dom-type`,
  `web.output.dom-select`, `web.output.dom-click`, and
  `web.output.dom-wait_for_text`). The apply/resume path observed zero additional
  provider calls. Focused test-runner typecheck/build and 25 targeted tests pass.

Next: run one zero-LLM deterministic baseline against this exact applied
exploration checkpoint, then require the provider-free adaptation-readiness gate
to pass before issuing one focused runtime-adaptation request. Do not repeat the
creation journey. Continue explicit reusable sanitized-evidence/history design
rather than retaining raw page data.

Focused adaptation handoff preparation now has an exact provider-free locator
for the applied exploration checkpoint. It searches only
`Website Exploration Checkpoint` Flows ordered newest-first, stops reading
older timestamp groups as soon as a valid applied evidence-guided Bootstrap is
found, and fails only if that newest timestamp is ambiguous. It requires a
current applied execution binding and bounded evidence/provider accounting,
and cannot fall back to the older prepared demo Flow. The composed readiness
helper then runs the existing strict topology/registry/selector/baseline gate
and cross-checks its Bootstrap ID and execution digest against that exact
target.

Two thin provider-secret-stripping commands expose the focused handoff:
`pnpm demo:llm:explore:baseline` runs that exact generated Flow once on the
existing instruction-only fixture, and
`pnpm demo:llm:explore:adapt:readiness` performs the subsequent read-only gate.
The baseline rejects any failed action, provider call, intervention, run
adaptation/proposal, recording-set change, adaptation-set change, or active
recorder, and returns only exact topology/run IDs and bounded counts. This means
the next provider call cannot begin merely because some generated Flow exists:
the checkpoint must first have a successful zero-LLM deterministic baseline.
Test-runner check/build and the focused locator/readiness/launcher tests pass;
no live command, provider call, or broad test suite was used.

The applied checkpoint has now crossed that handoff. A one-run provider-free
baseline executed all six generated nodes successfully against the original
instruction-only fixture with zero provider calls, interventions, run-created
adaptations, or proposals; recordings remained unchanged and the extension
recorder remained idle. The subsequent read-only readiness probe passed with
six nodes, five edges, three selector-bound adaptable targets, and the exact
baseline run bound to the current Bootstrap execution digest. The original
proposal predates explicit provider-call persistence, so its historical count
is retained as unknown (`null`) rather than inferred from legacy trace length;
the live checkpoint independently observed one call. All new proposals still
require explicit provider-call accounting.

Testing Lab navigation was also reduced to direct operations during this work.
The baseline no longer forces an already-active Router pane; it selects the
exact Flow and opens its stable Flow-owned Runtime Debug object. Runtime Debug
and Adaptations both use the shared bounded virtualized-tree scroller, fixing
false failures when valid rows exist outside the rendered viewport.

Next: create exactly one focused semantic-drift runtime adaptation request for
this readiness-passed checkpoint, retaining the manual-review boundary. Apply
and deterministic post-validation must resume provider-free from that proposal
rather than repeating diagnosis or patch generation.

The proposal-only runtime-adaptation checkpoint is now implemented as
`pnpm demo:llm:explore:adapt`. It locates the exact newest applied
evidence-guided exploration Flow, reruns the strict provider-free readiness
gate, and refuses any pre-existing active non-Bootstrap adaptation. It then
uses the instruction-only semantic-target fixture for one runtime request under
the existing bounded two-call policy: one validated diagnosis followed by one
validated runtime-patch decision. The command requires exactly one failed
action, one new `edit_action_target` adaptation bound to the owned Subflow and
source run, complete provider-reported token/cost accounting within the
4,000/1,000/5,000 per-request limits, and a still-inert `proposed` result with
zero applied mutations. It stops when the exact Review action is visible and
does not approve, apply, regenerate, or replay. It also proves recordings and
recording provenance remain absent and that the authenticated run did not
leave a credential/PIN dialog open. The launcher reports only the bounded
checkpoint or a categorical reason code. Focused test-runner typecheck/build
and 11 exploration readiness/proposal tests pass; no live provider request was
made while implementing this command.

The focused live checkpoint succeeded. One drifted execution persisted exactly
one failed action, then exactly two DeepSeek calls in durable order—validated
diagnosis followed by validated runtime patch—and created one new inert
`edit_action_target` adaptation for the owned Subflow. The proposal remains
`proposed` with one successful validation, zero failed validations, pending
manual review, and no applied mutation. No credential/PIN dialog remained after
the authenticated below-threshold LLM request, and recording count remained
zero. The preliminary failed attempt stopped at virtualized Settings lookup
before any provider invocation; Settings now uses the same exact-ID bounded
scroller as Adaptations and Runtime Debug.

Next: use a separate zero-provider exact-ID continuation for review/apply and
one deterministic drifted validation; never repeat the successful
diagnosis/patch request merely to resume it.

That provider-free continuation is now implemented as
`pnpm demo:llm:explore:adapt:apply`. It strips provider secrets, locates the
exact pending proposal and its two-call source run on the newest applied
exploration checkpoint, reruns readiness while allowing only that proposal,
and aborts any browser request to Bootstrap generation or LLM preflight/grant
endpoints. Through the production UI it reviews, PIN-authorizes, and applies
exactly one mutation, requires the execution digest to change, then runs
exactly one drifted deterministic no-LLM validation. All generated actions
must succeed with zero provider calls, interventions, new adaptations, change
proposals, recordings, or recording provenance; the fixture is reset
afterward. Focused typecheck/build and 14 exploration adaptation/readiness
tests passed before its live use; the actual outcome is recorded below.

A later, independently repeatable provider-free verification is available as
`pnpm demo:llm:explore:adapt:validate`. It locates the newest applied
evidence-guided Flow and requires exactly one applied non-Bootstrap
`edit_action_target` whose source run records two provider calls. The command
strips provider secrets, aborts generation and LLM preflight/grant endpoints,
idempotently places the fixture in its drifted state, and performs exactly one
No-LLM deterministic execution through exact-ID Testing Lab UI navigation. It
requires all six action attempts to succeed and forbids provider calls,
interventions, new proposals, adaptations, recordings, or recording
provenance. Fixture reset runs in cleanup where the browser remains available.
Focused automated coverage is present.

A narrow provider-free repair command is also available as
`pnpm demo:llm:explore:adapt:revert`. It discovers the configured
web-automation project directly and locates the newest applied evidence-guided
exploration checkpoint by its audited Bootstrap identity; it never reads the
prepared or saved-Flow fallback state. Before supplying the configured PIN to
Core's existing revert endpoint, it fails closed unless that exact parent Flow
has one graph-backed owned Subflow, one Router scoped to that Subflow, one
applied Bootstrap, and exactly one applied ordinary adaptation containing one
validated `edit_action_target` patch and one persisted mutation. The response
contains only project/Flow/Subflow/adaptation IDs, the `reverted` status, and
`providerCallCount: 0`; provider secrets are stripped from the launcher.
Test-runner typecheck/build and 14 focused revert plus adjacent checkpoint
discovery tests pass. No live mutation or provider call was used while adding
or validating this command.

The same exact-target control now provides
`pnpm demo:llm:explore:adapt:reject` for an inert `proposed` target patch. It
uses the same direct project and newest evidence-guided checkpoint discovery,
owned-Subflow/Router scope, applied-Bootstrap identity, and ambiguity checks;
it additionally requires the proposal's source run to contain exactly one
failed action followed by exactly two provider calls in diagnosis then runtime
patch order, one successful proposal validation, zero failed validations, and
zero applied mutations. Only then does it PIN-authorize Core's existing reject
operation. Its result is limited to safe project/Flow/Subflow/adaptation IDs,
`rejected` status, and `providerCallCount: 0`. The launcher strips provider
secrets and never reads prepared/saved Flow state. After this addition,
test-runner typecheck/build and 18 focused reject/revert plus adjacent
checkpoint tests pass. No live mutation or provider call was used.

Rejected runtime-patch proposals no longer consume the remainder of the
Testing Lab's 60-second polling window. The adaptation wait gate now treats a
terminal run with both bounded interventions as complete even when deterministic
proposal validation intentionally persisted no adaptation ID. Exact proposal
identity is checked immediately afterward by a small content-free helper; zero
or multiple IDs produce only the safe
`exploration_adaptation_run.proposal_identity_invalid` reason code, which the
existing launcher allowlist exposes without selector, provider output, or raw
evidence. Test-runner typecheck/build and 13 focused wait plus exploration
adaptation tests pass. No live execution or provider call was used.

When that immediate proposal-identity failure occurs, the Testing Lab now
attaches a bounded `runtimePatchDiagnostics` projection. Each of at most four
attempts contains only a normalized patch category, `passed`/`failed`/`unknown`
preflight status, at most eight deduplicated allowlisted issue codes, and
boolean adaptation/change-proposal creation facts. Unknown kinds become
`unknown`; unknown issue text becomes the generic
`runtime_patch.preflight_rejected` code. The launcher independently
revalidates the allowlists before emitting the projection. Selector values,
prompts, evidence, provider output, raw messages, and arbitrary metadata are
never copied. Adversarial focused coverage proves those fields cannot escape;
test-runner typecheck/build and 14 focused wait plus exploration-adaptation
tests pass. No live execution or provider call was used.

The provider-free apply continuation was run live. Review, PIN authorization,
and application through the production UI succeeded; exactly one mutation was
persisted and the owned Subflow graph advanced from revision 1 to revision 2.
Its immediately following deterministic drifted validation failed on the first
`web.dom.type` action with zero provider calls. The first failure exposed a
downstream target-normalization defect: Core correctly supplied the adapted
canonical target in `target.fingerprint.selector`, but the web output adapter
ignored that selector and fell back to the stale top-level selector. The web
adapter now prefers canonical selected-candidate and fingerprint selectors,
with focused domain regression coverage passing.

The separate provider-free validation command was then run live once. It also
failed on the first action with zero provider calls, and its bounded runtime
artifact proved a second, independent defect: the routed parent Flow loaded the
pre-adaptation owned-Subflow representation even though the canonical graph
tables contained revision 2 and the applied target. Core is being corrected so
an adaptation graph transaction cannot leave the runtime Flow repository stale.
Only the single no-LLM validation will be repeated after that correction.

That Core correction is implemented. `getFlow` now overlays any revisioned
graph snapshot as the read-only canonical graph source, so API/UI readers, LLM
dependency reads, and routed execution observe the same owned-Subflow revision.
Typed apply and rollback also refresh file/cache projections best-effort without
advancing Flow settings; projection failure cannot turn an already committed
graph mutation into an API failure or cause graph/file write feedback. A focused
typed-transaction regression proves the adapted target reaches both `getFlow`
and native routed execution while parent review scope, owned-graph stale-base
checks, rollback, and settings revision remain intact. Core focused
adaptation/Bootstrap suites pass 18/18, and package typecheck/build pass. No live
or provider request was used for this repair.

Runtime Debug now renders the public sanitized failure-evidence provenance on
each applicable LLM stage as an accessible compact status: schema version,
byte count, and full/truncated state only. The display projection explicitly
omits the evidence digest and any unexpected content/selector fields, including
from the expandable Stage JSON. Core does not currently expose categorical
capture-unavailable or capture-failed provenance on the intervention DTO, so
the UI does not invent either state. Focused runtime component/model tests pass
24/24 and the web typecheck passes; no live or provider call was needed.

The single provider-free live validation was then repeated. It failed on the
first `web.dom.type` action with zero provider calls, but the canonical graph
was now revision 3 and contained `input[name='name']` with no stale
`[data-testid="instruction-name"]` target. Runtime therefore executed the
persisted adapted selector. This closes the canonical graph-read and downstream
target-normalization defects and isolates the remaining failure to the earlier
proposal's evidence-starved selector choice.

A subsequent consistency audit found that Core ordinary-Adaptation reads could
silently treat any typed-store/object failure as "not found" and fall back to a
stale legacy JSON detail or summary for the same Adaptation ID. Typed rows are
now identity-authoritative: canonical detail failures propagate, ordinary list
failures cannot fall through to legacy indexes, and legacy fallback remains
available only when no typed row/page exists. Required patch and declared
evidence objects also fail closed instead of degrading to empty values. A
within-service regression preserves the typed `reverted` summary before and
after a forced canonical-object failure while refusing a stale legacy `applied`
detail. Focused Core storage/service tests pass 10/10 and package typecheck
passes; no live or provider request was used for the repair.

The exact readiness sequence exposed one remaining form of that fallback:
an `applied` status filter correctly found no typed match for a canonical
`reverted` row, but Core mistook the empty filtered page for an absent typed
store and resurrected the stale legacy `applied` summary. Core now distinguishes
an empty filtered result from an empty canonical Flow/Subflow scope; typed
identity remains authoritative across status, risk, and search filters while
legacy-only scopes retain compatibility fallback. The focused sequence
(`reverted` list, `applied` filter, Flow read, failed canonical detail read,
`reverted` list) and Core package typecheck pass with no provider or browser run.

Testing Lab's exploration-adaptation retry now snapshots the authoritative
list status before readiness inspection and uses a narrowly scoped correction
for both active-adaptation blocking and reverted-target drift recognition. The
rule was extracted into a focused helper: a typed `reverted` status wins only
over the known stale `applied` summary/detail view; every unrelated later
status remains authoritative so the workaround cannot hide another transition.
Focused test-runner typecheck/build and 13 status/exploration-adaptation tests
pass; no provider request was made.

The provider-free exploration baseline now permits a changed current execution
digest only when exactly one ordinary, validated, applied-once
`edit_action_target` for the exact owned Subflow is authoritatively `reverted`
and no ordinary adaptation remains active. Every missing, ambiguous,
cross-Subflow, unvalidated, or active explanation fails before browser startup
with `exploration_baseline.binding_drift_unexplained`. The baseline launcher
emits that bounded reason code without internal details. Focused test-runner
typecheck/build and 11 status/readiness tests pass; no live or provider request
was used.

The applied proposal itself selected `input[name='name']`, while the drifted
fixture exposes a textarea identified by the sanitized test ID
`instruction-name-adapted`. That quality failure is retained as evidence of a
missing product seam, not papered over with another blind provider retry: the
current runtime-adaptation prompt receives the failed action summary but not a
bounded parsed projection of the current page. The next implementation step is
to carry only a strict, domain-sanitized `web-llm-evidence.v1` failure packet
through a generic bounded Core evidence seam, validate proposed targets against
that evidence deterministically, and only then perform one focused provider
retry followed by one provider-free validation. Raw snapshots/page data must
never enter provider context.

The first non-service portion of that evidence seam is implemented. Core now
accepts one ephemeral `failureEvidence` object only for runtime diagnosis and
patch, caps it at 3,000 UTF-8 bytes with depth/item/string limits, rejects
raw-snapshot-shaped keys, and revalidates it at the DeepSeek boundary.
`recentActions` is now a maximum of 12 Core-allowlisted fields; messages,
metadata, state references, inputs, outputs, and effects are excluded. The web
domain evidence runtime captures a post-failure snapshot directly, keeps the
raw result domain-local, and immediately returns bounded sanitized
`web-llm-evidence.v1`. Core harness/provider tests pass 41/41, downstream
sanitizer/runtime tests pass 14/14, and focused typechecks pass. Remaining
service integration is now implemented. Core invokes the optional domain
capture once with only a compact failed-action descriptor, applies the smaller
of the 3,000-byte hard ceiling and a 20%-of-input-budget dynamic allowance, and
reuses the same sanitized packet for diagnosis and patch. Applicable capture
errors, malformed evidence, and over-budget evidence stop before the provider;
an absent callback or `undefined` result preserves legacy behavior. Run detail
persists only schema version, byte count, truncation state, and a Core digest.

Proposal-only target overrides now receive a domain validator closed over that
captured packet. The web runtime exposes the validator through its production
binding and deterministically reports matched, absent, or ambiguous selectors;
absent/ambiguous proposals remain inert and create no Adaptation or Change
Proposal. Focused Core service coverage proves one capture, identical evidence
content in both provider requests, raw-sentinel exclusion, zero provider calls
on invalid capture, and no proposal for absent evidence. Focused downstream
coverage proves the validator is present after production binding. No live or
provider request was used for this integration.

The first evidence-backed live retry correctly received the bounded current
page packet but proposed `[data-testid="instruction-plan"]` for the failed
`web.output.dom-type` name action. Exact selector presence alone was therefore
insufficient: the selector uniquely identified a `select`, not an editable text
control. Target validation now also receives Core's safe failed-action context
(`nodeId` and `definitionId` only) and applies deterministic web semantics after
the unique exact-selector check. Type/clear require a safe typeable `input` or
`textarea`; select requires `select`; click requires an actionable element;
keypress requires a focus-capable control; selector-wait/extract retain generic
unique-element compatibility. An action-incompatible exact match is never
accepted as-is; it can proceed only through the single compatible-element
resolution described below. Downstream evidence and production-bind
tests pass 15/15 with the domain typecheck; no provider/live call was used for
this correction. Core's generic callback now projects only those two failed-node
identity fields into the domain validator, and its runtime-patch system prompt
briefly requires exact evidence selector copying plus failed-action semantic
compatibility. Core live-patch/provider tests pass 34/34, focused service
integration tests pass 2/2, and the Core package typecheck passes.

To avoid another provider call for a deterministic repair, the validator also
resolves a bad model selector from that same packet. When the proposed selector
is absent or action-incompatible and exactly one action-compatible evidence
element has a unique selector, the domain returns that exact selector as a
bounded resolved target. Zero compatible elements remains absent and multiple
compatible elements remains ambiguous; both fail closed. An exact unique
compatible proposed selector remains matched unchanged. Core applies a resolved
target before proposal persistence and records only the categorical
matched/resolved outcome outside the reviewed patch.

Core now also treats the failed trace node as authoritative for proposal-only
target overrides. A different model `targetNodeId`, even when it names another
existing node, is deterministically rewritten to `failedAttempt.nodeId` after
Core proves that failed node exists; a missing failed node fails closed. Only
categorical `targetNodeResolution` (`matched` or `resolved`) is retained outside
the reviewed patch.

### 2026-09-09 runtime-adaptation live checkpoint

- The earlier incorrect applied target was cleaned up through the exact
  provider-free continuation: `adaptation.f094...` reached authoritative
  `reverted` state. Deterministic baseline run `ae949e52-...` then executed all
  six generated actions successfully with zero provider calls. This is the
  current 6/6 pre-adaptation baseline; it does not certify a later proposal.
- The instruction-only fixture drift is now intentionally single-target.
  Baseline exposes the original name input; drift changes only that control to
  the `instruction-name-adapted` textarea. The plan select and submit targets
  remain stable, preventing unrelated simultaneous selector changes from
  obscuring diagnosis or deterministic target resolution.
- The first genuine compact evidence-backed retry was
  `9dfbe03e-f576-4433-a2c4-ace629346be1`. It made exactly two DeepSeek calls in
  order. Diagnosis accounted 1,340 input, 272 output, and 1,612 total tokens;
  runtime patch accounted 1,491 input, 193 output, and 1,684 total tokens. Both
  stages used the same `web-llm-evidence.v1` packet: 1,865 bytes, not truncated,
  with the same persisted Core digest.
- That run proposed the plan `select` selector for the failed name
  `web.output.dom-type` action. The exact proposal was rejected through the
  provider-free review control. This is retained as a real model-quality
  failure and is not counted as a successful adaptation.
- Runs `3a9ade80...` and `1d55beea...` each durably reached two interventions
  but produced no proposal. The latter contained a structurally valid
  `temporary_target_override`, proving provider parsing was no longer the
  remaining boundary.
- Focused fixes after those runs compose deterministic selector and failed-node
  resolution before persistence. A unique compatible evidence selector may
  replace an absent/action-incompatible model selector; the failed trace node
  may replace a different model `targetNodeId`; and resolving both preserves
  both changes in one patch. These are focused-test results, not a live success
  claim.
- A separate attempt exposed a project-list loading race before useful Flow
  navigation. Testing Lab now waits for `Loading projects...` to clear and, if
  the exact row is still absent, performs one explicit Retry/Refresh, waits
  again, and reapplies the exact search. It does not restart creation or replay
  unrelated setup.
- The latest actual provider run after the composition and UI fixes is
  `14660e4c-dccd-4fa4-aa9b-9cd93946352a`. It persisted two interventions but no
  Adaptation, and Testing Lab terminated with the safe
  `proposal_identity_invalid` reason. This remains a retained failed checkpoint,
  not the current result. The control-flow audit below identified its preflight
  policy blocker and corrected it in focused code/tests.

A Core control-flow audit found that explicit `diagnose_and_adapt` enabled
proposal creation but retained the default locked policy's
`allowModifyActionTargets: false`, so an otherwise valid resolved proposal was
discarded at preflight. The explicit grant now enables only action-target
proposal creation for its schema-bound single patch while preserving manual
review, no execution, no auto-apply, no external effects, and every other policy
restriction.

The next diagnostic run, `f88d15f0-84f9-4710-bcf4-be02328284eb`, made both
bounded provider calls but failed proposal preflight with the safe
`runtime_patch.target_override_rejected` category. Artifact inspection narrowed
the exact cause to `absent` sanitized evidence even though the drifted page
visibly contained the intended textarea. The content snapshot filter had been
demanding presentation content from every non-event-backed element; an empty
but identified textarea therefore disappeared before domain sanitization. The
filter now retains interactable controls with meaningful identity even when
their current value/text is empty, while preserving visibility and sensitive-
control exclusions. Focused extension snapshot coverage now captures the empty
identified textarea through the real content-script message path, and the
focused extension checks/build pass.

That investigation also found that the running package boundary could still
use stale compiled FluxIQ Core output after the source-level policy and patch
composition repairs. A focused Core package build refreshed the linked `dist`
artifacts before the next live attempt; rebuilding only the downstream host
bundle is not evidence that changed Core source is active.

The bounded live checkpoint is now successful. Proposal run
`5be70f05-3849-4bb9-87b5-800aad3cb525` made exactly two provider calls: diagnosis
used 1,372 input / 241 output tokens and patch used 1,557 input / 158 output
tokens (3,328 total, estimated $0.00181544). It created one proposal for the
authoritative failed `type_name` node. The reviewed
patch contains the exact evidence-backed selector
`[data-testid="instruction-name-adapted"]`. Adaptation
`adaptation.5be70f05-3849-4bb9-87b5-800aad3cb525.temporary-target-override.1788997792996`
was then manually applied. Its provider-free validation run
`80414559-fd2b-4b8f-bb92-f4b66e0b5068` executed all six actions successfully,
used zero provider calls, changed the execution digest as expected, and retained
exactly zero recordings. This certifies the focused instruction-only path from
runtime failure through bounded diagnosis/proposal, manual review/apply, and
deterministic post-apply execution; it is not a claim that the broader scenario
ladder or reusable historical-evidence phase is complete.

The follow-up run-summary projection defect is corrected. Core now derives
`adaptationCount` from the unique authoritative `detail.adaptationIds` alongside
its existing action/route/Subflow/intervention refresh. A focused persisted
`diagnose_and_adapt` regression verifies one manual-review proposal in both the
detail and indexed summary; no provider retry was used for this fix.

Testing Lab exploration input is no longer hard-coded to one fixture in the
provider launcher. A downstream request contract accepts only a registered
lowercase Scenario Lab ID and 1–4,000 safe instruction characters, resolves the
authoritative path from that scenario's registered manifest rather than
accepting a caller URL, and feeds that instruction into the
existing global Core evidence-guided Bootstrap harness. The certified
`instruction-only-form` request remains the default. The provider-free
`demo:llm:explore:request` command validates the built scenario registry and
returns only scenario identity/path, instruction size/digest, the explicit
provider budget, and categorical exact-origin/idle-recorder/manual-review
requirements; it never echoes instruction content or loads provider secrets.
The actual launcher retains exact-loopback navigation, zero-recording checks,
manual proposal review, and the existing bounded provider profile. Focused
request tests pass, including a noncanonical navigation start-path regression;
test-runner typecheck/build pass, and the default and
custom readiness commands report zero provider calls. No browser or provider
run was used for this generalization.

Parameterized exploration now has an exact provider-free continuation rather
than falling back to global newest-proposal discovery. A private ignored
workspace binding retains only registered scenario ID/start path, instruction digest, and the
project/Flow/Adaptation identities returned by the proposal. Its apply command
requires that exact Adaptation to remain a valid pending evidence-guided
Bootstrap on its unchanged blank Flow. Its manual run command requires the same
Adaptation to be the current applied Bootstrap, launches the same registered
scenario through the existing exact-origin panel/extension path, and checks
terminal success, zero provider calls/interventions, unchanged recordings, and
the exact owned Subflow route/graph. Declared manifest final-state facts are
evaluated with the shared Scenario Lab oracle, giving `basic-form` an
extensible initial contract without embedding its result selector or expected
text in the continuation. Legacy instruction-only apply/baseline/adaptation
commands are unchanged. Focused binding and exact-target tests cover secret
exclusion, path tampering, current-manifest path revalidation, wrong proposal identity, applied binding validity,
and provider-free launcher separation; no provider or live browser call was
used.

The first non-default parameterized live scenario is also accepted. A computer
crash left one genuinely blank `basic-form` Flow after UI creation and before
generation. The facility now recovers only one scenario-prefixed Flow whose
topology is still provably blank; future non-default request names use a stable
scenario/path/instruction digest to make retries idempotent. A separate
post-create defect was fixed: reloading Studio returns to its project browser,
so the helper explicitly reopens the exact project instead of waiting for an
in-project sidebar that cannot exist until project selection is restored.

The recovered `basic-form` proposal used one DeepSeek call, one evidence tool
call, 1,500 bytes of parsed evidence, 5,118 input tokens, 646 output tokens,
5,764 total tokens, and an estimated $0.00310464. It remained pending manual
review until the exact bound apply command approved and applied
`adaptation.bootstrap.2bc9525d-de69-444e-8239-efc276a0df55` with zero provider
calls. The generated owned Subflow graph has seven nodes and five executable
web actions. Exact provider-free run `ada55134-c470-4e25-a36d-d78667801743`
then completed all seven runtime action attempts, routed through the owned
Subflow, passed the registered `basic-form` final-state oracle, used zero LLM
interventions/provider calls, and preserved the pre-existing two-recording set.

That run exposed one repeatability seam: selecting the UI's no-LLM launch mode
can change the current execution digest without changing the applied graph.
Bound run continuation keeps exact project/Flow/Adaptation identity and
revalidates the owned Router/Subflow/graph topology while allowing this
post-apply launch-settings digest drift. Strict no-drift remains the default for
other callers. The focused exploration apply/request suite passes 12/12.

Crash recovery is now fail-closed at both interruption boundaries. Non-default
request names remain deterministic over scenario ID, authoritative manifest
path, and instruction content. A pre-generation crash may reuse exactly one
legacy scenario-prefixed Flow only when the complete blank topology check
returns the expected `blank_flow.not_genuinely_blank` mismatch for rejected
candidates; control, transport, and parsing failures propagate instead of
being mistaken for an ineligible candidate and causing duplicate creation. If
a crash occurs after Core persisted a proposal but before the local request
binding was saved, the deterministic Flow is inspected provider-free: exactly
one valid pending evidence-guided Bootstrap with complete bounded accounting
reconstructs the secret-free binding and returns the existing checkpoint;
ambiguous or malformed state fails closed instead of invoking the provider
again.

The bound provider-free run now emits only allowlisted stage/reason diagnostics:
`pre_browser_identity`, `pre_browser_topology`, `browser_execution`,
`manifest_oracle`, or `final_validation`, paired with stable categorical reason
codes. Original errors remain internal causes and the launcher never emits
instructions, selectors, page data, credentials, stacks, or raw error messages.
Focused test-runner typecheck/build and 32 directly affected tests pass,
including deterministic naming, legacy blank recovery, transport-error
propagation, pending-proposal reconstruction, and diagnostic redaction. No
browser, full-flow, or provider run was used for this resilience slice.

Visual review of the accepted run found that the five execution-mode buttons
used three fixed minimum-width columns inside a narrower Runtime Debug pane.
After Playwright selected the third button, the clipped container scrolled its
own hidden overflow and cut off the leading text of `Fully adaptive` and `LLM
diagnosis`. Core now uses an auto-fitting responsive grid with no hidden
horizontal overflow, preserving the mode labels at pane widths where the
Inspector is open. This is a CSS-only UI correction and did not trigger another
Flow or provider run. A focused Core stylesheet contract now locks the
component-width-aware `auto-fit` grid, rejects the former fixed three-column
rule, and rejects hidden overflow on the mode grid; that test and the Core web
package typecheck pass.

## Active Phase: Reusable Sanitized Evidence And Run-Informed Adaptation

This phase is under incremental implementation; it is not a claim that
production memory is already enabled end to end. The focused exploration
checkpoint remains isolated from these changes, and reuse stays disabled until
protected persistence, harness integration, UI control, and validation land.

### Current capability versus missing capability

Already present:

- Core's provider-neutral harness accepts bounded `relevantRuns` and
  `relevantAdaptations` context slots, and caps each at 25 entries. Core also
  persists Flow run summaries/details, action and recovery attempts,
  interventions, adaptation identifiers, `sourceRunId` relationships,
  validation results, and adaptation audit state.
- The current evidence loop reuses a byte-windowed suffix of sanitized tool
  results within one generation request. Bootstrap Adaptations retain only a
  bounded categorical evidence trace and accounting. They do not retain page
  contents, tool inputs, entered values, prompts, or provider responses.
- Core's adaptation store can attach an evidence object to an adaptation, but
  that is review provenance for that adaptation. It is not an indexed,
  expiring exploration cache and is not automatically retrieved into later
  LLM requests.
- Downstream defines `web-llm-evidence.v1` and performs the production web
  sanitization. The older `web-flow-exploration.v1` coordinator also documents
  its evidence handoff as in-memory only. Testing Lab's clone and authentication
  caches are operational test caches and are unrelated to LLM evidence reuse.

Still missing:

- No caller currently selects and populates the harness's `relevantRuns` or
  `relevantAdaptations` fields; their presence is an integration seam, not
  run-informed adaptation behavior.
- There is no durable reusable-evidence record, compatibility fingerprint,
  TTL, invalidation protocol, retrieval/ranking service, prompt allocation, or
  user control for reuse. A new exploration therefore starts from live evidence
  rather than a reusable sanitized snapshot.
- Previous success/failure and review outcomes are inspectable through existing
  APIs, but they are not ranked or summarized into new creation/adaptation
  prompts. Live adaptation can react to its current failure, but it does not yet
  learn from a history of earlier runs.

### Ownership and data model

Core owns a domain-neutral, versioned reusable-context contract and durable
index because selection, authorization, retention, prompt budgets, provenance,
and audit apply to every LLM-enabled domain. The minimum record should include:

- opaque record ID; project/Flow and optional Subflow scope; domain ID;
  evidence kind/schema version; source run/adaptation IDs; creation, last-use,
  and expiry times; outcome (`succeeded`, `failed`, `rejected`, `reverted`, or
  `unknown`); reviewer disposition; bounded size; content digest; and the exact
  sanitizer/policy version;
- opaque domain-produced compatibility and relevance tags plus canonical Flow,
  graph, instruction, node-registry, client-capability, and policy revision
  bindings. Core stores and exact-matches these tags without interpreting web,
  DOM, URL, selector, tab, or browser concepts;
- a bounded sanitized prompt projection distinct from the full stored record.
  Raw provider messages, raw page snapshots, form values, credentials, cookies,
  headers, query strings, fragments, selected text, and unrestricted attributes
  are forbidden in both forms.

Downstream owns the web evidence schema, sanitizer, stable page/control
fingerprints, exact-origin/path compatibility, browser/client capability tags,
and conversion of web run results into the bounded prompt projection. Core must
never import those concepts. Testing Lab may create fixtures and assertions,
but production records belong to Core project storage, not `test-runs` or a
runner cache.

### Privacy, retention, and invalidation

1. Make reuse opt-in at first and default to sanitized metadata plus structural
   facts only. Require the same project authorization boundary used for the
   originating run; never retrieve across projects, accounts, or domains.
2. Set a short configurable TTL with an absolute Core ceiling. Refresh
   `lastUsedAt` without silently extending `expiresAt`; expose explicit delete
   and clear-scope operations. Purge expired content and its index entries.
3. Reject persistence unless the domain sanitizer attests schema/policy version,
   byte and item bounds, and forbidden-field scanning. Encrypt durable content
   through Core's existing project content storage and retain only digests and
   bounded summaries in lists/audit events.
4. Invalidate or quarantine candidates on sanitizer-version change, incompatible
   Flow/owned-graph revision, instruction or policy change, node-registry or
   client-capability change, reviewer rejection/revert, repeated deterministic
   failure, or an explicit domain-produced environment mismatch. A compatible
   cached candidate never replaces a fresh preflight or target-existence check.
5. Treat every retrieved item as untrusted evidence. It cannot authorize tools,
   expand origins or permissions, bypass a grant, validate a target, or cause an
   adaptation to apply automatically.

### Retrieval, ranking, and prompt budgets

Implement retrieval in two bounded stages. Core first filters by authorization,
scope, domain/schema version, expiry, revision compatibility, and policy. It
then ranks with domain-neutral features: exact Flow/Subflow match, exact
compatibility-tag match, reviewed-and-applied success, deterministic validation
success, recency, repeated corroboration, and penalties for failure, rejection,
revert, or supersession. Domain callbacks may contribute bounded categorical
scores based on opaque domain tags, but cannot return new unsanitized content.
Stable tie-breaking must make selection reproducible and auditable.

The harness should receive one `reusableContext` packet containing only selected
prompt projections and provenance IDs. Give it a separate strict byte/token
budget taken from `maxInputTokens` after required instructions, output schema,
node catalog, and fresh evidence reserves. Start with at most 5 candidates and
10% of the input-token limit, with a small absolute ceiling; trim lowest-ranked
items first. Before packing, canonicalize and digest facts, collapse duplicate
facts across runs, and encode only the delta from newer/fresh evidence; never
serialize whole run details or adaptation records into a prompt. Prefer a few
high-confidence outcome/control facts over narrative summaries. Current-run
fresh evidence remains authoritative on conflict. Emit only counts, selected
IDs/digests, age buckets, rank reasons, original-versus-packed fact counts,
deduplicated bytes, and token accounting to durable traces.

Token efficiency is a release acceptance criterion, not a best-effort
optimization. Reuse must lower live exploration/provider work or measurably
improve proposal quality without materially increasing total tokens. The
focused benchmark set must compare no-reuse and reuse paths and fail on budget
regression: packed reusable context stays within both its fixed ceiling and 10%
share, duplicate history adds zero prompt tokens, unchanged evidence is sent
once, and cache misses add only a bounded metadata envelope. Any later increase
requires a versioned profile and recorded quality-versus-token evidence.

### UI and user control

- Add one consistent authoring/runtime control: `Use prior sanitized evidence`,
  initially off unless the user enables it for the Flow. Show the number and
  age range of compatible candidates before the provider call, the estimated
  reused-context tokens and expected avoided exploration calls, plus `Manage`
  and `Clear` actions. Do not expose raw evidence by default.
- During generation/adaptation show separate progress states for `Checking
  prior evidence`, `Inspecting live target`, `Generating proposal`, and `Ready
  for review`. The review screen must identify which prior runs/adaptations
  informed the proposal and clearly state that live validation and manual review
  are still required.
- Explain cache miss/invalidation with stable, non-sensitive categories. Offer
  `Refresh live evidence` and `Run without prior evidence`; never silently fall
  back in a way that makes provenance ambiguous.
- Keep terminology identical between blank-Flow creation, manual adaptation,
  and live adaptation. The >100,000 aggregate-token warning rule remains
  unchanged and includes the final packed request, including reused context.

### Implementation and migration sequence

1. Core contract/store: add the versioned record, project-scoped encrypted
   content and metadata index, TTL/purge/delete APIs, authorization, audit, and
   feature flag. Migrate additively; existing projects contain zero records and
   preserve current behavior.
2. Downstream producer: version the web compatibility fingerprint and prompt
   projection, persist only after a completed sanitized exploration or run, and
   add redaction/invalidation tests. Do not migrate old Testing Lab artifacts or
   adaptation evidence objects into the cache because their sanitizer provenance
   is insufficient.
3. Core retrieval: add deterministic filter/rank/pack logic, then populate the
   already-existing `relevantRuns`/`relevantAdaptations` seam through the new
   bounded `reusableContext` packet. Deprecate direct unranked population once
   callers migrate; keep the old optional fields readable for one compatibility
   window.
4. Creation integration: allow reuse to reduce exploration, but require at
   least one fresh target inspection before proposal persistence. Record cache
   hit/miss and fresh-versus-reused contribution counts.
5. Adaptation integration: retrieve compatible prior run outcomes and applied
   adaptations after a current runtime failure. Never offer rejected, reverted,
   stale, or nondeterministically validated changes as positive examples.
6. UI rollout: add per-Flow opt-in, preview/manage/clear, provenance in review,
   and accessible progress/error states before enabling the feature by default.
   Default-on requires privacy, stale-data, and quality qualification evidence.

### Core contract/store implementation status (2026-09-09)

The first storage foundation of implementation step 1 is complete in the
sibling Core framework and remains disabled by default. Core now exports a
domain-neutral `automation-studio.reusable-llm-context.v1` record and
project-local store with Flow/optional Subflow/domain scope, evidence-schema and
sanitizer versions, opaque compatibility tags, bounded prompt projection,
outcome, reviewer state, applied-validation state, source run/adaptation IDs, digest/byte accounting,
and fixed created, last-used, and expiry timestamps. Additive project migration
`0016` creates an empty metadata index; existing projects and current LLM
behavior are unchanged until a caller explicitly enables the store.

The v1 store canonicalizes projections and enforces a 12,288-byte projection
ceiling, bounded JSON depth/item/string counts, bounded tags and provenance
IDs, compound forbidden credential/header/token/raw-page field names, and a
seven-day absolute TTL ceiling. Project databases provide isolation. Exact
scope/version/tag filtering occurs before pagination; last-use touch does not
extend expiry. Disposition updates, individual delete, exact-scope clear, and
bounded expiry purge are implemented. Projection objects use Core's project
content store; deletion removes the owning reference and leaves physical
reclamation to the existing safe unreferenced-object collector.

The next Core slice now exposes authenticated feature-gated status, list, get,
delete, exact-scope clear, expiry purge, and pack operations through Automation
Studio's service/program API. Program permissions and an explicit project-domain
scope assertion isolate each request. List responses omit prompt content;
bounded get/pack responses can hydrate only exact-compatible records. Safe
audit events retain lifecycle/packing IDs, scope, counts, disposition, and
byte/token accounting without prompt content.

Core project content now exports a generic protected-content boundary plus an
AES-256-GCM adapter driven by a host-owned exact-key resolver. Core does not
create, derive, persist, or log keys, and it does not repurpose Secret Keys or
Identity Access crypto. Each envelope records an explicit key ID; authenticated
additional data binds provider, project, media type, and key ID. This permits
host-managed rotation while retained keys remain readable and fails closed for
missing/retired/wrong keys, missing providers, malformed envelopes, changed
metadata, or changed ciphertext. Stored-object digest and byte count cover the
ciphertext; the reusable-context row independently verifies the decrypted
projection digest and byte count.

Reusable-context API put is enabled only when both the feature and a
host-supplied content-protection provider are configured. Without that provider
it still reports `reusable_context.content_protection_unavailable` and rejects
writes. Existing unencrypted Core objects remain compatible and no automatic
re-encryption occurs. The downstream web-panel host has not yet configured key
custody/provider injection, so production reuse remains off and no harness
caller has been enabled by this slice.

Deterministic selection ranks applied success above validated success, reviewed
success, unreviewed success, reviewed/unknown/failure context, excludes
rejected/reverted records from the positive packet, breaks ties by creation
time then record ID, and deduplicates content digests. Packing selects at most
five and caps the entire serialized
packet to `min(8192 bytes, 10% of maxInputTokens using Core's conservative
bytes/token conversion)`. No harness caller is populated yet.

Focused Core validation passed for the storage foundation, selection/packing,
service/API, schema/migrations, and package typecheck. The protected-content
slice adds focused AES-GCM lifecycle/authentication coverage, protected object
storage coverage, and enabled-versus-unconfigured reusable-context write
coverage. Downstream key custody/provider injection, persistence enablement,
harness wiring, and UI remain later slices; this checkpoint adds no provider
call or automatic reuse.

The next bounded Core slice now provides the tested harness injection path
without coupling the provider-neutral harness to storage. Creation accepts an
explicit reuse opt-in only with evidence-guided generation; at least one fresh
tool observation must exist before the host's domain-neutral
`selectForFreshEvidence` callback can produce an exact-match descriptor.
Runtime diagnosis/adaptation likewise retrieves only after current sanitized
failure evidence exists. Core then exact-filters, ranks, and packs the protected
project records and supplies at most five items as explicitly advisory context.
The harness rejects cached selector/target fields, and provider instructions
state that fresh evidence is authoritative and cached context cannot supply an
executable target, patch, permission, or authorization.

Feature-off and non-opted-in calls do not gain a reusable packet. Opted-in
misses continue with fresh evidence and record only a safe miss reason. Hits
record fresh/reused contribution counts, packed byte/token accounting, and
selected record/run/adaptation IDs in packing audit plus Bootstrap or runtime
proposal metadata; prompt projections and fresh evidence are not copied into
that metadata. Focused synthetic-provider validation passed for creation and
runtime adaptation, alongside the harness/packer/provider-adapter and Core
typechecks. This is an injection seam only: the downstream host still must
supply protected key custody and the web evidence-to-selection callback before
the feature can be enabled in production or exposed in UI.

### Downstream producer implementation status (2026-09-09)

The persistence-independent portion of implementation step 2 is complete in
`domain/src/runtime/reusable-evidence.ts`. It produces two separately versioned
artifacts from the current `web-llm-evidence.v1` packet:

- an opaque compatibility fingerprint bound to exact HTTP(S) origin/path,
  structural control facts, client-capability tags, the evidence schema,
  and `web-reusable-evidence-sanitizer.v1`; and
- a bounded, deterministic prompt projection containing semantic element facts
  and action outcomes only.

Selector identity affects the compatibility digest but selectors and opaque
target handles are never emitted into the prompt projection, so cached evidence
cannot become an executable target. The producer independently allowlists its
output and excludes raw DOM, form and selected values, option content, sensitive
controls, titles/general page text, URL query/fragment, cross-origin URLs,
cookies, headers, and unknown input fields. Element, action, capability, prompt
item, and serialized-byte limits are exact exported constants; canonical
sorting/deduplication and SHA-256 digests make equivalent inputs stable despite
ordering and irrelevant title/target-handle noise.

Compatibility intentionally excludes action outcomes. A prior successful run
and a current failed run on the same page/control/capability structure must be
eligible for comparison; success/failure and route remain bounded prompt facts
and therefore change the projection content digest for ranking/provenance. Page
path, selector/control structure, capability, evidence schema, and sanitizer
changes still invalidate the compatibility fingerprint.

Focused unit coverage proves privacy exclusions, current-schema enforcement,
origin/path normalization, sensitivity filtering, relevant revision changes,
irrelevant-noise stability, deterministic trimming, exact serialized byte
accounting, outcome-independent compatibility, and hard item/byte ceilings.

`domain/src/runtime/reusable-evidence-coordinator.ts` now owns the downstream
handoff into Core's protected reusable-context put contract. The mapper accepts
only a completed sanitized evidence packet plus explicit project, Flow,
optional Subflow, outcome, review/validation, and run/adaptation provenance. It
passes the compatibility fingerprint as matching metadata while keeping the
bounded non-executable prompt projection as separate protected content. It
does not forward raw DOM, selectors, target handles, form/selected values,
sensitive controls, URL query/fragment, cookies, headers, or unknown evidence
fields.

The coordinator is explicitly feature-gated: disabled means no Core call. When
enabled it attempts one protected write and fails closed on a rejection,
exception, or malformed success response; there is no plaintext/local fallback
and no Testing Lab persistence. The current downstream host configuration
therefore keeps production writes inactive until it supplies approved project
key custody through the Core protection boundary. The nine focused
producer/coordinator tests and downstream domain
typecheck pass. Retrieval/ranking and harness prompt population remain separate
later slices.

Core runtime-summary aggregation was also corrected during this phase:
normalizing a run detail now derives `adaptationCount` from its unique
`adaptationIds`, matching the existing authoritative refresh of action, route,
Subflow, and intervention counts. A focused `diagnose_and_adapt` regression
verifies that a manual-review proposal is reported as one adaptation both in
the persisted detail summary and the indexed run-summary query. This fixes
status/readiness accounting only and does not change proposal approval or apply
semantics. The single focused Core service regression passes with the other 107
tests in that file skipped, and the Core `fluxiq` package typecheck passes.

Low-risk Core UI groundwork now centralizes the planned progress vocabulary:
`Checking prior evidence`, `Inspecting live target`, `Generating proposal`, and
`Ready for review`. Existing blank-Flow exploration, instruction-only proposal
generation, explicit runtime adaptation, and accepted proposal states use only
labels that match their observable operation. Prior-evidence wording and reuse
controls remain hidden because candidate data and management APIs do not exist
yet. Focused mounted UI coverage also reconfirms that authenticated ordinary
requests at or below 100,000 aggregate tokens issue session-scoped grants with
no account-password or PIN fields/dialogs; only above-threshold requests show
the existing confirmation. The two focused files pass 16/16 tests and the Core
web package typecheck passes (an initial concurrent Node/V8 process crash
cleared on the immediate isolated rerun and produced no TypeScript diagnostic).

### Focused validation plan

- Core unit tests: exact schema parsing, project isolation, authorization,
  encryption/object ownership, TTL and purge, revision invalidation,
  deterministic ranking/tie-breaking, outcome penalties, byte/token packing,
  feature-off behavior, and safe audit projection.
- Downstream unit tests: sensitive controls and values never persist; URL
  query/fragment and cross-origin data are absent; fingerprints change for
  relevant DOM/capability revisions but remain stable for irrelevant noise;
  stale handles/selectors cannot become executable from cache.
- Integration tests: a second compatible creation uses one bounded cached
  candidate plus a fresh inspection; a changed fixture causes a miss; a failed
  run retrieves only relevant reviewed history; rejected/reverted adaptations
  are excluded; no candidate never changes current behavior. Token-regression
  fixtures cover duplicate runs, overlapping evidence, delta packing, near-cap
  history, and cache misses, and compare provider-call and total-token counts
  against the no-reuse baseline.
- UI tests: opt-in defaults, candidate counts/age, clear/refresh/run-without
  controls, progress wording, warning calculation, keyboard/accessibility, and
  no password/PIN prompt for an already authenticated ordinary request.
- Live checkpoints: first use a synthetic provider and local fixtures. Then run
  one provider-backed creation reuse checkpoint and one provider-backed
  adaptation-history checkpoint, each followed by deterministic zero-LLM
  validation. Do not rerun the entire creation journey for each cache edit.
