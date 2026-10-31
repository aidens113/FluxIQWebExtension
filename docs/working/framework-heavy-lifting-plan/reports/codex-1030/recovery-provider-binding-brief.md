Role: Heavy worker, gpt-6.1-sol, Max. No spawning, git, working-document edits, broad checks or paid calls.
Goal: fix t819 recovery and result-check resolver binding regressions found by sweep2; keep strict custody/unknown-provider/model-mismatch guards.
Edit ONLY MAIN Core C:/Users/osrs_/FluxStuff/!FluxIQ, task/t819-recovery-provider-binding. Frozen t818 is read-only and still running.
Own packages/fluxiq/src/programs/automation-studio/runtime/recovery/annotation/annotate.ts and owning tests.
Own runtime/service.ts, runtime/service/flow-settings/adaptation-policy.ts and owning tests.
Own runtime/llm/session-key-provider.ts and owning resolver tests, only to interpret existing legacy host sentinel as unspecified.
All runtime paths above are under packages/fluxiq/src/programs/automation-studio/. Do not edit model/flows.ts defaults unless evidence proves necessary; report instead.
Read Core AGENTS boundary/validation and discovery report; inspect exact resolver/caller contracts only.
Remove policyId/hardcoded host as explicit provider selections. Propagate canonical configured provider/model/key metadata into recovery and judging without inventing fallback choices.
Normalize legacy host sentinel at owning resolver boundary; explicit supported provider/model/key remains binding, all other invalid combinations must refuse before key reveal/fetch.
Sweep failures: six deepseek-recovery-requests tests plus SQL refuted-result/tests/repair-replay-chain, all zero fake calls. Do not alter their intended assertions to force passing.
Add focused regressions for legacy host and explicit Claude model/key propagation, plus unknown/mismatched rejection if existing coverage insufficient.
You may author tests but DO NOT run them yet: lead owns heavy sweep. Return commands for lead acceptance and report when edits are ready.
No manifests/version/docs changes: lead owns those. No real env reads/provider calls/panel/browser/full suite.
Report downstream docs/working/framework-heavy-lifting-plan/reports/codex-1030/recovery-provider-binding-result.md.
Finish Outcome/Changed/Validation/Not verified/Report/Notes contract. Validation explicitly not run while sweep owns checks.
