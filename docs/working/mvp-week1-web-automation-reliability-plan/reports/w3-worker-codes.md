# Report: w3-worker-codes

Worker: `w3-worker-codes`. Wave 3, added after dispatch: the last out-of-set
failure codes on the extension's worker side — the four builders in
`runtime/action-results.ts` that took `code: string`, and the nine strings three
callers handed them.

## Outcome

**Done**, with one deliberate departure from the brief's mapping table, argued
below and easy to reverse if the supervisor still disagrees. All nine call sites
are on set members, the `code` parameter is `WebAutomationFailureCode`, and an
out-of-set string is now a compile error — shown, not assumed. Extension `check`
and `test` pass (189 tests, 0 failures), thirteen of them new or rewritten, and
the structure audit's output is byte-identical with and without my change.

**The departure:** the brief maps `workerActionFailedFailure` → `UNKNOWN`. I
mapped it to **`ACTION_FAILED`**. The reasoning, and the one-line reversal, are
in [The one mapping I did not take](#the-one-mapping-i-did-not-take). Nothing
else in the brief's table was changed.

## What changed and why

### `action-results.ts` — the parameter that let this drift

The four builders now take `code: WebAutomationFailureCode` and delegate their
whole body to `webAutomationFailureRecord`. That second half is not decoration:
if a builder kept assembling the record by hand while the caller named a set
member, the record could disagree with the code's row in the table — precisely
the drift the set exists to stop, and invisible until Core's parser dropped the
record whole. `workerBlockedFailure` would have been the live case: it wrote
stage `dispatch`, and `ACTION_REJECTED`'s row says `execution`.

What the builders still contribute is their names and the shape of what a call
site must say: a timeout, a target and a failed action each require an
`expected` and an `actual`, while a refusal may state neither. They no longer
constrain the category — `workerTimeoutFailure(ACTION_REJECTED, …)` compiles —
which is a residual looseness recorded under [Open
questions](#open-questions-or-contradictions-found).

The file header's paragraph describing the defect is replaced by one describing
the rule. `boundedText` stays, now used only by `boundWorkerValidation`: a
validation's text is still bounded here, because the domain bounds only the
record.

### The nine call sites

| File and line | Was | Now | Record change |
| --- | --- | --- | --- |
| `action-runner.ts:159` | `web.page.unsupported` | `ACTION_REJECTED` | stage `dispatch` → `execution` |
| `browser-download.ts:46` | `web.download.permission_missing` | `ACTION_REJECTED` | stage `dispatch` → `execution` |
| `browser-download.ts:57` | `web.download.timeout` | `TIMEOUT` | code only |
| `browser-tab.ts:48` | `web.tab.invalid_request` | `ACTION_REJECTED` | stage `dispatch` → `execution` |
| `browser-tab.ts:62` | `web.tab.failed` | `ACTION_FAILED` | code only |
| `browser-tab.ts:93` | `web.tab.no_id` | `ACTION_FAILED` | code only |
| `browser-tab.ts:134` | `web.tab.no_match` | `TARGET_NOT_FOUND` | code only |
| `browser-tab.ts:156` | `web.tab.no_target` | `ACTION_REJECTED` | stage `dispatch` → `execution` |
| `browser-tab.ts:169` | `web.tab.not_closed` | `ACTION_FAILED` | code only |

Every `expected` and `actual` is preserved verbatim; no status changed; no
`category` and no `retryable` changed. The only field that moves anywhere is the
stage on the four refusals, and it moves because the set binds one stage to one
code. `dispatch` was the more literal answer at all four — each decides before
anything runs — but stretching a member is what reusing a closed set costs, and
the two in-set members that do carry stage `dispatch`, `UNSUPPORTED_TYPE` and
`NOT_IMPLEMENTED`, both name an *action type* the client will not run, which
none of these four is. `action-results.ts` and `action-runner.ts` say this in
their source, so the next reader does not re-derive it.

`action-runner.ts` got one changed line and one doc comment above the function
that owns it. `w3-extension-gaps`' frame-reachability work is untouched, and so
is line 86's `workerActionFailedFailure("web.action.failed", …)` — already in
the set, so it still compiles, though it is now the only site in these four
files that writes a code as a bare string instead of reading the constant.

## The two judgement calls the brief asked me to make

### `web.tab.no_match` → `TARGET_NOT_FOUND`: the supervisor is right

The concern was that the code's stage, `target_resolution`, was written with DOM
elements in mind. Three things settled it for me, and none is the vocabulary
table:

1. **The record does not change at all.** The hand-built record was already
   `target_not_found` / retryable / `target_resolution`. Only the code string
   moves. So the question is not "does this stage fit" — the extension has been
   reporting that stage for a missing tab since Wave 2 — it is only "is the code
   nameable", and `web.tab.no_match` was not.
2. **The extension already resolves non-elements at that stage.**
   `action-runner.ts` reports both a frame the tab does not have and a frame
   with no content script as `TARGET_NOT_FOUND`, on `w3-extension-gaps`' and
   `w3-frame-plumbing`' shared reasoning: the frame is part of an address that
   resolved to nothing that can act. A tab is the same kind of address, one
   level further out.
3. **`UNKNOWN` would be a lie here.** The module knows exactly what happened and
   says so: `expected: 'tab 11 active'`, `actual: 'no open tab matched'`.
   `UNKNOWN` means the producer could not determine a cause.

Retryable stays `true`, which is right for a tab as well as an element: a tab
the Flow is waiting on may open.

### Telling the collapsed codes apart from `expected` and `actual`

The brief asked me to check that a reader can distinguish the sites that now
share a code. Six codes collapse to two members, so the pairs are the whole
diagnostic. They are, verbatim from the source:

**`ACTION_REJECTED` (four sites, was four codes):**

| Was | `expected` | `actual` |
| --- | --- | --- |
| `web.page.unsupported` | `a page the extension can automate` | the guard's reason, e.g. `Browser and extension pages cannot be automated.` |
| `web.download.permission_missing` | `a completed download[ named X]` | `the downloads permission is not granted` |
| `web.tab.invalid_request` | `operation open, switch, or close` | `no operation` |
| `web.tab.no_target` | `a tab to close` | `no tab named and none open` |

**`ACTION_FAILED` (three sites, was three codes):**

| Was | `expected` | `actual` |
| --- | --- | --- |
| `web.tab.failed` | `tab open\|switch\|close to succeed` | the browser's own message, e.g. `No tab with id 11.` |
| `web.tab.no_id` | `a new tab` | `a tab with no id` |
| `web.tab.not_closed` | `tab 11 closed` | `tab 11 is still open` |

Every pair names its own situation in words, and no two are confusable, so I
added nothing — the brief's instruction was to add only where a reason would
otherwise be lost, and none is. The `web.tab.failed` row is the strongest of the
seven, because it carries the browser's own sentence; `web.tab.no_id` is the
weakest, and it is still unmistakable, since only opening a tab can produce it.
Each pair is asserted in a test, so a later edit that flattens one of them into
a generic string fails rather than quietly making the collapse lossy.

## The one mapping I did not take

The brief maps `workerActionFailedFailure` → `UNKNOWN`, glossed as "the set's
member for 'the action ran and failed for a reason no other code names'". That
sentence is, word for word, the doc comment on **`ACTION_FAILED`** in
`domain/src/runtime/failure/codes.ts:50`. `UNKNOWN`'s doc comment on line 52 is
"Nothing said why the action failed." I read that as the brief naming the right
description and the wrong member, so I took `ACTION_FAILED`, for four reasons:

1. **The set was built to prevent exactly this substitution.**
   `reports/w3-failure-codes.md` explains why `ACTION_FAILED` exists at all:
   "`web.action.failed` gives Core's `action_failed` category a code. It is the
   honest answer for an action that ran, failed, and said why in words, which
   `UNKNOWN` ('the producer could not determine a cause') would misreport."
2. **All three sites say why in words** — the three `actual` values in the table
   above. None of them is a producer that could not determine a cause.
3. **`UNKNOWN` is not a vocabulary change.** `ACTION_FAILED` reproduces the
   hand-built record exactly: `action_failed`, retryable `true`, stage
   `execution`. `UNKNOWN` changes the category to `ambiguous_or_unknown` and
   retryable to `false`, both of which Core acts on — it would be a behaviour
   change on the retry path, which the brief's own rule forbids.
4. **`w3-extension-gaps`, whose work the brief told me to match, said the same**:
   "`web.tab.no_match` → `TARGET_NOT_FOUND` and `web.tab.failed` →
   `ACTION_FAILED` are clean."

I proved point 3 rather than asserting it. Mapping the three sites to `UNKNOWN`
and running the suite fails exactly three rows, with this diff:

```text
+   category: 'ambiguous_or_unknown',   +   code: 'web.action.unknown',
-   category: 'action_failed',          -   code: 'web.action.failed',
+   retryable: false,
-   retryable: true,
```

**If the supervisor still wants `UNKNOWN`**, it is `WEB_AUTOMATION_FAILURE_CODES.ACTION_FAILED`
→ `.UNKNOWN` at `browser-tab.ts` lines 71, 102 and 179, and the same three
expectations in `tests/browser-tab.test.ts`. Nothing else depends on the choice.

## Tests

Thirteen rows, `ok 117`–`ok 120`, `ok 133`, `ok 142`–`ok 143` and `ok 148`–`ok 153`
in the run below. Every one asserts a whole failure record and round-trips it
through Core's `parseAutomationStudioFailureRecord`, because Core drops a record
it refuses rather than repairing it — a category paired with the wrong stage
would lose the failure entirely rather than misreport it.

- **`tests/action-results.test.ts`** — three new rows and two updated. The new
  ones: every builder's code passes `isWebAutomationFailureCode` and all nine
  retired strings fail it; each builder's whole record equals the code's row in
  the table, with the stage move on the refusal spelled out; and a refusal with
  nothing to compare carries no empty text, since text bounding moved to the
  domain and an empty description is now dropped rather than sent as `"(none)"`.
- **`tests/browser-tab.test.ts`** — six new rows, one per remapped call site,
  driven through `runBrowserTabAction` against a four-method `chrome.tabs` stub.
  The file previously covered only `selectTabForSwitch`, because the operations
  need `chrome.tabs`; the stub is small enough that each failing path is one
  line of arrangement. The two rows that share `ACTION_REJECTED` and the three
  that share `ACTION_FAILED` each assert their own `expected`/`actual`, which is
  what makes the collapse readable.
- **`tests/browser-download.test.ts`** — two new rows: no `chrome.downloads` at
  all is the refusal, and a present-but-empty `chrome.downloads` is the timeout.
  The timeout row costs one second of wall clock, because `clampTimeout` floors
  a request at `MIN_DOWNLOAD_TIMEOUT_MS`; it asserts `status: "timed_out"` is
  unchanged, which is the "vocabulary, not behaviour" rule made checkable.
- **`tests/action-runner.test.ts`** — one new row, reusing the existing
  `installChromeStub` and passing `unsupportedPageReason` on the request rather
  than restructuring the shared helper, since `w3-frame-plumbing` also owns this
  file. It asserts the whole record and that nothing was sent to the tab.

## Commands run and observed results

`EXTENSION_TEST_BUILD_LABEL=w3-worker-codes` was set for every package command.
Exit status was captured by redirecting to a file and echoing `$?`, never
through a pipe. No `pnpm build`, no `pnpm lab`, no domain or test-runner
command: I own no file in either.

- `pnpm --filter @fluxiq-web-extension/extension check` → **exit 0**, no
  diagnostics.
- `pnpm --filter @fluxiq-web-extension/extension test` → **exit 0**.
  `# tests 189 / # suites 0 / # pass 189 / # fail 0 / # cancelled 0 /
  # skipped 0 / # todo 0`.
- **The compile proof the brief asked for.** `browser-tab.ts:134` reverted to
  the string `"web.tab.no_match"`, everything else left alone,
  `pnpm --filter @fluxiq-web-extension/extension check` → **exit 2**, and the
  compiler said exactly:

  ```text
  src/runtime/browser-tab.ts(143,44): error TS2345: Argument of type
  '"web.tab.no_match"' is not assignable to parameter of type
  'WebAutomationFailureCode'.
  ```

  One error, at the call site, naming the offending string and the closed type.
  That is the property the brief wanted: the set is now enforced by the build
  rather than by a convention a call site can forget. Restored, and the restored
  line re-read.
- **Behaviour mutation**, described above: the three `ACTION_FAILED` sites
  changed to `UNKNOWN` → **exit 1**, `# pass 186 / # fail 3`, exactly
  `not ok 149`, `not ok 150`, `not ok 153` and nothing else. Restored, full
  suite rerun → **exit 0**, 189/189.
- `node scripts/structure-audit.mjs` with a scratch `GIT_INDEX_FILE` (a copy of
  `.git/index` under the session scratchpad, with this report added; the real
  index was never written, confirmed with `git diff --cached --name-only`, which
  still shows only another worker's two staged `domain/src/recording` files) →
  **exit 1**, `structure-audit: 3 violation(s) across 2 rule(s)`, 27 warnings.
  An identical run against the **unmodified** index produced **byte-identical
  output** — `diff` of the two reports no difference at all — so my change adds
  no finding and grows no warning. No finding names any of the eight files I
  touched. The three violations are other workers' and pre-existing:
  `FAIL [imports] apps/extension/src/runtime/tests/result-mapping.test.ts …
  "../../content/evidence"` and `FAIL [imports] apps/extension/src/shared/protocol.ts
  … "../content/evidence"` (both `w3-evidence`), and
  `FAIL [working-docs] docs/working/README.md is out of date` (the supervisor's).
- File sizes after the change, all far under the 400-line advisory:
  `action-results.ts` 154, `browser-tab.ts` 186, `browser-download.ts` 170,
  `action-runner.ts` 306; the four test files 219, 162, 141 and 352. No file was
  added, so `apps/extension/src/runtime/` and its `tests/` are unchanged at 12
  and 8 files. No export was added or removed. `pnpm structure:baseline` was not
  run.

## Not verified

- **No live browser validation, and none of these paths has ever run in one.**
  Every failure here is stubbed: a `chrome.tabs.create` that rejects, a
  `chrome.downloads` that is absent, a `webNavigation` that enumerates frames.
  What is proven is that when the browser behaves that way the record is
  nameable and survives Core's parser. What is not proven is that the browser
  behaves that way — in particular, `web.browser.tab` close and
  `web.browser.download` are recorded in
  `docs/architecture/web-capabilities.md` as never exercised in a browser, and
  this change does not alter that.
- **The stage move to `execution` on four refusals is not validated downstream.**
  I checked that no e2e spec and no test-runner fixture asserts a stage for any
  of these nine codes (grep over `apps/extension/e2e`,
  `packages/test-runner/src`, `apps/scenario-lab/src`: the only `dispatch`
  assertion is `run-manifest/tests/automation-failure.test.ts`, on
  `web.action.unsupported_type`, whose row I did not touch). What I could not
  check is whether Core or a Flow author reads the stage for anything; the
  category and retryable flag, which Core's retry path does read, are unchanged
  at all nine sites.
- **`pnpm check`, `pnpm test`, `pnpm build` at the repository root** were not
  run: other workers are editing this tree and `build` is forbidden to workers.
- **`test:content` was not run.** I touched no content code, and no content spec
  references these codes.
- **The download timeout row is a real one-second wait**, not a fake timer. If
  the suite's duration becomes a concern, `MIN_DOWNLOAD_TIMEOUT_MS` is what sets
  the floor.

## Open questions or contradictions found

### The brief's `UNKNOWN` mapping contradicts the set's own documentation

Recorded above in full. The supervisor should confirm `ACTION_FAILED` or tell me
to flip it; it is three lines plus three expectations either way. I raise it as
a contradiction rather than a preference because the brief's gloss on `UNKNOWN`
is `ACTION_FAILED`'s docstring verbatim, so the two readings cannot both be
what was meant.

### `docs/architecture/web-capabilities.md` now names a code that no longer exists

Line 124 documents the close operation as refusing with `web.tab.no_target`.
That string is gone. The sentence should become something like "refused as
`web.action.rejected`, with `a tab to close` / `no tab named and none open`".
I own no file under `docs/architecture/`, so I did not edit it. It is the only
authored document that names one of the nine; the rest of the hits are Wave 2
and Wave 3 reports, which are records of what was true when written.

### The builders no longer constrain their category

`workerTimeoutFailure`, `workerBlockedFailure`, `workerTargetNotFoundFailure`
and `workerActionFailedFailure` are now one-line pass-throughs to
`webAutomationFailureRecord`, differing only in whether `expected`/`actual` are
required. Two consequences worth a decision, neither of which I took, since the
brief's definition of done pins the `code` parameter's existence:

- Nothing stops `workerTimeoutFailure(ACTION_REJECTED, …)` compiling. The
  builder's name would then be wrong and its record right. Narrowing each
  parameter to the subset of codes carrying its category would close that, but
  `WEB_AUTOMATION_FAILURE_CODE_DEFINITIONS` is typed
  `Readonly<Record<WebAutomationFailureCode, …>>`, so the per-key category is
  widened to the union and the subset cannot be derived from the table — it
  would have to be written out by hand, which is a second place the binding
  lives.
- Or the four could simply be retired, with the call sites calling
  `webAutomationFailureRecord` directly, which is what `action-runner.ts`
  already does for its two frame failures and what `navigationUnexpectedFailure`
  does. I did not, because it would force a change to `action-runner.ts:86`,
  which the brief told me to leave alone.

### `action-runner.ts:86` still writes its code as a bare string

`workerActionFailedFailure("web.action.failed", expected, message)`. It compiles
because the string is in the set, and it is now the only place in these four
files that does not read the constant. One line, and outside the brief's "change
only line 159".

### The three-worker overlap on `action-runner.ts` held, but by hand

`w3-extension-gaps`, `w3-frame-plumbing` and this brief all list
`apps/extension/src/runtime/action-runner.ts` under Owns. It worked here only
because my change was one line and I was told which one. The general shape —
three briefs owning one file with no stated partition inside it — is the kind of
thing the wave's binding rules warn about, and it is worth the supervisor
knowing it was survived rather than designed.
