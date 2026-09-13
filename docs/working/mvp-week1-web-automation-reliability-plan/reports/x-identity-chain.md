# x-identity-chain — `context` reaches the page, and the third projection is closed

Worker `x-identity-chain`, 2026-09-12. No Lab run, no `pnpm build`, no
`pnpm structure:baseline`, no commit. Every exit status captured by redirect
into a file in the scratchpad, never through a pipe.
`DOMAIN_TEST_BUILD_LABEL=x-identity-chain`.

Baseline read first:
[`x-identity-wire.md`](x-identity-wire.md).

---

## Outcome

**Done, with one answer the brief did not expect.**

1. **`context` no longer dies at `elementFingerprint`.** It reaches the Flow
   node's element, field by field, through a closed vocabulary. Dropping or
   renaming it is now a compile error.
2. **The third hand-written projection is contract-derived.**
   `webAutomationActionTargetFromElement` is now the descriptor minus a named,
   argued list of promoted fields, and every remaining key must be written.
   Measured through Core's own normalizer, the recording envelope's target
   gains `testId` (Core weight 28, its highest) and `accessibleName` (24, its
   joint-second) — neither of which reached Core before — plus `implicitRole`
   and `context`.
3. **`form-context` does not become resolvable, and cannot with the change the
   brief describes.** The tie is real and it is not the wire's fault. Measured
   through the real chain: **0.565 / 0.565, separation 0.000**, with and
   without `context`. The reason is not that `context` fails to arrive — it
   arrives. It is that **the recording carries no form context to compare**:
   the fixture records on the `baseline` page, which has no `<form>` and no
   `<fieldset>` at all. Detail and the numbers in
   [form-context re-measured](#form-context-re-measured).
4. **This change moves no score anywhere**, by construction, and that is
   checked rather than assumed. See [what this did not move](#what-this-did-not-move).

**This is fixed pending live confirmation, not closed.** I cannot run the Lab.
Everything below is unit-level, harness-level, or a reconstruction of the same
chain a live replay executes.

Two files outside my stated ownership had to change, both type-only and
additive. They are called out in [what changed](#what-changed) and are the one
thing to check before this lands.

---

## What changed

Six files. Four are mine; two are not, and both are flagged.

| File | Mine | What |
| --- | --- | --- |
| `domain/src/output-nodes/targets.ts` | yes | `elementFingerprint` carries `context`, is written against a contract, returns the contract type, and narrows `attributes` |
| `domain/src/output-nodes/tests/targets.test.ts` | yes | six rows for `context` and the attribute narrowing |
| `domain/src/recording/web-state/action-target.ts` | yes | the envelope target derived from the descriptor, with the sensitivity rule applied |
| `domain/src/recording/web-state/tests/action-target.test.ts` | yes (new) | six rows, including one through Core's own normalizer |
| **`domain/src/actions/types.ts`** | **no** | **+`WebAutomationElementContext`, +`context` on `WebAutomationElementFingerprint`** |
| **`domain/src/recording/web-state/types.ts`** | **no** | **+the five identity signals on `WebAutomationElementStateInput`, +`WebAutomationElementIdentitySignal`** |

### Why the two files outside my ownership had to change

Neither is in the brief's "must not touch" list, neither was modified by
another worker at the time, and both changes are additive type declarations
that cannot break a consumer. But they are outside what I was given, so:

**`domain/src/actions/types.ts`.** `WebAutomationElementFingerprint` is not
some type I picked — its own doc says *"`output-nodes/targets.ts`
`elementFingerprint` is the one producer, and its output is exactly this"*.
Deriving the producer from anything else would have created a **fourth**
element-descriptor shape while closing the third, which is the failure mode
this brief exists to end. `context` had to go on that type, and its shape had
to be declared somewhere the domain can see (`DomElementContext` lives in
`apps/extension/src/shared/protocol.ts`, which `domain/src` may not import).
One consequence: the file is now **427 lines**, past the 400-line advisory. See
[open questions](#open-questions-and-contradictions).

**`domain/src/recording/web-state/types.ts`.** This is the harder one, and it
is the actual root of item 2. `WebAutomationElementStateInput` is the domain's
mirror of the wire descriptor, and **it had drifted by exactly the five
identity signals** — it declared `hasValue`/`selectedValue`/`options`/`changed`/
`recentlyInteracted` out (correctly, matching `UnwiredElementField`) and had
simply never gained `testId`, `accessibleName`, `label`, `implicitRole` or
`context`. `client/gateway-mapping.ts` casts the wire element to this type
(`target as unknown as WebAutomationElementStateInput`), so **the runtime
object held all five and the declared type mentioned none**. Deriving
`action-target.ts` from a type that does not know about the signals would have
produced a guard that compiles forever and still carries nothing — the defect
in a new costume. Adding them is what makes the derivation mean something.

### `domain/src/output-nodes/targets.ts`

`elementFingerprint` now returns `WebAutomationElementFingerprint` rather than
a bare `JsonObject`, and its literal is checked against
`ContractFields<WebAutomationElementFingerprint>`: every key of the contract
must be mentioned, an optional one may be `undefined`, a required one may not.

- **`context` is carried**, read field by field through the same closed
  vocabulary as the fingerprint around it — an unknown key or a mistyped value
  is dropped, matching the rule `gateway-mapping-identity.test.ts` already
  pins ("a signal the normalizer does not know does not reach the page"). An
  empty context is `undefined`, not `{}`.
- **Core's eight remaining fingerprint signals are named `undefined`** with the
  reason a browser recording has no source for each. That is what makes a
  signal Core *adds* stop this producer compiling.
- **`attributes` is narrowed to `Record<string, string>`.** Not a decision I
  set out to make — typing the projection surfaced it. Core declares
  `attributes` as `Record<string, string>` and compares the values as strings;
  this function was handing it a raw `JsonObject`, so a recording carrying a
  number or a nested object under an attribute name reached Core's comparison
  as one. `TS2412` at `targets.ts(129,5)` is what said so.
- The **stale comment** `x-identity-wire` flagged ("12 identity signals
  recorded, 1 on the wire before this ordering, 12 after") is corrected to the
  measured 11/1/11, with a note saying why the old figure was wrong.

### `domain/src/recording/web-state/action-target.ts`

Converted the way the wire projection was, and the answer to the brief's
question is: **the field set is legitimately different, and the difference is
now explicit and typed.**

```ts
type PromotedTargetField = "selector" | "bounds" | "name" | "text" | "value";
export type WebAutomationActionTargetMetadata = Omit<WebAutomationElementStateInput, PromotedTargetField>;
export type RecordedIdentitySignals = Nothing<Exclude<WebAutomationElementIdentitySignal, keyof WebAutomationActionTargetMetadata>>;
```

The difference is not "recording state versus dispatch" — it is that
`ActionTarget` is a *two-level* shape. `selector` and `bounds` are Core's own
top-level fields and its normalizer reads them there first; `name`, `text` and
`value` feed `label`, the display string. Everything else belongs under
`metadata`, and `Omit` is what makes that "everything else" rather than "the
twelve keys someone remembered". `RecordedIdentitySignals` closes the escape
hatch: a signal cannot be argued out by adding it to `PromotedTargetField`
without the alias failing to compile.

The outer literal is checked against `ContractFields<ActionTarget>` as well, so
`relativePosition`, `visualTarget` and `elementTarget` are named `undefined`
with the reason they are not this producer's to fill.

**Redaction was added, and it closes a live leak.** `isSensitiveElementDescriptor`
from `domain/src/sensitivity/` — imported, not restated — withholds
`visibleText`, `text`, `value` and `accessibleName`, keeping `label`,
`context`, `attributes`, `testId` and the structural signals. That is exactly
the line `elementTarget()` draws upstream and `elementStatePayload` draws next
door. Without it the label chain ends at `element.value`, so **a nameless
password field with no visible text put what was typed into it on
`ActionTarget.label`** — on the envelope of a persisted, replayable recording.
On the gateway path the element arrives already redacted; on the
`createWebAutomationStateFromSnapshot` → `focus.target` path it does not, which
is where the leak was reachable.

### What Core actually gains from item 2

Measured by running the before-metadata and the after-metadata through Core's
own `normalizeAutomationStudioElementTarget`:

| | fingerprint signals Core derives |
| --- | --- |
| before | `attributes, bounds, classNames, id, label, role, selector, tagName, visibleText, xpath` |
| after | the same plus **`testId`** and **`accessibleName`**, with `implicitRole` and `context` under `fingerprint.metadata` |

`testId` is Core's highest-weighted signal (28 of 292) and `accessibleName` its
joint-second (24). Neither reached Core from a recording envelope before.

One surprise, pinned in the test because it is counter-intuitive: **the
element's own `<label>` text cannot reach `fingerprint.label` on this path at
all.** `normalizeFingerprint` reads `ActionTarget.label` (a display name)
first, then strips `metadata.label` as a promoted key. Carrying it is still
right — the metadata reaches every other consumer of the envelope — but Core
scores the display name. Only the Flow node's `elementFingerprint` gets `label`
right.

---

## The guards, proved by mutation

Five mutations, each applied, compiled, observed, and reverted. Every revert
re-checked clean (`tsc` exit 0).

| # | Mutation | Result |
| --- | --- | --- |
| 1a | Delete `context: elementContext(element.context),` from the fingerprint literal | exit **2**: `targets.ts(146,5): error TS1360: … Property 'context' is missing in type '{ selector: string \| undefined; … }' but required in type 'ContractFields<WebAutomationElementFingerprint>'.` |
| 1b | Rename that key to `elementContext` | exit **2**: `targets.ts(130,5): error TS2353: Object literal may only specify known properties, and 'elementContext' does not exist in type 'ContractFields<WebAutomationElementFingerprint>'.` |
| 1c | Remove `context` from the contract type — the escape hatch | exit **2** in four places: `targets.ts(130,5): error TS2353 … 'context' does not exist in type 'ContractFields<WebAutomationElementFingerprint>'` plus three `TS2339` in `output-nodes/tests/targets.test.ts` |
| 2a | Delete `testId: element.testId,` from the envelope metadata | exit **2**: `action-target.ts(134,7): error TS1360: … Property 'testId' is missing in type '{ tagName: string; … }' but required in type 'ContractFields<WebAutomationActionTargetMetadata>'.` |
| 2b | Reclassify `testId` as a `PromotedTargetField`, so the producer is "allowed" to drop it | exit **2** in three places: `action-target.ts(68,47): error TS2344: Type '"testId"' does not satisfy the constraint 'never'.` and `action-target.ts(130,7): error TS2353 … 'testId' does not exist in type 'ContractFields<WebAutomationActionTargetMetadata>'.` and `tests/action-target.test.ts(31,3): error TS2322: Type '"testId"' is not assignable to type '"label" \| "xpath" \| …'` |

2b is the one that matters: a field cannot be quietly reclassified out of the
contract, only argued out of it, and the argument fails to compile in the
producer, in the proof alias, and in the test's independently-written key list.

Test-level guards beside the compile-time ones: the envelope metadata's key set
asserted equal to a list of `WebAutomationActionTargetMetadata`'s keys written
independently in the test; each identity signal asserted to arrive with its
recorded value; and the whole target pushed through Core's own normalizer.

### Why `present<T>()` is not imported

The brief said to read the domain sibling first. I did, and I could not use it:
`domain/src/runtime/llm-evidence/present.ts` **is not exported from that
directory's barrel**, and `scripts/structure-audit/rules/imports.mjs` fails any
relative import that reaches past another directory's barrel into its files
(`severity: "fail"`, `ratchet: true`, and no baseline entry for either of my
files). Since I was also told not to run `pnpm structure:baseline`, a deep
import would have left the audit red.

So both files use the same idea expressed as a type instead of a function:

```ts
type ContractFields<T> = { [K in keyof Required<T>]: T[K] };
```

with `satisfies ContractFields<Contract>` on the literal. `-?` is deliberately
not used: it strips `undefined` from the value as well as the modifier, and the
whole point is that an optional field must be *mentioned* while still being
allowed to be absent. Mapping over `keyof Required<T>` removes the modifier and
leaves `T[K]` alone. Verified against all four properties before use, and by
the mutations above: missing key fails, renamed key fails, required key written
`undefined` fails, optional key written `undefined` compiles.

This is one line duplicated in two files, which is a smell. The fix is not
mine: see [open questions](#open-questions-and-contradictions).

---

## `form-context` re-measured

**Method.** The production chain, run in Node, the way `x-identity-wire` did
it. A descriptor for the `ambiguous-targets` **baseline** primary Continue
button, built as `describeElement` + `elementContext` would build it from the
fixture's markup → the real `gatewayRecordingEventFromPayload` (which calls the
wire projection) → the real `elementFingerprint` → the real
`scoreTargetCandidates`. Candidates are reconstructed as `candidateFingerprint`
describes each button of the `form-context` rendering. Run twice, byte-identical.

**What the recording carries, and what it does not**

The fixture records on `baseline`:

```html
<main><h1>Ambiguous targets</h1>
  <section aria-label="Primary">
    <button data-testid="choice-primary" data-choice="primary">Continue</button>
```

`elementContext` on that button yields `{ landmark: "region", heading:
"Ambiguous targets" }` — **no `formName`, no `formAction`, no
`fieldsetLegend`**, because the baseline page has no `<form>` and no
`<fieldset>`. The replayed `form-context` rendering gives each button
`formName`, `formAction` and `fieldsetLegend`, and both of them the same
`landmark: "main"` and the same heading.

**Level 2 selection, floor 0.35, margin 0.2**

| recorded identity | button:0 | button:1 | outcome | separation |
| --- | --- | --- | --- | --- |
| shipped wire (what the live replay measured) | 0.373 | 0.373 | ambiguous | 0.000 |
| wire fixed, `context` still dying here | 0.565 | 0.565 | ambiguous | 0.000 |
| **`context` carried (this change)** | **0.565** | **0.565** | **ambiguous** | **0.000** |

The first row reproduces the live replay's **0.37 / 0.37 to two decimals**,
which is what identifies the reconstruction as faithful: that figure was
measured before the identity signals crossed the wire, and the wire fix lifts
both candidates to 0.565 while leaving them exactly tied.

**Carrying `context` changes the score by nothing at all**, and the reason is
structural, not a bug in this change:

- `content/identity/score.ts` `comparableFingerprint` sends Core only the
  signals a candidate can also produce. `RecordedIdentity` has no `context`
  field, so there is nothing to send.
- Core has nowhere to put it. `ElementFingerprintWeights` names nineteen
  signals and **none** is a form, a landmark, a heading or a position.

**And it would not resolve even if the resolver did compare it.** Core's one
extensible scored slot is `attributes`, weight 6 of 292 — the same slot
`candidates.ts` measured the positional context through on 2026-09-12. Routed
through it:

| | button:0 | button:1 | separation | verdict |
| --- | --- | --- | --- | --- |
| the context **as actually recorded** (`landmark: region`, `heading`) | 0.562 | 0.562 | 0.000 | still a tie — the recording has nothing that distinguishes the two |
| counterfactual: **as if the recording had been made inside the primary form** | 0.587 | 0.556 | **0.031** | still a tie — 0.031 against a 0.2 margin |

So `form-context` needs two things this change is not, and neither is a wiring
change here:

1. **A recording that carries the form context** — the fixture's recorded page
   would have to have the forms, or the resolver would have to match the
   baseline's `<section aria-label="Primary">` against the armed page's
   `<legend>Primary</legend>`, which is a cross-field semantic match nothing in
   the pipeline does.
2. **A positional/contextual signal in Core's matcher with weight enough to
   clear the margin.** 0.031 is the same order as the 0.037 `candidates.ts`
   already measured and rejected for `listPosition`/`tablePosition`. This is a
   Core change.

**The brief's premise that item 1 "would resolve `form-context`'s 0.37 / 0.37
tie" is not correct, and `x-identity-wire`'s own note was closer**: it said the
fix was "adding it there **and** comparing `formName`/`fieldsetLegend` in
`comparableFingerprint`", two files, and named only one of them as mine. Both
halves are necessary; neither is sufficient; and even both together do not
clear the margin on the fixture as written.

## What this did not move

The brief also asked what item 1 does to any case D13 or D14 names. **Nothing**,
and that is checked three ways rather than argued:

- The Flow-node element before and after this change differs by **exactly one
  key**, `context` (printed by the measurement: `difference: ["context"]`).
- `RecordedIdentity` in `content/identity/score.ts` has no `context` field, so
  `comparableFingerprint` cannot read it whatever arrives.
- The **content harness ran green**, including `identity-resolution.spec.ts`,
  which pins `reworded-aria` at `bestScore` 0.389 and `confidence` 0.366 to
  three decimals, and covers `selector-only`, `text-only`, `moved` and
  `wrapped-aria`; `identity-veto.spec.ts` and `identity-ambiguity.spec.ts` also
  passed. Those are executed in a real browser, not reconstructed, and they are
  the same figures `x-identity-wire` published.

The only value-level change anywhere is the `attributes` narrowing, which drops
non-string attribute values. No fixture in this plan carries one.

---

## Commands run and observed results

Exit statuses by redirect into `<name>.txt` in the scratchpad, never a pipe.

| command | exit | observed |
| --- | --- | --- |
| `pnpm --filter @fluxiq-web-extension/domain check` | **0** | clean (`tsc -p tsconfig.json --noEmit && tsc -p tsconfig.test.json`) |
| `pnpm --filter @fluxiq-web-extension/domain test` | **0** | `# tests 343 # pass 343 # fail 0`, including the twelve new rows |
| `pnpm --filter @fluxiq-web-extension/extension check` | **0** | clean |
| `pnpm --filter @fluxiq-web-extension/extension test` | **0** | `# tests 294 # pass 294 # fail 0` |
| `pnpm --filter @fluxiq-web-extension/extension test:content` | **1** | `1 failed … 1 skipped, 200 passed (1.1m)`. The one failure is **not mine**: see below |
| `playwright test … scroll.spec.ts` (re-run 1) | **1** | a **different** row failed, same way: `Tearing down "openHarness" exceeded the test timeout of 30000ms` |
| `playwright test … scroll.spec.ts` (re-run 2) | **0** | `8 passed (6.1s)` — both previously failing rows green |
| `node scripts/structure-audit.mjs` | **0** | `passed (35 warning(s), 17 baselined)` |
| `tsc -p domain/tsconfig.json --noEmit` / `tsconfig.test.json`, five times under mutation | **2** ×5 | the table above; every revert re-checked at exit **0** |
| the `form-context` measurement, bundled with esbuild and run in Node | **0** | the tables above; run twice, `diff` exit 0 (byte-identical) |
| Core `normalizeAutomationStudioElementTarget` probe, before/after metadata | **0** | the signal sets above |

**The content-harness failure.** First run:
`e2e\content\tests\scroll.spec.ts:129:3 › on infinite-feed › untilStable: loads
every post, then stops because the document stopped growing` —
`Tearing down "openHarness" exceeded the test timeout of 30000ms`. That is a
fixture-teardown timeout, not an assertion: the test body passed. Re-running
the spec alone failed a **different** row (`:148:3`) in the **same** way, and a
third run passed all eight in 6.1s against 34.8s. Two different rows failing
the same teardown timeout, then both passing, is machine load — the brief says
Lab instances are running — not a regression. Nothing I changed is on the
scroll path: `elementFingerprint` and the recording envelope's target are not
reached by a content-script scroll action.

**The audit.** Passes. My change adds one advisory:
`domain/src/actions/types.ts` at **427 lines**, past the 400-line warn
threshold (hard limit 800). The two other new warnings between my first and
last audit runs (`apps/scenario-lab/e2e/` directory count, `identity-fixtures.ts`
exported values) came from another worker's files becoming tracked in commit
`ab736a1`, not from me. `pnpm structure:baseline` was **not** run, as briefed;
the audit's "3 baseline entries can be lowered" line is pre-existing.

**A note on the tree.** The supervisor committed the working tree
(`ab736a1 Live validation: what the green gates were actually measuring`) while
I was mid-task, so my changes are already in that commit. I ran no git
write command.

---

## Not verified

- **The live replay has not been repeated.** I cannot run the Lab. Whether a
  real Flow now carries `context` end to end, and whether the envelope target's
  new `testId`/`accessibleName` change anything Core does with a stored
  recording, is unproven until someone reruns the scenario. **Fixed pending
  live confirmation, not closed.**
- **`apps/extension/build/` is stale.** Tracked, and I was told not to run
  `pnpm build`. Nothing here changes the content bundle (all four source
  changes are in `domain/`), but the supervisor should rebuild before any
  browser test.
- **The `form-context` candidate fingerprints are reconstructed** from the
  fixture markup as `candidateFingerprint` would describe it, not read off a
  live page, and the recorded descriptor is built by reading `describeElement`
  and `elementContext` against the baseline markup rather than executed in a
  browser (no DOM implementation is installed in this repository). The evidence
  that the reconstruction is faithful is that the shipped-wire row reproduces
  the live replay's 0.37/0.37 to two decimals; that is evidence, not a capture.
- **The sensitivity change on the `focus.target` path is not exercised in a
  browser.** The new unit row proves a sensitive descriptor yields no contents;
  that a real focused password field reaches
  `createWebAutomationStateFromSnapshot` with `text` set is a code reading
  (`describeElement` has no sensitivity gate on `text`/`visibleText`), the same
  hole `x-identity-wire` reported and nobody owns yet.
- **`webAutomationActionVisualTargetFromElement`** — in the same file, not in
  the brief — is untouched. It carries `visibleText` with no sensitivity guard
  and is called with a **raw** descriptor from
  `apps/extension/src/background/connection/gateway-payloads.ts:168`. Its
  contract's `metadata` is an untyped `JsonObject`, so there is nothing to
  derive from; it is a display/highlight payload rather than an identity
  projection. I left it and am reporting it.
- **`elementStatePayload`** (`domain/src/recording/web-state/state-values.ts`)
  is a **fourth** hand-written projection of the same descriptor, and now that
  `WebAutomationElementStateInput` declares the five signals, it drops all five
  in the same silent way. Not mine; no regression from this change, since it
  dropped them before too.
- **Firefox, iframes, and anything downstream of the Flow node's `context`**
  are untouched.

---

## Open questions and contradictions

1. **The brief's item 1 premise is wrong, and the correction matters for the
   week's claims.** Carrying `context` does not resolve `form-context`, and
   nothing in this repository can: it needs a recording that carries form
   context and a Core signal with weight. The scenario's `form-context` variant
   currently declares `expected.actions[].outcome: "succeeded"` and
   `finalState: result === "primary"`, which the pipeline **cannot** satisfy.
   Either the fixture must record on a page that has the forms, or the variant's
   expectation is aspirational and should say so. `apps/scenario-lab/` is not
   mine.
2. **`present<T>()` should be promoted to a barrel-exported domain home.**
   There are now three expressions of one idea in `domain/src`: the function in
   `runtime/llm-evidence/present.ts` and the `ContractFields<T>` type in each
   of my two files. The type is one line and directly names its contract, so
   this is not a duplicated implementation — but it exists only because the
   function is unreachable past the llm-evidence barrel. Exporting it there, or
   moving it to a directory of its own, would replace both. Two must-not-touch
   paths, so not mine.
3. **`domain/src/actions/types.ts` is now 427 lines**, past the 400-line
   advisory. Sixty-one of those are mine, of which most are documentation.
   Trimming the docs or splitting the file are both reasonable; splitting is
   the better answer and is a change to a file I do not own.
4. **`ActionTarget.label` shadows the element's `<label>` in Core's
   fingerprint.** Core reads the display name as the `label` signal and strips
   `metadata.label`. Making it correct means putting `element.label` at the
   front of the display chain, which changes what every recorded target is
   *called*. Pinned in a test as the current behaviour; worth a decision.
5. **Should `type:` fall through to `implicitRole`?** The envelope target's
   `type` is `role ?? inputType ?? tagName`. Now that `implicitRole` is
   available on the input type it is the natural third rung, and Core reads
   `ActionTarget.type` nowhere — but changing it would change existing
   recordings' `type`. Left alone deliberately.
6. **`domain/src/recording/web-state/types.ts` and the extension's
   `WireElementTarget` now declare the same field set.** They are two
   declarations of one wire shape kept in step by nothing but tests. Worth
   naming that in the architecture docs, or generating one from the other, if
   the boundary allows.
