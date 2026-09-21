# w2-arbitrary-js-remediation-live report

## Outcome

Done. All high- and medium-severity adversarial findings were corrected, the
same hand-authored two-JavaScript-node journey passed again in a real browser,
and focused post-live tests, checks, and builds passed. No provider call was
made.

## Remediation

- Core now supports trusted output-definition metadata that omits the complete
  command parameter object and withholds the raw result payload only from the
  runtime attempt it keeps and saves. The adapter still receives the real
  command, and the caller still receives the real result for downstream port
  projection. These are definition-owned registry declarations, not Flow- or
  model-controlled switches.
- The JavaScript output opts into both persistence controls. A focused disk
  test uses three different source, input, and result sentinels: the adapter
  receives source and input, the downstream projected result is real, and none
  of the three occurs in the saved attempt. Its saved command has no
  `parameters`; its saved result payload is the standard runtime withheld
  marker.
- This does not remove source from its reviewed owner. Literal source remains
  durable in the Flow definition by design so an operator can inspect exactly
  what will run; only runtime command-attempt copies omit JavaScript parameters
  and raw payload.
- The USER_SCRIPT wrapper now returns a private tagged envelope. It awaits the
  result, serializes it, enforces the output byte cap in USER_SCRIPT before
  browser transport, and returns only bounded categorical outcomes. The
  extension validates the tag and shape, rechecks the byte bound, and then
  parses the JSON. Raw thrown errors do not cross the boundary.
- Both the injected asynchronous deadline and the outer unresolved browser API
  deadline now produce `timed_out` with the registered timeout failure code.
  As documented, FluxIQ stopping its wait cannot forcibly terminate
  synchronously non-terminating page code.
- The Chromium `userScripts` permission remains required and declared up front.
  Chrome/Edge additionally require the per-extension **Allow user scripts**
  toggle. This is documented instead of claiming permissions remain unchanged
  until node selection. Firefox remains optional-permission, has no request
  path, and fails closed when ungranted.

## Fresh live evidence

- Browser: isolated Playwright Chromium 151.0.7922.34 with the real unpacked
  extension; user agent 151.0.0.0. The isolated profile's **Allow user scripts**
  toggle was already enabled and the browser was restarted before execution.
- Topology: dedicated Core/panel API on port 3391, gateway on 4891, and Scenario
  Lab on 4391. The protected user service/profile and shared development ports
  were not used.
- Flow: canonical parent/router/subflow with Start -> JavaScript 1 -> Set
  Variable -> JavaScript 2 -> End. JavaScript 1's declared `result` data edge
  supplied the Set Variable value; JavaScript 2 read that state binding.
- Result: the run and all five subflow nodes succeeded. JavaScript 2 consumed
  both independently returned fields from JavaScript 1, and the page exposed
  both expected markers (`7` and `js-live`). The result-port oracle and page
  oracle both passed; success was not inferred from action status alone.
- Existing trace withholding correctly prevented persisted traces from serving
  as a raw-result oracle. The fresh proof therefore verified the ephemeral
  result path by having the second node expose both received fields on the
  disposable page.
- Disposable live harness scripts were removed after the run. No source,
  returned page payload, credentials, tokens, or browser-profile data is copied
  into this report beyond the bounded structural oracle above.

## Focused validation

- Downstream focused tests: 39/39 passed, covering metadata registration,
  parameter contracts, exact/over-limit envelope behavior, very-large-result
  refusal before transport, non-JSON/error refusal, both timeouts, executor
  source/input limits and object shape, and permission failure.
- Core focused tests passed for runtime service persistence, Automation Studio
  IO policy/projection, canonical registry validation, executable-source output
  validation, and bootstrap plan risk/parameter checks. Vitest reported 288
  passes because it also discovered generated temporary copies; the current
  source files all passed.
- `pnpm --filter @fluxiq-web-extension/domain check` -> passed.
- `pnpm --filter @fluxiq-web-extension/extension check` -> passed.
- `pnpm --filter fluxiq check` -> passed.
- `pnpm --filter fluxiq build` -> passed.
- After Core's build completed, downstream domain and extension builds passed
  in dependency order. An earlier concurrent attempt failed only because Core's
  clean/rebuild temporarily removed the linked declarations.
- `git diff --check` passed in both worktrees (Core printed line-ending
  warnings). No broad repository suites were run.

## Remaining boundaries

- No provider journey was requested or run. The prior report's model-authored
  proposal gaps are unchanged by this remediation.
- Firefox and other Chrome/Edge versions were not live-tested. Unsupported or
  ungranted `userScripts` remains explicitly fail-closed.
- Required Chromium permission is the accepted disposition of the low-severity
  review note; this remediation does not implement an optional permission
  request flow.

## Scope and handoff

The remediation changes are confined to the existing owned JavaScript executor,
output/manifest definitions, focused tests, runtime persistence/IO seams, and
their architecture documentation. No temporary Scenario Lab, test-runner,
flow-lane, provider-harness, or live-instruction source edits remain. No commit
or push was made.
