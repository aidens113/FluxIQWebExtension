# t392 unit H: cleared layers on the attempt trace and a step `interference` recovery row

## Outcome

Mostly done. Core records the layers on the attempt, emits the step row, and the
contract and extension reader know the kind. **The field never reaches Core from
the live extension yet.** One domain line is needed first (see "Domain change
needed"); domain is not mine.

## What changed and why

### Trace (step 1)

The trace from the client's result to the executor:

1. Extension `content/action-runtime/recovery/record.ts` sets
   `result.clearedLayers`.
2. Domain `client/gateway-mapping.ts` `webAutomationActionResultPayload` copies
   it into the `client.action_result` **payload**.
3. Core's client gateway passes `payload` through unchanged.
   `runtime/client-gateway-transport.ts` reads only `failure`/`clearedWait`.
4. Domain `io/gateway-output-dispatcher.ts` wraps the client payload as the
   dispatch payload `{ status, message, result: <client payload>, route }`.
   `runtime/adapter.ts` keeps that shape on the runtime path.
5. Core `io-policy.ts` puts the dispatch payload at the node result's
   `outputs.result`, on both success and failure and on both paths.
6. The executor `node-execution/attempt.ts` receives it.

Today the field therefore sits at `outputs.result.result.clearedLayers`, a
web-domain nesting. Core does not read domain payloads
(`docs/architecture/runtime-kernel.md` says so for `clearedWait`). The one key
Core does read off a dispatch payload is `route`, at its top level. So Core now
reads `clearedLayers` from the **top of the dispatch payload**
(`outputs.result.clearedLayers`), the `route` convention. A test pins that the
nested copy is *not* read.

Core files:

- `packages/fluxiq/src/programs/automation-studio/runtime/executor/contracts.ts`:
  - new types `AutomationStudioClearedLayerKind`, a closed vocabulary:
    `consent | rate_limit | promotion | assistant | dialog`;
  - new type `AutomationStudioClearedLayer` (`{ kind; control: string }`);
  - `clearedLayers?: AutomationStudioClearedLayer[]` on
    `AutomationStudioNodeAttemptTrace`.
- New file `runtime/executor/node-execution/cleared-layers.ts`, exporting
  `automationStudioClearedLayersOf(payload)`. It is the defensive reader:
  - a known `kind` only;
  - `control` passed through `automationStudioActivityReasonText(control, 40)`
    (whitespace collapsed, token-shaped runs hidden, bounded);
  - extra fields dropped;
  - at most 12 per dispatch;
  - malformed or absent input reads as `[]`.
- `runtime/executor/node-execution/attempt.ts`:
  - `RecordCaptureTarget` gains a `cleared` collector;
  - each dispatch's answer is read before record capture, failed dispatches
    included;
  - the definition and native paths stamp `clearedLayers` on the attempt
    through `clearedLayersSaid`, which also emits the row once per attempt;
  - an attempt with no layers has no field and says nothing.

### Wire (step 2)

- `packages/contracts/src/client-gateway.ts`:
  - `interference` added to `CLIENT_GATEWAY_ACTIVITY_RECOVERY_KINDS`, with doc
    comments (additive);
  - `detail.recovery` comment updated.
- New file `runtime/activity/step/interference.ts`, exporting
  `emitAutomationStudioActivityStepInterference({ nodeId, kinds })`. It emits
  one `step` row through `emitAutomationStudioActivityStepRecovery` with
  `{ kind: "interference", subject, outcome: "succeeded" }`. The subject is
  Core's words by kind:
  - consent: "Closed a consent notice the page put in the way"
  - rate_limit: "Closed a slow-down notice the page put in the way"
  - promotion: "Closed a promotion the page put in the way"
  - assistant: "Closed a chat window the page put in the way"
  - dialog: "Closed a notice the page put in the way"
  - several layers: "Closed N notices the page put in the way"

  The subject never carries the control's words.
- `runtime/activity/step/recovery.ts`: a `FALLBACK_SUBJECT` entry for
  `interference`, which the Record type requires. The doc comment is updated.
- `runtime/activity/step/index.ts` and `runtime/activity/index.ts`: barrel
  exports.

### Contracts dist and extension (step 3)

- `pnpm --filter @fluxiq/contracts build` rebuilt the dist; it now contains
  `interference`.
- Downstream `apps/extension/src/shared/activity/step-recovery.ts`:
  `interference: true` added to `KINDS`, and the header comment updated.
- `apps/extension/src/shared/activity/tests/step-recovery.test.ts`: a new test
  that an interference recovery is read whole and that a stray `event` is
  dropped.

### Docs (step 4)

- Core `docs/architecture/automation-studio/client-gateway.md`: the step
  `recovery` paragraph lists `interference`, and a new paragraph covers the row,
  its subjects and the guarantee that no page text appears.
- Core `docs/architecture/automation-studio.md`: a paragraph after the
  `targetResolution` attempt-field paragraph documents `clearedLayers`: its
  shape, where it is read from, its bounds, and that failures carry it too.

### Tests added (Core)

- `runtime/executor/node-execution/tests/cleared-layers.test.ts` (31): covers
  the reader, including all 21 web allow-list dismiss phrases surviving the
  bound unchanged.
- `runtime/activity/step/tests/interference.test.ts` (7): covers the emitter.
- `runtime/executor/node-execution/tests/cleared-layers-activity.test.ts` (7):
  end to end through `runAutomationStudioGraph`. It covers:
  - the trace field;
  - one row per attempt;
  - a failed dispatch;
  - several layers;
  - the dismiss words absent from rows;
  - nothing said for absent, empty, unknown or nested input.

  It is placed in `node-execution/tests` because `executor/tests/` would exceed
  the audit's 25-file limit.

## Domain change needed (not mine)

The change belongs in `domain/src/io/gateway-output-dispatcher.ts`. It should
lift the field to the top of the dispatch payload, beside `route`, through the
domain's own bound:

```ts
const clearedLayers = webAutomationClearedLayersValue(isRecord(result.payload) ? result.payload.clearedLayers : undefined);
...
payload: compact({ status, message, result: result.payload, route, clearedLayers }),
```

The import is `webAutomationClearedLayersValue` from
`../actions/cleared-layers`. `runtime/adapter.ts` says its guards keep the
payload's top level, so the runtime path should carry it too. That is unverified
(see below). A domain test is also needed: a dispatch whose client payload
carries `clearedLayers` should answer it at the dispatch payload's top level.

## Commands run and observed results

- `pnpm --filter @fluxiq/contracts build` (Core root): build-cache "build",
  inputs changed. `dist/client-gateway.d.ts` now lists
  `["handler", "entry", "route", "alternative", "interference"]`.
- `npx tsc --noEmit --incremental --tsBuildInfoFile node_modules/.cache/fluxiq-build/check.tsbuildinfo`
  (`packages/fluxiq`):
  - first run: errors only in `llm/harness/context-packet.ts` (worker I) and
    `flow-bootstrap/generation-failure/phase-failure.ts` (a missing
    `llm.request.in_run_repair_invalid` mapping, not mine);
  - final run: **no errors**.
- `npx vitest run src/programs/automation-studio/runtime/activity src/programs/automation-studio/runtime/executor/node-execution src/programs/automation-studio/runtime/executor/tests`:
  65 files, 671 tests passed.
- `node scripts/structure-audit.mjs`:
  - first run: 2 violations, both mine. `executor/tests` had 26 files, and
    `interference.ts` imported `executor/contracts.ts` instead of the barrel.
    Both fixed.
  - final run: "structure-audit: passed (315 warning(s), 1160 baselined)."
- `npx tsc -p tsconfig.json --noEmit` (downstream `apps/extension`): 1 error,
  not mine. It is in `src/background/connection/gateway-session.ts(243,95)`:
  `ClientGatewayReportedActionResult` is not assignable to
  `ClientGatewayActionResult`, because the `"interrupted"` status is unknown to
  it. The cause is pre-existing uncommitted work in this tree's
  `packages/contracts/src/client-gateway.ts` (the B3/C8 `interrupted` reported
  status), which reached the extension when I rebuilt the dist as the brief
  required. The extension's gateway-session needs updating by whoever owns that
  unit.
- `node apps/extension/scripts/test-extension.mjs shared/activity/tests`: 32
  tests, 32 pass, including "a layer the extension closed is read as an
  interference recovery, without an event".

## Not verified

- The domain lift is not made, so nothing reaches Core from a live extension
  yet. There was no live or browser run.
- I did not read whether the adapter's `secretSafeDispatchPayload` and
  `dispatchPayloadWithScreenedSighting` keep a new top-level key. Its comment
  says they keep the top level.
- Whether trace persistence or summaries (`service/summaries/**`, worker K's
  files) should surface `clearedLayers`. I did not touch them, and the field
  rides the saved trace as-is.
- No full suites were run, per the rule.

## Open questions or contradictions found

- The brief says `control` is "bounded and whitespace-collapsed, with
  token-shaped runs hidden". The domain already restricts it to a closed
  allow-list of 21 phrases. Core bounds it anyway as defence in depth; all 21
  phrases pass through unchanged (tested).
- The brief's "Core client-gateway result reading" step needed no change. The
  client gateway passes `payload` through, and Core deliberately reads the field
  at the dispatch payload top level, as it does for `route`. It does not read it
  as a new `ClientGatewayActionResult` field.
