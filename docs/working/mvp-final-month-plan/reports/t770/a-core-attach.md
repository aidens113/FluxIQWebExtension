# t770-A (Core): an attached recording becomes supporting evidence of the created Flow

## Outcome
Done. All acceptance checks pass; no model calls, no Lab runs, no full suites.

## What changed and why
Core tree: `C:/Users/osrs_/FluxStuff/fxwork/t770/!FluxIQ` (branch untouched, nothing committed). Paths below are under `packages/fluxiq/src/programs/automation-studio/` unless noted.

- `api/handlers/conversations.ts`: the append-turn handler passes `onScreen.recordingId` into the command context as `attachedRecordingId` (taken from the request's `onScreen` only). The confirmed-ask path has none.
- `runtime/conversations/commands/command.ts`: new optional `attachedRecordingId` on the command context.
- `runtime/conversations/attached-recording/{problem.ts,index.ts}` (new; barrel exported from `conversations/index.ts`): `automationStudioConversationAttachedRecordingProblem(context, recordingId)` calls `get-recording` through the port and returns a plain cause or null. Checks are the build's own: in this project, finished (`endedAt`), described (non-blank, at most 4000 chars). It sits beside `commands/` rather than inside it because `commands/` was at the 25-file limit and one level deeper broke the 9-segment depth limit.
- `runtime/conversations/commands/create-here.ts`: with `context.attachedRecordingId`, checks the recording BEFORE `create-flow` and fails with e.g. "the recording you attached is not finished, so it cannot support a new automation yet" (nothing created, "Nothing was changed."). Otherwise passes `linkedRecordingIds: [id]` to `save-flow-generation-instruction` and the progress line reads "saved what it should do, with your recording as supporting evidence". No model-visible `recordingId` argument was added; a model-written `recordingId` argument is ignored (tested). With no attachment, behaviour is unchanged.
- Docs: `docs/architecture/automation-studio/client-gateway.md` (append-turn `onScreen.recordingId` meaning) and, in the EXTENSION tree, `!FluxIQWebExtension/docs/architecture/build-loop.md` (one paragraph after the supplementary-recordings sentence, line ~517). The brief named that file explicitly although it lives in the extension repo tree (it does not exist in Core); I edited only that paragraph. Revert it if "must not touch the extension repo" was meant to cover docs.
- Tests: new `runtime/conversations/commands/tests/create-here-recording.test.ts` (8 cases: link and order of calls, failed-late progress line, unchanged without attachment, ignores model argument, unfinished / undescribed / other-project / missing refused with only `get-recording` called). Provider-free end-to-end probe added to `runtime/conversations/commands/tests/extension-chat.test.ts` (real registry + service, scripted provider, `FLUXIQ_AUTHORING_MODE=project`).

## Probe findings (extension-chat.test.ts, "with a recording attached to the message, in project authoring mode")
A described, finished recording ("Opens the orders page and exports last month's invoices.") is attached via `onScreen.recordingId` while the message says "Find every kettle in the catalog that costs under 30 dollars". Asserted: authoring mode resolves to `project`; exactly one saved Flow instruction has `linkedRecordingIds` containing the recording; every non-judge provider request (4 observed) carries `context.supplementaryRecordings` = one entry with `authority: "untrusted_supplementary_demonstration"`, the description, `method: []`; the request's instruction list is exactly `[message]`, unchanged. A second case with nothing attached asserts no request carries `supplementaryRecordings`. `method` is empty because the test world binds no IO runtime; a populated method list is covered by the existing `supportingAutomationRecordings` unit test in `authority.test.ts`. In this scripted project-mode run the build itself ends as a told failure (the scripted provider does not complete a project build), so the "with your recording as supporting evidence" progress text is asserted in the unit test, not the probe.

## Commands run and observed results
- `pnpm test <6 test files + api/handlers/tests/conversations.test.ts>` from `packages/fluxiq` (files: create-here-recording, extension-chat, execute, argument, instruction-led/tests/authority, llm/deepseek/tests/system-prompt): parallel group `4 passed (4) files, 72 passed (72) tests`; real-sql group `3 passed (3) files, 76 passed (76) tests`; `all groups passed: parallel, real-sql`. authority.test.ts and system-prompt.test.ts were run unedited and pass.
- `pnpm check` in `packages/fluxiq` (tsc --noEmit): exit 0 (run twice, after the final restructure too).
- `pnpm structure:check` at Core root: `structure-audit: passed (443 warning(s), 1152 baselined).` An earlier run caught `as never`, a 26-file directory, statement packing and a depth violation; all fixed.

## Not verified
- No live browser/extension run; the relay sending `onScreen.recordingId` is the extension task's side.
- Whole-package suites and `pnpm check` at repo root not run (narrow gates only, per AGENTS.md).
- A confirmed-ask path (`confirmedExecution`) does not carry the attachment; create-here is not gated, so not needed today.
- `get-recording` on a recording of another project: covered with a faked port (project mismatch), and the real registry path only for a same-project recording.
- DeepSeek system prompt text untouched; the probe shows the existing instruction sentence is selected whenever recordings ride the request.

## Open questions or contradictions
- Brief said to thread the id in `conversations.ts ~348`; the command context is built in `api/handlers/conversations.ts`, so the change is there.
- Edited `build-loop.md` in the extension tree (see above).
