# W12 report: extension thought rows (t378)

## Brief

### Brief: t378-w12-extension-thought-rows (worker)
- Repository: downstream extension. Tree T = `C:/Users/osrs_/FluxStuff/fxwork/t378/!FluxIQWebExtension` (on `task/t378-candidate-feedback`). E = `T/apps/extension/src`.
- Context: Core (W4) renamed the unusable-reply row from "Deciding the next step" to "Asking the AI model again" (kind thought, marked failed; see `C:/Users/osrs_/FluxStuff/fxwork/t378/!FluxIQ/packages/fluxiq/src/programs/automation-studio/runtime/activity/observer.ts`). W5 changed `E/panel/chat/stream/step/words.ts` so a failed "Deciding the next step" thought reads "Asking the AI model again". The extension's `E/shared/activity/model-thought.ts` `isModelThought` treats only the old title as status, so the renamed row would now be drawn as a message and not used as the live line, and `E/panel/chat/stream/step/tests/words.test.ts:18` still uses the old title. Reports: `T/docs/working/mvp-final-month-plan/reports/t378-candidate-feedback/w4-runtime-wording.md` ("Open questions", item 4) and `w5-ui-words.md`.
- Task: make the extension treat both titles consistently: the unusable-reply row is a status ("Asking the AI model again"), never headed "Decided the next step" and never shown as a model message; the ordinary deciding row behaves as before. Update `isModelThought`, W5's words mapping if it now double-handles the case, and the fixtures. Fail-first test with the new Core title.
- Owns: `E/shared/activity/**`, `E/panel/chat/**`, and the tests beside them.
- Must not touch: Core, domain, other extension files, any other tree, lab slots or processes.
- Validation: the extension package scripts refuse while Core's source is newer than its build (expected; the lead builds Core at the end). Run `EXTENSION_TEST_BUILD_LABEL=t378-w12 node scripts/test-extension.mjs` from `T/apps/extension` (it runs against Core's existing build) and report the counts; note any test that needs the new Core build. Never commit; no `pnpm build`; no Lab run or provider call.
- Report to: `T/docs/working/mvp-final-month-plan/reports/t378-candidate-feedback/w12-extension-thought-rows.md` (paste this brief at its top; protocol report format; return at most 12 lines).

## Outcome

Done.

## What changed and why

All paths relative to E.

1. `shared/activity/model-thought.ts`: `isModelThought` now treats both Core deciding titles as status,
   through a set holding "Deciding the next step" and "Asking the AI model again" (the title is trimmed before the check).
   The renamed row, which is failed and carries Core's sentence, is no longer counted as the model's words.
   The pacer therefore uses it as the live line again, as it did for the old title. An older Core that sends the old title with text is still status.
2. `panel/chat/stream/step/messages.ts`: in the chat, a thought with text was always a `decision`
   message, and the actions that followed it became its cards. Now a thought that
   `isModelThought` rejects is drawn as a `note` instead. In practice that is Core's own deciding row with its sentence.
   The fix also clears `unit.decision`, so the next decision's action is not filed under
   "Asking the AI model again". Without this, the chat would still have shown the row as a model decision.
3. `panel/chat/stream/step/words.ts`: W5's `failed: "Asking the AI model again"` for
   "deciding the next step" was mapping the case twice. With W4's Core, the asking-again row arrives under its own title, and
   `stepWords` keeps that plain title as it is. The only failed "Deciding the next step" Core still
   emits is the stopped decision (`observer.ts`: label "Deciding the next step — stopped", no
   text). W5's mapping would have mislabelled that one as "Asking the AI model again".
   Its failed tense is now "Deciding the next step", so the row is neither "Decided" nor "asked again".
   The started and succeeded tenses are unchanged.
4. Tests:
   - `shared/activity/tests/model-thought.test.ts`: a new test covers the asking-again row with both of Core's
     sentences (no answer, and an unusable answer). It checks that the row is status.
   - `panel/chat/stream/step/tests/words.test.ts`: the old-title fixture is replaced by the new Core title, which keeps its title and text.
     The test now asserts deciding as started "Deciding", succeeded "Decided", and failed "Deciding".
   - `panel/chat/stream/step/tests/messages.test.ts`: a new test checks that the asking-again row is a `note` with no cards, and
     that the following tool is its own `action` message.

## Commands run and observed results

- Fail-first, run from `T/apps/extension` with the tests added and the source unchanged:
  `EXTENSION_TEST_BUILD_LABEL=t378-w12 node scripts/test-extension.mjs` -> exit 1,
  `# tests 2730 # pass 2727 # fail 3`. The failing tests were exactly the three new or updated ones: "Core's asking-again
  row is a note, not a decision, and owns no card", "a decision Core could not get from the
  model is never said as decided", and "Core's asking-again row is status, whether the provider gave no
  answer or an unusable one".
- After the fix, same command -> exit 0, `# tests 2730 # pass 2730 # fail 0`.
- None of these tests needs the new Core build: each one builds its events by hand.

## Not verified

- No live browser or Lab check (none allowed by the brief).
- The tests ran against Core's existing build, not the rebuilt one.
- Tests in `background/` (pacer, unit-history), `content/`, and `shared/activity/tests/wording.test.ts` still
  use the old failed-with-text "Deciding the next step" fixture. They pass because the old title stays
  status. The `background/` and `content/` tests are outside my ownership, so I left them; `wording.test.ts` is inside it, but I left it unchanged as well.

## Open questions or contradictions found

- The `background/activity/tests/pacer.test.ts` (around line 643) and `unit-history.test.ts` (around line 72)
  fixtures show the outage row under the old title. A follow-up could move them to "Asking the AI model again" so they match current Core.
- `shared/activity/wording.ts` needed no change, because a thought with text already reads as its text.
