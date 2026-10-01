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

`WEB_AUTOMATION_FAILURE_CODES` names nineteen codes. Read a code from that
object rather than writing its string: the key is the name source code and
this page use, and the value is the code Core stores and a scenario manifest's
expected failure names.

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
| `BLOCKED_BY_DIALOG` | `web.action.blocked_by_dialog` | `unexpected_state` | no | `execution` |
| `RATE_LIMITED` | `web.action.rate_limited` | `action_failed` | yes | `execution` |
| `BROWSER_PERMISSION_DENIED` | `web.browser.permission_denied` | `blocked_by_capability_or_policy` | no | `dispatch` |
| `TRANSPORT_TRANSIENT` | `web.transport.transient` | `action_failed` | yes | `execution` |
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

That flag does not by itself authorize a browser replay. Two layers apply
side-effect safety. The page-side content recovery loop retries a mutating
action only for a pre-dispatch `TARGET_NOT_FOUND`; read-only actions may retry
the browser-retryable faults that reach that loop. `TRANSPORT_TRANSIENT` is
instead classified by the background worker before the verb is reached, so the
content loop does not see it in practice. When that failure reaches Core, the
defensive executor treats its outcome as ambiguous and replays a mutating node
only when the node positively says repetition is safe; read-only work may be
repeated. `BLOCKED_BY_DIALOG` is a stable page state that needs a different
action, not a retry. `BROWSER_PERMISSION_DENIED` is a browser capability/policy
refusal that must be resolved before dispatch, unlike `ACTION_REJECTED`, which
is the actionability decision about a particular target on a drivable page.

`RATE_LIMITED` is the one row that states the act did not happen: its record
carries `effect: "unacted"`, a field Core's record gained for it. The click verb
reports it when a press that is not a link opens a notice whose own words say
the page refused it for going too fast
(`apps/extension/src/content/action-runtime/rate-limit-notice.ts`), and the
record also carries the wait the notice named, plus half a second and held to a
minute, as `retryAfterMs`. The page-side loop never retries it, because the wait
outlasts its five-second budget; Core's defensive executor reads `unacted` as
licence to repeat even a mutating node and waits the hinted time first, bounded
by its own 30-second per-wait cap. The notice's OK is pressed by the
interference defence only on a layer whose text is such a notice; its "Try
again" is never pressed. A navigation reports it too, when the page it landed on
was served HTTP 429 or 503 and is not a robot check (job-board and the
everything store serve their rate-limit page as a document): the worker tells
the origin's page-load pace, and `retryAfterMs` is the wait that pace now
imposes on the origin's next load (`apps/extension/src/runtime/action-runner.ts`,
`runtime/rate-limited-landing.ts`, `runtime/served-status.ts`). So does a click
whose own tab lands on such a page (`runtime/click-landing.ts`), through the
same `rate-limited-landing.ts`; the worker then takes the tab back
(`chrome.tabs.goBack`) to the page the click was pressed on, because Core's
repeat re-sends the same command and the refusal page holds nothing it can
press. The back landing is judged by its address against the one the tab showed
before the click and by its served status, and `actual` says whether the tab
was returned, and if not why, beside the status, the landed path without its
query and the wait.

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

There is deliberately no shared error class for this. The carried record takes
its place: it says what was expected and what was seen, needs no shared class
identity across bundles, and is compiler-checked at the throw.

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
  `TARGET_NOT_FOUND` for a tab that is gone, `RATE_LIMITED` for a navigation
  whose landed page the server answered with 429 or 503, with the wait the
  worker's page-load pace now imposes on that origin as `retryAfterMs`
  (`runtime/rate-limited-landing.ts`), and
  `NAVIGATION_UNEXPECTED` for one answered with any other status of 400 or
  above, both read through `runtime/served-status.ts` after the robot check),
  `runtime/frame-address.ts`
  (`TARGET_NOT_FOUND` for a command whose child-frame path matches no frame, and
  `TARGET_AMBIGUOUS` when several frames match and none has the recorded id),
  `runtime/command-router.ts`
  (`ACTION_FAILED`, through `browserActionFailure`, for an action whose send to
  the page threw; a `web.dom.assert` whose first send met a navigating page is
  sent once more before that, so only its second refusal is reported),
  `runtime/click-landing.ts`
  (`RATE_LIMITED` for a replayed click whose own tab landed on a page the
  server answered with 429 or 503, told to the pace as a navigation's is, the
  tab then taken back to the page the click was pressed on;
  `NAVIGATION_UNEXPECTED` for one that landed on a page the server answered
  with any other status of 400 or above; and `USER_INTERVENTION_REQUIRED` for
  one that landed on a robot check that did not clear by itself), and
  `runtime/action-results.ts` (`NAVIGATION_UNEXPECTED`, the record every
  worker-side navigation check builds, and `USER_INTERVENTION_REQUIRED` for a
  navigation or click that landed on a robot check).
- **The expectation seam** (`domain/src/runtime/expectation/evaluate.ts`):
  `STATE_MISMATCH` and `TIMEOUT`, except where the client reported a code from
  the same set — it stood nearest the page and keeps its own record.

Browser-specific recovery classification
(`domain/src/runtime/failure/browser-api.ts`) adds the three distinctions the
recovery loop needs: `BLOCKED_BY_DIALOG` for a browser dialog that prevents
execution, `BROWSER_PERMISSION_DENIED` for an API refusal caused by browser
permission or policy, and `TRANSPORT_TRANSIENT` for a short-lived browser
transport failure. They are not collapsed into `ACTION_FAILED`.

Two rows of the table have producers the list above names only in part, or not
at all.
`USER_INTERVENTION_REQUIRED` has these producers.

- `content/action-runtime/results.ts`:
  - `blockedByModal`, for a target refused as covered or inert while a page's
    modal dialog stands over it, which is the condition the code was named
    for;
  - `challengeGateFailure`, for a missing target on a page that is a robot
    check or a code prompt;
  - `actionNeedsPerson`, for a press that put a robot check up in place, one
    only a person can answer or one that did not clear by itself within
    15 s.
- `runtime/action-runner.ts` and `runtime/click-landing.ts`, for a navigation
  or a click that landed on such a check.
- `domain/src/client/gateway-mapping.ts`, for a command still asking for a
  value the run never supplied, refused before dispatch.
- `domain/src/runtime/adapter.ts`, when no single paired web-automation client
  can be chosen for a state capture.

A robot check that clears by itself is waited out and produces no failure;
the result says how long it stood on `checkWait` instead.
[Robot checks](extension-client.md#robot-checks) says how each is told apart.
Every robot-check record leads `actual` with `captcha:`. For a press or a
click, it also says the act itself was made, so the step stands once the
person has answered. `PAGE_CHANGED` has one:
`content/actions/page-identity.ts`, for a verb that failed while the document
it started against was replaced or routed away under it. Beyond the code
table's own tests they are covered by
`e2e/content/tests/modal-intervention.spec.ts`,
`client/tests/gateway-mapping.test.ts` and
`content/actions/tests/page-identity.test.ts`.

`ACTION_REJECTED` is one code, not a family: the capability's own reason
(`disabled`, `hidden`, `covered`, and the rest) is carried in the record's
`actual`, not in the code.

## A Robot Check Parks, It Does Not End

`USER_INTERVENTION_REQUIRED` is never retryable, and it no longer ends the
build or the run that meets it. It parks them on the one person-needed ask
(Core `runtime/parking/person-needed-ask.ts`): "FluxIQ needs you: complete the
check on this page, then press Continue", with the choices Continue and Stop.

- **Self-clearing checks never reach this code.** The extension reads a check
  as person-only or self-clearing, and waits a self-clearing one out in place —
  no reload, at most about fifteen seconds. One that does not clear in that time
  is treated as person-only. A navigation or a press that lands on a person-only
  check reports `USER_INTERVENTION_REQUIRED`, never success. Every click or
  navigation -- recorded, run by a model while it builds, or run by the Flow
  it built -- is given the fifteen seconds on top of its own timeout, and its
  command says so in `checkWaitMs`, through one rule
  (`domain/src/actions/check-wait.ts`): Core's deadline then covers the wait,
  while every other wait in the command, and its retries, stay within the
  timeout it had before (`run-munx9bvj-a7ba7442`, where a 5 s recorded click
  cut the wait to 3.9 s and an 8 s check went to a person; `run-muoga8at`,
  where a built press met the same check and failed). A recorded node and a
  Run Output node carry it on the node's timeout; a web output node adds it to
  the parameters it dispatches, in `output-nodes/native-runtime.ts` and in the
  build's gateway (`runtime/llm-evidence/tools.ts`). A click or navigation
  recorded as Core's `action` entry is proposed by the domain's mapper rather
  than left to Core's fallback, which would give it Core's bare 5 s default.
- **Building a Flow.** The domain marks the call's execution result
  `personNeeded: true` (`domain/src/runtime/llm-evidence/node-run/run.ts`,
  `personDraft`) and keeps its `needs_person` code and reason for the run's own
  record. Core never shows that result to the model, which would otherwise keep
  trying the check until the site locked it out (`run-munp80f5-c31ea417`). On
  Continue the call stands with the draft statement the domain gave it. A
  navigation or press whose command went out stands as the step it would have
  been, and proposes itself, with the same `ranWith` and replay location a
  success records. A look, or an action whose look before acting met the check,
  changed nothing, so it proposes nothing. The model is then shown a fresh look.
  Stop, a timeout, or nobody to ask ends the build
  `flow_bootstrap.user_intervention_required`. A replayed step or reset that
  lands on a check keeps Core's replay code (`core.replay.failed` or
  `core.replay.reset_failed`) and carries `personNeeded` as well.
- **Running a Flow.** A node attempt that fails in the
  `user_intervention_required` category, and raised no ask of its own, gets the
  person-needed ask as its ask effect. Continue goes down `success`, and the
  next node reads the page fresh. Stop or a timeout goes down `failed`, with a
  clear person-needed ending. A run that still fails in that category is never
  handed to a repair model: the recovery gate reads it as `manual_intervention`.
- **Repairing a failed run.** A check met while the recovery explores the page
  is handled as in a build, through the same Core wrapper
  (`runtime/parking/person-needed-tool-calls.ts`). Every recovery option marks
  such a call `personNeeded` (`domain/src/runtime/llm-evidence/harness-options/execute.ts`),
  and Core asks the person through the run's thread, at stage `recovery`,
  instead of showing the repair model the check. On Continue the exploration
  goes on from a fresh look, and only that look is kept for the patch. Stop, a
  timeout, no thread, or more than three asks end the exploration
  `user_intervention_required`, with `endedBy` set to the person-needed code
  (`person_needed.stopped`, `.timed_out`, `.no_thread`, `.cancelled` or
  `.asks_exhausted`). The recovery then makes no re-plan and no patch call, and
  records the patch as skipped: `llm.runtime_patch_person_needed` at rung
  `exploration`.

`AUTH_REQUIRED` shares the model-facing `needs_person` refusal and not this
parking: a sign-in is not something a Continue press clears.

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
