# Sensitive Values

Which controls hold a secret, who asks, and what the guards around them are —
and are not — a boundary against. Current-state design, verified against
source on 2026-09-13.

## One Rule

`isSensitiveFieldSignature`
([`domain/src/sensitivity/signature.ts`](../../domain/src/sensitivity/signature.ts))
is the rule. It reads three attributes and returns a verdict:

- a control whose type is `password` (or the legacy `one-time-code` /
  `credit-card` spellings a caller once used as types);
- `data-sensitive="true"`;
- an `autocomplete` **token** that is `current-password`, `new-password`,
  `one-time-code`, or begins `cc-`.

`autocomplete` is a space-separated token list, so every token is checked:
`billing cc-number` is what a real card field carries, and matching the whole
attribute instead of its tokens is how one copy of this rule missed it and a
billing card number leaked in Wave 2.

**Signature, never value.** Nothing in the rule is given a control's contents,
so a caller can ask before it reads.

It lives in the domain package because that is the only place every caller can
reach: the structure audit forbids `domain/src` importing
`apps/extension/src`, while the extension already depends on
`@fluxiq-web-extension/domain/client`. Before Wave 3 the rule existed in four
places and they disagreed. Two adapters sit over it and nothing else belongs
in the directory:

- `sensitiveFieldSignatureOfDescriptor` / `isSensitiveElementDescriptor`
  (`sensitivity/descriptor.ts`) ask the same question of a serialized element
  descriptor, whose attribute allowlist already carries `type`, `autocomplete`
  and `data-sensitive`. The input is `unknown` on purpose: a descriptor
  arrives from a page, over a wire, or out of stored state.
- `isSensitiveFormControl`
  (`apps/extension/src/content/element-traits.ts`) asks it of a live DOM
  element. It stays in the extension because the domain package must not
  depend on the browser.

`apps/extension/src/shared/sensitive-field.ts` no longer holds a rule; it
re-exports the domain's, so the extension's call sites keep one import path.

## Capture: The Value Never Leaves The Page

Withholding is unconditional and does not depend on a setting.

- **Element descriptors.** `readElementValue`
  ([`content/describe-element.ts`](../../apps/extension/src/content/describe-element.ts))
  returns nothing for a sensitive control, so no descriptor carries its value.
  A sensitive `<select>` yields neither its `selectedValue` nor its option
  list — the options are the value space, and publishing them narrows the
  secret. The attribute allowlist deliberately excludes `value`. A file input
  yields no value either, sensitive or not: its value is the chosen file's
  local name, which belongs to the person's machine rather than the page. Only
  `hasValue` says whether it holds files.
- **Recorded events.** The `change` listener's `inputValue` comes from the
  same reader, so a file input's `change` carries none, and `recordableKey`
  ([`content/dom-events.ts`](../../apps/extension/src/content/dom-events.ts))
  drops the key itself: a printable key pressed in a sensitive control *is*
  that control's value, one character at a time, and never goes through a
  value reader.
- **The page selection.** `capturedSelectionText` in
  `content/dom-snapshot.ts` withholds `selectedText` when the selection came
  out of, or reaches into, a sensitive control — the focused control, the
  anchor and focus nodes and their ancestors, and any sensitive control the
  ranges intersect. This is a leak the value reader cannot close:
  `getSelection().toString()` returns the text selected inside a focused
  ordinary `<input>`, so a select-all in a card field used to put its value in
  every snapshot. It was invisible only because Chromium returns nothing for
  `type="password"`, which is a browser quirk rather than a control.
- **Runtime confirmations.** `confirmedValue`
  (`background/connection/runtime-status.ts`) reads the value off the wire
  descriptor and withholds it for a sensitive control. Only the `type` and
  `select` confirmations read a value, and `clear` carries `""`. The `check`
  and `upload` confirmations carry none, and a tab confirmation carries only
  its operation and a pathname.

What still travels is *presence*: `hasValue` on the descriptor and the form
evidence, which carries nothing to redact.

**`captureSettings` is not this boundary.** `inputValues` (default on) is a
user preference about ordinary controls
([`content/capture-settings.ts`](../../apps/extension/src/content/capture-settings.ts)).
Turning it on cannot re-enable a sensitive value, and turning it off is not
what protects one.

## The Wire: Comparison Strings

A verb proves its post-condition by comparing what it asked for with what the
field ended up holding, and says both in `expected` and `actual`. Those
strings reach the gateway on the result's `validation` and Core's failure
record, so quoting a value there hands the secret to every consumer — the leak
`web.dom.type` carried when it returned the typed text twice in one result.

The producer's answer is not to drop the comparison but to stop quoting:
`describeFieldValue` (`content/actions/value-redaction.ts`) replaces the value
with its length — "a withheld value of 12 characters" — which is what someone
debugging a read-back needs and says nothing about the content. `type`,
`clear` and `select` build their validations this way and set
**`redacted: true`** on the validation to declare it.

`upload` compares file names but quotes none. A chosen file's name is the
user's data, as a typed value is, and whatever a verb writes into `expected`
and `actual` is kept in Core's saved command attempt. So its post-condition
still passes only when the input holds exactly the requested names, in order,
but both strings say only how many files there are and whether their names
match, and a page-side refusal names a file by its position in the request
([`content/actions/upload.ts`](../../apps/extension/src/content/actions/upload.ts),
`content/action-runtime/file-input.ts`). It sets no `redacted` flag, because it
names neither a value nor a length.

Two guards then ask about the descriptor riding on the same result:

- `webAutomationSecretSafeValidation`
  ([`domain/src/client/gateway-mapping.ts`](../../domain/src/client/gateway-mapping.ts)),
  before the result crosses the WebSocket;
- `clientReportedFailure` in `domain/src/runtime/adapter.ts`, re-establishing
  the failure record on the far side.

Each replaces both comparison strings with one shared marker,
`WEB_AUTOMATION_WITHHELD_COMPARISON_TEXT`, unless the producer declared the
strings already withheld. The marker is shared rather than phrased twice
because a marker that reads differently at the two exits is one nobody can
grep for, and grepping a serialized payload is how every leak in this plan was
found. `status`, the code, the category, the retryable flag and the evidence
digest are unaffected, so a Flow still routes on the failure it was given.

`isProducerRedactedComparison` **fails safe**: anything other than the boolean
`true` reads as "not declared" and the caller withholds. An older client, a
new verb nobody taught the flag, or a hand-written wire value is withheld
exactly as before.

A withheld comparison deliberately leaves carrying **no** flag. The flag means
"the producer named a length rather than a value", not "this text is safe";
stamping it at the extension-side guard was read downstream as the producer's
declaration and disarmed the adapter's guard for every extension result.

## Readers

- **Recording state.** `webAutomationStateReducer`
  (`domain/src/recording/reducers.ts`) asks the rule again from the
  descriptor before writing `forms.<selector>`, rather than trusting the
  producer's guard on the far side of a wire. `elements.*` state omits a
  sensitive control's value, and will not fall back to it as a label
  (`web-state/state-values.ts`). `forms.*` is declared `sensitive: true` in
  the recording domain, which labels it downstream.
- **The sanitized LLM packet.** `sanitizedEvidenceElement`
  (`domain/src/runtime/llm-evidence/elements.ts`) drops a sensitive control
  from the packet entirely. No packet element carries a `value` field at all;
  a select's `selectedValue` is carried only when it matches one of the
  options already listed.
- **Recorded uploads.** A recorded file choice becomes a `web.dom.upload` node
  that asks for its files at run time, under `web.upload.<key>`, and holds no
  file name, count or content. Its element fingerprint drops `value`
  (`domain/src/output-nodes/payloads.ts`). The request has a namespace of its
  own, apart from `web.secret.`, so an upload request is never read as a secret
  request, nor a secret request as an upload
  ([`domain/src/output-nodes/upload-binding.ts`](../../domain/src/output-nodes/upload-binding.ts)).
- **Page evidence.** Form controls report `hasValue`, the raw `autocomplete`
  tokens, and a `sensitive` marker — see [page evidence](page-evidence.md).
  The tokens are carried on purpose, so a consumer can ask the rule itself
  instead of inheriting whatever the producer concluded.

## Run Time: The Value Returns As A Run Input

A recording holds no secret, so a Flow built from one must be given it. A
recorded entry into a sensitive control becomes a `web.dom.type` node whose
`text` is a request rather than a value: Core's parameter state binding,
`{ $state: { path } }`, at `web.secret.<key>`
([`domain/src/output-nodes/secret-binding.ts`](../../domain/src/output-nodes/secret-binding.ts);
`recordedTypedText` in `payloads.ts`). The key names the control, by the rule
in `recorded-element-key.ts` that a recorded upload's request shares, and never
the value, so the request is safe in a recording, a stored Flow, a log or an
evidence packet.

- **The run supplies the value** as a run input at that path. Core resolves
  the binding before the node executes, so the value reaches the dispatched
  action. The binding has no `fallback`: an unsupplied value fails the node
  with its path named, rather than typing nothing and reporting success.
- **A request that reaches the gateway unanswered is not dispatched.**
  `webAutomationActionFromGatewayCommand`
  (`domain/src/client/gateway-mapping.ts`) refuses it as
  `web.intervention.required`, naming the parameter and the path and never a
  value. An unanswered upload request is refused the same way.
- **Core keeps each key and withholds each value at rest** (fluxiq 0.4.0):
  - a runtime session's `metadata.inputs`, and the `inputs` of the run-summary
    envelope in the run's event stream, read `[withheld]`;
  - the persisted run trace withholds each supplied input, and each value the
    run resolved out of a state binding;
  - a saved command attempt withholds resolved values in `command.parameters`,
    `result.message`, `result.error` and the attempt's `message`.

  The run itself executes with the real value. Core states the rules in its own
  `docs/architecture/automation-studio.md` and `package-boundaries.md`.

What Core does not withhold, and a supplier must allow for:

- **A saved attempt's `command.metadata`, `result.payload`, `result.failure`
  and `result.metadata`.** An action result's page snapshot is in
  `result.payload`, which is why page text is a route of its own (see "Not a
  rule about page text" below).
- **A copy.** An input no binding reads, which a node copies into an output
  under another key, stays in clear at that copy. A supplier should give only
  the inputs a binding asks for.
- **Records saved before 0.4.0,** which are not rewritten.

In the Lab, the Flow lane supplies each declared secret once, under the path
its node asks for, paired with its declaration by control one to one; a
pairing that fails stops the run before the Flow starts
([declared replay secrets](testing-facility.md#declared-replay-secrets)).

## What These Guards Are Not

- **Not a text scanner.** Nothing reads a comparison string looking for things
  that resemble card numbers. A predicate over free text both misses and
  misfires, and is worse than withholding.
- **Not wider than the descriptor.** The wire guards ask the rule about the
  element descriptor the result carries. A result with a text-bearing
  validation and **no** `element` cannot be judged and passes through as the
  producer wrote it.
- **Not a classifier of content.** The rule is a *signature* rule. A plain
  `<input type="text">` holding a password, with no `autocomplete` and no
  `data-sensitive`, is an ordinary control to every guard here. Marking it is
  the page's job — or the recording operator's.
- **Not a rule about page text.** Visible text, extracted values,
  `web.dom.extract` output and assertion text are page content the automation
  was asked for; only the selection has a sensitivity guard, and only because
  a selection can silently contain a control's value. A page that displays a
  secret as text therefore puts it into every state snapshot, into the
  snapshot each action result carries, and so into Core's workspace, and no
  guard here or in Core withholds it. A display rule — dropping `visibleText`
  and `text`, not only the value, for an element marked `data-sensitive` — is
  not built; whether to build it is ranked with the Week 1 blockers in the
  [Week 1 plan](../working/mvp-week1-web-automation-reliability-plan.md). The
  Lab's run leak check finds a declared secret shown this way
  ([testing facility](testing-facility.md)).
- **Not shadow-DOM aware.** A selection inside a closed shadow root is not
  reachable, here or anywhere else in the recorder.
- **Not a substitute for the other end.** The producer redacts, and each
  reader asks again. Both checks must fail before a value escapes; that
  redundancy is the design, not duplication to be tidied away.
