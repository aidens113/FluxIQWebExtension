# lane4-w5-reveal-by-scroll (live-lane-4, t567)

## Outcome

Done. If a click, type, select or check is refused as `hidden` (TARGET_NOT_SHOWN), the node's automatic retries now scroll toward where the target would be before the next attempt, then wait for the page to answer. On company-website's team page, "Show more people" pressed from the top of the page now succeeds on attempt 4. With the reveal disabled, the same harness spec reproduces the live failure word for word.

## What changed and why

- **New `apps/extension/src/content/action-runtime/reveal/`**
  - `reveal-aim.ts` works out where to scroll, using only reads:
    - **A target with no box** (display:none on itself or an ancestor, a zero-size box): scroll the end of its nearest displayed ancestor that has a box, crossing shadow roots. If that ancestor scrolls its own content, that content goes to its end too. If the ancestor is the body, the whole page scrolls.
    - **A target with a box but hidden by `opacity:0` or `visibility:hidden`:** scroll the target itself to the centre, but only if its box is outside the viewport.
    - **Never scrolled for:** an inert target, a detached one, and a target held by a layer: a closed `<dialog>`, `[popover]`, `position:fixed`, a closed `<details>`, or a role of dialog, alertdialog, menu, listbox or tooltip.
    - **No scroll when nothing would move:** the ancestor's end already on screen and its content already at its end.
  - `reveal-by-scroll.ts` makes the scroll (`behavior: "instant"`) and reports whether anything moved by at least 1px.
  - `unshown-target.ts` keeps the refused element in a WeakMap keyed by the result, the same pattern as `recovery/refused-control.ts`. The element never goes on the wire, and the next attempt still looks up its target from scratch.
- **`results.ts`:** `actionRejected` records the target for any `hidden` refusal that has `evidence.target`, on the non-dialog path only.
- **`recovery/attempt.ts`:** new injected, defaulted parameter `reveal` (`RecoveryReveal`). For an `obstructed_target` fault the order is: clear layers, then scroll, then pause. A scroll that moved the page waits on the new reveal ladder; one that moved nothing keeps the old wait. No scroll happens when no retry follows.
- **`recovery/budget.ts`:** new `RECOVERY_REVEAL_BACKOFF_MS = [400, 800, 1600]`, the same three rungs as the interference ladder. The number of attempts is unchanged (first attempt + 3 retries); only the wait is longer. `recoveryBackoffLadder` and `recoveryBackoffMs` take an optional `revealing` argument.
- **`recovery/account.ts`:** new optional `reveal?: { scrolls, shown }`, present only when a scroll moved the page, so existing accounts and sentences are unchanged. When present, the sentence gains `, scrolling N times toward where the target would be, which revealed it` or `, which did not reveal it`. `shown` means the last result is not TARGET_NOT_SHOWN.
- **`recovery/index.ts`:** barrel exports and header comment updated.
- **Tests:**
  - `reveal/tests/reveal-by-scroll.test.ts` (7 rows) with `reveal/tests/fake-page.ts`
  - `recovery/tests/reveal-attempt.test.ts` (5 rows)
  - one new row in `tests/results.test.ts`
  - harness spec `apps/extension/e2e/content/tests/reveal-by-scroll/tests/company-website-team-more.spec.ts`. It sets consent, dismisses the timed prompts, opens `/scenarios/company-website/team`, waits for the first 8 cards plus 1 s (the batch endpoint refuses requests closer than 900 ms), scrolls to the top and asserts the button is hidden. It then clicks the button by selector and asserts: the click succeeded, the account says "which revealed it", there are more than 8 cards, and the button is visible. A second press, needed because the page's first press only shows a spinner, grows the grid again.

## Commands run and observed results

- `npx tsc -p tsconfig.test.json` (apps/extension):
  - Exit 0, no output.
  - An earlier run printed TS2307 errors for `fluxiq/...`. At that moment `!FluxIQ/packages/fluxiq/dist` did not exist because something else was rebuilding it. After the rebuild finished, the clean run above was the result.
- `EXTENSION_TEST_BUILD_LABEL=lane4-w5 node scripts/test-extension.mjs src/content/action-runtime/` → `# tests 378 / # pass 378 / # fail 0`.
- `EXTENSION_TEST_BUILD_LABEL=lane4-w5 node scripts/test-extension.mjs src/content/actions/` → `# tests 181 / # pass 181 / # fail 0`. These verbs reach my code through the retry loop.
- `node scripts/structure-audit.mjs` (repo root) → `structure-audit: 1 violation(s) across 1 rule(s)`.
  - The one violation is `[contract-spread] domain/src/runtime/llm-evidence/target/tests/override.test.ts`. That file is not mine and is changed in this tree by someone else. Before my changes the audit already failed on it, plus an `imports` finding in the same file.
  - Two violations of my own (two classes in `fake-page.ts`, two statements on one line in `results.test.ts`) were fixed before this run.
- `node scripts/test-content.mjs -- tests/reveal-by-scroll --workers=1`:
  - The first run hit an esbuild failure because Core's dist was missing (the same rebuild as above).
  - After the rebuild: `1 passed`.
  - Run again with a temporary log line (since removed), the first click returned `succeeded the point 640,361 landed on the target; the execution recovered on attempt 4 after absorbing obstructed_target, obstructed_target, obstructed_target, scrolling 3 times toward where the target would be, which revealed it, waiting 2800 ms` → `1 passed`.
- **Reveal disabled** (default `reveal` temporarily set to always answer false, then restored and re-verified):
  - The spec failed with `failed ... web.target.not_shown hidden: the element's display is none; the execution did not recover within its 4 attempts after absorbing obstructed_target, obstructed_target, obstructed_target, obstructed_target, waiting 1350 ms`.
  - That is the live failure exactly.
- Line endings: my Python edits had written CRLF into four files. I normalised all files I touched back to LF; `git diff --stat` shows only my real changes.

## Not verified

- **No live Lab run.** The company-website run in bf-slot-4 (`run-mvd8mcu6-64486b87`) failed before any step with "Intended Core runtime build is missing, stale or differs from reached contracts; provider dispatch refused". That is the same Core dist rebuild, so its `steps/` folder is empty and I could not read how the model saw the button. The earlier finished run there is job-board.
- **Firefox and the real extension were not exercised.** The harness runs headless Chromium.
- **No whole-repository suites were run**, per the rules.
- **Speed on slower pages:** the ladder is tuned to a loader that answers within about 0.5 s per batch. A slower one still ends at the same four attempts and reports "which did not reveal it".
- **Not covered:** the `opacity`/`visibility` scroll-to-self branch is covered by unit rows only, not by the harness. `clear.ts` and `keypress.ts` are covered too, since they pass `target` with `hidden`, but no test exercises them with the reveal.

## Open questions or contradictions found

- **The model's view of a display:none control (domain, no change made):**
  - The ordinary page view leaves it out entirely: the snapshot skips undisplayed elements, and `webLlmViewTraits` treats `hidden: true` as not visible.
  - `find_on_page` captures hidden elements as well and prints them as an ordinary match line: `<handle> button "Show more people" not rendered`. Its tool description says "its handle (copy it exactly to act on it)". So the control is offered as pressable, and the only warning is "not rendered".
  - **Proposal**, in `page-view/element/where.ts` and the `find_on_page` description in `harness-options/options.ts`:
    - print `not shown yet` instead of `not rendered`;
    - add to the description: "a match not shown yet is still in the page; acting on it scrolls toward where it would be and waits, but if the page only shows it once something else is opened, open that first".
  - I did not change domain code, as instructed.
- **Two kinds of hidden target are still out of reach:** a `hidden` refusal that comes with a dialog over the page is reported as BLOCKED_BY_DIALOG and is not scrolled for. Content that only lazy-loads when it is near the top of a page is not handled either, because the reveal scrolls only to an end.
