# t186 — Final high-risk gate review

Repository scope: current uncommitted integration trees in `F:\!FluxIQWebExtension`
and `F:\!FluxIQ`. Read-only review except this report; no source/shared-document edit,
build, test, browser, Lab run, commit, or push.

## Outcome

**One release blocker remains.** `delete` and `move_money` (including checkout,
purchase, charge, refund, and transfer) remain gated end to end. `send_or_publish`
does not: Core explicitly classifies it as ungated, and downstream tests require a
real “Send reply” click to proceed when no run or permission check exists. That
contradicts binding rule 2, which names sending and publishing among the real-world
consequences reserved for the high-risk gate.

This is not an unsupported-capability caveat. There is no dedicated “send” output,
but the supported generic `web.dom.click` authoring tool explicitly accepts
`send_or_publish`, and its test fixture clicks “Send reply.” Publishing uses the same
closed consequence class. Therefore the product can perform the consequence through
a supported action even though it has no specialized send/publish verb.

## End-to-end trace

### 1. Declaration and downstream dispatch

- The authoring/recovery press tool requires both `target` and `consequences`; the
  latter is a closed enum of Core's five consequence classes
  (`domain/src/runtime/llm-evidence/harness-options/options.ts:83-89`).
- `pressControl` calls `webActionPermission` before `actAndCapture`; a refusal becomes
  `permission_required` and the click does not execute
  (`domain/src/runtime/llm-evidence/press.ts:55-78`).
- With Core's check present, the complete declaration is handed across the boundary
  (`domain/src/runtime/llm-evidence/permission.ts:79-106`). With no check present, the
  domain uses Core's `automationStudioDestructiveConsequences` and refuses only the
  classes that helper returns (`permission.ts:89-101`).

This seam is structurally sound: the action cannot race ahead of the decision, invalid
classes are refused, and the domain does not independently weaken Core's classification.
The defect is the shared classification itself.

### 2. Core's retained gate

- Core's complete classification currently says
  `move_money: true`, `delete: true`, but `send_or_publish: false`
  (`runtime/action-permissions/destructive.ts:71-75`).
- The permission gate derives authority from the person's instruction, combines it
  with `permittedConsequences`, filters missing authority through that classification,
  raises a request, aborts the gated run, and records the full declaration
  (`runtime/action-permissions/gate.ts:249-280`). If instruction derivation fails it
  grants nothing (`gate.ts:284-302`).
- Where no run exists to raise a request, the default check applies the same
  classification and refuses the remaining high-risk classes with `requestId: null`
  (`gate.ts:315-334`).

For `delete` and `move_money`, this is fail-closed behavior: an explicit grant or a
matching active instruction authorizes the consequence; otherwise the action is not
taken and the missing class is named. For `send_or_publish`, the filter removes the
class before authority is considered, so a missing grant, missing instruction,
failed instruction derivation, or absent run cannot stop it.

### 3. Bootstrap, conversation ask, and release hold

- The service constructs one bootstrap permission gate from the execution grant's
  `permittedConsequences` plus the active instruction authority and hands its check to
  both exploration actions and planned Flow steps
  (`runtime/service.ts:1563` and
  `runtime/flow-bootstrap/action-permissions.ts:136-201`).
- A missing retained class raises one request; the build can put it to the person and
  recompute against the granted answer (`flow-bootstrap/action-permissions.ts:167-182`).
- The completed adaptation stores the declarations, instructed authority, cross-check,
  and request (`runtime/service/flow-bootstrap-commands/permission-outcome.ts:34-48`).
- A proposal carrying a request cannot be released unless the conversation store says
  that exact request was granted
  (`runtime/service/flow-bootstrap-commands/permission-hold.ts:18-35`).

This closes the bootstrap-to-runtime path for truthfully declared delete/money actions:
an unanswered refusal cannot become a replayable Flow. Removing blanket manifest/node
approval flags does not bypass this seam; the downstream manifest now retains only its
matching-confidence `level`, while output nodes set `privileged` and
`requiresOperatorApproval` false (`domain/src/io/manifest-definitions.ts:20-31`,
`domain/src/output-nodes/definitions.ts:183-200`).

### 4. Existing passing coverage

The current-state record says the complete Core suite passed 3,964 tests with one
intentional skip and the domain suite passed 847/847. The following focused coverage
is therefore present in those green suites:

- `action-permissions/tests/destructive.test.ts:140-204` proves unasked checkout
  (`move_money`) and deletion are withheld, raise the exact request, refuse when no
  run can ask, and proceed only with grant or instruction authority.
- `runtime/tests/service-bootstrap/tests/permission.test.ts:142-163` proves money is
  withheld before the press when only an ungated edit class is granted, and proceeds
  when `move_money` is granted.
- `runtime/tests/service-bootstrap/tests/permission-ask.test.ts:21-27,116-138` proves
  only `move_money` is asked about for a refund and the request reaches the person's
  conversation thread.
- `domain/src/runtime/llm-evidence/tests/press.test.ts:144-177` proves the domain calls
  the permission seam before each representative press and does not click on refusal;
  `:200-220` separately proves a no-run delete is refused.
- `domain/src/runtime/llm-evidence/tests/tool-rejection-detail.test.ts:190-208` proves
  the no-run refusal carries only the filtered high-risk classes and executes no click.
- `domain/src/tests/safety.test.ts:28-56` proves the removed blanket approval flags do
  not reappear on any web output.

The same suites also pin the blocker rather than merely omitting coverage:

- `action-permissions/tests/destructive.test.ts:78-90` requires the gated set to be
  exactly `["move_money", "delete"]` and explicitly excludes `send_or_publish`.
- `destructive.test.ts:94-137` requires sending to proceed with no grant even when
  instruction derivation fails or no run exists.
- `press.test.ts:212-220` requires “Send reply” to succeed with no permission check.
- `tool-rejection-detail.test.ts:195-208` requires delete to be refused but an otherwise
  identical `send_or_publish` click to execute.

## Unsupported versus allowed acts

- **Observe/read/wait/extract:** supported and correctly free; an observe effect is
  disregarded by the permission gate even if a model names a consequence.
- **Create and ordinary modification:** supported and intentionally free under rule 2;
  their declarations remain recorded and cross-checked rather than gated.
- **Delete and money/checkout:** supported and correctly gated as described above.
- **Send/publish:** no specialized output verb exists, but the consequence is supported
  through a generic press/click and is currently allowed. It cannot be described as
  “unsupported” to avoid the rule because the tool schema, execution path, and tests all
  model and execute it explicitly.

One limitation applies to every class: enforcement trusts the model-authored
`consequences` declaration. An action falsely declaring `[]` is recorded but is not
blocked by DOM wording or a second semantic classifier. That is the repository's
deliberate no-word-list architecture; the present release blocker does not depend on
challenging it, because a *truthfully declared* `send_or_publish` is affirmatively
allowed today.

## Required fix before release

Make `send_or_publish` a retained high-risk class at the single Core classification
seam (`destructive.ts`), while leaving `create_new` and `modify_existing` ungated and
leaving the downstream blanket approval flags removed. Then update the focused Core and
domain assertions above so that:

1. an instruction or explicit grant that authorizes sending/publishing permits it;
2. an unasked or no-run `send_or_publish` declaration raises/refuses before the click;
3. the request names only the missing high-risk portion of a mixed declaration; and
4. existing delete/money behavior remains unchanged.

Because both repositories import the shared helper, the production change is small;
the test updates are cross-repository and must land together. A dedicated publish label
is useful coverage but not a new mechanism—the closed class is shared with send.

## Validation limits

Read-only source/diff/test review only. I did not rerun any suite and rely on the
working document's observed full-suite results when calling the cited coverage passing.
No live checkout, payment, deletion, send, or publish action was attempted.

## Files changed

- Added only `docs/working/mvp-today-plan/reports/t186-high-risk-gate-final-review.md`.
