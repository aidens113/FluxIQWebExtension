# w2-permission-post-preflight-rereview

Disposition: **integrate**. The prior async authorization blocker is closed in
the reviewed Core panel and focused test diff. I found no remaining
correctness or security blocker in this permission-continuation scope.

## Prior blocker disposition

The continuation is checked against the current project, Flow, and normalized
instruction both before work begins (`BlankFlowAuthoringPanel.tsx:161-171`)
and immediately after the awaited instruction-save/preflight boundary
(`:179-193`). The post-await check now precedes both the newly-required
high-token branch (`:194`) and grant issuance (`:199-204`). A stale continuation
therefore cannot populate/open the high-token modal or issue its consequence
grant.

The deferred-preflight test exercises the actual ordering rather than merely
asserting source shape (`blank-flow-authoring.test.tsx:422-451`): it starts a
permission continuation, holds its third preflight unresolved, changes project
or Flow while keeping the other identity dimension stable, then resolves the
old preflight with high-token limits. It asserts no high-token modal, no grant,
no reopenable stale request, and the explicit restart message (`:443-450`).
Those assertions would fail with the previously reviewed ordering.

## Continuation regression review

- Pending state remains bound to project, Flow, and normalized task body
  (`BlankFlowAuthoringPanel.tsx:11-27,116-121`). Project/Flow effects clear it
  (`:141-145`), task edits clear it when normalized content changes (`:247`),
  and equivalent revalidation does not discard it.
- Cancel remains non-authorizing and reopenable. The focused test clears the
  prior grant calls, clicks Cancel, asserts no grant or proposal callback, then
  reopens and continues (`blank-flow-authoring.test.tsx:375-400`).
- Grant continuation copies only the strictly parsed request's `missing`
  consequences (`BlankFlowAuthoringPanel.tsx:199-204,261-265`); the test pins
  exactly `permittedConsequences: ["modify_existing"]`
  (`blank-flow-authoring.test.tsx:396-399`).
- Ordinary consequence approval does not manufacture high-token confirmation:
  Allow passes `false`, and the effective flag comes only from an explicit
  current confirmation or a continuation that recorded one
  (`BlankFlowAuthoringPanel.tsx:172,199-204,261-265`). The ordinary test asserts
  the field is absent (`blank-flow-authoring.test.tsx:397-398`).
- An already-confirmed high-token continuation retains the truthful flag
  (`blank-flow-authoring.test.tsx:453-469`). A continuation that newly becomes
  high-token opens the confirmation without issuing a grant, then issues exact
  consequences only after the explicit confirmation (`:471-490`).
- A permission response returning after its request context changed is still
  rejected before being retained (`BlankFlowAuthoringPanel.tsx:217-225`).
- Strict malformed-request refusal and synchronous task/project/Flow reset
  coverage remain present (`blank-flow-authoring.test.tsx:364-373,402-420`).

## Evidence qualification

The remediation report's described code ordering and test scenarios match the
current diff. Its reported `25/25`, type-check, and diff-check results were not
rerun in this read-only review. The provider-triggered permission journey also
remains an explicitly documented live gap; this disposition concerns the
deterministic state machine and does not upgrade that live claim.

No code or test edits, test runs, live/browser/provider calls, panel/store
operations, commits, pushes, or other git actions were performed.
