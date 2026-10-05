# B6 repeated target causality

Status: Complete read-only evidence; supervisor review pending. No reproduced target-resolution execution defect or selector fix.
Owner: resume-ab
Run: run-mutcbgbx-812e88c5; frozen downstream2ef458a1/Coree8c89bbd.
Owned output: this report and correction of the already-owned B6 full debug. No source/tests/build/runtime/provider/state/key/shared-doc/git mutations or paid retry.

## Current State

The three failures are target ambiguity under the current source's dispatch logic, rather than three proven missing controls on wrong pages. This is a source-derived classification, not a directly retained raw browser failure record. Both full tests dispatch byte-identical normalized parameters and recorded from values for each candidate, and fail identically. The current checked candidate at global15 retains a runnable declaration; accepted PRESENT metadata was exercised, without proving task completion.

No resolver execution bug is reproduced. Strict rejection of ambiguous controls is correct. The concrete diagnostic gap is that TARGET_AMBIGUOUS is folded into target_not_found with resultReason:null, and the paid run bundle does not preserve the lower closed failure code or resolution measurement for these tests. That prevents direct artifact verification and obscures the next correction. A bounded typed diagnostic projection regression is justified; identity relaxation is not.

## Exact artifact reconciliation

| Displayed / global draft | Original/current provenance | Both full-test artifacts | Recorded location versus failed page | Current identity / supported cause |
| --- | --- | --- | --- | --- |
| 3 / 4 | Original successful 0008/c1; retained input and handle unchanged | 0102 / 0122 | Exact same location, scenario home | Sign-up overlay dismissal; div with visibleText and positional selector, no recorded context. Navigation reset preserves the answered overlay. Other similarly named controls can make resolution ambiguous; actual candidate DOM/counts are not retained. |
| 11 / 15 | Original successful 0055/opennap2; amended handle differs; 0065/rerun.15 is PRESENT/performed:false with priorExecution.configuration original separate | 0110 / 0130 | Exact same location, search | Current a/accessibleName with context.listPosition index1/total3 and positional selector. Candidate was checked on search, not executed anew. The later full-test ambiguity does not mean its normalized runnable declaration was lost. |
| 13 / 23 | Retained input/handle matches successful 0071/opennap250 and repeated 0079/opennap250b | 0112 / 0132 | Recorded from is search; failed page is the previously reached napkin product | Current a/accessibleName with positional selector and no recorded context. Earlier preparatory steps already reach that product; this retained product-link click is authored from another page. Reaching-chain mismatch exists, but the exact lower browser refusal is source-derived ambiguity, not directly captured target absence. |

For all three pairs, exact full input, parameters, from and failed result location match across tests. Selector equals fingerprint.selector in every call. All recorded labels appear verbatim in the failure's rendered page. That is textual evidence only: it does not prove a unique actionable DOM element, the recorded element remains, or the correct product is selected.

Reset0099 and0119 use exactly the initial navigation URL from0002; both succeed and do not clear site state. Reset divergence is not demonstrated. No global URL scan or browser state reset is justified.

Private screenshot0008 shows the successful overlay dismissal;0055 and0071 show the napkin product reached after actual links. The explored variant/fulfillment differs from the public pickup request, already documented in the full debug. Raw labels, URLs, selectors, identities and screenshots remain private. The private native14 failure pair does not contain a complete exact cart-line oracle.

## Source-derived failure taxonomy

1. Extension content/action-runtime/resolve-target.ts constructs distinct closed TARGET_NOT_FOUND and TARGET_AMBIGUOUS failures. It preserves identity vetoes, record gates and candidate ambiguity rather than choosing a convenient twin.
2. Domain action-failure/refusal.ts intentionally maps BOTH codes to target_not_found. Neither receives a BY_FAILURE_REASON entry, so resultReason remains absent/null. This is confirmed source behavior, not inferred from English failure text.
3. Domain node-run/replay.ts explicitly checks the raw gateway result.failure.code. Raw TARGET_NOT_FOUND calls webNodeReplayMissingTarget; other failures call failedOnPage.
4. node-run/missing-target.ts returns remembered for a raw missing target on the recorded page and unreproducible on another/missing page. node-run/replay-answer.ts confirms those are distinct core.replay.remembered and core.replay.unreproducible constants, not aliases of core.replay.failed.
5. All six observed results are core.replay.failed with target_not_found in said. Given the only two failure-code mappings producing that word and the explicit missing-target branch, the current implementation's compatible lower classification is TARGET_AMBIGUOUS. A raw missing target would produce a different replay code, regardless of location.
6. Direct lower-code capture is NO EVIDENCE. Central call/result/meta, owning launch log, ignored core.log and scenario-lab.log do not retain the raw failure record or ambiguity measurement. Public projected metadata has resultReason:null. Do not present the inference as a captured browser result.

The acknowledged same-URL limitation of remembered/PRESENT remains independent: location is not DOM-state proof. These six failures do not exercise remembered/PRESENT classification, and no blanket same-location success is proposed.

## Original versus normalized metadata limits

Original model inputs reference opaque handles. The complete debug's observed draft also retains handle-form inputs; no final executable graph was accepted or publicly persisted. Public parent remains0nodes/0subflows/0graphs.

Current full-test inputs contain normalized selector/element metadata. Those are byte-identical across the two tests. Original successful browser dispatch's full normalized command/fingerprint is not separately retained in these central artifacts, so an exact original-versus-current normalized-selector equality claim is NO EVIDENCE. Comparisons above use the actual retained original input/handle, current resolved test parameters, checked candidate and priorExecution separation. Current global15 handle changed, with retained current ranWith exercised; no stale original performed proof or arbitrary action replacement is asserted.

Plan-resolution/resolve-plan-node.ts resolves handles to stored identity; literal normalized selectors stay unchanged. Replay invokes the normal gateway action with these resolved parameters. No current-action metadata-drop or replay-specific alternate selector rewriting has been demonstrated.

## Smallest meaningful next partition and regression

A separate written release can improve the diagnostic projection while preserving all execution and permission decisions. Proposed source owners are existing domain node-run/replay.ts and replay-answer.ts with their nearest node-run/tests/replay-ambiguous-target.test.ts. Confirm the exact typed capture/result boundary before implementing an additive field; this investigation did not read or authorize changing that boundary. If the existing reason union is chosen, release its actual owning enum/schema tests explicitly rather than inventing a free-form reason.

Fail-first fixture: actual replay wrapper receives a gateway TARGET_AMBIGUOUS result with safe closed resolution strategy/count measurement. Assert failed/ok:false, no remembered/PRESENT, no second action or reset, and the model-facing/test artifact exposes only the exact closed lower code and numeric/enum resolution evidence. Preserve missing-target fixtures: same-page raw TARGET_NOT_FOUND may remember; other-page missing is unreproducible; ambiguity must fail at either location. Add redaction assertion for raw candidate labels/expected/actual/private fields not escaping.

This verifies the proven information collapse, not a guessed selector repair. A browser identity fix needs a separately scoped captured/synthetic DOM regression showing the original scoped target and actual ambiguous alternatives; current artifacts cannot reconstruct that fixture authoritatively. Product-selection and redundant product-link dependency errors remain model-authored task failures requiring exact runtime oracles, not a gate bypass.

No source fix, full-test success, cart oracle or live retry is claimed.

## Read ledger and correction

Initial owners: domain/src/runtime/llm-evidence/node-run/replay.ts; missing-target.ts; Core packages/fluxiq/src/programs/automation-studio/runtime/llm/node-tools/replay-span.ts. Named dom-run.ts/plural targets directory do not exist. Approved replacements: domain/src/runtime/llm-evidence/plan-resolution/resolve-plan-node.ts and apps/extension/src/content/action-runtime/resolve-target.ts. Approved exact expansions: domain/src/runtime/llm-evidence/action-failure/refusal.ts; domain/src/client/gateway-mapping.ts; node-run/replay-answer.ts constants/answer projection. Eight source owners; no other source read.

Core replay-span confirms normal repeat planning/walking and strict outcome handling; no loop span is evidenced in these three calls. Gateway payload bridge deliberately carries safe closed resolution measurements while candidate prose stays on the failure record; no bridge execution defect is established here.

Corrected owned full debug Stage4/Causes to distinguish same recorded locations for3/11 from different location13. Added the source-derived ambiguity classification and its direct-artifact uncertainty. Source/report frozen for supervisor review. No tests were run for this read-only brief.
