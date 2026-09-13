# Sensitive Values

Which controls hold a secret, who asks, and what the guards around them are —
and are not — a boundary against. Current-state design, verified against
source on 2026-09-12.

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
  a selection can silently contain a control's value.
- **Not shadow-DOM aware.** A selection inside a closed shadow root is not
  reachable, here or anywhere else in the recorder.
- **Not a substitute for the other end.** The producer redacts, and each
  reader asks again. Both checks must fail before a value escapes; that
  redundancy is the design, not duplication to be tidied away.
