# Report: w3-protocol-narrowing

Worker: `w3-protocol-narrowing`. Wave 3, added after dispatch: shut the door
three workers found from three directions (narrow the failure record's `code`),
and take the supervisor's decision to delete the assert verb's redundant
`stateMismatchFailure` override.

## Outcome

**Partial.**

- **Task 2 is done**, with the replacement coverage the brief required, a
  mutation proof that the new row catches the override coming back, and the
  `failures.spec.ts` question answered: **no row depends on the override**, so
  no spec needed editing and none was touched.
- **Task 1 is blocked, and the brief's premise is wrong in a way that matters.**
  The failure record's `code` is **not** declared in
  `apps/extension/src/shared/protocol.ts`. That file's only `code: string` is
  `RecordingBlockState`, an unrelated recording-block reason. The failure record
  is Core's `AutomationStudioFailureRecord`, reached through
  `domain/src/actions/types.ts`. I can still narrow it *at the extension's seam*
  — I wrote the type and it works — but the change does not compile without a
  matching narrowing of the **domain builder's return type**, and `domain/**` is
  in my Must-not-touch. Ownership was drawn around the file the earlier report
  pointed at rather than around the change, which is the defect the wave's
  binding rules tell me to report instead of widening silently.

Both compile proofs the brief asked for were run and are quoted. I also measured
the full patch — protocol narrowing plus the domain lines — end to end, then
reverted it, so the supervisor has a sized change rather than a guess: it takes
the extension from **14 errors to 1**, and that last one is a hand-built record
in a test fixture, which is exactly what the narrowing exists to catch.

Extension `check` **exit 0**, `test` **exit 0** (209/209), content harness
**184 passed / 1 failed** on a row I do not own with the machine's known
load signature. Structure audit **exit 0**, no finding naming a file I touched.

`apps/extension/src/shared/protocol.ts` is unmodified in the tree I leave
behind. The patch that belongs in it is saved and reproduced in full below.

## Task 1 — the closed set is not actually closed

### Where the type really lives

The brief says to narrow `code` "on the protocol's failure record type in
`apps/extension/src/shared/protocol.ts`". There is no such declaration. The
chain is three links long and only the first is in this repository's extension:

| Where | What it says |
| --- | --- |
| `apps/extension/src/shared/protocol.ts:332` | `BrowserActionResult = WebAutomationActionResult<DomElementDescriptor, DomSnapshot>` |
| `domain/src/actions/types.ts:274` | `failure?: AutomationStudioFailureRecord \| undefined` |
| Core `packages/contracts/src/failure/record.ts:29` | `code: string` |

Core's comment on that line is deliberate and correct: *"Core owns the category
names; the producer owns `code`."* Core cannot name web-automation codes, so
`string` is right **in Core**. The narrowing belongs to the producer side, and
the producer side is the domain and this extension — not Core. No Core change is
needed or wanted, and I made none.

### Proof the door is open

`assert.ts`'s `stateMismatchFailure` replaced by a hand-built record literal
using the out-of-set code `"web.assert.state_mismatch"` — the exact string the
verb used to emit — with **nothing else changed**:

```ts
const MUTATION_PROOF_HAND_BUILT_RECORD: FailureRecord = {
  category: "unexpected_state",
  code: "web.assert.state_mismatch",
  retryable: false,
  stage: "verification"
};
```

`pnpm --filter @fluxiq-web-extension/extension check` → **exit 0**:

```text
> tsc -p tsconfig.json --noEmit && tsc -p tsconfig.test.json
```

No diagnostics at all. `w3-assert-timing` was right, and the supervisor's Wave 3
claim that out-of-set codes can no longer reach the wire is false for any record
written as a literal. Restored.

### Proof the narrowing shuts it

The same literal, with `BrowserActionResult`'s `failure` narrowed in
`protocol.ts`. `check` → **exit 2**, and the compiler said exactly:

```text
src/content/actions/assert.ts(142,3): error TS2322: Type
'"web.assert.state_mismatch"' is not assignable to type
'WebAutomationFailureCode'.
```

So the narrowing does the job it was asked to do. It is the other thirteen
errors in the same run that block it.

### Why it cannot land inside this brief's ownership

With the literal removed and only the narrowing in place, `check` is **exit 2**
with **14 errors in 4 files**, and every one is the same cause:

```text
src/content/action-runtime/results.ts(85,5): error TS2375: Type
'AutomationStudioFailureRecord' is not assignable to type
'Omit<AutomationStudioFailureRecord, "code"> & { code: WebAutomationFailureCode; }'
with 'exactOptionalPropertyTypes: true'.
  Type 'AutomationStudioFailureRecord' is not assignable to type '{ code: WebAutomationFailureCode; }'.
    Types of property 'code' are incompatible.
      Type 'string' is not assignable to type 'WebAutomationFailureCode'.
```

| File | Errors |
| --- | --- |
| `src/content/action-runtime/results.ts` | 85, 130, 159, 176, 188, 222 |
| `src/content/actions/assert.ts` | 137 (deleted by Task 2) |
| `src/runtime/action-results.ts` | 98, 107, 123, 134, 145 |
| `src/runtime/action-runner.ts` | 260, 286 |

**Not one is a hand-built record.** Every site is a correct producer calling
`webAutomationFailureRecord(WEB_AUTOMATION_FAILURE_CODES.X, …)`. They fail
because that function is declared to *return* `AutomationStudioFailureRecord`,
so its `code` is `string` on the way out even though its parameter is the closed
union on the way in. The builder throws the type away one line after checking
it.

The only ways to make these 13 compile are (a) narrow the builder's return type
in the domain, or (b) write `as BrowserActionFailure` at all 13 sites. (b) would
put a cast at every honest producer in order to catch a dishonest one — it
weakens the seam it is meant to strengthen, and it means editing four files I do
not own. So I did neither, per "do not widen your ownership to make `check`
green", and reverted `protocol.ts`.

### The patch, measured

I applied the whole change — protocol plus domain — ran both packages' `check`,
and reverted it in a single command, so the tree was inconsistent for under two
minutes and is clean now (`git status` shows no modification to
`apps/extension/src/shared/protocol.ts` or `domain/src/runtime/failure/`).

**The extension half** (mine to own; the exact text is
`scratchpad/protocol-narrowing.patch`, and it is reproduced at the end of this
report):

```ts
export type BrowserActionFailure =
  Omit<NonNullable<WebAutomationActionResult["failure"]>, "code"> & { code: WebAutomationFailureCode };

export type BrowserActionResult =
  Omit<WebAutomationActionResult<DomElementDescriptor, DomSnapshot>, "failure"> & { failure?: BrowserActionFailure | undefined };
```

plus `type WebAutomationFailureCode` on the existing
`@fluxiq-web-extension/domain/client` import. It needs no Core import:
`NonNullable<WebAutomationActionResult["failure"]>` is the record shape already.

**The domain half** (three edits, in `domain/src/runtime/failure/`):

1. `codes.ts` — add
   `export type WebAutomationFailureRecord = Omit<AutomationStudioFailureRecord, "code"> & { code: WebAutomationFailureCode };`
2. `codes.ts` — `webAutomationFailureRecord`'s return type
   `AutomationStudioFailureRecord` → `WebAutomationFailureRecord`.
3. `classify.ts` — the same on `classifyWebAutomationFailure`'s return type and
   on `WebAutomationActionOutcome.failure` (the "a producer already classified
   this" field, so narrowing it is the honest reading), plus the type import.

**Observed with all four applied:**

- `pnpm --filter @fluxiq-web-extension/domain check` → **exit 2**, one error:

  ```text
  src/runtime/adapter.ts(169,9): error TS2322: Type '{ failure?: AutomationStudioFailureRecord; … }'
  is not assignable to type 'WebAutomationActionOutcome'.
    Types of property 'failure' are incompatible.
      Type 'AutomationStudioFailureRecord' is not assignable to type 'WebAutomationFailureRecord' …
        Type 'string' is not assignable to type 'WebAutomationFailureCode'.
  ```

- `pnpm --filter @fluxiq-web-extension/extension check` → **exit 2**, and it has
  gone from **14 errors to 1**:

  ```text
  src/runtime/tests/result-mapping.test.ts(147,121): error TS2322: Type
  '{ category: "output_not_observed"; code: string; retryable: boolean; stage: "verification";
    expected: string; actual: string; }' is not assignable to type 'BrowserActionFailure'.
      Types of property 'code' are incompatible.
        Type 'string' is not assignable to type 'WebAutomationFailureCode'.
  ```

  That last one is **the narrowing working**: a record built by hand in a test
  fixture, whose `code` widened to `string`, caught by the compiler for the
  first time. It wants `as const` or the constant, not a cast.

So the true scope is five files: `protocol.ts` (mine),
`domain/src/runtime/failure/{codes,classify}.ts`, `domain/src/runtime/adapter.ts`,
and `apps/extension/src/runtime/tests/result-mapping.test.ts`. Four of the five
are outside this brief. The supervisor can land it as one small change; it
cannot be partitioned to a worker who owns only `protocol.ts`.

### The wire boundary the brief asked me to check

**There is no inbound failure record.** I traced every direction a record moves:

- **Gateway → extension** carries *commands* (`execute_action`), never results.
  `browserActionFromGatewayCommand` maps a command; nothing parses a result in.
- **Extension → gateway** is outbound and already erases the type:
  `gatewayActionResultFromBrowserResult` calls
  `webAutomationActionResultPayload(result as never)`, so narrowing changes
  nothing there.
- **Content script → background** is the one unchecked runtime crossing:
  `runtime/action-runner.ts:214` does `sendToTab<BrowserActionResult>(…)`, a
  type argument over a `chrome.tabs.sendMessage` reply. Every producer on the
  other side is compile-checked extension code in the same build, so the claim
  holds by construction rather than by validation — but it is an assertion, and
  worth naming as one.
- **A thrown value** is the genuinely untrusted case, and it is **already
  guarded at runtime**: `results.ts`'s `reportedFailure` reads `error.failure.code`
  structurally and runs `isWebAutomationFailureCode` on it before trusting the
  record. That is the right shape and it is already in place.

So narrowing here is a compile-time claim about values written in source, which
is exactly what it can honestly be. It is not standing in for validation of
external data, because no external data arrives in this shape.

### The surface-pinning test: kept, and why

Two corrections first. The brief says the test "currently fails by design
(`not ok 92`)". It does not: the baseline before I touched anything was
`# tests 197 / # pass 197 / # fail 0`, exit 0. Reading `w3-assert-timing`'s
report again, `not ok 92` was observed **only under its mutation C**, with
`rejectionFailure` reintroduced; it reverted and the suite went green. The row
is a working guard, not a failing one.

**Decision: keep it, and it is not redundant.** The brief offered redundancy as
a possibility conditional on "once the compiler enforces this" — and the
compiler does not, because Task 1 is blocked. Today it is the *only* thing
standing between the content bundle and a reintroduced builder minting
`web.action.${suffix}`.

It also would not be made redundant by the runtime/wire argument, since there is
no inbound record (above). What *would* retire it is the domain patch landing,
at which point a builder returning a record with a free-form code could not be
assigned anywhere a result can carry it. I recorded that condition in the test's
own comment so whoever lands the patch finds the note, rather than leaving it to
a report nobody reads at that moment.

I updated the comment on the row and on `validation-outcome.ts`'s header to say
what was measured rather than what was assumed. The previous comment claimed "an
invented string cannot compile at the sites that remain", which is true of
*call* sites and false of *record literals*; that overstatement is part of how
the door stayed open. No assertion changed.

## Task 2 — the override is gone

### What changed

`apps/extension/src/content/actions/assert.ts` loses `stateMismatchFailure`, the
local `FailureRecord` alias, and two imports. The tail of the happy path went
from

```ts
const result = deps.success(action, startedAt, message, validation, evidence);
return outcome.held ? result : { ...result, failure: stateMismatchFailure(result.validation) };
```

to `return deps.success(action, startedAt, message, validation, evidence);`.
141 lines → 142 (the prose grew as the code shrank).

The two records were identical whenever the auth-gate hook had not fired —
`results.ts`'s `unobservedOutputCode` already maps `web.dom.assert` to
STATE_MISMATCH, and both built from the same bounded validation — so this is a
no-op on every path except the one where it was lossy.

The header now carries the reasoning: why the verb builds no record, what
`authGateFailure` does, why AUTH_REQUIRED and STATE_MISMATCH are not
interchangeable, and the two facts the deleted doc comment held that are worth
keeping (the kind of claim is not in the code, and retryability is the set's
judgement rather than this verb's).

### `failures.spec.ts`: no row depends on the override

I read the spec. Ten rows, and the only one that touches `web.dom.assert` is:

```ts
test("the control: a target that is present on the gate page fails as itself, not as AUTH_REQUIRED", …
  actionType: "web.dom.assert", selector: SIGN_IN_FORM, assert: { kind: "absent", timeoutMs: 200 }
  expect(reply.failure?.code).not.toBe(WEB_AUTOMATION_FAILURE_CODES.AUTH_REQUIRED);
```

It cannot depend on the override, because `authGateFailure` requires
`selectorMatchesNothing(action.selector)` and this row's selector matches the
sign-in form on purpose — that is the point of the row, that both halves of the
gate rule are required. The hook never fires, so the override had nothing to
discard and its removal changes nothing. It passed unmodified, twice.

The other auth-gate row uses `web.dom.click`, which never had the override. **No
spec was edited and none needed to be.**

### Replacing the coverage before removing it

The brief's condition. What was lost, precisely: three rows in
`content/actions/tests/assert.test.ts` asserted the record the *verb* built,
because the stub's `success` built none, so the verb's own record was the only
one in the result.

The property those rows proved has moved, so restating it would have been
theatre. It was "the record this verb writes comes from the closed set". It is
now **"this verb writes no record"** — which is strictly stronger, because it is
what makes the builder's decision, whatever it turns out to be, the one that
reaches the wire.

Four changes to the test file, `ok 100`–`ok 107` in the final run:

- **The stub's builders now build a record**, the way `results.ts` does: through
  `webAutomationFailureRecord`, TIMEOUT for a `timed_out` result and
  STATE_MISMATCH for a failed `web.dom.assert` post-condition. Without this the
  file could not tell "the verb added nothing" from "nothing was there".
- **One new row, `ok 102`, is the replacement proof**: the stub is handed an
  **AUTH_REQUIRED** record — a code no assert path could ever choose for itself,
  so its presence at the caller can only mean the verb passed the builder's
  record through untouched — and the row asserts the whole record arrives
  identical and survives Core's parser. This is the regression guard for the
  exact defect the removal fixes.
- **`ok 104` got stronger rather than weaker.** It used to assert
  `result.failure === undefined` on the timeout path, which was only true
  because the stub built nothing. It now asserts the builder's **TIMEOUT** is
  what arrives, which is what the row's own comment always claimed it was for.
- The remaining rows are unchanged in substance; `ok 101` still deep-equals the
  whole STATE_MISMATCH record and round-trips it through
  `parseAutomationStudioFailureRecord`.

The honest limit, stated in the file: a stub that reproduces `results.ts`'s rule
is not a check *on* `results.ts`. If `unobservedOutputCode` changed, this file
would not notice. What notices is `e2e/content/tests/check-assert.spec.ts`,
which asserts the whole record against the real builder on a real page for five
kinds — and which I ran, 14/14, twice.

### The mutation proof

The override reinstated verbatim (same `webAutomationFailureRecord` call on
`result.validation`), nothing else changed. Unit suite → **exit 1**,
`# pass 202 / # fail 1`, exactly one row, and the diff is the clobber itself:

```text
not ok 102 - the verb returns the record the builder made, whatever it is, and never one of its own
  error: |-
    the builder's record reached the caller unchanged
    + actual - expected
      {
    +   actual: 'https://example.test/sign-in',
    +   category: 'unexpected_state',
    +   code: 'web.validation.state_mismatch',
    +   expected: 'the address https://example.test/order',
    -   actual: 'nothing matched "#status"; the document is a sign-in gate, so the session has probably expired',
    -   category: 'auth_required',
    -   code: 'web.auth.required',
    -   expected: 'an element matching "#status"',
        retryable: false,
    +   stage: 'verification'
    -   stage: 'confirmation'
      }
```

`auth_required` / `confirmation` becoming `unexpected_state` / `verification` is
the operator being sent to the wrong place, printed. Reverted; suite back to
green.

## Commands run and observed results

`EXTENSION_TEST_BUILD_LABEL=w3-protocol-narrowing` was set for every command
(`DOMAIN_TEST_BUILD_LABEL` too, for the one domain measurement). Exit status was
captured by redirecting to a file and echoing `$?`, never through a pipe. No
`pnpm build`, no `pnpm lab`, no `pnpm structure:baseline`.

| Command | Exit | Observed |
| --- | --- | --- |
| `check` — baseline, before any edit | **0** | no diagnostics; the tree I started from was green |
| `test` — baseline | **0** | `# tests 197 / # pass 197 / # fail 0`. `not ok 92` was **not** failing |
| **Proof A** — hand-built out-of-set record literal, no narrowing; `check` | **0** | **no diagnostics** — the finding |
| **Proof B** — same literal, with the narrowing; `check` | **2** | `assert.ts(142,3): error TS2322: Type '"web.assert.state_mismatch"' is not assignable to type 'WebAutomationFailureCode'` |
| Narrowing alone (literal removed); `check` | **2** | 14 errors in 4 files, all `AutomationStudioFailureRecord` → narrowed; table above. Reverted |
| **Measured patch** — narrowing + 3 domain edits; domain `check` | **2** | one error, `adapter.ts(169,9)`. Reverted |
| **Measured patch** — same; extension `check` | **2** | **one** error, `runtime/tests/result-mapping.test.ts(147,121)`, a hand-built fixture record. Reverted |
| `check` after Task 2 | **0** | no diagnostics |
| `test` after Task 2 | **0** | `# tests 203 / # pass 203 / # fail 0`; my rows `ok 100`–`ok 107` |
| **Mutation** — override reinstated; `test` | **1** | `# pass 202 / # fail 1`, exactly `not ok 102`, diff above. Reverted |
| `check` — final | **0** | first attempt was exit 2 with four errors in `content/action-runtime/resolve-target.ts` and `content/identity/` (`scoreTargetCandidates`, `CandidateSelection` not exported); reran once per the binding rules and it was **0**. Another worker mid-edit, no file of mine named |
| `test` — final | **0** | `# tests 209 / # pass 209 / # fail 0` (the count rose from 203 as other workers landed rows) |
| `playwright -c e2e/playwright.content.config.ts check-assert.spec.ts failures.spec.ts --workers=4` | **0** | `24 passed (5.2s)` — 14/14 and 10/10, including the auth-gate control row |
| Whole content harness `--workers=4` (after Task 2) | **0** | `181 passed (30.6s)` |
| Whole content harness `--workers=4` — final | **1** | `180 passed / 1 failed`: `failures.spec.ts:195` *on navigation*, `Tearing down "openHarness" exceeded the test timeout of 30000ms`, no assertion diff |
| Whole content harness `--workers=4` — rerun | **1** | `184 passed / 1 failed`: a **different** row, `evidence.spec.ts:241` *infinite-feed*, same teardown timeout plus `ENOENT` on trace artifacts. check-assert 14/14 and failures.spec 10/10 both green |
| `node scripts/structure-audit.mjs` with a scratch `GIT_INDEX_FILE` | **0** | `structure-audit: passed (28 warning(s), 19 baselined)`. `grep` over the output finds no line naming `assert`, `validation-outcome` or `protocol` |
| Same, with this report staged in the scratch index | **0** | `structure-audit: passed (29 warning(s), 19 baselined)`. `diff` against the run above shows the single added line is **another worker's**: `warn [file-lines] apps/extension/src/content/action-runtime/resolve-target.ts: 403 lines is past the 400-line advisory threshold` — it crossed 400 between my two runs. The report itself adds no finding |

The two harness failures are the load signature the brief described: a 30-second
teardown timeout with no assertion diff, on a different row each run, neither in
a file I own, and the second one carrying `ENOENT` on Playwright's own trace
files. `failures.spec.ts:195` passed in the targeted run and in the rerun; the
`evidence.spec.ts` row belongs to another worker's brief.

The scratch index was a copy of `.git/index` under the session scratchpad; the
real index was never written (`git diff --cached --name-only` is empty). No file
was added, so no directory's file count moved. File sizes: `assert.ts` 142,
`assert.test.ts` 268, `validation-outcome.ts` 66, `validation-outcome.test.ts`
99 — all far under the 400-line advisory, and no baselined file grew.

## Not verified

- **The narrowing itself is not in the tree.** Everything I claim about it was
  measured and then reverted. What is committed-ready is Task 2 only.
- **The measured patch's `test` runs were not done**, only `check`. I reverted as
  soon as both compiles had reported, to keep the window short. Whoever lands it
  should run domain `test` too — `classify.test.ts` builds outcome objects with
  a `failure` field and may need the same widening at its fixtures.
- **No live browser validation.** The content harness is the real content-script
  bundle in real Chromium on Scenario Lab fixtures, with no background worker,
  no tab routing and no gateway. In particular, **the AUTH_REQUIRED path this
  change preserves for `web.dom.assert` is not exercised anywhere**: the edge
  needs a `url` or `absent` claim carrying a selector that matches nothing on a
  page that is a sign-in gate, and no fixture row does that. `ok 102` proves the
  verb passes such a record through; nothing proves `results.ts` produces one
  for an assert command on a real gate page. That is the one gap I would close
  next, and it is a spec row in `failures.spec.ts`, which I do not own.
- **`pnpm check`, `pnpm test` and `pnpm build` at repository scope** were not
  run. The structure audit, which root `check` runs first, was run directly.
- **The domain and test-runner packages** were not tested. I own no file in
  either and left both as I found them.
- **The whole-harness numbers are a snapshot.** Other workers were editing
  `resolve-target.ts`, `content/identity/`, `connection.ts` and
  `recording-evidence.ts` throughout, and the unit count moved from 197 to 209
  underneath me.
- **Firefox.** Nothing here is browser-specific, but no Firefox build was loaded.

## Open questions or contradictions found

### The brief named the wrong file, and the earlier report named it first

`w3-assert-timing` wrote that the fix is "narrowing `code` on the failure record
in `apps/extension/src/shared/protocol.ts` … from `string` to the domain's
`WebAutomationFailureCode`", and the brief carried that forward as fact. The
record is not declared there and `protocol.ts` does not type any `code` as
`string` except `RecordingBlockState`'s. The reasoning about *what* to do was
right; only the location was wrong, and the location is what decided ownership.
Worth noting because the same slip appeared in Wave 3 before — that report also
found its brief naming `assert-conditions.ts`, a file that does not exist.

### Three workers have now hit this seam and no brief can own it as drawn

`w3-worker-codes` narrowed four builders' parameters, `w3-extension-gaps`
reported the same wall, `w3-assert-timing` proved the door open, and this brief
was written to close it. It cannot be closed from the extension alone, because
the escape is in the domain builder's *return* type, not in any extension file.
Any future brief for this should own
`domain/src/runtime/failure/{codes,classify}.ts`, `domain/src/runtime/adapter.ts`,
`apps/extension/src/shared/protocol.ts` and
`apps/extension/src/runtime/tests/result-mapping.test.ts` together — five files,
one change, verified above at one remaining error in each package.

### `webAutomationFailureRecord` checks its code and then discards the check

This is the root cause in one sentence, and it is worth stating separately from
the fix. The function's parameter is `WebAutomationFailureCode`; its return type
is `AutomationStudioFailureRecord`, whose `code` is `string`. The closed set is
verified at the door and forgotten one line later, so every value downstream of
the only place that ever checks it is unchecked again. That is why `results.ts`
needs `isWebAutomationFailureCode` at runtime to re-establish something the
builder already knew.

### A test fixture is already writing a record by hand

`apps/extension/src/runtime/tests/result-mapping.test.ts:147` builds a failure
record inline whose `code` infers as `string`. It compiles today and is the
single error left under the measured patch. It is harmless — a fixture, not a
producer — but it is the first real instance of the pattern the narrowing
targets, and it should be fixed as part of the same change rather than cast away.

### `results.ts` is the file that actually decides this verb's code

With the override gone, `web.dom.assert`'s STATE_MISMATCH is chosen entirely by
`unobservedOutputCode` in `content/action-runtime/results.ts`, which has **no
Node test of its own** — the module reads `location`, `document` and the capture
settings at import, so it cannot run in the unit suite as written. Its rules are
proven only through the harness. Nothing is wrong today, but the mapping every
verb's failure code depends on has no cheap test, and pulling the DOM-free
decisions out of it (as `validation-outcome.ts` already does for status and text
bounding) would give it one.

### The patch, in full, for whoever lands it

`apps/extension/src/shared/protocol.ts`, on the existing
`@fluxiq-web-extension/domain/client` import add `type WebAutomationFailureCode`,
then replace the `BrowserActionResult` line with:

```ts
export type BrowserActionFailure =
  Omit<NonNullable<WebAutomationActionResult["failure"]>, "code"> & { code: WebAutomationFailureCode };

export type BrowserActionResult =
  Omit<WebAutomationActionResult<DomElementDescriptor, DomSnapshot>, "failure"> & { failure?: BrowserActionFailure | undefined };
```

`domain/src/runtime/failure/codes.ts`: add
`export type WebAutomationFailureRecord = Omit<AutomationStudioFailureRecord, "code"> & { code: WebAutomationFailureCode };`
and change `webAutomationFailureRecord`'s return type to it.
`domain/src/runtime/failure/classify.ts`: the same type on
`classifyWebAutomationFailure`'s return and on `WebAutomationActionOutcome.failure`,
plus the import. Then `domain/src/runtime/adapter.ts:169` and
`apps/extension/src/runtime/tests/result-mapping.test.ts:147`, one each.

### The commit warning in the brief held

Nothing was committed and nothing was staged. `git diff --cached --name-only`
is empty. Every mutation in this report was applied and reverted within a single
tool call or an adjacent pair, and the tree is green as I leave it — but two of
those windows contained a deliberately broken compile, so the earlier report's
request stands: do not commit while a worker is running.
