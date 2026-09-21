# w2-arbitrary-js-adversarial-review report

## Outcome

Not ready to integrate as reviewed. The registered-source allowlist, privileged
definition invariant, input/source validation, result-path projection, and
fail-closed API probing survived static review. One high-severity privacy defect
and two medium runtime-boundary defects remain. No provider or live-browser call
was made and no product or test file was edited.

## Findings

### High — JavaScript source, inputs, and returned page data enter saved runtime command attempts

- Core sends the complete `action.parameters` to `runtime.dispatch` at
  `F:\fxwork\t029\!FluxIQ\packages\fluxiq\src\programs\automation-studio\runtime\io-policy.ts:89-96`.
  The only persistence controls supplied there are caller-provided
  `withheldValues` and `withheldResultPayload` for `recordOutput`, at lines
  98-104. `web.dom.run_javascript` has no `recordOutput` and the new code adds no
  withholding for its literal `source` or `inputs`.
- The existing persistence tests make the consequence explicit:
  `runtime/tests/io-policy.test.ts:216-251` reads `attempt.json` and confirms
  command parameters are saved unless a resolved value was explicitly
  withheld; lines 272-282 confirm that a result payload is saved unchanged when
  `recordOutput` is absent.
- Therefore a JavaScript run persists its literal source and literal inputs in
  the command attempt, and persists the browser result payload before Core's
  `resultPath` projection. That result may contain arbitrary page data. This
  falsifies Current State's requirement that source, inputs, output, page data,
  and secrets not enter logs or reports. It also bypasses the record-output
  privacy policy that protects extraction payloads.
- Required correction: execute with the real values but redact the JavaScript
  node's source and inputs from the saved command, and withhold its raw result
  payload from the saved attempt while preserving the ephemeral projected
  `result` value needed by downstream nodes. Add a persistence test that reads
  the saved attempt and proves none of the three sentinel values appears.

### Medium — the configured timeout is normally reported as a generic action failure

- The injected wrapper rejects its own race with `Error("fluxiq-timeout")` at
  `apps/extension/src/runtime/run-javascript.ts:83-85`.
- A rejected `userScripts.execute` promise is caught and mapped to generic
  `ACTION_FAILED` at lines 55-79 and 171-179. A browser-returned injection
  `error` is mapped the same way at line 67.
- The categorical timeout path at lines 65 and 160-168 is reached only if the
  outer API call remains unsettled for `timeoutMs + 1,000`; the wrapper's normal
  asynchronous timeout happens about one second earlier and is therefore not a
  `timed_out` result. This breaks timeout classification and any recovery logic
  that depends on the typed timeout category.
- The focused executor tests end at permission refusal
  (`runtime/tests/run-javascript.test.ts:67-77`) and do not exercise timeout.
  Return a private tagged timeout outcome from the injected wrapper (without
  exposing raw script errors), or otherwise distinguish this exact condition,
  and assert `status: "timed_out"` plus the timeout failure code.

### Medium — the output byte limit is enforced only after unbounded browser-to-extension transport

- `userScripts.execute` first resolves with `injected.result` at
  `apps/extension/src/runtime/run-javascript.ts:55-68`. Only afterward does
  `boundedJsonValue` serialize and measure it at lines 95-107.
- Consequently an arbitrarily large returned array/object has already been
  allocated, structured-cloned across the browser API boundary, and retained in
  the extension before the 65,536-byte check runs. The code bounds accepted
  output, but does not bound output materialization or transport as the plan and
  `docs/architecture/web-capabilities.md:137-138` claim. A reviewed or generated
  mistake can cause substantial browser/extension memory pressure before it is
  rejected.
- Have the user-script world serialize and byte-check the value before returning
  a small tagged envelope, then parse that bounded string in the extension.
  Add exact-limit, over-limit, non-JSON, and large-result tests.

### Low — Chrome/Edge permissions change before the node is selected

- `apps/extension/manifest.chrome.json:16-24` and
  `apps/extension/manifest.e2e.json:16-24` add `userScripts` to required
  permissions, so it is declared installation-wide even when no JavaScript node
  is selected. This does not satisfy Current State's literal requirement that
  existing permissions remain unchanged until selection. Firefox instead uses
  an optional permission at `manifest.firefox.json:22-24`, although its missing
  request path remains an explicitly documented limitation.
- If unchanged-until-selection is an acceptance requirement, use an optional
  grant/request design on Chromium as well; otherwise revise that requirement
  before integration rather than claiming it passed.

### Integration risk — critical implementation/test files are untracked

`git diff --name-only` omits three files that `git status --short` reports as
untracked:

- `apps/extension/src/runtime/run-javascript.ts`
- `apps/extension/src/runtime/tests/run-javascript.test.ts`
- `packages/fluxiq/src/programs/automation-studio/runtime/llm/harness/tests/output-validation.test.ts`

The first is already imported by tracked changes, so omitting it from the task
commit makes the extension fail to build. This is not an unrelated product
change, but the supervisor must explicitly include all three at integration.

## Claims that survived review

- **Executable-source allowlist identity:**
  `runtime/llm/harness/output-validation.ts:65-115` builds a WeakMap from the
  exact plan parameter object to only the registered executable parameter key.
  Copying source under conventional `code`, `script`, `functionBody`,
  `javascript`, or `typescript` keys remains rejected; the focused tests at
  `runtime/llm/harness/tests/output-validation.test.ts:82-93` cover the allowed
  identity, a copied `code` key, and ordinary nested source-labelled data.
- **Privileged/operator-review definition invariant:**
  `nodes/definitions.ts:243-254` requires executable source to be a literal
  string on an executable, privileged node with operator approval. The web node
  sets `privileged` and `requiresOperatorApproval` together at
  `domain/src/output-nodes/definitions.ts:145-161`, and its source explicitly
  disables state binding at lines 210-220. The Core plan test at
  `runtime/flow-bootstrap/tests/plan.test.ts:410-424` expects canonical high
  risk. This is static evidence only; the model-authored review/apply UI journey
  remains unverified exactly as the live report says.
- **Source and input acceptance bounds:** source and object inputs are byte
  checked at plan-contract time (`domain/src/output-nodes/parameter-contracts.ts:13-24`),
  gateway lifting (`domain/src/client/gateway-action-parameters.ts:71-126`), and
  again before browser execution (`apps/extension/src/runtime/run-javascript.ts:45-52`).
  The executor's recursive JSON check rejects non-finite numbers, cycles,
  non-plain objects, and depth beyond 64 at lines 117-131. The output acceptance
  bound also rejects non-JSON and over-limit values, subject to the pre-check
  transport defect above.
- **Result projection and pollution resistance:** Core accepts only short,
  bounded, alphanumeric/underscore/hyphen dot segments, blocks `__proto__`,
  `constructor`, and `prototype`, and traverses own properties only at
  `runtime/io-policy.ts:137-156`. Direct and runtime paths both call it. Missing
  or malformed paths withhold the port value, while outputs without a
  `resultPath` retain their old envelope; focused tests cover both dispatch paths
  and the ordinary-output regression at `runtime/tests/io-policy.test.ts:65-102`.
- **Permission/API failure closes execution:** the extension refuses when
  `userScripts.execute` is absent or the no-argument `getScripts()` probe rejects
  (`apps/extension/src/runtime/run-javascript.ts:38-44`, 146-157). It never falls
  back to `eval` in the extension or content-script world, and returned browser
  error text is not copied into the public failure message.
- **Browser claims are honest:** Chrome/E2E declare the required API permission;
  Firefox declares it optional and the docs explicitly say there is no request
  path and no verified parity. `USER_SCRIPT` is requested explicitly at
  `run-javascript.ts:57-61`. The synchronous non-termination limitation is also
  documented accurately.
- **No unrelated product area was changed:** the changed paths are confined to
  the registered node/action/runtime/policy/catalog contracts, their focused
  tests, three manifests, runtime labeling, and authored documentation. The
  working-plan/report changes are task bookkeeping. The untracked-file hazard
  above is the only integration-scope anomaly found.

## Validation performed

- Read the assigned Current State, adversarial brief, and live implementation
  report.
- Inspected the final modified and untracked implementation/test files in both
  paired t029 worktrees and checked `git status --short` to account for files
  omitted by `git diff --name-only`.
- Did not run provider calls, browser journeys, builds, or tests. The prior
  focused-pass claims were treated as reported evidence, not independently
  re-verified here.
