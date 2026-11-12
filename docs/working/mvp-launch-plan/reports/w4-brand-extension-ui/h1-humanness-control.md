# W4-H1: humanness control in Core's shared chat (lane t900)

## Outcome

Done. All acceptance checks ran and passed.

Core's `@fluxiq/ui-components` now has a reusable humanness control, exported from the
package root. Each task's answer card in the chat shows it behind a "Humanness · N"
disclosure, but only when the optional `ChatTransport.taskSettings` port is present.
Nothing is committed (worktree `C:/Users/osrs_/FluxStuff/fxwork/t900/!FluxIQ`).

## Exported names (package root `@fluxiq/ui-components`)

- `createHumannessControl(options: HumannessControlOptions): HumannessControl`
- `humannessWords(level: number): string`: "fastest", "a little human-like" (5-25),
  "more human-like" (30-65), "very human-like" (70-95), "most human-like" (100)
- types `HumannessLevel`, `HumannessCommit`, `HumannessControlOptions`, `HumannessControl`
- port types `ChatTaskSettingsPort`, `ChatTaskRef`, `ChatTaskSettings`, `ChatSetHumannessRequest`
- `AnswerHost.taskSettings?` (for a host that mounts `createAnswerView` itself)

## Port types (verbatim, `src/chat/ports/task-settings.ts`)

```ts
/** The task a setting belongs to. */
export type ChatTaskRef = { projectId: string; taskId: string };

/** A task's humanness as read: its own level when it has one, and the person's starting value it uses otherwise. */
export type ChatTaskSettings = { humanness?: number; starting: number };

/** Sets a task's own humanness, or clears it with `null` so the task uses the starting value again. */
export type ChatSetHumannessRequest = { projectId: string; taskId: string; humanness: number | null };

/** Reads and sets a task's own settings. Requests never throw through a port. */
export type ChatTaskSettingsPort = {
  /** The task's humanness and the starting value. A task it cannot find is a failed read. */
  read(task: ChatTaskRef): Promise<ChatResult<ChatTaskSettings>>;
  /** Answers the task's own level as saved: absent once cleared. A level out of range is a failed result in the person's words. */
  setHumanness(request: ChatSetHumannessRequest): Promise<ChatResult<{ humanness?: number }>>;
};
```

`ChatTransport` gains `readonly taskSettings?: ChatTaskSettingsPort;`.
`leaseTransport` wraps `read` and `setHumanness` like every other request. A lapsed
lease answers `CONTEXT_CHANGED` and sends nothing. A transport without the port gets
none.

What the extension implements next:

- `read`: return `{ starting: FluxIQSettings.humanness ?? 0, humanness? }`, where
  `humanness?` comes from the task's `list-project-tasks` row.
- `setHumanness`: call `update-task-settings { projectId, taskId, humanness }`.
- On Core's named out-of-range error, answer `{ ok: false, sentence: <the person's
  words>, code }`. The control shows "Not saved. <sentence>" and puts the slider back.
- For a client that cannot carry the read at all, answer `unsupported: true`. The card
  then shows no disclosure. Any other failed read is shown inside the disclosure as "I
  could not read this task's humanness. <sentence>".

## How to mount the control elsewhere (task screen, Flow, settings)

```ts
import { createHumannessControl } from "@fluxiq/ui-components";
import "@fluxiq/ui-components/styles/tokens.css";
import "@fluxiq/ui-components/styles/chat.css"; // imports controls/humanness/humanness.css

const control = createHumannessControl({
  level: { own: task.humanness, starting },  // leave `own` out to inherit
  commit: (humanness) => port.setHumanness({ projectId, taskId, humanness }), // null clears
  label: "Humanness for this Flow",            // default "Humanness"
  settleMs: 500,                               // key rest before sending (default)
  onLevel: (saved) => { /* each saved level, or the level put back after a refusal */ }
});
container.append(control.element);
control.show(levelReadAgain); // ignored while a change is pending or on its way
control.dispose();            // sends a level the keys left waiting
```

The control holds no port, so it works over any commit function: a Flow's, a
FluxNode's, or the starting value itself. Outside the chat, import
`src/chat/controls/humanness/humanness.css` after tokens.css. Its rules do not depend
on `.chat-panel`.

## What changed and why

- `src/chat/ports/task-settings.ts` (new): the port types above, documented against
  Core's calls.
- `src/chat/ports/transport.ts`, `ports/index.ts`: the optional `taskSettings`, and the
  type exports.
- `src/chat/lease-transport.ts`: leases `taskSettings`.
- `src/chat/controls/humanness/` (new dir: `humanness-control.ts`, `level-words.ts`,
  `humanness.css`, `index.ts`, `tests/`). It is its own directory so `controls/` does
  not grow a `humanness-` prefix group.
  - A range from 0 to 100 in steps of 5, with the level in mono (`--font-mono`,
    amber `--accent-text`).
  - Ends labelled "Fastest" and "Most human-like", and a one-line explanation.
  - Inherited state: "Uses your starting value (N). Move the slider to give this its own
    level." Own state: a "Use starting value" button, which commits `null`.
  - `aria-labelledby` and `aria-describedby`. `aria-valuetext` reads "40, more
    human-like", plus ", your starting value" when inherited.
  - Focus ring from `--focus`/`--focus-width`, and amber `accent-color`. Tokens only.
  - A drag is committed once on `change` (release). Arrow, Page Up/Down, Home and End
    are handled by the control itself (`preventDefault`), so every browser steps by 5;
    the keyed level is sent after `settleMs`, or at once on blur.
  - One request is in flight at a time, and only the latest queued level is sent. A
    level that is already saved is never sent.
  - Status shows "Saving…", "Saved." or "Not saved. <sentence>" (`role="alert"` on a
    refusal), and the slider reverts on refusal. A thrown commit is treated as a refusal.
- `src/chat/answer/view/humanness-section.ts` (new):
  - A `small-button` disclosure reading "Humanness · N" (`aria-expanded`,
    `aria-controls`) over a panel that holds the control.
  - It reads the card's task when the card first shows, and again on each opening.
    Stale replies are dropped.
  - Hidden until the first read; hidden on `unsupported`.
- `src/chat/answer/view/answer-view.ts`, `host.ts`:
  - `AnswerHost.taskSettings?`. The section is created only when the port is present.
  - The card redraw now keeps the section element in place: new parts are inserted
    before it instead of `replaceChildren`. A redraw therefore never moves or blurs the
    slider, and its open, pending or saved state survives. With no port, the old
    `replaceChildren` path is unchanged.
- `src/chat/chat-widget.ts`: `answerHost()` passes `owner.transport.taskSettings`, which
  is leased.
- `src/chat/controls/index.ts`, `src/chat/index.ts`: exports. `src/index.ts` already
  re-exports the chat barrel, so it is unchanged.
- `src/chat/chat.css`: `@import "./controls/humanness/humanness.css";` at the top, and
  5 rules for the disclosure in the answer section. The file is now 795 lines (limit 800).
- `README.md`: a new "Humanness" section covering the control, the port and Core's calls.
- Tests:
  - `controls/humanness/tests/humanness-control.test.ts` (7)
  - `answer/tests/humanness.test.ts` (4)
  - one new test in `chat/tests/lease-transport.test.ts`

The brief's required test cases map to these tests:

| Brief case | Test |
| --- | --- |
| inherited shows the starting value | "inherited shows the starting value…" |
| set commits once on release | "a drag shows each level and commits once, on release" |
| clear sends null | "Use starting value sends null…" and the answer test |
| refusal reverts and shows the person's words | "a refusal goes back…" |
| keyboard arrows step by 5 | "the arrow keys step by 5…" |
| control absent without the port | "without the task settings port…" |

## Commands run and observed results

Run in `packages/ui-components`:

- `pnpm exec vitest run src/chat/controls src/chat/answer src/chat/tests/lease-transport.test.ts src/chat/view/tests src/theme`
  -> `Test Files 24 passed (24)`, `Tests 169 passed (169)`. This includes
  `styles.test.ts`, which checks that every class built is styled and every token is
  defined.
- `pnpm exec vitest run src/chat/tests` (the widget tests, because `chat-widget.ts`
  changed) -> `Test Files 20 passed (20)`, `Tests 142 passed (142)`.
- Through the slot, `node C:/Users/osrs_/FluxStuff/fxwork/.tools/heavy-slot.mjs run t900 -- pnpm build` -> waited in the queue, then `heavy-slot: t900 took slot-1`, `tsc -b` built (`"ms":34072`), `exit=0`. `dist/chat/controls/humanness/*.js|.d.ts` and `dist/chat/ports/task-settings.d.ts` are present, and `dist/chat/index.d.ts` exports `createHumannessControl`.

Run at the repository root:

- `node scripts/structure-audit.mjs` -> `structure-audit: passed (530 warning(s), 969
  baselined).` No finding names any new or changed file of mine. `chat.css` and
  `chat-widget.ts` carry advisory warnings over 400 lines, as before.

## Not verified

- I have not seen the control in a browser: no extension build, no live panel. Not
  checked there: the range's real pointer and keyboard behaviour, how the amber
  `accent-color` thumb renders, the focus ring, and the layout at 360px.
- Real Core `list-project-tasks` and `update-task-settings` replies were not exercised.
  W2 is on another lane, and the tests use a fake port.
- Accessibility was not checked with a screen reader.

## Open questions or contradictions found

1. **The package's published `files` list needs the new sheet.** `package.json` (not
   mine to edit) lists every shipped CSS file explicitly. Add
   `"src/chat/controls/humanness/humanness.css"` there. Without it, a published
   `chat.css` would `@import` a missing file. Workspace consumers, the extension
   included, resolve it from `src/` and are unaffected.
2. Every answer card for the same task reads and shows its own control. Each opening
   reads again, so a level changed on another card is picked up when that card is
   opened. A card that stays open is not live-updated.
3. Core's exact refusal code is not known here. The control does not branch on it: it
   shows `sentence`, so the extension adapter owns the wording.
