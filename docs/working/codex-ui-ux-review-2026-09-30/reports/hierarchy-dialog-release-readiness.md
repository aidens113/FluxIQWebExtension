# Hierarchy dialog release readiness

Status: Complete — bounded read-only contract refinement; source/test release held
Owner: deployment_docs_audit
Date: 2026-10-01

## Written brief and read boundary

Root froze all Core source for active full31117/structure46579 gates and requested an exact read-only refinement of the creation audit. Own only this report. Existing AutomationHierarchyDialog.tsx, dialog-transaction.ts and dialog-store.ts facts remain available from the immediately preceding five-file audit; no need to reread protected history. Read only the actual caller's hierarchy props/wiring region in `live/components/AutomationStudioConnectedRegions.tsx` as the fourth file. A candidate-sidebar reference search had no dialog call-site hit and did not become another source read. No new shared Modal implementation/test read was required; its busy contract was established in earlier independently reviewed work and the local close guard below does not depend on listener order.

No source/tests/checks/shared docs/protected coordinator/backend/storage/conversation/private/browser/provider/panel/commits were changed/read/run. DataInspector/Tooltip/root CodeViewer remain frozen.

## Actual execute-owner contract

`AutomationStudioConnectedHierarchy` declares dialog.execute and dialog.store through ComponentProps<typeof AutomationHierarchyDialog>, and forwards those values plus hierarchy nodes directly. No API, project, actor, workspace generation or authorization token appears in this passed dialog contract. This read did not trace the creation of that props.dialog object or inspect any protected controller/execute implementation.

Therefore **execute function identity is not a true owner field**. Ordinary parent renders may replace a callback while the store/transaction remains valid. Retiring a valid pending operation solely because execute changed would discard acknowledgement and leave its transaction submitting. Conversely, a true backend owner change hidden behind an opaque execute callback cannot be inferred or guaranteed safe from this component interface. The bounded unit may guarantee intrinsic store/transaction/new-handler lifetime safety, not untraced cross-domain ownership. Adding that owner field requires a separate exact caller contract release.

Use the latest rendered execute for a new valid user submission; freeze the chosen function and immutable validated transaction once issued. A callback update while pending must neither execute again nor revoke the issued completion's intrinsic transaction ownership.

## Important refinement: new-handler lease versus issued-operation lease

The prior audit correctly requires transaction fences, but an over-broad post-await **UI** lifetime/store-generation fence can orphan external state: store A has pending transaction1, the component displays store B, then displays the same store A before the first operation settles. If that issued result is discarded only because its old UI generation retired, A.transaction1 may remain submitting forever.

Recommended exact policy for root's written implementation release:

1. **Before dispatch**, component callbacks require current mounted lifetime, captured store-generation and rendered transactionId. Retained old callbacks never initiate/retarget a request or edit/close another dialog, including A-B-A store replacement with the original store object.
2. **After dispatch**, helper completion may settle **its captured external store only**, and only when that store's current transactionId still matches the original issued ID and status remains submitting. UI visibility, unmount and ordinary execute callback replacement do not cancel a valid issued store operation. A different visible store is not touched; a newly requested transaction in the same store is not touched. Completion into a still-owned captured store can close it on acknowledged success or preserve its draft with failure/uncertainty.
3. If intrinsic captured-store ID/status has retired, return the actual declared result (or fixed uncertainty on rejected/malformed execution) without any store publication. Never claim cancellation/rollback or silently replay the mutation.

This recommendation separates new UI work from settling an issued operation. Root must make that policy explicit before source release; it supersedes any interpretation of the rough creation audit that applies an unmount-only fence to all external-store completion. No separate helper/API file is needed. A stricter true API/project owner fence needs an explicit owner contract, not callback-equality heuristics.

## Exact three-path implementation algorithm

Release only hierarchy/AutomationHierarchyDialog.tsx, hierarchy/dialog-transaction.ts and NEW hierarchy/tests/AutomationHierarchyDialog-recovery.test.tsx, plus this worker's own report. Store, caller, ProjectModal, shared Modal, capability/PIN policy, protected execute/controller and existing tests remain unchanged.

### 1. Reducer pending status is a real lock

At reduceAutomationHierarchyDialogTransaction entry, when current.status=submitting reject all editing/type/step/preset/parent/PIN/resume-editing events. Completion submit-failed remains available to the helper only after its captured-ID/status checks. Repeated submit-started is a no-op. Preserve current immutable draft, trimmed validated submitted name, initial type/details behavior and deletion PIN validation. Do not reset draft/credentials on a returned failure.

The shared store's synchronous submit-started is sufficient for duplicate submission in the current transaction once editing cannot clear it. Do not add a global mutation queue or modify protected command authorization.

### 2. Component render/lifetime fences

Keep hooks unconditional before transaction-null return. Maintain mounted ref and render-updated current props; renew a monotonically increasing **store generation** when props.store reference changes, never when execute/nodes/ordinary JSX callbacks change. Each rendered handler captures store generation and transactionId, and checks actual latest store/current snapshot before dispatching or closing. This rejects first-A handlers after A-B-A even if A's old transaction object still exists.

Name/type/parent/preset/PIN/Back handlers require current transaction and not submitting. Submit additionally captures latest rendered execute after passing those checks. Modal close and Cancel require current transaction and idle. Retained handler assertions must test side effects, not disabled attributes alone. Current same-transaction callback updates should use fresh execute, never a stale captured function from an old render.

Render busy/closeOnEscape from status=submitting, and disable all editable fields, type controls and Back/Cancel/submit appropriately. Local pending close guard remains necessary because direct retained callbacks can bypass native disabled controls; it does not change shared overlay environment/native Escape ordering. Same-current-transaction initial focus/default Enter/select behavior remains native; no synthetic activation or auth-policy change.

### 3. Exported submit helper preserves two-argument callers

Keep current exported helper return type `{ ok: boolean; error?: string }` and existing two-argument call compatibility. An optional third dispatch context can hold expected transactionId and `canDispatch()` callback from the component. Existing direct two-argument callers get intrinsic store/transaction semantics without inventing a component owner.

- Read snapshot; reject null/submitting and optional expected-ID/canDispatch mismatch **without publishing into a replacement**.
- Validate through existing automationHierarchyDialogSubmission; deterministic local validation errors apply only to the still-current transaction. Capture its immutable submitted data, ID and execute function.
- Dispatch submit-started synchronously, then recheck captured store ID/status and optional canDispatch before executing. A subscriber can replace the transaction or visible store during that dispatch. If replaced before issue, return a fixed retired-action result without execute or replacement mutation. If UI retirement alone leaves the same transaction newly submitting before issue, release only that captured transaction with truthful not-submitted local feedback rather than leaving it busy; root should pin this pre-issue rollback decision in its tests.
- Once execute is called, do not recheck callback identity/UI generation for completion. Await the frozen function, settle only the captured store's original submitting transaction, and return the declared result without retargeting.
- Catch rejection and malformed result without unhandled Promise errors; store a fixed local message such as “This action was not confirmed. It may have completed. Check the hierarchy before submitting again.” Keep the draft, status failed and no automatic execute retry. A returned `ok:false` remains the declared execute result; preserve an existing meaningful declared error where compatible, but do not interpret it as rollback. A missing/invalid error/result uses uncertainty rather than claiming no item was created. Never expose raw thrown messages.

The pre-issue retirement feedback differs from post-issue uncertainty: the former has not called execute and can truthfully say it was not submitted; the latter cannot establish mutation outcome. Neither path closes a replacement or changes PIN/capability policy.

## Tests-first release matrix

Use actual store/reducer/helper and mounted dialog with typed synthetic nodes and deferred execute. A typed Modal replacement may expose actual busy/onClose/closeOnEscape props; keep actual fields/button/subject. Existing interaction/phase/deletion policy assertions stay unchanged and root must name any additional owning suite paths in its implementation brief.

- Frozen current pending edits and duplicate submit: ordinary name/location/preset/PIN and retained callbacks cannot unlock or alter sent data; only one execute; failure preserves draft for later explicit edit/submission.
- Captured ID A pending, same-store request B, A success/non-ok/rejection: B remains unchanged; no foreign close/error. Include null close, monotonic new-A ID, and synchronous transaction replacement during submit-started before execute.
- Component store A-B-A: old handlers cannot submit/edit/close; the already issued A operation can settle its still-owned captured A transaction, without changing B or duplicating execution. Unmount forbids new callbacks but still permits issued result to settle captured unchanged external store.
- Ordinary execute prop replacement before dispatch uses latest function; replacement while pending does not replay or orphan the issued action. After a failure, explicit current retry uses the latest function and a new explicit request. Do not assert ordinary function identity is a security owner.
- Pre-issue UI/store retirement while subscriber runs: no execute, only original unchanged submitting transaction may receive not-submitted recovery; replacement never receives failure.
- Rejection/malformed result: no unhandled errors, fixed local uncertainty, status releases, draft stays, no raw thrown text/automatic replay. Return false meaningful execute error behavior remains compatible and not presented as rollback.
- Busy Modal and disabled native controls; retained pending close does nothing, current idle cancel works, existing delete PIN requirement and immutable credentials remain.

After an explicit release, test unchanged source first, observe actual failures, implement exact paths, run authorized new+unchanged owning suites, actual-config strict roots and whitespace/module checks, then freeze. No checks ran for this refinement. Browser event delivery, real execution outcome and true backend/actor owner wiring remain unverified.

## Readiness return

The exact three-path transaction/store/lifetime unit is executable after root explicitly accepts the recommended issued-operation settlement policy and pre-issue retirement feedback. No additional source/helper/store/API path is required for that scope. A true backend-owner contract behind execute is absent from the inspected interface and remains a separate dependency; this audit does not use that unknown as a reason to change protected code or silently invalidate ordinary callbacks.
