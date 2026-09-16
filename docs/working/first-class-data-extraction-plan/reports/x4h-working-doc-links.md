# x4h — the 15 broken links in `docs/working/`, and the check that now holds them

## Outcome

**Done.** All 15 findings are fixed at source, `docsLinkDirs` is widened to
`["docs"]`, and `node scripts/structure-audit.mjs` passes with no failure.
`docs/working/` is now covered by the same check as `docs/architecture/`, which
is what Core already runs over its own `docs/`.

One thing the next agent needs before anything else: **the rule's own files were
untracked when I started**, so the widened check reported a sixteenth failure
that was not mine. See "The sixteenth failure" below — it comes back if those
files are ever unstaged again.

## What changed, and why each fix is the one it is

x4g's list was accurate as a set of findings; two of its notes about the targets
were not, and I say so where it matters.

### The mis-rooted paths (4)

Three in `archive/2026-09-12-superseded-plan-sections.md` and one in
`archive/2026-09-12-wave-3-outcomes.md` were written as if from `docs/working/`,
by documents that already live inside the plan's `archive/`. Each now points
where the file actually is, relative to the document doing the pointing:

| Document | Was | Now |
| --- | --- | --- |
| `superseded-plan-sections.md:13` | `./mvp-week1-.../archive/2026-09-11-phase-1-1-plan.md` | `./2026-09-11-phase-1-1-plan.md` |
| `superseded-plan-sections.md:32` | `./mvp-week1-.../archive/2026-09-11-phase-1-6a-plan.md` | `./2026-09-11-phase-1-6a-plan.md` |
| `superseded-plan-sections.md:39` | `./mvp-week1-.../briefs/wave-2.md` | `../briefs/wave-2.md` |
| `wave-3-outcomes.md:15` | `./mvp-week1-.../reports/` | `../reports/` |

**Correction to x4g.** It says of the third that "that file does not exist
either". It does: `briefs/wave-2.md` is present and tracked, so correcting the
prefix was the whole fix. I listed the directory rather than taking the note.

The visible link text (`archive/2026-09-11-phase-1-1-plan.md`,
`briefs/wave-2.md`, `reports/`) is left alone. It describes where the file sits
under the plan directory, which is still true and still the more useful thing
for a reader to see; only the target was wrong.

### The two directory links with no `README.md` (2)

`mvp-week1-web-automation-reliability-plan.md:573` and `:578` link to `briefs/`
and `archive/`. Both directories existed; neither had a `README.md`, so the rule
had nothing to open.

I fixed these by **writing the two indexes**, not by rewriting the plan. Two
reasons. The plan's prose is correct — briefs really do live under `briefs/` and
the archived ledgers really are under `archive/` — so the defect was the missing
index, not the sentence. And the sibling directory `reports/` already has
exactly such an index, so this follows the convention already set in this tree
rather than inventing one. The plan file is untouched.

- **added** `mvp-week1-.../briefs/README.md` — the four brief files with the
  sequencing each one states in its own header (Phase 1.1 steps 1-4 and Phase
  1.6a steps 1-3, 5-7; Phase 1.2 steps 1-5 / 1.3 steps 1-2 / 1.6a step 4; Phase
  1.3 steps 3-6 / 1.4 steps 1-6 / 1.5 steps 3-5; and the finish pass).
- **added** `mvp-week1-.../archive/README.md` — the fourteen archived files in
  three groups: step plans and briefs, decisions and findings, ledgers.

Every description in both is read off the file it describes or off the plan's
own sentence about it, not inferred. My first draft of `briefs/README.md`
described Wave 2 as "the provider-free Flow lane and the Wave 1 follow-ups",
which is what the *superseded plan section* says about it; the brief's own
header states a wider scope, so I rewrote the table to quote the briefs.

Both files are `git add`ed but not committed, because the rule resolves against
tracked files and an untracked README would leave the link still failing.

### The document that lives in FluxIQ Core (1)

`reports/p-core-version.md:133` linked to
`../integrations/automation-studio-importing-repos.md`. That resolves inside
this repository's week-1 tree, where nothing is; the document it means is
`docs/integrations/automation-studio-importing-repos.md` in **FluxIQ Core**, and
it does exist there (checked: `F:\!FluxIQ\docs\integrations\` holds it alongside
`client-gateway-websocket.md`).

I did not repoint it at a local file and I did not write a relative path
climbing out of the checkout. A link that silently resolves to the wrong
document is worse than one that visibly does not, and a `../../../!FluxIQ/...`
path would be both wrong for anyone who cloned this repository elsewhere and
rejected by the rule's escape check. The reference is now plain text naming the
other repository:

    > ... as the
    > importing-repos guide in FluxIQ Core (`docs/integrations/automation-studio-importing-repos.md`)
    > now explains.

A reader knows exactly which document and which checkout, and nothing pretends
to be a link that works. This is the shape any future cross-repository reference
in these documents should take.

### The eight fragments (8)

Five were an em dash written as a double hyphen. GitHub's slug turns `F2. The
assert verb's...` into `f2-the-assert-verbs-...` with **one** hyphen; the links
were written as though the heading read `F2 — The assert verb's...`.

- `reports/v-inventory.md:276` and `:365`:
  `#f2--the-assert-verbs-new-timeout-status` to `#f2-the-...`. Heading at
  `v-inventory.md:717`.
- `reports/v-inventory.md:314`, `:624`, `:880`:
  `#d6--the-confidence-floor-and-margin-are-calibrated-on-four-data-points` to
  `#d6-the-...`. Heading at `v-inventory.md:550`.

Two in `archive/2026-09-11-phase-1-6a-plan.md` were bare fragments — `#metrics`
at `:34` and `#fluxbench-week-1-corpus` at `:62` — in a document that has only
two headings, neither of them these. They are not typos: this document is a step
plan **extracted out of** the week-1 plan into `archive/`, and the two fragments
still point at the plan's own sections, which survive at
`mvp-week1-web-automation-reliability-plan.md:495` (`## Metrics`) and `:515`
(`## FluxBench Week 1 Corpus`). Both now carry the file they belong to:
`../../mvp-week1-web-automation-reliability-plan.md#metrics` and
`...#fluxbench-week-1-corpus`. The archive lost the context, not the target.

The eighth, `reports/x-identity-wire.md:123`, pointed at
`#a-capture-side-hole-i-did-not-own`, which exists nowhere in that file. The
text it means is real — a bold paragraph at `x-identity-wire.md:305`, "**A
capture-side hole I did not own.**", inside `## What is still lossy`. I
considered promoting it to an `###` heading, which would make the link resolve
exactly as written, and rejected it: that section has **five** sibling
paragraphs in the same bold lead-in form, and promoting one of the five would
leave another worker's report with an outline that misrepresents its structure.
The link now points at the enclosing section, `#what-is-still-lossy`. The reader
lands about thirty lines above the paragraph; the link text, "the capture-side
hole", still says what to look for.

**Correction to x4g.** Its item 12 (`reports/w2-flow-lane.md:19`) is marked "Not
a defect", and it is right — that link never appeared in the failing run. The 15
failures are its items 1-11 and 13, with three fragments repeated.

### The config

`scripts/structure-audit/config.mjs`: `docsLinkDirs: ["docs/architecture"]` to
`["docs"]`, the one-line change the file itself predicted.

Its comment block was a description of the exclusion — the count, the shapes,
and where they were recorded. Left alone it would document a state that no
longer exists, so I rewrote it to say what the setting now enforces and why
working documents especially need it (they are agent memory, and they
cross-reference far more heavily than architecture documents, so they rot
faster), keeping the four shapes as a short list since each is a mistake that
will recur. It points at this report. The repository-root exclusion note is
unchanged and still correct.

## Commands run and observed results

**Before, with the config already widened**, so the run shows what the widening
exposes — exactly the 15 x4g predicted, no more and no fewer:

    $ node scripts/structure-audit.mjs --rule docs-links
      FAIL  [docs-links] docs/working/mvp-week1-web-automation-reliability-plan.md:573: ... briefs/ is a directory with no README.md, so the link has nothing to open.
      FAIL  [docs-links] docs/working/mvp-week1-web-automation-reliability-plan.md:578: ... archive/ is a directory with no README.md, so the link has nothing to open.
      FAIL  [docs-links] .../archive/2026-09-11-phase-1-6a-plan.md:34: the link to #metrics is broken: this document has no heading or anchor "metrics".
      FAIL  [docs-links] .../archive/2026-09-11-phase-1-6a-plan.md:62: the link to #fluxbench-week-1-corpus is broken: this document has no heading or anchor ...
      FAIL  [docs-links] .../archive/2026-09-12-superseded-plan-sections.md:13: no tracked file is at .../archive/mvp-week1-.../archive/2026-09-11-phase-1-1-plan.md.
      FAIL  [docs-links] .../archive/2026-09-12-superseded-plan-sections.md:32: same shape, phase-1-6a.
      FAIL  [docs-links] .../archive/2026-09-12-superseded-plan-sections.md:39: same shape, briefs/wave-2.md.
      FAIL  [docs-links] .../archive/2026-09-12-wave-3-outcomes.md:15: same shape, reports/.
      FAIL  [docs-links] .../reports/p-core-version.md:133: the link to ../integrations/automation-studio-importing-repos.md is broken.
      FAIL  [docs-links] .../reports/v-inventory.md:276: #f2--the-assert-verbs-new-timeout-status
      FAIL  [docs-links] .../reports/v-inventory.md:314: #d6--the-confidence-floor-and-margin-are-calibrated-on-four-data-points
      FAIL  [docs-links] .../reports/v-inventory.md:365: #f2--the-assert-verbs-new-timeout-status
      FAIL  [docs-links] .../reports/v-inventory.md:624: #d6--the-confidence-floor-...
      FAIL  [docs-links] .../reports/v-inventory.md:880: #d6--the-confidence-floor-...
      FAIL  [docs-links] .../reports/x-identity-wire.md:123: #a-capture-side-hole-i-did-not-own

    structure-audit: 15 violation(s) across 1 rule(s).
    EXIT=1

(Paths elided for width; every line's full text was read, and each named the
file, line and target quoted in the sections above.)

**After the fixes:**

    $ node scripts/structure-audit.mjs --rule docs-links
    structure-audit: passed (0 warning(s), 0 baselined).
    EXIT=0

**Full audit, the whole rule set:**

    $ node scripts/structure-audit.mjs
      warn  [class-methods] ... (56 warnings, all pre-existing advisory thresholds)
    structure-audit: passed (56 warning(s), 17 baselined).
    EXIT=0

No `FAIL` line. 56 warnings and 17 baselined is the same clean state x4g
recorded, so the widening added no finding and removed none.

**The rule's own tests**, unchanged by this work and still green:

    $ node --test "scripts/structure-audit/rules/tests/*.test.mjs" "scripts/structure-audit/tests/*.test.mjs"
    # tests 88
    # pass 88
    # fail 0

### Proof the widened rule bites in `docs/working/`

x4g proved the rule on an architecture document, which proves nothing about the
directory this task added. So I broke three links inside a working document —
`archive/2026-09-12-wave-3-outcomes.md`, appended at the end — choosing one of
each shape that actually occurred here, including a cross-file fragment and the
exact double-hyphen mistake behind five of the 15:

    $ node scripts/structure-audit.mjs --rule docs-links
      FAIL  [docs-links] docs/working/.../archive/2026-09-12-wave-3-outcomes.md:41: the link to ../reports/README-renamed.md is broken: no tracked file is at docs/working/mvp-week1-web-automation-reliability-plan/reports/README-renamed.md. Point it at where the file moved to, or remove the link.
      FAIL  [docs-links] docs/working/.../archive/2026-09-12-wave-3-outcomes.md:42: the link to ./2026-09-12-superseded-plan-sections.md#a-heading-that-was-renamed is broken: .../2026-09-12-superseded-plan-sections.md has no heading or anchor "a-heading-that-was-renamed". ...
      FAIL  [docs-links] docs/working/.../archive/2026-09-12-wave-3-outcomes.md:43: the link to ../reports/v-inventory.md#d6--the-confidence-floor-and-margin-are-calibrated-on-four-data-points is broken: .../v-inventory.md has no heading or anchor "d6--the-confidence-floor-and-margin-are-calibrated-on-four-data-points". ...

    structure-audit: 3 violation(s) across 1 rule(s).
    EXIT=1

Restored from a copy taken before the break — not `git checkout --`, which would
have discarded this task's own fix in that same file — then:

    $ git diff --stat -- .../archive/2026-09-12-wave-3-outcomes.md
     1 file changed, 1 insertion(+), 1 deletion(-)      # the fix, and nothing else

    $ node scripts/structure-audit.mjs --rule docs-links
    structure-audit: passed (0 warning(s), 0 baselined).
    EXIT=0

The third failure is the important one: had the rule been running when
`v-inventory.md` was written, it would have caught that fragment at the
keystroke rather than three sessions later.

## The sixteenth failure — read this before dismissing it

Between the "before" run and the "after" run, this appeared:

      FAIL  [docs-links] docs/architecture/repository-layout.md:314: the link to ../../scripts/structure-audit/rules/docs-links.mjs is broken: no tracked file is at scripts/structure-audit/rules/docs-links.mjs.

Not caused by anything I changed. `git status` showed
`scripts/structure-audit/rules/docs-links.mjs` and its test file as `??`,
untracked. x4g had staged them deliberately, and said so, precisely because the
new documentation links to the rule and the rule only sees tracked files. Commit
`8394557` ("Add the Lab's extraction intent seam, and make two preview limits
one") landed during this task and the index no longer held them.

I re-staged both with `git add`. No edit to either file, and no commit. The run
was clean afterwards.

**The standing hazard**: this rule's own source must stay staged or committed,
or the check fails on the architecture document that documents it. It is
self-referential, and the failure message accuses `repository-layout.md` rather
than naming the real cause, which is what cost the time here. Committing
`docs-links.mjs` closes it for good; until then, anything that resets the index
reintroduces it.

## Not verified

- **Nothing was rendered on GitHub.** Every fix is verified by the rule's slug
  implementation, which x4g argues follows GitHub's algorithm but did not check
  against GitHub itself. The two anchors I aimed at the parent plan (`#metrics`,
  `#fluxbench-week-1-corpus`) I also confirmed by hand against the headings at
  `mvp-week1-web-automation-reliability-plan.md:495` and `:515`.
- **`pnpm check`, `pnpm test` and `pnpm build` were not run.** This task changed
  Markdown and one configuration array; no TypeScript, test or build input was
  touched. `pnpm check` begins with this audit, which was run directly and is
  quoted above. Other workers had uncommitted changes under `domain/src/` during
  this task, so a full run would have reported their state, not mine.
- **The two new README files are indexes I wrote, not documents that existed.**
  Every row is read off the file it names or off the plan's sentence about it,
  and no row asserts anything beyond the heading and scope each file states.
  They are not independently reviewed.
- **`#what-is-still-lossy` is a section link, not a paragraph link.** It lands
  the reader in the right section, roughly thirty lines above the paragraph the
  original author meant. A deliberate trade, explained above, not an exact
  restoration of intent.
- **The Core document was confirmed to exist** at
  `F:\!FluxIQ\docs\integrations\automation-studio-importing-repos.md` by listing
  that directory. Its contents were not read, so "now explains" is the original
  author's claim, carried across unchanged.
- **No live browser behaviour is involved**, so none was exercised.

## Open questions or contradictions found

1. **The rule cannot see its own untracked source, and reports it in the wrong
   place.** Committing `scripts/structure-audit/rules/docs-links.mjs` closes it.
   Until then any index reset reopens it, and the message accuses
   `docs/architecture/repository-layout.md`.
2. **Nothing stops the next cross-repository link from being written as a
   relative path.** The rule rejects one that escapes the checkout, which is the
   safe direction, but `../integrations/...` failed here only because it
   happened to resolve nowhere — a path that accidentally resolved to a real
   local file would have passed while meaning the wrong document. The convention
   this report adopts (name the repository, put the path in a code span, do not
   make it a link) is written down here and enforced nowhere.
3. **Three README files are now load-bearing.** Both new indexes and
   `reports/README.md` are each the sole target of a link in a document that
   does not mention them by name. Deleting any one is a build failure in an
   unrelated file. That is the rule working as designed, but it is worth knowing
   before someone tidies one away.
