Role: Heavy acceptance worker, gpt-6.1-sol, Max. No spawning, git mutations or shared-document edits.
Goal: validate P1b after Claude/P5b/C1/E parent integration and the lead's Core0.13.0 bump.
Owned: existing t811 paired checkouts; generated reference if stale; append only own t811-result.md report.
Must not touch: production source without reporting a defect first, main checkouts, keys, user runtime data.
Read: previous t811 report and task's current package scripts; source remains frozen during acceptance.
Heavy lock owner: resume_t811 final combined acceptance; release only after exact-owner verification.
Checks: regenerate reference if needed; Core typecheck before filtered contracts/fluxiq/gateway build.
Then extension check and test:e2e:build, followed by both photo-submit-then and photo-repair-from-step Chromium specs, one worker.
Use the existing isolated public fixture sessions/profiles; no paid calls or panel management.
Also run production brief-ports auto-complete regression and standard runner check/build plus compiled CLI/auth tests.
Do not run a full sweep. Report exact failures before fixes; inspect every command's actual output.
Report: docs/working/framework-heavy-lifting-plan/reports/codex-1030/t811-result.md in downstream task tree.
Finish with Outcome, Changed, Validation, Not verified, Report and Notes return contract.
Approved follow-up: the combined candidate trial gate exceeds800lines; after the active frozen build ends, extract its retest-advice helper into an owning module, preserve old exports and behavior, add direct checks, then repeat narrow types/audit before the final library build. No budget exemption or cosmetic line removal.
Approved test-only follow-up: packages/test-runner/src/tests/cli-llm.test.ts paired explicit DeepSeek with the newly Claude global default. Keep legacy cases on an explicit supported DeepSeek model and add a fake-key default-Claude dry run, rebuild with the owning script and rerun exact compiled CLI tests. No Core or production change.
Subsequent root inspection confirmed a production CLI context omission: runCli(argv,env) did not pass existing beginLiveLlmRun.costCeilingSources, so planning used global arguments/environment. Approved cli.ts context-threading via that existing option and owning provider-free tests for explicit/default model and lowered budget; no global mutation or direct-API bypass. No Core change.
Actual-launch follow-up confirmed the same omission beyond planning: approve optional RunScenarioOptions.args in run-scenario.ts, CLI argv propagation, args/environment forwarded to coordinator.ts startTopology and its existing environment builders, with owning fake-topology process-spec tests proving actual Core model/purse/mode and secret scrubbing. Default callers retain behavior. No Core or unrelated API change.
