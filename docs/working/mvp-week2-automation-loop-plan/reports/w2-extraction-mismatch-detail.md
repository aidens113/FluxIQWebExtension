# w2-extraction-mismatch-detail

Task t015. Worktree `F:\fxwork\t015-extraction-mismatch-detail`, branch
`task/t015-extraction-mismatch-detail` (merged up to `d697f3f`, the t010 click
fix). Nothing committed.

## Outcome

Done. A failed extraction now leaves behind which records did not match, which
fields differed and what each side held, bounded and inside the evidence
boundary; and a declared expectation the run could not judge is now stated in
`evaluation.json` instead of being dropped silently. Both are proved by a live
DeepSeek run, not by compilation.

The answer to the question the brief opened with: **those five records were
genuinely wrong values, not a row-order difference**, and the difference is one
field on each of them.

## 1. What the five records actually were

Confirmed live in run `run-mu7d6vgo-02e140e5`
(`F:\r15\run-mu7d6vgo-02e140e5`), which reproduces the shape exactly:
`expectedRecords 40, observedRecords 40, comparedRecords 40, matchedRecords 35,
expectedFields 120, presentFields 120, unexpectedFields 0, nonStringValues 0`.

The new `snapshots/extraction-mismatches.json` names them:

```
positions 12, 17, 21, 26, 35 — all "values-differ", one field each:
  field "employees", expected { held: "null" }, observed { held: "text", characters: 0, value: "" }
matchedInAnyOrder 35, orderOnly false
```

Those five positions are exactly the five Logistics companies that have never
filed a headcount — Garrowby, Ivybridge, Larkhill, Northaven and Shawcross
Logistics. I derived that set independently from the fixture generator
(`apps/scenario-lab/src/scenarios/company-directory/companies.ts`: a company
carries no `employeeBand` when `mix(index, 31) % 9 === 4`) before the run, and
the run's positions matched the prediction one for one.

**Order was not the cause.** `matchedInAnyOrder` is 35, the same as
`matchedRecords`: setting position aside gains nothing, so the five are not
records read correctly and rearranged. Had it been an ordering difference,
`matchedInAnyOrder` would have been 40 and `orderOnly` true.

**The underlying defect**, which the run can now be read for rather than
guessed at: the created Flow reads the Employees **cell** rather than the
`.employees` **element** inside it. `markup.ts` renders
`<td class="employees-cell"></td>` with no child for a company that filed no
headcount, so a cell read yields `""` while the fixture expects no value at all
(`employees: null`). That is the D16 distinction — a field carried with no
value is not a field the record never carried, and neither is an empty string.
It is one defect repeated five times, not five defects, and it is a reading
rule rather than a data error. I have not fixed it; it is outside this brief.

Note that `presentFields` was 120 of 120 and `unexpectedFields` 0 throughout,
so no existing count could have pointed at this: `employees` is in
`optionalFields` and therefore contributes to neither.

## 2. The comparison rule

**Kept positional as the verdict, and added an order-insensitive count beside
it.** `matchedRecords` still decides pass or fail, exactly as before;
`matchedInAnyOrder` is measured from the same pairing and published alongside.

Why not switch to matching by a key:

- `ExpectedExtraction` declares no key. Choosing one — the first field, the
  most distinctive field — would be the facility inventing a claim the fixture
  never made, and it would silently change what every existing fixture asserts.
- Some expectations genuinely depend on order and the fixture cannot say so
  today. `company-directory`'s own playback goal is "the **last** page of the
  Logistics sector"; a "ten newest homes" expectation is ordinal in its
  statement. Dropping order repository-wide to fix a diagnosis problem would
  weaken those to silence one report.
- The brief's point stands that "logistics companies" states no order — but
  the cost of that strictness was never the strictness, it was that nobody
  could **see** which of the two had happened. Measuring both removes the cost
  without weakening any judgement: a future run whose only fault is
  arrangement now says so in one field (`orderOnly: true`), and the decision
  to relax a particular fixture can then be made on evidence.

`matchedInAnyOrder` pairs whole records, exactly as the positional judgement
compares them, and only disregards where they sit. Each observed record answers
at most one expected record, so a list holding a value twice cannot match it
twice. Positional matches are taken first and never given away, so the count is
always at least the positional one — the contract enforces that, and a producer
reporting fewer is refused rather than believed.

## 3. What the run now retains, and the evidence boundary

New artifact `snapshots/extraction-mismatches.json`, written by both Flow lanes
and **only when something did not match** — a file that is always present says
nothing by being present.

It is a separate artifact rather than a wider `evaluation.json` because the two
have opposite boundaries. The evaluation is shareable precisely because no
string a page could have supplied is in it (D6), and
`snapshots/flow-lane.json` makes the same promise in its own header. This file
exists to carry the two values, so it states its limits in its own `policy`
block and says in place of every value it withheld that it withheld one.

What may be in it:

- **The expectation's own field names and step id.** A fixture author wrote
  them; they are in this repository. No selector, URL, page heading or markup.
- **Expected values**, which are authored fixture text, already readable in
  `apps/scenario-lab`.
- **Observed values of fields the expectation names**, under the step's stated
  disclosure rule.

The three guards:

1. **Only a named field is detailed at all.** A field the expectation names
   nowhere is counted (`unexpectedFields`) and never named or valued. That is
   the one place a page can put something no fixture author chose, so it is the
   one place a published value could be something nobody meant to publish.
2. **A scenario that declares replay secrets withholds every observed value**
   and says so: `disclosure: "scenario-declares-secrets"`, and each value
   becomes `{ held: "withheld", characters: N, rule: ... }` — its length, never
   its text, so a read that returned something is still distinguishable from one
   that returned nothing. `sensitive-input` plants
   `PLANTED-UNLOCK-CODE-DO-NOT-EXTRACT` in every saved card and
   `storefront-checkout` declares a password and four card fields. Extraction
   already refuses to read a sensitive control (D2), so no record *should* ever
   carry one; this withholds anyway, because "should never" is what a leak is
   made of. The rule comes from the scenario's own declaration, never from
   scanning text — the domain's `sensitivity/redaction.ts` is explicit that a
   predicate looking for things that resemble card numbers both misses and
   misfires.
3. **Bounds, stated in the file**: at most 25 mismatching records per step
   (`mismatchedRecords` still states the true total, `detailedRecords` how many
   are shown), at most 12 differing fields per record (`furtherFields` counts
   the rest), and values cut at 200 characters with `characters` holding the
   true length and `cut: true` saying it was cut. A step that read nothing at
   all states its counts and details no record, rather than 25 copies of "every
   field absent".

On top of that the artifact goes through `EvidenceBundle.writeStructured`,
which redacts every configured secret and the live provider credential and
refuses a document still holding a sensitive token pattern. In the proof run it
is indexed as `redaction: "applied"` and the bundle-wide redaction attestation
passed with `findingCount: 0`.

A value that carries no text is reported as a shape rather than as text:
`{ held: "absent" }` for a key the record never had and `{ held: "null" }` for
one carried with no value. Keeping those apart is what made the
company-directory defect legible.

## 4. The live artifact

`F:\r15\run-mu7d6vgo-02e140e5\snapshots\extraction-mismatches.json`, 3231
bytes, sha256 `631600b6…`, from a live DeepSeek run (4 provider calls,
`llm.mode "live"`, profile `lab-create-flow`). Its content is quoted in
section 1.

**Reproduced on the final code.** After the directory move and with
`pnpm check` passing, a second live run, `F:\r15\run-mu7dsz30-056c0fa7`,
built a different Flow (6 provider calls rather than 4) and produced the
identical result: `matchedRecords 35`, `matchedInAnyOrder 35`,
`unjudged ["pages"]`, and the same five positions 12, 17, 21, 26 and 35, each
`employees` expected `null` against observed `""`. Two independent live builds
landing on the same five records and the same field is what makes me confident
this is one reading rule rather than noise — and on this machine's faulty RAM,
a single observation would not have been enough to say so.

`evaluation.json` for the same run now reads:

```json
"matchedRecords": 35, "matchedInAnyOrder": 35, "unjudged": ["pages"]
```

## 5. The unjudged declared expectation

`RunExtractionMeasurement` gains `unjudged: ExtractionUnjudgedMember[] | null`,
a closed vocabulary of `"pages"` and `"truncated"` — the members an expectation
can declare that a run can report nothing for.

The run in the brief declared `pages: 3`, the Flow lane cannot observe the
pages an extraction followed, and the evaluation said so nowhere:
`expectedPages: 3` beside `pagesFollowed: null` is the same shape as a lane
that simply did not report, so a reader could not tell "not compared" from "not
stated". The Flow-lane snapshot did carry `unjudged: ["pages"]`, but the
evaluation is what the bench and every downstream reader use.

It is computed in `measureExtraction` from the entry and what the run reported,
using the same `unjudgeableFields` helper `assertExtraction` already refuses an
unjudgeable entry on — so the two cannot come to disagree, and no plumbing was
added. Nothing else was expanded: no new rate, no change to any bench metric.

Contract consequences, all in `packages/test-contracts`:

- The D6 no-strings guard on a measurement now also walks one level into
  arrays, so a closed-vocabulary member is allowed by name and any other string
  in an array is refused. Before this, `unjudged` would have been the first
  member able to smuggle page text past a top-level-only check.
- `unjudged` must be a set of closed names with no repeats; `matchedInAnyOrder`
  must not be below `matchedRecords` nor above `comparedRecords`.
- Both members are required and nullable. `null` means the producer did not
  state it, and a 0.3 evaluation written before they existed normalizes to
  `null` for both — deliberately not `[]`, which would claim everything
  declared was judged and is the exact false reassurance the member was added
  to remove. No schema version change: 0.3 producers state both.

## 6. Files changed

Owned paths only. Nothing under `apps/`, `domain/` or `scripts/` was edited;
the `apps/extension` changes in the worktree are the t010 merge, not mine.

- `packages/test-contracts/src/evaluation.ts` — `extractionUnjudgedMembers`,
  and `matchedInAnyOrder` / `unjudged` on `RunExtractionMeasurement`.
- `packages/test-contracts/src/evaluation-validation.ts` — validation,
  invariants, the widened D6 guard, legacy normalization.
- `packages/test-contracts/tests/evaluation-contracts.test.mjs` — fixtures and
  two new tests.
- `packages/test-runner/src/run-expectations/extraction/` — **new directory**
  (see below): `judgement.ts` (was `extraction.ts`), `measurements.ts` (was
  `extraction-measurements.ts`), `value-match.ts` (was
  `extracted-value-match.ts`), **`mismatches.ts` (new)**, `index.ts` barrel,
  and `tests/` with the four test files including the new
  `mismatches.test.ts`.
- `packages/test-runner/src/flow-lane/run-flow-lane.ts` —
  `flowExtractionMismatches` and `writeFlowExtractionMismatches`.
- `packages/test-runner/src/run-scenario.ts` — one call per Flow lane hook.
- Small fixture updates in six existing tests that construct a
  `RunExtractionMeasurement` literal.

**Why the directory move.** Adding `extraction-mismatches.ts` made three files
share the `extraction-` prefix in `run-expectations/`, which
`scripts/structure-audit.mjs` fails with the remedy "Create
`run-expectations/extraction/` and strip the prefix from their names"
(`naming.mjs` counts a sibling named exactly for the prefix as part of the
group). `extracted-value-match.ts` moved in with them because it is used only
by those modules. Separately, the artifact writer first lived in
`run-scenario.ts` and pushed it to 814 lines against an 800-line limit; it now
lives in the flow lane, which is where the projection it writes already is, and
`run-scenario.ts` is back to 790.

## 7. Commands run and observed results

- `pnpm --filter @fluxiq-web-extension/test-contracts test` →
  `# tests 115  # pass 115  # fail 0`.
- `pnpm --filter @fluxiq-web-extension/test-runner test` →
  `# tests 1195  # pass 1195  # fail 0` (1152 before the four test files moved
  into the new directory and the new suite was added).
- `pnpm check` → exit 0. `structure-audit` clean; only pre-existing advisory
  warnings remain, none of them mine.
- **Mutation, reverted.** In `matchesExtractionRecord` I made an expected
  `null` match whatever the record held (`if (expected[key] === null)
  continue;`), which is precisely the mutation that would report these five
  records as matched. Result: `# pass 1149  # fail 3`, with the two relevant
  failures being the new
  `an expected null against an empty cell is stated as the two different things it is`
  and the existing
  `an expected null matches only a field present with null, never a missing field or an empty string`.
  The third, `FIFO tickets prevent a later scheduler from overtaking an earlier
  waiter`, is an unrelated timing test that passed on the reverted rerun. After
  reverting: `# pass 1152  # fail 0`.
- Live: `FLUXIQ_TEST_RUNS_DIR='F:\r15' FLUXIQ_TEST_ENV_FILES=none
  FLUXIQ_TEST_TARGET=isolated FLUXIQ_LAB_INSTANCE=t015 pnpm lab:campaign
  company-directory-logistics-sector` — results in sections 1 and 4.

## 8. Environment fact: Windows MAX_PATH, and three runs lost to it

**The Lab cannot run in a worktree whose path is long, unless the runs
directory is moved.** Three attempts died with
`Core web panel production build did not succeed`, which reads as the shared
Core being stale but was not. The build log says, deterministically:

```
TurbopackInternalError: path length for file
F:\fxwork\t015-extraction-mismatch-detail\test-runs\instances\t015\.core-web-build\
7a4d3d9b3ca32e175fc73194\b-66d469ce7d46\apps\web\.next\server\app\api\programs\
automation-studio\run-datasets\[projectId]\[runId]\[datasetId]\route\
server-reference-manifest.json exceeds max length of filesystem
```

`F:\fxwork\t015-extraction-mismatch-detail` is three characters longer than
`F:\fxwork\t010-click-landing-in-place`, and that is the entire difference —
t010 was within three characters of the limit. The Core web build is the
deepest path the facility creates and it lives under the runs directory, so
`FLUXIQ_TEST_RUNS_DIR='F:\r15'` fixes it completely; every run in this report
is under `F:\r15`, not `test-runs/`. The supervisor is handing the durable fix
(short worktree slugs, or a short default runs root on Windows) to the worker
that owns worktree tooling.

Two further environment facts worth recording:

- A fourth run was lost to the shared Core being rebuilt mid-run. The Lab
  caught it itself and said so:
  `{"lab":"core-build","state":"changed-during-run", ... "filesBefore":2688,"filesAfter":108}`.
  That diagnostic did its job.
- A worker cannot `git merge`; the hook blocks it. This task needed dev merged
  for the t010 click fix, without which the click fails
  `web.validation.output_not_observed` — "the click was prevented and the
  location did not change" — and the extract node never runs at all, so
  extraction reports `status: "not_run"`. The supervisor merged on request.

## 9. Not verified

- **The underlying extraction defect is not fixed.** The created Flow still
  reads the empty Employees cell as `""`. Whether the right fix is in the
  domain's extraction, in Core's proposal, or in what the model is asked for, I
  did not investigate — it is outside this brief.
- **Only the created-Flow lane was exercised live.** The recorded-Flow lane
  writes the artifact through the same `writeFlowExtractionMismatches` call and
  is covered by unit tests, but no live run went through it. The recording lane
  computes measurements through `runExtractionMeasurements` and therefore gets
  the two new members, but writes no mismatch artifact.
- **The `scenario-declares-secrets` disclosure rule was not exercised live.**
  It is unit-tested, including that the planted unlock code and its field name
  never appear in the serialized output, but no live `sensitive-input` or
  `storefront-checkout` run was made.
- **The bounds were not exercised live**: no live run produced more than 25
  mismatching records, a value over 200 characters, or more than 12 differing
  fields in one record. All three are unit-tested.
- **The redaction attestation's file coverage.** It passed with 0 findings on
  the proof run, but it reports `scannedFiles: 6` for the bundle scope and I
  did not confirm the new artifact is among those six. The artifact's safety
  rests on the disclosure rule and `writeStructured`, not on that scan.
- **`docs/architecture/testing-facility.md` line 932 still refers to
  `run-expectations/extraction-measurements.ts`**, which is now
  `run-expectations/extraction/measurements.ts`. I did not edit it: `docs/` is
  outside the paths this brief gave me. One-line fix for whoever owns it.
- **No `pnpm test` or `pnpm build` across the whole workspace** — only the two
  packages I own, plus `pnpm check`, which covers the repository.
