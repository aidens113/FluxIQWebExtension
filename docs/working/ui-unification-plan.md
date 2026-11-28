# UI Unification Plan

Status: Active
Status detail: Phase 1 audit and decisions recorded; phase 2 fixes dispatched by the t1095 sub-supervisor.
Created: 2026-11-27
Last updated: 2026-11-27
Owner: Senior supervisor agent (t1095 sub-supervisor for the audit and fixes)
Scope: One obvious way to make and run a Flow from the extension, with the panel showing the same project and conversation; configuration and project management in the panel; the project-name click and the stuck connect request fixed.
Paired document: none (Core changes are recorded here; Core has no separate working document for t1095)
Related: [page-diff-delivery-plan briefs/t1095](./page-diff-delivery-plan/briefs/t1095-ui-audit-unify.md), [AGENTS.md "The panel owns configuration and projects"](../../AGENTS.md)

## Current State

- **What the user asked (2026-11-27):** "The panel and extension UI are confusing regarding projects, open chats, and
  syncing ... IT NEEDS TO BE UNIFIED AND EASY TO UNDERSTAND. CLICKING THE PROJECT NAME IN EXTENSION SHOULDNT MINIMIZE
  OR MAXIMIZE CONVERSATIONS ... DO A FULL AUDIT AND FIX ALL THAT." Then: config, keys and project management live in
  the panel for every client; the client shows what is happening (every project, the Flow being worked on).
- **Done:** the audit (three read-only reports under `ui-unification-plan/reports/t1095/`) and the decisions below.
- **In progress:** phase 2, the fixes, partitioned by file in "Changes By File". Results go to
  `ui-unification-plan/reports/t1095.md`.
- **Not yet:** live browser check of the new path by a person; the lead commits.

## The Single Path (decision)

1. A person opens the extension and types what they want into its chat. Nothing has to be made first.
2. FluxIQ picks the person's current project, or makes their first one (Core's `first-project`, already built), and
   the build makes the Flow in it.
3. The panel shows the same project and the same conversation: every chat belongs to a project and lives in that
   project's conversation store, which the panel and every client read. "Open in FluxIQ panel" from the extension lands
   on that conversation (`/chats/<conversationId>?project=<projectId>`).
4. The person's current project and open Flow are held by Core, per person, so the panel and every client agree on
   them. Either side may switch it; the other follows.
5. The extension keeps: the chat, the project list (to see and switch, never to create), the Automations tab (the
   Flows and their runs), the strip for the open Flow (run, stop, exports), connection (pairing is browser-side),
   browser permissions, and appearance. Everything else is a link into the panel.
6. Word choices: the chat is "the chat" everywhere (no "Assistant" versus "Chats" versus "Ask" split); the panel is
   "the FluxIQ panel"; links say "Open in FluxIQ panel".

## Audit: Where A Person Meets These Things

Paths: EXT = `apps/extension/src`; UIC = Core `packages/ui-components/src`; W = Core `apps/web/src`;
F = Core `packages/fluxiq/src`. Full citations are in the three reports.

| Surface | Today | Verdict |
| --- | --- | --- |
| Extension top bar (`EXT/panel/shell/top-bar.ts`) | Logo, project switcher, Chat / Automations tabs, connection dot, Settings, "↗" | Keep; Settings shrinks |
| Project switcher (`UIC/project-switcher/*`, `EXT/panel/projects/*`) | Rows, search, "+ New project" with a name field, "All projects in FluxIQ"; "Choose a project" when none | Rows stay; create goes (panel only) |
| Chat bar (`UIC/chat/view/thread-header.ts`) | The project name is a button that opens or closes the conversation drawer, beside a "Chats" button | Defect 1 |
| Conversation drawer (`UIC/chat/threads/*`) | Search, rows, New chat, Rename, Delete | Rows and New chat stay; Rename and Delete in the panel |
| Context line (`UIC/chat/view/context-line.ts`) | Names the open Flow again under the strip | Duplicate; off in the extension |
| Flow strip (`EXT/panel/automations/automation-strip.ts`) | Run, Stop, exports, two "Open ... in FluxIQ", per-Flow humanness | Stays; humanness becomes a panel link |
| Automations tab (`EXT/panel/automations/automations-tab.ts`, `EXT/panel/recording/recording-controls.ts`) | Lists Flows; a "New automation" card and "Show FluxIQ how" | List stays; card goes (the chat is the one entry; composer "Show me how" stays) |
| Extension Settings (`EXT/panel/settings/*`) | Connection, project "Change", writable AI key card, humanness slider, permissions, appearance, two addresses, forget pairing, Save bar | Keys, humanness, project "Change" go to the panel; connection, permissions, appearance stay |
| Getting started (`EXT/panel/getting-started/start/*`) | Start FluxIQ, Connect and approve, Add your AI key | Key step becomes a panel link |
| Chat key card and key bar (`UIC/model-access/key/*`, `UIC/chat/onboarding/composer-key-bar.ts`) | A key can be pasted and saved from the extension | Read-only in clients; the panel adds keys |
| Panel dock "Assistant"/"Ask" (`W/features/panel-shell/dock/AssistantDock.tsx`) | A per-user thread with no project, plus the open project's threads; "New chat" always makes a project-less thread | Defect 3 |
| Panel `/chats` (`W/features/chats/*`) | Project chats; project-less threads only in "all projects" scope, labelled "Assistant", opened on a fake project id `panel` | Defect 3 |
| Panel project choice (`W/features/panel-shell/context/project-storage.ts`) | Kept in that browser's localStorage only; never written to Core | Defect 4 |
| Panel pairing (`W/app/GlobalClientGatewayPairing.tsx`, `W/features/settings-page/connect/*`) | Dialog on any page; Devices page | Defect 2 |

## Defects, With Steps To Reproduce

**Defect 1: clicking the project name opens or closes the conversations.**
- Steps: open the extension with a project chosen; click the name in the chat bar under the top bar.
- Seen: the conversation drawer opens (hiding the thread and composer); click again and it closes.
- Cause: `UIC/chat/view/thread-header.ts:116-121` makes the bar's title a button wired to the drawer toggle
  (`UIC/chat/threads/chat-threads.ts:120,154-160`), and the title text is the project name
  (`UIC/chat/conversation/thread-list/title.ts:12,17`), so the project appears twice and one copy toggles chats.
- Fix: the title is plain text naming the conversation, never the project; "Chats" is the only toggle.

**Defect 2: a connect ("sync") request shows in the panel only after Cancel and Connect again.**
- Steps: open the extension so it asks to connect; take more than five minutes before opening the panel (or close the
  panel's dialog with X, or let the panel's live updates drop on an expired session); open the panel.
- Seen: no dialog; the extension still shows its code and offers only "Cancel approval request". Cancel then Connect
  makes a new request, which pops up.
- Causes (`ui-unification-plan/reports/t1095/sync-defect.md`, proved by a probe against Core's real gateway service):
  - RC1: a request's code lasts five minutes (`F/client-gateway/service/config.ts:42`, `pairings.ts:95`); on expiry
    Core deletes it and tells the panel (`pairings.ts:120-132`) but sends nothing to the still-waiting browser, which
    keeps showing a dead code; the panel hides expired requests (`W/app/GlobalClientGatewayPairing.tsx:44`).
  - RC2: closing the dialog hides that request in that tab until reload (`GlobalClientGatewayPairing.tsx:131,175-178`).
  - RC3: the panel's live-update connection can close for good after a refused reconnect
    (`W/features/panel-changes/connection.ts:124-127`) and signing in again in place does not reopen it.
  - RC4 (not reproduced): a request made just as the panel's connection opens can be missed
    (`W/app/api/panel/changes/topics/gateway.ts:116,128-130`).
  - RC5: on reconnect the extension briefly shows the previous socket's code
    (`packages/client-gateway-websocket/src/connection/connection.ts:55,326`).
- Fix: Core renews the code on the same socket and sends `server.pairing_required` again (no new message type, no
  timeout changed); the dialog updates a renewed request in place; closing it leaves a "wants to connect · Review"
  bar; re-sign-in reopens live updates and a "Not live · Reconnect" line shows when they are down; the panel's stream
  reports open only after its starting view is recorded; the client clears the old code on a new hello.

**Defect 3: two kinds of chat, and the extension cannot see one of them.**
- Panel dock chats with no project, and every dock "New chat", go to a per-user store with no project
  (`F/programs/automation-studio/api/panel-assistant/register.ts:72-88`), refused to paired clients. The extension's
  all-chats list calls that refused endpoint and returns the refusal as the whole list
  (`EXT/background/panel/conversation-relay.ts:108-112`).
- Fix: every new chat belongs to a project; the panel with no open project uses the person's project the same way the
  extension does (`first-project`); the dock's "New chat" makes a project conversation. Earlier project-less threads
  stay readable in the panel, opened where they live, never on a fake project id. The extension stops asking for them.

**Defect 4: "the current project" differs between the panel and the extension.**
- The panel's choice is localStorage only (`W/features/panel-shell/context/project-storage.ts`); the extension's is
  browser storage only (`EXT/background/connection/project-context.ts:61,94-102`); Core's per-person preference that
  the client snapshot reads (`W/app/api/client-gateway/snapshot/project.ts:12`) is never written by either, and its
  write route refuses paired clients (`W/app/api/client-gateway/automation-studio-context/prepare.ts:8`).
- Fix: both write the per-person current project and open Flow to Core through that route; both read it back.

**Smaller defects (all fixed in phase 2):**
- D1 "+ New project" and "Choose a project" suggest a project must be made first; it need not.
- D2 three places to add a key, with contradictory words (`step-words.ts:19` versus `model-section.ts:16`).
- D5 several ways to start a Flow (card, "Show FluxIQ how", empty-state shortcuts, empty-list text).
- D6 the open Flow named twice (strip and context line; `contextLine: false` is documented but not passed).
- D7 the empty chat never says FluxIQ picks the project.
- D8 many "Open FluxIQ" buttons with different words.
- D9 Settings mixes panel config with browser-only config under one Save bar; project "Change" is a second switcher.
- D11 `no_project` says "Connect, then try again" instead of pointing at the panel.
- Panel: `project-for.ts` tells a person to choose a project although `first-project` exists; the Security nav hint
  still says "Keys"; "Assistant", "Ask" and "Chats" name one thing three ways.

## Stable Interfaces (fixed before dispatch)

- **I1 projects port:** `ProjectsPort.create` becomes optional (UIC `project-switcher/projects-port.ts`). Without it
  the switcher shows no "+ New project" or name field, its all-projects action reads "Add or manage projects in the
  FluxIQ panel", and the no-project state reads "No project yet" with "FluxIQ makes one when you send your first
  message." The panel keeps passing `create`.
- **I2 model keys:** a `ModelKeysPort` with `canWrite: false` draws the key state and one action that sends the person
  to the FluxIQ panel (the existing open-FluxIQ host action), no form, no Replace or Remove. The panel keeps
  `canWrite: true`.
- **I3 chat bar:** the bar's title is plain text naming the conversation (its own title, else "New chat"); "Chats" is
  the only drawer toggle.
- **I4 connect requests:** no wire change. `server.pairing_required` may arrive more than once on one socket, each time
  with a fresh code.
- **I5 current project:** `POST /api/client-gateway/automation-studio-context` with
  `{ "activeProjectId": string | null, "activeFlowId"?: string | null }` sets the person's current project and Flow.
  The panel calls it on every switch; a paired client may call it for itself (no `clientId` field; a client bound to
  one project is refused another with 403 and a sentence). Response `{ ok: true, ... }` or `{ ok: false, error }`. The
  client snapshot's `projectId`/`flowId` read the same per-person value.
- **I6 open in panel:** the extension's `panelOpenFluxIQ` message gains optional `conversationId` and `projectId`;
  with both it opens `/chats/<conversationId>?project=<projectId>`.

## Changes By File

| Worker | Tier | Owns | Fixes |
| --- | --- | --- | --- |
| uic | worker (Sonnet) | Core `packages/ui-components/src/{project-switcher,model-access,chat/view,chat/threads,chat/conversation/thread-list,chat/onboarding}/**` | Defect 1, I1, I2, I3 |
| pairing | worker-heavy (Opus) | Core `packages/fluxiq/src/client-gateway/**`, `packages/client-gateway-websocket/**`, `W/app/GlobalClientGatewayPairing.tsx`, `W/app/tests/GlobalClientGatewayPairing*`, `W/features/panel-changes/**`, `W/app/api/panel/changes/**`, `W/features/settings-page/connect/**`, the session re-authentication component | Defect 2 |
| identity | worker-heavy (Opus) | Core `W/features/panel-shell/context/**`, `W/features/chat-widget/**`, `W/features/panel-shell/dock/**`, `W/features/chats/**`, `W/features/panel-shell/nav/**`, `W/app/api/client-gateway/{automation-studio-context,snapshot}/**`, `F/programs/automation-studio/api/{panel-assistant,person-project.ts}` | Defects 3 and 4 (panel and Core side), I5, panel words |
| ext-ui | worker (Sonnet) | EXT `panel/{settings,projects,getting-started,automations,recording,shell,chat,open-fluxiq}/**` (not `chat/transport/ports/results/**`) | D1, D2, D5-D9, the removals, uses I1-I3, I6 |
| ext-bg | worker (Sonnet) | EXT `background/{panel,projects,connection,connect}/**`, `shared/**` protocol types | Defect 3 and 4 (extension side), D11, I5 client call, I6 routing, a test that a repeated `server.pairing_required` updates the code |

Must not touch (t1091, t1093, t1094): EXT `runtime/**`, `content/**`, `page-world/**`; Core `runtime/models/**`,
`runtime/llm/**`, `flows/authoring/model/authoring-mode/**`, `answer-first/result/**`, `answer-first/result-feed/**`.

## Validation Requirements

- Core: `pnpm --filter @fluxiq/ui-components check` and tests beside each change; `web:check` and the web tests beside
  each change; `packages/fluxiq` tests beside the gateway change; `pnpm structure:check`.
- Extension: the extension typecheck, the tests beside each change, `pnpm structure:check`,
  `node scripts/check/model-text.mjs`.
- Tests per defect: the chat-bar title does not toggle the drawer; a pending request whose code lapses is renewed on
  the same socket and shown in the panel without a resend; a closed dialog leaves the review bar.
- Screenshots of the new path from a provider-free `ui:e2e` run on a realistic scenario, through the heavy slot.

## Work Ledger

### 2026-11-27 — Phase 1 audit and decisions
- Agent: t1095 sub-supervisor with workers ext-audit (Sonnet), panel-audit (Sonnet), sync-defect (Opus)
- Changed: this document; `ui-unification-plan/reports/t1095/{ext-audit,panel-audit,sync-defect}.md`
- Why: the user's request for a full audit; decisions made without stopping to ask, per the brief
- Validation: sync-defect probe `vitest run --root <scratchpad>/syncprobe` -> 1 passed (pending 1 -> 0 after 300000 ms, session stays pairing_required, nothing sent to the client); other findings from reading code
- Outcome: Accepted
- Follow-up: phase 2 by file, as above

## Open Questions

- None blocking. A person's live check of the new path in a real browser is owed after the lead merges.
