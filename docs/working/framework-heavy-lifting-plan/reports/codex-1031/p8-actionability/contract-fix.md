# t827 Phase 1 structural reader repair

Status: repaired source frozen; named pure-contract parser and Core owning tests pass. Ready for lead independent types/audit acceptance.

The lead's independent acceptance passed the original 45 contract and 53 Core owning tests and both package typechecks, then the source audit found three new violations: two catches silently returned undefined, and the owning test imported runtime/contracts.ts across the runtime boundary.

The pure contract now has a private typed validation outcome: valid with a fresh exact record, rejected with a closed validation reason, or unreadable with record_reflection_failed. Each malformed shape is explicitly classified; schema getters are still never invoked. Only the unchanged public optional parser projects a nonvalid outcome to unknown. Its catch classifies an unreadable control rather than silently returning an absent value.

The Core optional own-property reader similarly distinguishes absent, valid, rejected accessor/invalid record, and unreadable property descriptor with a closed reason. Its caller retains only a valid exact control; all other optional-control outcomes leave the actual executed result, evidence, effect, failure, person-needed and outputs intact. This reader performs no dispatch/IO work and catches no dispatch/IO failure. An added regression exercises a proxy whose optional slot cannot be reflected while the actual executed call remains intact.

The runtime type import now goes through runtime/index.ts. No API/type/export/package changes, new helper path, code packing, comment removal, audit rule or baseline changes were made. The existing Core parser is 785 lines, below its 800-line budget; no flat-directory file count changed.

Changed paths:

- Core `packages/contracts/src/actionability/parse-record.ts`.
- Core `packages/fluxiq/src/programs/automation-studio/runtime/llm/evidence-loop-decision.ts`.
- Core `packages/fluxiq/src/programs/automation-studio/runtime/llm/tests/evidence-loop-tool-failure.test.ts`.
- This private repair report.

Validation: `pnpm.cmd --filter @fluxiq/contracts exec vitest run src/actionability/tests/parse-record.test.ts --maxWorkers=2 --minWorkers=1` -> exit 0, 1 file / 30 tests passed in 1.36s. The lead then released the dependency checkpoint after independently rerunning 45 contract tests, reviewing the reason unions, and building only the contracts library (6.7s). The worker ran `pnpm.cmd exec vitest run src/programs/automation-studio/runtime/llm/tests/evidence-loop-tool-failure.test.ts --maxWorkers=2 --minWorkers=1` from Core packages/fluxiq -> exit 0, 1 file / 53 tests passed in 49.31s. All edited source remains frozen. No worker build/typecheck/audit/full suite, git, provider, browser or panel operation ran.

Pending: lead independent Core owning tests, types and audit acceptance. Phase 2 emission and consumer work remain held until the lead releases them.

## Return contract

Outcome: Done
Changed: Core `packages/contracts/src/actionability/parse-record.ts`; `packages/fluxiq/src/programs/automation-studio/runtime/llm/evidence-loop-decision.ts`; existing `runtime/llm/tests/evidence-loop-tool-failure.test.ts`; this private report.
Validation: Named pure actionability parser command above -> 30 passed; named Core tool-result command above -> 53 passed, after the lead's contracts rebuild checkpoint.
Not verified: Worker did not run types, builds, source audit, full suites, public browser build or Phase 2 propagation. Lead independent acceptance remains pending.
Report: `docs/working/framework-heavy-lifting-plan/reports/codex-1031/p8-actionability/contract-fix.md`
Notes: Final source frozen; private validator/property reader now retain explicit typed reasons for rejected/unreadable controls.
Public optional API is unchanged; no getter execution or loss of actual executed-call facts.
Core parser remains 785 lines; no rule/baseline weakening or new helper paths.
