# w2 multi-action current map

## Verdict

Do not merge or copy the t021 worktree. It established that DeepSeek can emit the proposed list shape, but not that the shape improves the product: the same social-scheduler task went from 15 provider calls / 6 actions / 274 seconds at baseline to 25 / 13 / 313 seconds with the schema and 27 / 21 / 338 seconds with the explicit instruction. None of the three runs created a Flow. Four responses in the last run contained batches, and every batch stopped after its first action.

Current `dev` has since acquired the facts the prototype lacked: `web.enter_field`, stable handles, state digests, truthful web `targetsUnchanged`, per-action closed consequence declarations, terminal permission requests, and ordered recovery state records. The reusable idea is therefore only the generic Core decision “one or an ordered list.” Its parser, executor, evidence packet, permission interaction, accounting, and diagnostics all need to be reconciled with current code.

Read-only sources were downstream `f365983d071924b22061e07c22e46af8e3d9afe9`, Core `4c2ffa262d3d7f1786873d457a0a14af9e3dbca7`, and the dirty, uncommitted t021 Core prototype based on `a0f9985`. No provider call was made.

## File-by-file disposition

All paths in this table are under `packages/fluxiq/src/programs/automation-studio/runtime/` in Core. “Drop” means do not carry the stale file or hunk; it does not prohibit extracting the current implementation afresh when structure requires it.

| t021 file | Disposition | Current-dev mapping and reason |
|---|---|---|
| `llm/evidence-batch/decision.ts` | Rewrite | Keep one canonical `tool_calls` variant and Core-assigned collision-safe call IDs. Drop the permissive `actions` alias, singleton-as-list near miss, missing-input repair, and parse-100-then-truncate behavior. Current provider output parsing is closed and bounded; the batch branch must be equally strict. |
| `llm/evidence-batch/index.ts` | Port | A barrel remains the correct ownership boundary after the rewritten batch modules exist. |
| `llm/evidence-batch/packet.ts` | Rewrite | Preserve ordered outcomes and a bounded latest authoritative state, but integrate the current evidence-window policy and explicitly identify exactly what becomes model-visible. The stale packet silently suppresses intermediate evidence that current permission gates have already treated as shown. |
| `llm/evidence-batch/run.ts` | Rewrite | Reuse one current `executeOne` path for singleton and batch actions. Preflight against the current iteration's eligible tools (not merely the global registry), then sequentially perform per-action repeat checks, call-ID allocation, action-budget admission, wrapped execution, evidence/action accounting, trace, and stop evaluation. |
| `llm/evidence-batch/schema.ts` | Rewrite | Keep `minItems: 2` and a bounded maximum, but each list item must use the same tool-specific `inputSchema` as the singleton `oneOf`. t021 used a tool-id enum plus an unconstrained object, weakening structured output validation. |
| `llm/evidence-batch/stop.ts` | Rewrite | Keep the conservative rule: observations may continue; any refusal or non-applied mutation stops; an applied mutation continues only on explicit `targetsUnchanged: true`. Add current terminal permission/cancellation handling rather than reducing it to an ordinary packet stop. |
| `llm/evidence-window.ts` | Drop | Its content was extracted from an old loop. Current `evidenceContextWindow` contains later authoritative-entry and byte/count fixes. If batching makes the current loop exceed structure limits, extract the current function and its tests, not this stale copy. |
| `llm/tests/evidence-batch.test.ts` | Rewrite | Retain ordered execution, refusal, target-change, repeat, whole-list preflight, action ceiling, and packet-size cases. Add current eligible-tool rejection, per-item schema validation, one-use provider usage, action-ledger admission, state recording, hidden-evidence permission, terminal permission, and same-iteration trace/reduction cases. |
| `flow-bootstrap/generation-failure.ts` | Rewrite | t021 only enlarged a trace bound. Current diagnostics must bound action steps separately and derive decision/provider counts from accounting or unique positive iterations; trace length is no longer a decision count. Preserve current permission diagnostic parsing. |
| `flow-bootstrap/tests/generation-failure.test.ts` | Rewrite | Cover several ordered action steps on one decision, accurate counts, bounded serialization, and permission termination after an earlier successful action. |
| `llm/evidence-loop.ts` | Rewrite | This is the main integration point, but current no-progress/unusable-completion feedback, eligible tools, completion checking, `targetsUnchanged` parsing, result codes, and authoritative evidence window must remain. Extract a shared single-action transition and have singleton/list decisions call it; do not paste the t021 loop. |
| `llm/harness/output-validation.ts` | Rewrite | The t021 `typeof toolId` guard is only a type-error workaround. Validate the canonical union explicitly and report an indexed path for each batch item. |
| `llm/harness/provider-result.ts` | Rewrite | Parse the canonical list inside the existing closed structured-response parser and structural bounds. Do not bolt on a forgiving pre-parser before current validation. |
| `llm/harness/structured-response.ts` | Rewrite | Add the canonical decision union while retaining current diagnosis/no-repair/opaque-target hardening. Metadata stripping must copy only recognized list fields; summaries should expose only decision kind, action count, and tool IDs, never inputs. |
| `llm/index.ts` | Port | Export the reconciled batch surface from the existing barrel. |
| `llm/tests/evidence-loop-provider.test.ts` | Rewrite | Assert the provider sees the canonical optional-list schema with tool-specific inputs and the current instruction, and that the one-action-disabled arm does not advertise a multi-action variant. |
| `llm/tests/evidence-loop.test.ts` | Rewrite | Add list decisions without weakening current singleton, unusable-decision, completion-feedback, repeat, evidence-window, and call-ID behavior. Assert action order and one provider iteration for the list. |
| `loop-limits/evidence-loop.ts` | Rewrite | Current ceilings are 64 provider iterations, 64 actions, and 1,048,576 evidence bytes. Add a separately named maximum actions per decision (t021 used 16), but make the effective per-run value explicit and default it to one until enabled. |
| `loop-limits/flow-bootstrap-evidence-loop.ts` | Rewrite | t021's `min(maxIterations * 16 + 1, 64)` assumes batching globally. Derive `maxToolCalls` from the effective actions-per-decision setting, still capped at 64, while leaving provider-call, token, cost, and unusable-decision bounds independent. |
| `loop-limits/tests/flow-bootstrap-evidence-loop.test.ts` | Rewrite | Pin disabled = current singleton allowance and enabled = bounded action allowance, without changing the provider-call count or per-call cost share. |
| `service.ts` | Rewrite | Current service now owns permission wrappers, completion checks, unusable decisions, reusable context, and richer diagnostics. Sanitize and retain the current `effectApplied`/`resultCode` fields plus bounded batch position/size/stop metadata; allow the correct action-step trace bound; count provider calls as distinct positive iterations rather than trace rows; never duplicate one decision's usage over all its actions. |

There were no t021 downstream product changes to port. Current downstream `domain/src/runtime/llm-evidence/{enter-field,stable-handles,state-digest,tools}.ts` and `target/stability.ts` remain authoritative. Only focused regression tests should be needed there unless a live run exposes a domain defect.

## Contracts the implementation must preserve

### Ordered actions, evidence, and state

1. Validate the complete list before action 1: 2–16 items, known and currently eligible tool IDs, valid tool-specific input, list/action/evidence budgets available, and no impossible duplicate/repeat. An invalid later item runs none of the list.
2. Execute strictly in array order through the same wrapped `executeTool` used by a singleton. Give every item a unique call ID and append one trace row immediately after that action finishes; rows from one list share the provider iteration and carry batch position/size.
3. The recovery state recorder remains around each individual call. Its ordered records and call-ID join already support several calls at one iteration; reduction must consume the trace in that same order. Never digest only before and after the whole list.
4. Update repeat signatures, mutation epoch, observation epoch, action ledger, evidence bytes, and action count after each action, before considering the next. Provider usage belongs to the decision once, not once per action.
5. A refusal is any current domain-classified refusal/result or recoverable `{ok:false}` evidence. It is recorded for the action and stops the list. It is not permission to try a later action.
6. An observing action can continue after a valid result. A mutating action can continue only when `effectApplied === true` and `targetsUnchanged === true`. Missing is false. `effectApplied: false`, navigation, removal/rebinding, or location change stops before the next item.
7. The next provider decision receives one bounded `core.batch_result`: ordered action receipts plus the newest authoritative full evidence and only those earlier entries the current window policy admits. Durable state records retain every action even when evidence is compacted.

The current web meaning of `targetsUnchanged` is exact and sufficient for this gate: location must be identical and every handle present before the action must still map to exactly the same selector after it; new handles may appear. The t026 live sequence measured opening the composer as `false`, then account/date/time/text entries as `true`. Thus the useful batch is the consecutive field-entry segment, not “open composer + fill fields.” Navigation always reports false.

### Per-action permissions and refusals

Every list item must call the current wrapper independently with `{kind:"exploration_step", id: toolId, ref: callId}`. The domain declares that action's consequences and control/verb; absent authorization fails closed. On the first permission request, the gate aborts the run, the attempted action is recorded/refused, no later item executes, and Flow Bootstrap returns `flow_bootstrap.permission_required` (runtime recovery returns its operator-approval stop). A batch is never one permission unit and permission may not be inferred from an earlier item.

There is one required redesign before batching: `AutomationStudioActionPermissionGate.observe` currently runs after every execution because singleton results are all shown to the model. t021 may omit intermediate results from its packet. Mechanically combining the two would allow a later permission request to quote a control name found only in hidden intermediate evidence. Move “shown evidence” observation to the exact loop boundary that publishes evidence to the model, or guarantee that every observed value is actually in the batch packet. The former is safer: action 2 was authored from the pre-batch evidence and may quote only that already-shown evidence, not an unseen action-1 result.

## Collision and regression risks

- **Eligibility bypass:** t021 preflighted global known tools, whereas current repeat-gated observations are removed from the per-iteration offered set. A list must be checked against that exact offered set.
- **Schema weakening:** generic list-item `input: object` bypasses each tool's required/closed input schema.
- **Partial invalid lists:** discovering item 4 is unknown after items 1–3 ran produces a state the provider never proposed validly. Whole-list structural/eligibility preflight is mandatory; dynamic runtime refusals still stop in place.
- **Permission evidence leak:** current `gate.observe(execution)` and t021 evidence compaction disagree on what the model saw.
- **Accounting drift:** trace rows cease to equal provider decisions. Current `service.ts` and generation diagnostics use trace length/rows; t021 fixed only one audit count and a bound.
- **Usage multiplication:** copying decision usage onto every action would multiply tokens/cost. Attach it once or represent the decision separately.
- **Trace sanitation loss:** current `sanitizeEvidenceLoopTrace` already drops `effectApplied` and `resultCode`; batching also needs bounded position/size/stop data. If those are absent, live evidence cannot prove why action 2 did or did not run and recovery diagnostics lose refusal facts.
- **State-chain corruption:** recording only a batch-level before/after digest would make reduction unable to replay or remove individual actions.
- **Evidence overflow after side effects:** action evidence must be reservable before the action executes, or a successful side effect followed by `evidence_limit` becomes unreportable. Reserve conservatively per action and always leave room for the bounded stop packet.
- **Call-ID/repeat ambiguity:** validate requested IDs and allocate unique IDs per item, while repeat signatures remain per action and current mutation epoch.
- **Feature-control mismatch:** changing only the provider instruction while leaving the list schema offered (or the reverse) is not a true disabled baseline. One effective actions-per-decision value must control schema, instruction, parser acceptance, and executor.
- **Core boundary:** the generic decision/list runner, budgets, trace, permission gate, state recorder, and evidence packing belong in Core. Browser handles, DOM snapshots, selector equivalence, field entry, and `targetsUnchanged` computation remain downstream; Core must not import them.

## Smallest safe implementation slices

1. **Canonical decision surface, disabled by default.** In Core, add a strict `tool_calls` union, tool-specific list schema, parser/strip/summary support, and `maxActionsPerDecision` with an effective default of 1. Add boundary/schema tests only. No executor behavior changes yet.
2. **One transition, two decision shapes.** Refactor the current singleton body into a shared ordered `executeOne` transition; add the batch runner and stop policy. Preserve exact current singleton behavior at 1. Add tests for atomic preflight, ordering, call IDs, repeat/epochs, usage once, target-stability stops, evidence limits, and action ceiling.
3. **Permission and state integration.** Make evidence visibility explicit to the permission gate; run each item through the existing Flow Bootstrap and recovery wrappers/ledgers/recorders. Add terminal permission/refusal tests and a reduction test with two same-iteration actions and intact per-action digests.
4. **Diagnostics and callers.** Update Flow Bootstrap limit derivation, service trace sanitation/audit, generation-failure diagnostics, and provider harness tests. Prove provider calls = distinct positive iterations/accounting iterations, actions = executed tool rows, and trace/evidence remain bounded. Keep downstream implementation unchanged; add only a focused web regression showing `open=false` and stable field entries `true` if existing tests do not already pin it.
5. **Live comparison only after slices 1–4 pass review.** Use the one compiled Core/downstream revision and the production panel + unpacked extension path described below. Do not promote the feature from its one-action default on merely receiving a list.

Slices 1–3 should be separate commits because each has a closed testable contract; slice 4 can follow once both callers are reconciled. Do not begin from t021 files: implement against current owners and use t021 tests only as case ideas.

## Exact same-code live baseline/variant

Use the production panel and loaded extension against fresh, isolated Lab workspace/store/browser profiles and non-3000 ports. Both arms use the same built downstream/Core hashes, DeepSeek `deepseek-chat`, fixture revision/seed, social-scheduler start URL, instruction text, blank Flow settings, permission grants, and browser. The only difference is an explicit run-scoped `maxActionsPerDecision`: baseline `1` (list schema absent and list decisions rejected), variant `16` (canonical list schema/instruction enabled). Run baseline first, then variant, each from a newly created blank project/Flow and reset fixture/profile; do not reuse page or Flow state.

Use the current evidence-guided production-panel budget in each arm: 48,000 input tokens, 8,000 output tokens, 56,000 total tokens per request, 26 authorized provider calls, 560,000 total tokens per run, $0.25 maximum estimated cost per call, $1 maximum total estimated cost, zero retries, a 25-second saved per-call timeout (the Lab command allows the 60-second claim window plus 600-second run lease), and no second attempt. Across both arms the campaign ceiling is 52 calls, 1,120,000 run tokens authorized, and $2 total estimated cost. Record the issued grant values before accepting a run; if production resolves different values, stop rather than compare unequal budgets.

For each arm record wall time, provider calls, provider usage/tokens/cost, action count, ordered trace `(iteration,batch position,size,toolId,effectApplied,targetsUnchanged,resultCode,stop)`, permission requests, final Flow ID, plan-validation issues, and deterministic execution oracle. Do not record raw page evidence or field values.

Acceptance is conjunctive:

- both arms create a persisted Flow that passes current plan validation;
- both saved Flows execute through the production extension and pass the same social-scheduler deterministic oracle;
- neither arm makes a provider call outside the issued grant or retries, and neither asks for unintended consequences;
- baseline contains no executed multi-action decision;
- variant has at least one provider decision with at least two actions actually completed in order (not merely listed), expected to be adjacent stable `web.enter_field` actions after the composer-opening stop boundary;
- variant trace/accounting agrees exactly: one provider iteration for that list, two or more action rows, one use of provider usage, and ordered per-action state records;
- every continuation after a mutation is justified by explicit `effectApplied:true` and `targetsUnchanged:true`; any refusal, permission request, false/missing stability, navigation, or evidence/action bound leaves all later listed actions unexecuted.

Report calls/actions/time as measurements, not an optimization pass criterion. Promotion requires the user-visible outcome above; “fewer calls” alone cannot rescue a variant that fails its Flow or oracle, which is the central lesson of t021.

## Validation performed

- Read the required three historical reports, the complete t021 dirty diff/untracked batch files, and only their current direct counterparts plus the current permission, recovery recorder/reduction, downstream evidence/stability, and Lab budget owners needed to resolve collisions.
- Confirmed current Core and downstream task heads and inspected both worktree statuses without modifying either product tree.
- No provider, browser, panel, automated suite, commit, or push was run; this is a source/evidence reconciliation report only.
