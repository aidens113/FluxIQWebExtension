# Loop refused when written: the cap remedies removed and the colon fixed; the write-time refusal is blocked

Core paths are relative to `C:/Users/osrs_/FluxStuff/fxwork/t885/!FluxIQ/packages/fluxiq/src`.

## Outcome

**Partial.**

- Brief items 2 (remove the cap remedy) and 3 (the colon in the column reader) are done and tested.
- Item 1 (refuse a while-loop with no ending when the model writes it) is **not done**. Its refusal cannot reach the model without editing files outside my owned paths, and one of them is on the must-not-touch list (answer-first). The brief says to stop and say so. The exact files and design are under "Open questions".

## What changed and why

**Item 2: no cap is offered as a remedy, and the guidance says what ends a while-loop.**

- `runtime/flow-authoring/draft/amendment/schema.ts`. This is the model-facing amend_draft schema.
  - `change`, for `repeat`: "with while, again until its last step answers ended". It adds that a while-loop ends only when its last step answers ended because there is nothing more. That step must be one whose node can answer ended (its description says so). A step that cannot, such as a plain press, would end the loop only by failing, and that repeat is refused.
  - The list-that-continues sentence now says the step that moves the list on "answers ended when there is no more". A new generic sentence covers a list that grows in place: load it whole first by repeating the moving-on step with while naming itself, then read once. This matches `draft-routing.ts`'s existing script wording.
  - `while`: "must be a step that answers ended when there is nothing more; the span runs, then again until that step answers ended".
  - `most`: "default 50" is gone. It now reads: "only when the person's instruction itself gives a number: with while, that many passes at most, 1 to 500; over a listing, only its first this many rows ... Leave it out otherwise: a while-loop ends when its last step answers ended, and a repeat over a listing acts on every row it kept."
- `runtime/flow-authoring/bootstrap/authoring/draft-routing.ts`.
  - The draft refusal `flow_draft.repeat_while_never_ends` (about :609) no longer says "or send amend_draft repeat ... with most set to the passes it should take". It says a loop ends when its last step answers ended. It tells the model to run the step that answers ended, with add true, as the span's last step, and to send the repeat again with while naming it, or to take the repeat off with `unrepeat`.
  - The script refusal `flow_script.repeat_while_never_ends` (about :360) no longer says "or add `repeat most: <passes>` to bound it". It says to end the span with a step that answers ended and to write `repeat while:` naming it, or to take the repeat off.
  - Both refusals now name the library's ending nodes, read from the registry. These are the definitions whose outputs declare a `branch` port `ended`, given by id and label, for example `(in this library: web.output.dom-next_page, "Next Page")`. Core names no domain node by hand.
  - That reading lives in a **new directory**, `bootstrap/authoring/loop-ending/`: `nodes-said.ts` exports `automationStudioFlowLoopEndingNodesSaid`, and `index.ts` is its barrel.
    - Why a new directory: `draft-routing.ts` was already at exactly 800 lines at `HEAD`. Inline, it went to 826, and `structure:check` failed on `[file-lines]`.
    - A new file beside it then failed `[directory-files]`: 26 source files, over the 25 limit.
    - This split of my own owned file is the only path the audit leaves. It is a new path, not one another worker owns.
  - The script grammar's `HOW` sentence now says "again until that step answers ended".
  - The `repeatWhile` doc comment now says the loop ends at `ended` or at a `most` the person gave. Why `most` is never the way out is recorded in the header of `loop-ending/nodes-said.ts`. `draft-routing.ts` is back to 800 lines.
  - Behaviour is unchanged. A while-loop with no ending and no `most` is still refused at assembly. One with `most` (a count the person gave) still assembles.

**Item 3: the column reader stops at a colon.**

- `runtime/flow-authoring/bootstrap/answerability/instruction-columns.ts`:
  - When an item contains ":", the item is the text before the colon, and the list ends with it.
  - A colon that opens the list ("columns: a, b and c") leaves nothing before it, so it ends nothing. The leading-punctuation strip runs first.
  - In `cutShort`, each leading-words candidate is trimmed of trailing non-alphanumerics, and duplicates are skipped.
  - The header records the cause (run `run-mwblz4aq-0baa810a`).
  - Result: "columns author, comment and date: author is ..." gives `["author","comment","date"]`.

**Tests**, each in the `tests/` folder beside its subject:

- `draft/amendment/tests/apply.test.ts`:
  - The pinned schema assertions are updated: "default 50" and "with while, the most passes" are replaced, and the continuing-list sentence is updated.
  - New describe, "what the schema says ends a while-loop". It checks the ended wording. It also checks that no schema property description matches `/default 50|\bdefault\b[^.]*\bpasses\b|most set to|to bound it/`.
- `bootstrap/authoring/tests/draft-routing.test.ts`: the existing "refuses a loop whose last step has no way to end it" test now also checks the message. It must contain the ended sentence, `(in this library: web.output.dom-next_page, "Next Page")` and `amend_draft unrepeat on step 2`, and it must not match `/most set to|with most|add `?repeat most/`.
- `bootstrap/authoring/tests/candidate-loops.test.ts`: the script refusal's message names the ending node and does not match `/repeat most|to bound it/`.
- `bootstrap/answerability/tests/instruction-columns.test.ts`: a new describe, "a colon after a listed column", with four cases:
  - author/comment/date, with no `cutShort`;
  - a colon after a middle item ends the list;
  - "Use these columns: author, comment and date." still reads all three;
  - a run-on item offers "date", not "date -".

## Commands run and observed results

All were run through `node C:/Users/osrs_/FluxStuff/fxwork/.tools/heavy-slot.mjs run t885 -- ...` from `packages/fluxiq` (the structure check ran from the Core root).

- `npx vitest run src/runtime/flow-authoring/draft/amendment/tests src/runtime/flow-authoring/bootstrap/authoring/tests src/runtime/flow-authoring/bootstrap/answerability/tests` gave `Test Files 34 passed (34)`, `Tests 385 passed (385)`, exit 0. It ran twice: before and after the final `HOW` wording change.
- **Fix reverted:**
  - I swapped `instruction-columns.ts`, `schema.ts` and `draft-routing.ts` for their `HEAD` versions (`git show HEAD:<file> > <file>`, read-only git). Then I ran vitest on `apply.test.ts`, `draft-routing.test.ts`, `candidate-loops.test.ts` and `instruction-columns.test.ts`.
  - Result: `Test Files 4 failed (4)`, `Tests 9 failed | 113 passed (122)`, exit 1.
  - The 9 failures are exactly the new or updated assertions: 3 colon cases, 2 pinned-schema tests, 2 "what ends a while-loop" tests, and the two refusal-message tests.
  - I then restored my versions from scratch copies and confirmed that `git diff --stat` shows my changes again.
  - For several minutes, while the run waited for a slot, those three files held their `HEAD` content in the shared t885 tree.
- **Final run**, after the `loop-ending/` split:
  - The same vitest command gave `Test Files 34 passed (34)`, `Tests 385 passed (385)`, exit 0.
  - `pnpm --filter fluxiq check` (through heavy-slot) gave `{"build-cache":"build","step":"fluxiq:check","reason":"inputs changed: packages/fluxiq; ...","ms":121959}`, exit 0. This was a real tsc run, not a cache reuse. It also covered the parallel answer-first worker's uncommitted edits in the same tree.
- **`pnpm structure:check`**, run directly from the Core root because it is an audit script, not tsc or a test suite:
  - It first failed: `FAIL [file-lines] .../authoring/draft-routing.ts: 826 lines exceeds the 800-line limit`.
  - Then: `FAIL [directory-files] .../authoring/: 26 source files exceeds the 25-file limit`.
  - After the `loop-ending/` split: `structure-audit: passed (531 warning(s), 969 baselined)`, exit 0.

## Not verified

- No Lab or live run (the brief forbids them). I did not check whether a model given the new wording writes a loop on an ending node.
- Item 1 is not implemented, so nothing refuses the repeat when it is written. The model still learns of a click while-loop only at assembly. Under answer-first, that is still after the result (fixes 6 and 7 in the trace report).

## Open questions or contradictions found

**1. Item 1 needs files outside my owned paths, one of them must-not-touch.** A new refusal reason, here called `loop_cannot_end`, has to pass through closed, exhaustive-by-type sets, and the registry has to reach the decision handler:

| File | What it needs |
| --- | --- |
| `runtime/flow-authoring/draft/amendment/types.ts` | Add the reason to the union. Add an `endings?: { id: string; label: string }[]` field. Add the option type, for example `AutomationStudioFlowDraftLoopEndings = (step) => { ends: boolean; nodes: {id,label}[] }`. |
| `runtime/llm/draft-amendment-feedback/refusal-reasons.ts` | Add the reason's sentence (`Record<reason,string>`, which does not compile without it). |
| `runtime/llm/draft-amendment-feedback/fallback.ts` | Add the reason's way out (exhaustive `Record`). |
| `runtime/llm/draft-amendment-feedback/feedback.ts` | Carry `endings` onto the refused entry, so the model sees the node ids. |
| `runtime/flow-authoring/bootstrap/evidence-loop-steps.ts` (:190-210) | Add the reason to the allowed-reasons map. |
| `ui/activity-action/refusal-words.ts` | Add the chat words (exhaustive). |
| `runtime/llm/loop-configuration.ts` (`draft`, beside `claimRefused` at :384) | Add a `loopEndings` callback. The handler context has `context.input.definitionOf(step.actionId)` for the last step's definition, but nothing that can list the registry. |
| `runtime/llm/harness-options/draft-acts.ts` | Build `loopEndings` from the registry and resolution it already receives. |
| `runtime/llm/evidence-loop/held-amendments.ts` (:58, :102) | Pass the option on for held amendments. |
| `framework/automation-service/service/answer-first/attempt/round.ts:110` (**must-not-touch**) and `framework/automation-service/service.ts` | Pass `loopEndings: acts.loopEndings` beside `claimRefused`. Without this, answer-first runs (where the bug happened) never get the check. |

My owned files would then take this:

- `apply.ts`: in the `ROUTING_CHANGES` branch, after `routed.ok`, call `options.loopEndings`. When it does, a repeat-while with no `most` whose last step has no ending is taken back and refused, the way `automationStudioFlowDraftSettleWrittenRepeats` takes one back.
- `amendment.ts`: pass `loopEndings` at :98 and :254.

The registry-backed naming already exists in `bootstrap/authoring/loop-ending/nodes-said.ts`, as a sentence fragment. Item 1 needs the list form, as its own exported file in that directory.

Two smaller points:

- **A design choice to confirm.** I would refuse at write time only when there is no ending and no `most`, which is consistent with assembly. A `most` is then trusted as the person's count, which the schema now tells the model. Refusing even with `most` would block "do it N times" loops that the person asked for.
- **Precedent.** `apply.ts:44-53` once borrowed an existing reason, because the feedback files were held by other work. That does not fit here. No existing reason's sentence is true of this refusal, and none can carry the ending nodes, so a borrowed reason would mislead the model.

**2. Cap remedies remain outside my paths**, against the goal "remove every cap remedy":

- `runtime/flow-authoring/bootstrap/plan/flow-script-format.ts:350-351`, the script format guidance: "...or after `repeat most: <passes>`; a last step that cannot answer ended needs repeat most", and "`repeat while: next` then `repeat most: 20`".
- `runtime/flow-authoring/bootstrap/authoring/draft-bindings.ts:236`: "...`repeat while:` with a last step that answers ended or a `repeat most:`".
- `runtime/flow-authoring/draft/entry.ts:82` and `:89`: "A list that continues: repeat on the read with while naming the step that moves it on". This offers no cap, but it does not say that the step must answer ended.
- `draft/amendment/types.ts:42`: the `most` doc comment still says "the Repeat node's default when absent". This is a code comment, not model text.

**3. The reader's `MAX_COLUMNS = 12`** in `instruction-columns.ts` is a bound on names, which I left alone. It is outside this brief's cause.
