# t770-B: attach a recording in the extension chat

## Outcome
Partial. Everything is built and verified except the literal `pnpm ... build` command, which Core's build guard refuses before it compiles (Core worktree not built, not mine to build). The same steps without the guard pass: tsc and the esbuild bundle.

## What changed and why
Data findings: Core's `/api/recordings` summary has `description` apart from `title` (title = metadata name/title or the id), `status` "recording"/"completed", `projectId`, `startedAt`/`endedAt` ISO, sorted by updatedAt newest first. It lists every project of the domain (not project-scoped), page size capped at 100. The extension's normalizer dropped `description`, so one field was added (no new protocol message). The panel filters by project, finished and described, sorts by startedAt, takes 10. Gap: because Core lists the whole domain, a project whose recordings fall outside the newest 100 domain-wide would not show; a `projectId` query param on Core would fix it.

- shared/protocol.ts: `CoreRecordingSummary.description?`.
- background/connection/core-api.ts (outside the owned list, one line): `normalizeRecordingSummary` keeps `description`.
- NEW panel/chat/attachment/ (barrel index.ts): `attachable-recordings.ts` (filter/sort/limit), `recording-attachment.ts` (button, list, chip; reads `listRecordings` each time the list opens).
- panel/chat/conversation/composer.ts: optional second arg `attachment`; button beside Send, chip and list above the field; `send(text, recordingId?)`; the chip clears only after a send that went. Not kept in the draft.
- conversation/controller.ts, thread-requests.ts: `send(text, recordingId?)`; `threadSendRequest(..., recordingId)` merges `onScreen.recordingId` with any flowId/runId.
- chat-panel.ts: builds the attachment (project = shown target's, else status's), exposes `ChatPanel.attachLatestRecording()`.
- panel/recording/review/recording-review.ts (+ index barrels): optional `onAttach`; adds the "Attach to my next message" button and a status sentence only when `onAttach` is given.
- panel/shell/mount-panel.ts (outside the owned list, 2 lines): review created after chat, `onAttach: () => chat.attachLatestRecording()`.
- chat.css: small styles (`.composer-attach*`, `.composer-chip*`).
- docs/architecture/extension-client.md: one paragraph after the composer-send description.

Attachment belongs to the project it was picked in; if the chat moves to another project the chip hides and nothing is sent.

## Exact DOM names shipped
- Button beside Send: `<button id="conversationAttachButton" class="composer-attach" aria-label="Attach a recording">` (shows "+"; `aria-expanded` toggles).
- List: `<div class="composer-attach-menu" role="group" aria-label="Attach a recording">` containing `<h3>Attach a recording</h3>` then one `<button class="composer-attach-item">` per recording, text = description (accessible name). Empty: `<p role="status">No finished recordings yet. Press Start recording, describe what you will show, then stop.</p>`. Read failure: "Couldn't read your recordings. Try again."
- Chip: `<div class="composer-chip">` text "Recording: <description>" plus `<button class="composer-chip-remove" aria-label="Remove attached recording">`.
- Review: `<button class="small-button">Attach to my next message</button>`, then `<p role="status">` saying "Attached. Say what to automate in the Chat tab." or "Couldn't find this recording to attach. Try Attach a recording in the chat."
- Sent request: `panelConversationSend` with `onScreen: { [flowId|runId], recordingId }`.

## Commands run and observed results
- `node scripts/test-extension.mjs panel/chat panel/recording` (in apps/extension): `# tests 426  # pass 426  # fail 0`. New tests: chat/attachment/tests/attachable-recordings.test.ts, recording-attachment.test.ts, chat/conversation/tests/thread-requests-recording.test.ts, composer-attachment.test.ts, recording/review/tests/recording-review-attach.test.ts. (A subset runner exists; I did not run the whole extension suite.)
- `npx tsc -p tsconfig.json --noEmit` (apps/extension): no output (clean), after fixing one spread error TS2698 it found first.
- `npx tsc -p tsconfig.test.json --noEmit`: no output (clean).
- `pnpm --filter @fluxiq-web-extension/extension build`: REFUSED by scripts/check/core-build.mjs: "FluxIQ Core at ...\fxwork\t770\!FluxIQ is only partly built: 64 of the 76 compiled entry points ... missing ... Build Core first with: pnpm build". Not run through. Instead `node scripts/build-extension.mjs` (the build's second half) succeeded: background/index.js 865.5kb, content/index.js 1015.5kb, page-world 7.3kb, exit 0.
- `node scripts/structure-audit.mjs` at the repo root, final run: 2 violations, both in packages/test-contracts (naming prefix "scenario-", statement packing in tests/scenario-demonstration.test.mjs), files from another worker, not mine. My first run had 6 violations in my files (as-never, statement packing); fixed, and none remain.

## Not verified
- No browser/Lab run; the DOM was only exercised through the fake DOM. Popup/side-panel layout and the CSS are unseen in a real browser (the "+" glyph on the attach button is a placeholder icon).
- The full `pnpm build` (blocked by Core build guard) and the whole extension suite.
- Core accepting `onScreen.recordingId` end to end (the relay forwards it; Core side is another worker's).
- The list when the domain holds more than 100 newer recordings (gap above).

## Open questions
- Should the attach button hide while the chat is not connected? It is disabled whenever the composer is.
- A Lab driver should open the list with the button, wait for the `h3` "Attach a recording", then click the item by its text.
