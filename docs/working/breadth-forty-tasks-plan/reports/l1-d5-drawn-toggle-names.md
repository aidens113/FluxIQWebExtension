# l1-d5 drawn toggle names: worker report

## Outcome

Done. An icon-only control is now named by the svg it draws, so the photo-social Like control reads "Like" in one state and "Unlike" in the other. In the domain, a control with no name falls back to the words the page view prints for it. All named tests pass, except for 8 domain failures that come from another worker's uncommitted change (see Open questions). The four typechecks exit 0 and the structure audit passes.

## What changed and why

1. `apps/extension/src/content/identity/accessible-name.ts` is the module that computes `accessibleName`. `shared/dom-element.ts` only holds the descriptor type, so I did not edit it.
   - Name from content now uses an embedded `<svg>`'s own name in place of the svg, which is how accessible-name computation treats an embedded graphic. That name is `accessibleNameFor(svg)`, following the module's existing order (aria-labelledby, aria-label, label, title/alt, `<title>` child). So `aria-label` wins over the `<title>` text.
   - An svg marked `aria-hidden="true"` gives nothing, and neither does an svg inside an element marked that way within the named element. This includes its `<title>` text, which the old `textContent` path used to pick up.
   - Content with no svg reads exactly as before, through `textOutsideSensitiveControls`.
   - Content with an svg is walked. Children without an svg still go through the shared reader, a sensitive control's subtree is skipped, and an element inside a sensitive control gets no name.
   - `holdsDrawing` reads `children?.length ?? 0`, so a test stand-in element with no `children` holds no drawing. The first run failed 8 `resolve-target` twin tests because their `TwinButton` fake has no `children`. I changed the production code rather than the fake, following the same tolerance `sensitive-text.ts` has for `childNodes`.
   - Checked against the fixture's real markup: `glyph(...)` emits `<div role="button" tabindex="0"><svg aria-label="Like" role="img" ...><path/></svg></div>`, and `setIconLabel` rewrites the svg's `aria-label`. The div has role=button, takes its name from content, and has no authored name, so its name is "Like" before the press and "Unlike" after. The same applies to Save/Remove, Comment, Share Post, More options and the carousel's Next/Go back. This was traced through the code, not run in a browser.
2. `domain/src/runtime/llm-evidence/control-spot/state.ts`:
   - When `name` is empty or absent, the name part of the state token is `webLlmElementWords(element)`, the page view's own word function. With no words it is still `null`.
   - The signature is now `WebLlmEvidenceElement` instead of a `Pick`. Both callers (`states.ts`, `target.ts`) already pass a full element.
   - The count rule is unchanged: controls with no words at one place share one state and are counted together.
   - Importing `../page-view` from control-spot creates no cycle, since page-view imports nothing from control-spot.
3. Tests.
   - `apps/extension/src/content/identity/tests/accessible-name.test.ts`: two new tests with generic bookmark, menu and cart fixtures. They cover a labelled svg, a titled svg, aria-label over title, a hidden svg, a hidden labelled svg, an svg inside an aria-hidden wrapper, mixed svg and words, a hidden svg beside words, a container that takes no name, and the sensitive-control cases. I put them beside the module that owns the code, as the repository's test-placement rule requires, not in `shared/tests` as the brief said.
   - `domain/src/runtime/llm-evidence/control-spot/tests/controls.test.ts`: two new tests. The first shows an icon-only toggle's two names give two state tokens at one place. The second covers the tooltip-only fallback: the two states differ, the fallback words give the same token as an equal name, and two controls with no words count `[2]` at one place. I confirmed the fallback test fails when the fallback is removed (5 pass, 1 fail), then restored the code.
   - Blast radius: no existing expectation pinned a missing name. No test was changed.

## Commands run and observed results

- `EXTENSION_TEST_BUILD_LABEL=l1d5 node scripts/test-extension.mjs src/content/identity/tests src/content/action-runtime/tests src/content/tests src/shared/tests src/background/connection/tests`
  - First run: 670 tests, 662 pass, 8 fail. All 8 were the resolve-target twin and look-alike tests, failing on the missing `children` on the fake.
  - After the fix: exit 0, 670 tests, 670 pass, 0 fail.
- Extra tests that build svg elements: `... test-extension.mjs src/content/action-runtime/interference/tests src/content/extraction/tests/badge-column.test.ts src/content/activity-overlay/tests/status-pill.test.ts` exits 0, 85 tests, 85 pass.
- `DOMAIN_TEST_BUILD_LABEL=l1d5 node scripts/test-domain.mjs src/runtime/llm-evidence/control-spot/tests/controls.test.ts`: 6 pass, 0 fail.
- `DOMAIN_TEST_BUILD_LABEL=l1d5 node scripts/test-domain.mjs src/runtime/llm-evidence src/runtime/state-diff`: exit 1, 1229 tests, 1221 pass, 8 fail.
  - All 8 are in `state-digest/tests/call-state-digests.test.ts` (7) and `state-digest/tests/state-digest.test.ts` (1).
  - Each one asserts the regex `/^web-state\.v6:/` and gets `web-state.v7:...`.
  - The version bump is in the uncommitted `domain/src/runtime/llm-evidence/state-digest/state-digest.ts` diff, labelled "t724 L1, listWayOn". That diff is not mine, and those tests are outside my ownership.
- `npx tsc -p domain/tsconfig.json --noEmit` exits 0, as do `domain/tsconfig.test.json`, `apps/extension/tsconfig.json` and `apps/extension/tsconfig.test.json`.
- `node scripts/structure-audit.mjs` exits 0 and prints "structure-audit: passed (212 warning(s), 638 baselined)". None of the warnings are on my files.

## Not verified

- Live browser behaviour. Playwright was not run, as the brief instructed, and there is no DOM library in the repository to parse the real fixture markup. The Like/Unlike names were traced from the fixture's code, not observed. The lead's browser proof should confirm two state tokens at the like control's place.
- Playwright and content-harness specs (`apps/extension/e2e/**`) that may pin names were not run.
- Core's fingerprint tests were not run, because Core was not touched or rebuilt.

## Open questions or contradictions found

- The 8 domain failures come from another worker's uncommitted `web-state.v7` bump, whose tests still expect `v6`. Its owner, or the lead, needs to update `state-digest/tests/call-state-digests.test.ts` (lines 246, 349, 350, 353 and others) and `state-digest/tests/state-digest.test.ts:35`.
- Wider name changes, as accessible-name computation intends:
  - A heading or link holding a labelled icon now includes the icon's label, for example `<h3><a>author</a><svg aria-label="Verified"></h3>` becomes "author Verified".
  - An icon labelled the same as the words beside it gives doubled words ("Home Home"). The page view's rule W1 (`undoubledWords`) prints those once, but the identity name keeps the double.
  - Recordings made before this change carry the old name for such elements, so name-based matching against them weakens until they are re-recorded.
- `aria-hidden` is respected only for svgs (on the svg itself or an ancestor within the named element), as the brief asked. Ordinary text inside an `aria-hidden` span is still read as before.
- `control-spot/state.ts` and `controls.test.ts` were untracked when I began, part of another in-flight change. I edited them in place.
