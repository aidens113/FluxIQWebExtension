# w5-chat-spec (t901, W5 P6)

## Outcome
Partial. `e2e/chat-widget.spec.ts` now runs on the current panel: 11 of 12 tests pass, with no model call. One test (U5) fails on a product gap, reported below. The spec is rewritten for the docked Assistant, which replaced the old floating window.

## What changed and why
The old spec drove a floating window with a launcher over the Studio workspace and one chat per project. The panel replaced that with an Assistant column docked beside every page (a round button on a phone). It is the panel-wide chat of the signed-in person (`list-panel-threads`, `get-panel-thread`, `send-panel-message`, `answer-panel-ask`), not a project chat. The seeded project threads can no longer be shown anywhere, so the seed and the spec both changed.

**Seed (`e2e/support/seed-chat-threads.mjs`).**
- It now writes three panel threads for the fixture person `admin`. Core has no public writer for panel threads, so it loads Core's built `PanelAssistantThreads` from the package's own `dist` (resolved through `fluxiq/automation`).
- It writes them where the endpoints read them: `<root>/.fluxiq/artifacts/automation-studio/panel-assistant` (`register.ts`: `dirname(projectsRoot)/panel-assistant`). It throws if that folder's `projects` sibling is missing.
- My first guess (`<root>/programs/automation-studio/...`) wrote where the server did not read, so the dock said "No chats yet." That cost two runs.
- Threads:
  - "Weekly post build": an unanswered Allow card (send_or_publish, create_new).
  - "Cleanup run": 14 filler turns, then an Allow card with consequence delete.
  - "Planning notes": a person's turn, a flow-graph-diff reference to a real proposal Core holds, an adaptation reference, the panel's own `panel-capability-result` record, and a closing line.
- It still creates the real Flow and proposal first, as before.
- The old choice ask and open ask are gone, because the Assistant's answer endpoint takes only Allow or Don't (see A2 and the choice test below).

**Spec, per test.** Navigation uses `signInToPanel` and the `assistantDock` helpers from `support/panel-fixture.ts`. The thread list uses the shared conversation list.

| Old test | Now | Why |
| --- | --- | --- |
| D1 launcher on the landing screen | Home heading "Home" is the landing screen. The Assistant is visible with no project chosen, within the viewport, and does not move on page scroll. | The "Programs" directory is retired (P4). The launcher is gone. The dock's on-screen and stays-put intent remains. |
| V8 landing lists every project's threads, no id | Same on Home with "All projects": list, pick a thread, read it, no project id or thread id on screen. | Same intent. |
| D2-D6, V1, V2, V7, T3, U2, U5, U6 "window in a project" | D2/D3 become "Waiting on you" on exactly the two chats holding a card (`data-waiting`). V7/V1/V2 become: no `<select>`, 3 rows, no ids, search "planning" keeps 1. T3 and U2 are kept. U6 is kept as the reference being drawn. U5 is split out (below). D4, D5 and the launcher half of D6 are dropped. | The launcher badge, "Needs you" launcher text, Escape-returns-focus and wider/narrower buttons belong to the retired window. The rows carry "waiting" now. |
| U6 adaptation reference opens the Adaptations view | The reference is drawn (`adaptation:adaptation.e2e.1`) and has no Open control. | The dock mounts the chat with no `onOpenAttachment` (`AssistantDock.tsx`), and the product has no Adaptations view to open it in. The old click-through is not reproducible. |
| T3/T8 Show me scrolls the transcript | Same, on the "Cleanup run" thread. It runs before that card is answered. | Same intent. |
| A1/A3/A4/A6 permission ask, one press, no PIN | Same, plus A6: the settled card now says "That request is no longer waiting, so nothing was run." | The seeded card has no waiting call, so Allow settles it and posts the card-gone sentence (`panel-assistant.ts` `answered`). |
| Choice ask with destructive options | An Allow card whose consequence is delete ("delete or remove something"), settled with one press and no PIN. | The Assistant raises Allow cards only. Its answer endpoint refuses choice answers. |
| A2 open ask takes words and answers | Dropped. | A panel thread has no open-ask answer path, and no screen replaced it. The typed send (C1) covers typing words to the Assistant. |
| C4, C1 | C4 is unchanged (nothing in local or session storage, including an unsent draft, after reload). C1 sends a typed message and the fixture host's scripted assistant answers it (`writeAssistantScript`). | The old send was skipped when a key was enabled, and the panel fixture has enabled keys, so it would have skipped every time. The script spends nothing. |
| Composer held while first read is on its way | Same, with the gate on `**/get-panel-thread*`, and the held text is answered by the script. | The read endpoint changed, and it no longer skips on keys. |
| V4 empty project welcome | A person with no chats is welcomed ("This is where FluxIQ talks to you", "Permission before anything lasting"). The key line "FluxIQ needs a model key before it can build." appears and its "Add a model key" button goes to `/security/keys` in this tab. | The fixture person has chats and keys, so `list-panel-threads` and the secret-keys reads are answered empty by `page.route`. The project-name heading is dropped, because the dock names no project. |
| Chat alone `/programs/automation-studio/chat?projectId=` | The old URL redirects to `/?chat=open` (`next.config.ts`), and the Assistant is open there with the 3 chats. | The page is retired and the redirect replaced it. The "Say which project to chat about" line is gone with it. |
| (new) phone | At 390 px the round "Open the assistant" button opens the sheet, the button gives way to the sheet's own Close, Close hides it, and the page does not scroll sideways. | This stands in for the retired launcher and Escape behaviour. |
| U5 | Its own last test. It asserts the table "Structural changes" (Start the post, Finish the post, 3 Added rows, no `builtin.`). | It is the one failure, a product gap (below). It runs last so the other tests still run in the serial file. |

## Commands run and observed results
Six isolated runs of `node C:/Users/osrs_/FluxStuff/fxwork/.tools/heavy-slot.mjs run t901 -- node apps/web/e2e/support/run-isolated.mjs --skip-build --only e2e/chat-widget.spec.ts`:
1. The first failed on D1 (the old "Programs" landing; run against my first rewrite, the dock read an empty list, which is the wrong seed path above).
2. The second repeated that, with a response logger showing `list-panel-threads` answering `{"ok":true,"payload":{"conversations":[]}}`. That showed the seed was in the wrong folder.
3. After fixing the seed path: D1 and V8 passed. The list test failed on U5 and the rest did not run.
4. U5 was split into its own test, and the destructive test hit a wrong button name ("Don't" is "Don't allow"). 5 passed, 1 failed.
5. The destructive test now presses Allow. 9 passed, then the phone test failed on `aria-expanded` of a button the CSS hides while open.
6. Final: `11 passed`, `1 failed` (U5), `done in 147s, 1 round(s) failed`. Passing: D1, V8, list/D2-D3/V1-V7/T3/U2/U6, T3/T8, permission, destructive, C4/C1, held composer, V4, phone, chat alone.
- Per the brief I checked free memory before each run. Run 5 started at about 1.3 GB free because my wait loop gave up and the command ran anyway. It still completed. The final run started at 2652 MB free.
- `pnpm structure:check` -> "structure-audit: passed (535 warning(s), 917 baselined)".
- After the last run no node or next process whose command line mentions `fxwork\t901` remained (PowerShell CIM query returned nothing).

## Product defects
**U5: a panel thread's reference to a proposal is never resolved.**
- Seen in the final run and in the saved page snapshot (`error-context.md` under `test-results/playwright/chat-widget-U5-*`): the dock shows "Proposed Flow change could not be read here." and the raw reference `flow.<id>:adaptation.bootstrap.<id>` where the old project chat drew the "Structural changes" table.
- Cause: `apps/web/src/features/chat-widget/attachments/read-attachment.ts` (lines 11 to 15) resolves every attachment through `get-conversation-attachment` with `context.projectId`. A panel thread's `projectId` is the literal `panel`, and that endpoint searches project databases only. Core's panel endpoints (`packages/fluxiq/src/programs/automation-studio/api/panel-assistant/endpoints.ts`) have no attachment read. So no attachment in the Assistant resolves. Fixing it needs a panel attachment read in Core, or the Assistant resolving through the proposal's own project, which the reference does not carry. That is outside this brief's paths.
- Not a spec defect: the test asserts the intent and fails honestly.

**Related gaps, no failing test.**
- **Answer endpoint.** `answer-panel-ask` accepts only grant or deny. A seeded choice or open ask in a panel thread could not be answered, so those tests were dropped (above).
- **Rename and delete.** The Assistant list has no Rename or Delete (the W5 P2 report names this).

## Not verified
- Only the desktop-chromium project ran (the runner's choice); Edge, Firefox and the other viewport projects did not.
- The seeded Allow cards have no waiting call, so Allow settles them with the card-gone sentence and does not run a real call. The real Allow-runs-the-call path is covered by `panel-assistant.spec.ts`, not here.
- The seed loads Core's built `dist` module by file path. It needs the Core build to be current, and a Core rename of that module breaks the seed.
- The README (`apps/web/e2e/README.md`, "Chat widget") still describes the old project chat and `--headed` run. I did not edit it because it is outside my owned paths, and a stale line there should be corrected by whoever owns it.

## Open questions
- U5's fix belongs to Core's panel assistant (an attachment read for panel threads) or to the panel's attachment port. Which side owns it?
- Should the README's Chat widget section be rewritten for the Assistant?
