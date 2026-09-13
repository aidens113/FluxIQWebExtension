# x-identity-wire — the identity signals now cross, and what that does to D13 and D14

Worker `x-identity-wire`, 2026-09-12. No Lab run, no `pnpm build`, no commit.
Every exit status captured by redirect into a file in the scratchpad, never
through a pipe. Build labels `EXTENSION_TEST_BUILD_LABEL=x-identity-wire` and
`DOMAIN_TEST_BUILD_LABEL=x-identity-wire`.

---

## Outcome

**Done.** The five Phase 1.3 identity signals now cross the wire, the projection
that dropped them cannot drop one again without failing the build, and the two
cases D13 and D14 rest on were re-measured through the real projection.

Four things worth reading before anything else:

1. **The allowlist was not deliberate.** It is an accretion list from the first
   extension commit, and all three candidate reasons — size bound, redaction
   boundary, deliberately narrow contract — are disproved by evidence in the
   file itself. Widening it is safe; the detail is [below](#why-the-allowlist-existed).
2. **D13's justification holds again, exactly.** With the signals arriving, the
   `reworded-aria` drift case scores **0.389 / confidence 0.366 / runner-up
   −0.360** — the published calibration to three decimals — where the shipped
   wire produced **0.197 / 0.173 / −0.444**, which is L-replay's live number to
   three decimals. The reconstruction reproduces both the broken and the
   intended figure, so it is measuring the right thing.
3. **The wire defect was breaking D14 as well, on the side nobody checked.**
   `selector-only` — the drift mode D14 names as its tightest legitimate
   resolution at 0.149 — measured **−0.119 and was vetoed** on the shipped wire.
   A legitimate Level 1 resolution was being refused in production while the
   impostor side was unaffected (−0.034 shipped against −0.032 published). D14's
   claim that "all four identity-drift modes still resolve" was false live and is
   true now.
4. **One new exposure, and it is D13's own rejected alternative.** The near-miss
   D13 measured at 0.088 carries identifiers of its own. A near-miss carrying
   **no identifier at all** scores **0.359–0.398** and clears the 0.35 floor
   alone, with no runner-up to protect it. Separation is then 0.030, not 0.301.
   This is not caused by this change — it was always what the harness would have
   measured — but it becomes live now that the harness and the wire agree.
   Figures in [D13 re-measured](#d13-re-measured).

`context` reaches the wire but still does not reach the page: `elementFingerprint`
in `domain/src/output-nodes/targets.ts` has no `context` key. That file is not
mine. See [what is still lossy](#what-is-still-lossy).

---

## Why the allowlist existed

The brief asked me to find the reason before widening it. There is none. Three
independent observations, each checkable:

**It was never a policy, it was the first draft.** `git log -S elementTarget --
apps/extension/src/background/` returns four commits. The function is introduced
in `29be582` ("First basic extension") inside `background/connection.ts` as a
**five**-key projection — `selector, tagName, text, bounds, attributes` — beside
a snapshot function that passed the whole DOM snapshot through raw. It reached
seventeen keys by accretion, one field at a time, and `90232b8` ("Decompose both
shipped oversized files") only moved it into `gateway-payloads.ts`. Nothing in
its history states a rule it was keeping.

**It cannot be a size bound.** Nothing in `apps/extension/src/background/` or
`domain/src/client/` caps a payload's size — `grep -niE "max.*(payload|message).*(size|bytes)|payloadLimit|MAX_MESSAGE"`
returns only a PNG signature check and a base64 length reader for uploads. And
the function immediately above it, `recordingEvidencePayload`, sends
`element: payload.element` — the **entire** descriptor, unprojected — plus the
whole merged `snapshot`, on the same connection. A size bound that spares the
larger payload beside it is not a size bound.

**It cannot be a redaction boundary.** It already carried `value`, `visibleText`,
`text` and the whole `attributes` map — which includes `placeholder`, `title`,
`aria-label` and `alt` — unconditionally, for every control including a
sensitive one. A boundary that lets a control's value through and stops its
implied ARIA role is not drawing a privacy line.

So the five signals were forgotten, not excluded. No signal must be kept off the
wire, and Phase 1.3's capture work is usable.

---

## What changed

Three files, plus tests beside two of them.

### `apps/extension/src/shared/protocol.ts`

The wire contract is now declared, not implied.

- `DomElementIdentitySignal` — the five signals as a union, so both ends join to
  them by type rather than by memory.
- `UnwiredElementField` — the descriptor fields the wire deliberately does not
  carry, each with its reason: `hasValue`, `selectedValue` and `options`
  (a second copy of what a control *holds*, when the value already travels as
  the event's `inputValue` under the sensitivity rule), and `changed` and
  `recentlyInteracted` (snapshot-scoped Phase 1.4 facts about a frame's previous
  capture, not about a recorded element).
- `WireElementTarget = Omit<DomElementDescriptor, UnwiredElementField>` — the
  wire shape, derived from the descriptor rather than restated.
- `WiredIdentitySignals` — a type alias that only compiles while every identity
  signal is in `WireElementTarget`.

### `apps/extension/src/background/connection/gateway-payloads.ts`

`elementTarget()` is written through `present<WireElementTarget>()` —
`apps/extension/src/shared/present.ts`, the helper this repository already
adopted for exactly this defect class on the page-evidence contract, and which
the structure audit's `contractSpreadPaths` remedy names. Every key of the
contract type must be mentioned at the call site; an optional one may be
`undefined` and is then absent on the wire. So a renamed field fails to compile
and a deleted one fails to compile, which is the half a green suite has now
missed four times in this plan.

**Redaction.** The rule is `isSensitiveElementDescriptor` from
`domain/src/sensitivity/`, imported, not restated. What it governs is a caller's
decision, and the line drawn here is the line `describe-element.ts` already draws
at capture and `elementStatePayload` draws at the state projection: **a control's
contents never cross; the author's description of it does.**

| Field | On a sensitive control | Why |
| --- | --- | --- |
| `value` | withheld | the contents themselves |
| `visibleText`, `text` | withheld | a `contenteditable` the rule marks holds what was typed in its own text, and `describeElement` reads that text without asking the rule (see [the capture-side hole](#a-capture-side-hole-i-did-not-own)) |
| `accessibleName` | withheld | its specified derivation ends at a push button's `value`; the wire cannot verify the producer's gate ran |
| `label`, `context` | **kept** | label text skips nested controls by construction and page context is chrome; neither can hold what a person typed |
| `attributes` | **kept** | the recorder's allowlist deliberately excludes `value`, so an attribute cannot carry a control's content |

Withholding `accessibleName` costs nothing measurable: where the name was
author-written it is still in `attributes["aria-label"]`, which
`elementFingerprint` re-derives it from on the far side; where it came from a
`<label>`, `label` carries the same text. Where it could have come from a value,
it is gone.

This is a second look, not the first. The recorder withholds all of it already.
It is repeated at the wire for the reason `state-values.ts` gives for repeating
it: this is the far side of a wire from that guard, and what crosses is
persisted and replayed.

### `domain/src/client/tests/gateway-mapping-identity.test.ts` (new)

The domain's half of the join: a recorded element in, and what a generated Flow
node and the dispatched target come out carrying, read at
`webAutomationOutputPayload` and `outputTargetFromPayload` rather than at the
boundary in between. Kept out of `gateway-mapping.test.ts` because that file is
already past the 400-line advisory and covers a different subject.

`domain/src/client/gateway-mapping.ts` itself needed no change: it passes
`payload.element` through unaltered, and its dispatch-direction
`commandElementFingerprint` already uses the shared normalizer.

---

## The producer/consumer guard, proved by mutation

Both mutations were applied, compiled, observed, and reverted.

| Mutation | Result |
| --- | --- |
| Delete `implicitRole: element.implicitRole,` from the producer literal | `tsc -p apps/extension/tsconfig.json --noEmit` exit **2**: `gateway-payloads.ts(121,37): error TS2345 … Property 'implicitRole' is missing in type … but required in type 'OptionalFields<WireElementTarget>'` |
| Reclassify `implicitRole` as an `UnwiredElementField`, so the producer is "allowed" to drop it | exit **2**, in two places: `protocol.ts(294,44): error TS2344: Type '"implicitRole"' does not satisfy the constraint 'never'` and `gateway-payloads.ts(142,5): error TS2353 … 'implicitRole' does not exist in type …` |

The second is the one that matters: the escape hatch is closed too. A field
cannot be quietly reclassified out of the contract, only argued out of it, and
the argument fails to compile.

Three test-level guards sit beside the compile-time ones:

- the wire element's key set is asserted equal to a list of `WireElementTarget`'s
  keys written independently in the test, with `satisfies` rejecting a key the
  contract lacks and a `Nothing<Exclude<…>>` alias rejecting a contract key the
  list forgets;
- each of the five signals is asserted to arrive with its recorded value;
- the same descriptor is pushed through `elementFingerprint` and asserted at the
  Flow-node element — the join whose absence let this ship.

---

## D13 re-measured

Method: the production chain, run in Node. `describeElement`'s output for the
`identity-drift` baseline Save button → the real `elementTarget()` through
`gatewayRecordingEventFromPayload` → `elementFingerprint` → the page's
`RecordedIdentity` → `scoreTargetCandidates`. "before" reproduces the seventeen-key
allowlist; candidates are built as `candidateFingerprint` describes each fixture
rendering. Nothing is hand-tuned, and the recorded side is never hand-written.

**The recorded identity the page compares against**

| | signals |
| --- | --- |
| before | `attributes, classNames, id, selector, tagName, testId, text, visibleText, xpath` — `accessibleName` undefined, `implicitRole` undefined |
| after | the same plus `accessibleName="Save changes"`, `implicitRole="button"` |

`testId` survives both ways, re-derived from `attributes["data-testid"]`, exactly
as L-replay said.

**Level 2 selection, recorded Save against each drifted page** (floor 0.35,
margin 0.2; pool is the drifted Save and Discard)

| mode | before | after |
| --- | --- | --- |
| selector-only | unmatched, best **−0.119** | unmatched, best **0.149** |
| text-only | resolved, 0.370 | unmatched, **0.259** |
| moved | resolved, 0.715 | resolved, **0.783** |
| wrapped-aria | resolved, 0.715 | resolved, **0.783** |
| **reworded-aria** | unmatched, **0.197**, confidence 0.173, runner-up −0.444 | **resolved, 0.389**, confidence **0.366**, runner-up **−0.360** |

- `reworded-aria` before reproduces L-replay's live measurement (0.197 / 0.173 /
  −0.444) to three decimals, and after reproduces D13's published calibration and
  the content harness's expectations (0.389 / 0.366 / −0.360) to three decimals.
  **The harness and the wire now agree, and the drift case resolves live.**
- `text-only` falls from 0.370 to 0.259 and stops clearing the floor. This is
  correct and costs nothing: that rendering keeps its id, so Level 1 resolves it
  by `#save-settings` and never reaches Level 2 — and the veto accepts it at
  0.259 (below). The recorded accessible name now genuinely contradicts the
  candidate's, which is more information, not less.
- Discard alone on the page is refused before and after (−0.444 → −0.360).

**The alternative D13 rejected, bracketed over what the near-miss happens to
carry.** A lone unopposed "Save changes and exit":

| the near-miss carries | before | after |
| --- | --- | --- |
| its own id **and** test id | −0.159 | **0.088** — refused |
| its own id only | 0.022 | 0.226 — refused |
| no identifier, foreign class set | 0.197 | **0.359 — resolves** |
| no identifier, the recorded class set | 0.248 | **0.398 — resolves** |

The first row reproduces D13's published 0.088 exactly, which identifies the
profile D13 measured: a near-miss that carries identifiers of its own, so they
*contradict*. Against the wanted case at 0.389 the separation is the published
0.301 and the floor sits inside it.

**But a near-miss carrying no identifier at all is not covered by that figure**,
and it clears the floor: 0.359 and 0.398 against the wanted 0.389 — a separation
of 0.030 with the floor below both. Alone on a page there is no runner-up and the
margin cannot protect anything, which is precisely the danger D13 named when it
rejected lowering the floor. This is not a regression introduced here — the
harness would have measured the same thing all along — but it was unreachable
while the wire withheld the signals, and it is reachable now. **D13 should not be
reversed; its rejected-alternative argument should be re-stated over this second
profile.** I changed no weight and no floor, as briefed.

## D14 re-measured

Same chain, through `vetoCandidate`. Veto floor 0.

| what a Level 1 class-set query lands on | before | after |
| --- | --- | --- |
| nameless icon button wearing the recorded classes | −0.034, refused | **−0.032**, refused |
| a relabelled destructive action wearing them | −0.056, refused | −0.065, refused |

The impostor side is unmoved, and the after figure reproduces D14's published
worst-impostor headroom (−0.032) exactly.

The legitimate side is where the wire defect bit:

| the drift each mode leaves, which must still be acted on | before | after |
| --- | --- | --- |
| **selector-only** | **−0.119 — REFUSED (contradicted)** | **0.149 — acted on** |
| text-only | 0.370 — acted on | 0.259 — acted on |
| moved | 0.715 — acted on | 0.783 — acted on |
| wrapped-aria | 0.715 — acted on | 0.783 — acted on |
| reworded-aria | 0.197 — acted on | 0.389 — acted on |

D14 says: "All four `identity-drift` modes still resolve; the tightest,
`selector-only` at 0.149, is precisely what a veto set at the floor would have
destroyed." **Live, before this change, `selector-only` was destroyed anyway** —
not by the floor, by the wire: the recording's accessible name and role never
arrived, the candidate's own name and role were on the other side of the
comparison, and the score went negative. 0.149 is the number this change
restores. The veto's separation is intact and its published numbers now describe
the executed path.

---

## What is still lossy

**`context` does not reach the page.** It now crosses the wire — asserted in
`gateway-payloads.test.ts` — and reaches Core's recording timeline. It stops at
`elementFingerprint` in `domain/src/output-nodes/targets.ts`, which has no
`context` key, so it is absent from every Flow node's element. Measured, not
inferred: the recorded identity after the fix carries no `context`, from a
descriptor that had one. That file is not in my ownership. Nothing consumes
`context` on the resolver side today either — `comparableFingerprint` does not
compare it, which is also why `ambiguous-targets`/`form-context` ties at
0.37/0.37 (L-replay's Defect 1, second half). Both halves are one change and
belong to whoever owns `output-nodes/targets.ts` and `content/identity/score.ts`.

**A third hand-written projection of the same descriptor exists.**
`domain/src/recording/web-state/action-target.ts`
`webAutomationActionTargetFromElement` builds the recording event's *envelope*
target and drops all five signals in the same way, by the same mechanism (a
hand-written literal). It feeds the timeline entry's `target`, not the Flow
node's element, so it did not cause this defect — but it is the same shape of
bug waiting, and `present<T>()` would close it. Not mine.

**`recordingEvidencePayload` sends the raw descriptor.** Same file, five lines
above: `element: payload.element`, unprojected, plus the whole `snapshot`. So the
wire redaction added here covers the *action target* path — the one that becomes
a Flow parameter and is replayed — and not the evidence path. I did not change it
because the same descriptors reach Core through `snapshot` regardless, so
redacting one of two exits would be theatre; the real fix is at capture.

**A capture-side hole I did not own.** `describeElement` computes `text` and
`visibleText` from `textContent` (or the element's own text nodes) with **no**
sensitivity gate — unlike `readElementValue`, `reportable-text.ts` and
`accessible-name.ts`, which all ask the rule. A `contenteditable` marked
`data-sensitive="true"`, or carrying a sensitive `autocomplete` token, therefore
puts what was typed into it into `descriptor.text`. The wire projection now
withholds that on the target path; the capture site should stop producing it.
`apps/extension/src/content/describe-element.ts`, not mine. This is a code
reading, not an executed reproduction — it needs a browser.

**A stale claim in a comment.** `output-nodes/targets.ts`
`elementFingerprintSources` says "Measured on the executed path: 12 identity
signals recorded, 1 on the wire before this ordering, 12 after." L-replay
measured 9, and the reason was this defect. After this change the count is
genuinely 11 for that fixture's button (12 minus `label`, which a `<button>` has
none of). The comment should be corrected by its owner.

---

## Commands run and observed results

Exit statuses by redirect into `<name>.txt` in the scratchpad, never a pipe.

| command | exit | observed |
| --- | --- | --- |
| `pnpm --filter @fluxiq-web-extension/extension check` | **0** | clean (two earlier runs failed on other workers' in-flight edits: `content/action-runtime/results.ts` TS2304, then `domain/src/runtime/llm-evidence/elements.ts` TS2353/TS2536 — neither in my files, both since fixed by their owners) |
| `pnpm --filter @fluxiq-web-extension/extension test` | **0** | `# tests 283 # pass 283 # fail 0`, including the six new rows (an earlier run failed 1/281 on `content/actions/tests/page-identity.test.ts`, an untracked file another worker was mid-way through; it passes now) |
| `pnpm --filter @fluxiq-web-extension/domain check` | **0** | clean |
| `pnpm --filter @fluxiq-web-extension/domain test` | **0** | `# tests 331 # pass 331 # fail 0`, including the four new rows |
| `pnpm --filter @fluxiq-web-extension/extension test:content` | **0** | `198 passed, 1 skipped (28.8s)`, all `identity-resolution.spec.ts` rows green including `reworded-aria` at 0.389 |
| `node scripts/structure-audit.mjs` | **0** | `passed (32 warning(s), 17 baselined)`. Before my change it exited 1 on six `contract-spread` violations in `domain/src/runtime/llm-evidence/` belonging to another worker; those are gone. My change adds one advisory: `protocol.ts` 435 lines, past the 400-line warn threshold (hard limit 800). No baseline entry needed. |
| `tsc -p apps/extension/tsconfig.json --noEmit`, twice under mutation | **2**, **2** | the two mutation proofs above; both reverted |
| the D13/D14 measurement, bundled with esbuild and run in Node | **0** | the tables above; run twice with byte-identical output |

The measurement ran twice with identical numbers, so nothing in it is this
machine's memory. The two surprising failures (the extension `check` and the one
failing unit test) were each re-run and each turned out to be another worker's
in-flight edit rather than hardware.

---

## Not verified

- **The live replay has not been repeated against this fix.** I cannot run the
  Lab. Everything above is a unit-level and harness-level measurement of the same
  chain L-replay executed; whether a real Flow now resolves `reworded-aria` is
  unproven until someone reruns `pnpm lab run identity-drift --flow --variant
  reworded-aria --target isolated`. L-replay's Defect 2 (the evidence writer
  crashing on a repeated object reference) will still hide the failure record if
  it refuses, so that one-line fix should land first.
- **`apps/extension/build/` is stale.** It is tracked and I was told not to run
  `pnpm build`, so the shipped content bundle does not yet contain this change.
  The supervisor must rebuild before any browser test means anything.
- **The candidate fingerprints in the measurement are reconstructed** from the
  fixture markup as `candidateFingerprint` would describe it, not read off a live
  page. The fact that the before-figures reproduce L-replay's live numbers to
  three decimals, and the after-figures reproduce D13's and D14's published ones,
  is the evidence that the reconstruction is faithful — but it is evidence, not
  a live capture.
- **`ambiguous-targets` was not re-measured.** D13 cites it ("resolves the
  recorded twin at 1.000 against 0.382"); its recorded descriptor is a different
  fixture I did not reconstruct. Its Level 1 path resolves by test id, so this
  change should not move it, but that is an expectation.
- **The capture-side `visibleText` hole** is read from the code, not reproduced
  in a browser.
- **Firefox, iframes, and the `context`-consuming path** are untouched by
  anything here.
- I did not measure the veto over the enumerated recording classes — the brief
  says another worker owns that — only the specific cases D14's text names.

## Open questions for the supervisor

1. **D13's rejected-alternative argument needs re-stating.** A near-miss with no
   identifier scores 0.359–0.398 and resolves alone. The decision's 0.088 figure
   is a different profile. This does not argue for reversing D13 — it argues that
   the "any floor between them is fitted to a hair" reasoning was measured over
   one profile only. Worth a paragraph in D13 before the week closes.
2. **`context` needs a consumer or a reason not to have one.** It crosses the
   wire now and dies at `elementFingerprint`. Adding it there and comparing
   `formName`/`fieldsetLegend` in `comparableFingerprint` is also the fix for
   `form-context` tying at 0.37/0.37. Two files, neither mine.
3. **`webAutomationActionTargetFromElement` is the same bug, unexploded.** One
   more hand-written projection of the same descriptor.
4. **`describeElement` should ask the sensitivity rule before it reads
   `textContent`.** Every other reader in `content/` does.
