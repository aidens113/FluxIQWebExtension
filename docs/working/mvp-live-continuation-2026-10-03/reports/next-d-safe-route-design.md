# Next D safe route design — worker report

## Current State

Read-only bounded design complete during the live source freeze. Initial eight exact old D source/test owners plus the supervisor-released three current seam owners inspected; the prior 29-file inventory is context, not an import authorization. No source edit, test, build, provider/process operation or runtime/store/profile access. Only this report changed.

The old route patch is insufficient for full named-itinerary preservation. It confuses unknown/failing readings with a successful open-route reading, deliberately permits isolated intermediate travel drops, and withholds unrelated companion withdrawals. These are source-confirmed paths; none was executed during this investigation. The released expansion confirms a public declared arrival seam that eliminates the need for Core URL scanning, but no public waypoint-to-step relation. A safely separable eight-file instruction-reading unit is named below; it is preparation, not route protection or full D implementation.

## Eight critical old D reads

Old Core: `C:/Users/osrs_/FluxStuff/fxwork/t195/!FluxIQ`; runtime root `R = packages/fluxiq/src/programs/automation-studio/runtime/`.

```text
R/action-permissions/instruction-route.ts
R/service/instruction-authority.ts
R/llm/evidence-loop/rerun-request.ts
R/llm/decision-handlers/amendment.ts
R/tests/service-authoring/tests/route-named-build.test.ts
R/llm/evidence-loop/tests/rerun-request.test.ts
R/service/tests/instruction-authority.test.ts
R/action-permissions/tests/instruction-route.test.ts
```

## Confirmed safety causes

1. `decision-handlers/amendment.ts` asks for the route only when `open.movesStart` is set. `routeOf` catches reader rejection and returns undefined; caller then uses the unconstrained `open` amendment result. No retry, honest unknown state or protected candidate remains.
2. `service/instruction-authority.ts` memoizes one promise, but returns `{instructed:[],route:undefined}` if answer is unsuccessful or has no complete decision. That is indistinguishable from a validated open route. Rejected calls stay memoized. Usage increments after an answer returns; thrown transport calls do not reach that increment. The existing charging/harness contract requires care; do not invent cost for an unobserved usage record.
3. `instruction-route.ts` returns undefined for absent route, non-string route, length failure, ungrounded quote and unreadable result. Existing tests pin those cases to the same value. Literal quote grounding validates quoted text, not route completeness or absence.
4. `rerun-request.ts` detects start movement only from first-step address changes/drop/reorder or placing another step before it. Its existing test explicitly accepts dropping the later Friend requests step alone even with the named route. That is a genuine route-preservation gap, not an absent test only.
5. On a refused shortcut, the `TAKES_OUT` pass withholds every drop/exploratory amendment in that decision, including unrelated detours. It has no evidence identifying which drops are route companions.
6. `startStep` scans arbitrary nested input strings for an address using URL-shaped regex/depth/value limits. An extraction filter, typed text or unrelated attachment address can identify a non-navigation action as the start. Conversely relative destinations or deeply nested arguments can evade the gate. Generic Core should use declared arrival/action contract metadata rather than interpret URL/DOM semantics.
7. Old real-service fixtures prove only named first-step shortcut refused, open route shortcut applied, and unchanged-start build never reading. They stop on a scripted provider transport failure and do not establish a completed correct Flow, playback or reuse. Their synthetic `.25` provider ceiling is test data, not a current Lab/UI policy.

## Required semantics before implementation

Use a discriminated cached route result: unread, named (grounded quote/id/digest), open (successful explicit classification), or unavailable (failed/malformed/ungrounded/inactive). A failed/malformed reading must never become proof that a shortcut is permitted. Share the existing instruction reader/provider call and accounting; do not add an automatic second reading. A provider's well-formed open classification remains an interpretation, not a deterministic proof of absent intent; whole-Flow judgement remains necessary.

For unavailable route evidence, preserve the proposed shortcut's original start/configuration and the specifically dependent companion edits; surface a recoverable honest reading issue. Continue unrelated edits and ordinary explicit tool calls under the existing permission policy. Avoid blanket refusal of all editing or creating a new execution restriction.

Distinguish two contracts: protecting the Flow's declared arrival/start versus preserving every explicit named waypoint. The first can use the public domain-declared `runsNodes.arrival {node,parameter}` seam shown in old service tests, subject to current-owner confirmation. It cannot prove which intermediate clicks correspond to route words. Do not claim that first-step protection solves isolated route-step drops.

Complete named-route preservation needs explicit, grounded relation between instruction waypoint identity and draft step identity, with provenance and order. A plain route quote plus URL scan provides no such relation. Core may carry generic opaque obligations/step relations; downstream owns browser/navigation/DOM/target identity and any authenticated host evidence. Do not infer Friends/menu/URL meaning inside Core or identify travel by all drops in one decision. If relation is absent, whole-Flow test/judge must report the missing route rather than source claiming it preserved it.

Valid shorter starts remain permitted when the instruction leaves travel open and the current declared arrival can reach the work under the existing replay/permission contract. Preserve optional dismissal steps when needed, actual opener dependencies, lasting effects and per-row bindings. A new constraint on model calls is not a substitute for truthful route evidence.

## Mandatory failed-before regression designs

All scripted/provider-free tests, only after source freeze release:

- Failed read: same real-service named instruction and three-step HOME→Friends→requests fixture; provider rejects the single authority call. Model proposes first-step deep-address replacement with dependent travel withdrawals. Assert no deep navigation and original route retained, recoverable unavailable feedback, one attempted shared read, unrelated edits still applied. Repeat for `ok:false`, noncomplete and malformed/ungrounded route. Never turn unavailable into open.
- Intermediate bypass: named instruction, successful grounded read, standalone drop of Friends or requests in a later decision without start movement. Assert the intended selected enforcement surface actually detects loss—route-obligation-preserving edit feedback if relations exist, or whole-Flow judge rejects missing named waypoint. A test that only checks first-step refusal does not cover this trigger. Old rerun-request currently explicitly permits the drop.
- Companion breadth: refused start shortcut plus drop of a positively identified route companion and drop of an unrelated successful optional detour. Assert only actual route-dependent edits withheld; unrelated withdrawal applies. Repeat with same label/two controls to ensure no domain label heuristic.
- Open-route control: successful explicit open result, stable declared deeper arrival and travel shortcut. Assert shorter start accepted; same ordinary permissions and replay test. No added reader call on builds that never request a route-sensitive modification.
- Host boundary: non-navigation action containing an absolute URL must not become the arrival; declared arrival with relative destination must be handled by domain contract without Core URL parsing. Large argument shapes must not introduce arbitrary evidence limits.
- Shared reading: concurrent consequence derive/route requests share one provider promise/usage count; failures stay remembered without automatic retry; known cached outcome is shown without reading again; inactive/digest mismatch never grants route authority.
- Compatibility: candidate original execution proof/lasting guard remains independent, stale marks invalidate normally, rerun merge/binding/write semantics preserved, toggles/optional openers unchanged. Route claims never count as performed effects.

## Partition readiness

Existing 29-file inventory includes required closed refusal consumers and context propagation, but that set remains an unvalidated old implementation. It does not contain a truthful intermediate-route relation. Copying it would import known unsafe behavior.

Expansion authorized and read: current Core `R/llm/loop-configuration.ts`, `R/llm/harness-options/binding.ts`, and downstream `domain/src/runtime/llm-evidence/tools.ts`. Exact conclusions and safe-unit partition follow. The route-step relation/enforcement choice still must be named before an executable complete-route brief is issued.

No implementation/file release or paid D run is justified by this preparation alone. D repeat/list-order/per-row/filter/post-action-read blockers remain separate prerequisites; no evidence here closes them.

## Confirmed public seam and ownership

`AutomationStudioLlmEvidenceRuntimeBinding` in Core `llm/harness-options/binding.ts` already declares `runsNodes.arrival?: {node:string, parameter:string}`. It states that Core never reads the location; it writes the opaque domain location into the domain-declared parameter. The registry constructs an arrival only for a build with `startLocation`; repairs/continuations carrying a draft open with a look rather than performing another arrival. The contract does not identify intermediate waypoints or say a click satisfies quoted route intent. `describeCall` is expressly display-only, not authority for behavior.

Downstream `tools.ts` selects `arrivalNode` from its own runnable node catalog by `actionType === WEB_NAVIGATION_ACTION` (line274) and exports it as `{node:arrivalNode, parameter:"url"}` (line415). This is the correct owner of web navigation semantics. Core can compare declared node IDs and the one opaque declared parameter without URL regex or scanning arbitrary values. No downstream source change is required to reuse this existing arrival declaration.

Current `llm/loop-configuration.ts` has no arrival/route-authority/waypoint-relation input. It does have generic completion checks over draft steps, declared words for display, node lookup, seeded drafts, lasting-act memoization and test observation. A future route amendment feature needs explicit service-to-loop propagation of the existing arrival declaration. It must preserve seeded-draft behavior and avoid secretly arriving again during repair. Merely adding the declaration does not map Friends or requests clicks to their instruction waypoints.

Core owns grounded active instruction text/digest, cached reader states, generic step/obligation IDs, declared arrival identity forwarding, amendment bookkeeping and truthful completion evidence. Downstream owns the meaning of addresses, navigation actions, links/menus/DOM controls, target resolution, stable identity and browser execution. Core must not infer waypoint membership from URL strings, labels, whole-page digests or the fact that an amendment appeared beside a shortcut. A digest proves a state identity, not semantic route intent.

## Smallest marked-safe executable preparation unit

One serialized Core unit, eight exact files under `R`; implementation still requires a new supervisor release after live ends:

```text
action-permissions/instruction-quote.ts                    new shared quote grounding
action-permissions/instruction-route.ts                    new discriminated route-reading result
action-permissions/instructed.ts                           same-read route schema, preserve consequence parsing
action-permissions/index.ts                                public export
action-permissions/tests/instruction-route.test.ts          named/open/unavailable/digest cases
action-permissions/tests/instructed.test.ts                 existing permission/quote compatibility
service/instruction-authority.ts                           one memoized reading, truthful known outcome
service/tests/instruction-authority.test.ts                 concurrency/failure/usage sharing
```

Scope: publish an explicitly distinguishable named/open/unavailable result from the existing single instruction authority reading. Keep unread distinct on the non-reading accessor. Require an explicit well-formed open classification instead of treating missing optional route or invalid response as open. Preserve existing consequence derivation and permission fallback, with legacy/malformed route data treated as unavailable for route authority. Rejected reads stay memoized and do not generate another provider request. Grounded quote remains active id/digest bound; model classification is not authenticated action identity.

This unit does not introduce route amendment refusals, offer a shorter-start optimization, change entry/provider-note promises or touch the loop/closed refusal consumers. It can be tested and integrated independently without shipping the three known unsafe old gates, but is not a user-visible claim that D's itinerary is preserved. Do not implement it alone under the present brief or represent it as D completion.

Owning future command, through heavy wrapper from paired Core cwd (not run):

```text
pnpm --filter fluxiq exec vitest run src/programs/automation-studio/runtime/action-permissions/tests/instruction-route.test.ts src/programs/automation-studio/runtime/action-permissions/tests/instructed.test.ts src/programs/automation-studio/runtime/action-permissions/tests/gate.test.ts src/programs/automation-studio/runtime/service/tests/instruction-authority.test.ts
```

`gate.test.ts` is a read/run compatibility owner, no edit proposed. The new files/tests do not yet exist in current t262; this is a proposed executable partition, not a test result. Supervisor then runs package type check and structure audit. Existing create-purse accounting must count the one successful shared reading exactly once; unknown transport usage must remain honestly unknown instead of manufactured values. No Lab/UI ceiling change.

## Pending complete route unit — no implementation release

Complete route protection requires a separate written contract decision before naming final files. Define how grounded ordered waypoint obligations acquire a relation to actual draft step IDs, including provisional/written/checked evidence and retarget invalidation. Define authority for this relation (model intention versus host-confirmed effect); no model claim alone can become performed route proof. Existing Core arrival declaration is enough for start identity only. There is no confirmed public relation from the inspected contracts that makes selective intermediate protection safe.

After that decision, the known route integration family is the existing inventory's route-only hunks in service/loop configuration, rerun request/handler, entry/context/task/catalog/provider notes, closed refusal feedback/allowlists/activity, and real-service fixtures. The inventory's 29 files are not the minimal safe full unit yet: additional focused obligation owner/tests may be needed, and its generic URL scan/broad companion pass must be removed. Any expanded files require exact supervisor release. Preserve current checked candidates, historical guards, cancellation rendering, unrepeat, numbering, stale marks, permission and row-loop behavior; do not copy the dirty mixed D files wholesale.

Required acceptance of that later unit: actual failed-read trigger leaves original route intact while unrelated edits proceed; standalone intermediate drop is detected at the chosen honest enforcement surface; mixed companions selectively preserve only route obligations; explicit open route allows valid shorter starts; unchanged unrelated/read-only builds add no reading; whole-Flow judge sees actual route evidence and remains final correctness authority. Current scripted old tests do not prove these. Subsequent live D route/list/action/filtered-row/post-read/reuse verification is still required after the independent D prerequisites are fixed.

Unproven: no complete ordered waypoint schema or host relation has been selected; provider ability to classify an omitted route as open cannot be inferred from literal quote grounding; selective route companion identity cannot be obtained from `arrival` alone; performance/cost benefit is unmeasured. No further discovery is necessary for the marked preparation partition; full-route design needs that explicit contract decision rather than more indiscriminate source reads.
