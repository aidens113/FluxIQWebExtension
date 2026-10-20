# A3: Generic Framework Logic Downstream

Worker report for brief A3 of [the boundary audit](../../extension-core-boundary-audit.md). Read-only; nothing in
either repository was changed. Date: 2026-10-19, on `dev`.

## Outcome

Done, within the brief's reading budget. The domain mostly gets the split right: Flow execution, retry
policy, pacing between node starts, site reset and the act ledger, judging, permission decisions, record
post-processing and name matching all run in Core. The domain only states facts about web acts and calls
into Core. Most of what is generic but still downstream sits in four places:

1. **Gateway client behaviour** that any FluxIQ client would need: reconnecting with backoff, heartbeat,
   the offline queue, the client side of command reconciliation, host-lease epoch fencing, and picking a
   session.
2. **Activity presentation**: how Core's activity events are paced and turned into headlines and words. It
   exists twice, once in the extension and once in Core's `apps/web`, and the two are kept in step only by
   comments.
3. **Record value reading**: the logic for `where` conditions and number reading exists in both repos and
   is kept equal only by a shared test table.
4. **Small generic helpers built from Core primitives**: noticing repeated answers, spotting a column name
   with one part swapped, screening card numbers, a bounded per-instance memory, and FNV hashing.

## What changed and why

Only this report was written. No source was edited.

## Findings table

Owner key: "Core" means move it to Core (the seam is named). "Stays" means it is web-specific or correctly
split. "Split" means the generic part moves and the web part stays.

| file:symbol | Responsibility | Web-specific or generic | Core duplicate | Proposed owner | Risk | Core seam |
| --- | --- | --- | --- | --- | --- | --- |
| `apps/extension/src/background/connection/gateway-session.ts:GatewaySession` (`scheduleReconnect`, `retryNow`, `startHeartbeat`, `send`/`flushQueue`, `setState`) | Connection state machine, exponential-backoff reconnect, heartbeat, offline queue and flush on top of Core's socket client | Generic. Only `clientHello` (browser descriptor), the `execute_action` to browser-action mapping and the MV3 `keepAlive` hook are extension-specific | None. Core's `@fluxiq/client-gateway-websocket` `FluxIQClientGatewayWebSocketClient` has only connect, open timeout, send and events: no reconnect, heartbeat or queue (checked `transport.ts`) | Split: the session layer (backoff, heartbeat, queue port, state) goes to Core; hello, command mapping and keepAlive stay | Medium: reliability-critical path. Needs injectable timers and a queue port (the module already takes `GatewayEventQueue`) | `@fluxiq/client-gateway-websocket`: a new `ClientGatewaySession` class wrapping the existing client |
| `apps/extension/src/background/connection/in-flight/command-reconciliation.ts:CommandReconciliation` plus `record-store.ts`, `seen-store.ts` | Client half of Core C8: in-flight records, answering a repeated command id, reporting leftovers after a restart, answering `server.reconcile_command`, refusing ids answered `not_seen` | Generic in shape. Storage is `chrome.storage.session` (stays as a port); "which acts commit" is the domain's fact | Server half is Core's `client-gateway/service/command-reconcile/*` and `command-ledger/*`; no client half in Core | Split: the state machine goes to Core with storage and a `commits(command)` predicate as ports | Medium: protects against double acts | `@fluxiq/client-gateway-websocket` (client ledger), with ports for storage and the commit predicate |
| `domain/src/client/reconcile/answer.ts:webAutomationReconcileAnswer` | Decides `running` / `landed` / `unknown` / `not_seen` from what the client knows | Generic. No web concept in the file | Core's server reads these four states (`command-reconcile/reconciled-result.ts`) | Core | Low | `@fluxiq/client-gateway-websocket` or `@fluxiq/contracts/client-gateway` |
| `domain/src/client/interrupted-action/outcome.ts`, `unanswered-outcome.ts`, `reconcile/not-seen-outcome.ts` | Wire status and failure record for an interrupted, unanswered or not-seen command | Shape is generic; codes are web (`web.action.unknown`, `web.transport.transient`) | Core builds the same `not_seen` result server-side (`reconciled-result.ts`) | Split: a Core builder that takes the domain's codes; `commits.ts` stays | Low | Core client-gateway contracts |
| `domain/src/client/host-lease.ts:webAutomationHostLeaseJudgement`, `webAutomationHostLeaseReading`, `webAutomationHostLeaseRefusal`, `WEB_AUTOMATION_HOST_LEASE_REFUSAL_CODES` | Client-side lease epoch fencing (adopt, current, stale, holder mismatch) and the refusal result | Generic. The file has no web concept. It restates Core's refusal codes because "Core's constant lives beside its gateway service, which the extension bundle must not pull in" | Server half is Core's `client-gateway/service/host-lease/*`; codes duplicated (pinned by `satisfies`) | Core | Low | `@fluxiq/contracts/client-gateway` (codes) plus `@fluxiq/client-gateway-websocket` (judgement) |
| `apps/extension/src/background/connection/host-lease/ledger.ts:HostLeaseLedger` | Highest lease seen per resource, serialised judgements, persisted across worker restarts | Generic logic with browser storage | None client-side | Split: the ledger goes to Core with a storage port; `chrome.storage.session` stays | Low | `@fluxiq/client-gateway-websocket` |
| `domain/src/runtime/host-resources/port.ts:createWebAutomationHostResourcePort` | Capacity-1 lease allocator with strictly rising epochs (clock-seeded) | Generic. Only the session pick and the resource key name are web | Core owns the scheduler (`AutomationStudioHostResourceScheduler`) but leaves epoch minting to each port | Split: a Core factory `(pickSession, resourceKey)`; capacity 1 and the key stay | Low | `fluxiq/automation-studio` host-resource port helpers |
| `domain/src/runtime/adapter.ts:selectWebAutomationSession`, `domain/src/io/gateway-output-dispatcher.ts:targetSessionId`, `domain/src/runtime/web-sessions/eligible-web-session.ts:isEligibleWebSession` | Pick the paired client session that serves this domain | Shape is generic (status, client type, capability for domain X, exactly one). Ids are web | Not in Core | Core helper; the domain passes its capability rule | Low. **There are three copies with two different rules**: adapter and dispatcher accept `connected` or `ready` and any `web.*` action; `isEligibleWebSession` needs `ready`, not recording, and `web.dom.capture_snapshot` | `fluxiq/client-gateway` snapshot helper, e.g. "sessions serving domain" |
| `domain/src/io/gateway-input-hub.ts:GatewayInputHub` | Turns gateway recording and state events into per-input IO envelopes for runtime confirmation | Generic. Only the domain-id constant is web | Partial: Core `programs/automation-studio/client-gateway/bridge.ts` parses the same `domainId` (top level wins over metadata) and `inputId` from the same events, for recordings | Core (a subscribe-by-input API on the bridge or the IO registry) | Low | `fluxiq` IO registry / AS gateway bridge |
| `apps/extension/src/background/activity/{pacer,headline,unit-situation,unit-history,run-retry,candidate-trial,supervisor-ending,ending-kind,fan-out-gate}.ts` and `shared/activity/{wording,not-tried,declined-submission,step-recovery,step-skip,model-thought,internal-step,headline-echo,cut-at-word,word-cut,project/*}.ts` | Turn Core's raw activity events into a paced status (headline, detail, units of work, retry versus repair, trial versus run, endings) and into a person's words | Generic: no `chrome.*`, tab or DOM use in any of them (grep). Only `activity-relay.ts` fan-out, `overlay-target.ts` and `overlay-preference-storage.ts` are extension-specific | **Yes.** Core `apps/web/src/features/automation-studio/conversation/activity/{headline,pacer,wording,history}.ts`, whose header says "The words match the extension's (`apps/extension/src/background/activity/headline.ts` ...)". Today the extension's copy is the authority; Core's mirrors it by hand. Core's `fluxiq/ui` exports only `activity-action` | Core (`fluxiq/ui`, browser-safe), used by both the extension and `apps/web` | Medium: UI behaviour with many tests in the extension; the two copies may already differ | `fluxiq/ui` |
| `domain/src/actions/extraction/condition-match.ts:webAutomationExtractConditionNumber` and condition semantics (with `condition-grammar.ts`) | Whether a `where` condition holds of a value; reading numbers (continental separators, k/m magnitudes) | Generic text and value semantics; no DOM | **Yes.** `@fluxiq/contracts` `record-sets/process/{read-number,condition-holds,parse-condition}.ts`, whose header says "The semantics are the downstream web domain's item condition ... to the character". Equality is held by a parity test (`domain/src/actions/extraction/tests/value-reading-parity.test.ts` against `value-reading-cases.ts`). Authority: the domain's semantics came first; Core's is the parity copy | Core (`@fluxiq/contracts` record-sets); domain and content import it | Low to medium: the content bundle must import a browser-safe Core entry, and `@fluxiq/contracts` is already a dependency of the socket client | `@fluxiq/contracts` record-sets process |
| `apps/extension/src/content/extraction/order-rows.ts:listRowOrderFor` (outside A3's directories, recorded because the brief names dedupe and sort) | Dedupe and sort of a list read's rows on the page | Generic row processing | **Yes.** `@fluxiq/contracts` `record-sets/process/{row-identity,sort-rows,sort-value}.ts`, the authoritative post-processing of a run's dataset (`record-output-process.ts` says it "moved off the page" to Core). The page copy survives for exploration | Core (import Core's process functions) | Medium: exploration answers must match stored answers | `@fluxiq/contracts` record-sets process |
| `domain/src/runtime/llm-evidence/repeated-refusal.ts:createWebLlmRepeatedRefusals` | Marks a tool refusal that is byte-identical to the last one for the same project, flow, session and tool (`repeatedAnswer`, `answered_the_same_again`), reset when an evidence loop opens | Generic. Compares serialized results; no web concept | Partial: Core `runtime/llm/repeat-guard/*` refuses repeated *calls*. Core `runtime/activity/repeated-reason.ts` already hard-codes the domain's reason string `answered_the_same_again`, so Core depends on a downstream string | Core (in the evidence loop, beside `repeat-guard`) | Low | `fluxiq/automation-studio` evidence loop / repeat-guard |
| `domain/src/runtime/llm-evidence/node-run/arrival.ts`, `held-literals/memory.ts`, `own-layers/memory.ts`, `repeated-refusal.ts` (lifecycle part) | Per-build memories, each bounded by hand, that detect "a new build began" by parsing Core's call-id convention (`initial.<toolId>` and Core's scoped form from `llm/evidence-loop/call-id.ts`) | The memories' contents are web; the lifecycle detection is generic and copies Core's id format | Core owns the build and loop lifecycle and the call-id format | Split: Core passes an explicit loop or build scope (or a scoped store) on the tool request; the contents stay | Medium: four modules depend on the parsing, and a Core id change breaks them silently | Evidence tool request contract (`fluxiq/automation-studio`) |
| `domain/src/output-nodes/extract-list/swapped-name.ts:webExtractionNameSwapsPart` | Refuses a nearest-name match whose name has one part swapped for another (same family, different member) | Generic name matching, built entirely from Core's `normalizeAutomationStudioName`, `automationStudioNameTokenCredit` and `automationStudioNameEditDistance` | Core `nodes/name-match/*` does not have this guard, so node ids and parameter names matched in Core lack it | Core (`nodes/name-match`) | Low | `fluxiq/automation-studio/nodes` |
| `domain/src/runtime/llm-evidence/withheld.ts` (card-number screen) | Withholds Luhn-valid, card-formatted digit runs from model-bound strings, after Core's `screenAutomationStudioLlmEvidence` | Generic secret screening | Core's screen covers credential shapes but not card numbers (the header says so) | Core (add to `screenAutomationStudioLlmEvidence`) | Medium: Core's pre-send screen refuses whole requests, so a new shape there changes behaviour for every domain | `fluxiq/automation-studio` LLM evidence screen |
| `domain/src/cleared-way-outs/registry.ts`, `owned-by.ts` | Bounded store of opaque references per FluxIQ instance (WeakMap plus a size limit) | Generic pattern; the content is web | Same pattern written privately in the per-build memories above | Stays, or becomes a small Core utility | Low | none needed |
| `domain/src/runtime/hash/fnv1a.ts`, `output-nodes/extract-list/derived-record-output.ts:fnv1a` | FNV-1a string hash | Generic | Core has private copies in `executor/lifecycle/incident.ts`, `recovery/progress-guard.ts`, `llm/harness/provider-result.ts` and others; no exported one | Optional Core utility; two copies in the domain | Low | `fluxiq/core` |
| `domain/src/runtime/reusable-evidence-coordinator.ts:mapCompletedWebReusableEvidenceToPutRequest`, `writeCompletedWebReusableEvidence` | Builds and validates a Core reusable-LLM-context record (outcome, reviewer and validation states, provenance, TTL, id rules) | Record shape is Core's; the fingerprint and projection (`reusable-evidence.ts`) are web | Core `AutomationStudioReusableLlmContextRecord` (`runtime/reusable-llm-context.ts`, storage); the domain restates its unions | Validation goes to Core; the projection stays. **Has no production caller**: only its own tests and the stale `domain/dist` reference it | Low (dead code) | Core reusable-context write API |
| `apps/extension/src/background/connection/recording-start/handshake.ts`, `refusal.ts:classifyRecordingStartRefusal` | One pending start at a time, acceptance window, bounded retry of a "transient" refusal | Generic recording-client protocol. The classifier works out transient versus persistent by copying Core's internal resolver rule (`activeProjectId` present and context older than 10 s), and cites a stale `F:\!FluxIQ` path | Core sends the refusal but no `retryable` or kind | Core should say on `server.error` whether a refusal is transient; the handshake could go to the socket client | Low to medium | Core gateway error payload |
| `apps/extension/src/background/connection/project-context.ts:ProjectContext` with `core-api.ts:fetchProjectIdFromCoreSnapshot` | Client polls Core's HTTP gateway snapshot for the current project, with a 1 s reuse window and a 1 s bound, falling back to the stored project | Generic client concern; Core owns the current project | None client-side | Core should push project context on the session (`session_ready` or an update message); the extension keeps only the recording's own project | Medium (overlaps A2) | Core gateway server messages |
| `apps/extension/src/background/connection/core-api.ts` (`fetchCoreRecordings`, `uploadStateAsset`, `callCoreProgram`) | Hand-written HTTP client for Core's recordings, snapshot, state-asset and program endpoints, with its own response normalising | Generic Core API client | `@fluxiq/contracts/program-api` holds types but no client (no `fetch` in `contracts/src`) | Core (a browser-safe program-API client) | Low | `@fluxiq/contracts/program-api` or a new client package |
| `apps/extension/src/background/page-pace/origin-pace.ts:OriginPace` | Per-origin spacing of page loads across the worker's life; a 429 or 503 holds the origin and doubles its spacing | Keyed by origin with HTTP statuses, and it paces loads Core never sees (a paginated read's own loads). Web-specific in effect | Overlaps in concept with Core `executor/pacing/pace-keeper.ts` (per-node pace learned from hinted failures), with different numbers | Stays. Record the two layers so they are not tuned against each other | Low | none |
| `domain/src/runtime/llm-evidence/node-run/retries/dispatch.ts`, `look.ts` | Dispatch an exploration or replay node under Core's default retries | Correct split: policy is Core's `automationStudioDispatchWithNodeRetries`; the domain supplies the reading and its lasting-act statement | None | Stays | n/a | already uses Core |
| `domain/src/runtime/llm-evidence/node-run/retries/wait.ts:webNodeRetryWait` | Abortable sleep that keeps its timer referenced | Generic | Core `executor/pacing/run-wait.ts:automationStudioRunWait` (unreferenced timer) | Stays, or Core gains a `hold` option | Low | `automationStudioRunWait` |
| `domain/src/runtime/lasting-act-statement.ts:webLastingActStatement`, `client/interrupted-action/commits.ts` | States which web acts commit, so Core decides whether retrying is a second act | Web fact; Core decides (`executor/defensive/lasting-act.ts`) | None | Stays | n/a | already split |
| `domain/src/runtime/llm-evidence/node-run/replay.ts`, `verify.ts`, `retries/effect-check.ts` | The web half of Core's dry run (reset by navigation, run a step again, check a lasting step) | Web. Core owns `flow-draft/dry-run.ts` | None | Stays | n/a | already split |
| `domain/src/runtime/route-state/compare-signatures.ts:compareWebAutomationRouteSignatures` | Host side of Core's `compareRouteSignatures`: path and layer equality plus a bottom-k Jaccard estimate of controls | Features are web; the bottom-k Jaccard estimator is generic maths | Core defines the port (`route-state/signatures/host.ts`) | Stays (the estimator could be a Core utility) | Low | already a Core port |
| `domain/src/output-nodes/extract-list/record-output-process.ts`, `actions/extraction/order-request.ts` | Map a read's dedupe, sort and limits to Core's `AutomationStudioRecordProcessing`; read the model's forgiving forms (`"-price"`, `"posted desc"`) | Mapping is web; the forgiving sort and dedupe reader is generic | Core parses the strict form (`record-sets/process/parse-processing.ts`) | Stays (the forgiving reader is a suspected Core candidate) | Low | `@fluxiq/contracts` record-sets |
| `domain/src/output-nodes/extract-list/column-match.ts`, `actions/extraction/field-match.ts` | Resolve a misspelled column name | Uses Core's `automationStudioMatchName` at Core's floor | None | Stays | n/a | already uses Core |
| `domain/src/runtime/failure/{codes,classify,carrier}.ts` | Closed set of web failure codes bound to Core categories; classifier; "attach the record to the thrown error" convention | Codes are web; categories are Core's. The carrier convention is generic | None | Stays (the carrier convention is optional for Core) | Low | `AutomationStudioFailureRecord` |
| `domain/src/runtime/llm-evidence/tool-rejection.ts:RecoverableToolRejection`, `toolRejection` | Web refusal codes and the `{ok:false, code, detail}` refusal result | Codes are web; the envelope (reason, next, instead) is a generic refusal contract | Core reads refusals generically (`llm/tool-failure.ts` covers thrown calls) | Stays (suspected: the `detail` envelope could be a Core contract) | Low | Core evidence-tool result contract |
| `domain/src/runtime/llm-evidence/permission.ts`, `plan-resolution/step-permission.ts` | Put the model's declared consequences to Core's permission gate | Correct split; Core decides (`runtime/action-permissions/*`). One local fallback: without a Core check, a declared consequence is refused | None | Stays | n/a | already uses Core |
| `apps/extension/src/background/diagnostics/diagnostic-redaction.ts:redactDiagnosticText` | Redacts tokens, URLs, quoted text, e-mail addresses and long digit runs from problem-report text | Generic text redaction | A third screen beside Core's `screenAutomationStudioLlmEvidence` and the domain's `withheld.ts`, with different rules | Stays (a client-side report), or becomes a shared Core redaction utility | Low | none |
| `apps/extension/src/background/reconnect-watchdog.ts` | MV3 alarm that wakes the worker to reconnect | Web/MV3-specific | None | Stays | n/a | n/a |

## Confirmed versus suspected

**Confirmed** (code read on both sides, or the code states it):

- No reconnect, heartbeat or offline queue exists in Core's socket client; the extension's
  `GatewaySession` provides all three on top of it.
- `client/host-lease.ts` and `client/reconcile/answer.ts` contain no web concept. The lease refusal codes
  are restated from Core, held equal by `satisfies`.
- There are three session-selection copies in the domain, with two different eligibility rules.
- Activity headline, pacer, wording and history exist in both the extension and Core `apps/web`, kept in
  step by comments that point at each other.
- `where`-condition and number semantics are implemented in both the domain (`condition-match.ts`) and
  Core (`@fluxiq/contracts` record-sets process), held equal by a parity test. The content script's
  dedupe and sort (`order-rows.ts`) re-implements Core's record processing for exploration.
- The repeated-answer marker is generic, and Core's activity code hard-codes its reason string.
- The per-build memories copy Core's call-id format to detect a new build.
- `swapped-name.ts` is generic and built only from Core primitives.
- The card-number screen is generic and missing from Core's screen.
- `reusable-evidence-coordinator.ts` has no production caller and restates Core's record type.
- Correctly split, with no duplication: retry policy, lasting-act decisions, dry-run orchestration, site
  reset and act ledger (Core `executor/lifecycle-run/*`), permission decisions, name matching, record
  post-processing of stored rows, route-signature comparison as a host port. No budget, cost or purse
  accounting exists in these directories (grep for budget, purse, cost and deadline found only web
  timeouts and byte-budget comments).

**Suspected** (pattern seen, other side not fully checked):

- The recording-start handshake and refusal classification belong in the gateway protocol. Core's
  `server.error` was not read in full to confirm it carries no retryable flag.
- Project context should be pushed by Core rather than polled over HTTP. Overlaps A2.
- A browser-safe Core HTTP program-API client is missing.
- The forgiving sort and dedupe reader (`order-request.ts`) and the refusal `detail` envelope
  (`tool-rejection.ts`) may be generic contracts.
- FNV-1a, the bounded per-instance store, the failure carrier convention and the bottom-k Jaccard
  estimator are small generic utilities that are duplicated or could be shared.
- The extension's per-origin page pace and Core's per-node learned pace are two pacing layers that may
  interact (double waiting). Not measured.

## Summary

The engine is not duplicated downstream: no Flow walking, budgets, judging or reset logic was found.
What leaked is the **client side of Core's own protocols**: reconnect and queue, reconciliation, lease
fencing, session choice, recording-start retries and project context. Every FluxIQ client would need
these, yet they live in the extension and the domain because Core's socket client is only a thin
transport. The proposed seam is a session and ledger layer in `@fluxiq/client-gateway-websocket`, with
ports for storage and the domain's "which acts commit" fact.

The two genuine twin implementations are **activity presentation** (extension and Core `apps/web`) and
**record value semantics** (domain, content script and `@fluxiq/contracts`). In both, one copy is
maintained by hand to match the other, and each should become one Core module that both sides import.

## Commands run and observed results

- Header-comment survey of every non-test, non-barrel `.ts` file under `domain/src` (394 files) and
  `apps/extension/src/{background,runtime,shared}` (159 files), saved to
  `C:/Users/osrs_/AppData/Local/Temp/claude/c--Users-osrs--FluxStuff--FluxIQWebExtension/22166e26-c1c5-4e4e-bb9e-c535c9663b2b/scratchpad/a3-domain-headers.txt`
  (domain part).
- Directory listings of Core `packages/fluxiq/src/programs/automation-studio/{runtime,runtime/executor,runtime/recovery,runtime/llm,runtime/activity,client-gateway,nodes/name-match,fingerprinting}`,
  `packages/client-gateway-websocket/src`, `packages/contracts/src/record-sets/process`, and
  `apps/web/src/features/automation-studio/conversation/activity`.
- About 45 files read in depth, among them: retries `dispatch.ts`/`look.ts`/`wait.ts`, `replay.ts`
  (header), `repeated-refusal.ts`, `held-literals/memory.ts`, `tool-rejection.ts` (parts), failure
  `classify`/`carrier`/`codes`, `lasting-act-statement.ts`, `route-state/compare-signatures.ts`,
  `record-output-process.ts`, `order-request.ts`, `condition-match.ts`, `column-match.ts`,
  `swapped-name.ts`, `cleared-way-outs/*`, `host-resources/*`, `web-sessions/*`, `adapter.ts` (parts),
  `client/host-lease.ts`, `client/reconcile/*`, `client/interrupted-action/*`,
  `io/gateway-output-dispatcher.ts`, `io/gateway-input-hub.ts`, `reusable-evidence*.ts`, `withheld.ts`,
  `permission.ts`, `act-landing/landing.ts`, `requests/policy/validation.ts`, `web-panel-host.ts` (head),
  extension `gateway-session.ts`, `command-reconciliation.ts`, `host-lease/ledger.ts`,
  `recording-start/*`, `project-context.ts`, `core-api.ts`, `server-command-channel.ts` (head),
  `reconnect-watchdog.ts`, `page-pace/origin-pace.ts`, `pace-settings.ts`, `activity/pacer.ts`,
  `activity-relay.ts`, `shared/activity/wording.ts`, `diagnostic-redaction.ts`, `content/identity/score.ts`
  (head), `content/extraction/order-rows.ts` (head). On the Core side: `transport.ts`,
  `refused-repeat.ts`, `refusal-run.ts`, `tool-failure.ts`, `io-bridge.ts`, `bridge.ts`, `pacing/*`,
  `read-number.ts`, `condition-holds.ts`, `row-identity.ts`, `sort-rows.ts`, `element-fingerprint.ts`,
  `apps/web` `headline.ts`.
- Greps: `chrome.`/tab/url in the activity modules (none outside relay and overlay files);
  `fnv`/`FNV` in both repos; `holder_mismatch|reconcile_command|not_seen` in Core;
  `repeatedAnswer|answered_the_same_again` in Core (`runtime/activity/repeated-reason.ts`);
  `budget|purse|cost|deadline` downstream; `dedupe` in both repos; callers of the
  reusable-evidence coordinator (tests and `domain/dist` only); `Building your Flow` in Core
  (`apps/web` activity).

## Not verified

- Not reached in depth: most of `domain/src/runtime/llm-evidence/` (`capture.ts`, `tools.ts`,
  `sanitize.ts`, `stable-handles.ts`, `page-view/*`, `structure/*`, most of `plan-resolution/*`,
  `harness-options/*`), `domain/src/recording/*`, most of `domain/src/output-nodes/*`, `actions/types.ts`
  and `schemas.ts`; extension `runtime/*` (browser verbs, judged web-specific from headers),
  `background/panel/*`, `background/extraction/*`, and most of `background/connection/*`. Their headers
  show web-specific responsibilities.
- Whether the two activity copies (extension and Core `apps/web`) currently behave identically.
- Whether Core's `server.error` for recording start carries a retryable or kind field.
- No tests, builds or type checks were run; the brief was read-only.

## Open questions or contradictions found

- **Session eligibility disagrees inside the domain.** The runtime adapter and the output dispatcher
  accept a `connected` or `ready` extension offering any `web.*` action. The build path, the leases and
  the evidence tools (`isEligibleWebSession`) require `ready`, not recording, and
  `web.dom.capture_snapshot`. Whether the difference is intended is unclear; it should be one rule.
- **Core depends on downstream strings.** Core's `runtime/activity/repeated-reason.ts` hard-codes
  `answered_the_same_again`, and Core's `ElementFingerprint` (`fingerprinting/element-fingerprint.ts`)
  carries `selector`, `xpath` and `tagName`. These are web concepts inside Core, the reverse of this
  audit's direction. Recorded for the consolidation; not investigated further.
- **`apps/extension/src/shared/protocol.ts` imports from `../content/evidence`**, so the shared layer
  depends on the content layer. That is a layering question, not a Core one.
- **`recording-start/refusal.ts` cites `F:\!FluxIQ\apps\web\...`**, which AGENTS.md calls stale.
- **`domain/dist/` exists in the checkout.** It is not in the AGENTS.md list of generated directories.
  Not checked whether it is tracked.
