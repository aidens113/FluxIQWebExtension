> Historical interrupted diagnosis. Superseded by `../../data-first-simplification-plan/reports/t981-repair.md` and the paired execution ledger.

# t981: repaired draft refused at save on repeat validation

## Outcome
Partial. Root cause found for both codes, with evidence. t975 is ruled out. No code changed: the fix needs edits outside the brief's paths (listed below).

## Root causes (all three runs, from each decide step's `core.flow_draft` and the amendment decisions)
Assembly routes only steps still in the Flow (`bootstrap-completion.ts` `fromDraft` filters to `automationStudioFlowDraftStepIsProposed`). `draft-routing.ts` `repeat()` and `repeatWhile()` then refuse a repeat whose `over`/`through` is missing (`repeat_span_unknown`), or whose span holds another routed step (`repeat_body_is_routed`). Path `draft.steps.N` is the step's position.

**Cause 1, repeat_span_unknown: a withdrawal orphans a repeat.** `amendment/apply.ts` applies `drop`/`exploratory` on a step that a kept repeat names as `over`/`through` without checking that repeat again. Repeats are re-checked only after a move (`TakeOffBrokenRepeats` runs only when `movedStep`). The strand check covers only page reach.
- mwp1jqze: 0069 `[27 reorder to 26, 26 repeat over 27]` (shown numbers) gave, from 0071 on, `27 delete.diego repeats through 27, over 26 (rerun.25 listing)`. Decision **0113 `{step 26, exploratory}` applied**. From 0115 to the save, step 26 is `exploratory` and step 27 still says "over step 26". 0176: `repeat_span_unknown at draft.steps.27`.
- mwovqznu (before t975): from 0251, `22 write.nav.post repeats through 25, over 21`. **0320 `{21 drop}` applied** (the listing), and **0326 `{25 drop}` applied** (the span's end). 0471: `repeat_span_unknown at draft.steps.22`.

**Cause 2, repeat_body_is_routed: a repeat written over a span that already holds routing, or routing written inside a span.** `amendment/route.ts` and `repeat-revalidation.ts` check only order (`over_after`, `span_broken`), never whether the body is routed.
- mwp0jueg: 0039 `[7 repeat while 7, 6 repeat while 7]`, both applied: 6's span 6..7 holds 7's repeat. 0041 `{7 repeat over 6}` applied: routing written on a step inside 6's span, over 6, which 6's loop consumes. 0069: `repeat_body_is_routed at draft.steps.6` and `repeat_not_after_its_source at draft.steps.7`.

**t975 ruled out.** No draft in any of the three runs shows `coveredBy`. mwp1jqze has no while-loop, so `closesUnboundedLoop` cannot fire. In mwp0jueg the model dropped step 8 (0033) before the while-loop existed. Attempt 2 of mwp1jqze kept attempt 1's in-memory draft (positions continue), so `draft-from-flow` was not involved either. One gap remains in theory: settle could take out a step that a later repeat names as its `over` check. Worth a guard, but there is no evidence of it.

## Fix (planned, not applied). It refuses the change that breaks the span and never relaxes assembly.
1. New `draft/amendment/repeat-hold.ts`, run in `apply.ts` after the strand check and before reversal and loop-covered settle:
   (a) For each withdrawal still out that a kept repeat (on another step) names as over/through/while: restore its disposition and settings, and refuse with new reason `holds_a_repeat` {step, repeat: shown number of the head}. The way out is "unrepeat <head>" first.
   (b) For each repeat whose kept body holds another routed step that this decision wrote (the head's repeat or the inner routing): take back the routing this decision wrote (the outer head when both were written), and refuse with new reason `span_holds_routing` {step, routed}. Mirror assembly's `effectiveSteps` exception: a repeat over the same `over` merges and is allowed.
   (c) `loop-covered/covering-step.ts`: never cover a step that another kept step's routing names. This is hardening only.
2. `amendment/types.ts`: add the reasons and fields. `bootstrap/evidence-loop-steps.ts`: add both to the allow map.
3. **Outside my paths, and needed:** `llm/draft-amendment-feedback/refusal-reasons.ts` and `fallback.ts` (model words; both maps are exhaustive by type), `ui/activity-action/refusal-words.ts` (card words; exhaustive). Also `llm/evidence-loop/rerun/replacement.ts`: rename routing references to the rerun *before* its internal `drop` of the replaced step. Without that, 1(a) refuses the rerun of a walked listing (the run-muog33va shape) and leaves the old step kept beside its rerun.
4. Tests in `draft/amendment/tests/repeat-hold.test.ts`, one fixture per run, with no page data:
   - mwp1jqze: nav, close.chat, listing L kept, delete D `repeat over L through D`; send `L exploratory`. Expect `holds_a_repeat`, L still kept.
   - mwovqznu: nav W `repeat over G through R`, with G, X, R kept; send `G drop`, then `R drop`.
   - mwp0jueg: listing 6, next_page 7; send `[7 repeat while 7, 6 repeat while 7]`, then `7 repeat over 6`.
   Each also asserts that `routeAutomationStudioFlowDraftSteps` returns no span or body issue. All fail on today's `apply.ts`.

Alternative rejected: taking the broken repeat off (`repeat_taken_off`). Its words blame "this decision's moves", which is false here. It would also have saved mwp1jqze as a single fixed Delete press, a Flow that fails on attempts 3 and 4.

## Commands run and observed results
- Read-only: step logs (decide `request.txt` draft lines, `decision.json`, note meta) through scratch scripts in the session scratchpad. No page text was printed.
- No acceptance run (vitest, tsc, structure audit): nothing changed.

## Not verified
- The fix itself, its tests, and any interaction with `held-amendments.ts` (it reuses `apply`, so it should inherit the hold).

## Open questions
- Widen t981's paths to the four files in step 3, or split the wording and rerun-order edits into a paired brief. The two parts must merge together.
- The decisive amendments are 0113 (mwp1jqze), 0320 and 0326 (mwovqznu), and 0039 and 0041 (mwp0jueg).

Outcome: Partial
Changed: none (report only)
Validation: not run, because no code changed
Not verified: fix and tests not written; out-of-scope wording and rerun-order files are needed
Report: C:/Users/osrs_/FluxStuff/fxwork/t981/!FluxIQWebExtension/docs/working/usable-client-plan/reports/t981-loop-covered-save-refusal.md
Notes: Both codes come from amendments the draft accepted that leave a repeat unassemblable (a withdrawal of its over/through step; routing inside a span). t975 is not involved.
