# Report: w3-failure-producers

Worker: `w3-failure-producers`. Wave 3: Phase 1.5 step 3 (the producer half) and
step 4 — every browser failure carries a code from the closed set, and a failed
result carries the page it failed on.

## Outcome

**Done for the two files the brief owns, and the brief is short of the goal it
states.** `content/action-runtime/results.ts` and `domain/src/runtime/adapter.ts`
now produce nothing but closed-set codes, the sanitized `web-llm-evidence.v1`
packet rides with every failed command, and the ten new spec rows on
`failure-surfaces`, `auth-gate`, `intermediate-state` and `navigation` all pass.

Two consequences the supervisor must act on before integrating:

1. **Fifteen assertions in five spec files I do not own now fail**, because
   `web.action.disabled` / `covered` / `hidden` / `not_checkable` /
   `unsupported_key` / `upload_rejected` / `dialog_no_response` collapse into the
   single `web.action.rejected` the closed set defines. Only the `code` string
   changes; category, retryable and stage are unchanged. The exact lines are in
   [The fifteen lines](#the-fifteen-lines-someone-must-change).
2. **Sixteen wire codes outside the closed set are still produced elsewhere**, by
   files in nobody's Wave 3 Owns. The brief's sentence "every browser failure
   must carry the structured field, using the codes from `w3-failure-codes`" is
   true of the two files it names and false of the tree. See
   [The producers the brief left out](#the-producers-the-brief-left-out).

## What changed and why

### `apps/extension/src/content/action-runtime/results.ts`

Every failure record is now built by `webAutomationFailureRecord` from a code in
`WEB_AUTOMATION_FAILURE_CODES`, imported through
`@fluxiq-web-extension/domain/client`. No wire string is written in the file.

| Producer | Code | Was |
| --- | --- | --- |
| `success()` with a failed validation | `OUTPUT_NOT_OBSERVED`, or `STATE_MISMATCH` when the verb is `web.dom.assert` | `web.validation.output_not_observed` only |
| `actionRejected()` | `ACTION_REJECTED`, reason in `actual` | `web.action.${reason}`, a new code per reason |
| `actionTimedOut()` | `TIMEOUT` | `web.action.timeout` (same string, now from the set) |
| `actionNotImplemented()` | `NOT_IMPLEMENTED` | `web.action.not_implemented` (same string) |
| `actionFailure()` | the thrower's record, else `classifyWebAutomationFailure` | **no failure record at all** |

Four things beyond a code swap:

- **`actionFailure` reads the thrown value.** `resolve-target.ts` raises a
  `TargetResolutionError` carrying a `TARGET_NOT_FOUND` or `TARGET_AMBIGUOUS`
  record and the `resolution` that produced it, and its own comment says the
  seam belongs here. Both now ride onto the result: the record becomes
  `result.failure`, the diagnostics become `result.resolution`. Before this an
  action that threw reached the worker with a sentence and nothing else. The
  record is read structurally, not by class — the class may be a bundled copy —
  and is trusted only when `isWebAutomationFailureCode` says its code is in the
  set.
- **`ACTION_REJECTED` is one code.** The verbs still pass their reason
  (`disabled`, `covered`, `hidden`, `not_checkable`, `unsupported_key`,
  `upload_rejected`, `dialog_no_response`, `dialog_override_missing`) and it
  travels in the record's `actual` as `"disabled: the element is disabled"`. The
  `validation` an operator reads is untouched. This is the w3-failure-codes
  decision applied; it is also what breaks the fifteen assertions.
- **A failed result always carries a snapshot**, whether or not
  `captureSettings.snapshots` is on, because the domain builds the failure
  evidence packet from it and one captured at diagnosis time describes a page
  that has moved on. The paths this changes are the ones that hand the builder
  no evidence of their own: `actionFailure` and `actionNotImplemented`. Every
  other verb already supplies its own snapshot.
- **AUTH_REQUIRED is decided from the page**, at the single point every result
  passes through. When the element an action named is not in the document *and*
  a rendered password control sits inside a form, the record becomes
  `AUTH_REQUIRED` instead of the missing-target or thrown-error code. Both halves
  are required: a sign-in form on a page whose target resolved is just a page
  with a sign-in form. An action that named no selector is never judged this way.
  Nothing reads a field's value; only whether a password control exists. This is
  the only producer for `auth_required` in the tree, and it matters because Core
  treats that category as needing a person rather than a retry — an expired
  session reported as a missing target leaves the orchestrator retrying a wall.

### `domain/src/runtime/adapter.ts`

- **Every command that did not succeed leaves with a record.**
  `classifyWebAutomationFailure` runs on the dispatch outcome; a record the
  client already sent is returned unchanged (it stood nearest the page) and
  everything else is classified from status and message. Previously a command
  that failed with only a message — an unpaired client, a client-side timeout, a
  dispatch that threw — reached Core with no record at all.
- **`rejected()` carries one too.** `rejected` is not a status Core's
  `failureForCommandStatus` classifies, so the refusal used to arrive as a bare
  message. An unsupported output is `UNSUPPORTED_TYPE`. A snapshot with no paired
  client is `USER_INTERVENTION_REQUIRED`, which is a judgement worth naming: a
  person pairing a browser is exactly what unblocks it, and `auth_required`'s
  neighbour category `blocked_by_capability_or_policy` would tell Core to stop
  rather than to ask. Easy to overrule — one constant.
- **Step 4, the packet.** A failed command's metadata gains
  `failureEvidence`, the sanitized `web-llm-evidence.v1` packet built by
  `sanitizeWebLlmSnapshot` from the snapshot the content script captured at the
  instant of failure, bounded to Core's own
  `AUTOMATION_STUDIO_LLM_MAX_FAILURE_EVIDENCE_BYTES` (3,000) rather than the
  larger exploration budget. Beside it, `failureDiagnostics` carries the URL, the
  title and the selector the client resolved, plus the packet's SHA-256 digest,
  which is also set as the failure record's `evidenceDigest` so the record names
  the evidence it was captured with. URLs are reduced to origin and path, as the
  packet's own `location` is, so a session token in a query string cannot ride
  into the attempt trace. An unusable snapshot costs the packet and never the
  failure: the sanitizer's throw is caught.

### Tests

- `domain/src/runtime/tests/adapter.test.ts` — nine new tests. Every record is
  run through Core's `parseAutomationStudioFailureRecord`, and the packet through
  Core's own `sanitizeAutomationStudioLlmFailureEvidence("runtime_diagnosis", …)`,
  which is the gate the diagnosis path will apply to it. Covered: a failed
  command with no client record, a timeout, a failure with nothing to say, a
  success carrying no evidence, the unsupported-output rejection, the packet with
  its digest bound to the record, a password control dropped from the packet, a
  client record surviving the hop and gaining only the digest, and an unusable
  snapshot.
- `apps/extension/e2e/content/tests/failures.spec.ts` — ten rows, new file. The
  codes are imported from `@fluxiq-web-extension/domain/client` rather than typed
  out, so the spec proves `results.ts` draws from the set rather than repeating
  strings that happen to agree. Rows: ACTION_REJECTED for a disabled and a hidden
  target (one code, two reasons), TARGET_NOT_FOUND with the resolver's
  diagnostics riding along, a thrown failure carrying a snapshot with capture
  off, AUTH_REQUIRED behind the sign-in gate plus its control, TIMEOUT on a wait
  that expires plus its control, and OUTPUT_NOT_OBSERVED with the URL for a
  navigation that never begins plus its control.

There is no Node unit test beside `results.ts`: every line of it reads
`document` or `location`, which is why `validation-outcome.ts` exists as the
DOM-free half. The e2e spec is its proof, as the brief's Owns list implies.

## Commands run and observed results

`EXTENSION_TEST_BUILD_LABEL=w3-failure-producers` and
`DOMAIN_TEST_BUILD_LABEL=w3-failure-producers` were set. Exit status was captured
by redirecting to a file and echoing `$?`, never through a pipe. No `pnpm build`
and no `pnpm lab` run.

- `pnpm --filter @fluxiq-web-extension/extension check` → **exit 0**, no
  diagnostics, confirmed twice (first and last thing I ran). Two intermediate
  runs failed only in other workers' files and were clean on the rerun the
  binding rules call for: two errors in
  `src/content/evidence/tests/changes.test.ts` (w3-evidence), and
  `src/runtime/action-runner.ts(203,25): Cannot find name 'unreachableFrameFailure'`
  (w3-frame-plumbing, mid-edit).
- `pnpm --filter @fluxiq-web-extension/extension test` → **exit 0**.
  `# tests 139 / # pass 139 / # fail 0`.
- `pnpm --filter @fluxiq-web-extension/domain check` → **exit 0**. (Two earlier
  runs failed with fifteen errors in `src/recording/tests/web-state.test.ts`,
  w3-state-identity's file; gone once their split landed.)
- `pnpm --filter @fluxiq-web-extension/domain test` → **exit 0**.
  `# tests 188 / # pass 188 / # fail 0`, including the nine new adapter tests.
  (Two earlier runs failed inside w3-host-runtime's
  `runtime/expectation/tests/evaluate.test.ts` and then aborted the runner on
  w3-state-identity's `filteredElements.map is not a function`; both are gone.)
- `npx playwright test -c e2e/playwright.content.config.ts content/tests/failures.spec.ts`
  → **exit 0**, `10 passed`.
- `npx playwright test -c e2e/playwright.content.config.ts` (the whole content
  harness) → **exit 1**, `135 passed, 1 skipped, 19 failed`. Of the nineteen:
  - **14 are mine and expected**: the rejection-code collapse, listed below.
  - **4 are w3-resolver's**: `identity-resolution.spec.ts:171` fails with
    `ReferenceError: AMBIGUOUS_CODE is not defined` (their spec, mid-edit), and
    `resolve-target.spec.ts:49`, `:73` and `:173` fail because their new
    ambiguity gate no longer "takes the first match in document order", which is
    the behaviour those three rows assert.
  - **1 is environmental**: `scroll.spec.ts:129` timed out in teardown with
    `ENOENT` on a Playwright trace artifact. Rerun alone → **exit 0**,
    `8 passed`.
- `node scripts/structure-audit.mjs` with a scratch `GIT_INDEX_FILE` (a copy of
  `.git/index` with the new spec and this report added; the real index was never
  written, and `pnpm structure:baseline` was never run) → **exit 1**,
  `structure-audit: 2 violation(s) across 2 rule(s)`, 27 warnings. Both
  violations are **pre-existing and not mine**, confirmed by rerunning the audit
  on the same tree without my two new files staged: identical output, the same 2
  violations and the same 27 warnings, byte for byte. They are
  `[imports] apps/extension/src/runtime/tests/result-mapping.test.ts` importing
  `../../content/evidence` instead of the directory barrel (a concurrent
  worker's edit) and `[working-docs] docs/working/README.md is out of date`
  (the supervisor's index, which I must not edit and whose regeneration command
  I must not run). No finding names `results.ts`, `adapter.ts`,
  `failures.spec.ts` or this report.

## Not verified

- **No live browser validation of the extension itself.** The content harness is
  the real content-script bundle in real Chromium, but with no background worker,
  no tab routing and no gateway. The domain hop and the extension's worker side
  were exercised only by unit tests.
- **The evidence packet is not yet read by Core's diagnosis path.** Core calls
  `llmEvidenceRuntime.captureSanitizedFailureEvidence`, which opens a *fresh*
  snapshot when diagnosis runs; nothing reads `attempt.result.metadata.failureEvidence`.
  The packet is real, bounded, digest-bound to the record and visible in the
  attempt trace, but the consumer that would prefer it over a re-capture lives in
  `domain/src/runtime/llm-evidence/tools.ts`, which is w3-llm-packet's and which
  my brief forbids me to touch. Wiring it needs a key the adapter does not hold:
  `captureSanitizedFailureEvidence` is addressed by `failedAction.attemptId`, and
  the adapter knows only the command id.
- **`pnpm check`, `pnpm test` and `pnpm build` were not run** at repository
  scope; the brief scopes the gates to the packages I touched and forbids the
  build.
- **The AUTH_REQUIRED rule is proven on one fixture.** `auth-gate` is a
  well-formed sign-in page. A single-page app that renders its login wall without
  a `<form>`, or one that keeps a hidden password field on every page, is not
  covered by the fixture set; the second case cannot false-positive, because the
  control must have a layout box, but the first will simply not be recognised.
- **`USER_INTERVENTION_REQUIRED` and `PAGE_CHANGED` still have no producer**
  reachable from my files. See below.

## Open questions or contradictions found

### The question the dispatch asked: can `WebAutomationRuntimeError.code` be narrowed?

**Not from the files I own, and the narrowing is less urgent than it looked.**

`WebAutomationRuntimeError` is declared in `domain/src/runtime/errors.ts`, which
is in neither my Owns nor w3-failure-codes' (`domain/src/runtime/failure/`). It
still has **no producer anywhere in the tree**; I did not add one. Narrowing
`code: string` to `WebAutomationFailureCode` has to happen in `errors.ts`, and
`errors.ts` is in no Wave 3 brief's Owns at all. It is a two-line change —
`readonly code: WebAutomationFailureCode` and the constructor parameter — and
importing the type from `./failure` creates no cycle, because `failure/classify.ts`
imports the *class* from `../errors` and TypeScript resolves a type-only import
back the other way without one. The supervisor can do it directly.

What I found while implementing is that the class may be the wrong carrier.
`resolve-target.ts`, the first real producer of a classified content-side
failure, does **not** throw `WebAutomationRuntimeError`; it throws its own
`TargetResolutionError` carrying a whole `AutomationStudioFailureRecord` plus the
resolution diagnostics, which is strictly more than a code. `results.ts` now
reads that shape — a `failure` property whose `code` passes
`isWebAutomationFailureCode` — so the closed set is enforced at the reader
rather than at the throw. Narrowing `errors.ts` would still be worth doing for
the classifier's sake, but if no producer ever uses the class, the honest
alternative is to delete it and keep the record-carrying convention.

### The fifteen lines someone must change

Each is a `code:` string inside a `failure:` object in a spec I do not own; every
other field in those assertions still holds. Replace with `"web.action.rejected"`:

| File | Lines | Current code |
| --- | --- | --- |
| `apps/extension/e2e/content/tests/check-assert.spec.ts` | 84, 93 | `web.action.not_checkable` |
| `apps/extension/e2e/content/tests/check-assert.spec.ts` | 104 | `web.action.disabled` |
| `apps/extension/e2e/content/tests/click.spec.ts` | 170, 185, 204 | `web.action.disabled`, `covered`, `hidden` |
| `apps/extension/e2e/content/tests/keyboard.spec.ts` | 203 | `web.action.unsupported_key` |
| `apps/extension/e2e/content/tests/keyboard.spec.ts` | 220, 237, 252 | `web.action.disabled` |
| `apps/extension/e2e/content/tests/select.spec.ts` | 153, 182 | `web.action.disabled` |
| `apps/extension/e2e/content/tests/select.spec.ts` | 166 | `web.action.hidden` |
| `apps/extension/e2e/content/tests/upload-dialog.spec.ts` | 70 | `web.action.upload_rejected` |
| `apps/extension/e2e/content/tests/upload-dialog.spec.ts` | 119 | `web.action.dialog_no_response` |

A sixteenth site, `apps/extension/src/content/action-runtime/tests/validation-outcome.test.ts:55`,
still passes: it tests `rejectionFailure` directly, and that function is
unchanged. It is now testing dead code (below).

I did not change them. The brief's Owns list is four paths and the binding rules
say to report rather than widen; each row also carries prose about "the disabled
code" that wants rewording, not just a string swap, which is an editorial call
for whoever owns those specs.

### The producers the brief left out

This is the ownership-drawn-around-a-file defect the wave's binding rules warn
about, and it is large. Sixteen wire codes outside the closed set are still
produced by files in nobody's Wave 3 Owns:

- **`apps/extension/src/content/action-runtime/validation-outcome.ts`** —
  `rejectionFailure`, `outputNotObservedFailure`, `timeoutFailure` and
  `notImplementedFailure` now have **zero production call sites**; `results.ts`
  was their only caller and it builds records from the code table instead. They
  are still exported and still tested. `rejectionFailure` is the one that
  actively contradicts the set — it builds `web.action.${caller-supplied-suffix}`
  — and w3-failure-codes' report assumed I owned this file. I do not. It should
  be deleted down to `truncateValidationText`, `boundValidation` and
  `statusForValidation`, which `results.ts` still uses.
- **`apps/extension/src/content/actions/assert.ts`** — overwrites the record
  `success()` builds with `web.assert.${kind}` and category
  `expected_state_missing`, six codes, contradicting the w3-failure-codes
  decision that STATE_MISMATCH is `unexpected_state`. My `success()` change is
  therefore **inert on the assert path**: `web.dom.assert` still reaches the wire
  as `web.assert.text`, not `web.validation.state_mismatch`. I left the row out
  of `failures.spec.ts` rather than write a failing one. The fix is to delete
  `stateMismatchFailure` and stop replacing the record.
- **`apps/extension/src/runtime/action-results.ts`** and its callers
  (`action-runner.ts`, `browser-tab.ts`, `browser-download.ts`) — the worker-side
  family: `navigationUnexpectedFailure` hard-codes `web.navigate.unexpected_url`
  (the set's name is `web.navigation.unexpected`), and `workerBlockedFailure`,
  `workerTimeoutFailure`, `workerActionFailedFailure` and
  `workerTargetNotFoundFailure` take a free-form `code` string, producing
  `web.page.unsupported`, `web.download.permission_missing`,
  `web.download.timeout`, `web.tab.failed`, `web.tab.invalid_request`,
  `web.tab.no_id`, `web.tab.no_match`, `web.tab.no_target` and
  `web.tab.not_closed`. `action-runner.ts` already imports
  `webAutomationFailureRecord` for one call site, so w3-frame-plumbing found the
  same seam from the other side.

  This is also why the brief's "spec rows planting each category on …
  `navigation`" could not be met as written for `NAVIGATION_UNEXPECTED`: the only
  producer of that category is `action-runner.ts`, which runs in the background
  worker, and the content harness has no background worker at all. My
  `navigation` rows plant `OUTPUT_NOT_OBSERVED` and prove the URL rides with the
  failure, which is the content-side half of step 4.

### Two codes in the set with no producer at all

- **`PAGE_CHANGED`** ("the document was replaced between resolving the target and
  running the action") cannot be produced from `results.ts`: nothing on the
  command carries a document identity captured at dispatch, and the content
  script's own module dies with the document. It needs a field on
  `BrowserActionCommand` (`domain/src/actions/types.ts`) stamped by
  `action-runner.ts` and compared in `message-handler.ts` — three files, none
  mine.
- **`USER_INTERVENTION_REQUIRED`** has one producer, the unpaired-client
  rejection I added in the adapter. The page-side case the code was named for — a
  captcha, or a native dialog waiting for an answer — has no signal to read:
  `dialog-control.ts` reports only the dialog the override *handled*, and the
  pending-dialog flag is w3-evidence's to add. No fixture ships a captcha either,
  so I would have been shipping an unprovable heuristic. Left out deliberately.

### Smaller notes

- The evidence packet's `location`, and the `url` in `failureDiagnostics`, drop
  the query string and fragment. That is deliberate — it is where a session token
  rides — but it means a failure on `?page=3` and one on `?page=4` look alike in
  the attempt trace. If a Flow ever needs the query, it has to be allowlisted per
  parameter, not passed through.
- `webAutomationActionResultPayload` in `domain/src/client/gateway-mapping.ts`
  drops `validation` and `resolution` from the payload it sends to the gateway.
  So the domain hop cannot see the post-condition that failed or the resolver's
  diagnostics, and `adapter.ts` classifies from status and message alone. Adding
  those two fields would let the classifier tell `OUTPUT_NOT_OBSERVED` from
  `STATE_MISMATCH` at the domain hop as well as at the page. That file is
  w3-domain-contracts'.
