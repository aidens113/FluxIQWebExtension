Role: Read-only discovery worker, gpt-6-luna, High. No spawning, checks, git, model calls or source edits.
Goal: identify narrow caller regressions worth running before today's last full sweep; reports are claims, not acceptance.
Read task t817 Core/domain result reports for changed explicit-toggle-state contract, then search relevant caller tests only.
Roots: C:/Users/osrs_/FluxStuff/fxwork/t817/!FluxIQ and sibling !FluxIQWebExtension; source is frozen while native proof runs.
First focus: Core runtime/service/project-build/tests/project-build-shared-toggles.test.ts and other callers outside the14 already-run owning toggle/control/store files that still assert automatic earliest-state injection.
Second focus: downstream packages/test-runner tests using global DEFAULT_LLM_MODEL with explicit DeepSeek, or CLI planning/actual topology context assumptions after Claude default switch.
Do not reread broad plans, inspect user env/runtime data, alter fixtures or assume every string match needs a change.
Return at most8 most relevant test paths with exact stale assumption or reason it should already work; distinguish actual code reading from inference.
Recommend a bounded single caller test command per repo, not whole package/Core suites. Paid runs remain unauthorized.
Report only main downstream docs/working/framework-heavy-lifting-plan/reports/codex-1030/t817-caller-review.md.
Finish Outcome/Changed/Validation/Not verified/Report/Notes contract.
