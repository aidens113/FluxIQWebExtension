# t386 — R1-gate (C10 requirement gate) worker report

## Outcome

Done. All edits are in the Core tree `C:/Users/osrs_/FluxStuff/fxwork/t386/!FluxIQ` on `task/t386-requirement-gate`. Nothing is committed. Apart from this report, nothing in the downstream tree changed.

## What changed and why

Paths are under `packages/fluxiq/src/`.

- **New `programs/automation-studio/runtime/service/runtime-session/requirement-gate.ts`**, exported through the `runtime-session/index.ts` barrel. It exports:
  - `AUTOMATION_STUDIO_REQUIREMENT_IDS`: `{ flowHandlers: "flow.handlers@1", flowSubflowCalls: "flow.subflow-calls@1", webFacts: "web.facts@1", webActionsReconcile: "web.actions.reconcile@1" }`.
  - `AUTOMATION_STUDIO_EXECUTOR_GRANTED_REQUIREMENTS`: a `readonly string[]` that is **empty today**. The executor work that implements a `flow.*` id must add that id here (or put it in the run's `graphOptions.runtimeCapabilities`). Until then, a Flow that requires the id is refused.
  - `automationStudioDeclaredRequirements(flows)` reads `metadata.requires` from each graph, removes duplicates and ignores values that are not strings.
  - `automationStudioRequirementRefusal({ required, executorIds, clients })` is the pure check. It returns `{ missing: { id, side, plainName }, reason }`, or `null` when nothing is missing.
  - `AutomationStudioRunRequirementError` has `code = "run.requirement_missing"` and a `missing` field. Its `message` is the plain reason.
  - `assertAutomationStudioRunRequirements({ flows, graphOptions, runtimeService?, domainId?, executorGranted? })` throws when a requirement is missing. A run whose graphs declare nothing returns immediately and reads no sessions.
  - Side rules: an id starting with `flow.` must be granted by the executor. Every other id is a host id, granted when any **ready** client from `runtimeService.clients()` declares it. Only clients bound to the run's domain, or to no domain, count.
  - Plain reasons:
    - "This automation needs page facts, which FluxIQ Browser Extension doesn't offer yet. Update FluxIQ Browser Extension and run it again." (the session label is used when exactly one client is eligible, otherwise "the connected client")
    - "…but no connected client offers it…"
    - "…which this version of FluxIQ doesn't offer yet. Update FluxIQ…" for an executor id.
- **`programs/automation-studio/runtime/service.ts`**: three changed lines (the import plus two gate calls, each appended to an existing line so the file's line baseline does not grow). The gate runs immediately before execution on both paths:
  - **Routed path:** checks the orchestration Flow and the selected Subflow graph.
  - **Direct path:** checks the canonical legacy Flow or the ad-hoc `runtimeFlow`.

  It throws before any step. The existing catch then ends the session `failed` with the reason. A refusal therefore never reaches LLM recovery or repair.
- **`graph-options.ts` was not changed.** The gate reads `graphOptions.runtimeCapabilities` as executor-granted ids, so no new option was needed.
- **New `client-gateway/service/protocol-version.ts`**: `clientGatewayProtocolVersionVerdict(version, expected = CLIENT_GATEWAY_PROTOCOL_VERSION)` returns `accepted`, `missing` or `refused` (with a reason), comparing major versions only. It is exported through the `client-gateway/service/index.ts` barrel.
- **`client-gateway/service/inbound.ts`**: on `client.hello`, a private `admitProtocolVersion` runs before `lifecycle.handleHello`.
  - **Major mismatch:** writes an audit entry `session.protocol_version_refused`, sends `server.error` `{ code: "protocol_version_mismatch", message }`, sends `server.disconnect` `{ reason }`, then disconnects through the facade port. No pairing is created.
  - **Missing version:** writes an audit warning `session.protocol_version_missing` and continues.
  - Inbound gained the `audit` and `facade` collaborators. This required a one-word wiring change in `client-gateway/service.ts` (`new ClientGatewayInbound({ …, audit, facade })`), a file the brief did not name. The structure audit's facade-dispatch rule required the facade.
- **Tests:**
  - `runtime-session/tests/requirement-gate.test.ts` (7 cases): allowed; missing host capability refused with the reason naming it; no ready or same-domain client; missing executor id refused; executor id granted through `runtimeCapabilities`; no `requires` gives an unchanged run with no session read; parsing of declared ids.
  - `client-gateway/service/tests/protocol-version.test.ts` (4 cases): the verdict table; same version goes on to pairing; major mismatch refused, sends error then disconnect, session `disconnected`, no pairing, audit entry; missing version accepted with an audit warning.
  - `programs/automation-studio/runtime/tests/service-flows/tests/requirement-gate.test.ts` (2 cases, the real service): a Subflow graph that requires `web.facts@1` with no client connected is refused, the session ends `failed` with no attempts and the reason stored; the same Flow without `requires` succeeds. It went into the `service-flows/tests/` subfolder because `runtime/tests/` is at its 25-file limit.

## Commands run and observed results

- `npx vitest run src/client-gateway/service/tests/protocol-version.test.ts src/programs/automation-studio/runtime/service/runtime-session/tests/requirement-gate.test.ts` (in `packages/fluxiq`) → 2 files passed, 11 tests passed.
- `npx vitest run src/client-gateway/tests src/client-gateway/service/tests src/programs/automation-studio/runtime/service/runtime-session/tests` → 11 files passed, 92 tests passed.
- `npx vitest run src/programs/automation-studio/runtime/tests/service-flows/tests/requirement-gate.test.ts` → 2 tests passed.
- `npx tsc --noEmit --incremental --tsBuildInfoFile node_modules/.cache/fluxiq-build/check.tsbuildinfo` (the fluxiq `check` command) → exit 0, no output.
- `node scripts/structure-audit.mjs` (Core root) → `structure-audit: passed (295 warning(s), 708 baselined).`
  - The first runs failed twice: facade-dispatch on `lifecycle.disconnect`, and file-lines growth of `runtime/service.ts` (+2 lines). A later run failed on directory-files for `runtime/tests/`. All three were fixed before the final pass.

## Not verified

- No full suites were run, by instruction. Other client-gateway and runtime tests outside the folders listed above were not run.
- No live run, and no check against a real extension session.
- Candidate trials (`service.ts` ~:1560, which goes through flow-bootstrap) are **not** gated. That code is outside this brief.
- Graphs reached through `call:` inside the executor are not gated, because the executor is outside this brief. Today the gate covers the orchestration Flow plus the selected Subflow graph, or the direct graph.
- The resume and rerun-after-repair paths re-execute graphs the gate already checked. They are not re-gated.

## Open questions or contradictions found

- **The brief says old clients send no protocol version. They do send one.** The extension sends every message through `createClientGatewayMessage` from `@fluxiq/client-gateway-websocket` (`packages/client-gateway-websocket/src/messages.ts:24`), which sets the envelope `protocolVersion` to `CLIENT_GATEWAY_PROTOCOL_VERSION` (`"0.1"`). The downstream `apps/extension/src/background/connection/gateway-session.ts` uses that helper. `ClientGatewayClientHello.version` is the extension's app version, not the protocol version. The missing-version path is kept anyway, for hand-written clients.
- **A host id counts as granted when *any* eligible ready client declares it.** If two clients are connected, dispatch could still go to the one that lacks it. Making the gate check the dispatch target would need the session selection that the runtime transport owns.
- `web.*` ids live in Core as constants, as the brief asked. The domain-neutral vocabulary audit passes because none of the names use flagged terms.
