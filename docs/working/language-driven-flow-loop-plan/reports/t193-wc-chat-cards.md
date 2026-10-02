# t193-WC: chat cards and headings say what each step does and on what

Lane B, t193. Worker report for brief t193-WC.

## Outcome

Partial. Every path the brief lists now produces a specific heading and card.
All owned tests pass, and so do the Core and domain checks. Three extension
tests outside my ownership still pin the old generic wording, so they fail
until someone updates one line in each (listed under "Open questions"). One
brief wording target, `Checking the options in "Colour"`, cannot be produced
while `describeCall` keeps its `{target?, text?}` shape (also explained under
"Open questions").

## What changed and why

### Root causes found in run `run-muqiojz4-04a7a8fc`

1. **The "No thanks" card read "Click · the page".** Core's observer called
   `describeCall` again for the call's end row. By then the click had closed
   the popup, the handle `t332` no longer resolved, and the end row's title
   fell back to "Clicking on the page". The extension then replaced the card
   with the end row's card. Fixed on both sides: Core describes a call once,
   before it runs, and reuses those words for its end row
   (`observer.ts:125`). The extension keeps the start card's target and kind
   when the end row names none (`messages.ts:216`).
2. **Action messages read "Looked at the page" or "Worked on the page".**
   `stepWords` titled every `core.run_node` tool row from its result code
   (`web.inspect.*`, `web.action.*`) and ignored Core's title. Core's own words
   now win, and the code-based table applies only to an older Core that sent
   an id (`words.ts:80`).
3. **Dry-run cards read a bare "Test run".** A dry-run step carries no handle,
   only `parameters.element`. For elements such as "+", "×" and
   "12 Double Rolls" that identity holds `visibleText` but no `accessibleName`,
   and Core read only `accessibleName`. Both Core (`action.ts:76`) and the
   domain (`call-words.ts:77`) now fall back to the element's own words.
4. **"Action · the page" was a rerun's reset.** `rerun.N.place`
   (`replay: "reset"`) had no verb, so the card fell through to `other` with
   no target. It is now a bookkeeping note, like a dry run's reset: "Putting
   the page back to where step N starts" (`tool-call.ts:96`).
5. **Red "Didn't work: it didn't work the same way again".** Both Core and the
   card treated every `core.replay.*` code except `replayed` as a failure.
   `remembered`, `verified` and `present` mean the step held. One shared
   predicate, `activityActionReplayFailing`
   (`ui/activity-action/replay-failing.ts:12`), is now used by the card
   (`action-of.ts:134`), by the failure reason (`failure-reason.ts:36`) and by
   Core's status label (`observer.ts:41`).

### Before and after, per path

| Path | Before (heading / card) | After (heading / card) | Producer (file:line) |
| --- | --- | --- | --- |
| End of a click whose popup closed (`close-signup-1`, t332) | "Clicking on the page" / `Click · the page` | "Clicking “No thanks”" / `Click · No thanks` | Core `runtime/activity/observer.ts:125`; ext `panel/chat/stream/step/messages.ts:216` |
| Action message with no decision before it (`core.run_node`) | "Looked at the page" / "Worked on the page" (from the result code) | Core's title, e.g. "Opening where the Flow starts", "Reading the details of “Colour”" | ext `panel/chat/stream/step/words.ts:80` |
| Dry-run step on an element named only by its words | heading "Trying the Flow from the start: clicking on the page" / `Test run` | "…: clicking “+”" / `Test run · +` | Core `wording/action.ts:76`; domain `node-run/call-words.ts:77` |
| Rerun reset (`rerun.10.place`) | "Trying a step on the page" / `Action · the page` | note "Putting the page back to where step 10 starts" (no card, like a dry-run reset) | Core `wording/tool-call.ts:96` |
| Rerun itself (`rerun.10`) | label = the action | label "Trying step 10 again: clicking “X”" | Core `wording/tool-call.ts:100` |
| Dry-run replay `core.replay.remembered` / `present` / `verified` | red "Didn't work: it didn't work the same way again"; label "… — didn't work the same way again" | `Test run · Set as my store`, "Done"; label "… — done" | `ui/activity-action/replay-failing.ts:12`, `action-of.ts:134`, `failure-reason.ts:36`, Core `observer.ts:41` |
| `web.describe_element` (and `web.recovery.describe_element`) | "Working on the page" / `Action · the page` | "Reading the details of “Add to cart”" / `Look · Add to cart` | Core `wording/action.ts:44`, `ui/activity-action/verb.ts:28`; domain `call-words.ts:68` |
| `web.detect_repeating_structure` | "Looking for the list of items" (live line fixed) / `Look at page` | "Looking for the repeating list around “X”", else "Looking for the repeating list on the page" / `Look · X` | Core `wording/action.ts:48`; domain `call-words.ts:68`; ext `shared/activity/wording.ts:168` (Core's words before the table) |
| `web.output.dom-capture_snapshot` (repair look) | "Looking at the page" / `Look at page` | "Looking over the whole page" / `Look` | Core `wording/action.ts:53`, `ui/activity-action/names.ts:11` |
| `web.find_on_page` | 'Looking for "Voltbay" on the page' / `Look at page` | same heading / `Look · "Voltbay"` | `ui/activity-action/action-of.ts:56,167` |
| `core.describe_nodes` | "Working on the page" / `Action · the page` | "Looking up how to use “Type”" ("“Type, Click and Extract list”", "… and N more") / `Look · Type` | Core `wording/core-tool.ts:33`, `ui/activity-action/action-of.ts:22` |
| `core.recall_result` | "Working on the page" / `Action · the page` | "Looking again at what “open store picker 1” found" (a dotted call id gives "…what an earlier step found") / `Look · open store picker 1` | Core `wording/core-tool.ts:39`, `action-of.ts:23` |
| Opening look (`initial.*`, observation node) | note "Looking at the page" | note "Looking over the page the Flow starts on" | Core `wording/tool-call.ts:23` |
| Opening navigation (`initial.*`, navigate) | "Opening where the Flow starts" / `Open page` | unchanged in words; the card no longer gets "the page" | Core `wording/tool-call.ts:21` |
| Unknown node or tool | "Trying a step on the page" / "Working on the page" | "Running the “Merge” step", "Using “Recall notes”", "Running a step" | Core `wording/tool-call.ts:35-36` |
| Any card with no named target | `Click · the page`, `Action · the page` | name only (`Click`), with the heading above saying what it did | ext `panel/chat/stream/step/card-words.ts:37` |
| Live line while the model decides | "Thinking about the next step" | "Deciding the next step" | ext `shared/activity/wording.ts:161` |
| Live line once the decision arrives | "Thinking about the next step" | the model's stated reason (the action's title instead when the reason names an id) | ext `shared/activity/wording.ts:157-161` |
| Live line when the provider gave no answer | "Thinking about the next step" | Core's sentence, "The AI model provider did not answer this request. Asking it again; …" | ext `shared/activity/wording.ts:161` |
| Run step: `web.dom.capture_snapshot` | "Looking at the page" | "Looking over shop.example.com", else "Looking over the whole page" | ext `panel/copy/step-copy.ts:55` |
| Run step: unknown action type | "Working on the page" | "Running a step" | ext `panel/copy/step-copy.ts:63` |
| Typing in a dry run (`selector` + `element`) | "Typing into the page" | 'Typing "towels" into “Search”'. Text is only shown for a named, non-sensitive field; for a password field only the field name is shown | domain `call-words.ts:77-82` |

`describeCall`'s return shape is unchanged: `{ target?, text? }`.

### Files

- Core `packages/fluxiq/src/ui/activity-action/`: `replay-failing.ts` (new),
  `index.ts`, `failure-reason.ts`, `action-of.ts`, `types.ts` (adds verb
  `describe`), `verb.ts`, and `names.ts` (look is now `"Look"`, no longer
  `"Look at page"`). Tests: `replay-failing.test.ts` (new), `action-of`,
  `failure-reason`, `names`.
- Core `runtime/activity/`: `observer.ts`, `wording/action.ts`,
  `wording/tool-call.ts`, `wording/core-tool.ts` (new),
  `wording/node-name.ts` (new). Tests: `observer`, `wording`,
  `wording/action`, `wording/wording`. All files are CRLF.
- Domain: `node-run/call-words.ts` and its test.
- Extension: `panel/chat/stream/step/{card-words,messages,words}.ts`,
  `panel/copy/step-copy.ts`, `shared/activity/wording.ts`, and the tests beside
  them.

## Commands run and observed results

- Core typecheck. `bash heavy.sh "t193 WC tsc" npx tsc --noEmit -p .` in
  `packages/fluxiq` printed nothing and exited 0, on both the first and the
  final run.
- Core vitest.
  `npx vitest run src/programs/automation-studio/runtime/activity src/ui/activity-action`:
  - First run: 4 failed out of 245. All four were expected wording changes.
  - After the test updates: 1 failure. It exposed a real bug: `recall_result`
    let the dotted id `initial.core.run_node` through, because underscores were
    replaced before the dot check. Fixed.
  - Final run: `Test Files 24 passed (24)`, `Tests 270 passed (270)`.
- Core structure audit. `node scripts/structure-audit.mjs` first flagged my
  `try/catch` in `describeSafely` (failure-as-empty). I removed the catch and
  its test, so describer errors propagate as before. Final result:
  `structure-audit: 1 violation(s)`. That violation is
  `runtime/flow-draft/step-words.ts:32` (failure-as-empty), which belongs to
  the other worker, not me.
- Core build.
  `pnpm --filter @fluxiq/contracts --filter fluxiq --filter @fluxiq/client-gateway-websocket build`
  ran twice and finished with `fluxiq build: Done`. Afterwards
  `scripts/check/core-build.mjs` still reported the dist as stale: the other
  worker edited `llm/evidence-loop/index.ts` after the first build and
  `flow-draft/step-words.ts` after the second. My changes are in the built
  dist.
- Extension tests. `test-extension.mjs` has no filter, so I used a scratch
  copy of its esbuild setup, limited to `panel/chat`, `panel/copy`,
  `shared/activity` and `background/activity`. It writes to
  `.test-build-scratch/t193-wc`.
  - First run: 306 tests, 8 failures.
  - Final run, against the final Core build: `40 test files`, `# tests 308`,
    `# pass 305`, `# fail 3`. All three failures are in tests I do not own;
    see below.
- Extension typecheck. `npx tsc -p tsconfig.json --noEmit` exited 0, and
  `npx tsc -p tsconfig.test.json --noEmit` exited 0.
- Domain tests. A scratch runner with `DOMAIN_TEST_BUILD_LABEL=t193-wc` over
  `runtime/llm-evidence/node-run` reported `24 test files`, `# tests 133`,
  `# pass 133`, `# fail 0`.
- Domain typecheck. `npx tsc -p tsconfig.json --noEmit` exited 0, and
  `npx tsc -p tsconfig.test.json --noEmit` printed nothing.
- Downstream structure audit. `node scripts/structure-audit.mjs` printed
  `structure-audit: passed (155 warning(s), 118 baselined)`.

## Not verified

- No live run and no browser check. The wording was checked against the step
  logs and screenshots of `run-muqiojz4-04a7a8fc`, not seen in a live panel.
- Not run: the full extension suite, the full domain suite, Core's whole
  vitest, and Core's `apps/web` panel tests. The panel shares
  `ACTIVITY_ACTION_NAMES`. A grep found no `apps/web` test that pins
  "Look at page", but none was run.
- The extension test gate (`core-build.mjs`) never reported a fresh dist,
  because the other worker kept editing Core.

## Open questions or contradictions found

1. **Three extension tests outside my ownership pin the wording the brief asked
   to remove.** Each needs a one-line update:
   - `apps/extension/src/background/activity/tests/activity-replay.test.ts`,
     around line 194: in the expected sorted list,
     `"Thinking about the next step"` becomes `"Deciding the next step"`.
   - `apps/extension/src/panel/chat/tests/chat-panel.test.ts:272`:
     `"Click, the page: Done"` becomes `"Click: Done"`.
   - `apps/extension/src/panel/chat/view/tests/action-card-view.test.ts:72,79`:
     the target becomes absent instead of "the page". The labels become
     `"Type: Didn't work: the field was covered by a banner."` and
     `"Action: Done"`.

   `background/activity/tests/pacer.test.ts` was left passing on purpose:
   events that carry no detail (an older Core) still read
   "Thinking about the next step".
2. **`Checking the options in "Colour"` is not produced.** No tool inspects
   choices as such; a grep of Core and the domain found none. The closest
   call is `web.describe_element` on a select or radio group, and that now
   reads "Reading the details of “Colour”". Telling a select apart would need
   the element's kind in `describeCall`'s answer. The brief fixes the shape at
   `{target?, text?}`, and the binding types live in `runtime/llm/**`, which I
   must not touch. If wanted, a follow-up could add an optional
   `kind?: "choices"` there, and Core's phrase would then pick the options
   sentence.
3. **`core.describe_nodes` puts quotes around the step names**
   (`Looking up how to use “Type”`, not the brief's unquoted form). The quotes
   are how a card reads its target, so the card shows `Look · Type` rather
   than a bare `Look`.
4. **The live line now shows the model's reason** once a decision arrives, as
   the brief asked. The reason can run to 240 characters, and the pacer's
   `bounded()` cuts it for the overlay. If a shorter line is preferred, the
   alternative is the decision's title.
