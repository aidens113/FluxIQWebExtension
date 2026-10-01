# Secret UI recovery implementation

Status: Complete - exact seven source/test paths frozen for supervisor verification
Owner: recording_controls worker
Date: 2026-10-01

## Written brief (planning released; product held)

- Activity feed stays frozen. Read parent Current State and frozen identity-secret-recovery-audit.md; inspect only Core live-views/secret-keys.tsx and its owning pure/copy tests plus directly needed frontend type contracts.
- Exact proposed paths: live-views/secret-keys.tsx; owning tests/secret-keys-recovery.test.tsx and secret-reveal-ownership.test.tsx; existing tests/secret-keys.test.ts only truthful source-location assertions. Serial catalog extraction may be combined: secret-scope-catalog/{useSecretScopeCatalog.ts,index.ts,tests/useSecretScopeCatalog.test.tsx}. Existing secret-copy-feedback.test.tsx remains unchanged and passing.
- Design API+automationAPI+actual actor workspace ownership and render masking/layout teardown; captured mutation and exact dialog epochs; current-metadata reveal version/removal masking before passive effects; exact revealed-instance30-second expiry and fixed recovery feedback.
- Preserve OperationGate, busy Modal policy, authorization/create policy, wire envelopes, filtered selection and clipboard behavior. Distinguish write acknowledgement from failed follow-up reads; retain valid same-owner drafts on refusal. No secret/raw exception logging or automatic privileged polling/retry.
- Catalog extraction owns lazy directory/project/flow request lifecycle and direct Retry only; monotonically increasing project epoch must fence A/B/A. Validate used shapes, abort obsolete reads and preserve project/scope draft; no grant/mutation/form ownership in helper.
- Write implementation design/tests-first plan here; source/tests HELD throughout supervisor Core and extension gates. Supervisor explicitly releases after gates. Ask before extra helper path if budgets require it.
- No shared docs/helpers/styles/API/backend/protocol/protected runtime/storage/conversations/context-packet edits, actual credentials/activity, broad/live/browser/provider/panel operations, commits or pushes.

## Design / progress

Read parent Current State, frozen identity-secret-recovery-audit, current secret-keys.tsx, owning secret-keys.test.ts and unchanged secret-copy-feedback.test.tsx, frontend CurrentUser and direct public Secret types/contracts. Only source inspection; no product/test edits or validation execution. Activity feed remains frozen.

## Exact ownership after release

All product/test paths under Core apps/web/src/features/programs/:
1. live-views/secret-keys.tsx
2. live-views/tests/secret-keys-recovery.test.tsx (new)
3. live-views/tests/secret-reveal-ownership.test.tsx (new)
4. live-views/tests/secret-keys.test.ts (only truthful source-location assertions)
5. secret-scope-catalog/useSecretScopeCatalog.ts (new)
6. secret-scope-catalog/index.ts (new)
7. secret-scope-catalog/tests/useSecretScopeCatalog.test.tsx (new)

These are a single serial integration unit because the view owns both security presentation and catalog integration. No concurrent worker touches secret-keys.tsx. Existing secret-copy-feedback.test.tsx remains unchanged and required. No shared OperationGate, Modal, ClipboardButton, ProgramApi, frontend types, styles, backend, protocol or protected paths owned. If view budgets cannot be met through this catalog extraction alone, request exact additional helper ownership before implementation.

## Workspace and proof boundaries

Use private keyed workspace with actual owner tuple [secret API identity, automation API identity, currentUser.id]. Outer render owner ref rejects old callbacks before layout teardown; keyed child removes old raw values, forms, grants, filters and metadata on the first owner replacement commit. Cosmetic displayName changes preserve workspace. Factor requirements [pinConfigured, totpEnabled] are a distinct proof revision: invalidate sensitive authorization/reveal presentation and old proof callbacks synchronously when requirements change, without treating a cosmetic label as actor replacement or inventing backend authorization policy. Preserve non-sensitive draft metadata where safe and explicitly test that old captured factor handlers cannot restore obsolete proof.

Existing OperationGate remains sole synchronous mutation lock, with existing operation.run names and busy boundary. Every operation checks mounted/current owner and exact dialog epoch at entry (again inside gate), completion and state cleanup. Dialog generations increment on explicit opening, closing, replacing and factor invalidation; captured old close/change/submit handlers cannot close a newly opened same-kind dialog or republish an earlier response. Programmatic retained callbacks are modeled; ordinary visible Cancel/Close/Escape stay disabled during busy under real Modal policy. Already-issued server writes are not claimed cancellable.

Create authorization is part of one wizard epoch across form -> authorization -> Back; preserve intentional no-2FA requirement for creation. Other operations retain current PIN/TOTP policy and original envelopes. A refused current same-owner submit preserves valid form draft and offers explicit retry with fixed local feedback. Clear proof when successful or invalidated; do not restore captured raw values or factors into a newer dialog. Unexpected API rejection must resolve locally while OperationGate releases through its own finally; no duplicate gate or automatic privileged retry.

## Snapshot and acknowledgement channel

Implement view-owned abort/generation/coalescing for explicit snapshot reads, with render/mounted/owner fences and fixed error messages. Keep last validated same-owner metadata through failed follow-up reads; initial failure has direct read Retry. Validate actually consumed key fields before map/filter/upper-case/time/provider access: usable unique id, name, kind/scope enum, enabled boolean, finite timestamps and optional provider/scopeRef/description/model types. Valid keys[] is a real empty list; missing/malformed success is recovery error. No raw backend error or exception contents enter UI/logs.

Keep successful mutation receipt as persistent local role=status content independent of follow-up read error and confirmed snapshot. Real StatusText returns null/emits a global alert; it cannot establish persistent local acknowledgement. Tests must use actual status behavior and inspect local receipt explicitly rather than mock StatusText. Retry after acknowledged write invokes snapshot only, never the write. Failed refresh preserves filter/selection/form drafts, and no polling is introduced. Older reads cannot erase newer confirmed same-owner metadata or write receipt; handle exact ordering through generation/controller rules.

## Reveal lifetime

Reveal ownership includes workspace/proof revision, dialog epoch, captured key id, current confirmed version (updatedAtMs,lastRotatedAtMs) and exact revealed instance. Revalidate before dispatch and after awaited response; selection change/removal/version change masks raw value and ClipboardButton during render, before passive cleanup. Maintain a current metadata/selection ref for captured handlers and completion checks. A successful payload must contain a string value; malformed success is a fixed failure and cannot publish raw presentation. Public response contract also has key, but original unchanged clipboard fixtures provide only value; do not introduce an unconditional response.key requirement that breaks the existing tested minimal rendered shape. If key is present, validate identity/version information before using it; confirmed metadata remains the presentation owner.

Expiry is attached to the revealed instance identity, not just value string: two reveals of equal synthetic text still receive distinct lifetimes. Timer callback checks current epoch/instance before closing, so old timers cannot hide a fresh reveal. Preserve 30-second policy and ClipboardButton semantics. Clear proof after accepted reveal and closed/invalidation paths. Existing clipboard4 proves ack/denial/expiry behavior unchanged; UI hiding does not revoke copied data or a server operation.

## Catalog extraction boundary

useSecretScopeCatalog owns only lazy directory/projects and per-project flows read state: domains/projects/flows, selected project intent, separate catalog/project loading/error, direct retries and read controllers/generations. View keeps secret forms, scopeRef drafts, proof, dialogs, mutations and creation policy. Editor epoch represents actual wizard/edit instance; create wizard transitions may pause reads while retaining project draft for Back, not accidentally create a new editor intent. Closing/reopening or switching key invalidates prior epoch.

Directory fetch checks HTTP success before JSON parse and validates supported id/domainId and title/name/id fallbacks as strings; projects/flows validate array members and consumed ids/names. Failed or malformed reads show fixed feedback with direct Retry and preserve chosen project/scopeRef; no success-empty claim, coercion or retargeting. Use independent catalog/project controllers and monotonically increasing project generation, so A1 -> B2 -> A3 rejects A1 even when project id returns to A. Captured callbacks check current editor/owner before initiating reads. Obsolete responses/finally cannot overwrite current options, release a newer loading marker or cancel a newer controller. A catalog/project refresh must not silently alter explicit secret scopeRef. No grant/mutation/form ownership or automatic retry/polling in helper.

## Tests-first implementation sequence after release

1. Reproduce original owner replacement retaining revealed/form/proof state on first commit; stale old-submit/close handlers; reveal close/reopen same key; deferred key rotation/removal response; old reveal timer closing equal-valued new instance. Use only synthetic passwords/values and deferred APIs. Do not log them.
2. Reproduce A/B/A project sequence, editor close/reopen/API replacement, unexpected rejection and directory non-2xx/malformed rows. Only latest epoch options/loading/error publish; Retry issues reads only. Keep helper fixtures local in owning new test, no shared helper edits.
3. Implement private owner workspace and exact dialog/proof/reveal epochs without changing OperationGate or visible busy Modal policy. Extract catalog serially, then integrate direct catalog/project Retry and explicit read recovery. Preserve current filter/selection/provider/scope and envelope behavior.
4. Add all-operation old owner/dialog entry/completion/finally cases, factor revision with stable actor, cosmetic label stability, actual modal-busy policy, malformed snapshot/reveal success, valid empty index, refusal draft retention, acknowledgement followed by failed read and direct Retry without write replay.
5. Run new recovery/reveal/catalog suites plus unchanged secret-keys pure/source6, secret-copy-feedback4 and directly relevant operation gate tests through heavy wrapper. Existing catalog source-string assertions may truthfully move to the owned helper, retaining lazy API endpoint/project-select requirement. No weakened behavioral assertions or skips.
6. Actual unchanged web-tsconfig scoped checks for exact roots, owned diff review; freeze source/tests and report native counts/commands/limitations. Supervisor independently reviews and runs broad gates.

## Remaining limitations

All current observations are source-confirmed hypotheses awaiting original-source reproduction. No live modal/focus, credential authorization, backend revocation or server mutation behavior is certified. Current ownership is sufficient for planning; implementation may require supervisor-approved focused ownership helper if view remains over modularity budgets. No product/test edits, heavy/gate command, actual state, browser/provider/panel operation, shared-document changes, commits or pushes. Explicit source release remains required.

Implementation release received. Original secret view reproduction native1: 3/3 new reveal cases failed (actor replacement retained raw presentation, pending response reopened closed reveal, old same-kind close dismissed fresh dialog),2.04s. Separate actual view scope A/B/A reproduction native1,1/1failed,2.01s: oldest A reply replaced newest A choices. All fixture data synthetic; original product unchanged until these failures.

First implementation run observed new reveal3 + catalogview1 + unchanged clipboard4 passed. Two original source assertions failed after truthful relocation of catalog reads and common mutation wrapper; updating only these to require owning catalog endpoints/lazy Project UI and each existing mutation name through actual OperationGate. New view381lines, helper90; no extra paths needed.

Private workspace keyed by secretAPI,automationAPI,actual actor. Factor changes use separate numeric proof revision, mask existing proof/reveal dialogs synchronously and clear their state. Cosmetic labels preserve workspace. Local per-kind dialog instances guard close/change/submit; mutation wrapper retains original OperationGate and wire payloads, catches unexpected rejection and refuses stale owner/dialog/key requests. Reveal uses metadata version plus current filtered selection and exact instance/time; response.value string required, response.key optional but validated when present. Local persistent role=status receipt separate from retained confirmed snapshot/read Retry. No shared security/clipboard/modal/backend changes.

Catalog extraction validates HTTP and used row fields, has separate read/controller channels, monotonic project generation, direct retries, epoch masking and same-wizard project preservation across authorization/Back. Expanded local catalog20 regressions and existing suites queued through heavy under label `codex t224 secret catalog focused`, session49749. No broad gates or live activity.

Expanded catalogs and original suites passed34/native0/10.44s. Expanded ownership/receipt/form cases then passed74/native0/8.00s; first-commit Profiler actor/rotation observations plus stale read/dismiss/mutation cases passed80/native0/8.32s. Original copy4 and operation gate1 remain unchanged. Real shared StatusText is not mocked in new suites; local role=status acknowledgement remains through failed metadata reads and direct Retry. Synthetic local Modal/Menu mocking supports retained/programmatic callbacks; normal browser focus/modal behavior is not certified.

Initial strict scoped check found two new-test act return-type errors from returning vi.advanceTimersByTimeAsync() (Promise<VitestUtils>) rather than awaited void. Corrected only test callback bodies; no source/compiler/assertion relaxation. Final type rerun session47203 pending at this update.

Source review found removed non-reveal target could leave an enabled but silently inert editor after entry guard rejected missing key. New targeted reproduction native1,1failed/27excluded by test-name filter,1.89s; no intrinsic test skips added. Mask edit/rotate/delete presentation when confirmed target disappears and close exact captured dialogs with fixed local explanation, preserving valid same-owner refusal drafts and unchanged backend semantics. Final narrow now observed new reveal22/recovery28 passed; catalog/original suites still completing in session23015. Exact source stays under400lines; helper under100, no additional ownership needed.

Final boundary review: original captured Reveal submit could still issue a second privileged request after successful reveal, and its old authorization change callback could restore the prior proof form within the same dialog epoch. Targeted new regression native1,1failed/22excluded by test-name filter,1.95s; no intrinsic skips. Added exact current draft identity check at all privileged submit entries and authorization/form change publication, retaining epoch checks for same-dialog close/completion. Reveal expiry now verifies the exact revealed draft instance. This completes the existing captured-handler/reveal-instance brief; no further improvements after freeze.

Final narrow label `codex t224 secret frozen narrow` observed native0: **6 files/82 tests/82 pass/0 skipped,7.80s**. New owning suites: reveal23, recovery28, catalog20. Retained original suites: pure/source6, clipboard4, OperationGate1. Source-only catalog assertions follow extracted helper and all five original operation names still require actual OperationGate wrapper; pure behavioral assertions unchanged. Profile commit observers verify actor/confirmed-rotation masking on the first commit before passive stale-dialog effects. Local mutation acknowledgement tests inspect actual role=status content without mocking StatusText.

Final exact-seven strict scope label `codex t224 secret frozen scoped types` native0 with no diagnostics; external TEMP/codex-t224-secret-scoped.json extends actual unchanged web tsconfig, includes next-env and owned roots, incremental=false only avoids shared build-output collisions. No diagnostics omitted or compiler/config/baseline relaxation. Owned git diff --check native0; git diff --quiet on original secret-copy-feedback and OperationGate test paths native0. Final view393 lines, catalog74; all ownership within released seven paths and own report. Source frozen.

Implemented owner tuple API/automationAPI/actual actor, numeric configured-factor proof revision, mounted/render callbacks, per-kind dialog epoch plus current-draft identity, confirmed metadata/version/visible-selection reveal masks, optional validated response.key compatibility, explicit30-second revealed-instance expiry, fixed caught refusal/rejection feedback, last-good metadata retention/direct Retry and persistent local write receipt. Catalog remains lazy read-only with HTTP/shape checks, abortable independent channels and monotonic project/owner/editor generation; A/B/A stale results and finally cannot publish. Same-wizard Back preserves project/scope draft; explicit cancellation clears raw creation/proof state. Existing form/auth policy, gate, Modal busy policy, provider/filter selection and clipboard semantics remain intact.

Limitations: new mounted tests locally mock Modal/Menu to reach retained/programmatic callback paths; ordinary browser focus, popup behavior, real modal keyboard operation and server authorization/mutation consequences were not exercised. Existing busy policy source remains untouched. UI close/expiry does not revoke copied values or cancel already-issued operations. No actual credentials/state, private error logging, shared helper/docs/API/protocol/backend/storage/runtime edits, broad gates, browser/provider/panel operations, commits or pushes. Supervisor independently reviews/validates and integrates.
