# lane4-w2-drawing-signal (live-lane-4, t567)

No Core change. Core's element-target normalizer (`model/action-element-target.ts`) does strip unknown fingerprint fields, but only from `parameters.target`. That matters for the repair path only (open question 2). A build's step dispatches from `parameters.element`, which keeps `drawing`. A test checks this through Core's normalizer and the gateway mapping.

## Outcome

Partial. The new "drawing" identity signal works end to end on the build path, which is the one blocking lane 4:

1. capture (`describeElement`);
2. the packet binding (never the packet itself);
3. the saved step and the save-time floor;
4. Core's normalizer and the gateway mapping;
5. the page's finder and scorer.

The other two save paths do not carry it yet:

- **Recording:** the wire projection is in `background/`, which this brief could not edit.
- **Runtime repair:** Core strips the field from a repaired target.

On both paths the floor counts only what is actually saved, so neither saves a weaker identity than before.

The fix in plain words:

- A wordless icon control now carries a digest of what it draws:
  - the svg's `viewBox` and shape geometry;
  - a `<use>` symbol;
  - an image's source path, without its query or fragment;
  - a background image on the control itself.
- The digest leaves out paint (fill, stroke, class, style), so a filled and an unfilled icon get the same digest.
- `signals.ts` counts it as one signal. So `{span, one hashed class, drawing}` now passes the floor, while `{span, one hashed class}` is still refused. Neither the floor nor the t442 F5 rule was weakened.

## What changed and why

### Extension: capture, scorer and finder

- `apps/extension/src/content/identity/drawing.ts` (new) exports `elementDrawing(element)` and returns `d1.<base36 cyrb53>`. What it reads:
  - It walks the element and its insides in document order, open shadow root first.
  - It skips svg `<title>`/`<desc>`/`<style>`/`<script>`/`<metadata>`.
  - Numbers are canonicalized and separators collapsed, so two spellings of one shape agree.
  - It returns `undefined` when the element has visible text, has nothing pictorial, walks more than 256 elements, or holds more than 64 parts. The walk exits early at the first text node, which keeps it cheap enough to run on every snapshot element.
  - `getComputedStyle().backgroundImage` is read last, and only for elements that passed the walk.
- `identity/drawing-attribute.ts` (new) exports `DRAWING_ATTRIBUTE = "fluxiq:drawing"`, the key a drawing travels under in Core's `attributes` signal.
- `identity/candidates.ts`: `candidateFingerprint` puts the candidate's drawing under `attributes[DRAWING_ATTRIBUTE]` when it has one.
- `identity/score.ts`:
  - `RecordedIdentity.drawing` added.
  - The matcher is built with `weights.attributes = 20` (a label's weight). Nothing else here ever fills `attributes`.
  - Each candidate is scored against its own comparison. The recorded drawing is added only when the candidate draws exactly the same. A candidate that draws nothing or something else is scored as if no drawing were recorded: it is neither supported nor contradicted.
  - The ranking is re-sorted in Core's own order (total, then normalized score, then id).
  - `hasIdentitySignal` accepts a drawing.
  - Why a mismatch is neutral: a picture changes per row (product photos) and with state (swapped icon files). Charging a mismatch would have broken row loops over picture links.
- `identity/corroboration.ts`: `attributes` counts as a distinguishing signal. Under the rule above it can only be a whole, exactly matching drawing.
- `identity/index.ts`: exports `elementDrawing`; the header comment explains it.
- `content/element-finder.ts`:
  - `ElementFingerprint.drawing` added.
  - `stableFingerprintMatches` answers a drawing like a class set: `shared`, every element of the recorded tag that draws the same (at most 2,000 scanned), placed before the class-set matches. It answers alone when the class was renamed.
  - It only adds candidates and never drops one. The record gate and scoring choose among them.
- `content/describe-element.ts`: `descriptor.drawing = elementDrawing(element)`, plus a header paragraph.
- `shared/dom-element.ts`:
  - `DomElementDescriptor.drawing` added.
  - `"drawing"` added to `UnwiredElementField`, with its reason written out. The recording projection (`background/connection/gateway-payloads.ts`) was must-not-touch, and without this entry it would not compile.

### Domain: contract, floor and transport

- `actions/types.ts`: `WebAutomationElementFingerprint.drawing`.
- `element-fingerprint/drawing.ts` (new): `webElementDrawing(value)` accepts only `^d\d{1,3}\.[0-9a-z]{1,16}$`, so page text can never be saved under this name. It is exported from the barrel.
- `element-fingerprint/source.ts`, `build.ts` (validated through `webElementDrawing`) and `from-descriptor.ts` carry `drawing`.
- `element-fingerprint/signals.ts`:
  - New signal `"drawing"`, counted once, before the lone-class rule reads the list.
  - The header now describes the drawing signal and the finder/scorer that use it.
- `output-nodes/targets/targets.ts`: the wire reader `elementFingerprint` reads `drawing` (its contract type requires the key), so dispatch keeps it.
- `runtime/llm-evidence/elements.ts`: `DescribedEvidenceElement.drawing` is a side channel, the same pattern as `dialog`. It is never in the packet the model reads, and `web.describe_element` prints every packet field.
- `runtime/llm-evidence/sanitize.ts`: binding `drawings?: Map<handle, drawing>`.
- `capture.ts`, `structure/detect.ts` and `stable-handles.ts` (handle renumbering) carry `drawings` as they carry `dialogNames`.
- `packet-fingerprint/from-packet.ts`: an `input.drawing` option.
- `plan-resolution/element-identity.ts`:
  - `WebPlanElementIdentity` includes `drawing`.
  - `webPlanElementIdentity(..., drawing?)` takes it as a new parameter.
  - When views of one control are merged, the identity keeps the drawing only if both views agree on it.
  - When a merged identity has become thinner than either view, the drawing is among the first fields the newest view may fill back in.
- `plan-resolution/target-packets.ts`: passes `binding.drawings?.get(handle)`; `agreedIdentity` includes `drawing`.

### Tests

- `element-fingerprint/tests/shortfall.test.ts`: kind + drawing passes; kind + lone class is still refused; kind + lone class + drawing gives `["kind","drawing","classNames"]`; a drawing alone, or a blank one, is not enough.
- `element-fingerprint/tests/build.test.ts`: the token is kept; page text or a malformed token is dropped; a secret control keeps its drawing.
- `element-fingerprint/tests/from-descriptor.test.ts`: a recorded descriptor's drawing is read.
- `plan-resolution/tests/identity-guard.test.ts`, end to end:
  - A wordless row icon without a drawing is refused `web.handle.unidentifiable`.
  - With a drawing it resolves; the saved `parameters.element.drawing` is set; the dispatched element (through Core's normalizer and the gateway mapping) carries it.
  - The packet JSON never contains it, the binding keeps it, and page text in its place is dropped.
- `identity/tests/drawing.test.ts` (new):
  - Two copies of one icon give one digest; different icons, or another viewBox, give different digests.
  - A change of class, fill, stroke or style keeps the digest.
  - Separator and number spelling do not change it.
  - The `use` symbol counts; an image's CDN host and query do not.
  - Text, nothing pictorial, or a gallery of 80 images gives `undefined`. An svg `<title>` is not visible text.
- `identity/tests/score.test.ts`:
  - Of save and share icons that match on everything except the drawing, the scorer chooses the one with the recorded drawing, by more than the margin.
  - The other icon gets no negative `attributes` contribution.
  - Without the recorded drawing, the result is not `resolved`.
  - A candidate drawing nothing, or something else, gets exactly the score it gets against a recording with no drawing.
- `content/tests/element-finder.test.ts`:
  - With the class renamed and the selector stale, the drawing finds both save icons and neither share icon, and the record gate leaves the one in the recorded row.
  - Beside a class set, the same-drawing icons come first and nothing is dropped.
  - Without a drawing, the class set behaves as before.

No guidance text, example or test string mentions hearts, saving jobs or any scenario's site; the test names are generic (line cook, pastry chef, q8f2).

## Commands run and observed results

- `npx tsc -p tsconfig.test.json` in `apps/extension`: exit 0, no output (final run). One earlier run failed with TS2379 in `element-finder.test.ts`; adding an `assert.ok(drawing)` narrowing fixed it.
- `npx tsc -p tsconfig.test.json` in `domain`: exit 0, no output.
- `DOMAIN_TEST_BUILD_LABEL=lane4-w2 node scripts/test-domain.mjs element-fingerprint plan-resolution/tests/identity-guard`: `# tests 22`, `# pass 22`, `# fail 0`.
- `DOMAIN_TEST_BUILD_LABEL=lane4-w2 node scripts/test-domain.mjs runtime/llm-evidence output-nodes element-fingerprint` (final): `# tests 1419`, `# pass 1419`, `# fail 0`.
- `EXTENSION_TEST_BUILD_LABEL=lane4-w2 node scripts/test-extension.mjs content/identity/tests/drawing content/identity/tests/score content/tests/element-finder`: `# tests 36`, `# pass 36`, `# fail 0`. All 10 new rows are listed `ok` by name.
- `EXTENSION_TEST_BUILD_LABEL=lane4-w2 node scripts/test-extension.mjs content/tests content/action-runtime content/evidence/tests content/identity/tests background/connection/tests` (final): `# tests 878`, `# pass 878`, `# fail 0`.
- `node scripts/structure-audit.mjs`:
  - First run: `FAIL [failure-as-empty] apps/extension/src/content/identity/drawing.ts ... line 139`. I removed both `catch` blocks: a regex strips the origin instead of `new URL`, and the `getComputedStyle` guard was not needed.
  - Final run: `structure-audit: passed (205 warning(s), 638 baselined).` The one new advisory warning is `[file-lines] apps/extension/src/content/identity/score.ts: 419 lines`.
- Nothing wrote `apps/extension/dist` or `domain/dist`. No extension build was run, and nothing was committed.

## Not verified

- No live Lab run and no loaded-extension browser test: a real job-board icon's digest, its stability across reloads, and a click resolved by it on the real page.
- No content-harness (Playwright) run. `describeElement` on real SVG elements (namespaced `viewBox`, `localName`) was exercised only on stub DOMs.
- Whether Core's project-build or flow-bootstrap keeps `parameters.element.drawing` when a candidate Flow is stored. The domain-side dispatch path was tested; Core persistence was not.
- Whether the background forwards a command's `element` to the content script whole. It was read, not proven; the `resolve-target.ts` comments say it does.
- Snapshot cost on very large pages. The walk is bounded (≤256 elements per element, early exit at text) but was not measured.
- Full package suites were not run (per the brief and AGENTS.md).

## Open questions or contradictions found

1. **Recording path.** A recorded step carries no drawing until `background/connection/gateway-payloads.ts` `elementTarget` adds `drawing: element.drawing` and `"drawing"` is removed from `UnwiredElementField` (`apps/extension/src/shared/dom-element.ts`). That is a two-line follow-up for whoever owns `background/`. `from-descriptor.ts` already reads it.
2. **Repair path.** I left `target/override.ts` unchanged on purpose. Core's `normalizeFingerprint` (`!FluxIQ/.../model/action-element-target.ts`) rebuilds `parameters.target` from a closed list without `drawing`, so a repair saved with a drawing would be stored without it. Counting the drawing at the repair floor would let a one-signal repair through. Carrying it needs a Core change (a `drawing` field in `AutomationStudioElementTargetFingerprint`, or a declared passthrough). That is the supervisor's call; I made no Core edit.
3. **Veto.** `identity/veto.ts` is unchanged: a Level 1 exact match on a wordless icon is still accepted unweighed, as before for class-only controls. Making the drawing a veto distinguisher would refuse a stale positional selector that now points at the share icon. It would also refuse a wordless picture link whose photo differs per row in a loop, so I did not do it.
4. **Files outside the listed ownership.** The brief named "the fingerprint capture builder you find". Carrying the signal needed `describe-element.ts`, `shared/dom-element.ts`, `output-nodes/targets/targets.ts`, `runtime/llm-evidence/{elements,sanitize,capture,stable-handles}.ts`, `structure/detect.ts`, `packet-fingerprint/from-packet.ts`, `plan-resolution/{element-identity,target-packets}.ts` and `plan-resolution/tests/identity-guard.test.ts`. Every edit is additive. `git diff` shows only my edits in those files. None is on the must-not-touch list.
5. **`score.ts` length.** It is at 419 lines, past the 400-line advisory (a warning, not a failure). The drawing helpers (`withAgreeingDrawing`, `coreOrder`) could move to their own module if the supervisor wants it under the threshold.
