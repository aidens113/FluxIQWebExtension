# t536-w1-web-lease: the web side of the host lease

## Outcome

Done. All five parts of the brief are built and tested: the port, the domain lease rule and refusal, carrying the lease through the extension, the channel check with a ledger that survives a restart, and the leased tab. Every named check passes except the `core-build` freshness gate, which fails because Core's half (t536-a3b) keeps editing Core source in the sibling worktree. Typechecks and tests were run directly against a Core build I made at 18:3x (details below). The Chromium content-harness check cannot be done because that harness has no background worker (see Not verified).

## What changed and why

**Domain: the host-resource port** (new `domain/src/runtime/host-resources/`)
- `capacity.ts` sets `WEB_AUTOMATION_HOST_RESOURCE_CAPACITY = 1`, and a test pins it.
- `resource-key.ts` builds the key `web.automation:<clientId>`.
- `leasable-session.ts` restates the build-path rule from `llm-evidence/tools.ts` `eligibleWebSessionIds`: ready, an extension, not recording, and offering web actions. That function is private, and I was not allowed to edit it, so the rule now exists in two places. The function returns the session only when exactly one qualifies.
- `port.ts`: `createWebAutomationHostResourcePort({ sessions, now? })` returns an `AutomationStudioHostResourcePort`.
  - `acquire` answers `at_capacity` when zero or two sessions qualify, and while a grant is still held.
  - Each epoch is `max(last + 1, floor(now()))`, so epochs are seeded from the clock and rise across a restart.
  - `release` clears the held grant only when both key and epoch match.
  - Every grant also sets `sessionId` to the qualifying session's gateway session id. The supervisor asked for this mid-task so that Core scopes its strict lease checks to that one client. Core's `types.ts` adds `sessionId?` on the branch. My Core dist predates that field. The grant is built with `Object.freeze`, which skips TypeScript's excess-property check, so the port compiles against both the old and the new type. The port tests assert the field.
- `host-runtime.ts` now takes an optional second parameter, `sessions` (default `() => []`), and returns `hostResources` built from it. `WebAutomationHostRuntime` gains `hostResources`, and `bindWebAutomationHostRuntime` passes `fluxiq.programs.clientGateway.snapshot().sessions`. Existing callers are unchanged.

**Domain: the lease rule** (new `domain/src/client/host-lease.ts`, exported from the client barrel)
- `WebAutomationHostLease` is `NonNullable<ClientGatewayActionCommand["lease"]>`.
- `WEB_AUTOMATION_HOST_LEASE_REFUSAL_CODES` restates Core's three codes, with `satisfies typeof CLIENT_GATEWAY_HOST_LEASE_REFUSAL_CODES`. It is a type-only import from `fluxiq/client-gateway`, so the extension bundle does not pull in Core's gateway service, and any drift on Core's side is a compile error.
- `webAutomationHostLeaseReading(value)` returns `none`, `lease` (a copy holding only the contract fields) or `unreadable`.
- `webAutomationHostLeaseJudgement(lease, seen)` returns `adopt`, `current`, `stale` or `holder_mismatch`.
- `webAutomationHostLeaseRefusalCode` maps a judgement to its refusal code.
- `webAutomationHostLeaseRefusal(commandId, code, at, seenEpoch?)` builds a `failed` result with failure `{category: "blocked_by_capability_or_policy", code, retryable: false, stage: "dispatch", effect: "unacted"}` plus `expected`/`actual`, and payload `{commandId, status: "refused", code}`. Core's `parseAutomationStudioFailureRecord` accepts this record for all three codes.

**Extension**
- `shared/protocol.ts`: the `execute_action` and `evaluate_facts` payloads gain `lease?: WebAutomationHostLease`.
- `gateway-session.ts`: a `withLease` helper attaches `message.payload.lease` beside the mapped action or fact check. The mapping drops fields it does not know, so the lease cannot ride inside the action.
- New `background/connection/host-lease/`, class `HostLeaseLedger`:
  - It keeps the highest lease per resource key under `fluxiq.hostLease.<resourceKey>`, in the same storage area as the in-flight records (`inFlightRecordArea()`, which is `chrome.storage.session`).
  - An in-memory copy sits in front of storage.
  - Judgements run one at a time, so two concurrent epochs cannot leave the lower one stored.
  - A storage fault is handed back as `fault`. A lease the worker already judged still counts.
  - `verdict(commandId, wireLease)` turns the wire value into `{refusal?, fault?}`.
- `server-command-channel.ts`:
  - New optional dependency `hostLeases`.
  - In `execute_action`, after `answerRepeat` and before `reconciliation.begin`, a refusal is sent directly, with no runtime status, boundary or recorded event. It is then `settled` in reconciliation, with `release` in a `finally`.
  - `evaluate_facts` refuses the same way, before `evaluateFacts`.
  - An admitted command calls `executeAction(action, { leased: lease !== undefined })`.
  - A storage fault is reported as the warning activity "Could not keep the browser's host lease".
- `runtime/command-router.ts`: `executeAction(action, { leased? })` sets `request.leased`.
- `runtime/action-runner.ts`:
  - `BrowserActionRunRequest.leased`.
  - `tabRequestFor`: for a leased command, a named tab wins first, then `latestOpenAutomationTab()`, then the old rule (the tab in front, or `navigationTargetTab` for a navigation).
  - `unsupportedPageReasonFor` no longer applies the connection's front-tab reason to a leased command that runs on a different tab. Otherwise a `chrome://` page in front would refuse the build's action on the automation tab.
- Docs:
  - `extension-client.md`: a "A command under a host lease" paragraph under Staying Connected.
  - `web-capabilities.md`: a new "Host Leases" subsection after Commands In Flight.

**Tests added**
- `domain/src/runtime/host-resources/tests/port.test.ts` (6): capacity is pinned at 1, including through `hostRuntime.hostResources`; the key uses the client id; zero, two or only ineligible sessions answer `at_capacity`; a held lease blocks, and the next epoch is higher; epochs rise across a restarted port; Core's real `AutomationStudioHostResourceScheduler` serializes two builders through the port.
- `domain/src/client/tests/host-lease.test.ts` (3): reading, the judgement rules, and the exact refusal record, which Core's parser accepts.
- `apps/extension/src/background/connection/host-lease/tests/ledger.test.ts` (5): adopt, current, stale and mismatch; keys are kept apart; the ledger survives a worker restart; concurrent judgements are serialized; a storage fault is handled.
- `apps/extension/src/background/connection/host-lease/tests/channel-wiring.test.ts` (8):
  - Stale, mismatched and unreadable leases each get the exact refusal. In each case `boundary before` is never logged, so the router is never reached; the runtime status is unchanged, nothing is recorded, and no in-flight record is left.
  - A repeated id is answered with the refusal, and `server.reconcile_command` answers `landed` with it.
  - A higher epoch is adopted, and the epoch before it then becomes stale.
  - A command with no lease, when no lease has ever been seen, runs.
  - A restarted worker, using the same storage area, refuses the lower epoch.
  - A fact check under a stale lease is refused.
  - This file sits in `host-lease/tests/`, following the precedent of `in-flight/tests/channel-wiring.test.ts`. Putting it in `connection/tests/` broke that directory's 25-file limit.
- `apps/extension/src/background/connection/host-lease/tests/gateway-carriage.test.ts` (2): a lease delivered on a fake socket reaches `onCommand` for an action and for a fact check, and an unleased action arrives without a `lease` key.
- `apps/extension/src/runtime/tests/leased-tab.test.ts` (6):
  - A leased click and a leased navigation use the automation tab (12) while tab 41 is in front.
  - An unleased click still uses the tab in front (the control case).
  - A named tab wins.
  - With no automation tab open, a leased command falls back to the tab in front.
  - A `chrome://` page in front does not refuse a leased command bound for the automation tab.

## Commands run and observed results

- Core libraries, in `fxwork/t536/!FluxIQ`: `pnpm --filter @fluxiq/contracts --filter fluxiq --filter @fluxiq/client-gateway-websocket build` printed "Done" for all three packages and took 1m05s. Core's `git status` was clean at the time. This build was needed because `fluxiq` dist did not yet export the host-resource port. Core is the command the `core-build` gate names.
- `pnpm --filter @fluxiq-web-extension/domain check` failed at the `core-build` gate: "Core's build ... is 3 minute(s) behind its source. Stale: ...project-agents/host-resources/lease-scope.ts". That file is the concurrent Core worker's new source. I did not rebuild Core a second time over their in-progress edits.
- Run directly instead:
  - `domain`: `npx tsc -p tsconfig.json --noEmit` exit 0; `npx tsc -p tsconfig.test.json --noEmit` exit 0.
  - `apps/extension`: `node scripts/check-extension.mjs` exit 0. This runs tsc on both the src and test configs.
- `DOMAIN_TEST_BUILD_LABEL=t536-w1 node scripts/test-domain.mjs host-resources/tests client/tests runtime/tests/host-runtime runtime/tests/carried state-digest/tests/call-route-states` gave "# tests 92, # pass 92, # fail 0".
- `EXTENSION_TEST_BUILD_LABEL=t536-w1 node scripts/test-extension.mjs background/connection/host-lease/tests background/connection/in-flight/tests background/connection/tests/gateway-session runtime/tests/leased-tab runtime/tests/action-runner runtime/tests/navigate-action runtime/tests/command-options runtime/tests/fact-check-runner` gave "# tests 122, # pass 122, # fail 0", exit 0.
- `pnpm structure:check` gave "structure-audit: passed (194 warning(s), 644 baselined)". Advisory warnings on my touched files:
  - `server-command-channel.ts` is now 413 lines (it was 375), past the 400-line advisory.
  - `action-runner.ts` is 504 lines (it was 488 and already past the advisory).
  - Nothing failing.
- `node apps/extension/scripts/build-extension.mjs` verified 22 files for each of chrome, firefox and e2e-chromium. The background bundle contains `host_lease.stale` (3 hits).

## Not verified

- **Chromium content-harness check:** not done. The T2 content harness (`e2e/content/harness.ts`) runs only the content-script bundle against a `chrome.runtime` stub. It has no background worker, so it cannot drive `ServerCommandChannel`, which is where the lease check lives. The right live check would be a spec in `e2e/` in the style of `reconnect.spec.ts`: a stand-in gateway sends two leased `server.execute_action` messages to the loaded extension, and the spec reads the refusal. That spec does not exist and was not written.
- **Live browser behaviour:** none checked. That covers the real `chrome.storage.session` across a real service-worker restart, and the real tab focus while a builder drives tab 12 with a person's tab in front.
- **The `core-build` gate is not green.** Every check above ran against my Core build of `aae461d9` plus a clean tree. A green gated run needs Core rebuilt after t536-a3b finishes.
- **`sessionId` against Core's updated type:** I set the field after Core's `types.ts` gained `sessionId?`, but my Core dist was built before that change, so I have not typechecked it against the new declaration. Rebuild Core, then rerun the domain typecheck to confirm.
- **Core consumption of `hostRuntime.hostResources`:** whether Core's boundary type declares `hostResources` and binds a scheduler from it is Core's half, and I did not check it. The extra field typechecks only because `WebAutomationHostRuntime` adds it on top of Core's boundary type.
- I did not run the full domain or extension suites (per AGENTS.md, full suites run at most twice a day).

## Open questions or contradictions found

1. **A lease-less command after leases have been seen runs.** Core defines `host_lease.missing`, but the brief named only stale and holder_mismatch for refusals, and its DoD covers only the lease-less case when no lease was ever seen. Refusing every lease-less command once any lease had been seen would block saved-Flow playback for the rest of the browser session, because `chrome.storage.session` lives until the browser closes. I used `missing` only for a lease that is present but unreadable. If Core wants `missing` for lease-less commands during a project build, the extension needs a signal for when a project build is active, because it cannot infer this.
2. **The session rule is duplicated.** `leasable-session.ts` restates `eligibleWebSessionIds` from `llm-evidence/tools.ts`, which this brief forbade editing. A follow-up should export one rule from one module and have both use it.
3. **The epoch-across-restart guarantee is clock-based.** If a port grants more than one lease per millisecond and Core restarts within that same lead, the epochs could fall behind. This does not happen in practice because a lease lasts a whole brief, and it is documented in `port.ts`.
4. **The brief's "lease names the tab" is not on the wire.** `ClientGatewayHostLease` carries no tab id, so the extension maps "leased, no named tab" to the automation tab locally. Per-lease tab ids would come with capacity above 1.
5. **No runtime barrel export.** `domain/src/runtime/index.ts` does not export `host-resources`: it is not in my owned paths, and Core reaches the port through `hostRuntime.hostResources`. Add `export * from "./host-resources"` there if a consumer needs the symbols directly.
