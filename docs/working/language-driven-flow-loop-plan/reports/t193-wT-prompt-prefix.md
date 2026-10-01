# t193-wT: build decisions share their prefix so DeepSeek's cache can hit

## Outcome

Partial. The fix is in, and the new test fails on HEAD and passes with the fix.
Three existing tests in `runtime/llm/tests/` asserted the old key order or the
old routing path, and they now fail. They are outside this brief's owned paths,
so I did not edit them. The exact diff each one needs is below. I ran it on
temporary copies, where all 23 tests passed. No live provider calls were made.

## Reproduction (step 1)

New test `runtime/llm/evidence-loop/tests/request-prefix.test.ts`. It drives
`generateFlowBootstrapAdaptation({ evidenceGuided: true })` through the real
service, the real session-key resolver and `createAutomationStudioDeepSeekProvider`.
Only `fetch` and the secret store are stand-ins. The fixture is:

- the web node catalog fixture;
- a host with `observeRouteState`;
- one mutating tool. Each call returns a page-sized result, reports a new
  `routeState` and records a proposable step;
- `maxCallsPerRun: 8`;
- a script of five `tool_call`s with `add: true`, then `complete`.

The test captures every outbound body. The table compares each pair of
consecutive prompts (`system + "\n" + user`). All text is ASCII, so character
offsets equal byte offsets.

HEAD:

| pair | first diff (byte) | field there | needed through |
| --- | --- | --- | --- |
| 1->2 | 3,570 | `outputSchema.properties.decision.oneOf.0.required.1` (completion first offered) | 46,020 |
| 2->3 | 50,908 | `context.flowBootstrap.routing.situations` (new page state) | 54,142 |
| 3->4 | 50,987 | `context.flowBootstrap.routing.situations` | 57,299 |
| 4->5 | 51,066 | `context.flowBootstrap.routing.situations` | 60,456 |
| 5->6 | 8,469 | `outputSchema.properties.decision.oneOf` (wrap-up withdrew the tools) | 63,613 |
| 6->7 | 65,844 | `context.evidenceLoop.evidence.5.callId` (correct: new entry) | 65,827 |
| 7->8 | 5,582 | `outputSchema.properties.decision.oneOf` (last decision withdrew amend) | 65,827 |

After the fix, every pair first differs 12 to 34 bytes past the required
offset, inside the `callId` of the first entry that differs. For example,
1->2 differs at 44,528 against 44,516 required, and 7->8 at 59,939 against 59,905.

This matches the live run `run-mup2i28c-6c7fc209` (cache hits 0 / 1,024 /
14,976 / 15,360 / 1,792):

- **Call 2, 1,024 hit.** Completion became offered once a tool call had
  counted, which changed `outputSchema` inside the head of the request.
- **Calls 3 and 4, about 15k hit.** The prefix ended right after the node
  catalog, where `flowBootstrap.routing` gained a situation after each call.
- **Call 5, 1,792 hit.** The budget's wrap-up withdrew the tools. Its budget
  entry says "new tools are no longer offered". That changed `outputSchema` and
  `evidenceLoop.tools` again.

## What changed and why (step 2)

- `llm/deepseek/request-body.ts`: a new `providerEvidenceDecisionPayload`.
  Order for `evidence_tool_decision`:
  1. `taskKind`, `promptVersion`, `expectedOutput`
  2. `context{schemaVersion, stage, projectId, flowId, instructions, policyGates}`
  3. `flowBootstrap{startLocation, startLocationNote, nodeCatalog, catalogTruncated, catalogSelection}`
  4. `evidenceLoop{evidence, tools, iteration}`
  5. `context.routing`, then `reusableContext`
  6. `outputSchema` (top level, now last)

  Nothing is removed or cut. Two things changed for the model:
  - The routing object moved from `context.flowBootstrap.routing` to
    `context.routing`, byte-identical. It cannot stay inside `flowBootstrap`
    without sitting in front of the window.
  - The model now reads `outputSchema` last, not first.

  Other task kinds keep their order, so `providerFlowBootstrap` gained
  `withRouting = true`. The schema itself is unchanged, so there are no
  response-format constraints. `response_format` is `json_object`, and the
  system prompt still says "match the outputSchema field in the user message".
  The doc comment records the run's measurements.
- `llm/deepseek/system-prompt.ts`: the reusable-context sentence was added only
  when `reusableContext` was present. An opted-in build looks it up again for
  each decision, so the system message could change between calls, which would
  remove the whole cached prefix. An evidence decision is now always given the
  sentence. That adds one constant sentence when no reusable context is
  present. Other task kinds are unchanged.
- `policyGates`, `instructions` and the catalog stay in the head. The build
  does not pass `policy`, and recovery passes them once per loop. All of these
  are fixed for the length of a loop. In the scripted build they never
  differed.

## Accounting (step 3)

`pricing.ts` prices hits at DeepSeek's hit rate. I re-read
<https://api-docs.deepseek.com/quick_start/pricing/> on 2026-09-30. Peak rates
per 1M tokens:

| model | cache hit | cache miss | output |
| --- | --- | --- | --- |
| deepseek-flash | $0.006 | $0.3 | $1.2 |
| deepseek-v4-pro | $0.044 | $1.32 | $3.96 |

Off-peak is half. The code matches these rates and deliberately prices at
peak. The live figures check out against them. For call 2:
58,037 × 0.3 + 1,024 × 0.006 + 93 × 1.2 per million = $0.017528844, which is
exactly the logged `estimatedCostUsd`. Pre-call estimates still assume every
input token is a miss, which is conservative by design. No change was needed.

## Test (step 4)

`request-prefix.test.ts` checks every consecutive pair. Call N must match call
N+1 byte for byte through the end of the last tool result the two share. Every
tool result call N carried must still be there, and the node catalog must be
inside the matched prefix.

It also checks that the fixture really exercises a changing `outputSchema` and
a growing routing context. That check reads routing at either path, so it
holds on HEAD too. On HEAD the test fails with: "call 1 -> 2: first difference
at 3570, inside outputSchema.properties.decision.oneOf.0.required.1; must match
through 46020". After the fix it passes.

## Commands run and observed results

All run in `packages/fluxiq` unless noted.

- `npx vitest run .../llm/evidence-loop/tests/request-prefix.test.ts`
  - HEAD request builder (temporarily restored, then put back): 1 failed, with
    the message quoted above.
  - Fixed: 1 passed.
- `npx vitest run src/programs/automation-studio/runtime/llm/deepseek .../llm/evidence-loop .../llm/decision-context`:
  26 files and 184 tests passed.
- `npx vitest run src/programs/automation-studio/runtime/llm` (whole llm tree):
  88 files, 3 failed and 85 passed; 775 tests, 3 failed and 772 passed. The 3
  failures are the old-order tests listed below.
- The same three tests with the proposed edits, run as temporary copies
  `evidence-loop/tests/t193-wT-tmp-*.test.ts` (since deleted): 3 files and 23
  tests passed.
- Downstream payload consumers: 19 files and 204 tests passed. The files were:
  - `runtime/tests/deepseek-bootstrap-exploration.test.ts`
  - `runtime/tests/llm-deepseek-flow-bootstrap.test.ts`
  - `runtime/tests/deepseek-recovery-requests.test.ts`
  - `recovery/annotation/tests`
  - `route-state/tests`
  - `service/flow-bootstrap-commands/tests`
  - `flow-bootstrap/plan/tests/flow-size.test.ts`
- `bash .../heavy.sh "t193-wT tsc" npx tsc --noEmit -p packages/fluxiq/tsconfig.json`
  (from Core root):
  - First run: rc=2, `TS2307` on my test's `core/index.ts` import, which was
    one `../` short. Fixed.
  - Re-run: rc=0, no diagnostics.
- `node scripts/structure-audit.mjs` (Core root): rc=1, 1 violation:
  `runtime/service.ts: 4506 lines exceeds ... Baseline for this entry is 4505`.
  `service.ts` is unmodified in this tree (`git status` shows only my three
  files), so this predates my change. Nothing is flagged for my files.

## Required edits to non-owned tests (supervisor)

These three tests are in `runtime/llm/tests/` and must change with the fix:

```diff
--- tests/provider-cache-prefix.test.ts
@@ -43,4 +43,5 @@
     expect(first.slice(0, shared)).toMatch(/"iteration":$/u);
-    expect(first.slice(shared)).toMatch(/^\d+\}\}\}$/u);
+    expect(first.slice(shared)).toMatch(/^\d+\}\},"outputSchema":/u);
+    expect(first.slice(shared + 1)).toBe(second.slice(shared + 1));
-    const offsets = ['"taskKind"', '"outputSchema"', '"instructions"', '"policyGates"', '"flowBootstrap"', '"nodeCatalog"', '"evidenceLoop"', '"tools"', '"evidence"'].map((key) => {
+    const offsets = ['"taskKind"', '"instructions"', '"policyGates"', '"flowBootstrap"', '"nodeCatalog"', '"evidenceLoop"', '"evidence"', '"tools"'].map((key) => {
--- tests/evidence-loop-provider.test.ts  (line 69)
-    expect(userPayload.indexOf('\"kind\":{\"const\":\"complete\"}')).toBeLessThan(userPayload.indexOf('\"tools\"'));
+    expect(userPayload.indexOf('\"outputSchema\"')).toBeGreaterThan(userPayload.indexOf('\"evidence\"'));
--- tests/routing-context-packet.test.ts  (lines 52-54)
-      context: { flowBootstrap: { routing: typeof routing } };
+      context: { routing: typeof routing; flowBootstrap: { routing?: unknown } };
-    const sent = payload.context.flowBootstrap.routing;
+    expect(payload.context.flowBootstrap.routing).toBeUndefined();
+    const sent = payload.context.routing;
```

The comment in `provider-cache-prefix.test.ts` at lines 40-42 ("the counter is
the last thing in the message") should also say that the output schema now
follows it.

## What DeepSeek's cache behaviour means live

From <https://api-docs.deepseek.com/guides/kv_cache>, read 2026-09-30:

- A hit must fully match a "cache prefix unit".
- Units are persisted at the end of each request's user input and of its model
  output, for common prefixes the system detects across requests, and "at fixed
  token intervals" for long inputs. The page gives no interval.
- "Cache construction takes seconds." The cache is "best-effort", with no
  guarantee of a 100% hit rate.

Our calls end in Core notes that change on every call, so call N's
end-of-input unit never matches call N+1 fully. Hits therefore come from:

- the fixed-interval units inside call N, up to the last interval boundary
  before the last shared tool result;
- common-prefix units the system detects.

Expected live hit, if construction finishes in time: most of each request.
That is everything except the newest tool result, Core's notes, the tools,
routing, the schema, and the tail of the last interval.

Calls are 3-5 s apart, and a 170k-token prefix may not be constructed in that
time. In that case a call hits an older request's units instead, and the hit
lags by one or more calls. The interval size and the construction time are
unknown, so the exact live hit is unknown until a live run measures it.

## Not verified

- No live DeepSeek call, so the real cache hit after the fix is unmeasured.
- Builds that opt in to reusable context, and recovery explorations that pass
  `policyGates`, were not driven by the scripted test. Their order follows the
  same code path.
- The web-extension Lab does not read the outbound payload by key path. A grep
  found only its own request object (`live-state-digest.spec.ts` reads
  `request.context.evidenceLoop`, which is unchanged). I did not run it.

## Open questions or contradictions

- `deepseek/request-shape.ts:168` flags `context.evidenceLoop.tools` as
  malformed when `tools.length === 0`. That is exactly the wrap-up's legitimate
  state. It only matters if that record is used beyond diagnostics. I did not
  change it.
- The structure-audit failure on `service.ts` (4,506 lines against a baseline
  of 4,505) is on HEAD and not from this brief.
