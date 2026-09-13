# f-pointer-click-pairing — P3, a quick second click is kept (extension)

Worker report, 2026-09-13. Brief: `briefs/finish-week1.md`, "f-pointer-click-pairing"
under the twenty-fifth dispatch.

## Outcome

Done. Each click is now paired with its own pointerdown by event order in its
frame. The old rule suppressed a signature for 750 ms. Now a pointerdown and its
click are one recorded action, and a second press of the same unmoved control is a
second action however soon it comes. All three required rows have a mutation
proof, and every restore was confirmed byte-identical by SHA-256. Nothing was
committed.

## What changed and why

**Re-verified at HEAD first.** `pointer-click-filter.ts:4,9-19` at HEAD held a
signature for 750 ms. `recorded-event-intake.ts:85-86` at HEAD dropped any
pointerdown whose signature was still held. P3 was not already settled.

**`apps/extension/src/background/connection/pointer-click-filter.ts`**, rewritten.
The file has no timer any more. It keeps one pending press per tab and frame (a
signature and a `sequence`).
- `notePress(tabId, frameId, signature, sequence)` records a frame's press. It
  replaces a press whose click never came.
- `isClickOfPress(tabId, frameId, signature, sequence)` spends the frame's press
  every time. It returns true only when the click has the press's signature and a
  higher sequence.
  - Spending on every click is correct because a press produces at most one click:
    the next trusted click its document dispatches. That click lands on the pressed
    control, or on a common ancestor when the release lands elsewhere.
  - The sequence restarts in every document. A lower sequence therefore marks a
    later document's click, which cannot pair.
- `clear()` is kept; `active-recording.ts:188,363,398` calls it.
- The class is still the only export, so the barrel `index.ts:42` is unchanged.

**`recorded-event-intake.ts`**, only its use of the filter (lines 3 and 82-87).
- Every `sourceEvent: "pointerdown"` is noted and recorded; no pointerdown is ever
  dropped.
- A `sourceEvent: "click"` is dropped only when `isClickOfPress` is true.
- The header comment now says the intake "pairs a click with the press that
  produced it".

**What a keyboard-activated click does now.** Enter or Space on a focused control
fires a trusted `click` with no pointerdown. It pairs with nothing and is recorded
as one action.
- Its `dom.keydown` is still recorded before it, as before.
- At HEAD such a click was dropped if it came within 750 ms of a mouse press on
  the same control. It no longer is.

**What a synthetic click does now.** Nothing changed.
- An untrusted click never reaches the filter. The content script returns on
  `!event.isTrusted` (`content/dom-events.ts:45,66`). That covers a page's
  `element.click()` or `dispatchEvent`, and the extension's own replay in
  `content/actions/click.ts`.
- A trusted click with no pointerdown is recorded once. The click a `<label>`
  forwards to its control is one example. Its target walks up from the control
  (`content/event-elements.ts:45-61`), so its signature differs from the label's
  press, and it was recorded at HEAD too.

**Other behaviour to know.**
- A double-click records two click actions, because its two clicks are two
  pointerdown-click pairs. A triple-click records three. This is the brief's rule
  ("a second activation ... however soon").
- A long press held for more than 750 ms and then released is now one action. At
  HEAD it recorded two, because the window had closed before its click arrived.

**Tests.**
- `tests/pointer-click-filter.test.ts` is rewritten with six rows and no fake
  timers:
  - pairing;
  - one click per press;
  - no press, or another frame, tab or control;
  - an earlier sequence;
  - a replaced press;
  - `clear`.
- `tests/recorded-event-intake.test.ts`:
  - The row "a pointerdown and its click record one action, the press" is rewritten.
    It checks the sent event id `web.1.1001`.
  - New row: "two pointerdown-click pairs on the same unmoved control 250 ms apart
    record two actions". It uses W14's Flow-lane timing and no mocked clock.
  - New row: "a click with no pointerdown records one action".
  - `holdTimers` and the unused `TestContext` import are removed, because the
    filter no longer has a timer.
  - `click()` gained an optional timestamp.

## Commands run and observed results

All extension commands ran from `apps/extension` with
`EXTENSION_TEST_BUILD_LABEL=fpcp`, output redirected to a file, and `$?` echoed.

- **First run, `pnpm test`** -> `exit=1`, `# tests 411`, `# pass 410`, `# fail 1`.
  - The one failure was `not ok 132 - a succeeded action confirms the recording
    event and input its type maps to` in `runtime-status.test.ts:84`: expected
    `{ inputId: 'web.user.checkbox_toggled', kind: 'dom.change' }`, got `undefined`.
  - That test is the P2 worker's new, in-flight test, in a file I do not own. My nine
    rows all printed `ok`.
- **First `pnpm check`** -> `exit=0` (`tsc -p tsconfig.json --noEmit && tsc -p tsconfig.test.json`).
- **First `node scripts/structure-audit.mjs`** (repository root) -> `exit=0`,
  `structure-audit: passed (39 warning(s), 17 baselined).` No warning names either
  of my files.
- **Hashes of the final files (SHA-256), taken before any mutation:**

  | File | SHA-256 |
  | --- | --- |
  | `pointer-click-filter.ts` | `9664f2f710e1347137bcbed3fff32d2d93d3d9795e02a16b7507486d6aac47f9` |
  | `recorded-event-intake.ts` | `737aceb710a9219af76d75edea21f708130a9ed6e90f0203c486bcd08394feb3` |
  | `tests/pointer-click-filter.test.ts` | `946050656c35fe11b30ec0a75e830fdf1b2dad176415ec636b5c216e6bc45401` |
  | `tests/recorded-event-intake.test.ts` | `fc851a11ddc00373fd7a71b93169edb9993a30cc2ea6862b60fa2aa0623a50af` |

**Mutation proofs.** Each ran `node scripts/test-extension.mjs`. That runner bundles
with esbuild and does no type check, so a mutation that changes the API still runs.

- **Row 1, "a pointerdown and its click record one action".**
  - Mutation: in `isClickOfPress`, `sequence > press.sequence` became
    `sequence < press.sequence`, so no click pairs.
  - Result: `exit=1`, `# tests 413`, `# fail 6`, including
    `not ok 105 - a pointerdown and its click record one action, the press`:
    `Expected values to be strictly deep-equal: + actual - expected [ + 'client.recording_event', 'client.recording_event' ]`
    at `recorded-event-intake.test.ts:158`.
  - Restored by copying the final version back. Hash `9664F2F7...` matches the
    final file.
- **Row 3, "a click with no pointerdown records one action".**
  - Mutation: `return press !== undefined && ...` became
    `return press === undefined || (...)`, so a click with no press is dropped.
  - Result: `exit=1`, `# fail 6`, including
    `not ok 107 - a click with no pointerdown records one action`:
    `Expected values to be strictly equal: 0 !== 1` at `recorded-event-intake.test.ts:182`.
  - Restored. Hash `9664f2f7...` matches the final file.
- **Row 2, "two pointerdown-click pairs ... 250 ms apart record two actions".**
  - Mutation: both source files were replaced with their HEAD versions
    (`git show HEAD:...`), which reinstates the 750 ms suppression, the P3 defect
    itself.
  - Result: `exit=1`, `# tests 413`, `# fail 9`, including
    `not ok 106 - two pointerdown-click pairs on the same unmoved control 250 ms apart record two actions`:
    `Expected values to be strictly equal: 1 !== 2` at `recorded-event-intake.test.ts:175`.
  - Under that mutation, rows 105 and 107 printed `ok`, as they should: those
    behaviours already existed at HEAD.
  - The other failures were my six filter unit rows, which call the new API, and
    `runtime-status` rows 132 and 134, which belong to the P2 worker.
  - Restored both files. Filter `9664f2f7...` and intake `737aceb7...` both match
    the final files.
- Row 1's mutation also failed row 2 (`4 !== 2`). The filter unit rows failed under
  every mutation.

**Final gates, run one at a time on the restored files.**
- `pnpm test` -> `test exit=0`, `# tests 413`, `# pass 413`, `# fail 0`. All nine of
  my rows printed `ok`.
- `pnpm check` -> `check exit=0`.
- `node scripts/structure-audit.mjs` -> `audit exit=1`:
  `FAIL [working-docs] docs/working/README.md is out of date with the documents' header blocks.`
  - That file is not mine, and it changed while other workers edit working documents.
  - Rerun once, alone -> `audit rerun exit=0`,
    `structure-audit: passed (39 warning(s), 17 baselined).` Neither run names my files.
- `.test-build-scratch/fpcp` was removed afterwards; it no longer appears in that
  directory's listing.
- `git diff --stat` on the four files: `4 files changed, 114 insertions(+), 83 deletions(-)`.
  No other file was edited.

## Not verified

- **No content harness run.** The brief's test list did not name one, and no
  content-harness spec drives the background intake.
  `e2e/content/tests/identity-wire-chain.spec.ts:43-57` reads only the press event
  from the content script.
- **No live browser run** of a real double-click, a keyboard activation, a long
  press, a touch press cancelled by a scroll, or a label click.
- **No Lab run**, as the dispatch rules require. A Lab run must show:
  - W14 unarmed records `web.element.clicked` 2 on both lanes and passes;
  - W14 `armed` reports `user_intervention_required` (from `i-bench-triage`);
  - no scenario that clicks once now records `web.element.clicked` one higher than
    its manifest pins. A doubled click would mean a press and its click failed to
    pair live, for example because the control's bounds changed between them.
- **No root `pnpm check`, `pnpm test` or `pnpm build`**, per the dispatch rules.
- Every result above is a single observation on this machine. The mutation proofs
  failed in exactly the rows expected, with real assertion diffs, so nothing here
  looks like a hardware fault.

## Open questions or contradictions found

1. **A comment in a file I do not own is now stale.**
   `apps/extension/src/background/connection/recording-start/tests/handshake.test.ts:12-13`
   says its `fakeTimers` follows "the pattern pointer-click-filter.test.ts uses".
   That test no longer has fake timers, because the filter has no timer. The fix is
   one line: drop the reference, and keep the Node 22 ExperimentalWarning reason.
2. **One residual case drops a click it should keep.** Two things must both happen:
   - a press whose click never comes, from a touch press cancelled by a scroll or a
     page that navigates on press;
   - then a pointer-less click, such as a keyboard activation, on the same selector
     with the same rounded bounds, in the same tab and frame, with a higher
     sequence.

   A mouse press in between replaces the stale press, and a new document's click
   usually carries a lower sequence. I considered clearing a frame's press on
   `content.ready` and did not add it. `acceptContentReady` awaits
   `setRecordingState` and a snapshot before it re-enters `accept`, so a clear there
   could erase a fresh press from the new document and record its click twice. It
   would be safe only as a synchronous clear at the top of `acceptContentReady`, if
   the router delivers that message ahead of the new document's events. I did not
   verify that.
3. **Unchanged from HEAD, and possibly worth a separate look.** Pairing still
   requires equal signatures, and `clickEventSignature` (`recorded-event.ts:39-52`)
   includes rounded bounds. A control that moves or resizes between its pointerdown
   and its click (an `:active` transform, or a layout shift on press) records both.
4. **Documentation.** A grep of `docs/architecture` for `PointerClickFilter`,
   `pointer-click` and `750 ms` found no description of the click window. Both
   `750 ms` hits (`extension-client.md:318`, `testing-facility.md:314`) are the
   recording-start wait. `identity-wire-chain.spec.ts:46` says the filter "keeps the
   first to arrive, the press", which is still true in effect. No authored page needs
   a change as far as that grep shows.
