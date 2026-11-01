# Retained failed action diagnostic

Outcome: Done.

Measured diagnostic: **`[loader-settlement:look_outside_change]`**

Failure code: `web.validation.output_not_observed`

Failure stage: `verification`

Source receipt: `C:/Users/osrs_/FluxStuff/fxlab/t833-claude/lab-ext/test-runs/instances/t833-claude-company-website-slot-1/replays/replay-mvx6xw61-133d7b51.json`.

Retrieval used the trace named in the brief and the original `snapshots/creation-context.json` from `C:/Users/osrs_/FluxStuff/lab-runs/2026-10-31/run-mvx64gvn-6781507e` to select its run-owned persistent workspace/project.

1. Opened `<instance-runs>/persistent-isolated/<workspace>/fluxiq-root/.fluxiq/artifacts/automation-studio/projects/<project>/project.sqlite` with Node `DatabaseSync(path.toNamespacedPath(databasePath), { readOnly: true })`. The Windows namespaced path permits the long existing database path to open.
2. Selected only the specified trace's `client.action_result` events from `client_gateway_trace_events`.
3. Reassembled chunked events using `event_chunk_digests` as concatenated32-byte binary references into `client_gateway_trace_chunks`; decoded `raw` or raw-deflate chunks in memory and checked the reconstructed event byte length. No store `open`, schema migration or write method was called.
4. Parsed the selected event's `.payload.text` as JSON. The **failed result's** `.payload.failure.actual` contains the fixed diagnostic above; `.payload.failure.code` and `.payload.failure.stage` contain the closed code/stage above. This is the failure body, not an inference from the replay summary or page text.

Reader-format source: Core `packages/fluxiq/src/programs/automation-studio/storage/project/gateway-trace/store.ts` and `gateway-trace-chunk-rows/read-bodies.ts`.

Validation: read-only Node trace projection -> `[loader-settlement:look_outside_change]`, `web.validation.output_not_observed`, `verification`.

Changed: this report only. No browser, Core, panel, provider, store migration or git execution.

Not verified: which outside-list change caused this closed rejection; this task retrieved the recorded reason only.

Reusable ignored helper command (run from the t840 worktree; accepts one existing replay JSON path):

```powershell
node --no-warnings test-runs/2026-10-31-t840-validation/read-closed-loader-proof.mjs C:/Users/osrs_/FluxStuff/fxlab/t833-claude/lab-ext/test-runs/instances/t833-claude-company-website-slot-1/replays/replay-mvx6xw61-133d7b51.json
```

Observed smoke result, exit0:

```json
{"replayId":"replay-mvx6xw61-133d7b51","result":"found","diagnostic":"[loader-settlement:look_outside_change]","failure":{"code":"web.validation.output_not_observed","category":"output_not_observed","stage":"verification"},"count":1}
```

`git check-ignore -- test-runs/2026-10-31-t840-validation/read-closed-loader-proof.mjs` -> helper path printed, exit0.
