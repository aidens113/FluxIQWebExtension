# t182-W3 report: Core side of the Simple Mode paired-client relays

Worker: t182-W3. Tree: `C:\Users\osrs_\FluxStuff\fxwork\t182\!FluxIQ`, branch `task/t182-hardening-privacy`. No commits, no live runs, no provider calls.

## Outcome

**Partial.** All five tasks are implemented and tested. The one gap is that `remove-recording-entry` needs a facade method in `programs/automation-studio/runtime/service.ts`, which this brief forbade me to edit. The exact lines are below. Until they are pasted in, `tsc --noEmit` reports exactly one error: TS2339 at `api/handlers/recordings.ts:195` (`removeRecordingEntries` missing on `AutomationStudioService`). It is the same single error in `packages/fluxiq` and in `apps/web`, and there are no others.

### Facade lines the supervisor must add to `runtime/service.ts`

1. Add `removeRecordingEntriesByEventId,` to the existing `import { ... } from "./service/index.ts";` block (lines ~131-145, the block ending `recordAutomationStudioFlowGraphJudgements }`). It is already re-exported through `service/index.ts` -> `recordings/index.ts`.
2. Add this method immediately after `appendRecordingEvents` (ends around line 740):

```ts
  // Undoing one captured step of a recording that is still open: every entry
  // recorded from gateway event `eventId` (`service/recordings/entry-removal.ts`).
  // Persisted the way a domain event is, then the timeline file is rewritten in
  // full, because the typed path skips it and a reload prefers a non-empty file.
  async removeRecordingEntries(input: { projectId: string; recordingId: string; eventId: string }): Promise<{ removedCount: number; recording: RecordingSession }> {
    return await this.locks.withRecordingMutationLock(input.projectId, input.recordingId, async () => {
      const recording = await this.recordings.getRawRecordingSession(input.recordingId, input.projectId);
      const removal = removeRecordingEntriesByEventId(recording, input.eventId);
      if (!removal.removedCount) return removal;
      await this.repositories.recordingSessions.put(removal.recording);
      await this.writeProjectRecordingSession(input.projectId, removal.recording);
      await this.writeRecordingTimeline(input.projectId, removal.recording.recordingId, removal.recording.timeline);
      return removal;
    });
  }
```

Why those calls:
- `getRawRecordingSession` returns the stored form, with state snapshot refs dehydrated. Removal only filters the timeline, so the stored form stays valid for `put`.
- `writeProjectRecordingSession` rewrites `recording.json`, the typed store's summary row (via `putRecording` -> `upsertRecordingSummary`, which refreshes `event_count`, `action_count` and `state_snapshot_count`), the state index and the recording index `eventCount`.
- `writeRecordingTimeline` is added because in typed mode `writeProjectRecordingSession` skips the timeline file, and `loadProjectRecording` prefers a non-empty timeline file on reload.
- The handler already summarizes the answer through `service.summarizeRecordingSession`.

After pasting, run the check that confirms it: `npx tsc --noEmit` in `packages/fluxiq` should report 0 errors. Then add a service-level test (append two entries with the same `metadata.eventId`, remove, reload, and assert the timeline, the state index and `listRecordings` `eventCount`). I could not write that test without the facade.

## What changed and why

### Per endpoint (token path)

All the permissions and classifications below were read from the actual `registry.register` calls.

| Endpoint | Permission | Classification | Request fields accepted from a token | Response shape to a token |
| --- | --- | --- | --- | --- |
| AS `list-flow-summaries` | programs.read | read | unchanged (handler's own fields) | unchanged |
| AS `list-flow-runs` | programs.read | read | unchanged | `{ runs, page }`; every run now carries `durableBehaviorChanged: boolean` |
| AS `get-flow-run-detail` | programs.read | read | unchanged | unchanged |
| AS `list-flow-adaptations` | programs.read | read | unchanged | unchanged |
| AS `export-run-dataset` | programs.read | read | unchanged | unchanged (see the encrypted-fields check below) |
| AS `run-runtime-session` | runtime.control | authoring | Requires a non-blank string `flowId`. Refuses `flow`, `llmExecutionGrantId`, `runIntent`, `dryRunLlm`, `useReusableContext` and `inputs` whenever present, `authorizedExternalSideEffects` unless it is exactly `false`, and any `adaptiveMode` except `no_llm_intervention` or `deterministic`. An absent `adaptiveMode` is **rewritten to `no_llm_intervention`**. Still accepted: `projectId`, `runId`, `newRunId`, `maxSteps`, `authorizedDomainIds` (the service already filters it to the IO runtime's domain), `subflowId`, `idempotencyKey`. | unchanged |
| AS `generate-recording-proposal` | flows.write | authoring | Refuses `mode: "llm_assisted"`, `instructions` and `constraints`. Accepts `projectId`, `recordingId`, `mode` (direct/absent), `title`, `replaceProposalId`. | unchanged |
| AS `review-recording-flow-proposal` | flows.write | authoring | Refuses `policyOverride`, `reviewerId`, and any `decision` other than `approved` (absent is allowed; the handler defaults to approved). Accepts `projectId`, `proposalId`, `notes`, `destination`. | unchanged |
| AS `remove-recording-entry` (new) | runtime.control | authoring | `{ projectId, recordingId, eventId }`, all non-blank strings | `{ removedCount, recording }`, where `recording` is `summarizeRecordingSession(...)`: no timeline, notes or initial state |
| secret-keys `snapshot` | programs.read | read | none (GET) | Projected to `{ keys: [{ kind, provider, enabled }] }`, with `provider` set to `null` when absent. Never id, name, scope, scopeRef, description, dates, createdBy or metadata (where a fingerprint or hint would live). The service never returns values. |

- A refusal is HTTP 403 with body `{ ok: false, errorCode: "authorization.forbidden", error: "<sentence naming the field>" }`. The value is never echoed; a test asserts this.
- Narrowing runs on the token path only, for POST and GET. A GET to `run-runtime-session` is refused because it carries no `flowId`.
- A signed-in person's calls are not narrowed; a test asserts this.

### Which run modes can reach an LLM (checked in the service)

- `normalizeAutomationStudioRuntimeInterventionMode` (`service/runtime-adaptation/intervention-mode.ts`) maps absent, `default` and `fully_adaptive` to `fully_adaptive`. It maps `deterministic` and `no_llm_intervention` to `no_llm_intervention`.
- `runtimeAdaptationContextWithRunOverride` (`service/runtime-adaptation/context.ts`) sets `invokeLlm = false` only for `no_llm_intervention`. It sets `invokeLlm = true` for `manual_approval` and for `dryRunLlm: true`.
- `recovery/annotation/annotate.ts:117` returns before any provider or unattended-repair resolution when `invokeLlm` is false.
- Conclusion: the brief's "absent is allowed" would have let a token run reach an LLM through unattended repair (the flow's standing authorization). I therefore pin an absent mode to `no_llm_intervention` rather than refusing it, so an extension that sends no mode still works.

### Permissions

`PAIRED_CLIENT_PERMISSIONS` is now `programs.read, programs.write, runtime.control, flows.write`. `flows.write` is there only because `generate-recording-proposal` and `review-recording-flow-proposal` require it (the comment says so). No other `flows.write` endpoint is on the allowlist, and the classification guard still refuses everything that is not `read` or `authoring`.

### export-run-dataset and encrypted fields (K11)

It cannot return an encrypted field today.
- `run-dataset-store.ts:508` `storedSchema` parses every stored schema with `parseAutomationStudioRecordSchema(value)`, whose default is `allowEncrypt: false`.
- `handling: "encrypt"` therefore fails storage with `record_schema.encrypt_unavailable`.
- No source passes `allowEncrypt: true`; I grepped `packages/fluxiq/src` and `packages/contracts/src`.
- `exclude` fields are already dropped by `export-encoder.ts:47`.

No projection or refusal was added. **Latent risk:** that encoder filter drops only `exclude`. When K11 lands, `encrypt` fields would be exported as stored, so the K11 work must decide token behavior there.

### Code changes

- `apps/web/src/lib/program-route.ts`: allowlist entries with a one-line justification each; `flows.write`; header comment updated (four permissions, Simple Mode, narrowing and projection); new `narrowPairedClientRequest`, `PairedClientRequestNarrowing` and `projectPairedClientResponse`.
- `apps/web/src/app/api/programs/[programId]/[endpoint]/route.ts`: narrowing on the token path for GET and POST; projection in `respond` for token callers; `refuse` can carry `errorCode`.
- `packages/fluxiq/.../api/contracts/endpoints.ts`: `removeRecordingEntry: "remove-recording-entry"`.
- `.../api/contracts/recording.ts`: `RemoveRecordingEntryRequest` and `RemoveRecordingEntryResponse`.
- `.../api/handlers/recordings.ts`: `remove-recording-entry` handler (validation, facade call, summary answer).
- `.../runtime/service/recordings/entry-removal.ts` (new) plus barrel line: the pure `removeRecordingEntriesByEventId`. It removes every entry whose `metadata.eventId` equals the trimmed eventId, drops those ids from notes' `linkedEntryIds` (removing the key when it ends up empty), keeps the other entries' sequences, and throws for a finalized recording or a blank eventId.
- `.../runtime/durable-behavior/{index.ts,durable-behavior-changed.ts}` (new) and `runtime/index.ts` export: `automationStudioRunChangedDurableBehavior`, the run endpoint's former inline rule. It is true when one of the run's `adaptationIds` has a `runtimePatchAttempts` entry with `approvalDecision.autoApply === true`.
- `.../api/handlers/runtime-execution.ts`: uses the helper.
- `.../runtime/service/summaries/conversions.ts`: `flowRunSummaryWithInterventionSummaries` sets `durableBehaviorChanged`, so every summary saved from a detail carries it (typed `summary_json`, JSON index and SQL record all persist the whole summary).
- `.../model/flow-adaptation.ts`: `durableBehaviorChanged?: boolean` on `AutomationStudioFlowRunSummary`.
- `.../api/handlers/runs.ts`: `list-flow-runs` maps each run to `durableBehaviorChanged: run.durableBehaviorChanged === true` in both `runs` and `page.runs`.

### Tests added or changed

- `apps/web/src/lib/tests/program-route.test.ts`: allowlist, permissions, run/proposal/review narrowing, value never echoed, pass-through, secret-keys projection.
- `apps/web/.../[endpoint]/tests/route.test.ts`:
  - The allowlist and classifications are extended, and the expected actor permissions now include `flows.write`.
  - New cases: route-level refusal with errorCode and no echo, GET run refused, LLM-assisted proposal and rejecting review refused, person not narrowed, secret-keys projection end to end.
  - The mock registry now registers `AUTOMATION_STUDIO_ENDPOINTS` together with `ALLOWLISTED`, because `fluxiq/automation-studio` resolves from the stale `packages/fluxiq/dist` (built 14:23), which lacks the new constant.
- `.../api/handlers/tests/recordings.test.ts` (new): registration, service call, summary answer with no entry or private data, validation refusals, finalized refusal surfaced, `runtime.control` required.
- `.../runtime/service/recordings/tests/entry-removal.test.ts` (new): 6 tests.
- `.../runtime/durable-behavior/tests/durable-behavior-changed.test.ts` (new): 4 tests.
- `.../runtime/service/summaries/tests/conversions.test.ts`: summary `durableBehaviorChanged`.
- `.../api/handlers/tests/runs.test.ts`: `list-flow-runs` always answers a boolean.

## Commands run and observed results

Free RAM was checked before each heavy run: 3.89, 4.07, 4.26, 3.23, 2.80 and 3.47 GB.

- `npx vitest run` on 7 Core files (handlers recordings/runs/runtime-execution/llm-generation, entry-removal, durable-behavior, conversions): **7 files, 51 tests passed**.
- `npx vitest run` on the summaries tests dir, service-adaptation durable-patches/modes/adaptive-loop, training-modes and storage result-check-state:
  - First run: 7 files passed, **10 tests failed, all with "Test timed out in 15000ms"**.
  - Re-run of the 4 affected files with `--no-file-parallelism --testTimeout=120000`: **4 files, 12 tests passed**. The individual tests took 5-28 s, so the first failures were contention, not regressions.
- `npx vitest run src/lib/tests/program-route.test.ts "src/app/api/programs/[programId]/[endpoint]/tests/route.test.ts"` (apps/web):
  - First run: 1 failure. `remove-recording-entry` got 403 because the stale dist lacked the endpoint, so the mock had no classification for it.
  - After the mock fix: **2 files, 52 tests passed**.
- `npx tsc --noEmit` (packages/fluxiq): **1 error**, `recordings.ts(195,37): TS2339 Property 'removeRecordingEntries' does not exist on type 'AutomationStudioService'`. An earlier run also showed TS2379 in my durable-behavior test; I fixed it by widening the helper's parameter to `{ adaptationIds?: readonly string[] | undefined; metadata?: JsonObject | undefined }`.
- `npx tsc --noEmit` (apps/web): **1 error**, the same TS2339. It reaches the package source.
- `node scripts/structure-audit.mjs`: **passed (194 warnings, 355 baselined)**.
  - It also printed "1 baseline entries can be lowered". Not investigated; I did not run `pnpm structure:baseline` because that is a shared file.
  - New advisory warning: `apps/web/src/lib/program-route.ts: 11 exported values is past the 8-value advisory threshold`. It was already at 9 before; a follow-up split (for example `lib/paired-client/`) would clear it.

## Not verified

- The `removeRecordingEntries` facade itself: not compiled or run, because `service.ts` is forbidden. Persistence consistency (typed summary row, timeline file, state index, recording index) is argued from the code, not tested.
- The typed store's `recording_event_chunks` keep the removed events, because they are append-only. Nothing outside tests reads `listRecordingEvents`, so no reader sees them, but they stay on disk.
- Web routes and handlers were not run against a live panel or extension; no live runs were made.
- `packages/fluxiq/dist` was not rebuilt. The build script cleans first, `dist` is shared with other workers, and the build would fail on the pending facade. Web tests that read `fluxiq/automation-studio` see the old endpoint constant until a rebuild.
- The full test suites (`pnpm test`, `pnpm check`) were not run; only focused files.
- Run summaries saved before this change have no `durableBehaviorChanged` and list as `false` until they are re-saved, even for a run that did change the Flow.

## Open questions or contradictions found

1. **Absent `adaptiveMode`.** The brief allowed it, but it means `fully_adaptive` and can reach an LLM. I pinned it to `no_llm_intervention` instead of refusing it; the extension may want to send it explicitly.
2. **Standing result check.** A `no_llm_intervention` token run can still trigger a standing result check (`resolveStandingProvider` in `runRuntimeSession`, gated by the flow's own result-check authorization and budget, not by run mode). That is an LLM call the person pre-authorized on the flow, not a token grant. Blocking it needs a service change; decide whether it matters.
3. **`review-recording-flow-proposal` `destination`.** It passes unnarrowed, including `{ kind: "node", visibility: "public" }` (publishes a node) and `writeMode: "replace_recording_derived"`. Consider refusing `kind: "node"` for tokens.
4. **Where `eventId` lands.** It is in `metadata.eventId` only on the `io-bridge` gateway-input path. Domain-event entries (`model/recording-domain.ts:185-192`) carry it as the entry `id` and as `correlationId` instead, so `remove-recording-entry` does not find them. Say if the extension also records through that path.
5. **Two readings of "durable change".** `adaptiveRuntimeMetricsFromRunDetail` (`summaries/conversions.ts:30`) still uses its own looser rule (any auto-applied patch attempt, regardless of `adaptationIds`) for `metadata.adaptiveMetrics.durableBehaviorChanged`. I left it alone because its tests expect it, so the metrics field and the summary field can disagree.

### Doc edits needed (docs/architecture was forbidden to me)

- `docs/architecture/automation-studio/client-gateway.md` ~269-297:
  - The endpoint list, and now a second program (secret-keys `snapshot`, projected).
  - The permission list becomes `programs.read`, `programs.write`, `runtime.control`, `flows.write` (the last only for the two proposal endpoints).
  - Add the body-narrowing rules (run, proposal, review) and the absent-mode pin.
  - Add that a narrowing refusal is 403 `authorization.forbidden`.
- The Automation Studio API reference, wherever endpoints are listed: `remove-recording-entry` (runtime.control, authoring, open recordings only, answers `{ removedCount, recording-summary }`), and `durableBehaviorChanged` on `list-flow-runs` run summaries.
