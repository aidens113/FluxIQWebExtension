# Shared clock web discovery

Outcome: Done
Changed: `docs/working/framework-heavy-lifting-plan/reports/codex-1031/shared-clock-web-discovery.md` only
Validation: Read-only source inspection; tests not run as brief directed.
Not verified: No runtime execution or browser behavior; no test suite run.
Report: `docs/working/framework-heavy-lifting-plan/reports/codex-1031/shared-clock-web-discovery.md`
Notes: t823 already contains downstream plumbing for a `now` value, but Core does not currently pass the run start to native node callbacks.

## Findings

- Relative-date semantics already exist in the web domain. `domain/src/actions/extraction/request.ts:455` defines optional `now`; `read-request.ts:207` accepts only a non-negative integer, and `schema.ts:161` declares it. The request documentation says dispatch sets this from run start.
- The page uses `request.now ?? Date.now()` in `apps/extension/src/content/extraction/item-filter.ts:134`. Relative-date ordering separately defaults to `Date.now()` in `apps/extension/src/content/extraction/order-rows.ts:90`; currently this is a sort clock, not the `where` filter clock. K1 date parity is covered by `domain/src/actions/extraction/tests/condition-date.test.ts` and `apps/extension/src/content/extraction/tests/item-filter-date.test.ts`; shared date cases are consumed by both.
- Dispatch injection is already implemented in `domain/src/output-nodes/extract-list/dispatch.ts:133,199-202`: `withRunNow` inserts `extractList.now` only for a valid run start, a parsed request with `where`, and no existing request `now`. `domain/src/output-nodes/native-runtime.ts:94-97` currently probes a cast `context.runStartedAt`, with an inline comment that the field is not yet in Core's `AutomationStudioNativeNodeContext`.

## Propagation path and missing edge

1. A Flow's extract-list native node returns a dispatch effect with `parameters` (the embedded `extractList` request) from `native-runtime.ts`.
2. The domain runtime adapter dispatches the effect; `domain/src/io/gateway-output-dispatcher.ts:27-29` maps `outputId` to `actionType` and carries the entire effect `payload` as command `parameters`.
3. The client gateway maps the `extractList` parameter into the browser action (`domain/src/client/gateway-action-parameters.ts:90`; `apps/extension/src/background/extraction/confirm.ts:76` also builds the same browser action shape for the standalone extraction flow).
4. The background server command route forwards action parameters into the action's options (`apps/extension/src/background/connection/server-command-channel.ts:266`); content action execution passes `action.extractList` to `deps.extractList` (`apps/extension/src/content/actions/extract-list.ts:96-103`), which reaches `itemFilterFor`.
5. The missing propagation is before step 1: Core's native callback request type in `!FluxIQ/packages/fluxiq/src/programs/automation-studio/runtime/executor/contracts.ts:750` carries node, inputs, signal, and host context, but no run start. `AutomationStudioNativeNodeContext` in `!FluxIQ/packages/fluxiq/src/programs/automation-studio/nodes/importer-sdk.ts:73-88` likewise has no `runStartedAt`. Although graph options have `now?: () => number` (`.../runtime/executor/contracts.ts:704`) and the graph records `startedAt` (`.../runtime/executor/graph-run.ts:147`), `node-execution/attempt.ts:139-149` does not pass either to `nativeNodeExecutor`.

## Existing optional execution context and compatibility

`!FluxIQ/packages/fluxiq/src/runtime/contracts.ts:147-153` has `FluxIQRuntimeExecutionContext.now?: () => number` (alongside `runId`, `signal`, and `commandContext`). The downstream `domain/src/runtime/adapter.ts:80-101` accepts that context but only forwards command context and signal to the output dispatcher; it does not use `context.now`. This context belongs to the runtime-command adapter path and does not currently bridge into the native Flow node callback. The narrowest shared clock is therefore the graph's captured run start, passed through the Core native-node request/context, then read by the already-present `withRunNow` plumbing. Avoid sampling `context.now()` at each node if semantics require the single instant captured when the Flow began.

`now` is optional for old callers and the page retains its local-clock fallback. Injection is scoped to filtered extraction and preserves a request that already has `now`, matching current code comments; changing whether authors may supply it would be a separate contract decision. No protocol shape change is needed after the native node emits the parameter: the existing `extractList` JSON path carries it end to end.

## Provider-free Chromium probe discovery (follow-up)

The smallest existing real-browser harness is the extension T2 content harness:

- Config: `apps/extension/e2e/playwright.content.config.ts` launches headless `channel: "chromium"`, sets `timezoneId: "UTC"`, and uses the local Scenario Lab fixture.
- Harness: `apps/extension/e2e/content/harness.ts` starts the Scenario Lab, opens only an allowed realistic scenario, injects the built content and page-world bundles, and exposes `runAction` to send an actual `web.dom.extract_list` command to the content script. It does not load the extension, start the FluxIQ panel, or call Core/model APIs.
- Fixture and useful extraction target: `everything-store`, `/scenarios/everything-store/s?k=wireless+earbuds&rh=plus`; the page has matching result rows and advertised rows. `apps/extension/e2e/content/tests/extraction/tests/item-conditions.spec.ts` contains the focused filter spec and direct row-count oracle.
- Exact narrow command (not executed): `pnpm --filter @fluxiq-web-extension/extension test:content -- e2e/content/tests/extraction/tests/item-conditions.spec.ts --grep "a where condition on the store's own ad mark reads the results and leaves the sponsored cards out"`. The package script builds the harness bundles and passes the file/grep to Playwright; this exercises Chromium but does not prove a date clock.

No existing realistic-fixture Chromium spec was found that exercises relative date filtering or date sorting. `item-conditions.spec.ts` covers presence filters and a numeric bound. The job-board fixture uses a deliberately fixed scenario clock (`apps/scenario-lab/src/scenarios/job-board/catalog/age.ts`, `REFERENCE_NOW_MS = Date.UTC(2026, 8, 21, 8, 0, 0)`), so it is a poor choice for proving behavior relative to the wall clock after midnight. For the requested date proof, the same existing `openContentHarness`/`runAction` seam can send a focused `extractList` request with the supplied `now` and assert record identities/counts against independently read DOM data, but no checked-in command/spec currently encodes that supplied-reference probe. A one-off Playwright probe or a new focused spec is needed; the command above is only a harness smoke path.
