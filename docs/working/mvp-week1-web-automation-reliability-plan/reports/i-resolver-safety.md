# Report: i-resolver-safety

Worker `i-resolver-safety`, 2026-09-12. Read-only investigation: nothing in
either repository was edited except this report. Extension HEAD moved from
`99eca80` to `b43a46a` during the work and Core from `368b3c9` to `5d495eb`;
`git log` shows neither commit touched any file cited below. Line numbers are
for committed content. `domain/src/client/gateway-mapping.ts` carries another
worker's uncommitted edits, which shift its working-tree lines by up to +9. No
Lab and no `pnpm build` were run. Every exit status was captured by redirecting
to a file.

## Outcome

**Done.** All three symptoms have a root cause at HEAD, each observed through
the real code rather than only computed.

- **(c) `reworded-aria` refused at 0.173.** A wiring defect, and fixed at HEAD.
  The wire projection at `1b6f5df` dropped `accessibleName` and `implicitRole`.
  Replaying the old projection through the real resolver reproduces the live
  numbers exactly: 0.197, confidence 0.173, runner-up −0.444, and the same
  refusal text. The HEAD projection resolves at 0.389 and saves. What remains
  is a Lab confirmation.
- **(b) The element-target floor sees `unresolved_no_candidates` on every
  dispatch.** A wiring defect, not a calibration one. The gate is broken at four
  links: nothing supplies candidates, and Core derives the wrong fingerprint.
  The floor never reaches the browser, and the browser's confidence never
  reaches the gate. Behind the wiring sits a calibration conflict. If
  candidates were wired in, Core's ladder would refuse the correct
  `reworded-aria` control at every tier, `safe` included.
- **(a) A different action resolves and reports success at 0.633.** Observed
  through the real `resolveTarget` in Chromium, both by Level 2 and by the
  Level 1 veto. It is an information defect, not a calibration one. Core's text
  comparison gives the same credit to "the candidate says less" (a shortened
  "Save") and "the candidate says more" ("Save changes and exit"). The two
  score **identically**: 0.640 and 0.640 on an identifier-less recording, 0.359
  and 0.359 on an authored one. No floor, margin or veto threshold can
  separate identical numbers.
- **The exposure is wider than the brief states.** It is not limited to
  identifier-less recordings. An authored recording, with its id and test id,
  also clicks the wrong action when that action carries no identifiers of its
  own: 0.359, observed.
- **D14 overstates the veto's protection.** Its numbers reproduce, but three
  of its sentences claim more than was measured, and `veto.test.ts` does not
  guard D13 the way D14 says.

## Findings at HEAD

### (c) `reworded-aria` refuses at 0.173: the wire dropped two signals

**Chain at the time of `L-replay`'s runs 8 and 9, at 18:05 and 18:07.**
- `apps/extension/src/background/connection/gateway-payloads.ts` at `1b6f5df`,
  lines 77-97, built `elementTarget()` from a hand-written 17-key list. The list
  had no `testId`, `accessibleName`, `label`, `implicitRole` or `context`.
- `domain/src/output-nodes/payloads.ts:40-46` makes a Flow node's
  `parameters.element` equal to `elementFingerprint(payload.element)`.
- `domain/src/output-nodes/targets.ts:137-138` re-derives `testId` from
  `attributes`, and `accessibleName` only from `aria-label`. The baseline Save
  has no `aria-label`, so its name, which comes from its content, was lost.
  Nothing re-derives `implicitRole`.
- `apps/extension/src/content/identity/score.ts:187-201`
  (`comparableFingerprint`) therefore sent Core no `accessibleName` and no
  `role`, because `role || implicitRole` was empty.

**The arithmetic, from Core's `element-fingerprint.ts:143-146, 178, 180`.**
With `accessibleName` and `role` missing, the reworded Save collects
visibleText +19.68/24, id −2.6/26, testId −2.8/28, tagName +7/7,
selector −3.5/14, classNames −0.5/5 and visibility +4/4. That is 21.28 over
108, or **0.197**, with confidence 0.197 × 0.88 = **0.173**.

With both signals present it adds accessibleName +24/24 and role +10/10. That
is 55.28 over 142, or **0.389**, confidence **0.366**. The probe's per-signal
detail lines print exactly these contributions.

**Fixed by `ab736a1`, committed 19:07, after those runs.**
`gateway-payloads.ts:119-145` now writes the projection through
`present<WireElementTarget>`. It is pinned by
`background/connection/tests/gateway-payloads.test.ts:158-181`, which covers
the wire key set and the identity signals surviving onto the Flow-node element,
and by `domain/src/client/tests/gateway-mapping-identity.test.ts`. Both pass
below.

**Observed in real Chromium through the real resolver.** These are harness rows
R5 and R6, run three times with identical results.

| Row | Flow-node element built from | Result |
| --- | --- | --- |
| R5a | `1b6f5df` wire keys → real `elementFingerprint` | `web.target.not_found`, fingerprint, 2 candidates, **0.197 / conf 0.173 / runner-up −0.444** |
| R5b | same, plus the recorded visual target | same numbers, and the message `visual target 312,338 (refused div[data-testid="primary-actions"] scoring -0.38), element fingerprint` (live read 303,338) |
| R6a / R6b | HEAD wire keys → real `elementFingerprint` | **succeeded**, scored-candidate, **0.389 / conf 0.366 / runner-up −0.36**, `saveCount 1, discardCount 0` |

The live failure is reproduced number for number. The cause was the dropped
signals, not the calibration.

### (b) The floor sees `unresolved_no_candidates`: four wiring breaks

Each break below is at a file:line in Core `5d495eb` unless marked as domain,
and was observed with `probe-io-policy.mjs`. The probe runs Core's compiled
`dispatchPolicyOutput` against a stub registry. Its dist matches the source
lines cited, for example dist `io-policy.js:209-210` against source `:234-235`.

1. **Nothing supplies candidates.**
   - `runtime/io-policy.ts:230-237` returns `ok: true` with
     `{status:"unresolved_no_candidates", candidateCount:0, minimumConfidence}`
     whenever `target.candidates` is empty.
   - A search for `candidates:` or `.candidates =` outside tests in
     `domain/src`, `apps/extension/src` and `packages/` finds nothing.
   - Candidates exist only in the page (`content/identity/candidates.ts`), so
     the gate cannot be reached for web automation.
2. **Core scores the wrong fingerprint.**
   - The recording mapper's `normalizeRecordingCandidateElementTargetParameters`
     (`runtime/service.ts:5769-5774`) calls
     `normalizeAutomationStudioElementTarget` on the parameters.
   - That normalizer reads only top-level keys (`model/action-element-target.ts:74-87,
     118-143`) and never `parameters.element`.
   - Probe b1: the click node's target is `{selector:"#save-settings",
     statePath:"web.elements.save.changes"}`.
   - Probe b2: the type node's target gets the **typed text as `visibleText`**
     (`:123`, `?? safeString(value.text)`), matching `L-replay` line 151's live
     observation.
   - The normalizer has no `implicitRole` either (`:132`).
   - Probe b3: with candidates supplied, Core would score this fingerprint and
     refuse with `element_target.no_match` at both `review` and `safe`.
3. **The floor never leaves Core.**
   - `io-policy.ts:212` computes `minimumConfidence`.
   - The diagnostics at `:234` omit it, and `:39` sends only those diagnostics
     as dispatch metadata. Probe b1 shows the metadata as `{status, reason}`.
   - Domain `io/gateway-output-dispatcher.ts:10-21` reads `request.metadata`
     only for `sessionId`, and builds the command from `payload` and `target`
     alone.
   - No file in `domain/src` or `apps/extension/src` reads `minimumConfidence`
     or `elementTargetResolution`.
4. **The browser's confidence never reaches the gate.**
   - `io-policy.ts:51` returns `success` on `result.ok`.
   - Probe b1: the browser reports confidence 0.10 against a carried floor of
     0.68, and the node status is `success`.

**The calibration conflict behind the wiring.** The ladder at
`io-policy.ts:291-301` is 0.9, 0.82, 0.68, 0.45 and 0.5, in units of Core
confidence. Probe b4 supplies the candidates and the full recorded fingerprint.
Core then refuses the **correct** `reworded-aria` Save, at confidence 0.366, as
`element_target.below_confidence` at `destructive`, `privileged`, `review` and
`safe`. If the gate were wired as it stands, every Level 2 recovery would be
refused.

**Verdict.** The 0.68 is a label written onto a trace and never compared with
anything. It is not refusing legitimate work, and it is not protecting against
anything either. The comment at `domain/src/io/manifest-definitions.ts:22-29`
says the flag makes `elementTargetMinimumConfidence` apply; that is false.

### (a) A different action resolves: identical evidence, no separating number

**Observed through the real `resolveTarget` in real Chromium.** The fixture is
identity-drift with the near-miss markup from `v-matcher-calibration`, and a
click listener records what was actually clicked.

| Row | Recording | Page | Result | Clicked |
| --- | --- | --- | --- | --- |
| R1 (control) | authored | Save replaced in its slot by `<button id="exit-btn" data-testid="save-and-exit">Save changes and exit</button>`, Discard removed | not_found, 0.088 / 0.083 | nothing |
| **R2** | identifier-less | Save and Discard gone, the near-miss in the header | **succeeded**, scored-candidate, 1 candidate, **0.633 / 0.595** | **Save changes and exit** |
| **R3** | identifier-less | the near-miss takes Save's slot, Discard kept | **succeeded**, strategy **selector**: the Level 1 veto accepted 0.633 | **Save changes and exit** |
| **R4** | identifier-less | Save gone, Discard left in the slot, the near-miss in the header | **succeeded**, scored-candidate, 0.633 against runner-up −0.09. The selector landed on Discard and the veto refused it. | **Save changes and exit** |
| **R7** | authored | Save replaced by `<button>Save changes and exit</button>` with no identifiers, alone | **succeeded**, **0.359 / 0.337** | **Save changes and exit** |
| **R8** | authored | same, Discard kept | **succeeded**, 0.359 against runner-up −0.36 | **Save changes and exit** |
| R9 | authored | Save replaced by `<button>Save</button>` with no identifiers: the *right* action, shortened | succeeded, **0.359 / 0.337** | Save |

R1-R4 ran three times with identical results. R7-R9 ran once, and match the
probe's arithmetic exactly. R2 closes `x-identifierless`'s "Not verified",
because it goes through `resolveTarget` itself.

**Mechanism, most fundamental first.**

1. **Core, `fingerprinting/element-fingerprint.ts:341`.** `textSimilarity`
   returns 0.82 whenever either normalized string contains the other, in
   either direction. "Save changes and exit" ⊃ "Save changes" and
   "Save" ⊂ "Save changes" therefore get the same rung at `:270-271`. For a
   control named from its own content, `visibleText` and `accessibleName` carry
   the same string (`:157-158`), so one text relation is counted on 48 weight.
   That is 48 of 88 on an identifier-less recording and 48 of 142 on an authored
   one. The policy probe shows the consequence: the shortened "Save" and the
   id-less "Save changes and exit" score **0.640 = 0.640** identifier-less and
   **0.359 = 0.359** authored.
2. **Core, `element-fingerprint.ts:268, 286, 293, 298, 311, 319`.** Every
   comparator returns early when the *recording* lacks the signal, and
   `possibleScore` accrues only for recorded signals (`:145`, `:178`). A
   candidate's own `id` and `data-testid` cannot count against it when the
   recording carried none. Removing only the recording's identifiers takes the
   same near-miss from 0.088 (R1) to 0.633 (R2).
3. **Core, D13's constants at `element-fingerprint.ts:282-288`.** A wrong
   control whose identifiers are *absent* is charged −0.1, exactly like the
   drifted right control. The 0.301 separation D13 reports holds only when the
   wrong control's identifiers *contradict* the recording (R1). When they are
   absent the two are 0.030 apart (R7 0.359, reworded-aria 0.389), and 0.000
   apart from a shortened right label (R9).
4. **Extension, `content/identity/score.ts:151-157`.** A candidate at or above
   the floor resolves. The margin (`:153-154`) applies only when there is a
   runner-up, and a runner-up the page contradicts protects nothing: R4's margin
   is 0.723 and R8's is 0.719.
5. **Extension, `content/identity/veto.ts:191-198, 233, 247-249`.** Rule 2 is
   satisfied by any positive text contribution, meaning Core's rung of 0.35
   similarity or higher, so a Level 1 match on the near-miss is acted on (R3).
   The acting sites are `content/action-runtime/resolve-target.ts:197-215` for
   Level 1 and `:233-235` for Level 2.

**Is it calibration?** No. The right and wrong controls produce identical
numbers, so no constant can separate them, which extends `x-identifierless`'s
"the two gaps do not overlap". The missing information is directional text
agreement, and the policy acts on a match in which no signal agrees exactly.

### D14: yes, it overstates, in scope rather than in its numbers

D13 and D14 now live in
`archive/2026-09-12-decisions-d13-d14.md`. Its figures reproduce: my R1
reproduces 0.088 through the resolver, and `L-veto-recordings` reproduced
−0.032 and +0.010. What is overstated is **what the margin and rule 2 protect
against**.

1. **Lines 92-99:** "headroom … 0.032 … still on the right side … `veto.test.ts`
   asserts the separation … on both axes, so a further weight change in either
   repository fails the build … Treat that test as the guard on D13."
   - The separation assertion, `veto.test.ts:167-174`, is made only against
     `RECORDED` (`:46-50`), which carries an id, a test id and both text signals.
   - The recording-axis rows (`:212-250`) assert the opposite side of the line,
     score ≥ 0 and refused by rule 2, for one nameless impostor.
   - `identity/tests/score.test.ts` has six tests (`:47-141`), none of them an
     identifier-less recording or an id-less near-miss.
   - So a Core weight change that lifts R2's 0.633 or R7's 0.359 fails no test.
     The test guards D13 for one recording class only.
2. **Lines 75-81:** rule 2 "closes 12 of those 13 … not one profile whose label
   agrees or partly agrees … free by construction."
   - The enumeration defined the impostor population as *label contradicted or
     gone* (`reports/L-veto-recordings.md:80-82`), so partial agreement was
     legitimate by definition.
   - The production wrong-action shape, a label that contains or overlaps the
     recorded one, belongs to that "partly agrees" population. It is
     corroborated by construction and acted on (R3).
   - "Free" is exactly true, and it means the rule refuses no partial match. It
     also means it protects against no wrong action that is a partial match.
   - `veto.ts:68-72` makes the same claim.
3. **Lines 100-107, limit 2:** "an impostor that carries the recorded label
   passes." Too narrow. Any candidate whose label reaches Core's 0.35 rung
   passes: containing ("Save changes and exit", 0.82) or overlapping ("Save all
   changes", 0.667; "Save and publish changes", 0.5). The same wording is at
   `veto.ts:91-93`.

The parallel D13 sentence, archive lines 23-25 ("separation widens from 0.130
to 0.301"), and `score.ts:103-108` ("the floor needs no movement") hold only
for a wrong control whose identifiers contradict the recording (item 3 of the
mechanism above).

## What changed and why

Only this report. The probes live in the scratchpad at
`…/scratchpad/probe/`: `probe-io-policy.mjs`, `probe-policy.ts` with
`run-policy-probe.mjs`, and `probe.config.mjs` with `probe-harness.spec.ts`.
The policy probe bundles into the gitignored
`apps/extension/.test-build-scratch/i-resolver-safety-probe/`, and the test runs
wrote their usual gitignored `i-resolver-safety` label directories. The harness
config mirrors `e2e/playwright.content.config.ts` but sets `testDir` to the
scratchpad, so no spec was added to the tree. Its global setup builds and then
removes its own `.harness-build/run-*` directory, as usual.

## Commands run and observed results

The label was `EXTENSION_TEST_BUILD_LABEL=i-resolver-safety`, and
`DOMAIN_TEST_BUILD_LABEL` for the domain suite. Heavy runs were one at a time.

| Command | Exit | Observed |
| --- | --- | --- |
| `node probe-io-policy.mjs` (Core dist `dispatchPolicyOutput`, stub registry) | 0 | b1: `mapper-target {"kind":"element","fingerprint":{"selector":"#save-settings","statePath":"web.elements.save.changes"},"source":"mapper"}`; `node {"status":"success","targetResolution":{"status":"unresolved_no_candidates","candidateCount":0,"minimumConfidence":0.68}}`; `dispatched-metadata {"elementTargetResolution":{"status":"unresolved_no_candidates","reason":…}}`; `browserReportedConfidence 0.1, floorCarried 0.68, coreNodeStatus success`. b2: `fingerprint {"visibleText":"Ada Lovelace","selector":"#display-name",…}`. b3: `failed … no_match` at review and safe. b4: `below_confidence … confidence 0.366, normalizedScore 0.389` at destructive, privileged, review and safe. |
| `node run-policy-probe.mjs` (real `score.ts` and `veto.ts` over Core's matcher) | 0 | 30-row table. Key rows: identifier-less × "Save changes and exit" #exit-btn **0.633 / 0.595, veto act, Level 2 resolved-this**; identifier-less × shortened "Save" **0.640** and × id-less near-miss **0.640**; authored × id-less near-miss **0.359 resolved**; authored × #exit-btn **0.088 unmatched**; live-wire recording × reworded **0.197 / 0.173 unmatched**. Detail: `a.near-miss total=55.66 … selector:-4.2/14 classNames:-0.5/5`; `c.live-pre-fix total=21.28 normalized=0.197 confidence=0.173`; `c.head total=55.28 normalized=0.389 confidence=0.366`. |
| `pnpm exec playwright test -c <scratch>/probe.config.mjs --workers=2`, run 1 (from `apps/extension`) | 0 | `8 passed (2.7s)`, R1-R6 as tabled above |
| `node scripts/test-extension.mjs` | 0 | `# tests 313 / # pass 313 / # fail 0`, including ok 64-66, the gateway-payloads wire and Flow-node identity rows, and ok 209-220, the veto rows |
| `node scripts/test-domain.mjs` | 0 | `# tests 349 / # pass 349 / # fail 0` |
| same harness command, run 2 | 0 | `8 passed (3.3s)`, every number identical to run 1 |
| same harness command, run 3, with R7-R9 added | 0 | `11 passed (3.2s)`. R1-R6 identical for the third time; R7, R8 and R9 as tabled |
| `git status --short`, both repositories | — | Extension: modified files in `background/connection/`, `domain/src/client/gateway-mapping.ts`, `domain/src/io/input-model.ts` and `packages/test-runner/`, all other workers'. None mine. Core: clean. |

## Not verified

- **No Lab run**, which this dispatch forbids. The Lab proof each item needs is
  in the fix design. For (c) the Lab must show two things. First, the generated
  click node's `parameters.element` carries `accessibleName` and
  `implicitRole`. Second, the attempt's resolution is `scored-candidate`,
  0.389, confidence 0.366, `succeeded`, with `saveCount 1`.
- **Probe (b) is not a live Core server.**
  - It calls Core's compiled `io-policy.js` with a stub registry.
  - I re-implemented the two lines of `normalizeRecordingCandidateElementTargetParameters`,
    which is not exported, over the exported normalizer.
  - The domain dispatcher's metadata drop is from reading
    `gateway-output-dispatcher.ts`, not from running it.
- **The harness rows hand the descriptor to the content script** in
  `options.element`. They do not pass through the background worker, the
  gateway or Core.
  - R5 and R6 apply the old and HEAD wire key sets by projection, then the real
    domain `elementFingerprint`. They do not call the real `elementTarget()`.
  - HEAD's key set is pinned separately by `gateway-payloads.test.ts:158-161`,
    which passed.
- **The wrong-action markup is synthetic.** It reuses `v-matcher-calibration`'s
  near-miss plus the labels I wrote into the policy probe. No fixture ships
  them, and the population of real wrong-action labels near a recorded control
  is unmeasured.
- **R7-R9 are a single observation each**, agreeing with the probe's
  arithmetic.
- **The cost of the recommended fix (A) is unmeasured.** The predicted effects
  in the fix design are read off the probe table, not measured with the change
  applied.
- **Core's handling of the recording event between the wire and the domain
  mapper was not read.** A search of `client-gateway/` found no `element`
  handling, which is an absence, not a trace.
- Firefox, cross-frame resolution, and real sites were not examined.

## Open questions or contradictions found

1. **A product decision fix A forces.** The right control shortened to "Save",
   with no `aria-label` and no surviving identifier (R9), scores the same as the
   wrong action (R7). Any rule that refuses R7 also refuses R9. Is refusing that
   drift acceptable in exchange for never clicking a partial-label wrong action?
2. **Where the rule belongs.** The exact-corroboration rule is resolution policy,
   in the same layer as the floor, margin and veto, so I place it downstream. It
   reads Core's similarity rung, and D13 says scoring belongs in Core. The
   supervisor should ratify the placement.
3. **Whether web automation should have a Core element-target gate at all**
   (fix B), or Core should record the gate as delegated to the client instead of
   writing a floor it never applies.
4. **False or overstated sentences.**
   - D14, archive lines 75-81, 92-99 and 100-107.
   - D13, archive lines 23-25.
   - `score.ts:103-108`, and `veto.ts:68-72` and `:91-93`.
   - `domain/src/io/manifest-definitions.ts:22-29`, which says the flag makes
     the floor apply.
   - `apps/extension/e2e/content/tests/identity-fixtures.ts:19-23`, which says
     the domain drops `implicitRole`. That is false since `1b6f5df`
     (`targets.ts:133`).
5. **The brief's framing of (a) is too narrow.** It says "production-shaped
   recordings". The exposure also covers authored recordings replayed on pages
   where the wrong control carries no identifiers (R7, R8).
6. **The bench cannot express the identifier-less case** (`x-identifierless`
   open question 1). It *can* express R7: record on the authored page, then arm
   a mode that renders an id-less wrong action. That makes R7 the viable Lab
   negative variant for (a).

## Fix design, partitioned by file

Three change sets. **A** closes (a) and is the one that blocks exit criterion 3.
**B** is (b), and I recommend only B.1 and B.2 for Week 1. **C** closes (c).
Within a set the files are one change, so each set needs one owner, serially,
or it lands inert.

### A. Refuse a match no distinguishing signal agrees with exactly

Rejected on this evidence:
- **A floor or margin change.** R7 and R9 score 0.359 = 0.359, and the
  identifier-less rows 0.640 = 0.640.
- **A stricter bar for a lone candidate.** R4 and R8 show a contradicted
  runner-up gives no protection.
- **Directional containment in Core alone.** The id-less near-miss drops only to
  word overlap 0.5, which is 0.458 on an identifier-less recording by the same
  arithmetic, and still resolves.

**Extension. One owner for all of these files:**

| File | Change |
| --- | --- |
| `apps/extension/src/content/identity/corroboration.ts` (new) | One exported predicate. At least one distinguishing signal the recording carried agrees at Core's exact rung: text similarity ≥ 0.92 on `visibleText`, `accessibleName` or `label`, or `id`/`testId` equal. It reads Core's contributions, never a second scorer. |
| `apps/extension/src/content/identity/index.ts` | Barrel export. |
| `apps/extension/src/content/identity/score.ts` | `scoreTargetCandidates` (`:151-157`) returns `unmatched` when the winner fails the predicate. Floor and margin unchanged. |
| `apps/extension/src/content/identity/veto.ts` | Rule 2 (`:197`, `:247-249`) uses the same predicate, so a Level 1 partial match is demoted to a miss. It then reaches Level 2, which refuses it too. |
| `apps/extension/src/content/action-runtime/resolve-target.ts` | Header comments `:17-30` and `:57-66` only. No logic change. |

Predicted effect, read off the probe table and not measured with the change:
- **Refused:** R2, R3, R4, R7, R8, and every DIFF row.
- **Kept:** `reworded-aria` (name exact, 1.000); "Save changes" with its
  identifiers gone (exact); the `ambiguous-targets` tie-break (test id exact);
  all four identity-drift Level 1 modes (exact text or id).
- **Newly refused:** R9-type drift, where the label was shortened and no exact
  signal survives.

**Proof needed.**
- **T1.**
  - `identity/tests/corroboration.test.ts` (new).
  - Rows in `identity/tests/score.test.ts`: identifier-less and authored
    recordings against the #exit-btn near-miss and the id-less near-miss, all
    `unmatched`; `reworded-aria` resolved on both recordings.
  - Rows in `identity/tests/veto.test.ts`: a partial-label wrong action refused
    as `uncorroborated`; all `DRIFTED` rows kept.
  - Mutation: bypass the predicate and quote the near-miss rows failing with
    `resolved`.
- **T2.** A new `apps/extension/e2e/content/tests/identity-near-miss.spec.ts`
  holding R1-R4 and R7-R8 as permanent rows: refusal, nothing clicked,
  `saveCount 0`. The whole `identity-*.spec.ts` family and
  `large-page-resolution.spec.ts` stay green.
- **Measurement before landing.**
  - Rerun `apps/extension/.test-build-scratch/l-veto-probe/enumerate.mjs` with
    the predicate, and report the legitimate "partly agrees" profiles lost per
    recording class.
  - Rerun `x-identifierless`'s probe on `admin-console`, `storefront-checkout`
    and `member-directory` under both identifier policies.
- **Lab.**
  - week1 W20-W23 still recover and W26 still disambiguates, `--repeat 3`.
  - The new negative variant below reports `target_not_found` in at least 90%
    of runs.

**Scenario Lab and bench. A second owner, parallel to the extension change:**

| File | Change |
| --- | --- |
| `apps/scenario-lab/src/scenarios/identity-drift/` (the mode, render and manifest files; I did not read them) | A mode that renders Save's slot as a lone id-less "Save changes and exit" that records its own action in the fixture state: the R7 shape. The recording stays on the authored baseline, so the bench can express it. |
| `packages/test-runner/src/bench/corpus/week1.ts` | A negative row for that mode expecting `failure.category: "target_not_found"`. Before A it saves-and-exits; after A it refuses. |

**Core, optional and additive:**

| Core file | Change |
| --- | --- |
| `packages/fluxiq/src/programs/automation-studio/fingerprinting/element-fingerprint.ts` | Put each comparison's `similarity` into its contribution metadata (`contribute` at `:143-147`, called at `:271`, `:288`, `:294`, `:301`). The predicate then reads Core's rung instead of reconstructing `score / weight`. Core row in `fingerprinting/tests/`, then Core `pnpm -r check`, `pnpm -r test -- --no-file-parallelism`, `pnpm package:lint`, `pnpm build`. The user must be alerted first, since it crosses into Core. |

### B. The element-target gate

**Week 1: B.1 and B.2, both in Core, one owner. Alert the user first.**

| Core file | Change |
| --- | --- |
| `packages/fluxiq/src/programs/automation-studio/runtime/io-policy.ts` | **B.1, truthful trace.** When no candidates are supplied (`:230-237`), stop reporting `minimumConfidence` as if it were applied: use a delegated status, or omit the field. |
| `packages/fluxiq/src/programs/automation-studio/nodes/contracts.ts` | **B.1.** The status union at `:117`. |
| `packages/fluxiq/src/programs/automation-studio/runtime/service.ts` | **B.2, right fingerprint.** `:5769-5774`: derive the mapper target from `parameters.element` when present. |
| `packages/fluxiq/src/programs/automation-studio/model/action-element-target.ts` | **B.2.** Map `implicitRole` to `role` (`:132`), and never promote `parameters.text` to `visibleText` when an element is supplied (`:123`). |

**Proof needed.**
- **Core unit rows.** Probe b1 becomes an io-policy test that the node trace
  claims no unapplied floor. Probe b2 becomes a model test that a type node's
  target holds no typed text and carries the element's identity.
- **Mutation.** Restore `?? safeString(value.text)` and quote the row failing.
- **Lab.** A generated Flow's click node `parameters.target.fingerprint` carries
  the recorded identity, and its type node carries no typed text.

**Beyond Week 1: B.3, a tier-aware floor applied in the browser.** Only if the
supervisor wants the safety tiers enforced. It must not be wired as it stands,
because probe b4 shows the ladder refusing every Level 2 recovery. It is one
serial chain:
1. Core `runtime/io-policy.ts:39, :234` carries `minimumConfidence` and
   `safety.level` in the dispatch metadata.
2. Domain `io/gateway-output-dispatcher.ts:14-21` copies it onto the command's
   `target`.
3. Domain `client/gateway-mapping.ts:130-144` and `actions/types.ts` lift it
   onto `WebAutomationActionCommand`.
4. Extension `content/action-runtime/resolve-target.ts:233-235` applies it.
5. The calibration goes first, either Core's ladder (`io-policy.ts:291-301`) or
   domain `io/manifest-definitions.ts:29` `elementTargetMinConfidence`, measured
   against the corpus.

Each link needs a join test, or the chain lands inert.

**Doc truth:** `domain/src/io/manifest-definitions.ts:22-29`.

### C. Closing (c)

| File | Change |
| --- | --- |
| none | **Lab:** `FLUXIQ_TEST_ENV_FILES=none pnpm lab run identity-drift --flow --variant reworded-aria --target isolated`, twice. Read the click node's `parameters.element` keys and the attempt's resolution, expected as in "Not verified". `L-replay` Defect 4 means the run bundle drops `resolution`, so that fix or a store watcher is needed to read it. |
| `apps/extension/e2e/content/tests/identity-fixtures.ts` | `:19-23` stale sentence about `implicitRole`. |
| `apps/extension/e2e/content/tests/identity-wire-chain.spec.ts` (new) | R5 and R6 as a permanent T2 row: the recorded descriptor through the HEAD wire key set and the real `elementFingerprint`, then asserting `reworded-aria` resolves. Mutation: project with `1b6f5df`'s 17 keys and quote the row failing at 0.197. My probe imported the domain function by file URL; the in-tree import path must pass `structure-audit`, which I did not check. |
