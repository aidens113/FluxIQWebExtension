# w2-arbitrary-js-persistence-final-rereview report

## Outcome

**Block integration.** The final remediation materially improves every prior
boundary, but three falsifiable gaps remain: saved traces do not follow complete
JSON result lineage, a repeated transport result event loses its privacy
classification, and USER_SCRIPT can still corrupt the byte measurement used
before transport. I found no separate unrelated blocker. No test, live/browser,
provider, or Git action was performed, and only this report was written.

## Residual blockers

### High — downstream trace copies of boolean/null values and object keys remain durable

The trusted dispatch projection correctly masks the JavaScript producer's own
`result` slot and its effect parameters. It does not track the whole returned
JSON value through later data-edge consumers:

- `trace-withholding.ts:156-164` records only scalar values found below the
  declared private output before saving the trusted dispatch.
- `withholdTrustedDispatches` masks the producing attempt/output and its direct
  top-level `values` entries at lines 182-241. It does not replace later
  attempts' input subtrees by value identity or data lineage.
- The subsequent whole-trace rewrite can protect only the scalars collected by
  `recordWithheldScalars`. That function explicitly ignores booleans and null at
  lines 270-287. It also records object values but never object keys. The rewrite
  at lines 293-321 preserves every key.

Therefore a JavaScript result such as a boolean array, or an object whose
page-derived data is encoded in property names, is masked at the JavaScript
node but remains present in the saved input of a downstream Set Variable (or
another consumer). A result can encode substantial page data as booleans or
dynamic keys, so this is not only a one-bit diagnostic leak. It contradicts the
claim that source/input/result sentinels and page data are absent from the
complete saved trace/session.

The focused graph test at `runtime/tests/io-policy.test.ts:262-309` uses a
string-valued result and therefore passes through the scalar-text fallback; it
does not cover booleans, null, arrays of them, or dynamic property names. The
full-session test at `runtime/tests/service-flows/tests/runs.test.ts:65-166`
uses the same string-only shape.

Required correction: treat the declared private output as a private value
lineage, not a bag of selected scalar values. Any unchanged copy reaching a
saved downstream input/output/value must be replaced as a whole (including
keys, booleans, and null), while the executed trace and live edge retain it.
Add full graph and persisted-session cases with distinct boolean/null structure
and a sentinel object key.

### High — only the first transport-forwarded result for a private command is masked

`ClientGatewayRuntimeTransport` stores private command ids in a `Set` at
`runtime/client-gateway-transport.ts:35` and lines 50-63. On a
`client.action_result`, line 108 calls `delete` to both test and remove the
classification. Lines 109-119 then mask only when that one deletion returned
true. A second result event with the same command id is consequently forwarded
with raw message, payload, and error. The zero-delay cleanup scheduled when the
dispatch promise settles also removes the classification before any delayed
event.

This is observable without a forged Flow field: a duplicate/replayed client
result after reconnect, retry, or client error is enough. The transport already
forwards unmatched external result events, as the ordinary-event test at
`runtime/tests/client-gateway-transport.test.ts:96-115` demonstrates. The new
private-event test at lines 43-77 sends exactly one result and does not test a
duplicate or delayed event.

That falsifies the claim that every transport-forwarded public event for the
private dispatch omits raw result details. Keep a bounded privacy classification
for the command's complete event lifetime and either mask or reject duplicate
results; test a second event with the same id after the dispatch promise has
settled.

### Medium — USER_SCRIPT can still falsify the pre-transport byte measurement

The wrapper captures the current stringify/encoder/promise/timer functions at
`apps/extension/src/runtime/run-javascript.ts:94-96`, which blocks the exact
same-invocation mutations in the focused test. Its actual bound is still
`encode(json).byteLength`. The `byteLength` accessor is looked up only after the
reviewed source returns and is not captured. Source can redefine the TypedArray
prototype accessor used by the returned `Uint8Array` so it reports a small
length; an oversized `json` string then crosses the browser boundary. The
extension-side check at lines 117-125 rejects it only after transport, so
accepted output stays bounded but browser-to-extension transport does not.

There is a second lifetime gap: the wrapper captures globals anew on each
invocation. Source from an earlier node, including acknowledged late async work,
can mutate the USER_SCRIPT realm before a later JavaScript node captures
`JSON.stringify`, `TextEncoder`, `Promise`, or `setTimeout`. The adversarial test
at `runtime/tests/run-javascript.test.ts:82-107` mutates globals only after the
current wrapper has captured them; it does not run a poisoning invocation
followed by a second bounded invocation.

Required correction: measure bytes through an accessor/intrinsic that the
source cannot replace, and establish a clean or invocation-unique execution
realm (or an equivalent immutable bootstrap boundary) rather than trusting the
realm left by earlier source. Add both the TypedArray-accessor mutation and a
two-invocation poisoning test. The outer extension deadline and extension-side
JSON/byte recheck remain valuable final defenses but do not restore the claimed
pre-transport bound.

## Prior finding disposition

### Initial adversarial review

- **High, command-attempt persistence:** closed for kept, saved, and public
  `RuntimeService` projections. `io-policy.ts:93-115` derives the flags from the
  registered output definition. `runtime/service.ts:187-245` executes the real
  command but emits/saves the projected command and result; lines 436-460 omit
  parameters and mask payload/message/error. The direct adapter and caller keep
  the real values.
- **Medium, injected timeout classified as generic failure:** closed.
  `run-javascript.ts:69-80` maps injected and outer deadlines to the typed
  timeout path. The known inability to cancel continued source is now explicit.
- **Medium, output checked only after transport:** closed for an unmodified
  current realm, but not adversarially closed because of the remaining
  measurement/realm blocker above.
- **Low, Chromium permission timing:** accepted and described exactly as an
  up-front product tradeoff. `extension-client.md:156-166` and
  `web-capabilities.md:145-151` distinguish required Chromium permission/toggle,
  Firefox's unrequested optional permission, and non-cancelling timeouts.

### First adversarial rereview

- **High, saved graph/session trace:** the producer slot, effect, authored
  runtime-session copy, and string/number data-edge cases are fixed. Complete
  JSON lineage is not fixed because of the first residual blocker.
- **High, public runtime events:** the service-owned command/result events and
  first transport event are fixed. Repeated/delayed transport events remain raw
  because of the second residual blocker.
- **Medium, mutable USER_SCRIPT primordials:** the tested same-invocation global
  replacements are fixed. The uncaptured byte-length accessor and prior-run
  realm poisoning remain.
- **Medium, timeout cancellation documentation:** closed. Both downstream docs
  state that neither asynchronous nor synchronous work is cancelled and warn
  that retries may overlap late effects.

## Claims that survived final review

- **Trusted metadata is not Flow/model spoofable.** Downstream sets both privacy
  flags only for `web.dom.run_javascript` in
  `domain/src/output-nodes/definitions.ts:129-133`; manifest construction copies
  only exact `true` values from registered node metadata at
  `domain/src/io/manifest-definitions.ts:55-69`. Core reads the registered IO
  definition at `io-policy.ts:83-115`. The trace directive is held out of band
  in a module-private WeakMap at `trace-withholding.ts:84-109`; effect JSON cannot
  create it.
- **Reviewed Flow versus saved runtime copy is separated.** The reviewed Flow
  remains durable. Before session persistence, `runtime/service.ts:644-666`
  consults trusted native/IO metadata and clears a private native node's copied
  parameters or masks a policy action's nested parameters. The saved-trace
  object is already projected separately, subject to the data-lineage blocker.
- **Ephemeral execution remains real.** The runtime strips persistence-only
  context before dispatch (`runtime/service.ts:187-245`), the adapter sees real
  parameters, the dispatcher projects the real result, and the executor records
  the trusted projection only for the saved trace. The prior live report's
  two-node oracle is consistent with this design.
- **Ordinary-node compatibility is structurally preserved.** Every new command,
  result, trace, and session projection is conditional on definition-owned
  metadata being exactly `true`; ordinary definitions retain their command,
  payload, trace, and embedded Flow values. The focused reports state ordinary
  compatibility checks passed, but those runs were not repeated here.
- **Timeout and permission claims are exact.** The injected and outer deadlines
  are categorical, while neither cancels ongoing code. Chromium permission is
  required up front and still needs the user toggle; Firefox remains optional,
  unrequested, fail-closed, and unverified.
- **Result-path projection remains bounded and pollution-resistant.** The prior
  own-property, dangerous-segment, missing-path, and ordinary-envelope findings
  remain unaffected by this remediation.

## Review actions and scope

- Read the updated Current State and final rereview brief, both prior
  adversarial reports, and the persistence-boundary live report.
- Inspected the final paired product, focused-test, and architecture-document
  files named by those reports, concentrating on trusted metadata, runtime
  attempts/events, trace/session projection, USER_SCRIPT transport, deadlines,
  manifests, and ordinary-node conditionals.
- Per brief, did not use Git to re-enumerate paths and did not run any test,
  build, browser, provider, panel, store, or disposable scenario.
