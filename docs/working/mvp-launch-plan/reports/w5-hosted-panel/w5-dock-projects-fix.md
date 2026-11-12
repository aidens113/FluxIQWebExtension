# w5-dock-projects-fix

## Outcome
Done. The product was right; the spec assumed state the product (correctly) resets. One spec edit fixed it.

## Cause (with evidence)
Run 1 (with build) failed at chat-widget.spec.ts:211, but not as "row never appears". Playwright's call log said the
row `.chat-thread-row[data-conversation-id=<choice>]` WAS in the DOM (`115 x locator resolved to <li data-waiting="true" ...>`)
and was "hidden". The failure screenshot and error-context.md showed the dock after the project opened: the chat had
switched to the project's latest thread ("UI Fixture - Small · Project questions", "2 waiting" badge, the open ask on
screen) and the thread list was collapsed behind the "Chats" button. So the composed port read the project's threads
correctly (hypotheses: stale list, wrong project id, refused list, bad seed are all ruled out by the row existing with the
seeded id and both project threads counted as waiting). Opening a project changes the chat's owner key
(ChatWidget.hostStatus), which resets the chat and closes the narrow dock's list drawer; the spec had opened the drawer
once before the project change and did not open it again.

## Fix
apps/web/e2e/chat-widget.spec.ts: after `openSmallProject(page)` in the "dock lists the open project's threads" test,
call `showThreadList(page)` (opens the drawer as a person would) with a comment saying why. No assertion weakened, no
product code changed.

## Runs
- Run 1 (with build): exit 1; 1 failed (test 7, the above), 6 passed, 8 did not run.
- Run 2 (`--skip-build`, src unchanged since run 1's build): exit 0, "15 passed (1.2m)", "0 round(s) failed". This includes
  the project-thread choice test (8), the open-ask test (9) and U5 (15).
- `pnpm --filter @fluxiq/web exec vitest run src/features/chat-widget src/features/panel-shell`: 21 files, 150 tests passed.
- `pnpm structure:check`: "structure-audit: passed (537 warning(s), 916 baselined)".
- No node process with fxwork/t901 in its command line remained after the last run (count 0).
- Memory gate: free memory was 600-1200 MB for about 40 minutes (other lanes' tsc/structure-audit); waited, ran at 4248 MB
  (run 1) and 2529 MB (run 2).

## Not verified
Whole-package typecheck (supervisor's). Only the desktop-chromium project ran.

## Open questions
None. Note for the supervisor: the narrow dock closing its list on a project change is existing widget behavior
(Core ui-components), not changed here.
