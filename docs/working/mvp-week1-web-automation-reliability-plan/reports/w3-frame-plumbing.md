# Report: w3-frame-plumbing

Worker: `w3-frame-plumbing`. Wave 3, parallel: Phase 1.3 step 4 on the extension
side — a command addressed to a child frame reaches that frame, and no other.

## Outcome

**Done**, with one hole in the brief's ownership that leaves a real gap open
(see [The seam the brief left out](#the-seam-the-brief-left-out)). Both halves
are implemented, both are covered by tests that were shown to fail without them,
and the extension's `check`, unit `test` and my `test:content` rows all pass.
Nothing I wrote is inert: `action-runner.ts` is the sender and
`message-handler.ts` is the receiver, so the two ends of the change invoke each
other.

## What changed and why

### `apps/extension/src/runtime/action-runner.ts` — the sending half

The runner already read `frameIdForAction(action)` and passed it to
`chrome.tabs.sendMessage` as the delivery `frameId`, so the basic routing was
there. Two things were not.

**The address now travels in the message body as well as in the delivery
option.** They answer different questions. The option is what makes the message
arrive at one frame instead of every frame in the tab. The body's `frameId` is
what lets the receiving frame confirm it is the addressee — which matters
because the runtime is not the only sender: `packages/test-runner`
(`interactive-session.ts:169`, `web-flow-exploration.ts:180`) sends
`executeAction` to a whole tab with no frame option at all, and so does
`e2e/action.spec.ts`. `topFrameOnly` stays for exactly that reason: it is the
older half of the same contract and those senders still send it.

**A frame the tab does not have is now named, instead of becoming an
anonymous connection error.** A frame id belongs to a tab and is reassigned
every time that frame navigates, so an id recorded at capture can name nothing
by the time a Flow replays it. Before the check, `chrome.tabs.sendMessage`
rejected with Chrome's "Could not establish connection. Receiving end does not
exist.", which `command-router.ts` turns into a generic
`web.action.failed` — a message that names no frame and gives an operator
nothing to act on. Now `allTabFrames(tabId)` is consulted first (an existing
export of `background/tabs.ts`; nothing there was edited) and a missing frame
becomes `TARGET_NOT_FOUND` reading `expected: "frame 7 in the tab"`,
`actual: "the tab has frame 0, frame 3"`.

Three deliberate limits on that check:

- **The top frame is never looked up.** A tab always has frame 0, so consulting
  the enumeration for it could only ever produce a false failure. A test covers
  this by enumerating no frames at all and asserting the action still goes.
- **An empty enumeration is "unknown", not "no frames".** `allTabFrames`
  swallows a `webNavigation` error into `[]`, so treating `[]` as "the tab has
  no frames" would fail every child-frame action on a browser that declines to
  answer. The action is sent and judged by its own outcome — the same rule
  `unsupportedPageReasonFor` already follows for a tab whose URL cannot be read.
- **`TARGET_NOT_FOUND`, not `PAGE_CHANGED`.** The frame is part of the address
  the action could not resolve, and the code set puts that at stage
  `target_resolution` and marks it retryable, which is right: a frame the page
  has not finished creating may still appear.

The code comes from `WEB_AUTOMATION_FAILURE_CODES` via
`@fluxiq-web-extension/domain/client`; no wire string is written at the call
site. `allTabFrames` was added to the **existing** `../background/tabs` import
line rather than a new one, because the `imports` rule counts barrel-skipping
*specifiers* per file and `action-runner.ts` is baselined at 1 — a second import
statement would have grown a baselined entry.

### `apps/extension/src/content/message-handler.ts` — the receiving half

`isAddressedToThisFrame` replaces the old one-way guard
(`topFrameOnly === true && !isTopFrame()`). The rule is now symmetric:

| Address in the message | Frame that answers |
| --- | --- |
| `topFrameOnly: true` | the top frame only |
| `frameId: 0` | the top frame only |
| `frameId: n > 0` | a child frame only |
| neither | any frame that receives it |

A content script cannot learn its own frame id — no API tells it — so the check
is the one thing a frame knows about itself. That is enough, because it
separates the two cases that exist; *which* child is settled by the delivery.
The gap this closes is real rather than theoretical: on the broadcast path every
frame receives the message and Chrome keeps whichever `sendResponse` fires
first, so an action meant for a checkout iframe could be answered by the page
around it. A message with no address is still accepted, so a broadcast meaning
"whoever you are" keeps working.

`captureSnapshot` deliberately gets no guard:
`background/connection/dom-snapshot.ts` addresses each frame in turn and *wants*
a per-frame answer, so a guard there would break merged snapshots.

### Tests

`apps/extension/src/runtime/tests/action-runner.test.ts` gains six rows and a
`chrome` stub. Frame routing is testable in Node because what must be right is
an argument to `chrome.tabs.sendMessage`, and a page cannot observe its own
delivery. The stub answers `tabs.get` with a tab carrying no URL, which is a
shape the runner already has a rule for (an unreadable URL means "judge the
action by its own outcome") and which also makes `waitForTabReady` settle at
once, since its stability window compares the URL against the last one it saw
and two unknowns are already stable — so the rows cost no wall clock.

`apps/extension/e2e/content/tests/frames.spec.ts` is new: three rows on
`iframe-checkout`, which is the fixture the plan's Phase 1.3 proof names. One is
a table of all eight address × delivered-to combinations; the other two perform
the real cross-frame click, in the same-origin child frame and in the
cross-origin one, and assert the page and the Scenario Lab oracle, not just the
reply. Both child frames are exercised because the cross-origin one is
out-of-process, which is where a routing assumption that holds locally tends to
stop holding.

The spec's header also records what is **not** covered and why: shadow DOM. The
recorder sees inside a shadow root (`content/event-elements.ts` reads the
event's composed path) but resolution runs `document.querySelector`, which does
not pierce one — so a shadow-root target is recorded and not replayable, as the
brief says. It is not a frame-addressing item: a shadow root is not a frame and
has no id to address.

## Commands run and observed results

`EXTENSION_TEST_BUILD_LABEL=w3-frame-plumbing` was set for every package
command. Exit status was captured by redirecting to a file and echoing `$?`,
never through a pipe. No `pnpm build` and no `pnpm lab` command was run.

- `pnpm --filter @fluxiq-web-extension/extension check` → **exit 0**, no
  diagnostics. `tsconfig.test.json` includes `e2e/**/*.ts`, so the new spec is
  type-checked here.
- `pnpm --filter @fluxiq-web-extension/extension test` → **exit 0**.
  `# tests 130 / # pass 130 / # fail 0`. My six rows are `ok 80`–`ok 85`.
- `pnpm --filter @fluxiq-web-extension/extension test:content frames.spec.ts` →
  **exit 0**, `3 passed`.
- **Mutation check on the receiving half.** `isAddressedToThisFrame` was
  temporarily reduced to the old rule (accept any `frameId`), the spec rerun,
  and the failure observed: `{"frameId":1} delivered to the top frame` —
  `Expected: false, Received: true`, two of three rows failing. The guard was
  then restored and the spec rerun green. Without this the spec would prove only
  that the code does not crash.
- `node scripts/structure-audit.mjs` with a scratch `GIT_INDEX_FILE` (a copy of
  `.git/index` with the new spec, and later this report, added; the real index
  was never written) → **exit 1**, and each time an identical run against the
  **unmodified** index produced exactly the same findings, so **no finding names
  any file of mine and my change adds none**. What the audit reports is other
  people's, and it moved while I worked: the first pair of runs gave
  `31 warning(s)` and one violation, `FAIL [working-docs] docs/working/README.md
  is out of date with the documents' header blocks`; the last pair gave
  `27 warning(s)` and two, the same working-docs one plus
  `FAIL [imports] apps/extension/src/runtime/tests/result-mapping.test.ts:
  1 import(s) reach into another directory's files instead of its barrel, e.g.
  "../../content/evidence"` — `w3-evidence`'s file, landing mid-run.
- `pnpm --filter @fluxiq-web-extension/extension test:content` (full suite) →
  **exit 1**, `115 passed / 17 failed`. All three `frames.spec.ts` rows passed
  (`ok 43`–`ok 45`). Every one of the 17 failures is in a spec I do not own and
  is a concurrent worker's change landing ahead of the spec that asserts the old
  behaviour:
  - 14 rows in `click`, `keyboard`, `select`, `check-assert` and `upload-dialog`
    now read `code: "web.action.rejected"` where the spec expects
    `web.action.disabled` / `.covered` / `.hidden` — the `results.ts` collapse
    to the single `ACTION_REJECTED` code (`w3-failure-producers`).
  - 3 rows in `resolve-target.spec.ts`, whose own header says it pins today's
    behaviour "known defects included" and that "Phase 1.3 changes resolution
    and must change these assertions with it" (`w3-resolver`).
  Reran as the binding rules require. The second run failed earlier still, in
  global setup, because `resolve-target.ts` imported two names the identity
  barrel did not yet export — a half-landed parallel edit. The third run got
  past it and produced the 115/17 above.

## Not verified

- **No live browser validation of the sending half.** The chrome stub proves the
  runner passes the right `frameId` to `chrome.tabs.sendMessage`; it does not
  prove Chrome delivers to that frame, and the content harness has no frame
  routing at all (its own header says so). What has not been exercised is the
  real path end to end: a loaded extension, a service worker, and a real
  `chrome.tabs.sendMessage` into an out-of-process iframe. That needs a T3 run
  with the unpacked extension, which the brief did not ask for and which the
  Lab-serialization rule keeps out of a parallel worker's hands.
- **The frame-existence check has never met a real `webNavigation` enumeration.**
  Its behaviour on a real tab — particularly what `getAllFrames` reports for a
  frame that is mid-navigation — is reasoned from the API contract, not observed.
- **`pnpm check`, `pnpm test` and `pnpm build` at the repository root** were not
  run: `build` is forbidden to workers, and the other two would have reported
  nine other workers' in-flight edits rather than mine.
- **The 17 content-suite failures were attributed by reading the diffs, not by
  reverting the other workers' changes.** Each failure message names a code or a
  resolution assertion, and none names a frame, but the attribution is inference.
- **Firefox.** `browser.tabs.sendMessage` accepts the same `{ frameId }` option
  and the manifest declares `all_frames: true`, so the change should behave
  identically, but no Firefox build was loaded.

## Open questions or contradictions found

### The seam the brief left out

**A child frame with no content script is still unreachable, and closing that
needs `background/tabs.ts`, which the brief does not give me.**

`ensureContentScript` (`apps/extension/src/background/tabs.ts:50-67`) pings and
re-injects **frame 0 only** — `target: { tabId, frameIds: [0] }` — and it is the
only recovery path an action has (`attachTabForRecording` calls it before every
in-page action). Child frames are covered by the manifests' declarative
`all_frames: true` entry, which is enough in the normal case. It is not enough
after an extension reload or update: every already-loaded frame loses its
script, frame 0 is recovered, and a command addressed at a child frame then
reaches a frame that exists but has no listener. My existence check does not
catch it — the frame is there.

The fix is a `frameIds: [frameId]` variant of `ensureContentScript` in
`background/tabs.ts` plus one call from `runActionInFrame`. I did not write it:
`tabs.ts` is outside my Owns, and duplicating the injection in
`action-runner.ts` would put the capability in the wrong module. **The brief
should have included `apps/extension/src/background/tabs.ts`.** This is the
ownership-drawn-around-a-file shape the wave's binding rules warn about, and it
is the one part of "a command addressed to a child frame must reach that frame"
that is still open.

### Codes outside the closed set, in files Wave 3 gives to nobody

Two failure codes on the runtime path are not in `w3-failure-codes`' set, and
neither is fixable from inside my Owns:

- `action-runner.ts` calls `workerBlockedFailure("web.page.unsupported", …)`.
  The string is in my file, but `workerBlockedFailure` hardcodes stage
  `dispatch` while `ACTION_REJECTED` is stage `execution`, so swapping the code
  alone would emit a record that contradicts the table the set exists to
  enforce. Half a fix is worse than none here, so I left it.
- `runtime/action-results.ts` `navigationUnexpectedFailure` hardcodes
  `code: "web.navigate.unexpected_url"` at stage `verification`; the set says
  `web.navigation.unexpected` at stage `confirmation`.

**No Wave 3 brief owns `apps/extension/src/runtime/action-results.ts`.**
`w3-failure-producers` owns the content script's `results.ts` and the domain
adapter, not this one. It is the third producer of failure records on the
browser path and it needs an owner before the taxonomy can be called closed.

### Specs left behind by two parallel workers

The 17 content-suite failures above are not transient: they are five spec files
asserting codes that `w3-failure-producers` has renamed, and one asserting
resolution behaviour that `w3-resolver` has changed. Neither brief lists those
specs under Owns (`w3-failure-producers` owns `failures.spec.ts`; `w3-resolver`
owns `identity-resolution.spec.ts`), so unless the supervisor assigns them,
`test:content` stays red after both workers report Done. The files are
`click.spec.ts`, `keyboard.spec.ts`, `select.spec.ts`, `check-assert.spec.ts`,
`upload-dialog.spec.ts` and `resolve-target.spec.ts`.

### Smaller things

- **The harness's page-global name is written out in my spec.**
  `e2e/content/harness.ts` keeps `__fluxiqContentHarness` private and
  `e2e/content/index.ts` does not export it, but reaching a child frame's stub
  requires it — the harness's own `deliver` only ever talks to the main frame.
  One exported constant in `harness.ts` would remove the duplication. I own
  neither file. (The harness's other written-out names are deliberate, per its
  header; this one is not a wire name, so the argument does not apply.)
- **`e2e/content/tests/` is filling up.** 13 files with mine; the four other
  Wave 3 specs take it to 17, past the 15-file advisory. The hard limit is 25,
  so it warns rather than fails, but a `tests/<area>/` split is coming.
- **No dependency on `w3-domain-contracts` landing.** `command-options.ts`
  already reads `action.frameId` first and `options.browserFrameId` second, so
  routing works from either shape; a unit test covers each. I edited nothing
  under `domain/`.
- **Shadow DOM has no home in authored documentation.** The plan calls it a
  post-MVP item and I recorded it in the spec header, but there is no note in
  `docs/architecture/` saying a shadow-root target is recorded and not
  replayable. I own no document there.
