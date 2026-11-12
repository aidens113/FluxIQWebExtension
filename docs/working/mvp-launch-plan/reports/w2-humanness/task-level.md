# W2 Humanness: task-level humanness (t898, worker report)

Core worktree: `C:/Users/osrs_/FluxStuff/fxwork/t898/!FluxIQ` (branch `task/t898-humanness`, nothing committed).
Paths below are relative to `packages/fluxiq/src/` unless they start with `packages/`.

## Outcome

Mostly done. Each Answer First task stores its own humanness level. You can set or clear it through the new
`update-task-settings` endpoint, and `list-project-tasks` rows show it. A new task, or a task without a level,
takes the person's starting value when an attempt opens. A level the task already has is never overwritten. A
saved Flow's run (flow-stage, then flow-run) picks its level with `resolveHumanness` in this order: run option,
then task, then Flow, then starting value. When none of them is set, the options carry no `humanness` key.

Two things are still open, and both are caused by another worker's file (see the open questions):
`assistant-tools.generated.json` has not been regenerated, and the contracts flows input breaks JSON-schema
rendering.

## What changed and why

**The task record**
- `framework/automation-service/service/answer-first/task-memory/memory.ts:12-17`: added `humanness?: number`.
- `.../task-memory/store.ts:13, 229, 232-237`: `readHeld` now also calls `withReadableHumanness`. A value that
  fails `humannessSchema` (101, -1, 2.5, "x", null) is left off, and the rest of the task's memory stays. This
  works the same way as the readers for unreadable acts and flow bases. The next write then drops the bad value.
  A record without a level reads and writes byte-for-byte as before (tested).
- `.../task-memory/project-tasks.ts:25`: each row carries `humanness` when the task has a level.

**API contracts**
- `api-contracts/automation/task-attempt.ts:44-45`: `AutomationStudioProjectTask.humanness?: number`.
- `api-contracts/automation/task-attempt.ts:60-68`:
  - `UpdateTaskSettingsRequest = { projectId: string; taskId: string; humanness: number | null }`. `null`
    removes the field.
  - `UpdateTaskSettingsResponse = { taskId: string; humanness: number | null }`. This is the level as it now
    stands, and `null` means the task has none of its own.
- `api-contracts/automation/endpoints.ts:182`: `updateTaskSettings: "update-task-settings"`.

**The handler**

`programs/automation-studio/api/handlers/task/project-tasks.ts:80-104` registers `update-task-settings` next to
rename-task, with the same settings: `programs.write`, `authoring`, action `studio:UpdateTaskSettings`,
`Write`, `endpointResource.project()`, and the domain access check. It validates the value with
`humannessSchema` (`null` is allowed).
- Refusals:
  - 101, -1, 2.5, "x" or a missing field: `{ ok:false, errorCode:"task.humanness_invalid" }`.
  - A task Core does not hold: `{ ok:false, errorCode:"task.not_found" }`, and nothing is created.
- Success: `{ ok:true, payload:{ taskId, humanness: <n>|null } }`. The handler changes only the task's memory
  entry.

**Registration**
- Assistant input: `packages/contracts/src/program-api/automation-studio/runs/project-tasks.ts:25-31` adds
  `updateTaskSettingsInput`. It uses zod/v4 with the bounds from `HUMANNESS_MIN` and `HUMANNESS_MAX`. I could
  not reuse `humannessSchema` because it is a zod v3 schema, and putting it inside a v4 object throws
  "Invalid element at key humanness" when parsed.
- `server/program-route/program-route.ts:122-124, 316`: added to the paired-client allow-list and narrowed to
  `projectId`, `taskId` and `humanness`, following the rename-task pattern.
- `packages/contracts/src/iam/actions.generated.ts`: regenerated. The only change is the new
  `studio:UpdateTaskSettings` entry. The read-only and destructive lists are unchanged.

**A new task gets the starting value**
- `.../attempt/opening.ts:55-56, 79`: the opening now carries the task's kept level (`humanness`).
- `.../attempt/run-attempt.ts:140` (the carry-on opening now carries `hold.kept?.humanness`) and `:257-262`:
  - After the opening row is written, a task with no level and an input with `humanness` gets one best-effort
    write.
  - The write sets the field only when `current.humanness === undefined`, so a stored level (0 included) is
    never replaced.
  - Nothing is written when the task already has a level or no starting value was given.
- `.../attempt/contracts.ts:25-29`: comment only. It now says that `input.humanness` is the starting value and
  explains the precedence.

**Precedence at run time**
- `.../flow-run/ports.ts:33-38`: new port field `storedHumanness?: { task?: number }`.
- `.../attempt/flow-stage.ts:66-71`: before the run, the stage reads the task's level from the store
  (best-effort), so a change made since the attempt opened counts. It passes `storedHumanness: { task }` only
  when the task has a level.
- `.../flow-run/flow-run.ts`: header lines 37-40, imports at 39 and 46, line 120, and lines 146-153.
  - `gatedOptions` now does
    `resolveHumanness({ runOption: input.caller?.humanness, task: ports.storedHumanness?.task, flow: automationStudioFlowHumanness(parentFlow.metadata), startingValue: input.humanness })`.
    The `humanness` key is added only when this is not undefined.
  - **Deviation from the brief's example:** the Flow's level is read in flow-run from the `parentFlow` it
    already loads (`collaborators.getFlow`). It is not carried through ports as `storedHumanness.flow`.
  - Why: that is the Flow actually being run, it costs no extra Flow read, and it goes through the Flow
    worker's `automationStudioFlowHumanness`, which exists in
    `service/flow-settings/flow-humanness.ts`.

**Tests**
- `.../flow-run/tests/humanness.test.ts`:
  - It keeps the two existing tests and adds six precedence tests, all through the real flow-run fixture.
  - A partial `vi.mock` of the verification barrel records the options the real engine is handed, so the
    resolved level and whether the key is present are asserted directly.
  - The engine's `delay` calls are checked as well: waits above 0 when a level is set, and the same delays as
    level 0 when no level is set.
- `.../tests/fake-library-engine.ts`: new fixture options:
  - `callerHumanness`, which becomes `input.caller`.
  - `taskHumanness`, which becomes `ports.storedHumanness`.
  - `flowHumanness`, which is written to the real stored Flow's `metadata.humanness` through
    `service.saveFlow`.
- `.../task-memory/tests/store.test.ts`: added keep, round-trip from a new store and from `list`, an unchanged
  record without a level, and a drop of each bad value.
- `.../attempt/tests/task-humanness.test.ts` (new):
  - Real service plus the `laterAttempts` harness.
  - A new task stores the starting value 70. When the level is set to 20, a later attempt with starting value 90
    keeps 20 and its Flow run is handed 20.
  - A task kept without a level takes 70 at its next attempt. With no starting value and the level removed, the
    run carries no `humanness`.
  - `service.ts` does not yet pass the request's `humanness` to the attempt input (that is another lane's
    file). The test wraps `runAutomationStudioAnswerFirstAttempt` through a partial mock of the answer-first
    barrel to inject it, the way `service.ts` will.
  - I first put this test in `answer-first/tests/`. That made the directory 26 files, which failed the
    structure audit, so I moved it to `attempt/tests/`.
- `programs/automation-studio/api/tests/project-task-routes.test.ts`:
  - Sets 40, sets 0 (a stored 0 is listed), and clears with null.
  - The list row carries and then drops the field. The Flow is untouched.
  - Refuses 101, -1, 2.5, "x" and a missing value, and refuses an unknown task.
- Endpoint lists:
  - `server/program-route/tests/program-route.test.ts`: allow-list entry plus a narrowing test.
  - `.../handlers/tests/domain-scope.test.ts`: the `DOMAIN_SCOPED` list.
  - `.../handlers/tests/assistant/tests/task-assistant.test.ts`: the minimal-example list.
- `packages/contracts/src/program-api/automation-studio/runs/tests/runs.test.ts`: accepts 40 and null, refuses
  101, 2.5 and "x", and checks that the JSON schema renders.

## Commands run and observed results

All were run from the Core worktree root unless noted.

**Flow-run precedence**
- Command: `pnpm --filter fluxiq exec vitest run src/framework/automation-service/service/answer-first/flow-run/tests/humanness.test.ts`
- Result: 8 passed (8).

**Store, attempt, routes and scope, together**
- Command: `pnpm --filter fluxiq exec vitest run .../task-memory/tests/store.test.ts .../tests/task-humanness.test.ts src/programs/automation-studio/api/tests/project-task-routes.test.ts src/server/program-route/tests/program-route.test.ts src/programs/automation-studio/api/handlers/tests/domain-scope.test.ts`
- Result: 54 passed, 1 failed.
- The failure is the existing test "rename-task and remove-task > removes the task's memory...", line 113:
  `thread.payload.outcomes.length` expected > 0, got 0.
- It passed when run alone (`-t "removes the task"`). It also failed the same way when I ran the HEAD version of
  the test file, copied to a temporary probe file and then deleted. So the failure predates my change and is not
  caused by it.
- All my new route tests passed.

**Moved attempt test**
- Command: `pnpm --filter fluxiq exec vitest run src/framework/automation-service/service/answer-first/attempt/tests/task-humanness.test.ts`
- Result: 2 passed.

**Task assistant examples**
- Command: `pnpm --filter fluxiq exec vitest run src/programs/automation-studio/api/handlers/tests/assistant/tests/task-assistant.test.ts`
- Result: 1 passed.

**Contracts input test**
- Command, run in `packages/contracts`: `pnpm exec vitest run src/program-api/automation-studio/runs/tests/runs.test.ts`
- Result: 2 passed. Before the zod/v4 fix it failed with "Invalid element at key humanness".

**Regeneration**
- Command, run in `packages/fluxiq`: `FLUXIQ_REGENERATE_IAM_CATALOG=1 FLUXIQ_REGENERATE_ASSISTANT_TOOLS=1 pnpm exec vitest run src/platform/iam/catalog src/programs/_shared/assistant/tests/generated-module.test.ts`
- IAM catalog: 11 passed, and the catalog was rewritten with the one new line.
- Assistant tools: failed with `TypeError: Cannot read properties of undefined (reading 'def')` in
  `z.toJSONSchema`, so `assistant-tools.generated.json` was not written. The cause is the zod v3 schema inside a
  v4 object, explained in the open questions.

**Structure audit**
- Command: `pnpm structure:check`
- Result: `structure-audit: passed (530 warning(s), 969 baselined)`. That is after the move; the first run
  failed on the 26-file directory.
- The touched files have only pre-existing warnings: task-memory/ has 19 files, and fake-library-engine.ts has
  15 exports.

**Wider regression run**
- I queued the whole `attempt/tests` directory in the heavy slot first:
  `heavy-slot.mjs run t898-task -- ... vitest run .../task-memory/tests .../attempt/tests .../tests/later-attempt.test.ts .../flow-run/tests/flow-run.test.ts`.
  It sat at queue position 4 of 5 while both slots stayed held (since 10:02 and 10:08), so I stopped it. That
  directory's other files were never run.
- In its place I ran the files that exercise the changed code directly, as narrow tests:
  `pnpm --filter fluxiq exec vitest run .../task-memory/tests .../attempt/tests/flow-stage-person-stop.test.ts .../attempt/tests/keep.test.ts .../tests/later-attempt.test.ts .../flow-run/tests/flow-run.test.ts`
- Result: Test Files 9 passed (9), Tests 89 passed (89).

## Not verified

- I did not run the package typecheck (left to the supervisor). Places to look:
  - TS 5.9 closure narrowing in the handler's `update` callback and in run-attempt's `startingValue` closure.
  - The union-typed `opening.humanness` in run-attempt.ts.
- The rest of attempt/tests (beyond flow-stage-person-stop, keep and task-humanness), flow-run/tests (beyond
  humanness and flow-run) and answer-first/tests (beyond later-attempt).
- I did not live-test the Lab or the extension.
- I did not wire the attempt input's starting value from the generate request in `service.ts`; that file is
  must-not-touch. Until it is, `input.humanness` is undefined in production. That means no task stores a starting
  value yet, and the starting-value step of the precedence never fires.

## Open questions or contradictions found

1. **Blocker for regenerating assistant tools: the Flow worker's
   `packages/contracts/src/program-api/automation-studio/flows/flow.ts:21`.**
   - That line puts `humannessSchema`, a zod v3 schema (`import { z } from "zod"`), inside a zod/v4
     `z.object`.
   - Effect: `createFlowInput.jsonSchema()` throws, and parsing would throw "Invalid element at key humanness"
     as mine did.
   - This blocks `FLUXIQ_REGENERATE_ASSISTANT_TOOLS` for every endpoint, so `assistant-tools.generated.json`
     does not yet include `update-task-settings`, and its drift test will fail.
   - Fix: build the field with zod/v4 and the bounds, as `runs/project-tasks.ts:29-30` does. A better
     long-term fix is a v4 `humannessSchema` in contracts.
   - Then run, in packages/fluxiq: `FLUXIQ_REGENERATE_ASSISTANT_TOOLS=1 pnpm exec vitest run src/programs/_shared/assistant/tests/generated-module.test.ts`.
2. **Files outside the brief's owned list that I edited as "registration lines":**
   - `packages/contracts/src/program-api/automation-studio/runs/project-tasks.ts` and its test (the assistant
     input).
   - `server/program-route/program-route.ts` and its test (the paired-client allow-list).
   - `programs/automation-studio/api/handlers/tests/domain-scope.test.ts`.
   - `.../handlers/tests/assistant/tests/task-assistant.test.ts`.
   - `packages/contracts/src/iam/actions.generated.ts` (generated).
3. **The paired-client allow-list:** I allowed `update-task-settings` for paired clients so the extension can
   set a task's level. If the lead wants it to be cookie-only, remove `program-route.ts:124, 316` and the
   matching test.
4. **The Flow's level comes from `parentFlow.metadata` inside flow-run, not from ports.** The reason is above.
   This uses the Flow worker's `automationStudioFlowHumanness` from `service/flow-settings/index.ts`, so
   flow-run now depends on that export.
5. **An existing flaky test:** the remove-task test in `project-task-routes.test.ts` fails when its whole file
   runs and passes alone. This also happens with the HEAD version of the file.
