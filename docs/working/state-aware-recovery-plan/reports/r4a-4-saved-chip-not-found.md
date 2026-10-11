# R4a attempt 4 (run-mv4912r9-53b05a51): a visible option chip "couldn't be found where it was saved"

Worker report. Investigation only: no source edited. Evidence was copied to the worker scratchpad before it was read
(the run finished while the investigation was under way).

## Outcome

Done. The root cause is proven and reproduced without a provider. The brief's hypothesis is **partly right**. The
selected-state class (`css-1dntdmy`, the fixture's `optionOn`) is in the saved fingerprint and does steer the lookup
onto the currently chosen chip. But the Spain failure in trial 1 had **no** state class in its fingerprint and failed
in exactly the same way, at exactly the same score. The rejection is not in Core's matcher. It is in the page
resolver's Level 1 fingerprint strategy:

1. The saved selector is anchored on a group id the page redraws on every load (`#fbaudnsk`, `#fb104wdzu`), so the
   selector misses.
2. The fingerprint strategy then runs `findClosestFingerprint` with the text stripped. Its class-set query
   (`querySelector`, **first match only**) lands on the first chip carrying the recorded classes. That is always
   **4-in-1**: the first `chipOption` on the page, and on a fresh page also the first chip carrying `optionOn`.
3. Because that query returned something, the exact-text scan (which would find exactly the recorded chip) **never
   runs**.
4. The veto correctly refuses 4-in-1: score 0.07, with nothing exact. Text "4-in-1" contradicts "7-in-1" or "Spain".
5. Level 2 enumerates no candidates. The chips are `<div>`s with an `addEventListener` click handler: no role, no
   tabindex, no `onclick`. `CANDIDATE_SELECTOR` does not admit them, so the result is "0 control(s) of the same
   family", which surfaces as `web.target.not_found`, worded "couldn't find it where it was saved".

## What changed and why

Nothing in source. The only file written is this report. Scratch files: `<scratchpad>/repro/repro.ts`,
`build.cjs`, `out/repro.mjs`, plus copies of the project store and the command attempts under `<scratchpad>/proj` and
`<scratchpad>/runtime`. Here `<scratchpad>` is
`C:/Users/osrs_/AppData/Local/Temp/claude/c--Users-osrs--FluxStuff--FluxIQWebExtension/09cb9cf0-57bf-44bb-9d6a-ecc6dd349357/scratchpad`.

## Evidence

### The fixture's classes and ids, decoded

The seed is 7342 and the build is 24.37.1. Hashes were computed with the fixture's own FNV-1a
(`apps/scenario-lab/src/build-classes.ts`):

| role | class |
| --- | --- |
| `chipOption` (every Specification and Ships From chip) | `css-1354e7d` |
| `optionOn` (the chosen chip, toggled by `client/item-script.ts` `render()`) | `css-1dntdmy` |
| `swatch` (colour swatches) | `css-15cl3ai` |
| `optionOff` | `css-1yjsbss` |

The server markup gives every chip `chipOption` only (`markup/item.ts:58-59`). The client's `render()` adds `optionOn`
to the chosen chip in each group. The groups' ids come from `rotatingId(state, key)` = FNV of
`${seed}:${state.views}:${key}` (`markup/shell.ts:40`), so they change with every page view:

| saved id | decodes to |
| --- | --- |
| `#fbaudnsk` | `sku-spec` at views=0 |
| `#fb1sh8ihu` | `sku-color` at views=0 |
| `#fb8y7yz1` | `qty` at views=0 |
| `#fb104wdzu` | `sku-origin` at views=3 (exploration's page) |
| `#fb1bkuerz` | `sku-color` at views=3 |

`isVolatileIdentifier` judges none of `fbaudnsk`, `fb104wdzu`, `fb1sh8ihu` or `fb1bkuerz` as generated; it does judge
`fb8y7yz1` as generated. That is the shape-rule gap already described in `identity/score.ts`'s header. So
`selectorFor` anchored the selectors on them.

### The exact saved fingerprints of the failing steps

These are the fingerprints as dispatched, read from
`.../t418-r4a-4/fluxiq-root/.fluxiq/artifacts/runtime/command-attempts/*/attempt.json`.

**Trial 1, step s10 "choose shipping from Spain"** (`web.dom.check`). This was the draft before repair; it failed on
attempts 78fdc8b6, e844a4e1, 383cb557 and 82839893.

```json
{ "classNames": ["css-1354e7d"], "context": { "landmark": "main" },
  "selector": "#fb104wdzu > div:nth-of-type(2) > div:nth-of-type(2)", "tagName": "div", "visibleText": "Spain" }
```

**Lab replay, step s9 "choose the 7-in-1 specification"**. This is the saved Flow after repair, as it now sits in
`flows/...main.graph.flow.ts`. It failed on attempts 48c4835b, f59a0ed2, 0f93c1d9 and ca9bb102.

```json
{ "classNames": ["css-1354e7d", "css-1dntdmy"], "context": { "landmark": "main" },
  "selector": "#fbaudnsk > div:nth-of-type(2) > div:nth-of-type(2)", "tagName": "div", "visibleText": "7-in-1" }
```

Both failed with the identical message: `No target resolved from selector #… > div:nth-of-type(2) >
div:nth-of-type(2), element fingerprint (refused div scoring 0.07 with nothing the recording named agreeing exactly),
… in the page's open shadow roots …`. The run record adds `targetResolution.candidateCount: 0` and `actual: "nothing
matched; 0 control(s) of the same family are on the page"`.

For comparison, the saved s8 Space Grey fingerprint is:

```json
{ "accessibleName": "Space Grey", "attributes": { "title": "Space Grey" },
  "classNames": ["css-15cl3ai", "css-1dntdmy"], "selector": "#fb1sh8ihu > div:nth-of-type(2) > div:nth-of-type(1)" }
```

It also carries the state class. It passed in the replay only because Space Grey is the fresh page's default, so the
class query happened to land on it.

### The live chips on a fresh page

This is the replay's own page view (`stateRefs.beforeAction`, s9 attempts 10 and 11):

```text
t83 "Specification:"  t84 "4-in-1"
t86 clickable "4-in-1" marked
t87 clickable "7-in-1"
t88 clickable "10-in-1"
t90 "Ships From:"  t91 "China"
t93 clickable "China" marked
t94 clickable "Spain"
t95 clickable "Poland"
```

Here is what each chip carries in the live DOM, following the markup and `render()`:

| chip | classes | other signals |
| --- | --- | --- |
| 4-in-1 | `css-1354e7d css-1dntdmy` | |
| 7-in-1 | `css-1354e7d` | |
| 10-in-1 | `css-1354e7d` | |
| China | `css-1354e7d css-1dntdmy` | |
| Spain | `css-1354e7d` | |
| Poland | `css-1354e7d` | |
| all chips | | no id, no role, no tabindex, no `onclick` attribute; the handler is bound with `addEventListener` |

The group id is `#fb` plus that load's hash, so none of the saved ids exist. The trial 1 page differs only in having
7-in-1 chosen instead of 4-in-1, because step s9 had just pressed it.

### Why the pass and fail pattern looks inconsistent but is not

| Run and step | Selector anchor | Same page view as capture? | Result |
| --- | --- | --- | --- |
| Trial 1, s9 7-in-1 | structural `main > … > div:nth-of-type(4) > …` | n/a | selector hit, passed |
| Trial 1, s10 Spain | `#fb104wdzu` (views=3) | no; the trial reset meets views=0 | failed as above |
| Trial 2, s8/s9 | `#fb1sh8ihu` / `#fbaudnsk` (views=0, captured by the repair on trial 1's views=0 page) | yes; the trial reset meets views=0 again | selector hit, passed |
| Replay, s9 | `#fbaudnsk` | no; the replay's page is another view | failed as above |

### The code lines that reject the match

All references are to `apps/extension/src/content`, on dev and t418, which are the same commit (1d63b2c8).

- `action-runtime/resolve-target.ts:493-497` (`fingerprintMatches`): `const { visibleText, ...stable } = target;
  … findClosestFingerprint(stable, root) … if (exact.length) return exact;`. One stable answer suppresses the
  accessible-name and exact-text scans that follow it (`:498-505`).
- `element-finder.ts:46-49`: the class-set strategy is `query(root, "div.css-1354e7d[.css-1dntdmy]")`, which is
  `querySelector`, the first in document order. It returns 4-in-1 for both fingerprints. The text strategy below it
  (`:50-53`) is never reached, and is stripped by the caller anyway.
- `action-runtime/resolve-target.ts:322-330`: the veto refuses that single answer and demotes the strategy to a miss
  (`misses.push(… verdict.summary)`). Fingerprint is the last exact strategy.
- `identity/veto.ts:234-235`: rule 2, `uncorroborated`. Score 0.070, because the classes and tag agree and the text
  contradicts. This rule is correct: 4-in-1 is the wrong chip.
- `action-runtime/resolve-target.ts:361` to `identity/candidates.ts:118-121`: Level 2's `CANDIDATE_SELECTOR`
  (`a[href], button, input, select, textarea, summary, label, [role], [tabindex], [onclick], [contenteditable]`)
  admits none of the chips, so Level 2 enumerates nothing.

Core's matcher (`fingerprinting/element-fingerprint.ts`) is not the rejector. Scoring the **right** chip against the
saved fingerprint gives 1.000 for Spain and **0.938** for 7-in-1, even with the stale `optionOn` token. Both are
corroborated, so the veto would accept them.

### The provider-free reproduction

`<scratchpad>/repro/repro.ts` bundles the real `findClosestFingerprint`, `vetoCandidate`, `scoreTargetCandidate(s)`
and `isVolatileIdentifier` with esbuild against a stub page. The stub holds the nine picker elements with the decoded
classes, and the saved ids are absent. Output of `node build.cjs && node out/repro.mjs`:

```text
isVolatileIdentifier(fbaudnsk) = false   (fb104wdzu false, fb1sh8ihu false, fb1bkuerz false, fb8y7yz1 true)
== trial 1 / s10 Spain (as dispatched)
  Level 1 class-set strategy lands on: 4-in-1 [css-1354e7d]
  veto of that element: score=0.070 refusedBecause=uncorroborated
  the recorded chip itself (Spain [css-1354e7d]): score=1.000 refusedBecause=(accepted) corroborated=true
== replay / s9 7-in-1 (saved Flow)
  Level 1 class-set strategy lands on: 4-in-1 [css-1354e7d css-1dntdmy]
  veto of that element: score=0.070 refusedBecause=uncorroborated
  the recorded chip itself (7-in-1 [css-1354e7d]): score=0.938 refusedBecause=(accepted) corroborated=true
  ... with the state class removed from the recording: score=1.000
== replay / s8 Space Grey (saved Flow)
  Level 1 class-set strategy lands on: Space Grey [css-15cl3ai css-1dntdmy]   -> accepted 1.000 (passes by luck)
== counterfactual / Silver saved selected (s8 shape)
  Level 1 class-set strategy lands on: Space Grey [css-15cl3ai css-1dntdmy]
  veto of that element: score=0.070 refusedBecause=uncorroborated            -> the same failure for any non-default colour
== proposed: score every class-set match (or every pressable div) instead of acting on the first
  Spain:      resolved -> Spain       [Spain=1.000, 4-in-1=0.070, 10-in-1=0.070]
  7-in-1:     resolved -> 7-in-1      [7-in-1=0.938, 4-in-1=0.070, China=0.070]
  Space Grey: resolved -> Space Grey  [Space Grey=1.000, Silver=0.008, Mint=0.008]
  Silver:     resolved -> Silver      [Silver=0.938, Space Grey=0.070, Mint=0.008]
```

The 0.070 matches the run's "refused div scoring 0.07" exactly.

### Other causes considered and ruled out

- **The flash-deal variant regenerating classes mid-build.** Ruled out. The class hashes depend only on seed and
  build (`marketClasses`), and the saved `css-1354e7d` is present on the live chips. Only ids rotate, and they rotate
  per page view, not per variant.
- **The record gate, the shadow gate and the xpath gate.** Ruled out. The fingerprints carry no `record` and no shadow
  hosts. The shadow-root second pass is the normal "widen after a document miss" and found nothing either. There is no
  xpath on these nodes.
- **`stableNameMatch`.** Not applicable. The chip's name is not its state.
- **The state class.** It contributes but is not necessary. It turns "the first chip of the class" into "the chosen
  chip of the group" for 7-in-1 and the swatches, and it would keep 7-in-1 out of a class-set pool even after a
  multi-match fix (see fix C).

## Proposed general fix (no per-site rule)

**A. Level 1 must not act on the first weak match and skip the words** (primary; it alone fixes all four cases).
In `action-runtime/resolve-target.ts` `fingerprintMatches`, let the class-set strategy answer with **all** its
matches, not `querySelector`'s first. When the recording carries `visibleText` or `accessibleName`, also run the
exact-text and accessible-name scans even if a stable query answered. Return the union, so the existing multi-match
path (`gatedPool`, then `scoreTargetCandidates` with floor 0.35, margin 0.2 and exact corroboration) chooses. The
reproduction shows that path resolves Spain, 7-in-1, Space Grey and Silver with margins of 0.87 or more.

A narrower variant: when the single stable answer is vetoed, fall through to the name and text scans inside
`fingerprintMatches` instead of ending the strategy.

Files: `apps/extension/src/content/action-runtime/resolve-target.ts` and `apps/extension/src/content/element-finder.ts`
(a `findAllByClassSet`, or a flag that returns every match). Tests beside them:
`apps/extension/src/content/action-runtime/tests/` (a new `option-chip-replay.test.ts` on the stub-DOM pattern of
`resolve-target.test.ts`: a picker of like `<div>`s, the saved fingerprint's id absent, expect the recorded chip) and
`apps/extension/src/content/tests/element-finder.test.ts`. Also add a real-DOM row beside
`e2e/content/tests/check-chosen-option/tests/check-chosen-option.spec.ts`, which already loads the real crossborder
item page with seed 7342: dispatch `web.dom.check` with the two saved fingerprints above on a fresh page and expect
"Option chosen" on 7-in-1 and Spain.

**B. Level 2 must see the controls the page view already calls clickable.** `identity/candidates.ts`
`CANDIDATE_SELECTOR` misses `<div>`s bound in script, even though the snapshot marks them `hasClickHandler` through
`pageListensForPress` (`describe-element.ts:78`) and the page view prints `clickable`. Add a bounded second pass over
the recorded tag's elements that `pageListensForPress`, or whose own cursor is `pointer` (`evidence/press-cursor.ts`),
under the same `MAX_SCANNED` and `MAX_CANDIDATES` caps. Files: `apps/extension/src/content/identity/candidates.ts`.
Test: `apps/extension/src/content/identity/tests/` (a new `candidates.test.ts`, or extend `score.test.ts`) plus the
e2e row above. This is defence in depth: if A misses for another reason, scoring still finds the chip.

**C. A class that only marks the chosen option is state, not identity.** The general rule already exists:
`evidence/like-options.ts` finds the run of like siblings and the member drawn apart by a class at most half the run
carries. The snapshot uses it to print `marked`, and `check` uses it to read the chosen option. Apply the same rule at
description time. In `describe-element.ts:87-88`, leave out of `classNames` the tokens that set the element apart from
its run, only when it is the run's single apart member (the `setApartFromLikeSiblings` condition, so a consent
banner's two differently drawn buttons keep their classes). Add a small export in `like-options.ts` that names those
tokens. This matches the domain builder's stated contract (`domain/src/element-fingerprint/build.ts` header: "A
control's state … is left out"). Today that contract covers attributes but not class-borne state. Files:
`apps/extension/src/content/evidence/like-options.ts` and `apps/extension/src/content/describe-element.ts`. Tests:
`apps/extension/src/content/evidence/tests/set-apart.test.ts` (or a new `like-options.test.ts`) and
`apps/extension/src/content/tests/describe-element.test.ts`. Every save path (recorded, model-built, repaired,
in-run repair) reads classes from this descriptor, so one change covers all of them. Fingerprints already saved still
need A.

**Not proposed: a shape rule for `fb…` ids.** The selector anchoring on a per-load id is the trigger, but the shape
rule cannot tell such ids from authored ones (`score.ts` header: 1053 of the scenario's 1960 are judged
non-generated). Scoring already drops absent tokens (`page-tokens.ts`). With A in place, a missing anchor is harmless.

## Commands run and observed results

- `node seedfind.mjs` (scratch) printed `7342 optionOn=css-1dntdmy optionOff=css-1yjsbss chipOption=css-1354e7d
  swatch=css-15cl3ai`.
- `node ids.mjs` (scratch) printed `0 sku-color fb1sh8ihu`, `0 sku-spec fbaudnsk`, `0 qty fb8y7yz1`,
  `3 sku-color fb1bkuerz` and `3 sku-origin fb104wdzu`.
- `node attempts2.cjs <copied command-attempts>` gave all 31 dispatched commands in time order with messages. The
  quoted failures above are from it.
- Node scripts over the copied event chunks gave the trial 1 (`trial.c62688f2…`) s10 failure payload and the replay
  (`e3627ccc…`) s9 page views.
- `node build.cjs && node out/repro.mjs` (scratch, esbuild bundle of the real extension modules, no provider, no
  browser) printed the output quoted above.
- `git log -1` in both `!FluxIQWebExtension` and `fxwork/t418/!FluxIQWebExtension` printed `1d63b2c8…`, so the
  run's tree equals dev.

## Not verified

- No real browser DOM was used. The reproduction stubs the page: its `querySelector` implements only the `tag.class`
  set and treats the id-anchored selectors as misses, and candidate fingerprints are written by hand in
  `candidateFingerprint`'s shape. The live DOM classes are inferred from the fixture source and the page view's
  `marked` flags, not read from a DOM dump.
- The number of the replay's page view is not read directly. That the replay's ids differ is inferred from its
  selector being listed as a miss.
- Fixes A, B and C are proposals. None is implemented, and their effect on the identity-drift, ambiguous-targets and
  veto fixture populations (`reports/v-*`, `g-resolver-corroboration.md`) is not measured. A in particular changes
  when Level 1 returns several matches. The multi-match path already exists, but the rows in `identity-veto.spec.ts`
  and `identity-ambiguity.spec.ts` should be rerun.
- I did not check where the model-built path's structural `main > …` selector (used by trial 1's s9 and the repaired
  s10) comes from, as opposed to the id-anchored one.

## Open questions or contradictions found

- The brief says "7-in-1 (already selected from exploration) passed" in trial 1. In fact trial 1's s9 passed because
  its selector was structural (`main > … div:nth-of-type(4) > …`) and hit, and the reply was "Option chosen", not
  "already chosen". The trial reset puts the page back to its defaults.
- Trial 2 passed only because the repair captured s8 and s9 on trial 1's page at views=0, and trial 2's reset met
  views=0 again, so the rotating ids happened to match. This was a coincidence of the Lab's reset, not robustness, and
  it is why the saved Flow then failed in the replay. The judged-run gate cannot catch this class of defect while
  trials replay on the same page view number.
