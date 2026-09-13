# Report: p-veto-coords

Worker `p-veto-coords`. Three things: the coordinate/visual-target consequence
`L-veto-recordings` left reasoned rather than measured, the supervisor's
mid-task addition (surface the score an accepted Level 1 match already has),
and the overdue split of `identity-resolution.spec.ts`.

## Outcome

**Done.** The measurement is not close, so the recommendation is implemented as
a decision recorded rather than as a code change: **keep the broad rule.**
`recordedDistinguisher` is unchanged.

- **The broad rule refuses no legitimate point replay that the narrow rule
  would keep. Zero, not few.** Over the point strategies it refuses **120
  profiles** the narrow rule would act on, and **not one of them carries any
  signal the recording named**. The reason is structural, not statistical: a
  point strategy runs only after the recorded selector missed, and
  `selectorFor` derives the recorded selector from the strongest identifier —
  so for a single-identifier recording, reaching a point *means* the one thing
  that could corroborate is already gone.
- **The premise of "narrow it" has no producer.** The argument was that a
  coordinate is a deliberate opt-out of identity matching. `coordinates` is a
  declared parameter of no web action, no producer in this repository emits
  one, and a hand-built coordinate command carrying no descriptor never reaches
  the veto at all. A `visual-target` *is* produced on the recorded path, but
  `webAutomationActionVisualTargetFromElement` derives it **from the recorded
  element**, so its point is exactly as stale as the descriptor beside it. The
  author never chose a point instead of identity; the point is a second view of
  the same capture.
- **What it costs is small, real, and now named.** Measured live with today's
  recorder across all 22 Scenario Lab fixtures: **29 of 587** interactive
  descriptors (4.9%) carry an identifier and no visible text, accessible name
  or label. For those — and only those — a replay whose recorded identifier has
  changed now fails `TARGET_NOT_FOUND` instead of clicking whatever holds the
  recorded position. Level 2 cannot recover them: the ceiling for an
  identifier-only recording is +0.302 against a 0.35 floor.
- **An exact Level 1 match now reports its measurement**, closing the last piece
  of D1. The veto already scored it; it discarded the number when it accepted.
- **The 715-line spec is three files**, split by subject with every assertion
  preserved: **97 `expect` tokens before, 97 after**, the same 19 test sites and
  6 describe blocks, and 23 runtime tests either way.

The enumeration calls Core's own scorer,
`scoreElementFingerprintCandidate` from `fluxiq/automation-studio/fingerprinting`,
resolved through `apps/extension/node_modules`, so the arithmetic is the
function the extension ships with rather than a replication. Nothing in
`F:\!FluxIQ` was written, and nothing there was opened or read for this work —
the scorer is imported and called.

---

## 1. The model validated first, then extended

`L-veto-recordings` left its probe at
`apps/extension/.test-build-scratch/l-veto-probe/enumerate.mjs`. Ran unchanged,
it reproduces its published table **exactly** — the first row's worst impostor
at **−0.032** and the `text + name` row at **+0.010**, both to three decimals,
all sixteen rows identical to the report. That is the machinery validated; the
extension below reuses the same recording axis, the same candidate rungs and
the same Core call.

### What changes for a point strategy, and why it is a different population

`L-veto-recordings` enumerated the two **weak** strategies — the class-set query
and the bare-text query. The point strategies reach a different space:

- **A point is unconstrained by identity.** `document.elementFromPoint` returns
  whatever is painted there, so neither the class-set superset requirement nor
  the exact-text requirement applies. The candidate axis opens right up.
- **A point resolves only something rendered**, so `isVisibleOnViewport` is true
  for everything it can reach — worth +4 to the numerator *and* the denominator,
  which moves every score.
- **The constraint that replaces them is the strategy order.**
  `resolve-target.ts` tries selector, then coordinates, then visual-target, then
  fingerprint. A point runs only when the recorded selector matched nothing.

That last point is the whole finding, so it is worth stating as a chain.
`describe-element.ts` `selectorFor` prefers `#id`, then `[data-testid=…]`, then
a structural path. So for a recording carrying one identifier, the recorded
selector *is* that identifier. The point strategy running at all means the
selector found nothing, which means that identifier is not on the page, which
means no candidate anywhere can carry it — and for a recording that named
nothing else, no candidate can corroborate. The corroboration rule therefore
refuses **everything** the point resolves for that class of recording, and it is
not discriminating between drift and impostor when it does so: it is declining a
class of recording that has run out of evidence.

**The counts are an upper bound.** Reachability is modelled candidate-side —
the candidate does not carry the recorded identifier — where the true condition
is that *no element on the page* does. Where some other element kept it, the
selector strategy answers first and the point never runs, removing profiles from
this population. Nothing is added by cases I did not model.

### The whole point-strategy table

`survivor` = at least one signal the recording named is still on the candidate,
which is what a legitimate drifted replay looks like from the fingerprint's
side. `impostor` = none is. BROAD is the rule as shipped (an identifier counts);
NARROW is the one-line alternative (only a label counts).

| Recording | point-reachable | survivors | survivors refused BROAD | survivors refused NARROW | impostors | impostors acted BROAD | impostors acted NARROW |
| --- | --- | --- | --- | --- | --- | --- | --- |
| id + testid + text + name | 1260 | 1140 | 250 | 250 | 120 | 0 | 0 |
| id + testid + text | 300 | 220 | 47 | 47 | 80 | 0 | 0 |
| id + testid + name | 300 | 220 | 47 | 47 | 80 | 0 | 0 |
| **id + testid** | 60 | 20 | **0** | 0 | 40 | **0** | **40** |
| id + text + name | 840 | 720 | 96 | 96 | 120 | 0 | 0 |
| id + text | 200 | 120 | 4 | 4 | 80 | 0 | 0 |
| id + name | 200 | 120 | 4 | 4 | 80 | 0 | 0 |
| **id only** | 40 | **0** | **0** | 0 | 40 | **0** | **40** |
| testid + text + name | 840 | 720 | 106 | 106 | 120 | 0 | 0 |
| testid + text | 200 | 120 | 6 | 6 | 80 | 0 | 0 |
| testid + name | 200 | 120 | 6 | 6 | 80 | 0 | 0 |
| **testid only** | 40 | **0** | **0** | 0 | 40 | **0** | **40** |
| text + name | 840 | 720 | 0 | 0 | 120 | 0 | 0 |
| text only | 200 | 120 | 0 | 0 | 80 | 0 | 0 |
| name only | 200 | 120 | 0 | 0 | 80 | 0 | 0 |
| nothing named | 40 | 0 | 0 | 0 | 40 | 40 | 40 |
| **totals** | **5760** | **4480** | **566** | **566** | **1280** | **40** | **160** |

**The two rules differ on three rows and nowhere else** — the three the broad
precondition newly covers. Every other row is identical in both columns, which
is the arithmetic saying what the code already said: where a label was recorded,
the precondition was already satisfied and nothing about this decision reaches
those rows.

### The disputed set, on its own

| Recording | point-reachable | survivors | survivors refused BROAD | impostors | impostors refused BROAD | impostors acted NARROW | worst of those |
| --- | --- | --- | --- | --- | --- | --- | --- |
| id + testid | 60 | 20 | **0** | 40 | 40 | 40 | **+0.182** |
| id only | 40 | 0 | **0** | 40 | 40 | 40 | **+0.302** |
| testid only | 40 | 0 | **0** | 40 | 40 | 40 | **+0.290** |

Read the rows against each other and the mechanism is visible:

- **`id + testid` is the row with survivors, and it loses none of them.** 20 of
  its 60 reachable profiles keep a signal — the id went and the test id stayed,
  which is exactly the drift that makes the selector miss while leaving
  something to corroborate. The broad rule refuses **none** of the 20.
- **`id only` and `testid only` have no survivors at all**, and that is not a
  gap in the enumeration. Reaching the point requires the sole recorded
  identifier to be gone, so by construction there is nothing left to survive.
  There is no legitimate replay in this population to lose, because there is no
  profile in it that Core can tell apart from an impostor.
- **None of the 120 refusals is recovered by Level 2.** The highest scores
  +0.302 against a 0.35 floor, so refusing at Level 1 is not handing the same
  element to Level 2 to resolve anyway — the same property that made rule 2 free
  on the class-set query.

## 2. What a coordinate-targeted recording actually carries

The brief asked whether the argument's premise holds — whether a real
coordinate-targeted recording carries a stale identifier beside the point at
all. Read off the producing code, not modelled:

- **Nothing in this repository produces `coordinates` on a recorded command.**
  `coordinates` is declared by **no** web action schema
  (`domain/src/actions/schemas.ts` offers `selector`, `element` and
  `visualTarget`, and nothing else, for targeting). `outputTargetFromPayload`
  emits `selector`, `element` and `visualTarget` and has no `coordinates` key.
  `gateway-mapping.ts` reads `target.coordinates ?? parameters.coordinates`, so
  the only way one arrives is hand-authored. The recorder captures `clientX` and
  `clientY` only as **pointer metadata** on the event (`dom-events.ts`
  `pointerMetadata`), never as an action target.
- **A hand-authored coordinate command never reaches the veto.** With no
  `element` on the command and none in `options`, `recordedTarget` returns
  `undefined`, `resolveTarget` never calls `vetoExactMatch`, and the point is
  acted on exactly as before. The veto can only run on a coordinate command that
  *also* carries a recorded descriptor.
- **A visual target is derived from the recorded element.**
  `gateway-payloads.ts` `visualTargetFromPayload` falls back to
  `webAutomationActionVisualTargetFromElement(payload.element)`, which builds
  the point out of the element's own `bounds`/`documentBounds`. So on the real
  recorded path the point is not independent evidence — it is the same capture
  seen from another side, and exactly as old.

**So the sympathetic case in the argument — a *fresh* point beside a *stale*
descriptor — has no path that produces it.** What the product produces is a
stale point beside an equally stale descriptor, which is the case
`long-document`'s two rows already exist to warn about: a recorded position on a
changed page points at whatever has since moved into it.

### How often the disputed recording class occurs at all

Measured live through the content harness with today's recorder:
`harness.capture()` on each of the 22 Scenario Lab fixtures, classifying all 587
interactive descriptors by which distinguishing signals `describeElement`
attached.

| Descriptor class | Count | Share | Which precondition runs the veto |
| --- | --- | --- | --- |
| Carries a label (visible text, accessible name or `label`) | 495 | 84.3% | both — unaffected by this decision |
| **An identifier and no label** | **29** | **4.9%** | **broad only — the disputed set** |
| Nothing distinguishing at all | 63 | 10.7% | neither — the class D14 already accepts |

All 29 of the disputed descriptors are `[data-testid]`-only (no `id`), and **all
29 have a recorded selector that is that identifier** — so all 29 are in the
single-identifier case where reaching a point means the corroborator is gone,
and none is in the `id + testid` case that has a fallback. The largest
contributors are `data-table` (14 of 80) and `multi-tab` (5 of 52), and eleven
of the 22 fixtures have none at all.

**A second corpus, weaker, and it agrees.** The local `.fluxiq` artifact store
holds 35 recorded element descriptors from real recording sessions. 21 carry
visible text and 14 do not, and all 35 carry a `data-testid`. But every one of
them predates Phase 1.3 — not a single descriptor in the store carries
`accessibleName`, `label` or `testId` as a field, because the recorder did not
derive them yet. Today's recorder computes an accessible name and a label for
exactly the form controls that make up most of those 14, so that corpus
*overstates* the identifier-only class and the 4.9% above is the number to use.
No recorded page content was read out of it; only signal presence was counted.

## 3. The recommendation, with both sides

**Keep the broad rule.** Not marginal, so implemented as no change plus a
corrected D14.

| | Keep (broad) | Narrow to "a label was recorded" |
| --- | --- | --- |
| Legitimate point replays refused | **0** — no refused profile carries any surviving recorded signal | 0 |
| Impostor point profiles acted on | 40 (the unprotectable class only) | **160** — worst +0.182, +0.290, +0.302 |
| Impostor class-set profiles acted on | 0 | **96** (`L-veto-recordings`) |
| Recordings affected | 4.9% of live descriptors | the same 4.9% |
| Failure mode introduced | `TARGET_NOT_FOUND`, retryable, naming the strategies tried | a click on whatever holds a stale position, no score, no floor |
| Recoverable by Level 2 | n/a — nothing is refused that Level 2 could re-resolve | n/a |

The case for narrowing rested on an author having deliberately chosen a point
over identity. No such author exists on any path this repository produces. What
narrowing would actually restore is the ability to click a stale document
position when the recorded identifier has changed and nothing else was ever
recorded — which is the exposure this plan spent the day closing, arriving
through a different strategy.

**And the cost is honestly a cost.** For that 4.9%, an identifier change now
means a failed step where it used to mean a click, and the click was sometimes
right — a redesign that renames test ids but keeps its layout is a real thing.
The failure is retryable and names what it tried, and the alternative is a
click nothing measured. That is the trade D14 already chose, applied to one more
recording class.

## 4. The supervisor's addition: an exact match reports what it scored

`vetoCandidate` scored every Level 1 match and threw the number away when it
accepted. It now returns it. Nothing new is computed — the same
`scoreTargetCandidate` call at the same point on the same critical path; one
small object outlives the call where it used to be dropped, and
`candidateFingerprint`'s layout read is unchanged. The refusal path is where
`candidateLabel` reads the page, and it stays there.

**No page text.** The accepted path returns `{ score, confidence }` and nothing
else. `resolve-target.ts` maps those onto `bestScore` and `confidence`, both
already declared on `WebAutomationTargetResolution` — so **no domain change was
needed** and the shape the gateway-mapping test pins has not grown. A T1 row
asserts the accepted verdict has exactly two keys and that both are numbers, so
the rule is a check rather than a comment.

**The four cases, readable together** (measured through the harness):

| Resolution | strategy | candidates | best | runner-up | confidence |
| --- | --- | --- | --- | --- | --- |
| **exact, `#save-settings`** | `selector` | 1 | **1.000** | **absent** | **1.000** |
| scored, recorded twin | `scored-candidate` | 2 | 1.000 | 0.382 | 1.000 |
| scored, `reworded-aria` | `scored-candidate` | 2 | 0.389 | −0.360 | 0.366 |
| refused by the veto | `fingerprint` | 2 | −0.065 | −0.360 | 0 |

The exact row is the new one. It carries **no runner-up**, deliberately: an
exact strategy weighed one element, so there is nothing to compare against and
the field is absent rather than zero. That is the distinction to take from the
table — 1.000 with nothing beside it is a selector that answered, while 1.000
over a runner-up's 0.382 is a tie Core broke. A resolution still reports no
scores at all when the recording named nothing the veto could weigh the match
by; that stays absent rather than filled with a stand-in, and the "a verb that
resolves nothing gains no measurement" row still pins the other end.

## 5. The spec split

`identity-resolution.spec.ts` was 715 lines carrying three subjects. Now four
files:

| File | Lines | Holds |
| --- | --- | --- |
| `identity-resolution.spec.ts` | 375 | Which signal resolves a drifted control: the four drift modes, scored selection, the visual target's document bounds, and what a resolution reports |
| `identity-ambiguity.spec.ts` | 97 | A tie is reported, not guessed — including the three gate rows |
| `identity-veto.spec.ts` | 237 | The Level 1 veto's four rows |
| `identity-fixtures.ts` | 96 | Shared selectors, the two failure records, the descriptor helpers, and the scope caveat that governs all three |

**Every negative control stayed beside the row it guards**, and one of them
forced the split to be less tidy than it looks:

- **"A descriptor that cannot tell the twins apart leaves them tied" is an
  ambiguity row and it stayed in the resolution file.** It is the negative
  control for the two scored tie-breaks above it: it is what proves those two
  were decided by the recorded test id rather than by document order. Moving it
  to the ambiguity file by subject would have left the tie-breaks unable to say
  why they pass and the row unable to say what it disproves. Both file headers
  say where it is and why.
- The three gate rows stayed with the ambiguity rows they narrow, and the
  "single hidden match still resolves" row stayed with them — it is the control
  on the controls, proving the gate narrows a tie rather than refusing hidden
  elements.
- The veto's "a recorded id still resolves through the veto" row stayed with the
  two refusals it guards, and the corroboration row kept its
  score-is-on-the-acting-side assertion, which is what makes it fail loudly if
  rule 1 ever starts doing that work.

**Nothing was lost, counted rather than asserted:** 97 `expect` tokens in the
original (excluding the import), 97 across the four files; 19 `test(` sites
before and after; 6 `test.describe` blocks before and after; and 23 runtime
tests, which is the arithmetic of those 19 sites with their two loops (5 + 5 +
5 + 4 + 2 + 2).

## 6. What changed

| File | Change |
| --- | --- |
| `apps/extension/src/content/identity/veto.ts` | `vetoCandidate` and `vetoExactMatch` return a `TargetVerdict`/`ExactMatchVerdict` carrying `measurement` on **both** paths, replacing `TargetVetoDecision \| undefined`. A three-member union so a refusal cannot be read without the number behind it. New header section on what the veto reports back; `recordedDistinguisher` gains the point-strategy measurement and why narrowing it was rejected. |
| `apps/extension/src/content/identity/index.ts` | Exports the new types; barrel comment notes the measurement survives an accept. |
| `apps/extension/src/content/action-runtime/resolve-target.ts` | The veto call site reads `refusedBecause` and passes the accepted measurement into a new `exactResolution` helper, which puts `bestScore` and `confidence` on the resolution. Header rewritten where it said an exact match has no score to report. **This file is on my brief's "must not touch" list** — see the open questions. |
| `apps/extension/src/content/identity/tests/veto.test.ts` | Every row updated for the verdict shape; the accepting rows now also assert the measurement came out. One new row pinning that an accepted verdict is two numeric fields and no string. |
| `apps/extension/e2e/content/tests/identity-resolution.spec.ts` | Split; kept the drift, scored-selection, visual-target and diagnostics groups. The exact-match diagnostics row now asserts `bestScore` 1 and `confidence` 1 and an absent runner-up, where it asserted an empty resolution. |
| `apps/extension/e2e/content/tests/identity-ambiguity.spec.ts` | New: the ambiguity group, unchanged. |
| `apps/extension/e2e/content/tests/identity-veto.spec.ts` | New: the veto group, unchanged. |
| `apps/extension/e2e/content/tests/identity-fixtures.ts` | New: the shared helpers and constants, moved verbatim. |
| `docs/working/…/mvp-week1-web-automation-reliability-plan.md` | **D14 only.** The "one consequence to watch" paragraph becomes the measurement: what narrowing would cost, why the fresh point has no producer, and the 29-of-587 exposure. Net +5 lines; the file is **799**, still inside the 800-line threshold. |

## Commands run and observed results

`EXTENSION_TEST_BUILD_LABEL=p-veto-coords` (lowercase) on every extension
command. No `pnpm lab`, no `pnpm build`, no root `pnpm check`, nothing written
in `F:\!FluxIQ`. Exit status captured by redirecting to a file and echoing `$?`,
never through a pipe.

| Command | Exit | Observed |
| --- | --- | --- |
| `node .test-build-scratch/l-veto-probe/enumerate.mjs` (the existing probe, unchanged) | **0** | Reproduces `L-veto-recordings`' 16-row table exactly, −0.032 and +0.010 to three decimals. |
| `node .test-build-scratch/p-veto-coords-probe/enumerate-points.mjs` | **0** | Every point-strategy table above: 5,760 reachable profiles, 566 survivors refused under either rule, 120 profiles separating the two rules, none of them carrying a surviving recorded signal. |
| `node <scratch>/corpus-census.mjs` over `.fluxiq/artifacts` | **0** | 272 JSON objects parsed, 35 recorded descriptors, all `data-testid`, none carrying a Phase-1.3 identity field. Signal presence only; no page content printed. |
| `pnpm --filter …/extension run test:content --workers=4 content/tests/zz-descriptor-census.spec.ts` (scratch spec, deleted after) | **0** | The 587-descriptor census across 22 fixtures. |
| `pnpm --filter …/extension check` | **0** | `tsc -p tsconfig.json --noEmit && tsc -p tsconfig.test.json`, no diagnostics. Three runs through the task, all clean. |
| `pnpm --filter …/extension test` | **0** | `# tests 269 / # pass 269 / # fail 0`. 268 before my change; the extra one is the new veto row. |
| `pnpm --filter …/extension run test:content --workers=4 content/tests/identity-{resolution,ambiguity,veto}.spec.ts` | **0** | `23 passed (6.6s)` — the same 23 the one file ran. |
| `pnpm --filter …/extension run test:content --workers=4` (full) | **0** | `195 passed, 1 skipped (43.0s)`. Run twice, before and after the diagnostics-row edit; both 195. 14 + 5 + 4 of them are the three identity files. |

Nothing failed on a first run and needed a rerun, so the machine's RAM fault did
not show itself here.

**The reproduction script** is at
`apps/extension/.test-build-scratch/p-veto-coords-probe/enumerate-points.mjs` —
a gitignored directory, and not the label directory the test runner clears, so
it survives alongside `l-veto-probe/enumerate.mjs`. Between them the class-set,
bare-text and point strategies can all be re-enumerated in a second the next
time Core's weights move.

## Not verified

- **No live browser validation of a real replay.** Everything ran in the T2
  content harness, the enumeration and the descriptor census. No extension, no
  background worker, no gateway, no Flow — so the claim that a `visual-target`
  arrives beside its own recorded descriptor is read off `gateway-payloads.ts`
  and `action-target.ts`, not observed on a live dispatch.
- **No spec row exercises a coordinate or visual-target command carrying an
  identifier-only descriptor.** The brief's original gap is now measured but
  still not pinned by a test. It would need a fixture control with a test id and
  no accessible name, and it is the obvious follow-up.
- **Whether Core can put `coordinates` on a dispatched target was not checked.**
  `gateway-mapping.ts` reads `target.coordinates`, and `command.target` is a
  `JsonObject` Core fills. I did not read Core's sources. If Core can, the point
  still arrives beside whatever descriptor the node carries, which is the
  population the enumeration covers; what it could not be is *fresher* than the
  descriptor, since anything that re-observed the page would re-observe identity
  too.
- **The census is 587 fixture controls, not real websites.** Whether 4.9% is the
  share on the open web is exactly what nothing here answers — the same caveat
  `v-matcher-calibration`, `v-level1-veto` and `L-veto-recordings` all recorded.
  The `.fluxiq` corpus is real recordings but of these same fixtures, and from a
  recorder two phases old.
- **The point-strategy reachability is a model.** Candidate-side, as described
  in §1; an upper bound on the population, and it does not model a page where
  the recorded selector still hits some other element.
- **No cost in time was measured** for carrying the accepted measurement out.
  It is free by inspection — no new call, one object retained — and unmeasured
  in fact.
- **Root `pnpm check`, `pnpm test`, `pnpm build` and the structure audit were
  not run.** `pnpm build` was forbidden by the brief; the rest were out of
  scope. The four new/split files sit flat in `e2e/content/tests/`, which the
  audit config treats as a runner-owned root; I did not confirm that by running
  it.
- **Cross-frame resolution.** Single-document throughout, as before.

## Open questions or contradictions found

1. **I edited a file my brief forbade, on the supervisor's later instruction.**
   `action-runtime/resolve-target.ts` is on my "must not touch" list because a
   worker was converting `resolveTarget`'s return type there. That worker
   (`L-resolution-diagnostics`) filed its report at 17:54, before I touched
   anything, and surfacing the accepted score is not possible from `identity/`
   alone — the resolution object is built in `resolve-target.ts`. The
   supervisor's message described the work as "in a file you already own", which
   is true of `veto.ts` and not of the call site. My edit there is the one call
   site, one new helper and the header paragraph that contradicted the change.
   Flagging it because the brief's rule was explicit, not because I think the
   instruction was wrong.
2. **The collision check found the file busy and then free.** When I started,
   `L-resolution-diagnostics` had a scratch build label under a minute old and
   its group was already in `identity-resolution.spec.ts` with no report filed —
   so I did the measurement first and the split last. Both it and
   `p-recording-latch` filed reports at 17:54; I made no edit to the spec before
   that. Had they still been running, the split would have had to wait, and the
   brief was right to ask.
3. **Rule 1 refuses 566 point-reachable profiles that still carry a surviving
   recorded signal**, and neither rule choice changes that number. They are
   profiles where a label agrees but a contradicting identifier or role drags
   the score under zero — D14's accepted policy working as designed, but it is
   the largest single population the veto refuses on the point strategies and
   nothing has looked at it. Worth an eye if replays start failing on pages that
   kept their wording.
4. **The unprotectable class is 10.7% of live descriptors, not a corner.** 63 of
   587 fixture controls carry nothing distinguishing at all — no text, no name,
   no label, no identifier. D14 names that class as unprotectable and it is
   right that it cannot be closed by a resolver rule, but the share is larger
   than "a limit" suggests, and `L-veto-recordings`' fourth open question — a
   recorder that warns at capture time — looks better the larger this number is.
5. **`coordinates` is a strategy with no producer.** `resolve-target.ts`
   implements it, `resolve-target.spec.ts` covers it, the domain command type
   declares it, and nothing in the product emits it. That is either a gap (some
   producer is meant to) or dead surface area kept alive by its own tests.
   Either way somebody should decide which, and the veto question is not the
   place to decide it.
