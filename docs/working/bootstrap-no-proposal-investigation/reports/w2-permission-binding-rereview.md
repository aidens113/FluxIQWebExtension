# w2-permission-binding-rereview

Disposition: **block integration**. The remediation closes the prior findings
for synchronous state changes and ordinary continuations, but one async
preflight ordering hole can still turn a stale continuation into a high-token
confirmation for a different current request.

## Remaining finding

### High: stale continuation is checked after the newly-required high-token branch

`generate` correctly validates a continuation against the captured request and
current ref before starting (`BlankFlowAuthoringPanel.tsx:161-171`). It then
awaits instruction save and preflight (`:179-185`). After those async boundaries,
however, it opens the newly-required high-token modal at `:186` **before** the
stale-context check at `:187-193`.

If the project or Flow changes while that continuation preflight is pending,
the identity effect clears `permissionContinuation` (`:141-145`), but the old
async call can subsequently resolve high-token and set `open` from its stale
closure. The modal's Continue handler reads the now-current state; because the
continuation was cleared, it calls `generate(pendingMode, true, undefined)`
(`:253-257`). That starts the new current-context exploration with
`highTokenConfirmation: true`, even though the modal limits came from the old
request. The consequence grant is not leaked, but the high-token attestation is
misbound across request identity.

Move the post-await continuation/context validation immediately after the
preflight success check and before inspecting or presenting its high-token
limits. Add a deferred-preflight test that changes project or Flow before the
old preflight resolves high-token, then proves no stale modal and no grant.

The current newly-required test (`blank-flow-authoring.test.tsx:440-459`) keeps
the context unchanged throughout, so it cannot detect this ordering bug.

## Prior findings re-evaluated

### Prior high: retained permission could authorize another instruction/project

**Closed for synchronous changes; async high-token branch remains open as
described above.** Pending state now carries project, Flow and normalized body
(`BlankFlowAuthoringPanel.tsx:11-27,116-121`). Task edits clear it when the
normalized body changes (`:245`), project/Flow changes clear it (`:141-145`),
and ordinary post-preflight grant issuance rechecks the current ref before
copying exact `request.missing` (`:187-202`). Equivalent revalidation retains
the same bound object.

Tests now cover task, project and Flow invalidation (`blank-flow-authoring.test.tsx:402-420`) and equivalent revalidation before exact issuance (`:375-400`).

### Prior medium: consequence approval manufactured high-token confirmation

**Closed on the direct paths.** Allow calls `generate` with `false` and the
bound continuation (`BlankFlowAuthoringPanel.tsx:259-263`). The effective flag
is true only for an explicit current click or a continuation that recorded an
earlier explicit confirmation (`:172`), and the grant conditionally includes
the field (`:197-202`). Tests assert its absence after an ordinary consequence
confirmation (`blank-flow-authoring.test.tsx:375-399`), preservation after a
real earlier high-token confirmation (`:422-438`), and the explicit newly
required transition (`:440-459`). The remaining async finding is a separate
request-binding failure in that transition, not the former unconditional flag.

### Prior medium: safety state machine lacked focused coverage

**Substantially closed.** The focused tests now cover strict malformed-request
refusal (`blank-flow-authoring.test.tsx:364-373`), Cancel without grant or
proposal callback, retained reopen, exact missing consequence issuance and no
manufactured token flag (`:375-400`), task/project/Flow invalidation
(`:402-420`), prior truthful high-token state (`:422-438`), and a newly-required
high-token transition (`:440-459`). The remaining omission is specifically a
context change while an awaited continuation preflight is unresolved.

## Surviving behavior

- Parsed `missing` remains the sole consequence list copied into the continued
  grant (`BlankFlowAuthoringPanel.tsx:197-202,259-263`).
- Cancel only hides the consequence modal and retains an explicitly reopenable
  request; it does not issue a grant (`:250,259-263`).
- Malformed permission payloads never establish pending permission state
  (`:210-225`).
- A permission response arriving after the context changed is rejected before
  being stored (`:215-223`).
- The public browser-safe export and downstream lifecycle-independent response
  timer are outside the final two-file remediation and remain unchanged. The
  provider-triggered permission journey remains accurately reported as a live
  gap.

No code or test edits, test runs, live/browser/provider calls, panel/store
operations, commits, pushes, or other git actions were performed.
