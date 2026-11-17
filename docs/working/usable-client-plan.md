# Usable Client Plan

Status: Active
Status detail: Merged into both `dev` branches (extension `42b7fcc30`, Core `aa5568c46`) with t914's committed foundation; follow-ups listed under Next.
Created: 2026-11-16
Last updated: 2026-11-16
Owner: Senior supervisor agent
Scope: Make the extension and the Core web panel usable for a person testing them today: no model-key unlock for connected clients, project and chat navigation entirely inside the extension, the settings a person needs, and a panel that is fast to open and move around.
Paired document: none yet (Core edits are recorded here; a Core-side record is owed if the Core part grows beyond this task)
Related: [Hosted platform launch](./hosted-platform-launch-plan.md), [MVP launch](./mvp-launch-plan.md)

## Current State

**User request (2026-11-16):** "we need to get a working version of the extension/panel that I can test done today. The UI base looks good on the surface, but is functionality unusable. The panel is slow, seems to be missing some needed configuration stuff/ux navigation, and generally just needs to be reworked. Extension needs to actually be able to navigate through different chats and projects entirely through the extension, right now you cant do anything. And ENSURE that dumb unlock key feature is removed. if a client is connected, they are CONNECTED, meaning they have access to the basic feature of the fluxiq framework (llm)".

**Done (accepted 2026-11-16, report `final-acceptance.md`):**

- **Unlock removed.** A connected panel, paired extension or SDK session uses the configured model key with no unlock, password, key step or "key locked" wait, after logout, reconnect and Core restart. Codex built the per-use authority on t914 (`79f175d2a`, `1285dd320`); t915 deleted the dead lock path and unlock types, moved stored result-check authorizations to per-use authority (none were created since 2026-11-04; a grant path now exists through `update-flow-settings`), removed `secrets:Unlock`, rewrote the docs, and folded the rule into AGENTS.md. Keys saved before t914 need one panel sign-in to upgrade (no recovery prompt otherwise).
- **Extension:** project list, create and switch in a header switcher (shared `createProjectSwitcher`), chat bar (title, Chats, New chat), chats titled from their first message, `client.focus_project` so live activity follows the chosen project, one person's projects and chats shared with the panel (domain-scope fix), Settings project row, deep links to `/projects` and `/chats/<id>`, no per-call snapshot fetch, reachability before pairing, UI fixes from the audit.
- **Panel:** `pnpm dev` serves a production build (`--dev` for hot reload); pages 0.1-0.3 s; Projects, Chats and Connect-a-client pages; Home and Runs read across projects in two IAM-filtered calls; base styles for bare controls, an unclosed `@media` block fixed, layouts, contrast and phone navigation fixed; shared project switcher.
- **Bugs fixed on the way:** the part-run driving gate (on Core `dev` since t907 `fded721c0`), persistence fixtures and an unmarked real-SQLite test (on Core `dev` since t909), a slow cold-import test, a zod import in the neutral runtime contracts, stale tests from t914, and two server-graph imports that broke `next build`.

**Running test instance (for the user):** production panel at http://127.0.0.1:3000 (gateway ws://127.0.0.1:4777/client), started from `C:/Users/osrs_/FluxStuff/fxwork/t915/!FluxIQWebExtension` with that tree's own test data; unpacked extension at `fxwork/t915/!FluxIQWebExtension/apps/extension/dist/chrome`; the test owner's sign-in is in that tree's `test-runs/panel-test-credential.txt` (git-ignored). The user's usual `pnpm dev` in the main checkout runs against the main Core checkout, which is on Codex's unfinished `task/t911-runtime-lease-isolation` with uncommitted changes, so it does not show this work until that checkout is back on Core `dev`.

**Next (follow-ups, each its own task):**

1. Fold the cloud-plan review (below) into `hosted-platform-launch-plan.md` when Codex resumes t914's uncommitted privacy WIP in `fxwork/t914` (105 extension files; give it its own task and check whether one gate at the background capture authority suffices).
2. A Core structure-audit rule failing when a server entry reaches an unmarked hook module (the class of break `next build` alone caught).
3. A pairing-change push so the panel stops reading the gateway snapshot every 7.5 s.
4. Hosted: project-focus authority reads people from the instance's own identity service, which a hosted tenant may not use; activity access is checked when focus is set, not per push.
5. The real-SQLite test group was not run in full for t915 (its marked files changed in t915 were run by path).

**Decision (lead, 2026-11-16):** build today's work on t914's committed tip (both repositories) in a new paired task, rather than re-implementing the unlock removal on `dev`, so the two never conflict. t914's committed foundation lands on `dev` with this task.

**UI polish phase (user, 2026-11-16):** "make sure to work on the UI of the panel, is that part of the plan? there are other things like weird not properly styled UI elements". The plan had fixed only the defects the walk-through hit, so a visual phase is added: two audits (Core web panel `reports/panel-ui-audit.md`, extension side panel `reports/extension-ui-audit.md`) screenshot every page and state in light and dark at desktop and narrow widths, trace each badly styled element to its cause, and compare against the website's look (getfluxiq.com, local `FluxIQWebsite`); fix workers follow, partitioned by folder, shared tokens and base styles first.

## Cloud Plan Review (2026-11-16)

Review of [hosted-platform-launch-plan.md](./hosted-platform-launch-plan.md) as it stands on `dev` and on task t914, for the user. The design itself (Core owns identity, billing and entitlements; website stays on Hostinger; app on app.getfluxiq.com; local, hybrid and consumer modes as separate axes; no silent fallback between local and cloud; durable admission before paid work) is sound and is kept. What needs changing:

1. **Nothing has landed.** Two days of implementation (17 Core and 11 extension commits) sit on t914, and the `dev` copy of the plan still reads "audit only, nothing implemented". User-visible results such as the unlock removal never reached the user. Change: land t914's committed foundation now (this task), and from here merge each verified unit into `dev` as it finishes instead of growing one branch.
2. **No launch date.** The plan says no calendar date is justified, but go-live is about a month out (user, 2026-11-10). Change: a dated schedule cut for parallel lanes, with the critical path named: usable local client (this task), hosted panel with accounts on one server, a dedicated browser per customer, then billing. Marketplace, shared compute, real OS environments and enterprise licensing move after launch.
3. **The product people touch is missing from the phases.** The plan covers infrastructure, accounts and billing but has no package for the panel and extension being usable, although the hosted panel is what customers use at launch (user, 2026-11-10). Change: add a client-usability package (navigation, settings, speed, production panel build) ahead of phase 1; this task is its first unit.
4. **Unlock wording.** The `dev` copy still frames model-key custody around unlocks ("never borrow another person's latest unlock"). The user's rule (2026-11-16) is that a connected client has model access. Change: custody is server-held protection of configured keys; access follows authentication and IAM, and revocation still applies. Recorded in AGENTS.md.
5. **Unfinished privacy refactor.** t914's worktree holds 105 uncommitted extension files changing every content action to check tab "admission", so hosted sign-in tabs are never captured. It is unfinished and has been idle since 2026-11-14. Change: give it its own task and brief, and check whether one gate at the background capture authority gives the same guarantee before resuming a refactor of every action.

## Discovery

| Report | Question |
| --- | --- |
| [extension-navigation-audit](./usable-client-plan/reports/extension-navigation-audit.md) | Which extension journeys work, break or are missing, and why |
| [unlock-removal-verification](./usable-client-plan/reports/unlock-removal-verification.md) | Whether t914 removed every unlock surface a connected client meets |
| [core-panel-audit](./usable-client-plan/reports/core-panel-audit.md) | Why the Core web panel is slow and what configuration and navigation it lacks |

Findings in brief: the production unlock path is clean on t914, but the lock machinery, wording and docs remain and a custom host could revive the wait; keys saved before t914 need one panel sign-in to upgrade. The extension has no project concept (Core refuses `projects` and `create-project` to paired tokens) and buries chat navigation in a closed drawer; it polls every 4 seconds and fetches a Core snapshot in front of relay calls. The Core panel runs on the Next development server, fetches projects twice per page, fans Home out to 1+2N requests every 30 seconds, mounts a closed chat on every page, and has no projects page, chats page or client-connection settings.

## Assignments (task t915, `fxwork/t915`)

| Unit | Tier | Owned files (summary) | Report |
| --- | --- | --- | --- |
| U1 unlock cleanup | worker | Core lock path, secret-keys dead types, contracts model-keys, two web files, Core docs | `reports/unlock-cleanup.md` |
| U2 paired project access | worker-heavy | Core program-route allowlist, projects handler | `reports/core-project-access.md` |
| U3 extension background | worker | shared constants and protocol, background/panel, project context, runtime status, quickstart | `reports/extension-background-projects.md` |
| U4 ui-components navigation | worker | ui-components chat, new project-switcher | `reports/ui-components-navigation.md` |
| U5 extension panel shell | worker | apps/extension/src/panel, background/panel/open-fluxiq.ts | `reports/extension-panel-shell.md` |
| W1 panel launch | lead | scripts/run-fluxiq-web.mjs, layout and install docs | this ledger |
| W2 panel network cost | worker | web top-bar, dock, home | `reports/core-panel-network.md` |
| W3 panel projects and chats | worker | web projects and chats pages, nav, presets, flows list | `reports/core-panel-projects-chats.md` |
| W4 panel client connection | worker | web settings-page (not engine-tools.ts), security/access | `reports/core-panel-connect-settings.md` |

## Stable Interfaces (fixed before dispatch, 2026-11-16)

Workers build against these at the same time; a change needs the lead.

- **Core paired-client API (U2 implements, U3 consumes).** A paired extension token may call automation-studio `projects` and `create-project`. For a token caller every listed project carries at least `id`, `name`, `updatedAt` and no owner or member identities; `create-project` from a token accepts only `{ name }`. `update-project` and `delete-project` stay refused to tokens.
- **Extension runtime messages (U3 implements, U5 consumes),** in `shared/constants.ts` `RUNTIME_MESSAGES` and typed in `shared/protocol.ts`:
  - `panelListProjects` = `"fluxiq.panel.listProjects"` -> `{ ok: true, projects: PanelProjectSummary[], selectedProjectId: string | null }`, with `PanelProjectSummary = { id: string; name: string; updatedAt?: string }`.
  - `panelCreateProject` = `"fluxiq.panel.createProject"` `{ name }` -> `{ ok: true, project: PanelProjectSummary }`.
  - `panelSelectProject` = `"fluxiq.panel.selectProject"` `{ projectId: string | null }` (null means follow Core) -> `{ ok: true }`. The status the panel reads and receives carries `projectId`, `projectName` and `projectChosenBy: "person" | "core"`. Every relay without an explicit project uses the selection.
  - `panelChanges` = `"fluxiq.panel.changes"`: a push from the worker to the panel `{ projectId: string | null, conversationIds?: string[], at: number }` whenever Core's gateway reports a conversation, attempt or run change. If Core pushes nothing usable, U3 says so and U5 keeps the existing reads.
  - Every failure is `{ ok: false, error: { code, message } }`, as existing panel messages do.
- **ui-components (U4 implements, U5 consumes),** exported from `@fluxiq/ui-components`:
  - `createProjectSwitcher({ port, onSelect, onOpenAll? })` -> `{ element, setCurrent(project | null), open(), close(), refresh(), destroy() }`, where `port: ProjectsPort = { list(): Promise<ProjectSummary[]>; create(name: string): Promise<ProjectSummary> }` and `ProjectSummary = { id: string; name: string; updatedAt?: string }`. Vanilla DOM in the chat widget's style; list, search, New project, and "All projects in FluxIQ" when `onOpenAll` is given.
  - The chat widget shows a chat bar by default: current chat title, a Chats button (the list, with a waiting badge) and "+ New chat". When its `projectId` supplier returns a different project, the thread list and the open chat follow that project.
  - The chat widget accepts an injected activity feed (option `activity`) instead of always starting its own.

## Work Ledger

### 2026-11-16 — Reconcile Codex's cloud work and open this plan
- Agent: Senior supervisor.
- Changed: this document.
- Why: the user asked for a review of Codex's cloud work and a usable extension and panel today.
- Validation: `git log --oneline dev..HEAD` in `fxwork/t914` (both repositories) -> 11 extension and 17 Core commits unmerged; `git status --short | wc -l` -> 122 extension and 10 Core uncommitted paths; newest uncommitted edit 2026-11-14 23:26.
- Outcome: plan opened; discovery dispatched.
- Follow-up: implementation briefs once discovery returns.

### 2026-11-16 — Discovery returned; eight units dispatched
- Agent: Senior supervisor; discovery by three workers (reports above).
- Changed: this document (interfaces, assignments); task t915 started (`fxwork/t915`, both repositories fast-forwarded to t914's committed tips `ee9cacd68` and `592a188a4`); `scripts/run-fluxiq-web.mjs` and two docs in t915 (W1, uncommitted until a live start passes).
- Why: the three reports agree on the causes recorded under Discovery.
- Validation: `pnpm -r --filter "./packages/**" build` in t915 Core, then `pnpm install --frozen-lockfile` and `pnpm -r build` in t915 extension -> exit 0 (test-runner rebuilt because workers' edits began during the build).
- Outcome: U1-U5 and W2-W4 running in parallel on disjoint files.
- Follow-up: verify each report, integrate, build, then a headed live check of every journey.

### 2026-11-16 — First eight units returned; three follow-ups dispatched or done
- Agent: Senior supervisor; workers U1-U5, W2-W4 (reports linked in the assignments table).
- Changed (t915, uncommitted until the integrated check): every unit's owned files; lead edits `apps/extension/src/shared/fluxiq-web-routes.ts`, `shared/protocol.ts`, `background/panel/{open-fluxiq,panel-control}.ts`, `panel/shell/mount-panel.ts` and `background/panel/tests/open-purpose.test.ts` (the switcher's "All projects in FluxIQ" opens the new `/projects` page; a chat page route), `background/projects/projects-relay.ts` (Core's numeric `updatedAt` kept as ISO time), and Core `apps/web/.../[endpoint]/tests/route.test.ts` (its copy of the paired allowlist gains `projects` and `create-project`).
- Why: the shell worker read the web routes before the Projects and Chats pages existed; the project-access worker could not touch apps/web.
- Validation: worker-reported (claims, re-run at integration): U1 `pnpm --filter fluxiq check`, contracts and ui-components checks exit 0, 1559 tests pass in changed dirs; U2 138 program-route tests pass; U3 520 background tests pass; U4 742/743 (the one failure was U1's in-flight wording); U5 789 panel tests pass, extension tsc clean; W2 31, W4 59 tests pass on a scratch config; W3 not run (stale Core build, memory). Lead: `node apps/extension/scripts/test-extension.mjs src/background/panel` -> 99 pass, 0 fail.
- Outcome: two gaps found and dispatched to worker-heavy: (1) Core sends `server.activity` to a paired session only for `session.projectId`, set at pairing or by a recording, so after the person switches project the extension's chat gets no pushes: a `client.focus_project` gateway message (report `gateway-project-focus.md`); (2) stored result-check authorizations are still minted from a held key unlock and refuse a paired client (report `result-check-authority.md`).
- Follow-up: integrated build, run every unit's tests one at a time, then the live check.

### 2026-11-16 — Production panel builds; first live walk-through
- Agent: Senior supervisor; workers gateway-project-focus (done), live-walkthrough (done).
- Changed (t915): Core `apps/web/src/features/chats/index.ts` now exports only the two client pages, and the Projects page moved to `apps/web/src/features/projects/` (its barrel exports only the client page), with the route and the route test mock repointed.
- Why: the first two `next build` runs failed: a server route imported the Chats barrel, whose plain `load-chats.ts` pulled the automation-studio conversation barrel and with it unmarked hook modules (`views/view-readiness.ts`, `parameters/ParameterEditor.tsx`) into the server graph. `next dev` compiles a page only when visited, so nothing had caught it. A scratch tracer (server entries to every unmarked hook module, stopping at `"use client"`) found the chain and then reported none of the 6 unmarked hook modules reachable.
- Validation: `node scripts/run-fluxiq-web.mjs` in t915 -> `next build` passed, `next start` "Ready in 3.5s" at http://127.0.0.1:3000; `node apps/extension/scripts/test-extension.mjs src/panel src/background/panel src/background/projects src/background/connection src/shared` -> 1221 pass, 0 fail; `npx tsc -p tsconfig.test.json --noEmit` in apps/extension -> exit 0. Live walk-through (report `live-walkthrough.md`): pairing approved in 1.7 s with no unlock, password or key step anywhere; panel pages 110-470 ms to content; extension chat usable 352 ms after opening; extension makes 0 HTTP requests per idle minute.
- Outcome: blocking defect D1/D2: the extension and the panel list different projects and chats (dispatched to worker-heavy, report `shared-projects-fix.md`). UX defects D3-D10 dispatched to two workers (`panel-ux-fixes.md`, `extension-ux-fixes.md`). Structure-audit failures (3 extension, 13 Core) dispatched to two workers (`extension-audit-fixes.md`, `core-web-audit-fixes.md`).
- Follow-up: a Core structure-audit rule that fails when a server entry reaches an unmarked hook module, so this class of break is caught before `next build`.

### 2026-11-16 — Walk-through defects and pre-existing failures fixed
- Agent: Senior supervisor; workers shared-projects-fix and part-run-gate-fix (worker-heavy), panel-ux-fixes, extension-ux-fixes, extension-audit-fixes, core-web-audit-fixes, result-check-authority (reports linked by name in this folder).
- Changed (t915): D1/D2 cause was domain scope: the paired extension is bound to `web-automation` while the panel's new pages sent no domain and "no domain" was its own partition; a signed-in person's Automation Studio request with no domain now uses the instance's active domain, and on a one-domain instance "no domain" and that domain are one view (IAM unchanged). Chats are titled from their first message; the no-key reply says no key is set up and how to add one; the dock shows its chat; pairing modal laid out; Projects page styled; favicon 404 fixed; extension header names the project at once, checklist states follow the real state, the key banner's "Not now" sticks per server, no default credential printed. Result checks authorize from the granting principal's per-use authority with no held session; `secrets:Unlock` removed. A real Core bug from t907 (`fded721c0`, on Core `dev`): the part-run driving gate used the lease shortcut and never saw a plain Flow run; it now always reads the project's sessions. Lead: the context line above the latest chat is hidden (the chat bar and project switcher name it); AGENTS.md's two connected-client rules (t914's 2026-11-14 and this task's 2026-11-16) folded into one; web `check` given the 4 GB heap Core's other packages use.
- Decision (lead): the two walk-through projects stored with no domain are not migrated; only t914's unmerged panel pages ever wrote domain-less projects, so the user's data should hold none, and new projects get the active domain.
- Validation: worker-reported, re-run at integration below. Lead: `driving-gate.test.ts` fails identically on t914's untouched tip (1 failed, 15 passed), so it was pre-existing; `pnpm --filter @fluxiq/ui-components exec vitest run src/chat` -> 109 files, 734 passed after the context-line change.
- Follow-up: Home's 7.5 s gateway snapshot read needs a pairing-change push (Core pairing listener plus an event route) before it can stop polling.

### 2026-11-16 — UI polish, late fixes and final acceptance
- Agent: Senior supervisor; workers panel-ui-audit, extension-ui-audit, panel-ui-base, panel-ui-shell, panel-ui-settings, panel-ui-content, extension-ui-fixes, shared-chat-ui-fixes, chat-title-refresh, no-key-reply, home-speed, cross-project-reads, core-test-triage, preexisting-test-fixes, proof-keys-address, final-acceptance (reports in this folder).
- Changed (t915): the UI phase's fixes; chat titles refresh after a send; a keyless message gets only the setup reply while a confident Flow run still runs (lead corrected the worker's version, which stopped running Flows without a key); `list-recent-flow-runs` and `list-workspace-flow-summaries` (session-only, IAM-filtered; their missing `FILTERED_WORKSPACE_LISTS` entries would have refused every ordinary person on the service profile); the neutral `./runtime` contracts keep zod out (humanness schema moved to `humanness/schema/`); pre-existing failures fixed (persistence fixtures and flow-base from t909, the load-order test, stale web tests from t914, the task-screen wording test, the credential-messages cwd test); the paired route test classifies and checks the project endpoints' narrowing.
- Validation: lead runs in t915: `npx vitest run "src/app/api/programs/[programId]/[endpoint]/tests/route.test.ts"` in apps/web -> 79 passed; `npx vitest run src/runtime/conversations` in packages/fluxiq -> 52 files, 384 passed; `npx vitest run src/screens/tasks` in packages/ui-components -> 22 passed; `pnpm --filter @fluxiq/contracts exec vitest run` -> 112 files, 995 passed; `pnpm --filter @fluxiq/contracts check` and `pnpm --filter fluxiq check` -> exit 0 after the humanness schema move; `node --test scripts/build-cache/tests/*.test.mjs` in Core -> 74 pass; `node apps/extension/scripts/test-extension.mjs src/background/tests/credential-messages.test.ts` from the repository root and from apps/extension -> 4 pass each; `node scripts/run-fluxiq-web.mjs` -> `next build` passed and "Ready in 3.5s".
- Outcome: the final-acceptance worker reported (production build) type checks and structure audits passing in both repositories; ui-components 811, contracts 995, fluxiq parallel group 3097, extension 1690 and web 3297 of 3299 tests passing, the two being the route test the lead then fixed; panel pages 100-330 ms; every page clean in light and dark at 1440 and 390 px; extension journeys passing with no unlock step; the approved-client proof with all 20 checks true but exit 2 at its network guard (the new reachability probe reaches the default address before the proof configures its own; harness fix dispatched as `proof-network-order.md`). Accepted for merge once the proof passes.
- Follow-up: the Next list in Current State.

### 2026-11-16 — Proof fixed; t915 merged into both `dev` branches
- Agent: Senior supervisor; worker proof-network-order (report in this folder).
- Changed: the approved-client proof writes the extension's addresses through the service worker and restarts it before the panel opens (guard unchanged). Core `dev` `5e704b497..aa5568c46` (merge commit with t915's exact tree, parents `dev` `04e7b1650` and t915, made with `git commit-tree` because `dev` is checked out nowhere in Core and the user's test panel runs from the t915 worktree); extension `dev` `a79b09a1f..42b7fcc30` (`git merge --no-ff` in the main checkout after setting aside the pre-existing uncommitted AGENTS.md and Cline-rules edits, restored afterwards unchanged). Both bring t914's committed commits. `pnpm task finish` was not used because it removes the worktree the user's running test instance serves from; the t915 branches and worktrees remain for that instance and can be pruned after the user's test. Codex's t914 worktree and its uncommitted WIP are untouched.
- Validation: `node packages/test-runner/dist/extension-chat-check/cli.js --browser chrome --scenario everything-store --page ./ --no-ask --model-key` (worker run) -> exit 0, all 20 checks true, evidence `C:/Users/osrs_/FluxStuff/evidence/t198/2026-11-17T01-19-48-302Z-chrome`; lead: `node scripts/structure-audit.mjs` on the merged extension `dev` -> passed (251 warnings, 551 baselined); `git diff --stat task/t915-usable-client <merge>` in Core -> empty (identical tree); `git push origin dev` in both repositories -> accepted (`5e704b497..aa5568c46`, `a79b09a1f..42b7fcc30`).
- Outcome: done; the user's test instance keeps running from `fxwork/t915`.
- Follow-up: the Next list in Current State; after the user's test, `pnpm task prune` or `pnpm task abandon t915` to clean the worktrees (both branches are merged).

## Open Questions

None blocking.
