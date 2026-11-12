# t909 action-scope continuation

Date: 2026-11-11
Role: heavy worker, gpt-6.1-sol, max
Phase: SOURCE FROZEN for lead independent acceptance and three-way integration. Current affected behavior, package typecheck and unchanged full structure audit passed. Existing atomic storage acceptance remains unchanged.

## Resumed final acceptance (2026-11-12)

- The lead reports the last coherent dynamic-source/scope acceptance passed 18 files and 71 tests in 224.47 s before the final missing-target correction. Its output was not retained in this worker context, so this remains an attributed result, not a newly observed endpoint.
- The prior `t909-final-target-admission` coordinator process is gone, with no live t909 Node process and an empty coordinator queue. Neither the lead nor this worker has the final tool-session output; no final admission/typecheck/audit success is inferred. The recovery launches only the affected target/task/pin/pipeline tests and package/structure gates.
- Source inspection confirms missing reachable named targets now return a configuration problem before run admission; registered cycles are bounded by visited target identity and explicit hashes retain precedence. Root/task/target binding and mid-run admitted-version behavior remain unchanged. Added the approved architecture description of these boundaries before final validation.
- First recovered admission run (`t909-final-target-admission-resumed`) exited 1 in 67.70 s: execution-task passed 4/4, while target/pin/pipeline suites failed during transform because the final `execution-targets.ts` returned object lacked its outer closing brace. No target/pin/pipeline behavior ran. Corrected that single syntax delimiter; no behavior or expectation was weakened. The same four-file command is rerun before final gates.
- The first repair matched the earlier similar closure; immediate readback caught that mistake, and the already-running replacement (`t909-final-target-admission-fixed`) was allowed to finish without concurrent source edits. It exited 1 in 52.20 s with 4 execution-task tests passed and the same three suites failing transform, now at the extra brace on the first closure. Corrected both sites with distinct surrounding context, inspected the full module, and required a parser-only transform before another behavioral run. This was a worker patch error, not a new product failure.
- Parser-only `esbuild.transformSync` with the TypeScript loader on the final `execution-targets.ts` -> exit 0, `execution-targets parser transform passed` (0.79 s). Final targeted behavior command (`t909-final-target-admission-parsed`, exact target-admission command below) -> exit 0, 4 files and 17 tests passed in 82.68 s. This observes pin-change reuse, changed root and child refusal after full restart, original admitted child versions during registration changes, fresh-parent versions, missing targets refused before run registration, cycle traversal, explicit hash precedence, binding corruption and rootless binding ownership.
- `node C:/Users/osrs_/FluxStuff/fxwork/.tools/heavy-slot.mjs run t909-final-resumed-types -- pnpm.cmd --filter fluxiq check` -> exit 0; compiler step 29.379 s, current source built (no cached success reused). The structure audit is queued through the same coordinator; no source freeze is claimed until that endpoint passes.
- The first current-source structure audit (`t909-final-resumed-structure`) exited 1 with 26 violations across two rules: 21 import-cycle findings and five barrel-import findings. Source loading had two actual eager cycles: source adapter → task memory → note screening/result verification → service → act-scope, and secret binding → pipeline barrel → pipeline runner → act-scope. After that reader ended, six owned files received import-only corrections: load task memory through the existing async boundary, take the predicate from its owning module, and route erased type imports through their barrel. Storage transactions/reader semantics, target binding behavior, create/run host seams, baseline and audit rules are unchanged. Affected source/corruption/target tests and current package/audit gates are rerun.
- The lazy owner access follows `act-scope/scoped-memory.ts:8`: task memory loads inside an async operation after service initialization, and its import/read failures remain observable. The predicate's owning-module import is the cycle remedy explicitly permitted by `scripts/structure-audit/rules/imports.mjs:160-165`: the pipeline barrel reaches this importer through runner → act-scope. Six corrected modules passed parser-only transforms before the next audit; no cast, suppression or audit change was added.
- `node C:/Users/osrs_/FluxStuff/fxwork/.tools/heavy-slot.mjs run t909-final-import-structure -- pnpm.cmd structure:check` -> exit 0, `structure-audit: passed (544 warning(s), 916 baselined)`. The one existing lowerable baseline entry is unchanged; no baseline edits were made. Final affected behavior now runs nine files combining the exact dynamic-source, corruption and target-admission groups below; the current package check follows it before source freeze.
- Final import-corrected affected behavior (`t909-final-import-behavior`, complete command below) -> exit 0, 9 files and 31 tests passed in 141.38 s. This includes both corrupt task-memory and corrupt binding refusal with owner cleanup. The dynamic-source fixture kept its original enumeration through full restart; fresh parent attempts then used the changed four-row source and ran the same saved Flow at zero model calls. Their continuation proof was `path: replayed`, Flow `flow.5fe92134-f30f-474e-b766-3ea1755dfd8d`, times 2298 / 2225 / 2237 ms. This is isolated fixture data, not a user Flow.
- `node C:/Users/osrs_/FluxStuff/fxwork/.tools/heavy-slot.mjs run t909-final-import-types -- pnpm.cmd --filter fluxiq check` -> exit 0, compiler step 71.728 s, current changed inputs compiled. `git diff --check` -> exit 0, no whitespace errors. The 77-path content fingerprint remained identical before/after final acceptance: `b1dac6d7bebfdce9edfbd79083042f78d42420d857c7a8cd715df6c7bea2eb5e`. No Core source edits followed the successful audit, nine-file behavior run or package check.
- Source is now frozen. This recovery changed only six already-owned import/syntax files and `docs/architecture/runtime-ownership.md` in Core, plus this worker report downstream. It did not change the atomic storage implementation, `create-fluxnode-service.ts`, `run-attempt.ts`, or another lane. Their exact post-handoff patches and the complete 77-path uncommitted manifest remain below. The lead alone performs independent acceptance, merges the shared seams with host/result wiring, and handles all git/version/shared-document operations.

Implementation log (2026-11-11):

- Lead synced both t909 repositories to dev and authorized implementation, then approved generic write-through paths `answer-first/task-memory/{memory.ts,store.ts,tests/store.test.ts}` and `answer-first/attempt/{run-attempt.ts,remember.ts,tests/remember-acts.test.ts}`. t905 is holding `run-attempt.ts` until this lane sends its small integration seam.
- Added the two inferred regressions before changing production behavior. The test fixture now has a true close/reopen of Core on its isolated persisted directory; the simulated library retains its external state.
- First reproduction command used `-t 'restart|resumes'`; the coordinator joins command arguments into a Bash command and lost the regex quotes. Bash interpreted a pipeline, reported `resumes: command not found`, and Vitest ended with `EPIPE`. This was a launch failure, not evidence of product behavior. Re-launched the one exact test file without a regex/shell metacharacters under the coordinator.
- Initial corrected file run: `pnpm.cmd --filter fluxiq exec vitest run src/framework/automation-service/service/fluxnode/tests/act-scope.test.ts --maxWorkers=1 --minWorkers=1` -> 3 passed, 2 failed, 146.36 s. Key A, B, full Core close/reopen, retry A landed 3 renewals rather than 2. The unanswered developer-check setup stopped at the fixture's 90 s guard before reaching resume; that was setup failure, not proof of the second gap.
- Replaced only that test setup with a genuine one-call budget-out. `...act-scope.test.ts --maxWorkers=1 --minWorkers=1 -t resumes` -> 1 failed, 4 skipped, 53.46 s (1.76 s tests): one landed act, unrelated run B, then explore resume landed a third act instead of retaining the count of 2. Both inferred gaps are now reproduced before production changes.
- Implemented durable `actsByScope` in the existing task memory, serialized with each scoped act write and achieved marker; own-property scope reads outlive trimmed provenance. Removed the process-local FluxNode snapshot cache. Explore identity now derives from stable execution scope; carried runs keep their initial task key. Unscoped chat retains its prior copy behavior. The shared `run-attempt.ts` persist-only seam was sent to the lead and frozen for t905 coordination.
- First fixed-regression launch preflight declined to start at 1.62 GiB free; no process launched. After other heavy work ended, the lead explicitly authorized a single serialized scoped run below the lead's 2 GiB scheduling preference. That provider-free corrected regression file is running through the coordinator.
- Original fixed file -> 5/5 passed, 62.03 s (7.10 s tests); lead independently reran -> 5/5 passed, 60.80 s. This established both original fixes before pipeline expansion.
- Broader scope/storage/permission/act-record command -> 324 tests passed across 25 files; the new opening suite failed collection from a wrong relative import, then a missing required `words` fixture. Both test setup defects were corrected; its acceptance rerun remains pending.
- New pipeline regression -> 1 failed / 5 skipped, 58.46 s (4.05 s tests): two equal-input children completed before another child exhausted its budget; continuation landed 8 renewals rather than the intended 5. The child-call seam now carries an optional logical invocation descriptor; source snapshots are a separate required dependency and are not yet accepted.
- New idempotency regression initially failed request parsing (fixture omitted `start`); after correcting the fixture, all 3 cases reproduced: changed non-secret request accepted after restart; concurrent same-key starts admitted two run IDs; raw key+secret-request digest present in task JSON. After opaque scope allocation, those 3 integration tests passed (1.198 / 1.033 / 1.308 s). Subsequent execution-ownership wiring still needs integration rerun.
- Lead review found value-equality secret projection unsound. Two pure regressions reproduced equal secrets rotating independently and a non-secret field equal to a secret being excluded. Request projection now replaces only declared JSON pointer positions; both tests pass. Secret schema allows top-level named strings and rejects secret default/examples/const/enum (existing `type-schema/parse.ts`, `checkSecret`).
- Added a separate execution-owner guard around durable key reads/writes and run completion. Its 4 focused tests passed, including three real Node processes contending (exactly one admitted), verified local dead-owner recovery, foreign/unknown/reused-PID failure closed, token-checked release, and a crashed recovery guard. A settled queue removes only itself when still current; no queue cap. Machine identity comes from the OS machine identifier; an unavailable or foreign identity cannot recover ownership. No clock/lease expiry proves death.
- Lead transferred t905's immutable snapshot API/schema 0037 dependency (13 files), independently validating it before releasing this worker's tree-wide checks. These are lead-transferred dependency edits, not this worker's authored changes. No schema 0036 evidence changes were transferred.
- Durable key allocation now stores an opaque execution scope and compares a secret-free request projection by declared JSON pointer position. Key ownership remains in the trusted caller/project namespace. Execution ownership applies to every launch and resume, independently of key-allocation guards; concurrent local resumes join one held run, while another live registry is refused before admission. Constructor/registration and unexpected completion-builder exceptions release ownership.
- Reproduced the resume ownership hole before fixing it: a resumed keyed execution and a retry through another facade were both admitted, and concurrent resumes returned two run IDs. Both now pass with one execution. An owner guard contains only opaque/process metadata; verified-dead local recovery, foreign/unknown/PID-reused failure closed, token comparison, and a crashed recovery guard have focused process tests.
- The four-run provider observation exposed a real post-act durability defect: the model's next decision saw `may_have_landed` after the act had succeeded. Runtime and replay async doors now await the owning record flush, including landed, uncertain, and withdrawn paths. Aggregate errors preserve both dispatch and persistence causes. A later whole-record replacement clears a prior write failure only after it commits in write order.
- Coherent acceptance command covering FluxNode keys/scopes, runtime record and gate directories, replay gates, and opening scopes reached 439 tests: 433 passed and six existing double-act cases failed before runtime writes because admin 0037 was composed before older private migrations. Lead transferred t905's ordered-composition fix, then independently reran helper3 + double-act6: 9/9 passed in 81.81 s. Lead committed snapshot dependency as `9167d7141` and migration ordering as `35e75a9f1`; broader worker edits remain uncommitted for lead integration.
- Lead renamed snapshot production owners to `project/dataset-occurrences` and `project/dataset-occurrence-schema`, and synced the paired audit-context correction from dev. Snapshot API/SQL remain unchanged.
- Package typecheck after sync passed in 21.342 s. Final structure audit found nine violations (browser Node import, empty machine-identity fallback, packed statements); corrected without exemptions or baseline growth. Affected checks are queued before host-slice freeze.
- Lead independent coherent behavior endpoint: 7 files, 83 tests passed, 94.39 s (FluxNode act-scope6 and idempotency7; record51; begun9; runtime settlement3; replay settlement7). Snapshot enumeration remains separate work and is not inferred accepted from these checks.

## Coherent create/run dependency manifest for the host lane

Status: FROZEN FOR LEAD TRANSFER. Direct behavior independently passed; affected audit-fix tests and package/structure gates passed. Do not port only create/run without these dependencies. Paths below are relative to `packages/fluxiq/src/` in paired Core. The old WIP-only `fluxnode/act-scope/act-records.ts` is deleted (absent on dev). Durable pipeline source-snapshot adapter/wiring is excluded from this host slice until separately accepted.

```text
framework/automation-service/service/flow-bootstrap-commands/contracts.ts
framework/automation-service/service/answer-first/caller/applied.ts
framework/automation-service/service/answer-first/caller/kept.ts
framework/automation-service/service/answer-first/caller/options.ts
framework/automation-service/service/answer-first/task-memory/memory.ts
framework/automation-service/service/answer-first/task-memory/store.ts
framework/automation-service/service/answer-first/attempt/opening.ts
framework/automation-service/service/answer-first/attempt/run-attempt.ts
framework/automation-service/service/answer-first/attempt/remember.ts
framework/automation-service/service/answer-first/run-acts/run-gate.ts
framework/automation-service/service/fluxnode/act-scope/index.ts
framework/automation-service/service/fluxnode/act-scope/act-scope.ts
framework/automation-service/service/fluxnode/act-scope/child-scope.ts
framework/automation-service/service/fluxnode/act-scope/execution-owner.ts
framework/automation-service/service/fluxnode/act-scope/idempotency-keys.ts
framework/automation-service/service/fluxnode/act-scope/request-identity.ts
framework/automation-service/service/fluxnode/act-scope/secret-bindings.ts
framework/automation-service/service/fluxnode/caller-options.ts
framework/automation-service/service/fluxnode/create-fluxnode-service.ts
framework/automation-service/service/fluxnode/fluxnode-run.ts
framework/automation-service/service/fluxnode/run-fluxnode.ts
framework/automation-service/service/fluxnode/pipeline/fluxnode-flow-caller.ts
framework/automation-service/service/fluxnode/pipeline/fluxnode-pipeline-context.ts
framework/automation-service/service/pipelines/types.ts
framework/automation-service/service/pipelines/map/index.ts
framework/automation-service/service/pipelines/map/invocations.ts
framework/automation-service/service/pipelines/map/map-step.ts
framework/automation-service/service/pipelines/run/load-source.ts
runtime/answer-first/act-record/seed.ts
runtime/answer-first/act-record/record.ts
runtime/answer-first/act-record/gate/act-gate.ts
```

Focused validation subjects are `fluxnode/tests/{act-scope,idempotency}.test.ts`, `fluxnode/tests/library-lane.ts`, `fluxnode/act-scope/tests/*`, `pipelines/map/tests/map-step.test.ts`, `pipelines/run/tests/run-pipeline.test.ts`, `answer-first/attempt/tests/{act-scope,remember-acts}.test.ts`, `answer-first/caller/tests/*`, `answer-first/task-memory/tests/store.test.ts`, `answer-first/run-acts/tests/settled-before-return.test.ts`, `runtime/answer-first/act-record/tests/record.test.ts`, and `runtime/answer-first/act-record/gate/tests/settled-before-return.test.ts`. The original WIP remains part of this manifest even where `git diff HEAD` reports no new edit.

Exact changed/new test and fixture files for copying the host slice (same `packages/fluxiq/src/` root):

```text
framework/automation-service/service/answer-first/attempt/tests/act-scope.test.ts
framework/automation-service/service/answer-first/attempt/tests/remember-acts.test.ts
framework/automation-service/service/answer-first/caller/tests/applied.test.ts
framework/automation-service/service/answer-first/caller/tests/options.test.ts
framework/automation-service/service/answer-first/run-acts/tests/settled-before-return.test.ts
framework/automation-service/service/answer-first/task-memory/tests/store.test.ts
framework/automation-service/service/fluxnode/act-scope/tests/act-scope.test.ts
framework/automation-service/service/fluxnode/act-scope/tests/execution-owner.test.ts
framework/automation-service/service/fluxnode/act-scope/tests/request-identity.test.ts
framework/automation-service/service/fluxnode/tests/act-scope.test.ts
framework/automation-service/service/fluxnode/tests/idempotency.test.ts
framework/automation-service/service/fluxnode/tests/library-lane.ts
framework/automation-service/service/pipelines/map/tests/invocations.test.ts
framework/automation-service/service/pipelines/map/tests/map-step.test.ts
runtime/answer-first/act-record/tests/record.test.ts
runtime/answer-first/act-record/gate/tests/settled-before-return.test.ts
```

Deleted source: `framework/automation-service/service/fluxnode/act-scope/act-records.ts`. Authored doc: `docs/architecture/runtime-ownership.md`. The host slice needs t905's separately validated immutable dataset API (0037, renamed production owners) for its pre-start private-dataset binding check, and the validated migration-order composition helper. It does not include the still-unimported `pipeline-source.ts` or `pipeline-source-secrets.ts`; it has no snapshot-reference DTO yet. Later adapter changes remain in task-memory and the pipeline runner, without changing create/run host files.

Freeze validation (2026-11-12, local session continued from 11 November):

- `node C:/Users/osrs_/FluxStuff/fxwork/.tools/heavy-slot.mjs run t909-audit-fix-tests -- pnpm.cmd --filter fluxiq exec vitest run src/framework/automation-service/service/fluxnode/act-scope/tests/execution-owner.test.ts src/framework/automation-service/service/fluxnode/act-scope/tests/request-identity.test.ts src/framework/automation-service/service/pipelines/map/tests/map-step.test.ts src/framework/automation-service/service/answer-first/run-acts/tests/settled-before-return.test.ts src/runtime/answer-first/act-record/gate/tests/settled-before-return.test.ts --maxWorkers=1 --minWorkers=1` -> 5 files, 26 tests passed, 28.32 s.
- `node C:/Users/osrs_/FluxStuff/fxwork/.tools/heavy-slot.mjs run t909-invocation-ref-tests -- pnpm.cmd --filter fluxiq exec vitest run src/framework/automation-service/service/pipelines/map/tests/invocations.test.ts --maxWorkers=1 --minWorkers=1` -> 1 file, 2 tests passed, 1.94 s. Added the schema-required runId to its fixture afterward; final no-emit covers that fixture.
- `node C:/Users/osrs_/FluxStuff/fxwork/.tools/heavy-slot.mjs run t909-host-slice-audit -- pnpm.cmd structure:check` -> passed, 543 advisory warnings, 916 baselined; one existing baseline entry can be lowered. No baseline changes made.
- `node C:/Users/osrs_/FluxStuff/fxwork/.tools/heavy-slot.mjs run t909-host-slice-final-types -- pnpm.cmd --filter fluxiq check` -> exit 0, compiler step 21.404 s.

Runtime `*.json.owner` and `*.json.owner.recover` files live only under the ignored project data directory. They contain process ownership metadata, never request values or credentials. They are not repository artifacts. A foreign/unverifiable owner or crashed recoverer is an explicit configuration refusal before a run starts; it never introduces a new admitted task ending.

## Pipeline snapshot continuation (after host transfer)

The lead copied the frozen host slice into t905 and t907, then released this lane's task-memory DTO and separate pipeline runner. `create-fluxnode-service.ts` and `run-fluxnode.ts` remain fixed.

Additional source ownership (Core `packages/fluxiq/src/` root):

```text
framework/automation-service/service/answer-first/task-memory/memory.ts (reference DTO only)
framework/automation-service/service/fluxnode/act-scope/index.ts (adapter exports)
framework/automation-service/service/fluxnode/act-scope/pipeline-source.ts
framework/automation-service/service/fluxnode/act-scope/pipeline-source-reference.ts
framework/automation-service/service/fluxnode/act-scope/pipeline-source-of.ts
framework/automation-service/service/fluxnode/act-scope/pipeline-source-secrets.ts
framework/automation-service/service/fluxnode/pipeline/run-fluxnode-pipeline.ts
framework/automation-service/service/fluxnode/act-scope/tests/pipeline-source.test.ts
framework/automation-service/service/fluxnode/pipeline/tests/source-continuation.test.ts
framework/automation-service/service/fluxnode/pipeline/tests/source-secrets.test.ts
```

- Task memory stores only scope-to-`{snapshotId,count}` metadata. Immutable rows and lineage live in the existing dataset owner's 0037 tables. Source row occurrences receive opaque UUIDs before any mapped act; the reference update must commit before those records return.
- Input sources store immutable caller-input pointers, rebinding supplied secret values on continuation. Existing private dataset sources store their snapshot/cell references. Arbitrary ephemeral sources with declared secret field mappings are refused at start; a raw secret reaching the adapter is rejected before snapshot storage or mapped records return. No secret hashes or new cryptography are used. Each fresh parent scope fetches a new source; a continued scope reads its original immutable enumeration.
- Initial dynamic-source fixture stopped before the target path because the real Flow's record collector returned two rows from three identical-value rows. Corrected it to three distinct source rows deliberately mapped to identical action inputs; independent snapshot cases retain truly equal-valued row occurrences.
- First corrected pre-fix regression reached full restart and observed a second source read (expected 1, observed 2), while existing child scopes kept the total at 4 acts. Adding one source row alongside reorder and a changed non-identity field reproduced the actual extra-act path: same-key retry after Core close/reopen produced 5 renewals instead of 4. `...pipeline/tests/source-continuation.test.ts --maxWorkers=1 --minWorkers=1` -> 1 failed, 58.48 s (4.99 s test), before adapter wiring.
- First adapter typecheck -> exit 0, 86.961 s compiler step. First fixed behavior command -> storage cases 7/7 passed; dynamic regression retained 4 renewals, one source read and zero model calls, then failed whole-output equality solely on the truthful resumed child summary `Already done earlier`. Changed that new assertion to compare original source columns exactly, retaining all count/read/call assertions.
- Final adapter behavior command `pnpm.cmd --filter fluxiq exec vitest run src/framework/automation-service/service/fluxnode/act-scope/tests/pipeline-source.test.ts src/framework/automation-service/service/fluxnode/pipeline/tests/source-continuation.test.ts src/framework/automation-service/service/fluxnode/pipeline/tests/source-secrets.test.ts src/framework/automation-service/service/fluxnode/tests/act-scope.test.ts --maxWorkers=1 --minWorkers=1` (coordinator `t909-source-final-behavior`) -> 4 files, 16 tests passed, 108.99 s. The keyed retry held the original 3 source rows, 4 total renewals, one source read and zero model calls. Three fresh parent runs each fetched the changed 4-row source and replayed the same saved Flow at zero calls (1640 / 1631 / 1870 ms), bringing total renewals to 8 / 12 / 16. The unchanged partial-child/budget-out continuation also passed.

## Strict scoped state correction

- Inspection found the existing task-memory reader treats a corrupt whole owner file as absent. This affects both pipeline references and direct scoped act history. Added actual A/key, intervening B, owner task JSON corrupted, full Core close/reopen, retry A before changing that behavior: `...fluxnode/tests/corrupt-scoped-memory.test.ts --maxWorkers=1 --minWorkers=1` -> 1 failed, 69.66 s (2.77 s test), 3 renewals instead of 2.
- The lead approved strict modes in owned `task-memory/store.ts` and scoped opening/persist/remember/reference calls; `act-scope/scoped-memory.ts` and adjacent tests; and reopening only the owner-held launch preflight plus the shared persist call. `get`/`update` accept additive `{scoped:true}`. Missing is distinct from unreadable through the existing `ProgramJsonStore.readExistingReadOnly` port; no repair/reset occurs on a strict failure. Both scoped maps and their records must validate before sanitization or replacement. Legacy unscoped reads/writes retain their existing recovery.
- Every launch checks the carried, normal, pinned and scoped-explore task identities while holding its owner, before constructing/registering a run. A storage problem carries its original cause. Cleanup precedes the existing `invalid_request` configuration refusal; cleanup failure retains both causes. Scoped completion writes now propagate failure rather than treating it as a best-effort metadata save.
- First strict-state package check -> exit 0, 64.402 s compiler step. `pnpm.cmd --filter fluxiq exec vitest run src/framework/automation-service/service/fluxnode/tests/corrupt-scoped-memory.test.ts src/framework/automation-service/service/fluxnode/act-scope/tests/scoped-memory.test.ts src/framework/automation-service/service/answer-first/task-memory/tests/store.test.ts src/framework/automation-service/service/answer-first/attempt/tests/act-scope.test.ts src/framework/automation-service/service/answer-first/attempt/tests/remember-acts.test.ts --maxWorkers=1 --minWorkers=1` (coordinator `t909-corrupt-scope-acceptance`) -> 5 files, 35 tests passed, 80.26 s. Actual refusal retained 2 renewals, no admitted run, released owner and left corrupt state untouched. Two later changes only make test fixture types explicit (`delete` optional caller; `unknown` intermediate service assertion).
- A further controlled test uses two separate TaskMemoryStore instances on one persisted task and concurrently adds distinct scope records. `...task-memory/tests/store.test.ts --maxWorkers=1 --minWorkers=1` (coordinator `t909-concurrent-store-reproduction`) -> 18 passed, 1 failed, 53.82 s (551 ms tests): only `scope.0` remained, losing `scope.1`. Per-instance queues and process-local write locks do not make the owning read/replace atomic. This failure blocks final acceptance.
- Lead approved the proposed locking design and exact generic paths: existing `ProgramJsonStore.transaction` owns layout-v2 read/replace through the supplied transaction read/write port, with project setup outside it to avoid nested connections. Legacy JSON keeps its existing file/data owner, with a per-document empty SQLite coordination guard for read/modify/atomic rename through existing SQLiteRepository transactions. No task/request/row data enters the guard; no new row store, clock polling, global execution lock or record cap. Implemented `framework/persistence/program-state/document-transaction/{index.ts,transaction.ts,tests/transaction.test.ts,tests/process-writer.ts}` and task-memory integration. The task and attempt-index documents both use the port. Independent-process retention/crash recovery and independent-document progress are required, alongside both acts and snapshot refs.
- Added six generic transaction cases (independent processes in both layouts, crashed writer release in both, independent legacy documents, genuine failure propagation). Store tests now check acts, snapshot refs and attempt index across two stores in both layouts. Exact directory-shape assertions explicitly include the new data-free `.document-locks` artifact. Lead review found a reader-parameter/local-name collision in `orSetAside`; renamed the local `parsed` before the queued typecheck started. Review and focused validation remain in progress.
- Atomic owner package check -> exit 0, 80.649 s compiler step. First owner acceptance -> generic process cases 6/6 passed; store cases 19/20 passed. The new v2 case had committed both scopes through the native transaction, then its strict read failed with `repository.readonly_journal_unsupported`: the exported security-oriented read-only proof port intentionally refuses live WAL. The suite also correctly required a real-SQL marker after legacy coordination began opening SQLite. Added the marker and changed only the internal strict read: v2 reads through the supplied owning transaction port; legacy JSON uses an explicit missing-default flag and validates the full record. The exported read-only port's limits and WAL guard are unchanged.
- Lead review challenged the process contention schedule: releasing the first process immediately after the second's pre-lock `starting` message does not prove the second blocked. Removed the immediate absence assertion, added terminal exit/error retention so future child waits reject instead of hanging, and queued an isolated counterfactual of the exact contention tests using raw process-local ProgramJsonStore read/replace in the test child only. No production bypass or timeout change. Final contention acceptance awaits that observed counterfactual.
- First unlocked process counterfactual -> legacy lost the first entry; v2 happened to retain both, confirming the schedule was insufficient. Strengthened the same fixture with a native `BEGIN IMMEDIATE` probe while the first child holds its read/modify section: only `SQLITE_BUSY` proves held ownership; unexpected acquisition is rolled back and closed, and other errors propagate. Test-only nonblocking probe changes no product timeout. Unlocked counterfactual then failed in both layouts (2 failed, 5 skipped, 1.44 s), observing an unheld writer lock in each.
- Normal final storage run -> document-process7 + TaskMemory20 passed (27 cases); the extra pin regression in that command failed separately. Lead independently reran the final storage pair: 2 files, 27 passed, 54.49 s, exit 0. This verifies both native process layouts, crash release, independent legacy documents, terminal waiter exit handling, both scope maps and task index retention. Storage reader hold released; no further storage changes planned.

## Durable execution task identity

- Actual original continuation check reproduced a further task-key boundary: keyed A, deliberate B, pin the Flow, full Core close/reopen, retry A -> 3 renewals instead of 2 at zero model calls. Same execution scope selected the new pinned task variant and could not see its old record.
- Lead requested the related named-registration check. Added it before wiring the fix: learn a named spec, run the key, register a changed spec under that name, full Core close/reopen, retry the same raw name/key -> 3 renewals instead of 2. `...fluxnode/tests/pin-act-scope.test.ts --maxWorkers=1 --minWorkers=1` -> 2 failed, 58.42 s (5.01 s tests). Both gaps reached actual lasting effects.
- Lead approved `fluxnode/act-scope/execution-task.ts` + adjacent tests and a minimal owner-held launch delta in `create-fluxnode-service.ts`; `run-fluxnode.ts` stays unchanged. The new binding records only project, name, resolved spec hash, opaque scope and original task key beside the existing execution owner metadata. It commits before admission for keys, children and resumes. Corrupt/conflicting bindings preserve their cause and take the existing storage/configuration refusal with owner cleanup. Task and pin selection uses existing caller-key/options/pin APIs; selection runs outside the metadata transaction to avoid nested reads. No act-record copying/searching or input dedupe. Rootless services retain an explicit owner-scoped volatile binding; rooted services always read the durable document.
- Initial execution-task package check is running. Final key/pin/target/cleanup and coherent source-snapshot acceptance remain pending; no final acceptance is claimed yet.

Minimal shared-seam delta from the frozen host handoff (lead merges these hunks with t907 host wiring and t905 result wiring):

```diff
--- answer-first/attempt/run-attempt.ts
+++ answer-first/attempt/run-attempt.ts
@@
     const save = () => opening.memory.update(projectId, opening.taskId, (current) => ({
       ...current, acts: kept,
       ...(scope === undefined ? {} : { actsByScope: { ...current.actsByScope, [scope]: kept } })
-    }));
+    }), { scoped: scope !== undefined });
--- fluxnode/create-fluxnode-service.ts
+++ fluxnode/create-fluxnode-service.ts
@@
-import { FluxNodeIdempotencyKeys, fluxNodeActScope, fluxNodeChildActScope, fluxNodeExecutionOwner, fluxNodeRequestIdentity, fluxNodeSecretBindings } from "./act-scope/index.ts";
+import { FluxNodeIdempotencyKeys, fluxNodeActScope, fluxNodeChildActScope, fluxNodeExecutionOwner, fluxNodeRequestIdentity, fluxNodeSecretBindings, fluxNodeScopedMemoryProblem } from "./act-scope/index.ts";
@@
       if (!run) return { refusal: "Another live or unverified engine owns this child execution." };
+      if ("unreadable" in run) return { refusal: run.unreadable.message };
@@
-  const launch = async (registered: FluxNodeRegistered, carried: FluxNodeRunCarried, key: { key: string; request: unknown; scope: string } | undefined): Promise<FluxNodeRun | undefined> => {
+  const launch = async (registered: FluxNodeRegistered, carried: FluxNodeRunCarried, key: { key: string; request: unknown; scope: string } | undefined): Promise<FluxNodeRun | { unreadable: Error } | undefined> => {
@@
+      let unreadable: Error | undefined;
       try {
+        unreadable = await fluxNodeScopedMemoryProblem({ service: source.service, registered, scope: scoped.actScope!, taskKey: scoped.taskKey });
+        if (unreadable) throw unreadable;
         const made = new FluxNodeRun(runId, { name: registered.name, specHash: registered.specHash, projectId: registered.projectId, flowId: registered.flowId, flowPath: registered.flowPath }, scoped, fluxNodeApiPath("runEvents", { runId }), now, secrets);
@@
         catch (cleanupError) { throw new AggregateError([error, cleanupError], "Core could not register the run and release execution ownership."); }
+        if (unreadable && error === unreadable) return { unreadable };
         throw error;
@@
       if (!run) return refuse({ code: "invalid_request", message: "Another live or unverified engine owns this execution. Continue through its owning engine before starting it here." });
+      if ("unreadable" in run) return refuse({ code: "invalid_request", message: run.unreadable.message });
```

The helper export, strict TaskMemory implementation/call sites, and tests are dependencies of these two hunks; do not transfer either shared hunk alone. The full exact create-file delta is also available read-only with `git diff --no-index -- <t905 copied create file> <t909 create file>` until the lead applies it. Other post-handoff adapter changes remain in the separate ten-path list above.

## Intake observations (historical)

- Paired Core: `../!FluxIQ`, clean at `e5f4bcf42` (`WIP: stopped mid-round because usage ran out ... unvalidated, resume from the lane's report`). Extension has only the lead's untracked continuation brief before this report.
- `git diff --stat dev...HEAD`: 17 Core files, 337 insertions, 18 deletions. `git diff --stat HEAD`: empty. `git rev-list --left-right --count dev...HEAD`: `17 1`; this lane must be synced before implementation. The two-dot diff includes unrelated newer dev work and is not the ownership list.
- The requested previous act-scope report is absent. `rg --files -uu docs/working` contains no act-scope/action-scope report; searching `docs/working/fluxnode-plan.md` and its reports finds no t909/action-scope entry. Downstream only the new continuation brief mentions t909. There is no prior validation result to trust.
- Read lane AGENTS/CODEX, paired Core's role/boundary/structure/validation instructions, MeritPrompts CODEX, FluxIQ lessons index, relevant Core ownership and deterministic-run lessons, and Core fluxnode-plan Current State. The latter still names other in-flight lanes and supplies no t909 acceptance claim.

## Existing WIP behavior (code inspection, not execution)

1. Saved-Flow task identity remains name/spec hash (plus existing explore/pin variants). New `actScope` separates an execution's lasting acts from that shared task.
2. A fresh unkeyed run gets `fluxnode.run.<runId>`. A keyed run hashes canonical JSON containing its idempotency key and request into `fluxnode.key.<sha256>`, so raw inputs are not stored in the scope. A resume carries its predecessor's scope. Pipeline children launch as independent runs.
3. Caller options validate nonblank scopes of 1-512 characters, preserve them in kept options, and give the attempt the scope.
4. Attempt opening carries an act record only when the record's attempt provenance names the same scope. It refuses an unknown/other scope, while unscoped chat retains its existing carry rule. The fallback Flow record is read only when its latest attempt row is the same scoped attempt.
5. `FluxNodeActRecords` holds cloned task records in a process-local map for `budget_out`/`waiting_for_person`, restoring them into the task's single `acts` slot before a resume. It removes a held record on restoration. It never holds another scope's acts.
6. A standing caller scope also removes `deriveInstructed` from permission ground. This avoids a model call just to infer permission already granted by code; consequence/site scope enforcement remains in the existing scope gate.
7. Added tests cover scope hashing, direct keep/restore, fresh runs with same/different inputs, an immediate same-key duplicate, and a same-key retry after replacing only the FluxNode facade. These tests have not been run. Their replay proofs stop after one replay, short of the required three later attempts.

## Remaining root-cause gaps

- **Intervening runs can erase a keyed execution's persistent act history.** Task memory and Flow storage each keep only the latest record. Completed key A is not held by `FluxNodeActRecords`; run B replaces both slots. After a facade/process restart, retry A finds B's record, then rejects fallback because B is the latest row. It therefore starts empty and can repeat A's lasting act. The existing restart test retries A before B and cannot expose this. This is a direct control-flow inference; add the failing regression before selecting the storage fix. Persist scope-owned records independently of the latest task slot; do not solve this by limiting runs or retaining only the latest key.
- **Explore resumes use a different task key.** `caller-options.ts` keys mode `explore` by the new run ID; `FluxNodeActRecords.restore` looks up that new task key although the held record belongs to the predecessor's key. Scope alone cannot recover it. Preserve the execution's task identity on continuation, with a regression proving no repeated act. Examine pin task identity in the same proof.
- **Resume integration is unproven.** The new keep/restore test manipulates memory directly. Exercise a real run that lands an act, pauses, another run replaces task memory, then resumes; include chained/repeated resumes and both resumable endings where practical.
- **Permission/read boundaries are unproven.** Add an assertion that a standing scope makes no instruction-authority call, while unscoped chat retains that behavior and denied consequences/sites remain denied.
- **Compatibility and persistence need narrow regression coverage.** Cover old unscoped/unknown-provenance records, changed requests/keys, pipeline child acts, and the same learned Flow on at least three later deterministic runs. Assert actual lasting effects, Flow provenance, zero model calls, and report timings.

## Proposed ownership

All paths below are relative to paired Core unless explicitly downstream. No ownership of shared working documents or another lane is requested.

Existing WIP paths (all 17):

```text
packages/fluxiq/src/framework/automation-service/service/answer-first/attempt/opening.ts
packages/fluxiq/src/framework/automation-service/service/answer-first/caller/applied.ts
packages/fluxiq/src/framework/automation-service/service/answer-first/caller/kept.ts
packages/fluxiq/src/framework/automation-service/service/answer-first/caller/options.ts
packages/fluxiq/src/framework/automation-service/service/answer-first/caller/tests/options.test.ts
packages/fluxiq/src/framework/automation-service/service/flow-bootstrap-commands/contracts.ts
packages/fluxiq/src/framework/automation-service/service/fluxnode/act-scope/act-records.ts
packages/fluxiq/src/framework/automation-service/service/fluxnode/act-scope/act-scope.ts
packages/fluxiq/src/framework/automation-service/service/fluxnode/act-scope/index.ts
packages/fluxiq/src/framework/automation-service/service/fluxnode/act-scope/tests/act-scope.test.ts
packages/fluxiq/src/framework/automation-service/service/fluxnode/caller-options.ts
packages/fluxiq/src/framework/automation-service/service/fluxnode/create-fluxnode-service.ts
packages/fluxiq/src/framework/automation-service/service/fluxnode/fluxnode-run.ts
packages/fluxiq/src/framework/automation-service/service/fluxnode/run-fluxnode.ts
packages/fluxiq/src/framework/automation-service/service/fluxnode/tests/act-scope.test.ts
packages/fluxiq/src/framework/automation-service/service/fluxnode/tests/library-lane.ts
packages/fluxiq/src/runtime/answer-first/act-record/seed.ts
```

Directly adjacent additions proposed:

```text
packages/fluxiq/src/framework/automation-service/service/answer-first/caller/tests/applied.test.ts
packages/fluxiq/src/framework/automation-service/service/answer-first/attempt/tests/act-scope.test.ts (new)
docs/architecture/runtime-ownership.md
```

The independent scope-record storage may be implemented in the existing `fluxnode/act-scope/` area; if inspection proves generic Answer First persistence changes necessary, request those exact paths before touching them. Do not touch t898 `private-run-context.md`, t902 files, main checkouts, shared Current State/ledger/index, or user edits. Downstream ownership is this report only. The lead owns package version handling and both repositories' git operations.

## Remaining phases and acceptance

1. Lead syncs dev into both t909 task branches, resolves ownership conflicts, and confirms the paths above. Re-read changed owned files after sync.
2. Add and run regressions for intervening-run restart and explore resume; record observed failures. Fix scope-owned record retention and continuation identity at the owning boundary. Add the permission and legacy compatibility assertions.
3. Extend task proof to exploration plus three later runs, unchanged state between runs; prove actual effects, predecessor Flow continuation, zero model calls and timing. Cover pipeline/resume identities without broadening unrelated behavior.
4. Run narrow acceptance below and update this report with actual command/output. Lead verifies results independently, updates shared docs/version if needed, and integrates.

Proposed commands from paired Core (PowerShell uses `pnpm.cmd`):

```text
pnpm.cmd --filter fluxiq exec vitest run src/framework/automation-service/service/answer-first/caller/tests/options.test.ts src/framework/automation-service/service/answer-first/caller/tests/applied.test.ts --maxWorkers=1 --minWorkers=1
pnpm.cmd --filter fluxiq exec vitest run src/framework/automation-service/service/fluxnode/act-scope/tests src/framework/automation-service/service/fluxnode/tests src/framework/automation-service/service/answer-first/caller/tests src/framework/automation-service/service/answer-first/attempt/tests/act-scope.test.ts src/framework/automation-service/service/answer-first/attempt/tests/carried-before.test.ts src/framework/automation-service/service/answer-first/attempt/tests/remember-acts.test.ts src/runtime/answer-first/act-record/tests --maxWorkers=1 --minWorkers=1
pnpm.cmd --filter fluxiq check
pnpm.cmd structure:check
```

The first mocked unit command can run serially without a heavy slot. The real-SQL suite, package check and audit need the lead's first-launch agreement and coordination through `fxwork/.tools/heavy-slot.mjs`. No full suites, browser/Lab, paid models or panel management are needed for this Core-only change. A full process restart proof must close/reopen the service on the same isolated temporary data directory; the current `lane.restart()` only recreates its FluxNode facade.

## Validation observed in intake

- `git status --short` (Core) -> no output, clean.
- `git diff --stat dev...HEAD` -> 17 files, 337 insertions, 18 deletions.
- `git diff --stat HEAD` -> no output, no uncommitted Core changes.
- `git rev-list --left-right --count dev...HEAD` -> `17 1`.
- `rg --files -uu docs/working` filtered for act-scope/action-scope -> no old report.
- No tests, type checks, audits, builds, paid runs or browser sessions launched. Identified gaps are code-inspection findings pending regression execution.

Historical intake return contract:

Outcome: Done (read-only intake only)
Changed: downstream `docs/working/mvp-launch-plan/reports/codex-t909-resume.md`
Validation: `git diff --stat dev...HEAD` -> 17 Core WIP files; `git status --short` -> Core clean; no acceptance tests run during intake.
Not verified: runtime behavior, existing WIP tests, interleaved keyed restart, real resume, explore/pin/pipeline continuation, downstream compatibility.
Report: `docs/working/mvp-launch-plan/reports/codex-t909-resume.md`
Notes: Missing old report explicitly recorded. Implementation waits for lead sync/ownership confirmation. No source edits or git mutations.

## Final commit and shared-seam manifests

The following is the exact uncommitted Core staging manifest from `git status --short --untracked-files=all`. It includes every new source/test file, the deletion of the obsolete WIP act-record cache, and the lead-transferred snapshot-owner rename. Existing WIP, immutable-snapshot and migration-composition commits are already in HEAD; those files must also remain in the final branch history. No generated/runtime/private artifact appears below. The worker performs no staging or git mutation.

```text
 M docs/architecture/automation-studio/persistence.md
 M docs/architecture/runtime-ownership.md
 M packages/fluxiq/src/framework/automation-service/service/answer-first/attempt/opening.ts
 M packages/fluxiq/src/framework/automation-service/service/answer-first/attempt/remember.ts
 M packages/fluxiq/src/framework/automation-service/service/answer-first/attempt/run-attempt.ts
 M packages/fluxiq/src/framework/automation-service/service/answer-first/attempt/tests/remember-acts.test.ts
 M packages/fluxiq/src/framework/automation-service/service/answer-first/caller/tests/applied.test.ts
 M packages/fluxiq/src/framework/automation-service/service/answer-first/run-acts/run-gate.ts
 M packages/fluxiq/src/framework/automation-service/service/answer-first/task-memory/memory.ts
 M packages/fluxiq/src/framework/automation-service/service/answer-first/task-memory/store.ts
 M packages/fluxiq/src/framework/automation-service/service/answer-first/task-memory/tests/store.test.ts
 D packages/fluxiq/src/framework/automation-service/service/fluxnode/act-scope/act-records.ts
 M packages/fluxiq/src/framework/automation-service/service/fluxnode/act-scope/act-scope.ts
 M packages/fluxiq/src/framework/automation-service/service/fluxnode/act-scope/index.ts
 M packages/fluxiq/src/framework/automation-service/service/fluxnode/act-scope/tests/act-scope.test.ts
 M packages/fluxiq/src/framework/automation-service/service/fluxnode/caller-options.ts
 M packages/fluxiq/src/framework/automation-service/service/fluxnode/create-fluxnode-service.ts
 M packages/fluxiq/src/framework/automation-service/service/fluxnode/fluxnode-run.ts
 M packages/fluxiq/src/framework/automation-service/service/fluxnode/pipeline/fluxnode-flow-caller.ts
 M packages/fluxiq/src/framework/automation-service/service/fluxnode/pipeline/fluxnode-pipeline-context.ts
 M packages/fluxiq/src/framework/automation-service/service/fluxnode/pipeline/run-fluxnode-pipeline.ts
 M packages/fluxiq/src/framework/automation-service/service/fluxnode/pipeline/tests/pipeline-runs.test.ts
 M packages/fluxiq/src/framework/automation-service/service/fluxnode/run-fluxnode.ts
 M packages/fluxiq/src/framework/automation-service/service/fluxnode/tests/act-scope.test.ts
 M packages/fluxiq/src/framework/automation-service/service/fluxnode/tests/library-lane.ts
 M packages/fluxiq/src/framework/automation-service/service/pipelines/map/index.ts
 M packages/fluxiq/src/framework/automation-service/service/pipelines/map/map-step.ts
 M packages/fluxiq/src/framework/automation-service/service/pipelines/map/tests/map-step.test.ts
 M packages/fluxiq/src/framework/automation-service/service/pipelines/run/load-source.ts
 M packages/fluxiq/src/framework/automation-service/service/pipelines/types.ts
 D packages/fluxiq/src/framework/persistence/automation/project/dataset-snapshots/index.ts
 D packages/fluxiq/src/framework/persistence/automation/project/dataset-snapshots/store.ts
 D packages/fluxiq/src/framework/persistence/automation/project/dataset-snapshots/tests/store.test.ts
 M packages/fluxiq/src/framework/persistence/automation/project/index.ts
 D packages/fluxiq/src/framework/persistence/automation/project/schema/dataset-snapshots/index.ts
 D packages/fluxiq/src/framework/persistence/automation/project/schema/dataset-snapshots/migration.ts
 M packages/fluxiq/src/framework/persistence/automation/project/schema/index.ts
 M packages/fluxiq/src/runtime/answer-first/act-record/gate/act-gate.ts
 M packages/fluxiq/src/runtime/answer-first/act-record/record.ts
 M packages/fluxiq/src/runtime/answer-first/act-record/tests/record.test.ts
?? packages/fluxiq/src/framework/automation-service/service/answer-first/attempt/tests/act-scope.test.ts
?? packages/fluxiq/src/framework/automation-service/service/answer-first/run-acts/tests/settled-before-return.test.ts
?? packages/fluxiq/src/framework/automation-service/service/fluxnode/act-scope/child-scope.ts
?? packages/fluxiq/src/framework/automation-service/service/fluxnode/act-scope/execution-owner.ts
?? packages/fluxiq/src/framework/automation-service/service/fluxnode/act-scope/execution-targets.ts
?? packages/fluxiq/src/framework/automation-service/service/fluxnode/act-scope/execution-task.ts
?? packages/fluxiq/src/framework/automation-service/service/fluxnode/act-scope/idempotency-keys.ts
?? packages/fluxiq/src/framework/automation-service/service/fluxnode/act-scope/pipeline-source-of.ts
?? packages/fluxiq/src/framework/automation-service/service/fluxnode/act-scope/pipeline-source-reference.ts
?? packages/fluxiq/src/framework/automation-service/service/fluxnode/act-scope/pipeline-source-secrets.ts
?? packages/fluxiq/src/framework/automation-service/service/fluxnode/act-scope/pipeline-source.ts
?? packages/fluxiq/src/framework/automation-service/service/fluxnode/act-scope/request-identity.ts
?? packages/fluxiq/src/framework/automation-service/service/fluxnode/act-scope/scoped-memory.ts
?? packages/fluxiq/src/framework/automation-service/service/fluxnode/act-scope/secret-bindings.ts
?? packages/fluxiq/src/framework/automation-service/service/fluxnode/act-scope/tests/execution-owner.test.ts
?? packages/fluxiq/src/framework/automation-service/service/fluxnode/act-scope/tests/execution-targets.test.ts
?? packages/fluxiq/src/framework/automation-service/service/fluxnode/act-scope/tests/execution-task.test.ts
?? packages/fluxiq/src/framework/automation-service/service/fluxnode/act-scope/tests/pipeline-source.test.ts
?? packages/fluxiq/src/framework/automation-service/service/fluxnode/act-scope/tests/request-identity.test.ts
?? packages/fluxiq/src/framework/automation-service/service/fluxnode/act-scope/tests/scoped-memory.test.ts
?? packages/fluxiq/src/framework/automation-service/service/fluxnode/pipeline/tests/source-continuation.test.ts
?? packages/fluxiq/src/framework/automation-service/service/fluxnode/pipeline/tests/source-secrets.test.ts
?? packages/fluxiq/src/framework/automation-service/service/fluxnode/tests/corrupt-scoped-memory.test.ts
?? packages/fluxiq/src/framework/automation-service/service/fluxnode/tests/idempotency.test.ts
?? packages/fluxiq/src/framework/automation-service/service/fluxnode/tests/pin-act-scope.test.ts
?? packages/fluxiq/src/framework/automation-service/service/pipelines/map/invocations.ts
?? packages/fluxiq/src/framework/automation-service/service/pipelines/map/tests/invocations.test.ts
?? packages/fluxiq/src/framework/persistence/automation/project/dataset-occurrence-schema/index.ts
?? packages/fluxiq/src/framework/persistence/automation/project/dataset-occurrence-schema/migration.ts
?? packages/fluxiq/src/framework/persistence/automation/project/dataset-occurrences/index.ts
?? packages/fluxiq/src/framework/persistence/automation/project/dataset-occurrences/store.ts
?? packages/fluxiq/src/framework/persistence/automation/project/dataset-occurrences/tests/store.test.ts
?? packages/fluxiq/src/framework/persistence/program-state/document-transaction/index.ts
?? packages/fluxiq/src/framework/persistence/program-state/document-transaction/tests/process-writer.ts
?? packages/fluxiq/src/framework/persistence/program-state/document-transaction/tests/transaction.test.ts
?? packages/fluxiq/src/framework/persistence/program-state/document-transaction/transaction.ts
?? packages/fluxiq/src/runtime/answer-first/act-record/gate/tests/settled-before-return.test.ts
```

### Exact create-fluxnode-service.ts delta since the frozen host handoff

Retained base: `C:/Users/osrs_/FluxStuff/fxwork/t905/!FluxIQ/packages/fluxiq/src/framework/automation-service/service/fluxnode/create-fluxnode-service.ts` (`a84e2ab85418983b0e5932aa41cb6c198ecbc99e`). Result: `packages/fluxiq/src/framework/automation-service/service/fluxnode/create-fluxnode-service.ts` (`c3cfb86c764d599b9a797ba342139d121003e74d`). The retained base was confirmed by the lead; this patch is read-only output, not a whole-file transfer. Preserve t907 host shutdown/admission changes and t905 result wiring when integrating.

```diff
diff --git a/packages/fluxiq/src/framework/automation-service/service/fluxnode/create-fluxnode-service.ts b/packages/fluxiq/src/framework/automation-service/service/fluxnode/create-fluxnode-service.ts
index a84e2ab85..c3cfb86c7 100644
--- a/packages/fluxiq/src/framework/automation-service/service/fluxnode/create-fluxnode-service.ts
+++ b/packages/fluxiq/src/framework/automation-service/service/fluxnode/create-fluxnode-service.ts
@@ -21,11 +21,12 @@
 // and request, or its own id; a resume keeps the first run's scope, and a pipeline's child runs are runs.
 
 import { createHash, randomUUID } from "node:crypto";
-import { checkFluxNodeRunInputs, fillFluxNodeGoal, FLUXNODE_PIPELINE_OVERRIDES_MESSAGE, fluxNodeApiPath, fluxNodeSecretInputs, type FluxNodeIssue, type FluxNodeRunRequest, type FluxNodeRunResult, type FluxNodeSpec } from "@fluxiq/contracts/fluxnode";
+import { checkFluxNodeRunInputs, fillFluxNodeGoal, FLUXNODE_PIPELINE_OVERRIDES_MESSAGE, fluxNodeApiPath, fluxNodeSecretInputs, resolveFluxNodeOptions, type FluxNodeIssue, type FluxNodeRunRequest, type FluxNodeRunResult, type FluxNodeSpec } from "@fluxiq/contracts/fluxnode";
 import type { JsonObject } from "../../../../core/index.ts";
 import type { AutomationStudioLlmModelCaller } from "../../../../runtime/llm/index.ts";
 import type { AutomationStudioService } from "../../service.ts";
-import { FluxNodeIdempotencyKeys, fluxNodeActScope, fluxNodeChildActScope, fluxNodeExecutionOwner, fluxNodeRequestIdentity, fluxNodeSecretBindings } from "./act-scope/index.ts";
+import { FluxNodeIdempotencyKeys, fluxNodeActScope, fluxNodeChildActScope, fluxNodeExecutionOwner, fluxNodeRequestIdentity, fluxNodeSecretBindings, fluxNodeScopedMemoryProblem, fluxNodeExecutionTask, fluxNodeExecutionTargets } from "./act-scope/index.ts";
+import { fluxNodeCallerKey } from "./caller-key.ts";
 import { fluxNodeEventStream } from "./events/index.ts";
 import { fluxNodeFlowExport } from "./flow-export.ts";
 import { FluxNodeRun, type FluxNodeRunCarried } from "./fluxnode-run.ts";
@@ -88,13 +89,14 @@ export function createFluxNodeService(source: FluxNodeServiceSource): FluxNodeSe
       const carried: FluxNodeRunCarried = { inputs, ...(actScope === undefined ? {} : { actScope }), ...(parent.carried.options === undefined ? {} : { options: parent.carried.options }), correlationId: parent.carried.correlationId ?? parent.runId };
       const issues = inputIssuesOf(registered, inputs);
       if (issues.length) return { refusal: `The inputs of a call to "${registered.name}" do not fit it: ${issues[0]?.path ?? ""} ${issues[0]?.message ?? ""}`.trim() };
-      const run = await launch(registered, carried, undefined);
+      const run = await launch(registered, carried, undefined, parent.carried.targets);
       if (!run) return { refusal: "Another live or unverified engine owns this child execution." };
+      if ("unreadable" in run) return { refusal: run.unreadable.message };
       return { run, ended: runs.get(run.runId)!.finished };
     }
   };
 
-  const launch = async (registered: FluxNodeRegistered, carried: FluxNodeRunCarried, key: { key: string; request: unknown; scope: string } | undefined): Promise<FluxNodeRun | undefined> => {
+  const launch = async (registered: FluxNodeRegistered, carried: FluxNodeRunCarried, key: { key: string; request: unknown; scope: string } | undefined, admittedTargets?: Readonly<Record<string, string>>): Promise<FluxNodeRun | { unreadable: Error } | undefined> => {
     const runId = `fnr-${randomUUID()}`;
     // A secret input's value is withheld from everything the run tells (`./secrets/`); a pipeline declares none.
     const secrets = isRegisteredPipeline(registered) ? [] : Object.values(fluxNodeSecretInputs(registered.spec.inputs, carried.inputs).values);
@@ -111,7 +113,31 @@ export function createFluxNodeService(source: FluxNodeServiceSource): FluxNodeSe
         try { await owner.release(); }
         finally { if (run && activeScopes.get(scope) === run) activeScopes.delete(scope); }
       };
+      let unreadable: Error | undefined;
       try {
+        unreadable = await fluxNodeScopedMemoryProblem({ service: source.service, registered, scope: scoped.actScope!, taskKey: scoped.taskKey });
+        if (unreadable) throw unreadable;
+        const targets = await fluxNodeExecutionTargets(registered, flows, admittedTargets);
+        if ("problem" in targets) {
+          unreadable = targets.problem;
+          throw unreadable;
+        }
+        const binding = await fluxNodeExecutionTask({
+          file: source.service.projectPaths.root ? source.service.projectPaths.projectFile(registered.projectId, "fluxnode", "executions", `${createHash("sha256").update(scoped.actScope!).digest("hex")}.json`) : undefined,
+          owner: source.service, identity: { projectId: registered.projectId, name: registered.name, specHash: registered.specHash, scope: scoped.actScope!, targets: targets.targets },
+          choose: async () => {
+            if (scoped.taskKey !== undefined) return scoped.taskKey;
+            if (isRegisteredPipeline(registered)) return fluxNodeCallerKey(registered);
+            const options = resolveFluxNodeOptions(registered.spec.options, scoped.options);
+            return fluxNodeCallerKey({ ...registered, ...(options.mode === "explore" ? { explore: scoped.actScope } : { pinned: Boolean((await pins.view(registered)).record) }) });
+          }
+        });
+        if ("problem" in binding) {
+          unreadable = binding.problem;
+          throw unreadable;
+        }
+        scoped.taskKey = binding.taskKey;
+        scoped.targets = binding.targets;
         const made = new FluxNodeRun(runId, { name: registered.name, specHash: registered.specHash, projectId: registered.projectId, flowId: registered.flowId, flowPath: registered.flowPath }, scoped, fluxNodeApiPath("runEvents", { runId }), now, secrets);
         run = made;
         activeScopes.set(scope, made);
@@ -128,6 +154,7 @@ export function createFluxNodeService(source: FluxNodeServiceSource): FluxNodeSe
       } catch (error) {
         try { await cleanup(); }
         catch (cleanupError) { throw new AggregateError([error, cleanupError], "Core could not register the run and release execution ownership."); }
+        if (unreadable && error === unreadable) return { unreadable };
         throw error;
       }
     });
@@ -157,7 +184,9 @@ export function createFluxNodeService(source: FluxNodeServiceSource): FluxNodeSe
       const issues = inputIssuesOf(target.registered, target.carried.inputs);
       if (issues.length) return refuse({ code: "invalid_inputs", message: "The inputs do not fit this FluxNode.", issues });
       if (isRegisteredPipeline(target.registered) && !source.service.runDatasets.available) return refuse({ code: "invalid_request", message: "A pipeline requires immutable source snapshot storage before it can start." });
-      const bindings = await fluxNodeSecretBindings(target.registered, target.carried.inputs, flows, {
+      const targets = await fluxNodeExecutionTargets(target.registered, flows);
+      if ("problem" in targets) return refuse({ code: "invalid_request", message: targets.problem.message });
+      const bindings = await fluxNodeSecretBindings(target.registered, target.carried.inputs, targets.flows, {
         privateDataset: async (snapshotId) => (await source.service.runDatasets.readImmutableSnapshotPage({ projectId: target.registered.projectId, snapshotId, limit: 1 })) !== null
       });
       if (bindings.problem) return refuse({ code: "invalid_request", message: bindings.problem });
@@ -173,8 +202,9 @@ export function createFluxNodeService(source: FluxNodeServiceSource): FluxNodeSe
         return keyed === "conflict" ? refuse({ code: "idempotency_conflict", message: "That idempotency key was used with a different request." }) : ok(runs.get(keyed.runId)!.run.state());
       }
       if (claim === "busy") return refuse({ code: "invalid_request", message: "Another live or unverified engine owns this keyed execution. Continue through its owning engine before starting it here." });
-      const run = await launch(target.registered, target.carried, request.idempotencyKey === undefined || !claim ? undefined : { key: request.idempotencyKey, request: identity.projection, scope: claim.scope });
+      const run = await launch(target.registered, target.carried, request.idempotencyKey === undefined || !claim ? undefined : { key: request.idempotencyKey, request: identity.projection, scope: claim.scope }, targets.targets);
       if (!run) return refuse({ code: "invalid_request", message: "Another live or unverified engine owns this execution. Continue through its owning engine before starting it here." });
+      if ("unreadable" in run) return refuse({ code: "invalid_request", message: run.unreadable.message });
       return ok(run.state());
       });
     },
```

### Exact run-attempt.ts delta since the frozen host handoff

Retained base: `C:/Users/osrs_/FluxStuff/fxwork/t907/!FluxIQ/packages/fluxiq/src/framework/automation-service/service/answer-first/attempt/run-attempt.ts` (`314384bea2f3b3f32f3e7ca8a4c8750e2798b924`). Result: `packages/fluxiq/src/framework/automation-service/service/answer-first/attempt/run-attempt.ts` (`0d812234edd12a2f6b279a677a0f8a6c21e5da27`). The retained base was confirmed by the lead; this patch is read-only output, not a whole-file transfer. Preserve t907 host shutdown/admission changes and t905 result wiring when integrating.

```diff
diff --git a/packages/fluxiq/src/framework/automation-service/service/answer-first/attempt/run-attempt.ts b/packages/fluxiq/src/framework/automation-service/service/answer-first/attempt/run-attempt.ts
index 314384bea..0d812234e 100644
--- a/packages/fluxiq/src/framework/automation-service/service/answer-first/attempt/run-attempt.ts
+++ b/packages/fluxiq/src/framework/automation-service/service/answer-first/attempt/run-attempt.ts
@@ -162,7 +162,7 @@ async function opened(input: AutomationStudioAnswerFirstAttemptInput, attemptId:
     const save = () => opening.memory.update(projectId, opening.taskId, (current) => ({
       ...current, acts: kept,
       ...(scope === undefined ? {} : { actsByScope: { ...current.actsByScope, [scope]: kept } })
-    }));
+    }), { scoped: scope !== undefined });
     if (scope === undefined) await automationStudioAnswerFirstBestEffort(save);
     else await save();
   };
```

## Post-handoff transfer set

The source-snapshot adapter, strict scoped storage, atomic task owner and durable task/target binding add the following dependency set after the frozen host slice. Source paths below are relative to `packages/fluxiq/src/`, except the authored architecture document. The two shared-seam patches above are exact comparisons against the retained handoff files. The generic snapshot API/owner rename and migration-composition dependencies were transferred by the lead separately and are already identified in the complete commit manifest.

```text
docs/architecture/runtime-ownership.md
framework/automation-service/service/answer-first/attempt/opening.ts
framework/automation-service/service/answer-first/attempt/remember.ts
framework/automation-service/service/answer-first/attempt/run-attempt.ts
framework/automation-service/service/answer-first/attempt/tests/remember-acts.test.ts
framework/automation-service/service/answer-first/task-memory/memory.ts
framework/automation-service/service/answer-first/task-memory/store.ts
framework/automation-service/service/answer-first/task-memory/tests/store.test.ts
framework/automation-service/service/fluxnode/act-scope/index.ts
framework/automation-service/service/fluxnode/act-scope/child-scope.ts
framework/automation-service/service/fluxnode/act-scope/execution-task.ts
framework/automation-service/service/fluxnode/act-scope/execution-targets.ts
framework/automation-service/service/fluxnode/act-scope/scoped-memory.ts
framework/automation-service/service/fluxnode/act-scope/secret-bindings.ts (import-only cycle correction after the host freeze)
framework/automation-service/service/fluxnode/act-scope/pipeline-source.ts
framework/automation-service/service/fluxnode/act-scope/pipeline-source-reference.ts
framework/automation-service/service/fluxnode/act-scope/pipeline-source-of.ts
framework/automation-service/service/fluxnode/act-scope/pipeline-source-secrets.ts
framework/automation-service/service/fluxnode/act-scope/tests/execution-task.test.ts
framework/automation-service/service/fluxnode/act-scope/tests/execution-targets.test.ts
framework/automation-service/service/fluxnode/act-scope/tests/scoped-memory.test.ts
framework/automation-service/service/fluxnode/act-scope/tests/pipeline-source.test.ts
framework/automation-service/service/fluxnode/create-fluxnode-service.ts
framework/automation-service/service/fluxnode/fluxnode-run.ts
framework/automation-service/service/fluxnode/pipeline/run-fluxnode-pipeline.ts
framework/automation-service/service/fluxnode/pipeline/tests/source-continuation.test.ts
framework/automation-service/service/fluxnode/pipeline/tests/source-secrets.test.ts
framework/automation-service/service/fluxnode/pipeline/tests/pipeline-runs.test.ts
framework/automation-service/service/fluxnode/tests/corrupt-scoped-memory.test.ts
framework/automation-service/service/fluxnode/tests/pin-act-scope.test.ts
framework/persistence/program-state/document-transaction/index.ts
framework/persistence/program-state/document-transaction/transaction.ts
framework/persistence/program-state/document-transaction/tests/transaction.test.ts
framework/persistence/program-state/document-transaction/tests/process-writer.ts
```

The new `fluxnode-run.ts` addition is the internal `targets?: Record<string,string>` carry field. `child-scope.ts` deliberately excludes the resolved spec hash from occurrence identity: the admitted manifest owns code identity and its changed-target refusal, while occurrence and lexical step own invocation identity. `run-fluxnode-pipeline.ts` binds both source enumeration and calls to the admitted flow finder. No additional host shutdown or result-schema changes belong to this delta.

## Exact independent acceptance commands

Run from `C:/Users/osrs_/FluxStuff/fxwork/t909/!FluxIQ`; all are provider-free unit/isolated SQL checks and create no browser or panel. The final targeted command checks missing targets before admission, recursive declarations, explicit hash precedence, original task identity, pin/root/child version changes and mid-run version stability.

Dynamic source, immutable occurrence/pointer snapshots, restart and fresh-parent continuation:

```text
node C:/Users/osrs_/FluxStuff/fxwork/.tools/heavy-slot.mjs run t909-lead-dynamic-source -- pnpm.cmd --filter fluxiq exec vitest run src/framework/automation-service/service/fluxnode/act-scope/tests/pipeline-source.test.ts src/framework/automation-service/service/fluxnode/pipeline/tests/source-continuation.test.ts src/framework/automation-service/service/fluxnode/pipeline/tests/source-secrets.test.ts --maxWorkers=1 --minWorkers=1
```

Corrupt scoped-state refusal, cause preservation and owner cleanup before admission:

```text
node C:/Users/osrs_/FluxStuff/fxwork/.tools/heavy-slot.mjs run t909-lead-corrupt-state -- pnpm.cmd --filter fluxiq exec vitest run src/framework/automation-service/service/fluxnode/tests/corrupt-scoped-memory.test.ts src/framework/automation-service/service/fluxnode/act-scope/tests/scoped-memory.test.ts --maxWorkers=1 --minWorkers=1
```

Pin/root/child target bindings and missing-target admission:

```text
node C:/Users/osrs_/FluxStuff/fxwork/.tools/heavy-slot.mjs run t909-lead-target-admission -- pnpm.cmd --filter fluxiq exec vitest run src/framework/automation-service/service/fluxnode/act-scope/tests/execution-targets.test.ts src/framework/automation-service/service/fluxnode/act-scope/tests/execution-task.test.ts src/framework/automation-service/service/fluxnode/tests/pin-act-scope.test.ts src/framework/automation-service/service/fluxnode/pipeline/tests/pipeline-runs.test.ts --maxWorkers=1 --minWorkers=1
```

The already independently accepted atomic storage pair (no source changes made to it in this recovery) can be checked with:

```text
node C:/Users/osrs_/FluxStuff/fxwork/.tools/heavy-slot.mjs run t909-lead-atomic-state -- pnpm.cmd --filter fluxiq exec vitest run src/framework/persistence/program-state/document-transaction/tests/transaction.test.ts src/framework/automation-service/service/answer-first/task-memory/tests/store.test.ts --maxWorkers=1 --minWorkers=1
```

Package and structure gates:

```text
node C:/Users/osrs_/FluxStuff/fxwork/.tools/heavy-slot.mjs run t909-lead-final-types -- pnpm.cmd --filter fluxiq check
node C:/Users/osrs_/FluxStuff/fxwork/.tools/heavy-slot.mjs run t909-lead-final-structure -- pnpm.cmd structure:check
```

## Observed final combined behavior command

This is the complete current-source acceptance actually run after the import correction. The lead may rerun this one command instead of the three separate source/corruption/target groups above. Its observed endpoint was 9 files, 31 passed, 141.38 s, exit 0.

```text
node C:/Users/osrs_/FluxStuff/fxwork/.tools/heavy-slot.mjs run t909-final-import-behavior -- pnpm.cmd --filter fluxiq exec vitest run src/framework/automation-service/service/fluxnode/act-scope/tests/pipeline-source.test.ts src/framework/automation-service/service/fluxnode/pipeline/tests/source-continuation.test.ts src/framework/automation-service/service/fluxnode/pipeline/tests/source-secrets.test.ts src/framework/automation-service/service/fluxnode/tests/corrupt-scoped-memory.test.ts src/framework/automation-service/service/fluxnode/act-scope/tests/scoped-memory.test.ts src/framework/automation-service/service/fluxnode/act-scope/tests/execution-targets.test.ts src/framework/automation-service/service/fluxnode/act-scope/tests/execution-task.test.ts src/framework/automation-service/service/fluxnode/tests/pin-act-scope.test.ts src/framework/automation-service/service/fluxnode/pipeline/tests/pipeline-runs.test.ts --maxWorkers=1 --minWorkers=1
```

## Final worker return contract

Outcome: Done
Changed: Core import/syntax correction in six owned files, runtime-ownership architecture documentation, and this downstream worker report. Complete lane commit manifest: 77 paths (40 tracked changes/deletions, 37 new files); post-handoff transfer set: 34 paths.
Validation: Final combined nine-file Vitest command above -> 31/31 passed, 141.38 s; `pnpm.cmd --filter fluxiq check` under `t909-final-import-types` -> exit 0, 71.728 s compiler; `pnpm.cmd structure:check` under `t909-final-import-structure` -> passed, zero violations, 544 warnings, 916 baselined; `git diff --check` -> exit 0.
Not verified: Lead independent acceptance and three-way integration remain with the lead. No full suite, browser, paid model or panel run was launched. Earlier 18-file/71-test coherent result is attributed to the lead; atomic 27-case and original ownership/settlement 83-case acceptance were not repeated after unchanged storage/runtime source.
Report: docs/working/mvp-launch-plan/reports/codex-t909-resume.md
Notes: Source frozen after current gates; original unknown/failed endpoints are recorded above. Exact create/run patches use retained host bases; preserve t907 shutdown and t905 result wiring. Worker performed no git mutation and did not edit any shared document.
