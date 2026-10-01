# Onboarding entry design

Outcome: Complete read-only design (2026-10-01); no implementation or runtime certification claimed.

## Actual current entry and state

Core paths below are relative to `C:/Users/osrs_/FluxStuff/fxwork/t224/!FluxIQ`.

- `apps/web/src/app/page.tsx:17` renders the directory heading and ProgramLauncher. `ProgramLauncher.tsx:40` constructs only domain/program rows; there is no setup row. A direct Get started link in the directory heading is the smallest discoverability fix; it does not require changing program catalog contracts or launcher sorting/recents.
- `app/get-started/GetStartedClient.tsx:14` pushes `/programs/automation-studio?start=<option>`. It currently drops domain scope. Its comment explicitly acknowledges the receiver does not consume start. Emitted values come from `features/automation-studio/onboarding/types.ts:51` / `onboarding-copy.ts:10`: `describe` (Describe an automation), `demonstrate` (Show FluxIQ how), `extract` (Extract data from this page).
- `onboarding/OnboardingView.tsx:54` offers all three start buttons even while prerequisites are incomplete. Readiness must remain honest after entry, rather than assuming the button meant runtime/browser/key ready. The setup checklist separately distinguishes runtime, pairing and model key failures (`onboarding-steps.ts`). It has an optional Open Connected browsers callback; the standalone GetStartedClient does not supply it.
- Studio server route `app/programs/automation-studio/page.tsx:15` validates domainId and mounts ProgramWorkspace; browser entry owns query consumption (`live/hooks/useAutomationBrowserEntry.ts:11`). `navigation.ts:17` reads project/flow/subflow/view/detail only. Its serializer clones base params before changing those five keys, preserving domainId and currently also start.
- `live/components/AutomationStudioSession.tsx:641` renders ProjectGate when restoring a URL project or no project is active. Gate displays restoration feedback or searchable catalog/create-project controls (`AutomationStudioProjectGate.tsx:34`). No URL project means catalog; there is no safe implied project to mutate. Project creation updates catalog and explicitly opens the created project (`project/ProjectCatalogSurface.tsx`).
- `useAutomationProjectRuntime.ts:178` changes project URL through the existing deep-link serializer; project lifecycle opens shell before hydration, restores saved workspace selection and drops obsolete generations. `useAutomationDeepLinkRuntime.ts:28` waits for the URL project to be active and loaded, then restores flow/subflow/view. Start handling must not compete with that restore or overwrite its explicit target.
- Explicit creation is already available through `useAutomationHierarchyCommandBridge.ts:132`: it opens the named Flow dialog and sets kind Flow; no Flow exists until form submission. The Steps start pane then checks model binding/readiness and supports describe/improve. Those dialogs, permissions and generated-proposal review remain their existing owners.
- Demonstration uses `clients/ClientGatewayView.tsx`: paired/connected browser selection and explicit authorized Start/Stop recording. Extraction is extension-owned, performed against the actual browser page. Core's state viewer and generic Action Test are not equivalent to the extension's interactive extraction chooser. A start intent must not pretend the Core panel itself knows the page the user is on or execute an action from URL input.

## Recommended behavior

Use a small **guided entry banner**, not an automatic project/recording/page mutation. The recognized start value selects useful copy and an explicit next action. This fulfills the chosen journey while keeping the catalog usable and avoiding a one-shot effect that reopens dialogs on refresh.

| Intent | Catalog / restoring state | Loaded project state |
| --- | --- | --- |
| describe | Explain: choose a project, or use existing Create project to keep this automation. During restoration show waiting feedback and disable journey commands. | Offer **Create automation** through existing hierarchyBridge.createFlow. Explain that model selection lives in Settings, and Steps accepts the website task and returns a draft for review. Do not silently create/select a Flow or overwrite an existing selected Flow. |
| demonstrate | Explain: choose/create the project that will own the recording. Keep intent while project is chosen. | Offer **Open Connected browsers** through existing openView(client-gateway, preview); explain connect/select browser, then explicit Start recording. No automatic recording, browser selection or authorization. |
| extract | Explain that extraction happens in the extension on the target page; choose/create a project if needed for project context. | Offer **Open Connected browsers** and concise steps: open the extension on the target page, select extraction, choose table/list and inspect preview. No pretend Core extraction action or domain-specific selector. |

The banner must include **Dismiss**. Keep setup accessible through **Get started** (`/get-started`, carrying domainId) without leaving a misleading dead-end. Do not add a new backend endpoint or duplicate durable project ownership.

Intent parsing is separate from canonical deep-link parsing: allow exactly one `start` value from the three-option allowlist; reject unknown, blank or repeated values. Do not add fields to AutomationStudioDeepLink or change its existing equality/default-view contracts. Explicit project/flow/subflow/view/detail URLs always restore as they do now. The banner is supplementary; it never auto-switches the view after hydration.

Consume only after the person explicitly takes a loaded-project next action or dismisses. Clone the **current** URL params and remove only `start`; preserve domainId, project, flow, subflow, view, detail and unrelated parameters. Use the established replaceState helper, retaining history.state and creating no new history entry. No request is issued merely by arriving. Refresh before consumption redisplays useful guidance with no duplicate work; refresh afterward shows the normal restored workspace. Back returns to the setup page without an extra synthetic entry. Navigating to a new valid start URL displays that new choice; stale dismiss/action handlers must not remove a later choice. A component-local dismissal alone is insufficient because refresh would reintroduce it.

GetStartedClient should carry only the current domainId into the Studio destination (encoded URLSearchParams), not an arbitrary return URL or copied unrelated source query. The Studio route remains the authority for validating that scope. Returning to setup should preserve the current domainId similarly. Global directory link is unscoped.

## Exact minimal proposed ownership

All listed product changes require the next written implementation brief. Existing authoring/Problems/extension lanes remain frozen.

1. `apps/web/src/app/page.tsx`: visible Get started link beside directory heading. Owning new `app/tests/HomePage.test.tsx` (or existing exact home-page test if supervisor finds one): authenticated discoverability and unauthenticated LoginPanel preservation. `ProgramLauncher.tsx` needs no edit.
2. `app/get-started/GetStartedClient.tsx` and new `app/get-started/tests/GetStartedClient.test.tsx`: emitted allowlisted choices with domain scope retained; expose the acknowledged chosen journey rather than stale comment. Existing setup sources/checklist do not need modification.
3. `features/automation-studio/live/hooks/useAutomationBrowserEntry.ts` and new owning `tests/browser-start-intent.test.tsx`: expose validated startIntent and a guarded consumeStartIntent callback, keeping existing deepLink/pathname/searchSignature output. Current-url removal uses existing `model/live-helpers.ts` helpers read-only. One query entry owner; avoid putting a second useSearchParams in random views.
4. New focused `features/automation-studio/onboarding/entry/StudioStartJourney.tsx`, `entry/index.ts`, `entry/tests/StudioStartJourney.test.tsx`: props-driven banner/commands, restoring/catalog/loaded distinction, labels and explicit intent consumption. Make this a composition wrapper with a flex column banner and a min-height-zero growing child region; existing workspace/catalog remain children. No new global styles or runtime stores needed initially. Wide/narrow overflow still requires later browser certification.
5. `live/components/AutomationStudioSession.tsx`: minimal composition only. Receive startIntent/consume from existing browser-entry hook; wrap both catalog and workspace returns in the same entry wrapper type, passing restoring/loaded state, current active project, hierarchyBridge.createFlow, existing openView and children. No new effect/polling/request/navigation owner inside this already oversized coordinator. Existing project/deep-link restore code stays unchanged. Add integration coverage in new owning `live/components/tests/studio-start-entry.test.tsx` if wrapper/hook tests alone cannot prove final callback wiring.

This proposal uses five existing/new product modules plus the new barrel, four focused tests plus one integration test if needed. Do not edit navigation.ts, runtime packages, onboarding public types/checklist, project persistence or browser extension extraction. The exact host layout and asynchronous wiring should be validated through those components, not by source-string tests alone.

## Meaningful synthetic acceptance cases

- Directory exposes setup; every emitted choice matches a recognized journey. Domain-scoped setup emits encoded domainId; global setup does not invent one. Unknown/repeated start does not navigate or show arbitrary copy.
- Catalog with zero, one and many projects remains usable; no auto project choice/create/record/action requests. Start persists through explicit project selection/creation until a next action/dismiss; failed project open retains useful guidance and catalog error feedback.
- URL restoration delays journey actions; delayed old hydration cannot open a view/create dialog in another project. A valid explicit flow/subflow/view/detail plus start restores the deep link exactly; supplementary guidance does not steal selection.
- describe opens only existing Flow dialog; cancellation creates no object, preserves existing edits; missing model key still routes through established Settings/readiness. demonstrate/extract open only Connected browsers on explicit activation; they never call recording/action APIs.
- Consume/dismiss removes only start from current URL, retains domain/canonical/unrelated params and history.state, uses replace rather than push. Refresh before/after consume and back/forward repeat no mutation. A delayed old action cannot clear a newer intent.
- All callbacks remain current after project/intent changes; no duplicate activation side effects. Labels, dismiss and keyboard activation render; narrow/200%-zoom/focus placement are not certified by synthetic renderer tests.

Validation performed: read-only source searches and traced handler/state ownership. No tests/builds, live/provider/browser calls, product/shared document edits, commits or pushes. Changed only this report. Implementation is proposed, not completed.
