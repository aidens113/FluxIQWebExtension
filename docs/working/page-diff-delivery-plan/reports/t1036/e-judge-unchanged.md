# t1036 / e-judge-unchanged (D14): no judge call when nothing changed since the last judged no

## Outcome

Done in Core, with one wiring edit left for the lead (in `attempt/`, worker D's path, which I may not touch). Until that edit lands the new digest is not used in production, because the check's new `shown` port is absent there and the check falls back to the old digest.

## Why the existing `same_evidence` check missed them

`automationStudioFlowLessSummaryDigest` hashes the summary as the attempt holds it. That includes the end view and both witnesses, which carry the page as the domain returned it (`page` text with handles, plus `judgeState`). The judge never sees that raw reading: the domain's projector (`domain/.../judge-evidence/project.ts`) turns it into `captureOmitted` plus the semantic state. Every completion reads the page afresh, so two completions over one unchanged site hash differently while the judge's input is identical.

Evidence (read with small scripts under `test-runs/t1036/`, the judge's request message, `context.resultSummary`, hashed per member):

| Recorded call | Previous judge it matches | Judge-visible summary vs that one | Verdict of that one | Skipped by the new rule? |
| --- | --- | --- | --- | --- |
| run-mwuxd2v9 step 163 | 152 / 154 (154 is the re-ask after 152's unreadable reply, a no) | every member identical, trail included | no | Yes. Same rows, acts, resultEvidence (processing), readPages, endView, witnesses. Only the raw page reading could differ. |
| run-mwuxd2v9 step 182 | 163 | every member identical except `trail` (excluded from the digest by design: two more detect and find calls that changed nothing) | no | Yes, same reason. |
| run-mwv5m906 step 81 | 78 | every member identical, trail included | no | Yes. |
| run-mwv5m906 step 94 | 78 / 81 | identical except `trail` and a new `answerText` (the model's own words) | no | **No.** The answer words are a changed input, and the existing design counts them as evidence (test "refuses evidence an earlier no refused", `refused-again.test.ts`: judged again when an answer appears). The brief's list of deciding inputs does not name them. Decision for the lead: exclude `answerText` from the digest when the result holds rows or acts (the judge is told they are "not evidence"). One line in `deciding-digest.ts`, but it flips that existing test, so I left it. |

I could not read the raw (unprojected) page of the four completions: the step files hold only the judge's request, which already carries the projected form. So the raw-page difference is the only remaining candidate by elimination (every projected member is byte-equal), not something I observed directly. The unit tests prove the mechanism (a raw page that differs per read, same judge-visible summary, same digest).

## What changed

Core `packages/fluxiq/src/` (all new files carry a header comment):
- `framework/automation-service/service/answer-first/completion/deciding-digest.ts` (new): `automationStudioAnswerFirstDecidingDigest({ summary, shown?, draft? })`. With `shown`, the digest is of what the judge is shown (question, trail and repeat note dropped); without it, the summary's own digest as before. The draft is folded in.
- `.../completion/shown-summary.ts` (new): `automationStudioAnswerFirstShownSummary({ deniedEvidenceKeys, judgeEvidenceVersion, projectJudgeEvidence })` builds that function from `automationStudioFlowLessJudgedSummary(...).sent`, the same call the judge makes. Returns `undefined` without a privacy declaration (the judge answers unsure then).
- `.../completion/check.ts`: two optional inputs, `shown` and `draft`; the digest line now calls the deciding digest. Order, stored no, `same_evidence` code and words are unchanged; `not_judged` is still never stored, so an unreadable-reply re-ask still asks. Header gained the t1036 paragraph.
- `.../completion/index.ts`: barrel exports.
- `runtime/result-verification/flow-less/json-digest.ts` (new, not in my owned list, in no list): the canonical-JSON digest that `summary-digest.ts` held privately; `summary-digest.ts` now calls it; `flow-less/index.ts` exports it. Behaviour of `automationStudioFlowLessSummaryDigest` is unchanged.
- Tests: `completion/tests/deciding-unchanged.test.ts` (9) and `completion/tests/shown-summary.test.ts` (2).

Words: I kept `WORDS.sameEvidence` (the stored verdict and its reasons, the defects and checked rows, the missing-columns line, and what would change it). Its last sentence says completing again "stops this round, and the next must take a different way": that is the existing `loop-signal/completion-refused-again.ts` ladder counting `refusedAgain`, not something I added. It is a count that ends a round, which AGENTS.md ("no arbitrary limit ends or resets a run") forbids; it is outside my paths, so I report it.

## Wiring edit needed (worker D's path: `answer-first/attempt/run-attempt.ts`, in the `automationStudioAnswerFirstCompletionCheck({ ... })` call near line 236)

Add, next to `askedAgain:`:

```ts
shown: automationStudioAnswerFirstShownSummary({ deniedEvidenceKeys: input.binding?.deniedEvidenceKeys, ...journal.capability(trail, input.binding), projectJudgeEvidence: input.binding?.projectJudgeEvidence }),
draft: () => <a plain value that changes when the draft's steps do, e.g. the model's authored steps' fingerprint>,
```

import `automationStudioAnswerFirstShownSummary` from `../completion/index.ts`. `shown` alone fixes the four recorded cases; `draft` is optional (absent means none) and only matters where an amendment changes nothing the judge is shown.

## Commands run and observed results

- `NODE_OPTIONS=--max-old-space-size=3072 node .../heavy-slot.mjs run t1036-e -- node ../../scripts/vitest-groups.mjs --groups=parallel,real-sql src/framework/automation-service/service/answer-first/completion` -> parallel: `Test Files 16 passed (16)`, `Tests 91 passed (91)`; real-sql: `Test Files 1 passed (1)`, `Tests 1 passed (1)`; `all groups passed: parallel, real-sql`. (This was before the 2-test `shown-summary` file.)
- `... --groups=parallel src/framework/automation-service/service/answer-first/completion/tests/shown-summary.test.ts src/runtime/result-verification/flow-less` -> `Test Files 20 passed (20)`, `Tests 139 passed (139)`; `all groups passed: parallel`.
- Importers: `--groups=parallel,real-sql src/framework/automation-service/service/answer-first` (log `test-runs/t1036/importers.log`): parallel group `Test Files 121 passed (121)`, `Tests 832 passed (832)`. The real-sql group had started and was still running (no failure printed) when I had to stop; its final line was not observed.
- `pnpm --filter fluxiq check` (queued on the heavy gate as t1036-e5, log `test-runs/t1036/check.log`): never got a slot while I waited; NOT RUN to completion. The lead must run it (my files are plain typed TS; `shown-summary.ts` casts the judged summary through `unknown`).
- `node scripts/structure-audit.mjs` (Core): `structure-audit: 1 violation(s) across 1 rule(s)`, the one FAIL being `packages/fluxiq/src/runtime/llm/page-channel/tests/binding.test.ts` `[as-never]` (another worker's file, recorded, not fixed). No finding in any file I touched.
- `pnpm --filter fluxiq check`: see the return contract below.

## Not verified

- The raw page difference itself (see above).
- No offline replay of the five recordings through the new check: the check needs the raw summary, which the step files do not hold; I compared judge-visible summaries instead (table above).
- `ReplayStands`, caller-check and `judge: off` paths were not changed; their existing tests pass.

## Open questions

1. Exclude `answerText` from the digest when rows or acts exist (would also skip recorded call 94)? Flips an existing test.
2. The `refusedAgain` ladder (`loop-signal/completion-refused-again.ts`) ends a round on a count of repeats; the sameEvidence words promise it. Worker D / lead decision.
3. Wiring edit above.
