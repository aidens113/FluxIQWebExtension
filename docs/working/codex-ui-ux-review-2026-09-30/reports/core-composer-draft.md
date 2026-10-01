# Core composer draft preservation

Status: Active; reproduction confirmed, corrected focused tests pass; broad checks pending.

## Current State

`ConversationComposer` leaves its textarea editable while onSend is pending, then
unconditionally setText("") on success. Later user input is erased, including
edits that return to the same visible text. The extension counterpart is already
fixed and checkpointed; this matches the same UI contract across surfaces.

Owns only Core apps/web/src/features/automation-studio/conversation/components/
ConversationComposer.tsx and tests/ConversationComposer.test.tsx. No Core runtime
conversation/storage/context-packet edits.

Four regressions added: later edits, retyped identical text, failed send and IME
Enter. Existing unchanged-success and Shift+Enter cases stay intact. No timeout,
skip or weakened expected result.

## Validation and resume

- Initial whole web suite after recovery fix: exit1,286files pass/1fail,
  1699tests pass/1fail. Sole failure is unchanged core-contract flow.build fixture
  pre-provider request budget; isolated diagnosis is assigned separately.
- Reproduction queued in supervisor session39465, from Core apps/web:
  `C:/Program Files/Git/bin/bash.exe C:/Users/osrs_/FluxStuff/build-slots/heavy.sh
  'codex t224 Core composer reproduce' pnpm exec vitest run ConversationComposer`.
- Actual reproduction: session39465 exit1,2failed/8passed. Both later-edit and
  identical-retyped drafts were emptied on successful send; all old six cases,
  failed send and IME case passed. Test assertions were not relaxed.
- Source now tracks user edit revisions and clears only an unchanged submitted
  draft, matching the extension contract. Only the named source/test pair changed.
- Corrected focused run: supervisor session82315 exit0, 1file/10tests passed,
  14.88s. The two reproduced failures now pass without assertion changes.
- Final full web suite session98054 and web typecheck session62339 are running
  through shared heavy slots. Build follows typecheck. Source is frozen.
- No live browser/provider calls or product behavior certification.
