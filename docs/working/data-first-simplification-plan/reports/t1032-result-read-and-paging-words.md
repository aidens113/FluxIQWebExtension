# t1032 report: the result is the asked table's own read, and paging is said only for a list that pages

Worker: worker-heavy (Opus). Trees: Core `fxwork/t1032/!FluxIQ`, downstream `fxwork/t1032/!FluxIQWebExtension`. No commits. Core was edited inside the brief's owned paths only (`answer-first/result/`, `result-feed/`, `completion/`). The run's debug: `docs/working/language-driven-flow-loop-plan/debugs/run-mwv5m906-5e999159.md`.

## Outcome

Done. All three items are traced to their causes and fixed. The cause of item 3 turned out to be bigger than the brief assumed, and it is shared by every run (see the first point below). Round 2 (below) closes the lead's three follow-ups and reconciles t1029 by content; the merge commit is the lead's.

## What changed and why

**Item 3 first: it is shared by every run.** The 0.8 yes at 0094 (no defects) became unsure for this reason: `runtime/result-verification/verdict/result-verdict.ts` holds any yes unsure (`semanticEvidenceMissing`) while the judge summary's `evidenceProjection.missing` lists a gap. Every judge request in this run listed five gaps, and so did all seven in run-mwuxd2v9-33928ea3 (15 gaps each). The web domain's judge projector created them:
- each `web.detect_repeating_structure` call: `evidence_unrecognized`
- `core.set_result_processing`: `action_invalid`, because its `changed: true` is a boolean
- `core.recall_result`: `evidence_unrecognized`

No act or read can clear these gaps. So no yes could stand in any attempt that detected a list or set result processing. The model was then told the generic "could not tell", because `flow-less/judge.ts` drops the held yes's reason. So the hold was wrong, and the fix is downstream:
- `judge-evidence/structure.ts` (new) and `project.ts`: a detection becomes an observation holding its item count, column keys, pagination and list name.
- `judge-evidence/domain-call.ts` (new) and `project.ts`: a call that is neither a web node nor a web tool (checked by exact id) is Core's. It is projected with only its source and no gap.

Had the gaps been absent, the 0094 yes would have been **accepted on the product rows**. The judge said `answerRecords.asked: false`, and the cart table existed only in the model's own words. See open questions.

**Item 1: paging words.**
- `structure/list-paging.ts` (new) and `packet.ts`: every detection packet now carries `listPaging: [{listKey, pages}]`, one entry per handle's binding. `listKey` is the same key a read of that list stamps; `pages` says whether the binding kept a pager.
- Core `result-feed/list-pager.ts` (new) reads it from any call that read nothing and turns it into a `pager` ledger event (`result/types.ts`, `ledger.ts`, `pagers`).
- `result/header.ts` now says "the list shows no pager, so it holds one page" in place of "paging after X not yet checked". It does this only for a list declared pagerless that no move or pass has settled. A list declared to page, or not declared at all, keeps the old wording.

**Item 2: which read is the result.**
- How the result step is chosen: the result is the output group, meaning the last draft read step not marked intermediate (`output-step.ts`). Step 6 was the only draft read step.
- "2 pages" was really one page read twice. The replay at 0069 answered with no `listKey`, so it landed on another spot and became "unplaced read 1". Both reads have the same `where` in the judge's `resultEvidence`. Fix in `result-feed/feed.ts` `passed`: a pass whose answer names no list reads the step's own list, so a replay on the same page is that page again.
- The header said "columns item, quantity, price" (the request's words) about rows that held name, price, rating, pickup and url. Fixes:
  - `result/column-match.ts` (new, shared with `answer.ts`), plus `header.ts` and `port.ts`: the header now says "columns asked: ..., but the rows hold ... (no ...)".
  - The feed's port passes the columns left after processing, so the refusal's `resultHolds.result` says this too.
- Completion feedback: `completion/result-columns.ts` (new), `check.ts` and `refused-words.ts`. Every no or unsure from the judge or a caller check, and every same-evidence refusal, now says:
  - which named columns the rows the check read lack, and that they are not the asked table
  - that the result is the draft's last read step
  - the two ways a read of the table becomes the result: a read with `add: true`, or `amend_draft` `take` of a read already run (the model has both tools and used both in this run)
  - that processing must be set again over the new step's columns.

  It never refuses anything on its own.

## Commands run and observed results

- `pnpm --filter fluxiq check` (Core): passed, no diagnostics. Run twice: after the source edits, and again after the tests were added.
- Core `node ../../scripts/vitest-groups.mjs --groups=parallel,real-sql answer-first/result/ answer-first/result-feed/ answer-first/completion/ answer-first/tests/endings/`: exit 0.
  - parallel: 43 files, 266 tests passed
  - real-sql: 21 files, 96 tests passed
- The new Core tests (`result/tests/header-declared.test.ts`, `result-feed/tests/list-pager.test.ts`, `completion/tests/result-columns.test.ts`): 15/15 pass.
  - Proof they test the fix: with `header.ts` and `check.ts` swapped back to HEAD and the feed's listKey line reverted, 8 fail and 7 pass. The 7 that pass are the negative cases. My versions were restored afterwards and checked by grep.
- Core library build (`pnpm --filter @fluxiq/contracts --filter @fluxiq/sdk --filter fluxiq --filter @fluxiq/client-gateway-websocket --filter @fluxiq/ui-components build`): Done, 17 min.
- Domain `DOMAIN_TEST_BUILD_LABEL=t1032 node scripts/test-domain.mjs judge-evidence/tests structure/tests`: 90 tests, 90 pass.
  - The first run had 6 failures: `detect.test.ts`'s packet-key allowlist (I added `listPaging`, `listKey` and `pages` with a comment), and a detection projected as `action`. That second one happened because `webRunnableNode` fuzzy-matches the tool id; it is now kept as an observation.
  - Before the fix (HEAD `project.ts` and `packet.ts`), 4 of the 5 new tests fail with the recording's exact gap codes.
- `pnpm --filter @fluxiq-web-extension/domain check`: core-build current, then tsc passed with no diagnostics.
- Audits: Core `node scripts/structure-audit.mjs` passed (571 warnings, 903 baselined). Downstream passed (261 warnings, 551 baselined) after I fixed one `contract-spread` failure in my own test.
  - Advisory warnings on files I touched: `result/` now has 25 files, `feed.ts` is 544 lines, `packet.ts` is 589 lines. All three were already past their thresholds.
- Recorded header rebuilt through the real feed from the 0010, 0012 and 0069 step files, using a scratch vitest file that has since been deleted. Output:
  - one page `offset=0 (8)` after the replay
  - "columns asked: item, quantity, price, but the rows hold name, price, rating, pickup, url, ... (no item or quantity)"
  - "the list shows no pager, so it holds one page" once the declaration is fed
  - the 0095 refusal now carries the column sentence and both routes

  The full text is in the debug doc.

## Not verified

- No live or Lab run.
- The declaration's `listKey` matching a live read's key is proven only by `webAutomationExtractListAnswered` over the binding's `item`, with frames at top level. A read in a child frame (where `browserFrameId` or `browserFrameUrlPath` come from `ran`) was not exercised.
- The rebuild fed the declaration by hand with the read's own key; the recorded packet predates `listPaging`. The replay's `draft.replay.from` was not in the step files, so I set it to the read's url. The recorded `where` values were equal, which supports this.
- The rebuild did not replay result processing, so the rows list all 17 read keys rather than the five the run's processing kept.
- I did not run the full suites, Core's whole vitest run, or any extension or e2e checks.

## Round 2 (the lead's follow-up): open questions 1-3 closed, and t1029 reconciled

**1. A yes over the wrong rows never passes.**
- `cited-yes/records-yes.ts`, `verdict/types.ts` (`askedColumns`), `verdict/result-verdict.ts` and `flow-less/judge.ts`, which passes `resultEvidence.answerContract.columns`.
- Where the result's own contract names the table asked for, a yes is refuted in either of two cases:
  - it says `answerRecords.asked: false`
  - the rows hold nothing for a named column: no column of that name, and none sharing a word with it
- A refuted yes is asked again once with Core's sentences, then stays unsure.
- The 0094 shape stays `answer_first.judged_unsure` through the real judge and the completion check. The feedback names the mismatch ("so it asks for records, and the yes says it does not", "have no title or copies column, so they are not the table it asks for") and the way to the asked table (`add: true` / `take`). The asked table's own rows, with a yes saying `asked: true`, pass.
- **Why word-sharing and not exact names.** The contract reader turns "with columns title only" into the column `title only`, as a real-sql test showed. An exact-name rule would make that misreading a refusal nothing could answer, and a task must end with its result or its budget. A held column that shares a word with a named one is therefore left to the judge.
- **The reader defect is not fixed.** It is in `runtime/flow-authoring/bootstrap/answerability/`, which belongs to t1030; worth a ticket.
- `asked-words/held-column.ts` (new) is now the one matcher, moved from answer-first so the runtime can use it. `result/column-match.ts` is deleted.
- `answer-first/tests/fake-library.ts`: the fixture judge said `asked: false` over rows. It now says what an honest judge says: `asked: true`, `siteShows` = the rows held.

**2. A held yes says why.** `flow-less/held-yes.ts` (new) and `judge.ts`: "The check said yes, but Core held it unconfirmed: <Core's reason>", plus, for evidence it could not read, "The evidence Core could not read: <call> (<code>); ...". It never says only "could not tell".

**3. Core never hands its own calls to a host.** `judge-evidence/core-call.ts` (new) and `project.ts`, the single gateway every projection passes through. Core's own calls are:
- every `core.*` tool, except the four that run the host's nodes (`run_node`, `run_nodes`, `run_part`, `run_flow`)
- Core's control-flow and timing nodes (`builtin.control.*`, `builtin.timing.*`, by node class)

Each is projected as an observation with no host facts and no gap.

**Downstream guards.**
- My `judge-evidence/domain-call.ts` guard is **removed**. Its only job was Core's calls. For any other call the web domain does not know, a gap is the right answer.
- t1029's bookkeeping branch in `project.ts` (control-flow and timing classes) is **redundant**. Core now never hands those steps over, so on reconcile it can go, together with its direct-projector test. My `recorded-gaps.test.ts` now proves the same cases through Core's semantic trail: wait, merge and For Each give no gap, and a data node's unreadable content is still a gap.
- t1029's toggle fix in `action.ts` (toggles read in both shapes) **still has a job**: it is the web's own press evidence. Keep it, with its test.

**Reconcile: done by content; the merge commit is the lead's.** The worker hook denies `git fetch`, `git merge` and `git merge-tree`. t1029 is on local `dev` (`531a9cf30`), and I read it with `git show dev:` only. In the t1032 working tree, the three overlapping files now stand as follows:
- `judge-evidence/action.ts`: **dev's (t1029's) exact content**, the toggle read in both shapes. The merge will find both sides identical.
- `judge-evidence/tests/project.test.ts`: dev's content, with t1029's "Core's control-flow and timing steps miss nothing web" test replaced by a three-line note pointing to `recorded-gaps.test.ts`, which proves the same cases through Core. t1029's toggle test is kept as is.
- `judge-evidence/project.ts`: t1032's version, with no `getAutomationNodeDefinition` import and no bookkeeping branch.

When the lead merges dev into `task/t1032-result-read-and-paging-words`:
- **`project.ts` and `tests/project.test.ts` will conflict. Take ours (t1032) for both.**
- Every other dev change (t1029's `web-sessions`, e2e specs, lab run-watch, t1031's work) touches nothing of mine.
- The combined content was checked: domain `judge-evidence/tests` and `structure/tests` pass 92/92, including t1029's toggle test; the domain check passes; the downstream audit passes.
- I did not re-run t1029's other suites (`web-sessions`, e2e) in this tree, because those files are not in it until the merge.

**Round 2 validation (observed):**
- `pnpm --filter fluxiq check`: passed. Last run on the final sources, after `core-call.ts` was given its control-flow and timing scope.
- Core `node ../../scripts/vitest-groups.mjs --groups=parallel,real-sql` over `answer-first/{result,result-feed,completion,tests}/` and `result-verification/{cited-yes,flow-less,judge-evidence,verdict,asked-words}/`:
  - parallel: 76 files, 525 tests passed
  - real-sql: 40 of 41 files passed, 298 of 299 tests. The one failure was `second-attempt-proof.test.ts` "the run's deadline: the attempt carries on, by hand, to the result", where `path` came back `explore` instead of `run_flow_then_explore`. It ran while a 17-minute Core library build loaded the machine. Re-run alone, it passed 11/11. I read it as a deadline test sensitive to load, not a regression, but did not prove that further.
- Tests that were not in that sweep, run separately:
  - `judge-evidence/tests/core-call.test.ts`: 3/3, since it was written while the sweep ran
  - the "title only" case in `asked-table-yes.test.ts`, re-run inside the run of the failing real-sql files plus the new tests: 3 files, 15 tests passed, and then the full sweep above
- Proof the new tests test the fix: with `records-yes.ts`, `judge.ts` and `judge-evidence/project.ts` swapped back to HEAD, 5 of the 8 new runtime tests fail. The 0094 yes comes back `yes`, the held yes says "could not tell", and the host is handed `core.set_result_processing` and `core.recall_result`.
- The three real-sql failures from my first round-2 sweep (`refused-rows-not-read`, `automatic-service`, `publication-restart`) were the fixture judge saying `asked: false` over rows, plus "title only". After the fixture and leniency fixes they pass.
- Core library build: done, on the final sources. The domain's core-build check says it is current.
- Domain `DOMAIN_TEST_BUILD_LABEL=t1032 node scripts/test-domain.mjs judge-evidence/tests structure/tests`: 92/92, with t1029's `action.ts` and toggle test in the tree. `pnpm --filter @fluxiq-web-extension/domain check` passes.
- Audits: Core passed (572 warnings, 903 baselined). Downstream passed (261 warnings, 551 baselined).

## Open questions or contradictions found

1. The contract reader reads "with columns title only" as the column `title only` (`runtime/flow-authoring/bootstrap/answerability/`, t1030's area). My refusal is lenient around it, as described under round 2.
2. **The fuzzy tool-id match is still there.** `webRunnableNode` fuzzy-matching tool ids still drives `acted` in `project.ts` for ids other than detections.
3. **Replay rows do not dedupe against the original read.** The replay's rows carry absolute urls while the read's carry relative ones.
4. **The brief's "yes at 0.8" applies only to 0094.** At 0081 the judge's answer was `unknown` at 0.6.
