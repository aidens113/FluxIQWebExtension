# Onboarding entry implementation

Status: Complete worker implementation; source/tests/report frozen for supervisor verification.
Updated: 2026-10-01
Worker: authoring-review-navigation / trace_endings
Core tree: `C:/Users/osrs_/FluxStuff/fxwork/t224/!FluxIQ`

## Durable checkpoint

Supervisor released this brief after corrected web types and production build passed. Initial regression command (first three owned test files), heavy label `codex t224 onboarding reproduce`, worker session79144 observed exit1:3files,17failed/2passed,10.29s. Failures reproduce missing setup link, three dropped domain scopes and missing parser/consumer. Canonical fixture detail was corrected from invalid action to supported run:r before implementation verification; no old behavior expectation relaxed.

Current owned source: authenticated setup link, domain-preserving setup emissions, allowlisted query consumer with scope-generation/current-URL/unmount/duplicate guards, stable journey wrapper and both Session branch wiring implemented. Actions wait for hierarchy hydration. Supervisor explicitly required canonical flow/subflow targets to suppress start guidance rather than guessing excluded asynchronous restoration completion; hook suppresses guidance also for explicit view/detail, retains the URL unchanged and preserves canonical parsing. No excluded hook change. New entry tests cover explicit commands, catalog/restoring/project transitions, stale callbacks and stateful child mount preservation.

Initial four-file verification session57343 observed exit1:35pass/2fail,10.06s. The two canonical cases used the unsupported shorthand view=runtime; actual public view is runtime-debug. Corrected those fixtures to the real canonical identifier (no product workaround). Actual Session wiring test uses real browser-entry hook, stores and view-model cache, while mocking excluded runtime effects/child surfaces: session3537 observed exit0,1file/7tests,8.49s.

First five-file final session18208 observed exit0,46tests,9.23s. Review caught an avoidable worker mistake: GetStartedClient.test.tsx already contained three real snapshot/readiness regressions, but the initial edit had replaced it with mocked-emission tests. Restored all three original cases and their assertions unchanged; added three domain-scoped emissions using the real onboarding surface and existing stubbed fetch harness. Corrected final session85224 observed **exit0,5files/48tests passed,9.20s**. No skipped/relaxed tests or configured timeouts. `git diff --check` observed exit0.

Read the brief, Current State, frozen discovery report, Core code structure, owned sources and referenced navigation commands. Preparation respected the prior freeze; only the explicitly released paths were then changed. No broad checks/builds/browser/panel/provider calls or commits by this worker. Earlier authoring files remain frozen.

## Implementation

1. Add an authenticated directory Get started link in app/page.tsx; preserve LoginPanel and ProgramLauncher behavior. GetStartedClient carries only the current domainId into each of the existing three start destinations with URLSearchParams.
2. Extend the sole Studio query-entry hook with exactly-one allowlisted describe/demonstrate/extract parsing. Preserve canonical deepLink/pathname/searchSignature outputs. Expose a current-URL guarded consumption callback that removes only start through the existing replace helper, retaining project/domain/unrelated parameters, hash and history.state. Unknown, repeated and blank intents remain inert. Canonical flow/subflow/view/detail suppress guidance/consumption entirely and keep the original query unchanged, as the supervisor required; no restoration-completion signal is guessed.
3. Add the owned onboarding/entry barrel and StudioStartJourney composition wrapper. Catalog guidance keeps project selection/create usable; restoring disables actions; a loaded project exposes the existing Create automation dialog or Connected browsers command. No URL arrival creates, records, extracts, selects a browser or opens a view. Explain extension-owned page extraction and existing prerequisite checks honestly. Dismiss and setup links are explicit.
4. Wire both Session branches through the same wrapper component type with existing hierarchyBridge.createFlow and openView callbacks. Keep query effects/project hydration/deep-link restoration unchanged. Keep the child container/type/position stable even when guidance disappears, so consumption cannot remount the workspace. The wrapper owns current-scope guards so retained old action handlers cannot invoke commands in a different project or consume a later intent. Consume once before command dispatch, only after current-scope and URL guards succeed; a second activation is inert.
5. Add the five explicitly owned tests: authenticated home discoverability; actual setup emissions/domain scope; hook parsing and guarded URL replacement; catalog/restoring/project journey commands and stale handlers; Session callback/composition wiring using a focused mocked runtime/hook harness. Tests must exercise behavior, not rely on source-string assertions.

## Placement and ratchet

Session's existing baseline entry is imports=3: this is three imports bypassing another directory's barrel, not an import-count budget. Import the new wrapper from ../../onboarding/entry (its new barrel), preserving that ratchet without changing the baseline or excluded barrels. New behavior belongs in the entry component; Session gains minimal composition only and no new effect/polling owner. The new component and hook remain below file-size budgets. The existing model/live-helpers directory has no barrel; using its current helper does not introduce a barrel bypass.

## Observed focused validation

Use PowerShell with the explicit Git Bash binary and heavy wrapper from the Core tree:

`& 'C:/Program Files/Git/bin/bash.exe' 'C:/Users/osrs_/FluxStuff/build-slots/heavy.sh' 'codex t224 onboarding preserved final' pnpm --filter @fluxiq/web exec vitest run src/app/tests/HomePage.test.tsx src/app/get-started/tests/GetStartedClient.test.tsx src/features/automation-studio/live/hooks/tests/browser-start-intent.test.tsx src/features/automation-studio/onboarding/entry/tests/StudioStartJourney.test.tsx src/features/automation-studio/live/components/tests/studio-start-entry.test.tsx`

Final cases: home2; real setup6 (original3 plus new3); query hook19; journey14; actual Session wiring7. Cover allowlist/repeated query rejection, canonical precedence, domain encoding, only-start replace/history-state/hash preservation, refresh/back/forward passivity, route/project/domain/intent/unmount stale-handler rejection, explicit existing commands, catalog usability, hydration gates and retained stateful workspace mount. No broad gates requested for this worker; supervisor verifies integration. Synthetic history tests cannot certify actual Next/browser back-forward behavior, focus, narrow viewport or zoom. Existing excluded asynchronous restoration has no completion signal; explicit canonical targets intentionally suppress the optional journey. No live or page-extraction certification is claimed.

## Resume

All worker sessions finished; sources/tests/report frozen. Supervisor should independently inspect the six source/barrel paths and five owning tests, rerun the exact final command, then perform coordinated types/audit/build gates. Changed only app/page.tsx, app/get-started/GetStartedClient.tsx, live/hooks/useAutomationBrowserEntry.ts, onboarding/entry/StudioStartJourney.tsx and its index.ts, live/components/AutomationStudioSession.tsx, the five named owning tests, and this downstream report. No excluded/runtime/database/architecture/shared-doc/other-worktree changes, baseline/config updates, commit, merge or push.
