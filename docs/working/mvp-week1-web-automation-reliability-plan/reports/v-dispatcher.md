# Report: v-dispatcher

Worker: `v-dispatcher`. The verb dispatcher's unawaited branches — the hang the
open-questions entry describes.

## Outcome

**Done**, with one correction the supervisor needs: **items 1 and 2 of the brief
were already done.** The `return await` fix and the header rewrite landed in the
Wave 2 integration commit `ed6ab74`, on 2026-09-11. The open-questions entry
that served as my specification says "Fix at Wave 2 integration" and was never
struck through, and the brief was written from it, so the task was deferred a
third time against work that already existed.

What was genuinely missing was the test, which is what this report is mostly
about. It is written, it fails against a regressed dispatcher and passes against
the real one, and the extension `check`, `test`, the content harness and the
structure audit are all green.

## What changed and why

### `apps/extension/src/content/actions/tests/execute.test.ts` (new)

Four tests. The load-bearing two drive `wait-for-selector.ts` into an
**asynchronous** rejection through a `deps.waitForCondition` that settles on a
later tick, which is the exact shape that escaped the try block, and assert that
`executeContentAction` **resolves** with a failure result.

`wait-for-selector.ts` is the verb chosen because it is the only asynchronous
verb with **no internal `catch` of its own**, so the rejection reaching the
dispatcher is real rather than staged. See
[Why no test could have failed against the true pre-fix file](#why-no-test-could-have-failed-against-the-true-pre-fix-file)
for why that choice is forced.

Test 3 iterates `WEB_AUTOMATION_ACTION_TYPES` — the domain's own list, all 18 —
with every capability throwing, and asserts each one answers with a failure
carrying a code from the closed set that survives Core's
`parseAutomationStudioFailureRecord`. Iterating the domain list rather than a
hand-written one keeps it exhaustive as the vocabulary grows: a type added
without a branch here still has to answer through the dispatcher's throw.

Test 4 is the control for the behaviour-change question: a succeeding verb's
result reaches the caller as the very object the verb built (asserted by
identity, not by value), so nothing downstream can tell an awaited branch from a
returned one.

The stub for `deps.failure` reproduces `action-runtime/results.ts`'s
`actionFailure` by **calling the same two exports it calls** —
`classifyWebAutomationFailure` with the same outcome, and the same `UNKNOWN`
fallback — rather than by restating its answer, so the code assertion tests the
product's classification rule and not the test's opinion of it. The real builder
reads `location`, `document` and the capture settings and cannot run in Node;
that is the same constraint `tests/assert.test.ts` documents, and the snapshot
the real builder attaches is the only part not exercised here.

### `apps/extension/src/content/actions/execute.ts` (header only)

No code change — every branch already read `return await`. The header was
already true of the fixed design, so "correct the header" did not apply as
written. I extended it with the three things it did not say and a reader now
needs: that the hole never actually fired and why (which is why it survived
review), that the three internal verb catches are a convention nothing enforces
and the guarantee therefore now sits in `tests/execute.test.ts`, and which
failure code a caught rejection lands on and why that member and not its
sibling.

## The failure code: ACTION_FAILED, deliberately, not UNKNOWN

The brief suggested `UNKNOWN` ("nothing said why the action failed") and asked
me to check the set and choose. I chose **`ACTION_FAILED` / `web.action.failed`**
— which is also what the code already produces — and I would argue against
`UNKNOWN` if asked to change it.

The set draws the line at whether anything said why. A verb that rejected threw
an `Error` and put a reason in its message; that reason is one **no code names**,
which is precisely what `w3-failure-codes` defines `ACTION_FAILED` for.
`UNKNOWN` means the producer could not determine a cause at all, and
`classify.ts` reserves it for a runtime error carrying an unrecognized code or
an outcome with no message.

The brief is right that the distinction changes Core's retry behaviour, and that
is the strongest argument for `ACTION_FAILED`:

| Code | Category | Retryable |
| --- | --- | --- |
| `web.action.failed` | `action_failed` | **yes** |
| `web.action.unknown` | `ambiguous_or_unknown` | **no** |

A rejection out of a verb is overwhelmingly a transient page condition — a node
detached mid-action, a frame torn down by a navigation that landed while the
action was running. A retry against the settled page is the right response.
Reporting `UNKNOWN` would turn every one of those into a hard stop, which is a
worse outcome than the hang it replaced in one respect: the hang was at least
visible as a stuck run, whereas a non-retryable failure looks like a decision.

## Whether awaiting the branches changes anything observable

Asked in the brief; the conclusion is **no**, on four counts.

1. **Rejection routing** is the intended and only semantic difference. `return p`
   inside a `try` makes the async function's promise *adopt* `p` after the block
   has been left; `return await p` resumes inside the block.
2. **Microtask timing** moves, and moves the safe way. Promise adoption
   (`return p`) costs two extra microtask ticks; `await p` costs one since V8's
   await optimization. So `return await p` settles the outer promise one tick
   **earlier or the same**, never later. For the synchronous verbs, `await v` on
   a non-promise adds one tick where `return v` added none. All of this is
   microtask ordering inside a single task, and the reply then crosses
   `chrome.runtime.sendMessage`, a task boundary coarser by orders of magnitude.
3. **Nothing inside a verb changes.** Each verb is still called at the same
   point with the same arguments; its DOM operations, its own awaits, its
   `startedAt`/`finishedAt`, its evidence capture and its result object are
   untouched. Test 4 pins this by object identity.
4. **Stack traces gain an `executeContentAction` frame**, which is an
   improvement in diagnosis, not a change in behaviour.

No verb returns a thenable other than a native promise, so no adoption
semantics differ.

## Why no test could have failed against the true pre-fix file

The brief asked for a test that fails first. Against the *actual* pre-fix
dispatcher, no test written over real verbs can fail, and the reason is worth
recording because it is why the hole survived review for a whole wave.

Of the fifteen branches that were returned unawaited:

- **Ten were synchronous verbs** (`capture-snapshot`, `extract`, `click`,
  `type`, `clear`, `select`, `keypress`, `check`, `upload`, `dialog`). A
  synchronous function throws *during* the try block, so its throw was always
  caught. **`upload` and `dialog`, two of the four branches the brief names as
  the hole, are in this group and never had it** — they return
  `BrowserActionResult`, not a promise. The original finding named four lines;
  two of them were not defects.
- **Three were asynchronous** — `assert`, `extract-list`, `scroll` — and each
  wraps its entire body in a `try`/`catch` that routes to `deps.failure`. Those
  are the three that carried the real risk, and each masked it.
- The two waits were already awaited.

So there was no reachable rejection anywhere in the tree, which is exactly the
masking the entry describes. Producing a failing test therefore required
removing the fix, not finding a verb that misbehaves. I did that under a
time-boxed revert (backup, `sed`, run one bundled test entry, restore in the
same shell through an `EXIT` trap); `git diff --quiet` confirmed byte-identical
restoration afterwards. The window was a few seconds.

The permanent test is stronger than the pre-fix file it was validated against:
it fails the moment any branch loses its `await`, including the two waits, which
is the defect class rather than the one instance of it.

## Commands run and observed results

`EXTENSION_TEST_BUILD_LABEL=v-dispatcher` throughout. Exit statuses captured by
redirect and `echo $?`, never through a pipe.

### The before/after evidence for the new test

Both runs built and executed **only** `content/actions/tests/execute.test.ts`,
through a scratch script mirroring `scripts/test-extension.mjs` (esbuild bundle,
`node:test`).

**Before — `execute.ts` regressed to `return <verb>Action(...)` on all fifteen
branches** (`grep -c "return await"` → `0`), exit **1**:

```
not ok 1 - a verb that rejects on a later tick still answers, instead of leaving the command unanswered
  failureType: 'testCodeFailure'
  error: 'the frame was detached while waiting'
not ok 2 - the escaped rejection carries ACTION_FAILED from the closed set, and stays retryable
  failureType: 'testCodeFailure'
  error: 'the frame was detached while waiting'
not ok 3 - no action type can leave the background worker without a reply
  failureType: 'testCodeFailure'
  error: 'web.dom.wait_for_selector left the command unanswered: Error: the frame was detached while waiting'
ok 4 - awaiting a branch does not change what a caller sees when the verb succeeds
# tests 4
# pass 1
# fail 3
```

The three failures are the rejection escaping: `executeContentAction` rejected
with the verb's error instead of resolving with a result. Test 4 passes in both
states, which is the point of it — it is the control that says the fix is not a
behaviour change.

**After — the tree as it stands** (`grep -c "return await"` → `15`), exit **0**:

```
ok 1 - a verb that rejects on a later tick still answers, instead of leaving the command unanswered
ok 2 - the escaped rejection carries ACTION_FAILED from the closed set, and stays retryable
ok 3 - no action type can leave the background worker without a reply
ok 4 - awaiting a branch does not change what a caller sees when the verb succeeds
# tests 4
# pass 4
# fail 0
```

Restoration verified: `git diff --quiet -- apps/extension/src/content/actions/execute.ts`
returned clean immediately after each regressed run, before the header edit.

### Definition of done

| Command | Exit | Observed |
| --- | --- | --- |
| `pnpm --filter @fluxiq-web-extension/extension check` | 0 | both `tsc` projects clean, no output |
| `pnpm --filter @fluxiq-web-extension/extension test` | 0 | `# tests 220 / # pass 220 / # fail 0` (was 216 before this file) |
| `pnpm --filter ... run test:content --workers=4` | 0 | `186 passed (20.6s)` |
| `node scripts/structure-audit.mjs` (scratch `GIT_INDEX_FILE`) | 0 | `structure-audit: passed (29 warning(s), 19 baselined)` |

The four new tests are visible in the full run as `ok 108`–`ok 111`.

The structure audit ran with both my files staged into a copy of `.git/index`
placed in the scratchpad, `GIT_INDEX_FILE` exported for that shell only; the
real index was confirmed empty afterwards. No new warning names either of my
files. `apps/extension/src/content/actions/` is at 19 files against a 15-file
advisory, unchanged by this work — the new file is in `tests/`, which is at 3.

**The content harness needed the rerun the brief anticipated.** The first
`--workers=4` run exited 1 with `183 passed, 3 failed`: `evidence.spec.ts:241`
(`infinite-feed: forms are not invented where the page has none`) and
`scroll.spec.ts:148` and `:166` (both `on infinite-feed › untilStable`), all
three timing out in `Tearing down "openHarness"`. All three are in files I do
not own, on one fixture, and `evidence.spec.ts` plus the snapshot modules the
`infinite-feed` rows read are `w3-evidence`'s live edits. The rerun was green at
186 passed, 20.6s against 52.4s, so the first run was load and a moving tree,
not a regression. Worth knowing that the count went 183 → 186 between runs: the
tree gained rows while I was measuring it.

The first invocation of the harness also failed for a reason worth writing down
for the next worker: `pnpm --filter <pkg> test:content -- --workers=4` forwards
the `--` to Playwright as a *test filename filter*, and it exits 1 with
`Error: No tests found`. Use `pnpm --filter <pkg> run test:content --workers=4`,
with no `--`.

I did not run `pnpm build` or any `pnpm lab` command, per the binding rules.

## Not verified

- **Live browser behaviour of the fix itself.** The content harness exercises
  the dispatcher on a real page for 186 rows, but none of them makes a verb
  reject, because no verb can — that is the masking. So the path this fix
  protects has been proven in Node and never in Chrome. It is not clear it can
  be proven in Chrome without a verb built to reject, which would mean shipping
  one.
- **`action-runtime/results.ts`'s real `actionFailure`.** The test calls the
  same classifier with the same outcome, but the real builder — and the snapshot
  it attaches to a failed result — cannot run in Node. `w3-failure-producers`
  owns that file and is editing it now.
- **Whether the microtask analysis holds under the extension's bundling.** It is
  reasoned from V8 semantics and confirmed by the tests resolving, not measured.
  Nothing in the product is sensitive at that resolution.
- I did not rerun the domain or other packages' suites; I touched no domain code.

## Open questions or contradictions found

1. **The brief and the open-questions entry are stale.** The fix they ask for
   landed at Wave 2 integration in `ed6ab74`, whose own commit message says so:
   "Every branch of the verb dispatcher is awaited." The entry at
   `open-questions.md:58-74` still reads as open and still says "Fix at Wave 2
   integration". It should be struck through. This cost most of the reading in
   this task, and the same entry will mislead the next worker briefed from it.

2. **Two of the four named lines were never defects.** `upload` and `dialog` are
   synchronous verbs returning `BrowserActionResult`. The finding that named
   "extract-list, upload, dialog and assert" was right about the pattern and
   wrong about two of its four instances; `scroll` was a real one it missed.
   Worth correcting in the entry if it is kept for the record, because it
   overstates how much of the tree was exposed.

3. **Three verb headers now describe a dispatcher that no longer exists**, and
   I do not own any of them. Each states as a live reason for its own `catch`
   that `execute.ts` does not await it:
   - `apps/extension/src/content/actions/assert.ts:57-59` — "`execute.ts`
     returns this verb's promise from inside its try block without awaiting it"
   - `apps/extension/src/content/actions/extract-list.ts:9-12` — "`execute.ts`,
     whose `try` block does not await what it returns"
   - `apps/extension/src/content/actions/scroll.ts:19-22` — "`actions/execute.ts`
     returns its promise rather than awaiting it"

   This is the ownership-drawn-around-a-file defect the wave brief warns about:
   my brief owns the dispatcher and its tests, but the false statements about
   the dispatcher live in three files it excludes. The internal catches
   themselves should **stay** — they are cheap and they keep a verb's own
   failure path local — but each comment should say it is defence in depth
   rather than the only thing standing between a rejection and a hung command.
   A follow-up brief owning those three headers is about ten minutes.

4. **An unsupported action type reports `ACTION_FAILED` where
   `UNSUPPORTED_TYPE` exists for it.** `execute.ts`'s fallthrough
   `throw new Error(\`Unsupported action type: ${action.actionType}\`)` is a
   plain `Error`, so `classify.ts` rule 6 lands it on `web.action.failed`,
   **retryable**. The closed set carries `web.action.unsupported_type` —
   `blocked_by_capability_or_policy`, not retryable, stage `dispatch` — which is
   both more precise and materially different, since retrying an unsupported
   type can never succeed. `gateway-mapping.ts` already emits it for a refused
   type, so the two halves of the same refusal disagree today.

   The one-line change is inside my file: throw a `WebAutomationRuntimeError`
   carrying that code, which `classify.ts` honours as rule 2. **I did not make
   it** — it is a behaviour change beyond the brief, and the wave rules say to
   report rather than widen. Test 3 deliberately asserts only "a code from the
   closed set" for those rows, and says so in a comment, so making the change
   later is not a test change. Whoever owns it should check whether Core's
   retry policy treats `blocked_by_capability_or_policy` as terminal before
   assuming this is a pure improvement.
