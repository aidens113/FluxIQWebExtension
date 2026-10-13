# Instruction-led UI implementation

Status: implemented; supervisor verification pending, 2026-10-13. Worker owns extension and Core apps/web only; no commits or package gates.

Implemented shared Chrome/Firefox description collection using a native modal, with blank validation/cancel; explicit trimmed description travels on every handshake attempt and top-level client.start_recording. Record/extraction starts require it. Recording review now offers task authoring, never generate/test/save; old relay operations decline without a Core call.

Web TaskInstructionsPanel is available on Flow start and Instructions, independent of model configuration or existing graph. It reads canonical readiness and exact instruction, saves instructionId/body/linkedRecordingIds, preserves attachments outside listed pages, paginates described finalized evidence, preserves failed drafts, and ignores stale owner replies. Existing graph remains owned by Core; save does not claim old build verification. Recording description editing is independent of name and notes; Client Gateway start collects an explicit description.

Deterministic and assisted readiness require the same Core readiness result. Known Core closed errorCode/runtime diagnostic codes survive adapters as actionable task/description recovery. Run/Resume expose Instructions; extension held-run recovery resolves its actual owning Flow through compact run details rather than current selection.

Validation observed: extension narrow selection 100/100 passed. Command from apps/extension: EXTENSION_TEST_BUILD_LABEL=t519-ui node scripts/test-extension.mjs background/connection/tests/active-recording background/connection/recording-start/tests/handshake background/automation-relay/tests background/connection/tests/core-api background/panel/tests/panel-control panel/recording/review/tests/recording-review panel/recording/tests/recording-description panel/state/tests/request panel/chat/tests/hold-control.

Remaining: supervisor package type/audit review and feasible manual browser smoke. No live browser/build/typecheck/provider invocation performed by worker.

Web validation first pass: 133/142 tests passed, nine failed plus two test-environment rejections. New task editor tests all passed. Resolved missing/stale transport mocks in legacy Flow/Instructions tests, second task textarea selectors, and restored fixed provider-failure copy while surfacing only closed task refusals. Moved task editor and tests to Instructions ownership; focused save-task-instruction command is reexported under existing authoring API name. Source frozen again; refocused tests in progress.

Final web owning selection observed PASS: 16 files, 142 tests, Vitest exit 0 (cmd.exe wrapper avoids PowerShell stderr-redirection setting exit1 from React warnings). No unhandled errors. Exact command from Core apps/web:

```text
pnpm.cmd exec vitest run src/features/automation-studio/authoring/tests src/features/automation-studio/runtime/tests/run-input-interactions.test.tsx src/features/automation-studio/runtime/tests/run-control-interactions.test.tsx src/features/automation-studio/runtime/tests/run-permission-request.test.tsx src/features/automation-studio/runtime/tests/diagnosis-authorization-interactions.test.tsx src/features/automation-studio/runtime/tests/runtime-views.test.tsx src/features/automation-studio/recordings/tests src/features/automation-studio/flow-editor/components/tests/flow-editor-start-pane.test.tsx src/features/automation-studio/instructions/tests/instructions-view.test.tsx src/features/automation-studio/instructions/tests/task-instructions.test.tsx src/features/programs/tests/program-api.test.ts
```

Supervisor reported no production web type errors, two fixture errors corrected (client required description; blocked readiness explicit false). The two owning fixture files are being rechecked. All source/tests frozen for supervisor review. Known limitation: browser-native modal and live backend attachments are unit-tested but not exercised in a real browser; no model or provider used.

Supervisor follow-up review: independent web 146 tests/17 files, web types, extension 100 tests/types passed; native modal Chromium/company-website probe passed 8 assertions without provider or external requests. Worker removed new runtime transport cycle by injecting typed parent/host transport into pure TaskInstructionsPanel, and changed authoring instruction import to focused command. Description module/test renamed to description.ts/description.test.ts; owning 2 tests passed after rename. Blank barrel EOF fixed, stale-owner error discard explicitly documented. Affected web rerun currently refuses stale public fluxiq libraries before test collection; supervisor controls rebuild. No claim that injected version has passed web recheck yet.
