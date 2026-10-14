# t532 applicable-case declaration foundation

Status: Frozen at user-requested wrap-up; uncommitted isolated foundation; not acceptance-complete
Owner: codex-t517
Pair: `task/t532-applicable-entry-cases` in `fxwork/t532/{!FluxIQWebExtension,!FluxIQ}`
Downstream creation base: `ce0adbfe`

The declaration foundation is implemented in the isolated Core tree. No commit, merge or push. The supervisor must keep this whole task isolated until execution receipts and promotion become coherent with declarations. Nothing here proves an applicable starting case was prepared, executed, judged or accepted.

## Implemented

- Focused `runtime/flow-bootstrap/candidate/acceptance-cases/` contracts, shape parser, owner capture, canonical digest and synchronous request snapshot. Default source-bound generation declares one `observed_current` case. Explicit owner declarations carry stable bounded case IDs, exact source instruction IDs, authored inputs/conditions, observed-current or registered preparation reference, and optional expected symbolic entry. No required:false waiver, caller owner/hash fields, executable action or preparation endpoint is admitted.
- Owner capture binds exact project/Flow, authoritative effective source IDs and original-instructions digest. Caller declarations are cloned/frozen before asynchronous generation. Accessor-shaped declarations are refused without invoking them. Registered preparation references are admitted only against an injected owner list; production generation currently wires no such list, so registered preparation cases remain unavailable there. Stored references remain historical declarations, not current preparation capability grants.
- New strict source-bound draft schema 3 carries `acceptanceCases` and `acceptanceCasesDigest` outside the model candidate. Candidate fingerprint remains the existing original-source-bound v2 fingerprint; complete future identity must compare candidate revision/digest plus this separate case digest. Schema3 verification-source references require its exact case digest. Changed/missing case identity reads unknown. Declared expected symbolic entries must exist in that candidate's plan.
- Existing schemas1/2 remain readable and undeclared. They are not rewritten or credited for a new default/alternative case. Mixed schema/case fields are refused. Draft persistence/reopen preserves declarations with verification still not_performed and no fabricated receipts.
- Optional typed `acceptanceCases` owner-generation API field, strict public/service request parsing and narrow service delegation to the candidate-generation collaborator. This field is never passed as a model submission schema or model candidate policy. Explicit instruction/source guards remain; foreign declaration source IDs are rejected before provider/save in the owning generator test.

Exact additional owners were reported before implementation and approved in the written brief: `service/candidate-drafts/source.ts` and tests; `service/flow-bootstrap-commands/{contracts,generation-request}.ts` and tests; `api/contracts/adaptation.ts`; `api/handlers/llm-generation.ts` and tests; narrow synchronous snapshot/delegation in `runtime/service.ts`. No task-save, UI, trial, executor, promotion or site-reset implementation edits.

Core source/test files:

- `runtime/flow-bootstrap/candidate/index.ts`; new `candidate/acceptance-cases/{contracts,capture,digest,parser,request-snapshot,index}.ts` and `tests/capture.test.ts`.
- `runtime/service/candidate-drafts/{record,source,store}.ts`, `tests/fixtures.ts`, new `tests/acceptance-cases.test.ts`.
- `runtime/service/flow-bootstrap-commands/{candidate-generation,contracts,generation-request}.ts`, `tests/{candidate-generation,generation-request}.test.ts`.
- `runtime/service.ts`; `api/contracts/adaptation.ts`; `api/handlers/llm-generation.ts`; `api/handlers/tests/llm-generation.test.ts`.

Paths above are relative to `packages/fluxiq/src/programs/automation-studio/`. Downstream source is untouched; this report is its only task-authored change.

## Checks actually observed

Paired worktrees were created through owning nextTaskId/createWorktree helpers with offline-only installs. No whole-workspace build wrapper. Narrow Core contracts prerequisite was restored through normal `pnpm.cmd --filter @fluxiq/contracts build`, exit 0, 149 cached files.

First owning test selection: 96/99 passed. Three failures were caused by an omitted schema3 discriminator in authoritative store read (also causing an existing proposal facade to remain a draft), and a parameterized empty-array fixture spread by Vitest. Fixed the discriminator and wrapped parameter rows; no trial/promotion behavior was changed.

Final already-running selection completed after the wrap-up request: **99/99 passed across seven files, exit 0**, 26.54 seconds. Coverage includes default and two authored cases, source binding, malformed/duplicate/forged fields, owner registration restrictions, immutable copies/accessors, task/case digest change, disk reopen, stale/missing case references, legacy schemas, request/API forwarding/refusal and actual candidate-generation collaborator/facade behavior. Provider callbacks in unit fixtures are local stubs; no external model/provider/browser run.

Exact command, from Core `packages/fluxiq`:

`pnpm.cmd exec vitest run src/programs/automation-studio/runtime/flow-bootstrap/candidate/acceptance-cases/tests/capture.test.ts src/programs/automation-studio/runtime/service/candidate-drafts/tests/acceptance-cases.test.ts src/programs/automation-studio/runtime/service/candidate-drafts/tests/source.test.ts src/programs/automation-studio/runtime/service/candidate-drafts/tests/store.test.ts src/programs/automation-studio/runtime/service/flow-bootstrap-commands/tests/candidate-generation.test.ts src/programs/automation-studio/runtime/service/flow-bootstrap-commands/tests/generation-request.test.ts src/programs/automation-studio/api/handlers/tests/llm-generation.test.ts`

**Not run:** Core source/test package typecheck, structure audit, public framework build, diff check, supervisor independent verification. None was already running when the user requested wrap-up, so no new check was launched afterward. Vitest's transform is not a typecheck. Resume commands, once explicitly resumed and source frozen, are `pnpm.cmd --filter fluxiq check`, `node scripts/structure-audit.mjs`, and `git diff --check` from owning Core; parent owns needed public framework build/integration checks.

## Incomplete boundaries and next work

1. Case-specific registered preparation, independently observed starts, actual Router-selected entry, run/judge receipts, durable per-case accumulation and complete-required-case promotion are unimplemented. Existing trial/promotion code still tests/promotes its one current path. Therefore the optional declaration API cannot be delivered as an acceptance feature or merged independently.
2. t529 helper/child-evidence contracts must integrate before execution/receipt wiring. Schema3 source references now require case digest; future candidate-owned graph-source/trial requests must carry the corresponding identity rather than reuse old source references.
3. Declared inputs/predicates are not currently executed/observed by trials. `observed_current` is an unverified declaration, not restoration proof. The existing fixture reset hook/ledger cannot supply clean case evidence merely by returning reset.
4. No production preparation registry is wired yet. Named registered references are structurally supported for owner capture tests; the later preparation owner must resolve/revalidate them, never treat a stored name as an executable grant.
5. Compatibility review still needed before source resumes: the new source-ID parser excludes internal whitespace, while existing CandidateSource.identifier admits trimmed identifiers with internal spaces. Ordinary generated IDs in owning tests work; this narrower legacy-ID boundary has not been reconciled or tested. It was identified during review and left unchanged after the user's freeze instruction.
6. Types/audit and any resulting bounded fixes remain outstanding. No broad API/UI or model guidance work began. Shared architecture updates remain supervisor-owned after the coherent whole unit is verified.

All paired trees/uncommitted source are preserved. No live processes were started, no lane/profile/state reset occurred, and no user panel, override, full suite, commit, merge or push was performed.
