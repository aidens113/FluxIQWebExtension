# x4g — two rules with nothing enforcing them

## Outcome

**Done** for gap 1: `docs/architecture/` now has a mechanical link and anchor
check that fails the build, authored in FluxIQ Core and mirrored down, with the
standalone Core validator it supersedes deleted so there is one implementation.

**Blocked, reported** for gap 2: both preview-row constants live in directories
this brief forbids (`apps/extension/src/content/` and
`apps/extension/src/background/`). The exact change is written out below, and
nothing was edited.

## Gap 1 — the documentation link check

### Which of the two options, and why

The brief asked whether to add an audit rule or to wire Core's existing
`scripts/validate-docs.mjs` into this repository, choosing whichever leaves one
implementation. Neither on its own does.

- Copying `validate-docs.mjs` here leaves **two** copies of a validator and two
  wirings (`pnpm docs:check` in Core, something new here), and it still would
  not catch a renamed heading: the existing validator strips `#fragment` off a
  target and never looks at it. The gap statement names a renamed heading
  explicitly.
- Adding an audit rule while leaving `validate-docs.mjs` in place leaves **two**
  implementations of link-existence checking inside Core.

So: **one new audit rule, and Core's standalone validator deleted.** The rule
carries everything `validate-docs.mjs` did over the same tree, adds anchors,
and runs inside `pnpm check` in both repositories instead of only in Core's
separate `pnpm docs:check`. Core was changed first, then mirrored, per
`AGENTS.md`. The mirror is byte-identical; `config.mjs` is the only file that
differs, as before.

### What the rule does

`scripts/structure-audit/rules/docs-links.mjs`, id `docs-links`, title
"Documentation's local links resolve, and their anchors name a real heading".
For every tracked Markdown file under the directories `CONFIG.docsLinkDirs`
names:

- a relative link must resolve to a **tracked** file, or to a directory holding
  a `README.md`;
- a link may not escape the repository;
- a `#fragment` on a Markdown target must name a heading that still exists, by
  GitHub's own slug including its `-1`/`-2` suffixes for repeated headings, or
  an explicit `id=`/`name=` anchor;
- a bare `#fragment` is checked against the document it appears in.

Absolute URLs are skipped. Fenced code, inline code spans and HTML comments are
blanked before matching, keeping every newline so a finding still reports its
own line — without that, the regular expressions quoted in this repository's
reports (`[a-z0-9]([a-z0-9._-]{0,62})`) are read as links to a file.

The finding is `ratchet: false` — a hard failure, never baselined. A broken link
is not a budget: it either resolves or it does not. That follows this
repository's `contractSpreadPaths` convention, where a path is configured once
it is clean and stays clean, rather than recording debt behind a number.

Two bugs were found and fixed while measuring against the real corpus, both of
which would have made the check disagree with GitHub and so be worse than
nothing. Inline code must **not** be blanked when computing a heading's anchor —
a heading reading ``### Finding 3 — W19 cannot report `auth_required` today``
anchors as `finding-3--w19-cannot-report-auth_required-today`, with the
backticks unwrapped rather than the symbol dropped — and an underscore survives
slugging, so only `*` and `~` are stripped as emphasis. Both are locked in by
tests.

### Scope, per repository

| Repository | `docsLinkDirs` | Findings |
| --- | --- | --- |
| FluxIQ Core | `["docs"]` | 0 |
| This repository | `["docs/architecture"]` | 0 |

Core keeps exactly the tree `validate-docs.mjs` covered, so nothing was lost by
deleting it, and it is clean under anchor checking too.

Here, `docs/working/` is **out for now** because it holds 15 genuine breakages I
am forbidden to edit (see below). `config.mjs` records the exclusion, the count,
and that widening to `["docs"]` is a one-line change once they are fixed.
Repository-root Markdown is deliberately out of scope in both: `AGENTS.md` links
sideways into the other checkout, which is not this repository's to resolve.

### The 15 broken links in `docs/working/`, for whoever owns those documents

All 15 are in the week-1 plan's tree. None is in `docs/architecture/`. Verified
by hand against the target files; none is a false positive.

Links to something that is not there (6):

1. `mvp-week1-web-automation-reliability-plan.md:573` → `./mvp-week1-web-automation-reliability-plan/briefs/` — the directory exists but has no `README.md`.
2. `mvp-week1-web-automation-reliability-plan.md:578` → `./mvp-week1-web-automation-reliability-plan/archive/` — same.
3. `.../archive/2026-09-12-superseded-plan-sections.md:13` → `./mvp-week1-web-automation-reliability-plan/archive/2026-09-11-phase-1-1-plan.md` — the path is written as if from `docs/working/`, but the document is already inside `archive/`, so it resolves to `archive/mvp-week1-.../archive/...`. Should be `./2026-09-11-phase-1-1-plan.md`.
4. `.../archive/2026-09-12-superseded-plan-sections.md:32` → same mistake, `2026-09-11-phase-1-6a-plan.md`.
5. `.../archive/2026-09-12-superseded-plan-sections.md:39` → same mistake, `../briefs/wave-2.md` (and that file does not exist either).
6. `.../archive/2026-09-12-wave-3-outcomes.md:15` → same mistake, `../reports/`.

Plus `.../reports/p-core-version.md:133` → `../integrations/automation-studio-importing-repos.md`, which resolves inside this repository's week-1 tree; the document it means is in FluxIQ Core.

Fragments naming a heading that was reworded (8):

8. `.../archive/2026-09-11-phase-1-6a-plan.md:34` → `#metrics` — that document has two headings, neither is Metrics.
9. `.../archive/2026-09-11-phase-1-6a-plan.md:62` → `#fluxbench-week-1-corpus` — same.
10. `.../reports/v-inventory.md:276` and `:365` → `#f2--the-assert-verbs-new-timeout-status`; the heading is `### F2. The assert verb's new TIMEOUT status`, which anchors as `f2-the-assert-verbs-new-timeout-status` — one hyphen, not two. The link was written for an em dash the heading does not use.
11. `.../reports/v-inventory.md:314`, `:624`, `:880` → `#d6--the-confidence-floor-and-margin-are-calibrated-on-four-data-points`; the heading is `### D6. The confidence floor and margin are calibrated on four data points`, so `d6-the-...`. Same single/double hyphen mistake.
12. `.../reports/w2-flow-lane.md:19` → `#finding-3--w19-cannot-report-auth_required-today`; this one is correct for the heading at line 111 and now passes — it is listed only because the first draft of the rule got it wrong. **Not a defect.**
13. `.../reports/x-identity-wire.md:123` → `#a-capture-side-hole-i-did-not-own` — no such heading anywhere in that document.

(Counting by finding, that is 15 failures over 12 distinct problems, because three
of the fragments repeat.)

### Files changed

FluxIQ Core (`F:\!FluxIQ`):

- **added** `scripts/structure-audit/rules/docs-links.mjs` — the rule.
- **added** `scripts/structure-audit/rules/tests/docs-links.test.mjs` — 25 unit tests.
- **deleted** `scripts/validate-docs.mjs` — superseded.
- **changed** `scripts/structure-audit/config.mjs` — `docsLinkDirs: ["docs"]`.
- **changed** `package.json` — `docs:check` now runs `node scripts/structure-audit.mjs --rule docs-links` in place of the deleted script. Unavoidable: leaving it would have left CI running a script that no longer exists.
- **changed** `biome.json` — dropped `scripts/validate-docs.mjs` from the `files.includes` allowlist, same reason.

This repository (`F:\!FluxIQWebExtension`):

- **added** `scripts/structure-audit/rules/docs-links.mjs` — byte-identical mirror.
- **added** `scripts/structure-audit/rules/tests/docs-links.test.mjs` — byte-identical mirror.
- **changed** `scripts/structure-audit/config.mjs` — `docsLinkDirs: ["docs/architecture"]`, with the exclusion documented.
- **changed** `docs/architecture/repository-layout.md` — a "Documentation Links" subsection under Validation Commands.

No `package.json` change was needed here: `pnpm check` already runs
`node scripts/structure-audit.mjs`, so the new rule is wired by existing.

The four new files are staged (`git add`) but **not committed**, because an
untracked file is not in the rule's tracked-file set and the new documentation
links to the rule.

## Gap 2 — the two constants, not changed, exactly specified

Both declarations are in directories the brief forbids:

- `apps/extension/src/content/picker/preview.ts:27` — `export const PICKER_PREVIEW_MAX_ROWS = 20;`
- `apps/extension/src/background/extraction/session-store.ts:21` — `export const EXTRACTION_PREVIEW_MAX_ROWS = 20;`

so nothing was edited. Their tests are in those same forbidden trees, so no test
was added either.

The change below makes them structurally incapable of drifting rather than
testing that they have not, which is what the brief prefers. It needs no new
file and no new import edge: **both** files already import from
`apps/extension/src/shared/extraction-messages.ts`, and that module is already
value-imported by the content bundle (`content/picker/messages.ts:16`), so this
adds one constant to a module both sides already load.

**1. `apps/extension/src/shared/extraction-messages.ts`** — add the single
declaration, next to `ExtractionPreviewRow` (around line 157):

```ts
/**
 * How many rows a confirmation preview may hold. One number on purpose: the
 * frame bounds what it reads by it and the worker bounds what it keeps by it,
 * and a preview showing a different count from the one the picker prepared is a
 * defect no test would see.
 */
export const EXTRACTION_PREVIEW_MAX_ROWS = 20;
```

**2. `apps/extension/src/background/extraction/session-store.ts`** — replace
lines 20-21:

```ts
/** How many rows the confirmation preview may hold. The content message's own bound is the same. */
export const EXTRACTION_PREVIEW_MAX_ROWS = 20;
```

with a re-export of that one declaration:

```ts
export { EXTRACTION_PREVIEW_MAX_ROWS } from "../../shared/extraction-messages";
```

The existing `import type { ... } from "../../shared/extraction-messages";` on
line 18 stays as it is; a value re-export needs its own statement.
`background/extraction/index.ts:13` keeps re-exporting the name from
`./session-store`, so no consumer changes.

**3. `apps/extension/src/content/picker/preview.ts`** — change the import on
line 22 from a type-only import to:

```ts
import { EXTRACTION_PREVIEW_MAX_ROWS, type ExtractionPreviewRow } from "../../shared/extraction-messages";
```

and replace lines 26-27:

```ts
/** How many rows a preview may hold. The worker's `EXTRACTION_PREVIEW_MAX_ROWS` is the same number. */
export const PICKER_PREVIEW_MAX_ROWS = 20;
```

with:

```ts
/** How many rows a preview may hold: the worker's own bound, not a copy of it. */
export const PICKER_PREVIEW_MAX_ROWS = EXTRACTION_PREVIEW_MAX_ROWS;
```

After this there is one literal `20`. The two names remain, and cannot differ.

Optionally, afterwards: delete `PICKER_PREVIEW_MAX_ROWS` entirely and have
`content/picker/messages.ts:82` and `preview.ts:47` use
`EXTRACTION_PREVIEW_MAX_ROWS` directly, leaving one name as well as one value.
That touches a third file in a forbidden tree, so it is a separate step.

Checked, not assumed: `shared/extraction-messages.ts` imports only types, so
step 1 adds no runtime dependency; it has 5 value exports, so a sixth stays
under the `exported-values` rule's advisory threshold of 8; and `shared/` has no
barrel, so importing the file directly is what `session-store.ts` and
`messages.ts` already do.

## Commands run and observed results

The new check fails on a deliberately broken link and passes once restored, in
both repositories. Two breaks were appended to a real architecture document, the
check run, the document restored with `git checkout --`, and the check run again.

This repository, appending to `docs/architecture/web-capabilities.md`:

```
$ node scripts/structure-audit.mjs --rule docs-links          # before
structure-audit: passed (0 warning(s), 0 baselined).
EXIT=0

$ node scripts/structure-audit.mjs --rule docs-links          # with two breaks
  FAIL  [docs-links] docs/architecture/web-capabilities.md:555: the link to ./element-identity-renamed.md is broken: no tracked file is at docs/architecture/element-identity-renamed.md. Point it at where the file moved to, or remove the link.
  FAIL  [docs-links] docs/architecture/web-capabilities.md:557: the link to ./repository-layout.md#a-heading-that-was-renamed is broken: docs/architecture/repository-layout.md has no heading or anchor "a-heading-that-was-renamed". A heading's anchor is its text lowercased, with punctuation dropped and spaces turned into hyphens; rename the link to follow the heading, or restore the heading.

structure-audit: 2 violation(s) across 1 rule(s).
EXIT=1

$ git checkout -- docs/architecture/web-capabilities.md
$ node scripts/structure-audit.mjs --rule docs-links          # restored
structure-audit: passed (0 warning(s), 0 baselined).
EXIT=0
```

FluxIQ Core, appending to `docs/architecture/docs-system.md`:

```
$ node scripts/structure-audit.mjs --rule docs-links          # before
structure-audit: passed (0 warning(s), 0 baselined).
EXIT=0

$ node scripts/structure-audit.mjs --rule docs-links          # with two breaks
  FAIL  [docs-links] docs/architecture/docs-system.md:137: the link to ./repository-layout-renamed.md is broken: no tracked file is at docs/architecture/repository-layout-renamed.md. Point it at where the file moved to, or remove the link.
  FAIL  [docs-links] docs/architecture/docs-system.md:137: the link to ./docs-system.md#a-heading-that-was-renamed is broken: this document has no heading or anchor "a-heading-that-was-renamed". A heading's anchor is its text lowercased, with punctuation dropped and spaces turned into hyphens; rename the link to follow the heading, or restore the heading.

structure-audit: 2 violation(s) across 1 rule(s).
EXIT=1

$ git checkout -- docs/architecture/docs-system.md
$ node scripts/structure-audit.mjs --rule docs-links          # restored
structure-audit: passed (0 warning(s), 0 baselined).
EXIT=0
```

Full audit, FluxIQ Core:

```
$ node scripts/structure-audit.mjs
structure-audit: 1 baseline entries can be lowered. Run "pnpm structure:baseline" to record the improvement.
structure-audit: passed (137 warning(s), 256 baselined).
exit 0                      # 0 FAIL lines
```

Full audit, this repository. The first run of it, mid-task, reported one
failure — `FAIL [imports] packages/test-runner/src/scenario-steps/step-runner.ts:
1 import(s) reach into another directory's files instead of its barrel` — which
was another worker's in-flight work in a tree this brief forbids me, not
`docs-links`. That worker fixed it during this task, and the final run is clean:

```
$ node scripts/structure-audit.mjs
structure-audit: passed (56 warning(s), 17 baselined).
exit 0
```

Audit rule test suites, both repositories (63 before, 88 after — the 25 new ones
are the `docs-links` rule's):

```
$ node --test "scripts/structure-audit/rules/tests/*.test.mjs" "scripts/structure-audit/tests/*.test.mjs"
# tests 88
# pass 88
# fail 0
```

Mirror check:

```
$ diff -q F:/!FluxIQ/scripts/structure-audit/rules/docs-links.mjs F:/!FluxIQWebExtension/scripts/structure-audit/rules/docs-links.mjs
$ diff -q F:/!FluxIQ/.../tests/docs-links.test.mjs F:/!FluxIQWebExtension/.../tests/docs-links.test.mjs
identical
```

Rule registration:

```
$ node scripts/structure-audit.mjs --list
...
docs-links             Documentation's local links resolve, and their anchors name a real heading
...
```

Core `pnpm docs:check` after repointing it:

```
$ npm run --silent docs:check
structure-audit: passed (0 warning(s), 0 baselined).      # the docs-links half
Error: docs/reference/framework-reference.md is stale. Run `pnpm docs:reference` and commit the result.
```

The link half passes. The staleness is the second half of that script,
`scripts/docs-reference.mjs --check`, which I did not touch: `node
scripts/docs-reference.mjs --check` exits 1 on its own, `docs/reference/` is
unmodified in the working tree, and Core has another worker's uncommitted
changes under `packages/fluxiq/src/programs/automation-studio/runtime/` that the
generated reference is derived from. Pre-existing, not mine, and in a tree this
brief forbids me.

## Not verified

- **No extension type-check, unit test or build was run**, because gap 2 was
  reported rather than made and nothing in `apps/` or `domain/` was touched.
  The three-file change in gap 2 is therefore **unverified**: it is read off the
  current source, not compiled. Whoever applies it should run
  `pnpm --filter @fluxiq-web-extension/extension check` and that package's tests.
- `pnpm check` was not run end to end in either repository. It starts with
  `structure:test` and the audit, both of which were run directly and are
  quoted above; the rest of it (`pnpm -r check`, and `lab:test` here) is other
  workers' territory right now and would have reported their in-flight state,
  not mine.
- The rule's agreement with GitHub's renderer is argued from GitHub's slug
  algorithm and checked against ~500 real anchors in this repository's
  documents, not against GitHub itself. The evidence is that after the two slug
  fixes every anchor that resolves in these documents resolves in the rule, and
  every one it rejects was confirmed by hand to be genuinely wrong.
- Reference-style links (`[text][label]`) are not resolved. Neither repository
  uses them today; a document that started to would be silently unchecked.
- A code span opened by a stray backtick blanks text up to the next backtick,
  which can hide a real link from the check. That direction is safe (a missed
  break, never a false alarm) but it is a real limit.

## Open questions or contradictions found

1. **The brief told me to fix the broken links the new check finds, and also
   never to edit a working document. All 15 are in `docs/working/`.** I obeyed
   the second and reported the first, and narrowed this repository's scope so
   the build is not left red. Someone who owns those documents should make the
   12 fixes listed above and change `docsLinkDirs` here to `["docs"]`, which is
   what Core already runs.
2. **Two Core files outside `scripts/**` had to change** — `package.json` and
   `biome.json` — because deleting `scripts/validate-docs.mjs` would otherwise
   leave CI invoking a script that no longer exists. Both edits are one line and
   are listed above.
3. **Core's `docs/architecture/docs-system.md:119`** says "`pnpm docs:check`
   validates local Markdown links". Still true, and now an understatement: it
   also validates anchors, and `pnpm check` validates both. I did not edit it;
   Core's documentation is not mine under this brief.
