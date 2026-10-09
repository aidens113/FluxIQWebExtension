# E1 — Onboarding in the connected chat's empty state (t376)

## Outcome

Done in code and tests. The full `pnpm --filter @fluxiq-web-extension/extension build` exits 2. The cause is two type errors in files this brief does not own (`src/shared/activity/wording.ts`, `src/content/activity-overlay/phase-appearance.ts`). Both come from a `paused` activity phase that is being added in the lane's uncommitted Core worktree (`packages/contracts/src/client-gateway.ts`). None of the errors is in a file I changed. The bundling step on its own (`node scripts/build-extension.mjs`) passes for chrome, firefox and e2e-chromium. The structure audit's only FAIL is `[working-docs] docs/working/README.md is out of date`. The supervisor's untracked `t376-run-controls-onboarding.md` causes it; it is not my code.

## What changed and why

- `panel/chat/onboarding/model-readiness.ts` (new) and `onboarding/index.ts` (barrel): `readModelReadiness(request)` sends `RUNTIME_MESSAGES.panelModelReadiness` and answers one of three values:
  - `ready`: at least one key has `enabled === true`.
  - `missing`: the reply has a `payload.keys` array but no enabled key.
  - `unknown`: the relay failed, threw, or replied without a `keys` array.
  It never throws.
- `panel/chat/view/empty-state-model.ts`:
  - The model gains `starts` (`describe` / `extract`) and `keyLine`, and takes an optional third argument, `readiness` (default `unknown`).
  - Onboarding applies only to the `latest` target in `empty` mode. Its title stays "What can FluxIQ do for you?". Its line is the design's concept paragraph, including "You can stop it, or take over the page, at any time.".
  - It returns the two starts and keeps the three fill-only examples. `keyLine` is `MODEL_KEY_LINE` only when readiness is `missing`.
  - The automation, question, `project`, offline and loading states have no starts and no key line. `project` keeps the old plain invitation.
  - The file exports `ONBOARDING_CONCEPT` and `MODEL_KEY_LINE`, which the view barrel also exports.
- `panel/chat/view/empty-state.ts`:
  - Renders a `.chat-starts` group of `.chat-start` buttons, each with `data-start`. Describe also carries `.chat-start-primary`.
  - Renders a `.chat-key-line` (role status) holding `.chat-key-text`.
  - The new `EmptyStateHooks` has `start(id)` and `keyAction`. `keyAction` is the chat's Open FluxIQ, and it sits in the DOM only while the key line shows. The existing `chat-owner-recovery` test takes the first `.open-fluxiq` in the chat, so a hidden opener there would have broken it.
  - The container carries `data-onboarding` while starts show.
- `panel/chat/chat-panel.ts`:
  - New option `onExtract`.
  - One Open FluxIQ button (`look: "small"`) for the key line, observed on every status.
  - Describe calls `composer.focus()` and sends nothing. Extract calls `onExtract`. Both are gated by the same `eligible()` check the examples use.
  - Readiness is read once each time "connected and latest and mode empty and actionsAllowed" becomes true. A later status redraw does not read it again. It is read again after the person leaves and comes back, and after an owner reset.
  - Replies from a superseded ask or owner are dropped.
  - The header comment describes all of this.
- `panel/chat/chat.css`: styles for the starts, the primary start, and the key line (warning-soft). The concept paragraph is left-aligned in onboarding. The starts are `flex: 1 1 150px` and wrap.
- `panel/shell/mount-panel.ts`:
  - Passes `onExtract`. The new `openExtraction()` switches to the Automations tab, then finds `#extractDataButton` inside `recording.newAutomation`, or inside `recording.bar` while a recording runs.
  - If the button is enabled, it calls `click()`, so the sheet opens through its own handler. Otherwise it focuses the button, which sits beside the line saying why it is unavailable.
  - No edit to `panel/recording/**`. All `#extraction*` ids are kept.
- Tests:
  - New `chat/view/tests/empty-state-model.test.ts` (5): concept text, the two starts, the key line by readiness, onboarding on latest only.
  - New `chat/onboarding/tests/model-readiness.test.ts` (4): the message sent, ready, missing (no key or disabled key), unknown (relay failure, throw, wrong shape).
  - `chat/tests/chat-panel.test.ts` +3:
    - Describe focuses the composer and sends nothing.
    - Readiness is read once. The key line and its Open FluxIQ show only for a disabled key, not for an enabled key or a relay failure. Extract calls `onExtract` in all three cases.
    - An automation chat neither shows starts nor reads readiness.
  - `shell/tests/mount-panel-navigation.test.ts` +1, which runs the real `mountPanel`: Extract shows Automations, selects the tab, opens `#extractionPanel` (moved to the body by `dialog-focus.ts`), and keeps the ids. The fake DOM gained `click()`. The test stubs `MutationObserver` and puts it back afterwards.

## Commands run and observed results

- `apps/extension/scripts/test-extension.mjs` has no filter. So I bundled and ran only the tests in the changed directories with a scratch copy of its logic, under the label directory `.test-build-scratch/t376-e1`. The script is `scratchpad/e1-run.mjs`, run with cwd `apps/extension`. It covered `panel/chat/tests/*.test.ts`, `panel/chat/view/tests/*.test.ts`, `panel/chat/onboarding/tests/*.test.ts` and `panel/shell/tests/*.test.ts`, 23 files in all. Result: `# tests 133 # pass 133 # fail 0`.
  - The first run failed 1 test, "retired turn Open FluxIQ controls cannot dispatch…", because the hidden key-line opener was the first `.open-fluxiq`. I fixed it by attaching the opener only while the line shows, then reran: 133/133.
- `pnpm --filter @fluxiq-web-extension/extension build` exited 2:
  - `src/content/activity-overlay/phase-appearance.ts(17,14): error TS2741: Property 'paused' is missing …`
  - `src/shared/activity/wording.ts(96,7): error TS2741: Property 'paused' is missing …`
  - `npx tsc -p tsconfig.json --noEmit` lists only those 2 errors.
  - In `C:/Users/osrs_/FluxStuff/fxwork/t376/!FluxIQ`, `git status` shows `packages/contracts/src/client-gateway.ts` and the activity files modified, so another worker's work is in progress there.
- `node scripts/build-extension.mjs` (the bundle step alone) exited 0. Output: "chrome: verified 22 files", "firefox: verified 22 files", "e2e-chromium: verified 22 files".
- `node scripts/structure-audit.mjs` exited 1. The output says `1 violation(s) across 1 rule(s)`: `[working-docs] docs/working/README.md is out of date`. It gives advisory warnings only for my files: chat-panel.ts at 460 lines (425 before) and chat.css at 433 lines (393 before), both past the 400-line advisory.

## Not verified

- I did not look at the layout in a browser. "Fits at 380 px" rests on reading the CSS:
  - The popup is 380px wide.
  - Two `flex: 1 1 150px` starts with an 8px gap need about 308px, inside a column of about 340px.
  - They wrap to stacked buttons if narrower.
  - The key line wraps its Open FluxIQ.
  - Chrome side panel and Firefox popup share this code.
- No live check (Lab, browser, panel), as the brief requires. The sheet arming the picker on a real page is not exercised.
- The full extension build's typecheck cannot pass in this tree until the `paused` phase work lands in `shared/activity/wording.ts` and `content/activity-overlay/phase-appearance.ts`.

## Open questions or contradictions found

- The shell test passes because the fake reply for `panelModelReadiness` has no `keys` (unknown, so no line). The key line through the real shell is covered only by chat-panel tests.
- When the entry is disabled (FluxIQ working, offline), Extract switches tab and focuses the entry rather than opening the sheet. That matches the existing button's own rule. The brief did not specify this case.
- The concept's last sentence assumes Stop and Take over ship in this lane. If they slip, remove it from `ONBOARDING_CONCEPT` and its test assertion.
