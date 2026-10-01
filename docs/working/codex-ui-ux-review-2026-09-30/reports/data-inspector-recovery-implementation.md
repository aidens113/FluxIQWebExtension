# DataInspector recovery implementation

Status: Complete — exact two Core paths frozen for supervisor independent verification
Owner: deployment_docs_audit
Date: 2026-10-01

## Written brief

- Root read complete data-inspector-recovery-plan.md and accepts its algorithm and compatibility decisions. Exact Core source release NOW; no Core broad gates are active. Tooltip/floating/CodeViewer/JsonViewer paths remain frozen and outside your ownership.
- Exact two Core paths: apps/web/src/features/automation-studio/development/DataInspector.tsx and NEW development/tests/DataInspector-recovery.test.tsx. Own this downstream report additionally. Preserve existing DataInspector.test.ts and every shared component/API/telemetry/cache/backend/helper/style path.
- Implement API+normalized-project generation boundary, mounted/current owner fences, latest ordinary callbacks, synchronous shared read/clear operation lock and exact operation finally. Conservative UI ownership is not backend project scoping or cancellation of issued mutation.
- Separate pending/unconfirmed/confirmed-empty/last-confirmed/read failure, retained samples and clear feedback. Existing views/preload buffer/event-only subscription stay intact. No raw response errors. Read retry never posts; clear ok:true only acknowledged, rejected/non-ok/malformed not confirmed and may have completed. Never replay clear or force cache counters to zero.
- Accept original absent/null metrics compatibility and unknown string kinds; narrowly validate only rendered recognized fields, no arbitrary data traversal or new public wire requirement. Record exact tests covering this decision.
- Write actual mounted typed synthetic/deferred tests first, preserve old assertions. Cover owner replacement/A-B-A/commit mask/unmount/retained callbacks, initial and refresh failure/empty, duplicate lock, separate feedback, current project capture and mutation uncertainty. Synthetic telemetry only, no actual private state.
- Heavy new+unchanged DataInspector+shared contracts, exact actual-config two-root strict types including dependency diagnostics, whitespace and module budget. No compiler/assertion/baseline/timeout relaxation; request exact scope if budgets require extraction rather than silently extending paths.
- Record baseline and iterative failures, exact observed checks and limitations, then freeze for root review. No broad gates/shared docs/commits/live/browser/Lab/providers/panel/private actions. Root handles coordination and integration.

## Execution progress

New actual-mounted typed synthetic suite written first:32 cases. Baseline on unchanged source observed **24 failed / 8 passed**, native1,8.18s, and five unhandled rejected-request errors, reproducing the missing catch/recovery path as well as pending-empty/owner/lock/uncertainty/validation gaps. No old assertions changed. Product now has API/normalized-project generation-keyed private workspace, synchronous operation lock/owner/mounted/latest-close guards, separate read confirmation vs mutation feedback, current pending/last-confirmed server table feedback, fixed local errors, explicit acknowledgement/uncertainty, and compatibility-preserving rendered-field validation. Original preload buffer and no-polling behavior remain. Narrow owning run is queued/active; source not yet frozen. No extra files/backend/private data or mutation replay.

First post-implementation owning run: **55 / 55 passed**, native0/4.90s (new32 plus unchanged inspector3/shared20), no unhandled errors. Source373lines/test129lines; scoped whitespace native0. First actual-config strict run found one new-fixture exactOptionalPropertyTypes error: an optional project was supplied as explicit undefined. Fixture now omits that property through the actual public props contract; no product/compiler change. Final narrow and strict retry pending. Validator does not inspect unused recordedAt/possibleFullScanCount/arbitrary metadata; recognized rendered fields only, unknown kind and absent/null optional metrics compatible.

## Final verification and return

- Final owning three suites: **55 / 55 passed**, native0/5.67s (new32 + unchanged inspector3 + unchanged shared20), no unhandled errors. The final source and corrected optional-project fixture were exercised together.
- Final scoped strict57054 against actual web config and exact source/newtest roots: **native0**, no product/test/dependency diagnostics. Temporary external config removed; inherited compiler options preserved, incremental disabled only for disposable check.
- Final scoped `git diff --check`: native0. Source373lines/newtest129lines; under400 advisory. Existing three assertions and exported summary helper preserved; original no-setInterval contract passed.
- Both exact Core paths are now frozen. No other source/test/helper/API/telemetry/cache/styles/backend/shared documents, broad gates, commits or private/live operations changed by this worker.

Reproducible narrow run from paired Core apps/web:

```powershell
& 'C:/Program Files/Git/bin/bash.exe' 'C:/Users/osrs_/FluxStuff/build-slots/heavy.sh' 'codex inspector final owning regressions' pnpm exec vitest run src/features/automation-studio/development/tests/DataInspector-recovery.test.tsx src/features/automation-studio/development/tests/DataInspector.test.ts src/features/programs/tests/component-contracts.test.tsx
```

Scoped strict: temporary JSON extends absolute actual apps/web/tsconfig.json, sets compilerOptions.incremental=false, include=[] and files=absolute DataInspector.tsx plus tests/DataInspector-recovery.test.tsx. From paired Core run heavy `pnpm --filter @fluxiq/web exec tsc --project <temporary-config> --noEmit`; remove temporary config afterward. No tracked config or injected production test API.

Observed synthetic guarantees: pending/unconfirmed/confirmed-empty and last-confirmed failures differ; read/clear locks acquire before a React commit; read recovery cannot post; rejected/refused/malformed clear remains uncertain until a separate explicit request; acknowledged clear does not force cache counts to zero; API/project A-B-A and retained close/work callbacks cannot publish or act in a replacement; old finally cannot release replacement work; real preload listener cleanup remains. Ordinary callback/telemetry rerenders retain the view and current confirmation. Accepted absent/null optional metrics and unknown kinds, narrow malformed rendered fields and nullable fallbacks are pinned by actual mounted fixtures.

Owner remount on project changes is conservative UI/mutation ownership, not backend metrics scoping. Issued mutations are not cancelled, and their actual outcome/idempotency/authorization or backend cache reset remains unknown. The typed synthetic fixtures do not certify live server failures, native browser focus/keyboard, telemetry-provider integration, assistive technology or latency. Root owns independent review, integrated Modal behavior and full gates; Tooltip/CodeViewer and other workers' paths stayed untouched.
