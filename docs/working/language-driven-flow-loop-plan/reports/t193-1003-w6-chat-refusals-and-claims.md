# t193-1003-w6: chat refusals and claims (C13, C14, D8, D10, D12)

## Outcome

**Partial.** Items 1-4 (C13, C14, D8, D10) are done and validated. Item 5 (D12) is **not done**: both
places that write "Repairing the Flow -- Repairing the Flow live: N of the things you asked are still to
do" are outside my ownership (see Open questions).

## What changed and why

Trees: Core `C:/Users/osrs_/FluxStuff/fxwork/t193/!FluxIQ` (R = `packages/fluxiq/src/programs/automation-studio/runtime`,
U = `packages/fluxiq/src/ui`), downstream `C:/Users/osrs_/FluxStuff/fxwork/t193/!FluxIQWebExtension` (X = `apps/extension/src`).

### 1. C13: refusals are cards under their decision (U, R, X)

- **U `activity-action/refusal-words.ts` (new).** `ACTIVITY_ACTION_REFUSAL_WORDS`: Core's plain words for
  every draft-amendment refusal reason (moved from R's old `draft-edit-refused.ts`) and for each repeat
  outcome (`failed`, `changed_nothing`, `same_result`, `same_answer`). It is exported from `fluxiq/ui`.
- **U `activity-action/refusal.ts` (new).** `activityActionRefusal(record)` reads the loop's refusal codes
  (`llm_evidence_loop.repeat_refused`, `.draft_amendments_refused`, `.draft_amendment_undone`) into
  `{ all, rerun, because }`. It says at most two reasons, joined with "; and", and never a code.
- **U `record.ts`.** It reads a new `Applied: <n>` part, which is how many of an edit's changes landed.
  `Reason:` may now carry comma-joined reasons.
- **U `types.ts` / `action-of.ts`.** `ActivityAction.refused?: { all, because }`.
  - A refused action is `failed` when nothing was done, with `why = because` so an older client still
    says something true.
  - It is `done` when part of an edit landed.
  - A draft card whose refusal was a step asked to run again gets the target "run the step again".
  - `tested` is never computed for a refusal.
- **U `names.ts`.** `draft` is now "Edit the Flow" (was "Edit Flow"), as the brief worded it.
- **R `activity/wording/draft-edit-card.ts` (new, replaces `draft-edit-refused.ts`).**
  `automationStudioActivityDraftEditCard(answer)` builds the card row. It is a `tool` row with ref
  `core.flow_draft`:
  - title "Editing the Flow", or "Running the step again" for a refused rerun;
  - label "... — done / partly done / not done";
  - a record of codes and a count only.
  
  Its `SAID` map is typed `Record<AmendmentRefusal["reason"], string>` and assigned from U's words, so a
  new draft reason fails to compile until U has words for it.
- **R `activity/decision-answer/draft-edit.ts`** (moved from `activity/draft-edit.ts`). Once the loop
  answers, it emits the decision thought (the model's sentence, as what was tried) and then the card.
  - A **partly applied** edit (`applied > 0` with refusals, as in decision 0021) is now said as
    "partly done". Before, it read as landed.
  - An edit that landed also gets a card ("Edit the Flow · Done"), so no edit is a header-only message.
- **R `activity/decision-answer/refused-call.ts` (new) + `observer.ts`.** A model `tool_call` refused as a
  repeat before it ran used to leave its decision heading with no card. It is now held until the next
  `decide` evidence (`core.repeat_check.<iteration>`) or the stalled trace row. Then it emits the call's
  own card: same kind and control, `failed`, with the record `Result: llm_evidence_loop.repeat_refused ·
  Reason: <earlier outcome> · Node: <node>`, which reads "Click · Add to cart / Not done: it already ran
  exactly this way and changed nothing". A call that runs says nothing more.
  `activity/decision-answer/index.ts` is the barrel for this directory.
- **X `panel/chat/stream/step/action-card.ts`** carries `refused`. **X `card-words.ts`** adds a new state:
  - all refused: `state: "refused"`, outcome "Not done: <because>" (never "Didn't work");
  - part refused: "Only partly done: <because>".
  
  `chat.css` has no rule for `refused`, so the card gets the neutral grey mark, as `unconfirmed` does.

### 2. C14: the model's sentence is only what was tried

- No refusal appends the model's summary any more. The phrase "so this was not done: <summary>" and the
  "Didn't change the Flow" / "Didn't run the step again" headers are gone. The model's sentence appears
  only as the decision's reason. Under it, the card states Core's answer: applied, partly, or refused.
- R `wording/decision.ts`: the completion decision's title is now "Checking whether the Flow is finished"
  (was "Checking the Flow is finished"). The model's claim ("a3 is already done by step 27") now reads as
  the thing being checked.

### 3. D8: long card targets keep their distinguishing end (X `card-words.ts`)

- The card's first line is held to 36 characters (name + target; minimum 16 for the target). That is
  measured from the 360 px panel, where "Testing: Click · ValueRidge Everyday Di…" was cut.
- A long target is cut from the middle: its first word when it takes at most half the room, then as many
  last words as fit, joined by " … ".
- A single word that does not fit is cut inside, keeping 60% from its end.
- A typed target (`"<words>" into <field>`) keeps the typed words, cut from the middle if needed. It drops
  the field when both do not fit; the field stays in the label.
- The accessible `label` always keeps the whole target.

Results:
- "ValueRidge … (3-Pack)" vs "ValueRidge … 250 Count";
- `"Voltbay USB-C hub"` (was cut to the placeholder before).

### 4. D10: split judge card inside a build (R `result-verification`)

- **`unsettled-words.ts` (new).** It holds the closing sentence for `model_disagreed` and
  `model_unconfirmed` in two forms:
  - `run`: the existing text, unchanged;
  - `build`: "Since they disagree, the build cannot finish on this test." or "Since neither confirmed it,
    the build cannot finish on this test."
- **`agreement.ts`.** It now builds its reasons from the `run` sentences. The recorded reason text is
  byte-identical, so the flow-bootstrap test pins still hold.
- **`check-activity.ts`.** Inside a build scope (new `activity/in-build.ts`,
  `automationStudioActivityInBuild()`, exported from the activity barrel), it swaps the run sentence for
  the build one on the card text only.

### Tests (beside each subject)

- U `activity-action/tests/refusal.test.ts` (new, 12 tests) and `names.test.ts` (name pin).
- R `activity/tests/observer.test.ts`: the edit block was rewritten for decision + card, partly done,
  undone, rerun, stalled, and the completion title.
- R `activity/tests/refused-call.test.ts` (new, 3 tests): it exercises the observer and the tracker
  together, so it sits in their nearest common `tests/`.
- R `activity/wording/tests/reasons.test.ts`: the card builder for a bound step, and that the record holds
  codes only.
- R `result-verification/tests/check-activity.test.ts`: the build vs run wording.
- X `step/tests/card-words.test.ts`: refused, partly done, middle cut, typed.
- X `step/tests/messages.test.ts`: the typed target expectation.

**Test-first honesty.**
- I saw two tests fail before their fix: the D10 test ("expected ... to match /the build cannot finish
  on this test/") and the U name pin.
- The U refusal tests and the R observer/refused-call tests first ran after their implementation was
  written, and passed. I did not observe them failing on the old code.

## Commands run and observed results

- Core, in `packages/fluxiq`: `npx vitest run src/programs/automation-studio/runtime/activity src/programs/automation-studio/runtime/result-verification src/ui/activity-action`
  -> `Test Files 55 passed (55)`, `Tests 646 passed (646)` (final run, after the move into `decision-answer/`).
- Core tsc: `bash C:/Users/osrs_/FluxStuff/build-slots/heavy.sh "t193 w6 tsc" npx tsc --noEmit -p tsconfig.json`
  -> no output, `exit=0`. Run twice; the second run was after the final move.
- Core structure audit: `node scripts/structure-audit.mjs` -> `structure-audit: passed (242 warning(s), 349 baselined)`.
  The only warning on my paths is `activity/: 16 source files`, which was already 16 before I started; my
  two new modules went into `activity/decision-answer/`.
- Core libraries: `bash .../heavy.sh "t193 w6 core build" pnpm --filter @fluxiq/contracts --filter fluxiq --filter @fluxiq/client-gateway-websocket build`
  -> `fluxiq:build ... "source":"command"`, `Done`, `exit=0`. Run twice; the last run was after all
  Core edits.
- Extension: `heavy.sh ... npx tsc --noEmit -p tsconfig.json` -> `exit=0`. `-p tsconfig.test.json` -> `exit=0`
  (both re-run after the last test edit).
- Downstream scoped tests: `node <scratchpad>/w6-run-chat-tests.mjs . panel/chat panel/icons`, run from
  `apps/extension`. This is a scratch runner that bundles only those `tests/*.test.ts` exactly as
  `scripts/test-extension.mjs` does, into `.test-build-scratch/t193-w6-chat`. The layout doc names no
  scoped command. Output: `entries: 33`, `# tests 241`, `# pass 241`, `# fail 0`. Re-run against the
  final Core dist.
- Downstream structure audit: `node scripts/structure-audit.mjs` -> `structure-audit: passed (164 warning(s), 118 baselined)`.
  It flags `messages.test.ts: 431 lines` (advisory). That file was already over 400 lines: I added 2 net
  lines.

## Not verified

- **No live browser or Lab run.** I have not seen the new cards in the panel or the Core web panel.
- **Not run:** the full extension suite (`pnpm --filter ... extension test`), the Core web panel
  (`apps/web`) tests and typecheck, and full Core vitest.
- **Core web panel cards.** `apps/web/.../ConversationActionCard.tsx` and `conversationStepOutcomeWords`
  do not read `refused`. A refused card there still says "Didn't work: <Core's reason>", because
  `outcome` stays `failed` and `why` is the reason; a partly done edit says "Done". Its card name changes
  to "Edit the Flow" through `ACTIVITY_ACTION_NAMES`. `apps/web` is not in my brief, so I left it alone.
- **The 36-character head budget** comes from the screenshots at a 360 px panel. A narrower panel still
  cuts at the end by CSS (`.chat-card-target` is `nowrap; text-overflow: ellipsis`). A wrap rule in
  `apps/extension/src/panel/chat/chat.css` would be the sturdier fix, but that file is not mine.
- **The "refused" card's look.** It is grey because `chat.css` has no `data-state="refused"` rule; I did
  not look at it.

## Open questions or contradictions found

1. **D12 cannot be fixed in my paths.** The doubled "Repairing the Flow -- Repairing the Flow live: 4 of
   the things you asked are still to do" is written by two places, both outside my brief:
   - Core `R/flow-bootstrap/unfinished-build/phases.ts` l.519. Its `announce` uses label "Repairing the
     Flow" with text "Repairing the Flow live: ...". This path is in *Must not touch*.
   - Core `R/service.ts` l.1625. It forwards that as a `note` row titled with the label. Not in my brief.
   
   Suggested fix, in `phases.ts`, when no judge ran and no not-run steps are held (the continuation of an
   unusable exploration):
   - label "Building on the Flow" (or "Going on exploring");
   - text "4 of the things you asked are still to do. Going on from the page as it stands."
   
   I did not patch it client-side, because that would leave the Core panel saying it.
2. **The build ending (D11-adjacent) still carries the run sentence.** `flow-bootstrap/unfinished-build`
   (`not-done.ts`, pinned at `tests/not-done.test.ts:186`) quotes the agreement reason verbatim, so the
   ending still says "the run is not marked as failed for it". That needs the flow-bootstrap owner. It
   can use `AUTOMATION_STUDIO_RESULT_UNSETTLED_WORDS.<basis>.build` from
   `R/result-verification/unsettled-words.ts` (not yet exported from the `result-verification` barrel;
   add the export when it is used).
3. **D3's misattribution.** The debug says 0074 "quotes the previous amend decision's summary". In the
   code, the refusal at `core.repeat_check.15` was matched to the held edit of the same iteration (0072),
   so it was 0072's own summary. Either way, no summary is appended now.
4. **Scratch output.** The scoped runner left bundles in
   `apps/extension/.test-build-scratch/t193-w6-chat/`. That directory is ignored; `pnpm task prune`
   reclaims it.
