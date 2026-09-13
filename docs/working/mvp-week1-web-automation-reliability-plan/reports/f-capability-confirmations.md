# f-capability-confirmations — an upload and a tab change confirm like any recorded action (extension)

Worker report, 2026-09-13. Brief: `briefs/finish-week1.md`, Twenty-eighth
dispatch. Private build label `fcc`, removed afterwards. HEAD moved while I
worked, from `dd9b9f9` to `7a6a8e7`; my files are uncommitted.

## Outcome

**Done.** All four tasks are built, and each guard has a mutation proof restored
byte-identical by hash.
- A succeeded `web.dom.upload` confirms.
- A succeeded tab switch or close confirms, with the input its own command's
  operation chooses.
- The caller's failed-status check is removed, and a test proves it was
  redundant.

The input ids come from `f-domain-capability-gaps` task 1. I waited for its
report's "Task 1 compiled" note before writing code that uses them, and defined
no copy.

## What changed and why

### `apps/extension/src/background/connection/runtime-status.ts`

**Task 1, the upload.**
- `runtimeConfirmationForActionResult` returns
  `{ kind: "dom.change", inputId: WEB_AUTOMATION_INPUT_IDS.filesChosen }` for a
  succeeded `web.dom.upload`.
- It has no `inputValue` member, because a file input's value is a local file
  name.
- `dom.change` is the kind the recorder emits for a file input's change (report
  P5).

**Task 2, the tab change.**
- The function takes a second argument, `tab?: BrowserActionCommand["tab"]`.
- A succeeded `web.browser.tab` goes through the new `tabConfirmation(tab)`:
  - `operation: "switch"` gives `{ kind: "browser.tab", inputId: tabSwitched }`;
  - `operation: "close"` gives `{ kind: "browser.tab", inputId: tabClosed }`;
  - an `open`, or no request at all, gives nothing, because the result alone
    cannot say which input it was.
- The confirmation carries no path, tab id, URL or value.

**How the request reaches the function.** The runtime router calls
`sendActionResult(result, tabId, frameId)` without the command
(`runtime/command-router.ts:30-33`). `sendActionResult` also calls `finish`,
which replaces the status, before `sendRuntimeConfirmation` runs. So:
- `RuntimeStatusTracker.startAction` now keeps `{ commandId, tab }` in a private
  `startedTab`;
- the new `tabRequestFor(commandId)` returns that request only when the command
  id matches;
- a later `startAction` replaces it.

`start()`, which the snapshot command uses, does not clear it. The command-id
match covers that case.

**P2 is intact.** Its uncommitted diff was committed by the supervisor as
`9efd8c2` while I worked. Its lines are unchanged: the guard at `:116`, the
check branch at `:122`, and its tests. I renamed one P2 test to cover the new
rows ("...confirms nothing, a check, an upload and a tab change included") and
widened its loop.

### `apps/extension/src/background/connection/server-command-channel.ts`

`sendRuntimeConfirmation` only:
- It passes `this.deps.runtimeStatus.tabRequestFor(result.commandId)` to the
  confirmation function.
- **Task 3:** `if (result.status !== "succeeded") return;` is removed. The
  comment now says the confirmation function decides that. The proof is
  mutation 4 below.

### Tests

**`tests/runtime-status.test.ts`**
- **The confirmation table.** `web.dom.upload` now expects the files
  confirmation, and `web.browser.tab` the close confirmation.
- **Every row takes `closeTab`.** So the rows also prove a tab request changes
  nothing for any other verb.
- **Failed rows.** Every action type, `failed` and `timed_out`, each with a
  close and with a switch request, confirms nothing.
- **New: "an upload confirmation carries nothing from the input it filled, a
  sensitive one included".**
  - Rows: a file input, and one marked `data-sensitive=true`.
  - Each carries `value: "C:\\fakepath\\hunter2-secret.pdf"`.
  - Strict deep equality proves there is no `inputValue`.
- **New: "a tab confirmation names the input its command's operation maps to,
  and carries nothing else".**
  - Rows: a switch by exact path, a switch by tab id, a close, a close by tab
    id, an open, and no request.
  - The result has a URL with a query and an element value, and deep equality
    proves none of it is carried.
- **New: "the tracker hands back a tab request only for the command that
  started it".** It covers the command-id match, survival across `finish`, and
  replacement by a later action.

**`tests/server-command-channel.test.ts`**
- **The harness now records every `send`.**
- **New helpers.** `finishAction` starts the action as `execute_action` does,
  then calls the private `sendActionResult` through a cast. The router itself is
  not run, so the rows need no browser.
- **New: "an action that did not succeed replies with its result and sends no
  recording confirmation".** Every action type, `failed` and `timed_out`; a tab
  command carries a close request.
- **New: "a succeeded upload, tab switch or tab close is confirmed once, after
  its result, with no value".** For each, the sent messages are exactly
  `["client.action_result", "client.recording_event"]`, with:
  - the right `metadata.inputId` and `metadata.clientKind`;
  - `runtimeConfirmation: true`;
  - no `inputValue` member on the event payload.
- **New: "a tab result is confirmed only with the request its own command
  started with".** A result whose command id differs from the started close
  sends only its action result.

## Commands run and observed results

Commands ran from `apps/extension` with `EXTENSION_TEST_BUILD_LABEL=fcc` unless
noted. Output went to scratch logs, which were then read.

### Final gates, on the finished code

| Gate | Result |
| --- | --- |
| `pnpm check` | exit 0, no `error TS` lines |
| `pnpm test` | exit 0; `Extension smoke test passed.`; `# tests 435`, `# pass 435`, `# fail 0`; rows 131-153 all `ok` |
| `node scripts/structure-audit.mjs` (repo root) | exit 0; `structure-audit: passed (39 warning(s), 17 baselined).`; no line names any of my four files |
| `sha256sum -c` against the pre-mutation hashes | all four files `OK` |

### Earlier runs, while other workers were mid-edit

- **`pnpm check`, three runs.** The first two exited 2, and every error was in a
  domain file `f-domain-capability-gaps` was editing:
  - `input-model.ts(131,14)` `recordedTabInputId`;
  - `payloads.ts(3,38)` `webAutomationSecretKeyForRecordedElement`;
  - `gateway-mapping.ts(153,22)` `webAutomationUploadBindingPath`;
  - later, `input-model.ts(216,32)`, the missing import.

  No error ever named my files. The third run is the passing one above.
- **First `pnpm test`.** Exit 1, `# pass 434`, `# fail 1`. The one failure was
  `not ok 298 - a file input yields no value, so the chosen file's local name
  never leaves the page`, in `content/tests/describe-element.test.ts`. That is
  `f-frame-address`'s work in progress, not mine. It passed in every later run.

### Mutation proofs

Script `fcc-mutations.sh` in my scratchpad. Each mutation:
1. copied the file;
2. replaced one exact, unique anchor;
3. ran `node scripts/test-extension.mjs`;
4. restored the copy and compared hashes.

| # | Mutation | Observed failures (`# fail`) | Restore |
| --- | --- | --- | --- |
| 1 | Delete the `web.dom.upload` branch | `not ok 132` (`+ undefined`, `- { inputId: 'web.user.files_chosen', kind: 'dom.change' }`), `135`, `152` (`- 'client.recording_event'`). 3 | byte-identical `6c9bc8bd…` |
| 2 | A close confirms `tabSwitched` | `not ok 132` and `136` (`+ inputId: 'web.user.tab_switched'`, `- inputId: 'web.user.tab_closed'`), `152` (`actual: 'web.user.tab_switched'`). 3 | byte-identical `6c9bc8bd…` |
| 3 | The upload carries `...confirmedValue(result)` | `not ok 135` (`+ inputValue: 'C:\\fakepath\\hunter2-secret.pdf'`), `137` (`actual: 'entered'`), `152` (`expected: false`, `actual: true`). 3 | byte-identical `6c9bc8bd…` |
| 4 | Delete `if (result.status !== "succeeded") return undefined;`, with the caller's check already removed | `not ok 133` (`web.browser.navigate`: `+ { inputId: 'web.user.navigation_requested', kind: 'browser.navigation' }`, `- undefined`), `151` (a `client.recording_event` was sent). 2 | byte-identical `6c9bc8bd…` |
| 5 | The channel omits the tab request | `not ok 152` only (`- 'client.recording_event'`). 1 | byte-identical `4ed7e13b…` |
| 6 | `tabRequestFor` ignores the command id | `not ok 145` (`+ { operation: 'close' }`, `- undefined`), `153` (`+ 'client.recording_event'`). 2 | byte-identical `6c9bc8bd…` |

**Task 3 proof.**
- With the caller's `status` check removed, rows 133 and 151 pass.
- Mutation 4 shows that the confirmation function's guard alone keeps a failed
  action unconfirmed through the channel, and that row 151 catches its loss.
- The caller's check was therefore redundant.

### Housekeeping

- `git check-ignore -v .test-build-scratch/fcc` printed
  `.gitignore:26:apps/extension/.test-build-scratch/`.
- `rm -rf .test-build-scratch/fcc` ran, and a listing then counted 0 `fcc`
  entries.
- `git diff --stat` on my four files: 197 insertions, 16 deletions.

## Not verified

- **No live browser, no Lab run, no `pnpm build`,** as the brief requires. The
  tracked `apps/extension/build/` is not regenerated.
- **No content harness.** No content script changed.
- **Root gates.** Only the structure audit ran, plus the extension's own `check`
  and `test`.
- **The real `execute_action` path through the router is not exercised.**
  - The channel rows call `sendActionResult` directly, after `startAction`, which
    is what `handleCommand` does at `:164`.
  - A real `web.browser.tab` or `web.dom.upload` run was not driven, because
    `browser-tab.ts` and `action-runner.ts` were being edited by other workers.
- **Where a confirmation goes after the socket is not read.** I did not read
  Core or the domain's confirmation matching. The P2 report says the domain
  matches a confirmation only by `metadata.inputId`
  (`gateway-input-hub.ts:36-50`), and the rows prove that field is set.
- **A confirmation's `element` is sent as the result gives it** (P2's open
  question 3).
  - For an upload, a file input's `value` would carry the local file name if the
    content script put it there.
  - `f-frame-address` owns stopping that at the source. Its describe-element row
    (298) passed in my final run, but I did not read that file.
- **Every gate result is a single observation** on this machine, apart from the
  mutation runs, which each rebuilt and reran the suite.
- **What a Lab run must show:**
  - **W17 Flow:** the `web.dom.upload` node succeeds and is confirmed. There is
    no `output_confirmation.not_received` at stage `confirmation` for it. Its
    recording entry's payload has no `inputValue` and no file name.
  - **W15 unarmed Flow:** each `web.browser.tab` switch and close node is
    confirmed with `web.user.tab_switched` or `web.user.tab_closed`, with no
    `not_received`.
  - **W15 `popup-blocked`:** it still fails on its first click as
    `output_not_observed`.

## Open questions or contradictions found

1. **The brief says both owned files carry uncommitted P2 diffs.** Only
   `runtime-status.ts` and its test did, and they were committed in `9efd8c2`
   during this work. `server-command-channel.ts` had no diff before mine.
2. **A tab confirmation carries no `tab` field**, as the brief specifies: kind and
   input id only.
   - The domain derives a tab event's input only from `payload.tab.operation`
     (`domain/src/io/input-model.ts:229-234`).
   - So if Core maps a runtime confirmation by payload, a tab switch or close
     driven by the runtime rather than a user would never become a replayable
     node.
   - Adding `tab: { operation, urlPath }` to the confirmation would change that.
     It is the supervisor's call, and it needs the domain's
     `WebAutomationRecordedTab` on the confirmation's payload.
3. **A switch by `tabId`, without `urlPath`, still confirms `tab_switched`.** The
   tab did switch. A recorded switch node always has a path, so the confirmation
   waits only on the input id.
4. **The mutation windows touched files other workers compile.** Each lasted one
   test run. A concurrent worker's run inside a window could have seen one of my
   rows fail. A single unexplained failure in rows 131-153 from another worker
   around this time should be rerun.
5. **Structure baseline:** no entry needs to change.

## Amendment — a tab confirmation carries its tab

Brief: "## Amendment to `f-capability-confirmations` — a tab confirmation carries
its tab (extension)", `briefs/finish-week1.md`. This settles open question 2
above. I built on my uncommitted diff, which matched my last hashes before I
started. `f-tab-recording` had finished, so `tab?: WebAutomationRecordedTab` was
already on `RecordingEventPayload` (`shared/protocol.ts:399`).

### Outcome

**Done.** A succeeded tab switch or close now carries its tab in the
confirmation, in the shape a recorded tab change has:
- **A switch** carries `tab: { operation: "switch", urlPath }`. `urlPath` is the
  pathname of the tab the switch left in front, and never holds an origin, query
  or fragment.
- **A close** carries `tab: { operation: "close" }`, with no path.
- **The tab reaches the stored event.** `sendRuntimeConfirmation` passes it in, and
  the stored payload's `tab` is proved without a host, port or query.

Results:
- `pnpm check` exited 0.
- `pnpm test` passed 460 of 460.
- The structure audit passed.
- Seven mutations each failed the rows they target, and every file was restored
  byte-identical.

No domain, tab-recorder or `runtime/command-options.ts` file was touched.

### What changed and why

**`apps/extension/src/background/connection/runtime-status.ts`**
- **The return type.** The confirmation's type gains
  `tab?: RecordingEventPayload["tab"]`.
- **`tabConfirmation(tab, result)` gives each operation its tab:**
  - **A switch:** `tab: { operation: "switch", urlPath }`, where `urlPath` is the
    pathname of `result.url`. `browser-tab.ts` sets that to the URL of the tab the
    switch left in front (`switchTab`, `:214-219`). With no usable path, the tab
    is `{ operation: "switch" }`.
  - **A close:** always `tab: { operation: "close" }`, even though its result
    carries the URL of the tab it returned to (`closeTab`, `:251-256`).
- **New `frontTabPath(url)`.** It mirrors the tab recorder's rule
  (`tab-recorder.ts:49-52`) and ends with the domain's rule. A path is carried
  only when every one of these holds:
  - the URL is present;
  - the page is not unsupported (`unsupportedPageForUrl`, `./browser-state`);
  - the URL parses;
  - its origin is not opaque (`"null"`);
  - `webAutomationUrlPath(pathname)` accepts the pathname. It is imported from
    `@fluxiq-web-extension/domain/client`, as `runtime/command-options.ts` already
    imports it.

  No origin, query or fragment can reach the path.

**`apps/extension/src/background/connection/server-command-channel.ts`**
- `sendRuntimeConfirmation` passes `tab: confirmation.tab` into
  `createWebAutomationRecordingEvent`.
- That function copies only `operation` and `urlPath` onto the stored payload
  (`domain/src/client/gateway-mapping.ts:106`).

**Tests**
- **`tests/runtime-status.test.ts`:**
  - **The confirmation table's `web.browser.tab` row** now expects
    `tab: { operation: "close" }`.
  - **The tab test's rows.** The result URL is
    `https://shop.test/details?token=abc`. A switch now expects
    `{ operation: "switch", urlPath: "/details" }`, whether the command named a
    path or a tab id. A close expects `{ operation: "close" }`.
  - **New: "a switch confirmation names the tab left in front by its pathname
    alone, and a close names none".** For each URL, a switch and a close are
    checked by deep equality. A regex also proves the serialised confirmation
    holds no host, port, credentials, query, fragment or file name. The URLs:
    - one with credentials, port, query and fragment, which gives `/details/42`;
    - no URL; an unreadable one; `about:blank`;
    - a store page, `https://chromewebstore.google.com/detail/abc?hl=en`, where
      only the unsupported-page rule refuses a readable https path;
    - a `file:` page, where only the opaque-origin check refuses a readable path;
    - `https://shop.test//evil.test/x`, where only the domain's path rule refuses
      the pathname.
- **`tests/server-command-channel.test.ts`:**
  - **The succeeded upload, switch and close rows** now carry result URLs with a
    port, a query and a fragment.
  - **The stored `payload.tab`** is `{ operation: "switch", urlPath: "/details" }`
    and `{ operation: "close" }`, with no host, port or query. An upload's payload
    has no `tab` member.

### Commands run and observed results

Commands ran from `apps/extension` with `EXTENSION_TEST_BUILD_LABEL=fcc`. Output
went to scratch logs, which were then read.

| Gate | Result |
| --- | --- |
| `pnpm check` | exit 0, no `error TS` lines |
| `pnpm test` | exit 0; `Extension smoke test passed.`; `# tests 460`, `# pass 460`, `# fail 0`. The total rose from 435 because other workers added tests. Rows 137, 138, 142, 143, 152, 159 and 160 are mine, and all `ok` |

**Mutation proofs.** Script `fcc-amend-mutations.sh` in my scratchpad. Each
mutation replaced one exact, unique anchor, ran `node scripts/test-extension.mjs`,
restored the file from a byte copy and compared hashes. The baseline hashes were
`runtime-status.ts` `0d8f0635…` and `server-command-channel.ts` `9014bd9a…`.

| # | Mutation | Observed failures (`# fail`) | Restore |
| --- | --- | --- | --- |
| A1 | A switch's path keeps the query (`pathname + search`) | `not ok 142` (`+ urlPath: '/details?token=abc'`), `143` (switch, the credentials row: `+ urlPath: '/details/42?token=abc'`), `159` (`+ urlPath: '/details?token=abc'`). 3 | byte-identical `0d8f0635…` |
| A2 | A close carries the front tab's path | `not ok 142` (`+ urlPath: '/details'`), `143` (close, the credentials row: `+ urlPath: '/details/42'`), `159` (`+ urlPath: '/list'`). 3 | byte-identical `0d8f0635…` |
| A3 | The channel drops `tab: confirmation.tab` | `not ok 159` only (`+ undefined`, `- { operation: 'switch', urlPath: '/details' }`). 1 | byte-identical `9014bd9a…` |
| A4 | Remove the unsupported-page guard | `not ok 143` only (switch, a store page: `+ urlPath: '/detail/abc'`). 1 | byte-identical `0d8f0635…` |
| A5 | Remove the opaque-origin check | `not ok 143` only (switch, a file page: `+ urlPath: '/C:/Users/ada/secret.html'`). 1 | byte-identical `0d8f0635…` |
| A6 | Drop the domain's path rule (return `parsed.pathname` as is) | `not ok 143` only (switch, a pathname beginning with two slashes: `+ urlPath: '//evil.test/x'`). 1 | byte-identical `0d8f0635…` |
| A7 | A switch carries no path | `not ok 142` (`- urlPath: '/details'`), `143` (switch, the credentials row: `- urlPath: '/details/42'`), `159` (`- urlPath: '/details'`). 3 | byte-identical `0d8f0635…` |

The script's final hashes matched the baseline. A separate
`sha256sum -c fcc-amend-baseline-hashes.txt` then printed `OK` for all four files.
Each of the three path guards (A4, A5, A6) is proved by its own row alone.

**Afterwards:**
- `node scripts/structure-audit.mjs` (repo root): exit 0,
  `structure-audit: passed (39 warning(s), 17 baselined).`; no line names any of my
  four files.
- `rm -rf .test-build-scratch/fcc` ran, and a listing then counted 0 `fcc` entries.
- `git diff --stat` on my four files, the whole task: 276 insertions, 17
  deletions.

### Not verified

- **No live browser, no Lab run, no `pnpm build`, no content harness.**
- **The URL a real switch or close leaves in `result.url`.** I read it in
  `browser-tab.ts`, which I do not own. No runtime run exercised it.
- **Core's use of the stored `tab`.** I did not read Core. The domain maps a
  stored tab event by `payload.tab.operation` (`domain/src/io/input-model.ts:229-234`),
  and rows 142, 143 and 159 prove that field is on the confirmation.
- **Each gate result is a single observation.** The mutation runs each rebuilt
  and reran the suite.
- **What a Lab run must show:**
  - **W15 unarmed Flow:**
    - each replayed switch's recording entry carries
      `tab: { operation: "switch", urlPath }`, with the same path as the
      recorded switch;
    - each close's entry carries `tab: { operation: "close" }`;
    - no `tab` value holds a host, a port or a query;
    - no `output_confirmation.not_received`.

### Open questions or contradictions found

1. **The confirmation's `url` still holds the full URL.** `sendRuntimeConfirmation`
   sets `url` from `result.url`, origin and query included, for every
   confirmation, a tab one too. The brief covers only `tab`, so I left `url` as
   is. Recorded events carry `url` the same way.
2. **The path rule is now written in two extension files:**
   - `frontTabPath` in `runtime-status.ts`;
   - the address function in `tab-recorder.ts:48-55`, which I may not edit.

   Both end in the same checks, so they agree today. One exported helper would
   keep them from drifting.
3. **A switch whose command named a path takes its path from where it landed,
   not from the command.** The two match whenever `browser-tab.ts` found the tab
   by exact path. For a switch by tab id or URL pattern, the landing path is the
   only one there is.
