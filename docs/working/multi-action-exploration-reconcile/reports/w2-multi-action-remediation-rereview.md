# w2 multi-action remediation rereview

## Outcome

Done. Source-only rereview of Core `1433d90` (parent `0dbf62f`) in
`F:\fxwork\t033\!FluxIQ` against the integration-review and remediation
reports committed downstream as `c82e774`.

**Disposition**

- All three prior findings (the High and both Mediums) are **closed** for every
  schema, caller, and domain result shape that exists today.
- The remediation does not weaken the accepted default-one, permission/state,
  accounting, or Lab-only caller behaviour.
- **Resume the same-code live A/B on this code.**
- **Block integration narrowly** on one new latent Medium finding: the schema
  matcher can still fail open inside `oneOf` branches, and on forms of its
  supported keywords that it does not implement. No schema offered today
  reaches it. The fix is one file plus a test and changes nothing for any
  current tool, so the A/B evidence stays valid across it. Once it lands, a
  focused check of that one file is enough to integrate; no other part needs
  review again.

All Core paths below are relative to
`packages/fluxiq/src/programs/automation-studio/runtime/`.

## What changed and why

The only file created is this report. I made no product, test, shared-document,
or git change. I ran no test, live run, provider, browser, or panel.

## Prior findings re-evaluated

### High: runtime action/repeat budgets not atomically preflighted (CLOSED)

- `recovery/exploration-budget.ts:303-314` `preflightActions` checks the whole
  list before anything runs:
  - actions: rejects when `actionCount + L > maxActions`;
  - repeats: for each signature, rejects when
    `attempts + projected + 1 > maxRepeatsPerAction`.

  This is exactly equivalent to calling `admitAction` (`:285-294`) L times in
  order. Item k is admitted only when `actionCount + k <= maxActions`, so all L
  are admitted only when `actionCount + L <= maxActions`. The repeat projection
  reads the same `attempts` map against the same bound.
- **Read-only when it admits.** No counter or map is written; `projected` is a
  local. When it rejects, it calls `stop()` (`:393-399`), which ends the
  exploration with the same reason and abort that a singleton `admitAction`
  gives at that limit. The rejection is terminal; nothing is partly charged.
- **Signatures match the real ledger exactly.** The preflight hashes
  `actionSignature(call.toolId, call.input)`
  (`recovery/runtime-exploration.ts:265`). The per-action wrapper hashes
  `actionSignature(call.toolId, call.value)` (`:224`). `value` is the same
  `decision.input` object the batch runner passes on
  (`llm/evidence-batch/run.ts:79,185`), and both use the same `canonicalJson`
  (`:508-519`).
- **Placement.** `llm/evidence-batch/run.ts:172-173` runs:
  - after the loop's own tool-call, epoch-repeat, and evidence checks
    (`:153-171`);
  - before any `allocateCallId` call, `callIds`/`answeredRequests` mutation,
    recorder call, or executor call (`:175-187`, `:72-73`).

  Nothing charges the ledger between the preflight and item 1: the provider call
  was charged earlier, in `decide`. So once the preflight passes, every item's
  `admitAction` succeeds unless a dynamic stop intervenes: clock, refusal
  limit, no-progress streak, external abort, or permission. Each of those
  happens after an admitted action has run, the same as in singleton mode, and
  none of them runs an item that was not admitted.
- **Charging is still per executed action.**
  - `admitAction` in the wrapper (`recovery/runtime-exploration.ts:225`) is
    still the only thing that charges the ledger.
  - `accounting.toolCalls` goes up once per executed action
    (`llm/evidence-batch/run.ts:94`).
  - Provider usage is attached only to position 1 (`:186`).
- **Proof.** All three tests are in `recovery/tests/runtime-exploration.test.ts`:
  - `:285-299`: with `maxActions` 1, a 2-item list stops as `action_limit` with
    0 actions, no steps, 0 tool calls, and the executor never called.
  - `:301-319`: an earlier mutation moves the epoch forward, so the loop's own
    rule accepts the list. The real ledger still rejects it on the `held`
    signature, and the executor ran only once, for the earlier singleton.
  - `:321-341`: one executed item leaves `actions: 1`, which also shows that a
    passing preflight charges nothing.

### Medium: domain-classified refusals could continue a list (CLOSED)

- **Classification.** The wrapper classifies the result once
  (`recovery/runtime-exploration.ts:241-243`) and records it in the ledger
  (`:244-249`). When it is a refusal, the wrapper returns a copy with
  `refused: true` (`:254`, `:499-506`).
- **Coverage.** `executionWithClassifiedRefusal` and `executionResultCode`
  (`:492-497`) use the same `kind === "llm_evidence_tool_execution"` guard, so
  every result that can be classified gets the flag. A plain-JSON result has no
  `resultCode` to read, so it can never be classified in the first place.
- **The flag reaches the stop rule:**
  - `llm/evidence-loop.ts:573-583` accepts `refused` in the closed key set, as
    a boolean only;
  - `llm/evidence-batch/run.ts:103-105` passes it on;
  - `llm/evidence-batch/stop.ts:14` checks it before effect and stability.

  `{ok:false}` evidence is still a separate refusal channel.
- **Nothing on the way strips it.** The registry binding passes results through
  unchanged (`llm/harness-options/binding.ts` does no reshaping), and
  `AutomationStudioLlmEvidenceVisibility.bind` returns the executor itself
  (`llm/evidence-batch/visibility.ts:7-10`).
- **Proof.**
  - `recovery/tests/runtime-exploration.test.ts:321-341`: an observing tool
    returns `{status:"outside_scope"}` with a classified refusal. It ran once,
    with `stoppedBy: "refusal"`.
  - `llm/tests/evidence-loop.test.ts:166`: a mutating tool, effect applied,
    `targetsUnchanged: true`, `refused: true`. Without the flag this case would
    carry on to the next item.
- **Flow Bootstrap is unchanged.** It has no classifier. Its refusals still come
  as `{ok:false}` (downstream `domain/src/runtime/llm-evidence/tool-rejection.ts:56`),
  and a permission request still throws at
  `flow-bootstrap/action-permissions.ts:77`.

### Medium: local input matcher ignores `uniqueItems`; unknown keywords fail open (CLOSED for the reported case; residual below)

- `uniqueItems` is enforced with structural equality
  (`llm/evidence-batch/input-schema.ts:35-36`, `:78-89`). A non-boolean
  `uniqueItems` fails closed.
- An unknown keyword name fails the match at any subschema the matcher visits
  (`:10`, `:58-63`). Malformed `enum`/`oneOf`/`anyOf` containers fail closed
  (`:12-14`).
- The same matcher checks the provider-side parse
  (`llm/harness/run.ts:199-202`) and the loop parse
  (`llm/evidence-loop.ts:626-638`), so the two cannot disagree.
- **Every schema offered today stays inside the subset.** Sources checked:
  - downstream `domain/src/runtime/llm-evidence/harness-options/options.ts:69-131`
    and `tools.ts:220-251`;
  - Core builtins in `llm/harness-options/builtin.ts:59-150`.

  They use only `type`, `properties`, `required`,
  `additionalProperties: false`, `pattern`, `minLength`, `maxLength`,
  `minimum`, `maximum`, `maxItems`, `uniqueItems`, object `items`, and `enum`.
  The duplicate-consequence case for `web.press_control` is now rejected.
- **Proof.**
  - `llm/evidence-batch/tests/contract.test.ts:98-111`.
  - `llm/tests/evidence-loop.test.ts:138-162`: a duplicate in item 2 rejects the
    whole list, with 0 executor calls.

## New findings

### Medium (latent, blocks integration only): the matcher can still fail open

The unsupported-keyword rule is applied per value: it returns `false` for
whatever subschema the matcher happens to visit. That is not fail-closed
everywhere:

1. **`oneOf` turns the rejection around.** `:13` counts matching branches and
   requires exactly one. A branch that fails only because it has an unsupported
   keyword drops out of the count. For example,
   `oneOf: [{type:"integer"}, {type:"integer", multipleOf: 2}]` accepts `4`
   here. Full JSON Schema rejects it, because both branches match. (`anyOf` can
   only become stricter this way, so it is safe.)
2. **Some supported keywords have forms the matcher does not implement, and it
   ignores them silently:**
   - tuple (array) or boolean `items` (`:37` handles only the object form);
   - boolean property subschemas such as `properties: {x: false}` (`:47-50`
     fall through to `additionalProperties`, so the value is accepted unless
     that is `false`);
   - a non-array `required`, or one with non-string entries (`:40-42` turn it
     into `[]`);
   - non-number `min*`/`max*` and a non-string `pattern` (`:18-34`, `:52-53`).

No schema offered today reaches any of these (see the list above), so this
cannot affect the A/B measurement. It does contradict the brief's rule that the
matcher "cannot fail open on unsupported keywords". It also contradicts the
remediation report's claim that every unsupported constraint is refused.

**Fix.** Add one validation pass per tool schema that checks the schema itself,
independent of any value, against the closed subset:

- It visits every `oneOf`/`anyOf` branch, `items`, every `properties` value,
  and an object `additionalProperties`.
- It rejects unknown keys, subschemas that are not objects, array `items`, and
  malformed `required`, bound, or `pattern` types.
- The value matcher then runs only on schemas that passed.

Pin it with two tests: `oneOf` with an unsupported branch, and tuple `items`.
For every current tool the change alters no behaviour.

### Low

- **An over-long list near the end of the budget ends the exploration.**
  - What happens: rejection at preflight is terminal. With 1 action left, a
    2-item list ends as `action_limit`/`budget_exhausted`, where singleton mode
    would have taken the last action.
  - Why it matters: the reported sentence "used every action it was allowed"
    (`recovery/runtime-exploration.ts:450`) is then untrue, and the list
    schema's `maxItems` is not capped by the actions the ledger has left.
  - Reach: no production recovery caller opts in
    (`recovery/annotation/exploration.ts:203` passes no `maxActionsPerDecision`),
    so this matters only if recovery is later enabled for lists.
  - Recommended then: accurate wording, or cap `maxItems` at the remaining
    actions.
- **A self-set `refused` flag stops the list but is counted as observed.** A
  domain that sets `refused: true` itself, without the classifier, stops the
  list, but the ledger records the action as observed. Core's wrapper sets the
  flag only when the ledger has also recorded a refusal, so the current code is
  consistent.
- **Informational (neither is reachable with current string/enum schemas):**
  - the new `sameJson` treats `0` and `-0` as different, where the old
    `JSON.stringify` comparison treated them as equal;
  - `minLength`/`maxLength` count UTF-16 code units, not code points.
- **Test gaps.** These are claimed, but I confirmed them only by reading the
  code:
  - uniqueness of objects regardless of key order;
  - malformed `enum`/`oneOf`/`anyOf` failing closed;
  - nested unsupported keywords;
  - a fully executed two-item list against the real ledger ending at
    `actions: 2`.

## Accepted behaviour not weakened

- **Default-one.**
  - The default is still 1 (`loop-limits/evidence-loop.ts:37`), and at 1 a
    list is rejected as `disabled` (`llm/evidence-batch/decision.ts:52`).
  - `batchAdmission` is read only in the `tool_calls` branch
    (`llm/evidence-loop.ts:482-499`).
  - Singleton inputs never reach the matcher (`llm/evidence-loop.ts:622-624`,
    `llm/harness/provider-result.ts:156-161`).
  - For a singleton classified refusal, the only change is that the result is
    a copy carrying `refused: true`. Evidence, trace, and stop are unchanged,
    because `stopReason` is computed only for lists
    (`llm/evidence-batch/run.ts:103`).
- **Permission and state.**
  - The permission branch is unchanged: it records the action, then throws
    (`recovery/runtime-exploration.ts:241-253`).
  - The recorder still wraps each call (`:232`), and a list rejected at
    preflight records no step.
  - Flow Bootstrap's permission wrapper was not touched.
- **Accounting and diagnostics.** No trace or receipt shape changed. `refused`
  is never persisted, and `stoppedBy: "refusal"` was already a valid value
  (`flow-bootstrap/generation-failure.ts:384`).
- **Lab-only caller.** There is no downstream product change: `c82e774` touches
  only docs. Both t033 worktrees are clean on `task/t033-multi-action-reconcile`.

## Commands run and observed results

- `git show --stat 1433d90` (Core): 9 files, 198 insertions and 16 deletions,
  all under `runtime/llm/{evidence-batch,evidence-loop.ts,tests}` and
  `runtime/recovery/{exploration-budget.ts,runtime-exploration.ts,tests}`.
- `git show 1433d90 -- <those paths>`: read the full diff.
- `git show --stat c82e774` (downstream): 4 docs files only.
- `git status --short` in both worktrees: empty. Both are on
  `task/t033-multi-action-reconcile`.
- Read the current source with sed and grep:
  - Core runtime: the ledger, runtime exploration, the batch
    runner/stop/decision/input-schema/visibility files, the evidence loop, the
    harness parse sites, bootstrap permissions and diagnostics, and the Core
    builtins;
  - downstream: the option and tool schemas;
  - the three new tests.

## Not verified

- No test, check, or build was run, because the brief forbids it. The
  remediation's 93-test pass and its `pnpm --filter fluxiq check`/build results
  are its own claims; I did not see them run.
- No live, provider, browser, or panel run. The live-only unknowns listed in
  the integration review still stand.
- I checked the Flow Bootstrap permission and state paths only to confirm the
  remediation did not change them. I did not review them again.

## Open questions or contradictions found

- The remediation report says the matcher "rejects every schema keyword outside
  its explicit supported set instead of silently ignoring an advertised
  constraint". That holds for unknown keyword names where a subschema must
  match. It does not hold inside `oneOf`, or for the forms of supported keywords
  the matcher does not implement (see the new Medium finding).
