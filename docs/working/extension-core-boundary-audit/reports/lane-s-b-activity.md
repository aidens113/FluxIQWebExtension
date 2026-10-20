# Lane S-B (t728): one Core source for the activity headline, pacer and wording

## Outcome

Done. The extension's pure activity-status modules now live in Core at
`packages/fluxiq/src/ui/activity-status/` (plus `project/`) and are exported from
`fluxiq/ui`. Exported names and behaviour are unchanged: the files were copied
verbatim and only their import specifiers were rewritten. Core web's live
status now runs on the shared pacer, and its `headline.ts`, `pacer.ts` and
`wording.ts` are gone. Nothing was committed and Core's dist was not built.

## What changed and why

### Core: new `packages/fluxiq/src/ui/activity-status/`

- 22 source files plus `index.ts` (23 files, within the 25-file budget) and
  `project/{agent,project-card,index}.ts`. No shared `noun-` prefix reaches
  three files, so no further split was needed.
- Import rewrites only:
  - `@fluxiq/client-gateway-websocket` became `import type ... from "@fluxiq/contracts/client-gateway"`.
  - `fluxiq/ui` became `../activity-action/index.ts` (or `../../activity-action/index.ts` from `project/`).
  - The extension barrel `../../shared/activity/index` became direct sibling-file imports, so nothing imports its own barrel and no cycle forms.
  - Every relative import gained a `.ts` extension.
- Doc comments were left as they were. Some still point at extension paths
  such as `background/activity/send-start.ts` or `content/activity-overlay/`.
- `packages/fluxiq/src/ui/index.ts` gains `export * from "./activity-status/index.ts";`.
  It also re-exports the types `ClientGatewayActivity` and `ClientGatewayActivityPhase`,
  so `apps/web` and the extension need no contracts dependency.
- None of the moved modules imports an extension-only protocol file
  (activity-messages, done-visible, extension-activity-state, relay or overlay).

### New `fluxiq/ui` exports, mapped to the downstream module each replaces (for the switch worker)

| `fluxiq/ui` export | Replaces downstream (apps/extension/src/...) |
| --- | --- |
| `type ActivityDisplay` | `shared/activity/activity-display.ts` |
| `cutAtWord` | `shared/activity/cut-at-word.ts` |
| `longestWordCut` | `shared/activity/word-cut.ts` |
| `declinedSubmission` | `shared/activity/declined-submission.ts` |
| `isHeadlineEcho` | `shared/activity/headline-echo.ts` |
| `ACTIVITY_HISTORY_LIMITS` | `shared/activity/history-limits.ts` |
| `isInternalStep` | `shared/activity/internal-step.ts` |
| `isModelThought` | `shared/activity/model-thought.ts` |
| `notTriedOutcome` | `shared/activity/not-tried.ts` |
| `stepRecovery`, `type ActivityStepRecovery` | `shared/activity/step-recovery.ts` |
| `stepSkip`, `type ActivityStepSkip` | `shared/activity/step-skip.ts` |
| `activityWording`, `type ActivityWording` | `shared/activity/wording.ts` |
| `activityAgent`, `type ActivityAgent` | `shared/activity/project/agent.ts` |
| `projectCard`, `type ActivityProjectCard` | `shared/activity/project/project-card.ts` |
| `type ClientGatewayActivity`, `type ClientGatewayActivityPhase` | the re-export in `shared/activity/index.ts` (from `@fluxiq/client-gateway-websocket`; same contract type) |
| `systemActivityClock`, `type ActivityClock`, `type ActivityTimer` | `background/activity/clock.ts` |
| `activityHeadline`, `type ActivityHeadlineSituation`, `type ActivityWaitReason` | `background/activity/headline.ts` |
| `ACTIVITY_DETAIL_INTERVAL_MS` (1600), `ActivityPacer`, `type ActivityPacerOptions` | `background/activity/pacer.ts` |
| `ACTIVITY_FAN_OUT_INTERVAL_MS`, `FanOutGate` | `background/activity/fan-out-gate.ts` |
| `UnitHistory`, `type UnitHistoryLimits` | `background/activity/unit-history.ts` |
| `UnitSituation`, `type UnitState` | `background/activity/unit-situation.ts` |
| `RunRetry`, `type RetryState` | `background/activity/run-retry.ts` (was not in the downstream barrel) |
| `CandidateTrial`, `type TrialState` | `background/activity/candidate-trial.ts` (was not in the downstream barrel) |
| `SupervisorEnding`, `type SupervisorEndingWords` | `background/activity/supervisor-ending.ts` (was not in the downstream barrel) |
| `endingKindOf` | `background/activity/ending-kind.ts` (was not in the downstream barrel) |

What stays downstream for the switch worker:

- **Shared activity barrel.** `shared/activity/index.ts` still exports
  `ACTIVITY_MESSAGES`, `ACTIVITY_DONE_VISIBLE_MS`, `ACTIVITY_RECENT_LIMIT` and the
  types `ActivityContentMessage`, `ActivityOverlayPreference` and `ExtensionActivityState`.
- **Background activity barrel.** `background/activity/index.ts` keeps the relay,
  send-start, send-answer, overlay-target and overlay-preference exports.
- **Test helpers.** `background/activity/tests/fake-clock.ts`,
  `build-trace-events.ts` and `fixtures/t174-build-trace.ts` stay. The extension's
  `activity-relay`, `activity-replay`, `send-start` and `send-answer` tests use
  them, and those tests exercise extension-only modules. The fake clock's
  `import type { ActivityClock } from "../clock"` must switch to `fluxiq/ui`.
- **Helpers not ported to Core.** `build-trace-events.ts` and the t174 fixture
  were not copied: only `activity-replay.test.ts` uses them, and it imports the
  relay and the content overlay, so it stays downstream.

### Core: tests ported to vitest

- All 13 listed test files went to `activity-status/tests/`, the two project
  tests to `activity-status/project/tests/`, and `fake-clock.ts` to
  `activity-status/tests/`.
- A TypeScript-AST rewrite (`node:test`/`node:assert/strict` to vitest
  `test`/`expect`) kept every assertion. All 406 were rewritten, with
  messages carried as `expect(value, message)`:
  - `equal` became `toBe`
  - `deepEqual` became `toStrictEqual`
  - `notEqual` became `not.toBe`
  - `match` became `toMatch`
  - `doesNotMatch` became `not.toMatch`
  - `ok` became `toBeTruthy`

### Core web (`apps/web/src/features/automation-studio/conversation/`)

- Deleted `activity/headline.ts`, `activity/pacer.ts` and `activity/wording.ts`.
- New `activity/paced-status.ts` with `ConversationPacedStatus`, a thin
  adapter over the shared `ActivityPacer`:
  - It ignores an event no newer than the last one taken. Each poll hands
    the current event again, and the shared pacer expects each event once.
  - It maps `ActivityDisplay` to the web's `ConversationActivityDisplay`
    (`activityId`, `headline`, `detail`, `outcome`, `sequence`). `waiting`
    with phase `paused` stays the outcome `paused`, so the live line renders
    exactly as before.
  - It owns the types `ConversationActivityDisplay` and `ConversationActivityOutcome`.
- `usePacedConversationActivity.ts` now builds a `ConversationPacedStatus`.
  The clock is unchanged.
- `steps/messages.ts`:
  - The failure "ended" title is now the shared `activityHeadline(kind, "failed", { repairing, stopped })`.
  - The outcome test is `event.phase === "failed"`, which is identical to the old `conversationActivityOutcome(...) === "failed"`.
- `activity/wording.ts` moved to `steps/words.ts` (only the step messages use
  it) and is exported from `steps/index.ts`. It holds the chat step-title
  wording (`conversationActivitySentence`, `conversationActivityTextIsHuman`).
  The live status's words now come only from the shared `activityWording`.
- `activity/index.ts` changes:
  - Removed: `conversationActivityHeadline`, `conversationActivityOutcome`,
    `CONVERSATION_ACTIVITY_DETAIL_INTERVAL_MS`, `ConversationActivityPacer`, `ConversationActivityClock`.
  - Added: `ConversationPacedStatus`.
  - Still exported: `ConversationActivityDisplay`, `ConversationActivityOutcome`,
    `conversationActivitySentence`, `conversationActivityTextIsHuman` (now via `steps`).
  - Nothing outside `activity/` used the removed names.
- Direct dependents updated:
  - The doc comment in `components/ConversationLiveLine.tsx`.
  - The file list in `tests/conversation-activity.test.tsx`. Its
    no-`setInterval` guard read `../activity/pacer.ts` and now reads
    `../activity/paced-status.ts`.
- Tests:
  - `activity/tests/pacing.test.ts` was rewritten to assert the shared
    behaviour: the 1600 ms interval, pacing, at-once changes, the waiting and
    paused headlines, and ignoring older events.
  - `activity/tests/paused.test.ts` now asserts the headlines through
    `ConversationPacedStatus`.
  - The wording cases moved to the new `steps/tests/words.test.ts`.

### Behaviour changes in Core web (all toward the extension's authority)

1. The detail line changes at most once per 1600 ms. It was 1200 ms.
2. The waiting headline is now "Waiting for you: answer in the FluxIQ panel". It was "Waiting for your answer".
3. A build that fails while repairing reads "Build failed", in both the live
   line and the chat's "ended" message. It was "Couldn't fix your Flow". A
   run's failed repair still reads "Couldn't fix your Flow".
4. The live line follows all of the extension's pacing rules:
   - It holds the last meaningful line through "Deciding the next step".
   - Model thoughts never become the detail.
   - A paused run has a null detail.
   - The person's answer is not repeated.
   - The detail is cut at a word boundary at 160 characters.
   - A settled unit is not reopened by late rows.
   - "Testing your Flow" shows during candidate trials.
   - The check-wait headline is "Waiting for you: finish the check on the page".
   - The supervisor-ending detail applies.
   - The detail's words are `activityWording` (for example, "— done" is
     dropped for a step that finished well) rather than the old
     label-before-the-dash sentence.
5. Unchanged: rendering of `headline`, `detail` and `outcome` (including
   `data-outcome="paused"`), and the "working" test (`outcome === null`).

## Commands run and observed results

All commands were run in `C:/Users/osrs_/FluxStuff/fxwork/t728/!FluxIQ`.

- `npx vitest run src/ui/activity-status` (in `packages/fluxiq`): 15 files passed, 126 tests passed.
- `npx vitest run src/ui` (in `packages/fluxiq`, re-run at the end): 28 files passed, 378 tests passed.
- `pnpm --filter fluxiq check`: exit 2. All 5 errors are in another worker's
  file, `src/programs/automation-studio/nodes/tests/record-process.test.ts`:
  `Cannot find module '../record-process.ts'`, and missing
  `AUTOMATION_STUDIO_RECORD_CONDITION_BOUNDS`, `automationStudioRecordConditionHolds`
  and `readAutomationStudioRecordNumber`. There were no errors under `src/ui/`.
- `pnpm --filter @fluxiq/web check` (`tsc --noEmit`; `fluxiq/ui` resolves to
  source through `tsconfig.base.json` paths): exit 0, no errors. Build-cache
  noted "not stamped, because inputs changed while it ran (packages/fluxiq)":
  other workers were editing at the same time.
- Web vitest: `npx vitest run --config <scratchpad>/s-b-web-vitest.mjs src/features/automation-studio/conversation`
  (in `apps/web`): 29 files passed, 276 tests passed, in about 9 minutes.
  - The scratch config aliases `fluxiq/ui` and `@fluxiq/contracts/*` to source
    and skips the stale-dist refusal, because the brief forbids building
    Core's dist. Other `fluxiq` subpaths still resolved to the existing dist.
  - The run was meant to cover only the changed files, but the directory
    argument also picked up the other 26 conversation test files. All passed,
    including `steps/tests/messages.test.ts` with the new "Build failed"
    headline and `tests/conversation-activity.test.tsx`.
- `pnpm structure:check`: exit 1 with 3 failures, all in other workers' paths:
  - `[directory-files]` `automation-studio/api/handlers/` has 26 files.
  - `[imports]` `runtime/service/tests/creation-spend-itemised.test.ts`.
  - `[naming]` `automation-studio/api/contracts/` has three `flow-` files.
  - In my paths there are advisory warnings only:
    - `activity-status/` has 23 source files (advisory threshold 15).
    - `pacer.ts` has 436 lines and `tests/pacer.test.ts` has 703 (advisory threshold 400).
  - `browser-imports` and `web-vocabulary` raised nothing.

## Not verified

- Web vitest through the real config, against a rebuilt Core dist. Not run:
  dist building is forbidden in this brief. It must run after the
  supervisor's `pnpm --filter @fluxiq/contracts --filter fluxiq build`.
- Live panel rendering in a browser.
- The downstream extension: not touched. The switch worker owns it.
- The doc comments in the moved files that still name extension paths.

## Open questions or contradictions found

- `steps/words.ts` keeps Core web's own chat step-title wording
  (`conversationActivitySentence`, `conversationActivityTextIsHuman`). The
  extension's chat has its own equivalent in
  `panel/chat/stream/step/words.ts`, which was not in this brief's move list,
  so the chat step words are still not shared. A later brief could unify them.
- The new waiting headline says "answer in the FluxIQ panel" inside the FluxIQ
  panel itself. It reads oddly there, but the brief asked for the extension's
  headlines.
- `packages/fluxiq/src/ui/activity-action/failure-reason.ts` shows as modified
  in the tree. I did not touch it; it is presumably the other worker's.
- Git: I briefly staged the deletion and move with `git mv`/`git rm`, then
  unstaged them with `git restore --staged`. All of my changes are unstaged
  working-tree changes.
