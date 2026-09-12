# Report: v-inventory

A single prioritised inventory of everything Wave 3's workers said they did not
verify, grouped by **what a test would have to do to close it** rather than by
which report raised it.

## Outcome

**Done.** Twenty-eight reports read in full — the twenty-seven `w3-*.md` files in
this directory plus `core-expectation-evaluator.md`, which lives in Core at
`F:\!FluxIQ\docs\working\mvp-week1-web-automation-reliability-plan\reports\core-expectation-evaluator.md`
(the brief said seventeen; seventeen workers were dispatched at the wave's
opening and ten more mid-wave, and each wrote a report).

Nothing was tested and nothing was changed. Six small read-only greps were run
against the tree to settle claims that two reports disagreed about; each is
identified where it appears and none of them changed a file.

**The three things worth reading first**, ahead of the groups:

1. **[G2](#g2--the-scoring-calibration-transfers-to-a-flow-only-if-two-unverified-domain-changes-are-right)** — the entire Level 2 scoring calibration is
   claimed to transfer from the harness to a live Flow on the strength of two
   domain changes that both say, in their own words, that they were never
   exercised in a browser. It is the wave's longest verified-rests-on-unverified
   chain.
2. **[G11](#g11--one-worker-widened-what-travels-another-narrowed-what-it-may-contain-and-nothing-tests-the-join)** — `w3-domain-contract-gaps` widened what
   `validation` carries to the domain and explicitly did not check that
   `w3-redaction-followup`'s redaction was in place underneath it. Both landed.
   No test covers the pair. The only two files in the repository that mention the
   fixture's synthetic secrets are a content-harness spec and a domain unit test
   with a fake dispatch, so nothing asserts a secret-free `validation` on the
   domain side.
3. **[G4](#g4--the-autocomplete-fixture-gap-does-not-exist-and-the-real-gap-is-cheaper)** — `w3-autocomplete-signal` names a missing fixture as
   "the gap worth closing next". The fixture is not missing; it was committed
   39 minutes before that report was written. The real gap is one spec row.

A note on what "unproven" means across the whole wave: **twenty-five of the
twenty-eight reports say some version of "no live browser validation."** That
sentence is nearly uninformative on its own. What follows separates the cases
where the sentence is a formality (nothing browser-specific changed) from the
cases where it is the substance of the risk.

---

## Group A — Needs a real browser with the unpacked extension loaded

The T2 content harness runs the real content bundle in real Chromium, but with
no background worker, no tab routing, no gateway and no frame delivery — its own
header says it "proves nothing about delivery between extension contexts."
Everything in this group is on the far side of that line. A T3 Lab run loads the
unpacked extension (`packages/test-runner/src/{run-scenario,interactive-session}.ts`
and `demo-workspace/browser-session.ts` all pass `--load-extension`).

### A1. Frame-addressed delivery actually reaching the addressed frame

- **Unproven:** that `chrome.tabs.sendMessage(..., { frameId })` delivers to that
  frame. The Node stub proves the runner *passes* the right id.
- **Claimed by:** `w3-frame-plumbing` ("does not prove Chrome delivers to that
  frame, and the content harness has no frame routing at all"); the same hole is
  named from the other side by `w3-domain-contracts` and `w3-evidence-finish`.
- **Observable:** load the extension, open a page with an out-of-process iframe,
  dispatch `web.dom.click` at `frameId: N`; assert the click landed in the child
  document and that the returned element descriptor came from it.
- **Risk: silently wrong in production, and this is the worst shape in the
  inventory.** Before this change every replay of an iframe interaction ran
  against the top document. If delivery still lands top-frame, the action finds
  *a* matching selector, clicks it, and reports success. A wrong click that
  reports success is strictly worse than a failure, and no gate can see it.

### A2. Child-frame content-script recovery after an extension reload

- **Unproven:** that reinjection reaches the frame it is told to, and that an
  extension update really does leave the previous script alive and answering in
  a child frame.
- **Claimed by:** `w3-extension-gaps` ("what is untested end to end is the actual
  scenario the fix exists for — reload the unpacked extension, leave a page of
  iframes open, and dispatch an action at a child frame"); `w3-frame-plumbing`
  independently identified the same seam before it was granted.
- **Observable:** load the extension, open an iframe page, reload the extension
  from `chrome://extensions`, dispatch at a child frame. Expect re-injection and
  a successful action; expect a genuinely absent frame to come back
  `TARGET_NOT_FOUND` reading `expected: "frame 7 in the tab"`.
- **Risk: visibly broken immediately** — the action fails. The concern is
  diagnosis, not silence: today the same situation produces Chrome's anonymous
  "Could not establish connection", mapped to `web.action.failed`, which names no
  frame. If the fix does not work the symptom is unchanged from before it.

### A3. `chrome.webNavigation.getAllFrames` on a mid-navigation frame

- **Unproven:** what the frame-existence check sees for a frame that is
  navigating. "Reasoned from the API contract, not observed."
- **Claimed by:** `w3-frame-plumbing`.
- **Observable:** dispatch at a frame while it navigates; check whether the frame
  is reported missing.
- **Risk: silently wrong, but self-correcting.** A false `TARGET_NOT_FOUND` is
  retryable per the code table, so Core retries and the run probably survives.
  The cost is latency plus a diagnostic that blames the page.

### A4. The wire hop for every redaction guard

- **Unproven:** that nothing sensitive survives content script → background
  worker → gateway. Four reports state plainly that redaction is *decided* inside
  the content script and that the harness therefore exercises the whole
  *decision* — and that the hop itself was never exercised.
- **Claimed by:** `w3-redaction`, `w3-redaction-followup`,
  `w3-sensitivity-consolidation`, `w3-autocomplete-signal`.
- **Observable:** load the extension, record on the `sensitive-input` fixture,
  capture the actual gateway traffic and the stored recording, and search the
  whole serialized form for all four synthetic values
  (`SYNTHETIC_PASSWORD_DO_NOT_USE`, `4111111111111111`, `4222222222222220`, the
  synthetic username) — not named fields.
- **Risk: silently wrong in production, and highest consequence of anything
  here.** Three separate leaks were found in this wave, and every one of them was
  found only because someone searched the whole serialized payload rather than a
  named field: the typed password in `validation.expected`/`actual`, the card
  value in the snapshot, and the card number in `snapshot.selectedText` via
  `window.getSelection()`. A fourth leak living on the far side of the wire would
  look exactly like the first three did — invisible, with every gate green.

### A5. The cross-frame evidence merge on a real iframed page

- **Unproven:** the merge's behaviour on a real page. Ten tests drive the real
  function through a fake transport with hand-written frame snapshots. "The rect
  translation in particular is proven against my arithmetic, not against a
  browser."
- **Claimed by:** `w3-evidence-seams`; restated by `w3-evidence-consumption` ("the
  frame snapshots in the pipeline test are hand-written… what is proven is the
  joinery, not the browser behaviour those snapshots stand for") and
  `w3-evidence-finish`.
- **Observable:** record on a two-frame page with a dialog inside the child frame.
  Assert `evidence.dialogs.open[0].selector` reads `frame[N] >> …` and that its
  bounds are translated onto the top frame's page coordinates (the unit test uses
  frame-local `{x:10,y:10}` → page `{x:50,y:270}`).
- **Risk: silently wrong.** A wrong rect translation yields plausible
  coordinates, and a visual-target click then lands somewhere real but wrong.
  Hand-written frame snapshots are exactly where an assumption about the browser's
  frame geometry gets baked in and then asserted against itself.

### A6. Firefox

- **Unproven:** anything, on Firefox. Six reports say no Firefox build was
  loaded (`w3-assert-timing`, `w3-extension-gaps`, `w3-frame-plumbing`,
  `w3-failure-code-invariant`, `w3-protocol-narrowing`,
  `w3-sensitivity-consolidation`).
- **Observable:** load the Firefox build; run one frame-addressed action and the
  redaction sweep from A4.
- **Risk: mostly visibly broken** (API and manifest differences surface at once)
  **with one silent exception.** `w3-sensitivity-consolidation` says its selection
  guard's third question "is justified partly by Firefox's differing treatment of
  form controls inside a document range", and that this justification "is
  reasoning about why not to depend on a rendering detail, not a measurement of
  Firefox." A selection leak that exists only on Firefox is silent.

### A7. `web.browser.tab` close and `web.browser.download`

- **Unproven:** that either capability works at all. Every failure path is a stub
  — a rejecting `chrome.tabs.create`, an absent `chrome.downloads`.
- **Claimed by:** `w3-worker-codes` ("recorded in
  `docs/architecture/web-capabilities.md` as never exercised in a browser, and
  this change does not alter that").
- **Observable:** one Lab row that closes a tab, one that downloads a file.
- **Risk: visibly broken immediately.** The action either works or it does not.
  Low priority relative to everything above it.

### A8. `NAVIGATION_UNEXPECTED` has no content-side producer

- **Unproven:** the whole category. Its only producer is
  `runtime/action-results.ts`, which runs in the background worker; the content
  harness does not run one.
- **Claimed by:** `w3-spec-reconciliation` ("if Wave 4 wants that category
  proven, it needs a T3 Lab row, not a content spec"); `w3-failure-producers`
  reached the same wall from the other side.
- **Observable:** a Lab row that navigates somewhere the Flow did not ask for.
- **Risk: silently wrong.** An unexpected navigation reported as something else
  (or not reported) is how a Flow ends up acting on the wrong page.

---

## Group B — Needs a real page but not a real extension

Everything here is reachable from the T2 content harness today. Each is a spec
row, or a spec row plus a line of fixture markup. Cheapest group per unit of
risk closed, and the group most likely to be skipped because each item looks
small on its own.

### B1. The `autocomplete` evidence field, on a fixture that already has one

- **Unproven:** that the producer emits `autocomplete` from a real DOM, and that
  the projection's second sensitivity check therefore fires on a card field.
  Covered only by a stubbed unit test.
- **Claimed by:** `w3-autocomplete-signal` — which attributes the gap to a
  missing fixture. **That attribution is wrong; see [G4](#g4--the-autocomplete-fixture-gap-does-not-exist-and-the-real-gap-is-cheaper).**
  The fixture exists. `evidence.spec.ts` simply never visits it: it runs on
  `product-catalog`, `intermediate-state`, `infinite-feed` and `modal-flows`.
- **Observable:** one `evidence.spec.ts` row on `sensitive-input` asserting
  `evidence.forms[].controls[].autocomplete === "billing cc-number"` arrives
  intact — in particular that the sixteen-token / sixty-four-character bound did
  not cut a token in half.
- **Risk: silently wrong.** This field is the *second* of two independent checks
  on a card field, added because the first has failed twice in this plan. A
  second check that silently never fires is worse than no second check, because
  it is counted as defence.

### B2. Sensitive `<select>` redaction

- **Unproven:** all eight redacted sites in `select.ts`. "The withheld branches
  themselves have no live proof."
- **Claimed by:** `w3-redaction`, `w3-redaction-followup`.
- **Observable:** add a `<select autocomplete="cc-exp-month">` to
  `sensitive-input`; one `select.spec.ts` row searching the whole result.
- **Risk: silently wrong — a leak.**

### B3. `clear.ts`'s and `type.ts`'s withheld failure branches

- **Unproven:** the branches reached only when a page rewrites a field's value in
  its own `input` handler.
- **Claimed by:** `w3-redaction-followup`.
- **Observable:** a fixture control that refills itself; assert the result's
  validation strings carry the withheld marker rather than the value.
- **Risk: silently wrong — a leak**, on a narrow path.

### B4. The `data-sensitive` signal has no live coverage anywhere

- **Unproven:** one of only **three** signals in the shared sensitivity rule.
  Confirmed by grep: `data-sensitive` appears **zero** times in
  `apps/scenario-lab/src`.
- **Claimed by:** `w3-sensitivity-consolidation` ("no registered fixture has an
  element marked `data-sensitive`"), `w3-redaction`.
- **Observable:** a `data-sensitive` element on `sensitive-input`, wrapping
  document text; one selection-redaction row and one descriptor row.
- **Risk: silently wrong — a leak.** A third of the rule is proven only by unit
  tests over synthetic signatures, and this is the signal a host application
  would use to mark its own custom fields.

### B5. `truncated: true` is never exercised, and three flags now share the name

- **Unproven:** that any truncation flag ever flips. No fixture exceeds the
  2,000-element cap; `infinite-feed` tops out near 360.
- **Claimed by:** `w3-evidence` ("the flag flipping is proven only by
  construction"). `w3-state-identity` warns that `truncated` now means three
  different things across the wave — its own `eligible > captured`,
  `w3-evidence`'s pre-filter total, and `w3-llm-packet`'s byte-budget trim — and
  that "three flags with the same name on one evidence path will be read as one
  fact by whoever consumes them."
- **Observable:** a fixture (or a scrolled `infinite-feed`) past 2,000 elements;
  assert all three flags and that the funnel invariant `returned <= matched`
  still holds.
- **Risk: silently wrong.** The flag is the only thing telling a Flow that the
  page description it is reasoning over is incomplete. A truncated page that
  reports `truncated: false` makes an LLM confidently conclude an element is
  absent when it was merely cut.

### B6. `armPending: true` and the native `<dialog>` `:modal` branch

- **Unproven:** `armPending` is only ever observed `false`; no fixture uses a
  native `<dialog>`, so neither the `:modal` branch nor its `aria-modal` fallback
  is covered by a spec.
- **Claimed by:** `w3-evidence`.
- **Observable:** a fixture with a native `<dialog>`; one capture with the
  page-world override absent.
- **Risk: mixed.** `armPending` failing is visible (the dialog verb already
  refuses). The `:modal` fallback is **silently wrong**: if `matches(":modal")`
  throws and the ARIA path disagrees, modality is misreported and an automation
  acts on a page that is blocked.

### B7. The assert verb's "present with wrong text, then detaches" edge

- **Unproven:** "no row exercises an element that is present with the wrong text
  and then disappears before the deadline." The report calls its own answer
  (TIMEOUT, because the verdict is the last attempt's) "a judgement, not a proof."
- **Claimed by:** `w3-assert-timing`.
- **Observable:** an `intermediate-state` row where the subject mutates and then
  detaches; assert which of TIMEOUT / STATE_MISMATCH comes back.
- **Risk: silently wrong in classification, with a real consequence.** TIMEOUT is
  `retryable: true`; STATE_MISMATCH is `retryable: false`. The wrong one changes
  whether Core retries. See also [F2](#f2--the-assert-verbs-new-timeout-status).

### B8. `AUTH_REQUIRED` from an assert command

- **Unproven:** "the AUTH_REQUIRED path this change preserves for
  `web.dom.assert` is not exercised anywhere… That is the one gap I would close
  next."
- **Claimed by:** `w3-protocol-narrowing`, which names the exact row.
- **Observable:** a `failures.spec.ts` row on `auth-gate`: a `url` or `absent`
  claim carrying a selector that matches nothing, on the gate page.
- **Risk: silently wrong.** An auth wall reported as STATE_MISMATCH
  (`retryable: false`) rather than AUTH_REQUIRED means the Flow stops with a
  reason that sends an operator to the assertion instead of to the login.

### B9. The `AUTH_REQUIRED` heuristic on a login wall with no `<form>`

- **Unproven:** "`auth-gate` is a well-formed sign-in page. A single-page app
  that renders its login wall without a `<form>`… is not covered."
- **Claimed by:** `w3-failure-producers`.
- **Observable:** a second auth fixture with no `<form>` element.
- **Risk: silently wrong but fails safe.** It under-detects; the report shows it
  cannot false-positive, because the control must have a layout box.

### B10. Level 2 scoring's success path on `identity-drift`

- **Unproven:** that a scored resolution ever *succeeds* on the drift fixture.
  All four drift modes resolve through Level 1 exact strategies, so no score is
  involved. Level 2 is reachable on that fixture only in the case where it must
  refuse.
- **Claimed by:** `w3-matcher-packaging`; echoed in the plan's `Current State`.
- **Observable:** a fifth `identity-drift` rendering that drifts the text while
  keeping an `aria-label` — one line of markup in
  `apps/scenario-lab/src/scenarios/identity-drift/` — plus a row asserting the
  Save control resolves at roughly 0.5 against the 0.35 floor.
- **Risk: silently wrong, and this is the fixture whose absence hides the
  scariest measured number in the wave.** With the text drifted away, the
  best-scoring candidate is **Discard at −0.360, ahead of the real Save at
  −0.375** — a 0.015 margin on a shared class prefix. The floor is the only thing
  turning that into a refusal instead of a wrong click. See [D6](#d6--the-confidence-floor-and-margin-are-calibrated-on-four-data-points).

### B11. `MAX_SELECTION_SCAN` overflow

- **Unproven:** the scan-bound branch; no fixture has 2,000 form controls.
- **Claimed by:** `w3-sensitivity-consolidation`.
- **Risk: low, and fails closed** — it withholds, so it costs evidence, not
  secrecy.

### B12. Repeated-`data-testid` state keys against real markup

- **Unproven:** "whether a real page ships duplicate `data-testid`s in the shape
  the tests assume is unproven here — the `product-catalog` and `infinite-feed`
  fixtures would settle it."
- **Claimed by:** `w3-state-identity`.
- **Observable:** project a real `product-catalog` snapshot; assert the `<key>.2`
  suffixing appears and that the first occurrence keeps the bare key.
- **Risk: silently wrong.** State paths that collapse repeated controls make
  Core's transition comparison compare the wrong control and conclude the page
  did not change when it did.

### B13. `content/identity/candidates.ts` has no unit tests

- **Unproven:** enumeration and candidate description, covered only through the
  resolver's behaviour.
- **Claimed by:** `w3-resolver` ("my Owns names the two source modules and the
  e2e spec, not `content/identity/tests/`").
- **Risk: low as correctness; moderate as maintenance** — it is the input side of
  the scorer whose calibration D6 depends on.

---

## Group C — Needs a full Flow run through Core

Nothing in Groups A or B exercises the gateway hop, Core's retry path, or the
node executor. These items are only observable from a Flow.

### C1. What Core's retry path does with the assert verb's new TIMEOUT

- **Unproven:** "whether Core's retry path does something useful with
  `timeout`/`retryable: true` where it previously saw
  `unexpected_state`/`retryable: false`… is the substantive downstream
  consequence of this change."
- **Claimed by:** `w3-assert-timing`.
- **Observable:** a Flow asserting a subject that never appears. Read the attempt
  trace: how many attempts, and what is the total wall time before the run gives
  up?
- **Risk: visibly broken, in the retry direction.** An assertion that can never
  hold is now retryable, so a Flow that used to fail once now retries to its
  attempt limit. Bounded, but it will present as a hang. This is the
  highest-priority Flow item because it is a **direct consequence of a behaviour
  change**, not a pre-existing gap. See [F2](#f2--the-assert-verbs-new-timeout-status).

### C2. The expectation evaluator being called for real

- **Unproven:** the whole downstream half. "Every dispatch is a fake in tests."
  "The transition-comparison path was not exercised end to end… A real Flow run
  is what would close it."
- **Claimed by:** `w3-host-runtime`; the Core half (`core-expectation-evaluator`)
  is covered by four Core tests and reports every Core gate green, but its own
  validation section notes that the downstream implementation was folded into
  `w3-host-runtime` rather than briefed separately.
- **Observable:** a Flow whose web output node carries
  `parameterValues.expectedState`. In the attempt trace, `stateCheckCount` should
  equal the host's `checkedConditionCount` (the number of conditions), not the
  number of expected-state keys; a rejected verdict should route `failed`
  carrying the host's own failure record rather than Core's
  `core.policy.expectation_rejected` fallback.
- **Risk: silently wrong, and it degrades to exactly the defect the work
  removes.** With nothing bound, Core's expectation node keeps its unconditional
  pass. So a binding that fails to take does not error — **every expectation
  passes**, forever, quietly. The three guards Core added to keep an unbound host
  bit-for-bit unchanged are also what make a broken binding indistinguishable
  from no binding.

### C3. The `expectedState` condition shape agreeing across the two halves

- **Unproven:** the producer and the consumer were written concurrently. "The two
  halves… have not been compiled or run against each other. The `selector`-on-a-
  condition question is the one place they could disagree"
  (`w3-domain-contracts`). "The producer shape was read, not run"
  (`w3-host-runtime`).
- **Observable:** the same Flow as C2. If the shapes disagree, the normalizer
  reads nothing, `checkedConditionCount` is 0, and the verdict is a pass.
- **Risk: silently wrong, same failure mode as C2.** **This is a mutual
  verified-rests-on-unverified pair**: each side confirmed the other by reading
  the other's report. Neither read is a run.

### C4. Failure classification arriving at Core from a real client

- **Unproven:** "the adapter's behaviour change was not exercised against a real
  client… no paired extension sent either shape."
- **Claimed by:** `w3-failure-code-invariant`.
- **Observable:** pair a real extension, force a failure of each shape, and read
  what Core records.
- **Risk: silently wrong.** A record Core's parser rejects is dropped whole, so
  the failure reaches the Flow with no structured code at all — which reads as
  "no taxonomy on the browser path", the state this plan began in.

### C5. The sanitized failure-evidence packet is produced and never read

- **Unproven:** that anything consumes it. Core calls
  `llmEvidenceRuntime.captureSanitizedFailureEvidence`, which opens a **fresh**
  snapshot when diagnosis runs; nothing reads
  `attempt.result.metadata.failureEvidence`.
- **Claimed by:** `w3-failure-producers`, which also explains why it could not
  wire it: the consumer is addressed by `failedAction.attemptId` and the adapter
  knows only the command id.
- **Observable:** fail a Flow, then check whether the diagnosis prompt contains
  the failure-time packet or a page re-captured afterwards.
- **Risk: silently wrong, and it defeats the packet's whole purpose.** Diagnosis
  reasons about a page that has moved on since the failure — a modal has closed,
  a spinner has resolved — which is precisely what capturing at failure time was
  meant to prevent. Nothing fails; the diagnosis is just wrong more often.

### C6. Recording inside an iframe and replaying it

- **Unproven:** the chain is proven by unit test from the recorded event to
  `action.frameId`; delivery from there is A1. "This change alters the recording
  wire payload for every executable recorded action on a multi-frame page, so a
  Lab or manual recording on a real iframed page is worth doing before it is
  called finished" (`w3-evidence-finish`).
- **Claimed by:** `w3-domain-contracts`, `w3-evidence-finish`.
- **Observable:** record a click inside an iframe; replay; assert it landed in
  the iframe.
- **Risk: silently wrong** — same shape as A1, from the recording side.

### C7. A recorded `web.dom.type` on a sensitive field replays as an empty string

- **Unproven, but known and deliberate:** `payloads.ts` builds `text` from
  `payload.inputValue ?? ""`, and a sensitive field's `inputValue` is now
  correctly absent, "so a recording of a login replays typing nothing into the
  password box." The fixture change widens this from the password field to the
  card field.
- **Claimed by:** `w3-redaction-followup`, which calls it "the right security
  answer and the wrong product answer" and assigns the eventual fix (a credential
  reference rather than a literal) to Core's secret handling.
- **Risk: visibly broken immediately — and misattributed.** The Flow fails to log
  in, and whoever sees it will blame the page or the recorder. **This needs a
  product decision, not a test**, and it should be stated in the plan before
  anyone records a login and reports a bug.

### C8. `elements.count` changed meaning on a wire-visible path

- **Unproven:** "if a Flow authored against a live panel reads
  `web.elements.count` expecting the captured count, its meaning has changed and
  no test in this repository would notice."
- **Claimed by:** `w3-state-identity`, which also offers the cheap inversion
  (leave `count` alone, add `elements.total`).
- **Risk: silently wrong for an existing authored Flow.** Cheap to invert now,
  expensive once Flows exist that depend on either reading.

### C9. Whether Core reads the failure `stage`

- **Unproven:** four worker-side refusals moved from stage `dispatch` to stage
  `execution`; `w3-worker-codes` grepped this repository and found only one stage
  assertion (on an untouched row) but "could not check whether Core or a Flow
  author reads the stage for anything." `w3-failure-code-invariant` notes the
  same for the adapter's rebuild.
- **Risk: low.** Category and `retryable`, which Core's retry path does read, are
  unchanged at all nine sites.

### C10. Old-client compatibility

- **Unproven:** "a client build older than Wave 3 in someone's browser would now
  be reported as UNKNOWN naming its code, rather than as `output_not_observed`.
  That is the intended answer, but it is a downgrade in fidelity for an old
  client and worth knowing before release."
- **Claimed by:** `w3-failure-code-invariant`.
- **Risk: accepted, not a defect.** Belongs in a release note.

---

## Group D — Needs measurement, not a pass/fail assertion

### D1. Content bundle size, measured but unratified

- **The numbers exist.** Tracked pre-Wave-3 `build/content/index.js` was
  **133,020 bytes**; after Wave 3 it measures around **222,000 — roughly +67%.**
  Attributed by esbuild metafile rather than inferred: Core's
  `automation-studio/fingerprinting` **16,740 bytes (2 modules)**;
  `content/identity/score.ts` **2,234**; the two together **18,974 bytes, 8.5%**.
  For comparison `@fluxiq-web-extension/domain/client` is **33,768 bytes across
  21 modules**, pulled in for a table of failure codes.
- **Claimed by:** `w3-matcher-packaging` (the attribution), `w3-resolver` (the
  first 32% jump, "nobody has decided it is acceptable").
- **What is missing is not a measurement but a decision and a gate.** Both
  reports name the same remedy: a narrow `./failure` subpath on the domain
  package plus an alias in the esbuild plugin, which would remove most of the
  larger half.
- **Risk: not correctness.** But nothing currently fails when the content bundle
  grows, so the next 67% will arrive the same way this one did.

### D2. Per-capture and per-event cost

- **Unmeasured:** `captureSnapshot` "runs on every action result and now does
  seven more DOM passes… I did not measure the added milliseconds per capture,
  and there is no before-number to compare against" (`w3-evidence`). "Per-capture
  and per-event cost was not measured. The merge adds work to every recorded
  event on a multi-frame page" (`w3-evidence-seams`). The frame-existence probe's
  cost was "reasoned, not measured" (`w3-extension-gaps`).
- **Observable:** time `captureSnapshot` on `product-catalog` and `infinite-feed`
  before and after; time a recorded event on a multi-frame page. The merge polls
  every frame with a 150 ms timeout each, which is the number that matters.
- **Risk: silently wrong, and it lands as flake.** A per-action cost on a busy
  page does not produce a failure — it produces intermittent timeouts, which is
  the class of problem this whole plan exists to reduce. There is no
  before-number, so the regression cannot be detected retrospectively.

### D3. Wire and state byte cost, currently synthetic

- **Unmeasured:** the evidence state values are "reasoned as ~12 small scalars…
  not weighed on a real page" (`w3-evidence-consumption`); the wire-size figures
  "come from a fabricated page with 20 top-frame and 6 per-frame elements, not
  from a measured real one" (`w3-evidence-finish`).
- **Risk: moderate, silent.** Recording payload size scales with every recorded
  action on every multi-frame page.

### D4. LLM packet entry count against Core's ceiling

- **Unmeasured:** "a 12,000-byte exploration packet's entry count (~450 at 40
  elements, against Core's 512 ceiling) is reasoned, not measured." Core applies
  its structural bounds to the failure packet but not to the exploration packet,
  so only the failure budget is proven.
- **Claimed by:** `w3-llm-packet`.
- **Risk: silently wrong.** Over the ceiling, Core drops the packet — the LLM
  then reasons with no page evidence and nothing says so.

### D5. State-ref bytes on a real page

- **Unmeasured:** "the summary is bounded by the sanitized packet's budget by
  construction, but the actual bytes a real page produces in an attempt trace
  were not observed" (`w3-host-runtime`).
- **Risk: low.** Bounded by construction; the question is only how close to the
  bound a real page sits.

### D6. The confidence floor and margin are calibrated on four data points

- **Unmeasured against anything real:** floor 0.35, margin 0.20, "calibrated
  against two fixtures, not against a corpus of real pages… a wider corpus could
  move them."
- **Claimed by:** `w3-matcher-packaging`, which publishes every number: on
  `identity-drift`, Save scores 0.149 / 0.170 / 0.694 across renderings against a
  Discard at −0.360; on `ambiguous-targets`, the secondary Continue scores 1.000
  against 0.382. The floor sits in the gap between 0.170 and 0.694.
- **Observable:** run the scorer over the FluxBench `week1` corpus and plot the
  score distribution for correct against incorrect candidates. The number that
  matters is the overlap, not the mean.
- **Risk: silently wrong, and the highest-value measurement in this group.** The
  floor is the only mechanism converting a plausible-looking wrong click into a
  refusal, and it is set from four measurements on two synthetic fixtures. Too
  high and real drifted pages refuse to resolve — visible, a refusal, recoverable.
  Too low and the −0.375-versus-−0.360 case shows what happens: the automation
  clicks **Discard** instead of **Save**, confidently. **Note that this
  calibration is also the item whose transfer to production rests on two
  unverified changes — see [G2](#g2--the-scoring-calibration-transfers-to-a-flow-only-if-two-unverified-domain-changes-are-right).**

### D7. Candidate enumeration caps

- **Unmeasured:** 600 scanned, 60 kept, "not measured against a large real page.
  They are judgement, chosen so a resolution cannot become a full-document walk
  on every action" (`w3-resolver`).
- **Risk: silent both ways.** Too low and the right candidate is never
  enumerated, which reads as `TARGET_NOT_FOUND` on a page that has the element.

### D8. Classification accuracy has no corpus

- **Unmeasured:** "`ambiguous_or_unknown` vs `action_failed` for a bare thrown
  exception is a judgement call, argued above but not validated against corpus
  data. The bench's classification-accuracy metric in Phase 1.6b is what would
  settle it" (`w3-failure-codes`). `w3-runner-alignment` adds that
  `RunEvaluation` "still has no producer outside the bench, and the
  classification-accuracy metric that would settle whether the reported codes are
  right depends on it."
- **Risk: silently wrong, and it is the meta-risk over the whole failure
  taxonomy.** Fourteen codes were chosen by reasoning. Nothing yet measures how
  often the code a run reports is the right one.

### D9. Timing assertions are wall-clock lower bounds

- `w3-assert-timing`: `spent() >= 200` and the `elapsedMs` bounds "cannot flake
  high; they would only flake if a timer fired early, which it cannot" — on a
  machine that has demonstrably overloaded under parallel Playwright runs.
- **Risk: low**, and the report's reasoning about the direction is sound.

---

## Group E — Cannot be tested as things stand, and why

### E1. `assert.timeoutMs: 0` cannot reach the wire

`w3-assert-timing` implemented a distinct meaning for a zero timeout — one
immediate check, never a timeout — and it is unreachable from a Flow, because the
wire's positive-integer guard drops `0` and substitutes the 5 s default. Three
reports name this independently (`w3-assert-timing`, `w3-extension-gaps`,
`w3-host-runtime`, the last calling it "general, not local to me"). **This needs
a decision, not a test:** either the guard lets a zero through as "check once", or
the domain rejects it as invalid instead of silently making it five seconds.
Until then the rule is dead code and every caller who writes `0` gets a
five-second surprise.

### E2. `resolution` cannot reach a successful result — so the scores cannot be observed in production

`ContentActionDependencies.resolveTarget` is typed to return `Element`, so
`buildResult` never receives a resolution from a passing verb. `bestScore`,
`runnerUpScore` and `confidence` therefore reach a Flow **only on the failure
path**. Named by `w3-resolver` (open question 2) and restated by
`w3-matcher-packaging`. Closing it touches `content/actions/types.ts`,
`execute-action.ts` and the nine resolving verbs.

**The consequence the reports do not draw out:** this is what makes [D6](#d6--the-confidence-floor-and-margin-are-calibrated-on-four-data-points)
unfixable by observation. You cannot calibrate a threshold from production data
when the measurement is discarded on every success. Until this lands, the floor
can only ever be tuned against fixtures.

### E3. Cross-frame stacking order is not knowable

"An iframe's modal may be painted over by a top-frame overlay and nothing in
either snapshot says so. The same limit applies to overlays: the hit-test runs
inside a frame, so a top-frame banner covering an iframe is invisible to both"
(`w3-evidence-seams`). **Risk: silently wrong** — an automation acts on an element
it believes is clickable and is not. This is an architectural limit, not a bug;
it belongs in whatever documents `PageEvidence`.

### E4. Shadow DOM

A shadow-root target is recorded and not replayable (`w3-frame-plumbing`); a
selection inside a shadow root is not reachable from `dom-snapshot.ts`
(`w3-sensitivity-consolidation`). Both reports note there is **no line in
`docs/architecture/` saying so**. Post-MVP by the plan, but currently an
undocumented silent failure for anyone who records against a component library.

### E5. `PAGE_CHANGED` and `USER_INTERVENTION_REQUIRED` have no producer

- `PAGE_CHANGED` "cannot be produced from `results.ts`: nothing on the command
  carries a document identity captured at dispatch, and the content script's own
  module dies with the document. It needs a field on `BrowserActionCommand`
  stamped by `action-runner.ts` and compared in `message-handler.ts` — three
  files, none mine."
- `USER_INTERVENTION_REQUIRED`'s page-side case (a captcha, a native dialog
  awaiting an answer) "has no signal to read… no fixture ships a captcha either,
  so I would have been shipping an unprovable heuristic."
- **Claimed by:** `w3-failure-producers`.
- **Risk: silently wrong.** Two of fourteen codes are unreachable, so a Flow can
  never learn that the document was replaced under it — it sees
  `TARGET_NOT_FOUND` or `ACTION_FAILED` and retries into a page that no longer
  exists.

### E6. The domain's build scripts and `.test-build/`

- The two new build scripts (`rewrite-dist-specifiers.mjs`, `clean-dist.mjs`)
  have no unit test; `domain/scripts/` has no test root (`w3-domain-packaging`).
- `domain/.test-build/` is tracked and stale — it still holds
  `runtime/tests/llm-evidence.test.mjs` whose source no longer exists, and no
  bundle for five new test files. Regenerating it "means running domain `test`
  *without* `DOMAIN_TEST_BUILD_LABEL`, which rewrites the shared directory and
  races every other worker. The supervisor should run it once at integration"
  (`w3-llm-packet`). **This is a one-command supervisor action, still outstanding
  as far as any report records.**

### E7. Source maps drift on rewritten import lines

`w3-domain-packaging`: the specifier rewrite adds characters after `tsc` wrote
the mappings. "Nothing consumes those maps today." Untestable in the sense that
nothing would notice; worth knowing before someone debugs `domain/dist`.

---

## Group F — Behaviour changes needing a Lab run

These are **regressions if wrong**, not merely unproven. Each changes what a
Flow observes.

### F1. The element-target confidence floor now fails fast on a missing fingerprint

- **What changed:** `metadata.elementTarget: true` is now declared on the eight
  element-targeted entries of `webAutomationManifestOutputs`
  (`domain/src/io/manifest-definitions.ts`).
- **What it actually does — and the brief was wrong about this.**
  `w3-domain-contract-gaps` read Core line by line and found that **the floor was
  never off**: `resolveElementTarget(target, elementTargetMinimumConfidence(output))`
  is called unconditionally, after the `!target` branch, and always ran for these
  eight because `selector` is a required parameter Core's normalizer picks up.
  What the flag buys is only the `!target` branch. The floors now in force are
  **0.68 for the six mutating actions** (`safety.level: review`) and **0.45 for
  `extract` and `wait_for_selector`** (`safe`).
- **The behaviour change:** an element-targeted output dispatched with no
  normalizable element signal now **fails at the policy layer** with
  `element_target.missing_fingerprint`, category
  `graph_validation_or_unknown_node`, where it previously dispatched and let the
  page fail with `TARGET_NOT_FOUND`.
- **Observable:** a Flow with an element-targeted action whose `selector` is
  bound from a state value that resolves empty at run time. "**A Lab run should
  exercise at least one element-targeted action end to end** before this is
  trusted."
- **Risk: visibly broken immediately, and mislabelled.** The Flow stops, which is
  correct. But it stops under a category that says "graph validation or unknown
  node", which sends whoever reads it to inspect the graph rather than the page —
  the report's own words: "a worse name for that failure than the browser's."
  The failure is loud; the diagnosis is misdirecting.
- **Also correct in the plan:** the audit's targeting section may rest on the
  same misreading that the confidence floor was dormant. It was not.

### F2. The assert verb's new TIMEOUT status

- **What changed:** `web.dom.assert` can now return status `timed_out` with
  `TIMEOUT` — category `timeout`, **`retryable: true`** — where every failed
  assertion previously returned `failed` / `STATE_MISMATCH` — category
  `unexpected_state`, **`retryable: false`**.
- **The rule, as implemented:** two conditions must both hold — the window
  expired **and** the last attempt did not judge the claim. A claim the page
  actively contradicts stays `STATE_MISMATCH` even though its window also ran
  out. `absent` can never be a timeout.
- **Two side changes in the same work:** a malformed claim (`exists` with no
  selector, `url` naming no URL) now short-circuits instead of polling for the
  full five seconds, and reports `failed`/`STATE_MISMATCH`. And an element
  present with the wrong text that detaches before the deadline reports TIMEOUT,
  because the verdict is the last attempt's — the report calls this "a judgement,
  not a proof" and it has no test ([B7](#b7-the-assert-verbs-present-with-wrong-text-then-detaches-edge)).
- **How well it is proven at T2:** better than anything else in the wave. The
  mutation proof is real — with the polling loop replaced by `await delay(0)`,
  `check-assert.spec.ts` goes **8 failed / 6 passed**; restored, **14/14**. Two
  unit tests fail under the same mutation. So the wait itself is now falsifiable,
  which it was not before.
- **Observable at T3/Flow:** (a) an assertion on a subject that never appears —
  expect `timed_out`/`TIMEOUT`, then count Core's retries and the total run time;
  (b) an assertion the page contradicts — expect `failed`/`STATE_MISMATCH` and no
  retry.
- **Risk: the retry direction is the regression.** An assertion that can never
  hold is now retryable, so a Flow that failed once may now retry to its attempt
  limit before giving up. Bounded, but it presents as a hang and it is a
  behaviour change no one has watched happen. The malformed-claim short-circuit is
  a straight improvement (five seconds saved per malformed assertion) at low risk.
- **Sequencing note:** `w3-spec-reconciliation` pinned `retryable: false` on five
  assert rows 26 minutes before `w3-assert-timing` made some assert failures
  retryable. The later worker reconciled the rows and reports 14/14 — see
  [G5](#g5--retryable-false-was-pinned-on-five-assert-rows-26-minutes-before-some-of-them-became-retryable).

### F3. Seven rejection codes collapsed into one `ACTION_REJECTED`

- **What changed:** `web.action.disabled`, `covered`, `hidden`, `not_checkable`,
  `unsupported_key`, `upload_rejected` and `dialog_no_response` all became
  `web.action.rejected`. The reason moved into the record's `actual`, written as
  `` `${reason}: ${observed}` ``. Category, `retryable` and (for these)
  stage are unchanged. Twenty spec assertions were rewritten and three rows
  deleted by `w3-spec-reconciliation`, which also added assertions on where the
  reason went — genuinely new coverage, since no row previously asserted `actual`.
- **Claimed by:** `w3-failure-producers` (the change), `w3-spec-reconciliation`
  (the reconciliation).
- **Observable:** anything downstream that branches on the old code string — a
  Flow router node, a bench corpus expectation, Core.
- **Risk: silently wrong for any consumer that matched on the code.**
  `w3-worker-codes` grepped `apps/extension/e2e`, `packages/test-runner/src` and
  `apps/scenario-lab/src` and found only one stage assertion on an untouched row.
  **Nobody has checked Core, a saved Flow, or the FluxBench corpora.** A router
  node branching on `web.action.disabled` now silently takes its default branch.

### F4. The selection guard withholds `selectedText` whenever a sensitive control is in scope

- **What changed:** a select-all spanning a login form no longer yields
  `selectedText` at all. Proven live: the card value went verbatim into
  `snapshot.selectedText` before the fix, and from there into durable web state
  and the sanitized LLM packet.
- **Claimed by:** `w3-sensitivity-consolidation` (the fix),
  `w3-redaction-followup` (the discovery).
- **Risk: visibly broken for the narrow case, correctly.** An evidence item
  disappears on pages that have a sensitive control. The report states the cost
  plainly and offers the narrower rule — "withhold only when the selection's
  anchor, focus or focused control is sensitive" — as a one-line revert. **This
  wants a supervisor decision, not a test.**

### F5. Sensitive controls lose two ranking signals and could fall out of the page description

- **What changed:** `readElementValue` returns `undefined` for a sensitive
  control, so it loses `meaningfulText` — worth 35 points and one of nine
  identity fallbacks (`w3-redaction`) — and `state-values.ts` now drops `value`
  from the stored blob as well (`w3-sensitivity-consolidation`). "A sensitive
  control with **no** other identity at all could now fall below the inclusion
  bar."
- **Observable:** a fixture with an unlabelled, un-named, un-test-id'd sensitive
  input; assert it still appears in the snapshot and in projected state.
- **Risk: silently wrong, with a nasty presentation.** A password field that
  vanishes from the page description means an automation cannot see the login
  form at all — and the failure reads as `TARGET_NOT_FOUND` on a page that
  plainly has the field. Both reports call this a reasoned risk, not an observed
  one; every sensitive control on the current fixture survives because they all
  carry identity, which is exactly why the fixture cannot catch it.

### F6. Four worker-side refusals moved from stage `dispatch` to `execution`, and one mapping departs from its brief

`w3-worker-codes` mapped `workerActionFailedFailure` to **`ACTION_FAILED`**, not
the `UNKNOWN` its brief specified, on the grounds that "the brief's gloss on
`UNKNOWN` is `ACTION_FAILED`'s docstring verbatim, so the two readings cannot
both be what was meant." **The supervisor has not confirmed this.** Three lines
plus three expectations either way. Risk: low, but it is an unratified
divergence sitting in the failure vocabulary.

### F7. `web.tab.no_target` no longer exists and the architecture doc still names it

`docs/architecture/web-capabilities.md:124` documents the tab-close operation as
refusing with `web.tab.no_target`, a string that is now gone
(`w3-worker-codes`). `docs/architecture/testing-facility.md:34` names
`domain/src/runtime/llm-evidence.ts`, which no longer exists (`w3-llm-packet`).
`docs/architecture/repository-layout.md:63` needs a line for the domain's new
`./node` export and the clean+compile+rewrite build (`w3-domain-packaging`).
Three authored-documentation regressions, all in files no worker owned.

---

## Group G — Where two reports disagree, or one report's "verified" rests on another's "not verified"

These are invisible unless all twenty-eight are read together. Several are
**already resolved by a later worker** — recorded anyway, because the resolution
is what the supervisor needs to know, and because in two cases the plan's own
text still carries the wrong version.

### G1 — Does the fingerprint reach the content script?

- `w3-domain-contracts` (09:24): "**The content script therefore never receives
  the fingerprint and cannot score candidates against it.**"
- `w3-resolver` (09:32): "Both of those observations are correct, and **the
  fingerprint reaches the content script anyway**" — it travels in `options`,
  because `gateway-mapping.ts` ends with `options: parameters` and
  `resolve-target.ts` reads `action.options?.element`.
- `w3-domain-contract-gaps` (09:48) confirms `w3-resolver` and states that its
  own brief carried `w3-domain-contracts`' premise forward as fact.

**Resolved in favour of `w3-resolver`.** But the residue is the dangerous part:
`w3-resolver`'s open question 4 says `options` is an **undeclared contract** —
"nothing types it, nothing documents it, and a rename on either side breaks
resolution silently with every gate green." `w3-domain-contract-gaps` then
*declared* the field on `WebAutomationActionCommand` and proved it agrees with
`options.element` — **but left the consumer reading `options`**, by design, so the
typed contract has no consumer and the live path is still the untyped bag. A
four-line follow-up in `resolve-target.ts` closes it. Until then the repository
has a compiler-checked contract that nothing uses and an unchecked one that
everything depends on.

### G2 — The scoring calibration transfers to a Flow only if two unverified domain changes are right

- `w3-resolver` (09:32), open question 5: "**`implicitRole` is dropped on the
  wire** by `output-nodes/targets.ts` `elementFingerprint`."
- `w3-matcher-packaging` (11:08), open question 2: "`w3-resolver`'s note that the
  wire drops `implicitRole` is now **out of date**… `elementFingerprint`
  currently keeps `role`, `implicitRole`, `testId`, `accessibleName` and `label`
  — all five of the signals it was said to drop. **Every one of the nine signals
  `score.ts` compares therefore survives to a live replay, so the measured scores
  above transfer from the harness to a Flow.**"

Both were correct when written; `w3-domain-contract-gaps` (Task 1b) and
`w3-target-signal-order` landed the fixes in between. **The problem is the
conclusion.** `w3-matcher-packaging`'s claim that the calibration transfers to a
live Flow rests on:

- `w3-domain-contract-gaps`, whose own Not-verified says "**`implicitRole` was
  proved to arrive; it was not proved to improve a resolution.** Nothing scores
  with it yet."
- `w3-target-signal-order`, whose Not-verified says "**Nothing here can be
  confirmed by the page yet, because nothing on the page scores with the extra
  signals. A Lab run is worth having** once `w3-resolver`'s scorer is live: that
  is the first moment the richer wire target can change a resolution."

So: the wire now carries **12 signals instead of 1** (measured, by
`w3-target-signal-order`), the scorer compares nine of them (measured, by
`w3-matcher-packaging`), and **no run has ever put the two together.** This is
the wave's longest verified-rests-on-unverified chain, and the thing hanging off
the end of it is [D6](#d6--the-confidence-floor-and-margin-are-calibrated-on-four-data-points) — the floor that decides whether a drifted page gets a
refusal or a wrong click. **One Lab run of an element-targeted replay against
`ambiguous-targets` would close G1's residue, G2, F1 and half of D6 at once.
That is the single highest-value live test in the inventory.**

### G3 — Two reports, two owners, one line: the red domain suite

- `w3-target-signal-order` (10:02): the whole failure is
  `domain/src/client/tests/gateway-mapping.test.ts:208`, it is deterministic, it
  is **its own brief's** missing file, and here is the replacement line.
- `w3-sensitivity-consolidation` (10:04): found the same abort, proved by
  counterfactual that it was not its own (removed its two barrel lines, re-ran,
  identical abort), and attributed it to **`w3-domain-contracts`**.

**Now resolved** — the file reads, at line 218,
`assert.equal(preparedCommand.element?.testId, "save-changes", "the declared field keeps the recorded identity Core's normalization dropped")`,
with a comment above naming `w3-target-signal-order`. Recorded because the
mechanism is worth carrying into Wave 4: a **module-scope** assertion in a
`node:test` file kills the process, node:test reports it as "a resource generated
asynchronous activity after the test ended", and every suite sorting after
`client/` never runs. The count — `# tests 10` — is the only clue. A green-looking
number is not a green suite, and `w3-sensitivity-consolidation` notes it took
217 of 227 tests down with it.

### G4 — The `autocomplete` fixture gap does not exist, and the real gap is cheaper

`w3-autocomplete-signal` (11:04) states, as its **first open question** and the
"weakest link in the coverage":

> no fixture carries an `autocomplete` attribute at all — `grep` finds the string
> in exactly four places in the repository's HTML, all of them
> `autocomplete="off"` in the extension's own popup and side panel. A single
> `<input autocomplete="billing cc-number">` on `sensitive-input` … would make
> the producer half live. Whichever brief owns a fixture next should take it.

**This is wrong.** `apps/scenario-lab/src/scenarios/sensitive-input/scenario.ts`
already renders **both** `<input name="payment" autocomplete="cc-number">` **and**
`<input name="billing" autocomplete="billing cc-number">`, committed in `ee25ac9`
at **10:25** — 39 minutes before that report was written — with a source comment
explaining that the multi-token field exists precisely to catch a copy of the
rule that "compared the whole attribute instead of its tokens." Six other
fixtures carry real `autocomplete` values too (`auth-gate` has
`current-password` and `username`; `identity-drift` has `organization`).
`w3-redaction-followup` and `w3-sensitivity-consolidation` both used the card
fields. The likely mechanism is a grep restricted to `*.html`, when Scenario Lab
fixtures are `.ts` modules that generate HTML.

**The real gap is smaller and different, and nobody has stated it:**
`evidence.spec.ts` never visits `sensitive-input`. It runs on `product-catalog`,
`intermediate-state`, `infinite-feed` and `modal-flows`. So the fix is **one spec
row pointed at an existing fixture**, not a fixture change and not a new brief.
See [B1](#b1-the-autocomplete-evidence-field-on-a-fixture-that-already-has-one).

### G5 — `retryable: false` was pinned on five assert rows 26 minutes before some of them became retryable

- `w3-spec-reconciliation` (10:03) re-categorised assertion failures to
  `STATE_MISMATCH` and pinned `retryable: false` on all five assert rows, noting
  candidly that "three of the five assert rows above pass a short `timeoutMs`
  (200 ms) and are, in fact, exercising the expiry path… **they would assert the
  same thing if the polling loop were deleted.** So the assert verb's wait is
  currently unproven by these rows, in either direction."
- `w3-assert-timing` (10:29) then made exactly that distinction real, changed one
  row's contract, added duration assertions to five and two new rows, and proved
  the wait falsifiable by mutation (8 failed / 6 passed with the loop removed).

**Not a live contradiction — the later worker reconciled it.** But two things
follow. First, `w3-spec-reconciliation`'s "nothing was left failing, 179 passed"
does **not** cover `w3-assert-timing`'s change. Second, the harness count moved
179 → 180 → 181 → 184 → 185 → 186 across the wave, and **no individual report's
"whole harness green" covers the final tree.** The only number that does is the
plan's `Current State`: **186 passed at `--workers=4` on a still tree.** Treat
every per-report harness figure as a snapshot of a moving tree, exactly as five
reports themselves warn.

### G6 — Three reports describe three different states of the same field, and only the last is current

- `w3-evidence-seams` (09:58): the cross-frame merge is correct and "**nothing
  consumes it**: the state projection ignores `evidence`."
- `w3-evidence-consumption` (10:27): "**the dormancy is over**" — and a second
  finding, that the recording event's snapshot already runs through the same
  projection on the Core side, so Task 1 alone lights both paths.
- `w3-evidence-finish` (10:48): Task 1 (`autocomplete` on `FormControlEvidence`)
  **blocked**, with the producer half **measured to be inert** — the report ran
  the real projection over one control three ways and showed rows 1 and 2 produce
  byte-identical output.
- `w3-autocomplete-signal` (11:04): both halves landed.

Sequence, not conflict — but anyone reading `w3-evidence-seams` or
`w3-evidence-finish` alone will conclude that evidence is dormant and that
`autocomplete` is blocked. Both were true and neither is now.

### G7 — Root `pnpm check` now mutates a shared build output, which is the remedy its own report declined to take

`w3-domain-packaging` (10:51) reported a residual: `packages/test-runner`'s
typecheck now requires `domain/dist/index.d.ts`, so a fresh clone fails root
`pnpm check` with `TS7016` before `pnpm build` ever runs. It listed three fixes
and **explicitly declined** the one that touches domain `check`:

> A gate should not mutate a shared build output. […] `check` would then *delete
> and rewrite* `dist` on every run, which races the ten concurrent domain checks
> in this wave and, worse, **could wipe the panel-host bundle or a `dist` a Lab
> run is loading.**

Root `package.json` line 11 now reads:

```
"check": "pnpm structure:test && node scripts/structure-audit.mjs && pnpm --filter @fluxiq-web-extension/domain build && pnpm -r check"
```

That is **remedy 1**, applied — root `check` now builds the domain, and the
domain build now runs `clean-dist` first. **Half the hazard is closed by
construction:** `clean-dist.mjs` removes only what `tsc` emits and its header
records that `dist/host/web-panel-host.mjs` is deliberately preserved. **The
other half is open:** a `pnpm check` overlapping a running Lab session will
delete and rewrite the `dist` that session is loading. Worth confirming the
change was deliberate and worth one line in the plan telling anyone doing live
validation not to run root `check` alongside a Lab run.

### G8 — Three reports each flagged the same escape hatch and none owned it; it is now closed

`rejectionFailure` in `content/action-runtime/validation-outcome.ts` built
`web.action.${caller-supplied-suffix}` — "the exact thing the closed set exists
to prevent." Flagged by `w3-failure-codes` (which assumed `w3-failure-producers`
owned the file), by `w3-failure-producers` (which did not), and a third time by
`w3-spec-reconciliation` ("with `results.ts` converted, this function is no
longer merely redundant, it is **the only remaining way to mint a rejection code
outside the set, and a test stands behind it**").

**Now closed** — the module exports only `VALIDATION_TEXT_MAX_LENGTH`,
`truncateValidationText`, `boundValidation` and `statusForValidation`, and
`w3-assert-timing`'s Mutation C proved that reintroducing `rejectionFailure`
fails the unit suite (`not ok 92`, naming it). Note the shape of the finding it
also produced: **the same mutation showed a reintroduced hand-built record still
compiles**, because at that moment the protocol's `code` was `string`. Deletion,
not the type system, is what shut that door — until G9.

### G9 — The narrowing three briefs could not land was closed by a fourth, in a different file

`w3-protocol-narrowing` (10:52) reported Task 1 **blocked**: the failure record's
`code` is not declared in `apps/extension/src/shared/protocol.ts` at all — the
brief's premise, inherited from `w3-assert-timing`'s report, named the wrong
file, and "the location is what decided ownership." It measured the full patch
(extension: **14 errors → 1**), reverted it, and wrote it out in full for whoever
landed it, recommending a five-file brief.

`w3-failure-code-invariant` (11:09) closed it **one file smaller**, by narrowing
the middle link — `WebAutomationActionResult`'s declaration in the domain —
rather than the alias, and reports `protocol.ts` needed no edit at all, with two
`@ts-expect-error` rows pinning it and both packages green (domain 257/257,
extension 216/216, harness 185).

**Resolved, and by the better change.** Its own lesson, worth keeping: three
briefs were drawn around a *file* and one around the *change*, and only the last
found the smaller answer. Two of its findings are also worth acting on — a
repository test (`adapter.test.ts`) was found **asserting the defect**, having
been written before the closed set existed, and it is the second such case in the
wave (the first was `web.tab.*` strings in `w3-worker-codes`). Its
recommendation — one grep of the remaining fixtures for wire strings not in
`WEB_AUTOMATION_FAILURE_CODES` — has not been recorded as done.

### G10 — Two reports record the supervisor committing mid-task, over live mutation proofs

`w3-assert-timing`: "`ee25ac9` committed my four source files and three test
files **while I was still mutating and restoring them**… a commit taken during a
worker's mutation proof could capture a deliberately broken tree, and neither the
worker nor the supervisor would see it in `git status`."
`w3-evidence-consumption` records the same for `362f313`.
`w3-protocol-narrowing` adds: "two of those windows contained a deliberately
broken compile."

All three happened to capture restored state, and each worker re-ran its gates
afterwards. Process finding for Wave 4, not a test.

### G11 — One worker widened what travels, another narrowed what it may contain, and nothing tests the join

`w3-domain-contract-gaps`, Not verified, in its own words:

> **The redaction interaction.** I carry `expected`/`actual` through verbatim; I
> did not verify that `w3-redaction-followup`'s producer-side redaction is in
> place, so **if it is not, a sensitive control's value could now travel further
> than it did before this change.** Worth checking that the two landed together.

They did both land. **But no single test covers the pair.** Confirmed by grep:
the only two files in the repository that mention the fixture's synthetic secrets
are `apps/extension/e2e/content/tests/redaction.spec.ts` (T2, content-side, which
proves the producer withholds) and `domain/src/runtime/tests/host-runtime.test.ts`
(a domain unit test with a fake dispatch). **Nothing asserts that a `validation`
arriving at the domain is secret-free.**

- **Observable:** a domain-side row that pushes a `web.dom.type` result for a
  sensitive control through `webAutomationActionResultPayload` and the result
  mapping, and searches the whole serialized payload for the synthetic values;
  and, at T3, the A4 sweep.
- **Risk: silently wrong, and it is a leak.** This is the exact shape of the two
  leaks already found in this plan — a rule that holds on one side of a boundary
  and a consumer on the other side that nobody joined up. The one difference is
  that this time a worker predicted it in writing and no one has closed it.

**Related and unclosed:** `w3-failure-producers` and `w3-host-runtime` both note
that `webAutomationActionResultPayload` in `gateway-mapping.ts` **drops
`validation` and `resolution`** from the gateway payload, so the domain hop
cannot read the post-condition that failed. `w3-domain-contract-gaps` carried
`validation` through the *result mapping*. Whether those two statements describe
the same field on the same path, or two different paths one of which still drops
it, is not resolvable from the reports alone and should be checked before the
domain-side assertion above is written.

---

## Priority, if only a few things can be run

1. **One Lab run of an element-targeted replay** (`ambiguous-targets`, then an
   iframed page). Closes or substantially advances A1, F1, G1's residue, G2 and
   half of D6 — the densest cluster in the inventory.
2. **The A4 redaction sweep over real gateway traffic**, plus G11's domain-side
   assertion. Highest consequence; three leaks already found by exactly this
   method, and one predicted-but-unclosed join.
3. **One Flow carrying `expectedState`** (C2 + C3). The failure mode is
   "everything passes", which no gate can distinguish from success.
4. **One Flow with an assertion that never holds** (C1). Watches F2's retry
   change actually happen.
5. **The Group B spec rows**, in this order: B1 (one row, existing fixture), B8
   (one row, existing fixture), B10 (one line of markup plus a row), B4, B2.
   Cheapest risk reduction per unit of effort in the whole inventory.
6. **D6 against the FluxBench `week1` corpus**, once E2 is closed so successful
   resolutions report their scores at all.

## Not verified by this report

- I ran no tests and made no changes. Every claim about a report's content is a
  direct read of that report.
- Six read-only greps were run against the working tree to settle claims two
  reports disagreed about: the `sensitive-input` fixture's `autocomplete`
  attributes and their commit (`ee25ac9`, 10:25); `evidence.spec.ts`'s fixture
  list; `data-sensitive` having zero occurrences in `apps/scenario-lab/src`;
  `gateway-mapping.test.ts`'s current line 218; `validation-outcome.ts`'s current
  exports; and root `package.json`'s `check` script. Each is quoted where used.
  I did not run any of the affected suites to confirm the tree is green.
- I did not read the Wave 1 or Wave 2 reports, the audit reports, or the briefs.
  Where a Wave 3 report cites one of those, I have taken the citation as written.
- I did not verify any worker's claim about Core's source, including
  `prepareElementTargetAction`, `resolveElementTarget`, the retry path's reading
  of `category`/`retryable`, or the 512-entry packet ceiling. Those are
  second-hand throughout this inventory.
- The risk judgements are mine. They are reasoning about consequence, not
  measurements, and a Lab run may reorder them.

## Open questions for the supervisor

1. **Was root `check` building the domain a deliberate acceptance of G7's
   trade?** If so it needs a line telling live-validation sessions not to run
   root `check` concurrently with a Lab run.
2. **`w3-worker-codes`' `ACTION_FAILED`-over-`UNKNOWN` departure (F6) is still
   unratified.** Three lines either way.
3. **`w3-sensitivity-consolidation`'s selection guard (F4) and
   `w3-evidence-consumption`'s withholding of `hasValue`** were both offered as
   reversible one-line decisions for the supervisor to confirm rather than
   inherit. Neither is recorded as decided.
4. **`domain/.test-build/` regeneration (E6)** is a single supervisor command
   that no report records as having been run.
5. **`w3-failure-code-invariant`'s recommended grep** — remaining test fixtures
   for wire strings not in `WEB_AUTOMATION_FAILURE_CODES` — is not recorded as
   done, and the wave has already found two tests asserting the pre-set
   vocabulary.
6. **The `evidence.spec.ts` fixture list** should probably include
   `sensitive-input` permanently, not just for B1: it is the only fixture with
   sensitive controls, and the evidence producer is now one of the paths that has
   to withhold from them.
