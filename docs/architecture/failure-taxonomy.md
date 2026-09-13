# Web Automation Failure Taxonomy

Every way the browser path can report that an action did not work, and the
mechanism that keeps that list closed. Current-state design, verified against
source on 2026-09-13.

Core owns the failure *categories* (`AutomationStudioAdaptiveFailureClass`)
and the record shape; the producer owns the *code*. This repository's codes
live in one module,
[`domain/src/runtime/failure/codes.ts`](../../domain/src/runtime/failure/codes.ts),
which is also where each code is bound to the category, retryable flag and
stage it always carries.

## The Closed Set

`WEB_AUTOMATION_FAILURE_CODES` names fifteen codes. Read a code from that
object rather than writing its string: the key is what the plan, the scenario
manifests and the briefs call it, and the value is what Core stores.

| Name | Code | Category | Retryable | Stage |
| --- | --- | --- | --- | --- |
| `ACTION_REJECTED` | `web.action.rejected` | `blocked_by_capability_or_policy` | no | `execution` |
| `TARGET_NOT_FOUND` | `web.target.not_found` | `target_not_found` | yes | `target_resolution` |
| `TARGET_AMBIGUOUS` | `web.target.ambiguous` | `target_ambiguous` | no | `target_resolution` |
| `OUTPUT_NOT_OBSERVED` | `web.validation.output_not_observed` | `output_not_observed` | yes | `verification` |
| `STATE_MISMATCH` | `web.validation.state_mismatch` | `unexpected_state` | no | `verification` |
| `NAVIGATION_UNEXPECTED` | `web.navigation.unexpected` | `navigation_unexpected` | no | `confirmation` |
| `PAGE_CHANGED` | `web.page.changed` | `page_changed` | yes | `execution` |
| `TIMEOUT` | `web.action.timeout` | `timeout` | yes | `execution` |
| `AUTH_REQUIRED` | `web.auth.required` | `auth_required` | no | `confirmation` |
| `USER_INTERVENTION_REQUIRED` | `web.intervention.required` | `user_intervention_required` | no | `execution` |
| `UNSUPPORTED_TYPE` | `web.action.unsupported_type` | `blocked_by_capability_or_policy` | no | `dispatch` |
| `NOT_IMPLEMENTED` | `web.action.not_implemented` | `blocked_by_capability_or_policy` | no | `dispatch` |
| `INVALID_PARAMETER` | `web.action.invalid_parameter` | `graph_validation_or_unknown_node` | no | `dispatch` |
| `ACTION_FAILED` | `web.action.failed` | `action_failed` | yes | `execution` |
| `UNKNOWN` | `web.action.unknown` | `ambiguous_or_unknown` | no | `execution` |

The stage vocabulary, applied consistently: `target_resolution` while deciding
which element to act on; `dispatch` before anything ran, for a verb the client
will not run at all; `execution` while the action ran; `confirmation` while
confirming the action itself landed; `verification` while checking a
post-condition or an authored assertion.

`retryable` answers only Core's question — whether retrying the same action
unchanged can succeed without a person or a Flow edit. Core's parser forbids
six categories from ever being retryable —
`blocked_by_capability_or_policy`, `missing_router_or_subflow_target`,
`graph_validation_or_unknown_node`, `external_side_effect_denied`,
`auth_required` and `user_intervention_required` — so those rows have no
choice, and it also allows `target_not_found` and `target_ambiguous` to name
only the `target_resolution` stage. The rest are judged: a target that could
not be found may appear once the page settles, while an ambiguous one stays
ambiguous until the Flow says which it meant.

## Why The Binding Matters

Core's parser drops a record whole rather than repairing it, so a record
assembled by hand can contradict a consistency rule and vanish — losing the
failure instead of reporting it. A record built by
`webAutomationFailureRecord(code, comparison)` cannot: the category, the
retryable flag and the stage come from the table, and the caller decides only
which failure happened and what it can say about it.

That function also bounds what it is told. `expected` and `actual` are
collapsed to one line and cut to Core's own record limit (1,024 characters);
a description that collapses to nothing is dropped, because the parser rejects
an empty string and an unbounded one would take the whole record with it. An
`evidenceDigest` that is not a lowercase SHA-256 hex string is dropped for the
same reason — losing one optional field beats losing the failure.

## An Out-Of-Set Code Does Not Compile

Core declares `code` as a bare `string`, on purpose: it owns the categories
and the producer owns the vocabulary. So the set has to be re-established on
this side, and it is, by `WebAutomationFailureRecord` — Core's record with
`code` narrowed to the closed set, and still assignable to
`AutomationStudioFailureRecord` so nothing needing only Core's shape has to
know it exists.

Four places make that narrowing bite:

- **Every action result.** `WebAutomationActionResult["failure"]`
  ([`domain/src/actions/types.ts`](../../domain/src/actions/types.ts)) is the
  narrowed record, and the extension's `BrowserActionResult` is that same type
  with its own element and snapshot shapes bound in
  (`apps/extension/src/shared/protocol.ts`). A content-script verb, the
  background worker, the domain and a test all fail to compile on an invented
  code.
- **Every thrower.** A producer that already knows what failed attaches the
  record to what it throws and declares `WebAutomationFailureCarrier`
  (`runtime/failure/carrier.ts`); `TargetResolutionError` is the worked
  example. Declaring the type is what holds the field to the closed set at the
  throw.
- **Every builder call.** `webAutomationFailureRecord` takes
  `WebAutomationFailureCode`, so a string literal that is not in the set is a
  compile error at the call site.
- **Every boundary the compiler cannot span.** A record read off a thrown
  `unknown` (`carriedWebAutomationFailure`) or arriving over the WebSocket
  (`clientReportedFailure` in `domain/src/runtime/adapter.ts`) is rebuilt from
  its own code rather than trusted field by field, so a client one version
  behind cannot pair a code with a category that contradicts it. A code this
  domain does not name becomes `UNKNOWN` carrying the unrecognised code in
  `actual` — visible drift rather than a quiet degrade to "the action failed".

There is deliberately no `WebAutomationRuntimeError` class. One existed from
Wave 1 for this job and no producer ever used it; it was removed on
2026-09-12 in favour of the carried record, which says what was expected and
what was seen, needs no shared class identity across bundles, and is
compiler-checked at the throw.

## Who Produces What

- **Target resolution** (`content/action-runtime/resolve-target.ts`):
  `TARGET_NOT_FOUND`, `TARGET_AMBIGUOUS`. See
  [element identity](element-identity.md).
- **Result builders** (`content/action-runtime/results.ts`,
  `runtime/action-results.ts`): `OUTPUT_NOT_OBSERVED` for a failed
  post-condition, `STATE_MISMATCH` for a failed `web.dom.assert`,
  `ACTION_REJECTED` for a target the actionability gate refused, `TIMEOUT`
  for a wait or action that ran out of time, `NOT_IMPLEMENTED` for a
  registered verb that is not built, `AUTH_REQUIRED` where the page itself
  explains the failure better than the verb, and `UNKNOWN` as the last resort.
  `authGateFailure` decides `AUTH_REQUIRED` over the record every result
  carries, and needs both halves. The document must be a sign-in gate, meaning
  a rendered password control inside a form. And either the target the action
  named matches nothing, or a `web.dom.assert` URL claim that names a URL did
  not hold. The second shape is how a replayed click's recorded landing fails
  when an expired session leaves the browser on the gate. That record's
  `expected` is the Flow's claim and its `actual` is fixed words, never the
  address the page is at, which on a real sign-in page carries a return path
  or a token. A URL claim that names no URL is a malformed Flow and stays
  `STATE_MISMATCH`, as does a failed URL claim on a page with no gate.
  `content/actions/page-identity.ts` never replaces `AUTH_REQUIRED` with
  `PAGE_CHANGED`. A page that has a password form for another reason, such as
  sign-up or a password change, counts as a gate too.
- **Dispatch** (`domain/src/client/gateway-mapping.ts`, answered by
  `background/connection/gateway-session.ts`), decided before anything reaches
  the page and checked in this order:
  `UNSUPPORTED_TYPE` for an action type the client does not know;
  `USER_INTERVENTION_REQUIRED` for a command still asking for a value the run
  never supplied, whose record names the paths it wanted and never a value;
  and `INVALID_PARAMETER` for a field the action's schema requires that arrived
  in a shape the parameter reader (`client/gateway-action-parameters.ts`)
  refused. A refused optional field is only left unapplied. `INVALID_PARAMETER`
  names the action and the fields, never what was sent in them, and its
  category is `graph_validation_or_unknown_node` because the node is authored
  wrong: Core answers that with a structural edit, not a retry or a policy
  change. Each refusal goes back as a `failed` `client.action_result` carrying
  its record (`runtime/result-mapping.ts`).
- **The worker-side verbs**: `runtime/browser-tab.ts`
  (`TARGET_NOT_FOUND`, `ACTION_REJECTED`, `ACTION_FAILED`),
  `runtime/browser-download.ts` (`ACTION_REJECTED`, `TIMEOUT`),
  `runtime/action-runner.ts` (`ACTION_REJECTED` for an unsupported page,
  `TARGET_NOT_FOUND` for a tab that is gone), `runtime/frame-address.ts`
  (`TARGET_NOT_FOUND` for a command whose child-frame path matches no frame, and
  `TARGET_AMBIGUOUS` when several frames match and none has the recorded id),
  `runtime/command-router.ts`
  (`ACTION_FAILED`, through `browserActionFailure`, for an action whose send to
  the page threw; a `web.dom.assert` whose first send met a navigating page is
  sent once more before that, so only its second refusal is reported),
  `runtime/click-landing.ts`
  (`NAVIGATION_UNEXPECTED` for a replayed click whose own tab landed on a page
  the server answered with 400 or above), and `runtime/action-results.ts`
  (`NAVIGATION_UNEXPECTED`, the record every worker-side navigation check
  builds).
- **The expectation seam** (`domain/src/runtime/expectation/evaluate.ts`):
  `STATE_MISMATCH` and `TIMEOUT`, except where the client reported a code from
  the same set — it stood nearest the page and keeps its own record.

Two rows of the table have producers the list above names only in part, or not
at all.
`USER_INTERVENTION_REQUIRED` has three: `content/action-runtime/results.ts`
(`blockedByModal`), for a target refused as covered or inert while a page's
modal dialog stands over it, which is the condition the code was named for;
`domain/src/client/gateway-mapping.ts`, for a command still asking for a value
the run never supplied, refused before dispatch; and
`domain/src/runtime/adapter.ts`, when no single paired web-automation client
can be chosen for a state capture. `PAGE_CHANGED` has one:
`content/actions/page-identity.ts`, for a verb that failed while the document
it started against was replaced or routed away under it. Beyond the code
table's own tests they are covered by
`e2e/content/tests/modal-intervention.spec.ts`,
`client/tests/gateway-mapping.test.ts` and
`content/actions/tests/page-identity.test.ts`.

`ACTION_REJECTED` is one code, not a family: the capability's own reason
(`disabled`, `hidden`, `covered`, and the rest) is carried in the record's
`actual`, not in the code.

## When Nobody Named A Failure

`classifyWebAutomationFailure` (`runtime/failure/classify.ts`) is the single
classifier for the domain hop and the browser path, ordered by how much the
producer knew:

1. a failure the outcome already carries is returned unchanged;
2. otherwise a record carried on the thrown value, re-established on the set;
3. otherwise inferred from the outcome — `timed_out` becomes `TIMEOUT`; a
   failed validation becomes `STATE_MISMATCH` for `web.dom.assert` and
   `OUTPUT_NOT_OBSERVED` for everything else; a thrown error becomes
   `ACTION_FAILED`; a failed or unknown status with no message becomes
   `UNKNOWN`.

Two outcomes name no failure and the classifier returns nothing: an action
that succeeded with its post-condition intact, and a cancelled command, whose
meaning Core derives from the command status alone.

## Two Axes, Never Merged

The Testing Lab has a taxonomy of its own — `FailureCategory`, listed as
`failureCategories` in `packages/test-contracts/src/evaluation.ts` and raised
as `RunnerFailure` (`packages/test-runner/src/failure.ts`) — and it answers a
different question: why the *facility* could not produce a trustworthy run.
Its categories are dotted by area, such as `fixture.invalid`,
`environment.missing` and `gateway.pairing`. The codes on this page say how
the *automation* failed and travel on `RunEvaluation.automationFailureReported`
beside Core's category. A run whose gateway pairing failed has no automation
failure; a run whose automation reported `web.target.not_found` is a healthy
facility run.

A scenario manifest the contract rejects fails as `fixture.invalid`, whether
the Scenario Lab registry throws while it is imported or the runner's own check
refuses the manifest (`loadScenarioManifests` in
`packages/test-runner/src/scenarios.ts`). So does an unknown scenario id. It
is a facility failure, because a defective fixture says nothing about how the
automation behaves. The message names each issue's path and the validator's
wording, never a typed value or an expected record. A missing Scenario Lab
build is `environment.missing` instead, and any other error while loading the
registry is passed on unchanged.

## Comparison Text

`expected` and `actual` are descriptions in words, never raw page content,
credentials, or recorded data. On a control the sensitivity rule marks they
are withheld or replaced before they leave the browser and again before they
reach an attempt trace; see [sensitive values](sensitive-values.md).
