# L-replay — the element-targeted replay, run live on `isolated`

Worker `L-replay`, 2026-09-12. Lab instance `lab-replay`, every command prefixed
`FLUXIQ_TEST_ENV_FILES=none FLUXIQ_LAB_INSTANCE=lab-replay`. **No source file was
changed.** Never `--target existing`; `.env.local` untouched. Every exit status
captured by redirect into a `.status` file, never through a pipe.

---

## Outcome

**Done, and three of the four claims are answered against, not for.** One live
element-targeted Flow replay was obtained twice, with identical numbers, and it
falsifies the chain `v-inventory` hangs on G2/D6.

The headline, one line each:

1. **`implicitRole` does not reach the page at all.** It never leaves the
   browser: `gateway-payloads.ts` `elementTarget()` drops it — along with
   `accessibleName`, `label`, `context` and `testId` — before the recorded event
   reaches Core. Observed absent in two real recordings, in the generated Flow,
   and in the score the page computed.
2. **The wire target carries 9 signals, not 12**, on the `identity-drift` click,
   and **7** on the `ambiguous-targets` click. The re-ordering works; the number
   does not.
3. **The scoring calibration does not transfer.** `reworded-aria`'s Save was
   predicted at **0.389**; live it is **0.197**, confidence **0.173**, runner-up
   **−0.444** — below the 0.35 floor, so the replay refuses. Reproduced exactly
   in two independent runs.
4. **The element-target confidence floor cannot refuse anything today**, so it is
   not refusing legitimate work. Observed live on every element-targeted
   dispatch: `targetResolution: {status:"unresolved_no_candidates",
   candidateCount:0, minimumConfidence:0.68}`.

Two things were captured on the way, both of which the brief asked for, plus
**four defects**, one of which silently converts every failing Flow-lane run into
an unexplained runner error.

---

## The runs

| # | Run id | Scenario / variant | Exit | What happened |
| --- | --- | --- | --- | --- |
| 1 | `run-mtz3n8xd-f6cd7db6` | identity-drift, baseline | 1 | `recording.contract` — Core produced no Flow proposal |
| 2 | (no run dir) | identity-drift, reworded-aria | 1 | same |
| 3 | `run-mtz3q62u-f5c7c074` | ambiguous-targets, form-context | 1 | same |
| 4 | `run-mtz3jzwf-bb82e30d` | ambiguous-targets, no-context | 1 | **Flow ran and the click SUCCEEDED** where the fixture expects `web.target.ambiguous` |
| 5 | `run-mtz3sh3j-44db4ef1` | ambiguous-targets, form-context | 1 | **Flow ran**, refused `web.target.ambiguous`, both candidates 0.37; evidence write then crashed |
| 6 | `run-mtz3v24x-c65ffe5b` | identity-drift, reworded-aria | 1 | `recording.contract` |
| 7 | `run-mtz3yjwd-4fa91412` | identity-drift, reworded-aria | 1 | timed out waiting for a loopback port (machine loaded) |
| 8 | `run-mtz41r86-da19f1d6` | identity-drift, reworded-aria | 1 | **Flow ran**: type succeeded, click refused `web.target.not_found` at 0.197 |
| 9 | `run-mtz44t9p-1c6fb661` | identity-drift, reworded-aria | 1 | **the rerun** — identical numbers |

Every run was `pnpm lab run <scenario> --flow [--variant <id>] --target isolated`.
**Twenty-two invocations in total: eleven were refused by the build before a
browser started** (see [Defect 3](#defect-3--the-workspace-did-not-compile-for-most-of-this-session)),
eleven reached a browser and produced a run directory. Of those eleven, four
built and ran a Flow, five died at the Flow-proposal step, and two timed out
waiting for a loopback port. All statuses live in the scratchpad as
`<name>.status`; every one is `1`. Two later attempts not in the table repeated
outcomes already listed (`run-mtz48zlb-0ed75834`, a port timeout, and
`run-mtz4b9o5-c10decb8`, the last baseline attempt, `recording.contract`).

**Where the evidence came from.** The Lab deletes its Core store at the end of
every run (`run-scenario.ts` line 421, `removeRunOwnedTopologyState` in the outer
`finally`), and the surviving bundle carries no resolution data at all. A
read-only watcher copied
`test-runs/instances/lab-replay/.work/<runId>/fluxiq-root` every two seconds
while runs were in flight; the attempt traces below come from those copies.
Nothing was written into any run directory. Only enum values, numbers, field
names and the fixtures' own published identifiers are quoted here.

---

## Claim 1 — does `implicitRole` arriving improve a resolution?

**Answered: it does not arrive, so it cannot improve anything.**

The Flow Core generated from run 8's own recording carries this element on its
`web.dom.click` node (read from the generated `*.graph.flow.ts` in that run's
store):

```
element keys: selector, xpath, id, classNames, visibleText, tagName, text, testId, attributes
```

Nine keys. **No `implicitRole`, no `accessibleName`, no `label`.** The recorded
control is `identity-drift`'s baseline Save button, which the fixture writes as

```html
<button type="submit" id="save-settings" class="btn btn-primary" data-testid="save-changes">Save changes</button>
```

so `implicitRole` is unambiguously `"button"` (`TAG_ROLES.button` in
`content/identity/implicit-role.ts`) and `accessibleName` is unambiguously
`"Save changes"` (`nameFromContent`). `describeElement` computes both, and
`dom-events.ts` line 53 hands over the whole descriptor. They are lost after
that.

**The drop point is one function.**
`apps/extension/src/background/connection/gateway-payloads.ts` `elementTarget()`
is a hand-written 17-key allowlist, and it contains none of the five fields
`shared/protocol.ts` groups under the comment *"Identity signals, matching Core's
fingerprint normalizer (Phase 1.3)"* — `testId`, `accessibleName`, `label`,
`implicitRole`, `context`. `gatewayRecordingEventFromPayload` sends
`element: elementTarget(payload.element)`, so that projection is what Core
records, and therefore what every Flow generated from a recording carries.

`testId` survives only because the domain re-derives it:
`output-nodes/targets.ts` `elementTestId` falls back to
`attributes["data-testid"]`, and `data-testid` is in `describeElement`'s
attribute allowlist. `accessibleName` has the same kind of fallback but only from
`aria-label`, so it survives when the page wrote one and is lost when the name
comes from content. **`implicitRole` has no attribute fallback and is lost
unconditionally.**

A second recording, independently: run 6's `web.dom.type` entry carried
`attributes, id, inputType, selector, tagName, testId, value, xpath` — again no
`accessibleName`, `implicitRole` or `label`, on a labelled text input where all
three exist.

**Consequence.** `content/identity/score.ts` `comparableFingerprint` derives its
`role` signal as `target.role?.trim() || target.implicitRole?.trim()`. A page
that writes no `role` attribute — which is most pages, and both of these
fixtures — hands the scorer **no role at all**, while every live candidate
reports one. The signal `implicitRole` exists to supply is missing from the
recorded side of every comparison a real replay makes.

---

## Claim 2 — do the reordered wire target's twelve identity signals reach the page?

**Answered: the reordering does reach the page and does work. "Twelve" does not
hold.**

What reaches the page, measured on the generated Flows:

- `identity-drift` click: **9 fields** (list above).
- `ambiguous-targets` click: **7 fields** — `selector, xpath, visibleText,
  tagName, text, testId, attributes`. That recorded control has no id, class,
  role attribute or authored name, so those absences are honest; the missing
  derived signals are the same three.

The re-ordering `w3-target-signal-order` landed is confirmed working. The Flow's
adapted target reads exactly as the code comment in
`domain/src/output-nodes/targets.ts` predicts:

```
"target": { "kind": "element",
            "fingerprint": { "visibleText": "…", "selector": "#display-name", "statePath": "web.elements.display.name" },
            "source": "mapper" }
```

— a two- or three-key re-derivation. Because `outputTargetFromPayload` now
prefers `payload.element` over that, the page receives the nine-key description
rather than the bare selector. **That half of the claim is confirmed live.**

**That the page actually received them is observed, not inferred.** The browser's
failure record from run 8 reads

> `expected: an element matching selector #save-settings, visual target 303,338 (refused div[data-testid="primary-actions"] scoring -0.38), element fingerprint`
>
> `actual: nothing matched; 2 control(s) of the same family are on the page; best scored 0.20`

Three strategies ran in order, and the fingerprint strategy ran at all — which
requires a non-empty `recordedTarget`. The scorer then produced a non-trivial
score, which requires `hasIdentitySignal` to be satisfied. So selector,
visibleText, testId, id, classNames and tagName demonstrably arrived.

The "12 signals" figure was measured on `outputTargetFromPayload` with a full
descriptor supplied to it. No real recording supplies one, because of Claim 1.

---

## Claim 3 — does the scoring calibration transfer from the harness to a real Flow?

**Answered: no. Measured twice, identically.**

`identity-drift` / `reworded-aria`, replayed as a Flow built from the run's own
recording. The browser's own resolution, read from Core's persisted attempt at
`attempt.result.payload.result.resolution`:

| Run | strategy | candidateCount | bestScore | confidence | runnerUpScore | verdict |
| --- | --- | --- | --- | --- | --- | --- |
| 8 `run-mtz41r86` | `fingerprint` | 2 | **0.197** | **0.173** | −0.444 | `web.target.not_found` |
| 9 `run-mtz44t9p` | `fingerprint` | 2 | **0.197** | **0.173** | −0.444 | `web.target.not_found` |

Against the published calibration for this exact case:

| Source | best score for the drifted Save |
| --- | --- |
| `v-matcher-calibration` / `v-core-scoring`, before Core's recalibration | 0.218 |
| `v-core-scoring`, after it (`MISSING_STABLE_IDENTIFIER_SIMILARITY = -0.1`) | **0.389** |
| **live, this Flow** | **0.197** |

The floor is 0.35, so the harness number clears it and the live number does not:
`reworded-aria` **refuses** where the fixture manifest declares it should save.
`modes.ts`'s docstring ("refused anyway, because the score floor sits above
anything this page can reach") is currently the accurate description, and
`score.ts`'s ("0.389 against 0.088, with this floor sitting inside that gap") is
not, on the executed path.

**Why, mechanically.** `reworded-aria` is the rendering whose *only* surviving
recorded signal is the accessible name — the fixture deliberately keeps
`aria-label="Save changes"` on the drifted button so the name can carry the
match. The recorded side of that comparison is empty, because the baseline
button's accessible name came from its content and `elementTarget()` dropped it.
The one signal the fixture was built around is the one the wire does not carry.
The role signal is absent on the recorded side for the same reason. What is left
— contradicted visibleText, absent id and testId, contradicted classNames —
produces 0.197.

So `v-inventory`'s G2 chain resolves the other way: the wire does **not** carry
what the scorer was calibrated against, and D6's floor is calibrated against a
descriptor no Flow produces.

**Also settled: B10 is still open.** `reworded-aria` was added so that a scored
resolution would *succeed* somewhere. It does not. No fixture in the repository
currently produces a successful Level 2 resolution — `form-context` ties at
0.37/0.37 and refuses, `reworded-aria` scores 0.197 and refuses.

---

## Claim 4 — does the element-target confidence floor fast-fail wrongly?

**Answered for the half that matters: it refuses nothing at all, so it is not
refusing legitimate work. The other half is not reachable from the Lab.**

Observed on every element-targeted dispatch in runs 5, 8 and 9, in the attempt's
`metadata.targetResolution`:

```json
{"status":"unresolved_no_candidates","candidateCount":0,"minimumConfidence":0.68}
```

Three facts follow, all observations:

- **`metadata.elementTarget: true` is live.** `minimumConfidence: 0.68` is the
  `review` rung of `elementTargetMinimumConfidence`, reachable only through
  `output.definition.metadata.elementTarget`. `w3-domain-contract-gaps`' reading
  is confirmed on the executed path.
- **The floor never measures anything.** `resolveElementTarget` returns
  `ok: true` with `unresolved_no_candidates` whenever `target.candidates` is
  empty, and it is always empty: nothing populates it. The 0.68 is carried and
  never compared. **No legitimate work is being refused by it — nothing can be.**
- **The `missing_fingerprint` branch was not reached and cannot be from a
  recording-generated Flow.** Core's recording mapper writes
  `parameters.target = {kind:"element", fingerprint:{selector, statePath},
  source:"mapper"}` on every element-targeted node — read directly out of the
  generated Flow — so `!target` is never true. Producing
  `element_target.missing_fingerprint` needs a hand-authored Flow whose
  `selector` binds from a state value that resolves empty at run time, and
  `pnpm lab` has no path to that. **Left open, deliberately.**

---

## The two extras the brief asked for

### What the wire target carries, end to end

Recorder (`describeElement`, ~13 fields including the five Phase 1.3 identity
signals) → **`elementTarget()` allowlist, −5 identity signals** → Core recording
timeline entry (7–9 fields) → recording mapper → Flow node `parameters.element`
(same 7–9) → `prepareElementTargetAction` (re-derives a 2–3 key
`target.fingerprint`, keeps the parameters) → `outputTargetFromPayload` (prefers
`payload.element`, so the 7–9 survive) → the page. The only lossy step is the
first one, and it is in the extension.

### What a successful resolution reports about its own confidence

It reaches the result, and the answer changed **during** this session:

| Run | time | the successful `web.dom.type` attempt reported |
| --- | --- | --- |
| 8 `run-mtz41r86` | 18:05 | `{strategy:"selector", candidateCount:1}` |
| 9 `run-mtz44t9p` | 18:07 | `{strategy:"selector", candidateCount:1, bestScore:1, confidence:0.94}` |

`resolve-target.ts`'s md5 changed from `035bdb66…` to `f3f9c062…` between the two
runs, and `identity/veto.ts` now returns its measurement on acceptance as well as
on refusal — the piece `resolve-target.ts` itself called "the last piece of D1
still open". So: **as of the later build, a successful exact resolution reports
Core's own confidence for the accepted match, live, all the way into Core's
attempt trace.** Confirmed present at `attempt.result.payload.result.resolution`.
`w3-resolver`'s E2 gap is closed on the executed path.

A *scored* success still reports nothing, because no fixture produces one.

---

## Defects found, ranked by consequence

I fixed none of these.

### Defect 1 — an ambiguous page resolves positionally and reports success

`ambiguous-targets` / `no-context` renders two byte-identical buttons —
`<button class="ui-button">Continue</button>` twice, inside one unnamed `div`.
The manifest expects `web.target.ambiguous`. Run 4's Flow **clicked one and
reported `succeeded`**, and the failure screenshot shows the page's result
reading `primary`: the resolver guessed, and happened to guess right.

Run 5, the same fixture in `form-context` — the variant that is *supposed* to be
resolvable — refused with `web.target.ambiguous`, both candidates scoring
**0.37**. The two variants behave in exactly the opposite way to their design.

The likely mechanism, from run 8's failure text: the exact strategies run
`selector → coordinates → visual-target → fingerprint`, and a positional strategy
that lands on **one** element resolves it before the fingerprint's ambiguity
count is ever taken. In `no-context` the recorded
`documentBounds {x:256, y:101.44}` still lands on the first Continue (the
screenshot geometry matches); in `form-context` the fieldset chrome moves the
buttons and the point misses, so resolution falls through to the fingerprint and
the ambiguity is caught. **Which strategy wins is decided by page geometry.**
This is the "wrong click that reports success" shape, live.

Not proven: I did not capture run 4's attempt trace (it ran before the store
watcher started), so the winning strategy is inferred from the geometry and from
run 8's strategy list, not read off a record.

Related, and cheap to state: `form-context` scoring 0.37/0.37 shows
`comparableFingerprint` compares none of the signals that fixture varies —
`formName`, `formAction` and `fieldsetLegend` are not among its nine.

### Defect 2 — a failing Flow-lane run cannot write its evidence

`packages/test-evidence/src/redaction.ts` line 55 throws
`"Circular structured evidence cannot be safely serialized"` on any **repeated
object reference**, not only on a true cycle: `seen` is a visited set that is
never unwound. `executeRecordedFlowRun` sets the run-level `failure` to *the same
object* as the first failing action's `failure`, and `flow-lane.json` writes
both. **So every Flow-lane run whose Flow reports a structured failure crashes
while recording its evidence** and is reported as `failureCategory: "unknown"`
with that message.

That is how runs 5, 8 and 9 present. The failure the run exists to observe is
discarded and replaced by a runner error, and `snapshots/flow-lane.json` is never
written. Every negative variant in the repository is affected. I recovered the
real failures only from the Core store copies.

### Defect 3 — the workspace did not compile for most of this session

Eleven of my twenty-two invocations never reached a browser. Three separate in-flight worker
edits broke the build in sequence: `apps/extension/src/background/connection.ts`
(`pendingRecordingStart`, `beginRecordingWithoutAcceptance`),
`packages/test-runner/src/run-evaluation/tests/single-run-evaluation.test.ts`
(`TS2379` on `finishedAt`), and `domain/src/runtime/llm-evidence/tools.ts`
(`TS7006`). Each closed the Lab's build gate for every instance. Not a product
defect; a coordination one, and it roughly halved the throughput of this task.

### Defect 4 — the Lab throws away the resolution it now receives

The browser's `resolution` reaches Core and is persisted there, but the Lab's own
evidence drops it: `PersistedFlowAction` keeps only `actionType`, `status`,
timing, `failure` and `extracted`, and `flow-lane.json` and `run.json` carry no
resolution at all. Combined with the Core store being deleted at the end of every
run, **a finished run bundle contains no record of how any target was resolved**
— which is why this report needed a watcher. Adding `resolution` to
`PersistedFlowAction` and to `flow-lane.json` would make every future run
self-explaining.

### Also observed — the Flow-proposal race is worse than reported

`L-dropped-action` measured 50% on `basic-form`. Here, **5 of the 9 runs that
reached the proposal step** failed with `recording.contract` / "No mapper-visible
entries remained after compacting high-frequency state", and one recording
snapshot showed `timeline: []` at the moment the proposal was requested. Four
concurrent Lab instances were running, so load plausibly widens the window. It is
the single biggest obstacle to live validation right now.

---

## Not verified

- **Run 4's winning strategy.** Inferred from geometry and from run 8's strategy
  list; its attempt trace was not captured.
- **The `element_target.missing_fingerprint` branch** was never exercised. Not
  reachable from `pnpm lab`; see Claim 4.
- **A successful *scored* resolution** was never observed, so `confidence` on a
  Level 2 win remains unmeasured live. No fixture produces one.
- **`identity-drift` baseline (unarmed) never completed a Flow.** Every attempt
  hit the proposal race or the build gate, so the fully-green control run is
  missing. The two drift runs did each include a successful `web.dom.type`, which
  is the same evidence for the success path.
- **`ambiguous-targets` / `form-context` was seen once** (run 5, 0.37/0.37) and
  not reran; treat that pair of numbers as a single observation. The
  `reworded-aria` numbers **were** reran and are identical, so they are not
  hardware noise.
- **The tree changed under me.** HEAD was `1b6f5df` throughout, with a large
  uncommitted working tree that other workers were editing continuously;
  `resolve-target.ts` and `identity/veto.ts` changed between runs 8 and 9. Every
  number above is tagged with the run it came from for that reason.
- **The drop-point attribution** (Claim 1) is an observed absence downstream plus
  a single-candidate code path read in `gateway-payloads.ts`. I did not mutate
  that function to prove it by counterfactual — I own no source.
- **Firefox, iframes and the redaction sweep** — nothing here touches them.
- Only `isolated` was used. No `--target existing`, no panel started, no commit.

## Open questions for the supervisor

1. **Is `elementTarget()`'s allowlist deliberate?** Restoring the five Phase 1.3
   identity signals to it is a five-line change and is the precondition for
   Claims 1, 2 and 3 to come out the way the plan assumes. Until then every score
   measured in a harness overstates what a Flow will compute, and D6's floor
   cannot be calibrated against anything real.
2. **Defect 2 blocks every negative variant.** One line — unwinding `seen` after
   the walk, or making it a path set rather than a visited set — restores failure
   reporting to the whole Flow lane.
3. **Defect 1 is the wrong-click shape the plan exists to prevent**, and it is
   live today. Whether the ambiguity count should be taken before a positional
   strategy is allowed to win is a design decision, not a bug fix.
4. **`identity-drift`'s `reworded-aria` variant declares success and measures
   refusal.** Either the fixture's expectation or the pipeline is wrong; after
   (1) it may resolve, so it is worth re-running before the manifest is changed.
