# Report: v-criteria

Worker: `v-criteria`. Read-and-analyse. How far each of the six Week 1 exit
criteria actually is from being met, and whether its stated proof can be run
today. No source, test or configuration was changed; no Lab command was run.

## Outcome

**Done.** Of the six criteria, **one** can be proven today roughly as the plan
states it (criterion 5, and only if "every metric" is read as "every metric the
bench emits a field for"). **Two** can be proven in a weakened form the plan does
not describe (1 and 2). **Two** cannot be proven at all, because the fixtures
their proof names do not exist (3 and 4). **One** cannot exist yet because it is
written after the run (6).

Two structural facts govern four of the six, and neither is stated in the plan:

- **`lab bench` runs the recording lane only, and the recording lane skips every
  variant.** `run-bench.ts:70` hard-codes `lane: "recording"`, `runOnce` never
  passes `flow` to `runScenario` (`run-bench.ts:110-121`), and
  `expand-corpus.ts:36` gives every variant the skip reason
  `VARIANT_NEEDS_FLOW_LANE`. Of the week1 corpus's 43 results, **23 run, 14 are
  skipped variants, 6 are unresolved variants** — measured, below. Drift
  recovery, failure classification and fuzzy recovery are all variant-only
  populations, so all three are structurally empty in any bench run.
- **On the recording lane FluxIQ executes at most two hard-coded probe actions,
  never the workflow.** Playwright drives the fixture (`run-scenario.ts:254-266`)
  while the extension records; the only FluxIQ execution is
  `proveCoreActionRoundTrip` (`run-scenario.ts:233`, `:406-434`), which sends one
  `web.browser.navigate` and one `web.dom.type "FluxIQ Core probe"` — and returns
  without sending either when the workflow has no `type` step with a
  `testid:`/`css:` target (`:408`). **7 of the 23 runnable rows run the probe; 16
  execute nothing through FluxIQ at all.** Every metric derived from "what FluxIQ
  reported" is therefore derived from that probe, or from nothing.

The single most valuable line in this report: **`initialExecutionSuccess` counts a
run where FluxIQ executed zero actions as a success.** `executed()` requires
`reportedVerdict !== "failed"` (`aggregate-report.ts:40`), and a row with no
probe has `reportedVerdict: null` (`run-scenario.ts:504`). Sixteen of twenty-three
week1 rows are in that state. A bench reporting `initialExecutionSuccess 1.000`
would be reporting, for two-thirds of the corpus, that Playwright drove a fixture
and the fixture ended in the right state.

---

## What the bench actually plans, measured

`node --test packages/test-runner/dist/bench/tests/week1-corpus.test.js` — exit 0,
3/3 pass, with the diagnostic lines:

```text
# rows with every result resolved: W01, W02, W03, W04, W05, W06, W07, W08, W09,
  W11, W12, W13, W14, W15, W16, W17, W18, W19, W20, W21, W22, W23, W24, W28
# unresolved results: W10 navigation/primary/broken-link,
  W25 delayed-ui/primary/too-slow, W26 ambiguous-targets/primary/no-context,
  W27 failure-surfaces/primary/disabled, W27 failure-surfaces/primary/detached,
  W27 failure-surfaces/primary/blocked-url
```

A scratch script (scratchpad only) calling the same built `expandCorpus`:

```text
total results: 43
runnable: 23  W01..W18, W24, W25, W26, W27, W28
resolved-but-skipped variants: 14  W04/text-variant, W05/short-catalog,
  W06/no-results, W08/column-reorder, W11/end-early, W13/banner-absent,
  W14/armed, W15/popup-blocked, W19/expired, W20/selector-only, W21/text-only,
  W22/moved, W23/wrapped-aria, W24/unannounced
unresolved: 6  W10/broken-link, W25/too-slow, W26/no-context,
  W27/disabled, W27/detached, W27/blocked-url
runnable with expectedFailure: 0
negative variants that resolve: W14/armed=user_intervention_required,
  W15/popup-blocked=output_not_observed, W19/expired=auth_required,
  W24/unannounced=output_not_observed
```

And which rows reach FluxIQ at all (same script, resolving each runnable
workflow and applying `cssSelectorForTarget(parseScenarioTarget(...))` exactly as
`proveCoreActionRoundTrip` does):

```text
probe RUNS (FluxIQ executes 2 actions): 7
  W01(basic-form), W02(keyboard-forms), W03(keyboard-forms/combobox),
  W06(product-catalog/search), W12(modal-flows), W18(auth-gate),
  W24(intermediate-state)
probe SKIPPED (FluxIQ executes 0 actions): 16
  W04, W05, W07, W08, W09, W10, W11, W13, W14, W15, W16, W17, W25, W26, W27, W28
```

`W19` runs nothing at all: `week1.ts:38` declares it `variantOnly`, so its row has
no unarmed workflow and its one variant is skipped.

---

## Criterion 1 — Core browser actions are reliable

> **Proof (plan line 149):** Content-script harness suite green; corpus workflows
> W01–W19 pass 3/3 replays

### What exists

- The T2 content harness is real and substantial: 18 spec files under
  `apps/extension/e2e/content/tests/`, last observed at **186 passed** at
  `--workers=4` (plan Current State, 2026-09-12), plus four rows added by
  `w3-matcher-packaging` after that count. It exercises real Chromium against the
  Scenario Lab with the built content bundle injected.
- The corpus's 23 runnable rows all resolve against the built registry.
- A Flow lane exists (`packages/test-runner/src/flow-lane/`) and has been observed
  to build a Flow from a recording and run it provider-free on `isolated`
  (`w2-flow-lane`: `basic-form --flow` passed, exit 0).

### Can the stated proof run today?

**Half of it.** "Content-script harness suite green" is runnable now
(`pnpm --filter @fluxiq-web-extension/extension test:content`, ~1 min headless).

"Corpus workflows W01–W19 pass 3/3 replays" **cannot run as written**, for two
separate reasons:

1. **W19 runs nothing.** It is variant-only and its variant is skipped
   (`expand-corpus.ts:36`).
2. **The bench performs no replay.** The recording lane records; it does not
   replay. Only `lab run <id> --flow` replays, one scenario per invocation, and
   `lab bench` has no `--flow` flag (`commands.ts:71-81`).

### What it would take, and how long

`pnpm lab bench --corpus week1 --repeat 3 --target isolated` will run 23 results
× 3 repeats = **69 runs**. Observed run duration on `smoke` was p50 **55,034 ms**,
p95 **67,894 ms**, and the literal DoD command did 4 runs in **259 s** wall
(`w1-bench`). So **≈ 75–80 minutes** per bench, headed Chromium
(`run-scenario.ts:394` `headless: false`), machine occupied, and Lab runs must be
serialized. The plan's "corpus ×3 ≈ 45 min" is an underestimate by about 70%.

Replays would have to be `lab run <id> --flow --target isolated` invocations, one
per workflow, at roughly a minute each plus Flow proposal and approval overhead.

### Where the proof could pass while the criterion is false

This is the worst case of the six.

- **`initialExecutionSuccess` and `deterministicReplaySuccess` can both read
  1.000 while FluxIQ has executed nothing.** `executed()`
  (`aggregate-report.ts:40`) is `verdict === "passed" && oracleVerdict ===
  "passed" && reportedVerdict !== "failed"`. For the 16 rows with no probe,
  `reportedVerdict` is `null` (`run-scenario.ts:504`), which satisfies the third
  clause. What those rates actually measure for those rows is: *Playwright drove
  the fixture, the recorded-event counts matched, and the fixture's final state
  held.* That is a statement about the fixture and the recorder, not about
  FluxIQ's action vocabulary.
- **"Deterministic replay" is a repeat of the recording, not a replay.** Runs
  2..N re-drive the same Playwright script. Deleting FluxIQ's executor entirely
  would not change the number.
- **Action latency covers 2 action types out of the vocabulary's 24.** The
  observed smoke report's only latency rows were
  `action-latency-p95:web.browser.navigate` and `action-latency-p95:web.dom.type`
  — the two probe actions. A `--corpus week1` bench will produce the same two.

### Nearest honest proof

Three statements, each true and each quotable:

1. `pnpm test:content` green, with the observed count and the spec list.
2. `pnpm lab bench --corpus week1 --repeat 3`, reported as **"N of 23 corpus
   workflows recorded and satisfied their fixture oracle on 3 of 3 passes"** —
   with the per-row `passRate`/`flakeClass` table `report.md` already renders, and
   an explicit sentence that this lane does not replay through FluxIQ.
3. A named set of `lab run <id> --flow --target isolated` invocations — the only
   evidence that FluxIQ *executes* a workflow. Pick the rows whose recordings
   cover the most verbs: `basic-form`, `keyboard-forms`, `product-catalog/search`,
   `modal-flows`, `data-table/sort-by-price`, `file-transfer/upload`,
   `multi-tab`, `iframe-checkout`. Budget ~10 runs.

---

## Criterion 2 — Browser evidence is useful

> **Proof (plan line 150):** Evidence fixture assertions (16 items) green;
> sanitized packet ≤ budget with `truncated` visible; `sensitive-input` leak
> assertion green

### What exists

- `apps/extension/e2e/content/tests/evidence.spec.ts` — **14 table rows + 5
  standalone tests = 19 assertions**, on `product-catalog`, `intermediate-state`,
  `modal-flows` and `infinite-feed`. Reported green by `w3-evidence-consumption`
  and `w3-evidence-finish`.
- The sanitized packet with `truncated` is real and unit-tested:
  `domain/src/runtime/llm-evidence/sanitize.ts:26,84,110,122`,
  `limits.ts:22` (`WEB_LLM_EVIDENCE_BYTE_BUDGETS`), with tests in
  `llm-evidence/tests/`.
- Redaction at T2: `redaction.spec.ts` (11 tests) and `selection-redaction.spec.ts`
  (5 tests), both green per `w3-redaction-followup`.

### Can the stated proof run today?

**Partly, and the "16 items" phrase is wrong about what exists.**

- **The "(16 items)" refers to the audit's 16-item table**
  (`reports/audit-evidence.md:31-53`), not to a 16-row spec. The spec is 19 rows
  and covers roughly nine of those items (elements/truncation, changed,
  recentlyInteracted, loading, navigation, regions, repeating, forms, overlays,
  dialogs). Items 2, 4, 5, 10 and 13 (visible text, URL, title, selected elements,
  attributes) were already "present" pre-Wave-1 and have no row here.
- **Item 16, "Expected-state evidence", still has no producer.** A grep over
  `domain/src`, `apps/extension/src` and `packages` for `expectedState` returns
  only the *declaration* (`domain/src/output-nodes/definitions.ts:34-35,81`) and
  the *consumer* (`domain/src/runtime/expectation/`). Nothing writes a value.
  That is exactly what `audit-evidence.md:53` said in the opening audit; it has
  not moved.
- **The `sensitive-input` leak assertion does not exist at T3.** The plan (Phase
  1.4 proof) names "`lab run sensitive-input --target isolated` with a new
  `security.redaction` assertion over persisted recording events". Grepping
  `security.redaction` across `packages/test-runner/src` and
  `apps/scenario-lab/src` returns exactly one hit — `inspect.ts:26`, which is a
  bundle-integrity failure category, not a leak assertion. The
  `sensitive-input` manifest
  (`apps/scenario-lab/src/scenarios/sensitive-input/scenario.ts`) declares only
  `recordingEvents`, `actions` and `finalState`; it declares no secrets and
  asserts nothing about redaction. `attestWorkspaceSecretAbsence`
  (`secret-leak-attestation.ts`) exists but its only caller is
  `demo-llm-attestation.ts`.
- **`sensitive-input` is not in the week1 corpus** (the plan keeps it "in the Lab
  for its existing lane"), so `lab bench --corpus week1` will not touch it.

### Where the proof could pass while the criterion is false

- **The sanitized packet is never measured by any Lab run, on either lane.**
  `evaluate-run.ts:104` hard-codes
  `evidence: { sanitizedPacketBytes: [], rawSnapshotBytes: [], truncationCount: 0 }`
  in `assemble()`, which both `evaluateRecordingRun` and `evaluateFailedAttempt`
  call. `RECORDING_LANE_SOURCES.evidenceSizes` (`evaluate-run.ts:17`) says so in
  words. The already-observed smoke report confirms it: *"Sanitized-packet and
  raw-snapshot distributions have no samples; truncation count 0."* So "sanitized
  packet ≤ budget with `truncated` visible" can only ever be a **unit-test**
  claim in Week 1; the bench will render `n/a` (`render-markdown.ts:57`).
- **The evidence table proves the producer, not a consumer.** The rows read the
  snapshot the content script builds. `w3-evidence-consumption` closed the
  producer→web-state gap, but nothing in a corpus run reads the sanitized packet
  or the expected-state evidence, so a regression in the *consumer* half would
  not fail any of these rows.
- **A green `lab run sensitive-input` today proves nothing about redaction.** It
  asserts two input-changed events, one click, and a status line. The redaction
  proof is entirely T2.

### Nearest honest proof

- `pnpm test:content` with `evidence.spec.ts` **19 rows** and
  `redaction.spec.ts` + `selection-redaction.spec.ts` **16 rows** quoted by name,
  not "16 items".
- The domain unit tests for the byte budget and `truncated`, quoted with the
  budget constants (3,000 failure / 6,000 exploration / 12,000 ceiling).
- An explicit line in the ledger: **item 16 (expected-state evidence) has no
  producer**, and **no Lab lane measures the sanitized packet**.
- If a T3 redaction proof is wanted this week, the cheapest real one is a check in
  `run-scenario`'s bundle finalization that the fixture's literal secret strings
  (`SYNTHETIC_PASSWORD_DO_NOT_USE`, the two card numbers) appear in no persisted
  evidence file — a small, owned change, not a Lab capability gap.

---

## Criterion 3 — Target matching has deterministic fallback

> **Proof (plan line 151):** Drift workflows W20–W23 recover without harness; W26
> resolves ambiguity by context

### What exists

- **The `identity-drift` fixture has four modes, not five**
  (`apps/scenario-lab/src/scenarios/identity-drift/modes.ts:6`:
  `baseline, selector-only, text-only, moved, wrapped-aria`). Phase 1.3's proof
  text (plan line ~448) names five — `selector-only, text-only, moved, wrapped,
  aria-variant` — and the corpus reconciles it by mapping W23's "wrapped +
  aria-variant" onto the single `wrapped-aria` variant (`week1.ts:11-13`). So the
  fixture and the corpus agree; only the plan's prose is out of date.
- All four variants **resolve** in `expandCorpus` (measured above) — and all four
  are **skipped** on the recording lane.
- The T2 proof is strong and green: `identity-resolution.spec.ts` has a
  four-row loop asserting each drift mode's Save action is clicked
  (`:126-148`), a dedicated `selector-only` fingerprint-only row (`:151`), five
  `ambiguous-targets` rows (`:175-244`), four `scored selection` rows (`:246-321`)
  and two `long-document` visual-target rows.
- Level 2 scoring is live: `content/identity/score.ts` delegates to Core's
  `fluxiq/automation-studio/fingerprinting`, with `TARGET_SCORE_FLOOR = 0.35` and
  `TARGET_SCORE_MARGIN = 0.20`.

### Can the stated proof run today?

**No, in either half.**

- **W20–W23 are skipped by the bench** (`expand-corpus.ts:36`), and
  `lab run identity-drift --variant selector-only` without `--flow` is refused
  outright — `commands.ts:41` ("`--variant` requires `--flow`") and
  `run-scenario.ts:494` (`RunnerFailure("fixture.invalid", …)`). The only runnable
  form is `lab run identity-drift --flow --variant <mode> --target isolated`, four
  separate invocations. `w2-flow-lane` observed one of them
  (`--variant selector-only`) reaching `verdict: "passed"`, exit 0.
- **W26's `no-context` variant does not exist.** `ambiguous-targets` declares no
  variants at all
  (`apps/scenario-lab/src/scenarios/ambiguous-targets/scenario.ts`), which is why
  the corpus test lists `W26 ambiguous-targets/primary/no-context` as unresolved.
  The unarmed W26 row does run — but its recording script clicks
  `testid:choice-primary` through Playwright and it has no `type` step, so FluxIQ
  executes **nothing** on it. "W26 resolves ambiguity by context" is not observed
  anywhere in a Lab run.

### Where the proof could pass while the criterion is false

- **`fuzzyRecovery` will be `n/a`, not 0.** Its population is
  `variantId !== null && positive(evaluation)` (`aggregate-report.ts:59`), and
  every variant is skipped, so `total: 0` and `rate: null`. Phase 1.3's exit check
  "bench fuzzy recovery rate on drift variants ≥ 80%" cannot be computed; a
  reader skimming `report.md` sees `n/a` in a row and may read it as "not
  applicable" rather than "not measured".
- **A green `--flow --variant selector-only` run does not prove fallback.**
  `w2-flow-lane` said so itself: *"`identity-drift` passing is consistent with
  fingerprint fallback recovery, not proof of it"* — resolution diagnostics were
  not populated then. They are now (`resolveTargetWithDiagnostics`), but nothing
  in the Flow lane persists `resolution.strategy` into the bundle, so a passing
  run still cannot say *which* strategy answered.
- **No `identity-drift` rendering reaches the scoring path.**
  `w3-matcher-packaging` measured it: `text-only`, `moved` and `wrapped-aria` all
  keep `id="save-settings"` so the recorded selector resolves exactly, and
  `selector-only` keeps the visible text so the text fallback resolves exactly.
  Level 2 is reachable on this fixture **only** by also drifting the text — and at
  that point the highest-scoring candidate is **Discard at −0.360**, ahead of the
  real **Save at −0.375**. The floor turns that into a refusal. So W20–W23 passing
  3/3 would prove Level 1 works, and would say nothing at all about the
  deterministic fallback the criterion is named for.

### Nearest honest proof

1. `identity-resolution.spec.ts` green, quoting the four drift rows *and* the four
   scored-selection rows, with `w3-matcher-packaging`'s measured table (0.694
   resolved; 0.149 and 0.170 unmatched; 1.000 vs 0.382 tie-break; −0.360 vs
   −0.375 refusal). That table is the real evidence for this criterion.
2. Four `lab run identity-drift --flow --variant <mode> --target isolated` runs
   and one `lab run ambiguous-targets --flow --target isolated`, reported as
   "5 of 5 reached a verdict, N passed", ~10 min.
3. Two honest deltas recorded as open work, not as proof:
   - a **fifth `identity-drift` rendering** that drifts the text while keeping an
     `aria-label` (`w3-matcher-packaging` estimates it scores about 0.5 and would
     resolve) — the only way any drift row exercises Level 2;
   - an **`ambiguous-targets` `no-context` variant**, without which W26's stated
     proof has no fixture.

**Landing while this report was being written.** A concurrent worker is adding
exactly that fifth rendering: an uncommitted change to
`apps/scenario-lab/src/scenarios/identity-drift/{modes,save-action,manifest}.ts`
adds a `reworded-aria` mode —
`<button type="submit" class="ui-button ui-button--accent" aria-label="Save changes">Save</button>`,
with no id, no test id and the visible text shortened. Every finding above about
the *four* modes is what I read at commit `11d2ed3` and remains true of W20–W23;
if `reworded-aria` also becomes a corpus row, criterion 3 gains its first
row that reaches Level 2, and the supervisor should re-check the corpus
resolution numbers in this report (`23 runnable / 14 skipped / 6 unresolved`)
against the integrated tree rather than trusting them.

---

## Criterion 4 — Failures are meaningfully classified

> **Proof (plan line 152):** Negative workflows (W14, W19, W27 variants) report
> the manifest's expected category ≥ 90%

### Can the runner compare a reported category against an expected one today?

**Yes — the comparison exists and is correct. It has no population.**

- `RunEvaluation` carries both sides: `automationFailureReported` and
  `automationFailureExpected` (`packages/test-contracts/src/evaluation.ts`).
- The comparison is `aggregate-report.ts:71`:
  `hit: (e) => e.automationFailureReported?.category === e.automationFailureExpected?.category`,
  over the population `applies: (e) => !positive(e)` — runs whose
  `automationFailureExpected` is non-null.
- **`runnable with expectedFailure: 0`**, measured above. `week1-corpus.test.ts`
  asserts this as an invariant: *"every unarmed week1 workflow expects success"*.
  Every negative expectation in the corpus lives on a variant, and every variant
  is skipped. So the population is **provably 0** and the rate is **`null`**, by a
  test that is currently green.

### Does `RunEvaluation` have a producer outside the bench?

**No — and the earlier audit was right, though the shape has changed.** Two
things are true at once and are easy to conflate:

- `RunEvaluation` itself is constructed only in
  `packages/test-runner/src/bench/evaluate-run.ts` (`evaluateRecordingRun`,
  `evaluateFailedAttempt`). `run-bench.ts` is the only caller. No other producer
  anywhere.
- Since `w2-flow-lane`, `runScenario` *does* publish a `RunLaneObservation`
  (`run-scenario.ts:377-383`, `RunScenarioResult.observation`), which carries the
  eight observed fields including `automationFailureReported` and
  `automationFailureExpected` for both lanes. **The bench never reads it.**
  `grep observation packages/test-runner/src/bench/` returns one hit, in a
  comment. `evaluateRecordingRun` re-derives `oracleVerdict` by inference from the
  failure category (`evaluate-run.ts:58`) — the exact inference
  `lane-observation.ts:6-9` was written to replace. `w2-flow-lane` flagged this in
  its own Not-verified section: *"The bench does not consume `observation` yet."*

So `lane-observation.ts` is, today, evidence nothing reads — the same shape the
brief warned about.

### Can the stated proof run today?

**No.** Taking its three named workflows in turn:

| Named | State |
| --- | --- |
| **W14 variants** | `modal-flows/interstitial/armed` resolves, `expected.failure.category = user_intervention_required`. Skipped by the bench. Runnable only as `lab run modal-flows --workflow interstitial --flow --variant armed --target isolated`. |
| **W19 variants** | `auth-gate/expired` resolves, category `auth_required`. Skipped by the bench. **And it is known not to produce the category**: `w2-flow-lane` Finding 3 measured that the generated Flow contains no step requesting `/account` (the mapper makes a navigation executable only when `metadata.transition === "typed"`, `domain/src/io/input-model.ts`), so no action fails and there is no structured failure to report. |
| **W27 variants** | **They do not exist.** `failure-surfaces` declares no `variants` array at all. The corpus names `disabled`, `detached`, `blocked-url`; all three are unresolved. The fixture's markup has the three surfaces (`data-testid="disabled-target"`, `detach-target`, `blocked-url`) but nothing arms them as variants. |

Two further negative variants the plan's proof does not name do resolve:
`W15/popup-blocked` and `W24/unannounced`, both `output_not_observed`.

### Where the proof could pass while the criterion is false

- **`failureClassificationAccuracy: n/a` is not a failing gate.** `runBench`'s
  exit status is "at least one run evaluated and every evaluated run passed"
  (`run-bench.ts:96`); an empty rate population does not fail it. A bench could
  exit 0 with the classification metric unmeasured and the plan's ≥ 90% exit check
  silently unaddressed.
- **`≥ 90%` over a population of 4 is arithmetically 4-of-4 or nothing.** Even
  after the W27 variants are added, the largest achievable population on the
  Flow lane is 7 negative variants; 90% of 7 is 6.3, so the real bar is 7/7.
  Stating a percentage over a population that small is misleading regardless of
  the result.
- **A `hit` on a `null === null` comparison.** `aggregate-report.ts:71` uses
  optional chaining on both sides. It is only evaluated for runs where
  `automationFailureExpected` is non-null, so the left side being absent compares
  `undefined === "auth_required"` and correctly misses — but if the population
  definition were ever widened, `undefined === undefined` would score as a hit.
  Worth a test; not a live defect.
- **T2 covers 6 of the 14 codes.** `failures.spec.ts` plants and asserts
  `ACTION_REJECTED`, `TARGET_NOT_FOUND`, `AUTH_REQUIRED`, `TIMEOUT`,
  `OUTPUT_NOT_OBSERVED`; `identity-resolution.spec.ts` adds `TARGET_AMBIGUOUS`.
  Unproven at T2: `STATE_MISMATCH`, `NAVIGATION_UNEXPECTED`, `PAGE_CHANGED`,
  `USER_INTERVENTION_REQUIRED`, `UNSUPPORTED_TYPE`, `NOT_IMPLEMENTED`,
  `ACTION_FAILED`, `UNKNOWN`.

### Nearest honest proof

The plan's proof is unrunnable as written. The nearest honest one:

- **T2:** `failures.spec.ts` 10 rows plus the `TARGET_AMBIGUOUS` rows green,
  quoted, with the six codes they cover named and the eight they do not named too.
- **T3, four runs, ~8 min:**
  `lab run modal-flows --workflow interstitial --flow --variant armed`,
  `lab run auth-gate --flow --variant expired`,
  `lab run intermediate-state --flow --variant unannounced`,
  `lab run multi-tab --flow --variant popup-blocked`, each on `--target isolated`,
  reported as **"N of 4 negative variants reported the manifest's expected
  category"** with the reported category quoted per run. Expect 3 of 4 at best —
  W19 is known to report nothing (Finding 3 above).
- Record as open work, ranked: (a) `failure-surfaces` needs three variants;
  (b) `navigation` needs `broken-link`, `delayed-ui` needs `too-slow`; (c) the
  bench needs a Flow lane before any of this becomes a corpus rate.

---

## Criterion 5 — FluxBench exists and produces repeatable measurements

> **Proof (plan line 153):** `pnpm lab bench --corpus week1 --repeat 3` emits a
> report with every metric in Metrics; two consecutive runs agree within tolerance

### The metric list, item by item

Plan `Metrics` table (lines 645–654) against `BenchCorpusMetrics` and what a
recording-lane bench actually puts in it:

| # | Plan metric | Field exists | Will carry a number | Why not |
| --- | --- | --- | --- | --- |
| 1 | Flow creation success | `rates.flowCreationSuccess` | **No — `n/a`** | Population is `lane === "flow"` (`aggregate-report.ts:48`). The bench hard-codes `lane: "recording"` (`run-bench.ts:70`) and never passes `flow` to `runScenario`. Zero flow-lane evaluations, ever. |
| 2 | Initial execution success | `rates.initialExecutionSuccess` | Yes | But see criterion 1: it counts rows where FluxIQ executed nothing. |
| 3 | Deterministic replay success | `rates.deterministicReplaySuccess` | Yes (needs `--repeat ≥ 2`) | Measures a repeated *recording*, not a replay. |
| 4 | Fuzzy recovery rate | `rates.fuzzyRecovery` | **No — `n/a`** | Population is `variantId !== null`; all 14 resolved variants are skipped. |
| 5 | False failure rate (+ inverse) | `rates.falseFailure`, `rates.falseSuccess` | `falseFailure` yes; `falseSuccess` only if a run's oracle fails | `falseSuccess` needs `oracleVerdict === "failed"` **and** `reportedVerdict !== null` — a failing run that also ran the probe. Absent from the observed smoke report. |
| 6 | Failure classification accuracy | `rates.failureClassificationAccuracy` | **No — `n/a`** | Population provably 0; see criterion 4. |
| 7 | Harness activation rate | `rates.harnessActivation` | A number, but a constant | `evaluate-run.ts:101` hard-codes `harnessActivations: 0` on every recording-lane evaluation. "Must be 0 with the provider disabled" is a tautology here, not an observation. `RECORDING_LANE_SOURCES.harnessActivations` says so. |
| 8 | Action latency p50/p95 per action type; run duration | `actionLatencyMs`, `runDurationMs` | Yes | Only two action types — the probe's `web.browser.navigate` and `web.dom.type` — and only from the 7 rows that run the probe. Run duration is real. |
| 9 | Evidence size (sanitized packet p50/p95, raw snapshot p50/p95, truncation count) | `sanitizedPacketBytes`, `rawSnapshotBytes`, `truncationCount` | **No — `n/a`, `n/a`, `0`** | `evaluate-run.ts:104` hard-codes empty lists in `assemble()`, which **both** lanes go through. There is no producer anywhere, on any lane. Confirmed by the observed smoke report. |
| 10 | Harness recovery / adaptation ×4 | five `null` fields | `null`, as specified | Correct as designed. |

**Four of ten rows cannot carry a number; a fifth is a constant; a sixth covers
2 of 24 action types.** The one that is a straight defect rather than a missing
lane is **#9**: evidence size is dead on both lanes, so building the Flow lane
into the bench would not fix it.

### Can the stated proof run today?

**Yes, if "every metric in Metrics" means "every metric the report has a field
for".** The bench command is real and has been observed end to end:
`FLUXIQ_TEST_ENV_FILES=none pnpm lab bench --corpus smoke --repeat 2 --target isolated`
exited 0 after 259 s, `{"results":2,"runs":4,"passed":4,"skipped":0}`, and both
`compare --halves` and a two-report `compare` returned `"outcome":"equivalent"`.
Missing metrics render as `n/a` (`render-markdown.ts:52,57`), which is honest.

**No, if it means every metric carries a measurement.** Four render `n/a`.

### What it would take, and how long

- One bench: 69 runs, **≈ 75–80 min**, headed, machine occupied, serialized.
- Two consecutive: **≈ 2.5 hours**, plus the `compare` invocation.
- Do not run anything else heavy alongside. The plan records a `tsc`
  segmentation fault caused by running both repositories' checks at once.

### Where the proof could pass while the criterion is false

- **`compareBenchReports` only compares metrics both reports measured.**
  `measure()` (`bench-report.ts`) returns `undefined` when a rate is `null`, so
  the four `n/a` rows are silently excluded from the comparison. Two runs can
  therefore be declared `equivalent` on six metrics while four are absent from
  both — the observed smoke halves-compare listed exactly six:
  `initialExecutionSuccess`, `falseFailure`, `harnessActivation`,
  `action-latency-p95:web.browser.navigate`, `action-latency-p95:web.dom.type`,
  `run-duration-p95`. **"Two consecutive runs agree" is a much weaker statement
  than it sounds.**
- **The `±1 workflow` tolerance is `1 / workflows`.** With a small population
  that is enormous: the observed smoke report gave `tolerance 0.5` on
  `initialExecutionSuccess` and `tolerance 1` on `falseFailure` — a rate could
  move from 0.0 to 1.0 and still be `equivalent`. On the full corpus
  `initialExecutionSuccess` spans 23 workflows so its tolerance is about 0.043,
  which is reasonable; but any small population stays meaningless.
- **A bench can exit 0 with rows missing.** The 20 skipped results are recorded as
  `skipped` in `runs.json` with their reason and are not counted as passes —
  correct — but they also do not fail the command. `skipped: 60` (20 results × 3
  repeats) in the JSON output is the only signal.

### Nearest honest proof

Run the two benches, and write the ledger entry as: **"six of ten metric rows
carry measurements; four render `n/a`, and why"**, naming the four and their
causes. Then quote the `compare` output *and* the list of metrics it did not
compare. If the supervisor wants the criterion met as written, the smallest
change that moves the needle is populating `RunEvaluation.evidence` (metric #9)
— that is a single-lane change and does not need the Flow lane.

---

## Criterion 6 — Major reliability blockers identified

> **Proof (plan line 154):** The blocker list in the Phase 1.6b ledger entry,
> ranked by corpus impact

### State

**Nothing exists.** Phase 1.6b has not run; the Work Ledger (plan lines 753–783)
ends at the Wave 2 entry. There is no blocker list.

### Can the stated proof run today?

The proof is a document, so it can be written as soon as there is a corpus run to
rank against. It is the only criterion with no technical obstacle — but ranking
"by corpus impact" requires the bench numbers from criterion 5, so it is
downstream of a ~2.5-hour run.

### Where the proof could pass while the criterion is false

A blocker list ranked by *bench* impact will systematically under-rank everything
the bench cannot see. Concretely, the following are already-known reliability
blockers that **no week1 bench run can surface**, and they belong in the list on
their own evidence:

1. **The recording lane does not exercise FluxIQ execution** for 16 of 23 rows.
   Everything the action vocabulary might get wrong is invisible to it.
2. **A recorded click is not always a Flow candidate** — `w2-flow-lane` Finding 5
   measured 4 Flow-lane runs of `basic-form` producing 5, 5, 5 and **4**
   candidates; the 4-candidate run dropped the click and failed, although the
   recording contained `web.element.clicked: 1`. Cause not isolated
   (`webAutomationRecordedAction` drops an event whose output's required
   parameters are empty). An intermittent, product-path defect.
3. **The recording-start flake** — `w1-bench` observed `basic-form` failing both
   runs of one bench with `recording.persistence` ("The extension recording did
   not start"). The 10 s Core context window was fixed in the runner; whether the
   flake is gone is unproven at corpus scale.
4. **W19 cannot report `auth_required`** (`w2-flow-lane` Finding 3): the mapper
   makes a navigation executable only for `metadata.transition === "typed"`, so
   the Flow never requests the protected page.
5. **No fixture produces `expectedState`**, so Core's expectation-evaluator seam
   (D10/C3), which *is* bound downstream
   (`domain/src/runtime/service.ts:22-27` → `bindWebAutomationHostRuntime` →
   `host-runtime.ts:102 expectationEvaluator`), has **no live input** in any
   corpus workflow. No `ScenarioStepOperation` produces a `web.dom.assert`
   (`packages/test-contracts/src/scenario.ts:26-42`), and `web.dom.assert` is an
   authored action, not a recordable one. The seam is wired, tested, and inert.
6. **Six corpus variants have no fixture** (W10, W25, W26, W27 ×3).
7. **`packages/test-runner` cannot import the domain package** —
   `w3-runner-alignment` measured this: `domain/package.json` maps `"."` to a
   TypeScript source file and Node cannot load it, so the failure-code allowlist
   cannot derive from the closed set as Phase 1.5 step 5 requires.

---

## Summary

| # | Criterion | Proof runnable today | Distance from met |
| --- | --- | --- | --- |
| 1 | Core browser actions are reliable | Harness half yes; "W01–W19 pass 3/3 replays" **no** | W19 runs nothing; the bench does not replay; 16 of 23 rows execute nothing through FluxIQ |
| 2 | Browser evidence is useful | Table and redaction at T2 yes; packet budget and leak assertion at T3 **no** | "16 items" is 19 rows over about 9 items; item 16 has no producer; no lane measures the packet; no T3 leak assertion exists |
| 3 | Target matching has deterministic fallback | **No** | W20–W23 skipped by the bench, runnable only one at a time with `--flow`; W26's `no-context` variant does not exist; no drift mode reaches Level 2 |
| 4 | Failures are meaningfully classified | **No** | W27's three variants do not exist; W19 is known not to report its category; the classification population is provably 0 in any bench |
| 5 | FluxBench repeatable measurements | **Yes**, with 4 of 10 metric rows `n/a` | Flow creation, fuzzy recovery, classification accuracy and evidence size all unmeasured; evidence size has no producer on either lane |
| 6 | Major reliability blockers | Writable after 5 | Nothing written; ranking by bench impact would hide seven known blockers the bench cannot see |

### The three cheapest changes that would move the most criteria

1. **Bench consumes `RunScenarioResult.observation`** (one file,
   `bench/evaluate-run.ts`). Removes the oracle-verdict inference and makes the
   already-published lane data load-bearing. Fixes nothing on its own, but every
   later fix depends on it.
2. **Bench gains a Flow lane** (`--flow` on `lab bench`, and `runOnce` passing it
   plus the variant id). This is what turns criteria 3 and 4 from "not runnable"
   into "measurable", and lights up `flowCreationSuccess`, `fuzzyRecovery` and
   `failureClassificationAccuracy` at once. It roughly doubles corpus run time.
3. **Populate `RunEvaluation.evidence`** (`evaluate-run.ts:104`, plus whatever
   persists packet bytes into the bundle). The only one of the four missing
   metrics that does not need the Flow lane.

Two fixture additions are needed regardless: `failure-surfaces` variants
(`disabled`, `detached`, `blocked-url`) and an `ambiguous-targets` `no-context`
variant. A fifth `identity-drift` rendering (drifted text, retained
`aria-label`) is what would make any drift row exercise Level 2 scoring.

---

## Commands run and observed results

| Command | Exit | Observed |
| --- | --- | --- |
| `node --test packages/test-runner/dist/bench/tests/week1-corpus.test.js` | **0** | `# tests 3 / # pass 3 / # fail 0`, with the two diagnostic lines quoted above (24 fully-resolved rows; 6 unresolved variants) |
| `node <scratchpad>/vc.mjs` — `expandCorpus(week1Corpus, loadScenarioManifests(root))` against the built dist | **0** | `total results: 43 / runnable: 23 / resolved-but-skipped variants: 14 / unresolved: 6 / runnable with expectedFailure: 0` |
| `node <scratchpad>/vc2.mjs` — resolves each runnable workflow and applies `cssSelectorForTarget(parseScenarioTarget(...))` as `proveCoreActionRoundTrip` does | **0** | `probe RUNS: 7 (W01, W02, W03, W06, W12, W18, W24)` / `probe SKIPPED: 16` |
| `git status --porcelain` | **0** | one line: ` M apps/extension/e2e/content/harness.ts` |
| `git diff apps/extension/e2e/content/harness.ts` | **0** | 10 insertions, 2 deletions: `SentMessage` narrowed from `{type?, payload?} & Record<string, unknown>` to `{type?, payload?}`, with a comment explaining why |

Both scratch scripts live in the session scratchpad and import only from built
`dist/` output. They wrote nothing to the repository.

Prior observations quoted rather than re-run (from `reports/w1-bench.md`,
`reports/w2-flow-lane.md`, `reports/w3-matcher-packaging.md`, and the plan's
Current State): the smoke bench's 259 s / 4 runs, its p50 55,034 ms run duration,
its `n/a` evidence distributions, the `compare --halves` metric list, the
`identity-drift` / `ambiguous-targets` score table, and the Flow lane's
definition-of-done results.

## Not verified

- **I ran no Lab command and no build.** `pnpm check`, `pnpm test`,
  `pnpm test:content` and `pnpm build` were not run: the brief forbids Lab
  commands, `pnpm test:content` rebuilds the tracked `build/` directory, and the
  plan records `tsc` segfaulting when heavy gates overlap. The harness count of
  **186** is the plan's last observation, not mine, and predates
  `w3-matcher-packaging`'s four added rows.
- **The uncommitted `harness.ts` narrowing is unverified by a compiler.** I
  checked every `SentMessage` consumer by grep — all six read only `.type` or
  `JSON.stringify` the array — so the change looks safe, but extension `check`
  has not run against it.
- **Run-time estimates are extrapolated**, from the observed smoke bench (4 runs
  / 259 s, p50 55 s) times 69 runs. Corpus rows are heavier than `basic-form` and
  `iframe-checkout`, so 75–80 min is a floor, not a forecast.
- **I did not confirm that `dist/` matches `src/`.** `packages/test-runner/dist`
  and `apps/scenario-lab/dist` are dated 2026-09-12 11:12 against sources dated
  2026-09-11; the corpus and registry sources have not changed since, so the
  resolution results should hold, but I did not rebuild to prove it.
- **Whether a `--flow` variant run passes today** is not re-verified; I quote
  `w2-flow-lane`'s observations, which predate all of Wave 3.
- **The 19-row count for `evidence.spec.ts`** is 14 table rows plus 5 standalone
  tests read from source; I did not execute the file.
- **The tree moved under me.** Everything here was read at commit `11d2ed3` with
  one uncommitted file (`harness.ts`). By the time I finished writing, concurrent
  workers had modified 23 files, including
  `apps/scenario-lab/src/scenarios/identity-drift/{modes,save-action,manifest}.ts`
  (the fifth drift rendering), `domain/src/recording/web-state/evidence/*`,
  `domain/src/runtime/llm-evidence/{sanitize,page-evidence}.ts` and
  `apps/extension/src/shared/protocol.ts`. Findings that name a corpus row, a
  fixture mode, or an evidence field should be re-checked against the integrated
  tree. The two structural findings — the bench is recording-lane only, and the
  recording lane executes at most a two-action probe — sit in
  `packages/test-runner/src/{bench,run-scenario.ts}`, which nothing in that list
  touches.

## Open questions or contradictions found

1. **The plan's Phase 1.3 proof names five `identity-drift` modes; the fixture
   has four.** The corpus already reconciles this (`week1.ts:11-13`), but plan
   line ~448 still reads `selector-only, text-only, moved, wrapped, aria-variant`.
   One-line correction.
2. **The plan's Phase 1.4 proof names "a 16-row table test"; the spec is 19 rows
   over roughly nine of the audit's 16 items.** The Objective's "(16 items)"
   points at `audit-evidence.md`'s table, of which item 16 is still unproduced.
   The criterion should either name the spec's rows or drop the count.
3. **The plan's Phase 1.4 proof names a `security.redaction` assertion over
   persisted recording events; it does not exist.** Nothing in
   `packages/test-runner` asserts secret absence in a run bundle outside the LLM
   demo path.
4. **The plan's criterion 4 names W27 variants that no fixture declares**, and
   W19, which a Wave 2 worker measured as structurally unable to report its
   category. Both were true before Wave 3 dispatched and neither was corrected.
5. **`lane-observation.ts` is published and unread.** `run-scenario.ts` produces a
   `RunLaneObservation` for both lanes; the bench ignores it and re-infers. Its
   own author flagged this. Which side should own the fix — a one-file change in
   `bench/evaluate-run.ts` — is a supervisor call.
6. **`RunEvaluation.evidence` has no producer on either lane.** Is Week 1's
   evidence-size metric intended to be measured at all, or deferred with the Week
   2 fields? The plan lists it as a Week 1 metric, which today is not true of any
   code path.
7. **Should `lab bench` fail when a corpus row is skipped?** Today 60 of 129
   planned runs (20 results × 3) would be skipped in a `--repeat 3` week1 bench
   and the command can still exit 0. That is defensible while the Flow lane is
   missing, but it means the exit status carries no signal about corpus coverage.
