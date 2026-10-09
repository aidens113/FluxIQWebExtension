# W6: domain handles (t378)

## Brief

### Brief: t378-w6-domain-handles (worker-high)
- Repository: downstream domain. Tree T = `C:/Users/osrs_/FluxStuff/fxwork/t378/!FluxIQWebExtension` (on `task/t378-candidate-feedback`). P = `T/domain/src/runtime/llm-evidence/plan-resolution`.
- Task:
  1. (lane B C4; reproduce first) A candidate step naming a handle that no evidence ever printed to the model is refused with a handle code Core already understands (`web.handle.unknown`, or a new `web.handle.<reason>` matching `^[a-z]+\.handle\.[a-z_]+`), never resolved silently. Live: t551, t560 and t570 in lane B's 0058 script appear in no page view, find result or tool result (only in the numbering gap after a printed t550), yet resolved through the view history (`handleReach: "view_history"`; `P/view-history.ts`, `P/target-packets.ts:186-200`, `P/resolve-plan-node.ts:80-90` and `:410-413`). Accept only handles some evidence printed: page views, page find, detect and describe results, a tool result that minted one. Write the failing test first from a view whose printed text omits a handle the store holds; then fix it in the owning module.
  2. (lane D) A press on a target with no control role is refused, saying why: lane D's "close the chat if it shows" step targeted `t860`, the plain text line "I can bring the gazebo if you need it" (the close button was `t857 button "Close chat"`), and both trials pressed the message. Fix at `P/resolve-plan-node.ts:689-700` `resolveTarget` for press nodes; keep presses on real controls, including the controls a page draws itself (swatch, chip) that `web.dom.check` handles. Fail-first test with a text-only handle.
  Core attaches the step's name and line to these refusals (another worker, now); return codes only.
- Evidence (read-only): `C:/Users/osrs_/FluxStuff/lab-runs/2026-10-08/run-mv0fu9pb-57454dc4/steps/` (grep `page.txt`, `request.txt`, `result.json` for t550-t570; 0058 `call.json` is the script); `C:/Users/osrs_/FluxStuff/lab-runs/2026-10-08/run-mv0fuual-f9e6f089/steps/0014-tool-core.run_node` and `0018-tool-core.run_node` (view 14 and the close press); lane D analysis Q3 `C:/Users/osrs_/FluxStuff/fxwork/t275/!FluxIQWebExtension/docs/working/mvp-final-month-plan/reports/lane-d-candidate-w2-authoring.md`; lane B debug C4 row `C:/Users/osrs_/FluxStuff/fxwork/t262/!FluxIQWebExtension/docs/working/language-driven-flow-loop-plan/debugs/run-mv0fu9pb-57454dc4.md`.
- Owns: `P/**`, `T/domain/src/runtime/llm-evidence/page-view/**`, `T/domain/src/runtime/llm-evidence/page-find/**`, `T/domain/src/runtime/llm-evidence/stable-handles.ts`, new files beside them, their barrels and `tests/`.
- Must not touch: Core, the extension, other domain files (another worker owns `domain/src/output-nodes/extract-list/catalog-text.ts` and `domain/src/runtime/llm-evidence/tools.ts`), any other tree, lab slots or processes.
- Concurrency: other workers edit other files in T now. An error only in a file you do not own is theirs: record it, do not fix it. Rules: one exported thing per file, a barrel per directory, tests in `tests/` beside the subject.
- Definition of done: fail-first then passing tests. Run only the tests beside your change: bundle those files as `domain/scripts/test-domain.mjs` does (esbuild, `fluxiq` external) into your own scratch directory and run them with node, or once `DOMAIN_TEST_BUILD_LABEL=t378-w6 node scripts/test-domain.mjs` from `domain/` (the package scripts refuse while Core's source is newer than its build; expected). `npx tsc -p tsconfig.json --noEmit` and `npx tsc -p tsconfig.test.json --noEmit` from `domain/` (if the test config emits, point it at your scratch directory). Never commit; no `pnpm build`; no Lab run or provider call.
- Report to: `T/docs/working/mvp-final-month-plan/reports/t378-candidate-feedback/w6-domain-handles.md` (paste this brief at its top; protocol report format; return at most 12 lines).

## Outcome

Done, with one required follow-up outside my files. Both defects reproduced in
fail-first tests (4 failing), and both are fixed (9 of 9 new tests pass). One
existing closure test, `domain/src/runtime/llm-evidence/tests/tool-rejection-detail.test.ts`
("every code the plan resolver can refuse with names a reason"), now fails
because the new code `web.handle.not_a_control` has no entry in
`tool-rejection.ts` `HANDLE_ISSUE_REASONS`. I don't own that file. The fix is one line:
`["web.handle.not_a_control", "handle_wrong_kind_of_control"],`.

## What changed and why

### Cause, lane B C4 (t551 / t560 / t570)

- The packet store (`P/target-packets.ts`) keeps every element of a capture.
  The page view prints only elements that have their own words or are controls
  (`page-view/line/choice.ts`). In 0018 the view printed `t550` and then `t555`.
  `t551` to `t554` were wordless wrappers in the product card. No page.txt in
  the run prints t551, t560 or t570. The first place they appear is the
  model's own 0057 response.
- Under `view_history`, `resolve` therefore resolved a guessed gap number to a
  search-page card wrapper.
- Fix: each Flow now keeps a `printed` set, bounded at 16,384 handles with the
  oldest printed dropped first. It is fed from three sources:
  - the line-leading handles in every capture's page-view text (`webLlmPageText`),
    for shown packets and looks alike;
  - a failure packet's `repairCandidates`;
  - what a search (`web.find_on_page`) or a description (`web.describe_element`)
    printed of the capture it took.
- Under `view_history`, a handle that would resolve but was never printed now
  returns the store code `not_shown`. The resolver refuses it as
  `web.handle.unknown`, which the brief sanctions. To the model it is exactly
  "a handle no packet you read carried", and it already maps to the
  `handle_not_in_packet` reason.
- Exploration's own node runs (no `handleReach`) are unchanged.

### Cause, lane D (t860)

- A press resolver never checked that the element is something a press acts on.
  View 14 prints `t860 "I can bring the gazebo..."` as plain text, under
  `t850 dialog`, beside `t857 button "Close chat"`.
- Fix: each stored target now carries `pressable`. A target is pressable when
  any of these holds:
  - the element is a control by its own tag, role, listener or cursor
    (`webLlmViewTraits`). This keeps drawn swatches and chips.
  - it is actionable by implicit role, a layer, or a `<label>`.
  - an ancestor is printed as a control. Words inside a button pass this way.
    A delegate ancestor (for example the chat panel that listens on its whole
    body) does not count, using the view's own holder rule.
- A resolution of a non-pressable target is marked `notAControl`.
- `resolveTarget` refuses a candidate's (`view_history`) `web.output.dom-click`
  on such a target with the new code `web.handle.not_a_control`, followed by
  `web.handle.not_a_control:<position>`. This also applies inside a Run Output
  node.
- Exploration's presses are not held to it, for two reasons:
  - The project rule says the model may do anything a person could. A listener
    a framework adds at the document is invisible to the capture, so text and
    a control can look the same.
  - Applying it to exploration broke two existing node-run tests
    (`node-run/tests/shown-handle-past-cap.test.ts`, the "Voltbay" filter written
    as a plain `div`).
- I did not reuse `web.handle.wrong_control`. That code means "the handle is
  right and the node is wrong" and names the node that fits, which would send
  the model to another node on the same message.

### Files

- New: `P/printed-handles.ts` (`webLlmPrintedTargetHandles`: reads printed handles from a value, line-start or anywhere, filtered to handles the capture holds).
- New: `P/printed-marks.ts` (`webLlmPrintedMarks`: a WeakMap keyed by capture that holds what a search or description printed. `tools.ts` passes the look capture through untouched and I may not edit it, so the mark rides on the capture object).
- New: `P/pressable-targets.ts` (`webLlmPressableTargets`).
- New: `page-view/line/control-holders.ts` (`webLlmControlHolders`, extracted from `choice.ts` so the press check reads the view's own delegate rule). Exported from `line/index.ts` and `page-view/index.ts`. `choice.ts` imports it.
- `P/target-packets.ts`: `printed` set, `printedBy`, `pressable` on `PageTarget`, `notAControl` on the resolution, the `not_shown` code, and `resolveFromHistory` extracted from `resolve`. Header updated.
- `P/resolve-plan-node.ts`: `web.handle.not_a_control` added to `WEB_PLAN_HANDLE_ISSUE_CODES` before `wrong_control`; `TARGET_ISSUES.not_shown -> web.handle.unknown`; a `press` flag passed to `resolveTarget`. Header updated.
- `P/next-page-slot.ts`: `not_shown -> web.handle.unknown`. A Next page control is not held to the press rule.
- `page-find/run.ts`, `page-find/run-description.ts`: compute the result, mark the capture, then call `looked` in a `finally`, so a throwing description still records the look as before. They import `../plan-resolution/printed-marks` directly; the barrel closed an import cycle.
- Tests: new `P/tests/printed-handles.test.ts` (5 tests) and `P/tests/press-control.test.ts` (4 tests). `P/tests/resolve-plan-node.test.ts` pins the published code list, now with `web.handle.not_a_control`.

## Commands run and observed results

All runs are from `T/domain`. The scratch runner `scratchpad/w6-run-tests.mjs` bundles named tests with esbuild (`fluxiq` external) into `domain/.test-build-scratch/t378-w6` and runs `node --test`.

- Fail-first, the two new files before the fix: `tests 9, pass 5, fail 4`. These failed:
  - "press on a plain text line" resolved `#chat .messages > p:nth-child(2)`.
  - the Run Output press resolved.
  - the gap handle resolved `{ ok: true, selector: "#card-2 > div.media", shownIn: {view: 1} }`.
  - unprinted hidden `t4` resolved `#sign-out`.
- After the fix, the same files: `tests 9, pass 9, fail 0`.
- plan-resolution, page-view and page-find tests at the first scope: `tests 210, pass 209, fail 1`. The failure was the pinned code list in resolve-plan-node.test.ts, which I updated.
- Final run of plan-resolution, node-run, page-find, page-view and `llm-evidence/tests` (97 files): `tests 699, pass 698, fail 1`. The failure is `tool-rejection-detail.test.ts`, "every code the plan resolver can refuse with names a reason": `actual [ 'web.handle.not_a_control' ], expected []`.
- `npx tsc -p tsconfig.json --noEmit` -> exit 0.
- `npx tsc -p tsconfig.test.json --noEmit` -> exit 0. That config has `noEmit`.
- `node scripts/structure-audit.mjs` (repo root), final: `structure-audit: 1 violation(s) across 1 rule(s)`. The one left is `[naming] apps/extension/src/panel/chat/stream/step/: 3 files share the prefix "card-"`, caused by another worker's untracked `card-retries.ts`. My first run also showed a contract-spread in my test and two import cycles through the plan-resolution barrel. I fixed all three.

## Not verified

- No live or Lab run, and no provider call, per the brief. The live shapes are reproduced in fixtures only:
  - lane B: a wordless card wrapper in a numbering gap;
  - lane D: a dialog with a press listener holding a close button and a text message.
- Detect results are not marked; `structure/` is not mine. A detection field's `at` handle counts as printed only when the page view printed that element. A wordless `at` element, such as an image column with no alt, would be refused for a candidate.
- Node-run answers that name handles from a look the model was not shown (covered-target, press effects) are covered only through the rule that a look's page-view lines count as printed. A wordless element named only there would be refused for a candidate.
- I did not run the full `pnpm test` or `pnpm check`.

## Open questions or contradictions found

1. Required follow-up in `domain/src/runtime/llm-evidence/tool-rejection.ts`, which I don't own. Add `["web.handle.not_a_control", "handle_wrong_kind_of_control"],` to `HANDLE_ISSUE_REASONS`. The closure test fails until then. The node-run path never produces the code today, because it is candidate-only.
2. Scope decision. The brief says "a press ... is refused" with no limit to candidates. I limited it to `view_history` because of the "anything a person could" rule and the two exploration tests it broke. If the supervisor wants exploration held to it too, there are two consequences:
   - the "Voltbay" fixtures in `node-run/tests/shown-handle-past-cap.test.ts` need `cursor: "pointer"` or `hasClickHandler: true`;
   - the `tool-rejection.ts` mapping becomes load-bearing.
3. Residual risk. A control whose listener the capture cannot see, with no role and no cursor, prints as text. If exploration pressed it successfully, a candidate naming it is now refused `not_a_control`. Nothing in my files knows a press had an effect, so I added no exemption for it.
4. Possible cleaner seam. `tools.ts` could pass each tool result's printed handles to the store directly, which would cover detection and node-run notes exactly. The WeakMap mark is the version I could reach within my files.
