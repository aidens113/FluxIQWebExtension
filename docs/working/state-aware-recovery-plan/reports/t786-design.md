# t786 design: stale target re-acquire

Author: t786 sub-supervisor, 2026-10-28. Status: built and proven provider-free (see `t786.md`). Deviations found in the build are recorded at the end.

## Stale target re-acquire (t786)

**The rule** (user, 2026-10-28, both `AGENTS.md`): a step whose target came from an earlier step remembers
that source step; after its second failed retry the run re-runs the source step internally, finds the same
item again by its identity (never its old position or handle), and spends the remaining retries on the fresh
target. An item truly gone is reported as gone. It holds on every path retries run, and never repeats a
lasting act whose earlier attempt may have landed.

**What the code does today (read before deciding).**
- Core retries: `AUTOMATION_STUDIO_DEFAULT_NODE_RETRY_POLICY` (`runtime/executor/retry-policy.ts`, 4 attempts,
  backoff 250/1000/2000 ms). A graph run counts attempts per arrival (`step-loop/arrival.ts`,
  `ctx.arrival.attempts`); a retry is chosen in two places, both setting `ctx.pendingRetry`:
  `step-loop/state-route.ts` (a step that could not run, `target_not_found`) and `step-loop/failed-attempt.ts`
  (the ladder's `retry` rung, after the C6 effect check for an uncertain lasting act). Outside a graph (a
  build exploring or testing its draft) `outside-graph/retries.ts` `automationStudioDispatchWithNodeRetries`
  runs the same policy; the domain calls it from `node-run/retries/dispatch.ts`.
- Row binding: For Each (`nodes/control-flow/for-each.ts`) takes its `items` input from a wired edge (a read
  list's rows) and hands each pass `item`; graph-run writes it into `values` (`item`, `<forEach>.item`). The web
  domain scopes a body step's recorded element to the pass's row by writing **every** row value into
  `element.context.record.values` (`domain/src/output-nodes/targets/row-scope.ts`, max 8 values); the page
  accepts the control only inside a record holding all of them.
- **So the observed failure is concrete:** a row read on an earlier page load whose values changed in the
  re-render (a count, a relative time, a toggled label) no longer matches any record, so every retry fails
  `TARGET_NOT_FOUND` although the item is still there. Re-reading the list and matching the row by its stable
  identity gives fresh values, and the next attempt finds it.
- Parameter binding to another node's answer: `$node.<key>.<output>[.<field>]`
  (`nodes/parameter-bindings.ts`), resolved per attempt in `node-execution/attempt.ts` from `values`.
- No lineage exists anywhere today (no `sourceStep`/`fromStep` in either repo).

### D1. Lineage (Core, derived, never stored by the model)

`automationStudioTargetLineage(flow, node)` returns `AutomationStudioTargetLineage | undefined`
(`runtime/executor/target-reacquire/contracts.ts`, already written as the stable interface):
- **`row`**: the node takes an `item` input wired from a For Each `F` (or sits in `F`'s body and reads its
  pass `item`), and `F.items` is wired from, or bound to, a node `S`'s output `k`. Lineage
  `{ kind: "row", sourceNodeId: S, outputKey: k, loopNodeId: F }`. Nested loops: the innermost For Each that
  hands the node its `item` wins. **Parameters**: the row's parameters are its `item`; nothing else.
- **`output`**: one of the node's parameters is a `$node.<key>.<output>` binding whose node is `S`. Lineage
  `{ kind: "output", sourceNodeId: S, outputKey, parameterPath }`. If several, the first element-target
  parameter (`element`, `target`) wins; else the first binding. (Judgement call: one source per step.)
- **Re-runnable source only.** `S` must be read-only: Core's neutral `metadata.effect === "observe"`, or a
  definition whose effect is observe, and never a lasting act (`automationStudioNodeActLasts`). A source that
  mutates (a search submit, a navigation) is not re-run; lineage is still returned but the re-acquire records
  `unavailable` (D3). A For Each pass's `item` with no wired `items` source: no lineage.
- Derived from the graph on each trigger, not cached on the node, so an edited Flow can never carry a stale
  lineage. Pure; no host call.

### D2. Trigger

Re-acquire runs **once per arrival** at a node (one attempt cycle), immediately before the attempt numbered
`automationStudioReacquireBeforeAttempt(maxAttempts)` = 4 when `maxAttempts >= 4` (first attempt + 2 failed
retries, then the 3rd retry is the fresh one), else `maxAttempts` when `>= 2`, else never. Judgement call: a
Flow that lowered its retries still gets one fresh attempt, before its last.

All of the following must hold, decided by one Core predicate `automationStudioStaleTargetFailure(attempt)`:
1. a retry is about to happen (`ctx.pendingRetry` set by either path), and the node has lineage;
2. the previous attempt failed on its target: category `target_not_found` or `target_ambiguous`, or stage
   `target_resolution`, or a host code naming a stale/detached/renumbered target (`/_(stale|detached|renumbered)/`,
   e.g. `web.handle.stale`, `web.handle.renumbered_by_reload`), which covers missing, ambiguous, detached and
   renumbered;
3. the act never happened: the failure's `effect` is not `ambiguous`, the C6 effect check did not answer
   `landed` or `unknown`, and the completed-act ledger has no entry for it. **Never after an uncertain lasting
   effect**: such an attempt never reaches a retry (failed-attempt.ts stops or carries on first), and the
   predicate refuses it again on its own.

### D3. The internal re-run

1. `hostRuntime.returnToSourcePlace?({ node, source, sourceAttempt })`: the web host compares the page's
   location with where `S`'s attempt in this run ran; if it moved, it navigates back (a navigation, never a
   lasting act) and answers `returned`; `same_place` otherwise; `unavailable` if it cannot. Missing method =
   `same_place`; a throw = `unavailable`. Judgement call: only a location the run itself recorded is used.
2. Core executes `S` once with `executeAutomationStudioNode` against the current `values` (so its own inputs
   are what they were). **Internal**: the re-run attempt is not pushed to `attempts`, not announced as a
   step, not counted in step numbers, loop words, run datasets or result verification, and writes nothing
   into `values`; its outputs are used only to build candidates. One dispatch, no retries of its own.
3. Candidates: `row` = the fresh `S.outputs[k]` list (the whole list: For Each's `first`/`stopAfter` slice is
   ignored, since positions mean nothing here); `output` = the fresh value at the binding (each element when
   it is a list).
4. `hostRuntime.reacquireTarget({ node, source, lineage, stale, candidates, failure })` answers `found`,
   `gone` or `unmatched`. Missing method, throw, malformed answer = `unmatched`. A failed or empty re-run =
   `unavailable` (an empty list is not proof the item is gone: the read may have met a half-drawn page).

### D4. Matching the same item (web domain, by identity, never by index)

`domain/src/runtime/target-reacquire/` implements `reacquireTarget`:
- **Rows** (`row` lineage, candidates are records): exact equality after whitespace/case normalisation, never
  fuzzy. Key columns first: the read's declared row identity (`dedupe.by` through Core's
  `automationStudioRecordRowIdentity`), then columns holding a link target or id-like value. With no key
  columns, the row's **word columns** (text that is not only a number, count, price or time) must all be equal;
  number/time-only columns may differ (that is what a re-render changes). Exactly one candidate must match:
  none = `gone`; more than one = `unmatched/ambiguous`; a stale row with fewer than two identity values =
  `unmatched/unidentifiable`. A candidate equal to the stale row except in one word column (similar text,
  another author) is a different item and is never accepted.
- **Elements** (`output` lineage, candidates carry element fingerprints): compare
  `webElementIdentitySignals` (`domain/src/element-fingerprint/signals.ts`); a candidate matches when every
  signal both carry agrees and at least two agree (the existing minimum); position, selector, xpath and handle
  numbers are never compared. Unique match = `found`; none = `gone`; several = `unmatched/ambiguous`.
- `returnToSourcePlace`: the source attempt's recorded page location against the current one, navigating
  with the domain's own navigate output when they differ.

### D5. Rebinding and accounting

- `found`, `row`: the fresh row is written to `values.item` and `values["<F>.item"]` for the rest of this pass
  (the later body steps of the pass see the same fresh row; the next pass gets its own row from For Each as
  usual). The loop's list is not replaced.
- `found`, `output`: an overlay `{ "<S>.<output>": fresh }` is applied to this node's remaining attempts only
  (cleared when the run leaves the node).
- **No extra retries.** The re-acquire spends no attempt: the attempt after it is the retry the policy already
  had (with `maxAttempts = 4`, attempt 4). The re-run's time counts against the node's waiting allowance like
  any wait. One re-acquire per arrival (`ctx.arrival.reacquired`); a later failure of the fresh target spends
  the remaining retries and then the normal ladder.
- The attempt that follows carries `reacquire: { sourceNodeId, kind, outcome, reason?, returned?, at }`
  (`AutomationStudioTargetReacquireRecord`).

### D6. Gone

`gone`: no further retry is spent. Core synthesizes the node's attempt without dispatching (the `notShown`
pattern in graph-run): `status: "failed"`, failure `{ category: "target_not_found", code:
AUTOMATION_STUDIO_TARGET_GONE_CODE ("executor.target.gone"), retryable: false, stage: "target_resolution",
effect: "unacted" }`, message "The item it was for is no longer on the page." It then goes down the normal
failure path (On Fail, failed route, continuation). Judgement call: in-run model repair is **not** asked for
it (no change to the step can bring the item back), guarded by the code in `step-loop/incident-repair.ts`.
`unmatched`/`unavailable`: the remaining retries run on the old binding exactly as before.

### D7. Paths

- **Playback and build trials** both run `runAutomationStudioGraph`, so D1-D6 apply unchanged: Core hooks the
  arrival of the reacquire attempt (`step-loop/arrival.ts` calls `target-reacquire/reacquire.ts`), and
  graph-run applies the overlay or the gone attempt.
- **Exploration and draft tests** (domain `node-run`): `automationStudioDispatchWithNodeRetries` takes an
  optional `reacquire` callback (type `AutomationStudioNodeRetryReacquire<T>`, written), asked once before
  attempt 4 under the same predicate; `found` swaps the dispatch for the remaining attempts, `gone` ends with
  the given answer, else nothing changes; the outcome is returned as `reacquire`. The domain supplies it for a
  row-bound replay (`node-run/replay.ts`, which sends the pass's `item`: re-run the draft's read command
  read-only, match the row, re-scope) and for an exploration press on a looked-up handle (look again with
  `retries/look.ts`, match the element by D4's signals in the fresh packet, dispatch on the fresh element).

### D8. Chat

One recovery row under the step's card, through `emitAutomationStudioActivityStepRecovery` with the new
contract kind **`reacquire`** (`CLIENT_GATEWAY_ACTIVITY_RECOVERY_KINDS`, added): `succeeded` on `found`,
`failed` on `gone`; nothing on `unmatched`/`unavailable` (the retry or failure line already says it). Subject:
Core's own words, naming the source step by its authored label at most: "Found the item from “Read the
posts” again" / "The item from “Read the posts” is gone"; never page text. The extension's
`panel/chat/stream/step/recovery-words.ts` gives it a card "Found again · <subject> / Done" and one plain
sentence: "The page changed, so it looked again and found the same one." / "It is no longer on the page."

### Decisions and judgement calls

| # | Decision | Kind |
| --- | --- | --- |
| 1 | Lineage derived from the graph (wired `item`, `$node` bindings), not stored | decided |
| 2 | Only read-only sources are re-run; a mutating source records `unavailable` | judgement |
| 3 | Re-acquire before attempt 4 (or the last attempt when a Flow has fewer than 4) | judgement for <4 |
| 4 | Re-run is internal: no attempt pushed, no dataset rows, no values written | decided |
| 5 | Empty or failed re-run is `unavailable`, never `gone` | judgement |
| 6 | Row match by key columns, else all word columns; numbers/times may differ; exact, unique | judgement |
| 7 | Found row rebinds the rest of the pass; output overlay only this node | judgement |
| 8 | Gone ends the step without spending retries, normal failure path, no model repair | judgement |
| 9 | New contract recovery kind `reacquire` (wire change, additive) | decided |
| 10 | Navigation back only to a location the run itself recorded for the source | judgement |

### Out of scope

A step with no source (a fixed recorded control) keeps today's fingerprint scoring; a mutating source (a
search submit) is not re-run; result verification, trial-feedback/submit-check words, activity ending words
and check-card labels (t785) are untouched.

### Deviations recorded during the build

- D1 read-only source: also a node that declares a record output (`recordOutput`, `recordsPath`) and does not
  mutate, matching `defensive/node-side-effect.ts`; saved list reads carry `recordsPath`, not `effect: observe`,
  so without this playback never re-acquired (supervisor integration fix).
- D2 stale codes: matched as a whole code segment (`stale`, `detached`, `renumbered`), not the `_x` pattern.
- D3.4 missing `reacquireTarget`: recorded `unavailable` (no re-run), not `unmatched`; a throw or malformed
  answer stays `unmatched`. Retries behave the same either way.
- D5 the re-run's time is not added to the node's waiting allowance (the defence ledger only adds wait with a
  fault entry). Open.
- D8 a gone item reads on the extension card as "Not done: it is no longer on the page".
- Run detail carries `metadata.reacquire` (ids and closed codes) so the step log shows it.
- The headed proof ran on photo-social (case 13c): on social-network-feed no site control changes a value a
  read takes.
