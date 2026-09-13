# g-web-timeout-forwarding — the extension's own timeout reaches the run

Worker: `g-web-timeout-forwarding`. Core `F:\!FluxIQ` at `604d0d3` (`dev`), still
at the end. This repository started at `cfa1bfb`. During the run it moved to
`af80298`, the supervisor's upload commit, which touched none of this brief's
files. Nothing committed; every change below is uncommitted in both trees.

## Outcome

**Done, as decided.** Proven by unit tests and mutations only. No Lab run, and
no Core build, so the two halves have not yet run together.

- **Core waits the command's timeout plus 3,000 ms,** for every runtime target
  and for a gateway command that carries a timeout.
- **The web adapter now sends the extension the command's timeout.**
- **The three comments match the new design.**
- **Nothing that passes today can newly fail,** with one caveat. A Flow node
  whose output parameters carry their own shorter `timeoutMs` now waits the
  node's timeout instead (see §3).

## What changed and why

### 1. Core

- **`packages/fluxiq/src/client-gateway/service/command-answer-margin.ts`** (new)
  holds `COMMAND_ANSWER_MARGIN_MS = 3_000` and the reasoning behind it.
  - **Why here.** `runtime/` already depends on `client-gateway/`, and not the
    other way round.
  - **Barrel.** It is exported through `client-gateway/service/index.ts`. That
    line was not in the brief, but a new module needs it.
  - **Not public.** The facade `client-gateway/service.ts` re-exports only the
    names it lists, so the public API is unchanged. The reference diff agrees:
    only two moved line numbers.
- **`runtime/service.ts` `withRuntimeBounds`.** A command with a positive
  `timeoutMs` now times out after `timeoutMs + COMMAND_ANSWER_MARGIN_MS`, for
  every adapter and transport target (decision A1).
  - **New message:** `Runtime command timed out after <wait>ms: no answer within
    its <timeoutMs>ms timeout and 3000ms answer margin.`
  - **Import.** `../client-gateway/service/index.ts`. The imports rule allows any
    `index` file.
- **`client-gateway/service/commands.ts` `executeAction`.** A sent timeout now
  waits `command.timeoutMs + margin`, and a command without one still waits
  `commandTimeoutMs`. The wire message still carries the original `timeoutMs`,
  and the test pins that. The message names the full wait.
- **Tests.**
  - **`runtime/tests/service.test.ts`.** I replaced "times out commands through
    slow adapters", which would now wait 3 s of real time, with two parametrised
    rows, each run for an adapter and a transport target:
    - an answer at `timeoutMs + 250 ms` is returned exactly as the target sent
      it, `failure` record included;
    - a silent target is not settled at `timeoutMs + margin - 1`, is `timed_out`
      at `timeoutMs + margin`, and has no `failure` (fake timers).
  - **`client-gateway/tests/service.test.ts`** gains the same two rows through
    `ClientGatewayService`:
    - the late answer keeps its record, and the wire `timeoutMs` is unchanged;
    - for a silent client, a sent timeout waits the margin, and a command without
      one waits `commandTimeoutMs` (1,000 ms here);
    - the margin is pinned at 3,000.
- **Docs.**
  - `docs/architecture/runtime-kernel.md` gains a "Command Deadlines" section.
  - `docs/architecture/package-boundaries.md`, 0.4.0 entry: a new reader bullet
    and a paragraph covering the deadlines, what stays unchanged, what hosts
    see, and the message text.
  - `pnpm docs:reference` regenerated both `framework-reference.md` copies: 4
    lines, from `RuntimeService` `:28→:29` and `RuntimeServiceOptions`
    `:22→:23`.
- **Not added: a policy-level `output_dispatch.timed_out` row.** It would live in
  `programs/automation-studio/runtime/tests/`, which this brief does not own.
  The two ends already have tests:
  - `io-policy.test.ts:21-31` maps `timed_out` without a record to
    `output_dispatch.timed_out`;
  - `:39-45` keeps a valid host record.

### 2. Domain

- **`domain/src/runtime/adapter.ts`.** The adapter sets `request.timeoutMs` from
  `command.timeoutMs` when it is a positive finite number.
  - That matches the condition under which Core arms a deadline.
  - An absent, zero or non-finite timeout is not sent, so the client keeps its
    own default, as before.
- **`domain/src/io/gateway-output-dispatcher.ts`.**
  - **Signature.** The request type is
    `OutputDispatchRequest<JsonObject> & { timeoutMs?: number }`. This is
    domain-only: Core's `OutputDispatchRequest` lives in `io/index.ts`, not
    `runtime/contracts.ts`, and was not touched.
  - **The command.** It is built field by field and gains `timeoutMs` only when
    the request has one.
  - **Callers without a timeout are unchanged:** Core's IO output path
    (`web-automation-io.ts:44`, `web-panel-host.ts:59`), the host-runtime
    dispatch (`host-runtime.ts:109`), and the LLM evidence tools, which call the
    gateway directly.
- **Tests.**
  - **`runtime/tests/adapter.test.ts`:**
    - `timeoutMs: 5_000` reaches the gateway command;
    - no timeout sends none;
    - `0` sends none.
  - **`io/tests/gateway-output-dispatcher.test.ts`:** a request's timeout is sent
    and a request without one sends none. The recording fake now records
    `timeoutMs` when present.
- **Where the timeout lands.** `domain/src/client/gateway-mapping.ts:175` already
  maps `command.timeoutMs` onto the extension's action. I read it but did not
  test it here.

### 3. Task 2: can something that passes today newly fail?

**On the Flow lane, before this change, Core's 5,000 ms deadline bounded every
action.**
- `builtin.policy.action` always sends `timeoutMs`, 5,000 by default
  (`nodes/policy/action.ts:20,40`).
- `withRuntimeBounds` armed it for the `web-automation.gateway` adapter target.
- The extension was sent no timeout, so it used its own defaults.

**Web verbs whose extension default exceeds the node's 5,000 ms and that read
`action.timeoutMs`:**

| Verb | Extension default | Where | Already bounded by Core's 5,000 ms on the Flow lane? |
| --- | --- | --- | --- |
| `web.dom.wait_for_selector` | 10,000 ms | `wait-for-selector.ts:26` → `wait-conditions.ts:44`, `waits.ts:17` | Yes |
| `web.dom.wait_for_text` | 10,000 ms | `wait-for-text.ts:25` → `wait-conditions.ts:44` | Yes |
| `web.browser.tab` switch by path | 10,000 ms (0 without a path) | `browser-tab.ts:49,143,197` | Yes |
| `web.browser.download` | 30,000 ms, clamped 1,000-120,000 | `command-options.ts:101` (`download.timeoutMs` wins), `browser-download.ts:19-21,149` | Yes |

**Checked and not affected by the forwarding:**
- **`web.dom.assert`.** Its default is 5,000 ms (`assertion-evaluation.ts:63`),
  which does not exceed the node's. It reads only its own `assert.timeoutMs`
  (`gateway-action-parameters.ts:167`), not `action.timeoutMs`.
- **Waits that never read `timeoutMs`:** a click's landing wait, 10,000 ms
  (`click-landing.ts:49`); the list-change wait, 10,000 ms
  (`list-extraction.ts:48`); the tab settle, capped at 20,000 ms
  (`automation-tab.ts:108`). Core's 5,000 ms bounded them before; they are now
  bounded at 8,000 ms.

**Why nothing newly fails.**
- **Old outcome.** An action whose answer came back more than 5,000 ms after
  Core armed its deadline was already reported `timed_out`.
- **The extension's budget starts later.** It now waits the node's timeout, but
  that clock starts only after the command arrives and the tab settles (at least
  1,000 ms). So any action that answered inside Core's old 5,000 ms also
  finishes inside its own 5,000 ms budget.
- **Core also waits longer.** Some actions that failed before can now succeed,
  or report the extension's own code. None that passed can fail.

**Caveats.**
1. **A node timeout now overrides the output's own `parameters.timeoutMs`.**
   `gateway-mapping.ts:175` prefers `command.timeoutMs`, and on the Flow lane that
   is now always present.
   - Before, a node whose output parameters held a shorter `timeoutMs`, say
     2,000, waited 2,000 ms. Now it waits the node's 5,000 ms.
   - A wait that used to time out at 2,000 ms, but whose target appears before
     5,000 ms, now succeeds. A negative expectation built on that shorter
     timeout would change.
   - No recording proposal in `domain/src/recording` writes `timeoutMs` into
     parameters; the only hit is the `late-target-wait.ts` comment. I did not
     read the approved week1 Flows, which are Lab data.
2. **A late success can be judged unobserved.** The bound confirmation input's
   wait (`confirmationTimeoutMs`, 5,000 by default) starts before dispatch. An
   action that now succeeds between 5,000 and 8,000 ms after dispatch can report
   `output_not_observed`. Only actions that already failed on the old deadline
   reach that window.
3. **Timing shifts, verdicts do not.**
   - A hung target is reported 3,000 ms later on every runtime target.
   - W25 `too-slow` should take about 6.1-6.4 s instead of 5.0 s.
   - Neither changes a passing verdict.
4. **Paths without a node timeout are unchanged.** That is the IO fallback path
   (`io-policy.ts:21-40`), expectation claims and LLM tools. They still send no
   timeout, wait the gateway's 30,000 ms default, and use extension defaults.

### 4. The three comments

- **`apps/scenario-lab/src/scenarios/delayed-ui/scenario.ts:15-24`.** The armed
  delay is 20× the recorded wait, 4× the node's 5,000 ms (now sent to the
  extension), and 2× the 10,000 ms default for a wait sent with no timeout. The
  replayed wait therefore ends in the extension's own `web.action.timeout`,
  inside Core's 8,000 ms deadline.
- **`domain/src/recording/proposals/late-target-wait.ts:15-19`.** The wait
  carries no `timeoutMs` in its parameters. A replay waits its node's timeout,
  which the adapter sends as the command's timeout.
- **`apps/extension/src/runtime/action-runner.ts:197-201`.** Core does stop
  waiting: for a Flow action after its timeout plus the margin, and for a command
  with no timeout after the gateway default. But it can say only that the client
  never answered, while the command still hangs in the extension.

### Compatibility effect

- **Core (`fluxiq` 0.4.0, unreleased entry updated).** No type or export
  changes. What changes:
  - the runtime deadline, +3,000 ms for every target with a positive timeout,
    in-process adapters included;
  - the gateway pending-command deadline, +3,000 ms when a timeout is sent;
  - both timeout messages.
- **Now reported.** An answer that arrives inside the margin is reported, with
  its record.
- **Unchanged.** The 30,000 ms default for a command without a timeout, the wire
  `timeoutMs`, and the meaning of `output_dispatch.timed_out`.
- **Domain.** `dispatchWebAutomationOutput` gains an optional request field,
  which is additive. The web adapter now sends `timeoutMs` on every Flow action.
- **Order matters.** The domain resolves `fluxiq` from Core's built `dist`
  (`packages/fluxiq/package.json` exports).
  - **Domain change alone, with today's Core build.** It is harmless but inert.
    Core still gives up at 5,000 ms, and W25 `too-slow` still reports
    `output_dispatch.timed_out`.
  - **The fix takes effect** only after Core `pnpm build`, which the brief
    forbade here.

## Commands run and observed results

- **Core test files, before mutations.**
  `npx vitest run src/runtime/tests/service.test.ts src/client-gateway/tests/service.test.ts --no-file-parallelism`
  (from `packages/fluxiq`): `Test Files 2 passed (2)`, `Tests 27 passed (27)`.
  Rerun after a test-title fix: the same, 27 passed, exit 0.
- **Domain test files, focused.** The scratch runner
  `gwtf-domain-focus.mjs io/tests/gateway-output-dispatcher.test.ts runtime/tests/adapter.test.ts`
  bundles the two files as `domain/scripts/test-domain.mjs` does, into
  `.test-build-scratch/g-web-timeout-forwarding-focus`: `# tests 28`, `# pass 28`,
  `# fail 0`, exit 0.
- **Mutations.** Each ran through `gwtf-mutate.mjs`, which copies the file aside,
  makes one exact replacement, runs the command, and restores in `finally` with a
  sha256 comparison. They ran one per file, in two pairs that share no module.
  - **M1,** `runtime/service.ts` `waitMs = command.timeoutMs` (the old deadline):
    `Tests 4 failed | 10 passed (14)`. Both late-answer rows ("expected … to deeply
    equal …") and both silent rows ("the runtime is still waiting inside the answer
    margin: expected {…} to be undefined") failed. Restored, hash `94fca5e49b50c5ad`
    MATCH.
  - **M2,** `commands.ts` `command.timeoutMs + margin` → `command.timeoutMs`:
    `Tests 2 failed | 11 passed (13)`. The late-answer row ("expected { …(3) } to
    match object { …(4) }") and the silent row ("the gateway is still waiting inside
    the answer margin") failed. Restored, hash `e763c5f00a7fe191` MATCH.
  - **M3,** `adapter.ts` forwarding replaced by `void 0`:
    `not ok 11 - the command's timeout is sent to the client …`, `# fail 1` of 20.
    Restored, hash `d5811536878a4e54` MATCH.
  - **M4,** dispatcher line dropped:
    `not ok 2 - a request's timeout is sent as the command's timeout …` and
    `not ok 19 - the command's timeout is sent to the client …`, `# fail 2` of 28.
    Restored, hash `91c25d4f1142b59e` MATCH.
- **Domain check.** `pnpm check` (in `domain`), which runs
  `tsc -p tsconfig.json --noEmit && tsc -p tsconfig.test.json`: exit 0, no
  diagnostics.
- **Core check.** `pnpm check` (in `F:\!FluxIQ`): `structure-audit: passed (122
  warning(s), 256 baselined)`; `packages/contracts`, `client-gateway-websocket`,
  `fluxiq` and `apps/web` `tsc --noEmit` all `Done`; exit 0. Advisory warning
  only: `packages/fluxiq/src/runtime/service.ts: 454 lines is past the 400-line
  advisory threshold`.
- **Core reference docs.** `pnpm docs:reference`: `Wrote … (1577 public
  declarations)`, exit 0. `git diff --stat` shows 2 files and 4 lines.
  `pnpm docs:check`: `Validated local links in 101 authored/reference Markdown
  files.` `Deterministic framework reference is current.` Exit 0.
- **Extension structure audit.** `node scripts/structure-audit.mjs` (in
  `F:\!FluxIQWebExtension`): `structure-audit: passed (41 warning(s), 17
  baselined)`, exit 0. New advisory warning: `domain/src/runtime/adapter.ts: 406
  lines is past the 400-line advisory threshold`. The hard limit is 800.
- **Domain test, all files.** `DOMAIN_TEST_BUILD_LABEL=g-web-timeout-forwarding
  pnpm test` (in `domain`): `# tests 401`, `# pass 401`, `# fail 0`, `# cancelled
  0`, exit 0.
- **Cleanup.**
  - Both `.test-build-scratch` label folders removed; `Test-Path` reports False.
  - `git status --short -- domain/.test-build`: no lines.
  - Scratch backups deleted from the scratchpad.

No run failed, so no RAM rerun was needed. Each result above is a single run,
apart from the two Core test files, which ran twice.

## Not verified

- **Core and domain together.** The domain tests run against Core's `dist`, built
  at `6621d66`, so no test exercised the forwarded timeout against the new
  deadline.
- **No end-to-end row.** One does not fit without a Core build: a domain test
  through `RuntimeService` would use the old 5,000 ms deadline. The content
  harness and Lab were out of scope.
- **No live run.** W25 `delayed-ui --flow --variant too-slow` should report
  `{"category":"timeout","code":"web.action.timeout"}` in about 6.1-6.4 s after
  Core is built. Not observed.
- **The full Core suite did not run.**
  - Not run: `io-policy.test.ts`, the bridge tests, `client-gateway-websocket`
    tests and `apps/web` tests.
  - Grep supports skipping them. The only other Core tests that construct
    `RuntimeService` (`io-bridge.test.ts`, `io-policy.test.ts`) set no command
    `timeoutMs`.
  - No Core test file sends a gateway command with a `timeoutMs` apart from the
    rows added here.
- **Extension and scenario-lab gates did not run.** The changes there are
  comments only; the structure audit covered them.
- **Extension adoption.** That the extension adopts `command.timeoutMs` rests on
  reading `gateway-mapping.ts:175`, not on a test run here.
- **Week1 Flows.** Whether any approved week1 Flow carries `parameters.timeoutMs`
  (caveat 1) was not checked.

## Open questions or contradictions found

- **Another stale comment, outside this brief.**
  `apps/extension/src/content/actions/execute.ts:11-15` says "Core applies no
  runtime deadline to a web action and `timeoutMs` is deliberately kept out of
  the effect payload so a Core timer cannot displace the structured `timed_out`
  result the client reports itself". Both halves are false now:
  - Core bounds the action at its timeout plus the margin;
  - the adapter sends `timeoutMs` to the client.
- **Precedence of the node timeout** (caveat 1). `gateway-mapping.ts:175` lets the
  node's timeout override an output's own `parameters.timeoutMs`. Now that the
  timeout is always sent on the Flow lane, should an explicit parameter timeout
  win instead? That would be a domain mapping change.
- **Brief ownership versus the files needed.**
  - I added a line to the `client-gateway/service/index.ts` barrel, which the
    brief did not list.
  - The brief tied `runtime/contracts.ts` to `OutputDispatchRequest`, but that
    type is in Core `io/index.ts`. I kept the field domain-only, so Core IO's
    fallback path (`dispatchPolicyOutput`) still sends no timeout.
- **What the margin does not cover.** The tab settle's 20,000 ms cap for a tab
  that keeps navigating (`automation-tab.ts:108`) is still outside the margin, as
  `g-core-dispatch-deadline` noted.
- **Before a Lab recheck of W25,** Core needs `pnpm build`, and the domain host
  build must pick it up.
