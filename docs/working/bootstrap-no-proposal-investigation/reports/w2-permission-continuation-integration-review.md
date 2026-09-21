# w2-permission-continuation-integration-review

Disposition: **block integration** until the permission request is bound to the
instruction and project for which it was produced, and the focused component
coverage pins the actual Cancel/reopen/confirm contract.

## Findings

### High: a retained permission request can authorize a different instruction or project

The permission request is retained independently of the task text. Editing the
Website task clears only the ordinary error and exploration phase
(`BlankFlowAuthoringPanel.tsx:207`); it does not clear `permissionRequest`.
Likewise, the reset effect keys only on `props.flow?.flowId`
(`BlankFlowAuthoringPanel.tsx:122-126`), although Flow identity is scoped by
project. A same-id Flow in another project therefore retains the old request.

The retained button remains available (`BlankFlowAuthoringPanel.tsx:212`), and
Allow passes the old request's `missing` set into a fresh exploration
(`BlankFlowAuthoringPanel.tsx:221-225`). That fresh exploration reads the
*current* `explorationRequest` and current textarea value, saves that current
instruction, and issues its grant with the stale consequence set
(`BlankFlowAuthoringPanel.tsx:142-167`). Thus a person can Cancel a request for
task A, edit to task B (or change projects while keeping the same Flow id), then
approve task A's consequences for task B. The granted list is byte-for-byte the
old `missing` list, but it is no longer an exact continuation of the request the
person reviewed. The save service updates the existing evidence-guided
instruction in place and preserves its `instructionId`
(`runtime/service.ts:3920-3942`), so comparing only the request's instruction id
would not repair this; the body/revision must also be bound.

Bind a pending request to at least project id, Flow id, and the normalized
instruction/request identity that produced it. Clear it when any of those
change, or revalidate that binding immediately before issuing the grant.

### Medium: consequence confirmation falsely asserts high-token confirmation

The consequence modal always calls `generate("explore", true,
permissionRequest.missing)` (`BlankFlowAuthoringPanel.tsx:225`). The `true`
causes the new grant request to contain `highTokenConfirmation: true`
(`BlankFlowAuthoringPanel.tsx:142,148-150,163-166`) even when the high-token
modal was never shown. Core treats this field as the explicit confirmation that
allows an above-threshold grant (`runtime/llm/execution-grants.ts:275-280`).

Today's website-exploration request is fixed at the threshold, so this does not
raise today's configured budget. It is nevertheless an invalid authorization
attestation and becomes a bypass if the second preflight's budget can exceed
the threshold. Track whether the high-token dialog was actually confirmed;
permission confirmation must not manufacture that fact. If the continuation's
new preflight newly requires high-token approval, show that modal and retain
the bounded consequence request through it.

### Medium: the committed focused test does not exercise the safety contract it claims

The sole added panel test opens a valid request and checks that equivalent prop
revalidation leaves the dialog visible
(`blank-flow-authoring.test.tsx:348-374`). It does not click Cancel, reopen the
request, click Allow, assert the exact `permittedConsequences`, assert that no
grant is issued on Cancel, exercise a malformed diagnostic, verify a real Flow
or project reset, or cover the interaction with high-token confirmation. This
is especially material because the lifecycle-independent live report explicitly
says the provider did **not** produce a permission request, so none of those
behaviors has provider-triggered browser evidence.

Add focused component coverage for the complete retained-request state machine
after fixing the stale binding. The downstream test at
`exploration.test.ts:148-150` does directly exercise the independent timer, but
the surrounding driver assertions at `exploration.test.ts:105-129` are source
regex checks and do not replace panel behavior coverage.

### Low: the browser-safety test is not a transitive export/closure invariant

The new barrel itself is currently narrow and browser-safe
(`action-permissions/client/index.ts:1-5`), and the package manifest exposes the
intended built path (`packages/fluxiq/package.json:14`). However, the test named
"exports only" merely imports the two expected values
(`client/tests/index.test.ts:22-25`); it would not detect an additional export.
Its dependency check scans only three hard-coded files
(`client/tests/index.test.ts:27-40`), so a future relative dependency added by
one of those files would not itself be traversed. This does not block the
current code, but the stated long-lived browser-safe invariant is weaker than
the report and architecture note imply.

## Invariants that survived review

- The wire parser is strict about exact object fields, schema version, bounded
  identifiers, ordered nonempty consequence lists, missing-as-subset, stage,
  authority, and plain bounded text (`action-permissions/request.ts:116-157`).
- With an unchanged request, the modal lists only parsed `missing` consequences
  and the grant payload copies exactly that list; no automatic permission is
  inferred (`BlankFlowAuthoringPanel.tsx:163-183,221-225`).
- Cancel hides rather than destroys the request, so the explicit reopen control
  is present; a real Flow-id change clears it (`BlankFlowAuthoringPanel.tsx:122-126,212,221-225`).
- Consuming the high-token modal closes it before a later consequence dialog can
  render behind it (`BlankFlowAuthoringPanel.tsx:148-150`).
- The public Core import replaces the former internal-source reach-through, and
  its present runtime closure is only `request.ts` plus `consequences.ts`.
- `settleObservedResponseText` uses `globalThis.setTimeout`, not a Playwright
  page timer, and clears its own deadline (`explore-proposal-ui.ts:241-254`).
  The live report accurately limits its claim to a durable unapplied proposal;
  it explicitly does not claim provider-triggered permission continuation.
- The isolated-panel report is appropriately operational and separate from the
  product unit. The reviewed status contains no unexpected source files:
  downstream changes are the driver, its focused test, working document, and
  reports; Core changes are the panel/test, public barrel/test, manifest, and
  package-boundary note.

No tests, live/browser/provider calls, panel/store operations, product edits,
commits, or pushes were performed during this review.
