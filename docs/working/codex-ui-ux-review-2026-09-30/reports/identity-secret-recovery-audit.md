# Identity and Secret UI recovery audit

Status: Complete; read-only findings frozen for supervisor review
Owner: runtime_contracts worker
Date: 2026-10-01

## Written brief

- Read only Core apps/web/src/features/programs/live-views identity/secret views and their owning helper/tests identified by rg; follow direct dependencies only when needed to establish request/mutation ownership.
- Read Current State of the parent UI/UX document. Existing clipboard consumer changes are verified and must remain intact.
- Inspect owner changes, captured handlers, authorization windows, pending mutation locks, acknowledgement versus refresh feedback, direct read retry and accessible selection. Record concrete source behavior and exact line/path evidence, distinguish untested browser hypotheses.
- Propose cohesive bounded implementation paths without copying generic ownership code into unrelated files. No actual secret data, runtime/storage/conversations/context-packet reads, source edits, broad checks, live/browser/provider/panel activity, commits or shared documents.
- Write findings progressively here and return prioritized defects, proposed exact file partitions, validation requirements and remaining uncertainties. This is an audit, not implementation authorization.

## Findings

Initial source-confirmed findings: both views retain local snapshots/dialogs/authorization across API or currentUser replacement and lack mounted/current-owner callback fences. Identity credential and TOTP confirmation use current selectedUser.id without storing the intended subject in the credential/enrollment state. Secret reveal stale/selection masking is passive, while reveal response can republish a captured draft without a dialog epoch. Normal modal close is deliberately disabled during operation busy by ModalContent, so pending-cancel races are retained-handler/programmatic/owner-replacement concerns rather than an ordinary enabled Cancel gesture. Both use a real synchronous OperationGate with finally release; duplicate-submit locking already exists and is not claimed defective. Detailed line evidence and bounded implementation partitions follow.


## Prioritized source-confirmed defects

### P1. Both privileged workspaces lack API/actor ownership fences

Identity identity-access.tsx:30?59 stores snapshot, modal drafts, credentials and TOTP material directly in the public component; its refresh dependency changes with api but no keyed child, render masking, mounted ref or request generation exists. Secret secret-keys.tsx:49?72 similarly retains snapshot, raw create value, authorization drafts and revealed value across api changes; automationApi ownership is also absent for the catalog. All mutation closures in Identity:72?180 and Secret:125?174 can issue through a captured obsolete API and commit their old response into the current component. An API object replacement (useProgramApi depends on domainId, program-api.ts:125?222) does not itself reset these local states; changing actual currentUser.id with the same API likewise preserves the prior actor's authorization and presentation. This is an observed frontend ownership defect, not a proven backend authorization bypass.

A revealed value can therefore remain rendered under a newly selected API/actor until later state changes, independent of any clipboard action. Proposed regression must inspect the first commit before passive cleanup, old callbacks before request, old completions/finally after replacement and all sensitive dialogs after actor replacement. Cosmetic displayName changes are not an identity boundary. Current configured-factor changes must revalidate/clear privileged proof state without inventing a new actor from a label. Keep original ClipboardButton semantics.

### P1. Identity credential and TOTP confirmation can retarget the intended subject

CredentialEdit at identity-access.tsx:15,44 contains no user id; beginCredential:177?180 sets only selectedUserId and empty credential state. saveCredential:121?129 posts selectedUser.id from the current filtered/reconciled list. If current selected subject disappears or selection reconciles while the dialog persists (for example an external owner/snapshot change), confirmation can use another user id while retaining the original credential draft. Profile/role/enabled/disable states already carry subject ids and should preserve that contract.

Enrollment starts with totpStart.userId in beginTotp:131?144, but successful setup stores only the returned material and operator factors; neither totpSetup:42 nor totpAuthorization:52 retains the bound subject. confirmTotp:152?159 posts current selectedUser.id and modal description:239 likewise derives the current selection. A setup begun for A can be presented as B and confirmed against B after selection changes. Ordinary pointer access to the underlying user list is prevented by the modal overlay; the concrete source race is owner/snapshot/retained callback replacement, not a claim that users can click through an intact modal. Backend consequences were not exercised or inspected.

Bind immutable subject id to credential and enrollment state, retain it through both enrollment calls and revalidate subject availability before POST. Close/invalidate presentation if subject disappears instead of falling back to another subject. Old submit and dismiss callbacks need dialog epoch guards; completion cannot clear a newly opened same-kind dialog. Verify creation, profile, role, enabled and disable preserve their existing subject-specific envelopes and last-admin protection.

### P1/P2. Secret reveal commits have no dialog/key-version lifetime guard

secret-keys.tsx:155?163 captures the reveal draft then unconditionally publishes success or reconstructed failure after await. Close/selection/version checks at:104?116 are passive effects; known stale content is not masked during render. Key removal/rotation and actor/API changes can produce an observable commit of prior raw value before those effects clear it. A retained/programmatic close during the pending request can later be undone by setReveal captured response; an old reveal's failure can reconstruct an obsolete dialog. Normal visible Cancel/Close and Escape are disabled while busy by ModalContent:32,45,77?79, so this is not reported as an enabled Cancel race.

Reveal owner should include workspace owner, dialog epoch, key id and confirmed key version; guard before request and after every await. Only validated string reveal payload may enter presentation. Clear authorization factors when no longer needed; existing30-second hiding remains and ClipboardButton is preserved. Apply stale/selection masking during render, and fence timeout callbacks to the precise revealed instance so an old timer cannot close a new epoch. Closing/hiding UI does not revoke data already copied to the clipboard or retroactively undo a server operation.

### P2. Read failure replaces confirmed UI and direct Retry is unguarded

Identity refresh:55?59 and Secret:68?72 replace the whole response state; any false response after an acknowledged mutation causes early unavailable return at Identity:185?186 or Secret:176?177. The mutation already records success and closes its dialog, but the user then sees only a read-unavailable screen, without the acknowledged-write receipt or retained confirmed metadata. There is no distinct stale read error alongside last confirmed same-owner state. Neither refresh validates minimal payload shapes used by map/filter/toLocaleLowerCase/vault access, and absent/malformed successful payload can look falsely empty or crash (Identity:60?67,224?228; Secret:92?96,181?199).

Manual and post-write refreshes have no component read generation or owner predicate; initial effect cleanup supplies an abort signal, but manual/post-write calls have none. A captured refresh can still call its former API. The coordinator may coalesce equivalent reads; no claim is made that every duplicate activation currently causes duplicate network requests. Meaningful tests require deferred response ownership and first-commit masking, not a textual AbortController count alone.

Normal network/JSON failures are already normalized by program-api.ts readResponse try/catch:160?203. Thus uncaught ordinary fetch rejection is not claimed. Unexpected custom API/coordinator rejection still lacks local catch here and OperationGate propagates it after releasing its lock; tests should distinguish defensive local recovery from existing transport normalization. Do not introduce shared transport edits or automatic retries/polling for these privileged panels.

### P2. Secret scope project read permits A/B/A stale completion and weak failure presentation

loadScopeProject at secret-keys.tsx:118?123 guards completion only by current.projectId === projectId. A?B?A requests allow the old A response to publish into the later A selection. API replacement, dialog dismissal/reopening and unmount have no captured-owner/epoch predicate, no AbortController, and old retained handlers can start reads. The project list generation also remains independent from the chosen project after catalog replacement.

Catalog initial read:73?89 checks controller abort but parses directory JSON without checking response.ok, assumes projects payload array members are usable and surfaces caught error.message. Per-project reads have no catch/finally for unexpected rejection, and successful malformed flows can throw in the updater or silently look empty. A catalog failure should provide fixed local retry feedback while preserving explicit project/scopeRef drafts; the current message has no direct catalog/project Retry. Proposed fixture: deferred A1, B2, A3 with A3 resolved first and A1 last; only A3 data remains, no new mutation or automatic field retargeting. Directory non-2xx and invalid rows must not announce successful empty catalogs.

## Existing protections and limits

- OperationGate (use-operation-lock.ts:16?31) sets activeOperation synchronously and clears it in finally; useOperationLock delegates to that same persistent gate. All named privileged mutations already use it. No duplicate-submit defect is claimed, and no second operation gate is needed.
- ModalContent consumes inherited busy unconditionally, disables its fieldset and close button, and rejects Escape while busy. Those safeguards stay intact; ordinary pending dialog dismissal is unavailable by design. Remaining retained callback/owner/epoch paths require view-level fences.
- Visible filtered selection uses reconcileVisibleSelection in both views; user/key detail buttons expose aria-current. Existing last-enabled-admin protection and Secret creation's deliberate no-2FA rule must remain. No generalized accessibility redesign is justified by this source audit alone.
- Existing identity-access.test.ts has3 pure/source-gate tests; secret-keys.test.ts has6 pure/source-gate tests. Secret-copy-feedback.test.tsx has4 meaningful mounted clipboard/expiry cases and must remain unchanged and passing. The audit did not run tests or browser interactions and inspected no actual secret/user state.

## Proposed exact implementation partitions

Release serial or independent file-partitioned view units; neither may change shared OperationGate, Modal/Menu, ClipboardButton, Program API, authorization/backend policy or protected runtime/storage/conversation files.

Identity unit: existing live-views/identity-access.tsx; new owning live-views/tests/identity-access-recovery.test.tsx and identity-subject-ownership.test.tsx; existing tests/identity-access.test.ts only if truthful source ownership changes require it. Responsibilities: render-owned API+actual actor scope, lifetime/request/dialog fences, subject-bound credential/enrollment, validated/caught explicit snapshot recovery, separate acknowledgement/read confirmation and fixed local refusal/retry feedback. Existing create/update/role/enabled/credential/TOTP wire envelopes, configured-factor UI policy and final-admin behavior preserved.

Secret unit phase1: existing live-views/secret-keys.tsx; new owning tests/secret-keys-recovery.test.tsx and secret-reveal-ownership.test.tsx; existing tests/secret-keys.test.ts only truthful source assertion changes. Responsibilities: API+automationAPI+actual actor ownership, workspace/dialog/captured mutation fences, validated snapshot/reveal response, render-time stale reveal masking and exact-instance30-second teardown, acknowledgement/read recovery and existing raw-value/authorization clearing boundaries. Existing copy test untouched. Preserve explicit drafts on current same-owner refusal; no raw backend exception/payload logs.

Secret scope-catalog phase2 is serial with phase1 because both integrate secret-keys.tsx. Exact proposed paths: that source plus new programs/secret-scope-catalog/{useSecretScopeCatalog.ts,index.ts,tests/useSecretScopeCatalog.test.tsx}. Extract only lazy catalog read lifecycle; keep secret values/grants/mutation/form ownership in the view. Owner includes relevant APIs and editor epoch; project request uses a monotonically increasing query epoch plus selected project. Validate minimal directory/project/flow shapes; abort obsolete reads, fixed errors, direct explicit Retry, preserve current project/scopeRef draft. No automatic mutation/retry, polling or generic coordinator.

Supervisor can combine Secret phases only if a single exact written brief owns those paths; do not dispatch two workers touching the view concurrently.

## Required verification and remaining uncertainties

Tests-first component reproductions using synthetic values and deferred APIs: actual API/actor replacement on first commit; captured old callbacks before requests; success/refusal/rejection after owner/dialog changes; pending teardown; credential/enrollment subject disappearance; no wrong-subject POST; same-kind dialog epochs; known reveal version/removal masking before passive effects; successful/failing reveal payload shape; original30-second expiry and clipboard4 unchanged; acknowledged mutation with subsequent snapshot failure preserves acknowledgement/confirmed data; malformed success versus empty; A/B/A project race; direct Retry produces no automatic mutation replay.

Use unchanged actual web type configuration for focused owning paths and heavy-wrapped narrow tests; supervisor owns broad web/type/build/structure gates. This report supplies source claims requiring reproduction before implementation, not browser certification. Backend enforcement, current runtime persistence and server enrollment lifecycle were deliberately not inspected. No invented server timeout, token policy, credential revocation or security bypass claim is authorized by these frontend findings.

## Validation ledger

2026-10-01: Read own written brief and parent Current State. Inspected exact two views, owning identity/secret/copy tests and directly needed frontend operation gate, Program API transport ownership, Modal/ModalContent and Menu/CurrentUser contracts. Initial wrong guessed helper extension/path reads failed harmlessly; rg identified actual .ts paths. No source/test edits, heavy/test/type/build/audit command, actual credentials, live/browser/provider/panel operations, protected paths, shared documents or commits.
