# p-arch-docs — architecture documentation, re-verified against source

Worker report. Scope: `docs/architecture/**` only. No source file was touched,
nothing was committed, and no `pnpm lab` command was run.

## Outcome

**Done.** Four new subject pages were written and four existing pages were
corrected. Every statement below was checked against the working tree on
2026-09-12, not against the reports that claimed it.

**The ratio the supervisor asked for: 54 pre-existing documentation statements
checked, 37 already right, 15 wrong, 2 right but materially incomplete.**

Wrong means the document said something the code contradicts — not that it was
vague. All 15 are listed in full below so the number can be audited.

That ratio is worth reading carefully: **all 15 errors cluster in the areas
Waves 1–3 changed**, and outside those areas the documentation held up well
(the action matrix, the safety split, the alias map, the recorder's trust
rules, the input/confirmation counts and the packaging section were all right).
The failure mode is not sloppiness; it is that the docs were written at the
close of Phase 1.2 and the tree moved underneath them.

## What changed and why

### New pages

| Page | Lines | Why it exists |
| --- | --- | --- |
| `docs/architecture/element-identity.md` | 195 | Nothing described Level 1's strategies and gate, the veto, candidate enumeration, or Level 2 scoring. D13 and D14 lived only in the plan. |
| `docs/architecture/failure-taxonomy.md` | 184 | The closed code set existed only as source comments. The table of 14 codes with their category, retryable flag and stage now has an authored home, with the four places an out-of-set code fails to compile. |
| `docs/architecture/page-evidence.md` | 164 | Eight evidence items, the single-home contract, the three mechanisms that keep producer and readers joined, the cross-frame merge, and the four caps. |
| `docs/architecture/sensitive-values.md` | 166 | The one rule, where it is asked, the producer-declared `redacted` flag, and — the part the brief specifically asked for — what the guards are *not* a boundary against. |

Each is current-state and dated. Each carries a "limits" or "what this is not"
section, because the previous docs' worst failures were confident sentences
about behaviour that had moved.

### Corrections to existing pages

**`extension-client.md`** — the redaction paragraph was rewritten (it stated
the opposite of the code on four counts), the element-capture paragraph was
corrected (the "40 captured elements" cap does not exist; the real numbers are
50,000 nodes swept, 2,000 descriptors returned, 1,500 kept by the state
projection), a paragraph on page-level evidence was added, and the
recording-start refusal paragraph was rewritten against the module that now
owns it.

**`web-capabilities.md`** — `expected_state_missing` corrected to
`unexpected_state` in both places, with the retryable flag corrected too;
ACTION_REJECTED's code corrected; the "not yet redacted" sentence replaced;
`resolveTarget`'s behaviour corrected; the header and the failure list now
point at the new pages; and a new section documents the expectation seam over
the `web.dom.assert` vocabulary.

**`repository-layout.md`** — the package-structure block now lists the
directories Waves 1–3 added (`domain/src/page-evidence`, `sensitivity`,
`runtime/{expectation,failure,llm-evidence}`, `content/{identity,evidence}`,
`page-world`, `e2e`, `apps/scenario-lab`, `packages/`), with a note on why the
two top-level domain directories sit where they do; the `./node` section gained
the concrete import form and the reason the subpath is required; the "root
`pnpm check` runs no build of its own" sentence was made precise (the recursive
check can trigger the `domain:dist` guard, on a tree that has no `dist`); and a
one-paragraph index of the other pages was added, because `AGENTS.md` points
readers here.

**`testing-facility.md`** — one row: the `identity-drift` fixture has a fifth
variant, `reworded-aria`, which the row did not mention.

### The 15 wrong statements

`extension-client.md`

1. "caps each snapshot to 40 captured elements" — no such cap;
   `MAX_SNAPSHOT_CANDIDATES` is 2,000 (`content/dom-snapshot.ts`). 40 is the
   *LLM packet's* element bound (`llm-evidence/limits.ts`).
2. "keeps only interactive elements …" — the capture also keeps semantic text
   (`p`, `h1`–`h6`, `li`, `td`, …) and visual media.
3. "Sensitive values are not yet redacted when they are captured" — they are,
   unconditionally, at four separate producers.
4. "The sensitivity rule is one function … in `shared/sensitive-field.ts`" —
   that file now only re-exports; the rule is `domain/src/sensitivity/`.
5. "It withholds only a `<select>`'s `selectedValue`, the `hasValue` flag, and
   the value on a `type` or `select` runtime confirmation" — wrong on both
   sides: far more is withheld, and `hasValue` is never withheld.
6. "The domain marks `elements.*.value` … as sensitive state" — no such state
   path is declared any more; `elements.*` is a single `json` blob. The
   `forms.*` half of the sentence is right.
7. "Redaction at capture is Week 1 Phase 1.4 work" — done.
8. "…and no reason shown to the operator" — a `recordingBlock` with a title,
   a remedy and an activity entry is shown on both surfaces.
9. "Classifying and surfacing that refusal is Week 1 Phase 1.5 work" — done,
   and further than the sentence implies: three cases across two wire codes,
   with a bounded retry for the transient one.

`web-capabilities.md`

10. URL-checks row: "STATE_MISMATCH — Core's `expected_state_missing`,
    retryable" — it is `unexpected_state` and **not** retryable
    (`failure/codes.ts`). `content/actions/assert.ts` carries a header comment
    saying this file "used to claim" the wrong one; the doc still claimed it.
11. The same error in the Results And Failures list.
12. "ACTION_REJECTED — … with the capability's own code as `web.action.<code>`"
    — there is one code, `web.action.rejected`; the capability's reason rides
    in the record's `actual`.
13. "The recorder's own events and a result's `element.value` are not yet
    redacted" — both are.
14. "`resolveTarget` throws at once when nothing matches" — it enumerates and
    scores the page's candidates first. The point the sentence was making (no
    verb waits) is still true and was kept.

`repository-layout.md`

15. The package-structure block omitted every directory the wave added. Counted
    as one wrong statement, not eight.

Item 6 is the only half: `forms.*` really is declared sensitive, so only the
`elements.*.value` half of that sentence is wrong. It is counted as one wrong
statement.

### The 2 incomplete-but-right

- `repository-layout.md`: "The root `pnpm check` runs no build of its own" —
  true of the root script, misleading about `pnpm -r check`.
- `testing-facility.md`: the `identity-drift` row listed four of five variants.

## Commands run and observed results

Exit statuses captured by redirect, never a pipe.

```
$ cp .git/index $SCRATCH/index3.scratch
$ GIT_INDEX_FILE=$SCRATCH/index3.scratch git add docs/architecture     # exit 0
$ GIT_INDEX_FILE=$SCRATCH/index3.scratch node scripts/structure-audit.mjs > audit3.txt 2>&1
audit exit: 0
structure-audit: passed (31 warning(s), 19 baselined).
$ grep -c "docs/" audit3.txt
0
```

The scratch index is how the four new files were made visible to the audit,
which reads `git ls-files`; the repository's real index was not touched. Zero
findings mention `docs/` at all — no documentation finding, and the
`working-docs` rule reads only top-level `docs/working/*.md`, so this report is
outside it. The 31 warnings and the "1 baseline entry can be lowered" line are
pre-existing source findings, unchanged by this work.

Internal links, checked with a scratchpad script that resolves every relative
markdown target in `docs/architecture/` and every `#anchor` against the target
file's own headings:

```
$ node $SCRATCH/check-links.mjs > links3.txt 2>&1
links exit: 0
checked 67 links in 8 files; 0 broken
```

## Not verified

- **Nothing was run in a browser.** Every statement is read from source; the
  behaviour the source describes is still unproven live, as the live-validation
  plan says.
- **`pnpm check`, `pnpm test`, `pnpm build` were not run.** No source file was
  edited, and the tree was being edited by other workers while I worked (see
  below), so a gate result would have measured their work, not mine.
- **`testing-facility.md` was not audited.** 1,081 lines, almost all of it Lab
  and evidence-bundle behaviour outside this brief. Two rows were checked (the
  `identity-drift` variants, and the "22-fixture registry" count, which is
  right); the rest of the page is unverified by me. Its sentence "the facility
  also does not yet prove … cross-frame action behavior" is defensible for the
  Lab lanes but reads oddly now that `e2e/content/tests/frames.spec.ts` exists;
  I left it alone as another owner's page-scope.
- **Measured numbers from D13/D14 are not restated as documentation facts.**
  The new pages cite the constants I read from source (`TARGET_SCORE_FLOOR`
  0.35, `TARGET_SCORE_MARGIN` 0.2, `TARGET_VETO_FLOOR` 0, the enumeration caps
  600/60) and point at the plan for the measurements. The bundle-cost figure
  (18,974 bytes / 8.5%) is nowhere in the docs; I could not verify it without
  building, so I did not restate it.
- **The claim "eleven new page-evidence items"** in my brief could not be
  reproduced from source. The contract has eight top-level keys, and the
  producer's own barrel enumerates ten items that were absent or partial (five
  with no representation: dialogs, overlays, loading, regions, repeating; five
  partial: forms, navigation, element change, interaction recency, truncation
  totals). `page-evidence.md` therefore enumerates the items rather than
  asserting a count.

## Open questions or contradictions found

1. **The tree moved under me, mid-task, in the area I was documenting.**
   `apps/extension/src/background/connection.ts` had a
   `handleRecordingProjectRequired` method when I read it and a
   `classifyRecordingStartRefusal` call plus a new
   `background/connection/recording-start/` directory about twenty minutes
   later. The paragraph is written against the newer code. Anything I read
   before that point and did not re-check could have moved the same way; I
   re-verified the load-bearing constants at the end (failure code count, veto
   and score floors, candidate caps, the eight evidence keys, the `./node`
   export, the expectation binding) and they were unchanged.

2. **A source comment points at a report that does not exist.**
   `apps/extension/src/content/identity/veto.ts` cites
   `reports/L-veto-recordings.md` for its rule-2 enumeration. There is no such
   file in
   `docs/working/mvp-week1-web-automation-reliability-plan/reports/`.
   `v-level1-veto.md` exists and is cited separately in the same header. Source
   is not mine to edit; someone should either add the report or repoint the
   comment.

3. **A fixture comment appears to contradict D13.**
   `apps/scenario-lab/src/scenarios/identity-drift/modes.ts` says
   `reworded-aria` "is ranked first by a wide margin and refused anyway,
   because the score floor sits above anything this page can reach". D13 states
   the drift case now resolves at 0.389 against a 0.35 floor, and that the
   `reworded-aria` spec row must ship with the Core constant change because
   flipping it back turns that row red. Those cannot both be current. I read
   the comment as pre-D13 and left it; the new architecture page does not
   repeat either claim.

4. **Two failure codes are declared and effectively unproduced**, and I
   documented that rather than papering over it. `web.page.changed` has no
   producer anywhere outside its own tests — nothing detects the document being
   replaced between resolving a target and acting on it.
   `web.intervention.required` has exactly one producer,
   `domain/src/runtime/adapter.ts`, using it for "no single paired client could
   be selected for a state capture" — which is not the captcha-or-standing-
   dialog meaning its own doc comment gives it. Either the comment or the use
   is wrong.

5. **`domain/src/actions/types.ts` still declares a `cancelled` action status
   that nothing produces.** Pre-existing, already noted in
   `web-capabilities.md`, and still true; flagged only because it is the same
   shape of defect as item 4.

6. **Discoverability of the four new pages rests on cross-links**, because
   `docs/architecture/` has no index and `AGENTS.md` (which I do not own) names
   only `repository-layout.md` and `web-capabilities.md`. I added a
   subject-by-subject pointer paragraph at the top of `repository-layout.md` so
   the chain from `AGENTS.md` reaches all eight pages. If the supervisor would
   rather have an explicit `docs/architecture/README.md`, that is a small
   follow-up.
