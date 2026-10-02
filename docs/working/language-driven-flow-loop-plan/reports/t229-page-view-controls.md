# t229: the compact page view hides a site's search box and every button

## Outcome

Done. Nothing is committed: the supervisor commits.

- I added a guard: `apps/extension/e2e/content/tests/evidence/tests/page-view-controls.spec.ts`.
  - On the code as it was, it failed 12 of 12 tests.
  - On the code now, it passes 12 of 12. It ran headed, with one or two workers.
- It covers the ten realistic scenarios' start pages and the crossborder item page. Every visible element a person can operate must:
  - have a line of its own, and that line must be a control line, not plain text;
  - carry its name, not a glyph and not a bare placeholder;
  - show its state;
  - be marked `field[search]` if it is a search box.

## Root causes and what changed

1. **Controls built from `<div>`s were invisible to the capture.**
   - Crossborder builds every control as a styled `<div>` and binds it with `addEventListener`. Examples are the search magnifier, the consent answers, the option chips and the swatches.
   - Professional-network's "Not now" works the same way and has no pointer cursor at all.
   - The extension's `hasClickHandler` saw only an `onclick` attribute. The isolated content script cannot see a listener the page adds in its own world.
   - The result: these elements showed as plain text, or, with no words, did not show at all. The page had no `<button>` elements, so "zero button lines" came from this.
   - **Fix: a press probe.**
     - `page-world/press-listeners.ts` runs in the page's world at document start. It wraps `addEventListener` and the `onclick` setter, and remembers which elements get press listeners. It writes nothing to the page.
     - `content/page-press.ts` asks about one element by dispatching a cancelable event, `fluxiq:press-probe` (defined in `shared/press-probe-event.ts`).
     - `describe-element.ts` sets `hasClickHandler` from the probe's answer.
   - **Fix: a cursor fact.** `content/evidence/press-cursor.ts` adds a new snapshot field, `cursor`: the element's own `pointer` or `not-allowed`, recorded only where its parent's cursor differs.
   - **Domain:**
     - `traits.ts` and `kind.ts` print such an element as `clickable`.
     - A `not-allowed` cursor adds the `disabled` token.
   - **The delegate rule** (`line-choice.ts`): an element that is a control only through a listener or a cursor, and that contains another control, gets a text line instead of a control line. Without this, a feed `<ul>` that listens for its buttons' clicks would become one control line holding the whole feed.
   - **Own words only:** a control drawn this way prints its own words, not every word under it. A closed flyout's text no longer leaks into the line.
2. **The search box had no search identity, and its placeholder was used as its name.**
   - `kind.ts` now prints `field[search]` for:
     - type `search`;
     - role `searchbox`;
     - a field inside a `search` landmark;
     - a field in a form whose action is a search. This comes from a new `searchForm` flag, set in sanitize from `context.formAction`.
     - a field whose name or id is `q` or `search`.
   - Sanitize sets a new `placeholderName` flag when a field's name is only its placeholder.
   - `words.ts` never prints a placeholder as the field's words.
   - `state-tokens.ts` prints the placeholder as `placeholder "…"` whenever it differs from the line's words.
3. **The quantity box took its name from the "−" glyph.**
   - `identity/label.ts` `nearbyLabel` now skips a neighbour that is a control, and skips text that has no letter or digit.
   - It also looks before the field's wrappers, up to two levels, as long as each wrapper holds no other field. That finds "Quantity".
4. **Chosen state.**
   - New tokens: `selected` (`aria-selected`), `pressed` (`aria-pressed`) and `current` (`aria-current`), plus `marked`.
   - `marked` comes from a new snapshot field, `setApart` (`content/evidence/set-apart.ts`). It is set on the one member of a run of like siblings that carries a class few of the others carry. Siblings with a `not-allowed` cursor are left out of the run.
   - Crossborder marks the chosen chip with a class only, so this is the only signal available there.
5. **Swatches and other controls that are only an image.**
   - The swatch now gets its name from its `title`, now that it is a control.
   - Rule 5 in `line-choice.ts`: a control with no words takes its words from the alt text of the images inside it.
   - The image rule takes that name back only when a neighbouring line already says all of it. So "lena.moss's profile picture" stays on its link.
6. **A visible element was dropped because it had the `hidden` attribute.**
   - Company-website's chat launcher sets `hidden`, but its CSS class still draws it.
   - `rendered-elements.ts` now goes by the computed `display`, not the attribute.
7. **F1, which folds a child's words into its parent's line, now applies only when the parent line actually shows those words.**
   - Words under a control that prints no words no longer fold away.

Housekeeping:

- The wire fields `cursor` and `setApart` are added to `UnwiredElementField` (`shared/dom-element.ts`).
- The four new domain fields are named in `state-digest.ts` and `look-alikes.ts` (omitted from both, with reasons).
- `sanitizeWebLlmSnapshotWithBindings` is exported from the domain. The guard needs it to map handles to elements.
- `inExtensionWorld` moved into `page-world/extension-world.ts`.
- The test parser `shown-page-lines.ts` now knows `field[search]`.

## The crossborder home lines, before and after

Before, from the live dump (`build-2026-10-02T00-00-07-573Z-26504.jsonl`):

- 237 elements, with no `button` or `clickable` line.
- `t489 field "Autumn Mega Sale: up to 70% off" =""`
- The magnifier had no line. "Ship to 🇩🇪 Germany / EUR" was a text line (`t14 "Ship to 🇩🇪 Germany / EUR"`).

Before, from the content harness running the code as it was:

- `t8 field "Autumn Mega Sale: up to 70% off" ="" covered-by t476`
- `no line: t9 press listener <div class="css-1wvo6uy"><svg …` (the magnifier)

After, from the content harness, final run:

```text
t8 field[search] placeholder "Autumn Mega Sale: up to 70% off" ="" covered-by t476
t9 clickable covered-by t476
t14 clickable "Ship to 🇩🇪 Germany / EUR" covered-by t476
t15 clickable covered-by t476
t16 "Welcome back" covered-by t476
t471 clickable "Cookie policy" covered-by t476
t473 clickable "Manage choices" covered-by t476
t474 clickable "Reject non-essential" covered-by t476
t475 clickable "Accept all" covered-by t476
t478 clickable "×"
t487 clickable "Collect all"
t488 clickable "No thanks"
```

On the item page:

- The quantity box: before `t80 field "−" ="1"`, after `t80 field "Quantity" ="1"`.
- The swatch: before `no line: t69 … title="Grey"`, after `t69 clickable "Grey"`.
- The chip: before `no line: t75 … China`, after `t75 clickable "China"`.
- `t148 clickable "Buy now"` and `t149 clickable "Add to cart"`.

## Commands run and observed results

Heavy commands ran through `heavy.sh`. Domain and extension unit tests ran through a scratch esbuild plus `node --test` runner over the named directories. The runner has since been deleted.

- **Guard on the code as it was:**
  - `pnpm test:content -- page-view-controls --headed --workers=2` → 12 failed.
  - The failures: placeholder printed as the name; no `field[search]` on 9 search boxes; no line for the crossborder magnifier, the bigbox chat, the job-board bubble, the auction close and greeting, the crossborder swatch and chip, and the chat pill; "−" as the quantity box's name; image-only links without names; `current` not shown on 3 sites; company-website's chat launcher missing from the packet.
- **Guard on the code now:**
  - `pnpm test:content -- page-view-controls --headed --workers=2` → 12 passed.
  - It passed again with `--workers=1` in the final run (24 passed, 1 failed; the failure is listed below).
- **Domain tests:**
  - `page-view/**` and `llm-evidence/tests`: 256 of 256 passed.
  - With `page-find/**` and `node-run/**` added: 380 of 380 passed.
  - `state-digest/**`: passed, within a 162-test run.
  - `target/**`, `plan-resolution/**` and `route-state/**`: 116 of 116 passed.
- **Extension tests:**
  - `content/tests`, `content/identity/tests` and `content/evidence/tests`: 205 of 205 passed.
  - These include new tests for `press-cursor` and `set-apart`, a new label row and a new rendered-elements row.
- **Checks:**
  - `pnpm --filter @fluxiq-web-extension/domain check` → passed. The build cache did not stamp it, because Core changed while it ran.
  - `pnpm --filter @fluxiq-web-extension/extension check` → exit 0.
  - `node scripts/structure-audit.mjs` → passed (155 warnings, 118 baselined).
  - `domain/src/runtime/llm-evidence/elements.ts` is now 490 lines, past the 400-line advisory.
- **Related content specs:**
  - `"evidence/|dialog|identity|press-answers|actionability|shadow-roots|own-layer"` headed, 3 workers: 158 passed, 11 failed.
  - **Baseline:** I put the HEAD versions of my 8 modified extension source files back in place, ran the same failing spec files at 2 workers, then restored my versions. On HEAD, 5 of those failures also fail:
    - `actionability-gate` (checkbox behind scrim)
    - `dialog-refusal:96`
    - `dialog-refusal:77`
    - `page-evidence` (product-catalog totals)
    - `snapshot-items` (basic-form attributes)
  - **The remaining failures were timeouts:** `newPage` or `page.evaluate` timing out after 30 s, in different tests on each run.
    - With 1 worker, `dialog-dismissal`, `identity-resolution` and `identity-veto` passed 38 of 38.
    - With 1 worker, `page-view-words`, `sensitive-names` and `dialog-refusal` passed except `dialog-refusal:96`, which also fails on HEAD.

## Not verified

- A live Lab run, and the real extension loaded in Chrome or Firefox. The press probe has only run inside the content harness, where the content script shares the page's world. Two things are unproven:
  - that the probe's cancel crosses from the isolated world to the main world in a real extension;
  - that it works in Firefox.
  - In a browser without main-world support (before Chrome 111 or Firefox 128), the probe answers false and only the cursor fact remains.
- Whether my change contributes to the timeouts at 2 or 3 workers.
  - On HEAD at 2 workers, 82 tests produced no timeouts. With my changes, 3 of 51 tests timed out, all passing at 1 worker.
  - `newPage` itself cannot run content code. I did not measure the probe's cost per capture.
- Domain and extension full suites, and `pnpm build`.
- `marked` on a real picker with several options. The crossborder item I used has one colour and one origin. On the item page it showed only on the notification card's "Allow" (`t204 clickable "Allow" marked`).

## Open questions or contradictions found

- **Another agent is editing this checkout.** The brief says nobody else does, but `git status` shows changes I did not make in `packages/test-runner/**`, `packages/test-contracts/**`, `scripts/lab/live-campaign/lab-run/command.mjs` and `docs/architecture/testing-facility.md`, plus a `t230` report. I touched none of them.
- **`actionableEvidenceElement` (`domain/src/runtime/llm-evidence/elements.ts`)** decides whether a repair can target an element (`repairable-parameters.ts`). It still ignores `cursor`, so a repair onto a drawn `<div>` with a pointer cursor but no detected listener would be refused. I left it unchanged; the traits comment says it is a separate question.
- **`marked` is a fact about drawing, not about choice.**
  - A two-button card's primary button is marked ("Allow").
  - With a class-only site, nothing better is possible.
  - The supervisor may prefer to drop `marked` and rely on the label text beside a picker ("Color: Grey").
- **The architecture docs are not updated** for the new snapshot fields, the probe, the `field[search]`, `placeholder`, `selected`, `pressed`, `current` and `marked` tokens, or the new kind. AGENTS.md calls for this. The brief did not name a doc I own.
- **The press watch never forgets a removed listener,** so its answer means "the page bound a press here".
