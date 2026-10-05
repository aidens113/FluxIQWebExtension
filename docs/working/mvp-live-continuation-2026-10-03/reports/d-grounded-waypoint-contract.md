# D grounded ordered waypoint contract

## Current State

Read-only design complete. Prior D reports, five initial current owners, two approved authority/amendment owners and two approved narrow permission/purse-forwarding contexts inspected. Only this report changed; no source/tests/build/types/audit/runtime/provider/state/key/git/shared-document actions. This is an executable contract/partition proposal, not D implementation or live acceptance.

## Existing contract facts

Current bootstrap context has an opaque start location and Core-derived route-state signatures, without grounded waypoint obligations or a waypoint-to-draft relation. Draft step identity is stable `id`, while position is renumbered. Current steps distinguish scheduled carried candidates, written configurations, checked candidates, original prior execution, and replay/current proof; these must remain separate.

`acts` names the model's instructed-act claim. Its claim helper deliberately removes the same act from all other steps. Reusing that field for an ordered waypoint involving an opener and subsequent action would lose necessary relations and would falsely imply that a model's claim establishes execution. A waypoint relation needs its own explicit typed intention namespace; execution proof must stay a separately derived current host/Core fact.

Existing instruction derivation grounds consequence quotes to current active instruction text and digest, but its schema asks only for consequences. Its reader returns an empty permission derivation after malformed/ungrounded claims, which safely asks for permission but cannot classify a route as open. Existing normalization is a quote-grounding seam to reuse through a focused owner, not duplicate.

Prior t195 global URL scanning, first-step-only triggering, failed-read-to-open fallback, and blanket companion withholding are unsafe to port. Existing declared `runsNodes.arrival` identifies an arrival node/opaque destination parameter only; it does not identify intermediate obligations. Domain labels/URL/DOM interpretation belongs downstream.

## Current shared-reading authority, corrected against old assumptions

Current `service/instruction-authority.ts` returns `derive` and usage; each `derive` invocation itself calls the harness. It is not the old t195 memoized two-purpose reader. Current `flow-bootstrap/action-permissions.ts` forwards it into `AutomationStudioActionPermissionGate`; gate-internal caching was not read in this unit. A new route accessor must not bypass that permission-only path and pay for a second call.

The approved exact service1550-1570 contexts establish real current admission: the authority uses `creation.reading(runHarness)` inside `creation.run`, under the one creation purse. The gate receives `deriveInstructed: authority.derive`. Tokens/cost and reader-call count feed current build accounting separately from the loop trace. Keep that path; do not hardcode a call bound or alter Lab/UI defaults.

Move shared memoization into the authority's owning module: one promise returning `{ instructed, route }`, consumed by both `derive()` and `route.read()`. `route.peek()` returns unread/known without sending. Set the promise before awaiting so concurrent callers share it; retain its unavailable result after a failed/malformed/ungrounded reading, without automatic retry. Preserve existing consequence derivation fallback/permission prompting independently: invalid route evidence must not erase otherwise grounded consequence permissions, and valid consequences do not turn a missing route field into open.

## Proposed closed reading contract

Introduce a focused generic `action-permissions/instruction-route/` owner, through its own barrel. Proposed internal type (names may follow owning naming conventions):

```text
InstructionRouteReading =
  unread
  | named { instructionSetDigest, routeId, sourceQuote, waypoints[] }
  | open { instructionSetDigest }
  | unavailable { instructionSetDigest?, reason }

Waypoint = { id, order, instructionId, instructionDigest, quote, sourceSpan }
```

`reason` is closed: transport, non_complete, malformed, ungrounded, stale, or ambiguous; no raw thrown message/model prose. The authority's single completion schema asks for both existing consequence claims and explicit route classification. Missing optional legacy route, unsuccessful answer, non-completion, malformed ordering, unknown instruction ID or ungrounded text becomes unavailable. Only an explicit well-formed successful `open` classification is open. Open remains a model interpretation of the user's intent, not deterministic proof that no route was requested.

Core generates route/waypoint IDs after validating the active source IDs/digests and grounded quotes. Bind to the current instruction-set version and the explicit ordered waypoint list. The entire route quote anchors ordering language; each waypoint quote anchors its own source. A quote appearing in two possible places must be disambiguated by source ID/enclosing route span or become unavailable; don't silently choose a convenient page label. Source spans refer to the original instruction text with explicitly declared string-offset units. Reuse/extract the current quote-normalization owner without changing existing consequence quote rules. Do not impose the permission reader's existing300-character quote limit on an entire route or truncate a long ordered route to fit it.

Grounding proves copied words and current source identity. It does not prove the semantic order the model inferred, complete coverage of every route clause, or that an action visited anything. Where source text says an order indirectly, the reader's order remains interpreted intent and the whole-Flow judge still checks it. Instruction edits/inactivation invalidate the reading and all claims tied to that version; no implicit reread on the same failed promise. A new authoring scope can legitimately read the new version under existing authority.

## Separate draft intention and actual proof

Add a separate typed route-intention field on draft steps, rather than reusing `acts`, `words`, URL strings or state signatures:

```text
step.waypointClaims[] = { routeId, waypointId, role: fulfills | supports }
```

These are model statements about the authored plan. Multiple setting/opener steps can support one waypoint; a waypoint can require multiple steps. A step can relate to more than one obligation when the model explicitly says so. Adding a claim changes no action result, permissions, `effectApplied`, `written`, `checkedCandidate`, `scheduledCandidate`, `instance`, replay state, or historical execution proof. Claim reassignment is explicit and does not implicitly remove every other supporting step as `act-claim.ts` currently does for acts.

Stable step IDs carry the relation across renumbering. For a relation to appear as current evidence, Core records the configuration revision/call identity it refers to. Prefer a Core-generated revision identity changed by actual edits, rather than publishing hashes of private resolved arguments. Current display can derive a separate evidence record:

```text
{ stepId, configurationRevision, claim, evidence:
    intention_only | configuration_checked | performed | whole_test_observed | withheld | unavailable }
```

The model cannot write `evidence`; derive it from current existing execution/check/replay provenance. `performed` means only that this exact current action configuration actually ran under existing semantics. It does not mean the waypoint is semantically satisfied. An idempotent effect/observation can still be actual execution; use existing owners' truthful authority, not a new `effectApplied=true` heuristic. A current checked, written or scheduled candidate remains not performed. Prior execution on a different configuration remains historical/private and cannot satisfy a retargeted candidate's waypoint.

Parameter, binding, settings, condition, repeat, retarget/replacement and instruction-version changes invalidate current waypoint evidence. Ordering edits invalidate dependent whole-test evidence from the earliest affected step, alongside existing replay mark invalidation. Preserve the intended relation but show it needs current validation, rather than inventing new proof. A newly authorized fresh action still goes through ordinary Core execution and permission/lasting guards; naming the relation never executes it.

For persistence, carry only the validated grounded route contract and Core-derived intention relations onto saved plan/node metadata. Strip model-supplied performed evidence the same way current contracts describe stripping model-supplied route signatures. On repair/reseed, restore intent as a scheduled candidate, not as execution. No generic `ranWith` seed, host-private selector or absent-declaration default becomes route proof.

## Selective structural editing and honest gaps

Evaluate route impact against stable IDs and proposed order before mutating, then respect the existing sequential amendment grammar: later numeric references see the positions left by earlier edits. Preview/snapshot the relevant relation, never reinterpret all URL-shaped inputs. Both immediate `split.now` and post-rerun held settlement need the same route-aware bookkeeping; don't validate a candidate once and apply stale held edits after replacement.

For a current named route, a positively linked fulfilling/support step is structurally required while no explicit alternative kept candidate supplies that obligation. A standalone removal or inversion must return route-specific feedback naming the grounded obligation and implicated stable step IDs. A declared replacement can preserve plan structure even while unperformed, but remains pending current whole-test evidence; accepting the edit must not upgrade its proof. Missing claims produce missing coverage, not a completed route.

Related companion edits are only those connected through these explicit intention/dependency IDs (including the existing actual opener relation when the current owner can identify it). If shortcut A and companion B participate in the same route relation, withhold that dependent group; let unrelated detour C remain editable. Co-occurrence in one decision, adjacency, a shared label, or `drop`/`exploratory` vocabulary alone never establishes dependency. Preserve partial applied/refused counts and existing repeat/no-progress behavior.

Unavailable reading cannot authorize an arrival shortcut or a change to an already named route relation. Retain those positively identified original configurations and return recoverable unavailable feedback while applying unrelated changes. For an unlinked intermediate step, Core has no basis to know that its drop bypassed a waypoint; do not invent a blanket membership test. The resulting missing/unknown route coverage must be visible at completion and whole-Flow judgment. Before any implementation claim of full protection, the actual fixture must establish mapping and detect isolated intermediate removal. This boundary is deliberately explicit: declaration/start protection alone is insufficient.

An explicit successful open route allows a valid shorter declared arrival and specifically related travel removals under normal permission/replay policies. It does not override child-task scope, lasting effects or row-repeat dependencies. Lazy read triggers are positive route-sensitive edits (declared arrival relocation, edit of a stored/current route relation) or existing instruction permission demand. A build with no such edit and no instruction-permission demand keeps the reader unused. Unknown relations cannot both preserve this lazy zero-reader path and guarantee early interception of every arbitrary intermediate drop; the whole-Flow completion/judge remains the honest fallback. This is a fundamental evidence boundary, not a reason to scan browser URLs in Core.

## Phased executable ownership partition

All paths below are relative to Core `packages/fluxiq/src/programs/automation-studio/runtime/`. Existing paths named outside the read budget were discovered or retained from the bounded prior inventory; their actual mapping/consumer contexts must be released/read before editing. Each phase gets a separate written brief and meaningful fail-first. Do not copy t195 files wholesale.

1. **One closed shared instruction read.** Own `action-permissions/instructed.ts`, focused new `action-permissions/instruction-quote/` and `instruction-route/` owners/barrels, `action-permissions/index.ts`, `service/instruction-authority.ts`, their nearest tests, and a read-only compatibility run of `action-permissions/tests/gate.test.ts`. Add required route classification to the same completion, memoize one read in authority, preserve permissions/accounting. No edit enforcement or D completion claim in this phase.
2. **Explicit intention grammar and current evidence.** Own `flow-draft/step.ts`, `flow-draft/amendment.ts`, focused new `flow-draft/waypoints/` types/relation/current-evidence owners/barrel/tests, `flow-draft/index.ts`, and the actual schema/parser consumer discovered at `llm/evidence-loop-decision.ts`. Do not edit `act-claim.ts`. Coordinate current invalidation with exact `llm/node-tools/rerun-check.ts` and `llm/evidence-loop/rerun-replacement.ts` only after reading/releasing those contexts; preserve C4's scheduled-candidate separation. Stable IDs/configuration revisions and multiple support claims tested before enforcement.
3. **Lazy route-aware selective amendment application.** Own `llm/decision-handlers/amendment.ts`, `llm/evidence-loop/rerun-request.ts`, held-settlement owner contexts, `llm/decision-handlers/types.ts` only if context typing requires, and `llm/loop-configuration.ts`; service only the narrow authority/route forwarding site. Add a focused impact/coverage evaluator rather than expanding the loop coordinator. Root serializes overlap with other source units. No provider dispatcher or budget edits.
4. **Model/observer contract and closed feedback.** Own route projection through `flow-draft/entry.ts`, `llm/decision-context/shown.ts`, `llm/harness/{task-request,context-packet}.ts`, `flow-bootstrap/plan/{contracts,catalog}.ts`, relevant `llm/deepseek/request-body.ts` notes, `llm/draft-amendment-feedback.ts`, `flow-bootstrap/evidence-loop-steps.ts`, and `activity/wording/draft-edit-refused.ts`, plus nearest tests. Wire intention versus current evidence explicitly, through existing screening. Add only the new closed refusal reasons to actual consumers; don't import unrelated old numbering/repeat changes.
5. **Persisted intent and actual service proof.** Discover/read and release the exact projection contexts in existing `flow-bootstrap/authoring/{assemble,assemble-draft}.ts`, `flow-bootstrap/adaptation.ts`, `llm/node-tools/draft-from-flow.ts`, and current C4 scheduled-candidate readers before touching them. Add an actual scripted service/model/native execution fixture under the nearest `runtime/tests` owner using existing support through its barrel. Parent/root integrates any C4 overlap serially. Public saved/reloaded intent remains not performed. Actual public definition/runtime signature checks are supervisor-owned.

Phases2-5 must form a coherent user-visible protection unit before claiming D route preservation. Phase1 alone is safe preparation only. Downstream source needs no new URL/DOM classifier for this contract. Stronger semantic proof, if an actual fixture shows missing host observation, belongs in a separate domain evidence adapter contract; do not invent a generic host `waypointSatisfied` boolean or claim current display words authenticate it.

## Mandatory fail-first fixtures and narrow validation

| Trigger | Required assertion |
| --- | --- |
| Named three-waypoint route, standalone middle fulfilling/support removal without moving start | Selected protection detects structural loss; completion cannot call the route complete. Original stable relation/order retained or truthful missing coverage reported at the chosen enforcement surface. First-step-only fixture insufficient. |
| Reader rejected, unsuccessful/non-complete, omitted route, malformed order, ungrounded quote or stale instruction digest | Unavailable remains distinct from open; no proposed arrival shortcut executes. Unrelated detour edit still applies. One attempted shared read and no automatic retry. |
| Grounded quotes with duplicate labels, repeated occurrences or indirectly stated sequence | IDs/source occurrence are deterministic or ambiguous-unavailable; lexical label equality is not proof of order or membership. Judge still sees interpreted order and actual evidence. |
| Related shortcut/drop plus unrelated drop in one sequential decision | Withhold only relation-identified group; unrelated edit applies and counts accurately. Renumbered later references and held settlement preserve stable identities. |
| Explicit open reading, declared deeper arrival with opaque relative destination | Valid shortcut accepted under original replay/permission gates. Non-arrival node containing an address never becomes arrival. No Core URL regex. |
| One waypoint requiring multiple setting/opener steps | Claims coexist; removing a required supporting step is detected. Existing single-owner `acts` behavior unchanged. |
| Retarget/settings/bind/repeat change; checked/written/carried candidate; historical lasting execution | Current route evidence invalidated; original proof never borrowed; no automatic fresh action or second lasting mutation. Candidate claim alone cannot make full-test/judge evidence performed. |
| Concurrent permission derive and route read; subsequent peek/read; failed promise; no-sensitive-edit path | Exactly one authority call under the existing purse, successful usage counted once, failure usage honestly bounded, no second call, unread path zero authority calls. Existing permission prompts/default budgets preserved. |
| Model fabricates a waypoint as satisfied, supplies proof fields in emitted plan, or restores old saved intent | Reject/strip untrusted proof; scheduled/current intention remains separate from actual execution and tested graph. |
| Accepted saved Flow run/judge and unchanged replay | Grounded ordering and actual route evidence survive legitimate persistence; exact D task oracles and final whole-Flow judge, not relation claims alone, determine acceptance. |

Future test commands must name only changed owner tests and actual service fixture through the heavy wrapper, followed by supervisor-observed package types/structure/fresh public build and downstream affected checks after all sources freeze. No full suite or paid run occurred here. Existing daily full-suite limit and Lab-only .10/48 remain unchanged.

## Remaining acceptance and handoff

New typed ordered route reading and draft intention/provenance are necessary; current APIs do not provide them. Existing declared arrival, current proof separation, instruction grounding, permission authority/purse, stable draft IDs, sequential amendments and whole-Flow judgment are reusable. Final persisted projection and semantic judge support have not been read in this bounded unit and are explicit phase5 preflight dependencies, not already verified facts.

D repeat/list-before-action/per-row/filter/post-action-read and final exact four-record oracles remain separate MVP prerequisites. Before live D, root must independently verify these structural/intention regressions, actual scripted service behavior, saved definition/provenance and linked gates. Then live execution must preserve the requested route, act once on each qualifying row, leave excluded rows untouched, verify final exact records, and demonstrate unchanged provider-free reuse. This report closes design ambiguity only; it does not close D or authorize implementation/live.
