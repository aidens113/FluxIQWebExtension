# Report: w2-click

Worker: `w2-click`. Brief: `### Brief: w2-click` in [briefs/wave-2.md](../briefs/wave-2.md),
coding against [reports/w2-foundation.md](./w2-foundation.md).

## Outcome

**Done.** The actionability capability is implemented, `click.ts` gates on it and
clicks with a pointer and mouse sequence at the hit-tested point, and a new
`click.spec.ts` proves all of it on `basic-form` and `failure-surfaces`. Every
gate in the definition of done passes; the one unrelated failure left in the
tree belongs to another worker and is named below.

No file outside my owns list was touched. No commit, no push, no `pnpm build`,
no `pnpm lab`.

## What changed and why

### `content/action-runtime/actionability.ts` — the capability (was a throwing stub)

`checkActionability(element)` returns the `ActionabilityReport` w2-foundation
declared; the exported type is unchanged, so no other worker's code moved.

The gate runs **visible, then enabled, then reachable**, and reports the first
reason found. That order is not cosmetic: it is the order in which a reason
stops being knowable. An element with no box has no point to hit-test, and a
disabled one is refused whether or not something covers it — so the first
failure found is always the most fundamental one.

- **Visible** — inert ancestor, `display: none`, any `visibility` other than
  `visible`, `opacity: 0`, a zero-size box, then `checkVisibility()` as the
  backstop. The specific checks come first so the refusal names the property
  that hid the element; the browser's own check is last because it catches what
  no single computed style reveals (ancestors, `content-visibility`) but cannot
  say why. It is read through a defensive cast, not the DOM lib type, since not
  every engine implements it.
- **Enabled** — `:disabled` (which carries the whole HTML rule, a disabled
  `<fieldset>`'s descendants included), then `aria-disabled` on the element
  **or an ancestor**, because a composite widget marks itself disabled while
  the press lands on a child.
- **Reachable** — scroll into view, then hit-test the centre. The point is the
  centre of the part of the element **inside the viewport**: an element taller
  than the screen has a true centre that is off-screen, where
  `elementFromPoint` answers nothing at all. The hit must be the element or
  something inside it; `isWithin` walks shadow boundaries, which
  `Node.contains` does not, and `topmostAt` descends through shadow roots so a
  custom element reports its own content rather than its host.

**The scroll happens inside the capability**, not in the caller. A caller that
scrolls separately and then hit-tests is one layout change away from clicking a
point it never tested. `deps.scrollElementIntoView` stays on the dependency list
for other verbs (`scroll`'s `toElement` mode), but `click.ts` no longer calls it
— worth knowing for any other worker who calls `checkActionability`, since it
now scrolls as a side effect.

### `content/actions/click.ts` — the verb

1. Resolve the target, then `deps.checkActionability`. A refusal returns
   `deps.rejected(..., report.code, "a target that can be clicked", report.detail)`,
   so the code becomes `web.action.{disabled,hidden,covered}` under Core's
   `blocked_by_capability_or_policy`. **Not one event is dispatched** on that
   path, which the spec asserts directly.
2. Otherwise dispatch the sequence a real press makes, at the hit-tested point:
   `pointerover, pointerenter, mouseover, mouseenter, pointermove, mousemove,
   pointerdown, mousedown, (focus), pointerup, mouseup, click`. The enter pair
   neither bubbles nor can be cancelled, matching the real events. The focus
   move is skipped when the page cancels `mousedown`, as the browser does, and
   uses `preventScroll` so it cannot move the page after the hit test and leave
   the remaining events pointing at a stale position. `HTMLElement.click()`
   fires none of this, so a page that opens its menu on `pointerdown` never saw
   a click at all.
3. Events carry the element's **own** window as `view`, so a click inside a
   child frame is dispatched in that frame.

**The post-condition.** For an ordinary target it is the hit test, as the brief
specifies: `expected` "the click lands on the target or something inside it",
`actual` the report's detail ("the point 640,318 landed on the target"). A page
cancelling the default action is recorded in the text but is **not** a failure —
handling a click in script is ordinary.

A link is held to more, because a link states where it goes: the click must
begin that navigation. A same-document navigation has already happened when the
gesture returns, so the changed location is the observation; a cross-document
one has only been *started*, which is all this frame can see before it is torn
down, so the claim made is that it began. Only a click that was cancelled **and**
moved nothing fails — reported as `output_not_observed`. That is the silent
no-op the plan exists to catch, and the spec proves it.

I kept the success message `"Element clicked."` deliberately: `actions.spec.ts`
and `resolve-target.spec.ts` assert it and belong to no Wave 2 worker, so
changing it would have broken two shared specs for no gain.

### `content/action-runtime/scroll-element-into-view.ts`

Behaviour unchanged (centre, `behavior: "instant"`); the reasoning is now
written down, because both choices are load-bearing for the hit test. Centring
rather than scrolling the shortest distance matters because sticky headers and
footers overlap the viewport edges — an element scrolled *just* into view is
exactly the one found covered. `instant` matters because a smooth scroll returns
before the scrolling finishes, so the hit test would measure geometry the page
had on the way there.

### `e2e/content/tests/click.spec.ts` — new, 10 rows

The reply alone cannot tell a real click from `HTMLElement.click()` — both say
"succeeded" — so the page is the oracle throughout. On `basic-form`: the full
event sequence and that every event is untrusted; that the click's `clientX/Y`
equals the element's centre **read inside the listener**, so no later layout
change can make them disagree for a reason the verb is not responsible for; the
validation and a real form submission proven against the Scenario Lab's own
state; that a recording session records none of the gesture (it is untrusted —
and `dom-events.ts` does listen to `pointerdown`, so the richer gesture had to
be checked against the recorder); and the two link rows.

On `failure-surfaces`: disabled, covered, and hidden refusals, each asserting
the **page** as well as the reply — the covered row asserts the button is still
there, since without the gate that click would have removed it. The last row is
a control: remove the overlay, click the same element, and it succeeds and
detaches. Without it the suite could not tell a working gate from one that
refuses everything.

The fixtures are untouched: the overlay and the links are injected by the spec,
so no scenario owned by another worker changed.

## Commands run and observed results

From `F:\!FluxIQWebExtension`, every exit status captured by redirecting to a
file and echoing `$?`, never through a pipe. Label `w2-click` throughout.

| Command | Observed |
| --- | --- |
| `pnpm --filter …/extension check` | **exit 0**, clean |
| `EXTENSION_TEST_BUILD_LABEL=w2-click pnpm --filter …/extension test` | **exit 0** — `# tests 80 / # pass 80 / # fail 0` |
| `EXTENSION_TEST_BUILD_LABEL=w2-click pnpm --filter …/extension test:content` | exit 1 — **`106 passed, 1 failed`**; all **10** `click.spec.ts` rows `ok`; the one failure is `identity.spec.ts:97` (`w2-identity-capture`) |
| `node scripts/structure-audit.mjs` (scratch git index) | **exit 0** — `passed (31 warning(s), 19 baselined)` |

Baseline before my change, for comparison: `test:content` **40 passed, exit 0**
(taken at dispatch, before the other workers' specs landed); audit
`passed (31 warning(s), 19 baselined)` — my new file added **no** warning, and
`pnpm structure:baseline` was **not** run. The audit reads only tracked files,
so it was run with `GIT_INDEX_FILE` pointing at a copy of `.git/index` with
`click.spec.ts` added via `git add -N`; the repository's own index was never
written.

**Parallel-edit failures I reran rather than reported** (the brief's rule, and
all three were other workers' files):

- Run 1 — 92 passed, 3 failed: `actions.spec.ts` `type` and `keypress`
  (`w2-keyboard-input` changed the behaviour without updating that shared spec)
  and `upload-dialog.spec.ts` (`w2-upload-dialog`). All cleared by run 3.
- Run 2 — **no test executed at all**: esbuild rejected the content bundle with
  `The symbol "role" has already been declared` at
  `src/content/describe-element.ts:68` (`w2-identity-capture`, mid-edit). Also
  the cause of the `check` failures I saw at the time. Cleared by run 3/4.
- An earlier `check` also failed on `file-input.ts`
  (`Uint8Array` → `BlobPart`, `w2-upload-dialog`); cleared without my action.

No error in any run named a file I own.

## Not verified

- **No live browser validation.** `test:content` runs the real content bundle in
  headless Chromium, which is genuine DOM behaviour, but nothing loaded the
  unpacked extension in a headed browser. The brief forbade `pnpm lab`, so the
  verb was never exercised through the background worker, the gateway, or a
  Flow — only through the harness's `executeAction` message.
- **`pnpm build` was not run** (forbidden for parallel workers), so the tracked
  `build/` directory does not contain this change. The supervisor's integration
  build is the first time it will.
- **Domain `check`/`test` were not run** — I changed no domain file.
- **Implemented but not covered by a spec row:** shadow-root piercing in
  `topmostAt` and `isWithin`; the `inert` branch; the `aria-disabled`
  *ancestor* branch; the clamped hit point for an element larger than the
  viewport; the `checkVisibility` backstop; `opacity: 0`; and the child-frame
  `view` on the dispatched events. Each is reasoned from the DOM contract, not
  observed. The three codes and the ordinary paths are covered.
- **The cross-document link path is not exercised.** Both link rows use a
  fragment, deliberately: a real navigation tears down the execution context
  mid-`evaluate` and makes the row flaky. So the `"navigation … was initiated"`
  branch of `navigationValidation` is untested; only the
  `"the page navigated to …"` and the failure branch are.
- **`identity.spec.ts:97` fails** in the shared tree. It is
  `w2-identity-capture`'s own new spec; I did not investigate or touch it.

## Open questions or contradictions found

1. **Where the pointer gesture lives.** `actions/types.ts` says a verb never
   touches the DOM except through a supplied capability, but `click.ts` now
   constructs and dispatches the event sequence itself. I kept it there because
   a new `action-runtime/` module would mean editing `execute-action.ts` **and**
   `actions/types.ts` — two files I do not own that all thirteen Wave 2 workers
   share, which is exactly the conflict the file partition exists to prevent.
   It also keeps "what a click is" in one reviewable place, and the verb already
   called `HTMLElement.click()` directly. The events act only on the element and
   the point the capabilities supplied, and take their `view` from the element's
   own document, so no page global is reached for. **If the supervisor prefers
   the strict reading, this moves to a `pointer-gesture` capability in one
   commit** — but it needs the wiring files, so it cannot be done concurrently.
2. **The prevented-link rule can misjudge an SPA router.** A click that is
   cancelled and leaves the location unchanged is reported as
   `output_not_observed`. A single-page router that cancels the click and then
   navigates *asynchronously* (a microtask or a later `pushState`) would be
   judged a dead link, because the verb returns synchronously. Making this exact
   needs the verb to be async, which `execute.ts` does not `await` for click —
   a returned promise would settle after the try block exits and its rejection
   would escape the catch that produces `TARGET_NOT_FOUND`. Flagging rather than
   fixing: it needs `execute.ts`, which I do not own. No fixture exercises it
   today.
3. **The non-link post-condition always passes once the gate passed.** It
   records the hit test, which is what the brief specifies, but it is weaker
   than "the click had an effect" — the effect is verb-independent and belongs
   to a following `assert`. Worth stating plainly so the validation coverage
   numbers are not read as stronger than they are.
4. **`actions.spec.ts` is shared and unowned.** Two Wave 2 workers changed verb
   behaviour it asserts and broke it mid-wave (seen in run 1, since fixed). It
   pins eleven verbs' behaviour and every verb worker is told to change it; it
   has no owner in the brief partition. Worth assigning it explicitly in a
   later wave, or splitting it per verb.
