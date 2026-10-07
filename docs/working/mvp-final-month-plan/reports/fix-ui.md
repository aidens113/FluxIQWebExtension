# t288 extension UI fixes (lead report)

Brief: `mvp-final-month-plan.md`, "Briefs: fix every open item of the week report", t288 bullet. Trees:
`fxwork/t288/` (both repos, branch `task/t288-fix-ui`). Nothing committed. Workers could not be dispatched (the
concurrent-subagent limit was reached), so the lead implemented group 1 itself.

## Group 1 (ready to land)

| Id | Item (evidence) | Cause | Fix | Files |
| --- | --- | --- | --- | --- |
| W26a / U-R3-1 | Test card "Testing: Read list · name and..." (`mux6nxst` #6) | Core names a list of two or three fields by all of them ("name and mutualFriends"). The card kept only "... and N more" names whole and cut the rest with `cutMiddle`, which gives "name and…". | A `read` card's target is Core's list name, whatever its shape: shown whole and wrapped. | ext `panel/chat/stream/step/card-words.ts` |
| W26b | "The result didn't pass its check" heading "Sent back because some steps weren't written..." (`mux74k5q`) | Core's "Completion check" note checks whether the proposed Flow is finished, not a result. The panel's tense table named it as a result check. | "Checking the Flow is finished" / "Checked the Flow is finished" / "The Flow isn't finished yet". | ext `panel/chat/stream/step/words.ts` |
| R3-U-5 | Five or more identical "Read list · name, price and 4 more / Done" cards (`mux6naez` 11-12, 18-19) | Only cards that did nothing were folded. | A successful card folds into the card just before it when the words are identical, result included: "Done (5 times)". Another row count stays separate. Done, failed, done stays three cards. Cards still working or waiting are not folded. | ext `panel/chat/stream/step/card-repeats.ts`, `card-words.ts` |
| R3-U-7 | "Deciding the next step — didn't work" on `llm.provider_malformed_response` (`mux6naez` 08) | Core's observer gave every failed decision that was not a provider outage the label "— didn't work". | An unusable reply (an `AutomationStudioLlmUnusableDecisionError`) reads "The AI model's reply couldn't be used" and says it is being asked again. Any other error reads "Deciding the next step — stopped". | Core `R/activity/observer.ts` |
| W27 / R2-U-5 | "Sending your message" and no overlay from the send until Core's first activity (`mux6n7m4` 02, `mux6pndp` 02); lane C showed "Starting…" | **Not established.** The relay shows "Starting…" only while the gateway session is live and no work is running. The evidence holds no relay or session state at the send. Timeline for `mux6n7m4`: sent 21:23:45.14, overlay host first present 46.845, build start 46.812. So no starting status went up at all. | A send made before the session is live now puts "Starting…" up when `noteSessionReady` fires, within `STARTING_HOLD_MS` of the send, unless Core already spoke or answered without work. A send that shows no starting status now logs why to the worker console (`extension-start.local.json` keeps it), so the next run answers the cause. | ext `background/activity/activity-relay.ts` |
| W27 overlay | "Couldn't fix your Flow · Build stopped: a budget ran out" on a creation build (`mux74k5q` 16-17) | t276's guard heads the ending row "Build failed". But `thoughtDisplayFor` built a thought's headline with no previous display, so a model thought after the ending in the same unit took the run subject's headline again. The thought keeps the action line, which matches the samples. Reproduced in a test. | The unit keeps the kind its settling row named for every later row in that unit. A thought's own display gets the kept display. | ext `background/activity/pacer.ts` |
| W26c | Per-row cards name their row | n/a | Already fixed: seen in `mux6nxst` #6 ("Testing: Click · Confirm · Amara Osei"). | none |

Docs: `docs/architecture/extension-client.md` (starting status deferral and log, the unit's ending kind, card
folding of successes, list names whole, completion-check words).

### Validation (lead, observed)

- Fail-first. Each new or changed test failed before its fix:
  - `card-words.test.ts`: `# fail 1`.
  - `messages.test.ts` completion title: `# fail 1`.
  - `messages.test.ts` fold test: `# fail 1` (five separate "Done").
  - `send-start.test.ts` deferred start: `# fail 1`.
  - `pacer.test.ts` post-ending row: `# fail 1` ("Couldn't fix your Flow").
  - Core `npx vitest run .../activity/tests/observer.test.ts`: `1 failed | 31 passed`.
- After:
  - Core `npx vitest run src/programs/automation-studio/runtime/activity/tests/observer.test.ts`: `32 passed (32)`.
  - Core root: `node scripts/build-cache/cli.mjs fluxiq:check` exit 0; `structure-audit:check`: "passed (265 warning(s), 349 baselined)".
  - Core `pnpm.cmd build`: exit 0.
  - Extension, through `run-subset.mjs <abs apps/extension> t288-lead` and then `node --test`:
    - every test in `panel/chat/stream/step/tests`, `panel/chat/stream/tests` and `background/activity/tests`: `# tests 162 # pass 162 # fail 0`;
    - `shared/activity/tests`, `panel/chat/view/tests` and `panel/chat/tests`: `# tests 97 # pass 97`.
  - `pnpm.cmd --filter @fluxiq-web-extension/extension check`: exit 0 ("core-build: ... is current").
  - `node scripts/structure-audit.mjs`: "passed (172 warning(s), 118 baselined)".

### Next live UI review must see

- From the send, "Starting…" in the panel and on the page. If either is missing, the worker console in
  `extension-start.local.json` has "FluxIQ starting status not shown at send" with the reason.
- Repeated identical successful reruns show as one card with "(N times)".
- A two-field list name is never cut.
- A completion sent back reads "The Flow isn't finished yet".
- A provider reply that could not be read says so and is not shown as a failed step.
- A failed creation build never reads "Couldn't fix your Flow".

## Described, not fixed (owned elsewhere)

- U-B3-3: the overlay showed "12 Double Rolls$16.47" with the control's two lines glued together. The glue is already
  in the page view the content side captures: `mux6pndp` `steps/0021-decide/request.txt` lists "6 Double Rolls$8.97 |
  12 Double Rolls$16.47". Fix in the content naming of a control (t284 owns content extraction): join the text of
  block-level children, or `<br>`-separated lines, with a space, as the rendered text does.

## Group 2 (ready to land)

Group 1 landed as Core `2c7c3a39` and downstream `8f7c4e42`, verified by the supervisor. In the table, `R` = `packages/fluxiq/src/programs/automation-studio/runtime`.

| Id | Item (evidence) | Cause | Fix | Files |
| --- | --- | --- | --- | --- |
| W24 | "6 of the 6 things you asked have a step that ran, or could run" while Add to cart was never pressed (`mux74k5q`: the final test had step 0158 `verified` and 0161 `present`) | `proven` counted any act whose step replayed, including steps the test only checked (`verified`) or found already done (`present`). | The judgement also counts `checked` (verified or present). The ending says "4 of the 6 ... have a step that ran ..., and 2 more have a step that was only checked, not run". A judgement with no `checked` field keeps the older words. | Core `R/flow-bootstrap/unfinished-build/{judgement,contracts,not-done}.ts` (**`judgement.ts` and `contracts.ts` are not on the owned list**: additive `checked` field only) |
| U-B3-2 | "Judging the Flow — The Flow so far ran clean from its start" while 6 steps did not run (`mux6pndp` 14; `mux6naez` 14) | A fixed sentence. | `automationStudioFlowBootstrapTestReachSaid(judged.seed)`: "ran clean" only when every step ran; otherwise "The test ran 1 of the Flow's 3 steps from its start; 1 was only checked, not run, and 1 could not run." | `not-done.ts`; `phases.ts` (the announce line and its import only, as allowed) |
| W25 | "...the 7-in-1 version, shipped f..." (`mux6n7m4` 4) | `saidUnanswered` cut each act's words at 119 characters with `slice`. | `automationStudioFlowBootstrapUnansweredSaid` (exported, pure) cuts after the last whole word. | Core `R/flow-bootstrap/action-permissions.ts` (**not on the owned list, and owned by no stream**: that function only) and its test |
| U-B3-1 | "Click · Add to cart · Done" for a step written into the Flow without running it (`mux6pndp` 10, 12, 14; step 0095 answered `core.run_node.written`) | The shared card reading had no words for `core.run_node.written`. | `activityActionTested`: "Added to the Flow, not run yet", on the card and in the overlay. | Core `src/ui/activity-action/tested.ts` |
| F2 | Build list read cards showed a bare "Done" (`mux6naez` 04, 08-12) | A build's own read sends no `outputs` or `readRows`. Its evidence already says `read.extraction.recordCount` and `pagesRead` (step 0016: 20 and 1). | `call-context.ts` reads that count when there are no rows; the observer writes `Rows: 20 · Pages: 1`; the card reads "Done: 20 rows from 1 page". **No domain change needed.** | Core `R/activity/{call-context,observer}.ts` |
| R3-U-9 | Thoughts ended on ";" (`mux6naez` 05, 12) | `withoutMechanics` dropped the clause after the ";" and kept the semicolon. | The last kept clause ends with ".". | Core `R/activity/wording/reason-text.ts` |
| R3-U-10 | "the detected reading the list handle" (`mux6naez` 04; the model wrote "the detected extraction handle") | `EXTRACTION` replaced "extraction" with "reading the list". | "extraction handle" / "extract list handle" is said as "list". | Core `R/activity/wording/person-words.ts` |
| R3-U-4 | "steps 1, 2, 4 and 5 came from the Flow being changed", five times (`mux6naez` 20-26) | The draft's step numbers were used in sentences the person reads. | Counts instead: "4 of its steps came from the Flow being changed ...". Same for the ending and for the "came from the earlier Flow" sentences. Model-facing `resume.ts` is unchanged. | Core `not-done.ts` |
| R3-U-8 | "it kept retrying things that had already failed or done nothing" beside reads that worked | Wording for `repeat_refused`. | "it kept asking to run steps again exactly as they had already run, which changes nothing". | Core `not-done.ts` |
| R3-U-3 | "...the fix used all its rounds" named no objection, and read against "attempt 1 of 3" | The ending did not use the check's `reason`; "rounds" meant the re-author's build rounds. | The run's failed row text adds "The check said: <reason, whole sentences, screened>". The status line keeps the ending alone, within 160 characters. "the fix ran out of build rounds before it could test a change". | Core `R/activity/{run.ts,wording/run-ending.ts,wording/index.ts}` |
| Partly done | "Edit the Flow / Only partly done: that step is already in the Flow" (`mux6naez` 05; 0019 kept 4 and 9, 4 was refused `already_in_flow`) | The card showed only the refusal, though Core sends what landed (`Changed: added ...`). | "Only partly done: added "Read list"; not done: that step is already in the Flow". | ext `panel/chat/stream/step/card-words.ts` |

### Described, not fixed (owned elsewhere)

- **R3-U-6**, the second build test showed no "Testing:" cards. Cause: in Core `R/service.ts` (~line 1624, owned by t282),
  `runAutomationStudioFlowBootstrapBuildPhases`'s `test` runs `automationStudioFlowDraftDryRunGate` with
  `automationStudioLlmStepLogTool(executeTool)`, which is not the activity-observed tool. So the stopped round's test emits
  no rows. The loop's own dry run goes through `observeAutomationStudioEvidenceLoop`, which is why the first test had cards.
  Change: pass an observed `executeTool` to that gate (for example
  `observeAutomationStudioEvidenceLoop({ tools: [], decide, executeTool: automationStudioLlmStepLogTool(executeTool), describeCall })
  .executeTool`, built once beside the loop's own).
- **R3-U-12**, the playback read card was unnamed ("Read list"). Core's executor names a step only by its saved label or
  its node's parameters. A list read's parameters are the web domain's (`extractList.fields`), and the domain's name for
  the list ("name, price and 4 more") is only given through `describeCall` during a build. Change: when the Flow is
  assembled from the draft, carry the step's described name (the draft entry's `does.target`) into the authored node's
  `label`, which `emitAutomationStudioActivityStep` already uses. Owner: flow-draft assembly (t283 S2 area).
- **U-B3-3** goes to t284 (supervisor).

### Validation (lead, group 2, observed)

- Fail-first. Each new or changed test failed before its fix:
  - `not-done.test.ts`: `2 failed | 26 passed`;
  - `judge-stopped-round.test.ts`: `1 failed | 6 passed` (received "ran clean");
  - `action-permissions.test.ts` with the old cut put back: `1 failed | 18 passed`;
  - `action-of.test.ts`: `1 failed | 103 passed`;
  - `call-context.test.ts`: `1 failed | 4 passed` (no `Rows:`);
  - `reason-screen.test.ts`: `2 failed | 8 passed`;
  - `never-run-whole.test.ts` and `judged.test.ts`: `4 failed | 22 passed`;
  - R3-U-8: `2 failed | 26 passed`;
  - `run-ending.test.ts` and `scope.test.ts`: `4 failed | 23 passed`;
  - ext `card-words.test.ts`: `# fail 1`.
- After the fixes:
  - Core `npx vitest run` over `runtime/activity`, `src/ui/activity-action/tests`, `flow-bootstrap/unfinished-build/tests` and `flow-bootstrap/tests/action-permissions.test.ts`: `Test Files 58 passed (58)`, `Tests 661 passed (661)`.
  - Core neighbours: `tests/service-bootstrap/tests`, `flow-bootstrap/tests`, `llm/evidence-loop/tests/resume.test.ts` and `result-verification/build-test/tests` gave `47 passed, 1 failed`. The one failure was `service-bootstrap/tests/adaptation.test.ts` "Test timed out in 15000ms". With `--testTimeout=90000` it gives `9 passed (9)` in 75 s. That is the known heavy-test timeout (P3/P4, t289), not an assertion.
  - Core root: `fluxiq:check` exit 0; `structure-audit:check` "passed (266 warning(s), 349 baselined)"; `pnpm.cmd build` exit 0.
  - Extension tests in step, stream, background/activity, shared/activity and chat/view: `# tests 211 # pass 211 # fail 0`.
  - `pnpm.cmd --filter @fluxiq-web-extension/extension check` exit 0; downstream audit "passed (172 warning(s), 118 baselined)".

### Next live UI review must see

- An ending never says "ran, or could run". A checked-only act is said as "only checked, not run".
- "Judging the Flow" says how many steps the test ran.
- No quote is cut inside a word.
- A step written into the Flow without running it reads "Added to the Flow, not run yet".
- Build list read cards say "Done: N rows from M pages".
- Thoughts never end on ";", and there is no "reading the list handle".
- Repair headings have no step numbers.
- A failed run's row says what the check objected to.
- A partly done edit card says what landed.
