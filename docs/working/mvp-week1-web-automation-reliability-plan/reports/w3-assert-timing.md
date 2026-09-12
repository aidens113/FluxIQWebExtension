# Report: w3-assert-timing

Worker: `w3-assert-timing`. Wave 3, added after dispatch: the two defects more
than one worker found and no brief owned — `web.dom.assert` unable to report a
timeout, with three spec rows that would pass with its wait deleted; and
`rejectionFailure`, the last door out of the closed code set.

## Outcome

**Done.** Both tasks are implemented and both mutation proofs were run, not
reasoned about. Extension `check` and `test` pass (197 tests, 0 failures), the
whole content harness passes (181 passed, exit 0), and the structure audit
passes with no finding naming any file I touched.

The three unfalsifiable rows are falsifiable: with the polling loop deleted,
`check-assert.spec.ts` goes **8 failed / 6 passed**, and all three are among the
eight. Restored, it is 14/14. The observed diffs are quoted below.

Two things the supervisor should know before reading further:

- **The brief named a file that does not exist.** Owns lists
  `content/action-runtime/assert-conditions.ts` "if one exists". It does not;
  the module holding `AssertionOutcome` is
  `content/action-runtime/assertion-evaluation.ts`, which is what both cited
  reports name and what I edited. No file called `assert-conditions.ts` was
  created.
- **Task 2's compile proof came out half-positive, and the negative half is the
  more useful finding.** An out-of-set string at the code site that remains is
  `error TS2345`, quoted below. But a *reintroduced hand-built record* still
  compiles, because the protocol type's `code` is `string`. Deletion, not the
  type system, is what shut that door, so I added a test that pins the module's
  exported surface and proved it fails when the door is reopened. Details in
  [Task 2](#task-2--the-last-door-out-of-the-closed-set).

**The supervisor committed my files mid-task** (`ee25ac9`, "Wave 3: element
identity, page evidence, and the closed failure vocabulary"). I did not commit
and did not stage anything into the real index; `git diff --cached --name-only`
is empty. What is in that commit is my final restored state — the working tree
is clean against it and every gate above was run after the mutations were
reverted — but the commit was made while I was still working, so it captured the
work rather than my finishing it.

## Task 1 — the assert verb can now report a timeout

### What "never held within the timeout" means, per kind

This is the decision the brief asked me to make deliberately, so the reasoning
comes before the code.

Every failing assertion is polled to its deadline. `evaluateAssertion` retries
until the claim holds or the window closes, so **"the window expired" is true of
every failed assertion with a non-zero timeout** and cannot be the test on its
own — if it were, `STATE_MISMATCH` would become unreachable from this verb, and
the vocabulary's own line ("an authored assertion that does not hold is
`STATE_MISMATCH`") would name nothing.

What separates them is **what the page let the evaluator see**:

- **`STATE_MISMATCH`** — the claim's substance was read and the page disagrees.
  `expected` and `actual` name both sides. This is a definite state the page is
  in.
- **`TIMEOUT`** — the subject of the claim never appeared, so the claim was
  never judged at all. All that was observed is that the page had not got there
  when the window closed.

Two conditions are therefore required for `timed_out`: the window expired
**and** the last attempt did not judge the claim. Each attempt now returns a
verdict — `judged`, `pending`, or `malformed` — decided where the page is read
rather than inferred later from the wording of `actual`.

| Kind | Fails by | Verdict when it fails | Code |
| --- | --- | --- | --- |
| `exists` | nothing matched | `pending` | **TIMEOUT** |
| `text` | nothing matched | `pending` | **TIMEOUT** |
| `text` | element read, text differs | `judged` | STATE_MISMATCH |
| `visible` | nothing matched | `pending` | **TIMEOUT** |
| `visible` | element present, not visible | `judged` | STATE_MISMATCH |
| `enabled` | nothing matched | `pending` | **TIMEOUT** |
| `enabled` | element present, disabled | `judged` | STATE_MISMATCH |
| `url` | the address differs | `judged` | STATE_MISMATCH (always) |
| `absent` | the element is still there | `judged` | STATE_MISMATCH (always) |

**`url` is never a timeout** because a document always has an address to
compare: the claim is judgeable from the first attempt, whatever the page is
doing. A navigation still in flight does not change that — what was observed is
a real address that is not the asserted one.

**`absent` is the asymmetric one, and it is not the mirror of `exists`.** It
*holds* when nothing matches, so it has no `pending` state at all: it cannot
fail by waiting in vain, only by seeing the element it was told would go. That
is a positive observation, so its failure is always `STATE_MISMATCH`, however
long it waited to make it. `exists` is the opposite in the same way: it can only
fail by *not* seeing something, so its failure is always a timeout. A spec row
now pins each, side by side, so a later edit cannot quietly make them symmetric.

The alternative I rejected: treating an expired `absent` as TIMEOUT on the
grounds that "an element may still detach". True, but the same is true of every
kind — text updates, buttons enable, pages navigate — so that reading collapses
everything into TIMEOUT and throws away the distinction the pair exists to make.

Two more decisions worth recording:

- **A claim given no window is never a timeout.** `timeoutMs: 0` is a single
  immediate check, and reporting it as having run out of time would blame the
  page for a claim the Flow gave no time to come true. (Through the wire this is
  currently unreachable: the positive-integer guard drops `0` and the default of
  5 s applies. The rule is still written, because `evaluateAssertion` honours a
  zero passed directly.)
- **A malformed claim now stops at once instead of burning the window.** `exists`
  with no selector and no element, and `url` naming no URL, are requests no page
  can satisfy. They used to poll for the full five seconds to reach the same
  answer; they now short-circuit, and they report `failed`/`STATE_MISMATCH`
  rather than a timeout, because nothing timed out — the request named no claim.

The one edge I did not special-case: an element that is present with the wrong
text at first and detaches before the deadline reports TIMEOUT, because the
verdict is the **last** attempt's. That is the most defensible reading (at the
end, the thing was not there), but it is a judgement, not a proof.

### What changed

**`content/action-runtime/assertion-evaluation.ts`.** `AssertionOutcome` was
`{ held, expected, actual }`. It now also carries `judged`, `waitExpired`,
`timeoutMs`, `elapsedMs` and `attempts`. Internally each attempt returns an
`AssertionAttempt` with the `AssertionVerdict` above; the loop stops early on
`malformed`; and `waitExpired` is `!held && verdict !== "malformed" &&
timeoutMs > 0 && Date.now() >= deadline` — the deadline comparison is what makes
the loop's absence visible rather than merely slow.

**`content/actions/assert.ts`.** A new `assertionTimedOut(outcome)` — the whole
rule, with the reasoning above in its doc comment — routes an expired, unjudged
claim to `deps.timedOut` (`results.ts`'s `actionTimedOut`: status `timed_out`,
never flattened to `failed`, `TIMEOUT` from the same closed set) with the message
`Assertion did not hold within <n> ms: <kind>.` Everything else is unchanged:
`deps.success` and the existing `stateMismatchFailure` still handle a claim that
was judged and found false.

I deliberately did **not** move `stateMismatchFailure` into `results.ts`'s hands,
even though `results.ts` already maps `web.dom.assert` to `STATE_MISMATCH` and
the verb's override is therefore redundant. Removing it would have deleted the
only Node-testable proof that this verb's record comes from the closed set (the
unit test's `success` stub builds no failure), and would have removed the one
remaining compile-checked code site in the files I own. See
[the clobber it leaves](#the-redundant-override-and-the-clobber-it-leaves).

**`e2e/content/tests/check-assert.spec.ts`.** One row's contract changed, five
rows gained a duration assertion, two rows are new, and the header explains the
split. Detail in the next section.

### Making the unproven rows prove something

Five rows pass `timeoutMs: 200`. The brief names three; the other two
(`text-wrong`, `enabled-disabled`) had the same defect, so all five are fixed.

| Row | Before | After |
| --- | --- | --- |
| `exists-missing` (nothing matches) | `failed` / STATE_MISMATCH | **`timed_out` / TIMEOUT**, message asserted, plus `spent() >= 200` |
| `text-wrong` | STATE_MISMATCH | unchanged, plus `spent() >= 200` |
| `visible-hidden` | STATE_MISMATCH | unchanged, plus `spent() >= 200` |
| `enabled-disabled` | STATE_MISMATCH | unchanged, plus `spent() >= 200` |
| `url-wrong` | STATE_MISMATCH | unchanged, plus `spent() >= 200` |

`spent(reply)` is `reply.finishedAt - reply.startedAt`, read off the result the
background worker already receives — no new import, no new plumbing. A row
asserting it spent its `timeoutMs` is asserting the polling loop ran, which the
verdict alone cannot say because a single immediate read reaches the same
verdict.

Two new rows, both of which exist to stop the rule being re-derived wrongly:

- **`assert: a kind is not what decides a timeout`** — `visible` on a selector
  that matches nothing is TIMEOUT; `visible` on an element that is present but
  hidden is STATE_MISMATCH. Same kind, same fixture, two records. This is the
  row that proves the discriminator is what the page let us read, not which
  claim was asked.
- **`assert: absent is not the mirror of exists`** — `absent` on an element that
  never goes is STATE_MISMATCH, and it still waited its whole window.

### The mutation proof

`assertion-evaluation.ts`'s polling loop replaced by `await delay(0)`, nothing
else changed, then restored and everything re-run.

**Unit tests → exit 1**, `# pass 195 / # fail 2`, exactly:

```text
not ok 79 - the wait is real: a claim that becomes true partway through the window holds
not ok 80 - a claim the page contradicts is judged, and reports its window as expired
```

**`check-assert.spec.ts` → exit 1**, `8 failed / 6 passed`. All three rows the
brief called unfalsifiable are among the eight, and the two remaining
`timeoutMs: 200` rows and both new rows fail too. The `exists-missing` row fails
on the whole contract:

```text
  Object {
    "failure": Object {
      "actual": "nothing matched \"[data-testid=\"never\"]\"",
-     "category": "timeout",
-     "code": "web.action.timeout",
+     "category": "unexpected_state",
+     "code": "web.validation.state_mismatch",
      "expected": "an element matching \"[data-testid=\"never\"]\" exists",
-     "retryable": true,
-     "stage": "execution",
+     "retryable": false,
+     "stage": "verification",
    },
-   "message": "Assertion did not hold within 200 ms: exists.",
-   "status": "timed_out",
+   "message": "Assertion did not hold: exists.",
+   "status": "failed",
```

The four that stay STATE_MISMATCH fail on the duration instead, which is exactly
the property they were missing:

```text
  228 |   expect(spent(stays)).toBeGreaterThanOrEqual(200);      Received: 12
  255 |   expect(spent(wrong)).toBeGreaterThanOrEqual(200);      Received: 5
  269 |   expect(spent(hidden)).toBeGreaterThanOrEqual(200);     Received: 23
  293 |   expect(spent(disabled)).toBeGreaterThanOrEqual(200);   Received: 3
  313 |   expect(spent(elsewhere)).toBeGreaterThanOrEqual(200);  Received: 3
```

Loop restored, source re-read, both suites rerun: **197/197** and **14/14**.

## Task 2 — the last door out of the closed set

### What was actually still used

I checked every export of `validation-outcome.ts` against the whole repository
rather than trusting the earlier reports:

| Export | Production callers | Verdict |
| --- | --- | --- |
| `boundValidation` | `results.ts` ×3 | kept |
| `statusForValidation` | `results.ts` ×1 | kept |
| `VALIDATION_TEXT_MAX_LENGTH`, `truncateValidationText` | internal + the test | kept |
| `outputNotObservedFailure` | **none** | deleted |
| `rejectionFailure` | **none** | deleted |
| `timeoutFailure` | **none** | deleted |
| `notImplementedFailure` | **none** | deleted |

The four builders' only importer anywhere was
`tests/validation-outcome.test.ts`, so the earlier reports were right: a green
test standing behind dead code that disagreed with the wire. All four are gone,
along with the local `FailureRecord` alias and `comparedText`. The module went
from 98 lines to 56 and now exports four things, every one of them called.

They were deleted rather than converted to `webAutomationFailureRecord`. A
converted builder could only restate the code table's binding or contradict it,
and Core drops a contradicting record whole — so the second statement is a
liability with no upside. The file header now says this, so the next reader does
not reintroduce them as a convenience.

### The compile proof, and the half of it that failed

**The site that remains is compile-enforced.** `assert.ts`'s
`stateMismatchFailure` is the only place in the files I own that names a code.
Replacing `WEB_AUTOMATION_FAILURE_CODES.STATE_MISMATCH` with the out-of-set
string `"web.assert.state_mismatch"` and running `check` → **exit 2**, one
error, and the compiler said exactly:

```text
src/content/actions/assert.ts(138,5): error TS2345: Argument of type
'"web.assert.state_mismatch"' is not assignable to parameter of type
'WebAutomationFailureCode'.
```

Restored, and the restored line re-read.

**A reintroduced hand-built builder is not.** I put `rejectionFailure` back
verbatim — `code: \`web.action.${code}\`` from a caller-supplied suffix, typed
`NonNullable<BrowserActionResult["failure"]>` — and ran `check`: **exit 0, no
diagnostics.** The type system does not stop it, because the protocol's failure
record types `code` as a bare `string`. So the door is shut by deletion, not by
the compiler, and deletion is exactly the kind of guard a later edit undoes
without noticing.

**So I gave it a guard that does fail.** `tests/validation-outcome.test.ts` now
pins the module's exported surface by name. With `rejectionFailure` reintroduced
the suite goes **exit 1**, one failure, and it names the offender:

```text
not ok 92 - the module exports no failure builder, which is what keeps the closed set closed
  error: |-
    Expected values to be strictly deep-equal:
    + actual - expected
      [
        'VALIDATION_TEXT_MAX_LENGTH',
        'boundValidation',
    +   'rejectionFailure',
        'statusForValidation',
        'truncateValidationText'
      ]
```

Reverted, suite rerun clean. **The proper fix is one line I do not own**:
narrowing `code` on the failure record in `apps/extension/src/shared/protocol.ts`
(reached through `content/types.ts`) from `string` to the domain's
`WebAutomationFailureCode` would make every hand-built out-of-set record a
compile error across the whole extension, not just at the call sites that
already go through `webAutomationFailureRecord`. That closes the same door for
`runtime/`, which `w3-worker-codes` narrowed builder-by-builder instead.
Recorded as an open question below.

### The redundant override, and the clobber it leaves

`assert.ts` replaces the failure `results.ts` built with its own
`stateMismatchFailure`. Since `results.ts` already maps `web.dom.assert` to
`STATE_MISMATCH`, the two records are identical — **except** when `buildResult`'s
`authGateFailure` hook has replaced the record with `AUTH_REQUIRED`, which the
override then discards.

I left it, deliberately, and my change narrows it rather than widening it:
`authGateFailure` fires only when the action's selector matches nothing, and a
selector matching nothing now routes to `deps.timedOut`, where there is no
override. What is left is a genuinely narrow edge — a `url` claim carrying a
stale selector on a page that has become a sign-in gate. Removing the override
is the right end state, but it would delete the only Node-testable proof that
this verb's record comes from the closed set (the unit stub's `success` builds
no failure) and the only compile-checked code site in my files, and it changes
behaviour on a path `w3-failure-producers`' `failures.spec.ts` covers. That is a
supervisor's call, not a worker's, so it is flagged rather than taken.

## Tests

Ten rows added or rewritten, in three files.

- **`content/action-runtime/tests/assertion-evaluation.test.ts`** (new, 5 rows).
  The `url` kind is the only one that reads nothing but `location.href`, so the
  whole module runs in Node against a two-line stub with no DOM. Rows: a claim
  already true holds on the first attempt and spends nothing; **a claim that
  becomes true partway through the window holds** (the row that dies with the
  loop); a contradicted claim reports `waitExpired` *and* `judged`, more than
  one attempt, and the whole window spent; a claim given no window is judged
  once and reports no expiry; a malformed claim stops at once rather than
  burning five seconds. What this cannot cover is the per-kind verdicts, which
  are element-shaped — those are the harness's and `assert.test.ts`'s.
- **`content/actions/tests/assert.test.ts`** (3 new rows; the stub extended with
  `timedOut` and with the outcome's timing). `success` and `timedOut` produce
  different statuses and nothing else does, so a row asserting `timed_out` is
  asserting which builder the verb chose. Rows: a subject that never appeared
  routes to `timedOut`, with the message and with **no record of the verb's
  own**, so TIMEOUT is not overwritten; a contradicted claim is STATE_MISMATCH
  *even though its window ran out* — the row that stops the timeout branch
  swallowing every failure; and a claim given no window is STATE_MISMATCH.
- **`content/action-runtime/tests/validation-outcome.test.ts`** (four tests
  removed with their subjects, one added, one rewritten). The removed coverage
  is not lost: whole-record round-trips through Core's parser live where the
  records are actually built. The rewritten bounding row now builds its record
  the way `results.ts` does, from the closed set, which is the pair that has to
  hold — this module bounds the validation an operator reads, the domain bounds
  the record Core parses.

## Commands run and observed results

`EXTENSION_TEST_BUILD_LABEL=w3-assert-timing` was set for every package command.
Exit status was captured by redirecting to a file and echoing `$?`, never
through a pipe. No `pnpm build`, no `pnpm lab`, no `pnpm structure:baseline`, no
domain or test-runner command — I own no file in either.

| Command | Exit | Observed |
| --- | --- | --- |
| `pnpm --filter @fluxiq-web-extension/extension check` | **0** | `tsc -p tsconfig.json --noEmit && tsc -p tsconfig.test.json`, no diagnostics |
| `pnpm --filter @fluxiq-web-extension/extension test` | **0** | `# tests 197 / # suites 0 / # pass 197 / # fail 0 / # cancelled 0 / # skipped 0 / # todo 0`. My rows are `ok 78`–`ok 82`, `ok 92`, `ok 94` and `ok 98`–`ok 100` |
| `npx playwright test -c e2e/playwright.content.config.ts check-assert.spec.ts --workers=4` | **0** | `14 passed (4.6s)` |
| `npx playwright test -c e2e/playwright.content.config.ts --workers=4` (whole harness, 18 spec files) | **0** | `181 passed (25.1s)`, 0 failed |
| **Mutation A** — polling loop replaced by `await delay(0)`; unit tests | **1** | `# pass 195 / # fail 2`, exactly `not ok 79` and `not ok 80` |
| **Mutation A** — same; `check-assert.spec.ts --workers=4` | **1** | `8 failed / 6 passed`; diffs quoted above. Restored → `14 passed` |
| **Mutation B** — out-of-set code string in `assert.ts`; `check` | **2** | one `error TS2345`, quoted above. Restored → exit 0 |
| **Mutation C** — `rejectionFailure` reintroduced; `check` | **0** | **no diagnostics** — the finding, not a pass |
| **Mutation C** — same; unit tests | **1** | `# pass 196 / # fail 1`, `not ok 92`, naming `rejectionFailure`. Reverted → 197/197 |
| `node scripts/structure-audit.mjs` | **0** | `structure-audit: passed (28 warning(s), 19 baselined)`. No violation at all, and `grep` over the output finds no line naming `assertion-evaluation`, `validation-outcome`, `actions/assert` or `check-assert` |

The audit needed no scratch `GIT_INDEX_FILE` for the source change: the
supervisor's commit had already tracked every file including the new test, so
the audit read them from the real index. I staged nothing into the real index at
any point (`git diff --cached --name-only` is empty).

File sizes after the change, all far under the 400-line advisory:
`assertion-evaluation.ts` 193, `validation-outcome.ts` 56 (from 98),
`actions/assert.ts` 141, `check-assert.spec.ts` 330; the three test files 95, 78
and 202. One file was added, to
`content/action-runtime/tests/` (2 files → 3, against a 15-file advisory), and
no file was added to `content/actions/`, which already sits at the advisory.

## Not verified

- **No live browser validation.** The content harness is the real content-script
  bundle in real Chromium on Scenario Lab fixtures, but with no background
  worker, no tab routing and no gateway. What a Flow sees when an assertion
  times out — in particular whether Core's retry path does something useful with
  `timeout`/`retryable: true` where it previously saw `unexpected_state`/
  `retryable: false` — is not proven here, and it is the substantive downstream
  consequence of this change.
- **The domain and test-runner packages were not checked or tested.** I own no
  file in either and touched neither. `domain/src/runtime/expectation/conditions.ts`
  mentions `AssertionOutcome` by name in prose only — it does not import the
  extension's type (it could not; the boundary forbids it) — so the widened type
  cannot have broken it. I did not run domain `check` to confirm that.
- **`pnpm check`, `pnpm test` and `pnpm build` at repository scope** were not
  run. The structure audit, which root `check` runs first, was run directly.
- **The whole-harness green is a snapshot.** Other workers were editing this tree
  while I ran it.
- **Timing assertions are wall-clock.** `spent() >= 200` and the unit tests'
  `elapsedMs` bounds are lower bounds on a machine that has already shown it
  overloads under parallel Playwright runs. They cannot flake high; they would
  only flake if a timer fired early, which it cannot.
- **The `text`-detaches-late edge** described above is reasoned, not tested: no
  row exercises an element that is present with the wrong text and then
  disappears before the deadline.
- **Firefox.** Nothing here is browser-specific, but no Firefox build was loaded.

## Open questions or contradictions found

### The one-line fix that would close the door properly

`apps/extension/src/shared/protocol.ts` types the failure record's `code` as
`string`. Narrowing it to the domain's `WebAutomationFailureCode` would turn
every hand-built out-of-set record in the extension into a compile error at
once — the content bundle and the worker side both — rather than relying on each
producer having been converted and on nobody adding a new one. `w3-worker-codes`
narrowed four builders' parameters to get the same property in one file;
`w3-extension-gaps` reported the same wall from a third direction. This is the
seam all three of us kept hitting, and no brief has owned it. It is not mine:
`shared/protocol.ts` is outside my Owns and is imported by everything.

If the supervisor takes it, expect it to surface any remaining hand-built record
as a compile error, which is the point.

### `assert.timeoutMs: 0` still cannot reach the wire

The rule I implemented gives `timeoutMs: 0` a distinct meaning — one immediate
check, and never a timeout — and it is unreachable from a Flow, because the
wire's positive-integer guard drops `0` and substitutes the 5 s default. Already
known to the supervisor (recorded by `w3-extension-gaps`), restated because this
change makes a zero timeout meaningful rather than merely accepted. Either the
guard should let a zero through as "check once", or the domain should reject it
as invalid rather than silently changing it into five seconds.

### `absent` still holds vacuously, and now that matters more

`absent` with no selector and no element holds — `currentElement` finds nothing,
so nothing matches — where `exists` has an explicit guard rejecting the same
request as malformed. It also holds against a selector that matches nothing
because the page has not rendered yet, which is the classic false pass. I did
not change either: both would turn passing assertions into failing ones, which
is a product decision and not this brief's. But `absent` is now the kind whose
failure can never be a timeout, which makes the weakness of its *success* the
more interesting half. A `settleMs` before judging `absent` is the usual answer.

### The redundant override in `assert.ts`

Described in full above. One line, `{ ...result, failure: stateMismatchFailure(result.validation) }`,
which duplicates what `results.ts` already decides and discards `AUTH_REQUIRED`
when the auth-gate hook has fired. Deleting it is right; doing so costs the
verb's Node-testable proof of its own code and touches a path another worker's
spec covers, so it wants a decision rather than a quiet edit.

### The brief's file name

`assert-conditions.ts` does not exist and was never created. If the supervisor
writes another brief in this area, the module is
`content/action-runtime/assertion-evaluation.ts`. Both reports this brief cited
name it correctly, so the slip was in the brief alone — worth noting only
because "if one exists" invited a worker to skip the real file and ship the
change inert, which is the failure mode the wave's binding rules warn about.

### The commit that arrived mid-task

`ee25ac9` committed my four source files and three test files while I was still
mutating and restoring them. It happened to capture the restored state, and
every gate in this report was run after the restores, so nothing broken was
committed. But a commit taken during a worker's mutation proof could capture a
deliberately broken tree, and neither the worker nor the supervisor would see it
in `git status`. If the supervisor commits while workers are running, it is
worth asking them to report first.
