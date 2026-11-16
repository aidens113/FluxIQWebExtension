# Extension UX fixes (D6, D10, D3)

## Outcome
Done.

## What changed and why
- D6 (apps/extension/src/panel/projects/project-selector.ts): cause is that the status carries `projectId` before `projectName` (the background learns names from the list, which only the opened switcher read). The selector now names the project from the status at once and, when only the id is known, reads the name from the same projects port and sets it (guarded against a newer status). Runs on mount and every status change.
- "Project chat" label is NOT the extension's: it is Core `!FluxIQ/packages/ui-components/src/chat/view/context-line.ts:38` (`target.projectId !== undefined ? "Project chat" : ""`). Not edited.
- D10 (getting-started/start/steps.ts): while pairing, "Sign in" is now `waiting` (under way, needed to approve) instead of `todo` beside "Connected: Done". The "Start FluxIQ: Next" in 14-ext-initial.png is the disconnected, never-connected state where reachability is genuinely unknown, so it is left as is.
- D10 banner (getting-started/setup-card.ts, new model-key-dismissal.ts, getting-started.css): "Not now" is now remembered per server (gatewayUrl) in localStorage (session fallback if blocked), and also hides Core's `.chat-key-line` via `data-dismissed`. The card was already non-blocking and hidden once a key is ready.
- D3 (start/step-words.ts): default credential text replaced by a pointer to FluxIQ's sign-in page and its first-run instructions.
- Tests: steps.test.ts (waiting state, no credential), setup-card.test.ts (dismissal per server), new projects/tests/project-selector.test.ts.

## Commands run
- `node apps/extension/scripts/test-extension.mjs src/panel` -> pass 695, fail 0.
- `npx tsc -p tsconfig.test.json --noEmit` (apps/extension) -> exit 0, no errors (run before a final rename of one new file; src/panel re-run after it: tests 695 pass).
- `node scripts/structure-audit.mjs` -> after fixing my 5 findings, no FAIL lines.

## Not verified
Live browser (no build run per brief). Whether the background will later send projectName itself (then the list read is skipped).

## Open questions
"Project chat" needs a Core change if unwanted.
