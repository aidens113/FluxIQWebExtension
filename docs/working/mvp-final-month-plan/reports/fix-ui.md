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

## Remaining (group 2, Core; not started)

- W24 "6 of the 6 things you asked have a step that ran, or could run" (`unfinished-build/not-done.ts`).
- U-B3-2 "The Flow so far ran clean from its start" while steps did not run (`unfinished-build/phases.ts:460`
  announce; not on the owned list, one line).
- W25 cut quote "...shipped f...".
- U-B3-1 a never-run `write: true` step reading "Done".
- F2 build-time read counts.
- R3-U-3, R3-U-4, R3-U-6, R3-U-8, R3-U-9, R3-U-10, R3-U-12.
- The "Only partly done: that step is already in the Flow" card for a refused part.
