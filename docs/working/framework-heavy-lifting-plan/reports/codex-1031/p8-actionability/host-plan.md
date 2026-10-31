# t827 host propagation/interface plan

Outcome: Done for interface discovery and proposed ownership; implementation awaits lead release.

## Interface ready to freeze with Browser

Actual owner: `domain/src/actions/types.ts:563`, `WebAutomationActionResult<TElement, TSnapshot>`. `apps/extension/src/shared/protocol.ts:609` already aliases this as `BrowserActionResult = WebAutomationActionResult<DomElementDescriptor, DomSnapshot>`. There is no second BrowserCommandResult declaration to create.

Add the following optional property to the authoritative domain result, using a type-only import from the frozen pure `fluxiq/automation-studio/actionability` entry:

```ts
actionability?: AutomationStudioTargetActionabilityRecord | undefined;
```

Browser-owned `ActionResultEvidence` in `content/action-runtime/results.ts` carries `actionability?: BrowserActionResult["actionability"]` and its existing `buildResult` explicitly projects it. Browser measurement owners supply only actual current measurements; snapshots, skipped already-in-state success, and unmeasured successes supply none. Browser keeps its geometry/detail local and preserves original auth/person/policy failure promotion and effect facts.

Domain-owned `client/gateway-mapping.ts` `webAutomationActionResultPayload` writes a strictly parsed fresh `actionability` into the existing payload. `client/browser-result-mapping.ts` already forwards that payload builder; its gateway top-level construction needs no source change. No client-gateway result top-level member, receipt field, schema change or negotiation is added.

Frozen union/reader:

```ts
type AutomationStudioTargetActionabilityRecord =
  | { actionable: true }
  | { actionable: false; cause: "hidden" | "disabled" | "covered" };
parseAutomationStudioTargetActionabilityRecord(value: unknown): AutomationStudioTargetActionabilityRecord | undefined;
```

Do not extend or mirror this type locally. Absence/malformed means unknown; a negative is not evidence of unacted/transient and cannot authorize another committing act.

## Verified loss map

| Owner | Current behavior | Proposed smallest change |
| --- | --- | --- |
| `actions/types.ts` | Authoritative raw browser result omits field. | Add optional frozen type as above. |
| `client/gateway-mapping.ts` | Named raw-result payload projection drops new field. | Strict own-data read, pure parser, named payload member only. |
| `client/browser-result-mapping.ts` | Spreads the above payload into the existing gateway payload. | No source edit required; test unchanged top-level keys and nested preservation. |
| `io/gateway-output-dispatcher.ts` | Actual accepted raw result is kept beneath returned `payload.result`; no typed public lift. | After ordinary/durable acceptance, copy valid `result.payload.actionability` into public IO `actionability`. Do not mutate result/payload or digest/receipt inputs. Catch can retain only valid own carried controls separately from failure. |
| `runtime/adapter.ts` | Explicit public runtime result drops unknown fields. | Copy strictly parsed IO `actionability` on every actual outcome, independent of failure/status/confirmation/effect. |
| `llm-evidence/action-failure/result.ts` | Minimal direct gateway result already exposes open `payload`. | No wider failure contract or gateway top-level field needed. Existing shape can be read by a focused payload helper. |
| `llm-evidence/action-failure/execute.ts` | Returns successful raw answers unchanged; thrown answer reconstruction retains failure alone. | Preserve valid current thrown actionability in the existing local payload when reconstructing failed/unknown acknowledgement; no actual-call erasure or effect inference. |
| `llm-evidence/action-failure/refusal.ts` | Covered distinction reads `actual.startsWith("covered:")` for existing eligible codes, with timed-out/person/failure gates separate. | Valid typed fact wins the covered distinction; use existing closed prefix only when no valid typed fact. Preserve all surrounding gates. |
| `node-run/retries/answer.ts` | Selected explanatory result can fall back to rate limit; genuine cover is detected by prefix. | Typed covered blocks that substitution. Typed true/hidden/disabled suppress misleading old covered prefix; absence/malformed alone permits legacy fallback. Authority/ambiguity guards stay unchanged. |
| `node-run/retries/dispatch.ts` | Retains actual ordered raw answers and selected result; independently derives history-vetted failure controls. | No source change required: read measurement from the selected raw result in callers. Do not aggregate prior measurements or modify t826 all-attempt protections. |
| `node-run/retries/reacquire.ts` | Fresh answers are appended as whole raw results; synthetic gone answer has no payload. | No source change required. Fresh answers carry their own field; synthetic gone never borrows an earlier measurement. |
| `llm-evidence/capture.ts` | Central explicit tool type/key list/producer omit field; failed capture/page refusal carries failure alone; actAndCapture returns only page. | Add typed optional result field/key and final optional current-call actionability argument; strict projection before return/raw serialization. Carry it through failed capture/refusal. Successful targetless capture remains absent. Return a per-call action/page result from actAndCapture rather than write controls onto retained page bindings. |
| `tool-rejection/carrier.ts` | Constructor projects failure before throwing but drops other controls. | Add separate final optional unknown actionability input and readonly strictly parsed field. No private extras/flag changes. |
| `node-run/run.ts` | Failure pageRefusal/throw/catch and success tool builder project failure only. | Read selected current result measurement; thread separately through refusal/catch/success producer. Observation-only/no-measurement branches emit none. |
| `node-run/replay.ts` | Reset success/failure, failed-step about facts, changed read and replay success reconstruct tool answers. | Carry the selected actual reset/step measurement into each exit without changing acted/effectApplied/person/evidence/outputs. Rechecks do not replace it with a later capture. |
| `node-run/replay-answer.ts` | Replay facts and three central tool producer calls retain failure only. | Add separate optional actionability control to facts and forward only to tool control, never to the opaque model replay answer. |
| `llm-evidence/tools.ts` | Outer recoverable catch forwards only projected failure. Raw gateway bindings already return accepted open payload. | Forward carrier control in catch; do not enrich gateway top-level results or persisted page stores. |
| `harness-options/execute.ts` | Recoverable catch drops new controls; successful press/type/navigation receive only a page. | Forward carrier control; use per-call action/page result at actual action options and pass control to central tool producer. Plain inspect/find/describe/wait stay unmeasured. |

`WebLlmSnapshotBinding` is retained in maps/restamped and is a page/state binding, not a call receipt. **Do not add actionability to sanitize.ts, page evidence, page state, saved draft or definition metadata.** The actual capture_snapshot producer measures no exact target, so its success remains unknown rather than manufacturing a signal for transport.

## Cohesive helper and smallest proposed ownership

Add a pure helper directory under `domain/src/actions/actionability/` with a barrel and one export per file:

- `property.ts`: safely inspect an own data property named actionability, then call the frozen pure reader. Descriptor/accessor/proxy failure is an explicit local unreadable optional-carrier classification; malformed control drops alone. No `catch { return undefined; }`, getter invocation, broad exception suppression or audit-marker workaround.
- `payload.ts`: read an own data payload and then its actionability through that same boundary. Do not inspect failure English or codes and do not mutate raw input. Reuse it at IO/direct authoring seams.
- `index.ts`, plus `tests/property.test.ts` / `tests/payload.test.ts` (may combine nearest-owner tests if appropriate).

Source ownership for the host implementation is therefore domain-only:

1. `actions/types.ts`, `actions/actionability/**`.
2. `client/gateway-mapping.ts`; tests `client/tests/gateway-mapping.test.ts` and `browser-result-mapping.test.ts` (mapping source itself unchanged).
3. `io/gateway-output-dispatcher.ts`; existing `io/tests/gateway-output-dispatcher.test.ts` and durable-reconcile test if needed.
4. `runtime/adapter.ts`; existing `runtime/tests/adapter.test.ts` and redaction test only if assertions need extension.
5. `runtime/llm-evidence/{capture.ts,tools.ts}`, `action-failure/{execute.ts,refusal.ts}`, `tool-rejection/carrier.ts`, `node-run/{run.ts,replay.ts,replay-answer.ts}`, `node-run/retries/answer.ts`, `harness-options/execute.ts` and owning tests.
6. `runtime/llm-evidence/{press.ts,enter-field.ts}` for actual successful recovery actions using actAndCapture; these final two exact reads were approved by the lead and are now inspected. Existing direct coverage is `runtime/llm-evidence/tests/press.test.ts`; enter-field behavior is covered through the harness options tests. No separate enter-field test file was found by scoped filename search.

The actAndCapture return should be a local per-call `{ page: WebLlmSnapshotBinding; actionability?: AutomationStudioTargetActionabilityRecord }`, propagated by press/enter-field to their immediate harness consumer. Keep it separate from any page passed to restamp/shown/retained stores. Exact interface/caller changes after inspecting the final two helpers:

- `capture.ts actAndCapture`: return the existing captured page in `page` and only the actual action result's strictly parsed `actionability`. Its failed action/pageRefusal path carries the action control, not a later capture's. If a successful action's subsequent capture fails, retain that successful action's valid control in the existing refusal without changing current effect/person/failure behavior.
- `press.ts pressControl`: return that same call result shape; restamp its `page` only. The sole production caller is harness-options execute's press option. Its `no_progress` refusal follows an actual dispatch and must carry the valid selected call control through RecoverableToolRejection while retaining its existing flags/code.
- `press.ts restoreCheckbox`: currently returns void and can actually dispatch a second same-target click. Return a per-call action/page result only when restoration dispatched; otherwise undefined. After a real fresh restoration, the surfaced control becomes that restoration's control, including absence, rather than reusing the first click's measurement. Keep the existing page evidence returned by pressControl unchanged; this task adds a current measured target control, not a new page/effect policy. A thrown restoration retains its own measurement through the standard carrier.
- `enter-field.ts enterWebField`: both select and type branches await the action result, restamp only `page`, and return the per-call shape. The sole production caller is the harness enter-field option.
- `harness-options/execute.ts`: press and enter-field options call `shown` with `result.page`; navigation receives the actAndCapture call result likewise. Each toolExecution receives only that action result's control. The existing after-action captures, inspection/search/describe/wait bindings and retained page maps remain plain bindings.
- `runtime/llm-evidence/tests/press.test.ts`: adjust any direct success-result uses if present; current callsite search found a rejection assertion only, but full owning test inspection belongs to implementation. No additional external production caller was found by repository-scoped symbol search.

No edits are needed in host-failure helpers, shared browser protocol alias, retry executor policy, legacy constructors, Core, source/model guidance, versions, architecture or shared working documents. Near-budget `run.ts` must delegate projection to an existing/focused cohesive helper if it would exceed 800 lines; do not compress comments or relax baselines. New helper directories stay well below flat 25/depth 9.

## Acceptance after lead SDK/source release

Use a distinct DOMAIN_TEST_BUILD_LABEL and only named tests, then domain source/test check and lead-owned structure audit. Suggested owning selectors:

`actions/actionability/tests`, `client/tests/gateway-mapping`, `client/tests/browser-result-mapping`, `io/tests/gateway-output-dispatcher`, `runtime/tests/adapter`, `runtime/llm-evidence/action-failure/tests/refusal`, `runtime/llm-evidence/tool-rejection/tests`, `runtime/llm-evidence/node-run/retries/tests/answer`, `runtime/llm-evidence/node-run/retries/tests/reacquire`, existing/new nearby actionability integration test, `runtime/llm-evidence/tests/page-refusal`, `runtime/llm-evidence/tests/capture-after-action`, `runtime/llm-evidence/tests/tools`, `runtime/llm-evidence/harness-options/tests` plus actual press/enter tests as located.

Required assertions:

- Raw browser to wire: both branches/all three causes, exact payload-only control, unchanged gateway top-level keys/status/failure, producer input unchanged; malformed/accessor/private extras dropped alone without invoking getters.
- Accepted gateway to IO/runtime: actual successful, failed, ambiguous, timed-out, required durable, interrupted, auth/person/policy results keep original status/effect/failure/flags while independently lifting only the valid current fact. Missing old-browser control stays absent even on success or recognizable code.
- Direct authoring/replay/reset/refusal/throw/catch/recovery: valid current control reaches central producer and the real public `runAutomationStudioLlmEvidenceLoop`; actual accounting/evidence/effectApplied/person/failure/outputs stay exact and no `tool_result_invalid` is introduced.
- Central raw tool serialization: exact controls only; raw optional private extras, geometry/text/handles and old measurements never enter tool control. Positive followed by fresh no-measurement success clears; malformed metadata drops alone. Negative after an ambiguous committing act cannot alter the original ambiguity or grant retry/transient admission.
- Retried answers: typed covered overrides conflicting English, typed true/hidden/disabled suppress old covered prefix, missing/malformed uses old closed prefix, stronger auth/ambiguity wins, full history remains, fresh reacquisition/source identity stays associated, gone result never inherits prior measurement.
- New host/old browser: no fact manufactured, existing exact legacy results unchanged. Old host/new browser: old open-payload projection accepts payload.actionability while unchanged top-level key set/status/failure remain valid. Lead owns actual old Core durable/reload/reconciliation compatibility and browser proof; host tests alone do not claim persistence acceptance.

Validation: Read-only source/document inspection and scoped filename/callsite searches only. No generated checks, tests, build, API, browser, panel, source/version/shared state or git operations performed.

Not verified: implementation, generated SDK compatibility, runtime test outcomes, old/new executable persistence matrix and actual browser production. All 22 approved source owners have now been inspected; test file contents were not opened during this read-only plan.

Report: `docs/working/framework-heavy-lifting-plan/reports/codex-1031/p8-actionability/host-plan.md`

Notes: Browser-facing authoritative interface is ready to freeze now. Host raw gateway/digest/reconciliation objects remain untouched; validated public controls are separate post-acceptance copies. Source implementation has not begun.
