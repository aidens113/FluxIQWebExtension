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
