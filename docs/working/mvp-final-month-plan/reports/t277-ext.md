# t277-ext: round-3 extension UI fixes (R2-U-5, 6, 7, 8, 10, 11)

Worker report. Brief: t277-ext (lead `reports/t277-r3-ui.md`). Tree `fxwork/t277/!FluxIQWebExtension`, branch
`task/t277-r3-ui-fixes`, nothing committed. Paths are under `apps/extension/src/` unless stated. Evidence: run
`run-muwansvz-a2b4a987` (t274 slot 1, read only) and its UI review; no page data is quoted here.

## Outcome

Done for items 1-4. Items 5 and 6 need no change in my files: I established each cause from the run's evidence.
Item 5's fix belongs to `background/connection/project-context.ts` or the Lab. Item 6 is the browser's own load
window, and the one remaining saving is in `background/connection.ts`. Neither file is mine (details below).

- 540/540 owned-directory tests pass (baseline 536, plus 4 new tests).
- The extension check's own step passes. `pnpm check` itself stops at the Core-staleness gate, because the
  concurrent Core worker is still editing; the brief says not to build Core.
- The structure audit passes.

## What changed and why

### 1. R2-U-5: "Sending your message" while the overlay said "Starting…"

**Cause (established).**
- In moment 02, the panel was a project's chat: its header reads "Latest chat / Project chat", so `target.projectId`
  was set.
- The send went through `ActivityRelay.sending`, which put up the starting status (`activityId: "starting:N"`,
  `kind: "starting"`). The overlay showed it from 06:28:02.57.
- `panel/chat/stream/target-activity.ts` shows a display in a project-scoped chat only when some event of that
  project carries the display's `activityId`. No event of Core's ever carries the synthetic starting id, so the panel
  got `display: null`.
- `liveLineModel` then fell back to "Sending your message" for as long as `sending` held. That lasts until Core's
  answer plus the thread re-read:
  - Lab "instruction sent" at 06:28:03.33;
  - Core `build start` at 06:28:04.99;
  - "instruction answered" at 06:28:05.06.
- The panel picture (06:28:04.15) was taken before Core's first activity existed, so the panel should have said
  "Starting…" there, as the overlay did.

**Change.** `target-activity.ts`: a `kind: "starting"` display shows in every chat. It is the person's own send and
no event carries it. The old rule is kept, unchanged, as `carried()` for every other display.

**Fail-first.** `panel/chat/stream/tests/target-activity.test.ts`, "the starting status a send puts up shows in
every chat, a project's too…". It failed on the old code (`expected: 'Starting…'`, display null in the project chat)
and passes now.

**Next live UI review must see:**
- From the send, the panel's live line reads "Starting…" at the same time as the overlay. Then it reads the build's
  own status ("Building your Flow") once Core's first activity arrives.
- "Sending your message" appears for at most a frame, or not at all.
- If the panel then shows nothing, or falls back to "Sending…", while the overlay shows "Building your Flow", Core's
  activity is arriving with a `subject.projectId` that differs from the chat's project. That would be a new, separate
  defect.

### 2. R2-U-6 (overlay): "couldn't find it on the page" for a call Core never sent

**Cause.** `shared/activity/wording.ts` `toolOutcome` mapped any code containing `unobserved` (and `not_found`,
`missing`, …) to `OUTCOME_NOT_FOUND`, before it checked for `rejected`. Steps 0034, 0039 and 0046 are
`web.action.rejected.target_unobserved` with reason `malformed_handle`. Core's row carries that reason as
`Reason: malformed_handle` in `detail.text` (`observer.ts` `toolActivity`), but the wording never read it.

**Change.** New module `shared/activity/not-tried.ts` (`notTriedOutcome`, exported from the barrel), used in
`wordsOf` ahead of `toolOutcome`. A code matching `(^|.)rejected.` is:
- "not tried", plus why when there is one;
- the why comes from Core's `activityActionFailureReason("", reason)` (the card's own words), with Core's opening
  "FluxIQ didn't send it, as" removed;
- a list read (the action mentions a list) says "the step didn't say which list to read";
- without a reason, the code's last words are used when they are not a page miss ("not tried: a popup or banner on
  the page was covering it");
- a page miss ("it wasn't on the page") is never said.

The run's row now reads: "Trying again: reading the list of “name, price, rating and 3 more” — not tried: the step
didn't say which list to read". This works with Core's current dist ("…which control on the page to use") and with
the Core worker's planned "FluxIQ didn't read it, as the step didn't say which list on the page to read", because
both match `NO_CONTROL` once the opening is removed.

**Fail-first.** `shared/activity/tests/wording.test.ts`, "a call Core rejected before sending it says it was not
tried…". It failed with "— couldn't find it on the page" and passes now.

Existing expectations that encoded the old wording were updated:
- `wording.test.ts`: three cases;
- `background/activity/tests/pacer.test.ts`: "no tool id or result code ever reaches the detail";
- `background/activity/tests/activity-replay.test.ts`: the real t174 build's sentence set. Its two rejected codes
  (`not_at_start_location`, `target_unobserved`) now read "Trying a step on the page — not tried".

A call that ran and missed (`web.action.target_not_found`) still reads "couldn't find it on the page".

**Next live UI review must see:** no overlay detail saying "couldn't find it on the page" or "trying another way" for
a rejected call. A malformed list read should read "… — not tried: the step didn't say which list to read".

### 3. R2-U-7: alternating refused-rerun / failed-read cards

**Cause.** `panel/chat/stream/step/refusal-repeats.ts` folded only a refusal into the card immediately before it.
The run alternated two different cards:
- a "read" card that failed (rejected, unsent);
- an "Edit the Flow · run the step again" refusal (`changes_nothing`).

Neither card's predecessor was identical to it. Core's draft-edit thoughts had no reason text, so no words stood
between the cards (that is why the "Not done (2 times)" fold happened at all).

**Change.** That module is replaced by `panel/chat/stream/step/card-repeats.ts` (`foldRepeatedCards`), wired in
`messages.ts`. The rename was made because the module no longer folds refusals only.

- **Which cards fold.** A card that did nothing (a refusal in whole, or `outcome: "failed"` and not `unconfirmed`)
  folds into an identical card shown earlier in the same stretch.
- **What makes two cards identical.** The same unit of work, kind, target and test mark, and the same words: the
  refusal's reason, or `why`/`said`/`answer`/`check` for a failure.
- **What ends a stretch.** Words of FluxIQ's, a card that did anything, another unit, or a card new to the stretch
  after a repeat already happened.
- **Examples.** A B A B A B becomes A×3 and B×3. A B A C A becomes A×2, B, C, A, so the order stays true.
- **Wording.** `card-words.ts` now counts failures too: "Didn't work (3 times): …", "Didn't pass (2 times): …". The
  comments in `action-card.ts` and `card-words.ts` were updated.

**Fail-first.** `panel/chat/stream/step/tests/messages.test.ts`, "a repeating cycle of identical cards with nothing
new between them is one card each, counting them". It replays read, refused, read, refused, refused, read, refused,
each after a "Deciding" row and with the read's started row. It failed with 6 cards and now gives 2: "Didn't work
(3 times): …" and "Not done (4 times): …". It also checks that a card that did work, or a thought, starts the count
afresh, and the A B A C A order.

The existing U-8 test still passes unchanged.

**Next live UI review must see:** during repeated reruns, one "Read list · … / Didn't work (N times): …" card and one
"Edit the Flow · run the step again / Not done (N times): …" card, not a growing stack of pairs.

Limitation: a rerun's "done again" steps (`rerun.N.place.K`) are cards that did work. If Core shows them between
attempts, they start a new stretch. Run `muwansvz` had only the reset (`rerun.5.place`), which is a note and not
shown.

### 4. R2-U-8 (card side): one list, three names

**Cause.** `card-words.ts` `shorterList` renamed Core's list to fit `HEAD_ROOM` (36):
- "name, price and 4 more" on the read card (room 27);
- "name and 5 more" on the test card (room 19).

The overlay showed Core's "name, price, rating and 3 more".

**Change.**
- `card-words.ts`: a target matching `^.+ and \d+ more$` is returned unchanged, and `shorterList` is removed.
- `CardWords` gains `whole: boolean`, which is true when such a target is longer than the head's room.
- `view/action-card-view.ts` sets `data-whole="true"|"false"` on `.chat-card-target`.
- `chat.css` adds `.chat-card-target[data-whole="true"] { overflow: visible; text-overflow: clip; white-space: normal;
  overflow-wrap: normal; }`. The list wraps at its spaces beside the kind's name, and it is never cut or broken
  inside a word.
- Other targets keep their word-boundary cutting.

**Fail-first.**
- `stream/step/tests/card-words.test.ts`, "a long target keeps whole words: a list keeps Core's name…". Failed with
  "name, price and 4 more".
- `view/tests/action-card-view.test.ts`, "a list's name is shown as Core gave it, marked whole…". Failed with "name
  and 5 more" on a test card built from Core's real title.
- Two `deepEqual` expectations gained `whole: false`.

**Next live UI review must see:** "Read list · name, price, rating and 3 more" and "Testing: Read list · name, price,
rating and 3 more", wrapped onto a second line in the 360 px panel where needed. No "…" or renaming inside the list,
and the same name as the overlay. The overlay's own fit ("reading the list of…") is the pill's word cut and is
unchanged.

### 5. R2-U-10: earlier chat ending "is ready" at moment 01. Not a panel defect; no change made

**Established.**
- The moment-01 panel picture was taken at 06:28:01.344. That is before this run's runtime dispatch (06:28:01.555),
  before the instruction was sent (overlay "Starting…" from 06:28:02.57) and before the Lab's project selection. So
  the thread on screen predates this build.
- The panel showed no context header: target `latest`, no `projectId`.
- The run uses a persistent Core workspace and profile (`run.json` `fluxiqExecution.targetMode:
  "persistent-isolated"`, workspace `t274-c`), so an earlier run's project and thread exist there.
- The panel's unscoped read resolves its project through `background/panel/conversation-relay.ts` `projectFor` →
  `context.projectId()`. That is `ProjectContext.current()` in `background/connection/project-context.ts`, which
  prefers the session's stored project over Core's current one (as t276 item 4 found).
- At moment 02 (06:28:04.15), the panel is the new project's chat ("Project chat"): it shows only this build's
  instruction bubble and no earlier turns. So the new build did not open beside the earlier chat's ending. The stale
  thread is only what the panel shows before the Lab selects its project.

**Exact change and owner (not mine).**
- `background/connection/project-context.ts` (owner: the extension connection lane). When a panel reads with no
  project (`current()` called from `projectFor`), ask Core's current context (`fetchProjectIdFromCoreSnapshot`)
  first and adopt it when it differs from the stored session project. Fall back to the stored project only when Core
  names none.
- Or, Lab side (`packages/test-runner/src/run-scenario/chat-build/creation/project.ts`): dispatch
  `fluxiq:chat-project` for the run's project before the start capture, so moment 01 shows the run's own empty
  chat.

**Next live UI review must see:** moment 01 shows the run's own (empty) project chat, once either change lands.
Until then, the old thread at moment 01 is expected and is not this build's.

### 6. R2-U-11: overlay absent at the end of moment 02. The browser's load window; no defect in my files

**Established from the samples.**
- The absent sample is at moment start + 3001 ms = 06:28:06.977. Its document's time origin is 1791268086969.9
  (06:28:06.970). So it was taken **7 ms** after the new document began. The previous sample, 196 ms earlier and in
  the old document, had the overlay.
- Across both runs in this slot (`run-muwansvz-a2b4a987`, `run-muw60j7c-bb7c9a62`), every first sample of a new
  document taken 59 ms or more after its time origin had the overlay: 59, 71, 81, 81, 112, 148 and 168 ms. The absent
  ones were taken at 7, 23 and -2 ms. (A fourth absent one, at 41 ms, was in a moment where the overlay was already
  absent before the load.)
- The re-show path works as designed: `noteContentReady` answers at once, outside the gate and the queue. A new
  document cannot draw before its content script has announced itself and the answer has arrived.

**Change.** None in owned files. The existing tests already pin the behaviour that matters:
- `activity-relay.test.ts`, "a navigation's new document gets the display at once: not paced…";
- `activity-relay.test.ts`, "a new document in the tab the overlay is drawn in is answered without resolving the
  target again".

I did not add a test that would pass without a change. The doc now records the measured window.

**Remaining saving (not mine).** The ready answer goes through `deliverToTab`, which runs `ensureContentScript` (a
`fluxiq.ping` round trip) before `sendToTab`. A frame that has just announced itself needs no ping. The owner of
`background/connection.ts` could:
1. add an optional `answerReady` dep (`(tabId, message) => sendToTab(tabId, message, 0)`) to `ActivityRelayDeps`;
2. use it in `noteContentReady` in place of `deliverToTab`.

That saves one round trip of the gap.

**Lab suggestion.** Report a document change's gap only from samples taken after a settle time (for example 100 ms
past `documentOrigin`), or take an extra sample about 100 ms after any document change. A sample 7 ms into a document
measures the browser, not the overlay.

**Next live UI review must see:** no absent sample taken 100 ms or more after a new document's origin while FluxIQ
works.

### Docs

`docs/architecture/extension-client.md` now covers:
- the starting status shown in every chat (R2-U-5);
- "not tried" for rejected calls (R2-U-6);
- the folding of repeated cards and the stretch rules (R2-U-7, replacing the `refusal-repeats.ts` passage);
- list names shown whole and wrapped (R2-U-8, replacing the "names fewer items" passage);
- the measured load window after a navigation, with the ping saving (R2-U-11).

## Commands run and observed results

Commands ran from the tree's `apps/extension`. I used a scratch wrapper,
`scratchpad/t277-ext-run.sh` → `node <scratchpad>/tools/run-subset.mjs <abs apps/extension> t277-ext <files>`, then
`node --test <bundles>`. The brief's relative `apps/extension` first argument throws in `createRequire` ("must be a
file URL object … or absolute path"), so I passed the absolute package path.

- **Baseline**, before any edit, over all 70 test files in `background/activity`, `background/panel`,
  `content/activity-overlay/**`, `panel/chat/**`, `panel/shell` and `shared/activity`:
  `# tests 536 / # pass 536 / # fail 0`.
- **Fail-first runs**, each before its fix:
  - target-activity: `not ok 12 … expected: 'Starting…'`, `# fail 1`;
  - wording: `# fail 4`, the new test "actual: … — couldn't find it on the page";
  - messages: `not ok 28 … expected: 2 actual: 6`;
  - card-words and action-card-view: `# fail 3` ("name, price and 4 more", "name and 5 more").
- **Final**, the same 70 files: `# tests 540 / # pass 540 / # fail 0 / # cancelled 0`.
- `pnpm.cmd --filter @fluxiq-web-extension/extension check` → exit 1 at `scripts/check/core-build.mjs`: "FluxIQ
  Core's build at …/t277/!FluxIQ is 26 minute(s) behind its source. Stale: …/ui/activity-action/sentences.ts". That
  is the Core worker's in-progress edits, and the brief says not to build Core.
- I then ran the check's own step: `node scripts/check-extension.mjs` (tsc over src and tests, bundles,
  browser-entry drift).
  - The first run gave exit 1 with two TS errors in my new tests: `testing` typed `boolean`, and `status` possibly
    `undefined`. I fixed both.
  - The re-run gave exit 0, no output.
- `node scripts/structure-audit.mjs` (repo root) → "structure-audit: passed (170 warning(s), 118 baselined)", exit 0.
  The only warning on a file I touched is the advisory line count on `stream/step/tests/messages.test.ts` (538 lines
  by the audit's count; it was already past 400). No `tests/` folder I touched holds more than 8 files.
- `git diff --check` → clean. A CR scan of changed and new files found none (LF).

## Not verified

- No Lab, browser or provider run (per brief).
  - The CSS wrap of a whole list target is not seen in a real 360 px panel.
  - The panel's "Starting…" is not seen live.
  - The fold is not seen in a live chat.
- The check compiled against Core's existing dist, not Core's current source. When the Core worker's list wording
  lands, `notTriedOutcome` relies on its sentence keeping the opening "FluxIQ didn't … it, as" and the phrase "the
  step didn't say which (control|list) on the page to (use|read)". Any other wording is passed through after "not
  tried: ". That is still correct, but the list substitution would not apply.
- Item 5: I did not open the persistent workspace's Core storage to name which earlier run wrote the "is ready"
  thread. The timing alone shows it predates this build.
- Item 6: the 7 ms figure assumes the sampler's `documentOrigin` is `performance.timeOrigin`, as its values suggest.

## Open questions or contradictions found

- The brief's validation command passes `apps/extension` relative, which `run-subset.mjs`'s `createRequire` rejects.
  An absolute path works.
- R2-U-11 has no product defect behind it on this evidence. If the lead wants the gap shorter, the change is the ping
  skip in `background/connection.ts` described above (not mine).
- R2-U-10's fix is outside this brief, as t276 also found; the evidence agrees with t276's diagnosis.
