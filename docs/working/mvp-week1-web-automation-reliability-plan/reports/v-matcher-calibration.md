# Report: v-matcher-calibration

Worker: `v-matcher-calibration`. Wave 3 follow-up — why Level 2 target scoring
cannot succeed, and which of three recalibrations fixes it.

## Outcome

**Done, and the recommendation is option 2 — a Core change. No scoring
behaviour is changed in this repository.**

`TARGET_SCORE_FLOOR` is **0.35 in the tree, unchanged**. I lowered it to `0`
mid-task, measured a case that made me withdraw that, and put it back. The
supervisor asked whether the `0` was landed or provisional: it was neither by
the end — it is **withdrawn**, and [why](#why-i-withdrew-the-floor-change) is
the most load-bearing measurement in this report.

- **The brief's option 1 names the wrong knob.** `elementTargetMinimumConfidence`
  is Core's, and it **never runs for web automation** — nothing populates
  `target.candidates`, so Core returns `unresolved_no_candidates` and the gate
  is inert. The value that refuses the 0.218 case is `TARGET_SCORE_FLOOR` in
  `content/identity/score.ts`. See [The two floors](#the-two-floors-and-only-one-of-them-runs).
- **The brief's option 2 premise is half true.** Core already charges a missing
  identifier less than a contradicted one — −0.55 against −0.8. The defect is
  not that they are alike; it is that **−0.55 on the two heaviest weights in
  the table is the largest single penalty in it**, and it is charged for a page
  merely no longer emitting an id.
- **Option 3 is disqualified by measurement, not by taste.** Normalizing over
  answerable weight scores a nameless `<button></button>` at **1.000** — the
  same as a perfect match — and the resolver clicks it. Today it refuses.
  [The measurement](#option-3-is-disqualified).
- **Option 1 is disqualified too, and this is the finding I did not expect.**
  A floor low enough to admit the 0.218 drift case also admits a *single
  unopposed* "Save changes and exit" at **0.088** — a different action, on a
  page where it is the only candidate and the margin therefore protects
  nothing. The two are 0.130 apart. Any floor separating them is fitted to a
  hair.
- **Option 2 separates those same two cases by 0.301, with the floor left at
  0.35.** The drift case's identifiers are *absent*; the near-miss's are
  *contradicted*. That is exactly the axis option 2 amplifies, which is why it
  works and the floor does not. [The comparison](#the-three-options-measured).
- **Recommendation:** in Core, change `compareExactSignal`'s missing branch from
  `-0.55` to **`-0.1`**, justified by Core's own table rather than by fit.
  [Recommendation](#recommendation).

Two side findings, both fixed here: the not-found refusal now reports the
scores it weighed, and `candidateLabel` no longer puts a container's rendered
text on a failure record (the supervisor's mid-task addition).

## The two floors, and only one of them runs

The brief calls the floor "a downstream policy value,
`elementTargetMinimumConfidence`". There are two independent gates and that is
the other one.

| | `TARGET_SCORE_FLOOR` | `elementTargetMinimumConfidence` |
| --- | --- | --- |
| Where | `apps/extension/src/content/identity/score.ts` | Core `automation-studio/runtime/io-policy.ts:290` |
| Compares | Core's `normalizedScore` | Core's `confidence` |
| Value | 0.35 | by `safety.level`: 0.9 / 0.82 / **0.68** / 0.45 |
| Runs when | every Level 1 strategy missed, or one tied | `parameters.target.candidates` is non-empty |
| **Runs today?** | **yes** | **no** |

`resolveElementTarget` returns `{ ok: true, status: "unresolved_no_candidates" }`
when `target.candidates` is empty, and nothing populates it —
`domain/src/output-nodes/targets.ts:41` says so in a comment
("every dispatch today"), Core's `normalizeAutomationStudioElementTarget` only
copies candidates the caller supplied, and no producer in either repository
supplies any. So the Core gate never fires and no downstream override in
`domain/src/io/manifest-definitions.ts` was needed or made.

Worth flagging forward: `web.dom.click` is `review` safety, so **if** that path
ever activated it would demand **0.68 confidence**. Level 2's measured ceiling
is 0.270 normalized, 0.254 confidence. The two gates disagree by a factor of
nearly three about the same action, and whichever option is taken should close
that gap rather than leave it latent.

## Method, and the cross-check that it is faithful

Every number is Core's own, produced two ways.

1. **In real Chromium.** `content/identity/{candidates,score,reportable-text}.ts`,
   `content/describe-element.ts`, `content/element-finder.ts` and
   `content/action-runtime/resolve-target.ts` bundled by esbuild with the
   extension build's own `browserSafeWorkspacePlugin` aliases, loaded into
   Chromium (`channel: "chromium"`, 1280×720 — the headless shell crashes on
   this machine, as `playwright.content.config.ts` records), against the real
   `identity-drift` and `ambiguous-targets` pages rendered by
   `apps/scenario-lab/dist`. The recorded descriptor is read off the baseline
   page with `describeElement`, and `resolveTargetWithDiagnostics` is called
   directly so the reported Level 1 / Level 2 outcome is the resolver's own.
2. **In Node, over Core's compiled matcher**, for the enumerations.

**The cross-check.** The probe reproduces every number `v-drift-fixture`
published, to three decimals: baseline 1.000, `selector-only` 0.149,
`text-only` 0.170, `moved` 0.686, `wrapped-aria` 0.694, `reworded-aria` 0.218 at
confidence 0.205, Discard −0.360, the source report's own proposal −0.064, the
0.270 ceiling, and the Discard case's inverted −0.360 / −0.375. Two rows differ
and both are markup differences rather than method: my `M05` reads 0.239 where
that report has 0.233, and my `M09` reads 0.132 where it has 0.394 — `M09` is
resolved by Level 1's selector either way, so nothing turns on it.

**How the options are computed.** Not by patching Core. Core returns every
per-signal contribution with its `signalPath`, `weight`, `score` and `reason`,
and `normalizedScore` is their sum over their total weight. Option 2 rewrites
one contribution's score; option 3 removes contributions from both sides of the
fraction. Recomputing the *unmodified* case this way reproduces Core's own
`normalizedScore` exactly for all 40 candidates measured, which is what makes
the option arithmetic trustworthy rather than a second scorer.

## The baseline, reproduced

Recorded descriptor: `visibleText`/`accessibleName` "Save changes", `id`
"save-settings", `testId` "save-changes", `tagName` "button", `role` "button"
(implied), `selector` "#save-settings", `classNames` ["btn","btn-primary"].
Comparable weight 138, plus 4 for a visible candidate = 142.

| Rendering | Resolved by | Save | Discard |
| --- | --- | --- | --- |
| `baseline` | L1 selector | 1.000 | −0.360 |
| `selector-only` | L1 fingerprint text | 0.149 | −0.360 |
| `text-only` | L1 selector | 0.170 | −0.360 |
| `moved` | L1 selector | 0.686 | −0.360 |
| `wrapped-aria` | L1 selector | 0.694 | −0.360 |
| `reworded-aria` | **refused** | **0.218** (conf 0.205) | −0.360 |

**The floor was fitted to a distribution it never sees.** 0.35 was placed "in
the gap between 0.170 and 0.694". Both endpoints belong to renderings that keep
`id="save-settings"`, so Level 1's selector resolves them and this floor is
never consulted on either. That is the calibration defect, and it is why no
amount of fixture work was going to make the old value reachable.

### Proven unreachable, over 9,720 profiles rather than eleven markups

Core's scorer is pure, so I enumerated every combination of per-signal outcomes
a candidate can present against this recorded descriptor — each signal matching,
containing, partially overlapping, weakly overlapping, contradicting or absent,
with the intermediate rungs chosen so Core's own `textSimilarity` lands on
0.82, 0.667 and 0.333 — and scored all 46,656 with Core's own function. Then I
kept only the 9,720 that can actually **reach** Level 2, which means not
matching the recorded id, test id, full class set, selector or exact text,
because Level 1 resolves each of those first.

| Over the Level-2-reachable subspace | |
| --- | --- |
| highest score reachable at all | **0.233** (0.270 measured on a real page) |
| profiles clearing **0.35** | **0** |
| profiles clearing 0 | 1,241 |
| …of those, with a text signal agreeing at Core's 0.82 rung or better | 1,118 |
| …without | 123, topping out at **0.151** |
| highest with **both identifiers contradicted** and no name agreement | **0.056** |

So the old floor is not merely unreached on one fixture — **nothing that can
reach Level 2 against this descriptor can clear it**, and that is now an
exhaustive statement rather than an inductive one.

## The three options, measured

Against the full markup table and against the wrong-click cases. `α` is the
similarity Core would charge for a stable identifier the candidate is
**missing**, in place of today's −0.55.

| Case (what it is) | today | α=−0.3 | α=−0.2 | α=−0.1 | α=0 | option 3 |
| --- | --- | --- | --- | --- | --- | --- |
| **`reworded-aria` — the shipped case, RIGHT** | **0.218** | 0.313 | 0.351 | **0.389** | 0.427 | 0.867 |
| ceiling markup (`SAVE CHANGES`, RIGHT) | 0.270 | 0.365 | 0.403 | 0.441 | 0.479 | 0.966 |
| `moved` / `wrapped-aria` (L1 resolves) | 0.686 / 0.694 | 0.736 / 0.744 | 0.757 / 0.763 | 0.777 / 0.783 | 0.797 / 0.803 | 1.000 |
| `text-only` (L1 resolves) | 0.170 | 0.220 | 0.239 | 0.259 | 0.279 | 0.347 |
| `selector-only` (L1 resolves) | 0.149 | 0.149 | 0.149 | 0.149 | 0.149 | 0.149 |
| case-only re-cased label (RIGHT) | 0.249 | 0.344 | 0.382 | 0.420 | 0.458 | 1.000 |
| **Discard, the wrong-click case** | **−0.360** | −0.360 | −0.360 | −0.360 | −0.360 | **−0.360** |
| the drifted Save beneath it | −0.375 | −0.375 | −0.375 | −0.375 | −0.375 | −0.375 |
| **"Save changes and exit", alone, WRONG** | **0.088** | 0.088 | 0.088 | **0.088** | 0.088 | 0.088 |
| same-class "Delete workspace", WRONG | −0.237 | −0.142 | −0.104 | −0.065 | −0.027 | −0.005 |
| nameless icon button, WRONG | −0.242 | −0.146 | −0.108 | −0.070 | −0.032 | **1.000** |
| nameless button with a class, WRONG | −0.242 | −0.146 | −0.108 | −0.070 | −0.032 | **0.788** |
| `ambiguous-targets` recorded twin / other | 1.000 / 0.382 | unchanged | unchanged | unchanged | unchanged | 1.000 / 0.382 |
| `ambiguous-targets` identical twins | 1.000 / 1.000 | unchanged | unchanged | unchanged | unchanged | unchanged |

**Level 1 resolves exactly what it resolves today under every option.** Nothing
in any of the three touches Level 1; the resolver column was identical across
every run. The `ambiguous-targets` tie-break — Level 2's one proven win — is
also untouched by every option, because both Continue buttons answer every
question and only one answer differs. Neither option 2 nor option 3 moves a
candidate whose losses are contradictions.

### Option 3 is disqualified

Scoring only across signals both sides carry inverts the scale: **the less a
candidate can answer, the higher it scores.** A bare `<button></button>` is
asked only about its tag, its role and its visibility, agrees on all three, and
scores **1.000**.

| Page | today | option 3 |
| --- | --- | --- |
| recorded control gone, one nameless icon button left | −0.242 → **refused** | **1.000 → resolved, clicks it** |
| same, with an unrelated class | −0.242 → refused | 0.788 → resolved, clicks it |
| drifted Save (0.867) *beside* a nameless button (1.000) | refused | the nameless one outranks the real one |

No floor can fix that, because the score is 1.000. It is a strictly worse
failure than the one the floor exists to prevent, and it is unbounded rather
than fixture-specific. Disqualified.

A narrow variant — remove only the *absent stable identifiers* from both sides
of the fraction — does not invert (`reworded-aria` 0.690, nameless button
−0.052) and behaves like a stronger option 2. It is still a Core formula
change, and it drives `moved`/`wrapped-aria` to exactly 1.000, erasing the
difference between "everything matched" and "everything I was able to ask
matched" — which is the distinction `confidence` is supposed to carry. Not
recommended, but it is the fallback if −0.1 turns out too weak.

### Why I withdrew the floor change

A floor of 0 looks right on the corpus above: it admits 0.218, and the highest
wrong candidate anywhere is −0.237, so the separating band is (−0.237, 0.218]
and zero is within 0.01 of its centre. It survives the Discard case with 0.360
to spare. I implemented it.

Then I measured the supervisor's fourth question — **a page whose family has
exactly one member left, where there is no runner-up and the margin protects
nothing.** Real Chromium, the identity-drift page with Discard removed:

| The only candidate on the page | score | at floor 0.35 | at floor 0 |
| --- | --- | --- | --- |
| the `reworded-aria` Save (RIGHT) | 0.218 | refused | resolved ✓ |
| **"Save changes and exit" (WRONG action)** | **0.088** | refused ✓ | **resolved — clicks it** |
| "Save changes" on a Publish button, ids contradicted | −0.113 | refused | refused |
| "Save all workspaces", no ids | −0.275 | refused | refused |
| "Delete workspace", ids contradicted | −0.375 | refused | refused |
| nameless icon button | −0.242 | refused | refused |
| Discard alone | −0.360 | refused | refused |

`<button id="exit-btn" data-testid="save-and-exit">Save changes and exit</button>`
scores 0.088 because its label *contains* the recorded label (Core's 0.82 rung,
twice) while both stable identifiers contradict. It is a plausible redesign and
a different action — the Flow asked to save, not to save and leave. At a floor
of 0 it is the only candidate, so it wins by default at confidence 0.083.

That is the supervisor's "weak positive winning by default", and it is real.
0.218 and 0.088 are **0.130** apart; a floor placed between them has at most
0.065 of headroom either side, calibrated against one synthetic markup. That is
the tuned-until-it-passes outcome the brief warned against, so I reverted to
0.35 and stopped.

### Answers to the four questions, directly

1. **The Discard case at a floor of 0, measured not reasoned:** `REFUSED
   web.target.not_found`, best −0.360 (Discard), runner-up −0.375 (the drifted
   Save), `saveCount: 0`, `discardCount: 0`. Correct at that floor, and the
   reasoning was right — it just is not the binding case.
2. **What a floor of 0 admits beyond the case wanted:** on the measured corpus,
   six candidates in [0, 0.35) and every one of them the right control — except
   the single-candidate near-miss above at 0.088, which is not. Over the
   exhaustive enumeration, 1,241 Level-2-reachable profiles clear 0; 1,118 have
   a text signal agreeing at 0.82 or better, and the 123 that do not top out at
   0.151 and all require *both* identifiers to be **absent** plus a two-thirds
   word overlap on both text signals. A candidate with both identifiers
   **contradicted** and no name agreement cannot exceed **0.056**. So a strong
   negative cannot win at a floor of 0; a weak positive can, and does.
3. **Should the margin rise if the floor falls?** On this evidence, no — and
   the question stops mattering under the recommendation. Every correct winner
   measured leads its runner-up by ≥ 0.455 (`reworded-aria` by 0.578,
   `ambiguous-targets` by 0.618), so 0.20 is nowhere near binding, and raising
   it would only convert resolutions into refusals. Lowering the floor does not
   change any lead — both sides move together — it just removes the filter, so
   the margin inherits work it was not calibrated for. Under option 2 the
   opposite happens: winners rise, contradicted losers do not, and leads widen.
   The margin should stay at 0.20 and be re-examined only against a real
   corpus.
4. **Can a single candidate resolve with no margin protection?** Yes —
   `runnerUp` is `ranked[1]`, and when it is absent the margin check is skipped
   entirely. That path is measured in the table above. It is the reason option 1
   fails and option 2 does not: at 0.35 with α=−0.1 the lone right control
   scores 0.389 and resolves, the lone wrong one stays at 0.088 and is refused,
   **without** the margin being involved at all.

## Recommendation

**Change Core's `compareExactSignal` missing branch from `-0.55` to `-0.1`.
Leave `TARGET_SCORE_FLOOR` at 0.35 and `TARGET_SCORE_MARGIN` at 0.20.**

```ts
// packages/fluxiq/src/programs/automation-studio/fingerprinting/element-fingerprint.ts
function compareExactSignal(signalPath, expected, actual, contribute) {
  if (!hasText(expected)) return;
  if (!hasText(actual)) { contribute(signalPath, -0.1, "candidate is missing stable identifier"); return; }
  contribute(signalPath, normalizeCase(expected) === normalizeCase(actual) ? 1 : -0.8, "stable identifier comparison", { expected, actual });
}
```

**Why this and not the floor.** The two cases the calibration has to separate
differ in exactly one way: `reworded-aria`'s identifiers are **absent** and
"Save changes and exit"'s are **contradicted**. A floor cannot see that
difference — it sees 0.218 and 0.088, 0.130 apart. Option 2 is the only one of
the three that reads that axis, and it widens the gap to **0.301** (0.389
against 0.088), with the existing floor sitting inside it. It is not a better
number; it is the mechanism that matches the distinction.

**Why −0.1 rather than a fitted value.** It comes from Core's own table, not
from this corpus. Every other comparator charges absence far less than
`compareExactSignal` does — classNames −0.1, bounds/url −0.15, attributes −0.2,
role/tagName/paths −0.25, text −0.45 — and −0.55 sits on the two heaviest
weights in the whole table (26 and 28), making a missing id cost −14.3 where a
missing accessible name costs −10.8. That is backwards: a name is far more
indicative of identity to a person than an id a design system stopped emitting.
Setting it to −0.1 says **a stable identifier the candidate does not carry is
charged like a class list it does not carry — nearly nothing — because in both
cases the page simply stopped emitting something, which says nothing about
which control this is.** A *contradicted* identifier stays at −0.8, untouched:
that is the page actively saying "different control".

−0.1 also stays negative, which matters: at exactly 0 the contribution would
move into `positiveContributions` and drop out of `failedSignals`, and Core's
`io-policy` diagnostics report `failedSignals`. A candidate with no id should
still be *reported* as failing that signal even when it is barely charged for
it.

**What it costs, measured.** With the floor at 0.35 and α = −0.1:

| | score | outcome |
| --- | --- | --- |
| `reworded-aria`, the case D1 needs | 0.389 | **resolved** (0.039 over) |
| "Save changes and exit", single candidate | 0.088 | refused (0.262 under) |
| Discard wrong-click case | −0.360 | refused |
| nameless icon button | −0.070 | refused |
| same-class "Delete workspace" | −0.065 | refused |
| `ambiguous-targets` tie-break | 1.000 / 0.382 | resolved, unchanged |
| identical twins | 1.000 / 1.000 | ambiguous, unchanged |

The tight side is 0.039 of headroom on the admitted case. α = 0 would give
0.077 at the cost of the `failedSignals` regression above; if the supervisor
prefers the headroom to the diagnostic, that is the trade, and it is one
constant either way.

### Blast radius — this is a Core change and it moves every consumer

Two call sites inside Core, and everything they reach:

1. **`runtime/io-policy.ts`** — `resolveElementTarget`, the
   `elementTargetMinimumConfidence` gate. Inert for web automation (no
   candidates), **live for any domain that supplies candidates**. Effect: a
   candidate missing an identifier scores and therefore *confides* higher, so
   more resolutions pass the gate. That is the intended direction but it
   **loosens a safety gate for domains this work has not measured**, and it is
   the part of the recommendation I am least able to vouch for.
2. **`runtime/native-node-runtime.ts`** — hands `elementMatcher` to every
   importer-SDK node implementation, recording mapper and target resolver a
   domain package registers (`nodes/importer-sdk.ts:73,78,79`;
   `runtime/service.ts:2412`). Any of those calling `bestCandidate` sees the
   same shift. I found no in-repository consumer beyond the tests, but the SDK
   is a published seam.

Plus this repository, through `fluxiq/automation-studio/fingerprinting`.

**Core's own tests survive**, computed from Core's real contributions rather
than by patching Core:

| Core test | α −0.55 | −0.3 | −0.2 | −0.1 | 0 |
| --- | --- | --- | --- | --- | --- |
| "prefers strong element identity over structural path alone" — asserts `stable-button` wins with confidence > 0.8 | best 0.940 / conf 0.884, runner-up −0.270 | −0.164 | −0.121 | **−0.079** | −0.036 |
| verdict | passes | passes | passes | **passes** | passes |

The winner is unaffected (it is missing no identifier); only the losing
`path-only` candidate rises, and never past −0.036. The third test compares
`label`, `role` and `selector` and no stable identifier at all, so it cannot
move. The second builds candidates from a state snapshot and does not score.

### What I would need to be confident this is safe

Plainly: **more than two fixtures.** Everything above rests on `identity-drift`,
`ambiguous-targets`, and markups I wrote myself to attack the thing I was
recommending. The enumeration removes the "did you try enough markups" doubt
for *this* recorded descriptor, and replaces it with "is this descriptor
typical".

1. **A corpus of real recorded targets**, not synthetic ones — twenty or thirty
   descriptors captured from real sites, replayed against the same sites after
   a redesign, or against a mutation harness. The single number that decides
   between −0.1 and −0.2 is the distribution of *absent* versus *contradicted*
   identifiers in real drift, and nothing here measures it.
2. **The wrong-click cases named by someone other than me.** I invented "Save
   changes and exit" and it changed the recommendation. There will be others I
   did not think of; an adversarial pass by a second reader is worth more than
   another fixture.
3. **A Core-side answer on the other consumers** — whether any shipped or
   planned domain package resolves element targets through the SDK seam, and
   whether loosening `elementTargetMinimumConfidence`'s effective strictness is
   acceptable for those.
4. **The single-candidate path exercised end to end in a Flow**, not in the
   content harness. It is the path a real drifted page most often presents and
   the one with no margin protection.
5. **A permanent regression row** for whichever option lands, on both sides:
   the drift case resolving and the near-miss refusing. The replacement text for
   the first is below; the second needs a fixture with a lone same-family
   control, which no scenario currently has.

## The two side findings from the brief

### Level 1's exact-text fallback is case-sensitive — a real defect, low harm

`element-finder.ts:66` and `resolve-target.ts`'s `normalizeText` both collapse
whitespace and trim; Core's `normalizeText` also lowercases. Measured, two
pages identical but for the case of one label:

| Markup | Level 1 | Level 2 score | Outcome today |
| --- | --- | --- | --- |
| `<button type="submit">Save changes</button>` | **resolves** by exact text | 0.249 | resolved |
| `<button type="submit">SAVE CHANGES</button>` | **misses** | 0.249 | **refused** |

Nothing but letter case decides those. It is a defect, and it is the only
reason the 0.270 ceiling row reaches Level 2 at all.

**I did not fix it**, for two reasons beyond ownership (`element-finder.ts` is
not in my Owns). It is not free: `findClosestFingerprint` returns the *first*
text match, so case-insensitivity changes which control Level 1 picks on a page
with case-variant duplicates, and it is the last strategy before scoring, where
a wrong exact answer is worse than a scored one. And the same rule is
implemented twice — `element-finder.ts` returns one element, `resolve-target.ts`
collects all of them for the ambiguity count — so a fix has to move both or
they diverge. The one-line change in each is `.toLowerCase()` inside
`normalizeText`; whoever takes it should take both and add a case-variant
duplicate row.

Under the recommendation the harm drops: the re-cased page scores 0.249 → 0.420
at α=−0.1 and Level 2 recovers it, so the defect costs a strategy rather than a
run.

### A refusal now reports the scores it weighed — fixed

`notFound` in `resolve-target.ts` carried only `candidateCount`, so a 0.218
near-miss and a −0.36 hopeless page were the same string to a Flow. It now
carries `bestScore`, `runnerUpScore` and `confidence` when scoring ran — the
same three `scoredAmbiguous` beside it already reported — and appends
`; best scored -0.36` to the record's `actual`, which is the half a person
debugging reads. The `TARGET_NOT_FOUND` message is byte-identical, the code and
category are unchanged, and `results.ts` lifts the extra fields without change
because `WebAutomationTargetResolution` already declares all three as optional.
Verified: `resolution: { strategy: "fingerprint", candidateCount: 2,
bestScore: -0.242, ... }` on the probe's refusals; the four `toMatchObject`
assertions on that shape still pass.

This is an ownership widening — `resolve-target.ts` is not in my Owns, the
brief said "you may fix it if your investigation leaves time", and I took that
as authority for this one object literal. **I did not do a whole-file write**,
per the supervisor's coordination note, and the other worker's `action.element`
change is untouched and intact.

## The supervisor's addition: `candidateLabel` was putting page text on the wire

`candidateLabel` quoted `boundedText(element.textContent, 40)` for every
candidate, and that string becomes a `TARGET_AMBIGUOUS` record's `actual`,
which travels to the gateway with no element descriptor beside it for the
domain guard to judge.

**The judgement asked for, and what I chose.** The supervisor offered two
policies: withhold when the element or a descendant is sensitive by the
canonical rule, or withhold whenever the candidate is a container. **I chose the
container test as the primary rule, with the sensitivity rule as a second
conjunct** — and the reason is that **the sensitivity rule alone closes almost
none of the risk the supervisor described.** `isSensitiveFieldSignature` reads
`type`, `autocomplete` and `data-sensitive`. The named leaks — an address, an
order total, a rendered card number inside a wrapper — are *rendered page text*,
not form-control values. A card number printed into a `<div role="button">`
matches no autocomplete token and is not an input, so a signature test passes it
straight through. The discriminating question is structural: **is this text a
label, or is it a document?**

`content/identity/reportable-text.ts` (new) answers it with three conjuncts, all
of which must hold:

1. **The element is named from its own content** — `button`, `a`, `summary`,
   `label`, `option`, `legend`, `caption`, or a declared role of
   button/link/menuitem/tab/option/checkbox/radio/switch/treeitem. This is the
   conjunct that catches flat containers a descendant test cannot see, such as
   `<li tabindex="0">Order 1042 - 123 Elm Street - $421.90</li>`.
2. **It contains only phrasing descendants** — the inline vocabulary plus
   `img`/`svg` and everything under an `svg`. This is the conjunct that catches
   `<a href><h3>…</h3><p>…</p></a>`, the product-card link, which conjunct 1
   passes. `<button><span class="icon">…</span><span>Save</span></button>`
   still keeps its label.
3. **Neither it nor any descendant is sensitive** by `isSensitiveFormControl`
   → `isSensitiveFieldSignature` in `domain/src/sensitivity/`. The one rule, not
   a second one. It earns its place for `data-sensitive`, which is the page
   author saying "not this" on a control that is otherwise a plain label.

Measured in real Chromium, what a failure record would now say:

| Candidate | `textContent` | label emitted |
| --- | --- | --- |
| `<button data-testid="save-changes">Save changes</button>` | "Save changes" | `button[data-testid="save-changes"] "Save changes"` |
| `<button><span class=icon><svg…></span><span>Save changes</span></button>` | "Save changes" | `button#save2 "Save changes"` |
| `<a href id=next>Continue to payment</a>` | "Continue to payment" | `a#next "Continue to payment"` |
| `<div role=button>Apply</div>` | "Apply" | `div#apply "Apply"` |
| `<a href><h3>Order 1042</h3><p>123 Elm Street…</p></a>` | "Order 1042123 Elm Street, SpringfieldTot" | **`a#order-1`** |
| `<div role=button><span>Visa</span><div>4242 4242 4242 4242</div>…</div>` | "Visa4242 4242 4242 424209/29" | **`div#card-1`** |
| `<li tabindex=0>Order 1042 - 123 Elm Street - $421.90</li>` | "Order 1042 - 123 Elm Street - $421.90" | **`li#row-1`** |
| `<textarea>123 Elm Street, Springfield</textarea>` | "123 Elm Street, Springfield" | **`textarea[data-testid="addr"]`** |
| `<div contenteditable>Card 4242 4242 4242 4242 expires 09/29</div>` | the note | **`div#note`** |
| `<label><span>Card number</span><input autocomplete=cc-number></label>` | "Card number" | **`label#cc`** |
| `<button data-sensitive=true>4242 4242 4242 4242</button>` | the number | **`button#reveal`** |

Every leak closed; every legitimate label kept; the tag and the identifier
always present, so two candidates remain distinguishable in a report. The
`<textarea>` row is a leak nobody had named — `textContent` on a textarea is
its default value.

**Cost:** `label#cc` loses "Card number", a legitimate diagnostic. That is the
bluntness the supervisor priced, and I took the trade as instructed.

**Not leaked elsewhere, checked:** `candidateFingerprint` still puts
`boundedText(textContent, 200)` in the fingerprint it hands Core, but that
`ElementFingerprintCandidate` never leaves the page — `scoredTarget` returns
only numbers, `ambiguous`/`scoredAmbiguous` build their strings from
`candidateLabel`, and `CandidateSelection` does not escape `resolve-target.ts`.

## What changed

| File | Change |
| --- | --- |
| `apps/extension/src/content/identity/score.ts` | **Comment only — `TARGET_SCORE_FLOOR` is still 0.35.** The doc comment now records that the value is unreachable, that lowering it is not the fix, and what is. |
| `apps/extension/src/content/identity/reportable-text.ts` | **New.** The one rule about whether an element's text may be quoted in a failure report. |
| `apps/extension/src/content/identity/candidates.ts` | `candidateLabel` takes its text from `reportableText`; the 40-character bound is named. |
| `apps/extension/src/content/identity/index.ts` | Exports `reportableText`; barrel comment says what it is for. |
| `apps/extension/src/content/action-runtime/resolve-target.ts` | `notFound` carries `bestScore`, `runnerUpScore`, `confidence` and names the best score in the record's `actual`. ~18 lines; **not** a whole-file write. |

Not touched: `domain/src/io/manifest-definitions.ts` (not the right knob — see
[The two floors](#the-two-floors-and-only-one-of-them-runs)),
`apps/scenario-lab/src/scenarios/identity-drift/`,
`apps/extension/e2e/content/tests/identity-resolution.spec.ts`,
`packages/test-runner/`, `domain/src/runtime/`. **Nothing in Core was edited.**

### Replacement text for the `reworded-aria` spec row — only if the floor moves

Not needed for the recommendation: with the floor at 0.35 the existing row
passes unchanged, and it passes under option 2 too only if the floor is raised
above 0.389, which is not proposed. **Under option 2 that row starts failing**,
because `reworded-aria` resolves. This replacement is written for that, and it
was **verified to pass** — as a temporary spec file, run once, then deleted (the
tree is clean; `git status apps/extension/e2e/` shows only other workers'
files). It is written against a floor of 0 / option 2, whichever lands.

The verified text is saved at
`…/scratchpad/vmc/replacement-row.spec.ts`; inline, the body that replaces
lines 327–356 of `identity-resolution.spec.ts`:

```ts
  test("reworded-aria: the surviving accessible name resolves the right control, and Discard is not touched", async ({ openHarness, page }) => {
    const harness = await openHarness("identity-drift");
    const recorded = await describe(harness, SAVE_BASELINE);
    const displayName = await page.locator(DISPLAY_NAME).inputValue();
    await armMode(harness, "reworded-aria");

    // One redesign took every signal Level 1 looks a target up by -- id, test
    // id, class names, exact text -- and left the accessible name standing.
    await expect(page.locator("#save-settings")).toHaveCount(0);
    await expect(page.locator('[data-testid="save-changes"]')).toHaveCount(0);
    await expect(page.locator("button.btn.btn-primary")).toHaveCount(0);
    await expect(page.getByRole("button", { name: "Save changes", exact: true })).toHaveText("Save");

    const reply = await harness.runAction({
      commandId: "replay-save:reworded-aria",
      actionType: "web.dom.click",
      ...(recorded.selector ? { selector: recorded.selector } : {}),
      options: recordedElement(recorded)
    });

    // Level 1 has nothing left to look the control up by, so Level 2 decides,
    // and it ranks the right control 0.578 clear of Discard.
    expect(reply.status, reply.message).toBe("succeeded");
    // The scores are not asserted because a *successful* resolution still
    // carries no `resolution` -- `resolveTarget` hands the verbs an Element and
    // nothing else -- so they reach a Flow only on the failure path.
    expect(reply.resolution).toBeUndefined();
    expect(reply.element).toMatchObject({ tagName: "button", accessibleName: "Save changes", visibleText: "Save" });
    await expect
      .poll(async () => (await harness.finalState()).state)
      .toMatchObject({ savedInMode: "reworded-aria", savedDisplayName: displayName, saveCount: 1, discardCount: 0 });
  });
```

The file header at lines 53–56 would also need its last sentence replaced; it
currently says the floor refuses this rendering.

**A finding fell out of writing it.** My first draft asserted
`reply.resolution` and it came back `undefined` on a *successful* action. That
confirms, measured rather than read, the open item both prior reports carry:
`resolveTarget` is typed to return an `Element`, so `bestScore`,
`runnerUpScore` and `confidence` reach a Flow **only when the resolution
fails**. Every scored success is invisible. Whichever option lands, D1's
promise that "the extension returns structured resolution diagnostics … in
every action result" is still unmet on the success path.

## Commands run and observed results

`EXTENSION_TEST_BUILD_LABEL=v-matcher-calibration` was set for every extension
command. No `pnpm lab`, no `pnpm build`, no `pnpm structure:baseline`, no Core
command — nothing in Core was changed. Exit status was captured by redirecting
to a file and echoing `$?`, never through a pipe.

| Command | Exit | Observed |
| --- | --- | --- |
| `pnpm --filter …/extension check` | **0** | Clean, run after the identity changes. A later run exits **2** on `domain/src/recording/web-state/evidence/read.ts(52,18): Cannot find name 'record'` and two `llm-evidence/sanitize.ts` errors — another worker mid-edit; reran once and it reproduced with *more* errors, and **no error names a file under `apps/extension`**. |
| `pnpm --filter …/extension test` | **0** | `# tests 225 / # pass 225 / # fail 0`. A later run is **1** with `222/3`; all three failures are `recording-evidence-pipeline` throwing `ReferenceError: record is not defined` from the same in-flight domain file. Reran once; reproduced. All six `identity/tests/score.test.ts` cases pass in both runs (subtests 136–141), including the two that assert against the floor. |
| `playwright … identity-resolution.spec.ts --workers=4` | **0** | `17 passed (4.3s)` — final run, floor restored. Earlier runs showed 5 failures: four were `toEqual({ selected: … })` against an `ambiguous-targets` state that another worker had just given a `mode` field, and one was the `reworded-aria` row while my floor change was in the tree. Both causes are gone. |
| `playwright … resolve-target + failures + redaction + identity.spec.ts --workers=4` | **1** | `44 passed, 1 failed`. The failure is `redaction.spec.ts:310 › the domain withholds a sensitive control's comparison without being told the producer did` — a raw PAN in a `web.dom.type` **validation** record's `expected`/`actual`. Reran once (`12 passed, 1 failed`); reproduced. It is `v-validation-leak`'s open item, in no file I touched, and no part of it comes from `candidateLabel`. |
| Full content harness, `--workers=4` (before the floor was reverted) | **1** | `183 passed, 6 failed`: the five above plus `scroll.spec.ts › untilStable`. Reran `scroll.spec.ts` alone and a **different** test in that file failed (`7 passed, 1 failed`), so it is load on `infinite-feed`, not a regression. |
| `node scripts/structure-audit.mjs` with a scratch `GIT_INDEX_FILE` (a copy of `.git/index` with `reportable-text.ts` staged; the real index was never written) | **0** | `structure-audit: passed (30 warning(s), 19 baselined)`. One warning names a file I touched: `resolve-target.ts: 452 lines`, past the 400 advisory. It was **403 at HEAD**, so it was already over before this session; of the 49 lines added since, about 18 are mine. `content/identity/` does not trip the directory-files threshold at 9 files. |
| Scoring probe, 18 renderings × the real fixture, real Chromium | **0** | The baseline and options tables. Reproduces `v-drift-fixture` to three decimals. |
| Single-candidate probe, 9 pages with the pool reduced to one, real Chromium | **0** | The no-runner-up table. The 0.088 finding. |
| Label probe, 12 markups, real Chromium | **0** | The `candidateLabel` table. |
| Exhaustive enumeration, 46,656 profiles through Core's compiled `scoreElementFingerprintCandidate` | **0** | 9,720 reach Level 2; **none clears 0.35**; max 0.233. |
| Core-impact computation over Core's own test cases | **0** | `stable-button` wins at 0.940 / conf 0.884 at every α; runner-up never exceeds −0.036. |
| Temporary spec `zz-v-matcher-calibration-tmp.spec.ts`, run then deleted | **0** | `1 passed (2.0s)` — the replacement row above. `git status apps/extension/e2e/` clean of it afterwards. |

## Not verified

- **No live browser validation of a real replay.** Everything ran in the content
  harness and in probes: real content bundle, real Chromium, real fixtures, but
  no extension, no background worker, no gateway. What a Flow sees end to end
  was not exercised.
- **Option 2 was not applied to Core and Core's gates were not run.** Its
  effects are computed from Core's own contributions and its test impact from
  Core's own test inputs, both exactly, but `pnpm -r test` in Core was not run
  because nothing in Core was changed. Before landing it, Core needs
  `pnpm -r check`, `pnpm -r test -- --no-file-parallelism`, `pnpm package:lint`
  and `pnpm build`.
- **`reportable-text.ts` has no permanent test.** It needs a DOM, and the
  extension's unit runner has none (`scripts/test-extension.mjs` runs bundles
  under Node). It is verified by the twelve-markup probe in real Chromium, which
  is real verification but not a regression guard. A row belongs in the content
  harness, and both `e2e/` and a fixture with a container candidate are outside
  my Owns. **This is the most important gap in this report** — a leak guard with
  no test is a leak waiting to come back.
- **The `actual` string of a `TARGET_NOT_FOUND` record changed** (a `; best
  scored -0.36` suffix). Nothing asserts it — grepped across `apps`, `domain`
  and `packages` — but it is wire-visible text and a Flow's classifier could in
  principle read it. The `code` and `category` are unchanged.
- **The corpus is still two fixtures plus markups I wrote.** The enumeration
  removes the "enough markups" doubt for this one recorded descriptor and
  replaces it with "is this descriptor typical", which nothing here answers.
- **The near-miss that decided the recommendation is synthetic.** "Save changes
  and exit" is plausible, but I invented it while trying to break my own change.
  It has not been seen on a real page.
- **`pnpm check` / `pnpm test` at the repository root were not run** as single
  commands; `domain/src` is mid-edit by another worker and both would fail on
  their work. The audit, which is the first thing `pnpm check` runs, was run
  directly and passes.
- **Whether any real Core consumer resolves element targets through the
  importer-SDK seam** — I found the seam and its tests, not a shipped consumer.

## Open questions or contradictions found

1. **`elementTargetMinimumConfidence` is inert, and the plan does not say so.**
   D1 and the brief both treat it as the live policy value. It is not reached,
   because nothing supplies `target.candidates`. When it *is* reached it will
   demand 0.68 for a `review` action against a Level 2 ceiling of 0.254
   confidence — the two gates disagree by nearly 3×, and closing that belongs
   with whichever option lands.
2. **Level 1 clicks by class alone, with no score and no floor.** A page whose
   Save button was replaced by `<button class="btn btn-primary">Delete
   workspace</button>` is resolved by Level 1's class-set query and **clicked**,
   measured. Level 2 would have scored it −0.237 and refused. So the resolver
   refuses a 0.218 near-certainty at Level 2 while acting on a class match at
   Level 1. That is a bigger exposure than anything in this calibration, it is
   independent of every option here, and nobody has briefed it.
3. **D1's "structured resolution diagnostics in every action result" is still
   false on the success path**, now confirmed by a passing assertion that
   `reply.resolution` is `undefined` on a successful scored resolution. Both
   prior reports raised it as an open item; this is the first measurement of it.
4. **Should D1 be revisited?** My answer is no, but narrowly. Level 2's
   *enumerate-and-score* half is not unfixable — option 2 makes it work on the
   one case we have — but it will only ever recover targets whose identifiers
   went **absent**, never those whose identifiers were **replaced**. `M03` (the
   right control, new id, no test id, `aria-label` intact) scores 0.256 under
   the recommendation and stays refused. Whether that is acceptable is a product
   question the plan has not asked, and it is the honest limit of this
   mechanism. The *tie-break* half is unaffected and works.
5. **`identity-drift` has no rendering where the family reduces to one
   candidate**, so the no-runner-up path — the one a real drifted page most
   often presents, and the one with no margin protection — has no fixture. It
   is where the decisive measurement in this report came from, and it deserves
   a scenario row.
6. **The margin and the floor were calibrated together and should be
   decoupled.** They answer different questions: the floor asks "is this the
   control?", the margin asks "is it more that control than its neighbour?". No
   measured case is near the margin (every correct winner leads by ≥ 0.455),
   and treating them as one dial is what produced a floor fitted to numbers the
   module never sees.
