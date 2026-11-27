# Brief t1090: the answer comes from every result read of one list

**Goal.** When two non-intermediate reads of the same list stand in the draft, the draft and the result ledger
disagree:
- compose (answer-first's `isResult`) counts both as result reads and keeps both in the Flow;
- the ledger answers from the last one only (`result/output-step.ts`).

In the provider-free kestrel harness (t1082), attempt 2's re-exploration read page 1 with a new extraction (step 12).
`run_flow {from: 6}` then read page 2 with the carried step 6 (20 rows, including the tenth), and step 12 read page 1
again. The answer came from step 12 alone, 9 rows where 10 were right. The two steps did not fold (D2), because their
extractions differ.

**Decision (lead's, under the user's data-first rules of 2026-10-06 and 2026-11-20).** Every run's rows collect into
the run dataset, and the data layer dedupes and cleans; the asked columns are a view over all fields kept. So:
- The answer for a list comes from **every** result read of that list, whatever extraction each used.
- Rows are merged and deduplicated by the data layer's existing row identity.
- Asked columns are placed by name, as they already are.
- The draft and the ledger must name the same set of result reads. The header the model sees says the same.
- Intermediate reads stay out, as now.
- Reads of different lists are not merged.

Find the existing identity of "the same list" (`list.<hash>`, or the extraction's list key) and use it. Do not invent
a new one.

**Read first.**
- `docs/working/page-diff-delivery-plan/reports/t1085.md`, section "The lead's question: are t1082's 9 rows the K3
  credit defect?".
- Core `packages/fluxiq/src/framework/automation-service/service/answer-first/result/output-step.ts` and the rest of
  `result/`.
- The fold rule (D2).
- Compose's `isResult` (`runtime/flow-authoring/draft/compose/compose.ts`, as t1085 left it).

**Owned.** Core (`C:/Users/osrs_/FluxStuff/fxwork/t1090/!FluxIQ`):
- `framework/automation-service/service/answer-first/result/**`;
- `answer-first/result-feed/**`;
- `runtime/flow-authoring/draft/compose/**`, if needed;
- their tests.

**Must not touch.**
- `runtime/result-verification/**` and `runtime/llm/**` (t1089).
- `engine/**` and `domain/src/**`.
- `packages/test-runner/**` (t1091).

**Checks.** Put heavy commands through `node C:/Users/osrs_/FluxStuff/fxwork/.heavy-slots/heavy-slot.mjs run t1090-<label> -- <cmd>`.
- A unit test of that shape: two result reads of one list with different extractions, page 2 then page 1, giving the
  merged and deduplicated rows. It fails on today's code.
- The tests beside the changed files: `node ../../scripts/vitest-groups.mjs --groups=parallel,real-sql <dirs>` from
  `packages/fluxiq`.
- `node scripts/structure-audit.mjs` (Core).
  - Stay within directory budgets by grouping files that share a prefix (`tests/<prefix>/tests/`).
  - Never make a one-file group, and never append unrelated tests to another file.
- **Provider-free:** `FLUXIQ_LAB_INSTANCE=t1090 pnpm lab attempt auction-marketplace --task auction-marketplace-kestrel-auctions --authoring-mode answer-first --scripted-model --attempts 4`
  in the downstream tree, through the heavy slot. Report each attempt's verdict, calls and rows.

No `node -e`, no git, no live or paid runs.

**Report.** `docs/working/page-diff-delivery-plan/reports/t1090.md` in the downstream tree
(`C:/Users/osrs_/FluxStuff/fxwork/t1090/!FluxIQWebExtension`), ending with the return contract.
