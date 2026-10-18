# lane4-w1-icon-controls (live-lane-4, t567)

## Outcome

Done. The cause was in the extension's capture, with a second, smaller gap in the domain's rendering. No Core change.

- **Cause (capture).** `apps/extension/src/content/evidence/press-cursor.ts` counted a cursor as the element's own only when its parent's computed cursor was different. On the job-board results page the result card (`article`) has `cursor:pointer`, so the save control (a span the page also styles with `cursor:pointer`) computes the same pointer as its parent. It was read as inheriting it and carried no `cursor`. The span has no text, name, role, tabindex or listener of its own, because the page listens on the document. So the domain saw a plain wordless span: it got no line, and nothing around it counted as a control (the card holds a link, so it is a delegate). The 0046 view shows this: handles t99-t102 between `t98 h2 link` and `t103 "Verity Legal Tech"` print nothing.
- **Fix.** When the parent shows the same cursor, the capture now checks the page's own styles. If the element's inline style, or a style rule of its document or shadow root that declares that cursor, matches the element, the cursor is its own (new `evidence/declared-cursor.ts`). The rules this skips:
  - a rule whose subject is `*` (`.card *`), because it gives every descendant the cursor;
  - stylesheets from another origin, which cannot be read;
  - `@media` and `@supports` blocks that do not apply right now.
  It also handles nested rules and `@import`. The rule list is built once per tree per capture and cleared on the next microtask.
- **Rendering.** A control with no words now prints the best description the page gives, in this order: name (aria-label, title or alt, as before); its `title` attribute; the new tooltip attributes `data-tooltip`, `data-tip`, `data-title` and `aria-description`; the `<title>` of an inline `<svg>` inside it (the capture now names an svg by its `<title>` child, and rule 5 reads that like an image alt). If none of those exist, it prints generic markers: `icon` when it is or holds a picture (svg, img, picture, canvas, i, use, or role=img), the class tokens of the control and everything under it as `class="..."`, and `use="#symbol"` for `<svg><use>`. On the evidence fragment the line is `tN clickable icon class="<hashed class>"`, inside the card's lines, right after the h2 link.
- **Click path.** Once the span has its cursor it is a control. `webLlmPressableTargets` includes it, and a candidate's press resolves to the span's own selector (new test). Without the cursor the handle was never shown, so a press on it was refused `web.handle.unknown`. The extension's click runtime has no gate that refuses a span: its actionability checks are only disabled and covered.
- **Regression found and fixed on the way.** In the harness, a press-listener greeting bubble holding a close cross (auction-marketplace, company-website start pages) became a delegate, because the cross's like cursor is now reported. That took the bubble off the view as a control. `line/control-holders.ts` now ignores a control drawn only by a cursor equal to the nearest cursor around it when deciding delegates, so both get control lines. A `not-allowed` option inside a pointer picker still makes the picker a delegate, as before.

## What changed and why

Extension (capture):
- `apps/extension/src/content/evidence/declared-cursor.ts` (new): `declaresCursor(element, cursor)`, which checks whether the page's own styles set this cursor on the element.
- `apps/extension/src/content/evidence/press-cursor.ts`: when the parent shows the same cursor, asks `declaresCursor` before calling the cursor inherited.
- `apps/extension/src/content/identity/accessible-name.ts`: an `<svg>` is named by its own `<title>` child, after `title`/`alt` and before placeholder. This also feeds the fingerprint's `accessibleName`, but only for svgs that have a `<title>`.
- Tests: `evidence/tests/declared-cursor.test.ts` (new, 5 tests); `identity/tests/accessible-name.test.ts` (+1 test).
- Harness: `e2e/content/tests/evidence/tests/icon-controls.spec.ts` (new). On the job-board results page, every wordless element inside a card that holds an svg child and computes a pointer must have a `tN clickable icon class=...` line. It finds the elements without reading any class name. `page-view-controls.spec.ts`: the crossborder magnifier's line regex now allows the new `icon`/`class=`/`use=` tokens.

Domain (rendering):
- `page-view/element/icon-hints.ts` (new): `webLlmIconHints(control, insides)`, exported from `element/index.ts`.
- `page-view/element/words.ts`: tooltip attributes added as a control's fallback words.
- `page-view/line/choice.ts`: rule 5 also takes an inline svg's name; new rule 5a attaches icon hints to a wordless control line; shared `visibleInsides` helper.
- `page-view/view-line.ts`: `icon?: readonly string[]`. `line/render.ts` prints the hints after the kind, before the state tokens. `line/facts.ts` puts them first in `tokens`, so a page-change comparison sees them as the view prints them.
- `page-view/line/control-holders.ts`: the like-cursor delegate rule described above.
- Tests: `page-view/tests/icon-controls.test.ts` (new, 6 tests). The first is the raw evidence-shaped capture (li > article[cursor] > div > h2 > a, then span[cursor] > svg > path, then the company div) run through the sanitizer into the published page. It asserts `t7 clickable icon class="k3x fav"` between the h2 link and the company line, and the line fact. `plan-resolution/tests/press-control.test.ts` (+2 tests, appended): a press resolves to the icon's selector, and without the cursor the handle is `web.handle.unknown`. `page-view/tests/line-rules.test.ts`: in the rule 5 expectation, `t5 clickable` (a pointer div holding an svg) becomes `t5 clickable icon`.

No guidance text, example or test string mentions hearts, saving, jobs, Rolefinch or any scenario's task. The harness spec targets the job-board page and finds the icons by structure only.

## Commands run and observed results

- `DOMAIN_TEST_BUILD_LABEL=lane4-w1 node scripts/test-domain.mjs runtime/llm-evidence` (in domain): `# tests 1153`, `# pass 1153`, `# fail 0`.
- `DOMAIN_TEST_BUILD_LABEL=lane4-w1 node scripts/test-domain.mjs page-view plan-resolution`: `# tests 320`, `# pass 320`, `# fail 0`.
- `EXTENSION_TEST_BUILD_LABEL=lane4-w1 node scripts/test-extension.mjs content/evidence/tests content/identity/tests` (in apps/extension): `# tests 187`, `# pass 187`, `# fail 0`.
- `npx tsc -p tsconfig.test.json` in domain and apps/extension (tests included, no emit): both exit 0, no output.
- `node scripts/structure-audit.mjs`: `structure-audit: passed (204 warning(s), 638 baselined).` The first runs failed on `as never` casts, a cross-directory import, a `catch` that returned `[]`, and the 25-file limit of `plan-resolution/tests`; all four were fixed (the press tests went into `press-control.test.ts`).
- Content harness (headless Chromium, its own `.harness-build`; no extension `dist` or `build` written):
  - `node scripts/test-content.mjs -- icon-controls.spec.ts --workers=1`: `1 passed`.
  - The same spec with the declared-cursor branch disabled on purpose (then restored): `1 failed`, `Received has value: undefined`, meaning no line for the icon. The oracle catches the original defect.
  - `node scripts/test-content.mjs -- tests/evidence/tests --workers=4` after the control-holders fix: `57 passed`, `2 failed`. The two failures are `page-evidence.spec.ts` "product-catalog: element totals and truncation" (`Expected: > 99, Received: 99`) and `snapshot-items.spec.ts` "basic-form: relevant attributes" (an extra `required` attribute). Both also fail with my two capture changes disabled (`2 failed` in that run), so they predate this work and are unrelated.
  - Before the control-holders fix, `page-view-controls.spec.ts` failed on the auction-marketplace and company-website start pages (greeting bubble). With my capture change disabled those two passed (`2 passed`), which confirmed the regression. After the fix they pass inside the 57.

## Not verified

- No live Lab run, and no loaded-extension browser test. The harness runs the real content-script bundle and domain source in Chromium, but no click was dispatched on the icon and no build was run end to end.
- The save-time identity floor on the real control (see the first open question). This is from reading the code only.
- Full package suites were not run, as the brief says. Domain tests outside `runtime/llm-evidence` were not run; other runtime code that reads page text could carry expectations of `tN clickable` without the new tokens.
- Performance of reading the style rules on very large stylesheets was not measured. It happens at most once per tree per capture, and only for elements whose parent computes the same cursor.

## Open questions or contradictions found

1. **The next blocker is the save-time identity floor, not the view.** The real save control is `<span class="<one hashed class>">` with no words, id, test id, name or role. `element-fingerprint/signals.ts` counts "kind" only (one class on a bare tag is not a signal, t442 F5). So a candidate step that presses it would be refused `web.handle.unidentifiable` at save, even though exploration can now see it and press it (exploration's own presses are not judged). My press test uses a two-class icon so the resolution path can be shown. Fixing this needs a new identity signal for wordless icons, for example the drawing itself (svg path `d` / `viewBox` / `use` href / img `src`), or the row-relative identity the record context already carries. That design spans the fingerprint type, `signals.ts`, the extension's identity scorer and element finder, and maybe Core's `ElementFingerprint`. It also touches the user's every-element-full-fingerprint rule, so it is the supervisor's decision; I did not make it.
2. The model's format guidance (`system-instructions/instructions.ts`, "Reading the page view") does not mention the new `icon`, `class="..."` and `use="..."` tokens. It was outside my brief. A generic sentence, with no scenario example, would help.
3. Facts now include icon hints, so a press that only toggles a class on an icon (where the class is not dropped as a set-apart state) shows up as a changed line. That is probably what we want for detecting a press's effect, but nobody has observed it live.
4. The two harness failures above (`product-catalog` totals, `basic-form` attributes allowlist) are stale and predate this work.
