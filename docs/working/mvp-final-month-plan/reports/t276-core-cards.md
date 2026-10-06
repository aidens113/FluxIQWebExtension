# t276-core-cards (worker report)

Brief: t276-core-cards (lead: t276-live-ui-fixes). Core worktree `fxwork/t276/!FluxIQ`, branch
`task/t276-live-ui-fixes`. Nothing committed, nothing built.
R = `packages/fluxiq/src/programs/automation-studio/runtime`.

## Outcome

**Done, with one part of item 7 left open:** an exploring (build) list read still has no count, because
Core gets no generic count for it (see item 7 and Open questions). Items 1, 5, 6, 9 and 10 are done.
Every item has a test that fails on the committed code and passes now. To check this, I swapped in the
committed versions of only my own files, ran the tests, and put my versions back in the same command.

## What changed and why, per item

Contract (as the lead set it): `ActivityAction.result?: string` (`src/ui/activity-action/types.ts`, doc
comment). It says what a finished action came to and is set only when known. The row a pass acted on goes
into `target` as `<step target> · <row>`.

### Item 1: the edit card says what changed

- **Cause.** `R/activity/decision-answer/draft-edit.ts:132` (HEAD) emitted the card from the loop's answer
  alone. `R/activity/wording/draft-edit-card.ts:73` gave a landed edit no record, so the card could only
  read "Edit the Flow · Done". Run A's drop of step 9 (Add to cart; steps 0059/0060) showed nothing.
- **Fix.** New `R/activity/decision-answer/edit-words.ts`. It writes the words from the decision's own
  amendments minus the ones the loop's answer refused (matched by step and by rerun or non-rerun reason).
  Each amendment is read against the draft entry the model saw when it decided (`core.flow_draft`
  `steps[].does.target`, else `control`, else Core's action words). The observer now passes the
  amendments and `request.evidence` to `edit.hold`. Answers from the refusal entry or the trace row also
  carry the refused steps.
  - Words: "removed step 9, Add to cart", "added step 10, Get coupon", "moved step 11, Spain, to step 8",
    "made step 14 repeat over step 12", optional, only_if, on_failed, unrepeat and bind. At most 3 are
    named, then "and N more changes".
  - A `keep` or `add` of a step already in the Flow, and a `drop` of one already out, say nothing.
  - The model's summary is never used.
  - `draft-edit-card.ts` takes `changed` and appends it as the last record part, `Changed: <words>`. The
    label becomes `Editing the Flow — done: <words>`, or `— partly done: <words>`.
  - `src/ui/activity-action/record.ts` reads `Changed:` (free text, always last). `action-of.ts` sets
    `result` from it on a done draft card.
- **Tests.** `R/activity/tests/observer.test.ts` "names each change Core applied, by the step the model was
  shown, never the model's summary" and "says an edit that landed ... and what it changed".
  `R/activity/wording/tests/reasons.test.ts` "carries what an edit changed last on its record".
  `src/ui/activity-action/tests/record.test.ts` and `action-of.test.ts` "says what an edit changed".
- **Next live UI review must see:** an "Edit the Flow" card reading "Done: removed step N, <name>" (or
  added, moved and so on) for every edit that changed the Flow. A drop of an Add to cart step must be
  named.

### Item 5: a repeated test step names its row

- **Cause.** `R/activity/wording/tool-call.ts:82` and `:103` (HEAD) titled a dry-run or part-run call from
  the step's action only. Every pass of a repeat carries the same recorded element, so three passes read
  "Clicking “Confirm”". The observer never read which row a pass was on.
- **Fix.** New `R/activity/call-context.ts`:
  - It remembers the column the last list read outside a pass named its rows by. That is
    `evidence.readRows.rows`, one cell per row, already screened of denied columns by the domain.
  - On a `<step>.pass.<n>` call it takes the row's value in that column from `value.item`, bounded to 40
    characters.
  - `automationStudioActivityToolCall(call, words, { row })` appends ` for “<row>”` to a dry-run or
    part-run title. `action-of.ts` (testing rows only) turns `Clicking “Confirm” for “Jonas Weber”` into
    target `Confirm · Jonas Weber`.
  - No row is named when no read named its rows, or when the pass carries no `item`. A while-span carries
    none.
  - Only the row's name is shown, never its other values.
- **Tests.** `R/activity/tests/call-context.test.ts` "says which row each pass is on ..." gives Amara Osei /
  Already done, Jonas Weber / Checked, not pressed, and Lin Zhao. A guard test checks the no-row case.
  `action-of.test.ts` "puts the row Core names after the step's own target".
- **Next live UI review must see:** in run D's test, "Testing: Click · Confirm · Amara Osei — Already done
  on the site", then "... · Jonas Weber — Checked, not pressed", and so on. Three identical cards is a
  fail. The overlay reads "Trying the Flow from the start: clicking “Confirm” for “Jonas Weber”".

### Item 6: "the start page" only at the start address

- **Cause.** `R/activity/wording/action.ts:126` (HEAD) named every loopback or IP host "the start page".
- **Fix.**
  - `pageName` moved to new `R/activity/wording/page-name.ts` (`automationStudioActivityPageName(parameters,
    start)`). A loopback address is "the start page" only when its origin and path, ignoring the closing
    slash and the query, equal `start`.
  - Otherwise the page is named by the last path segment that reads as a name ("friends", "requests",
    "Pulsebud Neo"). Ids such as `B0DPN4ANC7` and segments with fewer than 3 letters are skipped. The site
    root is "the home page", and anything else gets the verb alone.
  - Sources of `start`, all Core's own (`call-context.ts`): the `initial.*` navigate, a dry run's `replay:
    "reset"` `from.location`, and the draft entry's step 1 navigate (seen on every `decide`, so later
    rounds know it). Playback (`R/activity/step/started.ts`) treats step 1's url as the start.
  - `start` is threaded through `automationStudioActivityAction`, `...ToolCall`, `...Decision` (the
    heading) and the refused-call card. `action-of.ts` reads "Opening the home page" as an unquoted target,
    as it does for the start page.
- **Tests.** `R/activity/wording/tests/wording.test.ts` "names a page this machine serves as the start page
  only at the start address" (the old expectations in the site test were updated).
  `R/activity/tests/call-context.test.ts` "names a navigate there the start page, and a navigate elsewhere
  ... by its path".
- **Next live UI review must see:** run D's `/friends/` navigate reads "Opening “friends”" / "Open page ·
  friends". The Flow's first step and the test's first step still read "the start page".

### Item 7: read cards show their counts

- **Cause.** No count reached any card. `R/activity/observer.ts:136` (HEAD) recorded only Result, Reason,
  Excused and Node, and `ActivityAction` had no field for a result.
- **Fix.**
  - `call-context.ts` counts the rows a call's answer kept: the first array of records under `outputs`,
    else `evidence.readRows.rows` plus `rowsNotShown`. The observer writes `Rows: <n>` on the record.
  - `record.ts` reads `Rows` and `Pages`. `action-of.ts` sets `result` on a done `read` card to "8 rows",
    or "13 rows from 5 pages" when `Pages` is present.
  - A playback "Records saved" row (title "Records saved", Core label "Saved 20 records",
    `R/executor/node-execution.ts:349`, not edited) gets `result` "20 records saved", read from the label.
    It is a card: `activityActionOf` returns kind `other` for it.
  - The edit card's `result` is item 1.
- **Not done: an exploring (build) read's count.** Its answer carries the count only in the web domain's
  own evidence (`read.validation.actual`: "20 records from 1 page, truncated ..."), with no `outputs` and
  no `readRows`. Parsing domain text in Core is wrong. No `Pages` is written anywhere yet for the same
  reason.
- **Tests.** `call-context.test.ts` (read card `result` "4 rows", record `... · Rows: 4 · Node: ...`).
  `action-of.test.ts` "says how many rows a list read kept ...", "says how many records a run saved".
  `record.test.ts`.
- **Next live UI review must see:** test read cards "Testing: Read list · ... — Done: N rows" and playback
  "Records saved — 20 records saved" (once the ext renders `result`). Build-time "Read list" cards will
  still show a bare Done until the domain sends a count (Open questions).

### Item 9: refusals read as refusals

- **Causes.**
  - `R/activity/decision-answer/draft-edit.ts:137` (HEAD): `ran: () => say(landed)` emitted "Editing the
    Flow — done" for a rerun-only edit before its rerun ran. In run C the rerun was then not sent
    (`target_not_a_handle`, steps 0106-0108, 0117-0119, 0128-0130). That is the "Edit the Flow / Done"
    before a refused call.
  - `R/activity/decision-answer/refused-call.ts:50` labelled a repeat-refused call `${words.label} — not
    done`. For a rerun that is "Trying again: typing ... — not done", which reads as work under way.
  - `R/activity/wording/draft-edit-card.ts:67` labelled refused edits "Running the step again — not done".
- **Fix.**
  - An edit that landed and asked only for reruns (no other change with words) now emits its thought and no
    card. The rerun's own rows (reset note, then "Trying again: …" ending done or didn't work) are its card.
  - Refused rows' labels open "Not done: <action> — <Core's reason>". The reason is computed by
    `activityActionOf` on the row itself, so the label and the card agree.
  - `activityActionOf` already returned `outcome: "failed"` and `refused.all` for these. It now gives them
    no `result`, and a refused edit carries no `Changed`.
  - What the loop refuses is unchanged.
- **Tests.**
  - `observer.test.ts`: "says no card for an edit that landed and only asks a step to run again", plus the
    refused-edit label tests.
  - `refused-call.test.ts`: label "Not done: clicking “Add to cart” — it was already tried exactly this way
    and changed nothing".
  - `reasons.test.ts`: rerun-binding label, and that a refused edit has no `result`.
- **Next live UI review must see:** no "Edit the Flow · Done" directly before a "Trying again" row. Every
  refusal card reads Not done with Core's reason, and Core's status sentence for it begins "Not done:".
  Collapsing repeated refusals and the overlay's own words ("Updating the Flow — that didn't work, trying
  another way", built from the code in `apps/extension/src/shared/activity/wording.ts`) are the ext
  worker's.

### Item 10: look cards and plain refusal words

- **Causes.**
  - `src/ui/activity-action/action-of.ts:213` (HEAD) took a look's target from the title's quoted name,
    which is the page's own label.
  - `R/activity/wording/human-label.ts:15` cut labels at a fixed length inside a word ("Hybr…").
  - `refusal-words.ts:26` held the garbled U-11 sentence.
  - `failure-reason.ts:55` held "since it named no control from the page" (U-12).
- **Fix.**
  - `action-of.ts` `lookedFor`: "Reading the details of “X”" becomes `the "X" label`, shortened to at most
    4 words or 32 characters at a word boundary, with no fragment of a cut word and no symbol-only words
    (ⓘ). "Looking for the repeating list around “X”" becomes `the list around "X"` when X is short and
    whole, else "the repeating list on the page".
  - `humanLabel` now cuts at the end of a word when one ends in the second half of the budget, and drops
    trailing commas. That fixes "Hybr…" in titles, the chat and the overlay.
  - U-11: "a repeat must start on a step that comes after the list it repeats over".
  - U-12: "FluxIQ didn't send it, as the step didn't say which control on the page to use".
- **Tests.**
  - `action-of.test.ts`: "a look at one element names what it looked for (U-2)" (2 tests), and the details
    test updated.
  - `wording/tests/action.test.ts`: Colour becomes `the "Colour" label`.
  - `wording/tests/wording.test.ts`: "cuts a long label at the end of a word".
  - `refusal.test.ts`: U-11. `failure-reason.test.ts`: U-12.
- **Next live UI review must see:** "Look · the list around "Sponsored"", "Look · the "Brightaisle Plus"
  label", and no "Hybr…" or other mid-word cut in Core's titles. U-11 and U-12 cards read the new
  sentences.

## Files

Changed: `src/ui/activity-action/{types,record,action-of,failure-reason,refusal-words}.ts`;
`R/activity/{observer.ts, step/started.ts, decision-answer/draft-edit.ts, decision-answer/refused-call.ts,
wording/action.ts, wording/tool-call.ts, wording/decision.ts, wording/draft-edit-card.ts,
wording/human-label.ts}`.

New: `R/activity/call-context.ts`, `R/activity/decision-answer/edit-words.ts`,
`R/activity/wording/page-name.ts`, `R/activity/tests/call-context.test.ts`.

Tests changed: `src/ui/activity-action/tests/{action-of,record,refusal,failure-reason}.test.ts`;
`R/activity/tests/{observer,refused-call,scope}.test.ts`;
`R/activity/wording/tests/{wording,action,reasons}.test.ts`.

All files I touched are LF.

## Commands run and observed results

- `npx vitest run src/ui/activity-action src/programs/automation-studio/runtime/activity` (in
  `packages/fluxiq`), final run: `Test Files 31 passed (31)`, `Tests 399 passed (399)`.
- Fail-first checks:
  - The 5 ui files swapped back to HEAD: 12 failed, which are all the new or changed card, record and
    failure-reason tests.
  - `refusal-words.ts` at HEAD: the U-11 test failed (1 failed, 13 passed).
  - The 9 R files swapped back to HEAD: 13 failed across `call-context`, `observer`, `refused-call`,
    `wording`, `reasons` and `action` tests.
  - My versions were restored each time and confirmed by `git diff --stat`.
- `node scripts/build-cache/cli.mjs fluxiq:check` (Core root): first run showed 2 TS errors, both mine (a
  `kind` literal in `draft-edit-card.ts` and a test `ROWS[0]`). After fixing them it printed
  `{"step":"fluxiq:check","reason":"no stamp; stored in the shared store ..."}` with no errors, so no
  errors were reported in the other worker's files.
- `node scripts/structure-audit.mjs`: `structure-audit: passed (260 warning(s), 349 baselined)`. Mine is
  advisory only: `ui/activity-action/action-of.ts` is 407 lines (warn > 400; the limit is 800).
- Grep of changed strings outside my set (`packages/fluxiq/src`, `apps/web/src`): no Core test asserts
  them. I ran the Core tests that exercise the activity wording or hub outside my set: 9 files in
  `packages/fluxiq` (conversations, executor cleared-wait and failed-step-reason, run-node, evidence-loop,
  check-activity, parked-wait, permission-ask) gave `105 passed`. 4 files in `apps/web` (steps messages and
  outcome, gateway-context-publication, GraphEditorViews) gave `50 passed`.

## Not verified

- No live run, browser, Lab or provider call (as briefed). The words have been checked only against step
  logs and tests.
- The extension tests that read Core's `fluxiq/ui` through the sibling Core were not run. By grep, two
  will fail on the new words. Both are ext-owned:
  - `apps/extension/src/panel/chat/view/tests/action-card-view.test.ts:212` expects "...since it named no
    control from the page".
  - `apps/extension/src/panel/chat/stream/step/tests/messages.test.ts:338` expects target `Colour` for
    "Reading the details of “Colour”"; it is now `the "Colour" label`.
- Whether apps/web resolves `fluxiq/ui` from source or a build. Its tests passed, but none asserts a
  changed string.

## Open questions or contradictions found

1. **Item 7, exploring reads (needs files outside my set).** To count a build's own list read, the answer
   must carry a generic count. The cheapest route is for the domain to write `outputs` (the rows, as it
   already does on replays via `withNodeOutputs`, `domain/src/runtime/llm-evidence/node-run/replay.ts:404`)
   on every list read. Core's `call-context.ts` then counts it with no Core change. Pages need a new generic
   member, for example `readCount: { rows, pages }`. That means adding a key to
   `AUTOMATION_STUDIO_LLM_EVIDENCE_TOOL_EXECUTION_KEYS` (`R/llm/evidence-loop-decision.ts:111`, which I do
   not own) and the domain sending it. Core would then write `Pages:` and `result` would read "13 rows from
   5 pages".
2. **Step numbers in the chat.** The brief's item 1 wording ("removed step 9, Add to cart") puts draft step
   numbers in the chat. U-3 in `live-C-ui-review.md` scores "steps 1, 2, 3, 4 and 5" in chat as a words
   fail. I followed the brief. The lead should decide whether step numbers are acceptable on edit cards.
3. **`scope.test.ts` (my set) changed for the other worker's `run-ending.ts`.** It failed after their
   concurrent change ("It returned 13 rows" became "it saved 13 rows", in both label and text). I updated
   its two expectations to the current output. If core-ending changes those words again, this test moves
   with them.
4. **U-12's second half.** "Didn't work: it wasn't on the page" while the box was visible comes from a
   `target_unobserved` code with no reason (`failure-reason.ts` `REASONS`). That phrase is asserted in
   apps/web and extension tests I do not own, so I left it. The contradiction U-12 names is only partly
   addressed.
5. **Not in the brief, seen while tracing.**
   - "Look · Extract list" (U-3) is `core.describe_nodes`, whose target is the node name. It is left as is.
   - The thought heading for a rerun-only edit still says "Changing the Flow", though its reason is
     usually screened out, so nothing shows.
