# t194-w44: "the instruction asks for a column X that no field reads", told to the building model and the judge

## Outcome

Done. The fact is now told as information in three places, and is never a refusal:

- **The building model.** It appears beside the draft on every decision after the list read.
- **The accepted completion verdict.** The warning is kept there instead of dropped.
- **The judge.** It appears in the result summary the judge is shown.

**The build-side file I chose is `runtime/llm/harness-options/draft-acts.ts`, not a node-tool result file.** No node-tool result path in Core has the instruction text. The run_node result is the domain's own packet. It reaches the model through the `executeTool` chain that `service.ts` builds, and the loop renders it in `evidence-loop.ts`; both files are must-not-touch. The draft entry's `acts` (from `draft-acts.ts`, wired in `service.ts` line 1583) is the one Core channel that holds both the instruction and the read's fields. It is in front of the model on the very next decision after the read.

**Two files outside the Owns list were edited:**
- `draft-acts.ts`: the file named above, as the brief allowed.
- `flow-bootstrap/authoring/index.ts`: one barrel export line plus a comment. Without it, neither the build side nor the judge side can reach F35's matcher: the structure audit fails any import that bypasses a barrel, and the barrel deliberately did not export `instruction-record-columns.ts`.

## What changed and why

All paths below are in Core, under `packages/fluxiq/src/programs/automation-studio/runtime/`.

- **`flow-bootstrap/authoring/instruction-record-columns.ts`**
  - New function `automationStudioFlowBootstrapUnreadColumnsSentence({instructionText, fieldKeys, reader?})`.
  - It uses the existing parser (`answerability/instruction-columns.ts`) and F35's own `authoringInstructionRecordColumns`. There is no second matcher.
  - It returns `The instruction asks for a column "rating" that no field of step 3 reads.`. For more than one name: `columns "price", "rating"`. With no `reader`: `... that no field reads.`.
  - It returns nothing when the instruction names no column, there are no field keys, or every named column is read.
  - The names come only from the instruction.
- **`flow-bootstrap/authoring/index.ts`**: exports only that one function, and the comment says why.
- **`llm/harness-options/draft-acts.ts`** (build side)
  - `acts(steps)` now appends one `{note: <sentence>}` per draft read whose fields miss a named column. The step is named by its draft position.
  - Steps that qualify: run_node steps that are proposable (not a look, not failed) and not withdrawn (`dropped`/`exploratory`).
  - Field keys are read the way normalise.ts `columnNames` reads them: `fields`/`columns` on a parameter object, or on the parameters themselves. This is a small private reader. normalise.ts is not mine, so its private `columnNames` was not shared.
  - The note has no id. `actsMissing` never counts it, so stall redirects and authored progress are unchanged. The completion check never reads it.
  - With no acts and no notes the value stays `undefined`. Byte cost is one sentence per affected read; nothing otherwise.
- **`llm/harness-options/bootstrap-completion.ts`**
  - The ok verdict now carries `warnings?: AutomationStudioFlowBootstrapIssue[]`, which are the accepted plan's warning-severity issues. This includes `record_output.named_column_unmatched`.
  - **`warnings` deliberately sits beside `check`, not inside it.** `automationStudioLlmEvidenceParseCompletionCheck` (`llm/evidence-loop-decision.ts:413`) accepts an ok check only with exactly the keys `ok`, `answerability` and `restoredStep`. One more key would turn every accepted completion into `llm_evidence_loop.invalid_decision`.
  - `service.ts:1572` already keeps the ok verdict as `accepted.verdict`, so the warning is now on the accepted record. Nothing yet writes it to the trace (see open questions).
- **`result-verification/read-account/unread-columns.ts`** (new; exported from `read-account/index.ts`)
  - `automationStudioResultSummaryWithUnreadColumns(summary, instructions)` builds the instruction text exactly as the build does (`title\nbody`, joined by `\n`).
  - It matches the named columns against the union of the stored record sets' `columns`, using the same sentence with no reader.
  - It sets the new optional summary field `instructionColumnsUnread`.
  - It leaves the summary unchanged when nothing is unread, nothing is stored, or any set's `columnsWithheld` is true, since a cut column list cannot say what is absent.
- **`result-verification/contracts.ts`**: adds `instructionColumnsUnread?: string` to `AutomationStudioRunResultSummary`, with a doc comment.
- **`result-verification/verify.ts`**
  - The judge's harness call now sends `resultSummary: automationStudioResultSummaryWithUnreadColumns(request.summary, request.instructions)`.
  - The summary stored on the run and handed to the repair (`run-outcome.ts` `withResult`) is unchanged.
  - The summary is sent whole: `sendableResultSummary` checks only credentials, denied keys in sampled rows and size, and nothing whitelists summary keys.
- **Tests**
  - `flow-bootstrap/authoring/tests/instruction-record-columns.test.ts`: two new cases, for the sentence and for its silence.
  - `llm/harness-options/tests/draft-acts.test.ts` (new): the note reaches `automationStudioFlowDraftEntry`. It names several columns once. It is silent when every named column is read, the instruction names none, there is no instruction text, or the read was dropped. `actsMissing` is unaffected.
  - `llm/harness-options/tests/bootstrap-completion.test.ts`: the accepted verdict carries the warning; the check's keys stay exactly `ok` and `answerability` and it parses as ok; there are no warnings when all named columns are read or none are named.
  - `result-verification/read-account/tests/unread-columns.test.ts` (new): unit tests.
  - `result-verification/tests/judge-sees-the-read.test.ts`: end to end. The provider's `loop_verification` request carries `instructionColumnsUnread` for the unread "seller", and does not carry it when all named columns are read or none are named.

## Commands run and observed results

All Vitest runs were made from `!FluxIQ/packages/fluxiq`.

- `npx vitest run src/.../runtime/result-verification src/.../runtime/llm/harness-options src/.../runtime/flow-bootstrap/authoring` -> `Test Files 36 passed (36)`, `Tests 370 passed (370)`. It was run before the old-source check and again after restoring.
- **Tests against the old source.** HEAD's versions of the 7 changed source files were written in with `git show HEAD:<path> > <path>`, and the new `unread-columns.ts` was moved to the scratchpad. My files had been backed up to the scratchpad first. The 5 affected test files were then run -> `Test Files 5 failed (5)`, `Tests 6 failed | 42 passed (48)`.
  - Every new positive test failed. The assertion failures were: `expected [] to deeply equal [ Array(1) ]` (draft-acts, twice); `expected undefined to deeply equal [ ObjectContaining{…} ]` (completion warnings); `expected undefined to be 'The instruction asks for a column "se…'` (judge).
  - The sentence tests and `unread-columns.test.ts` failed because the function did not exist.
  - The silence-only cases passed on old source, which they must by construction.
  - The files were then restored from the backup, and `git status` shows only my changes.
- Neighbouring consumers: `npx vitest run .../llm/tests/deepseek-evidence-preflight.test.ts .../service/runtime-adaptation/tests/refuted-result-port.test.ts .../tests/refuted-result .../tests/service-adaptation/tests/retry-result-verification.test.ts .../flow-draft .../recovery/refuted-result` -> `Test Files 22 passed (22)`, `Tests 178 passed (178)`.
- `bash C:/Users/osrs_/FluxStuff/build-slots/heavy.sh "t194-w44 core check" pnpm check` -> `EXIT 0`, `"step":"fluxiq:check","reason":"inputs changed: packages/fluxiq; stored..."`.
- `node scripts/structure-audit.mjs` (Core root) -> `structure-audit: passed (211 warning(s), 349 baselined)` and `1 baseline entries can be lowered`. These are the same counts w43 reported, so I did not touch the lowerable entry.
  - Advisory only: `bootstrap-completion.ts: 468 lines` is past the 400-line threshold. That warning existed before; the file grew by 13 lines.
- `npx biome lint <changed files>` -> `No files were processed`: biome's config ignores these paths, so there is no lint signal.

## Not verified

- No live build, Lab run or model call.
- Whether a real model reads a `{note}` item inside `acts` as information rather than as an act it still owes. The note has no id or `done`/`todo`, and `actsMissing` ignores it. But `flow-draft/entry.ts`'s AUTHORED_INSTRUCTION says "The Flow is ready only when every act shows done" and does not mention notes. I did not edit it, because it is not mine.
- The real downstream run_node parameter shape for `extract_list`. I assumed `{extractList: {handle, fields: {...}}}`, as in the Core tests. Field keys are found at either nesting level.
- Nothing downstream was run.

## Open questions or contradictions found

1. **A cleaner build-side home is outside this brief.**
   - Option A: a per-step `note` on the draft line in `flow-draft/entry.ts`. That would need the instruction to reach the loop's draft input through `evidence-loop.ts` and `service.ts`.
   - Option B: a `service.ts` wrapper on `executeTool` that appends the sentence to the run_node result itself.
   - Either is the literal "where the model sees the result of its own read". I used the acts channel because it needs neither forbidden file.
2. **Nothing persists `verdict.warnings` yet.** `service.ts` holds it as `accepted.verdict.warnings`, but no build trace or record writes it. Writing it is a `service.ts` change, lane B's or the supervisor's. The structural constraint is that it can never go on the loop's `check`, which is parsed by exact keys.
3. **The repair is not told.** The repair is handed the stored summary (`run-outcome.ts` `withResult`), which does not carry `instructionColumnsUnread`. Only the judge sees it, plus whatever the judge writes in `observed`/`changed`. If the repair should see it too, set it in `run-outcome.ts` after `flowInstructionSet` is read. That is within `result-verification/**`, but the brief scoped this task to the judge.
4. **The judge instruction does not name the new field.** `AUTOMATION_STUDIO_RESULT_VERIFICATION_INSTRUCTION` (`llm/diagnosis-instructions.ts`) does not mention `resultSummary.instructionColumnsUnread`. The sentence explains itself, so I left the instruction alone: it is not my file, and every byte is paid on every call.
