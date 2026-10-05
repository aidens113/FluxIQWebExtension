# t264-s2-w1: refusal cards (lane B F6)

## Outcome

**Done.** F6 is ported from lane B (`fxwork/t193`) onto `task/t264-core-integration-chain` in both trees:

- C13: refusal cards;
- C14: the model's sentence is only what was tried;
- D8: long card targets are cut from the middle;
- D10: a split judge's card uses the build wording inside a build;
- w10's move of `unsettled-words` into `result-verification/unsettled/`.

D12 was never done in w6 and is not ported. Every named check exits 0.

## What changed and why

### Base check

`git diff 6beae684 HEAD` (6beae684 is the lane base) shows no change on t264 to any owned code file in Core or downstream. Only `flow-authoring.md` and `llm-flow-bootstrap.md` moved on. So the lane files were taken whole after I read every hunk, with CR stripped so they are LF.

Each file's lane diff was read hunk by hunk, and every hunk was F6. Two lines were changed deliberately:

1. **`U/activity-action/refusal-words.ts`**: I dropped the `count_not_a_repeat` entry.
   - That refusal reason comes from another lane unit (lane `flow-draft/amendment.ts`). It is not in t264's `AutomationStudioFlowDraftAmendmentRefusal["reason"]` union.
   - Every other key matches t264's union exactly: 18 of 18.
   - The compile-time `Record<reason, string>` check in `draft-edit-card.ts` still covers every t264 reason.
2. **`U/activity-action/record.ts`**: a doc comment pointed at `runtime/activity/draft-edit.ts`, which the lane left stale after its own move. It now points at `runtime/activity/decision-answer/draft-edit.ts`.

### Core, U = `packages/fluxiq/src/ui/`

- New: `activity-action/refusal-words.ts`, `activity-action/refusal.ts`, `activity-action/tests/refusal.test.ts`.
- Edited:
  - `activity-action/record.ts`: `Applied:` part;
  - `types.ts`: `refused?`;
  - `action-of.ts`: refused outcome, `why`, rerun target, no `tested`;
  - `names.ts`: "Edit the Flow";
  - `index.ts`: exports `ACTIVITY_ACTION_REFUSAL_WORDS`;
  - `tests/names.test.ts`.

### Core, R = `packages/fluxiq/src/programs/automation-studio/runtime/`

- New:
  - `activity/decision-answer/{draft-edit,refused-call,index}.ts`;
  - `activity/in-build.ts`;
  - `activity/wording/draft-edit-card.ts`;
  - `activity/tests/refused-call.test.ts`;
  - `result-verification/unsettled/{index,unsettled-words}.ts`.
- Deleted: `activity/draft-edit.ts` (moved to `decision-answer/draft-edit.ts`) and `activity/wording/draft-edit-refused.ts` (replaced by `draft-edit-card.ts`).
- Edited:
  - `activity/observer.ts`: the decision-answer import, `decidedCall`, and the refused-call tracker wired into decide, executeTool and stalled;
  - `activity/index.ts`: `automationStudioActivityInBuild`, and `DraftEditCard` replaces `DraftEditRefused`;
  - `activity/wording/{decision,index}.ts`: "Checking whether the Flow is finished", and the barrel swap;
  - `result-verification/agreement.ts`: uses the `UNSETTLED.<basis>.run` sentences, byte-identical text;
  - `result-verification/check-activity.ts`: `saidHere` swaps in the build sentence inside a build;
  - `result-verification/index.ts`: exports `./unsettled/index.ts`.
- Tests: `activity/tests/observer.test.ts`, `activity/wording/tests/reasons.test.ts`, `result-verification/tests/check-activity.test.ts`.

### Importers of moved or deleted modules

The only importers of `activity/draft-edit.ts`, `wording/draft-edit-refused.ts` and `automationStudioActivityDraftEditRefused` on t264 were:

- `activity/observer.ts`;
- `activity/index.ts`;
- `activity/wording/index.ts`;
- `activity/wording/tests/reasons.test.ts`.

All four are in the Task list, so no outside importer needed a path edit. The one other reference is the generated `packages/fluxiq/docs/reference/framework-reference.md:472`, which still lists `automationStudioActivityDraftEditRefused`. I left it untouched as the brief says (generated, already stale, left for a later docs step).

### Downstream, X = `apps/extension/src/`

- Taken whole from the lane (all hunks F6):
  - `panel/chat/stream/step/action-card.ts`: carries `refused`;
  - `card-words.ts`: `refused` state, "Not done" / "Only partly done", D8 middle cut with a 36-character head room;
  - `tests/card-words.test.ts`.
- `tests/messages.test.ts`: only the D8 hunk, the typed-target pin in "a build's test step reads as testing its action, with what it typed". It was applied with one Edit, so nothing else in the file was touched.

### Docs

- Core `docs/architecture/automation-studio/client-gateway.md`: the F6 paragraph (17 lines) after the "Simple/Advanced split is removed" paragraph. It was the lane's only hunk in that file, and the file was unchanged on t264.
- **`flow-authoring.md`: no hunk ported.** Its hunks are:
  - `bind_new_key` `control`;
  - every answer naming what is still to do;
  - `moved`;
  - provider-result;
  - the split-instruction hunk.
  
  These are w10 tasks 1 and 5, plus other units. None describes refusal cards, "Edit the Flow" or the split card.
- **`llm-flow-bootstrap.md`: no hunk ported.** The one hunk that names the build sentence (around lane line 921) describes the not-finished **ending** and the **repair heading**, not the chat card:
  - `automationStudioFlowBootstrapUnsettledForBuild`;
  - `ProgressAndTestSaid`;
  - D12 "Building on the Flow".
  
  Those are w10 tasks 2 and 3, which are not ported. Porting it would document code that t264 does not have.

## Commands run and observed results

**Core, from `packages/fluxiq`**

- `npx vitest run src/programs/automation-studio/runtime/activity src/programs/automation-studio/runtime/result-verification src/ui/activity-action`
  - exit 0
  - `Test Files 56 passed (56)`, `Tests 664 passed (664)`
- `npx vitest run src/programs/automation-studio/runtime/flow-bootstrap/unfinished-build/tests/not-done.test.ts`
  - exit 0
  - `1 passed (1)`, `Tests 20 passed (20)`
  - This is the only test outside my directories that pins the unsettled sentence, which I found by grep. It confirms the `agreement.ts` reasons are byte-identical.
- Grep for test files importing the moved modules found none outside owned files. A grep across both t264 trees (`.ts`/`.tsx`, including `apps/web`) for the old strings ("Edit Flow", "Checking the Flow is finished", "Didn't change the Flow", "Didn't run the step again", `DraftEditRefused`, "so this was not done") hits only comments and negative assertions in owned files.

**Core root**

- `node scripts/build-cache/cli.mjs fluxiq:check`
  - exit 0, `"step":"fluxiq:check" ... "source":"command"`
  - Log: `<scratchpad>/t264-w1-fluxiq-check.log`.
- `node scripts/build-cache/cli.mjs structure-audit:check`
  - exit 0, `structure-audit: passed (245 warning(s), 349 baselined).`
  - Warnings on owned paths are advisory and none is new:
    - `runtime/activity/: 16 source files` is unchanged, because `draft-edit.ts` left and `in-build.ts` arrived;
    - `result-verification/tests/: 16` already holds `check-activity.test.ts`; no file was added there.
- `pnpm.cmd build`
  - exit 0, with `web:build` last.
  - Log: `<scratchpad>/t264-w1-core-build.log`.

**Downstream root**

- `node <scratchpad>/t262-gate/run-subset.mjs <abs>/apps/extension t264-w1 src/panel/chat/stream/step/tests/card-words.test.ts src/panel/chat/stream/step/tests/messages.test.ts src/panel/chat/view/tests/action-card-view.test.ts`
  - exit 0, 3 bundles printed under `apps/extension/.test-build-scratch/t264-w1/`.
- `node --test` on the 3 bundles
  - exit 0, `# tests 41`, `# pass 41`, `# fail 0`.
  - The "Edit the Flow" name pin passed, so the bundles resolved the rebuilt Core.
- `pnpm.cmd --filter @fluxiq-web-extension/extension check`
  - exit 0. `core-build: ... current with its source`, extension:check built.
- `pnpm.cmd --filter @fluxiq-web-extension/domain check`
  - exit 0. Domain:check built against the new Core dist and src.
- `node scripts/structure-audit.mjs`
  - exit 0, `structure-audit: passed (165 warning(s), 118 baselined).`

**Tree state**

- `git status --porcelain -uall` in both trees shows only owned files. The exception is `docs/working/mvp-final-month-plan/reports/t264-core-chain.md` downstream, which was already modified before I started and is not mine.
- `grep -l $'\r'` over every changed or new file found none, so all are LF.

## Not verified

- No live browser, Lab or panel run. The refused card's look has not been seen; it is grey, because `chat.css` has no `data-state="refused"` rule.
- Not run: the full Core vitest suite, `apps/web` tests and typecheck beyond `pnpm build`, and the full extension suite.
- The Core web panel (`apps/web` `ConversationActionCard`) still does not read `refused`. A refused card there says "Didn't work: <Core's reason>", as the lane noted. It is out of scope.

## Open questions or contradictions found

1. **`count_not_a_repeat`.** When the lane unit that adds this refusal reason is ported, it must re-add its words to `U/activity-action/refusal-words.ts`. Without them, the `SAID: Record<reason, string>` assignment in `R/activity/wording/draft-edit-card.ts` fails to compile, which is the intended guard. The exact line from the lane is:

   ```ts
   count_not_a_repeat: "how many of one item is set with its quantity control, not by repeating a step"
   ```
2. **`framework-reference.md` is stale.** It still names `automationStudioActivityDraftEditRefused`, `draft-edit-refused.ts:55`, and lacks the new exports. The brief already leaves this for a later docs step.
3. **The w10 docs follow-ups.** The `llm-flow-bootstrap.md` paragraph on the build sentence in endings and repair headings should land with whichever task ports w10 tasks 2 and 3 (`not-done.ts` `UnsettledForBuild`, D12 `phases.ts`). It now imports `result-verification/unsettled/`, so this port already provides the module it needs.
