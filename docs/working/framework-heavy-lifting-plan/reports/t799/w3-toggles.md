# t799 / w3-toggles: report

## Outcome

Done in my owned files. One test file I do not own,
`RT/flow-bootstrap/candidate/tests/toggles/tests/submission-toggles.test.ts`, still pins the old
refusal that (b) removes. It fails 1 test, and the diff that fixes it is below.

## What changed and why

RT = `packages/fluxiq/src/programs/automation-studio/runtime` in the Core tree `fxwork/t799/!FluxIQ`.

- `RT/llm/harness-options/plan-parameter-resolution.ts` (item 1). Before this change, a view
  that carried `control` was refused, because `isHandleViews` required exactly three keys. The
  check now allows an optional `control`, which `controlOf` bounds as I5 sets out:
  - `stateful` must be exactly `true`.
  - `state` must be non-empty, 40 characters or fewer, and contain no control characters.
  - `ensures` must be a non-empty plain JSON object of 4,096 characters or fewer, the same limit
    `explored-toggles.ts` sets for signatures.
  - `idempotentWith` must match the node-id pattern.

  A field outside its bound is dropped and the rest are kept. The whole `control` is dropped when
  it is not stateful, is not an object, or has any other key. None of this ever refuses the node.
  `control` is kept only on a step's own views. A page fact's view (a step's `done when`, a
  handler's `when`) shares the step's ref, but a fact reads an element and presses nothing, so
  keeping it there could tie a press to a different control. With no `control`, the output is
  identical to before.
- `RT/flow-bootstrap/script-statements/toggle-idempotent.ts` (item 2). A tie now resolves in
  this order:
  1. A press tied as before (explored, then trial) decides first.
  2. Otherwise, a look-time tie applies: the step's own views carry `control.stateful` with
     `ensures`, and all of those views agree. Views that disagree tie nothing.
  3. If the step's node declares `ensureState`, it gets `ensureState := signature`. This now also
     covers a press that named `idempotentWith` (the (b) rewrite: the press node that takes the
     state is already the idempotent form).
  4. If the node cannot take `ensureState` and an explored or trial press named an
     `idempotentWith` other than the node itself, today's `candidate.toggle_not_idempotent`
     refusal stands, with its sentence unchanged.
  5. A look-time tie never refuses. A look is not evidence that the node flips the control, so a
     node that cannot take the state stays a plain press. This avoids a fail-closed gate.
- **Why Core does not rewrite the node's definition to `idempotentWith`:** it would not be
  mechanically sound. Downstream, `idempotentWith` is always `web.output.dom-check`, which takes
  `checked: boolean` rather than `ensureState`. Rewriting would mean reading `to` inside the
  signature and naming the domain's `checked` parameter, both of which Core must not do. In the
  web domain the rewrite never needs a definition change anyway, because `web.dom.click` declares
  `ensureState` (`domain/src/actions/schemas.ts:255-270`).
- `binding.ts`: no change was needed. The I5 doc comment already says what the code now does.
  `explored-toggles.ts` and `toggle-tie.ts` are also unchanged.
- **Item (c), the loop case:** this already worked after t787. Each pass of a loop body has the
  same graph `nodeId`, and `trial()` records the first pass's signature once. A reversed pass
  becomes a later record, and the earliest decides. Skipped passes record nothing. The next
  revision's looped step, tied by identity even after its key moved, carries `ensureState` on its
  node, so every pass is held to it. The new test proves this through a real
  `AutomationStudioExploredToggles.trial()` record and `automationStudioFlowPlanLoopBody`. No
  fix was needed.
- **Downstream check (read only):** an attribute-kind `ensureState` really presses only when the
  control is not already in that state.
  - `click.ts:254` skips when `webToggleSignatureShown` holds.
  - `toggle-signature/shown.ts:9` compares `reading.states[attribute] === to`.
  - `toggle-reading.ts:13-19` reads `"true"` or `"false"`, or the native `checked`. An absent or
    opposite attribute means the control is pressed.
  - `ensure-state.test.ts:23` covers the skip. I found no existing test for "attribute false ->
    pressed"; it is verified by reading the code only.
  - `gateway-action-parameters.ts:86` carries `ensureState` to the command.
- Tests:
  - New: `RT/flow-bootstrap/script-statements/tests/toggle-idempotent-trial-pass.test.ts`, 9
    tests using a reading list's "mark as read".
  - New: `RT/llm/harness-options/tests/plan-parameter-resolution-control.test.ts`, 4 tests.
  - `tests/toggle-idempotent.test.ts`: the two refusal cases now pass `takesEnsureState: () =>
    false`. Before, an absent `takesEnsureState` meant "takes", and those cases are now rewritten
    rather than refused.

## Diff needed in a file I do not own (candidate/**)

`RT/flow-bootstrap/candidate/tests/toggles/tests/submission-toggles.test.ts`: its node declares
`ensureState`, so (b) now gives the step `ensureState` instead of refusing it. The refusal path
is covered in `toggle-idempotent.test.ts` with `takesEnsureState: () => false`.

```diff
-// press of it is given Core's `ensureState`; where the domain named a node that
-// sets the state, the step is refused `candidate.toggle_not_idempotent` naming it.
+// press of it is given Core's `ensureState`, also where the domain named a node that
+// sets the state, since a press node that takes the state is its idempotent form (t799).
@@
-  it("is refused candidate.toggle_not_idempotent naming the node that sets the state, when the domain named one", async () => {
+  it("is given ensureState in place of a refusal when the domain named a node that sets the state and the press takes the state (t799)", async () => {
     const submitted = await controller(explored("t1", { signature: SIGNATURE, idempotentWith: "domain.demo.set_state" })).submit(candidate([{ handle: "t1", consequences: ["modify_existing"] }]));
-    expect(submitted.ok).toBe(false);
-    if (submitted.ok) return;
-    expect(submitted.check.issueCodes).toEqual(["candidate.toggle_not_idempotent"]);
-    const feedback = submitted.check.feedback as JsonObject;
-    expect(feedback.code).toBe("candidate.toggle_not_idempotent");
-    const issue = (feedback.issues as JsonObject[])[0]!;
-    expect(issue).toMatchObject({ code: "candidate.toggle_not_idempotent", path: "plan.subflows.0.nodes.0" });
-    expect(String(issue.message)).toContain("domain.demo.set_state");
-    expect(String(issue.message)).toMatch(/already in the state the step asks for would press it and flip it back/u);
+    expect(submitted.ok, JSON.stringify(submitted)).toBe(true);
+    expect(submitted.ok && submitted.candidate.buildPlan.plan.subflows[0]!.nodes[0]!.parameters).toEqual({ target: { selector: "#setting" }, ensureState: SIGNATURE });
   });
```

`submission.ts` needs no change. It already passes `verdict.handleViews`, which arrives unmapped
from the resolution through `bootstrap-completion.ts:447` and so now carries `control`. It also
already passes `takesEnsureState` from the registry.

## Commands run and observed results

Every run below was wrapped in the heavy-check lock.

- `cd packages/fluxiq && node --max-old-space-size=4096 node_modules/typescript/bin/tsc --noEmit
  -p .`: no output, exit 0. No errors in anyone's files.
- `pnpm test -- src/programs/automation-studio/runtime/flow-bootstrap/script-statements
  src/programs/automation-studio/runtime/llm/harness-options
  src/programs/automation-studio/runtime/flow-bootstrap/candidate`:
  - Result: "Test Files 1 failed | 76 passed (77)", "Tests 1 failed | 635 passed (636)".
  - The one failure is `candidate/tests/toggles/tests/submission-toggles.test.ts` > "is refused
    candidate.toggle_not_idempotent naming the node that sets the state, when the domain named
    one". This is the expected, intended change; the diff is above.
  - The real-sql group had no files.
- Fail-first: I put the HEAD versions of `toggle-idempotent.ts` and
  `plan-parameter-resolution.ts` in place temporarily, then restored mine and confirmed the
  diffstat was unchanged. The new tests then gave "Tests 7 failed | 6 passed (13)":
  - All 4 control-bound tests failed, because a view with `control` was refused.
  - 2 look-time tie tests failed.
  - The `idempotentWith` rewrite test failed.
  - The 2 loop tests passed on HEAD, which confirms that t787 already covered (c).
- On my code, the new and updated files gave "Tests 19 passed (19)".

## Not verified

- No live or browser run.
- The downstream domain does not send `control` yet (that is W6), so the look-time tie has only
  been exercised with Core stand-ins.
- No downstream test exists for "attribute false -> pressed"; that path was checked by reading
  the code only.
- The structure audit was not run.

## Open questions or contradictions found

- The brief says "no handle view `control` => byte-identical", but (b) changes behaviour with or
  without `control`: an explored or trial press that named `idempotentWith` on a node that takes
  `ensureState` is no longer refused. I read the byte-identical rule as applying to the look-time
  part (item a). The output without `control` is unchanged in every other respect.
- Direction in loops: the first pass decides the signature. If the first row a trial passes over
  was already in the asked state, its press flipped that row backwards and the step learns the
  reversed signature. This is the same limit t792 documents for explored presses. CC9's `state`
  on the view could settle it, but Core does not read that field. Not fixed, because it is out of
  this brief's scope.
