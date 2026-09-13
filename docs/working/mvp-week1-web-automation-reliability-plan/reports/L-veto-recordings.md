# Report: L-veto-recordings

Worker: `L-veto-recordings`. `L-review`'s finding 1 — the Level 1 veto's proof
was exhaustive over the candidate and silent about the recording. Re-run over
the recording axis, decided, and D14 corrected.

## Outcome

**Done.** The gap is real, wider than `L-review` measured, and closed for 15 of
the 16 recording classes at no measured cost in legitimate resolutions.

- **`L-review` is right, and understated it.** Rule 1 — refuse below a score of
  0 — separates impostors from drift for **3 of 16 recording classes**, not for
  recordings generally. The three are the ones carrying a stable identifier
  *and* both text signals. In the other 13 an impostor a weak query lands on is
  acted on; the worst reaches **+0.563**. `L-review`'s +0.010 is one cell of
  that table and it reproduces exactly.
- **A second rule closes 12 of the 13, and measurement says it is free.** If the
  recording named anything distinguishing — visible text, accessible name,
  label, id, test id — at least one of them must *agree* on the candidate.
  Over the whole enumeration that refuses **240 impostor profiles** and **zero**
  profiles whose label agrees or partly agrees. None of the 240 comes back
  through Level 2 either: the highest scores 0.302 against a 0.35 floor.
- **The brief's first option was measured and rejected.** Refusing class-set and
  bare-text matches outright on an identifier-less recording costs **306
  legitimate resolutions** — 115 whose label agrees exactly — to stop 84
  impostors, and 16 of those impostors return through Level 2 regardless. That
  is exactly the trade the brief warned against.
- **One recording class cannot be protected and is now named rather than
  missed.** A recording with no text, no accessible name, no id and no test id
  asked no question a candidate could answer. Refusing there would be the
  class-set strategy disagreeing with itself, and Level 2 would resolve the same
  impostor anyway.
- **All four `identity-drift` modes still resolve.** Each keeps a text signal or
  an id, and either is itself the corroboration; that is asserted in T1 and
  exercised in the content harness.

The measurements are Core's own scorer, imported and called — not a replication.
`scoreElementFingerprintCandidate` from `fluxiq/automation-studio/fingerprinting`
resolves through `apps/extension/node_modules`, so the enumeration runs the
function the extension ships with. Nothing in `F:\!FluxIQ` was read for
arithmetic and nothing there was written.

---

## 1. The enumeration, over the recording axis

### What was varied, and how it is bounded

`v-level1-veto` enumerated the **candidate** against one recording. This
enumerates the **recording** as well, and re-enumerates the candidate inside
each.

**The recording axis, 16 classes.** Each of `id`, `testId`, visible text and
accessible name present or absent. The other recorded fields are not free —
`describe-element.ts` derives them: `selectorFor` yields `#id`, then
`[data-testid=…]`, then a structural path, so the recorded selector follows the
identifiers; the class set and the tag are always there. Two of the 16 rows are
awkward for a `<button>` specifically (a name-from-content element with text
always has an accessible name), but they are producible by other elements — a
`<div onclick>` with text carries `visibleText` and no name — and the arithmetic
is what the row is for.

**The candidate axis, inside each class.** Five text rungs per text signal the
recording carried (exact 1.00, containing 0.82, reworded 0.667, contradicting
→ −0.55, missing → −0.45); three states for each identifier (agrees,
contradicts, absent); two roles; five class-set relations; visible or not. A
candidate's selector is derived the way `candidateFingerprint` derives it —
`#id`, then `[data-testid]`, then nothing — rather than varied freely, so no
profile is scored that the browser could not produce.

**Reachability.** A weak query is reached only when every stronger one missed,
which is most of what shrinks the space: the recorded id and test id cannot
agree on the candidate (the id and test-id queries would have answered first),
an authored accessible name cannot agree (the name query would have), the
class-set query requires the candidate's classes to be a superset of the
recorded ones, and the bare-text query requires the text to match exactly *and*
the class set not to.

**Populations,** as `v-level1-veto` split them: *agrees* is any text signal the
recording carried matching at Core's exact rung; *contradicts or gone* is every
one of them either contradicting or missing; *partly agrees* is the band between.

### The table

`class` and `text` are the reachable profile counts per query. "Worst impostor"
is the highest score in the *contradicts or gone* population — the number that
must stay below the line for rule 1 to be doing its job. "Acted" counts that
population's profiles a replay would click today.

| Recording | class | text | Worst impostor | Acted | After corroboration |
| --- | --- | --- | --- | --- | --- |
| id + testId + text + name | 672 | 192 | **−0.032** | 0 | 0 |
| id + testId + text | 160 | 48 | +0.053 | 6 | 0 |
| id + testId + name | 128 | 0 | +0.053 | 6 | 0 |
| id + testId | 32 | 0 | +0.182 *(veto never ran)* | 32 | 0 |
| id + text + name | 672 | 192 | **−0.015** | 0 | 0 |
| id + text | 160 | 48 | +0.101 | 16 | 0 |
| id + name | 128 | 0 | +0.101 | 16 | 0 |
| id | 32 | 0 | +0.302 *(veto never ran)* | 32 | 0 |
| testId + text + name | 672 | 192 | **−0.016** | 0 | 0 |
| testId + text | 160 | 48 | +0.097 | 16 | 0 |
| testId + name | 128 | 0 | +0.097 | 16 | 0 |
| testId | 32 | 0 | +0.290 *(veto never ran)* | 32 | 0 |
| **text + name (no identifier)** | 672 | 192 | **+0.010** | 4 | 0 |
| text only | 160 | 48 | +0.183 | 32 | 0 |
| name only | 128 | 0 | +0.183 | 32 | 0 |
| **nothing named** | 32 | 0 | **+0.563** *(veto never ran)* | 32 | **32** |

**The first row reproduces `v-level1-veto` exactly** (−0.032, zero acted), and
the thirteenth reproduces `L-review`'s +0.010 exactly. Those two agreements are
what validate the machinery; everything else in the table is new.

**Which recordings rule 1 separates, stated plainly.** Only the three rows in
bold negative: a recording carrying a stable identifier *and* both text signals.
Every other class has at least four impostor profiles a replay clicks. Three
classes never even reach the veto, because its precondition asked for a recorded
*label* and these have none.

**Why the thin recordings score higher, not lower.** `normalizedScore` is
`total / possible`, and `possible` accumulates only for signals the *recording*
carried. Drop the id and the test id and the impostor loses 2.6 + 2.8 of
penalty *and* the denominator loses 54, so the constant positives every
candidate collects — role 10, tag 7, class 5, visibility 4 — weigh far more.
The worst impostor is always the same shape: a **nameless** control wearing the
recorded class set. Core charges a *missing* text signal −0.45 and a
*contradicting* one −0.55, so answering nothing is cheaper than answering
wrongly, and the least informative candidate on the page is the one that scores
best. That is the whole mechanism of the hole.

**One incidental finding.** For an identifier-less recording the recorded
selector is a structural path, and `candidateFingerprint` never emits one, so
*every* candidate takes −0.25 × 14 on that signal. It discriminates nothing —
but dropping it from `comparableFingerprint` would move the worst impostor from
+0.010 to +0.060, so the noise is currently helping. Left alone, and named here
so nobody "cleans it up".

---

## 2. The decision

### What was chosen: corroboration, as a second rule

> If the recording named anything distinguishing — visible text, accessible
> name, label, id, test id — at least one of them must agree on the candidate.
> A match that answers none of them is refused whatever it scores.

"Agree" is read off Core's own verdict: the signal appears in
`positiveContributions`. That is exactly the right cut and it is Core's, not a
second scorer's — a text signal is positive only from Core's 0.35 similarity
rung upwards, an identifier only when it matches. So a relabelled button whose
new words still overlap the recorded ones corroborates; a missing or
contradicted one does not.

**Cost, measured over the whole enumeration.**

| | Refused by the rule | Of those, re-resolved by Level 2 |
| --- | --- | --- |
| label agrees | **0** | — |
| label partly agrees | **0** | — |
| label contradicts or is gone | **240** | **0** (highest 0.302, floor 0.35) |

The zero in the first row is not luck, it is construction: a label that agrees
*is* the corroboration, so the rule cannot refuse a profile in that population.
That is the argument for the rule, and the enumeration only confirms it.

**What it changes in `v-level1-veto`'s published corpus.** Nothing that was
clicked stops being clicked, except the two rows that report were open about:
limit 1's second measurement — the recorded `aria-label` gone and the class set
reused on "Delete workspace", **0.145, acted on** — is now refused. Limit 1's
first measurement (the recorded name reused on a destructive control, 0.641) is
*not* closed and should not be: the label does corroborate, which is limit 2 and
is inherent. The `id-reused-destructive` and `testid-reused-destructive` rows
(0.220 and 0.108) still click, unchanged, for the same reason.

**One consequence worth flagging to the supervisor.** The rule's precondition is
wider than the old one: an identifier counts, not only a label. So the veto now
runs against text-less recordings, and it runs on every strategy including
`coordinates` and `visual-target`. A command carrying a *fresh* point beside a
*stale* identifier-only descriptor will be refused where it used to be clicked.
This extends an exposure D14 already accepted — `L-review`'s open question 3 and
`v-level1-veto`'s per-strategy table both name it — rather than creating one,
and the widening is what buys the three identifier-only rows (96 impostor
profiles, worst +0.302, none recovered by Level 2). If the supervisor would
rather not extend it, narrowing the precondition back to "a label was recorded"
keeps 144 of the 240 refusals and gives up those 96; it is a one-line change in
`recordedDistinguisher`.

### What was measured and rejected: refuse the weak queries outright

The brief's first option — refuse a class-set or bare-text match when the
recording carries no stable identifier — applies to the four identifier-less
classes. A veto demotes rather than aborts, so Level 2 gets the same element
afterwards at its 0.35 floor; the cost is what Level 2 cannot recover.

| Recording | Acted today | Lost outright | Recovered by Level 2 | Of the lost: agrees / partly / impostor |
| --- | --- | --- | --- | --- |
| text + name | 772 | 310 | 462 | 115 / 191 / 4 |
| text only | 176 | 39 | 137 | 0 / 7 / 32 |
| name only | 96 | 39 | 57 | 0 / 7 / 32 |
| nothing named | 32 | 16 | 16 | 0 / 0 / 16 |

**306 legitimate resolutions lost to stop 84 impostors**, and 16 impostors
survive anyway because Level 2 re-resolves them. On the class this option was
aimed at hardest — a recording that names nothing — it stops half the impostors
and Level 2 puts the other half straight back. A common failure for a rare wrong
click, which is the trade the brief said to avoid. Rejected on the numbers.

### What was accepted and documented: the recording that names nothing

No text, no accessible name, no id, no test id: a class set and a structural
path. Both rules decline, and correctly. There is no question for a candidate to
answer, so a refusal would only be the class-set strategy disagreeing with
itself; and the same impostor scores +0.563, well over the Level 2 floor, so
refusing at Level 1 hands it to Level 2 which resolves it. Closing this needs a
different mechanism — Level 2's ambiguity margin, or a recorder that refuses to
record a control it cannot name — not a stronger veto. Named in D14 and pinned
by a T1 row so reopening it is deliberate.

---

## 3. What changed

| File | Change |
| --- | --- |
| `apps/extension/src/content/identity/veto.ts` | The corroboration rule, and the two-rule structure. `TargetVeto` gains `reason` (`contradicted` \| `uncorroborated`); a new pure `vetoCandidate(target, candidate)` holds the whole policy over what Core scores, and `vetoExactMatch` is the DOM-facing wrapper that adds the sentence. The precondition widens from "a label was recorded" to "anything distinguishing was recorded", and is asked in both functions — `candidateFingerprint` reads layout, and this is on every action's critical path. The header is rewritten: what rule 1 was proved over, what it was not, the recording-axis result, and the rejected alternative with its cost. |
| `apps/extension/src/content/identity/score.ts` | Comment only: `IDENTITY_SIGNALS` now says why `veto.ts` keeps a narrower list of the same kind — this one asks whether there is anything worth scoring and counts the selector and class names, the veto asks what *corroborates* a match already made on those two. |
| `apps/extension/src/content/identity/index.ts` | Exports `vetoCandidate` and the two new types; the barrel comment names the second rule. |
| `apps/extension/src/content/action-runtime/resolve-target.ts` | Two comments: the header and the veto call site now say a match is refused for answering nothing, not only for contradicting. No behaviour change here. |
| `apps/extension/src/content/identity/tests/veto.test.ts` | Every existing row now asserts `vetoCandidate` as well as the score, so the whole policy is pinned rather than the number rule 1 reads. Five new rows: two thin recordings where the score is on the *acting* side and the corroboration rule is what refuses (each asserts the score is ≥ the floor first, so the row fails loudly if it ever stops being the rule that matters); one that the two drift shapes an identifier-less recording survives by are kept; one pinning the unprotectable class as a decision. The old "no label" precondition row is updated — an identifier-only recording *is* checked now. |
| `apps/extension/e2e/content/tests/identity-resolution.spec.ts` | One row in real Chromium: the identity-drift Save recorded with its id and test id removed, replaced by a nameless icon button wearing `btn btn-primary`. The row asserts the recorded structural selector and xpath both miss — so the class-set query is provably the one that answered — and then reads the score out of the refusal message and asserts it is **≥ 0**: the match was on the acting side and was refused anyway. Plus a header paragraph on the second rule. Also, forced by a parallel change and not by this one, the `reworded-aria` row's `expect(reply.resolution).toBeUndefined()` is inverted — see the commands section. |
| `docs/working/…/mvp-week1-web-automation-reliability-plan.md` | **D14 only.** Rewritten to say what was proved over which axis, the 3-of-16 result, the second rule and its measured cost, the rejected alternative, the unprotectable class, and the coordinate consequence. |

---

## Commands run and observed results

`EXTENSION_TEST_BUILD_LABEL=l-veto-recordings` for every extension command. The
brief wrote it capitalised; `scripts/test-extension.mjs` requires lowercase
kebab-case and throws otherwise, so the lowercase form is what was used. No
`pnpm lab`, no `pnpm build`, no root `pnpm check`, nothing written in
`F:\!FluxIQ`. Exit status was captured by redirecting to a file and echoing
`$?`, never through a pipe.

| Command | Exit | Observed |
| --- | --- | --- |
| `node .test-build-scratch/l-veto-probe/enumerate.mjs` (16 recordings × their reachable candidate profiles, through Core's `scoreElementFingerprintCandidate`) | **0** | Every table above. Reproduces `v-level1-veto`'s −0.032 and `L-review`'s +0.010 to three decimals. Run twice, hours apart; `diff` of the two outputs is empty. |
| `pnpm --filter …/extension check` | **0** | `tsc -p tsconfig.json --noEmit && tsc -p tsconfig.test.json`, no diagnostics. Six runs through the task, four of them red — see below; the last two are clean, and the two `tsc` projects were also run separately, both **0**. |
| `pnpm --filter …/extension test` | **0** | Final run `# tests 268 / # pass 268 / # fail 0`. It read 253/253 when this change was complete and 268 an hour later; the extra 15 are a parallel worker's. One earlier run exited **1** with four failures, all mine and all one cause: `vetoExactMatch` built the candidate fingerprint as a call argument, so it ran *before* the precondition could decline and a recording that names nothing reached the DOM. Fixed by asking the precondition in the wrapper as well; that is now a deliberate property, commented. |
| `pnpm --filter …/extension run test:content --workers=4 content/tests/identity-resolution.spec.ts` | **0** | `21 passed (12.8s)` — all four drift modes, the three existing veto rows, and the new one. Three earlier runs failed: **18 of 21** on a half-converted tree (below), then **2** (one mine, one a parallel change's), then **1** (mine). |
| `pnpm --filter …/extension run test:content --workers=4` (full) | **0** | `195 passed, 1 skipped (44.4s)`. |

### The new spec row failed twice before it passed, and both were real

Worth recording because both are traps for the next person writing a veto row.

- **The recorded structural selector still matched.** `selectorFor` had produced
  `main > form > section:nth-of-type(1) > div > button:nth-of-type(1)`, and with
  Save removed, Discard became `button:nth-of-type(1)` in that div. The
  selector sub-query answered before the class set did and rule 1 refused
  Discard — the row would have passed for the wrong reason had it not asserted
  the selector misses. Fixed by emptying the old slot.
- **A candidate below the fold loses Core's visibility weight.** With the icon
  button in the page footer the refusal read `scoring -0.04`, not `+0.01`:
  `isVisibleOnViewport` was false, which costs 4 from the total *and* 4 from the
  denominator and pushes the profile under the threshold — rule 1 again. Moved
  to the header. This is the enumeration's `visible` axis showing up in a real
  browser, and it is why the row asserts the score is ≥ 0 rather than just
  asserting a refusal.

### The tree was broken under me three times, by parallel workers

The first content-harness run exited **1** with **18 of 21 failed**, including
rows I had not touched (`long-document`, `ambiguous-targets`, all four drift
modes), every one `element.getBoundingClientRect is not a function` out of
`web.dom.extract`. Not this change. A parallel worker was mid-flight converting
`resolveTarget` to return `{ element, resolution }` — the D1 "resolution on a
successful result" work — and the harness builds the content bundle from the
live source tree at run time, so it bundled a half-converted tree.
`pnpm …/extension check` had exited **0** minutes earlier and exited **2**
immediately after, on `actions/assert.ts(112,14)`, then on
`action-runtime/tests/resolve-target.test.ts(27,10)`, and later on four errors
in `background/connection/recording-start/tests/handshake.test.ts` — a third
worker. None of those files are ones I changed. Each time I waited for the tree
to typecheck cleanly rather than touching their files, and re-ran.

**One integration fix that change forced on me.** With `resolution` now reported
on a successful result, `identity-resolution.spec.ts`'s `reworded-aria` row —
which asserted `reply.resolution` is `undefined`, deliberately, to keep the gap
visible — began failing. That file is mine, so I inverted the assertion rather
than leaving a red row: it now pins `scored-candidate`, two candidates, a best
score over the 0.35 floor and a negative runner-up. If that worker also updates
it, the two edits are the same edit seen from opposite sides.

**The reproduction script** is at
`apps/extension/.test-build-scratch/l-veto-probe/enumerate.mjs` — inside a
gitignored directory, and not the label directory `pnpm test` clears, so it
survives. Deleting it costs nothing; keeping it means the recording-axis table
can be regenerated in a second the next time Core's weights move.

---

## Not verified

- **No live browser validation of a real replay.** Everything ran in the T2
  content harness and in the enumeration. No extension, no background worker, no
  gateway, no Flow.
- **The enumeration is a model of reachability, not an observation of it.** Which
  profiles a weak query can land on is derived by reading `element-finder.ts`
  and `candidates.ts`, not measured against a corpus of real pages. If a query
  can be reached some way I did not model, its profiles are missing from the
  table.
- **The recording axis is 16 classes of one control.** A `<button>` on the
  identity-drift page, with its signals switched on and off. Whether those 16
  are representative of real recordings is exactly what nothing here answers —
  the same caveat `v-matcher-calibration` and `v-level1-veto` both recorded.
- **The coordinate consequence is reasoned, not measured.** No row exercises a
  `coordinates` command carrying a stale identifier-only descriptor.
- **No cost in time.** The corroboration rule reads a field on a score that was
  already computed, so it is free by inspection; unmeasured in fact.
- **Root `pnpm check`, `pnpm test` and `pnpm build` were not run.** Parallel
  workers are mid-edit across `domain/`, `packages/test-runner/` and
  `scripts/lab/`. `scripts/structure-audit.mjs` was not run either, and two
  advisories are worth naming since I made one of them worse:
  `mvp-week1-web-automation-reliability-plan.md` is **794 lines** against the
  800-line compaction threshold — it passes today, and D14's rewrite is net +18,
  so there is almost no headroom left for the next worker;
  `identity-resolution.spec.ts` is **715 lines**, past the 400-line advisory,
  and **174 of the growth is mine**. `v-level1-veto` already said the fix is to
  split the veto group into its own spec file and that a new `e2e/` file was
  outside its Owns; it is outside mine too, and it is now overdue.
- **Cross-frame resolution.** Single-document by construction, as before.

## Open questions or contradictions found

1. **An ownership collision the supervisor should know about.** My brief gives
   me `apps/extension/src/content/action-runtime/resolve-target.ts` and "tests
   beside each". A parallel worker rewrote that file and
   `action-runtime/tests/resolve-target.test.ts` while I held them, converting
   `resolveTarget`'s return type and deleting `resolveTargetWithDiagnostics`.
   My edits there are comment-only and merged cleanly with theirs, so nothing
   was lost — but two briefs held the same file, which the protocol says makes
   the work serial.
2. **Should the precondition have widened?** Rule 2 needs a question to have
   been asked, and I let an identifier count as one. That is what closes the
   icon-button recordings (96 profiles, worst +0.302), and it is also what puts
   the veto in front of a fresh coordinate paired with a stale descriptor. Both
   halves are the supervisor's to ratify; the narrow version is one line.
3. **Core's asymmetry is still the root cause and still Core's.** A candidate's
   *extra* signals are never compared, because `compareTextSignal` returns early
   when the recording lacks one. That is why a thin recording is thin: it cannot
   be contradicted, only unanswered. `v-level1-veto` raised it, D13 settled the
   weights without touching it, and the corroboration rule is a downstream
   compensation rather than a fix. Whoever owns `element-fingerprint.ts` should
   see the recording-axis table.
4. **The unprotectable class deserves a recorder-side answer.** A control with
   no text, no name and no identifier is one a person cannot describe either. A
   recorder that warned at capture time would be worth more than any resolver
   rule, and it is the only route I can see to closing that row.
5. **`v-level1-veto`'s "1,488 / 240" should not be quoted without its axis
   again.** The numbers are right and I reproduced the score they bound. It is
   the word *exhaustive* that was doing the damage: true of the candidate,
   silent about the recording, and read as covering both — by D14, by
   `veto.ts`'s header, and nearly by me.
