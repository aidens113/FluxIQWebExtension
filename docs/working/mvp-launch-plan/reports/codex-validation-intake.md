# Codex validation intake: stopped lanes (2026-11-11)

Read-only reconciliation for t885, t893, t904, t906, and metadata-only t902. No tests, builds, sweeps, paid runs, or git mutations were run.

## Lane inventory

- **t885 (`task/t885-live-checks-r3`, paired Core + extension):** clean trees, both branches one commit ahead of origin; latest WIP commits `136ef4674` (Core) and `8af850680` (extension), stopped for usage and marked unvalidated. Core WIP changes authoring script wiring/replay draft span (9 files); extension WIP adds four E1 reports plus cell/row evidence and scripted-form coverage (15 files). The preceding lane report records the live series and prior narrow checks; those do not validate the WIP commit. Resume by reviewing the added report notes first, then run the affected Core tests for `flow-authoring/bootstrap/script-wiring` and `runtime/llm/node-tools/replay`, extension domain tests under `runtime/llm-evidence/structure`, and the two changed scripted-model test files. Re-run the relevant package typechecks and structure audit before integration. No fresh live run is established by this WIP.
- **t893 (`task/t893-web-instant-actions-4`, extension):** clean tree, 24 commits ahead of origin. Latest commit is a merge from dev; immediately preceding commits record t896 press-once work and t897 dining follow-up. The named report is `docs/working/task-speed-plan/reports/press-once-in-command.md`; it reports dining replay attempts 3–4 still judged due to a deviation Core does not persist. This is a concrete remaining W1 issue: trace/persist the deviation through replay, then prove a four-attempt deterministic series with continuation proof. Do not treat the branch's ahead status as evidence that the held lane is accepted.
- **t904 (`task/t904-sweep-triage`, paired Core + extension):** both trees clean; Core is one commit ahead of origin, extension seven. Latest Core commit adds a deterministic run-deadline timer seam; narrow test report `reports/t904-round3-double-act.md` says 12 files/103 tests, the focused suite 35/35, and structure audit passed, but whole Core check/suite and offline-trial coverage were not run. Latest extension commit merges dev. Its report `docs/working/mvp-launch-plan/reports/t904-round4-content-specs.md` says five stale content specs were corrected; the narrow content cases and extension audit passed. Ready to resume with the noted offline-deadline test gap and any current narrow checks required by integration; no known product failure was reported.
- **t906 (`task/t906-site-reset-specs`, extension):** clean tree. Latest WIP commit `a5265f82d` includes three updated site-reset specs and the report. Reported final narrow run: 3 passed; structure audit passed; typecheck was inconclusive because domain build artifacts were missing. Two issues should be addressed before merge: trial-only assertions in the revised tests read fields that are no longer exposed and are therefore vacuous; and the office Buy Now trial had one unexplained execution flake, followed by two passes. Restore meaningful observable assertions (or explicitly remove/reframe the unsupported claims), then trace the flake and rerun the focused specs. Prepare domain first with `pnpm --filter @fluxiq-web-extension/domain build` (or the repo's prescribed test build), then run extension typecheck, the three site-reset specs, and structure audit. The report says no flakiness sweep was done.

## t902 dependency metadata only

- Paired branches: `task/t902-handlers-add-ons`; both trees show clean status and latest commits are WIP/unvalidated (`7bb8d69c5` Core, `be1c7af8d` extension). The extension WIP names reports `a1j-handler-resume.md`, `a1j-handler-resume.patch`, `a1j-one-call-step.md`, `a1j-store-guard.md`, and `a1j-withheld-resume.md` under `docs/working/mvp-launch-plan/reports/w6-handlers-add-ons/`. Those report contents and all security notes were intentionally not opened. No source report or security finding is inferred here.

## Full-sweep evidence

The current-state section of `docs/working/mvp-launch-plan.md` records the latest full sweep as passing on Core `b445ad6f4` and extension `42da23a9f`: Core build/check/test and extension build/check/test all exit 0; both mains were promoted. This is dated 2026-11-11 and predates the stopped WIP commits above. No sweep was run for this intake.

## Suggested resume order

1. Resolve t906's vacuous assertions and unexplained flake; it is the clearest open acceptance issue.
2. For t885, validate the committed WIP changes with the affected narrow suites before accepting the previous lane report as current.
3. Continue t893's documented replay-deviation persistence defect with a four-attempt continuation proof.
4. Recheck t904's offline deadline behavior and run its current narrow merge gates; its previous report found no product regression.

Outcome: Partial — evidence reconciled; lane acceptance remains with the lead.
Changed: this report only.
Validation: `git status --short --branch` and commit/report inspection -> all targeted trees clean; latest sweep evidence read from the t904 current-state document. No tests run by brief.
Not verified: none of the stopped WIP commits was tested in this intake; t902 report contents were not read.
Report: `docs/working/mvp-launch-plan/reports/codex-validation-intake.md`
Notes: t906's test gaps are described in its report; t902 remains metadata-only.
