# t195-w36: read-before-last-act note (run `run-murwcaj0-40e56557`, R4)

## Outcome

Done. The draft entry now carries a second information note: when the
instruction names columns, the draft has a kept step that carries `acts`, at
least one kept, proposable read gives every named column, and every such read
sits before the last such act step. The note names the act step, never the read. It is never
said together with the existing "no read in the draft gives" note.

## What changed and why

Core tree `C:/Users/osrs_/FluxStuff/fxwork/t195/!FluxIQ`, R = `packages/fluxiq/src/programs/automation-studio/runtime`.

- `R/flow-bootstrap/authoring/instruction-record-columns.ts`: new non-exported
  builder `readsBeforeLastActSentence` beside the existing one. The published
  `automationStudioFlowBootstrapDraftUnreadColumnsSentence` decides which note to give:
  the unread-column sentence wins, and otherwise it falls through to the new one. Its input changed:
  `reads` is now `{ step?: number; fieldKeys: string[] }[]` (was `string[][]`), plus an
  optional `lastActStep`. Its only non-test caller is `draft-acts.ts`. Wording follows the brief's
  suggestion exactly: `Every read in the draft that gives "name", "mutualFriends" runs before step 10, the last step that does what the instruction asks, so it shows the page as it was before that act; if the instruction asks for what the page shows after it, the draft needs a read after step 10.`
  The module comment records this run as the reason.
- `R/llm/harness-options/draft-acts.ts`: `unreadColumnNotes` passes each read's
  `position` and computes `lastActStep`, the highest position of a step whose
  `acts` is non-empty and that is not dropped or exploratory. Reads use the
  same filter as before, now pulled into `isKept`. The module comment is updated.
- **Why the builder is not exported separately:** the authoring barrel
  (`authoring/index.ts`, not owned by me) lists its exports by name, and the
  structure audit ratchets any import that bypasses a barrel. So the new
  sentence goes out through the function the barrel already publishes, and
  neither the barrel nor the audit baseline needs to change.
- Tests: in `instruction-record-columns.test.ts`, the existing draft-sentence
  cases now use the new read shape, and a new describe has 4 cases. `draft-acts.test.ts` has a new describe with 4 cases. Between them they cover: the note fires; it is silent when a read
  follows the last act; it is silent with no act step, or when the only act step was dropped; and with no read giving every column only the
  old note fires (and when the columns are split across reads, neither fires).

## Commands run and observed results

- Failing-first: I put the HEAD versions of both source files back temporarily and ran
  `npx vitest run R/llm/harness-options/tests/draft-acts.test.ts`, which gave
  `Tests 17 failed | 136 passed (153)`. Every failure was
  `names step 10 and not the read at step 7` (`expected [] to deeply equal [ Array(1) ]`),
  once in each of the 17 vitest projects. The silent cases pass on the old code by nature. The
  instruction-record-columns tests also failed on the old source: the new
  firing cases, and the reshaped existing cases because of the input change. Then I restored the new source.
- Validation, from the Core root:
  `npx vitest run packages/fluxiq/src/programs/automation-studio/runtime/flow-bootstrap/authoring packages/fluxiq/src/programs/automation-studio/runtime/llm/harness-options`
  gave `Test Files 374 passed (374)`, `Tests 4250 passed (4250)`, `Duration 162.04s`.

## Not verified

- I ran no typecheck, as the brief said; vitest does not typecheck. The changes are
  small and typed, and `read.step!` is used only after the filter has checked `step !== undefined`.
- Not checked live in a Lab run, and the structure audit was not run.
- I did not match the test instruction word for word to the run's: I wrote it from the brief's quote. The
  real prefix found in the run reads "Confirm every friend request with at least five mutual friends ... columns name and mutualFriends".

## Open questions or contradictions found

- The brief asked for the builder to sit beside the existing one, which it does, but it cannot
  have its own barrel export without editing `authoring/index.ts`, which I do not own. If the lead wants a
  separately published builder, the barrel line has to be added by whoever owns it.
- An act step only has to be kept, not proposable. That is my reading of "a kept step that does an instructed act".
