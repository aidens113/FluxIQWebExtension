# w2 arbitrary JavaScript persistence-boundary live report

## Outcome

Done. The residual high/medium findings are closed across the paired t029
worktrees. Trusted registry metadata now withholds JavaScript parameters and
result details from saved attempts, the complete saved graph trace, the runtime
session's embedded graph, and direct or transport-forwarded public runtime
events while preserving real adapter execution and ephemeral data edges. The
same hand-authored two-JavaScript-node journey passed in real Chromium after the
final binaries were rebuilt. No provider call, commit, or push was made.

## Persistence and event boundary

- Core's trusted IO dispatcher attaches an out-of-band trace-persistence
  directive to its result. Flow/model JSON cannot forge it. The executor uses
  it only while producing the saved trace: the exact effect parameter key and
  declared output are withheld, and scalars carried onward through live data
  edges are withheld wherever they reappear in durable trace data.
- Runtime command attempts omit the whole JavaScript parameter object and mask
  payload, message, and error. Direct adapters still receive the real command,
  and dispatch callers still receive the real result.
- `command.dispatched` and `command.result` expose the saved projection rather
  than the private execution copy. The client-gateway transport also masks its
  independently forwarded action-result event while resolving the dispatch
  promise with the real result. Ordinary command/result events remain unchanged.
- Runtime-session persistence projects its embedded Flow copy from trusted IO
  and native-node metadata. The separately owned reviewed Flow definition keeps
  literal source and inputs by design; the runtime-session copy does not
  duplicate them. The saved trace and session omit distinct source, input, and
  result sentinels, while the adapter and downstream Set Variable data edge see
  the real values.

## Browser boundary hardening

- The USER_SCRIPT wrapper captures bound `JSON.stringify`, UTF-8 encoding,
  `Promise.resolve`, `Promise.race`, and `setTimeout` primordials before reviewed
  source starts. A focused adversarial test replaces all mutable globals and
  still observes only the small `too_large` envelope for an oversized value.
- A returned object shaped like the internal tag is serialized as ordinary node
  data and cannot spoof the outer envelope.
- The focused deadline test proves the documented limitation: timeout stops
  FluxIQ waiting but does not cancel later asynchronous page work. Synchronously
  non-terminating source likewise cannot be forcibly terminated.

## Final live proof

- Browser: isolated Playwright Chromium 151 with the unpacked final extension
  build. The disposable profile's real per-extension **Allow user scripts**
  control was enabled, then the browser was restarted and the enabled state was
  confirmed. The default Lab Chromium 134 could not expose that control even
  with global Developer mode enabled, so it correctly remained fail-closed.
- Topology: disposable random ports 63300 (Core/panel), 63301 (gateway), and
  63299 (Scenario Lab). Port 3000, user browser state, and shared development
  state were not used.
- Flow: canonical parent/router/subflow with Start -> JavaScript 1 -> Set
  Variable -> JavaScript 2 -> End, plus JavaScript 1's declared `result` data
  edge into Set Variable.
- Oracle: all five node attempts and the run succeeded. JavaScript 2 consumed
  JavaScript 1's real two-field result through the declared port/state path and
  made both values page-visible: `sum="7"` and `marker="js-live"`.
- The disposable live harness and run-owned topology/profile were removed. No
  provider was called and no raw source/result payload was retained in this
  report.

## Focused validation

- Core Vitest, five focused files: 68/68 passed. Coverage includes trusted trace
  withholding and ordinary-trace compatibility, complete saved runtime-session
  projection with authored-Flow durability, direct public events plus ordinary
  compatibility, transport-forwarded private results, runtime attempt storage,
  result-port projection, and real downstream data-edge execution.
- Extension JavaScript executor test bundle: 11/11 passed, including no-argument
  availability probe, exact/over output bounds, tagged-envelope spoofing,
  primordial monkey-patching, non-JSON/error refusal, injected and outer
  timeouts, post-timeout async work, executor source/input/object limits, and
  unavailable/ungranted permission behavior.
- `pnpm --filter fluxiq build` passed.
- `pnpm --filter @fluxiq-web-extension/domain build` passed.
- `pnpm --filter @fluxiq-web-extension/extension build` passed.
- `git diff --check` passed in both worktrees; Core printed only existing
  line-ending conversion warnings.

## Files and boundaries

This remediation changed the existing owned Core runtime service/event,
client-gateway transport, Automation Studio IO/executor/session persistence,
focused tests, downstream USER_SCRIPT executor/tests, and current architecture
documentation. All pre-existing feature files/reports remain present, including
the integration-critical untracked executor and output-validation test. No
temporary Lab, scenario, flow-lane, provider-harness, or live-instruction edit
remains. No t027/t033 checkout, user `.fluxiq`, secret, commit, or push was
touched.

## Integration disposition

Ready for supervisor review and merge-boundary gates. The known product
limitations are explicit rather than open defects: Chromium requires the
declared permission plus the browser's user-script toggle; Firefox has no
optional-permission request path and fails closed when ungranted; USER_SCRIPT
removes extension-API access but reviewed code can still read/modify page data
and initiate page-context network activity; timeout does not cancel ongoing
page work.
