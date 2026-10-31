# t814 required D5 seed ownership fix

Outcome: Done. The required seed-owner behavior and partial/concurrent retry safety are implemented and narrowly verified. No git mutations or shared working-document edits.

## Implemented

- Added Core's named public `recordAutomationStudioCreatedProjectOwner` helper, delegating to the registered ownership resolver. It validates a nonempty owner, fails closed without registration, and reuses existing project existence/creator conflict/persistence checks. No stores or mutable registry became public.
- The product seed records the authoritative event owner on newly created or incompletely assigned existing seeds. A per-service promise sequence prevents concurrent duplicates while retaining each caller's result; a later call can repair an earlier failure. Existing different creators and ambiguous duplicate names are refused.
- Product regression fixtures use public Core APIs, real provisioning, actual viewer sessions, a real workspace policy source under `service`, and a different fallback admin. Both people hold the same ordinary user policy in the target workspace, so the non-owner refusal tests ownership. Temporary storage is initialized through the public initializer, model providers are disabled and env loading is off.
- Added Core public-helper tests and product ownership, repair, repeat/concurrent event, different-creator, ambiguous-name and error propagation tests. Updated authored Core/product architecture. No provisioning timing change, login invention, private downstream IAM import, browser or model code.

## Observed validation

- Product baseline `pnpm.cmd --filter @fluxiq-web-extension/product test seed-default-project`: first attempt exposed a fixture storage-initialization error (not behavioral evidence). Added the public storage initializer before creating FluxIQ.
- The same command on old seed/current stamped Core after fixture correction: 2 passed / 7 failed. The real owner saw zero seeded projects; the unowned seed was not repaired, and conflict/partial-create/invalid-owner tests did not reject. This is the meaningful behavioral red.
- Core baseline `pnpm.cmd --filter fluxiq exec vitest run src/programs/automation-studio/api/ownership/tests/record-created-project-owner.test.ts`: 5 failed because the requested public helper did not exist. These tests also exercise real registered ownership behavior after implementation.
- Both final-source structure audits passed: Core 474 warnings / 1144 baselined; downstream 236 warnings / 616 baselined.
- `pnpm.cmd --filter fluxiq exec vitest run src/programs/automation-studio/api/ownership`: all 7 files / 36 tests passed (including the new public-helper 5).
- `pnpm.cmd --filter fluxiq check`: passed, shared-cache stamp written after 49,103 ms.
- `pnpm.cmd docs:reference`: regenerated both reference copies (4,382 public declarations). `pnpm.cmd docs:check`: passed; links clean and deterministic reference current.
- Downstream structure audit after the final fixture cleanup safety checks: passed (236 warnings / 616 baselined).
- `pnpm.cmd --filter fluxiq build`: the single final-source library rebuild passed and stamped its identity (88,789 ms; 12,610 cached files). No source changed during it.
- `pnpm.cmd --filter @fluxiq-web-extension/product check`: passed; the prerequisite freshness gate confirmed paired Core current with source.
- `pnpm.cmd --filter @fluxiq-web-extension/product test`: all 18 tests passed (25.7 seconds); the freshness gate again confirmed current Core. This includes real service-IAM owner/non-owner behavior, host registration, fallback-owner replacement, partial-create repair, repeated/concurrent no-duplicate behavior, concurrent different-owner conflict and queued repair preserving the original failure.
- `pnpm.cmd --filter @fluxiq-web-extension/product build`: passed; current Core confirmed and the product host bundle regenerated (5.0 kb). Build/test outputs are ignored artifacts and must not be staged.
- Heavy marker acquired atomically and removed only after exact owner-string comparison; release command observed success. No checks or processes remain running from this continuation.

## Files owned by this continuation

Core: `packages/fluxiq/src/programs/automation-studio/api/ownership/record-created-project-owner.ts`, `ownership/index.ts`, `ownership/tests/record-created-project-owner.test.ts`; `api/index.ts` named helper export; `docs/architecture/platform.md`; regenerated `docs/reference/framework-reference.md` and `packages/fluxiq/docs/reference/framework-reference.md`.

Downstream: `apps/product/src/hooks/seed-default-project.ts`, `hooks/tests/seed-default-project.test.ts`, `hooks/tests/seed-workspace.ts`, `host/tests/platform.test.ts`, product paragraph in `docs/architecture/repository-layout.md`.

## Remaining boundaries

Lead performs independent acceptance and git integration. No full suites, browser render, live model calls, panel management or later C2/C3 lifecycle wiring were run or changed. The process-local sequence protects concurrent calls using the same workspace service, which the workspace manager owns; it does not introduce a cross-process initialization protocol.

Outcome: Done
Changed: paired Core public ownership helper/export/tests/docs/reference; downstream product seed/tests/fixture/authored architecture; this report
Validation: Core ownership tests 7 files / 36 passed; Core typecheck/build/docs check passed; both structure audits passed; product typecheck/build and all 18 tests passed
Not verified: later lifecycle wiring, multi-process initialization, browser rendering, full sweeps or model behavior; intentionally outside this seed-only unit
Report: docs/working/framework-heavy-lifting-plan/reports/codex-1030/t814-ownership-fix-result.md
Notes: No git/shared-doc edits. Heavy marker released after exact-owner verification. No running checks remain.
