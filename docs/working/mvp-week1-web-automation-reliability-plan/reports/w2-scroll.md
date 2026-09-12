# Report: w2-scroll

Worker: `w2-scroll`. Brief: `### Brief: w2-scroll` in
[briefs/wave-2.md](../briefs/wave-2.md), against the contract in
[reports/w2-foundation.md](./w2-foundation.md).

## Outcome

**Done.** `web.dom.scroll` implements all three modes with a real
post-condition, and eight new T2 rows prove them on `infinite-feed` (baseline,
the `maxScrolls` cap, and the `end-early` variant) and `long-document`. No file
outside my owns list was touched.

Two checks are red for files I do not own; both were rerun as the concurrency
notes require and are unchanged. Detail in
[Commands](#commands-run-and-observed-results).

## What changed and why

### `apps/extension/src/content/actions/scroll.ts` (rewritten)

Before: one absolute `window.scrollTo` and `{status:"none", reason:"not-yet-validated"}`.

| Mode | What it does | Validation |
| --- | --- | --- |
| `by` | moves the window by the delta, **clamped** to what the document allows | `expected: "scroll position 0,600"` vs `actual: "scroll position 0,600, moved from 0,0"` |
| `toElement` | resolves the target, then `deps.scrollElementIntoView` | `expected: "the target within the viewport"` vs the target's rect and the viewport size |
| `untilStable` | scrolls to the current bottom (or by `y`) and waits for growth, repeatedly | `expected: "the document to stop growing within N scrolls"` vs stopped-after-K or still-growing |
| none (legacy) | absolute `options.x`/`options.y`, unchanged | same comparison as `by` |

Four decisions worth reviewing, because each one is a judgment the brief left open:

1. **A clamped scroll passes.** `expected` is the position the document
   *allows*, not the position requested, so scrolling past the end lands at the
   limit and validates `passed`. Comparing against the raw request would report
   `output_not_observed` for every scroll-to-the-end, which is the normal way to
   reach a page's foot.
2. **Hitting `maxScrolls` while the document is still growing is a `failed`
   validation** (`status: "failed"`, Core's `output_not_observed`), not a
   success. `untilStable`'s intent is "load everything"; a tripped guard means
   the content it was meant to load had not arrived, and a Flow that truncated a
   feed must not look like one that read all of it. A run that wants a bounded
   amount of scrolling asks for `by`, which carries no such expectation. **If
   the supervisor disagrees, this is the one line to change** — the cap branch
   in `scrollUntilStable`.
3. **`untilStable` with no `y` scrolls to the current bottom each pass**, rather
   than by a fixed step. That is what a lazy-loading feed's sentinel needs to
   see; a fractional-viewport step needs two or three passes per page and burns
   the cap on scrolling rather than loading. An explicit `y` still steps by that
   much — which is why the type has an optional `y`.
   A pass that adds no height ends the loop only if the window could not move
   either (`atBottom()`), so a tall static document is not mistaken for a
   settled feed after its first pass.
4. **`options.smooth` still works.** It is an authored parameter in
   `domain/src/actions/schemas.ts`, and a smooth scroll does not reach its
   position synchronously, so the verb polls for up to 1 s before reading the
   position back. Dropping the option would have been simpler but would have
   silently changed a registered behaviour that is `w2-domain-vocabulary`'s to
   decide on.

**The verb is now `async` and never rejects.** `untilStable` has to wait for a
lazy load, so the verb returns a promise; `actions/execute.ts` (which I do not
own) *returns* a verb's promise rather than awaiting it for everything except
the two waits, and its own comment says a rejection would then escape its catch.
So `scrollAction` wraps its whole body in a try/catch and reports through
`deps.failure(action, error, startedAt)` — byte-for-byte what that catch does.
Proven by the unresolvable-target row, which reports
`No target resolved from selector [data-testid="missing"].` with `status: "failed"`.
**Every other async verb in this wave has the same obligation**; whoever next
owns `execute.ts` should add `await` to those `return`s and remove the hazard.

### `apps/extension/e2e/content/tests/scroll.spec.ts` (new, 8 rows)

Five on `long-document` (delta, a second delta, past-the-end clamp, `toElement`
into view, an unresolvable target that moves nothing, and the legacy absolute
move) and three on `infinite-feed`:

- **all items**: `maxScrolls: 12` loads all 60 posts, the fixture's oracle reports
  `loadedCount: 60, ended: true`, and the validation is `passed`;
- **the cap**: `maxScrolls: 1` reports `failed` with
  `{category:"output_not_observed", code:"web.validation.output_not_observed", retryable:true, stage:"verification"}`
  and the feed is left at 20 posts;
- **`end-early`**: 25 posts, end-of-feed marker visible, page 4 absent.

The variant is armed through the Lab's authenticated `POST /api/infinite-feed/<op>`,
reading the operation and payload **from the scenario manifest** rather than
copying them, as `packages/test-runner`'s `armScenarioVariant` does. The harness
opens the page as it starts the Lab, so the spec arms and then re-opens the
fixture: the start document renders from the armed state. Nothing in
`e2e/content/` (owned by `w2-upload-dialog`) was edited to make that work.

## Commands run and observed results

All from `F:\!FluxIQWebExtension`, every exit status captured by redirecting to a
file and echoing `$?`, never through a pipe. No `pnpm build` and no `pnpm lab`.

| Command | Observed |
| --- | --- |
| `pnpm --filter …/extension test:content scroll.spec.ts` | **exit 0 — `8 passed (7.3s)`** |
| `EXTENSION_TEST_BUILD_LABEL=w2-scroll pnpm --filter …/extension test` | **exit 0 — `# tests 80 / # pass 80 / # fail 0`** |
| `GIT_INDEX_FILE=<scratch> node scripts/structure-audit.mjs` | **exit 0 — `passed (31 warning(s), 19 baselined)`** |
| `pnpm --filter …/extension test:content` (full suite) | exit 1 — `Running 95 tests`, **93 passed, 2 failed**, neither mine |
| `pnpm --filter …/extension check` | exit 2 — **one error, in a file I do not own** |

**The two full-suite failures are other workers' files**, both in flight right now:

- `actions.spec.ts:77 › type: sets the field's value and dispatches untrusted input and change` —
  that row pins the pre-Wave-2 untrusted-event behaviour that `w2-keyboard-input`
  is replacing (decision D5);
- `upload-dialog.spec.ts:27 › upload: puts the file on the input …` —
  `w2-upload-dialog`'s own new spec.

All **eight** of my rows pass inside that same full run, and so does the legacy
row I must not break: `actions.spec.ts:128 › scroll: moves the window to the
requested offset` (`ok 8 … (373ms)`) — it asserts `message: "Page scrolled."` and
`snapshot.viewport.scrollY: 60`, both preserved, and now additionally gets a
`passed` validation.

**`check`**: the first run reported two errors — `scroll.ts(125): Cannot find
name 'atBottom'` (mine: a helper I called and had not written; the two stability
rows failed with exactly that message through my own catch, which is how it was
found) and `file-input.ts(50): Uint8Array is not assignable to BlobPart`
(`w2-upload-dialog`'s). After fixing mine, the rerun **segfaulted**
(`Exit status 3221225477`, no diagnostics — the parallel-tsc crash the
concurrency notes describe). The second rerun completed with **only** the
`file-input.ts` error. No error names any file I own.

**Structure audit**: run with `GIT_INDEX_FILE` pointing at a copy of `.git/index`
with my new spec added via `git add -N`, so the audit — which reads only tracked
files — inspected it. `git ls-files` under that index listed it; the repository's
real index was left untouched (`git status` after the run shows only other
workers' unstaged modifications). 31 warnings is exactly the count
`w2-foundation` observed, so my two files add none, and
`pnpm structure:baseline` was **not** run.

## Not verified

- **No live browser.** `test:content` runs the real content bundle in headless
  Chromium, but nothing loaded the unpacked extension, so the background hop is
  unexercised: **no test proves a scroll result reaching the gateway.**
  `w2-domain-status` and `w2-browser-actions` own that path.
- **`options.smooth` has no test.** The settle-and-read-back path is implemented
  and type-checks, but no fixture requests a smooth scroll, and Chromium's
  behaviour under `prefers-reduced-motion` would make such a row environment-
  dependent. It is the one branch of this verb with no coverage.
- **Horizontal scrolling has no test.** `x` deltas and the `x` clamp are
  implemented and unexercised; every fixture scrolls vertically only.
- **Scrolling inside a scroll container or an iframe.** The verb moves the
  window; `toElement` delegates to `scrollElementIntoView`, which does handle a
  container, but no row covers either. Cross-frame scrolling is untested.
- **`untilStable` timing is empirical.** A pass gives the document 900 ms to
  grow (the `infinite-feed` fixture's own load delay is 300 ms plus a loopback
  fetch). On a slower page a real load could exceed that window and be read as
  settled. Nothing adapts the window to the page.
- **`pnpm check`, `pnpm test`, `pnpm build` at the repository root** were not run;
  `pnpm build` is forbidden to parallel workers. Domain checks were not run — I
  changed no domain file.
- **`scrollElementIntoView` is `w2-click`'s to change.** My `toElement` row
  asserts the target ends up fully inside the viewport; if that module stops
  centring, this row is the one that will catch it.

## Open questions or contradictions found

1. **The cap-is-a-failure rule (decision 2 above) needs the supervisor's
   ratification.** It is the difference between a truncated feed reporting
   `succeeded` and reporting `output_not_observed`, and no plan text settles it.
   I chose the strict reading of decision D4.
2. **`actions/execute.ts` returns verb promises unawaited.** Safe for this verb
   only because it cannot reject. `web.dom.assert`, `web.dom.extract_list`,
   `web.dom.upload` and the waits are async too, so the file needs one `await`
   per async verb; no Wave 2 brief owns it.
3. **The content harness cannot open a fixture in an armed state.**
   `openContentHarness` starts the Lab and navigates in one call, so a variant
   spec must arm and re-open. A `variant` option on `ContentHarnessOptions`
   (arming between `startScenarioLab` and `page.goto`) would remove the extra
   navigation; it belongs to whoever next owns `e2e/content/harness.ts`.
4. **The `by` mode has no "scroll a named element" form.** `WebAutomationScrollRequest`
   carries no target for `by`/`untilStable`, so both move the window even when
   the command names a `selector`. If a Flow needs to scroll a pane, the request
   type needs a target — `w2-domain-vocabulary` owns that shape.
