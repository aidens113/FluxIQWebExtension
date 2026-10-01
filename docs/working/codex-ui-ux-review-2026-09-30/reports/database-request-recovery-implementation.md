# Database request recovery implementation

Status: Exact six frontend paths implemented;34 focused tests and final scoped strict typing pass after supervisor metadata-target review. Product/test source and report frozen for independent supervisor verification. Current State and frozen audit read. Existing authorization14 tests remain unchanged. No backend/storage/auth-contract/ProgramApi/shared-hook/styles edits, broad/live/provider/panel calls or commits.

The owning database-records hook will manage metadata/list/detail reads only, abortable lifecycle, validated responses, current render/query/authority checks and separate local errors/retry. View retains authorization writes/credentials/grants and their epoch/busy safeguards. API/current-user replacement remounts local workspace immediately; expiry uses actual Date.now and explicit read invalidation. Confirmed page remains separate from requested navigation; changed queries mask old rows before effects. Old dialog dismiss must match its originating epoch.

## Reproduction and changes

Before product edits, integration repro native1,3tests failed as intended: pending sensitive detail repopulated inspector after expiry; captured old modal dismiss closed a fresh epoch; malformed list payload crashed with page.records noniterable. All fixtures synthetic. No backend authorization bypass is asserted.

`database-records/useDatabaseRecords.ts` owns metadata/list/detail read state and only calls snapshot/list-records/get-record. Each channel has abort controller/generation, pre-read microtask guard, current owner/query/authority checks before responses/finally/captured callbacks, fixed separate local errors and Retry. Validators accept actual metadata arrays, bounded50-row valid envelope pages/paging and requested id/kind/database detail; empty pages and null detail are valid distinct outcomes. No auth writes, credential access, grant map, durable storage or polling loop exists inside helper.

Read authority is an opaque identity supplied by view. Actual Date.now/deadline and caller authorization gate start, response and rendering. Expiry timer aborts/invalidates both record reads, clears private state and rejects expired captured callbacks. Refused sensitive authority clears presentation immediately and reports authorizationLost; view alone revokes its grant map, preserving original expired/refused-grant recovery behavior. Ordinary transient failures retain only same-context confirmed rows, marked stale; unauthorized/foreign/expired data is never retained for presentation.

Requested offset is separate from confirmed page. Pending/failed navigation retains old confirmed footer/rows and names requested page separately; Retry uses same offset. Large total shrink clamps directly once. Query/debounce changes mask prior rows/detail before effects, clear selection and reset navigation. Metadata removal masks old selection immediately and then reconciles store/database from confirmed metadata.

View uses API+current-user keyed private workspace; replacement immediately hides old metadata/rows/detail/modal/credentials without passive-effect delay. Grant/password map, authorization request body and epoch/busy guards stay in view; old modal dismiss/input handlers require originating epoch. Old store/read callbacks reject on owner/source replacement. Authorization and table styling/record rendering remain owned by existing view.

Existing pure source assertions now read the actual helper for bounded limit/query/detail requests; authorize-store/countdown assertions remain at existing source. Authorization behavioral file is untouched.

## Validation ledger

- Repro `codex t224 database recovery repro` native1,3fail/0pass (expiry late detail, stale dismiss, malformed page crash).
- First integration session83413 native1,7pass/12fail with19 errors. My new pre-authorization guard referenced a locally shadowed current function before declaration. Corrected that guard to check mounted/owner directly. This was an implementation error, not an inherited failure; no test assertions weakened. Its repeated React/error output was not private record data.
- Corrected integration51445 native0,3files/19tests,8.10s: new recovery3+unchanged authorization14+pure2.
- Owning helper/recovery96332 native0,4files/33tests,10.48s: helper9+integration8+authorization14+pure2. No skips. Covers rejected/malformed metadata/rows/detail recovery, fixed private-error screening, missing detail, confirmed pager failure/Retry/shrink, late expiry responses and new grant page, expired captured actions, revoked authority, query/API render masking, old response/callback/dismiss, read cancellation before microtask and teardown. React renderer's existing deprecation warning observed.
- Scoped strict TypeScript76450 native0. Temporary `%TEMP%/codex-t224-database-recovery-tsconfig.json` extends unchanged web config; lists exact owned source/tests+Next ambient declarations, follows transitive imports, disables incremental output. No typeconfig/assertion weakening. Tracked affected diff whitespace check native0. Git diff has no changes to authorization test.
- No broad tests/check/build/audit or live/browser/provider/panel calls; supervisor owns independent review and final broader gates/checkpoint.

## Resume

Supervisor independently verify frozen six paths and run appropriate broader gates. No extra paths needed. Browser timing/layout/focus remains unverified; synthetic tests establish frontend guards only.

## Supervisor metadata-target follow-up

Supervisor requested removed-sensitive-store validation while recheck is open, before passive reconciliation. Targeted layout-commit repro native1,1fail/8excluded by name filter: obsolete dialog was still rendered. New view targetRef gates authorization start/result/open/dismiss/credential inputs against latest confirmed metadata and current store/database; modal render requires the target to be present. Thus old target callbacks cannot submit even before epoch reconciliation, and credentials/dialog do not appear under removed metadata. Backend remains authoritative; no bypass claim.

Added user-triggered metadata Refresh icon in existing sidebar heading using the existing snapshot read; no polling or backend change. New integration observes child layout commit, invokes retained authorization/open/dismiss callbacks and asserts no authorize-store POST and no obsolete modal before passive reconciliation.

Final focused `codex t224 database confirmed metadata target34` native0,4files/34tests,7.81s, no skips (helper9+integration9+unchanged auth14+pure2). Final scoped63150 native0 on same frozen product/test source.
