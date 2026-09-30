# t197-w3: the extension's side of the robot-check hand-off

Worker report, 2026-09-30. Branch `task/t197-robot-check-handoff`, tree
`fxwork/t197/!FluxIQWebExtension`. Nothing was committed. No browser or Lab run
was made.

## Outcome

**Done.** All four parts of the brief are implemented and tested:

- The extension now tells a person-only robot check from a self-clearing one.
- A self-clearing check is waited out in place, for at most 15 s and never by
  reloading.
- A navigation to the address the tab already shows is no longer a reload when
  the tab is showing a check.
- A click that lands on a check, or a press that puts one up in place, is
  reported `USER_INTERVENTION_REQUIRED` (`web.intervention.required`). The
  record says the act itself was made.
- While the person is asked, the chat header shows Core's ask text.

The full extension suite passes (1384 of 1384) and the package check passes.
The new rows fail against the sources as they were at `HEAD`, except the
verification rows under task 4 (see below).

The brief's ownership list could not be kept exactly. Four files outside it
needed small glue edits; they are listed under "Open questions".

## What changed and why

### 1. Telling the two kinds of check apart

**`content/action-runtime/challenge-evidence.ts`**

A new function, `robotCheckIn(root, scope)`, returns `"self_clearing"`,
`"person_only"` or `undefined`. It decides from the wording and structure a
visitor sees, never from a fixture id.

It returns person-only when:

- the page asks the visitor to read characters from a picture, or shows a
  security image (the most specific signal);
- the page shows a vendor captcha widget, or asks the visitor to prove
  something: "not a robot", "verify / confirm / prove you are human", "are you
  a human", "robot or human".

It returns self-clearing when the page says it is checking by itself:

- "checking (that) your browser";
- "checking / verifying you are human";
- "check (your browser) again automatically";
- a painted, disabled button whose text says "Checking" or "Verifying", on a
  page whose words are about robots, humans, the browser, unusual traffic or a
  security check.

How ties are settled:

- A picture always means person-only.
- Otherwise the self-clearing wording wins over the person-only wording. So
  bigbox's page ("Robot or human?", a hold button, and a countdown that checks
  again by itself) is self-clearing, and the same page without the countdown is
  person-only.
- A bare "redirected automatically in N seconds" does not count, and neither
  does a plain "press and hold". Ordinary pages say both.

What a page read now covers: its headings, the whole text of a small page
(1,000 characters or less, as before), and newly the regions a page draws a
notice or a check into. Those are `dialog[open]`, `role=dialog / alertdialog /
alert / status`, `aria-modal="true"` and polite or assertive live regions. Each
region is read in full, up to 4,000 characters in total. This is what catches
local-classifieds' `role="alert"` feed cover and company-website's modal quote
box on long pages.

What `challengeIn` now returns:

- In a dialog, it returns `captcha` for any robot check, so the interference
  defence never presses a self-clearing check's Continue.
- On a page, it returns `captcha` only for a person-only check.

I split the two on purpose. The page reading feeds `challengeGateFailure` in
`results.ts`, which hands a missing target to the person. A self-clearing
cover is gone after a few seconds, and a retryable `TARGET_NOT_FOUND` is the
better answer to a missing target under one.

**`shared/page-challenge-message.ts`**

`PageChallengeResponse` gains an optional field, `robotCheck?: "self_clearing"
| "person_only"`. It is set only when `challenge` is `captcha`. Both
directions stay safe:

- A content script from before this change answers `captcha` alone, and the
  worker reads that as person-only, which is what `captcha` meant then.
- A worker from before this change ignores the new field.

**`content/message-handler.ts`**

- It answers with `robotCheckIn` first, then falls back to `challengeIn` for
  a code prompt.
- A document that is still loading (`readyState === "loading"`) answers after
  `DOMContentLoaded`, so an empty body at a click's commit is not read as "no
  check".

**`runtime/landed-challenge.ts`**

- `LandedPageReading` becomes `{ kind: "robot_check"; check }`.
- `readLandedPage` takes an optional deadline.

**What the fixtures do** (I read them; I did not run them):

| Fixture | Page | Clears by waiting? | Read as |
| --- | --- | --- | --- |
| bigbox-retail | `pages/robot-check-page.ts`: "Robot or human?", press and hold, "We'll check your browser again automatically in 8 seconds" | Yes. `pass('waited')` at 8 s, then a reload onto the results | Self-clearing |
| auction-marketplace | `pages/standalone.ts` and `client/challenge-script.ts`: reached by a 302 from the results page; "Checking your browser before you continue" | Yes. `location.replace(returnTo)` at 5 s | Self-clearing |
| local-classifieds | `client/feed-script.ts:73-94`: a `role="alert"` cover, "Checking your browser before you continue" | Yes. `HUMAN_CHECK_WAIT_MS` is 2,500 ms | Self-clearing |
| everything-store (soft) | `pages/challenges/soft-check.ts` and `client/soft-check-script.ts`: disabled "Checking your browser…"; "We're checking that your browser is set up…" | Yes, **without a press**. `softCheckAuto` is 8,000 ms, then a reload (the button unlocks at 1,500 ms) | Self-clearing, both before and after the button unlocks |
| everything-store (hard) | "Enter the characters you see below", a canvas labelled `aria-label="Security image"` | No | Person-only |
| crossborder-marketplace | `markup/verify.ts`: "please confirm you are not a robot", an "I'm not a robot" box | No. Only pressing it passes | Person-only |
| company-website | `client/quote-script.ts:67-76`: "Send request" shows "Checking you are human…", then 2,200 ms later a "Confirm you are human" box, inside `section[role=dialog][aria-modal=true]` | No. The box must be clicked | Self-clearing for 2.2 s, then person-only |

For the everything-store soft check: it clears with no press, so a navigation
now waits for it rather than reporting success on the check page. Nothing in
the fixture needs a press, so I did not keep any press-dependent behaviour.

### 2. Navigation: waiting, and not reloading a check

**`runtime/landed-check-wait.ts`** (new)

`waitOutLandedCheck` asks the page again every 500 ms:

- "No check" is confirmed only after `settle()` (the tab-ready wait) and one
  more read. That read comes back cleared.
- "Person-only" returns person-only at once.
- "Unread", which happens while the page is between documents, keeps the wait
  going.
- When the budget runs out, it returns not-cleared.

`checkWaitBudgetMs` gives 15 s, or less when the command has its own
`timeoutMs`: the remaining time minus a 1 s margin for the reply.
`settleLandedReading` runs the wait only for a self-clearing reading.
`standingCheckWords` supplies the failure text.

**`runtime/action-runner.ts`**

- The navigate branch waits out a self-clearing landing before judging it.
- If the check clears, the landing is judged as usual and the validation adds
  "a robot check stood on the page and cleared by itself after N ms,
  untouched".
- If it does not clear, or turns person-only, the result is
  `USER_INTERVENTION_REQUIRED`, with text that says so.
- The runner supplies `holdsRobotCheck` for navigations and passes
  `LANDED_TAB_ACCESS` (`sendToTab`, `waitForTabReady`) to the click path.

**`runtime/automation-tab.ts`**

- New `AutomationTabRequest.holdsRobotCheck`. It is consulted only when the
  tab already shows the URL, just before the reload that would have happened.
- If the tab shows a check, the tab is only brought to the front: no
  `chrome.tabs.reload`. The drive record gets `heldForCheck: true`.

**`runtime/navigation-outcome.ts`**

`judgeTabMovement` treats `heldForCheck` as moved and known ("the tab was
already at that address behind a robot check, so it was not loaded again").
Without this, an unmoved tab would be `NAVIGATION_UNEXPECTED`. It only matters
once the check has cleared; a check that is still standing is judged first.

**`runtime/action-results.ts`**

`navigationChallengeFailure(expected, seen?)` now takes what was seen. The
record still starts with `captcha: `.

### 3. Clicks

**Worker side: `runtime/click-landing.ts`**

`sendClickCheckingLanding(action, tabId, send, access)` now takes the frame
sender, passed in from `action-runner.ts` `runActionInFrame`. When a top-frame
navigation has committed:

- The landed frame is asked about a check. It is asked again every 150 ms, for
  up to 2.5 s, while the new document is not yet listening.
- A self-clearing check is waited out, as for a navigation.
- A check decides the landing **before** the HTTP status. A check served 403
  is the person's to answer, not a refused page.
- A check that is still standing fails the click: `USER_INTERVENTION_REQUIRED`,
  actual `captcha: the click was made, and the page it landed on (<path>) is a
  robot check…`. The landed path is given without its query.
- A check that cleared keeps the frame's reply, and its validation gains a
  note that the check cleared untouched.
- A reply lost to the page's own navigation onto a check now fails as needing
  a person, where before it rethrew the error.
- A click that commits no navigation never asks the page anything, so its cost
  is unchanged.

**Content side: `content/action-runtime/robot-check/robot-check-watch.ts`**
(new, with its barrel `robot-check/index.ts`)

`content/action-runtime/` was already at the 25-file limit, hence the
subdirectory. `watchRobotCheck(pressed)`:

- takes the page's reading just before the press;
- after the press, counts only a check that appeared, or one that turned from
  self-clearing into person-only;
- ends a person-only check at once;
- follows a self-clearing check for up to the wait it is given, ending cleared,
  person-only or not-cleared;
- with no check, ends when the window closes (with a timer exactly at the
  window's end), or when the pressed control leaves the document or the
  document starts to leave. These are the rate-limit watch's own signals.

**`content/actions/click.ts`** (the non-link path)

The robot-check watch now runs beside `watchRateLimitNotice` and settles with
the same 500 ms window (`Promise.all`). An ordinary press therefore waits no
longer than before; only a press that put a check up is followed, for up to
15 s within the command's time. The outcomes:

- a rate-limit notice still wins;
- a sighting other than cleared goes to `deps.needsPerson`;
- a cleared check passes, and the hit-test validation says it cleared
  untouched.

**Glue edits outside the listed paths, needed for the dependency to exist.**
All four are named again under "Open questions".

- `content/actions/types.ts`: new dependencies `watchRobotCheck` and
  `needsPerson`.
- `content/action-runtime/execute-action.ts`: wires those two dependencies.
- `content/action-runtime/results.ts`: `actionNeedsPerson`, which follows the
  pattern of `actionRateLimited`. It produces `USER_INTERVENTION_REQUIRED`,
  actual `captcha: the press was made, and N ms after it the page put up …`.
- `content/action-runtime/index.ts` (the barrel): exports `robotCheckIn` and
  the watch's types.

### 4. Overlay and chat

What was already in place, now confirmed by tests:

- The pacer shows a `waiting_permission` event at once, with the label as the
  detail and "Waiting for you" as the headline.
- The expanded overlay draws that detail whole (it is 72 characters; the line
  holds 160) and does not fade.
- The chat's ask rendering turns a pending `choice` ask with
  `person_done`/"Continue" and `person_stop`/"Stop" into two buttons.
  `parseAsk` ignores `route`, `parks`, `onTimeout` and `control`.

What needed a change: the chat header's one status line showed only the
headline, so it said "Waiting for you" and never the ask.
`panel/chat/header/header-model.ts` now shows the display's detail (Core's ask
text) while `outcome === "waiting"`, and still falls back to the headline when
there is no detail. No contract change was needed in `shared/activity/**`.

### Docs

- `docs/architecture/extension-client.md`:
  - new "Robot Checks" subsection under Action Surface (the two kinds, and
    where each is met);
  - a "Waiting for the person" paragraph under Live Activity;
  - the chat header text.
- `docs/architecture/failure-taxonomy.md`:
  - the `USER_INTERVENTION_REQUIRED` producers, rewritten as a list;
  - the `click-landing` and `action-results` rows.

### Tests added or changed

| File | Rows | What they cover |
| --- | --- | --- |
| `content/action-runtime/tests/challenge-evidence.test.ts` | 16 new | The fake DOM gained roles and disabled controls. The rows are each fixture's wording, plus negatives: a disabled "Checking availability" button, "redirected automatically in 5 seconds", an ordinary status region, a feed without its cover, an unsent quote form |
| `content/action-runtime/robot-check/tests/robot-check-watch.test.ts` | 9 (new file) | The watch |
| `runtime/tests/landed-check-wait.test.ts` | 9 (new file) | The wait module |
| `runtime/tests/navigate-action.test.ts` | 7 new | The stub now answers readings in turn |
| `runtime/tests/click-landing.test.ts` | 6 new | Existing rows get a no-check access by default |
| `runtime/tests/navigation-outcome.test.ts` | 1 new | `heldForCheck` |
| `runtime/tests/action-runner.test.ts` | Stub only | The stub answers `fluxiq.pageChallenge` like an ordinary page |
| `content/actions/tests/click.test.ts` | 6 new, 1 updated | The event-order row now includes `check-watch` |
| `panel/chat/header/tests/header-model.test.ts` | 1 new | The waiting status line |
| `background/activity/tests/pacer.test.ts` | 1 new | Verification |
| `content/activity-overlay/tests/overlay-view.test.ts` | 1 new | Verification |
| `panel/simple/conversation/tests/ask-copy.test.ts` | 1 new | Parses Core's person-needed ask as written, then checks the buttons and the answered sentence |

## Commands run and observed results

**Extension test suite** (first run):

```
EXTENSION_TEST_BUILD_LABEL=t197w3 bash C:/Users/osrs_/FluxStuff/build-slots/heavy.sh "t197 w3 ext test" pnpm --filter @fluxiq-web-extension/extension test
```

Exit 0: `# tests 1385 # pass 1385 # fail 0`.

**Extension test suite** (the same command, rerun after the page-scope change
to `challengeIn`): exit 0, `# tests 1384 # pass 1384 # fail 0`. The count
dropped by one because I merged two classifier rows.

**Package check**:

```
pnpm --filter @fluxiq-web-extension/extension check
```

- First run: exit 0.
- After the page-scope change: exit 0 (`"step":"extension:check"`, 104,574 ms).
- The first run noted "inputs changed while it ran (core:packages/fluxiq/src)",
  which is another lane editing Core.

**Type checks**: `npx tsc -p tsconfig.json --noEmit` and
`npx tsc -p tsconfig.test.json --noEmit` in `apps/extension`. No output (clean).

**Structure audit**: `node scripts/structure-audit.mjs` exited 1 with 4
violations. **None of them is in my paths:**

- `packages/test-runner/src/person-simulation/person-check-module.ts`
  (failure-as-empty)
- `packages/test-runner/src/person-simulation/lab-person.ts` (imports)
- `packages/test-runner/src/person-simulation/` (naming)
- `apps/scenario-lab/src/scenarios/company-website/tests/person-check.test.ts`
  (imports)

These are the Lab lane's in-progress files in this same checkout. My paths show
only advisory warnings:

- `runtime/` has 18 files;
- `action-runner.ts` is 509 lines;
- `results.ts` is 472 lines;
- `click-landing.test.ts` is 409 lines.

**Fail-before evidence.** I extracted `HEAD`'s `apps/extension/src` with
`git archive HEAD apps/extension/src | tar -x` (read-only) into my scratchpad,
dropped the new test files in, and bundled and ran them with a scratch esbuild
runner against the old sources:

| Test file | Failed / total against `HEAD` | Which rows |
| --- | --- | --- |
| challenge-evidence | 17 / 20 | Every new wording row. `robotCheckIn` did not exist, so it was stubbed; the `challengeIn` rows also fail, e.g. "'Robot or human?' … was not before" and "the same modal … and it was not a check before" |
| navigate-action | 5 / 18 | Rows 33–37: waiting out a check, not-cleared, turning person-only, and both same-address rows. At `HEAD`, a same-address navigation onto a check reloaded it |
| click-landing | 5 / 23 | Rows 57–61 |
| navigation-outcome | 1 / 14 | `heldForCheck` |
| click | 6 / 19 | The five check rows plus the event-order row |
| header-model | 1 / 6 | The waiting status line |
| pacer, overlay-view, ask-copy | 0 failed (13, 7 and 4 rows) | Verification rows: they pass before and after, as expected, because the behaviour already existed |

The click file first failed to load with `window is not defined`, a scratch
artifact: the real runner loads every bundle in one process. A `window` stub
in the scratch runner fixed it. The same runner against the current tree
passes 19 of 19.

I deleted the scratch output directory
(`apps/extension/.test-build-scratch/t197w3-before`, which git ignores).

## Not verified

- **No browser or Lab run was made**, per the brief. Unverified live:
  - that Chrome delivers `fluxiq.pageChallenge` to a just-committed document,
    and that its `DOMContentLoaded` answer arrives within the 2.5 s re-ask
    window;
  - the real timing of bigbox's 8 s and auction's 5 s clears inside the 15 s
    wait;
  - that the soft check's reload lands on the results page;
  - that `innerText` of a real `role="alert"` region reads as the fake does;
  - that the company-website modal's `aria-modal` section counts as painted.
- **A click's robot-check watch probably does not catch local-classifieds'
  feed cover.** The filter's `pushState` fires the Navigation API's `navigate`
  event, which ends the watch (the rate-limit watch does the same), and the
  feed's fetch latency can outlast the 500 ms window. The cover lifts by
  itself after 2.5 s. With the page-scope split, a missing target under it is a
  retryable `TARGET_NOT_FOUND`, not a hand-off. A snapshot taken during those
  2.5 s would still see the cover.
- **A self-clearing check in a dialog that covers a target.** `blocking-dialog.ts`
  (not mine) reads `challengeIn(dialog, "dialog")`. A self-clearing check drawn
  as a dialog over the target is therefore reported person-kind
  `USER_INTERVENTION_REQUIRED` rather than waited out. This was not observed in
  any fixture.
- The domain's handling of a click or press result coded
  `USER_INTERVENTION_REQUIRED`, which is w4's. The domain's `refusal.ts`
  comment says such a result "did not act". My records say in text that the
  press or click *was* made. The failure row's `effect` is fixed by the domain
  table ("the effect is the row's, never the caller's"), so there is no
  structured "applied" flag; the fact is only in words.
- The overlay's collapsed pill shows only "Waiting for you", by design; the
  ask appears in the expanded pill and the chat header.

## Open questions or contradictions found

1. **Edits outside the listed ownership** (the brief said "edit only the paths
   you own"):
   - `content/action-runtime/results.ts`: `actionNeedsPerson`, about 25 lines.
   - `content/action-runtime/execute-action.ts`: 2 wiring lines.
   - `content/action-runtime/index.ts`: exports.
   - `panel/chat/header/header-model.ts`: covered by "the minimal activity/panel
     edits in 4".

   The first three follow from the brief: it assigns `click.ts` and `types.ts`
   a new dependency, and a verb cannot build a result itself, so the builder
   and its wiring must live in those files. Nothing outside the brief's
   extension scope was touched, and nothing in the "Must not touch" list.
2. **`docs/architecture/failure-taxonomy.md` is edited by two workers.**
   Another worker added "A Robot Check Parks, It Does Not End" to the same
   file in this checkout while I worked. My edits (the producers list, the
   click-landing and action-results rows) are in other paragraphs, and both
   are present now. The supervisor should read the file whole before
   committing. `docs/architecture/testing-facility.md` also shows as modified,
   and that is not mine.
3. **Is the page-scope split right?** Only a person-only check is `captcha`
   on a page; any check is `captcha` in a dialog. It keeps a self-clearing
   cover from sending a missing target to the person. The cost is that a Flow
   whose target is missing because a self-clearing check never cleared is
   retried as `TARGET_NOT_FOUND` rather than handed over. Navigation and click
   still hand such a check over after 15 s, so this only affects the
   missing-target gate.
4. The brief lists "a disabled 'checking' button" as a self-clearing signal on
   its own. I require the page to also talk about robots, humans, the browser
   or a security check. A bare "Checking availability…" button on a shop page
   would otherwise read as a robot check.
