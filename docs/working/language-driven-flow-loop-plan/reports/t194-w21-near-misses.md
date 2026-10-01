# t194-w21: the rows each `where` condition removed by itself (near misses)

## Outcome

Partial. Goal A (the exploring model) is done end to end. Goal B (the judge) is
done up to Core's run record: `conditions.alone` is now admitted onto the
attempt's `metadata.extraction`, from the playback's own counts. The last step,
carrying it on the judge's read account and saying it in the sentence, needs a
one-line type change in
`packages/fluxiq/src/programs/automation-studio/runtime/result-verification/contracts.ts`
(`AutomationStudioResultReadAccount.conditions`). That file is outside the
brief's paths, so I stopped there and did not edit `read-account/**`.

## What changed and why

**What "alone" means.** A condition removed an item alone when that item failed
this condition and every other condition held of it, so `rejectedBy.length === 1`
in `item-filter.ts`. Those are the rows that show whether the condition is
right. On `run-mup2u8o3-6697c4be`, where[4] rejected 20 rows and removed 5 alone:
2 accessories and the 3 true earbuds.

Extension (`apps/extension/src`):
- `content/extraction/list-reader.ts`: counts `aloneEach[i]` for every item one
  condition alone rejected. The count goes on the condition report as
  `conditions.alone`, is carried in the checkpoint's `conditions.alone`, and is
  resumed from it. Every read sends it, a playback included, because it is a
  count. The file now has 799 lines (limit 800): I compacted
  `carriedConditionCounts` to stay under it.
- `content/extraction/rejected-samples.ts`: each condition's list now holds its
  alone rows first, then the rows another condition also rejected. `alone()`
  says how many rows lead each list. Every row is still kept whole. An
  identical row is still said once, and a row first seen beside another
  condition and later seen alone moves to the alone group. Carried lists from a
  page build that did not order them count as "with others".
- `content/extraction/filtered-answer.ts`: adds `alone?: number[]` to
  `ListExtractionConditionReport`.
- `content/actions/extract-list.ts`: the summary carries `conditions.alone`, and
  `rejectedSamplesAlone: number[]` beside `rejectedSamples` (only when samples
  were asked for).
- `shared/extraction-continuation.ts`: the checkpoint carries
  `conditions.alone` and `rejectedSamplesAlone`. Both are validated: one count
  per condition, `alone[i] <= rejected[i]`, and each lead no longer than its
  list. A malformed value refuses the checkpoint.

Domain (`domain/src`):
- `actions/extraction/summary.ts`: admits `conditions.alone` (optional, same
  bounds) and `rejectedSamplesAlone` (only beside `rejectedSamples`). A
  malformed value drops the summary, as every other member does.
- `actions/extraction/rejected-samples.ts`: adds
  `webAutomationExtractionRejectedSamplesAloneValue` and
  `WEB_AUTOMATION_EXTRACT_REJECTED_SAMPLES_ALONE_KEY`.
- `runtime/llm-evidence/node-run/rejected-rows.ts`: the model now sees
  `read.rejectedRows: [{ where, rejected, alone, rowsAlone, rowsWithOthers }]`.
  A page build that did not order its rows gets `{ where, rejected, alone?, rows }`
  as before. When any condition has alone rows, the read also carries
  `rejectedRowsNote` (`WEB_NODE_REJECTED_ROWS_NOTE`), which reads: "In
  rejectedRows, rowsAlone are rows that condition removed by itself (every other
  condition kept them): check each against the instruction, and if any is a row
  the instruction asks for, that condition is wrong and must change;
  rowsWithOthers also failed another condition."
  - **Why the guidance lives in the read.** Nothing in either repository
    describes `rejectedRows` to the model; I grepped domain and Core prompt
    text. This is the only place in my paths where a sentence reaches the model
    beside `rejectedRows`.
  - **Recorded payload.** `rejectedSamplesAlone` is stripped from it together
    with `rejectedSamples`. `conditions.alone` stays, because it is a count.
  - **Structure audit.** Fields are written through `present<T>()` to satisfy
    the audit's `contract-spread` rule.

Core (`packages/fluxiq/src/programs/automation-studio/runtime`):
- `service/summaries/extraction-summary.ts`: `conditionReport` admits optional
  `alone`: one count per condition, never above that condition's `rejected`,
  counts only. A malformed value drops the report, as `seen` does. The line
  endings stay CRLF, as the file had them.

Tests (each in the owner's `tests/` folder):
- extension `content/extraction/tests/rejected-samples.test.ts`:
  - A two-page read in which `where[1]` alone removes "Pro Earbuds Wireless
    Charging Case" on page one and "Ultra Earbuds with Wireless Charging Case"
    on page two. The page-one checkpoint is passed through
    `readExtractionCheckpoint(JSON round trip)` before the second document
    resumes from it.
  - The final counts are `rejected [3,4]` and `alone [1,2]`, with
    `rejectedSamplesAlone [1,2]`. The alone rows lead each list across both
    documents.
  - Also covered: a playback-style read (no samples) still counts `alone [1,1]`,
    and the move-to-alone deduplication.
- extension `shared/tests/extraction-continuation.test.ts`: the carry round
  trip, and the malformed cases being refused.
- extension `content/actions/tests/extract-list-rejected-samples.test.ts`: a
  playback summary has `conditions.alone` and no `rejectedSamplesAlone`. A
  summary that asked for samples has both, and both survive the domain wire
  copy.
- extension `content/extraction/tests/list-reader.test.ts`: four existing
  deep-equals now include `alone`. One resume now carries `alone: [1]` and
  expects `[2]`, which checks that the count is carried.
- domain `actions/extraction/tests/rejected-samples.test.ts`: the summary copy
  admits both members and refuses the malformed ones.
- domain `runtime/llm-evidence/node-run/tests/rejected-rows.test.ts`:
  - The model's `rejectedRows` has `rowsAlone` (the true pair and the
    accessory) apart from `rowsWithOthers`, and the read carries the sentence.
  - The recorded payload has no samples and no leads, and keeps the alone count.
  - The unordered fallback shape still works.
- Core `service/summaries/tests/extraction-summary.test.ts`: `alone` is admitted
  as counts, an absent `alone` still lets the report arrive, and the malformed
  cases are refused.

## Commands run and observed results

- `heavy.sh "t194-w21 domain check" pnpm --filter @fluxiq-web-extension/domain check`
  -> exit 0, no errors. An earlier run failed with a flatMap typing error,
  which I fixed.
- `pnpm --filter @fluxiq-web-extension/domain test` -> stopped at its first
  gate, `core-build.mjs`: "FluxIQ Core's build ... is 42 minute(s) behind its
  source. Stale: ...runtime/llm/loop-budget.ts". That is another worker's Core
  edit. I did not rebuild Core (brief). I ran the suite directly:
  `heavy.sh ... node scripts/test-domain.mjs` (in `domain/`) -> `# tests 1063,
  # pass 1063, # fail 0`. This run came after the final edits.
- `heavy.sh "t194-w21 extension check" pnpm --filter @fluxiq-web-extension/extension check`
  -> exit 0, no errors. This run came after the final edits.
- Extension test, past the same stale-Core gate:
  `heavy.sh ... bash -c "node scripts/smoke-test.mjs && node scripts/test-extension.mjs"`
  (in `apps/extension/`).
  - First run: `# tests 1678, # pass 1673, # fail 5`. These were 4 list-reader
    condition deep-equals and the existing carried-samples ordering test; both
    were stale expectations of the old shape, which I updated.
  - Final run: `# tests 1678, # pass 1678, # fail 0`.
- Core `npx vitest run src/programs/automation-studio/runtime/result-verification src/programs/automation-studio/runtime/service/summaries`
  (from `packages/fluxiq`) -> 195 passed, 1 failed. The failure was a 15 s
  timeout in `run-detail-preservation.test.ts`; that file does not touch my
  change, and it ran while the extension check was loading the machine. I
  re-ran that file with `extraction-summary.test.ts` and got
  `Test Files 2 passed, Tests 24 passed`.
- `npx tsc --noEmit -p packages/fluxiq/tsconfig.json` (Core) -> exit 0.
- `node scripts/structure-audit.mjs`, downstream:
  - First run: 2 violations, both mine. `contract-spread` in `rejected-rows.ts`,
    and `list-reader.ts` at 812 lines against the limit of 800. I fixed both.
  - Final run: "structure-audit: passed (136 warning(s), 119 baselined)", exit 0.
- `node scripts/structure-audit.mjs`, Core -> 1 violation, not mine:
  `packages/fluxiq/src/programs/automation-studio/runtime/service.ts: 4506 lines
  ... Baseline for this entry is 4505`. Another worker is editing that file.

## Not verified

- **Fail-before.** The new tests were not run against the pre-change tree. I
  did not stash or revert. They assert members the old code never produced
  (`conditions.alone`, `rejectedSamplesAlone`, `rowsAlone`,
  `rejectedRowsNote`), and the 5 old-shape failures above show the old shape
  differs. That is an inference, not an observed fail-before run.
- **Extension `test` and domain `test` through pnpm.** Neither ran end to end,
  because the `core-build.mjs` gate refuses a stale Core dist. Both suites ran
  directly, as shown above. A rebuilt Core is needed for the pnpm-level gate,
  and the staleness is not from my edit alone.
- **Core's run-record storage.** I did not check that anything beyond
  `extraction-summary.ts` keeps `metadata.extraction.conditions.alone`, for
  example a stored-record schema or the run-detail merge.
- **Browser and live runs.** None: the user has stopped them.

## Open questions or contradictions found

1. **Goal B is blocked on a path outside the brief.** Three changes would finish
   it:
   - Add `alone?: number` to the `conditions` array element type in
     `result-verification/contracts.ts`.
   - In `read-account/accounts.ts`, read `filter.alone` positionally, as
     `rejected` and `seen` are read, and push `alone`.
   - In `read-account/sentence.ts`, the full tail could say `<condition>
     rejected N rows (M by itself)`, and the brief tail `rejected 20 (5 alone),
     ...`. A clause for `AUTOMATION_STUDIO_RESULT_VERIFICATION_INSTRUCTION`
     (`runtime/llm/diagnosis-instructions.ts`, also outside the brief) would say
     that a condition's rows removed by itself are the ones to check against the
     request.

   About 15 lines in all. The supervisor can either extend my paths or take the
   change.
2. **Decision: should the judge get the alone rows themselves?** To do that:
   - A playback would have to ask for samples (`rejectedSamples: true` on the
     playback's command). That reverses the current rule, written in
     `domain/src/actions/extraction/rejected-samples.ts` and the extension's
     `rejected-samples.ts`, that a Flow played back asks for none.
   - The rows would then reach Core inside the dispatched result, and be stored
     on the attempt's `metadata.extraction` in Core's run record, run detail and
     any bundle or export.

   That would put page text into stored records, where today only `seen` (one
   value per condition) is stored. It would need:
   - Screening at admission (`screenAutomationStudioLlmEvidence` and the
     domain's denied keys) in `extraction-summary.ts`.
   - A decision on retention and export.
   - Either a bound or a privacy sign-off from the user: the user's rule is "no
     limits", so it cannot be a bound by default.

   Cheaper alternatives:
   - (a) Give the judge only the alone rows of the read the exploring model last
     ran. That travels in the draft's evidence and is never stored, but it is
     not the playback's own read.
   - (b) Store only a content hash or the row count, which is done now.

   My recommendation is (b) now, plus Goal B's account and sentence change. Ask
   the user before storing rows.
3. **Where the model guidance lives.** The sentence sits in the read itself
   (`rejectedRowsNote`), because no prompt text anywhere describes
   `rejectedRows`. If t223 (the compact page view) or t193 reshape the read, the
   sentence should stay beside `rejectedRows` or move into the exploring prompt.
