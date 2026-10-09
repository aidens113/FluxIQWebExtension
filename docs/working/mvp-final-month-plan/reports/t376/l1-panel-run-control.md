# L1: Lab person presses run controls in the real panel (t376)

## Outcome

Done. A new Lab person action presses Stop, Take over or Hand back in the extension's real panel by exact
accessible name. It can wait for "step N" first, retries as the Lab does (first attempt plus 3 retries), and
returns a typed record instead of throwing. Nothing calls it yet: wiring it into a scenario or lane was out of
scope.

## What changed and why

- `packages/test-runner/src/person-simulation/panel-run-control.ts` (new):
  - `pressPanelRunControl(input: PressPanelRunControlInput): Promise<PanelRunControlPress>`. `input` has these
    fields:
    - `surface`, `control` (`"stop" | "takeOver" | "handBack"`)
    - optional `atStep`, `when` (the caller's predicate), `stepWaitMs` (default 120 s), `attemptWaitMs`
      (default 5 s), `retries` (default 3), `pollMs`, `now`, `sleep`, and `publish` (puts the press on the
      timeline).
    - It waits for the step or predicate. It then makes up to 1 + `retries` attempts. In each attempt it polls
      for a visible, enabled button and presses it.
    - When no press happens it returns a typed refusal: `step-not-reached`, `not-shown`, `disabled`,
      `press-lost` or `panel-unreadable`.
    - Each record holds `control`, `pressed`, `name`, `refusal`, `atStep`, `stepSeen`, `attempts`, `pressedAt`
      (ISO), `secondsWaited` (to a tenth) and `note`. The note is the Lab's own words, bounded, with only the
      first line of any error. A failure in `publish` is added to the note and is never thrown.
  - `PANEL_RUN_CONTROL_NAMES`: stop is tried as "Stop run", then "Stop build", then "Stop"; takeOver is
    "Take over"; handBack is "Hand back".
  - Two adapters implement `PanelRunControlSurface`:
    - `pagePanelRunControlSurface(page: Page)` is for a panel page that Playwright drives. It uses
      `getByRole("button", { name, exact: true })`, the same locator style the Lab uses to press
      "Start recording".
    - `extensionViewPanelRunControlSurface(control: Page, panelPath: string)` is for Chrome's real side panel.
      It reaches the panel through `chrome.extension.getViews()` from the extension control tab, the same way
      `extensionViewPanelDriver` / `run-scenario/chat-build/chat-entry.ts` do (`panelPath`
      `"sidepanel/index.html"`). It matches a button's aria-label or else its trimmed text, and skips hidden
      buttons (`checkVisibility`).
  - Evidence follows the `lab-person.ts` pattern:
    - The `publish` callback is for the timeline, as `capture.trigger` is used for hand-offs.
    - `panelRunControlLog()` collects presses and builds a `{ presses }` snapshot for
      `PANEL_RUN_CONTROLS_SNAPSHOT = "snapshots/panel-run-controls.json"`, written with `bundle.writeStructured`
      as hand-offs are.
  - The step hook is the chat live line's `.chat-live-step` span (`apps/extension/src/panel/chat/view/live-line.ts`).
    Its text comes from `step-text.ts` and reads "Step N", "Step N of M" or "Step N: label". The step counts as
    reached when the parsed N is greater than or equal to `atStep`. For "take over before step N", pass
    `atStep: N - 1`. `when` is there for work whose live line shows no step.
- `person-simulation/index.ts`: exports the new module and has one more comment line.
- `person-simulation/tests/panel-run-control.test.ts` (new) has 11 tests:
  - the right exact name is pressed
  - Stop presses "Stop build" when that is the name shown
  - the action waits for a button to show and then presses it
  - "never visible" is refused after 4 attempts
  - "stays disabled" is refused
  - the step N wait works, and so does its refusal
  - the caller's predicate is honoured
  - an unreadable panel, or a failed publish, ends up as words in the record with no page markup
  - the log keeps every press
  - the side-panel adapter skips disabled and hidden buttons and fails when there is no panel view

## Commands run and observed results

- `pnpm --filter @fluxiq-web-extension/test-runner check` exited with no tsc errors. The last line was
  `{"build-cache":"build","step":"test-runner:check",...}`.
- `pnpm run build` in packages/test-runner, then `node --test dist/person-simulation/tests/panel-run-control.test.js`,
  printed: `# tests 11  # pass 11  # fail 0`.
- `node scripts/structure-audit.mjs` exited 1 with `1 violation(s) across 1 rule(s)`. That violation is the known
  `[working-docs] docs/working/README.md is out of date` problem, which was already there. Neither new file
  appears in any warning or failure.

## Not verified

- No live panel was used, and no Lab run or browser was started. Only fake pages and views were tested.
- The press has not been tried against the real "Take over" / "Hand back" buttons that `hold-control.ts` is
  building in this tree. It has also not been tried against Chrome's real `checkVisibility`.
- The action has not been wired into any scenario or lane, and nothing writes `snapshots/panel-run-controls.json`
  yet.

## Open questions or contradictions found

- A disabled control in the panel changes its text: Stop shows "Stopping…", and the hold control shows
  "Taking over…" / "Handing back…". Because of that, "stays disabled" under the same name almost never happens,
  and a control that is already busy reads as `not-shown`. The note says which names were looked for.
- The Automations strip and the chat both show "Stop run". In the side panel the first visible, enabled one in
  document order is pressed. Both send the same stop.
- `.chat-live-step` is a CSS class, not a data attribute. If the panel renames that class, the step wait will
  silently never be reached and will end as `step-not-reached` after `stepWaitMs`. A `data-fluxiq-step`
  attribute on the live line would make the hook stable.
