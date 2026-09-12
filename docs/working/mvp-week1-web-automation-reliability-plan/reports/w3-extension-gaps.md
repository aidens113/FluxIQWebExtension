# Report: w3-extension-gaps

Worker: `w3-extension-gaps`. Wave 3, added after dispatch: the two gaps other
workers found and no brief owned — a child frame that lost its content script,
and failure codes outside the closed set in the two producers nobody had.

## Outcome

**Done.** Both tasks are implemented, wired and covered, and each of the three
behaviour changes was shown to fail its test when reverted. Extension `check`
and `test` pass (161 tests, 0 failures) and the structure audit's output with my
new files staged is byte-identical to its output without them.

One thing is deliberately left for the supervisor: five rows in
`e2e/content/tests/check-assert.spec.ts` now assert the old assert codes and go
red. The file is not mine and it also carries two rows belonging to
`w3-failure-producers`, so editing it would collide. The exact replacement text
is in [Specs my change turns red](#specs-my-change-turns-red).

The brief's ownership was one file short on Task 1; I asked rather than widening
silently, and the supervisor granted `action-runner.ts` mid-task. The reasoning
is kept below because the alternatives I rejected are the interesting part.

## What changed and why

### Task 1 — a child frame that lost its content script

**`apps/extension/src/background/tabs.ts`.** `ensureContentScript` takes a
second argument, `frameId`, defaulting to the top frame. The body is otherwise
what it was: ping, and reinject when the answer is missing or carries a
superseded version. The default keeps every existing caller — `attachTabForRecording`,
`recording-evidence.ts`, `ContentAttachment.broadcast` — on exactly the path
they were on, message text included, and a test pins that message.

Why the frame has to be named rather than "ensure all frames": the existing
design note in that function is right, and it is the reason the top-frame-only
injection was written that way. A single inaccessible child — an `about:blank`
frame, or a cross-origin one the manifest does not cover — must not be able to
fail the recovery of the top-frame script that default actions depend on.
Injecting into every frame would make one unreachable iframe break every action
in the tab.

Alongside it, `unreachableFrameReason(tabId, frameId)` — the same work in
non-throwing form, returning the reason as a string a caller can put in a
failure record. It exists because of what the alternative costs: a command sent
to a frame with no listener is neither answered nor refused, `chrome.tabs.sendMessage`
resolves nothing, and the open question in this plan records that Core applies
no runtime deadline to a web action. So the failure mode being closed here is
not a bad error message, it is a command that never ends.

**`apps/extension/src/runtime/action-runner.ts`.** `runActionInFrame` now runs
two checks on a child frame before it sends anything: the existing
`absentFrameReason` (does the tab still have this frame), then
`unreachableFrameReason` (is anything in it listening). The top frame is
untouched by both, because `attachTabForRecording` has already run
`ensureContentScript` for it before the action arrives. A frame that cannot be
made ready becomes `unreachableFrameFailure`, a `TARGET_NOT_FOUND` record built
by `webAutomationFailureRecord` from the closed set — the same code, and the
same reasoning, `w3-frame-plumbing` used for a frame the tab does not have: the
frame is part of an address that resolved to nothing that can act, and it is
retryable because a frame still loading may be listening next time.

#### Probe first, not heal on failure

The supervisor asked me to weigh dispatching first and healing on a connection
error against probing first, and made the deciding test "can you cleanly tell
*the frame never received this* from *the frame ran it and failed*". I chose
**probe first**, for three reasons, the third of which I think is the strongest
and was not in the framing:

1. **It is not a new cost, it is parity.** The top frame already pays exactly
   this probe on *every* in-page action: `attachTabForRecording` →
   `ensureContentScript` → one ping. Probing a child frame gives it the same
   guarantee at the same price. The round trip the alternative saves is one the
   architecture already spends on the frame next door.
2. **Correctness would otherwise rest on a browser error string.** Healing on
   failure means matching `"Could not establish connection. Receiving end does
   not exist."` and retrying only on that. The match has to be exactly right in
   the permissive direction forever, across Chrome, Edge and Firefox, because
   the cost of a false positive is re-running an action that already ran. A
   duplicated click is unrecoverable; a ping is not.
3. **Heal-on-failure cannot see a stale script at all.** An extension *reload*
   leaves a frame silent, which a connection error reports. An extension
   *update* leaves the previous build's content script alive and answering — no
   connection error is ever raised, the action runs, and it runs against last
   build's code. Only a version check catches that, and the probe is a version
   check; `ensureContentScript` already compares `REQUIRED_CONTENT_SCRIPT_VERSION`.
   A test covers this case specifically.

### Task 2 — failure codes outside the closed set

**`apps/extension/src/runtime/action-results.ts`.** `navigationUnexpectedFailure`
emitted `web.navigate.unexpected_url`, in no set. It now returns
`webAutomationFailureRecord(WEB_AUTOMATION_FAILURE_CODES.NAVIGATION_UNEXPECTED, …)`,
so the wire code is `web.navigation.unexpected` and the category, retryable flag
and stage come from the table rather than from the call site. That moves the
stage from `verification` to `confirmation`, which is the set's judgement and
the right one: the navigation itself is what is being confirmed, not a
post-condition checked after it. Text bounding is unchanged in effect — the
domain bounds to the same Core limit — except that a description collapsing to
nothing is now dropped rather than sent as `"(none)"`, which is what Core's
parser prefers.

I did **not** convert the other five builders in that file, and the reason is in
its header now: `workerTimeoutFailure`, `workerBlockedFailure`,
`workerTargetNotFoundFailure` and `workerActionFailedFailure` take
`code: string` **from the caller**, and the callers are `action-runner.ts`,
`browser-tab.ts` and `browser-download.ts`. See
[Out-of-set codes I could not close](#out-of-set-codes-i-could-not-close).

**`apps/extension/src/content/actions/assert.ts`** (added to Owns mid-task).
`stateMismatchFailure` built `code: "web.assert.${kind}"` with
`category: "expected_state_missing"` — six invented codes and a category that is
not the right one. It now returns
`webAutomationFailureRecord(WEB_AUTOMATION_FAILURE_CODES.STATE_MISMATCH, …)`.

Three judgement calls there, since the supervisor asked for them explicitly:

- **`STATE_MISMATCH`, not `TIMEOUT`.** The vocabulary assigns "an authored
  assertion that does not hold" to `STATE_MISMATCH` and "a wait or action
  timeout" to `TIMEOUT`, and the two are not distinguishable from inside this
  file: `AssertionOutcome` is `{ held, expected, actual }` and carries no timing
  at all, so `evaluateAssertion` returns the same shape whether the claim was
  false immediately or false for the whole polling window. Nothing here depends
  on a zero timeout surviving the wire guard — I read the timeout only to reason
  about it, never to branch on it. What would make the distinction real is
  `AssertionOutcome` reporting that its wait expired, which needs
  `content/action-runtime/assertion-evaluation.ts` and `content/actions/types.ts`;
  neither is mine, and neither is any brief's. Recorded below.
- **`unexpected_state`, not `expected_state_missing`.** This is the set's
  decision, restated in `w3-failure-codes`' report: a failed authored assertion
  means the page is in a state other than the asserted one.
  `expected_state_missing` is Core's transition-comparison category and has no
  web code. The old file header claimed the opposite, so it is rewritten rather
  than patched.
- **`retryable` goes from `true` to `false`.** The set fixes it, and the set is
  right: nothing in this verb acts on the page, so retrying the same claim
  against the same page returns the same answer. The wait that gives the page
  its chance to change has already happened inside `evaluateAssertion`, which
  polls until the claim holds or the timeout passes — so by the time a record is
  built, "wait and try again" is what has already been tried.

The assertion kind is not lost with the per-kind code: `expected` names the
claim in words (`the page contains "Done"`, `#pay is enabled`), and the
command's own `assert.kind` travels with it.

### Tests

- **`apps/extension/src/background/tests/tabs.test.ts`** (new, 9 rows). A Node
  `chrome` stub with the three states a frame can be in — ready, stale (answers
  with a superseded version, which is what an extension update leaves behind),
  and silent (no listener, which is what a reload leaves behind) — and four
  outcomes for an injection. Rows: a ready top frame is left alone; a stale top
  frame is reinjected into frame 0 *and no other*; a silent child frame is
  injected into and then answers, without the top frame being touched; a stale
  child frame is reinjected, **which no connection error would ever report**;
  the top frame's failure message is unchanged; and four rows on what
  `unreachableFrameReason` says for a frame that recovers, a frame the manifest
  may not inject into, a frame that stays silent after injection, and a frame
  that comes back with the wrong version.
- **`apps/extension/src/runtime/tests/action-runner.test.ts`** (2 new rows, and
  the stub extended). The stub now answers `fluxiq.ping`, offers
  `chrome.scripting.executeScript`, and records pings and injections **apart
  from** action sends, so every existing row's assertions about where an action
  was delivered stand unchanged. New rows: a command addressed to a child frame
  that lost its script reaches it once it is injected (injection targets frame
  3, then one `executeAction` to frame 3); and a child frame that cannot be
  given a script fails `TARGET_NOT_FOUND` with **nothing sent**, the whole
  record asserted and round-tripped through Core's parser.
- **`apps/extension/src/runtime/tests/action-results.test.ts`** (2 new rows).
  The whole navigation record asserted field by field — including the stage move
  to `confirmation` — plus `isWebAutomationFailureCode` on the code, and a
  bounding row.
- **`apps/extension/src/content/actions/tests/assert.test.ts`** (new, 4 rows).
  The verb runs in Node because every page capability is injected; the two the
  assert path uses are supplied and the rest are a Proxy that throws, so a
  change that starts reaching for the page fails here. Rows: a claim that holds
  carries no failure; a claim that does not carries the whole `STATE_MISMATCH`
  record, parser round-trip included; the code no longer varies across all six
  kinds; and a malformed request routes through `deps.failure`, which already
  classifies, rather than inventing a record here.

## Commands run and observed results

`EXTENSION_TEST_BUILD_LABEL=w3-extension-gaps` was set for every package
command. Exit status was captured by redirecting to a file and echoing `$?`,
never through a pipe. No `pnpm build` and no `pnpm lab` command was run.

- `pnpm --filter @fluxiq-web-extension/extension check` → **exit 0**, no
  diagnostics. Run four times across the work; the final run is exit 0.
- `pnpm --filter @fluxiq-web-extension/extension test` → **exit 0**.
  `# tests 161 / # suites 0 / # pass 161 / # fail 0`. My rows are `ok 55`–`ok 63`
  (tabs), `ok 80`–`ok 83` (assert), `ok 103`–`ok 104` (action-results) and
  `ok 114`–`ok 115` (action-runner) in that run.
- **Mutation check, three separate reverts, each rerun and then restored.**
  Without them the tests would prove only that the code does not crash.
  - The `unreachableFrameReason` block removed from `runActionInFrame` →
    **exit 1**, exactly `not ok 114` and `not ok 115`, and nothing else.
  - `stateMismatchFailure` in `assert.ts` returned to the hand-built
    `expected_state_missing` / `web.assert.text` record → **exit 1**,
    `not ok 81` and `not ok 82`.
  - `navigationUnexpectedFailure` returned to the hand-built
    `web.navigate.unexpected_url` record → **exit 1**, `not ok 103`.
  - All three restored, full run rerun → **exit 0**, 161/161.
- `pnpm --filter @fluxiq-web-extension/extension test:content check-assert.spec.ts`
  → **exit 1**, `5 passed / 7 failed`. Five of the seven are mine and expected;
  see the next section. The other two (`check: unchecking a radio …`, `check: a
  disabled control …`) fail on `web.action.not_checkable` and
  `web.action.disabled`, which is `w3-failure-producers`' `ACTION_REJECTED`
  collapse and was already red before I started.
- `node scripts/structure-audit.mjs` with a scratch `GIT_INDEX_FILE` (a copy of
  `.git/index` under the session scratchpad, with my two new test files added;
  the real index was never written, confirmed with `git diff --cached
  --name-only`) → **exit 1**. An identical run against the **unmodified** index
  produced **byte-identical output** — `diff` of the two reports no difference at
  all — so my change adds no finding and grows no warning. The two violations it
  reports are other people's and pre-existing:
  `FAIL [imports] apps/extension/src/runtime/tests/result-mapping.test.ts …
  "../../content/evidence"` (`w3-evidence`) and
  `FAIL [working-docs] docs/working/README.md is out of date` (the supervisor's).
  `pnpm structure:baseline` was not run.
- `apps/extension/src/background/tabs.ts` now has 7 exported values, under the
  8-value advisory threshold; `content/actions/` still counts 18 source files,
  unchanged, because the new test lives in the existing `tests/` subfolder.

## Not verified

- **No live browser validation of any of this.** The Node stub proves which
  frame `chrome.scripting.executeScript` is told to inject into and which frame
  the action is then sent to. It does not prove Chrome injects where it is told,
  and it cannot: the content harness runs content code only, with no background
  worker and no frame routing. What is untested end to end is the actual
  scenario the fix exists for — reload the unpacked extension, leave a page of
  iframes open, and dispatch an action at a child frame. That needs a T3 Lab
  run, which the serialization rule keeps out of a parallel worker's hands.
- **The stale-child-frame path has never met a real extension update.** That an
  updated extension leaves the previous content script alive and answering in a
  child frame is read off the injection model, not observed here.
- **Firefox.** `browser.scripting.executeScript` takes the same
  `target.frameIds`, but no Firefox build was loaded.
- **The probe's cost was reasoned, not measured.** I argue it is the same ping
  the top frame already pays on every action; I did not time it.
- **`pnpm check`, `pnpm test`, `pnpm build` at the repository root** were not
  run. Nine other workers are editing this tree and `build` is forbidden to
  workers.
- **The two `check:` rows in `check-assert.spec.ts` were attributed by reading
  the failure messages**, not by reverting `w3-failure-producers`' change.

## Open questions or contradictions found

### Specs my change turns red

`apps/extension/e2e/content/tests/check-assert.spec.ts` has five rows asserting
the assert codes I replaced. I did not edit it: it is not under my Owns, "tests
beside each" in this repository means the owning directory's `tests/` subfolder,
and the same file carries two rows that belong to `w3-failure-producers`, so two
workers editing it would collide. The change is mechanical — each of lines 122,
140, 152, 172 and 185 becomes the same record:

```ts
failure: { category: "unexpected_state", code: "web.validation.state_mismatch", retryable: false, stage: "verification" }
```

Note `retryable` flips to `false` on lines 122 and 140, which spell it out; 152,
172 and 185 assert only `category` and `code`. Line 143's
`expect(wrong.failure?.category).not.toBe("output_not_observed")` still holds and
needs nothing. The file's header comment also says STATE_MISMATCH is
`expected_state_missing`, which is now wrong in the same way `assert.ts`'s was.

Lines 84, 93 and 104 in the same file are the `check:` rows and are
`w3-failure-producers`' to fix.

### Out-of-set codes I could not close

`action-results.ts` is a chokepoint that does not own its codes. Five builders
take `code: string` from the caller, and three callers pass strings in no set:

| Caller | Code passed | Builder |
| --- | --- | --- |
| `runtime/action-runner.ts` | `web.page.unsupported` | `workerBlockedFailure` |
| `runtime/browser-tab.ts` | `web.tab.invalid_request`, `web.tab.no_target` | `workerBlockedFailure` |
| `runtime/browser-tab.ts` | `web.tab.failed`, `web.tab.no_id`, `web.tab.not_closed` | `workerActionFailedFailure` |
| `runtime/browser-tab.ts` | `web.tab.no_match` | `workerTargetNotFoundFailure` |
| `runtime/browser-download.ts` | `web.download.permission_missing` | `workerBlockedFailure` |
| `runtime/browser-download.ts` | `web.download.timeout` | `workerTimeoutFailure` |

Nine codes, eight of them outside the set (`web.action.failed`, also passed by
`action-runner.ts`, is in it). I own two of the three callers' files but not
`browser-tab.ts` or `browser-download.ts`, and the supervisor's grant of
`action-runner.ts` was for the frame-unreachable path only, so I changed none of
them. **The fix is one change across four files**: narrow the builders'
parameter from `string` to `WebAutomationFailureCode`, which turns every
remaining call site into a compile error until it is converted. Doing it in
`action-results.ts` alone would break the build.

Two of the nine need a decision rather than a rename, which is why this should
not be handed out as a mechanical brief:

- **`web.page.unsupported` has no member in the set.** The page cannot be
  automated at all — a `chrome://` URL, an extension page. `ACTION_REJECTED` is
  the nearest category but the set fixes it at stage `execution`, and this is
  decided before anything runs; `UNSUPPORTED_TYPE` is stage `dispatch` but names
  the action type, not the page. `w3-frame-plumbing` hit the same wall and left
  it for the same reason. Either the set gains a code for "this page is not
  automatable at dispatch", or one of the two existing members is stretched and
  the stretch documented.
- **`web.tab.*` are browser-level, not page-level.** `web.browser.tab` acts on
  the browser, not on a document, and the set was written for the page path.
  `web.tab.no_match` → `TARGET_NOT_FOUND` and `web.tab.failed` → `ACTION_FAILED`
  are clean; `web.tab.invalid_request` is a malformed request with no member at
  all.

### The assert verb cannot report a timeout, and nobody owns the seam

`TIMEOUT` is unreachable from `web.dom.assert` today. `evaluateAssertion` polls
until the claim holds or the timeout passes and returns
`{ held, expected, actual }` either way, so a claim that was false for the whole
window is indistinguishable from one that was false immediately. Making the
distinction real needs `AssertionOutcome` to carry it
(`content/action-runtime/assertion-evaluation.ts`) and the dependency type to
pass it (`content/actions/types.ts`), neither of which any Wave 3 brief names.
It also needs the result's status to become `timed_out` rather than `failed`,
which is `content/action-runtime/validation-outcome.ts` — `w3-failure-producers`'
neighbourhood. Until then the vocabulary line "a wait or action timeout is
status `timed_out` with `TIMEOUT`" is satisfied by the wait verbs and not by
`assert`.

Related and already known to the supervisor: `assert.timeoutMs: 0` is dropped by
the wire's positive-integer guard and silently becomes the 5 s default. My
change does not depend on a zero timeout surviving, as instructed.

### The brief's ownership defect, and what it was worth

Task 1 could not be wired from the two files the brief gave me. The capability
belonged in `tabs.ts`, but the only frame-addressed dispatch path in the
extension is `runActionInFrame`, and the only `tabs.ts` functions it already
calls are `sendToTab` and `allTabFrames`. I reported it instead of shipping the
capability inert, and named the two workarounds I would not take:

- **Widening `ensureContentScript` to all frames** wires itself with no caller
  change, and contradicts that function's own design note — one inaccessible
  child would fail every action in the tab.
- **Self-healing inside `sendToTab`** also wires itself with no caller change,
  and would fire on `connection/dom-snapshot.ts` and `connection.ts:337` too,
  injecting content scripts into arbitrary frames during snapshot capture. That
  is a product change on files I do not own, smuggled in as a bug fix.

The supervisor granted `action-runner.ts` and verified the analysis first. Worth
recording because the brief's own binding rules predict this exact shape —
ownership drawn around a file rather than around the change — and because both
workarounds *look* like they respect the boundary while being worse than
crossing it.

### Smaller things

- **`REQUIRED_CONTENT_SCRIPT_VERSION` is written out in two tests.** It is
  private to `tabs.ts` and equals `CONTENT_SCRIPT_VERSION` in
  `content/instance.ts`, which assigns to `window` as it loads and so cannot be
  imported by a Node test. Exporting it from `tabs.ts` would take that module to
  8 exported values, exactly the advisory threshold, so I left it written out
  with a comment at each site.
- **The unreachable-frame failure could arguably be `ACTION_REJECTED`** when
  injection is refused for a missing host permission, rather than
  `TARGET_NOT_FOUND`. Telling the two apart means matching on a browser error
  string, and both call for the same thing from a Flow, so I kept one code and
  said so in the source.
- **`docs/architecture/` says nothing about frame-addressed actions.**
  `w3-frame-plumbing` noted the same for shadow DOM. What is now true and
  undocumented: an action addressed to a child frame is delivered to that frame
  only, the frame is checked for existence and for a live content script before
  anything is sent, and both failures are `TARGET_NOT_FOUND`. I own no document
  there.
