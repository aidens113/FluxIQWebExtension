# Report: p-spread-rule

Worker: `p-spread-rule`. Making the spread ban mechanical: a structure-audit
rule in FluxIQ Core, configured here for the directories that build the
page-evidence wire contract.

## Outcome

**Done.** The rule exists in Core, is mirrored here byte-for-byte, is
configured for three paths, reports zero findings today, and fails with a
message that names the remedy. Both mutation proofs are quoted below and both
were reverted byte-identically.

Every required gate reached exit 0. Two of them only after a detour through
another agent's in-flight work in Core, which is worth reading before the
design section because it is the only reason this took two attempts:
[Three red gates that were not mine](#three-red-gates-that-were-not-mine).

- Core `pnpm check` **exit 0** (`structure:test` 63/63, audit passed, four
  packages type-checked). A later re-run on a tree three agents had moved is
  **exit 1** on one `working-docs` row belonging to whoever is editing Core's
  plan document; its type-check half, `pnpm -r check`, is **exit 0** on that
  same later tree.
- Core `pnpm -r test -- --no-file-parallelism` **exit 0** — 358 test files,
  1,998 tests, zero failures.
- Core `pnpm docs:check` **exit 0**.
- Core `pnpm build` **exit 0**.
- This repository's `pnpm check` **exit 0** (`structure:test` 63/63,
  `lab:test` 7/7, audit passed 31 warnings / 19 baselined, ten packages
  type-checked).
- Neither `.structure-baseline.json` changed. The rule needs no entries,
  which is the point of the scoping decision below.

## The design decision, and the probe that settled it

The brief framed the defect as a *conditional* spread. That is where all 46
instances were, but it is not the mechanism, and a rule aimed at the ternary
would have been evadable by three other spellings while flagging code that is
provably safe. So the line was drawn against `tsc` rather than against the
shape of the historical bug. Five cases, compiled under this repository's own
flags (`--strict --exactOptionalPropertyTypes`):

| Written | `tsc` says |
| --- | --- |
| `{ ...whole, titel: v }` | **TS2353** — 'titel' does not exist in type 'Contract' |
| `{ selector: v, ...(cond ? { titel: v } : {}) }` | *nothing* |
| `{ selector: v, ...boundsOrNone() }` where the helper returns `{ boundz?: … }` | *nothing* |
| `{ ...whole, selektor: v }` | **TS2561** — did you mean 'selector'? |
| `{ ...whole, selector: v }` | *nothing* (correct) |

Read the first and fourth rows against the second and third. TypeScript's
excess-property check runs on the keys a literal **writes out** — the presence
of a spread beside them does not switch it off — and never on the keys a
spread **brings in**. So the dangerous thing is not "a spread"; it is a
property arriving through a spread of a value nothing has checked.

**The rule therefore flags a spread of a *fresh* value and allows a spread of a
*named* value.**

- Flagged: `...(cond ? { k } : {})`, `...(cond && { k })`, `...(x ?? {})`,
  `...{ k }`, `...fn(x)`, `...(x as T)`.
- Allowed: `...evidence`, `...this.state`, `...entry.snapshot.evidence`,
  `...byId[key]`, with parentheses and `!` treated as transparent.

Why the allowance is principled rather than convenient: in
`{ ...topSnapshot, interactiveElements: merged }` every key the literal writes
is still excess-property checked (row 4), and every key the spread brings in
came from a value the compiler already types as the contract — so a rename
moves both sides at once, a deletion removes both, and an addition is carried
through correctly. That is copy-with-override, not property laundering.

It is also the difference between a rule and a rule nobody can satisfy.
`dom-snapshot.ts` still contains two such spreads after `v-merge-safety`
(`...topSnapshot` at line 170, `...frameSnapshot` at line 282), both of that
exact shape. A blanket ban on `ts.isSpreadAssignment` — which is what both
prior reports proposed — would have failed the build on the very file the rule
exists to protect, and I do not own source. Those two lines are live in the
tree and unreported; they are the negative control, and it is a control made of
production code rather than a fixture.

### The hole this leaves, stated rather than hidden

```ts
const extra = cond ? { titel: label } : {};
const item: DialogEvidence = { selector, ...extra };
```

Silent to `tsc` (verified, exit 0) and silent to this rule. Naming a fresh
value defeats a syntactic audit; only a type-aware pass would see it. It is a
longer way to write the defect than the one that is now blocked, and
`present<T>()` makes it read against the grain in these directories — its
parameter type requires every contract key to be mentioned, so a spread of a
partial into a `present()` call fails on the missing keys. But it is not
closed, and nobody should read this rule as saying it is.

## Scope: what is configured, and why each thing is in or out

A repository-wide ban would be wrong, and the number says how wrong: a parse of
every tracked script file in this repository finds **~1,460 object spreads
across 105 directories**. Nearly all are ordinary copy-with-override.

**In** (`contractSpreadPaths` in `scripts/structure-audit/config.mjs`):

| Path | Why | Spreads today |
| --- | --- | --- |
| `apps/extension/src/content/evidence` | the content script's producer of the page-evidence contract; `v-producer-safety` removed 33 conditional spreads here | 0 flagged (6 named-value spreads in its two test files) |
| `apps/extension/src/background/connection/dom-snapshot.ts` | the second producer, rebuilding and merging every frame's evidence; `v-merge-safety` removed 13 | 0 flagged (2 named-value) |
| `domain/src/page-evidence` | the contract's own home — its declaration, its wire reader, and the checked-in captures the producers are measured against | 0 |

**Out**, with the reason, because "why not this one too" is the question a
reader will have:

- **The rest of `apps/extension/src/background/connection/`.** 47 spreads in
  `gateway-payloads.ts`, `recording-evidence.ts`, `runtime-status.ts` and
  friends. They assemble gateway payloads and runtime status, not the evidence
  contract. This is why the second entry is a **single file** rather than its
  directory — the rule takes a directory prefix or an exact file, and the
  producer's neighbours are not producers.
- **`domain/src/client/` (33) and `domain/src/runtime/llm-evidence/` (52).**
  Both are genuinely wire-adjacent — the gateway mapping, and the sanitized
  packet downstream of the contract. Both would need their own cleanup wave
  before they could be listed, because a configured path must already be clean
  (below). Listing them is the natural next brief, not something to do here.
- **`apps/extension/src/shared/present.ts`.** The helper builds its result by
  iterating entries, not by writing a literal, so a spread there could not name
  a contract field.
- **`packages/test-runner/` (335+).** Harness code; produces no contract.

**Test files inside a configured path are included**, deliberately. All six
existing ones pass — they are `{ ...base, override }` fixture builders — and
`forms.test.ts` has `const stripped: FormControlEvidence = { ...described }`,
a contract-typed value that would be worth flagging if it were built freshly.
Excluding tests would have been a carve-out with nothing behind it.

**Core configures none.** `contractSpreadPaths: []` there, with the reason in
the file: Core's contracts are declared and checked inside
`packages/contracts`, and nothing in Core assembles another repository's
evidence shape by hand. This is the same shape as `importBoundaries`, which is
empty in Core and populated here.

## Baselining, and why the rule needs no entries

The finding is `severity: "fail"`, `ratchet: true`, keyed by file path, valued
at the number of offending spreads in that file — the same shape as
`test-placement`'s per-directory count, so an entry can shrink and never grow.

Worth being precise about what that buys, because "baselined like every other"
can be read as "existing violations get recorded away", and after the Wave 1
fix to `planBaselineUpdate` that is not what happens: **`--update` never adds
an entry and never raises one.** A ratcheted violation with no entry blocks the
update and nothing is written. So the ratchet's real behaviour for a new rule
is: a path can only be configured once it is clean, and `pnpm structure:baseline`
refuses to paper over it.

That is the right pressure and it is why the scoping above matters — the
"existing violations elsewhere do not fail the build" property comes from
*not configuring* the 105 dirty directories, not from recording them. Both
producers were cleaned by the two prior workers before I listed them, which is
why the rule lands green. The config comment says this so the next person does
not add a dirty path and then discover the baseline will not take it.

Neither `.structure-baseline.json` was modified. `git status --porcelain` on
both is empty. I did not run `pnpm structure:baseline` in either repository.

## The message

The brief's third design point was that a rule nobody can act on gets
disabled. Each configured entry carries a `reason` (why this path is watched)
and a `remedy` (what to reach for here), and both go into the message, so the
text is specific to the directory rather than generic. Proof 1 below is the
whole message, unedited.

## The mutation proofs

Both reverted; `md5sum` and `diff` against a pre-mutation copy report both
files byte-identical, and `git status --porcelain` on both is empty.

### Proof 1 — a conditional spread in the directory-configured producer

Added to `apps/extension/src/content/evidence/dialogs.ts`, inside
`describeDialog`'s `present<DialogEvidenceItem>({ … })` call:

```ts
    ...(label ? { titel: label } : {})
```

`node scripts/structure-audit.mjs --rule contract-spread` → **exit 1**:

```
  FAIL  [contract-spread] apps/extension/src/content/evidence/dialogs.ts: 1 property spread into an
  object literal, at line 73. Here this directory is the content script's producer of the
  page-evidence wire contract, and TypeScript runs no excess-property check on a property that
  arrives through a spread, so a renamed or deleted contract field leaves the wire with every gate
  green. Write each field by name through `present<T>()` (apps/extension/src/shared/present.ts),
  which omits the ones that are undefined and makes a deleted field a compile error. Spreading a
  named value of the same type -- `{ ...snapshot, one: change }` -- is allowed and still checked; a
  conditional, a call or a literal is not.

structure-audit: 1 violation(s) across 1 rule(s).
```

**And the half that makes the rule worth having.** Under that same mutation,
`pnpm --filter @fluxiq-web-extension/extension check` reported **zero errors
naming `dialogs.ts`** (`grep -c dialogs.ts` → `0`). The only diagnostics in
that run were three pre-existing `TS2339`s in
`background/connection/recording-start/tests/handshake.test.ts`, another
worker's in-flight file, and they were gone by the time I ran the full check.
`present<T>()` does not catch this one: every required key is still mentioned,
and the excess key rides in on the spread. So the compiler is silent, the unit
suite never type-checks, and the audit is the only gate that speaks.

### Proof 2 — three spellings at once, in the file-configured producer

Added to `apps/extension/src/background/connection/dom-snapshot.ts`, inside
`mergeDialogEvidence`'s `present<DialogEvidence>({ … })`:

```ts
    ...(native ? { lastNativ: native } : {}),
    ...(native && { nativ: native }),
    ...boundsOrNone(native)
```

The ternary, the `&&` form, and a call to the exact restatement helper
`v-merge-safety` deleted. **Exit 1**, one ratcheted finding valued 3:

```
  FAIL  [contract-spread] apps/extension/src/background/connection/dom-snapshot.ts: 3 properties
  spread into object literals, at lines 362, 363, 364. Here this file is the second producer of
  that contract, rebuilding and merging every frame's evidence, and TypeScript runs no
  excess-property check on a property that arrives through a spread, so a renamed or deleted
  contract field leaves the wire with every gate green. Write each field by name through
  `present<T>()` (apps/extension/src/shared/present.ts): its parameter type requires every contract
  key to be mentioned, which is what makes the merge exhaustive. Spreading a named value of the
  same type -- `{ ...snapshot, one: change }` -- is allowed and still checked; a conditional, a
  call or a literal is not.

structure-audit: 1 violation(s) across 1 rule(s).
```

The negative control is in the same run: lines 170 and 282 of that file hold
`...topSnapshot` and `...frameSnapshot` and are **not** reported. Live
production code, not a fixture.

## Three red gates that were not mine

Core is being edited by at least two other agents while I worked, and three of
its gates were red at some point for reasons that had nothing to do with this
change. Each is recorded because "I re-ran it and it went green" is not an
explanation, and because two of them are still live facts for the supervisor.

**1. `pnpm docs:check`, first run → exit 1. Now exit 0.**
Its first half passed —
`Validated local links in 99 authored/reference Markdown files.` — which is the
half my two documentation edits could have broken. Its second half reported
`docs/reference/framework-reference.md is stale`. That file is generated by
TypeDoc from the public exports of `packages/fluxiq/src/index.ts` and nothing
else, so none of my files is an input to it. Rather than assert that, I
measured it: copied both generated files aside, ran `pnpm docs:reference`, and
diffed. **The entire staleness was one line:**

```
-| `AutomationStudioClientGatewayBridge` | Class | `…/client-gateway/bridge.ts:56` | - |
+| `AutomationStudioClientGatewayBridge` | Class | `…/client-gateway/bridge.ts:84` | - |
```

A line-number drift from another agent's in-flight edit to
`…/client-gateway/bridge.ts`, which appeared in `git status` between two checks
I ran twenty minutes apart. Regenerating it would have baked somebody's
half-finished public-surface change into a tracked artifact, so I restored both
files: `md5sum` back to `7c35cb56…`, `git status --porcelain docs/reference/
packages/fluxiq/docs/` empty. That agent has since regenerated them properly —
the file now hashes `744d0087…` and carries exactly that one-line diff — and
`pnpm docs:check` is **exit 0**.

**2. `pnpm build`, first two runs → exit 1. Now exit 0.**
Diagnosed under [Commands](#commands-run-and-observed-results): the first run's
`next build` survived the tool call, the retry raced it over the same `.next/`,
and the third attempt then hit a real type error —
`apps/web/src/lib/automation-studio-context.ts:39: Cannot find name
'AUTOMATION_STUDIO_CONTEXT_LEASE_MS'` — in a file another agent was mid-edit
(they added the `export const` a few minutes later; it is now at line 64). The
fourth run, on a tree where that edit had landed, is **exit 0**.

**3. `pnpm check`, re-run at the end → exit 1, and this one is still live.**

```
  FAIL  [working-docs] docs/working/README.md is out of date with the documents'
  header blocks. Run "pnpm structure:baseline" to regenerate it.
```

`docs/working/mvp-week1-web-automation-reliability-plan.md` has +192 uncommitted
lines and `docs/working/README.md` is out of sync with them. Both are the
supervisor's documents, the fix is `pnpm structure:baseline` — which regenerates
the index through the rule's own `update()` hook and which workers may not run —
and neither is a file I touched. My own `pnpm check` run, against my change, was
**exit 0**; on the current tree the type-check half `pnpm -r check` is still
**exit 0** and only that one documentation row fails.

**The same row is now red in this repository too**, and the same way: this
repository's `pnpm check` was **exit 0** when I ran it, and a final audit an
hour later reports the identical `docs/working/README.md is out of date` line.
Because writing this report adds a file under `docs/working/`, I tested whether
it was the cause rather than assuming: with the report moved out of the tree,
`node scripts/structure-audit.mjs --rule working-docs` is **exit 1 with exactly
the same one line**, and putting it back changes nothing. The staleness comes
from another agent's edit to the plan document, not from this report.

## What changed

**In `F:\!FluxIQ` (Core), where the mirrored script must change first:**

| File | Change |
| --- | --- |
| `scripts/structure-audit/rules/contract-spread.mjs` | new, 130 lines — the rule, with a header carrying the mechanism, the probe results, the allowance and the hole |
| `scripts/structure-audit/rules/tests/contract-spread.test.mjs` | new, 15 tests over in-memory fixtures and a test-supplied config; no git, no filesystem |
| `scripts/structure-audit/config.mjs` | `contractSpreadPaths: []`, with the reason Core configures none |
| `AGENTS.md` | the enforcement paragraph now names the rule and where its paths are configured |
| `docs/architecture/code-structure.md` | an Anti-Patterns entry: spreading properties into a contract value, with the safe form spelled out |

**In this repository:**

| File | Change |
| --- | --- |
| `scripts/structure-audit/rules/contract-spread.mjs` | mirrored, byte-identical |
| `scripts/structure-audit/rules/tests/contract-spread.test.mjs` | mirrored, byte-identical |
| `scripts/structure-audit/config.mjs` | the three configured paths, each with its reason and remedy, plus the out-of-scope list |

`diff -rq` over `scripts/structure-audit/` between the two repositories reports
exactly one difference, `config.mjs` — which is what the file headers in both
say the mirror should look like.

## Commands run and observed results

Every exit status captured by redirecting to a file and echoing `$?`, never
through a pipe. No `pnpm lab`, no `pnpm structure:baseline`, no commit.

**Core (`F:\!FluxIQ`):**

- `node --test scripts/structure-audit/rules/tests/contract-spread.test.mjs`
  → **exit 0**, `# tests 15 # pass 15 # fail 0`.
- The five pre-existing structure test files → **exit 0**, `# tests 48`. So the
  63 that `pnpm check` reports is 48 + my 15, checked rather than assumed.
- `node scripts/structure-audit.mjs --rule contract-spread` → **exit 0**,
  `structure-audit: passed (0 warning(s), 0 baselined).`
- `node scripts/structure-audit.mjs --list` → the rule appears as
  `contract-spread   Wire-contract values are built key by key, not by spread`.
- `pnpm check` → **exit 0**. `structure:test` 63/63; audit
  `passed (118 warning(s), 256 baselined)`; `packages/contracts`,
  `packages/fluxiq`, `packages/client-gateway-websocket`, `apps/web` all
  `check: Done`.
- `pnpm -r test -- --no-file-parallelism` → **exit 0**. The flag reached every
  package (`vitest run --passWithNoTests "--no-file-parallelism"` in all four).
  Test files 1 + 1 + 129 + 227 = **358 passed**; tests 7 + 3 + 842 + 1146 =
  **1,998 passed**, zero failures. ~14 minutes.
- `pnpm docs:check` → **exit 1** on the first run, **exit 0** on the re-run:
  `Validated local links in 99 authored/reference Markdown files.` and
  `Deterministic framework reference is current.` Both diagnosed above.
- `pnpm build` → **exit 0** on the fourth attempt; the three before it are in
  the note below and none was caused by this change.
- `pnpm check` re-run at the end → **exit 1** on one `working-docs` row, above.
  `pnpm -r check` alone on that same tree → **exit 0**, all four packages
  `check: Done`.

**This repository (`F:\!FluxIQWebExtension`):**

- `pnpm structure:test` → **exit 0**, `# tests 63 # pass 63 # fail 0`.
- `node scripts/structure-audit.mjs --rule contract-spread` → **exit 0**, and
  again **exit 0** after each mutation was reverted.
- `node scripts/structure-audit.mjs --json` → `failures 0, warnings 31,
  suppressed 19`. The one `lowerable` entry is `directory-files` for
  `packages/test-runner/src/tests` (50 against a recorded 51) — pre-existing,
  unrelated to me, and recording it needs `structure:baseline`, which workers
  may not run.
- `pnpm check` → **exit 0**. `structure:test` 63/63, `lab:test` 7/7, audit
  `passed (31 warning(s), 19 baselined)`, and all ten packages `check: Done`.
  I read `pnpm lab:test` (a `node --test` run over `scripts/lab/tests/`) as
  distinct from the `pnpm lab` commands the brief reserved for other workers;
  `pnpm check` cannot run without it, and it starts no browser. A concurrent
  `pnpm lab run identity-drift` from another worker was running at the time and
  was unaffected.
- A one-off parse of every tracked script file counting `ts.SpreadAssignment`
  by directory — the ~1,460 / 105 figures and the per-directory table above.
  Read-only, in the scratchpad.

**On `pnpm build` in Core, which took four attempts and is worth the paragraph
so nobody re-diagnoses it.** Run 1 returned **exit 1** with
`uncaughtException [Error: kill EPERM]` from `next build --turbopack`, after
`✓ Compiled successfully in 30.9s`. Run 2 hit
`ENOENT … .next/server/pages-manifest.json`. The process table explained both:
run 1's `pnpm build`, `pnpm --filter @fluxiq/web build` and `next build` were
**still alive** after the tool call returned — the sandbox denied the kill — so
run 2 raced them over the same `.next/`. Stopping them by hand was denied by
the permission classifier, so I waited for them to exit and ran again. Run 3
then failed on a genuine type error in another agent's mid-edit file
(`automation-studio-context.ts`, above). Run 4, after they finished that edit,
is **exit 0**, `pnpm --filter @fluxiq/contracts|fluxiq|client-gateway-websocket|web
build` all through. The lesson for the next worker on this machine: a Next
build here can outlive the shell that started it, so check the process table
before retrying rather than launching a second one into the same `.next/`.

## Not verified

- **No browser validation, and none is applicable.** This change adds a build
  check; it ships no runtime code in either repository and cannot alter
  extension or panel behaviour.
- **The rule was exercised against this repository's tree and against 15
  in-memory fixtures, not against Core's tree**, because Core configures no
  paths. If Core ever configures one, the first run there is the first real
  exercise.
- **The `as`-cast case is flagged on principle, not on evidence.** There is no
  spread of a cast in any configured path today, so the choice to treat a cast
  as a fresh value is a judgement about how restatements get in, not a measured
  false-positive rate.
- **`domain/src/page-evidence` is configured on the strength of what lives
  there now** — a contract declaration, a wire reader, and checked-in captures.
  It has no spreads and no producer, so the entry is preventive.
- **Core's gates were measured on a tree three agents were changing.** Every
  exit status quoted is real and was observed, but `pnpm check`, `pnpm test`
  and `pnpm build` were not all green against one identical snapshot of Core —
  the tree moved between them. What is stable across all of them is that no
  failure at any point named a file I changed.
- **Nothing committed in either repository.**

## Open questions or contradictions found

- **Both prior reports proposed banning `ts.isSpreadAssignment` outright, and
  that proposal was wrong in a way worth recording.** It would have failed on
  `dom-snapshot.ts` lines 170 and 282 — two copy-with-override spreads that
  `tsc` checks perfectly well. The distinction the rule actually needs is
  fresh-value versus named-value, and it is only visible once you probe what
  the excess-property check does and does not cover. Anyone reading
  `v-producer-safety`'s "the rule is `ts.isSpreadAssignment` inside a file
  under `content/evidence/`" should read this section instead.
- **`domain/src/client/` and `domain/src/runtime/llm-evidence/` are the
  obvious next paths and neither can be configured yet.** 33 and 52 spreads
  respectively. The gateway mapping in particular carries the same class of
  risk as the merge did. That is a brief, and the rule is already built to take
  the paths once they are clean.
- **This repository's `AGENTS.md` describes what
  `scripts/structure-audit/config.mjs` adds beyond Core's** — "which
  additionally enforces that `domain/src` never imports `apps/extension/src`"
  — and that sentence is now incomplete: the config also lists the
  wire-contract paths. The file is outside my Owns, so I did not edit it. One
  clause.
- **Core's `facade-dispatch` rule is documented nowhere but a working-doc
  report.** I noticed it while looking for where to document mine; Core's
  `AGENTS.md` enumeration does not mention it and neither does
  `code-structure.md`. Not mine to fix, but it is the same gap I was asked to
  close for this rule, one rule along.
- **The ratchet cannot record a violation in a newly configured path, and that
  deserves to be stated in the plan.** It follows from the Wave 1 `--update`
  fix and it is correct, but it inverts the usual reading of "baselined":
  configuring a path is an assertion that it is already clean, not a way to
  freeze what is there. The config comment says so; the plan probably should
  too, because the next person to add a path will meet it.
