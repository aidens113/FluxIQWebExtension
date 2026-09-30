# t191-r2-w2: Core panel chat dock and projects page

Tree: `C:/Users/osrs_/FluxStuff/fxwork/t191/!FluxIQ` (branch `task/t191-extension-chat-ui`). Nothing committed.
Paths below are relative to `apps/web/src/features/automation-studio/`.

## Outcome

Done, apart from one wiring line outside my files (see Open questions 1). Typecheck passes. Every test I touched or
added passes. Three failures in the wider run are not from this work: they come from dev merges already on the
branch, listed under Commands.

## What the WIP (f9252172) did, and what I kept, finished or reverted

Before judging the WIP, I read its diff and ran its tests. Its tests passed one file at a time.

| WIP piece | Verdict |
| --- | --- |
| `conversation/activity/pacer.ts`, `headline.ts`, `wording.ts`, `stream.ts`, `tests/pacing.test.ts` | Kept. Sound and pure. Detail changes at most once per 1.2 s, and headline changes show at once. Tool ids and result codes never reach the screen (`core.run_node` becomes "Working on the page"). Rows between two turns fold into one group. 8 tests pass. |
| `activity/usePacedConversationActivity.ts` | Kept and finished. Its effect now also depends on `projectId`, so a new pacer gets the event already in hand instead of showing nothing until the next event. |
| `text/blocks.ts`, `components/ConversationText.tsx` | Kept. They draw safe paragraphs, lists, bold and code from plain data, never HTML. |
| `components/ConversationTurn.tsx` | Kept. The person's turns are right-aligned bubbles and FluxIQ's turns are formatted text on the left. Author and time go to screen readers and the hover title. |
| `components/ConversationActivityBlock.tsx`, `ConversationThread.tsx` | Kept. Work folds as "Worked for 2m 5s · 14 steps", and the live status sits in place at the end of the stream. The old Header and Row were correctly removed. |
| `components/ConversationComposer.tsx` | Finished (details below). |
| `components/ConversationViewContent.tsx` | Finished. The WIP had only turned "Refresh" into an icon and still showed the raw id. |
| `styles/conversation/01-thread.css`, `02-dock.css` | Kept and extended. Every token they use exists; I checked each `var(--…)` against the tree's CSS. |

Nothing was reverted.

## Each defect's fix

1. **Raw project UUID shown twice as the dock title.**
   - New `conversation/thread/naming.ts` provides `conversationSubjectLabel`, `conversationSubjectFallbackLabel` and a new `conversationDisplayTitle`. The first two moved out of `thread/model.ts`, and `conversationSubjectDetail`, the subtitle that repeated the id, is deleted.
   - The name comes from Core's title, then the project's name, then a plain noun ("This project", "This run · Company website"). It is never an id: a title containing a UUID or a long hex run is passed over.
   - New optional `projectName` on `ConversationViewHostModel` and `ConversationDockProps`.
   - The dock now has one bar: a round FluxIQ mark, "FluxIQ", and the name as a muted subtitle. The view reports the name through a new `onTitleChange` and draws no header of its own unless there are several threads, which need the picker.
   - Picker options for untitled threads are told apart by time and marked "(waiting on you)".
   - `thread/pending-asks.ts` prompt copy now reads "This run is waiting on you…" instead of "Run run.7 …".
2. **Text "Refresh" button in the chat header.** Removed. The thread already polls and is pushed to.
3. **Cramped composer with a stray dot on the disabled Send.**
   - The composer is a rounded box pinned to the foot (`margin-top: auto`) with a 32 px circular icon send button.
   - It grows by measurement (`scrollHeight`) up to about 8 lines, then scrolls.
   - Enter sends, Shift+Enter makes a new line, and Enter during IME composition does not send.
   - While sending, the arrow is replaced by the spinner rather than shown next to it. The `Button` busy spinner beside an icon was the likely stray dot.
   - When there is nothing to send, the button is a quiet grey disc rather than a faded primary.
   - The opening message is rewritten as a short, centred greeting with three one-line cards. It still contains the strings the tests check.
4. **Turns.** Kept from the WIP: right-aligned bubbles for the person, left-aligned text for FluxIQ, and folded activity in human words.
5. **Projects page showed two search boxes.**
   - The component is `hierarchy/ProjectBrowser.tsx`, styled by the `.automation-project-search` rules in `styles/workspace/02-project-browser.css`.
   - Cause: `className="sr-only"` is not defined anywhere in the web app (only `.visually-hidden` exists), so the hidden label rendered as visible text. The input itself had no styling.
   - Fix: removed the span. The `<label>` is now one pill-shaped field with the icon inside, a borderless input, a focus ring and the match count at the end. Its accessible name is the input's `aria-label`.

Tests added or updated, beside their subjects:
- `conversation/thread/tests/naming.test.ts` (new, 5 tests)
- `conversation/components/tests/ConversationComposer.test.tsx` (new, 6 tests)
- `conversation/tests/conversation-view.test.tsx`: 4 new cases (no id, project name heads the thread, name handed to the shell, no Refresh, picker) and the title case updated
- `conversation/tests/thread-model.test.ts`: the fallback is now "This run"
- `hierarchy/tests/ProjectBrowser.test.ts`: one field, no visible duplicate label

## Commands run and observed results

- `bash .../heavy.sh "t191 w2 web typecheck" npx tsc --noEmit -p .` (in `apps/web`) printed exit 0 and no diagnostics.
- `npx vitest run` on the naming, composer and thread-model tests: 3 files and 27 tests passed.
- `npx vitest run` on conversation-view, conversation-activity, conversation-turn, ProjectBrowser and AutomationStudioProjectGate: 5 files and 35 tests passed.
- `bash .../heavy.sh "t191 w2 web conversation tests" npx vitest run src/features/automation-studio/conversation <ProjectBrowser> <ProjectGate> src/features/automation-studio/tests/architecture-contract.test.ts src/app`: 34 files, 330 passed and 4 failed. None of the failures involve my files:
  - `capabilities/tests/registry.test.ts` "pins the classes that re-authorize to Core's own two" received `send_or_publish` as a third class. It was already failing before I edited anything (seen in my first run). Core added the class in lane D (`05266957`, "money, delete and send always ask").
  - `tests/architecture-contract.test.ts` "keeps top-level feature taxonomy explicit and closed" fails on the `onboarding/` feature directory, which came from `eba99aa8`. That directory is not mine.
  - `capabilities/tests/core-contract.test.ts`: two cases timed out at the default 5000 ms while the file took 426 s. I started a rerun with `--testTimeout=120000`, but it was still running when this report was written; the supervisor's own solo run of the file was also in the build slots.
- `node scripts/structure-audit.mjs` printed "passed (200 warning(s), 354 baselined)", compared with 199 before my edits.
  - `thread/model.ts` exported values fell from 12 to 9.
  - New advisory warning: `styles/conversation/02-dock.css` is 407 lines, over the 400-line threshold (see Open questions 2).
  - `styles/workspace/02-project-browser.css` rose from 403 to 433 lines. It was already over the threshold.

## Not verified

- No browser run. The brief forbids one, so the look is unverified on screen: the one-bar dock header, composer growth, pinning and the search field.
- `projectName` is not passed in the running app yet (Open questions 1). Until it is, an untitled project thread reads "This project".
- Whether `core-contract.test.ts` passes with a longer timeout. My rerun had not finished.

## Open questions or contradictions found

1. **Wiring needed outside my files.** `live/components/AutomationStudioSession.tsx` should pass `projectName={activeProject.name}` on the workspace `<ConversationDock …>`, around line 678. Leave the landing-screen `<ConversationDock projectId={null} />` exactly as it is, because an architecture test matches that string.
2. **Stylesheet split.** Splitting the activity section of `02-dock.css` (about 125 lines) into a new `styles/conversation/03-activity.css` would clear the warning. It needs one import line in `app/programs/automation-studio/automation-studio.css`, and the "owns its stylesheets" case in `conversation/tests/conversation-architecture.test.ts` changed from 2 to 3 imports. The manifest is outside my files, so I did not split.
3. **Same `sr-only` bug elsewhere.** Undefined `sr-only` also shows visible text in `hierarchy/AutomationProjectHierarchySidebar.tsx` (the clipped "Se" beside "Search project hierarchy" in the screenshots, and a second label on the type filter), `problems/ProblemsView.tsx` and `router/RouterContentView.tsx`. One global `.sr-only` rule, or switching those files to `visually-hidden`, fixes all of them.
4. **registry.test.ts policy pin.** It still pins `["move_money", "delete"]`, while Core now also asks for `send_or_publish`. Its own comment says it must match Core. I left the policy change to its owner.
