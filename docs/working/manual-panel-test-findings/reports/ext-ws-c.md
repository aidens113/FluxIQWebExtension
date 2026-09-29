# ext-ws-c: Workstream C -- the Advanced view and the Lab journeys

Status: DONE (live journey unexercised; see Not verified). Spec: `ext-ui-audit.md` section 4 ("What moves
to Advanced", "Switching") and section 5 ("Contracts pinned", "Accessible names the Lab drives",
"Workstream C"). Built on A (d447ca70). This work was interrupted twice by machine and session restarts.
After each one, every file was checked on disk for truncation, NUL bytes and non-ASCII corruption, and
none was found.

## Outcome

Done. The Advanced view is complete under `apps/extension/src/panel/advanced/` (22 files) and exported
as `mountAdvancedView`. It is not mounted yet: the entries still mount A's `placeholderViews`, and
swapping them is the supervisor's integration edit (Open question 1). Both Lab journeys now use the new
accessible names.

## What changed and why

- `apps/extension/src/panel/advanced/**` (new):
  - `advanced-view.ts`: the view with a tab strip (`tab-strip.ts`, `tab-panel.ts`) over the Activity,
    Recordings, Step and Connection tabs. Only the visible tab runs timers (`hidden()` stops them).
  - `activity-tab.ts`: the activity log, paged with `pager.ts` and `page-count.ts`.
  - `recordings-tab.ts` and `recordings-copy.ts`: the recordings list from Core, showing "n steps · date",
    the status in words, and which host the list came from. It never shows a raw id or "events unknown".
    It refreshes when a recording stops while the tab is shown.
  - `step-tab.ts` and `step-rows.ts`: the current or last step, with its selector, tab and start time,
    and the raw failure message. Only Advanced shows these.
  - `time-copy.ts`: `relativeTime`.
  - `connection/`:
    - `connection-tab.ts`: settings are stored by an explicit Save, which shows "Saved.". Save reconnects
      only when the connection address changed on a live connection (`save-plan.ts`).
    - `settings-form.ts` and `settings-fields.ts`: the labels the audit pins.
    - `draft-store.ts`: keeps an unsaved draft for convenience; Save works the same without it.
    - `forget-confirmation.ts`: "Forget this pairing" (was Reset Session) asks inline, puts focus on
      Cancel, and is confirmed with "Forget".
  - Tests are in `tests/advanced-copy.test.ts` and `connection/tests/connection-settings.test.ts` (15 tests).
- `packages/test-runner/src/demo-workspace/browser-session.ts`: the connect journey now fills "FluxIQ
  connection address" and "FluxIQ web address". It checks "Reconnect automatically", "Record page
  changes", "Record what I type" and "Record page snapshots". It then presses Save and waits for
  "Saved.", and returns with the "Simple" radio. The "Close" button is gone. Connect is pressed only
  when the state is disconnected, error or reconnecting, because Save may already have reconnected. The
  button is matched by `/^(Connect|Try again|Try now)$/`.
  - Diagnostic facts: `settingsClosed` is replaced by `settingsSaved` and `simpleViewShown`. That makes
    exactly 12, which is the recorder's cap (`browser-evidence.ts:96`).
  - Step ids: `settings-close` is replaced by `settings-save` and `view-simple`. Grep found no other
    reader of the old ids or of `settingsClosed`, except a literal fixture in
    `browser-evidence.test.ts`. That fixture does not depend on the journey and still passes the cap.
- `packages/test-runner/src/ui-e2e/journeys/extension-project.ts`: "Reset Session" becomes "Forget this
  pairing" followed by "Forget", and "Close" becomes the "Simple" radio. The step ids stay the same.

### Workstream D's `code` on a failed PanelResult

No change was needed in C's files. None of the Advanced view's requests goes through a panel relay.
These are `panelSaveSettings`, `connect`, `disconnect`, `resetSession`, the activity log and
`listRecordings`. Their background handlers either return `{ ok: true, ... }` or throw.
`background/index.ts:94` answers a throw with `{ ok: false, error }` and no `code`, so `code` is always
absent in these tabs. The existing sentence-plus-raw-detail display is the right behaviour. If
`listRecordings` is ever moved onto a relay, the Recordings tab could use `not_paired` to show a
"pair first" line instead of an error.

## Commands run and observed results

- An integrity scan of `panel/advanced/` (line counts, file endings, NUL and non-ASCII grep) found all
  22 files whole, with only the intended `·` as non-ASCII.
- `EXTENSION_TEST_BUILD_LABEL=ext-ws-c node scripts/test-extension.mjs` (apps/extension), run 4 times:
  - Run 1: 939/939 pass. My 15 tests are `ok 711` through `ok 725`.
  - Run 2, after other workers had added tests: 984 tests, 981 pass, 3 fail. All 3 were in
    `panel/simple/conversation/tests/controller.test.ts`, which is B's file.
  - Runs 3 and 4: 990/990 pass.
  - The count was still rising between runs, so B is editing concurrently, and the 3 failures were its
    unfinished work.
- `pnpm --filter @fluxiq-web-extension/test-runner check` exited 0 on both runs, before and after D.
- `pnpm run check` (apps/extension) exited 1 with type errors only in B's files: first
  `panel/simple/tests/run-stop.test.ts(37,39)`, then `(38,39)` plus
  `panel/simple/conversation/tests/controller.test.ts(208,89)`. None is under `panel/advanced` or in
  test-runner.
- `node scripts/structure-audit.mjs` reported 1 violation, `[working-docs] docs/working/README.md is out
  of date`. That is a shared document C may not edit, and the supervisor fixes it with
  `pnpm structure:baseline`. No structure rule failed on C's files.

## Not verified

- No live Lab run was started, as the brief says, so the journeys' new names are unexercised against a
  real browser.
- The live connect path's `extensionStatus(page)?.connectionState` check before Connect was checked by
  types only.
- `pnpm check` for the whole repository is not clean while B is mid-edit, so it was not rerun after B.

## Open questions or contradictions found

1. The entries (`popup/index.ts`, `sidepanel/index.ts`) still mount `placeholderViews`. The journeys
   match the UI only after the integration swaps in `{ simple: mountSimpleView, advanced:
   mountAdvancedView }`. Until then a Lab session fails at `settings-gateway`. Delete
   `panel/shell/placeholder/` in the same edit.
2. `apps/extension/e2e/install-and-content.spec.ts:47-54` (A's file) still uses the old labels ("Gateway
   URL" ... "Snapshots", "Close"). It breaks at integration and needs the labels listed above.
3. The recording lock's hard-coded heading (audit E5) is not in C's files. It belongs in B's now card
   (`panel/simple/**`).
4. Out of scope, per the brief: `browser-session.ts` launches Chromium with no network guard.
5. B's two type errors are listed under Commands run. They are recorded here only so the supervisor
   checks them once B reports.
