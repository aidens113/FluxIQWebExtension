# t509 select-target-observed: worker report

## Outcome

Done. The brief and both of the coordinator's additions, (a) and (b), are in place, with fail-first tests. Nothing is committed.

## Cause, proved

Evidence: `run-mv6qrcdu-a31b44b8` (local-classifieds).

- Steps 0052-0056 ticked the condition checkboxes. Step 0058 pressed `t1222` (`field "Sort by"`, the scenario's `div role="combobox"` in `view/filters.ts`). That opened the list that `client/feed-script.ts` builds: a `div role="listbox"` holding `div role="option"` rows.
- The view taken after 0058 printed that list as `t1412 select`, with `t1413`-`t1417` `option` rows under it. The handle was in the latest view, so the handle was neither stale nor unobserved.
- Step 0060 sent `dom-select` on `t1412` with `value: "price_asc"`. The resolver refused it with `target_unobserved` / `handle_wrong_kind_of_control`, with no `useNode` and no `next`. The repeat guard then ended the build at 0062-0066.

Three causes, which contradict each other:

1. `domain/src/runtime/llm-evidence/page-view/element/kind.ts:ownKind` (`ROLE_KINDS.listbox = "select"`) prints any `role=listbox` as `select`, so the view invites the choice node.
2. `domain/src/runtime/llm-evidence/plan-resolution/control-fit.ts:actsOnTheWrongControl` refuses the choice node on anything except `tagName === "select"`. That part is correct: the extension's select verb needs an `HTMLSelectElement`.
3. `control-fit.ts:fittingNodeCode` names no fitting node for a listbox, because `listbox` is not in `PRESSABLE_ROLES`. `tool-rejection.ts:rejectionDetail` also had no `next` for this reason. The refusal was therefore bare resolver codes.

It was not an observation window or a stale handle.

Coordinator addition (a), steps 0020/0030/0032:

- `apps/extension/src/content/actions/select.ts:findOption` matched `by:"value"` against `option.value` only. "10 miles" (value "10") failed.
- `domain/.../action-failure/refusal.ts:BY_FAILURE_REASON` had no entry for `OPTION_NOT_OFFERED`, so the model got a bare `output_not_observed`.

## What changed and why

**(b) The page view prints a scripted list as `listbox`.**
- `page-view/element/kind.ts`: a native `<select>` prints as `select` whatever role it carries, and nothing else prints as `select`. `role=listbox` on any other element now prints as `listbox`.
- `plan-resolution/typing-targets.ts`: `listbox` was added to `WEB_LLM_NOT_A_FIELD_KINDS`. Without it, a type step on a listbox would no longer be refused at submission (it used to be refused as `select`).

**The brief: a choice step on a scripted control is refused at once, and the refusal names the element and the move.**
- `plan-resolution/control-fit.ts`: `webPlanControlMisfit` now also returns `kind` (`web.handle.target_kind.listbox|combobox`) for the choice node on a scripted listbox, or on a combobox that is not a native select or a typed input.
  - A listbox names no `useNode`, because pressing the list itself chooses nothing.
  - A combobox names `dom-click` with the same handle, to open it.
- `control-fit.ts` also exports `webPlanScriptedChoiceMove(codes)`, which holds the `next` sentences:
  - Listbox: "custom listbox, not a native select … call web.output.dom-click with that option's own handle, which the page view prints under the listbox …"
  - Combobox: "Press it to open its list (useNode …), then press the option …"
- `plan-resolution/resolve-plan-node.ts`: the `wrong_control` refusal also carries the kind code. `web.handle.target_kind.combobox` was added to `WEB_PLAN_HANDLE_ISSUE_CODES` (`listbox` comes in through the not-a-field kinds). The file stays at 800 lines.

**(a) Choosing an option by its visible words.**
- `apps/extension/src/content/actions/select.ts`: when a value matches no option's value, `findOption` falls back to the one option whose visible words match. Spacing and letter case are ignored. Two options with the same words match neither, so the choice is deterministic and a value match always wins.
- `action-failure/refusal.ts`: `OPTION_NOT_OFFERED` now maps to the new closed reason `option_not_offered`. The code stays `output_not_observed`, which Core reads.
- `tool-rejection.ts`: the reason was added to `WEB_LLM_TOOL_REJECTION_REASONS` and its doc.
- The `next` for `option_not_offered` says where the options are and how to name one: "The page view lists its options by their visible words after the select's own line, in [ | ]; send one of those exactly as value, or the option's value as describe_element shows it …"

**Split forced by the structure audit.**
- `tool-rejection.ts` was at its 800-line limit, so its `next` sentences and their selection moved to a new `domain/src/runtime/llm-evidence/rejection-next/next-sentence.ts`, with an `index.ts` barrel. It is a directory because `llm-evidence/` would otherwise go over 25 files.
- `rejectionDetail` now calls `webLlmRejectionNext(reason, instead, closeWith)`. The existing sentences moved verbatim, and `tool-rejection.ts` is now 752 lines.
- `rejection-next` deep-imports `../plan-resolution/control-fit`. Going through the barrel would close a module cycle; the audit accepts this.

**Tests (all fail-first, observed failing before each fix):**
- `plan-resolution/tests/resolve-plan-node.test.ts`: a new test covers a scripted listbox, a scripted combobox, a typed combobox and a native select with a list role. The issue-code list gained listbox and combobox.
- `tests/tool-rejection-detail.test.ts`: a new runtime-level test covers both refusals, their `next` and `useNode`, that no page words appear, the repeat behaviour, and that the option press works. `Page` gained `role?`.
- `page-view/element/tests/kind.test.ts`: a new test, "a scripted list is a listbox …".
- `action-failure/tests/refusal.test.ts`: a new `NAMED` row for `OPTION_NOT_OFFERED`, plus a test that the `next` carries none of the page's option words.
- `apps/extension/src/content/actions/tests/select-option-label.test.ts` (new): covers the visible-words fallback, value winning over words, and shared words choosing neither.

All fixtures are generic (colours, leagues); none uses scenario words.

## Commands run and observed results

**Fail-first runs:**

| Command | Result before the fix |
| --- | --- |
| `DOMAIN_TEST_BUILD_LABEL=t509 node scripts/test-domain.mjs plan-resolution/tests/resolve-plan-node llm-evidence/tests/tool-rejection-detail` | `# pass 35 # fail 3`: the code list, the resolver test and the detail test |
| `… test-domain.mjs page-view/element/tests/kind` | `# pass 3 # fail 1` |
| `… test-domain.mjs action-failure/tests/refusal` | `# pass 7 # fail 2` |
| `EXTENSION_TEST_BUILD_LABEL=t509 node scripts/test-extension.mjs content/actions/tests/select-option-label` | `# pass 2 # fail 1`: the visible-words test |

**After the fixes:**

| Command | Result |
| --- | --- |
| `DOMAIN_TEST_BUILD_LABEL=t509 node scripts/test-domain.mjs llm-evidence/plan-resolution/tests/ llm-evidence/tests/ llm-evidence/page-view/ llm-evidence/action-failure/tests/` | `# tests 450 # pass 450 # fail 0` |
| `EXTENSION_TEST_BUILD_LABEL=t509 node scripts/test-extension.mjs content/actions/tests/` | `# tests 162 # pass 162 # fail 0` |
| `domain: npx tsc -p tsconfig.json --noEmit` and `-p tsconfig.test.json` | exit 0 and 0 |
| `apps/extension: npx tsc -p tsconfig.json --noEmit` and `-p tsconfig.test.json` | exit 0 and 0 |
| `node scripts/structure-audit.mjs` | `structure-audit: passed (193 warning(s), 646 baselined).` |

Two intermediate audit failures were fixed:
- `resolve-plan-node.ts` and `tool-rejection.ts` went over 800 lines. Fixed by the split, and by keeping the resolver at 800.
- `llm-evidence/` reached 26 files. Fixed by moving the new module into a directory.

## Not verified

- No headed browser or content-harness check, and no live or Lab run.
- I skipped the model-free `pnpm lab run local-classifieds --flow`: the recorded workflow presses the sort combobox and its option by click (`manifest.ts` `sortCheapestFirst`), so it never goes through the page-view wording or a dom-select on a listbox.
- No full suites. Domain and extension tests outside the touched directories did not run.
  - Grep finds no other test or fixture under `domain/src`, `packages` or `apps/scenario-lab/src` that mentions `listbox`.
  - Core's activity wording, and anything else that switches on reason words, has not seen the new `option_not_offered` reason.
- Whether the model actually acts on the new `next` sentences in one step is unmeasured.

## Open questions or contradictions found

1. **Coordinator (a) asked for refusal text that lists the offered options' labels.** `tool-rejection.ts`'s header forbids page text in a refusal detail ("No text from the page … A detail that would need any of those is not added"), and `refusal.ts` deliberately drops the client's sentence. So the `next` points to the labels the page view already prints after the select's line (`[a|b|c]`), and to describe_element, and does not copy them. Putting labels in the detail would relax that rule, which is a supervisor or user decision.
2. A `div role="combobox"` still prints as `field` (`kind.ts`, `combobox: "field"`), as the sort opener did (`t1222 field "Sort by"`). The model pressed it correctly, so I left it alone. A scripted, non-editable combobox may deserve its own word.
3. The brief capped the work at three source files. The coordinator's additions and the audit's split brought it to nine:
   - domain: `control-fit.ts`, `resolve-plan-node.ts`, `tool-rejection.ts`, `rejection-next/next-sentence.ts` and its `index.ts`, `kind.ts`, `typing-targets.ts`, `action-failure/refusal.ts`
   - extension: `select.ts`

   No file of t507's covering check was touched.
