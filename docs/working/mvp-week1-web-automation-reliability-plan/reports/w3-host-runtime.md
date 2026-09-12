# Report: w3-host-runtime

Worker: `w3-host-runtime`. Wave 3, parallel: Phase 1.4 step 6 — binding Core's
host runtime boundary so a web attempt carries state refs — plus the downstream
half of the expectation evaluator seam that landed in Core on 2026-09-12.

## Outcome

**Done.** Both tasks are implemented, wired and tested. Domain `check` passes,
all 30 of my tests pass, the structure audit names none of my files, and nothing
I wrote is inert: the boundary is bound from `bindAutomationStudioRuntimeService`,
which `registerWebAutomationRuntime` already calls.

The Core seam was bound exactly as briefed. It did not need working around, and
I did not edit Core. One Core observation is in
[Open questions](#open-questions-or-contradictions-found): the boundary type is
not on Core's public entry, so I read it off the method that consumes it rather
than restating it.

## What changed and why

Four new source files and three new test files. Two existing lines changed.

### `domain/src/runtime/host-runtime.ts` (new, 169 lines)

`createWebAutomationHostRuntime(gateway)` returns the boundary object;
`bindWebAutomationHostRuntime(fluxiq)` binds it. It answers three of Core's
capability ids: `state-snapshot`, `state-diff`, `expectation-evaluation`.

- **`captureStateSnapshot`** dispatches `web.dom.capture_snapshot` and returns
  `{ stateSnapshotId, stateRef, capturedAt, summary }`. The id counts up per
  capture, so a retried attempt never reuses the previous ref; the ref is
  `web.state.<n>@<attemptId>:<point>`, which makes a trace say which attempt and
  which capture point the state came from.
- **The byte budget is the sanitized packet's own.** `summary` is
  `sanitizeWebLlmSnapshot(...)` with no override, so a state ref is bounded by
  exactly the budget that bounds the LLM packet and is subject to the same
  redaction. Reusing the function rather than the number means the two cannot
  drift, which matters because `w3-llm-packet` is changing that default in this
  same wave.
- **Only web nodes are snapshotted.** Core calls `captureStateSnapshot` for
  *every* node attempt in every Flow — LLM, code and router nodes included
  (`runtime/executor/node-execution.ts` line 48 and `finishAttempt`). Snapshotting
  a page around a node that never touched it is noise and costs a gateway round
  trip each time, so the boundary declines a node whose `definitionId` is not a
  web output node. The id set is derived from `WEB_AUTOMATION_ACTION_TYPES` via
  `webAutomationOutputNodeId`, not from the `web.output.` string, so a new action
  type is covered the day it is registered.
- **`inspectStateDiff`** reads the two summaries Core hands back and reports
  `web-state-diff.v1`: the two refs, before/after location, `locationChanged`,
  `titleChanged`, element counts, and the selectors that appeared or left
  (capped at ten each side, with exact counts beside them). Selectors are
  element identity, not page content, so the diff says what moved without
  restating what the page says. No snapshot cache is kept: Core already holds
  both refs and hands them straight back.

The gateway seam is `dispatchWebAutomationOutput` from
`domain/src/io/gateway-output-dispatcher.ts` — the same path a Flow's own web
output takes. That was deliberate: it avoided writing a fourth copy of the
"which paired session" rule (see the open question below).

### `domain/src/runtime/expectation/` (new)

- **`conditions.ts`** turns one raw `expectedState` entry into a
  `web.dom.assert` request. It accepts both shapes: the flat
  `{ kind, expected, selector }` a Flow author writes, and the
  `{ selector, assert: { kind } }` shape a `web.dom.assert` output node carries.
  It refuses rather than coerces — an entry it cannot read yields `undefined`.
  The kind set is a `Record<WebAutomationAssertKind, true>`, so adding a kind to
  the union in `actions/types.ts` breaks compilation here instead of silently
  becoming an unreadable condition.
- **`evaluate.ts`** dispatches one `web.dom.assert` per condition and aggregates
  the verdict. The judgement itself stays in the browser: the assert verb
  already knows how to wait for a claim, re-query a selector on every attempt,
  and report what it saw. Re-implementing `visible` or `exists` in the domain
  would be a second definition of the same words, judged against a stale
  snapshot instead of the live document.

Three rules keep it honest, and each has a test:

1. **It never throws.** `nodes/policy/expectation.ts` awaits the evaluator with
   no catch of its own (the transition-comparison path does catch), so a throw
   there would become a node execution error and a false red.
2. **A condition that could not be judged is not a condition that failed.** An
   unreadable shape, a command that never reached a client (`ok: false` with no
   status), a `cancelled` or `unknown` status, an aborted run: each is left out
   of `checkedConditionCount` and cannot reject. With nothing judged the verdict
   is Core's own prior default — an unconditional pass — with a message saying
   so. The alternative would turn a transport hiccup into a failed Flow.
3. **No code is written at a call site.** `STATE_MISMATCH` and `TIMEOUT` come
   from `runtime/failure`; a client that already reported a code from that same
   closed set keeps its own record, because it stood nearest the page.

`checkedConditionCount` is always reported, which is what lets Core's
`stateCheckCount` stop counting expected-state keys. `context.source` is carried
into the action metadata but changes nothing about how the claim is judged, as
the brief required.

### One wire detail that would otherwise have cost five seconds per condition

`gateway-action-parameters.ts` reads `assert.timeoutMs` through a
*positive*-integer guard, so a literal `0` is dropped and the content script
falls back to its own five-second default. Core's transition comparison passes
`timeoutMs: 0` for every expected state that does not name a wait. Emitting `0`
would therefore have put a five-second wait on every checked condition of every
successful web attempt. The module emits `1` instead, which survives the guard
and means what `0` was meant to mean, because `evaluateAssertion` always judges
once before consulting its deadline. `tests/conditions.test.ts` proves both
halves through the real gateway mapping.

### Changed lines

- `domain/src/runtime/index.ts`: `export * from "./expectation";` and
  `export * from "./host-runtime";`.
- `domain/src/runtime/service.ts`: one `bindWebAutomationHostRuntime(fluxiq);`
  call beside `bindRuntimeService`, plus its import.

Neither reaches the browser bundle: `apps/extension` imports only
`@fluxiq-web-extension/domain/client`, and that barrel exports
`../runtime/capabilities` and `../runtime/failure`, not `../runtime`.

## Commands run and observed results

`DOMAIN_TEST_BUILD_LABEL=w3-host-runtime` was set for every package command.
Exit status was captured by redirecting to a file and echoing `$?`, never
through a pipe. No `pnpm build` and no `pnpm lab` run.

| Command | Result |
| --- | --- |
| `pnpm --filter @fluxiq-web-extension/domain check` | **exit 0**, no diagnostics |
| Owned tests only (scratch runner, see below) | **exit 0** — `# tests 30 / # pass 30 / # fail 0` |
| `pnpm --filter @fluxiq-web-extension/domain test` | exit 1 — `# tests 193 / # pass 190 / # fail 3`; **all three failures are another worker's** |
| `node scripts/structure-audit.mjs` with a scratch `GIT_INDEX_FILE` | exit 1 — 2 violations, **neither naming any file of mine** |
| `git status --short` | my only changes are the two edited files and the three new paths |

Detail on the three that are not mine:

- The failing tests are `gives up page facts before the last element…`,
  `sanitizes extension snapshots without values, sensitive controls, or URL
  secrets`, and `captures bounded sanitized post-failure evidence…`, located in
  `runtime/llm-evidence/tests/limits.test.mjs` and
  `runtime/llm-evidence/tests/llm-evidence.test.mjs` — `w3-llm-packet`'s
  mid-split module. Reran once as the binding rules require: identical.
- The two audit violations are
  `apps/extension/src/runtime/tests/result-mapping.test.ts` reaching past
  `content/evidence`'s barrel (`w3-evidence`) and `docs/working/README.md` being
  out of date.

Earlier runs recorded for honesty, because they were red for reasons that later
cleared: the first `check` failed only on
`domain/src/recording/web-state/action-target.ts` and then only on
`domain/src/recording/tests/web-state.test.ts` (`w3-state-identity` mid-split);
both cleared on rerun. Two full `test` runs aborted at 50 of 131 with
`TypeError: filteredElements.map is not a function` thrown asynchronously from
that same worker's test file, which killed the shared runner process before any
of my tests executed. Because a rerun did not clear it at the time, I proved my
own tests with a scratch script in the session scratchpad
(`run-w3-host-runtime-tests.mjs`) that runs the same esbuild-and-import pipeline
as `domain/scripts/test-domain.mjs` for my three entries only, into
`domain/.test-build-scratch/w3-host-runtime-only/` (an ignored directory). No
repository file was added or edited for it. The shared runner later recovered,
and all 30 of my tests are visible passing inside the 193-test run as well.

Two of my own tests failed first and were fixed rather than papered over: a
message assertion I had written with the wrong wording, and a redaction
assertion whose fixture used the word `private`, which now legitimately appears
in the sanitized packet because `w3-llm-packet` is adding `selectedText` to it.
The redaction test now asserts what my module actually guarantees — the URL
query and a control's value never reach a state ref — rather than a word.

## Not verified

- **No live browser validation.** Nothing here has run against a real page.
  Every dispatch is a fake in tests. The one real integration proof is that
  Core's own `builtin.policy.expectation` node, fetched from Core's registry,
  routes `failed` with my record and `passed` on an accepted verdict.
- **The transition-comparison path was not exercised end to end.** That
  `stateCheckCount` prefers `checkedConditionCount` over counting expected-state
  keys is Core's code and Core's test; I proved only that the count is reported.
  A real Flow run is what would close it.
- **No state ref has been measured on a real page snapshot.** The summary is
  bounded by the sanitized packet's budget by construction, but the actual bytes
  a real page produces in an attempt trace were not observed.
- **The producer shape was read, not run.** `w3-domain-contracts` declares
  `expectedState` as `{ conditions: [{ kind, selector?, expected?, timeoutMs? }],
  mode?, timeoutMs? }` in `output-nodes/definitions.ts`, which is exactly the
  flat shape my normalizer reads. That agreement was confirmed by reading their
  declaration, not by executing a Flow that carries one.
- **The gating decision is a judgement.** Declining a non-web node means an LLM
  or code node in a web Flow gets no state ref. If Core's adaptive layer wants
  page state around non-web nodes too, this is the line to move.
- **Extension and test-runner packages were not checked.** I own no file in
  either and touched none. `pnpm build` and `pnpm lab` are the supervisor's.

## Open questions or contradictions found

1. **Core does not export `AutomationStudioHostRuntimeBoundary`.**
   `runtime/index.ts` in Core exports every sibling of `host-runtime.ts` but not
   `host-runtime.ts` itself, so the boundary type, `AutomationStudioHostStateSnapshotRef`
   and `AutomationStudioHostRuntimeCapability` are unreachable from
   `fluxiq/automation-studio`. I bound the seam anyway by deriving the type as
   `Parameters<FluxIQ["programs"]["automationStudio"]["bindHostRuntime"]>[0]`,
   which is fully type-safe and cannot drift, but it is a workaround for a
   missing export line. `AutomationNodeExpectationEvaluation` and
   `AutomationNodeExpectationEvaluationContext` *are* public, via
   `nodes/index.ts`. Core should add `export * from "./host-runtime.ts";` to
   `packages/fluxiq/src/programs/automation-studio/runtime/index.ts`.

2. **`captureStateSnapshot` has no way to say "not this node".** Its return type
   is a ref or a promise of one, with no `undefined`, so a host that should not
   answer for a given node must throw. Core catches, so it works, but it means
   an exception per non-web node attempt as ordinary control flow. An optional
   `undefined` return would say the same thing without one.

3. **`content/actions/assert.ts` still writes a code outside the closed set.**
   It builds `{ category: "expected_state_missing", code: "web.assert.<kind>" }`,
   which contradicts `w3-failure-codes`' decision that a failed authored
   assertion is `web.validation.state_mismatch` / `unexpected_state`. My
   evaluator replaces an out-of-set code (there is a test for it), but on the
   ordinary dispatch path that record reaches Core unchanged. **No Wave 3 brief
   owns that file** — `w3-failure-producers` owns `results.ts`, not
   `actions/assert.ts`. Someone should be given it.

4. **`webAutomationActionResultPayload` drops `validation` and `resolution`.**
   `gateway-mapping.ts` copies eleven fields of a `WebAutomationActionResult`
   into the gateway payload and neither of those is among them, so the domain
   cannot read a validation's `expected`/`actual` from a dispatched action — only
   the top-level `failure` record and the message survive. That is why my
   evaluator falls back to the dispatch message for `actual`, and it also limits
   what `classifyWebAutomationFailure`'s validation rule can ever fire on from
   the domain side. Relevant to `w3-failure-producers` and to
   `w3-domain-contracts`, who owns that file.

5. **"Which paired session" is now written three times**, with different rules:
   `runtime/adapter.ts` and `io/gateway-output-dispatcher.ts` accept `connected`
   or `ready`, while `runtime/llm-evidence.ts` additionally requires no active
   recording. I avoided adding a fourth by dispatching through
   `dispatchWebAutomationOutput`, but the divergence is real and a host runtime
   snapshot taken during a recording session would be allowed where an LLM
   evidence capture would not.

6. **The five-second default hazard is general, not local to me.** Any domain
   caller that means "check now" and writes `assert.timeoutMs: 0` will silently
   get the content script's five-second wait, because `positiveInteger` drops
   the zero and the verb defaults. It is worth a comment on
   `WebAutomationAssertRequest`, or a `nonNegativeInteger` guard for that one
   field, so the next caller does not have to rediscover it.
