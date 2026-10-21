# t752 unit B: working rows are never the answer

Worker report. Core tree `C:/Users/osrs_/FluxStuff/fxwork/t752/!FluxIQ`, branch
`task/t752-judge-consistency-and-read-speed`. R = `packages/fluxiq/src/programs/automation-studio/runtime`.

## Outcome

Done within my owned paths. Two changes outside them would finish the job; they are under "Open questions" (item 4 of the brief).

## What changed and why

**The fact (graph level): `R/result-verification/read-account/working-rows.ts`** (new, one export
`automationStudioResultReadWorkingRows`). It flags a read (the source) when:
- a For Each loop takes its rows from that read, through the graph's edge into the loop's `items` port (the same link t692 uses);
- a step of that loop succeeded in the same frame after the source read spoke;
- and a later read in the same frame, not itself a step of the loop, ran after that step and reads the same target.

Conditions, row counts and whether the repeated step lasts are all ignored, so a display-only press counts. The flag is
`workingRows: { rereadBy, repeatedBy, sameList: "items_edge_and_read_target", said }`. Its type
`AutomationStudioResultWorkingRows` is in `contracts/read-account.ts`. `accounts.ts` attaches it whenever the caller passes
`flowEdges`, the same condition as `keptEveryRow`. `sentence.ts` says it in full length, and the judge also sees it on
`reads[].workingRows.said`, a self-explaining generic sentence.

**Shared target comparison: `read-account/same-target.ts`** (new, one export `automationStudioResultReadSameTarget`). This is
the comparison `kept-every-row.ts` already used, moved out so both flags decide "one target" the same way. `kept-every-row.ts`
now imports it, and no copy is left behind.

**The rule (summary level): `read-account/working-sets.ts`** (new, one export `automationStudioResultReadWorkingSets(summary)`).
A record set is working rows when:
- every collector its `processing.passes[].node` names carries `workingRows`;
- and each flag's `rereadBy` collected a record set that is not working rows, either directly or through a chain of flagged reads, so an answer exists.

A set that names no collector is never working rows, and neither is a set a flagged read shares with any other read. I put
it in `read-account/` rather than `request-rows/` only because `request-rows/` sat at the 25-file limit. `request-rows/`
imports it as a leaf, never through the barrel, to avoid the known module cycle.

**Where the rule is applied:**
- `request-rows/summary-reads.ts`: working sets are dropped exactly as subflow-entry sets are. Their rows are not `stored`, not `inResult`, and their processing conditions do not join. `automationStudioRequestRowsStoredBy` now takes `Pick<summary, "reads" | "recordSets">` and skips working sets itself, so a working set is never a holder. The only callers were `summary-reads.ts`, `summary-with-also-in-result.ts` and two test call sites; all are updated.
- `request-rows/summary-with-also-in-result.ts`: no `storedThoughLeftOut`/`storedAnyway` and no `leftOutAlsoInResult` for a row only working rows hold. The code path is unchanged; it gets this through the rule above. Header updated.
- `request-rows/unquoted-rows.ts`: no `stored` hold for those rows, which follows from `storedElsewhere`. `automationStudioResultKeptEveryRowFlagged` also skips working sets.
- `request-rows/kept-without-asked-column.ts`: working sets are skipped, because they are not rows the result keeps.
- `checked-rows.ts` ("also in the result" / "is in the result"), `kept-not-naming-the-item.ts`, `left-out-stating-a-kept-number.ts` and `unaccounted-rows.ts` read `stored`/`inResult` from `summary-reads.ts`, so they follow without edits.

**Judge-facing sentences in my files.**
- `storedAnyway` ("each is a row of the result ... the answer is no") and `ALSO_IN_RESULT` ("another copy of the same item was kept") are now produced only over sets that are not working rows, so their wording still holds. I left the wording unchanged.
- The new `workingRows.said` tells the judge that the source read's rows are working rows and that the answer is what the later read stored.

**t691 is unchanged.** In the library case (renew the overdue loans, then a last read that also stores loans never renewed),
the act read is now flagged as working rows when Core sees the loop. The holder of its left-out rows is still the last read,
which is not working rows, so `storedThoughLeftOut` and the `stored` hold are unchanged. Tests cover this with and without
the flag.

**Behaviour note.** A row the later read's condition left out, held only by a working set, is now an ordinary left-out row.
The t515 rule still applies to it: settled rows need one quote of the bound beside the condition, and unsettled rows need a
quote each. A yes naming only the answer rows passes only when that holds. Before, these rows were held twice: once as
`stored` and once by the left-out rule.

**Header comments** in every touched module record the cause in generic words: a list read with no condition, a display-only
press repeated over its rows, and a conditioned re-read that stores the answer.

**Tests (made-up recipe archive and library fixtures):**
- `read-account/tests/working-rows.test.ts` (new): the flag, its sentence, no locator leak, and the cases that must not flag: no edges, no items edge, another target, the later read running first, a failed press, a skipped press.
- `read-account/tests/working-sets.test.ts` (new): the rule, chains, the cases that must not count (unflagged, shared, no collector, no answer set, cycle), and t691's loans with the flag.
- `request-rows/tests/stored-though-left-out.test.ts` (extended, with the fixture inline to keep `request-rows/tests/` at 25 files):
  - not counted as the result;
  - no `storedThoughLeftOut` or `leftOutAlsoInResult`;
  - a yes naming only the answer rows with one bound quote gives `[]`, and the same summary without the flag still gives the `stored` hold;
  - the bound quote is still owed;
  - `kept-without-asked-column` skips working sets;
  - t691 with the flag is still marked and still held.

## Commands run and observed results

All Core commands ran from `packages/fluxiq` unless noted.

1. Tests first, before the change, with only a placeholder rule that returned an empty set:
   `pnpm exec vitest run .../request-rows/tests/working-sets.test.ts .../read-account/tests/working-rows.test.ts`
   -> `Test Files 2 failed (2)`, `Tests 8 failed | 5 passed (13)`. Sample failures:
   - `expected undefined to deeply equal { rereadBy: 's6', …(3) }`
   - `expected { number: 1, …(8) } to not have property "storedThoughLeftOut"`
   - `expected [ { …(4) } ] to deeply equal []`

   The 5 that passed were the cases that must not flag, plus t691's shape.
2. After the change: the same two files -> `Tests 13 passed (13)`.
3. The structure audit failed after step 2 (`request-rows/` 26 files and `request-rows/tests/` 27 files, over the 25 limit), so I moved and folded files as described above. To re-show tests-first on the restructured files, I blanked the rule temporarily:
   `vitest run read-account/tests/working-sets.test.ts request-rows/tests/stored-though-left-out.test.ts` -> `Tests 8 failed | 15 passed (23)`.
   After restoring it, the same files plus `working-rows.test.ts` -> `Tests 27 passed (27)`.
4. `pnpm exec vitest run src/programs/automation-studio/runtime/result-verification` -> `Test Files 135 passed (135)`, `Tests 1130 passed (1130)`.
5. `pnpm exec tsc --noEmit -p .` -> no output, exit 0.
6. `pnpm exec vitest run src/programs/automation-studio/runtime/llm/deepseek/tests/system-prompt.test.ts src/programs/automation-studio/runtime/flow-bootstrap/plan/tests/extraction-vocabulary.test.ts src/programs/automation-studio/runtime/flow-bootstrap/plan/tests/issue-feedback.test.ts` -> `Test Files 3 passed (3)`, `Tests 64 passed (64)`.
7. At the Core root, `node scripts/structure-audit.mjs` -> `structure-audit: passed (439 warning(s), 1152 baselined).`, exit 0. The owned directories now sit at `read-account/` 25, `read-account/tests/` 20, `request-rows/` 25 and `request-rows/tests/` 25; the audit shows only advisory warnings for them.

## Not verified

- No live run and no replay of the round-5 trace. I could not confirm that the real run's two reads collected **separate** record sets with `processing.passes` naming each read. The round-5 symptom (`storedThoughLeftOut` naming the source read) implies they did.
- If both reads append into **one** shared dataset, the summary cannot attribute rows to a read, and the rule deliberately does nothing. Those rows would then fall to `leftOutAlsoInResult` ("another copy ... kept"), which is the t624 behaviour. That case needs per-row attribution at capture, for example the existing `recordOutput.purpose: "intermediate"`, which is outside my files.
- `result-summary.ts` passes `flowEdges` through to `automationStudioResultReadAccounts`; I relied on this because `keptEveryRow` depends on the same path. I did not trace every caller (trial, subflow trial, finished run) to confirm each passes edges.
- Builder trial feedback (`service/candidate-trial/feedback.ts`) may now carry `workingRows` on reads. I did not check how it renders there.

## Open questions or contradictions found

1. **"another copy of it was kept" / "Core's record contradicts" (brief item 4), outside my files.**
   - **Source:** in `R/result-verification/refuted-no/record.ts`, `automationStudioResultNoRecord` builds its stored rows from **every** record set, at line ~110: `const stored = summary.recordSets.flatMap(...)`. Its `leftOut` comes from `automationStudioRequestRowsReads`, which now leaves working sets out.
   - **Effect:** a row only a working set holds counts as a stored row. A no saying the later read's condition left it out is refuted by `R/result-verification/refuted-no/missing-claim.ts` `storedFinding`, line ~153, as `"<label>" is in the stored rows: another copy of it was kept.`. The refutation then reaches the gate as "Core's record contradicts ..." (`R/flow-bootstrap/candidate/trial-gate.ts` ~276-295, `R/flow-bootstrap/candidate/unchanged-submission.ts` ~199-203).
   - **Change needed:** in `record.ts`, import the leaf `../read-account/working-sets.ts` and build `stored` from `summary.recordSets.filter((set) => !automationStudioResultReadWorkingSets(summary).has(set.datasetId))`. `labelTested` and `valuesOf` then read the same filtered rows. No change is needed in `missing-claim.ts` or `trial-gate.ts`; they follow from the record.
2. **Judge instruction, `R/llm/diagnosis-instructions.ts`** (`AUTOMATION_STUDIO_RESULT_VERIFICATION_INSTRUCTION`).
   - **Problem:** it says "Each record set holds the run's answer" and does not describe `reads[].workingRows`.
   - **Suggested change:** add something like: "resultSummary.reads[].workingRows, where present, is Core's flag on a read whose kept rows a step was repeated over before the read named in rereadBy read the same list again: its rows are working rows, a record set only such reads collected is not the answer, and the answer is judged by the rereadBy read's rows." Also change "Each record set holds the run's answer" to "Each record set, except one only a read with workingRows collected, holds the run's answer".
   - **Then run:** the `system-prompt.test.ts` pins, since this text is a prompt.
3. **An earlier guard comment in `stored-though-left-out.test.ts`** (commit aa04a943, t567) says "Ownership must change at capture, never by teaching this matcher to ignore a stored answer based on a helper name or the downstream acts."
   - **Why I think this does not conflict:** the rule uses no name. It uses Core's recorded graph (the items edge plus the same read target) and the run's attempts. The answer read's set is never set aside, and that test still passes unchanged.
   - **Still to decide:** the supervisor may prefer marking working rows at capture instead, as `purpose: "intermediate"` does. That is a different design.
