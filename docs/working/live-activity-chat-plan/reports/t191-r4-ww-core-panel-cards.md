# t191-r4-ww: every action in the Core panel chat is a card with an icon

Tree: `C:/Users/osrs_/FluxStuff/fxwork/t191/!FluxIQ` (branch `task/t191-extension-chat-ui`). Nothing was committed.
Paths below are relative to `apps/web/src/features/automation-studio/`.

## Outcome

Done. Every action FluxIQ takes now shows in the panel chat as a card instead of a text line. This covers clicks, typing, navigation, reads, looks, waits, robot checks, permission asks, test runs, repairs and Flow edits. Each card has:

- Core's lucide icon for the kind, in a mark tinted by the outcome;
- Core's short name for the kind and what the action acted on (or "the page");
- the outcome in words underneath.

The card sits under the model's reasoning message. The card, its tone and its words all come from the shared `fluxiq/ui` API. No new colours, tokens or components were added.

Validation:

- tsc is clean.
- The conversation suite passes: 25 of 25 files, 192 of 192 tests.
- The structure audit passes, with no new warning.
- `02-dock.css` is 396 lines.

## Design

### Model (`conversation/activity/steps/`)

**`messages.ts`.** `ConversationStepMessage.outcome` is replaced by `actions: ConversationStepAction[]`, where `ConversationStepAction = ActivityAction & { key; said? }`.

- **Key.** `action:<activityId>#<sequence>` of the event that opened the card. When the action ends, the card is updated in place: the key stays the same, and a name or kind it already had is kept.
- **Classification.** Each card is read by `activityActionOf` from `fluxiq/ui`. The panel has no kind table of its own. A tool with no status is read as done, as the chat read it before. A target that is not in words (`conversationActivityTextIsHuman`) becomes null.
- **Which message carries a card:**
  - A tool that follows a decision is that decision's card. A second tool is its own `action` message, which is still a card.
  - A check carries a `test` card.
  - A run step carries its card. The existing rule still closes the step once the run moves on, and the card then reads "done".
  - A repair decision's tool gives a `repair` card, or a `draft` card for `core.flow_draft`.
- **Asks are shown now** (r3 hid them). A permission ask or robot check becomes a card with outcome `waiting`: beside the decision if one came just before, otherwise as its own `action` message. Waiting cards are held per unit. The first later event whose phase is not `waiting_permission` resolves them: to `done`, or to `failed` if that event fails the unit. A tool whose result code names an intervention gets a `person_check` card in the waiting state from the classifier, and resolves the same way.

**`outcome.ts`.** `conversationStepOutcomeWords(action, live)` returns `{ state, status, label }`:

| Outcome | Words | Status word |
| --- | --- | --- |
| working | "Working on it", only when `live` (the newest card of work still running); otherwise null | running |
| done | "Done" ("Passed" for test), plus ". <Core's sentence>" when Core gave one in words | succeeded |
| failed | "Didn't work: <why>" (or "Didn't pass" for test), falling back to ". <Core's sentence>" | failed |
| waiting | "Waiting for you" | waiting |

The status word is what `fluxiqStatusTone` reads: running gives info, succeeded success, failed danger, waiting warning. A stale working card has no words and a neutral tone.

### Icons (`conversation/components/action-card/action-icons.ts`)

`CONVERSATION_ACTION_ICONS: Readonly<Record<ActivityActionKind, LucideIcon>>` imports the 12 named lucide icons. A new kind fails the typecheck. The test holds each component to Core's name in `ACTIVITY_ACTION_ICONS` by checking for `lucide-<name>` in the rendered class. It is not a second kind-to-name map: the names and labels still come only from Core.

### Card (`conversation/components/action-card/ConversationActionCard.tsx`)

The card has `role="group"`, an `aria-label` of the form "<Name>: <target>. <outcome words>", and `data-kind` and `data-outcome` attributes. The mark and the SVG are `aria-hidden`. The spinner reuses the existing `.automation-conversation-step-spinner`.

`ConversationStepMessage.tsx` renders the parts in this order:

- the reasoning line;
- one card per action, keyed by `action.key`, with `live` only on the last card of the newest message of the running unit.

A `step` or `action` message renders as its card alone, so the action is not said twice.

### Styles (`styles/conversation/02-dock.css`)

- **Removed:** the `.automation-conversation-step-outcome` and `-mark` rules, since the outcome line is gone.
- **Added:** `.automation-conversation-action*` rules. They use the card look already in the panel (`--color-border` border, `--radius-medium`, `--color-surface`). The tinted mark uses the same token pairs as `.status-badge-pill.tone-*` (`--color-{tone}-border/-surface`, `--color-{tone}`), and the neutral mark uses `--surface-tool`. The failed and waiting outcome words use the danger and warning colours.
- `.automation-conversation-action > div` joins the existing live/opening `> div` rule.
- Three short rules were put on one line each, which keeps the file at 396 lines.
- No new stylesheet was needed. The route manifest, which is outside my paths, and the architecture test both still see exactly two conversation imports.

## Markup per kind (from the tests)

For kind K, with `ACTIVITY_ACTION_ICONS[K]` = I and `ACTIVITY_ACTION_NAMES[K]` = N:

```html
<div aria-label="N: Get a free quote. Done" class="automation-conversation-action tone-success" data-kind="K" data-outcome="done" role="group">
  <span aria-hidden="true" class="automation-conversation-action-mark" data-icon="I"><svg class="lucide lucide-I" aria-hidden="true" ...></svg></span>
  <div><p><strong>N</strong><span>Get a free quote</span></p><p class="automation-conversation-action-outcome">Done</p></div>
</div>
```

| K | I | N |
| --- | --- | --- |
| click | mouse-pointer-click | Click |
| type | keyboard | Type |
| navigate | globe | Open page |
| read | table | Read list |
| look | scan-search | Look at page |
| wait | hourglass | Wait |
| person_check | shield-check | Robot check |
| permission | hand | Permission |
| draft | pencil | Edit Flow |
| test | flask-conical | Test run (words "Passed" / "Didn't pass") |
| repair | wrench | Repair |
| other | circle-dot | Action |

Tone classes by outcome: `tone-info` for working, with the spinner; `tone-success` for done; `tone-danger` for failed; `tone-warning` for waiting; `tone-neutral` for stale working.

## Files

- **Modified:**
  - `conversation/activity/steps/messages.ts`, `outcome.ts`, `index.ts`
  - `conversation/activity/index.ts`
  - `conversation/components/ConversationStepMessage.tsx`, `components/index.ts`
  - `styles/conversation/02-dock.css`
- **Added:**
  - `conversation/components/action-card/{ConversationActionCard.tsx, action-icons.ts, index.ts}`
  - `conversation/components/tests/ConversationActionCard.test.tsx`
- **Tests updated:**
  - `activity/steps/tests/messages.test.ts`: 11 tests. They cover the card per decision, key stability, why from the code, repair/draft/test cards, asks waiting and then done, a standalone robot check, run step cards, ended, and limit.
  - `activity/steps/tests/outcome.test.ts`: 3 tests.
  - `conversation/tests/conversation-activity.test.tsx`: two expectations changed. A standalone tool now reads "Open page · Open the listing · Done" instead of Core's title "Working on the page" / "Opened the listing page".
- **New component tests (5):**
  - every kind: `lucide-<Core name>` class, `data-icon`, name, `aria-hidden` SVG, and aria-label;
  - tone and words for failed, waiting, working, done and stale;
  - no dotted id or code in the markup built from real-shaped events (SVG namespace excluded);
  - card and message elements keep the same instance from working to done, via react-test-renderer;
  - the reasoning line comes before the card, a standalone action is the card alone, and a decision with no action has no card.

## Commands run and observed results

1. Focused run in `apps/web`: `bash .../heavy.sh "t191 ww web focused" bash -c "npx tsc --noEmit -p . ; npx vitest run .../conversation/activity .../conversation/components .../conversation/tests/conversation-activity.test.tsx"`. tsc printed nothing. Result: `Test Files 9 passed (9)`, `Tests 56 passed (56)`.
2. The brief's command, run twice, the second time after moving the card into `action-card/`: `bash C:/Users/osrs_/FluxStuff/build-slots/heavy.sh "t191 ww web" bash -c "npx tsc --noEmit -p . && npx vitest run src/features/automation-studio/conversation --exclude '**/core-contract.test.ts'"`. It printed `[heavy] t191 ww web holds b3`, then `Test Files 25 passed (25)`, `Tests 192 passed (192)`, exit 0. The known `registry.test.ts` "pins the classes" failure did **not** occur: registry.test.ts shows 11 tests passed.
3. `node scripts/structure-audit.mjs` at the Core root. The first run gave `passed (203 warning(s), 354 baselined)`, with a new advisory: `conversation/components/: 17 source files is past the 15-file advisory threshold`. I moved the card and icon map into `components/action-card/` with a barrel. The re-run gave `structure-audit: passed (202 warning(s), 354 baselined).`, exit 0. The only conversation warning left is the pre-existing `thread/model.ts` (9 exported values). It also printed "1 baseline entries can be lowered"; that entry is not mine, and I did not run `pnpm structure:baseline`.
4. `npx vitest run src/features/automation-studio/styles/tests` (it reads `02-dock.css`): `Test Files 3 passed (3)`, `Tests 13 passed (13)`.

## Not verified

- **No browser**, as the brief said. I have not seen the cards on screen: mark size and alignment, card width, light and dark themes, or spacing between consecutive step items.
- **No real Core event stream.** Cards are built from events shaped like the r3-wa/r4-ws contracts. I did not observe what a real build emits for asks or intervention codes.
- **`core-contract.test.ts` was excluded**, per the brief.
- **Screen readers.** The card is `role="group"` with an aria-label, and its visible text is still inside it. I did not check how a screen reader announces the two together.

## Open questions or contradictions found

1. **Asks are now messages.** Per the brief, a permission ask or robot check is a waiting card. r3 hid asks because the ask turn already carries the question, so the person now sees both the card and the ask turn. The live line still says "Waiting for your answer".
2. **A waiting card resolves to "Done"** once the work leaves the wait, or to "Didn't work" if that event fails the unit. The panel cannot tell whether a permission was granted or denied, so "Permission · Done" only means the wait is over.
3. **Card-only messages drop Core's title.** A run step no longer shows "Step 2: Open the listing"; it shows "Open page · Open the listing". A standalone tool no longer shows Core's title ("Opened the listing page"). This follows "a standalone action is still a card" and avoids saying the action twice. If the step number or Core's title should stay, it could be a line above the card; that is a design call.
4. **Robot checks can show twice.** A waiting-phase tool with an intervention code gets its own `person_check` card, as well as the ask's card. In the test, an ask followed by such a tool gives two waiting cards. Merging them would need a rule the shared classifier does not give.
5. **The extension's chat does not match yet.** Its `panel/chat/stream/step/messages.ts` is not changed by this brief, so the header comment's "rules match the extension's" holds only once the extension side adopts the same cards.
