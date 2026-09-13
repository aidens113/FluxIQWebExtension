# g-core-action-entry-identity — a recorded entry keeps the event it came from (Core)

Worker report for brief `g-core-action-entry-identity` in
[finish-week1.md](../briefs/finish-week1.md) ("Fifteenth dispatch"). Worked in
FluxIQ Core, `F:\!FluxIQ`, branch `dev`, at `73a81e9`. Nothing was committed,
and no Core `pnpm build` was run.

## Outcome

**Done.** Before this change, a click the extension recorded became a Core
`type: "action"` timeline entry that did not say which gateway event it came
from. It now carries both identity keys in its metadata:
- `metadata.eventId` is the recording event's own `eventId`, for example
  `web.7.1007`;
- `metadata.sourceId` is the event's source, for example `tab:7:frame:0`.

Observation entries recorded through the same IO recorder get the same two keys.
These are the ids that w19-d1 open questions 1 and 2, and w19-e1's "A gap the
mapper must close", said were missing. The landing an explained navigation
names, `metadata.explainedByEventId`, can now be matched verbatim against a
click entry's `metadata.eventId`. Nothing has to rebuild the id from `sequence`.

- `bridge.ts` is still **796** lines: one line replaced, no net growth.
- All three test rows the brief asked for exist, and every row has at least one
  mutation that fails it. Seven mutations were run in all.
- These gates pass: the two test files, Core `pnpm check` and `pnpm docs:check`.

## What changed and why

All source paths are under
`F:\!FluxIQ\packages\fluxiq\src\programs\automation-studio\`.

### `client-gateway/bridge.ts`: one line, at `:400` (796 → 796 lines)

This is the `appendRecordingEvent` call site of `recordGatewayInput`. It
builds the metadata handed on to the IO envelope.

```ts
-      ...(event.metadata ? { metadata: event.metadata } : {}),
+      metadata: compactJsonObject({ ...(event.metadata ?? {}), eventId: event.eventId }),
```

- **The event's own `eventId` wins.** It is written after the client's
  metadata. An event with an `eventId` puts it in the envelope metadata, even if
  its client metadata names a different one.
- **An event without an `eventId` gives none.** `compactJsonObject` drops the
  `undefined` value, and the explicit key also removes any `eventId` the
  client's metadata named. That is not the event's id, and the IO recorder now
  stores this key as the event's identity. Mutation 2 pins this.
- **Nothing else changes.** `recordGatewayInput` itself is untouched. Envelope
  metadata is still `{ sourceId, clientGatewayMessageId, ...metadata }`, so
  its other keys are exactly as before.
  - When there is no client metadata and no `eventId`, `{}` is spread where
    nothing was before, which gives the same envelope.
  - This call site is only reached with an `inputId` in the metadata, so the
    metadata is never absent there in practice.
- **The state-update call site (`:606-615`) is unchanged.** A
  `client.state_update` has no top-level `eventId`.

### `runtime/io-bridge.ts` (69 → 82 lines)

- The identity is added to `commonMetadata` with
  `...recordedEventIdentity(event.metadata)`. It therefore reaches both the
  `action` entry and the `input.<role>` observation entry.
- The new private helper `recordedEventIdentity` (`:71-78`) copies `eventId` and
  `sourceId`, and nothing else, from the envelope's metadata:
  - each only if it is a non-blank string;
  - verbatim, not trimmed.
- The class stays at `:10`, so the framework reference citation did not move.
- **Blank strings are refused, beyond the brief's literal "strings only".** A
  blank id names nothing. Copying it would let a landing with a blank
  `explainedByEventId` match a click whose id is blank. The bridge's
  `stringMetadataValue` already treats blank as absent. Mutation 7 pins this.
- **Precedence.** For action entries `binding.metadata` is still spread after
  `commonMetadata`, as it was for `envelopeId` and the other common keys. A
  domain whose output binding declared static `eventId` or `sourceId` metadata
  would therefore override the identity. The web domain's bindings declare no
  metadata (`domain/src/web-panel-host.ts:48-51`,
  `domain/src/io/web-automation-io.ts:38`).

### Tests

- **`runtime/tests/io-bridge.test.ts`**: three rows and one helper,
  `identityRecorder`.
  - `keeps the recorded event's id and source on action and observation entries alike, and nothing else of the envelope's metadata`:
    - the action entry's metadata is pinned with `toEqual` to exactly
      `domainId`, `inputId`, `inputRole`, `envelopeId`, `eventId`, `sourceId`
      and `policyEligible`;
    - so `clientGatewayMessageId` and a `note` key in the envelope metadata
      are proven not copied;
    - a state input's observation entry carries its own `eventId` and
      `sourceId`.
  - `gives an entry no event id when its envelope carries none`: an action
    envelope with only `sourceId` gets `sourceId` and no `eventId`. A state
    envelope with no metadata gets neither key.
  - `copies an envelope's event id and source only as non-blank strings`:
    - on the action entry, `eventId: 1007` and `sourceId: { tabId: 7 }`;
    - on the observation entry, `eventId: " "` and `sourceId: null`;
    - neither key appears on either entry.
- **`client-gateway/tests/bridge.test.ts`**: one row, through a real
  `ClientGatewayService`, the pairing flow and `lateEventIoRegistry()`.
  - `keeps a recorded click's event id and source on its action entry, and gives it no event id the event did not carry`
    sends three `client.recording_event` clicks with `metadata.inputId`:
    - with `eventId: "web.7.1007"` and `sourceId: "tab:7:frame:0"`: the entry
      has both;
    - with `sourceId` only: the entry has `sourceId` and no `eventId`;
    - with neither, but `metadata.eventId: "web.1.1"`: the entry has
      `sourceId: "client.extension.identity.events"` and no `eventId`.

### Architecture page: `F:\!FluxIQ\docs\architecture\automation-studio\client-gateway.md`

This is the page that describes how the bridge turns client messages into
timeline entries. No Core page described an IO-recorded entry's metadata
before. A new bullet under "The bridge converts client messages into canonical
Studio artifacts" says:
- a `client.recording_event` or `client.state_update` with a registered
  `inputId` goes through `AutomationStudioIoRecorder`, and becomes an `action`
  entry or an `input.<role>` observation;
- the entry's metadata keys, including the two identity keys, and where each
  value comes from;
- that the top-level `eventId` wins, and an event without one gives none;
- that a state update has an `eventId` only if its metadata names one;
- that a `sourceId` in the client's own metadata takes precedence;
- non-blank strings only, and nothing else of the client's metadata;
- that a mapper reads `metadata.eventId` and `metadata.sourceId`, because the
  top-level `sourceId` stays `input.<inputId>` and mappers are not shown
  top-level fields.

## Commands run and observed results

The file commands below are Git Bash; `pnpm` ran from `F:\!FluxIQ`. Exit codes
were captured by redirecting output to scratch files, never through a pipe.

1. **Baseline, before any edit.** From `packages/fluxiq`:
   `npx vitest run src/programs/automation-studio/runtime/tests/io-bridge.test.ts src/programs/automation-studio/client-gateway/tests/bridge.test.ts --no-file-parallelism`
   gave `exit=0`, `Test Files 2 passed (2)`, `Tests 29 passed (29)`.
   - Pre-edit SHA-256: `bridge.ts` `c8024ed5…a1ad4dc`, `io-bridge.ts`
     `21b45844…4162a`.
2. **After the edits**, the same command gave `exit=0`,
   `Test Files 2 passed (2)`, `Tests 33 passed (33)`.
   - `wc -l` gave `bridge.ts` 796, `io-bridge.ts` 82, `bridge.test.ts` 733,
     `io-bridge.test.ts` 339.
   - Post-edit SHA-256, saved as restore copies in the scratchpad: `bridge.ts`
     `8c61fa94…401f529f`, `io-bridge.ts` `efa2cbb5…26781f89`.
3. **Mutation proofs.** Each used the same vitest command. Every file was
   restored by copying the saved post-edit file back, and the hash was checked.

   | # | Mutation | Result | Failing row and assertion | Restored hash |
   | --- | --- | --- | --- | --- |
   | 1 | `bridge.ts:400` → `compactJsonObject({ ...(event.metadata ?? {}) })` (no `eventId`) | `exit=1`, `1 failed \| 32 passed` | bridge row: `expected { domainId: 'extension.example', …(5) } to match object { eventId: 'web.7.1007', …(1) }` | `8c61fa94…` |
   | 2 | `bridge.ts:400` → `compactJsonObject({ eventId: event.eventId, ...(event.metadata ?? {}) })` (a client-metadata id survives) | `exit=1`, `1 failed \| 32 passed` | bridge row at `bridge.test.ts:86:38`: `to not have property "eventId"` | `8c61fa94…` |
   | 3 | `io-bridge.ts`: identity spread removed | `exit=1`, `3 failed \| 30 passed` | bridge row (`to match object { eventId: 'web.7.1007', …(1) }`); io identity row (`expected { domainId: 'example', …(4) } to deeply equal { domainId: 'example', …(6) }`); io no-event-id row (`to match object { sourceId: 'tab:7:frame:0' }`) | `efa2cbb5…` |
   | 4 | `io-bridge.ts`: `...(role === "action" ? recordedEventIdentity(event.metadata) : {})` | `exit=1`, `1 failed \| 32 passed` | io identity row at `io-bridge.test.ts:82:35`: `to match object { eventId: 'state.1', …(1) }` | `efa2cbb5…` |
   | 5 | `io-bridge.ts`: `eventId: event.id,` added before the spread | `exit=1`, `3 failed \| 30 passed` | `bridge.test.ts:84:38`, `io-bridge.test.ts:93:34`, `io-bridge.test.ts:105:34`, each `to not have property "eventId"` | `efa2cbb5…` |
   | 6 | helper condition → `value !== undefined` | `exit=1`, `1 failed \| 32 passed` | non-string row at `io-bridge.test.ts:105:34`: `to not have property "eventId"` | applied over by mutation 7, then restored with it |
   | 7 | helper condition → `typeof value === "string"` (no blank check) | `exit=1`, `1 failed \| 32 passed` | non-string row at `io-bridge.test.ts:105:34`: `to not have property "eventId"` | `efa2cbb5…` |

   How the brief's rows map to the mutations:
   - "A recorded click's action entry carries its `eventId` and `sourceId`":
     mutations 1, 3 and 4.
   - "An event with no `eventId` yields none": mutations 2 and 5.
   - "A non-string value is not copied": mutations 6 and 7.
4. **After the last restore.** `sha256sum` gave `bridge.ts` `8c61fa94…` and
   `io-bridge.ts` `efa2cbb5…`, identical to the post-edit files. The vitest
   command then gave `vitest-exit=0`, `Test Files 2 passed (2)`,
   `Tests 33 passed (33)`.
5. **`pnpm docs:check`** gave `docs-exit=0`:
   - `Validated local links in 101 authored/reference Markdown files.`
   - `Deterministic framework reference is current.`

   No cited line moved: the class stays at `io-bridge.ts:10`, and `bridge.ts`
   keeps its line count. So `pnpm docs:reference` was not needed.
6. **`pnpm check`** (Core, run alone) gave `check-exit=0`:
   - `structure-audit: passed (121 warning(s), 256 baselined).`
   - `packages/contracts check: Done`, `packages/client-gateway-websocket check: Done`,
     `packages/fluxiq check: Done`, `apps/web check: Done`.
   - Advisory warnings naming my files:
     - `bridge.ts` has 26 methods and is 796 lines. Both predate this change: no
       method was added and the line count did not change.
     - `bridge.test.ts` is now 733 lines. The advisory threshold is 400 and the
       hard limit 800.
   - All five files are tracked, so no scratch index was needed. No baseline
     entry needs changing.
7. **`git status --short` in Core** lists only my five files, all modified.

No failure in this session looked like the RAM fault. Every red run was a
deliberate mutation with a real assertion diff.

## Does anything read entry metadata in a way these keys could disturb?

**No reader in Core or downstream is disturbed.** The one downstream reader of
the new keys is the intended consumer. What I checked:

- **Core readers of these keys: none.**
  - A search for `metadata.eventId`, `metadata.sourceId` and
    `metadata["eventId"|"sourceId"]` under `packages/` and `apps/` finds only
    the bridge's own generic `stringMetadataValue`.
  - `envelopeId`, a key only IO-recorded entries have, is read nowhere outside
    `io-bridge.ts`. So no Core test or code pins the exact shape of that
    metadata.
- **Core's own proposal for an unmapped `action` entry.** This is
  `recordingActionEntryCandidate`, at `runtime/service.ts:5726-5749`.
  - It reads only `policyEligible` and `inputId` from entry metadata.
  - It copies no metadata into the candidate, so proposals and Flows gain
    nothing.
- **What a recording mapper is shown.** `recordingMapperCalls` copies all entry
  metadata, at `runtime/service/recordings/proposal-candidates.ts:36`. A mapper
  now sees `eventId` and `sourceId` on IO-recorded entries. This is the intended
  effect.
- **Storage.** `writeRecordingTimeline` (`service.ts:5454`) writes each entry as
  JSON, so each IO-recorded entry grows by the two strings.
- **Core web app.**
  - `recording-event-format.ts:37` displays metadata, so it will show two more
    rows.
  - `timeline-resolution.ts:91-99` reads only `stateSnapshotId` and
    `stateAtActionId` from entry metadata.
- **Key checks.** `isSensitiveKey`
  (`/password|passwd|passcode|secret|token|credential|authorization|cookie|session|csrf/i`)
  and the importer SDK's blocked keys apply to fingerprint and visualizer
  metadata, not to timeline entries. Neither key would match them anyway.
- **Downstream domain.**
  - `domain/src/runtime/expectation/click-landing.ts:64,66` reads
    `metadata.sourceId` through `tabOf`. It is the intended consumer.
  - `recordedStep` in `domain/src/web-panel-host.ts:130-134` merges
    `{ ...payload.metadata, ...observation.metadata }`, so entry keys win over
    nested payload metadata. But `io-bridge` writes only `action` and
    `input.<role>` observation entries. The mapper maps both to no input and
    returns `null` for them (w19-d1 open question 1).
  - Domain-event entries such as landings are not written by `io-bridge`, and are
    unchanged.
- **Downstream extension and test-runner.** A search under `apps/**/src` and
  `packages/**/src` for `metadata.sourceId|eventId`, `envelopeId` and
  `policyEligible` finds nothing.
- **Envelope metadata.** Before this change it reached only
  `outputBinding.toPayload(event)`; the IO recorder copied none of it. The web
  domain's `toPayload` reads only `event.payload`. So removing a
  client-metadata `eventId` when the event has no top-level one changes nothing
  observable there.

## Compatibility effect

- **Additive and backward compatible.** No contract type, exported symbol or
  wire message changed. Existing stored recordings are not migrated, so their
  entries simply lack the keys. Readers must treat both keys as optional.
- **Which entries gain the keys.**
  - Every entry recorded through `AutomationStudioIoRecorder` gains
    `metadata.eventId` and `metadata.sourceId` when its envelope metadata
    carries them as non-blank strings.
  - That covers both callers: the gateway bridge, and a host's
    `createAutomationStudioIoRecorder` (`framework/index.ts:238-247`).
- **What that means for the gateway path.**
  - Every IO-routed recording event and state update now stores
    `metadata.sourceId`, because the bridge always sets one.
  - A recording event stores `metadata.eventId` only if it had a top-level
    `eventId`.
- **Stricter envelope metadata.** When a recording event has no top-level
  `eventId`, an `eventId` in its client metadata no longer reaches the envelope.
  Nothing read it.
- **Downstream matching can now use the stored id.** Once w19-d1b maps
  `action` entries, a landing names a click when
  `landing.metadata.explainedByEventId === click.metadata.eventId`, with no id
  rebuilt from `sequence`. Downstream sees this only after Core is built; the
  domain consumes Core's `dist`.

## Not verified

- **No Core `pnpm build`, no root `pnpm test`, no Lab run**, as the dispatch
  forbids. Only the two owned test files ran, not the full Core suite. The
  `envelopeId` search makes an exact-shape assertion elsewhere unlikely, but
  the rest of the suite did not run.
- **What a Lab run must show.** In the W19 auth-gate recording's Core timeline:
  - The sign-in click's `type: "action"` entry (`outputId: "web.dom.click"`)
    has `metadata.eventId` equal to the explained `web.page.navigated` entry's
    `metadata.explainedByEventId`, in the form `web.<sequence>.<timestamp>`.
  - Its `metadata.sourceId` is the click's frame source, `tab:<id>:frame:0`.
  - The recording's executable action count is unchanged.
  - The landing claim, `expectedState` on the click candidate, will **not**
    appear until w19-d1b maps `action` entries and Core is rebuilt.
- **No live browser.** That the extension's click actually sends a top-level
  `eventId` rests on w19-e1's report and the domain's
  `createWebAutomationRecordingEvent`, not on a captured message.
- **The Core web app's recording event view** was not opened to see the two new
  metadata rows.

## Open questions or contradictions found

1. **The no-event-id fallback is still inert live, on the landing side.**
   - w19-d1 open question 2 needs `sourceId` in the metadata of both the click
     and the landing. This change supplies the click side.
   - A landing is a `domain_event` entry. Its `sourceId` is written top-level at
     `bridge.ts:411` and `model/recording-domain.ts:191`, and Core hides it from
     mappers at `proposal-candidates.ts:170`. Its metadata is
     `{ clientGatewayMessageId, clientId, ...event.metadata }`.
   - Closing that needs either a Core change to the `appendRecordingDomainEvent`
     call at `bridge.ts:404-419`, or the extension sending the tab in the
     landing's metadata. The brief did not own that path.
   - The primary match by `explainedByEventId` does not need it, because every
     current landing carries that id.
2. **A client-metadata `sourceId` overrides the bridge's `sourceId`.**
   - This predates the change: `recordGatewayInput` builds
     `{ sourceId, clientGatewayMessageId, ...metadata }` at `bridge.ts:654`, so
     keys in the client's metadata win.
   - Until now the envelope metadata was never stored, so this did not matter.
     It is now persisted as the entry's `metadata.sourceId`, and the
     architecture page says so.
   - The extension's click metadata is `payload.metadata` plus `inputId` and
     `visualTarget` (`gateway-payloads.ts:75-77`). I did not check whether
     `payload.metadata` can hold a `sourceId`.
   - Making the bridge's value win would change line `:654`: the same line
     count, but a behaviour choice for the supervisor.
3. **A state update's `eventId` comes only from its metadata.** It has no
   top-level `eventId`, so a `metadata.eventId` passes through and is stored.
   This is documented, and left as it was, because the brief covers recording
   events only.
4. **Blank strings are refused**, a refinement of "strings only". Mutation 7
   pins it. Reverting it means removing `&& value.trim()` at `io-bridge.ts:75`
   and the blank case from the non-string row.
5. **`binding.metadata` can override the identity keys** on action entries,
   with the same precedence as the other common keys. No current binding
   declares metadata.
6. **Structure baseline.** No entry needs changing.
