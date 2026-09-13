# Report: L-review

Worker: `L-review`. Read-only integration review of the day's two commits with
fresh eyes: `1b6f5df` here and `a575df2` in `F:\!FluxIQ`. Nothing in either tree
was changed; no build, no test suite, no Lab command was run.

## Outcome

**Done.** Nine findings, ranked. One is a real residual safety hole I would fix
before live validation; two are false or overstated sentences on security- and
diagnostics-relevant code; the rest are small.

**The body of work is sound.** I went looking specifically for the plan's two
signature defects — work that lands inert, and tests that cannot fail — and
found much less than the brief expected. The page-evidence joinery, the
redaction sentinel tests, the veto separation test and the domain state ratchet
are all genuinely load-bearing; several are the best tests in the repository.
Every new production export I traced has a production caller. What I did find is
mostly documentation that outran the code.

I could not run anything, so every claim below is derived from reading the code.
Where I quote a number I computed it; the method and its validation are stated.

---

## 1. The Level 1 veto's margin belongs to the *fixture's recording*, not to the veto

**Silently wrong in production. Highest consequence here.**

`apps/extension/src/content/identity/veto.ts` refuses an exact match scoring
below 0. `reports/v-level1-veto.md` justifies the threshold with an exhaustive
enumeration: "1,488 for the class set, 240 for the exact text — **not one
profile whose label contradicts the recording reaches 0** (the highest is
-0.032)".

That enumeration varies the **candidate**. It holds the **recording** fixed at
the `identity-drift` descriptor, which carries `id: "save-settings"` *and*
`testId: "save-changes"` (the `RECORDED` constant at
`apps/extension/src/content/identity/tests/veto.test.ts:35`). Those two signals
supply nearly all the negative weight. A recording that carries neither loses
them, and `normalizedScore` divides by a correspondingly smaller
`possibleScore`, so the same impostor lands **above** zero.

I replicated Core's arithmetic exactly (`scoreElementFingerprintCandidate` in
`packages/fluxiq/src/programs/automation-studio/fingerprinting/element-fingerprint.ts`:
`possibleScore` accumulates only for signals the *recording* carries;
`normalizedScore = total / possible`). The model is validated — it reproduces
the report's own published numbers to three decimals.

| Recording | Impostor the class-set query lands on | score | veto |
| --- | --- | --- | --- |
| fixture's (id + testId) | nameless icon button, same class set | **-0.032** | refuse — matches the report exactly |
| fixture's, Core alpha = -0.55 | same | **-0.203** | refuse — matches the report exactly |
| fixture's (id + testId) | "Delete workspace", same class set | **-0.065** | refuse — matches the report exactly |
| **no id, no testId** | **nameless icon button, same class set** | **+0.010** | **act — clicked** |
| no id, no testId | "Delete workspace", same class set | -0.044 | refuse, by 0.044 |

The reachability is not contrived. `element-finder.ts:34` fires the class-set
query only after the selector, xpath, id, test id and authored-name queries have
missed — and with no id and no test id recorded, two of those five never run at
all. A `<button class="btn btn-primary">Save changes</button>` with no `id` and
no `data-testid` is an ordinary control, and it is exactly the recording the
class-set fallback exists for. The contributions for the +0.010 row:
visibleText -0.45x24 and accessibleName -0.45x24 (both "candidate is missing
text", the -0.45 branch, not the -0.55 contradiction branch), selector
-0.25x14, role +10, tagName +7, classNames +5, visibility +4 → +0.9 over a
possible 88.

Two qualifications, both in the change's favour. This is **not a regression** —
that click happened before the veto too. And it is **not caused by the Core
change**: with no identifiers recorded, the constant never applies, so the row
reads +0.010 on both scales. What the Core change did do is remove the cushion
everywhere else — the worst impostor against the *fixture's* recording went from
-0.203 to -0.032 — and the report says so plainly.

**What I would expect instead.** Either re-run the enumeration with the recorded
descriptor as a second axis (at minimum: with and without each stable
identifier), or stop `veto.ts` claiming a property measured only for
identifier-bearing recordings. Its "**What the veto cannot do**" section names
two limits; this is a third and is not one of them — limit 1 is about a
recording with no *text*, and this recording has text. The cheapest concrete
guard is a third row in `identity/tests/veto.test.ts`: the nameless icon
impostor scored against a `RECORDED` with `id` and `testId` removed.

## 2. `secretSafeDispatchPayload` claims a threat model it does not meet

**Misleading sentence on a security guard. Six redaction leaks in this plan make
it worth correcting rather than leaving.**

`domain/src/runtime/adapter.ts:258-259`:

> This module's whole reason for re-establishing the failure record rather than
> trusting it is that what crossed a process boundary is validated here. [...]
> **A client one version behind, or one that is not this extension at all, gets
> the same answer.**

It does not. `withholdComparison` (`adapter.ts:98`) is
`isSensitiveElementDescriptor(element) && !isProducerRedactedComparison(validation)`,
and `isProducerRedactedComparison` reads `validation.redacted === true` **off the
wire**. Any client that sets that one boolean disarms both the record
withholding and the payload withholding, whatever the strings contain.

The asymmetry sits inside one function's neighbourhood: `clientReportedFailure`
twenty lines above deliberately **rebuilds** the sender's failure record from its
code rather than trusting the sender's classification, and says so; the same
module then trusts the sender's redaction claim outright.

The trade may well be right — `domain/src/sensitivity/redaction.ts` argues it
carefully, the diagnostic cost of not honouring the flag is real, and the flag
does fail safe when *absent*. It does not fail safe when *falsely asserted*, and
the sentence quoted says it does. No producer can diverge today: `type.ts:56`,
`clear.ts:46`/`:60` and `select.ts:75`/`:83`/`:93`/`:118` all write
`redacted: withheld` with the same `withheld` that gates `describeFieldValue`.
The exposure is a future verb, or a client that is not this extension — the case
the sentence names.

**What I would expect instead.** Either delete the "not this extension at all"
clause and state plainly that the flag is trusted from the client, or stop
honouring it from a client the domain did not build. The sentence has to change
either way.

## 3. `resolution` is produced, declared on the wire type, and dropped — and one header says otherwise

**Not a defect; a false sentence over a deliberately dead field.**

`resolve-target.ts:32-33` says the record and the measurement are lifted "onto
the result the Flow receives". The record is. The measurement is not:
`webAutomationActionResultPayload` (`domain/src/client/gateway-mapping.ts:217`)
does not carry `resolution`, and `gatewayActionResultFromBrowserResult`
(`apps/extension/src/runtime/result-mapping.ts:48`) adds only `failure` and
`visualTarget` beside it. The drop is deliberate and pinned —
`domain/src/client/tests/gateway-mapping.test.ts:409` asserts "resolution is
still dropped by the result mapping", with a good reason given.

So `WebAutomationActionResult.resolution` (`domain/src/actions/types.ts:301`) is
a field the extension fills on every failed resolution and nothing outside the
extension ever reads. `resolveTargetWithDiagnostics` likewise has exactly one
production caller — `resolveTarget`, which throws the `resolution` away.

The practical loss is nil, because `notFound` and `scoredAmbiguous` also put the
score into the record's `actual` prose ("...; best scored 0.42"), which does
reach the Flow — so the header's *neighbouring* claim, that a near-miss and a
hopeless page are distinguishable to a Flow, holds. Only the sentence about the
measurement is wrong.

**What I would expect instead.** Two lines in the `resolve-target.ts` header
saying the measurement stops at the content-script result, pointing at the
gateway-mapping test that pins it.

## 4. The compiler guard `carrier.ts` documents exists only in its own test

`domain/src/runtime/failure/carrier.ts:20` and `:40` say the failure code is
"compiler-checked at the throw" and instruct producers to
`implements WebAutomationFailureCarrier`. No production class does:

- `apps/extension/src/content/actions/execute.ts:76` types
  `readonly failure: WebAutomationFailureRecord` — closed set, correct, but by
  the field type rather than the interface;
- `apps/extension/src/content/action-runtime/resolve-target.ts:115` types
  `readonly failure: AutomationStudioFailureRecord` — **Core's** record, whose
  `code` is a bare `string`. An out-of-set code written there compiles.

`v-error-seam`'s mutation proof (its lines 190-210) was run against a class
declared inside `carrier.test.ts`, not against either production carrier, so its
"a mutation introducing an out-of-set code at all three surviving doors is
rejected by `tsc`" does not cover `TargetResolutionError`.

Blast radius is small: `results.ts`'s `reportedFailure` gates on
`isWebAutomationFailureCode` at runtime, so an out-of-set code would be silently
ignored and the failure reclassified rather than reaching the wire. But "silently
ignored" is the failure mode this seam exists to end, and the fix is one
declaration plus one type — the same fix `v-error-seam` applied to
`UNSUPPORTED_ACTION_TYPE_FAILURE`, one file over.

## 5. Two stale sentences whose replacements are already written

`v-error-seam.md`, "Files I do not own", lists three edits with exact
replacement text. Item 1 landed (`gateway-mapping.ts`'s
`UNSUPPORTED_ACTION_TYPE_FAILURE` is now built by the builder). Items 2 and 3
did not:

- `apps/extension/src/content/action-runtime/results.ts:73` still reads "the
  domain's classifier honours a `WebAutomationRuntimeError`" — a class this same
  commit deleted (`domain/src/runtime/errors.ts`, -9 lines).
- `domain/src/runtime/tests/adapter.test.ts:143` still attributes the behaviour
  to `classifyWebAutomationFailure` and "a runtime error"; the mechanism is now
  `carriedWebAutomationFailure` and a thrown record.

Both replacements are written verbatim in that report; this is a copy-paste.

## 6. `RunLaneObservation.automationFailureExpected` is filled by both lanes and read by nobody

`packages/test-runner/src/flow-lane/lane-observation.ts:12` includes it in the
`Pick`; `run-flow-lane.ts:95` and `run-scenario.ts:394` both set it.
`evaluate-run.ts:170` deliberately uses `identity.expectedFailure` instead — the
corpus plan's resolved value — with a comment explaining why. Nothing reads the
observation's copy.

Harmless today (the two resolve to the same value) and using the plan's is the
right choice. But a second, unread copy of the field a metric is scored on is
how the two come to disagree later. Drop it from the `Pick` and from both
constructors.

## 7. One merge path drops the top frame's additive evidence

`apps/extension/src/background/connection/dom-snapshot.ts:148-177`. `topEvidence`
is set only from an entry in `frameSnapshots` (`entry.snapshot === topSnapshot ||
frame?.isTop === true`). If `topSnapshot` came from `topFallback` — the separate
`captureSingleFrameSnapshot(tabId, 0)` at line 138 — and `allTabFrames` returned
no frame 0 and nothing flagged `isTop`, then `topEvidence` stays `undefined` and
the merge runs as `mergePageEvidence(frameEvidence, pageEvidenceOf(topSnapshot))`.
`base` supplies only `navigation` and `loading.documentState`; the top frame's
dialogs, overlays, regions, forms and element totals are **not** in
`contributions` and are dropped from the merged page.

Narrow, and probably unreachable in Chromium, where frame 0 is always in
`webNavigation.getAllFrames`. Worth one line of code — push the fallback into
`contributions` when it is not otherwise represented — rather than one line of
comment, because the symptom is "two documents carrying less evidence than one",
exactly the class of defect the rest of that file was rewritten to end.

## 8. The page-evidence contract is joined everywhere except at its own top-level key

The contract move is good work and the joinery test is the strongest test in the
commit. One hop is still restated three times, and it is the hop that carries
everything else: the snapshot's `evidence` key itself.

- `apps/extension/src/shared/protocol.ts` `DomSnapshot.evidence` (producer);
- `domain/src/recording/web-state/evidence/input.ts:59`
  `type SnapshotCarryingEvidence = { evidence?: ... }` (state reader);
- `apps/extension/src/background/connection/dom-snapshot.ts:62`
  `DomSnapshotPayloadWithEvidence` (merge).

`WebAutomationDomSnapshotInput` (`domain/src/recording/web-state/types.ts:29`)
does not declare it, which is why all three exist and why both the ratchet
fixture and the joinery fixture need casts. Rename the key and nothing goes red.
`input.ts` names the residue honestly, so this is a completion note rather than a
finding: adding `evidence?: WebAutomationPageEvidence` to
`WebAutomationDomSnapshotInput` closes the last hop and deletes two of the three
local types.

## 9. Two unit tests now assert an inheritance no lane reads

`scenarioPageFactSchedule` (`packages/test-contracts/src/scenario-workflow.ts`)
takes `pageFacts` out of the replace-or-inherit merge: for
`arms-before-loading` with a variant, `atLoad` is
`variant.expected.pageFacts ?? []`, so a variant declaring none now checks
nothing where the merged workflow's facts used to be checked against the armed
page. That is the intended new contract and it is documented in three places.
But `ResolvedScenarioWorkflow`'s own doc admits the `intermediate-state` and
`multi-tab` unit tests "assert that a variant inherits it" — they now pin a value
the runner does not consult, so a reader who changes the inheritance rule will be
stopped by tests that no longer describe behaviour.

---

## What I checked and found sound

Stated so the supervisor does not spend a worker on them.

- **The four pairs the brief named.** *Veto x Core scoring*: the report's two
  scoring-scale columns reproduce exactly under my replication of Core's formula
  (-0.203 / -0.032 / -0.065), so the published numbers are right; finding 1 is
  about their scope, not their accuracy. *Redaction flag x the two guards*: the
  chain composes correctly — the producer's `redacted` survives `boundValidation`
  (`validation-outcome.ts:79`, the one line the whole flag depends on),
  `webAutomationSecretSafeValidation` passes a declared validation through and
  stamps nothing, `secretSafeDispatchPayload` stamps nothing, and both layers are
  idempotent. *Page-evidence contract x frame merge*: `present<T>()` really does
  force exhaustiveness (a plain property in a literal is excess-checked; a spread
  is not), and both merge functions go through it. *Lane page-fact schedule x
  Flow-lane navigation*: `atLoad` for the Flow lane is byte-for-byte what it
  checked before, `afterArm` is new and correct, and `armingOf` matches
  `resolveWorkflow`'s own refusals.
- **Inert work.** I traced every production export added by `1b6f5df`:
  `present`, `reportableText`, `vetoExactMatch`, `scoreTargetCandidate`,
  `carriedWebAutomationFailure`, `pageEvidenceWire`, the whole `page-evidence`
  directory, `benchExecutionCoverage`, `benchRatePopulation`, `executedNothing`,
  `actionsExecuted`, `scenarioPageFactSchedule`, `openScenarioStart`,
  `laneForResult`, `expectedActionOutcomes`, `UNARMED_NEEDS_RECORDING_LANE`,
  `VARIANT_NEEDS_FLOW_LANE`, `FLOW_LANE_SOURCES`,
  `WEB_AUTOMATION_ELEMENT_SUMMARY_STATE_IDS`,
  `WEB_AUTOMATION_PAGE_EVIDENCE_CAPTURES`. Every one has a production caller
  except the three named above (findings 3, 4, 6) and
  `WEB_AUTOMATION_PAGE_EVIDENCE_CAPTURES`, which is fixture data by design. No
  seventh inert change of the "scorer with no input" kind.
- **Tests that cannot fail.** `adapter-redaction.test.ts` and
  `gateway-mapping-redaction.test.ts` search the whole serialized result for a
  sentinel rather than one named field, which is the right shape.
  `page-evidence-joinery.test.ts` asserts both directions and, in its
  drop-a-field loop, re-asserts that the reader reports *something* with the
  field restored — closing the "a reader that never reports anything" hole in the
  negative row. `veto.test.ts` pins the separation rather than values, and both
  its populations are real. `domain.test.ts`'s ratchet fixture is now exhaustive,
  which is what makes the thirty new state declarations load-bearing. The
  `?.`-on-both-sides comparisons in `page-evidence-capture.test.ts` (e.g.
  `evidence.dialogs?.open.length` against `MODAL_FLOWS.dialogs?.open.length`)
  would be vacuous only if the capture were regenerated empty; the real captures
  make them live today.
- **Bench honesty.** `executed` requiring `reportedVerdict === "passed"`,
  `executedNothing` as the single shared counting rule, `benchRatePopulation`
  shared by the rate and by the coverage breakdown, and the contract's
  absent-means-unmeasured handling of `notExecutedRuns` are consistent end to
  end. The `actionsExecuted === sum of actionLatencyMs[*].samples` invariant is
  satisfiable: both lanes filter on `durationMs !== undefined` before actions
  reach `RunEvaluation.actions`. The corpus really does expand to 43 results —
  23 unarmed rows plus 20 variants across the 28 rows of `week1.ts`.
- **Redaction, other paths.** `capturedSelectionText`'s three questions are
  sound, and the `activeElement` one is genuinely what closes the live leak.
  `reportableText` withholds a container's contents *and* anything sensitive, and
  `<input>` is not in `LABELLED_TAGS`, so the veto's own summary string — which
  reaches a failure record with no descriptor beside it, and so is unredactable
  downstream — cannot carry a field value.
- **Core `a575df2`.** The constants are named, the change is one line of
  behaviour, and both the direction and the accepted confidence cost
  (0.428 to 0.577 on the published seam) follow from the formula as written.

## Not verified

- Anything requiring execution. No build, no test, no Lab command, no browser.
  Every figure in finding 1 is arithmetic over Core's published formula, not a
  measurement — validated only by its agreement with three of
  `v-level1-veto.md`'s own numbers.
- The Core-side figures in `v-core-scoring.md` (0.389 / 0.088 / separation
  0.301) depend on the `identity-drift` fixture's live DOM; I did not reconstruct
  it.
- The bench's 30% headline, the "16 of 23" count, and the repeatability
  tolerance argument. The predicate change is clearly right; the counts are not
  checkable by reading.
- The e2e specs (`redaction.spec.ts`, `identity-resolution.spec.ts`,
  `negative-variants.spec.ts`) were read only where they bore on a finding.
- Report coverage is partial. I read `v-level1-veto` and `v-error-seam` in full
  and spot-checked others' strongest claims; I did not audit every report against
  its code.

## Open questions or contradictions found

1. **Whose recording does the veto's guarantee cover?** Finding 1. Until that is
   answered, the veto should be described as closing the exposure *for recordings
   that carry a stable identifier*, not in general.
2. **Is the `redacted` flag a trusted wire input by decision?** Finding 2. If
   yes, `adapter.ts`'s threat-model sentence is wrong; if no, the guard must stop
   honouring it from a client the domain did not build.
3. **Should the veto apply to `coordinates` and `visual-target`?** It does, and
   `v-level1-veto` calls it "in practice untouched". Both those strategies and
   `element` come from the same command parameters today, so I found no live
   divergence — but if a model ever supplies a fresh point beside a stale recorded
   descriptor, the veto will refuse a deliberate click. A note in the header
   rather than a change.
