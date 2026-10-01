# t191-r5-wx: the extension chat marks questions to the person only from Core's resolved row, one card per check

Tree: `C:/Users/osrs_/FluxStuff/fxwork/t191/!FluxIQWebExtension`, branch `task/t191-extension-chat-ui`. Nothing committed. Core read only.

## Outcome

Done. Extension check, test (1632 of 1632) and build pass through the build slot; the structure audit passes.

## What changed and why

All under `apps/extension/src/panel/chat/`, plus the doc.

- **`stream/step/action-card.ts`.** The inference is gone: an ask the classifier calls `working` is no longer forced to `waiting`. The outcome and why come only from `activityActionOf`. New field `answer`: Core's sentence on the row that settles a wait (an ask with `detail.resolution`, text kept only when in words, no dotted id). An ask's `said` is now always undefined, so the waiting text ("Complete the check...") can never become a "Didn't work:" reason. No resolution values are named anywhere in product code.
- **`stream/step/card-words.ts`.** A card with `answer`: done reads "Done. <answer>" ("Done. You pressed Continue."); failed reads "Didn't work: <why>" ("Didn't work: you pressed Stop"), or "Didn't work. <answer>" when Core's classifier has no why (a future value).
- **`stream/step/messages.ts`** (mirrors Core panel's `steps/messages.ts`):
  - `Unit.asks`: each ask's card place by `activityActionKey` (`ask:<ref>`). A later row with the same key marks that card in place (`mark`: same key, same message, kind/target kept if the new row lacks them) and opens no message.
  - A ref-less ask while another keyed ask's card waits is a restatement: skipped.
  - One card per check, `Unit.check`: a tool whose card is person_check/waiting joins the unit's waiting robot-check ask card (ask first; the ask's outcome, answer and why are kept, the tool may fill a missing target), or the ask adopts the waiting tool card (tool first) and is stored under its ask key, so the resolved row finds it. The tool/check identity now uses `activityActionKey` too.
  - Asks are still their own `ask` message (the extension never attached asks to decisions; unchanged).
- **`view/step-message-view.ts`, "current" rule.** A card still `waiting` is current whenever its unit is current (running or waiting), not only as the unit's newest card. Before, a note or step after the question quieted the card to "settled" while the person still had to answer; that was a second, view-level inference. Once the unit is not current, an unsettled wait is `settled` (no claim). `chat-panel.ts`'s `working` (display working or outcome waiting) still makes sense and is unchanged; its comment and `thread-view.ts`'s doc comment were updated.
- **Tests.**
  - `stream/step/tests/messages.test.ts` (5 new): waiting then answered / declined / timed_out on the same card key with no message added or moved; permission allowed in `repairing`; later note, tool and failed step leave it waiting; one card for ask-then-tool and tool-then-ask (key of the first kept); separate asks stay separate and a ref-less ask restates; no dotted id in any title, text, target, said, answer or why.
  - `stream/step/tests/card-words.test.ts` (1 new; helper gains `answer`).
  - `view/tests/action-card-view.test.ts` (2 new): waiting then done and waiting then failed on the same DOM element with no remount, "Waiting for you" kept after a later note, outcome and aria-label text, no dotted id; and an unsettled wait is `settled` once the unit is not current. The per-kind test's two expectations for person_check/permission changed from settled to "Waiting for you" (the unit there is current; this is the intended new rule).
  - `tests/chat-panel.test.ts`: the run's ask fixture now has Core's new shape (title "Asked the person to complete a check", `ref` = ask id).
- **`docs/architecture/extension-client.md`**, chat section: outcome line wording for settled waits, the new current rule, and a "Questions to the person" bullet with the keying, no-inference, one-card-per-check and restatement rules.

## Commands run and observed results

1. `npx tsc -p tsconfig.test.json --noEmit` in `apps/extension`: no output, exit 0.
2. Brief's build-slot command, run 1: exit 1 in `extension:check`, `Cannot find module 'fluxiq/ui'` / `'fluxiq/core'` across many unrelated files: Core's dist was mid-rebuild by the other worker.
3. Re-run (the allowed one): check passed (`extension:check` 66104 ms), smoke test passed, `# tests 1631`, `# pass 1630`, `# fail 1`: `a card for each kind...` expected the unsettled robot check/permission to be `settled` while the unit is current, which my new rule deliberately changes. I updated that expectation and added the not-current test.
4. Third run of the same command (after the test change; Core dist was then stable): exit 0. `extension:check` passed; `Extension smoke test passed.`; `# tests 1632`, `# pass 1632`, `# fail 0`, `# cancelled 0`; `chrome: verified 22 files`, `firefox: verified 22 files` (plus the existing gecko.id placeholder warning), `e2e-chromium: verified 22 files`. New tests appear as `ok` 1202, 1212-1216, 1256, 1257.
5. `node scripts/structure-audit.mjs`: `structure-audit: passed (133 warning(s), 120 baselined).` No `panel/chat` line in its output.

## Not verified

- No browser, no Lab (per the brief); cards not seen on screen.
- Not tested against a live Core stream; events are shaped per the r5-wr report.
- Core's in-progress `cancelled` resolution: not exercised in a test (the Core dist was being rebuilt); the code reads only `activityActionOf`'s outcome/why, so it needs no change.
- Full repository `pnpm check`/`test`/`build` not run; only the extension package and the audit.

## Open questions or contradictions found

1. **Rule change in the view:** an unsettled waiting card says "Waiting for you" anywhere in a current unit. If an older Core (no resolved rows) runs against this extension, a wait answered long ago keeps saying "Waiting for you" until the unit ends. With the r5 Core that cannot happen except for cancelled/unreachable waits, which end the unit.
2. As in Core (r5-wr item 5), when a tool's earlier "started" card exists and its intervention result folds into an ask card, the started card stays where it is with no outcome once it is not current.
3. Asks remain their own message in the extension, while Core's panel attaches an ask after a decision to that decision. Not asked to change; flagging the difference.
