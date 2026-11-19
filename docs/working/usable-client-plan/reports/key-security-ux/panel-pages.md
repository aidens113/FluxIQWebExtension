# panel-pages (t925, key-security-ux)

## Outcome
Done for the owned folders; two items are partial (see Not verified). W = Core `apps/web/src`, all under `features/`.

## Per item
- **Chats, sweep #1, #18, journey 12** (`chats/chat-rows.ts`, `ChatsPage.tsx`, `ChatThreadPage.tsx`, `parse-panel-threads.ts`, `chats.css`):
  assistant chats read "Assistant" (the raw `panel` id never prints); untitled chats are "Chat from <day>" or "Assistant chat, <day>"; unknown projects read "Another project"; the "Open" status word is dropped (only "Resolved" shows). New chat: the page now follows the thread the chat reports (`onSelectedConversationChange`) and `router.replace`s `/chats/<new id>?project=`. The thread page also sets the panel's project to its own (as the Flow editor does), so the dock beside it is a working chat, not a disabled box. #18 (dock transcript under "FluxIQ assistant" on /chats) lives in chat-widget: not touched.
- **Projects, journey 12** (`projects/use-projects-changed-sync.ts` new, `ProjectsPage.tsx`): listens to the existing `fluxiq:projects-changed` event and reads the list again; its own announcement is ignored so no loop. No timer.
- **Settings, #3, #13, #17** (`settings-page/ui/SettingsPage.tsx`, `settings-page.css`): the assistant and spending sections keep a reserved block (`.settings-reserve`, 26rem) while keys load, instead of appearing late; column 720 px to 960 px (`--settings-column`); H1 uses `--font-size-page-title`; spacing from `--space-*`. Loading text "Loading your settings…". Expected effect: the 0.28 / 0.12 jump goes away (reserve about equals the two sections); needs a live CLS re-measure.
- **Security, #13, #14, journey 10** (`security.css`, `settings-page/connect/ConnectClientSection.tsx`, `devices.css`, `security/activity/model/*`): duplicate H2 "Devices and apps" removed (section is labelled, tab says it); H1 on the shared page-title token; tabs stay on one row and scroll sideways at 390; "Remove access" confirm is an outlined danger button at the neighbours' size; helper text 13px (was about 11px); numbered list has a styled marker. Activity: entries gain an optional `result` ("succeeded"/"failed"; other values ignored). For secret-key writes (create, update, rotate, delete, offer, set default) an allowed entry with no result reads "tried to add a key."; "added a key." only with `result: "succeeded"`; failed reads "tried to add a key, but it did not work." The server's audit allow-list (`app/api/security/audit`, not mine) sends no `result` today, so every key write reads "tried to ..." until Core records one.
- **Home, #16, #13, journey 11** (`home/model/connected.ts`, `sections/HomeConnected.tsx`, `HomePage.tsx`, `home.css`): card is "Browsers and apps"; approved clients first, pending ones under "Waiting for approval", repeat attempts folded into one row ("asked 3 times"), revoked ones dropped (matched by client id from the gateway's `trustedClients`, else by name when not live), built-in runtime (`direct`) hidden, "last seen not known" omitted. States: Online / Offline / Busy. H1 and spacing on tokens.
- **Programs / hierarchy, #9, #7, #12, #17** (`automation-studio/hierarchy/ProjectBrowser.tsx`, `projects-page.css`, `programs/format/shortJson.ts`, loading strings): load failure is one plain line with one "Try again" (the Page's duplicate red line and the "Retry" relabel are gone), and no empty state shows under it; one empty state, not two; "No description" filler removed; date column is date-only and `nowrap`. #9: `shortJson` no longer prints raw JSON ("id: docs.rebuild"). Loading copy unified to "…" (about 14 strings).

## Commands run (all through the slot queue)
- `pnpm --filter @fluxiq/web check` (`panel-pages-check`) -> exit 0 (build-cache `web:check`, 89.7 s).
- `pnpm exec vitest run` on chats, projects, settings-page, security, home, programs, automation-studio/hierarchy (`panel-pages-tests`) -> 115 of 116 files, 1088 of 1089 tests passed; the one failure was my own string change in `Combobox.test.tsx` ("Loading options..."), fixed.
- Combobox test rerun plus `tsc --noEmit` and `ProjectBrowser.test.ts` (`panel-pages-final`, `panel-pages-last`) -> ProjectBrowser 5/5 passed; tsc printed nothing (exit 0).
- `node scripts/structure-audit.mjs` (Core) -> first run 6 violations, one mine (`as never` in ProjectBrowser.test.ts, fixed); last run: "1 violation(s)": `[imports] app/product/preset/is-hidden-panel-path.ts` reaches into `settings-page/model/engine-tools` (another worker's file in `app/`, not mine).
- New tests: chat names and untitled names (`chat-rows.test.ts`), New chat URL and dock project (`ChatThreadPage.test.tsx`), Projects list after a header create (`use-projects-changed-sync.test.tsx`), Activity wording on failure/success/unknown (`activity-section.test.tsx`), Home grouping (`home-model.test.ts`, `HomeConnected.test.tsx`), one empty state and single Try again (`ProjectBrowser.test.ts`), Settings reserve (`SettingsPage.test.ts`).

## Not verified
- No live screenshot pass: CSS rules (reserve block, tab row, danger button, date nowrap, tokens) are stated above, effects unmeasured, including the Settings CLS.
- The Projects page was tested through the sync hook, not a mounted page with the real catalog loader; the header-create flow is unseen live.
- Home revoked matching assumes the gateway snapshot's `trustedClients` carry `clientId` and `status: "revoked"`; the name fallback covers a missing id only.
- Sweep #9 remainder (database "T" icons, "Locked", docs path kicker, `runtime.<id>` text) not changed: the kicker is in `app/styles`, the rest are developer pages.
- The `/chats/<id>` dock now follows the page's project; hiding it entirely would be a panel-shell change.

## Open questions
- Core should record an operation `result` in the audit and `app/api/security/audit` should pass it, else Activity can only say "tried to".
- Shared in-flight breakage seen earlier in the audit (project-storage, ChatDock tests) was not mine and had cleared by the last run except `is-hidden-panel-path.ts`.
