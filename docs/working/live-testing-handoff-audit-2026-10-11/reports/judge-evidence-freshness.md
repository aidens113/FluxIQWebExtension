# Judge evidence freshness ? B round six

Status: read-only trace complete. No source edits, builds, tests, browser/provider launches, commits or shared-document changes.

## Finding

The three result judges received a newly captured terminal page, not merely old pre-action trace or an exploration tool cache. The totals are stale **page content**: the fixture deliberately leaves its visible header badge unchanged while refreshing a hidden mini-cart. Default observation captures rendered elements only, so the current hidden account never enters the judge view. The independent Lab oracle explicitly probes those hidden DOM facts. This is an observation-coverage limitation plus a final judge inference error, not a proven cache/freshness implementation defect.

Important distinction from initial full-run diagnosis: both trial requests supply independent Added-to-cart/Qty1 change evidence for **both** towel adds. The saved playback request supplies it only for the second add. Therefore the independent saved-playback oracle does not establish that the reset-start trial itself failed. Trial judges' arithmetic/explanations are wrong, but calling their yes verdicts false positives is unsupported without an independent exact trial-state sample. Final judge yes is demonstrably false against its own missing first-add confirmation and the original exact final oracle.

## Actual request evidence

Private input root: `C:/Users/osrs_/FluxStuff/lab-runs/2026-10-11/run-mv4rpjav-bf36010e/steps/`. Requests43/44 are the exact same reset-trial resultSummary (same end/start hashes); request62 is the separate saved runtime summary. Contexts have resultSummary.endView/startView and per-node changed rows, not legacy exploration build rows. All have withheld=false.

| Request | End-page characters | Visible terminal badge total | Actual add change receipts |
| --- | --- | --- | --- |
|0043-judge|6513|$36.91| s11 and s14 each Added/Qty1; s20 Added/Qty1 |
|0044-judge|6513|$36.91| same exact trial summary |
|0062-judge|6513|$20.44| s11 no Added/Qty1; s14 Added/Qty1; s20 Added/Qty1 |

Trial endView JSON SHA256 `63c9356fcafb29477104334e814e4a688d8bd64d09ebd0cebc611995ed01d7ce`; final `0af00a65a16e885f8aef0fbf17ffade7fee9183bcd9b35d3a85c67ee06734493`. BothtrialstartViews6969chars/hash3105af9e4d5273f2958e92bed743499f23eaa623d0314add2e231b40b77ec24e; finalstart6996chars/hash79e5d488e678fcd8a2ed70fdd4a4e77a9166175f8b88284200a13cf19d6431e6. Hashes use Python JSON ensure_ascii=false/default separators on saved endView/startView objects; no page bodies copied here.

Final original oracle has3items/$26.92 and towelquantity1; hidden current facts fail requested4items/$43.39/quantity2. Trial current authoritative total is not independently sampled. The stale badge amounts precisely equal cart contents at the last product document's load: trial baseline soap plus two towels=$36.91; saved baseline soap plus one towel=$20.44. Final add then changes hidden mini-cart by requested napkin$6.48 while keeping badge unchanged. This accounts for the final26.92 total and the difference between trial/final end-view totals without tool cache replacement. Trial43.39 after last add is a source/receipt-derived expectation, not an independently measured exact trial oracle.

Alljudge requests contain Qty1; none contains Qty2 or$43.39. Finalrequest lacks$26.92. Missing current totals are already absent from domain default capture, not cut by resultSummary or provider request assembly. Captured per-step diffs do reach the judge. Final s11 changed entry735characters has no Added/Qty1; s14 entry4375characters does; finaljudge nevertheless asserts both presses confirmed. Trial s11entry4130/s14entry4403 each hasconfirmation; their yes verdicts may be semantically correct despite stalebadge arithmetic. No claim that more cash, repeated lasting clicks or a goal parser would solve this.

## Exact source ownership and flow

Core owns generic judgement orchestration:
- `packages/fluxiq/src/programs/automation-studio/runtime/service/candidate-trial/run.ts:88`: after successful exacttrial/writeSession, reads recordsets/trace and invokes readEndView before judge.
- `service/candidate-trial/summary.ts:29`: calls automationStudioResultEndViewRead and builds trial-only summary from trialgraph/trace/actionattempts. No exploration-window/cache input.
- `service.ts:1568`: trial readEndView uses automationStudioRunEndViewReader on bound domain.
- `result-verification/run-outcome.ts:508`: saved result check separately invokes same readEndView before summary; uses thissession trace and actionattempts.
- `service/end-view/run-reader.ts:25`: domain tools first, then registered runsNodes.initial fallback; execute under observation-only denied-lasting-act permission and original project/Flow, no navigation/startLocation.
- `service/end-view/look.ts:56`: chooses declared free initialObservation; executes it, projects declared top-level observedStateKeys.10s timeout/cancellation; missing view absent; failures recorded unreadable. Result verification deadline120s in `result-verification/deadline.ts`. No byte trim here.
- `result-verification/result-summary.ts:162`: per-node changes, start/endviews, denied-key/secret screening. Withheld=false in actual requests. Whole view retained when screened; no word/character cap used to omit minicart.
- `result-verification/step-changes.ts:50`: actual trace diffs added/removed, skipping document-changing diffs; no cap. Correct missing first-add confirmation is supplied, not replaced by trial/exploration evidence.

Downstream domain owns observation selection and screening:
- `domain/src/runtime/llm-evidence/tools.ts:448`: declares default observation node parameters{} and page observedStateKeys.
- `node-run/run.ts:217`: observation executes readablePage, then returns current capture as both before/after; never executable Flowstep. `:780` directly captureEvidence; no last-page/tool cache read on this path.
- `capture.ts:528`: sends fresh gateway capture_snapshot parameters{}; the existing low-level includeHidden=true option is currently used for page-find searches, not default observation.
- `observed-state/observed-state-keys.ts`: renderedpage key declaration. `page-view/published-page.ts:26` and `page-text.ts:13` publish sanitized page; endview contains this actual6513character text. Hidden fields were never captured, so publication cannot restore them.
- `domain/src/actions/schemas.ts:308`: public snapshot node schema parameters{}; `output-nodes/payloads.ts:97` snapshot public payload{}. Passing includeHidden to this node today would not be a supported result-read change by configuration alone.

Extension owns browser capture, not Core:
- `apps/extension/src/content/actions/capture-snapshot.ts:23`: immediate deps.captureSnapshot(snapshotCaptureOptionsFor(action)); no cache or intentional prestep snapshot.
- `content/dom-snapshot.ts:187`: default renderedElements excludes hidden; includeHidden adds flagged hidden entries while preserving rendered-only page evidence/change tracking. Existing explicit includeHidden seam is already implemented at browser action level.

Fixture/Lab owns adversarial page and oracle:
- `apps/scenario-lab/src/scenarios/bigbox-retail/client/product-script.ts:33`: documented mini-cart update never countbadge. `:95?98` successful add updates servercart and refreshes mini-cart.
- `client/shell-script.ts:51?53`: fetch currentmini-cart and replace its HTML. `shell/shell.ts:53` mini-cart starts hidden; mouseenter/leave toggles it (`shell-script.ts:56?59`). No repeated capture can make the visible badge current while it remains same document.
- `packages/test-runner/src/scenario-assertions.ts:43?46`: text fact uses locator.textContent, independently of visibility; final-state-facts.ts checks the original declared facts. Oracle accesses hidden minicart existingDOM, not special product truth injected into model.

## Narrow repair recommendation, conditional on supervisor choice

No evidence supports changing Core's read timing, replacing a stale cache, waiting longer or rerunning the same default look. Fresh DOM state exists but current registered result-observation policy does not include it. Existing browser includeHidden capability can obtain it without acting. The narrow repair is a **domain-declared observation-only result view**, backed by existing captureEvidence(includeHidden=true) and all existing sanitization/denied-key screening, with hidden rows explicitly marked not rendered. Keep ordinary initial/exploration snapshot and public executable node behavior unchanged.

Core currently reuses the domain's free initial observation for result checks, so a result-only observation needs a small optional opaque binding seam rather than recognizing URLs/selectors/task words or inspecting callId. Candidate exacttrial and saved result reader must both select that same domain-declared result observation, with fallback to existing initial view for domains that do not supply one. Potential Core owners: `llm/harness-options/binding.ts` optionalcontract, `service/end-view/run-reader.ts`/`look.ts`, their tests. Potential downstream owners: `domain/src/runtime/llm-evidence/tools.ts`, a focused observation-only handler beside capture, and owner tests; reuse capture.ts/includeHidden protocol and publishedpage flags. Do not add generic browser concepts to Core or alter fixture/oracle. No exact code/file expansion approved or implemented by this read-only brief.

Compatibility: optional Core binding capability preserves omitted-mode/default legacy view; domain must use it only when rebuilt against matching Core. No new browser wire protocol is necessary because includeHidden is existing; hidden evidence stays passive and does not make hidden controls executable. Additional view bytes may increase judge input cost; preserve existing budget/privacy/cancellation and record unreadable/withheld accurately. Model may still misread correctly supplied state; this recommendation improves coverage, not deterministic goal understanding or guaranteed semantic pass.

Neutral fail-first owner probe: fake gateway/current DOM snapshot with deliberately unchanged visible status and updated hidden ledger; old default look lacks ledger, explicit registered result observation returns updated ledger marked hidden under real sanitizer, no mutation/dispatch. Core end-view reader tests must show result observation chosen for trial and saved paths, legacy fallback unchanged, cancellation/denied permission maintained, and stale visible text retained beside currenthiddenvalue rather than silently rewritten. Domain tests must show sensitive-hidden controls still screened, view/read does not become Flow action, existing rendered-only default unchanged. An independent generic actual-browser probe can later confirm DOM behavior; no browser launched in this investigation. Do not use lane task, quantities, products or expected answers in product guidance/tests.

## Limits

No current hidden terminal packet exists in the saved judge requests; full current hiddenDOM after original trial is not available through this readonly trace. New fixtureprobe already proves first-click wake behavior, but no exact extension-control event probe was performed. Correctly supplied trial two-add confirmations and saved missing-first-confirmation remain distinct. Sourcefreshcapture path plus snapshots/deltas strongly excludes tool cache as cause; no per-gateway raw capture timing receipt was saved to establish millisecond timing. No proposed change has been implemented or tested. Root owns acceptance/follow-up.
