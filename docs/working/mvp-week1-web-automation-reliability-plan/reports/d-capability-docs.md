# d-capability-docs — the architecture pages describe uploads, tabs, frames and confirmations (docs)

Worker report, 2026-09-13. Brief: `briefs/finish-week1.md`, section
"d-capability-docs". Repository at `1316533`, with the extension work
uncommitted.

## Outcome

**Done.** Three architecture pages now describe the current design of file
uploads, tab switches and closes, child frames and runtime confirmations. No
plan history was added.
- The link check passed: 74 relative links, 0 unresolved.
- The structure audit passed.
- No build or test was run. The brief says to read code only.

**Pages edited:**
- `docs/architecture/web-capabilities.md`;
- `docs/architecture/extension-client.md`;
- `docs/architecture/sensitive-values.md`. It describes recorded events and
  runtime confirmations, so it falls under the brief's third Owns line.

**Pages read and left unchanged, because they are still accurate:**
- `element-identity.md` ("an action addresses one frame");
- `page-evidence.md` ("the action path is top-frame only unless a command
  addresses a frame");
- `testing-facility.md`, whose step list already names `upload`, `switchTab`
  and `closeTab`.

`failure-taxonomy.md` is now out of date, but I did not edit it. See Open
questions, item 1.

## What changed and why

### 1. What is recorded and replayed

**`web-capabilities.md`, "Recorded Actions" (rewritten)**
- **The inputs.** A table lists all eleven action inputs and their ten outputs.
  The two tab inputs share `web.browser.tab`, so an input is taken from
  `tab.operation`, never from that output. Upload and tab are removed from the
  dispatch-only list.
- **When a recorded event replays.** Every required parameter must be present,
  which means one of:
  - a non-empty string;
  - a request for a secret;
  - for `upload`, an upload request;
  - for `tab`, a close, or a switch that names a path.
- **A file choice.**
  - It becomes `web.dom.upload`, whose `upload` is Core's state binding for
    `web.upload.<key>`, with no `fallback`.
  - The key follows the same rule as a secret request's key.
  - The node holds no file name, count or content, and the fingerprint drops
    `value`.
  - A run supplies the files as `{ files: [{ name, mimeType, contentBase64 }] }`.
  - A request the run left unanswered is refused before dispatch as
    `USER_INTERVENTION_REQUIRED`.
  - A file input recorded with `hasValue: false`, or with an `inputValue` of
    `""`, stays evidence.
- **A tab switch or close.**
  - The input comes from `tab.operation`. The recording-start marker carries no
    `tab`, so it stays evidence.
  - A close builds `{ tab: { operation: "close" } }`.
  - A switch builds `{ tab: { operation: "switch", urlPath } }`, and only a
    switch with a path can replay.
  - No node ever holds a tab id, origin or query.
- **A child frame.** The node gains `browserFrameUrlPath`, the pathname of the
  recorded `url`, beside `browserFrameId`. Only a `web.dom.*` node recorded in a
  frame above 0 at an http(s) URL gains one.
- **The checkbox bullet is corrected.** It claimed the descriptor carries no
  `checked`. The source contradicts that: `content/describe-element.ts:69-70`
  sets it, and `domain/src/output-nodes/payloads.ts:175-183` reads it. See Open
  questions, item 2.

**`web-capabilities.md`, the capability matrix**
- **Switch tab.**
  - The rule is id first, then the newest tab at the exact path, then a URL
    substring.
  - A path match ignores the origin and never takes a browser or extension page.
  - A switch by path waits for its tab, polling every 100 ms until the timeout,
    or 10 s.
  - A switch remembers the tab it left.
  - The input `web.user.tab_switched` and `tab-recorder.ts` are added.
- **Close tab.**
  - Closing the automation tab fronts the most recently driven tab still open,
    from a history of 8.
  - A named tab that is not the automation tab fronts nothing.
  - The input `web.user.tab_closed` is added.
- **Basic file uploads.** The input `web.user.files_chosen` and
  `upload-binding.ts` are added, with one sentence on replay.

**`web-capabilities.md`, "How An Action Runs"**
- Step 1 lists `browserFrameUrlPath`, which is read as `frameUrlPath`.
- Step 2 points to the new "Child Frames" section.

**`web-capabilities.md`, new "Child Frames" section**
- It explains why a frame id cannot be used on replay.
- A table gives `chooseFrame`'s five cases: no path, an empty frame list, one
  match, several matches, and no match.
- `TARGET_AMBIGUOUS` is not retryable, and `TARGET_NOT_FOUND` is retryable.
- Only the pathname of an http(s) document is compared, and the top frame is
  never a candidate.
- A refusal names paths, never a full URL, and is reported against the recorded
  id.

**`extension-client.md`, "Recording Evidence"**
- **The evidence list** now says "tab switches, tab closes and navigation
  changes".
- **New tab-recorder rules:**
  - what a switch records;
  - how a blank new tab is waited for, for up to 10 s;
  - that a close is recorded only for the tab the recording is in, with no tab
    id;
  - what is never recorded: a page a recording cannot see, and a tab change made
    while FluxIQ runs a command;
  - that each tab event is sent and counted once;
  - that the marker carries no `tab`.

### 2. The runtime confirmation for every recorded executable verb

**`web-capabilities.md`, "Recorder Trust And Runtime Confirmations"**
- **A table** covers all eleven cases: output, event kind, input, and what else
  the event carries. That includes `check` and `upload` with no value, a switch
  with `tab: { operation: "switch", urlPath }`, and a close with
  `tab: { operation: "close" }`.
- **When one is sent.** It is a `client.recording_event` sent after the
  `client.action_result`, with `metadata.runtimeConfirmation: true`. A failed
  action confirms nothing, and neither does a tab `open`.
- **How a tab confirmation gets its tab.**
  - `startAction` keeps the command's `tab` request, and `tabRequestFor` returns
    it only for the same command id.
  - A switch's `urlPath` is the pathname of the page the switch left in front.
  - It has no path when the result has no readable URL, the page is unsupported
    or has an opaque origin, or the path rule refuses the path. The domain then
    keeps that switch as evidence.
  - A close carries no path.

**`extension-client.md`:** a short paragraph on a confirmation's wire shape,
linking to that table.

**`sensitive-values.md`, the "Runtime confirmations" bullet:** only `type` and
`select` read a value; `check` and `upload` carry none; a tab confirmation
carries only its operation and a pathname.

### 3. The recorder sends no file input value

- **`web-capabilities.md`, the trust section.**
  - `readElementValue` returns nothing for a file input.
  - The descriptor has no `value`, `input` and `change` have no `inputValue`, and
    the snapshot ranks the input without a value.
  - `inputType: "file"` and `hasValue` still travel.
- **`extension-client.md`:** a paragraph after the sensitive-values paragraph
  says the same, whatever `captureInputValues` is set to.
- **`sensitive-values.md`:**
  - the "Element descriptors" and "Recorded events" bullets now cover file
    inputs;
  - a new "Recorded uploads" bullet under Readers says the upload node holds no
    file name, count or content, and that `web.upload.` is a separate namespace
    from `web.secret.`.

### 4. The wire contract

**`extension-client.md`, "Action Surface"**
- `tab.urlPath` on a `web.browser.tab` switch. A malformed one refuses the whole
  tab request, so the command fails as `INVALID_PARAMETER`.
- `frameUrlPath`, lifted only from `browserFrameUrlPath`. It is optional, so a
  malformed one is left off and the action goes by frame id alone.
- Both use one rule, `webAutomationUrlPath` (`domain/src/output-nodes/url-path.ts`,
  `/^\/(?![/\\])[^?#]*$/u`), which the extension imports.
- One sentence says `runActionInFrame` first chooses the frame at the path.

**`extension-client.md`, "Declared Inputs And Outputs"**
- The list of classified actions now has all eleven.
- A table gives the three new inputs: `web.user.files_chosen` maps to
  `web.dom.upload`, and `web.user.tab_switched` and `web.user.tab_closed` both
  map to `web.browser.tab`.

**`extension-client.md`, the recorded payload**
- `RecordingEventPayload.tab` is the domain's `WebAutomationRecordedTab`,
  `{ operation: "switch" | "close"; urlPath?: string }`. A JSON example uses the
  made-up path `/orders/details`.
- A `browser.tab` event is stored as `web.tab.state_changed`.
- The builder copies only `operation` and `urlPath` into the stored `tab`.
- The event's own `url` is a separate field. The tab recorder cuts it to origin
  and path; a confirmation sets it from the action result unchanged.

## Commands run and observed results

All commands ran from the repository root. Output went to scratch logs, which
were then read.

- **`git status --short docs/architecture`, before editing:** printed nothing,
  so no one else had uncommitted edits there.
- **The link check**, run twice: after the main edits, and on the final bytes.
  - Command: `node <scratchpad>/dcd-check-links.mjs docs/architecture/web-capabilities.md docs/architecture/extension-client.md docs/architecture/sensitive-values.md`.
  - What the script does: it resolves every relative link in the three pages to
    a file that exists. Where a link names an anchor, it checks the anchor
    against the target page's headings, turned into GitHub-style slugs.
  - Both runs: exit 0, `checked 74 relative links in 3 page(s), 0 unresolved`.
- **`node scripts/structure-audit.mjs`**, twice, the second on the final bytes.
  - Both runs: exit 0, `structure-audit: passed (40 warning(s), 17 baselined).`
  - On the final run, `grep -cE "docs/architecture"` of the log printed `0`.
- **`git diff --stat docs/architecture`:**
  - `extension-client.md`, 121 lines changed;
  - `sensitive-values.md`, 19;
  - `web-capabilities.md`, 196;
  - in all, `3 files changed, 296 insertions(+), 40 deletions(-)`.
- **Line endings.** Every line of each page ends in CRLF, as at HEAD:
  - `web-capabilities` 509 of 509;
  - `extension-client` 599 of 599;
  - `sensitive-values` 179 of 179.

  Git still printed its LF-to-CRLF warning for two of them.

## Not verified

- **Statements that rest on work not yet committed.**
  - **Every extension-side statement.** This covers the tab recorder, tab
    replay, the frame lookup, a file input's value, and all runtime
    confirmations. The extension source is uncommitted: `tab-recorder.ts`,
    `frame-address.ts` and their tests are untracked, and `browser-tab.ts`,
    `automation-tab.ts`, `describe-element.ts`, `runtime-status.ts` and the rest
    are modified.
  - **A tab confirmation's `tab` field** (`f-capability-confirmations`,
    Amendment). The code is in the working tree
    (`runtime-status.ts:138-162`, `server-command-channel.ts:230`). The
    Amendment report exists and claims 460 of 460 tests passed. I did not rerun
    anything, and the supervisor has not yet verified it.
  - **A file input recorded with `hasValue: false` stays evidence**
    (`g-runner-upload-input`, task 5). When I first read
    `domain/src/io/input-model.ts`, line 142 checked only `inputValue === ""`. By
    the end of my work, line 143 also checks `element?.hasValue === false`,
    uncommitted. I did not read that worker's report or run its test.
  - **The domain side** is committed at `1316533`: the three inputs, the upload
    binding, the tab and frame parameters, the path rule, and the unanswered
    upload refusal.
- **No observation backs any behaviour described.** No test, build, content
  harness, browser or Lab run. Every description comes from reading source and
  the workers' reports. The "Never exercised in a browser" note on the tab rows
  is kept for that reason.
- **Anchors checked only by my slug function**, not by a real Markdown renderer:
  `#child-frames`, `#recorded-actions`, `#recorder-trust-and-runtime-confirmations`,
  `#capability-matrix` and `#recording-evidence`.
- **A child frame's recorded `url`.** The page says it is that frame's own
  document. That rests on `content/recorder.ts:134` (`url: location.href`) and on
  the content script running inside that frame.
- **Core's handling of a switch confirmation with no path.** The pages say only
  that the domain's mapping keeps it as evidence. I did not read what Core
  records under its `metadata.inputId`.
- **The 40 audit warnings.** Earlier reports saw 39. I did not find which file
  added the fortieth; no warning names `docs/architecture`.
- **What a Lab run should confirm for these pages:**
  - W15: three recorded `web.tab.state_changed` entries carrying `tab`, and
    replayed tab confirmations carrying `tab`;
  - W17: an upload node with no file name, and a file input with no `value`;
  - W28: child-frame nodes carrying `browserFrameUrlPath`, and both clicks
    reaching the frame at that path.

## Open questions or contradictions found

1. **`failure-taxonomy.md` is out of date, and I did not edit it.**
   - Its "Who Produces What" list, "The worker-side verbs" (lines 150-162), does
     not list `runtime/frame-address.ts`. That file now produces
     `TARGET_NOT_FOUND` and `TARGET_AMBIGUOUS`.
   - The page does not describe recording, the recorded payload or
     confirmations, so a strict reading of the brief's Owns excludes it.
   - Suggested line: "`runtime/frame-address.ts` (`TARGET_NOT_FOUND` and
     `TARGET_AMBIGUOUS` for a command whose child-frame path matches no frame, or
     several with none at the recorded id)".
2. **I corrected a stale claim outside the brief's four items.** The
   `web-capabilities.md` bullet said "A recorded checkbox toggle is still
   evidence, not an action", because the descriptor had no `checked`. The source
   now reports and reads `checked`. The page is owned and describes recording,
   so I fixed it rather than leave a false statement. Please revert it if that
   was out of scope.
3. **A runtime confirmation's `url` still holds the full result URL, query
   included**, for every verb. This is the Amendment's open question 1.
   `extension-client.md` now states it plainly and does not call it withheld.
4. **The path rule is written in two extension files:** `frontTabPath` in
   `runtime-status.ts` and `pageAddress` in `tab-recorder.ts`. The pages describe
   the rule as they behave today.
5. **Left unchanged on purpose, to avoid plan history.** The history in
   `web-capabilities.md`'s header paragraph, and the "Changed by (Phase 1.2)"
   cells, still "Step 3, landed", for Switch tab, Close tab and Basic file
   uploads. Phase 1.6b, which brings the pages to their finished state, may want
   to trim both.
6. **The summary counts in `web-capabilities.md` are unchanged.** Switch tab,
   Close tab and Basic file uploads were already "Fully supported", and no row
   changed state.
7. **Structure baseline:** no entry needs to change.
