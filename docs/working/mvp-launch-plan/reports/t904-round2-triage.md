# t904 round 2: five follow-up items

Worker report for lane t904, round 2. Trees: `fxwork/t904/!FluxIQWebExtension` and `fxwork/t904/!FluxIQ`, with dev merged by the
coordinator. Nothing is committed. Every heavy job ran through `heavy-slot.mjs run t904`. Logs are in the session scratchpad
(`.../scratchpad/t904b-*.log`).

## Outcome

**Partial.**

- Item 2 (two failures) and item 5 are root-caused, but their fixes are product changes or need a product seam, so they are reported here and not edited.
- Item 1 does not reproduce on dev.
- Item 3 is fixed (two test defects).
- Item 4 is done.
- Item 2's professional-network upsell spec is fixed (a test defect).

## Per-item table

| # | Item | Cause | Class | What I did | Evidence |
|---|---|---|---|---|---|
| 1 | Core `project-task-routes.test.ts` "removes the task's memory..." fails beside the task-memory tests | Not reproduced on dev. Each test has its own temporary data directory. The file holds 5 tests on dev, while the report said "7/7", so the failing run may have been on another tree. | Unknown (no repro) | Nothing changed | Through the slot, on dev's tree (now identical to dev `09a129607`). Alone with the task-memory dir: 6 files, 41/41. `FLUXIQ_TEST_GROUP=real-sql` over `api/tests` plus `task-memory`, three rounds: 13 files, 117/117 each. With the earlier full real-sql group: 389/389. Needed: the exact command, tree and failure text. |
| 2a | photo-social `thread-load-more` x2 (Next page answers `list_unchanged ... [loader-settlement:work_unknown]` on the first Load more) | **Product defect.** The thread swallows the first Load more press, and a person presses again. Since 3531ca0dc (t839, Oct 31), a loader press that changed nothing is re-pressed only on a positive proof that it did nothing (`content/extraction/page-advance/loader-progress/settlement.ts`, `work_unknown`). The press-work tracker can never prove that for an `async` click handler: `page-world/press-work/tracker.ts` `run()` taints any handler that returns a Promise, and `inspect()` taints sources containing `async`/`await`. The step then fails `retryable: true`. But the domain floors `web.dom.next_page` as `commit` (`domain/src/actions/action-effect/table.ts:33`), so Core will not retry a failure found after the press. A real Flow cannot page this thread. | Product defect | Not edited (report first). The direction for whoever owns it: a Load-more press only appends, so a second press cannot lose rows. The floor or the settlement rule for append-style loaders is where the "no blind advances" rule is stricter than the user's retry rule (only a lasting act is held back). | Content harness with one worker, on dev: both fail on the first press (`for page 2`), with `failure.retryable: true` and `stage: verification`. |
| 2b | professional-network "a read whose page 2 is answered with the security check waits it out and returns the 23 people" | **Product defect.** The site's check reads "I'm not a robot" plus "Or wait a few seconds and we'll try again automatically." `robotCheckIn` (`content/action-runtime/challenge-evidence.ts:95-100`) lets `SELF_CLEARING_WORDS` (line 146) win over the box, but that list only knows "check ... again automatically", not "try again automatically". So `PERSON_WORDS` makes it `person_only`. `PageMovePersonCheck` is thrown and paging ends `rate_limited` (`extraction/pagination.ts:77`). The read then answers **succeeded** with 10 of 23 people and `truncated: false`, 1.7 s after it began. | Product defect | Not edited (report first). Widening the closed phrase list needs the robot-check context guard, or "try again automatically" on a non-check page would read as a check. Separately, the read answering `succeeded` with `truncated: false` while it says "the read is incomplete" looks like a second defect. | A temporary probe (removed) logged the whole reply: `paginationStop: "rate_limited"`, `pagesRead: 1`, `recordCount: 10`, url `page=2`, finishedAt minus startedAt = 1.7 s. |
| 2c | professional-network upsell "what a read does with the offer still open over the results" | Test defect. Since 255841933 (t762, Oct 27), a pager control under an open layer is never clicked through: the read presses the layer's allow-listed way out ("No thanks") first (`page-advance/covered-press/clear-cover.ts`). The spec still expected the offer to stay open. | Test defect (intended product behaviour) | The assertion is now `toBeHidden()`, plus two checks: the site recorded `upsellDismissed: true` (declined through the site, not hidden), and no trial checkout was opened. Comment rewritten. | Before: 23 rows across 3 pages, then "Start free trial" hidden. After: ok. |
| 3a | company-website `answer-kinds` "Run again" note | Test defect. Core changed the sentence on purpose in adf398c3c (Nov 5, "Make every line of the answer card true"; `ui-components/src/chat/answer/words/repeatable-acts.ts`). The spec kept the old one. | Test defect | Expected text is Core's current sentence, still an exact match. The constant is not exported from `@fluxiq/ui-components`, so importing it would mean a Core change. | After: 4/4 answer-kinds tests ok. |
| 3b | crossborder `answer-real-rows` (no answer turn drawn; the real rows read fine) | Test defect. Since 6eef0ac87 (Nov 4), the results port asks Core for the thread's attempts (`taskOutcomes`) on every read and fails the read without an `outcomes` list. The spec's scripted background (Nov 3) passed that message to the fake chat core, which answers `{}`. So the thread read failed and no turn was drawn. | Test defect | `answer-chat-page.ts` (real path) answers `taskOutcomes` with `{ outcomes: [] }`, as Core answers a thread with no attempts. | After: ok (rows, first five, Show all 13, exports). |
| 4 | Adopt `requestsAnswered` in the other harnesses | Same load race as bigbox: each runner treated an act as done when Playwright returned, before the page's own save requests answered. No site in these scenarios holds a request open (checked for EventSource, WebSocket, long polls and fetch-driving intervals). | Load hazard | `everything-store/tests/browser-kit.ts` (`playRecording`: settle after click, type, select and check; arms before the first step), `social-network-feed/tests/breadth-paths.test.ts` and `original-task-paths.test.ts` (`perform`: click and type), `auction-marketplace/tests/browser-support.ts` (`runStep`: settle before and after click, type and press, since it runs step by step), `company-website/tests/site-driver.ts` (`runScript` acts). The coordinator's statement-packing finding in browser-kit is fixed: one statement per line, with an `ACTS` set settled after the chain. The social-network-feed lines were unpacked the same way. | `node --test` over the five scenarios' browser tests (bigbox included): tests 303, pass 303, fail 0. Structure audit after the unpacking: `node scripts/structure-audit.mjs` -> "passed (247 warning(s), 552 baselined)", one advisory on a changed file: the professional-network spec is at 532 lines, past the 400-line advisory threshold. It was about 526 before; my edit added 6, and it is advisory, not a failure. The 303/303 run was before the unpacking, which changed layout only. |
| 5 | Core `answer-first/tests/double-act-on-run.test.ts` fails under load | **Load-dependent.** `shortRuns` sets the Flow's `executionDefaults.timeoutMs: 400`. That becomes the run's own deadline from its start (`composite-execution/owner.ts:95`), enforced by a real `setTimeout` (`engine/automation/composite/child-bounds.ts:24`). The cases mean the deadline to cut one press that never answers, but it also has to cover all the work before that press: the read, earlier rows, act-record writes. On a loaded machine the deadline came first. In "a held row stays out of a forward run whatever was looked at", the run was cut before it reached Birds, so Birds was never held, and the forward run pressed it. Every case that uses `shortRuns` carries the same dependency: (c) x2, "what a look can and cannot do" (via `landedAndLost`) and the (e) deadline variant. | Load-dependent test | **Not edited yet; needs a decision.** (1) A fix that keeps "the run's deadline" as the cause needs a timer seam: child-bounds' deadline timer would take the run's injectable scheduler, so a test can fire the deadline exactly while the press hangs. That is a Core product change. (2) The cause-agnostic cases (the held row and the look cases) can take their lost answer from a retryable error after acting, which (b) already proves holds the act, with no clock involved. That leaves the deadline-named cases on (1). A longer timeout is not a fix and was not used. | Six CPU burners beside the file, through the slot. Round 1: 34/35, failing exactly that case (`expected ['Birds of the Coast', ...] to not include 'Birds of the Coast'`). Round 2: 35/35. Burners confirmed gone afterwards. |

## Files changed (all test or test support; no product file)

Extension:

- `apps/extension/e2e/content/tests/answer-turn/answer-chat-page.ts` (3b)
- `apps/extension/e2e/content/tests/answer-turn/tests/answer-kinds-company-website.spec.ts` (3a)
- `apps/extension/e2e/content/tests/live-tasks/tests/professional-network-rotterdam-data-engineers.spec.ts` (2c; the temporary probe line was removed)
- `apps/scenario-lab/src/scenarios/everything-store/tests/browser-kit.ts`
- `apps/scenario-lab/src/scenarios/social-network-feed/tests/breadth-paths.test.ts`
- `apps/scenario-lab/src/scenarios/social-network-feed/tests/original-task-paths.test.ts`
- `apps/scenario-lab/src/scenarios/auction-marketplace/tests/browser-support.ts`
- `apps/scenario-lab/src/scenarios/company-website/tests/site-driver.ts` (all 4)

Core: none this round.

## Commands run and observed results

- `pnpm test:content -- photo-social-thread-load-more professional-network-rotterdam-data-engineers answer-real-rows-crossborder-marketplace answer-kinds-company-website --workers=1` (dev, before fixes) -> 6 failed, 11 passed: the six reported failures, reproduced.
- Same specs after fixes (`answer-kinds`, `answer-real-rows`, `professional-network`) -> 12 passed, 1 failed: 2b, the product defect.
- `pnpm --filter @fluxiq-web-extension/scenario-lab build` -> exit 0. `node --test` over the five scenarios' dist tests -> 303/303.
- Core `npx vitest run` project-task-routes beside task-memory -> 41/41. Real-sql stress x3 -> 117/117 each.
- Core double-act under six CPU burners -> round 1: 1 failed / 34 passed; round 2: 35/35.
- Extension `node scripts/structure-audit.mjs` -> exit 0, "structure-audit: passed (247 warning(s), 552 baselined)".

## Not verified

- Item 1's failing conditions (no repro).
- Items 2a and 2b fixes (not made: product).
- Item 5 fix (not made: needs a decision).
- The photo-social specs were not re-run, since nothing changed for them.
- The adopted harnesses were run once, not under load.

## Open questions or contradictions found

- Item 2a: the user's retry rule says only a lasting act is held back. The domain floors every Next page, Load more included, as `commit`. Is Load more meant to be retried?
- Item 2b: a read that stops on a check answers `succeeded` with `truncated: false` and a validation that says "the read is incomplete".
- Item 5: choose option (1) (Core timer seam) or (2) (test-only, for the cause-agnostic cases), or both.
