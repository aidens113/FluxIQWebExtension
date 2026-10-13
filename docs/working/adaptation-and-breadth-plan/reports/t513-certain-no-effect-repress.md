# t513 certain-no-effect-repress: worker report

## Outcome

Done, within the scope as revised by the coordinator's decision:

- Goals 1, 4 and 5 are built.
- Goal 3 was dropped, and the Core change I made for it has been reverted. The Core tree is clean.
- Goal 2 moved to a separate task and was not started.
- Nothing was committed.

## What changed and why

### Goal 1: exploration presses a lasting control again when its press certainly changed nothing (domain)

- New file `domain/src/runtime/llm-evidence/node-run/press-effect/certain-no-effect.ts` exports `webPressCertainlyIgnored(after, handle)`.
  - It is only asked about a press that `no-effect.ts` has already judged unchanged. That judgement already requires both looks to be whole and not loading, and the page to be the same except for where it is drawn.
  - It adds checks on the control itself, read on the look after the press:
    - the handle is known and the control is present by that handle;
    - the control is not hidden;
    - the control is not `disabled` as the page view prints it (`webLlmStateTokens`: the disabled attribute, `aria-disabled`, or a not-allowed cursor);
    - every element on its `parent` chain (its form, its dialog) is present and not hidden.
  - Anything it cannot read counts as not certain.
- `press-effect/settled.ts`:
  - `WebPressSettleSteps` gains `lasting?: boolean`. A lasting press is made again only when `webPressCertainlyIgnored(page, handle)` holds.
  - When the second press works, the sentence now begins "Pressed again: the first press of X changed nothing, so it was pressed once more; ...".
- `press-effect/index.ts` exports the new module and mentions it in its header.
- `node-run/run.ts`, around line 412, now passes `pressAgain` and `lasting`. It used to pass `pressAgain: lasting ? undefined : pressAgain`.
  - Any lasting press that reaches this point has already passed the permission gate, so the second press uses the grant the call already had.
  - The second press goes through the same `webNodeDispatchWithRetries` with `declared`, so Core's own gates still hold it back if its answer is lost.

### Goal 4: a filled content-editable field prints what it holds (domain, page view)

- `page-view/element/state-tokens.ts`: a field with a `contenteditable` attribute (any value except `false`) and no `value` now prints its `text` as `="..."`, spaced as a reader sees it (`webLlmReadableWords`).
  - If the region has no words at all and no name, it prints `=""`.
  - If it has a name but no text, it prints nothing, because the text may have been folded into the name and that is not guessed at.
- The value is screened exactly as today:
  - `text` goes through `screenedPageText`, which is the same `screenedText` that `value` goes through.
  - A sensitive element is dropped whole by `isSensitiveElementDescriptor`.
  - The extension strips the text of sensitive controls at the source (`textOutsideSensitiveControls`).
  - Field values have not been truncated anywhere since t200, so no new bound was added.
- Where the value was actually lost:
  - The extension already fills it. `apps/extension/src/content/describe-element.ts` `readElementValue` returns `innerText` for `isContentEditable`, and `dom-snapshot.ts` describes every element through `describeElement`.
  - The domain sanitizer drops it. In `domain/src/runtime/llm-evidence/elements.ts:212-214`, `safeFillTag` keeps `value` and `hasValue` only for `input` and `textarea`.
  - `elements.ts` was not in the brief, so the page view reads the region's `text`, which carries the same words. No extension file was changed.

### Goal 3: dropped and reverted (Core)

At the coordinator's direction, I discarded my uncommitted edits to `runtime/llm/repeat-guard/outcomes.ts` and `tests/outcomes.test.ts` in the t513 Core worktree with `git checkout --`. They were only my own edits. Afterwards:

- `git status --short` in Core prints nothing.
- `certain_no_effect` appears nowhere in the Core or domain sources.

### Goal 5: tests written to fail first

- `press-effect/tests/press-settled.test.ts`, four new tests:
  - a lasting press that certainly changed nothing is pressed again, and its sentence starts "Pressed again:";
  - a disabled, `aria-disabled`, hidden or missing control is not pressed again;
  - a hidden dialog or an unknown handle stops the second press;
  - a changed, unreadable or truncated page stops the second press.
- `press-effect/tests/no-effect-press.test.ts`, through the real runtime:
  - The old test "a lasting press is not pressed again" was replaced, because the decision reverses it.
  - A form whose Save ignores its first press, called with `modify_existing`, is now pressed twice and answers `succeeded` with `pressedAgain`.
  - A lasting press that still changes nothing reports "pressed twice".
  - A lasting press on a disabled Save is pressed once and reports `no_effect`.
- `page-view/element/tests/state-tokens.test.ts`: tests for the content-editable value tokens, and a whole page-view line: `t1 field "Write something..." ="Lunch at noon"`.

## Commands run and observed results

### Fail-first runs, before the change

- Domain: `DOMAIN_TEST_BUILD_LABEL=t513 node scripts/test-domain.mjs node-run/press-effect/tests page-view/element/tests` printed `# tests 94  # pass 87  # fail 7`. The 7 failures were exactly the new tests.

### Final runs, after the revert

- Domain tests: `DOMAIN_TEST_BUILD_LABEL=t513 node scripts/test-domain.mjs node-run/press-effect/tests node-run/tests page-view/element/tests page-view/tests page-view/line/tests` printed `# tests 377  # pass 377  # fail 0`.
- Core: `npx vitest run src/.../llm/repeat-guard/tests src/.../llm/evidence-loop/tests/repeat-guard.test.ts` printed `Tests 56 passed (56)`. That is the count from before my change (59 minus the 3 tests I had added).
- Typechecks, each run with `--noEmit`, all exited 0 with no output:
  - Core `packages/fluxiq`: `npx tsc`;
  - domain `npx tsc -p tsconfig.json` and `npx tsc -p tsconfig.test.json`;
  - extension `npx tsc -p tsconfig.json`.
- Structure audits:
  - Downstream `node scripts/structure-audit.mjs` printed `structure-audit: passed (193 warning(s), 646 baselined)`. An earlier run had failed `[contract-spread]` on a conditional spread in my test stub; I rewrote it as two literals.
  - Core `node scripts/structure-audit.mjs` printed `structure-audit: passed (340 warning(s), 1159 baselined)`.
  - The only warnings on touched files are advisory: `run.ts` is 778 lines and was already over the 400-line threshold before this change.

## Not verified

- No live, Lab or browser run. In particular, it is not confirmed that a second FluxIQ press actually posts on the social site.
- No full suites were run, as the brief directs.
- Trials and playback (goal 2) still never press a lasting control twice. That work moved to a separate task.

## Open questions or contradictions found

1. **Goal 2 handoff.** Playback and candidate trials dispatch through `domain/src/runtime/adapter.ts`, which takes no look before or after a press. The extension's click watch (`apps/extension/src/content/action-runtime/ignored-press/`) presses again only when it saw no sign at all, and the social Post button's spinner counts as a `change` sign. So the new task needs the watch to treat a transient change that reverts as no answer, or to report it as one.
   - Core's `executor/defensive/assess.ts` already retries an `unacted`, retryable failure at stage `execution`, even for a lasting node. The existing `lasting-act.test.ts` "keeps its retries when the failure shows it did not happen" case covers this.
   - It would retry up to the default three times, not exactly once.
2. **Content-editable presence.** `elements.ts` `safeFillTag` still drops `hasValue` for a content-editable region. As a result, a region that is named and empty prints no `=""`.
