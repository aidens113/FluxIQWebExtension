# Report: w1-domain-mappings

Brief: `### Brief: w1-domain-mappings` in `../briefs/wave-1.md` (Phase 1.1 step 2).

## Outcome

Done. All seven items are fixed and covered by T1 tests. The domain check,
the labelled domain tests and the extension check pass. The structure audit
shows no new finding on the owned paths. One follow-up falls outside this
brief: the extension still has to branch on the new ACTION_REJECTED
rejection (see Open questions 1).

## What changed and why

| Item | Change | File |
|---|---|---|
| 1 scroll | The one mapper keys the scroll input on `web.scroll.changed` (kind `dom.scroll`, which the recorder emits). `dom.wheel` / `web.mouse.wheel` now map to no input. | `domain/src/io/input-model.ts` |
| 2 hub domainId | `GatewayInputHub` reads the top-level `domainId` first, then `metadata.domainId`, matching Core `bridge.ts:281`. A non-object payload is ignored. | `domain/src/io/gateway-input-hub.ts` |
| 3 normalization | `normalizeWebAutomationActionType` is now exported and returns `{ok:true, actionType}` or `{ok:false, code:"ACTION_REJECTED", message}`. Legacy aliases come from the exported reverse map `WEB_AUTOMATION_ACTION_TO_LEGACY_BROWSER`; the inline copy is gone. The canonical check is now strict: before, any `web.*` string passed through unvalidated. `webAutomationActionFromGatewayCommand` returns `WebAutomationActionCommand \| WebAutomationActionRejection`, where the rejection is `{commandId, status:"rejected", code:"ACTION_REJECTED", actionType (verbatim), message}`. That shape matches the domain adapter's `status:"rejected"` form. | `domain/src/client/gateway-mapping.ts` |
| 4 host copies | The host imports `GatewayInputHub` and `dispatchWebAutomationOutput` from `io/`. Its private hub class and `dispatchWebAction` are deleted. The shared dispatcher also honours `metadata.sessionId`, which the host copy ignored. | `domain/src/web-panel-host.ts` |
| 5 one mapper | New `webAutomationRecordedAction(eventType, payload, metadata)` returns `{inputId, outputId, parameters}`, with parameters from `webAutomationOutputPayload`, the function the live output binding already uses. The live `webAutomationInputIdForRecordedEvent` and the proposal `mapWebRecordingObservation` both call it, so proposal candidates now carry `element` (fingerprint) and `visualTarget`. `webAutomationEventTypeForClientKind` moved verbatim from `gateway-mapping.ts` into `io/input-model.ts`. That lets the live path key on the same event type without an io→client barrel skip or a barrel cycle. It is still exported from both barrels. | `io/input-model.ts`, `web-panel-host.ts`, `client/gateway-mapping.ts` |
| 6 host import | Kept the deep dist import and added a comment naming the reason (evidence below). | `domain/src/web-panel-host.ts` |
| 7 dead exports | Deleted `legacyBrowserActionType` and `createWebAutomationStructuredSnapshot`, plus the now-unused `ClientGatewaySnapshot` import. | `domain/src/client/gateway-mapping.ts` |

Decisions taken to unify the two mappers. The paths used to disagree, so one
rule had to be chosen for both:
- **Completeness gates now apply to the live path too.** An event is
  executable only when its output's parameters are complete. That means every
  parameter in the output schema's `required` list is a non-empty string, a key
  press needs a key, and a scroll needs a coordinate. The proposal path
  already enforced these gates. The live path changes only for degenerate
  events: click, input or change without a selector; keydown without a key;
  scroll without coordinates; typed navigation without a URL or with
  `reason: "recording_start"`. The old assertion at `domain.test.ts:220`
  (a selectorless `dom.click` is executable) was deliberately replaced by the
  opposite assertion in `io/tests/input-model.test.ts`.
- Proposal node labels are unchanged ("Click", "Enter text", ...).
- Checkbox/radio still map to `web.dom.type` (row 9 is pinned by a test that
  notes Phase 1.2).

Test placement:
- The live-path assertions moved out of `domain.test.ts` into
  `io/tests/input-model.test.ts`.
- With the proposal parity tests added, `domain.test.ts` reached 479 lines
  and a new 400-line advisory. I moved its web-state/state block verbatim
  (153 lines) to `domain/src/recording/tests/web-state.test.ts`, which is
  inside my owned `domain/src/recording/`. `domain.test.ts` is now 324 lines.

### Mapping-table rows → tests

| Row(s) | Test |
|---|---|
| 1–19 (event type, live input, output, output node id, parameters) | `domain/src/io/tests/input-model.test.ts`, `rows` table, one entry per row |
| 1–19 on the wire (eventType, top-level `domainId`, `metadata.clientKind`) | `domain/src/client/tests/gateway-mapping.test.ts`, `wireRows` |
| 1–19, proposal output and parameters equal live ones | `domain/src/tests/domain.test.ts`, `recordedRows` loop |
| 12 / 13 (scroll fix, wheel unreachable) | `input-model.test.ts` "Row 12 is the fix"; `domain.test.ts` `scrollObservation` |
| 9 (checkbox → type, pinned) | `input-model.test.ts` row 9 |
| Dispatch-only outputs table (wait ×2, extract, capture_snapshot) | `input-model.test.ts` "dispatch-only" block |
| Finding 2 (hub filter) | `domain/src/io/tests/gateway-input-hub.test.ts` (uses the real `createWebAutomationRecordingEvent` payload) |
| Finding 7 (fingerprint on proposal path) | `domain.test.ts` `proposedClick`; `input-model.test.ts` fingerprint block |
| Item 3 (normalization / ACTION_REJECTED) | `gateway-mapping.test.ts`: 11 canonical, 11 legacy, 7 unknown, command mapping |

## Commands run and observed results

- `pnpm --filter @fluxiq-web-extension/domain check` → `tsc -p tsconfig.json --noEmit`, exit=0 (final tree).
- `DOMAIN_TEST_BUILD_LABEL=w1-domain-mappings pnpm --filter @fluxiq-web-extension/domain test` → exit=0.
  It printed "Web automation gateway mapping tests passed.", "Gateway input
  hub tests passed.", "Web automation input model tests passed.", "Web
  automation recording state tests passed.", "Web automation domain smoke
  test passed.", and `# tests 26 / # pass 26 / # fail 0`.
- `pnpm --filter @fluxiq-web-extension/extension check` → exit=0 (final tree).
- `node scripts/structure-audit.mjs --json`:
  - Failures: only `[working-docs] docs/working/README.md`. That is a shared
    document; I did not touch it. An earlier run also failed the plan doc at
    824 lines, and that failure had gone by the final run.
  - Warnings on owned paths: only the web-state.ts warnings (exported-values 11, file-lines 644), both present in my first audit run before any edit.
  - **Can be lowered:** `[imports] domain/src/client/index.ts 2 -> 1`. This
    comes from another worker's barrel edit, not mine. I did not run
    `pnpm structure:baseline`.
- Item 6: I switched line 2 to `from "fluxiq/automation-studio"` in a single
  command that restored the file from a scratch backup at the end, and ran
  the checks on Node v22.11.0:
  - `domain check` passed.
  - `host:build` emitted `require("fluxiq/automation-studio")`.
  - Loading the host through `createRequire`, as Core `apps/web/src/lib/fluxiq.ts:147` does, failed with
    `ERR_PACKAGE_PATH_NOT_EXPORTED Package subpath './automation-studio' is not defined by "exports"`.
  - After the restore, the same load gave `external requires in bundle: []`,
    `GatewayInputHub classes in bundle: 1`, `loaded: registerFluxIQHost=function`,
    and `registered: inputs=9 outputs=11 recordingDomain=true` on a real `FluxIQ.create({loadEnv:false})`.
- Zero-hit greps, repo-wide, excluding node_modules, dist, build, .test-build, .test-build-scratch, .script-build, test-runs, .git:
  - `legacyBrowserActionType` [0]
  - `createWebAutomationStructuredSnapshot` [0]
  - `dispatchWebAction` [0]
  - `?? "web.dom.extract"` [0]
  - `class GatewayInputHub` [1] (`domain/src/io/gateway-input-hub.ts:9`)
- Type-check of the tests: `domain check` excludes `src/**/tests/**`, so I
  ran `tsc` against a scratch tsconfig covering `io/tests`, `client/tests`,
  `recording/tests` and `domain.test.ts`.
  - Result: 0 errors in the new files, after fixing one TS2367 in my own test.
  - The 15 remaining errors predate this work. Ten are in the block moved to
    `recording/tests/web-state.test.ts`; five are in `domain.test.ts` at
    lines 156, 246, 272, 273 and 297, all outside my added block.

## Not verified

- No live gateway, browser, or Core session was exercised. The hub was tested
  with a fake `clientGateway.onEvent`. I did not check which Core subscribers
  now start receiving user-recorded action inputs, or what they do with them
  (audit open question 2).
- Recording → Subflow end to end was not run. From reading Core, the
  fingerprinted parameters go through `normalizeRecordingCandidateElementTargetParameters`
  and `appendRecordingProposalToFlow` (`service.ts`), which turn top-level
  `selector`/`element`/`visualTarget` into a `target` and clone the
  parameters onto the node.
- How the unchanged extension handles a rejection was not run. By reading the
  code: `result-mapping.ts` casts it to `BrowserActionCommand`, and the
  content dispatcher then fails it with "Unsupported action type: <raw>".
  That is safer than the old silent `web.dom.extract`, but the
  ACTION_REJECTED code does not reach the wire.
- Extension `build`/`test` were not run; they are not in this brief's definition of done.

## Open questions or contradictions found

1. **Extension integration.** `apps/extension/src/runtime/result-mapping.ts`
   (caller `background/connection/gateway-session.ts:276`) should branch on
   `status === "rejected"`: send a failed `client.action_result` carrying
   code ACTION_REJECTED, and not dispatch to the tab.
   `ClientGatewayActionResult.status` has no `"rejected"` value. This is
   outside my ownership.
2. **Docs.** `docs/architecture/extension-client.md` needs updating for five
   changes: scroll is executable, the hub accepts a top-level `domainId`,
   unknown command types are rejected, legacy aliases are normalized in one
   place, and the host import rationale. That file is not owned by this brief.
3. **Behaviour change to confirm.** The live path now applies the
   completeness gates. I believe the extension never emits such events for
   real user actions, since `describeElement` always gives a selector.
4. **Ownership deviation.** `domain/src/recording/tests/web-state.test.ts`
   is outside the brief's "new tests under io/tests and client/tests"
   wording, but inside owned `domain/src/recording/`. It was created to avoid
   a new file-lines finding.
5. **Tests are never type-checked.** No gate type-checks domain tests
   (`tsconfig.json` excludes them), and 15 errors predate this work. A
   test tsconfig in `pnpm check` would enforce it.
6. **Unproduced event types.** `recording/events.ts` still registers event
   types nothing produces (focused, blurred, mouse wheel, snapshot captured,
   client error). This was not in the seven items; I left it unchanged.
