# P2 durable candidate receipt ledger

Status: Independently verified after current-dev integration; production promotion unavailable. Worker: p0_acceptance. Date: 2026-10-07. Task: t304-durable-candidate-receipts. Paired trees: fxwork/t304/!FluxIQ and !FluxIQWebExtension. Main brief plus supervisor-approved controller/contracts/predicates correction define scope.

## Changes

- Added project-SQL `storage/project/candidate-verification/{contracts,migration,store,index}.ts` and owning tests. Immutable request records bind candidate ID/revision/digest/base, settings revision, original instruction text and source ID/revision/text digests, requirement digest, start conditions and permission/compiler/registry/normalizer/issuer versions. Local migration `0025_candidate_verification_receipts_v1` uses existing project migration runner/admin migrations, without changing shared administration or resetting user data.
- Actual BEGIN IMMEDIATE transactions claim overall attempts and each side-effect stage. Pending claim commits before start/reset or execute. Same claim/digest deduplicates; different request conflicts. Committed receipt writes retain run/start/identity references and exact final receipt-to-stage joins. Reads verify stored digests and joins, rejecting corruption instead of assuming absence or success. Payloads and IDs are bounded; no raw payload logging.
- Added internal `runtime/flow-bootstrap/verification/durable-session.ts`. It wraps trusted interpreter/start/executor/observer ports around the existing controller; no API or builder receipt-issuance input exists. Fresh entire durable binding is checked before each stage and through controller freshness checks. A duplicate/restarted pending or unknown attempt returns `candidate.verification_outcome_unknown` and never reruns start or commands. Lost stage/finish acknowledgements reconcile only persisted committed result, otherwise remain unknown.
- Extended controller promote result with `unsupported_storage_authority`, mapped explicitly to draft `candidate.promotion_unsupported_storage_authority`. Durable session writes the controller-issued receipt and returns this refusal. It contains no accepting promotion port, no accepted graph mutation, no successful-promote boolean. Null/unavailable project ledger refuses before start/execute. JSON accepted topology is unsupported for promotion.
- Added `candidate-drafts/store.ts` authoritative disk read bypassing memory cache; memory-only drafts are not durable authority. Existing ordinary get/cache behavior remains. Owning real JSON/layout-v2 SQLite tests show externally replaced draft visible via uncached read.
- Supervisor inspection identified quantified create with supplied minimumSubjects:0 and complete empty enumeration could satisfy vacuously. Corrected predicates coverage floor to `Math.max(create ? 1 : 0, declaredMinimum ?? 0)`. Owning controller negative covers create min0/omitted minimum despite succeeded/nonzero execution, while ensure with declared minimum0 retains valid empty complete scope. Create still needs new subject baseline/performed command attribution.

## Authority and durability limits

Committed ledger stages mean their packets were durably written, not that their semantics passed. Only the normal controller returns requirement verdicts; every outward result remains a draft. Malformed trusted-port packets can be retained as stage evidence before controller refusal; they cannot prepare or authorize mutation. No production semantic interpreter, start reset adapter, independent browser outcome oracle or domain command acknowledgement was created. The detached executor still truthfully lacks performed command receipts needed for create.

The ledger is a real project SQLite owner, independent of accepted document storage layout. JSON/no-ledger preparation is explicitly unsupported; a project SQLite ledger does not make JSON or split accepted topology atomic. Base/settings/source/permission joins are trusted fresh-adapter inputs; this unit does not implement normal production authorization or accepted-state CAS. No service/API wiring is claimed. The production caller must construct those inputs from owners, with uncached latest draft and real instruction revisions/permission binding.

Source text digests are SHA-256 of the actual instruction string. Whole request/record digests use canonical JSON; requirement digest retains the existing requirement-contract algorithm. Paid creation accounting remains on the existing draft/purse owners; this provider-free unit adds no provider charge accounting or reconciliation adapter and does not infer zero outstanding charges from ledger stage status.

Attempt IDs are supplied by the trusted orchestrator and bind the complete payload; no automatic attempt expiry or retry exists. Creating another attempt ID is a deliberate new attempt, not restart recovery. Unknown commands/start effects are never automatically repeated by this session implementation. Store unavailability keeps unknown, even if writing the unknown marker fails; the original pending claim continues to block replay.

Tests use scripted trusted ports with counters against real SQLite, including a second pool/connection and new session instance in the same OS process. Their counters verify one start/execute invocation across duplicates and reopened-owner fixtures; they do not perform browser commands, kill/relaunch the OS process, or prove production reset/executor behavior. Injected throws before/after execution-stage writes and after finish COMMIT model lost acknowledgements; stored stage/result states are inspected. Fresh connection alone is not proof of side-effect safety across a real process crash. No power-loss/fsync guarantee, literal process-kill or production restart validation is claimed.

Accepted topology transaction, authoritative reader/writer/source/publication migration and projection recovery remain the separate prerequisite in p2-promotion-design.md. Full P2 remains pending.

## Validation ledger

- First ledger run failed closed before row writes: local migration ID lacked required numbered prefix. Fixed to 0025 namespace. Six real SQLite store tests subsequently passed (12.93s), including simultaneous claim/conflict, pending reopen, stage-write rollback, wrong identity/start reference, corrupt persisted record and an existing fully migrated project preserving migration checksums/user_version42/Flow row.
- First controller/durable-session/draft-store run passed 46/46 across three files (12.24s). Includes controller33, session10, draft-store3 (both JSON/layout-v2 SQLite fixtures).
- First two typechecks found test fixture SQL visibility/scope literals outside the domain/global enums; corrected both. Final frozen-source `pnpm.cmd --filter fluxiq check` exited0 (command executed, 11.283s).
- Combined four owning files passed52/52 (16.87s). After final ledger source text digest/fixture corrections, ledger+session rerun passed16/16 (21.57s); after source-span/intent-only corrections to quantified examples, controller rerun passed33/33 (16.43s). Draft-store3 remained unchanged after its observed pass. These are52 unique owning tests, not cumulative independent checks.
- First structure audit found two owned issues (test barrel import and deliberate uncertainty catches lacking required rationale), both corrected. Shared Core ledger/index issues were reported to and fixed by supervisor; worker did not edit shared docs. Final direct Core `pnpm.cmd structure:check` exited0:279 warnings/349 baselined. Filtered PowerShell pipelines printed passed but returned1; direct commands are the recorded native-exit evidence.
- Downstream final direct `pnpm.cmd structure:check` exited0:176 warnings/118 baselined. No provider/live/full suite, accepted topology/service/API changes, git mutation or panel management. No dependent web source changed; no web typecheck claimed.

## Literal process termination/relaunch continuation (2026-10-07)

Supervisor assigned the bounded `p2-receipt-process-restart-probe` after independently observing52/52 and rebuilding/checking the latest merged t304 Core. Only new `runtime/flow-bootstrap/verification/tests/process-restart.test.ts` and this appended report section changed. No product source edits, rebuild, browser/provider calls, panel commands, shared document or git mutation.

The fixture writes an owned temporary child script importing the actual built internal session, project-SQL ledger and database pool. It forks Node with hidden-window spawn options and bounded IPC. Child stdout is ignored; stderr is consumed as a bounded byte count without content logging. IPC packets contain only phase/status/code and generated receipt/run IDs, limited to1024 bytes. Startup is bounded20s, shutdown5s and each test60s. Cleanup kills only its retained ChildProcess handles, waits for exit, validates the resolved temp directory against os.tmpdir/prefix, then removes that fixture directory.

- Execution gap: first child commits pending overall/start/execution claims, appends one synthetic start line and one synthetic effect line, reports its checkpoint and parks inside execute before returning an execution receipt. Parent forces termination and observes `{code:null,signal:"SIGKILL"}`. A separate newly launched Node child constructs the same immutable request and session against the existing SQLite database. It returns draft `candidate.verification_outcome_unknown`; persisted overall/execution status remains pending and no verification receipt exists. Both marker files still contain exactly one line, proving this fixture did not invoke start/effect again.
- Finish acknowledgement gap: first child performs the synthetic callbacks and real receipt writes, then a test-only wrapper awaits actual `store.finish` SQLite COMMIT, reads its original receipt/run IDs and parks before acknowledging finish to the session caller. Parent observes the same forced SIGKILL termination. Relaunched child reads/replays the original committed draft `candidate.promotion_unsupported_storage_authority`, with committed execution/verification stages and identical receipt/run IDs. Start/effect marker files again remain one line each.

These are literal separate Node process termination/relaunch checks, superseding the earlier same-process-only fixture limitation for these two synthetic boundaries. They do not execute browser/domain commands or production reset adapters, test machine/power loss, grant mutation authority or prove accepted-topology promotion. The effect is an owned marker append; command receipts stay truthfully empty, and every result remains a draft.

Validation observed on final frozen test file:

- `pnpm.cmd --filter fluxiq exec vitest run src/programs/automation-studio/runtime/flow-bootstrap/verification/tests/process-restart.test.ts`:2/2 passed,6.18s (synthetic cases2.701s/2.817s). Earlier runs also passed; these are two unique new tests.
- `pnpm.cmd --filter fluxiq check`:exit0, command executed8.565s. First run found Node's ForkOptions type omits windowsHide; corrected precise ForkOptions/SpawnOptions intersection without changing runtime options.
- Core `pnpm.cmd structure:check`:exit0,279 warnings/349 baselined. Production source remains frozen; supervisor repeats before integration.

### Explicit built-artifact probe admission

Supervisor review required this dist-dependent child-process test to be opt-in. Final test now runs only when `FLUXIQ_CANDIDATE_PROCESS_RESTART_PROBE=1`; ordinary source-only Vitest collection skips both cases and does not load stale/missing dist. The gate does not establish source freshness by itself: run the owning Core build first in the same paired tree, then the exact probe. Worker reused the supervisor's already observed fresh t304 build and did not perform an extra build.

From `C:/Users/osrs_/FluxStuff/fxwork/t304/!FluxIQ`, reproducible owning sequence in PowerShell:

```powershell
pnpm.cmd --filter fluxiq build
$env:FLUXIQ_CANDIDATE_PROCESS_RESTART_PROBE = '1'
pnpm.cmd --filter fluxiq exec vitest run src/programs/automation-studio/runtime/flow-bootstrap/verification/tests/process-restart.test.ts
```

After this gate change, observed owning command exited0 with2/2 passed, zero skips,7.45s (3.290s/3.220s cases). Explicitly clearing the flag and running only this file exited0 with both tests skipped (754ms), proving default collection does not execute children. Final `pnpm.cmd --filter fluxiq check` executed and exited0 (9.971s). Test/report frozen; root rebuilds/repeats the opt-in probe before integration. Earlier ungated commands above describe intermediate validation, not the final invocation contract.

## Supervisor verification after integration

- Reviewed durable request/stage joins, actual project transaction owner, locally scoped migration, current draft read and controller refusal. Merged latest dev before gates; preserving all existing source/settings authority limitations.
- Validation: independent four owning suites52/52 (16.5s) after merge; Corecheck0 (37.6s) and owning build0 (45.5s), generating fresh t304 executing artifacts; dependent webcheck0 (48.1s). Later test-only opt-in gate change observed via exact-current cached typecheck; product source remained unchanged.
- Validation: root ran opt-in actual child kill/relaunch file2/2, zero skips (6.66s), against the freshly built t304 artifacts. Inspected actual pending execution/committed finish reconciliation and one synthetic start/effect across separate processes. No action replay occurred in either fixture; original committed receipt/run IDs retained. This adds two distinct tests to52, not a second54-test monolithic run.
- Both task structure audits checked; downstream integration gate repeats audit. No full suite, provider/browser command, user panel, accepted-topology mutation or production promoter.
- Full ordinary-writer/dependency inventory is reports/p2-authority-migration-inventory.md. Atomic graph-import primitive is a next bounded prerequisite; complete authority migration and trusted production adapters still remain.
