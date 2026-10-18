# Empty-result provenance review

Status: read-only diagnosis complete; no source fix or rerun. The new user requirement excludes zero-row scraping tasks from acceptance; supervisor is revising that corpus. This report diagnoses field provenance rather than proposing a forced empty success.

## Conclusion

run-mvdgaz8z-27ff3d1b is not accepted: CLI exit 1, result unverified, no replay. Its exact zero-row site oracle passed, but the authored extraction has a concrete selected-state field defect. Therefore empty output is insufficient evidence of a correct reusable Flow; final judge caution is warranted. No oracle weakening or judge-forcing fix is proposed.

## Exact evidence

Evidence root: C:/Users/osrs_/FluxStuff/lab-runs/2026-10-17/run-mvdgaz8z-27ff3d1b. Existing required debug: C:/Users/osrs_/FluxStuff/fxwork/t567/!FluxIQWebExtension/docs/working/language-driven-flow-loop-plan/debugs/run-mvdgaz8z-27ff3d1b.md.

Final judge requests steps/0138-judge/request.json and 0139-judge/request.json include two zero-row record sets and two reads, each 8 seen / 0 kept / 1 page / not truncated. Both apply company equality through the same selected-only column. Judge 138 answers unknown, confidence 0.4; judge 139 no, confidence 0.6 and explicitly questions the field mapping. No claim that zero rows alone caused rejection.

Actual final browser calls steps/0134-run-web.dom.extract_list/call.json and 0137-run-web.dom.extract_list/call.json require an article carrying both its base class and an extra state class for their company, title and location fields. Deterministic class hashing using this run's seed and authored board/classes.ts identifies the extra class as cardSelected. board/card.ts places company in the first span of the company container: the semantic field is correct, but its ancestry is restricted to the selected card. board/client-script.ts removes cardSelected from previous cards and adds it only to the clicked card. Unselected cards consequently cannot supply that field. Equality on absent values can exclude rows without proving those rows have a different company.

Provenance is visible before final playback: steps/0017-tool-web.detect_repeating_structure/result.json offers the normal company field at coverage 1 and the selected-state variant at coverage 0.33. The final Flow uses the latter. steps/0113-tool-web.detect_repeating_structure/result.json offers the stable company field at coverage 1, but final calls retain the old selected-only equality and output keys. This is a stale field recipe, not evidence that company has a different semantic position.

The Flow explicitly selects Hybrid before its first read and On-site before the second. The final judge endView includes the site's empty-search state, zero-count text and recommendations section. Final request read accounts preserve preceding narrowing actions but report only one-page reads, with no pagination configuration; all 8 company rejections are not independently sufficient to prove full-search coverage. The site's authored board/results-page.ts renders recommendations and sponsored cards separately when the true query has no results, explaining why an empty query can still expose cards. I have not reconstructed every row's absent-field witness from persistence; no raw rows or page capture copied here.

Save loops list no rowsActedOn in final judge flowShape. Thus this run performed no per-row saves, consistent with the unchanged-account oracle; the run does not prove the save loop works on matching data. New user requirement requires actual matching data before this task can be rerun for acceptance.

## Generic source seams for later assignment

Proposed minimal extraction ownership: apps/extension/src/content/extraction/infer-fields.ts and apps/extension/src/content/extraction/tests/infer-fields.test.ts. pathWithinItem/pathStep currently incorporate all safe ancestor classes, while ownName's cross-peer check only bounds ambiguity. Investigate a generic repeated-card rule that prefers a shared equivalent ancestor path over a transient selection-only path, without interpreting scenario class names, removing genuine subtype columns, retargeting actions, or asserting a judge yes. Test with abstract repeated items, a selected ancestor, shared field, genuine optional/subtype field and ambiguous siblings.

Do not edit judge guidance or result-account conclusions merely to make an empty oracle agree. If stronger condition/coverage admission is later desired it needs a separately bounded brief; this review has not assigned those paths. Supervisor owns corpus task/fixture corrections and launch guards. No paid rerun, source edit, build, commit, merge or push by this reviewer.
