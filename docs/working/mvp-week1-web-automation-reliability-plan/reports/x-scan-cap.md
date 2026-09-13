# x-scan-cap — the scan cap, the unscored context, and the uncapped frame merge

Worker `x-scan-cap`, 2026-09-12. Three defects from `reports/r-fixture-audit.md`
§2.4, §3.3 and §3.5, all in the resolution and evidence path, all invisible on a
page the size of a Lab fixture.

Two of the three are fixed in code. The third is answered with a measurement
and a comment rather than with wiring, because the measurement says wiring it
would change nothing.

---

## Outcome

| Defect | Outcome |
| --- | --- |
| 1. The scan cap produces an empty pool and lies about why | **Fixed**, and proven on a real 6,000-element Chromium page |
| 2. Captured positional context never reaches the scorer | **Answered, not wired** — Core has no positional signal, and the one slot it does have cannot move a decision. Measured. |
| 3. One uncapped collection among budgeted siblings | **Fixed**, proven by unit test only — the Lab has no multi-frame page big enough |

---

## Defect 1 — the scan cap

### What was wrong

`collectTargetCandidates` (`content/identity/candidates.ts`) walked the page's
`CANDIDATE_SELECTOR` matches in document order and broke at `MAX_SCANNED = 600`
**before** testing family membership. The 600 was therefore spent on whatever
came first on the page, not on the family, so a page whose target's family began
past the six-hundredth interactive element enumerated nothing. `resolveTarget`
then reported, at `resolve-target.ts`'s `notFound`:

```
nothing matched; 0 control(s) of the same family are on the page
```

That is a statement about the page, and on such a page it is false. The scan
stopped; the controls were there. A Flow reads that field to decide between
widening its target and rewriting the step, and a person reads it and goes
hunting for a fault in a selector that was correct.

### What changed

**`content/identity/candidates.ts`**

- `collectTargetCandidates` returns a `TargetCandidatePool`
  (`{ candidates, examined, truncated }`) instead of a bare array. `truncated`
  is set by either cap — `MAX_SCANNED` when the page holds more interactive
  elements than the filter looked at, `MAX_CANDIDATES` when the family itself
  is longer than the scorer is given — and is decided against the NodeList's own
  length, so a page holding *exactly* a cap's worth is reported complete.
- `MAX_SCANNED` is 600 → **5,000**, and its comment now says what it bounds.
  The old comment claimed it stopped "a full-document walk"; it did not.
  `querySelectorAll` has already materialised the whole NodeList before the loop
  starts, so the loop bound saves a tag comparison and at most one
  `getAttribute` per element. The bound that costs anything is `MAX_CANDIDATES`,
  because `candidateFingerprint` (a `getBoundingClientRect`, an accessible-name
  computation, a `textContent` read) runs only on family members and is
  unchanged at 60.
- It **stays a hard bound**, as the brief allows: a page can hold a hundred
  thousand anchors and one click must not walk all of them. 5,000 is sized
  against what the same page already pays on the same event — `content/dom-snapshot.ts`
  walks up to `MAX_SNAPSHOT_SCAN_ELEMENTS = 50_000` and `content/evidence/repeating.ts`
  up to 2,000 per capture — so resolution now looks at an order of magnitude
  fewer elements than the capture beside it. When it does bite, it says so.

**`content/action-runtime/resolve-target.ts`**

- `notFound` takes the pool rather than a count, and `familySeen` produces one
  of two sentences:
  - complete scan: `N control(s) of the same family are on the page` (unchanged);
  - cut short: `N control(s) of the same family in the first 5000 interactive element(s); the scan was cut short there, so the page may hold more`.
- `candidateCount` on the resolution is `pool.candidates.length`, as before.

**`content/identity/index.ts`** re-exports `TargetCandidatePool`.

### Why the bound was raised, measured

The bound exists to keep resolution off the critical path, so the raise had to
be answerable in time. Four runs of the same 5,000-interactive-element page in
the content harness, `executeAction` round trip for a target nothing can find:

| `MAX_SCANNED` | Round trip (ms) |
| --- | --- |
| 600 | 3,562 · 4,629 · 6,586 · 7,517 |
| 5,000 | 3,396 · 4,480 · 4,502 · 6,623 |

The distributions are indistinguishable. Scanning 4,400 more elements does not
show above the noise.

**The noise itself is the more interesting number, and it is not mine.** On the
same 5,000-element page:

| Action | Round trip |
| --- | --- |
| click a real button by exact selector | 5,299 ms |
| the miss above (enumerates the whole page) | 3,504 ms |
| `web.dom.extract` by exact selector (enumerates nothing) | 3,503 ms |
| bare `captureSnapshot`, no action at all | 4,058 ms |

An action that does no target enumeration costs the same as one that enumerates
everything, and a snapshot with no action at all costs as much again. **The
seconds are the DOM snapshot and page evidence every result carries, not target
resolution.** On the fixture-sized page the same actions are 31–68 ms. See the
open questions.

Because of that, the content spec deliberately carries **no timing assertion**:
a ceiling there would pin `content/dom-snapshot.ts`'s cost inside a file about
the resolver. The numbers live in the spec's comment and here.

### Tests

- `content/action-runtime/tests/resolve-target.test.ts` — two rows. A stub page
  of 6,000 anchors against a recorded `button` must report the scan as cut
  short; a 100-anchor page must still say plainly that no such control is on it.
  The stub is as thin as the family filter is (`{ tagName: "A" }`), because
  `inFamily` reads nothing else when the recorded family names no role.
- `e2e/content/tests/large-page-resolution.spec.ts` — **new**, three rows, real
  Chromium, real content bundle. Interactive filler anchors are injected into an
  existing scenario rather than a fixture being added, so no scenario file was
  touched:
  1. `identity-drift` in `reworded-aria` with **3,000** filler anchors ahead of
     the control: the scored recovery still happens and the fixture records the
     save. Under the old bound the scan stopped 2,400 elements short and this
     command failed `TARGET_NOT_FOUND` with an empty ranking. This is the row
     that shows the defect changed *outcomes*, not only messages.
  2. **6,000** filler anchors and an unfindable target: the failure says the
     scan was cut short and does **not** say "are on the page".
  3. No filler: the ordinary diagnostic is unchanged.

### Failing before the change

Both source hunks were reverted (`candidates.ts` restored from `HEAD`,
`resolve-target.ts` reverse-edited), the unit rows run, and the fix restored
from a snapshot. Observed:

```
not ok 126 - a page whose family the scan never reached says the scan was cut short, not that the page is empty
  error: The input did not match the regular expression
    /0 control\(s\) of the same family in the first 5000 interactive element\(s\)/u. Input:
    'nothing matched; 0 control(s) of the same family are on the page'
```

That is the defect, reproduced verbatim.

---

## Defect 2 — positional context and the scorer

**The answer is that Core's matcher cannot weigh it, and that the recorder is
not paying for nothing.** No wiring was added; nothing was removed. What was
added is the reason, in the module where the next reader will look for it.

### Core has no positional signal

Read at `F:\!FluxIQ\packages\fluxiq\src\programs\automation-studio\fingerprinting\element-fingerprint.ts`
and measured against the built package:

- `ElementFingerprint` has no positional field, and `ElementFingerprintWeights`
  names nineteen signals — `visibleText, accessibleName, label, id, testId,
  automationId, entityId, statePath, role, tagName, entityKind, selector,
  queryPath, xpath, url, classNames, bounds, attributes, visibility` — of which
  none is positional. There is nothing to send `listPosition` and
  `tablePosition` *as*.
- The one extensible slot Core scores is `attributes`, weight **6 of 292**.

### And it could not move a decision if it were wired

Measured with the real matcher against a production-shaped grid — two identical
row actions, no test id, no author id, one hashed class, the same text and
accessible name — against `TARGET_SCORE_FLOOR = 0.35` and
`TARGET_SCORE_MARGIN = 0.2`:

| Case | row 7 | row 8 | separation | outcome |
| --- | --- | --- | --- | --- |
| today (no positional context) | 1.0000 | 1.0000 | 0.0000 | ambiguous |
| position via `attributes`, both sides | 1.0000 | 0.9630 | **0.0370** | ambiguous |
| position on the recording only | 0.9100 | 0.9100 | 0.0000 | ambiguous |
| best case the slot allows (only the right row carries it) | 1.0000 | 0.9100 | **0.0900** | ambiguous |

A winner must beat the runner-up by 0.2. The most positional context can
contribute through the only slot available is 0.09. **Wiring it would add a
signal to every candidate on every resolution and change no decision.**

### They are captured for a reader that can use them

The audit's §3.3 is right that no *resolver* module reads `descriptor.context` —
and it is worth stating that this does not make the capture waste.
`domain/src/runtime/llm-evidence/elements.ts` reads `listPosition` and
`tablePosition` into every element of the LLM evidence packet as `item` and
`cell` (`listPlacement` / `tablePlacement`, lines 193–194). So the recorder pays
for them and the model spends them.

### What was written down

A paragraph on `candidateFingerprint` in `content/identity/candidates.ts` — the
counterpart that would have had to produce the candidate side — recording the
nineteen signals, the 6-of-292 slot, the 0.0370 and 0.0900 separations against
the 0.2 margin, where the fields *are* consumed, and that making a grid row
resolvable by position needs a positional signal **in Core's matcher** with
weight enough to clear the margin. `identity/score.ts` is the other natural home
and is on this brief's must-not-touch list.

---

## Defect 3 — the uncapped merged element list

`captureMergedTabSnapshot` took `...elements` from every frame that answered
while every collection beside it — dialogs, blockers, busy regions, indicators,
regions, repeating structures, forms — had a cross-frame budget.

- `MAX_MERGED_ELEMENTS = 4_000`, twice the per-frame `MAX_SNAPSHOT_CANDIDATES`
  (2,000), which is the rule the file already states for every budget above it.
- The drop is reported through **the flag that already means this** —
  `evidence.elements.truncated` — not a fourth name. That is what the truncation
  rule in `domain/src/recording/web-state/evidence/input.ts` assigns to a
  capture's element cap. `returned` is reduced by what was dropped so it counts
  the elements the payload actually carries; `matched` stays the pre-cap total,
  so the size of the drop is readable as `matched - returned`.

### One thing I built and then took out

I first reordered the merged elements to put the top frame's first, so a cap
would drop child frames rather than the page's own controls. It broke
`background/connection/tests/recording-evidence.test.ts:188`, which pins the
existing order as a deliberate property: *"The frame the event came from leads,
because its snapshot is the seed the merge is given."* That is a documented
behaviour, the seed frame is the frame the interaction happened in, the reorder
was not in my brief, and fixing the test would have meant editing a file I do
not own. **Reverted.** The hazard it was addressing is real and is an open
question below.

### Tests

Three rows in `background/connection/tests/dom-snapshot.test.ts`: the list is
bounded at 4,000 across four frames offering 5,500; the drop is reported
(`returned` 4,000, `matched` 5,500, `truncated` true); a merge under the bound
is untouched. Failing before the change, observed:

```
not ok 40 - the merged element list is bounded across frames, as every collection beside it is
  error: the merged element list is unbounded
    5500 !== 4000
not ok 41 - what the merged cap dropped is reported, not silently absent
  error: returned must count the elements the payload carries
    5500 !== 4000
```

---

## Which of the three were proven on a page big enough to trigger them

The brief asked for this plainly, so plainly:

- **Defect 1: yes.** Real headless Chromium, the real content-script bundle, a
  page carrying 3,000 and 6,000 interactive elements. Both the recovery and the
  honest diagnostic are observed end to end through `executeAction`, and the
  timing question was measured rather than argued.
- **Defect 3: no.** The bound and its reporting are proven by unit test against
  a synthetic four-frame transport. **No browser evidence exists**, because the
  Lab's only multi-frame scenario is `iframe-checkout` — two frames of six
  elements each — and building a page whose frames hold thousands would mean
  adding or editing fixtures, which this brief forbids. What is unproven is
  therefore not the arithmetic but the premise: that a real page's frames
  contribute enough elements for 4,000 to bite, and that 4,000 is the right
  number rather than a guess consistent with its siblings.
- **Defect 2: measured, but not on a page.** The numbers come from Core's real
  matcher on synthetic candidates shaped like a production grid row, not from a
  rendered page. The conclusion — 0.09 maximum separation against a 0.2 margin —
  is arithmetic Core performs, so a page would not move it; but no grid with
  thirty identical row actions was ever rendered and resolved against.

---

## Commands run and observed results

All from `F:\!FluxIQWebExtension` with `EXTENSION_TEST_BUILD_LABEL=x-scan-cap`
and `DOMAIN_TEST_BUILD_LABEL=x-scan-cap`. Exit statuses taken by redirecting to
a file and reading `$?`, never through a pipe. No `pnpm lab` command and no
`pnpm build` was run.

| Command | Exit | Observed |
| --- | --- | --- |
| `pnpm --filter …/extension check` (**baseline, before any edit**) | 2 | `src/content/actions/tests/page-identity.test.ts(101,15)` and `(101,24)`: TS7006 ×2 |
| `pnpm --filter …/extension test` (**baseline**) | 1 | 281 tests, 280 pass, **1 fail**: `page-identity.test.ts` — "with no page to read, the question is not asked and nothing is substituted" |
| `pnpm --filter …/domain check` (**baseline**) | 2 | `src/client/tests/gateway-mapping-identity.test.ts(80,35)`: TS2352 |
| `pnpm --filter …/domain test` (**baseline**) | 0 | 326 tests, 326 pass |
| `pnpm --filter …/extension test` (defect 1, sources reverted) | 1 | the new row fails: `'nothing matched; 0 control(s) of the same family are on the page'` |
| `pnpm --filter …/extension test` (defect 3, source reverted) | 1 | the two new rows fail: `5500 !== 4000` |
| `pnpm --filter …/extension check` (**final**) | 0 | clean |
| `pnpm --filter …/extension test` (**final**) | 0 | 288 tests, 288 pass, 0 fail |
| `pnpm --filter …/domain check` (**final**) | 0 | clean |
| `pnpm --filter …/domain test` (**final**) | 0 | 331 tests, 331 pass, 0 fail |
| `pnpm --filter …/extension test:content` (**final, whole harness**) | 0 | 201 passed, 1 skipped |
| `pnpm --filter …/extension test:content large-page-resolution` | 0 | 3 passed |
| `node scripts/structure-audit.mjs` | 0 | passed, 32 warnings, 17 baselined |

**Both baselines were red before I touched anything**, in files this brief does
not own (`content/actions/tests/page-identity.test.ts`,
`domain/src/client/tests/gateway-mapping-identity.test.ts` — both untracked, both
being edited mid-session by another worker). Both were green by the time I
finished, and not by anything I did: `page-identity.test.ts` changed on disk at
18:29 while I was working. The final green figures above are therefore green
including other workers' concurrent edits, not green in isolation.

One surprising failure was rerun, as the brief instructs. The first run of the
Core-matcher probe died with `ERR_MODULE_NOT_FOUND` for a `fluxiq` dist file
that exists and resolves; the identical rerun succeeded. Nothing was changed
between the two.

---

## Not verified

- **No browser evidence for defect 3.** See above. Unit test only.
- **No `pnpm build`, no `pnpm check` at the root, no Lab command**, per the
  brief. `pnpm check` additionally runs `pnpm structure:test`, `pnpm lab:test`
  and `pnpm -r check`; I ran the structure audit directly and both package
  `check`s, and left the rest to the supervisor.
- **I did not run `pnpm structure:baseline`**, though the audit reports "3
  baseline entries can be lowered". Those improvements are other workers'; the
  baseline file is shared and rewriting it concurrently would conflict.
- **`dom-snapshot.ts` is now 419 lines against the 400-line advisory
  threshold**, up from 398. The audit still passes — it is a warning, not a
  violation — but the warning is new and it is mine. 20 of the 30 added lines
  are the comments explaining the budget and the truncation flag; cutting them
  to satisfy a line count would be the wrong trade, and the real fix (splitting
  the frame merge out of this module) is a larger change than this brief.
  `resolve-target.ts` (580) and `connection.ts` (764) were already past it.
- **The 4,000 element bound is consistent, not measured.** It follows the file's
  "twice the per-frame cap" rule. Nobody has measured the payload size of a
  4,000-element merged snapshot, or what a real multi-frame page actually
  contributes.
- **The 5,000 scan bound is measured only for cost, not for sufficiency.**
  Whether a real application page's target family sits inside the first 5,000
  interactive elements is a judgement; the point of the change is that when it
  does not, the failure now says so.
- **The three new content-harness rows inject filler into `identity-drift`.**
  They prove the resolver at scale; they do not prove that a *recorded* replay
  against a genuinely large real-world page behaves this way, because injected
  anchors are uniform and a real page's 5,000 elements are not.
- **I did not touch** `identity/veto.ts`, `identity/score.ts`,
  `domain/src/sensitivity/`, `packages/`, or any scenario fixture.
  `domain/src/page-evidence/` needed no change: defect 2's answer required no
  contract change, and defect 3 reuses a flag the contract already has.

---

## Open questions this raises

1. **A failed action on a large page costs seconds, and it is not the
   resolver.** 3.5–5.3 s round trip on a 5,000-interactive-element page for
   every action shape measured, including one that resolves nothing and one that
   is only `captureSnapshot`; 31–68 ms for the same actions on the fixture. The
   cost is in `content/dom-snapshot.ts` and `content/evidence/`, which run on
   every action result and on every recorded event. On a real page this is the
   dominant latency in the whole path and nothing in the corpus has ever shown
   it. Outside this brief; worth a brief of its own.
2. **With a cap, the merged element list's order became a priority decision, and
   nobody has made one.** The order is "seed frame first, then whichever frame
   answered next", which was harmless while the list was unbounded and is now
   what decides who is dropped. Two frames of 2,000 elements answering before
   the top frame can crowd the page's own controls out of the payload entirely.
   The evidence collections in the same function deliberately put the top frame
   first; the elements deliberately do not, and
   `tests/recording-evidence.test.ts` pins that. Somebody should decide which
   rule the elements want now that a tail gets dropped.
3. **`elements.returned` on a merged snapshot can undercount a frame that sent
   elements but no page evidence.** Pre-existing, unrelated to the cap, and
   pinned by an existing row ("a top frame that reports no evidence falls back
   to the only frame that did" expects 2 while the payload carries 3). I left it
   alone rather than change a passing assertion outside the defect.
4. **Making a grid row resolvable by position is a Core change.** Defect 2's
   measurement says the browser side cannot do it: the maximum separation
   positional context can produce through Core's only extensible scored slot is
   0.09, and the resolver needs 0.20. If "the Edit button in row 7 of 40" is to
   be resolvable at all, `ElementFingerprintWeights` needs a positional signal
   with real weight — `fluxiq/automation-studio/fingerprinting`, not here.
5. **`MAX_SCANNED` and `MAX_CANDIDATES` now report truncation into a failure
   record's text, and nowhere else.** `BrowserActionTargetResolution` — which
   rides on every result, success or failure, and reaches a Flow through
   `domain/src/client/gateway-mapping.ts` — carries `candidateCount` with no
   indication of whether that count was complete. Adding a field there is a wire
   contract change across files this brief does not own. A Flow reading a
   *successful* scored resolution today cannot tell whether the winner beat the
   whole page or the first 5,000 elements of it.
