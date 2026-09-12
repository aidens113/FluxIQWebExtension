# Report: w3-failure-code-invariant

Worker: `w3-failure-code-invariant`. Wave 3, added after dispatch: make the
closed failure-code set a compile-time invariant, which four workers had now
reported open from four directions.

## Outcome

**Done.** The set is enforced by the compiler. A failure record whose `code` is
not one of the fourteen no longer compiles anywhere a result can carry it — in
the domain, in the content script, in the background worker, or in a test — and
two `@ts-expect-error` rows pin that so a later widening fails `check` rather
than reaching a browser.

Both packages are green, both suites pass, the content harness passes whole, and
the structure audit adds no finding. Both "real findings" the brief predicted
were there, and both are fixed through the builder with no cast anywhere.

The change came out **one file smaller than the measured patch**, and
`apps/extension/src/shared/protocol.ts` is not one of the files. The reason is
in [Where the narrowing went](#where-the-narrowing-went-and-why-protocolts-needed-no-edit)
and it is the one deliberate departure from the brief.

| Gate | Result |
| --- | --- |
| domain `check` | **exit 0** |
| domain `test` | **exit 0**, `# tests 257 / # pass 257 / # fail 0` |
| extension `check` | **exit 0** |
| extension `test` | **exit 0**, `# tests 216 / # pass 216 / # fail 0` |
| content harness, `--workers=4` | **exit 0**, `185 passed (22.5s)` |
| test-runner `check` (it depends on the domain) | **exit 0** |
| structure audit, scratch `GIT_INDEX_FILE` | **exit 0**, no finding names a file I touched |

## Where the narrowing went, and why `protocol.ts` needed no edit

The brief's chain is right: `protocol.ts` → `domain/src/actions/types.ts:274` →
Core's `AutomationStudioFailureRecord`. The measured patch narrowed the
**first** and the **third** links — an `Omit`/`&` pair in `protocol.ts` plus the
builder's return type — and left the middle one, `WebAutomationActionResult`,
carrying Core's permissive record.

I narrowed the **middle** link instead, which is the one place the result is
declared:

```ts
// domain/src/runtime/failure/codes.ts
export type WebAutomationFailureRecord = Omit<AutomationStudioFailureRecord, "code"> & { code: WebAutomationFailureCode };

// domain/src/actions/types.ts
failure?: WebAutomationFailureRecord | undefined;
```

Three consequences, all in the change's favour:

1. **`protocol.ts` needs nothing.** `BrowserActionResult` is
   `WebAutomationActionResult<DomElementDescriptor, DomSnapshot>`, so it
   inherits the narrowed field. No `Omit` gymnastics, no second declaration of
   the same rule, and no new export at the extension seam. The file is
   unmodified in the tree I leave behind.
2. **The invariant covers the domain too.** Under the measured patch, a
   hand-built record assigned to a *domain* `WebAutomationActionResult` — the
   shape the gateway mapping and the test runner hold — would still have
   compiled, because only the extension's alias was narrowed. Now one narrowing
   covers every consumer of the result.
3. **The error counts came out as the brief predicted anyway**: extension 14 →
   1, domain 1, and the same two files. The 13 honest producers needed no
   change, exactly as predicted; the extension's `tsconfig.json` project (all of
   `src`, minus tests) compiled clean on the first try with **zero** extension
   source edits.

`webAutomationFailureRecord` and `classifyWebAutomationFailure` both return the
narrowed type, so the check the builder makes on the way in is no longer thrown
away on the way out. Nothing in `F:\!FluxIQ` was touched: Core's `code: string`
is the right contract for a framework that does not own the vocabulary, and the
narrowed type stays assignable to Core's record, so nothing downstream of the
domain has to know it exists.

### The type-only cycle this creates, named

`actions/types.ts` now imports a type from `runtime/failure`, and
`runtime/failure/codes.ts` already imports `WEB_AUTOMATION_VALIDATION_TEXT_MAX_LENGTH`
— a value — from `actions/types.ts`. Only one direction is a runtime import; the
new one is `import type` and is erased, so no cycle exists in any bundle and the
content harness confirms the content bundle still builds and runs. The structure
audit has no cycle rule and both directions are directory imports through
barrels, so it is silent. It is still worth a decision later, and it is in
[Open questions](#the-closed-set-may-be-in-the-wrong-directory).

## The two real findings, fixed through the builder

### 1. `domain/src/runtime/adapter.ts` — a wire record was never validated

The brief called this a real finding. It is a bigger one than the compile error
suggests, and the compile error is what exposed it.

`commandFailure`'s `reported` argument is `result.failure` from
`dispatchWebAutomationOutput`, which is the record the **browser client sent
over the WebSocket**. It was passed straight into the classifier, which returns
a producer's record unchanged, and from there into Core's runtime command
result and its attempt trace. Nothing ever checked that its `code` was a code
this domain names — although Core's own contract on that type says to validate
anything that crossed a process boundary, and the content script's `results.ts`
already does exactly this check on a record read off a thrown value.

The proof that it mattered is in the repository's own test suite:
`adapter.test.ts` asserted that a client record carrying
`web.action.output_not_observed` — a string that is in no allowlist and is not
the set's `web.validation.output_not_observed` — **reached the runtime result
unaltered**, and called that the correct behaviour.

The fix is `clientReportedFailure`, at that boundary:

- A code in the set is **rebuilt through `webAutomationFailureRecord`** rather
  than trusted field by field, so the category, the retryable flag and the stage
  come from the code's own row. A client one version behind cannot pair a code
  with a category its row forbids and have Core's parser drop the whole record —
  which loses the failure rather than misreporting it. Everything only the
  sender could know (`expected`, `actual`, `evidenceDigest`) is carried across
  untouched.
- A code the domain does not name becomes **UNKNOWN carrying the code it used**,
  beside whatever the client observed:
  `"the field is empty; unrecognized web automation failure code: web.action.output_not_observed"`.
  That is the answer `classifyWebAutomationFailure` already gives a runtime error
  whose code is outside the set (its rule 3), and the same drift arriving by
  another route deserves the same answer. Dropping the record silently would
  have hidden the one signal that a client is emitting codes nobody reads.

`commandFailure` now returns the narrowed record too, so everything leaving the
adapter for Core carries a set code.

**This is a behaviour change on the wire**, and the only one in this brief. It
is recorded under [Not verified](#not-verified) as well, because no live client
was in the loop.

### 2. `apps/extension/src/runtime/tests/result-mapping.test.ts:147` — the fixture

A failure record written out by hand in a test fixture, whose `code` inferred as
`string`. It is now built the way a producer builds one:

```ts
const failure = webAutomationFailureRecord(WEB_AUTOMATION_FAILURE_CODES.OUTPUT_NOT_OBSERVED, {
  expected: "the field to read back \"shoes\"",
  actual: "the field is empty"
});
```

Not a cast, and not `as const` either: building it through the builder also
stops the fixture's category, retryable flag and stage from drifting away from
the code's row while the row goes on passing. The assertions are unchanged and
still deep-equal the whole record and round-trip it through Core's parser.

## The compiler proof

Both pins were written as permanent test rows carrying `@ts-expect-error`, then
the directive was removed from each and `check` run, so the error is quoted from
a real run rather than described. The directives were restored immediately and
both packages are green as I leave them.

**Extension** — a `BrowserActionResult` carrying a record written out by hand,
the same literal `w3-protocol-narrowing` used:

```text
src/runtime/tests/result-mapping.test.ts(168,46): error TS2322: Type
'"web.assert.state_mismatch"' is not assignable to type 'WebAutomationFailureCode'.
```

**Domain** — a `WebAutomationFailureRecord` written out by hand:

```text
src/runtime/failure/tests/codes.test.ts(119,5): error TS2322: Type
'"web.assert.state_mismatch"' is not assignable to type 'WebAutomationFailureCode'.
```

Both `check` runs exit **2**. The same literal compiled at **exit 0** before this
change; `w3-protocol-narrowing` measured that and so did I, from the same tree.

With the directives in place both packages are exit 0 — and that is itself the
guard, because TypeScript fails an *unused* `@ts-expect-error`. If someone
widens `code` back to `string`, these two rows stop erroring and `check` fails
on the unused directive. The invariant now defends itself in both packages
rather than living in a report.

## What changed

Nine files. No file gained a cast, and no `as` was written anywhere in this
change.

| File | Change |
| --- | --- |
| `domain/src/runtime/failure/codes.ts` | `WebAutomationFailureRecord` added; the builder returns it |
| `domain/src/runtime/failure/classify.ts` | `classifyWebAutomationFailure` returns it; `WebAutomationActionOutcome.failure` takes it; Core's record no longer imported |
| `domain/src/actions/types.ts` | `WebAutomationActionResult.failure` is the narrowed record — the one narrowing every consumer inherits |
| `domain/src/runtime/adapter.ts` | `clientReportedFailure`: the wire boundary validates and rebuilds; `commandFailure` returns the narrowed record |
| `domain/src/runtime/failure/tests/codes.test.ts` | the domain-side `@ts-expect-error` pin, with the runtime guard asserted beside it |
| `domain/src/runtime/failure/tests/classify.test.ts` | the "producer already reported" fixture is now a set record |
| `domain/src/runtime/tests/adapter.test.ts` | the stale out-of-set expectation corrected; two rows added for the boundary's two new answers |
| `apps/extension/src/runtime/tests/result-mapping.test.ts` | the hand-built fixture goes through the builder; the protocol-side `@ts-expect-error` pin |
| `apps/extension/src/shared/protocol.ts` | **unmodified** — see above |

Three new test rows, all passing: the two pins, and
`"a client record whose category contradicts its code is rebuilt from the code's own row"`.
One existing row was corrected from asserting the defect to asserting the fix,
and one was renamed in substance:
`"a client record naming a code this domain does not own becomes UNKNOWN, carrying the code it used"`.

The surface-pinning row in `validation-outcome.test.ts` was **not removed**, and
neither file in `content/action-runtime/` was edited. `w3-protocol-narrowing`'s
reasoning survives this change intact: `results.ts` reads a record off a thrown
value, which no compiler can vouch for, so `isWebAutomationFailureCode` there is
a genuine runtime guard. The adapter fix above is the same argument applied to
the WebSocket boundary, which had no such guard at all.

## Commands run and observed results

`EXTENSION_TEST_BUILD_LABEL=w3-failure-code-invariant` and
`DOMAIN_TEST_BUILD_LABEL=w3-failure-code-invariant` were set for every package
command. Exit status was captured by redirecting to a file and echoing `$?`,
never through a pipe. No `pnpm build`, no `pnpm lab`, no
`pnpm structure:baseline`, no commit, nothing staged in the real index.

| Command | Exit | Observed |
| --- | --- | --- |
| extension `check` — baseline, before any edit | **0** | no diagnostics |
| domain `check` — baseline | **0** | no diagnostics |
| domain `check` — narrowing only | **2** | **one** error, `src/runtime/adapter.ts(169,9)`, `TS2322`, `AutomationStudioFailureRecord` → `WebAutomationFailureRecord`. Exactly the measured prediction |
| domain `check` — after the adapter fix | **2** | one error, `src/runtime/failure/tests/classify.test.ts(25,71)`: a fixture, in the test project the earlier run never reached because `&&` stops at the first project |
| domain `check` — after the fixture fix | **0** | |
| extension `check` — with the domain narrowed, nothing else | **2** | **one** error, `src/runtime/tests/result-mapping.test.ts(147,121)`. The `src` project compiled clean: all 13 honest producers needed no change |
| extension `check` — after the fixture fix | **0** | |
| **Proof A** — extension pin with `@ts-expect-error` removed | **2** | `result-mapping.test.ts(168,46): error TS2322: Type '"web.assert.state_mismatch"' is not assignable to type 'WebAutomationFailureCode'`. Restored |
| **Proof B** — domain pin with `@ts-expect-error` removed | **2** | `codes.test.ts(119,5): error TS2322`, same message. Restored |
| domain `test` — first run after the adapter fix | **1** | `# pass 254 / # fail 1`: `not ok 212`, the stale expectation, with the diff quoted below. Corrected |
| domain `test` — final | **0** | `# tests 257 / # pass 257 / # fail 0` |
| extension `test` — final | **0** | `# tests 216 / # pass 216 / # fail 0` |
| `pnpm exec playwright test -c e2e/playwright.content.config.ts --workers=4` | **0** | `185 passed (22.5s)`, no retries, no flake |
| test-runner `check` | **0** | it is the only other package depending on the domain; its allowlist derives from the code set |
| domain `check` + extension `check` — final, after the last comment edit | **0** / **0** | |
| `node scripts/structure-audit.mjs`, scratch `GIT_INDEX_FILE`, this report staged | **0** | `structure-audit: passed`; no finding names a file I touched |

The failing domain row, quoted because it is the finding rather than a
regression:

```text
not ok 212 - the client's structured failure record reaches the runtime result
  error: |-
    Core classifies from the record before it matches the message
    + actual - expected
      {
    +   actual: 'unrecognized web automation failure code: web.action.output_not_observed',
    +   category: 'ambiguous_or_unknown',
    +   code: 'web.action.unknown',
    +   retryable: false,
    +   stage: 'execution'
    -   category: 'output_not_observed',
    -   code: 'web.action.output_not_observed',
    -   retryable: true
      }
```

The expected side is what the repository asserted was correct: a code in no
allowlist, reaching Core untouched.

File sizes, all far under the 400-line advisory and none of them baselined:
`actions/types.ts` 352, `runtime/adapter.ts` 302, `failure/codes.ts` 169,
`failure/classify.ts` 141, `tests/codes.test.ts` 132,
`tests/classify.test.ts` 98, `runtime/tests/adapter.test.ts` 306,
`result-mapping.test.ts` 228. No file was added, so no directory's file count
moved, and no baselined file grew.

## Not verified

- **No live browser validation.** Nothing in the extension's `src` changed at
  all — the only extension file I edited is a unit test — so there is no new
  browser behaviour to exercise on that side. The content harness (real content
  bundle, real Chromium, Scenario Lab fixtures, no background worker and no
  gateway) passed whole.
- **The adapter's behaviour change was not exercised against a real client.**
  `clientReportedFailure` runs on the Node side, on a record that arrived over a
  live WebSocket. Both new answers are covered by unit rows driving the real
  adapter against a stubbed gateway, but no paired extension sent either shape.
  The one shape a **current** extension sends is a set code with the code's own
  category, which the rebuild reproduces byte for byte — asserted by
  `"a client's own failure record survives the hop and only gains the digest"`,
  which passed unmodified.
- **Whether any client still emits `web.action.output_not_observed`.** The
  string is gone from this repository's source; a client build older than Wave 3
  in someone's browser would now be reported as UNKNOWN naming its code, rather
  than as `output_not_observed`. That is the intended answer, but it is a
  downgrade in fidelity for an old client and worth knowing before release.
- **`pnpm check`, `pnpm test` and `pnpm build` at repository scope** were not
  run. The structure audit, which root `check` runs first, was run directly;
  every package that depends on the domain was checked individually.
- **Firefox.** Nothing here is browser-specific and no Firefox build was loaded.
- **Whether Core reads the failure `stage`.** The rebuild can change a client
  record's stage (only when the client contradicted its own code). Category and
  retryable, which Core's retry path reads, only ever move onto the code's row.

## Open questions or contradictions found

### `resolve-target.ts` still types its record as Core's

`apps/extension/src/content/action-runtime/resolve-target.ts:100` declares
`readonly failure: AutomationStudioFailureRecord` on `TargetResolutionError`.
It compiles, because it is only ever assigned a builder's output and is read
back through `results.ts`'s runtime guard, so nothing is broken. But it is the
last place in the extension where a failure record is typed as Core's rather
than as the domain's, and it is the one a future edit could hand a hand-built
record to. One word, in a file I do not own and another worker is editing.

`domain/src/client/gateway-mapping.ts` has two more —
`WebAutomationActionRejection.failure` and `UNSUPPORTED_ACTION_TYPE_FAILURE`,
which is a frozen record written out by hand with a code that happens to be in
the set. Same argument: it compiles, it is correct today, and it is unpinned.
Both are one-line changes for whoever owns those files next.

### The closed set may be in the wrong directory

`WEB_AUTOMATION_FAILURE_CODES` lives under `domain/src/runtime/failure/`, but it
is part of the action **vocabulary** — what a result may say — as much as of the
runtime. That is why `actions/types.ts` now has to reach into `runtime/` for a
type, and why `runtime/failure/codes.ts` already reaches back into `actions/`
for the text bound. Neither direction is wrong on its own; together they say the
two modules describe one thing kept in two places. Moving the code set to
`domain/src/actions/failure/`, or moving the text bound to sit beside it, would
leave a single direction of dependency. Out of scope here, and not urgent: the
type import is erased and the value import is one constant.

### The brief's file list was wider than the change needed

Owns listed six files; the change touched four of them plus three tests, and
`protocol.ts` — the file three previous briefs were drawn around — turned out to
need nothing once the narrowing went to the declaration rather than to the
alias. Worth recording as the counterpart to the last report's finding: that
brief was drawn too narrowly around a file, and the fix was to draw the next one
around the change. Drawing it around the change is what let the smaller answer
be found.

### The repository's own test asserted the defect

`adapter.test.ts`'s "the client's structured failure record reaches the runtime
result" was written before the closed set existed and was never revisited when
Wave 3 landed it, so a green suite was asserting that an unnameable code
reaching Core is correct. Nothing caught it because nothing could: the
expectation and the behaviour agreed. It is the second time in this wave a test
has been found pinning the pre-set vocabulary (the first was the `web.tab.*`
strings in `w3-worker-codes`), and it is worth one grep of the remaining
fixtures for wire strings that are not in `WEB_AUTOMATION_FAILURE_CODES`,
because a code written out in a test is exactly the shape the compiler could
not see until now.
