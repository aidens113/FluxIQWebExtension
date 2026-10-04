# Checked retarget evidence design — worker report

## Current State
Read-only design complete against frozen t262. No source edits, builds, tests, provider calls, runtime/profile/store reads, or live-run claims. A2/B live source remains untouched. This is a proposed correction, not an implemented or verified fix.

## Confirmed path
Core source root below is `packages/fluxiq/src/programs/automation-studio/runtime/`.

1. `llm/evidence-loop.ts` resolves old step placement, then calls `automationStudioNodeRerunAnswer`. The lasting-act check is about the *replaced* step.
2. `flow-draft/verify-only.ts` StepActDone means old effectApplied=true, proposes not false, and old replay mode verify (declared lasting consequence or instruction lasting act). This protects an effect already performed from duplication.
3. `llm/node-tools/rerun-check.ts` sends the new input with replay:verify and the old replay.from. Verified/present is treated as acceptance, with no host execution.
4. `checked()` overwrites old input and optionally ranWith/words; deletes control and replayed. It leaves effectApplied=true, stateBefore/stateAfter, original callId, acts, and replay/produced from the old execution. Some of those members are historical truth, but no longer prove what the new configuration did.
5. Domain `node-run/verify.ts` correctly dispatches only web.dom.assert visible/enabled checks, returns effectApplied=false, and optionally a newly resolved ranWith. The old step does not inherit that false flag. `present` uses same-location/missing-target evidence, not authenticated proof that the newly targeted action happened.
6. Core's existing rerun-check tests intentionally keep Tom's new target while only Amara has been accepted. They assert no duplicate press and new configuration, but omit the necessary distinction between candidate configuration and performed evidence.

Example: an executed variant selection wrongly claimed as cart a1 can be checked using an Add-to-cart target. The argument becomes Add-to-cart while old effectApplied/act-shaped evidence survives. Neither a verified target nor the claim a1 demonstrates that Add-to-cart ran.

## Safest semantics
Keep the old lasting-effect protection, accept a checked replacement as a *configuration candidate*, and preserve the old executed record as historical evidence bound to the old configuration. A check must never silently become proof that the replacement ran.

For a successful checked replacement:
- Preserve old execution evidence under the old argument/record identity; reference it as prior history. Do not relabel its state transition, output, control, performed act, or original callId as the new configuration's.
- Set the current configuration's effectApplied=false, attach an explicit checked-candidate marker with check code and check-call identity, and retain its intended act claims as intentions. Keep a candidate proposable so it can reach the existing full test; do not make it did_not_work merely because nothing was acted on.
- Clear replayed for the changed configuration and invalidate subsequent test marks, as any changed dependency must. New ranWith is checked/resolved configuration, not a new execution. Preserve the necessary replay.from as placement context, while dropping old produced/output comparison evidence from the candidate.
- Keep the historical already-performed protection separately. Merely clearing effectApplied would make a second rerun run normally and could duplicate a lasting effect. The guard must consult the old performed record/protection rather than pretending the candidate executed.
- Emit truthful feedback: old configuration was performed; replacement was checked, not performed. `verified` means currently resolvable/actionable; `present` is an inference from missing target on the recorded location and cannot establish execution of a distinct replacement.
- A refused check leaves the existing step unchanged. Plain calls and reruns of never-performed steps retain existing permission behavior. No extra denial or model permission restriction is added.

Recommended first phase has no host identity prerequisite: every checked replacement is represented truthfully as checked candidate, even when the inputs happen to be equal. This may conservatively withhold a claim of repeated execution; it does not restrict what the model can configure or explicitly run.

Do not set written=true on arbitrary verify answers: Core only accepts that mark beside core.run_node.written, and the domain's write:true path performs schema/declaration/start/origin checks that verify alone does not replicate. A separate checked-candidate marker avoids fabricating that stronger contract.

## Host identity alternative and limitations
An optional later host-authenticated *action identity* could prove that a changed spelling still names the same performed configuration. Core must compare only an opaque host-issued identity; it must not parse URLs/selectors/labels or infer equivalence from JSON equality/inequality. Existing stable handles are not a generic proof API.

The domain stable-handles contract scopes numbers to project/Flow, separates pages, and rebinds captures through exact/loose address, words, and unique place matching. That is useful resolving evidence, but heuristics and identical labels cannot prove semantic target identity across all reloads/site state. Even the same target handle is insufficient if typed value, quantity, selected value, action kind, row, frame or input bindings changed.

A trustworthy identity would need domain-owned scope plus action definition, resolved target identity, all effect-bearing parameters and binding context. It must distinguish a template from one concrete row/one test binding. Raw selectors or page words must stay private. No such authenticated identity was found in the required existing contracts; proposal details and stability are unproven. Do not ship an equality shortcut as proof. Candidate semantics can ship independently and remain the fallback when identity is absent/ambiguous.

## Whole Flow tests, write:true, permissions, bindings
- Full tests must still start at the Flow's start, use the replacement configuration and all preceding dependencies, and carry checked/not-performed provenance to the judge. Current replay-draft reads StepReplayMode: lasting steps are verified whether written or performed. Thus a passing full test containing verified candidates remains a conditional actionability check, not measured execution of those effects.
- Existing write:true is explicit no-action authoring: domain resolves/freezes handles, checks required parameter shape and declaration, skips current covered-target and action permission calls, and returns core.run_node.written. The existing plan-time flow_step permission and actual execution gate still govern lasting actions. Preserve this behavior; do not secretly act to make candidate evidence look stronger.
- Verify asks the permission seam as observe with no declared consequence, executes read-only assertions, and never presses. Actual execution must retain the original consequence/person gate; never inherit old permission as authorization to a newly targeted action.
- Candidate retargets must retain $input/$row/$state bindings in frozen configuration and be tested with the existing per-row/per-input resolver. Proof about one test value/row cannot carry to another value/row, even with equal control identity. Existing repeat tests must continue to report passes and not_reached; a candidate inside a zero-row loop was not exercised.
- Already-performed lasting effects remain in the real site after reset; reset is navigation, not site-data clearing. Preserve those facts as historical. Never automatically execute a speculative retarget, undo an old lasting effect, duplicate it for a test, or introduce destructive resets.
- Intended act claims are model configuration intent. Existing checklist is advisory (except consequence declaration permission rule), and written steps can be proposable without a prior mutation. Label the candidate so the checklist/judge does not turn intended coverage into observed execution. Do not add a new completion restriction to compensate for the evidence bug.

## Meaningful failing-before regression proposal
No tests run while live. Use the existing fake friend-request host and direct rerun helper fixture; synthetic values only.

1. Old step Confirm Amara: effectApplied=true, a1, before/after digests, replay.from/produced and old callId. Checked rerun Confirm Tom returns verified, effectApplied=false and new resolved configuration. Assert no Tom acceptance, candidate current effectApplied=false, original proof remains attached only to Amara, candidate has no old produced/state transition, intended a1 remains explicitly intention, replay marks cleared. Current source fails these proof assertions.
2. Check same template returning present for a *different* target: do not emit new performed proof. Same-location absence must not become execution identity.
3. A second rerun after candidate acceptance still checks, never presses Tom; this catches the dangerous simplistic effectApplied=false-only patch.
4. Refused check preserves old configuration/proof; ordinary explicit call still presses as authorized. Same-input check is still a check unless an authenticated host identity contract proves equivalence.
5. Whole-test/judge/entry fixture asserts candidate kept/proposable with checked/not-performed distinction, never did_not_work or old changed:yes. Existing intended-acts advisory semantics remain intact.
6. write:true fixture retains written code/mark and no-act behavior; malformed written declaration remains refused. Candidate does not acquire written=true from a verify result.
7. Binding/repeat fixture changes input test value and row identity while using the same control: no inherited execution proof; zero-row candidate remains not_reached, lasting checks perform no mutation, normal permission denial still holds on explicit real execution.

## Minimal exact partition and dependencies
First phase, Core only, one serialized worker unit because these files share draft contracts. Paths relative to Core runtime root:

```text
llm/node-tools/rerun-check.ts
llm/node-tools/tests/rerun-check.test.ts
flow-draft/step.ts
flow-draft/tests/step.test.ts
flow-draft/entry.ts
flow-draft/tests/entry.test.ts
flow-draft/verify-only.ts
llm/node-tools/tests/lasting-acts.test.ts
llm/node-tools/tests/dry-run-gate-loop.test.ts
llm/node-tools/tests/replay-draft-acts.test.ts
```

Responsibilities: rerun-check preserves historical proof, writes checked-candidate state and truthful feedback; step contract/proposability recognizes explicit candidates; entry shows provenance; verify-only preserves old lasting protection without current-execution misclaims. Existing loop is a caller/read-only integration dependency, not initially released; no need to broaden it merely to implement candidate metadata on the step. Add whole-loop assertions in existing rerun-check fixture. The replay/full-test owner tests cover compatibility and bound row behavior. If evidence shows entry/check/judge omits provenance outside this partition, request the exact missing owner before implementing, rather than claiming completeness.

Owning narrow command through heavy wrapper, Core cwd:

```text
pnpm --filter fluxiq exec vitest run src/programs/automation-studio/runtime/llm/node-tools/tests/rerun-check.test.ts src/programs/automation-studio/runtime/flow-draft/tests/step.test.ts src/programs/automation-studio/runtime/flow-draft/tests/entry.test.ts src/programs/automation-studio/runtime/llm/node-tools/tests/lasting-acts.test.ts src/programs/automation-studio/runtime/llm/node-tools/tests/dry-run-gate-loop.test.ts src/programs/automation-studio/runtime/llm/node-tools/tests/replay-draft-acts.test.ts
```

Optional host identity phase is a separate written brief after the actual identity contract is chosen. Candidate paths then: Core llm/evidence-loop/tool-execution.ts and its strict parser owner/tests, flow-draft/step.ts, rerun-check.ts/tests; downstream capture.ts, node-run/{run.ts,verify.ts}/tests and one focused new action-identity module with barrel. stable-handles.ts is read-only reuse unless its owning semantic contract truly changes. Exact parser/transport public contract release must be confirmed before this phase; it was not investigated broadly in this bounded brief. Do not dispatch both phases concurrently against step/rerun-check.

Supervisor owns authored architecture updates, paired package types/builds/structure audit, final verification, commits and subsequent live testing. This report neither diagnoses active A2/B nor promises a live retarget acceptance.

## Unproven assumptions
- Candidate marker/historical record names above describe semantics, not a finalized API/schema.
- Full-test judgment currently receives check observation evidence; whether every summary/UI displays candidate provenance requires a bounded follow-up when implementation adds it.
- No domain contract authenticates semantic equivalence of arbitrary new arguments with an old performed effect.
- Existing already-performed guard cannot simply be removed or weakened without reopening the witnessed duplicate-lasting-effect regression.