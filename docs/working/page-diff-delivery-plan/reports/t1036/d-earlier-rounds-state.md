# t1036 D10: earlier rounds carry state, not transcripts (worker report)

## Outcome
Built. The `core.earlier_rounds` entry is now a projection: each read as call + row count + columns, every other call as one short line. No result whole, no page. One dependency is open: `core.recall_result` cannot recall an earlier round's call (below).

## What changed and why
Core `packages/fluxiq/src/framework/automation-service/service/answer-first/`:
- `earlier-rounds/earlier-rounds.ts` rewritten: entry `{ words, count, reads[], calls[] }`. `reads[]` = `{ n, callId, did, on, where, member, rows, columns }`; `calls[]` = groups by (tool, outcome) of lines `#n callId on-words` (a call with no `on` words gets its input, truncated to 80 chars), oldest first, so the last of a group is the latest of its kind. Every call is named exactly once (`count` = reads + lines). Still screened (denied keys removed, trail screen). New optional input `readRowsKey` (the domain's read-rows key; the test domain declares rows only there); `tokenLimits` input removed.
- New `earlier-rounds/read-rows.ts`, `earlier-rounds/reference.ts` (one exported thing each), barrel updated.
- Deleted as dead (the new entry carries no found, no page marker, no fitting): `carried-step.ts`, `fitted.ts`, `view-not-carried.ts`. Nothing outside the folder imported them.
- `attempt/round.ts`: passes `readRowsKey`, drops `tokenLimits`; comments in `round.ts`/`rounds.ts` updated.
- Tests: `earlier-rounds/tests/earlier-rounds.test.ts` rewritten (6 tests); `tests/endings/tests/rounds-keep-memory.test.ts` (in no brief list, edited) updated to the new shape.
- Doc: Core `docs/architecture/automation-studio/failure-control.md` paragraph "A fresh round keeps what the run learned" rewritten.

Design note: acts that landed, rows kept, last check's reasons and tried list are NOT copied; the round note already carries them (`round-note.ts`: `acts`, `rowsKept`, `lastCheck`, `tried`), the draft is `core.flow_draft`, the result `core.result`. The words point to each. Acts also appear as lines with their control words (`on`) and outcome. Trail steps carry no reliable "effect landed" flag (`framework` only exists with semantic journaling), so I did not classify acts from the trail.

## Sizes (script `test-runs/t1036/d-er-*.mjs` plus a throwaway vitest run over the recorded entries, rebuilt from the recorded entry's per-call `did/on/asked/outcome/where/found`; deleted afterwards)
| recording | calls | old entry (chars) | new entry (chars) | ratio |
| --- | --- | --- | --- | --- |
| run-mwuuo3zk step 300 | 104 | 195,114 | 7,011 | 3.6% |
| run-mwuxd2v9 step 217 | 67 | 397,870 | 14,970 | 3.8% |
(Old builder cannot be driven on raw results here; the recorded entry is the old output. Entries are in `test-runs/t1036/*.new.json`.) Growth is linear, about 70 chars per call.

## Commands run and observed
- Core `packages/fluxiq`, heavy gate, `vitest-groups --groups=parallel,real-sql` over `answer-first/earlier-rounds`, `answer-first/tests/endings`, `answer-first/attempt`: first full run 151/153 parallel, 130/131 real-sql, failures only my own new assertions (denied-column expectation, size bound, an assertion about a press title that the line legitimately names); fixed. Re-run of `earlier-rounds` + `rounds-keep-memory`: earlier-rounds `Tests 6 passed (6)`, `all groups passed: parallel, real-sql`; rounds-keep-memory real-sql `Tests 2 passed (2)`. The endings and attempt folders otherwise passed in the full run (27 of 28 files, the one failing being rounds-keep-memory, since fixed).
- `pnpm --filter fluxiq check`: FAILS, only in files I do not own: `runtime/llm/decision-handlers/tests/look-withdrawal-inert.test.ts(28,12) TS2532`, `runtime/llm/node-tools/tests/run-node.test.ts(132,12) TS18048`, `runtime/llm/view-channel/tests/binding.test.ts(50,122) TS2353`. No error in answer-first.
- Core `node scripts/structure-audit.mjs`: `structure-audit: passed (575 warning(s), 903 baselined).`
- Ext `node scripts/check/model-text.mjs`: `model-text: ok (203 scenario tokens, 562 model-facing Core files, 14324 string literals)`.

## Not verified
- No live or provider run; the model's behaviour with the compact entry (does it re-read rows it used to be shown?) is unmeasured. The risk the audit named stands: rows are visible only through `core.result` header and note `rowsKept`.
- Importers outside answer-first: grep found none importing earlier-rounds except `attempt/round.ts` and the endings test.

## Open points
1. **Cross-round recall is missing (blocks the "recallable" promise).** `runtime/llm/evidence-recall/binding.ts` keeps `results` in a `Map` created per `automationStudioLlmEvidenceRecallBinding(loop)` call, i.e. per round's loop; a recall of an earlier round's callId answers `core.recall.not_found`. Also call ids are iteration-based (`${toolId}.${iteration}` style), so they may repeat across rounds. Needed from worker A (evidence-recall owner): an optional store passed into the binding that outlives a round (keyed by an attempt-unique id), which `attempt/round.ts` can supply from the run; I will wire it in `round.ts` once the seam exists. Until then the entry's words ("Name a call's id to core.recall_result") overpromise for earlier-round ids; rows are still held by the result.
2. The two `answer-first/tests/endings` and `fake-library` test domains declare rows only through `readRowsKey`, hence the new input.
3. `pnpm check` type errors above belong to other workers' files.

Outcome: Done
Changed: see list above
Report: this file
