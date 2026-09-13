# r-fixture-audit — how far the Testing Lab's fixtures are from a real page

Read-only audit, 2026-09-12, worker `r-fixture-audit`. No source changed, no
Lab command run, no build run. Everything below is read off the tree at the
session's `HEAD` (`362f313`) plus the uncommitted working-tree changes.

The user's assessment — the demo scenarios "are extremely basic and dont look
like any real website" — is correct, and the consequence is larger than fixture
quality. This report says how far, in numbers, and what each missing property
would have caught.

**The one-sentence version.** The fixtures are not merely small; they are
*uniformly well-labelled*, and that single property puts every Week 1
measurement into the one arithmetic regime where the resolver behaves well.
81% of fixture buttons carry a `data-testid` or an `id` **and** visible text.
Production pages strip test ids at build time. Every score, threshold and
enumeration in `content/identity/` divides by the weight of the signals the
*recording* carried, so removing those identifiers does not shift the numbers
slightly — it changes the denominator by 38% and inverts which guard is doing
the work.

---

## 1. Inventory

`apps/scenario-lab/src/scenarios/` holds 22 scenarios
(`apps/scenario-lab/src/registry.ts:26-49`). The content harness
(`apps/extension/e2e/content/fixture.ts:19-36`) opens these same 22; there is no
second fixture set anywhere in the repository. The FluxBench week1 corpus
(`packages/test-runner/src/bench/corpus/week1.ts`) is 28 rows over 16 of them,
expanded across two lanes.

Every page is built by one shared helper, `apps/scenario-lab/src/html.ts:10`:
`max-width: 48rem`, system font, nine CSS rules, no framework, no reset, no
class-based styling. That helper is the reason the corpus looks the way it does.

**Scope note.** Every count in this section describes those **22 scenarios** —
the corpus that produced every Week 1 measurement. Two of the three new
builder fixtures landed in the working tree *after* this inventory was taken
and are excluded from it: `storefront-checkout` (registered, `types.ts:8`) and
`admin-console` (on disk, not yet registered). **§5.0 inventories those two
separately**; read it before acting on §5.

| Scenario | Page shape | Rendered elements (approx.) | Candidate pool¹ | Notable DOM features |
| --- | --- | --- | --- | --- |
| `ambiguous-targets` | two `Continue` buttons + 2 email inputs | ~14 | 2 buttons | 3 modes; `no-context` strips every distinguishing signal |
| `auth-gate` | login form → protected page | ~30 | ~6 | 2 documents, session state, `role` ×2 |
| `basic-form` | one form | ~14 | ~7 | the minimum page |
| `data-table` | 12-row × 5-col sortable table | ~90 | 5 buttons | `aria-sort`; **no row-level actions** |
| `delayed-ui` | one late button | ~4 | 1 | timing only |
| `dynamic-list` | add/remove list | ~12 | ~5 | mutation |
| `failure-surfaces` | 6 buttons in known-bad states | ~16 | ~7 | disabled / detached / blocked URL |
| `file-transfer` | upload + download | ~20 | ~4 | file input, `Content-Disposition` route |
| `identity-drift` | workspace settings, 6 render modes | ~38 | **2 buttons** | the whole matcher calibration rests here |
| `iframe-checkout` | 2 iframes, 1 button each | **8 total** | 1 per frame | the entire frame corpus |
| `infinite-feed` | 60 posts, 10 per page | ~370 loaded | **2** | `role=feed`, IntersectionObserver; no controls in the feed |
| `instruction-only-form` | form with prose instructions | ~18 | ~7 | LLM lane |
| `intermediate-state` | multi-step wizard | ~34 | ~10 | `tabindex` ×2, `role` ×2 |
| `keyboard-forms` | ARIA combobox + radio group + checkbox | ~35 | ~14 | the most ARIA in the corpus (12 `role=`) |
| `llm-target-drift` | 5 relabelled buttons | ~13 | 5 buttons | LLM retarget lane |
| `long-document` | 24 sections, 1 below-fold button | ~80 | **1** | the only `position: sticky` in the corpus |
| `modal-flows` | draft editor + consent banner + 2 dialogs | ~50 | ~14 | fixed action bar, `inert`, `aria-modal`, backdrops |
| `multi-tab` | 4-row PO table, links open tabs | ~55 | ~10 | `target=_blank`, `window.open`, per-row `aria-label` |
| `navigation` | 3 links, 1 broken | ~13 | ~5 | history |
| `product-catalog` | 8 cards/page of 23, search, pagination | ~90 | ~19 | the largest candidate pool in the corpus |
| `reconnect` | 3 control buttons | ~7 | 3 | transport only |
| `sensitive-input` | login-shaped form | ~13 | ~5 | redaction |

¹ Elements matching `CANDIDATE_SELECTOR`
(`apps/extension/src/content/identity/candidates.ts:57-60`) — the pool Level 2
scores from, before the tag/role family filter narrows it further.

### Corpus-wide facts

Measured by grep over `apps/scenario-lab/src/scenarios/**/*.ts`:

| Fact | Count | Why it matters |
| --- | --- | --- |
| `data-testid` attributes | **286** | the recorder's strongest signal, universally present |
| `id="…"` attributes | 44 | |
| `class="…"` attributes | **37 across all 22 scenarios** | Level 1's class-set query has almost nothing to chew on |
| distinct class *values* | 27, all hand-authored (`btn btn-primary`, `ui-button`, `dialog`) | zero hashed, zero utility-generated |
| `<svg>` elements | **0** | |
| `<img>` elements | **0** | |
| `attachShadow` / `customElements` | **0** | |
| `<iframe>` | 2, both in `iframe-checkout` | |
| `<button>` total | 62 | |
| …carrying an identifier **and** visible text | **50 (81%)** | see §3 |
| …carrying neither text nor an accessible name | **0** | the veto's unprotectable class has no instances |
| `<input>` without an identifier | 1 of 23 | |
| `<a href>` without an identifier | 1 of 9 | |

**Not one capacity bound in the resolution or capture path is reached by any
fixture.** The largest fixture page holds roughly 370 DOM elements
(`infinite-feed` fully scrolled) against `MAX_SNAPSHOT_SCAN_ELEMENTS = 50_000`
and `MAX_SNAPSHOT_CANDIDATES = 2_000`
(`apps/extension/src/content/dom-snapshot.ts:46-47`). The largest candidate pool
is ~19 against `MAX_SCANNED = 600` and `MAX_CANDIDATES = 60`
(`candidates.ts:44-46`). The evidence packet's 40-element bound
(`domain/src/runtime/llm-evidence/limits.ts:30`) exceeds every fixture page's
whole interactive inventory. The `MAX_TEXT_SCAN = 2_000` in
`resolve-target.ts:134` is 5× the largest fixture document.

Every one of those bounds is therefore **declared but unexercised**. They are
not "tested and found generous"; they have never been reached.

---

## 2. What the fixtures lack, and what each would have caught

Ordered by what it costs, not by how visible it is.

### 2.1 Identifier scarcity — the property everything else rests on

Production builds strip test ids (`reactRemoveProperties`,
`babel-plugin-react-remove-properties`, and the equivalent Vue/Angular
transforms are default in framework starters). React's `useId` produces
`:r7:`-style ids that change per render tree. So the ordinary real-world
recording carries **visible text and an accessible name, and no stable
identifier** — or, for an icon button, **nothing distinguishing at all**.

`reports/L-veto-recordings.md:91-105` already enumerated the 16 recording
classes and what the veto does in each. Reading that table against the
fixture census:

| Recording class | Worst impostor | Acted after corroboration | Fixture instances |
| --- | --- | --- | --- |
| id + testId + text + name | −0.032 | 0 | the fixture norm |
| id/testId + text | +0.053…+0.101 | 0 | 50 of 62 buttons |
| **text + name, no identifier** | +0.010 | 0 | ~11 buttons |
| **text only** | +0.183 | 0 | ~10 buttons |
| **name only** | +0.183 | 0 | 1 button |
| **nothing named** | **+0.563** | **32 — unprotectable** | **0** |

**What this would have caught.** The bottom row is the one real pages are full
of: `<button><svg/></button>`, the icon button with no label. It is the one
class both veto rules decline to protect, `L-veto-recordings.md:209-213` names
it as a decision rather than a fix, and **the fixture corpus contains not a
single instance of it — nor a single `<svg>` or `<img>` of any kind.** The
decision to leave it open was taken without ever seeing it on a page.

### 2.2 Generated class names

Level 1's class-set query is
`element-finder.ts:34-36`: `${tag}${classNames.map(c => '.' + CSS.escape(c)).join('')}` —
an **all-of** conjunction. Against `btn btn-primary` that selects a broad,
stable family. Against real class sets it does one of two things, neither
tested:

- **Utility soup (Tailwind).** A button carries 12–20 classes. The conjunction
  is then so specific that it matches only buttons styled *identically* — which
  on a design-system page can be 40 of them (all primary buttons in the app) or
  zero, if any single state class (`is-loading`, `data-[state=open]:…`, a
  focus-visible variant) differed between capture and replay. Zero matches is a
  silent fall-through to the text query; 40 matches goes to scoring.
- **Hashed names (CSS modules, styled-components).** `Button_root__x7f2a` is
  stable within a deploy and different after the next build. So the class-set
  strategy's reliability is *deploy-scoped* — a property no fixture can show,
  because the fixtures' classes are literals in source.

**What this would have caught.** `veto.ts`'s entire motivating example is a
class-set match on `btn btn-primary` landing on a "Delete workspace" button.
That example is only reachable because the class set is two short, semantic,
widely shared tokens. On a hashed or utility page the same drift produces a
*miss*, not a wrong match — which is safer but means the veto's headline
scenario is a fixture artefact, and the real class-set hazard (40 identical
matches going to scoring) has never been produced.

### 2.3 Interference

`modal-flows` is the only fixture with an overlay, and it is a good one: a
`position: fixed` consent banner at `z-index: 20` over a fixed action bar at
`z-index: 10`, plus two `aria-modal` dialogs with backdrops and an `inert`
shell (`scenarios/modal-flows/markup.ts:7-21`). What it is not is *real*:

- The banner is **present in the first render**. Real consent managers load
  asynchronously, typically 300 ms–3 s after `DOMContentLoaded`. That creates a
  capture/replay race the fixtures cannot produce: the recorder snapshots a page
  the banner has not yet covered, and the replay meets a page it has.
- The banner **overlays** rather than **shifts layout**. A top-anchored banner
  that pushes the document down invalidates every recorded viewport coordinate
  and every `visualTarget.bounds`. `resolve-target.ts:535-543` prefers
  `documentBounds` corrected for scroll precisely because of this, and that
  preference has never met a page that shifted.
- There is **one** overlay at a time, and it is same-document. A real page
  carries a CMP, a chat widget in a third-party iframe pinned bottom-right, a
  sticky header, and sometimes a promotional modal, simultaneously.

**What this would have caught.** `checkActionability`
(`action-runtime/actionability.ts:35-59`) is genuinely well built for this — it
centres the element (`scroll-element-into-view.ts:14`, `block: "center"`,
explicitly to defeat sticky furniture) and descends open shadow roots when hit
testing. The untested part is not the gate but what happens *after* it refuses:
nothing in the extension dismisses an overlay, so on a real page the ordinary
outcome of a recorded first click is `ACTION_REJECTED / covered`. No fixture
measures how often that is the outcome, because on the fixtures the banner is
either armed deliberately or absent.

One case the gate can get *wrong*, unmeasured: the `coordinates` strategy uses
`document.elementFromPoint` and takes the topmost element
(`resolve-target.ts:523-526`). A banner at the recorded point yields a single
match, so `gatedPool` returns it as `only` (`resolve-target.ts:349-351` — the
fallback returns `matches` when the gate rejects all of them), and the veto is
the sole guard. When the recording carries no distinguisher, `vetoExactMatch`
returns an empty verdict at `veto.ts:214` and **the banner is clicked**. That path
requires an identifier-less recording plus a coordinate command plus an
overlay: three properties the corpus has never combined.

### 2.4 Scale

`MAX_SCANNED = 600` in `candidates.ts:44` counts elements matching
`a[href], button, input, select, textarea, summary, label, [role], [tabindex],
[onclick], [contenteditable]` — in **document order, and the break happens
before the family filter** (`candidates.ts:77-82`). On a real application page
that selector matches several hundred to a few thousand elements; `[role]` and
`[tabindex]` alone cover every item of a design-system nav, every grid cell,
every menu item.

Consequence, concretely: a page with a 200-item sidebar and a 300-row grid
before the main content puts the target's family past index 600.
`collectTargetCandidates` returns `[]`, `scoreTargetCandidates` returns
`unmatched` with an empty ranking, and `notFound` reports
`"nothing matched; 0 control(s) of the same family are on the page"`
(`resolve-target.ts:448`) — **which is false**, and is exactly the field a Flow
reads to decide whether to widen its target or rewrite the step.

Two related observations:

- The bound's stated purpose is not achieved. Its comment says "a page with ten
  thousand nodes must not turn one click into a full-document walk", but
  `querySelectorAll` has already walked the document and materialised a static
  NodeList before the loop starts. `MAX_SCANNED` bounds only the fingerprinting,
  not the walk. No fixture is large enough for that to be visible.
- The merged multi-frame element list is **uncapped**
  (`background/connection/dom-snapshot.ts:151-172`). Every page-evidence
  collection has a merged budget (`MAX_MERGED_REGIONS = 40`, etc., lines 69-75),
  but `mergedElements` takes `...elements` from every frame with no limit — up to
  2,000 per frame. The existing open question records +4.3 KB at two frames and
  +12 KB at six; those were measured on `iframe-checkout`, whose frames hold
  **six elements each**. A real page's frames hold hundreds.
- `FRAME_SNAPSHOT_TIMEOUT_MS = 150` (line 80). Loopback fixture frames always
  answer; a third-party ad or chat frame on a loaded page frequently will not,
  and is then silently absent from the merged snapshot.

### 2.5 Shadow DOM and web components

`grep -rn "shadowRoot|attachShadow" apps/extension/src` returns exactly two
non-test hits: `actionability.ts:122` (hit-test descent) and
`event-elements.ts:22, 38` (`composedPath` during recording). There is **no**
shadow traversal in `dom-snapshot.ts`, `candidates.ts`, `element-finder.ts` or
`describe-element.ts`. A target inside a shadow root is recorded and then
unfindable: `document.querySelector`, `document.evaluate`,
`document.getElementById` and `document.querySelectorAll` all stop at the
boundary.

**What a fixture would have caught.** The plan records shadow DOM as "recorded
but not replayable" as a *belief*. Across the 22 scenarios nothing demonstrates
the failure end to end, so nobody knows what it looks like from a Flow's side:
whether it surfaces as `TARGET_NOT_FOUND` with an honest zero-candidate
ranking, or as a wrong element picked up by an unanchored positional selector
that happens to match in the light DOM.

**Now partly closed.** `admin-console/shadow-control.ts` landed mid-session
with exactly this shape — `<fx-toggle>`, an open root, the test id and role and
accessible name on the inner button where `document.querySelector` cannot reach
them. The extension code above is unchanged, so the gap is now a *measurement*
waiting to be taken rather than a fixture waiting to be written. A **closed**
root is still absent, and it takes the other branch at `actionability.ts:122`
(`hit?.shadowRoot` is `null`, so the hit test stops at the host).

### 2.6 Client-side routing

`navigationEvidence()` (`content/evidence/navigation.ts:21-34`) reads
`performance.getEntriesByType("navigation")`. A `pushState` route change
produces no new navigation entry, so `type` stays at the initial load's value
and `redirects` never changes; only `url`, `path` and `historyLength` move. So
a SPA route change and "the same page with a changed query string" are
indistinguishable in the evidence.

Among the 22, no fixture routes client-side (`admin-console`, which landed mid-session, does — see §5.0). `auth-gate`, `multi-tab`, `navigation` and
`product-catalog` all navigate with real document loads served by the scenario
`route()` hook.

**What this would have caught.** Whether `wait-for-selector` / `wait-for-text`
and the recorder's page-change latch treat a route change as a navigation at
all — and whether a Flow recorded across a route boundary replays as one page
or two.

### 2.7 Virtualised lists

Among the 22, `infinite-feed` appends and never removes: 60 posts, all in the DOM once
loaded. That is the *opposite* of virtualisation, where the recorded element is
absent from the DOM at replay and cannot be reached by selector at all — only
by scrolling a container until the framework renders it.

**What this would have caught.** Three things at once: `wait-for-selector` on a
row that will never appear without a scroll; `extract_list`'s pagination
(`EXTRACT_MAX_PAGES = 50`) against a list with no pages; and the resolver's
not-found diagnostic, which would report a small same-family count on a list of
ten thousand logical rows.

### 2.8 Frames

`iframe-checkout` is the entire frame corpus: two frames, one same-origin, one
on a second loopback port, **one button each**, no nesting, no `sandbox`, no
lazy load, no frame that navigates mid-run. `all_frames: true` is set in the
manifest, so a real page's dozen ad and widget frames each get a content script,
a snapshot request and a 150 ms timeout on every recorded event.

**What this would have caught.** The per-frame budget arithmetic in §2.4, the
`frame[<id>] >> <selector>` rewrite/undo round trip
(`domain/src/runtime/llm-evidence/elements.ts:29-30`) under more than one child
frame, and whether a cross-origin payment frame that refuses injection produces
a usable `unreachableFrameReason` (`background/tabs.ts:99`) rather than a
silently short snapshot.

### 2.9 Accessibility reality

The fixtures are the accessibility a careful author writes: 24
`aria-labelledby`, 22 `aria-live`, 22 `aria-label`, `role="status"` on every
result paragraph, `aria-sort` on sortable headers, a textbook ARIA combobox with
`aria-controls`/`aria-expanded`/`aria-autocomplete` and an `id` **and** a
`data-testid` on every option (`scenarios/keyboard-forms/markup.ts:29-32`).

Real sites have duplicated ids, `aria-labelledby` pointing at removed nodes,
`aria-label` contradicting visible text, and portal-mounted listboxes that live
at `document.body` rather than inside the combobox. That last one matters
structurally: `selectorFor`'s positional fallback and `elementContext`'s
landmark/heading walk both read the *ancestor chain*, and a portalled dialog's
ancestor chain is `body > div[data-portal] > div[role=dialog]` — no landmark, no
form, no heading above it.

**What this would have caught.** `accessible-name.ts` bounds
`aria-labelledby` at 8 ids and 200 characters, and `label.ts` walks 4 nearby
siblings. Those are guesses about pages nobody has fed them.

### 2.10 The selector fallback that fixtures never take

`describe-element.ts:104-121`. `selectorFor` returns `#id` (line 105) or
`[data-testid="…"]` (line 107) or `tag[name="…"]` (line 109) and only then
falls back to a positional chain — bounded at **five segments** and joined with
`>` **without anchoring at a root**.

Given 286 test ids and 44 ids across 22 fixtures, that fallback is essentially
never taken. A fixture button sits about five levels below `<body>`
(`main > form > section > div > button`), so on the rare occasion the fallback
does run, the five-segment budget still reaches a near-root element and the
selector is unique.

On a real page the element is 12–25 levels deep. The chain then reads
`div > div:nth-of-type(2) > span > button` — unanchored, and
`document.querySelector` returns the **first** match anywhere in the document.
`element-finder.ts:14` (`bySelector`) and `:20` (xpath, tried *before* the id)
each return a single element, so `resolve-target.ts` sets `only` and the veto is
the sole guard. `xpathFor` (`element-finder.ts:41-54`) has the same shape: fully
positional unless an ancestor carries an id.

**What this would have caught.** The code path that will be taken on almost
every real-world element is the one the corpus almost never takes. Its failure
mode is a confident single match on the wrong element.

---

## 3. Which measurements change, and in which direction

### 3.1 The `identity-drift` ceiling of 0.270 — **wrong for real pages, by a wide margin, in the permissive direction**

`reports/v-drift-fixture.md:110-137` derives the ceiling from Core's weights:
`id` 26, `testId` 28, `visibleText` 24, `accessibleName` 24, `selector` 14,
`role` 10, `tagName` 7, `classNames` 5, `visibility` 4 — **142 total**. The
ceiling exists because `normalizedScore` divides by the weight of the signals
the **recording** carried, and the identity-drift recording carries both
identifiers. So −0.55 × 26 and −0.55 × 28 are charged before a word is compared,
and 54 of 142 points are guaranteed against every candidate.

Reproducing that report's own per-signal table with the two identifier rows
removed — which is what a production recording looks like:

| Signal | Points (thin recording) |
| --- | --- |
| `accessibleName` (exact `aria-label`) | +24 / 24 |
| `visibleText` (0.82 similarity) | +19.68 / 24 |
| `role` | +10 / 10 |
| `tagName` | +7 / 7 |
| `visibility` | +4 / 4 |
| `selector` (candidate offers none) | −3.5 / 14 |
| `classNames` (no overlap) | −0.5 / 5 |
| **Total** | **60.68 / 88 = 0.690** |

**The same drift that measures 0.218 against a test-id-bearing recording
measures ≈0.690 against an identifier-less one.** The 0.35 floor goes from
unreachable to cleared with 0.34 to spare.

This is arithmetic on published weights, not a measurement — see §6 — but the
mechanism is not in dispute: `L-veto-recordings.md:120-131` states it directly
("Drop the id and the test id and the impostor loses 2.6 + 2.8 of penalty *and*
the denominator loses 54").

### 3.2 The 0.35 score floor — **the mechanism is sound; the regime it was chosen in is not the real one**

`score.ts:92-116` records that the floor was kept, rather than lowered, because
Core changed the missing-vs-contradicted split instead: the drift case
(identifiers *absent*) rose to 0.389 while the near-miss "Save changes and exit"
(identifiers *contradicted*) stayed at 0.088, separating by 0.301 with the floor
inside the gap.

That separation is produced by the identifiers. Remove them from the recording
and both sides rise and converge: the drift case to ≈0.690 (above), and the
near-miss — which now differs only by a partial text/name similarity — to
roughly 0.55–0.60 on the same arithmetic. Two consequences, opposite in kind:

- **Where there is a runner-up, the margin catches it.** ≈0.11 apart is well
  inside `TARGET_SCORE_MARGIN = 0.2`, so the outcome is `ambiguous` — a refusal,
  not a wrong click. Safe.
- **Where the near-miss is unopposed, the floor is the only guard, and it now
  admits it.** `score.ts:96-101` names this case explicitly: "a single unopposed
  'Save changes and exit' at 0.088 … on a page where it is the only candidate
  left and the margin below therefore cannot protect anything." At 0.088 the
  floor refuses it. At ≈0.57 the floor accepts it. **This is the concrete
  regression: the exact case the 0.35 floor was chosen to refuse is admitted
  when the recording carries no identifier.**

The floor is not *miscalibrated*; it was calibrated correctly for recordings
that carry both identifiers. Its problem is that it is a single constant across
two arithmetic regimes, and the fixtures only ever produced one of them.

### 3.3 The `TARGET_SCORE_MARGIN` of 0.2 — **sound, and gets safer with complexity**

Calibrated on `ambiguous-targets`, a page with exactly **two** twins
(`scenarios/ambiguous-targets/render.ts:21`). That is as thin an empirical base
as the floor's. But the mechanism generalises in the safe direction: more
candidates means more near-ties means more refusals. The failure mode on a real
page is over-refusal, not wrong clicks.

What is unmeasured is the *rate*. On a 40-row grid whose rows carry identical
"Edit" buttons, every resolution ties and the answer is always
`TARGET_AMBIGUOUS`. That is honest and it is also unusable, and it is the
single most common real-world shape. `MAX_NAMED_CANDIDATES = 5` means the
failure names five of forty and says "and 35 more", which is at least readable.

One structural note that only shows up at that scale: `elementContext`
(`identity/context.ts:36-46`, current) captures `listPosition`, `tablePosition`,
`formName`, `landmark` and `heading` — the exact signals that separate row 7's
Edit button from row 8's — and **`comparableFingerprint` does not send any of
them to the scorer** (`score.ts:187-201`). A grep confirms `elementContext` is
read only by `describe-element.ts:79`; no resolver module reads
`descriptor.context`. The `form-context` fixture mode, built to prove "context
resolves ambiguity", proves it through Level 1's positional *selector*, not
through scoring. On a fixture with two twins that distinction is invisible; on a
grid it is the whole problem.

### 3.4 The veto's zero threshold and corroboration rule — **the threshold does almost nothing on real pages; corroboration does all the work**

From `L-veto-recordings.md:91-105`: rule 1 (`score >= 0`) separates impostors
from drift for **3 of 16 recording classes**, and all three carry a stable
identifier *and* both text signals. The fixtures put 81% of their buttons in
exactly those classes. Production recordings fall in the bottom four rows,
where rule 1 lets through impostors at +0.010 to +0.563 and rule 2
(corroboration) is what refuses them.

Direction, stated plainly: **on real pages the zero threshold is close to
inert, and the whole of the veto's protection is the corroboration rule.**
That rule was measured to be free (240 impostor profiles refused, zero
legitimate resolutions lost), so this is not a hole — but the confidence the
plan currently places in rule 1 is confidence in a fixture property.

And the bottom row of that table — "nothing named", worst impostor **+0.563**,
32 profiles acted on *after* corroboration, named in D14 as unprotectable — is
the icon button. Zero fixture instances. Zero `<svg>` in the corpus.

### 3.5 The candidate enumeration cap — **binds on real pages, and fails with a false diagnostic**

`MAX_SCANNED = 600`, unreached by any fixture (largest pool ≈19). See §2.4 for
the mechanism. Direction: on a page whose first 600 `CANDIDATE_SELECTOR`
matches exclude the target's family, Level 2 is not merely degraded — it is
skipped, and the failure record asserts a candidate count of zero that is
wrong. `MAX_CANDIDATES = 60` binds sooner and more benignly (document order is a
reasonable tie-break for scoring, though it silently favours the top of the
page).

### 3.6 The evidence byte budgets — **the trimming is sound; the ranking is untested**

Credit where it is due: the budget machinery *is* exercised at scale, in
`domain/src/runtime/llm-evidence/tests/` — 50 and 60 synthetic elements against
the 3,000 / 6,000 / 12,000-byte budgets, with `truncated`, `elementsTruncated`
and `budgetTruncated` all asserted. That part is not fixture-limited.

What is fixture-limited is which 40 elements arrive. Two anchors:
`sanitize.test.ts:168` fits 40 deliberately fat elements into ≤10,500 bytes
(~260 bytes each); the failure path's budget is **3,000 bytes**, clamped at
Core's gate (`limits.ts:22-26`). So a failure packet carries on the order of ten
to twenty-five elements, and real pages sit at the low end because their
selectors are positional chains and their names are longer than
`[data-testid="save-profile"]`.

On a 12–19 control fixture, "the first ten ranked elements" is the whole page.
On a 300-control page it is ~3% of it, chosen by
`snapshotElementBucket` / `elementPriority` (`dom-snapshot.ts:225-233`) — a
ranking whose top bucket is "elements the user recently touched"
(`MAX_OBSERVED_EVENT_ELEMENTS = 500`) and whose remaining buckets have never
had to discriminate. The LLM is then asked to diagnose a failure from 3% of the
page, correctly flagged `truncated: true`, with no fixture evidence that the
3% contains the cause.

### 3.7 What the 43-row corpus actually exercises

Of the 28 week1 rows, five reach a weak Level 1 query or Level 2 scoring at all:
W20 `selector-only`, W21 `text-only`, W22 `moved`, W23 `wrapped-aria`, W26
`no-context`. The other 23 resolve through the strong selector/id/test-id
queries. **On a corpus of realistic pages that ratio inverts: near-100% of rows
would take the weak-query and scoring paths.** The corpus measures the branch
production traffic will rarely take.

---

## 4. What is sound despite the simplicity

I do not want these lost.

1. **The actionability gate is genuinely well built for real pages.**
   `scrollElementIntoView` centres rather than minimally scrolls, explicitly to
   defeat sticky furniture, and `topmostAt` descends open shadow roots up to 16
   levels while `isWithin` crosses shadow boundaries that `Node.contains` does
   not (`actionability.ts:118-138`). `hitPoint` clamps to the viewport so an
   element taller than the screen still yields a testable point. None of that is
   fixture-shaped; it will behave the same on a real page.

2. **The margin generalises in the safe direction.** More candidates produce
   more ties produce more refusals. Complexity degrades this resolver toward
   over-refusal, not toward wrong clicks. That is the right way round.

3. **Core's missing-vs-contradicted split is the correct mechanism** and is
   independent of page size. `reports/v-core-scoring.md`'s change (a missing
   identifier at −0.1, a contradicting one at −0.8) is what makes an
   identifier-less recording scoreable at all; it is not a fixture artefact.

4. **The corroboration rule's evidence is not fixture-limited on the candidate
   axis.** `L-veto-recordings.md` enumerated 1,488 class-reachable and 240
   text-reachable candidate profiles analytically. Its limitation is the
   *recording* axis (16 classes of one button), not the candidate axis.

5. **The evidence packet's trimming, flags and per-field bounds** are exercised
   against synthetic 50- and 60-element pages and against Core's failure gate.
   The bytes will behave.

6. **`MAX_SNAPSHOT_SCAN_ELEMENTS = 50_000` and `MAX_SNAPSHOT_CANDIDATES = 2_000`
   are sized correctly.** Unlike `MAX_SCANNED = 600`, these will not bind on
   ordinary real pages, and the 2,000-element ranked list gives the packet's
   40-element bound something real to choose from.

7. **Redaction and sensitivity are signature-based, not shape-based.**
   `isSensitiveElementDescriptor` reads `autocomplete` tokens and control
   signatures, so a realistic page changes its inputs but not its logic. The one
   gap a realistic fixture would add is a genuine cross-origin payment frame.

---

## 5. The target fixture set

Three builders are in flight on a **SaaS dashboard**, an **e-commerce
checkout**, and an **admin/CRM surface**. Below is what they still would not
cover — split into *constraints on the three in flight* and *fixtures that must
exist separately*, because most of what matters here is a property, not a page.

### 5.0 What actually landed while this audit was being written

Two of the three arrived in the working tree mid-session, after §1's inventory
was taken: `apps/scenario-lab/src/scenarios/admin-console/` and
`apps/scenario-lab/src/scenarios/storefront-checkout/`. **They are much better
than the brief's premise assumed, and most of what I had drafted as §5.2 is
already built.** Read what follows against this, not against the 22-fixture
baseline.

Already covered by the two that landed:

| Property | Where | Notes |
| --- | --- | --- |
| **Generated class names** | `admin-console/styles.ts:19` (`CX`, emotion-style `css-1qk4d0` hashes), `storefront-checkout/styles.ts:13` (`styleClass`, plus CMP-vendor `_cmp-` and styled-components names) | Fixed strings rather than per-build hashes, deliberately and correctly — a class that changed per run would test reproducibility, not identity. §2.2's *utility-soup* half (12–20 conjunct classes) is still absent. |
| **Shadow DOM** | `admin-console/shadow-control.ts` — `<fx-toggle>`, `attachShadow({mode:'open'})`, the test id / role / name on the inner button where `document.querySelector` cannot see them | Exactly the failure §2.5 describes. **Open root only**; a closed root behaves differently in `topmostAt` (`element.shadowRoot` is null, so the hit test stops at the host). |
| **Client-side routing** | `admin-console/client-script.ts:58-150` — `pushState` per record, `replaceState` per tab, `popstate` restore | §2.6 covered. |
| **Virtualised list** | `admin-console/virtual-list.ts`, `styles.ts:6-10` (44 px rows, 480 px viewport, 4-row overscan) | §2.7 covered, with a production-shaped overscan. |
| **Interference** | `storefront-checkout/overlays.ts`, `styles.ts:86-89` — consent backdrop and banner at `z-index: 2147483000/1`, chat launcher at `2147482000` | Real CMP stacking. |
| **Payment frame** | `storefront-checkout/payment-frame.ts` | |
| **Class drift as a mode** | `admin-console/types.ts:18` — `restyled` | |

**Still not covered by either, and unchanged from §5.1:**

- **Identifier scarcity.** 45 `data-testid` in `admin-console` and 80 in
  `storefront-checkout`; only 4 of their 24 buttons carry neither a test id nor
  an `id`. The two new pages are as densely labelled as the 22 old ones, so they
  re-measure the same arithmetic regime (§3.1–§3.4). This is now the single
  highest-value gap in the whole corpus.
- **Icon-only controls.** Still **zero** `<svg>` and **zero** `<img>` across all
  24 scenarios. The "nothing named" recording class — +0.563, unprotectable —
  still has no instance anywhere in the repository.
- **Late and layout-shifting interference.** `storefront-checkout/overlays.ts`
  contains no `setTimeout`, and the consent banner is `position: fixed`, so it
  neither arrives late nor shifts layout. Both halves of §2.3's timing argument
  are open.
- **Closed shadow roots.**

### 5.1 Constraints on the three in flight — no new fixture, and the highest value in this report

These will not happen by themselves. Every one of the 22 existing fixtures was
written by an author who reached for `data-testid` without thinking about it,
and three new fixtures written the same way would add page size and prove
nothing.

| Constraint | What breaks without it |
| --- | --- |
| **At least one mode per fixture emits no `data-testid`, `data-test`, `data-cy`, and no author-stable `id`** — the production-build shape | Every number in §3.1–§3.4. Without this the three new fixtures re-measure the same regime the 22 old ones did. This is the single highest-value line in this report. |
| **Icon-only controls with no accessible name** (`<button><svg/></button>`) | The "nothing named" recording class: +0.563 impostor, 32 profiles acted on, unprotectable by either veto rule, and currently zero instances anywhere in the repository. The admin/CRM row-action toolbar is the natural home. |
| **Repeated row actions with no per-row label** — 30+ rows, identical "Edit"/"Delete", no per-row `aria-label` | The 0.2 margin at scale, and the fact that `listPosition`/`tablePosition` are captured and never scored (§3.3). `multi-tab` defuses this with a per-row `aria-label` on all four rows; `data-table` has no row actions at all. |
| **Generated class names** — one fixture on hashed CSS-module names, one on utility soup | Level 1's all-of class conjunction (§2.2), in both its zero-match and its forty-match failure modes. |
| **Enough interactive elements to pass 600 `CANDIDATE_SELECTOR` matches** in at least one mode | The enumeration cap and its false zero-candidate diagnostic (§3.5). A dashboard with a real nav sidebar reaches this without contrivance. |
| **DOM depth past 5 levels below `<body>`** for the recorded targets | `selectorFor`'s unanchored positional fallback and `xpathFor` (§2.10) — the path real elements take and fixtures do not. |

### 5.2 What is left to build, ranked

§5.0 supersedes most of what this section originally proposed: shadow DOM,
client-side routing, virtualisation, generated class names and a payment frame
all landed while this audit was being written. What remains is smaller and
sharper.

**1. An identifier-less mode on each of the three new fixtures.** Not a new
page — a mode, in the `modes.ts` shape `admin-console/types.ts:18` already
uses, that renders the same markup with no `data-testid`, no `data-test`, no
`data-cy` and no author-stable `id`. *What breaks without it:* every number in
§3.1–§3.4 stays measured in the one regime production traffic will rarely be
in. The two new fixtures carry 125 test ids between them, so today they confirm
the old measurements rather than testing them. This is the cheapest item on the
list and by a wide margin the most valuable.

**2. Icon-only controls, in the same mode.** A row-action toolbar of
`<button><svg/></button>` with no `aria-label`. *What breaks without it:* the
"nothing named" recording class — worst impostor **+0.563**, 32 profiles acted
on after corroboration, named in D14 as unprotectable — still has zero
instances in a corpus of 24 scenarios, and the whole repository still contains
zero `<svg>` and zero `<img>`. The decision to leave that class open was taken
without anyone ever seeing it on a page. `admin-console`'s record list is the
natural home.

**3. Late and layout-shifting consent, as modes on `storefront-checkout`.**
Its overlays are present at first render and `position: fixed`. *What breaks
without them:* the capture/replay race (the recorder snapshots a page the CMP
has not yet covered; the replay meets one it has) and the layout-shift
invalidation of recorded coordinates and `visualTarget.bounds`, which is why
`resolve-target.ts:535-543` prefers `documentBounds` over viewport bounds — a
preference no fixture has ever tested. Two modes: `late-consent` (banner at
t+1200 ms) and `shifting-consent` (top-anchored, pushes the document down
rather than covering it).

**4. A slow third-party frame, as a mode on `storefront-checkout`.** *What
breaks without it:* `FRAME_SNAPSHOT_TIMEOUT_MS = 150`
(`background/connection/dom-snapshot.ts:80`) has only ever met loopback frames
that answer instantly. A frame that answers after 400 ms is silently absent
from the merged snapshot, and nothing reports that it was dropped.

**5. A closed shadow root, beside the open one.** *What breaks without it:*
`topmostAt` (`actionability.ts:119-130`) reads `hit.shadowRoot`, which is
`null` for a closed root, so the hit test stops at the host and reports the
host as the covering element. `admin-console`'s `<fx-toggle>` is `mode: 'open'`
and takes the other branch. One extra custom element on the page it already
has.

**Not worth building**, on the same standard: a *nested* shadow tree, a
*slotted-content* case, and `MAX_SCANNED`-exceeding scale as its own page.
The first two exercise the same absent traversal as item 5 with no new
behaviour; the third should be a mode on `admin-console`, whose virtualised
list and nav sidebar reach 600 `CANDIDATE_SELECTOR` matches without
contrivance.

### 5.3 Deliberately not proposed

- **A "big page" fixture whose only property is size.** Scale should be a mode
  on the three in flight, not a 26th scenario. Size without a distinct
  automation behaviour is cost.
- **A real-site capture.** Tempting, and wrong for this repository: it would be
  non-deterministic, would drift under us, and `networkPolicy: "loopback-only"`
  exists for good reasons. The right substitute is the constraint list in §5.1.
- **Anything for accessibility inconsistency as its own fixture.** Broken
  `aria-labelledby`, duplicated ids and contradicting labels are cheap to fold
  into the three in flight as a mode; they do not justify a page.
- **A fourth "realistic" page in the same style as the three in flight.**
  Twenty-two fixtures already exist. The gap is not page count.

---

## 6. Not verified

- **No code was run.** The brief forbids Lab commands and builds, so nothing
  here is a measurement I took. Everything is read off source, plus arithmetic
  on weights published in `reports/v-drift-fixture.md`.
- **`content/identity/` was edited by another worker while I read it.**
  `veto.ts`, `score.ts`, `index.ts` and `tests/veto.test.ts` all changed
  mid-session: `vetoCandidate` and `vetoExactMatch` now return a
  `TargetVerdict` / `ExactMatchVerdict` union that carries the measurement on
  the *accepted* path too, closing the last open half of D1. **None of the
  rules changed** — `TARGET_VETO_FLOOR` is still 0, `recordedDistinguisher` is
  still the precondition on both rules, and `CORROBORATING_SIGNALS` is still
  the same five — so every finding in §3.4 stands. Every line number in this
  report was re-checked against the working tree *after* that change; if
  `identity/` moves again they will drift.
- **The 0.690 figure in §3.1 is arithmetic, not a measurement.** It reuses
  `v-drift-fixture.md:106-118`'s own per-signal table verbatim and removes the
  two identifier rows. It assumes Core computes `possible` over the signals the
  recording carried — which that report and `L-veto-recordings.md:120-131` both
  state — and that `visibility` is contributed by the candidate regardless. If
  Core's denominator rule differs, the number moves; the direction does not.
- **The ≈0.55–0.60 near-miss figure in §3.2 is weaker.** I substituted a
  plausible text-similarity rung for the "Save changes and exit" markup rather
  than re-deriving it. Treat the *ordering* (near-miss rises above the floor when
  the recording is thin) as the finding and the number as illustrative.
- **Element counts in §1 are derived from source templates**, not from a
  rendered page. Loop-driven scenarios (`product-catalog`, `data-table`,
  `infinite-feed`, `long-document`, `multi-tab`) are computed from their seed
  data; the rest are literal counts. They are accurate to within a few elements,
  not exact.
- **`apps/extension/e2e/content/tests/zz-descriptor-census.spec.ts` already
  measures the descriptor census I approximated statically.** Its header marks it
  SCRATCH, to be "deleted after the numbers are read" — it is still in the tree
  and **its output appears in no report**. Running it would replace my §1
  aggregates with observed ones. I did not, because it needs the content-harness
  bundle build.
- **Real-page element counts are from professional experience, not measured
  here.** The claim that a real application page exceeds 600
  `CANDIDATE_SELECTOR` matches is a judgement. The bound is 600; the largest
  fixture pool is 19; the gap is what matters, and its exact size on any given
  real page is unmeasured.
- **I did not read** the MVP planning documents, the rest of the working
  document beyond `live-validation-plan.md`'s head and `open-questions.md`'s
  index, or Core's own sources. Core's weights are taken from
  `v-drift-fixture.md` rather than from `fluxiq/automation-studio/fingerprinting`
  directly.

## 7. Open questions this raises

1. **Should the score floor be a single constant across both arithmetic
   regimes?** §3.2 argues the same 0.35 is correct for identifier-bearing
   recordings and permissive for thin ones. A floor that scaled with the
   recording's identifier weight would be one number, not two — but it is a
   change to `content/identity/`, which I do not own and which needs the numbers
   in §3.1 measured rather than derived.
2. **`elementContext` is captured and never scored.** §3.3. On a grid this is
   the difference between "ambiguous" and "resolved", and the fixture built to
   prove context works (`ambiguous-targets/form-context`) proves it through a
   different mechanism than the one its comment claims.
3. **`MAX_SCANNED` does not bound what its comment says it bounds**, and its
   break sits before the family filter, producing a false zero-candidate
   diagnostic. §2.4.
4. **The merged multi-frame element list is uncapped** while every evidence
   collection beside it is budgeted. §2.4.
