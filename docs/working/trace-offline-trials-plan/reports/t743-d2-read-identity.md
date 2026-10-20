# t743-d2-read-identity: worker report

## Outcome

Done. A step that reads an element's text now saves that element's identity without the words it reads. The trace of the resubmitted handle found the cause in Core, which I did not edit. The extension's veto needed no change, and a test now pins that.

## What changed and why

1. **A read's target is saved without the words it reads.** New file `domain/src/runtime/llm-evidence/plan-resolution/read-identity.ts` exports one function, `webPlanReadIdentity(nodeDefinitionId, parameters, identity)`.
   - **Which nodes count as reads:** `web.dom.extract` in text, value or html mode. The mode comes from the structured `extract`, or else from the legacy `options.mode`. `web.dom.assert` with `assert.kind === "text"` also counts.
   - **What is removed:** `visibleText`. `accessibleName` is removed too, unless it sits beside different visible words (an `aria-label` or a title). The packet drops an element's text when it equals the element's name (`elements.ts` line 259), so a name that arrives alone may be the read's words themselves.
   - **What is kept:** tag, role, selector, label, id, classes, test id, `name`, attributes, drawing and the whole `context` (record, landmark, form, list and table position, dialog, shadow hosts).
   - **What does not change:** a press, an attribute read and an `exists` assertion keep the words.
   - **Where it is applied:** the capture-time builder (`webPlanElementIdentity` in `target-packets.ts` `targetsOf`) does not know the node kind. `resolveNode` in `resolve-plan-node.ts` does, so I applied the function there. The result feeds three things: `resolved.element`, the `$state` fallback's `element`, and the save-time guard (`webPlanStepFoundByTooLittle`).
   - **The guard judges the identity as saved.** A read target that has nothing but its words is now refused `web.handle.unidentifiable`, and a test pins that. See open question 1.
   - `element-identity.ts`: one header line pointing to `read-identity.ts`. No code change.
2. **Why a resubmitted handle kept its older identity: the cause is in Core.** In `packages/fluxiq/src/programs/automation-studio/runtime/flow-bootstrap/candidate/submission.ts` line 162:
   `if (last && text !== undefined && text === this.currentText) return this.sameAsLast(...)`
   - This check runs **before** `check()`, the domain's resolution. A script whose text is word-for-word the same as the standing revision's is refused `candidate.unchanged_submission` without its handles ever being resolved again. Office 0058/0062-0070 resubmitted "the same script with t961", so the domain never saw the newer view.
   - `automationStudioCandidateSameBehaviour` (line 197) only runs after resolution, so it was not the cause on that path.
   - **The domain side is correct.** A handle resubmitted after a newer capture resolves from the newer view (`handleViews` view 2). The test pins this.
   - With fix 1, a read's saved identity no longer depends on which view it came from. So identical text now really does mean identical behaviour for a read, and the Core short-circuit is harmless for this case. For a press, a newer view can still change the identity (the views' agreement plus words lent from the newest view, t596) while the text stays identical. Core's text check would hide that change. I did not edit Core (open question 2).
3. **The extension veto needed no change.** `veto.ts` `recordedDistinguisher` returns false for an identity with no text, name, label, id or test id, so `vetoExactMatch` returns `{}`. `resolve-target.ts` then acts on the selector's lone match. New test: `apps/extension/src/content/identity/tests/veto-read-target.test.ts`.
   - The old identity, carrying the paragraph's former words, is refused.
   - The saved read identity is accepted.
   - A kept `aria-label` still has to agree.

Tests added: `domain/src/runtime/llm-evidence/plan-resolution/tests/read-identity.test.ts`, 6 tests on a generic invoice page.
- Extract in text, value, html and legacy mode, and a text assert, resolve with no words.
- An attribute read, an `exists` assert and a press keep their words.
- An `aria-label` shown beside different words is kept; a name that arrives alone is dropped.
- A handle resubmitted after a newer capture resolves from view 2, and the read's identity is the same as before.
- A read target with only its words is refused at save.

## Commands run and observed results

- `cd domain && DOMAIN_TEST_BUILD_LABEL=t743-d2 node scripts/test-domain.mjs plan-resolution/tests/read-identity`
  - First run: 4 pass, 1 fail. The press assertion expected `visibleText`, but the packet keeps a button's words only as `accessibleName`. I fixed the assertion and tightened the name rule.
  - Final run: `# pass 6  # fail 0`.
- `... test-domain.mjs plan-resolution/tests` -> `# tests 176  # pass 176  # fail 0`.
- `... test-domain.mjs node-run/tests/press-raw-read node-run/tests/replay node-run/retries/tests/lasting-act node-run/retries/tests/uncertain-outcome llm-evidence/tests/repairable-parameters runtime/tests/adapter-read-value` -> `# tests 116  # pass 116  # fail 0`. These are a regression check on extract callers; I edited nothing there.
- `cd apps/extension && EXTENSION_TEST_BUILD_LABEL=t743-d2 node scripts/test-extension.mjs content/identity/tests` -> `# tests 181  # pass 181  # fail 0`.

## Not verified

- No typecheck, structure audit, build or full suite (barred by the brief). The new files each export one thing and are not added to the barrel, like `identity-guard.ts`.
- No live or browser run. The fix to the office read is unproven live.
- I did not run the extension's whole resolve path (`action-runtime/resolve-target.ts`) for a read target. That test directory is outside my Owns list, so the veto was tested directly.
- Fact targets (`fluxiq.fact.target`) are unchanged: a fact's words are evidence of a state.

## Open questions or contradictions found

1. **Bare text elements.** Because the guard judges the saved identity, a read of a bare `<p>` or `<span>` that has no class, id, label or aria-label is now refused `web.handle.unidentifiable` at submission. Before, it saved and worked as long as its text did not change. This follows the every-element-fingerprint rule, but the model is not told what to do instead, and some single-value reads may regress. The alternative is to judge the guard on the identity as shown and save the stripped one. That would break the rule. Supervisor's call.
2. **Core `submission.ts` line 162.** The identical-text check runs before resolution, so a resubmission can never pick up a newer view's identity. If that matters for presses, the check would have to compare resolved plans (the digest) rather than text. That is a Core edit, and I did not make it.
3. A read identity left with only kind and classes gets no veto protection ("a recording that names nothing", the limit the `veto.ts` header already describes). The record and dialog gates still apply.
