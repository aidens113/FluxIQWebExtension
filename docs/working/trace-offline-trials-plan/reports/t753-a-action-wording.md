# t753-a action wording: worker report

Worktree: `C:/Users/osrs_/FluxStuff/fxwork/t753/!FluxIQ` (Core). Nothing committed.
RA = `packages/fluxiq/src/programs/automation-studio/runtime/activity`.

## Outcome

Done. All nine items are fixed, and each has a test that failed before the fix.
Owned suites: 506 of 506 pass. `tsc --noEmit` is clean. The structure audit passes.

## What changed and why

1. **CSS class shown as a control's name.**
   - `RA/call-context.ts`: one `VIEW_LINE` regex replaces `PRINTED_LINE` and `KIND_LINE`. It follows the domain's line order, `<handle> [hN] [kind[...]] ["words"]`. A name is read only from the name's place, with `\"` unescaped. `class="…"` and `use="…"` are never read as the name.
   - The call context now also remembers each handle's printed kind, exposed as `kind(call)`.
   - `RA/observer.ts`: `describedOf` passes that kind along.
   - `RA/wording/human-label.ts` now also rejects a single word that is a class or a generated token: a styling library's prefix (`css-`, `sc-`, `jsx-`…), a `__` or `--` class, a dash-joined part of 5 or more characters that mixes letters and digits, or 4 or more alternating letter/digit runs. It keeps words like "7-in-1", "USB-C", "4K60" and "SKU-12345".
   - New `src/ui/activity-action/control-nouns.ts` (`activityActionControlNoun`, `ACTIVITY_ACTION_CONTROL_NOUNS`), exported from the barrel. It turns a kind into a plain noun: button → "a button", link → "a link", clickable → "a control", and so on.
   - `RA/wording/action.ts`: a new per-phrase `kinded` sentence gives "Clicking a button" and "Reading the details of a button". An unknown kind keeps the old plain sentence.
   - `ui/activity-action/action-of.ts` reads these back: the card target is "a button", or "a button's details" for a details look.
2. **Tool names shown.**
   - `RA/wording/core-tool.ts`: `core.submit_subflow` → "Saving one part of the Flow"; `core.test_subflow` → "Testing one part of the Flow".
   - `action-of.ts` `CORE_TOOL_KINDS`: these two map to the edit and test kinds (`draft` / `test`). A resent part's card is named "Send that part again".
   - `RA/decision-answer/refused-call.ts` `SENT_AGAIN`: the two subflow tools say "it was sent again unchanged…" and "it was asked for again with nothing changed…". The title already names the part.
   - `RA/wording/tool-call.ts` `unnamed()` no longer shows a tool's own name. One of Core's own tools reads "Working on the Flow"; any other reads "Running a step". The node-name fallback ("Running the “Merge” step") is kept.
   - Every tool the model can call is now covered by name: run_node, flow_draft, describe_nodes, recall_result, run_flow, submit/test candidate, submit/test subflow.
3. **`RA/project/receipt-card.ts`**: the labels are now "The whole Flow's test passed" / "…failed", "Couldn't confirm the whole Flow's test", "One part's test passed: X" / "…failed: X", and "Couldn't confirm one part's test: X". No "trial" or "subflow".
4. **`RA/project/plan-card.ts`**: `coresRunner` drops the subflow Core adds. It is identified when the plan has more than one subflow, it is the router's fallback target, and it carries no parts. The title is now "Plan: N parts of the task, built in M pieces", with no "subflows".
5. **One-field list read**:
   - `action.ts` `fieldsRead`: "link" → "Reading the links", "productTitle" → "Reading the product titles", "category" → "categories", "address" → "addresses". A name with several fields keeps "Reading the list of “…”".
   - The card target is "links".
6. **Page named after a path segment**:
   - `RA/wording/page-name.ts`: a page on this machine is "the start page" at the start address. Otherwise it is the call's own `parameters.title` if it carries one, "the home page" at the root, or "another page".
   - The old path-word reading (`pathName`) is removed. Public sites still read as their host ("example.com").
   - The card reads "another page" as its target.
7. **Untick**:
   - New verb `uncheck` in `ui/activity-action/verb.ts` (words uncheck/untick, gerund "unticking") and in the `types.ts` union. Its name is "Untick" in `verb-names.ts`.
   - `action.ts`: a check with `parameters.checked === false` reads "Unticking “X”" (or "Unticking a box").
   - `action-of.ts` names the card "Untick".
8. **Undo shown as an ordinary act**:
   - `tool-call.ts` `puttingBack`: a call carrying `undoes` reads "Putting the site back: clicking “Remove”". The key is read as a plain string, with no import from flow-bootstrap.
   - `action-of.ts` names that card "Put back". The target stays the control, and the kind stays the node's (click).
9. **Zero rows**:
   - `action-of.ts`: a finished read with `Rows: 0` now has outcome `failed`, why "it found no rows", and no `result`.
   - This reuses an existing outcome, so the extension needs no change.

Tests updated for the intended changes:
- `wording/tests/wording.test.ts`: "Reading the titles", "another page" in place of path words, and "Running a step" for an unknown tool.
- `tests/call-context.test.ts`: the start-page test now expects "another page".
- `project/tests/cards.test.ts`: the new titles.

New tests:
- `wording/tests/human-label.test.ts`
- `wording/tests/tool-call.test.ts`
- `ui/activity-action/tests/control-nouns.test.ts`
- added blocks in `action.test.ts`, `call-context.test.ts`, `refused-call.test.ts`, `cards.test.ts`, `action-of.test.ts`, `verb.test.ts` and `verb-names.test.ts`

## Commands run and observed results (progress log)

All commands ran from `packages/fluxiq` unless noted.

1. **Baseline.** `pnpm exec vitest run RA/wording/tests RA/tests/call-context.test.ts RA/tests/observer.test.ts RA/tests/refused-call.test.ts RA/project/tests src/ui/activity-action/tests` → `33 passed (33)`, `456 passed (456)`.
2. **New tests before the fixes.** Same files plus the new ones. 27 failed. Examples:
   - `expected 'Clicking “css-0732x7m”' to be 'Clicking a button'`
   - `expected 'Ticking “Email me updates”' to be 'Unticking …'`
   - `expected 'Reading the list of “link”' to be 'Reading the links'`
   - `expected 'Opening “my orders”' to be 'Opening another page'`
   - `human-label rejects css-0732x7m: expected 'css-0732x7m' to be undefined`
   - `Received: "Not done: using “Test subflow” — it was already tried exactly this way and changed nothing"`
   - plan card: `expected [ 'main', 'list_soups', 'save_recipe' ] to deeply equal [ 'list_soups', 'save_recipe' ]`
   - receipt: `expected [ 'Whole-Flow trial passed', … ]`
   - six action-of t753 cases failed

   Two suites did not load in that run:
   - `call-context.test.ts`: a newline slip of mine in the test, fixed since.
   - `tool-call.test.ts`: the wording barrel imported another worker's in-flight `act-words.ts`, which had a bad regex at that moment.
3. **Pre-fix check for those two suites.** I put HEAD copies of `call-context.ts`, `tool-call.ts`, `core-tool.ts`, `action.ts`, `page-name.ts` and `human-label.ts` beside the originals as `*-t753a-head.ts`, with a probe test. Result: 3 failed.
   - `expected 'css-0732x7m' to be undefined`
   - `expected 'Using “Submit subflow”' to be 'Saving one part of the Flow'`
   - `expected 'Clicking “Remove”' to be 'Putting the site back: clicking “Remo…'`

   I deleted the copies and the probe afterwards (`git status` shows none).
4. **After the fixes**, same run: 4 failures, all old expectations of behaviour the brief changed (`wording.test.ts`: path names, "Using “Recall notes”", "Reading the list of “title”"). After updating those: `36 passed (36)`, `499 passed (499)`.
5. **Structure audit** (`node scripts/structure-audit.mjs`, from the worktree root). First run: `FAIL [as-never] … refused-call.test.ts: 10 \`as never\` casts … Baseline for this entry is 8`. I replaced my two casts with typed `Evidence` and `Decision`. Then: `structure-audit: passed (441 warning(s), 1152 baselined)`.
6. **Typecheck**, `pnpm exec tsc --noEmit -p .`. The first runs showed 6 errors, all in `src/ui/activity-status/tests/pacer-steady.test.ts`, another worker's in-flight file. None were in my files. The final run printed no errors.
7. **Another worker's sweep.** With their new `RA/tests/person-facing-sweep.test.ts` included: 1 failure, `repeated phrase "part of the flow"` in my refused-call label. I shortened the subflow reasons. Final run of all owned suites plus the sweep: `37 passed (37)`, `506 passed (506)`.

## Not verified

- No live or browser run. No full suites, as the brief says.
- The overlay and the extension's rendering of the new titles and targets were not looked at.
- Whether a real domain `describeCall` ever returns a class as `target` is not known. The human-label rejection covers that path either way.
- No navigate node is known to carry `parameters.title`. Reading it is the brief's "when the call carries it". Today every local non-start, non-root page reads "another page".

## Open questions or contradictions found

- **Strings read by a model:** I found none. The changed wording reaches only activity rows, labels, cards and `executor/state-routing/announcement.ts`, which also emits activity. So the prompt contract tests were not run. Not checked: whether `conversations/**` feeds chat activity back to a model.
- **Extension words (I did not edit the extension):** `apps/extension/src/panel/chat/stream/step/project-words.ts` builds project cards from the card's own fields, not from Core's title. It still says "Planned 2 subflows", "Plan · 3 parts, 2 subflows", a "Subflows" heading and "Subflow trial · X / Passed". My Core change fixes the status label and overlay text and drops the runner subflow from `card.subflows`. The extension needs its own rewording to drop "subflow" and "trial".
- **Plan card budget and cases:** the reset brief's `subflowKey` is the runner's key. Its `cases` and `budget` entries still name that key, now that the runner is no longer in `card.subflows`. The extension counts it in the total and finds no name for it.
- **Zero rows, status line:** the card now fails, but the observer's line still ends "— done". `observer.ts` was owned only for the undo and name fixes, so I left it. A test of a Flow that should read an empty list will now show a failed card.
- **Plain sentences now carry a target:** "Ticking a box" and "Choosing an option" now give the targets "a box" and "an option" (before: null).
- **File size:** `ui/activity-action/action-of.ts` is 542 lines (was 508). It was already past the 400-line advisory before this change.
