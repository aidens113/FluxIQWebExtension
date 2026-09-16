# W2 — Why Core produced no Flow proposal from the Lab's recording

## Outcome

Partial. The question is answered with file:line evidence, the stated hypothesis
is **disproven**, and two real product defects found behind it are fixed and
proven by real Lab runs. The scenario still fails, now three layers further on,
at a cause I am not allowed to edit (`packages/test-runner/**`).

The failure moved, run by run:

| Run | Verdict | First failure |
| --- | --- | --- |
| `run-mu3pfne-ef4aa38f` (supervisor's) | failed | `recording.contract` — Core produced no recording Flow proposal |
| `run-mu3rah46-dcac7a7e` (mine, before any fix) | failed | `runtime.behavior` — `output_confirmation.not_received` |
| `run-mu3rnmt9-fed2c3dc` (after fix 1) | failed | `runtime.behavior` — `record_output.records_missing` |
| `run-mu3rur5g-7421a05b` (after fix 2) | failed | `environment.missing` — `get-run-dataset-page` (400) |

By the last run the Flow is built from the recording, the extraction node runs
without a phantom confirmation, and **Core stores a dataset for the run** — the
lane only reaches `get-run-dataset-page` when `get-flow-run-detail` already
listed at least one dataset (`flow-lane/persisted-flow-run.ts:223`).

## Why the supervisor's run produced no proposal

Not because the recording was extraction-only. Because the recording contained
**nothing an action could be mapped from at all**.

- `summary.json` / `events.ndjson` sequence 7: `recordedActions: {extension: 0,
  core: 0}`, `entryCount: 3`.
- Sequence 9 issue: `... saw 2 proposal entries from 3 raw entries
  (observation: 3), matched 0, emitted 0 raw candidates`. Every raw entry was an
  `observation`; one was compacted as high-frequency state
  (`AS/runtime/service/recordings/timeline.ts:7`).
- The generator's actual refusal is
  `packages/fluxiq/src/programs/automation-studio/runtime/service.ts:2436-2442`:
  `if (!candidates.length) { issues.push(...); continue; }`. It appends an
  explanatory issue string and writes no proposal artifact. The Lab turns the
  empty `proposals` array into `recording.contract`
  (`flow-lane/recording-flow-proposal.ts:44`).
- The mapper returned `null` for every entry correctly: an `observation` whose
  type resolves to no recorded action is not an action
  (`domain/src/web-panel-host.ts:135-144`).

**Root cause of the empty recording:** the Lab's `extract` step never reached the
extension. `ScenarioStepRunner` was constructed without `extractionIntent`
(`packages/test-runner/src/run-scenario.ts:305` at commit `7f873ff`), so
`step-runner.ts:136-137` fell through to `extractRecords`, a Playwright DOM read.
`run.json` shows it: `"actions": []`, extract step `durationMs: 75`. The
extraction seam existed (commit `8394557`) but nothing had wired it. **The
supervisor has since committed the other worker's fix for this** —
`1520f70 Make the Lab read through FluxIQ's own extraction, not Playwright's` —
and my second run picked it up.

## The hypothesis is disproven

> "Core's recording-proposal generator produces nothing from a recording with no
> actions."

It does not. An extraction-only recording is a first-class case and yields a
one-node Flow that saves a dataset. Proven by running the recording through a
real `AutomationStudioService`: an extraction recorded as a domain event
produces one candidate, `web.dom.extract_list`, with `recordOutput` (dataset
`products:4f1c9a`), `timeoutMs: 30000`, and no confirmation — see
`domain/src/tests/web-panel-host.test.ts:260`, which already passed before I
started.

## Defect 1 — the route production actually takes lost the dataset (fixed)

The existing test recorded the extraction as a **domain event**. Production never
does. The extension stamps `metadata.inputId` on the recorded extraction
(`apps/extension/src/background/connection/gateway-payloads.ts:89-91`, asserted
at `background/connection/tests/gateway-payloads.test.ts:341-345`), so Core's
gateway routes it through the IO recorder
(`AS/client-gateway/bridge.ts:414-424`) and stores one **`action`** entry
(`AS/runtime/io-bridge.ts:32-51`).

That entry holds only what the binding projected for execution. Measured with a
probe against a real service, the entry was:

```
parameters: { extractList: { item, fields{...handling}, paginate, maxItems }, browserFrameId: 0 }
metadata:   { domainId, inputId, inputRole, envelopeId, eventId, sourceId, policyEligible }
```

`datasetId`, `label`, `fieldLabels`, `itemCount` and `form` were gone. The domain
mapper declines an `action` entry it cannot read (`web-panel-host.ts:130-133`
before the fix), so Core's generic fallback stood for it
(`service.ts:5723-5746`), proposing:

- **no `recordOutput`** — the approved Flow read the page and stored nothing;
- **no scaled `timeoutMs`** — default 5,000 ms, which D14 says cuts a paginated
  read short at its first page;
- **`expectedConfirmation: { inputId: web.user.data_extraction_defined,
  timeoutMs: 5000 }`** — an input the extension never sends while replaying, and
  `dispatchPolicyOutput` fails the node when a declared confirmation does not
  arrive (`AS/runtime/io-policy.ts:34-56`).

Observed live in `run-mu3rah46-dcac7a7e`: `candidateCount: 1`, extract dispatched
for 6,063 ms, then `output_not_observed / output_confirmation.not_received`,
`stage: "confirmation"`, `observedRecords: 0`.

### The fix

The command is a lossy projection of the event, so the recording now keeps the
event when the binding asks it to.

- **Core** `packages/fluxiq/src/io/index.ts` — `InputOutputBinding` gains
  `recordInputPayload?: boolean`, returned by `resolveInputOutputBinding`.
- **Core** `AS/runtime/io-bridge.ts` — when set, the action entry carries
  `metadata.inputPayload`, the input event's own payload. Off by default, so no
  other domain's recordings change size or content.
- **Domain** `domain/src/io/input-model.ts` — `webAutomationRecordsInputPayload`,
  one rule in one place: only `web.user.data_extraction_defined` opts in. Safe to
  store verbatim because `webAutomationRecordedExtraction` has already refused
  any sample value or unknown key (D3, D12).
- **Domain** `domain/src/io/web-automation-io.ts`, `domain/src/web-panel-host.ts`
  — both registrars opt that one input in.
- **Domain** `domain/src/web-panel-host.ts` — `recordedExtractionEntry` maps the
  `action` entry through the same `extractionCandidate` the domain-event route
  uses, so a recording is mapped identically however Core stored it.

Tests: `domain/src/tests/web-panel-host.test.ts` now binds its harness exactly as
`registerFluxIQHost` does (it did not, which is why this gap was invisible) and
asserts the two routes propose the same candidate;
`AS/runtime/tests/io-bridge.test.ts` pins the flag on and off.

## Defect 2 — the records path was one level short (fixed)

With `recordOutput` present, capture ran for the first time ever and failed:
`record_output.records_missing` (`run-mu3rnmt9-fed2c3dc`). Core reads
`outputs.result` at the declared path
(`AS/runtime/executor/record-capture.ts:59-62`), and the domain declared
`"extracted"`. But `domain/src/io/gateway-output-dispatcher.ts:28-31` answers
`{ status, message, result: <client payload> }`, `domain/src/runtime/adapter.ts:127`
carries that same object through, and Core puts it at `outputs.result` whole
(`AS/runtime/io-policy.ts:117`). The rows the client sends on `extracted`
therefore sit at `result.extracted`.

Fixed in `domain/src/output-nodes/definitions.ts:26-28` (`"result.extracted"`),
with the three places that restate it updated.

## What now fails, and why I did not fix it

`run-mu3rur5g-7421a05b`: `FluxIQ control request failed:
/api/programs/automation-studio/get-run-dataset-page (400)`.

`get-run-dataset-page` is one of the few handlers that assert domain scope
(`AS/api/handlers/datasets.ts:42`); `get-flow-run-detail` and
`create-recording-flow-proposals` do not. `assertProjectDomainAccess` throws when
the project's domain and the request scope differ
(`AS/runtime/service.ts:1691-1694`), and any handler throw becomes 400
(`apps/web/src/lib/program-route.ts:3-9`). The Lab's project is a
`web-automation` project (`demo-workspace/provisioning.ts:41,67`), and
`flow-lane/run-datasets.ts:120` calls `automationStudioCall` with three
arguments, so no `?domainId=` is sent
(`existing-fluxiq-control.ts:61-64`). Null scope vs `web-automation` → throw →
400. It never surfaced before because no dataset had ever existed to page.

**The fix is one line in `packages/test-runner/src/flow-lane/run-datasets.ts`**
(pass `WEB_AUTOMATION_DOMAIN_ID` as the fourth argument, threaded from
`persisted-flow-run.ts:223` / `run-flow-lane.ts`). That package is excluded by my
brief and has an active worker, so I left it. Core should **not** be loosened
here: the domain scope is a real access control, and the Lab is the side that
should present it.

## Answering the product question

An extraction-only recording **should** yield a Flow, and now does end to end: one
`web.dom.extract_list` node with the picker's dataset, its labels, the excluded
columns, and a page-scaled timeout.

On "silently producing no Flow": Core is not silent. It returns an `issues` array
naming exactly what it could not map, and the web UI surfaces it —
`apps/web/src/features/automation-studio/recordings/recording-commands.ts:13`
returns `issues.join(" ")` as the error, falling back to "Recording generation
produced no actionable proposal." The wording is engineer-facing rather than
user-facing, but nothing is swallowed.

## Commands run and observed results

| Command | Result |
| --- | --- |
| `FLUXIQ_TEST_ENV_FILES=none FLUXIQ_TEST_TARGET=isolated pnpm lab run product-catalog --flow` (×3) | `failed` each time, first failure moving forward each run — table above |
| `domain: tsc -p tsconfig.json --noEmit`, `tsc -p tsconfig.test.json` | exit 0 |
| `domain: node scripts/test-domain.mjs` | `# tests 495 / # pass 495 / # fail 0` |
| `fluxiq: npm run build` | exit 0 |
| `fluxiq: npx tsc --noEmit` | exit 0 |
| `fluxiq: npx vitest run src/programs/automation-studio/runtime src/io` | `91 passed / 795 tests passed` |
| `F:\!FluxIQ: node scripts/structure-audit.mjs` | `passed (139 warning(s), 254 baselined)` |
| `F:\!FluxIQWebExtension: node scripts/structure-audit.mjs` | `passed (56 warning(s), 17 baselined)` |

The tracked `domain/.test-build/` was refreshed by running its own build.

## Not verified

- No full `pnpm check` / `pnpm test` / `pnpm build` in either repository. I ran
  the package type checks, both structure audits, the whole domain suite, and
  Core's `automation-studio/runtime` + `io` suites.
- The 400's response body was never read — the Lab records only the status
  (`http-control/index.ts:135`). The cause above is read off the code path and is
  deterministic, but it is an inference, not an observed error string.
- No manual browser validation beyond the Lab runs. No other scenario was run;
  in particular `sensitive-input` was not re-run, although `recordInputPayload`
  is off for every input except the extraction, whose definition carries no page
  values by construction.
- Each Lab result is a single observation on a machine with known-faulty RAM.
  The three failures are distinct and each follows from the previous fix, so
  they are not noise, but none was repeated.

## Scope note — files I touched beyond the brief

The brief allowed "Core's recording-proposal path and its tests; downstream
`domain/src/recording/**` and its tests". The defect was not in either. I edited,
and say so plainly:

- `F:\!FluxIQ\packages\fluxiq\src\io\index.ts` (public Core contract addition)
- `F:\!FluxIQ\packages\fluxiq\src\programs\automation-studio\runtime\io-bridge.ts`
- `F:\!FluxIQ\packages\fluxiq\src\programs\automation-studio\runtime\tests\io-bridge.test.ts`
- `F:\!FluxIQWebExtension\domain\src\web-panel-host.ts`
- `F:\!FluxIQWebExtension\domain\src\io\input-model.ts`,
  `domain\src\io\web-automation-io.ts`, `domain\src\io\tests\manifest-definitions.test.ts`
- `F:\!FluxIQWebExtension\domain\src\output-nodes\definitions.ts` and its test
- `F:\!FluxIQWebExtension\domain\src\tests\web-panel-host.test.ts`
- `F:\!FluxIQWebExtension\domain\src\recording\proposals\tests\record-output.test.ts`

None is `AS/runtime/service.ts`, `AS/runtime/recovery/**`, `AS/runtime/llm/**` or
`packages/test-runner/**`. `packages/fluxiq/dist` was rebuilt, because the domain
resolves `fluxiq` through it.

`InputOutputBinding.recordInputPayload` is a new public Core contract field and a
cross-repository dependency: this repository's extraction mapper needs it. The
supervisor should confirm that addition before the two `dev` branches ship.

## Open questions

1. Should the domain's extraction binding also set `confirmation: false`? The
   mapper's candidate now wins, so the replay is fixed either way, but Core still
   stamps `confirmationInputId` on the stored action entry and would still await
   that input on a live policy-driven dispatch. One key in
   `domain/src/io/**`; I left it because I could not validate the live path here.
2. Who wires the domain scope onto the Lab's dataset calls — the test-runner
   worker, or a follow-up? It is the only thing between the current state and a
   green `product-catalog --flow`.
3. `get-flow-run-detail` returns a run's datasets without a domain-scope check
   while `get-run-dataset-page` requires one. That inconsistency is what hid this
   for so long; it may be worth making the two agree in Core.
