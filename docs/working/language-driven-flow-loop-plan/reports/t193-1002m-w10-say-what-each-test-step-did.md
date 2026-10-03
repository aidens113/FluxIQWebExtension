# t193-1002m-w10: say what each test step did (worker report)

Brief: t193-1002m-w10-say-what-each-test-step-did (worker-high). Causes C3, C6, C9, C10, C11 and C12 from
`debugs/run-murzln6g-11debe1d.md`. Trees: Core `fxwork/t193/!FluxIQ` and downstream
`fxwork/t193/!FluxIQWebExtension`, both on `task/t193-live-self-repair`. Nothing was committed. Other workers'
uncommitted changes in these trees were left alone.

## Outcome

**Done.** All six causes are fixed. Each has a test that failed before its fix and passes after it. Core narrow
checks, Core's library rebuild, and the downstream narrow checks all pass.

I went past the brief's file list in a few places. Each is listed under "Open questions" so the supervisor can
review it:

- Core `flow-draft/dry-run.ts`, `flow-draft/excused.ts` (new) and `flow-draft/index.ts`.
- Core `result-verification/build-test/summary.ts`, `result-verification/contracts.ts` and `result-verification/verdict.ts`.
- Core `llm/diagnosis-instructions.ts`, with its test in `llm/tests/diagnosis-channel.test.ts`.
- Core `ui/activity-action/{types,names,icons,record,index,tested}.ts`.
- Downstream `apps/extension/src/shared/activity/wording.ts`, which holds the overlay's words, and its test.

## What changed and why

### C6: an excused step is said as excused, and the verdict reason is true

- **Where the excuse is decided.** It is decided once, where the replay decides it. `R/flow-draft/routing.ts` gained
  `automationStudioFlowDraftConditionalStepReasons`, which gives each step the Flow does not always run with a
  reason: `interruption`, `optional`, `only_if`, `check`, `fallback` or `repeat`.
  `automationStudioFlowDraftConditionalStepIds` is now built from it, so the two cannot disagree.
- **On the outcome.** `R/llm/node-tools/replay-draft.ts` (`automationStudioFlowDraftReplaySteps`) sets
  `excused: <reason>` on any outcome that did not replay and that the verdict exempts. That is a conditional step, or
  `withheld` for a step marked `withheldBy`. The field is declared on `AutomationStudioFlowDraftReplayOutcome` in
  `dry-run.ts`.
- **Core's words.** These live in the new file `R/flow-draft/excused.ts`
  (`automationStudioFlowDraftExcusedWords`). Example: "optional: it answers something not always in front of the page
  (a dialog, a banner, a panel), so the Flow passes over it when that is not there; in this test it did not run, which
  does not stop the Flow."
- **What the judge sees.**
  - Before: step 15 was `{ outcome: "failed" }` with nothing else.
  - After: `{ outcome: "failed", excused: "optional: … in this test it did not run, which does not stop the Flow." }`
    (`result-verification/build-test/summary.ts`, `contracts.ts` `AutomationStudioBuildTestStep.excused`).
  - A step the test itself made optional (`madeOptional`) has no `excused` on its outcome. The summary therefore also
    reads the draft's current routing, then `withheldBy`.
- **What the judge is told.** `llm/diagnosis-instructions.ts` now says that a step marked `excused` did not hold and
  that the Flow passes over it. It says such a step "is not a defect: it is no reason to answer no on its own, and
  changed never asks to fix, rerun or remove it".
- **What a repair is told.** A refused test's feedback to the model (`dry-run.ts`
  `automationStudioFlowDraftDryRunFeedback`) puts `excused: <words>` on that step's line. The instruction now says:
  "excused: … It does not stand in the way: do not fix, rerun, reorder or drop it for this."
- **The reason clause.**
  - `agreement.ts` before: "The result was judged not to answer the request the Flow was built for, twice and with the
    same evidence, although every step of the run succeeded."
  - After: "… twice and with the same evidence."
  - `verdict.ts` has the same fixed clause on the single-call `no`. I dropped it there too: "The result was judged not
    to answer the request the Flow was built for."

### C10: test-step cards and the overlay say what the test did

- **Shared words.** A new Core file, `U/tested.ts` (`activityActionTested`, exported from `fluxiq/ui`), holds them.
  Core's activity label, the downstream card and the overlay all read it.

| Replay code | Before | After |
| --- | --- | --- |
| `replayed` | Done | Done |
| `verified` | Done | Checked, not pressed ("Checked, not typed" for a typing step) |
| `present`, `remembered` | Done | Already done on the site |
| failing, `Excused: interruption`/`optional` | Didn't work: it didn't work the same way again | Skipped: not there, optional |
| failing, `Excused: only_if`/`check`/`fallback`/`repeat` | Didn't work: … | Skipped: it only runs sometimes |
| failing, `Excused: withheld` | Didn't work: … | Skipped: it needed a step the test only checked |
| failing, not excused | Didn't work: it didn't work the same way again | unchanged |

- **How the activity row learns of the excuse.** The row is emitted when the call returns, before the verdict exists.
  So `replay-draft.ts` puts `excusable: <reason>` on the `executeTool` call of any step it would excuse.
  `R/activity/observer.ts` reads that field and takes it off the call before passing it on, so no host sees it. When the
  answer did not hold, the observer writes `Excused: <reason>` into the raw record:
  `Result: core.replay.failed · Excused: interruption · Node: …`.
- **The status label.** The label's outcome comes from `activityActionTested`. Before:
  "Trying the Flow from the start: clicking “×” — didn't work the same way again". After: "… — skipped: not there,
  optional".
- **The card.**
  - `U/record.ts` parses `Excused`.
  - `U/action-of.ts` treats an excused replay code as `done`, not failed. It sets `ActivityAction.tested`, a new
    optional field, for every replay code except `replayed`.
  - Downstream `panel/chat/stream/step/action-card.ts` copies `tested`, and `card-words.ts` shows it in place of
    "Done".
- **The overlay.** Downstream `shared/activity/wording.ts` uses Core's own sentence after the dash for
  `verified`/`present`/`remembered`, and for a row whose record carries `Excused`. Before, the overlay said "done" and
  "that didn't work, trying another way". After, it says Core's words, which match the card. An older Core whose
  sentence says only "done" is read as before.

### C9: the completion check is a "Ready check", never a "Test run"

- `U/types.ts` adds the kind `ready_check`, named "Ready check" (`names.ts`). Its icon is `scan-search` (`icons.ts`),
  which every client already draws.
- `U/action-of.ts` gives that kind to a `check` row titled "Completion check" and to `core.completion_check`.
- `R/activity/observer.ts` now puts text on the passing row: "It still has to run cleanly from its start.". Before,
  that sentence was only in the label, which the card does not show.
- Downstream `card-words.ts`:
  - Before: "Test run · Passed".
  - After: "Ready check · Ready to test: it still has to run cleanly from its start."
  - A refused check reads "Ready check · Sent back: <refusal>".
- Core `apps/web` `action-icons.ts` needed `ready_check: ScanSearch` to typecheck. Its card name comes from Core.

### C11: one "Check result" card

- `R/result-verification/verify.ts` titles both the start row and the end row "Result check" (`RESULT_CHECK_TITLE`).
  Before, the start row was titled "Result check started", so the card key `check:<title>` (`U/key.ts`) differed, and
  an empty card came first. `key.ts` is unchanged.

### C12: a `missing_input_keys` refusal says what was wrong with the call

- `U/failure-reason.ts` adds refusal reasons that are checked before the page-word table:

| Reason | Before | After |
| --- | --- | --- |
| `missing_input_keys` | it wasn't on the page | the request left out something it needs |
| `unexpected_input_keys` | the step wasn't accepted | the request had something it doesn't take |
| `not_a_number`, `not_a_url`, `value_not_text` | the step wasn't accepted | a value in the request was the wrong kind |

### C3: the choice-order sentence names the amendment

- `R/flow-bootstrap/instructed-acts/choice-order.ts`:
  - Before: "… Make the choice before the step that does a2, or do a2 again after it and name that step for a2."
  - After: "… Make the choice before the step that does a2: amend_draft reorder on step 16 with to 12 moves step 16 to
    position 12, just before that step. Or do a2 again after it and name that step for a2."
  - I checked this against `amendment.ts` `moveStep`. It splices the step in at `to - 1` and renumbers, so the act step
    moves to 13.

### Tests added or changed

- Core:
  - `U/tests/action-of.test.ts`: C9 and C10 cases. The "Completion check is test" row now expects `ready_check`.
  - `U/tests/failure-reason.test.ts` (C12).
  - `U/tests/names.test.ts` and `icons.test.ts`: the pinned lists now include `ready_check`.
  - `R/activity/tests/wording.test.ts` (C10 labels, the excused record, the hint taken off the call, C9 text).
  - New: `R/llm/node-tools/tests/replay-draft-excused.test.ts` (C6 outcomes, the call hint, the feedback line).
  - New: `R/result-verification/build-test/tests/excused.test.ts` (the C6 account).
  - New: `R/result-verification/tests/check-card.test.ts` (C11 single key, and the C6 reason through the real
    verifier with a scripted provider).
  - `R/llm/tests/diagnosis-channel.test.ts` (the C6 judge instruction).
  - `R/flow-bootstrap/instructed-acts/tests/choice-order.test.ts` (C3).
- Downstream:
  - `panel/chat/stream/step/tests/card-words.test.ts` (C9 and C10, including event → `actionCard` → `cardWords`).
  - `panel/chat/stream/step/tests/messages.test.ts`: the completion check card kind is now `ready_check`.
  - `shared/activity/tests/wording.test.ts` (overlay, C10).

## Commands run and observed results

### Failing first

**Core**, before any source change:

```
npx vitest run src/ui/activity-action/tests $R/activity/tests/wording.test.ts $R/result-verification/tests/check-card.test.ts $R/llm/node-tools/tests/replay-draft-excused.test.ts $R/result-verification/build-test/tests/excused.test.ts $R/flow-bootstrap/instructed-acts/tests/choice-order.test.ts
```

Result: `Test Files 9 failed | 4 passed (13)`, `Tests 26 failed | 152 passed (178)`. Examples:

- C12: `expected 'it wasn't on the page' to be 'the request left out something it needs'`.
- C9: `reads ready_check → expected 'test' to be 'ready_check'`.
- C10: `expected { kind: 'test', …(3) } to match object { … tested: 'Checked, not pressed' }`.
- C10 observer: the label still read "— done".
- C11: `expected 2 to be 1` (two card keys).
- C6: `expected 'The result was judged not to answer t…' not to match /every step/u`.
- C6 replay: `expected { step: 15, … } to match object { status: 'failed', excused: … }`.
- C6 judge instruction: `expected 'Put your reading…' to match /excused/u`.
- C3: `expected 'a1.quantity is made by step 16, after…' to contain 'amend_draft reorder on step 16 with to 12'`.

Four of the build-test `excused.test.ts` cases first failed for the wrong reason: a module-order `TypeError` (the llm
barrel was not imported first). I fixed the test's imports. Then I took the summary line
`...(excused ? { excused } : {})` out on purpose and re-ran. Three cases failed for the real reason
(`.toMatch() expects to receive a string, but got undefined`, `Tests 3 failed | 2 passed (5)`). I restored the line.

**Downstream**, after the Core rebuild and before the downstream source change:

```
node t193-1002m-w10-scoped-tests.mjs apps/extension apps/extension/src/panel/chat apps/extension/src/shared/activity/tests/wording.test.ts
```

Result: `# tests 247 / # pass 243 / # fail 4`. The failures were:

- the new C10 card test;
- the new C9 card test;
- the new overlay test;
- the existing `messages.test.ts` expectation of kind `test` for the completion check. That one is a consequence of
  C9, and I updated it.

### After the fixes

- **Core typecheck.** `npx tsc --noEmit -p .` in `packages/fluxiq`: no output, exit 0.
- **Core vitest, the touched directories:**
  `npx vitest run src/ui/activity-action $R/activity $R/result-verification $R/llm/node-tools/tests $R/flow-draft/tests $R/flow-bootstrap/instructed-acts/tests $R/llm/tests/diagnosis-channel.test.ts`
  → `Test Files 85 passed (85)`, `Tests 1045 passed (1045)`.
- **Core vitest, neighbouring tests** that read replay codes or the reason strings:
  `$R/flow-bootstrap/tests/person-needed.test.ts $R/route-state/tests/build-routing.test.ts $R/tests/service-bootstrap/tests/creation-spend.test.ts $R/tests/service-bootstrap/tests/judged-build.test.ts $R/recovery`
  → `Test Files 46 passed (46)`, `Tests 536 passed (536)`.
- **apps/web.** `npx tsc --noEmit`: exit 0. `npx vitest run src/features/automation-studio/conversation`:
  - before the Core rebuild, 1 failed. `ConversationActionCard` compares its icon map with the built `fluxiq/ui`,
    which did not have `ready_check` yet;
  - after the rebuild, `Test Files 26 passed (26)`, `Tests 267 passed (267)`.
- **Core structure audit.** `node scripts/structure-audit.mjs` → `structure-audit: passed (223 warning(s), 349 baselined)`.
  Two earlier runs failed on rules, and I fixed both:
  - test imports that reached past a barrel;
  - `llm/tests/` going over its 25-file limit, so the judge-instruction test went into the existing
    `diagnosis-channel.test.ts`.
- **Docs reference.** `node scripts/docs-reference.mjs --check` first reported "docs/reference/framework-reference.md is
  stale". I regenerated it with `node scripts/docs-reference.mjs` ("3018 public declarations"), and `--check` then
  printed "Deterministic framework reference is current." The diff adds `activityActionTested` and the new
  `ActivityAction` doc. These two files already had other workers' changes in them; the regeneration covers those too.
- **Core rebuild.**
  `bash C:/Users/osrs_/FluxStuff/build-slots/heavy.sh "t193-w10 core libs" pnpm --filter @fluxiq/contracts --filter fluxiq --filter @fluxiq/client-gateway-websocket build`
  → it held slot b1. `fluxiq:build` rebuilt ("inputs changed: packages/fluxiq", 40782 ms). contracts and
  client-gateway were reused. All three printed Done.
- **Downstream typecheck.** `npx tsc -p tsconfig.json --noEmit` and `npx tsc -p tsconfig.test.json --noEmit` in
  `apps/extension`: both exit 0, no output.
- **Downstream tests, panel chat and overlay wording.**
  `node <scratchpad>/t193-1002m-w10-scoped-tests.mjs apps/extension apps/extension/src/panel/chat apps/extension/src/shared/activity/tests/wording.test.ts`
  → `# tests 247 # pass 247 # fail 0`.
- **Downstream tests, overlay and relay neighbours.** The same runner over `src/shared/activity`,
  `src/background/activity`, `src/panel/icons` and `src/content/activity-overlay` → `# tests 123 # pass 123 # fail 0`.
- **Downstream structure audit.** `node scripts/structure-audit.mjs` → `structure-audit: passed (159 warning(s), 118 baselined)`.
- **Core build freshness.** `node scripts/check/core-build.mjs` → "core-build: FluxIQ Core's build at … is current
  with its source."

## Not verified

- **No live run and no browser check.** The words were checked only by unit tests: an observed loop with a scripted
  executor, a verifier with a scripted provider, and cards built from synthetic events. I did not see real cards or the
  real overlay in a browser.
- **Core's own web panel (`apps/web`) still says "Done" on test steps.** It does not read `ActivityAction.tested`, and
  its card update in `conversation/activity/steps/messages.ts` drops the field. It does show "Ready check" for the
  completion check, because the name comes from Core. The brief allowed `apps/web` edits only where the kinds forced
  them.
- **A part run has no `excusable` hint.** Its steps (`core.run_flow`, `run-flow-part.ts`) do not go through
  `automationStudioFlowDraftReplaySteps`. An excused step in a part run would still read "Didn't work".
- **Two side effects of the observer change** (its labels and records now use the replay words for any `core.replay.*`
  code, not only dry-run calls), checked only by the existing tests passing:
  - A rerun's put-back steps (`rerun.N.place.P`) now carry `excusable` too. The observer takes it off, and those rows
    can say "Skipped: …".
  - On those rows, a failing replay code now reads "didn't work the same way again", where it read "didn't work", and
    a `verified` one reads "checked, not pressed", where it read "done".
- **No authored documentation was updated.** `docs/architecture/automation-studio/llm-flow-bootstrap.md` already
  carries other workers' changes. The project's maintenance rule might count a chat-wording change and a new
  judge-account field as substantial.
- **No full suites were run**, per the project's twice-a-day rule.

## Open questions or contradictions found

1. **Files edited beyond the brief's list.** C6 asks that an excused step be marked "wherever the build test is shown
   to the judge", and that "a repair must not be told to fix or remove" it. To do that I had to edit:
   - the replay outcome type, and the model's refusal feedback and instruction (`flow-draft/dry-run.ts`);
   - a new `flow-draft/excused.ts`, with its barrel line;
   - the judge account (`result-verification/build-test/summary.ts`, `contracts.ts`);
   - the judge instruction (`llm/diagnosis-instructions.ts`, test in `llm/tests/diagnosis-channel.test.ts`).

   `verdict.ts` carries the same false clause as `agreement.ts`, so I fixed it too. Keeping the overlay's words
   consistent with the card needed downstream `shared/activity/wording.ts`, which is outside `panel/chat/**`. Please
   review these, and revert any you did not mean to allow.
2. **The completion check's message header** (downstream `panel/chat/stream/step/words.ts`) still reads "Checked the
   result" / "The result didn't pass its check" for the completion check. It checks the plan, not a result. The debug
   did not cite it, so I left it.
3. **"Checked, not pressed" is chosen by the verb of the step's title.** It becomes "not typed" for a typing step and
   stays "not pressed" for everything else, a select included. If verified select steps become common, a "not chosen"
   wording may be wanted.
4. **An excused step's card is marked `done`, the green state, with "Skipped: …".** A neutral mark may suit it better.
   That would need a new card state downstream and in Core's panel.
