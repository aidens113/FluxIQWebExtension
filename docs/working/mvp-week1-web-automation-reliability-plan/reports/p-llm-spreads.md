# Report: p-llm-spreads

Worker: `p-llm-spreads`. Converting `domain/src/runtime/llm-evidence/` off
fresh-value spreads so the `contract-spread` rule can be configured for it, and
configuring it.

## Outcome

**Done.** All 53 flagged spreads are gone from the directory, the path is
configured, and `node scripts/structure-audit.mjs --rule contract-spread` is
**exit 0** with it in the config — which is the acceptance test the task
exists for. The packet is byte-identical for 14 representative inputs
(including all three budget-bitten cases and the three real browser captures),
and five mutation proofs are quoted below, all reverted byte-identically.

- Domain `check` **exit 0** (`tsc -p tsconfig.json --noEmit && tsc -p tsconfig.test.json`).
- Domain `test` **exit 0**, `# tests 331 # pass 331 # fail 0` — 326 before,
  plus five new rows in `tests/present.test.ts`.
- `node scripts/structure-audit.mjs --rule contract-spread` **exit 0**,
  `passed (0 warning(s), 0 baselined)`, with the new path configured.
- Full `node scripts/structure-audit.mjs` **exit 0**, zero failures, zero
  `FAIL` lines, and no warning naming anything I wrote.
- `.structure-baseline.json` unchanged; `pnpm structure:baseline` not run.
- Nothing committed.

Two things in here are not mechanical and should be read before the rest:
the helper **could not** be imported and why ([The import that is not
possible](#the-import-that-is-not-possible-measured-not-assumed)), and the
extension's `present<T>()` **cannot write half this module's types**, which is
a latent limit in a file I do not own ([The one thing that genuinely
differs](#the-one-thing-that-genuinely-differs)).

## The import that is not possible, measured not assumed

The brief asked me to check rather than assume. Three separate things stop it,
and the first was measured by probe rather than reasoned about:

1. **The structure audit forbids it.** A temporary
   `import { present } from "../../../../apps/extension/src/shared/present";`
   added to `domain/src/runtime/llm-evidence/location.ts` gives
   `node scripts/structure-audit.mjs --rule imports` **exit 1**:

   ```
     FAIL  [imports] domain/src/runtime/llm-evidence/location.ts:34: imports
     "../../../../apps/extension/src/shared/present", which resolves under
     apps/extension/src/. domain code must not depend on extension UI or browser
     implementation modules.
   ```

   Reverted; `git status --porcelain` on that file is empty and the rule is
   back to **exit 0**.
2. **The package does not depend on the extension.** `domain/package.json` has
   two dependencies, `fluxiq` and `@fluxiq/client-gateway-websocket`, both
   links into Core. There is no specifier that resolves; only a relative path
   out of the package would, which is what (1) forbids.
3. **It is a value.** `v-producer-safety` put `present` in the extension for
   exactly this reason and said so — a type import across the boundary erases,
   a value import does not. Nothing about that has changed.

So: a sibling helper in the domain,
`domain/src/runtime/llm-evidence/present.ts`. Same name, same signature shape,
same nine-line runtime, and a header that says it is the extension's idea and
why it is not the extension's file. It is **not** a second divergent
mechanism — a call site reads identically in both packages — with one
exception, below, which is a bug fix rather than a divergence of taste.

I put it inside the directory rather than somewhere shared in
`domain/src/` because `domain/src/runtime/llm-evidence/**` is what I own.
`domain/src/client/` is the next path in this rule's queue and will want the
same helper; whoever takes that brief should promote this file to a shared
domain home rather than copy it, and the header says so.

### The one thing that genuinely differs

The extension's guard against a call that names no type argument is
`type EvidenceFields<T> = object extends T ? never : ...`. That condition is
also true of any type whose keys are **all optional** — `object` is assignable
to a weak type — so the extension's helper cannot write such a type at all.
Probed under this repository's own flags (`strict`,
`exactOptionalPropertyTypes`, `noUncheckedIndexedAccess`), with the extension's
file copied verbatim:

```
probe.ts(7,32): error TS2345: Argument of type '{ role: string; name: undefined;
modal: undefined; selector: string; }' is not assignable to parameter of type 'never'.
```

That is fatal here, because **half this module's packet types are that shape**:
`WebLlmPageContext`, `WebLlmEvidenceDialog`, `WebLlmSanitizeOptions`, and the
inline `loading` and `navigation` records. The page-evidence contract happens to
give every one of its types a required field, so the extension has never met it.

The sibling keys the guard on the type parameter's **default** instead:

```ts
declare const CONTRACT_TYPE_NOT_GIVEN: unique symbol;
type ContractTypeNotGiven = { [CONTRACT_TYPE_NOT_GIVEN]: true };
type PacketFields<T> = [T] extends [ContractTypeNotGiven] ? never : NoInfer<RequiredFields<T> & OptionalFields<T>>;
export function present<T extends object = ContractTypeNotGiven>(fields: PacketFields<T>): T;
```

It fires when and only when the caller named no type, which is what the
original guard was reaching for. Seven cases were compiled before this shipped:
an all-optional type writes (was `never`), a mixed type writes, no type
argument errors, a renamed key errors, a deleted optional key errors, a
required key given `undefined` errors, and an anonymous type reached through
`NonNullable<Ctx["loading"]>` writes. Exit 0 with the four negative cases under
`@ts-expect-error`.

**`apps/extension/src/shared/present.ts` has the same latent limit and I did
not touch it** — it is in my Must-not-touch. It is harmless today and becomes a
compile error the first time an all-optional contract type is written there.

## What changed

53 flagged spreads across six files, all gone. The counts are the audit's own,
from the run with the path configured and before any edit.

| File | Spreads | What they were |
| --- | --- | --- |
| `elements.ts` | 21 | 15 in `sanitizedEvidenceElement`, 5 in `elementPlacement`, 1 in `tablePlacement` |
| `page-evidence.ts` | 21 | the six page-context items, the frame, loading, navigation, each dialog, the blocker |
| `sanitize.ts` | 5 | the packet assembly, including `...webLlmPageContext(...)` |
| `tools.ts` | 3 | the two `WebLlmSanitizeOptions` call sites |
| `tests/limits.test.ts` | 2 | `{ ...largePage(n), truncated: true }` fixtures |
| `tests/page-evidence.test.ts` | 1 | the conditional `evidence` key in the fixture builder |

New: `present.ts` (the helper) and `tests/present.test.ts` (six runtime rows
and four `@ts-expect-error` rows, below). `scripts/structure-audit/config.mjs`
gains one entry with its own `reason` and `remedy`, and nothing else — the diff
against a pre-edit copy is exactly five lines.

Four conversions were more than a rewrite of the literal, and each is a
restatement removed rather than moved:

- **`elementPlacement` returned `Partial<WebLlmEvidenceElement>`.** A partial is
  the same hole in type clothing: delete a clause and the field simply stops
  arriving. It now returns
  `{ [K in "form" | "landmark" | "heading" | "item" | "cell"]: WebLlmEvidenceElement[K] }`
  — a projection of the contract, every key required at the site, values free to
  be `undefined` — and the caller writes the five fields by name.
- **`listPlacement` and `tablePlacement` returned `{}` or `{ item: ... }`** for
  their caller to spread, which put `item` and `cell` in a second place. They
  return the value now, and the caller names the key.
- **`safeLocationField("referrer", ...)` returned `{ [key]: string }` or `{}`.**
  Same shape of restatement — a helper holding a contract field's name. It is
  `safeLocation(input): string | undefined` now, and `evidenceNavigation` names
  the field.
- **`sanitize.ts` spread `webLlmPageContext(...)` in whole.** It now carries the
  six page-context fields across by name, so a field renamed or dropped in
  `page-evidence.ts` fails in `sanitize.ts` too instead of quietly leaving the
  packet.

Two fields deserve their own note because `present` requires every key to be
mentioned and these two are written by nobody at their site:

- `webLlmPageContext` writes `elementTotal: undefined` — it is the element
  funnel's number, which `sanitize.ts` supplies beside the elements it counted.
- `sanitize.ts` writes `budgetTruncated: undefined` — `trimToBudget` sets it if
  and only if a removal was needed.

Both are stripped, both carry a comment saying who does write them, and naming
them is the point: the alternative is a key nobody mentions, which is the shape
of the defect.

**Every truthiness guard was preserved exactly**, following `v-producer-safety`:
`...(role ? { role } : {})` became `role: role || undefined`, not `role`, and
`...(blocks ? { blocks } : {})` became `blocks: blocks || undefined` so a
zero-valued `blocks` is still dropped. Most of the string guards are provably
redundant — `boundedText` returns `undefined` rather than `""` — but a
mechanical conversion should not also change semantics, and the golden diff
below is worth more when nothing but the spelling moved.

**The two test-file spreads were not laundered into named locals.** Naming a
fresh value and spreading the name is the hole the rule leaves, and doing it to
satisfy the rule would be the worst possible response. `largePage` took an
`extra: Record<string, unknown> = {}` parameter instead, so the spread is of a
named parameter; the fixture builder in `page-evidence.test.ts` writes
`snapshot.evidence = evidence` under its `if` instead of a conditional spread.

### The negative control is live production code

`reveal.ts:55` is `return { ...matches[0]!, selector };` — a spread of a named,
contract-typed value inside a configured path — and the audit does **not**
report it, correctly: every key the literal writes beside it is still
excess-property checked, and every key the spread brings in came from a value
the compiler already types. `tests/tools.test.ts` has seven more of the same
shape (`{ ...base, callId, toolId, value }`) and none is reported. That is the
fresh-versus-named distinction working on real code in this directory, not on a
fixture.

## The mutation proofs

Five, all against a saved pristine copy, all reverted; `md5sum` on
`elements.ts` and `sanitize.ts` matches the pre-mutation hashes
(`d076c412…`, `c36f4c63…`) and both were re-audited clean afterwards.

### 1. A packet field renamed where it is written

`elements.ts`, `role:` to `roel:` inside `present<WebLlmEvidenceElement>`.
Domain `check` **exit 2**:

```
src/runtime/llm-evidence/elements.ts(111,5): error TS2353: Object literal may only
specify known properties, and 'roel' does not exist in type
'RequiredFields<WebLlmEvidenceElement> & OptionalFields<WebLlmEvidenceElement>'.
```

### 2. An optional field deleted

`elements.ts`, the `landmark:` line removed. This is the half no ordinary type
can catch, because absence is exactly what optional means. **Exit 2**:

```
src/runtime/llm-evidence/elements.ts(106,41): error TS2345: Argument of type '{ target:
string; tag: string; selector: string; frameId: number | undefined; ... }' is not
assignable to parameter of type 'RequiredFields<WebLlmEvidenceElement> &
OptionalFields<WebLlmEvidenceElement>'.
  Property 'landmark' is missing in type '{ ... }' but required in type
  'OptionalFields<WebLlmEvidenceElement>'.
```

An element with no landmark still ships with no `landmark` key — that is a
runtime row in `present.test.ts`. What is no longer possible is a producer that
stops *considering* the field.

### 3. The field renamed on the contract type itself

`WebLlmEvidenceElement.landmark` to `landmarkRole`. **Exit 2**, and it fails in
both places at once — the producer and the placement projection:

```
src/runtime/llm-evidence/elements.ts(126,5): error TS2353: Object literal may only
specify known properties, and 'landmark' does not exist in type
'RequiredFields<WebLlmEvidenceElement> & OptionalFields<WebLlmEvidenceElement>'.
src/runtime/llm-evidence/elements.ts(191,93): error TS2536: Type 'K' cannot be used to
index type 'WebLlmEvidenceElement'.
```

The second line is the projection type earning its place: it would have been
silent as `Partial<WebLlmEvidenceElement>`.

### 4. The negative control, and the reason this task exists

`elements.ts`, every key still mentioned, one extra arriving through a
conditional spread beside them:

```ts
    text: text || undefined,
    ...(text ? { txet: text } : {}),
```

Domain `check` is **exit 0 and completely silent**:

```
> @fluxiq-web-extension/domain@0.1.0 check F:\!FluxIQWebExtension\domain
> tsc -p tsconfig.json --noEmit && tsc -p tsconfig.test.json
```

`node scripts/structure-audit.mjs --rule contract-spread` is **exit 1**:

```
  FAIL  [contract-spread] domain/src/runtime/llm-evidence/elements.ts: 1 property spread
  into an object literal, at line 114. Here this directory builds the sanitized, bounded
  packet that is the only page data a language model ever sees, and a field that stops
  arriving there fails nothing -- the model simply reasons with less, and TypeScript runs
  no excess-property check on a property that arrives through a spread, so a renamed or
  deleted contract field leaves the wire with every gate green. Write each field by name
  through `present<T>()` (domain/src/runtime/llm-evidence/present.ts), which omits the
  ones that are undefined and makes a renamed or deleted field a compile error. Spreading
  a named value of the same type -- `{ ...snapshot, one: change }` -- is allowed and still
  checked; a conditional, a call or a literal is not.

structure-audit: 1 violation(s) across 1 rule(s).
```

The compiler is silent, the 331-test suite never type-checks, and the audit is
the only gate that speaks. That is the whole argument for configuring the path.

### 5. The cross-module carry

`sanitize.ts`, `blockedBy:` to `blockedby:` where the page context is carried
across. **Exit 2**, and TypeScript even names the fix:

```
src/runtime/llm-evidence/sanitize.ts(110,5): error TS2561: Object literal may only specify
known properties, but 'blockedby' does not exist in type 'RequiredFields<WebLlmPageEvidence>
& OptionalFields<WebLlmPageEvidence>'. Did you mean to write 'blockedBy'?
```

Under the old `...webLlmPageContext(...)` this was not a possible error, because
there was no `blockedBy` written in that file to misspell — the field arrived
through a spread and the packet's key set was never checked here at all.

## Byte-identical, measured

A harness bundles the module the way `domain/scripts/test-domain.mjs` bundles a
test (esbuild, `fluxiq` external, output into the ignored
`.test-build-scratch/`) and serializes:

- **14 whole packets** through `sanitizeWebLlmSnapshotWithBindings`, with the
  `JSON.stringify` of each, its `Object.keys` in order, and its selector
  bindings. The inputs cover a 20-element rich page (frames, stamped frame ids,
  select options, a sensitive `billing cc-number` control, list and table
  placement, focus, an off-origin link, an unaddressable element), a minimal
  page, a child-frame capture, an ordinary navigation, a settled page, a page
  over the 40-element bound, and **the three real browser captures** in
  `domain/src/page-evidence/capture.ts`.
- **Three budget-bitten cases**: `maxEvidenceBytes: 900`, `budget: "failure"`
  (Core's 3,000-byte gate), and `maxEvidenceBytes: 400`, which trims all the
  way to `elements: []`. This is the "if your change alters what is emitted when
  the budget bites" question, answered by measurement.
- **28 direct reader calls** — `webLlmPageContext` with and without child
  frames, `evidenceElementTotal`, `capturedTruncated` — so a key-order change
  inside a reader shows even where the packet would have hidden it.
- **20 element serializations** through `sanitizedEvidenceElement`.

`md5sum` of the whole output, before and after:

```
8b0548e99b3c24f77013b7b6a14cca8d  golden-before.json
8b0548e99b3c24f77013b7b6a14cca8d  golden-after.json
```

`diff` exit 0. Re-run twice more after the later edits; identical each time.
46,823 bytes of output, not one of them moved.

**Why it is identical rather than merely equal**: `present` writes keys in the
literal's order and drops only the `undefined` ones, and every literal was
rewritten in the original insertion order — including `...webLlmPageContext(...)`,
whose six fields now sit in `sanitize.ts` in the order that function built them,
and `...placement`, whose five fields now sit last in the element literal in the
order `elementPlacement` built them.

**The budget path is unchanged for a second reason worth stating.**
`trimToBudget` decides by `evidence[field] !== undefined` and removes by
`delete`. An absent optional field is still an absent key, not a key holding
`undefined`, so every one of those tests answers the same way it did — which is
the property the truncation work established and the one a naive "just build the
whole object" fix would have destroyed.

## The guarantee is asserted by every build

`domain/src/runtime/llm-evidence/tests/present.test.ts`, six runtime rows and
four `@ts-expect-error` rows. `tsconfig.test.json` includes `src/**/*.ts`, so
the directives are checked by `pnpm --filter @fluxiq-web-extension/domain check`.

The directives are the half that matters: they fail the build the moment any of
them *stops* being an error — if `PacketFields<T>` is "simplified" to
`Partial<T>`, if the `NoInfer` is dropped, if the guard is replaced with the
extension's. One row carries no directive and must keep compiling
(`present<WebLlmEvidenceDialog>({ role: undefined, ... })` returning `{}`): it is
the row that fails if closing the hole ever makes an optional packet field
mandatory, which would be worse than the hole.

Verified live rather than assumed. A first version placed one directive above a
multi-line call instead of above the offending property and `check` reported
`TS2578: Unused '@ts-expect-error' directive` — the same control
`v-producer-safety` ran. Fixed and re-checked.

The runtime rows: an absent optional field is a missing key
(`"name" in value === false`), `false` and `0` and `""` survive, key order is the
literal's, and an all-optional packet type is writable at all.

## Commands run and observed results

`DOMAIN_TEST_BUILD_LABEL=p-llm-spreads` on every package command. Every exit
status captured by redirecting to a file and echoing `$?`, never through a pipe.
**No `pnpm build`, no `pnpm lab` of any kind, no `pnpm structure:baseline`, no
root `pnpm check`, no commit.**

- `pnpm --filter @fluxiq-web-extension/domain check` → **exit 0**, no
  diagnostics. Run seven times; every failure in between was a deliberate
  mutation, quoted above, except the one in the note below.
- `pnpm --filter @fluxiq-web-extension/domain test` → **exit 0**,
  `# tests 331 # pass 331 # fail 0`. Was 326 before. The five new rows observed
  green by name: `ok 224`–`ok 228`.
- `node scripts/structure-audit.mjs --rule contract-spread` → **exit 1** with
  the path configured and the module untouched, listing all 53 across six files;
  **exit 0** after the conversion, `passed (0 warning(s), 0 baselined)`; and
  **exit 0** again after each mutation was reverted.
- `node scripts/structure-audit.mjs` (all rules) → **exit 0**,
  `passed (32 warning(s), 17 baselined)`, `failures 0`, and no row naming
  anything under `llm-evidence`. The warning count moved from 31 to 32 while I
  worked; that is another agent's edit, not mine, and it was measured rather
  than assumed: with this report moved out of the tree the run is **32
  warnings** too, and putting it back changes nothing.
- `node scripts/structure-audit.mjs --rule imports` → **exit 1** under the
  boundary probe, **exit 0** after reverting it.
- Two scratch TypeScript probes under this repository's exact flags: the
  extension's `present.ts` verbatim against an all-optional type (the `never`
  result above), and the default-guard form over seven cases (**exit 0**).
- The golden harness, three runs, `md5sum` identical each time.
- `git diff --numstat` over everything I own: partial diffs on all seven files,
  no whole-file rewrite, so nothing changed line endings. The repository is CRLF
  throughout and stayed that way.

**One surprising failure, re-run once per the wave rule, and it was not mine.**
A `check` mid-session came back **exit 2** with 30-odd errors led by
`src/io/gateway-input-hub.ts(1,15): error TS2724: '"fluxiq"' has no exported
member named 'ClientGatewayEvent'` and a cascade of `TS7006` implicit-`any`s in
`io/`, `output-nodes/`, `runtime/adapter.ts` and `runtime/llm-evidence/tools.ts`
— every one of them a symptom of the linked `fluxiq` package's types being
mid-write in `F:\!FluxIQ` by another agent. The immediately preceding run had
reported only my own two expected errors, and the immediately following run was
**exit 0** with none. Not RAM, and not this change: no error named a file I
wrote, and all of them named the dependency.

## Not verified

- **No browser validation, and none was run.** This module is pure Node code
  over an untrusted JSON snapshot; it touches no browser API. What a real
  browser would exercise is the *input* — and the three checked-in captures in
  `domain/src/page-evidence/capture.ts` are exactly that, driven through the
  changed code in the golden harness with identical output. But no fresh capture
  was taken and `pnpm --filter extension test:content` was not run.
- **`pnpm build` and root `pnpm check` were not run**, on the brief's
  instruction and to stay off the Lab. Ten packages type-check under root
  `pnpm check`; only the domain's was run here. Nothing outside
  `domain/src/runtime/llm-evidence/` imports any signature I changed — the four
  helpers I reshaped are module-private and the two test helpers are file-local,
  and a grep for the module's exported names across `apps/`, `packages/` and the
  rest of `domain/src` finds only comments and `vocabulary.ts` constants, which
  are untouched — but that is reasoning, not a run.
- **`domain/.test-build/` and `apps/extension/build/` were not regenerated**,
  for the reason every worker this wave has given: it means running without a
  label and racing everyone.
- **The byte-identity claim is for 14 packets, 28 reader calls and 20 elements,
  not for all possible inputs.** The cases were chosen to hit every branch I
  touched and they do, including the three-way truncation matrix and an element
  with no `context` object at all. It is a very strong sample, not a proof.
- **The extension's `present.ts` limit is described from a probe against a copy,
  not from changing that file.** It is in my Must-not-touch and I did not edit
  it. The probe used the file verbatim.
- **Nothing committed.**

## Open questions or contradictions found

- **`apps/extension/src/shared/present.ts` cannot write an all-optional contract
  type, and nobody knows it yet.** Measured above. It is inert today because
  every `page-evidence` contract type has a required field. The moment one does
  not — or the moment the merge in `dom-snapshot.ts` reaches for an optional-only
  shape — it is a confusing `not assignable to parameter of type 'never'`. The
  one-line fix is this file's default-based guard. It is one clause in a file I
  may not touch, and it is worth someone's five minutes because the failure mode
  reads like a bug in the caller.
- **The two `present` implementations should become one, and not by copying.**
  They are now the same idea in two packages, and `domain/src/client/` — the next
  path in this rule's queue, 33 spreads — will want a third call site. The right
  shape is probably one helper in a shared domain home that `domain/src/client/`
  and this directory both import, with the extension keeping its own for the
  boundary reason. Whoever takes the gateway-mapping brief will hit this
  immediately; a note in the plan would save them the decision.
- **`p-spread-rule`'s "the hole this leaves" is a live temptation in test
  files, and it nearly caught me.** Two of the 53 were fixture builders where the
  three-second fix is `const p = largePage(2); { ...p, truncated: true }` —
  which satisfies the rule and closes nothing. I gave the builder a parameter
  instead. Anyone converting the remaining paths will meet the same shortcut,
  and it is worth the plan saying out loud that a named local is not a fix.
- **`domain/src/client/` is now the only wire-adjacent path still unconfigured**,
  at 33 spreads. `p-spread-rule` named both; one is done.
- **The audit reports `3 baseline entries can be lowered` and I did not lower
  them.** `pnpm structure:baseline` is off-limits per the brief, and one of those
  entries is a wall another worker needs. Recording it here so it is not
  mistaken for a regression: the full audit is **exit 0** and that line is
  informational.
- **`AGENTS.md`'s sentence about what this repository's structure-audit config
  adds beyond Core's is still incomplete**, as `p-spread-rule` reported — it
  names the `domain/src` import boundary but not `contractSpreadPaths`, which now
  has four entries. Outside my Owns, still one clause.
