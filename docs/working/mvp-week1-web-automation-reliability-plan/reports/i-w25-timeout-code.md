# i-w25-timeout-code — why W25 `too-slow` reports Core's dispatch timeout, not the action's own

Worker: `i-w25-timeout-code` (read-only). Core read at `F:\!FluxIQ` (`6621d66`), this
repository at `5bad6c3`. Bundles read for timings, ids and codes only.

## Outcome

Done. The cause is structural, not a race that the extension occasionally loses.
- **One number, two jobs.** Core uses the Flow node's `timeoutMs` as the time the
  client is given to do the action, and also as Core's own deadline for the answer.
- **Where the 5,000 ms comes from.** The recorded wait's node has no `timeoutMs`,
  so it gets the node default of 5,000 ms.
- **Why Core always wins.** Core starts both of its clocks before it sends the
  command, and they do not wait for the answer's trip back. The extension's clock
  starts only after about one second of tab settling.
- **What that means.** Core's 5,000 ms deadline always fires first. A client that
  honours its own timeout exactly can never report it.

Recommended fix: **Core's dispatch deadline covers the action's declared timeout
plus a margin.** A user should see `web.action.timeout`.

## What changed and why

Nothing but this report; the brief is read-only.

### 1. Where Core's dispatch deadline comes from, and how it relates to the other timeouts

The wait node's timeout, traced end to end:

1. **The proposal carries no timeout.** The wait is proposed by
   `domain/src/recording/proposals/late-target-wait.ts:90`, as
   `{ outputId: "web.dom.wait_for_selector", parameters: { selector, wait: { condition: "present" } } }`.
   It has no `timeoutMs`; the comment at `:15` says so on purpose. The recording
   script's `timeoutMs: 1000` (`delayed-ui/scenario.ts:35`) is the Lab's own
   recording step, and it never reaches the Flow.
2. **Approval adds none.** An approved candidate's node `parameterValues` hold only
   `outputId`, `parameters`, the confirmation fields and `expectedState`
   (Core `programs/automation-studio/runtime/service/recordings/proposal-candidates.ts:102-107`).
   No node-level `timeoutMs` is added.
3. **The node default is 5,000 ms.** `builtin.policy.action` declares `timeoutMs`
   with a default of 5000 (`nodes/policy/action.ts:20`). Its effect payload is
   `timeoutMs: context.parameters.timeoutMs ?? 5000` (`action.ts:40`).
4. **Core passes it to the runtime.** `createRuntimePolicyEffectDispatcher` passes
   `timeoutMs: payload.timeoutMs` to `runtime.dispatch`
   (`runtime/io-policy.ts:94`).
5. **Core timer one, the runtime bound.** `withRuntimeBounds`
   (`runtime/service.ts:361-371`, called from `:274`) arms
   `setTimeout(..., command.timeoutMs)`. When it fires, it resolves
   `status: "timed_out"`.
6. **Core forwards the same number to the client.** `actionCommandFromRuntime`
   copies `timeoutMs` onto the wire command (`runtime/client-gateway-transport.ts:172`).
7. **Core timer two, the gateway's pending command.**
   `ClientGatewayCommands.executeAction` sends that command
   (`client-gateway/service/commands.ts:64,73`). It also arms
   `setTimeout(..., command.timeoutMs ?? config.commandTimeoutMs)` (`:65-70`),
   which resolves `timed_out` with no failure record. The 30,000 ms default
   (`client-gateway/service/config.ts:21`) applies only when no `timeoutMs` is
   sent.
8. **The extension adopts it as the wait's timeout.** The domain maps the command
   with `timeoutMs: numberValue(command.timeoutMs ?? parameters.timeoutMs)`
   (`domain/src/client/gateway-mapping.ts:175`). Core's 5,000 ms therefore becomes
   the action's own timeout, and it takes precedence over any `parameters.timeoutMs`.
   `wait-for-selector.ts:26` → `wait-conditions.ts:44` uses it, so the content
   script's 10,000 ms default (`waits.ts:17`) is not used on the Flow lane.
9. **The extension settles the tab first, outside its budget.** Before the content
   wait starts, `runBrowserActionCommand` awaits `waitForTabReady(tabId)`
   (`apps/extension/src/runtime/action-runner.ts:76`). That call always waits
   until the tab URL has been stable for at least 1,000 ms
   (`automation-tab.ts:124,131-137`, polled every 250 ms). It caps at 20,000 ms
   (`:108`). None of this counts against `timeoutMs`.
10. **The extension's timeout record.** When the wait runs out, the extension
    answers `status: "timed_out"` with
    `webAutomationFailureRecord(TIMEOUT, { expected, actual })`
    (`content/action-runtime/results.ts:207-222`). That record is `timeout`,
    `web.action.timeout`, retryable, stage `execution` (`domain/src/runtime/failure/codes.ts:46,131`).

How the three timeouts relate on the Flow lane:
- **Core's two deadlines and the extension's timeout are the same 5,000 ms.** The
  recorded 1,000 ms and the content default of 10,000 ms play no part.
- **Core's clocks start first.** Both are armed before the send.
- **The extension's clock starts later.** It begins after transit plus at least
  1,000 ms of tab settling, and its answer still has to travel back.
- **The answer is dropped.** If it arrives late, `settle` finds no pending entry
  (`commands.ts:80-81`) and discards it.
- **Core cannot produce the extension's code.** Core names only a code it can
  prove from its own signals: `failureForCommandStatus("timed_out")` returns
  `output_dispatch.timed_out` (`io-policy.ts:141-142`).
- **The extension's record would have won.** When a valid host record does
  arrive, `dispatchFailure` keeps it (`io-policy.ts:136`). `web.action.timeout`
  parses under Core's rules: `timeout` is neither never-retryable nor limited to
  target resolution (`packages/contracts/src/failure/parse-record.ts:17-31,62-63`).

### 2. From the bundles: which deadline fired first, and by how much

Action timings from `run.json`: the Lab's `startedAt` and `durationMs`, read from
Core's attempt `startedAt`/`finishedAt` (`packages/test-runner/src/flow-lane/persisted-flow-run.ts:185-196`).

| Run | runId | click | wait start | wait duration | wait status, code |
| --- | --- | --- | --- | --- | --- |
| W25 unarmed 1 | run-mtzxm4uj-8cbecf0d | +1,332 ms succeeded | 14:51:55.913Z | **1,007 ms** | succeeded |
| W25 unarmed 2 | run-mtzxnix3-7f9922ff | +1,329 ms succeeded | 14:52:58.668Z | **1,010 ms** | succeeded |
| W25 unarmed 3 | run-mtzxov12-38eac4fb | +1,328 ms succeeded | 14:53:58.722Z | **1,011 ms** | succeeded |
| too-slow 1 | run-mtzxq5v4-064e7668 | +1,337 ms succeeded | 14:55:02.230Z | **5,005 ms** | failed, `output_dispatch.timed_out` |
| too-slow 2 | run-mtzxrkqt-9301043c | +1,336 ms succeeded | 14:56:08.395Z | **5,011 ms** | failed, `output_dispatch.timed_out` |
| too-slow 3 | run-mtzxszv3-4f0f23db | +1,334 ms succeeded | 14:57:13.448Z | **5,004 ms** | failed, `output_dispatch.timed_out` |

For `run-mtzxq5v4-064e7668`:
- `evaluation.json` has `oracleVerdict=passed`, `reportedVerdict=failed`,
  `reported.code=output_dispatch.timed_out` and `expected.code=web.action.timeout`.
- `flow-lane.json` shows `actions.1.comparisonStatus=timeout` and both actions
  `targetResolution.status=unresolved_no_candidates`.

**Which deadline fired first: Core's.** It fired 5,004 to 5,011 ms after the wait
attempt began, which is its 5,000 ms timer plus a few ms of Core-side work.

**By how much: at least about 1 s.** Measured and inferred separately:
- **Measured, in 3 of 3 unarmed runs.** A wait whose element was already on the
  page took 1,007 to 1,011 ms end to end. The element is revealed 75 to 150 ms
  after the first click, and that click took about 1,330 ms. The wait itself
  resolves synchronously when already satisfied (`waits.ts:36-37`). So nearly all
  of those 1,010 ms is the fixed tab settle (`automation-tab.ts:137`) plus transit.
- **Inferred from code.** The extension's own 5,000 ms wait could report no
  earlier than about 6,000 ms after Core armed its timers: about 1,000 ms of
  settling, then 5,000 ms of waiting, then the return trip.
- **Not measured.** The extension's late answer is not in the bundle, so the
  exact gap was not observed.

Not the faulty-RAM shape: the result is identical in 3 of 3, has a concrete
timing, and is explained by code.

### 3. The right fix

**Choice: Core's dispatch deadline covers the action's declared timeout plus a
margin.** The deadline Core gives the client (the wire `timeoutMs`) must be
strictly shorter than the deadline Core keeps for the answer.

Where, all in Core:
1. **Gateway timer, `client-gateway/service/commands.ts:65-70`.** Keep sending
   `timeoutMs` unchanged (`:64`). When `command.timeoutMs` is set, wait
   `command.timeoutMs + grace`. Leave the `commandTimeoutMs` default path (30,000 ms)
   as it is. The grace belongs in `ClientGatewayConfig`
   (`client-gateway/service/config.ts:9,21`).
2. **Runtime bound, `runtime/service.ts:361-371`, from `dispatchToTarget` at
   `:274`.** For a `transport` target, which forwards `timeoutMs` to a remote
   client (`client-gateway-transport.ts:172`), bound at `timeoutMs + grace`.
   An in-process `adapter` target has no wire and no round trip, so it can keep
   the plain bound. That also keeps `runtime/tests/service.test.ts:194-213` as it is.
   **Both timers must change.** Either one left at `timeoutMs` still fires at
   5,000 ms and nothing changes.
3. **`io-policy.ts:141-142` stays.** `output_dispatch.timed_out` keeps its
   meaning: a client that did not answer within its budget plus the grace.

Sizing the grace:
- **What it must cover.** Transit both ways, plus client work outside the budget.
- **What was measured.** The extension's fixed tab settle is at least 1,000 ms
  (`automation-tab.ts:137`), and 1,007 to 1,011 ms was measured for a wait that
  needed no waiting.
- **Suggestion.** 1,000 ms is too tight on this machine; a named constant of
  about 3,000 ms leaves room. The supervisor sets the value.
- **The settle can run far longer.** It waits up to 20,000 ms if the URL keeps
  changing (`automation-tab.ts:108`), and no fixed grace covers that. A separate
  follow-up in this repository could count the settle against the command's
  budget. It is not needed for W25.

Tests the Core change needs:
- **A late answer keeps its record.** A client that answers `timed_out` with a
  valid host record just after `timeoutMs` keeps that record, and the policy
  result's failure is its `code`.
- **A silent client still times out.** A client that never answers still yields
  `output_dispatch.timed_out`, after `timeoutMs + grace`.
- **Mutation.** Setting the grace to 0 must make the first test fail, and it has
  to be checked at both timers.
- **Existing tests to check.** `client-gateway/tests/service.test.ts:112` and
  `runtime/tests/client-gateway-transport.test.ts:21,82`, which build the gateway
  with `commandTimeoutMs: 1000`, and `runtime/tests/io-policy.test.ts:21-31,131-142`.

**The code a user should see is `web.action.timeout`.**
- **It reports what happened.** The client stood nearest the page: it waited, the
  page never produced the element, and it said so.
- **Its record carries evidence.** It has `expected` ("an element matching …")
  and `actual` (`results.ts:219-221`, `wait-for-selector.ts:31`), plus the
  snapshot captured with the result.
- **It follows Core's own rule.** "A valid host-reported record wins"
  (`io-policy.ts:131-136`), and the domain's expectation evaluator follows the
  same rule (`domain/src/runtime/expectation/evaluate.ts:139-146`).
- **Core's code means something else.** `output_dispatch.timed_out` says the
  client did not answer, which is a hung or disconnected client and a different
  fault. Reporting it for a slow page loses the evidence. It also stops failure
  classification from telling a hung client apart from a slow page.

Why not the other two options:
- **Shortening the extension's timeout.**
  - The extension cannot know when Core's clocks started, because both are armed
    before the send, and it cannot know the return trip.
  - It would quietly turn a declared "give up after 5,000 ms" into about 3,900 ms
    of actual waiting.
  - It would have to be repeated in every verb that reads `timeoutMs`:
    `wait-conditions.ts:44`, `browser-tab.ts:143`, `command-options.ts:101`, and
    `assertion-evaluation.ts:68` for asserts.
  - Core's contract would stay wrong for every other client domain. That is
    generic framework behaviour, so it belongs in Core.
- **Naming only the category in the expectation.** This hides the defect rather
  than fixing it. The run passes, but the user is still told the client did not
  answer, the evidence is still dropped, and the W25 manifest stops protecting the
  code. It also does nothing for a non-timeout answer that arrives after 5,000 ms,
  which is still reported as `timeout`.

No change is needed in this repository for the fix itself. The manifest keeps
`code: "web.action.timeout"` (`delayed-ui/scenario.ts:51`, `tests/scenario.test.ts:27`).

### 4. Week1 rows and variants whose outcome the fix changes

The fix affects only Flow-lane actions whose extension answer arrives after
5,000 ms but within 5,000 ms plus the grace. The recording lane dispatches
through no Core Flow node and is not affected.

**The verdict changes, from failed to passed: W25 `delayed-ui --flow --variant too-slow`, one row.**
- It is the only week1 variant whose expected failure is `timeout`. The complete
  list of `expected.failure` entries across the scenarios is under Open questions.
- In run 3 its oracle already passed, 3 of 3. The click succeeded, the wait
  failed, and `late-action-absent` held. Only the code failed the run.
- Expected after the fix: `{"category":"timeout","code":"web.action.timeout"}`.
  Failing runs take longer by the grace.

**The reported code changes, but not the verdict:**
- **Any Flow-lane wait that runs out of time in another row.** Such a wait would
  report `web.action.timeout` instead of `output_dispatch.timed_out`, both
  `timeout`. No other week1 row expects `timeout`, so those rows fail on the
  category either way.
- **Which rows those are.** A late-target wait is proposed only before a
  CSS-selector click whose target a recorded DOM addition produced
  (`late-target-wait.ts:52-91`). Which week1 Flows contain one was not
  enumerated; that needs the approved Flows, meaning Lab data.

**Checked and unchanged:**
- **W10 `broken-link`, W19 `expired`, W27 `blocked-url`.**
  - These clicks are judged by their landing. A click's landing wait is not bound
    by `timeoutMs` (`click-landing.ts:49`).
  - Current State records them classified as expected in Stage 2, 3 of 3. So their
    answers already arrive inside 5,000 ms.
  - Their URL claims are dispatched by the expectation evaluator through
    `automationStudioClientGateway.executeAction` with no `timeoutMs`
    (`domain/src/io/gateway-output-dispatcher.ts:14-22`). They therefore run under
    the gateway's 30,000 ms default, not the node's 5,000 ms. Unchanged.
- **W15 `popup-blocked`.** A tab switch by path searches for the full command
  `timeoutMs` (`browser-tab.ts:143,197`) and then fails with `web.target.not_found`.
  Today Core would report that as `timeout`. It matters only if the Flow reaches
  the switch. `packages/test-runner/src/flow-lane/expectations.ts:10-13` records
  that in Stage 2 Core failed the click itself with the expected
  `output_not_observed`, which happens before the switch. Unchanged on that
  evidence. The pending tab-confirmation amendment could change the order; not
  checked.
- **Every week1 success row: W01-W18, W20-W23, W28 and the unarmed W24-W27.**
  Their actions answer in about 1.0 to 1.4 s, as the W25 unarmed timings show.
  A longer deadline does not change a success. One exception: an action that
  succeeds only after 5,000 ms, such as a slow W16 download, would stop being
  timed out. None is known.
- **W13 `banner-absent` and W24 `unannounced`.** Both are ruled out of Week 1
  (P7, and the recorded-payload change), and neither expects `timeout`.

## Commands run and observed results

All were reads. No Lab command, build, or test suite was run. None was needed,
and a Lab campaign is running.
- `ls F:/fxlab-runs/stage2c/c/`: six run directories, plus `.work`, which was
  not read.
- `node -e` over `events.ndjson` in `run-mtzxq5v4-064e7668`, printing sequence,
  timestamp, trigger, step id and codes. It showed 14 events. `runtime.dispatch`
  came at 14:54:51.446Z and `error` at 14:55:08.259Z. The error's text names
  `web.action.timeout` only as the expected code.
- `node -e` over `snapshots/flow-lane.json`, `evaluation.json`, `summary.json`,
  `run.json` and `review/timeline.json`, printing only ids, statuses, codes and
  timings. The values are quoted in section 2.
- `node -e` over `run.json` in all six bundles, printing actions with start,
  duration and status. The table in section 2 is that output.
- `core.log` has 48 short text lines. A pattern search for timeouts and codes
  found none, so it has no timing evidence. Its text was not printed.

## Not verified

- **When the extension's own answer arrived in the `too-slow` runs.** The bundle
  holds no client-side timing. The gap of at least about 1 s is inferred from code
  plus the unarmed measurement.
- **Whether a grace of about 3,000 ms is enough under load on this machine.**
  Only three unarmed runs were measured.
- **Which other week1 Flows contain a late-target wait, or reach a tab switch by
  path.** That needs approved-Flow data, which I did not read.
- **Whether Core's gateway service tests rely on a command-level `timeoutMs`.**
  Only the test lines listed in section 3 were located; they were not read in full.
- **No Core or extension test was run.**

## Open questions or contradictions found

- **The Flow-lane wait is 5,000 ms, not 10,000 ms.** `delayed-ui/scenario.ts:16-19`
  and `late-target-wait.ts:15` both say the content script's 10,000 ms default
  applies. On the Flow lane the node default of 5,000 ms is sent instead
  (`action.ts:40` → `client-gateway-transport.ts:172` → `gateway-mapping.ts:175`).
  The variant still holds, because 20,000 ms exceeds both, but the comments are
  wrong.
- **An upstream deadline does exist.** `apps/extension/src/runtime/action-runner.ts:197-198`
  says "Nothing upstream puts a deadline on a web action". Core has two, both
  equal to the node `timeoutMs`.
- **The node timeout overrides the action's own.** `gateway-mapping.ts:175`
  prefers `command.timeoutMs` over `parameters.timeoutMs`, so the node's
  5,000 ms default overrides any timeout an output's parameters declare. That
  matters for any future mapper that proposes a `timeoutMs` inside `parameters`.
- **Full list of `expected.failure` entries, for section 4.**
  - `delayed-ui` expects `timeout`.
  - `auth-gate` expects `auth_required`.
  - `identity-drift`, `failure-surfaces` `detached`, `member-directory` and
    `admin-console` expect `target_not_found`.
  - `modal-flows` expects `user_intervention_required`.
  - `failure-surfaces` `disabled` and `member-directory` expect
    `blocked_by_capability_or_policy`.
  - `failure-surfaces` `blocked-url` and `navigation` expect `navigation_unexpected`.
  - `storefront-checkout` expects `unexpected_state`.
  - `ambiguous-targets` expects `target_ambiguous`.
  - `intermediate-state` and `multi-tab` expect `output_not_observed`.
