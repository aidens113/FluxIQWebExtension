# Report: v-core-scoring

Worker: `v-core-scoring`. Wave 3 follow-up — apply
[v-matcher-calibration](./v-matcher-calibration.md)'s recommendation in FluxIQ
Core, and establish its blast radius honestly.

## Outcome

**Done.** Core charges a stable identifier a candidate is **missing** at −0.1
instead of −0.55; a **contradicted** one is untouched at −0.8. The `identity-drift`
`reworded-aria` case now resolves in real Chromium and the near-miss stays
refused, both measured rather than predicted.

- **The calibration's baseline reproduces exactly** against today's Core, to
  three decimals, on both required rows and on every safety row beside them.
  [Reproduction](#1-reproduced-before-anything-changed).
- **The change is two named constants and a comment** in
  `element-fingerprint.ts`, plus a paragraph of published SDK guidance. No
  restructure, no new file, no signature change.
  [The change](#2-the-change).
- **Every prediction the calibration made was met, to three decimals** — the
  drift case 0.218 → **0.389**, the near-miss unmoved at **0.088**, separation
  0.130 → **0.301**. [Predictions against measurements](#4-the-downstream-cases-re-measured).
- **The blast radius is narrow in practice and bounded where it is not.** There
  is no second consumer of this matcher in either repository: Core's own
  `elementTargetMinimumConfidence` gate is inert for web automation, and this
  repository's recording mapper receives `elementMatcher` and never calls it.
  The exposure is the *published* SDK seam, and I measured what it does there.
  [Blast radius](#3-blast-radius).
- **One measured loosening, and it is the thing to weigh.** For a hypothetical
  Core consumer that does supply candidates, a candidate whose visible text and
  accessible name both match exactly but which carries no ID rises from
  confidence 0.428 to 0.577 — crossing the `safe` (0.45) and default (0.5) rungs
  of Core's confidence ladder. `review` (0.68), `privileged` (0.82) and
  `destructive` (0.9) still refuse it. [The one loosening](#the-one-loosening-measured).
- **No Core test expectation changed.** Two Core test *numbers* move without
  breaking an assertion; both move in the more-correct direction and I say why
  for each. [Core's own tests](#cores-own-tests-two-numbers-move-no-assertion-does).
- **Nothing in this repository was edited.** The parallel worker had already
  rewritten the `reworded-aria` spec row to expect the resolution, so no
  replacement text is needed for it — but one stale doc comment now needs one,
  and its exact text is below. [Downstream text that is now stale](#downstream-text-that-is-now-stale).

**Not stopping to escalate.** The brief said to stop if other Core consumers
move in ways that are hard to justify. None do — there are no other consumers
today, and the one theoretical crossing is bounded to the two lowest safety
rungs and is defensible on its face. The supervisor should still read
[the one loosening](#the-one-loosening-measured) before pushing.

## 1. Reproduced before anything changed

Every number below is Core's own `scoreElementFingerprintCandidate`, loaded
from Core **source** (`node --experimental-strip-types`, no rebuild, no second
scorer). The fingerprints are reconstructed from the fixtures' own markup —
`apps/scenario-lab/src/scenarios/identity-drift/save-action.ts` and
`render.ts`, `.../ambiguous-targets/render.ts` — through
`content/identity/score.ts`'s `comparableFingerprint` (which omits bounds and
attributes, hence the report's comparable weight of 138 + 4 for visibility =
142) and `candidates.ts`'s `candidateFingerprint`.

That the reconstruction is faithful is not asserted, it is shown: **every row
the calibration published reproduces to three decimals**, including its
confidences.

| Case | v-matcher-calibration | measured here, unmodified Core |
| --- | --- | --- |
| **`reworded-aria` Save — the drift case, RIGHT** | **0.218**, conf 0.205 | **0.218**, conf 0.205 |
| **"Save changes and exit", alone — WRONG** | **0.088**, conf 0.083 | **0.088**, conf 0.083 |
| Discard, the wrong-click case | −0.360 | −0.360 |
| the drifted Save beneath it | −0.375 | −0.375 |
| nameless icon button, WRONG | −0.242 | −0.242 |
| nameless button with a class, WRONG | −0.242 | −0.242 |
| same-class "Delete workspace", WRONG | −0.237 | −0.237 |
| case-only re-cased label, RIGHT | 0.249 | 0.249 |
| `ambiguous-targets` recorded twin / other | 1.000 / 0.382 | 1.000 / 0.382 |
| `ambiguous-targets` identical twins | 1.000 / 1.000 | 1.000 / 1.000 |
| Core's own test: `stable-button` / `path-only` | 0.940 conf 0.884 / −0.270 | 0.940 conf 0.884 / −0.270 |

Two rows in my probe are **my own markup, not the calibration's**, because the
report did not publish theirs and mine scores differently: a "Save changes" label
on a Publish button (mine 0.187, theirs −0.113) and "Save all workspaces" (mine
−0.237, theirs −0.275). Neither is a required baseline row and nothing here
turns on them; they are labelled as mine in the probe output.

## 2. The change

One file, `packages/fluxiq/src/programs/automation-studio/fingerprinting/element-fingerprint.ts`.
The two branches of `compareExactSignal` become named module-private constants,
because the whole point of the calibration is that they must differ and by how
much — a bare `-0.1` sitting beside a bare `-0.8` invites a future edit that
"harmonizes" them back:

```ts
const MISSING_STABLE_IDENTIFIER_SIMILARITY = -0.1;
const CONTRADICTED_STABLE_IDENTIFIER_SIMILARITY = -0.8;

function compareExactSignal(signalPath, expected, actual, contribute): void {
  if (!hasText(expected)) return;
  if (!hasText(actual)) { contribute(signalPath, MISSING_STABLE_IDENTIFIER_SIMILARITY, "candidate is missing stable identifier"); return; }
  contribute(signalPath, normalizeCase(expected) === normalizeCase(actual) ? 1 : CONTRADICTED_STABLE_IDENTIFIER_SIMILARITY, "stable identifier comparison", { expected, actual });
}
```

An eight-line comment above them carries the rationale from Core's own weight
table rather than from this corpus: every other comparator charges absence far
less (classNames −0.1, bounds/url −0.15, attributes −0.2, role/tagName/paths
−0.25, text −0.45), and −0.55 sat on the two heaviest weights in the table (26
and 28), making a missing ID cost −14.3 where a missing accessible name costs
−10.8.

**The file is exactly 400 lines.** My first draft of the comment took it to 403
and produced a *new* `[file-lines]` advisory warning in Core's structure audit
(119 warnings against the tree's 118). I trimmed the comment until the warning
went away rather than leave a warning my change created. Measured both ways:
403 lines → 119 warnings; 400 lines → 118, the tree's own count.

**`failedSignals` is preserved, which is why −0.1 and not 0.** At −0.1 the
contribution is round(26 × −0.1) = −2.6, still negative, so it still lands in
`negativeContributions` and `failedSignals`. Measured on the drift case:
`failedSignals ["id","testId","selector","classNames"]`, with
`["id",-2.6,"candidate is missing stable identifier"]`. At exactly 0 the
contribution would move to `positiveContributions` and a candidate carrying no
ID would stop being *reported* as failing that signal, which `io-policy`'s
diagnostics read.

### Core documentation

`docs/integrations/automation-studio-importing-repos.md` is the published
guidance for anyone building an element fingerprint against `elementMatcher`,
and it now states the asymmetry, because it changes what a caller should do:

> The matcher distinguishes a stable identifier a candidate **does not carry**
> from one that **contradicts** the recording. […] So supply every identifier a
> candidate genuinely has, and leave the field out rather than filling it with
> a placeholder: a wrong value costs a candidate far more than an absent one.
> Either way the signal appears in `failedSignals`, so a diagnostic still shows
> what the candidate could not answer.

That is a real behavioural instruction, not decoration: before this change a
caller filling an unknown ID with `""`/omitting it made little difference
(−0.55 either way against −0.8); now omitting costs −0.1 and inventing costs
−0.8. No Core document states a numeric constant, so nothing else needed
updating — grepped `docs/` for `0.55`, `compareExactSignal` and
`missing stable identifier`: no hits.

## 3. Blast radius

### Who reaches this matcher

| Consumer | Reached how | What moves |
| --- | --- | --- |
| `runtime/io-policy.ts:239` — `resolveElementTarget` | `elementMatcher.bestCandidate(target.fingerprint, target.candidates)`, gated by `elementTargetMinimumConfidence` | **Inert for web automation** (nothing populates `target.candidates`, so it returns `unresolved_no_candidates`). **Live for any domain that does supply candidates** — see [the one loosening](#the-one-loosening-measured). |
| `runtime/native-node-runtime.ts:29` | Hands `elementMatcher` to every importer-SDK node implementation, recording mapper (`service.ts:2412`) and target resolver (`native-node-runtime.ts:92`) | Anything calling `bestCandidate`/`scoreCandidate` sees the shift. **No implementation in either repository calls it.** |
| `apps/extension/src/content/identity/score.ts` (this repository) | `createAutomationStudioElementMatcher()` over `fluxiq/automation-studio/fingerprinting` | The intended consumer. Measured in [§4](#4-the-downstream-cases-re-measured). |

**There is no second live consumer.** Grepped both repositories for
`elementMatcher`, `bestCandidate`, `scoreCandidate(s)`,
`candidatesFromStateSnapshot` and `targetResolvers`: in Core the only call
sites are the two above plus tests; in this repository `domain/src/` registers
one recording mapper (`web-panel-host.ts:79-88` →
`mapWebRecordingObservation`) which receives `context.elementMatcher` and never
uses it, and no `targetResolvers` at all. So today the change reaches exactly
one thing that scores anything: the extension's content script.

### The one loosening, measured

The honest exposure is Core's confidence gate for a *future* domain that does
supply candidates. Measured against Core's own ladder (`destructive` 0.9 /
`privileged` 0.82 / `review` 0.68 / `safe` 0.45 / default 0.5), before and
after, by flipping the constant and re-running:

| Candidate profile | before | after | gate outcome before → after |
| --- | --- | --- | --- |
| text + name + ID recorded; both texts match exactly, **no ID** | 0.455, conf 0.428 | **0.614, conf 0.577** | below_confidence everywhere → **`matched` at `safe` and default**; still refused at review/privileged/destructive |
| text + ID recorded; text matches, **no ID** | 0.194, conf 0.171 | 0.428, conf 0.377 | below_confidence → below_confidence (every level) |
| text + ID + testId recorded; text matches, **neither ID** | −0.073, conf 0 | 0.238, conf 0.209 | **`element_target.no_match` → `element_target.below_confidence`** (every level) |
| text + ID recorded; ID **contradicts** | 0.064, conf 0.056 | 0.064, conf 0.056 | unchanged |
| text contradicts **and** no ID | −0.550, conf 0 | −0.316, conf 0 | `no_match` → `no_match` (still dropped below 0) |

Two things to weigh:

1. **A `safe`-level or default element-targeted output in some future domain
   would now act on a candidate that matches the recorded text exactly and
   carries no ID, where before it refused.** I think that is more correct than
   the old behaviour — two exact text agreements on a host that stopped emitting
   IDs is strong evidence, and `safe` is by definition the rung where a wrong
   choice is cheap — but it *is* a safety gate loosening for a domain nobody has
   measured, and it is the part of this change I can least vouch for. Every rung
   above `safe` is unchanged in outcome.
2. **A failure code can change without the failure changing.** The third row
   crosses zero, so `bestCandidate` (default `minimumNormalizedScore: 0`) stops
   dropping it: `element_target.no_match` becomes
   `element_target.below_confidence`. Same category (`target_not_found`), same
   retryability, same stage, different code and a different message. A consumer
   keying on the code string would see it. Arguably more correct — the runtime
   can now say *how close* it got instead of "nothing matched" — but it is a
   wire-visible change on a published seam.

### Core's own tests: two numbers move, no assertion does

I ran all of Core's tests, not only the matcher's. Two numbers move; neither
breaks an assertion, and for each I say whether the new value is more correct
or merely different.

| Test | Value | before | after | More correct, or merely different? |
| --- | --- | --- | --- | --- |
| `fingerprinting/tests/element-fingerprint.test.ts` — "prefers strong element identity over structural path alone" | the losing `path-only` candidate | −0.270 | **−0.079** | **More correct.** That candidate is missing an ID rather than contradicting one; its text *does* contradict ("Cancel" against "Submit order"), which is why it stays negative and stays filtered. The winner is untouched at 0.940 / conf 0.884 (it is missing nothing), and `bestCandidate` still returns `stable-button`. |
| `runtime/tests/io-policy.test.ts` — "records a typed target resolution for no match, a weak match, and a confident match", the *weak* leg | `save-text`'s confidence, which the failure message prints | 0.165 / conf 0.145 → "14%" | **0.408 / conf 0.359 → "36%"** | **More correct.** That candidate matched the only comparable text signal exactly and merely lacked a test id the recording had; 14% understated it. The assertion is `/^best candidate confidence \d+%$/` against a required 99%, so it still fails the gate and still reports `below_confidence` — but the number a person reads changed. |

Unaffected, checked rather than assumed: the same file's *strong* leg and
`io-bridge.test.ts`'s element-match flow (both candidates carry test ids, so no
missing branch fires — `save` 1.000, `cancel` −0.685, winner unchanged);
`io-policy.test.ts`'s `unmatchedTarget` (no exact signal at all — still
`no_match`); `native-node-runtime.test.ts`'s `bestCandidate` (the losing
candidate moves −0.550 → −0.316 and is still dropped below 0, winner
unchanged); `element-fingerprint.test.ts`'s third case (compares `label`,
`role`, `selector` and no stable identifier, so it cannot move — 0.295 both
ways); the state-snapshot extraction case (does not score);
`fingerprinting/tests/index.test.ts` (the browser-safety closure test — my
change adds no import).

## 4. The downstream cases re-measured

### Predictions against measurements

The left column is what v-matcher-calibration predicted for α = −0.1. The right
is what Core now produces.

| Case | predicted | **measured** | verdict |
| --- | --- | --- | --- |
| **`reworded-aria` — the case D1 needs** | 0.389 | **0.389**, conf 0.366 | **resolves**, 0.039 over the 0.35 floor |
| **"Save changes and exit", single candidate, WRONG** | 0.088 | **0.088**, conf 0.083 | **refused**, 0.262 under |
| separation between those two | 0.301 | **0.301** | as predicted |
| **Discard, the wrong-click case** | −0.360 | **−0.360** | **refused** |
| the drifted Save beneath it | −0.375 | **−0.375** | refused; Discard still ranks above it, and both are far under the floor |
| nameless icon button, WRONG | −0.070 | **−0.070** | **refused** |
| nameless button with a class, WRONG | −0.070 | **−0.070** | **refused** |
| same-class "Delete workspace", WRONG | −0.065 | **−0.065** | refused |
| case-only re-cased label, RIGHT | 0.420 | **0.420** | resolves (Level 1's case-sensitivity defect now costs a strategy, not a run) |
| **`ambiguous-targets` recorded twin / other** | unchanged | **1.000 / 0.382** | **unchanged — confirmed, not assumed** |
| `ambiguous-targets` identical twins | unchanged | **1.000 / 1.000** | unchanged, still a tie |

Every safety property the brief named holds: the wrong-button case stays
refused, the nameless-button cases stay refused, and `ambiguous-targets` still
resolves the recorded twin at 1.000 against 0.382. The last was **confirmed by
measurement** rather than taken from the report's "both candidates answer every
question" argument: both twins carry a test id, so no missing branch fires.

### In real Chromium, through the extension's own bundle

The extension aliases `fluxiq/automation-studio/fingerprinting` to Core
**source** (`build-extension.mjs:122`), so the content harness exercises this
change directly with no Core build in between.

`apps/extension/e2e/content/tests/identity-resolution.spec.ts` — **20 passed**,
including its row
`reworded-aria: the surviving accessible name resolves the right control, and Discard is not touched`,
which asserts `status: "succeeded"`, `element.accessibleName: "Save changes"`,
`visibleText: "Save"`, and a final state of
`{ savedInMode: "reworded-aria", saveCount: 1, discardCount: 0 }`.

**The attribution is proved, not inferred.** I flipped the constant back to
−0.55, re-ran the same spec, and it failed exactly there —
`Expected: "succeeded" / Received: "failed"`, 1 failed / 19 passed. Restored to
−0.1: 20 passed. So that row's pass is this Core change and nothing else.

Also run against this change, all passing: `resolve-target.spec.ts`,
`failures.spec.ts`, `identity.spec.ts`, `actions.spec.ts` — 46 passed, no
change in what any of them refuses; and the extension's unit suite,
`node scripts/test-extension.mjs` — **247 tests, 247 pass**, which includes
`content/identity/tests/score.test.ts` and its two floor assertions. Those two
were the downstream unit tests most at risk and neither moved:

- *"the least-wrong control on the page is refused, not clicked"* — both
  candidates have **contradicted** ids and test ids, so nothing moves; best is
  still Discard at −0.360, still under the floor.
- *"a control recognisable by everything but its test id clears the floor"* —
  its candidate is **missing** a test id, so it rises 0.694 → 0.783. It cleared
  the floor before and clears it by more now.

### Downstream text that is now stale

**No replacement is needed for the `reworded-aria` spec row.** The parallel
worker rewrote it during this task; its header already documents this Core
change by name and says "If that Core change is reverted, this row has to go
back to expecting TARGET_NOT_FOUND." That creates a coupling the supervisor
must honour: **that spec now fails unless this Core change is committed and
pushed with it.**

**One doc comment is now stale**, in a file the parallel worker owns, so I did
not touch it. `apps/extension/src/content/identity/score.ts`, lines 83–113, the
doc comment above `TARGET_SCORE_FLOOR`. It opens "**This value is unreachable
today, and the fix is not to move it.**" and closes "It is Core's to make; the
report carries the measurements and the recommended constant." Both sentences
were true this morning and are false now. Exact replacement text for lines
83–113 (the `export const TARGET_SCORE_FLOOR = 0.35;` line beneath it is
unchanged):

```ts
/**
 * The share of the compared weight that must agree before a candidate is an
 * answer.
 *
 * **This value was unreachable until Core recalibrated one constant, and it is
 * correct as it stands now.** `reports/v-matcher-calibration.md` measured why
 * it was unreachable: scoring runs only when every Level 1 strategy has missed,
 * which means the recorded id and test id are both gone -- and Core charged a
 * *missing* stable identifier -0.55 x 26 and -0.55 x 28, about -0.209 of the
 * scale, before a single word was compared. Of all 9,720 candidate profiles
 * that can reach Level 2 against this fixture's recorded descriptor, none
 * reached 0.35 and the highest was 0.233.
 *
 * **Lowering the floor was measured and rejected.** A floor of 0 admits the
 * drift case wanted (0.218 as it then scored) but also admits a single
 * unopposed "Save changes and exit" at 0.088 -- a different action, whose label
 * merely contains the recorded one, on a page where it is the only candidate
 * left and the margin below therefore cannot protect anything. 0.130 apart; any
 * floor between them is fitted to a hair.
 *
 * **What Core changed instead** (`reports/v-core-scoring.md`): a stable
 * identifier the candidate **does not carry** is now charged -0.1, while one
 * that **contradicts** the recording stays at -0.8. The drift case's
 * identifiers are absent and the near-miss's are contradicted, so the two
 * separate by 0.301 -- 0.389 against 0.088 -- with this floor sitting inside
 * that gap. The floor needs no movement; moving it would undo the separation.
 */
```

## Commands run and observed results

No `pnpm lab` command was run. Exit status was captured by redirecting to a
file and echoing `$?`, never through a pipe. Nothing was committed in either
repository.

### FluxIQ Core (`F:\!FluxIQ`), the definition of done

| Command | Exit | Observed |
| --- | --- | --- |
| `pnpm check` | **0** | `structure-audit: passed (118 warning(s), 256 baselined)`, then `packages/contracts`, `packages/client-gateway-websocket`, `packages/fluxiq`, `apps/web` each `check: Done`. Run twice — once mid-task (which surfaced the 119th warning my first comment draft added) and once over the final tree. |
| `pnpm build` | **0** | Full workspace build; `dist/.../element-fingerprint.js:194` carries `const MISSING_STABLE_IDENTIFIER_SIMILARITY = -0.1;`, verified by grep. Run twice, before and after the comment trim. |
| `pnpm package:lint` | **0** | `publint --strict` and `attw --profile esm-only` over contracts, fluxiq and client-gateway-websocket. Run twice. |
| `pnpm docs:check` | **0** | `Validated local links in 99 authored/reference Markdown files. Deterministic framework reference is current.` Run after the `automation-studio-importing-repos.md` edit. |
| `pnpm -r test -- --no-file-parallelism` | **1** | `Test Files 1 failed | 128 passed (129)`, `Tests 1 failed | 841 passed (842)`. The single failure is `service.test.ts › AutomationStudioService recording persistence › deletes recording batches with one index and pipeline cleanup pass`, and it is **`Error: EPERM: operation not permitted, rmdir 'C:\Users\...\Temp\fluxiq-automation-studio-service-s53HC6\...\recordings\recording.batch-a\derived'`** — a Windows temp-directory lock, in a test that touches no scoring code. See the rerun below. |
| `pnpm --filter fluxiq exec vitest run --no-file-parallelism src/programs/automation-studio/runtime/tests/service.test.ts` | **0** | `1 passed (1) / 108 passed (108)` in 106s. That file has now passed **twice** with this change in the tree (also inside the narrow run below) and failed once with an `EPERM`. I am calling the failure an environment flake, not a regression, on that evidence. |
| `pnpm --filter fluxiq exec vitest run --no-file-parallelism src/programs/automation-studio/{fingerprinting,runtime,model}` | **0** | `47 passed (47) / 496 passed (496)` — includes `element-fingerprint.test.ts`, `io-policy.test.ts`, `io-bridge.test.ts`, `native-node-runtime.test.ts`, `service.test.ts`, `action-element-target.test.ts`. |
| `node scripts/structure-audit.mjs` with a scratch `GIT_INDEX_FILE` (a copy of `.git/index` with everything staged; the real index was never written — `git status` after it still shows the two files as unstaged) | **0** | `structure-audit: passed (118 warning(s), 256 baselined)`. No warning names `element-fingerprint.ts`; the file is exactly 400 lines. |

### This repository (`F:\!FluxIQWebExtension`)

| Command | Exit | Observed |
| --- | --- | --- |
| `playwright test -c e2e/playwright.content.config.ts identity-resolution.spec.ts --workers=4` | **0** | `20 passed (4.1s)`, including the `reworded-aria` resolution row. (An earlier run of the same spec, before the parallel worker added three rows, was `17 passed`.) |
| the same spec with the Core constant flipped back to −0.55 | **1** | `1 failed / 19 passed`. The failure is the `reworded-aria` row: `Expected: "succeeded" / Received: "failed"`. This is the attribution proof; the constant was restored immediately and the spec re-run to `20 passed`. |
| `playwright test -c e2e/playwright.content.config.ts resolve-target.spec.ts failures.spec.ts identity.spec.ts actions.spec.ts --workers=4` | **0** | `46 passed (7.4s)`. |
| `EXTENSION_TEST_BUILD_LABEL=v-core-scoring node apps/extension/scripts/test-extension.mjs` | **0** | `# tests 247 / # pass 247 / # fail 0`, including `content/identity/tests/score.test.ts`. |
| `node scripts/structure-audit.mjs` with a scratch `GIT_INDEX_FILE` (everything staged, including the parallel workers' untracked files; the real index untouched, verified by `git status` still listing them as `??`) | **0** | `structure-audit: passed (32 warning(s), 19 baselined)`. |
| Scoring probe over Core source, 15 reconstructed candidates × 3 recorded descriptors + Core's own five test inputs | **0** | The tables in §1, §3 and §4. Run once before the change and once after. |
| Confidence-ladder probe, 5 profiles, before and after | **0** | The loosening table in §3. |

The content harness builds its own bundles into
`e2e/content/.harness-build/run-<pid>-<timestamp>/` and removes them in
teardown, so none of these runs touched the tracked `apps/extension/build/` or
any other worker's output.

## Not verified

- **No end-to-end Flow.** Everything ran in Core's test suite, in the content
  harness (real Chromium, real content bundle, real Scenario Lab fixtures, but
  no extension, no background worker, no gateway) and in Node probes. What a
  Flow sees end to end is not exercised, and the single-candidate path — the one
  a real drifted page most often presents, and the one with no margin protection
  — has no fixture in `identity-drift` and so was measured only in a probe.
- **The two decisive cases are still synthetic.** "Save changes and exit" was
  invented by the previous worker while trying to break its own recommendation;
  I re-measured it, I did not find it on a real page. The corpus behind this
  calibration is two fixtures plus markups two agents wrote.
- **I did not re-run the exhaustive 9,720-profile enumeration** under the new
  constant. The calibration's ceiling figures (0.233 reachable at α = −0.55) are
  quoted from that report, not reproduced. What I reproduced is every
  individual row it published.
- **The `no_match` → `below_confidence` code change was measured in a probe over
  the matcher, not through `dispatchPolicyOutput`.** The mapping from
  `bestCandidate` returning `null` to `element_target.no_match` is read from
  `io-policy.ts:240-247`, not exercised on that specific profile.
- **`pnpm check` / `pnpm test` at the root of *this* repository were not run** as
  single commands. Two other workers are mid-edit in `apps/extension/src/content/`
  and `domain/src/`, so both would report their work as well as mine and I could
  not attribute a failure. The audit — which is the first thing `pnpm check`
  runs — was run directly and passes, and the extension's own unit suite and
  four content specs were run and pass.
- **One Core test failed and I am calling it an environment flake.** `EPERM:
  rmdir` on a Windows temp directory, in a recording-persistence test with no
  path to the matcher, in a file that passed twice with the same change in the
  tree. I did not root-cause the `EPERM` itself.
- **Whether any *shipped* Core consumer resolves element targets through the
  importer-SDK seam.** I found the seam, its two entry points and its tests, and
  confirmed no consumer in either repository. I cannot speak for a consumer
  outside these two checkouts.

## Open questions or contradictions found

1. **This Core change and the downstream spec must be pushed together.**
   `identity-resolution.spec.ts`'s `reworded-aria` row now asserts a resolution
   that only happens with this Core constant, and I measured that it fails
   without it. Core's own `AGENTS.md` requires both `dev` branches in the same
   work unit; this is a case where it is not a preference but a red suite.
2. **The `TARGET_SCORE_FLOOR` doc comment in this repository is now false.** It
   says the value is unreachable and that the fix "is Core's to make". Exact
   replacement text is in
   [Downstream text that is now stale](#downstream-text-that-is-now-stale).
   `apps/extension/src/content/identity/**` belongs to a parallel worker, so I
   did not edit it.
3. **The two gates still disagree, and this change narrowed the gap without
   closing it.** `TARGET_SCORE_FLOOR` (0.35 on `normalizedScore`) admits the
   drift case at 0.389/conf 0.366. Core's `elementTargetMinimumConfidence` would
   demand **0.68** for a `review` action such as `web.dom.click`. Level 2's
   ceiling confidence rose from 0.254 to about 0.40, so the two gates now
   disagree by roughly 1.7× rather than 2.7× about the same action. It is still
   latent — the Core gate is inert because nothing supplies candidates — and
   whoever activates that path has to reconcile them.
4. **A `safe`-level Core consumer's gate got looser and nobody has measured that
   domain.** Repeated here because it is the one thing in this change I would
   want a second reader on: confidence 0.428 → 0.577 for an exact text match
   with no ID crosses the `safe` (0.45) and default (0.5) rungs. If the
   supervisor is uncomfortable, the mitigation is not to abandon the
   recalibration but to raise the `safe` rung or make it explicit per output via
   `metadata.elementTargetMinConfidence`, which `io-policy.ts:292` already
   honours.
5. **Level 1's case-sensitivity defect is now cheaper but still real.**
   `element-finder.ts`'s `normalizeText` does not lowercase where Core's does,
   so `SAVE CHANGES` misses Level 1's exact-text strategy. Under this change
   Level 2 recovers it (0.249 → 0.420, over the floor), so the defect costs a
   strategy rather than a run. It is still two implementations of one rule
   (`element-finder.ts` and `resolve-target.ts`) and still unbriefed.
6. **Level 1 still clicks by class alone with no score and no floor**, which the
   calibration raised and this change does not touch. A page whose Save button
   became `<button class="btn btn-primary">Delete workspace</button>` is
   resolved by Level 1's class-set query and clicked; Level 2 scores that
   candidate −0.065 now (−0.237 before) and would refuse it. The resolver is
   still stricter about a scored near-certainty than about a class match.
7. **D1's promise of "structured resolution diagnostics … in every action
   result" is still unmet on the success path**, and this change makes it matter
   more: the `reworded-aria` row now *succeeds* through scoring, and the spec
   asserts `reply.resolution` is `undefined`. Every scored success is still
   invisible to a Flow. That is `w3-resolver`'s open item, not this change's,
   but the first passing scored resolution has just arrived without its
   measurement attached.
