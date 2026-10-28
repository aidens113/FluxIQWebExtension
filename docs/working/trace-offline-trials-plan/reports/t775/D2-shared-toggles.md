# D2 shared toggles

Outcome: Done.

Changed (Core, R = packages/fluxiq/src/programs/automation-studio/runtime):
- R/flow-bootstrap/action-permissions.ts: optional `exploredToggles` input; default is its own record.
- R/flow-bootstrap/index.ts: barrel exports explored-toggles.ts (structure audit required import via barrel). Not in the owned list, one line; needed.
- R/service/project-build/brief-ports.ts: one `AutomationStudioExploredToggles` per brief-port factory (= one per project build, made once in run.ts), passed to every brief's gate; every builder submission reads it through the gate's `exploredToggles`. Candidate (non-project) build in service.ts unchanged, keeps its own.
- Tests: flow-bootstrap/tests/explored-toggles.test.ts (+1: injected record shared across gates, own record otherwise); service/project-build/tests/project-build-shared-toggles.test.ts (new: brief 2's submission reads brief 1's press; two builds do not share).

Commands:
- vitest-groups parallel on flow-bootstrap/tests + project-build/tests: 33 files, 278 tests passed; after the barrel change the new file re-ran: passed.
- pnpm check (packages/fluxiq): tsc printed no errors (cache "not stamped" only because other workers edited the package meanwhile).
- pnpm structure:check: "passed (448 warning(s), 1152 baselined)". (First run failed on the barrel import; fixed.)

Not verified: fail-first was not run against the old code (no git stash allowed); the shared test would fail pre-change since each brief had its own record. The end-to-end submission refusal (ensureState / not-idempotent) on brief 2 was not exercised; the test asserts the submission's `exploredToggles` record, which submission.ts already consumes unchanged.
