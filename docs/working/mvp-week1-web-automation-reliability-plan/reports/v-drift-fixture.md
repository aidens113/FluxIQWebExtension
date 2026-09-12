# Report: v-drift-fixture

Worker: `v-drift-fixture`. Wave 3 follow-up — the `identity-drift` rendering that
was supposed to exercise Level 2 target scoring's success path.

## Outcome

**Done, with a finding that inverts the brief's premise.**

The fifth rendering exists, is honest, is discriminating, and is measured. What
it measures is that **Level 2 cannot succeed on this fixture, and no rendering of
this page can make it succeed.** That is not a fixture that needs adjusting: it
is a floor calibrated for a scale that the reachable candidates cannot reach.

- **`reworded-aria` is added** to `apps/scenario-lab/src/scenarios/identity-drift/`:
  one redesign changes the Save action's id, class, test id and visible text
  together, and keeps its accessible name in an `aria-label`. It is the only
  rendering that reaches the scored fallback instead of an exact lookup.
- **Measured on the shipped markup with Core's own matcher: the redesigned Save
  scores 0.218 (confidence 0.205); Discard, the runner-up, scores −0.360.** The
  margin is **0.578**, nearly three times the 0.20 margin. The ranking is right.
  The resolver refuses anyway, because 0.218 is under the 0.35 floor.
- **The margin is not marginal — it is enormous. The floor is the whole
  problem**, and it is one-dimensional: see
  [The floor is unreachable](#the-floor-is-unreachable-and-this-is-arithmetic-not-tuning).
- **`w3-matcher-packaging`'s estimate was wrong.** It proposed exactly this
  fixture — "`aria-label="Save changes"` on a button with a new id, no test id
  and new text. That scores about 0.5 and would resolve." **That markup measures
  −0.064.** I built it and ran it; the number is in the candidate table below.
  Nothing was mis-specified by that worker beyond an unrun estimate, but the
  supervisor should treat the "0.5" line in that report as retracted.
- **The spec row pins the measured behaviour**, including the scores, in a
  comment, and is written so that lowering the floor below 0.218 makes it fail
  loudly rather than silently changing meaning.

**One ownership widening**, reported rather than hidden: I edited
`apps/scenario-lab/e2e/identity-drift.spec.ts`, which the brief's Owns line does
not name. Adding a mode makes that a compile-time requirement, not a choice —
see [Ownership](#ownership-one-file-the-brief-should-have-named).

## The fixture

`apps/scenario-lab/src/scenarios/identity-drift/save-action.ts`:

```html
<button type="submit" class="ui-button ui-button--accent" aria-label="Save changes">Save</button>
```

against the baseline the recording reads:

```html
<button type="submit" id="save-settings" class="btn btn-primary" data-testid="save-changes">Save changes</button>
```

**Why each choice, and why none of them is tuning.**

- **The class vocabulary is `selector-only`'s** (`ui-button ui-button--accent`),
  not a third invented one. The two modes then read as one redesign of one page,
  which is what a drift corpus should look like.
- **No id and no test id** because the redesign's component library emits
  neither. That is the common case with a design system, and it is what three of
  the four existing modes already do with the test id.
- **The label is shortened to "Save", and `aria-label` carries the full name.**
  This is the one choice that could look convenient, so: a shortened visible
  label *needs* the fuller accessible name to contain it, or the control fails
  WCAG 2.5.3 Label in Name. The accessible name is preserved here by the
  redesign's own accessibility rule. The alternative the source report suggested
  — visible "Apply" with `aria-label="Save changes"` — is a 2.5.3 *violation*, so
  it is the less honest markup as well as the lower-scoring one (−0.064).
- **Discard is untouched and still plausible**: `btn btn-secondary`,
  `data-testid="discard-changes"`, "Discard changes". It shares a class prefix
  with the recorded button and is the control a resolver without a floor would
  reach for. The pool is 2, as in every other rendering.

I did not tune the markup until a number came out right. I measured eleven
markups, reported all of them, and shipped the one that is the most defensible
page — which is neither the highest nor the lowest scorer of the honest set.

## Measured: the fixture as shipped

Every number is Core's, produced by running the real
`content/identity/{candidates,score}.ts`, `describe-element.ts` and
`resolve-target.ts` — bundled with the extension's own esbuild alias plugin —
in real Chromium (1280×720) against the fixture's real rendered HTML.
Method and its cross-check are in [How this was measured](#how-this-was-measured).

Recorded descriptor (read off the baseline page, not hand-written): the nine
signals `score.ts` compares are `visibleText`/`accessibleName` "Save changes",
`id` "save-settings", `testId` "save-changes", `tagName` "button", `role`
"button" (implied), `selector` "#save-settings", `classNames` ["btn",
"btn-primary"]. `label` is absent on a `<button>`, so it is not compared.
**Comparable weight: 138, plus 4 for a candidate in view = 142.**

| Rendering | Resolved by | Save action | Discard | Confidence |
| --- | --- | --- | --- | --- |
| `baseline` | Level 1 selector | 1.000 | −0.360 | 1.000 |
| `selector-only` | Level 1 exact text | 0.149 | −0.360 | 0.140 |
| `text-only` | Level 1 selector | 0.170 | −0.360 | 0.150 |
| `moved` | Level 1 selector | 0.686 | −0.360 | 0.686 |
| `wrapped-aria` | Level 1 selector | 0.694 | −0.360 | 0.694 |
| **`reworded-aria`** | **nothing — refused** | **0.218** | **−0.360** | **0.205** |

(`moved` measures 0.686, not the 0.694 `w3-matcher-packaging` grouped it at: the
below-fold button earns no `visibility` signal. Minor correction to that table.)

The `reworded-aria` Save action's contributions, in points out of weight:

| Signal | Points | Why |
| --- | --- | --- |
| `accessibleName` | **+24 / 24** | exact — the `aria-label` |
| `visibleText` | **+19.68 / 24** | 0.82: "Save" is a substring of "Save changes" |
| `role` | +10 / 10 | button |
| `tagName` | +7 / 7 | button |
| `visibility` | +4 / 4 | in the viewport |
| `id` | **−14.3 / 26** | candidate has none: −0.55 × 26 |
| `testId` | **−15.4 / 28** | candidate has none: −0.55 × 28 |
| `selector` | −3.5 / 14 | candidate can offer none: −0.25 × 14 |
| `classNames` | −0.5 / 5 | no overlap: −0.1 × 5 |
| **Total** | **30.98 / 142 = 0.218** | floor 0.35 |

## The floor is unreachable, and this is arithmetic, not tuning

Level 2 runs only when **every** Level 1 strategy misses. Those strategies are
the recorded selector, the recorded xpath, `getElementById`, `[data-testid=…]`,
the authored name, the recorded class set as a query, and the exact visible
text. Each is keyed off the recorded id, test id, classes or exact text. So:

- If the id still matches, Level 1 resolves and Level 2 never runs.
- If it does not, Core charges **−0.55 × 26 for a missing id and −0.55 × 28 for a
  missing test id — −29.7 of 142, i.e. −0.209 normalized — before a single word
  is compared.** The recorded descriptor's two stable identifiers are 54 of its
  138 comparable points, and both are guaranteed to be against you.

What is left to earn: `visibleText` ≤ 24 (and 24 only if the text is exact,
which Level 1 would then have matched), `accessibleName` 24, `role` 10,
`tagName` 7, `visibility` 4, `classNames` ≤ 2.5 (a full class match triggers
Level 1's class query), `selector` ≤ 0. **Ceiling: 38.3 / 142 = 0.270.**

Measured, not derived — eleven markups, same method:

| Markup | Score | Level 2 reachable? |
| --- | --- | --- |
| `aria-label`, new id/class, text "Apply" (the source report's proposal) | **−0.064** | yes |
| renamed test id, `aria-label`, text "Save" | 0.118 | yes |
| new id/class, `aria-label`, text "Save" | 0.167 | yes |
| **shipped**: no id/test id, new class, `aria-label`, text "Save" | **0.218** | yes |
| no id, one shared class `btn`, `aria-label`, text "Save" | 0.233 | yes |
| no id, one shared class, `aria-label`, **exact** text | 0.264 | **no** — L1 text resolves it |
| no id/test id, class `btn`, `aria-label`, text "SAVE CHANGES" | **0.270** | yes — **the ceiling** |
| both classes kept, `aria-label`, text "SAVE CHANGES" | 0.287 | **no** — L1 class query resolves it |
| keeps `id="save-settings"`, drops test id, new text/class | 0.394 | **no** — L1 selector resolves it |

The ceiling row exists because Level 1's exact-text fallback is
**case-sensitive** (`normalizeText` collapses whitespace only) while Core's
`textSimilarity` lowercases, so a label that was only re-cased falls through to
scoring with a perfect text match. That is a real, if incidental, divergence
between the two layers, and even exploiting it lands at 0.270 against a 0.35
floor.

**The general statement, which matters beyond this fixture:** Level 2's
*enumerate-and-score* path can succeed only for a target that was recorded
**without** a stable identifier. Any target recorded with an id or a test id is
either resolved exactly by Level 1 or refused by the floor — there is no third
outcome. Level 2's one proven win, on `ambiguous-targets`, is the *tie-break*
path, where the recorded test id still matches a live candidate and does the
discriminating. Those are two different capabilities and only one of them works.

### What the supervisor might do about it — data, not a recommendation

I did not change `content/identity/**`, as the brief required. Three routes, in
the order they are cheap:

1. **Lower the floor.** Everything measured on both fixtures that *should* be
   refused sits at or below 0.170; the one that should resolve sits at 0.218.
   A floor in 0.18–0.21 separates them. But that is a 0.048 gap calibrated on
   two fixtures, which is thinner than the current 0.35 floor's 0.17–0.69 gap.
   It buys the drift case at the cost of margin against a corpus nobody has run.
2. **Reconsider the missing-identifier penalty** — Core's, so a Core decision.
   Core charges −0.55 for a stable identifier the candidate *lacks* and −0.8 for
   one that *disagrees*. A page that stopped emitting ids is much weaker evidence
   of "different control" than a page emitting a different id, and the two are
   currently within 0.25 of each other on the largest weights in the table.
3. **Normalize over the weight the candidate can answer**, rather than over every
   recorded signal. This is the change with the biggest effect and the biggest
   blast radius, and it is Core's formula.

Both 2 and 3 are Core changes; 1 is `score.ts`, two constants, and would need the
`identity-resolution.spec.ts` row updated in the same unit of work — it is
written to fail rather than drift if the floor moves under 0.218.

## What changed and why

| File | Change |
| --- | --- |
| `apps/scenario-lab/src/scenarios/identity-drift/modes.ts` | `reworded-aria` added to the mode tuple; the doc comment now says which modes are corpus rows and what the new one is for. |
| `…/identity-drift/save-action.ts` | The rendering, with the reasoning for each drifted signal in the comment, including the WCAG 2.5.3 point. |
| `…/identity-drift/manifest.ts` | One variant, matching the four existing ones, expecting a successful save. Its description says no week 1 corpus row covers it yet. |
| `…/identity-drift/tests/scenario.test.ts` | Asserts the new rendering's exact attributes, its text, that it carries no id, and its position before Discard. Test renamed from "corpus row" to "variant", since the fifth has no corpus row. |
| `apps/scenario-lab/e2e/identity-drift.spec.ts` | The drift case the new variant requires. See Ownership. |
| `apps/extension/e2e/content/tests/identity-resolution.spec.ts` | One row, plus a header paragraph. |

`render.ts` needed no change: the new mode renders in the primary actions group
like every mode but `moved`.

**The spec row** (`reworded-aria: the surviving accessible name ranks the right
control first, and the floor still refuses it`) asserts, in order: that the id,
the test id and the recorded class set are all gone from the page; that the
exact recorded text is gone but a control with the accessible name "Save
changes" is present and reads "Save"; then that the replayed descriptor produces
`TARGET_NOT_FOUND`, `strategy: "fingerprint"`, `candidateCount: 2`, the
byte-exact not-found message, and a fixture state with `saveCount: 0` and
`discardCount: 0` — nothing was clicked, including not Discard.

It is deliberately **not** a near-duplicate of the existing
`a control whose every recorded signal has drifted is refused` row. That row
drifts everything including the accessible name and the top-ranked candidate is
the *wrong* control. This row keeps the strongest signal a redesigned page can
honestly keep, the top-ranked candidate is the *right* control by 0.578, and it
is refused anyway. The two together are what make the finding legible.

## Ownership: one file the brief should have named

Owns said `apps/scenario-lab/src/scenarios/identity-drift/` and its tests, plus
`apps/extension/e2e/content/tests/identity-resolution.spec.ts`. I also edited
**`apps/scenario-lab/e2e/identity-drift.spec.ts`**, and there is no version of
this task that does not:

- its `driftCases` is `Record<Exclude<IdentityDriftMode, "baseline">, DriftCase>`,
  so a new mode without a case is a **type error**, and
- it carries `test("every manifest variant has a drift case in this spec")`,
  which fails on a new variant with no case.

This is the brief defect the wave rules describe as ownership drawn around a
file rather than around the change. The added case asserts the rendering's
attributes and that a person searching by the accessible name still finds it;
the variant now passes there (8/8).

**One file I did *not* touch and the supervisor may want to:**
`packages/test-runner/src/bench/corpus/week1.ts` is a fixed W01–W28 table and
W20–W23 are identity-drift's. `reworded-aria` therefore has **no bench corpus
row** and never runs in a `pnpm lab` bench. Nothing breaks —
`week1-corpus.test.ts` enumerates corpus rows, not lab variants, and I confirmed
it is unaffected — but the rendering only earns its keep in the bench once a row
names it, and that file is outside my Owns.

## Commands run and observed results

`EXTENSION_TEST_BUILD_LABEL=v-drift-fixture` was set for every extension command.
No `pnpm build`, no `pnpm lab`, no `pnpm structure:baseline`. Exit status was
captured by redirecting to a file and echoing `$?`, never through a pipe. Every
file was written with the editing tools, never a Bash heredoc.

| Command | Exit | Observed |
| --- | --- | --- |
| `pnpm --filter …/extension check` | **0** | `tsc -p tsconfig.json --noEmit && tsc -p tsconfig.test.json`, no diagnostics. Run twice, before and after the final comment trim. |
| `playwright test -c e2e/playwright.content.config.ts content/tests/identity-resolution.spec.ts --workers=4` | **0** | `17 passed (4.1s)` — the four drift rows, the five scored rows including the new one, the gate rows, the visual-target rows. |
| Full content harness, `--workers=4` (first run) | **0** | `187 passed (20.8s)`. |
| Full content harness, `--workers=4` (after the comment trim) | **1** | `186 passed, 1 failed`. The failure is `failures.spec.ts › on navigation › a post-condition that never appears is OUTPUT_NOT_OBSERVED` with `Tearing down "openHarness" exceeded the test timeout of 30000ms` — a teardown timeout, in a file this brief does not own, that passed in the run above. The same failure is recorded in `w3-matcher-packaging`. |
| `playwright test … content/tests/failures.spec.ts --workers=4` (the rerun the wave rules require) | **0** | `10 passed (3.3s)`. Load, not a regression. |
| `pnpm --filter …/scenario-lab check` | **0** | `tsc -p tsconfig.json --noEmit`, clean. |
| `pnpm --filter …/scenario-lab test` | **0** | `# tests 118 / # pass 118 / # fail 0`, including the extended identity-drift rendering assertions. Check and test were each run twice, either side of a final comment amendment. |
| `tsc` over `apps/scenario-lab/e2e/**` with a scratch tsconfig | **0** | Clean. The package's own `check` covers `src/**` only, so the e2e spec I had to edit is otherwise type-checked by nothing; this is how the new drift case was proven to compile. |
| `playwright test -c apps/scenario-lab/e2e/playwright.config.ts identity-drift.spec.ts --workers=4` | **0** | `8 passed (3.6s)`, including `reworded-aria variant: the drifted Save action is recoverable and the save succeeds` and `every manifest variant has a drift case in this spec`. |
| `node scripts/structure-audit.mjs` with a scratch `GIT_INDEX_FILE` (a copy of `.git/index`; the real index was never written) | **0** | `structure-audit: passed (29 warning(s), 19 baselined)`. An intermediate draft put `identity-resolution.spec.ts` at 407 lines and added a 30th warning; the comments were tightened to 400, which is the advisory threshold exactly, and the warning is gone. No finding names a file this brief touched. |
| Scoring probe, real fixture markup, real Chromium | **0** | The table above. Reproduces `w3-matcher-packaging`'s published 0.149 / 0.170 / 0.694 / −0.360 exactly, which is the cross-check that the method is faithful. |
| Scoring probe, eleven candidate markups | **0** | The candidate table above. |

### How this was measured

The probe bundles the *real* `content/identity/candidates.ts`,
`content/identity/score.ts`, `content/describe-element.ts` and
`content/action-runtime/resolve-target.ts` with esbuild and the extension build's
own `browserSafeWorkspacePlugin` aliases, loads the fixture's real rendered HTML
in real Chromium at the harness's viewport, reads the recorded descriptor off the
baseline page with `describeElement`, and then, per rendering, enumerates
candidates and scores them exactly as the resolver does — including calling
`resolveTargetWithDiagnostics` itself, so the reported Level 1 / Level 2 outcome
is the resolver's own, not my reading of it. It runs entirely in the scratchpad
and writes nothing to the repository. Its faithfulness is not asserted: it
reproduces the four numbers `w3-matcher-packaging` published from a different
harness, to three decimals.

## Not verified

- **No live browser validation of a real replay.** Everything ran in the content
  harness (real content bundle, real Chromium, real Scenario Lab fixture) and in
  the probe. No extension, no background worker, no gateway. What a Flow sees end
  to end was not exercised, and `w3-matcher-packaging`'s open item stands: a
  *successful* resolution's scores still reach nothing, because
  `ContentActionDependencies.resolveTarget` returns an `Element`.
- **The refusal reports no scores.** `notFound` in `resolve-target.ts` carries
  `candidateCount` but not `bestScore`/`runnerUpScore`, although `scoredAmbiguous`
  beside it does. So a Flow cannot tell this rendering's near-miss at 0.218 from
  the hopeless −0.360 case; both read as "nothing matched; 2 controls of the same
  family are on the page". The spec row therefore pins the scores in a comment
  and the report, not in an assertion. Closing it is one object literal in
  `resolve-target.ts`, which this brief must not touch.
- **`pnpm --filter …/extension test`, `domain` and `packages/test-runner` were
  not run.** I changed no source in any of them. The test-runner bench reads
  `apps/scenario-lab/dist/registry.js`; `pnpm --filter …/scenario-lab test`
  rebuilt that directory from current source, which is the same build `pnpm lab`
  performs first and is git-ignored, so it is current rather than stale.
- **`pnpm check` at the repository root was not run as a single command.** Other
  workers are mid-edit; the audit, which is the first thing it runs, was run
  directly and passes.
- **The floor and the margin are still calibrated on two fixtures.** This report
  adds a third data point and a ceiling, not a corpus.
- **The report file is untracked**, so the `working-docs` index rule does not see
  it and the audit's cleanliness above does not speak to `docs/working/README.md`
  once this is committed.

## Open questions or contradictions found

1. **The brief's premise is false, and so is the source report's estimate.**
   `w3-matcher-packaging` said an `aria-label` rendering "scores about 0.5 and
   would resolve". Measured: **−0.064** for exactly that markup, **0.218** for the
   best honest version of it, **0.270** for the arithmetic ceiling of anything
   that can reach Level 2 at all, against a **0.35** floor. Level 2's success path
   is not merely unexercised on this fixture — it is unreachable on it.
2. **Level 2's enumerate-and-score fallback cannot help any target that was
   recorded with an id or a test id.** That is most recorded targets. Whether
   that is acceptable is a product question, and it is the one the calibration
   decision actually turns on. The tie-break half of Level 2 is unaffected and
   still works.
3. **The margin is not the constraint and never was.** 0.578 on this fixture,
   0.618 on `moved`/`wrapped-aria`, 0.000 on the identical twins that should tie.
   Any calibration work should treat the floor and the margin separately.
4. **Level 1's exact-text strategy is case-sensitive; Core's text comparison is
   not.** A page that only re-cased a button label falls out of Level 1 into
   scoring. Harmless today because scoring refuses it too, and worth knowing when
   the floor moves.
5. **`apps/scenario-lab/e2e/**` is type-checked by nothing in `pnpm check`.** The
   package's `check` is `tsc -p tsconfig.json --noEmit` over `src/**` only, and
   Playwright transpiles without checking. A type error in a lab e2e spec reaches
   CI as a runtime failure at best. Adding a second project reference would fix
   it; the file is not in my Owns and neither is the package manifest.
6. **`reworded-aria` has no week 1 corpus row**, so it never runs in the bench.
   One line in `packages/test-runner/src/bench/corpus/week1.ts`, outside my Owns,
   and it would need a W-number the fixed W01–W28 table does not currently have
   room for.
