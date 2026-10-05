# D shared instruction reader preflight

## Current State

Read-only phase1 preflight complete during A8/B7 source/runtime freeze. Initial current owners and nearest existing instructed tests inspected, plus approved gate memo/failure and creation-purse reading/admission contexts. Only this report changed. No source/test/build/types/audit/runtime/provider/state/key/shared-document/git actions. Source implementation remains unreleased; proposed commands below were NOT RUN. This unit prepares one shared grounded reading, not D route enforcement or live acceptance.

## Confirmed current interfaces

`AUTOMATION_STUDIO_INSTRUCTED_CONSEQUENCES_SCHEMA` is a public consequence-only completion schema requiring `instructed`. Preserve it for compatibility; add a separate combined authority schema for the one internal reader. Its parser and stored consequence types remain independent of route validity.

`automationStudioFlowBootstrapInstructionAuthority` currently returns `{ derive, usage }`; `derive` makes a new harness call each time. Its public type is exported by `service/index.ts`. The sole production caller discovered is the narrow runtime service construction/permission forwarding site. Existing `action-permissions/tests/instructed.test.ts` checks the permission gate reads once, but no nearest `service/tests/instruction-authority.test.ts` exists in this checkout. That new owner is required for concurrency/combined-reading proof.

Current quote grounding ignores case, canonicalizes typographic quotes/whitespace and trailing sentence punctuation; permission quotes stay 3–300 characters, first grounded source/first consequence wins. Digest is SHA256 UTF8 of `title + newline + body`. Route grounding must not reinterpret that permission behavior, use the permission quote limit for an entire route, or manufacture raw-text offsets from normalized matches.

## Memo and failure contract

The current authority itself has no memo; each direct `derive()` sends another harness question. `gate.ts` owns a cached derivation promise instead. It assigns that promise before awaiting, and converts a rejection into an internal failed outcome. A rejected derive leaves `gate.instructed` UNKNOWN and permits the ordinary permission question; it does not store an empty successful derivation. A returned unsuccessful/non-complete harness answer currently resolves `derive()` to an empty array. These two cases are distinct compatibility requirements.

Move the shared promise into `instruction-authority.ts`. The existing `derive` signature and the same mutable `usage` object remain. Add an additive `route.read()` and `route.peek()` interface. `peek()` is synchronous and never sends; before demand it returns `unread`. First demand by either consumer initializes one promise before awaiting. Concurrent route and permission demand, repeated reads and rejected reads use that promise permanently for this authority instance. A fresh build constructs a fresh authority; there is no automatic retry or cross-build cache.

The shared promise resolves separate instructed and route results after a returned harness answer. A successful complete answer can preserve valid consequence claims while making an invalid/missing route unavailable. A thrown harness error remains a rejection for `derive()`; `route.read()` projects that same cached rejection into closed `unavailable/transport` without exposing the error or changing the promise. Therefore the gate retains its existing UNKNOWN-on-rejection behavior. Returned `!ok` or non-completion keeps the legacy empty consequence derivation and separately returns unavailable route evidence. No catch may turn genuine rejection into successful `instructed: []` for both consumers.

Current `creation-purse.ts` wraps this exact reader with `creation.reading(runHarness)`, records phase `read`, and retains typed cost/call refusal only for a matching diagnostic with `providerInvocation: not_attempted`. Its subsequent permission port and `endIfReadingRefused` retain that typed budget ending. Sharing the read must neither replace this wrapper nor create an independent purse. The new route projection must not consume or hide reading-refused authority.

## Accounting limits

After a returned answer, current authority `usage.calls` increments once even when the answer says provider invocation was not attempted. It is a legacy returned-question counter in that case, despite its current provider-call comment. Token/cost fields add only supplied answer usage. If `input.run` throws, these increments are not reached. Mutable zero fields after a thrown call are consequently not measured proof of zero dispatch or zero paid usage.

The actual scoped creation purse remains the settled provider-call admission authority. Phase1 should preserve existing accounting semantics rather than silently change a published denominator. Cache each returned answer's additions exactly once; no additions on cache hits, no second read charge, no inferred zero after a throw, no synthetic cost or harness-question-as-network observation. Tests must distinguish a returned unsent refusal (one legacy question, no actual provider dispatch) from a thrown/pending answer (unknown response usage). Any later correction of that legacy returned-question count needs its own producer/consumer brief. It is not required to safely share the current read.

## Concrete phase1 contract

Preserve the existing exported consequence-only schema and stored consequence type/parser. Add a separate combined completion schema for this internal authority: required `instructed` reuses the existing consequence property definition; required `route` is a closed discriminated object. Suggested model shape is `open`, or `named` with a grounded enclosing source quote and an ordered nonempty list of waypoint quotes, or `unavailable` with a closed interpretation reason. Every quoted source names an active instruction ID. The model never supplies Core digests, route/waypoint IDs, offsets, execution proof, or permission grants.

For phase1, a named ordered route must have one enclosing quote in one explicitly identified active instruction, and all waypoint quotes must be located unambiguously inside that enclosing quote. This anchors ordering words without assuming physical source order is intended travel order. Cross-instruction ordering without one grounding source is unavailable/ambiguous in this first bounded schema, rather than guessed. The model's waypoint array expresses interpreted order; Core validates its grounding, not semantic performance. If supporting multiple grounding sources becomes an actual acceptance requirement, release that schema extension explicitly before claiming support.

Internal state is `unread`, `open`, `named`, or `unavailable`. Open/named bind to the active instruction-set version; named includes Core-generated route and waypoint IDs, instruction ID/digest, quote, declared ordinal and source span. Unavailable reasons are closed (`transport`, `non_complete`, `malformed`, `ungrounded`, `ambiguous`, `stale`); no provider message or model prose. Missing route, unsuccessful answer, non-completion, malformed order, unknown source ID, duplicate ambiguous occurrence and ungrounded quotes become unavailable. Only successful explicit well-formed open becomes open. Open remains interpreted intent, not proof that the user's instructions contain no route.

Generate source spans over the original `title + "\n" + body` text with explicitly documented UTF-16 code-unit, half-open offsets. Extract the existing comparison normalization through a focused helper, preserving its exact output for permission parsing. A separate mapped-normalization helper retains the original source interval for each normalized unit, including whitespace runs, typographic quotes and lowercasing expansions; it must reproduce the comparison helper's text. Match the enclosing quote uniquely in its declared source, then each waypoint uniquely within that span. Convert through that mapping; never use normalized indices as raw offsets. Repeated ambiguous matches are unavailable. Tests must cover surrogate pairs, curly quotes, whitespace collapse and case normalization. Permission parsing keeps its original first-match policy and 3–300 bound. Route quotes are not silently truncated to that bound; any transport/context limit produces unavailable instead of fabricated short evidence.

Stable IDs should hash canonical validated instruction versions plus the enclosing span and ordered grounded waypoint identities; do not rely on array position alone across revisions. This phase produces grounded intent only. It does not add step relations, invalidate execution proofs, enforce edits, satisfy a waypoint, or persist a route. The new authority route field has no production enforcement consumer in phase1. A later consumer must check its instruction-set version before use; stale evidence cannot become open or trigger an automatic reread.

## Smallest source partition for a later written release

All paths below are relative to Core `packages/fluxiq/src/programs/automation-studio/runtime/` unless stated otherwise. New directories each require their owning barrel; one exported declaration per focused owner.

| Owner | Bounded change |
| --- | --- |
| `action-permissions/instruction-quote/comparable.ts`, `mapped.ts`, `index.ts`, nearest tests | Extract existing normalization unchanged; add faithful original-span mapping, tested against the comparison output. |
| `action-permissions/instructed.ts` | Import the owning normalization barrel only. Preserve consequence schema, stored contract and parser decisions. |
| `action-permissions/instruction-route/reading.ts`, `schema.ts`, `read.ts`, `index.ts`, nearest tests | Closed intent types, route-only model schema, grounded parser/span/ID generation. No draft/execution/URL dependency. |
| `action-permissions/instruction-reading/schema.ts`, `index.ts`, nearest schema test | Combined internal completion schema reusing the exported consequence shape plus route schema. Do not replace the public consequence-only schema. |
| `action-permissions/index.ts` | Export focused new owning seams; preserve existing exports. |
| `service/instruction-authority.ts` | One shared lazy promise, combined completion schema, independent projections and additive route interface; existing provider and usage accounting. |
| New `service/tests/instruction-authority.test.ts` | Actual authority/gate/harness with scripted fake provider and the real creation purse admission wrapper. No mirrored fake accounting helper. |

`gate.ts`, `creation-purse.ts`, `service.ts` and the existing instructed/gate/creation-purse tests are compatibility owners to run, not anticipated source edits. The current production service already forwards `creation.reading(runHarness)` and `authority.derive`; adding the unused route interface requires no service rewiring. If actual fixture construction needs another existing support export or route consumption in that service, name/request the exact owner before editing. No harness, budget default, provider role, retry policy, model restriction or normal UI setting is released by this plan.

## Meaningful fail-first cases and later validation

1. Capture the real authority completion request: it asks for both consequence claims and explicit route classification in one existing read-phase question. The old exported schema remains consequence-only. Omitted route becomes unavailable, not open; valid grounded consequence permissions survive missing/malformed route.
2. Named ordered source, explicit open, malformed order, missing/unknown instruction ID, ungrounded quote, ambiguous repeated enclosing/waypoint quote and stale instruction version. Named carries grounded original spans and deterministic IDs, with no performed/effect proof. Long route quote exceeding 300 remains truthful; permission quote rules stay unchanged.
3. Coordinate pending actual fake-provider transport, then concurrently demand permission through the real gate and `route.read()`. Observe one dispatch, one existing purse settlement and one usage addition. Repeated `derive/read/peek` makes no second dispatch. Unused `peek` and a no-consequence gate path do not send.
4. Throw from the actual scripted transport: original derive rejects, real gate stays UNKNOWN and follows normal permission prompting; route returns unavailable and no repeat read. Do not label unchanged legacy usage zeros as measured network zeros. Preserve the original error privately and expose only the closed route reason.
5. Return actual scoped purse refusal before dispatch: zero fake-provider invocations, cached unavailable route, legacy returned-question usage exactly once. Ordinary permission port still ends with the original typed call/cost refusal, not a human question or a new route refusal. Use a tiny explicit test cap, not a new default.
6. Returned non-complete/failed answer preserves existing empty consequence fallback; paid returned usage is retained once. Neither invalid route nor successful permissions changes the other projection's status. Existing instructed normalization/stored-digest and gate ASK/granted behaviors remain unchanged.

Future narrow command: run the new nearest quote/route/schema/authority owners plus `action-permissions/tests/instructed.test.ts`, `action-permissions/tests/gate.test.ts` and `service/flow-bootstrap-commands/tests/creation-purse.test.ts` through the existing t262 heavy wrapper. Exact new test filenames must be pinned in the implementation brief after choosing the focused exports. Commands were NOT RUN in this preflight. Supervisor independently runs package types/audit/build after source freeze; no full suite required here.

## Remaining release decisions and acceptance boundary

Approve the concrete combined schema and single enclosing-source grounding scope before implementation; the prior full D design's original source spans are retained through explicit mapped normalization, not deferred or approximated. Approve the new test owner (currently absent) and its exact existing support imports after bounded discovery. The accounting mismatch above is disclosed and preserved, not claimed fixed.

Phase1 can safely prepare grounded named/open/unavailable intent with shared admission/accounting. It cannot protect an isolated intermediate drop, distinguish a model claim from actual waypoint satisfaction, link related companions, or qualify a whole-Flow route verdict. Those remain phases2–5 in `d-grounded-waypoint-contract.md`. No live retry or D acceptance follows from this report.
