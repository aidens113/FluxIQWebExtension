# Report: v-level1-veto

Worker: `v-level1-veto`. Wave 3 follow-up — Level 1 resolved and clicked
elements with no score and no floor. It does not any more.

## Outcome

**Done.** Level 1 still selects and still has precedence; every answer it
produces is now scored against the recording before it is acted on, and refused
when the page contradicts the recording more than it confirms it.

- **The exposure is closed and the closure is measured.** The
  `<button class="btn btn-primary">Delete workspace</button>` page was resolved
  and clicked; it is now refused, with `TARGET_NOT_FOUND` naming what it refused
  and what that scored. Four more class-set impostors go the same way, and so do
  two structural-selector cases nobody had named — including one where the veto
  turns a wrong click into the **right** one.
- **No drift recovery was traded away.** All four `identity-drift` modes still
  resolve, on both Core scoring scales, and the two that come closest to the
  line (`selector-only` at 0.149, `text-only` at 0.170) are the ones a veto set
  at the Level 2 floor would have destroyed.
- **The threshold is 0, and it is a statement rather than a fit.** Core's
  `normalizedScore` is agreeing weight minus disagreeing weight over compared
  weight, so below zero the page contradicts more than it confirms. Over an
  exhaustive enumeration of every profile a weak Level 1 query can land on —
  1,488 for the class set, 240 for the exact text — **not one profile whose
  label contradicts the recording reaches 0**, on either scale.
- **No strategy is exempt, and that is measured rather than conceded.** The
  brief invited an id / test-id exemption. Over the same enumeration, **no
  profile carrying the recorded id or test id is ever vetoed while its label
  agrees**, so an exemption saves nothing that needs saving; it would only admit
  the 339 profiles where an identifier survives on a control the page has
  relabelled. The differentiation the exemption was for is already inside the
  score: Core weighs an agreeing id at 26 and a class name at 5.
  [Per strategy](#the-verdict-per-strategy).
- **A veto demotes, it does not abort.** A refused strategy becomes a miss and
  resolution carries on. That is not tidiness: on a page that reordered its two
  actions, Level 1 clicked Discard, and after the veto the resolver refuses
  Discard and then *finds the Save that moved*, at 0.801.

**Core's scoring changed under me, mid-task.** A parallel worker landed the
calibration report's recommendation — a missing stable identifier charged −0.1
instead of −0.55 — between my first and second measurements. Every number below
is therefore given on **both** scales, and the veto separates correctly on both.
One consequence lands in a file I own and is called out in
[What the Core change did](#what-the-core-change-did-and-the-one-row-it-flipped).

**Two limits remain open**, both narrower than what was closed, both named with
measurements in [What the veto cannot do](#what-the-veto-cannot-do).

## The exposure, reproduced before anything changed

Real Chromium, the content modules bundled with the extension build's own
aliases, against the `identity-drift` markup copied verbatim from
`apps/scenario-lab/src/scenarios/identity-drift/`. No Scenario Lab server and no
`pnpm lab`: the question is purely about DOM identity.

The probe reproduces `v-matcher-calibration` exactly — baseline 1.000,
`selector-only` 0.149, `text-only` 0.170, `moved` 0.686, `wrapped-aria` 0.694,
`reworded-aria` 0.218, Discard −0.360 — which is what makes the new rows
comparable to that report rather than a second measurement of a different thing.

| Page | Level 1 resolves | by | score | what happened |
| --- | --- | --- | --- | --- |
| Save replaced by `btn btn-primary` "Delete workspace" | the Delete button | class set | **−0.237** | **clicked** |
| …with contradicting id and test id too | the Delete button | class set | **−0.337** | **clicked** |
| …a nameless icon button instead | the icon button | class set | **−0.203** | **clicked** |
| …"Invite members" instead | the Invite button | class set | **−0.237** | **clicked** |
| …Delete alone, no runner-up | the Delete button | class set | **−0.237** | **clicked** |

Level 2 scores every one of those below its floor and refuses. Level 1 had no
floor at all.

## The design, and why the threshold is not the floor

Level 1 selects; the scorer vetoes. When a strategy resolves exactly one
element, `identity/veto.ts` scores that element against the recorded descriptor
with the same Core matcher Level 2 uses, and refuses below the threshold.

The two constants answer different questions and it matters that they are
different numbers:

| | `TARGET_SCORE_FLOOR` | `TARGET_VETO_FLOOR` |
| --- | --- | --- |
| Question | is this good enough to **choose** from several? | is this so wrong that **acting** is dangerous? |
| Kind | selection | rejection |
| Value | 0.35 | **0** |
| Set at the other's value | — | refuses `selector-only` (0.149) and `text-only` (0.170) — the drift recovery the exit criterion depends on |

**Why zero and not a fitted value.** `normalizedScore` is the share of the
compared weight that agreed minus the share that disagreed. Negative means the
page contradicts more of the recording than it confirms. That is exactly the
rejection question, stated in the scorer's own terms, and it needs no corpus to
justify — the corpus only has to confirm that the sign lands where a person
would. It does, and the confirmation is exhaustive rather than anecdotal.

### The enumeration: what the sign actually means

Every combination of per-signal outcomes a candidate can present against the
recorded descriptor, scored with Core's own function, then filtered to the
profiles each weak query can really land on. A weak query is reached only when
every stronger one missed, and both weak queries name the recorded tag, so the
reachable subspace is much smaller than the raw product. 17,856 realistic
profiles; the two weak strategies reach 1,488 and 240 of them.

Populations are split by the *label*: "agrees" is either text signal at Core's
exact rung, "contradicts" is every text signal the recording carried either
contradicting or gone.

| Class-set strategy, 1,488 reachable | Core α = −0.55 | Core α = −0.1 (in the tree) |
| --- | --- | --- |
| label contradicts or is gone | n=144, max **−0.203** | n=144, max **−0.032** |
| …**acted on at a threshold of 0** | **0** | **0** |
| label agrees exactly | n=480, min −0.181, refused 126 | n=480, min −0.181, refused 72 |

| Bare-text strategy, 240 reachable | Core α = −0.55 | Core α = −0.1 |
| --- | --- | --- |
| label contradicts or is gone | n=0 (the query requires the text to match) | n=0 |
| label agrees exactly | n=240, refused 52 | n=240, refused 28 |

| All weak-reachable profiles, 5,952 | Core α = −0.55 | Core α = −0.1 |
| --- | --- | --- |
| label contradicts or is gone | n=576, max **−0.203** | n=576, max **−0.032** |
| …**acted on at a threshold of 0** | **0** | **0** |

So the veto at 0 is not "a number between my fixtures". It is the statement
**a weak Level 1 match must be corroborated by the recorded label**, and the
enumeration shows the sign of Core's score carries exactly that statement, with
no exception, on both scales.

**One warning about the Core change.** It moved the correct population away from
the line and the wrong population *towards* it: the worst impostor went from
−0.203 to −0.032. The separation survives, but the headroom below the line is
now 0.032. A further reduction of the missing-identifier penalty would cross it.
Whoever next touches those weights should rerun this enumeration;
`identity/tests/veto.test.ts` fails if the two populations merge.

### The refusals that are not mistakes

The "refused although the label agrees" counts above are not all cost. Every one
of the 28 bare-text refusals under the current scale has a *contradicting or
reworded accessible name* — a button reading "Save changes" whose announced name
is "Delete workspace". Refusing that is the right answer, not a false positive.
The genuine cost is the residue: 24 of the 72 class-set refusals are an
icon-only button that carries the recorded name and class but also a role the
recording did not have; measured on a real page that case scores 0.118 and is
**acted on**, so the enumerated residue is worse than reality.

## The verdict per strategy

The brief asked for a decision per strategy rather than one rule for all. Here
it is, with what each is worth. The evidence tested is what the resolved
**element** carries, not which query fired — a query is a way of asking, and
what matters is what the element answers.

| Level 1 strategy | Exempt? | Why, measured |
| --- | --- | --- |
| recorded `id` agrees | **No** | Core already weighs it at 26, the heaviest signal there is, so it is nowhere near the line: `id-reused-destructive` — the recorded id on a "Delete workspace" button — scores 0.132 / 0.220 and is acted on **without** an exemption. Over the enumeration, no id-agreeing profile with an agreeing label is ever vetoed. An exemption changes no measured outcome and admits 339 profiles where the id survives on a relabelled control. |
| recorded test id agrees | **No** | Same, at weight 28. `testid-reused-destructive` scores 0.025 / 0.108 and is acted on. |
| recorded selector, when it names an id or test id | **No** | Nothing special is needed: the element carries the identifier, so the row above already covers it. |
| recorded selector, when it is a **structural path** | **Vetoed** | This is a second exposure of the same family and nobody had named it. A page that reordered its two actions resolved **Discard** at −0.107 and clicked it; a destructive control in the recorded slot resolved at −0.044 and was clicked. Both refused now. |
| `xpath` | **Vetoed** | Positional in the same way as a structural path, and it lands on the same wrong elements. |
| authored name (`aria-label` / `name`) | **Vetoed** | An author writes it, but it is a label, not an identifier — "Close" appears on twenty dialogs. No exemption is needed anyway: Core scores the name at 24, so a name-matching candidate is strongly positive unless everything else contradicts. |
| class set | **Vetoed** | The case this brief exists for. `btn btn-primary` is one of the commonest class pairs on the web and the query does not ask what the button says. |
| exact text | **Vetoed** | Collides on any page with two identically labelled controls, and the veto costs it nothing: every correct text match measured stays positive, the tightest at 0.149. |
| coordinates / visual target | **Vetoed** | Same rule, uniformly. In practice untouched: a command carrying a point rarely carries a recorded descriptor as well, and with no recorded label the veto does not run at all. |

**The single rule this collapses to** is that no strategy is exempt, and the
differentiation the exemption list was reaching for is already inside the score,
done properly by weight instead of crudely by category.

## The corpus, before and after, on both scales

Level 1 selects exactly the same element as before in every row — the veto
changes only whether it is acted on.

| Case | Level 1 lands on | α=−0.55 | α=−0.1 | before | after |
| --- | --- | --- | --- | --- | --- |
| baseline | Save | 1.000 | 1.000 | click Save | click Save |
| `selector-only` (text query) | Save | 0.149 | 0.149 | click Save | click Save |
| `text-only` (id) | Save | 0.170 | 0.259 | click Save | click Save |
| `moved` (id) | Save | 0.686 | 0.777 | click Save | click Save |
| `wrapped-aria` (id) | Save | 0.694 | 0.783 | click Save | click Save |
| class set kept, label reworded | the right Save | 0.175 | 0.346 | click | click |
| class set kept, label shortened | the right Save | 0.226 | 0.398 | click | click |
| class set kept, shortened + `aria-label` | the right Save | 0.257 | 0.428 | click | click |
| bare text, no identifiers at all | the right Save | 0.249 | 0.420 | click | click |
| bare text, both identifiers contradicted | the right Save | 0.149 | 0.149 | click | click |
| recorded id on a destructive control | Delete | 0.132 | 0.220 | click | click — see limits |
| recorded test id on a destructive control | Delete | 0.025 | 0.108 | click | click — see limits |
| **class set on "Delete workspace"** | Delete | **−0.237** | **−0.065** | **click** | **refuse** |
| **…with contradicting identifiers** | Delete | **−0.337** | **−0.337** | **click** | **refuse** |
| **…on a nameless icon button** | icon | **−0.203** | **−0.032** | **click** | **refuse** |
| **…on "Invite members"** | Invite | **−0.237** | **−0.065** | **click** | **refuse** |
| **…alone on the page, no runner-up** | Delete | **−0.237** | **−0.065** | **click** | **refuse** |
| **structural slot now holds a destructive control** | Delete | **−0.044** | **−0.044** | **click** | **refuse** |
| **structural slot after the two actions swapped** | Discard | **−0.107** | **−0.107** | **click Discard** | **refuse, then resolve the real Save at 0.801** |
| structural slot unchanged | Save | 0.801 | 0.801 | click | click |
| icon-only with the recorded name and class | the right control | 0.042 | 0.213 | click | click |
| …with a role the recording did not have | the right control | −0.053 | 0.118 | click | refuse at α=−0.55, click at α=−0.1 |
| icon-only with no name at all | icon | −0.203 | −0.032 | click | refuse |
| text agrees, `aria-label` contradicts | the button | −0.013 | 0.158 | click | refuse at α=−0.55, click at α=−0.1 |
| `reworded-aria` | Level 1 misses | 0.218 | 0.389 | Level 2 refuses / resolves | unchanged by the veto |
| the control is gone | Level 1 misses | −0.360 | −0.360 | refuse | refuse |
| "Save changes and exit" alone | Level 1 misses | 0.088 | 0.088 | refuse | refuse |

**Both properties the brief asked for hold, with numbers.** Everything Level 1
resolved correctly still resolves — the tightest is `selector-only` at 0.149,
which is 0.149 clear of the line. The destructive case and the nameless-button
cases are refused — the closest is −0.032 under the current Core scale and
−0.203 under the previous one.

## What the veto cannot do

Both limits are real and neither is closed here. Both are measured.

**1. A recording that captured no visible text is barely protected.** The veto
checks a match against the recorded *label*; with no label it does not run at
all, and with only an accessible name it has one signal against four agreeing
structural ones. Measured, on a control recorded as an icon button named only by
`aria-label`:

| Page | score | outcome |
| --- | --- | --- |
| the recorded `aria-label` reused on a "Delete workspace" button | **0.641** | **acted on** |
| the `aria-label` gone, the recorded class set reused on "Delete workspace" | **0.145** | **acted on** |

The second is the same exposure this brief closed, surviving because the thin
recording gives the scorer nothing to weigh it against. Underneath is a Core
asymmetry worth naming: `compareTextSignal` returns early when the *recording*
lacks a signal, so a candidate's new, contradicting visible text is never
compared. Fixing that is a Core change and outside this brief.

**2. An impostor that carries the recorded label passes.** Inherent: the veto
asks whether the label corroborates, and it does. Nothing in a fingerprint can
distinguish two controls a page has made identical.

Neither limit is a regression — both were true before, unmeasured.

## What the Core change did, and the one row it flipped

A parallel worker changed Core's `compareExactSignal` missing branch from −0.55
to −0.1 while this task was running (`element-fingerprint.ts`, uncommitted in
`F:\!FluxIQ` at the time of writing). I edited nothing in Core; the copy used
for the α=−0.55 column is a scratch copy with that one constant restored.

Its consequence in a file I own: **`reworded-aria` now scores 0.389, clears the
0.35 floor, and resolves.** The existing spec row asserted `TARGET_NOT_FOUND`
and began failing. I updated it to assert the resolution, using the replacement
text `v-matcher-calibration` had already written and verified, and wrote the
dependency into the spec's header: **if the Core change is reverted, that row
must go back to expecting `TARGET_NOT_FOUND`.** Nothing about the veto is
involved in that row either way — Level 1 misses entirely there.

The three rows I added are unaffected by the revert: two compare no stable
identifier at all (so the constant never applies), and the third is 0.4 clear on
both scales. I confirmed that by running the whole probe corpus against both.

### Which constant was in the tree when each number was measured

The supervisor asked directly, so precisely: **every number in this report was
produced against a known constant, and every one that can move is given for
both.** Core was clean at −0.55 when I began; the change landed between my first
Chromium run and my first enumeration. Rather than trust that timing I made the
scale an input — the α=−0.55 column comes from a scratch copy of Core's scorer
with that one constant restored, bundled in place of the published subpath, and
the α=−0.1 column from Core's source as it stands. **Nothing in `F:\!FluxIQ` was
written.** The corpus table and both enumeration tables were then produced twice,
once per scale, after the veto was in the tree; the "before" column comes from a
run made before it existed. The veto's threshold was not calibrated against the
old matcher and left there — it separates on both, and
`identity/tests/veto.test.ts` asserts the separation rather than any value, so a
future weight change fails the build instead of quietly crossing it.

### The stale floor comment, corrected

`score.ts`'s doc comment above `TARGET_SCORE_FLOOR` still said the value was
"unreachable today" and that the fix was "Core's to make". Both were true when
written and false once D13 landed. I replaced lines 83–113 with the text
`v-core-scoring` prepared, after checking its two live numbers against my own
measurements — `reworded-aria` at **0.389** and the lone "Save changes and exit"
near-miss at **0.088**, separation **0.301** — which reproduce exactly.

I added one paragraph the prepared text did not have. `veto.ts` now sits in the
same directory with a second threshold, and the whole point of this task is that
the two answer different questions; a reader who conflates them would set the
veto at 0.35 and destroy the drift recovery. The comment now says so, and names
the two cases (0.149 and 0.170) that would be lost.

### The `reworded-aria` spec row, on the coordination note

The supervisor asked that the row expecting the resolution be kept intact if I
touched the spec. It is intact — and it is mine: no other worker rewrote it.
`v-core-scoring` read the row I had already updated and reported it as "the
parallel worker rewrote it during this task", which is the same edit seen from
the other side. There is one version of that row and it expects the resolution.

## What changed

| File | Change |
| --- | --- |
| `apps/extension/src/content/identity/veto.ts` | **New, 96 lines.** The policy: the threshold, its derivation, the per-strategy decision, and the precondition. `vetoExactMatch(target, element)` returns a verdict or `undefined`. |
| `apps/extension/src/content/identity/score.ts` | `scoreTargetCandidate` — one candidate, Core's score, no floor and no margin — beside the existing plural function, which keeps both. The floor is the wrong number for a rejection question, so the veto must not go through it. Also the `TARGET_SCORE_FLOOR` doc comment, replaced for D13 and given a paragraph separating it from the veto floor. |
| `apps/extension/src/content/identity/index.ts` | Exports the two new functions and the verdict type; the barrel comment says what the veto is for. |
| `apps/extension/src/content/action-runtime/resolve-target.ts` | Thirteen lines in the resolution loop: a single-element answer is vetoed before it is returned, and a veto pushes a described miss instead of aborting. Header updated with the exposure and the demote-not-abort rule. |
| `apps/extension/src/content/identity/tests/veto.test.ts` | **New, 175 lines.** Eleven rows pinning the *separation* rather than any value: four drifted controls above the line, four impostors below it, the two populations separated by it, and the veto threshold below the selection floor. |
| `apps/extension/e2e/content/tests/identity-resolution.spec.ts` | Three new rows (the destructive case refused; a vetoed strategy recovering the control that moved; a strong identifier resolving through the veto), the `reworded-aria` row updated for the Core change, and a header section for each. |

**No new failure code.** A veto ends as `TARGET_NOT_FOUND`, whose closed-set
definition already reads "no element matched the action's target with enough
confidence". The refusal explains itself two ways: the message names the
strategy, what it landed on and what that scored — `element fingerprint (refused
button.btn.btn-primary "Delete workspace" scoring -0.07)` — and the resolution
carries `bestScore`, `runnerUpScore` and `confidence` from the scoring that ran
after the veto. The quoted text goes through `reportable-text.ts`, so a
container's contents are still withheld.

## Commands run and observed results

`EXTENSION_TEST_BUILD_LABEL=v-level1-veto` was set for every extension command.
No `pnpm build`, no `pnpm lab`, no `pnpm structure:baseline`, and nothing in
`F:\!FluxIQ` was written. Exit status was captured by redirecting to a file and
echoing `$?`, never through a pipe.

| Command | Exit | Observed |
| --- | --- | --- |
| `pnpm --filter …/extension check` | **0** | `tsc -p tsconfig.json --noEmit && tsc -p tsconfig.test.json`, no diagnostics. Run six times through the task; one intermediate run exited **2** on my own `element.className` assignment in the spec, fixed to `setAttribute`. |
| `pnpm --filter …/extension test` | **0** | `# tests 247 / # pass 247 / # fail 0`. Subtests 146–156 are the new veto rows; 241 → 247 is this file. Rerun after the doc-comment correction: unchanged. |
| `pnpm --filter @fluxiq-web-extension/extension run test:content --workers=4 content/tests/identity-resolution.spec.ts` | **0** | `20 passed (7.3s)` — all three new rows, all four drift modes, the updated `reworded-aria`. An earlier run of the same command exited **1** with `19 passed`, the `reworded-aria` row refusing at the pre-change score; the parallel worker was mid-edit in Core when the harness bundled. Reran, and it passes. |
| `pnpm --filter @fluxiq-web-extension/extension run test:content --workers=4` (full) | **0** | `192 passed, 1 skipped`. The run before it exited **1** on `scroll.spec.ts › infinite-feed › untilStable` — a 30 s teardown timeout, not an assertion. Reran that file alone: `8 passed`. It is load on `infinite-feed`, the same flake `v-matcher-calibration` recorded, and no file I touched. |
| `node scripts/structure-audit.mjs` with a scratch `GIT_INDEX_FILE` (a copy of `.git/index` with the two new files staged; the real index was never written and `git status` still lists them untracked) | **0**, then **1** | `structure-audit: passed (32 warning(s), 19 baselined)` on two runs over my finished code. A later run exits **1** on two `[working-docs]` violations that appeared while I was writing this report: `mvp-week1-web-automation-reliability-plan.md` is **825 lines** against the 800-line compaction threshold, and `docs/working/README.md` is out of date. Neither is a file I may touch; the plan document was 789 lines at `HEAD`, so the growth is a concurrent edit, and `w3-resolver` recorded the README failing before this wave began. Reran once and it reproduced identically. **No violation names any file I own**, and the rule that would — `file-lines` — reports only advisories. |
| Chromium probe, 22 pages × the real fixture markup, `CORE_SCALE` unset and `=old` | **0** | The two before/after tables. Reproduces `v-matcher-calibration` to three decimals. |
| Chromium probe round 2, 3 recordings × 11 pages, both scales | **0** | The structural-path and authored-name findings, and both open limits. |
| Enumeration, 20,736 profiles through Core's own `scoreElementFingerprintCandidate`, both scales | **0** | 17,856 realistic; 1,488 class-reachable and 240 text-reachable; **0 acted on with a contradicting label** on either scale. |

### The two advisory warnings

Neither fails the audit and neither is baselined, but one of them is mine:

- `apps/extension/src/content/action-runtime/resolve-target.ts`: **476 lines**,
  past the 400 advisory. It was 403 at `HEAD` and about 452 before I touched it;
  my share is roughly 27 lines, and the policy itself lives in `veto.ts`
  precisely to keep it that small.
- `apps/extension/e2e/content/tests/identity-resolution.spec.ts`: **541 lines**.
  It was about 399 before my rows, so **this warning is mine** — the three veto
  rows are 119 lines. Splitting the veto group into its own spec file is the
  right fix and I did not do it: a new `e2e/` spec is not in my Owns, and the
  audit passes. It is a one-file follow-up.

## Not verified

- **No live browser validation of a real replay.** Everything ran in the T2
  content harness (the real content bundle in real Chromium on a Scenario Lab
  fixture) and in probes. No extension, no background worker, no gateway. What a
  Flow sees end to end is not exercised, and the veto sits on the critical path
  of every action.
- **No measurement of the veto's cost in time.** It adds one Core
  `scoreCandidate` call and one `candidateFingerprint` per resolved action —
  cheap by inspection, unmeasured in fact. `candidateFingerprint` reads layout
  (`getBoundingClientRect`), so it is not free.
- **`pnpm check` / `pnpm test` at the repository root were not run.** `domain/`
  and other extension files are mid-edit by parallel workers. The structure
  audit, which root `check` runs first, was run directly and passes.
- **The corpus is one recorded descriptor plus two I built.** The enumeration
  removes the "enough markups" doubt for the identity-drift Save and replaces it
  with "is that descriptor typical", which nothing here answers. The same
  caveat `v-matcher-calibration` recorded, unchanged.
- **The impostors are mine.** I wrote "Delete workspace", "Invite members" and
  the reordered-actions page while trying to break my own gate. An adversarial
  pass by a second reader is worth more than another fixture.
- **The `reworded-aria` row's new expectation depends on an uncommitted Core
  change.** If that is reverted the row fails, and the header says so, but no
  mechanism enforces it.
- **Cross-frame resolution.** Enumeration is single-document by construction, so
  the veto was not exercised against a child frame.

## Open questions or contradictions found

1. **The structural-path selector is a second exposure of the same family, and
   it was not in the brief.** A recorded selector with no id or test id in it is
   positional, and a page that reorders two buttons makes it point at the wrong
   one: measured, Level 1 resolved **Discard** and clicked it. The veto closes
   it, and the same page then recovers the real Save at 0.801 — but the fact
   that it existed unnoticed suggests the resolver's strategies should be
   audited by *what evidence each carries* rather than one at a time.
2. **A recording with no visible text is still exposed.** The measurements are
   above: 0.641 and 0.145, both acted on. The underlying cause is a Core
   asymmetry — a signal the recording lacks is never compared, so a candidate's
   contradicting text is invisible. Whether Core should compare a candidate's
   *extra* signals is a real design question and belongs with whoever owns
   `element-fingerprint.ts`.
3. **The Core change narrowed the safety margin while widening the recovery
   margin.** The worst impostor moved from −0.203 to −0.032. That is the right
   trade for recall and the wrong direction for headroom, and it means the two
   constants are now coupled: nobody should move Core's missing-identifier
   penalty again without rerunning this enumeration. `veto.test.ts` is the
   mechanical guard, and it is the reason that file asserts the separation
   rather than any value.
4. **`identity-drift` still has no rendering where the recorded control is
   *replaced* rather than changed.** Every impostor above is injected by a spec
   or a probe. `v-matcher-calibration` asked for a single-candidate rendering
   for the same reason; a "replaced by a same-class control" mode would give
   both reports a permanent home and remove the DOM mutation from my spec rows.
5. **Level 1's exact-text fallback is still case-sensitive**, as
   `v-matcher-calibration` reported. Unchanged here: `element-finder.ts` is not
   in my Owns, and the veto neither helps nor hurts it — a case-variant miss
   falls through to scoring, which is now the safer path anyway.
6. **A successful resolution still carries no `resolution`.** So a Flow never
   sees the score behind a resolution that *was* acted on, including one the
   veto allowed. Both prior reports raise it; the updated `reworded-aria` row
   now asserts `reply.resolution` is `undefined` on success, which at least
   makes the gap fail loudly when somebody closes it.
