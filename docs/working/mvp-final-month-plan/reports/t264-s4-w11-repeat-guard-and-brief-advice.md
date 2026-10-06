# t264-s4-w11-repeat-guard-and-brief-advice: worker report

Core tree: `C:/Users/osrs_/FluxStuff/fxwork/t264/!FluxIQ` (branch `task/t264-core-integration-chain`). R = `packages/fluxiq/src/programs/automation-studio/runtime/`.
W8-W10's uncommitted ports were left untouched. I made no git writes.

## Outcome

**Done.** These are ported per the brief's rules:
- lane C w79 (handle failure lifted after a new look);
- lane D w46 (part run keyed on the draft);
- lane C w78 (brief advice vs Core's read account; truthful `rerun_needs_input` refusal);
- lane B's one bind sentence in the decision instruction, with its `evidence_tool_decision` pin.

All of these exit 0:
- the brief's vitest set: 337 files, 3630 tests;
- the Core typecheck, the structure audit and `pnpm build`;
- the downstream domain and extension checks.

Budgets:
- `evidence-loop.ts` stays at 796 lines.
- `evidence-loop-decision.ts` is 668 lines.

Every file I touched has LF endings (0 CR).

## What changed and why

### One repeat guard: w79 and w46 merged by hand (`R/llm/repeat-guard/`)

**`outcomes.ts`**
- Header: both lanes' sections. w46's "keyed on the draft too" sits after the look section, and w79's "handle not yet shown" after the rerun section.
- `HANDLE_UNSHOWN` covers `handle_not_in_packet`, `handle_not_issued` and `unknown_handle`.
- Outcome type:
  - `same_draft` is added to `outcome`;
  - `handleUnshown?: true` is added.
- `automationStudioLlmEvidenceRepeatGuard({ draftOf? })`. The key is `tool, page, draftOf(tool) ?? "", input`.
- Handle failures are lifted per page:
  - an `unshown` map records them;
  - `showed(state)` lifts them, and runs on a look that answered something new or on any unrefused non-look call.
- `runsDraft`: a part run that applied nothing is not `failed`.
- The outcome order is `failed`, then `same_result`, then `same_draft` (for a draft-running tool), then `changed_nothing`.
- Merge points:
  - `handleUnshown` is set only on `failed`, so it never coincides with `same_draft`.
  - The `unshown` keys include the draft key, so a part run's handle failure is lifted on the same draft and page only.
  - An unrefused part run counts as a call that showed something, so it lifts handle failures on its page. That matches w79's rule for any non-look call.

**`feedback.ts`**
- Both instructions are ported verbatim: `HANDLE_UNSHOWN_INSTRUCTION` and `DRAFT_INSTRUCTION`.
- A small `instructionFor()` picks between them:
  - `same_answer` gets the look note;
  - `same_draft` gets the draft note;
  - `handleUnshown` gets the handle note;
  - anything else gets the plain note.
- `then.handleUnshown` is carried in the note.

**`draft-key.ts`** (new, lane D's file)
- It is a sha256 of `automationStudioFlowDraftFlowSignature`, cut to 32 hex characters.
- `flow-signature.ts` is byte-identical on lane D and on this tree.

**Consistency with B F11.** The Flow signature already holds what F11 added to `amendment-memory.ts`'s `draftSignature`: `ranWith` (as `ranWith ?? input`), acts, routing and settings. So an amendment the memory sees as changing a kept step always gives a new key, and the next part run runs.
- The only differences are steps a part run never walks:
  - withdrawn steps, which the memory includes and the Flow signature leaves out;
  - a step's id where a rerun put an identical step in its place.
- I kept the Flow signature, because `run-flow-part.ts` walks only proposed steps. The dry-run gate keys its clean signature on the same Flow signature.
- This is written into `draft-key.ts`'s header.

**`index.ts`**: the barrel exports `draft-key.ts`, with lane D's comment.

**Tests**
- `tests/outcomes.test.ts`: w79's two cases and w46's case, inserted before "counts refused repeats in a row".
- `tests/feedback.test.ts` (new): w79's two cases, plus one of mine that pins the `same_draft` note ("unchanged draft", "change the draft first (amend_draft").

### w46 elsewhere

**`R/llm/node-tools/run-flow-part.ts`**: `effectApplied ||= step.effect === "mutate" && answer.effectApplied`, with lane D's header paragraph.

**`R/llm/evidence-loop.ts`**: lane D's hunks.
- The import gains `AUTOMATION_STUDIO_LLM_EVIDENCE_MAX_REFUSED_REPEATS_IN_A_ROW` and `automationStudioLlmEvidenceDraftKey`.
- The ceilings comment is compacted from 5 lines to 2.
- `repeatsStall` in `unusable()`. It reuses this tree's `sameDraftRefusedAgain`, which t263/t262 already computed from `automationStudioFlowDraftReplaySignature`.
- The `draftOf` closure is passed to the guard.
- `draftKey` goes into the repeat policy's request signature for `core.run_flow`.
- The call-site comment is merged.
- The file has the same line count as before (796).

**`R/flow-bootstrap/unfinished-build/tests/unchanged-complete.test.ts`**: lane D's w46 hunk. The import is added, and the stall is expected at `1 + MAX_REFUSED_REPEATS_IN_A_ROW` decisions and below the no-progress bound.

**`R/llm/evidence-loop/tests/repeat-guard.test.ts`**: lane D's two-test block, appended. The base differs from lane D's only in t262's wording assertions at line 78, which are kept.

### w78

**`R/llm/evidence-loop-decision.ts`**
- New `AUTOMATION_STUDIO_LLM_EVIDENCE_RERUN_NEEDS_INPUT_CODE`.
- `automationStudioLlmEvidenceDecisionIssueCodes` now also reads `amend_draft`.
- `readAmendments` maps a new per-item `readAmendment`, which returns `"rerun_needs_input"` for a rerun with no input.
- **Merge with t262:** t262's `unrepeat` exact-keys check is kept inside `readAmendment`, in the same position.

**`R/llm/unusable-decision.ts`**: the `llm_evidence_loop.rerun_needs_input` instruction.

**`R/llm/evidence-loop/decision-refusal.ts`**: the comment only.

**`R/llm/tests/unusable-decision.test.ts`**: the lane's 4 cases and their imports. The lane's duplicate import of `automationStudioLlmUnusableDecisionFeedback` is dropped, because this tree already imports it.

**`R/recovery/refuted-result/brief.ts`**
- The w78 header paragraph.
- READ_STEPS step 3's added sentence ("Where the check's advice contradicts \"How the read went\" ... Core's account stands ...").

**`R/recovery/refuted-result/tests/brief.test.ts`**: the lane's case "says Core's account of the read stands ...".

### Lane B's bind sentence

**`R/llm/evidence-loop-decision.ts`**
- In `AUTOMATION_STUDIO_LLM_EVIDENCE_DECISION_INSTRUCTION`, "a value that changes between runs or rows is bound (...), never typed in;" became "only a value a step typed, or a read's condition, is bound: one that changes between runs or rows is bound (...), never typed in, and a press's control or option is never bound;".
- The doc comment gains lane B's `run-mustzxhi-2e2cda87` sentence.

**`R/llm/deepseek/tests/system-prompt-pins.json`**
- Only the `evidence_tool_decision` entry changed, with the same one-sentence replacement (exactly one match).
- Lane B's other pin change (`loop_verification_build_test`) belongs to another unit and was not ported.

### Docs (`docs/architecture/automation-studio/llm-flow-bootstrap.md`)

Neither lane had doc hunks for these units:
- lane D's hunks are w41/w42;
- lane C has no doc diff.

So I wrote three short additions:
1. **`rerun_needs_input`**, after the `decision_shape_invalid` paragraph.
2. **The repeat guard** section:
   - a new "never refuses" bullet for handle-unshown failures after a new look (w79);
   - a new paragraph "A part run is keyed on the draft too" (w46).
3. **Step 3 of the re-author brief**, in the paragraph on carried steps (w78).

### Lane hunks accounted for

| Hunk | Disposition |
| --- | --- |
| t194 `repeat-guard/{outcomes,feedback}.ts`, `tests/outcomes.test.ts`, new `tests/feedback.test.ts` (w79) | Ported, merged with w46 |
| t195 `repeat-guard/{outcomes,feedback,index}.ts`, `draft-key.ts`, `tests/outcomes.test.ts` (w46) | Ported, merged with w79 |
| t195 `run-flow-part.ts`, `evidence-loop/tests/repeat-guard.test.ts`, `unchanged-complete.test.ts` (w46) | Ported |
| t195 `evidence-loop.ts`: import, comment compaction, `repeatsStall`, `draftOf`, `draftKey` signature, call-site comment (w46) | Ported |
| t195 `evidence-loop.ts`: `route: input.instructionRoute?.known()` and `await automationStudioLlmEvidenceHandleAmendment` | Not ported: w49/w50 (never port) |
| t195 `decision-handlers/amendment.ts` | Not ported: w49/w50 |
| t195 `llm-flow-bootstrap.md` hunks | Not ported: w41/w42, other units |
| t194 `evidence-loop.ts` (`TraceRecorder(trace, process.env, () => evidence)`, `rows.decisionStarts()`) | Not ported: other t194 units (step-log work, not w78/w79) |
| t194 `decision-handlers/amendment.ts` (kept keys: `RerunHeldWithKept`, `tellKept`, `answerOf`) | Not ported: w85 (never port). It has no w78 part |
| t194 `evidence-loop-decision.ts` `readAmendment` / `RERUN_NEEDS_INPUT` / IssueCodes (w78) | Ported, merged with t262's `unrepeat` check |
| t194 `unusable-decision.ts`, `decision-refusal.ts`, `tests/unusable-decision.test.ts` (w78) | Ported (test hunk compacted, see below) |
| t194 `brief.ts` w78 header paragraph and READ_STEPS step 3 | Ported |
| t194 `brief.ts` w72 header rewrite, READ_STEPS/ACT_STEPS step 5, `NOT_RUN_LINES` | Not ported: w72 (never port) |
| t194 `tests/brief-rerun-carried.test.ts` | Not ported: w72 only. The file is unchanged |
| t194 `reauthor.ts` (`try` field) | Not ported: not w78 (a separate repair-attempt record unit). The file is unchanged |
| t194 `tests/brief.test.ts` (w78 case) | Ported |
| t193 `evidence-loop-decision.ts` bind sentence and doc comment; `evidence_tool_decision` pin | Ported |
| t193 `loop_verification_build_test` pin; `evidence-loop/tests/authored-draft.test.ts` (+2 bind assertions) | Not ported: not owned (see Open questions) |

## Commands run and observed results

From `packages/fluxiq` unless noted.

**Focused run after the guard port.** `npx vitest run --minWorkers=1 --maxWorkers=4 <repeat-guard, evidence-loop/tests/repeat-guard.test.ts, unchanged-complete.test.ts, llm/node-tools>` printed `Test Files 29 passed (29)`, `Tests 272 passed (272)`.

**The brief's set:**
```
npx vitest run --minWorkers=1 --maxWorkers=4 src/programs/automation-studio/runtime/llm src/programs/automation-studio/runtime/flow-bootstrap src/programs/automation-studio/runtime/flow-draft src/programs/automation-studio/runtime/recovery src/programs/automation-studio/runtime/tests/service-authoring/tests src/programs/automation-studio/runtime/tests/service-bootstrap/tests src/programs/automation-studio/runtime/tests/deepseek-bootstrap src/programs/automation-studio/runtime/tests/refuted-result
```
It printed `Test Files 337 passed (337)`, `Tests 3630 passed (3630)` and `Duration 158.29s`, exit 0.

**Re-run of the compacted test file.** I compacted `unusable-decision.test.ts` while that run was going, so I re-ran it with `llm/deepseek/tests` (the prompt pins): `Test Files 10 passed (10)`, `Tests 171 passed (171)`, exit 0.

**Structure audit, from the Core root.** `node scripts/build-cache/cli.mjs structure-audit:check`:
- **First run, exit 1:** `FAIL [file-lines] ... llm/tests/unusable-decision.test.ts: 804 lines exceeds the 800-line limit`. The lane's 4 cases took the file from 756 to 804 lines.
- **The fix:** I compacted the hunk's 5-line import into 1 line and its 6-line comment into 3 lines. The file is now 797 lines.
- **Rerun:** `structure-audit: passed (251 warning(s), 349 baselined).`, exit 0.

**Other Core checks, from the Core root:**
- `node scripts/build-cache/cli.mjs fluxiq:check`: exit 0.
- `pnpm.cmd build`: exit 0, ending at the `web:build` step.

**Downstream checks:**
- `pnpm.cmd --filter @fluxiq-web-extension/domain check`: exit 0, after "core-build: ... is current with its source."
- `pnpm.cmd --filter @fluxiq-web-extension/extension check`: exit 0.

**Line endings.** Checked with node: 0 files with CR among all the files I touched.

**Line counts:**

| File | Lines |
| --- | --- |
| `evidence-loop.ts` | 796 |
| `evidence-loop-decision.ts` | 668 |
| `repeat-guard/outcomes.ts` | 257 |
| `unusable-decision.test.ts` | 797 |

**`git status --short`.** Compared with the status saved before I started, it adds only my owned files:
- 16 modified;
- `repeat-guard/draft-key.ts` and `repeat-guard/tests/feedback.test.ts` new.

## Not verified

- I did not watch the ported tests fail on this tree before the port. The lane reports record their failing-first runs, and my one new feedback case asserts text the base did not have.
- No live run, Lab, browser or provider call. So it is not shown that:
  - the model changes the draft after a `same_draft` refusal;
  - the model gives the rerun an input;
  - the model follows Core's read account over the advice.
- I did not check whether a detect on a real page reports `stateDigests` equal to the failed read's page. w79's lift needs that, and lane C also left it unverified.

## Open questions or contradictions found

- **Lane B's two `authored-draft.test.ts` assertions** (`R/llm/evidence-loop/tests/authored-draft.test.ts`, not owned) are still unported. The instruction now carries the sentence, so adding them would pass:
  - `expect(policy).toContain("only a value a step typed, or a read's condition, is bound");`
  - `expect(policy).toContain("a press's control or option is never bound");`
- **`llm/tests/unusable-decision.test.ts` sits at 797 of 800 lines.** The cleaner home for the 4 rerun-needs-input cases is their own file, `R/llm/evidence-loop/tests/rerun-needs-input.test.ts`, which is where lane C first wrote them. Moving them needs a brief that owns that path.
- **Behaviour changes inherited from w46, as lane D noted them:**
  - A part run that only reads and checks no longer moves `mutationEpoch`.
  - A completion refused again over the same draft now counts toward the 3-in-a-row repeat stall.
  - The brief's test set holds `unchanged-complete.test.ts`, which pins this, and nothing else in that set depended on the old bound.
