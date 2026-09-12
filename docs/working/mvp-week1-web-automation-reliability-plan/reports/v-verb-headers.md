# Report: v-verb-headers

Worker: `v-verb-headers`. The two cleanups Wave 3 left behind, both found by
`v-dispatcher`: three verb headers describing a dispatcher that no longer
exists, and an unsupported action type reported as retryable.

## Outcome

**Done.** Both tasks landed, the new test fails against the old throw and passes
against the new one, and extension `check`, extension `test`, the content
harness and the structure audit are all green on the first run.

One thing worth the supervisor's attention: the fix for task 2 could **not** be
made the way `v-dispatcher` proposed. Its suggestion was to throw a
`WebAutomationRuntimeError` carrying the code, which `classify.ts` honours as
rule 2 — but that class is **not reachable from the extension**. See
[Why not a WebAutomationRuntimeError](#why-not-a-webautomationruntimeerror). The
route taken instead is the one `resolve-target.ts` already uses and needs no
file outside my ownership, so nothing here is inert.

## What changed and why

### Task 2 — `apps/extension/src/content/actions/execute.ts`

The fallthrough threw a bare `Error` whose message read "Unsupported action
type: ...", so `classify.ts` rule 6 landed it on `web.action.failed` —
`action_failed`, **retryable**. It now throws a local
`UnsupportedActionTypeError` carrying a record built by
`webAutomationFailureRecord` from `WEB_AUTOMATION_FAILURE_CODES.UNSUPPORTED_TYPE`:
`web.action.unsupported_type`, `blocked_by_capability_or_policy`, **not
retryable**, stage `dispatch`. The wire string is never written in this file;
the code is imported from the closed set through
`@fluxiq-web-extension/domain/client`.

`results.ts`'s `actionFailure` lifts the record off the thrown value in
`reportedFailure` — structurally, and only when the code is one
`isWebAutomationFailureCode` names — before it reaches the classifier, so the
producer's own classification wins, which is the documented precedence in both
`results.ts` and `classify.ts`.

**The rejected-verb path is untouched.** `v-dispatcher`'s reasoning for
`ACTION_FAILED` there is right and I did not disturb it: a verb that rejects has
almost always hit a detached node or a torn-down frame, and a retry against the
settled page is the correct response.

Two header paragraphs changed with it: the routing paragraph now says the
fallthrough reports UNSUPPORTED_TYPE rather than "falls through to the throw",
and a new paragraph states why the two throws that reach the same catch must
report different codes. The paragraph explaining ACTION_FAILED for a rejection
is unchanged and still true.

#### Why not a `WebAutomationRuntimeError`

`v-dispatcher`'s open question 4 proposed throwing one. It cannot be done from
`apps/extension` as the tree stands:

- `WebAutomationRuntimeError` lives in `domain/src/runtime/errors.ts`.
- `domain/src/runtime/failure/index.ts` exports `./classify` and `./codes` only;
  `classify.ts` *imports* the class but does not re-export it.
- `domain/src/client/index.ts` — the barrel the extension imports — exports
  `../runtime/failure`, not `../runtime/errors`.
- The domain's `exports` map has only `.` and `./client`, and the root barrel
  pulls in the whole runtime (`adapter`, `service`, `host-runtime`,
  `llm-evidence`), which has no business in a content-script bundle.

So the class is reachable only by editing `domain/src/client/index.ts`, which my
brief forbids. The alternative used instead is the seam already established in
this tree for a content-side producer that knows its own code:
`resolve-target.ts`'s `TargetResolutionError` carries an
`AutomationStudioFailureRecord`, and `results.ts` reads it off the error. Same
mechanism, same precedence, no file outside my ownership, and one fewer
cross-package dependency in the content bundle.

If the supervisor prefers the runtime-error route on principle, the one-line
change is `export * from "../runtime/errors";` in `domain/src/client/index.ts`,
plus swapping the class here. I did not judge it an improvement: attaching the
record states the code directly rather than leaving it to be re-derived by a
classifier, and it is what the neighbouring producer does.

### Task 1 — three verb headers

Each said, as a live reason for its own `catch`, that `execute.ts` does not
await it. Each now says the catch is belt and braces — the dispatcher awaits
every branch and its catch would report the same rejection — and gives the
reason the catch is still worth having on its own terms: it keeps the failure
local, reported as *this* verb failing at *this* verb's `startedAt`, whatever
the dispatcher does. Each closes with one parenthesis recording that the catch
was load-bearing until 2026-09-11, so the next reader does not mistake the
removal of a reason for the removal of a rationale.

**No `catch` was removed**, in any of the three. Behaviour is unchanged by task
1 entirely — comments only.

- `assert.ts:57-64`
- `extract-list.ts:9-15`
- `scroll.ts:19-28`

#### The rest of each header, checked against the code

The brief asked. One further inaccuracy found, in `scroll.ts`:

> A command with no `scroll` request is the legacy absolute move to
> `options.x`/`options.y`, unchanged.

`requestedPosition` reads `action.options?.x ?? action.coordinates?.x` and falls
back to the *current* position per axis when neither names one. The header named
one of the three sources. Corrected to name all three.

Everything else in the three headers checked out against the code:

| Claim | Verified against |
| --- | --- |
| assert: a failed claim is STATE_MISMATCH, not OUTPUT_NOT_OBSERVED | `results.ts` `unobservedOutputCode` |
| assert: an unjudged claim is TIMEOUT, status `timed_out` | `assertionTimedOut`, `deps.timedOut` |
| assert: this verb builds no record of its own; both branches return the builder's result untouched | the two `return deps.*` calls |
| assert: `authGateFailure` runs after the code is chosen, and overwriting would discard it | `results.ts` `buildResult` |
| assert: the kind rides in `expected` and `assert.kind`, not in the code | the `validation` object built from `outcome` |
| extract-list: records become `extracted`; a missing field is a failed validation → OUTPUT_NOT_OBSERVED | `validationFor`, `deps.success` |
| scroll: three modes, `maxScrolls` caps `untilStable` | `WebAutomationScrollRequest` in `domain/src/actions/types.ts`; `scrollAction` |
| scroll: position clamped so a scroll past the end is not a failure | `clampToDocument`, `scrollLimits` |
| scroll: hitting the cap while still growing is a *failed* validation | `scrollUntilStable`'s `settled` flag |
| scroll: the verb never rejects | the whole body is inside one `try` |

I also grepped the rest of `apps/extension/src` for the same stale claim
(`unawaited`, `escape its catch`, `does not await`, `settles after`). Every
remaining occurrence is either in `execute.ts`/`execute.test.ts` describing the
history in the past tense, or one of the three I corrected. Nothing else in the
tree still asserts it as present-tense fact.

### `apps/extension/src/content/actions/tests/execute.test.ts`

One new row, plus two corrections to what was there.

**New row 4, "an unsupported action type is refused as unretryable, and a verb
that rejects stays retryable."** Both halves in one test on purpose, so the
contrast is what fails rather than two rows that could drift apart. It asserts
the unsupported type reports `web.action.unsupported_type` /
`blocked_by_capability_or_policy` / `retryable: false` / stage `dispatch`, that
`actual` names the type, and that Core's `parseAutomationStudioFailureRecord`
accepts the record; then that a rejecting verb still reports
`web.action.failed` with `retryable: true`; then, explicitly, that the two codes
and the two retryable flags **differ**. That last pair is what notices if the
unsupported path ever falls back to a bare `Error` and collapses onto
ACTION_FAILED again.

`web.browser.navigate` is the action type used, rather than an invented string:
it is a real member of the domain's vocabulary that the background worker runs,
so reaching the content frame means it was misrouted — the realistic instance of
this failure rather than a synthetic one.

**The `classifiedFailure` stub now reproduces `actionFailure`'s full
precedence.** It previously called only `classifyWebAutomationFailure`, which
would have reported ACTION_FAILED for the new path and made the row assert the
test's own shortcut rather than the product's rule. It now calls
`isWebAutomationFailureCode` on a record read off the error first, exactly as
`results.ts` does, then falls through to the classifier and the same UNKNOWN
fallback. It is still reproduced by *calling the same exports the real builder
calls*, never by restating an answer.

**Row 3's comment was stale.** It said `web.browser.*` "lands on ACTION_FAILED
today, where UNSUPPORTED_TYPE would be the more precise member — deliberately
not pinned here". `v-dispatcher` wrote that so naming it properly would not be a
test change, and it was right: row 3 needed no assertion change, only the
comment removing. Its assertion is still "a code from the closed set, whichever
one".

## Commands run and observed results

`EXTENSION_TEST_BUILD_LABEL=v-verb-headers` throughout. Exit statuses captured by
redirecting to a file and echoing `$?`, never through a pipe. I did not run
`pnpm build` or any `pnpm lab` command.

### The new test, before and after

Both runs built and executed **only**
`content/actions/tests/execute.test.ts`, through a scratch script in the
scratchpad mirroring `scripts/test-extension.mjs` (esbuild bundle, `node:test`).

**Before** — the throw reverted to `throw new Error(...)` under a backup-and-
restore, exit **1**:

```
ok 1 - a verb that rejects on a later tick still answers, instead of leaving the command unanswered
ok 2 - the escaped rejection carries ACTION_FAILED from the closed set, and stays retryable
ok 3 - no action type can leave the background worker without a reply
not ok 4 - an unsupported action type is refused as unretryable, and a verb that rejects stays retryable
  error: |-
    Expected values to be strictly equal:
    + actual - expected

    + 'web.action.failed'
    - 'web.action.unsupported_type'
  operator: 'strictEqual'
ok 5 - awaiting a branch does not change what a caller sees when the verb succeeds
# tests 5
# pass 4
# fail 1
```

The failure is the defect itself, named: the unsupported type reporting the
retryable code. Rows 1, 2, 3 and 5 pass in both states, which is what says this
change touches only the fallthrough — row 2 in particular is the rejected-verb
path the brief told me to leave alone, and it is unmoved.

**After** — the tree as it stands, exit **0**:

```
ok 1 - a verb that rejects on a later tick still answers, instead of leaving the command unanswered
ok 2 - the escaped rejection carries ACTION_FAILED from the closed set, and stays retryable
ok 3 - no action type can leave the background worker without a reply
ok 4 - an unsupported action type is refused as unretryable, and a verb that rejects stays retryable
ok 5 - awaiting a branch does not change what a caller sees when the verb succeeds
# tests 5
# pass 5
# fail 0
```

Restoration verified byte-for-byte: `diff` of `execute.ts` against the
pre-regression backup reported no differences, and the regressed window was a
few seconds inside one shell with an `EXIT` trap.

### Definition of done

| Command | Exit | Observed |
| --- | --- | --- |
| `pnpm --filter @fluxiq-web-extension/extension check` | 0 | both `tsc` projects clean, no output |
| `pnpm --filter @fluxiq-web-extension/extension test` | 0 | `# tests 221 / # pass 221 / # fail 0`; the new row is `ok 111` |
| `pnpm --filter ... run test:content --workers=4` | 0 | `187 passed (22.6s)` |
| `node scripts/structure-audit.mjs` (scratch `GIT_INDEX_FILE`) | 0 | `structure-audit: passed (29 warning(s), 19 baselined)` |

`check` and `test` were run twice — once before the final comment edit to the
test file's header and once after; both green both times, and the table quotes
the second.

The content harness was green on the **first** run, so no rerun was needed; the
count went 186 → 187 against `v-dispatcher`'s figure, which is other workers'
rows landing, not mine (I added no spec).

The structure audit ran with my five files staged into a copy of `.git/index`
placed in the scratchpad, `GIT_INDEX_FILE` exported for that command only. The
real index was confirmed empty afterwards (`git diff --cached --name-only`
printed nothing). No warning names any of my files, and I did not run
`pnpm structure:baseline`. None of the five is in `.structure-baseline.json`, so
no baselined file grew; `apps/extension/src/content/actions/` stays at 19 files
against the 15-file advisory, unchanged, because I added no file.

## Not verified

- **Live browser behaviour of the UNSUPPORTED_TYPE path.** The content harness
  never sends the content script an action type it has no branch for — there is
  no such row, and `e2e/` is outside my ownership so I could not add one. The
  path is proven in Node against a faithful reproduction of `actionFailure` and
  never in Chrome. What a Chrome run would add over the Node one is the real
  `results.ts` builder: `reportedFailure`, and `authGateFailure` running after
  it inside `buildResult`.
- **`authGateFailure` over an unsupported type.** `buildResult` replaces any
  record with AUTH_REQUIRED when the action's selector matches nothing and the
  document is a sign-in gate. An unsupported type carrying a stale selector on a
  sign-in page would therefore be reported as AUTH_REQUIRED, not
  UNSUPPORTED_TYPE. That is pre-existing behaviour and identical to what happens
  with ACTION_FAILED today, so this change neither creates nor worsens it, but I
  did not exercise it and it lives in a file I do not own.
- **Whether Core's retry path treats `blocked_by_capability_or_policy` as
  terminal.** `v-dispatcher` flagged this and I did not check Core either. The
  code table says `retryable: false`, and this change makes the browser's answer
  consistent with `gateway-mapping.ts`, which already emits
  `web.action.unsupported_type` for a refused type — so the two halves of the
  same refusal now agree, which is true regardless of what Core does with the
  flag. Someone should still confirm Core honours it rather than retrying on
  category alone.
- I ran no domain, test-runner or scenario-lab suite; I touched no code in those
  packages.

## Open questions or contradictions found

1. **`WebAutomationRuntimeError` is unreachable from the extension**, and this
   is the second brief to assume otherwise. `w3-failure-codes` added the export
   seam for `failure/` to `domain/src/client/index.ts`, but not for
   `runtime/errors.ts`, so the class `classify.ts` rule 2 is built around cannot
   be thrown by any browser-side producer. Rule 2 is therefore reachable from
   the content script only through the structural lookalike branch — an object
   with `name: "WebAutomationRuntimeError"` and a `code`, which no honest caller
   would construct. Either add `export * from "../runtime/errors";` to the
   client barrel, or accept that the browser side classifies exclusively through
   attached records (`error.failure`) and say so where rule 2 is documented.
   Right now the classifier documents a route the largest consumer cannot take.

2. **Two producers, two mechanisms for the same thing.** A content-side producer
   that knows its code can attach a record to the thrown error (`resolve-target.ts`,
   and now `execute.ts`), while a domain-side one throws a
   `WebAutomationRuntimeError`. `results.ts` honours the first,
   `classifyWebAutomationFailure` honours the second, and only `results.ts`
   honours both. That works, and I followed the browser-side convention, but the
   split is undocumented outside the two files that implement it. It would be
   worth one sentence in `failure/index.ts` or in `results.ts` saying which
   mechanism belongs on which side of the boundary and why — otherwise the next
   producer picks one by whichever neighbour it read first.

3. **`v-dispatcher`'s open questions 3 and 4 are now closed** — this brief was
   both — but its open questions **1 and 2 are still open** and are not mine:
   the open-questions entry at `open-questions.md:58-74` still reads as open and
   still says "Fix at Wave 2 integration" for work that landed in `ed6ab74`, and
   it still names `upload` and `dialog` as instances of a defect they never had.
   The next worker briefed from that entry will lose the same reading time
   `v-dispatcher` did.
