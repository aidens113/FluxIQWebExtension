Role: Heavy debugging worker, gpt-6.1-sol, Max. No spawning, git, source edits, checks or actual provider calls.
Goal: trace four full-sweep failures in Core runtime/tests/deepseek-recovery-requests.test.ts: fake adapter sees0requests.
Read only frozen t818 Core source/tests at C:/Users/osrs_/FluxStuff/fxwork/t818/!FluxIQ; sweep continues elsewhere, do not mutate it.
Primary test: packages/fluxiq/src/programs/automation-studio/runtime/tests/deepseek-recovery-requests.test.ts and its exact runtime recovery/provider/key-resolution call chain.
Log: main downstream test-runs/2026-10-30-sweep-2/core-test.log, failure section near line1998; inspect actual cause/distance, not just missing request counts.
Sweep environment strips provider secrets/inherited FLUXIQ_* then sets only ROOT/IMPORTER_ROOT/HOST_ROOT to fresh .fluxiq/sweep-runtime. Test sets its own fake keys as source defines; no real credentials.
Core provider switch t816 added native Claude plus scoped session-key resolution; P1b/t817 followups are merged. Current Core0.14.0.
Verify whether source product regression, stale fixture, or sweep-context assumption is responsible. Never bypass key custody, relax permission/budget guards or force requests.
Return smallest correct owned file set and fail-first/fix/narrow acceptance recommendation; cite the precise guard and evidence.
No broad planning docs or env-file values; no full suites, browser, panel or paid work.
Report only main downstream docs/working/framework-heavy-lifting-plan/reports/codex-1030/sweep-recovery-failure.md.
Finish Outcome/Changed/Validation/Not verified/Report/Notes contract. Wait for lead before implementation.
