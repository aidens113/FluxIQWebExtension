# t1008: a build that only looks (run-mwufisf0-5535f5f5) - report

Evidence copy: `test-runs/t1008-evidence/run-mwufisf0-5535f5f5/` (ignored). Original untouched. Every
claim below is read from the recorded step folders (`meta.json`, `call.json`, `result.json`,
`request.json`, `decision.json`) or from Core's code; no provider call was made.

## Outcome

Causes proven; fixes made in Core (t1008 tree) at the root; targeted tests pass (counts below).
Nothing changed in the downstream tree except this report. Not yet run: a live run.

## The chain, in plain words

1. **A count ended every round.** Rounds 1-4 (steps 0002-0023, 0024-0044, 0045-0061, 0062-0083) each
   ended on the model's eighth look in a row: Core's look guard
   (`decision-handlers/searching.ts`, `searching_without_acting`, told at 5 looks, stalled at 8).
   Proof: every round's first decision is `iteration 1`, the look note appears from the 6th decision
   (`looksInARow: 5`), and each round ends 3 looks later (0023, 0044, 0061, 0083). The round ended as
   a bare stall (`llm_evidence_loop.repeat_without_progress`), which is not a loop-detection stop.
2. **A fresh round forgets everything.** Each round is one evidence loop with an empty evidence
   window. The next round was told only "the round stopped because the round kept repeating itself",
   a `tried` list of tool ids with `changed_nothing` (no targets, by design content-free), no
   `loopStopped` words and `freshStarts: 0` (0025's `core.attempt_note.2`). So it looked at the same
   things again: four rounds of the same finds and descriptions.
3. **The page itself was not reset.** The lead's reading (b) does not match the record. The round
   openings 0024, 0045, 0062, 0084, 0118, 0168 are `initial.core.run_node` =
   `web.output.dom-capture_snapshot` carrying the draft's kept navigate under `held`. The domain reads
   `held` as "look in place" (`domain/src/runtime/llm-evidence/node-run/arrival.ts`, "Except a round
   that continues a Flow"). Their spans are `send.capture_snapshot`, `look`, `page.capture_snapshot`,
   `sanitize` only: no `send.navigate`, `effectApplied: false`, `web.inspect.succeeded`. And
   `run.arrived` is set by any domain call answered unrefused (`attempt/call-chain.ts`, `answered`),
   which the opening navigate at 0002 was (`web.action.succeeded`), so later rounds took
   `continuingOptions()` with no start location. The "reset" the user saw is the evidence window
   being emptied every ~10 decisions, not the tab going back to the home page; in this run the model
   never changed the page, so both would look alike from outside.
4. **Why it only looked.** A press was offered in every decision: `core.run_node` (effect `mutate`)
   with `web.output.dom-click` in its `node` enum (0011's outputSchema and every later one). Nothing
   refused a press. What pushed it to look:
   - Core's decision policy, sent to the exploration as well, said "Use a tool only to resolve
     information still missing from the result; prefer observation over mutation. Use a mutating tool
     only when its state change is necessary to reveal otherwise unavailable evidence ..." and "Do not
     call a mutating tool merely to unlock another observation." Opening the store picker to see its
     list is exactly that. The answer-first role removed only the "your goal is ... not to execute
     the workflow" sentence (`provider-task/system-prompt.ts`).
   - A press is `core.run_node` + a catalog node + an untyped `parameters` object; `dom-click`'s
     definition was never shown before the first click (`describedNodes` held only
     `browser-navigate`, then also `dom-capture_snapshot`, until 0129). The only tools that take a
     handle directly are looks (`web.describe_element`, `web.detect_repeating_structure`). The
     model's summaries say "open the store picker by pressing t7" and the call is
     `describe_element {target: t7}`.
   - Every nudge said "press" but never how: the look note ("Act on what you found: press, type into
     or choose a control ...") and the loop decision's answer ("Take the way you named now").
5. **The cover.** `describe_element(t7)` answered `coveredBy=["t313"]`; the page view's header had
   `COVERING t313` and `DIALOG t314 "Your privacy choices" modal consent`, with `t319 button "Reject
   all"` on screen and uncovered. The product already handles a covered press: the runtime clears a
   dismissible cover before the press, or refuses with `covered_by_layer` naming the cover and its
   closers (`domain/.../node-run/run.ts`, `rejection-next/next-sentence.ts`, `coveredNext`), and the
   domain text says "Press the control you want even when it is covered-by". None of it ran, because
   the model never pressed t7 or t319 (it described t319 at 0030, 0044, 0070, 0076, 0094). No cover
   defect was found; the cause is 4.

## Answers to the brief's questions

**Q1.** Offered: `core.run_node {node: "web.output.dom-click", parameters: {target: {handle: "t7"}}, consequences: []}`
in every decision. No refusal, no unfillable schema: the `already_answered` refusals (0019, 0021,
0074, 0096, 0098, 0102, 0106, 0152, 0160) were all repeats of `describe_element`. What led it to look:
the policy sentences, the press hidden behind `core.run_node` with no described parameters, and
nudges that never said how (chain 4).

**Q2.** The inspect-returning `core.run_node` calls (0024, 0045, 0062, 0084, 0118, 0168) are Core's
round openings, not the model's (callId `initial.core.run_node`, no decide before them, iteration
reset). The model's only run_node was 0127→0128, `dom-click` on t346 ("Set as my store" inside the
closed picker, `not rendered`) → `target_not_actionable`.

**Q3.** Nothing held the model to its approach. `core.loop_decision.carried_out` said "Take the way you
named now. The call you repeated stays refused." without the approach; the refusal covered only the
call in the cycle (`describe_element`), so other looks passed (0081, 0083); nothing compared the kind of
the next call with the kind of the repeat; and 0079's round ended two decisions later on the look
count (0082, iteration 10), with nothing of the approach told to the next.

**Q4.** Loop detection did see `no_progress` in rounds 5 and 6 (0117 x15, 0155 x13, 0167 x18). In
rounds 1-4 the look count ended the round at 8, before the detector's 12-call window, and the
detector is built per round (`watch.ts`), so the window restarted at 0. Looks with no act and no new
evidence should count, and the loop already holds the measure: the look streak
(`repeat-guard/searching.ts`), which counts looks that left the page unchanged with nothing done
between.

## What changed and why (Core, t1008 tree)

1. **No count ends a loop whose caller takes `loopSignal`** (the answer-first rounds; the only
   caller that gives it). `runtime/llm/loop-configuration.ts`, `uncounted`: after the figures are
   checked as given, `maxIterations`, `maxToolCalls`, `maxStepsWithoutProgress`,
   `maxUnusableDecisionsInARow` and `maxDraftAmendments` become unbounded. The no-progress redirect
   (`evidence-progress/stall-redirect.ts`) then has no countdown (no `maxStepsWithoutProgress`,
   `stepsLeftBeforeStopping` or "N more step(s) ... this round ends"), and the four feedback builders
   that print the figure omit it (`tool-failure.ts`, `unusable-decision.ts`,
   `evidence-loop/answered-request.ts`, `draft-amendment-feedback/feedback.ts`). Callers without
   `loopSignal` are unchanged.
2. **Eight looks in a row are a caught repeat, not a stall, for such a loop.**
   `decision-handlers/searching.ts`: the run of looks becomes a `no_progress` finding (repeats, the
   looks' tool ids) put on loop detection's ladder through a new `watch.caught(finding)`
   (`repeat-guard/loop-detection/watch.ts`) and `automationStudioLlmEvidenceLoopCaught`
   (`decision-handlers/loop-check.ts`): steered with the model's `core.loop_decision` ask; further
   looks that bring nothing climb the ladder, and only its last rung (change of approach, recorded
   as `stoppedOn` so the next round is told what was repeated) ends the round. The note at 5 says
   the run "is caught as a repeat, and you decide how to go on" instead of "the searching is
   stopped".
3. **A change of approach on looks alone is held to its kind.** `watch.ts`: where every counted call
   since the last progress was a look and the model chose `change_approach`, each further look that
   brings nothing (run, or answered from memory) counts as a refusal does; an act or an edit ends
   that, progress ends the incident. A look caught as a run is not counted twice.
4. **The exploration is no longer told to look rather than act.** `provider-task/system-prompt.ts`:
   the answer-first role also drops "Use a tool only to resolve information still missing from the
   result; prefer observation over mutation. Use a mutating tool only when ..." and "Do not call a
   mutating tool merely to unlock another observation." Every other role keeps them.
5. **It is told how a press is made.** `answer-first/guidance/guidance.ts` (version `answer-first.4`),
   `explorer.role.task`: "The work is done by acting on the page: describing a control or searching the
   page never presses, types into or opens anything. To press, type into or choose a control, run the
   node that does it with core.run_node, naming the control by the handle the page printed; to see
   what a menu, picker or dialog holds, press the control that opens it." The look note adds, where
   `core.run_node` is offered: "A look never presses: to press, type into or choose a control, call
   core.run_node with the node from the catalog that does it, naming the control under target as
   {"handle": "<its handle>"}." Generic; no site, product or task words (`guidance.test.ts` holds
   that).
6. Docs: Core `docs/architecture/automation-studio/failure-control.md`, "No count ends a loop with a
   `loopSignal`".

Not changed, on purpose: `run.arrived` (chain 3: no page reset happened, and it is never false after a
call was answered); cover handling (chain 5); `model-decision.ts` (an echo of the named approach was
written and then reverted when t1011 took `decision-handlers/**`, see Open questions).

## Commands run and observed results

All through `node C:/Users/osrs_/FluxStuff/fxwork/.heavy-slots/heavy-slot.mjs run t1008-vitest -- ...`
from `packages/fluxiq`, `--groups=parallel ... --maxWorkers=1 --minWorkers=1 --fileParallelism=false`.

- `src/runtime/llm/repeat-guard/loop-detection/tests/look-loop.test.ts` (new, the provider-free reproduction of the recorded
  shape): first run 4 failed / 4 passed (test fixture faults: tool-id order, a press fixture caught
  as a "success again", a unit test that called `caught` out of the loop's order); after fixing the
  fixtures: see the final run below.
- Related directories (look-loop, then at `runtime/llm/tests/`, `repeat-guard/loop-detection/tests`, `decision-handlers/tests`,
  `evidence-loop/tests/searching.test.ts`, `provider-task/tests`, `answer-first/guidance/tests`,
  `deepseek/tests/system-prompt.test.ts`, `tests/evidence-loop-provider.test.ts`,
  `answer-first/loop-signal/tests`): `Test Files 1 failed | 38 passed (39)`, `Tests 2 failed | 277
  passed (279)`; the two failures were the explorer prompt snapshot (`default-wording.test.ts`).
- `default-wording.test.ts -u` (the pin's owner): `Snapshots 2 updated`, `Tests 6 passed (6)`. The
  snapshot diff is exactly the guidance sentence added and the two policy sentences removed.
  `deepseek/tests/system-prompt-pins.json` needed no change (its test passed).
- Answer-first round tests, `parallel` group (`answer-first/tests`, `answer-first/attempt`,
  `answer-first/loop-signal`): `Test Files 28 passed (28)`, `Tests 162 passed (162)`.
- The same directories, `real-sql` group: `Test Files 47 passed (47)`, `Tests 332 passed (332)`.
  One test there encoded the old behaviour and was rewritten:
  `answer-first/tests/endings/tests/stalls.test.ts`, "the iteration limit is a fresh round" is now
  "no count of turns ends a round: work past the configured calls goes on in the same round" (with
  `maxCallsPerRun: 5` and ten calls: no fresh-round note, nothing said "Carrying on", result reached).
  "a repeat-without-progress stall changes approach" still passes: it reaches its change of approach
  through loop detection's ladder.
- Final: `look-loop.test.ts` + `attempt/tests/round-note.test.ts` + `evidence-progress` tests +
  `tests/evidence-loop-provider.test.ts`: `Test Files 9 passed (9)`, `Tests 77 passed (77)`.
  `look-loop.test.ts` holds 8 tests: the eighth look caught and decided, not a stall (8 looks, 9
  decisions, steer `no_progress` x8 with the `core.loop_decision` ask, no signal); the note at 5 says
  "caught as a repeat"; looking on climbs to loop detection's change of approach at 12 looks with
  `stoppedOn` recorded; 12 working presses past `maxIterations: 8`; a caller without `loopSignal`
  still stalls at 8; a change of approach on looks counts further looks, and an act ends that; the
  redirect of an uncounted loop has no countdown and no `null`.
- `pnpm --filter fluxiq check`: exit 2, exactly two errors, both
  `attempt/round-note.ts(46,…): Property 'found' does not exist` -- the line the lead prescribed for
  t1011's `refused.found.defects`, which types only once t1011 (fluxiq 0.54.5) is merged. Nothing
  else failed to type.
- Structure audit (`node scripts/structure-audit.mjs`): first run 2 violations from the new test (26 files in `runtime/llm/tests/`; an import past the `evidence-progress` barrel); after moving it to `repeat-guard/loop-detection/tests/` beside `ladder.test.ts` and importing the barrel: `structure-audit: passed (570 warning(s), 903 baselined)`; the moved file re-run: `Tests 8 passed (8)`.

## Follow-ups taken from t1011

1. **Round note carries the judge's defects** (`answer-first/attempt/round-note.ts:46`, exactly as the
   lead wrote it) with two tests in `attempt/tests/round-note.test.ts` (defects carried beside
   verdict and reason; none said where the check named none). Passing under vitest; types after
   t1011 merges.
2. **"nothing has said whether a page follows" (bikes run-mwug2xjw-41f62603).** Not changed, on the
   evidence. The `dom-next_page` at 0089 ran on an item page
   (`location .../local-classifieds/item/1000928912419778/`, under a chat dialog) and answered
   `output_not_observed` / `outcome_uncertain`; the "Load more" find that found 0 matches (0093) ran on
   the same item page. The list was read on the category page (the model navigated back there at
   0095). So neither call observed the list's end: treating "a rejected next-page plus no next control
   on the page" as ended would have closed this list from a page it is not on, and on a site whose
   list does continue it would cut the answer short with no one noticing. The line was true. What is
   missing is a way for an exploration call to settle it: only a forward run's pass records paging
   (`result-feed/feed.ts`, `passed`, `route === "ended"`); a move-on step the model runs itself with
   `core.run_node` on the list's page is never recorded, because Core cannot tell which list it moved
   without the domain saying so. The fix I recommend, cross-repository: the domain's next-page answer
   carries the moved list's `listKey` (as a read's answer does) and its `ended` route, and `called` in
   `feed.ts` records `paging` for the step holding that `listKey`; and the domain refuses a next-page
   whose list is not on the page as `target_unobserved` ("the list is not on this page") instead of
   `outcome_uncertain`, so the model is sent back to the list instead of looking for a pager on an
   item page. Not built here: it needs the downstream domain and a listKey contract, beyond what could
   be done and verified in this lane's time; it should be its own brief.

## Not verified

- No live or Lab run: whether Haiku now presses after the policy and guidance change is a model
  behaviour no provider-free test can prove. The loop-side guarantees (no count ends the round, the
  look run is caught and decided, looks after a change of approach climb the ladder) are proven by
  `look-loop.test.ts` through the real evidence loop.
- Recorded-replay through the t986 tools was not used: the recorded replies are look decisions, and
  the changes alter what the loop does with them and what the model is told, which a replay of the
  same replies cannot show beyond what `look-loop.test.ts` reproduces from the recorded shape.
- Downstream (web extension) checks were not run: nothing downstream changed.

## Open questions or contradictions found

- **Ownership overlap with t1011.** Before the lead's ownership note I had edited
  `runtime/llm/decision-handlers/searching.ts` and `decision-handlers/loop-check.ts` (both still
  changed; they carry the look-run fix, items 2 and 3 above) and `model-decision.ts` (reverted to
  its original text; the approach echo is not shipped). t1011 owns `decision-handlers/**` now, so the
  lead should merge these two files with t1011's branch in mind, or hand the echo to t1011.
- **Loop detection's last rung still starts a fresh round** (an empty evidence window, steered with
  `loopStopped` words). That is the t962 R7 design and the only round ending left besides the
  result, the purse and a Stop; the user's words may reach it too. Not changed here.
- **Unreadable replies in a row** (`maxUnreadableRepliesInARow`) still end a round: a provider that
  stops answering usefully, not a call count. Left as is.
- The lead's chain (b) ("every new round navigates back to the start URL") is not what this run's
  record shows (chain 3). If another run did reset its page, its step folders should show a
  `send.navigate` span in a round opening; this one has none.
