# w2-w3a-recovery-detection: a recovery can detect lists, and a repair taken from an explored page gets the right selector hint

Worker report, 2026-09-16. This repository only. Core (`F:\!FluxIQ`, `dev`,
`6964d63`) was read, never edited. No live provider call was made. Nothing
was committed.

## Outcome

Done, including the coordinator's three mid-task additions: the `packetKey`
fix, the eviction fix, and the detect-tool description sentence.

In plain terms, a runtime repair (recovery) now works like this:

1. **It can detect lists.** A recovery that is exploring (`gather` or
   `iterate`) is offered `web.recovery.detect_repeating_structure`. It is the
   same detection creation has, with the same input bounds, and it observes
   only. Authoring is never offered it, and neither is another domain.
   - A `target` handle is bound only through a packet this exploration
     returned.
   - The `extraction.N` handle it issues goes into the runtime's shared
     handle store. `resolveExtractionHandle` (and the plan resolver) can then
     read it for the same project and Flow, and for no other.
   - Its packet holds none of the domain's denied keys at any depth, and no
     selector.
2. **Selector hints survive for explored pages.** Every packet a recovery
   option returns is retained under the key the target check uses. A repair
   Core writes as `explored.2:target.1` (Core strips the prefix and asks
   about that packet) now resolves with the selector behind exactly that
   control (`#apply` in the test).
3. **Wrong hints are no longer possible from key collisions** (coordinator-approved
   `tools.ts` fix). A packet was keyed by location plus its handle list,
   and handles are always `target.1..N`. So the key was really just
   "location plus element count", and two captures of one page with the same
   count shared a key.
   - **This was already wrong before my change.** The first red run showed
     an explored packet's "Apply changes" handle given the failure packet's
     `#close` hint.
   - The key now includes every element in full, so equal keys mean equal
     fingerprints.
4. **An exploration can no longer evict the failure packet's hints**
   (coordinator-approved). Failure packets have their own window of 8, apart
   from the tool and exploration window of 8.
   - With nine explored packets, the failure packet keeps its hints and the
     oldest explored binding is the one dropped.
   - That dropped packet's repair still resolves, on the fingerprint alone.
5. **Extraction repair stays fail-closed**, as the brief required: none of
   `target-override.ts` or `repairable-parameters.ts` was touched.

**Eviction choice, and why: a separate failure window.** I did not size one
window to hold the failure packet plus the exploration's packets.
- **The failure packet is always needed.** There is exactly one per repair,
  and the target check reads it every time.
- **Explored packets are many, and only the newest matter.** Core carries only
  the newest to the patch, newest first under a byte allowance; C-7 estimated
  about one 6 KB packet fits.
- **A combined window would have to reach 65.** Core's count bound is 64
  explored packets plus the failure packet, so every authoring session would
  hold 65 bindings to cover a case the byte bound makes rare.
- **The separate window matches the coordinator's test.** It expects the
  oldest explored binding to be the one dropped.

## What changed and why

All code paths are under `domain/src/runtime/llm-evidence/`.

`harness-options/vocabulary.ts`
- `web.recovery.detect_repeating_structure` is added as the sixth id, with the
  constant `WEB_RECOVERY_DETECT_OPTION_ID`.
- The refusal-classifier comment was corrected: a recovery option now raises
  `sensitive_value`, meaning "every field of that list is a sensitive
  control".
  - It stays unclassified: nothing was read or shown, the model can choose
    another target, and no Core stop reason fits.
  - The test also covers `no_repeating_structure` and `web.structure.detected`
    as not being stops.

`harness-options/options.ts`
- The sixth declaration:
  - input schema identical to the authoring tool's (a test compares them);
  - `effect: "observe"`, `safety: { sideEffect: "observe" }`, domain scope,
    stages `gather` and `iterate`;
  - no repeat policy and no free initial look, matching the authoring tool.
- **Why a separate id.** Core folds the runtime's plain `tools` and these
  options into one bundle (`binding.ts`
  `automationStudioHarnessOptionBundleFromBinding`). A second declaration
  with the same id would silently replace the authoring tool with the
  stage-pinned one, and take detection away from creation. The header now says
  this.
- The description does not carry the new "Write the list into the extraction
  node..." sentence. A repair is a target override, not a plan, and extraction
  repair is still refused, so that sentence would invite a repair that is
  always refused.

`harness-options/execute.ts`
- **The context gains two required fields.**
  - `retainSelectors`: the runtime's retention.
  - `extractionHandles`: the runtime's shared store.
  - Both are required, because an optional one would silently retain nothing.
- **One `shown()` bookkeeping replaces `remember()`.** It records the packet
  targets are bound through, and hands it to the retention.
  - It is called exactly where a packet is returned to the model: inspect,
    wait (after), navigate (after), reveal and act (after the click).
  - It is not called for the pre-action captures or for refusals. A test
    asserts both halves.
- **The detection implementation** calls `detectRepeatingStructure` with the
  recovery's own last packet and the shared store. Its structure packet is not
  retained, because no target check reads one.
- **A target taken from no packet is refused.** Reveal, act and detect now
  refuse `target_unobserved` when this exploration has shown no packet yet.
  - Previously they fell back to binding the handle against a fresh capture
    the model never saw (`returned ?? current`).
  - Core's loop always takes the initial inspect first, so normal runs are
    unchanged. This closes the fallback.

`tools.ts` (byte-safe; NUL count 1 before and after; no CR bytes before or after)
- **Call site.** The recovery bundle now receives `retainSelectors: retain`
  and `extractionHandles`.
- **Retention.**
  - `failureSelectors` and `toolSelectors` are separate windows of
    `RETAINED_SELECTOR_BINDINGS` (8).
  - `retainFailure` is used only by `captureSanitizedFailureEvidence`.
  - `keepNewest` re-inserts a packet shown again, then drops the oldest past
    the bound.
  - The lookup reads the failure window first, then the tool window. Equal
    keys now mean equal elements, so either binding fits.
- **`packetKey`** is now `location<NUL>JSON.stringify(elements)`.
  - Core JSON-clones both kinds of packet before asking:
    `failure-evidence.ts` `sanitizeAutomationStudioLlmFailureEvidence` checks
    bounds and returns `JSON.parse(JSON.stringify(evidence))`;
    `context-packet.ts` `packExploredEvidence` clones the same way.
  - So the serialization round-trips exactly.
  - An edited packet no longer matches; a test covers this.
- **Authoring detect description** (coordinator request): appended `Write the
  list into the extraction node as extractList: {handle, fields?: {yourKey:
  "fieldKey" | "fieldKey@attr"}, paginate?: false}.`
- The file is now 397 lines, under the 400-line advisory.

Byte diff (`diff --text -u`, pristine copy taken before any edit; the single
NUL byte is shown as `<NUL>`, and this report contains no NUL):

```diff
--- a/domain/src/runtime/llm-evidence/tools.ts
+++ b/domain/src/runtime/llm-evidence/tools.ts
@@ -128,7 +128,10 @@
  * How many packets' selector bindings are kept so a later repair can still put
  * the selector hint back. Small on purpose: this is a convenience for the
  * in-flight diagnosis, not a store, and a repair that finds no binding is
- * resolved fingerprint-only rather than refused.
+ * resolved fingerprint-only rather than refused. Failure packets get a window
+ * of their own: the target check always needs the failure packet, while an
+ * exploration returns any number of packets and Core carries only the newest
+ * to the repair, so the oldest explored binding is the one to let go.
  */
 const RETAINED_SELECTOR_BINDINGS = 8;
 
@@ -144,15 +147,14 @@
   };
   // Keyed by the packet itself, because Core hands the packet back to
   // `validateTargetOverrideEvidence` without the project or flow it came from.
-  const retainedSelectors = new Map<string, Map<string, string>>();
-  const retain = (binding: WebLlmSnapshotBinding): WebLlmSnapshotBinding => {
-    retainedSelectors.set(packetKey(binding.evidence), binding.selectors);
-    for (const key of retainedSelectors.keys()) {
-      if (retainedSelectors.size <= RETAINED_SELECTOR_BINDINGS) break;
-      retainedSelectors.delete(key);
-    }
+  const failureSelectors = new Map<string, Map<string, string>>();
+  const toolSelectors = new Map<string, Map<string, string>>();
+  const retainIn = (window: Map<string, Map<string, string>>) => (binding: WebLlmSnapshotBinding): WebLlmSnapshotBinding => {
+    keepNewest(window, packetKey(binding.evidence), binding.selectors);
     return binding;
   };
+  const retain = retainIn(toolSelectors);
+  const retainFailure = retainIn(failureSelectors);
   return {
     domainId: WEB_AUTOMATION_DOMAIN_ID,
     // The keys Core must refuse in evidence this domain supplies. Core used to
@@ -170,7 +172,7 @@
     // authoring `navigate` tool below already enforces; a per-run allowlist
     // is per-exploration, so threading one needs the coordinator, not this
     // line.
-    harnessOptions: webAutomationRecoveryHarnessOptionBundle({ gateway, scopePolicy: { kind: "same_scope" } }),
+    harnessOptions: webAutomationRecoveryHarnessOptionBundle({ gateway, scopePolicy: { kind: "same_scope" }, retainSelectors: retain, extractionHandles }),
     // How Core reads a refusal without learning any of this domain's result
     // codes.
     classifyRefusal: webAutomationExplorationRefusalClassifier,
@@ -202,7 +204,7 @@
       },
       {
         toolId: WEB_LLM_DETECT_STRUCTURE_TOOL_ID,
-        description: "Detect the repeating list or table an extraction would read: around an observed element when given its opaque target handle, else the page's largest list. Returns an opaque extraction handle naming it, each field's key, label, kind and coverage, the item count, and how the list continues. Returns no values or selectors. Observes only.",
+        description: "Detect the repeating list or table an extraction would read: around an observed element when given its opaque target handle, else the page's largest list. Returns an opaque extraction handle naming it, each field's key, label, kind and coverage, the item count, and how the list continues. Returns no values or selectors. Observes only. Write the list into the extraction node as extractList: {handle, fields?: {yourKey: \"fieldKey\" | \"fieldKey@attr\"}, paginate?: false}.",
         inputSchema: { type: "object", properties: { target: { type: "string", pattern: TARGET_HANDLE_PATTERN } }, additionalProperties: false },
         effect: "observe",
       },
@@ -290,7 +292,7 @@
       assertActive(input.signal);
       if (result.status !== "succeeded") throw new Error("web failure evidence snapshot capture failed");
       const payload = jsonRecord(result.payload, "web failure evidence action payload");
-      return retain(sanitizeWebLlmSnapshotWithBindings(payload.snapshot, present<WebLlmSanitizeOptions>({
+      return retainFailure(sanitizeWebLlmSnapshotWithBindings(payload.snapshot, present<WebLlmSanitizeOptions>({
         budget: "failure",
         maxEvidenceBytes: input.maxEvidenceBytes,
         expectedOrigin: undefined,
@@ -312,7 +314,8 @@
         evidence as WebLlmPageEvidence,
         target,
         failedAction,
-        retainedSelectors.get(packetKey(evidence as WebLlmPageEvidence))
+        // Equal keys describe equal elements, so a binding from either window fits.
+        failureSelectors.get(packetKey(evidence as WebLlmPageEvidence)) ?? toolSelectors.get(packetKey(evidence as WebLlmPageEvidence))
       );
     },
     resolveExtractionHandle(input) {
@@ -347,15 +350,28 @@
   ).map((session) => session.sessionId);
 }
 
+/** Keep `selectors` as the newest entry, re-inserted when shown again, and let the oldest go past the bound. */
+function keepNewest(window: Map<string, Map<string, string>>, key: string, selectors: Map<string, string>): void {
+  window.delete(key);
+  window.set(key, selectors);
+  for (const oldest of window.keys()) {
+    if (window.size <= RETAINED_SELECTOR_BINDINGS) break;
+    window.delete(oldest);
+  }
+}
+
 /**
- * A packet's identity for the binding lookup: its location and the exact
- * handles it describes. Core round-trips the packet through JSON, so this is
- * matched on what the packet says rather than on object identity, and a packet
- * that was trimmed, recaptured or re-ranked no longer matches -- which is the
- * intent, because its handles would then mean something else.
+ * A packet's identity for the binding lookup: its location and every element
+ * it describes, whole. Handles are numbered from 1 in every packet, so keyed on
+ * handles alone two captures of one page with one element count collided, and
+ * a repair got the hint of a different control. Keyed on the elements, equal
+ * keys mean equal fingerprints at every handle. Core round-trips the packet
+ * through JSON, which reproduces this serialization, so it is matched on what
+ * the packet says rather than on object identity, and a packet that was
+ * trimmed, recaptured, re-ranked or edited no longer matches.
  */
 function packetKey(evidence: WebLlmPageEvidence): string {
-  return `${evidence.location}<NUL>${evidence.elements.map((element) => element.target).join(",")}`;
+  return `${evidence.location}<NUL>${JSON.stringify(evidence.elements)}`;
 }
 
 function evidenceScope(input: WebLlmEvidenceToolRequest, sessionId: string): string {
```

Tests (written first):
- `harness-options/tests/options.test.ts`, updated:
  - six options, and detection is in the observe-only list;
  - the retained packet is exactly the one returned, with its selectors;
  - refusals and pre-click captures are not retained;
  - reveal, act and detect refuse a target before any packet, and nothing is
    clicked;
  - the classifier rows now include the new codes.
- `harness-options/tests/detect-option.test.ts`, new, 6 rows:
  - offered at `gather` and `iterate` only (not authoring, not `plan`,
    `implement` or `verify`, not another domain);
  - declaration equals the authoring bounds;
  - detects around a handle from a recovery packet, using the real Scenario
    Lab product-catalog capture, and the handle resolves for this Flow only;
  - refuses a target no recovery packet issued, another Flow's handle, or a
    page that moved on, without sending a detection;
  - no denied key at any depth (using Core's own key normalization), Core's
    other carry rules, and no capture selector anywhere;
  - "no list here" is an answer rather than a stop, and a client without the
    capability is a fault.
- `tests/recovery-selector-hints.test.ts`, new, 5 rows. It drives the real
  runtime through Core's `automationStudioHarnessOptionRegistry({ binding })`
  at `gather` under a policy, and hands the target check exactly what Core
  hands it (JSON clones, prefix stripped). The rows:
  - an explored-only control resolves with its hint, and no qualifier is
    stored;
  - `target.9` is still refused (`ambiguous`/`handle_not_issued`) against
    both the explored and the failure packet, and an edited packet gets no
    hint;
  - the failure packet and two explored packets of one page with equal
    element counts never lend each other hints;
  - nine explored packets leave the failure hints intact, and drop only the
    oldest explored binding;
  - recovery detection is offered through the bound runtime at `gather` and
    `iterate`, its handle resolves through `runtime.resolveExtractionHandle`
    for this Flow only, and a structure packet named in a repair is
    `evidence_unrecognized`.
- **Core's prefix parser is mirrored in the test**
  (`/^(explored\.[1-9][0-9]{0,2}):(.+)$/u`). Core's built `dist` (18:28)
  predates `a8ce814` (20:03), so `automationStudioExploredEvidenceHandle` is
  not importable yet.
- **Contract-spread findings fixed.** The coordinator reported three in the
  new test; those fields are now written by name.

## Commands run and observed results

**Red, before any source change.** Scratch esbuild runner, label `w3a-red`:
- `options.test.ts`: `# tests 11 # pass 7 # fail 4`. The failures were the
  observe-only list, retention (twice), and the unshown target.
- `recovery-selector-hints.test.ts`: `# fail 5` of 5, including
  `expected: '#apply' actual: '#close'`. That is the pre-existing collision.
- `detect-option.test.ts`: build error, "No matching export ...
  WEB_RECOVERY_DETECT_OPTION_ID".

**Intermediate, after the options and the call site only** (`w3a-mid`):
- `options.test` 11 of 11 passed, and `detect-option.test` 6 of 6.
- `recovery-selector-hints` had 3 failures, as designed:
  - the collision (`expected: '#close' actual: '#apply'`);
  - the edited packet borrowing `#apply`;
  - the eviction (`expected: '#close'`, failure hint gone).

**Green, after the `tools.ts` fixes** (`w3a-green`): 11 of 11, 6 of 6 and 5 of 5,
all exit 0.

**Negative probes.** Each probe was applied with the byte-replace script,
the three files were rerun, and the file was restored and confirmed
byte-identical with `cmp` each time:

| Probe | Result |
| --- | --- |
| A: key on handles only | hints file: 3 failures (explored hint, edited packet, collision) |
| B: one shared window | hints file: 1 failure (eviction row) |
| C: `retainSelectors` not called | options: 2 failures; hints file: 3 failures |
| D: unshown target falls through | options: 1 failure; detect-option: 1 failure |
| E: detection with no stage pin | options: 1 failure; detect-option: 2 failures |
| F: private handle store instead of the runtime's | hints file: 1 failure (resolveExtractionHandle row) |

**Validation.**
- **`pnpm --filter @fluxiq-web-extension/domain check`.**
  - First run: exit 2, one error in my new test (TS2352, a direct cast from
    Core's target type). Fixed with a status narrow.
  - Rerun: **exit 0**.
- **`node scripts/structure-audit.mjs`: `structure-audit: passed (61
  warning(s), 122 baselined).`**, exit 0.
  - Before my change the output was 60 warnings. The one new warning is
    `harness-options/vocabulary.ts: 9 exported values is past the 8-value
    advisory threshold` (see open questions).
  - No contract-spread finding remains.
- **`pnpm --filter @fluxiq-web-extension/domain test`: exit 0, `# tests 636 #
  pass 636 # fail 0`**, and no "failed to load" line.
  - This was the unlabelled run, so it rewrote the tracked
    `domain/.test-build/`.
  - It added two untracked bundles:
    `.test-build/runtime/llm-evidence/harness-options/tests/detect-option.test.mjs`
    and `.test-build/runtime/llm-evidence/tests/recovery-selector-hints.test.mjs`.
  - Other workers' in-flight files are bundled there too. Regenerate at
    integration.
- **The domain token-budget test** (`src/tests/domain.test.ts`) passed inside
  that run.
  - To quote numbers, a scratch bundle logged the values it asserts on; no
    source change.
  - With the new sentence: evidence-decision DeepSeek estimate **7,844**
    tokens against the `<= 8_000` assertion. The detect description is 470
    characters. Bootstrap estimate 2,744 against `<= 3_000`.
  - Without the sentence (scratch bundle only): 7,798 and 336 characters.
  - So the sentence costs **46 tokens**, and **156 tokens** of headroom
    remain.
- **Extension suite:** `EXTENSION_TEST_BUILD_LABEL=w3a-ext node
  scripts/test-extension.mjs` gave exit 0, `# tests 652 # pass 652 # fail 0`.
  I ran it because an extension test bundles this runtime.
- **Size of what a recovery is shown** (scratch probe, Core's registry on the
  real runtime, `gather`):
  - side effects allowed: 10 tools, 4,675 bytes;
  - side effects forbidden: 5 tools, 2,340 bytes;
  - the new option adds 588 bytes to either.
- **Cleanup.** All `domain/.test-build-scratch/w3a-*` and
  `apps/extension/.test-build-scratch/w3a-ext` were deleted. Copies of
  `tools.ts` before and after, and the full diff, are in
  `<scratchpad>/w3a/`.
- **Hardware.** No run failed in a way that looked like the RAM fault; no
  reruns were needed.

## Not verified

- **No live DeepSeek run** (the brief forbids one). Untested live:
  - whether the model uses the recovery detection;
  - whether it copies `explored.N:` handles.
- **Core's real explored path was not driven end to end.** Core's `dist`
  predates `a8ce814`, so the tests mirror Core's prefix parsing and JSON
  cloning (the clone code was read at `context-packet.ts:250` and
  `failure-evidence.ts:56`). They do not run `patches.ts`.
  - After a Core rebuild, the mirror should be swapped for
    `automationStudioExploredEvidenceHandle`.
- **Apply and replay of a hinted repair**, and how Core's matcher uses the
  hint, were not exercised.
- **The `iterate` stage is untested live.** It is declared and tested at the
  registry, but Core's recovery exploration only ever calls `gather` today
  (`exploration.ts:163`).
- **Root `pnpm check`, `pnpm test` and `pnpm build`** were not run.
  `packages/test-runner` has another worker's uncommitted changes.
- **No architecture docs updated.** My brief does not own `docs/architecture`.

## Open questions or contradictions found

1. **Core offers the authoring tools to every recovery (a Core defect).** The
   binding's plain `tools` become options with no stage pin
   (`binding.ts` `scopedOption`), and the registry offers an unpinned option
   at every stage (`registry.ts` `stageAllows`). A recovery at `gather`
   therefore sees `web.inspect_current_page`, `web.navigate_same_origin`,
   `web.reveal_safe` and `web.detect_repeating_structure` beside the six
   recovery options. Two consequences:
   - the design's "detection is not offered during a recovery" was not
     literally true;
   - the authoring detect and reveal tools bind targets through the
     *authoring* packet map, not the recovery's. A handle copied from a
     `web.recovery.*` packet can bind against an older authoring packet of
     the same Flow, if the location and selector still match.

   Their descriptions (now including the `extractList` sentence) also cost
   input bytes the recovery pays for. Proposed Core change, not applied, in
   `AS/runtime/recovery/annotation/exploration.ts`:
   ```diff
   -  const registryLoop = automationStudioHarnessOptionRegistry({ binding: input.binding }).evidenceLoopBinding(
   +  // A domain that declares recovery options explores with those; its plain
   +  // tools are its authoring set and carry no stage of their own.
   +  const binding = input.binding.harnessOptions?.options.length ? { ...input.binding, tools: [] } : input.binding;
   +  const registryLoop = automationStudioHarnessOptionRegistry({ binding }).evidenceLoopBinding(
          { projectId: input.context.projectId, flowId: input.context.flowId, runId: input.context.runId },
          { scope: input.scope, stage: "gather", policy: input.policy }
        );
   -  const domainToolIds = new Set(input.binding.tools.map((tool) => tool.toolId));
   -  if (input.binding.harnessOptions) for (const option of input.binding.harnessOptions.options) domainToolIds.add(option.toolId);
   +  const domainToolIds = new Set(binding.tools.map((tool) => tool.toolId));
   +  if (binding.harnessOptions) for (const option of binding.harnessOptions.options) domainToolIds.add(option.toolId);
   ```
   The `{ ...input.binding, tools: [] }` spread may need to be written field
   by field under Core's contract-spread rule. A Core test should assert that
   the recovery tool list is exactly the domain's declared options. The
   fallback keeps a tools-only domain working. After this, the domain's
   `vocabulary.ts` comment about which codes the classifier sees stays true.
2. **One new advisory warning, which I could not clear within my files.**
   `harness-options/vocabulary.ts` now exports 9 values against the advisory
   threshold of 8; the hard limit is 15.
   - **Clean fix:** move `webAutomationExplorationRefusalClassifier` and
     `webAutomationExplorationScope` into their own file, for example
     `harness-options/exploration-terms.ts`.
   - **What it touches:** `harness-options/index.ts` (not mine), the imports
     in `execute.ts`, and the tests. That leaves 7 values.
3. **The barrel does not export the new id.** `harness-options/index.ts` (not
   mine) exports the other five id constants but not
   `WEB_RECOVERY_DETECT_OPTION_ID`. It is reachable through
   `WEB_RECOVERY_HARNESS_OPTION_IDS`, and nothing outside the directory uses
   the per-id constants. For consistency, one line:
   `WEB_RECOVERY_DETECT_OPTION_ID,` in the `./vocabulary` export list.
4. **Plan resolution does not see recovery packets.**
   `targetPackets.remember` (plan resolution) is still fed only by the
   authoring tools. The design's W-3 row wants recovery packets and
   detections remembered for plan resolution too. Extraction handles now
   are, through the shared store; `target.N` packets from recovery are not.
   - Feeding them changes when a bare handle is `ambiguous`, which is the
     plan-resolution worker's contract, so I left it.
   - It is a one-line addition to `execute.ts` `shown()` once that contract
     is decided.
5. **Token headroom is thin.** 156 tokens remain on the evidence-decision
   budget test. The next description growth there will fail it.
6. **Recovery detection has no bytes check against Core's real explored-packet
   allowance.** A structure packet is small (it is bounded by
   `maxEvidenceBytes`, like authoring), but it now competes for the patch's
   explored-evidence slot with page packets. It can never be used as a repair
   target (`evidence_unrecognized`), so carrying it costs bytes for no repair
   value. Core could skip packets whose tool is a detection when it packs the
   slot, or the domain could expose a "not a target packet" marker.
   Undecided; not changed.
