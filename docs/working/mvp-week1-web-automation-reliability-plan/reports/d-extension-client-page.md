# d-extension-client-page — the extension client page describes the recording start, the page-change flush and the late-target wait

Worker for the thirty-fifth dispatch, audit items E1, E2 and E3 from
`reports/i-arch-pages-audit.md`. Repository at `af80298`; the page was unchanged in
the working tree when this worker began (`git status --short -- docs/architecture/`
printed nothing).

## Outcome

Done. `docs/architecture/extension-client.md` now describes all three items. It
describes the current design only, with no plan history, and says nothing about
the wait's timeout.

## What changed and why

Only `docs/architecture/extension-client.md` was edited: 159 insertions and 30
deletions before the last one-line link edit.

- **E2, a page change is sent before an action.** The evidence list now says the
  mutation batch is "sent ahead of the next action". A new paragraph follows the
  typed-text flush. It says:
  - the content script adds changes up into one `dom.mutation` batch with four
    counts, sent after 500 ms of quiet (`content/recorder.ts:30,36`);
  - a pending batch is sent first ahead of `dom.click`, `dom.input`, `dom.change`,
    `dom.submit` or `dom.keydown` (`:23,55`);
  - that early send counts changes the observer has queued but not yet delivered
    (`:107-112`);
  - a scroll or a navigation leaves the batch to its quiet period
    (`content/tests/recorder.test.ts:100-106`);
  - nothing is batched with mutation capture off (`recorder.ts:33,64`);
  - a batch carries no DOM snapshot (`content/snapshots.ts:3-9`), so the
    background worker sends it as a `client.state_update` under
    `web.recording.evidence`, with `latestEvidence` (`recording-evidence.ts:131-133,156-169`;
    `domain/src/io/input-model.ts:9`).
- **E1, the recording start.** The single sentence about the 750 ms window is
  replaced by three blocks. The refusal text after them is kept as it was.
  - **The handshake** (`recording-start/handshake.ts`):
    - FluxIQ accepts with `server.start_recording` (`:7`);
    - the window opens before the send (`:142-154`);
    - the send's project lookup is capped at 1,500 ms
      (`active-recording.ts:53,334-353`);
    - an elapsed window waits for the send to settle (`:8-11,172-180`);
    - an answer in that gap still decides the start (`:120-121`);
    - each retry waits for its own send (`:67-69`);
    - a send that never settles never falls back, and a second press only
      reports that the start is under way (`:147-148`; `active-recording.ts:144-146`);
    - disconnecting cancels it (`background/connection.ts:295`).
  - **Starts once** (`active-recording.ts:11-13,205-262`): `beginOnce`, and six
    cases for what a `server.start_recording` names, each matched to
    `expectsStart` (`:232-240`) and to the tests at
    `tests/active-recording.test.ts:308,341,365,397,420,430,458`.
  - **Core's side** (Core
    `packages/fluxiq/src/programs/automation-studio/client-gateway/bridge.ts`):
    - later messages wait for the start to settle (`:300-310`);
    - earlier messages never land in the recording (`:287-288`);
    - the acknowledgement is sent only once the recording is open, and never after
      a Stop (`:360-363`).
    - Cited as a Core path in code, not as a link, so the page has no link into
      another checkout.
- **E3, the late-target wait: new section `### A Wait Before A Late Target`.**
  - **What it states:**
    - the rule and its source (`late-target-wait.ts:35-91`);
    - the `input.event` observation it starts from;
    - the four conditions;
    - the cases that propose nothing;
    - the candidate's output, condition, confidence and label, without any
      timeout;
    - no `sourceInputIds` or `expectedConfirmation`, and why (`:15-17`);
    - that the rule does not check the added node is the target (`:67-73`, which
      only counts);
    - that it is proposed from the batch's entry, never the click's
      (`web-panel-host.ts:124-125,135`);
    - that it depends on both stored-order guarantees (Core's
      `client-recording-write-order.ts:10-20`);
    - the pins: `domain/src/tests/core-gateway-recording-order.test.ts:166-173`
      and `domain/src/recording/proposals/tests/late-target-wait.test.ts`.
  - **What it leaves out:** the timeout (`late-target-wait.ts:15`), as the brief
    requires.
- **Structure.** The page had no heading to link the wait from. So the proposal
  text moved into a new `## Recording Proposals` section, placed before
  `## Default Endpoint`:
  - a short intro names `mapWebRecordingObservation` and the 32-entry
    `following` window;
  - `### A Click's Landing` holds the existing landing text, unchanged apart from
    its first sentence, whose mapper reference moved into the intro;
  - `### A Wait Before A Late Target` is new.
  - The two paragraphs that used to follow the landing text (`visualTarget`, and
    the side panel's recordings tab) moved up so they stay under
    `## Recording Evidence`.
  - The landing paragraph's "(see below)" became a link to `#a-clicks-landing`.
  - The anchor other pages use, `extension-client.md#recording-evidence`
    (`web-capabilities.md:308`, `page-evidence.md:10`), is unchanged.

## Commands run and observed results

All were run from `F:\!FluxIQWebExtension`.

- **Link check, before editing:**
  `node C:/Users/mrjoh/AppData/Local/Temp/claude/f---FluxIQWebExtension/4f264c80-323b-4673-a09a-bde5851669f3/scratchpad/dcd-check-links.mjs docs/architecture/extension-client.md`
  printed `checked 38 relative links in 1 page(s), 0 unresolved`, exit 0.
- **The same link check after the edits:**
  - first `checked 44 relative links in 1 page(s), 0 unresolved`, exit 0;
  - after the final one-line edit, `checked 45 relative links in 1 page(s), 0 unresolved`,
    exit 0.
- **`node scripts/structure-audit.mjs`**, output redirected to a scratch file:
  - after the main edits, exit 0 and `structure-audit: passed (40 warning(s), 17 baselined).`;
  - rerun after the final edit, exit 0 with the same line.
- **`git diff --stat -- docs/architecture/extension-client.md`:** `1 file changed,
  159 insertions(+), 30 deletions(-)`, before the final one-line edit.

## Not verified

- **No tests were run.** The page makes no claim a test does not already pin, but
  its statements were checked by reading the code and test titles cited above, not
  by running those tests at this HEAD.
- **A renderer's view of the new anchors.** The link checker's slug rule accepts
  `#a-wait-before-a-late-target` and `#a-clicks-landing`. GitHub's rule was not
  checked, and the apostrophe in "A Click's Landing" is the likeliest point of
  difference.
- **Core line numbers.** They are from the working tree at `F:\!FluxIQ` as read
  today, not from a pinned Core commit.
- **The timeout.** Whether `g-web-timeout-forwarding` changes what the wait
  candidate carries was not checked. The page names no timeout, so it stays true
  if one is added. If that worker adds a `timeoutMs` to the candidate, the
  sentence listing the candidate's condition, confidence and label is still
  accurate but incomplete.
- **Lab.** None of this is Lab-observable as a docs change, and no Lab command
  ran.

## Open questions or contradictions found

1. **The new anchor for other pages.** The late-target wait's section is
   `extension-client.md#a-wait-before-a-late-target`. The audit's W1 fix
   (`web-capabilities.md:137`) and I2 (`element-identity.md:193-195`) ask to link
   to it. The workers owning those pages run in parallel and cannot know the
   anchor unless told.
2. **Code comments that already agree.** `late-target-wait.ts:4-5` and
   `recorder.ts:9-11` agree with the page. No stale comment was found in the files
   read, and none was edited.
