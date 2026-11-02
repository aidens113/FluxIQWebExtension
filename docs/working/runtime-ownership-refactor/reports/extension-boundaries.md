# Extension boundary discovery

## Scope and method

Read the requested repository rules, architecture layout and current-state sections. Inspected production source under `apps/extension/src`, `domain/src`, `packages/*/src` and `scripts/` for import direction, Core seams, storage, gateway ownership, provider references and framework orchestration. No source, Core, shared working document or git state was changed. No tests/builds were run.

## Findings

### Current boundary checks

- **Domain-to-extension imports:** no imports from `domain/src` to `apps/extension/src` were found. References are comments/documentation. The structure audit config forbids this dependency (`scripts/structure-audit/config.mjs`) and the audit runs through the repository structure check.
- **Core deep imports:** production imports use public package exports, including `fluxiq/automation-studio`, `fluxiq/core`, and `@fluxiq/client-gateway-websocket`. No import into Core `src` or `dist` was found. The public host seam is also documented in `docs/architecture/repository-layout.md`.
- **Provider calls:** no provider endpoint, SDK or credential usage was found in extension or domain production source. Provider-aware operations in `packages/test-runner` and `scripts/lab` are Lab launch/configuration infrastructure. Domain model-facing text and output catalogs are consumed by Core for Core model calls. The structure audit config restricts provider hosts, SDK references and keys outside the Lab allow list.
- **Framework orchestration:** the inspected domain runtime components describe web-automation contracts/adapters: failure codes, web-session selection, evidence, action dispatch, page expectations and browser capabilities. No duplicate generic Flow runner/retry/judge/reset implementation was confirmed.
- **Gateway ownership:** `apps/extension/src/background/connection/gateway-session.ts` subclasses Core's `FluxIQClientGatewayConnection`. It delegates socket state, reconnect, heartbeat, keep-alive, lineage and queue lifecycle to Core. The extension supplies browser hello/token storage, timing, command mapping and handlers. `outbox/store.ts` and `host-lease/session-ledger.ts` adapt Core interfaces to browser session storage. No generic gateway implementation copy was identified.

### Storage inventory and ownership

- `apps/extension/src/background/storage.ts`: local browser settings, gateway session/token, stable browser client id; browser client state, not projects/Flows/recording ownership.
- `apps/extension/src/background/connection/outbox/store.ts`: queued gateway messages in `chrome.storage.session`, surviving service-worker restarts but cleared at browser close. `storage.ts` removes the legacy persistent queue key. This corrects the prior audit's statement that the current queue outlives browser restarts. The queue can contain recording payloads for the open browser session; this is transient transport state, not durable Core ownership.
- `apps/extension/src/runtime/automation-tab.ts`: snapshot readiness proof in session storage; short-lived browser runtime state.
- `apps/extension/src/background/connection/in-flight/record-area.ts` and `background/panel/session-disconnect-memory.ts`: service-worker continuity backed by session storage or memory fallback.
- `background/activity/overlay-preference-storage.ts`, `background/diagnostics/problem/log.ts`, `panel/settings/draft-store.ts`, and `panel/chat/conversation/draft-storage.ts`: local UI preference, diagnostics and unsent drafts. `page-world/press-work/scheduling.ts` accesses page IndexedDB as a browser integration surface, not an extension-owned durable store.
- No durable project, Flow, recording, policy or grant store was found in extension/domain production source. These remain Core-owned per architecture.

### Model-facing text and local Lab infrastructure

- `domain/src/runtime/llm-evidence/system-instructions/instructions.ts` currently labels its text `web-12`, documents that universal Flow rules moved into Core's system prompt, and retains web page-view/browser interaction guidance. This is a web-specific instruction adapter, not a confirmed generic framework copy.
- `domain/src/output-nodes/**/catalog-text.ts` contains web action descriptions supplied through Core's catalog seam.
- `packages/test-runner`, `test-contracts`, `test-evidence`, `test-matrix`, `real-site-policy`, `website-stand-in`, `boundary-audit`, and `scripts/lab/**` are repository-local test, fixture, policy or audit infrastructure. Provider references or read-only inspection of copied test workspaces there do not establish generic framework ownership in this repository.

## Prior audit claims checked

- **Queue survives browser restart:** stale. The current queue uses `chrome.storage.session`; old local storage is cleared. Session-long event payload retention remains a relevant bounded property.
- **Gateway client logic is downstream because Core socket client is thin:** stale as a blanket claim. The current gateway session composes Core's `FluxIQClientGatewayConnection`; its browser adaptation is not duplicated generic connection machinery.
- **Framework rules remain in domain system instructions:** stale. Current instructions state universal rules moved into Core and the remaining text is web-specific.
- **Provider execution, deep Core imports, domain-to-extension imports:** none found in inspected production source.
- **Copied task/build-cache tooling:** not source-diffed against Core in this brief. Repository docs say these tools are imported from Core; a drift claim requires direct comparison.

## Compatibility, focused validation and mechanical guards

No move is recommended from this pass, so no external compatibility impact is identified. If gateway assembly changes later, preserve the `GatewaySession` surface consumed by `background/index.ts`. Relevant focused checks are adjacent gateway-session/outbox/host-lease tests under `apps/extension/src/background/connection/**/tests`, and domain web-session/system-instruction tests in adjacent `tests` folders. The structure audit mechanically guards domain import direction and provider references. Storage-retention ownership is not covered by those import rules; focused tests cover session outbox behavior and legacy queue removal.

## Return contract

Outcome: Done
Changed: `docs/working/runtime-ownership-refactor/reports/extension-boundaries.md`
Validation: targeted source scans and inspection completed; no tests/builds run (read-only discovery)
Not verified: Full semantic review of all 4,352 enumerated files; direct build-cache/task tooling comparison against Core; browser runtime behavior; full suite results
Report: `docs/working/runtime-ownership-refactor/reports/extension-boundaries.md`
Notes: No confirmed production ownership violation found in scoped checks. Prior queue and system-instruction claims are stale; queue payload retention is bounded to the open browser session.
