# Next D named-route integration brief

Status: Complete (read-only partition; implementation and validation not authorized by this brief)
Date: 2026-10-03
Worker: resume-cd
Task: t262
Sources: frozen t262 Core checkpoint 9f756676 and dirty t195 Core w49/w50 source; downstream checkpoint 326ad350.

## Current State

D's route runtime exists in dirty t195 source. It is not integrated in t262, and no w50 completion/validation report was found. Earlier w49's 'tasks3/4 blocked' conclusion is obsolete against source, while w49's reported1140 passing tests predates the newer runtime and cannot certify it. This worker read source/test diffs only while live A runs; no source, environment, runtime, provider, build or validation operation was performed.

The smallest coherent unit is a Core-only shared instruction reader plus first-step-shortcut preservation, prompt/context propagation and scripted service proof. It does not need D's repeat grammar, repeated-run guard, changed-round judgement or stable rerun numbering to work. Do not copy any mixed old file wholesale.

## Intended contract

- If active user instructions quote a route ('go to the home page, open Friends, then Friend requests'), preserve that route when a proposed direct-address shortcut would replace it. Instruction reading must screen its quote against active instruction text and digest.
- If the instruction leaves route open, permit the existing rerun/companion travel-drop decision to start at the stable deeper address, subject to existing replay and permission contracts.
- Reuse one memoized provider reading for both instructed consequences and route. Read lazily only for a candidate shortcut/start movement or ordinary permission derivation; an unchanged-start read-only build adds no reading call. Keep calls/tokens/spend counted by the existing creation-purse seam. No budget/default change.
- Once the route is known, show it in the start note and authored-draft instruction instead of offering a shortcut. Before reading, keep a single sentence containing shortcut and user-route caveat.
- A refused shortcut and its companion dropped travel steps must be withheld before apply; return quoted `route_named` feedback through the existing refusal/history/activity paths. Whole-Flow judge still decides final correctness.

## Proposed exact Core ownership partition

`R = packages/fluxiq/src/programs/automation-studio/runtime/`. One serial worker owns this coherent unit; supervisor keeps authored architecture/shared working docs and integration checks.

```text
R/action-permissions/instruction-quote.ts                 new shared quote screening helper
R/action-permissions/instruction-route.ts                 new route parse/digest grounding
R/action-permissions/instructed.ts                        schema route field; reuse quote helper
R/action-permissions/index.ts                             public barrel
R/action-permissions/tests/instruction-route.test.ts       new grounded/missing/invalid quote tests
R/service/instruction-authority.ts                        memoized shared reading, route/routeRead
R/service/tests/instruction-authority.test.ts              new one-call sharing tests
R/flow-draft/amendment.ts                                 only route_named refusal union + route field
R/flow-draft/entry.ts                                     route-aware authored instruction only
R/flow-draft/tests/entry.test.ts                           preserve current cancellation plus route words
R/llm/evidence-loop/rerun-request.ts                       route/start-movement and withholding only
R/llm/evidence-loop/tests/rerun-request.test.ts             add route cases, retain existing rerun behavior
R/llm/decision-handlers/amendment.ts                       async lazy reading; filter withheld amendments
R/llm/evidence-loop.ts                                    await handler; known route in shown draft
R/llm/loop-configuration.ts                               optional instructionRoute known/read seam
R/llm/decision-context/shown.ts                            pass optional route into draft entry
R/llm/harness/task-request.ts                             flowBootstrap.startRoute field
R/llm/harness/context-packet.ts                           forward startRoute into catalog builder
R/flow-bootstrap/plan/catalog.ts                          accept + preserve startRoute
R/flow-bootstrap/plan/contracts.ts                        context startRoute type
R/llm/deepseek/request-body.ts                            route-aware start note on both paths
R/llm/deepseek/tests/request-body.test.ts                  caveat/known-route provider note tests
R/llm/draft-amendment-feedback.ts                         route_named reason words only
R/llm/tests/draft-amendment-feedback.test.ts               quoted route and companion refusal tests
R/flow-bootstrap/evidence-loop-steps.ts                    route_named allowlist
R/activity/wording/draft-edit-refused.ts                   route_named human words
R/activity/wording/tests/reasons.test.ts                   refusal text pin only
R/service.ts                                             authority read/known seams at creation call
R/tests/service-authoring/tests/route-named-build.test.ts   new real-service scripted cases
```

Total29 source/test files across one inseparable contract. Keep generic route/consequence semantics in Core; no downstream/browser file is needed. No action dispatch, no model budget file, no bootstrap instructed-acts claim feedback, no toggle/reversal definition or stable handles file belongs to this partition.

Important discovery: `flow-bootstrap/plan/catalog.ts` and `contracts.ts` are mandatory. Task/harness packet feeds the catalog builder before provider note rendering; leaving either out loses startRoute or fails types. First inventory's route group did not name them. `decision-handlers/types.ts` is not required for old w50's optional seam because handler context already carries loop input; change handler return to Promise and await at its one loop call site.

## Integration conflicts against frozen t262

- **flow-draft/entry.ts** was modified by t262 to render cancel pairs and evidence-only replay observations. t195's file mixes route wording with `always`, once-per-decision numbering, `replacedBy`, and receipt display. Only add optional route input and route/caveat sentence to t262's current authored text. Preserve its cancellation rendering and tests. Do not adopt unsupported `always` or replacedBy vocabulary in this unit.
- **flow-draft/amendment.ts** now invalidates stale test marks in t262. Add only new refusal member/quote field. Do not port t195's numbering/refusal/repeat overhaul. Its current588 lines have room; no module reshuffle needed for this route-only contract.
- **llm/evidence-loop.ts** is exactly800 lines in frozen t262 and contains new toggle/call-record logic. The known-route property and async await can be line-neutral additions to existing statements. Do not overwrite older t195 loop (repeat guard changes, different signature, no current toggle integration). If readability requires extra lines, extract a focused owned helper with explicit supervisor release instead of trimming important behavior to satisfy a line budget.
- **rerun-request.ts** t195 adds both route and replacedBy lookup; port only route-specific logic. Its reused `automationStudioFlowDraftStepIsProposed` exists already in t262; replacing-step constants/helpers are D numbering dependencies and unnecessary here. Keep RFC7386 input patching and existing rerun/write/binding refusal semantics.
- **amendment handler** t195's async change and filter-withheld logic are distinct from C w85 kept-key feedback and A/B act-history alterations. t262 currently retains original handler, so route-only port is narrow. Future C kept-key settle must merge into this async owner rather than replacing it.
- **service/instruction-authority.ts / service.ts** are generic gateway/permission ownership. Memoize all instruction read attempts once and count usage once; do not add a second route reader or eagerly read every read-only build. Preserve creation.reading(runHarness), permission derive, existing lastingActs memoization, t261 .10 test-scope ceilings and ordinary UI policies.
- **request-body and authored draft words** old t195 offers direct-address optimization with route caveat; t262 currently offers no general shortcut. If introducing shortcut words as part of route preservation, retain exact stable-address/optional-dismissal semantics and add both known/open route tests. Changing prose alone never proves routing preserved.
- **closed refusal union** must synchronously update all Record/allowlist consumers listed above; D `repeat_taken_off` is unrelated and must not leak in as an unsupported enum member.

## Unresolved safety/correctness limits in old w50

1. **Reading failure silently permits shortcut.** handler routeOf catches rejection and returns undefined, indistinguishable from proven no-route. This is weaker than explicit user-route preservation. Decide intended failure behavior before acceptance; add scripted failed-reading test, maintain original draft, and surface a recoverable honest reason instead of silently treating failed reading as open route. Do not improvise a second provider retry/call here.
2. **Standalone intermediate travel erasure escapes gate.** movesStart triggers first-step rerun/address change, first-step drop/reorder, or placing another step before it. A separate decision dropping only Friends or Friend requests leaves first step unchanged, so no reading/refusal occurs. Existing tests prove companion drops with a shortcut, not all route steps. Add a regression before claiming full itinerary preservation. Distinguish a narrow shortcut gate from a complete route-obligation feature; the latter needs mapping route text to explicit kept steps, outside current old w50 seam.
3. **Address scan is heuristic.** startStep finds first proposed step containing any absolute address anywhere in its input; it does not identify a navigation parameter via registry semantics. It scans at most64 string values/depth6. Test non-navigation first steps carrying URLs, oversized argument shapes and relative URLs; no broad page-evidence limits should be added. Prefer a declared navigation/arrival seam if source shows false positives.
4. **Companion-drop gate is broad.** When first-step shortcut is refused, all drop/exploratory amendments in that decision are withheld, not only identified travel. Test mixed decision dropping an unrelated failed detour/optional item so preserving a route does not prevent legitimate repair.
5. **Readiness/data failures not yet covered.** An instruction read that returns malformed/ungrounded optional route is treated as no-route. Quotes are grounded text, but grounding does not itself prove route completeness. Whole-Flow judge/test remains required.

These are inspection findings, not reproduced failures. Existing source contains three real-service scripted tests (named route kept; open route shortcut allowed; unchanged start never reads), four route parse/schema tests and three instruction-reader tests. None tests the limits above, and this worker did not execute them.

## Proposed failing-before and narrow verification

Before source edits, port only route-focused regression tests onto t262; expected new route functions/context fields/refusals must fail there. Keep fixtures scripted/provider-free. Then add source hunks in the contract order above. Mandatory new cases beyond old tests: concurrent derive/route calls make one provider call; failed reading does not silently erase route; unrelated non-route change does not force a read; mixed companion-drop behavior; cancellation/stale-test preservation.

From Core packages/fluxiq, run a union of exact owner files/directories after source freeze:

```powershell
pnpm.cmd exec vitest run src/programs/automation-studio/runtime/action-permissions src/programs/automation-studio/runtime/service/tests/instruction-authority.test.ts src/programs/automation-studio/runtime/tests/service-authoring/tests/route-named-build.test.ts src/programs/automation-studio/runtime/flow-draft/tests/entry.test.ts src/programs/automation-studio/runtime/flow-draft/tests/amendment.test.ts src/programs/automation-studio/runtime/flow-draft/tests/dry-run.test.ts src/programs/automation-studio/runtime/flow-draft/tests/reversal.test.ts src/programs/automation-studio/runtime/llm/evidence-loop/tests/rerun-request.test.ts src/programs/automation-studio/runtime/llm/evidence-loop/tests/held-amendments.test.ts src/programs/automation-studio/runtime/llm/tests/draft-amendment-feedback.test.ts src/programs/automation-studio/runtime/llm/deepseek/tests/request-body.test.ts src/programs/automation-studio/runtime/activity/wording/tests/reasons.test.ts src/programs/automation-studio/runtime/tests/deepseek-bootstrap
```

Use heavy wrapper. Core fluxiq package check plus structure audit; supervisor rebuild changed Core then downstream affected package checks before next live launch. Do not validate the source while the current live run is active or repeat daily whole-suite sweeps.

After scripted gates pass, live D must demonstrate actual instruction route preserved, loop listing before its row action, each qualifying row acted on exactly once, excluded rows untouched, post-action read exact4 records, latest whole-Flow judge yes, saved Flow provider-free reuse. Route unit alone will not close D repeat/source-order/row-check blockers. Keep them as separately named prerequisites from resume-cd.md before any paid D retry.

## Worker return contract

Changed: this own report only. Checked: read-only current state, t195 route reader/runtime tests, t262 counterpart diffs and exact line counts. Not checked: compilation, tests, live behavior or measured route reading/model cost. No source edit or guard/process/environment/provider operation.
