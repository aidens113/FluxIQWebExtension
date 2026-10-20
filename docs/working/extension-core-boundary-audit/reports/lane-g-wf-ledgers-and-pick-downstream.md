# Report: lane-g-wf-ledgers-and-pick-downstream

## Outcome

Done. Reconciliation, host-lease checking and session picking downstream now run on Core's
`@fluxiq/client-gateway-websocket` (`reconcile/`, `host-lease/`, `storage-area/`, `session-pick/`).
The downstream copies are deleted and every caller now uses Core's versions. Nothing in Core was
edited.

## What changed and why

Extension, `apps/extension/src/background/connection/`:
- `in-flight/`: deleted `command-reconciliation.ts`, `record-store.ts`, `seen-store.ts` and
  `tests/command-reconciliation.test.ts`, because Core's `reconcile/` tests now cover what they did.
  - New `web-reconciliation.ts` `webCommandReconciliation({ area, queuedResult, send, now? })`. It
    builds Core's `ClientGatewayCommandReconciliation` over Core's record and seen stores, using the
    default key prefixes `fluxiq.inFlight.` and `fluxiq.commandSeen.`, which are the keys earlier
    builds wrote. It passes in three domain functions: `webAutomationActionCommits`,
    `webAutomationInterruptedActionResult`, and the new `webAutomationNotSeenActionResult`.
  - `record-area.ts` now returns `ClientGatewayStorageArea` and falls back to Core's
    `clientGatewayMemoryArea()`. `workerMemoryRecordArea` is gone; tests use Core's memory area.
  - Updated the barrel.
- `host-lease/`: deleted `ledger.ts` and `tests/ledger.test.ts`.
  - New `session-ledger.ts` `sessionHostLeaseLedger(area = inFlightRecordArea())` creates Core's
    `ClientGatewayHostLeaseLedger` with the default `fluxiq.hostLease.` prefix.
  - New `tests/session-ledger.test.ts` checks the key and that a restarted worker sees the stored
    lease.
  - `tests/channel-wiring.test.ts` now uses `sessionHostLeaseLedger`, `webCommandReconciliation` and
    Core's `ClientGatewayHostLease` type.
- `server-command-channel.ts`: uses Core's types.
  - `begin({ commandId, actionType, parameters: options }, tabId ? { tabId } : undefined)`.
  - A private `noteDispatch` works out `{ tabId, documentId? }` with `frameDocumentId` and calls
    `placed`.
  - `ownReconciliation` uses `webCommandReconciliation`.
  - The default ledger is `sessionHostLeaseLedger()`.
- `in-flight/tests/channel-wiring.test.ts` and `reconcile-request.test.ts` now use the factory and
  the new `begin` signature.
- New `in-flight/tests/web-reconciliation.test.ts` covers what the web domain decides:
  - a press commits, and a typing commits only when it submits;
  - the typed value is never kept in the record;
  - the record is stored under the old key, with the place `{ tabId, documentId }`;
  - a lost press is reported `unknown`/`ambiguous` and a lost typing `failed`/`unacted`, and neither
    report names the page;
  - a late copy of a command answered `not_seen` is refused with `web.transport.transient`/`unacted`.

Domain, `domain/src/`:
- `client/`: deleted `host-lease.ts`, `tests/host-lease.test.ts`, `reconcile/answer.ts` and
  `reconcile/tests/answer.test.ts`.
  - The two assertions in `answer.test.ts` that were not about the answer moved into tests named for
    their subjects: `reconcile/tests/not-seen-outcome.test.ts` and a new
    `interrupted-action/tests/dispatch-reading.test.ts`.
  - New `reconcile/not-seen-result.ts` `webAutomationNotSeenActionResult(commandId, at)`, moved from
    the extension's private `notSeenResult`, with `reconcile/tests/not-seen-result.test.ts`.
  - Updated the barrels: removed `./host-lease` from `client/index.ts`.
- `runtime/web-sessions/`: one rule for which session a web build may drive.
  - New `criteria.ts` `WEB_AUTOMATION_SESSION_CRITERIA`: an extension client whose `web.actions`
    capability either has `metadata.domainId === "web-automation"` or offers
    `web.dom.capture_snapshot`.
  - `isEligibleWebSession` now calls Core's `clientGatewaySessionEligible`.
  - New `pick-web-session.ts` `pickWebAutomationSession(sessions, requestedSessionId?)` calls
    `pickClientGatewaySession`.
  - Updated the barrel.
- `runtime/host-resources/leasable-session.ts`, `runtime/adapter.ts` (`selectWebAutomationSession`)
  and `io/gateway-output-dispatcher.ts` (`targetSessionId`) all call `pickWebAutomationSession`.
  - An empty-string `metadata.sessionId` still counts as no request, as it did before.
  - Removed the dispatcher's now-unused `WEB_AUTOMATION_DOMAIN_ID` import.
- New tests for the rule change:
  - `web-sessions/tests/pick-web-session.test.ts`;
  - `host-resources/tests/leasable-session.test.ts`;
  - `runtime/tests/adapter-session-pick.test.ts`;
  - `io/tests/gateway-output-dispatcher-session-pick.test.ts`;
  - a disconnected-session case in `eligible-web-session.test.ts`.

  They show that a second session that is unpaired, only `connected`, recording or disconnected
  neither blocks the pick nor gets picked. They also show that a requested id is used only when that
  session is eligible, and that two eligible sessions with no request pick none.
- I updated the test fixtures in 11 dispatcher and adapter test files
  (`io/tests/gateway-output-dispatcher{,-check-wait,-cleared-layers,-interrupted,-route}.test.ts`,
  `runtime/tests/adapter{,-check-wait,-read-value,-redaction,-route,-text-sighting}.test.ts`). Their
  `web.actions` capability listed only action types such as `web.dom.click`, with no domain id. The
  stricter rule rejects that, so each fixture now also has `metadata: { domainId: "web-automation" }`.
  That is what the real extension declares (`runtime/capabilities.ts`, `web.actions` metadata).

## Commands run and observed results

- `npx tsc -p tsconfig.json --noEmit` and `npx tsc -p tsconfig.test.json --noEmit` in `domain/`:
  both exit 0.
- `npx tsc -p tsconfig.json --noEmit` and `npx tsc -p tsconfig.test.json --noEmit` in
  `apps/extension/`: both exit 0.
- `DOMAIN_TEST_BUILD_LABEL=lane-g-wf node domain/scripts/test-domain.mjs client/ web-sessions host-resources runtime/tests/adapter io/tests/gateway-output-dispatcher`:
  `# tests 167 # pass 167 # fail 0`, across 34 bundles. These were every test under `client/`, plus
  web-sessions, host-resources, all `adapter*` and all `gateway-output-dispatcher*` tests.
- `DOMAIN_TEST_BUILD_LABEL=lane-g-wf-ev node domain/scripts/test-domain.mjs llm-evidence/tests/tools llm-evidence/tests/result-observation/tests/binding llm-evidence/structure/tests/detect`:
  `# tests 31 # pass 31 # fail 0`. I ran these because the evidence tools use `isEligibleWebSession`.
- `EXTENSION_TEST_BUILD_LABEL=lane-g-wf node apps/extension/scripts/test-extension.mjs in-flight host-lease server-command-channel`:
  `# tests 36 # pass 36 # fail 0`. The bundles were host-lease channel-wiring, gateway-carriage and
  session-ledger; in-flight channel-wiring, reconcile-request and web-reconciliation; and
  server-command-channel.
- `node scripts/structure-audit.mjs`: `structure-audit: passed (215 warning(s), 638 baselined).` The
  counts match the lead's last run. The only warnings that touch my files are the existing advisory
  `file-lines` warnings: `server-command-channel.ts` is now 423 lines (it was 413, already over 400),
  and `runtime/adapter.ts` is 483 lines (it shrank).

## Not verified

- The tests were written in the same pass as the code, and I first ran them after both existed. I
  never saw them fail first. My claim that the session-pick tests would fail under the old loose rule
  (an only-`connected` second session made two eligible sessions) is reasoning; I did not run it.
- `noteDispatch` with a real `chrome.webNavigation.getFrame` is not covered: the Node test runner has
  no `chrome`, so `frameDocumentId` returns undefined there. Neither is a live browser.
- No full suites and no Playwright, as the brief said.

## Open questions or contradictions found

- **Behaviour change in the snapshot path and the output dispatcher (intended by the brief).** A
  session that is only `connected` (not `ready`) is no longer picked. Neither is a recording or
  disconnected session, nor one whose `web.actions` lists `web.*` action types with no domain id and
  no `web.dom.capture_snapshot`. The real extension's capability carries the domain id, so live
  pairing should be unaffected.
- **Message wording changed.** Host-lease refusals now come from Core and say "client" where the
  domain's said "browser", for example "The client has seen epoch N for this resource." The
  channel-wiring regex `seen epoch N ` still matches.
- **Stale references in files outside my ownership**, for the lead's docs step:
  - `docs/architecture/extension-client.md:333` cites `domain/src/client/host-lease.ts`.
  - `apps/extension/src/background/connection/gateway-session.ts:255` cites
    `in-flight/command-reconciliation.ts`; it should now cite `in-flight/web-reconciliation.ts`.
- **Format change in stored records.** In-flight records written by this build keep the tab and
  document under `place`. Records an older build left in session storage, with top-level
  `tabId`/`documentId`, still load, because Core's reader ignores those fields and keeps the record.
- **Git index.** I briefly staged the four domain deletions with `git rm`, then unstaged them at once
  with `git restore --staged`. The index is as I found it, and nothing was committed.
