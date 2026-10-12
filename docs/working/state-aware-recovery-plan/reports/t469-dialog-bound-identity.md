# t469: a saved control is never accepted on a look-alike in another dialog

## Outcome

Done. The work came in two rounds.

**Round 1, the extension half:**

- A control's descriptor now carries the name of the dialog it sits in.
- Both acting paths refuse a candidate in a dialog of another name, or in no dialog.

**Round 2, the domain half** (added by the supervisor's follow-up). The domain now keeps the dialog on every path:

- when a model builds a step from a handle;
- on dispatch, recordings included;
- past a repair, carried as the record is.

The `other-dialog` stable-name retry is skipped in `resolve-target.ts`.

**End-to-end proof.** A model-built step on "Close chat" carries `context.dialog` in both places:

- in its saved parameters, built from the content script's own snapshot, through the domain runtime, by handle;
- in the command the page receives, after Core's normalizer and the gateway mapping.

In a headed browser, once the chat is gone that step is refused on the prompt's "Close". It closes the chat when the chat is drawn again.

Older fingerprints, saved without a dialog, behave as before.

## What the saved fingerprint carried, and why the scorer accepted

- **It carried nothing about its container.**
  - Step 0062's `parameters.element` (`steps/0062-run-web.dom.click/call.json`) has no `context` key at all.
  - The Flow snapshot (`snapshots/flow-lane.json`, `authoredNodes[1]` and `[5]`) has none either.
  - The live fingerprint was: accessibleName "Close chat", visibleText "✕", tag div, role button, 4 classes, `aria-label`, and a positional selector.
- **Why `context` was empty.**
  - The chat panel is `role="dialog" aria-label="Chat with Elena Sokolova"`. A dialog is not a landmark (`context.ts` `LANDMARK_ROLES`).
  - The panel is not a form, list, table or record either. So `elementContext` had nothing to report.
  - Even a non-empty context is cut down to `formId/landmark/list/table/shadowHosts/record` on the build path (`domain/.../packet-fingerprint/from-packet.ts` `contextOf`).
- **Why the scorer accepted.**
  - With the chat gone, the selector missed. Level 2 scored the 36 same-family controls.
  - The prompt's ✕ (name "Close") agrees on tag, role, classes and the exact text "✕", so it scored 0.729 against 0.113.
  - It cleared the floor (0.35) and the margin (0.2). It passed corroboration because the visible text agreed exactly.
  - No gate looked at where the control was, except `context.record`, which was absent.

## What changed and why

- **`apps/extension/src/content/identity/dialog.ts` (new).**
  - `dialogName(element)` finds the nearest dialog at or above the element, across open shadow roots and within 40 levels. A dialog is a `<dialog>`, `role=dialog`/`alertdialog`, or `aria-modal="true"`, read by tag and attribute.
  - The dialog's name is its accessible name. If it has none, the first heading inside it is used, within 200 nodes.
  - A dialog with no name and no heading records nothing, so nothing is invented.
  - `agreesWithRecordedDialog(recorded, element)` is a gate, not a weight:
    - If no dialog was recorded, it answers true.
    - Otherwise the candidate's dialog name must equal the recorded one. A candidate in another dialog or in none fails closed.
  - A re-rendered dialog keeps its name, so it still resolves.
- **`identity/context.ts`.** `elementContext` writes `dialog: dialogName(element)`. This is the capture at save, for recordings, extracts and snapshot elements.
- **`shared/dom-element.ts`.** Added `DomElementContext.dialog?: string`.
- **`identity/score.ts`.**
  - `RecordedIdentity.context` gains `dialog`.
  - The record filter before ranking is now `inRecordedPlace`, which checks the record and the dialog. A candidate in another dialog is never ranked.
- **`identity/veto.ts`.**
  - Rule 0 gains `other-dialog`, an unweighed refusal. It is a separate union member, so the "refused unweighed" shape has no number.
  - It is checked in `vetoCandidate` and in `vetoExactMatch`, after the record rule. Its summary reads "refused <label> in another dialog".
  - The header documents the rule.
- **`identity/index.ts`.** Exports and header line.
- **What did not move.**
  - The t436 rules, t442's identity at the act, the t463 record and row gate, the F5 floor (0.35), the margin and corroboration are unchanged.
  - The new gate runs after the record gate and costs nothing when no dialog was recorded.
- **Tests.**
  - `identity/tests/dialog.test.ts` (new, 15 rows):
    - naming by aria-label, by heading, and by each dialog kind; no dialog; an unnamed dialog; the dialog element itself;
    - A "Close" is refused in dialog B, accepted in a re-rendered dialog A, and refused outside any dialog. An unrecorded dialog gates nothing.
    - Veto and ranking on 0062's pair, each with a no-dialog control row that shows the old acceptance. A control saved in no dialog is weighed as before.
  - `identity/tests/context.test.ts`: one row for `context.dialog`.
  - `shared/tests/present.test.ts`: `dialog: undefined` added to the four exhaustive `present<DomElementContext>` literals.
  - `e2e/content/tests/dialog-identity/tests/dialog-bound-identity.spec.ts` (new, social-network-feed only, 5 headed rows):
    1. With the chat panel and the notifications prompt both up, each close button's extract and snapshot descriptor names its own dialog.
    2. After a reload redraws both, the saved Close chat resolves to the chat's close button, and nothing in the prompt is pressed.
    3. The chat panel is redrawn alone and the saved step closes it. The server's chat is "closed".
    4. Chat gone, prompt up, recorded selector: refused with `web.target.not_found`. The prompt stays visible and the server's `notificationsPrompt` is "pending".
    5. Same, by step 0062's literal selector, then a control: the same replay without `context.dialog` presses the prompt's "Close". The server goes to "dismissed", which is the run's behaviour, so the dialog gate is what refused.
  - The site never shows both dialogs at once. Rows 1 and 2 therefore mount the prompt from its own markup, read off the page, over the site's wired chat. Rows that press anything press the site's own wired dialogs.

### Round 2: the domain carry (supervisor follow-up)

- **`domain/src/actions/types.ts`.** `WebAutomationElementContext.dialog?: string`, documented as a gate the page applies.
- **`domain/src/output-nodes/targets/targets.ts`.**
  - `elementContext()` keeps `dialog`. This is dispatch, and recordings go through `element-fingerprint/from-descriptor.ts` → `elementFingerprint`.
  - `withRecordedRecord` is wrapped by `withRecordedPlace` = record then `withRecordedDialog`.
  - The recorded `context.dialog` is carried onto an adapted or repaired element that names none, because Core's normalizer strips a repair's `context`. An adapted source that names its own dialog keeps it.
- **Build-save chain under `domain/src/runtime/llm-evidence/`:**
  - `elements.ts`: `DescribedEvidenceElement.dialog`, set from `raw.context.dialog`. It is screened, and dropped when the screen withheld any of it, so a withheld name cannot refuse every replay. It is not published in the packet.
  - `sanitize.ts`: `WebLlmSnapshotBinding.dialogNames?: Map<handle, name>`, filled beside `shadowHosts`.
  - The same map is carried by `stable-handles.ts` (renumbering), `capture.ts` and `structure/detect.ts`, which are the other binding constructors.
  - `plan-resolution/target-packets.ts`: `targetsOf` passes `binding.dialogNames.get(handle)` to `webPlanElementIdentity`.
  - `plan-resolution/element-identity.ts`: `WebPlanElementContext` gains `dialog`. `webPlanElementIdentity` takes it. `webPlanElementIdentityAcrossViews` keeps it only where both views `agreed`, like the record.
  - `packet-fingerprint/from-packet.ts`: `PacketContext` gains `dialog`. `webPacketElementFingerprint` takes `input.dialog`, and `contextOf` writes it.
  - `target/override.ts` is unchanged. A repair's own target loses `context` in Core, so the carry is the `targets.ts` one above.
- **`apps/extension/src/content/action-runtime/resolve-target.ts`.**
  - The exact-strategy refusal now skips `stableNameMatch` for `other-dialog` as it does for `other-record`.
  - The edit is written to stay within the file's 800-line limit. An earlier, longer version put the file at 801, the audit failed, and it was compacted.
- **Tests:**
  - `domain/src/output-nodes/targets/tests/targets.test.ts` (+3 rows):
    - the dialog survives the fingerprint and the dispatched target, and a non-text dialog is dropped;
    - an applied repair after Core's rewrite carries the recording's dialog while naming the repaired control;
    - a recording without a dialog adds none.
  - `domain/src/runtime/llm-evidence/plan-resolution/tests/dialog-identity.test.ts` (new, 4 rows), end to end through the real evidence runtime:
    - a click node resolved from the handle of "Close chat" saves `context: { dialog: "Chat with Elena Sokolova" }`, and that context survives `normalizeAutomationStudioElementTarget` plus `webAutomationActionFromGatewayCommand` to the command element;
    - the look-alike saves its own dialog;
    - a control in no dialog saves none;
    - the packet the model reads does not contain the dialog name, while the binding holds it;
    - a dialog name holding a card number is not saved.
  - Headed spec, new row 6, "a model-built step on Close chat ...":
    - With both dialogs up, the content script's own snapshot is read through `createWebAutomationLlmEvidenceRuntime`, as t463's row-bound spec does.
    - The "Close chat" handle is taken from the page view the model is shown and resolved with `resolvePlanNodeParameters`. The saved element has `context.dialog`.
    - The step is dispatched through Core's normalizer and the gateway mapping. The command element carries the dialog.
    - With the chat gone and the site's own prompt up: `failed` / `web.target.not_found`, the prompt still visible, and the server's `notificationsPrompt` "pending".
    - With the chat drawn again, the same saved step `succeeded`, and the server's chat is "closed".

## Commands run and observed results

### Round 2

- Domain:
  - `npx tsc -p tsconfig.json --noEmit` -> `tsc-exit=0`.
  - `npx tsc -p tsconfig.test.json --noEmit` -> `tsc-test-exit=0`.
- `DOMAIN_TEST_BUILD_LABEL=t469 node scripts/test-domain.mjs output-nodes/targets/tests runtime/llm-evidence/plan-resolution/tests runtime/llm-evidence/packet-fingerprint runtime/llm-evidence/tests/stable-handles runtime/llm-evidence/tests/sanitize runtime/llm-evidence/tests/elements client/tests/gateway-mapping` -> `# tests 258 # pass 258 # fail 0`.
- `DOMAIN_TEST_BUILD_LABEL=t469 node scripts/test-domain.mjs plan-resolution/tests/dialog-identity output-nodes/targets/tests/targets` -> `# tests 48 # pass 48 # fail 0`. The seven t469 rows are listed `ok 42`–`ok 48`.
- `DOMAIN_TEST_BUILD_LABEL=t469 node scripts/test-domain.mjs llm-evidence/tests/capture-after-action llm-evidence/structure/tests llm-evidence/tests/sanitize llm-evidence/tests/elements llm-evidence/tests/stable-handles element-fingerprint/tests llm-evidence/target/tests` -> `# tests 152 # pass 152 # fail 0`.
- Extension:
  - `npx tsc -p tsconfig.json --noEmit` -> `ext-tsc=0`.
  - `npx tsc -p tsconfig.test.json --noEmit` -> `tsc-test-exit=0`.
- `EXTENSION_TEST_BUILD_LABEL=t469 node scripts/test-extension.mjs content/identity/tests shared/tests background/connection/tests/gateway-payloads content/action-runtime/tests/wrong-row content/action-runtime/tests/resolve-target` -> `# tests 205 # pass 205 # fail 0`.
  - After the final resolve-target edit, `... content/action-runtime/tests/resolve-target content/action-runtime/tests/wrong-row` -> `# tests 15 # pass 15 # fail 0`.
- `pnpm test:content -- dialog-identity/tests/dialog-bound-identity.spec.ts --headed --workers=1` -> `6 passed (1.2m)`, row 6 included.
- `pnpm test:content -- identity-veto.spec.ts identity-resolution.spec.ts created-identity/ check-chosen-option/ selectors/tests/volatile-selector-replay.spec.ts dialog-identity/ --headed --workers=2` -> `45 passed (2.2m)`.
- After the final resolve-target edit: `pnpm test:content -- dialog-identity/ identity-veto.spec.ts --headed --workers=2` -> `10 passed (45.7s)`.
- `node scripts/structure-audit.mjs`:
  - First run: `structure-audit: 1 violation(s) across 1 rule(s)`, with `FAIL [file-lines] apps/extension/src/content/action-runtime/resolve-target.ts: 801 lines exceeds the 800-line limit`.
  - Compacted the edit to 799 lines, then rerun -> `structure-audit: passed (186 warning(s), 646 baselined).`
  - The advisory warnings on files I touched are all pre-existing sizes: `targets.ts` 484, `elements.ts` 512, `target-packets.ts` 590, `stable-handles.ts` 467.

### Round 1

- `npx tsc -p tsconfig.json --noEmit` (apps/extension) -> no output, `tsc-exit=0`.
- `npx tsc -p tsconfig.test.json --noEmit` (this includes e2e):
  - First run: two errors in `src/shared/tests/present.test.ts`, "Property 'dialog' is missing".
  - Fixed, then rerun -> `tsc-test-exit=0`.
- `EXTENSION_TEST_BUILD_LABEL=t469 node scripts/test-extension.mjs content/identity/tests`:
  - First run -> 5 failures. My stub had no `querySelectorAll`.
  - Fixed, then rerun -> `# tests 139 # pass 139 # fail 0`.
- `EXTENSION_TEST_BUILD_LABEL=t469 node scripts/test-extension.mjs content/identity/tests shared/tests background/connection/tests/gateway-payloads content/action-runtime/tests/wrong-row content/action-runtime/tests/resolve-target` -> `# tests 205 # pass 205 # fail 0`.
- `pnpm test:content -- dialog-identity/tests/dialog-bound-identity.spec.ts --headed --workers=1`:
  - The first runs failed while I was building the fixture:
    - `window.showPrompt` is not global, because the page script is a module.
    - The modal prompt's scrim covers the chat, so a press on the chat was "covered".
  - Final run -> `5 passed (57.1s)`.
  - Observed before the console logging was removed: a refused row's failure was "nothing matched; 36 control(s) of the same family are on the page", with resolution `{"strategy":"fingerprint","candidateCount":36}`. The both-up resolution was `{"strategy":"fingerprint","candidateCount":1,"bestScore":0.801}`.
- `pnpm test:content -- identity-veto.spec.ts identity-resolution.spec.ts created-identity/ check-chosen-option/ selectors/tests/volatile-selector-replay.spec.ts dialog-identity/ --headed --workers=2` -> `44 passed (2.6m)`. This includes t463's `row-bound-control.spec.ts` and t442's `fingerprint-after-change.spec.ts`.
- `node scripts/structure-audit.mjs` -> `structure-audit: passed (186 warning(s), 646 baselined).` The warnings on my area are advisory:
  - `content/identity/` has 17 source files against a threshold of 15. It was 16 before `dialog.ts`.
  - `record.ts` is 592 lines. It was already over the threshold.

## Not verified

- No Lab run, Firefox or real extension load.
  - The T2 harness injects the content bundle.
  - Row 6 runs the domain runtime, Core's normalizer and the gateway mapping in the test process. It does not use the background worker or a live Core over WebSocket.
- Flows saved before this change keep no dialog, so they behave as before, and step 0062's Flow as already saved would still press the ✕. That is as the supervisor asked: older fingerprints are unchanged.
- Dialog names that change between capture and replay, for example a title with a count, are now refused. That includes a repair, which carries the recorded dialog. I did not measure how often the ten scenarios do this.
- A full domain `pnpm check` and full suites were not run. Only the narrow checks above, per the twice-a-day rule.

## Open questions or contradictions found

1. **The round-1 ownership gap is closed.** The domain carry that round 1 listed was done in round 2, as above.
2. **Repair cost: a renamed dialog cannot be repaired past the gate.** A repair carries the recording's dialog, as the record carry does. If a dialog was renamed, its control fails, and a repair naming the control in the renamed dialog is still refused, because Core strips the repair's own context. This is the same trade-off the record carry made. Lifting it would need Core to keep `context` on a repaired target.
3. **Look-alike cues.** The packet's look-alike `dialog` cue still comes from dialog geometry (`front-layer.ts` `openDialogNameOf`), not from the extension's `context.dialog`. Unifying the two would be a separate change.
4. **Still a follow-up: legacy fingerprints.**
   - A fingerprint saved before this change (no dialog) still accepts "Close" for "Close chat". Corroboration passes on the exact "✕" while the accessible names differ.
   - Whether a differing accessible name should refuse when the text is a lone glyph is a separate corroboration question.
