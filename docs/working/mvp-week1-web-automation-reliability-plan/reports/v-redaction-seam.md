# Report: v-redaction-seam

Worker: `v-redaction-seam`. Three items left behind by workers whose briefs
forbade the file the fix belonged in: a shared constant living in the wrong
module with the dependency pointing backwards, a guard that withheld
unconditionally because it could not tell a redacted string from a leaked one,
and the last failure record in the tree whose code the compiler did not hold to
the closed set.

No captured or fixture value appears in this report, in a test name, or in a
test body. The one string a test needed as a stand-in is the sentinel
`v-validation-leak` established: it is not a secret and carries no shape of one.

## Outcome

**Done.** All three landed, both mutation proofs are quoted below, and the
fail-safe has a test at every layer that reads the flag.

| Item | Answer |
| --- | --- |
| 1. The marker's home | Moved to `domain/src/sensitivity/redaction.ts`. `domain/src/runtime` no longer imports `domain/src/client`; both consumers now reach the marker through `../sensitivity`, and neither depends on the other. No barrel needed editing. |
| 2. The producer-set flag | `redacted?: boolean` on the two comparison variants of `WebAutomationActionValidation`, honoured at both domain exits, read through one predicate that **fails safe when absent**. No predicate over text was written. |
| 3. The un-enforced record | `UNSUPPORTED_ACTION_TYPE_FAILURE` is built by `webAutomationFailureRecord`. An invented code at that site is now `error TS2345`; the same invented code in the shape it had this morning still compiles clean, and both runs are quoted. |

**The producer half of item 2 is not landed and cannot be, by this brief.** The
domain now honours a declaration nothing yet sets, so today every sensitive
control's comparison is withheld exactly as before — the change is inert until
someone edits `apps/extension/src/content/`. The exact lines are in
[The producer-side lines](#the-producer-side-lines-the-supervisor-must-wire),
and there is **one line among them that must land first** or the other six are
themselves inert.

---

## 1. The marker moved, and the dependency straightened

`WEB_AUTOMATION_WITHHELD_COMPARISON_TEXT` was declared in
`domain/src/client/gateway-mapping.ts` and imported by
`domain/src/runtime/adapter.ts` as `from "../client"` — a server-side module
importing the browser-facing barrel for one string, which nothing else in
`runtime/` does.

It now lives in **`domain/src/sensitivity/redaction.ts`**, beside the rule both
consumers already ask (`isSensitiveElementDescriptor`), and both import it from
`../sensitivity`. `gateway-mapping.ts` lost an export and eight lines;
`adapter.ts` lost its `../client` import line entirely.

**No barrel needed an export line, which is worth stating because the brief told
me to report one if it did.** `domain/src/client/index.ts` and
`domain/src/index.ts` both already carry `export * from "../sensitivity"` /
`"./sensitivity"`, so the constant's public surface on
`@fluxiq-web-extension/domain/client` and on the root entry is unchanged. Adding
a re-export from `gateway-mapping.ts` would in fact have *broken* the build, by
making the same name reachable twice through two `export *` lines in the same
barrel. Nothing outside the domain imported it (grep over `apps/`, `packages/`
and `domain/`: the only importers were the two modules and their two tests).

The new module also holds the flag reader, for the same reason the marker is
there: it is the redaction contract, it depends on nothing but itself, and
keeping it out of `actions/types.ts` is what lets `sensitivity/` stay free of
every other module. `signature.ts` and `descriptor.ts` are untouched.

## 2. The flag, and the fail-safe that is the point of it

### The contract

`domain/src/actions/types.ts`:

```ts
export type WebAutomationActionValidation =
  | { status: "passed"; expected: string; actual: string; redacted?: boolean | undefined }
  | { status: "failed"; expected: string; actual: string; redacted?: boolean | undefined }
  | { status: "none"; reason: WebAutomationValidationSkipReason };
```

Deliberately on the two comparison variants only: a validation with no
comparison has nothing to declare, and putting the field on `none` would invite
a producer to set it where it means nothing. That choice is compiler-enforced —
`redacted` on a `none` validation is `error TS2353`, quoted below.

The flag covers **every comparison the result carries**: this validation's two
strings and the failure record's `expected` and `actual`, which the producer
builds from the same two (`results.ts` `success()` passes `bounded.expected` and
`bounded.actual` straight into `webAutomationFailureRecord`; `actionTimedOut`
does the same; `actionRejected` composes its `actual` from the validation's).
That is why one flag on the validation can speak for the record, and it is
written into the type's doc comment so the next producer knows what it is
promising.

### The reader, and why it is the only one

`domain/src/sensitivity/redaction.ts`:

```ts
export function isProducerRedactedComparison(validation: unknown): boolean {
  if (!validation || typeof validation !== "object" || Array.isArray(validation)) return false;
  return (validation as Record<string, unknown>).redacted === true;
}
```

`unknown` in, for the same reason `isSensitiveElementDescriptor` takes
`unknown`: one caller holds a typed validation and the other holds a JSON object
that crossed a WebSocket. **Only the boolean `true` is a declaration.** `false`,
the string `"true"`, `1`, an absent field, a non-object — all withhold. Nothing
reads the text, at either call site: a predicate that scans a string for things
that look like card numbers both misses and misfires.

### Where it is honoured

- **`gateway-mapping.ts` `webAutomationSecretSafeValidation`** — one new line
  before the sensitivity question. A declared redaction returns the validation
  unchanged; everything else behaves exactly as it did.
- **`adapter.ts`** — the single `secretTarget` boolean became
  `withholdComparison`, computed once from the client's result as
  `isSensitiveElementDescriptor(element) && !isProducerRedactedComparison(validation)`,
  and used unchanged at both exits it already fed (the re-established failure
  record, and the dispatch payload's nested validation).

One behaviour change beyond the flag itself: **a comparison this layer withholds
now leaves marked `redacted: true`**. The two strings it carries are as withheld
as a comparison gets, and saying so keeps the flag meaning the same wherever a
reader finds it — including the adapter, one hop later, which then leaves the
client's already-withheld payload alone instead of rewriting it. Two existing
`deepEqual` assertions were updated for the extra field; both are in test files
this brief owns.

### The fail-safe, and why it is tested three times

The brief is right that a test covering only the flag-present case would pass
while the safe default was broken. There are three layers that read the flag, so
there is a row at each, and each layer's rows are driven from the *unredacted*
strings a producer with its redaction removed would send:

| Layer | File | Rows |
| --- | --- | --- |
| The predicate | `domain/src/sensitivity/tests/redaction.test.ts` (new, 6 rows) | absent, `false`, `"true"`, `1`, `"yes"`, `{}`, `Redacted`, non-objects, and the marker text itself — none is a declaration |
| The wire payload | `domain/src/client/tests/gateway-mapping-redaction.test.ts` (new, 7 rows) | 4 absent-declaration rows, each asserting the sentinel reaches no field of the serialized payload |
| The runtime adapter | `domain/src/runtime/tests/adapter-redaction.test.ts` (5 rows added) | the same 4, over a live adapter run against a fake FluxIQ, plus the honoured case on both exits |

The new client-side file is `node:test` rather than the bare module-scope
assertions `gateway-mapping.test.ts` uses, deliberately: G3's mechanism, which
`v-validation-leak` reproduced, means a failed assertion in that file aborts the
script and still prints a green-looking count. A fail-safe whose failure is
hard to read is half a proof. It is a separate file for the same reason
`adapter-redaction.test.ts` is, and because `gateway-mapping.test.ts` is already
past the 400-line advisory.

`gateway-mapping.test.ts` ends this brief at **417 lines, exactly what it was
before** — my one added import line was paid for by merging its two separate
imports from `../../actions/types` into one.

## 3. The last un-enforced failure record

`domain/src/client/gateway-mapping.ts`, exactly as `v-error-seam` specified:

```ts
import { WEB_AUTOMATION_FAILURE_CODES, webAutomationFailureRecord } from "../runtime/failure";
const UNSUPPORTED_ACTION_TYPE_FAILURE = Object.freeze(webAutomationFailureRecord(WEB_AUTOMATION_FAILURE_CODES.UNSUPPORTED_TYPE));
```

The builder emits `{ category: "blocked_by_capability_or_policy", code:
"web.action.unsupported_type", retryable: false, stage: "dispatch" }` — field for
field what the literal said, confirmed against `codes.ts:112` and by the
existing assertions in `gateway-mapping.test.ts`, which compare the rejection's
failure against a hand-written expectation and still pass untouched. The doc
comment is kept and extended; the `AutomationStudioFailureRecord` type import
stays, still used by the result union.

**No cycle, and the direction is now consistent.** `client/index.ts` already
exports `../runtime/failure`, so `client → runtime/failure` existed before this;
what item 1 removed was the arrow going the other way. `runtime/failure` imports
only `actions/types` and Core.

---

## The producer-side lines the supervisor must wire

`apps/extension/src/content/actions/**` is another worker's and the redaction
there is deliberate and tested, so none of this is done. Each verb already
computes the boolean it needs — `const withheld = isSensitiveFormControl(element)` —
so every line below is `redacted: withheld` added to a validation literal.

**Do this one first, or the other six are inert.**

1. `apps/extension/src/content/action-runtime/validation-outcome.ts`,
   `boundValidation` (line 54). It rebuilds the validation field by field and
   would silently drop the flag one line after each verb set it:

   ```ts
   return {
     status: validation.status,
     expected: truncateValidationText(validation.expected),
     actual: truncateValidationText(validation.actual),
     ...(validation.redacted === undefined ? {} : { redacted: validation.redacted })
   };
   ```

   This is the "ownership drawn around a file rather than around the change"
   shape the wave brief warns about: it is not in `content/actions/`, and a
   brief that granted only the three verbs would ship something nothing honours.

Then the verbs, all `deps.success(...)` validation literals:

2. `content/actions/type.ts` — 2 literals (the "holds no typed text" branch, and
   the read-back at the end).
3. `content/actions/clear.ts` — 2 literals (the "no value to clear" branch, and
   the emptiness read-back).
4. `content/actions/select.ts` — 4 literals (no option named, not a select, no
   option matched, and the selection read-back).

Every string in those ten literals is built through `describeFieldValue(...,
withheld)` or is a constant, so `redacted: withheld` is an accurate declaration
in each. The `select.ts` "the command named none" literal names no value at all;
marking it is harmless and keeps the verb's rule uniform.

**One decision the supervisor should make rather than inherit.**
`results.ts` `actionRejected` builds its own validation from two strings its
caller passes and has no parameter through which a verb could declare them
redacted — so `select.ts`'s disabled-option rejection, whose text *is* built
with `describeFieldValue(..., withheld)`, will keep being withheld by the domain.
Either add an optional `redacted` parameter to `actionRejected`, or accept that
rejections lose their phrasing on sensitive controls. I did not choose, because
`results.ts` belongs to another brief and the second option may well be right:
`v-validation-leak` found the rejection detail describes actionability rather
than content.

Nothing else needs a change. `apps/extension/src/shared/protocol.ts` re-exports
the domain type as `BrowserActionValidation`, so the field arrives there for
free — the extension `check` below passes against the widened type with no
extension edit at all.

---

## Commands run and observed results

`DOMAIN_TEST_BUILD_LABEL=v-redaction-seam` and
`EXTENSION_TEST_BUILD_LABEL=v-redaction-seam` on every package command. Every
exit status captured by redirecting to a file and echoing `$?`, never through a
pipe. No `pnpm build`, no `pnpm lab`, no `pnpm structure:baseline`, no commit.

| Command | Exit | Observed |
| --- | --- | --- |
| domain `test`, **baseline before any edit** | 0 | `# tests 282 / # pass 282 / # fail 0` |
| domain `check`, after all source edits (13:15) | **0** | `grep -c "error TS"` = 0, both `tsc` projects |
| domain `test`, after all source edits (13:15) | **0** | `# tests 300 / # pass 300 / # fail 0` |
| extension `check` | **0** | 0 `error TS`, both projects, twice |
| extension `test` | **0** | `# tests 225 / # pass 225 / # fail 0` |
| `node scripts/structure-audit.mjs`, scratch `GIT_INDEX_FILE` | **0** | `structure-audit: passed (30 warning(s), 19 baselined)` |
| domain `check`, reruns at 13:21, 13:22, 13:23 | **2** | 47 → 3 → 3 errors, **every one in a file this brief forbids me** |
| domain `check`, **final** (13:26) | **0** | 0 `error TS`, both `tsc` projects — the parallel edit landed |
| domain `test`, **final** (13:26) | **0** | `# tests 300 / # pass 300 / # fail 0`, no abort |
| extension `check`, **final** | **0** | 0 `error TS` |
| `node scripts/structure-audit.mjs`, **final**, report staged too | **0** | `structure-audit: passed (30 warning(s), 19 baselined)` |

So the gate closed green in the end, and the red middle rows are left in this
table rather than tidied away, because they are the reason the timings matter.
**They were a parallel edit, and I checked rather than assumed.** The only edit I
made after the first green pair was consolidating two imports into one line in
`gateway-mapping.test.ts`; then another worker's in-flight edit went red under
me, then it went green again with no further change of mine. Attribution, in the
order I established it:

- Every error names `domain/src/recording/web-state/evidence/{project,read}.ts`
  or `domain/src/runtime/llm-evidence/sanitize.ts`. `recording/**` and
  `llm-evidence/**` are both in my "Must not touch" list as a running worker's.
- `project.ts` was last written at **13:21:48**, four seconds into the run that
  reported 46 errors in it.
- The count and the file set both moved across reruns — 47 (project + read), then
  3 (read + sanitize), then 3 — which is a tree being edited, not a stable
  failure. `read.ts(52,18): error TS2304: Cannot find name 'record'` is a
  half-finished rename.
- `npx tsc -p tsconfig.test.json --noEmit` run directly: **1 error, in
  `read.ts`**, and `grep -E "sensitivity|client/|adapter|actions/types"` over its
  output returns nothing. My import consolidation compiles.
- I ran **every** domain test bundle individually from the build directory. Three
  fail: `recording/tests/domain.test.mjs`,
  `recording/web-state/tests/evidence.test.mjs`, and
  `tests/page-evidence-joinery.test.mjs`. Every other bundle passes, including
  all five that cover my files:

  ```
  EXIT=0 # pass 6  # fail 0  <- sensitivity/tests/redaction
  EXIT=0 # pass 7  # fail 0  <- client/tests/gateway-mapping-redaction
  EXIT=0                     <- client/tests/gateway-mapping   (bare script; exit 0 = every assertion held)
  EXIT=0 # pass 10 # fail 0  <- runtime/tests/adapter-redaction
  EXIT=0 # pass 19 # fail 0  <- runtime/tests/adapter
  ```

The structure audit was run twice: once with my three new files staged into a
copy of `.git/index`, and once with a pristine copy. **The two outputs are
byte-identical** (`diff` exit 0), so my new files move nothing. The real index
was confirmed untouched (`git ls-files | grep` for my three paths: empty). The
only finding naming a file I touched is the pre-existing
`gateway-mapping.test.ts: 417 lines`, unchanged from before this brief.

## The mutation proofs

### Item 3 — an out-of-set code at the narrowed record

`webAutomationFailureRecord(WEB_AUTOMATION_FAILURE_CODES.UNSUPPORTED_TYPE)` →
`webAutomationFailureRecord("web.action.made_up")`:

```
$ npx tsc -p tsconfig.json --noEmit   # in domain/
EXIT=2
src/client/gateway-mapping.ts(299,82): error TS2345: Argument of type '"web.action.made_up"' is not assignable to parameter of type 'WebAutomationFailureCode'.
```

**And the contrast, which is what makes the claim falsifiable.** The same
invented code, written in the shape the declaration had this morning — a literal
annotated with Core's `AutomationStudioFailureRecord`, whose `code` is a bare
`string`:

```
$ npx tsc -p tsconfig.json --noEmit   # in domain/, with the pre-change literal shape
EXIT=0
(no output)
```

Clean. That is the door this item closed, measured rather than argued.

### Item 2 — the contract, at the compiler

Two mutations together in `gateway-mapping-redaction.test.ts`: a non-boolean in
a typed validation, and the flag on the variant that carries no comparison.

```
$ npx tsc -p tsconfig.test.json --noEmit   # in domain/
EXIT=2
src/client/tests/gateway-mapping-redaction.test.ts(54,5): error TS2322: Type 'string' is not assignable to type 'boolean | undefined'.
src/client/tests/gateway-mapping-redaction.test.ts(109,111): error TS2353: Object literal may only specify known properties, and 'redacted' does not exist in type '{ status: "none"; reason: WebAutomationValidationSkipReason; }'.
```

### Item 2 — the fail-safe, at runtime

The compiler cannot catch a wrong *default*, so the safe default was mutated
directly. `isProducerRedactedComparison`'s `=== true` → `!== false`, which is
the exact mistake worth guarding against: it reads truthy-ish values and,
crucially, an **absent** field as a declaration.

```
$ pnpm --filter @fluxiq-web-extension/domain test
EXIT=1
not ok 12 - an absent declaration withholds: no flag at all, which is every verb nobody has taught it yet
not ok 14 - an absent declaration withholds: a string that merely looks like the flag
not ok 15 - an absent declaration withholds: a truthy value that is not the boolean
  error: the flag is the only thing that buys the text through, and this is not the flag
         true !== false
```

That run **aborted early** — 17 tests reported — because the module-scope
assertions in `gateway-mapping.test.ts` also went red and took the process with
them, which is G3's mechanism appearing again and is itself evidence the older
rows fail under the mutation. So the two layers downstream of it were run
directly from their bundles, under the same mutation:

```
$ node .test-build-scratch/v-redaction-seam/runtime/tests/adapter-redaction.test.mjs
EXIT=1   # tests 10 / # pass 4 / # fail 6
not ok 1  - a client's failure record for a sensitive control leaves without its comparison
not ok 2  - a sensitive control's post-condition is withheld from the dispatch payload as well as the record
not ok 3  - a code this domain does not name is still withheld before it becomes UNKNOWN
not ok 7  - an absent declaration withholds: no flag at all, which is every client that predates the contract
not ok 9  - an absent declaration withholds: a string that merely looks like the flag
not ok 10 - an absent declaration withholds: a truthy value that is not the boolean

$ node .test-build-scratch/v-redaction-seam/sensitivity/tests/redaction.test.mjs
EXIT=1   # tests 6 / # pass 3 / # fail 3
not ok 3 - an absent declaration is not a declaration
not ok 4 - nothing that merely resembles the declaration is one
not ok 6 - the marker is not itself a declaration
```

Every layer that reads the flag goes red, including the pre-existing rows that
knew nothing about it. **One row correctly stayed green** and is worth naming
rather than glossing: `an absent declaration withholds: a flag that says the
opposite`. The mutation was `!== false`, so an explicit `redacted: false` still
withheld under it. The row is not weak — it is testing a different failure —
and the honest reading is that this particular mutation does not exercise it.

All mutations were reverted and each revert verified by `diff` against a
pre-mutation backup (exit 0, no differences). `grep` over `domain/src` and
`apps/extension/src` for `made_up`, `MUTATION` and `!== false` finds only one
pre-existing, unrelated `item.exists !== false` in
`apps/extension/src/runtime/browser-download.ts`, which I did not touch.

## Not verified

- **Nothing is left red, but the green gate is a snapshot of a moving tree.**
  Domain `check`, domain `test`, extension `check`, extension `test` and the
  structure audit were all exit 0 on the final pass, taken at 13:26 while ten
  workers were editing this repository. The three failures I saw in between were
  all another worker's and all cleared without any change of mine; a check the
  supervisor runs after integration is the one that counts.
- **No live browser run, and none of this is exercised end to end.** Everything
  here is Node: the domain functions driven directly and the adapter driven
  against a fake FluxIQ. The flag has never travelled a real WebSocket, because
  nothing sets it yet.
- **The whole benefit of item 2 is unrealized until the producer sets the
  flag.** What is proven today is that the domain *would* honour a declaration
  and does not honour anything else. That the phrasing an operator gets back is
  worth having is `v-validation-leak`'s reasoning, not my measurement.
- **The claim that one flag on the validation can speak for the failure record**
  is read off `results.ts` — `success`, `actionRejected` and `actionTimedOut` all
  build the record's comparison from the same bounded validation — not observed
  from a live result carrying both.
- **No `pnpm build`, no root `pnpm check`/`test`, no `test:content`.** I touched
  no content code; the wave forbids the first and the others are the
  supervisor's, on a tree ten workers are editing.
- **`domain/.test-build/` is stale** with respect to the widened type, as it is
  for everyone this wave; my runs went to `.test-build-scratch/v-redaction-seam/`.

## Open questions or contradictions found

1. **The one line that decides whether item 2 ships is not in
   `content/actions/`.** `boundValidation` in `validation-outcome.ts` rebuilds
   every validation field by field, so it drops an unrecognized field silently.
   A brief that hands a worker "the three verbs" and not that function produces
   three verbs setting a flag that is deleted before it reaches the wire, with
   every gate green. It is the exact defect shape the wave brief warns about, one
   layer further out than usual, and it is worth checking for whenever a new
   field is added to a type that something in the middle re-assembles.
2. **`actionRejected` has no way to declare a redaction**, so `select.ts`'s
   disabled-option rejection keeps losing its phrasing. Named above as a
   decision, not a defect.
3. **A new verb that builds a comparison and never learns the flag is silently
   withheld, not silently leaked**, which is the right direction — but it is also
   silent. The only signal is an operator seeing the marker where they expected
   words. If that becomes common, the place to catch it is a test over the verb
   registry asserting that every verb which calls `describeFieldValue` also sets
   `redacted`, which is a Wave 4 shape rather than something I could add from
   here.
4. **`gateway-mapping.test.ts` remains a bare-assertion script**, and this brief
   met G3's consequence head on: under mutation it aborted the entire domain
   suite at test 17, hiding the state of every bundle after it. Converting it to
   `node:test` subtests is mechanical and would have saved me two commands. I did
   not do it — it is 417 lines of another worker's freshly written assertions and
   the brief did not ask — but it is the second report in two days to raise it.
5. **`v-validation-leak`'s two remaining carriers are still open** and neither is
   mine: `candidateLabel` in `content/identity/candidates.ts` taking
   `textContent` with no sensitivity question, and `selectedText` in the LLM
   evidence packet guarded only on the producer side. Both are the same defect
   shape this brief just closed for `validation`, one field along.
