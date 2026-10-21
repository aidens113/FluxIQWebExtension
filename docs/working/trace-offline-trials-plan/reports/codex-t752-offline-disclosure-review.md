# t752 integration: offline disclosure review

## Current State

Read-only review complete. No source edits, builds, browser sessions, or tests were run for this review. The t752 source checkpoint remains frozen; final browser/package checks still await incoming dev integration.

## Findings

**P5 prevents access to the live tab, but does not yet guarantee an explicit gap for every unsupported t752 disclosure.** A changed read that newly needs collapsed text can currently be returned as an answered failed action instead of an evidence gap. It does not silently return expanded text in the ordinary script-driven case: t752 rechecks the text and preserves incomplete_text when it did not open.

Source facts:

1. `domain/src/runtime/offline-reads/read-eligibility.ts` allows extract_list because the domain classifies it safe and the changed paths lie under parameters/target. It does not inspect `discloseText`, the selected text fields, or whether a condition needs collapsed text.
2. `reevaluator.ts` maps both commands, loads the recorded snapshot, runs the recorded control and changed command through `WebSnapshotPage.evaluate`, then asks `dynamic-content.ts` whether to return a gap. Otherwise it calls `answered-result.ts`, which faithfully builds a gateway result even when the sandbox result failed.
3. The P5 host (`packages/test-runner/src/offline-snapshot-page/open-snapshot-sandbox.ts`, reached by the owning offline-reads browser spec) creates a fresh offline browser context. Requests are snapshot-routed; page scripts are blocked with CSP; content code runs in an isolated world. It does not dispatch the action to the user's live extension/tab. Attempts to navigate are held and requests that escaped the sandbox are counted. This is the concrete isolation boundary; domain eligibility alone is not that boundary.
4. t752 `list-reader.ts` sets disclosure on unless `request.discloseText === false`. A row read or text condition that throws its registered incomplete_text refusal reaches `readDisclosing`. That helper calls `pressTextDisclosure`, restores condition notes, and retries the row. A row rejected using an unrelated field never reaches this press.
5. `press-disclosure.ts` invokes the control's DOM `.click()` inside the current page, at most once per control and eight controls per row. It refuses links/forms, and waits at most two seconds per control, bounded by the read deadline. It has no offline/snapshot mode. On P5's page this is a local inert-snapshot click, not a live-page click. A normal script-driven See more cannot expand with the page scripts disabled; the second read still refuses.
6. `text-disclosure.ts` emits `OUTPUT_NOT_OBSERVED` with `failure.actual` beginning incomplete_text. `extractListAction` catches that error and returns `deps.failure`. It captures its success snapshot only after extraction; a successfully expanded live read therefore normally carries the expanded end state, not a saved pre-expansion behavior script.
7. `control-reproduced.ts` compares status, failure code, extracted values, and five extraction counts (recordCount/pagesRead/itemsSeen/emptyRecords/earlierPageRepeats). It does not compare disclosedRows, the failure's incomplete_text detail, or disclosure attempts. A control failing to reproduce its recorded successful full-text result is already a dynamic_content gap.
8. `dynamic-content.ts` recognizes script/network breaches, control mismatches, changed timeouts, target-not-found/not-shown, never-appeared lists, and extra held navigation/scrolls. It has no incomplete_text or unsupported-disclosure branch. A local inert button click that does nothing need produce none of those observations.

## Concrete cases

| Case | Present result inferred from source |
| --- | --- |
| Recorded full-text A succeeded after opening the row, but replayed control cannot reproduce it | Existing control mismatch produces dynamic_content gap. |
| A's captured DOM already contains whole text and B can read it without opening anything | It may answer if the normal control/dynamic checks pass. No disclosure is required. |
| A reads row position/link only and passes over a snapshot containing collapsed description; B adds description and keeps that row | A can reproduce. B attempts inert disclosure, then returns failed OUTPUT_NOT_OBSERVED/incomplete_text; absent another dynamic trigger, reevaluator returns answered with that failed result. This is the explicit-gap hole. |
| Both recorded A and inert control honestly fail incomplete_text; changed B also needs that unsupported expansion | Differential reproduction alone can still permit answered failure; unsupported disclosure is not independently classified as a gap. |
| B's other-field condition rejects the collapsed row | No disclosure is attempted; ordinary honest filtering can answer. |
| A/B explicitly set discloseText:false | No click. A faithful intentional refusal is distinguishable from an unsupported automatic disclosure and should retain deliberate command semantics. |

These rows are source-derived predictions, not browser measurements. In particular, native HTML controls that reveal already-captured content without a page script may behave differently; correctness must be proved against captured content rather than assumed from a click.

## Required P6 integration guard

P6 must preserve the inert, isolated snapshot boundary and distinguish a read of already-captured full text from a read requiring an unsupported disclosure. When automatic disclosure requires behavior/content that the snapshot cannot reproduce, return a matcher `gap` with `dynamic_content` (or a dedicated supported evidence-gap reason), before the result can be treated as an offline trial's ordinary failed action. Never retry that command in the live tab as an implicit fallback, and never synthesize the expanded text.

A robust seam is an explicit snapshot execution capability or measured unsupported-disclosure observation at the content/snapshot host boundary: the offline host can refuse unsupported presses, and the reevaluator turns that observation into a gap. Merely banning explicit discloseText:true is insufficient because t752's default is true. Merely comparing disclosedRows is insufficient because a newly kept collapsed row may not be in the control's read. Silently forcing discloseText:false changes the command; it should not masquerade as faithful reevaluation. Checking the generic OUTPUT_NOT_OBSERVED code alone would also overclassify unrelated honest validation failures.

Required P6 focused regressions: A reproduces without reading collapsed text while changed B needs it => explicit gap, no live dispatch, no fabricated content; full already-captured text => cell-for-cell answer; unrelated-field-rejected collapsed row => no press; explicit opt-out => no press with deliberate refusal semantics; control mismatch remains a gap; script/network breach remains a gap. Use a realistic social fixture for any headed browser proof. The current P5 domain test already covers generic breach/control behavior, but contains no t752 disclosure integration assertion observed in this review.

## Commands

Only Get-Content/rg source and owning-test inspection, plus writing this report. No validation commands were executed. Additional narrow reads outside the brief's five named files were limited to their actual dynamic-content/result builder, t752 press/refusal/list-reader seams, and P5's owning host/spec used to substantiate isolation.

## Integration correction implemented (2026-10-21)

Supervisor lifted the freeze for the bounded correction after merging current dev into the task downstream. `dynamic-content.ts` now receives normalized changed/control actions from the reevaluator. A failed extract_list with OUTPUT_NOT_OBSERVED whose actual starts `incomplete_text:` is an explicit dynamic_content gap when that action's disclosure is automatic (omitted or true). This checks both the changed command and the reproducing control. Explicit false remains a deliberate failure; complete captured text and unrelated ordinary failure keep existing behavior. No live fallback or capture-content synthesis is added.

Focused domain command, cwd downstream/domain: `$env:DOMAIN_TEST_BUILD_LABEL='t752offline'; node scripts/test-domain.mjs src/runtime/offline-reads` (external TEMP/t752-offline-disclosure-tests.log), exit 0, 22 tests passed / 0 failed. New cases cover default and explicit auto, reproducing unsupported control, opt-out and complete text; existing ordinary-failure cases pass. `git diff --check` exit 0.

Updated the authored offline-read paragraph in extension-client.md. Added one owning realistic social-network-feed browser regression in offline-reads.spec.ts. It records A reading position only, captures the still-collapsed post, proves live B can expand/read it, closes the live harness, and asks the real offline content path for B. It requires a successful reproducing control, actual incomplete_text from the changed inert read, zero script/network leaks and explicit dynamic_content gap. This new browser regression has NOT run yet: final build/browser gates still await supervisor signal. Prior read-only findings above describe the pre-correction behavior; the explicit-gap hole they identify is now fixed in source and covered provider-free at the domain seam.

Remaining limitation: the guard recognizes the measured standard incomplete_text refusal; it does not add a generic offline click-attempt counter. Native controls that genuinely reveal already-captured text can still answer if differential checks pass. This preserves captured evidence semantics without assuming that every local press means unsupported content. Actual browser integration must validate the new real path before acceptance.
