# Report: v-error-seam

Worker: `v-error-seam`. Closing the seam two open questions circled: the
`WebAutomationRuntimeError` class with no producer, unreachable from the one
consumer that would produce one, documented by a classifier branch that nobody
could take.

## Outcome

**Done. The class is removed.** The record-carrying error is now the single
mechanism, it is named and documented in the domain rather than implied by two
call sites, and the closed code set is enforced by the compiler at every
surviving door — proven by mutation, three `tsc` errors quoted below.

Domain `check`, domain `test`, extension `check` and extension `test` are all
green, and the structure audit passes with my files staged. Nothing I changed
is inert: the new module has a live consumer in `classify.ts` on the first
commit.

## The decision, and why removal rather than narrowing

The brief offered two honest outcomes. Four things decided it, in this order.

### 1. Phase 1.5 already held the election, and the class lost 8–0

The class was kept in Wave 1 explicitly "for Phase 1.5"
(`reports/w1-domain-registry.md:65`). Phase 1.5 has now landed every browser
failure producer in the wave, and **not one chose it**. Every one attaches a
record built by `webAutomationFailureRecord`:

| Producer | Mechanism used |
| --- | --- |
| `content/action-runtime/resolve-target.ts` | `TargetResolutionError` carrying a record |
| `content/actions/execute.ts` | `UnsupportedActionTypeError` carrying a record |
| `content/action-runtime/results.ts` | builds records directly |
| `content/action-runtime/validation-outcome.ts` | builds records directly |
| `runtime/action-runner.ts` | builds records directly |
| `runtime/browser-tab.ts`, `runtime/browser-download.ts` | build records directly |
| `runtime/action-results.ts` | builds records directly |
| `domain/src/runtime/expectation/evaluate.ts` | builds records directly |

Keeping the class means inventing a producer to justify a branch. The brief
asked for "at least one **real** producer"; there is no failure in this tree
whose natural expression is a code without a comparison.

### 2. The record strictly dominates the class as a carrier

A `WebAutomationRuntimeError` carried a `code` and a message. A record carries
the code **plus** `expected`, `actual` and `evidenceDigest` — the two strings a
Flow and a diagnosing model read first — and `TargetResolutionError` carries the
resolution diagnostics beside it. The classifier's rule 2 re-derived category,
retryable and stage from the code table anyway, so the class bought nothing the
record does not, and lost the comparison.

### 3. The narrowing would not have delivered what it promised

This is the part the open question got wrong, and it is worth recording. The
entry says narrowing `code` to `WebAutomationFailureCode` is "a two-line type
change" that makes an out-of-set code "fail to compile". It would not have, on
the path that was actually reachable. `classify.ts`'s `runtimeErrorCode` matched
the class **structurally** as well as by `instanceof`:

```ts
if (candidate.name !== "WebAutomationRuntimeError") return undefined;
return typeof candidate.code === "string" ? candidate.code : undefined;
```

That branch existed because the content script bundles its own copy of the
domain, so `instanceof` is false for anything it threw — which means the
extension, the only consumer that would ever produce one, could **only** ever
have arrived through the untyped structural door. Narrowing the class would have
compiler-checked construction sites that do not exist, while leaving the one
reachable path a `typeof x === "string"` check. The class could not be made
compiler-enforced for its own intended producer. The record can, and is, because
`WebAutomationFailureRecord["code"]` is the closed union and
`WebAutomationActionResult["failure"]` is that type (`domain/src/actions/types.ts:284`).

### 4. No non-browser producer is load-bearing on the branch

The brief asked me to check this, since the domain has consumers other than the
extension. There are exactly two production call sites of the classifier:

- `domain/src/runtime/adapter.ts:187` — `classifyWebAutomationFailure(undefined, outcome)`.
  It passes `undefined` as `error`, **always**. Rules 2 and 3 were unreachable
  from the domain hop by construction.
- `apps/extension/src/content/action-runtime/results.ts:79` — the content script,
  which cannot import the class.

So the branch had no producer and no reachable caller on either side. It is not
load-bearing for anything; `packages/test-runner` imports only the LLM-evidence
constants from `@fluxiq-web-extension/domain/node` and never touches it.

## What changed and why

Five files, one deleted, two new.

### Deleted: `domain/src/runtime/errors.ts`

The whole file — it held only that class. `domain/src/runtime/index.ts` loses
its `export * from "./errors";` line. `domain/src/client/index.ts` never
exported it and needed no change, which was the original defect.

### New: `domain/src/runtime/failure/carrier.ts`

Removing the mechanism that did not work is only half of "make the tree say one
thing". The mechanism that did work was, until now, an unnamed convention
implemented privately in two files and read privately in a third —
`v-verb-headers`' open question 2 exactly. This module names it:

- **`WebAutomationFailureCarrier`** — the type a producing error declares
  (`class TargetResolutionError extends Error implements WebAutomationFailureCarrier`).
  Its `failure` field is `WebAutomationFailureRecord`, so `code` is the closed
  union **at the throw**. This is the compiler enforcement the class could not
  provide.
- **`carriedWebAutomationFailure(error, fallback?)`** — the reader. It takes an
  `unknown`, reads the record structurally (a bundled copy has no shared class
  identity, so shape is all that crosses), and **rebuilds** it from its own code
  through `webAutomationFailureRecord`. A code in the set keeps its comparison
  and gains the code's own category, retryable flag and stage; a code outside the
  set becomes `UNKNOWN` carrying `unrecognized web automation failure code: <code>`
  appended to what the producer saw. `fallback` fills only descriptions the
  producer left empty.

Its header records why the class was retired, so nobody re-adds a producer for a
retired route.

Two design choices worth stating rather than leaving to be discovered:

- **Rebuild, do not pass through.** Rule 1 (`outcome.failure`) still returns its
  record untouched, because that field is *typed* and the compiler vouched for
  it. A record read off an `unknown` has no such guarantee — a thrower one build
  behind can pair a named code with a category its row forbids, and Core's
  parser drops an inconsistent record whole rather than repairing it, losing the
  failure entirely. Typed input trusted; untyped input rebuilt. That is exactly
  what `adapter.ts`'s `clientReportedFailure` already does at the WebSocket
  boundary, so the two untyped boundaries now answer alike.
- **An unnamed code becomes UNKNOWN, not ACTION_FAILED.** This preserves retired
  rule 3's behaviour on the surviving mechanism, and matches the adapter. It
  differs from `results.ts`'s private `reportedFailure`, which returns
  `undefined` for an unnamed code and lets it degrade to ACTION_FAILED — but
  `results.ts` then falls through to the classifier, which now catches it, so
  **the tree's behaviour improves with no edit to that file**. See
  [Files I do not own](#files-i-do-not-own).

### Changed: `domain/src/runtime/failure/classify.ts`

Rules 2 and 3 and the `runtimeErrorCode` helper are gone. In their place, one
line in `classifyWebAutomationFailure`, in the same position in the precedence:

```ts
const carried = carriedWebAutomationFailure(error, withActual(comparedText(outcome.validation), errorMessage(error)));
if (carried !== undefined) return carried;
```

The precedence is unchanged in meaning — the producer that stood nearest the
page still outranks anything the outcome can be read for — and the fallback
reproduces old rule 2's behaviour of filling the description from the failed
validation, then the thrown message. Rules 4–8 are untouched. The header prose
and the `outcome.failure` docstring were rewritten; the old docstring cited
`isWebAutomationFailureCode` as the guard on that field, which was never true of
a typed field.

### Changed: `domain/src/runtime/failure/index.ts`

Exports `./carrier`, and says in two sentences that there is one mechanism and
where it is documented. That is the sentence `v-verb-headers` asked for.

### Tests

- **New `tests/carrier.test.ts`**, six rows. The first is the compile-time half:
  a `TargetResolutionError implements WebAutomationFailureCarrier` whose record
  is built from the set — this row is what fails `tsc` under mutation. The rest
  cover reading by shape rather than class, rebuilding a contradicting row,
  UNKNOWN for a drifted code (with and without text), the fallback precedence,
  and the eight shapes that claim no classification at all.
- **`tests/classify.test.ts`**: the three runtime-error rows are replaced by two.
  One runs a producer-attached record through the classifier for **every code in
  the set** and asserts the thrown message fills an empty description; the other
  pins precedence — a carried `PAGE_CHANGED` beats a `timed_out` status and a
  failed `web.dom.assert` validation, both of which would otherwise name codes
  of their own. A new row asserts a thrown value with no record, and one with a
  `failure` naming no code, are still classified from the outcome rather than
  silently honoured. One test title lost the words "runtime error".

## The mutation proof

An out-of-set code was introduced at **each of the three surviving ways** to
obtain a `WebAutomationFailureRecord`, together, in `tests/carrier.test.ts`:
through the builder, through a hand-written literal typed as the record, and
through the classifier's rule-1 `outcome.failure` door.

```
$ npx tsc -p tsconfig.test.json --noEmit   # in domain/
EXIT=2
src/runtime/failure/tests/carrier.test.ts(94,49): error TS2345: Argument of type '"web.target.missing"' is not assignable to parameter of type 'WebAutomationFailureCode'.
src/runtime/failure/tests/carrier.test.ts(97,83): error TS2322: Type '"web.target.missing"' is not assignable to type 'WebAutomationFailureCode'.
src/runtime/failure/tests/carrier.test.ts(99,112): error TS2322: Type '"web.target.missing"' is not assignable to type 'WebAutomationFailureCode'.
```

Line 94 is `webAutomationFailureRecord("web.target.missing")` inside a class
declaring `implements WebAutomationFailureCarrier` — that is the producer's
throw site, the exact place the retired class was permissive. Line 97 is a
record literal annotated `WebAutomationFailureRecord`. Line 99 is
`WebAutomationActionOutcome.failure`.

**The contrast with what was removed.** The deleted test at
`tests/classify.test.ts:44` read
`new WebAutomationRuntimeError("web.target.missing", "no idea")` and **compiled
clean** for the whole of Wave 3 — same string, same file tree, no error. That is
the difference this change makes, and it is on the record in git history rather
than asserted.

The mutation was reverted; `diff` against the pre-mutation backup reports no
differences (exit 0), and the four gates below were all re-run afterwards on the
restored tree.

### Proving no remaining path can mint an out-of-set code

Method, and what it establishes:

1. **Every in-tree route to a record is one of the three mutated above.** I
   grepped `domain/src`, `apps/extension/src` and `packages` for a literal
   `code: "web.` outside tests and `e2e/`. **One hit**, discussed below.
   `webAutomationFailureRecord` is the only exported builder; the classifier's
   rules 4–8 all pass `WEB_AUTOMATION_FAILURE_CODES.*`; `carriedWebAutomationFailure`
   and `adapter.ts`'s `clientReportedFailure` are the two readers of untyped
   input and both route through the builder or emit UNKNOWN.
2. **The browser side is covered by the same type.**
   `WebAutomationActionResult["failure"]` is `WebAutomationFailureRecord`
   (`domain/src/actions/types.ts:284`), and `BrowserActionResult` in
   `apps/extension/src/shared/protocol.ts:338` is that type, so an extension
   producer writing an unnamed code fails `tsc` too. The extension `check` in
   the gates below exercises this.
3. **The one gap is not mine to close.**
   `domain/src/client/gateway-mapping.ts:302` builds
   `UNSUPPORTED_ACTION_TYPE_FAILURE` as a hand-written literal annotated
   `AutomationStudioFailureRecord` — **Core's** record, whose `code` is a bare
   `string`. Its code happens to be correct today; the compiler is not what
   keeps it correct. Exact fix below.

## Files I do not own

Three, none blocking. Exact replacement text so the supervisor need not re-derive it.

### 1. `domain/src/client/gateway-mapping.ts` — the one un-enforced record left

Add to the imports:

```ts
import { WEB_AUTOMATION_FAILURE_CODES, webAutomationFailureRecord } from "../runtime/failure";
```

Replace the whole `UNSUPPORTED_ACTION_TYPE_FAILURE` declaration with:

```ts
const UNSUPPORTED_ACTION_TYPE_FAILURE = Object.freeze(webAutomationFailureRecord(WEB_AUTOMATION_FAILURE_CODES.UNSUPPORTED_TYPE));
```

The builder emits `{ category: "blocked_by_capability_or_policy", code:
"web.action.unsupported_type", retryable: false, stage: "dispatch" }` — field for
field what the literal says, so this is not a behaviour change; it moves the
correctness from a comment to the compiler. Keep the doc comment; keep the
`AutomationStudioFailureRecord` type import, still used by the result union.
`client/index.ts` already exports `../runtime/failure`, so there is no new
dependency and no cycle. **A running worker owns this file.**

### 2. `apps/extension/src/content/action-runtime/results.ts:73` — stale sentence

The `actionFailure` docstring currently ends:

> Failing that, the domain's classifier honours a `WebAutomationRuntimeError`,
> and anything else is an action that ran and failed for a reason no code names.

Replace with:

> Failing that, the domain's classifier reads the same attachment itself, so
> this lift is a shortcut rather than a second mechanism; anything else is an
> action that ran and failed for a reason no code names.

The **code** in that file needs no change and behaves correctly as it stands. Its
private `reportedFailure` is now redundant with `carriedWebAutomationFailure`,
and whoever next owns the file could delete it and let the classifier do the
lift — that would also make an unnamed carried code report UNKNOWN from the
short-circuit as well as from the fallthrough. Not required; the fallthrough
already gives the right answer.

### 3. `domain/src/runtime/tests/adapter.test.ts:143-144` — stale sentence

> This is the same
> answer `classifyWebAutomationFailure` gives a runtime error whose code is
> outside the set, because it is the same drift arriving another way.

Replace with:

> This is the same
> answer `carriedWebAutomationFailure` gives a thrown record whose code is
> outside the set, because it is the same drift arriving another way.

The assertion beneath it is unaffected. **This file is modified in the working
tree by the worker who owns `adapter.ts`**, which is why I left it.

## Open questions: what can now be marked settled

A fourth worker is auditing `open-questions.md`. Suggested wording, ready to paste.

### The entry at `open-questions.md:308-316` — settle it, but not as it asked

Replace the whole entry with:

> - **Settled: the runtime error type is gone, and the record it competed with
>   is now the one mechanism.** `WebAutomationRuntimeError` had no producer in
>   the tree, and it was unreachable from `apps/extension` — the only consumer
>   that would have produced one — because neither the failure barrel nor the
>   client barrel exported it. Two briefs assumed otherwise and had to route
>   around it. It was deleted on 2026-09-12 rather than narrowed, with its
>   classifier branch, because every Phase 1.5 producer had independently chosen
>   to attach an `AutomationStudioFailureRecord` to what it throws, and that
>   record carries `expected`, `actual` and a digest the class could not.
>   The narrowing this entry proposed would also not have delivered what it
>   promised: the classifier matched the class *structurally* as well as by
>   `instanceof` — necessarily, since the content script bundles its own copy —
>   so the only reachable path was an untyped `typeof code === "string"` check
>   that no type annotation could have closed. The convention that replaced it is
>   named in `domain/src/runtime/failure/carrier.ts`, its `WebAutomationFailure
>   Carrier` type holds `code` to the closed set at the throw, and a mutation
>   introducing an out-of-set code at all three surviving doors is rejected by
>   `tsc` (TS2345/TS2322). Settled 2026-09-12 by v-error-seam.

### `v-verb-headers` open question 2 — settle it too

That entry (two producers, two mechanisms, undocumented split) is now closed by
the same change: there is one mechanism, `failure/index.ts` says so in its
header, and `carrier.ts` explains which and why. If it has its own row, suggested
wording:

> - **Settled: there is one mechanism, and it is documented.** The split between
>   "attach a record" and "throw a typed error" ended when the error class was
>   deleted on 2026-09-12. `domain/src/runtime/failure/carrier.ts` names the
>   surviving convention, `failure/index.ts` points at it, and both readers
>   (`carriedWebAutomationFailure` and `results.ts`'s `reportedFailure`) honour
>   the same shape. Settled 2026-09-12 by v-error-seam.

### One line in the integration checklist at `open-questions.md:465-476` is obsolete

> narrowing `WebAutomationRuntimeError["code"]` to the closed set is a two-line
> change in `domain/src/runtime/errors.ts` with no import cycle

Delete it — the file no longer exists. Suggested replacement item, since the gap
it was reaching for is real and still open:

> `domain/src/client/gateway-mapping.ts`'s `UNSUPPORTED_ACTION_TYPE_FAILURE` is
> the last failure record in the tree whose code the compiler does not hold to
> the closed set; the one-line fix is in `reports/v-error-seam.md`

## Commands run and observed results

`DOMAIN_TEST_BUILD_LABEL=v-error-seam` and `EXTENSION_TEST_BUILD_LABEL=v-error-seam`
throughout. Every exit status captured by redirecting to a file and echoing `$?`,
never through a pipe. I ran no `pnpm build` and no `pnpm lab` command.

| Command | Exit | Observed |
| --- | --- | --- |
| `pnpm --filter @fluxiq-web-extension/domain check` | 0 | both `tsc` projects, no diagnostics |
| `pnpm --filter @fluxiq-web-extension/domain test` | 0 | `# tests 282 / # pass 282 / # fail 0` |
| `pnpm --filter @fluxiq-web-extension/extension check` | 0 | both `tsc` projects, no diagnostics |
| `pnpm --filter @fluxiq-web-extension/extension test` | 0 | `# tests 221 / # pass 221 / # fail 0` |
| `npx tsc -p tsconfig.test.json --noEmit` (mutated) | **2** | the three TS2345/TS2322 errors quoted above |
| `node scripts/structure-audit.mjs` (scratch `GIT_INDEX_FILE`) | 0 | `structure-audit: passed (30 warning(s), 19 baselined)` |

My ten rows in the final domain run, all passing:

```
ok 146 - the carrier type holds a producer's code to the closed set at the throw
ok 147 - a record thrown from another bundle of this package is read by shape, not by class
ok 148 - a carried record is rebuilt from its own code, so a contradicting row cannot reach Core
ok 149 - a code outside the closed set becomes UNKNOWN, carrying the code it used
ok 150 - the fallback fills only the descriptions the producer left empty
ok 151 - a value that claimed no classification carries none
ok 153 - a thrower that attached its own record is honoured, for every code in the set
ok 154 - a carried record outranks everything the outcome could be read for
ok 155 - a thrown value carrying no record at all is classified from the outcome, not silently honoured
ok 159 - a thrown value that classified nothing is an action that ran and failed
```

Every gate was green on the **first** run; no rerun was needed and none of the
four ever failed, so nothing here is a parallel edit misread as a pass. The
domain suite grew 275 → 282 between my first run and my last, which is other
workers' rows landing — I added six net (six new in `carrier.test.ts`, and
`classify.test.ts` went from ten rows to nine).

The structure audit ran with a copy of `.git/index` in the scratchpad and
`GIT_INDEX_FILE` exported for that command only, with all seven of my paths
staged including the deletion. The real index was confirmed empty afterwards
(`git diff --cached --name-only` printed nothing). No finding names any file
under `domain/src/runtime/failure/` or `domain/src/runtime/index.ts` — grep over
the audit output for `runtime/failure|runtime/errors|runtime/index` returned
nothing. I did not run `pnpm structure:baseline`; no file of mine is in
`.structure-baseline.json`, and `carrier.ts` and `carrier.test.ts` are new files
in unbaselined directories, so nothing baselined grew.

## Not verified

- **No live browser run.** The removed class was never in a browser path to
  begin with (that was the defect), and the record path was already exercised by
  the content harness before this change. But I ran no `test:content`: I touched
  no content code, and the brief's definition of done did not ask for it. What a
  Chrome run would add over the Node one is nothing this change alters.
- **The tracked bundle still contains the deleted class.**
  `apps/extension/build/content/index.js` carries four occurrences of
  `WebAutomationRuntimeError` — the old bundled copy of the class and the
  structural branch. That file is regenerated by `pnpm build`, which I am
  forbidden to run and must not hand-edit. It clears at integration; until then
  the tracked build and the source disagree. Same for `domain/.test-build/`,
  already on the integration checklist.
- **Core's own handling.** I did not check whether anything in `F:\!FluxIQ`
  references `WebAutomationRuntimeError`; Core must not import this repository,
  so it should not, but I did not confirm it. My grep covered this repository
  only.
- **`packages/test-runner` and `apps/scenario-lab` suites.** Not run; I touched
  no file in either, and neither imports the deleted class (the test runner
  imports only `WEB_LLM_EVIDENCE_*` from `@fluxiq-web-extension/domain/node`).
- **`gateway-mapping.ts`'s literal** was read, not changed or compiled in its
  proposed form. The claim that the replacement is field-for-field identical is
  read off the code table in `codes.ts`, not observed from a run.
- **Whether `results.ts` should drop its private `reportedFailure`.** Argued
  above, not attempted; the file is in my Must-not-touch list.

## Open questions or contradictions found

1. **The open question misdiagnosed its own fix, and the reason generalizes.**
   It proposed narrowing a type to make a code set compiler-enforced, on a path
   whose only reachable entry was a structural check on an `unknown`. A type
   annotation enforces nothing on a value the compiler never sees. Before
   recording "narrow the type" as a remedy, it is worth asking which door the
   value actually comes through — here, a class-identity check that had to be
   structural because the content script bundles its own copy of the domain, and
   *that* is what made the class the wrong carrier, not the width of its `code`
   field.

2. **`gateway-mapping.ts` is now the only failure record the compiler does not
   hold to the closed set**, and it is a hand-written literal annotated with
   Core's `AutomationStudioFailureRecord` rather than the narrowed
   `WebAutomationFailureRecord`. The pattern is worth watching for generally:
   annotating with Core's type re-opens the door that `WebAutomationFailureRecord`
   exists to close, and it looks entirely innocent at the call site. A grep for
   `: AutomationStudioFailureRecord` in production code is a cheap standing
   check; today it has one hit outside type signatures.

3. **`results.ts` and the domain now hold the same reader twice**, benignly. Its
   `reportedFailure` and `carriedWebAutomationFailure` agree on every record an
   honest producer builds, and where they differ (an out-of-set carried code)
   the fallthrough reaches the domain's answer anyway. It is redundancy, not
   drift, and deleting the private copy is a one-line simplification for whoever
   owns that file next. I mention it only so the next reader does not find two
   readers and conclude the split reopened.
