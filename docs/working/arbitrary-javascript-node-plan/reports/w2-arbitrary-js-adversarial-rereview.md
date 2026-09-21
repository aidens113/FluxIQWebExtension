# w2-arbitrary-js-adversarial-rereview report

## Outcome

**Blocked for integration.** The remediation correctly withholds the JavaScript
command's parameters and payload from `RuntimeService`'s kept and saved command
attempt, and it preserves the real adapter/result-port path. That is narrower
than the stated privacy boundary: the same source, inputs, and returned page
value still enter the persisted Automation Studio run trace, while the runtime
event API still publishes the raw command and result. The USER_SCRIPT transport
cap can also be bypassed by source that changes the mutable globals the wrapper
uses after running that source. No test, live run, or provider call was made in
this read-only review.

## Residual findings

### High — the saved Flow run trace still duplicates source, inputs, and returned page data

- The trusted manifest flags are genuine registry data: downstream derives them
  only for `web.dom.run_javascript` in
  `domain/src/output-nodes/definitions.ts:129-133` and copies them into the
  registered IO definition at `domain/src/io/manifest-definitions.ts:55-65`.
  Core reads that registered definition and passes runtime-only context flags at
  `packages/fluxiq/src/programs/automation-studio/runtime/io-policy.ts:83-112`.
- `RuntimeService` strips those flags before adapter/transport dispatch and saves
  an attempt whose command omits `parameters` and whose payload is the withheld
  marker (`runtime/service.ts:187-241`, `426-447`). The focused disk test proves
  only that artifact: `runtime/tests/io-policy.test.ts:220-260` invokes the
  dispatcher directly and reads `command-attempts/.../attempt.json`.
- The graph trace is a separate durable copy that the new flags never reach.
  `builtin.policy.action` places the complete output parameters in the
  `policy.output.dispatch` effect (`nodes/policy/action.ts:54-75`). After
  dispatch, the executor retains that effect and merges the projected result
  into node outputs (`runtime/executor/node-execution.ts:180-210`);
  `nodeAttemptFromResult` copies both into the attempt (`attempt-trace.ts:23-34`),
  and the graph also copies every output into `values` and every effect into its
  top-level effect list (`executor/graph-run.ts:223-240`).
- Existing trace withholding records only differences introduced by state
  binding (`node-execution.ts:47-64`; `trace-withholding.ts:82-128`). Literal
  source/literal inputs are authored and therefore intentionally not collected,
  and a returned value is not collected unless a later binding happens to read
  its scalars. A single JavaScript node therefore leaves its source and inputs
  in trace effects and its return in attempt outputs and `values`. Even the
  two-node live oracle withholds only the string/number fields consumed by the
  second binding; booleans/null are deliberately not collected
  (`trace-withholding.ts:150-167`).
- Core persists that returned trace as the runtime session
  (`runtime/service.ts:3255-3265`) and writes the complete session JSON to disk
  (`runtime/service.ts:4882-4895`). The compact SQL action-event projection does
  omit attempt inputs/outputs/effects (`service/summaries/conversions.ts:143-181`),
  but that does not make the saved session safe.
- Required correction: extend the trusted definition-owned privacy contract to
  the saved graph trace/session, while keeping the executed trace and downstream
  data edge real. Add a full graph/service persistence test with a standalone JS
  node and distinct source/input/result sentinels; checking only the command
  attempt or a chain whose later binding incidentally withholds result scalars is
  insufficient.

### High — public runtime events bypass the attempt withholding boundary

- Immediately before and after dispatch, `RuntimeService` emits
  `command.dispatched` with `normalizedCommand` and `command.result` with the real
  result (`runtime/service.ts:223-231`), not the withheld copies used by the
  attempt. These are public payload-bearing events by contract
  (`runtime/contracts.ts:230-246`).
- On the WebSocket route, `ClientGatewayRuntimeTransport` independently forwards
  the client's raw action-result payload as another `command.result` event
  (`runtime/client-gateway-transport.ts:90-109`), before the caller-specific
  persistence flags can shape it. No production durable subscriber was found in
  the current tree, but any event logger/recorder receives the forbidden values;
  the new tests capture neither event and therefore do not establish saved-event
  or log safety.
- Required correction: define a public/persistable event projection that honors
  the same trusted withholding policy, including transport-forwarded results, or
  explicitly separate private execution events from events safe for logging and
  persistence. Assert the three sentinels are absent from observed public events.

### Medium — arbitrary source can bypass the pre-transport output cap and spoof the tagged envelope

- The generated wrapper invokes arbitrary source and only afterward resolves
  `JSON.stringify`, `TextEncoder`, `setTimeout`, and `Promise.race` from the same
  USER_SCRIPT global (`apps/extension/src/runtime/run-javascript.ts:94-96`). The
  source can replace those mutable globals before the wrapper uses them. For
  example, replacing `TextEncoder.prototype.encode` with a function reporting a
  small `byteLength` allows a very large serialized string to cross the browser
  boundary; the extension rejects it only after transport at lines 117-125,
  recreating the initial memory/transport defect.
- The tag is structural, not private or spoof-resistant. The nested source can
  see the outer `tag` binding and can replace `Promise.race` so the wrapper
  returns a source-chosen tagged outcome instead of the wrapper's execution/
  timeout race. The outer extension validation still prevents accepting invalid
  or oversized JSON, but it cannot undo already-unbounded browser transport.
- The focused tests evaluate the normal wrapper and large-result path
  (`runtime/tests/run-javascript.test.ts:32-80`) but do not mutate serializer,
  encoder, timer, or race primitives. Capture/use trustworthy primordials across
  the source call, or establish a separate boundary the source cannot modify,
  and add explicit spoof/monkey-patch cases.

### Medium — timeout classification is fixed, but timeout does not stop asynchronous work and the docs understate it

- Both ordinary injected timeout and unresolved browser-API timeout now map to
  `timed_out` with the registered timeout code (`run-javascript.ts:60-80,
  175-183`), and the focused test covers both (`run-javascript.test.ts:93-107`).
  This closes the initial categorical-timeout finding.
- `Promise.race` does not cancel the losing `execution` promise
  (`run-javascript.ts:94-96`). Source awaiting a later promise can continue to
  read/mutate the page or initiate network activity after FluxIQ has reported a
  timeout and advanced or retried. The outer deadline also stops only the
  extension's wait (`run-javascript.ts:60-69`).
- Downstream docs say only that synchronously busy code cannot be forcibly
  terminated (`docs/architecture/extension-client.md:160-162` and
  `docs/architecture/web-capabilities.md:145-146`). They must say that timeout
  does not terminate any still-running user script, with synchronous
  non-termination as the most severe case, so operators understand late side
  effects and retry risk.

## Initial finding re-evaluation

- **Initial High, command-attempt persistence:** fixed for the kept/in-memory and
  file-backed command attempt, including real adapter execution and real caller
  projection. Not fixed for the complete persistence/event boundary because of
  the two High findings above.
- **Initial Medium, injected timeout reported as generic failure:** fixed; both
  injected and outer deadlines are categorical timeouts. Ongoing-script
  cancellation remains a distinct limitation and documentation defect.
- **Initial Medium, output measured only after transport:** fixed for ordinary
  source, but not adversarially closed because the source shares and can mutate
  the wrapper's later-used globals. The extension-side recheck bounds accepted
  output, not transport already incurred.
- **Initial Low, Chromium permission changes before selection:** accepted as an
  explicit product tradeoff. Chrome/E2E declare required `userScripts`
  (`manifest.chrome.json:16-24`, `manifest.e2e.json:16-24`); Firefox declares it
  optional without a request path (`manifest.firefox.json:14-24`). The docs now
  state both the up-front Chromium declaration/toggle and Firefox fail-closed
  limitation accurately (`extension-client.md:153-162`).

## Claims that survived re-review

- The definition-owned persistence switches cannot be supplied by a Flow action
  payload; Core obtains them from `io.getOutput(...)`. The target receives the
  unmodified command, persistence-only context flags are not sent onward, and
  the caller receives the real result.
- `resultPath` is bounded, own-property-only, and rejects prototype-pollution
  segments; direct IO and runtime dispatch both project it, missing/invalid paths
  withhold the port, and outputs without it keep their envelope
  (`io-policy.ts:21-58,76-161`). The declared JS `result` port matches the
  downstream path.
- Executor source/input byte caps, recursive JSON-object validation, and timeout
  range checks remain fail-closed before browser execution
  (`run-javascript.ts:41-58,128-158`). Raw thrown error text does not cross the
  wrapper.
- Executable source remains literal-only and is valid only on an executable,
  privileged, operator-approved definition (`nodes/definitions.ts:242-255`).
  LLM validation keys its exception to the exact registered parameter object;
  copied conventional `code`/`script` fields are still refused and ordinary
  nested `metadata.source` remains data (`llm/harness/output-validation.ts:65-115`).
- The web node is on the existing strongest review path: action safety is
  `review`, node safety is privileged plus operator approval, and bootstrap risk
  is Core-derived high. USER_SCRIPT isolation and page-level power are described
  honestly apart from the timeout wording above.

## Untracked-file and scope accounting

Three integration-critical files remain untracked and must be included together:

- downstream `apps/extension/src/runtime/run-javascript.ts`
- downstream `apps/extension/src/runtime/tests/run-javascript.test.ts`
- Core `packages/fluxiq/src/programs/automation-studio/runtime/llm/harness/tests/output-validation.test.ts`

The initial adversarial, live, and remediation reports are also untracked, as is
this report. The final modified list otherwise stays within the node/action,
gateway/runtime, manifests, focused tests, architecture docs, and paired working
documents. No temporary Scenario Lab, test-runner, flow-lane, provider-harness,
or live-instruction source edit is present.

## Review actions

Read the assigned Current State and reports, inspected every modified/untracked
path in both paired worktrees, and traced the command attempt, runtime event,
graph trace, session persistence, result projection, wrapper, timeout, manifest,
and definition-validation paths. I edited only this report. I did not run tests,
a browser, a provider call, or any write-producing validation, and did not commit
or push.
