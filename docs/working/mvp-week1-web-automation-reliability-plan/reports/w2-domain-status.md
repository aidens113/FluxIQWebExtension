# Report: w2-domain-status

Worker: `w2-domain-status`. Brief: `### Brief: w2-domain-status` in
[briefs/wave-2.md](../briefs/wave-2.md) — Phase 1.2 step 5, domain status
fidelity.

## Outcome

**Done**, with one deviation of substance: `domain/src/output-nodes/native-runtime.ts`
received a documenting comment rather than the message promotion the brief
names, because a node implementation runs *before* its output is dispatched and
so has no dispatch result to promote from. Evidence and the alternative are in
[Open questions](#open-questions-or-contradictions-found). Everything else in
the definition of done passes; observed output in
[Commands](#commands-run-and-observed-results).

## What changed and why

Core reads exactly three fields of a dispatch result when it builds the node
result — `status`, `failure`, `error` — and two of a runtime command result —
`status`, `message ?? error` (`packages/fluxiq/src/programs/automation-studio/
runtime/io-policy.ts`, `dispatchPolicyOutput` and
`createRuntimePolicyEffectDispatcher`). The domain was supplying none of the
status ones.

### `domain/src/runtime/adapter.ts` (the runtime path)

- `status: result.ok ? "succeeded" : "failed"` became
  `status: result.status ?? (result.ok ? "succeeded" : "failed")`. A
  `timed_out` or `cancelled` command now reaches Core as itself, so
  `failureForCommandStatus` can classify it as Core's `timeout` category
  instead of seeing an undifferentiated failure. `FluxIQRuntimeCommandStatus`
  contains all five client statuses, so nothing is coerced.
- `message` was previously only ever a copy of `error`. It is now
  `result.error ?? dispatchPayloadMessage(result.payload)` — the client's own
  message, which the dispatcher carries in the payload. Core builds the node
  message from `result.message ?? result.error`, so a succeeded action's
  post-condition (and a status the client described in words only) now reaches
  the attempt trace, which previously had no reason at all.
- `failure` is forwarded when the client reported one, so Core classifies from
  the structured record before it matches any message.
- **The `ACTION_REJECTED` path is untouched.** `rejected()` still answers an
  output this domain does not own with `status: "rejected"`, before dispatch.

### `domain/src/io/gateway-output-dispatcher.ts` (the IO path)

- `status: result.status` added; `ok` stays the success flag, exactly as Core's
  `OutputDispatchResult` documents the pair.
- `failure: result.failure` forwarded for Core to parse.
- **Message promotion:** Core's IO path builds the node message from `error`
  alone and never looks at the payload, so a command that failed with only a
  `message` — the usual shape of a client-side timeout or cancellation, and the
  defect `w1-extension-unit-tests` found — arrived reasonless. When the command
  did not succeed and carried no `error`, its `message` is promoted into
  `error`. An explicit `error` still outranks the message, and a **success
  never gains an error**.

### `domain/src/output-nodes/native-runtime.ts`

No behavioural change; a comment now records why, and points at the two files
that do carry status fidelity. See [Open questions](#open-questions-or-contradictions-found).

### Tests (T1, one per status and for the message fallback)

| File | Tests | Covers |
| --- | --- | --- |
| `domain/src/runtime/tests/adapter.test.ts` | 8 | succeeded, failed, `timed_out`, `cancelled`, `unknown`, message promotion, failure forwarding, the `rejected` path, and the no-eligible-client refusal |
| `domain/src/io/tests/gateway-output-dispatcher.test.ts` | 7 | the same statuses plus: promotion only when there is no `error`, never on a success, no reason invented when the client gave none, the dispatched command itself, and a throwing gateway |
| `domain/src/output-nodes/tests/native-runtime.test.ts` | 4 | one bound implementation per action type; exactly one dispatch effect naming its own output; the implementation states no status of its own; the seven new action types each dispatch under their own id |

## Commands run and observed results

From `F:\!FluxIQWebExtension`, labels `DOMAIN_TEST_BUILD_LABEL=w2-domain-status`
and `EXTENSION_TEST_BUILD_LABEL=w2-domain-status`. Every exit status was
captured by redirecting to a file and echoing `$?`, never through a pipe.

| Command | Observed |
| --- | --- |
| `pnpm --filter @fluxiq-web-extension/domain check` | exit 0 (clean run; see the first-run note below) |
| `DOMAIN_TEST_BUILD_LABEL=w2-domain-status pnpm --filter … domain test` | exit 0 — `# tests 66 / # pass 66 / # fail 0` |
| `pnpm --filter @fluxiq-web-extension/extension check` | exit 0 |
| `EXTENSION_TEST_BUILD_LABEL=w2-domain-status pnpm --filter … extension test` | exit 0 — `# tests 80 / # pass 80 / # fail 0` |
| `pnpm --filter @fluxiq-web-extension/extension test:content` | exit 0 — `61 passed (9.3s)` |
| `GIT_INDEX_FILE=<scratch> node scripts/structure-audit.mjs` | exit 0 — `structure-audit: passed (31 warning(s), 19 baselined)`; no warning names any file of mine |

The domain test count is process-wide across all domain test bundles and rose
from 45 to 66 between runs as other Wave 2 workers' tests landed; my 19 are
included and all passed.

**Two failing first runs, both real and both resolved.**

1. The first `domain check` and `domain test` failed with
   `src/io/input-model.ts(125,11): error TS2304: Cannot find name 'stringValue'`
   (five sites), and the test process died on
   `ReferenceError: stringValue is not defined` after 7 tests. That file is
   `w2-domain-vocabulary`'s, not mine; `git diff --stat` showed it mid-edit
   (+45/−4) and its `stringValue` helper has since appeared at line 189. I
   reran once, as the concurrency notes direct, and it was gone.
2. The rerun then surfaced two **genuine type errors in my own test files**,
   which the first run never reached because `input-model.ts` failed first:
   `"action_rejected"` is not a Core failure category (the plan's
   ACTION_REJECTED is Core's `blocked_by_capability_or_policy`, as
   `content/action-runtime/validation-outcome.ts` already uses), and
   `FluxIQRuntimeAdapter.execute` takes a required second `context` argument.
   Both fixed; the third run is the clean one in the table. Worth noting that
   the runtime tests passed 45/45 while `tsc -p tsconfig.test.json` still
   rejected them — passing tests are not a type check.

**Audit method.** The audit reads only tracked files, so the three new test
files were staged into a *scratch* index (`GIT_INDEX_FILE` pointing at a copy of
`.git/index`) rather than the shared one, since twelve workers share this tree.
`pnpm structure:baseline` was not run and no baseline entry was added, raised,
or regenerated.

**Change footprint.** `git diff --stat` on my three source files: 45
insertions, 4 deletions. Plus three new test files. No other file was touched.

## Not verified

- **Nothing above the domain boundary was executed.** My tests stop at
  `dispatchWebAutomationOutput` and the adapter's returned result. That Core
  then classifies a forwarded `timed_out` as its `timeout` category, and that
  the promoted message becomes the node attempt's message, is read from Core's
  source (`io-policy.ts`, `attempt-trace.ts`, `node-execution.ts`) and **not
  executed by any test I wrote**. No Flow was run.
- **No live browser validation and no Lab run.** My brief forbade `pnpm lab`
  (only `w2-flow-lane` may use it), so no end-to-end proof exists that a
  `timed_out` produced by a real content-script wait survives the whole path.
- **`pnpm build` was not run** (forbidden for parallel workers), nor `pnpm
  check`/`pnpm test` at the repository root.
- **The `unknown` status is untested end to end.** Nothing in the extension
  currently produces it; my test only proves the domain does not rewrite it.
- The extension gates passed at the moment I ran them, in a tree twelve workers
  are editing; they are not a statement about the tree at integration time.

## Open questions or contradictions found

1. **`native-runtime.ts` cannot promote a message — the brief's third file.**
   The brief says all three files "promote the message from the payload when
   there is no `error`". A node implementation cannot: Core executes it and
   *then* dispatches the effects it returned
   (`runtime/executor/node-execution.ts:64`,
   `dispatchAutomationStudioEffects`), merging the dispatcher's `status`,
   `message`, and `failure` over the node result on failure. Its context
   (`AutomationStudioNativeNodeContext`) carries `inputs`, `parameters`,
   `signal`, `grants`, `host`, `elementMatcher`, `resolveTarget`, `log` — no
   dispatch result. The plan's own Phase 1.2 step 5 text agrees: "No
   node-implementation change is needed for routing … verified. What is lost
   today is the *status and message*." So the promotion belongs to the other
   two files, which now do it, and this file gets a comment plus a T1 test
   pinning the effect contract. **If the supervisor intended something else
   here, it needs naming.**
2. **Promoting a message into `error` gives a cancelled command an `error`
   string it did not report.** This is deliberate — Core's IO path has nowhere
   else to read a reason from — but it does mean `error` is no longer proof the
   client sent one. If that distinction matters to Phase 1.5, the alternative is
   a Core seam that reads `payload.message`, which is a Core change, not a
   downstream one.
3. **Core's runtime deadline still never applies to a web action, so Core can
   never produce `timed_out` itself.** `createRuntimePolicyEffectDispatcher`
   passes `timeoutMs` to `runtime.dispatch` only when the dispatch *effect
   payload* carries it, and `native-runtime.ts` emits only `{outputId,
   parameters}` — even though every selector-bearing node declares a
   `timeoutMs` parameter (default 10 000). Likewise the dispatcher does not
   forward `timeoutMs` onto the `ClientGatewayActionCommand`. **I deliberately
   did not add it**: a Core timer set to the same value as the client's own
   timeout would almost always win the race and replace the client's structured
   `timed_out` (with its failure record) with Core's generic one — a fidelity
   *loss*. Setting a Core-side deadline with a margin is a policy decision for
   the supervisor, not this brief.
4. **The domain can only promote what the extension sends.** If a `timed_out`
   or `cancelled` result reaches the gateway with neither `error` nor
   `message`, there is nothing to promote and the node result stays reasonless.
   `w2-browser-actions` owns that end (`runtime/result-mapping.ts`); this work
   assumes it lands.
5. **`failure` still stops at `webAutomationActionResultPayload`.** The
   dispatcher now forwards the client's structured record to Core, but the
   recorded-input payload mapping in `domain/src/output-nodes/payloads.ts`
   (`w2-domain-vocabulary`'s file) does not, as `w2-foundation` also noted.
