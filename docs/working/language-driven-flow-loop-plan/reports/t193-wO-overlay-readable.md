# t193-wO: the on-page overlay is always readable and its text is stable

Worker t193-wO (worker-high), 2026-10-02. Brief: "t193-wO-overlay-readable". Tree:
`fxwork/t193/!FluxIQWebExtension`. Nothing is committed. No Lab run, browser session or provider call was made.

## Outcome

**Done.** The overlay no longer becomes a text-less dot. When every corner of a busy page is taken, it stays a pill
with its words, at the least-busy place, narrower if that covers less. Long lines end in an ellipsis and are never
removed. A new content-side dwell keeps each status line up for at least 1000 ms. The newest waiting status wins and
the last one always reaches the page. A test proves that the cover checks ignore the pill.

## Cause found

- **The dot.** `placement/choose-placement.ts` rule 3 returned `{ shape: "dot" }` whenever every corner had at least
  one sampled point on a **fixed, sticky or dialog** part of the page. `status-pill.ts` then hid every text line.
  - The brief said "busy with controls"; that is not quite right. Controls only break ties between clear corners and
    never caused the dot.
  - A feed has a sticky header (top corners), plus fixed bars or docks at the bottom (bottom corners). On such a page
    the dot is the common case.
  - Evidence (lane D `run-murdouox-c5294247.ui-review.local.json`):
    - Moment 3 on `~/friends/`: a dot at x 1217 y 345, which is the right midpoint (viewport 1263 wide less the
      16 px margin and the 30 px dot). It became the bottom-right pill at about 400-600 ms, presumably after "Close
      chat" cleared that corner, so it changed shape and place while sampled.
    - Moment 5 on the feed: a dot at x 16 y 674, the bottom-left corner (720 - 16 - 30).
- **Why placement avoided fixed parts.** The reason was what the *person* sees, not what the automation does:
  - The source comment cites U3 of the t174 UI review and supervisor review #7, where the pill sat over
    company-website's cookie banner.
  - Every overlay node is `pointer-events: none` (`inert-element.ts`), so `elementFromPoint` passes through it.
    This covers the actionability gate (`action-runtime/actionability.ts`, `deepElementFromPoint`), the snapshot's
    cover check (`evidence/overlays.ts`, the source of the page view's COVERING line and `covered-by`), the
    interference defence (`action-runtime/interference/overlays.ts`) and the covering-layer sentence.
  - `evidence/overlays.ts:152`, `interference/overlays.ts:131` and `covering-layer.ts:64` also skip any hit that
    carries `data-fluxiq-activity` (`isExtensionUiNode`).
  - The snapshot walk prunes the host (`rendered-elements.ts:137`).
  - The content sits in a closed shadow root, so composed walks never reach it.
  - So a readable pill over a control changes nothing an action or the page view sees. No change to either
    detection file was needed, and I made none.
- **"Flickering" at moment 3.** The background pacer already allows at most one detail change per 1200 ms
  (`background/activity/pacer.ts`). Moment 3's changes were about 1.2 s apart:
  - 0 to 205 ms, "Clicking Friends - done" to "Deciding the next step";
  - about 1300 ms, to "Clicking Close chat";
  - about 2500 ms, back to "Deciding the next step".
  - The Lab counts three or more text changes, or any revisit, in 3 s as `flickering`
    (`packages/test-runner/src/run-scenario/ui-review/count-overlay-changes.ts:41`). So this reading is mostly the
    pacer's normal 1.2 s cadence plus the dot-to-pill shape change, not sub-second flicker.
  - Two gaps remained, and the content dwell now closes both:
    - nothing held a line on the page side;
    - a headline or settle change goes out at once from the pacer, and the readiness answer can cross a paced send.
- **The presence toggle at moment 2.** It is the overlay *arriving* (absent for 10 samples, then present for 6).
  Nothing toggled during work. Whether the 2 s before it was work without a display could not be determined from the
  content side (see Not verified).

## Design

- **Placement** (`placement/choose-placement.ts`):
  - `OverlayPlacement.shape` is `"pill" | "narrow"`. `PlacementInput.dot` is replaced by `narrow` (the narrower box
    for the current mode).
  - Rules 1 and 2 are unchanged: a clear corner, and a held clear corner is kept.
  - New rule 3, when every corner is busy: search `bottom-left, top-left, left, bottom-right, top-right, right`
    (left side first, matching rule 1), each with the full and the narrow box. The rank is lexicographic:
    1. fewest fixed sample points;
    2. full pill before narrow;
    3. the place already held (so controls scrolling past do not move it);
    4. fewest controls;
    5. order.
- **Status pill** (`status-pill.ts`):
  - The dot shape is gone. Each mode has a fixed full and narrow box: expanded 384x66 / 288x66, collapsed 300x36 /
    224x36.
  - The headline always shows. The step and detail show in the expanded mode at either width, ending in an ellipsis
    when they do not fit.
  - A change of mode re-pins the host, because a side midpoint is centred by the box height.
- **Dwell** (new `status-dwell.ts`, wired in `overlay.ts`): `STATUS_DWELL_MS = 1000`.
  - Different words wait until the words already up have had the dwell. A newer status replaces one that is waiting.
    The waiting status is always drawn when the dwell ends, settled ones included.
  - These apply at once: the same words with a different mode, mark or colour; a status back to the words already up
    (which also cancels the waiting one); and a take-down (`null`, which drops the waiting one).
  - **Why 1000 ms.** That is about the time to read a 3-5 word status at 4-5 words a second. It is also below the
    pacer's 1.2 s, so a send the background paced is never held. The dwell acts only when sends bunch.
  - The source of the overlay's sequence guard was renamed `drawn` to `received`, because it records receipt, not
    drawing.

## Files

- Changed:
  - `apps/extension/src/content/activity-overlay/{index.ts, overlay.ts, status-pill.ts}`
  - `apps/extension/src/content/activity-overlay/placement/{choose-placement.ts, index.ts, placement-keeper.ts}`
    (`placement-keeper.ts` is a comment only)
- New:
  - `apps/extension/src/content/activity-overlay/status-dwell.ts`
- Tests:
  - New: `tests/status-dwell.test.ts`, `tests/cover-detection.test.ts`, `tests/fake-clock.ts` (test support)
  - Edited: `tests/overlay.test.ts`, `tests/status-pill.test.ts` (the dot test replaced),
    `placement/tests/choose-placement.test.ts` (three dot tests replaced)
- Not touched: `panel/**`, `shared/activity/**`, `background/**`, the detection files, `domain/**`, `packages/**`,
  Core.

## Failing-first output

The new tests ran against the unchanged source, using scoped runner `scratchpad/t193-wO-test-extension.mjs` (label
`t193-wo`) over `content/activity-overlay`, with `status-dwell.test.ts` set aside because its module did not exist
yet. Result: `# tests 41`, `# pass 32`, `# fail 9`.

- Choose-placement tests 8-11 failed, for example:
  - 8, "every corner busy: the pill, text and all, at the least-busy edge -- never a dot":
    `actual: { shape: 'dot', anchor: 'bottom-left' }`, `expected: { shape: 'pill', anchor: 'left' }`.
  - 10: `Expected "actual" to be strictly unequal to: 'dot'`.
- 41, "a page with every corner busy keeps a pill with its text, never a dot": `error: 'not a dot'`,
  `actual: '30px'`.
- 30, "rapid statuses are shown no faster than the dwell...": `error: 'still the first line at 80 ms'`.
- 31 and 32 cascaded from 30 aborting before its take-down. The module-level pill kept a host connected to the
  previous fake document. Each overlay test now also takes the overlay down at its start.
- 19, "the same check does report a page banner": `HTMLInputElement is not defined`, then `CSS is not defined`. These
  were stub defects, fixed by stubbing those globals; the test then passed.
- The cover-detection tests 18 and 20 **passed on the unchanged source**, as expected, because the exclusion already
  existed. They are guard tests, not failing-first. Test 19 is their discriminating control: the same stub reports a
  real page banner as covering the button.

## Commands run and observed results

- Scoped tests after the fix (`content/activity-overlay`): `7 test files`, `# tests 44`, `# pass 44`, `# fail 0`.
- `heavy.sh "t193-wO tests"` over `content/activity-overlay content/evidence content/action-runtime/interference`:
  exit 0, `17 test files`, `# tests 111`, `# pass 111`, `# fail 0`.
- `background/activity` (its `activity-replay.test.ts` imports the overlay barrel): `6 test files`, `# tests 58`,
  `# pass 58`, `# fail 0`.
- Final run after converting my files back to LF, over all four directories: `23 test files`, `# tests 169`,
  `# pass 169`, `# fail 0`.
- `apps/extension`:
  - `heavy.sh "t193-wO tsc" npx tsc -p tsconfig.json --noEmit`: exit 0, no output.
  - `heavy.sh "t193-wO tsc test" npx tsc -p tsconfig.test.json --noEmit`: exit 0, no output.
- Downstream root `node scripts/structure-audit.mjs`: exit 0,
  `structure-audit: passed (157 warning(s), 118 baselined).` None of the warnings is in `activity-overlay`.

## Not verified

- **No live or browser check.** The real rendering is unseen: how the narrow pill reads, ellipsis placement, and
  whether the headline still fits beside "Step N of M" at 288 px (estimated at about 140 px for the headline). So is
  the real hit-test pass-through on a real page; the pass-through rests on `pointer-events: none`, which the unit
  tests pin node by node, not on a browser run.
- **The Lab's `flickering` reading is not fully addressed.**
  - At the pacer's 1.2 s cadence, a 3 s window still holds up to three changes. A revisit such as "Deciding the next
    step", then "Clicking X", then "Deciding the next step" also counts.
  - The dwell (1000 ms, below the pacer) does not reduce that rate. It prevents sub-second changes only.
  - Meeting the Lab's threshold needs either a longer pacer interval (`background/activity/pacer.ts`, not mine and
    not requested) or a different Lab rule. This is for the supervisor to decide.
- **Placement can still move** the pill between places as fixed parts come and go, at most once per 800 ms. It no
  longer changes shape to a dot. Moment 3's dot-to-pill switch would now be a move from the right midpoint to the
  bottom-right corner.
- **The 2 s absence before the first display at moment 2.** I could not tell, from the content side, whether work had
  started before Core's first activity event.
- **Screenshots.** `background/connection/state-assets.ts` uses `chrome.tabs.captureVisibleTab`. A screenshot taken
  while the pill sits over a control shows the pill. This was already true of the corner pill over ordinary content.
  I did not trace whether such screenshots reach a model.

## Open questions or contradictions found

- **Doc follow-up (not owned).** `docs/architecture/extension-client.md:446-447` still says: "When every corner is
  busy it shrinks to a 30-pixel dot, carrying only the mark, at whichever corner or side midpoint covers least."
  Suggested replacement: "When every corner is busy it stays a pill with its words, at the corner or side midpoint,
  full or narrower (288/224 px), that covers fewest fixed points, keeping the place it holds on a tie; it never
  becomes a text-less dot."
  - Lines 461-462 ("That fade is the only timer...") are now out of date as well. The dwell is a second timer: a
    change of words waits until the words up have had 1000 ms (`status-dwell.ts`), the newest waiting status wins,
    and the last is always drawn.
- **Brief wording.** The brief said the dot came from corners "busy with controls". It came from fixed, sticky or
  dialog parts; controls only break ties.
