# t200-w2-domain report: the domain packet carries the whole page

Worker `t200-w2-domain`, tree `C:/Users/osrs_/FluxStuff/fxwork/t200/!FluxIQWebExtension`, branch
`task/t200-model-sees-whole-page`. Nothing committed.

## Outcome

**Partial**, for one reason only: `domain/src/tests/page-evidence-joinery.test.ts` is not in my
ownership (the brief gives me `domain/src/tests/domain.test.ts` only), and it pins the old packet
shape. It is the only thing between the definition of done and green:

- `domain check`: fails with 10 errors, all 10 in that file.
- `domain test`: 973 of 978 pass. All 5 failures are in that file.
- `structure-audit`: passes.

The patch for that file is in "Open questions" below. I verified it without touching the tree:
type-checked the whole test project with the patched file swapped in (0 errors), and ran it (12/12).

Everything the brief asked for in the files I own is done. The `web-llm-evidence` packet carries
every element the capture sent, in capture order, with its text and attributes. Nothing in
`domain/src/runtime/**` or `domain/src/page-evidence/**` caps, ranks, trims or budgets page
information on its way to Core. Nothing new was added at the top level of the execution result:
`WEB_LLM_EVIDENCE_RESULT_KEYS_CORE_READS` is unchanged, and every change rides inside `evidence`.

## What changed and why

### The packet's new shape (`web-llm-evidence.v2`, same version string)

The page fields:

- `location`: origin, path, query and fragment. A secret-named parameter's value reads `(withheld)`.
- `title` (screened, whole) and `elements[]`: every element, in capture order.
- `truncated`: true only when the capture itself says it cut. `captureTruncated?` is kept.
- `frame?`: `{ isTop, childFrameIds?, unansweredFrameIds? }`. `unansweredFrameIds` is new, and is
  read from `evidence.unansweredFrameIds`.
- `loading?`: `{ readyState?, busy?, indicators?: [{ kind, label? }], pendingNavigation? }`.
  `indicators` replaces `spinner`.
- `navigation?`: `{ url?, type?, redirects?, referrer? }`. `url` is new, and both URLs are screened
  as a location is.
- `dialogs?`: every dialog, as `[{ role?, name?, modal? }]`. The cap of three is gone.
- `blockedBy?`: **now an array**, every blocker as `[{ role?, name?, blocks? }]`. It used to be only
  `blockers[0]`.
- `selectedText?`: uncut.
- The failure fields `failedTarget`, `failedTargetMissing`, `failedTargetUnknown` and
  `repairParameters` are unchanged.
- `repairCandidates` is now `web-repair-candidates.v2`: status `listed`, every compatible element in
  document order, no score, no `limit` refusal.
- Removed: `elementTotal`, `elementsTruncated`, `budgetTruncated`. They can no longer fire. Core src
  has no reader of them; it reads only `evidence.truncated === true`, in
  `harness/failure-evidence.ts` `failureEvidenceProvenance`.

Each element:

- The existing fields are kept: `target`, `tag`, `frameId?`, `role?`, `name?`, `text?`,
  `inputType?`, `controlType?`, `hasValue?`, `selectedValue?`, `href?`, `options?`, `revealKind?`,
  `expanded?`, `focused?`, `recent?`, `changed?`, `form?`, `landmark?`, `heading?`, `item?`, `cell?`,
  `repeats?`, `dialog?`, `within?` and `alike?`.
- New fields:
  - `implicitRole?`, when it differs from `role`.
  - `label?`, when it differs from `name`.
  - `attributes?: Array<[name, value]>`, in capture order. The extension's `data-fluxiq-frame-id`
    stamp is left out.
  - `hasClickHandler?: true`.
  - `box?: {x,y,width,height}`: the document bounds, rounded.
  - `onViewport?: boolean`: from `isVisibleOnViewport`.
  - `checked?: boolean`.
  - `value?`: only on a non-sensitive safe-fill control, and only when the capture carried it.
- `href` is now the full URL, cross-origin included, screened. Other schemes (`mailto:`,
  `javascript:`) are published as written, screened. A URL with embedded credentials is dropped.
- `options` now holds all options, in order, with empty values and labels kept as `""`.
- No string is cut anywhere. Whitespace is still collapsed to one line.

### Secret screening (kept, and moved onto every string)

- **New `llm-evidence/withheld.ts`.** It runs
  `screenAutomationStudioLlmEvidence(text, []).secretShaped` from `fluxiq/automation-studio`, and a
  match becomes `WEB_LLM_WITHHELD_TEXT = "(withheld: shaped like a secret)"`. It covers:
  - element strings: text, name, label, role, attribute names and values, options, the selected
    value;
  - page strings: title, selection, dialog and blocker labels, indicator labels, heading, form,
    landmark and row words;
  - a reading node's rows, keys included.
- **`location.ts`.** Path, query and fragment are kept. A parameter whose name, split into whole
  words, is one of these has its value withheld: token, key or apikey, secret, password (passwd,
  pwd, pass, passcode), auth or authorization, session, sessionid or sid, sig or signature, code,
  otp, credential(s), ticket, jwt. A value or path that Core's screen matches is withheld too. The
  2,000-character limit is gone. Embedded credentials are still refused.
- **URL-valued attributes are screened as links.** These are `href`, `src`, `action` and the like,
  in `attributes.ts`.
- **The sensitivity rule is unchanged, and still runs first.** It is asked with the attributes in
  either form (an object or tuples), so the extension can send either.

### Files, in `domain/src/runtime/llm-evidence/`

- `limits.ts`: **deleted**, with `WEB_LLM_EVIDENCE_BYTE_BUDGETS`, `WEB_LLM_EVIDENCE_BOUNDS`,
  `evidenceByteLimit` and `serializedBytes`. The barrel no longer exports them.
  `AUTOMATION_STUDIO_LLM_MAX_FAILURE_EVIDENCE_BYTES` is no longer imported anywhere in domain src or
  tests.
- `untrusted-json.ts`:
  - `boundedText` becomes `pageText`, with no maximum.
  - `boundedCount` becomes `countValue`, with no ceiling.
- `withheld.ts` (new): described above.
- `attributes.ts` (new): reads attributes as a record or as tuples, publishes them as tuples, drops
  the frame stamp, and screens every name and value.
- `elements.ts`: the new fields described above; no cuts; all options; the full href. Also, a
  `hasClickHandler` or implicit-role element now counts as actionable.
- `sanitize.ts`:
  - No `frontLayerFirst`, no 40-element cap, no `trimToBudget`, no `renumberedBytes`.
  - `WebLlmSanitizeOptions` is now `{ expectedOrigin?, failedAction? }`.
  - The truncation and total fields that can no longer fire are removed.
- `front-layer.ts`: `frontLayerFirst` is deleted. `openDialogNameOf`, the dialog cue for
  look-alikes, is kept, and its name is uncut.
- `page-evidence.ts`: every dialog, every blocker, indicators with labels, the navigation URL and
  `unansweredFrameIds`. `elementTotal` is gone.
- `location.ts`: described above. New `evidenceHref`, `screenedUrlAttribute`,
  `secretParameterName` and `screenedEvidenceUrl`.
- `capture.ts`:
  - `maxEvidenceBytes` is removed from `WebLlmEvidenceToolRequest`, along with
    `PAGE_REFUSAL_ENVELOPE_BYTES`.
  - A page refusal carries the whole page.
  - The look is still asked with `parameters: {}`. The extension now answers that with the merged
    snapshot (see the lead's `types.ts` note).
- `tools.ts`:
  - `maxEvidenceBytes` is removed from `WebLlmFailureEvidenceRequest`.
  - The failure packet is the whole page, and its candidates list every compatible element.
  - The handle comment now says six digits.
- `target/candidates.ts`: every compatible candidate, in document order, with no score and no
  byte fit. The signature is `projectWebRepairCandidates(elements, failedAction)`, and
  `WEB_REPAIR_CANDIDATE_LIMIT` is removed.
- `target/equivalence.ts`: the "possibly cut" logic is removed. A withheld name is compared for
  nothing.
- `plan-resolution/element-identity.ts`: `uncut` is replaced by `whole`, which drops only the
  withheld marker.
- `stable-handles.ts`: `WEB_LLM_TARGET_HANDLE_MAX_NUMBER` is now `999_999`, and the pattern is
  `^target\.[1-9][0-9]{0,5}$`.
- `plan-resolution/handle-tokens.ts`: the header now says six digits. It reads the pattern constant,
  so no code change was needed.
- `node-run/read-result.ts`: whole payload. No depth, string, item or key caps and no shrink
  ladder. Denied keys are still removed, and strings and keys are screened.
- `node-run/run.ts`:
  - No look envelope, no `budget`, no `bounded()`.
  - The read is whole.
  - A refusal always carries its page. `refusal()` lost its `maxEvidenceBytes` parameter.
- `node-run/replay.ts`: the page always goes with the replay answer.
- `structure/packet.ts`: no field trimming, no `fieldsTruncated`, and the label is uncut.
- `structure/detect.ts`: the caps only. **Which list detect returns is unchanged.** "The page's
  largest list" is chosen page-side, and the domain passes it through.
- `structure/refusal.ts`:
  - The `MAX_LIST_HINTS` cap of 3 is removed, so every hint is listed.
  - `controlsSeen` now counts actionable elements. The packet carries every rendered element, and
    `elementTotal` is gone.
- `state-digest/snapshot-states.ts`: now `webLlmSnapshotStates(sanitized)`. There is no
  re-sanitizing at a default bound.
- `state-digest/state-digest.ts`:
  - The version is now `web-state.v2`.
  - Digested: `implicitRole`, `label`, `hasClickHandler`, `value`, `checked`, and every blocker.
  - Omitted, with the reasons stated in the header: `attributes` (markup churn), `box`,
    `onViewport` and `unansweredFrameIds`.
- `look-alikes.ts`: the description now includes `implicitRole`, `label` and `hasClickHandler`. It
  excludes `attributes`, whose per-row ids would suppress the `within` cue, and it excludes the
  state fields and `box`.
- `tool-rejection.ts`: `evidence_budget_exhausted` is retired from `WEB_LLM_TOOL_REJECTION_CODES`.
  Nothing produced it any longer, and Core src has no reader of it.
- `harness-options/options.ts`:
  - The inspect description now says "every rendered element of the page, in document order...".
  - The enter-field description no longer claims that no value travels.
  - The `maxLength` limits on `value` and `url` are removed.
- `harness-options/execute.ts`: the read of `maxEvidenceBytes` is removed.
- `index.ts`:
  - Exports `WEB_LLM_WITHHELD_TEXT`, `screenedWebLlmText`, `screenedEvidenceUrl`,
    `actionableEvidenceElement`, and the new blocker and indicator types.
  - No longer exports the limits or the candidate limit.
- Comment-only fixes: `enter-field.ts`, `target/override.ts`, `state-digest/index.ts`.

### Files, elsewhere in `domain/src/runtime/`

- `route-state/project.ts`:
  - The 2,000-character cut is removed.
  - `dialog` names every dialog and `blockedBy` every blocker, joined with ` | `.
  - `controls` lists every actionable element in document order.
  - A Set replaced an O(n²) list search, which took 468 ms on a 12,000-element page and now
    takes 19 ms.
  - `location` now includes the screened query.
- `route-state/paths.ts`: the model-facing descriptions are updated. `location` includes the query,
  with secret values withheld, and every dialog, blocker and control is named.
- `host-runtime.ts`: the full diff. `MAX_DIFF_ELEMENTS` is removed.
- `adapter.ts`:
  - The Core failure-bytes import and `maxEvidenceBytes` are removed.
  - The URL goes through `screenedEvidenceUrl`, which keeps the query with secrets withheld and
    has no 2,000 limit.
  - The title is screened and whole. The selector is whole; it is internal and only matched.
- `reusable-evidence.ts`: **it no longer throws past 40.**
  - The element, action, capability, item and byte limits are removed.
  - The projection is `.v2`: facts in document order, with no `truncated`.
  - The fingerprint's structural digest still sorts the set, so a re-render in another order is
    the same page.

### Other owned files

- `domain/src/page-evidence/tests/capture.test.ts`: `unansweredFrameIds` is added to the item
  ratchet. It is produced only by the merge, so no single-frame capture carries it.
- `docs/architecture/page-evidence.md`:
  - The limits are rewritten, and a new section, "No Limits On The Way To A Model", lists what the
    domain now does.
  - Nine keys, with `unansweredFrameIds` in the table.
  - The look is merged, and a frame that does not answer is named.
  - "The Caps" drops the packet row. An explicit `<a id="the-four-caps">` keeps the link from
    `extension-client.md:918` resolving, since I don't own that file.
- `domain/src/tests/domain.test.ts`: the pinned "max-window" 6,500–7,488-byte assertion on a
  40-element packet is removed.

### Tests updated or added

- **New `llm-evidence/tests/whole-page.test.ts`**, 11 tests. They hold:
  - 5,000 elements in are 5,000 out, in order, with handles `target.1`…`target.5000`.
  - A modal's controls are not moved.
  - A 10,000-character text, name and label arrive whole.
  - All 100 options arrive, with empty ones kept.
  - Attributes are tuples, `headers` and `selector` included. Core's screen with the domain's denied
    keys then finds `deniedKey: false`.
  - A secret-shaped attribute, text and option are withheld, and Core's screen then finds
    `secretShaped: false`.
  - A secret query value is withheld, in the location, a cross-origin href, a fragment and an
    `href` attribute. Embedded credentials are refused.
  - Secret parameter names match whole words only.
  - The new element fields.
  - Sensitive controls are dropped with either attribute form, and their values never travel.
  - Every dialog, blocker, indicator, the navigation URL and the unanswered frames are carried.
- **`runtime/tests/reusable-evidence.test.ts`**: a 500-element page, 30 actions and 30 capabilities
  are projected whole and in order, with no throw.
- **Deleted `llm-evidence/tests/limits.test.ts`**. Its subject, `limits.ts`, is gone.
- **Updated**, all where they asserted a cap, the old order, or a stripped query or value:
  - in `llm-evidence/tests/`: `sanitize`, `page-evidence`, `packet-carries-no-selector`,
    `look-alikes`, `failure-row-values`, `page-refusal`, `present`, `recovery-selector-hints`,
    `renamed-save-override`, `stable-handles`, `tools` and `elements`;
  - in `llm-evidence/`: `target/tests/candidates`, `target/tests/equivalence`,
    `plan-resolution/tests/{plan-node-identity,record-identity,resolve-plan-node}`,
    `structure/tests/{detect,badge-column}` and
    `state-digest/tests/{call-route-states,call-state-digests,state-digest}`;
  - in `runtime/tests/`: `adapter` and `host-runtime`.

## Commands run and observed results

**`bash C:/Users/osrs_/FluxStuff/build-slots/heavy.sh "t200 domain check" pnpm --filter @fluxiq-web-extension/domain check`**
exited 2. Every error is in the unowned file:

```text
src/tests/page-evidence-joinery.test.ts(154,35): error TS2339: Property 'role' does not exist on type 'WebLlmEvidenceBlocker[]'.
src/tests/page-evidence-joinery.test.ts(155,35): error TS2339: Property 'name' does not exist on type 'WebLlmEvidenceBlocker[]'.
src/tests/page-evidence-joinery.test.ts(156,35): error TS2339: Property 'blocks' does not exist on type 'WebLlmEvidenceBlocker[]'.
src/tests/page-evidence-joinery.test.ts(168,33): error TS2339: Property 'spinner' does not exist on type '{ readyState?: string; busy?: true; indicators?: WebLlmEvidenceLoadingIndicator[]; pendingNavi
src/tests/page-evidence-joinery.test.ts(185,25): error TS2339: Property 'elementTotal' does not exist on type 'WebLlmPageEvidence'.
src/tests/page-evidence-joinery.test.ts(220,148): error TS2339: Property 'elementTotal' does not exist on type 'WebLlmPageEvidence'.
src/tests/page-evidence-joinery.test.ts(291,26): error TS2339: Property 'blocks' does not exist on type 'WebLlmEvidenceBlocker[]'.
src/tests/page-evidence-joinery.test.ts(296,26): error TS2339: Property 'role' does not exist on type 'WebLlmEvidenceBlocker[]'.
src/tests/page-evidence-joinery.test.ts(297,26): error TS2339: Property 'name' does not exist on type 'WebLlmEvidenceBlocker[]'.
src/tests/page-evidence-joinery.test.ts(319,24): error TS2339: Property 'spinner' does not exist on type '{ readyState?: string; busy?: true; indicators?: WebLlmEvidenceLoadingIndicator[]; pendingNavi
```

The source half passes on its own: `node_modules/.bin/tsc -p tsconfig.json --noEmit`, run through
heavy.sh in `domain/`, printed nothing.

**`bash C:/Users/osrs_/FluxStuff/build-slots/heavy.sh "t200 domain test" env DOMAIN_TEST_BUILD_LABEL=t200-domain pnpm --filter @fluxiq-web-extension/domain test`**
exited 1. The per-file summaries summed to `tests 978`, `pass 973`, `fail 5`. The five failures are
all in the unowned file:

```text
not ok 957 - both readers see the same blocking overlay, and the packet takes the one the producer ranked first
not ok 958 - both readers see the same loading state, including which kind of indicator is on screen
not ok 959 - both readers see the same navigation facts, and the packet strips the query the state keeps
not ok 960 - both readers see the same element funnel, so the model is told what the browser already cut
not ok 964 - real capture: what the page painted over its controls reaches both readers
```

The run before my last round of fixes showed 965/977 with 12 failures. The 7 outside the joinery
file were fixed, and the suite was then re-run with the result above.

**`node scripts/structure-audit.mjs`**, at the tree root:

```text
structure-audit: 1 baseline entries can be lowered. Run "pnpm structure:baseline" to record the improvement.
structure-audit: passed (128 warning(s), 119 baselined).
```

The "can be lowered" entry is the `failure-as-empty` baseline for `page-evidence.ts`, whose `catch`
moved into `location.ts`. `.structure-baseline.json` is not mine, so the lead needs to run
`pnpm structure:baseline`.

The warning count was 128 when I started and is 128 now. `elements.ts` had passed the 400-line
advisory at 475 lines, so I split the attribute handling out and trimmed it to 392.

**The proposed joinery patch, verified outside the tree.** I ran
`node <scratchpad>/t200w2-jn-verify.mjs`. It type-checks the domain test project with the patched
contents swapped in through a compiler host, then bundles the patched file at its real path and
runs it:

```text
type errors: 0
# pass 12
# fail 0
```

**Profiling a 12,000-element page** (temporary test file, deleted afterwards):

| Stage | Time |
| --- | --- |
| sanitize | 317 ms |
| digest | 226 ms |
| route state | 19 ms (after the Set fix; 468 ms before) |
| restamp | 152 ms |
| a whole `run_node` look | 612 ms |
| a press (two captures) | 1,211 ms |

**Test durations.** The stable-handles reset test spends 999,999 numbers across 200 synthetic
5,000-element bindings, and takes about 9.6 s. The 12,000-element press test takes about 3.4 s.

## Not verified

- **No live browser or Lab run.** Nothing here was exercised against the real extension. The w1
  extension changes that now sit in the tree were read, not run: they emit `attributes` as a
  source-ordered record, which my reader accepts, and `evidence.unansweredFrameIds`.
- **The domain against the rebuilt Core dist.** It compiles against the sibling Core's current
  (old) dist.
  - `llm-evidence/tests/recovery-selector-hints.test.ts:135` still passes `maxEvidenceBytes: 6_000`
    to Core's loop `executeTool`, whose old type requires it. Once w3 removes it from Core's type,
    that line is an excess-property error.
  - `runtime/tests/adapter.test.ts` still calls Core's `sanitizeAutomationStudioLlmFailureEvidence`
    on a small packet. It passes against the old gate.
- **Anything outside my ownership that reads the removed names.** Listed below.

## Open questions or contradictions found

1. **The joinery patch for the lead.** It is for `domain/src/tests/page-evidence-joinery.test.ts`,
   and was verified with 0 type errors and 12/12 passing. It sits at
   `<scratchpad>/t200w2-joinery.proposed.ts`, and the diff is:

   ```diff
   @@ -147,11 +147,15 @@
   -test("both readers see the same blocking overlay, and the packet takes the one the producer ranked first", () => {
   +test("both readers see the same blocking overlays, every one of them, in the order the producer ranked them", () => {
      const values = projected(snapshot);
      const evidence = packet(snapshot);
   -  const blocker = collection(values, "evidence.overlays.blockers").items[0];
   +  const blockers = collection(values, "evidence.overlays.blockers").items;
      assert.ok(evidence.blockedBy, "the packet reported nothing covering the page");
   -  assert.equal(Object.hasOwn(evidence.blockedBy, "selector"), false);
   -  assert.equal(evidence.blockedBy.role, blocker?.role);
   -  assert.equal(evidence.blockedBy.name, blocker?.label);
   -  assert.equal(evidence.blockedBy.blocks, blocker?.blocks);
   +  assert.equal(evidence.blockedBy.length, blockers.length);
   +  const [carried] = evidence.blockedBy;
   +  const blocker = blockers[0];
   +  assert.ok(carried);
   +  assert.equal(Object.hasOwn(carried, "selector"), false);
   +  assert.equal(carried.role, blocker?.role);
   +  assert.equal(carried.name, blocker?.label);
   +  assert.equal(carried.blocks, blocker?.blocks);
   @@ -166,7 +170,7 @@
   -  const kinds = collection(values, "evidence.loading.indicators").items.map((item) => item.kind);
   -  assert.equal(evidence.loading.spinner, kinds.includes("spinner") ? true : undefined);
   +  const indicators = collection(values, "evidence.loading.indicators").items;
   +  assert.deepEqual(evidence.loading.indicators, indicators.map((item) => item.label === undefined ? { kind: item.kind } : { kind: item.kind, label: item.label }));
   -test("both readers see the same navigation facts, and the packet strips the query the state keeps", () => {
   +test("both readers see the same navigation facts, and the packet withholds the secret the state keeps", () => {
   @@ -177,10 +181,11 @@
   -  assert.equal(evidence.navigation.referrer, `${referrer.origin}${referrer.pathname}`);
   -  assert.doesNotMatch(JSON.stringify(evidence), /session=private/u, "the packet must not carry a query string");
   +  // The query is kept (t200); a parameter named like a session has its value withheld.
   +  assert.equal(evidence.navigation.referrer, `${referrer.origin}${referrer.pathname}?session=(withheld)`);
   +  assert.equal(evidence.navigation.url, pageEvidence.navigation.url);
   +  assert.doesNotMatch(JSON.stringify(evidence), /session=private/u, "the packet must not carry a secret query value");
   -test("both readers see the same element funnel, so the model is told what the browser already cut", () => {
   +test("both readers see the same element funnel, so the model is told when the browser itself cut", () => {
   -  assert.equal(evidence.elementTotal, values["evidence.elements.matched"]?.value);
   @@ -219,4 +224,4 @@
   -    { loading: evidence.loading, navigation: evidence.navigation, dialogs: evidence.dialogs, blockedBy: evidence.blockedBy, elementTotal: evidence.elementTotal },
   -    { loading: undefined, navigation: undefined, dialogs: undefined, blockedBy: undefined, elementTotal: undefined }
   +    { loading: evidence.loading, navigation: evidence.navigation, dialogs: evidence.dialogs, blockedBy: evidence.blockedBy },
   +    { loading: undefined, navigation: undefined, dialogs: undefined, blockedBy: undefined }
   @@ -282,3 +287,3 @@
   -  const blockedBy = packet(capture).blockedBy;
   +  const blockedBy = packet(capture).blockedBy?.[0];
   @@ -313,3 +318,3 @@
   -  // not a spinner; the packet must not promote it.
   +  // not a spinner; the packet carries the kind the producer gave, and its words.
   @@ -318,3 +323,3 @@
   -  assert.equal(loading.spinner, undefined);
   +  assert.deepEqual(loading.indicators?.map((indicator) => indicator.kind), evidence.loading.indicators.map((indicator) => indicator.kind));
   ```

2. **Consumers outside my ownership that break on removed names.** These need their owners.
   - `apps/extension/e2e/content/tests/evidence/tests/budget.spec.ts:31,45` and `controls.spec.ts:26,38`
     import `WEB_LLM_EVIDENCE_BYTE_BUDGETS`, which is removed. `controls.spec.ts:111` reads
     `packet.blockedBy?.blocks`, which is now an array.
   - These three pass `maxEvidenceBytes` in the `BASE` of a domain `executeTool` call, which is now
     an excess property:
     - `apps/extension/e2e/content/tests/exploration-state/tests/field-entry-target-stability.spec.ts:35`
     - `apps/extension/e2e/content/tests/extraction/tests/item-conditions.spec.ts:59`
     - `apps/extension/e2e/content/tests/extraction/tests/list-completeness.spec.ts:48`
   - `apps/extension/e2e/content/tests/repeat-exemplars.spec.ts:18`: a comment only.
   - `packages/test-runner/src/run-evaluation/evidence-budget-invariant.ts:1,29` and its test import
     `WEB_LLM_EVIDENCE_BYTE_BUDGETS` from `@fluxiq-web-extension/domain/node`. That is the built
     `dist`, so this breaks at the next domain build. The file is not in w5's partition.
   - `packages/test-runner/src/web-flow-exploration.ts`: `maxEvidenceBytes`,
     `fitPageToEvidenceBudget`. This is w5's.
   - `domain/src/recording/web-state/evidence/input.ts`: its cap table still lists "The sanitized
     packet's element bound and byte budget | `elementsTruncated`, `budgetTruncated`". The comment
     is now stale, and the file is not mine.
   - `docs/architecture/extension-client.md:916-918` states extension-side caps, including 2,000
     descriptors, and links `page-evidence.md#the-four-caps`. The anchor still works.
3. **Core bounds that will now refuse or withhold whole-page evidence.** Core, read only:
   - **`R/llm/harness/failure-evidence.ts` `boundedFailureEvidenceValue`.** It allows at most 2,000
     characters per string, 128 children, 512 entries and 6,000 bytes. Any realistic failure packet
     now exceeds these, and Core refuses it (`llm.request.failure_evidence_invalid`). This is w4's.
   - **`R/recovery/context.ts:646` `boundedDomainSection`** withholds a state diff over its bound.
     The diff is now full. This is w4's.
   - **`R/llm/harness/context-packet.ts:270`** slices `stateDiffs` to 50.
   - **`storage/project/reusable-llm-context-store.ts:11-18`.** It allows
     `AUTOMATION_STUDIO_REUSABLE_LLM_CONTEXT_MAX_PROMPT_BYTES = 12_288`, 256 JSON items, depth 8 and
     2,048-byte strings. A whole-page projection over those is refused at `put`, which the domain's
     write catches. **No Core worker owns this file in the partition.**
4. **The handle pattern in Core.** I grepped Core src for any `target.` handle regex and found none.
   Core takes the pattern only from the domain's tool `inputSchema`
   (`WEB_LLM_TARGET_HANDLE_PATTERN`), so six digits needs no Core change.
5. **The redaction marker.** The brief says to use "the domain's redaction marker
   (domain/src/sensitivity/redaction.ts)". The only marker there is
   `WEB_AUTOMATION_WITHHELD_COMPARISON_TEXT`, "(withheld: the action ran on a control that holds a
   secret)", which describes a withheld *comparison* and would mislead the model on a page string.
   I defined `WEB_LLM_WITHHELD_TEXT` in `llm-evidence/withheld.ts` instead. If the lead wants one
   marker for the whole domain, it belongs in `sensitivity/redaction.ts`, which I don't own.
6. **A card number in an unmarked text field now travels.** This follows the brief ("for
   non-sensitive safe-fill controls, the value the capture carried"). A text input with no
   `type=password`, `cc-*` `autocomplete` or `data-sensitive` has its value published whenever the
   extension's `captureSettings.inputValues` is on. Core's credential shapes do not match card
   numbers. `host-runtime.test.ts` now marks its card field with `autocomplete: cc-number` to keep
   testing the sensitive path. A Luhn check was not added, because `sensitivity/redaction.ts`
   explicitly argues against value heuristics. It is the lead's call.
7. **The sensitivity reader accepts object attributes only.**
   `domain/src/sensitivity/descriptor.ts` reads `attributes` as an object only. My sanitizer
   normalizes before asking it, so the packet is safe either way. But if the extension ever sends
   tuples, the other callers would fail open: the recording reducer and the background worker. The
   extension currently sends a record.
8. **`detect`'s description** (`tools.ts:302`, `harness-options/options.ts:132`) still says "else
   the page's largest list". I kept it: it states which list the page-side detection returns, which
   is unchanged. The `tools.ts` description is also 19 characters under Core's 2,000-character
   limit.
9. **Caps kept deliberately, as not page information on its way to a model.**
   - The Flow-state memory bounds: `RETAINED_*` in `tools.ts`, `plan-resolution/target-packets.ts`
     and `structure/handles.ts`, and `RETAINED_FLOWS` in `stable-handles.ts`.
   - Plan-value search depth: `handle-tokens.ts` `MAX_SEARCH_DEPTH = 8` and `denied-keys.ts`
     depth 8.
   - Issue codes: `MAX_ISSUE_CODES = 16`, `issue-position.ts` 100.
   - `MAX_WEB_LLM_NAME_ASSUMPTIONS = 16`, which is Core's bound.
   - `permission.ts`: a 2,000-character control name for Core's permission check.
   - The model's own invented node name, cut to 200 in `node-run/run.ts:607`.
   - Core's failure-record text limits: `failure/codes.ts` via `WEB_AUTOMATION_VALIDATION_TEXT_MAX_LENGTH`
     = 1,024, which equals Core's `textMaxLength`, and `expectation/conditions.ts` at 160.
10. **Recording caps**, listed and not touched:
    - `recording/web-state/element/selection.ts:16`: `MAX_STATE_ELEMENTS = 1_500`, ranked then
      sliced.
    - `recording/web-state/element/identity.ts:15`: `MAX_STATE_ID_LENGTH = 120`.
    - `recording/web-state/evidence/project.ts:69-78`: dialogs 5, overlay blockers 5, blocked
      selectors 5, loading indicators 8, busy regions 8, regions 20, repeating runs 8, repeating
      fields 8, forms 8, form controls 20.
    - `recording/web-state/evidence/read.ts:29`: `MAX_TEXT = 200`.
    - `recording/web-state/visual-frame.ts:19`: `MAX_VISUAL_FRAME_ELEMENTS = 1_000`, and a
      name slice of 80 at `:45`.
