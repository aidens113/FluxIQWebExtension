# Report: t191-r4-we (worker), every action is a card in the extension chat

## Outcome

Done. Every action FluxIQ takes now shows in the extension chat as a card, with an icon for its kind. The action kinds are click, typing, navigation, read, look, wait, robot check, permission ask, test run, repair, Flow edit and other.

Each card shows:
- Core's pinned lucide icon, in a round mark tinted by the outcome;
- Core's name for the kind, and what it acted on;
- the outcome in words.

Cards sit beside the reasoning message that led to them, and are never a plain text line.

Extension `check`, `test` (1624 of 1624 passing) and `build` all pass through the build slot, and so does the structure audit. There was no browser run and no Lab run, as the brief said.

## Design

### Model (`panel/chat/stream/step/`)

**`action-card.ts`: `actionCard(event, key)` gives an `ActionCard`.**
- `ActionCard` is Core's `ActivityAction` from `fluxiq/ui` plus three fields:
  - `key`: `action:<activityId>#<sequence>` of the event that opened the card;
  - `said`: Core's sentence in words, dropped when it holds a dotted id;
  - `check`: true for a result check.
- The kind, target, outcome and why come only from `activityActionOf`. Nothing is restated.
- An `ask` that the classifier calls `working` becomes `waiting`. This makes robot checks and permission asks wait on the person, whatever phase they arrive in.
- Thoughts and notes are never cards.

**`messages.ts`: `StepMessage.outcome` is replaced by `actions: ActionCard[]`.**
- A decision (or a repair) carries every `tool` it led to as cards, in order, until something else opens a message.
  - This is a change from r3, where a second tool became its own message. The brief asks for "the action(s) it led to".
- An action with no decision before it becomes an `action` message with one card.
- A check, an ask and a run step (an event with a `step`) are each a message with one card.
- A card that started is updated in place when it ends. It is tracked by identity, as `{ message, card }`, and keeps its key.
- A run step that Core never ends goes from `working` to `done` once anything later happens.
- Step markers, such as the build-failed marker, stay as words.

**`card-words.ts`: `cardWords(card, current)` gives `{ state, name, target, outcome, label }`.** It replaces `outcome.ts` (`outcomeWords`), which is deleted.
- `name` is `ACTIVITY_ACTION_NAMES[kind]`.
- `target` is Core's target. If there is none, click, type, read and other say "the page". Navigate, look, wait, person_check, permission, draft, test and repair name no target, because "Open page · the page" reads badly.
- `outcome`:
  - "Done";
  - "Didn't work: <why>", using Core's `why`, else its sentence with the first letter lowered;
  - for a check, "Passed" or "Didn't pass", followed by ": <verdict>";
  - "Working on it" or "Waiting for you", only when `current` is true.
- A working or waiting card that is not current is `settled`: a neutral mark and no outcome line, the r3 rule.
- `label` is "Click, Get a free quote: Done".

**`words.ts`.** `ONLY_CODES` now also recognizes the observer's record, `Result: web.click.succeeded · Node: web.output.dom-click`. Before this, that record reached the message text (hidden, but in the DOM) with its ids.

**Current action.** `current` means all three of these:
1. The unit of work is running or waiting on the person.
2. The message is the newest of that unit.
3. The card is its last card.

`chat-panel.ts` now passes the display's `activityId` when `display.working || display.outcome === "waiting"`. Before, it passed it only when `working`. During a wait, `working` is false, so "Waiting for you" would never have shown.

### Icons (`panel/icons/`, new)

- `lucide-nodes.ts`: `LUCIDE_ICON_NODES`, the node data for exactly the 12 names in `ACTIVITY_ACTION_ICONS`.
  - The data is copied from Core's `apps/web/node_modules/lucide-react` v0.468.0.
  - The ISC licence text is in the module header.
  - check, x and loader were not needed. The working spinner is the existing CSS ring.
- `lucide-icon.ts`: `lucideIcon(name, size = 16)`.
  - It builds the SVG with `createElementNS`: viewBox `0 0 24 24`, `fill="none"`, `stroke="currentColor"`, `stroke-width="2"`, round caps and joins, `aria-hidden="true"`, `focusable="false"`, and `data-icon`.
  - An unknown name, including an `Object` prototype key, draws `circle-dot`.
- `index.ts`: the barrel.

### View (`panel/chat/view/`)

- **`action-card-view.ts`** (new): `createActionCardView()`. Its `update(card, current)` changes only what changed.
  - It swaps the SVG only when Core's kind for the card changes. For example, a tool that started as `other` can become `click` once its record arrives.
  - The card element and its parts are never remounted.
- **`step-message-view.ts`**: the words line, then a `.chat-cards` container.
  - Cards are reconciled by key with `placeChildren`, so new cards append and nothing reorders.
  - The words line shows for decision, repair and note, or when a message has no card. A message that is an action (action, check, ask, run step) is only its card.
- **`thread-view.ts`**: comment only.

### Style (`chat.css`)

Only existing tokens are used, so light and dark follow `tokens.css`.
- The card uses `.card`'s chrome: `--divider` border, `--radius`, `--surface` background, and `--space-2`/`--space-3` padding.
- The layout is the getting-started step's: a 28px round mark with a 1.5px border, then the body.
- The mark tint depends on the state:

  | State | Border | Fill | Icon |
  | --- | --- | --- | --- |
  | working | `--accent` | `--accent-soft` | `--accent-text` |
  | done | `--success` | `--surface` | `--success` (there is no success-soft token) |
  | failed | `--danger` | `--danger-soft` | `--danger-text` |
  | waiting | `--warning` | `--warning-soft` | `--warning-text` |
  | settled | `--divider` | `--surface-muted` | `--muted` |

- The outcome line is `--muted`. It is `--danger-text` when failed and `--warning-text` when waiting. While working it has the old spinner ring, which animates only under `prefers-reduced-motion: no-preference`.
- The "·" before the target uses `content: "·" / ""`, with a plain fallback, so it stays out of the accessible text.
- Cards are `fit-content` with `min-width: min(100%, 240px)`, and the target ellipsizes.
- The old `.chat-step-outcome` and `.chat-step-mark` rules are removed.

### The card as markup, for each kind

Every card has this shape. `data-state` is one of working, done, failed, waiting or settled.

```html
<div class="chat-card" role="group" data-kind="KIND" data-state="STATE" aria-label="LABEL">
  <span class="chat-card-mark" aria-hidden="true"><svg data-icon="ICON" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true" focusable="false">…</svg></span>
  <span class="chat-card-body">
    <span class="chat-card-head"><span class="chat-card-name">NAME</span><span class="chat-card-target">TARGET</span></span>
    <span class="chat-card-outcome">OUTCOME</span>
  </span>
</div>
```

These values are as rendered in `view/tests/action-card-view.test.ts` from events shaped like Core's emitters. A hidden target or outcome is shown as —.

| kind | icon | name | target | outcome | aria-label |
| --- | --- | --- | --- | --- | --- |
| click | mouse-pointer-click | Click | Get a free quote | Done | Click, Get a free quote: Done |
| type | keyboard | Type | the page | Didn't work: the field was covered by a banner. | Type, the page: Didn't work: the field was covered by a banner. |
| navigate | globe | Open page | — | Done | Open page: Done |
| read | table | Read list | Listings | Done | Read list, Listings: Done |
| look | scan-search | Look at page | — | Done | Look at page: Done |
| wait | hourglass | Wait | — | Done | Wait: Done |
| person_check | shield-check | Robot check | — | Waiting for you (current) / — (settled) | Robot check: Waiting for you |
| permission | hand | Permission | — | Waiting for you (current) / — (settled) | Permission |
| draft | pencil | Edit Flow | — | Done | Edit Flow: Done |
| test | flask-conical | Test run | — | Didn't work: it didn't work the same way again | Test run: Didn't work: it didn't work the same way again |
| test (check) | flask-conical | Test run | — | Passed: the quote form is open… | Test run: Passed: … |
| repair | wrench | Repair | Accept cookies | Done | Repair, Accept cookies: Done |
| other | circle-dot | Action | the page | Done | Action, the page: Done |

A decision with its card reads like this:

```
**Clicking “Get a free quote”** — The quote form is behind this button, so I'm opening it.
[(pointer) Click · Get a free quote
           Didn't work: it wasn't on the page]
```

## What changed

**New files:**
- `apps/extension/src/panel/icons/{index,lucide-nodes,lucide-icon}.ts`
- `apps/extension/src/panel/icons/tests/lucide-icon.test.ts` (3 tests)
- `panel/chat/stream/step/{action-card,card-words}.ts`
- `stream/step/tests/card-words.test.ts` (4 tests)
- `panel/chat/view/action-card-view.ts`
- `view/tests/action-card-view.test.ts` (4 tests):
  - a card per kind;
  - a robot check waiting;
  - a card keeps the same element and icon from started to failed, and cards append in order;
  - no dotted id in any text leaf or aria-label.

**Deleted, with `git rm`, so both deletions are staged:**
- `stream/step/outcome.ts`
- `stream/step/tests/outcome.test.ts`

**Modified:**
- `stream/step/{messages,words,index}.ts`
- `stream/index.ts`
- `chat/index.ts`: exports `actionCard`, `cardWords` and `ActionCard`/`CardWords` in place of `outcomeWords`/`StepOutcome`.
- `view/{step-message-view,thread-view,index}.ts`
- `chat-panel.ts`
- `chat.css`
- `stream/step/tests/messages.test.ts`: updated, plus 2 tests (asks as waiting cards; a started card keeps its key and place).
- `view/tests/thread-view.test.ts`
- `tests/in-place-updates.test.ts`
- `tests/chat-panel.test.ts`

**Docs:** `docs/architecture/extension-client.md`, "The panel's chat": a new "Every action is a card" bullet (mark, head line, outcome line, accessibility, styling) and card keys.

**Not touched:** `scripts/structure-audit/config.mjs`. The `fluxiq/ui` import needed no config change.
- The extension config's `ownedElsewhere` already covers `fluxiq/…`.
- Core's `browserBundles.entries` already lists `packages/fluxiq/src/ui/index.ts`.

## Commands run and observed results

- **Typecheck.** `npx tsc -p tsconfig.json --noEmit` in `apps/extension` gave exit 0, and so did `npx tsc -p tsconfig.test.json --noEmit`.
- **Classifier probe.** I ran a node script that imports `fluxiq/ui` from the built `dist`, with one event per kind shaped like Core's emitters. It returned all 12 kinds.
  - `core.observe` is filtered by the chat's `isInternalStep`, so the look sample uses `web.inspect_current_page`.
  - A note gives null.
- **Unit tests, first run.** `EXTENSION_TEST_BUILD_LABEL=t191-we node scripts/test-extension.mjs` printed `# tests 1624`, `# pass 1622`, `# fail 2`. Both failures were in my new view test:
  - the look sample used `core.observe`, which is internal;
  - the dotted-id regex (with the `i` flag) matched across two adjacent spans in a concatenated `textContent`, as in "banner.Type".
  - I fixed both in the test, which now scans each leaf with a case-sensitive regex.
- **Unit tests, re-run.** exit 0, with `# tests 1624`, `# pass 1624`, `# fail 0`, `# cancelled 0`. There was no "generated asynchronous activity" line.
- **Structure audit.** `node scripts/structure-audit.mjs` printed `structure-audit: passed (133 warning(s), 120 baselined).` and exited 0. Grepping its output for `panel/(chat|icons)` found nothing.
- **Build-slot validation.** `EXTENSION_TEST_BUILD_LABEL=t191-we bash C:/Users/osrs_/FluxStuff/build-slots/heavy.sh "t191 we ext" bash -c "pnpm --filter @fluxiq-web-extension/extension check && pnpm --filter @fluxiq-web-extension/extension test && pnpm --filter @fluxiq-web-extension/extension build"` exited 0 in slot b3.
  - check: `extension:check` built in 64313 ms with no errors.
  - test: `Extension smoke test passed.`, then `# tests 1624`, `# pass 1624`, `# fail 0`, `# cancelled 0`, and 0 `not ok` lines. The new tests appear as `ok`: 1201, 1202, 1205, 1209, 1210, 1246, 1248, 1249, 1257, 1301 and 1302.
  - build: `chrome: verified 22 files`, `firefox: verified 22 files` (plus the existing gecko.id placeholder warning), `e2e-chromium: verified 22 files`.
- **Bundle check.** `dist/chrome/{sidepanel,popup}/index.js` each contain the lucide path data (once), `chat-card` (8 times) and `function activityActionOf` (once). `background/index.js` contains neither of the latter two.

## Not verified

- **Rendering.** I did not screenshot the cards in light or dark mode, in the side panel or the popup. That covers the mark tints, the dot separator, target ellipsis, the `-10px` tightening between step messages, and the spinner.
- **Screen readers.** I have not heard `role="group"` with `aria-label` in one, and have not checked the `content: "·" / ""` alt syntax in Firefox (it needs 128 or later; older versions use the plain fallback).
- **Real Core events.** Cards are built from events shaped like Core's emitters (per the r4-ws report), not from a live stream.
  - Whether Core's `ask` events carry `waiting_permission` is not observed. Both cases are handled.
  - Whether a tool's kind changes between `started` and `succeeded` is also not observed. The view handles it by swapping the icon.

## Open questions or contradictions found

1. **Several actions under one decision.** This is now how it works, where r3 had one action per decision. With Core's pinned contract of a thought before each action, a decision usually has one card. A Core that explains only some steps will stack its unexplained actions under the last reasoning. The alternative is one line in `messages.ts`: reset `unit.decision` after a tool.
2. **Waiting cards after the wait.** Once the person answers and the work moves on, a robot-check or permission card becomes `settled`: a neutral mark, no outcome line. Core sends no "answered" or "cleared" event the chat could read, so the card does not claim "Done".
3. **Run steps lose their "Step N".** A run step's message is now only its card, for example "Type · Search for lamps", taken from Core's `step.label`. The step number is no longer shown. It could be put back as a prefix on the target.
4. **Weak classification of some of Core's own tools.**
   - `core.dry_run` and `core.completion_check` read as test runs, which is right.
   - `core.observe` and other bookkeeping is dropped by the chat before classification, which is also right.
   - An unmapped `core.*` tool reads as "Action · the page". That is correct, but it is vague.
5. **Staged deletions.** My `git rm` staged the two deletions of `outcome.ts` and its test. Everything else is unstaged. The supervisor's commit should use `git add -A` for `apps/extension/src` and `docs`.
6. **Untracked report.** `docs/working/live-activity-chat-plan/reports/t191-r4-ww-core-panel-cards.md` appeared untracked in the worktree during my run. It is not mine, and I did not touch it.
