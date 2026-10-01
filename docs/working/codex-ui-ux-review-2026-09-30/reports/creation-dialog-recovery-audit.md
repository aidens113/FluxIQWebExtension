# Creation dialog recovery audit

Status: Complete — source-based bounded audit; no implementation or checks
Owner: deployment_docs_audit
Date: 2026-10-01

## Written brief and exact scope

Root released read-only actual project/flow/variable creation/edit dialog discovery, maximum five source/test reads. Own only this new downstream report. Preserve DataInspector/Tooltip/root CodeViewer and other product/test freezes; no protected backend/storage/conversation/coordinator implementation, private values, source/test/shared-doc edits, checks/broad/live/provider/panel/commits.

Read exactly five paired Core files: hierarchy/ProjectModal.tsx, hierarchy/AutomationHierarchyDialog.tsx, hierarchy/dialog-store.ts, hierarchy/dialog-transaction.ts and hierarchy/tests/interaction-contracts.test.ts. Filename discovery was bounded to automation-studio UI/dialog/test paths; no other implementation read. ProjectModal is a controlled presentation with an external submission owner; its controller was not read. No standalone variable dialog was established within this budget; variable/project controller recovery is not claimed audited. Concrete unexamined Flow/folder/reusable-part dialog gaps were sufficient to stop discovery and propose a bounded unit.

## Current architecture

AutomationHierarchyDialog subscribes to a dedicated external dialog store. Create uses type/details steps and keeps name, location and Flow preset in a typed transaction. Delete shares this surface but retains its current PIN-validation policy. `createAutomationHierarchyDialogTransaction` assigns a monotonically increasing transactionId. The store.request method publishes a new transaction, dispatch reduces the current one and close unconditionally publishes null. No method accepts a transaction ID, but the component/helper can compare getSnapshot before using these existing methods.

`submitAutomationHierarchyDialog` reads the current store snapshot, refuses status=submitting, creates an immutable validated submission, synchronously dispatches submit-started and awaits execute. ok closes the store; non-ok dispatches submit-failed. Neither outcome is associated with its original transactionId, and rejection is uncaught. The inspected interaction suite pins immutable transaction validation and PIN/create policy, not actual pending component/rejection/retirement behavior. No coordinator/execute implementation or backend contract was inspected; existing mutation/authorization behavior must be preserved.

## Ranked confirmed findings

### C1: Ordinary field edits bypass the submission duplicate lock

Trigger: enter a valid Flow name, submit while execute remains pending, then type in the name field or change location/preset. Those inputs are not disabled. Reducer set-name/set-parent/set-flow-origin unconditionally clears error and sets status=editing even when current.status=submitting. The Create button derives disabled from that status, so it becomes available; helper's duplicate guard also no longer sees submitting. A second explicit Create can execute while the first is outstanding. Delete PIN editing similarly resets status and can re-enable a pending delete; this is a transaction-lock gap, not a proposed PIN/authorization change.

The first submission remains an immutable validated snapshot, so this does not prove in-flight request payload mutation. It proves the pending status is not a durable lock under allowed edit events. Native disabled alone would not protect retained input callbacks or store.dispatch calls; the owning reducer must preserve the submitted state while pending. No synthetic test or live browser was run for this audit.

### C2: Pending completion can delete or contaminate a replacement draft

Trigger: submit A with deferred execute, then store.close and request B, and resolve A. The helper does not compare transactionId before result.ok -> store.close; B disappears, losing the newly entered draft. A non-ok instead dispatches submit-failed into B, adding a foreign error/status. Both schedules follow directly from the store's unconditional close/dispatch and helper's lack of ID check.

The actual Modal is rendered without busy/closeOnEscape submission policy, while Cancel/Back buttons alone are disabled. The previously reviewed Modal environment allows Escape closure by default. Thus pending hierarchy dialogs are not locally marked busy for the same contract used by other dialogs, and this surface itself does not guard onClose by current transaction/status. Escape delivery/parent ordering was not tested live, but helper replacement-clobber is valid independent of which caller closes or requests B.

The backend action may still succeed after UI retirement. Suppressing a stale UI close/error must not pretend to cancel the command or automatically repeat it. Acknowledgement after retirement must not be applied to an unrelated dialog.

### C3: Rejected execution leaves no local recovery and no truthful outcome feedback

Trigger: execute rejects after submit-started. There is no catch/finally, so the helper rejects without submit-failed; transaction remains submitting, error stays empty and buttons remain disabled until some editable-field event currently resets the status as in C1. This is not a draft-clearing-on-failure defect: draft values remain in the transaction, but the UI lacks stable local recovery. After C1 is fixed, a missing rejection handler would make the pending state reliably stuck.

A rejected mutation may have completed. Recovery must preserve the draft, release the lock with a fixed local uncertainty message and require a separate explicit user action after inspecting hierarchy state; never retry automatically or assert that no item was created. Returned non-ok is an execute contract result, not proof of transactional rollback; no backend/idempotency guarantee was established. Do not expose raw thrown errors or invent mutation cancellation.

### C4: Retained old UI handlers act on whichever transaction is currently open

Trigger: retain A's submit callback, close/request B, then invoke the retained callback. submit's closure calls the helper, which rereads getSnapshot rather than checking A's rendered transactionId; it can submit B using A's captured execute function. Retained type/name/location/preset/PIN callbacks likewise dispatch against the current store; retained Cancel/Modal onClose can close B. This is source-confirmed transaction retargeting. An actual API/project-owner replacement through the opaque execute callback was not traced, so this report does not claim a demonstrated cross-domain request or propose guarding owner by arbitrary callback function identity.

## No-change observations

ProjectModal preserves external controlled name/description on presentation rerender and marks Modal busy/closeOnEscape appropriately. Its inputs are not disabled while busy, but the owning external reducer/submission lifecycle was not read; do not infer its duplicate or lost-draft outcome. ProjectModal guards submit availability with trimmed content and preserves existing create-vs-delete PIN policy. It is outside the proposed hierarchy unit.

The hierarchy form's native textarea/select/input semantics must remain intact; this audit proposes no keyboard activation synthesis or shared Modal change. Current quick-submit behavior depends on shared Modal eligibility/submission markers and is not claimed broken without a focused actual component test. No overflow, layout, focus-return or browser behavior was measured.

## Exact cohesive implementation proposal

Release three Core paths and this own report only:

1. `apps/web/src/features/automation-studio/hierarchy/AutomationHierarchyDialog.tsx`.
2. `apps/web/src/features/automation-studio/hierarchy/dialog-transaction.ts`.
3. NEW `apps/web/src/features/automation-studio/hierarchy/tests/AutomationHierarchyDialog-recovery.test.tsx`.

Keep dialog-store.ts, ProjectModal, all existing tests/shared Modal and protected coordinator/execute/backend unchanged. The existing store API/transactionId is sufficient for a component-level bounded lease; no helper/barrel/API change is currently needed. If source release intends to cover project/API ownership behind execute, root must write a separate exact UI parent read brief without crossing the protected coordinator boundary. This proposal guarantees transaction/store/lifetime fences, not untraced owner semantics.

Implementation decisions to pin in the written release:

- Reducer ignores edit/step/PIN/resume events while submitting; only a correctly owned completion can release status. The helper's current synchronous submit-started remains the shared store duplicate lock. Disable form fields/type/back/cancel during pending and pass Modal busy/closeOnEscape state consistently. Do not change deletion PIN requirements or capability checks.
- Component callbacks capture rendered transactionId/store and require current component lifetime/current store/ID before dispatching/submitting/closing. Use latest current execute only after that intrinsic transaction fence; ordinary callback JSX identity is not an owner lease. Guard retained input, type, close and submit callbacks, not only disabled buttons. A keyed per-transaction inner surface is possible, but still needs fences before passive cleanup/current-store replacement.
- Extend the exported helper compatibly with an optional expected-transaction context/ID for component invocation, or use an equally bounded same-file private wrapper; preserve existing two-argument callers. Helper captures immutable validated submission and original ID, dispatches submit-started, then rechecks ID/status before execute in case a subscriber replaced the dialog synchronously. Its post-await success/failure/rejection applies only while the same original ID remains submitting. Never close/update a replacement or publish a failed error into null.
- Catch rejection/malformed results locally with fixed uncertainty feedback and draft preservation. No automatic replay, command cancellation, hidden second submission or claim of backend rollback. Use existing returned non-ok contract thoughtfully; root must decide safe message compatibility without reading protected implementations here.
- Preserve stable name/location/preset draft on current failures and allow an explicit editing/resubmission decision afterward. Existing validation errors and trimmed immutable submission policy remain; do not silently clear or reset the draft on failure.

## Meaningful tests-first matrix

Use actual typed store, transaction reducer/helper and mounted AutomationHierarchyDialog with synthetic hierarchy nodes, typed execute spy/deferred results and a typed Modal fixture only where needed. Do not mock the reducer/store/subject, weaken old assertions or add a tracked test API. No real backend/providers/private payloads.

1. Valid create held pending, ordinary name/location/preset and retained edit events: submitted draft and status stay frozen; repeated submit executes once. Resolve/refuse then explicit current edit/resubmit works, preserving draft and immutable first payload.
2. Rejected create and malformed result: busy releases, draft remains, fixed uncertainty feedback appears, no unhandled rejection and no automatic extra execute. Local validation remains deterministic and all original PIN/create assertions pass.
3. A pending -> close/request B -> A success/non-ok/rejection: B's values/status survive unchanged; no foreign close/error. Include A-B-A IDs, close to null and synchronous replacement during submit-started subscription before execute.
4. Retained A name/type/parent/preset/PIN/submit/Cancel/Modal close callbacks after B/store replacement or component unmount: no retargeting, dispatch, close or execute. Ordinary same-current-transaction rerenders/execute prop updates continue to operate through the latest valid function without remount-by-function-identity.
5. Actual pending Modal props expose busy/closeOnEscape and disabled native inputs/actions. A direct retained busy close cannot discard the current pending draft; accepted current idle cancel still closes. This checks owning policy, not synthetic browser Escape ordering.
6. Existing delete uses unchanged PIN/capability rules, immutable submitted credentials and duplicate/pending fences. Source shared contract cannot be relaxed to make tests pass.

After explicit release, run new suite tests-first and record observed failures, then narrow new plus existing hierarchy interaction/phase contract suites authorized by root; actual-config scoped strict roots and whitespace/module budgets, freeze for independent review. No such command ran now. Parent owns additional owning-suite discovery/release; this worker did not read a sixth file to claim coverage absent in unseen tests.

## Return and limitations

Only this report changed. Five-file budget honored, no source/tests/checks/protected/private/live/provider/panel/commits. C1–C4 are concrete source-confirmed sequences around the actual Flow/folder/reusable-part dialog. Actual command rejection likelihood, mutation outcome/idempotency, backend authorization, project/API owner wiring, variable dialog behavior and browser keyboard/event ordering remain unverified. Root owns exact further release and independent verification; prior DataInspector/Tooltip/CodeViewer freezes preserved.
